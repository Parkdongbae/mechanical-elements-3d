// 「507 기계 운동」 쇼츠 파이프라인 공통 — 경로, ffmpeg, 시간표(PRD §3), 카탈로그. (지시서 21)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FFMPEG = process.env.FFMPEG || require('ffmpeg-static');
export const FFPROBE = process.env.FFPROBE || require('ffprobe-static').path;
export const BASE = process.env.SHORTS_BASE || 'http://localhost:5274/';

export const FPS = 30;
export const W = 1080; // 세로판
export const H = 1920;
export const WW = 1920; // 가로판
export const WH = 1080;

/**
 * 영상 시간표(초, 세로·가로 공통). 녹화는 T.rec0 부터 T.end 까지(프레임 i ↔ 영상 T.rec0 + i/FPS).
 * ② 훅 = 분할 화면(위 판화·아래 3D) → 분할에서 전체 3D 로(판화가 3D 위로 정합) → 겹친 판화 사라짐
 */
export const T = {
  introEnd: 1.5,
  rec0: 1.5,
  splitEnd: 3.0, // 1.5~3.0 분할 화면(PRD §13-3, 1.5초)
  mergeEnd: 3.5, // 3.0~3.5 분할 → 전체 화면(판화가 3D 위 같은 자리로 내려와 겹침)
  ghostEnd: 4.0, // 3.5~4.0 겹친 판화 투명도 1→0 (PRD §4-1)
  orbitEnd: 8.0, // 4.0~8.0 궤도 45°·다가가기
  closeIn: 8.8, // 8.0~8.8 핵심부로 날아감
  closeEnd: 10.5, // 8.8~10.5 클로즈업(0.5배 재생, 이름표 강조)
  pullEnd: 11.5, // 10.5~11.5 전체로 물러남
  end: 14.4 // 11.5~14.4 아웃트로(≤14.5초)
};
export const REC_FRAMES = Math.round((T.end - T.rec0) * FPS);

export const pad3 = (n) => String(n).padStart(3, '0');
export const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
export const ensureDir = (d) => (fs.mkdirSync(d, { recursive: true }), d);

export function workDir(n, lang) {
  return lang ? path.join(ROOT, 'shorts', '_work', lang, pad3(n)) : path.join(ROOT, 'shorts', '_work', 'common', pad3(n));
}

let _cat = null;
export function catalogEntry(n) {
  if (!_cat) _cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'mm507', 'catalog.json'), 'utf8'));
  const arr = Array.isArray(_cat) ? _cat : Object.values(_cat);
  return { entry: arr.find((e) => e && e.n === n) ?? null, all: arr };
}

/** 같은 분류(cat) 안의 순번 — "벨트 3/11" 진행 표시(PRD §13-2) */
export function seriesOf(n) {
  const { entry, all } = catalogEntry(n);
  if (!entry) return null;
  const same = all.filter((e) => e && e.cat === entry.cat).sort((a, b) => a.n - b.n);
  return { cat: entry.cat, i: same.findIndex((e) => e.n === n) + 1, count: same.length };
}

export const CAT_NAME = {
  ko: { belt: '벨트', gear: '기어', tool: '공구', ratchet: '래칫', crank: '크랭크', cam: '캠', governor: '조속기', pump: '펌프', steam: '증기', escapement: '탈진기', misc: '기타' },
  en: { belt: 'Belts', gear: 'Gears', tool: 'Tools', ratchet: 'Ratchets', crank: 'Cranks', cam: 'Cams', governor: 'Governors', pump: 'Pumps', steam: 'Steam', escapement: 'Escapements', misc: 'Misc' }
};

/** ffmpeg/ffprobe 실행(작업 폴더 = 저장소 루트 → 필터 안 경로는 상대 경로로 써서 'E:' 콜론 문제를 피한다) */
export function run(bin, args, { quiet = true } = {}) {
  let r = spawnSync(bin, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  // Windows 에서 가끔 ffmpeg 가 비정상 종료 코드(0xC... 계열, 255 초과)로 죽는다 — 한 번 다시 돌린다
  if (r.status !== 0 && (r.status === null || r.status > 255)) {
    console.warn(`[run] ${path.basename(bin)} 비정상 종료(${r.status}) — 다시 시도`);
    r = spawnSync(bin, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  }
  if (r.status !== 0) {
    console.error((r.stderr || '').split('\n').slice(-30).join('\n'));
    throw new Error(`${path.basename(bin)} 실패(${r.status})`);
  }
  if (!quiet) process.stdout.write(r.stderr || '');
  return r;
}
export const ffmpeg = (args, o) => run(FFMPEG, ['-hide_banner', '-y', ...args], o);

export function probe(file) {
  const r = run(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  return JSON.parse(r.stdout);
}

export const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const lerp = (a, b, k) => a + (b - a) * k;
