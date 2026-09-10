<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Instrumenter : que se passe-t-il DANS verifyUserCanAccessChannel ?
$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);

// retrieveUser avec une vraie requête kernel
$request = Illuminate\Http\Request::create('http://localhost/api/broadcasting/auth', 'POST', [], [], [], [
    'HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));

// Rien ne peut reproduire Auth::setUser de la route avant l'appel — donc on
// teste la chaîne complète : la route fait Auth::setUser($user) puis Broadcast::auth.
// retrieveUser: $request->user() — avec rebinding, ça appelle le guard.
$guard = Illuminate\Support\Facades\Auth::guard();
echo "Guard par défaut: " . var_export(config('auth.default.guard'), true) . "\n";
echo "Guard user AVANT setUser: " . var_export($guard->user() ? $guard->user()->getAuthIdentifier() : null, true) . "\n";

$user = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
$guard->setUser($user);
echo "Guard user APRÈS setUser: " . var_export($guard->user() ? $guard->user()->getAuthIdentifier() : null, true) . "\n";

// MAIS la Request du kernel a son propre userResolver lié au guard ?
// Testons si Request::user() via rebinding passe par le guard :
$resp = null;
try {
    $m2 = $ref->getMethod('retrieveUser');
    $m2->setAccessible(true);
    $u = $m2->invoke($bc, $request, 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc');
    echo "retrieveUser → " . ($u ? get_class($u) . ' id=' . $u->getAuthIdentifier() : 'NULL') . "\n";
} catch (\Exception $e) { echo "ERR: " . $e->getMessage() . "\n"; }