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
                ['status' => 'alive']
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
}
