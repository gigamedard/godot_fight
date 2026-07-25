<?php
require 'vendor/autoload.php';
use kornrunner\Keccak;
use Elliptic\EC;

$message = 'Authorize session key: 0x933fb9787ed901b0f5cd3d59cb6ecbeffea04c7d';
$signature = '0x889dc685320c242c382f7c001cf8e14cb78e2c0ad75bfa07e1dc58f79cd1bb4251e60f5e3df5300d54020a10df768b44473ef2e5b7fb582370c6604618e7e1081b';

$prefix = "\x19Ethereum Signed Message:\n" . strlen($message);
$hash = Keccak::hash($prefix . $message, 256); // By default Keccak::hash returns hex
// EC expects the hash as hex, so this is fine.

$signature = str_replace('0x', '', $signature);
$r = substr($signature, 0, 64);
$s = substr($signature, 64, 64);
$v = hexdec(substr($signature, 128, 2));

if ($v >= 27) $v -= 27;

$ec = new EC('secp256k1');
$pubKey = $ec->recoverPubKey($hash, ['r' => $r, 's' => $s], $v);

// Correct way to get Ethereum address
$pubKeyBytes = hex2bin(substr($pubKey->encode('hex', false), 2));
$recoveredAddress = '0x' . substr(Keccak::hash($pubKeyBytes, 256), 24);

echo 'Recovered: ' . $recoveredAddress . "\n";
