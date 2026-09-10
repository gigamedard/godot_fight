<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Le restart a peut-être un cache d'OPcache pour channels.php. Vérifions les
// canaux réellement en mémoire maintenant :
$mgr = Illuminate\Support\Facades\Broadcast::getFacadeRoot();
$driver = $mgr->driver();
$ref = new ReflectionClass($driver);
$prop = $ref->getProperty('channels');
$prop->setAccessible(true);
echo "Canaux en mémoire: " . implode(' | ', array_keys($prop->getValue($driver))) . "\n";