// Render the built page in Chromium, capture screenshots and report problems.
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const HERE = __dirname;
const PAGE = require('url').pathToFileURL(path.join(HERE, 'dist', 'fal_value_map_standalone.html')).href;
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const TABS = ['t2i', 'edit', 't2v', 'i2v', 'tts', 'plan'];

(async () => {
  const exe = process.env.CHROME_PATH || undefined; // undefined = Playwright's own Chromium
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const problems = [];

  async function open(opts) {
    const ctx = await browser.newContext({
      viewport: opts.viewport, colorScheme: opts.scheme || 'light', deviceScaleFactor: opts.dsf || 1,
    });
    // stub the artifact runtime so the download wiring can be exercised
    await ctx.addInitScript(() => {
      window.__saved = [];
      window.claude = {
        use: async (n) => n === 'downloads'
          ? { save: async (o) => { window.__saved.push(o); return { status: 'saved' }; } } : null,
      };
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`[${opts.name}] console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`[${opts.name}] pageerror: ${e.message}\n${e.stack}`));
    page.on('requestfailed', (r) => { if (!/fonts\.g/.test(r.url())) problems.push(`[${opts.name}] requestfailed: ${r.url()}`); });
    await page.goto(PAGE, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    return { ctx, page };
  }

  async function overflow(page, name) {
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (o.sw > o.cw + 1) problems.push(`[${name}] horizontal page overflow: scrollWidth ${o.sw} > clientWidth ${o.cw}`);
    return o;
  }

  // ---- desktop light: every tab
  {
    const { ctx, page } = await open({ name: 'desktop-light', viewport: { width: 1280, height: 900 } });
    for (const t of TABS) {
      await page.click('#tab-' + t);
      await page.waitForTimeout(250);
      await overflow(page, 'desktop-light/' + t);
      await page.screenshot({ path: path.join(SHOTS, `desktop-${t}.png`), fullPage: true });
    }
    await ctx.close();
  }

  // ---- desktop dark: images + planner
  {
    const { ctx, page } = await open({ name: 'desktop-dark', viewport: { width: 1280, height: 900 }, scheme: 'dark' });
    for (const t of ['t2i', 'plan']) {
      await page.click('#tab-' + t);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(SHOTS, `dark-${t}.png`), fullPage: true });
    }
    await ctx.close();
  }

  // ---- phone: images, video, planner
  {
    const { ctx, page } = await open({ name: 'phone', viewport: { width: 390, height: 844 }, dsf: 2 });
    for (const t of ['t2i', 't2v', 'plan']) {
      await page.click('#tab-' + t);
      await page.waitForTimeout(250);
      await overflow(page, 'phone/' + t);
      await page.screenshot({ path: path.join(SHOTS, `phone-${t}.png`), fullPage: true });
    }
    await ctx.close();
  }

  // ---- behaviour checks (desktop)
  {
    const { ctx, page } = await open({ name: 'behaviour', viewport: { width: 1280, height: 900 } });
    // 1. hover the best-value dot and read the tooltip
    await page.click('#tab-t2i');
    await page.waitForTimeout(200);
    const pt = await page.evaluate(() => {
      const c = document.querySelector('#chart-t2i circle.pt-f');
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, id: c.dataset.id };
    });
    await page.mouse.move(pt.x + 3, pt.y + 2);
    await page.waitForTimeout(150);
    const tip = await page.evaluate(() => { const t = document.querySelector('#chart-t2i .tip'); return t.style.display === 'none' ? null : t.innerText; });
    console.log('tooltip text:', JSON.stringify(tip));
    if (!tip) problems.push('tooltip did not show on hover');
    await page.screenshot({ path: path.join(SHOTS, 'hover-t2i.png'), clip: { x: 0, y: 380, width: 1280, height: 620 } });

    // 2. click selects, table row expands
    await page.mouse.click(pt.x + 3, pt.y + 2);
    await page.waitForTimeout(150);
    const detail = await page.evaluate(() => !!document.querySelector('#tbl-t2i tr.detail'));
    console.log('detail row shown after chart click:', detail);
    if (!detail) problems.push('clicking a chart dot did not expand its table row');
    await page.screenshot({ path: path.join(SHOTS, 'select-t2i.png'), fullPage: true });

    // 3. "best value only" and "label every model"
    await page.click('#f-show button[data-v="value"]');
    await page.waitForTimeout(200);
    const nrows = await page.evaluate(() => document.querySelectorAll('#tbl-t2i tr.row').length);
    console.log('rows with best-value filter:', nrows);
    await page.screenshot({ path: path.join(SHOTS, 'valueonly-t2i.png'), clip: { x: 0, y: 380, width: 1280, height: 620 } });
    await page.click('#f-show button[data-v="all"]');
    await page.check('#labelAll');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'labelall-t2i.png'), clip: { x: 0, y: 380, width: 1280, height: 620 } });
    await page.uncheck('#labelAll');

    // 4. budget input changes "my budget buys"
    await page.fill('#budget', '50');
    await page.waitForTimeout(150);
    const buys = await page.evaluate(() => document.querySelector('#tbl-t2i tr.row td:nth-child(5)').innerText);
    console.log('first row buys @ $50:', buys);

    // 5. sort by quality
    await page.click('#tbl-t2i th button[data-sort="elo"]');
    const firstName = await page.evaluate(() => document.querySelector('#tbl-t2i tr.row .mname').innerText);
    console.log('top row after sorting by quality:', firstName);

    // 6. downloads: stubbed capability
    const dlVisible = await page.evaluate(() => !document.querySelector('#dl').hidden);
    console.log('download buttons visible with stubbed capability:', dlVisible);
    await page.click('#dl button[data-fmt="csv"]');
    await page.click('#dl button[data-fmt="json"]');
    await page.waitForTimeout(150);
    const saved = await page.evaluate(() => window.__saved.map((s) => ({ filename: s.filename, len: s.data.length, head: s.data.slice(0, 160) })));
    console.log('saved:', JSON.stringify(saved, null, 1));
    const csvLines = await page.evaluate(() => window.__saved[0].data.trim().split('\n').length);
    console.log('csv lines (header + rows, rows with embedded newlines excluded):', csvLines);
    const jsonOk = await page.evaluate(() => { try { const o = JSON.parse(window.__saved[1].data); return Object.keys(o.categories).map((k) => k + ':' + o.categories[k].models.length).join(' '); } catch (e) { return 'BAD JSON ' + e.message; } });
    console.log('json parse:', jsonOk);

    // 7. planner: change a model and the volume, check the total updates and the over-budget state
    await page.click('#tab-plan');
    await page.waitForTimeout(200);
    const t0 = await page.evaluate(() => document.querySelector('#p-total').innerText);
    await page.fill('#pv-t2v', '600');
    await page.waitForTimeout(150);
    const t1 = await page.evaluate(() => ({ total: document.querySelector('#p-total').innerText, status: document.querySelector('#p-status').innerText, left: document.querySelector('#p-left').innerText, per: document.querySelector('#p-peruser').innerText }));
    console.log('planner before:', t0, ' after 600s of text-to-video:', JSON.stringify(t1));
    await page.screenshot({ path: path.join(SHOTS, 'plan-over.png'), fullPage: true });

    // 7b. presets
    for (const k of ['budget', 'value', 'top']) {
      await page.click(`.presets .btn[data-preset="${k}"]`);
      await page.waitForTimeout(100);
      const r = await page.evaluate(() => ({
        total: document.querySelector('#p-total').innerText,
        models: ['t2i', 'edit', 't2v', 'i2v', 'tts'].map((c) => document.querySelector('#pm-' + c).selectedOptions[0].text.replace(/ \(.*$/, '')).join(' | '),
        pressed: [...document.querySelectorAll('.presets .btn')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.preset).join(','),
      }));
      console.log('preset', k, JSON.stringify(r));
    }
    await page.screenshot({ path: path.join(SHOTS, 'plan-presets.png'), fullPage: true });

    // 8. keyboard: arrow keys move between tabs
    await page.focus('#tab-plan');
    await page.keyboard.press('ArrowRight');
    const tabAfter = await page.evaluate(() => document.querySelector('[role=tab][aria-selected=true]').id);
    console.log('tab after ArrowRight from planner (should wrap to Images):', tabAfter);
    await ctx.close();
  }

  console.log('\nPROBLEMS (' + problems.length + '):');
  problems.forEach((p) => console.log(' -', p));
  await browser.close();
})().catch((e) => { console.error('SCRIPT FAILED', e); process.exit(1); });
