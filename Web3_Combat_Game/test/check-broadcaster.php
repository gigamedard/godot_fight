<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Trouver le broadcaster Reverb et sa méthode d'auth user
$driver = config('broadcasting.default');
echo "Driver: $driver\n";
$broadcaster = app('Illuminate\Contracts\Broadcasting\Broadcaster');
echo "Broadcaster class: " . get_class($broadcaster) . "\n";

$ref = new ReflectionClass($broadcaster);
foreach ($ref->getMethods() as $m) {
    if (str_contains($m->getName(), 'verify') || str_contains($m->getName(), 'authentic')) {
        echo "MÉTHODE: {$m->getName()}\n";
        $src = file_get_contents($ref->getFileName());
        // extraire la méthode
        if (preg_match("/function {$m->getName()}\s*\([\s\S]*?\n    \}/", $src, $mm)) {
            echo $mm[0] . "\n";
        }
    }
}