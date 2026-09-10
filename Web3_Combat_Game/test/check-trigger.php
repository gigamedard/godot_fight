<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$broadcaster = Illuminate\Support\Facades\Broadcast::getFacadeRoot()->driver();
$ref = new ReflectionClass($broadcaster);
$prop = $ref->getProperty('pusher');
$prop->setAccessible(true);
$pusher = $prop->getValue($broadcaster);

try {
    $result = $pusher->trigger(
        ['private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'],
        'TestEvent',
        ['foo' => 'bar'],
        [],      // params (array, pas null)
        true     // debug
    );
    echo "trigger OK: " . json_encode($result) . "\n";
} catch (\Throwable $e) {
    echo "trigger ERR: " . get_class($e) . " — " . $e->getMessage() . "\n";
}