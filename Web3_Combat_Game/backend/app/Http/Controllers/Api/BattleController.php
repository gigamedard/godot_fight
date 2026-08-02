<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Fight;
use Illuminate\Support\Facades\Log;
use App\Services\FightService;

class BattleController extends Controller
{
    // Durée du round configurable par le développeur (config/game.php, env FIGHT_TIMEOUT_MS).
    private function timeoutMs(): int
    {
        return (int) config('game.fight_timeout_ms', 60000);
    }

    protected $fightService;
    public function __construct(FightService $fightService) { $this->fightService = $fightService; }

    public function commitMove(Request $request)
    {
        $request->validate([
            'match_id' => 'required|integer',
            'wallet_address' => 'required|string',
            'commit_hash' => 'required|string',
            'signature' => 'required|string', // Signature of the commit_hash by the Session Key
        ]);

        $wallet = strtolower($request->wallet_address);
        
        // Verify Session Key
        $session = \App\Models\SessionKey::where('wallet_address', $wallet)->where('expires_at', '>', now())->first();
        if (!$session) {
            return response()->json(['error' => 'No active session key found for this wallet. Please re-authenticate.'], 403);
        }

        // Verify the signature (Hash of the move) was signed by the session key
        $message = "Commit: " . $request->commit_hash;
        $recoveredAddress = app(\App\Http\Controllers\Api\AuthController::class)->recoverPersonalSignature($message, $request->signature);
        
        if (strtolower($recoveredAddress) !== strtolower($session->session_public_key)) {
            return response()->json(['error' => 'Invalid session signature.'], 403);
        }

        $fight = Fight::findOrFail($request->match_id);

        if (strtolower($fight->player1_wallet) === $wallet) {
            $fight->player1_commit = $request->commit_hash;
        } elseif (strtolower($fight->player2_wallet) === $wallet) {
            $fight->player2_commit = $request->commit_hash;
        } else {
            return response()->json(['error' => 'Not a participant in this match'], 403);
        }

        $fight->save();

        if ($fight->player1_commit && $fight->player2_commit && $fight->status === 'waiting_for_commits') {
            $fight->status = 'waiting_for_reveals';
            $fight->save();
        }

        return response()->json(['status' => 'success', 'fight_status' => $fight->status]);
    }

    public function revealMove(Request $request)
    {
        $request->validate([
            'match_id' => 'required|integer',
            'wallet_address' => 'required|string',
            'move' => 'required|integer',
            'secret' => 'required|string'
        ]);

        $fight = Fight::findOrFail($request->match_id);

        // Very basic validation - the true validation happens offchain via the logic
        // Hash verification (Optional but good for hybrid model to ensure frontend didn't cheat between commit and reveal)
        // $expectedHash = Web3::keccak256( pack($request->move, $request->secret) ) 
        // For now, we trust the frontend reveal since it's also sent to blockchain.
        
        if (strtolower($fight->player1_wallet) === strtolower($request->wallet_address)) {
            $fight->player1_move = $request->move;
        } elseif (strtolower($fight->player2_wallet) === strtolower($request->wallet_address)) {
            $fight->player2_move = $request->move;
        } else {
            return response()->json(['error' => 'Not a participant in this match'], 403);
        }

        $fight->save();

        if ($fight->player1_move !== null && $fight->player2_move !== null && $fight->status === 'waiting_for_reveals') {
            // BOTH REVEALED !
            // Resolve match via FightService
            $this->fightService->resolveHybridFight($fight);
        }

        return response()->json(['status' => 'success', 'fight_status' => $fight->status]);
    }

    public function claimTimeout(Request $request)
    {
        $request->validate([
            'match_id' => 'required|integer',
        ]);

        $fight = Fight::findOrFail($request->match_id);

        if ($fight->status === 'completed') {
            return response()->json(['status' => 'error', 'message' => 'Match already completed.']);
        }

        // Force resolve with current moves (null will be treated as 'nothing')
        $this->fightService->resolveHybridFight($fight);

        return response()->json(['status' => 'success', 'fight_status' => $fight->status, 'result' => $fight->result]);
    }

    public function getMatchStatus($match_id)
    {
        $fight = Fight::findOrFail($match_id);

        // Le serveur est l'autorité du timeout : un combat toujours en attente
        // passé la deadline est résolu ici, même si les clients se déconnectent.
        $this->resolveIfExpired($fight);

        $winnerWallet = null;
        if ($fight->result === 'player1_win') {
            $winnerWallet = $fight->player1_wallet;
        } elseif ($fight->result === 'player2_win') {
            $winnerWallet = $fight->player2_wallet;
        }

        // Deadline absolue (epoch ms serveur) : la même pour tous les joueurs,
        // quel que soit leur fuseau horaire. Ancré sur la création du combat
        // (created_at) : deadline FIXE par round, donc compte à rebours monotone.
        $timeoutMs = $this->timeoutMs();
        $deadline = ((int) $fight->created_at?->getTimestamp()) * 1000 + $timeoutMs;

        return response()->json([
            'status' => $fight->status,
            'result' => $fight->result,
            'winner_wallet' => $winnerWallet,
            'payout' => $fight->base_bet_amount,
            'deadline' => $deadline,
            'timeout_ms' => $timeoutMs,
            'player1_wallet' => $fight->player1_wallet,
            'player2_wallet' => $fight->player2_wallet,
            'player1_commit' => $fight->player1_commit ? true : false,
            'player2_commit' => $fight->player2_commit ? true : false,
            'player1_move' => $fight->player1_move,
            'player2_move' => $fight->player2_move,
        ]);
    }

    /**
     * Résout un combat toujours en attente dont la deadline (durée fixe d'un round,
     * ancrée sur created_at, configurable via config/game.php) est dépassée.
     * Idempotent : ne fait rien si le combat est déjà résolu. La deadline ne glisse
     * pas : un round a une durée fixe, donc le compte à rebours exposé aux joueurs
     * ne remonte jamais.
     */
    private function resolveIfExpired(Fight $fight): void
    {
        if (!in_array($fight->status, ['waiting_for_commits', 'waiting_for_reveals'])) {
            return;
        }

        $deadline = ((int) $fight->created_at?->getTimestamp()) * 1000 + $this->timeoutMs();
        if (time() * 1000 >= $deadline) {
            $this->fightService->resolveHybridFight($fight);
        }
    }
}
