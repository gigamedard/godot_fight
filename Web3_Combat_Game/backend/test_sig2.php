<?php
require 'vendor/autoload.php';
use kornrunner\Keccak;
use Elliptic\EC;

$message = 'Authorize session key: 0x933fb9787ed901b0f5cd3d59cb6ecbeffea04c7d';
$signature = '0x653bf69b2089adee5d469bb7c3cc9581eb63feeed799c2aacb6b795e0b3c141b2c0b21d9bfc9decdcabf90a6daca68eb5d7f36cbceffa5d54673922b3d1bba861c';

$prefix = "\x19Ethereum Signed Message:\n" . strlen($message);
$hash = Keccak::hash($prefix . $message, 256);

$signature = str_replace('0x', '', $signature);
$r = substr($signature, 0, 64);
$s = substr($signature, 64, 64);
$v = hexdec(substr($signature, 128, 2));

if ($v >= 27) $v -= 27;

$ec = new EC('secp256k1');
$pubKey = $ec->recoverPubKey($hash, ['r' => $r, 's' => $s], $v);

// Incorrect way (currently in AuthController.php)
$recoveredIncorrect = '0x' . substr(Keccak::hash($pubKey->encode('hex', false), 256), 24);

// Correct way
$pubKeyBytes = hex2bin(substr($pubKey->encode('hex', false), 2));
$recoveredCorrect = '0x' . substr(Keccak::hash($pubKeyBytes, 256), 24);

echo 'Incorrect: ' . $recoveredIncorrect . "\n";
echo 'Correct: ' . $recoveredCorrect . "\n";
