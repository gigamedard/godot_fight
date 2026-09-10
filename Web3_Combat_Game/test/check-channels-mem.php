<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$e = new \App\Events\ChallengeSent('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 10, 1);
foreach ($e->broadcastOn() as $c) {
    // PrivateChannel : propriété ->name publique
    echo "canal event: " . $c->name . "\n";
}