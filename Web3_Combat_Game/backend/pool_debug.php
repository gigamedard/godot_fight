#!/usr/bin/env php
<?php

require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Http\Kernel');
$db = $app->make('db');

$pool = $db->table('pools')->where('id', 3)->first();
if (!$pool) { echo "Pool 3 not found\n"; exit(1); }

echo "=== POOL #3 ===\n";
echo "Status: " . $pool->status . "\n";
echo "Pending matches: " . $pool->round_pending_matches . "\n";
echo "Max players: " . $pool->max_players . "\n";

$players = $db->table('pool_players')->where('pool_id', 3)->get();
echo "\n=== PLAYERS (" . count($players) . ") ===\n";
foreach ($players as $p) {
    echo $p->wallet_address . " => " . $p->status . "\n";
}
