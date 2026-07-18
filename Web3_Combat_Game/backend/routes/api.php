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

Route::post('/match-result', [MatchController::class, 'store']);

// Mock d'authentification pour Laravel Echo / Reverb
Route::post('/broadcasting/auth', function (Request $request) {
    $wallet = $request->input('wallet_address') ?? $request->header('X-Wallet-Address');
    
    if (!$wallet || strlen($wallet) !== 42) {
        abort(403, 'Wallet invalide');
    }

    // Créer un utilisateur "fantôme" à la volée avec GenericUser pour éviter le cast 'int' du model User
    $user = new GenericUser([
        'id' => $wallet,
        'name' => 'Joueur ' . substr($wallet, 0, 6)
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
Route::get('/pools', [PoolController::class, 'index']);
Route::get('/pools/invite/{code}', [PoolController::class, 'showByInviteCode']);
Route::post('/pools', [PoolController::class, 'store']);
Route::post('/pools/join', [PoolController::class, 'join']);
Route::post('/pools/match-finished', [PoolController::class, 'matchFinished']);
Route::post('/pools/{id}/matchmake', [PoolController::class, 'triggerMatchmaking']);
