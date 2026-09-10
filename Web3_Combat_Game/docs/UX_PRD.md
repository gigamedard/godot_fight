# PRD UX/UI — Web3 Combat Game (frontend)
**Version :** 3.0 — Itérations 1-8 intégrées et vérifiées sur disque
**Destinataire :** agent IA UX/UI front-end (aucune connaissance préalable du projet)
**Lecture obligatoire :** ce document EN PREMIER, puis `docs/PROJECT_MEMORY.md`
(état, décisions, pièges), puis `index.html`, `style.css`, `app.js` (couche UI uniquement).

---

## §1. Vue d'ensemble du produit

Le produit est un jeu de combat web **multijoueur** au style cyber/néon, présenté comme une
application mono-page (SPA) construite en HTML/CSS/JS vanilla. Le joueur connecte un wallet,
choisit un mode de jeu (duel 1vs1, Battle Royale, Spirit Fight), rejoint ou crée des salons,
puis s'affronte dans des combats de pierre-feuille-ciseaux améliorés (choix de coups,
timer de tour, animations de combat).

Le jeu possède **deux couches de rendu** : une couche canvas/Godot (combat 3D) et une couche
d'animation 2D optionnelle (`anim2d.js`, activée via `?mode2d=1`), sous une couche UI HTML.

**Une phrase neutre sur l'écosystème :** le jeu s'intègre dans un écosystème plus large dans
lequel existe une « app hôte » ; le détail n'est pas nécessaire à l'UI et n'est pas traité ici.

## §2. Périmètre et règle du « besoin de savoir »

Ce PRD décrit **uniquement** la couche UI front-end : structure des écrans, composants,
identité visuelle, comportements DOM observables. Le destinataire (agent UX/UI) n'a besoin
d'aucune connaissance serveur, réseau ou crypto pour travailler. Tout ce qui ne relève pas
de l'UI est explicitement **hors périmètre** (voir §9).

## §3. Architecture en couches (z-index complets, vérifiés sur disque)

L'empilement vertical est critique : toute modification CSS doit respecter cette chaîne.

| Couche | z-index | Définition (style.css) |
|---|---|---|
| `#godot-layer` | 0 | canvas de combat Godot, couche de fond |
| `.anim2d-layer` | 1 | couche d'animation 2D (mode `?mode2d=1`) |
| `#ui-bg` / `#ui-bg-next` | 5 | fonds d'écran dynamiques (crossfade `BGRotation` piloté par app.js) |
| `#ui-overlay` | 10 | conteneur de tous les écrans et cartes |
| `#combat-hud-layer` | 15 | **HUD COMBAT (§22)** — dans `#screen-combat` ; position absolute top 15px (50px en mobile, sous le timer) ; `pointer-events: none` |
| `.turn-timer-badge` | 20 | timer de tour superposé au combat |
| `.anim2d-move-bar` | 21 | barre de choix de coup (mode 2D), sous les modales |
| `#portal-overlay` | 30 | overlay portail (iframe plein écran + barre de retour) |
| Modales | 100 | toutes les `.overlay-modal` |
| Toasts | 200 | `#toast-container`, élément le plus haut |

**Organisation du fichier style.css (~1584 lignes) :** sections numérotées,
dont **deux sections n°18** — « TOASTS » et « BARRE DE CHOIX DU COUP — MODE 2D »
(avec §18bis « FEEDBACK DU COUP CHOISI » à sa suite) — puis §19-21 et **§22
HUD COMBAT** en fin de fichier. Ne pas renuméroter ; le doublon « 18 » est assumé.

## §4. Les 10 écrans (tous dans index.html, classes `.screen`)

Un seul écran est actif à la fois (`.screen.active`), la navigation est pilotée par `app.js`.

| # | ID | Ligne | Rôle |
|---|---|---|---|
| 0 | `#screen-splash` | l.86 | Splash d'accueil / chargement initial |
| 1 | `#screen-language` | l.100 | Choix de langue — 4 .lang-card : FR/EN/ES/PT |
| 2 | `#screen-connect` | l.114 | Connexion Web3 (bouton « CONNECTER LE WALLET » l.124, `#wallet-status-box` + `#wallet-addr-display` l.127-129) |
| 3 | `#screen-mode` | l.135 | Choix du mode de jeu (Duel, Battle Royale, Spirit Fight) |
| 4 | `#screen-character` | l.168 | Sélection du guerrier (grille peuplée par JS, voir §5) |
| 5 | `#screen-main` | l.191 | Lobby 1vs1 Duel (`#players-list` l.205, `#search-input` l.200) |
| 6 | `#screen-br` | l.210 | Salons Battle Royale (`#br-list` l.226, `#invite-code-input` l.222) |
| 7 | `#screen-spirit` | l.231 | Spirit Fight (hub univers, entrée vers le portail externe) |
| 8 | `#screen-pool-room` | l.248 | Salon de poule (`#pool-room-title` l.254, `#pool-room-count` l.258, `#pool-players-list` l.275, bloc partage `#pool-invite-*` l.260-273) |
| 9 | `#screen-combat` | l.280 | Écran de combat (`#loading-bar` + `#loading-text` l.284-286) |

## §5. Inventaire des composants UI réels (à connaître, à préserver)

### 5.1 Structure statique (index.html)
- `#player-badge` — badge joueur en header. **Attention :** ses sous-éléments
  `#wallet-balance` et `#pending-funds-container` sont **injectés dynamiquement par app.js
  (via innerHTML de `#player-badge`)** — ils n'existent PAS en statique dans index.html.
- `#volume-slider` + `#volume-value` — contrôle du volume audio.
- `#godot-progress` — barre de chargement Godot (`#godot-status`).
- `#turn-timer-overlay` avec `#timer-seconds` — timer de tour.
- `#anim2d-move-bar` (l.32) — barre de choix de coup 2D :
  instruction `.move-bar-instruction` + boutons `#btn-move-1/2/3`
  (classes `.anim2d-move-btn move-rock|move-paper|move-scissors`) appelant
  `window.submitMove2D(1|2|3)` via onclick. Icônes Lucide **dans les boutons** :
  `hand-metal` (Pierre), `hand` (Feuille), `scissors` (Ciseaux).
  ⚠️ `fist` n'existe PAS dans le bundle Lucide local.
- `#combat-hud-layer` (l.291) — **HUD combat (§22)** : `#hud-p1-name`,
  `#hud-p1-wallet`, `#hud-p1-health` / `#hud-p2-name`, `#hud-p2-wallet`,
  `#hud-p2-health` + `#player-selected-move` (badge du coup retenu, l.302).
  Noms synchronisés par anim2d.js ; barres de vie pilotables par app.js (width %).
- `#portal-overlay` : `#portal-back-btn` + `#portal-iframe` + `#portal-loading`.
- `#ui-bg` + `#ui-bg-next` — double fond pour crossfade.
- `#toast-container` — cible des notifications.
- `#wallet-status-box` + `#wallet-addr-display`.

### 5.2 Modales (`.overlay-modal`)
- `#qr-modal` (l.308) — affichage QR code.
- `#bet-modal` (l.319) — pari : `#bet-amount` (l.327, input number) + presets 10/50/100/MAX.
- `#create-pool-modal` (l.358) — création de salon de poule.
- `#invite-modal` (l.389) — défi entre joueurs ; contient `#challenge-modal-actions`
  (l.349) avec **3 boutons** : accepter / contre-proposer / refuser (l.350-352).

### 5.3 Éléments peuplés dynamiquement par app.js
- `#character-grid` — grille de sélection de personnages (remplie par `renderCharacterSelect`,
  app.js ~l.770-771). **ID exact : `character-grid`** (pas « char-grid »).
- `#players-list` (l.205), `#br-list` (l.226), `#pool-players-list` (l.275) — listes de joueurs/salons.
- `#pool-room-count` (l.258) — compteur de places du salon.
- `#pool-invite-container`, `#pool-invite-link`, `#pool-invite-code`, `#pool-invite-qr` (l.260-272).
- `#loading-bar` + `#loading-text` (l.284-286) — progression de chargement de combat.
- Classe **`.rematch-banner`** — bannière de revanche, **créée dynamiquement en JS**
  (`banner.className = 'rematch-banner'`, app.js ~l.1795). Ce n'est ni un ID ni un élément statique.
- Toasts : éléments ajoutés dans `#toast-container` par les fonctions de notification de app.js.

## §6. Identité visuelle (confirmée)

- **Fond** `#0F0C1B` — **cartes** `#1F1B2E`
- Accents : **cyan** `#00E5FF`, **violet** `#7B2CBF`, **or** `#FFC700`, **rouge** `#FF1744`
- **Fonts :** Orbitron (titres) + Rajdhani (texte)
- **Formes :** cartes à coins biseautés via `clip-path`
- **Icônes :** bibliothèque Lucide (`<i data-lucide="nom">`, initialisation par appel lucide)

Toute nouvelle UI doit réutiliser ces tokens (définis en tête de style.css) plutôt que
d'introduire de nouvelles couleurs ou polices.

## §7. Comportements dynamiques à préserver

1. **Navigation par écrans :** app.js bascule les `.screen` via `.active`. Ne jamais
   introduire un second système de routage.
2. **Connexion wallet — flux réel :**
   - En **flux autonome**, la connexion est déclenchée **au CLIC** du bouton
     « CONNECTER LE WALLET » (`onclick="connectWallet()"`).
   - En **entrée portail/e2e** (`?mode=DUEL|BATTLE&wallet=...` ou `?player=N`),
     `connectWallet()` est **auto-appelée** au `DOMContentLoaded`.
     Les comptes `?player=N` sont des comptes Hardhat déterministes.
   - Ne PAS modifier cette logique : une auto-connexion systématique casserait le flux autonome.
3. **Crossfade des fonds :** `#ui-bg`/`#ui-bg-next` alternent via `BGRotation` (app.js) ;
   en combat la couche UI se masque (`.hidden`) et les fonds s'éteignent.
4. **Couche 2D :** `anim2d.js` gère `#anim2d-move-bar` (affichage/masquage) et les
   callbacks `window.submitMove2D` ; `anim2d-move-bar` doit rester sous les modales (z 21 < 100).
5. **Timer :** `#timer-seconds` est mis à jour par app.js ; le badge doit rester au-dessus
   du canvas (z 20) mais sous les modales.
6. **Mode Lite (chargement) :** le boot Godot (`engine.startGame`) est **différé**
   dans index.html jusqu'à l'évent `anim2d:ready` (garde 15s), puis démarré en
   parallèle ; sur appareil faible (RAM ≤2GB / ≤2 cores) Godot n'est pas démarré
   automatiquement. Ne pas réintroduire un `startGame` immédiat au `window.load`.
7. **Feedback du coup choisi :** triple affichage — badge néon dessiné dans le
   canvas (anim2d.js), badge HUD `#player-selected-move`, classe `.selected` sur
   le bouton — synchronisés par `window.setSelectedMove2D(n)` / `clearSelectedMove2D()`.
   Reset du badge au début de chaque tour (via `triggerRound2D`).
8. **Switch dépôt/combat** (app.js l.2-11) : `LAUNCH_GAME_BEFORE_DEPOSIT_CONFIRM`
   — Option 1 (true) : combat immédiat, dépôt en arrière-plan, annulation si échec ;
   Option 2 (false) : combat après confirmation on-chain. Ne pas supprimer le switch.
9. **Contrats DOM/JS existants :** tout `id`, `class`, `onclick` inline, `window.*`
   documenté ci-dessus est un contrat. L'agent UX/UI peut restyler, déplacer visuellement,
   animer — mais **jamais renommer, supprimer ou débrancher** ces hooks sans validation.

## §8. Contraintes techniques et workflow

- **Fichiers front :** `index.html`, `style.css` (~1584 lignes), `app.js`
  (**~2387 lignes** — fichier volumineux : cibler les zones par grep, ne pas le
  réécrire), `anim2d.js` (~537 lignes), `audio.js`.
- **Cache-busters actuels (à re-vérifier sur disque avant tout bump — ces docs peuvent dater) :**
  `app.js?v=4.5`, `style.css?v=4.0`, `anim2d.js?v=9`, `config.js?v=6`, `godot/jeu.js?v=3`.
  **Ordre impératif : ouvrir index.html, lire les `?v=` réels, PUIS incrémenter**
  le ou les fichiers réellement modifiés.
- **Validation JS :** `node --check <fichier modifié>` avant tout test navigateur.
- **Tests automatisés** (dossier `test/`, Puppeteer installé) :
  `node test/infra-check.js` (diagnostic infra), `node test/puppeteer-lite-test.js`
  (mode Lite, 9 checks), `node test/puppeteer-e2e-match.js` (match 2 joueurs, 10 checks).
- **Test :** `http://localhost:8080` UNIQUEMENT (jamais `127.0.0.1`), rechargement dur
  Ctrl+F5, console F12 exempte d'erreurs, couche 2D via `?mode2d=1`.
- **Infra docker** (voir `docs/PROJECT_MEMORY.md` §1-§2) : chainId Hardhat du projet
  = **8845** ; après tout edit backend → `docker restart web3_combat_api` (OPcache
  sans revalidation).

## §9. Hors périmètre (interdits pour l'agent UX/UI)

- Toute infrastructure, backend, base de données, blockchain, scripts serveur, dépendances.
- Toute clé, secret, adresse de contrat, port autre que celui de test.
- Modifier `config.js` (elle peut être consultée si indispensable, **jamais modifiée**).
- Toute refonte d'architecture (framework, bundler, build step) : c'est du vanilla, ça le reste.
- Tout commit git : **jamais**. Les modifications restent sur le disque.