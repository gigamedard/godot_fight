<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Simuler l'appel HTTP COMPLET via le kernel (exactement comme un POST réel)
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$request = Illuminate\Http\Request::create(
    'http://localhost/api/broadcasting/auth',
    'POST',
    [], // query
    [], // request (form)
    [], // files
    [
        'HTTP_ACCEPT' => 'application/json',
        'HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        'CONTENT_TYPE' => 'application/json',
        'CONTENT_LENGTH' => '200',
    ],
    json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'])
);

try {
    $response = $kernel->handle($request);
    echo "HTTP " . $response->getStatusCode() . "\n";
    echo substr($response->getContent(), 0, 300) . "\n";
} catch (\Exception $e) {
    echo "EXCEPTION: " . get_class($e) . " — " . $e->getMessage() . "\n";
}