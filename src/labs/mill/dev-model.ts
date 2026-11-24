// 물레방아 모델 개발용 진입점(UI 없음) — 연결 뒤 삭제.
//   dev-model.html?wmth=<도>&wmq=<L/s>&wmt=<초>&wmpause=1&wmview=all|wheel|cam|pestle&wmfocus=wheel,blade&theme=dark
//   wmth: 손으로 돌린 정지 자세(physics.pose). wmq: 물의 양(물길 열림) + wmt 초 미리 계산.
import { SceneManager } from '../../scene/SceneSetup';
import '../../styles/tokens.css';
import { MillModel } from './model';
import { MillPhysics } from './physics';
import type { PartKey, ViewKey } from './types';

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

const model = new MillModel();
sceneMgr.add(model.root);
const phys = new MillPhysics();

const wmth = q.get('wmth');
const wmq = q.get('wmq');
const wmt = Number(q.get('wmt') ?? '0');
let live = false;
if (wmth !== null) {
  phys.pose((Number(wmth) * Math.PI) / 180);
} else if (wmq !== null) {
  phys.q = Number(wmq) / 1000;
  phys.gateOpen = true;
  model.setGate(true);
  const h = 1 / 120;
  const n = Math.round(wmt / h);
  for (let i = 0; i < n; i++) {
    const strikes = phys.step(h);
    for (const s of strikes) model.strike(s.beam, s.energy);
    // 물 입자는 마지막 3초만 만든다
    if (i > n - 360) {
      model.apply(phys.state);
      model.updateWater(phys.state, h);
    }
  }
  live = q.get('wmpause') !== '1';
}
model.apply(phys.state);
model.updateWater(phys.state, 1 / 60);

const view = (q.get('wmview') ?? 'all') as ViewKey;
const aspect = (): number => window.innerWidth / window.innerHeight;
// wmcam=x,y,z,tx,ty,tz : 실제 m 좌표로 시점을 직접 정한다(점검용)
const cam = q.get('wmcam')?.split(',').map(Number);
if (cam && cam.length === 6) {
  const rp = model.root.position;
  const k = model.root.scale.x;
  const c = cam as [number, number, number, number, number, number];
  sceneMgr.flyTo({
    pos: [rp.x + c[0] * k, rp.y + c[1] * k, rp.z + c[2] * k],
    target: [rp.x + c[3] * k, rp.y + c[4] * k, rp.z + c[5] * k]
  }, true);
} else sceneMgr.flyTo(model.view(view, aspect()), true);
if (q.get('wmhide') === 'shaft') (model as unknown as { shaftG: { visible: boolean } }).shaftG.visible = false;
const focus = q.get('wmfocus');
if (focus) model.setFocus(focus.split(',') as PartKey[]);
if (info) info.textContent = `wmth=${wmth ?? '-'} wmq=${wmq ?? '-'} view=${view}`;
w.__millModel = model;
w.__millPhys = phys;

let last = performance.now();
let frames = 0;
function tick(): void {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (live) {
    const strikes = phys.step(dt);
    for (const s of strikes) model.strike(s.beam, s.energy);
    model.apply(phys.state);
    model.updateWater(phys.state, dt);
  } else if (wmth === null && wmq === null) model.updateWater(phys.state, dt);
  sceneMgr.update(dt);
  sceneMgr.render();
  if (++frames === 3) w.__ready = true;
  requestAnimationFrame(tick);
}
tick();

// 누수 검사: count 번 만들고 지운 뒤 지오메트리 수를 돌려준다
w.__millLeak = (count: number): { start: number; end: number } => {
  const mem = sceneMgr.renderer.info.memory;
  const once = (): void => {
    const m = new MillModel();
    sceneMgr.add(m.root);
    sceneMgr.render();
    m.dispose();
    sceneMgr.render();
  };
  once();
  const start = mem.geometries;
  for (let i = 0; i < count; i++) once();
  return { start, end: mem.geometries };
};
