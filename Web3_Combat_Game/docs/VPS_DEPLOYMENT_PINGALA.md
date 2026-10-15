# Déploiement VPS — Web3 Combat Game (App 2) sur Pingala Chain

> Rédigé le **2026-10-12** après un déploiement réel, de bout en bout.
> Périmètre : migration Hardhat local → **L1 Pingala Chain (chainId 99999)**,
> puis mise en production sur un **VPS mutualisé avec App 1 (BattlePool)**.
> Tout ce qui suit a été **exécuté et vérifié** (pas de procédure théorique).

---

## 1. Résumé

| Élément | Valeur |
|---|---|
| Jeu (public) | **https://app2.31.187.72.98.sslip.io/** |
| Contrat `CombatGame` | `0x42b4928C128094a99631462a2895Ab3Ff380Fb94` (bloc 108) |
| tx de déploiement | `0x261933cdde45871aba08cc4d8e0a9444d42ba1b6afe27aaf7e558a40e53e0800` |
| owner / déployeur | `0x3Fc5DdB932d0263b0d30BFE94ED98803c84C7ec1` |
| backendSigner | `0xa07c07E4C7EE00243D1591313911DB2Ef753a146` |
| Répertoire VPS | `/opt/web3-combat` |
| Conteneurs | `web3_combat_{frontend,api,db,indexer}` |
| VPS | `root@31.187.72.98` (App 1 = `battlepool-*`, **à ne pas toucher**) |

---

## 2. Architecture cible

```
Internet ──HTTPS(443)──> Caddy (systemd, sur le VPS, SNI)
                            ├── 31.187.72.98.sslip.io        -> 127.0.0.1:9650 (L1 avalanchego)   [existant]
                            ├── battlepool.<ip>.sslip.io     -> /app/*:8008, /*:8001              [existant]
                            └── app2.<ip>.sslip.io           -> /app/*:8009, /api/*:8000, /*:8002 [NOUVEAU]

Docker (réseau web3-combat_default) :
  frontend (Godot+UI statique)  127.0.0.1:8002 -> 8080
  api      (Laravel + Reverb)   127.0.0.1:8000 -> 8000  |  127.0.0.1:8009 -> 8081 (WSS)
  db       (MySQL 8)            127.0.0.1:3308 -> 3306
  indexer  (polling Pingala)    aucun port
```

Le RPC Pingala reste **public** (`https://31.187.72.98.sslip.io/ext/bc/<CB58>/rpc`) et
est appelé **directement** par le navigateur (pas de proxy local).

---

## 3. Paramètres réseau Pingala (fait foi)

| Clé | Valeur |
|---|---|
| Nom | `Pingala Chain` |
| Chain ID | `99999` (`0x1869f`) |
| Symbole natif | `TST` (18 déc.) |
| RPC public | `https://31.187.72.98.sslip.io/ext/bc/2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea/rpc` |
| Explorer | ❌ aucun |
| Type | Avalanche L1 / subnet-evm |

> ⚠️ Plus jamais `8845` / `8545` / `31337` en production.

---

## 4. Démarche

### Phase A — Migration du code (Hardhat local → Pingala)

1. **`blockchain/hardhat.config.js`** : ajout du réseau `pingala` (chainId 99999,
   `PINGALA_DEPLOYER_PK` depuis l'env). Le réseau `hardhat` (chainId 8845) est
   **conservé uniquement pour les tests unitaires**.
2. **`blockchain/scripts/deploy.js`** : réécrit — plus de mnemonic en dur, plus de
   `127.0.0.1:8545`. Lit `PINGALA_DEPLOYER_PK` + `PINGALA_BACKEND_SIGNER_ADDRESS`,
   vérifie le solde TST, déploie **séquentiellement** (`await tx.wait()`) et écrit
   `deployments.pingala.json` (adresse + txHash + bloc, **jamais de clé**).
3. **`backend/.env` / `.env.example` / `config/services.php`** : RPC Pingala,
   `CONTRACT_ADDRESS` (placeholder puis adresse réelle), clé `backendSigner` fraîche.
   Les 3 fallbacks contrôleurs `http://127.0.0.1:8545` → RPC Pingala.
4. **`indexer/config.js` + `.env.example`** : RPC Pingala par défaut, `CONTRACT_ADDRESS`,
   `DEPLOYMENT_BLOCK` réel, `CONFIRMATIONS_REQUIRED`.
5. **`frontend/config.js`** : RPC Pingala, `CHAIN_ID 99999`, symbole **TST**, bloc
   EIP-3085 `PINGALA_NETWORK` + helper `ensurePingalaNetwork()`.
6. **`docker-compose.yml`** : service `blockchain` (Hardhat) **supprimé**, ports
   bindés `127.0.0.1`.
7. **Dépendance `dotenv`** ajoutée à `blockchain/package.json` (le config Hardhat
   fait `import "dotenv/config"`), puis `npm install`.

### Phase B — Génération des wallets & funding

- Génération de **2 wallets neufs** (déployeur/owner + backendSigner), clés écrites
  **uniquement** dans `blockchain/.env` et `backend/.env` (gitignorés). Aucune clé
  imprimée à l'écran.
- Demande de financement TST natif à App 1 (pas de faucet) : **3 TST** déployeur,
  **10 TST** backendSigner.

### Phase C — Déploiement du contrat

```
npx hardhat run scripts/deploy.js --network pingala
```
Vérifs : `eth_getCode` non vide, `owner()` / `backendSigner()` conformes, `feeBps = 250`.

### Phase D — Préparation du VPS

1. **Reconnaissance en lecture seule** : `docker ps`, `ss -ltnp`, `cat /etc/caddy/Caddyfile`,
   `df -h`, `ls /opt`. Objectif : repérer les ports occupés par App 1 et la structure Caddy.
2. **Accès SSH** : clé dédiée sans passphrase (voir piège 2).
3. **Ports retenus** : `8002` (front), `8000` (API), `8009` (Reverb), `3308` (DB).
   Bannière : **ne pas réutiliser** `8001, 8008, 8546, 3307` (App 1).

### Phase E — Transfert

- Archive `tar.gz` du projet **hors** `node_modules`, `.git`, `frontend/certs`,
  `blockchain/.env` (clé déployeur, non nécessaire en prod), `*.tgz`, tests.
- `scp` de l'archive → extraction dans `/opt/web3-combat`.
- `scp` de `backend/.env` (secret) **séparément**, puis `sed` pour normaliser les CRLF.
- Installation d'un `node_modules` **minimal** dans `blockchain/` (ethers + dotenv)
  car les scripts `settle/consolidate` sont exécutés par le conteneur API (Node) et
  résolvent `import "ethers"` depuis `/srv/blockchain/node_modules`.

### Phase F — Reverse proxy Caddy

- Ajout d'un **bloc site sibling** en fin de `/etc/caddy/Caddyfile` (jamais de
  modification des blocs L1 / battlepool) :
  `/app/*` → `8009`, `/api/*` → `8000`, `/*` → `8002`.
- `cp -a` de backup horodaté, `caddy validate`, puis `systemctl reload caddy`.

### Phase G — Démarrage & vérification

```
cd /opt/web3-combat
docker compose -f docker-compose.vps.yml up -d --build
```
Vérifs : `docker ps`, logs api/indexer, `https://app2.../` = 200, `/api/game-config` = 200,
`battlepool...` toujours 200, L1 `chainId 0x1869f`, bytecode contrat présent.

---

## 5. Pièges rencontrés & solutions appliquées

| # | Problème observé | Cause | Solution appliquée |
|---|---|---|---|
| 1 | `failed to connect to the docker API` (local) | Docker Desktop arrêté | Démarré Docker Desktop, boucle d'attente `docker info` |
| 2 | SSH clé refusée (`Permission denied (publickey)`) alors que « Server accepts key » | `id_ed25519` **protégée par passphrase**, `BatchMode` empêche la saisie | Généré une clé dédiée **sans passphrase** (`app2_vps_ed25519`) |
| 3 | Clé ajoutée mais toujours refusée | ligne `authorized_keys` écrite avec **CRLF** (le `\r` invalide la clé) | `sed -i 's/\r$//'` sur `authorized_keys`, puis ré-ajout |
| 4 | `bash: syntax error near unexpected token 'then'` / `$(date)` interprété | **PowerShell** mange `$(...)` dans la commande distante | Écrire la logique dans un **script shell**, `scp` puis `bash script.sh` |
| 5 | Indexeur figé (reprise bloc 107, jamais de « Synced ») | Pingala **ne produit pas de blocs vides** : avec 5 confirmations, l'indexation attend indéfiniment | `CONFIRMATIONS_REQUIRED=0` (finalité Avalanche/quick, reorg négligeable) |
| 6 | `systemctl reload caddy` échoue (`permission denied`) | Le service tourne en user `caddy` et ne peut pas **créer** `/var/log/caddy/web3combat.log` | `install -o caddy -g caddy -m 640 /dev/null /var/log/caddy/web3combat.log` puis reload |
| 7 | Conteneur `frontend` en boucle `Restarting` | `tls_proxy` fait `os.makedirs('/srv/www/certs')` sur un montage **`:ro`** → exception au boot | `serve.py` rendu résilient : démarrage en **HTTP simple** si le proxy TLS échoue, puis **rebuild** |
| 8 | Anciennes données Hardhat en base (109 combats, 27 poules) | Volume MySQL persistant d'un ancien dev | `TRUNCATE` ciblé des tables applicatives + état indexeur (schéma & volume conservés) |
| 9 | `.env` avec CRLF | Fichiers édités sous Windows | `sed -i 's/\r$//'` sur les `.env` déployés |
| 10 | Config Hardhat plantait à l'import | `dotenv` absent des dépendances | Ajout de `dotenv` à `package.json` + `npm install` |
| 11 | Édition de `serve.py` sans effet | `serve.py` est **copié dans l'image** au build, pas monté | Rebuild du service `frontend` après modification |

---

## 6. Pièges à éviter (préventif)

1. **chainId** : tout en **99999**. Un wallet resté sur 8845/31337 rejette les tx.
2. **Nonces MetaMask** : après un reset/redéploiement, *Paramètres → Avancé → Effacer
   les données d'activité*, sinon tx bloquées `Pending`.
3. **Pas d'explorer** : aucune URL d'explorer dans l'UI (Pingala n'en a pas).
4. **Gas / TST** : pas de faucet public → financer **déployeur + backendSigner + wallets
   des joueurs** (mises en natif). Vérifier le solde avant de déployer.
5. **Secrets** : jamais de clé privée committée. `.env` gitignorés ; transfert `scp` ;
   préférer des Docker secrets à terme. Rôder tout secret un jour exposé.
6. **Déploiement séquentiel** : une tx à la fois + `await tx.wait()` sur vraie chaîne.
7. **Cohabitation App 1** : ne pas réutiliser `8001/8008/8546/3307` ; ne pas toucher
   `battlepool-*`, `/opt/battlepool`, la config avalanchego / signature-aggregator, ni
   les blocs Caddy existants. Toujours `cp -a` backup + `caddy validate` avant reload.
8. **Montages `:ro`** : tout code qui écrit au démarrage (certs, logs) plantera. Rendre
   les services résilients ou prévoir des volumes inscriptibles.
9. **`docker compose down -v`** = perte DB. Ne jamais le faire sans backup.
10. **LF uniquement** dans les `.env` et scripts déployés (le CRLF casse sous Linux).
11. **Synchronisation du `CONTRACT_ADDRESS`** : il vit à **4 endroits** —
    `frontend/config.js`, `backend/.env`, env indexer du compose, `docker-compose.vps.yml`.
    Toute redéplémentation impose de mettre à jour **les quatre** + recreate api/indexer.
12. **Caddy SNI** : utiliser un **sous-domaine dédié** (`app2.<ip>.sslip.io`) plutôt
    qu'un sous-chemin du site L1, pour une isolation totale (TLS + logs propres).

---

## 7. Exploitation

```bash
cd /opt/web3-combat

# État
docker compose -f docker-compose.vps.yml ps

# Logs (API + indexeur)
docker compose -f docker-compose.vps.yml logs -f api indexer

# Mise à jour du code / rebuild
#   (après transfert des sources)
docker compose -f docker-compose.vps.yml up -d --build

# Redémarrer un seul service
docker compose -f docker-compose.vps.yml restart indexer
```

Mise à jour ciblée d'un fichier statique du front (monté `:ro`, pas de rebuild) :
```bash
# depuis le poste local
scp frontend/app.js root@31.187.72.98:/opt/web3-combat/frontend/app.js
# puis Ctrl+F5 (le front est servi sans cache)
```
> Attention : `serve.py` et `tls_proxy.py` sont **dans l'image** → ils exigent un
> rebuild (`--build frontend`). Les autres fichiers de `frontend/` sont montés.

### Rollback Caddy
```bash
ls /etc/caddy/Caddyfile.bak.*        # backups horodatés
cp -a /etc/caddy/Caddyfile.bak.<TS> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy
```

---

## 8. Checklist de livraison

- [x] Réseau `pingala` (99999) dans `hardhat.config.js`.
- [x] `CombatGame` déployé sur Pingala (adresse + tx + bloc notés).
- [x] `deployments.pingala.json` écrit (sans clé).
- [x] Bytecode vérifié à l'adresse.
- [x] Backend : RPC + `CONTRACT_ADDRESS` + signer frais fundé.
- [x] Indexer : RPC + contrat + `DEPLOYMENT_BLOCK=108` + `CONFIRMATIONS_REQUIRED=0`.
- [x] Frontend : RPC Pingala, réseau 99999 / TST, bloc EIP-3085.
- [x] Compose VPS : `127.0.0.1`, ports dédiés à App 2.
- [x] Caddy : bloc `app2` sibling, backup + validate + reload.
- [x] HTTPS public 200, API 200, App 1 intacte.
- [x] `ethers`+`dotenv` dispo pour les scripts serveur.
- [ ] Rotation du mot de passe SSH (partagé en clair durant l'opération).
- [ ] Retrait éventuel de la clé de déploiement `app2-deploy@GWX1223153-8XQM`.
- [ ] Financement TST des wallets joueurs pour les mises.

---

## 9. Fichiers créés / modifiés (repères)

| Fichier | Nature |
|---|---|
| `blockchain/hardhat.config.js` | réseau `pingala` |
| `blockchain/scripts/deploy.js` | déploiement Pingala réel |
| `blockchain/.env.example`, `blockchain/deployments.pingala.json` | config + trace |
| `backend/.env`, `.env.example`, `config/services.php`, 3 contrôleurs | RPC/contrat/signer |
| `indexer/config.js`, `.env.example` | RPC/contrat/bloc/confirmations |
| `blockchain/scripts/{settle_fight,consolidate_pool,withdraw_push}.js` | fallback RPC Pingala |
| `frontend/config.js` | mode public single-origin + EIP-3085 |
| `frontend/app.js` | switch réseau, libellés TST |
| `frontend/serve.py` | résilience TLS (HTTP simple) |
| `docker-compose.yml` | local dev (Hardhat retiré) |
| `docker-compose.vps.yml` | **nouveau** — ports VPS |
| `/etc/caddy/Caddyfile` (VPS) | bloc `app2` ajouté (sibling) |

---

## 10. Couche wallet — WalletConnect / Core Mobile (clone App 1)

**Décision (handoff App 1)** : App 2 clone la stack wallet de BattlePool.
Core Mobile n'est **pas** injecté : on l'atteint via **WalletConnect** (QR desktop,
**deeplink** `core://wc?uri=…` sur mobile).

### Composants

- **Source du bundle** : `wallet-bundle-src/` (hors `frontend/`, pour ne pas être
  servi publiquement). Adapté de `resources/js/web3/web3-core.js` (App 1).
  - deps épinglées : `@reown/appkit@1.8.19`, `@walletconnect/universal-provider@2.23.10`,
    `@walletconnect/ethereum-provider@2.23.10`, `ethers@6.13.5`, `esbuild`.
  - `npm install && node build.mjs` → **`frontend/web3.iife.js`** (committé).
  - shims `process`/`global` injectés (banner esbuild) pour les libs AppKit.
- **projectId Reown** (`e46cab0b26fb49b6375fd488d2dc5e95`) dans `frontend/config.js`
  → `window.APP_CONFIG.WALLETCONNECT_PROJECT_ID` (lue par le bundle).
- **Métadonnées dApp** : name `Web3 Combat Game`, icons `origin + '/pwa_icon_192.png'`,
  `redirect.universal = origin + '/'`.
- **Wallets custom** : Core (`https://core.app.link`) + MetaMask (`https://metamask.app.link`).
- **Namespaces WC** : `eip155:99999` en `required` + `rpcMap`.

### Flux de connexion (app.js)

1. Entrée portail (`?mode=&wallet=`) : conserve l'identité portail (App 1).
2. Provider injecté présent (extension MetaMask/Core) → `eth_requestAccounts` +
   `ensurePingalaNetwork`.
3. Sinon → **`window.App2Wallet.getProvider('walletconnect')`** (bouton = geste
   utilisateur ; mobile = deeplink Core, desktop = modal/QR).
4. `initWeb3()` choisit le provider (injecté ou session WC active) ou reste en
   **mode dégradé** (lecture seule).

### Mocks retirés (production)

- `hardhat_keys.js` : **plus chargé** dans `index.html` (fichier supprimé côté VPS).
- `?player=N` et la clé privée de démo : **supprimés** de `connectWallet` /
  `performLogin`.
- `AppState.privateKey` : plus utilisé (signature uniquement via le provider wallet).
- Reste légitime : la **clé de session** (`web3combat_session_pk`) générée côté
  client pour le mode gasless — ce n'est pas un mock.

### Fichiers ajoutés/modifiés pour cette couche

| Fichier | Nature |
|---|---|
| `wallet-bundle-src/{package.json,build.mjs,entry.js,web3-core.js}` | **nouveau** — source du bundle |
| `frontend/web3.iife.js` | **nouveau** — bundle IIFE committé (~2,8 Mo) |
| `frontend/pwa_icon_192.png` | **nouveau** — icône dApp (métadonnées WC) |
| `frontend/index.html` | retrait `hardhat_keys.js`, ajout `web3.iife.js`, retrait UI démo |
| `frontend/config.js` | `WALLETCONNECT_PROJECT_ID` |
| `frontend/app.js` | connexion injectée/WC, retrait mocks |
| `frontend/hardhat_keys.js` | non référencé (dev/e2e uniquement) |

### Exploitation

```bash
# Rebâtir le bundle après modif de web3-core.js
cd wallet-bundle-src && npm install && node build.mjs
# Redéployer (statique, pas de rebuild conteneur)
scp frontend/web3.iife.js frontend/config.js frontend/app.js frontend/index.html \
    root@31.187.72.98:/opt/web3-combat/frontend/
```
> Après modif front : **Ctrl+F5** (le front est servi sans cache). Cache-busters
> `config.js?v=9`, `app.js?v=4.32`, `debug-log.js?v=2`, `web3.iife.js?v=1`.

---

## 11. Ops — sauvegardes & monitoring (2026-10-13)

- **Sauvegarde DB** : `/opt/web3-combat/backup_db.sh` → dump `web3_combat` (gzip)
  dans `/opt/web3-combat/backups/`, rétention **7** fichiers.
  Cron : `0 3 * * *` (log `/var/log/web3combat-backup.log`).
- **Monitoring** : `/opt/web3-combat/healthcheck.sh` interroge `GET /api/health`
  toutes les **5 min** ; logue **uniquement les échecs** dans
  `/var/log/web3combat-health.log`. Cron : `*/5 * * * *`.
- **Health** : `https://app2.31.187.72.98.sslip.io/api/health` →
  `{status, db, rpc_chainId}` (200 = ok, 503 = dégradé).
- **Restauration** : `gunzip -c backups/web3_combat-<TS>.sql.gz | docker exec -i web3_combat_db mysql -uroot -proot`
- **Log client** : bouton 🐞 dans le jeu (mobile/desktop) → « Copier les logs »
  (`frontend/debug-log.js`).

### Contrat & adresses (à date)
- Contrat en ligne : **`0xA2722921B753C1E76e1d9a4294204DF983746C3D`** (bloc 171).
- Déployeur/owner `0x3Fc5DdB9…7ec1`, backendSigner `0xa07c07E4…a146` (~10 TST).
- L'« Option 3 » (dépôts gasless en duel) a été **abandonnée** (décision produit) ;
  `CombatGame.sol` **restauré à l'état déployé** (bytecode recompilé vérifié identique).
  Voir `docs/ROADMAP_ONCHAIN_GASLESS_REWARDS.md` (marquée NON ADOPTÉ).
