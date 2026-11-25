// 개발용 미리보기 (HUD 없이 모델만) — 배포 번들에는 포함되지 않는다(preview.html 전용).
//   /preview.html?part=spurGear            부품 1종
//   /preview.html?parts=all                부품 22종 격자
//   /preview.html?mode=bike | car | power   탐구 실험(자전거 변속·자동차 변속·동력 전달) 단독 실행
//   /preview.html?mode=enc | mode=quiz      학습 모드(도감·퀴즈) 단독 실행
//   /preview.html?machine=gearhunt&hunt=spur_gear1,bevel_gear1,...  드래그 조립형의 조립 상태 복원
//   /preview.html?machine=bicycle&steps=6  기계 + n단계 조립(steps=all 가능, 완료 시 시뮬레이션 가동)
//   /preview.html?mm=<n> | mm=kit          「507 기계 운동」 모델(레지스트리 지연 로딩)·키트 부품 시연
// 공통 옵션: &theme=dark  &q=low  &cam=x,y,z,tx,ty,tz  &t=3 (시뮬레이션을 t초 진행 후 정지)  &speed=배율(mm 전용, 기본 1)
//           &labels=0|1 (이름표 끔/켬 — 실험은 설정을 덮어쓰고, mm 은 화살표는 두고 이름표만)
//           &mmsrc=/src/경로.ts (mm 전용: 레지스트리 대신 그 모듈을 불러옴 — 옛 판·임시 모델 검사)
//           &lang=ko|en (mm 전용: en 이면 이름표 글자를 영어 사전으로 — Gallery 와 같은 retextTags)
//           &arrows=0|1 (mm 전용: 회전·움직임 화살표 메시 끔/켬 — Gallery 와 같은 setArrowsVisible)
//           &leaders=1 (mm 전용: 이름표 지시선 TagLeaders — 쇼츠 녹화용. labels=0 이면 숨김)
// mm 전용(지시서 20 · 3-1): &t=T 는 실시간 프레임을 기다리지 않고 update(0.02, speed) 를 T 까지 한꺼번에 돌린다
//           (바로 점프, 끝나면 window.__mmReady = true). &live=1 이면 예전처럼 실제 프레임으로 T 까지 쌓는다.
//           window.__mm = { seek(t, speed=1), cam(x,y,z,tx,ty,tz), labels(on), theme(name), render(),
//                           emph(text|null, k), tags(), model, group, time, errors } — 한 페이지에서 시각·시점만 바꿔 여러 장 찍기·수치 검사용

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
import '../styles/lab-wind.css';
import { WindTunnel } from '../labs/WindTunnel';
import { EngineCycle } from '../labs/EngineCycle';
import '../styles/lab-cycle.css';
import { EngineTypes } from '../labs/EngineTypes';
import '../styles/lab-engines.css';
import { SteamEngines } from '../labs/SteamEngines';
import '../styles/lab-steam.css';
import { HandPump } from '../labs/HandPump';
import '../styles/lab-pump.css';
import { Linkage } from '../labs/Linkage';
import '../styles/lab-link.css';
import { WaterMill } from '../labs/WaterMill';
import '../styles/lab-mill.css';
import { Gallery } from '../mm507/Gallery';
import '../styles/mm507.css';
import { ThumbnailFactory } from '../models/thumbnails';
import { loadSettings } from '../state/settings';
import { loadModel } from '../mm507/registry';
import { countTags, setTagsVisible } from '../mm507/kit';
import { retextTags, setArrowsVisible } from '../mm507/kit/misc';
import { TagLeaders } from '../mm507/leaders';
import { loadEnDict } from '../mm507/lang';
import buildKitDemo from '../mm507/kitDemo';
import type { MovementModel } from '../mm507/types';
import '../styles/tokens.css';
import '../styles/modes.css';

const q = new URLSearchParams(location.search);

// 로드 뒤 쌓인 콘솔 에러·경고(window.__mm.errors) — autocheck 가 읽는다
const mmErrors: string[] = [];
{
  const fmt = (args: unknown[]): string =>
    args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : String(a))).join(' ');
  const origErr = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...a: unknown[]): void => {
    mmErrors.push('error: ' + fmt(a));
    origErr(...a);
  };
  console.warn = (...a: unknown[]): void => {
    mmErrors.push('warn: ' + fmt(a));
    origWarn(...a);
  };
  window.addEventListener('error', (e) => mmErrors.push('pageerror: ' + String(e.message)));
  window.addEventListener('unhandledrejection', (e) => mmErrors.push('rejection: ' + String(e.reason)));
}
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('#scene not found');
const info = document.querySelector<HTMLElement>('#info');

const sceneMgr = new SceneManager(canvas, {
  theme: q.get('theme') === 'dark' ? 'dark' : 'light',
  quality: q.get('q') === 'low' ? 'low' : 'high'
});
const labelsArg = q.get('labels'); // '0' | '1' | null
sceneMgr.setLabelsVisible(labelsArg !== '0');
sceneMgr.adaptive = false; // 캡처용 — 헤드리스의 낮은 프레임률 때문에 품질이 내려가지 않게

let machine: Machine | null = null;
let sim: MachineSim | null = null;
let view: CameraView | null = null;
let mmModel: MovementModel | null = null;
let mmSpeed = 1;
/** 이름표 지시선(&leaders=1) — 모델이 처음 자세를 잡은 뒤 만든다 */
let mmLeaders: TagLeaders | null = null;
/** mm 바로 점프 모드(&t 가 있고 &live=1 이 아님) — 프레임 루프가 모델을 진행시키지 않는다 */
const mmJump = q.get('t') !== null && q.get('live') !== '1';
/** 모델에 지금까지 넘긴 Σ speed·dt (절대 자세 규약: 자세는 이 누적 위상만의 함수) */
let mmPhase = 0;
const MM_DT = 0.02;

/** 누적 위상을 target 까지 고정 dt 로 옮긴다(앞으로든 뒤로든). 모델은 새로 만들지 않는다 */
function mmStepTo(target: number): void {
  if (!mmModel) return;
  let d = target - mmPhase;
  const sgn = d < 0 ? -1 : 1;
  d = Math.abs(d);
  while (d > 1e-9) {
    const dt = Math.min(MM_DT, d);
    mmModel.update(dt, sgn);
    d -= dt;
  }
  mmPhase = target;
  mmModel.group.updateMatrixWorld(true);
}

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
  power: () => new PowerFlow(),
  wind: () => new WindTunnel(),
  cycle: () => new EngineCycle(),
  engines: () => new EngineTypes(),
  steam: () => new SteamEngines(),
  pump: () => new HandPump(),
  link: () => new Linkage(),
  mill: () => new WaterMill(),
  mm: () => new Gallery()
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
    settings: labelsArg === null ? loadSettings() : { ...loadSettings(), showLabels: labelsArg !== '0' },
    param: q.get('param') ?? undefined,
    navigate: (p) => {
      location.hash = `#/${p}`;
    },
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
} else if (q.get('mm')) {
  // 「507 기계 운동」: mm=kit → 키트 시연, mm=<n> → 레지스트리로 지연 로딩
  const arg = q.get('mm')!;
  const spArg = q.get('speed');
  const sp = spArg === null ? 1 : Number(spArg); // 없으면 1 (Number(null) = 0 이라 멈추던 문제)
  mmSpeed = Number.isFinite(sp) ? sp : 1;
  // &mmsrc=/src/....ts : 레지스트리 대신 그 모듈의 default 빌더로(autocheck --file, 옛 판 비교용)
  const src = q.get('mmsrc');
  const load =
    arg === 'kit'
      ? Promise.resolve().then(() => buildKitDemo())
      : src
        ? import(/* @vite-ignore */ src).then((mod: { default: () => MovementModel }) => mod.default())
        : loadModel(Number(arg));
  load
    .then((m) => {
      mmModel = m;
      shadow(m.group);
      sceneMgr.add(m.group);
      // 이름표: 레이어 1(화살표)은 켠 채 두고 이름표만 토글. 이름표 없는 모델은 경고(지시서 18 5-2)
      sceneMgr.setLabelsVisible(true);
      setTagsVisible(m.group, labelsArg !== '0');
      if (arg !== 'kit' && countTags(m.group) === 0) console.warn(`[mm507] ${arg}번: 이름표 없음`);
      const arrowsArg = q.get('arrows');
      if (arrowsArg !== null) setArrowsVisible(m.group, arrowsArg !== '0');
      view = m.view ?? { pos: [0, 2.1, 6.2], target: [0, 1.75, 0] };
      if (info) info.textContent = arg === 'kit' ? '507 키트 부품 일람' : `507 운동 ${arg}번`;
      if (!q.get('cam') && view) sceneMgr.flyTo(view, true);
      if (mmJump) {
        // 바로 점프: update(0.02, speed) 를 T 까지 한꺼번에 — 실시간 프레임을 기다리지 않는다
        const T = Number(q.get('t'));
        let left = Number.isFinite(T) && T > 0 ? T : 0;
        while (left > 1e-9) {
          const dt = Math.min(MM_DT, left);
          m.update(dt, mmSpeed);
          mmPhase += dt * mmSpeed;
          left -= dt;
        }
        m.group.updateMatrixWorld(true);
      }
      // 영어 이름표는 사전을 받은 뒤에 바꾼다 → 지시선·준비 신호는 그 뒤(이름표 폭이 바뀌므로)
      const langReady: Promise<unknown> =
        q.get('lang') === 'en' ? loadEnDict().then((d) => retextTags(m.group, d.tags)) : Promise.resolve();
      return langReady.then(() => {
        m.group.updateMatrixWorld(true);
        if (q.get('leaders') === '1') {
          mmLeaders = new TagLeaders(m.group);
          mmLeaders.setVisible(labelsArg !== '0');
        }
        sceneMgr.update(0);
        sceneMgr.render();
        w.__mmReady = true;
      });
    })
    .catch((e: unknown) => {
      console.error('[mm507]', e);
      w.__mmReady = true; // 기다리는 쪽이 멈추지 않게(에러는 __mm.errors 에)
    });
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

const w = window as unknown as Record<string, unknown>;
w.__mm = {
  /** 0 에서 t 까지 고정 dt 로(누적 위상 t·speed 로) 옮긴다. 음수 speed = 역회전 */
  seek(t: number, speed = 1): void {
    mmStepTo(t * speed);
  },
  cam(x: number, y: number, z: number, tx: number, ty: number, tz: number): void {
    // 검사 캡처는 근접·위·아래 시점도 쓴다 — 궤도 컨트롤의 거리·각 제한을 푼다
    sceneMgr.controls.minDistance = 0.05;
    sceneMgr.controls.maxPolarAngle = Math.PI;
    sceneMgr.flyTo({ pos: [x, y, z], target: [tx, ty, tz] }, true);
    sceneMgr.render();
  },
  labels(on: boolean): void {
    if (mmModel) setTagsVisible(mmModel.group, on);
    sceneMgr.render();
  },
  theme(name: string): void {
    const th = name === 'dark' ? 'dark' : 'light';
    sceneMgr.setTheme(th);
    document.documentElement.dataset.theme = th;
    sceneMgr.render();
  },
  render(): void {
    mmModel?.group.updateMatrixWorld(true);
    mmLeaders?.update();
    sceneMgr.update(0);
    sceneMgr.render();
  },
  /** 이름표 하나를 k 배로 키운다(쇼츠 클로즈업 강조). text=null 이면 모두 원래 크기 */
  emph(text: string | null, k = 1.6): void {
    mmModel?.group.traverse((o) => {
      if (o.userData.mmTag !== true || !(o instanceof THREE.Sprite)) return;
      const base = (o.userData.mmBaseScale as [number, number] | undefined) ?? [o.scale.x, o.scale.y];
      o.userData.mmBaseScale = base;
      const shown = String(o.userData.mmTagShown ?? o.userData.mmTagText ?? '');
      const orig = String(o.userData.mmTagText ?? '');
      const f = text !== null && (shown === text || orig === text) ? k : 1;
      o.scale.set(base[0] * f, base[1] * f, 1);
    });
  },
  /** 보이는 이름표 목록(원문·표시 글자·월드 위치) — 쇼츠 카메라 고르기용 */
  tags(): { text: string; shown: string; pos: [number, number, number] }[] {
    const out: { text: string; shown: string; pos: [number, number, number] }[] = [];
    const v = new THREE.Vector3();
    mmModel?.group.traverse((o) => {
      if (o.userData.mmTag !== true) return;
      o.getWorldPosition(v);
      out.push({ text: String(o.userData.mmTagText ?? ''), shown: String(o.userData.mmTagShown ?? o.userData.mmTagText ?? ''), pos: [v.x, v.y, v.z] });
    });
    return out;
  },
  /** 장면 카메라(쇼츠 카메라 계획이 화면 투영·화각 계산에 쓴다) */
  get camera(): THREE.PerspectiveCamera {
    return sceneMgr.camera;
  },
  get model(): MovementModel | null {
    return mmModel;
  },
  get group(): THREE.Group | null {
    return mmModel?.group ?? null;
  },
  /** 지금 누적 위상(= seek 의 t·speed) */
  get time(): number {
    return mmPhase;
  },
  errors: mmErrors,
  /** 검사 스크립트가 같은 three 인스턴스(Box3·Triangle 등)를 쓰게 */
  THREE
};

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
  if (mmModel && !mmJump && simTime < stopAt) {
    simTime += dt;
    mmModel.update(dt, mmSpeed);
    mmPhase += dt * mmSpeed;
  }
  mmLeaders?.update();
  sceneMgr.render();
  requestAnimationFrame(tick);
}
tick();
w.__ready = true;
