<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$request1 = Illuminate\Http\Request::create('/api/battle/commit', 'POST', ['match_id' => 1, 'wallet_address' => '0xAAA', 'commit_hash' => '0xHash123']);
$request1->headers->set('Accept', 'application/json');
$response1 = $kernel->handle($request1);
echo "Player 1 Commit: " . $response1->getContent() . "\n";

$request2 = Illuminate\Http\Request::create('/api/battle/commit', 'POST', ['match_id' => 1, 'wallet_address' => '0xBBB', 'commit_hash' => '0xHash456']);
$request2->headers->set('Accept', 'application/json');
$response2 = $kernel->handle($request2);
echo "Player 2 Commit: " . $response2->getContent() . "\n";

$request3 = Illuminate\Http\Request::create('/api/battle/reveal', 'POST', ['match_id' => 1, 'wallet_address' => '0xAAA', 'move' => 1, 'secret' => 'sec']);
$request3->headers->set('Accept', 'application/json');
$response3 = $kernel->handle($request3);
echo "Player 1 Reveal: " . $response3->getContent() . "\n";

$request4 = Illuminate\Http\Request::create('/api/battle/reveal', 'POST', ['match_id' => 1, 'wallet_address' => '0xBBB', 'move' => 2, 'secret' => 'sec']);
$request4->headers->set('Accept', 'application/json');
$response4 = $kernel->handle($request4);
echo "Player 2 Reveal: " . $response4->getContent() . "\n";
