// 미션 UI 흐름 캡처: 트레이 열기 → 오답 → 정답 → 완료. 사용: node scripts/ui-flow.mjs [machineId] [theme] [w] [h]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , id = 'treadmill', theme = 'light', w = '1280', h = '800'] = process.argv;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
await page.addInitScript((t) => {
  localStorage.setItem('mech3d-settings-v1', JSON.stringify({ difficulty: 'low', sound: false, showLabels: true, theme: t, quality: 'high' }));
  localStorage.removeItem('mech3d-progress-v2');
}, theme);
await page.goto('http://localhost:5173/#/m/' + id);
await page.waitForTimeout(3500);
const tag = `shots/flow-${id}-${theme}-${w}`;
const steps = await page.evaluate(async (mid) => {
  const m = await import('/src/data/machines.ts');
  const e = await import('/src/data/elements.ts');
  return m.getMachineDef(mid).steps.map((s) => ({ cat: e.getPart(s.partId).category, name: (m.getMachineDef(mid).nameOverrides ?? {})[s.partId] ?? e.getPart(s.partId).name }));
}, id);
let n = 0;
for (const st of steps) {
  await page.click(`.cat-btn[data-cat="${st.cat}"]`);
  await page.waitForTimeout(500);
  if (n === 0) await page.screenshot({ path: `${tag}-1tray.png` });
  await page.click(`.part-card:has-text("${st.name}")`);
  await page.waitForTimeout(n === steps.length - 1 ? 5000 : 3500);
  await page.screenshot({ path: `${tag}-${n + 2}step.png` });
  n++;
}
await browser.close();
console.log('done', tag, errors.length ? 'ERRORS:\n' + errors.join('\n') : '');
