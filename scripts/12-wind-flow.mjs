// 풍동 실험 조작 검증: node scripts/12-wind-flow.mjs [width] [height] [theme]
// ① 부품을 하나씩 바꾸며 Cd·Cl·dB 기록(기본형 → 각 옵션) ② 코너링·옆바람 시험(다운포스 유/무)
// ③ 소리 켜기 → AudioContext running, 설정 변경 시 게인·필터 값 변화 확인. HMR 리로드로 끊기면 처음부터 다시.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { windPage } from './12-wind-base.mjs';

const [, , w = '1280', h = '800', theme = 'light'] = process.argv;
const tag = `${w}-${theme}`;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
});
const errors = [];

async function open() {
  const page = await windPage(browser, { width: +w, height: +h }, `mode=wind&theme=${theme}`);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text());
  });
  await page.waitForSelector('.wind-bar', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.__flow = 1; });
  return page;
}

async function dbg(p) {
  const v = await p.evaluate(() => (window.__flow ? window.__windDebug() : null));
  if (!v) throw new Error('page reloaded (HMR)');
  return v;
}
const chip = (p, item, idx) => p.locator(`.wind-chip[data-item="${item}"][data-idx="${idx}"]`).click();
const basic = (p) => p.locator('.wind-presets .wind-btn', { hasText: '모두 기본형' }).click();
const f3 = (x) => x.toFixed(3);

const OPTIONS = [
  ['handle', 1, '손잡이 매립형'],
  ['mirror', 1, '미러 유선형'],
  ['mirror', 2, '미러 카메라'],
  ['pillar', 1, 'A필러 둥글고 눕힘'],
  ['gap', 1, '도어 틈 좁게+실링'],
  ['under', 1, '하부 언더커버'],
  ['under', 2, '하부 언더커버+디퓨저'],
  ['wheel', 1, '휠 에어로 커버'],
  ['spoiler', 1, '립 스포일러'],
  ['spoiler', 2, '큰 윙'],
  ['ride', 1, '차고 낮음']
];

for (let attempt = 0; attempt < 4; attempt++) {
  const p = await open();
  try {
    // ① 부품별 변화표(120 km/h)
    const base = await dbg(p);
    console.log(`기본형: Cd ${f3(base.cd)} Cl ${base.cl.toFixed(2)} dB ${base.db.toFixed(1)}`);
    console.log('| 옵션 | Cd | ΔCd | Cl | ΔCl | dB(120) | ΔdB | 보이는 메시 수 |');
    for (const [item, idx, name] of OPTIONS) {
      await basic(p);
      await p.waitForTimeout(150);
      const before = await dbg(p);
      await chip(p, item, idx);
      await p.waitForTimeout(250);
      const d = await dbg(p);
      console.log(`| ${name} | ${f3(d.cd)} | ${(d.cd - base.cd >= 0 ? '+' : '')}${f3(d.cd - base.cd)} | ${d.cl.toFixed(2)} | ${(d.cl - base.cl).toFixed(2)} | ${d.db.toFixed(1)} | ${(d.db - base.db).toFixed(1)} | ${before.partsInCar}→${d.partsInCar} |`);
      if (item === 'mirror' && idx === 2) await p.screenshot({ path: `shots/12-wind-f-mirrorcam-${tag}.png` });
    }
    await p.locator('.wind-presets .wind-btn', { hasText: '공력 최적화' }).click();
    await p.waitForTimeout(300);
    const aero = await dbg(p);
    console.log(`공력 최적화: Cd ${f3(aero.cd)} Cl ${aero.cl.toFixed(2)} dB ${aero.db.toFixed(1)} vmax ${aero.vmax.toFixed(0)}`);

    // 비교 + 압력 분포
    await basic(p);
    await p.locator('.wind-btn', { hasText: 'A로 저장' }).click();
    await chip(p, 'handle', 1);
    await chip(p, 'mirror', 2);
    await p.locator('.wind-toggle', { hasText: '압력' }).click();
    await p.locator('.wind-toggle', { hasText: '유선 겹치기' }).click();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `shots/12-wind-f-compare-pressure-${tag}.png` });
    const cmp = await p.evaluate(() => [...document.querySelectorAll('.wind-cmp tbody tr')].map((r) => r.textContent));
    console.log('비교표:', JSON.stringify(cmp));
    await p.locator('.wind-toggle', { hasText: '압력' }).click();

    // ② 코너링: 기본형(양력) vs 큰 윙+디퓨저+낮은 차고, 200 km/h
    await p.locator('#wind-tab-stab').click();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `shots/12-wind-f-force-basic-${tag}.png` });
    await basic(p);
    await p.locator('.wind-seg-btn', { hasText: '코너링' }).click();
    await p.waitForTimeout(4500);
    let d = await dbg(p);
    console.log(`코너링 기본형 200km/h: vmax ${d.vmax.toFixed(0)} 상태 ${JSON.stringify(d.corner)}`);
    await p.screenshot({ path: `shots/12-wind-f-corner-basic-${tag}.png` });
    for (const [it, ix] of [['spoiler', 2], ['under', 2], ['ride', 1]]) await chip(p, it, ix);
    await p.waitForTimeout(4500);
    d = await dbg(p);
    console.log(`코너링 윙+디퓨저+낮음 200km/h: Cl ${d.cl.toFixed(2)} vmax ${d.vmax.toFixed(0)} 상태 ${JSON.stringify(d.corner)}`);
    await p.screenshot({ path: `shots/12-wind-f-corner-wing-${tag}.png` });
    await p.locator('.wind-seg-btn', { hasText: '힘 보기' }).click();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `shots/12-wind-f-force-wing-${tag}.png` });

    // 옆바람
    await p.locator('.wind-seg-btn', { hasText: '옆바람' }).click();
    await p.waitForTimeout(2700);
    await p.screenshot({ path: `shots/12-wind-f-cross-wing-${tag}.png` });
    await p.waitForTimeout(2500);
    d = await dbg(p);
    console.log(`옆바람 윙 설정: 최대 밀림[시험,유령] ${JSON.stringify(d.cross)}`);
    await basic(p);
    await p.waitForTimeout(5200);
    d = await dbg(p);
    console.log(`옆바람 기본형: 최대 밀림[시험,유령] ${JSON.stringify(d.cross)}`);

    // ③ 소리
    await p.locator('#wind-tab-noise').click();
    await p.waitForTimeout(800);
    await p.locator('.wind-sound').click();
    // 헤드리스는 오디오 장치 준비가 느려 렌더링이 시작될 때까지 기다린다
    let a1 = (await dbg(p)).audio;
    for (let i = 0; i < 20 && a1.rms === 0; i++) {
      await p.waitForTimeout(500);
      a1 = (await dbg(p)).audio;
    }
    await p.waitForTimeout(1000);
    a1 = (await dbg(p)).audio;
    console.log('소리 켬(기본형):', JSON.stringify(a1));
    await p.screenshot({ path: `shots/12-wind-f-noise-on-${tag}.png` });
    await chip(p, 'gap', 1);
    await chip(p, 'mirror', 2);
    await p.waitForTimeout(1500);
    const a2 = (await dbg(p)).audio;
    console.log('틈 실링+카메라 미러:', JSON.stringify(a2.gains));
    await p.locator('#wind-speed').fill('200');
    await p.waitForTimeout(1500);
    const a3 = (await dbg(p)).audio;
    console.log('200 km/h:', JSON.stringify({ gains: a3.gains, freqs: a3.freqs, rms: a3.rms }));
    const changed = a1.gains.whistle > a2.gains.whistle * 3 && a1.gains.mid > a2.gains.mid && a3.freqs.whistle > a2.freqs.whistle;
    console.log('audio running:', a1.state === 'running', '/ gains·filters change:', changed);
    await p.locator('#wind-tab-drag').click();
    await p.waitForTimeout(400);
    console.log('탭 떠난 뒤 상태:', (await dbg(p)).audio.state);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log('horizontal overflow:', over);
    await p.close();
    break;
  } catch (e) {
    console.log('retry flow:', String(e).slice(0, 200));
    await p.close();
  }
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
