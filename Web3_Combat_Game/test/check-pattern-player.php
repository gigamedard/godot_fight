<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// CONFIRMATION FINALE : verifyUserCanAccessChannel est appelé avec le nom
// NORMALISÉ ('player.0x...'), donc le pattern 'private-player.{id}' ne matche
// JAMAIS. Le framework attend que les canaux soient déclarés SANS le préfixe
// 'private-' ? NON — la convention Laravel : Broadcast::channel('player.{id}')
// pour un canal privé 'private-player.{id}' ?? Vérifions la doc du framework :
// Laravel docs : "private-{name}" → Broadcast::channel('{name}...') ?? Non.
// En réalité Laravel matche le canal PRIVÉ avec le pattern TEL QUEL dans
// verifyUserCanAccessChannel($request, $channelName) où $channelName est
// NORMALISÉ. Mais retrieveUser reçoit aussi le nom normalisé.
// Le canal doit donc être déclaré sous son nom normalisé : 'player.{id}'
// et 'lobby' (pour presence-lobby). MAIS le front actuel a ça qui marchait
// avant ? presence-lobby marche chez le front (logs .here() reçus)...
// DONC la route a peut-être un chemin différent ou l'app marchait avant.
//
// Testons la théorie : enregistrer un canal 'player.{id}' et tester :
$mgr = Illuminate\Support\Facades\Broadcast::getFacadeRoot();
$driver = $mgr->driver();
// on ne peut pas ajouter un canal runtime sur l'instance partagée sans risque,
// donc testons juste channelNameMatchesPattern :
$ref = new ReflectionClass($driver);
$m = $ref->getMethod('channelNameMatchesPattern'); $m->setAccessible(true);
echo "match('player.0x3c44...', 'player.{id}'): " . var_export($m->invoke($driver, 'player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 'player.{id}'), true) . "\n";