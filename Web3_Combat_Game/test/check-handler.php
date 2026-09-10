<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$broadcaster = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($broadcaster);
$prop = $ref->getProperty('channels');
$prop->setAccessible(true);
$handler = $prop->getValue($broadcaster)['private-player.{id}'];

echo "Handler class: " . get_class($handler) . "\n";
$refH = new ReflectionFunction(is_object($handler) && !($handler instanceof Closure) ? [$handler, '__invoke'] : $handler);
echo "Fichier: " . $refH->getFileName() . ":" . $refH->getStartLine() . "\n";
$src = implode('', array_slice(file($refH->getFileName()), $refH->getStartLine() - 1, $refH->getEndLine() - $refH->getStartLine() + 1));
echo $src . "\n";

// Le test direct qui échoue : string vs string
$userId = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
$channelId = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
echo "(string)\$userId === (string)\$id : " . var_export((string)$userId === (string)$channelId, true) . "\n";