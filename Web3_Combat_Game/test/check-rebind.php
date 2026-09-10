<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Le resolver fait : $app['auth']->userResolver()($guard)
// AuthManager::userResolver par défaut = guard()->user()
// Donc Request::user() → Auth::guard(null)->user() → le guard par défaut.
// Le guard par défaut est config('auth.defaults.guard').

// Dans notre test, config('auth.default.guard') était NULL ! Vérifions auth config :
echo "auth.defaults: " . json_encode(config('auth.defaults')) . "\n";
$g = Illuminate\Support\Facades\Auth::guard();
echo "guard()->user() après setUser: " . var_export($g->user() ? $g->user()->getAuthIdentifier() : null, true) . "\n";

// Request::user() avec rebinding — mais la Request créée à la main n'a jamais
// été rebindée dans $app (le rebinding n'arrive que quand la Request est
// SET dans le container : $app->instance('request', $request)).
$req = Illuminate\Http\Request::create('http://x/api/broadcasting/auth', 'POST', [], [], [], [], '{}');
$app->instance('request', $req);
$pr = new ReflectionObject($req);
if ($pr->hasProperty('userResolver')) {
    $pr->setAccessible(true);
    echo "userResolver après rebinding: " . var_export($pr->getValue($req) !== null, true) . "\n";
    $u = $req->user();
    echo "req->user() id: " . var_export($u ? $u->getAuthIdentifier() : null, true) . "\n";
}