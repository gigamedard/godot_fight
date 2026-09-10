<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// retrieveUser OK + pattern matché (testé avant) mais line 129 = fin du foreach :
// aucun pattern matché dans CE broadcaster instance OU result === false.
// retrieveUser marche. Donc : $handler($user, $id) → false ?
// Le handler en mémoire (vérifié avant) : strtolower === strtolower → true
// avec user id '0x3C44...BC' et id '0x3c44...bc' → true ✓
// MAIS peut-être que extractAuthParameters passe le paramètre DIFFÉREMMENT ?

$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);
$m = $ref->getMethod('extractAuthParameters');
$m->setAccessible(true);
$params = $m->invoke($bc, 'private-player.{id}', 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', Closure::fromCallable(function(){}) === null ? null : app('Illuminate\Contracts\Broadcasting\Broadcaster'));
// Simplement : lancer verifyUserCanAccessChannel avec trace :
$m2 = $ref->getMethod('verifyUserCanAccessChannel');
$m2->setAccessible(true);

$req = Illuminate\Http\Request::create('http://x/api/broadcasting/auth', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$req->setUserResolver(function () {
    return new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
});

try {
    $r = $m2->invoke($bc, $req, 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc');
    echo "verify OK: " . json_encode($r) . "\n";
} catch (\Exception $e) {
    echo "verify FAIL @ " . $e->getLine() . "\n";
    // Reproduire le foreach manuellement pour voir le résultat du handler :
    $prop = $ref->getProperty('channels');
    $prop->setAccessible(true);
    $channels = $prop->getValue($bc);
    $handler = $channels['private-player.{id}'];
    $user = $req->user();
    echo "handler($user->id, '0x3c44...') = " . var_export($handler($user, '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'), true) . "\n";
    // avec l'id checksum :
    echo "handler avec checksum id = " . var_export($handler($user, '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'), true) . "\n";
}