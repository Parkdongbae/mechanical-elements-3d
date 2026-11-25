// 쇼츠 검사(지시서 21 · 6단계) — 길이·해상도·fps·소리(음량·무음 구간) + 대표 프레임 미리보기 시트.
//   node scripts/shorts/check.mjs <번호> [--sheet]
// 검사 대상: shorts/{ko,en}/NNN.mp4 (세로 1080×1920, ≤14.5초) · NNN-wide.mp4 (가로 1920×1080)
// --sheet: 각 영상의 대표 프레임 4장(분할 화면·작동·클로즈업·아웃트로)을 모은 shorts/preview-NNN.png
import fs from 'node:fs';
import path from 'node:path';
import { FFMPEG, ROOT, T, ffmpeg, pad3, probe, rel, run } from './lib.mjs';
import { ALL_LANGS, parseLangs } from './langs.mjs';

function loudness(file) {
  const r = run(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet,silencedetect=n=-45dB:d=0.8', '-f', 'null', '-']);
  const err = r.stderr;
  const I = Number((err.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).pop()?.match(/-?[\d.]+/)?.[0]);
  const silences = [...err.matchAll(/silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return { I, silences };
}

export function checkFile(file, want) {
  const issues = [];
  if (!fs.existsSync(file)) return { file: rel(file), ok: false, issues: ['파일 없음'] };
  const p = probe(file);
  const v = p.streams.find((s) => s.codec_type === 'video');
  const a = p.streams.find((s) => s.codec_type === 'audio');
  const dur = Number(p.format.duration);
  const fps = v ? eval(v.r_frame_rate) : 0;
  if (!v || v.width !== want.w || v.height !== want.h) issues.push(`해상도 ${v?.width}×${v?.height} (기대 ${want.w}×${want.h})`);
  if (Math.abs(fps - 30) > 0.01) issues.push(`fps ${fps}`);
  if (want.maxDur && dur > want.maxDur) issues.push(`길이 ${dur.toFixed(2)}초 > ${want.maxDur}`);
  if (!a) issues.push('소리 없음');
  const L = a ? loudness(file) : { I: NaN, silences: [] };
  if (a && !(L.I > -20 && L.I < -9)) issues.push(`음량 ${L.I} LUFS (기대 -20~-9)`);
  const longSil = L.silences.filter(([s, e]) => e - s > 1.5);
  if (longSil.length) issues.push(`긴 무음 ${longSil.map(([s, e]) => `${s.toFixed(1)}~${e.toFixed(1)}`).join(', ')}`);
  return { file: rel(file), ok: issues.length === 0, dur: Number(dur.toFixed(3)), size: `${v?.width}×${v?.height}`, fps, lufs: L.I, codec: `${v?.codec_name}/${v?.profile} ${v?.pix_fmt}, ${a?.codec_name} ${a?.sample_rate}Hz`, issues };
}

/** 대표 프레임 4장(세로 4편 → 4행, 가로 2편은 아래 행) */
export function sheet(n) {
  const times = [2.3, 6.0, 9.6, 13.6];
  const work = path.join(ROOT, 'shorts', '_work', 'sheet');
  fs.mkdirSync(work, { recursive: true });
  const rows = [];
  const langs = ALL_LANGS.filter((l) => fs.existsSync(path.join(ROOT, 'shorts', l, `${pad3(n)}.mp4`)));
  for (const [lang, wide] of [...langs.map((l) => [l, false]), ...langs.map((l) => [l, true])]) {
    const f = path.join(ROOT, 'shorts', lang, `${pad3(n)}${wide ? '-wide' : ''}.mp4`);
    if (!fs.existsSync(f)) continue;
    const row = path.join(work, `${lang}${wide ? '-w' : ''}.png`);
    const h = wide ? 270 : 480;
    const inputs = times.flatMap((t) => ['-ss', String(t), '-i', rel(f)]);
    const fc = times.map((_, i) => `[${i}:v]trim=end_frame=1,scale=-2:${h},drawbox=x=0:y=0:w=iw:h=ih:color=white@0.9:t=2[f${i}]`).join(';') + `;${times.map((_, i) => `[f${i}]`).join('')}hstack=${times.length}[o]`;
    ffmpeg([...inputs, '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', rel(row)]);
    rows.push(row);
  }
  const out = path.join(ROOT, 'shorts', `preview-${pad3(n)}.png`);
  // 행 폭을 같은 폭으로 맞춰 세로로 쌓는다
  const fc = rows.map((_, i) => `[${i}:v]scale=1600:-2,pad=1600:ih+8:0:0:black[r${i}]`).join(';') + `;${rows.map((_, i) => `[r${i}]`).join('')}vstack=${rows.length}[o]`;
  ffmpeg([...rows.flatMap((r) => ['-i', rel(r)]), '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', rel(out)]);
  return out;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'check.mjs') {
  const n = Number(process.argv[2]);
  const res = [];
  for (const lang of parseLangs(process.argv.find((a) => a.startsWith('--langs='))?.slice(8), 'all').filter((l) => fs.existsSync(path.join(ROOT, 'shorts', l, `${pad3(n)}.mp4`)))) {
    res.push(checkFile(path.join(ROOT, 'shorts', lang, `${pad3(n)}.mp4`), { w: 1080, h: 1920, maxDur: 14.5 }));
    res.push(checkFile(path.join(ROOT, 'shorts', lang, `${pad3(n)}-wide.mp4`), { w: 1920, h: 1080, maxDur: T.end + 0.2 }));
  }
  for (const r of res) console.log(`${r.ok ? 'OK ' : 'ERR'} ${r.file}  ${r.size ?? ''} ${r.dur ?? ''}초 ${r.fps ?? ''}fps ${r.lufs ?? ''}LUFS  ${r.codec ?? ''} ${r.issues.join(' / ')}`);
  if (process.argv.includes('--sheet')) console.log('미리보기:', rel(sheet(n)));
  process.exit(res.every((r) => r.ok) ? 0 : 1);
}
