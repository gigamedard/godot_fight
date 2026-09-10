<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * FIX ICDM #1 : diffusé uniquement quand les DEUX dépôts escrow d'un match
 * sont confirmés on-chain. Déclenche côté front le lancement du combat
 * (launchGodot). Distinct de MatchStarted (qui marque la création du match
 * et l'ouverture de la modale de dépôt).
 */
class MatchReady implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $matchId;
    public $player1;
    public $player2;
    public $betAmount;

    public function __construct($matchId, $player1, $player2, $betAmount = 0)
    {
        $this->matchId = $matchId;
        $this->player1 = $player1;
        $this->player2 = $player2;
        $this->betAmount = $betAmount;
    }

    public function broadcastOn(): array
    {
        // NB : PrivateChannel préfixe automatiquement "private-" → passer
        // 'player.X' (lowercase, cf. MatchStarted).
        return [
            new PrivateChannel('player.' . strtolower($this->player1)),
            new PrivateChannel('player.' . strtolower($this->player2)),
        ];
    }
}