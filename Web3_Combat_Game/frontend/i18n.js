/**
 * i18n.js — Système Internationalisation Multilingue (FR, EN, ES, PT)
 * ====================================================================
 * Supporte :
 *  - Dictionnaires complets pour Français, Anglais, Espagnol, Portugais.
 *  - Résolution automatique : URL (?lang=) > localStorage portal > localStorage web3combat > navigator > 'fr'.
 *  - Traduction réactive du DOM via [data-i18n], [data-i18n-placeholder], [data-i18n-title].
 *  - Interpolation des variables {nomVariable}.
 *  - Événement personnalisé 'languageChanged' pour les vues dynamiques.
 */

(function () {
    'use strict';

    const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'pt'];
    const DEFAULT_LANGUAGE = 'fr';

    const TRANSLATIONS = {
        fr: {
            // General
            appName: "Web3 Combat Game",
            back: "Retour",
            confirm: "Confirmer",
            cancel: "Annuler",
            close: "Fermer",
            loading: "Chargement...",
            copy: "Copier",
            copied: "Copié !",
            or: "OU",
            max: "MAX",

            // Language Screen
            langTitle: "LANGUE / LANGUAGE",
            langSubtitle: "Sélectionnez votre langue d'interface",

            // Connect Screen
            connectTitle: "CONNEXION WEB3",
            connectSubtitle: "Connectez votre wallet pour accéder aux combats et à vos tokens.",
            perk1: "Duels 1v1 & Battle Royale",
            perk2: "Aucune clé privée stockée",
            perk3: "Tokens & récompenses on-chain",
            connectWalletBtn: "CONNECTER LE WALLET",
            connectHint: "Signature gratuite — aucune transaction n'est envoyée.",
            walletConnected: "Wallet connecté",

            // Mode Screen
            modeTitle: "MODE DE JEU",
            modeDuelTitle: "1 VS 1 DUEL",
            modeDuelDesc: "Affrontez un adversaire en direct avec mise en jeu.",
            modeBattleTitle: "BATTLE ROYALE",
            modeBattleDesc: "Rejoignez un salon de poule à élimination directe.",
            modeSpiritTitle: "SPIRIT FIGHT",
            modeSpiritDesc: "Accédez au portail global & Marketplace NFT.",

            // Character Screen
            charTitle: "SÉLECTION DU GUERRIER",
            pseudoLabel: "VOTRE PSEUDONYME",
            pseudoPlaceholder: "Ex: ShadowBlade",
            volumeLabel: "VOLUME",
            confirmCharBtn: "CONFIRMER LE COMBATTANT",
            charStyleMartial: "Arts Martiaux",
            charStyleSpeed: "Vitesse",
            charStyleStrength: "Force Brute",
            charStyleTitan: "Force Titan",

            // Duel Lobby Screen
            duelLobbyTitle: "LOBBY 1VS1 DUEL",
            searchPlaceholder: "Pseudo ou adresse wallet...",
            onlinePlayers: "JOUEURS EN LIGNE",
            challengeBtn: "DÉFIER",
            inFightStatus: "En combat",
            idleStatus: "Disponible",

            // Battle Royale Lobby Screen
            brLobbyTitle: "SALONS BATTLE ROYALE",
            createBattleBtn: "CRÉER UNE BATTLE",
            inviteCodePlaceholder: "Code d'invitation privé...",
            joinBtn: "REJOINDRE",
            openRooms: "SALONS OUVERTS",
            playersCount: "{current}/{max} Joueurs",
            entryFee: "Mise: {fee} TST",

            // Spirit Fight Screen
            spiritTitle: "SPIRIT FIGHT",
            spiritDesc: "L'univers complet : arène, marketplace NFT, références et récompenses influencer.",
            launchSpiritBtn: "LANCER BATTLEPOOL (APP 1)",

            // Pool Room Screen
            quitBtn: "QUITTER",
            waitingStatus: "EN ATTENTE",
            inProgressStatus: "EN COURS",
            finishedStatus: "TERMINÉ",
            shareInvite: "Partagez l'invitation au salon :",
            copyLinkBtn: "COPIER LIEN",
            copyCodeBtn: "COPIER CODE",
            codeLabel: "CODE :",
            fightersInPool: "COMBATTANTS DANS LA POULE",
            poolChampion: "Champion de la poule : {winner} !",
            poolPotWon: "Gains accumulés : {pot} TST",

            // Combat & HUD
            player1: "JOUEUR 1",
            player2: "JOUEUR 2",
            loadingArena: "CHARGEMENT DE L'ARÈNE...",
            loadingEngine: "Préparation du moteur 3D...",
            engine2DPrep: "PRÉPARATION DU COMBAT 2D ({pct}%)...",
            engine3DBackground: "MOTEUR 3D EN ARRIÈRE-PLAN ({pct}%)...",
            depositPending: "EN ATTENTE DES DÉPÔTS DES DEUX JOUEURS...",
            chooseMove: "CHOISISSEZ VOTRE COUP",
            moveBarInstruction: "À toi de jouer ! Choisis ton coup :",
            moveRock: "PIERRE",
            movePaper: "FEUILLE",
            moveScissors: "CISEAUX",
            round: "ROUND {num}",
            roundWon: "Victoire du round !",
            roundLost: "Round perdu...",
            roundDraw: "Égalité ! Rejouez !",
            waitingOpponent: "En attente du coup adverse...",
            fightFinished: "Combat terminé",
            poolTitle: "Poule #{id}",
            quitPoolClaim: "🏆 Réclamer les gains et Quitter",
            quitPoolBack: "← Retour au lobby",
            quitPoolMatches: "Matchs en cours...",
            quitPoolDefault: "Quitter la poule",
            poolFull: "La poule est pleine, la bataille commence !",
            poolWaiting: "En attente de joueurs...",
            poolRoundInProgress: "Round en cours...",
            poolExempted: "Vous êtes exempté pour ce round ! Attendez le prochain.",
            poolEliminated: "Vous êtes éliminé de la poule !",
            poolClosePanel: "Vous pouvez fermer ce panneau.",
            poolLeftInterface: "Vous avez quitté l'interface de la poule.",
            youAreChampion: "🏆 Vous êtes le champion !",
            championIs: "Champion : {winner}",
            poolFinishedNoWinner: "Poule terminée (aucun vainqueur)",
            searchingPools: "Recherche de poules...",
            noPools: "Aucune poule publique ouverte.",
            poolsError: "Erreur de connexion.",
            poolAllIn: "(All-In)",
            poolJoin: "Rejoindre la file",
            poolFullBtn: "Salon Complet",
            noFighters: "Aucun combattant trouvé.",
            challenge: "DÉFIER",
            inCombatBtn: "En combat",
            portalBackBtn: "RETOUR AU JEU",
            portalLoading: "Chargement du portail BATTLEPOOL...",
            challengeDefaultText: "Un joueur vous défie en duel.",
            challengeReceivedShort: "{challenger} vous met au défi pour {bet} TST !",
            victoryGains: "Victoire ! Vous avez gagné {amount} TST !",
            drawRefund: "Égalité ! Vous récupérez votre mise.",
            defeatMsg: "Défaite... Vous avez perdu le match.",
            char1: "Guerrier Ninja",
            char2: "Mutant Cyborg",
            char3: "Tom Frazer",
            char4: "Big Choco",

            // Victory / Defeat Screen
            victoryTitle: "VICTOIRE !",
            defeatTitle: "DÉFAITE",
            drawTitle: "ÉGALITÉ",
            youWon: "Vous remportez le match !",
            youLost: "Votre adversaire l'emporte.",
            claimGains: "RÉCLAMER LES GAINS ({amount} TST)",
            returnLobby: "RETOUR AU MENU",
            rematchBtn: "REVANCHE",

            // Modals
            qrModalTitle: "SCANNER QR CODE",
            challengeTargetTitle: "DÉFIER {target}",
            sendChallengeBtn: "ENVOYER LE DÉFI",
            betAmountLabel: "Montant de la mise :",
            challengeReceivedTitle: "DÉFI REÇU !",
            challengeReceivedText: "{challenger} vous défie en duel avec une mise de {bet} TST.",
            acceptBtn: "ACCEPTER",
            counterBtn: "CONTRE-PROPOSER",
            declineBtn: "REFUSER",
            createPoolTitle: "CRÉER UNE BATTLE ROYALE",
            entryFeeLabel: "Frais d'entrée (TST) :",
            maxPlayersLabel: "Joueurs max (2 à 64) :",
            eliminationRuleLabel: "Règle d'élimination :",
            suddenDeathOption: "Mort Subite (1 défaite = élimination)",
            privatePoolLabel: "Poule privée sur code :",
            createPoolSubmit: "CRÉER LE SALON",
            endConditionLabel: "Condition de fin :",
            endLastManOption: "Dernier survivant",
            endRemainingOption: "N survivants",
            endTimeOption: "Durée limitée",
            endCountLabel: "Nombre de survivants cible :",
            endSecondsLabel: "Durée (secondes) :",
            poolWatch: "REGARDER",
            spectatorStatus: "SPECTATEUR",
            spectatorMode: "Mode spectateur : vous suivez la poule sans y participer.",
            poolFullWatch: "Salon complet — ouverture en spectateur.",
            poolEliminatedSpectator: "Éliminé — mode spectateur : vous pouvez suivre la suite de la poule.",
            poolInProgress: "EN COURS",
            poolWaitingDeposits: "En attente des dépôts des joueurs...",
            poolClaimYourLoot: "Butin à réclamer : {amount} TST",
            lootOut: "ÉLIMINÉ",
            lootAlive: "SURVIVANT",
            inviteModalTitle: "INVITATION SALON",
            inviteModalText: "Vous êtes invité à rejoindre un salon de combat.",
            joinRoomBtn: "REJOINDRE LE SALON",

            // Toasts & Alerts
            toastLinkCopied: "Lien copié !",
            toastCodeCopied: "Code copié !",
            toastNoCode: "Aucun code disponible.",
            toastWalletConnected: "Wallet connecté : {addr}",
            toastMetaMaskRefused: "Connexion refusée par l'utilisateur.",
            toastNoWallet: "Aucun wallet détecté. Installez MetaMask ou utilisez une clé de démo.",
            toastInvalidKey: "Clé privée invalide.",
            toastDepositPending: "Dépôt de {amount} TST sur la blockchain...",
            toastDepositSuccess: "Dépôt confirmé sur la blockchain !",
            toastDepositError: "Échec du dépôt on-chain : {err}",
            toastChallengeRefused: "L'adversaire a refusé votre défi.",
            toastCameraDenied: "Accès à la caméra refusé ou indisponible."
        },

        en: {
            // General
            appName: "Web3 Combat Game",
            back: "Back",
            confirm: "Confirm",
            cancel: "Cancel",
            close: "Close",
            loading: "Loading...",
            copy: "Copy",
            copied: "Copied!",
            or: "OR",
            max: "MAX",

            // Language Screen
            langTitle: "LANGUAGE / LANGUE",
            langSubtitle: "Select your interface language",

            // Connect Screen
            connectTitle: "WEB3 CONNECTION",
            connectSubtitle: "Connect your wallet to access battles and your tokens.",
            perk1: "1v1 Duels & Battle Royale",
            perk2: "Zero private keys stored",
            perk3: "On-chain tokens & rewards",
            connectWalletBtn: "CONNECT WALLET",
            connectHint: "Free signature — no transaction is broadcasted.",
            walletConnected: "Wallet connected",

            // Mode Screen
            modeTitle: "GAME MODE",
            modeDuelTitle: "1 VS 1 DUEL",
            modeDuelDesc: "Face an opponent live with stakes on the line.",
            modeBattleTitle: "BATTLE ROYALE",
            modeBattleDesc: "Join a knockout elimination tournament pool.",
            modeSpiritTitle: "SPIRIT FIGHT",
            modeSpiritDesc: "Access the global portal & NFT Marketplace.",

            // Character Screen
            charTitle: "WARRIOR SELECTION",
            pseudoLabel: "YOUR NICKNAME",
            pseudoPlaceholder: "Ex: ShadowBlade",
            volumeLabel: "VOLUME",
            confirmCharBtn: "CONFIRM FIGHTER",
            charStyleMartial: "Martial Arts",
            charStyleSpeed: "Speed",
            charStyleStrength: "Raw Strength",
            charStyleTitan: "Titan Power",

            // Duel Lobby Screen
            duelLobbyTitle: "1VS1 DUEL LOBBY",
            searchPlaceholder: "Nickname or wallet address...",
            onlinePlayers: "ONLINE PLAYERS",
            challengeBtn: "CHALLENGE",
            inFightStatus: "In Battle",
            idleStatus: "Available",

            // Battle Royale Lobby Screen
            brLobbyTitle: "BATTLE ROYALE ROOMS",
            createBattleBtn: "CREATE BATTLE",
            inviteCodePlaceholder: "Private invite code...",
            joinBtn: "JOIN",
            openRooms: "OPEN ROOMS",
            playersCount: "{current}/{max} Players",
            entryFee: "Stake: {fee} TST",

            // Spirit Fight Screen
            spiritTitle: "SPIRIT FIGHT",
            spiritDesc: "The complete universe: arena, NFT marketplace, referrals & influencer rewards.",
            launchSpiritBtn: "LAUNCH BATTLEPOOL (APP 1)",

            // Pool Room Screen
            quitBtn: "LEAVE",
            waitingStatus: "WAITING",
            inProgressStatus: "IN PROGRESS",
            finishedStatus: "FINISHED",
            shareInvite: "Share room invitation:",
            copyLinkBtn: "COPY LINK",
            copyCodeBtn: "COPY CODE",
            codeLabel: "CODE:",
            fightersInPool: "FIGHTERS IN TOURNAMENT",
            poolChampion: "Tournament Champion: {winner}!",
            poolPotWon: "Accumulated prize: {pot} TST",

            // Combat & HUD
            player1: "PLAYER 1",
            player2: "PLAYER 2",
            loadingArena: "LOADING ARENA...",
            loadingEngine: "Preparing 3D Engine...",
            engine2DPrep: "PREPARING 2D COMBAT ({pct}%)...",
            engine3DBackground: "3D ENGINE IN BACKGROUND ({pct}%)...",
            depositPending: "WAITING FOR BOTH PLAYERS' DEPOSITS...",
            chooseMove: "CHOOSE YOUR MOVE",
            moveBarInstruction: "Your turn! Choose your move:",
            moveRock: "ROCK",
            movePaper: "PAPER",
            moveScissors: "SCISSORS",
            round: "ROUND {num}",
            roundWon: "Round Won!",
            roundLost: "Round Lost...",
            roundDraw: "Draw! Play again!",
            waitingOpponent: "Waiting for opponent's move...",
            fightFinished: "Fight finished",
            poolTitle: "Pool #{id}",
            quitPoolClaim: "🏆 Claim prize & leave",
            quitPoolBack: "← Back to lobby",
            quitPoolMatches: "Matches in progress...",
            quitPoolDefault: "Leave pool",
            poolFull: "Pool is full, the battle begins!",
            poolWaiting: "Waiting for players...",
            poolRoundInProgress: "Round in progress...",
            poolExempted: "You are exempted for this round! Wait for the next one.",
            poolEliminated: "You are eliminated from the pool!",
            poolClosePanel: "You can close this panel.",
            poolLeftInterface: "You left the pool interface.",
            youAreChampion: "🏆 You are the champion!",
            championIs: "Champion: {winner}",
            poolFinishedNoWinner: "Pool finished (no winner)",
            searchingPools: "Searching for pools...",
            noPools: "No public pool open.",
            poolsError: "Connection error.",
            poolAllIn: "(All-In)",
            poolJoin: "Join queue",
            poolFullBtn: "Room Full",
            noFighters: "No fighter found.",
            challenge: "CHALLENGE",
            inCombatBtn: "In Battle",
            portalBackBtn: "BACK TO GAME",
            portalLoading: "Loading BATTLEPOOL portal...",
            challengeDefaultText: "A player challenges you to a duel.",
            challengeReceivedShort: "{challenger} challenges you for {bet} TST!",
            victoryGains: "Victory! You won {amount} TST!",
            drawRefund: "Draw! Your stake is refunded.",
            defeatMsg: "Defeat... You lost the match.",
            char1: "Ninja Warrior",
            char2: "Cyborg Mutant",
            char3: "Tom Frazer",
            char4: "Big Choco",

            // Victory / Defeat Screen
            victoryTitle: "VICTORY!",
            defeatTitle: "DEFEAT",
            drawTitle: "DRAW",
            youWon: "You won the battle!",
            youLost: "Your opponent won.",
            claimGains: "CLAIM PRIZE ({amount} TST)",
            returnLobby: "BACK TO MENU",
            rematchBtn: "REMATCH",

            // Modals
            qrModalTitle: "SCAN QR CODE",
            challengeTargetTitle: "CHALLENGE {target}",
            sendChallengeBtn: "SEND CHALLENGE",
            betAmountLabel: "Stake amount:",
            challengeReceivedTitle: "CHALLENGE RECEIVED!",
            challengeReceivedText: "{challenger} challenges you to a duel with a stake of {bet} TST.",
            acceptBtn: "ACCEPT",
            counterBtn: "COUNTER-OFFER",
            declineBtn: "DECLINE",
            createPoolTitle: "CREATE BATTLE ROYALE",
            entryFeeLabel: "Entry fee (TST):",
            maxPlayersLabel: "Max players (2 to 64):",
            eliminationRuleLabel: "Elimination rule:",
            suddenDeathOption: "Sudden Death (1 loss = elimination)",
            privatePoolLabel: "Private room with code:",
            createPoolSubmit: "CREATE ROOM",
            endConditionLabel: "End condition:",
            endLastManOption: "Last survivor",
            endRemainingOption: "N survivors",
            endTimeOption: "Time limit",
            endCountLabel: "Target survivors:",
            endSecondsLabel: "Duration (seconds):",
            poolWatch: "WATCH",
            spectatorStatus: "SPECTATOR",
            spectatorMode: "Spectator mode: you are watching the pool without playing.",
            poolFullWatch: "Room full — opening in spectator mode.",
            poolEliminatedSpectator: "Eliminated — spectator mode: you can keep following the pool.",
            poolInProgress: "LIVE",
            poolWaitingDeposits: "Waiting for players' deposits...",
            poolClaimYourLoot: "Loot to claim: {amount} TST",
            lootOut: "OUT",
            lootAlive: "ALIVE",
            inviteModalTitle: "ROOM INVITATION",
            inviteModalText: "You are invited to join a battle room.",
            joinRoomBtn: "JOIN ROOM",

            // Toasts & Alerts
            toastLinkCopied: "Link copied!",
            toastCodeCopied: "Code copied!",
            toastNoCode: "No code available.",
            toastWalletConnected: "Wallet connected: {addr}",
            toastMetaMaskRefused: "Connection rejected by user.",
            toastNoWallet: "No wallet detected. Install MetaMask or use a demo key.",
            toastInvalidKey: "Invalid private key.",
            toastDepositPending: "Depositing {amount} TST to blockchain...",
            toastDepositSuccess: "Deposit confirmed on blockchain!",
            toastDepositError: "On-chain deposit failed: {err}",
            toastChallengeRefused: "Opponent declined your challenge.",
            toastCameraDenied: "Camera access denied or unavailable."
        },

        es: {
            // General
            appName: "Web3 Combat Game",
            back: "Volver",
            confirm: "Confirmar",
            cancel: "Cancelar",
            close: "Cerrar",
            loading: "Cargando...",
            copy: "Copiar",
            copied: "¡Copiado!",
            or: "O",
            max: "MÁX",

            // Language Screen
            langTitle: "IDIOMA / LANGUAGE",
            langSubtitle: "Seleccione su idioma de interfaz",

            // Connect Screen
            connectTitle: "CONEXIÓN WEB3",
            connectSubtitle: "Conecte su billetera para acceder a los combates y a sus tokens.",
            perk1: "Duelos 1v1 & Battle Royale",
            perk2: "Sin claves privadas guardadas",
            perk3: "Tokens y recompensas on-chain",
            connectWalletBtn: "CONECTAR BILLETERA",
            connectHint: "Firma gratuita — no se envía ninguna transacción.",
            walletConnected: "Billetera conectada",

            // Mode Screen
            modeTitle: "MODO DE JUEGO",
            modeDuelTitle: "1 VS 1 DUELO",
            modeDuelDesc: "Enfréntate a un oponente en directo con apuestas.",
            modeBattleTitle: "BATTLE ROYALE",
            modeBattleDesc: "Únete a un torneo de eliminación directa.",
            modeSpiritTitle: "SPIRIT FIGHT",
            modeSpiritDesc: "Accede al portal global y Marketplace NFT.",

            // Character Screen
            charTitle: "SELECCIÓN DE GUERRERO",
            pseudoLabel: "SU APODO",
            pseudoPlaceholder: "Ej: ShadowBlade",
            volumeLabel: "VOLUMEN",
            confirmCharBtn: "CONFIRMAR LUCHADOR",
            charStyleMartial: "Artes Marciales",
            charStyleSpeed: "Velocidad",
            charStyleStrength: "Fuerza Bruta",
            charStyleTitan: "Fuerza Titán",

            // Duel Lobby Screen
            duelLobbyTitle: "SALA 1VS1 DUELO",
            searchPlaceholder: "Apodo o dirección de billetera...",
            onlinePlayers: "JUGADORES EN LÍNEA",
            challengeBtn: "DESAFIAR",
            inFightStatus: "En combate",
            idleStatus: "Disponible",

            // Battle Royale Lobby Screen
            brLobbyTitle: "SALAS BATTLE ROYALE",
            createBattleBtn: "CREAR BATALLA",
            inviteCodePlaceholder: "Código de invitación privado...",
            joinBtn: "UNIRSE",
            openRooms: "SALAS ABIERTAS",
            playersCount: "{current}/{max} Jugadores",
            entryFee: "Apuesta: {fee} TST",

            // Spirit Fight Screen
            spiritTitle: "SPIRIT FIGHT",
            spiritDesc: "El universo completo: arena, marketplace NFT y recompensas.",
            launchSpiritBtn: "LANZAR BATTLEPOOL (APP 1)",

            // Pool Room Screen
            quitBtn: "SALIR",
            waitingStatus: "EN ESPERA",
            inProgressStatus: "EN CURSO",
            finishedStatus: "TERMINADO",
            shareInvite: "Comparte la invitación a la sala:",
            copyLinkBtn: "COPIAR ENLACE",
            copyCodeBtn: "COPIAR CÓDIGO",
            codeLabel: "CÓDIGO:",
            fightersInPool: "LUCHADORES EN EL TORNEO",
            poolChampion: "¡Campeón del torneo: {winner}!",
            poolPotWon: "Premio acumulado: {pot} TST",

            // Combat & HUD
            player1: "JUGADOR 1",
            player2: "JUGADOR 2",
            loadingArena: "CARGANDO ARENA...",
            loadingEngine: "Preparando motor 3D...",
            engine2DPrep: "PREPARANDO COMBATE 2D ({pct}%)...",
            engine3DBackground: "MOTOR 3D EN SEGUNDO PLANO ({pct}%)...",
            depositPending: "ESPERANDO DEPÓSITOS DE AMBOS JUGADORES...",
            chooseMove: "ELIGE TU MOVIMIENTO",
            moveBarInstruction: "¡Tu turno! Elige tu movimiento:",
            moveRock: "PIEDRA",
            movePaper: "PAPEL",
            moveScissors: "TIJERA",
            round: "RONDA {num}",
            roundWon: "¡Ronda ganada!",
            roundLost: "Ronda perdida...",
            roundDraw: "¡Empate! ¡Juega de nuevo!",
            waitingOpponent: "Esperando movimiento rival...",
            fightFinished: "Combate finalizado",
            poolTitle: "Grupo #{id}",
            quitPoolClaim: "🏆 Reclamar premio y salir",
            quitPoolBack: "← Volver al lobby",
            quitPoolMatches: "Partidos en curso...",
            quitPoolDefault: "Salir del grupo",
            poolFull: "¡Grupo completo, empieza la batalla!",
            poolWaiting: "Esperando jugadores...",
            poolRoundInProgress: "Ronda en curso...",
            poolExempted: "¡Estás exento en esta ronda! Espera la siguiente.",
            poolEliminated: "¡Estás eliminado del grupo!",
            poolClosePanel: "Puedes cerrar este panel.",
            poolLeftInterface: "Has salido de la interfaz del grupo.",
            youAreChampion: "🏆 ¡Eres el campeón!",
            championIs: "Campeón: {winner}",
            poolFinishedNoWinner: "Grupo terminado (sin ganador)",
            searchingPools: "Buscando grupos...",
            noPools: "Ningún grupo público abierto.",
            poolsError: "Error de conexión.",
            poolAllIn: "(All-In)",
            poolJoin: "Unirse a la fila",
            poolFullBtn: "Sala Completa",
            noFighters: "Ningún luchador encontrado.",
            challenge: "DESAFIAR",
            inCombatBtn: "En combate",
            portalBackBtn: "VOLVER AL JUEGO",
            portalLoading: "Cargando portal BATTLEPOOL...",
            challengeDefaultText: "Un jugador te desafía a un duelo.",
            challengeReceivedShort: "¡{challenger} te desafía por {bet} TST!",
            victoryGains: "¡Victoria! ¡Ganaste {amount} TST!",
            drawRefund: "¡Empate! Se devuelve tu apuesta.",
            defeatMsg: "Derrota... Perdiste el combate.",
            char1: "Guerrero Ninja",
            char2: "Cyborg Mutante",
            char3: "Tom Frazer",
            char4: "Big Choco",

            // Victory / Defeat Screen
            victoryTitle: "¡VICTORIA!",
            defeatTitle: "DERROTA",
            drawTitle: "EMPATE",
            youWon: "¡Has ganado el combate!",
            youLost: "Tu rival ha ganado.",
            claimGains: "RECLAMAR PREMIO ({amount} TST)",
            returnLobby: "VOLVER AL MENÚ",
            rematchBtn: "REVANCHA",

            // Modals
            qrModalTitle: "ESCANEAR CÓDIGO QR",
            challengeTargetTitle: "DESAFIAR A {target}",
            sendChallengeBtn: "ENVIAR DESAFÍO",
            betAmountLabel: "Monto de la apuesta:",
            challengeReceivedTitle: "¡DESAFÍO RECIBIDO!",
            challengeReceivedText: "{challenger} te desafía a un duelo con una apuesta de {bet} TST.",
            acceptBtn: "ACEPTAR",
            counterBtn: "CONTRAOFERTA",
            declineBtn: "RECHAZAR",
            createPoolTitle: "CREAR BATTLE ROYALE",
            entryFeeLabel: "Frais de entrada (TST):",
            maxPlayersLabel: "Jugadores máx (2 a 64):",
            eliminationRuleLabel: "Regla de eliminación:",
            suddenDeathOption: "Muerte Súbita (1 derrota = eliminación)",
            privatePoolLabel: "Sala privada con código:",
            createPoolSubmit: "CREAR SALA",
            endConditionLabel: "Condición de fin:",
            endLastManOption: "Último superviviente",
            endRemainingOption: "N supervivientes",
            endTimeOption: "Tiempo limitado",
            endCountLabel: "Supervivientes objetivo:",
            endSecondsLabel: "Duración (segundos):",
            poolWatch: "VER",
            spectatorStatus: "ESPECTADOR",
            spectatorMode: "Modo espectador: sigues la sala sin participar.",
            poolFullWatch: "Sala llena — apertura como espectador.",
            poolEliminatedSpectator: "Eliminado — modo espectador: puedes seguir la sala.",
            poolInProgress: "EN CURSO",
            poolWaitingDeposits: "Esperando los depósitos de los jugadores...",
            poolClaimYourLoot: "Botín a reclamar: {amount} TST",
            lootOut: "ELIMINADO",
            lootAlive: "VIVO",
            inviteModalTitle: "INVITACIÓN A SALA",
            inviteModalText: "Estás invitado a unirte a una sala de combate.",
            joinRoomBtn: "UNIRSE A LA SALA",

            // Toasts & Alerts
            toastLinkCopied: "¡Enlace copiado!",
            toastCodeCopied: "¡Código copiado!",
            toastNoCode: "No hay código disponible.",
            toastWalletConnected: "Billetera conectada: {addr}",
            toastMetaMaskRefused: "Conexión rechazada por el usuario.",
            toastNoWallet: "No se detectó billetera. Instala MetaMask o usa clave demo.",
            toastInvalidKey: "Clave privada no válida.",
            toastDepositPending: "Depositando {amount} TST en blockchain...",
            toastDepositSuccess: "¡Depósito confirmado en blockchain!",
            toastDepositError: "Fallo en el depósito: {err}",
            toastChallengeRefused: "El oponente rechazó el desafío.",
            toastCameraDenied: "Acceso a la cámara denegado o no disponible."
        },

        pt: {
            // General
            appName: "Web3 Combat Game",
            back: "Voltar",
            confirm: "Confirmar",
            cancel: "Cancelar",
            close: "Fechar",
            loading: "Carregando...",
            copy: "Copiar",
            copied: "Copiado!",
            or: "OU",
            max: "MÁX",

            // Language Screen
            langTitle: "IDIOMA / LANGUAGE",
            langSubtitle: "Selecione o seu idioma de interface",

            // Connect Screen
            connectTitle: "CONEXÃO WEB3",
            connectSubtitle: "Conecte sua carteira para acessar combates e seus tokens.",
            perk1: "Duelos 1v1 & Battle Royale",
            perk2: "Zero chaves privadas armazenadas",
            perk3: "Tokens e recompensas on-chain",
            connectWalletBtn: "CONECTAR CARTEIRA",
            connectHint: "Assinatura gratuita — nenhuma transação é enviada.",
            walletConnected: "Carteira conectada",

            // Mode Screen
            modeTitle: "MODO DE JOGO",
            modeDuelTitle: "1 VS 1 DUELO",
            modeDuelDesc: "Enfrente um adversário ao vivo com apostas em jogo.",
            modeBattleTitle: "BATTLE ROYALE",
            modeBattleDesc: "Junte-se a uma sala de torneio eliminatório direto.",
            modeSpiritTitle: "SPIRIT FIGHT",
            modeSpiritDesc: "Acesse o portal global e Marketplace NFT.",

            // Character Screen
            charTitle: "SELEÇÃO DO GUERREIRO",
            pseudoLabel: "SEU APELIDO",
            pseudoPlaceholder: "Ex: ShadowBlade",
            volumeLabel: "VOLUME",
            confirmCharBtn: "CONFIRMAR LUTADOR",
            charStyleMartial: "Artes Marciais",
            charStyleSpeed: "Velocidade",
            charStyleStrength: "Força Bruta",
            charStyleTitan: "Força Titã",

            // Duel Lobby Screen
            duelLobbyTitle: "LOBBY 1VS1 DUELO",
            searchPlaceholder: "Apelido ou endereço de carteira...",
            onlinePlayers: "JOGADORES ONLINE",
            challengeBtn: "DESAFIAR",
            inFightStatus: "Em combate",
            idleStatus: "Disponível",

            // Battle Royale Lobby Screen
            brLobbyTitle: "SALAS BATTLE ROYALE",
            createBattleBtn: "CRIAR BATALHA",
            inviteCodePlaceholder: "Código de convite privado...",
            joinBtn: "ENTRAR",
            openRooms: "SALAS ABERTAS",
            playersCount: "{current}/{max} Jogadores",
            entryFee: "Aposta: {fee} TST",

            // Spirit Fight Screen
            spiritTitle: "SPIRIT FIGHT",
            spiritDesc: "O universo completo: arena, marketplace NFT e recompensas.",
            launchSpiritBtn: "LANÇAR BATTLEPOOL (APP 1)",

            // Pool Room Screen
            quitBtn: "SAIR",
            waitingStatus: "AGUARDANDO",
            inProgressStatus: "EM ANDAMENTO",
            finishedStatus: "CONCLUÍDO",
            shareInvite: "Compartilhe o convite para a sala:",
            copyLinkBtn: "COPIAR LINK",
            copyCodeBtn: "COPIAR CÓDIGO",
            codeLabel: "CÓDIGO:",
            fightersInPool: "LUTADORES NO TORNEIO",
            poolChampion: "Campeão do torneio: {winner}!",
            poolPotWon: "Prêmio acumulado: {pot} TST",

            // Combat & HUD
            player1: "JOGADOR 1",
            player2: "JOGADOR 2",
            loadingArena: "CARREGANDO ARENA...",
            loadingEngine: "Preparando motor 3D...",
            engine2DPrep: "PREPARANDO COMBATE 2D ({pct}%)...",
            engine3DBackground: "MOTOR 3D EM SEGUNDO PLANO ({pct}%)...",
            depositPending: "AGUARDANDO DEPÓSITOS DOS DOIS JOGADORES...",
            chooseMove: "ESCOLHA SEU GOLPE",
            moveBarInstruction: "Sua vez! Escolha seu golpe:",
            moveRock: "PEDRA",
            movePaper: "PAPEL",
            moveScissors: "TESOURA",
            round: "ROUND {num}",
            roundWon: "Round Ganho!",
            roundLost: "Round Perdido...",
            roundDraw: "Empate! Jogue novamente!",
            waitingOpponent: "Aguardando golpe adversário...",
            fightFinished: "Combate terminado",
            poolTitle: "Grupo #{id}",
            quitPoolClaim: "🏆 Resgatar prêmio e sair",
            quitPoolBack: "← Voltar ao lobby",
            quitPoolMatches: "Partidas em andamento...",
            quitPoolDefault: "Sair do grupo",
            poolFull: "Grupo cheio, a batalha começa!",
            poolWaiting: "Aguardando jogadores...",
            poolRoundInProgress: "Round em andamento...",
            poolExempted: "Você está isento neste round! Aguarde o próximo.",
            poolEliminated: "Você foi eliminado do grupo!",
            poolClosePanel: "Você pode fechar este painel.",
            poolLeftInterface: "Você saiu da interface do grupo.",
            youAreChampion: "🏆 Você é o campeão!",
            championIs: "Campeão: {winner}",
            poolFinishedNoWinner: "Grupo encerrado (sem vencedor)",
            searchingPools: "Buscando grupos...",
            noPools: "Nenhum grupo público aberto.",
            poolsError: "Erro de conexão.",
            poolAllIn: "(All-In)",
            poolJoin: "Entrar na fila",
            poolFullBtn: "Sala Cheia",
            noFighters: "Nenhum lutador encontrado.",
            challenge: "DESAFIAR",
            inCombatBtn: "Em combate",
            portalBackBtn: "VOLTAR AO JOGO",
            portalLoading: "Carregando portal BATTLEPOOL...",
            challengeDefaultText: "Um jogador desafia você para um duelo.",
            challengeReceivedShort: "{challenger} desafia você por {bet} TST!",
            victoryGains: "Vitória! Você ganhou {amount} TST!",
            drawRefund: "Empate! Sua aposta é devolvida.",
            defeatMsg: "Derrota... Você perdeu a partida.",
            char1: "Guerreiro Ninja",
            char2: "Cyborg Mutante",
            char3: "Tom Frazer",
            char4: "Big Choco",

            // Victory / Defeat Screen
            victoryTitle: "VITÓRIA!",
            defeatTitle: "DERROTA",
            drawTitle: "EMPATE",
            youWon: "Você venceu a batalha!",
            youLost: "Seu adversário venceu.",
            claimGains: "RESGATAR PRÊMIO ({amount} TST)",
            returnLobby: "VOLTAR AO MENU",
            rematchBtn: "REVANCHE",

            // Modals
            qrModalTitle: "ESCANEAR CÓDIGO QR",
            challengeTargetTitle: "DESAFIAR {target}",
            sendChallengeBtn: "ENVIAR DESAFIO",
            betAmountLabel: "Valor da aposta:",
            challengeReceivedTitle: "DESAFIO RECEBIDO!",
            challengeReceivedText: "{challenger} desafia você para um duelo com aposta de {bet} TST.",
            acceptBtn: "ACEITAR",
            counterBtn: "CONTRAPROPOSTA",
            declineBtn: "RECUSAR",
            createPoolTitle: "CRIAR BATTLE ROYALE",
            entryFeeLabel: "Taxa de entrada (TST):",
            maxPlayersLabel: "Jogadores máx (2 a 64):",
            eliminationRuleLabel: "Regra de eliminação:",
            suddenDeathOption: "Morte Súbita (1 derrota = eliminação)",
            privatePoolLabel: "Sala privada com código:",
            createPoolSubmit: "CRIAR SALA",
            endConditionLabel: "Condição de fim:",
            endLastManOption: "Último sobrevivente",
            endRemainingOption: "N sobreviventes",
            endTimeOption: "Tempo limitado",
            endCountLabel: "Sobreviventes alvo:",
            endSecondsLabel: "Duração (segundos):",
            poolWatch: "ASSISTIR",
            spectatorStatus: "ESPECTADOR",
            spectatorMode: "Modo espectador: você acompanha a sala sem participar.",
            poolFullWatch: "Sala cheia — abrindo como espectador.",
            poolEliminatedSpectator: "Eliminado — modo espectador: você pode continuar acompanhando a sala.",
            poolInProgress: "AO VIVO",
            poolWaitingDeposits: "Aguardando os depósitos dos jogadores...",
            poolClaimYourLoot: "Butim a reclamar: {amount} TST",
            lootOut: "ELIMINADO",
            lootAlive: "VIVO",
            inviteModalTitle: "CONVITE PARA SALA",
            inviteModalText: "Você foi convidado para uma sala de combate.",
            joinRoomBtn: "ENTRAR NA SALA",

            // Toasts & Alerts
            toastLinkCopied: "Link copiado!",
            toastCodeCopied: "Código copiado!",
            toastNoCode: "Nenhum código disponível.",
            toastWalletConnected: "Carteira conectada: {addr}",
            toastMetaMaskRefused: "Conexão rejeitada pelo usuário.",
            toastNoWallet: "Nenhuma carteira detectada. Instale o MetaMask ou use uma chave demo.",
            toastInvalidKey: "Chave privada inválida.",
            toastDepositPending: "Depositando {amount} TST na blockchain...",
            toastDepositSuccess: "Depósito confirmado na blockchain!",
            toastDepositError: "Falha no depósito: {err}",
            toastChallengeRefused: "O adversário recusou o desafio.",
            toastCameraDenied: "Acesso à câmera negado ou indisponível."
        }
    };

    let currentLang = DEFAULT_LANGUAGE;

    /**
     * Normalise le code de langue pour qu'il corresponde à nos langues supportées.
     */
    function normalizeLang(code) {
        if (!code || typeof code !== 'string') return null;
        const cleaned = code.trim().toLowerCase().split(/[-_]/)[0];
        return SUPPORTED_LANGUAGES.includes(cleaned) ? cleaned : null;
    }

    /**
     * Détecte la langue selon l'ordre de priorité défini :
     * 1. URL (?lang= ou ?language=)
     * 2. localStorage ('portal_lang', 'web3combat_lang', 'language', 'locale')
     * 3. Navigateur (navigator.language)
     * 4. Fallback 'fr'
     */
    function detectLanguage() {
        // 1. Paramètres URL (priorité portail injecté)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlLang = normalizeLang(urlParams.get('lang') || urlParams.get('language') || urlParams.get('locale'));
            if (urlLang) {
                console.log("[i18n] Langue détectée via URL :", urlLang);
                return urlLang;
            }
        } catch (e) {}

        // 2. LocalStorage (Portail & Application)
        const storageKeys = [
            'portal_lang',
            'portal_language',
            'web3combat_lang',
            'language',
            'locale',
            'app_lang'
        ];

        for (const key of storageKeys) {
            try {
                const val = localStorage.getItem(key);
                const norm = normalizeLang(val);
                if (norm) {
                    console.log(`[i18n] Langue trouvée dans localStorage (${key}) :`, norm);
                    return norm;
                }
            } catch (e) {}
        }

        // 3. Navigateur
        if (typeof navigator !== 'undefined' && navigator.language) {
            const navLang = normalizeLang(navigator.language);
            if (navLang) {
                console.log("[i18n] Langue du navigateur utilisée :", navLang);
                return navLang;
            }
        }

        return DEFAULT_LANGUAGE;
    }

    /**
     * Traduit une clé avec interpolation de variables.
     */
    function t(key, params) {
        const dict = TRANSLATIONS[currentLang] || TRANSLATIONS[DEFAULT_LANGUAGE];
        let str = dict[key];

        // Fallback sur le français si la clé manque dans la langue courante
        if (str === undefined) {
            str = TRANSLATIONS[DEFAULT_LANGUAGE][key] !== undefined ? TRANSLATIONS[DEFAULT_LANGUAGE][key] : key;
        }

    if (params && typeof params === 'object') {
        for (const p in params) {
            str = str.split(`{${p}}`).join(params[p]);
        }
    }
    return str;
}

    /**
     * Applique la langue sur l'ensemble de l'interface DOM.
     */
    function applyLanguage(lang) {
        const norm = normalizeLang(lang) || DEFAULT_LANGUAGE;
        currentLang = norm;

        // Persistance locale
        try {
            localStorage.setItem('web3combat_lang', norm);
            localStorage.setItem('portal_lang', norm);
        } catch (e) {}

        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.lang = norm;
        }

        // Mettre à jour tous les éléments marqués [data-i18n]
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const translated = t(key);
                // Si l'élément contient des balises icônes (ex: <i>), on remplace uniquement le texte
                const icon = el.querySelector('i');
                if (icon) {
                    // Préserver l'icône et changer le reste du texte
                    const iconClone = icon.cloneNode(true);
                    el.textContent = ' ';
                    el.prepend(iconClone);
                    el.appendChild(document.createTextNode(' ' + translated));
                } else {
                    el.textContent = translated;
                }
            }
        });

        // Mettre à jour les placeholders [data-i18n-placeholder]
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.placeholder = t(key);
        });

        // Mettre à jour les titres [data-i18n-title]
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) el.title = t(key);
        });

        // Mettre à jour la surbrillance visuelle sur les boutons de langues
        document.querySelectorAll('.lang-card').forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick') || '';
            if (onclickAttr.includes(`'${norm}'`) || onclickAttr.includes(`"${norm}"`)) {
                btn.classList.add('active-lang');
            } else {
                btn.classList.remove('active-lang');
            }
        });

        // Mettre à jour le bouton de langue rapide s'il existe
        const quickLangBtn = document.getElementById('quick-lang-current');
        if (quickLangBtn) {
            const flags = { fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸', pt: '🇵🇹' };
            quickLangBtn.textContent = flags[norm] || norm.toUpperCase();
        }

        // Re-rendre les icônes Lucide si la bibliothèque est disponible
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }

        // Émettre un événement pour notifier le code dynamique de app.js
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: norm } }));

        console.log(`[i18n] Langue appliquée avec succès : ${norm}`);
    }

    /**
     * Initialisation au démarrage.
     */
    function init() {
        const detected = detectLanguage();
        applyLanguage(detected);
        return detected;
    }

    // Export global
    window.I18N = {
        SUPPORTED_LANGUAGES,
        DEFAULT_LANGUAGE,
        t,
        applyLanguage,
        detectLanguage,
        getLanguage: () => currentLang,
        init,
        // Ré-applique la langue courante (re-render complet du DOM) :
        // utilisé par app.js/anim2d.js après régénération de vues dynamiques.
        refresh: () => applyLanguage(currentLang)
    };

    // Auto-initialisation immédiate dès que le DOM est interactif
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        init();
    }
})();
