<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// retrieveUser OK, isGuardedChannel true, MAIS verifyUserCanAccessChannel tombe
// à la ligne 129 = fin du foreach SANS return. Donc soit match==false pour le
// pattern SOIT result===false. On sait que retrieveUser OK. Testons
// extractAuthParameters + normalizeChannelHandlerToCallable + handler(user, param)
// EXACTEMENT comme verifyUserCanAccessChannel :

$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);

$req = Illuminate\Http\Request::create('http://x/api/broadcasting/auth', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$req->setUserResolver(function () {
    return new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
});

$prop = $ref->getProperty('channels');
$prop->setAccessible(true);
$channels = $prop->getValue($bc);

$mMatch = $ref->getMethod('channelNameMatchesPattern'); $mMatch->setAccessible(true);
$mExtract = $ref->getMethod('extractAuthParameters'); $mExtract->setAccessible(true);
$mNormalize = $ref->getMethod('normalizeChannelHandlerToCallable'); $mNormalize->setAccessible(true);

$channel = 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
foreach ($channels as $pattern => $callback) {
    $match = $mMatch->invoke($bc, $channel, $pattern);
    if (! $match) continue;
    echo "Pattern: $pattern\n";
    $params = $mExtract->invoke($bc, $pattern, $channel, $callback);
    echo "extractAuthParameters: " . json_encode($params) . "\n";
    $handler = $mNormalize->invoke($bc, $callback);
    $user = $req->user();
    try {
        $result = $handler($user, ...$params);
        echo "handler result: " . var_export($result, true) . "\n";
    } catch (\Throwable $t) {
        echo "handler EXC: " . $t->getMessage() . " @" . $t->getFile() . ":" . $t->getLine() . "\n";
    }
}