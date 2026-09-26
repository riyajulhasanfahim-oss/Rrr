const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    // Capture and print console messages
    page.on('console', msg => {
      console.log('PAGE LOG:', msg.type(), msg.text());
    });
    
    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      console.log('PAGE ERROR:', err.message);
      console.log('STACK:', err.stack);
    });

    console.log('Navigating to page...');
    // We don't wait for networkidle0, we just wait for domcontentloaded
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('Page loaded, waiting a bit...');
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
    console.log('Done.');
  } catch(e) {
    console.error('SCRIPT ERROR:', e);
  }
})();
