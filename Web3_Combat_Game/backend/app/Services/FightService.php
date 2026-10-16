<?php

namespace App\Services;

use App\Models\Fight;
use App\Models\Pool;
use App\Models\PoolPlayer;
use App\Support\Wei;

class FightService
{
    /**
     * Called when both players have revealed their moves.
     */
    public function resolveHybridFight(Fight $fight)
    {
        // Idempotent : un combat déjà résolu ne se re-résout pas (évite les
        // doubles éliminations / doubles broadcasts quand le POST timeout du client
        // et la résolution serveur se chevauchent).
        if (in_array($fight->status, ['completed', 'canceled'])) {
            return;
        }

        $move1 = $this->mapMove($fight->player1_move);
        $move2 = $this->mapMove($fight->player2_move);
        $p1Committed = $fight->player1_commit !== null;
        $p2Committed = $fight->player2_commit !== null;

        $result = $this->determineResult($move1, $move2, $p1Committed, $p2Committed);
        
        $fight->result = $result;
        $fight->status = 'completed';
        $fight->save();

        // --- Économie de butin (poule) : transfert virtuel + élimination ---
        // MVP : le butin est un SCORE (le règlement on-chain reste à 1 champion).
        if ($fight->pool_id !== null) {
            $this->applyPoolLoot($fight, $result);
        }

        // Inform clients via WebSocket
        // event(new \App\Events\MatchFinished($fight));

        // Fin de tournoi (selon le type) puis suite éventuelle du matchmaking.
        if ($fight->pool_id !== null) {
            $this->maybeFinishPool((int) $fight->pool_id);

            $pendingFights = Fight::where('pool_id', $fight->pool_id)
                                  ->whereIn('status', ['waiting_for_commits', 'waiting_for_reveals'])
                                  ->count();
            $pool = Pool::find($fight->pool_id);

            if ($pendingFights === 0 && $pool && $pool->status !== 'finished') {
                app(\App\Http\Controllers\Api\PoolController::class)->triggerMatchmaking($fight->pool_id);
            }
        }
    }

    /**
     * Applique la règle de butin du combat (poule) :
     *  - 1re défaite d'un joueur → le winner prend TOUT son butin (élimination).
     *  - défaite suivante → le winner prend (butin - mise de base) ; le perdant garde
     *    son plancher (mise de base) ; s'il était déjà au plancher → éliminé.
     *  - double forfait → les deux perdent tout (éliminés).
     *  - match nul → aucun transfert.
     * Les montants sont en wei (string/gmp).
     */
    private function applyPoolLoot(Fight $fight, string $result): void
    {
        $pool = Pool::find($fight->pool_id);
        if (!$pool) return;

        $players = PoolPlayer::where('pool_id', $fight->pool_id)
            ->whereIn('wallet_address', [$fight->player1_wallet, $fight->player2_wallet])
            ->get()
            ->keyBy(function ($p) { return strtolower($p->wallet_address); });
        $p1 = $players[strtolower($fight->player1_wallet)] ?? null;
        $p2 = $players[strtolower($fight->player2_wallet)] ?? null;

        if ($result === 'draw' || $result === 'double_elimination') {
            // Poule : un match NUL (mêmes coups) OU un double-forfait (aucun coup
            // révélé) ne transfère AUCUN butin et n'élimine personne. Le front
            // affiche déjà « nul » dans ces deux cas (winner_wallet = null) : on
            // aligne le serveur dessus. Avant, `double_elimination` mettait les
            // deux à loot=0 + éliminé → plus personne en vie → aucun champion →
            // pot impossible à réclamer (bug constaté poule #25).
            return;
        }

        $winner = ($result === 'player1_win') ? $p1 : $p2;
        $loser  = ($result === 'player1_win') ? $p2 : $p1;
        if (!$winner || !$loser) return;

        $winnerLoot = gmp_init((string) ($winner->loot ?: '0'), 10);
        $loserLoot  = gmp_init((string) ($loser->loot ?: '0'), 10);
        $base       = gmp_init(Wei::toWei($pool->entry_fee), 10);

        if ((int) $loser->losses === 0) {
            // 1re défaite : tout le butin y passe.
            $transfer = $loserLoot;
        } else {
            // Défaites suivantes : on laisse le plancher (mise de base).
            $transfer = gmp_sub($loserLoot, $base);
            if (gmp_cmp($transfer, 0) <= 0) {
                $transfer = $loserLoot;
            }
        }

        $winner->loot = gmp_strval(gmp_add($winnerLoot, $transfer));
        $loser->loot  = gmp_strval(gmp_sub($loserLoot, $transfer));
        $loser->losses = (int) $loser->losses + 1;

        if (gmp_cmp(gmp_init((string) $loser->loot, 10), 0) <= 0) {
            $loser->loot = '0';
            $loser->status = 'eliminated';
        }
        $winner->save();
        $loser->save();
    }

    /**
     * Termine la poule si sa condition de fin est atteinte :
     *  - last_man  : <= 1 survivant ;
     *  - remaining : nb de survivants <= end_count ;
     *  - time      : started_at + end_seconds dépassé.
     */
    private function maybeFinishPool(int $poolId): void
    {
        $pool = Pool::find($poolId);
        if (!$pool || $pool->status === 'finished') return;

        $alive = PoolPlayer::where('pool_id', $poolId)->where('status', 'alive')->count();

        $end = false;
        if ($pool->end_condition === 'remaining' && $pool->end_count) {
            $end = $alive <= (int) $pool->end_count;
        } elseif ($pool->end_condition === 'time' && $pool->end_seconds && $pool->started_at) {
            $end = time() >= (strtotime((string) $pool->started_at) + (int) $pool->end_seconds);
        } else {
            $end = $alive <= 1;
        }

        if ($end) {
            $pool->status = 'finished';
            $pool->finished_at = now();
            $pool->save();
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

    public function determineResult($user1Move, $user2Move, $p1Committed = false, $p2Committed = false)
    {
        if ($user1Move === 'nothing' && $user2Move === 'nothing') {
            // Un move n'a jamais été révélé (l'adversaire n'a pas committé) : forfait
            if ($p1Committed && !$p2Committed) return 'player1_win'; // P2 forfait
            if ($p2Committed && !$p1Committed) return 'player2_win'; // P1 forfait
            return 'double_elimination'; // Both AFK
        }
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
