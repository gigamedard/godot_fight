<?php
// Après restart : le handler mémoire retourne-t-il toujours false ?
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);
$prop = $ref->getProperty('channels');
$prop->setAccessible(true);
$channels = $prop->getValue($bc);

// L'instance broadcaster du CONTAINER est-elle un singleton créé AVANT le fix ?
echo "Canaux: " . implode(' | ', array_keys($channels)) . "\n";
$handler = $channels['private-player.{id}'];
$rf = new ReflectionFunction($handler);
echo "Handler fichier: " . $rf->getFileName() . ":" . $rf->getStartLine() . "\n";
$src = implode('', array_slice(file($rf->getFileName()), $rf->getStartLine() - 1, $rf->getEndLine() - $rf->getStartLine() + 1));
echo $src;
$user = new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']);
echo "Test: " . var_export($handler($user, '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'), true) . "\n";