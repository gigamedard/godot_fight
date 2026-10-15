// ============================================================================
// TEST I18N — Validation multilingue complète (FR/EN/ES/PT)
// ============================================================================
// Scénarios (chaque scénario = contexte incognito ISOLÉ, locale fr forcée) :
//   1. Splash → sélection 'en' → écran connect traduit, DOM traduit
//   2. Re-sélection dynamique : 'fr' → 'es' → 'pt' via quick-lang-selector
//   3. localStorage portal_lang='es' pré-existant → appliqué au démarrage
//   4. URL ?lang=pt (portail App 1 → App 2, entrée ?mode=…&lang=…)
//   5. Rendus dynamiques : renderDuelLobby/renderBRLobby/pool title traduits
//   6. languageChanged : re-render d'une vue dynamique (character grid)
//   7. persistance : reload → la langue reste
// ============================================================================

const puppeteer = require('puppeteer-core');
const { APP_URL, CHROME_PATH, blockGodotResources } = require('./e2e_helpers');

let passed = 0, failed = 0;

function assert(cond, label) {
    if (cond) { passed++; console.log(`  ✅ PASS: ${label}`); }
    else { failed++; console.log(`  ❌ FAIL: ${label}`); }
}

async function freshContextPage(browser) {
    // Incognito = isolation totale du localStorage entre scénarios.
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(() => {
        // Forcer la langue du navigateur en 'fr' pour reproduire un client FR réel.
        Object.defineProperty(navigator, 'language', { get: () => 'fr-FR' });
        Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] });
    });
    await blockGodotResources(page);
    return { context, page };
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    // ── 1. Sélection 'en' à l'écran langue ──────────────────────────────────
    {
        console.log('\n[1] Sélection EN à l\'écran langue');
        const { context, page } = await freshContextPage(browser);
        await page.goto(`${APP_URL}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#screen-language.active', { timeout: 20000 });
        // Traduction de l'écran langue AVANT sélection (fr par défaut)
        const before = await page.evaluate(() => document.documentElement.lang);
        assert(before === 'fr', `Langue initiale fr (avant sélection) → ${before}`);
        await page.evaluate(() => window.selectLanguage('en'));
        const after = await page.evaluate(() => ({
            html: document.documentElement.lang,
            i18n: window.I18N.getLanguage(),
            app: AppState.language,
            title: (document.querySelector('#screen-connect .screen-title') || {}).textContent,
            subtitle: (document.querySelector('#screen-connect .connect-subtitle') || {}).textContent,
            screen: AppState.currentScreen
        }));
        assert(after.html === 'en', `html lang=en → ${after.html}`);
        assert(after.i18n === 'en', `I18N langue = en`);
        assert(after.app === 'en', `AppState.language = en`);
        assert(after.screen === 'screen-connect', `Navigation vers screen-connect`);
        assert(/connection/i.test(after.title || ''), `Titre connect traduit → "${(after.title||'').trim()}"`);
        assert(/connect your wallet/i.test(after.subtitle || ''), `Sous-titre traduit EN`);
        // Persistance
        const stored = await page.evaluate(() => ({
            web3: localStorage.getItem('web3combat_lang'),
            portal: localStorage.getItem('portal_lang')
        }));
        assert(stored.web3 === 'en' && stored.portal === 'en', `Persisté web3combat_lang + portal_lang = en`);
        await context.close();
    }

    // ── 2. Sélections successives via quick-lang-selector ──────────────────
    {
        console.log('\n[2] Changements successifs fr→es→pt (quick-lang-selector)');
        const { context, page } = await freshContextPage(browser);
        await page.goto(`${APP_URL}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#screen-language.active', { timeout: 20000 });
        // L'écran langue est actif : le quick-lang-selector appelle aussi selectLanguage
        await page.evaluate(() => window.selectLanguage('es'));
        const es = await page.evaluate(() => ({ lang: document.documentElement.lang, sub: (document.querySelector('#screen-connect .connect-subtitle') || {}).textContent }));
        assert(es.lang === 'es', `html lang=es → ${es.lang}`);
        assert(/billetera/i.test(es.sub || ''), `Sous-titre ES → "${(es.sub||'').trim().substring(0,50)}"`);
        await page.evaluate(() => window.selectLanguage('pt'));
        const pt = await page.evaluate(() => ({ lang: document.documentElement.lang, sub: (document.querySelector('#screen-connect .connect-subtitle') || {}).textContent }));
        assert(pt.lang === 'pt', `html lang=pt → ${pt.lang}`);
        assert(/carteira/i.test(pt.sub || ''), `Sous-titre PT → "${(pt.sub||'').trim().substring(0,50)}"`);
        await context.close();
    }

    // ── 3. localStorage portal pré-rempli ───────────────────────────────────
    {
        console.log('\n[3] localStorage portal_lang=es pré-existant (portail App 1)');
        const { context, page } = await freshContextPage(browser);
        // Injecter AVANT le chargement de la page (pré-navigation)
        await page.evaluateOnNewDocument(() => {
            localStorage.setItem('portal_lang', 'es');
            localStorage.setItem('web3combat_lang', 'es');
        });
        await page.goto(`${APP_URL}/index.html`, { waitUntil: 'domcontentloaded' });
        const state = await page.evaluate(() => ({
            lang: document.documentElement.lang,
            i18n: window.I18N.getLanguage(),
            sub: (document.querySelector('#screen-language .screen-subtitle') || {}).textContent
        }));
        assert(state.lang === 'es', `html lang=es depuis localStorage → ${state.lang}`);
        assert(state.i18n === 'es', `I18N langue = es`);
        assert(/idioma/i.test(state.sub || ''), `Écran langue traduit ES → "${(state.sub||'').trim()}"`);
        await context.close();
    }

    // ── 4. URL ?lang=pt (injection portail via URL) ─────────────────────────
    {
        console.log('\n[4] URL ?lang=pt (portail hôte)');
        const { context, page } = await freshContextPage(browser);
        await page.goto(`${APP_URL}/index.html?lang=pt`, { waitUntil: 'domcontentloaded' });
        const state = await page.evaluate(() => ({
            lang: document.documentElement.lang,
            i18n: window.I18N.getLanguage()
        }));
        assert(state.lang === 'pt' && state.i18n === 'pt', `URL ?lang=pt appliquée → ${state.lang}`);
        await context.close();
    }

    // ── 5. Vues dynamiques : renders traduits ───────────────────────────────
    {
        console.log('\n[5] Rendus dynamiques (renderDuelLobby, renderBRLobby, pool room)');
        const { context, page } = await freshContextPage(browser);
        await page.goto(`${APP_URL}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#screen-language.active', { timeout: 20000 });
        await page.evaluate(() => window.selectLanguage('en'));
        await page.waitForSelector('#screen-connect.active', { timeout: 10000 });
        // renderDuelLobby : injecter un joueur factice et vérifier le rendu EN
        const lobbyBtn = await page.evaluate(() => {
            window._onlinePlayersSave = AppState;
            onlinePlayers = [{ id: '0x1234567890abcdef1234567890abcdef12345678', name: 'TestUser', status: 'idle' }];
            renderDuelLobby(onlinePlayers);
            const btn = document.querySelector('#players-list .btn-challenge');
            return btn ? btn.textContent.trim() : null;
        });
        assert(lobbyBtn === 'CHALLENGE', `Bouton défi EN (renderDuelLobby) → "${lobbyBtn}"`);
        // renderBRLobby (sans backend : catch → erreur traduite)
        const brEmpty = await page.evaluate(async () => {
            await renderBRLobby();
            const el = document.querySelector('#br-list .empty-state');
            return el ? el.textContent.trim() : null;
        });
        assert(brEmpty === 'Connection error.', `renderBRLobby vide (erreur API) traduite EN → "${brEmpty}"`);
        // renderPoolRoom : titre traduit
        const poolTitle = await page.evaluate(() => {
            AppState.currentPoolId = 42;
            document.getElementById('pool-room-title').innerText = window.I18N.t('poolTitle', { id: 42 });
            return document.getElementById('pool-room-title').innerText;
        });
        assert(/Pool #42/i.test(poolTitle), `Titre pool EN → "${poolTitle}"`);
        await context.close();
    }

    // ── 6. Re-render sur languageChanged (character grid) ───────────────────
    {
        console.log('\n[6] languageChanged → re-render grille personnages');
        const { context, page } = await freshContextPage(browser);
        await page.goto(`${APP_URL}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#screen-language.active', { timeout: 20000 });
        await page.evaluate(() => window.selectLanguage('en'));
        await page.waitForSelector('#screen-connect.active', { timeout: 10000 });
        // Simuler l'arrivée sur l'écran personnage (renderCharacterSelect est appelé au boot)
        const name = await page.evaluate(() => {
            navigateTo('screen-character');
            renderCharacterSelect();
            const h3 = document.querySelector('#character-grid .char-card h3');
            return h3 ? h3.textContent.trim() : null;
        });
        assert(/Ninja Warrior/i.test(name || ''), `Nom personnage EN → "${name}"`);
        // Changement de langue → re-render automatique
        const nameEs = await page.evaluate(() => {
            window.selectLanguage('es');
            const h3 = document.querySelector('#character-grid .char-card h3');
            return h3 ? h3.textContent.trim() : null;
        });
        assert(/Guerrero Ninja/i.test(nameEs || ''), `Re-render auto ES → "${nameEs}"`);
        await context.close();
    }

    // ── 7. Persistance après reload ─────────────────────────────────────────
    {
        console.log('\n[7] Persistance langue après reload');
        const { context, page } = await freshContextPage(browser);
        await page.goto(`${APP_URL}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#screen-language.active', { timeout: 20000 });
        await page.evaluate(() => window.selectLanguage('en'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        const state = await page.evaluate(() => ({
            lang: document.documentElement.lang,
            i18n: window.I18N.getLanguage(),
            sub: (document.querySelector('#screen-language .screen-subtitle') || {}).textContent
        }));
        assert(state.lang === 'en', `Reload : langue conservée (en) → ${state.lang}`);
        assert(/Select your/i.test(state.sub || ''), `Écran langue EN après reload`);
        await context.close();
    }

    await browser.close();
    console.log(`\n════════ RÉSULTAT I18N : ${passed} PASS / ${failed} FAIL ════════`);
    process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });