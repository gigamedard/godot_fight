/**
 * Diagnostic infra — à exécuter AVANT de retester le flux complet.
 * Vérifie (sans rien modifier) :
 *   1. Nœud Hardhat joignable sur :8545 (chainId, bloc courant)
 *   2. Contrat présent à l'adresse de config.js (eth_getCode non vide)
 *   3. Fonds du compte MetaMask utilisé (eth_getBalance)
 *   4. Backend joignable sur :8000/api
 *
 * Usage : node test/infra-check.js [adresse_wallet_optionnelle]
 * L'adresse du contrat est lue depuis frontend/config.js (consultation seule).
 */
const http = require('http');

const FRONTEND_CONFIG = 'G:/DEV/GODOT_GAME/Web3_Combat_Game/frontend/config.js';
const RPC_PORT = 8545;
const API_PORT = 8000;

// Extraction de CONTRACT_ADDRESS depuis config.js (consultation, jamais édition)
const fs = require('fs');
const cfg = fs.readFileSync(FRONTEND_CONFIG, 'utf8');
const m = cfg.match(/CONTRACT_ADDRESS\s*=\s*"(0x[0-9a-fA-F]{40})"/);
const CONTRACT = m ? m[1] : null;

const wallet = process.argv[2] || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // compte #1 Hardhat (celui du log)

function rpc(method, params) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] });
        const req = http.request({
            host: '127.0.0.1', port: RPC_PORT, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            timeout: 5000
        }, res => {
            let d = '';
            res.on('data', c => d += c);   // lire la RÉPONSE (bug : était req.on)
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('Réponse RPC invalide : ' + d.slice(0, 120))); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error('timeout RPC')); });
        req.write(body); req.end();
    });
}

function api(path) {
    return new Promise((resolve) => {
        const req = http.request({ host: 'localhost', port: API_PORT, path: '/api' + path, method: 'GET', timeout: 5000 }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d.slice(0, 200) }));
        });
        req.on('error', e => resolve({ status: 0, body: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
        req.end();
    });
}

(async () => {
    console.log('════════ DIAGNOSTIC INFRA ════════');
    console.log(`Contrat lu dans config.js : ${CONTRACT || 'INTROUVABLE (regex)'}\n`);
    let fatal = false;

    // 1. Nœud Hardhat
    let chainId = null;
    try {
        const r = await rpc('eth_chainId');
        chainId = r.result;
        console.log(`✅ Nœud Hardhat :8545 — chainId ${parseInt(r.result, 16)}`);
        const b = await rpc('eth_blockNumber');
        console.log(`   Bloc courant : ${parseInt(b.result, 16)}`);
    } catch (e) {
        fatal = true;
        console.log(`❌ Nœud Hardhat :8545 INJOIGNABLE — ${e.message}`);
        console.log('   → C\'est la cause des "MetaMask RPC Error -32002". Relance `npx hardhat node`.');
    }

    // 2. Code du contrat à l'adresse configurée
    if (chainId) {
        try {
            const c = await rpc('eth_getCode', [CONTRACT, 'latest']);
            const hasCode = c.result && c.result.length > 2;
            console.log(`${hasCode ? '✅' : '❌'} Contrat ${CONTRACT} : ${hasCode ? 'bytecode présent (' + Math.round(c.result.length / 2) + ' octets)' : 'AUCUN CODE — Hardhat redémarré sans redeploy → tous les appels revert ("missing revert data")'}`);
            if (!hasCode) fatal = true;
        } catch (e) {
            console.log(`❌ eth_getCode échoué : ${e.message}`);
            fatal = true;
        }
    }

    // 3. Solde du compte
    if (chainId) {
        try {
            const b = await rpc('eth_getBalance', [wallet, 'latest']);
            const eth = parseInt(b.result, 16) / 1e18;
            console.log(`${eth > 0.01 ? '✅' : '❌'} Solde ${wallet.slice(0, 8)}… : ${eth.toFixed(4)} ETH ${eth <= 0.01 ? '— compte VIDÉ, le dépôt revert' : ''}`);
        } catch (e) { console.log(`⚠️ eth_getBalance : ${e.message}`); }
    }

    // 4. Backend
    const apiRes = await api('/pools');
    console.log(`${apiRes.status === 200 ? '✅' : '❌'} Backend :8000/api/pools → HTTP ${apiRes.status} ${apiRes.status === 0 ? '(' + apiRes.body + ')' : ''}`);
    if (apiRes.status !== 200) fatal = true;

    console.log('\n════════ VERDICT ════════');
    if (fatal) {
        console.log('❌ Infra défaillante — corriger ci-dessus puis relancer : node test\\infra-check.js');
        console.log('   Quand tout est ✅, relancer le test complet : node test\\puppeteer-lite-test.js');
        process.exit(1);
    } else {
        console.log('✅ Infra OK — retester le flux complet (combat réel) dans le navigateur.');
    }
})();