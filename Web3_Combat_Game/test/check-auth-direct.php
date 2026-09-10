<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// auth() : isGuardedChannel && ! retrieveUser → throw.
// retrieveUser → $request->user() → resolver → AuthManager::userResolver($guard=null)
// → $this->guard(null)->user() → SessionGuard::user()
// SessionGuard::user() : if (! is_null($this->user)) return $this->user;
//   MAIS SessionGuard::setUser stocke l'utilisateur... SAUF QUE Auth::setUser
//   passe par AuthManager::guard()->setUser — le même guard ? oui.
//
// MAIS le rebinding : Request::user() → resolver défini par AuthServiceProvider
// → call_user_func($app['auth']->userResolver(), $guard)
// AuthManager::userResolver PAR DÉFAUT :
//   fn ($guard = null) => $this->guard($guard)->user()
// → SessionGuard::user() → devrait renvoyer le user set...

// ICI le point clé : PusherBroadcaster::auth($request) utilise $request->channel_name
// — la PROPRIÉTÉ dynamique. Mon req2 avec json body : channel_name est-il lu ?
$req = Illuminate\Http\Request::create('http://x/api/broadcasting/auth', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$req->setUserResolver(function () {
    $u = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
    return $u;
});
echo "channel_name: " . var_export($req->channel_name, true) . "\n";

$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);
$m = $ref->getMethod('retrieveUser');
$m->setAccessible(true);
$u = $m->invoke($bc, $req, 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc');
echo "retrieveUser: " . ($u ? get_class($u) . ' ' . $u->getAuthIdentifier() : 'NULL') . "\n";

try {
    $r = $bc->auth($req);
    echo "AUTH OK: " . json_encode($r) . "\n";
} catch (\Exception $e) { echo "auth FAIL: " . $e->getMessage() . " @" . $e->getFile() . ":" . $e->getLine() . "\n"; }