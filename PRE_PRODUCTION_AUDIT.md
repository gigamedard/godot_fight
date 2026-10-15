# AUDIT COMPLET DE MISE EN PRODUCTION (PRE-PRODUCTION AUDIT)
**Projet : Web3 Combat Game (Godot 3D + Laravel 11 Reverb + Solidity)**  
**Supervisé par : Orchestrateur & Sous-Agents Spécialisés**  
**Date : Septembre 2026**

---

## Synthèse Exécutive

Le projet dispose d'une architecture hybride innovante et performante (moteur 3D Godot Single-Instance, arbitrage serveur gasless, WebSockets Reverb et règlement blockchain différé). Les bugs critiques de synchronisation de poule et de compte à rebours ont été résolus avec succès.

Toutefois, pour un passage en **production publique sécurisé**, une série de verrous techniques indispensables doivent être levés. Cet audit détaille les constats et actions requises, ventilés par pôle d'expertise.

---

## 1. Pôle Blockchain & Smart Contracts
*Analysé par `blockchain_contract_agent`, `blockchain_settler_agent` et `blockchain_deploy_agent`*

### Constats & Risques
1. **Réseau de déploiement** :
   * Actuellement configuré uniquement pour un nœud Hardhat local (`chainId: 8845`).
   * *Risque* : Absence de configuration pour le réseau cible (Base, Arbitrum One, Polygon ou Ethereum L2).
2. **Gestion de la clé privée du Backend Signer** :
   * La clé Hardhat dev `#1` (`0x59c6995...`) est visible dans plusieurs fichiers de config (`docker-compose.yml`, `.env.example`).
   * *Risque CRITIQUE* : En production, cette clé signe les retraits et paie les transactions de règlement (`settle_fight.js`). Une fuite permettrait de siphonner les pots de combat.
3. **Approvisionnement en Gaz du Signer** :
   * Les scripts `settle_fight.js` et `consolidate_pool.js` consomment du gaz natif payé par le wallet signer.
   * *Risque* : Si le wallet du signer tombe à 0 ETH, les matchs ne peuvent plus être réglés on-chain.

### Matrice d'Actions Pré-Production
* **[+] Ajouter** :
  * Configuration du réseau L2 dans `hardhat.config.js` avec clé API pour vérification Etherscan/Basescan.
  * Script ou cron de monitoring du solde ETH du backend signer avec alerte critique sous un seuil (ex: 0.05 ETH).
* **[~] Modifier** :
  * Isoler la clé `WEB3_BACKEND_SIGNER_KEY` dans un coffre-fort de variables d'environnement non versionné.
* **[-] Retrancher** :
  * Le service conteneur `blockchain` (Hardhat local) du `docker-compose` de production au profit d'un provider RPC haute disponibilité (Alchemy, Infura, QuickNode).

---

## 2. Pôle Backend & Temps Réel (Laravel 11 & Reverb)
*Analysé par `backend_api_security_agent`, `backend_combat_agent` et `backend_reverb_agent`*

### Constats & Risques
1. **Sécurité d'authentification sur les actions de combat** :
   * Actuellement, les endpoints `/battle/commit` et `/battle/reveal` vérifient l'adresse passée dans le payload HTTP, mais pas systématiquement la signature cryptographique (`personal_sign` ou EIP-712) à chaque requête.
   * *Risque ÉLEVÉ* : Un utilisateur malveillant connaissant l'adresse adverse pourrait forger un faux commit ou reveal HTTP pour disqualifier un adversaire.
2. **Base de données de production** :
   * Le runtime local utilise SQLite (`backend/web3_combat`), tandis que Docker mentionne MySQL 8.
   * *Risque* : En production multi-joueurs concurrente, SQLite souffre de verrous d'écriture (`database locked`). MySQL 8 ou PostgreSQL est indispensable pour garantir l'atomicité des transactions de poule.
3. **Scaling Reverb & Cache** :
   * En local, le broadcast Reverb boucle sans broker Redis.
   * *Risque* : Perte de messages en cas de montée en charge et impossibilité de scaler horizontalement les conteneurs API.

### Matrice d'Actions Pré-Production
* **[+] Ajouter** :
  * Middleware de vérification cryptographique de signature Web3 sur `/battle/commit` et `/battle/reveal`.
  * Redis pour le cache applicatif (`CACHE_STORE=redis`) et les files d'attente (`QUEUE_CONNECTION=redis`).
* **[~] Modifier** :
  * Basculer formellement sur MySQL 8 ou PostgreSQL avec migrations vérifiées et index optimisés sur `fights` et `pools`.
  * Forcer `APP_DEBUG=false` et `APP_ENV=production` dans `backend/.env`.
* **[-] Retrancher** :
  * Les anciennes routes de test dépréciées identifiées dans `HANDOVER.md`.

---

## 3. Pôle Frontend & Web3
*Analysé par `frontend_wallet_agent`, `frontend_state_agent` et `frontend_ui_views_agent`*

### Constats & Risques
1. **Gestion des réseaux multi-chain** :
   * Le frontend doit s'assurer que le joueur est connecté au bon réseau (ex: Base Mainnet) et lui proposer un bouton `wallet_switchEthereumChain` automatique s'il est sur le mauvais réseau.
2. **Cache HTTP des assets statiques** :
   * Le cache-buster `app.js?v=26` est actuellement géré manuellement.
   * *Risque* : Des joueurs avec un fichier JS en cache pourraient exécuter un code désynchronisé du serveur.
3. **Écran de chargement initial du moteur Godot** :
   * Le binaire WebAssembly (`.wasm`) et le pack d'assets (`.pck`) pèsent plusieurs dizaines de mégaoctets.
   * *Risque* : Écran noir ou sensation de freeze pendant le téléchargement si la barre de progression native n'est pas optimisée.

### Matrice d'Actions Pré-Production
* **[+] Ajouter** :
  * Détection automatique de chainId et invite de switch réseau dans `frontend_wallet_agent`.
  * Écran de chargement / Splashscreen stylisé avec barre de progression en pourcentage réel pendant le chargement du `.wasm`.
* **[~] Modifier** :
  * Automatiser le hash de version dans le build frontend.

---

## 4. Pôle DevOps & Infrastructure
*Analysé par `devops_container_agent`, `devops_network_proxy_agent` et `devops_env_security_agent`*

### Constats & Risques
1. **Reverse-Proxy HTTPS & WSS (WebSockets sécurisés)** :
   * En production, les navigateurs bloquent les WebSockets non chiffrés (`ws://`) sur une page servie en `https://`.
   * *Risque CRITIQUE* : Si le domaine est en HTTPS, la connexion Reverb DOIT obligatoirement être en `wss://` via un reverse-proxy Nginx.
2. **En-têtes de sécurité WebAssembly (COOP / COEP)** :
   * Pour que Godot Web tire parti des performances optimales (SharedArrayBuffer), le serveur Nginx doit envoyer :
     * `Cross-Origin-Opener-Policy: same-origin`
     * `Cross-Origin-Embedder-Policy: require-corp`
3. **MIME Types & Compression** :
   * Les fichiers `.wasm` et `.pck` doivent être servis avec compression Gzip/Brotli et les bons types MIME pour un chargement 3x plus rapide.

### Matrice d'Actions Pré-Production
* **[+] Ajouter** :
  * Fichier `docker-compose.prod.yml` prêt à l'emploi.
  * Configuration Nginx de production (`nginx.conf`) avec routage SSL Let's Encrypt et proxy pass WebSocket `/app` vers Reverb.
  * Template `.env.production` nettoyé de tout identifiant par défaut.

---

## 5. Pôle Godot 3D & Optimisation Moteur
*Analysé par `godot_arena_camera_agent` et `godot_bridge_agent`*

### Constats & Risques
1. **Export Release vs Debug** :
   * Vérifier que le build final exporté vers `frontend/` est compilé avec le template **Release** (sans symboles de debug internes), ce qui réduit drastiquement le poids du binaire `.wasm` et accélère l'exécution.

---

## Feuille de Route Prioritaire (Roadmap de Déploiement)

```
PHASE 1 : SÉCURITÉ IMMÉDIATE (Bloquants)
├── 1.1 Génération d'un wallet Signer dédié de production & isolation de sa clé privée
├── 1.2 Configuration du réseau Blockchain cible (L2 : Base ou Arbitrum) & Déploiement du contrat
└── 1.3 Signature cryptographique obligatoire sur les routes Laravel de combat

PHASE 2 : INFRASTRUCTURE & DOCKER PROD
├── 2.1 Mise en place de Nginx (HTTPS + WSS pour Reverb + compression WASM)
├── 2.2 Bascule de la base de données vers MySQL 8 / PostgreSQL persistant
└── 2.3 Configuration de Redis pour le scaling des WebSockets

PHASE 3 : EXPÉRIENCE JOUEUR & RUNBOOK
├── 3.1 Détection et switch automatique de réseau dans le frontend Web3
├── 3.2 Export Godot Release optimisé & barre de chargement fluide
└── 3.3 Test complet de validation selon TEST_RUNBOOK.md en conditions réelles
```
