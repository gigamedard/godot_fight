<?php
// Reproduire EXACTEMENT l'appel HTTP via le kernel HTTP (pas la logique manuelle)
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$request = Illuminate\Http\Request::create('/api/broadcasting/auth', 'POST', [
    'socket_id' => '1234.5678',
    'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
], [], [], [
    'HTTP_ACCEPT' => 'application/json',
    'HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'CONTENT_TYPE' => 'application/json',
]);
$request->setJson(new Illuminate\Http\JsonParamBag? []);
echo "N/A";