<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use kornrunner\Keccak;
use Elliptic\EC;

class WithdrawController extends Controller
{
    /**
     * Émet un bon de retrait (voucher) signé par le backend pour CombatGame.withdraw().
     *
     * Le contrat attend : keccak256(abi.encodePacked(msg.sender, amount, nonce, address(this)))
     * puis le préfixe EIP-191 "\x19Ethereum Signed Message:\n32".
     */
    public function voucher(Request $request): JsonResponse
    {
        $request->validate([
            'wallet_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'amount_wei' => ['required', 'string', 'regex:/^[0-9]+$/'],
        ]);

        $signerKey = (string) config('services.web3.backend_signer_key');
        if ($signerKey === '') {
            return response()->json(['error' => 'Backend signer non configuré (WEB3_BACKEND_SIGNER_KEY).'], 500);
        }
        if (str_starts_with($signerKey, '0x')) {
            $signerKey = substr($signerKey, 2);
        }

        $wallet = strtolower($request->wallet_address);
        $amountWei = $request->amount_wei;
        $contract = strtolower((string) config('services.web3.contract_address'));

        if (gmp_cmp($amountWei, '0') <= 0) {
            return response()->json(['error' => 'Aucun fonds à réclamer.'], 422);
        }

        // nonce uint256 aléatoire (jamais réutilisé grâce à usedNonces du contrat)
        $nonceHex = bin2hex(random_bytes(32));
        $nonceDec = gmp_strval(gmp_init($nonceHex, 16), 10);

        $packed = hex2bin(substr($wallet, 2))
            . hex2bin(str_pad(gmp_strval(gmp_init($amountWei, 10), 16), 64, '0', STR_PAD_LEFT))
            . hex2bin($nonceHex)
            . hex2bin(substr($contract, 2));
        $messageHash = Keccak::hash($packed, 256);
        $ethSigned = Keccak::hash("\x19Ethereum Signed Message:\n32" . hex2bin($messageHash), 256);

        $ec = new EC('secp256k1');
        $sig = $ec->keyFromPrivate($signerKey)->sign($ethSigned, ['canonical' => true]);
        $r = str_pad($sig->r->toString(16), 64, '0', STR_PAD_LEFT);
        $s = str_pad($sig->s->toString(16), 64, '0', STR_PAD_LEFT);
        $v = ($sig->recoveryParam ?? 0) + 27;

        return response()->json([
            'amount' => $amountWei,
            'nonce' => $nonceDec,
            'contract_address' => $contract,
            'signature' => '0x' . $r . $s . dechex($v),
        ]);
    }

    /**
     * Émet un bon de règlement (voucher) signé par le backend pour CombatGame.settleLoser().
     *
     * Le contrat attend : keccak256(abi.encodePacked(winner, loser, address(this)))
     * puis le préfixe EIP-191 "\x19Ethereum Signed Message:\n32".
     */
    public function settleVoucher(Request $request): JsonResponse
    {
        $request->validate([
            'winner_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'loser_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
        ]);

        $signerKey = (string) config('services.web3.backend_signer_key');
        if ($signerKey === '') {
            return response()->json(['error' => 'Backend signer non configuré (WEB3_BACKEND_SIGNER_KEY).'], 500);
        }
        if (str_starts_with($signerKey, '0x')) {
            $signerKey = substr($signerKey, 2);
        }

        $winner = strtolower($request->winner_address);
        $loser = strtolower($request->loser_address);
        $contract = strtolower((string) config('services.web3.contract_address'));

        if ($winner === $loser) {
            return response()->json(['error' => 'Le gagnant et le perdant ne peuvent pas être identiques.'], 422);
        }

        $packed = hex2bin(substr($winner, 2))
            . hex2bin(substr($loser, 2))
            . hex2bin(substr($contract, 2));
        $messageHash = Keccak::hash($packed, 256);
        $ethSigned = Keccak::hash("\x19Ethereum Signed Message:\n32" . hex2bin($messageHash), 256);

        $ec = new EC('secp256k1');
        $sig = $ec->keyFromPrivate($signerKey)->sign($ethSigned, ['canonical' => true]);
        $r = str_pad($sig->r->toString(16), 64, '0', STR_PAD_LEFT);
        $s = str_pad($sig->s->toString(16), 64, '0', STR_PAD_LEFT);
        $v = ($sig->recoveryParam ?? 0) + 27;

        return response()->json([
            'winner' => $winner,
            'loser' => $loser,
            'contract_address' => $contract,
            'signature' => '0x' . $r . $s . dechex($v),
        ]);
    }
}
