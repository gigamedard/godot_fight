<?php

namespace App\Services;

use App\Models\Fight;
use App\Models\Pool;
use App\Models\PoolPlayer;
use Illuminate\Support\Facades\Log;
// We'll need to trigger events for Reverb
// use App\Events\PoolRoundStarted;

class MatchmakingEngine
{
    /**
     * Start a round of fights for a given pool ID.
     */
    public function process(int $poolId): void
    {
        $pool = Pool::with(['players' => function ($query) {
            $query->where('status', 'in_pool')->orderBy('id');
        }])->findOrFail($poolId);

        if ($pool->status === 'finished') {
            Log::info("Pool {$poolId} already finished.");
            return;
        }

        // We only start a new round if there are NO pending fights for this pool.
        $pendingFights = Fight::where('pool_id', $poolId)
                              ->whereIn('status', ['waiting_for_commits', 'waiting_for_reveals'])
                              ->count();
        if ($pendingFights > 0) {
            Log::info("Pool {$poolId} already has {$pendingFights} pending fights. Waiting for them to finish.");
            return;
        }

        // Filter players who still have balance
        $availablePlayers = $pool->players->filter(function($p) use ($pool) {
            // Note: In our system we might not have battle_balance yet, just checking status
            return $p->status === 'in_pool';
        });

        if ($availablePlayers->count() < 2) {
            Log::info("Pool {$poolId} has fewer than 2 eligible players. Closing pool.");
            $pool->update(['status' => 'finished']);
            // Evaluate end of pool / distributions here later
            return;
        }

        // Deterministic Sort Logic using pool salt and round iteration
        // In our system we'll do a simple array shuffle for now, or adapt Web3Helper
        $availablePlayers = $availablePlayers->shuffle();

        if ($availablePlayers->count() % 2 !== 0) {
            $availablePlayers->pop();
        }

        $fightsToStart = [];
        $playersArray = $availablePlayers->values();

        for ($i = 0; $i < $playersArray->count(); $i += 2) {
            $fight = Fight::create([
                'pool_id'        => $pool->id,
                'player1_wallet' => $playersArray[$i]->wallet_address,
                'player2_wallet' => $playersArray[$i + 1]->wallet_address,
                'base_bet_amount'=> $pool->entry_fee ?? 0,
                'status'         => 'waiting_for_commits',
                'result'         => 'pending'
            ]);

            // Broadcast to the players that their fight has started (waiting for commits)
            // event(new \App\Events\MatchFound($fight));
            // Or broadcast PoolRoundStarted with the pairs
        }
    }
}
