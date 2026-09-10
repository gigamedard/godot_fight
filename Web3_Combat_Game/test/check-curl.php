<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// userResolver marche pour les deux guards. verifyUserCanAccessChannel marche.
// Il ne reste qu'une possibilité : dans le flux HTTP RÉEL, PusherBroadcaster::auth()
// est appelé avec une request dont retrieveUser renvoie NULL — parce que
// Auth::setUser($user) de la ROUTE a été fait sur une request DIFFÉRENTE ?
// NON : Auth::setUser → guard web → $this->user = $user (cache).
// Request::user() → resolver → AuthManager::userResolver → guard('web')->user()
// → retourne le cache. OK.
//
// DERNIÈRE PISTE : le flux HTTP passe par des MIDDLEWARES qui re-SET la request
// instance (ex: StartSession) → le rebinding re-assigne le resolver AVANT que
// la route ne fasse Auth::setUser — peu importe, le resolver appelle le guard.
//
// Testons l'ordre réel : instrumentons la route ? On ne peut pas sans modifier.
// ALTERNATIVE : relancer réellement un POST curl au serveur Laravel (le serveur
// php artisan serve tourne) et voir si le 403 persiste MAINTENANT (après
// route:clear + fix channels.php) :

$ch = curl_init('http://127.0.0.1:8000/api/broadcasting/auth');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'X-Wallet-Address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'],
    CURLOPT_POSTFIELDS => json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo "HTTP $code\n";
echo substr($resp, 0, 200) . "\n";