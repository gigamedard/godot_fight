import { ethers } from "ethers";
import axios from "axios";
import fs from "fs";

// Configuration
const RPC_URL = process.env.RPC_URL || "ws://blockchain:8545";
const API_URL = process.env.API_URL || "http://api:8000/api/internal";
const INDEXER_SECRET = process.env.INDEXER_SECRET || "super_secret_indexer_token";
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Load ABI
const artifactPath = "../blockchain/artifacts/contracts/CombatGame.sol/CombatGame.json";
let abi;
try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    abi = artifact.abi;
    console.log("✅ ABI loaded successfully");
} catch (e) {
    console.error("❌ Failed to load ABI from", artifactPath);
    process.exit(1);
}

// Axios instance for backend calls
const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Authorization": `Bearer ${INDEXER_SECRET}`,
        "Content-Type": "application/json"
    }
});

async function connectWithRetry() {
    console.log(`📡 Connecting to Blockchain at ${RPC_URL}...`);
    while (true) {
        try {
            const provider = new ethers.WebSocketProvider(RPC_URL);
            
            // Wait for ready
            await provider.ready;
            console.log("✅ Connected to WebSocket provider");
            
            // Handle disconnects
            provider.websocket.onclose = () => {
                console.error("❌ WebSocket closed. Reconnecting...");
                setTimeout(() => process.exit(1), 1000); // Let Docker restart it
            };
            
            return provider;
        } catch (err) {
            console.log(`Failed to connect to ${RPC_URL}, retrying in 3s...`);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}

async function main() {
    const provider = await connectWithRetry();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

    // Listen to PoolStarted
    contract.on("PoolStarted", async (poolId, participants, event) => {
        const poolIdStr = poolId.toString();
        console.log(`🏆 [PoolStarted] Pool ID: ${poolIdStr}, Participants:`, participants);
        
        try {
            await api.post("/pool-started", {
                pool_id: poolIdStr,
                participants: participants
            });
            console.log(`✅ [PoolStarted] Sent to Laravel successfully`);
        } catch (e) {
            console.error(`❌ [PoolStarted] Laravel API Error:`, e.response?.data || e.message);
        }
    });

    // Listen to PoolMatchFinished
    contract.on("PoolMatchFinished", async (poolId, matchId, player1, player2, winner, loser, isLoserEliminated, event) => {
        const poolIdStr = poolId.toString();
        const matchIdStr = matchId.toString();
        console.log(`⚔️ [PoolMatchFinished] Pool: ${poolIdStr}, Match: ${matchIdStr}`);
        console.log(`   P1: ${player1}, P2: ${player2}`);
        console.log(`   Winner: ${winner}, Loser: ${loser}, Eliminated: ${isLoserEliminated}`);
        
        try {
            await api.post("/match-finished", {
                pool_id: poolIdStr,
                match_id: matchIdStr,
                player1: player1,
                player2: player2,
                winner: winner,
                loser: loser,
                is_eliminated: isLoserEliminated
            });
            console.log(`✅ [PoolMatchFinished] Sent to Laravel successfully`);
        } catch (e) {
            console.error(`❌ [PoolMatchFinished] Laravel API Error:`, e.response?.data || e.message);
        }
    });

    console.log("👂 Listening for events...");

    provider.websocket.on("close", () => {
        console.error("❌ WebSocket closed. Reconnecting in 5s...");
        setTimeout(main, 5000);
    });
}

main().catch(console.error);
