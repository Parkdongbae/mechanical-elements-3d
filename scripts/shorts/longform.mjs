// 가로 긴 영상(PRD §13-4) 골격 — 번호별 가로판(NNN-wide.mp4)을 이어 1~2분 유튜브 일반 영상으로.
//   node scripts/shorts/longform.mjs <ko|en> <번호들: 1-10 또는 1,2,5> [--out=파일]
// 규칙: 첫 편만 인트로(0~T.introEnd)를 남기고, 마지막 편만 아웃트로(T.pullEnd~끝)를 남긴다.
//       가운데는 작동 구간(T.introEnd~T.pullEnd, 10초)만 — 10편이면 약 1분 44초.
//       편 사이는 0.25초 페이드(영상·소리). 결과: shorts/<lang>/long-<처음>-<끝>.mp4
// 다음에 할 일(골격이라 아직 없음): 긴 영상 전체에 한 곡을 깔기(지금은 편마다 섞인 소리를 그대로 이음 —
//   compose.mjs 가 더빙·효과음만 뺀 줄기 파일을 따로 남기게 하면 바꿀 수 있다), 챕터 표시(설명란 타임스탬프) 만들기.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir, ffmpeg, pad3, rel, timeline } from './lib.mjs';

function parseNums(s) {
  const out = [];
  for (const part of s.split(',')) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i);
    else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return out;
}

export function longform(lang, nums, outFile) {
  const clips = nums.map((n) => ({ n, f: path.join(ROOT, 'shorts', lang, `${pad3(n)}-wide.mp4`) })).filter((c) => fs.existsSync(c.f));
  if (!clips.length) throw new Error('가로판 파일이 없다 — 먼저 compose.mjs');
  const F = 0.25;
  const parts = [];
  const chapters = [];
  let at = 0;
  clips.forEach((c, i) => {
    const T = timeline(c.n); // 번호별 길이(15·20·25초)
    const s = i === 0 ? 0 : T.introEnd;
    const e = i === clips.length - 1 ? T.end : T.pullEnd;
    const d = e - s;
    chapters.push({ n: c.n, at: Math.round(at * 10) / 10 });
    at += d;
    parts.push(
      `[${i}:v]trim=${s}:${e},setpts=PTS-STARTPTS,fade=t=in:d=${i === 0 ? 0.01 : F},fade=t=out:st=${d - F}:d=${F}[v${i}]`,
      `[${i}:a]atrim=${s}:${e},asetpts=PTS-STARTPTS,afade=t=in:d=${i === 0 ? 0.01 : F},afade=t=out:st=${d - F}:d=${F}[a${i}]`
    );
  });
  const fc = parts.join(';') + ';' + clips.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${clips.length}:v=1:a=1[v][a]`;
  ffmpeg([...clips.flatMap((c) => ['-i', rel(c.f)]), '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', rel(outFile)]);
  // 설명란용 챕터(유튜브는 0:00 부터 시작해야 챕터로 인식)
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  fs.writeFileSync(outFile.replace(/\.mp4$/, '.chapters.txt'), chapters.map((c) => `${mmss(c.at)} #${c.n}`).join('\n') + '\n');
  return { outFile, seconds: at, clips: clips.length };
}

if (process.argv[1] && path.basename(process.argv[1]) === 'longform.mjs') {
  const lang = process.argv[2];
  const nums = parseNums(process.argv[3] ?? '');
  if (!['ko', 'en'].includes(lang) || !nums.length) {
    console.error('사용: node scripts/shorts/longform.mjs <ko|en> <1-10 | 1,2,5> [--out=파일]');
    process.exit(2);
  }
  const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
  const out = outArg ? path.resolve(outArg) : path.join(ensureDir(path.join(ROOT, 'shorts', lang)), `long-${pad3(nums[0])}-${pad3(nums[nums.length - 1])}.mp4`);
  const r = longform(lang, nums, out);
  console.log(`[longform] ${lang} ${r.clips}편 ${r.seconds.toFixed(1)}초 → ${rel(r.outFile)}`);
}
