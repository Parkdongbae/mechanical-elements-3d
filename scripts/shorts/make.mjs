// 쇼츠 한 번에 만들기(지시서 21) — 번호마다 녹화 → 더빙·자막 → 카드 → 효과음 → 합성 → 검사.
//   node scripts/shorts/make.mjs <번호들: 1 | 1-10 | 1,3,5> [--langs=both|all|new|ko,ja,...] [--skip-record] [--force-cam]
//   ko 가 목록에 없으면 카메라 경로·움직임은 이미 만든 것(shorts/_work/cam)을 쓴다.
// 전제: 검사 서버 http://localhost:5274 (npm run dev:check), shorts/scripts/<lang>.json 에 그 번호 대본.
// 인트로 바탕(assets/shorts/intro-*.png)이 없으면 cards.mjs base 를 먼저 돌린다.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, pad3, timeline } from './lib.mjs';
import { launch, record } from './record.mjs';
import { tts } from './tts.mjs';
import { buildBase, buildCards } from './cards.mjs';
import { buildTrack } from './sfx.mjs';
import { compose } from './compose.mjs';
import { checkFile } from './check.mjs';
import { parseLangs } from './langs.mjs';

const arg = process.argv[2] ?? '';
const nums = [];
for (const part of arg.split(',')) {
  const m = part.match(/^(\d+)-(\d+)$/);
  if (m) for (let i = Number(m[1]); i <= Number(m[2]); i++) nums.push(i);
  else if (/^\d+$/.test(part)) nums.push(Number(part));
}
if (!nums.length) {
  console.error('사용: node scripts/shorts/make.mjs <1 | 1-10 | 1,3,5> [--skip-record] [--force-cam]');
  process.exit(2);
}
const skipRec = process.argv.includes('--skip-record');
const LANGS = parseLangs(process.argv.find((a) => a.startsWith('--langs='))?.slice(8));
const browser = await launch();
const cardBrowser = await chromium.launch({ channel: 'chrome', headless: true });
if (LANGS.some((l) => !fs.existsSync(path.join(ROOT, 'assets', 'shorts', `intro-${l}.png`)))) await buildBase(cardBrowser);
for (const n of nums) {
  const t0 = Date.now();
  const camReady = fs.existsSync(path.join(ROOT, 'shorts', '_work', 'cam', `${pad3(n)}.json`));
  if (!skipRec) for (const [k, lang] of LANGS.entries()) await record(n, lang, { browser, forceCam: process.argv.includes('--force-cam') && k === 0, motion: k === 0 && (LANGS.includes('ko') || !camReady) });
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'shorts', '_work', 'cam', `${pad3(n)}.json`), 'utf8'));
  for (const lang of LANGS) {
    tts(n, lang);
    await buildCards(cardBrowser, n, lang, plan);
  }
  buildTrack(n);
  if (n === nums[nums.length - 1]) {
    // 합성(ffmpeg)은 메모리를 많이 쓴다 — 마지막 번호면 브라우저를 먼저 닫는다
    await browser.close();
    await cardBrowser.close();
  }
  for (const lang of LANGS) compose(n, lang);
  const end = timeline(n).end;
  for (const lang of LANGS) {
    let ok = true;
    for (const [suf, want] of [['', { w: 1080, h: 1920, maxDur: end + 0.1 }], ['-wide', { w: 1920, h: 1080, maxDur: end + 0.2 }]]) {
      const r = checkFile(path.join(ROOT, 'shorts', lang, `${pad3(n)}${suf}.mp4`), want);
      ok &&= r.ok;
      console.log(`${r.ok ? 'OK ' : 'ERR'} ${r.file} ${r.dur}초 ${r.issues.join(' / ')}`);
    }
    // 두 판이 다 통과하면 녹화 프레임(편당 약 70MB)을 지운다 — 디스크가 가득 차 제작이 멈춘 적이 있다(2026-11-27)
    if (ok) fs.rmSync(path.join(ROOT, 'shorts', '_work', lang, pad3(n), 'frames'), { recursive: true, force: true });
  }
  console.log(`[make] ${pad3(n)} ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}
if (browser.isConnected()) await browser.close();
if (cardBrowser.isConnected()) await cardBrowser.close();
