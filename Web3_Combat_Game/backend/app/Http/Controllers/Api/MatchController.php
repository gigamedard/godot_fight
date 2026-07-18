<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class MatchController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'wallet' => 'required|string|size:42|starts_with:0x',
            'result' => 'required|string|in:win,loss,draw'
        ]);

        // Simuler la sauvegarde en base de données ou interagir avec la blockchain
        \Log::info('Match result saved', [
            'wallet' => $validated['wallet'],
            'result' => $validated['result']
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Résultat du match enregistré avec succès !',
            'data' => $validated
        ]);
    }
}
