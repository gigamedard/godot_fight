<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Events\ChallengeSent;
use App\Events\MatchStarted;
use App\Events\ChallengeDeclined;
use App\Events\PlayerStatusChanged;
use Illuminate\Support\Str;

class MatchmakingController extends Controller
{
    public function sendChallenge(Request $request)
    {
        $request->validate([
            'challenger_id' => 'required|string|size:42',
            'target_id' => 'required|string|size:42',
            'bet_amount' => 'required|numeric|min:0',
        ]);

        broadcast(new ChallengeSent($request->challenger_id, $request->target_id, $request->bet_amount));

        return response()->json(['status' => 'success', 'message' => 'Défi envoyé']);
    }

    public function acceptChallenge(Request $request)
    {
        $request->validate([
            'challenger_id' => 'required|string|size:42',
            'target_id' => 'required|string|size:42',
        ]);

        // Générer un ID de match unique
        $matchId = (string) Str::uuid();

        // Mettre à jour le statut des joueurs (en combat)
        broadcast(new PlayerStatusChanged($request->challenger_id, 'in-game'));
        broadcast(new PlayerStatusChanged($request->target_id, 'in-game'));

        // Le target_id est celui qui a reçu le défi et l'accepte
        broadcast(new MatchStarted($matchId, $request->challenger_id, $request->target_id));

        return response()->json(['status' => 'success', 'match_id' => $matchId]);
    }

    public function declineChallenge(Request $request)
    {
        $request->validate([
            'challenger_id' => 'required|string|size:42',
            'target_id' => 'required|string|size:42',
        ]);

        // Prévenir le challenger que le défi est refusé
        broadcast(new ChallengeDeclined($request->challenger_id, $request->target_id));

        return response()->json(['status' => 'success', 'message' => 'Défi refusé']);
    }
}
