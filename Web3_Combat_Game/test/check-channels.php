<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$broadcaster = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($broadcaster);
$prop = $ref->getProperty('channels');
$prop->setAccessible(true);
$registered = $prop->getValue($broadcaster);
echo "Canaux enregistrés: " . implode(' | ', array_keys($registered)) . "\n";

$handler = $registered['private-player.{id}'];
echo "Type handler: " . gettype($handler) . "\n";
if (is_string($handler)) echo "Handler (string): $handler\n";
if (is_array($handler)) echo "Handler (array): " . print_r($handler, true) . "\n";

// Normaliser comme normalizeChannelHandlerToCallable
$norm = $handler;
if (is_string($norm) && str_contains($norm, '@')) {
    [$class, $method] = explode('@', $norm);
    $norm = [app($class), $method];
}
$user = new Illuminate\Auth\GenericUser([
    'id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'name' => 'Joueur B'
]);
$result = $norm($user, '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc');
echo "Handler result: " . var_export($result, true) . "\n";