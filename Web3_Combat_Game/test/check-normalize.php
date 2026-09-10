<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Même instance, canaux OK, tout marche manuellement SAUF $bc->auth($req) !
// Reproduire auth() pas à pas — la seule différence avec mon foreach manuel :
// 1) normalizeChannelName($request->channel_name) — PusherBroadcaster override
//    normalizeChannelName pour retirer le préfixe 'private-' ?? Regardons :
$bc = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$ref = new ReflectionClass($bc);
$m = $ref->getMethod('normalizeChannelName');
$m->setAccessible(true);
$req = Illuminate\Http\Request::create('http://x/api/broadcasting/auth', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['socket_id' => '1234.5678', 'channel_name' => 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc']));
$req->setUserResolver(function () { return new Illuminate\Auth\GenericUser(['id' => '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'name' => 'B']); });

$normalized = $m->invoke($bc, $req->channel_name);
echo "channel_name brut: " . $req->channel_name . "\n";
echo "normalizeChannelName: " . $normalized . "\n";

// Et parent::verifyUserCanAccessChannel($request, $channelName) est appelé avec
// le NOM NORMALISÉ : 'player.0x3c44...' ?? Si oui, le pattern
// 'private-player.{id}' ne matche PLUS 'player.0x3c44...' → foreach → aucun match → line 129 !
// Vérifions channelNameMatchesPattern avec le nom normalisé :
$mMatch = $ref->getMethod('channelNameMatchesPattern'); $mMatch->setAccessible(true);
echo "match normalisé vs pattern privé: " . var_export($mMatch->invoke($bc, $normalized, 'private-player.{id}'), true) . "\n";