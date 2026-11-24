// 507 모델 이름표 점검 (작업 지시서 18 · 5-2)
// 사용: node scripts/18-mm-tags.mjs            — 모델 파일의 tag('…') 글자를 번호별로 뽑아 개수·목록 출력, 0개면 exit 1
//       node scripts/18-mm-tags.mjs --ui [n…]  — 상세 화면(#/mm/<n>)에서 이름표 버튼을 눌러 보며 확인(dev 서버 필요, 기본 1 7 13)
// dev 서버: http://localhost:5273 (다르면 BASE_URL)

import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src', 'mm507', 'models');
const args = process.argv.slice(2);
const ui = args.includes('--ui');

function scan() {
  const files = readdirSync(dir)
    .filter((f) => /^m\d+\.ts$/.test(f))
    .sort();
  const rows = [];
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    const texts = [];
    // tag('글자', …) / tag("글자", …) / tag(`글자`, …) — 템플릿 문자열은 ${…} 를 그대로 남긴다
    const re = /\btag\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
    let m;
    while ((m = re.exec(src)) !== null) texts.push(m[2]);
    // tag(변수, …) 처럼 글자를 직접 못 뽑는 호출 수(참고용)
    const all = (src.match(/\btag\(/g) ?? []).length;
    rows.push({ n: Number(f.slice(1, 4)), file: f, texts, dynamic: all - texts.length });
  }
  return rows;
}

function report(rows) {
  let bad = 0;
  for (const r of rows) {
    const extra = r.dynamic > 0 ? ` (+글자를 못 뽑은 호출 ${r.dynamic})` : '';
    console.log(`${String(r.n).padStart(3)}번  ${String(r.texts.length).padStart(2)}개${extra}  ${r.texts.join(' | ')}`);
    if (r.texts.length + r.dynamic === 0) bad++;
  }
  console.log(`\n모델 ${rows.length}개, 이름표 0개인 모델 ${bad}개`);
  return bad;
}

const rows = scan();
let fail = report(rows) > 0 ? 1 : 0;

if (ui) {
  const { chromium } = await import('playwright');
  const base = process.env.BASE_URL ?? 'http://localhost:5273/';
  const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
  if (nums.length === 0) nums.push(1, 7, 13);
  mkdirSync(join(root, 'shots', '18', 'mm'), { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
  });
  const problems = [];
  const check = (cond, msg) => {
    if (!cond) problems.push(msg);
  };
  for (const theme of ['light', 'dark']) {
    for (const [w, h] of [
      [1280, 800],
      [390, 844]
    ]) {
      for (const n of nums) {
        const tag = `mm${n}-${w}-${theme}`;
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => {
          if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
        });
        await page.addInitScript((t) => {
          try {
            if (localStorage.getItem('mech3d-settings-v1') === null) localStorage.setItem('mech3d-settings-v1', JSON.stringify({ showLabels: true, theme: t }));
          } catch {
            /* 무시 */
          }
        }, theme);
        await page.goto(`${base}#/mm/${n}`, { waitUntil: 'load' });
        await page.waitForTimeout(4500);
        const btn = page.locator('[data-lab="labels-toggle"]');
        const cnt = await btn.count();
        check(cnt === 1, `${tag}: 이름표 버튼 ${cnt}개`);
        if (cnt === 1) {
          const box = await btn.boundingBox();
          check(!!box && box.width >= 44 && box.height >= 44, `${tag}: 버튼 크기 ${box ? `${box.width}×${box.height}` : '없음'}`);
          check(!!box && box.x >= 0 && box.x + box.width <= w && box.y >= 0 && box.y + box.height <= h, `${tag}: 버튼이 화면 밖`);
          check((await btn.getAttribute('aria-pressed')) === 'true', `${tag}: 켠 상태 aria-pressed`);
          await page.screenshot({ path: join(root, 'shots', '18', 'mm', `${tag}-on.png`) });
          await btn.click();
          await page.waitForTimeout(600);
          check((await btn.getAttribute('aria-pressed')) === 'false', `${tag}: 끈 뒤 aria-pressed`);
          const saved = await page.evaluate(() => {
            try {
              return JSON.parse(localStorage.getItem('mech3d-settings-v1') ?? '{}').showLabels;
            } catch {
              return null;
            }
          });
          check(saved === false, `${tag}: 설정 저장값 ${saved}`);
          await page.screenshot({ path: join(root, 'shots', '18', 'mm', `${tag}-off.png`) });
          await page.reload({ waitUntil: 'load' });
          await page.waitForTimeout(3500);
          check((await page.locator('[data-lab="labels-toggle"]').getAttribute('aria-pressed')) === 'false', `${tag}: 새로고침 뒤 꺼진 채 유지`);
        }
        const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        check(sw, `${tag}: 가로 스크롤`);
        check(errors.length === 0, `${tag}: 콘솔 에러 ${errors.join(' / ')}`);
        await ctx.close();
      }
    }
  }
  await browser.close();
  if (problems.length) {
    console.log('\nUI 실패:\n' + problems.join('\n'));
    fail = 1;
  } else console.log('\nUI 점검 통과');
}

process.exit(fail);
