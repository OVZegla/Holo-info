// Captures de contrôle : node tools/screenshots.mjs [url] [dossier]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'scratch/shots';
import fs from 'node:fs';
fs.mkdirSync(out, { recursive: true });
const plan = JSON.parse(process.env.SHOTS || '[]');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.addInitScript(() => { window.__HOLO_TEST__ = true; });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(4000);
const shoot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
for (const step of plan) {
  if (step.eval) await page.evaluate(step.eval);
  if (step.click) await page.click(step.click);
  if (step.wait) await page.waitForTimeout(step.wait);
  if (step.shot) await shoot(step.shot);
}
console.log(errors.slice(0, 30).join('\n') || 'no console errors');
await browser.close();
