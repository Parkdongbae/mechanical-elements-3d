// 쇼츠 녹화기(지시서 21 · 2단계) — 실시간 녹화가 아니라 프레임마다 위상·카메라를 정해 그리는 결정적 렌더.
//   node scripts/shorts/record.mjs <번호> [ko|en|both] [--force-cam] [--jpeg]
// 검사 서버 http://localhost:5274 (npm run dev:check, HMR 끔) 의 preview.html?mm=n&t=0&ui=0&lang=..&labels=1&arrows=0&leaders=1
// 결과: shorts/_work/<lang>/NNN/frames/f00000.jpg … (1080×1920, 30fps, 영상 T.rec0~T.end)
//       shorts/_work/cam/NNN.json(카메라 계획), shorts/_work/common/NNN/motion.json(부품 회전각·위치 — 효과음 동기화)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { BASE, H, REC_FRAMES, W, ensureDir, pad3, workDir } from './lib.mjs';
import { parseLangs } from './langs.mjs';
import { planCamera } from './camera.mjs';

/** 효과음 동기화에 쓰는 부품 종류 */
const TRACK_KINDS = ['gear', 'rack', 'wheel', 'pulley', 'disc', 'disk', 'ratchet', 'pawl', 'cam', 'follower', 'lever', 'crank', 'link', 'rod', 'slider', 'weight', 'spring', 'screw', 'nut', 'roller', 'beam', 'yoke', 'carriage', 'anchor', 'hammer', 'arm'];

export async function launch() {
  return chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
  });
}

export async function openModel(browser, n, lang, { w = W, h = H } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const url = `${BASE}preview.html?mm=${n}&t=0&ui=0&lang=${lang}&labels=1&arrows=0&leaders=1`;
  await page.goto(url);
  await page.waitForFunction(() => window.__mmReady === true, null, { timeout: 120000 });
  const errs = await page.evaluate(() => window.__mm.errors.filter((e) => !e.startsWith('warn')));
  if (errs.length) console.warn(`[record] ${n} ${lang} 페이지 오류:`, errs.slice(0, 3));
  return page;
}

/** 부품 목록(종류·잇수·반지름) + 프레임마다 각 부품의 자기 축 회전각·월드 위치 */
async function setupMotion(page) {
  return page.evaluate((kinds) => {
    const m = window.__mm;
    const TH = m.THREE;
    const list = [];
    m.group.traverse((o) => {
      const mm = o.userData.mm;
      if (!mm || !kinds.includes(mm.kind) || list.length >= 48) return;
      const ax = mm.axis === 'x' ? [1, 0, 0] : mm.axis === 'y' ? [0, 1, 0] : Array.isArray(mm.axis) ? mm.axis : [0, 0, 1];
      list.push({ o, ax: new TH.Vector3(...ax).normalize(), q0: o.getWorldQuaternion(new TH.Quaternion()).invert() });
    });
    window.__shortsMotion = list;
    return list.map(({ o }) => {
      const mm = o.userData.mm;
      return { kind: mm.kind, fn: mm.fn ?? null, teeth: mm.teeth ?? null, r: mm.rp ?? mm.r ?? null, name: o.name || null };
    });
  }, TRACK_KINDS);
}
/** 모델 전체의 부품 종류·기능 이름과 이름표 글자(효과음 자동 선택용 — 움직이지 않는 벨트·줄도 포함) */
export async function inventory(page) {
  return page.evaluate(() => {
    const kinds = new Set();
    window.__mm.group.traverse((o) => {
      const mm = o.userData.mm;
      if (mm && mm.kind && mm.kind !== 'tag' && mm.kind !== 'arrow' && mm.kind !== 'stand') kinds.add([mm.kind, mm.fn, mm.style].filter(Boolean).join(':'));
    });
    return { kinds: [...kinds], tags: window.__mm.tags().map((t) => t.text) };
  });
}
async function sampleMotion(page) {
  return page.evaluate(() => {
    const TH = window.__mm.THREE;
    const q = new TH.Quaternion();
    const p = new TH.Vector3();
    return window.__shortsMotion.map(({ o, ax, q0 }) => {
      o.getWorldQuaternion(q);
      const r = q0.clone().multiply(q); // 처음 자세 기준 상대 회전(로컬 축)
      const ang = 2 * Math.atan2(r.x * ax.x + r.y * ax.y + r.z * ax.z, r.w);
      o.getWorldPosition(p);
      const f = (v) => Math.round(v * 1e5) / 1e5;
      return [f(ang), f(p.x), f(p.y), f(p.z)];
    });
  });
}

export async function record(n, lang, { browser, forceCam = false, motion = true, log = true } = {}) {
  const own = !browser;
  browser ??= await launch();
  const page = await openModel(browser, n, lang);
  const plan = await planCamera(page, n, { force: forceCam });
  const out = ensureDir(path.join(workDir(n, lang), 'frames'));
  for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f));
  let parts = null;
  const samples = [];
  let inv = null;
  if (motion) {
    parts = await setupMotion(page);
    inv = await inventory(page);
  }
  const cdp = await page.context().newCDPSession(page);
  const t0 = Date.now();
  for (let i = 0; i < REC_FRAMES; i++) {
    const fr = plan.frames[i];
    await page.evaluate((fr) => {
      const m = window.__mm;
      m.seek(fr.phase);
      m.emph(fr.emph, 1.25);
      m.cam(...fr.cam);
      m.render();
    }, fr);
    if (motion) samples.push(await sampleMotion(page));
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
    if (log && i % 60 === 0) process.stdout.write(`\r[record] ${n} ${lang} ${i}/${REC_FRAMES}`);
  }
  if (log) console.log(`\r[record] ${n} ${lang} ${REC_FRAMES} 프레임 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  if (motion) {
    const md = ensureDir(workDir(n));
    fs.writeFileSync(path.join(md, 'motion.json'), JSON.stringify({ n, fps: plan.fps, parts, inventory: inv, frames: samples, phase: plan.frames.map((f) => f.phase) }));
  }
  await page.close();
  if (own) await browser.close();
  return plan;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const n = Number(process.argv[2]);
  const which = process.argv[3] ?? 'both';
  const forceCam = process.argv.includes('--force-cam');
  if (!Number.isInteger(n) || n < 1) {
    console.error('사용: node scripts/shorts/record.mjs <번호> [ko|en|both] [--force-cam]');
    process.exit(2);
  }
  const browser = await launch();
  if (process.argv.includes('--inventory-only')) {
    // 녹화는 두고 motion.json 에 inventory 만 채운다
    const page = await openModel(browser, n, 'ko');
    const f = path.join(workDir(n), 'motion.json');
    const mj = JSON.parse(fs.readFileSync(f, 'utf8'));
    mj.inventory = await inventory(page);
    fs.writeFileSync(f, JSON.stringify(mj));
    console.log('[record] inventory', mj.inventory);
    await browser.close();
    process.exit(0);
  }
  const langs = parseLangs(which);
  for (const [k, lang] of langs.entries()) await record(n, lang, { browser, forceCam: forceCam && k === 0, motion: k === 0 });
  await browser.close();
  console.log(`[record] 끝 — shorts/_work/<lang>/${pad3(n)}/frames`);
}
