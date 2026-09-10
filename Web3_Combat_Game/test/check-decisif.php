<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// La façade marche, le HTTP réel échoue → le routeur réel résout le broadcaster
// par UNE AUTRE VOIE. Piste : la requête réelle n'a pas le JSON parsé ? Le
// serveur 'artisan serve' + CONTENT_LENGTH ok... Vérifions ce que la route
// reçoit réellement : la route lit $request->header('X-Wallet-Address') ✓ et
// Broadcast::auth($request) → $request->channel_name — propriété dynamique qui
// lit $request->input('channel_name')? NON : $request->channel_name est un
// ACCÈS DYNAMIQUE aux attributs de la request (input).
// Si le JSON n'est pas parsé (Content-Type 'application/json' non propagé par
// le client HTTP interne), channel_name serait null → 'empty' → throw line 78 !
// MAIS la stack indique line 129. Donc channel_name non-null.
//
// Line 129 = AccessDeniedHttpException du foreach. MAIS avec les canaux
// 'player.{id}' déclarés, un nom NORMALISÉ matche. La seule façon de tomber à
// 129 avec ces canaux : retrieveUser($request, $NORMALIZED) → $request->user()
// → NULL dans le flux kernel.
// Pourquoi ? Le rebinding userResolver : il est mis par AuthServiceProvider
// quand la request est rebindée. Kernel::handle le fait ✓.
// SessionGuard::user() dans le flux : le guard web utilise la SESSION. La
// session démarre via StartSession (middleware groupe web). Le groupe API
// n'a PAS StartSession → SessionGuard::user() tente session->get sur une
// store NULL ? SessionGuard gère session null en retournant null ???
// MAIS Auth::setUser() met le cache $this->user — user() doit le renvoyer !
// ... SAUF SI SessionGuard::user() fait :
//   if (! is_null($this->user)) return $this->user;
// Hmm mais peut-être que le guard 'web' est re-créé pour chaque requête avec
// un provider qui appelle retrieveById — et setUser a mis $this->user mais
// une NOUVELLE instance est résolue après StartSession ???
//
// TEST DÉCISIF : instrumenter via un fichier de test kernel complet avec
// setUser puis Broadcast::auth sur la même request kernel (déjà fait — FAIL).
// Donc : Auth::setUser($u) puis $req->user() dans le même contexte kernel →
// Testons exactement ça :
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$req = Illuminate\Http\Request::create('http://localhost/api/broadcasting/auth', 'POST', [], [], [], [
    'HTTP_ACCEPT' => 'application/json',
    'HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'CONTENT_TYPE' => 'application/json',
], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$app->instance('request', $req);

$routeUser = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
Illuminate\Support\Facades\Auth::setUser($routeUser);

echo "req->user() (post-setUser) : " . var_export($req->user() ? $req->user()->getAuthIdentifier() : 'NULL', true) . "\n";
try {
    $r = Illuminate\Support\Facades\Broadcast::auth($req);
    echo "AUTH OK: " . json_encode($r) . "\n";
} catch (\Exception $e) {
    echo "auth FAIL @ line " . $e->getLine() . "\n";
    // extractAuthParameters avec le handler du canal 'player.{id}' :
    $mgr = Illuminate\Support\Facades\Broadcast::getFacadeRoot();
    $driver = $mgr->driver();
    $ref = new ReflectionClass($driver);
    $mE = $ref->getMethod('extractAuthParameters'); $mE->setAccessible(true);
    $mM = $ref->getMethod('channelNameMatchesPattern'); $mM->setAccessible(true);
    $prop = $ref->getProperty('channels'); $prop->setAccessible(true);
    $chs = $prop->getValue($driver);
    $normalized = 'player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
    foreach ($chs as $pattern => $cb) {
        $match = $mM->invoke($driver, $normalized, $pattern);
        echo "pattern $pattern → match normalisé: " . var_export($match, true) . "\n";
    }
}