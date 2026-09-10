<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Events\ChallengeSent;
use App\Events\MatchStarted;
use App\Events\ChallengeDeclined;
use App\Events\PlayerStatusChanged;
use App\Events\ChallengesCancelled;
use App\Models\Fight;

class MatchmakingController extends Controller
{
    public function sendChallenge(Request $request)
    {
        $request->validate([
            'challenger_id' => 'required|string|size:42',
            'target_id' => 'required|string|size:42',
            'bet_amount' => 'required|numeric|min:0',
            'challenger_char' => 'nullable|integer',
        ]);

        $targetId = strtolower($request->target_id);
        $challengerId = strtolower($request->challenger_id);

        // Un joueur déjà en duel (fight non terminé) ne peut PAS être invité.
        if ($this->playerInActiveFight($targetId)) {
            return response()->json(['status' => 'error', 'message' => 'Ce joueur est déjà en combat.'], 409);
        }
        if ($this->playerInActiveFight($challengerId)) {
            return response()->json(['status' => 'error', 'message' => 'Vous êtes déjà en combat.'], 409);
        }

        broadcast(new ChallengeSent($request->challenger_id, $request->target_id, $request->bet_amount, $request->challenger_char ?? 2));

        return response()->json(['status' => 'success', 'message' => 'Défi envoyé']);
    }

    public function acceptChallenge(Request $request)
    {
        $request->validate([
            'challenger_id' => 'required|string|size:42',
            'target_id' => 'required|string|size:42',
            'challenger_char' => 'nullable|integer',
            'target_char' => 'nullable|integer',
            'bet_amount' => 'nullable|numeric|min:0',
        ]);

        $challengerId = strtolower($request->challenger_id);
        $targetId = strtolower($request->target_id);

        // Sécurité : refuser l'acceptation si l'un des joueurs est déjà en duel.
        if ($this->playerInActiveFight($challengerId) || $this->playerInActiveFight($targetId)) {
            return response()->json(['status' => 'error', 'message' => 'Un des joueurs est déjà en combat.'], 409);
        }

        // Annuler toutes les invitations pour les deux joueurs (envoyées et reçues)
        broadcast(new ChallengesCancelled($challengerId, 'entered_duel'));
        broadcast(new ChallengesCancelled($targetId, 'entered_duel'));

        // Créer le Fight en base pour permettre la résolution du match (statut, result, payout)
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => $challengerId,
            'player2_wallet' => $targetId,
            'status' => 'waiting_for_commits',
            'base_bet_amount' => $request->bet_amount ?? 0,
        ]);

        // Mettre à jour le statut des joueurs (en combat)
        broadcast(new PlayerStatusChanged($challengerId, 'in-game'));
        broadcast(new PlayerStatusChanged($targetId, 'in-game'));

        // FIX ICDM #1 : MatchStarted n'est PLUS broadcasté ici (le combat ne
        // démarre qu'avec MatchReady, quand les DEUX dépôts escrow sont
        // confirmés on-chain). On diffuse en revanche MatchDepositPending :
        // le front OUVRE METAMASK pour le dépôt, sans lancer le combat.
        broadcast(new \App\Events\MatchDepositPending(
            $fight->id,
            $request->challenger_id,
            $request->target_id,
            $request->challenger_char ?? 2,
            $request->target_char ?? 2,
            $request->bet_amount ?? 0
        ));

        return response()->json(['status' => 'success', 'match_id' => $fight->id]);
    }

    public function declineChallenge(Request $request)
    {
        $request->validate([
            'challenger_id' => 'required|string|size:42',
            'target_id' => 'required|string|size:42',
            'is_negotiation' => 'boolean'
        ]);

        $isNegotiation = $request->input('is_negotiation', false);

        // Prévenir le challenger que le défi est refusé
        broadcast(new ChallengeDeclined($request->challenger_id, $request->target_id, $isNegotiation));

        return response()->json(['status' => 'success', 'message' => 'Défi refusé']);
    }

    public function updateStatus(Request $request)
    {
        $request->validate([
            'player_id' => 'required|string|size:42',
            'status' => 'required|string|in:online,in-game',
        ]);

        broadcast(new PlayerStatusChanged($request->player_id, $request->status));

        return response()->json(['status' => 'success']);
    }

    /**
     * Vérifie si un joueur (wallet) est déjà impliqué dans un duel non terminé.
     * Un joueur en combat ne peut être ni invité, ni accepter un autre défi.
     *
     * IMPORTANT — fights orphelins : le timeout serveur (FIGHT_TIMEOUT_MS, ancré
     * sur created_at) n'est appliqué que quand un client interroge /battle/status.
     * Si les deux joueurs ferment la page sans résolution, un fight resterait
     * "waiting_for_commits" pour toujours et bloquerait les joueurs indéfiniment.
     * On applique donc ici la même deadline : un fight expiré est résolu (forfait)
     * à la volée et le joueur redevient disponible.
     */
    private function playerInActiveFight(string $wallet): bool
    {
        $wallet = strtolower($wallet);
        $fight = Fight::where(function ($q) use ($wallet) {
            $q->where('player1_wallet', $wallet)
              ->orWhere('player2_wallet', $wallet);
        })
        ->whereIn('status', ['waiting_for_commits', 'waiting_for_reveals'])
        ->latest('id')
        ->first();

        if (!$fight) {
            return false;
        }

        // Deadline absolue (mêmes règles que BattleController::resolveIfExpired).
        $timeoutMs = (int) config('game.fight_timeout_ms', 60000);
        $deadline = ((int) $fight->created_at?->getTimestamp()) * 1000 + $timeoutMs;

        if (time() * 1000 >= $deadline) {
            // Combat expiré : forfait côté serveur, le joueur est libéré.
            app(\App\Services\FightService::class)->resolveHybridFight($fight);
            return false;
        }

        return true;
    }

    /**
     * FIX ICDM #1 : vérifie les dépôts escrow d'un fight et broadcast MatchStarted
     * quand les DEUX sont confirmés. Appelé par le front (poll après chaque
     * notification de dépôt) et via /battle/settle pour un filet de sécurité.
     * Idempotent : ne broadcast JAMAIS deux fois (fight passe en
     * waiting_for_commits → deposits_broadcast flag).
     *
     * IMPORTANT (casse Reverb) : broadcast avec les IDs BRUTS du front —
     * cf. acceptChallenge avant-correction pour l'historique du bug.
     */
    public function checkDepositsAndBroadcast($fight): void
    {
        // Déjà diffusé ? (le statut n'a pas changé mais deposits_broadcasté est
        // déduit des flags) : on regarde si p1_deposited && p2_deposited.
        if (!($fight->p1_deposited && $fight->p2_deposited)) {
            return;
        }

        // Idempotence : si le match a déjà démarré côté commits (les deux
        // clients ont déjà reçu MatchReady), ne pas re-broadcast.
        // Marqueur : on réutilise une seule exécution via le statut du fight :
        // waiting_for_commits reste, mais on diffère par une vérification
        // supplémentaire : si les deux fronts ont déjà reçu, ils rejettent
        // l'événement (AppState.currentMatchId déjà lancé). Pour éviter tout
        // double-launch côté serveur, on trace en cache.
        $cacheKey = 'matchready_broadcast_' . $fight->id;
        if (\Cache::has($cacheKey = 'matchready_broadcast_' . $fight->id)) {
            return;
        }
        \Cache::put($cacheKey = $cacheKey ?? 'matchready_broadcast_' . $fight->id, true, now()->addHours(2));

        // Casse Reverb : IDs bruts checksum (côté client, l'abonnement est fait
        // sur la casse exacte du wallet du joueur).
        $p1 = $fight->player1_wallet;
        $p2 = $fight->player2_wallet;

        // FIX ICDM #1 : broadcast MatchReady (combat lance par les deux fronts).
        broadcast(new \App\Events\MatchReady(
            $fight->id,
            $p1,
            $p2,
            (float) $fight->base_bet_amount
        ));
    }
}
