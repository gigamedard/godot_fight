const { APP_URL, HARDHAT_WALLET, HARDHAT_PK, launchBrowser, blockGodotResources, logPage, completeEntryFlow } = require('./e2e_helpers');

(async () => {
    console.log("Starting Puppeteer E2E test (nouveau flow d'entrée)...");

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await blockGodotResources(page); // Pas besoin du moteur 3D pour ce test de poule
    logPage(page);

    // Navigate to the frontend
    console.log(`Navigating to ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });

    // Injecter un wallet déterministe (compte Hardhat #0, doté d'ETH) AVANT le reload
    // pour que connectWallet() et performLogin() utilisent ce compte.
    await page.evaluate(({ wallet, pk }) => {
        localStorage.setItem('web3combat_wallet', wallet);
        localStorage.setItem('web3combat_pk', pk);
    }, { wallet: HARDHAT_WALLET, pk: HARDHAT_PK });
    // Reload to apply the private key (et relancer le flow splash → langue)
    await page.reload({ waitUntil: 'networkidle2' });

    // Parcourir le nouveau flow : splash → langue → connexion → mode BATTLE → personnage
    await completeEntryFlow(page, { mode: 'BATTLE', language: 'fr' });
    // Nous sommes maintenant sur le lobby Battle Royale (screen-br)

    console.log("Opening Create Pool Modal via JS...");
    await page.evaluate(() => {
        if (typeof openCreatePoolModal === 'function') openCreatePoolModal();
    });

    console.log("Filling pool details...");
    // Let's set entry fee to 10
    await page.waitForSelector('#pool-entry-fee', { visible: true });
    // Set value directly via JS to avoid timing/typing issues
    await page.evaluate(() => {
        document.getElementById('pool-entry-fee').value = '10';
        console.log("Fee is set to:", document.getElementById('pool-entry-fee').value);
    });

    console.log("Submitting pool creation...");
    await page.evaluate(async () => {
        if (typeof confirmCreatePool === 'function') {
            try {
                await confirmCreatePool();
            } catch (e) {
                console.log("confirmCreatePool threw an error:", e.toString(), e.stack);
            }
        } else {
            console.log("confirmCreatePool is not a function!");
        }
    });

    // Wait for the modal to close and the pool to appear in the list
    console.log("Waiting for pool creation to finish (transaction + backend)...");
    await new Promise(r => setTimeout(r, 6000));

    // Check if the user entered the pool room
    console.log("Checking if user entered the pool room...");
    const roomTitle = await page.evaluate(() => {
        const titleEl = document.getElementById('pool-room-title');
        return titleEl ? titleEl.innerText : "";
    });

    if (roomTitle.includes('Poule #')) {
        console.log(`SUCCESS: Entered pool room! Title: ${roomTitle}`);
    } else {
        console.log("ERROR: Pool was not created or not visible.");
    }

    await browser.close();
    console.log("Test finished successfully.");
})();
