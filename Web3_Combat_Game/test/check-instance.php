<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// TOUT marche manuellement : match, extract, handler → true.
// MAIS $bc->auth($req) FAIL. Il y a donc un écart entre l'instance broadcaster
// résolue via 'Illuminate\Contracts\Broadcasting\Broadcaster' et celle réellement
// appelée par la FACADE Broadcast::auth / par la route.
// Laravel enregistre le broadcaster dans BroadcastServiceProvider via
// Broadcast::routes() et le manager. La façade Broadcast::auth → BroadcastManager
// → resolve($driver) → PUSHES a NEW broadcaster? Si le manager crée une NOUVELLE
// instance à chaque resolve, les canaux enregistrés via Broadcast::channel()
// s'inscrivent sur une instance, et la route utilise une AUTRE instance !
// Vérifions : Broadcast::auth vs app(Broadcaster) — même objet ?
$inst = app('Illuminate\Contracts\Broadcasting\Broadcaster');
$facade = Illuminate\Support\Facades\Broadcast::getFacadeRoot();
echo "app() : " . get_class($inst) . "\n";
echo "façade : " . get_class($facade) . "\n";
echo "même instance : " . var_export($inst === $facade, true) . "\n";

// Canaux de la FAÇADE :
$ref = new ReflectionClass($facade);
$prop = $ref->getProperty('channels');
$prop->setAccessible(true);
echo "Canaux façade: " . implode(' | ', array_keys($prop->getValue($facade))) . "\n";