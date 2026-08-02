// Configuration Globale du Frontend
// Modifiez ces valeurs pour pointer vers le bon serveur (ex: IP publique ou domaine)

const APP_CONFIG = {
    // Adresse de l'API Laravel (Backend)
    API_BASE_URL: `http://${window.location.hostname}:8000/api`,

    // Configuration WebSocket (Reverb)
    REVERB_HOST: window.location.hostname,
    REVERB_PORT: 8081,

    // Configuration Blockchain (Réseau Local Hardhat)
    RPC_URL: `http://${window.location.hostname}:8545`
};

// Adresse du contrat CombatGame (déployée par le service blockchain).
// Doit correspondre à CONTRACT_ADDRESS du backend (.env) et à l'indexer.
// Vérifiable à la volée : window.CONTRACT_ADDRESS
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

window.APP_CONFIG = APP_CONFIG;
window.CONTRACT_ADDRESS = CONTRACT_ADDRESS;
