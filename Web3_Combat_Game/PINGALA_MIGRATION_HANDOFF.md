# HANDOFF — App 2 « Web3 Combat Game » (Godot) → Réseau Pingala Chain

> **Émetteur** : App 1 BattlePool (repo `rock-paper-scissors`)
> **Destinataire** : agent en charge du projet Godot (`G:\DEV\GODOT_GAME\Web3_Combat_Game`)
> **Objet** : finaliser la migration d'App 2 sur la **L1 Pingala Chain** (chainId **99999**) — contrats **déjà déployés**, reste : UI/WalletConnect, retrait des mocks, hébergement VPS.
> **Décision** : **App 2 = clone de la config App 1** (même projectId, même stack WC mobile, même modèle d'hébergement).
> **Date** : 2026-10-12

---

## 0. ÉTAT RÉEL (vérifié on-chain le 2026-10-12)

- **Contrats App 2 : DÉJÀ DÉPLOYÉS sur Pingala.**
  - `CombatGame` = **`0x42b4928C128094a99631462a2895Ab3Ff380Fb94`** (présent on-chain, bloc de déploiement **108** = tête actuelle).
  - `docker-compose.yml` d'App 2 déjà pointé sur le RPC Pingala, `CONTRACT_ADDRESS` + `DEPLOYEMENT_BLOCK=108` renseignés, nœud Hardhat local retiré.
- **Reste à faire** :
  1. **UI / WalletConnect mobile** (le sujet du questionnaire) — cf. §8 (clonage App 1).
  2. **Retrait des mocks** prod (dev-only gardé).
  3. **Hébergement VPS** sous `app2.31.187.72.98.sslip.io` — cf. §9 (snippet Caddy prêt).
  4. **Funding TST** des wallets qui signent (backendSigner + settle/consolidate) — cf. §6.

---

## 1. Paramètres réseau Pingala Chain (fait foi)

| Clé | Valeur |
|---|---|
| **Nom** | `Pingala Chain` |
| **Chain ID** | `99999` (hex `0x1869f`) |
| **Symbole natif** | `TST` (18 décimales) |
| **RPC public** | `https://31.187.72.98.sslip.io/ext/bc/2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea/rpc` |
| **Blockchain ID** | `2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea` |
| **Explorer** | ❌ aucun |
| **Type** | Avalanche L1 / subnet-evm v1.15.1 |

### Bloc EIP-3085 (add/switch network wallet)

```json
{
  "chainId": "0x1869f",
  "chainName": "Pingala Chain",
  "rpcUrls": ["https://31.187.72.98.sslip.io/ext/bc/2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea/rpc"],
  "nativeCurrency": { "name": "TST", "symbol": "TST", "decimals": 18 },
  "blockExplorerUrls": null
}
```

> ⚠️ **Plus jamais 8845 / 31337 / 1337 en prod.** Le réseau MetaMask doit être **99999**.

---

## 2. Contrats App 1 déjà sur Pingala (interop éventuelle)

Déployeur/owner : `0xD62909EAD1cbE35d5A7BD145f00530Fd574763Ee`

| Contrat | Adresse Pingala |
|---|---|
| `Battlepool` | `0x0790C2e42DB6A97cBE5Ba0DeD6F912868b0f62EF` |
| `PranaToken` (token App 1) | `0x38ef4A4D6cd01949123bF1f8EB73B0ac0D09903B` |
| `MarketplaceEscrow` | `0x6C12875a81356d6b3042737C8eb7AAE9B4a088ac` |
| `WAVAX` | `0x0a324396FB40C9cf10f665bFDb21FFceBe66CfD4` |

Wallets de rôles App 1 : signer `0xBe24F203E4e35A79E242d77c3710cE608C16a3De`, payout `0x9A60327ce58A94a411987119047A75A8F1076663`, dev `0x153d0C405a415F3E01188F46dAA80D1fcb2C2166`.
Détail : `battlepool/pingala_deployments.json`.

---

## 3. Paramètres WalletConnect / Reown (App 1 — à cloner)

| Élément | Valeur App 1 |
|---|---|
| **projectId Reown** | `e46cab0b26fb49b6375fd488d2dc5e95` (public côté client) |
| **Origine** | `https://battlepool.31.187.72.98.sslip.io` → App 2 : ajouter `https://app2.31.187.72.98.sslip.io` |
| **Métadonnées dApp** | name `Battlepool`, desc `Battlepool Game dApp`, url `location.origin`, icons `origin + '/pwa_icon_192.png'`, `redirect.universal = origin + '/'` |
| **Wallets custom** | Core (`https://core.app.link`) + MetaMask (`https://metamask.app.link`) |
| **Namespaces WC** | `eip155:99999` en **requiredNamespaces** + `rpcMap` |

---

## 4. Fichiers App 2 à modifier (chemins exacts)

### 4.1 `blockchain/hardhat.config.js` — ✅ si `pingala` présent, sinon ajouter
```js
pingala: {
  url: process.env.PINGALA_RPC_URL,
  chainId: 99999,
  accounts: process.env.PINGALA_DEPLOYER_PK ? [process.env.PINGALA_DEPLOYER_PK] : [],
}
```

### 4.2 `blockchain/scripts/deploy.js` — déploiement séquentiel (déjà fait : 0x42b4928C…)

### 4.3 `backend/.env` — ✅ déjà migré dans le compose, vérifier :
- `WEB3_RPC_URL` = RPC Pingala ✅
- `CONTRACT_ADDRESS` = `0x42b4928C128094a99631462a2895Ab3Ff380Fb94` ✅
- `WEB3_BACKEND_SIGNER_KEY` = clé fraîche **fundée en TST** (≠ owner) ⬜

### 4.4 `indexer/.env` / `indexer/config.js` — ✅ `DEPLOYMENT_BLOCK=108`, `CONFIRMATIONS_REQUIRED=0` (OK : L1 sans blocs vides)

### 4.5 `frontend/config.js` — ⬜ **le gros du travail restant**
- RPC → RPC Pingala.
- `CONTRACT_ADDRESS` → `0x42b4928C…Fb94`.
- Passer en **même origine** (Caddy `app2.*`) : `API_BASE_URL` → `/api`, Reverb → `wss://<host>/app` (supprimer les proxies TLS internes :8443/8444/8445).
- Logique **add/switch réseau** → bloc EIP-3085 (§1) ; symbole **TST**.
- Connexion wallet → **cloner la config App 1** (§8).

### 4.6 `docker-compose.yml` — ✅ ports déjà bindés `127.0.0.1` (8000/8081 api, 8080/8443-8445 front)

---

## 5. Pièges connus (vécus côté App 1)

1. **chainId** : tout en **99999**. Un wallet resté en 8845/31337 rejette les tx.
2. **Nonces MetaMask** : après tout reset/redéploiement, **réinitialiser le cache MetaMask** (Paramètres → Avancé → *Effacer les données d'activité*).
3. **Pas d'explorer** : UI sans lien explorer.
4. **Gas** : pas de faucet public → funder les wallets qui signent.
5. **LF uniquement** dans les `.env`/scripts déployés (CRLF casse sous Linux).
6. **Secrets** : jamais de clé privée committée, `.env` gitignored.
7. **Déploiement séquentiel** (1 tx à la fois + `await tx.wait()`).
8. **Ports** : co-localisation VPS → binder en `127.0.0.1`.
9. **`docker compose down -v`** = perte DB → jamais sans backup.

---

## 6. Funding TST (agent TST, depuis `0x3fA1…21B0`)

| Bénéficiaire | Adresse | Montant |
|---|---|---|
| App 2 — déployeur | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | 2 TST |
| App 2 — backendSigner | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | 0.5 TST |
| *(optionnel)* App 1 — déployeur (top-up) | `0xD62909EAD1cbE35d5A7BD145f00530Fd574763Ee` | +1 TST (déjà 2.72) |

> ⚠️ Adresses du **mnémonic Hardhat dev** (clés publiques) → OK testnet, **à remplacer par des clés fraîches** avant valeur réelle.

---

## 7. Handoff portail → App 2 (à conserver)

- URL iframe : `APP2_URL + '?mode=DUEL'` | `'?mode=BATTLE'` puis `'&wallet=' + encodeURIComponent(addr) + '&_=' + Date.now()`.
- `postMessage` : `BATTLEPOOL_SESSION_SAVE` `{user, auth_token}` · `BATTLEPOOL_SESSION_CLEAR` · `BATTLEPOOL_SESSION_GET` · `BATTLEPOOL_SESSION_RETURN` `{user, auth_token}` · `BATTLEPOOL_CLOSE`.

---

## 8. CLONAGE de la config WalletConnect depuis App 1 (décision actée)

**Source à copier (même machine)** : `G:\DEV\PHP\rock-paper-scissors\resources\js\web3\web3-core.js`
Auth : `resources/js/core/auth.js`. Portail : `public/portal.html`.

| Section App 1 | Lignes | Rôle |
|---|---|---|
| `PRANA_NETWORK` | 28–37 | réseau Pingala |
| `WC_PROJECT_ID` (`.trim()`) | 53 | projectId (piège CRLF) |
| `APPKIT_PINGALA_NETWORK` | 72–81 | réseau AppKit |
| `APPKIT_CUSTOM_WALLETS` | 97–103 | Core + MetaMask |
| `APPKIT_METADATA` | 109–120 | métadonnées + `redirect.universal` |
| `WALLET_DEEPLINKS` | 144–157 | universal links |
| `_isMobileDevice`/`_buildDeeplink`/`reopenWalletForSigning` | 158–210 | deeplink |
| `WC_NAMESPACES` | 403–410 | `eip155:99999` required + rpcMap |
| `connectWalletMobile` | 430–608 | **flux mobile qui marche** |
| `_waitForAppKitConnection` | 309 | poll session 2 min |
| `_restoreWcSessionIfNeeded` | 669–697 | reconnexion silencieuse |
| `ensurePingalaNetwork`/`ensureWalletVisibleForTx` | 727–866 | switch réseau + ré-ouverture wallet |
| `getProvider/getSigner/getContract` | 868–989 | EIP-1193 → ethers |

**Décisions** : SDK = stack App 1 (`@reown/appkit` + `@walletconnect/universal-provider` + fallback `@walletconnect/ethereum-provider` 2.24.0), bundlé en **IIFE esbuild** committé dans `frontend/` (pas de CDN). Flux = (a) un bouton « smart » (injected → sinon WC mobile). Mocks : retirés en prod, `?player=N` **dev-only** (`IsLocalhost()`). CSP : aucune côté App 1 ; si ajoutée, autoriser `connect-src wss://relay.walletconnect.com https://*.walletconnect.com https://*.walletconnect.org`. Relay WC = connexion directe navigateur (pas de relai Caddy).

---

## 9. Hébergement VPS — site Caddy frère `app2.*`

Snippet prêt : `deploy/Caddyfile.app2.snippet` (côté App 1). Modèle identique à `battlepool.*` :
- `/app/*` → `127.0.0.1:8081` (Reverb WS)
- `/api/*` → `127.0.0.1:8000` (API Laravel)
- `/*`      → `127.0.0.1:8080` (front Godot)
- TLS auto Caddy pour `app2.31.187.72.98.sslip.io`, bloc L1 **non touché**.

À faire : (1) insérer le snippet dans `/etc/caddy/Caddyfile`, (2) autoriser l'origine `https://app2.31.187.72.98.sslip.io` dans le dashboard Reown, (3) vérifier le MIME `application/wasm` côté front (server statique Godot).

---

*Sources App 1 : `battlepool/pingala_deployments.json`, `battlepool/hardhat.config.js`, `resources/js/web3/web3-core.js`, `public/portal.html`, `deploy/Caddyfile.app2.snippet`. Sources App 2 : `Web3_Combat_Game/{blockchain,frontend,backend,indexer,docker-compose.yml}`. Vérif on-chain : RPC Pingala, bloc 108.*
