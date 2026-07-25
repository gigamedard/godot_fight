<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SessionKey;
use kornrunner\Keccak;
use Elliptic\EC;

class AuthController extends Controller
{
    public function registerSessionKey(Request $request)
    {
        $request->validate([
            'wallet_address' => 'required|string',
            'session_public_key' => 'required|string',
            'signature' => 'required|string',
        ]);

        $wallet = strtolower($request->wallet_address);
        $sessionKey = strtolower($request->session_public_key);
        $signature = $request->signature;

        // The message the user should have signed in frontend:
        $message = "Authorize session key: " . $sessionKey;
        
        $recoveredAddress = $this->recoverPersonalSignature($message, $signature);

        if ($recoveredAddress !== $wallet) {
            return response()->json(['status' => 'error', 'message' => 'Invalid signature.', 'recovered' => $recoveredAddress], 403);
        }

        // Store the session key
        SessionKey::updateOrCreate(
            ['wallet_address' => $wallet],
            [
                'session_public_key' => $sessionKey,
                'expires_at' => now()->addHours(12),
            ]
        );

        return response()->json(['status' => 'success', 'message' => 'Session key registered.']);
    }

    /**
     * Recover the Ethereum address from a personal_sign signature.
     */
    public function recoverPersonalSignature(string $message, string $signature): ?string
    {
        try {
            $prefix = "\x19Ethereum Signed Message:\n" . strlen($message);
            $hash = Keccak::hash($prefix . $message, 256);

            $signature = str_replace('0x', '', $signature);
            if (strlen($signature) !== 130) {
                return null;
            }

            $r = substr($signature, 0, 64);
            $s = substr($signature, 64, 64);
            $v = hexdec(substr($signature, 128, 2));

            if ($v >= 27) {
                $v -= 27;
            }

            $ec = new EC('secp256k1');
            $pubKey = $ec->recoverPubKey($hash, ['r' => $r, 's' => $s], $v);
            
            $pubKeyBytes = hex2bin(substr($pubKey->encode('hex', false), 2));
            $recoveredAddress = '0x' . substr(Keccak::hash($pubKeyBytes, 256), 24);

            return strtolower($recoveredAddress);
        } catch (\Exception $e) {
            return null;
        }
    }
}
