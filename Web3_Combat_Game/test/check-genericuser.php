<?php
// Vérifier si GenericUser implémente la classe attendue par le broadcaster
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$r = new ReflectionClass('Illuminate\Auth\GenericUser');
echo "Interfaces: " . implode(', ', $r->getInterfaceNames()) . "\n";

// Comment ReverbBroadcaster vérifie l'autorisation :
$rb = new ReflectionClass('Illuminate\Broadcasting\Broadcasters\UsePusherChannelAuthentications');
$methods = array_map(fn($m) => $m->getName(), $r->getMethods());
echo "GenericUser methods (subset): " . implode(', ', array_filter($methods, fn($m) => str_contains($m, 'Auth') || str_contains($m, 'Broadcast'))) . "\n";

// Regarder la méthode exacte appelée par verifyUserCanAccessChannel
$src = file_get_contents('/var/www/html/vendor/laravel/framework/src/Illuminate/Broadcasting/Broadcasters/UsePusherChannelAuthentications.php');
if (preg_match('/function authenticateUser[\s\S]{0,800}/', $src, $m)) echo $m[0];
elseif (preg_match('/function verifyClient[\s\S]{0,600}/', $src, $m)) echo $m[0];
else echo substr($src, 0, 1200);