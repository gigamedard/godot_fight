<?php
// Test : GenericUser avec authIdentifierForBroadcasting
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = new Illuminate\Auth\GenericUser([
    'id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'name' => 'Joueur B'
]);

// Le broadcaster vérifie : $user->getAuthIdentifierForBroadcasting() === canal
echo "IdentifierForBroadcasting: " . var_export($user->getAuthIdentifierForBroadcasting(), true) . "\n";
echo "Identifier: " . var_export($user->getAuthIdentifier(), true) . "\n";

// Le canal demandé
$channel = 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
echo "Channel: " . $channel . "\n";
echo "Attendu par le broadcaster: " . 'private-player.' . $user->getAuthIdentifierForBroadcasting() . "\n";
echo "MATCH: " . var_export($channel === ('private-player.' . $user->getAuthIdentifierForBroadcasting()), true) . "\n";