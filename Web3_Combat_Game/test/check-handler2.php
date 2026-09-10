<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$broadcaster = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($broadcaster);
$prop = $ref->getProperty('channels');
$prop->setAccessible(true);
$handler = $prop->getValue($broadcaster)['private-player.{id}'];

$refH = new ReflectionFunction($handler);
$src = implode('', array_slice(file($refH->getFileName()), $refH->getStartLine() - 1, $refH->getEndLine() - $refH->getStartLine() + 1));
echo "=== Handler chargé en mémoire ===\n" . $src . "\n";

$user = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
echo "Test lowercase: " . var_export($handler($user, '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'), true) . "\n";