/**
 * Test de bout en bout du settle backend :
 * 1. B (compte #2) dépose via register (voucher de fonds depuis son wallet dev)
 * 2. settle_fight.js (backend signer) soumet settleLoser — 0 popup
 * 3. Lecture userBalances de A : doit avoir augmenté
 */
const http = require('http');

const RPC_HOST = 'localhost', RPC_PORT = 8545;
function rpc(method, params) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] });
        const req = http.request({ host: RPC_HOST, port: 8545, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 8000 }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error(d.slice(0, 100))); } });
        });
        req.on('error', reject); req.write(body); req.end();
    });
}

(async () => {
    const { execSync } = require('child_process');
    const { ethers } = require('G:/DEV/GODOT_GAME/Web3_Combat_Game/blockchain/node_modules/ethers');

    const B_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // compte #2
    const B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const CONTRACT = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const userWallet = new ethers.Wallet(B_KEY, provider); // wallet de B (le user)
    const abi = [
        'function register(uint256) payable',
        'function userBalances(address) view returns (uint256)'
    ];
    const userContract = new ethers.Contract(CONTRACT, abi, userWallet);

    // 1. Balance de A avant
    const abiRead = new ethers.Contract(CONTRACT, ['function userBalances(address) view returns (uint256)'], provider);
    const before = await abiRead.userBalances(A);

    // 2. B dépose 1 ETH (register) — tx du wallet B (simule son MetaMask)
    const feeBps = 250n;
    const stake = ethers.parseEther('1');
    const fee = stake * feeBps / 10000n;
    const tx = await userContract.register(stake, { value: stake + fee });
    await tx.wait();
    console.log('[setup] register B ok (stake 1 ETH)');

    // 3. Settle backend (gasless) — comme le ferait la route /battle/settle
    const out = execSync(
        'docker exec web3_combat_api node /srv/blockchain/scripts/settle_fight.js 0 ' + A + ' ' + B,
        { encoding: 'utf8', timeout: 30000 }
    );
    console.log('[settle backend]', out.trim());

    // 4. Balance de A après
    const after = await abiRead.userBalances(A);
    const ok = after > before;
    console.log(`userBalances(A) : ${ethers.formatEther(before)} → ${ethers.formatEther(after)} ETH — ${ok ? '✅ CRÉDITÉ sans popup' : '❌ pas crédité'}`);
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });