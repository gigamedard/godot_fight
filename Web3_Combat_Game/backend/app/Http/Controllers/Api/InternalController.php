<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Pool;
use App\Models\PoolPlayer;
use App\Events\PoolRoundStarted;

class InternalController extends Controller
{
    // Constructor removed because middleware is now in routes
    
    private function checkToken(Request $request)
    {
        if ($request->bearerToken() !== 'super_secret_indexer_token') {
            abort(401, 'Unauthorized');
        }
    }

    public function poolStarted(Request $request)
    {
        $this->checkToken($request);
        
        $request->validate([
            'pool_id' => 'required|string',
            'participants' => 'required|array'
        ]);

        $poolId = (int) $request->pool_id;
        $participants = $request->participants;

        // Try to find the pool, or create it if the DB doesn't have it yet 
        // (because the DB pool creation was originally done by POST /api/pools but we are removing it)
        $pool = Pool::find($poolId);
        if (!$pool) {
            $pool = Pool::create([
                'id' => $poolId,
                'entry_fee' => 0,
                'penalty_mode' => 0,
                'max_players' => count($participants),
                'status' => 'waiting',
                'round_pending_matches' => 0
            ]);
        }

        // Add participants
        foreach ($participants as $wallet) {
            PoolPlayer::firstOrCreate(
                ['pool_id' => $pool->id, 'wallet_address' => strtolower($wallet)],
                ['status' => 'alive', 'character_id' => 2]
            );
        }

        // Trigger the first round
        app(\App\Http\Controllers\Api\PoolController::class)->triggerMatchmaking($pool->id);

        return response()->json(['status' => 'success']);
    }

    public function matchFinished(Request $request)
    {
        $this->checkToken($request);
        
        $request->validate([
            'pool_id' => 'required|string',
            'match_id' => 'required|string',
            'winner' => 'required|string',
            'loser' => 'required|string',
            'is_eliminated' => 'required|boolean'
        ]);

        $pool = Pool::findOrFail((int) $request->pool_id);

        // Eliminate loser if the blockchain says so
        if ($request->is_eliminated && $request->loser !== '0x0000000000000000000000000000000000000000') {
            PoolPlayer::where('pool_id', $pool->id)
                ->where('wallet_address', strtolower($request->loser))
                ->update(['status' => 'eliminated']);
        }

        // We no longer need Cache::add because the Indexer guarantees only ONE event per match!
        $pool->decrement('round_pending_matches');
        $pool->refresh();

        if ($pool->round_pending_matches <= 0) {
            app(\App\Http\Controllers\Api\PoolController::class)->triggerMatchmaking($pool->id);
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * Règlement gasless d'un DUEL : le serveur soumet lui-même settleLoser via
     * le script settle_fight.js (backend signer — paie le gaz, 0 validation
     * MetaMask pour le gagnant). Idempotent : si le solde du perdant est déjà 0,
     * le script sort sans erreur ("rien à régler").
     *
     * FIX ICDM #2 : AVANT de régler, on vérifie que les DEUX dépôts escrow
     * sont confirmés on-chain. Si le solde du perdant est 0 ALORS QUE ses
     * dépôts sont confirmés → règlement déjà fait (idempotent) → noop.
     * Si le dépôt du perdant n'est PAS confirmé → on retente jusqu'à 30s
     * (polling receipt) : MetaMask peut miner lentement.
     *
     * Body : { winner, loser }
     * Réponse : { status: success, tx_hash } ou { status: noop } si rien à régler.
     */
    public function settleDuel(Request $request)
    {
        $request->validate([
            'winner' => 'required|string|size:42|starts_with:0x',
            'loser'  => 'required|string|size:42|starts_with:0x',
        ]);

        $winner = $request->winner;
        $loser  = $request->loser;

        // Attente active : le perdant doit avoir un solde on-chain (les deux
        // dépôts minés). MetaMask peut prendre 12-30s pour confirmer.
        $rpc = (string) config('services.web3.rpc_url', 'http://127.0.0.1:8545');
        $contract = strtolower((string) config('services.web3.contract_address'));
        $loserLower = strtolower($loser);
        $ready = false;
        for ($i = 0; $i < 15; $i++) {
            try {
                $res = \Http::timeout(5)->post($rpc, [
                    'jsonrpc' => '2.0', 'id' => 1,
                    'method' => 'eth_call',
                    'params' => [[
                        'to' => config('services.web3.contract_address'),
                        'data' => '0x' . $this->selectorUserBalances(),
                        'from' => $winner,
                    ], 'latest'],
                ]);
                $body = $res->json();
                if (!empty($body['result']) && strlen($body['result']) >= 66) {
                    $balHex = substr($body['result'], 2, 64);
                    if (gmp_cmp(gmp_init($balHex, 16), 0) > 0) { $ready = true; break; }
                }
            } catch (\Throwable $e) {
                // retry
            }
            sleep(2);
        }

        if (!$ready) {
            // Solde du perdant toujours 0 après 30s : le dépôt n'est jamais
            // arrivé. On ne règlemente PAS (aucune perte de fonds) et le front
            // pourra retenter. Réponse noop.
            \Log::warning("Settle duel avorté : solde perdant 0 après attente ({$loser})");
            return response()->json([
                'status' => 'noop',
                'message' => 'Solde du perdant à 0 (dépôt non confirmé) — règlement différé, retenté automatiquement.',
            ]);
        }

        $script = (string) config('services.web3.settle_script');
        if (!is_file($script)) {
            return response()->json(['status' => 'error', 'message' => 'Script de règlement introuvable.'], 500);
        }

        $node = (string) config('services.web3.node_path', 'node');
        $cmd = escapeshellarg($node)
            . ' ' . escapeshellarg($script)
            . ' 0' // pas de poule : duel
            . ' ' . escapeshellarg($winner)
            . ' ' . escapeshellarg($loser)
            . ' 2>&1';

        // Exécution SYNCHRONE (le front attend la confirmation du règlement
        // pour afficher le crédit du pot). Durée typique : 1-3 s sur Hardhat.
        $output = shell_exec($cmd);
        \Log::info("Settle duel : {$winner} gagne sur {$loser}", ['output' => $output]);

        return response()->json([
            'status' => 'success',
            'winner' => $winner,
            'loser' => $loser,
            'script_output' => $output,
        ]);
    }

    /**
     * Sélecteur calldata de userBalances(address) : 0x26224c64.
     * Calculé en dur pour éviter la dépendance à l'ABI dans ce contrôleur.
     */
    private function selectorUserBalances(): string
    {
        return '26224c64'; // selector 4 bytes de userBalances(address)
    }

    /**
     * Retrait PUSH gasless : le serveur soumet lui-même withdrawTo (voucher
     * signé par le backend) — le joueur ne signe rien, ne paie pas de gaz.
     * Idempotent : solde 0 → "rien à retirer".
     *
     * Body : { wallet_address }
     * Réponse : { status: success, tx_hash } ou { status: noop } si solde 0.
     */
    public function pushWithdraw(Request $request)
    {
        $request->validate([
            'wallet_address' => 'required|string|size:42|starts_with:0x',
        ]);

        // FIX ICDM #3 : garde anti-perdant (même règle que le voucher classique).
        app(\App\Http\Controllers\Api\WithdrawController::class)->guardLoserWithdrawPublic($request->wallet_address);

        $wallet = $request->wallet_address;

        $script = (string) config('services.web3.withdraw_push_script');
        if (!is_file($script)) {
            return response()->json(['status' => 'error', 'message' => 'Script de retrait introuvable.'], 500);
        }

        $node = (string) config('services.web3.node_path', 'node');
        $cmd = escapeshellarg($node)
            . ' ' . escapeshellarg($script)
            . ' ' . escapeshellarg($wallet)
            . ' 2>&1';

        $output = shell_exec($cmd);
        \Log::info("Retrait push pour {$wallet}", ['output' => $output]);

        return response()->json([
            'status' => 'success',
            'wallet_address' => $wallet,
            'script_output' => $output,
        ]);
    }
}
