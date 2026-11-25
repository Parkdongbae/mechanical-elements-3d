// 쇼츠 그림 카드(지시서 21 · 4단계) — Playwright 로 HTML 을 그려 PNG 로(글꼴: assets/shorts/fonts, 무료 OFL).
//   node scripts/shorts/cards.mjs base             assets/shorts/intro-ko.png·intro-en.png·intro-wide-ko.png·intro-wide-en.png
//                                                  (Canva 그림 assets/shorts/canva/intro-base.png 가 있으면 그것을 넣고, 없으면 HTML 종이 질감 대체)
//   node scripts/shorts/cards.mjs <번호> [both|all|new|ko,ja,...]   shorts/_work/<lang>/NNN/cards/*.png (번호별 인트로·분할 화면·겹침 판화·배지·아웃트로·가로판 패널)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { H, ROOT, W, WH, WW, ensureDir, pad3, seriesOf, workDir } from './lib.mjs';
import { ALL_LANGS, CAT_NAME, CFG, TXT, parseLangs, textOf } from './langs.mjs';

const FONT_DIR = path.join(ROOT, 'assets', 'shorts', 'fonts');
const furl = (f) => pathToFileURL(path.join(FONT_DIR, f)).href;
const FONTS = `
@font-face{font-family:Pre;font-weight:500;src:url('${furl('Pretendard-Medium.otf')}')}
@font-face{font-family:Pre;font-weight:700;src:url('${furl('Pretendard-Bold.otf')}')}
@font-face{font-family:Pre;font-weight:800;src:url('${furl('Pretendard-ExtraBold.otf')}')}
@font-face{font-family:Inter;font-weight:700;src:url('${furl('Inter-Bold.ttf')}')}
@font-face{font-family:Inter;font-weight:800;src:url('${furl('Inter-ExtraBold.ttf')}')}
@font-face{font-family:Fell;src:url('${furl('IMFellEnglish-Regular.ttf')}')}
@font-face{font-family:Fell;font-style:italic;src:url('${furl('IMFellEnglish-Italic.ttf')}')}
@font-face{font-family:SerifKR;font-weight:700;src:url('${furl('NotoSerifKR-Bold.otf')}')}
`;
const PAPER = '#efe2c2';
const INK = '#2b2118';
const ACCENT = '#f2b619';
const SANS = (lang) => CFG[lang]?.sans ?? 'Inter, Pre';
/** 제목용 명조 계열(한 SerifKR, 영 Fell, 그 밖은 langs.mjs) */
const SERIF = (lang) => CFG[lang]?.serif ?? 'Fell';
const PAPER_CSS = `background:${PAPER};background-image:
 radial-gradient(ellipse at 50% 45%, rgba(255,250,235,.55), rgba(0,0,0,0) 60%),
 radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(90,60,20,.38) 100%),
 repeating-linear-gradient(0deg, rgba(120,90,40,.035) 0 2px, rgba(0,0,0,0) 2px 5px);`;
const APP_URL = 'mechanical-elements-3d.vercel.app';

// ── 직접 그린 아이콘(SVG). 유튜브 로고·상표는 쓰지 않는다 ──
const ICON_BELL = `<svg viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>`;
const ICON_THUMB = `<svg viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="M2 21h4V9H2v12Zm20-11a2 2 0 0 0-2-2h-6.3l.95-4.57.03-.32a1.5 1.5 0 0 0-.44-1.06L13.17 1 6.59 7.59A2 2 0 0 0 6 9v10a2 2 0 0 0 2 2h9a2 2 0 0 0 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2Z"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`;
const CURSOR = `<svg viewBox="0 0 64 64" width="96" height="96"><path d="M22 4c3 0 5 2 5 5v20l3-1c3-1 5 1 6 3l2-1c3-1 5 1 6 3l2-1c3 0 5 2 5 5v12c0 7-6 12-13 12H29c-4 0-7-2-9-5L9 40c-2-3 0-6 3-6 2 0 3 1 5 3V9c0-3 2-5 5-5Z" fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round"/></svg>`;

/** 지금 그리는 카드의 언어(html lang·아랍어 dir=rtl) — buildBase·buildCards 가 정한다 */
let curLang = '';
function page(w, h, body, css = '', transparent = false, lang = curLang) {
  return `<!doctype html><html${lang ? ` lang="${lang}"${CFG[lang]?.rtl ? ' dir="rtl"' : ''}` : ''}><head><meta charset="utf-8"><style>${FONTS}
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;${transparent ? 'background:transparent' : 'background:#000'}}
*{box-sizing:border-box}
${css}</style></head><body>${body}</body></html>`;
}

async function shot(browser, html, w, h, out, transparent = false) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const tmp = path.join(ensureDir(path.join(ROOT, 'shorts', '_work', 'html')), path.basename(out, '.png') + '-' + Math.random().toString(36).slice(2, 7) + '.html');
  fs.writeFileSync(tmp, html, 'utf8');
  await p.goto(pathToFileURL(tmp).href);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))))));
  await p.screenshot({ path: out, omitBackground: transparent });
  await p.close();
  fs.unlinkSync(tmp);
  return out;
}

const imgUrl = (f) => pathToFileURL(f).href;

/** 판화의 잉크 사각형(테두리 선·작은 티·번호 글자 빼고 가장 큰 덩어리) — 브라우저 canvas 로 계산 */
async function inkBox(browser, figFile) {
  const p = await browser.newPage();
  await p.goto(imgUrl(figFile));
  const r = await p.evaluate(() => {
    const img = document.querySelector('img');
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) ink[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11 < 120 ? 1 : 0;
    // 긴 테두리 선 지우기
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let x = 0; x < w; x++) s += ink[y * w + x];
      if (s > w * 0.5) for (let x = 0; x < w; x++) ink[y * w + x] = 0;
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = 0; y < h; y++) s += ink[y * w + x];
      if (s > h * 0.5) for (let y = 0; y < h; y++) ink[y * w + x] = 0;
    }
    // 6px 격자로 묶어 연결 성분
    const C = 6;
    const gw = Math.ceil(w / C);
    const gh = Math.ceil(h / C);
    const cell = new Int32Array(gw * gh);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink[y * w + x]) cell[Math.floor(y / C) * gw + Math.floor(x / C)]++;
    const lab = new Int32Array(gw * gh).fill(-1);
    let best = null;
    for (let i = 0; i < gw * gh; i++) {
      if (cell[i] < 2 || lab[i] >= 0) continue;
      const st = [i];
      lab[i] = i;
      let sum = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      while (st.length) {
        const k = st.pop();
        const cx = k % gw;
        const cy = (k - cx) / gw;
        sum += cell[k];
        x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
            const q = ny * gw + nx;
            if (cell[q] >= 2 && lab[q] < 0) {
              lab[q] = i;
              st.push(q);
            }
          }
      }
      if (!best || sum > best.sum) best = { sum, x: x0 * C, y: y0 * C, w: (x1 - x0 + 1) * C, h: (y1 - y0 + 1) * C };
    }
    return { W: w, H: h, box: best };
  });
  await p.close();
  return r;
}

/** 판화를 투명 PNG 로(흰 바탕 → 투명, 잉크는 짙은 갈색) — 3D 위 겹치기용 */
async function figTransparent(browser, figFile, out) {
  const p = await browser.newPage();
  await p.goto(imgUrl(figFile));
  const data = await p.evaluate(() => {
    const img = document.querySelector('img');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const im = g.getImageData(0, 0, c.width, c.height);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const a = Math.max(0, Math.min(255, (200 - l) * 2.2));
      d[i] = 40; d[i + 1] = 26; d[i + 2] = 12; d[i + 3] = a;
    }
    g.putImageData(im, 0, 0);
    return c.toDataURL('image/png');
  });
  await p.close();
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  return out;
}

// ───────── 공용 인트로 바탕(assets/shorts) ─────────
export async function buildBase(browser, langs = ALL_LANGS) {
  const canva = path.join(ROOT, 'assets', 'shorts', 'canva', 'intro-base.png');
  const hasCanva = fs.existsSync(canva);
  const deco = [3, 25, 37, 60].map((k) => imgUrl(path.join(ROOT, 'public', 'mm507', 'fig', `${pad3(k)}.png`)));
  const out = ensureDir(path.join(ROOT, 'assets', 'shorts'));
  for (const lang of langs) {
    curLang = lang;
    const t = TXT[lang];
    // 세로: Canva 정사각 그림(제목·장식)을 위에, 아래로 같은 종이를 이어 붙이고 판화 장식
    const square = hasCanva
      ? `<img src="${imgUrl(canva)}" style="position:absolute;left:0;top:250px;width:1080px;height:1080px">`
      : `<div style="position:absolute;left:60px;right:60px;top:320px;text-align:center;font-family:Fell;color:${INK}">
           <div style="font-size:92px;line-height:1.05;letter-spacing:2px">FIVE HUNDRED AND SEVEN</div>
           <div style="font-size:112px;line-height:1.05;margin-top:10px">MECHANICAL MOVEMENTS</div>
           <div style="font-size:46px;font-style:italic;margin-top:26px">Henry T. Brown · 1868</div></div>`;
    const body = `<div style="position:absolute;inset:0;${PAPER_CSS}"></div>
      ${hasCanva ? `<div style="position:absolute;inset:0;background:#e6cf98;background-image:radial-gradient(ellipse at 50% 50%, rgba(255,248,220,.35), rgba(0,0,0,0) 55%, rgba(110,70,20,.45) 100%)"></div>` : ''}
      ${square}
      <div style="position:absolute;left:0;right:0;top:1390px;text-align:center;font-family:${SERIF(lang)};font-weight:700;color:${INK};font-size:${lang === 'ko' ? 58 : 64}px">${t.series}</div>
      <div style="position:absolute;left:0;right:0;top:1478px;text-align:center;font-family:${SERIF(lang)};color:#5a4630;font-size:36px;font-style:${lang === 'en' ? 'italic' : 'normal'}">${t.book}</div>
      <div style="position:absolute;left:90px;right:90px;top:1580px;height:260px;display:flex;justify-content:space-between;align-items:center;opacity:.8;mix-blend-mode:multiply">
        ${deco.map((u) => `<img src="${u}" style="height:200px;filter:sepia(.6) contrast(1.1)">`).join('')}</div>
      <div style="position:absolute;inset:26px;border:3px double ${INK};opacity:.55"></div>`;
    await shot(browser, page(W, H, body), W, H, path.join(out, `intro-${lang}.png`));
    // 가로: 가운데 Canva 정사각, 양옆 판화 장식
    const bodyW = `<div style="position:absolute;inset:0;${PAPER_CSS}"></div>
      ${hasCanva ? `<div style="position:absolute;inset:0;background:#e6cf98;background-image:radial-gradient(ellipse at 50% 50%, rgba(255,248,220,.35), rgba(0,0,0,0) 55%, rgba(110,70,20,.45) 100%)"></div><img src="${imgUrl(canva)}" style="position:absolute;left:420px;top:0;width:1080px;height:1080px">` : square.replace('left:60px;right:60px;top:320px', 'left:420px;width:1080px;top:120px')}
      <div style="position:absolute;left:40px;top:120px;width:340px;display:flex;flex-direction:column;gap:40px;align-items:center;mix-blend-mode:multiply;opacity:.8">${deco.slice(0, 2).map((u) => `<img src="${u}" style="width:300px;filter:sepia(.6)">`).join('')}</div>
      <div style="position:absolute;right:40px;top:120px;width:340px;display:flex;flex-direction:column;gap:40px;align-items:center;mix-blend-mode:multiply;opacity:.8">${deco.slice(2).map((u) => `<img src="${u}" style="width:300px;filter:sepia(.6)">`).join('')}</div>`;
    await shot(browser, page(WW, WH, bodyW), WW, WH, path.join(out, `intro-wide-${lang}.png`));
  }
  console.log(`[cards] 인트로 바탕 ${hasCanva ? '(Canva 그림 사용)' : '(Canva 그림 없음 — HTML 대체)'} → assets/shorts/intro-*.png`);
}

// ───────── 번호별 카드 ─────────
export async function buildCards(browser, n, lang, plan) {
  curLang = lang;
  const { title, easy } = textOf(n, lang);
  const t = TXT[lang];
  const ser = seriesOf(n);
  const serTxt = ser ? `${CAT_NAME[lang][ser.cat] ?? ser.cat} ${ser.i}/${ser.count}` : '';
  const dir = ensureDir(path.join(workDir(n, lang), 'cards'));
  const fig = path.join(ROOT, 'public', 'mm507', 'fig', `${pad3(n)}.png`);
  const ink = await inkBox(browser, fig);
  const figT = await figTransparent(browser, fig, path.join(dir, 'fig-t.png'));
  const sans = SANS(lang);
  const base = path.join(ROOT, 'assets', 'shorts', `intro-${lang}.png`);
  const baseW = path.join(ROOT, 'assets', 'shorts', `intro-wide-${lang}.png`);

  // 1) 인트로: 바탕 + 번호(Canva 그림의 비운 가운데 자리)
  const numBlock = (size) => `<div style="font-family:Fell;color:${INK};text-align:center;line-height:1">
      <div style="font-size:${size * 0.32}px;font-style:italic;letter-spacing:4px">No.</div>
      <div style="font-family:SerifKR;font-weight:700;font-size:${size * 0.9}px;margin:6px 0">${n}</div>
      <div style="font-size:${size * 0.26}px;margin-top:-6px;opacity:.75">/ 507</div></div>`;
  const titleBlock = (size) => `<div style="margin-top:22px;font-family:${SERIF(lang)};font-weight:700;font-size:${size}px;color:${INK};text-align:center">${title}</div>`;
  await shot(
    browser,
    page(W, H, `<img src="${imgUrl(base)}" style="position:absolute;inset:0"><div style="position:absolute;left:0;right:0;top:${250 + 360}px;height:520px;display:flex;flex-direction:column;align-items:center;justify-content:center">${numBlock(230)}${titleBlock(lang === 'ko' ? 62 : 58)}</div>`),
    W, H, path.join(dir, 'intro.png')
  );
  await shot(
    browser,
    page(WW, WH, `<img src="${imgUrl(baseW)}" style="position:absolute;inset:0"><div style="position:absolute;left:420px;width:1080px;top:330px;height:480px;display:flex;flex-direction:column;align-items:center;justify-content:center">${numBlock(200)}${titleBlock(56)}</div>`),
    WW, WH, path.join(dir, 'intro-wide.png')
  );

  // 2) 분할 화면 위 칸(1080×960): 종이 위 원본 판화 + 설명
  const bx = ink.box ?? { x: 0, y: 0, w: ink.W, h: ink.H };
  const figPanel = (pw, ph, maxH, maxW) => {
    const padK = 1.12;
    const s = Math.min(maxH / (bx.h * padK), maxW / (bx.w * padK));
    const cx = bx.x + bx.w / 2;
    const cy = bx.y + bx.h / 2;
    return `<div style="position:absolute;left:${pw / 2 - cx * s}px;top:${ph / 2 - 30 - cy * s}px;width:${ink.W * s}px;height:${ink.H * s}px;
      background:url('${imgUrl(fig)}') 0 0/100% 100%;mix-blend-mode:multiply;filter:sepia(.35) contrast(1.15);
      clip-path:inset(${Math.max(0, bx.y - bx.h * 0.06) * s}px ${Math.max(0, ink.W - bx.x - bx.w * 1.06) * s}px ${Math.max(0, ink.H - bx.y - bx.h * 1.06) * s}px ${Math.max(0, bx.x - bx.w * 0.06) * s}px)"></div>`;
  };
  await shot(
    browser,
    page(W, 960, `<div style="position:absolute;inset:0;${PAPER_CSS}"></div>${figPanel(W, 960, 720, 900)}
      <div style="position:absolute;left:0;right:0;bottom:44px;text-align:center;font-family:${SERIF(lang)};font-weight:700;font-size:40px;color:${INK}">${t.fig(n)}</div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:8px;background:${ACCENT}"></div>`),
    W, 960, path.join(dir, 'split-top.png')
  );
  // 분할 화면 아래 칸 표지(투명, 1080×960 기준)
  await shot(
    browser,
    page(W, 960, `<div style="position:absolute;left:40px;top:40px;padding:12px 26px;border-radius:40px;background:rgba(20,20,20,.78);color:#fff;font-family:${sans};font-weight:800;font-size:40px">${t.model}</div>`, '', true),
    W, 960, path.join(dir, 'split-chip.png'), true
  );

  // 3) 겹침 판화(1080×1920 투명): 정면 3D 의 부품 사각형(plan.screenRect)에 판화 잉크 사각형을 맞춘다
  const sr = plan.screenRect;
  const s = Math.min(sr.h / bx.h, (sr.w * 1.15) / bx.w);
  const gx = sr.x + sr.w / 2 - (bx.x + bx.w / 2) * s;
  const gy = sr.y + sr.h / 2 - (bx.y + bx.h / 2) * s;
  await shot(
    browser,
    page(W, H, `<img src="${imgUrl(figT)}" style="position:absolute;left:${gx}px;top:${gy}px;width:${ink.W * s}px;height:${ink.H * s}px;
      clip-path:inset(${Math.max(0, bx.y - 4) * s}px ${Math.max(0, ink.W - bx.x - bx.w - 4) * s}px ${Math.max(0, ink.H - bx.y - bx.h - 4) * s}px ${Math.max(0, bx.x - 4) * s}px)">`, '', true),
    W, H, path.join(dir, 'ghost.png'), true
  );

  // 4) 작동 구간 배지(위쪽): 진행 표시 + 제목
  await shot(
    browser,
    page(W, H, `<div style="position:absolute;left:44px;right:44px;top:120px;display:flex;flex-direction:column;gap:14px;align-items:flex-start">
      <div style="padding:10px 22px;border-radius:30px;background:${ACCENT};color:#1b1408;font-family:${sans};font-weight:800;font-size:34px">${serTxt} · No.${n}</div>
      <div style="padding:14px 28px;border-radius:22px;background:rgba(20,16,10,.8);color:#fff;font-family:${sans};font-weight:800;font-size:56px;max-width:990px">${title}</div></div>`, '', true),
    W, H, path.join(dir, 'badge.png'), true
  );

  // 5) 아웃트로(투명 위 덧그림) + 버튼·손가락 조각
  const outroText = (w, h, scale, url) => `<div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(10,8,5,.15) 0%, rgba(10,8,5,.55) 45%, rgba(10,8,5,.85) 100%)"></div>
     <div style="position:absolute;left:0;right:0;top:${h * 0.5}px;text-align:center;color:#fff;font-family:${sans};font-weight:800;font-size:${96 * scale}px;text-shadow:0 4px 18px rgba(0,0,0,.6)">${t.try}</div>
     <div style="position:absolute;left:0;right:0;top:${h * 0.5 + 140 * scale}px;text-align:center"><span style="display:inline-block;padding:${14 * scale}px ${30 * scale}px;border-radius:${18 * scale}px;background:${ACCENT};color:#1b1408;font-family:Inter,Pre;font-weight:800;font-size:${36 * scale}px">${url}</span></div>`;
  await shot(browser, page(W, H, outroText(W, H, 1, `${APP_URL}/#/mm/${n}`), '', true), W, H, path.join(dir, 'outro.png'), true);
  await shot(browser, page(1080, 1080, outroText(1080, 1080, 0.8, `${APP_URL}/#/mm/${n}`), '', true), 1080, 1080, path.join(dir, 'outro-wide.png'), true);
  const btn = (bg, fg, icon, label) => `<div style="display:inline-flex;align-items:center;gap:16px;padding:22px 40px;border-radius:60px;background:${bg};color:${fg};font-family:${sans};font-weight:800;font-size:46px;box-shadow:0 6px 20px rgba(0,0,0,.35)"><span style="font-size:52px;display:flex">${icon}</span>${label}</div>`;
  const pieces = {
    'sub-off': btn('#d6402f', '#fff', ICON_BELL, t.sub),
    'sub-on': btn('#3a3a3a', '#ddd', ICON_CHECK, t.subOn),
    'like-off': btn('#ffffff', '#222', ICON_THUMB, t.like),
    'like-on': btn(ACCENT, '#1b1408', ICON_THUMB, t.like)
  };
  for (const [k, html] of Object.entries(pieces)) {
    const p = await browser.newPage({ viewport: { width: 600, height: 200 } });
    await p.setContent(page(600, 200, `<div id="b" style="position:absolute;left:10px;top:10px">${html}</div>`, '', true));
    await p.evaluate(() => document.fonts.ready);
    const el = await p.$('#b > div');
    await el.screenshot({ path: path.join(dir, `${k}.png`), omitBackground: true });
    await p.close();
  }
  await shot(browser, page(110, 110, `<div style="padding:7px">${CURSOR}</div>`, '', true), 110, 110, path.join(dir, 'cursor.png'), true);

  // 6) 가로판 패널: 왼쪽 판화(420×1080), 오른쪽 제목·쉬운 풀이(420×1080)
  await shot(
    browser,
    page(420, WH, `<div style="position:absolute;inset:0;${PAPER_CSS}"></div>${figPanel(420, WH, 600, 360)}
      <div style="position:absolute;left:20px;right:20px;top:60px;text-align:center;font-family:Fell;font-size:40px;color:${INK}">No. ${n} <span style="opacity:.6">/ 507</span></div>
      <div style="position:absolute;left:20px;right:20px;bottom:60px;text-align:center;font-family:${SERIF(lang)};font-weight:700;font-size:28px;color:${INK}">${t.fig(n)}</div>
      <div style="position:absolute;top:0;bottom:0;right:0;width:6px;background:${ACCENT}"></div>`),
    420, WH, path.join(dir, 'wide-left.png')
  );
  await shot(
    browser,
    page(420, WH, `<div style="position:absolute;inset:0;background:#17130e"></div><div style="position:absolute;top:0;bottom:0;left:0;width:6px;background:${ACCENT}"></div>
      <div style="position:absolute;left:40px;right:34px;top:70px;font-family:${sans};color:#fff">
        <div style="display:inline-block;padding:8px 18px;border-radius:24px;background:${ACCENT};color:#1b1408;font-weight:800;font-size:24px">${serTxt}</div>
        <div style="margin-top:22px;font-weight:800;font-size:${lang === 'ko' ? 50 : 44}px;line-height:1.2">${title}</div>
        <div style="margin-top:30px;font-weight:${lang === 'ko' ? 500 : 700};font-size:${lang === 'ko' ? 31 : 28}px;line-height:1.55;color:#e9e1d2;word-break:keep-all">${easy}</div>
      </div>
      <div style="position:absolute;left:40px;right:30px;bottom:60px;font-family:Inter,Pre;font-weight:700;font-size:22px;line-height:1.4;color:${ACCENT}">${APP_URL}<br>/#/mm/${n}</div>`),
    420, WH, path.join(dir, 'wide-right.png')
  );
  return dir;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'cards.mjs') {
  const a = process.argv[2];
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  if (a === 'base') await buildBase(browser);
  else {
    const n = Number(a);
    const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'shorts', '_work', 'cam', `${pad3(n)}.json`), 'utf8'));
    for (const lang of parseLangs(process.argv[3])) {
      await buildCards(browser, n, lang, plan);
      console.log(`[cards] ${pad3(n)} ${lang}`);
    }
  }
  await browser.close();
}
