// 홈 화면 캡처(테마·폭 지정, 전체 스크롤). 사용: node scripts/home-shot.mjs [light|dark] [w] [h] [out]
import { chromium } from 'playwright';
const [, , theme = 'light', w = '1280', h = '800', out = `shots/home-${theme}-${w}.png`] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.addInitScript((t) => {
  localStorage.setItem('mech3d-settings-v1', JSON.stringify({ difficulty: 'medium', sound: false, showLabels: true, theme: t, quality: 'high' }));
  localStorage.setItem('mech3d-progress-v2', JSON.stringify({ last: 'treadmill', machines: { bicycle: { installed: 6, completedOnce: true }, clock: { installed: 2, completedOnce: true }, treadmill: { installed: 1, completedOnce: false } } }));
}, theme);
await page.goto('http://localhost:5173/');
await page.waitForTimeout(2500);
// 홈은 내부 스크롤 컨테이너 — 전체를 찍기 위해 뷰포트를 콘텐츠 높이로 늘린다
const full = await page.evaluate(() => document.querySelector('#home .home-inner').scrollHeight);
await page.setViewportSize({ width: Number(w), height: Math.min(full, 4000) });
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
