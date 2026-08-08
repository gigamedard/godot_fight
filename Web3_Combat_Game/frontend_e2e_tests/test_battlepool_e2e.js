// ============================================================================
// TEST E2E — FLOT BATTLEPOOL (portail App 1 <-> App 2)
//
// Couvre :
//   A. Connexion portail -> UI App 1 DIRECTE (plus de cartes Duel/Battle Royale)
//   B. Bouton RETOUR AU JEU (#app-back) -> postMessage BATTLEPOOL_CLOSE -> overlay fermé
//   C. Persistance de session : réouverture du portail SANS re-sign (BATTLEPOOL_SESSION_GET/RETURN)
//   D. Règles d'invitation côté App 2 :
//        - window.cancelPendingChallengesFor accessible globalement
//        - openBetModal() bloque un joueur in-game (toast, pas de modale)
//
// Exécution :  node test_battlepool_e2e.js
// ============================================================================

const { APP_URL, launchBrowser, blockGodotResources, logPage, completeEntryFlow } = require('./e2e_helpers');

const PORTAL_ORIGIN = 'http://localhost:8001';
const RPC_URL = 'http://localhost:8545';
const HARDHAT_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

// Petit utilitaire : attente polling
function waitFor(fn, timeoutMs, intervalMs = 500, label = 'condition') {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        (async function check() {
            try {
                const val = await fn();
                if (val) return resolve(val);
            } catch (e) { /* condition threw -> retry */ }
            if (Date.now() - start > timeoutMs) {
                return reject(new Error(`Timeout waiting for ${label} (${timeoutMs}ms)`));
            }
            setTimeout(check, intervalMs);
        })();
    });
}

// Mock window.ethereum : relaie eth_requestAccounts + personal_sign vers le RPC Hardhat.
// Les comptes de dev Hardhat sont déverrouillés -> le RPC signe lui-même.
async function injectEthereumMock(frame) {
    await frame.evaluate(({ wallet, rpc }) => {
        const toHex = (str) => {
            let out = '';
            for (let i = 0; i < str.length; i++) {
                out += str.charCodeAt(i).toString(16).padStart(2, '0');
            }
            return '0x' + out;
        };
        window.ethereum = {
            isMetaMask: true,
            request: async ({ method, params }) => {
                if (method === 'eth_requestAccounts') {
                    return [wallet];
                }
                if (method === 'personal_sign' || method === 'eth_sign') {
                    const [message, address] = params;
                    const hexMsg = typeof message === 'string' && !message.startsWith('0x')
                        ? toHex(message)
                        : message;
                    const res = await fetch(rpc, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'personal_sign',
                            params: [hexMsg, address]
                        })
                    });
                    const data = await res.json();
                    return data.result;
                }
                if (method === 'eth_chainId') return '0x539'; // 31337
                if (method === 'net_version') return '31337';
                if (method === 'eth_accounts') return [wallet];
                throw new Error('Unsupported ethereum method: ' + method);
            }
        };
        console.log('[MOCK] window.ethereum injecté');
    }, { wallet: HARDHAT_WALLET, rpc: RPC_URL });
}

let passed = 0, failed = 0;
function check(name, ok, extra = '') {
    if (ok) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}

(async () => {
    console.log('=== TEST E2E BATTLEPOOL ===');
    const browser = await launchBrowser();

    // ---------------------------------------------------------------------
    // ÉTAPE 1 : joueur App 2 connecté, écran SPIRIT
    // ---------------------------------------------------------------------
    console.log('\n[1] Ouverture App 2 (joueur 1) et flow d\'entrée SPIRIT...');
    const page = await browser.newPage();
    await blockGodotResources(page);
    logPage(page, '[APP2]');

    await page.goto(`${APP_URL}/?player=1`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    await completeEntryFlow(page, { mode: 'SPIRIT', language: 'fr' });

    // ---------------------------------------------------------------------
    // ÉTAPE 2 : lancement du portail (iframe 8001)
    // ---------------------------------------------------------------------
    console.log('\n[2] Lancement du portail Battlepool (launchBattlePool)...');
    await page.evaluate(() => window.launchBattlePool());

    // Attendre que l'iframe du portail se charge
    let portalFrame = null;
    await waitFor(() => {
        portalFrame = page.frames().find(f => f.url().startsWith(PORTAL_ORIGIN));
        return portalFrame ? true : false;
    }, 30000, 500, 'iframe portail (8001)');
    console.log('  iframe portail trouvée :', portalFrame.url());

    // ---------------------------------------------------------------------
    // ÉTAPE 3 : connexion wallet (mock ethereum)
    // ---------------------------------------------------------------------
    console.log('\n[3] Injection mock ethereum + connexion wallet...');
    await injectEthereumMock(portalFrame);

    // Cliquer sur le bouton connect réel du portail (via evaluate pour éviter
    // les soucis de cliquabilité cross-frame)
    await waitFor(() => portalFrame.$('#connect-btn').then(el => !!el), 10000, 500, '#connect-btn portail');
    const clickResult = await portalFrame.evaluate(() => {
        const btn = document.getElementById('connect-btn');
        if (!btn) return 'no-button';
        if (typeof btn.click === 'function') { btn.click(); return 'clicked'; }
        return 'no-click-method';
    });
    console.log('  #connect-btn :', clickResult);

    // Attendre que l'UI App 1 soit lancée (openApp('bp') -> #app-frame avec src)
    await waitFor(async () => {
        const src = await portalFrame.evaluate(() => {
            const f = document.getElementById('app-frame');
            return f && f.getAttribute('src') && f.getAttribute('src') !== 'about:blank';
        });
        return src;
    }, 30000, 750, 'UI App 1 dans #app-frame');

    // ---------------------------------------------------------------------
    // ÉTAPE 4 : assertions sur l'UI portail
    // ---------------------------------------------------------------------
    console.log('\n[4] Assertions UI portail...');

    // 4a. Plus de cartes Duel / Battle Royale dans le HTML (hors CSS)
    const noDuelBR = await portalFrame.evaluate(() => {
        const cards = document.querySelectorAll('.card-duel, .card-br');
        const htmlCards = Array.from(document.querySelectorAll('.menu-card')).filter(c =>
            c.classList.contains('card-duel') || c.classList.contains('card-br')
        );
        return htmlCards.length === 0; // 0 cartes Duel/BR dans le DOM
    });
    check('Aucune carte Duel/BR dans le menu (DOM)', noDuelBR);

    // 4b. La carte Battlepool est bien là
    const hasBP = await portalFrame.evaluate(() => {
        return !!document.querySelector('.menu-card.card-bp, #screen-menu .card-bp');
    });
    check('Carte Battlepool présente', hasBP);

    // 4c. Bouton retour présent et visible
    const backBtn = await portalFrame.evaluate(() => {
        const b = document.getElementById('app-back');
        if (!b) return false;
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    });
    check('Bouton #app-back présent et visible', backBtn);

    // 4d. L'iframe App 1 a bien chargé (vérif rapide : le titre/le contenu SPA)
    const app1Src = await portalFrame.evaluate(() => document.getElementById('app-frame').getAttribute('src'));
    check('iframe App 1 a un src', !!app1Src, `(src=${app1Src})`);

    // 4e. Session sauvegardée côté App 2 (BATTLEPOOL_SESSION_SAVE reçu)
    const savedUser = await page.evaluate(() => localStorage.getItem('user'));
    const savedToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    check('BATTLEPOOL_SESSION_SAVE : user persisté côté App 2', !!savedUser);
    check('BATTLEPOOL_SESSION_SAVE : auth_token persisté côté App 2', !!savedToken);
    if (savedUser) {
        const walletOk = await page.evaluate((w) => {
            try {
                const u = JSON.parse(localStorage.getItem('user'));
                return u && u.wallet_address && u.wallet_address.toLowerCase() === w.toLowerCase();
            } catch (e) { return false; }
        }, HARDHAT_WALLET);
        check('user.wallet_address = wallet Hardhat connecté', walletOk);
    }

    // ---------------------------------------------------------------------
    // ÉTAPE 5 : bouton RETOUR AU JEU -> BATTLEPOOL_CLOSE -> overlay fermé
    // ---------------------------------------------------------------------
    console.log('\n[5] Bouton RETOUR AU JEU (#app-back)...');
    await waitFor(() => portalFrame.$('#app-back').then(el => !!el), 10000, 500, '#app-back portail');
    await portalFrame.evaluate(() => {
        const b = document.getElementById('app-back');
        if (b) b.click();
    });

    // L'overlay de l'App 2 doit se fermer (closeBattlePool -> class hidden)
    const overlayClosed = await waitFor(() => page.evaluate(() => {
        const o = document.getElementById('portal-overlay');
        return o && o.classList.contains('hidden');
    }), 10000, 500, 'overlay fermé après #app-back');
    check('BATTLEPOOL_CLOSE reçu -> overlay App 2 fermé', overlayClosed);

    // ---------------------------------------------------------------------
    // ÉTAPE 6 : réouverture -> session restaurée SANS re-sign
    // ---------------------------------------------------------------------
    console.log('\n[6] Réouverture du portail : restauration de session...');
    await page.evaluate(() => window.launchBattlePool());

    let portalFrame2 = null;
    await waitFor(() => {
        portalFrame2 = page.frames().find(f => f.url().startsWith(PORTAL_ORIGIN));
        return portalFrame2 ? true : false;
    }, 30000, 500, 'iframe portail (2e ouverture)');

    // Le portail doit demander BATTLEPOOL_SESSION_GET et recevoir RETURN -> connecté direct
    // (pas d'écran de connexion : l'UI App 1 doit se rouvrir)
    const restoredDirect = await waitFor(async () => {
        return portalFrame2.evaluate(() => {
            const f = document.getElementById('app-frame');
            return f && f.getAttribute('src') && f.getAttribute('src') !== 'about:blank';
        });
    }, 30000, 750, 'UI App 1 restaurée directement');
    check('Session restaurée : UI App 1 ouverte sans re-sign', restoredDirect);

    // Vérifier que l'écran de connexion du portail N'EST PAS actif
    const loginVisible = await portalFrame2.evaluate(() => {
        const s = document.getElementById('screen-login');
        return s && s.classList.contains('active');
    });
    check('Écran de connexion portail NON affiché (session restaurée)', !loginVisible);

    // ---------------------------------------------------------------------
    // ÉTAPE 7 : règles d'invitation côté App 2
    // ---------------------------------------------------------------------
    console.log('\n[7] Règles d\'invitation (App 2)...');

    // Le mode SPIRIT ne passe PAS par l'écran personnage -> performLogin() (qui
    // définit window.cancelPendingChallengesFor et initialise Echo/Reverb) n'est
    // jamais appelée. Les règles d'invitation concernent le mode DUEL/BATTLE :
    // on ouvre donc un 2e joueur en mode DUEL pour vérifier le comportement réel.
    const p2 = await browser.newPage();
    await blockGodotResources(p2);
    logPage(p2, '[APP2-P2]');
    await p2.goto(`${APP_URL}/?player=2`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    await completeEntryFlow(p2, { mode: 'DUEL', language: 'fr' });

    // 7a. window.cancelPendingChallengesFor accessible globalement (fix scope)
    const cancelFn = await p2.evaluate(() => typeof window.cancelPendingChallengesFor);
    check('window.cancelPendingChallengesFor est une fonction (mode DUEL)', cancelFn === 'function', `(type=${cancelFn})`);

    // 7b. openBetModal bloque un joueur in-game
    const inGameBlocked = await p2.evaluate(() => {
        // Simuler un joueur in-game dans la liste online
        if (typeof onlinePlayers !== 'undefined') {
            onlinePlayers.push({ id: '0x1111111111111111111111111111111111111111', name: 'TestInGame', status: 'in-game' });
        }
        // capture du toast avant
        const prevToasts = document.querySelectorAll('.toast').length;
        openBetModal('0x1111111111111111111111111111111111111111');
        // La modale de pari ne doit PAS s'ouvrir
        const modal = document.getElementById('bet-modal');
        return {
            modalOpen: modal && modal.style.display === 'flex',
            newToast: document.querySelectorAll('.toast').length > prevToasts
        };
    });
    check('openBetModal refuse un joueur in-game (pas de modale)', !inGameBlocked.modalOpen);
    check('openBetModal affiche un toast d\'erreur', inGameBlocked.newToast);

    // 7c. cancelPendingChallengesFor fonctionne (ferme la modale défi en attente)
    const cancelWorks = await p2.evaluate(() => {
        // Simuler une invitation en attente
        AppState.currentChallenger = '0x2222222222222222222222222222222222222222';
        AppState.currentBetAmountOffchain = 10;
        const modal = document.getElementById('challenge-modal');
        if (modal) modal.style.display = 'flex';
        window.cancelPendingChallengesFor('0x2222222222222222222222222222222222222222');
        return {
            challengerCleared: AppState.currentChallenger === null,
            modalClosed: !modal || modal.style.display === 'none' || modal.style.display === ''
        };
    });
    check('cancelPendingChallengesFor vide l\'invitation en attente', cancelWorks.challengerCleared);
    check('cancelPendingChallengesFor ferme la modale défi', cancelWorks.modalClosed);

    // ---------------------------------------------------------------------
    await browser.close();
    console.log(`\n=== RÉSULTAT : ${passed} OK, ${failed} ÉCHEC(S) ===`);
    process.exit(failed > 0 ? 1 : 0);
})().catch(err => {
    console.error('\n=== ERREUR FATALE E2E ===');
    console.error(err);
    process.exit(2);
});
