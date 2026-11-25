// 쇼츠 효과음(지시서 21 · 효과음 절) — 합성 효과음 라이브러리 + 번호별 자동 선택 + 움직임 동기화 트랙.
//   node scripts/shorts/sfx.mjs lib            assets/shorts/sfx/*.wav 합성(저작권 걱정 없는 직접 파형 합성)
//   node scripts/shorts/sfx.mjs <번호>          shorts/_work/common/NNN/sfx.wav + sfx.json (영상 전체 길이, 48kHz 모노)
// 우선순위: assets/shorts/sfx/user/<이름>.(wav|mp3|ogg|m4a|flac) (유튜브 오디오 보관함 '음향 효과' 등 사용자가 넣은 파일) → 합성음.
// 선택: record.mjs 가 남긴 motion.json 의 부품 종류(kind·fn)와 이름표 글자.
// 동기화: 기어 틱 = 잇수 × 회전 속도, 래칫 딸깍 = 폴 각이 다시 떨어지는 순간, 캠·해머 = 속도 부호가 바뀌는 순간,
//         크랭크·레버 삐걱 = 각속도 방향이 바뀌는 순간, 벨트 = 종동 풀리 한 바퀴마다 삐걱 + 회전 속도에 비례한 마찰음.
import fs from 'node:fs';
import path from 'node:path';
import { FPS, ROOT, T, ensureDir, ffmpeg, pad3, workDir } from './lib.mjs';

export const SR = 48000;
const LIB = path.join(ROOT, 'assets', 'shorts', 'sfx');
const USER = path.join(LIB, 'user');

// ───────── WAV 읽기·쓰기(16bit PCM 모노) ─────────
export function writeWav(file, f32, sr = SR) {
  const n = f32.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(f32[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}
export function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12;
  let fmt = null;
  while (p < b.length - 8) {
    const id = b.toString('ascii', p, p + 4);
    const sz = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') {
      const n = Math.floor(sz / 2 / fmt.ch);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(p + 8 + i * 2 * fmt.ch) / 32768;
      return out;
    }
    p += 8 + sz + (sz & 1);
  }
  throw new Error('wav data 없음: ' + file);
}

// ───────── 합성 도구 ─────────
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const buf = (sec) => new Float32Array(Math.round(sec * SR));
/** 1극 저역·고역 통과 */
function lowpass(x, fc) {
  const a = Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y = (1 - a) * x[i] + a * y;
  return x;
}
function highpass(x, fc) {
  const a = Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  let px = 0;
  for (let i = 0; i < x.length; i++) {
    y = a * (y + x[i] - px);
    px = x[i];
    x[i] = y;
  }
  return x;
}
/** 공진 대역 통과(2차, 삐걱·쇳소리 몸통) */
function resonate(x, f, q) {
  const w = (2 * Math.PI * f) / SR;
  const al = Math.sin(w) / (2 * q);
  const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * Math.cos(w), a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}
const norm = (x, peak = 0.9) => {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
};
const fadeEdges = (x, ms = 4) => {
  const k = Math.round((ms / 1000) * SR);
  for (let i = 0; i < k && i < x.length; i++) {
    x[i] *= i / k;
    x[x.length - 1 - i] *= i / k;
  }
  return x;
};
/** 쇳소리 울림: 비조화 배음 합 × 지수 감쇠 */
function metal(sec, freqs, decay, noiseAmt = 0.3) {
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let s = 0;
    freqs.forEach((f, k) => (s += Math.sin(2 * Math.PI * f * t + k) / (k + 1)));
    x[i] = (s + noiseAmt * rnd() * Math.exp(-t * 400)) * Math.exp(-t * decay);
  }
  return x;
}
/** 삐걱: 들쭉날쭉한 마찰 펄스열(stick-slip) → 공진 */
function creak(sec, rate0, rate1, body, q) {
  const x = buf(sec);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / x.length;
    const rate = rate0 + (rate1 - rate0) * t + 8 * rnd();
    ph += rate / SR;
    if (ph >= 1) {
      ph -= 1;
      x[i] = 1 + 0.4 * rnd();
    }
  }
  resonate(x, body, q);
  resonate(x, body * 2.3, q * 0.7);
  for (let i = 0; i < x.length; i++) x[i] *= Math.sin((Math.PI * i) / x.length) ** 0.6;
  return x;
}

/** 효과음 라이브러리(이름 → 만드는 함수). 길이 0.05~1초 */
export const LIBRARY = {
  'gear-tick': () => fadeEdges(norm(highpass(metal(0.05, [2400, 3730, 5610, 7900], 140, 0.6), 900))),
  'gear-whirr': () => {
    // 1초 고리(이어 붙여 반복): 저음 웅~ + 거친 대역 잡음
    const x = buf(1);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      x[i] = 0.5 * Math.sin(2 * Math.PI * 110 * t) + 0.25 * Math.sin(2 * Math.PI * 220 * t) + 0.12 * Math.sin(2 * Math.PI * 330 * t) + 0.35 * rnd();
      x[i] *= 0.8 + 0.2 * Math.sin(2 * Math.PI * 6 * t);
    }
    lowpass(x, 900);
    return norm(loopable(x), 0.7);
  },
  'wheel-rumble': () => {
    const x = buf(1);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      x[i] = 0.6 * Math.sin(2 * Math.PI * 62 * t) + 0.3 * Math.sin(2 * Math.PI * 124 * t + 1) + 0.5 * rnd();
      x[i] *= 0.85 + 0.15 * Math.sin(2 * Math.PI * 3 * t);
    }
    lowpass(x, 300);
    return norm(loopable(x), 0.7);
  },
  'belt-friction': () => {
    const x = buf(1);
    for (let i = 0; i < x.length; i++) x[i] = rnd();
    highpass(x, 500);
    lowpass(x, 2600);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      x[i] *= 0.6 + 0.4 * Math.sin(2 * Math.PI * 2.5 * t) * Math.sin(2 * Math.PI * 0.7 * t + 0.4);
    }
    return norm(loopable(x), 0.6);
  },
  'rope-creak': () => fadeEdges(norm(creak(0.45, 35, 70, 620, 6))),
  'ratchet-click': () => {
    const a = metal(0.06, [3100, 4870, 6900], 180, 0.9);
    const b = metal(0.06, [2500, 4100], 220, 0.5);
    const x = buf(0.08);
    for (let i = 0; i < a.length; i++) x[i] += a[i];
    const off = Math.round(0.012 * SR);
    for (let i = 0; i + off < x.length && i < b.length; i++) x[i + off] += 0.5 * b[i];
    return fadeEdges(norm(highpass(x, 1200)));
  },
  'cam-thump': () => {
    const x = buf(0.14);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      x[i] = Math.sin(2 * Math.PI * (95 - 200 * t) * t) * Math.exp(-t * 35) + 0.4 * rnd() * Math.exp(-t * 300);
    }
    return fadeEdges(norm(lowpass(x, 1800)));
  },
  'spring-boing': () => {
    const x = buf(0.6);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      const f = 180 + 60 * Math.exp(-t * 6) + 12 * Math.sin(2 * Math.PI * 7 * t);
      x[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * 2.7 * f * t)) * Math.exp(-t * 6);
    }
    return fadeEdges(norm(x));
  },
  'hammer-thud': () => {
    const x = buf(0.4);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      x[i] = Math.sin(2 * Math.PI * (60 - 30 * t) * t) * Math.exp(-t * 12) + 0.6 * rnd() * Math.exp(-t * 60);
    }
    return fadeEdges(norm(lowpass(x, 900)));
  },
  'crank-creak': () => fadeEdges(norm(creak(0.38, 60, 110, 950, 8))),
  'screw-squeak': () => {
    const x = buf(0.5);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      const f = 1500 + 500 * (t / 0.5) + 30 * rnd();
      x[i] = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.3 * Math.sin(Math.PI * (t / 0.5)) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 23 * t));
    }
    return fadeEdges(norm(lowpass(x, 4000)));
  },
  'intro-chime': () => {
    // 인트로 효과음 한 번(PRD §3 ①): 맑은 종 + 작은 톱니 감김 소리
    const x = metal(1.0, [880, 1320 * 1.002, 1760 * 0.997, 2637], 4.5, 0.05);
    for (let k = 0; k < 6; k++) {
      const t0 = Math.round((0.02 + k * 0.035) * SR);
      const c = metal(0.04, [3000 + k * 120, 4700], 160, 0.4);
      for (let i = 0; i < c.length && t0 + i < x.length; i++) x[t0 + i] += 0.25 * c[i];
    }
    return fadeEdges(norm(x, 0.8), 10);
  }
};
/** 고리 이음매: 끝 50ms 를 처음과 겹쳐 섞는다 */
function loopable(x) {
  const k = Math.round(0.05 * SR);
  const y = x.slice(0, x.length - k);
  for (let i = 0; i < k; i++) {
    const a = i / k;
    y[i] = y[i] * a + x[x.length - k + i] * (1 - a);
  }
  return y;
}

export function buildLibrary() {
  ensureDir(LIB);
  ensureDir(USER);
  for (const [name, fn] of Object.entries(LIBRARY)) {
    seed = 1000 + name.length * 77;
    writeWav(path.join(LIB, `${name}.wav`), fn());
  }
  console.log(`[sfx] 라이브러리 ${Object.keys(LIBRARY).length}개 → assets/shorts/sfx/`);
}

/** 사용자 파일 우선(assets/shorts/sfx/user/<이름>.*) → 48kHz 모노 wav 로 바꿔 읽음 */
const cache = new Map();
export function loadSample(name) {
  if (cache.has(name)) return cache.get(name);
  let x = null;
  if (fs.existsSync(USER)) {
    const f = fs.readdirSync(USER).find((f) => path.parse(f).name === name && /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(f));
    if (f) {
      const out = path.join(ensureDir(path.join(ROOT, 'shorts', '_work', 'sfx-cache')), `${name}.wav`);
      ffmpeg(['-i', path.join(USER, f), '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', out]);
      x = readWav(out);
    }
  }
  if (!x) {
    const f = path.join(LIB, `${name}.wav`);
    if (!fs.existsSync(f)) buildLibrary();
    x = readWav(f);
  }
  cache.set(name, x);
  return x;
}

// ───────── 자동 선택 ─────────
const has = (parts, re) => parts.some((p) => re.test(`${p.kind} ${p.fn ?? ''} ${p.name ?? ''}`.toLowerCase()));
export function chooseSounds(parts, tags = [], extraKinds = []) {
  const txt = tags.join(' ');
  const all = [...parts, ...extraKinds.map((k) => ({ kind: k }))];
  const s = new Set();
  if (has(all, /gear|rack|worm|pinion/) || /기어|피니언|톱니|웜/.test(txt)) s.add('gear');
  if (has(all, /belt|rope|chain|cord|strap/) || /벨트|로프|줄|체인/.test(txt)) s.add('belt');
  if (has(all, /wheel|pulley|disc|disk|drum|roller/)) s.add('wheel');
  if (has(all, /ratchet|pawl|escape|anchor/) || /래칫|멈춤쇠|폴/.test(txt)) s.add('ratchet');
  if (has(all, /cam|follower/) || /캠/.test(txt)) s.add('cam');
  if (has(all, /spring|coil/) || /스프링|용수철/.test(txt)) s.add('spring');
  if (has(all, /weight|hammer|stamp|drop/) || /추|해머|망치/.test(txt)) s.add('hammer');
  if (has(all, /crank|lever|link|rod|beam|yoke|arm/) || /크랭크|레버|지레|링크/.test(txt)) s.add('crank');
  if (has(all, /screw|nut|thread/) || /나사/.test(txt)) s.add('screw');
  return [...s];
}

// ───────── 동기화 트랙 ─────────
function unwrap(a) {
  const out = [a[0]];
  for (let i = 1; i < a.length; i++) {
    let d = a[i] - a[i - 1];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    out.push(out[i - 1] + d);
  }
  return out;
}
/** 클로즈업 구간에서 조금 크게(×1.5), 아웃트로 끝으로 갈수록 작게 */
function gainAt(t) {
  let g = 1;
  if (t > T.closeIn - 0.3 && t < T.closeEnd + 0.3) g = 1.5;
  if (t > T.end - 1.5) g *= Math.max(0, (T.end - t) / 1.5);
  return g;
}

export function buildTrack(n, { tags = [] } = {}) {
  const md = workDir(n);
  const motion = JSON.parse(fs.readFileSync(path.join(md, 'motion.json'), 'utf8'));
  const { parts, frames } = motion;
  const inv = motion.inventory ?? { kinds: [], tags: [] };
  const kinds = chooseSounds(parts, [...tags, ...inv.tags], inv.kinds.map((k) => k.replace(/:/g, ' ')));
  const out = new Float32Array(Math.ceil(T.end * SR));
  const events = [];
  const put = (name, t, g) => {
    const x = loadSample(name);
    const i0 = Math.round(t * SR);
    const gg = g * gainAt(t);
    for (let i = 0; i < x.length && i0 + i < out.length; i++) if (i0 + i >= 0) out[i0 + i] += x[i] * gg;
    events.push({ name, t: Math.round(t * 1000) / 1000 });
  };
  /** 고리 소리를 프레임별 세기 env(0~1)로 깐다 */
  const bed = (name, env, g) => {
    const x = loadSample(name);
    const start = Math.round(T.rec0 * SR);
    for (let i = start; i < out.length; i++) {
      const f = (i - start) / SR * FPS;
      const k = Math.min(env.length - 1, Math.floor(f));
      const k2 = Math.min(env.length - 1, k + 1);
      const e = env[k] + (env[k2] - env[k]) * (f - k);
      out[i] += x[(i - start) % x.length] * e * g * gainAt(i / SR);
    }
  };
  const tOf = (i) => T.rec0 + i / FPS;
  const series = (pi) => unwrap(frames.map((f) => f[pi][0]));
  const vel = (a) => a.map((v, i) => (i === 0 ? (a[1] - a[0]) * FPS : (v - a[i - 1]) * FPS));
  const idx = (re) => parts.map((p, i) => (re.test(`${p.kind} ${p.fn ?? ''}`) ? i : -1)).filter((i) => i >= 0);

  // 인트로 효과음
  put('intro-chime', 0.05, 0.7);

  if (kinds.includes('wheel') || kinds.includes('belt')) {
    const wi = idx(/wheel|pulley|disc|disk|drum|roller/);
    if (wi.length) {
      const w = vel(series(wi[0])).map(Math.abs);
      const ref = Math.max(...w, 1e-6);
      bed('wheel-rumble', w.map((v) => v / ref), 0.35);
      if (kinds.includes('belt')) {
        bed('belt-friction', w.map((v) => v / ref), 0.22);
        // 종동(마지막) 풀리가 반 바퀴 돌 때마다 밧줄 삐걱
        const a = series(wi[wi.length - 1]);
        let next = Math.PI;
        for (let i = 0; i < a.length; i++)
          if (Math.abs(a[i] - a[0]) >= next) {
            put('rope-creak', tOf(i), 0.45);
            next += Math.PI;
          }
      }
    }
  }
  if (kinds.includes('gear')) {
    const gi = idx(/gear|rack|pinion|worm/);
    const g0 = gi.find((i) => parts[i].teeth) ?? gi[0];
    if (g0 !== undefined) {
      const a = series(g0);
      const w = vel(a).map(Math.abs);
      const ref = Math.max(...w, 1e-6);
      bed('gear-whirr', w.map((v) => v / ref), 0.25);
      const teeth = parts[g0].teeth ?? 20;
      const pitch = (2 * Math.PI) / teeth;
      let last = a[0];
      let lastT = -1;
      for (let i = 1; i < a.length; i++) {
        if (Math.abs(a[i] - last) >= pitch) {
          last = a[i];
          const t = tOf(i);
          if (t - lastT > 0.035) {
            put('gear-tick', t, 0.3); // 초당 약 28번 넘으면 웅~ 소리에 맡긴다
            lastT = t;
          }
        }
      }
    }
  }
  if (kinds.includes('ratchet')) {
    const pi = idx(/pawl|anchor/);
    if (pi.length) {
      const a = series(pi[0]);
      const v = vel(a);
      for (let i = 2; i < v.length; i++) if (Math.abs(v[i - 1]) > 0.3 && Math.sign(v[i]) !== Math.sign(v[i - 1])) put('ratchet-click', tOf(i), 0.6);
    } else regular('ratchet-click', 0.5, 0.5);
  }
  if (kinds.includes('cam') || kinds.includes('hammer')) {
    const fi = idx(/follower|weight|hammer|slider|rod/);
    if (fi.length) {
      const y = frames.map((f) => f[fi[0]][2]);
      const v = vel(y);
      for (let i = 2; i < v.length; i++) if (v[i - 1] < -0.05 && v[i] >= -0.01) put(kinds.includes('hammer') ? 'hammer-thud' : 'cam-thump', tOf(i), 0.6);
    } else regular(kinds.includes('hammer') ? 'hammer-thud' : 'cam-thump', 0.8, 0.5);
  }
  if (kinds.includes('crank')) {
    const ci = idx(/lever|link|rod|beam|crank|arm|yoke/);
    if (ci.length) {
      const v = vel(series(ci[0]));
      let lastT = -1;
      for (let i = 2; i < v.length; i++) {
        const t = tOf(i);
        if (Math.abs(v[i - 1]) > 0.2 && Math.sign(v[i]) !== Math.sign(v[i - 1]) && t - lastT > 0.4) {
          put('crank-creak', t, 0.35);
          lastT = t;
        }
      }
    }
  }
  if (kinds.includes('spring')) regular('spring-boing', 1.6, 0.35);
  if (kinds.includes('screw')) regular('screw-squeak', 1.2, 0.3);

  function regular(name, every, g) {
    for (let t = T.rec0 + 0.6; t < T.end - 1; t += every) put(name, t, g);
  }

  // 음량: RMS 를 맞춘 뒤(약 -27 dBFS ≈ -24 LUFS 근처) 첨두 제한
  let sum = 0;
  let cnt = 0;
  for (let i = Math.round(T.rec0 * SR); i < out.length; i++) {
    sum += out[i] * out[i];
    cnt++;
  }
  const rms = Math.sqrt(sum / Math.max(1, cnt));
  const target = 10 ** (-27 / 20);
  const k = rms > 1e-6 ? target / rms : 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * k * 1.2) / 1.2;
  const file = path.join(md, 'sfx.wav');
  writeWav(file, out);
  fs.writeFileSync(path.join(md, 'sfx.json'), JSON.stringify({ n, kinds, events: events.length, sample: events.slice(0, 40) }, null, 1));
  console.log(`[sfx] ${pad3(n)} 종류 ${kinds.join(',') || '(없음)'} · 사건 ${events.length}개 → ${path.relative(ROOT, file)}`);
  return { file, kinds };
}

if (process.argv[1] && path.basename(process.argv[1]) === 'sfx.mjs') {
  const a = process.argv[2];
  if (a === 'lib') buildLibrary();
  else buildTrack(Number(a));
}
