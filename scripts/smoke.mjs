// 스모크 테스트: 전 미션을 (1) 처음 상태 (2) 완료 상태 복원으로 열어 콘솔 에러·404를 수집하고, 오답·다시하기·학습 모드 진입을 확인한다.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const src = readFileSync('src/data/machines.ts', 'utf8');
const ids = [...src.matchAll(/^\s{4}id: '([\w-]+)'/gm)].map((m) => m[1]);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
async function open(progress, hash, wait = 2500) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(`${hash}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`${hash}: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${hash}: ${r.status()} ${r.url()}`); });
  await page.addInitScript((p) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); if (p) localStorage.setItem('mech3d-progress-v2', p); } }, progress);
  await page.goto('http://localhost:5273/' + hash);
  await page.waitForTimeout(wait);
  return page;
}
const done = {};
for (const id of ids) done[id] = { installed: 9, completedOnce: true };
for (const id of ids) {
  let p = await open(null, '#/m/' + id); await p.close();
  p = await open(JSON.stringify({ last: id, machines: done }), '#/m/' + id, 5000);
  const ok = await p.evaluate(() => !document.querySelector('#mission-done').classList.contains('hidden') || document.querySelector('.step-count') !== null);
  if (!ok) errors.push(`${id}: 완료 복원 표시 안 됨`);
  await p.close();
  console.log('ok', id);
}
// 학습 모드·탐구 실험: 진입해서 패널이 만들어지는지, 에러가 없는지
for (const r of ['enc', 'quiz', 'lab/bike', 'lab/car', 'lab/power', 'lab/wind', 'lab/cycle', 'lab/engines', 'lab/steam', 'lab/pump', 'mm', 'mm/1', 'mm/40', 'mm/about']) {
  const lp = await open(null, '#/' + r, 5000);
  const n = await lp.evaluate(() => document.querySelector('#mode-root').childElementCount);
  if (n === 0) errors.push(`${r}: 화면이 비어 있음`);
  await lp.click('#mode-home-btn');
  await lp.waitForTimeout(600);
  if (await lp.evaluate(() => document.querySelector('#home').classList.contains('hidden'))) errors.push(`${r}: 홈으로 돌아가지 못함`);
  await lp.close();
  console.log('ok', r);
}

// 오답 → 토스트, 다시하기, 새로고침 복원
const p = await open(null, '#/m/clock');
await p.click('.cat-btn[data-cat="joining"]');
await p.click('.part-card >> nth=0');
await p.waitForTimeout(700);
await p.screenshot({ path: 'shots/smoke-wrong.png' });
if (await p.evaluate(() => document.querySelector('#toast').classList.contains('hidden'))) errors.push('오답 토스트 없음');
await p.waitForTimeout(3000);
await p.click('.cat-btn[data-cat="control"]');
await p.click('.part-card:has-text("스프링")');
await p.waitForTimeout(3500);
await p.reload();
await p.waitForTimeout(2500);
if ((await p.locator('.step.done').count()) !== 1) errors.push('새로고침 후 진행도 복원 실패');
await p.click('#reset-btn');
await p.waitForTimeout(600);
if ((await p.locator('.step.done').count()) !== 0) errors.push('다시하기 실패');
// 홈 → 도감 → 홈 → 퀴즈 → 홈 → 미션
await p.click('#home-btn'); await p.waitForTimeout(500);
await p.click('[data-mode="enc"]'); await p.waitForTimeout(2500);
await p.click('#mode-home-btn'); await p.waitForTimeout(500);
await p.click('[data-mode="quiz"]'); await p.waitForTimeout(2000);
await p.click('#mode-home-btn'); await p.waitForTimeout(500);
await p.click('[data-mission="automata"]'); await p.waitForTimeout(2500);
await p.screenshot({ path: 'shots/smoke-nav.png' });
await p.close();
await browser.close();
console.log(errors.length ? 'FAIL\n' + errors.join('\n') : 'ALL PASS');
