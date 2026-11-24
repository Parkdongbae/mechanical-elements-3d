// 물레방아 실험 개발용 진입점 — 연결(main.ts / preview.ts) 뒤 삭제.
//   dev.html?wmq=320&wmt=20&wmpause=1&wmview=all&wmlabel=1&theme=dark   (쿼리는 WaterMill.ts 머리 주석)
//   window.__wmCycle(n): enter/exit 를 n번 되풀이하고 지오메트리·텍스처·DOM 수를 돌려준다
import * as THREE from 'three';
import { SceneManager } from '../../scene/SceneSetup';
import { ThumbnailFactory } from '../../models/thumbnails';
import { loadSettings } from '../../state/settings';
import type { AppMode, ModeContext } from '../../modes/types';
import { WaterMill } from '../WaterMill';
import '../../styles/tokens.css';
import '../../styles/modes.css';
import '../../styles/lab-mill.css';

const q = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('#scene not found');
const dark = q.get('theme') === 'dark';
document.documentElement.dataset.theme = dark ? 'dark' : 'light';

const sceneMgr = new SceneManager(canvas, { theme: dark ? 'dark' : 'light', quality: q.get('q') === 'low' ? 'low' : 'high' });
sceneMgr.setLabelsVisible(q.get('labels') !== '0');
sceneMgr.adaptive = false;

const root = document.createElement('div');
root.id = 'mode-root';
root.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:var(--font);color:var(--text)';
document.body.appendChild(root);

const settings = loadSettings();
const ctx: ModeContext = {
  sceneMgr,
  thumbs: new ThumbnailFactory(),
  root,
  settings,
  toast: (m) => console.log('[toast]', m),
  goHome: () => console.log('[goHome]'),
  playSound: () => {}
};

let mode: AppMode = new WaterMill();
mode.enter(ctx);

const w = window as unknown as Record<string, unknown>;
w.__wmCycle = (n: number): { geo0: number; geo1: number; tex0: number; tex1: number; dom0: number; dom1: number; leak0: number; leak1: number } => {
  const mem = sceneMgr.renderer.info.memory;
  const wm = w as { __wm?: { selfLeak(): number } };
  const cycle = (): void => {
    mode.exit();
    mode = new WaterMill();
    mode.enter(ctx);
    sceneMgr.render();
  };
  cycle();
  const geo0 = mem.geometries;
  const tex0 = mem.textures;
  const dom0 = root.querySelectorAll('*').length;
  const leak0 = wm.__wm?.selfLeak() ?? -1;
  for (let i = 0; i < n; i++) cycle();
  return { geo0, geo1: mem.geometries, tex0, tex1: mem.textures, dom0, dom1: root.querySelectorAll('*').length, leak0, leak1: wm.__wm?.selfLeak() ?? -1 };
};

const clock = new THREE.Clock();
let frames = 0;
function tick(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  sceneMgr.update(dt);
  mode.update(dt, clock.elapsedTime);
  sceneMgr.render();
  if (++frames === 3) w.__ready = true;
  requestAnimationFrame(tick);
}
tick();
