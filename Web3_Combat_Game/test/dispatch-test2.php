<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Test 1 : ChallengeSent (ShouldBroadcastNow) — doit push immédiatement
event(new \App\Events\ChallengeSent(
    '0x0000000000000000000000000000000000000001',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    10, 1
));
echo "ChallengeSent dispatché\n";

// Trace : le broadcaster reçoit-il l'event ? Activer le log broadcaster :
Illuminate\Support\Facades\Log::info('[TEST-DISPATCH] event ChallengeSent envoyé via event()');