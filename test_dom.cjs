const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  
  // Wait a second for react to mount
  await new Promise(r => setTimeout(r, 1500));
  
  const content = await page.content();
  console.log(content);
  
  await browser.close();
})();
