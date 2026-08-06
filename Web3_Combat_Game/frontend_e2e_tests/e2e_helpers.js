// ============================================================================
// HELPEURS PARTAGÉS POUR LES TESTS E2E (frontend_e2e_tests)
//
// Le nouveau flow d'entrée de l'application est :
//   screen-splash (2.6s) → screen-language → screen-connect → screen-mode
//   → screen-character → (screen-main | screen-br | screen-spirit)
//
// Ces helpers permettent à chaque test de parcourir ce flow réel (clics sur
// les vrais boutons) au lieu de court-circuiter vers des écrans cachés.
// ============================================================================

const puppeteer = require('puppeteer-core');

const APP_URL = 'http://localhost:8080';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Compte Hardhat #0 (déterministe) pour les transactions on-chain
const HARDHAT_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const HARDHAT_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function launchBrowser() {
    return puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: "new", // use new headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
    });
}

// Intercepte et bloque le chargement lourd du moteur Godot (wasm/pck) pour que
// les tests n'aient PAS besoin de WebGL et que les mocks (godotSpawnOpponent,
// godotPlayRevealAnimation, ...) restent autoritaires. Le jeu ne boote jamais.
// Note : `godot/jeu.js` est laissé chargé (il définit la classe `Engine`).
async function blockGodotResources(page) {
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (url.includes('/godot/') && (/\.(wasm|pck)(\?|$)/.test(url))) {
            request.abort();
        } else {
            request.continue();
        }
    });
}

// Enregistre un logger de console + requêtes sur la page
function logPage(page, prefix = 'PAGE') {
    page.on('console', msg => console.log(`${prefix} LOG:`, msg.text()));
    page.on('requestfailed', request => {
        console.log(`${prefix} REQUEST FAILED: ${request.url()} - ${request.failure() ? request.failure().errorText : ''}`);
    });
    page.on('response', response => {
        if (!response.ok()) {
            console.log(`${prefix} RESPONSE FAILED: ${response.url()} - ${response.status()}`);
        }
    });
}

// ============================================================================
// PARCOURS DU NOUVEAU FLOW D'ENTRÉE (vrais boutons)
//
// options :
//   mode      : 'DUEL' (défaut) | 'BATTLE' | 'SPIRIT'
//   language  : 'fr' | 'en' | ...
//   expectScreen : écran final attendu (par défaut déduit du mode)
//
// Le wallet doit être disponible AVANT l'appel :
//   - soit via ?player=N dans l'URL (comptes Hardhat déterministes)
//   - soit via localStorage web3combat_wallet / web3combat_pk (injectés avant)
// ============================================================================
async function completeEntryFlow(page, options = {}) {
    const mode = options.mode || 'DUEL';
    const language = options.language || 'fr';

    // 1. Le splash avance automatiquement vers la langue (2.6s)
    console.log('[FLOW] Attente de la fin du splash (screen-language)...');
    await page.waitForSelector('#screen-language.active', { timeout: 20000 });

    // 2. Sélection de la langue (bouton réel)
    console.log(`[FLOW] Sélection de la langue '${language}'...`);
    await page.evaluate((lang) => window.selectLanguage(lang), language);
    await page.waitForSelector('#screen-connect.active', { timeout: 10000 });

    // 3. Connexion du wallet (bouton réel)
    console.log('[FLOW] Connexion du wallet...');
    await page.evaluate(() => window.connectWallet());
    await page.waitForSelector('#screen-mode.active', { timeout: 15000 });

    // 4. Choix du mode de jeu
    console.log(`[FLOW] Choix du mode '${mode}'...`);
    await page.evaluate((m) => window.selectGameMode(m), mode);

    // 5. Sélection du personnage + confirmation (mode ≠ SPIRIT)
    if (mode !== 'SPIRIT') {
        await page.waitForSelector('#screen-character.active', { timeout: 10000 });
        console.log('[FLOW] Sélection du premier personnage et confirmation...');
        await page.evaluate(() => {
            const firstChar = document.querySelector('.char-card');
            if (firstChar) firstChar.click();
            document.getElementById('btn-confirm-char').click();
        });
    }

    // 6. Attente de l'écran final (lobby selon le mode)
    const expected = options.expectScreen ||
        (mode === 'BATTLE' ? '#screen-br.active' : mode === 'SPIRIT' ? '#screen-spirit.active' : '#screen-main.active');
    console.log(`[FLOW] Attente de l'écran ${expected}...`);
    await page.waitForSelector(expected, { timeout: 20000 });
    console.log(`[FLOW] Flow d'entrée terminé (${expected}).`);
}

module.exports = {
    APP_URL,
    CHROME_PATH,
    HARDHAT_WALLET,
    HARDHAT_PK,
    launchBrowser,
    blockGodotResources,
    logPage,
    completeEntryFlow
};
