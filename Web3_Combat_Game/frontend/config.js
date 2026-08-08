// Configuration Globale du Frontend
// Modifiez ces valeurs pour pointer vers le bon serveur (ex: IP publique ou domaine)

const APP_CONFIG = {
    // Adresse de l'API Laravel (Backend)
    API_BASE_URL: `http://${window.location.hostname}:8000/api`,

    // Configuration WebSocket (Reverb)
    REVERB_HOST: window.location.hostname,
    REVERB_PORT: 8081,

    // Configuration Blockchain (Réseau Local Hardhat)
    RPC_URL: `http://${window.location.hostname}:8545`,

    // Portail BATTLEPOOL (App 1) — cible du mode SPIRIT FIGHT.
    // L'App 1 (rock-paper-scissors) écoute sur le port 8001 (voir docker-compose.yml
    // de rock-paper-scissors, mapping 8001->8080). La route /portal sert portal.html.
    // Le paramètre ?v= est un cache-buster : à incrémenter à chaque évolution du
    // portail (menu, styles) pour forcer le navigateur à recharger la nouvelle version.
    PORTAL_URL: `http://${window.location.hostname}:8001/portal?v=4`
};

// Adresse du contrat CombatGame (déployée par le service blockchain).
// Doit correspondre à CONTRACT_ADDRESS du backend (.env) et à l'indexer.
// Vérifiable à la volée : window.CONTRACT_ADDRESS
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

window.APP_CONFIG = APP_CONFIG;
window.CONTRACT_ADDRESS = CONTRACT_ADDRESS;
