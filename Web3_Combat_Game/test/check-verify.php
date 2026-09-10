<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$src = file_get_contents('/var/www/html/vendor/laravel/framework/src/Illuminate/Broadcasting/Broadcasters/PusherBroadcaster.php');
if (preg_match('/public function verifyUserCanAccessChannel[\s\S]*?\n    \}/', $src, $m)) {
    echo $m[0];
}