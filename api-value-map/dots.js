const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, 'dist', 'fal_value_map_standalone.html')).href;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  for (const width of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(PAGE, { waitUntil: 'load' });
    for (const cat of ['t2i', 'edit', 't2v', 'i2v', 'tts']) {
      await page.click('#tab-' + cat);
      await page.waitForTimeout(100);
      const r = await page.evaluate((cat) => {
        const dots = [...document.querySelectorAll('#chart-' + cat + ' svg circle.pt-f, #chart-' + cat + ' svg circle.pt-d')].map((c) => ({ id: c.dataset.id, x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') }));
        const bad = [];
        for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
          const d = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y);
          if (d < dots[i].r + dots[j].r) bad.push(dots[i].id + ' ~ ' + dots[j].id + ' d=' + d.toFixed(1));
        }
        return { n: dots.length, bad, note: document.querySelector('#nudge-' + cat).textContent.trim().slice(0, 40) };
      }, cat);
      console.log(`w${width} ${cat}: ${r.n} dots, overlapping pairs: ${JSON.stringify(r.bad)} note="${r.note}"`);
    }
    await ctx.close();
  }
  await browser.close();
})();
