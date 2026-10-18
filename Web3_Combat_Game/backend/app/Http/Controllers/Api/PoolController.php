<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Pool;
use App\Models\PoolPlayer;
use App\Models\Fight;
use App\Events\PoolRoundStarted;
use App\Support\ProcessHelper;
use App\Support\Wei;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PoolController extends Controller
{
    // List open public pools
    public function index()
    {
        // Salons ouverts (rejoignables) + salons en cours (observables en spectateur).
        $pools = Pool::withCount('players')->whereIn('status', ['open', 'active'])->where('is_private', false)->get();
        return response()->json($pools);
    }

    // Get a specific pool by id
    public function show($id)
    {
        $pool = Pool::withCount('players')->with('players')->findOrFail($id);
        $response = $pool->toArray();

        if ($pool->status === 'active') {
            $playersCache = $pool->players->keyBy(function($p) { return strtolower($p->wallet_address); });
            $response['active_pairs'] = Fight::where('pool_id', $id)
                ->whereIn('status', ['waiting_for_commits', 'waiting_for_reveals'])
                ->get()
                ->map(function($f) use ($playersCache) {
                    $p1 = $playersCache[strtolower($f->player1_wallet)] ?? null;
                    $p2 = $playersCache[strtolower($f->player2_wallet)] ?? null;
                    return [
                        'matchId' => $f->id,
                        'player1' => $f->player1_wallet,
                        'player2' => $f->player2_wallet,
                        'p1_char' => $p1 ? $p1->character_id : 2,
                        'p2_char' => $p2 ? $p2->character_id : 2,
                    ];
                });
        }

        return response()->json($response);
    }

    public function getUserActivePool($wallet)
    {
        $player = \App\Models\PoolPlayer::where('wallet_address', strtolower($wallet))
            ->where('status', 'alive')
            ->whereHas('pool', function($q) {
                $q->whereIn('status', ['open', 'active']);
            })
            ->latest()
            ->first();

        if (!$player) {
            return response()->json(['active' => false]);
        }

        return response()->json([
            'active' => true,
            'pool_id' => $player->pool_id
        ]);
    }

    // Get a specific pool by invite code
    public function showByInviteCode($code)
    {
        $pool = Pool::withCount('players')->where('invite_code', $code)->firstOrFail();
        return response()->json($pool);
    }

    // Register a newly created pool (from frontend after on-chain creation)
    public function store(Request $request)
    {
        $request->validate([
            'entry_fee' => 'required|numeric',
            'max_players' => 'required|integer',
            'penalty_mode' => 'required|integer',
            'is_private' => 'boolean',
            'owner_wallet' => 'nullable|string',
            'character_id' => 'nullable|integer',
            'end_condition' => 'nullable|string|in:last_man,remaining,time',
            'end_count' => 'nullable|integer|min:1',
            'end_seconds' => 'nullable|integer|min:30'
        ]);

        $inviteCode = $request->is_private ? Str::random(8) : null;
        $endCondition = $request->end_condition ?? 'last_man';

        // Poule payante : elle reste "pending_creation" (invisible/joignable par
        // personne) tant que le créateur n'a pas verrouillé sa mise on-chain.
        // Poule gratuite (mise 0) : rien à valider → directement "open".
        $isFree = ((float) $request->entry_fee) <= 0;
        $status = $isFree ? 'open' : 'pending_creation';

        $pool = Pool::create([
            'entry_fee' => $request->entry_fee,
            'max_players' => $request->max_players,
            'penalty_mode' => $request->penalty_mode,
            'is_private' => $request->is_private ?? false,
            'owner_wallet' => $request->owner_wallet ? strtolower($request->owner_wallet) : null,
            'invite_code' => $inviteCode,
            'status' => $status,
            'end_condition' => $endCondition,
            'end_count' => $endCondition === 'remaining' ? ($request->end_count ?? 2) : null,
            'end_seconds' => $endCondition === 'time' ? ($request->end_seconds ?? 600) : null,
        ]);

        // Note: Le store n'ajoute pas le créateur automatiquement dans pool_players
        // Le frontend fait un appel à join() juste après la création


        return response()->json(['status' => 'success', 'pool' => $pool]);
    }

    public function join(Request $request, $id)
    {
        $request->validate([
            'player_wallet' => 'required|string',
            'character_id' => 'nullable|integer',
            'player_name' => 'nullable|string|max:24',
        ]);

        $pool = Pool::findOrFail($id);
        $wallet = strtolower($request->player_wallet);

        // Poule en attente du dépôt du créateur : seul le créateur peut adhérer
        // (les autres n'ont pas à rejoindre une poule qui n'existe pas encore).
        if ($pool->status === 'pending_creation' && $wallet !== strtolower((string) $pool->owner_wallet)) {
            return response()->json(['error' => 'Pool not available yet'], 404);
        }

        $name = $request->filled('player_name') ? trim((string) $request->player_name) : null;
        if ($name === '') {
            $name = null;
        }

        $existing = PoolPlayer::where('pool_id', $id)->where('wallet_address', $wallet)->first();

        // Rejet seulement si c'est un NOUVEAU joueur et que la poule est pleine.
        if (!$existing && $pool->players()->count() >= $pool->max_players) {
            return response()->json(['error' => 'Pool is full'], 400);
        }

        if ($existing) {
            if ($name && $existing->player_name !== $name) {
                $existing->player_name = $name;
                $existing->save();
            }
        } else {
            // Poule gratuite (mise 0) : aucun dépôt on-chain à confirmer → le
            // joueur est « déposé » dès la jonction.
            $freePool = ((float) $pool->entry_fee) <= 0;
            PoolPlayer::create([
                'pool_id' => $id,
                'wallet_address' => $wallet,
                'character_id' => $request->character_id ?? 2,
                'status' => 'alive',
                'deposited' => $freePool,
                'loot' => Wei::toWei($pool->entry_fee),
                'losses' => 0,
                'player_name' => $name,
            ]);
        }

        $currentCount = $pool->players()->count();
        \Illuminate\Support\Facades\Log::info("Pool #{$id} JOIN wallet={$wallet} name=" . ($name ?: '-') . " count_after={$currentCount} max={$pool->max_players}");

        // On NE démarre PAS ici : on attend la confirmation du dépôt on-chain de
        // CHAQUE joueur (voir depositConfirmed / maybeStartPool). Le démarrage
        // immédiat ne concerne que les poules gratuites (déjà « déposées »).
        $this->maybeStartPool($id);

        return response()->json(['status' => 'success']);
    }

    /**
     * Le front notifie qu'un joueur a confirmé (tx minée) son dépôt escrow.
     * La poule ne démarre qu'une fois TOUS les dépôts confirmés.
     */
    public function depositConfirmed(Request $request, $id)
    {
        $request->validate([
            'player_wallet' => 'required|string',
            'tx_hash' => 'nullable|string',
        ]);

        $wallet = strtolower($request->player_wallet);
        $pool = Pool::findOrFail($id);
        $player = PoolPlayer::where('pool_id', $id)->where('wallet_address', $wallet)->first();

        if (!$player) {
            return response()->json(['error' => 'Player not in pool'], 404);
        }

        if (!$player->deposited) {
            $player->deposited = true;
            $player->deposit_tx = $request->tx_hash;
            $player->deposited_at = now();
            $player->save();
        }

        // Dépôt du créateur confirmé → la poule devient réellement ouverte
        // (visible dans la liste et joignable). Seul le créateur peut être dans
        // une poule "pending_creation" (join() le bloque sinon), donc ce dépôt
        // est forcément le sien.
        if ($pool->status === 'pending_creation') {
            $pool->update(['status' => 'open']);
        }

        $this->maybeStartPool($id);

        return response()->json([
            'status' => 'success',
            'pool_status' => $pool->fresh()->status ?? $pool->status,
        ]);
    }

    /**
     * Démarre la poule si (et seulement si) elle est PLEINE et que TOUS les
     * joueurs ont confirmé leur dépôt : évite que le combat commence pendant
     * que le dernier joueur valide encore sa transaction dans son wallet.
     */
    private function maybeStartPool($poolId)
    {
        $pool = Pool::find($poolId);
        if (!$pool || $pool->status !== 'open') {
            return;
        }

        if ($pool->players()->count() < $pool->max_players) {
            return;
        }

        if ($pool->players()->where('deposited', false)->count() > 0) {
            return;
        }

        $pool->update(['status' => 'active', 'started_at' => now()]);
        $this->triggerMatchmaking($poolId);
    }
    // Trigger Matchmaking manually or after a round
    public function triggerMatchmaking($poolId)
    {
        $pool = Pool::findOrFail($poolId);

        // Poule terminée : ne rien relancer.
        if ($pool->status === 'finished') {
            return response()->json(['status' => 'finished']);
        }

        // Horodatage de démarrage (pour la fin « par temps »).
        if (!$pool->started_at) {
            $pool->started_at = now();
            $pool->save();
        }

        $alivePlayers = $pool->players()->where('status', 'alive')->get();
        $aliveCount = $alivePlayers->count();

        // Condition de fin atteinte ? (last_man : <=1 ; remaining : <=end_count ; time : dépassé)
        $shouldEnd = false;
        if ($pool->end_condition === 'remaining' && $pool->end_count) {
            $shouldEnd = $aliveCount <= (int) $pool->end_count;
        } elseif ($pool->end_condition === 'time' && $pool->end_seconds) {
            $shouldEnd = time() >= (strtotime((string) $pool->started_at) + (int) $pool->end_seconds);
        } else {
            $shouldEnd = $aliveCount <= 1;
        }

        if ($aliveCount <= 1 || $shouldEnd) {
            // Fin de poule. MVP : le « champion » on-chain = plus gros butin
            // (sinon dernier survivant). Le butin reste un score d'affichage.
            $winner = $alivePlayers->sort(function ($a, $b) {
                return gmp_cmp(gmp_init((string) ($b->loot ?: '0'), 10), gmp_init((string) ($a->loot ?: '0'), 10));
            })->first();

            $pool->update(['status' => 'finished', 'finished_at' => now(), 'round_pending_matches' => 0]);
            broadcast(new PoolRoundStarted($poolId, [], null, $winner?->wallet_address));

            return response()->json(['status' => 'finished', 'winner' => $winner]);
        }

        $players = $alivePlayers->shuffle();

        $pairs = [];
        $waitingPlayer = null;

        // Les joueurs et leurs personnages
        $playerList = array_values($players->map(function($p) {
            return [
                'wallet' => $p->wallet_address,
                'char' => $p->character_id
            ];
        })->toArray());

        // If odd number, one player is exempt (bye) — counts as 1 pending "match"
        if (count($playerList) % 2 !== 0) {
            $waitingPlayer = array_pop($playerList)['wallet'];
        }

        // Create pairs and corresponding Fight records
        for ($i = 0; $i < count($playerList); $i += 2) {
            $fight = Fight::create([
                'pool_id' => $poolId,
                'player1_wallet' => strtolower($playerList[$i]['wallet']),
                'player2_wallet' => strtolower($playerList[$i+1]['wallet']),
                'status' => 'waiting_for_commits',
                'base_bet_amount' => $pool->entry_fee,
            ]);

            $pairs[] = [
                'matchId' => $fight->id,
                'player1' => $playerList[$i]['wallet'],
                'player2' => $playerList[$i+1]['wallet'],
                'p1_char' => $playerList[$i]['char'],
                'p2_char' => $playerList[$i+1]['char']
            ];
        }

        // Number of pending resolutions = matches only (bye doesn't need resolution via indexer)
        $pendingCount = count($pairs);
        $pool->update(['round_pending_matches' => $pendingCount]);

        // Broadcast the matches to clients
        broadcast(new PoolRoundStarted($poolId, $pairs, $waitingPlayer));

        return response()->json(['status' => 'success', 'pairs' => $pairs, 'waiting' => $waitingPlayer]);
    }

    /**
     * Consolide le pot d'une poule terminée : le serveur soumet lui-même les
     * settleLoser de chaque joueur éliminé ayant encore un solde, vers le champion.
     * Ne dépend pas du client du vainqueur.
     */
    protected function consolidatePoolPot($pool, $winner)
    {
        if (!$winner || !$pool) {
            return;
        }

        $losers = PoolPlayer::where('pool_id', $pool->id)
            ->whereRaw('LOWER(wallet_address) != ?', [strtolower($winner->wallet_address)])
            ->pluck('wallet_address')
            ->all();

        if (count($losers) === 0) {
            return;
        }

        $node = (string) config('services.web3.node_path', 'node');
        $script = (string) config('services.web3.consolidate_script');
        if (!is_file($script)) {
            Log::warning('Script de consolidation introuvable : ' . $script);
            return;
        }

        $cmd = escapeshellarg($node)
            . ' ' . escapeshellarg($script)
            . ' ' . (int) $pool->id
            . ' ' . escapeshellarg($winner->wallet_address)
            . ' ' . implode(' ', array_map('escapeshellarg', $losers))
            . ' >> ' . escapeshellarg(storage_path('logs/consolidate.log')) . ' 2>&1';

        // Lancement en arrière-plan (Windows : start /B, Linux/Docker : nohup)
        ProcessHelper::spawnBackground($cmd);
        Log::info("Consolidation du pot de la poule #{$pool->id} lancée (champion {$winner->wallet_address}).");
    }
}
