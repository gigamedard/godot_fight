const puppeteer = require('puppeteer-core');

(async () => {
    console.log("Starting Puppeteer E2E test...");
    
    // Launch a headless browser
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: "new", // use new headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
    });
    
    const page = await browser.newPage();
    
    // Catch console logs from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('requestfailed', request => {
        console.log(`REQUEST FAILED: ${request.url()} - ${request.failure() ? request.failure().errorText : ''}`);
    });
    page.on('response', response => {
        if (!response.ok()) {
            console.log(`RESPONSE FAILED: ${response.url()} - ${response.status()}`);
        }
    });
    
    // Navigate to the frontend
    console.log("Navigating to http://localhost:8080...");
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
    
    // Inject Hardhat Test Account #0 Private Key to have ETH for transactions
    await page.evaluate(() => {
        localStorage.setItem('web3combat_pk', '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    });
    // Reload to apply the private key
    await page.reload({ waitUntil: 'networkidle2' });
    
    // Wait for page to load
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Selecting a character...");
    await page.evaluate(() => {
        const firstChar = document.querySelector('.char-card');
        if (firstChar) {
            firstChar.click();
            document.getElementById('btn-confirm-char').click();
        }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
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
    
    // Check if the pool list has elements
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
