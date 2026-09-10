<?php
require "/var/www/html/vendor/autoload.php";
$app = require "/var/www/html/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

event(new \App\Events\ChallengeSent(
    "0x0000000000000000000000000000000000000001",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    10, 1
));

$e = new \App\Events\ChallengeSent(
    "0x0000000000000000000000000000000000000001",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    10, 1
);
$chans = array_map(fn($c) => method_exists($c, "getName") ? $c->getName() : (string)$c, $e->broadcastOn());
echo "Canaux: " . json_encode($chans) . "\n";
echo "broadcastAs: " . (method_exists($e, "broadcastAs") ? $e->broadcastAs() : "nom classe: " . class_basename($e)) . "\n";
echo "Canaux pub: " . json_encode(array_map(fn($c) => $c->getName(), $e->broadcastOn())) . "\n";
