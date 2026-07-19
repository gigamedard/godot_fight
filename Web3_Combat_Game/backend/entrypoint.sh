#!/bin/bash
set -e

echo "Waiting for MySQL database..."
sleep 15 # Allow MySQL container time to initialize

echo "Running migrations..."
php artisan migrate:fresh --force

echo "Starting Reverb WebSocket server..."
php artisan reverb:start --host=0.0.0.0 --port=8081 &

echo "Starting Laravel HTTP server..."
exec php artisan serve --host=0.0.0.0 --port=8000
