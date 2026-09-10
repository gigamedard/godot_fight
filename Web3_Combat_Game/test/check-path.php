<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo "path: " . base_path('../blockchain/scripts/withdraw_push.js') . "\n";
echo "is_file: " . var_export(is_file(base_path('../blockchain/scripts/withdraw_push.js')), true) . "\n";
echo "settle path: " . base_path('../blockchain/scripts/settle_fight.js') . "\n";
echo "settle is_file: " . var_export(is_file(base_path('../blockchain/scripts/settle_fight.js')), true) . "\n";