<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$mgr = Illuminate\Support\Facades\Broadcast::getFacadeRoot();
$d = $mgr->driver();
$r = new ReflectionClass($d);
$p = $r->getProperty('pusher');
$p->setAccessible(true);
$pusher = $p->getValue($d);
$settings = $pusher->getSettings();
echo "host=" . $settings['host'] . " port=" . $settings['port'] . " scheme=" . $settings['scheme'] . "\n";

// Push de debug avec le canal lowercase que le listener écoute :
$result = $pusher->trigger(
    ['private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'],
    'DebugPing',
    json_encode(['at' => date('H:i:s')]),
    [],
    true
);
echo "trigger: " . json_encode($result) . "\n";