// 1. ÉTAT GLOBAL DE L'APPLICATION
const AppState = {
    currentScreen: 'screen-splash',
    selectedCharacter: null,
    selectedGameMode: localStorage.getItem('web3combat_mode') || null, // 'DUEL' | 'BATTLE' | 'SPIRIT'
    language: localStorage.getItem('web3combat_lang') || null,
    walletAddress: null,
    currentChallenger: null, 
    currentTargetId: null, 
    pendingChallengeParam: null, 
    defaultBetAmount: localStorage.getItem('web3combat_bet_amount') || '10',
    currentPoolId: null,
    currentPoolFee: 0,
    pendingPoolParam: null,
    pendingPoolRoundEvent: null,
    pendingInvitePoolId: null,
    pendingInvitePoolMax: null,
    matchDeadline: null,
    timeoutRequested: false,
    fightTimeoutMs: null // Durée d'un round (ms), récupérée du backend (/game-config)
};

let onlinePlayers = []; // Mis à jour via Reverb

const characters = [
    { id: 1, name: 'Guerrier Ninja', style: 'Arts Martiaux', color: 'var(--color-orange)' },
    { id: 2, name: 'Mutant Cyborg', style: 'Vitesse', color: 'var(--color-blue)' },
    { id: 3, name: 'Tom Frazer', style: 'Force Brute', color: 'var(--color-red)' },
    { id: 4, name: 'Big Choco', style: 'Magie', color: 'var(--color-purple)' }
];

const brLobbies = [
    { id: 1, name: 'Tournoi Alpha', players: 14, max: 16, entry: 'Gratuit' },
    { id: 2, name: 'Deathmatch Express', players: 3, max: 8, entry: 'VIP' },
    { id: 3, name: 'Championnat Web3', players: 32, max: 32, entry: 'Premium' }
];

// --- GESTION DES LIENS URL ---
function checkURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const challengeId = urlParams.get('challenge');
    if(challengeId) {
        AppState.pendingChallengeParam = challengeId;
    }
    const inviteCode = urlParams.get('invite');
    if (inviteCode) {
        // Fetch pool by invite
        fetch(`${APP_CONFIG.API_BASE_URL}/pools/invite/${inviteCode}`)
            .then(res => {
                if(!res.ok) throw new Error("Poule introuvable");
                return res.json();
            })
            .then(pool => {
                document.getElementById('invite-message').innerText = `Vous êtes invité à la poule #${pool.id} (Mise: ${pool.entry_fee} TKN). Voulez-vous rejoindre ?`;
                document.getElementById('btn-accept-invite').onclick = () => {
                    stopInviteModalGuard();
                    document.getElementById('invite-modal').style.display = 'none';
                    joinPool(pool.id);
                };
                document.getElementById('invite-modal').style.display = 'flex';
                AppState.pendingInvitePoolId = pool.id;
                AppState.pendingInvitePoolMax = pool.max_players;
                startInviteModalGuard(pool.id, pool.max_players);
            })
            .catch(err => console.error(err));
    }
}

function copyInviteLink() {
    const link = document.getElementById('pool-invite-link').value;
    navigator.clipboard.writeText(link);
    showToast("Lien copié !", "success");
}

window.joinPoolByCode = function() {
    const input = document.getElementById('invite-code-input');
    if (input && input.value.trim() !== '') {
        const code = input.value.trim();
        fetch(`${APP_CONFIG.API_BASE_URL}/pools/invite/${code}`)
            .then(res => {
                if(!res.ok) throw new Error("Poule introuvable");
                return res.json();
            })
            .then(pool => {
                document.getElementById('invite-message').innerText = `Vous êtes invité à la poule #${pool.id} (Mise: ${pool.entry_fee} TKN). Voulez-vous rejoindre ?`;
                document.getElementById('btn-accept-invite').onclick = () => {
                    stopInviteModalGuard();
                    document.getElementById('invite-modal').style.display = 'none';
                    // No more automatic polling of BRLobby to prevent php artisan serve crash in tests.
                    // The user must click the refresh button manually or it will just be loaded once.
                    joinPool(pool.id);
                };
                document.getElementById('invite-modal').style.display = 'flex';
                AppState.pendingInvitePoolId = pool.id;
                AppState.pendingInvitePoolMax = pool.max_players;
                startInviteModalGuard(pool.id, pool.max_players);
            })
            .catch(err => {
                console.error(err);
                showToast("Code d'invitation invalide", "error");
            });
        input.value = '';
    }
}

// --- GARDE MODALE INVITE (fermeture auto si la poule se remplit) ---
let _inviteModalGuardInterval = null;
function startInviteModalGuard(poolId, maxPlayers) {
    stopInviteModalGuard();
    _inviteModalGuardInterval = setInterval(async () => {
        const modal = document.getElementById('invite-modal');
        if (!modal || modal.style.display === 'none') {
            stopInviteModalGuard();
            return;
        }
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}`);
            const poolData = await res.json();
            const count = poolData.players_count || 0;
            const isFull = (count >= maxPlayers) || (poolData.status !== 'open');
            if (isFull) {
                stopInviteModalGuard();
                const acceptBtn = document.getElementById('btn-accept-invite');
                if (acceptBtn) {
                    acceptBtn.disabled = true;
                    acceptBtn.textContent = 'Poule complète';
                }
                showToast('Cette poule est maintenant complète !', 'error');
                setTimeout(() => {
                    const m = document.getElementById('invite-modal');
                    if (m) m.style.display = 'none';
                    AppState.pendingInvitePoolId = null;
                    AppState.pendingInvitePoolMax = null;
                }, 1500);
            }
        } catch (e) {
            console.error('Invite guard error:', e);
        }
    }, 2000);
}
function stopInviteModalGuard() {
    if (_inviteModalGuardInterval) {
        clearInterval(_inviteModalGuardInterval);
        _inviteModalGuardInterval = null;
    }
}

// 3. FONCTIONS DE NAVIGATION ET D'INITIALISATION
function navigateTo(screenId) {
    // Compat : l'ancien lobby duel 'screen-duel' est fusionné dans 'screen-main'
    if (screenId === 'screen-duel') screenId = 'screen-main';
    
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (!target) {
        console.error("Écran introuvable :", screenId);
        return;
    }
    target.classList.add('active');
    AppState.currentScreen = screenId;
    lucide.createIcons();
    
    if(screenId === 'screen-main' && AppState.pendingChallengeParam) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = AppState.pendingChallengeParam;
            filterLobby(AppState.pendingChallengeParam);
        }
        AppState.pendingChallengeParam = null;
    }
}

// ============================================================
// NOUVEAU FLOW D'ENTRÉE : SPLASH → LANGUE → CONNEXION → MODE → PERSONNAGE
// ============================================================

// Étape 1 : Sélection de la langue
window.selectLanguage = function(lang) {
    AppState.language = lang;
    localStorage.setItem('web3combat_lang', lang);
    navigateTo('screen-connect');
};

// Étape 2 : Connexion du wallet (détection App 1 / Hardhat / MetaMask)
window.connectWallet = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const playerParam = urlParams.get('player');

    let savedWallet = localStorage.getItem('web3combat_wallet');
    let savedPk = localStorage.getItem('web3combat_pk');

    if (playerParam !== null) {
        savedWallet = null;
        savedPk = null;
    }

    let app1User = null;
    try {
        app1User = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (e) {
        app1User = null;
    }
    const app1Wallet = app1User && app1User.wallet_address ? app1User.wallet_address : null;

    if (playerParam === null && app1Wallet) {
        AppState.walletAddress = app1Wallet;
        AppState.privateKey = null;
    } else if (savedWallet && savedPk) {
        AppState.walletAddress = savedWallet;
        AppState.privateKey = savedPk;
    } else if (typeof HARDHAT_ACCOUNTS !== 'undefined' && HARDHAT_ACCOUNTS.length > 0) {
        let accIndex = 1;
        if (playerParam !== null && !isNaN(playerParam)) {
            accIndex = parseInt(playerParam);
            if (accIndex < 0 || accIndex >= HARDHAT_ACCOUNTS.length) accIndex = 1;
        } else {
            accIndex = Math.floor(Math.random() * 4) + 1;
        }
        const account = HARDHAT_ACCOUNTS[accIndex];
        AppState.walletAddress = account.address;
        AppState.privateKey = account.privateKey;
        if (playerParam === null) {
            localStorage.setItem('web3combat_wallet', account.address);
            localStorage.setItem('web3combat_pk', account.privateKey);
        }
    } else {
        showToast("Aucun wallet détecté. Connectez-vous via App 1 puis réessayez.", "error");
        return;
    }

    // Afficher le wallet connecté sur l'écran de connexion
    const statusBox = document.getElementById('wallet-status-box');
    const addrDisplay = document.getElementById('wallet-addr-display');
    if (statusBox) statusBox.style.display = 'block';
    if (addrDisplay) addrDisplay.textContent = AppState.walletAddress;

    showToast("Wallet connecté : " + AppState.walletAddress.substring(0, 6) + "...", "success");

    // Initialiser le provider Web3 (signataire déjà détecté)
    initWeb3();

    setTimeout(() => navigateTo('screen-mode'), 500);
};

// Étape 3 : Choix du mode de jeu
window.selectGameMode = function(mode) {
    AppState.selectedGameMode = mode;
    localStorage.setItem('web3combat_mode', mode);

    if (mode === 'SPIRIT') {
        // Le mode SPIRIT ouvre le menu du jeu Battle Pool (App 1)
        navigateTo('screen-spirit');
        return;
    }
    navigateTo('screen-character');
};

// Bouton retour : remonte d'un cran dans le flow
window.navGoBack = function() {
    const backMap = {
        'screen-language': 'screen-splash',
        'screen-connect': 'screen-language',
        'screen-mode': 'screen-connect',
        'screen-character': 'screen-mode',
        'screen-main': 'screen-character',
        'screen-br': 'screen-character',
        'screen-spirit': 'screen-mode',
        'screen-pool-room': 'screen-br',
        'screen-combat': 'screen-main'
    };
    const prev = backMap[AppState.currentScreen] || 'screen-splash';
    navigateTo(prev);
};

// Lancement du portail BATTLEPOOL (App 1) depuis l'écran SPIRIT
window.launchBattlePool = function() {
    const portalUrl = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.PORTAL_URL)
        ? APP_CONFIG.PORTAL_URL
        : `http://${window.location.hostname}:8090`;
    showToast("Ouverture de BATTLEPOOL (App 1)...", "info");
    setTimeout(() => { window.location.href = portalUrl; }, 400);
};

// Confirmation du personnage : enregistre puis lance la connexion finale
window.confirmCharacterSelection = function() {
    if (!AppState.selectedCharacter) return;
    localStorage.setItem('web3combat_char', AppState.selectedCharacter.id);
    performLogin();
};

// --- GÉNÉRATION ÉCRAN PERSONNAGES ---
let provider;
let signer;
let contract;

window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle-2';
    if (type === 'error') icon = 'alert-triangle';
    
    toast.innerHTML = `<i data-lucide="${icon}" width="20"></i> <span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.5s ease forwards";
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

window.changeCharacter = function() {
    localStorage.removeItem('web3combat_char');
    window.location.reload();
};

async function initWeb3() {
    const abi = typeof CONTRACT_ABI !== 'undefined' ? CONTRACT_ABI : (typeof COMBAT_GAME_ABI !== 'undefined' ? COMBAT_GAME_ABI : null);
    if (typeof ethers !== 'undefined' && abi) {
        // AUTH UNIFIÉE : si une clé privée locale existe (mode dev Hardhat), on l'utilise.
        // Sinon, on passe par le provider injecté (MetaMask déjà connecté par App 1).
        if (AppState.privateKey) {
            const providerUrl = "http://127.0.0.1:8545";
            provider = new ethers.JsonRpcProvider(providerUrl);
            signer = new ethers.Wallet(AppState.privateKey, provider);
        } else if (window.ethereum) {
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
        } else {
            showToast("Aucun wallet détecté. Connectez-vous via App 1 (wallet Web3) puis réessayez.", "error");
            return;
        }
        contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
        
        await initSessionKey();
        updateBalance();
        
        window.attemptReveal = async function() {
            if (AppState.isRevealing || AppState.hasRevealed) return;
            if (!AppState.currentMove || !AppState.currentSecret) {
                console.warn("attemptReveal ignoré : mouvement ou secret manquant.");
                return;
            }
            try {
                AppState.isRevealing = true;
                console.log("Révélation du mouvement au backend (Gasless)...");
                
                const res = await fetch(`${APP_CONFIG.API_BASE_URL}/battle/reveal`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify({
                        match_id: AppState.currentMatchId,
                        wallet_address: AppState.walletAddress,
                        move: AppState.currentMove,
                        secret: AppState.currentSecret
                    })
                });
                
                const data = await res.json();
                console.log("Backend Reveal OK:", data);
                
                AppState.hasRevealed = true;
            } catch(e) {
                console.error("Erreur lors de la révélation:", e);
            } finally {
                AppState.isRevealing = false;
            }
        };
    } else {
        console.error("Ethers.js ou ABI manquant.");
    }
}

async function initSessionKey() {
    let sessionPk = localStorage.getItem('web3combat_session_pk');
    if (!sessionPk) {
        const sw = ethers.Wallet.createRandom();
        sessionPk = sw.privateKey;
        localStorage.setItem('web3combat_session_pk', sessionPk);
    }
    AppState.sessionWallet = new ethers.Wallet(sessionPk);
    
    const message = "Commit: " + AppState.sessionWallet.address.toLowerCase(); // Wait, the AuthController checks: "Authorize session key: "
    const authMessage = "Authorize session key: " + AppState.sessionWallet.address.toLowerCase();
    
    let savedSignature = localStorage.getItem('web3combat_session_sig_' + AppState.walletAddress);
    
    if (!savedSignature) {
        showToast("Signature de la clé de session requise (MetaMask va s'ouvrir une seule fois)...", "info");
        savedSignature = await signer.signMessage(authMessage);
        localStorage.setItem('web3combat_session_sig_' + AppState.walletAddress, savedSignature);
        
        await fetch(`${APP_CONFIG.API_BASE_URL}/auth/session-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                wallet_address: AppState.walletAddress,
                session_public_key: AppState.sessionWallet.address,
                signature: savedSignature
            })
        });
        showToast("Clé de session autorisée ! Mode 100% sans Gas activé.", "success");
    } else {
        // Optionnel : s'assurer que le backend la connaît, on la renvoie silencieusement
        fetch(`${APP_CONFIG.API_BASE_URL}/auth/session-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                wallet_address: AppState.walletAddress,
                session_public_key: AppState.sessionWallet.address,
                signature: savedSignature
            })
        }).catch(e => console.error(e));
    }
}

async function refreshClaimable() {
    if (!contract || typeof contract.userBalances !== 'function') return;
    const container = document.getElementById('pending-funds-container');
    const amt = document.getElementById('pending-amount');
    if (!container || !amt) return;
    try {
        const pending = await contract.userBalances(AppState.walletAddress);
        if (pending > 0n) {
            container.style.display = 'block';
            amt.innerText = parseFloat(ethers.formatEther(pending)).toFixed(3);
        } else {
            container.style.display = 'none';
        }
    } catch (e) {
        console.error("Error fetching userBalances:", e);
    }
}

function updateBalance() {
    if(AppState.walletAddress) {
        provider.getBalance(AppState.walletAddress).then(bal => {
            const el = document.getElementById('wallet-balance');
            if(el) el.innerText = parseFloat(ethers.formatEther(bal)).toFixed(2) + " ETH";
        });
        
        refreshClaimable();
    }
}

async function claimPendingFunds() {
    if(!contract || !AppState.walletAddress) {
        showToast("Portefeuille non connecté.", "error");
        return;
    }
    try {
        // Lire le solde on-chain réel (userBalances du contrat CombatGame)
        if (typeof contract.userBalances !== 'function') {
            showToast("Fonction de réclamation indisponible.", "error");
            return;
        }
        const pending = await contract.userBalances(AppState.walletAddress);
        if (pending <= 0n) {
            showToast("Aucun fonds à réclamer.", "info");
            return;
        }
        // Obtenir le voucher signé par le backend (withdraw(amount, nonce, signature))
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/withdraw/voucher`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                wallet_address: AppState.walletAddress,
                amount_wei: pending.toString()
            })
        });
        const data = await res.json();
        if (!res.ok || !data.signature) {
            showToast("Bon de retrait refusé : " + (data.error || 'Erreur inconnue'), "error");
            return;
        }
        showToast("Transaction de retrait envoyée...", "info");
        const tx = await contract.withdraw(BigInt(data.amount), BigInt(data.nonce), data.signature);
        await tx.wait();
        showToast("Fonds récupérés avec succès !", "success");
        updateBalance();
    } catch (err) {
        console.error(err);
        showToast("Erreur lors de la récupération des fonds.", "error");
    }
}

function renderCharacterSelect() {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = `char-${char.id}`;
        card.onclick = () => selectCharacter(char);

        card.innerHTML = `
            <div class="char-avatar" style="background-color: ${char.color}">
                <i data-lucide="user" color="rgba(255,255,255,0.8)" width="32"></i>
            </div>
            <h3>${char.name}</h3>
            <p style="font-size: 0.75rem; color: var(--text-gray-400); margin-top: 0.25rem;">${char.style}</p>
        `;
        grid.appendChild(card);
    });
    lucide.createIcons();
}

function selectCharacter(char) {
    AppState.selectedCharacter = char;
    document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
    document.getElementById(`char-${char.id}`).classList.add('selected');
    const btn = document.getElementById('btn-confirm-char');
    btn.disabled = false;
    btn.classList.remove('disabled');
}

function performLogin() {
    window.gameConfig = { character: AppState.selectedCharacter.name };
    
    const urlParams = new URLSearchParams(window.location.search);
    const playerParam = urlParams.get('player');
    
    let savedWallet = localStorage.getItem('web3combat_wallet');
    let savedPk = localStorage.getItem('web3combat_pk');
    
    if (playerParam !== null) {
        // Ignorer le localStorage si un joueur spécifique est demandé via l'URL
        savedWallet = null;
        savedPk = null;
    }
    
    // --- AUTH UNIFIÉE : reprendre la session wallet d'App 1 (rock-paper-scissors) ---
    // App 1 stocke `user` (JSON avec wallet_address) + `auth_token` dans le localStorage.
    // Même domaine derrière le proxy => ce localStorage est partagé avec App 2.
    // L'identité d'App 2 est l'adresse wallet : on la reprend, sans toucher au token App 1.
    let app1User = null;
    try {
        app1User = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (e) {
        app1User = null;
    }
    const app1Wallet = app1User && app1User.wallet_address ? app1User.wallet_address : null;
    
    if (playerParam === null && app1Wallet) {
        AppState.walletAddress = app1Wallet;
        AppState.privateKey = null; // Pas de clé privée stockée : le provider injecté signera
    } else if (savedWallet && savedPk) {
        AppState.walletAddress = savedWallet;
        AppState.privateKey = savedPk;
    } else if (typeof HARDHAT_ACCOUNTS !== 'undefined' && HARDHAT_ACCOUNTS.length > 0) {
        let accIndex = 1; // Par défaut, joueur de test #1
        if (playerParam !== null && !isNaN(playerParam)) {
            accIndex = parseInt(playerParam);
            if (accIndex < 0 || accIndex >= HARDHAT_ACCOUNTS.length) accIndex = 1;
        } else {
            // Aléatoire entre 1 et 4 si non spécifié
            accIndex = Math.floor(Math.random() * 4) + 1;
        }
        
        const account = HARDHAT_ACCOUNTS[accIndex];
        AppState.walletAddress = account.address;
        AppState.privateKey = account.privateKey;
        
        if (playerParam === null) {
            localStorage.setItem('web3combat_wallet', account.address);
            localStorage.setItem('web3combat_pk', account.privateKey);
        }
    } else {
        showToast("Les clés Hardhat ne sont pas chargées. Veuillez générer le fichier hardhat_keys.js.", "error");
        return;
    }
    
    window.gameConfig.walletAddress = AppState.walletAddress;
    console.log("Wallet connecté :", AppState.walletAddress);

    // Initialisation du Provider Web3 et Contrat
    initWeb3();

    // Mise à jour du badge dans le Menu Principal
    document.getElementById('player-badge').innerHTML = `
        <div class="char-avatar" style="background-color: ${AppState.selectedCharacter.color}; width: 40px; height: 40px;">
            <i data-lucide="user" color="rgba(255,255,255,0.8)" width="24"></i>
        </div>
        <div class="player-badge-info">
            <div class="player-badge-name">${AppState.selectedCharacter.name} (${AppState.walletAddress.substring(0,6)}...)</div>
            <div class="player-badge-balance" id="wallet-balance">-- ETH</div>
            <div id="pending-funds-container" style="display:none; margin-top: 5px;">
                <button class="btn btn-challenge" style="font-size: 0.8rem; padding: 0.5rem;" onclick="claimPendingFunds()">
                    Réclamer <span id="pending-amount">0</span> ETH
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();

    // --- INITIALISATION LARAVEL ECHO / REVERB ---
    if (!window.echoInstance) {
        console.log("Tentative de connexion à Reverb...");

        window.echoInstance = new Echo({
            broadcaster: 'reverb',
            key: 'web3combat',
            wsHost: APP_CONFIG.REVERB_HOST,
            wsPort: APP_CONFIG.REVERB_PORT,
            wssPort: APP_CONFIG.REVERB_PORT,
            forceTLS: false,
            disableStats: true,
            enabledTransports: ['ws', 'wss'],
            authEndpoint: `${APP_CONFIG.API_BASE_URL}/broadcasting/auth`,
            auth: {
                headers: {
                    'X-Wallet-Address': AppState.walletAddress,
                    'Accept': 'application/json'
                }
            }
        });

        // S'abonner au Lobby
        console.log("=== REVERB: ABONNEMENT AU PRESENCE-LOBBY ===");
        window.echoInstance.join('presence-lobby')
            .here((users) => {
                console.log("=== REVERB: .here() reçu ===", users);
                onlinePlayers = users;
                renderDuelLobby();
            })
            .joining((user) => {
                console.log("=== REVERB: .joining() reçu ===", user);
                onlinePlayers.push(user);
                renderDuelLobby();
            })
            .leaving((user) => {
                console.log("=== REVERB: .leaving() reçu ===", user);
                onlinePlayers = onlinePlayers.filter(u => u.id !== user.id);
                renderDuelLobby();
            })
            .listen('PlayerStatusChanged', (e) => {
                console.log("=== REVERB: .listen(PlayerStatusChanged) ===", e);
                const playerIndex = onlinePlayers.findIndex(u => u.id === e.playerId);
                if (playerIndex !== -1) {
                    onlinePlayers[playerIndex].status = e.status;
                    renderDuelLobby();
                }
            })
            .error((error) => {
                console.error("=== REVERB: ERREUR D'ABONNEMENT ===", error);
            });

        // S'abonner au canal privé
        window.echoInstance.private(`private-player.${AppState.walletAddress}`)
            .listen('ChallengeSent', (e) => {
                console.log("Défi reçu de :", e.challengerId, "Pari :", e.betAmount);
                AppState.currentChallenger = e.challengerId;
                AppState.currentBetAmountOffchain = e.betAmount;
                AppState.currentChallengerChar = e.challengerChar || 2;
                
                const shortId = e.challengerId.substring(0,6) + '...' + e.challengerId.substring(e.challengerId.length - 4);
                document.getElementById('challenge-text').innerText = `${shortId} vous met au défi pour ${e.betAmount} ETH !`;
                
                const actions = document.getElementById('challenge-modal-actions');
                if (actions) actions.style.display = 'flex';
                document.getElementById('challenge-modal').style.display = 'flex';
            })
            .listen('MatchStarted', (e) => {
                console.log("Accord Off-Chain atteint ! Exécution On-Chain...", e);
                window.gameConfig.matchId = e.matchId;
                if (e.betAmount) AppState.currentBetAmountOffchain = e.betAmount;
                
                // Déterminer qui est le challenger et qui est le target pour assigner le bon personnage adverse
                const isChallenger = (AppState.walletAddress.toLowerCase() === e.player1.toLowerCase());
                AppState.opponentChar = "p" + (isChallenger ? (e.p2Char || 2) : (e.p1Char || 2));
                
                executeMatchOnChain(e);
            })
            .listen('ChallengeDeclined', (e) => {
                console.log("Défi refusé par :", e.targetId);
                if (!e.isNegotiation) {
                    showToast("L'adversaire a refusé votre défi.", "error");
                }
                const btn = document.getElementById(`btn-chal-${e.targetId}`);
                if (btn) {
                    btn.className = 'btn btn-challenge';
                    btn.innerHTML = 'Défier';
                    btn.disabled = false;
                    lucide.createIcons();
                }
            });
    }

    if (AppState.pendingPoolParam) {
        joinPool(AppState.pendingPoolParam);
        AppState.pendingPoolParam = null;
    }

    // Afficher le badge joueur (masqué par défaut dans le HTML)
    const badge = document.getElementById('player-badge');
    if (badge) badge.style.display = 'flex';

    // Navigation selon le mode choisi dans le nouveau flow
    if (AppState.selectedGameMode === 'BATTLE') {
        navigateTo('screen-br');
        renderBRLobby();
    } else if (AppState.selectedGameMode === 'SPIRIT') {
        navigateTo('screen-spirit');
    } else {
        navigateTo('screen-main');
    }
    if (window.godotSpawnPlayer) {
        window.godotSpawnPlayer("p" + AppState.selectedCharacter.id);
    }
}

// --- CONFIRMATION ET CONNEXION WEB3/REVERB ---
document.getElementById('btn-confirm-char').addEventListener('click', () => {
    window.confirmCharacterSelection();
});


// --- GÉNÉRATION ÉCRAN DUEL ET RECHERCHE ---
function renderDuelLobby(playersToRender = onlinePlayers) {
    const list = document.getElementById('players-list');
    list.innerHTML = '';

    if (playersToRender.length === 0) {
        list.innerHTML = '<p class="empty-state">Aucun combattant trouvé.</p>';
        return;
    }

    playersToRender.forEach(player => {
        if (player.id === AppState.walletAddress) return; // Ne pas s'afficher

        const card = document.createElement('div');
        card.className = 'player-card';
        const shortId = player.id.substring(0,6) + '...' + player.id.substring(player.id.length - 4);
        
        let cardStyle = "";
        let buttonHtml = `<button class="btn btn-challenge" id="btn-chal-${player.id}" onclick="openBetModal('${player.id}')">Défier</button>`;
        if (player.status === 'in-game') {
            cardStyle = "opacity: 0.5; filter: grayscale(100%); pointer-events: none;";
            buttonHtml = `<button class="btn btn-waiting" id="btn-chal-${player.id}" disabled><i data-lucide="swords" width="16" height="16" style="margin-right: 0.5rem"></i> En combat</button>`;
        }

        card.innerHTML = `
            <div class="player-info" style="${cardStyle}">
                <h3>${player.name}</h3>
                <p>${shortId}</p>
            </div>
            ${buttonHtml}
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}
window.resetMatchState = function() {
    stopVisibleTimer();
    stopUnifiedMatchPolling();
    AppState.currentMatchId = null;
    AppState.hasCommitted = false;
    AppState.hasRevealed = false;
    AppState.currentMove = null;
    AppState.currentSecret = null;
    AppState.opponentChar = null;
    AppState.lastActionTime = null;
    AppState.matchDeadline = null;
    AppState.timeoutRequested = false;
    AppState.currentChallenger = null;
    AppState.currentTargetId = null; // Reset so bye-player guard works next round
    
    // Réafficher l'UI Web
    const overlay = document.getElementById('ui-overlay');
    if (overlay) overlay.classList.remove('hidden');
    
    // Nettoyer l'adversaire dans Godot
    if (window.godotClearOpponent) {
        window.godotClearOpponent();
    }
    
    fetch(`${APP_CONFIG.API_BASE_URL}/matchmaking/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ player_id: AppState.walletAddress, status: 'online' })
    }).catch(e => console.error(e));
    
    if (AppState.currentPoolId) {
        renderPoolRoom();
    } else {
        renderDuelLobby();
    }
    
    updateBalance();
};

window.quitGodot = function() {
    if(confirm("Voulez-vous vraiment quitter le jeu et retourner au lobby ?")) {
        resetMatchState();
        navigateTo('screen-main');
    }
};

function filterLobby(query) {
    const lowerQuery = query.toLowerCase().trim();
    if(lowerQuery === "") {
        renderDuelLobby(onlinePlayers);
        return;
    }
    
    const filteredPlayers = onlinePlayers.filter(player => 
        player.name.toLowerCase().includes(lowerQuery) || 
        player.id.toLowerCase().includes(lowerQuery)
    );
    
    renderDuelLobby(filteredPlayers);
}

// --- GESTION DU SCANNER QR CODE ---
let html5QrcodeScanner = null;

function openQRScanner() {
    document.getElementById('qr-modal').style.display = 'flex';
    if (typeof Html5QrcodeScanner !== 'undefined') {
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 200, height: 200} }, false);
        html5QrcodeScanner.render(onScanSuccess, () => {});
    } else {
        alert("Le scanner QR n'a pas pu être chargé.");
    }
}

function closeQRScanner() {
    document.getElementById('qr-modal').style.display = 'none';
    if(html5QrcodeScanner) html5QrcodeScanner.clear();
}

function onScanSuccess(decodedText) {
    closeQRScanner();
    document.getElementById('search-input').value = decodedText;
    filterLobby(decodedText);
}

// --- GESTION DE LA MODALE DE PARI ---
function openBetModal(playerId) {
    AppState.currentTargetId = playerId;
    const targetPlayer = onlinePlayers.find(p => p.id === playerId);
    const targetName = targetPlayer ? targetPlayer.name : "Adversaire";
    document.getElementById('bet-target-name').innerText = targetName;
    document.getElementById('bet-amount').value = AppState.defaultBetAmount || "10";
    
    let maxBet = localStorage.getItem(`web3combat_max_bet_${AppState.walletAddress}`) || '0';
    let minBet = localStorage.getItem(`web3combat_min_bet_${AppState.walletAddress}`) || '0';
    
    const statsEl = document.getElementById('bet-stats');
    if (statsEl) {
        statsEl.innerText = `Mise Max : ${maxBet} ETH | Mise Min : ${minBet > 0 ? minBet : '--'} ETH`;
    }
    
    document.getElementById('bet-modal').style.display = 'flex';
}

function setBetAmount(amount) {
    document.getElementById('bet-amount').value = amount;
}

function closeBetModal() {
    document.getElementById('bet-modal').style.display = 'none';
    AppState.currentTargetId = null;
}

function confirmBetAndChallenge() {
    const betAmount = document.getElementById('bet-amount').value;
    
    if(!betAmount || isNaN(betAmount) || Number(betAmount) <= 0) {
        showToast("Veuillez entrer un montant valide.", "error");
        return;
    }

    let maxBet = localStorage.getItem(`web3combat_max_bet_${AppState.walletAddress}`) || '0';
    let minBet = localStorage.getItem(`web3combat_min_bet_${AppState.walletAddress}`) || '0';
    
    if (Number(betAmount) > Number(maxBet)) localStorage.setItem(`web3combat_max_bet_${AppState.walletAddress}`, betAmount);
    if (Number(minBet) === 0 || Number(betAmount) < Number(minBet)) localStorage.setItem(`web3combat_min_bet_${AppState.walletAddress}`, betAmount);

    localStorage.setItem('web3combat_bet_amount', betAmount);
    AppState.defaultBetAmount = betAmount;

    const targetId = AppState.currentTargetId;
    closeBetModal();

    initiateChallenge(targetId, betAmount);
}

// Envoi d'un défi via API (Off-Chain)
async function initiateChallenge(playerId, betAmount) {
    const btn = document.getElementById(`btn-chal-${playerId}`);
    if(btn) {
        btn.className = 'btn btn-waiting';
        btn.innerHTML = '<i data-lucide="loader-2" width="16" height="16" style="margin-right: 0.5rem"></i> Envoi...';
        btn.disabled = true;
        lucide.createIcons();
    }

    try {
        const response = await fetch(`${APP_CONFIG.API_BASE_URL}/matchmaking/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                challenger_id: AppState.walletAddress,
                target_id: playerId,
                bet_amount: betAmount,
                challenger_char: AppState.selectedCharacter.id
            })
        });

        if (response.ok) {
            if(btn) {
                btn.innerHTML = '<i data-lucide="loader-2" width="16" height="16" style="margin-right: 0.5rem"></i> Attente Adv...';
                lucide.createIcons();
            }
        } else {
            throw new Error("API error");
        }
    } catch (e) {
        console.error(e);
        if(btn) {
            btn.className = 'btn btn-challenge';
            btn.innerHTML = 'Défier';
            btn.disabled = false;
        }
        showToast("Erreur lors de l'envoi du défi.", "error");
    }
}

// --- MODALE DE DÉFI (RÉCEPTION) ---
document.getElementById('btn-accept-challenge').addEventListener('click', async () => {
    document.getElementById('challenge-modal-actions').style.display = 'none';
    document.getElementById('challenge-text').innerText = "Acceptation en cours...";
    
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE_URL}/matchmaking/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                challenger_id: AppState.currentChallenger,
                target_id: AppState.walletAddress,
                bet_amount: AppState.currentBetAmountOffchain,
                target_char: AppState.selectedCharacter.id,
                challenger_char: AppState.currentChallengerChar || 2
            })
        });
        
        if (!response.ok) throw new Error("Erreur serveur");
        document.getElementById('challenge-text').innerText = "Attente du dépôt de l'adversaire sur la blockchain...";
    } catch(e) {
        console.error(e);
        document.getElementById('challenge-modal').style.display = 'none';
        showToast("Erreur lors de l'acceptation.", "error");
    }
});

document.getElementById('btn-modify-challenge').addEventListener('click', () => {
    document.getElementById('challenge-modal').style.display = 'none';
    
    // Decline the current off-chain offer silently with is_negotiation = true
    fetch(`${APP_CONFIG.API_BASE_URL}/matchmaking/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ challenger_id: AppState.currentChallenger, target_id: AppState.walletAddress, is_negotiation: true })
    });
    
    // Open bet modal targeting the challenger
    openBetModal(AppState.currentChallenger);
});

document.getElementById('btn-decline-challenge').addEventListener('click', async () => {
    document.getElementById('challenge-modal').style.display = 'none';
    
    try {
        await fetch(`${APP_CONFIG.API_BASE_URL}/matchmaking/decline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                challenger_id: AppState.currentChallenger,
                target_id: AppState.walletAddress
            })
        });
    } catch (e) { console.error(e); }

    AppState.currentChallenger = null;
});

// --- EXÉCUTION ON-CHAIN (Devenu Gasless via Backend) ---
async function depositForMatch(amountEth) {
    if (!contract || !AppState.walletAddress || !amountEth || Number(amountEth) <= 0) return false;
    try {
        showToast(`Dépôt de ${amountEth} ETH sur la blockchain...`, "info");
        const stakeWei = ethers.parseEther(String(amountEth));
        // Commission serveur (2,5 % par défaut, reconfigurable via feeBps sur le contrat)
        const feeBps = typeof contract.feeBps === 'function' ? Number(await contract.feeBps()) : 250;
        const feeWei = stakeWei * BigInt(feeBps) / 10000n;
        const totalWei = stakeWei + feeWei;
        showToast(`Dépôt de ${amountEth} ETH (mise) + ${ethers.formatEther(feeWei)} ETH (frais)...`, "info");
        const tx = await contract.register(stakeWei, { value: totalWei });
        await tx.wait();
        showToast("Dépôt confirmé sur la blockchain !", "success");
        updateBalance();
        return true;
    } catch (err) {
        console.error("Erreur de dépôt:", err);
        showToast("Échec du dépôt on-chain : " + (err.shortMessage || err.message || "erreur"), "error");
        return false;
    }
}

// Dépôt de la mise d'entrée DANS L'ESCROW de la poule (winner-take-all).
// Utilise registerForPool (le stake est verrouillé dans la pool), pas register (duel).
async function depositForPool(poolId, amountEth) {
    if (!contract || !AppState.walletAddress || !poolId || !amountEth || Number(amountEth) <= 0) return false;
    try {
        showToast(`Dépôt de ${amountEth} ETH dans l'escrow de la poule...`, "info");
        const stakeWei = ethers.parseEther(String(amountEth));
        const feeBps = typeof contract.feeBps === 'function' ? Number(await contract.feeBps()) : 250;
        const feeWei = stakeWei * BigInt(feeBps) / 10000n;
        const totalWei = stakeWei + feeWei;
        showToast(`Escrow +${amountEth} ETH (mise) + ${ethers.formatEther(feeWei)} ETH (frais)...`, "info");
        const tx = await contract.registerForPool(BigInt(poolId), stakeWei, { value: totalWei });
        await tx.wait();
        showToast("Mise verrouillée dans l'escrow de la poule !", "success");
        updateBalance();
        return true;
    } catch (err) {
        console.error("Erreur de dépôt en poule:", err);
        showToast("Échec du dépôt en poule : " + (err.shortMessage || err.message || "erreur"), "error");
        return false;
    }
}

// Le champion réclame l'intégralité du pot de la poule (winner-take-all) en une seule tx,
// via un voucher signé par le backend pour claimPool.
async function claimPoolGains(poolId, winnerAddress) {
    if (!contract || !AppState.walletAddress) return;
    if (poolId === null || poolId === undefined) return;
    if (AppState.claimingPool) return;
    AppState.claimingPool = true;
    try {
        const pool = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}`).then(r => r.json());
        const winnerWallet = pool.players ? pool.players.find(p => p.status === 'alive') : null;
        if (!winnerWallet || winnerWallet.wallet_address.toLowerCase() !== AppState.walletAddress.toLowerCase()) {
            showToast("Seul le champion peut réclamer le pot.", "error");
            return;
        }
        const totalWei = await contract.poolTotal(BigInt(poolId));
        if (totalWei <= 0n) {
            showToast("Aucun pot à réclamer (déjà réglé ?).", "info");
            return;
        }
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/withdraw/claim-pool-voucher`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                pool_id: Number(poolId),
                winner_address: AppState.walletAddress,
                amount_wei: totalWei.toString()
            })
        });
        const data = await res.json();
        if (!res.ok || !data.signature) {
            showToast("Bon du pot refusé : " + (data.error || 'Erreur inconnue'), "error");
            return;
        }
        showToast("Réclamation du pot en cours...", "info");
        const tx = await contract.claimPool(BigInt(data.pool_id), BigInt(data.amount), BigInt(data.nonce), data.signature);
        await tx.wait();
        showToast(`🏆 Pot de ${ethers.formatEther(totalWei)} ETH récupéré !`, "success");
        AppState.claimingPool = false;
        updateBalance();
        return;
    } catch (err) {
        console.error("Erreur claim pool:", err);
        showToast("Erreur lors de la réclamation du pot.", "error");
    } finally {
        AppState.claimingPool = false;
    }
}

async function executeMatchOnChain(e) {
    const isChallenger = (e.player1.toLowerCase() === AppState.walletAddress.toLowerCase());
    const opponent = isChallenger ? e.player2 : e.player1;
    
    document.getElementById('challenge-text').innerText = "Match validé ! Dépôt et lancement du combat...";
    document.getElementById('challenge-modal-actions').style.display = 'none';
    
    AppState.currentMatchId = e.matchId;
    AppState.currentTargetId = opponent;
    
    // Si on a l'info du perso de l'adversaire via l'event (clés camelCase du broadcast Reverb)
    if (isChallenger) {
        AppState.opponentChar = "p" + (e.p2Char || 2);
        AppState.myChar = "p" + (e.p1Char || 2);
    } else {
        AppState.opponentChar = "p" + (e.p1Char || 2);
        AppState.myChar = "p" + (e.p2Char || 2);
    }

    // Dépôt on-chain de la mise (escrow) au lancement du match
    const betAmount = AppState.currentBetAmountOffchain || AppState.defaultBetAmount || '0';
    await depositForMatch(betAmount);

    setTimeout(() => {
        document.getElementById('challenge-modal').style.display = 'none';
        AppState.lastActionTime = Date.now();
        launchGodot(opponent);
    }, 1000);
}


// --- GÉNÉRATION ÉCRAN BATTLE ROYALE ---
async function renderBRLobby() {
    const list = document.getElementById('br-list');
    list.innerHTML = '<p class="empty-state">Recherche de poules...</p>';

    try {
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/pools`);
        const pools = await res.json();
        
        list.innerHTML = '';
        if (pools.length === 0) {
            list.innerHTML = '<p class="empty-state">Aucune poule publique ouverte.</p>';
            return;
        }

        pools.forEach(lobby => {
            const isFull = lobby.players_count >= lobby.max_players;
            const progress = (lobby.players_count / lobby.max_players) * 100;
            
            const card = document.createElement('div');
            card.className = 'br-card';
            card.innerHTML = `
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <div class="br-header">
                    <div>
                        <h3 style="color: white; font-size: 1.1rem;">Poule #${lobby.id} ${lobby.penalty_mode == 1 ? '(All-In)' : ''}</h3>
                        <span class="br-tag">${lobby.entry_fee} TKN</span>
                    </div>
                    <div class="br-players">
                        <span>${lobby.players_count}</span>
                        <span style="color: var(--text-gray-400)">/${lobby.max_players}</span>
                    </div>
                </div>
                <button class="btn btn-join ${isFull ? 'full' : ''}" ${isFull ? 'disabled' : ''} onclick="joinPool(${lobby.id})">
                    ${isFull ? 'Salon Complet' : 'Rejoindre la file'}
                </button>
            `;
            list.appendChild(card);
        });
    } catch(e) {
        list.innerHTML = '<p class="empty-state">Erreur de connexion.</p>';
    }
}

// --- LANCEMENT DU JEU GODOT ---
// (Le moteur Godot est maintenant chargé nativement depuis index.html au lancement de la page)

function launchGodot(targetId) {
    console.log("Lancement du combat contre :", targetId);
    
    // Fermer la modale pour qu'elle ne bloque pas le jeu
    const challengeModal = document.getElementById('challenge-modal');
    if (challengeModal) challengeModal.style.display = 'none';

    // Si c'est BR_MODE, c'est juste un test, sinon on informe l'UI que le défi a été accepté
    if (targetId !== 'BR_MODE') {
        const btn = document.getElementById(`btn-chal-${targetId}`);
        if (btn) {
            btn.className = 'btn btn-accepted';
            btn.innerHTML = '<i data-lucide="check-circle-2" width="16" height="16" style="margin-right: 0.5rem"></i> Accepté !';
            lucide.createIcons();
        }
    }

    // Masquer complètement l'UI Web pour afficher Godot au premier plan
    const overlay = document.getElementById('ui-overlay');
    if (overlay) overlay.classList.add('hidden');

    if (window.godotSpawnOpponent) {
        window.godotSpawnOpponent("p" + (AppState.opponentChar ? AppState.opponentChar.replace('p','') : "2"));
    }
    if (window.godotSpawnPlayer) {
        window.godotSpawnPlayer("p" + (AppState.myChar ? AppState.myChar.replace('p','') : AppState.selectedCharacter.id));
    }

    // Commencer le polling immédiatement pour s'assurer de recevoir les timeouts ou la fin de match
    startUnifiedMatchPolling();

    // Afficher le compte à rebours par-dessus Godot (après le polling pour ne pas être masqué).
    // Provisoire local ; recalé sur la deadline serveur fixe dès le 1er polling.
    startVisibleTimer(fightTimeoutSeconds());
}

function endCombatSimulation() {
    navigateTo('screen-main');
}

// --- PONT GODOT <-> JAVASCRIPT ---

// Appelé par Godot au lancement de la scène
window.onGodotReady = function() {
    console.log("Godot est prêt !");
    if (AppState.selectedCharacter) {
        if (window.godotSpawnPlayer) {
            window.godotSpawnPlayer("p" + AppState.selectedCharacter.id);
        }
    }
};

// Règlement winner-takes-all : le gagnant transfère l'escrow du perdant vers lui
async function settleMatchOnWin(godotResult) {
    if (godotResult !== 1) return;
    const loser = AppState.currentTargetId;
    if (!loser || !contract || !AppState.walletAddress) return;
    try {
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/withdraw/settle-voucher`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                winner_address: AppState.walletAddress,
                loser_address: loser
            })
        });
        const data = await res.json();
        if (!res.ok || !data.signature) {
            showToast("Bon de règlement refusé : " + (data.error || 'Erreur inconnue'), "error");
            return;
        }
        showToast("Règlement on-chain en cours (transfert de la mise adverse)...", "info");
        const tx = await contract.settleLoser(data.winner, data.loser, data.signature);
        await tx.wait();
        showToast("Pot consolidé ! Vous pouvez réclamer vos gains.", "success");
        updateBalance();
    } catch (err) {
        console.error("Erreur lors du règlement:", err);
    }
}

window.animationFinished = function() {
    console.log("Animation de combat terminée !");
    
    if (!AppState.pendingResult) {
        console.log("animationFinished ignoré car pas de pendingResult.");
        return;
    }

    const { godotResult, ethPayout } = AppState.pendingResult;
    
    if (godotResult === 1) {
        showToast(`Victoire ! Vous avez gagné ${ethPayout} ETH !`, 'success');
    } else if (godotResult === 0) {
        showToast(`Égalité ! Vous récupérez votre mise.`, 'info');
    } else {
        showToast(`Défaite... Vous avez perdu le match.`, 'error');
    }

    // Le perdant n'a rien à réclamer : masquer le bouton claim immédiatement.
    // Pour les autres, le solde à réclamer est re-synchronisé plus bas.
    if (godotResult === 2) {
        const claimContainer = document.getElementById('pending-funds-container');
        if (claimContainer) claimContainer.style.display = 'none';
    }
    updateBalance();

    // Winner-takes-all : consolider l'escrow (mise du perdant -> gagnant).
    // Uniquement en duel : en poule, le serveur consolide tout le pot à la fin.
    if (!AppState.currentPoolId) {
        settleMatchOnWin(godotResult);
    }
    
    if (AppState.currentPoolId) {
        checkPoolElimination(godotResult, AppState.currentMatchId);
    }

    // Le règlement on-chain (settleLoser) peut prendre quelques secondes :
    // re-synchroniser le solde à réclamer pour masquer/afficher le claim correctement
    (async () => {
        for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 2500));
            await refreshClaimable();
        }
    })();

    // Réinitialisation complète des états (incluant le statut serveur online)
    resetMatchState();
    navigateTo(AppState.currentPoolId ? 'screen-pool-room' : 'screen-main');
    
    AppState.pendingResult = null;
    
    // Traiter le prochain round s'il était en attente
    if (AppState.pendingPoolRoundEvent) {
        console.log("Traitement du round mis en attente...");
        const e = AppState.pendingPoolRoundEvent;
        AppState.pendingPoolRoundEvent = null;
        setTimeout(() => handlePoolRoundStarted(e), 1500); // Petit délai pour laisser l'UI respirer
    }
};

window.getMatchInfo = function() {
    let opponentAddr = AppState.currentTargetId || AppState.currentChallenger || "0xOpponent";
    return {
        my_char: "p" + AppState.selectedCharacter.id,
        opponent_char: AppState.opponentChar || "p2",
        my_name: AppState.walletAddress.substring(0,6),
        opponent_name: opponentAddr.substring(0,6)
    };
};

// Appelé par Godot quand le joueur fait un choix (1=Pierre, 2=Feuille, 3=Ciseaux)
window.submitMove = async function(moveNum) {
    console.log("Godot a soumis le mouvement :", moveNum);
    
    if (AppState.hasCommitted) {
        console.log("Mouvement déjà soumis.");
        return;
    }

    if (AppState.currentMatchId) {
        try {
            const move = parseInt(moveNum);
            if(isNaN(move) || move < 1 || move > 3) {
                showToast("Mouvement invalide retourné par Godot: " + moveNum, "error");
                return;
            }

            const randomBytes = new Uint8Array(16);
            window.crypto.getRandomValues(randomBytes);
            const secret = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            
            AppState.currentSecret = secret;
            AppState.currentMove = move;

            if (!AppState.sessionWallet) {
                await initSessionKey();
            }

            const hash = ethers.solidityPackedKeccak256(["uint8", "string"], [move, secret]);
            const messageToSign = "Commit: " + hash;
            const sessionSignature = await AppState.sessionWallet.signMessage(messageToSign);

            console.log("Envoi au backend pour validation (Gasless)...");
            fetch(`${APP_CONFIG.API_BASE_URL}/battle/commit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                    match_id: AppState.currentMatchId,
                    wallet_address: AppState.walletAddress,
                    commit_hash: hash,
                    signature: sessionSignature
                })
            }).then(res => res.json())
              .then(data => {
                  console.log("Backend Commit OK:", data);
                  if(data.fight_status === 'waiting_for_reveals') {
                      window.attemptReveal();
                  }
              })
              .catch(e => console.error("Erreur Backend Commit:", e));

            // Réinitialiser la fenêtre de timeout à la soumission du coup
            AppState.lastActionTime = Date.now();

            AppState.hasCommitted = true;

            startUnifiedMatchPolling();

        } catch (e) {
            console.error("Erreur Web3 (Commit/Reveal) :", e);
        }
    }
};

// --- TIMER VISIBLE (compte à rebours ancré sur la deadline serveur, identique pour tous) ---
let _timerInterval = null;
let _timerDeadline = null;

function fightTimeoutSeconds() {
    return AppState.fightTimeoutMs ? Math.round(AppState.fightTimeoutMs / 1000) : 60;
}

function startVisibleTimer(durationSeconds = 60) {
    // Compte à rebours provisoire local ; sera recalé sur la deadline serveur dès le 1er polling
    _timerDeadline = Date.now() + durationSeconds * 1000;
    _runVisibleTimer();
}

function syncVisibleTimerToDeadline(deadlineMs) {
    if (!deadlineMs) return;
    _timerDeadline = deadlineMs;
    _runVisibleTimer();
}

function _runVisibleTimer() {
    if (_timerInterval) {
        clearInterval(_timerInterval);
        _timerInterval = null;
    }
    const overlay = document.getElementById('turn-timer-overlay');
    const display = document.getElementById('timer-seconds');
    if (!overlay || !display || !_timerDeadline) return;

    const tick = () => {
        const remaining = Math.max(0, Math.ceil((_timerDeadline - Date.now()) / 1000));
        display.textContent = remaining;
        overlay.classList.toggle('timer-urgent', remaining <= 10);
        if (remaining <= 0) stopVisibleTimer();
    };
    overlay.classList.remove('hidden');
    tick();
    _timerInterval = setInterval(tick, 1000);
}

function stopVisibleTimer() {
    if (_timerInterval) {
        clearInterval(_timerInterval);
        _timerInterval = null;
    }
    _timerDeadline = null;
    const overlay = document.getElementById('turn-timer-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('timer-urgent');
    }
}

function stopUnifiedMatchPolling() {
    window._isPolling = false;
    if (window._unifiedMatchPollInterval) {
        clearInterval(window._unifiedMatchPollInterval);
        window._unifiedMatchPollInterval = null;
    }
}

function startUnifiedMatchPolling() {
    stopUnifiedMatchPolling();
    
    window._unifiedMatchPollInterval = setInterval(async () => {
        if (!AppState.currentMatchId || AppState.pendingResult) {
            stopUnifiedMatchPolling();
            return;
        }
        if (window._isPolling) return;
        window._isPolling = true;

        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/battle/status/${AppState.currentMatchId}`);
            const data = await res.json();
            const currentStatus = data.fight_status || data.status;

            // Recaler le timer sur la deadline serveur absolue (identique pour tous les joueurs)
            if (data.deadline && data.deadline !== AppState.matchDeadline) {
                AppState.matchDeadline = data.deadline;
                syncVisibleTimerToDeadline(data.deadline);
            }
            if (data.timeout_ms) {
                AppState.fightTimeoutMs = data.timeout_ms;
            }

            if (currentStatus === 'waiting_for_commits' || currentStatus === 'waiting_for_reveals') {
                const now = Date.now();
                const deadline = AppState.matchDeadline || (AppState.lastActionTime ? AppState.lastActionTime + (AppState.fightTimeoutMs || 60000) : now + (AppState.fightTimeoutMs || 60000));
                if (!AppState.timeoutRequested && now >= deadline) {
                    AppState.timeoutRequested = true;
                    console.log("Deadline atteinte, demande de résolution forcée...");
                    try {
                        await fetch(`${APP_CONFIG.API_BASE_URL}/battle/timeout`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ match_id: AppState.currentMatchId })
                        });
                    } catch(e) {
                        console.error("Erreur appel timeout:", e);
                        // On retente au prochain tick si l'appel a échoué
                        AppState.timeoutRequested = false;
                    }
                }
            }

            if (currentStatus === 'waiting_for_reveals' && !AppState.hasRevealed) {
                await window.attemptReveal();
            }

            if (currentStatus === 'completed' || currentStatus === 'finished') {
                stopUnifiedMatchPolling();
                stopVisibleTimer();
                const wallet = AppState.walletAddress.toLowerCase();
                
                let godotResult = 0;
                if (!data.winner_wallet) {
                    godotResult = 0;
                } else if (data.winner_wallet.toLowerCase() === wallet) {
                    godotResult = 1;
                } else {
                    godotResult = 2;
                }

                AppState.pendingResult = {
                    godotResult: godotResult,
                    ethPayout: data.payout
                };

                let opponentMoveRaw = null;
                if (data.player1_wallet && data.player1_wallet.toLowerCase() === wallet) {
                    opponentMoveRaw = data.player2_move;
                } else {
                    opponentMoveRaw = data.player1_move;
                }

                // Le backend renvoie le move sous forme d'entier (1/2/3) ou null si l'adversaire n'a pas joué
                let opponentMoveInt = 0;
                if (opponentMoveRaw !== null && opponentMoveRaw !== undefined && opponentMoveRaw !== '') {
                    opponentMoveInt = parseInt(opponentMoveRaw, 10);
                    if (isNaN(opponentMoveInt)) opponentMoveInt = 0;
                }

                if (window.receiveMatchResult) {
                    window.receiveMatchResult(godotResult, opponentMoveInt);
                }

                setTimeout(() => {
                    if (AppState.pendingResult && typeof window.animationFinished === 'function') {
                        window.animationFinished();
                    }
                }, 4000);
            }
        } catch(e) {
            console.error("Polling error:", e);
        } finally {
            window._isPolling = false;
        }
    }, 2000);
}


// --- INITIALISATION AU CHARGEMENT ---
document.addEventListener('DOMContentLoaded', () => {
    checkURLParameters();
    lucide.createIcons();
    renderCharacterSelect();
    renderDuelLobby();
    renderBRLobby();

    // Récupérer la configuration de jeu (durée du round) pour le compte à rebours
    fetch(`${APP_CONFIG.API_BASE_URL}/game-config`)
        .then(res => res.ok ? res.json() : null)
        .then(cfg => {
            if (cfg && cfg.fight_timeout_ms) {
                AppState.fightTimeoutMs = cfg.fight_timeout_ms;
            }
        })
        .catch(() => {});
    
    // Pré-sélection du personnage sauvegardé (sans connexion auto)
    const savedCharId = localStorage.getItem('web3combat_char');
    if (savedCharId) {
        const char = characters.find(c => c.id == savedCharId);
        if (char) {
            selectCharacter(char);
        }
    }

    // NOUVEAU FLOW : splash (2.5s) → sélection de la langue
    // (screen-splash est l'écran actif par défaut dans le HTML)
    setTimeout(() => {
        navigateTo('screen-language');
    }, 2600);
});

// --- POULE / BATTLE ROYALE LOGIC ---

function openCreatePoolModal() {
    document.getElementById('create-pool-modal').style.display = 'flex';
}

function closeCreatePoolModal() {
    document.getElementById('create-pool-modal').style.display = 'none';
}

async function confirmCreatePool() {
    const fee = document.getElementById('pool-entry-fee').value;
    const max = document.getElementById('pool-max-players').value;
    const mode = document.getElementById('pool-penalty-mode').value;
    const isPrivate = document.getElementById('pool-is-private').checked;
    
    if(!fee || isNaN(fee) || Number(fee) <= 0) return showToast("Mise invalide", "error");
    
    try {
        closeCreatePoolModal();
        showToast("Création et adhésion à la poule...", "info");
        
        // Register on backend
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/pools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                entry_fee: Number(fee),
                max_players: Number(max),
                penalty_mode: Number(mode),
                is_private: isPrivate,
                owner_wallet: AppState.walletAddress
            })
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error("Failed to create pool on backend: " + errText);
        }
        const createdPool = await res.json();

        // Join pool in backend automatically via create (or explicit join endpoint)
        // Since Laravel is managing it, we assume we need to call join endpoint
        const poolId = createdPool.pool.id;
        
        const joinRes = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ player_wallet: AppState.walletAddress, character_id: AppState.selectedCharacter.id })
        });

        if(!joinRes.ok) throw new Error("Failed to join pool");

        AppState.currentPoolId = Number(poolId);
        AppState.currentPoolFee = Number(fee);

        // Le créateur doit aussi verrouiller sa mise dans l'escrow de la poule,
        // comme tout participant. Sinon le pot serait privé de sa mise (N-1 participants).
        if (AppState.currentPoolFee > 0) {
            const deposited = await depositForPool(poolId, AppState.currentPoolFee);
            if (!deposited) {
                showToast("Dépôt dans l'escrow échoué, poule non créée.", "error");
                return;
            }
        }

        showToast("Poule créée et rejointe ! ID: " + poolId, "success");
        
        if (isPrivate && createdPool.pool.invite_code) {
            AppState.currentInviteCode = createdPool.pool.invite_code;
        } else {
            AppState.currentInviteCode = null;
        }

        renderBRLobby();
        navigateTo('screen-pool-room');
        renderPoolRoom();
        subscribeToPoolRound(Number(poolId));
    } catch(e) {
        console.error(e);
        showToast("Erreur lors de la création de la poule", "error");
    }
}

async function joinPool(poolId) {
    console.log("joinPool called with ID:", poolId);
    if(!AppState.walletAddress) {
        return showToast("Veuillez connecter votre wallet", "error");
    }
    
    try {
        showToast("Paiement de l'entrée en cours (Backend)...", "info");
        
        const joinRes = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ player_wallet: AppState.walletAddress, character_id: AppState.selectedCharacter.id })
        });

        if(!joinRes.ok) {
            const err = await joinRes.json();
            throw new Error(err.error || "Failed to join pool");
        }
        
        // Fetch pool details to get fee
        const detailsRes = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}`);
        const poolData = await detailsRes.json();

        subscribeToPoolRound(poolId);

        AppState.currentPoolId = poolId;
        AppState.currentPoolFee = poolData.entry_fee;
        showToast("Poule rejointe !", "success");

        // Dépôt on-chain de la mise d'entrée (escrow de la poule) à la jonction
        if (AppState.currentPoolFee > 0) {
            await depositForPool(poolId, AppState.currentPoolFee);
        }

        navigateTo('screen-pool-room');
        renderPoolRoom();
        
    } catch(e) {
        console.error(e);
        showToast(e.message || "Erreur lors de l'intégration à la poule", "error");
    }
}

function subscribeToPoolRound(poolId) {
    if(window.poolChannel) {
        window.echoInstance.leave('pool.' + window.poolChannel);
    }
    window.poolChannel = poolId;
    
    window.echoInstance.channel('pool.' + poolId)
        .listen('PoolRoundStarted', (e) => {
            console.log("Pool Round Started!", JSON.stringify(e));
            if (AppState.pendingResult || document.getElementById('ui-overlay').classList.contains('hidden')) {
                console.log("Godot est actif (ui-overlay hidden ou pendingResult). Mise en attente du prochain round...");
                AppState.pendingPoolRoundEvent = e;
            } else {
                handlePoolRoundStarted(e);
            }
        });
}

async function handlePoolRoundStarted(e) {
    AppState.pendingPoolRoundEvent = null; // Clear it to prevent duplicate execution later
    
    try {
        if (e.winner) {
            const isWinner = e.winner.toLowerCase() === AppState.walletAddress.toLowerCase();
            document.getElementById('pool-room-status').innerText = isWinner ? '🏆 Vous êtes le champion !' : `Champion : ${e.winner.slice(0,10)}...`;
            document.getElementById('pool-room-status').style.color = isWinner ? 'gold' : 'var(--color-red)';
            showToast(isWinner ? '🏆 Vous avez remporté la poule !' : `Poule terminée ! Vainqueur : ${e.winner.slice(0,10)}...`, isWinner ? 'success' : 'info');

            // La consolidation du pot (winner-takes-all) est assurée côté serveur :
            // le champion peut directement réclamer ses gains. On rafraîchit le solde
            // de TOUS les joueurs (le champion accumule, les éliminés voient 0).
            updateBalance();
            (async () => {
                for (let i = 0; i < 6; i++) {
                    await new Promise(r => setTimeout(r, 2500));
                    await refreshClaimable();
                }
            })();

            const btnQuit = document.getElementById('btn-quit-pool');
            const quitText = document.getElementById('quit-pool-text');
            if (btnQuit && quitText) {
                btnQuit.disabled = false;
                quitText.innerText = isWinner ? '🏆 Réclamer les gains et Quitter' : '← Retour au lobby';
            }
            return;
        }

        document.getElementById('pool-room-status').innerText = "Round en cours...";
        document.getElementById('pool-room-status').style.color = "var(--color-red)";
        
        if (e.waitingPlayer && e.waitingPlayer.toLowerCase() === AppState.walletAddress.toLowerCase()) {
            showToast("Vous êtes exempté pour ce round ! Attendez le prochain.", "info");
            return;
        }
        
        const myPair = e.pairs.find(p => p.player1.toLowerCase() === AppState.walletAddress.toLowerCase() || p.player2.toLowerCase() === AppState.walletAddress.toLowerCase());
        
        if (myPair) {
            if (AppState.currentMatchId === myPair.matchId) {
                console.log("Round déjà en cours de traitement, ignoré.");
                return;
            }

            const isChallenger = myPair.player1.toLowerCase() === AppState.walletAddress.toLowerCase();
            const opponent = isChallenger ? myPair.player2 : myPair.player1;
            
            AppState.currentTargetId = opponent;
            AppState.currentMatchId = myPair.matchId;
            
            // On peut recevoir les chars si le backend les envoie. Sinon, défaut p2
            AppState.opponentChar = "p" + (isChallenger ? (myPair.p2_char || 2) : (myPair.p1_char || 2));
            AppState.myChar = "p" + (isChallenger ? (myPair.p1_char || 2) : (myPair.p2_char || 2));
            
            console.log("Lancement du round contre", opponent, "Match ID:", AppState.currentMatchId);
            AppState.lastActionTime = Date.now();
            launchGodot(opponent);
        }
    } catch(err) {
        console.error("FATAL ERROR IN handlePoolRoundStarted:", err);
    }
}

async function renderPoolRoom() {
    if (!AppState.currentPoolId) return;
    document.getElementById('pool-room-title').innerText = "Poule #" + AppState.currentPoolId;
    
    try {
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${AppState.currentPoolId}`);
        const poolData = await res.json();

        if (poolData.invite_code) {
            AppState.currentInviteCode = poolData.invite_code;
            document.getElementById('pool-invite-container').style.display = 'block';
            const inviteUrl = window.location.origin + window.location.pathname + "?invite=" + poolData.invite_code;
            document.getElementById('pool-invite-link').value = inviteUrl;
        } else {
            document.getElementById('pool-invite-container').style.display = 'none';
        }
        
        const pCount = poolData.players_count || 1;
        const mPlayers = poolData.max_players;

        document.getElementById('pool-room-count').innerText = pCount + " / " + mPlayers;
        
        const btnQuit = document.getElementById('btn-quit-pool');
        const quitText = document.getElementById('quit-pool-text');
        if (btnQuit && quitText) {
            if (poolData.status === 'finished') {
                const winnerPlayer = poolData.players ? poolData.players.find(p => p.status === 'alive') : null;
                const winnerWallet = winnerPlayer ? winnerPlayer.wallet_address.toLowerCase() : null;
                const isWinner = winnerWallet === AppState.walletAddress.toLowerCase();
                
                btnQuit.disabled = false;
                quitText.innerText = isWinner ? '🏆 Réclamer les gains et Quitter' : '← Retour au lobby';
                document.getElementById('pool-room-status').innerText = winnerWallet
                    ? (isWinner ? '🏆 Vous êtes le champion !' : `Champion : ${winnerWallet.slice(0,10)}...`)
                    : 'Poule terminée (aucun vainqueur)';
                document.getElementById('pool-room-status').style.color = isWinner ? 'gold' : 'var(--color-red)';
                updateBalance();
            } else if (pCount >= mPlayers) {
                btnQuit.disabled = true;
                quitText.innerText = "Matchs en cours...";
                document.getElementById('pool-room-status').innerText = "La poule est pleine, la bataille commence !";
                document.getElementById('pool-room-status').style.color = '';
            } else {
                btnQuit.disabled = false;
                quitText.innerText = "Quitter la poule";
                document.getElementById('pool-room-status').innerText = "En attente de joueurs...";
                document.getElementById('pool-room-status').style.color = '';
            }
        }

        if (poolData.status === 'active' && poolData.active_pairs && poolData.active_pairs.length > 0) {
            handlePoolRoundStarted({
                poolId: AppState.currentPoolId,
                pairs: poolData.active_pairs,
                waitingPlayer: null
            });
        }
    } catch(e) {
        console.error(e);
    }
}

async function checkPoolElimination(godotResult, matchId) {
    try {
        if (godotResult === 2) { // Loser
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${AppState.currentPoolId}`);
            const data = await res.json();
            
            const me = data.players.find(p => p.wallet_address.toLowerCase() === AppState.walletAddress.toLowerCase());
            if (!me || me.status === 'eliminated') {
                showToast("Vous êtes éliminé de la poule !", "error");
                quitPool(false);
            }
        }
    } catch(e) { console.error(e); }
}

let isQuitting = false;
async function quitPool(claim = true) {
    if (isQuitting) return;
    isQuitting = true;

    if (AppState.currentPoolId) {
        try {
            const poolData = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${AppState.currentPoolId}`).then(r => r.json());
            const poolStatus = poolData.status || 'unknown';

            if (claim && poolStatus === 'finished') {
                // Winner-take-all : le champion réclame LE POT entier (une seule signature),
                // depuis l'escrow. Les éliminés voient 0 et n'ont rien à réclamer.
                const winnerWallet = poolData.players ? poolData.players.find(p => p.status === 'alive') : null;
                if (winnerWallet && winnerWallet.wallet_address.toLowerCase() === AppState.walletAddress.toLowerCase()) {
                    await claimPoolGains(AppState.currentPoolId, AppState.walletAddress);
                }
                showToast("Vous pouvez fermer ce panneau.", "success");
            } else {
                showToast("Vous avez quitté l'interface de la poule.", "info");
            }
        } catch(e) {
            console.error("Erreur lors de la sortie de poule:", e);
        }
    }

    isQuitting = false;
    AppState.currentPoolId = null;
    AppState.currentInviteCode = null;
    if(window.poolChannel) {
        window.echoInstance.leave('pool.' + window.poolChannel);
        window.poolChannel = null;
    }
    navigateTo('screen-br');
    renderBRLobby();
}
