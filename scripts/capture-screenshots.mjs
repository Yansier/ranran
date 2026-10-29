import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = process.cwd();
const outputDir = path.join(root, 'artifacts', 'screenshots');
const port = 4177;
const baseUrl = `http://127.0.0.1:${port}`;
const vitePath = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

await mkdir(outputDir, { recursive: true });

const server = spawn(process.execPath, [vitePath, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer(timeout = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not become ready.\n${serverLog}`);
}

let browser;
const browserErrors = [];

async function openScene(page, preset, qaMode = false) {
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__RANRAN_MEADOW__?.ranran, null, { timeout: 20_000 });
  await page.waitForSelector('#loading-screen.hidden', { state: 'attached' });
  await page.evaluate(({ presetName, characterMode }) => {
    document.body.dataset.qa = characterMode ? 'character' : '';
    document.querySelector('#loading-screen').style.display = 'none';
    window.__RANRAN_MEADOW__.setCameraPreset(presetName);
    if (presetName === 'face') window.__RANRAN_MEADOW__.butterfly.visible = false;
  }, { presetName: preset, characterMode: qaMode });
  await page.waitForTimeout(1_050);
}

async function capture(context, filename, preset, qaMode = false) {
  const page = await context.newPage();
  await openScene(page, preset, qaMode);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: true });
  await page.close();
  console.log(`captured ${filename}`);
}

try {
  await waitForServer();
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader']
  });

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await capture(desktop, 'hero-desktop.png', 'hero');
  await desktop.close();

  const character = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
  await capture(character, 'character-front.png', 'front', true);
  await capture(character, 'character-side.png', 'side', true);
  await capture(character, 'character-back.png', 'back', true);
  await capture(character, 'character-face-closeup.png', 'face', true);
  await character.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await capture(mobile, 'hero-mobile.png', 'mobile');
  await mobile.close();

  const reduced = await browser.newContext({ viewport: { width: 800, height: 600 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await openScene(reducedPage, 'hero');
  const autoRotate = await reducedPage.evaluate(() => window.__RANRAN_MEADOW__.controls.autoRotate);
  if (autoRotate) throw new Error('prefers-reduced-motion did not disable camera auto-rotation.');
  await reduced.close();
  console.log('verified prefers-reduced-motion');

  const metricsPage = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await openScene(metricsPage, 'front', true);
  const metrics = await metricsPage.evaluate(() => window.__RANRAN_MEADOW__.measureCharacter());
  await metricsPage.close();
  console.log(`character metrics height=${metrics.height.toFixed(3)} head=${metrics.headHeight.toFixed(3)} ratio=${metrics.headRatio.toFixed(2)}`);

  if (browserErrors.length) {
    throw new Error(`Browser errors detected:\n${[...new Set(browserErrors)].join('\n')}`);
  }
  console.log(`Screenshots saved to ${outputDir}`);
} finally {
  await browser?.close();
  server.kill();
}
