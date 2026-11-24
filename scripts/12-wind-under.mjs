// 하부 보기 복원 검증: node scripts/12-wind-under.mjs
// ① 미리보기: 켜기 → 카메라 아래 각도 제한 해제·공용 바닥 숨김 / 끄기 → 원래 값 복원
// ② 본 앱: #/lab/wind 에서 하부 보기를 켠 채로 미션(#/m/bicycle)으로 나가면 exit()가 제한·바닥을 되돌리는지
import { chromium } from 'playwright';

const BASE = process.env.WIND_URL ?? 'http://localhost:5273';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const state = () => {
  const d = window.__ctlRef;
  const ground = d.scene.children.filter((o) => o.type === 'GridHelper' || (o.isMesh && o.geometry?.type === 'CircleGeometry'));
  return { maxPolarDeg: +((d.controls.maxPolarAngle * 180) / Math.PI).toFixed(1), groundVisible: ground.map((g) => g.visible), camY: +d.controls.object.position.y.toFixed(2) };
};

for (let attempt = 0; attempt < 3; attempt++) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => errors.push(String(e)));
  try {
    await p.goto(`${BASE}/preview.html?mode=wind`, { waitUntil: 'load' });
    await p.waitForSelector('.wind-under-btn', { timeout: 15000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { window.__ctlRef = window.__windUnderDebug(); });
    console.log('preview 처음      ', JSON.stringify(await p.evaluate(state)));
    await p.locator('.wind-under-btn:visible').first().click();
    await p.waitForTimeout(1600);
    console.log('preview 하부 켬   ', JSON.stringify(await p.evaluate(state)));
    await p.locator('.wind-under-btn:visible').first().click();
    await p.waitForTimeout(1800);
    console.log('preview 하부 끔   ', JSON.stringify(await p.evaluate(state)));
    await p.close();

    const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    q.on('pageerror', (e) => errors.push(String(e)));
    await q.goto(`${BASE}/#/lab/wind`, { waitUntil: 'load' });
    await q.waitForSelector('.wind-under-btn', { timeout: 15000 });
    await q.waitForTimeout(1500);
    await q.evaluate(() => { window.__ctlRef = window.__windUnderDebug(); });
    await q.locator('.wind-under-btn:visible').first().click();
    await q.waitForTimeout(1600);
    console.log('app 하부 켬       ', JSON.stringify(await q.evaluate(state)));
    await q.evaluate(() => { location.hash = '#/m/bicycle'; });
    await q.waitForTimeout(2500);
    console.log('app 미션으로 나감 ', JSON.stringify(await q.evaluate(state)), 'wind DOM 남음:', await q.evaluate(() => !!document.querySelector('.wind-wrap')));
    await q.screenshot({ path: 'shots/12-wind-under-exit-mission.png' });
    await q.close();
    break;
  } catch (e) {
    console.log('retry:', String(e).slice(0, 200));
    await p.close().catch(() => {});
  }
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
