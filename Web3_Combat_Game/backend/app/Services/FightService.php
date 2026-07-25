<?php

namespace App\Services;

use App\Models\Fight;
use App\Models\User;
use App\Models\PoolPlayer;
use Illuminate\Support\Facades\Log;

class FightService
{
    /**
     * Called when both players have revealed their moves.
     */
    public function resolveHybridFight(Fight $fight)
    {
        $move1 = $this->mapMove($fight->player1_move);
        $move2 = $this->mapMove($fight->player2_move);

        $result = $this->determineResult($move1, $move2);
        
        $fight->result = $result;
        $fight->status = 'completed';
        $fight->save();

        if ($result === 'draw') {
            // Keep both players in the pool
        } elseif ($result === 'double_elimination') {
            // Eliminate both
            PoolPlayer::where('pool_id', $fight->pool_id)
                      ->whereIn('wallet_address', [$fight->player1_wallet, $fight->player2_wallet])
                      ->update(['status' => 'eliminated']);
        } else {
            $loserWallet = ($result === 'player1_win') ? $fight->player2_wallet : $fight->player1_wallet;
            
            // Eliminate the loser
            $poolPlayer = PoolPlayer::where('pool_id', $fight->pool_id)
                                    ->whereRaw('LOWER(wallet_address) = ?', [strtolower($loserWallet)])
                                    ->first();
            if ($poolPlayer) {
                $poolPlayer->status = 'eliminated';
                $poolPlayer->save();
            }
        }

        // Inform clients via WebSocket
        // event(new \App\Events\MatchFinished($fight));

        // Check if round is over (no more pending fights)
        $pendingFights = Fight::where('pool_id', $fight->pool_id)
                              ->whereIn('status', ['waiting_for_commits', 'waiting_for_reveals'])
                              ->count();

        if ($pendingFights === 0) {
            app(\App\Http\Controllers\Api\PoolController::class)->triggerMatchmaking($fight->pool_id);
        }
    }

    private function mapMove($moveInt)
    {
        // 1=Rock, 2=Paper, 3=Scissors
        switch ($moveInt) {
            case 1: return 'rock';
            case 2: return 'paper';
            case 3: return 'scissors';
            default: return 'nothing';
        }
    }

    public function determineResult($user1Move, $user2Move)
    {
        if ($user1Move === 'nothing' && $user2Move === 'nothing') return 'double_elimination'; // Both AFK
        if ($user1Move === 'nothing') return 'player2_win';
        if ($user2Move === 'nothing') return 'player1_win';
        
        if ($user1Move === $user2Move) {
            return 'draw';
        }

        $winningCombinations = ['rock' => 'scissors', 'scissors' => 'paper', 'paper' => 'rock'];
        if (isset($winningCombinations[$user1Move]) && $winningCombinations[$user1Move] === $user2Move) {
            return 'player1_win';
        }

        return 'player2_win';
    }
}
