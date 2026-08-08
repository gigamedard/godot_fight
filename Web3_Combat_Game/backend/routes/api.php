<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\MatchController;

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Auth;
use Illuminate\Auth\GenericUser;
use App\Http\Controllers\Api\MatchmakingController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/test-pool', function() {
    \App\Models\Pool::truncate();
    \App\Models\Pool::create([
        'id' => 9999,
        'entry_fee' => 0,
        'max_players' => 3,
        'status' => 'open',
        'penalty_mode' => 0,
    ]);
    
    $pool = \App\Models\Pool::firstOrCreate(
        ['id' => 9999],
        [
            'entry_fee' => 0,
            'max_players' => 3,
            'status' => 'waiting',
            'round_pending_matches' => 0,
            'penalty_mode' => 0,
        ]
    );
    return response()->json(['pool' => $pool, 'is_null' => is_null($pool), 'id' => $pool->id]);
});

Route::post('/match-result', [MatchController::class, 'store']);

// Mock d'authentification pour Laravel Echo / Reverb
Route::post('/broadcasting/auth', function (Request $request) {
    $wallet = $request->input('wallet_address') ?? $request->header('X-Wallet-Address');
    
    if (!$wallet || strlen($wallet) !== 42) {
        abort(403, 'Wallet invalide');
    }

    // Créer un utilisateur "fantôme" à la volée avec GenericUser pour éviter le cast 'int' du model User
    // Le pseudonyme du joueur (X-Player-Name) est prioritaire, sinon fallback "Joueur 0x..."
    $playerName = trim((string) ($request->input('player_name') ?? $request->header('X-Player-Name')));
    if ($playerName === '' || mb_strlen($playerName) > 24) {
        $playerName = 'Joueur ' . substr($wallet, 0, 6);
    }
    $user = new GenericUser([
        'id' => $wallet,
        'name' => $playerName
    ]);
    
    Auth::setUser($user);

    return Broadcast::auth($request);
});

// Routes de Matchmaking
Route::post('/matchmaking/challenge', [MatchmakingController::class, 'sendChallenge']);
Route::post('/matchmaking/accept', [MatchmakingController::class, 'acceptChallenge']);
Route::post('/matchmaking/decline', [MatchmakingController::class, 'declineChallenge']);
Route::post('/matchmaking/status', [MatchmakingController::class, 'updateStatus']);

// Routes de Pool / Battle Royale
use App\Http\Controllers\Api\PoolController;
use App\Http\Controllers\Api\InternalController;

Route::get('/pools', [PoolController::class, 'index']);
Route::get('/pools/user/{wallet}', [PoolController::class, 'getUserActivePool']);
Route::get('/pools/{id}', [PoolController::class, 'show'])->where('id', '[0-9]+');
Route::get('/pools/invite/{code}', [PoolController::class, 'showByInviteCode']);
Route::post('/pools', [PoolController::class, 'store']);
Route::post('/pools/{id}/join', [PoolController::class, 'join']);
Route::post('/pools/{id}/matchmake', [PoolController::class, 'triggerMatchmaking']);

// Routes internes pour l'Indexeur Blockchain
Route::post('/internal/pool-started', [InternalController::class, 'poolStarted']);
Route::post('/internal/match-finished', [InternalController::class, 'matchFinished']);

// Off-Chain Hybrid Battle API
use App\Http\Controllers\Api\BattleController;
use App\Http\Controllers\Api\AuthController;

Route::post('/auth/session-key', [AuthController::class, 'registerSessionKey']);

Route::post('/battle/commit', [BattleController::class, 'commitMove']);
Route::post('/battle/reveal', [BattleController::class, 'revealMove']);
Route::post('/battle/timeout', [BattleController::class, 'claimTimeout']);
Route::get('/battle/status/{match_id}', [BattleController::class, 'getMatchStatus']);

// Configuration de jeu exposée au frontend (durée du round, etc.)
Route::get('/game-config', function () {
    return response()->json([
        'fight_timeout_ms' => (int) config('game.fight_timeout_ms', 60000),
    ]);
});

// Retrait de fonds (voucher signé par le backend)
use App\Http\Controllers\Api\WithdrawController;
Route::post('/withdraw/voucher', [WithdrawController::class, 'voucher']);
Route::post('/withdraw/settle-voucher', [WithdrawController::class, 'settleVoucher']);
Route::post('/withdraw/claim-pool-voucher', [WithdrawController::class, 'claimPoolVoucher']);
