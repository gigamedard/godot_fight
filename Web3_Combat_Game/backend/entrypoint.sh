#!/bin/bash
set -e

echo "Waiting for Hardhat node to be reachable..."
for i in $(seq 1 30); do
    if curl -s -X POST http://blockchain:8545 -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo "Waiting for MySQL to be reachable..."
for i in $(seq 1 60); do
    if php -r 'try { new PDO("mysql:host=db;port=3306;dbname=web3_combat", "user", "password"); echo "ok"; } catch (Exception $e) { exit(1); }' > /dev/null 2>&1; then
        break
    fi
    sleep 2
done

echo "Running migrations..."
php artisan migrate --force

echo "Starting Reverb WebSocket server..."
php artisan reverb:start --host=0.0.0.0 --port=8081 &

echo "Starting API on port 8000..."
export PHP_CLI_SERVER_WORKERS=4
exec php artisan serve --host=0.0.0.0 --port=8000
