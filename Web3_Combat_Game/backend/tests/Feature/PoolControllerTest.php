<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Pool;
use App\Models\PoolPlayer;
use Illuminate\Support\Facades\Event;
use App\Events\PoolRoundStarted;

class PoolControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_open_public_pools()
    {
        Pool::create([
            'id' => 1,
            'entry_fee' => 10,
            'max_players' => 8,
            'penalty_mode' => 0,
            'is_private' => false,
            'status' => 'open'
        ]);

        Pool::create([
            'id' => 2,
            'entry_fee' => 50,
            'max_players' => 4,
            'penalty_mode' => 1,
            'is_private' => true, // Private, should not appear
            'status' => 'open'
        ]);

        $response = $this->get('/api/pools');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonFragment(['id' => 1]);
    }

    public function test_can_register_new_pool()
    {
        $payload = [
            'id' => 10,
            'entry_fee' => 100,
            'max_players' => 16,
            'penalty_mode' => 1,
            'is_private' => true
        ];

        $response = $this->postJson('/api/pools', $payload);

        $response->assertStatus(200);
        $this->assertDatabaseHas('pools', ['id' => 10, 'is_private' => true]);
        
        $pool = Pool::find(10);
        $this->assertNotNull($pool->invite_code);
    }

    public function test_can_join_pool_and_triggers_matchmaking_when_full()
    {
        Event::fake();

        $pool = Pool::create([
            'id' => 5,
            'entry_fee' => 10,
            'max_players' => 2,
            'penalty_mode' => 0,
            'is_private' => false,
            'status' => 'open'
        ]);

        $this->postJson('/api/pools/join', [
            'pool_id' => 5,
            'wallet_address' => '0x1111111111111111111111111111111111111111'
        ])->assertStatus(200);

        $this->assertDatabaseHas('pool_players', ['wallet_address' => '0x1111111111111111111111111111111111111111']);
        
        // Pool is not full yet
        Event::assertNotDispatched(PoolRoundStarted::class);

        // Player 2 joins (pool becomes full)
        $this->postJson('/api/pools/join', [
            'pool_id' => 5,
            'wallet_address' => '0x2222222222222222222222222222222222222222'
        ])->assertStatus(200);

        // Should trigger matchmaking
        Event::assertDispatched(PoolRoundStarted::class, function ($event) {
            return $event->poolId === 5 && count($event->pairs) === 1;
        });

        $this->assertDatabaseHas('pools', ['id' => 5, 'status' => 'active']);
    }

    public function test_trigger_matchmaking_with_odd_players()
    {
        Event::fake();

        $pool = Pool::create([
            'id' => 6,
            'entry_fee' => 10,
            'max_players' => 8,
            'penalty_mode' => 0,
            'is_private' => false,
            'status' => 'active'
        ]);

        PoolPlayer::create(['pool_id' => 6, 'wallet_address' => '0x1']);
        PoolPlayer::create(['pool_id' => 6, 'wallet_address' => '0x2']);
        PoolPlayer::create(['pool_id' => 6, 'wallet_address' => '0x3']);
        // 3 players = 1 pair and 1 waiting

        $response = $this->postJson('/api/pools/6/matchmake');
        $response->assertStatus(200);
        
        $json = $response->json();
        $this->assertCount(1, $json['pairs']);
        $this->assertNotNull($json['waiting']);

        Event::assertDispatched(PoolRoundStarted::class);
    }
}
