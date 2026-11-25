// 쇼츠 합성(지시서 21 · 5단계) — 같은 녹화 프레임으로 세로(1080×1920)·가로(1920×1080) 두 형식 + 업로드 메타데이터 JSON.
//   node scripts/shorts/compose.mjs <번호> [ko|en|both] [--vertical-only|--wide-only]
// 필요: record.mjs(프레임·motion), tts.mjs(더빙·자막), cards.mjs(카드), sfx.mjs(효과음 트랙 — 없으면 여기서 만든다)
// 배경음악: 기본은 모든 편 Badinerie(SHORTS_MUSIC 로 바꿈, 빈 값이면 이름순 (번호-1) % 곡 수). 곡이 없으면 ffmpeg 로 만든 잔잔한 임시 합성음.
//   곡 앞 무음은 건너뛰고 영상 길이로 자른 뒤 끝 1.5초 페이드아웃, 더빙이 나올 때 자동으로 낮춘다(사이드체인).
// 결과: shorts/<lang>/NNN.mp4, NNN-wide.mp4, NNN.json
import fs from 'node:fs';
import path from 'node:path';
import { FPS, H, ROOT, T, W, WH, WW, catalogEntry, ensureDir, ffmpeg, pad3, probe, rel, workDir } from './lib.mjs';
import { buildTrack } from './sfx.mjs';

const MUSIC_DIR = path.join(ROOT, 'assets', 'shorts', 'music');
const APP = 'https://mechanical-elements-3d.vercel.app/#/mm/';

export function pickMusic(n) {
  const list = fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR).filter((f) => /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(f)).sort() : [];
  if (!list.length) return null;
  // 사용자 결정(2026-11-25): 모든 편에 1번과 같은 곡(Badinerie). 곡을 돌려 쓰려면 SHORTS_MUSIC= (빈 값)
  const fixed = process.env.SHORTS_MUSIC ?? 'Badinerie';
  const f = (fixed && list.find((x) => x.toLowerCase().startsWith(fixed.toLowerCase()))) || list[(n - 1) % list.length];
  const base = path.parse(f).name;
  const m = base.match(/^(.*?)\s+-\s+(.*)$/);
  return { file: path.join(MUSIC_DIR, f), title: m ? m[1] : base, artist: m ? m[2] : '' };
}

/** 곡이 없을 때: 저음 패드(가온 화음 느린 숨) + 가벼운 리듬(부드러운 킥·셰이커) — 직접 합성, 저작권 문제 없음 */
function tempMusic() {
  const out = path.join(ensureDir(path.join(ROOT, 'shorts', '_work')), 'music-temp.wav');
  if (fs.existsSync(out)) return out;
  const pad = `0.10*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.25*t))+0.07*sin(2*PI*164.81*t)*(0.6+0.4*sin(2*PI*0.21*t+1))+0.06*sin(2*PI*220*t)+0.05*sin(2*PI*277.18*t)*(0.5+0.5*sin(2*PI*0.17*t))`;
  const kick = `0.35*sin(2*PI*(70-40*mod(t,0.5))*mod(t,0.5))*exp(-12*mod(t,0.5))`;
  ffmpeg(['-f', 'lavfi', '-i', `aevalsrc='${pad}+${kick}':s=48000:d=16`, '-f', 'lavfi', '-i', 'anoisesrc=d=16:c=pink:r=48000:a=0.02', '-filter_complex', `[1]highpass=f=5000,volume='0.6+0.4*sin(2*PI*4*t)':eval=frame[sh];[0][sh]amix=inputs=2:normalize=0,lowpass=f=6000[a]`, '-map', '[a]', '-ac', '2', out]);
  return out;
}

const S = (k) => `(${k})*(${k})*(3-2*(${k}))`; // smoothstep(ffmpeg 식)
const clipT = (a, d) => `clip((t-${a})/${d},0,1)`;

/** 오디오: 더빙 A·B + 배경음악(덕킹) + 효과음 → mix.wav (세로·가로가 함께 쓴다) */
function buildAudio(n, lang, music, sfxFile) {
  const dir = workDir(n, lang);
  const dub = JSON.parse(fs.readFileSync(path.join(dir, 'dub', 'dub.json'), 'utf8'));
  const out = path.join(dir, 'mix.wav');
  const mIn = music ? music.file : tempMusic();
  const aMs = Math.round(dub.aStart * 1000);
  const bMs = Math.round(dub.bStart * 1000);
  const fc = [
    `[0]adelay=${aMs}|${aMs},apad[a0]`,
    `[1]adelay=${bMs}|${bMs},apad[b0]`,
    `[a0][b0]amix=inputs=2:normalize=0,atrim=0:${T.end},aformat=channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,asplit=2[dub][key]`,
    `[2]silenceremove=start_periods=1:start_threshold=-40dB,atrim=0:${T.end},asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,aresample=48000,loudnorm=I=-19:TP=-2,afade=t=in:d=0.25,afade=t=out:st=${T.end - 1.5}:d=1.5[mus0]`,
    `[mus0][key]sidechaincompress=threshold=0.04:ratio=5:attack=40:release=350[mus]`,
    `[3]aformat=channel_layouts=stereo,aresample=48000[sfx]`,
    `[dub][mus][sfx]amix=inputs=3:normalize=0,alimiter=limit=0.95,atrim=0:${T.end}[out]`
  ].join(';');
  ffmpeg(['-i', path.join(dir, 'dub', 'a.mp3'), '-i', path.join(dir, 'dub', 'b.mp3'), '-i', mIn, '-i', sfxFile, '-filter_complex', fc, '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', out]);
  return out;
}

const pngSize = (f) => {
  const s = probe(f).streams[0];
  return [s.width, s.height];
};

/** 아웃트로 버튼·손가락 overlay 사슬(세로·가로 공통) */
function outroButtons(cards, cx, y0, inputs, last) {
  const [sw, sh] = pngSize(path.join(cards, 'sub-off.png'));
  const [sw2] = pngSize(path.join(cards, 'sub-on.png'));
  const [lw, lh] = pngSize(path.join(cards, 'like-off.png'));
  const gap = 34;
  const total = Math.max(sw, sw2) + gap + lw;
  const sx = Math.round(cx - total / 2);
  const lx = sx + Math.max(sw, sw2) + gap;
  const ly = y0 + Math.round((sh - lh) / 2);
  const t0 = T.pullEnd + 0.25;
  const tSub = t0 + 0.85;
  const tLike = tSub + 0.6;
  const slide = (y) => `'${y}+500*(1-${S(clipT(t0, 0.35))})'`;
  const subC = [sx + sw / 2, y0 + sh / 2];
  const likeC = [lx + lw / 2, ly + lh / 2];
  const start = [cx + 420, y0 + 520];
  // 손가락: t0+0.3 에 나타나 tSub-0.08 까지 구독 버튼으로, tLike-0.08 까지 좋아요로, 그 뒤 머묾
  const px = `if(lt(t,${tSub - 0.08}),${start[0]}+(${subC[0]}-${start[0]})*${S(clipT(t0 + 0.3, tSub - 0.08 - t0 - 0.3))},${subC[0]}+(${likeC[0]}-${subC[0]})*${S(clipT(tSub + 0.1, tLike - 0.18 - tSub - 0.1))})-30`;
  const py = `if(lt(t,${tSub - 0.08}),${start[1]}+(${subC[1]}-${start[1]})*${S(clipT(t0 + 0.3, tSub - 0.08 - t0 - 0.3))},${subC[1]}+(${likeC[1]}-${subC[1]})*${S(clipT(tSub + 0.1, tLike - 0.18 - tSub - 0.1))})-10`;
  const [iSubOff, iSubOn, iLikeOff, iLikeOn, iCur] = inputs;
  return [
    `[${last}][${iSubOff}]overlay=x=${sx}:y=${slide(y0)}:eval=frame:enable='between(t,${t0},${tSub})'[ob1]`,
    `[ob1][${iSubOn}]overlay=x=${sx}:y=${y0}:enable='gte(t,${tSub})'[ob2]`,
    `[ob2][${iLikeOff}]overlay=x=${lx}:y=${slide(ly)}:eval=frame:enable='between(t,${t0},${tLike})'[ob3]`,
    `[ob3][${iLikeOn}]overlay=x=${lx}:y=${ly}:enable='gte(t,${tLike})'[ob4]`,
    `[ob4][${iCur}]overlay=x='${px}':y='${py}':eval=frame:enable='gte(t,${t0 + 0.3})'[obend]`
  ];
}

const ENC = ['-threads', '4', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '19', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(T.end)];

/** 정지 그림 입력 — 필요한 시간만큼만(메모리: 1080×1920 RGBA 프레임이 쌓이지 않게) */
function loopImg(f, dur = T.end) {
  return ['-loop', '1', '-framerate', String(FPS), '-t', String(Math.min(T.end, dur)), '-i', f];
}
/** 움직이지 않는 그림은 한 장만 넣는다(overlay 는 끝난 입력의 마지막 장을 계속 쓴다) — 메모리 절약 */
const still = (f) => ['-i', f];

/** 세로 1080×1920 */
function composeVertical(n, lang, mix, outFile) {
  const dir = workDir(n, lang);
  const cards = path.join(dir, 'cards');
  const c = (f) => rel(path.join(cards, f));
  const inputs = [
    ...still(c('intro.png')), // 0 (첫 프레임만 zoompan 으로 늘림)
    '-framerate', String(FPS), '-i', rel(path.join(dir, 'frames', 'f%05d.jpg')), // 1
    ...still(c('split-top.png')), // 2
    ...loopImg(c('split-chip.png')), // 3
    ...loopImg(c('ghost.png')), // 4
    ...loopImg(c('badge.png')), // 5
    ...loopImg(c('outro.png')), // 6
    ...still(c('sub-off.png')), ...still(c('sub-on.png')), ...still(c('like-off.png')), ...still(c('like-on.png')), ...still(c('cursor.png')), // 7~11
    '-i', rel(mix) // 12
  ];
  const k = S(clipT(T.splitEnd, T.mergeEnd - T.splitEnd));
  const off = `${H / 4}*(1-${k})`; // 분할 동안 3D 를 480px 아래로(가운데가 아래 칸 가운데), 합칠 때 0 으로
  const zoomFrames = Math.round(T.introEnd * FPS) + 6;
  const fc = [
    `color=c=0x101010:s=${W}x${H}:r=${FPS}:d=${T.end}[bg]`,
    `[1]setpts=PTS+${T.rec0}/TB,format=rgba[v3d]`,
    `[bg][v3d]overlay=x=0:y='${off}':eval=frame:enable='gte(t,${T.rec0})'[s1]`,
    `[4]format=rgba,colorchannelmixer=aa=0.92,fade=t=in:st=${T.splitEnd}:d=${T.mergeEnd - T.splitEnd}:alpha=1,fade=t=out:st=${T.mergeEnd}:d=${T.ghostEnd - T.mergeEnd}:alpha=1[gh]`,
    `[s1][gh]overlay=x=0:y='${off}':eval=frame:enable='between(t,${T.splitEnd},${T.ghostEnd})'[s2]`,
    `[s2][2]overlay=x=0:y='-${H / 2}*${k}':eval=frame:enable='between(t,${T.introEnd - 0.1},${T.mergeEnd})'[s3]`,
    `[3]format=rgba,fade=t=out:st=${T.splitEnd - 0.2}:d=0.3:alpha=1[chip]`,
    `[s3][chip]overlay=x=0:y=${H / 2}:enable='between(t,${T.introEnd},${T.splitEnd + 0.2})'[s4]`,
    `[5]format=rgba,fade=t=in:st=${T.ghostEnd}:d=0.4:alpha=1,fade=t=out:st=${T.pullEnd - 0.4}:d=0.4:alpha=1[bd]`,
    `[s4][bd]overlay=0:0:enable='between(t,${T.ghostEnd},${T.pullEnd})'[s5]`,
    `[s5]ass=${rel(path.join(dir, 'dub', 'sub.ass'))}:fontsdir=assets/shorts/fonts[s6]`,
    `[6]format=rgba,fade=t=in:st=${T.pullEnd}:d=0.35:alpha=1[ot]`,
    `[s6][ot]overlay=0:0:enable='gte(t,${T.pullEnd})'[s7]`,
    ...outroButtons(cards, W / 2, Math.round(H * 0.5 + 290), [7, 8, 9, 10, 11], 's7'),
    // 인트로: 2배로 키운 뒤 zoompan(1.0→1.06), 끝 0.25초에 사라짐
    `[0]scale=${W * 2}:${H * 2},zoompan=z='1+0.06*on/${zoomFrames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${zoomFrames}:s=${W}x${H}:fps=${FPS},format=rgba,fade=t=out:st=${T.introEnd - 0.2}:d=0.25:alpha=1[intro]`,
    `[obend][intro]overlay=0:0:enable='lt(t,${T.introEnd + 0.1})',format=yuv420p[vout]`
  ].join(';');
  ffmpeg([...inputs, '-filter_complex', fc, '-map', '[vout]', '-map', '12:a', ...ENC, rel(outFile)]);
}

/** 가로 1920×1080 — 왼쪽 판화, 가운데 3D(세로 녹화의 가운데 1080×1080), 오른쪽 제목·쉬운 풀이 */
function composeWide(n, lang, mix, outFile) {
  const dir = workDir(n, lang);
  const cards = path.join(dir, 'cards');
  const c = (f) => rel(path.join(cards, f));
  const inputs = [
    ...still(c('intro-wide.png')), // 0
    '-framerate', String(FPS), '-i', rel(path.join(dir, 'frames', 'f%05d.jpg')), // 1
    ...still(c('wide-left.png')), // 2
    ...still(c('wide-right.png')), // 3
    ...loopImg(c('ghost.png')), // 4
    ...loopImg(c('outro-wide.png')), // 5
    ...still(c('sub-off.png')), ...still(c('sub-on.png')), ...still(c('like-off.png')), ...still(c('like-on.png')), ...still(c('cursor.png')), // 6~10
    '-i', rel(mix) // 11
  ];
  const cy = (H - WH) / 2; // 420
  const zoomFrames = Math.round(T.introEnd * FPS) + 6;
  const fc = [
    `color=c=0x17130e:s=${WW}x${WH}:r=${FPS}:d=${T.end}[bg]`,
    `[1]setpts=PTS+${T.rec0}/TB,crop=${WH}:${WH}:0:${cy}[v3d]`,
    `[bg][v3d]overlay=x=${(WW - WH) / 2}:y=0:enable='gte(t,${T.rec0})'[s1]`,
    `[4]crop=${WH}:${WH}:0:${cy},format=rgba,colorchannelmixer=aa=0.9,fade=t=out:st=${T.mergeEnd}:d=${T.ghostEnd - T.mergeEnd}:alpha=1[gh]`,
    `[s1][gh]overlay=x=${(WW - WH) / 2}:y=0:enable='between(t,${T.rec0},${T.ghostEnd})'[s2]`,
    `[s2][2]overlay=0:0[s3]`,
    `[s3][3]overlay=${WW - 420}:0[s4]`,
    `[s4]ass=${rel(path.join(dir, 'dub', 'sub-wide.ass'))}:fontsdir=assets/shorts/fonts[s5]`,
    `[5]format=rgba,fade=t=in:st=${T.pullEnd}:d=0.35:alpha=1[ot]`,
    `[s5][ot]overlay=${(WW - WH) / 2}:0:enable='gte(t,${T.pullEnd})'[s6]`,
    ...outroButtons(cards, WW / 2, Math.round(WH * 0.5 + 250), [6, 7, 8, 9, 10], 's6'),
    `[0]scale=${WW * 2}:${WH * 2},zoompan=z='1+0.05*on/${zoomFrames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${zoomFrames}:s=${WW}x${WH}:fps=${FPS},format=rgba,fade=t=out:st=${T.introEnd - 0.2}:d=0.25:alpha=1[intro]`,
    `[obend][intro]overlay=0:0:enable='lt(t,${T.introEnd + 0.1})',format=yuv420p[vout]`
  ].join(';');
  ffmpeg([...inputs, '-filter_complex', fc, '-map', '[vout]', '-map', '11:a', ...ENC, rel(outFile)]);
}

/** 업로드 메타데이터(PRD §9) */
export function metadata(n, lang, music, extra = {}) {
  const { entry } = catalogEntry(n);
  const sc = JSON.parse(fs.readFileSync(path.join(ROOT, 'shorts', 'scripts', `${lang}.json`), 'utf8'))[String(n)] ?? {};
  const url = `${APP}${n}`;
  const musicLine = music ? `Music: ${music.title}${music.artist ? ` - ${music.artist}` : ''} (YouTube Audio Library)` : null;
  if (lang === 'ko') {
    const title = `[한] [507 기계 운동 #${n}] ${entry?.title ?? ''} #shorts`;
    return {
      n,
      lang,
      title,
      description: [entry?.easy ?? '', '', `▶ 앱에서 직접 돌려 보기: ${url}`, '', `원서: Henry T. Brown, 『Five Hundred and Seven Mechanical Movements』(1868), ${n}번`, '', '#507기계운동 #기계 #기구학 #shorts', ...(musicLine ? ['', musicLine] : [])].join('\n'),
      tags: ['507 기계 운동', '기계', '기구학', '기계요소', '과학', entry?.title, 'mechanism', 'engineering', '507movements', 'shorts'].filter(Boolean),
      categoryId: '27',
      defaultLanguage: 'ko',
      playlist: '507 기계 운동 (한국어)',
      script: sc,
      url,
      music: music ? { title: music.title, artist: music.artist } : null,
      ...extra
    };
  }
  const title = `[EN] [507 Mechanical Movements #${n}] ${entry?.titleEn ?? ''} #shorts`;
  return {
    n,
    lang,
    title,
    description: [entry?.easyEn ?? '', '', `▶ Spin it yourself in the app: ${url}`, '', `From Henry T. Brown, "Five Hundred and Seven Mechanical Movements" (1868), No. ${n}`, '', '#507movements #mechanism #engineering #shorts', ...(musicLine ? ['', musicLine] : [])].join('\n'),
    tags: ['507 mechanical movements', 'mechanism', 'engineering', 'kinematics', 'machine design', entry?.titleEn, 'how it works', '507movements', 'shorts'].filter(Boolean),
    categoryId: '27',
    defaultLanguage: 'en',
    playlist: '507 Mechanical Movements (English)',
    script: sc,
    url,
    music: music ? { title: music.title, artist: music.artist } : null,
    ...extra
  };
}

export function compose(n, lang, { vertical = true, wide = true } = {}) {
  const music = pickMusic(n);
  const sfxFile = path.join(workDir(n), 'sfx.wav');
  if (!fs.existsSync(sfxFile)) {
    const tags = JSON.parse(fs.readFileSync(path.join(ROOT, 'shorts', '_work', 'cam', `${pad3(n)}.json`), 'utf8')).emphTag;
    buildTrack(n, { tags: tags ? [tags] : [] });
  }
  const outDir = ensureDir(path.join(ROOT, 'shorts', lang));
  const t0 = Date.now();
  const mix = buildAudio(n, lang, music, sfxFile);
  const files = {};
  if (vertical) {
    files.vertical = path.join(outDir, `${pad3(n)}.mp4`);
    composeVertical(n, lang, mix, files.vertical);
  }
  if (wide) {
    files.wide = path.join(outDir, `${pad3(n)}-wide.mp4`);
    composeWide(n, lang, mix, files.wide);
  }
  const sfx = JSON.parse(fs.readFileSync(path.join(workDir(n), 'sfx.json'), 'utf8'));
  const meta = metadata(n, lang, music, { files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, rel(v)])), sfx: sfx.kinds });
  fs.writeFileSync(path.join(outDir, `${pad3(n)}.json`), JSON.stringify(meta, null, 2));
  console.log(`[compose] ${pad3(n)} ${lang} ${((Date.now() - t0) / 1000).toFixed(1)}초 → ${Object.values(files).map(rel).join(', ')} (음악: ${music ? music.title : '임시 합성음'})`);
  return files;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'compose.mjs') {
  const n = Number(process.argv[2]);
  const which = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'both';
  const opt = { vertical: !process.argv.includes('--wide-only'), wide: !process.argv.includes('--vertical-only') };
  for (const lang of which === 'both' ? ['ko', 'en'] : [which]) compose(n, lang, opt);
}
