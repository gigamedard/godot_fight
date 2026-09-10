<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Handler OK en mémoire. Le 403 vient donc d'AVANT verifyUserCanAccessChannel :
// PusherBroadcaster::auth : isGuardedChannel && ! retrieveUser → throw line ~79
// retrieveUser → $request->user() → resolver — dans le flux kernel réel,
// le middleware StartSession recrée-t-il la request ? NON.
// MAIS Kernel::handle : la request du flux réel passe par transmuters/middleware.
// Point crucial : $request->user() avec le resolver REBINDÉ au kernel →
// resolver($guard=null) → AuthManager::userResolver → $this->guard(null)->user()
// → guard('web') → SessionGuard::user().
// SessionGuard::user() : if (! is_null($this->user)) return $this->user;
//   ↓ sinon → $this->retriever... session etc.
// La ROUTE fait Auth::setUser($user) → guard web cache user ✓
// retrieveUser($request, $channel) → $request->user() → ... guard('web')->user()
// → GenericUser ✓ (prouvé standalone).
//
// Il reste UNE seule explication : la request du flux kernel a un userResolver
// qui PASSE PAR un AUTRE chemin — le middleware 'api' du framework :
// RouteServiceProvider::boot appelle $this->app['router']->middlewareGroup('api', ...)
// et Laravel 11 : auth: middleware alias.
//
// Vérifions le VRAI fichier routes/api.php en mémoire au moment du call :
// La route utilise Broadcast::auth($request) où $request = LA REQUEST KERNEL.
// Simulons : kernel handle + instrumenter via un observateur ? Trop complexe.
//
// TEST DÉCISIF : reproduire avec la request kernel réelle + setUser, puis
// appeler le closure de route MANUELLEMENT :
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$req = Illuminate\Http\Request::create('http://localhost/api/broadcasting/auth', 'POST', [], [], [], [
    'HTTP_ACCEPT' => 'application/json',
    'HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'CONTENT_TYPE' => 'application/json',
], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$app->instance('request', $req); // rebinding resolver (comme le fait le kernel)

$routeUser = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
Illuminate\Support\Facades\Auth::setUser($routeUser);

$bc2 = app('Illuminate\Contracts\Broadcasting\Broadcaster');
try {
    $r = $bc2->auth($req);
    echo "AUTH OK: " . json_encode($r) . "\n";
} catch (\Exception $e) {
    echo "auth FAIL @ " . $e->getFile() . ":" . $e->getLine() . " — msg: '" . $e->getMessage() . "'\n";
    $ref = new ReflectionClass($bc2);
    $m = $ref->getMethod('retrieveUser');
    $m->setAccessible(true);
    $u = $m->invoke($bc2, $req, 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc');
    echo "retrieveUser dans ce contexte: " . ($u ? get_class($u) . ' ' . $u->getAuthIdentifier() : 'NULL') . "\n";
    $m2 = $ref->getMethod('isGuardedChannel');
    $m2->setAccessible(true);
    echo "isGuardedChannel: " . var_export($m2->invoke($bc2, 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'), true) . "\n";
}