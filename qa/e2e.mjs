import { chromium } from 'playwright';
import fs from 'node:fs';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8787';
const outDir = 'qa/e2e-artifacts';
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: '320', width: 320, height: 760 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
];

const report = { startedAt: new Date().toISOString(), cases: [], deep: null };
const browser = await chromium.launch({ headless: true });

async function newPage(viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await context.addInitScript(() => {
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__longTasks.push(entry.duration);
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return { context, page, errors };
}

async function drawStroke(page) {
  const box = await page.locator('#stage-canvas').boundingBox();
  if (!box) throw new Error('stage canvas has no bounding box');
  const points = [
    [0.18, 0.66], [0.23, 0.58], [0.29, 0.49], [0.36, 0.41],
    [0.44, 0.37], [0.52, 0.39], [0.60, 0.46], [0.67, 0.55],
    [0.73, 0.62], [0.80, 0.64]
  ];
  await page.mouse.move(box.x + box.width * points[0][0], box.y + box.height * points[0][1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 2 });
  }
  const t0 = Date.now();
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('#result-meta')?.hidden === false, null, { timeout: 2500 });
  return Date.now() - t0;
}

for (const viewport of viewports) {
  const { context, page, errors } = await newPage(viewport);
  const item = { viewport, errors, overflow: null, firstResultMs: null, fingerprint: null, maxLongTaskMs: 0 };
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.locator('#stage-canvas').waitFor({ state: 'visible' });
    item.overflow = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    if (item.overflow.scrollWidth > item.overflow.innerWidth + 1 || item.overflow.bodyScrollWidth > item.overflow.innerWidth + 1) {
      throw new Error(`horizontal overflow at ${viewport.width}px: ${JSON.stringify(item.overflow)}`);
    }
    item.firstResultMs = await drawStroke(page);
    if (item.firstResultMs > 2000) throw new Error(`first result too slow: ${item.firstResultMs}ms`);
    item.fingerprint = (await page.locator('#fingerprint').textContent())?.trim();
    if (!item.fingerprint || item.fingerprint === '-----') throw new Error('fingerprint was not generated');
    const codeBefore = await page.locator('#copy-code').click().then(() => page.evaluate(() => navigator.clipboard.readText()));
    if (!/^WX2-C-/.test(codeBefore)) throw new Error(`composition code missing: ${codeBefore.slice(0, 32)}`);
    await page.screenshot({ path: `${outDir}/mobile-${viewport.name}.png`, fullPage: true });
    const longTasks = await page.evaluate(() => window.__longTasks || []);
    item.maxLongTaskMs = longTasks.length ? Math.max(...longTasks) : 0;
    if (errors.length) throw new Error(errors.join('\n'));
  } catch (error) {
    item.failure = error.stack || String(error);
  } finally {
    report.cases.push(item);
    await context.close();
  }
}

// Deep interaction flow on the primary 375px target.
{
  const { context, page, errors } = await newPage({ width: 375, height: 812 });
  const deep = { errors, steps: [], maxLongTaskMs: 0 };
  const step = (name) => deep.steps.push(name);
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await drawStroke(page);
    step('draw -> pointer-up -> auto growth');

    await page.locator('[data-sheet="motif"]').click();
    await page.locator('#bottom-sheet.open').waitFor();
    await page.locator('[data-motif="petal"]').click();
    if ((await page.locator('#quick-motif').textContent())?.trim() !== '莲瓣') throw new Error('motif switch did not apply');
    await page.locator('#close-sheet').click();
    step('motif quick switch');

    await page.locator('[data-sheet="rule"]').click();
    await page.locator('#create-rule').click();
    await page.locator('[data-r="layout"]').selectOption('tile');
    await page.locator('[data-r="repeat"]').evaluate((el) => { el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#rule-save').click();
    const rulesSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('wsw:v2:components') || '[]').filter((x) => x.kind === 'R').length);
    if (rulesSaved < 1) throw new Error('custom rule was not saved');
    step('custom rule + live apply + local save');

    await page.locator('[data-sheet="palette"]').click();
    await page.locator('#create-palette').click();
    await page.locator('#auto-palette').click();
    await page.locator('#palette-save').click();
    const palettesSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('wsw:v2:components') || '[]').filter((x) => x.kind === 'P').length);
    if (palettesSaved < 1) throw new Error('custom palette was not saved');
    step('curated instant palette + local save');

    await page.locator('[data-sheet="motif"]').click();
    await page.locator('#create-motif').click();
    const motifCanvas = page.locator('#motif-canvas');
    const mb = await motifCanvas.boundingBox();
    if (!mb) throw new Error('motif editor canvas missing');
    await page.mouse.move(mb.x + mb.width * .25, mb.y + mb.height * .65);
    await page.mouse.down();
    for (const [x, y] of [[.35,.45],[.5,.3],[.65,.45],[.75,.65]]) await page.mouse.move(mb.x + mb.width*x, mb.y + mb.height*y, { steps: 2 });
    await page.mouse.up();
    await page.locator('#motif-save').click();
    const motifsSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('wsw:v2:components') || '[]').filter((x) => x.kind === 'M').length);
    if (motifsSaved < 1) throw new Error('custom motif was not saved');
    step('custom motif draw + live tiled preview + local save');

    await page.locator('#favorite').click();
    const atlasSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('wsw:v2:atlas') || '[]').length);
    if (atlasSaved < 1) throw new Error('favorite did not enter atlas');
    step('favorite -> atlas');

    await page.locator('#copy-code').click();
    const compositionCode = await page.evaluate(() => navigator.clipboard.readText());
    if (!/^WX2-C-/.test(compositionCode)) throw new Error('copy composition code failed');
    step('copy composition WX2 code');

    await page.locator('[data-sheet="share"]').click();
    await page.locator('#share-challenge').click();
    const challengeText = await page.evaluate(() => navigator.clipboard.readText());
    if (!challengeText.includes('WX2-H-') || !challengeText.includes('同笔不同纹')) throw new Error('challenge share text missing WX2-H code');
    await page.locator('#close-sheet').click();
    step('same-stroke challenge share');

    await page.locator('.bottom-nav [data-view="workshop"]').click();
    await page.locator('#import-code').fill(compositionCode);
    await page.locator('#import-btn').click();
    await page.locator('#import-preview:not([hidden])').waitFor();
    await page.locator('#import-apply').click();
    await page.locator('#view-create:not([hidden])').waitFor();
    step('import composition -> immediate Remix');

    // Exercise real export/download path once.
    await page.locator('[data-sheet="share"]').click();
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
    await page.locator('#share-work').click();
    const download = await downloadPromise;
    if (!download.suggestedFilename().endsWith('.png')) throw new Error('export did not produce PNG');
    step('900x1200 PNG export');

    await page.screenshot({ path: `${outDir}/deep-375.png`, fullPage: true });
    const longTasks = await page.evaluate(() => window.__longTasks || []);
    deep.maxLongTaskMs = longTasks.length ? Math.max(...longTasks) : 0;
    if (errors.length) throw new Error(errors.join('\n'));
  } catch (error) {
    deep.failure = error.stack || String(error);
  } finally {
    report.deep = deep;
    await context.close();
  }
}

await browser.close();
report.finishedAt = new Date().toISOString();
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const failures = [...report.cases.filter((x) => x.failure).map((x) => x.failure), report.deep?.failure].filter(Boolean);
if (failures.length) process.exit(1);
