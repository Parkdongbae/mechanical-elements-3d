// 자동차 기어 변속 실험 조작 캡처: node scripts/11-car-flow.mjs [width] [height] [theme]
// 수동: 클러치 → 1단 → 출발 → 2~5단 올림, 클러치 없이 변속 시도(경고), 자동: D → 가속.
// dev 서버 HMR 리로드로 끊기면 처음부터 다시 시도한다.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light'] = process.argv;
const tag = `${w}-${theme}`;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];

async function open() {
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, hasTouch: false });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text());
  });
  await page.goto(`http://localhost:5273/preview.html?mode=car&theme=${theme}`, { waitUntil: 'load' });
  await page.waitForSelector('.car-cockpit', { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__flow = 1; });
  return page;
}

async function readout(p, label) {
  const v = await p.evaluate(() => {
    if (!window.__flow) return null;
    const q = (s) => document.querySelector(s)?.textContent?.trim() ?? '';
    return {
      rpm: q('.car-tach .car-g-readout'),
      kmh: q('.car-speedo .car-g-readout'),
      gear: q('.car-gear-big'),
      sub: q('.car-gear-sub'),
      calc: [...document.querySelectorAll('.car-calc-row')].map((r) => r.textContent).join(' | '),
      coach: q('.car-coach-title'),
      alert: document.querySelector('.car-alert.is-on')?.textContent ?? ''
    };
  });
  if (!v) throw new Error('page reloaded (HMR)');
  console.log(label.padEnd(14), JSON.stringify(v));
}

async function hold(p, sel, ms, shot) {
  const box = await p.locator(sel).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(ms);
  if (shot) await p.screenshot({ path: shot });
  await p.mouse.up();
}

const tap = (p, sel) => p.locator(sel).click();
const gearBtn = (g) => `.car-hshift-pos:text-is("${g}")`;

for (let attempt = 0; attempt < 4; attempt++) {
  const p = await open();
  try {
    await p.screenshot({ path: `shots/11-car-m0-${tag}.png` });
    // 클러치 없이 3단 → 경고
    await tap(p, gearBtn('3'));
    await p.waitForTimeout(300);
    await readout(p, 'no-clutch');
    await p.screenshot({ path: `shots/11-car-m0b-noclutch-${tag}.png` });
    // 클러치 밟기(한 번 누르기 = 밟힌 채) → 1단
    await tap(p, '.is-clutch');
    await p.waitForTimeout(400);
    await tap(p, gearBtn('1'));
    await p.waitForTimeout(500);
    await readout(p, 'gear1');
    await p.screenshot({ path: `shots/11-car-m1-gear1-${tag}.png` });
    // 클러치 떼기(천천히) → 가속
    await tap(p, '.is-clutch');
    await p.waitForTimeout(1500);
    await readout(p, 'launch');
    await hold(p, '.is-accel', 2600, `shots/11-car-m2-accel1-${tag}.png`);
    await readout(p, '1st-accel');
    for (const g of ['2', '3', '4', '5']) {
      await tap(p, '.is-clutch');
      await p.waitForTimeout(250);
      await tap(p, gearBtn(g));
      await p.waitForTimeout(250);
      if (g === '2') await p.screenshot({ path: `shots/11-car-m3-shift2-${tag}.png` });
      await tap(p, '.is-clutch');
      await p.waitForTimeout(1400);
      await readout(p, `in-${g}`);
      await hold(p, '.is-accel', g === '5' ? 4000 : 2800, `shots/11-car-m4-gear${g}-${tag}.png`);
      await readout(p, `${g}-accel`);
    }
    // 브레이크로 세우기(클러치 없이) → 시동 꺼짐
    await hold(p, '.is-brake', 7000);
    await p.waitForTimeout(300);
    await readout(p, 'brake-stop');
    await p.screenshot({ path: `shots/11-car-m5-stall-${tag}.png` });

    // 자동
    await p.locator('.car-seg-btn', { hasText: '자동 변속기' }).click();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `shots/11-car-a0-${tag}.png` });
    await p.locator('.car-prnd-btn', { hasText: 'D' }).click();
    await p.waitForTimeout(800);
    await readout(p, 'auto-D');
    await p.screenshot({ path: `shots/11-car-a1-D-${tag}.png` });
    await hold(p, '.is-accel', 4500, `shots/11-car-a2-accel-${tag}.png`);
    await readout(p, 'auto-accel');
    await hold(p, '.is-accel', 6000, `shots/11-car-a3-accel-${tag}.png`);
    await readout(p, 'auto-accel2');
    const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log('horizontal overflow:', over);
    await p.close();
    break;
  } catch (e) {
    console.log('retry flow:', String(e).slice(0, 160));
    await p.close();
  }
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
