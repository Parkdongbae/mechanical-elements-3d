// 선반: 벨트와 풀리 + 평 기어 미션
// 모터 1440rpm → 단차 풀리(피치 반지름 0.08 : 0.16 = 1 : 2) → 중간축 720rpm → 평 기어 18 : 54 (1 : 3) → 주축 240rpm. 전체 감속비 6 : 1.
// 좌표: X = 베드 길이(주축대 -X, 심압대 +X), Y = 위, Z = 앞(작업자 쪽). 회전축은 모두 X(rotation.x).
// 화면 회전 속도는 실제 회전수 × VIS — 축끼리의 비율은 그대로라 벨트·기어 접점 속도가 정확히 맞는다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildSpurGearMesh } from '../models/factory';
import { lathe as latheY, threadedRod, trapezoidThread, type V2 } from '../models/parts/geom';
import { aluminum, bronze, castIron, darkSteel, ghost, glow, paint, plastic, rubber, steel } from '../models/materials';
import { BaseMachine, type MachineDisplayItem, type MachineSim } from './types';

const TAU = Math.PI * 2;

// ── 베드·주축대 ──
const SPINDLE_Y = 1.62;
const BED_Y0 = 1.0;
const BED_TOP = 1.22;
const WAY_TOP = 1.27;
const BED_X0 = -1.55;
const BED_X1 = 1.55;
const HS_X0 = -1.5;
const HS_X1 = -0.75;
const HS_TOP = 1.95;
const HS_Z = 0.32;
const WALL_T = 0.06;
const HS_FLOOR = 1.245;

// ── 평 기어(주축대 안) ──
const GEAR_X = -1.1;
const GEAR_W = 0.08;
const MOD = 0.0078;
const N_SPINDLE = 54;
const N_PINION = 18;
const RP_SPINDLE = (MOD * N_SPINDLE) / 2;
const RP_PINION = (MOD * N_PINION) / 2;
const CS_Y = SPINDLE_Y - RP_SPINDLE - RP_PINION;

// ── 모터·단차 풀리·벨트 ──
const MOTOR_Y = 0.72;
const MOTOR_Z = -0.62;
const PULLEY_X0 = -1.645; // 풀리 안쪽 면
const STEP_W = 0.045;
/** 단차 피치 반지름(안쪽 단 → 바깥 단). 두 풀리의 합이 같아 어느 단에 걸어도 벨트 길이가 거의 같다 */
const MOTOR_PITCH = [0.1, 0.08, 0.06] as const;
const CS_PITCH = [0.14, 0.16, 0.18] as const;
const BELT_STEP = 1;
const BELT_T = 0.02;
const BELT_W = 0.034;
const BELT_X = PULLEY_X0 - STEP_W * (BELT_STEP + 0.5);
const R_BELT_M = MOTOR_PITCH[BELT_STEP];
const R_BELT_C = CS_PITCH[BELT_STEP];

const MOTOR_RPM = 1440;
const CS_RPM = (MOTOR_RPM * R_BELT_M) / R_BELT_C;
const SPINDLE_RPM = (CS_RPM * N_PINION) / N_SPINDLE;
const VIS = 1 / 6;
const wVis = (rpm: number): number => (rpm / 60) * TAU * VIS;

// ── 공작물·절삭 ──
const CHUCK_FACE = -0.5;
const WORK_END = 0.8;
const CUT_END = -0.3;
const R_LEVELS = [0.08, 0.063, 0.047] as const;
const TOOL_DX = -0.04; // 바이트 날끝 = 왕복대 기준 x + TOOL_DX
const TOOL_START = 0.84;
const T_FEED = 9;
const T_RETRACT = 0.45;
const T_RETURN = 1.7;
const T_ADV = 0.45;
const T_PASS = T_FEED + T_RETRACT + T_RETURN + T_ADV;
const RETRACT = 0.035;
const LEAD_PITCH = 0.05;
const LS_Y = 1.12;
const LS_Z = 0.33;
/** 자동 이송 중 왕복대 속도 = 리드 스크루 회전 × 피치 (하프 너트 체결) */
const FEED_V = (TOOL_START - CUT_END) / T_FEED;
const W_LEAD = (FEED_V / LEAD_PITCH) * TAU;
const RACK_R = 0.03;
const TAIL_X0 = 1.12;

const CHIPS = 36;

// ── 지오메트리 도구 ──

/** (r, 축방향) 프로파일을 X축 회전체로 (축방향 값이 곧 세계 x) */
function latheX(profile: V2[], segs = 48): THREE.BufferGeometry {
  const g = latheY(profile, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function cylX(r: number, x0: number, x1: number, segs = 32): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, segs);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, r = 0.015): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  g.translate(x, y, z);
  return g;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  o.receiveShadow = true;
  parent?.add(o);
  return o;
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

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  return t;
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const ease = (t: number): number => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

/**
 * 반지름이 다른 두 풀리를 감는 오픈 벨트 경로 (평면 좌표 p = (y, z)).
 * s 증가 방향은 (y,z) 평면에서 시계 방향 — 벨트가 +s로 움직이면 두 풀리 모두 rotation.x가 감소한다.
 * frame(s)는 피치선 위 점과 바깥 법선.
 */
class OpenBelt {
  readonly length: number;
  private readonly segs: { kind: 'line' | 'arc'; len: number; a: THREE.Vector2; b: THREE.Vector2; c: THREE.Vector2; r: number; phi0: number; n: THREE.Vector2 }[] = [];

  constructor(c1: THREE.Vector2, r1: number, c2: THREE.Vector2, r2: number) {
    const d = c1.distanceTo(c2);
    const u = c2.clone().sub(c1).divideScalar(d);
    const perp = new THREE.Vector2(-u.y, u.x);
    const s = (r1 - r2) / d;
    const c = Math.sqrt(1 - s * s);
    const n1 = u.clone().multiplyScalar(s).addScaledVector(perp, c);
    const n2 = u.clone().multiplyScalar(s).addScaledVector(perp, -c);
    const ang = (v: THREE.Vector2): number => Math.atan2(v.y, v.x);
    const wrap2 = 2 * Math.acos(s); // C2 감김각
    const p1a = c1.clone().addScaledVector(n1, r1);
    const p2a = c2.clone().addScaledVector(n1, r2);
    const p2b = c2.clone().addScaledVector(n2, r2);
    const p1b = c1.clone().addScaledVector(n2, r1);
    this.segs.push({ kind: 'line', len: p1a.distanceTo(p2a), a: p1a, b: p2a, c: c1, r: 0, phi0: 0, n: n1 });
    this.segs.push({ kind: 'arc', len: r2 * wrap2, a: p2a, b: p2b, c: c2, r: r2, phi0: ang(n1), n: n1 });
    this.segs.push({ kind: 'line', len: p2b.distanceTo(p1b), a: p2b, b: p1b, c: c2, r: 0, phi0: 0, n: n2 });
    this.segs.push({ kind: 'arc', len: r1 * (TAU - wrap2), a: p1b, b: p1a, c: c1, r: r1, phi0: ang(n2), n: n2 });
    this.length = this.segs.reduce((acc, g) => acc + g.len, 0);
  }

  frame(sIn: number): { p: THREE.Vector2; n: THREE.Vector2 } {
    let s = sIn % this.length;
    if (s < 0) s += this.length;
    for (const g of this.segs) {
      if (s <= g.len || g === this.segs[this.segs.length - 1]) {
        if (g.kind === 'line') {
          const t = g.len > 0 ? s / g.len : 0;
          return { p: g.a.clone().lerp(g.b, t), n: g.n.clone() };
        }
        const phi = g.phi0 - s / g.r;
        const n = new THREE.Vector2(Math.cos(phi), Math.sin(phi));
        return { p: g.c.clone().addScaledVector(n, g.r), n };
      }
      s -= g.len;
    }
    return { p: new THREE.Vector2(), n: new THREE.Vector2(1, 0) };
  }

  samples(arcStep = 0.012): number[] {
    const out: number[] = [];
    let base = 0;
    for (const g of this.segs) {
      const n = g.kind === 'line' ? 4 : Math.max(8, Math.ceil(g.len / arcStep));
      for (let i = 0; i < n; i++) out.push(base + (g.len * i) / n);
      base += g.len;
    }
    out.push(this.length);
    return out;
  }
}

/** 오픈 벨트 띠 지오메트리 (x = 벨트 중심면). u = s / 둘레 */
function beltGeometry(path: OpenBelt, x: number, width: number, t: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ss = path.samples();
  const hw = width / 2;
  for (let face = 0; face < 4; face++) {
    const base = pos.length / 3;
    for (const s of ss) {
      const { p, n } = path.frame(s);
      const u = s / path.length;
      const pin = p.clone().addScaledVector(n, -t / 2);
      const pout = p.clone().addScaledVector(n, t / 2);
      if (face < 2) {
        const q = face === 0 ? pout : pin;
        const sg = face === 0 ? 1 : -1;
        pos.push(x - hw, q.x, q.y, x + hw, q.x, q.y);
        nor.push(0, n.x * sg, n.y * sg, 0, n.x * sg, n.y * sg);
        uv.push(u, 0, u, 1);
      } else {
        const xx = face === 2 ? x + hw : x - hw;
        const nx = face === 2 ? 1 : -1;
        pos.push(xx, pin.x, pin.y, xx, pout.x, pout.y);
        nor.push(nx, 0, 0, nx, 0, 0);
        uv.push(u, 0, u, 0.05);
      }
    }
    for (let i = 0; i < ss.length - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * 맞물림 위상(Clock.ts와 같은 규약): 구동 기어(각 θd, 잇수 nD)에서 방향 φ에 있는 피동 기어(잇수 nF)의 회전각.
 * 이 중심 (k+½)·step, 이골 중심 k·step.
 */
function meshPhase(thetaD: number, nD: number, phi: number, nF: number): number {
  const stepD = TAU / nD;
  const e = thetaD + stepD / 2 - phi;
  const eps = e - stepD * Math.round(e / stepD);
  return phi + Math.PI - (eps * nD) / nF;
}

interface Chip {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
  spin: THREE.Vector3;
}

export class Lathe extends BaseMachine {
  readonly id = 'lathe';
  private beltModel: THREE.Group | null = null;
  private gearModel: THREE.Group | null = null;
  private motorPulley: THREE.Object3D | null = null;
  private csPulley: THREE.Object3D | null = null;
  private pinion: THREE.Object3D | null = null;
  private spindleGear: THREE.Object3D | null = null;
  private beltTex: THREE.Texture | null = null;
  private beltRepeats = 1;

  private readonly motorRotor = new THREE.Group();
  private readonly countershaft = new THREE.Group();
  private readonly spindle = new THREE.Group();
  private readonly leadScrew = new THREE.Group();
  private readonly carriage = new THREE.Group();
  private readonly cross = new THREE.Group();
  private readonly apronWheel = new THREE.Group();
  private segA!: THREE.Mesh;
  private segB!: THREE.Mesh;
  private segC!: THREE.Mesh;
  private chipMesh!: THREE.InstancedMesh;
  private chips: Chip[] = [];
  private chipClock = 0;

  private readonly beltPath = new OpenBelt(new THREE.Vector2(MOTOR_Y, MOTOR_Z), R_BELT_M, new THREE.Vector2(CS_Y, 0), R_BELT_C);

  private motorAngle = 0;
  private csAngle = 0;
  private spindleAngle = 0;
  private gearOffset = 0;
  private spindleBase = 0;
  private beltS = 0;
  private leadAngle = 0;
  private simTime = 0;
  private simActive = false;
  private lastT = -1;

  constructor() {
    super();
    this.buildStand();
    this.buildBed();
    this.buildHeadstock();
    this.buildSpindle();
    this.buildTailstock();
    this.buildCarriage();
    this.buildMotor();
    this.buildChips();
    this.group.add(this.motorRotor, this.countershaft, this.spindle, this.leadScrew, this.carriage);
    this.buildSlots();
    this.poseCut(TOOL_START, R_LEVELS[1], R_LEVELS[0], R_LEVELS[0], WORK_END);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.beltModel !== null : this.gearModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(BELT_X, CS_Y, 0) : new THREE.Vector3(GEAR_X, SPINDLE_Y, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0
      ? new THREE.Vector3(BELT_X, (MOTOR_Y + CS_Y) / 2, MOTOR_Z / 2)
      : new THREE.Vector3(GEAR_X, (SPINDLE_Y + CS_Y) / 2, HS_Z);
  }

  buildStepModel(step: number): THREE.Group {
    return step === 0 ? this.buildBeltSet() : this.buildGearPair();
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      // 모델 원점 = 중간축 풀리 중심(BELT_X, CS_Y, 0). 벨트는 기계 좌표로 되돌리고 풀리는 각 회전축에 끼운다.
      model.position.copy(this.getFlyTarget(0));
      this.group.add(model);
      this.beltModel = model;
      const mp = model.getObjectByName('motorPulley');
      const cp = model.getObjectByName('csPulley');
      if (mp) {
        mp.position.set(0, 0, 0);
        mp.rotation.set(0, 0, 0);
        this.motorRotor.add(mp);
        this.motorPulley = mp;
      }
      if (cp) {
        cp.position.set(0, 0, 0);
        cp.rotation.set(0, 0, 0);
        this.countershaft.add(cp);
        this.csPulley = cp;
      }
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.copy(this.getFlyTarget(1));
      this.group.add(model);
      this.gearModel = model;
      const pin = model.getObjectByName('pinion');
      const gear = model.getObjectByName('spindleGear');
      if (pin) {
        pin.position.set(0, 0, 0);
        pin.rotation.set(0, 0, 0);
        this.countershaft.add(pin);
        this.pinion = pin;
      }
      if (gear) {
        gear.position.set(0, 0, 0);
        // 주축 기어를 피니언의 현재 각도에 맞물리는 위상으로 끼운다(피니언 → 기어 중심 방향 = +Y = 국소각 π/2)
        const want = meshPhase(this.csAngle, N_PINION, Math.PI / 2, N_SPINDLE);
        this.gearOffset = want - this.spindleAngle;
        // 이후 주축각 = 기준 − 중간축각 × 18/54 (설치 순간의 각도에서 이어지도록 기준을 잡는다)
        this.spindleBase = this.spindleAngle + this.csAngle * (N_PINION / N_SPINDLE);
        gear.rotation.set(this.gearOffset, 0, 0);
        this.spindle.add(gear);
        this.spindleGear = gear;
      }
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.motorPulley) this.motorRotor.remove(this.motorPulley);
    if (this.csPulley) this.countershaft.remove(this.csPulley);
    if (this.pinion) this.countershaft.remove(this.pinion);
    if (this.spindleGear) this.spindle.remove(this.spindleGear);
    if (this.beltModel) this.group.remove(this.beltModel);
    if (this.gearModel) this.group.remove(this.gearModel);
    this.motorPulley = this.csPulley = this.pinion = this.spindleGear = null;
    this.beltModel = this.gearModel = null;
    this.beltTex = null;
    this.simActive = false;
    this.simTime = 0;
    this.lastT = -1;
    this.motorAngle = this.csAngle = this.spindleAngle = this.gearOffset = this.spindleBase = this.beltS = this.leadAngle = 0;
    this.motorRotor.rotation.x = 0;
    this.countershaft.rotation.x = 0;
    this.spindle.rotation.x = 0;
    this.leadScrew.rotation.x = 0;
    for (const c of this.chips) c.age = c.life;
    this.writeChips();
    this.poseCut(TOOL_START, R_LEVELS[1], R_LEVELS[0], R_LEVELS[0], WORK_END);
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    const dt = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, t - this.lastT));
    this.lastT = t;
    // 조립 중에도 모터는 돈다. 벨트가 걸리면 중간축까지 돈다(주축은 기어가 없어 정지).
    if (!this.simActive) this.drive(dt);
  }

  createSim(): MachineSim {
    if (!this.beltModel || !this.gearModel) throw new Error('lathe mission incomplete');
    this.simActive = true;
    this.simTime = 0;
    const ratio = MOTOR_RPM / SPINDLE_RPM;
    const display: MachineDisplayItem[] = [
      { label: '모터 회전수', value: String(MOTOR_RPM), unit: 'rpm', tone: 'blue' },
      { label: '주축 회전수', value: SPINDLE_RPM.toFixed(0), unit: 'rpm', tone: 'red' },
      { label: '감속비', value: ratio.toFixed(0), unit: `: 1 (풀리 ${(R_BELT_C / R_BELT_M).toFixed(0)} × 기어 ${N_SPINDLE}/${N_PINION})` }
    ];
    return {
      update: (dt: number) => this.drive(dt),
      getDisplay: () => display
    };
  }

  // ── 구동 ──

  private drive(dt: number): void {
    const wm = wVis(MOTOR_RPM);
    // 오픈 벨트: 두 풀리 같은 방향(시계) — 벨트 속도 = ω모터·r모터 = ω중간축·r중간축
    this.motorAngle -= wm * dt;
    this.motorRotor.rotation.x = this.motorAngle;
    if (this.beltModel) {
      const v = wm * R_BELT_M;
      this.beltS += v * dt;
      this.csAngle -= (v / R_BELT_C) * dt;
      this.countershaft.rotation.x = this.csAngle;
      if (this.beltTex) this.beltTex.offset.x = -(((this.beltRepeats * this.beltS) / this.beltPath.length) % 1);
    }
    if (this.gearModel) {
      // 평 기어: 반대 방향, 잇수비
      this.spindleAngle = this.spindleBase - this.csAngle * (N_PINION / N_SPINDLE);
      this.spindle.rotation.x = this.spindleAngle;
    }
    if (this.simActive) {
      this.simTime += dt;
      this.leadAngle += W_LEAD * dt;
      this.leadScrew.rotation.x = this.leadAngle;
      this.runCycle(dt);
    }
  }

  /** 왕복대 사이클: 이송(절삭) → 바이트 후퇴 → 빠른 복귀 → 다음 절삭 깊이로 전진. 2회 절삭 후 새 소재 */
  private runCycle(dt: number): void {
    const tc = this.simTime % (T_PASS * 2);
    const pass = tc < T_PASS ? 0 : 1;
    const tl = tc - pass * T_PASS;
    const rOut = R_LEVELS[pass];
    const rIn = pass === 0 ? R_LEVELS[1] : R_LEVELS[2];
    let toolX: number;
    let tipZ: number;
    let cutting = false;
    if (tl < T_FEED) {
      toolX = TOOL_START - FEED_V * tl;
      tipZ = rIn;
      cutting = toolX < WORK_END;
      this.poseCut(toolX, tipZ, rOut, rIn, clamp(toolX, CUT_END, WORK_END));
    } else if (tl < T_FEED + T_RETRACT) {
      toolX = CUT_END;
      tipZ = rIn + RETRACT * ease((tl - T_FEED) / T_RETRACT);
      this.poseCut(toolX, tipZ, rOut, rIn, CUT_END);
    } else if (tl < T_FEED + T_RETRACT + T_RETURN) {
      toolX = CUT_END + (TOOL_START - CUT_END) * ease((tl - T_FEED - T_RETRACT) / T_RETURN);
      tipZ = rIn + RETRACT;
      this.poseCut(toolX, tipZ, rOut, rIn, CUT_END);
    } else {
      // 다음 깊이로 전진. 두 번째 절삭이 끝나면 새 소재(원래 지름)로 갈아 끼운 상태
      const next = pass === 0 ? R_LEVELS[2] : R_LEVELS[1];
      const k = ease((tl - T_FEED - T_RETRACT - T_RETURN) / T_ADV);
      toolX = TOOL_START;
      tipZ = rIn + RETRACT + (next - rIn - RETRACT) * k;
      if (pass === 0) this.poseCut(toolX, tipZ, rOut, rIn, CUT_END);
      else this.poseCut(toolX, tipZ, R_LEVELS[0], R_LEVELS[0], WORK_END);
    }
    this.updateChips(dt, cutting, toolX, rIn);
  }

  /** 왕복대·바이트 위치와 공작물 단(段) 형상: [척~CUT_END] 원래 지름, [CUT_END~cutX] rOut, [cutX~끝] rIn */
  private poseCut(toolX: number, tipZ: number, rOut: number, rIn: number, cutX: number): void {
    this.carriage.position.x = toolX - TOOL_DX;
    this.cross.position.z = tipZ - R_LEVELS[1];
    this.apronWheel.rotation.z = -this.carriage.position.x / RACK_R;
    const setSeg = (m: THREE.Mesh, x0: number, x1: number, r: number): void => {
      const len = x1 - x0;
      m.visible = len > 1e-4;
      m.position.x = x0;
      m.scale.set(Math.max(len, 1e-4), r, r);
    };
    setSeg(this.segA, CHUCK_FACE - 0.02, CUT_END, R_LEVELS[0]);
    setSeg(this.segB, CUT_END, cutX, rOut);
    setSeg(this.segC, cutX, WORK_END, rIn);
  }

  // ── 칩 ──

  private buildChips(): void {
    const geo = new THREE.TorusGeometry(0.012, 0.0032, 5, 12, Math.PI * 1.5);
    this.chipMesh = new THREE.InstancedMesh(geo, bronze({ roughness: 0.3 }), CHIPS);
    this.chipMesh.castShadow = false;
    this.chipMesh.frustumCulled = false;
    for (let i = 0; i < CHIPS; i++) {
      this.chips.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 1, life: 1, spin: new THREE.Vector3() });
    }
    this.writeChips();
    this.group.add(this.chipMesh);
  }

  private updateChips(dt: number, cutting: boolean, toolX: number, rIn: number): void {
    if (cutting) {
      this.chipClock += dt * 34;
      while (this.chipClock >= 1) {
        this.chipClock -= 1;
        const c = this.chips.find((k) => k.age >= k.life);
        if (!c) break;
        // 바이트 윗면(경사면)을 타고 위·뒤(+x)로 말려 나간다
        c.p.set(toolX + 0.01, SPINDLE_Y + 0.025, rIn + 0.005);
        c.v.set(0.25 + Math.random() * 0.35, 0.55 + Math.random() * 0.45, (Math.random() - 0.3) * 0.18);
        c.age = 0;
        c.life = 0.38 + Math.random() * 0.15;
        c.spin.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      }
    }
    for (const c of this.chips) {
      if (c.age >= c.life) continue;
      c.age += dt;
      c.v.y -= 3.2 * dt;
      c.p.addScaledVector(c.v, dt);
    }
    this.writeChips();
  }

  private writeChips(): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    this.chips.forEach((c, i) => {
      const alive = c.age < c.life;
      const k = alive ? Math.min(1, (c.life - c.age) / 0.12) : 0;
      e.set(c.spin.x * c.age, c.spin.y * c.age, c.spin.z * c.age);
      q.setFromEuler(e);
      s.setScalar(Math.max(1e-4, k));
      m.compose(c.p, q, s);
      this.chipMesh.setMatrixAt(i, m);
    });
    this.chipMesh.instanceMatrix.needsUpdate = true;
  }

  // ── 미션 부품 ──

  /** 1단계: 모터 단차 풀리 + 중간축 단차 풀리 + 평벨트 (원점 = 중간축 풀리 중심) */
  private buildBeltSet(): THREE.Group {
    const g = new THREE.Group();
    const o = this.getFlyTarget(0);
    const pulleyMat = paint(0xa63c37, { roughness: 0.38, metalness: 0.35 });
    const markMat = paint(0xeef1f4, { roughness: 0.4 });
    const mp = this.buildStepPulley(MOTOR_PITCH, 0.022, pulleyMat, markMat);
    mp.name = 'motorPulley';
    mp.position.set(0 - o.x, MOTOR_Y - o.y, MOTOR_Z - o.z);
    const cp = this.buildStepPulley(CS_PITCH, 0.03, pulleyMat, markMat);
    cp.name = 'csPulley';
    cp.position.set(-o.x, 0, 0);
    g.add(mp, cp);

    const tex = canvasTex(256, 32, (ctx) => {
      ctx.fillStyle = '#25282d';
      ctx.fillRect(0, 0, 256, 32);
      ctx.fillStyle = '#30343a';
      for (let x = 0; x < 256; x += 8) ctx.fillRect(x, 0, 3, 32);
      ctx.fillStyle = '#e9edf1';
      ctx.fillRect(10, 9, 46, 14);
      ctx.fillStyle = '#c94a3f';
      ctx.fillRect(62, 9, 10, 14);
    });
    this.beltRepeats = Math.round(this.beltPath.length / 0.3);
    tex.repeat.set(this.beltRepeats, 1);
    const beltMat = rubber({ roughness: 0.75 });
    beltMat.color.set(0xffffff);
    beltMat.map = tex;
    beltMat.side = THREE.DoubleSide;
    const belt = mesh(beltGeometry(this.beltPath, BELT_X, BELT_W, BELT_T), beltMat);
    belt.position.set(-o.x, -o.y, -o.z);
    belt.name = 'belt';
    g.add(belt);
    this.beltTex = tex;
    return g;
  }

  /** 3단 단차 풀리: 안쪽 면 x = PULLEY_X0, 바깥쪽(−x)으로 단이 이어진다 */
  private buildStepPulley(pitch: readonly [number, number, number], bore: number, m: THREE.Material, markMat: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const c = 0.004;
    const rs = pitch.map((p) => p - BELT_T / 2);
    const x0 = PULLEY_X0;
    // 축방향 값 = 세계 x. 바깥벽은 x 증가 방향으로 적는다.
    const prof: V2[] = [[bore, x0 - 3 * STEP_W]];
    for (let k = 2; k >= 0; k--) {
      const r = rs[k]!;
      const xa = x0 - (k + 1) * STEP_W;
      const xb = x0 - k * STEP_W;
      prof.push([r - c, xa], [r, xa + c], [r, xb - c], [r - c, xb]);
    }
    prof.push([0.05, x0], [0.05, x0 + 0.03], [bore, x0 + 0.03], [bore, x0 - 3 * STEP_W]);
    mesh(latheX(prof, 64), m, g);
    // 회전 위상 표시: 벨트가 걸리지 않은 단의 둘레에 흰 줄
    const marks: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      if (k === BELT_STEP) continue;
      const r = rs[k]!;
      const b = new THREE.BoxGeometry(STEP_W - 0.014, 0.003, 0.014);
      b.translate(x0 - (k + 0.5) * STEP_W, r + 0.001, 0);
      marks.push(b);
    }
    mesh(mergeAll(marks), markMat, g);
    // 키·너트
    const nut = new THREE.CylinderGeometry(bore + 0.014, bore + 0.014, 0.02, 6);
    nut.rotateZ(-Math.PI / 2);
    nut.translate(x0 - 3 * STEP_W - 0.012, 0, 0);
    mesh(nut, steel(), g);
    return g;
  }

  /** 2단계: 주축 평 기어 54잇수 + 중간축 피니언 18잇수 (원점 = 주축 기어 중심) */
  private buildGearPair(): THREE.Group {
    const g = new THREE.Group();
    const big = new THREE.Group();
    big.name = 'spindleGear';
    const bm = buildSpurGearMesh(N_SPINDLE, RP_SPINDLE + MOD, 2.25 * MOD, GEAR_W, 0xd4a94a);
    bm.geometry.rotateY(Math.PI / 2);
    bm.position.x = GEAR_X;
    big.add(bm);
    // 보스(허브)와 고정 나사: 주축과 함께 도는 것이 보이게
    const bossMat = steel({ roughness: 0.3 });
    mesh(latheX([[0.045, GEAR_X - GEAR_W / 2 - 0.05], [0.07, GEAR_X - GEAR_W / 2 - 0.05], [0.075, GEAR_X - GEAR_W / 2 - 0.045], [0.075, GEAR_X - GEAR_W / 2], [0.045, GEAR_X - GEAR_W / 2]], 40), bossMat, big);
    const screw = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12);
    screw.translate(GEAR_X - GEAR_W / 2 - 0.025, 0.08, 0);
    mesh(screw, darkSteel(), big);
    big.position.set(0, 0, 0);

    const pin = new THREE.Group();
    pin.name = 'pinion';
    const pm = buildSpurGearMesh(N_PINION, RP_PINION + MOD, 2.25 * MOD, GEAR_W + 0.012, 0xc9b06a);
    pm.geometry.rotateY(Math.PI / 2);
    pm.position.x = GEAR_X;
    pin.add(pm);
    mesh(latheX([[0.03, GEAR_X - GEAR_W / 2 - 0.045], [0.045, GEAR_X - GEAR_W / 2 - 0.045], [0.05, GEAR_X - GEAR_W / 2 - 0.04], [0.05, GEAR_X - GEAR_W / 2 - 0.006], [0.03, GEAR_X - GEAR_W / 2 - 0.006]], 32), bossMat, pin);
    pin.position.set(0, CS_Y - SPINDLE_Y, 0);

    // 그룹 원점을 (GEAR_X, SPINDLE_Y, 0)로: 자식은 x를 기계 좌표로 두었으므로 그만큼 되돌린다
    const wrap = new THREE.Group();
    wrap.position.set(-GEAR_X, 0, 0);
    wrap.add(big, pin);
    g.add(wrap);
    // installStep에서 축 그룹으로 옮겨 달기 위해 이름 검색이 wrap 아래까지 닿는다
    return g;
  }

  private buildSlots(): void {
    const slotMat = (): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 });
    // 1단계: 벨트 경로 윤곽 + 두 풀리 자리 링
    const pts = this.beltPath
      .samples(0.03)
      .slice(0, -1)
      .map((s) => {
        const f = this.beltPath.frame(s);
        const p = f.p.clone().addScaledVector(f.n, 0.022);
        return new THREE.Vector3(BELT_X, p.x, p.y);
      });
    const loop = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 220, 0.014, 8, true);
    const s0 = new THREE.Mesh(loop, slotMat());
    // 2단계: 주축 기어·피니언 자리
    const ring = (r: number, y: number, tube: number): THREE.BufferGeometry => {
      const t = new THREE.TorusGeometry(r, tube, 10, 64);
      t.rotateY(Math.PI / 2);
      t.translate(GEAR_X, y, 0);
      return t;
    };
    const s1 = new THREE.Mesh(mergeAll([ring(RP_SPINDLE + MOD + 0.03, SPINDLE_Y, 0.02), ring(RP_PINION + MOD + 0.012, CS_Y, 0.014)]), slotMat());
    for (const [i, s] of [s0, s1].entries()) {
      s.userData.slot = true;
      s.userData.noAO = true;
      this.slots[i] = s;
      this.group.add(s);
    }
    this.hideSlot(1);
  }

  // ── 고정 구조 ──

  private buildStand(): void {
    const pedMat = paint(0x39444f, { roughness: 0.45 });
    const doorMat = paint(0x46525e, { roughness: 0.45 });
    const handle = steel({ roughness: 0.3 });
    for (const [x0, x1] of [
      [-1.5, -0.85],
      [0.85, 1.5]
    ] as const) {
      const cx = (x0 + x1) / 2;
      const w = x1 - x0;
      mesh(box(w, 0.9, 0.72, cx, 0.5, 0, 0.03), pedMat, this.group);
      // 받침 발판 + 문짝
      mesh(box(w + 0.06, 0.06, 0.8, cx, 0.03, 0, 0.02), darkSteel({ roughness: 0.6 }), this.group);
      mesh(box(w - 0.12, 0.66, 0.02, cx, 0.52, 0.365, 0.008), doorMat, this.group);
      mesh(box(0.025, 0.12, 0.025, cx + w / 2 - 0.12, 0.6, 0.385, 0.008), handle, this.group);
    }
    // 칩 받이(트레이): 두 받침대 위
    const tray = darkSteel({ roughness: 0.55 });
    mesh(box(3.24, 0.05, 0.94, 0, 0.975, 0, 0.012), tray, this.group);
    for (const sz of [-1, 1]) mesh(box(3.24, 0.07, 0.03, 0, 1.025, sz * 0.455, 0.01), tray, this.group);
    for (const sx of [-1, 1]) mesh(box(0.03, 0.07, 0.94, sx * 1.605, 1.025, 0, 0.01), tray, this.group);
    // 조작반(왼쪽 받침대 앞): 시작(초록)·정지(빨강) 버튼
    const panel = new THREE.Group();
    panel.position.set(-1.0, 0.86, 0.39);
    mesh(box(0.22, 0.12, 0.05, 0, 0, 0, 0.012), plastic(0x2b2f35), panel);
    const btn = (color: number, x: number): void => {
      const b = new THREE.CylinderGeometry(0.022, 0.022, 0.02, 20);
      b.rotateX(Math.PI / 2);
      b.translate(x, 0, 0.03);
      mesh(b, glow(color, 0.5), panel);
    };
    btn(0x2fbf71, -0.05);
    btn(0xe5484d, 0.05);
    this.group.add(panel);
  }

  private buildBed(): void {
    const bedMat = paint(0x56717f, { roughness: 0.4 });
    // 베드 몸체 + 아래 리브(옆에서 보이는 홈)
    mesh(box(BED_X1 - BED_X0, BED_TOP - BED_Y0, 0.56, 0, (BED_Y0 + BED_TOP) / 2, 0, 0.02), bedMat, this.group);
    // 미끄럼면(안내면): 앞·뒤 연삭 레일
    const wayMat = steel({ roughness: 0.22 });
    const wx0 = HS_X1;
    for (const z of [-0.19, 0.19]) mesh(box(BED_X1 - wx0, WAY_TOP - BED_TOP, 0.1, (BED_X1 + wx0) / 2, (BED_TOP + WAY_TOP) / 2, z, 0.008), wayMat, this.group);
    // 랙(베드 앞면, 왕복대 핸들 피니언과 맞물림)
    const rackGeos: THREE.BufferGeometry[] = [];
    for (let x = wx0 + 0.05; x < BED_X1 - 0.05; x += 0.025) {
      const b = new THREE.BoxGeometry(0.012, 0.03, 0.012);
      b.translate(x, 1.19, 0.286);
      rackGeos.push(b);
    }
    mesh(mergeAll(rackGeos), darkSteel(), this.group);
    // 이송 기어 박스(주축대 아래 앞) + 다이얼 노브
    const boxMat = paint(0x56717f, { roughness: 0.4 });
    mesh(box(0.46, 0.2, 0.14, -1.28, 1.115, 0.35, 0.025), boxMat, this.group);
    const knobGeos: THREE.BufferGeometry[] = [];
    for (const x of [-1.42, -1.3, -1.18]) {
      const k = new THREE.CylinderGeometry(0.022, 0.026, 0.04, 20);
      k.rotateX(Math.PI / 2);
      k.translate(x, 1.15, 0.44);
      knobGeos.push(k);
    }
    mesh(mergeAll(knobGeos), plastic(0x1f2226), this.group);
    // 리드 스크루 끝 받침(오른쪽)
    mesh(box(0.08, 0.16, 0.12, 1.51, 1.12, 0.335, 0.015), boxMat, this.group);

    // 리드 스크루(사다리꼴 나사, 왕복대 자동 이송)
    const acme = trapezoidThread(0.3, 0.3);
    const ls = threadedRod({ rMajor: 0.02, depth: 0.007, pitch: LEAD_PITCH, y0: -1.05, y1: 1.47, segs: 20, profile: acme.profile, uSamples: acme.uSamples, capTop: true });
    ls.rotateZ(-Math.PI / 2);
    mesh(ls, steel({ roughness: 0.3 }), this.leadScrew);
    this.leadScrew.position.set(0, LS_Y, LS_Z);
  }

  private buildHeadstock(): void {
    const hsMat = paint(0x56717f, { roughness: 0.4 });
    const h = HS_TOP - BED_TOP;
    const yc = (BED_TOP + HS_TOP) / 2;
    // 양쪽 벽(주축·중간축 베어링 자리) + 바닥판
    for (const x of [HS_X0 + WALL_T / 2, HS_X1 - WALL_T / 2]) mesh(box(WALL_T, h, HS_Z * 2, x, yc, 0, 0.02), hsMat, this.group);
    mesh(box(HS_X1 - HS_X0 - 2 * WALL_T + 0.02, HS_FLOOR - BED_TOP, HS_Z * 2, (HS_X0 + HS_X1) / 2, (BED_TOP + HS_FLOOR) / 2, 0, 0.006), castIron(), this.group);
    // 투명 커버(내부 기어가 보이게) + 모서리 테두리
    const inner = HS_X1 - HS_X0 - 2 * WALL_T;
    const cover = mesh(box(inner, HS_TOP - HS_FLOOR, HS_Z * 2 - 0.01, (HS_X0 + HS_X1) / 2, (HS_FLOOR + HS_TOP) / 2, 0, 0.03), ghost(0xa9bccd, 0.3), this.group);
    cover.castShadow = false;
    cover.userData.noAO = true;
    cover.renderOrder = 2;
    const rim = aluminum({ roughness: 0.35 });
    const rims: THREE.BufferGeometry[] = [];
    for (const [y, z] of [
      [HS_TOP - 0.012, HS_Z - 0.012],
      [HS_TOP - 0.012, -HS_Z + 0.012],
      [HS_FLOOR + 0.012, HS_Z - 0.012]
    ] as const) {
      rims.push(box(inner, 0.024, 0.024, (HS_X0 + HS_X1) / 2, y, z, 0.008));
    }
    mesh(mergeAll(rims), rim, this.group);
    // 베어링 캡(벽 바깥면)
    const capMat = castIron();
    const caps: THREE.BufferGeometry[] = [];
    for (const [y, r] of [
      [SPINDLE_Y, 0.085],
      [CS_Y, 0.06]
    ] as const) {
      caps.push(latheX([[0.0, HS_X0 - 0.035], [r - 0.01, HS_X0 - 0.035], [r, HS_X0 - 0.025], [r, HS_X0 + 0.001], [0.0, HS_X0 + 0.001]], 40).translate(0, y, 0));
      caps.push(latheX([[0.0, HS_X1 - 0.001], [r, HS_X1 - 0.001], [r, HS_X1 + 0.022], [r - 0.01, HS_X1 + 0.032], [0.0, HS_X1 + 0.032]], 40).translate(0, y, 0));
    }
    // 오른쪽 벽 캡은 주축이 관통하므로 링 모양으로 남긴다 — 축 반지름보다 안쪽은 축이 덮는다
    mesh(mergeAll(caps), capMat, this.group);
    // 변속 레버 2개(벽 위)
    const lever = steel({ roughness: 0.3 });
    const knob = plastic(0x1f2226);
    for (const [x, a] of [
      [HS_X1 - 0.03, 0.4],
      [HS_X0 + 0.03, -0.3]
    ] as const) {
      const gL = new THREE.Group();
      gL.position.set(x, HS_TOP, 0.18);
      gL.rotation.x = a;
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20).translate(0, 0.01, 0), lever, gL);
      mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 12).translate(0, 0.08, 0), lever, gL);
      mesh(new THREE.SphereGeometry(0.024, 18, 12).translate(0, 0.16, 0), knob, gL);
      this.group.add(gL);
    }
    // 중간축(벨트 풀리 → 피니언). 조립 전에는 풀리·피니언 없이 축만 있다.
    this.countershaft.position.set(0, CS_Y, 0);
    mesh(cylX(0.03, -1.82, HS_X1 + 0.03, 24), steel(), this.countershaft);
    const key = new THREE.BoxGeometry(0.1, 0.012, 0.014);
    key.translate(BELT_X, 0.031, 0);
    mesh(key, darkSteel(), this.countershaft);
  }

  private buildSpindle(): void {
    const sp = this.spindle;
    sp.position.set(0, SPINDLE_Y, 0);
    const shaftMat = steel({ roughness: 0.28 });
    mesh(latheX([[0, -1.6], [0.035, -1.6], [0.04, -1.595], [0.04, -1.52], [0.045, -1.52], [0.045, -0.66], [0, -0.66]], 32), shaftMat, sp);
    // 뒤쪽 고정 너트(육각) — 회전이 보인다
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 6).rotateZ(-Math.PI / 2).translate(-1.555, 0, 0), darkSteel(), sp);
    // 주축 코 플랜지 + 3조 척
    const chuckMat = steel({ roughness: 0.32 });
    mesh(latheX([[0.04, -0.68], [0.1, -0.68], [0.11, -0.67], [0.11, -0.64], [0.04, -0.64]], 48), chuckMat, sp);
    mesh(latheX([[0.05, -0.64], [0.19, -0.64], [0.2, -0.63], [0.2, -0.515], [0.185, CHUCK_FACE], [0.06, CHUCK_FACE]], 64), chuckMat, sp);
    const jaws: THREE.BufferGeometry[] = [];
    const slots: THREE.BufferGeometry[] = [];
    const holes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const r0 = R_LEVELS[0];
      const j1 = box(0.1, 0.06, 0.05, CHUCK_FACE + 0.045, r0 + 0.03, 0, 0.006);
      const j2 = box(0.06, 0.06, 0.05, CHUCK_FACE + 0.025, r0 + 0.088, 0, 0.006);
      const s1 = new THREE.BoxGeometry(0.004, 0.11, 0.03).translate(CHUCK_FACE + 0.001, 0.13, 0);
      const h1 = new THREE.CylinderGeometry(0.018, 0.018, 0.01, 6).translate(-0.57, 0.199, 0);
      for (const gg of [j1, j2, s1, h1]) gg.rotateX(a);
      const hRot = h1;
      hRot.rotateX(Math.PI / 3);
      jaws.push(j1, j2);
      slots.push(s1);
      holes.push(hRot);
    }
    mesh(mergeAll(jaws), steel({ roughness: 0.4 }), sp);
    mesh(mergeAll(slots), darkSteel({ roughness: 0.6 }), sp);
    mesh(mergeAll(holes), darkSteel({ roughness: 0.6 }), sp);

    // 공작물: 단위 원기둥(x 0→1, 반지름 1)을 구간마다 늘려 쓴다
    const unit = new THREE.CylinderGeometry(1, 1, 1, 48, 1);
    unit.rotateZ(-Math.PI / 2);
    unit.translate(0.5, 0, 0);
    const stockTex = canvasTex(128, 16, (ctx) => {
      ctx.fillStyle = '#7d858d';
      ctx.fillRect(0, 0, 128, 16);
      ctx.fillStyle = '#5e656c';
      ctx.fillRect(10, 0, 9, 16);
      ctx.fillRect(70, 0, 4, 16);
      ctx.fillStyle = '#9aa2aa';
      ctx.fillRect(40, 0, 6, 16);
    });
    const stockMat = darkSteel({ roughness: 0.6 });
    stockMat.color.set(0xffffff);
    stockMat.map = stockTex;
    const cutMat = steel({ roughness: 0.14 });
    this.segA = mesh(unit, stockMat, sp);
    this.segB = mesh(unit, stockMat, sp);
    this.segC = mesh(unit, cutMat, sp);
  }

  private buildTailstock(): void {
    const tsMat = paint(0x56717f, { roughness: 0.4 });
    const x0 = TAIL_X0;
    const x1 = 1.46;
    mesh(box(x1 - x0, 0.08, 0.5, (x0 + x1) / 2, WAY_TOP + 0.04, 0, 0.015), tsMat, this.group);
    mesh(box(0.28, SPINDLE_Y - WAY_TOP - 0.08, 0.24, 1.29, (WAY_TOP + 0.08 + SPINDLE_Y) / 2, 0, 0.02), tsMat, this.group);
    const barrel = mesh(latheX([[0, 1.15], [0.1, 1.15], [0.11, 1.16], [0.11, 1.42], [0.1, 1.43], [0, 1.43]], 48), tsMat, this.group);
    barrel.position.y = SPINDLE_Y;
    // 심압축(퀼) + 회전 센터
    const quill = new THREE.Group();
    quill.position.y = SPINDLE_Y;
    mesh(cylX(0.042, 0.9, 1.16, 32), steel({ roughness: 0.25 }), quill);
    mesh(latheX([[0, 0.86], [0.036, 0.86], [0.04, 0.865], [0.04, 0.9], [0, 0.9]], 32), darkSteel(), quill);
    mesh(latheX([[0, 0.78], [0.032, 0.86], [0, 0.86]], 32), steel({ roughness: 0.2 }), quill);
    // 퀼 고정 레버
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 12).rotateZ(0.5).translate(1.2, 0.14, 0.04), steel(), quill);
    mesh(new THREE.SphereGeometry(0.022, 16, 10).translate(1.16, 0.21, 0.04), plastic(0x1f2226), quill);
    this.group.add(quill);
    // 핸들 휠
    const hw = new THREE.Group();
    hw.position.set(1.49, SPINDLE_Y, 0);
    mesh(cylX(0.02, -0.06, 0.0, 16), steel(), hw);
    const rimGeo = new THREE.TorusGeometry(0.11, 0.012, 10, 48).rotateY(Math.PI / 2);
    mesh(rimGeo, steel({ roughness: 0.3 }), hw);
    const spokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.CylinderGeometry(0.008, 0.008, 0.11, 10).translate(0, 0.055, 0).rotateX((i / 3) * TAU);
      spokes.push(s);
    }
    mesh(mergeAll(spokes), steel(), hw);
    mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 14).rotateZ(Math.PI / 2).translate(0.035, 0.11, 0), plastic(0x1f2226), hw);
    this.group.add(hw);
    // 클램프 레버(베이스)
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12).rotateX(Math.PI / 2).translate(1.4, WAY_TOP + 0.05, 0.3), steel(), this.group);
  }

  private buildCarriage(): void {
    const c = this.carriage;
    const mat = paint(0x56717f, { roughness: 0.4 });
    // 새들(안내면 위) + 에이프런(앞으로 늘어진 판, 리드 스크루가 관통)
    mesh(box(0.36, 0.08, 0.68, 0, WAY_TOP + 0.04, 0, 0.015), mat, c);
    mesh(box(0.34, 0.3, 0.08, 0, 1.19, 0.34, 0.02), mat, c);
    // 에이프런 핸들 휠(랙과 맞물려 왕복대를 움직임)
    this.apronWheel.position.set(0.06, 1.2, 0.38);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 14).rotateX(Math.PI / 2).translate(0, 0, 0.02), steel(), this.apronWheel);
    mesh(new THREE.TorusGeometry(0.075, 0.01, 10, 40).translate(0, 0, 0.04), steel({ roughness: 0.3 }), this.apronWheel);
    const sp: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) sp.push(new THREE.CylinderGeometry(0.007, 0.007, 0.075, 10).translate(0, 0.0375, 0.04).rotateZ((i / 3) * TAU));
    mesh(mergeAll(sp), steel(), this.apronWheel);
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12).rotateX(Math.PI / 2).translate(0, 0.075, 0.07), plastic(0x1f2226), this.apronWheel);
    c.add(this.apronWheel);
    // 하프 너트 레버
    mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 10).rotateZ(0.6).translate(-0.12, 1.1, 0.39), steel(), c);

    // 가로 이송대(크로스 슬라이드) + 복식 공구대 + 공구대 + 바이트 — z로 움직이는 묶음
    const x = this.cross;
    mesh(box(0.2, 0.05, 0.46, 0, WAY_TOP + 0.105, 0.08, 0.01), mat, x);
    mesh(box(0.16, 0.05, 0.16, 0, WAY_TOP + 0.155, 0.22, 0.01), mat, x);
    const postMat = darkSteel({ roughness: 0.45 });
    const postY0 = WAY_TOP + 0.18;
    const postY1 = SPINDLE_Y + 0.06;
    mesh(box(0.11, postY1 - postY0, 0.11, 0, (postY0 + postY1) / 2, 0.22, 0.01), postMat, x);
    // 바이트: 날끝이 (TOOL_DX, SPINDLE_Y, R1)
    const tipZ = R_LEVELS[1];
    const s = new THREE.Shape();
    const w = 0.03;
    s.moveTo(0, 0);
    s.lineTo(w, 0.02);
    s.lineTo(w, 0.3);
    s.lineTo(0, 0.3);
    s.lineTo(0, 0);
    const toolGeo = new THREE.ExtrudeGeometry(s, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    toolGeo.translate(0, 0, -0.013);
    toolGeo.rotateX(Math.PI / 2); // shape y → 세계 z, 두께 → y
    toolGeo.translate(TOOL_DX, SPINDLE_Y, tipZ);
    mesh(toolGeo, steel({ roughness: 0.2 }), x);
    // 날끝 초경 팁(색으로 구분)
    const tip = new THREE.BoxGeometry(0.02, 0.028, 0.02);
    tip.translate(TOOL_DX + 0.01, SPINDLE_Y + 0.001, tipZ + 0.014);
    mesh(tip, paint(0xf2b619, { roughness: 0.4, metalness: 0.5 }), x);
    // 공구 고정 볼트
    const bolts: THREE.BufferGeometry[] = [];
    for (const dz of [0.19, 0.25]) bolts.push(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 6).translate(TOOL_DX + 0.015, postY1 + 0.02, dz));
    mesh(mergeAll(bolts), steel(), x);
    // 크로스 핸들
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 12).rotateX(Math.PI / 2).translate(0, WAY_TOP + 0.105, 0.36), steel(), x);
    mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 32).translate(0, WAY_TOP + 0.105, 0.41), steel({ roughness: 0.3 }), x);
    c.add(x);
  }

  private buildMotor(): void {
    const bodyMat = paint(0x2e5f8f, { roughness: 0.45 });
    const g = new THREE.Group();
    g.position.set(0, MOTOR_Y, MOTOR_Z);
    const x0 = -1.58;
    const x1 = -1.06;
    // 몸체 + 냉각핀
    mesh(cylX(0.145, x0 + 0.03, x1 - 0.02, 48), bodyMat, g);
    const fins: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 16; i++) {
      const f = new THREE.BoxGeometry(x1 - x0 - 0.12, 0.024, 0.008);
      f.translate((x0 + x1) / 2, 0.15, 0);
      f.rotateX((i / 16) * TAU + 0.1);
      fins.push(f);
    }
    mesh(mergeAll(fins), bodyMat, g);
    const alu = aluminum({ roughness: 0.4 });
    mesh(latheX([[0.03, x0 - 0.01], [0.09, x0 - 0.01], [0.13, x0 + 0.01], [0.15, x0 + 0.04], [0.03, x0 + 0.04]], 48), alu, g);
    // 팬 커버(뒤)
    mesh(latheX([[0, x1 + 0.07], [0.1, x1 + 0.07], [0.145, x1 + 0.03], [0.15, x1 - 0.03], [0, x1 - 0.03]], 48), darkSteel({ roughness: 0.5 }), g);
    // 단자함
    mesh(box(0.14, 0.07, 0.12, (x0 + x1) / 2 + 0.05, 0.17, 0, 0.015), bodyMat, g);
    // 발 + 받침 선반(왼쪽 받침대 뒷면에 고정)
    const bracket = darkSteel({ roughness: 0.55 });
    mesh(box(0.06, 0.06, 0.26, x0 + 0.1, -0.135, 0, 0.01), bodyMat, g);
    mesh(box(0.06, 0.06, 0.26, x1 - 0.08, -0.135, 0, 0.01), bodyMat, g);
    this.group.add(g);
    mesh(box(0.5, 0.03, 0.46, (x0 + x1) / 2 + 0.01, MOTOR_Y - 0.18, -0.59, 0.01), bracket, this.group);
    for (const x of [x0 + 0.08, x1 - 0.06]) {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(0.22, 0);
      s.lineTo(0, -0.3);
      s.closePath();
      const gg = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
      gg.rotateY(Math.PI / 2);
      gg.translate(x, MOTOR_Y - 0.195, -0.36);
      // 삼각 보강판: 받침대 뒷면(z=-0.36)에서 선반 끝으로
      gg.scale(1, 1, 1);
      mesh(gg, bracket, this.group);
    }
    // 회전부: 모터 축(풀리 자리) + 키
    this.motorRotor.position.set(0, MOTOR_Y, MOTOR_Z);
    mesh(cylX(0.022, -1.8, x0, 20), steel(), this.motorRotor);
    const key = new THREE.BoxGeometry(0.1, 0.01, 0.01).translate(BELT_X, 0.022, 0);
    mesh(key, paint(0xf2b619), this.motorRotor);
  }
}
