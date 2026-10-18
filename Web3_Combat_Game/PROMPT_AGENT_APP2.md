> ⚠️ **OBSOLÈTE (2026-10-16)** — Ce prompt décrit l'ancien modèle **iframe +
> pont postMessage** et l'**ancien contrat `0xA2722921…`**. Le projet est passé
> aux **deep-links** (plus d'iframe/pont) et au contrat
> **`0x73F5065cBD382EF0D4b75c9e19f556E1D4Ba40f9`**. **Ne pas suivre ce fichier.**
> Lire `AGENT_ONBOARDING_APP2.md` à la place.

# PROMPT — Agent App 2 : mettre Web3 Combat Game à jour et en ligne sur le VPS

## Contexte (ne pas modifier App 1)

- **App 1 (BattlePool)** est déployé sur le VPS : `https://battlepool.31.187.72.98.sslip.io` (commit `2ebad98`).
  Il embarque **App 2 dans une iframe cross-origin** (`https://app2.31.187.72.98.sslip.io`) et lui expose
  son wallet (MetaMask/Core) via un **pont EIP-1193 par `postMessage`** (le parent détient le wallet ;
  App 2 dans l'iframe n'a ni `window.ethereum` ni WalletConnect exploitable).
- **Réseau Pingala Chain** : `chainId 99999` (`0x1869f`), symbole **TST**, RPC
  `https://31.187.72.98.sslip.io/ext/bc/2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea/rpc`,
  **pas d'explorer**.
- **App 2 est déployé sur le VPS** : `/opt/web3-combat` — conteneurs `web3_combat_frontend`,
  `web3_combat_api`, `web3_combat_indexer`, `web3_combat_db`.
  ⚠️ `/opt/web3-combat` **n'est PAS un dépôt git** ; `frontend/` est **monté en volume** dans le conteneur
  (`./frontend:/srv/www:ro`) → mettre à jour les fichiers hôte suffit (pas de rebuild), mais il faut
  **redémarrer le conteneur front** et **cache-buster**.
- **Contrat `CombatGame` (live sur Pingala)** : `0xA2722921B753C1E76e1d9a4294204DF983746C3D`
  (`feeBps()=250`, `owner()=0x3Fc5DdB9…`, `backendSigner()=0xa07c07E4…`).
  (Un ancien contrat `0x42b4928C…` existe aussi on-chain — **risque de divergence**, voir §2.)

## Ce qu'App 1 fait DÉJÀ (ne rien y changer)

Le pont `postMessage` d'App 1 (dans `public/index.html` d'App 1) :
1. **Lectures** (`eth_call`, `eth_getBalance`, `eth_getCode`, `eth_chainId`, `eth_estimateGas`,
   `eth_getLogs`, `eth_sendRawTransaction`…) → **routées directement au RPC Pingala** (déterministe,
   ne passent pas par le wallet). Corrige les `value="0x"` (`feeBps()`, `userBalances()`).
2. **Comptes + signature** (`eth_accounts`, `eth_requestAccounts`, `personal_sign`,
   `eth_sendTransaction`, `eth_signTypedData*`…) → **wallet actif du parent** (injecté OU session
   WalletConnect mobile).
3. Avant toute signature : **réveil du wallet** (deeplink Core) **+ bascule réseau Pingala 99999**
   (`ensurePingalaNetwork` → `wallet_switchEthereumChain` puis `wallet_addEthereumChain` si inconnue).
4. Contrat du pont : `{app2Bridge:true, type:'WALLET_RPC', id, request:{method,params}}`
   → `{app2Bridge:true, type:'WALLET_RPC_RESULT', id, result|error}`, origine épinglée à
   `https://app2.31.187.72.98.sslip.io`.
5. Overlay App 1 : l'iframe est chargée **sans `?mode=`** (flux classique → provider pont monté →
   **solde OK**) ; le mode est ensuite imposé par message `BATTLEPOOL_SET_MODE` (bascule **sans reload**).

## Ce que TU dois faire (App 2)

### 1. Appliquer 2 correctifs dans `frontend/app.js`

Les correctifs sont **déjà présents** dans ta copie locale
`G:\DEV\GODOT_GAME\Web3_Combat_Game\frontend\app.js` (et décrits dans `APP1_BRIDGE_FIXES.md`).
Si tu travailles sur une autre copie, porte-les :

**(a) `initWeb3()` — monter le provider pont pour TOUTE iframe** (sinon provider `null` sur le chemin
d'auto-entrée portail `?mode=` → solde absent) :
```js
} else if (window.parent !== window && (window.__bridgeProvider || setupParentProvider())) {
    window.__useParentProvider = true;
    provider = new ethers.BrowserProvider(window.__bridgeProvider);
    signer = await provider.getSigner();
} else { /* ... WalletConnect standalone ... */ }
```

**(b) Handler `BATTLEPOOL_SET_MODE`** (à ajouter dans `window.addEventListener('message', …)`, à côté de
`BATTLEPOOL_LANG`) — bascule de mode sans rechargement :
```js
case 'BATTLEPOOL_SET_MODE': {
    const m = (typeof e.data.mode === 'string') ? e.data.mode.toUpperCase() : null;
    if ((m === 'DUEL' || m === 'BATTLE' || m === 'SPIRIT') && typeof window.selectGameMode === 'function') {
        window.selectGameMode(m);
    }
    break;
}
```

### 2. Cohérence de l'adresse du contrat (IMPORTANT)

Vérifie que **`frontend/config.js`, `backend/.env` et `indexer/.env` pointent tous sur LA MÊME adresse** :
`0xA2722921B753C1E76e1d9a4294204DF983746C3D`. Le `docker-compose` du VPS référence encore
`0x42b4928C…` dans certains services → **corriger** (sinon l'indexer surveille un contrat différent de
celui que le front appelle → dépôts non synchronisés).

### 3. Paramètres Pingala à valider

- `WEB3_RPC_URL` (backend) et `RPC_HTTP_URL`/`RPC_URL` (indexer) = **RPC Pingala** (§Contexte).
- `CONTRACT_ADDRESS` = `0xA2722921…` partout.
- `DEPLOYMENT_BLOCK` = bloc réel du déploiement du contrat ciblé (pas 0).
- `CONFIRMATIONS_REQUIRED=0` (cette L1 ne produit des blocs **que sur transaction**).
- `frontend/config.js` : RPC Pingala, symbole **TST**, **aucun lien explorer** (il n'y en a pas).
- `backendSigner` (`0xa07c07E4…`) **fundé en TST natif** (gas), sinon settle/consolidate échouent.

### 4. Déployer sur le VPS (App 2)

```bash
# depuis ta copie source vers le VPS (adapter la méthode : scp/rsync déjà utilisée)
# fichiers concernés :
#   /opt/web3-combat/frontend/app.js
#   /opt/web3-combat/frontend/config.js         (si modifié)
#   /opt/web3-combat/backend/.env               (si modifié)
#   /opt/web3-combat/indexer/.env               (si modifié)
#   /opt/web3-combat/docker-compose.vps.yml     (si adresse contrat corrigée)

cd /opt/web3-combat
docker compose -f docker-compose.vps.yml restart frontend api indexer
```
- **Cache-bust** : le front Godot utilise des `?v=` (cf. ton HANDOVER) et un **service worker**
  (`frontend/sw.js`) → **incrémenter les versions** et/ou purger le SW, sinon les mobiles servent
  l'ancien `app.js`.

### 5. Vérifier (recette)

- [ ] App 1 → « Combat » : le **solde on-chain** de l'utilisateur s'affiche (badge `wallet-balance`).
- [ ] Boutons **Duel 1v1 / Battle Royale** dans la barre d'App 1 : bascule **sans rechargement**.
- [ ] Duel complet : dépôt on-chain OK (plus de `could not decode result data (value="0x")`),
      match résolu, `userBalances` lu correctement.
- [ ] Console : plus d'erreur `feeBps`/`userBalances` `value="0x"`.
- [ ] Signature de clé de session mobile : OK (le wallet s'ouvre une fois, Core sur **Pingala 99999**).

## Contraintes

- **Ne pas modifier App 1** (repo `rock-paper-scissors`) : hors périmètre.
- **Ne pas exposer de ports publics** : binder en `127.0.0.1` (le front public passe par le proxy 443).
- **Ne jamais committer de clé privée** ; `.env` gitignored / secrets.
- Ne pas écraser `/opt/web3-combat` sans vérifier les changements locaux non déployés (le dossier n'est
  pas versionné).

## Références

- Détail des correctifs pont : `APP1_BRIDGE_FIXES.md` (ce dossier).
- Migration Pingala : `PINGALA_MIGRATION_HANDOFF.md` (ce dossier).
- App 1 (source du pont et de l'overlay) : repo `rock-paper-scissors`, `public/index.html`,
  `resources/js/web3/web3-core.js`, commit `2ebad98`.
