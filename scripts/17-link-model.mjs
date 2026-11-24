// 링크 장치 3D 모델 캡처 — 11개 기구 × (정면 2자세 + 기울임 1장) + 다크 2장 → shots/17-model-*.png
// 사용: node scripts/17-link-model.mjs [only(기구 id 일부)]   (dev 서버가 떠 있어야 한다. BASE_URL, LK_MODEL_ENTRY 로 바꿀 수 있음)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const entry = process.env.LK_MODEL_ENTRY ?? 'src/labs/linkage/dev-model.html?';
const only = process.argv[2] ?? '';
mkdirSync('shots', { recursive: true });

// [기구 id, 정면 자세 1, 정면 자세 2, 기울임 자세]
const SCENES = [
  ['crank-rocker', 'lkq=60', 'lkq=240', 'lkq=150'],
  ['parallel', 'lkq=45', 'lkq=200', 'lkq=120'],
  ['steering', 'lkq=-54.53', 'lkq=-104.53', 'lkq=-74.53'],
  ['slider-crank', 'lkq=0', 'lkq=90', 'lkq=200'],
  ['quick-return', 'lkq=330', 'lkq=210', 'lkq=90'],
  ['chebyshev', 'lkq=45', 'lkq=85', 'lkq=60'],
  ['watt', 'lkq=-15', 'lkq=15', 'lkq=0'],
  ['pantograph', 'lkq=0:0.25', 'lkq=1:0.6', 'lkq=2:0.3'],
  ['jansen', 'lkq=0', 'lkq=180', 'lkq=90'],
  ['gripper', 'lkq=1.5', 'lkq=2.5', 'lkq=2'],
  ['custom', 'lkdim=5,4,6,10&lkq=75', 'lkdim=2,3,3,10', 'lkdim=3,9,7,10&lkq=120']
];
const DARK = [
  ['jansen', 'lkq=180'],
  ['custom', 'lkdim=2,3,3,10']
];

const jobs = [];
for (const [id, a, b, c] of SCENES) {
  jobs.push({ id, qs: a, name: `17-model-${id}-1`, extra: '' });
  jobs.push({ id, qs: b, name: `17-model-${id}-2`, extra: '' });
  jobs.push({ id, qs: c, name: `17-model-${id}-tilt`, extra: '&tilt=1&lkfull=1' });
}
for (const [id, a] of DARK) jobs.push({ id, qs: a, name: `17-model-${id}-dark`, extra: '&theme=dark&tilt=1' });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
let bad = 0;
for (const j of jobs.filter((x) => x.id.includes(only))) {
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.goto(`${base}${entry}lk=${j.id}&${j.qs}${j.extra}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
      await page.waitForTimeout(500);
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
