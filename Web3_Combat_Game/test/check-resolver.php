<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// retrieveUser → $request->user() → getUserResolver.
// L'AppServiceProvider attache le resolver via rebinding : il appelle
// $request->user($guard ?? null) → Auth::guard($guard)->user()
// MAIS retrieveUser lit $this->retrieveChannelOptions($channel)['guards'] ?? null.
// Si guards null → $request->user() SANS guard → resolver par défaut → guard null → NULL ?

// Vérifions le resolver de la Request :
$request = Illuminate\Http\Request::create('http://x/api/broadcasting/auth', 'POST', [], [], [], [], '{}');
$ro = new ReflectionObject($request);
if ($ro->hasProperty('userResolver')) {
    $pr = $ro->getProperty('userResolver');
    $pr->setAccessible(true);
    $resolver = $pr->getValue($request);
    echo "userResolver présent: " . var_export($resolver !== null, true) . "\n";
    if ($resolver) {
        $rf = new ReflectionFunction($resolver);
        echo "Resolver défini dans: " . $rf->getFileName() . ":" . $rf->getStartLine() . "\n";
        $src = implode('', array_slice(file($rf->getFileName()), $rf->getStartLine() - 1, $rf->getEndLine() - $rf->getStartLine() + 1));
        echo $src . "\n";
    }
} else {
    echo "PAS de propriété userResolver (Laravel 11 : via->user($guard))\n";
}

// Le canal a-t-il des options 'guards' ?
$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);
$m = $ref->getMethod('retrieveChannelOptions');
$m->setAccessible(true);
echo "Options du canal: " . json_encode($m->invoke($bc, 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc')) . "\n";