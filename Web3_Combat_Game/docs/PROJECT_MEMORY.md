# MÉMOIRE DU PROJET — Web3 Combat Game
**Version :** 1.0 — mise à jour après les itérations 1 à 8 (UX/UI 2D + Mode Lite + infra)
**Dernière mise à jour :** 2026-09-03
**Source de vérité :** le code sur disque prime sur ce document.

Ce document centralise l'état réel du projet, les décisions prises, les bugs résolus
et les pièges connus. À lire AVANT toute modification. Complète `UX_PRD.md` (couche
UI) et `UX_PROMPT.md` (règles d'intervention) — en cas de conflit : code disque >
ce fichier > PRD/prompt.

---

## §1. Stack d'exécution (docker-compose.yml)

| Conteneur | Image/port | Rôle |
|---|---|---|
| `web3_combat_frontend` | :8080 | Serveur statique Python (front vanilla) |
| `web3_combat_api` | :8000 (API Laravel) + :8081 (Reverb WS) | Backend + WebSocket |
| `web3_combat_blockchain` | :8545 | Hardhat node + deploy CombatGame |
| `web3_combat_db` | :3306 | MySQL 8 (volume `db_data`) |
| `web3_combat_indexer` | (aucun port) | Watcher d'événements on-chain → API interne |

- **ChainId du projet : `8845` (hex `0x228d`)** — défini dans
  `blockchain/hardhat.config.js`. Distinct de 31337 (réservé à un AUTRE projet de
  l'utilisateur dans MetaMask). Aucune référence à 31337 en dur dans le code.
- **Adresse du contrat : `0x5FbDB2315678afecb367f032d93F642f64180aa3`** — stable
  (même ordre de deploy Hardhat = même adresse après chaque redeploy). Doublée
  dans `frontend/config.js` (CONSULTER, jamais éditer) et dans l'env indexer
  (`docker-compose.yml` l.49).
- Redeploy automatique au démarrage du conteneur blockchain (entrypoint.sh).

## §2. Cache-busters actuels (vérifiés sur disque — re-vérifier avant tout bump)

| Fichier | Version |
|---|---|
| `style.css` | `?v=4.0` |
| `app.js` | `?v=4.5` |
| `anim2d.js` | `?v=9` |
| `config.js` | `?v=6` (JAMAIS modifié) |
| `godot/jeu.js` | `?v=3` |

## §3. Mode Lite (chargement prioritaire 2D) — itération 6

Flux de chargement repensé : Godot = **142 MB** (jeu.wasm 37.7 + jeu.pck 104.5).

1. `anim2d.js` précharge ses 16 sprites (4 persos × 4 poses) puis tire l'évent
   `anim2d:ready` + API `window.isSprites2DReady()` / `getSprites2DProgress()`.
2. `index.html` (script boot Godot) : `engine.startGame()` est DIFFÉRÉ — attend
   `anim2d:ready` (garde-fou 15s) puis démarre **en parallèle** du jeu 2D.
3. **Protection appareils faibles** : `deviceLooksWeak()` — si
   `navigator.deviceMemory ≤ 2` ou `hardwareConcurrency ≤ 2`, Godot n'est PAS
   démarré automatiquement (mode 2D seul, log console explicite).
4. Progression en 2 phases dans le badge 2D (« PRÉPARATION DU COMBAT 2D (x%) »
   puis « MOTEUR 3D EN ARRIÈRE-PLAN (x%) »).

## §4. Moteur 2D (anim2d.js) — état et fonctionnalités

- 537 lignes. API publique : `setFighters2D`, `triggerRound2D`,
  `toggleAnim2D`, `transition2Dto3D`, `showMoveBar2D`, `submitMove2D` (contrat
  app.js), `setSelectedMove2D`, `clearSelectedMove2D`, `isSprites2DReady`,
  `getSprites2DProgress`, `updateAnim2DProgress`.
- **Sprites** : PNG dans `frontend/anim2d/{ninja,cyborg,tom,choco}/{idle,attack,hurt,victory}.png`.
  Traitement au preload : flood-fill depuis les bords (tolérance 235) → fond blanc
  transparent (blancs intérieurs préservés) + recadrage bounding-box.
- **Échelle** : `charHeight()` = clamp(canvas.h × 0.65 × mobileScale(0.52 si
  portrait ≤768px), **150px, 400px**) × `P1_SCALE_MULT 0.88` / `P2_SCALE_MULT 0.95`.
- **Positions** : `fighterX(side)` — écran >600px : centre ± `min(25% largeur, 300px)`;
  écran ≤600px : sprites à 5% des bords. Sol : 0.88 de hauteur (0.80 en mobile
  pour laisser la place à la barre de choix).
- **Feedback du coup choisi** : badge néon dessiné DANS le canvas au-dessus de la
  tête de P1 (`drawSelectedMoveBadge`, émojis ✊✋✌, glow cyan/violet/or, popIn
  300ms) + badge HUD DOM `#player-selected-move` + classe `.selected` sur le
  bouton. Reset au début de chaque tour (`triggerRound2D` → `clearSelectedMove2D`).
- Mapping coups→icônes : `{1:'hand-metal', 2:'hand', 3:'scissors'}` —
  **`fist` n'existe PAS dans le bundle Lucide local** (vérifié), utiliser hand-metal.

## §5. Contrats DOM/JS critiques (ne jamais casser)

- `onclick="window.submitMove2D(1|2|3)"` des `#btn-move-1/2/3` (app.js l.~1900).
- Classe `.anim2d-move-btn` : cible des locks de boutons (app.js, 4 refs).
- `#wallet-status-box` / `#wallet-addr-display` : affichés par `connectWallet()`.
- `#player-badge` : innerHTML injecté par `performLogin()` (l.~906).
- `#hud-p1-name` / `#hud-p2-name` : synchronisés par anim2d.js (no-op si absent).
- `#loading-bar` / `#loading-text` : écran de chargement de combat.
- Flux connexion : **clic** sur « CONNECTER LE WALLET » en flux autonome ;
  auto-connexion UNIQUEMENT en entrée portail `?mode=…&wallet=…` ou `?player=N`
  (e2e, comptes Hardhat déterministes).
- `window.resetMatchState`, `launchGodot`, `executeMatchOnChain`,
  `depositForMatch`, `initiateChallenge`, `openBetModal` : functions module-level
  **NON exposées sur window** (sauf mention contraire) — inaccessible depuis
  `page.evaluate` dans les tests, utiliser les boutons réels.

## §6. Flux dépôt/combat — SWITCH à deux modes (app.js, l.2-11)

```js
const LAUNCH_GAME_BEFORE_DEPOSIT_CONFIRM = true;  // Option 1 (défaut)
```
- **Option 1 (true)** : `MatchStarted` → modale fermée 1s → `launchGodot`
  immédiat ; `depositForMatch` en arrière-plan ; si échec (revert/refus) →
  toast + `resetMatchState()` + retour lobby.
- **Option 2 (false)** : `await depositForMatch(betAmount)` AVANT le lancement
  (sécurité max, ~12-30s d'attente mesurée via provider MetaMask).
- **Fait mesuré** : `tx.wait()` via le provider MetaMask met 12-28s (et peut
  rester bloqué en contention avec le polling `updateBalance`) — la tx EST minée
  (prouvée par `eth_getTransactionReceipt`), seul le toast « confirmé » peut tarder.

### §6bis. Règlement + retrait GASLESS (P1+P2 — itération ICDM)

Objectif : éliminer les popups MetaMask après la connexion + l'auth de session.
- **Settle backend (P1)** : route `POST /battle/settle {winner, loser}` →
  `InternalController::settleDuel` exécute `node /srv/blockchain/scripts/settle_fight.js 0 <winner> <loser>`
  (backend signer paie le gaz). Le front `settleMatchOnWin()` (app.js) appelle
  cette route — **0 popup pour le gagnant**. Idempotent (solde 0 = noop).
- **Retrait push (P2)** : fonction contrat `withdrawTo(user, amount, nonce, signature)`
  (MÊME format de voucher que `withdraw()` → réutilisable tel quel), soumise par
  le backend via `POST /withdraw/push {wallet_address}` →
  `InternalController::pushWithdraw` exécute `withdraw_push.js`.
  Le bouton **Réclamer** est 100 % gasless.
- **Env docker** : `WEB3_WITHDRAW_PUSH_SCRIPT=/srv/blockchain/scripts/withdraw_push.js`
  ajouté au service `api` (docker-compose.yml). Après ajout d'env : `docker compose up -d api`.
- **Dépôt (défi)** : `register` exige `msg.value` → toujours 1 tx utilisateur
  par match (l'envoi des ETH du joueur ne peut pas être délégué). Solution
  future = Option 3 (depositToBalance + registerFromBalance, chantier contrat).
- **Tests** : `node test/test-settle-backend.js`, `node test/test-gasless-full.js`.

## §7. Bugs résolus (à ne PAS réintroduire)

### 7.1 Reverb / broadcasting (réparé — itération infra)
- **Auth broadcasting 403** (`Broadcaster.php:129`) :
  1) `PusherBroadcaster::auth()` passe le nom **normalisé** (préfixe `private-`/
  `presence-` retiré) à `verifyUserCanAccessChannel` → les patterns de
  `routes/channels.php` doivent être déclarés **SANS préfixe** (`player.{id}`,
  `lobby`) — les variantes préfixées sont conservées en compat ;
  2) comparaison wallet **insensible à la casse** (front = checksum MetaMask,
  DB = lowercase).
- **Double préfixe** : `PrivateChannel('private-player.X')` produit le canal
  `private-private-player.X` — le framework ajoute `private-` tout seul.
  Idem côté front : `echo.private('private-player.X')` → double préfixe.
  **Convention correcte** : backend `new PrivateChannel('player.' . strtolower($id))`
  (dans ChallengeSent/MatchStarted/ChallengeDeclined) ; front
  `echo.private('player.' + wallet.toLowerCase())` (app.js l.~1009).
  ⚠️ `Channel('pool.{id}')` n'est PAS préfixé (canal public) — inchangé.
- **OPcache** : le conteneur api a `opcache.validate_timestamps=0` → TOUT edit
  de fichier backend exige `docker restart web3_combat_api` (le serveur garde
  l'ancien bytecode). `php artisan route:clear` ne suffit PAS.

### 7.2 Dépôt/escrow
- `depositForMatch` : `feeBps()` (selector `0x24a9d853`) répond normalement ;
  un « missing revert data » sur ce call = MetaMask sur le MAUVAIS réseau
  (chaîne) ou en backoff RPC — pas un bug contrat. Vérifier le réseau MetaMask.

### 7.3 Front 2D (historique)
- Sprites avec fond blanc non transparent → flood-fill au preload (plus de
  masque CSS : le contenu est dessiné dans un `<canvas>`).
- Sprites trop gros/petits selon l'écran → clamp 150-400px.
- Combattants trop écartés sur grand écran → clamp ±300px.
- Barre de choix recouvrant les noms en mobile → sol relevé à 0.80 + barre
  fixée bottom 10px (§18 style.css).

## §8. Tests automatisés (dossier `test/`)

| Script | Rôle | État |
|---|---|---|
| `infra-check.js` | Diagnostic infra (RPC, contrat, solde, backend) — lecture seule | ✅ |
| `puppeteer-lite-test.js` | Mode Lite : ordre de chargement 2D/Godot, barre, feedback, console | 9/9 |
| `puppeteer-e2e-match.js` | Match complet 2 joueurs (défi→acceptation→dépôt→combat→résultat) | 10/10 |
| `check-*.php` / `debug-*.js` | Scripts de diagnostic ponctuels (broadcast, Echo, OPcache…) | ad hoc |

**Pièges test e2e** : (1) le bouton « Réclamer » du badge a la classe
`.btn-challenge` → cibler `#btn-chal-<checksum>` ; (2) attendre `bet-modal`
visible avant `confirmBetAndChallenge` ; (3) preuve du dépôt par RPC Node direct
(les fetch in-page polluent l'auth MetaMask) ; (4) `AppState` est un `const`
module-level, utiliser `localStorage['web3combat_wallet']` pour la détection ;
(5) connecter B AVANT A pour que le lobby de A affiche B ; (6) preuve on-chain :
selector `register` = `0xf207564e`.

## §9. Environnement MetaMask (config utilisateur)

- **Réseau de CE projet : `Hardhat CombatGame (8845)`** — URL `http://localhost:8545`,
  chainId `8845`. (L'ancien 31337 appartient à un autre projet.)
- Comptes Hardhat déterministes : #1 `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`,
  #2 `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` — 10000 ETH à chaque redeploy.
- Le front ne force PAS le switch de réseau (`wallet_switchEthereumChain` absent
  du code) : sélection manuelle du réseau avant connexion.

## §10. Règles de vie du projet

- **Jamais de commit** : les modifications restent sur disque.
- Front = vanilla (aucun framework/bundler). Fichiers front modifiables :
  `index.html`, `style.css`, `app.js` (avec prudence), `anim2d.js`,
  `audio.js`, `config.js` (lecture seule).
- Backend modifié avec parcimonie et seulement sur ordre explicite de
  l'utilisateur (itérations infra validées). Après edit backend :
  `docker restart web3_combat_api` (OPcache).
- Cache-busters : **re-vérifier sur disque avant tout bump**, incrémenter
  uniquement les fichiers réellement modifiés.
- Test : `http://localhost:8080` UNIQUEMENT, Ctrl+F5, console F12 propre.

## §11. Historique des itérations (résumé)

| # | Objet | Fichiers | Versions |
|---|---|---|---|
| 1 | Écran connect (perks, bouclier pulse, hint) | index.html, style.css | style 3.5→3.6 |
| 2 | Barre de coups 2D (instruction, boutons clip-path colorés, icônes Lucide) | index.html, style.css | style 3.6→3.7, anim2d 3→4 |
| 3 | HUD combat (#combat-hud-layer, barres vie biseautées) | index.html, style.css, anim2d.js | style 3.8, anim2d 5 |
| 4 | Responsive mobile 390px (barre bottom 10px, sprites 0.52, HUD top 50px) | style.css, anim2d.js | style 3.9, anim2d 6 |
| 4A/4B | Clamp écartement ±300px + feedback coup (badge HUD + canvas) | anim2d.js, style.css, index.html | style 4.0, anim2d 7 |
| 5 | Portage idées prototype : charHeight clamp 150-400px, badge canvas popIn, mobile bords 5% | anim2d.js | anim2d 8 |
| 6 | **Mode Lite** : assets 2D prioritaires, Godot différé + protection téléphone | index.html (boot Godot), anim2d.js | anim2d 9 |
| Infra | Réparation Reverb (canaux normalisés, casse, double préfixe), OPcache restarts | backend routes/Events, app.js | app 4.5 |
| 7 | Switch Option 1/2 (dépôt vs lancement combat) | app.js | app 4.5 |
| 8 | ChainId dédié 8845 | blockchain/hardhat.config.js | — |

---

*Ce fichier est la mémoire vivante du projet. Toute nouvelle décision structurelle
doit y être reportée.*