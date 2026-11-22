// 윈치 크레인: 테이퍼 핀 + 웜과 웜 기어 미션
// 손잡이 100rpm → 1줄 웜 · 25잇수 웜 휠(1/25) → 드럼 4rpm → 와이어를 감아 짐을 들어 올린다.
// 좌표: X = 지브 방향(짐 쪽 +X), Y = 위, Z = 앞. 드럼·웜 휠·도르래 축은 Z, 웜 축과 손잡이 축은 X.
// 와이어 경로: 드럼(왼쪽 접선) → 수직 → 뒤 도르래 위 → 수평 → 끝 도르래 위 → 수직으로 짐까지.
// 와이어 전체 길이가 일정하므로 감긴 길이(드럼 회전각 × 반지름)만큼 늘어진 길이가 줄어 짐이 올라간다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gearShape } from '../models/factory';
import { lathe as latheY, type V2 } from '../models/parts/geom';
import { bronze, brass, castIron, darkSteel, paint, plastic, steel, wood } from '../models/materials';
import { BaseMachine, type MachineDisplayItem, type MachineSim } from './types';

const TAU = Math.PI * 2;

// ── 구조 ──
const BASE_T = 0.08;
const COL_X = -0.35;
const COL_R = 0.09;
const COL_TOP = 2.18;
const JIB_Y0 = 2.22;
const JIB_Y1 = 2.38;
const JIB_X0 = -0.9;
const JIB_X1 = 1.5;
const MAST_TOP = 2.84;

// ── 도르래·와이어 ──
const SHEAVE_Y = 2.5;
const SHEAVE_R = 0.092; // 홈 바닥 반지름
const WIRE_R = 0.014;
const RSW = SHEAVE_R + WIRE_R; // 도르래 위 와이어 중심 반지름
const ROOT_X = -0.85;
const TIP_X = 1.45;
const HANG_X = TIP_X + RSW;

// ── 드럼 ──
const DRUM_Y = 0.55;
const DRUM_R = 0.18;
const RDW = DRUM_R + WIRE_R; // 드럼 위 와이어 중심 반지름
const DRUM_X = ROOT_X - RSW + RDW; // 드럼 왼쪽 접선이 뒤 도르래 왼쪽 접선과 같은 x → 와이어가 수직
const DRUM_HALF = 0.16;
const PLATE_Z = 0.21;
const HELIX_P = 0.03;
const HELIX_Z0 = -0.1;
const LW0 = 3 * TAU * RDW; // 처음부터 감겨 있는 와이어(3바퀴)

// ── 웜 기어 ──
const WHEEL_Z = 0.3;
const N_WHEEL = 25;
const RW = 0.2; // 웜 휠 피치 반지름
const MODW = (2 * RW) / N_WHEEL;
const WORM_RP = 0.05;
const WORM_Y = DRUM_Y + RW + WORM_RP;
const WORM_PITCH = Math.PI * MODW; // 1줄 웜 리드 = 휠 원주 피치
const WORM_LEN = 0.26;

// ── 손잡이 ──
const CRANK_X = -1.2;
const CRANK_R = 0.26;
const SHAFT_X0 = -1.25;
const SHAFT_X1 = -0.4;
const ASIDE_POS = new THREE.Vector3(-0.1, BASE_T + 0.06, 0.52);
const ASIDE_Q = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0))
);
const MOUNT_T = 0.8;

// ── 운전 ──
const CRANK_RPM = 100;
const DRUM_RPM = CRANK_RPM / N_WHEEL;
const W_CRANK = (CRANK_RPM / 60) * TAU;
const V_LIFT = (W_CRANK / N_WHEEL) * RDW; // 짐 상승 속도 = 드럼 각속도 × 와이어 반지름
const H_MAX = 1.05;
const T_RAMP = 0.6;
const T_MOVE = H_MAX / V_LIFT + T_RAMP;
const T_PAUSE = 2;
const T_CYCLE = 2 * (T_MOVE + T_PAUSE);
const REST_END_Y = 1.1; // 짐이 받침 위에 있을 때 와이어 끝 높이
const CM_PER_UNIT = 40;
const LW_MAX = LW0 + H_MAX + 0.02;

// ── 도구 ──

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  o.receiveShadow = true;
  parent?.add(o);
  return o;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, r = 0.012): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  g.translate(x, y, z);
  return g;
}

function cylAxis(r: number, a: number, b: number, axis: 'x' | 'y' | 'z', segs = 24): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, b - a, segs);
  g.translate(0, (a + b) / 2, 0);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

/** (r, 축방향) 프로파일 회전체 — 축 = Z (축방향 값이 곧 z) */
function latheZ(profile: V2[], segs = 48): THREE.BufferGeometry {
  const g = latheY(profile, segs);
  g.rotateX(Math.PI / 2);
  g.scale(1, 1, 1);
  return g;
}

/** 축 = X */
function latheX(profile: V2[], segs = 48): THREE.BufferGeometry {
  const g = latheY(profile, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const norm = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of norm) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  }
  const out = mergeGeometries(norm);
  if (!out) throw new Error('merge failed');
  geos.forEach((g) => g.dispose());
  norm.forEach((g) => g.dispose());
  return out;
}

/** 두 점 사이 원기둥(단위 높이 Y축 지오메트리를 늘림) */
function stretch(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = b.clone().sub(a);
  const len = Math.max(1e-4, d.length());
  obj.position.copy(a).addScaledVector(d, 0.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(len));
  obj.scale.set(1, len, 1);
}

/** 1줄 웜(축 X): 위상 f = x/피치 − θ/2π 의 사다리꼴 나사면. f≡½ 이끝, f≡0 이골. θ는 +Y에서 +Z 쪽으로 잰 각 */
function wormGeo(len: number, rRoot: number, rTip: number, pitch: number): THREE.BufferGeometry {
  const nx = Math.ceil((len / pitch) * 20);
  const na = 48;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= nx; i++) {
    const x = -len / 2 + (i / nx) * len;
    for (let j = 0; j <= na; j++) {
      const th = (j / na) * TAU;
      let f = x / pitch - th / TAU;
      f -= Math.floor(f);
      const d = Math.abs(f - 0.5) * 2;
      const k = d < 0.35 ? 1 : d > 0.75 ? 0 : 1 - (d - 0.35) / 0.4;
      const edge = Math.min(1, (len / 2 - Math.abs(x)) / (pitch * 0.6));
      const r = rRoot + (rTip - rRoot) * k * Math.max(0, edge);
      pos.push(x, Math.cos(th) * r, Math.sin(th) * r);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < na; j++) {
      const a = i * (na + 1) + j;
      const b = a + na + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 드럼 위 나선 와이어 (드럼 국소 좌표). s=0이 고정 끝, 감긴 길이 Lw까지만 그린다 */
class DrumHelix extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const s = t * LW_MAX;
    // 설치 시(드럼각 0, 감긴 길이 LW0) 끝점이 세계각 π(왼쪽 접점)에 오도록 시작각을 잡는다
    const a = Math.PI + LW0 / RDW - s / RDW;
    return target.set(RDW * Math.cos(a), RDW * Math.sin(a), HELIX_Z0 + (HELIX_P * s) / (TAU * RDW));
  }
}

const helixZ = (lw: number): number => HELIX_Z0 + (HELIX_P * lw) / (TAU * RDW);

/** 사다리꼴 속도 곡선의 적분(정지 → 등속 → 정지), 총 길이 T, 가감속 tr */
function trapInt(t: number, T: number, tr: number): { s: number; f: number } {
  if (t <= 0) return { s: 0, f: 0 };
  if (t >= T) return { s: T - tr, f: 0 };
  if (t < tr) return { s: (t * t) / (2 * tr), f: t / tr };
  if (t < T - tr) return { s: tr / 2 + (t - tr), f: 1 };
  const r = T - t;
  return { s: T - tr - (r * r) / (2 * tr), f: r / tr };
}

export class Winch extends BaseMachine {
  readonly id = 'winch';
  private pinModel: THREE.Group | null = null;
  private gearModel: THREE.Group | null = null;
  private worm: THREE.Object3D | null = null;
  private wheel: THREE.Object3D | null = null;

  private readonly drum = new THREE.Group();
  private readonly wormShaft = new THREE.Group();
  private readonly crank = new THREE.Group();
  private readonly rootSheave = new THREE.Group();
  private readonly tipSheave = new THREE.Group();
  private readonly load = new THREE.Group();
  private helixMesh!: THREE.Mesh;
  private helixPerSeg = 0;
  private helixSegs = 0;
  private riseWire!: THREE.Mesh;
  private hangWire!: THREE.Mesh;

  private H = 0;
  private psi = 0;
  private speedF = 0;
  private dir = 1;
  private mountAge = -1;
  private simTime = 0;
  private simActive = false;
  private lastT = -1;

  constructor() {
    super();
    this.buildBase();
    this.buildCrane();
    this.buildWinchFrame();
    this.buildWire();
    this.buildLoad();
    this.buildCrank();
    this.group.add(this.drum, this.wormShaft, this.rootSheave, this.tipSheave, this.load, this.crank);
    this.buildSlots();
    this.applyPose();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.pinModel !== null : this.gearModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(CRANK_X, WORM_Y, WHEEL_Z) : new THREE.Vector3(DRUM_X, DRUM_Y, WHEEL_Z);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(CRANK_X - 0.05, WORM_Y, WHEEL_Z) : new THREE.Vector3(DRUM_X, DRUM_Y + RW * 0.5, WHEEL_Z + 0.05);
  }

  buildStepModel(step: number): THREE.Group {
    return step === 0 ? this.buildPin() : this.buildWormSet();
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      // 핀은 손잡이 허브를 지름 방향으로 관통 — 손잡이와 함께 돈다(자세는 applyPose에서 매 프레임)
      model.position.copy(this.getFlyTarget(0));
      this.group.add(model);
      this.pinModel = model;
      this.mountAge = 0;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.copy(this.getFlyTarget(1));
      this.group.add(model);
      this.gearModel = model;
      const worm = model.getObjectByName('worm');
      const wheel = model.getObjectByName('wheel');
      if (worm) {
        worm.position.set(DRUM_X, 0, 0);
        worm.rotation.set(0, 0, 0);
        this.wormShaft.add(worm);
        this.worm = worm;
      }
      if (wheel) {
        wheel.position.set(0, 0, WHEEL_Z);
        // 맞물림 조건: 휠 세계각 = π/2 + ψ/25 (웜 이골이 휠 꼭대기 이와 겹치도록, 웜 나사면 식에서 유도)
        const theta = this.H / RDW;
        wheel.rotation.set(0, 0, Math.PI / 2 + this.psi / N_WHEEL - theta);
        this.drum.add(wheel);
        this.wheel = wheel;
      }
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.pinModel) this.group.remove(this.pinModel);
    if (this.gearModel) this.group.remove(this.gearModel);
    if (this.worm) this.wormShaft.remove(this.worm);
    if (this.wheel) this.drum.remove(this.wheel);
    this.pinModel = this.gearModel = null;
    this.worm = this.wheel = null;
    this.H = this.psi = this.speedF = 0;
    this.dir = 1;
    this.mountAge = -1;
    this.simTime = 0;
    this.simActive = false;
    this.lastT = -1;
    this.applyPose();
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    const dt = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, t - this.lastT));
    this.lastT = t;
    if (this.mountAge >= 0 && this.mountAge < MOUNT_T) {
      this.mountAge = Math.min(MOUNT_T, this.mountAge + dt);
      this.applyPose();
    }
  }

  createSim(): MachineSim {
    if (!this.pinModel || !this.gearModel) throw new Error('winch mission incomplete');
    this.simActive = true;
    this.simTime = 0;
    return {
      update: (dt: number) => this.drive(dt),
      getDisplay: (): MachineDisplayItem[] => [
        { label: '손잡이 회전수', value: (CRANK_RPM * this.speedF).toFixed(0), unit: 'rpm', tone: 'blue' },
        { label: '드럼 회전수', value: (DRUM_RPM * this.speedF).toFixed(1), unit: `rpm (1/${N_WHEEL} 감속)` },
        {
          label: this.speedF > 0.01 ? (this.dir > 0 ? '짐 높이 ▲' : '짐 높이 ▼') : '짐 높이',
          value: (this.H * CM_PER_UNIT).toFixed(0),
          unit: 'cm',
          tone: 'red'
        }
      ]
    };
  }

  // ── 구동 ──

  private drive(dt: number): void {
    if (!this.simActive) return;
    this.simTime += dt;
    const tc = this.simTime % T_CYCLE;
    let h: number;
    if (tc < T_MOVE) {
      const r = trapInt(tc, T_MOVE, T_RAMP);
      h = r.s * V_LIFT;
      this.speedF = r.f;
      this.dir = 1;
    } else if (tc < T_MOVE + T_PAUSE) {
      h = H_MAX;
      this.speedF = 0;
    } else if (tc < 2 * T_MOVE + T_PAUSE) {
      const r = trapInt(tc - T_MOVE - T_PAUSE, T_MOVE, T_RAMP);
      h = H_MAX - r.s * V_LIFT;
      this.speedF = r.f;
      this.dir = -1;
    } else {
      h = 0;
      this.speedF = 0;
    }
    this.H = Math.max(0, Math.min(H_MAX, h));
    // 드럼각 = 감은 길이 / 반지름, 손잡이(웜)각 = 드럼각 × 25
    this.psi = (this.H / RDW) * N_WHEEL;
    this.applyPose();
  }

  /** H(감아 올린 길이)와 ψ로 드럼·웜·손잡이·도르래·와이어·짐 자세를 모두 맞춘다 */
  private applyPose(): void {
    const theta = this.H / RDW;
    this.drum.rotation.z = theta;
    this.wormShaft.rotation.x = this.psi;
    // 도르래: 와이어가 미끄러지지 않으므로 회전각 = 와이어 이동량 / 반지름 (윗면이 −X로 움직이면 반시계)
    this.rootSheave.rotation.z = this.H / RSW;
    this.tipSheave.rotation.z = this.H / RSW;

    // 드럼에 감긴 와이어
    const lw = LW0 + this.H;
    const segs = Math.max(1, Math.min(this.helixSegs, Math.round((lw / LW_MAX) * this.helixSegs)));
    this.helixMesh.geometry.setDrawRange(0, segs * this.helixPerSeg);
    // 드럼 → 뒤 도르래: 접점의 z가 감긴 양에 따라 조금씩 옮겨 간다(플리트 각)
    stretch(this.riseWire, new THREE.Vector3(DRUM_X - RDW, DRUM_Y, helixZ(lw)), new THREE.Vector3(ROOT_X - RSW, SHEAVE_Y, 0));
    // 늘어진 와이어 길이 = 처음 길이 − 감은 길이
    const endY = REST_END_Y + this.H;
    stretch(this.hangWire, new THREE.Vector3(HANG_X, endY, 0), new THREE.Vector3(HANG_X, SHEAVE_Y, 0));
    this.load.position.set(HANG_X, endY, 0);

    // 손잡이: 장착 애니메이션(옆에 놓인 자리 → 축 끝) 후 웜 축과 함께 회전
    const mountedQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.psi);
    const mountedP = new THREE.Vector3(CRANK_X, WORM_Y, WHEEL_Z);
    if (this.mountAge < 0) {
      this.crank.position.copy(ASIDE_POS);
      this.crank.quaternion.copy(ASIDE_Q);
    } else {
      const u = Math.min(1, this.mountAge / MOUNT_T);
      const k = u * u * (3 - 2 * u);
      this.crank.position.lerpVectors(ASIDE_POS, mountedP, k);
      this.crank.position.y += Math.sin(Math.PI * k) * 0.35;
      this.crank.quaternion.slerpQuaternions(ASIDE_Q, mountedQ, k);
    }
    if (this.pinModel) {
      this.pinModel.position.copy(mountedP);
      this.pinModel.quaternion.copy(mountedQ);
    }
  }

  // ── 미션 부품 ──

  /** 1단계: 테이퍼 핀(허브를 관통하는 방향 = 손잡이 국소 Z) — 원점 = 허브 중심 */
  private buildPin(): THREE.Group {
    const g = new THREE.Group();
    const L = 0.16;
    const r0 = 0.012;
    const r1 = 0.02;
    const prof: V2[] = [[0, -L / 2], [r0 - 0.003, -L / 2], [r0, -L / 2 + 0.003], [r1, L / 2 - 0.012]];
    for (let i = 1; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      prof.push([r1 * Math.cos(a), L / 2 - 0.012 + 0.012 * Math.sin(a)]);
    }
    const geo = latheZ(prof, 32);
    mesh(geo, brass({ roughness: 0.25 }), g);
    return g;
  }

  /** 2단계: 웜(웜 축 위) + 웜 휠(드럼 축 끝) — 원점 = 웜 휠 중심 */
  private buildWormSet(): THREE.Group {
    const g = new THREE.Group();
    const worm = new THREE.Group();
    worm.name = 'worm';
    const rRoot = WORM_RP - 1.25 * MODW;
    const rTip = WORM_RP + MODW;
    mesh(wormGeo(WORM_LEN, rRoot, rTip, WORM_PITCH), steel({ roughness: 0.25 }), worm);
    // 양 끝 칼라(나사면 끝을 막고 축에 고정)
    for (const s of [-1, 1]) {
      const c = cylAxis(rRoot + 0.006, -0.012, 0.012, 'x', 32);
      c.translate((s * WORM_LEN) / 2 + s * 0.006, 0, 0);
      mesh(c, steel({ roughness: 0.3 }), worm);
    }
    worm.position.set(0, WORM_Y - DRUM_Y, 0);
    g.add(worm);

    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    const shape = gearShape(N_WHEEL, RW + MODW, 2.25 * MODW, 0.28);
    const hub = new THREE.Path();
    hub.absarc(0, 0, 0.035, 0, TAU, true);
    shape.holes.push(hub);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0.032, 0, TAU, true);
      shape.holes.push(h);
    }
    const t = 0.05;
    const wg = new THREE.ExtrudeGeometry(shape, { depth: t - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelOffset: -0.004, bevelSegments: 1, curveSegments: 10 });
    wg.translate(0, 0, -(t - 0.008) / 2);
    mesh(wg, bronze({ roughness: 0.32 }), wheel);
    mesh(latheZ([[0.035, -0.045], [0.06, -0.045], [0.065, -0.04], [0.065, 0.04], [0.06, 0.045], [0.035, 0.045]], 40), bronze({ roughness: 0.32 }), wheel);
    // 키(드럼 축과 함께 돈다)
    mesh(new THREE.BoxGeometry(0.014, 0.012, 0.09).translate(0, 0.04, 0), steel(), wheel);
    g.add(wheel);
    return g;
  }

  private buildSlots(): void {
    const slotMat = (): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 });
    const r0 = new THREE.TorusGeometry(0.09, 0.016, 10, 40);
    r0.rotateY(Math.PI / 2);
    r0.translate(CRANK_X, WORM_Y, WHEEL_Z);
    const s0 = new THREE.Mesh(r0, slotMat());
    const a = new THREE.TorusGeometry(RW + MODW + 0.035, 0.02, 10, 64);
    a.translate(DRUM_X, DRUM_Y, WHEEL_Z);
    const b = new THREE.TorusGeometry(WORM_RP + MODW + 0.03, 0.014, 10, 40);
    b.rotateY(Math.PI / 2);
    b.translate(DRUM_X, WORM_Y, WHEEL_Z);
    const s1 = new THREE.Mesh(mergeAll([a, b]), slotMat());
    for (const [i, s] of [s0, s1].entries()) {
      s.userData.slot = true;
      s.userData.noAO = true;
      this.slots[i] = s;
      this.group.add(s);
    }
    this.hideSlot(1);
  }

  // ── 고정 구조 ──

  private buildBase(): void {
    const plate = paint(0x48515a, { roughness: 0.55 });
    mesh(box(3.55, BASE_T, 1.5, 0.225, BASE_T / 2, 0, 0.02), plate, this.group);
    // 바닥 미끄럼 방지 무늬(체크 플레이트 느낌의 얇은 줄)
    const bolts: THREE.BufferGeometry[] = [];
    for (const x of [-1.45, 1.9]) for (const z of [-0.65, 0.65]) bolts.push(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6).translate(x, BASE_T + 0.01, z));
    mesh(mergeAll(bolts), steel(), this.group);
    // 짐 받침(나무 팔레트)
    const pal = wood(0x9c7448, { roughness: 0.75 });
    const slats: THREE.BufferGeometry[] = [];
    for (const z of [-0.2, 0, 0.2]) slats.push(box(0.54, 0.035, 0.1, HANG_X, BASE_T + 0.0175, z, 0.006));
    for (const x of [-0.2, -0.07, 0.07, 0.2]) slats.push(box(0.09, 0.025, 0.54, HANG_X + x, BASE_T + 0.0575, 0, 0.005));
    mesh(mergeAll(slats), pal, this.group);
  }

  private buildCrane(): void {
    const yellow = paint(0xf2b619, { roughness: 0.38 });
    const dark = darkSteel({ roughness: 0.45 });
    // 기둥 + 받침 플랜지 + 보강판
    mesh(latheY([[0, BASE_T], [0.2, BASE_T], [0.2, BASE_T + 0.03], [0.19, BASE_T + 0.04], [COL_R, BASE_T + 0.04], [COL_R, COL_TOP], [0, COL_TOP]], 48).translate(COL_X, 0, 0), yellow, this.group);
    const gus: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(0.1, 0);
      s.lineTo(0, 0.22);
      s.closePath();
      const gg = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false });
      gg.translate(COL_R - 0.005, 0, -0.008);
      gg.rotateY(Math.PI / 4 + (i * Math.PI) / 2);
      gg.translate(COL_X, BASE_T + 0.04, 0);
      gus.push(gg);
    }
    mesh(mergeAll(gus), yellow, this.group);
    const fb: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      fb.push(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6).translate(COL_X + Math.cos(a) * 0.16, BASE_T + 0.045, Math.sin(a) * 0.16));
    }
    mesh(mergeAll(fb), steel(), this.group);
    // 선회 베어링(기둥 꼭대기)
    mesh(latheY([[0, COL_TOP], [0.15, COL_TOP], [0.15, JIB_Y0], [0, JIB_Y0]], 48).translate(COL_X, 0, 0), dark, this.group);

    // 지브(I형강): 아래 플랜지, 웨브, 위 플랜지
    const jl = JIB_X1 - JIB_X0;
    const jc = (JIB_X0 + JIB_X1) / 2;
    mesh(
      mergeAll([
        box(jl, 0.02, 0.16, jc, JIB_Y0 + 0.01, 0, 0.006),
        box(jl, JIB_Y1 - JIB_Y0 - 0.04, 0.025, jc, (JIB_Y0 + JIB_Y1) / 2, 0, 0.006),
        box(jl, 0.02, 0.16, jc, JIB_Y1 - 0.01, 0, 0.006),
        box(0.02, JIB_Y1 - JIB_Y0, 0.16, JIB_X0 + 0.01, (JIB_Y0 + JIB_Y1) / 2, 0, 0.006),
        box(0.02, JIB_Y1 - JIB_Y0, 0.16, JIB_X1 - 0.01, (JIB_Y0 + JIB_Y1) / 2, 0, 0.006)
      ]),
      yellow,
      this.group
    );
    // 마스트(두 기둥 사이로 와이어가 지나간다) + 인장봉
    const mast: THREE.BufferGeometry[] = [];
    for (const z of [-0.07, 0.07]) mast.push(box(0.07, MAST_TOP - JIB_Y1, 0.03, COL_X, (JIB_Y1 + MAST_TOP) / 2, z, 0.008));
    mast.push(box(0.1, 0.03, 0.18, COL_X, MAST_TOP + 0.015, 0, 0.008));
    mesh(mergeAll(mast), yellow, this.group);
    const tieMat = steel({ roughness: 0.35 });
    const tie = (a: THREE.Vector3, b: THREE.Vector3): void => {
      const m = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 12), tieMat, this.group);
      stretch(m, a, b);
    };
    for (const z of [-0.07, 0.07]) {
      tie(new THREE.Vector3(COL_X, MAST_TOP - 0.02, z), new THREE.Vector3(1.28, JIB_Y1 + 0.005, z));
      tie(new THREE.Vector3(COL_X, MAST_TOP - 0.02, z), new THREE.Vector3(-0.7, JIB_Y1 + 0.005, z));
    }
    // 무릎 버팀대(기둥 → 지브 아래)
    const knee = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 16), yellow, this.group);
    stretch(knee, new THREE.Vector3(COL_X + COL_R - 0.01, 1.72, 0), new THREE.Vector3(0.3, JIB_Y0, 0));

    // 도르래 2개(포크 + 축 핀)
    for (const [grp, x] of [
      [this.rootSheave, ROOT_X],
      [this.tipSheave, TIP_X]
    ] as const) {
      grp.position.set(x, SHEAVE_Y, 0);
      this.buildSheave(grp);
      const fork: THREE.BufferGeometry[] = [];
      for (const z of [-0.04, 0.04]) {
        const s = new THREE.Shape();
        s.moveTo(-0.07, 0);
        s.lineTo(0.07, 0);
        s.lineTo(0.04, SHEAVE_Y - JIB_Y1);
        s.absarc(0, SHEAVE_Y - JIB_Y1, 0.04, 0, Math.PI, false);
        s.lineTo(-0.07, 0);
        const fg = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 12 });
        fg.translate(x, JIB_Y1, z - 0.006);
        fork.push(fg);
      }
      fork.push(cylAxis(0.014, -0.055, 0.055, 'z', 16).translate(x, SHEAVE_Y, 0));
      const nuts = [-0.055, 0.055].map((z) => new THREE.CylinderGeometry(0.02, 0.02, 0.012, 6).rotateX(Math.PI / 2).translate(x, SHEAVE_Y, z));
      mesh(mergeAll([...fork, ...nuts]), dark, this.group);
    }
  }

  private buildSheave(grp: THREE.Group): void {
    const w = 0.025;
    const rf = SHEAVE_R + 0.016;
    const prof: V2[] = [
      [0.014, -w],
      [rf - 0.004, -w],
      [rf, -w + 0.004],
      [rf, -w + 0.008],
      [SHEAVE_R + 0.004, -WIRE_R * 0.7],
      [SHEAVE_R, 0],
      [SHEAVE_R + 0.004, WIRE_R * 0.7],
      [rf, w - 0.008],
      [rf, w - 0.004],
      [rf - 0.004, w],
      [0.014, w]
    ];
    mesh(latheZ(prof, 48), steel({ roughness: 0.35 }), grp);
    // 옆면 구멍 표시(회전이 보이게)
    const holes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      for (const z of [-w - 0.001, w + 0.001]) holes.push(new THREE.CylinderGeometry(0.018, 0.018, 0.002, 18).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.055, Math.sin(a) * 0.055, z));
    }
    mesh(mergeAll(holes), darkSteel({ roughness: 0.7 }), grp);
  }

  private buildWinchFrame(): void {
    const blue = paint(0x2e5f8f, { roughness: 0.42 });
    const dark = darkSteel({ roughness: 0.5 });
    // 옆판 2장(드럼 축 지지) + 바닥 앵글
    const plateShape = new THREE.Shape();
    const hw = 0.28;
    plateShape.moveTo(-hw, 0);
    plateShape.lineTo(hw, 0);
    plateShape.lineTo(hw, DRUM_Y - BASE_T);
    plateShape.absarc(0, DRUM_Y - BASE_T, hw, 0, Math.PI, false);
    plateShape.lineTo(-hw, 0);
    const plates: THREE.BufferGeometry[] = [];
    for (const z of [-PLATE_Z, PLATE_Z]) {
      const pg = new THREE.ExtrudeGeometry(plateShape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 24 });
      pg.translate(DRUM_X, BASE_T, z - 0.011);
      plates.push(pg);
      plates.push(box(2 * hw + 0.06, 0.03, 0.09, DRUM_X, BASE_T + 0.015, z + Math.sign(z) * 0.04, 0.006));
    }
    // 아래 연결봉(와이어 경로를 피해 낮게)
    plates.push(cylAxis(0.022, -PLATE_Z, PLATE_Z, 'z', 16).translate(DRUM_X + 0.18, 0.2, 0));
    plates.push(cylAxis(0.022, -PLATE_Z, PLATE_Z, 'z', 16).translate(DRUM_X - 0.18, 0.2, 0));
    mesh(mergeAll(plates), blue, this.group);
    // 드럼 축 베어링(옆판 바깥)
    const brg: THREE.BufferGeometry[] = [];
    for (const z of [-PLATE_Z - 0.011, PLATE_Z + 0.011]) {
      const s = Math.sign(z);
      brg.push(latheZ(s > 0 ? [[0.035, z], [0.07, z], [0.07, z + 0.022], [0.06, z + 0.03], [0.035, z + 0.03]] : [[0.035, z - 0.03], [0.06, z - 0.03], [0.07, z - 0.022], [0.07, z], [0.035, z]], 40).translate(DRUM_X, DRUM_Y, 0));
    }
    mesh(mergeAll(brg), castIron(), this.group);

    // 드럼(회전): 몸통 + 양쪽 플랜지 + 축
    const drumMat = paint(0x9d3a33, { roughness: 0.45, metalness: 0.3 });
    mesh(latheZ([[0.035, -DRUM_HALF], [DRUM_R, -DRUM_HALF], [DRUM_R, DRUM_HALF], [0.035, DRUM_HALF]], 64), drumMat, this.drum);
    const fl = 0.27;
    for (const z of [-DRUM_HALF - 0.02, DRUM_HALF]) {
      mesh(latheZ([[0.035, z], [fl - 0.006, z], [fl, z + 0.006], [fl, z + 0.014], [fl - 0.006, z + 0.02], [0.035, z + 0.02]], 64), castIron(), this.drum);
    }
    mesh(cylAxis(0.035, -PLATE_Z - 0.06, WHEEL_Z + 0.06, 'z', 24), steel(), this.drum);
    // 플랜지 표지(회전이 보이게) + 와이어 고정 클램프
    mesh(new THREE.BoxGeometry(0.03, 0.06, 0.004).translate(0, 0.22, DRUM_HALF + 0.022), plastic(0xeef1f4), this.drum);
    this.drum.position.set(DRUM_X, DRUM_Y, 0);

    // 웜 축 받침 기둥 2개 + 필로 블록
    const posts: THREE.BufferGeometry[] = [];
    const blocks: THREE.BufferGeometry[] = [];
    for (const x of [-1.1, -0.45]) {
      posts.push(box(0.08, WORM_Y - 0.05 - BASE_T, 0.12, x, (BASE_T + WORM_Y - 0.05) / 2, WHEEL_Z, 0.01));
      posts.push(box(0.16, 0.02, 0.18, x, BASE_T + 0.01, WHEEL_Z, 0.006));
      blocks.push(box(0.08, 0.1, 0.14, x, WORM_Y, WHEEL_Z, 0.02));
    }
    mesh(mergeAll(posts), blue, this.group);
    mesh(mergeAll(blocks), castIron(), this.group);
    // 웜 축(회전) — 조립 전에는 맨 축만
    this.wormShaft.position.set(0, WORM_Y, WHEEL_Z);
    mesh(cylAxis(0.022, SHAFT_X0, SHAFT_X1, 'x', 20), steel(), this.wormShaft);
    // 축 끝 키 홈(손잡이 허브가 끼워질 자리)
    mesh(new THREE.BoxGeometry(0.07, 0.008, 0.01).translate(SHAFT_X0 + 0.05, 0.022, 0), dark, this.wormShaft);
  }

  private buildWire(): void {
    const wireMat = steel({ roughness: 0.42 });
    wireMat.color.set(0xaab3bc);
    // 드럼 위 나선(감긴 부분만 drawRange로 표시)
    const segs = Math.ceil(LW_MAX / 0.008);
    const radial = 6;
    const hg = new THREE.TubeGeometry(new DrumHelix(), segs, WIRE_R, radial, false);
    this.helixSegs = segs;
    this.helixPerSeg = radial * 6;
    this.helixMesh = mesh(hg, wireMat, this.drum);
    this.helixMesh.frustumCulled = false;
    // 직선 구간 2개(길이가 변함) + 고정 구간(도르래 위 호, 수평)
    const unit = new THREE.CylinderGeometry(WIRE_R, WIRE_R, 1, 10);
    this.riseWire = mesh(unit, wireMat, this.group);
    this.hangWire = mesh(unit, wireMat, this.group);
    const a1 = new THREE.TorusGeometry(RSW, WIRE_R, 8, 20, Math.PI / 2);
    a1.rotateZ(Math.PI / 2);
    a1.translate(ROOT_X, SHEAVE_Y, 0);
    const a2 = new THREE.TorusGeometry(RSW, WIRE_R, 8, 20, Math.PI / 2);
    a2.translate(TIP_X, SHEAVE_Y, 0);
    const top = cylAxis(WIRE_R, ROOT_X, TIP_X, 'x', 10).translate(0, SHEAVE_Y + RSW, 0);
    mesh(mergeAll([a1, a2, top]), wireMat, this.group);
  }

  private buildLoad(): void {
    const L = this.load;
    const yellow = paint(0xf2b619, { roughness: 0.4 });
    const dark = darkSteel({ roughness: 0.4 });
    // 와이어 소켓 + 훅 블록
    mesh(latheY([[0, -0.05], [0.022, -0.05], [0.026, -0.04], [0.02, 0], [0, 0]], 20), steel(), L);
    mesh(box(0.1, 0.12, 0.08, 0, -0.11, 0, 0.02), yellow, L);
    mesh(mergeAll([box(0.012, 0.09, 0.085, -0.05, -0.11, 0, 0.004), box(0.012, 0.09, 0.085, 0.05, -0.11, 0, 0.004)]), dark, L);
    mesh(cylAxis(0.014, -0.2, -0.17, 'y', 16), steel(), L);
    // 훅: 3/4 원호 + 끝
    const hook = new THREE.TorusGeometry(0.048, 0.015, 12, 32, Math.PI * 1.55);
    hook.rotateZ(Math.PI * 0.62);
    hook.translate(0, -0.245, 0);
    mesh(hook, steel({ roughness: 0.3 }), L);
    // 훅에 걸린 마스터 링 + 슬링 4가닥
    const ring = new THREE.TorusGeometry(0.03, 0.008, 8, 24);
    ring.rotateY(Math.PI / 2);
    ring.translate(0, -0.3, 0);
    mesh(ring, steel(), L);
    const sling = plastic(0xe5484d, { roughness: 0.7 });
    const from = new THREE.Vector3(0, -0.325, 0);
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ] as const) {
      const m = mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), sling, L);
      stretch(m, from, new THREE.Vector3(sx * 0.17, -0.55, sz * 0.17));
    }
    // 나무 상자(모서리 띠)
    const crate = wood(0xb98552, { roughness: 0.7 });
    mesh(box(0.38, 0.38, 0.38, 0, -0.75, 0, 0.01), crate, L);
    const edges: THREE.BufferGeometry[] = [];
    const e = 0.2;
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        edges.push(box(0.4, 0.035, 0.035, 0, -0.75 + a * (e - 0.0175), b * (e - 0.0175), 0.006));
        edges.push(box(0.035, 0.4, 0.035, a * (e - 0.0175), -0.75, b * (e - 0.0175), 0.006));
        edges.push(box(0.035, 0.035, 0.4, a * (e - 0.0175), -0.75 + b * (e - 0.0175), 0, 0.006));
      }
    }
    edges.push(box(0.035, 0.36, 0.01, 0, -0.75, 0.195, 0.004));
    edges.push(box(0.36, 0.035, 0.01, 0, -0.75, 0.195, 0.004));
    mesh(mergeAll(edges), wood(0x7a5532, { roughness: 0.75 }), L);
    // 고리 4개(슬링 끝)
    const lugs: THREE.BufferGeometry[] = [];
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ] as const)
      lugs.push(new THREE.TorusGeometry(0.014, 0.005, 6, 12).translate(sx * 0.17, -0.545, sz * 0.17));
    mesh(mergeAll(lugs), steel(), L);
  }

  private buildCrank(): void {
    const c = this.crank;
    const armMat = paint(0x2b2f35, { roughness: 0.4, metalness: 0.4 });
    // 허브(축에 끼워짐, 핀 구멍 관통) + 팔 + 손잡이
    mesh(latheX([[0.022, -0.045], [0.054, -0.045], [0.06, -0.039], [0.06, 0.039], [0.054, 0.045], [0.022, 0.045]], 40), armMat, c);
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.05, Math.PI, TAU, false);
    s.absarc(0, CRANK_R, 0.032, 0, Math.PI, false);
    s.closePath();
    const arm = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 16 });
    arm.translate(0, 0, -0.008);
    arm.rotateY(Math.PI / 2); // 팔이 YZ 평면에(축 X에 수직)
    arm.translate(-0.056, 0, 0);
    mesh(arm, armMat, c);
    mesh(cylAxis(0.01, -0.07, -0.05, 'x', 12).translate(0, CRANK_R, 0), steel(), c);
    mesh(latheX([[0, -0.235], [0.018, -0.235], [0.026, -0.22], [0.026, -0.09], [0.022, -0.075], [0, -0.075]], 24).translate(0, CRANK_R, 0), wood(0x8a5a33, { roughness: 0.6 }), c);
    // 핀 구멍 표시(허브 양쪽)
    const holes: THREE.BufferGeometry[] = [];
    for (const z of [-0.0605, 0.0605]) holes.push(new THREE.CylinderGeometry(0.019, 0.019, 0.002, 16).rotateX(Math.PI / 2).translate(0, 0, z));
    mesh(mergeAll(holes), darkSteel({ roughness: 0.8 }), c);
  }
}
