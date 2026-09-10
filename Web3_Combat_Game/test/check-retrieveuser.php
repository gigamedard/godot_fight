<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Le 403 vient de Broadcaster.php:129 (fin du foreach = AUCUN pattern matché
// OU result false). Le handler mémoire retourne true. Donc soit le pattern
// ne matche pas, soit retrieveUser renvoie un autre user, soit la route utilise
// un AUTRE broadcaster instance que celui des canaux enregistrés.

// 1. Le pattern matche-t-il ?
$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);
$m = $ref->getMethod('channelNameMatchesPattern');
$m->setAccessible(true);
echo "Match 'private-player.0x3c44...' vs 'private-player.{id}': " .
    var_export($m->invoke($bc, 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 'private-player.{id}'), true) . "\n";

// 2. La route crée SON GenericUser : id = X-Wallet-Address TEL QUEL (checksum)
//    puis Broadcast::auth($request) → retrieveUser → $request->user()
//    MAIS la route fait Auth::setUser($user) AVANT Broadcast::auth($request)
//    Le broadcaster utilise $request->user() — qui lit le guard, PAS Auth::setUser.
// Test : $request->user() après Auth::setUser ?
$user = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
Illuminate\Support\Facades\Auth::setUser($user);

$req = Illuminate\Http\Request::create('/api/broadcasting/auth', 'POST', [
    'socket_id' => '1234.5678',
    'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
], [], [], ['HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC']);
echo "\$req->user() === GenericUser : " . var_export($req->user() !== null, true) . "\n";
echo "\$req->user() id: " . var_export($req->user() ? $req->user()->getAuthIdentifier() : null, true) . "\n";