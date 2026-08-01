<?php

namespace Tests\Feature;

use Tests\TestCase;

class WithdrawVoucherTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.web3.contract_address' => '0x5FbDB2315678afecb367f032d93F642f64180aa3',
            'services.web3.backend_signer_key' => '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        ]);
    }

    public function test_voucher_endpoint_returns_signed_voucher(): void
    {
        $response = $this->postJson('/api/withdraw/voucher', [
            'wallet_address' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'amount_wei' => '10000000000000000000',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['amount', 'nonce', 'contract_address', 'signature']);

        $data = $response->json();
        $this->assertSame('10000000000000000000', $data['amount']);
        $this->assertSame('0x5fbdb2315678afecb367f032d93f642f64180aa3', strtolower($data['contract_address']));
        $this->assertMatchesRegularExpression('/^0x[0-9a-fA-F]{130}$/', $data['signature']);
    }

    public function test_voucher_rejects_invalid_payload(): void
    {
        $this->postJson('/api/withdraw/voucher', [
            'wallet_address' => 'pas-une-adresse',
            'amount_wei' => '1',
        ])->assertStatus(422);

        $this->postJson('/api/withdraw/voucher', [
            'wallet_address' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'amount_wei' => '0',
        ])->assertStatus(422);
    }

    public function test_settle_voucher_returns_signed_voucher(): void
    {
        $response = $this->postJson('/api/withdraw/settle-voucher', [
            'winner_address' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'loser_address' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['winner', 'loser', 'contract_address', 'signature']);

        $data = $response->json();
        $this->assertSame(strtolower('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'), $data['winner']);
        $this->assertSame(strtolower('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'), $data['loser']);
        $this->assertSame('0x5fbdb2315678afecb367f032d93f642f64180aa3', strtolower($data['contract_address']));
        $this->assertMatchesRegularExpression('/^0x[0-9a-fA-F]{130}$/', $data['signature']);
    }

    public function test_settle_voucher_rejects_identical_addresses(): void
    {
        $this->postJson('/api/withdraw/settle-voucher', [
            'winner_address' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'loser_address' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        ])->assertStatus(422);
    }
}
