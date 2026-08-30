import { chromium } from 'playwright';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8787';
const legacySeed = 'WW-BAJCHFZJVNQSNXP2T5XWH';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.locator('.bottom-nav [data-view="workshop"]').click();
await page.locator('#import-code').fill(legacySeed);
await page.locator('#import-btn').click();
await page.locator('#import-preview:not([hidden])').waitFor();
const preview = await page.locator('#import-preview').textContent();
if (!preview.includes('旧版 Seed 已兼容')) throw new Error(`legacy Seed was not recognized: ${preview}`);
await page.locator('#import-apply').click();
await page.locator('#view-create:not([hidden])').waitFor();
await page.locator('#copy-code').click();
const migrated = await page.evaluate(() => navigator.clipboard.readText());
if (!/^WX2-C-/.test(migrated)) throw new Error(`legacy Seed did not migrate to WX2-C: ${migrated}`);

await page.locator('#favorite').click();
let count = await page.evaluate(() => JSON.parse(localStorage.getItem('wsw:v2:atlas') || '[]').length);
if (count < 1) throw new Error('migrated work was not persisted to atlas');

await page.reload({ waitUntil: 'networkidle' });
await page.locator('.bottom-nav [data-view="atlas"]').click();
await page.locator('.atlas-card').first().waitFor();
count = await page.locator('.atlas-card').count();
if (count < 1) throw new Error('atlas did not survive reload');
if (errors.length) throw new Error(errors.join('\n'));

console.log(JSON.stringify({ legacySeed, migratedPrefix: migrated.slice(0, 12), atlasCardsAfterReload: count, errors }, null, 2));
await context.close();
await browser.close();
