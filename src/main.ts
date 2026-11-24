// 진입점: 머신 전환, 미션 진행, 조립 애니메이션, 정답/오답 판정, 메인 루프

import * as THREE from 'three';
import './styles/tokens.css';
import './styles/app.css';
import './styles/modes.css';
import './styles/lab-bike.css';
import './styles/lab-car.css';
import './styles/lab-power.css';
import './styles/lab-wind.css';
import './styles/lab-cycle.css';
import './styles/lab-engines.css';
import './styles/lab-steam.css';
import './styles/lab-pump.css';
import './styles/lab-link.css';
import './styles/mm507.css';
import { SceneManager, DEFAULT_VIEW } from './scene/SceneSetup';
import { buildPart, normalizePart, disposeObject } from './models/factory';
import { ThumbnailFactory } from './models/thumbnails';
import { PhysicsFX } from './sim/physics';
import { isDragMachine, isHuntMachine, type DraggableItem, type Machine, type MachineSim } from './machines/types';
import { MACHINES, MACHINE_GROUPS, getMachineDef } from './data/machines';
import { getPart, getCategory } from './data/elements';
import { HUD } from './ui/hud';
import { HomeScreen } from './ui/home';
import { ICON } from './ui/icons';
import type { AppMode } from './modes/types';
import { Encyclopedia, getSeenCount } from './modes/Encyclopedia';
import { Quiz, getQuizBest } from './modes/Quiz';
import { BikeGears } from './labs/BikeGears';
import { CarShift } from './labs/CarShift';
import { PowerFlow } from './labs/PowerFlow';
import { WindTunnel } from './labs/WindTunnel';
import { EngineCycle } from './labs/EngineCycle';
import { EngineTypes } from './labs/EngineTypes';
import { SteamEngines } from './labs/SteamEngines';
import { HandPump } from './labs/HandPump';
import { Linkage } from './labs/Linkage';
import { Gallery } from './mm507/Gallery';
import { loadProgress, saveProgress, clearMachineProgress, clearAllProgress, allMachinesCompleted, type ProgressData } from './state/progress';
import { guessQuality, loadSettings, saveSettings, type AppSettings } from './state/settings';
import { playCorrectSound, playWrongSound } from './ui/sound';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('#scene canvas not found');

let settings: AppSettings = loadSettings();
const sceneMgr = new SceneManager(canvas, { theme: settings.theme, quality: settings.quality === 'auto' ? guessQuality() : settings.quality });
sceneMgr.adaptive = settings.quality === 'auto';
const thumbs = new ThumbnailFactory();
const physics = new PhysicsFX(sceneMgr.scene);
const hud = new HUD(
  {
    onSelectPart: handleSelect,
    onHint: showHint,
    onReset: resetMission,
    onHome: () => navigate(''),
    onNextMission: () => {
      const next = nextMissionId();
      navigate(next ? `m/${next}` : '');
    },
    onSettingsChange: (s) => {
      settings = s;
      applyTheme();
      const wanted = s.quality === 'auto' ? guessQuality() : s.quality;
      sceneMgr.adaptive = s.quality === 'auto';
      if (sceneMgr.getQuality() !== wanted) sceneMgr.setQuality(wanted);
      if (screen === 'mission' && current) syncMission();
      if (screen === 'home') showHome();
    },
    onResetAll: resetAllProgress,
    onToggleLabels: (visible) => {
      settings.showLabels = visible;
      saveSettings(settings);
      sceneMgr.setLabelsVisible(visible);
    }
  },
  thumbs,
  settings
);
sceneMgr.setLabelsVisible(settings.showLabels);
sceneMgr.onAutoLowQuality = () => {
  // '자동' 설정은 그대로 두고 이번 실행의 렌더 품질만 낮춘다
  hud.toast('화면이 느려져 그래픽 품질을 낮췄어요.', 'info');
};

function applyTheme(): void {
  document.documentElement.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0f131a' : '#e6ecf2');
  if (sceneMgr.getTheme() !== settings.theme) sceneMgr.setTheme(settings.theme);
}
applyTheme();

let allCompleteShown = false;

/** 모든 기계의 진행도를 지우고 현재 화면을 초기 상태로 되돌린다 */
function resetAllProgress(): void {
  if (flyTask) {
    sceneMgr.scene.remove(flyTask.model);
    disposeObject(flyTask.model);
    flyTask = null;
  }
  for (const m of machines.values()) m.reset();
  sim = null;
  hud.setDisplay(null);
  hud.setSpeedControl(false, () => {});
  clearAllProgress(progress);
  allCompleteShown = false;
  if (screen === 'mission' && current) syncMission();
  if (screen === 'home') showHome();
  hud.showRestartModal();
}

/** 모든 기계를 클리어했는지 확인해 축하 모달을 1회 표시한다 */
function checkAllComplete(): void {
  if (allCompleteShown || !current) return;
  if (allMachinesCompleted(progress, MACHINES.map((m) => m.id))) {
    allCompleteShown = true;
    hud.showCongratsModal();
  }
}

const SPAWN = new THREE.Vector3(1.7, 2.3, 4.2);
const progress: ProgressData = loadProgress();
const machines = new Map<string, Machine>();

let current: Machine | null = null;
let sim: MachineSim | null = null;
let flyTask: FlyTask | null = null;
let displayTimer = 0;

interface FlyTask {
  model: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  onDone: (model: THREE.Group) => void;
}

function currentDef() {
  return getMachineDef(current!.id);
}

/** 현재 머신의 이름 오버라이드가 적용된 부품 표시 이름 (이 머신에서만 전동축→구동축) */
function partDisplayName(part: ReturnType<typeof getPart>): string {
  return currentDef().nameOverrides?.[part.id] ?? part.name;
}

function installedCount(): number {
  return progress.machines[current!.id]?.installed ?? 0;
}

function setInstalledCount(count: number): void {
  const id = current!.id;
  const entry = progress.machines[id] ?? { installed: 0, completedOnce: false };
  entry.installed = count;
  if (count >= currentDef().steps.length) entry.completedOnce = true;
  progress.machines[id] = entry;
  progress.last = id;
  saveProgress(progress);
}

function getMachine(id: string): Machine {
  let m = machines.get(id);
  if (!m) {
    m = getMachineDef(id).create();
    machines.set(id, m);
  }
  return m;
}

function setSpeedSlider(visible: boolean): void {
  hud.setSpeedControl(visible, (v) => {
    if (current && isDragMachine(current)) current.setSpinSpeed(v);
  });
}

function switchMachine(id: string): void {
  if (flyTask) {
    sceneMgr.scene.remove(flyTask.model);
    disposeObject(flyTask.model);
    flyTask = null;
  }
  sim = null;
  hud.setDisplay(null);
  hud.setSpeedControl(false, () => {});
  hud.closePanel();
  if (current) sceneMgr.remove(current.group);

  current = getMachine(id);
  sceneMgr.add(current.group);

  const count = Math.min(installedCount(), current.stepCount);
  for (let i = 0; i < count; i++) {
    if (!current.isInstalled(i)) {
      current.installStep(i, current.buildStepModel(i));
      // 완료된 단계의 후속 부품(바퀴·앞 스프로킷)도 즉시 복원
      const ups = current.getFollowUps?.(i) ?? [];
      ups.forEach((u, idx) => current!.installFollowUp?.(i, idx, u.model));
    }
  }
  progress.last = id;
  saveProgress(progress);

  const def = currentDef();
  const groupName = MACHINE_GROUPS.find((g) => g.id === def.group)?.name ?? '';
  const nextId = nextMissionId();
  hud.setMachineTitle(groupName, def.name, nextId ? getMachineDef(nextId).name : null);
  sceneMgr.flyTo(def.view ?? DEFAULT_VIEW);
  hud.setPartNameOverrides(def.nameOverrides ?? {});
  hud.setPartNotes(def.partNotes ?? {});
  hud.setGearNameButton(id === 'gearhunt');
  hud.setMission(missionHeading(def), count, def.steps.map((s) => stepDisplay(s.partId)), def.completeText);
  if (count >= def.steps.length) {
    startSim();
    const machine = current;
    if (isDragMachine(machine)) {
      machine.onReady = () => syncHunt(machine);
      machine.beginHunt(progress.machines[id]?.huntIds ?? []);
      syncHunt(machine);
      setSpeedSlider(true);
    } else if (isHuntMachine(machine)) {
      machine.beginHunt(progress.machines[id]?.huntFound ?? 0);
      syncHunt(machine);
    }
  }
}

/** 드래그 조립형 미션의 진행 표시 */
function syncHunt(machine: { huntStats(): { found: number; total: number }; huntPrompt(): string }): void {
  const st = machine.huntStats();
  hud.setHunt(st.found, st.total, machine.huntPrompt(), currentDef().completeText);
}

/** 목록 순서에서 현재 미션 다음의 미완료 미션 (없으면 null) */
function nextMissionId(): string | null {
  if (!current) return null;
  const idx = MACHINES.findIndex((m) => m.id === current!.id);
  for (let k = 1; k < MACHINES.length; k++) {
    const m = MACHINES[(idx + k) % MACHINES.length]!;
    if (!progress.machines[m.id]?.completedOnce) return m.id;
  }
  return null;
}

function stepDisplay(partId: string): { text: string; tip: string } {
  const part = getPart(partId);
  const name = partDisplayName(part);
  if (settings.difficulty === 'low') return { text: name, tip: part.role };
  if (settings.difficulty === 'medium') {
    const desc = part.role.length > 20 ? `${part.role.slice(0, 20)}…` : part.role;
    return { text: desc, tip: part.role };
  }
  return { text: '???', tip: '' };
}

function missionHeading(def: ReturnType<typeof currentDef>): string {
  if (settings.difficulty === 'low') return def.missionText;
  if (settings.difficulty === 'medium') return '단계 설명에 맞는 기계요소를 아래에서 찾아 조립하세요!';
  return '힌트 없이 알맞은 기계요소를 찾아 조립하세요!';
}

function syncMission(): void {
  const def = currentDef();
  if (def.steps.length === 0 && current && isDragMachine(current)) {
    syncHunt(current);
    return;
  }
  hud.setMission(missionHeading(def), installedCount(), def.steps.map((s) => stepDisplay(s.partId)), def.completeText);
}

function startSim(): void {
  sim = current!.createSim();
  const disp = sim.getDisplay();
  hud.setDisplay(disp.length > 0 ? disp : null);
}

// ── 부품 선택 처리 ──

function handleSelect(id: string): void {
  if (!current || flyTask || physics.busy) return;
  if (currentDef().steps.length === 0 && isDragMachine(current)) {
    hud.toast('이 미션은 목록이 아니라 3D 부품을 드래그해서 반투명 그림에 맞추는 미션이에요!', 'info');
    return;
  }
  const def = currentDef();
  const count = installedCount();

  if (count >= def.steps.length) {
    hud.toast(`${def.name} 미션 완료! 잘 작동하고 있어요.`, 'ok');
    return;
  }

  const part = getPart(id);
  const step = def.steps[count]!;

  if (part.id === step.partId) {
    hud.closePanel(); // 부품이 날아가 장착되는 모습이 트레이에 가려지지 않게 바로 닫는다
    flyAndInstall(part.id, count);
    return;
  }

  const laterStep = def.steps.findIndex((s, i) => i > count && s.partId === part.id);
  if (laterStep >= 0) {
    hud.toast(`${partDisplayName(part)}은(는) '${def.steps[count]!.label}'을(를) 먼저 장착해야 해요!`, 'info');
    return;
  }

  wrongAnswer(part, getPart(step.partId));
}

function wrongAnswer(part: ReturnType<typeof getPart>, required: ReturnType<typeof getPart>): void {
  const model = normalizePart(buildPart(part.builder), 0.9);
  if (settings.sound) playWrongSound();
  physics.throwPart(model, SPAWN.clone(), current!.slotTarget(installedCount()));

  const reqCat = getCategory(required.category).name;
  const reqName = currentDef().nameOverrides?.[required.id] ?? required.name;
  if (part.category !== required.category) {
    hud.toast(`${partDisplayName(part)}은(는) ${getCategory(part.category).name} 기계요소예요. 이 슬롯에는 ${reqCat} 부품이 필요해요!`, 'warn');
  } else {
    hud.toast(`${partDisplayName(part)}도 ${reqCat} 기계요소지만, 이 자리에는 '${reqName}'이(가) 필요해요! 힌트를 눌러 보세요.`, 'warn');
  }
}

function flyModel(model: THREE.Group, to: THREE.Vector3, dur: number, onDone: (m: THREE.Group) => void): void {
  flyTask = { model, from: SPAWN.clone(), to, t: 0, dur, onDone };
  model.position.copy(SPAWN);
  sceneMgr.scene.add(model);
}

// 후속 자동 장착(바퀴·앞 스프로킷 등)을 순서대로 날아와 장착 — 모두 끝나면 done 콜백
function runFollowUps(machine: Machine, step: number, done: () => void): void {
  const ups = machine.getFollowUps?.(step) ?? [];
  const runNext = (i: number): void => {
    const up = ups[i];
    if (!up) {
      done();
      return;
    }
    flyModel(up.model, up.to, 0.6, (m) => {
      machine.installFollowUp?.(step, i, m);
      runNext(i + 1);
    });
  };
  runNext(0);
}

function flyAndInstall(partId: string, step: number): void {
  const machine = current!;
  const model = machine.buildStepModel(step);
  flyModel(model, machine.getFlyTarget(step), 0.85, (m) => {
    machine.installStep(step, m);
    const newCount = step + 1;
    setInstalledCount(newCount);
    syncMission();
    checkAllComplete();
    hud.showInfoCard(getPart(partId));
    runFollowUps(machine, step, () => {
      const def = currentDef();
      if (newCount >= def.steps.length) {
        hud.closePanel(); // 완성된 기계가 가려지지 않게 트레이를 닫는다
        if (settings.sound) playCorrectSound();
        startSim();
        if (isHuntMachine(machine)) {
          machine.beginHunt(0);
          syncHunt(machine);
        }
      } else {
        hud.toast(settings.difficulty === 'low' ? `정답! '${def.steps[step]!.label}'이(가) 장착되었어요.` : '정답! 알맞은 기계요소가 장착되었어요.', 'ok');
        if (settings.sound) playCorrectSound();
      }
    });
  });
}

function showHint(): void {
  if (!current) return;
  const def = currentDef();
  current.boostHint(5);
  hud.toast(`힌트: ${def.hint}`, 'info', 4500);
}

function resetMission(): void {
  if (!current) return;
  if (flyTask) {
    sceneMgr.scene.remove(flyTask.model);
    disposeObject(flyTask.model);
    flyTask = null;
  }
  current.reset();
  sim = null;
  hud.setDisplay(null);
  hud.setSpeedControl(false, () => {});
  clearMachineProgress(progress, current.id);
  if (isDragMachine(current)) {
    const machine = current;
    machine.onReady = () => syncHunt(machine);
    machine.beginHunt([]);
  }
  syncMission();
  if (isHuntMachine(current) && installedCount() >= current.stepCount) {
    current.beginHunt(0);
    syncHunt(current);
  }
  hud.hideInfoCard();
  hud.toast('미션을 초기화했어요. 다시 도전해 보세요!', 'info');
}

// ── 3D 씬 클릭(찾기) 및 드래그(조립) ──

const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let pointerDown: { x: number; y: number } | null = null;
let dragItem: DraggableItem | null = null;

const pointerNDC = (e: PointerEvent): THREE.Vector2 => {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
};

const dragPlanePoint = (e: PointerEvent): THREE.Vector3 | null => {
  if (!current || !isDragMachine(current)) return null;
  raycaster.setFromCamera(pointerNDC(e), sceneMgr.camera);
  dragPlane.constant = -current.dragPlaneY();
  const out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(dragPlane, out) ? out : null;
};

canvas.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY };
  if (!current || !isDragMachine(current) || !current.isReady()) return;
  raycaster.setFromCamera(pointerNDC(e), sceneMgr.camera);
  const targets = current.getDraggables().map((t) => t.object);

  // 1순위: 정밀 메시 레이캐스트
  const preciseHits = raycaster.intersectObjects(targets, true);
  if (preciseHits.length > 0) {
    const hitObject = preciseHits[0]!.object;
    const target = current.getDraggables().find((t) => isDescendantOrSelf(t.object, hitObject));
    if (target) {
      dragItem = target;
      current.beginDrag(target);
      sceneMgr.controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
      return;
    }
  }

  // 2순위: 얇은 부품(축 등)도 잡기 쉽도록 외접구 기준 폴백
  const ray = raycaster.ray;
  let best: { dist: number; item: DraggableItem } | null = null;
  const hitPoint = new THREE.Vector3();
  for (const t of current.getDraggables()) {
    const box = new THREE.Box3().setFromObject(t.object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (!ray.intersectSphere(sphere, hitPoint)) continue;
    const dist = hitPoint.distanceTo(ray.origin);
    if (!best || dist < best.dist) best = { dist, item: t };
  }
  if (!best) return;
  dragItem = best.item;
  current.beginDrag(best.item);
  sceneMgr.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragItem || !current || !isDragMachine(current)) return;
  const pt = dragPlanePoint(e);
  if (pt) current.moveDrag(pt);
});

canvas.addEventListener('pointerup', (e) => {
  const down = pointerDown;
  pointerDown = null;

  if (dragItem && current && isDragMachine(current)) {
    const machine = current;
    dragItem = null;
    sceneMgr.controls.enabled = true;
    const pt = dragPlanePoint(e) ?? new THREE.Vector3(9999, 0, 9999);
    const result = machine.endDrag(pt);
    const stats = machine.huntStats();
    if (result.correct) {
      syncHunt(machine);
      const entry = progress.machines[machine.id] ?? { installed: 0, completedOnce: false };
      entry.huntFound = stats.found;
      entry.huntIds = machine.placedIds();
      if (stats.found >= stats.total) entry.completedOnce = true;
      progress.machines[machine.id] = entry;
      progress.last = machine.id;
      saveProgress(progress);
      if (result.partId) hud.showInfoCard(getPart(result.partId));
      if (stats.found >= stats.total) {
        if (settings.sound) playCorrectSound();
        startSim();
        setSpeedSlider(true); // 복원 진입(switchMachine)과 동일 처리 — 최초 완료에도 회전·속도 슬라이더 즉시 시작
        checkAllComplete();
      }
    } else if (result.hint) {
      hud.toast(result.hint, 'warn', 3600);
    }
    return;
  }

  if (!down || !current || !isHuntMachine(current)) return;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;

  raycaster.setFromCamera(pointerNDC(e), sceneMgr.camera);
  const targets = current.getHuntTargets();
  const hits = raycaster.intersectObjects(targets.map((t) => t.object), true);
  if (hits.length === 0) return;

  const hitObject = hits[0]!.object;
  const root = targets.find((t) => isDescendantOrSelf(t.object, hitObject));
  if (!root) return;

  const result = current.handleHuntPick(root.object);
  const stats = current.huntStats();
  if (result.correct) {
    syncHunt(current);
    const entry = progress.machines[current.id] ?? { installed: 0, completedOnce: false };
    entry.huntFound = stats.found;
    if (stats.found >= stats.total) entry.completedOnce = true;
    progress.machines[current.id] = entry;
    progress.last = current.id;
    saveProgress(progress);
    if (result.partId) hud.showInfoCard(getPart(result.partId));
    if (stats.found >= stats.total) hud.toast(`완성! ${currentDef().completeText}`, 'ok', 4200);
  } else if (result.hint) {
    hud.toast(result.hint, 'warn', 3800);
  }
});

function isDescendantOrSelf(root: THREE.Object3D, object: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (node === root) return true;
    node = node.parent;
  }
  return false;
}

// ── 메인 루프 ──

const clock = new THREE.Clock();

function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function tick(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  sceneMgr.update(dt);
  current?.update(t);
  activeMode?.update(dt, t);
  sim?.update(dt);
  physics.update(dt);

  if (sim) {
    displayTimer += dt;
    if (displayTimer > 0.12) {
      displayTimer = 0;
      const disp = sim.getDisplay();
      if (disp.length > 0) hud.setDisplay(disp);
    }
  }

  if (flyTask) {
    flyTask.t += dt;
    const k = Math.min(1, flyTask.t / flyTask.dur);
    const e = easeInOutCubic(k);
    flyTask.model.position.lerpVectors(flyTask.from, flyTask.to, e);
    flyTask.model.rotation.z = (1 - e) * Math.PI * 0.9;
    if (k >= 1) {
      const task = flyTask;
      flyTask = null;
      task.onDone(task.model);
    }
  }

  sceneMgr.render();
  requestAnimationFrame(tick);
}

// ── 화면 전환 (해시 라우팅: #/ 홈, #/m/<id> 미션, #/enc 도감, #/quiz 퀴즈) ──

type ModeId = 'enc' | 'quiz' | 'lab/bike' | 'lab/car' | 'lab/power' | 'lab/wind' | 'lab/cycle' | 'lab/engines' | 'lab/steam' | 'lab/pump' | 'lab/link' | 'mm';
type Screen = 'home' | 'mission' | ModeId;
let screen: Screen = 'home';
let activeMode: AppMode | null = null;
const modes: Record<ModeId, { name: string; mode: AppMode }> = {
  enc: { name: '기계요소 도감', mode: new Encyclopedia() },
  quiz: { name: '단원 퀴즈', mode: new Quiz() },
  'lab/bike': { name: '자전거 기어 변속', mode: new BikeGears() },
  'lab/car': { name: '자동차 기어 변속', mode: new CarShift() },
  'lab/power': { name: '자동차의 동력 전달', mode: new PowerFlow() },
  'lab/wind': { name: '풍동 실험', mode: new WindTunnel() },
  'lab/cycle': { name: '엔진의 작동 원리', mode: new EngineCycle() },
  'lab/engines': { name: '엔진의 종류', mode: new EngineTypes() },
  'lab/steam': { name: '증기 기관', mode: new SteamEngines() },
  'lab/pump': { name: '우물 손펌프', mode: new HandPump() },
  'lab/link': { name: '링크 장치', mode: new Linkage() },
  mm: { name: '507 기계 운동', mode: new Gallery() }
};

const home = new HomeScreen({
  onOpenMission: (id) => navigate(`m/${id}`),
  onOpenMode: (mode) => navigate(mode),
  onOpenSettings: () => hud.toggleSettings(),
  onToggleTheme: () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    saveSettings(settings);
    applyTheme();
    hud.refreshSettings();
    showHome();
  }
});

const modeScreen = document.querySelector<HTMLElement>('#mode-screen')!;
const modeRoot = document.querySelector<HTMLElement>('#mode-root')!;
const modeHomeBtn = document.querySelector<HTMLElement>('#mode-home-btn')!;
modeHomeBtn.innerHTML = ICON.home;
modeHomeBtn.addEventListener('click', () => navigate(''));

function navigate(path: string): void {
  const target = `#/${path}`;
  if (location.hash === target) route();
  else location.hash = target;
}

function leaveMission(): void {
  if (flyTask) {
    sceneMgr.scene.remove(flyTask.model);
    disposeObject(flyTask.model);
    flyTask = null;
  }
  hud.setVisible(false);
}

function leaveMode(): void {
  if (activeMode) {
    activeMode.exit();
    activeMode = null;
    modeRoot.innerHTML = '';
  }
  modeScreen.classList.add('hidden');
}

function showHome(): void {
  const quiz = getQuizBest();
  home.show({ progress, seenParts: getSeenCount(), quizBest: quiz.best, quizPlays: quiz.plays, theme: settings.theme });
}

function route(): void {
  const path = location.hash.replace(/^#\/?/, '');
  const [head, arg] = path.split('/');
  leaveMode();

  if (head === 'm' && arg && MACHINES.some((m) => m.id === arg)) {
    screen = 'mission';
    home.hide();
    hud.setVisible(true);
    switchMachine(arg);
    return;
  }
  const modeId = (head === 'lab' ? `lab/${arg ?? ''}` : head) as ModeId;
  if (modeId in modes) {
    screen = modeId;
    leaveMission();
    home.hide();
    // 학습 모드는 씬을 직접 쓰므로 미션 기계를 치운다
    if (current) {
      sceneMgr.remove(current.group);
      current = null;
      sim = null;
    }
    document.querySelector<HTMLElement>('#mode-name')!.textContent = modes[modeId].name;
    modeScreen.classList.remove('hidden');
    activeMode = modes[modeId].mode;
    activeMode.enter({
      sceneMgr,
      thumbs,
      root: modeRoot,
      settings,
      param: head === 'mm' ? arg : undefined,
      navigate: (p) => navigate(p),
      toast: (m, kind, duration) => hud.toast(m, kind, duration),
      goHome: () => navigate(''),
      playSound: (kind) => {
        if (!settings.sound) return;
        if (kind === 'ok') playCorrectSound();
        else playWrongSound();
      }
    });
    return;
  }
  screen = 'home';
  leaveMission();
  showHome();
}

window.addEventListener('hashchange', route);
route();
tick();
