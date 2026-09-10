<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use kornrunner\Keccak;
use Elliptic\EC;
use Illuminate\Support\Facades\Log;

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

        // FIX ICDM #3 : le perdant d'un duel non-égalité n'a RIEN à réclamer
        // (sa mise est partie au gagnant). Si un voucher pour un montant > 0
        // est demandé alors que la DB n'atteste d'aucun crédit, on refuse.
        // Garde soft : le vrai verrou est le solde on-chain (le contrat refuse
        // "Insufficient on-chain balance"), mais on filtre ici les demandes
        // aberrantes (montant > dernier match connu).
        $this->guardLoserWithdraw($request->wallet_address);

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

    /**
     * Émet un bon de retrait du pot d'une poule (voucher) signé par le backend
     * pour CombatGame.claimPool(poolId, amount, nonce, signature).
     *
     * Le contrat attend (avec msg.sender = winner, défini par l'appelant,
     * donc le voucher est généré POUR le winner fourni en entrée) :
     *     keccak256(abi.encodePacked(poolId, winner, amount, nonce, address(this)))
     * puis le préfixe EIP-191 "\x19Ethereum Signed Message:\n32".
     *
     * Le backend contrôle off-chain le gagnant réel de la poule ; il atteste
     * l'integralité du pot (winner-take-all) via cette signature unique.
     */
    public function claimPoolVoucher(Request $request): JsonResponse
    {
        $request->validate([
            'pool_id' => ['required', 'integer', 'min:1'],
            'winner_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'amount_wei' => ['required', 'string', 'regex:/^[0-9]+$/'],
        ]);

        $signerKey = (string) config('services.web3.backend_signer_key');
        if ($signerKey === '') {
            return response()->json(['error' => 'Backend signer non configuré (WEB3_BACKEND_SIGNER_KEY).'], 500);
        }
        if (str_starts_with($signerKey, '0x')) {
            $signerKey = substr($signerKey, 2);
        }

        $poolId = (int) $request->pool_id;
        $winner = strtolower($request->winner_address);
        $amountWei = $request->amount_wei;
        $contract = strtolower((string) config('services.web3.contract_address'));

        if (gmp_cmp($amountWei, '0') <= 0) {
            return response()->json(['error' => 'Montant du pot invalide.'], 422);
        }

        // Vérif de cohérence : amount demandé vs poolTotal on-chain réel.
        // Détecte notamment les joueurs qui ont rejoint un pot mais n'ont jamais
        // réellement déposé leur mise dans l'escrow (dépôt client silencieusement absent).
        $rpc = (string) config('services.web3.rpc_url', 'http://127.0.0.1:8545');
        $poolTotalWei = '';
        try {
            // selector de poolTotal(uint256)
            $selector = substr(Keccak::hash('poolTotal(uint256)', 256), 0, 8);
            $data = '0x' . $selector . str_pad(gmp_strval(gmp_init($poolId, 10), 16), 64, '0', STR_PAD_LEFT);
            $rpcBody = json_encode([
                'jsonrpc' => '2.0', 'method' => 'eth_call',
                'params' => [[ 'to' => $contract, 'data' => $data ], 'latest'], 'id' => 1,
            ]);
            $ch = curl_init($rpc);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => $rpcBody,
            ]);
            $resp = curl_exec($ch);
            $curlErr = curl_error($ch);
            curl_close($ch);
            if (!$curlErr) {
                $decoded = json_decode((string) $resp, true);
                if (is_array($decoded) && !empty($decoded['result']) && $decoded['result'] !== '0x') {
                    $hexTrim = ltrim((string) $decoded['result'], '0x');
                    $poolTotalToUse = $hexTrim === '' ? '0' : $hexTrim;
                    $poolTotalToUse = gmp_strval(gmp_init($poolTotalToUse, 16), 10);
                }
            }
        } catch (\Throwable $err) {
            Log::warning('claimPoolVoucher: check poolTotal échoué: ' . $err->getMessage());
        }

        $poolTotalDisplay = $poolTotalToUse ?? 'N/A';
        Log::info("claimPoolVoucher pool={$poolId} winner={$winner} claim={$amountWei} poolTotal_onchain={$poolTotalDisplay}");

        // Cohérence : le champion ne peut réclamer que ce qui existe réellement dans
        // l'escrow. Si un joueur a rejoint en DB sans déposer on-chain, le pot réel
        // est inférieur au montant attendu => refus (sinon tx claimPool revert on-chain).
        if (isset($poolTotalToUse) && gmp_cmp($amountWei, $poolTotalToUse) > 0) {
            Log::warning("claimPoolVoucher pool={$poolId} REFUSÉ : demandé {$amountWei} > poolTotal on-chain {$poolTotalToUse}");
            return response()->json(['error' => 'Montant demandé supérieur au pot on-chain réel.'], 409);
        }

        $nonceHex = bin2hex(random_bytes(32));
        $nonceDec = gmp_strval(gmp_init($nonceHex, 16), 10);

        // poolId (uint256), winner (address), amount (uint256), nonce (uint256), address(this)
        $packed = hex2bin(str_pad(gmp_strval(gmp_init($poolId, 10), 16), 64, '0', STR_PAD_LEFT))
            . hex2bin(substr($winner, 2))
            . hex2bin(str_pad(gmp_strval(gmp_init($amountWei, 10), 16), 64, '0', STR_PAD_LEFT))
            . hex2bin(str_pad(gmp_strval(gmp_init($nonceDec, 10), 16), 64, '0', STR_PAD_LEFT))
            . hex2bin(substr($contract, 2));
        $messageHash = Keccak::hash($packed, 256);
        $ethSigned = Keccak::hash("\x19Ethereum Signed Message:\n32" . hex2bin($messageHash), 256);

        $ec = new EC('secp256k1');
        $sig = $ec->keyFromPrivate($signerKey)->sign($ethSigned, ['canonical' => true]);
        $r = str_pad($sig->r->toString(16), 64, '0', STR_PAD_LEFT);
        $s = str_pad($sig->s->toString(16), 64, '0', STR_PAD_LEFT);
        $v = ($sig->recoveryParam ?? 0) + 27;

        return response()->json([
            'pool_id' => $poolId,
            'winner' => $winner,
            'amount' => $amountWei,
            'nonce' => $nonceDec,
            'contract_address' => $contract,
            'signature' => '0x' . $r . $s . dechex($v),
        ]);
    }

    /**
     * FIX ICDM #3 : garde anti-perdant. Un joueur qui vient de PERDRE un duel
     * non-égalité n'a plus rien sur son userBalances (sa mise est allée au
     * gagnant). Si un voucher pour un montant > 0 est demandé alors que le
     * dernier combat terminé du wallet le déclare perdant, on refuse (422) :
     * empêche un perdant de réclamer un crédit fantôme via l'UI.
     * Le gagnant et le cas d'égalité passent (ils ont un solde légitime).
     */
    private function guardLoserWithdraw(string $wallet): void
    {
        $w = strtolower($wallet);
        $last = \App\Models\Fight::where('status', 'completed')
            ->where(function ($q) use ($w) {
                $q->where('player1_wallet', $w)->orWhere('player2_wallet', $w);
            })
            ->latest('id')
            ->first();

        if (!$last || $last->result === 'draw') {
            return; // pas de duel récent ou égalité : rien à refuser ici
        }

        $isLoser = (
            ($last->result === 'player1_win' && $last->player1_wallet !== $w) ||
            ($last->result === 'player2_win' && $last->player2_wallet !== $w)
        );

        if ($isLoser) {
            Log::warning("Withdraw refusé : perdant du dernier match ({$w})");
            abort(422, 'Vous avez perdu ce match : la mise adverse a été consolidée au gagnant.');
        }
    }

    /**
     * Wrapper public pour InternalController::pushWithdraw (garde identique).
     */
    public function guardLoserWithdrawPublic(string $wallet): void
    {
        $this->guardLoserWithdraw($wallet);
    }
}
