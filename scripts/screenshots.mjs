// Takes README screenshots of a running preview (npm run build && npx vite preview).
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'docs/screenshots';
mkdirSync(out, { recursive: true });
const errors = [];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function session({ width, height, theme = 'light', mobile = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript((th) => {
    localStorage.setItem('gg-theme', JSON.stringify(th));
    localStorage.setItem('gg-mode', JSON.stringify('free'));
  }, theme);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  return { ctx, page };
}

/** Play a fixed free game by forcing the target through localStorage. */
async function playExample(page, guesses) {
  await page.evaluate(() => {
    localStorage.setItem('gg-free-normal', JSON.stringify({ target: 'poli1260', guesses: [], hints: [], status: 'playing' }));
  });
  await page.goto(base + '#/play', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.ac input');
  for (const q of guesses) {
    await page.fill('.ac input', q);
    await page.waitForTimeout(120);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1200);
}

{
  const { ctx, page } = await session({ width: 1280, height: 900 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await playExample(page, ['Swahili', 'Japanese', 'Hindi', 'German', 'Russian', 'Czech']);
  await page.screenshot({ path: `${out}/game-desktop.png` });
  await page.click('.tree .leaf-label >> nth=4');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/card-desktop.png` });
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 390, height: 844, theme: 'dark', mobile: true });
  await page.goto(base, { waitUntil: 'networkidle' });
  await playExample(page, ['Swahili', 'Japanese', 'Hindi', 'German', 'Russian', 'Czech']);
  await page.screenshot({ path: `${out}/game-mobile-dark.png`, fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 390, height: 844, mobile: true });
  await page.goto(base, { waitUntil: 'networkidle' });
  await playExample(page, ['Swahili', 'Hindi', 'Russian', 'Czech', 'Polish']);
  await page.screenshot({ path: `${out}/game-won-mobile.png`, fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 1100, height: 900 });
  await page.goto(base + '#/typology', { waitUntil: 'networkidle' });
  await page.click('text=Start');
  await page.waitForSelector('.option-btn');
  await page.click('.option-btn >> nth=0');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/typology.png`, fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await session({ width: 390, height: 844, theme: 'dark', mobile: true });
  await page.goto(base + '#/typology', { waitUntil: 'networkidle' });
  await page.click('text=Hard');
  await page.click('text=Start');
  await page.waitForSelector('.option-btn');
  await page.screenshot({ path: `${out}/typology-mobile-dark.png`, fullPage: true });
  await page.goto(base + '#/rules', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/rules-mobile-dark.png`, fullPage: true });
  await page.goto(base + '#/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/about-mobile-dark.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no browser errors');
