<?php

namespace Tests\Feature;

use App\Models\Fight;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FightTimeoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_timeout_opponent_never_committed_loses_by_forfeit(): void
    {
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'player2_wallet' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            'player1_commit' => '0xabcdef',
            'player2_commit' => null,
            'player1_move' => null,
            'player2_move' => null,
            'status' => 'waiting_for_commits',
        ]);

        $this->postJson('/api/battle/timeout', ['match_id' => $fight->id])->assertOk();

        $fight->refresh();
        $this->assertSame('completed', $fight->status);
        $this->assertSame('player1_win', $fight->result);
    }

    public function test_timeout_committed_player_who_never_revealed_loses_by_forfeit(): void
    {
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'player2_wallet' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            'player1_commit' => '0xabc',
            'player2_commit' => '0xdef',
            'player1_move' => null,
            'player2_move' => 2,
            'status' => 'waiting_for_reveals',
        ]);

        $this->postJson('/api/battle/timeout', ['match_id' => $fight->id])->assertOk();

        $fight->refresh();
        $this->assertSame('completed', $fight->status);
        $this->assertSame('player2_win', $fight->result);
    }

    public function test_timeout_both_never_committed_is_double_elimination(): void
    {
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'player2_wallet' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            'player1_commit' => null,
            'player2_commit' => null,
            'player1_move' => null,
            'player2_move' => null,
            'status' => 'waiting_for_commits',
        ]);

        $this->postJson('/api/battle/timeout', ['match_id' => $fight->id])->assertOk();

        $fight->refresh();
        $this->assertSame('double_elimination', $fight->result);
    }

    public function test_revealed_moves_still_resolve_normally(): void
    {
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'player2_wallet' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            'player1_commit' => '0xabc',
            'player2_commit' => '0xdef',
            'player1_move' => 1,
            'player2_move' => 3,
            'status' => 'waiting_for_reveals',
        ]);

        $this->postJson('/api/battle/timeout', ['match_id' => $fight->id])->assertOk();

        $fight->refresh();
        $this->assertSame('player1_win', $fight->result);
    }

    public function test_status_exposes_shared_absolute_deadline(): void
    {
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'player2_wallet' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            'status' => 'waiting_for_commits',
        ]);

        $data = $this->getJson("/api/battle/status/{$fight->id}")->assertOk()
            ->assertJsonStructure(['deadline'])->json();

        $deadline = (int) $data['deadline'];
        $this->assertGreaterThanOrEqual(time() * 1000, $deadline);
        $this->assertLessThanOrEqual((time() + 50) * 1000, $deadline);
    }

    public function test_status_auto_resolves_expired_fight_without_client_timeout(): void
    {
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'player2_wallet' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            'player1_commit' => '0xabcdef',
            'player2_commit' => null,
            'status' => 'waiting_for_commits',
        ]);

        // Simuler un combat dont la deadline est déjà dépassée (aucune activité depuis 60s)
        $fight->created_at = now()->subSeconds(60);
        $fight->updated_at = now()->subSeconds(60);
        $fight->save();

        // Un simple GET /battle/status résout le combat côté serveur (aucun POST /timeout)
        $data = $this->getJson("/api/battle/status/{$fight->id}")->assertOk()->json();

        $this->assertSame('completed', $data['status']);
        $this->assertSame('player1_win', $data['result']);
    }

    public function test_status_does_not_resolve_fight_before_deadline(): void
    {
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'player2_wallet' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            'player1_commit' => '0xabcdef',
            'player2_commit' => null,
            'status' => 'waiting_for_commits',
        ]);

        $data = $this->getJson("/api/battle/status/{$fight->id}")->assertOk()->json();

        $this->assertSame('waiting_for_commits', $data['status']);
    }

    public function test_reveal_not_killed_by_deadline_anchored_on_creation(): void
    {
        // Bug « vainqueur inconnu » : le fight a été créé il y a 120s, mais les joueurs
        // viennent de committer (updated_at récent). Sous l'ancien ancrage created_at+35s,
        // le GET /battle/status résolvait le combat avant que les reveals n'atterrissent,
        // produisant un double_elimination et une poule sans vainqueur.
        $fight = Fight::create([
            'pool_id' => null,
            'player1_wallet' => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            'player2_wallet' => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            'player1_commit' => '0xabc',
            'player2_commit' => '0xdef',
            'player1_move' => null,
            'player2_move' => 3,
            'status' => 'waiting_for_reveals',
        ]);

        $fight->created_at = now()->subSeconds(120);
        $fight->updated_at = now()->subSeconds(10);
        $fight->save();

        $data = $this->getJson("/api/battle/status/{$fight->id}")->assertOk()->json();

        // La deadline glisse avec l'activité : le reveal de l'adversaire peut encore arriver
        $this->assertSame('waiting_for_reveals', $data['status']);
        $this->assertGreaterThan(time() * 1000, (int) $data['deadline']);
    }
}
