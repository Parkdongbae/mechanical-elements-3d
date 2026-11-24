// 물레방아 3D 모델 캡처 — 정지 자세 5개 × 시점 4개 + 물 320 L/s 재생 + 다크 3장 → shots/19-model-*.png
// 사용: node scripts/19-mill-model.mjs [only(장면 이름 일부)]   (dev 서버가 떠 있어야 한다. BASE_URL, WM_MODEL_ENTRY 로 바꿀 수 있음)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const entry = process.env.WM_MODEL_ENTRY ?? 'src/labs/mill/dev-model.html?';
const only = process.argv[2] ?? '';
mkdirSync('shots', { recursive: true });

const jobs = [];
const VIEWS = ['all', 'wheel', 'cam', 'pestle'];
for (const th of [100, 120, 132, 147, 42]) for (const v of VIEWS) jobs.push({ name: `19-model-th${th}-${v}`, qs: `wmth=${th}&wmview=${v}` });
for (const v of VIEWS) jobs.push({ name: `19-model-run320-${v}`, qs: `wmq=320&wmt=20&wmpause=1&wmview=${v}` });
jobs.push({ name: '19-model-run320-live-a', qs: 'wmq=320&wmt=20&wmview=all', wait: 1500 });
jobs.push({ name: '19-model-run320-live-b', qs: 'wmq=320&wmt=20&wmview=all', wait: 3000 });
jobs.push({ name: '19-model-run160-all', qs: 'wmq=160&wmt=20&wmpause=1&wmview=wheel' });
jobs.push({ name: '19-model-focus', qs: 'wmth=132&wmview=cam&wmfocus=arm1,beam1,pivot1' });
jobs.push({ name: '19-model-dark-all', qs: 'wmq=320&wmt=20&wmpause=1&wmview=all&theme=dark' });
jobs.push({ name: '19-model-dark-cam', qs: 'wmth=132&wmview=cam&theme=dark' });
jobs.push({ name: '19-model-dark-pestle', qs: 'wmth=147&wmview=pestle&theme=dark' });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
let bad = 0;
for (const j of jobs.filter((x) => x.name.includes(only))) {
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.goto(`${base}${entry}${j.qs}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
      await page.waitForTimeout(j.wait ?? 600);
      await page.screenshot({ path: `shots/${j.name}.png` });
      ok = errors.length === 0;
      console.log(`${ok ? 'ok  ' : 'ERR '} ${j.name}${errors.length ? '\n  ' + errors.join('\n  ') : ''}`);
    } catch (e) {
      console.log(`retry ${j.name}: ${String(e).split('\n')[0]}`);
    }
    await page.close();
  }
  if (!ok) bad++;
}
await browser.close();
process.exitCode = bad ? 1 : 0;
