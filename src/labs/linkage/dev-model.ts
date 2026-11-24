// 링크 모델 개발용 진입점(UI 없음) — 연결 뒤 삭제.
//   dev-model.html?lk=<id>&lkq=<입력>&theme=dark&tilt=1&lkfull=1&lkrole=input
//   lkq: 각도(°) / 슬라이드(cm) / 팬터그래프는 "도형번호:진행도"   lk=custom&lkdim=a,b,c,d[,u,v]
import { SceneManager } from '../../scene/SceneSetup';
import '../../styles/tokens.css';
import { LinkageModel } from './model';
import { MECHANISMS, getMechanism } from './mechanisms';
import { advance, fourbar, inputRange, pathPoint, solve, sweep } from './solver';
import type { MechanismDef, Pose, Role, Sweep } from './types';

const q = new URLSearchParams(location.search);
const dark = q.get('theme') === 'dark';
document.documentElement.dataset.theme = dark ? 'dark' : 'light';
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('#scene not found');
const info = document.querySelector<HTMLElement>('#info');
const w = window as unknown as Record<string, unknown>;

const sceneMgr = new SceneManager(canvas, { theme: dark ? 'dark' : 'light', quality: q.get('q') === 'low' ? 'low' : 'high' });
sceneMgr.setLabelsVisible(false);
sceneMgr.adaptive = false;

const model = new LinkageModel();
sceneMgr.add(model.root);

const id = q.get('lk') ?? 'crank-rocker';
const lkq = q.get('lkq');
let def: MechanismDef | undefined;
let sw: Sweep;
let gap: [number, number, number, number] | null = null;
let range: { min: number; max: number; full: boolean } | null = null;

if (id === 'custom') {
  const dim = (q.get('lkdim') ?? '3,9,7,10').split(',').map(Number);
  const [a, b, c, d, u = 4.5, v = 3] = dim as [number, number, number, number, number?, number?];
  def = fourbar(a, b, c, d, u, v);
  const r = inputRange(a, b, c, d);
  if (!r) {
    gap = [a, b, c, d];
    sw = { poses: [], qs: [], full: false, qMin: 0, qMax: 0, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  } else {
    range = r;
    sw = sweep(def);
  }
} else {
  def = getMechanism(id);
  if (!def) {
    if (info) info.textContent = `unknown mechanism ${id} (${MECHANISMS.map((m) => m.id).join(', ')})`;
    throw new Error('unknown mechanism');
  }
  sw = sweep(def);
}

model.load(def, sw);
if (gap) model.setGap(...gap);

function animateTo(): void {
  if (!def || gap) return;
  const inp = def.input;
  const deg = Math.PI / 180;
  let pose: Pose;
  if (inp.kind === 'point') {
    const [pi, prog] = (lkq ?? '0:0.25').split(':').map(Number) as [number, number];
    const path = inp.paths[Math.min(pi, inp.paths.length - 1)]!.pts;
    pose = solve(def, pathPoint(path, 0), null);
    model.setPose(pose);
    const n = 80;
    for (let i = 1; i <= n; i++) {
      pose = solve(def, pathPoint(path, (prog * i) / n), pose);
      model.setPose(pose);
    }
    return;
  }
  const q0 = inp.q0;
  pose = solve(def, q0, null);
  model.setPose(pose);
  if (lkq === null) return;
  let target = inp.kind === 'slide' ? Number(lkq) : Number(lkq) * deg;
  if (inp.kind === 'rotate') while (target < q0) target += Math.PI * 2;
  const n = 180;
  for (let i = 1; i <= n; i++) {
    pose = advance(def, pose, q0 + ((target - q0) * i) / n);
    model.setPose(pose);
  }
}
animateTo();
if (range) model.setRange(range.min, range.max, range.full);
if (q.get('lkfull') === '1') model.setFullPath(sw);
if (q.get('lkrole')) model.setRoleHighlight(q.get('lkrole') as Role);
if (id === 'chebyshev') model.setGuide({ p: [0, 4], dir: [1, 0] });
if (id === 'watt') model.setGuide({ p: [6, 0], dir: [0, 1] });

const aspect = (): number => window.innerWidth / window.innerHeight;
sceneMgr.flyTo(model.view(q.get('tilt') === '1', aspect()), true);
sceneMgr.controls.enableRotate = q.get('tilt') === '1';
if (info) info.textContent = `${def.name}${lkq !== null ? ` · lkq=${lkq}` : ''}`;
w.__lkModel = model;

let last = performance.now();
let frames = 0;
function tick(): void {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  sceneMgr.update(dt);
  sceneMgr.render();
  if (++frames === 3) w.__ready = true;
  requestAnimationFrame(tick);
}
tick();

// 누수 검사: 기구를 count번 바꿔 렌더한 뒤 지오메트리·텍스처 수를 돌려준다
w.__lkLeak = (count: number): { start: number; mid: number; end: number; tex: number } => {
  const mem = sceneMgr.renderer.info.memory;
  const cycle = (): void => {
    for (const m of MECHANISMS) {
      const s2 = sweep(m);
      model.load(m, s2);
      const p = s2.poses[0];
      if (p) model.setPose(p);
      model.setFullPath(s2);
      sceneMgr.render();
    }
  };
  cycle();
  const start = mem.geometries;
  for (let i = 0; i < Math.floor(count / 2); i++) cycle();
  const mid = mem.geometries;
  for (let i = 0; i < Math.ceil(count / 2); i++) cycle();
  return { start, mid, end: mem.geometries, tex: mem.textures };
};
