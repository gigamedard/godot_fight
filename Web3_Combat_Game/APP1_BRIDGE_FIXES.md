> ⚠️ **OBSOLÈTE (2026-10-16)** — Le pont postMessage et l'iframe App1↔App2 ont
> été **supprimés** au profit de **deep-links**. Ce document n'est conservé que
> comme historique. Lire `AGENT_ONBOARDING_APP2.md`.

# App 2 — correctifs pont App1 ↔ iframe (2026-10-15)

Contexte : App 2 est embarqué dans l'iframe d'App 1 (`https://app2.31.187.72.98.sslip.io`),
qui détient le wallet (provider EIP-1193 relayé par `postMessage`). Deux régressions
constatées côté mobile après ajout d'un sélecteur de mode dans App 1 :

## 1. Solde on-chain absent (chemin d'auto-entrée portail `?mode=`)

**Cause** : `initWeb3()` ne montait le provider du pont que via
`window.__useParentProvider && window.__bridgeProvider`. Or ce flag n'est posé que
dans la branche « iframe » de `connectWallet()` (≈ `app.js:573`). Le chemin
d'auto-entrée portail (`?mode=DUEL|BATTLE`, `isPortalEntry`, ≈ `app.js:515`) appelle
`finishConnection()` → `initWeb3()` **sans** poser ce flag → `provider = null`
(« mode dégradé ») → **solde non affiché**, et lectures on-chain KO.

**Correctif** (`initWeb3`, ≈ `app.js:896`) — élargir la branche pont à toute iframe :
```js
        } else if (window.parent !== window && (window.__bridgeProvider || setupParentProvider())) {
            window.__useParentProvider = true;
            provider = new ethers.BrowserProvider(window.__bridgeProvider);
            signer = await provider.getSigner();
        } else {
```

## 2. Bascule de mode sans rechargement

App 1 envoie désormais un message au lieu de recharger l'iframe :
`{ type: 'BATTLEPOOL_SET_MODE', mode: 'DUEL' | 'BATTLE' | 'SPIRIT' }`.

**Correctif** (`window.addEventListener('message', …)`, après le case `BATTLEPOOL_LANG`) :
```js
        case 'BATTLEPOOL_SET_MODE': {
            const m = (typeof e.data.mode === 'string') ? e.data.mode.toUpperCase() : null;
            if ((m === 'DUEL' || m === 'BATTLE' || m === 'SPIRIT') && typeof window.selectGameMode === 'function') {
                window.selectGameMode(m);
            }
            break;
        }
```

## Rôle des deux côtés

- **App 1** (déjà déployé) : 1er chargement de l'iframe **sans `?mode=`** (flux classique
  → provider pont → solde OK), puis bascule de mode par `BATTLEPOOL_SET_MODE`.
- **App 2** : appliquer les 2 correctifs ci-dessus (fichier `frontend/app.js`) puis
  redéployer le front (`/opt/web3-combat/frontend`, servi en volume `:ro`).

> Le reste du pont EIP-1193 (lectures routées au RPC Pingala, comptes/signature au
> wallet, réveil Core, bascule réseau Pingala 99999) est déjà en place côté App 1.
