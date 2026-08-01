<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Events\ChallengeSent;
use App\Events\MatchStarted;
use App\Events\ChallengeDeclined;
use App\Events\PlayerStatusChanged;
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

        // Créer le Fight en base pour permettre la résolution du match (statut, result, payout)
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => strtolower($request->challenger_id),
            'player2_wallet' => strtolower($request->target_id),
            'status' => 'waiting_for_commits',
            'base_bet_amount' => $request->bet_amount ?? 0,
        ]);

        // Mettre à jour le statut des joueurs (en combat)
        broadcast(new PlayerStatusChanged($request->challenger_id, 'in-game'));
        broadcast(new PlayerStatusChanged($request->target_id, 'in-game'));

        // Le target_id est celui qui a reçu le défi et l'accepte
        broadcast(new MatchStarted(
            $fight->id,
            $request->challenger_id,
            $request->target_id,
            $request->challenger_char ?? 2,
            $request->target_char ?? 2
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
}
