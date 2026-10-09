// Plays the built game in a real browser with the band's keys and saves a screenshot of each
// screen to .e2e-output/. Run after `npm run build`: node tests/e2e/run.mjs.
// CHROME_PATH=/path/to/chrome uses an installed Chrome instead of Playwright's Chromium;
// E2E_BROWSERS=chromium,firefox picks the engines (default: chromium, plus firefox if installed).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium, firefox} from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dist = path.join(root, 'dist');
const out = path.join(root, '.e2e-output');
fs.mkdirSync(out, {recursive: true});

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(dist, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(dist) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream'}).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

async function play(browserType, name) {
  const browser = await browserType.launch(process.env.CHROME_PATH && name === 'chromium' ? {executablePath: process.env.CHROME_PATH} : {});
  const page = await browser.newPage({viewport: {width: 480, height: 640}});
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(base)) external.push(r.url()); });

  await page.goto(`${base}?test=1&seed=42&lang=en`);
  await page.waitForFunction(() => window.__goat && document.fonts.status === 'loaded');
  await page.waitForTimeout(300);
  const state = () => page.evaluate(() => window.__goat.state());
  const shot = (file) => page.screenshot({path: path.join(out, `${name}-${file}.png`)});
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(80); };

  check(`${name}: title`, (await state()).screen === 'title');
  await shot('01-title');
  await key('Enter');
  check(`${name}: how to play`, (await state()).screen === 'howto');
  await shot('02-howto');
  await key('Escape');
  check(`${name}: back to the title`, (await state()).screen === 'title');

  await key('ArrowUp');
  check(`${name}: the climb starts`, (await state()).screen === 'playing');
  await key('ArrowRight');
  const airborne = await state();
  check(`${name}: a swipe makes the goat jump`, !airborne.onLedge);
  await page.waitForTimeout(1200);
  await shot('03-meadow');

  for (const [meters, file] of [[205, '04-forest'], [460, '05-cliffs'], [760, '06-snow'], [1110, '07-peak']]) {
    await page.evaluate((m) => { window.__goat.warp(m); window.__goat.step(0.5); }, meters);
    await page.waitForTimeout(150);
    const s = await state();
    check(`${name}: phase at ${meters} m`, s.phase === [205, 460, 760, 1110].indexOf(meters) + 2, `phase ${s.phase}`);
    await shot(file);
  }

  await key('Escape');
  check(`${name}: middle tap pauses`, (await state()).screen === 'paused');
  await shot('08-paused');
  await key('Enter');
  check(`${name}: index tap resumes`, (await state()).screen === 'playing');

  // Fall: no ledges left below.
  await page.evaluate(() => {
    const g = window.__goat.game;
    g.goat.on = null;
    g.world.ledges.length = 0;
  });
  await page.waitForFunction(() => window.__goat.state().screen === 'over', null, {timeout: 10000});
  const over = await state();
  check(`${name}: the fall ends the climb, with a record`, over.screen === 'over' && over.best > 0, `best ${over.best}`);
  await page.waitForTimeout(200);
  await shot('09-over');

  await page.reload();
  await page.waitForFunction(() => window.__goat);
  check(`${name}: the record is kept`, (await state()).best === over.best);

  await page.goto(`${base}?test=1&seed=42&lang=pt-PT`);
  await page.waitForFunction(() => window.__goat && document.fonts.status === 'loaded');
  await page.waitForTimeout(300);
  await shot('10-title-pt');

  check(`${name}: no page errors`, errors.length === 0, errors.join(' | '));
  check(`${name}: nothing loaded from outside the package`, external.length === 0, external.join(', '));
  await browser.close();
}

const wanted = (process.env.E2E_BROWSERS ?? 'chromium,firefox').split(',');
const engines = {chromium, firefox};
for (const name of wanted) {
  try {
    await play(engines[name], name);
  } catch (error) {
    if (name === 'firefox' && !process.env.E2E_BROWSERS && /Executable doesn't exist/.test(String(error))) {
      console.log('skip firefox (not installed)');
      continue;
    }
    console.log(`FAIL ${name}: ${error.message}`);
    failures++;
  }
}
server.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
