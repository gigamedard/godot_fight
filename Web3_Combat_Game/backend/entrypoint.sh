#!/bin/bash
set -e

echo "Waiting for MySQL database..."
sleep 15 # Allow MySQL container time to initialize

echo "Running migrations..."
php artisan migrate --force

echo "Starting Reverb WebSocket server..."
php artisan reverb:start --host=0.0.0.0 --port=8081 &

echo "Starting API on port 8000..."
export PHP_CLI_SERVER_WORKERS=4
exec php artisan serve --host=0.0.0.0 --port=8000
