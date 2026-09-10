<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Broadcast::event direct pour voir l'erreur réelle du push vers Reverb :
try {
    $result = Illuminate\Support\Facades\Broadcast::event(
        'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
        'TestEvent',
        ['foo' => 'bar'],
        null // socket id
    );
    echo "Broadcast::event OK\n";
} catch (\Throwable $e) {
    echo "ERREUR: " . get_class($e) . " — " . $e->getMessage() . "\n";
    echo "Fichier: " . $e->getFile() . ":" . $e->getLine() . "\n";
}

// Sinon via le Pusher SDK directement (comme le fait le broadcaster) :
try {
    $broadcaster = Illuminate\Support\Facades\Broadcast::getFacadeRoot()->driver();
    $ref = new ReflectionClass($broadcaster);
    $prop = $ref->getProperty('pusher');
    $prop->setAccessible(true);
    $pusher = $prop->getValue($broadcaster);
    echo "Pusher client: " . get_class($pusher) . "\n";
    // settings
    $settings = $pusher->getSettings();
    echo "Settings (host/port/scheme): " . json_encode($settings = [
        'host' => $settings['host'] ?? ($pusher->settings ?? []),
    ]) . "\n";
    $settings = $pusher->getSettings();
    echo "FULL: " . json_encode($settings) . "\n";
} catch (\Throwable $e) {
    echo "REFLEX ERR: " . $e->getMessage() . "\n";
}