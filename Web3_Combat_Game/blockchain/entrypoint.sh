#!/bin/sh
set -e

echo "Starting Hardhat node in background..."
npx hardhat node &
NODE_PID=$!

echo "Waiting for Hardhat node to be ready..."
sleep 5

echo "Deploying CombatGame smart contract..."
npx hardhat run scripts/deploy.js --network localhost

echo "Blockchain ready! Keeping container alive."
wait $NODE_PID
