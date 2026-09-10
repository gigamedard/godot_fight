<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Fight extends Model
{
    use HasFactory;

    protected $fillable = [
        'pool_id',
        'player1_wallet',
        'player2_wallet',
        'player1_commit',
        'player2_commit',
        'player1_move',
        'player2_move',
        'status',
        'result',
        'base_bet_amount',
        'p1_deposited',
        'p2_deposited',
        'p1_deposit_tx',
        'p2_deposit_tx',
        'p1_deposited_at',
        'p2_deposited_at',
    ];

    public function pool()
    {
        return $this->belongsTo(Pool::class);
    }
}
