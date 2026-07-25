<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionKey extends Model
{
    protected $fillable = [
        'wallet_address',
        'session_public_key',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];
}
