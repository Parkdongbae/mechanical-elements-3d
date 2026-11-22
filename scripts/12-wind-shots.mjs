// 풍동 실험 캡처: node scripts/12-wind-shots.mjs <이름> [width] [height] [theme] [동작...]
// 동작: item=idx (예: mirror=2), preset=basic|aero, tab=drag|stab|noise, sub=force|corner|cross,
//       toggle=pressure|xray|ghost, save, speed=150, wait=ms, cam=x,y,z,tx,ty,tz
// dev 서버 HMR 리로드로 끊기면 처음부터 다시 시도한다.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { windPage } from './12-wind-base.mjs';

const [, , name = 'shot', w = '1280', h = '800', theme = 'light', ...acts] = process.argv;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
});
const errors = [];
for (let attempt = 0; attempt < 4; attempt++) {
  const page = await windPage(browser, { width: +w, height: +h }, `mode=wind&theme=${theme}${process.env.WIND_Q ?? ''}`);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text());
  });
  try {
    await page.waitForSelector('.wind-bar', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__flow = 1; });
    for (const a of acts) {
      const [k, v] = a.split('=');
      if (k === 'preset') await page.locator('.wind-presets .wind-btn', { hasText: v === 'aero' ? '공력 최적화' : '기본형' }).first().click();
      else if (k === 'tab') await page.locator(`#wind-tab-${v}`).click();
      else if (k === 'sub') await page.locator('.wind-seg-btn', { hasText: { force: '힘 보기', corner: '코너링', cross: '옆바람' }[v] }).click();
      else if (k === 'toggle') await page.locator('.wind-toggle', { hasText: { pressure: '압력', xray: '투시', ghost: '유선 겹치기' }[v] }).click();
      else if (k === 'save') await page.locator('.wind-btn', { hasText: 'A로 저장' }).click();
      else if (k === 'speed') await page.locator('#wind-speed').fill(v);
      else if (k === 'wait') await page.waitForTimeout(+v);
      else if (k === 'scroll') await page.evaluate((y) => document.querySelector('.wind-sheet')?.scrollTo(0, +y), v);
      else if (k === 'cam') {
        await page.evaluate(() => { /* 카메라는 OrbitControls 드래그 대신 debug 없이 생략 */ });
      } else await page.locator(`.wind-chip[data-item="${k}"][data-idx="${v}"]`).click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1800);
    const ok = await page.evaluate(() => window.__flow === 1);
    if (!ok) throw new Error('reloaded');
    await page.screenshot({ path: `shots/12-wind-${name}.png` });
    const info = await page.evaluate(() => {
      const d = window.__windDebug?.();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        cd: d?.cd, cl: d?.cl, db: d?.db
      };
    });
    console.log(name, JSON.stringify(info));
    await page.close();
    break;
  } catch (e) {
    console.log('retry:', String(e).slice(0, 160));
    await page.close();
  }
}
await browser.close();
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
