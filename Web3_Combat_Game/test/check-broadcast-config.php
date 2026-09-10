<?php
// Debug complet : quels canaux privés le Broadcaster connaît ?
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Regarder la config broadcasting (channels autorisés)
echo "CONFIG broadcast channels: " . json_encode(config('broadcasting')) . "\n\n";

// Vérifier le modèle User : la méthode receivesBroadcastNotificationsOn ou channels()
$ref = new ReflectionClass('App\Models\User');
$methods = $ref->getMethods();
echo "User methods: " . implode(', ', array_map(fn($m) => $m->getName(), $methods)) . "\n";