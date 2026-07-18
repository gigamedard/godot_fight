// 1. ÉTAT GLOBAL DE L'APPLICATION
const AppState = {
    currentScreen: 'screen-character',
    selectedCharacter: null,
    walletAddress: null,
    currentChallenger: null, // Pour stocker le challenger en cours
    currentTargetId: null, // Le joueur qu'on est en train de défier
    pendingChallengeParam: null, // Pour stocker le Wallet issu du lien URL
    defaultBetAmount: localStorage.getItem('web3combat_bet_amount') || '10'
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

async function initWeb3() {
    if (typeof ethers !== 'undefined' && typeof COMBAT_GAME_ABI !== 'undefined') {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        signer = new ethers.Wallet(AppState.privateKey, provider);
        contract = new ethers.Contract(CONTRACT_ADDRESS, COMBAT_GAME_ABI, signer);
        
        // Fetch balance
        updateBalance();
        
        // Timeout Checker
        setInterval(async () => {
            if (AppState.currentMatchId && !AppState.hasCommitted && AppState.lastActionTime) {
                // If we are waiting for Godot, we check if 25 seconds passed
                if (Date.now() - AppState.lastActionTime > 25000) {
                    try {
                        const m = await contract.matches(AppState.currentMatchId);
                        if(m[9] != 4 && m[9] != 5) { // not Finished, not Canceled
                            console.log("Tentative de victoire par forfait (Timeout)...");
                            const tx = await contract.claimTimeout(AppState.currentMatchId);
                            await tx.wait();
                            console.log("Victoire par forfait confirmée !");
                            AppState.currentMatchId = null;
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
                const shortId = challenger.substring(0,6) + '...' + challenger.substring(challenger.length - 4);
                const ethAmount = ethers.formatEther(betAmount);
                document.getElementById('challenge-text').innerText = `${shortId} vous met au défi pour ${ethAmount} ETH !`;
                document.getElementById('challenge-modal').style.display = 'flex';
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
                
                if (typeof window.receiveMatchResult === 'function') {
                    // Si Godot est lancé, on lui délègue l'affichage
                    window.receiveMatchResult(godotResult, 0);
                } else {
                    alert(msg);
                    navigateTo('screen-main');
                }
                
                updateBalance();
                AppState.currentMatchId = null;
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
                        alert(`Victoire ! Vous avez gagné ${ethPayout} ETH !`);
                    } else if (godotResult === 0) {
                        alert(`Égalité ! Vous récupérez votre mise.`);
                    } else {
                        alert(`Défaite... Vous avez perdu le match.`);
                    }
                    updateBalance();
                    // Réinitialisation des états
                    AppState.hasCommitted = false;
                    AppState.opponentChar = null;
                    navigateTo('screen-main');
                }, 3000); // Wait for Godot animation before alert
            }
        });
    } else {
        console.error("Ethers.js ou ABI manquant.");
    }
}

function updateBalance() {
    if(AppState.walletAddress && AppState.selectedCharacter) {
        const badge = document.getElementById('player-badge');
        badge.innerHTML = `
            <img src="${AppState.selectedCharacter.image}" class="player-badge-img">
            <div class="player-badge-info">
                <div class="player-badge-name">${AppState.walletAddress.substring(0,6)}...</div>
                <div class="player-badge-balance" id="wallet-balance">-- ETH</div>
                <div id="pending-funds-container" style="display:none; margin-top: 5px;">
                    <button class="btn btn-challenge" style="font-size: 0.8rem; padding: 0.5rem;" onclick="claimPendingFunds()">
                        Réclamer <span id="pending-amount">0</span> ETH
                    </button>
                </div>
            </div>
        `;
        provider.getBalance(AppState.walletAddress).then(bal => {
            document.getElementById('wallet-balance').innerText = parseFloat(ethers.formatEther(bal)).toFixed(2) + " ETH";
        });
        
        // Fetch pending withdrawals
        if(contract) {
            contract.pendingWithdrawals(AppState.walletAddress).then(pending => {
                if(pending > 0n) {
                    document.getElementById('pending-funds-container').style.display = 'block';
                    document.getElementById('pending-amount').innerText = parseFloat(ethers.formatEther(pending)).toFixed(3);
                }
            });
        }
    }
}

async function claimPendingFunds() {
    try {
        const tx = await contract.claimFunds();
        await tx.wait();
        alert("Fonds réclamés avec succès !");
        updateBalance();
    } catch(e) {
        console.error(e);
        alert("Erreur lors de la réclamation des fonds.");
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

// --- CONFIRMATION ET CONNEXION WEB3/REVERB ---
document.getElementById('btn-confirm-char').addEventListener('click', () => {
    window.gameConfig = { character: AppState.selectedCharacter.name };
    
    // Récupération d'un faux Wallet depuis la liste générée par Hardhat
    if (typeof HARDHAT_ACCOUNTS !== 'undefined' && HARDHAT_ACCOUNTS.length > 0) {
        const randomIndex = Math.floor(Math.random() * HARDHAT_ACCOUNTS.length);
        const account = HARDHAT_ACCOUNTS[randomIndex];
        AppState.walletAddress = account.address;
        AppState.privateKey = account.privateKey;
    } else {
        alert("Les clés Hardhat ne sont pas chargées. Veuillez générer le fichier hardhat_keys.js.");
        return;
    }
    
    window.gameConfig.walletAddress = AppState.walletAddress;
    console.log("Wallet connecté :", AppState.walletAddress);

    // Initialisation du Provider Web3 et Contrat
    initWeb3();

    // Mise à jour du badge dans le Menu Principal
    document.getElementById('player-badge').innerHTML = `
        <div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${AppState.selectedCharacter.color}"></div>
        <span>${AppState.selectedCharacter.name}</span>
    `;

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
                
                const shortId = e.challengerId.substring(0,6) + '...' + e.challengerId.substring(e.challengerId.length - 4);
                document.getElementById('challenge-text').innerText = `${shortId} vous met au défi pour ${e.betAmount} TKN !`;
                document.getElementById('challenge-modal').style.display = 'flex';
            })
            .listen('MatchStarted', (e) => {
                console.log("Le match démarre !", e);
                window.gameConfig.matchId = e.matchId;
                const opponentId = (e.player1 === AppState.walletAddress) ? e.player2 : e.player1;
                launchGodot(opponentId);
            })
            .listen('ChallengeDeclined', (e) => {
                console.log("Défi refusé par :", e.targetId);
                alert("L'adversaire a refusé votre défi.");
                const btn = document.getElementById(`btn-chal-${e.targetId}`);
                if (btn) {
                    btn.className = 'btn btn-challenge';
                    btn.innerHTML = 'Défier';
                    btn.disabled = false;
                    lucide.createIcons();
                }
            });
    }

    navigateTo('screen-main');
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
        
        let buttonHtml = `<button class="btn btn-challenge" id="btn-chal-${player.id}" onclick="openBetModal('${player.id}')">Défier</button>`;
        if (player.status === 'in-game') {
            buttonHtml = `<button class="btn btn-waiting" id="btn-chal-${player.id}" disabled><i data-lucide="swords" width="16" height="16" style="margin-right: 0.5rem"></i> En combat</button>`;
        }

        card.innerHTML = `
            <div class="player-info">
                <h3>${player.name}</h3>
                <p>${shortId}</p>
            </div>
            ${buttonHtml}
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

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
    document.getElementById('bet-amount').value = AppState.defaultBetAmount;
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
        alert("Veuillez entrer un montant valide.");
        return;
    }

    localStorage.setItem('web3combat_bet_amount', betAmount);
    AppState.defaultBetAmount = betAmount;

    const targetId = AppState.currentTargetId;
    closeBetModal();

    initiateChallenge(targetId, betAmount);
}

// Envoi d'un défi via le Smart Contract
async function initiateChallenge(playerId, betAmount) {
    const btn = document.getElementById(`btn-chal-${playerId}`);
    btn.className = 'btn btn-waiting';
    btn.innerHTML = '<i data-lucide="loader-2" width="16" height="16" style="margin-right: 0.5rem"></i> Attente Tx...';
    btn.disabled = true;
    lucide.createIcons();

    try {
        const betWei = ethers.parseEther(betAmount.toString());
        const feePercent = await contract.feePercent();
        const feeWei = (betWei * feePercent) / 1000n;
        const totalWei = betWei + feeWei;

        const charId = AppState.selectedCharacter.id;
        const tx = await contract.challenge(playerId, charId, betWei, { value: totalWei });
        console.log("Tx challenge envoyée :", tx.hash);
        await tx.wait();
        console.log("Tx challenge confirmée !");
        
        btn.innerHTML = '<i data-lucide="loader-2" width="16" height="16" style="margin-right: 0.5rem"></i> Attente Adversaire...';
        lucide.createIcons();
    } catch (e) {
        console.error(e);
        btn.className = 'btn btn-challenge';
        btn.innerHTML = 'Défier';
        btn.disabled = false;
        alert("Erreur lors de l'envoi du défi sur la blockchain.");
    }
}

// --- MODALE DE DÉFI ---
document.getElementById('btn-accept-challenge').addEventListener('click', async () => {
    document.getElementById('challenge-modal').style.display = 'none';
    try {
        const matchId = AppState.currentMatchId;
        const betWei = AppState.currentBetAmount;
        const feePercent = await contract.feePercent();
        const feeWei = (betWei * feePercent) / 1000n;
        const totalWei = betWei + feeWei;

        const charId = AppState.selectedCharacter.id;
        console.log("Acceptation du défi", matchId, "Mise:", ethers.formatEther(betWei), "Frais:", ethers.formatEther(feeWei));
        const tx = await contract.acceptChallenge(matchId, charId, betWei, { value: totalWei });
        console.log("Tx accept envoyée :", tx.hash);
        await tx.wait();
        console.log("Tx accept confirmée ! Le match va démarrer...");
    } catch (e) {
        console.error(e);
        alert("Erreur lors de l'acceptation sur la blockchain.");
    }
});

document.getElementById('btn-decline-challenge').addEventListener('click', async () => {
    document.getElementById('challenge-modal').style.display = 'none';
    
    try {
        const response = await fetch(`http://${window.location.hostname}:8000/api/matchmaking/decline`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                challenger_id: AppState.currentChallenger,
                target_id: AppState.walletAddress
            })
        });
        if (!response.ok) {
            console.error("Erreur de refus :", await response.json());
        }
    } catch (e) {
        console.error(e);
    }

    AppState.currentChallenger = null;
});


// --- GÉNÉRATION ÉCRAN BATTLE ROYALE ---
function renderBRLobby() {
    const list = document.getElementById('br-list');
    list.innerHTML = '';

    brLobbies.forEach(lobby => {
        const isFull = lobby.players >= lobby.max;
        const progress = (lobby.players / lobby.max) * 100;
        
        const card = document.createElement('div');
        card.className = 'br-card';
        card.innerHTML = `
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progress}%"></div>
            </div>
            <div class="br-header">
                <div>
                    <h3 style="color: white; font-size: 1.1rem;">${lobby.name}</h3>
                    <span class="br-tag">${lobby.entry}</span>
                </div>
                <div class="br-players">
                    <span>${lobby.players}</span>
                    <span style="color: var(--text-gray-400)">/${lobby.max}</span>
                </div>
            </div>
            <button class="btn btn-join ${isFull ? 'full' : ''}" ${isFull ? 'disabled' : ''} onclick="launchGodot('BR_MODE')">
                ${isFull ? 'Salon Complet' : 'Rejoindre la file'}
            </button>
        `;
        list.appendChild(card);
    });
}

// --- LANCEMENT DU JEU GODOT ---
let engineInstance = null;

function launchGodot(targetId) {
    console.log("Lancement de Godot contre :", targetId);
    
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
                alert("Mouvement invalide retourné par Godot: " + moveNum);
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
});
