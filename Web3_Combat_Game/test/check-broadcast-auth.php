<?php
// Test direct de Broadcast::auth avec les données exactes du front
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Simuler la Request comme le fait le front
$request = Illuminate\Http\Request::create('/broadcasting/auth', 'POST', [
    'socket_id' => '1111.2222',
    'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
], [], [], [
    'HTTP_X_WALLET_ADDRESS' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'HTTP_ACCEPT' => 'application/json',
]);

// Créer l'utilisateur fantôme comme la route le fait
$user = new Illuminate\Auth\GenericUser([
    'id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'name' => 'Joueur B'
]);
Illuminate\Support\Facades\Auth::setUser($user);

try {
    $result = Illuminate\Support\Facades\Broadcast::auth($request);
    echo "AUTH OK: " . json_encode($result) . "\n";
} catch (\Exception $e) {
    echo "AUTH FAIL: " . get_class($e) . " — " . $e->getMessage() . "\n";
}

// Vérifier les canaux privés définis
echo "PRIVATE_CHANNEL_PREFIX test: " . 'private-player.0x3c44...' . "\n";