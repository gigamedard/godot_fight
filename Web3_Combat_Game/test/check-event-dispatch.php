<?php
// TEST : le backend peut-il broadcaster un event sur un canal privé ?
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    // Déclencher un event de test sur le canal privé de B
    event(new \App\Events\ChallengeSent(
        '0x0000000000000000000000000000000000000001',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        10, 1
    ));
    echo "Event ChallengeSent dispatché\n";
} catch (\Exception $e) {
    echo "ERREUR dispatch: " . $e->getMessage() . "\n";
}

// et vérifier les logs Reverb
echo "Attendu: broadcast ws://127.0.0.1:8081/apps/123456/events\n";