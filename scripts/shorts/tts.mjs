// 쇼츠 더빙·자막(지시서 21 · 3단계) — 대본(shorts/scripts/<lang>.json) → edge-tts mp3 + 단어 시간 → ASS 자막(세로·가로)
//   node scripts/shorts/tts.mjs <번호> [both|all|new|ko,ja,...] [--voice=ko-KR-InJoonNeural]
// 더빙은 두 덩어리: A = 훅+풀이(영상 A_START 에 시작, A_END 전에 끝), B = 끝 문장 "직접 돌려 보세요"(아웃트로 B_START).
// A 가 길면 말 빠르기 +10% → +20%, 그래도 넘으면 '대본 줄이기 필요' 표시(dub.json tooLong).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { H, ROOT, T, W, WH, WW, ensureDir, pad3, probe, workDir } from './lib.mjs';
import { CFG, parseLangs } from './langs.mjs';

export const VOICES = Object.fromEntries(Object.entries(CFG).map(([k, v]) => [k, v.voice]));
export const A_START = T.rec0 + 0.1; // 1.6초
export const A_END = T.pullEnd - 0.2; // 11.3초
export const B_START = T.pullEnd + 0.2; // 11.7초
export const B_END = T.end - 0.1;

export function loadScript(n, lang) {
  const f = path.join(ROOT, 'shorts', 'scripts', `${lang}.json`);
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  const s = all[String(n)];
  if (!s) throw new Error(`${f} 에 ${n}번 대본 없음`);
  return s;
}

function say(voice, rate, text, outBase) {
  const txt = outBase + '.txt';
  fs.writeFileSync(txt, text, 'utf8');
  const r = spawnSync('python', [path.join(ROOT, 'scripts', 'shorts', 'tts.py'), voice, rate, txt, outBase + '.mp3', outBase + '.json'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('edge-tts 실패: ' + (r.stderr || '').slice(-500));
  const dur = Number(probe(outBase + '.mp3').format.duration);
  return { dur, words: JSON.parse(fs.readFileSync(outBase + '.json', 'utf8')) };
}

// ── ASS 자막 ──
const assTime = (s) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
const esc = (t) => t.replace(/[{}]/g, '').replace(/\\/g, '');

/** edge-tts 낱말에는 문장부호가 빠져 있다 → 대본 어절(문장부호 포함)로 바꿔 끼운다(같은 어절에 여러 낱말이면 처음 것만) */
export function attachPunct(words, text) {
  const norm = (x) => x.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
  const toks = text.split(/\s+/).filter(Boolean);
  let k = 0;
  const out = [];
  for (const w of words) {
    const nw = norm(w.w);
    let j = k;
    while (j < toks.length && j < k + 3 && !norm(toks[j]).startsWith(nw)) j++;
    if (j < toks.length && j < k + 3 && nw) {
      out.push({ ...w, w: toks[j] });
      k = j + 1;
    } else if (out.length && nw && norm(out[out.length - 1].w).includes(nw)) {
      out[out.length - 1].d = w.t + w.d - out[out.length - 1].t; // 앞 어절의 나머지 조각
    } else out.push(w);
  }
  return out;
}

/** 낱말을 2~3개씩 묶는다(한글 어절 2개·12자, 영어·힌디·아랍 3낱말·20~22자, 일·중은 띄어쓰기가 없어 글자 수 10자 안쪽) */
function chunk(words, lang) {
  const cjk = CFG[lang]?.cjk;
  const maxW = lang === 'ko' ? 2 : cjk ? 6 : 3;
  const maxC = lang === 'ko' ? 12 : cjk ? 10 : lang === 'en' ? 20 : 22;
  const out = [];
  let cur = [];
  for (const w of words) {
    const len = cur.reduce((a, x) => a + x.w.length + (cjk ? 0 : 1), 0) + w.w.length;
    if (cur.length && (cur.length >= maxW || len > maxC)) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.?!,。、，？！।؟،]$/.test(w.w)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** 지금 읽는 낱말만 노란색(묶음 안의 나머지는 흰색) — 낱말마다 이벤트 하나 */
export function buildAss(words, offset, lang, wide) {
  const c = CFG[lang] ?? CFG.en;
  const font = c.ass;
  const [pw, ph] = wide ? [WW, WH] : [W, H];
  const size = wide ? 54 : lang === 'ko' || c.cjk ? 76 : 70;
  const sep = c.cjk ? '' : ' ';
  const marginV = wide ? 64 : Math.round(H * 0.2);
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${pw}
PlayResY: ${ph}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,${font},${size},&H00FFFFFF,&H00FFFFFF,&H00141414,&H96000000,${c.assBold === -1 ? -1 : -1},0,0,0,100,100,0,0,1,${wide ? 5 : 7},${wide ? 2 : 3},2,60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const groups = chunk(words, lang);
  const lines = [];
  groups.forEach((g, gi) => {
    const gEnd = gi + 1 < groups.length ? groups[gi + 1][0].t : g[g.length - 1].t + g[g.length - 1].d + 0.35;
    g.forEach((w, wi) => {
      const s = w.t;
      const e = wi + 1 < g.length ? g[wi + 1].t : gEnd;
      const text = g.map((x, k) => (k === wi ? `{\\c&H19B6F2&}${esc(x.w)}{\\c&HFFFFFF&}` : esc(x.w))).join(sep);
      // 묶음의 첫 낱말에만 짧은 페이드(낱말이 바뀔 때마다 깜빡이지 않게)
      lines.push(`Dialogue: 0,${assTime(offset + s)},${assTime(offset + e)},Sub,,0,0,0,,${wi === 0 ? '{\\fad(80,0)}' : ''}${text}`);
    });
  });
  return head + lines.join('\n') + '\n';
}

export function tts(n, lang, { voice } = {}) {
  const sc = loadScript(n, lang);
  const dir = ensureDir(path.join(workDir(n, lang), 'dub'));
  voice ??= VOICES[lang];
  const textA = CFG[lang]?.cjk ? `${sc.hook}${sc.body}` : `${sc.hook} ${sc.body}`;
  let rate = 0;
  let A;
  for (;;) {
    A = say(voice, `+${rate}%`, textA, path.join(dir, 'a'));
    if (A.dur <= A_END - A_START || rate >= 20) break;
    rate += 10;
  }
  // 끝 문장(고정 문구)은 따로 빠르기를 올려 맞춘다 — 대본으로는 줄일 수 없는 문장이므로
  let rateB = rate;
  let B;
  for (;;) {
    B = say(voice, `+${rateB}%`, sc.cta, path.join(dir, 'b'));
    if (B.dur <= B_END - B_START || rateB >= 30) break;
    rateB += 10;
  }
  const meta = {
    n,
    lang,
    voice,
    rate: `+${rate}%`,
    rateB: `+${rateB}%`,
    aStart: A_START,
    aDur: A.dur,
    bStart: B_START,
    bDur: B.dur,
    tooLong: A.dur > A_END - A_START || B.dur > B_END - B_START,
    chars: lang === 'ko' || CFG[lang]?.cjk ? (sc.hook + sc.body + sc.cta).replace(/\s/g, '').length : (sc.hook + ' ' + sc.body + ' ' + sc.cta).split(/\s+/).length
  };
  fs.writeFileSync(path.join(dir, 'dub.json'), JSON.stringify(meta, null, 1));
  // 띄어쓰기 없는 글(일·중)은 어절 맞추기를 하지 않는다(낱말 경계를 그대로)
  const wa = CFG[lang]?.cjk ? A.words : attachPunct(A.words, textA);
  fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify(wa, null, 1));
  fs.writeFileSync(path.join(dir, 'sub.ass'), buildAss(wa, A_START, lang, false), 'utf8');
  fs.writeFileSync(path.join(dir, 'sub-wide.ass'), buildAss(wa, A_START, lang, true), 'utf8');
  console.log(`[tts] ${pad3(n)} ${lang} ${voice} ${meta.rate} A ${A.dur.toFixed(2)}초 B ${B.dur.toFixed(2)}초 ${meta.tooLong ? '⚠ 길다 — 대본 줄이기' : ''} (${meta.chars}${lang === 'ko' || CFG[lang]?.cjk ? '자' : '낱말'})`);
  return meta;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'tts.mjs') {
  const n = Number(process.argv[2]);
  const which = process.argv[3] ?? 'both';
  const v = process.argv.find((a) => a.startsWith('--voice='))?.slice(8);
  for (const lang of parseLangs(which)) tts(n, lang, { voice: v });
}
