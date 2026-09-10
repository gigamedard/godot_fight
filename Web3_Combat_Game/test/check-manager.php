<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// BroadcastManager (façade) résout le broadcaster. Broadcast::channel()
// s'inscrit via BroadcastManager::channel($channel, $handler) ? Non —
// Broadcast::channel → __callStatic → manager->channel() → driver()->channel().
// Vérifions les canaux du broadcaster résolu PAR LE MANAGER :
$mgr = Illuminate\Support\Facades\Broadcast::getFacadeRoot();
$refMgr = new ReflectionClass($mgr);
$propApps = null;
foreach (['apps', 'channels', 'resolved'] as $p) {
    if ($refMgr->hasProperty($p)) echo "Manager a la prop: $p\n";
}

$b = $mgr->driver(); // broadcaster reverb résolu
echo "Manager->driver(): " . get_class($b) . "\n";
$refB = new ReflectionClass($b);
$prop = $refB->getProperty('channels');
$prop->setAccessible(true);
echo "Canaux du broadcaster MANAGER: " . implode(' | ', array_keys($prop->getValue($b))) . "\n";

$inst = app('Illuminate\Contracts\Broadcasting\Broadcaster');
echo "app() === manager->driver() : " . var_export($inst === $b, true) . "\n";