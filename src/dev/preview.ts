// 개발용 미리보기 (HUD 없이 모델만) — 배포 번들에는 포함되지 않는다(preview.html 전용).
//   /preview.html?part=spurGear            부품 1종
//   /preview.html?parts=all                부품 22종 격자
//   /preview.html?mode=bike | car | power   탐구 실험(자전거 변속·자동차 변속·동력 전달) 단독 실행
//   /preview.html?mode=enc | mode=quiz      학습 모드(도감·퀴즈) 단독 실행
//   /preview.html?machine=gearhunt&hunt=spur_gear1,bevel_gear1,...  드래그 조립형의 조립 상태 복원
//   /preview.html?machine=bicycle&steps=6  기계 + n단계 조립(steps=all 가능, 완료 시 시뮬레이션 가동)
// 공통 옵션: &theme=dark  &q=low  &cam=x,y,z,tx,ty,tz  &t=3 (시뮬레이션을 t초 진행 후 정지)

import * as THREE from 'three';
import { SceneManager, type CameraView } from '../scene/SceneSetup';
import { buildPart, normalizePart } from '../models/factory';
import { PARTS } from '../data/elements';
import { getMachineDef } from '../data/machines';
import { isDragMachine, type Machine, type MachineSim } from '../machines/types';
import type { AppMode } from '../modes/types';
import { Encyclopedia } from '../modes/Encyclopedia';
import { Quiz } from '../modes/Quiz';
import { BikeGears } from '../labs/BikeGears';
import { CarShift } from '../labs/CarShift';
import { PowerFlow } from '../labs/PowerFlow';
import '../styles/lab-bike.css';
import '../styles/lab-car.css';
import '../styles/lab-power.css';
import { ThumbnailFactory } from '../models/thumbnails';
import { loadSettings } from '../state/settings';
import '../styles/tokens.css';
import '../styles/modes.css';

const q = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('#scene not found');
const info = document.querySelector<HTMLElement>('#info');

const sceneMgr = new SceneManager(canvas, {
  theme: q.get('theme') === 'dark' ? 'dark' : 'light',
  quality: q.get('q') === 'low' ? 'low' : 'high'
});
sceneMgr.setLabelsVisible(q.get('labels') !== '0');
sceneMgr.adaptive = false; // 캡처용 — 헤드리스의 낮은 프레임률 때문에 품질이 내려가지 않게

let machine: Machine | null = null;
let sim: MachineSim | null = null;
let view: CameraView | null = null;

const shadow = (o: THREE.Object3D): void => {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
};

let mode: AppMode | null = null;
const modeArg = q.get('mode');
document.documentElement.dataset.theme = q.get('theme') === 'dark' ? 'dark' : 'light';

const partId = q.get('part');
const MODE_CTORS: Record<string, () => AppMode> = {
  enc: () => new Encyclopedia(),
  quiz: () => new Quiz(),
  bike: () => new BikeGears(),
  car: () => new CarShift(),
  power: () => new PowerFlow()
};
if (modeArg && MODE_CTORS[modeArg]) {
  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:var(--font);color:var(--text)';
  document.body.appendChild(root);
  if (info) info.style.display = 'none';
  mode = MODE_CTORS[modeArg]!();
  mode.enter({
    sceneMgr,
    thumbs: new ThumbnailFactory(),
    root,
    settings: loadSettings(),
    toast: (m) => console.log('[toast]', m),
    goHome: () => console.log('[goHome]'),
    playSound: () => {}
  });
} else if (partId) {
  const def = PARTS.find((p) => p.id === partId || p.builder === partId);
  if (!def) throw new Error(`unknown part ${partId}`);
  const model = normalizePart(buildPart(def.builder), 2.4);
  model.position.y = 1.5;
  shadow(model);
  sceneMgr.add(model);
  view = { pos: [2.6, 2.9, 4.2], target: [0, 1.5, 0] };
  if (info) info.textContent = `${def.id} — ${def.name}`;
} else if (q.get('parts') === 'all') {
  PARTS.forEach((def, i) => {
    const model = normalizePart(buildPart(def.builder), 1.5);
    model.position.set(((i % 6) - 2.5) * 2.0, 1.0, (Math.floor(i / 6) - 1.5) * 2.2);
    shadow(model);
    sceneMgr.add(model);
  });
  view = { pos: [0, 10.5, 9.5], target: [0, 0.4, 0.3] };
  if (info) info.textContent = PARTS.map((p, i) => `${i + 1}.${p.name}`).join('  ');
} else {
  const id = q.get('machine') ?? 'bicycle';
  const def = getMachineDef(id);
  machine = def.create();
  sceneMgr.add(machine.group);
  const stepsArg = q.get('steps') ?? '0';
  const n = stepsArg === 'all' ? machine.stepCount : Math.min(Number(stepsArg), machine.stepCount);
  for (let i = 0; i < n; i++) {
    machine.installStep(i, machine.buildStepModel(i));
    const ups = machine.getFollowUps?.(i) ?? [];
    ups.forEach((u, idx) => machine!.installFollowUp?.(i, idx, u.model));
  }
  if (n >= machine.stepCount && def.steps.length > 0) sim = machine.createSim();
  // 드래그 조립형(기어의 종류): &hunt=id1,id2,... 로 조립된 상태를 복원해 본다
  if (isDragMachine(machine)) {
    sim = machine.createSim();
    const ids = (q.get('hunt') ?? '').split(',').filter(Boolean);
    machine.beginHunt(ids);
  }
  view = def.view ?? null;
  if (info) info.textContent = `${def.name} — ${n}/${machine.stepCount}단계`;
}

const cam = q.get('cam');
if (cam) {
  const v = cam.split(',').map(Number);
  if (v.length === 6 && v.every((x) => Number.isFinite(x))) {
    view = { pos: [v[0]!, v[1]!, v[2]!], target: [v[3]!, v[4]!, v[5]!] };
  }
}
if (view) sceneMgr.flyTo(view, true);

if (q.get('ui') === '0' && info) info.style.display = 'none';

const stopAt = q.get('t') ? Number(q.get('t')) : Infinity;
const clock = new THREE.Clock();
let simTime = 0;
function tick(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  sceneMgr.update(dt);
  machine?.update(clock.elapsedTime);
  mode?.update(dt, clock.elapsedTime);
  if (sim && simTime < stopAt) {
    simTime += dt;
    sim.update(dt);
  }
  sceneMgr.render();
  requestAnimationFrame(tick);
}
tick();
(window as unknown as Record<string, unknown>).__ready = true;
