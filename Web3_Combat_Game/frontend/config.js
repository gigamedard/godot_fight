// Configuration Globale du Frontend
// CIBLE : L1 Pingala Chain (chainId 99999, symbole natif TST).
// Plus jamais 8545 / 8845 / 31337 en production.
//
// 3 modes d'exécution :
//  - LOCAL HTTP   (http://localhost:8080)      : API :8000, Reverb :8081
//  - LOCAL HTTPS  (https://<host>:8443)        : proxy TLS local :8444/:8445
//  - PUBLIC HTTPS (https://app2.<ip>.sslip.io) : origine unique derrière le
//    reverse proxy Caddy du VPS : /api/* -> API, /app/* -> Reverb (WebSocket).

const HOST = window.location.hostname;
const IS_HTTPS = window.location.protocol === 'https:';
const IS_LOOPBACK =
    HOST === 'localhost' ||
    HOST === '127.0.0.1' ||
    HOST === '[::1]';
// PUBLIC = page HTTPS servie par le reverse proxy Caddy du VPS (nom de domaine,
// pas un simple loopback). On route alors tout en relatif sur la même origine.
const IS_PUBLIC = IS_HTTPS && !IS_LOOPBACK;

// --- Réseau Pingala Chain (fait foi) ---
const PINGALA_CHAIN_ID = 99999;
const PINGALA_CHAIN_ID_HEX = '0x1869f';
const PINGALA_RPC_URL =
    'https://31.187.72.98.sslip.io/ext/bc/2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea/rpc';
const NATIVE_SYMBOL = 'TST';

// projectId WalletConnect / Reown (public côté client — cloné depuis App 1).
// Requis pour le deeplink Core Mobile. Lue par le bundle web3.iife.js.
const WALLETCONNECT_PROJECT_ID = 'e46cab0b26fb49b6375fd488d2dc5e95';

// Bloc EIP-3085 (wallet_addEthereumChain / wallet_switchEthereumChain).
// Pas d'explorer public sur Pingala (blockExplorerUrls: null).
const PINGALA_NETWORK = {
    chainId: PINGALA_CHAIN_ID_HEX,
    chainName: 'Pingala Chain',
    rpcUrls: [PINGALA_RPC_URL],
    nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: 18 },
    blockExplorerUrls: null,
};

const APP_CONFIG = {
    // --- API Laravel ---
    // PUBLIC : même origine, chemin /api (Caddy -> 127.0.0.1:8000).
    // LOCAL HTTPS : proxy TLS :8444 (/api-proxy). LOCAL HTTP : direct :8000.
    API_BASE_URL: IS_PUBLIC
        ? `${window.location.origin}/api`
        : (IS_HTTPS
            ? `https://${HOST}:8444/api-proxy/api`
            : `http://${HOST}:8000/api`),

    // --- Laravel Reverb (WebSocket) ---
    // PUBLIC : wss://<domaine>:443/app (chemin par défaut de pusher-js = /app),
    //          Caddy route /app/* vers 127.0.0.1:8009.
    // LOCAL HTTPS : proxy TLS :8445 (/app). LOCAL HTTP : direct :8081.
    REVERB_HOST: HOST,
    REVERB_PORT: IS_PUBLIC ? 443 : (IS_HTTPS ? 8445 : 8081),
    REVERB_TLS: IS_HTTPS,

    // --- Blockchain : RPC public Pingala (HTTPS partout) ---
    RPC_URL: PINGALA_RPC_URL,
    CHAIN_ID: PINGALA_CHAIN_ID,
    CHAIN_ID_HEX: PINGALA_CHAIN_ID_HEX,
    NATIVE_SYMBOL,
    WALLETCONNECT_PROJECT_ID,

    // --- Portail BATTLEPOOL (App 1) ---
    // DEEP LINK : App 2 n'embarque plus App 1 en iframe. On ouvre le portail
    // (nouvel onglet) sur son URL racine ; chaque app garde sa propre session.
    // PUBLIC : sous-domaine public d'App 1 (même VPS / même Caddy).
    PORTAL_URL: IS_PUBLIC
        ? 'https://battlepool.31.187.72.98.sslip.io/'
        : `http://${HOST}:8001/`
};

// Adresse du contrat CombatGame (déployée sur Pingala).
// Doit correspondre à CONTRACT_ADDRESS du backend (.env) et à l'indexer.
// Source : blockchain/deployments.pingala.json. Vérifiable : window.CONTRACT_ADDRESS
const CONTRACT_ADDRESS = "0xA2722921B753C1E76e1d9a4294204DF983746C3D";

// --- Helpers réseau wallet (MetaMask / Core) ---
// Ajoute ou bascule le wallet sur Pingala Chain si nécessaire.
async function ensurePingalaNetwork(eth = window.ethereum) {
    if (!eth || !eth.request) return false;
    try {
        const current = await eth.request({ method: 'eth_chainId' });
        if (current && current.toLowerCase() === PINGALA_CHAIN_ID_HEX) return true;
    } catch (e) { /* ignore : on tente le switch */ }
    try {
        await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: PINGALA_CHAIN_ID_HEX }],
        });
        return true;
    } catch (err) {
        // 4902 = réseau inconnu du wallet → on l'ajoute.
        if (err && err.code === 4902) {
            try {
                await eth.request({
                    method: 'wallet_addEthereumChain',
                    params: [PINGALA_NETWORK],
                });
                return true;
            } catch (e) {
                console.warn('[App2] ajout du réseau Pingala refusé :', e);
                return false;
            }
        }
        console.warn('[App2] switch vers Pingala refusé :', err);
        return false;
    }
}

window.APP_CONFIG = APP_CONFIG;
window.CONTRACT_ADDRESS = CONTRACT_ADDRESS;
window.PINGALA_NETWORK = PINGALA_NETWORK;
window.ensurePingalaNetwork = ensurePingalaNetwork;
