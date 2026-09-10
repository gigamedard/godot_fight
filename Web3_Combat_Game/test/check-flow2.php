<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// SessionGuard::user() sur un NOUVEAU guard instance retourne null (recréé).
// La clé : la REQUEST réelle du kernel a un userResolver REBINDÉ → guard()->user()
// Si la ROUTE fait Auth::setUser($user) puis Broadcast::auth($request), le
// retrieveUser fait $request->user() → resolver → $app['auth']->userResolver()
// → AuthManager::userResolver() = fn($guard=null) => $this->guard($guard)->user()
// → guard('web')->user() → LE USER SET ✓ ... sauf si SessionGuard::user() re-resout
// via la SESSION quand user() est rappelé ? SessionGuard::user() :
//   if (! is_null($this->user)) return $this->user;  ← devrait renvoyer le GenericUser

// Testons le flux kernel complet AVEC la route telle quelle, mais en vérifiant
// si le 403 vient du PRESENCE channel ou de retrieveUser NULL :
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Illuminate\Http\Request::create('http://localhost/api/broadcasting/auth', 'POST', [], [], [], [
    'HTTP_ACCEPT' => 'application/json',
    'HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'CONTENT_TYPE' => 'application/json',
], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));

// Réponse + debug : instrumentons Auth après handle
$response = $kernel->handle($request);
echo "HTTP " . $response->getStatusCode() . "\n";

// Le problème vient peut-être de startSession/EncryptCookies middleware qui
// recrée la request ? Ou : la route app.php utilise middleware 'api' avec
// throttling… et Auth::setUser fonctionne. Le broadcaster reçoit $request DU
// PARAMÈTRE de la closure (la route passe $request à Broadcast::auth($request)).
// retrieveUser($request) → $request->user() → resolver → guard('web')->user()
// Le guard web est un SINGLETON par REQUEST : le kernel a booté un guard
// différent de celui du test ? Non, singleton.

// Test direct : reproduire la ROUTE à l'identique puis Broadcast::auth :
$routeUser = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
Illuminate\Support\Facades\Auth::setUser($routeUser);

$req2 = Illuminate\Http\Request::create('http://localhost/api/broadcasting/auth', 'POST', [], [], [], [], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$app->instance('request', $req2); // déclenche le rebinding userResolver
echo "req2->user() id: " . var_export($req2->user() ? $req2->user()->getAuthIdentifier() : null, true) . "\n";
try {
    $r = Illuminate\Support\Facades\Broadcast::auth($req2);
    echo "Broadcast::auth OK: " . json_encode($r) . "\n";
} catch (\Exception $e) { echo "Broadcast::auth FAIL: " . $e->getMessage() . "\n"; }