// 드럼 세탁기: 벨트와 풀리(모터 → 드럼, 풀리 지름비 10:1) + 스프링(터브 현가) 미션
// 좌표: X = 폭, Y = 위, Z = 앞(+Z가 유리문 쪽). 드럼 축은 Z. 터브(바깥 통)는 스프링·댐퍼에 매달려 탈수 때 흔들린다.
// 모터는 실제처럼 터브 아래에 붙어 함께 움직이므로 벨트 길이는 일정하다(터브 좌표계에 벨트를 둔다).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { extrude, roundedRect, annularSector } from '../models/parts/geom';
import { CATEGORY_COLORS, aluminum, castIron, chrome, darkSteel, ghost, glass, glow, paint, plastic, rubber, steel, wood } from '../models/materials';
import { BaseMachine, type MachineDisplayItem, type MachineSim } from './types';

// ── 외함 ──
const CAB_X = 0.95;
const CAB_Y0 = 0.08;
const CAB_Y1 = 2.5;
const CAB_Z = 0.88;
const BASE_TOP = 0.14;
const PANEL_TOP = 2.2;

// ── 터브·드럼 (터브 로컬 좌표, 원점 = 드럼 축 중심) ──
const TC = new THREE.Vector3(0, 1.18, 0);
const TUB_R = 0.73;
const TUB_ZF = 0.46;
const TUB_ZB = -0.64;
const DRUM_R = 0.64;
/** 벨트 평면 */
const PZ = -0.78;
const R_DP = 0.55;
const R_MP = 0.055;
const PULLEY_RATIO = R_DP / R_MP;
const MOTOR = new THREE.Vector2(0.25, -0.88);
const BELT_T = 0.02;
const BELT_W = 0.05;

// ── 현가 스프링·댐퍼 ──
const HOOK_L = [new THREE.Vector3(-0.4, 0.66, -0.12), new THREE.Vector3(0.4, 0.66, -0.12)];
const ANCHOR = [new THREE.Vector3(-0.56, 2.4, -0.12), new THREE.Vector3(0.56, 2.4, -0.12)];
const DAMP_BASE = [new THREE.Vector3(-0.62, 0.21, 0.15), new THREE.Vector3(0.62, 0.21, 0.15)];
const DAMP_LUG = [new THREE.Vector3(-0.33, -0.72, 0.15), new THREE.Vector3(0.33, -0.72, 0.15)];
const COIL_R = 0.05;
const COIL_WIRE = 0.011;
const COIL_TURNS = 12;
const HOOK_LEN = 0.075;

// ── 운전 ──
const WASH_RPM = 45;
const SPIN_RPM_SHOWN = 1000;
/** 화면에서 보이는 탈수 회전수(실제 1000rpm은 프레임보다 빨라 그대로 그리면 멈춰 보인다) */
const SPIN_RPM_VISUAL = 240;
const W_WASH = (WASH_RPM / 60) * Math.PI * 2;
const W_SPIN = (SPIN_RPM_VISUAL / 60) * Math.PI * 2;
/** 중력 가속도(1 단위 ≈ 0.35m → 9.8 / 0.35) */
const G = 28;
const CYCLE = 22;

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

function rbox(w: number, h: number, d: number, r: number, segs = 2): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, segs, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
}

/** (반지름, z) 프로파일을 Z축 회전체로 */
function latheZ(profile: [number, number][], segs = 48): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

function cylZ(r: number, len: number, segs = 32): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, segs);
  g.rotateX(Math.PI / 2);
  return g;
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
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * 반지름이 다른 두 풀리를 감는 오픈 벨트 경로(바깥 공통 접선 + 두 호). s는 피치선 기준 호장,
 * s가 증가하는 방향 = 반시계(+Z 회전) — 두 풀리 모두 같은 방향으로 돈다.
 */
class OpenBelt {
  readonly length: number;
  private readonly phiP: number;
  private readonly phiM: number;
  private readonly arc1: number;
  private readonly arc2: number;
  private readonly L: number;

  constructor(
    private readonly c1: THREE.Vector2,
    private readonly r1: number,
    private readonly c2: THREE.Vector2,
    private readonly r2: number
  ) {
    const d = c2.clone().sub(c1);
    const D = d.length();
    const alpha = Math.atan2(d.y, d.x);
    const A = Math.acos((r1 - r2) / D);
    this.phiP = alpha + A;
    this.phiM = alpha - A;
    this.arc1 = Math.PI * 2 - 2 * A;
    this.arc2 = 2 * A;
    this.L = Math.sqrt(D * D - (r1 - r2) * (r1 - r2));
    this.length = r1 * this.arc1 + r2 * this.arc2 + 2 * this.L;
  }

  private pt(c: THREE.Vector2, r: number, phi: number): THREE.Vector2 {
    return new THREE.Vector2(c.x + Math.cos(phi) * r, c.y + Math.sin(phi) * r);
  }

  /** 피치선 위 점과 바깥 법선 */
  frame(s: number): { x: number; y: number; nx: number; ny: number } {
    let u = s % this.length;
    if (u < 0) u += this.length;
    const s1 = this.r1 * this.arc1;
    if (u < s1) {
      const p = this.phiP + u / this.r1;
      return { x: this.c1.x + Math.cos(p) * this.r1, y: this.c1.y + Math.sin(p) * this.r1, nx: Math.cos(p), ny: Math.sin(p) };
    }
    u -= s1;
    if (u < this.L) {
      const a = this.pt(this.c1, this.r1, this.phiM);
      const b = this.pt(this.c2, this.r2, this.phiM);
      const t = u / this.L;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx: Math.cos(this.phiM), ny: Math.sin(this.phiM) };
    }
    u -= this.L;
    const s3 = this.r2 * this.arc2;
    if (u < s3) {
      const p = this.phiM + u / this.r2;
      return { x: this.c2.x + Math.cos(p) * this.r2, y: this.c2.y + Math.sin(p) * this.r2, nx: Math.cos(p), ny: Math.sin(p) };
    }
    u -= s3;
    const a = this.pt(this.c2, this.r2, this.phiP);
    const b = this.pt(this.c1, this.r1, this.phiP);
    const t = u / this.L;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx: Math.cos(this.phiP), ny: Math.sin(this.phiP) };
  }

  samples(arcSegs1: number, arcSegs2: number, straightSegs = 4): number[] {
    const out: number[] = [];
    const push = (start: number, len: number, n: number) => {
      for (let i = 0; i < n; i++) out.push(start + (len * i) / n);
    };
    const s1 = this.r1 * this.arc1;
    const s3 = this.r2 * this.arc2;
    push(0, s1, arcSegs1);
    push(s1, this.L, straightSegs);
    push(s1 + this.L, s3, arcSegs2);
    push(s1 + this.L + s3, this.L, straightSegs);
    out.push(this.length);
    return out;
  }
}

/** 두께 있는 띠(벨트). u = s / 둘레 */
function bandGeometry(path: OpenBelt, t: number, width: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ss = path.samples(72, 20);
  const hw = width / 2;
  for (let face = 0; face < 4; face++) {
    const base = pos.length / 3;
    for (const s of ss) {
      const f = path.frame(s);
      const u = s / path.length;
      const pIn = [f.x - (f.nx * t) / 2, f.y - (f.ny * t) / 2];
      const pOut = [f.x + (f.nx * t) / 2, f.y + (f.ny * t) / 2];
      if (face < 2) {
        const p = face === 0 ? pOut : pIn;
        const sg = face === 0 ? 1 : -1;
        pos.push(p[0]!, p[1]!, -hw, p[0]!, p[1]!, hw);
        nor.push(f.nx * sg, f.ny * sg, 0, f.nx * sg, f.ny * sg, 0);
        uv.push(u, 0, u, 1);
      } else {
        const z = face === 2 ? hw : -hw;
        pos.push(pIn[0]!, pIn[1]!, z, pOut[0]!, pOut[1]!, z);
        nor.push(0, 0, face === 2 ? 1 : -1, 0, 0, face === 2 ? 1 : -1);
        uv.push(u, 0, u, 0.05);
      }
    }
    for (let i = 0; i < ss.length - 1; i++) {
      const a = base + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // s 증가 = 반시계 → 바깥면은 (a,c,b), 안쪽면은 (a,b,c), +Z 옆면은 (a,b,c), -Z 옆면은 (a,c,b)
      if (face === 0 || face === 3) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** 폴리 V 풀리 테(Z축): 피치 반지름 rp, 폭 w, 홈 수 ribs */
function polyVRim(rp: number, w: number, rInner: number, ribs: number): THREE.BufferGeometry {
  const h = w / 2;
  const rRoot = rp - BELT_T / 2 - 0.004;
  const rFl = rp + BELT_T / 2 + 0.012;
  const prof: [number, number][] = [
    [rInner, -h],
    [rFl - 0.004, -h],
    [rFl, -h + 0.004],
    [rFl, -h + 0.009],
    [rRoot + 0.008, -h + 0.012]
  ];
  const span = (w - 0.024) / ribs;
  for (let i = 0; i < ribs; i++) {
    const z0 = -h + 0.012 + i * span;
    prof.push([rRoot, z0 + span * 0.5], [rRoot + 0.008, z0 + span]);
  }
  prof.push([rFl, h - 0.009], [rFl, h - 0.004], [rFl - 0.004, h], [rInner, h], [rInner, -h]);
  return latheZ(prof, rp > 0.2 ? 96 : 40);
}

interface Cloth {
  mesh: THREE.Mesh;
  r: number;
  z: number;
  riding: boolean;
  rel: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  fallT: number;
  tumble: number;
  rest: number;
}

export class DrumWasher extends BaseMachine {
  readonly id = 'washer';
  private beltSet: THREE.Group | null = null;
  private springSet: THREE.Group | null = null;
  private springs: THREE.Object3D[] = [];
  private drumPulley: THREE.Object3D | null = null;
  private motorPulley: THREE.Object3D | null = null;
  private tub = new THREE.Group();
  private drum = new THREE.Group();
  private motorRotor = new THREE.Group();
  private dampers: { body: THREE.Object3D; rod: THREE.Object3D }[] = [];
  private blocks = new THREE.Group();
  private gasketGeo: THREE.BufferGeometry | null = null;
  private gasketBase: Float32Array | null = null;
  private gasketW: Float32Array | null = null;
  private cloths: Cloth[] = [];
  private beltPath = new OpenBelt(new THREE.Vector2(0, 0), R_DP, MOTOR.clone(), R_MP);
  private beltTex: { tex: THREE.Texture; repeats: number } | null = null;
  private lcdMat = glow(0xffffff, 0.9);
  private lcdTex: THREE.CanvasTexture | null = null;
  private lcdText = '';

  constructor() {
    super();
    this.tub.position.copy(TC);
    this.motorRotor.position.set(MOTOR.x, MOTOR.y, 0);
    this.tub.add(this.drum, this.motorRotor);
    this.group.add(this.tub, this.blocks);
    this.buildCabinet();
    this.buildFrontPanel();
    this.buildTub();
    this.buildDrum();
    this.buildMotor();
    this.buildGasket();
    this.buildDampers();
    this.buildBlocks();
    this.buildLaundry();
    this.addBeltSlot();
    this.addSpringSlot();
    this.hideSlot(1);
    this.setLcd('0:45');
    this.layoutSuspension();
    this.applyShadows();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.beltSet !== null : this.springSet !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? TC.clone() : new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(TC.x, TC.y, PZ) : new THREE.Vector3(0, (ANCHOR[0]!.y + TC.y + HOOK_L[0]!.y) / 2, -0.12);
  }

  buildStepModel(step: number): THREE.Group {
    return step === 0 ? this.buildBeltSet() : this.buildSpringSet();
  }

  installStep(step: number, model: THREE.Group): void {
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      model.position.set(0, 0, 0);
      this.tub.add(model);
      this.beltSet = model;
      const dp = model.getObjectByName('drumPulley');
      const mp = model.getObjectByName('motorPulley');
      if (dp) {
        this.drum.add(dp);
        dp.position.set(0, 0, PZ);
        this.drumPulley = dp;
      }
      if (mp) {
        this.motorRotor.add(mp);
        mp.position.set(0, 0, PZ);
        this.motorPulley = mp;
      }
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(0, 0, 0);
      this.group.add(model);
      this.springSet = model;
      this.springs = model.children.filter((c) => c.name === 'spring');
      // 스프링이 터브를 받으므로 운송용 받침목을 뺀다
      this.blocks.visible = false;
      this.layoutSuspension();
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.drumPulley) this.drum.remove(this.drumPulley);
    if (this.motorPulley) this.motorRotor.remove(this.motorPulley);
    this.drumPulley = null;
    this.motorPulley = null;
    if (this.beltSet) this.tub.remove(this.beltSet);
    this.beltSet = null;
    this.beltTex = null;
    if (this.springSet) this.group.remove(this.springSet);
    this.springSet = null;
    this.springs = [];
    this.blocks.visible = true;
    this.drum.rotation.z = 0;
    this.motorRotor.rotation.z = 0;
    this.tub.position.copy(TC);
    this.cloths.forEach((c) => this.restCloth(c));
    this.layoutSuspension();
    this.setLcd('0:45');
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.beltSet || !this.springSet) throw new Error('washer mission incomplete');
    let time = 0;
    let drumAngle = 0;
    let w = 0;
    let shownDrum = 0;
    let spinning = false;
    const self = this;
    /** 운전 프로그램: 세탁(좌우 번갈아 45rpm) → 탈수(가속·유지·감속) */
    const program = (t: number): { w: number; spin: boolean } => {
      const c = t % CYCLE;
      if (c < 12) {
        const seg = Math.floor(c / 4);
        const u = c - seg * 4;
        const dir = seg % 2 === 0 ? 1 : -1;
        const env = u < 0.5 ? u / 0.5 : u < 3.2 ? 1 : u < 3.7 ? 1 - (u - 3.2) / 0.5 : 0;
        return { w: dir * W_WASH * env, spin: false };
      }
      const smooth = (x: number) => x * x * (3 - 2 * x);
      if (c < 14) return { w: W_WASH * 0.6 + (W_SPIN - W_WASH * 0.6) * smooth((c - 12) / 2), spin: true };
      if (c < 19) return { w: W_SPIN, spin: true };
      if (c < 21.5) return { w: W_SPIN * (1 - smooth((c - 19) / 2.5)), spin: true };
      return { w: 0, spin: true };
    };
    return {
      update(dt: number) {
        time += dt;
        const p = program(time);
        w = p.w;
        spinning = p.spin;
        drumAngle += w * dt;
        self.drum.rotation.z = drumAngle;
        self.motorRotor.rotation.z = drumAngle * PULLEY_RATIO;
        if (self.beltTex) {
          const { tex, repeats } = self.beltTex;
          tex.offset.x = -(((repeats * drumAngle * R_DP) / self.beltPath.length) % 1);
        }
        // 화면 회전수(세탁 45rpm 그대로, 탈수는 표시 1000rpm으로 환산)
        const aw = Math.abs(w);
        const sf = Math.max(0, Math.min(1, (aw - W_WASH) / (W_SPIN - W_WASH)));
        shownDrum = aw <= W_WASH ? (aw / (Math.PI * 2)) * 60 : WASH_RPM + (SPIN_RPM_SHOWN - WASH_RPM) * sf;
        // 탈수 흔들림: 빨래 쏠림(불평형)이 드럼과 함께 돌며 터브를 흔든다 — 저속 공진 구간에서 가장 크다
        const amp = spinning ? 0.014 * sf + 0.045 * Math.exp(-(((sf - 0.18) / 0.12) ** 2)) * (aw > W_WASH * 0.8 ? 1 : 0) : 0;
        self.tub.position.set(TC.x + Math.cos(drumAngle) * amp, TC.y + Math.sin(drumAngle) * amp * 0.8, TC.z);
        self.layoutSuspension();
        self.stepLaundry(dt, drumAngle, w);
        self.setLcd(spinning ? `${Math.round(shownDrum)}` : '0:45');
      },
      getDisplay: (): MachineDisplayItem[] => [
        { label: '모터', value: String(Math.round(shownDrum * PULLEY_RATIO)), unit: 'rpm' },
        { label: `드럼 (풀리 ${PULLEY_RATIO.toFixed(0)}:1)`, value: String(Math.round(shownDrum)), unit: 'rpm' },
        spinning
          ? { label: '현재 과정', value: '탈수', tone: 'red' }
          : { label: '현재 과정', value: w >= 0 ? '세탁 ↺' : '세탁 ↻', tone: 'blue' }
      ]
    };
  }

  // ───────────────────────── 현가 배치 ─────────────────────────

  /** 터브 위치에 맞춰 스프링(늘었다 줄었다)·댐퍼(실린더-로드 미끄럼)·가스켓(주름 변형)을 다시 배치 */
  private layoutSuspension(): void {
    const off = this.tub.position.clone().sub(TC);
    this.springs.forEach((s, i) => {
      const a = ANCHOR[i]!;
      const b = HOOK_L[i]!.clone().add(this.tub.position);
      this.layoutSpring(s, a, b);
    });
    this.dampers.forEach((d, i) => {
      const a = DAMP_BASE[i]!;
      const b = DAMP_LUG[i]!.clone().add(this.tub.position);
      const dir = b.clone().sub(a);
      const len = dir.length();
      dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      d.body.position.copy(a);
      d.body.quaternion.copy(q);
      d.rod.position.copy(b);
      d.rod.quaternion.copy(q);
      d.rod.userData.len = len;
    });
    if (this.gasketGeo && this.gasketBase && this.gasketW) {
      const pos = this.gasketGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const wgt = this.gasketW[i]!;
        arr[i * 3] = this.gasketBase[i * 3]! + off.x * wgt;
        arr[i * 3 + 1] = this.gasketBase[i * 3 + 1]! + off.y * wgt;
      }
      pos.needsUpdate = true;
    }
  }

  private layoutSpring(s: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
    const dir = b.clone().sub(a);
    const len = dir.length();
    s.position.copy(a);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const coil = s.getObjectByName('coil');
    const lower = s.getObjectByName('lowerHook');
    const l0 = (s.userData.l0 as number | undefined) ?? 1;
    if (coil) coil.scale.y = (len - 2 * HOOK_LEN) / l0;
    if (lower) lower.position.y = len;
  }

  // ───────────────────────── 장착 부품 ─────────────────────────

  /** 1단계: 드럼 풀리(큰) + 모터 풀리(작은) + 폴리 V 벨트 — 터브 로컬 좌표 */
  private buildBeltSet(): THREE.Group {
    const g = new THREE.Group();
    const tex = canvasTex(256, 32, (ctx) => {
      ctx.fillStyle = '#1d2025';
      ctx.fillRect(0, 0, 256, 32);
      ctx.fillStyle = '#2d3138';
      for (let y = 3; y < 32; y += 7) ctx.fillRect(0, y, 256, 3);
      ctx.fillStyle = '#eef1f4';
      ctx.fillRect(10, 8, 44, 16);
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(60, 8, 10, 16);
    });
    const repeats = Math.round(this.beltPath.length / 0.4);
    tex.repeat.set(repeats, 1);
    const mat = rubber({ roughness: 0.7 });
    mat.color.set(0xffffff);
    mat.map = tex;
    const belt = mesh(bandGeometry(this.beltPath, BELT_T, BELT_W), mat, 0, 0, PZ);
    belt.name = 'belt';
    g.add(belt);
    this.beltTex = { tex, repeats };

    // 드럼 풀리: 알루미늄 테 + 휜 스포크 5개 + 허브
    const dp = new THREE.Group();
    dp.name = 'drumPulley';
    const alu = aluminum();
    dp.add(mesh(polyVRim(R_DP, 0.07, R_DP - 0.05, 4), alu));
    const spokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const sh = new THREE.Shape();
      const a = (i / 5) * Math.PI * 2;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 8; k++) {
        const r = 0.07 + ((R_DP - 0.06) * k) / 8;
        const ang = a + 0.35 * Math.sin((k / 8) * Math.PI * 0.5);
        pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
      }
      const wid = (k: number) => 0.04 - 0.012 * (k / 8);
      pts.forEach(([x, y], k) => {
        const n = Math.atan2(y, x) + Math.PI / 2;
        const px = x + Math.cos(n) * wid(k);
        const py = y + Math.sin(n) * wid(k);
        if (k === 0) sh.moveTo(px, py);
        else sh.lineTo(px, py);
      });
      for (let k = 8; k >= 0; k--) {
        const [x, y] = pts[k]!;
        const n = Math.atan2(y, x) - Math.PI / 2;
        sh.lineTo(x + Math.cos(n) * wid(k), y + Math.sin(n) * wid(k));
      }
      sh.closePath();
      spokes.push(extrude(sh, 0.03, 0.006, 12));
    }
    const spokeGeo = mergeGeometries(spokes);
    spokes.forEach((s) => s.dispose());
    dp.add(mesh(spokeGeo, alu));
    dp.add(mesh(latheZ([[0.036, -0.045], [0.085, -0.045], [0.095, -0.03], [0.095, 0.03], [0.085, 0.045], [0.036, 0.045], [0.036, -0.045]], 40), paint(CATEGORY_COLORS.power, { roughness: 0.35 })));
    dp.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6).rotateX(Math.PI / 2), steel(), 0, 0, -0.052));
    dp.position.set(0, 0, PZ);
    g.add(dp);

    // 모터 풀리: 작은 강철 폴리 V
    const mp = new THREE.Group();
    mp.name = 'motorPulley';
    const st = steel();
    mp.add(mesh(polyVRim(R_MP, 0.07, 0.016, 4), st));
    mp.add(mesh(rbox(0.012, 0.03, 0.074, 0.003), paint(CATEGORY_COLORS.power), 0, R_MP + BELT_T / 2 + 0.006, 0));
    mp.position.set(MOTOR.x, MOTOR.y, PZ);
    g.add(mp);
    return g;
  }

  /** 2단계: 현가 스프링 2개(위: 외함 위 프레임, 아래: 터브 고리) — 외함 좌표 */
  private buildSpringSet(): THREE.Group {
    const g = new THREE.Group();
    const coilMat = paint(0x8a5cd6, { roughness: 0.32, metalness: 0.4 });
    const hookMat = steel();
    for (let i = 0; i < 2; i++) {
      const a = ANCHOR[i]!;
      const b = HOOK_L[i]!.clone().add(TC);
      const len = a.distanceTo(b);
      const l0 = len - 2 * HOOK_LEN;
      const s = new THREE.Group();
      s.name = 'spring';
      s.userData.l0 = l0;
      // 양끝 1바퀴는 밀착 감김, 가운데는 균일 피치
      const pts: THREE.Vector3[] = [];
      const pd = COIL_WIRE * 2.1;
      const N = COIL_TURNS;
      const steps = N * 28;
      for (let k = 0; k <= steps; k++) {
        const u = (k / steps) * N;
        const y = u < 1 ? u * pd : u > N - 1 ? l0 - (N - u) * pd : pd + ((u - 1) * (l0 - 2 * pd)) / (N - 2);
        const ang = u * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(ang) * COIL_R, y, Math.sin(ang) * COIL_R));
      }
      const coil = new THREE.Group();
      coil.name = 'coil';
      coil.position.y = HOOK_LEN;
      coil.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, COIL_WIRE, 10, false), coilMat));
      s.add(coil);
      // 고리: 핀을 감싸는 고리 + 고리에서 코일 끝까지 곧은 선
      const loopGeo = new THREE.TorusGeometry(0.03, COIL_WIRE, 10, 28);
      const legGeo = (() => {
        const from = new THREE.Vector3(0, 0.03, 0);
        const to = new THREE.Vector3(COIL_R, HOOK_LEN, 0);
        const c = new THREE.CylinderGeometry(COIL_WIRE, COIL_WIRE, from.distanceTo(to), 10);
        c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
        c.translate((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
        return c;
      })();
      const upper = new THREE.Group();
      upper.add(mesh(loopGeo, hookMat), mesh(legGeo, hookMat));
      s.add(upper);
      const lower = new THREE.Group();
      lower.name = 'lowerHook';
      // 아래 고리: 위 고리를 뒤집은 모양(코일 끝 각도가 0으로 끝나도록 감은 수가 정수)
      const lowerInner = new THREE.Group();
      lowerInner.rotation.z = Math.PI;
      lowerInner.scale.x = -1;
      lowerInner.add(mesh(loopGeo, hookMat), mesh(legGeo, hookMat));
      lower.add(lowerInner);
      s.add(lower);
      this.layoutSpring(s, a, b);
      g.add(s);
    }
    return g;
  }

  private addBeltSlot(): void {
    const pts = this.beltPath
      .samples(40, 12, 8)
      .slice(0, -1)
      .map((s) => {
        const f = this.beltPath.frame(s);
        return new THREE.Vector3(TC.x + f.x + f.nx * 0.03, TC.y + f.y + f.ny * 0.03, PZ);
      });
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 220, 0.02, 8, true);
    const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 }));
    ring.userData.slot = true;
    this.slots[0] = ring;
    this.group.add(ring);
  }

  private addSpringSlot(): void {
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 2; i++) {
      const a = ANCHOR[i]!;
      const b = HOOK_L[i]!.clone().add(TC);
      for (const k of [0.3, 0.7]) {
        const t = new THREE.TorusGeometry(0.085, 0.016, 10, 32);
        t.rotateX(Math.PI / 2);
        const p = a.clone().lerp(b, k);
        t.translate(p.x, p.y, p.z);
        geos.push(t);
      }
    }
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const ring = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 }));
    ring.userData.slot = true;
    this.slots[1] = ring;
    this.group.add(ring);
  }

  // ───────────────────────── 고정 구조물 ─────────────────────────

  private buildCabinet(): void {
    // 받침 프레임 + 발
    const frameMat = darkSteel();
    this.group.add(mesh(rbox(CAB_X * 2 - 0.02, BASE_TOP - CAB_Y0, CAB_Z * 2 - 0.02, 0.01), frameMat, 0, (CAB_Y0 + BASE_TOP) / 2, 0));
    const footGeo = new THREE.CylinderGeometry(0.06, 0.07, CAB_Y0, 24);
    const foot = rubber();
    for (const x of [-CAB_X + 0.12, CAB_X - 0.12]) for (const z of [-CAB_Z + 0.12, CAB_Z - 0.12]) this.group.add(mesh(footGeo, foot, x, CAB_Y0 / 2, z));

    // 모서리 기둥·위 레일(불투명 골조) — 반투명 외판 안에서 형태를 잡아 준다
    const postGeo = rbox(0.04, CAB_Y1 - BASE_TOP, 0.04, 0.008);
    for (const x of [-CAB_X + 0.02, CAB_X - 0.02]) for (const z of [-CAB_Z + 0.02, CAB_Z - 0.04]) this.group.add(mesh(postGeo, frameMat, x, (BASE_TOP + CAB_Y1) / 2, z));
    const railGeo = rbox(0.04, 0.05, CAB_Z * 2 - 0.06, 0.008);
    for (const x of [-CAB_X + 0.02, CAB_X - 0.02]) this.group.add(mesh(railGeo, frameMat, x, CAB_Y1 - 0.045, -0.01));
    // 스프링을 거는 위 가로 채널 + 고리 핀
    this.group.add(mesh(rbox(CAB_X * 2 - 0.08, 0.05, 0.08, 0.01), steel(), 0, 2.455, -0.12));
    for (const a of ANCHOR) {
      this.group.add(mesh(rbox(0.035, 0.07, 0.07, 0.006), steel(), a.x, a.y + 0.03, a.z - 0.0));
      this.group.add(mesh(cylZ(0.012, 0.1, 16), chrome(), a.x, a.y, a.z));
    }

    // 반투명 외판: 좌·우·뒤·위
    const skin = ghost(0xb7c6d4, 0.16);
    skin.side = THREE.DoubleSide;
    const panels: THREE.Mesh[] = [
      mesh(new THREE.BoxGeometry(0.015, CAB_Y1 - BASE_TOP, CAB_Z * 2), skin, -CAB_X + 0.0075, (BASE_TOP + CAB_Y1) / 2, 0),
      mesh(new THREE.BoxGeometry(0.015, CAB_Y1 - BASE_TOP, CAB_Z * 2), skin, CAB_X - 0.0075, (BASE_TOP + CAB_Y1) / 2, 0),
      mesh(new THREE.BoxGeometry(CAB_X * 2, CAB_Y1 - BASE_TOP, 0.015), skin, 0, (BASE_TOP + CAB_Y1) / 2, -CAB_Z + 0.0075),
      mesh(new THREE.BoxGeometry(CAB_X * 2, 0.015, CAB_Z * 2 - 0.28), skin, 0, CAB_Y1 - 0.0075, -0.14)
    ];
    for (const p of panels) {
      p.userData.ghost = true;
      p.renderOrder = 3;
      this.group.add(p);
    }
  }

  private buildFrontPanel(): void {
    const white = paint(0xf3f5f7, { roughness: 0.28 });
    const sh = roundedRect(-CAB_X, BASE_TOP, CAB_X, PANEL_TOP, 0.03);
    const hole = new THREE.Path();
    hole.absarc(0, TC.y, 0.5, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    this.group.add(mesh(extrude(sh, 0.03, 0.008, 64), white, 0, 0, CAB_Z - 0.015));
    // 아래 걸레받이(필터 뚜껑)
    this.group.add(mesh(rbox(0.32, 0.18, 0.02, 0.02), plastic(0xdfe3e7), 0.55, 0.3, CAB_Z + 0.008));

    // 위 조작부
    this.group.add(mesh(rbox(CAB_X * 2, CAB_Y1 - PANEL_TOP, 0.3, 0.03, 3), white, 0, (PANEL_TOP + CAB_Y1) / 2, CAB_Z - 0.15));
    const fz = CAB_Z + 0.002;
    const ys = (PANEL_TOP + CAB_Y1) / 2;
    // 세제 서랍
    this.group.add(mesh(rbox(0.5, 0.2, 0.03, 0.02), plastic(0xe9edf1), -0.6, ys, fz + 0.01));
    this.group.add(mesh(rbox(0.22, 0.03, 0.02, 0.01), plastic(0xb7c0c9), -0.6, ys - 0.05, fz + 0.03));
    // 코스 다이얼
    this.group.add(mesh(cylZ(0.12, 0.012, 48), chrome(), 0.12, ys, fz + 0.006));
    this.group.add(mesh(latheZ([[0, 0], [0.095, 0], [0.1, 0.01], [0.092, 0.05], [0.07, 0.062], [0, 0.064]], 48), plastic(0xd4d9df, { roughness: 0.3 }), 0.12, ys, fz + 0.01));
    this.group.add(mesh(rbox(0.012, 0.05, 0.01, 0.003), paint(CATEGORY_COLORS.power), 0.12, ys + 0.05, fz + 0.075));
    // 표시창
    this.group.add(mesh(rbox(0.36, 0.16, 0.02, 0.01), plastic(0x15181c), 0.58, ys, fz + 0.008));
    this.lcdMat.color.set(0xffffff);
    this.group.add(mesh(new THREE.PlaneGeometry(0.32, 0.12), this.lcdMat, 0.58, ys, fz + 0.019));

    // 유리문: 흰 링 + 크롬 테 + 안쪽으로 볼록한 유리
    const door = new THREE.Group();
    door.position.set(0, TC.y, CAB_Z);
    door.add(mesh(latheZ([[0.43, 0.012], [0.6, 0.012], [0.615, 0.03], [0.6, 0.075], [0.56, 0.09], [0.45, 0.085], [0.43, 0.06], [0.43, 0.012]], 72), white));
    door.add(mesh(new THREE.TorusGeometry(0.585, 0.014, 12, 72), chrome(), 0, 0, 0.078));
    const gl = mesh(latheZ([[0.45, 0.07], [0.43, 0.02], [0.4, -0.06], [0.31, -0.18], [0.17, -0.25], [0, -0.27]], 64), glass(0xbcdcef, 0.26));
    gl.renderOrder = 5;
    door.add(gl);
    door.add(mesh(rbox(0.08, 0.26, 0.06, 0.02), plastic(0xc9d0d8), -0.6, 0, 0.04));
    door.add(mesh(rbox(0.05, 0.2, 0.05, 0.02), plastic(0x8d96a0), 0.56, 0, 0.08));
    this.group.add(door);
  }

  private buildTub(): void {
    // 바깥 통: 반투명 회전체(앞 개구부 → 원통 → 뒤판)
    const tubMat = ghost(0xa9b8c7, 0.3);
    tubMat.side = THREE.DoubleSide;
    const tub = mesh(
      latheZ(
        [
          [0.16, TUB_ZB],
          [TUB_R - 0.06, TUB_ZB],
          [TUB_R, TUB_ZB + 0.06],
          [TUB_R, TUB_ZF - 0.07],
          [TUB_R - 0.07, TUB_ZF],
          [0.46, TUB_ZF]
        ],
        72
      ),
      tubMat
    );
    tub.userData.ghost = true;
    tub.renderOrder = 2;
    this.tub.add(tub);
    // 불투명 테: 앞 개구부 링 + 몸통 띠 2줄(형태 읽기용)
    const rimMat = plastic(0x7f8c99, { roughness: 0.5 });
    this.tub.add(mesh(latheZ([[0.46, TUB_ZF - 0.01], [0.53, TUB_ZF - 0.01], [0.53, TUB_ZF + 0.012], [0.46, TUB_ZF + 0.012], [0.46, TUB_ZF - 0.01]], 64), rimMat));
    for (const z of [TUB_ZF - 0.12, TUB_ZB + 0.12]) this.tub.add(mesh(new THREE.TorusGeometry(TUB_R + 0.004, 0.012, 8, 96), rimMat, 0, 0, z));
    // 뒤판 리브 + 베어링 하우징
    const ribs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const b = rbox(TUB_R - 0.2, 0.035, 0.04, 0.008, 1);
      b.translate(0.17 + (TUB_R - 0.2) / 2, 0, TUB_ZB - 0.02);
      b.rotateZ((i / 6) * Math.PI * 2 + Math.PI / 6);
      ribs.push(b);
    }
    const ribGeo = mergeGeometries(ribs);
    ribs.forEach((b) => b.dispose());
    this.tub.add(mesh(ribGeo, rimMat));
    this.tub.add(mesh(latheZ([[0.045, TUB_ZB - 0.09], [0.13, TUB_ZB - 0.09], [0.17, TUB_ZB - 0.05], [0.17, TUB_ZB + 0.005], [0.045, TUB_ZB + 0.005], [0.045, TUB_ZB - 0.09]], 48), castIron()));
    // 균형추(콘크리트) — 앞 위쪽
    const cw = mesh(extrude(annularSector(TUB_R, TUB_R + 0.13, (40 * Math.PI) / 180, (140 * Math.PI) / 180), 0.26, 0.02, 24), paint(0x9a9c98, { roughness: 0.92, metalness: 0 }), 0, 0, TUB_ZF - 0.16);
    this.tub.add(cw);
    for (const s of [-1, 1]) this.tub.add(mesh(cylZ(0.022, 0.03, 6), steel(), s * 0.3, Math.sqrt((TUB_R + 0.13) ** 2 - 0.09) - 0.02, TUB_ZF - 0.02));
    // 스프링 고리 귀(위) + 핀
    for (const h of HOOK_L) {
      const yS = Math.sqrt(TUB_R * TUB_R - h.x * h.x);
      this.tub.add(mesh(rbox(0.04, h.y - yS + 0.06, 0.09, 0.008), rimMat, h.x, (h.y + yS) / 2 - 0.01, h.z));
      this.tub.add(mesh(cylZ(0.012, 0.11, 16), chrome(), h.x, h.y, h.z));
    }
    // 댐퍼 귀(아래)
    for (const l of DAMP_LUG) {
      const yS = -Math.sqrt(TUB_R * TUB_R - l.x * l.x);
      this.tub.add(mesh(rbox(0.04, yS - l.y + 0.06, 0.09, 0.008), rimMat, l.x, (yS + l.y) / 2 + 0.01, l.z));
      this.tub.add(mesh(cylZ(0.012, 0.11, 16), chrome(), l.x, l.y, l.z));
    }
  }

  private buildDrum(): void {
    // 타공 스테인리스 드럼(회전부) — 타공은 텍스처 무늬로
    const holes = canvasTex(64, 64, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#4a5058';
      for (const [x, y] of [
        [16, 16],
        [48, 48]
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    holes.repeat.set(56, 12);
    const drumMat = steel({ roughness: 0.3 });
    drumMat.map = holes;
    drumMat.side = THREE.DoubleSide;
    const prof: [number, number][] = [
      [0.0, -0.56],
      [DRUM_R - 0.04, -0.56],
      [DRUM_R, -0.52],
      [DRUM_R, 0.3],
      [DRUM_R - 0.06, 0.36],
      [0.5, 0.39],
      [0.42, 0.42]
    ];
    this.drum.add(mesh(latheZ(prof, 96), drumMat));
    this.drum.add(mesh(new THREE.TorusGeometry(0.425, 0.016, 12, 72), chrome(), 0, 0, 0.42));
    // 리프터 3개(빨래를 들어 올림)
    const lift = new THREE.Shape();
    lift.moveTo(DRUM_R + 0.01, -0.07);
    lift.lineTo(DRUM_R + 0.01, 0.07);
    lift.quadraticCurveTo(DRUM_R - 0.06, 0.05, DRUM_R - 0.1, 0.018);
    lift.quadraticCurveTo(DRUM_R - 0.115, 0, DRUM_R - 0.1, -0.018);
    lift.quadraticCurveTo(DRUM_R - 0.06, -0.05, DRUM_R + 0.01, -0.07);
    const liftGeo = extrude(lift, 0.76, 0.015, 16);
    const liftMat = plastic(0xdfe5ea, { roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const l = mesh(liftGeo, liftMat, 0, 0, -0.12);
      l.rotation.z = (i / 3) * Math.PI * 2 + Math.PI / 2;
      this.drum.add(l);
    }
    // 뒤 스파이더(3갈래) + 드럼 축
    const spider: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const b = rbox(DRUM_R - 0.08, 0.07, 0.04, 0.015);
      b.translate((DRUM_R - 0.08) / 2, 0, -0.585);
      b.rotateZ((i / 3) * Math.PI * 2 + Math.PI / 2);
      spider.push(b);
    }
    const spiderGeo = mergeGeometries(spider);
    spider.forEach((b) => b.dispose());
    const sp = aluminum({ roughness: 0.55 });
    this.drum.add(mesh(spiderGeo, sp));
    this.drum.add(mesh(cylZ(0.09, 0.05, 40), sp, 0, 0, -0.59));
    this.drum.add(mesh(cylZ(0.036, 0.3, 24), steel(), 0, 0, -0.7));
    // 축 끝 키(풀리 없을 때 회전 위상 표시)
    this.drum.add(mesh(rbox(0.014, 0.012, 0.06, 0.003), darkSteel(), 0, 0.036, -0.81));
  }

  private buildMotor(): void {
    const { x, y } = MOTOR;
    const body = paint(0x3a4450, { roughness: 0.45 });
    const z0 = -0.62;
    const z1 = -0.24;
    this.tub.add(mesh(latheZ([[0.02, z0], [0.09, z0], [0.115, z0 + 0.03], [0.12, z0 + 0.06], [0.12, z1 - 0.06], [0.115, z1 - 0.03], [0.09, z1], [0.02, z1]], 48), body, x, y, 0));
    // 냉각 슬롯 띠 + 끝 브러시 홀더
    const slotMat = plastic(0x1c1f24);
    for (const z of [z0 + 0.09, z1 - 0.09]) this.tub.add(mesh(new THREE.TorusGeometry(0.121, 0.008, 8, 48), slotMat, x, y, z));
    for (const s of [-1, 1]) this.tub.add(mesh(rbox(0.05, 0.04, 0.07, 0.01), plastic(0x2a2e34), x + s * 0.12, y, z0 + 0.12));
    // 터브에 고정하는 브래킷 2개(모터는 터브와 함께 움직인다)
    const yTub = -Math.sqrt(TUB_R * TUB_R - x * x);
    const bm = steel();
    for (const z of [z0 + 0.08, z1 - 0.08]) this.tub.add(mesh(rbox(0.2, yTub - (y + 0.11) + 0.04, 0.035, 0.008), bm, x, (yTub + y + 0.11) / 2, z));
    // 회전부: 축(+ 풀리 없을 때 보이는 키)
    this.motorRotor.add(mesh(cylZ(0.015, 0.22, 16), steel(), 0, 0, (z0 + PZ) / 2 - 0.02));
    this.motorRotor.add(mesh(rbox(0.008, 0.008, 0.05, 0.002), darkSteel(), 0, 0.015, PZ));
    // 전선
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + 0.12, y + 0.02, z0 + 0.12),
      new THREE.Vector3(x + 0.3, y + 0.1, z0 + 0.05),
      new THREE.Vector3(0.62, -0.36, -0.36),
      new THREE.Vector3(0.735, -0.12, -0.3)
    ]);
    this.tub.add(mesh(new THREE.TubeGeometry(curve, 40, 0.012, 8), plastic(0x2a2e34)));
    // 전선 고정 클립(터브 옆면)
    this.tub.add(mesh(rbox(0.03, 0.06, 0.05, 0.008), plastic(0x2a2e34), 0.735, -0.12, -0.3));
  }

  private buildGasket(): void {
    // 문 고무(벨로즈): 앞은 외함에 고정, 뒤는 터브에 붙어 함께 움직인다 → 정점별 가중치로 변형
    const prof: [number, number][] = [
      [0.5, CAB_Z - 0.02],
      [0.475, CAB_Z - 0.05],
      [0.5, CAB_Z - 0.1],
      [0.54, CAB_Z - 0.16],
      [0.52, CAB_Z - 0.22],
      [0.47, CAB_Z - 0.26],
      [0.5, CAB_Z - 0.32],
      [0.515, TUB_ZF + 0.02],
      [0.5, TUB_ZF + 0.005]
    ];
    const geo = latheZ([...prof].reverse(), 72);
    const mat = rubber({ roughness: 0.75 });
    mat.color.set(0x3a3f46);
    mat.side = THREE.DoubleSide;
    const m = mesh(geo, mat, TC.x, TC.y, 0);
    this.group.add(m);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    this.gasketGeo = geo;
    this.gasketBase = Float32Array.from(pos.array as Float32Array);
    const w = new Float32Array(pos.count);
    const zF = CAB_Z - 0.02;
    const zB = TUB_ZF + 0.005;
    for (let i = 0; i < pos.count; i++) w[i] = Math.max(0, Math.min(1, (zF - pos.getZ(i)) / (zF - zB)));
    this.gasketW = w;
  }

  private buildDampers(): void {
    const bodyMat = plastic(0x2a2e34, { roughness: 0.5 });
    const rodMat = chrome();
    for (let i = 0; i < 2; i++) {
      const base = DAMP_BASE[i]!;
      // 바닥 브래킷 + 핀
      this.group.add(mesh(rbox(0.05, base.y - BASE_TOP + 0.04, 0.1, 0.008), steel(), base.x, (base.y + BASE_TOP) / 2, base.z));
      this.group.add(mesh(cylZ(0.012, 0.12, 16), chrome(), base.x, base.y, base.z));
      const body = new THREE.Group();
      body.add(mesh(new THREE.TorusGeometry(0.022, 0.009, 8, 20), bodyMat));
      body.add(mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.2, 24), bodyMat, 0, 0.13, 0));
      body.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 24), steel(), 0, 0.235, 0));
      // 로드: 터브 귀에서 아래로(로컬 -Y 방향) 뻗어 몸통 안으로 들어간다
      const rod = new THREE.Group();
      rod.add(mesh(new THREE.TorusGeometry(0.022, 0.009, 8, 20), rodMat));
      rod.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 16), rodMat, 0, -0.14, 0));
      this.group.add(body, rod);
      this.dampers.push({ body, rod });
    }
  }

  private buildBlocks(): void {
    // 운송용 받침목: 윗면이 터브 곡면에 맞게 오목
    const hw = 0.26;
    const yArc = (x: number) => TC.y - Math.sqrt(TUB_R * TUB_R - x * x);
    const sh = new THREE.Shape();
    sh.moveTo(-hw, BASE_TOP);
    sh.lineTo(hw, BASE_TOP);
    sh.lineTo(hw, yArc(hw));
    for (let k = 1; k <= 16; k++) {
      const x = hw - (2 * hw * k) / 16;
      sh.lineTo(x, yArc(x));
    }
    sh.closePath();
    const geo = extrude(sh, 0.14, 0.01, 8);
    const mat = wood(0xc49a62);
    for (const z of [-0.02, 0.33]) this.blocks.add(mesh(geo, mat, 0, 0, z));
  }

  private buildLaundry(): void {
    const cols = [0x3f7fd6, 0xe0574f, 0xf2c14e, 0xf4f4f0, 0x49a86b, 0xe78fb3, 0x6a5acd];
    const zs = [-0.36, -0.14, 0.08, 0.22, -0.26, -0.02, 0.18];
    const rs = [0.17, 0.15, 0.16, 0.14, 0.16, 0.17, 0.15];
    cols.forEach((col, i) => {
      const r = rs[i]!;
      const g = new THREE.SphereGeometry(1, 20, 14);
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < p.count; k++) {
        const vx = p.getX(k);
        const vy = p.getY(k);
        const vz = p.getZ(k);
        const n = 1 + 0.14 * Math.sin(vx * 5 + i) * Math.cos(vz * 4 + i * 2) + 0.08 * Math.sin(vy * 7);
        p.setXYZ(k, vx * r * 1.05 * n, vy * r * 0.48 * n, vz * r * 1.25 * n);
      }
      g.computeVertexNormals();
      const m = mesh(g, plastic(col, { roughness: 0.95 }));
      this.tub.add(m);
      const c: Cloth = { mesh: m, r, z: zs[i]!, riding: true, rel: 0, px: 0, py: 0, vx: 0, vy: 0, fallT: 0, tumble: 0, rest: -Math.PI / 2 + (i - 3) * 0.3 };
      this.cloths.push(c);
      this.restCloth(c);
    });
  }

  private ridingRadius(c: Cloth): number {
    return DRUM_R - 0.015 - c.r * 0.6;
  }

  private restCloth(c: Cloth): void {
    c.riding = true;
    c.rel = c.rest;
    c.tumble = 0;
    const rr = this.ridingRadius(c);
    c.px = Math.cos(c.rest) * rr;
    c.py = Math.sin(c.rest) * rr;
    c.mesh.position.set(c.px, c.py, c.z);
    c.mesh.rotation.set(0, 0, c.rest - Math.PI / 2);
  }

  /**
   * 빨래 운동(드럼 단면 2D): 벽에 붙어 돌다가 벽의 수직항력이 0이 되면(ω²r < g·sinθ) 떨어져 포물선 운동.
   * 세탁(45rpm)에서는 위쪽 약 30° 지점에서 떨어지고, 탈수에서는 원심력이 커서 벽에 붙어 돈다.
   */
  private stepLaundry(dt: number, drumAngle: number, w: number): void {
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (const c of this.cloths) {
      const rr = this.ridingRadius(c);
      for (let k = 0; k < n; k++) {
        if (c.riding) {
          const a = c.rel + drumAngle;
          if (Math.sin(a) > (w * w * rr) / G) {
            c.riding = false;
            c.px = Math.cos(a) * rr;
            c.py = Math.sin(a) * rr;
            c.vx = -Math.sin(a) * rr * w;
            c.vy = Math.cos(a) * rr * w;
            c.fallT = 0;
          }
        } else {
          c.vy -= G * h;
          c.px += c.vx * h;
          c.py += c.vy * h;
          c.fallT += h;
          c.tumble += h * 6;
          const d = Math.hypot(c.px, c.py);
          if (d >= rr && c.fallT > 0.05) {
            const a = Math.atan2(c.py, c.px);
            c.px = Math.cos(a) * rr;
            c.py = Math.sin(a) * rr;
            c.rel = a - drumAngle;
            c.riding = true;
            c.tumble = 0;
          }
        }
      }
      if (c.riding) {
        const a = c.rel + drumAngle;
        c.mesh.position.set(Math.cos(a) * rr, Math.sin(a) * rr, c.z);
        c.mesh.rotation.set(0, 0, a - Math.PI / 2);
      } else {
        // 벽 가까이에서는 구르는 자세를 줄여 드럼 벽을 뚫지 않게(착지 순간 벽에 눕는다)
        const f = Math.max(0, Math.min(1, (rr - Math.hypot(c.px, c.py)) / (c.r * 0.9)));
        c.mesh.position.set(c.px, c.py, c.z);
        c.mesh.rotation.set(0, 0, Math.atan2(c.py, c.px) - Math.PI / 2 + c.tumble * f);
      }
    }
  }

  private setLcd(text: string): void {
    if (text === this.lcdText) return;
    this.lcdText = text;
    if (!this.lcdTex) {
      this.lcdTex = canvasTex(256, 96, () => {});
      this.lcdMat.map = this.lcdTex;
      this.lcdMat.emissiveMap = this.lcdTex;
    }
    const canvas = this.lcdTex.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#04121c';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#5fe3ff';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 52);
    this.lcdTex.needsUpdate = true;
  }

  private applyShadows(): void {
    this.enableShadows();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.slot) return;
      const mat = m.material as THREE.Material;
      if (m.userData.ghost || mat.transparent) {
        m.castShadow = false;
        return;
      }
      m.receiveShadow = true;
    });
  }
}
