# AGENT ONBOARDING — App 2 « POLY COMBAT » (Web3 Combat Game)

> **À lire avant toute modification.** Ce fichier décrit l'état RÉEL du projet
> (2026-10-16). Il remplace `PROMPT_AGENT_APP2.md` et `APP1_BRIDGE_FIXES.md`,
> désormais **obsolètes** (ils décrivent l'ancien modèle iframe + pont
> postMessage et l'ancien contrat — ne pas les suivre).

---

## 0. Où est le code

- **Repo (remote)** : `github.com/gigamedard/godot_fight`
- Le code App 2 est dans le sous-dossier **`Web3_Combat_Game/`** (pas à la racine).
- **Branche de travail actuelle** : `feat/app2-pool-share-payout`
  (contient tout l'état à jour : économie de poule, deep-link, `claimPoolShare`,
  correctifs chaîne). `main` peut être en retard → **toujours vérifier la branche
  fournie par l'opérateur** avant de lire/modifier.
- Branches récentes (empilées) :
  - `feat/app2-loot-tournament` : économie de butin + fins de tournoi + dépôts.
  - `feat/app2-deeplink-portal` : deep-link App1↔App2 (retrait de l'iframe).
  - `feat/app2-pool-share-payout` : `claimPoolShare` (répartition par joueur).
- **App 1 (BattlePool)** est un **autre repo** : `github.com/gigamedard/rock-paper-scissors`
  (branche `feat/app1-deeplink-app2`, dernier commit `4caab5f`). Ne pas le confondre.

### Fichiers NON versionnés (invisibles pour un agent qui lit le repo)
- `backend/.env` (secrets réels) — seul `backend/.env.example` est versionné.
- `.secrets/` (chiffrés, locaux/VPS).
- Notes de session locales (`*_RESUME.md`, `raisonnements_agent.md`, `conversation_restructuree.md`).
- Le VPS `/opt/web3-combat` **n'est PAS un dépôt git** (déploiement par copie de
  fichiers/rebuild, pas par `git pull`).

---

## 1. Architecture déployée (VPS `31.187.72.98`)

```
Caddy (SNI app2.31.187.72.98.sslip.io, 443)
 ├─ /app/*  → 127.0.0.1:8009 → web3_combat_api:8081   (Laravel Reverb, WebSocket)
 ├─ /api/*  → 127.0.0.1:8000 → web3_combat_api:8000   (Laravel HTTP)
 └─ /*      → 127.0.0.1:8002 → web3_combat_frontend:8080 (statique serve.py)
```

Conteneurs : `web3_combat_frontend`, `web3_combat_api`, `web3_combat_indexer`,
`web3_combat_db` (MySQL). **DB bind : `127.0.0.1:3308`.**

⚠️ **Ne jamais toucher** : conteneurs `battlepool-*`, `/opt/battlepool`,
`avalanchego` / `signature-aggregator` (la L1), ni les blocs Caddy L1/battlepool.

---

## 2. Chaîne & contrat

- **Pingala Chain** : chainId **99999** (`0x1869f`), symbole **TST** (18 décimales),
  RPC `https://31.187.72.98.sslip.io/ext/bc/2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea/rpc`,
  **pas d'explorer**. L1 auto-hébergée sur le VPS (SPOF).
- **Contrat actuel** : `CombatGame` = **`0x73F5065cBD382EF0D4b75c9e19f556E1D4Ba40f9`**
  (déployé bloc **352**, `feeBps()=250`, `owner()=0x3Fc5DdB932d0263b0d30BFE94ED98803c84C7ec1`,
  `backendSigner()=0xa07c07E4C7EE00243D1591313911DB2Ef753a146`).
- **Ancien contrat** `0xA2722921…` = **legacy** (ne plus l'utiliser ; quelques
  pots de test y sont coincés).
- Config à garder **cohérente partout** : `frontend/config.js`,
  `backend/.env` (`CONTRACT_ADDRESS`), `docker-compose.vps.yml` (api + indexer),
  `indexer` env `DEPLOYMENT_BLOCK` = 352.
- Fichier de référence : `blockchain/deployments.pingala.json`.

---

## 3. Modèle wallet / chaîne (IMPORTANT)

- **Lectures on-chain** (`userBalances`, `feeBps`, `poolTotal`, solde natif) →
  via un **`ethers.JsonRpcProvider` épinglé sur Pingala, LECTURE SEULE**.
  Ne **jamais** lire via le provider du wallet : sur Core mobile (WalletConnect)
  la chaîne par défaut est **Avalanche 43114** → `eth_call` renvoie `"0x"` (`BAD_DATA`).
- **Écritures** (`register`, `registerForPool`, `claimPoolShare`) → via le wallet
  (injecté MetaMask/Core, ou WalletConnect). Avant chaque écriture :
  `prepareWalletForTx()` (switch réseau) puis **`refreshWalletContract()`**
  (ethers v6 invalide le provider après un `chainChanged` → il faut le recréer).
- **Clé de session** : signature unique (`/api/auth/session-key`), **TTL 12 h**.
  Timeout de sécurité 180 s (sinon loader infini si le wallet mobile ne répond pas).
- Sur **iOS PWA**, WalletConnect-deeplink vers Core est fragile → privilégier
  MetaMask dans son navigateur intégré pour la prod.

---

## 4. Intégration App 1 ↔ App 2 (deep-link, PAS d'iframe)

- **App1 → App2** : bouton « Combat » (`openApp2()`) →
  `window.open('https://app2.31.187.72.98.sslip.io/', '_blank', 'noopener')`,
  **aucun paramètre** (chaque app garde son auth ; wallet commun).
- **App2 → App1** : `window.launchBattlePool()` (écran SPIRIT) →
  `APP_CONFIG.PORTAL_URL = 'https://battlepool.31.187.72.98.sslip.io/'` (nouvel onglet).
- L'**iframe** et le **pont postMessage EIP-1193** ont été **supprimés**.
  Il reste du **code mort** dans le bundle App1 (`__bpGetEip1193`, `__bpWakeWallet`)
  sans consommateur — ne pas s'en servir.

---

## 5. Économie de poule (voir `docs/SPEC_POOL_ECONOMY.md`)

- `pool_players.loot` (butin, **en wei**) initialisé à `entry_fee` ; `losses` (défaites).
- `pools.entry_fee` stocké **en TST** (`decimal(30,8)`), `base_bet_amount` idem.
- Règle : **1re défaite = tout le butin au gagnant (éliminé)** ; défaites
  suivantes = le gagnant prend `butin − mise de base`, le perdant garde son
  plancher ; s'il est déjà au plancher → éliminé.
- **Nul** (`draw`) **et double-forfait** (`double_elimination`) : **aucun
  transfert, personne n'est éliminé** (le front affiche « nul » dans les deux cas).
- **Conditions de fin** : `last_man` (défaut), `remaining` (`end_count`),
  `time` (`end_seconds`).
- **Démarrage** : uniquement quand la poule est **pleine ET que TOUS les dépôts
  sont confirmés** (`pool_players.deposited`). Poules gratuites (mise 0) :
  démarrage dès qu'elles sont pleines.
- **Spectateurs / éliminés** : restent dans le salon, voient la liste des
  survivants + butin (rafraîchissement ~5 s).
- **Règlement** : **`claimPoolShare(poolId, amount, nonce, sig)`** — chaque
  survivant réclame SA part (voucher backend, préfixe `"POOL_SHARE"`).
  L'ancien `claimPool` (winner-take-all) n'existe plus. `withdrawPoolRemainder`
  (owner) récupère un reliquat non réclamé.

---

## 6. Déploiement (comment livrer une modif)

Le VPS n'est pas un repo git. Selon la partie :

| Partie | Emplacement | Procédure |
|---|---|---|
| `frontend/` (hors `serve.py`/`tls_proxy.py`) | bind `./frontend:/srv/www:ro` | scp des fichiers hôte → **cache-buster** |
| `frontend/serve.py`, `tls_proxy.py` | **dans l'image** | rebuild `frontend` |
| `backend/` | bind `./backend:/var/www/html` | scp + `docker restart web3_combat_api` (OPcache) |
| `indexer/` | **dans l'image** (build context `./indexer`) | scp + `docker compose build indexer` + `up -d indexer` |
| `blockchain/artifacts` | bind `./blockchain:/srv/blockchain:ro` | scp l'artifact (ABI) |
| `docker-compose.vps.yml` / `.env` | hôte `/opt/web3-combat` | éditer + `docker compose up -d` (recréer) |

- Cache-busters à incrémenter dans `frontend/index.html` + `sw.js` (`CACHE`) à
  chaque changement front : `app.js?v=…`, `config.js?v=…`, `i18n.js?v=…`, `sw.js?v=…`.
- **App 1** se déploie autrement : `deploy/run_deploy.ps1 -GitSha <sha>`
  (pipeline complet, secrets via `secrets-manager.mjs provision/deprovision`).

---

## 7. Pièges connus

- **`*.sslip.io`** : MetaMask affiche « Malicious site » (DNS wildcard + IP dans
  le hostname, blocklisté). Pour la prod → **vrai domaine** + TLS Let's Encrypt.
- **iOS PWA + WalletConnect** : reconnexion/deeplink peu fiables.
- **`userBalances`/`feeBps` = `"0x"`** : signe d'une lecture sur la mauvaise
  chaîne → utiliser le provider de lecture Pingala.
- **`network changed: 43114 => 99999`** : ethers v6 invalide le provider après
  un switch → recréer provider/signer/contrat.
- Ne jamais committer de secret (`.env`, `.secrets/`, clés privées).
- Ne pas lancer `GET /api/test-pool` (il **truncate** la table `pools`) — route de
  test à retirer en prod.
- Godot : export **Release** (pas debug) ; `jeu.wasm`/`jeu.pck` volumineux,
  chargés en arrière-plan.

---

## 8. Ordre de lecture recommandé (repo-relative)

**Contexte / règles**
1. `Web3_Combat_Game/HANDOVER.md`
2. `Web3_Combat_Game/PINGALA_MIGRATION_HANDOFF.md`
3. `Web3_Combat_Game/docs/SPEC_POOL_ECONOMY.md`
4. `Web3_Combat_Game/TEST_RUNBOOK.md` (et `Web3_Combat_Game/WALKTHROUGH.md`)

**Sources de vérité**
5. `Web3_Combat_Game/backend/routes/api.php`
6. `Web3_Combat_Game/frontend/config.js`
7. `Web3_Combat_Game/blockchain/contracts/CombatGame.sol`
8. `Web3_Combat_Game/indexer/config.js` + `Web3_Combat_Game/indexer/handlers.js`
9. `Web3_Combat_Game/backend/app/Services/FightService.php`

**Cœur applicatif**
10. `Web3_Combat_Game/backend/app/Http/Controllers/Api/{PoolController,BattleController,WithdrawController,InternalController,MatchmakingController,AuthController}.php`
11. `Web3_Combat_Game/backend/database/migrations/*`
12. `Web3_Combat_Game/frontend/app.js` (gros : cibler nav/pool/claim/wallet)
13. `Web3_Combat_Game/docker-compose.vps.yml` + `Web3_Combat_Game/backend/config/services.php`

**App 1 (seulement si le portail est touché)**
14. `public/index.html` (`openApp2`), `deploy/run_deploy.ps1`,
    `PINGALA_DEPLOY_RUNBOOK.md`, `VPS_DEPLOYMENT_CHECKLIST.md`
    (repo `rock-paper-scissors`).

**Historique (ne pas suivre)**
- `Web3_Combat_Game/PROMPT_AGENT_APP2.md` (obsolète : iframe + ancien contrat)
- `Web3_Combat_Game/APP1_BRIDGE_FIXES.md` (pont supprimé)
- `PRE_PRODUCTION_AUDIT.md` à la racine (partiellement périmé).

---

## 9. Règles de travail

- Une **branche par sujet**, commits descriptifs style `feat(app2): …` /
  `fix(app2): …` (français).
- Ne pas modifier App 1 sans consigne explicite (autre repo).
- Toujours vérifier la **cohérence de l'adresse contrat** et du **RPC** partout.
- Après un changement front : **incrémenter les cache-busters** + `sw.js` CACHE.
- Ne jamais exposer/logguer de clé privée ou de secret.
