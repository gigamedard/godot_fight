// Configuration Globale du Frontend
// Modifiez ces valeurs pour pointer vers le bon serveur (ex: IP publique ou domaine)

// FIX https mobile : si la page est servie en https (MetaMask Mobile exige
// https pour les RPC non-localhost), TOUTES les URLs passent en https :
//   - API : https://<host>:8443/api via le front (le backend Laravel n'a pas
//     de TLS — on garde l'appel http pour l'instant MAIS le navigateur bloque
//     le mixed content. Le front en https appelle donc l'API via le même
//     hostname, protocole https impossible sans TLS backend → solution :
//     servir l'API aussi en https via le proxy RPC générique.
// Approche retenue : les RPC blockchain passent par le proxy TLS (:8444),
// l'API et Reverb restent sur http/:8081 (appelés depuis une page https ->
// mixed content BLOQUÉ par les navigateurs modernes).
// => Pour le mobile en https, on route TOUT via le même origin : le proxy
//    /rpc relaye l'API et le WS passe en wss:// via le même certificat.
const IS_HTTPS = window.location.protocol === 'https:';

const APP_CONFIG = {
    // Adresse de l'API Laravel (Backend)
    // En https : l'API est relayée par le proxy TLS du front (même origine,
    // pas de mixed content) — route /api-proxy/* vers http://blockchain.../api.
    // (implémentation : voir tls_proxy.py route /api-proxy/<path>)
    API_BASE_URL: IS_HTTPS
        ? `https://${window.location.hostname}:8443/api-proxy/api`
        : `http://${window.location.hostname}:8000/api`,

    // Configuration WebSocket (Reverb) — wss requis en page https
    // (proxy TLS dédié 8445 → reverb:8081). Le Echo config utilise wsPort/wssPort
    // : en https, wsHost:port = 8445 avec forceTLS=true → wss.
    REVERB_HOST: window.location.hostname,
    REVERB_PORT: IS_HTTPS ? 8445 : 8081,
    REVERB_TLS: IS_HTTPS,

    // Configuration Blockchain (Réseau Local Hardhat) — proxy TLS /rpc-proxy
    RPC_URL: IS_HTTPS
        ? `https://${window.location.hostname}:8443/rpc-proxy`
        : `http://${window.location.hostname}:8545`,

    // Portail BATTLEPOOL (App 1) — cible du mode SPIRIT FIGHT (http uniquement :
    // le portail n'est pas utilisé en https pour l'instant)
    PORTAL_URL: `http://${window.location.hostname}:8001/portal?v=6`
};

// Adresse du contrat CombatGame (déployée par le service blockchain).
// Doit correspondre à CONTRACT_ADDRESS du backend (.env) et à l'indexer.
// Vérifiable à la volée : window.CONTRACT_ADDRESS
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

window.APP_CONFIG = APP_CONFIG;
window.CONTRACT_ADDRESS = CONTRACT_ADDRESS;
