<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// verifyUserCanAccessChannel OK ! Donc le 403 vient d'AVANT :
// PusherBroadcaster::auth : isGuardedChannel && ! retrieveUser → throw SANS message
// retrieveUser → $request->user() — dans le FLUX KERNEL, la request a un
// resolver différent (rebindé au boot) qui appelle Auth::guard()->user()
// et comme la ROUTE fait Auth::setUser AVANT Broadcast::auth($request),
// ça devrait marcher... SAUF si la request réelle du flux kernel a un
// userResolver qui passe un GUARD non-null par défaut (ex: 'sanctum') !

// Testons retrieveUser sur la request kernel réelle avec les headers du front :
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$req = Illuminate\Http\Request::create('http://localhost/api/broadcasting/auth', 'POST', [], [], [], [
    'HTTP_ACCEPT' => 'application/json',
    'HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'CONTENT_TYPE' => 'application/json',
], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));

// Middleware 'api' : EnsureFrontendRequestsAreFromStatefulDomains etc.
// Le resolver de CETTE request après handle ?
$response = $kernel->handle($req);
echo "HTTP " . $response->getStatusCode() . "\n";

// Hypothèse forte : le middleware 'api' groupe inclut ThrottleRequests et
// SubstituteBindings, pas d'auth. La route fait Auth::setUser($user).
// Broadcast::auth($request) → PusherBroadcaster::auth($request) →
// retrieveUser($request) → $request->user() → resolver.
// LE RESOLVER DE CETTE REQUEST a-t-il été rebindé ? Oui si le container a
// reçu cette request instance. Kernel::handle fait $app->instance('request', $request)
// → rebinding → resolver = guard()->user() → devrait renvoyer le user set...

// MAIS SessionGuard::user() sur NOUVELLE request : SessionGuard::user() :
//   $user = $this->session->get($this->getName()); ← lit LA SESSION
//   puis session->get retourne null → user null — ATTENDS : le guard garde
//   $this->user en cache. setUser l'a mis. MAIS si SessionGuard::user() est
//   appelé SUR UN AUTRE GUARD INSTANCE (guard('sanctum') par ex via resolver) ?
// Test : resolver effectif de la request kernel :
$resp = null;
$req2 = Illuminate\Http\Request::create('http://localhost/api/broadcasting/auth', 'POST', [], [], [], [], json_encode(['socket_id' => '9.9', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$app->instance('request', $req2);
$ur = $app['auth']->userResolver();
$u = $ur(null);
echo "userResolver(null) → " . ($u ? get_class($u) . ' ' . $u->getAuthIdentifier() : 'NULL') . "\n";
$u2 = $ur('sanctum');
echo "userResolver('sanctum') → " . ($u2 ? get_class($u2) . ' ' . $u2->getAuthIdentifier() : 'NULL') . "\n";