// 1. ÉTAT GLOBAL DE L'APPLICATION
const AppState = {
    currentScreen: 'screen-character',
    selectedCharacter: null,
    walletAddress: null,
    currentChallenger: null, 
    currentTargetId: null, 
    pendingChallengeParam: null, 
    defaultBetAmount: localStorage.getItem('web3combat_bet_amount') || '10',
    currentPoolId: null,
    currentPoolFee: 0,
    pendingPoolParam: null
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
    const poolId = urlParams.get('pool');
    if(poolId) {
        AppState.pendingPoolParam = poolId;
    }
}

// 3. FONCTIONS DE NAVIGATION ET D'INITIALISATION
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    AppState.currentScreen = screenId;
    lucide.createIcons();
    
    if(screenId === 'screen-duel' && AppState.pendingChallengeParam) {
        const searchInput = document.getElementById('search-input');
        searchInput.value = AppState.pendingChallengeParam;
        filterLobby(AppState.pendingChallengeParam);
        AppState.pendingChallengeParam = null;
    }
}

// --- GÉNÉRATION ÉCRAN PERSONNAGES ---
let provider;
let signer;
let contract;
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

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
    if (typeof ethers !== 'undefined' && typeof COMBAT_GAME_ABI !== 'undefined') {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        signer = new ethers.Wallet(AppState.privateKey, provider);
        contract = new ethers.Contract(CONTRACT_ADDRESS, COMBAT_GAME_ABI, signer);
        
        // Fetch balance
        updateBalance();
        
        // Timeout Checker
        setInterval(async () => {
            if (AppState.currentMatchId && AppState.lastActionTime) {
                // If we are waiting for Godot, we check if 25 seconds passed
                if (Date.now() - AppState.lastActionTime > 25000) {
                    try {
                        const m = await contract.matches(AppState.currentMatchId);
                        if(m[9] != 4 && m[9] != 5) { // not Finished, not Canceled
                            console.log("Tentative de réclamation de forfait (Timeout)...");
                            const tx = await contract.claimTimeout(AppState.currentMatchId);
                            await tx.wait();
                            console.log("Transaction Timeout confirmée !");
                            // Ne SURTOUT PAS mettre currentMatchId à null ici, l'Event s'en charge !
                        }
                    } catch(e) {}
                }
            }
        }, 5000);

        // Listen to events
        contract.on("ChallengeCreated", (matchId, challenger, target, betAmount, challengerChar) => {
            if (target.toLowerCase() === AppState.walletAddress.toLowerCase()) {
                console.log("Web3: Défi reçu !", matchId);
                AppState.currentMatchId = matchId;
                AppState.currentChallenger = challenger;
                AppState.currentBetAmount = betAmount;
                AppState.opponentChar = "p" + challengerChar;
                
                // Si c'est un pool match
                if (AppState.currentPoolId) {
                    executeAcceptPoolOnChain(matchId);
                } else {
                    executeAcceptOnChain(matchId, betAmount);
                }
            } else if (challenger.toLowerCase() === AppState.walletAddress.toLowerCase()) {
                console.log("Web3: Mon défi a été créé sur la blockchain !", matchId);
                AppState.currentMatchId = matchId;
                AppState.currentTargetId = target;
                AppState.currentBetAmount = betAmount;
                AppState.myChar = "p" + challengerChar;
            }
        });
        
        contract.on("ChallengeAccepted", (matchId, targetChar) => {
            if (AppState.currentMatchId == matchId) {
                console.log("Web3: Match accepté, lancement de Godot !");
                AppState.lastActionTime = Date.now();
                if (!AppState.opponentChar) {
                    // Si nous sommes le challenger, l'adversaire est la target
                    AppState.opponentChar = "p" + targetChar;
                }
                launchGodot(AppState.currentTargetId || AppState.currentChallenger);
            }
        });

        contract.on("TimeoutClaimed", (matchId, winner) => {
            if (AppState.currentMatchId == matchId) {
                let msg = "";
                let godotResult = 0;
                
                if (winner === ethers.ZeroAddress) {
                    msg = "Match annulé (Délai d'attente expiré).";
                    godotResult = 0;
                } else if (winner.toLowerCase() === AppState.walletAddress.toLowerCase()) {
                    msg = "Vous avez gagné par forfait !";
                    godotResult = 1;
                } else {
                    msg = "Vous avez perdu par forfait (Inactivité).";
                    godotResult = 2;
                }
                showToast(msg, godotResult === 1 ? 'success' : (godotResult === 0 ? 'info' : 'error'));
                
                if (AppState.currentPoolId) {
                    checkPoolElimination(godotResult);
                }

                resetMatchState();
                navigateTo(AppState.currentPoolId ? 'screen-pool-room' : 'screen-duel');
                
                updateBalance();
            }
        });

        contract.on("MoveCommitted", async (matchId, player) => {
            if (AppState.currentMatchId == matchId && player.toLowerCase() !== AppState.walletAddress.toLowerCase()) {
                console.log("Web3: L'adversaire a soumis son choix !");
                // Si nous avons aussi déjà commit, nous pouvons révéler
                if (AppState.hasCommitted) {
                    try {
                        console.log("Révélation du mouvement...");
                        const txReveal = await contract.revealMove(AppState.currentMatchId, AppState.currentMove, AppState.currentSecret);
                        await txReveal.wait();
                        console.log("Révélation confirmée !");
                    } catch(e) {
                        console.error("Erreur lors de la révélation:", e);
                    }
                }
            }
        });

        contract.on("MatchFinished", async (matchId, winner, payout) => {
            if (AppState.currentMatchId == matchId) {
                console.log("Web3: MatchFinished reçu !");
                
                // Récupération des détails du match depuis le contrat pour connaître le coup de l'adversaire
                const matchDetails = await contract.matches(matchId);
                let opponentMove = 0;
                let isChallenger = (matchDetails[0].toLowerCase() === AppState.walletAddress.toLowerCase());
                if (isChallenger) {
                    opponentMove = matchDetails[6]; // targetMove
                } else {
                    opponentMove = matchDetails[5]; // challengerMove
                }

                // Déterminer le code de victoire pour Godot (0: draw, 1: win, 2: loss)
                let godotResult = 0;
                if (winner === ethers.ZeroAddress) {
                    godotResult = 0;
                } else if (winner.toLowerCase() === AppState.walletAddress.toLowerCase()) {
                    godotResult = 1;
                } else {
                    godotResult = 2;
                }

                // Appel au callback Godot
                if (window.receiveMatchResult) {
                    window.receiveMatchResult(godotResult, parseInt(opponentMove));
                }

                const ethPayout = ethers.formatEther(payout);
                setTimeout(() => {
                    if (godotResult === 1) {
                        showToast(`Victoire ! Vous avez gagné ${ethPayout} ETH !`, 'success');
                    } else if (godotResult === 0) {
                        showToast(`Égalité ! Vous récupérez votre mise.`, 'info');
                    } else {
                        showToast(`Défaite... Vous avez perdu le match.`, 'error');
                    }
                    updateBalance();
                    
                    if (AppState.currentPoolId) {
                        checkPoolElimination(godotResult);
                    }

                    // Réinitialisation complète des états (incluant le statut serveur online)
                    resetMatchState();
                    navigateTo(AppState.currentPoolId ? 'screen-pool-room' : 'screen-duel');
                }, 3000); // Wait for Godot animation before alert
            }
        });
    } else {
        console.error("Ethers.js ou ABI manquant.");
    }
}

function updateBalance() {
    if(AppState.walletAddress) {
        provider.getBalance(AppState.walletAddress).then(bal => {
            const el = document.getElementById('wallet-balance');
            if(el) el.innerText = parseFloat(ethers.formatEther(bal)).toFixed(2) + " ETH";
        });
        
        // Fetch pending withdrawals
        if(contract) {
            contract.pendingWithdrawals(AppState.walletAddress).then(pending => {
                const container = document.getElementById('pending-funds-container');
                const amt = document.getElementById('pending-amount');
                if(container && amt) {
                    if(pending > 0n) {
                        container.style.display = 'block';
                        amt.innerText = parseFloat(ethers.formatEther(pending)).toFixed(3);
                    } else {
                        container.style.display = 'none';
                    }
                }
            });
        }
    }
}

async function claimPendingFunds() {
    if(contract) {
        contract.claimFunds().then(tx => {
            showToast("Transaction de retrait envoyée...", "info");
            return tx.wait();
        }).then(() => {
            showToast("Fonds récupérés avec succès !", "success");
            updateBalance();
        }).catch(err => {
            console.error(err);
            showToast("Erreur lors de la récupération des fonds.", "error");
        });
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
}

function performLogin() {
    window.gameConfig = { character: AppState.selectedCharacter.name };
    
    let savedWallet = localStorage.getItem('web3combat_wallet');
    let savedPk = localStorage.getItem('web3combat_pk');
    
    if (savedWallet && savedPk) {
        AppState.walletAddress = savedWallet;
        AppState.privateKey = savedPk;
    } else if (typeof HARDHAT_ACCOUNTS !== 'undefined' && HARDHAT_ACCOUNTS.length > 0) {
        const randomIndex = Math.floor(Math.random() * HARDHAT_ACCOUNTS.length);
        const account = HARDHAT_ACCOUNTS[randomIndex];
        AppState.walletAddress = account.address;
        AppState.privateKey = account.privateKey;
        localStorage.setItem('web3combat_wallet', account.address);
        localStorage.setItem('web3combat_pk', account.privateKey);
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
            wsHost: window.location.hostname,
            wsPort: 8081,
            wssPort: 8081,
            forceTLS: false,
            disableStats: true,
            enabledTransports: ['ws', 'wss'],
            authEndpoint: `http://${window.location.hostname}:8000/api/broadcasting/auth`,
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
                
                const shortId = e.challengerId.substring(0,6) + '...' + e.challengerId.substring(e.challengerId.length - 4);
                document.getElementById('challenge-text').innerText = `${shortId} vous met au défi pour ${e.betAmount} ETH !`;
                
                const actions = document.getElementById('challenge-modal-actions');
                if (actions) actions.style.display = 'flex';
                document.getElementById('challenge-modal').style.display = 'flex';
            })
            .listen('MatchStarted', (e) => {
                console.log("Accord Off-Chain atteint ! Exécution On-Chain...", e);
                window.gameConfig.matchId = e.matchId;
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

    navigateTo('screen-main');
}

// --- CONFIRMATION ET CONNEXION WEB3/REVERB ---
document.getElementById('btn-confirm-char').addEventListener('click', () => {
    localStorage.setItem('web3combat_char', AppState.selectedCharacter.id);
    performLogin();
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
    AppState.currentMatchId = null;
    AppState.hasCommitted = false;
    AppState.currentMove = null;
    AppState.currentSecret = null;
    AppState.opponentChar = null;
    AppState.lastActionTime = null;
    AppState.currentChallenger = null;
    AppState.currentTargetId = null;
    
    if (typeof engineInstance !== 'undefined' && engineInstance) {
        try { engineInstance.requestQuit(); } catch(e){}
        engineInstance = null;
    }
    
    fetch(`http://${window.location.hostname}:8000/api/matchmaking/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ player_id: AppState.walletAddress, status: 'online' })
    }).catch(e => console.error(e));
    
    if (AppState.currentPoolId) {
        renderPoolRoom();
    } else {
        renderDuelLobby();
    }
};

window.quitGodot = function() {
    if(confirm("Voulez-vous vraiment quitter le jeu et retourner au lobby ?")) {
        resetMatchState();
        navigateTo('screen-duel');
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
        const response = await fetch(`http://${window.location.hostname}:8000/api/matchmaking/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                challenger_id: AppState.walletAddress,
                target_id: playerId,
                bet_amount: betAmount
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
        const response = await fetch(`http://${window.location.hostname}:8000/api/matchmaking/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                challenger_id: AppState.currentChallenger,
                target_id: AppState.walletAddress,
                bet_amount: AppState.currentBetAmountOffchain
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
    fetch(`http://${window.location.hostname}:8000/api/matchmaking/decline`, {
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
        await fetch(`http://${window.location.hostname}:8000/api/matchmaking/decline`, {
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

// --- EXÉCUTION ON-CHAIN ---
async function executeMatchOnChain(e) {
    const isChallenger = (e.player1.toLowerCase() === AppState.walletAddress.toLowerCase());
    
    if (isChallenger) {
        document.getElementById('challenge-text').innerText = "L'adversaire a accepté ! Dépôt des fonds...";
        document.getElementById('challenge-modal-actions').style.display = 'none';
        document.getElementById('challenge-modal').style.display = 'flex';
        
        try {
            const betWei = ethers.parseEther(AppState.defaultBetAmount.toString());
            const feePercent = await contract.feePercent();
            const feeWei = (betWei * feePercent) / 1000n;
            const totalWei = betWei + feeWei;

            const charId = AppState.selectedCharacter.id;
            console.log("Envoi challenge on-chain...");
            const tx = await contract.challenge(e.player2, charId, betWei, { value: totalWei });
            
            document.getElementById('challenge-text').innerText = "Transaction en cours de confirmation...";
            await tx.wait();
            
            document.getElementById('challenge-text').innerText = "Fonds déposés ! Attente du dépôt de l'adversaire...";
        } catch(err) {
            console.error(err);
            showToast("Erreur lors du dépôt. Match annulé.", "error");
            document.getElementById('challenge-modal').style.display = 'none';
            resetMatchState();
        }
    } else {
        document.getElementById('challenge-modal-actions').style.display = 'none';
        document.getElementById('challenge-text').innerText = "Attente du dépôt du challenger sur la blockchain...";
        document.getElementById('challenge-modal').style.display = 'flex';
    }
}

async function executeAcceptOnChain(matchId, betWei) {
    try {
        const feePercent = await contract.feePercent();
        const feeWei = (betWei * feePercent) / 1000n;
        const totalWei = betWei + feeWei;
        const charId = AppState.selectedCharacter.id;

        document.getElementById('challenge-text').innerText = "L'adversaire a déposé ses fonds ! À vous de déposer...";
        
        const tx = await contract.acceptChallenge(matchId, charId, betWei, { value: totalWei });
        document.getElementById('challenge-text').innerText = "Transaction en cours de confirmation...";
        await tx.wait();
        
        document.getElementById('challenge-modal').style.display = 'none';
    } catch(err) {
        console.error(err);
        showToast("Transaction refusée ou erreur. Le match est annulé.", "error");
        document.getElementById('challenge-modal').style.display = 'none';
        resetMatchState();
    }
}


// --- GÉNÉRATION ÉCRAN BATTLE ROYALE ---
async function renderBRLobby() {
    const list = document.getElementById('br-list');
    list.innerHTML = '<p class="empty-state">Recherche de poules...</p>';

    try {
        const res = await fetch(`http://${window.location.hostname}:8000/api/pools`);
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
let engineInstance = null;

function launchGodot(targetId) {
    console.log("Lancement de Godot contre :", targetId);
    
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

    navigateTo('screen-combat');
    
    // Petite pause pour laisser l'UI s'afficher
    setTimeout(() => {
        if (!engineInstance && typeof Engine !== 'undefined') {
            engineInstance = new Engine({"args":[],"canvasResizePolicy":2,"executable":"godot/jeu","experimentalVK":false,"fileSizes":{"godot/jeu.pck":12160,"godot/jeu.wasm":35649995},"focusCanvas":true,"gdextensionLibs":[]});
            
            engineInstance.startGame({
                'onProgress': function (current, total) {
                    if (total > 0) {
                        const statusProgress = current / total;
                        document.getElementById('loading-bar').style.width = (statusProgress * 100) + '%';
                        document.getElementById('loading-text').innerText = Math.round(current / 1024 / 1024) + " / " + Math.round(total / 1024 / 1024) + " Mo";
                    }
                }
            }).then(() => {
                console.log("Moteur Godot démarré avec succès !");
                navigateTo('godot-layer'); // Basculer sur le canvas
            }).catch(e => {
                console.error("Erreur de lancement Godot :", e);
            });
        }
    }, 1500); // Wait 1.5s as in the mockup before launching
}

function endCombatSimulation() {
    navigateTo('screen-main');
}

// --- PONT GODOT <-> JAVASCRIPT ---

// Appelé par Godot au lancement de la scène
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
    
    if (AppState.currentMatchId) {
        try {
            const move = parseInt(moveNum);
            if(isNaN(move) || move < 1 || move > 3) {
                showToast("Mouvement invalide retourné par Godot: " + moveNum, "error");
                return;
            }

            // Génération d'un secret aléatoire de manière cryptographique forte
            const randomBytes = new Uint8Array(16);
            window.crypto.getRandomValues(randomBytes);
            const secret = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            
            AppState.currentSecret = secret;
            AppState.currentMove = move;

            // Commit move (Hash)
            console.log(`Commit du mouvement ${move} avec le secret ${secret}...`);
            const hash = ethers.solidityPackedKeccak256(["uint8", "string"], [move, secret]);
            const txCommit = await contract.commitMove(AppState.currentMatchId, hash);
            console.log("Tx commit envoyée :", txCommit.hash);
            await txCommit.wait();
            console.log("Commit confirmé !");
            
            AppState.hasCommitted = true;

            // Vérifier si l'adversaire a déjà commit en lisant le contrat
            const matchDetails = await contract.matches(AppState.currentMatchId);
            let opponentHasCommitted = false;
            let isChallenger = (matchDetails[0].toLowerCase() === AppState.walletAddress.toLowerCase());
            
            if (isChallenger) {
                opponentHasCommitted = (matchDetails[4] !== "0x0000000000000000000000000000000000000000000000000000000000000000"); // targetCommit
            } else {
                opponentHasCommitted = (matchDetails[3] !== "0x0000000000000000000000000000000000000000000000000000000000000000"); // challengerCommit
            }

            if (opponentHasCommitted) {
                console.log("L'adversaire a déjà commit, révélation immédiate...");
                const txReveal = await contract.revealMove(AppState.currentMatchId, AppState.currentMove, AppState.currentSecret);
                await txReveal.wait();
                console.log("Révélation confirmée !");
            } else {
                console.log("En attente du commit de l'adversaire...");
            }

        } catch (e) {
            console.error("Erreur Web3 (Commit/Reveal) :", e);
        }
    }
};


// --- INITIALISATION AU CHARGEMENT ---
document.addEventListener('DOMContentLoaded', () => {
    checkURLParameters();
    lucide.createIcons();
    renderCharacterSelect();
    renderDuelLobby();
    renderBRLobby();
    
    const savedCharId = localStorage.getItem('web3combat_char');
    if (savedCharId) {
        const char = characters.find(c => c.id == savedCharId);
        if (char) {
            selectCharacter(char);
            performLogin();
        }
    }
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
    
    if(!fee || isNaN(fee) || Number(fee) <= 0) return showToast("Mise invalide", "error");
    
    try {
        const entryWei = ethers.parseEther(fee.toString());
        closeCreatePoolModal();
        showToast("Création de la poule sur la blockchain...", "info");
        
        const tx = await contract.createPool(entryWei, max, mode);
        const receipt = await tx.wait();
        
        // Find PoolCreated event
        let poolId = null;
        for (const log of receipt.logs) {
            try {
                const event = contract.interface.parseLog(log);
                if (event && event.name === 'PoolCreated') {
                    poolId = event.args[0];
                }
            } catch(e) {}
        }
        
        if (poolId) {
            // Register on backend
            await fetch(`http://${window.location.hostname}:8000/api/pools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    id: Number(poolId),
                    entry_fee: Number(fee),
                    max_players: Number(max),
                    penalty_mode: Number(mode),
                    is_private: true
                })
            });
            showToast("Poule créée ! ID: " + poolId, "success");
            renderBRLobby();
            joinPool(poolId);
        }
    } catch(e) {
        console.error(e);
        showToast("Erreur lors de la création de la poule", "error");
    }
}

async function joinPool(poolId) {
    if(!contract) return showToast("Veuillez vous connecter d'abord", "error");
    
    try {
        // Fetch pool details from backend to know fee
        const res = await fetch(`http://${window.location.hostname}:8000/api/pools`);
        let pools = await res.json();
        let pool = pools.find(p => p.id == poolId);
        
        if (!pool) {
            // It might be private, try fetching by ID directly if we had a route, 
            // for now let's assume it's in the list or we can get it.
            // Simplified for prototype.
            showToast("Vérification de la poule...", "info");
            pool = { entry_fee: 10 }; // Fallback for prototype
        }
        
        const entryWei = ethers.parseEther(pool.entry_fee.toString());
        const feePercent = await contract.feePercent();
        const txFee = (entryWei * feePercent) / 1000n;
        const totalWei = entryWei + txFee;
        
        showToast("Paiement de la mise d'entrée...", "info");
        const tx = await contract.joinPool(poolId, { value: totalWei });
        await tx.wait();
        
        // Notify backend
        const joinRes = await fetch(`http://${window.location.hostname}:8000/api/pools/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ pool_id: Number(poolId), wallet_address: AppState.walletAddress })
        });
        
        const joinData = await joinRes.json();
        if(joinData.status === 'success') {
            AppState.currentPoolId = poolId;
            AppState.currentPoolFee = pool.entry_fee;
            showToast("Poule rejointe !", "success");
            navigateTo('screen-pool-room');
            renderPoolRoom();
            subscribeToPoolRound(poolId);
        } else {
            showToast(joinData.message || "Erreur lors de l'inscription", "error");
        }
        
    } catch(e) {
        console.error(e);
        showToast("Erreur lors de l'intégration à la poule", "error");
    }
}

function subscribeToPoolRound(poolId) {
    if(window.poolChannel) {
        window.echoInstance.leave('pool.' + window.poolChannel);
    }
    window.poolChannel = poolId;
    
    window.echoInstance.join('pool.' + poolId)
        .listen('PoolRoundStarted', (e) => {
            console.log("Pool Round Started!", e);
            handlePoolRoundStarted(e);
        });
}

async function handlePoolRoundStarted(e) {
    document.getElementById('pool-room-status').innerText = "Round en cours...";
    document.getElementById('pool-room-status').style.color = "var(--color-red)";
    
    if (e.waitingPlayer && e.waitingPlayer.toLowerCase() === AppState.walletAddress.toLowerCase()) {
        showToast("Vous êtes exempté pour ce round !", "info");
        return;
    }
    
    // Find my pair
    const myPair = e.pairs.find(p => p.player1.toLowerCase() === AppState.walletAddress.toLowerCase() || p.player2.toLowerCase() === AppState.walletAddress.toLowerCase());
    
    if (myPair) {
        const isChallenger = myPair.player1.toLowerCase() === AppState.walletAddress.toLowerCase();
        const opponent = isChallenger ? myPair.player2 : myPair.player1;
        
        AppState.currentTargetId = opponent;
        
        if (isChallenger) {
            showToast("Défi de l'adversaire de la poule...", "info");
            try {
                const charId = AppState.selectedCharacter.id;
                const tx = await contract.challengePool(opponent, charId, AppState.currentPoolId);
                await tx.wait();
                // Wait for ChallengeAccepted event to launch Godot
            } catch(e) {
                console.error(e);
                showToast("Erreur défi poule", "error");
            }
        } else {
            showToast("Attente du défi du round...", "info");
            // Handled in ChallengeCreated event
        }
    }
}

async function executeAcceptPoolOnChain(matchId) {
    try {
        const charId = AppState.selectedCharacter.id;
        const tx = await contract.acceptPoolChallenge(matchId, charId);
        await tx.wait();
    } catch(err) {
        console.error(err);
        showToast("Erreur acceptation round", "error");
    }
}

function renderPoolRoom() {
    if (!AppState.currentPoolId) return;
    document.getElementById('pool-room-title').innerText = "Poule #" + AppState.currentPoolId;
    
    // In a real app we would fetch the players in the pool from backend to show them.
    // For now we just show it's active.
    fetch(`http://${window.location.hostname}:8000/api/pools`).then(r => r.json()).then(pools => {
        const pool = pools.find(p => p.id == AppState.currentPoolId);
        if(pool) {
            document.getElementById('pool-room-count').innerText = pool.players_count + " / " + pool.max_players;
        }
    });
}

async function checkPoolElimination(godotResult) {
    // Determine if eliminated based on balance
    try {
        const bal = await contract.poolBalances(AppState.currentPoolId, AppState.walletAddress);
        if (bal == 0n) {
            fetch(`http://${window.location.hostname}:8000/api/pools/match-finished`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    pool_id: AppState.currentPoolId,
                    loser_wallet: AppState.walletAddress,
                    is_eliminated: true
                })
            });
            showToast("Vous êtes éliminé de la poule !", "error");
            quitPool(false);
        } else {
            fetch(`http://${window.location.hostname}:8000/api/pools/match-finished`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    pool_id: AppState.currentPoolId,
                    loser_wallet: godotResult === 2 ? AppState.walletAddress : null,
                    is_eliminated: false
                })
            });
        }
    } catch(e) { console.error(e); }
}

let isQuitting = false;
async function quitPool(claim = true) {
    if (isQuitting) return;
    if (claim && contract && AppState.currentPoolId) {
        isQuitting = true;
        try {
            const tx = await contract.leavePool(AppState.currentPoolId);
            await tx.wait();
            showToast("Vous avez quitté la poule et récupéré vos fonds", "info");
        } catch(e) {
            console.error(e);
        }
        isQuitting = false;
    }
    AppState.currentPoolId = null;
    if(window.poolChannel) {
        window.echoInstance.leave('pool.' + window.poolChannel);
        window.poolChannel = null;
    }
    navigateTo('screen-br-lobby');
    renderBRLobby();
}
