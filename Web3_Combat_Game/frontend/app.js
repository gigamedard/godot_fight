// 1. ÉTAT GLOBAL DE L'APPLICATION
// ── SWITCH DE FLUX DÉPÔT/COMBAT ──────────────────────────────────────────────
// true  = Option 1 (par défaut) : le combat se lance immédiatement, le dépôt
//         on-chain se fait en parallèle (tx.wait() via MetaMask prend 12-28s
//         mesurés — bloquer le combat derrière = écran figé + timeout).
//         Si le dépôt échoue franchement (revert/refus), le match est annulé.
// false = Option 2 (sécurité max) : le combat ne démarre QUE si le dépôt est
//         confirmé on-chain (await depositForMatch) — jusqu'à ~30s d'attente.
const LAUNCH_GAME_BEFORE_DEPOSIT_CONFIRM = true;
// ────────────────────────────────────────────────────────────────────────────
const AppState = {
    currentScreen: 'screen-splash',
    selectedCharacter: null,
    selectedGameMode: localStorage.getItem('web3combat_mode') || null, // 'DUEL' | 'BATTLE' | 'SPIRIT'
    language: localStorage.getItem('web3combat_lang') || null,
    walletAddress: null,
    playerName: localStorage.getItem('web3combat_pseudo') || null,
    currentChallenger: null, 
    currentTargetId: null, 
    pendingChallengeParam: null, 
    defaultBetAmount: localStorage.getItem('web3combat_bet_amount') || '10',
    currentPoolId: null,
    currentPoolFee: 0,
    poolSpectator: false,
    poolRefreshTimer: null,
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
    { id: 1, name: 'Guerrier Ninja', styleKey: 'charStyleMartial', style: 'Arts Martiaux', color: 'var(--color-orange)', photo: 'characters/p1-ninja.png?v=2' },
    { id: 2, name: 'Mutant Cyborg', styleKey: 'charStyleSpeed', style: 'Vitesse', color: 'var(--color-blue)', photo: 'characters/p2-cyborg.png?v=2' },
    { id: 3, name: 'Tom Frazer', styleKey: 'charStyleStrength', style: 'Force Brute', color: 'var(--color-red)', photo: 'characters/p3-tom.png?v=2' },
    { id: 4, name: 'Big Choco', styleKey: 'charStyleTitan', style: 'Force Titan', color: 'var(--color-purple)', photo: 'characters/p4-mage.png?v=2' }
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
                document.getElementById('invite-message').innerText = `Vous êtes invité à la poule #${pool.id} (Mise: ${fmtTST(pool.entry_fee)} TST). Voulez-vous rejoindre ?`;
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

function copyInviteCode() {
    const code = document.getElementById('pool-invite-code').value;
    if (!code || code.trim() === '') {
        showToast("Aucun code disponible.", "error");
        return;
    }
    navigator.clipboard.writeText(code);
    showToast("Code copié !", "success");
}

// Génère ou rafraîchit le QR code dans le conteneur cible avec fond blanc et quiet zone
function renderQRCodeInBox(qrBox, payload) {
    if (!qrBox || !payload) return;
    // Lazy-loading : la lib de génération QR n'est chargée qu'à l'usage.
    ensureQrLibs().then(() => {
        qrBox.innerHTML = '';
        qrBox.style.background = '#ffffff';
        qrBox.style.padding = '14px';
        qrBox.style.borderRadius = '12px';
        qrBox.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.6)';
        qrBox.style.display = 'inline-block';

        new QRCode(qrBox, {
            text: payload,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.Q
        });
    }).catch(e => {
        console.error("[App2] générateur QR indisponible:", e);
        showToast("Générateur QR indisponible.", "error");
    });
}

// Affiche / masque le QR code du lien d'invitation du salon (pool-room)
window.openInviteQR = function() {
    const qrBox = document.getElementById('pool-invite-qr');
    if (!qrBox) return;

    if (qrBox.style.display !== 'none') {
        qrBox.style.display = 'none';
        qrBox.innerHTML = '';
        return;
    }

    const linkInput = document.getElementById('pool-invite-link');
    const codeInput = document.getElementById('pool-invite-code');
    const qrPayload = AppState.currentInviteQRPayload
        || (codeInput ? codeInput.value.trim() : '')
        || (linkInput && linkInput.value.includes('invite=') ? linkInput.value.split('invite=').pop() : (linkInput ? linkInput.value.trim() : ''));

    if (!qrPayload) {
        showToast("Aucun code d'invitation disponible.", "error");
        return;
    }

    renderQRCodeInBox(qrBox, qrPayload);
    showToast("QR code généré — faites-le scanner pour rejoindre le salon.", "success");
};

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
                document.getElementById('invite-message').innerText = `Vous êtes invité à la poule #${pool.id} (Mise: ${fmtTST(pool.entry_fee)} TST). Voulez-vous rejoindre ?`;
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

// Helper i18n central : traduit via I18N si disponible, sinon renvoie la clé
// (les dictionnaires français servent de fallback natif dans i18n.js).
function tr(key, params) {
    if (window.I18N && typeof window.I18N.t === 'function') {
        const val = window.I18N.t(key, params);
        if (val && val !== key) return val;
    }
    return key;
}

// Réaction à un changement de langue : re-render de toutes les vues
// dynamiques actuellement visibles (les vues statiques sont couvertes par
// I18N.applyLanguage via [data-i18n]).
window.addEventListener('languageChanged', () => {
    try {
        if (AppState.currentScreen === 'screen-main') renderDuelLobby();
        if (AppState.currentScreen === 'screen-br') renderBRLobby();
        if (AppState.currentScreen === 'screen-pool-room' && AppState.currentPoolId) renderPoolRoom();
        if (AppState.currentScreen === 'screen-character') {
            const grid = document.getElementById('character-grid');
            if (grid) renderCharacterSelect();
            const sel = AppState.selectedCharacter;
            if (sel) {
                document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
                const card = document.getElementById(`char-${sel.id}`);
                if (card) card.classList.add('selected');
            }
        }
        const poolTitle = document.getElementById('pool-room-title');
        if (poolTitle && AppState.currentPoolId) poolTitle.innerText = tr('poolTitle', { id: AppState.currentPoolId });
    } catch (e) {
        console.warn("[i18n] Re-render après changement de langue :", e);
    }
});

// Étape 1 : Sélection de la langue
window.selectLanguage = function(lang) {
    AppState.language = lang;
    if (window.I18N) {
        window.I18N.applyLanguage(lang);
    } else {
        localStorage.setItem('web3combat_lang', lang);
    }
    // Si l'utilisateur est sur l'écran de sélection de langue, avancer vers la connexion
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'screen-language') {
        navigateTo('screen-connect');
    }
};

// Étape 2 : Connexion du wallet — provider injecté (MetaMask/Core) ou WalletConnect
// (Core Mobile via deeplink), sinon restauration localStorage. Aucun mock de dev.
// Chargement paresseux du bundle wallet (web3.iife.js ~2,9 Mo) : uniquement
// quand une connexion WalletConnect / Core Mobile est nécessaire (aucun provider
// injecté). Évite de charger 2,9 Mo pour tous les utilisateurs d'extension.
let _walletLibPromise = null;
function ensureWalletLib() {
    if (window.App2Wallet) return Promise.resolve(window.App2Wallet);
    if (_walletLibPromise) return _walletLibPromise;
    _walletLibPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'web3.iife.js?v=1';
        s.async = true;
        s.onload = () => window.App2Wallet ? resolve(window.App2Wallet) : reject(new Error('App2Wallet absent après chargement'));
        s.onerror = () => { _walletLibPromise = null; reject(new Error('Échec de chargement du bundle wallet')); };
        document.head.appendChild(s);
    });
    return _walletLibPromise;
}

// ── Lazy-loading : injection des libs à la demande (économie au démarrage) ──
const _libPromises = {};
// Anti-doublon : l'annulation d'un match peut arriver par 2 voies (event
// MatchCancelled ET watchdog) → n'afficher le message qu'UNE fois par match.
const _cancelledNotified = new Set();
function notifyMatchCancelledOnce(matchId, message) {
    if (_cancelledNotified.has(String(matchId))) return;
    _cancelledNotified.add(String(matchId));
    showToast(message, "error", 0);
}
function loadScript(src) {
    if (_libPromises[src]) return _libPromises[src];
    _libPromises[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { delete _libPromises[src]; reject(new Error('Échec chargement ' + src)); };
        document.head.appendChild(s);
    });
    return _libPromises[src];
}
function ensureEthers() {
    return (typeof ethers !== 'undefined') ? Promise.resolve() : loadScript('ethers.min.js?v=1');
}
function ensureEchoLibs() {
    return Promise.all([
        (typeof Echo !== 'undefined') ? Promise.resolve() : loadScript('echo.iife.js?v=1'),
        (typeof Pusher !== 'undefined') ? Promise.resolve() : loadScript('pusher.min.js?v=1'),
    ]);
}
function ensureQrLibs() {
    return Promise.all([
        (typeof Html5Qrcode !== 'undefined') ? Promise.resolve() : loadScript('html5-qrcode.min.js?v=1'),
        (typeof QRCode !== 'undefined') ? Promise.resolve() : loadScript('qrcode.min.js?v=1'),
    ]);
}

// ── Pont provider EIP-1193 vers le parent (App1) quand App2 est embarqué ─────
// App2 dans l'iframe App1 n'a pas de provider injecté exploitable (cross-origin)
// et le deeplink WalletConnect est inopérant dans une iframe. On délègue donc les
// requêtes RPC au parent, qui détient le wallet. Contrat (côté App1) :
//   reçu   : { app2Bridge:true, type:'WALLET_RPC', id, request:{method,params} }
//   renvoi : { app2Bridge:true, type:'WALLET_RPC_RESULT', id, result?/error? }
function setupParentProvider() {
    if (window.parent === window) return null;
    if (window.__bridgeProvider) return window.__bridgeProvider;
    let _id = 0; const _pending = {};
    window.addEventListener('message', function (e) {
        const d = e.data;
        if (!d || d.app2Bridge !== true || d.type !== 'WALLET_RPC_RESULT') return;
        const cb = _pending[d.id];
        if (!cb) return;
        delete _pending[d.id];
        if (d.error) cb.reject(d.error); else cb.resolve(d.result);
    });
    window.__bridgeProvider = {
        isMetaMask: false,
        request: function (args) {
            return new Promise(function (resolve, reject) {
                const id = ++_id;
                _pending[id] = { resolve: resolve, reject: reject };
                try { window.parent.postMessage({ app2Bridge: true, type: 'WALLET_RPC', id: id, request: args }, '*'); }
                catch (e) { delete _pending[id]; reject({ code: -32603, message: 'postMessage failed' }); return; }
                setTimeout(function () {
                    if (_pending[id]) { delete _pending[id]; reject({ code: -32603, message: 'bridge timeout' }); }
                }, 20000);
            });
        },
        on: function () {}, removeListener: function () {}, removeAllListeners: function () {}
    };
    return window.__bridgeProvider;
}

// ── Mobile / WalletConnect : préparer le wallet avant une signature/tx. ──────
// iOS gèle le socket WalletConnect quand la dApp passe en arrière-plan (Core
// ouvert) : la demande de signature/tx n'atteint jamais le wallet. Pattern WC
// mobile officiel : (1) restaurer la session si nettoyée, (2) ré-ouvrir le wallet
// via son deeplink AVANT d'émettre la requête. No-op sur le chemin injecté.
async function prepareWalletForTx() {
    if (typeof window.ethereum !== 'undefined') return; // wallet injecté : popup native
    if (!window.App2Wallet) return;
    try {
        await window.App2Wallet.ensurePingalaNetwork();
    } catch (e) { /* non bloquant */ }
    try {
        if (typeof window.App2Wallet.ensureWalletVisibleForTx === 'function') {
            window.App2Wallet.ensureWalletVisibleForTx('core');
        }
    } catch (e) { /* non bloquant */ }
}

// Après un switch de réseau (wallet_switchEthereumChain), ethers v6 invalide le
// BrowserProvider ("network changed: A => B"). On le RECRÉE (provider/signer/
// contract) avant toute écriture, sinon la tx échoue encore après le switch.
async function refreshWalletContract() {
    try {
        if (typeof window.ethereum !== 'undefined') {
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
        } else if (window.App2Wallet && window.App2Wallet.getWcSessionAddress && window.App2Wallet.getWcSessionAddress()) {
            provider = await window.App2Wallet.getProvider('walletconnect');
            signer = await provider.getSigner();
        } else {
            return;
        }
        const abi = typeof CONTRACT_ABI !== 'undefined' ? CONTRACT_ABI : (typeof COMBAT_GAME_ABI !== 'undefined' ? COMBAT_GAME_ABI : null);
        if (abi) contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
    } catch (e) {
        console.log('[App2] refreshWalletContract :', e);
    }
}

// Recrée le provider/signer depuis une session WalletConnect vivante (retour de
// Core, ou provider jamais instancié) SANS ouvrir de modal ni re-pairer.
async function restoreWcProviderIfAny() {
    if (typeof window.ethereum !== 'undefined') return false;
    let hasWc = false;
    try { hasWc = Object.keys(localStorage || {}).some(k => String(k).startsWith('wc@2')); } catch (e) { /* noop */ }
    if (!window.App2Wallet && !hasWc) return false;
    try {
        await ensureWalletLib();
        // ensurePingalaNetwork() reconstruit le provider WC depuis le storage si
        // nécessaire (sinon getWcSessionAddress() est null après un reload iOS).
        await window.App2Wallet.ensurePingalaNetwork();
        if (!window.App2Wallet.getWcSessionAddress || !window.App2Wallet.getWcSessionAddress()) return false;
        provider = await window.App2Wallet.getProvider('walletconnect');
        signer = await provider.getSigner();
        if (signer && typeof CONTRACT_ABI !== 'undefined') {
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        }
        console.log('[App2] Session WalletConnect restaurée (provider/signer prêts).');
        return true;
    } catch (e) {
        console.log('[App2] restoreWcProviderIfAny :', e);
        return false;
    }
}

// Au retour sur la page (ex. après approbation dans Core), restaurer la session
// WC et rafraîchir le solde — corrige le badge resté sur « -- » en mobile.
// Message d'erreur lisible pour une signature/tx wallet (refus, solde, timeout).
function describeTxError(err) {
    const code = err && (err.code || (err.info && err.info.error && err.info.error.code));
    const msg = (err && (err.shortMessage || err.message)) || '';
    if (code === 4001 || /user rejected|User denied|rejected|refus/i.test(msg)) return "Transaction refusée dans le wallet.";
    if (/insufficient funds|exceeds balance|insufficient/i.test(msg)) return "Solde TST insuffisant pour cette transaction.";
    if (/timeout|timed out/i.test(msg)) return "Délai dépassé (wallet). Réessayez.";
    return msg || "Erreur inconnue.";
}

// Pré-contrôle du solde natif : évite d'ouvrir le wallet si le solde est
// insuffisant (message clair au lieu d'un échec de tx).
async function hasEnoughNative(totalWei) {
    try {
        if (!provider) { await restoreWcProviderIfAny(); }
        if (!provider || !AppState.walletAddress) return true; // laisser la tx tenter
        const bal = await getReadProvider().getBalance(AppState.walletAddress);
        if (bal < totalWei) {
            showToast(`Solde TST insuffisant : ${parseFloat(ethers.formatEther(bal)).toFixed(4)} dispo, ${parseFloat(ethers.formatEther(totalWei)).toFixed(4)} requis.`, "error");
            return false;
        }
        return true;
    } catch (e) {
        return true; // en cas de doute, on laisse la tx tenter
    }
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        restoreWcProviderIfAny().then(ok => { if (ok) updateBalance(); });
    }
});

window.connectWallet = async function() {
    // Lazy-loading : ethers + echo/pusher sont téléchargés ICI (à la connexion),
    // pas au chargement de la page. Présents avant tout usage (initWeb3, Echo).
    try { await ensureEthers(); } catch (e) { console.error('[App2] ethers non chargé:', e); }
    try { await ensureEchoLibs(); } catch (e) { console.warn('[App2] echo/pusher non chargés:', e); }
    const urlParams = new URLSearchParams(window.location.search);
    void urlParams;
    // Si le wallet a déjà été injecté par l'auto-entrée portail (DOMContentLoaded),
    // on le préserve et on saute toute la détection. Le portail est la source de vérité.
    const portalWallet = AppState.walletAddress;
    const portalMode = AppState.selectedGameMode;
    const isPortalEntry = portalWallet && (portalMode === 'DUEL' || portalMode === 'BATTLE');

    const savedWallet = localStorage.getItem('web3combat_wallet'); // adresse (jamais de clé privée)

    // Fonction interne commune : affichage + initWeb3 + navigation.
    const finishConnection = function() {
        // Afficher le wallet connecté sur l'écran de connexion
        const statusBox = document.getElementById('wallet-status-box');
        const addrDisplay = document.getElementById('wallet-addr-display');
        if (statusBox) statusBox.style.display = 'block';
        if (addrDisplay) addrDisplay.textContent = AppState.walletAddress;

        showToast("Wallet connecté : " + AppState.walletAddress.substring(0, 6) + "...", "success");

        // Initialiser le provider Web3 (signataire déjà détecté).
        // Sans clé privée et sans MetaMask (ex. restauration localStorage['user']),
        // aucun signer n'est disponible : initWeb3 est sauté (mode dégradé).
        // initWeb3 choisit le provider (injecté / WalletConnect) ou reste en mode dégradé.
        initWeb3();

        // Si le mode a déjà été défini par le portail hôte (paramètre URL ?mode=),
        // sauter l'écran de choix de mode et aller directement à la sélection de personnage.
        if (AppState.selectedGameMode && (AppState.selectedGameMode === 'DUEL' || AppState.selectedGameMode === 'BATTLE')) {
            setTimeout(() => navigateTo('screen-character'), 500);
        } else {
            setTimeout(() => navigateTo('screen-mode'), 500);
        }
    };

    // ── 1. Entrée portail (?mode=…&wallet=… déjà traités par le DOMContentLoaded).
    //    Chemin SYNCHRONE : ne pas redemander de connexion (popup interdite ici).
    if (isPortalEntry) {
        finishConnection();
        return;
    }

    // ── 2. Mode e2e ?player=N : SUPPRIMÉ (mock de dev). Production = wallet réel.

    // ── 3. MetaMask / Core extension présent : connexion demandée à l'utilisateur.
    if (typeof window.ethereum !== 'undefined') {
        try {
            let accounts = [];
            if (savedWallet) {
                // Restauration silencieuse : si l'adresse sauvegardée est toujours
                // autorisée dans MetaMask, on se reconnecte SANS popup.
                try {
                    accounts = (await window.ethereum.request({ method: 'eth_accounts' })) || [];
                } catch (e) {
                    accounts = [];
                }
                accounts = accounts.filter(a => typeof a === 'string' && a.toLowerCase() === savedWallet.toLowerCase());
            }
            if (accounts.length === 0) {
                // Première connexion, ou adresse plus autorisée : popup MetaMask.
                accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) || [];
            }
            if (accounts.length === 0) {
                console.warn("[App2] MetaMask n'a retourné aucun compte.");
                showToast("Aucun compte autorisé dans MetaMask.", "error");
                return;
            }
            AppState.walletAddress = accounts[0];
            // Persistance : l'ADRESSE uniquement (jamais de clé privée côté frontend).
            localStorage.setItem('web3combat_wallet', AppState.walletAddress);
            console.log("[App2] Wallet MetaMask connecté :", AppState.walletAddress);
            finishConnection();
            return;
        } catch (e) {
            console.error("[App2] Connexion MetaMask refusée ou échouée :", e);
            showToast("Connexion MetaMask refusée par l'utilisateur.", "error");
            return; // rester sur screen-connect, l'utilisateur peut réessayer
        }
    }

    // ── 3ter. App2 embarqué (iframe App1) : provider PONT vers le parent.
    //    App1 détient le wallet ; App2 lui délègue les requêtes EIP-1193.
    //    À la 2ᵉ ouverture PWA, App1 restaure la session mais doit RE-CRÉER son
    //    provider WalletConnect depuis le storage → on laisse un délai généreux
    //    (pont : 20 s) au lieu d'un abandon prématuré.
    if (typeof window.ethereum === 'undefined' && window.parent !== window) {
        const bp = setupParentProvider();
        if (bp) {
            try {
                const accounts = (await bp.request({ method: 'eth_requestAccounts' })) || [];
                if (accounts.length) {
                    AppState.walletAddress = accounts[0];
                    localStorage.setItem('web3combat_wallet', AppState.walletAddress);
                    window.__useParentProvider = true;
                    console.log('[App2] Wallet via pont App1 :', AppState.walletAddress);
                    finishConnection();
                    return;
                }
            } catch (e) {
                console.warn('[App2] pont App1 indisponible :', (e && (e.message || e)));
            }
        }
        showToast("Connexion wallet : connectez-vous dans App1 (le jeu hérite de la connexion).", "error", 0);
        return;
    }

    // ── 3bis. Aucun provider injecté : WalletConnect (Core Mobile via deeplink).
    //    Déclenché par un clic utilisateur (deeplink/modal l'exige). Le bundle
    //    wallet (~2,9 Mo) est chargé paresseusement ici seulement.
    try {
        await ensureWalletLib();
        showToast("Ouverture de WalletConnect…", "info");
        if (window.showLoader) window.showLoader("Connexion au wallet…");
        const wcProvider = await window.App2Wallet.getProvider('walletconnect');
        const wcSigner = await wcProvider.getSigner();
        AppState.walletAddress = await wcSigner.getAddress();
        localStorage.setItem('web3combat_wallet', AppState.walletAddress);
        console.log("[App2] Wallet connecté (WalletConnect) :", AppState.walletAddress);
        finishConnection();
        return;
    } catch (e) {
        console.warn("[App2] WalletConnect indisponible ou annulé :", e);
        // Non bloquant : on tente les restaurations locales ci-dessous.
    } finally {
        if (window.hideLoader) window.hideLoader();
    }

    // ── 4. Pas de MetaMask : user localStorage (ancien login direct sur 8080,
    //      ou session reçue du portail via BATTLEPOOL_SESSION_SAVE).
    let app1User = null;
    try {
        app1User = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (e) {
        app1User = null;
    }
    const app1Wallet = app1User && app1User.wallet_address ? app1User.wallet_address : null;
    if (app1Wallet) {
        AppState.walletAddress = app1Wallet;
        console.log("[App2] Wallet restauré depuis localStorage['user'] :", app1Wallet);
        finishConnection();
        return;
    }

    // ── 5. Rien du tout : erreur bloquante (aucune clé générée/stockée).
    showToast("Aucun wallet détecté. Installez MetaMask/Core ou connectez-vous via le portail.", "error");
    return;
};

// ── Saisie de clé privée de démo : SUPPRIMÉE (production). ───────────────────
// L'authentification passe uniquement par un wallet réel : provider injecté
// (MetaMask/Core extension) ou WalletConnect (Core Mobile via deeplink).
// Voir window.connectWallet et la couche window.App2Wallet (bundle web3.iife.js).


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

// Bouton retour : remonte d'un cran dans le flow.
// Si on est dans une iframe (portail App 1), le retour depuis l'écran de
// personnage ou de mode ferme l'iframe au lieu de naviguer (évite le cycle
// retour → screen-mode → re-choix → re-boucle).
window.navGoBack = function() {
    // Retour normal dans le flow — y compris dans l'iframe App1 : l'utilisateur
    // peut revenir de la sélection de personnage vers le choix de mode
    // (le sélecteur de mode en haut n'est alors plus nécessaire).
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

// Retour au portail BATTLEPOOL (App 1) depuis l'écran SPIRIT — DEEP LINK.
// App 2 n'embarque plus App 1 en iframe : on ouvre le portail dans un NOUVEL
// ONGLET (contexte top-level). Chaque app garde sa propre session ; le wallet
// est commun aux deux.
window.launchBattlePool = function() {
    const portalUrl = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.PORTAL_URL)
        ? APP_CONFIG.PORTAL_URL
        : 'https://battlepool.31.187.72.98.sslip.io/';
    showToast("Ouverture du portail BATTLEPOOL (App 1)...", "info");
    if (typeof window.AUDIO_FX !== 'undefined') window.AUDIO_FX.success();
    const w = window.open(portalUrl, '_blank', 'noopener');
    if (!w) { window.location.href = portalUrl; } // repli si la popup est bloquée
};

// Plus d'overlay portail : no-op conservé pour compat (anciens HTML).
window.closeBattlePool = function() {};

// (Ancien listener postMessage App1 <-> App2 retire : on n'embarque plus d'iframe.)

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

// --- Provider LECTURE seule, épinglé sur Pingala ---------------------------
// Les lectures on-chain (userBalances, feeBps, solde natif…) ne doivent PAS
// dépendre de la chaîne COURANTE du wallet : sur Core Mobile (WalletConnect),
// la chaîne par défaut est Avalanche (43114) → eth_call renvoyait "0x"
// (BAD_DATA) et les dépôts échouaient (feeBps). Les ÉCRITURES gardent le
// provider wallet (contract/signer) ; les LECTURES passent par ce provider RPC
// Pingala (CORS ouvert), déterministe quelle que soit la chaîne du wallet.
let __readProvider = null;
let __readContract = null;
function getReadProvider() {
    if (!__readProvider) {
        __readProvider = new ethers.JsonRpcProvider(APP_CONFIG.RPC_URL, APP_CONFIG.CHAIN_ID);
    }
    return __readProvider;
}
function getReadContract() {
    if (!__readContract) {
        const abi = typeof CONTRACT_ABI !== 'undefined' ? CONTRACT_ABI : (typeof COMBAT_GAME_ABI !== 'undefined' ? COMBAT_GAME_ABI : null);
        __readContract = new ethers.Contract(CONTRACT_ADDRESS, abi, getReadProvider());
    }
    return __readContract;
}

// Enveloppe un appel wallet (signMessage…) avec un délai maximal : évite qu'un
// loader (ex. « ouverture de session ») tourne indéfiniment si le wallet mobile
// ne se rouvre pas / ne répond pas.
function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(message || 'Délai dépassé')), ms);
        Promise.resolve(promise).then(
            (v) => { clearTimeout(t); resolve(v); },
            (e) => { clearTimeout(t); reject(e); }
        );
    });
}

window.showToast = function(message, type = 'info', ms = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    // Échantillon sonore selon le type de notification
    if (typeof window.AUDIO_FX !== 'undefined') {
        if (type === 'success') window.AUDIO_FX.success();
        else if (type === 'error') window.AUDIO_FX.error();
        else window.AUDIO_FX.info();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const sticky = (ms <= 0); // persistant : ne disparaît qu'au clic (annulations…)
    if (sticky) toast.style.cursor = 'pointer';
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle-2';
    if (type === 'error') icon = 'alert-triangle';
    
    toast.innerHTML = `<i data-lucide="${icon}" width="20"></i> <span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons();
    
    const dismiss = () => {
        toast.style.animation = "fadeOut 0.5s ease forwards";
        setTimeout(() => toast.remove(), 500);
    };
    if (sticky) {
        toast.addEventListener('click', dismiss);          // clic pour fermer
    } else {
        setTimeout(dismiss, ms);
    }
    return toast;
};

window.changeCharacter = function() {
    localStorage.removeItem('web3combat_char');
    window.location.reload();
};

// ============================================================
// INTÉGRATION SON FRONTEND (AUDIO_FX chargé précédemment dans index.html)
// - Musique d'ambiance du menu (drone procédural)
// - Échantillon son sur chaque clic d'élément interactif
// - Coupe la musique du menu pendant le combat Godot (il joue la sienne)
// ============================================================
(function integrateAudioFX() {
    if (typeof window.AUDIO_FX === 'undefined') return;

    const overlayEl = () => document.getElementById('ui-overlay');
    const musicShouldPlay = () => !overlayEl() || !overlayEl().classList.contains('hidden');
    let started = false;

    // 1) Déblocage + démarrage musique de menu à la 1re interaction utilisateur
    //    (indispensable à cause de la politique d'autoplay des navigateurs).
    const unlockAndStart = () => {
        if (started) return;
        started = true;
        window.AUDIO_FX.unlock();
        if (musicShouldPlay()) window.AUDIO_FX.start();
        window.removeEventListener('pointerdown', unlockAndStart);
        window.removeEventListener('keydown', unlockAndStart);
    };
    window.addEventListener('pointerdown', unlockAndStart);
    window.addEventListener('keydown', unlockAndStart);

    // 2) Échantillon de clic sur tout élément interactif (capture pour
    //    intercepter avant tout re-render lucide)
    document.addEventListener('click', (e) => {
        const t = e.target.closest('button, a, [role="button"], select, input[type="radio"]');
        if (t) window.AUDIO_FX.click();
    }, true);

    // 3) Pendant le combat (ui-overlay → .hidden) on coupe la musique du menu,
    //    car Godot joue sa propre ambiance (scripts/sfx.gd). On la reprend ensuite.
    const overlay = document.getElementById('ui-overlay');
    if (overlay && 'MutationObserver' in window) {
        new MutationObserver(() => {
            if (musicShouldPlay()) {
                window.AUDIO_FX.unlock();
                window.AUDIO_FX.start();
            } else {
                window.AUDIO_FX.stopMenu();
            }
        }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }
})();

async function initWeb3() {
    const abi = typeof CONTRACT_ABI !== 'undefined' ? CONTRACT_ABI : (typeof COMBAT_GAME_ABI !== 'undefined' ? COMBAT_GAME_ABI : null);
    if (typeof ethers !== 'undefined' && abi) {
        // Fournisseur Web3 : wallet injecté (MetaMask / Core extension) sinon
        // session WalletConnect déjà active (Core Mobile). AUCUN mock : si aucun
        // signer n'est disponible, on reste en mode dégradé (lecture seule).
        if (window.ethereum) {
            if (typeof window.ensurePingalaNetwork === 'function') {
                try { await window.ensurePingalaNetwork(window.ethereum); } catch (e) { /* non bloquant */ }
            }
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
        } else if (window.parent !== window && (window.__bridgeProvider || setupParentProvider())) {
            // App2 embarqué dans l'iframe App1 (cross-origin) : provider PONT vers
            // App1 qui détient le wallet. REQUIS AUSSI sur le chemin d'auto-entrée
            // portail (?mode=…), sinon provider=null → initWeb3 en « mode dégradé »
            // et SOLDE on-chain absent (régression constatée 2026-10-15).
            window.__useParentProvider = true;
            provider = new ethers.BrowserProvider(window.__bridgeProvider);
            signer = await provider.getSigner();
        } else {
            // Pas de wallet injecté : tenter une session WalletConnect existante
            // (reconnexion silencieuse). Le bundle wallet est chargé à la demande.
            let hasWcStorage = false;
            try { hasWcStorage = Object.keys(localStorage || {}).some(k => String(k).startsWith('wc@2')); } catch (e) { /* noop */ }
            if (!window.App2Wallet && !hasWcStorage) {
                console.log("[App2] initWeb3 : aucun provider disponible (mode dégradé, lecture seule).");
                return;
            }
            try {
                await ensureWalletLib();
                if (!window.App2Wallet.getWcSessionAddress || !window.App2Wallet.getWcSessionAddress()) {
                    console.log("[App2] initWeb3 : pas de session WalletConnect active (mode dégradé).");
                    return;
                }
                provider = await window.App2Wallet.getProvider('walletconnect');
                signer = await provider.getSigner();
            } catch (e) {
                console.log("[App2] initWeb3 : WalletConnect indisponible (mode dégradé).", e);
                return;
            }
        }
        if (!AppState.walletAddress) {
            try { AppState.walletAddress = await signer.getAddress(); } catch (e) { /* garde l'adresse portail */ }
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
    if (typeof ethers === 'undefined' || !ethers.Wallet) {
        console.warn("[App2] initSessionKey annulé : ethers.js non chargé.");
        return;
    }
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
        showToast("Signature de la clé de session requise (le wallet va s'ouvrir une seule fois)...", "info");
        await prepareWalletForTx();
        await refreshWalletContract();
        if (window.showLoader) window.showLoader("Signature de la clé de session…");
        try {
            savedSignature = await withTimeout(signer.signMessage(authMessage), 180000, "Wallet sans réponse : signature de clé de session expirée. Réessayez (le wallet doit s'ouvrir).");
        } catch (e) {
            showToast(describeTxError(e), "error");
            return;
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
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
    if (!contract || typeof getReadContract().userBalances !== 'function') return;
    const container = document.getElementById('pending-funds-container');
    const amt = document.getElementById('pending-amount');
    if (!container || !amt) return;

    // FIX claim : le bouton ne doit apparaître QUE si ce wallet a un gain
    // légitime à réclamer. Quatre cas :
    //  1. Dernier match perdu (non-draw) → rien à réclamer, masquer.
    //  2. Dernier match gagné MAIS consolidation pas encore visible on-chain
    //     (userBalances == mise du match, le settle n'a pas encore tourné) →
    //     masquer : afficher la mise seule serait trompeur (le gain = pot).
    //  3. Dernier match gagné + consolidation visible (userBalances > mise ou
    //     perdant à 0) → afficher le pot.
    //  4. Aucun match récent → solde on-chain éventuel (dépôts divers).
    const w = AppState.walletAddress ? AppState.walletAddress.toLowerCase() : null;
    if (!w) { container.style.display = 'none'; return; }

    try {
        const pending = await getReadContract().userBalances(AppState.walletAddress);
        // Consultons le dernier match terminé pour déterminer l'éligibilité.
        const lastResult = await fetch(`${APP_CONFIG.API_BASE_URL}/battle/last-result?wallet=${w}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null);

        // Cas 1 : perdant du dernier match → jamais de bouton.
        if (lastResult && lastResult.result && lastResult.result !== 'draw' && lastResult.loser === w) {
            container.style.display = 'none';
            amt.innerText = '0';
            return;
        }

        // FIX claim : verrou post-claim. Pendant 20s après un claim réussi, le
        // bouton reste masqué : le re-fetch du solde peut renvoyer l'ancienne
        // valeur (retard de propagation du RPC) et ré-afficher un fantôme.
        if (AppState.claimJustDone && (Date.now() - AppState.claimJustDone) < 20000) {
            container.style.display = 'none';
            amt.innerText = '0';
            return;
        }

        // Cas 2 : gagnant mais consolidation pas encore visible. Si le montant
        // on-chain est EXACTEMENT la mise du dernier match, le pot n'est pas
        // encore consolidé (après settle le gagnant a stake*2 - frais →
        // toujours > stake du match). On masque : le bouton apparaîtra après
        // la consolidation avec le bon montant.
        // NB : base_bet_amount est stocké en DB en UNITÉS TST (ex. "100" = 100
        // TST) tandis que pending est en WEI (100e18) — conversion obligatoire,
        // sinon la comparaison échoue toujours et le filtre est inopérant.
        let lastStake = null;
        if (lastResult && lastResult.base_bet_amount && Number(lastResult.base_bet_amount) > 0) {
            lastStake = ethers.parseEther(String(lastResult.base_bet_amount)); // TST → wei
        }
        if (lastResult && lastResult.result && lastResult.result !== 'draw'
            && lastResult.loser !== null && lastResult.loser !== 'both'
            && lastResult.loser !== w
            && lastStake !== null && pending > 0n && pending === lastStake) {
            console.log("[Claim] Consolidation en attente : montant on-chain = mise seule, masquage jusqu'au settle.");
            container.style.display = 'none';
            amt.innerText = '0';
            return;
        }

        if (pending > 0n) {
            container.style.display = 'block';
            amt.innerText = parseFloat(ethers.formatEther(pending)).toFixed(3);
        } else {
            container.style.display = 'none';
            amt.innerText = '0';
        }
    } catch (e) {
        console.error("Error fetching userBalances:", e);
    }
}

function updateBalance() {
    if (!provider) {
        // Pas de provider : tenter une restauration WalletConnect silencieuse
        // (retour de Core) puis relire ; sinon mode dégradé (lecture seule).
        restoreWcProviderIfAny().then(ok => {
            if (ok) updateBalance();
            else console.log("[App2] updateBalance ignoré : pas de provider (mode dégradé).");
        });
        return;
    }
    if(AppState.walletAddress) {
        // FIX staleness badge : le solde natif peut être lu AVEC RETARD après
        // un retrait push (propagation RPC). On lit le solde DIRECTEMENT via
        // le RPC public Hardhat (indépendant du provider MetaMask et de son
        // cache) et on RELIT une seconde fois pour converger après minage.
        const readNative = async () => {
            try {
                const res = await fetch(APP_CONFIG.RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [AppState.walletAddress, 'latest'] })
                });
                const j = await res.json();
                if (j.result) return BigInt(j.result);
            } catch (e) { /* fallback provider */ }
            return null;
        };
        (async () => {
            let bal = await readNative();
            if (bal === null) {
                try { bal = await getReadProvider().getBalance(AppState.walletAddress); } catch (e) { return; }
            }
            const el = document.getElementById('wallet-balance');
            if (el) el.innerText = parseFloat(ethers.formatEther(bal)).toFixed(4) + " " + (APP_CONFIG.NATIVE_SYMBOL || 'TST');
            // Deuxième lecture après 3s : si le retrait vient d'être miné, la
            // première lecture peut renvoyer l'ancien solde.
            setTimeout(async () => {
                const bal2 = await readNative();
                if (bal2 === null) return;
                const el2 = document.getElementById('wallet-balance');
                if (el2 && bal2 !== bal) el2.innerText = parseFloat(ethers.formatEther(bal2)).toFixed(4) + " " + (APP_CONFIG.NATIVE_SYMBOL || 'TST');
            }, 3000);
        })();

        refreshClaimable();
    }
}

async function claimPendingFunds() {
    if(!AppState.walletAddress) {
        showToast("Portefeuille non connecté.", "error");
        return;
    }
    // ICDM : le retrait est soumis par le SERVEUR (voucher backend + withdrawTo
    // via le backend signer) — le joueur ne signe rien, ne paie pas de gaz,
    // et voit ses TST arriver directement dans son wallet. Idempotent :
    // solde 0 → "rien à retirer".
    try {
        // Lire le solde on-chain réel (userBalances du contrat) pour un message
        // informatif avant le push serveur
        let pending = 0n;
        if (typeof contract !== 'undefined' && contract && typeof contract.userBalances === 'function') {
            pending = await getReadContract().userBalances(AppState.walletAddress);
        }
        if (pending <= 0n) {
            showToast("Aucun fonds à réclamer.", "info");
            return;
        }
        showToast("Transfert de vos gains en cours (sans signature)...", "info");
        if (window.showLoader) window.showLoader("Transfert des gains…");
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/withdraw/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ wallet_address: AppState.walletAddress })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast("Retrait refusé : " + (data.message || data.error || 'Erreur inconnue'), "error");
            return;
        }
        console.log("[Claim] Retrait push effectué par le serveur (gasless).", data.script_output || '');
        // FIX claim : masquer immédiatement le bouton ET mettre un verrou de
        // session : tant que la tx push n'est pas minée (le backend attend
        // tx.wait() donc le succès HTTP garantit le minage, mais le solde
        // on-chain peut être lu avec un léger retard de propagation du RPC),
        // refreshClaimable ré-afficherait un montant fantôme.
        const container = document.getElementById('pending-funds-container');
        if (container) container.style.display = 'none';
        const amt = document.getElementById('pending-amount');
        if (amt) amt.innerText = '0';
        AppState.claimJustDone = Date.now();
        showToast("Fonds transférés avec succès dans votre wallet !", "success");
        updateBalance();
    } catch (err) {
        console.error(err);
        showToast("Erreur lors de la récupération des fonds.", "error");
    } finally {
        if (window.hideLoader) window.hideLoader();
    }
}

function renderCharacterSelect() {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';

    // Curseur de volume : restaure la valeur sauvegardée et l'applique
    const volSlider = document.getElementById('volume-slider');
    const volValue = document.getElementById('volume-value');
    if (volSlider) {
        const savedVol = localStorage.getItem('web3combat_volume');
        const initial = (savedVol !== null) ? parseInt(savedVol, 10) : 85;
        volSlider.value = initial;
        if (volValue) volValue.innerText = initial + '%';
        if (window.AUDIO_FX && window.AUDIO_FX.setVolume) window.AUDIO_FX.setVolume(initial);
        volSlider.oninput = function () {
            const v = parseInt(this.value, 10);
            localStorage.setItem('web3combat_volume', String(v));
            if (volValue) volValue.innerText = v + '%';
            if (window.AUDIO_FX && window.AUDIO_FX.setVolume) window.AUDIO_FX.setVolume(v);
            if (window.AUDIO_FX && window.AUDIO_FX.hover) window.AUDIO_FX.hover();
        };
    }

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = `char-${char.id}`;
        card.onclick = () => selectCharacter(char);

        // Nom et style traduits (clés char1..char4 / charStyle*) — le nom de
        // l'objet reste français (source de vérité Godot/anim2d).
        const charNameKey = 'char' + char.id;
        const charName = tr(charNameKey);
        const charStyle = tr(char.styleKey || char.style);

        card.innerHTML = `
            <div class="char-avatar" style="background-color: ${char.color}">
                <img src="${char.photo}" alt="${charName}" class="char-photo" loading="lazy">
            </div>
            <h3>${charName}</h3>
            <p style="font-size: 0.75rem; color: var(--text-gray-400); margin-top: 0.25rem;">${charStyle}</p>
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
    // Retour sonore : chaque combattant a une "signature" auditive
    if (typeof window.AUDIO_FX !== 'undefined' && window.AUDIO_FX.success) {
        window.AUDIO_FX.success();
    }
    // Le preloader 2D met en scène mon perso dès la sélection (l'adversaire, si connu).
    if (typeof window.setFighters2D === 'function' && isAnim2DLayerVisible()) {
        window.setFighters2D(char.id, anim2DCharId(AppState.opponentChar, 2));
    }
}

function performLogin() {
    // Sauvegarde du pseudonyme saisi (écran personnage) — clé partagée avec App 1
    const pseudoInput = document.getElementById('player-pseudo-input');
    if (pseudoInput && pseudoInput.value.trim() !== '') {
        AppState.playerName = pseudoInput.value.trim();
        localStorage.setItem('web3combat_pseudo', AppState.playerName);
    } else {
        AppState.playerName = AppState.playerName || localStorage.getItem('web3combat_pseudo') || null;
    }

    window.gameConfig = { character: AppState.selectedCharacter.name };
    if (AppState.playerName) window.gameConfig.playerName = AppState.playerName;
    
    // Si le wallet a déjà été injecté par l'auto-entrée portail, on le préserve.
    // Le portail est la source de vérité pour l'identité du joueur.
    const portalWallet = AppState.walletAddress;
    const portalMode = AppState.selectedGameMode;
    const isPortalEntry = portalWallet && (portalMode === 'DUEL' || portalMode === 'BATTLE');

    if (!isPortalEntry) {
        // Aucun mock : le wallet doit déjà être établi par connectWallet().
        if (AppState.walletAddress) {
            // Wallet déjà établi par connectWallet() (MetaMask, localStorage['user']
            // ou session dev restaurée) : on le GARDE tel quel. Aucun fallback
            // aléatoire : un compte Hardhat ne doit jamais remplacer le wallet réel.
            // (ancien comportement : écrasement par Math.random() → SUPPRIMÉ)
        } else {
            // Sécurité (non atteignable dans le flow normal : connectWallet bloque avant).
            let app1User = null;
            try {
                app1User = JSON.parse(localStorage.getItem('user') || 'null');
            } catch (e) {
                app1User = null;
            }
            const app1Wallet = app1User && app1User.wallet_address ? app1User.wallet_address : null;

            if (app1Wallet) {
                AppState.walletAddress = app1Wallet;
            } else {
                showToast("Aucun wallet détecté. Installez MetaMask/Core ou connectez-vous via le portail.", "error");
                return;
            }
        }
    }
    
    window.gameConfig.walletAddress = AppState.walletAddress;
    console.log("Wallet connecté :", AppState.walletAddress);

    // Initialisation du Provider Web3 et Contrat (dégradé si aucun provider).
    initWeb3();

    // Mise à jour du badge dans le Menu Principal
    document.getElementById('player-badge').innerHTML = `
        <div class="char-avatar" style="background-color: ${AppState.selectedCharacter.color}; width: 40px; height: 40px;">
            <img src="${AppState.selectedCharacter.photo}" alt="${AppState.selectedCharacter.name}" class="char-photo" style="width: 40px; height: 40px;">
        </div>
        <div class="player-badge-info">
            <div class="player-badge-name">${AppState.selectedCharacter.name} — ${AppState.playerName || AppState.walletAddress.substring(0,6) + '...'}</div>
            <div class="player-badge-balance" id="wallet-balance">-- ${(window.APP_CONFIG && window.APP_CONFIG.NATIVE_SYMBOL) || 'TST'}</div>
            <div id="pending-funds-container" style="display:none; margin-top: 5px;">
                <button class="btn btn-challenge" style="font-size: 0.8rem; padding: 0.5rem;" onclick="claimPendingFunds()">
                    Réclamer <span id="pending-amount">0</span> ${(window.APP_CONFIG && window.APP_CONFIG.NATIVE_SYMBOL) || 'TST'}
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();

    // --- INITIALISATION LARAVEL ECHO / REVERB ---
    // Nettoie les invitations en attente liées à un joueur qui entre en duel :
    // - playerId === mon wallet  → mes propres invitations sont annulées
    // - playerId === mon challenger → le joueur qui m'avait invité est parti en duel
    // Déclarée au niveau de la connexion (portée accessible par les listeners Echo
    // ET par initiateChallenge/le reste du code qui peut référencer cette logique).
    window.cancelPendingChallengesFor = function (playerId) {
        if (!playerId) return;
        const pid = String(playerId).toLowerCase();
        const myWallet = AppState.walletAddress ? AppState.walletAddress.toLowerCase() : null;

        if (pid === myWallet || pid === (AppState.currentChallenger || '').toLowerCase()) {
            AppState.currentChallenger = null;
            AppState.currentBetAmountOffchain = null;
            AppState.currentChallengerChar = null;
            const modal = document.getElementById('challenge-modal');
            if (modal) modal.style.display = 'none';
            console.log("Invitations en attente annulées pour", pid);
        }
    };

    if (!window.echoInstance) {
        if (typeof Echo === 'undefined') {
            console.error("[App2] Echo n'est pas défini (echo.iife.js ou pusher.min.js manquant).");
            showToast("Module WebSocket non disponible. Veuillez rafraîchir la page.", "error");
            return;
        }
        console.log("Tentative de connexion à Reverb...");

        window.echoInstance = new Echo({
            broadcaster: 'reverb',
            key: 'web3combat',
            wsHost: APP_CONFIG.REVERB_HOST,
            wsPort: APP_CONFIG.REVERB_PORT,
            wssPort: APP_CONFIG.REVERB_PORT,
            // FIX https mobile : en page https, Reverb doit passer en wss.
            // Le proxy TLS (8443) relaye le WebSocket vers Reverb (8081).
            forceTLS: !!(APP_CONFIG.REVERB_TLS),
            disableStats: true,
            enabledTransports: ['ws', 'wss'],
            authEndpoint: `${APP_CONFIG.API_BASE_URL}/broadcasting/auth`,
            auth: {
                headers: {
                    'X-Wallet-Address': AppState.walletAddress,
                    'X-Player-Name': AppState.playerName || '',
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
                // Un joueur passe "in-game" : toute invitation en attente liée à lui est caduque.
                if (e.status === 'in-game') {
                    window.cancelPendingChallengesFor(e.playerId);
                }
            })
            .listen('ChallengesCancelled', (e) => {
                console.log("=== REVERB: .listen(ChallengesCancelled) ===", e);
                window.cancelPendingChallengesFor(e.playerId);
            })
            .error((error) => {
                console.error("=== REVERB: ERREUR D'ABONNEMENT ===", error);
            });

        // S'abonner au canal privé.
        // NB : Echo préfixe automatiquement "private-" au nom passé à .private() —
        // il faut donc lui donner 'player.<wallet>' (et non 'private-player.…'
        // qui produisait 'private-private-player.…'). Le wallet est normalisé en
        // lowercase pour matcher le canal de publication du backend
        // (PlayerChannel : 'player.' . strtolower($id)).
        window.echoInstance.private(`player.${AppState.walletAddress.toLowerCase()}`)
            .listen('ChallengeSent', (e) => {
                console.log("Défi reçu de :", e.challengerId, "Pari :", e.betAmount);
                // N'accepter le défi que si on est sur l'écran de lobby (screen-main)
                if (AppState.currentScreen !== 'screen-main') {
                    console.log("Défi ignoré : joueur pas sur l'écran de lobby (", AppState.currentScreen, ")");
                    return;
                }
                AppState.currentChallenger = e.challengerId;
                AppState.currentBetAmountOffchain = e.betAmount;
                AppState.currentChallengerChar = e.challengerChar || 2;
                
                const shortId = e.challengerId.substring(0,6) + '...' + e.challengerId.substring(e.challengerId.length - 4);
                document.getElementById('challenge-text').innerText = tr('challengeReceivedShort', { challenger: shortId, bet: e.betAmount });
                
                const actions = document.getElementById('challenge-modal-actions');
                if (actions) actions.style.display = 'flex';
                document.getElementById('challenge-modal').style.display = 'flex';
            })
            .listen('MatchDepositPending', (e) => {
                // FIX (régression ICDM) : l'acceptation diffuse MatchDepositPending
                // → le front OUVRE METAMASK (dépose escrow), mais ne lance PAS le
                // combat : il attendra l'event MatchReady (les deux dépôts
                // confirmés on-chain, cf. BattleController::depositConfirmed).
                console.log("MatchDepositPending : match créé, ouverture du dépôt escrow (MetaMask)...", e);
                window.gameConfig.matchId = e.matchId;
                if (e.betAmount) AppState.currentBetAmountOffchain = e.betAmount;

                // Déterminer qui est le challenger et qui est le target pour assigner le bon personnage adverse
                const isChallenger = (AppState.walletAddress.toLowerCase() === e.player1.toLowerCase());
                AppState.opponentChar = "p" + (isChallenger ? (e.p2Char || 2) : (e.p1Char || 2));
                AppState.myChar = "p" + (isChallenger ? (e.p1Char || 2) : (e.p2Char || 2));

                executeMatchOnChain(e);
            })
            .listen('MatchReady', (e) => {
                // Les deux dépôts sont confirmés on-chain → lancement du combat.
                console.log("FIX ICDM : les deux dépôts sont confirmés — lancement du combat.", e);
                AppState.depositsDone = true;
                launchCombat(e);
            })
            .listen('MatchCancelled', (e) => {
                // Fix (a) : un dépôt a échoué définitivement → match annulé.
                console.log("Match annulé :", e);
                const me = AppState.walletAddress ? AppState.walletAddress.toLowerCase() : '';
                const iAmCanceller = e.cancelledBy && String(e.cancelledBy).toLowerCase() === me;
                notifyMatchCancelledOnce(e.matchId, iAmCanceller
                    ? "Match annulé : votre dépôt a échoué."
                    : "L'adversaire n'a pas pu déposer — match annulé.");
                if (AppState.currentMatchId == e.matchId || AppState.pendingDepositMatchId == e.matchId) {
                    const cm = document.getElementById('challenge-modal');
                    if (cm) cm.style.display = 'none';
                    if (typeof window.toggleAnim2D === 'function') window.toggleAnim2D(false);
                    if (typeof window.resetMatchState === 'function') window.resetMatchState();
                    navigateTo('screen-main');
                }
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
        // Lancement auto du portail BATTLEPOOL (App 1) — petit délai pour laisser
        // l'écran SPIRIT se dessiner (le bouton reste disponible en fallback).
        setTimeout(() => {
            if (AppState.currentScreen === 'screen-spirit') {
                launchBattlePool();
            }
        }, 700);
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
        list.innerHTML = `<p class="empty-state">${tr('noFighters')}</p>`;
        return;
    }

    playersToRender.forEach(player => {
        if (player.id === AppState.walletAddress) return; // Ne pas s'afficher

        const card = document.createElement('div');
        card.className = 'player-card';
        const shortId = player.id.substring(0,6) + '...' + player.id.substring(player.id.length - 4);
        
        let cardStyle = "";
        let buttonHtml = `<button class="btn btn-challenge" id="btn-chal-${player.id}" onclick="openBetModal('${player.id}')">${tr('challenge')}</button>`;
        if (player.status === 'in-game') {
            cardStyle = "opacity: 0.5; filter: grayscale(100%); pointer-events: none;";
            buttonHtml = `<button class="btn btn-waiting" id="btn-chal-${player.id}" disabled><i data-lucide="swords" width="16" height="16" style="margin-right: 0.5rem"></i> ${tr('inCombatBtn')}</button>`;
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

    // Cacher la barre de choix 2D après le match (si elle était affichée).
    window.showMoveBar2D(false);
    // Réinitialiser le verrou anti-double-clic 2D et réactiver les boutons
    // pour le round/match suivant.
    window._move2DPending = false;
    const moveBar2D = document.getElementById('anim2d-move-bar');
    if (moveBar2D) moveBar2D.querySelectorAll('.anim2d-move-btn').forEach(b => b.disabled = false);
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
// API directe Html5Qrcode (pas Html5QrcodeScanner) : pas d'UI par défaut
// (boutons anglais), caméra arrière automatique.
// SANS qrbox : la librairie croppe l'analyse à la zone qrbox — un QR qui la
// dépasse est tronqué et jamais décodé (bug constaté : QR plus grand que le
// cadre). On analyse donc la FRAME ENTIÈRE ; le cadre visuel est purement
// décoratif (CSS, hors flux d'analyse).
let html5QrcodeInstance = null;
let _qrScanHandled = false;

async function openQRScanner() {
    document.getElementById('qr-modal').style.display = 'flex';
    // Lazy-loading : lib de scan QR chargée à l'ouverture du scanner.
    try { await ensureQrLibs(); } catch (e) {
        showToast("Le scanner QR n'a pas pu être chargé.", "error");
        return;
    }
    _qrScanHandled = false;

    // Configuration optimisée de l'instance Html5Qrcode :
    // - formatsToSupport : QR_CODE uniquement (décharge ZXing de tester 17 formats par trame -> +10x plus rapide)
    // - experimentalFeatures : active le BarcodeDetector matériel natif (iOS 17+ / Android) dans le constructeur
    const qrcodeFormats = typeof Html5QrcodeSupportedFormats !== 'undefined'
        ? [ Html5QrcodeSupportedFormats.QR_CODE ]
        : undefined;

    html5QrcodeInstance = new Html5Qrcode("reader", {
        verbose: false,
        formatsToSupport: qrcodeFormats,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });

    // Configuration du flux caméra :
    // - fps: 15 pour une analyse fluide sans surchauffe
    // - videoConstraints : force Safari/iOS à négocier un flux HD (1280x720) avec la caméra arrière
    //   (évite le sous-échantillonnage 480p de Safari qui rendait les QR flous sur écran)
    const config = {
        fps: 15,
        videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    const startScan = (streamConfig) => {
        return html5QrcodeInstance.start(
            { facingMode: "environment" },
            streamConfig,
            onScanSuccess,
            function () { /* échec de décodage d'une frame : silencieux */ }
        );
    };

    startScan(config).catch(err => {
        console.warn("Démarrage caméra HD échoué, tentative fallback standard :", err);
        // Fallback sans contraintes de résolution strictes si le matériel refuse le 720p
        startScan({ fps: 10 }).catch(fallbackErr => {
            console.error("Ouverture caméra échouée :", fallbackErr);
            showToast("Accès caméra refusé ou indisponible.", "error");
            closeQRScanner();
        });
    });
}

function closeQRScanner() {
    document.getElementById('qr-modal').style.display = 'none';
    if (html5QrcodeInstance) {
        const inst = html5QrcodeInstance;
        html5QrcodeInstance = null;
        inst.stop().then(() => inst.clear()).catch(() => { try { inst.clear(); } catch (e) {} });
    }
}

function onScanSuccess(decodedText) {
    // Garde anti double-déclenchement : la caméra peut décoder la même frame
    // plusieurs fois avant l'arrêt du flux → un seul traitement.
    if (_qrScanHandled) return;
    _qrScanHandled = true;
    closeQRScanner();
    const text = decodedText.trim();

    // QR de battle : le contenu est le code d'invitation SEUL (nouveau format),
    // ou une URL ?invite=CODE (ancien format, compat). Dans les deux cas on
    // résout la poule → rejoindre automatiquement (pas de saisie manuelle).
    let inviteCode = null;
    if (/^[A-Za-z0-9_-]{4,32}$/.test(text) && !text.includes('?')) {
        inviteCode = text; // code brut
    } else {
        try {
            const u = new URL(text);
            inviteCode = u.searchParams.get('invite');
        } catch (e) {
            // Pas une URL ni un code → fallback : filtre du lobby par pseudo/wallet
        }
    }

    if (inviteCode) {
        fetch(`${APP_CONFIG.API_BASE_URL}/pools/invite/${inviteCode}`)
            .then(res => {
                if (!res.ok) throw new Error("Poule introuvable");
                return res.json();
            })
            .then(pool => {
                showToast(`Battle #${pool.id} trouvée (mise ${fmtTST(pool.entry_fee)} TST) — rejoindre...`, "success");
                joinPool(pool.id);
            })
            .catch(err => {
                console.error(err);
                showToast("QR invalide : battle introuvable", "error");
            });
        return;
    }

    // Sinon, comportement d'origine : filtre du lobby par pseudo/wallet
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = text;
        filterLobby(text);
    }
}

// --- GESTION DE LA MODALE DE PARI ---
function openBetModal(playerId) {
    // Garde : un joueur déjà en duel ne peut plus être invité
    const targetPlayer = onlinePlayers.find(p => p.id === playerId);
    if (targetPlayer && targetPlayer.status === 'in-game') {
        showToast("Ce joueur est déjà en combat.", "error");
        return;
    }
    AppState.currentTargetId = playerId;
    const targetName = targetPlayer ? targetPlayer.name : "Adversaire";
    document.getElementById('bet-target-name').innerText = targetName;
    document.getElementById('bet-amount').value = AppState.defaultBetAmount || "10";
    
    let maxBet = localStorage.getItem(`web3combat_max_bet_${AppState.walletAddress}`) || '0';
    let minBet = localStorage.getItem(`web3combat_min_bet_${AppState.walletAddress}`) || '0';
    
    const statsEl = document.getElementById('bet-stats');
    if (statsEl) {
        statsEl.innerText = `Mise Max : ${maxBet} TST | Mise Min : ${minBet > 0 ? minBet : '--'} TST`;
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
        } else if (response.status === 409) {
            // Le backend a refusé : joueur déjà en combat (invitation annulée côté serveur)
            const data = await response.json().catch(() => null);
            if(btn) {
                btn.className = 'btn btn-challenge';
                btn.innerHTML = 'Défier';
                btn.disabled = false;
            }
            showToast((data && data.message) || "Ce joueur est déjà en combat.", "error");
            window.cancelPendingChallengesFor(playerId);
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
        showToast(`Dépôt de ${amountEth} TST sur la blockchain...`, "info");
        const stakeWei = ethers.parseEther(String(amountEth));
        // Commission serveur (2,5 % par défaut, reconfigurable via feeBps sur le contrat)
        const feeBps = typeof getReadContract().feeBps === 'function' ? Number(await getReadContract().feeBps()) : 250;
        const feeWei = stakeWei * BigInt(feeBps) / 10000n;
        const totalWei = stakeWei + feeWei;
        showToast(`Dépôt de ${amountEth} TST (mise) + ${ethers.formatEther(feeWei)} TST (frais)...`, "info");
        if (!(await hasEnoughNative(totalWei))) return false;
        await prepareWalletForTx();
        await refreshWalletContract();
        const tx = await contract.register(stakeWei, { value: totalWei });
        await tx.wait();
        showToast("Dépôt confirmé sur la blockchain !", "success");
        updateBalance();
        return true;
    } catch (err) {
        console.error("Erreur de dépôt:", err);
        showToast("Échec du dépôt on-chain : " + describeTxError(err), "error");
        return false;
    }
}

// Dépôt de la mise d'entrée DANS L'ESCROW de la poule (winner-take-all).
// Utilise registerForPool (le stake est verrouillé dans la pool), pas register (duel).
async function depositForPool(poolId, amountEth) {
    if (!contract || !AppState.walletAddress || !poolId || !amountEth || Number(amountEth) <= 0) return false;
    try {
        showToast(`Dépôt de ${amountEth} TST dans l'escrow de la poule...`, "info");
        const stakeWei = ethers.parseEther(String(amountEth));
        const feeBps = typeof getReadContract().feeBps === 'function' ? Number(await getReadContract().feeBps()) : 250;
        const feeWei = stakeWei * BigInt(feeBps) / 10000n;
        const totalWei = stakeWei + feeWei;
        showToast(`Escrow +${amountEth} TST (mise) + ${ethers.formatEther(feeWei)} TST (frais)...`, "info");
        if (!(await hasEnoughNative(totalWei))) return false;
        await prepareWalletForTx();
        await refreshWalletContract();
        if (window.showLoader) window.showLoader("Dépôt dans la poule…");
        const tx = await contract.registerForPool(BigInt(poolId), stakeWei, { value: totalWei });
        await tx.wait();
        // Confirmer le dépôt au backend : la poule ne démarre que lorsque TOUS
        // les joueurs ont confirmé → évite que le combat commence pendant que
        // le dernier joueur valide encore sa transaction dans son wallet.
        await confirmPoolDeposit(poolId, tx.hash);
        showToast("Mise verrouillée dans l'escrow de la poule !", "success");
        updateBalance();
        return true;
    } catch (err) {
        console.error("Erreur de dépôt en poule:", err);
        showToast("Échec du dépôt en poule : " + describeTxError(err), "error");
        return false;
    } finally {
        if (window.hideLoader) window.hideLoader();
    }
}

// Notifie le backend qu'un dépôt escrow de poule est confirmé (tx minée).
// Le backend ne lance le combat que lorsque TOUS les joueurs ont confirmé.
async function confirmPoolDeposit(poolId, txHash) {
    try {
        await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}/deposited`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ player_wallet: AppState.walletAddress, tx_hash: txHash || null })
        });
    } catch (e) {
        console.error("confirmPoolDeposit:", e);
    }
}

// Réclame la PART du joueur issue de la poule (répartition) via un voucher backend
// pour claimPoolShare. Chaque survivant récupère SON butin ; les éliminés ont 0.
async function claimPoolGains(poolId, playerAddress) {
    if (!contract || !AppState.walletAddress) return;
    if (poolId === null || poolId === undefined) return;
    if (AppState.claimingPool) return;
    AppState.claimingPool = true;
    try {
        const pool = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}`).then(r => r.json());
        if (!pool || pool.status !== 'finished') {
            showToast("La poule n'est pas terminée.", "info");
            return;
        }
        const me = pool.players
            ? pool.players.find(p => p.wallet_address.toLowerCase() === AppState.walletAddress.toLowerCase())
            : null;
        const myLoot = BigInt((me && me.loot) ? me.loot : '0');
        if (myLoot <= 0n) {
            showToast("Aucun butin à réclamer pour vous.", "info");
            return;
        }
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/withdraw/claim-pool-share-voucher`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                pool_id: Number(poolId),
                player_address: AppState.walletAddress
            })
        });
        const data = await res.json();
        if (!res.ok || !data.signature) {
            showToast("Bon de réclamation refusé : " + (data.error || 'Erreur inconnue'), "error");
            return;
        }
        showToast("Réclamation de votre part en cours...", "info");
        await prepareWalletForTx();
        await refreshWalletContract();
        if (window.showLoader) window.showLoader("Réclamation de votre butin…");
        const tx = await contract.claimPoolShare(BigInt(data.pool_id), BigInt(data.amount), BigInt(data.nonce), data.signature);
        await tx.wait();
        showToast(`🏆 ${ethers.formatEther(BigInt(data.amount))} TST récupérés !`, "success");
        updateBalance();
        return;
    } catch (err) {
        console.error("Erreur claim pool share:", err);
        showToast("Erreur lors de la réclamation : " + describeTxError(err), "error");
    } finally {
        AppState.claimingPool = false;
        if (window.hideLoader) window.hideLoader();
    }
}

async function executeMatchOnChain(e) {
    const isChallenger = (e.player1.toLowerCase() === AppState.walletAddress.toLowerCase());
    const opponent = isChallenger ? e.player2 : e.player1;

    document.getElementById('challenge-text').innerText = "Validation du dépôt en cours (MetaMask)...";
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

    // FIX ICDM (UI 2D) : afficher le layer 2D avec les combattants en idle
    // pendant l'attente MetaMask — contexte visuel du duel au lieu d'une
    // modale nue. Le combat ne démarre qu'au MatchReady.
    const myId2D = anim2DCharId(AppState.myChar, AppState.selectedCharacter ? AppState.selectedCharacter.id : 1);
    const oppId2D = anim2DCharId(AppState.opponentChar, 2);
    if (typeof window.showDepositPending2D === 'function') {
        window.showDepositPending2D(myId2D, oppId2D);
    }

    // FIX ICDM #1 : dépôt soumis (tx signée), le tx hash notifié au backend qui
    // vérifie le receipt. MatchReady (les DEUX dépôts confirmés) lance le
    // combat via launchCombat — jamais avant l'escrow des deux joueurs.
    const betAmount = AppState.currentBetAmountOffchain || AppState.defaultBetAmount || '0';
    AppState.depositsDone = false;
    AppState.pendingDepositMatchId = e.matchId;
    const txHash = await submitDepositTx(betAmount);
    if (!txHash) {
        console.error("[Match] Dépôt échoué — annulation du match.");
        showToast("Dépôt on-chain échoué — match annulé.", "error", 0);
        // Fix (a) : annuler le match côté serveur + prévenir l'adversaire.
        notifyDepositFailed(e.matchId, AppState.walletAddress);
        // Masquer le layer 2D d'attente (retour au lobby)
        if (typeof window.toggleAnim2D === 'function') window.toggleAnim2D(false);
        window.resetMatchState();
        navigateTo('screen-main');
        return;
    }
    notifyDepositToBackend(e.matchId, txHash);
    // Watchdog : si l'adversaire ne dépose pas, le serveur ANNULE et prévient
    // (visible) au lieu d'un forfait silencieux — cf. cancelFight backend.
    waitForOpponentDeposit(e.matchId);
}

// Soumet la tx register (MetaMask) et retourne le tx hash (ou null si échec).
async function submitDepositTx(betAmount) {
    if (!contract || !AppState.walletAddress || !betAmount || Number(betAmount) <= 0) return null;
    try {
        showToast(`Dépôt de ${betAmount} TST sur la blockchain...`, "info");
        const stakeWei = ethers.parseEther(String(betAmount));
        const feeBps = typeof getReadContract().feeBps === 'function' ? Number(await getReadContract().feeBps()) : 250;
        const feeWei = stakeWei * BigInt(feeBps) / 10000n;
        const totalWei = stakeWei + feeWei;
        showToast(`Dépôt de ${betAmount} TST (mise) + ${ethers.formatEther(feeWei)} TST (frais)...`, "info");
        if (!(await hasEnoughNative(totalWei))) return null;
        await prepareWalletForTx();
        await refreshWalletContract();
        if (window.showLoader) window.showLoader("Validation du dépôt on-chain…");
        const tx = await contract.register(stakeWei, { value: totalWei });
        const receipt = await tx.wait();
        showToast("Dépôt confirmé sur la blockchain !", "success");
        updateBalance();
        return receipt.hash || tx.hash;
    } catch (err) {
        console.error("Erreur de dépôt:", err);
        showToast("Échec du dépôt on-chain : " + describeTxError(err), "error");
        return null;
    } finally {
        if (window.hideLoader) window.hideLoader();
    }
}

// Notifie le backend que la tx de dépôt est soumise (receipt vérifié côté
// serveur, broadcast MatchReady quand les DEUX sont confirmés). Poll de secours
// si la tx n'est pas encore minée (HTTP 202).
async function notifyDepositToBackend(matchId, txHash) {
    const wallet = AppState.walletAddress;
    for (let attempt = 0; attempt < 20; attempt++) {
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/battle/deposited`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                    match_id: matchId,
                    wallet_address: wallet,
                    tx_hash: txHash
                })
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 202) {
                // pas encore minée : re-poster
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }
            if (res.ok) {
                console.log("[Match] Dépôt notifié au backend. Les deux confirmés :", !!data.both_deposited);
            } else {
                console.error("[Match] Notification de dépôt refusée :", data.message || data.error);
            }
            return;
        } catch (e) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }
    console.error("[Match] Impossible de notifier le backend du dépôt (20 essais).");
}

// Fix (a) : prévient le backend qu'un dépôt a échoué définitivement → le serveur
// annule le match et prévient l'adversaire (plus de forfait silencieux).
async function notifyDepositFailed(matchId, wallet) {
    try {
        await fetch(`${APP_CONFIG.API_BASE_URL}/battle/deposit-failed`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ match_id: matchId, wallet_address: wallet })
        });
        console.log("[Match] Dépôt échoué notifié au backend (match annulé).");
    } catch (e) {
        console.error("[Match] notifyDepositFailed:", e);
    }
}

// Watchdog côté DÉPOSANT : poll /battle/status (qui, côté serveur, ANNULE le
// match si un seul joueur a déposé après la deadline — cas « l'adversaire a
// perdu le réseau »). Sort proprement du lobby sur 'canceled' avant combat.
// S'arrête dès que le combat démarre (MatchReady → AppState.depositsDone).
async function waitForOpponentDeposit(matchId) {
    for (let i = 0; i < 30; i++) { // ~90 s
        await new Promise(r => setTimeout(r, 3000));
        if (AppState.depositsDone) return;             // combat lancé
        if (AppState.currentMatchId != matchId) return; // autre état
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/battle/status/${matchId}`, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) continue;
            const s = await res.json();
            // Filet de sécurité : si MatchReady a été MANQUÉ (reconnexion Reverb),
            // le serveur dit « les deux ont déposé » → on lance le combat ici.
            if (s.both_deposited && s.status === 'waiting_for_commits') {
                console.log("[Match] both_deposited vu au polling → lancement du combat (MatchReady manqué ?)");
                AppState.depositsDone = true;
                launchCombat({ matchId: matchId, player1: s.player1_wallet, player2: s.player2_wallet });
                return;
            }
            if (s.status === 'canceled') {
                notifyMatchCancelledOnce(matchId, "L'adversaire n'a pas déposé — match annulé.");
                if (typeof window.toggleAnim2D === 'function') window.toggleAnim2D(false);
                if (typeof window.resetMatchState === 'function') window.resetMatchState();
                navigateTo('screen-main');
                return;
            }
            if (s.status === 'completed') {
                showToast("Match terminé sans combat.", "info", 8000);
                if (typeof window.resetMatchState === 'function') window.resetMatchState();
                navigateTo('screen-main');
                return;
            }
        } catch (e) { /* réseau : retry au prochain tick */ }
    }
}

// FIX ICDM #1 : lance le combat — appelé par l'event MatchReady (les deux
// dépôts escrow confirmés on-chain).
function launchCombat(e) {
    const isChallenger = (e.player1.toLowerCase() === AppState.walletAddress.toLowerCase());
    const opponent = isChallenger ? e.player2 : e.player1;

    document.getElementById('challenge-modal').style.display = 'none';
    document.getElementById('challenge-text').innerText = "Dépôts confirmés — que le combat commence !";
    // FIX ICDM (UI 2D) : restaurer le HUD standard (le texte "EN ATTENTE DES
    // DÉPÔTS" ne doit pas persister pendant le combat).
    if (typeof window.restoreAnim2DHud === 'function') window.restoreAnim2DHud();
    AppState.lastActionTime = Date.now();
    launchGodot(opponent);
}


// --- GÉNÉRATION ÉCRAN BATTLE ROYALE ---
async function renderBRLobby() {
    const list = document.getElementById('br-list');
    list.innerHTML = `<p class="empty-state">${tr('searchingPools')}</p>`;

    try {
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/pools`);
        const pools = await res.json();
        
        list.innerHTML = '';
        if (pools.length === 0) {
            list.innerHTML = `<p class="empty-state">${tr('noPools')}</p>`;
            return;
        }

        pools.forEach(lobby => {
            const inProgress = lobby.status === 'active';
            const isFull = inProgress || lobby.players_count >= lobby.max_players;
            const progress = (lobby.players_count / lobby.max_players) * 100;
            
            const card = document.createElement('div');
            card.className = 'br-card';
            card.innerHTML = `
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <div class="br-header">
                    <div>
                        <h3 style="color: white; font-size: 1.1rem;">${tr('poolTitle', { id: lobby.id })} ${lobby.penalty_mode == 1 ? tr('poolAllIn') : ''}${inProgress ? ' <span style="color: var(--cyan-spark); font-size: 0.8rem;">' + tr('poolInProgress') + '</span>' : ''}</h3>
                        <span class="br-tag">${fmtTST(lobby.entry_fee)} TST</span>
                    </div>
                    <div class="br-players">
                        <span>${lobby.players_count}</span>
                        <span style="color: var(--text-gray-400)">/${lobby.max_players}</span>
                    </div>
                </div>
                <button class="btn btn-join ${isFull ? 'watch' : ''}" onclick="${isFull ? 'watchPool(' + lobby.id + ')' : 'joinPool(' + lobby.id + ')'}">
                    ${isFull ? tr('poolWatch') : tr('poolJoin')}
                </button>
            `;
            list.appendChild(card);
        });
    } catch(e) {
        list.innerHTML = `<p class="empty-state">${tr('poolsError')}</p>`;
    }
}

// --- LANCEMENT DU JEU GODOT ---
// (Le moteur Godot est maintenant chargé nativement depuis index.html au lancement de la page)

// --- PONT ANIM 2D (préloader de combat pendant le chargement Godot) ---
// Renvoie true si le layer 2D est actuellement affiché (Godot pas encore prêt,
// ou mode ?mode2d=1). False = Godot 3D actif → tous les appels 2D deviennent no-op.
function isAnim2DLayerVisible() {
    const layer = document.getElementById('anim2d-layer');
    if (!layer) return false;
    return layer.style.display !== 'none' && !layer.classList.contains('hidden');
}

// Convertit "p1".."p4" (ou un id numérique) en entier 1-4 valable pour anim2d.js.
function anim2DCharId(charValue, fallback) {
    const n = parseInt(String(charValue || '').replace('p', ''), 10);
    return (n >= 1 && n <= 4) ? n : (fallback || 1);
}

// Met à jour les combattants du preloader 2D (idle face à face).
// No-op si le layer 2D est masqué (Godot 3D déjà actif) ou si anim2d.js est absent.
window.syncFighters2D = function() {
    if (typeof window.setFighters2D !== 'function' || !isAnim2DLayerVisible()) return;
    const myId = anim2DCharId(AppState.myChar, AppState.selectedCharacter ? AppState.selectedCharacter.id : 1);
    const oppId = anim2DCharId(AppState.opponentChar, 2);
    window.setFighters2D(myId, oppId);
    console.log("[App2] anim2D : combattants en idle " + myId + " vs " + oppId);
};

// Déclenche la séquence de combat 2D pour un résultat. myResult : 1 = victoire,
// 2 = défaite, 0 = égalité. MON perso est affiché à gauche (p1) → winner 2D = 1 si j'ai gagné.
window.playRound2D = function(myResult) {
    if (typeof window.triggerRound2D !== 'function' || !isAnim2DLayerVisible()) return;
    const myId = anim2DCharId(AppState.myChar, AppState.selectedCharacter ? AppState.selectedCharacter.id : 1);
    const oppId = anim2DCharId(AppState.opponentChar, 2);
    const winner2D = (myResult === 1) ? 1 : ((myResult === 2) ? 2 : 0); // 0 → choix aléatoire côté anim2d
    window.triggerRound2D(winner2D, myId, oppId);
    console.log("[App2] anim2D : séquence de round déclenchée (résultat " + myResult + ").");
};

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

    // Si Godot 3D est déjà chargé, l'arène reste 3D : s'assurer que le
    // preloader 2D est masqué (un duel lancé après le chargement de Godot
    // ne doit pas retomber dans le layer 2D — fix "duel reste en 2D").
    if (typeof window.ensure3DActive === 'function') {
        window.ensure3DActive();
    }

    // Mettre en scène le duel dans le preloader 2D si Godot 3D n'est pas encore prêt.
    window.syncFighters2D();

    // Barre de choix de coup en mode 2D (Godot pas encore prêt).
    if (isAnim2DLayerVisible()) {
        window.showMoveBar2D(true);
    }

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
    if (!loser || !AppState.walletAddress) return;
    // ICDM : le règlement on-chain (settleLoser) est soumis par le SERVEUR via
    // le backend signer — le gagnant ne signe rien (0 popup MetaMask).
    // FIX ICDM #2 : la route attend maintenant activement les dépôts on-chain
    // (jusqu'à 30s) avant de régler. Si elle répond noop (dépôt jamais arrivé),
    // on RETENTE toutes les 5s (jusqu'à 2 min) — le règlement n'est plus perdu.
    try {
        showToast("Consolidation du pot en arrière-plan...", "info");
        for (let attempt = 0; attempt < 24; attempt++) {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/battle/settle`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                    winner: AppState.walletAddress,
                    loser: loser
                })
            });
            const data = await res.json();
            if (!res.ok) {
                showToast("Règlement automatique refusé : " + (data.message || data.error || 'Erreur inconnue'), "error");
                return;
            }
            if (data.status === 'noop') {
                // Le règlement a été différé (dépôt pas encore miné) : retry
                console.log("[Match] Règlement différé (dépôt adversaire en attente)... tentative " + (attempt + 1));
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }
            console.log("[Match] Règlement on-chain effectué par le serveur (gasless).", data.script_output || '');
            showToast("Pot consolidé automatiquement ! Vous pouvez réclamer vos gains.", "success");
            updateBalance();
            return;
        }
        showToast("Consolidation en attente : le règlement se fera dès que les dépôts seront visibles on-chain.", "info");
    } catch (err) {
        console.error("Erreur lors du règlement serveur:", err);
        // Fallback UX : si la route échoue, on indique que la consolidation est
        // retentée par la consolidation de poule / le prochain refresh.
        showToast("Règlement différé : votre gain sera crédité sous quelques secondes.", "info");
    }
}

window.animationFinished = function() {
    console.log("Animation de combat terminée !");
    
    if (!AppState.pendingResult) {
        console.log("animationFinished ignoré car pas de pendingResult.");
        return;
    }

    const { godotResult, ethPayout } = AppState.pendingResult;
    
    // Jingle de fin de combat (victoire / égalité / défaite)
    if (typeof window.AUDIO_FX !== 'undefined') {
        if (godotResult === 1 && window.AUDIO_FX.victory) window.AUDIO_FX.victory();
        else if (godotResult === 0 && window.AUDIO_FX.draw) window.AUDIO_FX.draw();
        else if (window.AUDIO_FX.defeat) window.AUDIO_FX.defeat();
    }

    if (godotResult === 1) {
        showToast(tr('victoryGains', { amount: ethPayout }), 'success');
    } else if (godotResult === 0) {
        showToast(tr('drawRefund'), 'info');
    } else {
        showToast(tr('defeatMsg'), 'error');
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
        // Rafraîchit le widget « survivants » + le butin (léger délai : le
        // backend résout le combat et applique le transfert de butin).
        setTimeout(() => {
            if (AppState.currentScreen === 'screen-pool-room' && AppState.currentPoolId) renderPoolRoom();
        }, 1500);
    }

    // Le règlement on-chain (settleLoser) peut prendre quelques secondes :
    // re-synchroniser le solde à réclamer pour masquer/afficher le claim
    // correctement. FIX : la boucle courte (15s) s'arrêtait AVANT que le
    // settle backend ne consolide (le settle peut attendre 30s+ les dépôts)
    // → le bouton n'apparaissait jamais. On garde un polling LONG qui se
    // répète tant que la page reste sur le lobby (toutes les 4s), et qui
    // s'arrête dès que le bouton est affiché ou après 5 min.
    (async () => {
        for (let i = 0; i < 75; i++) {
            await new Promise(r => setTimeout(r, 4000));
            // Le polling s'arrête si un match recommence
            if (AppState.pendingResult || AppState.currentMatchId) return;
            const container = document.getElementById('pending-funds-container');
            const isVisible = container && container.style.display === 'block';
            await refreshClaimable();
            // Si le bouton vient de s'afficher (gain consolidé), on peut stopper
            if (container && container.style.display === 'block' && !isVisible) {
                showToast("Votre gain est disponible ! Cliquez Réclamer.", "success");
                return;
            }
        }
    })();

    // Capturer l'adversaire du duel AVANT le reset (resetMatchState le nullifie)
    const rematchOpponentId = (!AppState.currentPoolId)
        ? (AppState.currentTargetId || AppState.currentChallenger || null)
        : null;

    // Réinitialisation complète des états (incluant le statut serveur online)
    resetMatchState();
    const isPoolFight = !!AppState.currentPoolId;
    navigateTo(isPoolFight ? 'screen-pool-room' : 'screen-main');
    
    AppState.pendingResult = null;

    // Rematch en duel : proposer une revanche contre le même adversaire
    if (!isPoolFight && rematchOpponentId) {
        showRematchBanner(rematchOpponentId);
    }
    AppState.currentTargetId = null;
    AppState.currentChallenger = null;
    
    // Traiter le prochain round s'il était en attente
    if (AppState.pendingPoolRoundEvent) {
        console.log("Traitement du round mis en attente...");
        const e = AppState.pendingPoolRoundEvent;
        AppState.pendingPoolRoundEvent = null;
        setTimeout(() => handlePoolRoundStarted(e), 1500); // Petit délai pour laisser l'UI respirer
    }
};

// Affiche une bannière "REMATCH" au-dessus de la liste des joueurs (duel uniquement).
function showRematchBanner(opponentId) {
    const list = document.getElementById('players-list');
    if (!list) return;
    const banner = document.createElement('div');
    banner.className = 'rematch-banner';
    const shortName = (opponentId || '').substring(0, 6) + '...';
    banner.innerHTML = `
        <div class="rematch-info">Revanche contre <strong>${shortName}</strong> ?</div>
        <button class="btn btn-challenge" id="btn-rematch-yes">REMATCH</button>
        <button class="btn btn-secondary" id="btn-rematch-no">Plus tard</button>
    `;
    list.prepend(banner);
    document.getElementById('btn-rematch-yes').addEventListener('click', async () => {
        banner.remove();
        const defaultBet = AppState.defaultBetAmount || "10";
        await initiateChallenge(opponentId, Number(defaultBet));
    });
    document.getElementById('btn-rematch-no').addEventListener('click', () => banner.remove());
}

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

            // 2D : désactiver les boutons de la barre de choix après le commit.
            const moveBar2D = document.getElementById('anim2d-move-bar');
            if (moveBar2D && isAnim2DLayerVisible()) {
                moveBar2D.querySelectorAll('.anim2d-move-btn').forEach(b => b.disabled = true);
            }

            startUnifiedMatchPolling();

        } catch (e) {
            console.error("Erreur Web3 (Commit/Reveal) :", e);
        }
    }
};

// === MODE 2D : barre de choix du coup (pipeline identique à Godot) ===
// Appelée par les boutons de #anim2d-move-bar. Réutilise submitMove (pipeline
// complet : secret → hash → signature session → POST /battle/commit → polling).
// Verrou synchrone (_move2DPending) : submitMove ne pose hasCommitted=true qu'après
// ses awaits (secret/signature) — un double-clic dans cette fenêtre doit être bloqué
// ici pour ne générer qu'un seul commit.
window._move2DPending = false;
window.submitMove2D = function(moveNum) {
    if (!isAnim2DLayerVisible()) return;              // 3D active → ne jamais accepter
    if (AppState.hasCommitted) {
        console.log("[App2] Coup déjà soumis (2D).");
        return;
    }
    if (window._move2DPending) {
        console.log("[App2] Commit déjà en cours (2D) : clic ignoré.");
        return;
    }
    if (!AppState.currentMatchId) {
        console.log("[App2] Aucun match actif : bouton 2D ignoré.");
        return;
    }
    console.log("[App2] Coup choisi en 2D :", moveNum);
    window._move2DPending = true;

    // Feedback immédiat : désactiver les boutons dès le clic (hasCommitted n'est
    // posé qu'après la signature) — la post-vérification reste dans submitMove.
    const barLock = document.getElementById('anim2d-move-bar');
    if (barLock) barLock.querySelectorAll('.anim2d-move-btn').forEach(b => b.disabled = true);

    Promise.resolve(window.submitMove(moveNum)).then(() => {
        window._move2DPending = false;
        // Échec avant commit (ex : signature refusée) → rénabler pour nouvelle tentative.
        if (!AppState.hasCommitted && isAnim2DLayerVisible()) {
            const barRetry = document.getElementById('anim2d-move-bar');
            if (barRetry) barRetry.querySelectorAll('.anim2d-move-btn').forEach(b => b.disabled = false);
        }
    }).catch(e => {
        window._move2DPending = false;
        console.error("[App2] Erreur submitMove2D :", e);
        if (!AppState.hasCommitted && isAnim2DLayerVisible()) {
            const barRetry = document.getElementById('anim2d-move-bar');
            if (barRetry) barRetry.querySelectorAll('.anim2d-move-btn').forEach(b => b.disabled = false);
        }
    });
};

// Affiche/masque la barre de choix 2D. Sans argument : inverse l'état courant.
// Aucun effet si la barre n'existe pas ; le masquage parent (#anim2d-layer.hidden)
// suffit à la cacher quand Godot 3D devient actif.
window.showMoveBar2D = function(show) {
    const bar = document.getElementById('anim2d-move-bar');
    if (!bar) return;
    if (typeof show === 'undefined') show = bar.classList.contains('hidden');
    bar.classList.toggle('hidden', !show);
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

                // Preloader 2D : déclencher la séquence de combat si Godot n'est pas prêt.
                window.playRound2D(godotResult);

                // Masquer la barre de choix 2D le temps de l'animation de résultat.
                window.showMoveBar2D(false);

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


// --- ROTATION ALÉATOIRE DU FOND D'ÉCRAN ---
// Les images (bg/1.jpg .. bg/N.jpg) tournent de façon aléatoire à
// intervalle régulier, avec crossfade entre deux couches .ui-bg.
const BG_CONFIG = {
    images: ['bg/1.jpg', 'bg/2.jpg', 'bg/3.jpg', 'bg/4.jpg'],
    intervalMs: 15000 // 15 s entre chaque changement de décor
};

const BGRotation = {
    index: -1,
    timer: null,

    // Précharge toutes les images pour éviter tout flash au premier
    // changement de décor (les données restent en cache navigateur).
    preload() {
        BG_CONFIG.images.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    },

    // Affiche un décor aléatoire différent du précédent (si possible)
    // sur la couche d'attente, puis opère le crossfade.
    next() {
        const list = BG_CONFIG.images;
        if (!list.length) return;
        const active = document.getElementById('ui-bg');
        const incoming = document.getElementById('ui-bg-next');
        if (!active || !incoming) return;

        let i;
        do {
            i = Math.floor(Math.random() * list.length);
        } while (i === this.index && list.length > 1);
        this.index = i;

        incoming.style.backgroundImage = `url('${list[i]}')`;
        // Le crossfade : on remonte la couche d'attente pendant que
        // l'ancienne descend, puis on échange les ids pour le prochain cycle.
        incoming.style.opacity = '1';
        active.style.opacity = '0';
        incoming.id = 'ui-bg';
        active.id = 'ui-bg-next';
    },

    start() {
        this.preload();
        // Premier décor affiché immédiatement (sans fondu) au chargement.
        const active = document.getElementById('ui-bg');
        const incoming = document.getElementById('ui-bg-next');
        if (active && incoming && BG_CONFIG.images.length) {
            this.index = Math.floor(Math.random() * BG_CONFIG.images.length);
            active.style.backgroundImage = `url('${BG_CONFIG.images[this.index]}')`;
        }
        this.timer = setInterval(() => this.next(), BG_CONFIG.intervalMs);
    }
};


// --- INITIALISATION AU CHARGEMENT ---
document.addEventListener('DOMContentLoaded', () => {
    checkURLParameters();
    lucide.createIcons();
    renderCharacterSelect();
    renderDuelLobby();
    renderBRLobby();

    // Lance la rotation aléatoire du fond d'écran
    BGRotation.start();

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

    // Auto-entrée depuis le portail Hôte App 1 si paramètre ?mode=DUEL ou ?mode=BATTLE
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    const walletParam = urlParams.get('wallet');

    // Langue injectée par le portail hôte (?lang= / ?language=) : appliquée
    // AVANT tout affichage (priorité sur la détection localStorage/navigateur).
    const portalLang = urlParams.get('lang') || urlParams.get('language');
    if (portalLang && window.I18N) {
        const norm = String(portalLang).trim().toLowerCase().split(/[-_]/)[0];
        if (window.I18N.SUPPORTED_LANGUAGES.includes(norm)) {
            console.log("[App2] Langue reçue du portail :", norm);
            AppState.language = norm;
            window.I18N.applyLanguage(norm);
        }
    }

    if (modeParam) {
        const mode = modeParam.toUpperCase();
        if (mode === 'DUEL' || mode === 'BATTLE') {
            console.log("[App2] Entrée automatique depuis le portail hôte App 1. Mode :", mode);
            AppState.selectedGameMode = mode;
            // Nettoyer l'URL pour éviter la boucle de rechargement
            history.replaceState(null, '', window.location.pathname);
            // Utiliser le wallet passé par le portail (cross-origin, localStorage différent).
            // Si le wallet correspond à un compte Hardhat (dev login), on récupère aussi
            // sa clé privée pour pouvoir signer les commits/transactions on-chain.
            if (walletParam) {
                AppState.walletAddress = walletParam;
                console.log("[App2] Wallet reçu du portail :", walletParam);
                // (Plus de récupération de clé privée Hardhat : mock de dev supprimé.)
            }
            window.connectWallet();
            return;
        }
    }

    // Flow autonome classique : splash (2.5s) → sélection de la langue
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

function onPoolEndConditionChange() {
    const v = document.getElementById('pool-end-condition').value;
    const countGroup = document.getElementById('pool-end-count-group');
    const secondsGroup = document.getElementById('pool-end-seconds-group');
    if (countGroup) countGroup.style.display = (v === 'remaining') ? 'block' : 'none';
    if (secondsGroup) secondsGroup.style.display = (v === 'time') ? 'block' : 'none';
}

async function confirmCreatePool() {
    const fee = document.getElementById('pool-entry-fee').value;
    const max = document.getElementById('pool-max-players').value;
    const mode = document.getElementById('pool-penalty-mode').value;
    const isPrivate = document.getElementById('pool-is-private').checked;
    const endCondition = document.getElementById('pool-end-condition').value;
    let endCount = null, endSeconds = null;
    if (endCondition === 'remaining') endCount = Number(document.getElementById('pool-end-count').value) || 2;
    if (endCondition === 'time') endSeconds = Number(document.getElementById('pool-end-seconds').value) || 600;

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
                owner_wallet: AppState.walletAddress,
                end_condition: endCondition,
                end_count: endCount,
                end_seconds: endSeconds
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
            body: JSON.stringify({ player_wallet: AppState.walletAddress, character_id: AppState.selectedCharacter.id, player_name: AppState.playerName || null })
        });

        if(!joinRes.ok) throw new Error("Failed to join pool");

        AppState.currentPoolId = Number(poolId);
        AppState.currentPoolFee = Number(fee);

        if (isPrivate && createdPool.pool.invite_code) {
            AppState.currentInviteCode = createdPool.pool.invite_code;
        } else {
            AppState.currentInviteCode = null;
        }

        showToast("Poule créée et rejointe ! ID: " + poolId, "success");

        // Entrer dans le salon AVANT le dépôt : le lancement du combat (broadcast
        // émis quand TOUS les dépôts sont confirmés) arrive alors qu'on est déjà
        // dans la salle, et non pendant la validation wallet.
        renderBRLobby();
        navigateTo('screen-pool-room');
        renderPoolRoom();
        subscribeToPoolRound(Number(poolId));

        // Le créateur verrouille aussi sa mise dans l'escrow (comme tout participant).
        if (AppState.currentPoolFee > 0) {
            const deposited = await depositForPool(poolId, AppState.currentPoolFee);
            if (!deposited) {
                showToast("Dépôt dans l'escrow échoué.", "error");
            }
        }
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
            body: JSON.stringify({ player_wallet: AppState.walletAddress, character_id: AppState.selectedCharacter.id, player_name: AppState.playerName || null })
        });

        if(!joinRes.ok) {
            const err = await joinRes.json().catch(() => ({}));
            if ((err.error || '').toLowerCase().includes('full')) {
                showToast(tr('poolFullWatch'), "info");
                return watchPool(poolId);
            }
            throw new Error(err.error || "Failed to join pool");
        }
        
        // Fetch pool details to get fee
        const detailsRes = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}`);
        const poolData = await detailsRes.json();

        subscribeToPoolRound(poolId);

        AppState.currentPoolId = poolId;
        AppState.currentPoolFee = poolData.entry_fee;
        showToast("Poule rejointe !", "success");

        // Entrer dans le salon AVANT le dépôt (le combat ne démarre qu'après la
        // confirmation de tous les dépôts → on est déjà dans la salle à ce moment).
        navigateTo('screen-pool-room');
        renderPoolRoom();

        // Dépôt on-chain de la mise d'entrée (escrow de la poule) à la jonction
        if (AppState.currentPoolFee > 0) {
            const ok = await depositForPool(poolId, AppState.currentPoolFee);
            if (!ok) showToast("Dépôt dans l'escrow échoué.", "error");
        }
        
    } catch(e) {
        console.error(e);
        showToast(e.message || "Erreur lors de l'intégration à la poule", "error");
    }
}

async function watchPool(poolId) {
    try {
        AppState.poolSpectator = true;
        AppState.currentPoolId = Number(poolId);
        const detailsRes = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${poolId}`);
        const poolData = await detailsRes.json();
        AppState.currentPoolFee = poolData.entry_fee;
        subscribeToPoolRound(Number(poolId));
        navigateTo('screen-pool-room');
        renderPoolRoom();
        showToast(tr('spectatorMode'), "info");
    } catch (e) {
        console.error(e);
        showToast("Impossible d'ouvrir le salon en spectateur", "error");
    }
}

function subscribeToPoolRound(poolId) {
    if (window.poolChannel) {
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
            document.getElementById('pool-room-status').innerText = isWinner ? tr('youAreChampion') : tr('championIs', { winner: e.winner.slice(0,10) });
            document.getElementById('pool-room-status').style.color = isWinner ? 'gold' : 'var(--color-red)';
            showToast(isWinner ? tr('youAreChampion') : tr('championIs', { winner: e.winner.slice(0,10) }), isWinner ? 'success' : 'info');

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
                quitText.innerText = isWinner ? tr('quitPoolClaim') : tr('quitPoolBack');
            }
            return;
        }

        document.getElementById('pool-room-status').innerText = tr('poolRoundInProgress');
        document.getElementById('pool-room-status').style.color = "var(--color-red)";
        
        if (e.waitingPlayer && e.waitingPlayer.toLowerCase() === AppState.walletAddress.toLowerCase()) {
            showToast(tr('poolExempted'), "info");
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
    document.getElementById('pool-room-title').innerText = tr('poolTitle', { id: AppState.currentPoolId });
    
    try {
        const res = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${AppState.currentPoolId}`);
        const poolData = await res.json();

        if (poolData.invite_code) {
            AppState.currentInviteCode = poolData.invite_code;
            document.getElementById('pool-invite-container').style.display = 'block';
            const inviteUrl = window.location.origin + window.location.pathname + "?invite=" + poolData.invite_code;
            document.getElementById('pool-invite-link').value = inviteUrl;
            document.getElementById('pool-invite-code').value = poolData.invite_code;
            // QR = code d'invitation SEUL (pas l'URL) : le scanner d'un autre
            // joueur extrait le code et l'injecte dans le champ battle →
            // rejoindre automatique, indépendant de l'origine hôte.
            AppState.currentInviteQRPayload = poolData.invite_code;

            // Mise à jour automatique : si le QR code était déjà affiché
            // (ex: recréation de poule), on le régénère immédiatement avec le nouveau code !
            const qrBox = document.getElementById('pool-invite-qr');
            if (qrBox && qrBox.style.display !== 'none') {
                renderQRCodeInBox(qrBox, poolData.invite_code);
            }
        } else {
            document.getElementById('pool-invite-container').style.display = 'none';
            const qrBox = document.getElementById('pool-invite-qr');
            if (qrBox) {
                qrBox.style.display = 'none';
                qrBox.innerHTML = '';
            }
        }
        
        const pCount = poolData.players_count || 1;
        const mPlayers = poolData.max_players;

        const players = poolData.players || [];
        const me = players.find(p => AppState.walletAddress && p.wallet_address.toLowerCase() === AppState.walletAddress.toLowerCase());
        const iAmAlive = !!(me && me.status === 'alive');
        AppState.poolSpectator = !iAmAlive;

        document.getElementById('pool-room-count').innerText = pCount + " / " + mPlayers;

        renderPoolPlayers(players);

        const btnQuit = document.getElementById('btn-quit-pool');
        const quitText = document.getElementById('quit-pool-text');
        const statusEl = document.getElementById('pool-room-status');
        if (btnQuit && quitText && statusEl) {
            if (poolData.status === 'finished') {
                const meFin = players.find(p => AppState.walletAddress && p.wallet_address.toLowerCase() === AppState.walletAddress.toLowerCase());
                const myLootFin = BigInt((meFin && meFin.loot) ? meFin.loot : '0');
                const canClaim = myLootFin > 0n;
                const winnerPlayer = pickPoolWinner(players);
                const winnerWallet = winnerPlayer ? winnerPlayer.wallet_address.toLowerCase() : null;

                btnQuit.disabled = false;
                quitText.innerText = canClaim ? tr('quitPoolClaim') : tr('quitPoolBack');
                statusEl.innerText = canClaim
                    ? tr('poolClaimYourLoot', { amount: formatLootTST(myLootFin.toString()) })
                    : (winnerWallet ? tr('championIs', { winner: winnerWallet.slice(0,10) }) : tr('poolFinishedNoWinner'));
                statusEl.style.color = canClaim ? 'gold' : 'var(--color-red)';
                updateBalance();
            } else if (AppState.poolSpectator) {
                // Spectateur (éliminé ou observateur externe) : suit la poule
                // et peut sortir à tout moment.
                btnQuit.disabled = false;
                quitText.innerText = tr('quitPoolDefault');
                statusEl.innerText = tr('spectatorStatus');
                statusEl.style.color = 'var(--cyan-spark)';
            } else if (pCount >= mPlayers) {
                btnQuit.disabled = true;
                quitText.innerText = tr('quitPoolMatches');
                statusEl.innerText = tr('poolWaitingDeposits');
                statusEl.style.color = '';
            } else {
                btnQuit.disabled = false;
                quitText.innerText = tr('quitPoolDefault');
                statusEl.innerText = tr('poolWaiting');
                statusEl.style.color = '';
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

    // Rafraîchissement périodique du salon : permet aux SPECTATEURS et aux
    // ÉLIMINÉS de suivre la liste des survivants + le butin en direct (audit).
    if (AppState.poolRefreshTimer) clearTimeout(AppState.poolRefreshTimer);
    if (AppState.currentPoolId && AppState.currentScreen === 'screen-pool-room' && !AppState.currentMatchId) {
        AppState.poolRefreshTimer = setTimeout(() => {
            if (AppState.currentPoolId && AppState.currentScreen === 'screen-pool-room' && !AppState.currentMatchId) {
                renderPoolRoom();
            }
        }, 5000);
    }
}

// --- Économie de butin : helpers d'affichage ---

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// TST (chiffre, peut être "0.50000000") → affichage propre sans zéros inutiles
function fmtTST(v) {
    const n = Number(v);
    return isFinite(n) ? String(n) : String(v);
}

// wei (string) → TST lisible, TOUJOURS 4 décimales (ex: 10.0000 / 2.1500)
function formatLootTST(weiStr) {
    try {
        const wei = BigInt(weiStr || '0');
        const whole = wei / 1000000000000000000n;
        const frac = wei % 1000000000000000000n;
        const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
        return `${whole}.${fracStr}`;
    } catch (e) {
        return '0.0000';
    }
}

// MVP : champion = plus gros butin (parmi les survivants si possible)
function pickPoolWinner(players) {
    if (!players || players.length === 0) return null;
    const alive = players.filter(p => p.status === 'alive');
    const pool = alive.length > 0 ? alive : players;
    return pool.slice().sort((a, b) => {
        try {
            const la = BigInt(a.loot || '0');
            const lb = BigInt(b.loot || '0');
            return lb > la ? 1 : (lb < la ? -1 : 0);
        } catch (e) { return 0; }
    })[0] || null;
}

// Widget « survivants » temps réel : liste + butin + état
function renderPoolPlayers(players) {
    const box = document.getElementById('pool-players-list');
    if (!box) return;

    if (!players || players.length === 0) {
        box.innerHTML = `<div class="list-item" style="opacity:.5;">${tr('poolWaiting')}</div>`;
        return;
    }

    const sorted = players.slice().sort((a, b) => {
        try {
            const la = BigInt(a.loot || '0');
            const lb = BigInt(b.loot || '0');
            return lb > la ? 1 : (lb < la ? -1 : 0);
        } catch (e) { return 0; }
    });

    box.innerHTML = '';
    sorted.forEach(p => {
        const isMe = AppState.walletAddress && p.wallet_address.toLowerCase() === AppState.walletAddress.toLowerCase();
        const eliminated = p.status === 'eliminated';
        const row = document.createElement('div');
        row.className = 'list-item';
        row.style.opacity = eliminated ? '0.45' : '1';
        const short = p.wallet_address.slice(0, 6) + '…' + p.wallet_address.slice(-4);
        const nameLabel = p.player_name
            ? `<strong style="color:#fff;">${escapeHtml(p.player_name)}</strong> <span style="font-family:monospace; color:var(--text-muted); font-size:12px;">${short}</span>`
            : `<span style="font-family:monospace;">${short}</span>`;
        row.innerHTML = `
            <span class="br-tag" style="${eliminated ? 'filter:grayscale(1);' : ''}">${isMe ? '★ ' : ''}${p.character_id ? 'P' + p.character_id : '?'}</span>
            <span style="flex:1;">${nameLabel}</span>
            <span style="color:gold; font-weight:700;">${formatLootTST(p.loot)} TST</span>
            <span style="color:${eliminated ? 'var(--color-red)' : 'var(--cyan-spark)'}; font-size:11px; margin-left:8px;">
                ${eliminated ? tr('lootOut') : tr('lootAlive')}
            </span>
        `;
        box.appendChild(row);
    });
}

async function checkPoolElimination(godotResult, matchId) {
    try {
        if (godotResult === 2) { // Loser
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/pools/${AppState.currentPoolId}`);
            const data = await res.json();

            const me = data.players.find(p => p.wallet_address.toLowerCase() === AppState.walletAddress.toLowerCase());
            if (!me || me.status === 'eliminated') {
                // Éliminé : on NE quitte PAS le salon — le joueur reste en
                // spectateur pour auditer la suite de la poule (liste des
                // survivants + butin en direct).
                AppState.poolSpectator = true;
                showToast(tr('poolEliminatedSpectator'), "info");
                if (AppState.currentScreen !== 'screen-pool-room') navigateTo('screen-pool-room');
                renderPoolRoom();
            } else if (AppState.currentScreen === 'screen-pool-room') {
                renderPoolRoom();
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
                // Répartition : chaque survivant réclame SA part (butin final).
                // Les éliminés ont loot=0 → rien à réclamer.
                const meQ = poolData.players
                    ? poolData.players.find(p => p.wallet_address.toLowerCase() === AppState.walletAddress.toLowerCase())
                    : null;
                const myLootQ = meQ ? BigInt(meQ.loot || '0') : 0n;
                if (myLootQ > 0n) {
                    await claimPoolGains(AppState.currentPoolId, AppState.walletAddress);
                }
                showToast(tr('poolClosePanel'), "success");
            } else {
                showToast(tr('poolLeftInterface'), "info");
            }
        } catch(e) {
            console.error("Erreur lors de la sortie de poule:", e);
        }
    }

    isQuitting = false;
    if (AppState.poolRefreshTimer) { clearTimeout(AppState.poolRefreshTimer); AppState.poolRefreshTimer = null; }
    AppState.poolSpectator = false;
    AppState.currentPoolId = null;
    AppState.currentInviteCode = null;
    AppState.currentInviteQRPayload = null;
    const qrBox = document.getElementById('pool-invite-qr');
    if (qrBox) {
        qrBox.style.display = 'none';
        qrBox.innerHTML = '';
    }
    if(window.poolChannel) {
        window.echoInstance.leave('pool.' + window.poolChannel);
        window.poolChannel = null;
    }
    navigateTo('screen-br');
    renderBRLobby();
}
