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

window.APP_CONFIG = APP_CONFIG;
