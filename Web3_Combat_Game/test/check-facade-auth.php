<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Canaux en mémoire OK ('player.{id}' présent). Toujours 403 à line 129.
// ATTENTION : la route /broadcasting/auth utilise peut-être une résolution
// DIFFÉRENTE du broadcaster (via BroadcastManager::auth? via controller?).
// Testons via la FACADE complète comme la route le fait :
$mgr = Illuminate\Support\Facades\Broadcast::getFacadeRoot();
$req = Illuminate\Http\Request::create('http://x/api/broadcasting/auth', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$req->setUserResolver(function () { return new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']); });

// Broadcast::auth($request) → manager->auth($request) ? Le BroadcastManager
// a-t-il une méthode auth ? Ou __call → driver()->auth() ?
try {
    $r = Illuminate\Support\Facades\Broadcast::auth($req);
    echo "façade AUTH OK: " . json_encode($r) . "\n";
} catch (\Exception $e) {
    echo "façade auth FAIL @ " . $e->getFile() . ":" . $e->getLine() . "\n";
}

// MAIS la ROUTE appelle Broadcast::auth($request) APRÈS Auth::setUser($user).
// Mon $req->setUserResolver est un STAND-IN. Le vrai flux : Auth::setUser →
// guard web → Request::user() → resolver → guard('web')->user().
// Le guard web EST SessionGuard : SessionGuard::user() quand session non démarrée ?
// StartSession middleware n'a pas tourné dans mon test (je passe hors kernel).
// SessionGuard::user() : if (! is_null($this->user)) return $this->user; ✓
// MAIS le GUARD est-il instancié par un 'session.request' handler qui RESET
// le cache à chaque requête ? SessionGuard::$user est par-instance de guard,
// et Auth::setUser passe par AuthManager::guard('web') → LA MÊME instance.
// ... SAUF si Auth::setUser est appelé sur une instance du guard créée pour
// UNE session différente ? Non.
//
// DERNIÈRE CHOSE : dans le flux kernel réel, un middleware (StartSession) peut
// être appelé APRÈS la route ? Non. Vérifions si le handler de la route est
// même ATTEINT — sinon le 403 vient d'un middleware/middleware-group api :
// Test : appelons une autre route pour vérifier que le body/wallet est OK :
$resp = Illuminate\Support\Facades\Http::withHeaders([
    'X-Wallet-Address' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'Accept' => 'application/json',
])->post('http://127.0.0.1:8000/api/broadcasting/auth', [
    'socket_id' => '1234.5678',
    'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
]);
echo "HTTP réel via HTTP client: " . $resp->status() . "\n";
echo substr($resp->body(), 0, 150) . "\n";