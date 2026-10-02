// Geometry audit of the charts: labels must not sit on the best-value line, on each other, or on other dots.
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, 'dist', 'fal_value_map_standalone.html')).href;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'],
  });
  let bad = 0;
  for (const width of [1280, 900, 600, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(PAGE, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    for (const cat of ['t2i', 'edit', 't2v', 'i2v', 'tts']) {
      for (const labelAll of [false, true]) {
        await page.click('#tab-' + cat);
        if ((await page.isChecked('#labelAll')) !== labelAll) await page.click('#labelAll');
        await page.waitForTimeout(120);
        const r = await page.evaluate((cat) => {
          const svg = document.querySelector('#chart-' + cat + ' svg');
          const labs = [...svg.querySelectorAll('text.lab')].map((t) => { const b = t.getBBox(); return { t: t.textContent, x: b.x, y: b.y + 2, w: b.width, h: b.height - 4 }; });
          const dots = [...svg.querySelectorAll('circle.pt-f, circle.pt-d')].map((c) => ({ id: c.dataset.id, cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), r: +c.getAttribute('r') }));
          const d = svg.querySelector('.stair-line').getAttribute('d');
          const nums = d.replace(/[ML]/g, ' ').trim().split(/\s+/).map((p) => p.split(',').map(Number));
          const segs = []; for (let i = 0; i + 1 < nums.length; i++) segs.push([nums[i], nums[i + 1]]);
          const hitSeg = (b, s) => {
            const [[x1, y1], [x2, y2]] = s;
            const minx = Math.min(x1, x2) - 1, maxx = Math.max(x1, x2) + 1, miny = Math.min(y1, y2) - 1, maxy = Math.max(y1, y2) + 1;
            return minx < b.x + b.w && maxx > b.x && miny < b.y + b.h && maxy > b.y;
          };
          const out = { labels: labs.length, onLine: [], overlap: [], onDot: [], clipped: [] };
          const W = svg.viewBox.baseVal.width;
          labs.forEach((b, i) => {
            if (segs.some((s) => hitSeg(b, s))) out.onLine.push(b.t);
            labs.forEach((c, j) => { if (j > i && b.x < c.x + c.w && b.x + b.w > c.x && b.y < c.y + c.h && b.y + b.h > c.y) out.overlap.push(b.t + ' / ' + c.t); });
            dots.forEach((q) => { if (q.cx + q.r > b.x && q.cx - q.r < b.x + b.w && q.cy + q.r > b.y && q.cy - q.r < b.y + b.h) out.onDot.push(b.t + ' on ' + q.id); });
            if (b.x < 0 || b.x + b.w > W) out.clipped.push(b.t);
          });
          return out;
        }, cat);
        const flag = r.onLine.length + r.overlap.length + r.onDot.length + r.clipped.length;
        if (flag) bad++;
        console.log(`w${width} ${cat}${labelAll ? '+all' : ''}: ${r.labels} labels` + (flag ? ' PROBLEMS ' + JSON.stringify({ onLine: r.onLine, overlap: r.overlap, onDot: r.onDot, clipped: r.clipped }) : ' ok'));
      }
    }
    await ctx.close();
  }
  console.log('charts with label problems:', bad);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
