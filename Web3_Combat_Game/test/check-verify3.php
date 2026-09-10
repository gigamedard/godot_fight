<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);
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
    echo "verify FAIL @ line " . $e->getLine() . "\n";
    // Reproduire le foreach de verifyUserCanAccessChannel à la main :
    $prop = $ref->getProperty('channels');
    $prop->setAccessible(true);
    $channels = $prop->getValue($bc);

    foreach ($channels as $pattern => $callback) {
        $mm = $ref->getMethod('channelNameMatchesPattern');
        $mm->setAccessible(true);
        $match = $mm->invoke($bc, 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', $pattern);
        echo "PATTERN: $pattern → match: " . var_export($match, true) . "\n";
        if ($match) {
            $handler = $ref->getMethod('normalizeChannelHandlerToCallable');
            $handler->setAccessible(true);
            $call = $handler->invoke($bc, $callback);
            $user = $req->user();
            $params = ['0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'];
            try {
                $result = $call($user, ...$params);
                echo "  → handler result: " . var_export($result, true) . "\n";
            } catch (\Throwable $t) {
                echo "  → handler EXCEPTION: " . $t->getMessage() . "\n";
            }
        }
    }
}