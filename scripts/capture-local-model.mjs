import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = process.cwd();
const glbPath = path.resolve(process.argv[2] || path.join(root, 'assets-local', 'character-export', 'jiaran-test.glb'));
const outputDir = path.join(root, 'artifacts', 'local-model-qa', 'threejs');
const port = 4181;
const baseUrl = `http://127.0.0.1:${port}`;
const vitePath = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

await stat(glbPath);
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

const browserErrors = [];
let browser;

async function openWithLocalModel(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__RANRAN_MEADOW__?.characterManager);
  await page.setInputFiles('#local-model-input', glbPath);
  await page.waitForFunction(() => window.__RANRAN_MEADOW__.characterManager.mode === 'local-glb', null, { timeout: 45_000 });
  await page.waitForSelector('#model-status[data-state="success"]');
  await page.evaluate(() => {
    document.querySelector('#loading-screen').style.display = 'none';
    window.__RANRAN_MEADOW__.controls.autoRotate = false;
  });
  await page.waitForTimeout(1_200);
}

async function preset(page, name, characterMode) {
  await page.evaluate(({ presetName, qa }) => {
    document.body.dataset.qa = qa ? 'character' : '';
    window.__RANRAN_MEADOW__.setCameraPreset(presetName);
    window.__RANRAN_MEADOW__.butterfly.visible = presetName !== 'face';
  }, { presetName: name, qa: characterMode });
  await page.waitForTimeout(350);
}

async function capture(page, filename, name, characterMode = true) {
  await preset(page, name, characterMode);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: true });
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
  const page = await desktop.newPage();
  await openWithLocalModel(page);
  await capture(page, 'meadow-hero.png', 'hero', false);
  await page.setViewportSize({ width: 900, height: 900 });
  await capture(page, 'character-front.png', 'front');
  await capture(page, 'character-side.png', 'side');
  await capture(page, 'character-back.png', 'back');
  await capture(page, 'character-face.png', 'face');
  const metrics = await page.evaluate(() => window.__RANRAN_MEADOW__.measureCharacter());
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  await openWithLocalModel(mobilePage);
  await capture(mobilePage, 'meadow-mobile.png', 'mobile', false);
  await mobile.close();

  const report = {
    glb: glbPath,
    metrics,
    browserErrors: [...new Set(browserErrors)],
    screenshots: [
      'meadow-hero.png',
      'character-front.png',
      'character-side.png',
      'character-back.png',
      'character-face.png',
      'meadow-mobile.png'
    ]
  };
  await writeFile(path.join(outputDir, 'threejs-local-model-report.json'), JSON.stringify(report, null, 2), 'utf8');
  if (report.browserErrors.length) throw new Error(`Browser errors detected:\n${report.browserErrors.join('\n')}`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
