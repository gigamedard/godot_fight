<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Pool;
use App\Models\PoolPlayer;
use App\Events\PoolRoundStarted;
use Illuminate\Support\Str;

class PoolController extends Controller
{
    // List open public pools
    public function index()
    {
        $pools = Pool::withCount('players')->where('status', 'open')->where('is_private', false)->get();
        return response()->json($pools);
    }

    // Get a specific pool by invite code
    public function showByInviteCode($code)
    {
        $pool = Pool::withCount('players')->where('invite_code', $code)->firstOrFail();
        return response()->json($pool);
    }

    // Register a newly created pool (from frontend after on-chain creation)
    public function store(Request $request)
    {
        $request->validate([
            'id' => 'required|integer', // The on-chain poolId
            'entry_fee' => 'required|numeric',
            'max_players' => 'required|integer',
            'penalty_mode' => 'required|integer',
            'is_private' => 'boolean'
        ]);

        $inviteCode = $request->is_private ? Str::random(8) : null;

        $pool = Pool::create([
            'id' => $request->id,
            'entry_fee' => $request->entry_fee,
            'max_players' => $request->max_players,
            'penalty_mode' => $request->penalty_mode,
            'is_private' => $request->is_private ?? false,
            'invite_code' => $inviteCode,
            'status' => 'open'
        ]);

        return response()->json(['status' => 'success', 'pool' => $pool]);
    }

    // Join a pool (called after on-chain joinPool)
    public function join(Request $request)
    {
        $request->validate([
            'pool_id' => 'required|integer',
            'wallet_address' => 'required|string|size:42',
        ]);

        $pool = Pool::findOrFail($request->pool_id);

        if ($pool->status !== 'open') {
            return response()->json(['status' => 'error', 'message' => 'Poule fermée'], 400);
        }

        $playerCount = $pool->players()->count();
        if ($playerCount >= $pool->max_players) {
            return response()->json(['status' => 'error', 'message' => 'Poule complète'], 400);
        }

        PoolPlayer::firstOrCreate([
            'pool_id' => $pool->id,
            'wallet_address' => $request->wallet_address
        ]);

        // If pool is full, we can trigger the matchmaking immediately
        if ($pool->players()->count() >= $pool->max_players) {
            $pool->update(['status' => 'active']);
            $this->triggerMatchmaking($pool->id);
        }

        return response()->json(['status' => 'success']);
    }

    // Inform backend that a match has finished, so backend can update status and check for next round
    public function matchFinished(Request $request)
    {
        $request->validate([
            'pool_id' => 'required|integer',
            'loser_wallet' => 'nullable|string|size:42', // If null, it was a draw
            'winner_wallet' => 'nullable|string|size:42',
            'is_eliminated' => 'boolean'
        ]);

        // Note: In a production app, we should verify the on-chain event instead of trusting the client.
        // But for this hybrid prototype, we use the client API.
        if ($request->loser_wallet && $request->is_eliminated) {
            PoolPlayer::where('pool_id', $request->pool_id)
                ->where('wallet_address', $request->loser_wallet)
                ->update(['status' => 'eliminated']);
        }

        // Wait a bit and check if all matches are done to trigger next round
        // A full implementation would track each match status in DB. 
        // For simplicity, we can trigger matchmaking again. It will only match players who are not 'in-game'.
        
        // Return success
        return response()->json(['status' => 'success']);
    }

    // Trigger Matchmaking manually or after a round
    public function triggerMatchmaking($poolId)
    {
        $pool = Pool::findOrFail($poolId);
        
        // Get all alive players
        $players = $pool->players()->where('status', 'alive')->get()->shuffle();

        if ($players->count() <= 1) {
            // Pool is finished
            $pool->update(['status' => 'finished']);
            return response()->json(['status' => 'finished', 'winner' => $players->first()]);
        }

        $pairs = [];
        $waitingPlayer = null;

        $playerList = $players->pluck('wallet_address')->toArray();

        // If odd number, one player waits
        if (count($playerList) % 2 !== 0) {
            $waitingPlayer = array_pop($playerList);
        }

        // Create pairs
        for ($i = 0; $i < count($playerList); $i += 2) {
            $pairs[] = [
                'player1' => $playerList[$i],
                'player2' => $playerList[$i+1]
            ];
        }

        // Broadcast the matches to clients
        broadcast(new PoolRoundStarted($poolId, $pairs, $waitingPlayer));

        return response()->json(['status' => 'success', 'pairs' => $pairs, 'waiting' => $waitingPlayer]);
    }
}
