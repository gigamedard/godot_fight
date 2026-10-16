<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PoolPlayer extends Model
{
    use HasFactory;

    protected $fillable = [
        'pool_id',
        'wallet_address',
        'character_id',
        'player_name',
        'status',
        'deposited',
        'deposit_tx',
        'deposited_at',
        'loot',
        'losses'
    ];

    public function pool()
    {
        return $this->belongsTo(Pool::class);
    }
}
