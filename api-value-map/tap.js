const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, 'dist', 'fal_value_map_standalone.html')).href;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#chart-t2i').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const pt = await page.evaluate(() => { const c = document.querySelector('#chart-t2i circle.pt-f'); const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, id: c.dataset.id }; });
  await page.touchscreen.tap(pt.x, pt.y);
  await page.waitForTimeout(250);
  const shown = await page.evaluate(() => { const t = document.querySelector('#chart-t2i .tip'); return t.style.display === 'none' ? null : t.innerText; });
  console.log('tooltip after tap:', JSON.stringify(shown));
  // tap outside the chart (on the page heading) should close it
  await page.touchscreen.tap(30, 20);
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => { const t = document.querySelector('#chart-t2i .tip'); return t.style.display === 'none'; });
  console.log('tooltip closed after tapping outside:', after);
  console.log('page errors:', JSON.stringify(errs));
  await browser.close();
})();
