<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// config auth.defaults.guard = "web" → guard "web" existe-t-il ?
echo "guards: " . json_encode(array_keys(config('auth.guards'))) . "\n";
$g = Illuminate\Support\Facades\Auth::guard('web');
echo "guard web class: " . get_class($g) . "\n";
$user = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
$g->setUser($user);
echo "guard web user après setUser: " . var_export($g->user() ? $g->user()->getAuthIdentifier() : null, true) . "\n";
// SessionGuard::user() peut retourner null si la session n'a pas de user ET que
// setUser n'est pas persisté ? Non, setUser stocke $this->user...
// MAIS guard('web') vs guard() par défaut : Auth::guard() utilise defaults.guard="web" ✓

// Peut-être que le guard WEB a un provider Eloquent qui re-resout ?
// Vérifions Auth::user() (façade) :
Illuminate\Support\Facades\Auth::setUser($user);
echo "Auth::user() id: " . var_export(Illuminate\Support\Facades\Auth::user() ? Illuminate\Support\Facades\Auth::user()->getAuthIdentifier() : null, true) . "\n";