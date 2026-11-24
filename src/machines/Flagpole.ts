// 국기 게양대: 벨트와 풀리 + 웜과 웜 기어 미션.
// 구조: 기둥 꼭대기 도르래(풀리)에 줄 고리가 걸리고, 기둥 아래 감개 상자의 드럼이 줄 고리를 당긴다.
// 드럼은 웜 휠과 같은 축 — 손잡이(웜 축)를 돌리면 웜 → 웜 휠(1:N) → 드럼 → 줄 → 깃발.
// 줄 고리는 닫힌 길이(도르래·드럼을 감아 도는 한 줄)라서 오른쪽 줄이 h 올라가면 왼쪽 줄은 h 내려온다(줄 길이 보존).
// 깃발 높이 h 하나에서 드럼각 φ = h / R_D, 웜 각 ψ = N · φ 가 모두 결정된다.
// 좌표: 바닥 y=0, +X 오른쪽, +Z 화면 앞. 줄·드럼·도르래는 z = ZR 평면.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, bronze, castIron, chrome, darkSteel, ghost, paint, plastic, steel, wood } from '../models/materials';
import { lathe, merge, TAU, type V2 } from '../models/parts/geom';
import { gearShape } from '../models/factory';

// ── 기둥·구조 ──
const SLAB_H = 0.3;
const POLE_TOP = 6.84;
const PUL_Y = 6.5; // 도르래 중심 높이
const ZR = 0.45; // 줄 평면 z
const R_ROPE = 0.3; // 도르래·드럼 위 줄 중심 반지름
const ROPE_R = 0.025;
const M_PER_UNIT = 0.35;

// ── 감개 상자·드럼·웜 ──
const BOX = { x0: -0.95, x1: 0.95, y0: 0.3, y1: 2.3, z0: 0.11, z1: 1.0 };
const DRUM_Y = 1.45;
const N_WHEEL = 10; // 웜 휠 잇수 = 감속비 (웜은 1줄)
const RW = 0.55; // 웜 휠 피치 반지름
const MOD = (2 * RW) / N_WHEEL;
const WORM_RP = 0.22;
const WORM_Y = DRUM_Y - RW - WORM_RP;
const WORM_Z = 0.62;
const WHEEL_DZ = WORM_Z - ZR; // 휠이 드럼 그룹 안에서 놓이는 z
const WORM_PITCH = Math.PI * MOD;
const WORM_LEN = 0.7;
const SHAFT_X0 = -0.85;
const SHAFT_X1 = 1.3;

// ── 깃발 ──
const FW = 2.4;
const FH = 1.6; // 가로:세로 = 3:2
const FLAG_Y0 = 2.55; // 내려왔을 때 깃발 아래 변
const TRAVEL = 6.4 - FH - FLAG_Y0; // 올라가는 거리(깃발 윗변이 도르래 아래에 닿기 전까지)
const PERIOD = 12;

// 줄 고리 경로 길이 (오른줄 ↑ → 도르래 → 왼줄 ↓ → 드럼 아래)
const H_STRAND = PUL_Y - DRUM_Y;
const LOOP_LEN = 2 * H_STRAND + 2 * Math.PI * R_ROPE;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && !m.userData.slot) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

function cylAxis(r: number, a: number, b: number, axis: 'x' | 'y' | 'z', seg = 24): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, b - a, seg);
  g.translate(0, (a + b) / 2, 0);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

/** (r, 축방향) 프로파일 회전체, 축 = Z */
function latheZ(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 축 = X */
function latheX(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 1줄 웜(축 X): 위상 f = x/피치 − θ/2π. θ가 늘면 나사산이 +X로 전진 → 웜 휠 아래쪽이 +X로 밀려 휠이 반시계(+Z)로 돈다 */
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
      const edge = Math.min(1, (len / 2 - Math.abs(x)) / (pitch * 0.5));
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

/** 줄 고리 경로의 점 (s: 0 = 드럼 오른쪽 접점, 오른줄 위로) */
function loopPoint(s: number, out: THREE.Vector3): THREE.Vector3 {
  let u = ((s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
  if (u < H_STRAND) return out.set(R_ROPE, DRUM_Y + u, ZR);
  u -= H_STRAND;
  const arc = Math.PI * R_ROPE;
  if (u < arc) {
    const a = u / R_ROPE;
    return out.set(R_ROPE * Math.cos(a), PUL_Y + R_ROPE * Math.sin(a), ZR);
  }
  u -= arc;
  if (u < H_STRAND) return out.set(-R_ROPE, PUL_Y - u, ZR);
  u -= H_STRAND;
  const b = Math.PI + u / R_ROPE;
  return out.set(R_ROPE * Math.cos(b), DRUM_Y + R_ROPE * Math.sin(b), ZR);
}

/** 태극기(건곤감리) — 가로:세로 = 3:2, 지름 d = 세로/2. 규격 비율대로 캔버스에 그린다 */
function drawTaegeukgi(): THREE.CanvasTexture {
  const W = 1200;
  const H = 800;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  const d = H / 2;
  const cx = W / 2;
  const cy = H / 2;
  const a = Math.atan2(2, 3); // 왼쪽 위 → 오른쪽 아래 대각선
  const ex = Math.cos(a);
  const ey = Math.sin(a);
  // 태극: 위 빨강 / 아래 파랑 반원 + 지름 d/2 반원 둘로 S자 경계
  g.fillStyle = '#CD2E3A';
  g.beginPath();
  g.arc(cx, cy, d / 2, a - Math.PI, a, false);
  g.closePath();
  g.fill();
  g.fillStyle = '#0047A0';
  g.beginPath();
  g.arc(cx, cy, d / 2, a, a + Math.PI, false);
  g.closePath();
  g.fill();
  g.fillStyle = '#CD2E3A';
  g.beginPath();
  g.arc(cx - (d / 4) * ex, cy - (d / 4) * ey, d / 4, 0, TAU);
  g.fill();
  g.fillStyle = '#0047A0';
  g.beginPath();
  g.arc(cx + (d / 4) * ex, cy + (d / 4) * ey, d / 4, 0, TAU);
  g.fill();
  // 4괘: 길이 d/2, 폭 d/3, 막대 두께 d/12, 줄 간격 d/24, 끊김 틈 d/24
  const trigram = (dirx: number, diry: number, solid: boolean[]): void => {
    const L = Math.hypot(dirx, diry);
    const ux = dirx / L;
    const uy = diry / L;
    g.save();
    g.translate(cx + ux * d, cy + uy * d);
    g.rotate(Math.atan2(uy, ux)); // 로컬 x = 대각선(바깥) 방향, 막대는 로컬 y 방향(대각선에 수직)
    g.fillStyle = '#000000';
    const t = d / 12;
    const len = d / 2;
    const gap = d / 24;
    const rows = [-d / 8, 0, d / 8];
    rows.forEach((rx, i) => {
      if (solid[i]) g.fillRect(rx - t / 2, -len / 2, t, len);
      else {
        g.fillRect(rx - t / 2, -len / 2, t, (len - gap) / 2);
        g.fillRect(rx - t / 2, gap / 2, t, (len - gap) / 2);
      }
    });
    g.restore();
  };
  trigram(-W, -H, [true, true, true]); // 왼쪽 위 건 ☰
  trigram(W, H, [false, false, false]); // 오른쪽 아래 곤 ☷
  trigram(W, -H, [false, true, false]); // 오른쪽 위 감 ☵
  trigram(-W, H, [true, false, true]); // 왼쪽 아래 리 ☲
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class Flagpole extends BaseMachine {
  readonly id = 'flagpole';

  private pulleyModel: THREE.Group | null = null;
  private wormModel: THREE.Group | null = null;
  private readonly drum = new THREE.Group();
  private readonly wormShaft = new THREE.Group();
  private readonly flag = new THREE.Group();
  private flagMesh!: THREE.Mesh;
  private flagBase!: Float32Array;
  private beads!: THREE.InstancedMesh;
  private wheelOn = false;
  private h = 0;
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpM = new THREE.Matrix4();

  constructor() {
    super();
    this.buildBase();
    this.buildPole();
    this.buildTop();
    this.buildBox();
    this.buildDrum();
    this.buildWormShaft();
    this.buildRope();
    this.buildFlag();
    this.addSlot(0, 0.46, new THREE.Vector3(0, PUL_Y, ZR + 0.14), 0.016);
    this.addSlot(1, 0.8, new THREE.Vector3(0, DRUM_Y, WORM_Z + 0.12), 0.02);
    this.hideSlot(1);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
    }
    this.applyH(0, 0);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.pulleyModel !== null : this.wormModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, PUL_Y, ZR) : new THREE.Vector3(0, DRUM_Y - 0.1, WORM_Z);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, PUL_Y, ZR + 0.2) : new THREE.Vector3(0, DRUM_Y, WORM_Z + 0.2);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildPulley() : this.buildWormSet();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    if (step === 0) {
      model.position.set(0, PUL_Y, ZR);
      model.rotation.set(0, 0, 0);
      this.group.add(model);
      this.pulleyModel = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      const worm = model.getObjectByName('worm');
      const wheel = model.getObjectByName('wheel');
      if (worm) {
        worm.position.set(0, 0, 0);
        worm.rotation.set(0, 0, 0);
        this.wormShaft.add(worm);
      }
      if (wheel) {
        wheel.position.set(0, 0, WHEEL_DZ);
        wheel.rotation.set(0, 0, 0);
        this.drum.add(wheel);
      }
      this.wormModel = model;
      this.wheelOn = true;
      this.hideSlot(1);
    }
    this.applyH(0, 0);
  }

  reset(): void {
    if (this.pulleyModel) this.group.remove(this.pulleyModel);
    if (this.wormModel) {
      const worm = this.wormShaft.getObjectByName('worm');
      const wheel = this.drum.getObjectByName('wheel');
      if (worm) this.wormShaft.remove(worm);
      if (wheel) this.drum.remove(wheel);
    }
    this.pulleyModel = this.wormModel = null;
    this.wheelOn = false;
    this.showSlot(0);
    this.hideSlot(1);
    this.applyH(0, 0);
  }

  createSim(): MachineSim {
    if (!this.pulleyModel || !this.wormModel) throw new Error('flagpole mission incomplete');
    let time = 0;
    let state = '대기';
    let psiDot = 0;
    let prevPsi = 0;
    const hAt = (tc: number): number => {
      if (tc < 0.8) return 0;
      if (tc < 4.8) return TRAVEL * smooth((tc - 0.8) / 4);
      if (tc < 7.8) return TRAVEL;
      if (tc < 11.8) return TRAVEL * (1 - smooth((tc - 7.8) / 4));
      return 0;
    };
    return {
      update: (dt: number) => {
        time += dt;
        const tc = time % PERIOD;
        const h = hAt(tc);
        state = tc < 0.8 ? '대기' : tc < 4.8 ? '올리는 중' : tc < 7.8 ? '꼭대기 · 자동 잠김' : tc < 11.8 ? '내리는 중' : '대기';
        const psi = (h / R_ROPE) * N_WHEEL;
        psiDot = dt > 0 ? Math.abs(psi - prevPsi) / dt : 0;
        prevPsi = psi;
        this.applyH(h, time);
      },
      getDisplay: () => {
        const crank = (psiDot / TAU) * 60;
        return [
          { label: '손잡이 회전수', value: crank.toFixed(0), unit: 'rpm', tone: 'red' },
          { label: `드럼 회전수 (감속비 1:${N_WHEEL})`, value: (crank / N_WHEEL).toFixed(0), unit: 'rpm', tone: 'blue' },
          { label: '깃발 높이', value: ((FLAG_Y0 + this.h) * M_PER_UNIT).toFixed(1), unit: 'm' },
          { label: '상태', value: state }
        ];
      }
    };
  }

  update(t: number): void {
    super.update(t);
    if (!this.pulleyModel || !this.wormModel) this.waveFlag(t, 0);
  }

  /** 깃발 높이 h(단위) 하나로 모든 회전·위치를 결정 */
  private applyH(h: number, time: number): void {
    this.h = h;
    const phi = h / R_ROPE; // 드럼·도르래: 오른줄이 올라가므로 +Z 기준 반시계
    this.drum.rotation.z = this.wheelOn ? phi : 0;
    if (this.pulleyModel) this.pulleyModel.rotation.z = phi;
    this.wormShaft.rotation.x = this.wheelOn ? phi * N_WHEEL : 0;
    this.flag.position.set(R_ROPE, FLAG_Y0 + h, ZR);
    for (let i = 0; i < this.beads.count; i++) {
      loopPoint((i * LOOP_LEN) / this.beads.count + h, this.tmpV);
      this.tmpM.makeTranslation(this.tmpV.x, this.tmpV.y, this.tmpV.z);
      this.beads.setMatrixAt(i, this.tmpM);
    }
    this.beads.instanceMatrix.needsUpdate = true;
    this.waveFlag(time, smooth((h / TRAVEL - 0.55) / 0.45));
  }

  /** 깃발 펄럭임: 깃대(줄) 쪽은 고정, 바깥으로 갈수록 진폭이 큼 */
  private waveFlag(time: number, top: number): void {
    const pos = this.flagMesh.geometry.attributes.position as THREE.BufferAttribute;
    const amp = 0.035 + 0.13 * top;
    for (let i = 0; i < pos.count; i++) {
      const x = this.flagBase[i * 3] ?? 0;
      const y = this.flagBase[i * 3 + 1] ?? 0;
      const u = x / FW;
      const z = amp * u * Math.sin(u * 6.5 - time * 5.5 + y * 1.2);
      pos.setXYZ(i, x * (1 - 0.03 * u * Math.abs(Math.sin(u * 6.5 - time * 5.5))), y, z);
    }
    pos.needsUpdate = true;
    this.flagMesh.geometry.computeVertexNormals();
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 홈 도르래(풀리): 원점 = 도르래 중심, 축 = Z */
  private buildPulley(): THREE.Group {
    const g = new THREE.Group();
    const m = paint(CATEGORY_COLORS.power, { roughness: 0.35, metalness: 0.3 });
    add(g, latheZ([[0.22, -0.07], [0.335, -0.07], [0.34, -0.06], [0.34, -0.045], [0.275, -0.012], [0.272, 0], [0.275, 0.012], [0.34, 0.045], [0.34, 0.06], [0.335, 0.07], [0.22, 0.07], [0.22, -0.07]], 64), m);
    const web = new THREE.Shape();
    web.absarc(0, 0, 0.23, 0, TAU, false);
    web.holes.push(new THREE.Path().absarc(0, 0, 0.05, 0, TAU, true));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      web.holes.push(new THREE.Path().absarc(Math.cos(a) * 0.145, Math.sin(a) * 0.145, 0.055, 0, TAU, true));
    }
    const wg = new THREE.ExtrudeGeometry(web, { depth: 0.04, bevelEnabled: false, curveSegments: 32 });
    wg.translate(0, 0, -0.02);
    add(g, wg, m);
    add(g, latheZ([[0.05, -0.065], [0.09, -0.065], [0.09, 0.065], [0.05, 0.065], [0.05, -0.065]], 32), bronze());
    return g;
  }

  /** 웜(웜 축 위)과 웜 휠(드럼 축 위) — 원점 = 웜 휠 중심 */
  private buildWormSet(): THREE.Group {
    const g = new THREE.Group();
    const worm = new THREE.Group();
    worm.name = 'worm';
    const rRoot = WORM_RP - 1.25 * MOD;
    const rTip = WORM_RP + MOD;
    add(worm, wormGeo(WORM_LEN, rRoot, rTip, WORM_PITCH), steel({ roughness: 0.25 }));
    for (const s of [-1, 1]) add(worm, cylAxis(rRoot + 0.004, 0, 0.04, 'x', 32), steel(), s * (WORM_LEN / 2 + (s > 0 ? 0 : -0.04)), 0, 0);
    worm.position.set(0, WORM_Y - DRUM_Y, WHEEL_DZ * 0);
    g.add(worm);

    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    const shape = gearShape(N_WHEEL, RW + MOD, 2.25 * MOD, 0.28);
    shape.holes.push(new THREE.Path().absarc(0, 0, 0.07, 0, TAU, true));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      shape.holes.push(new THREE.Path().absarc(Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.085, 0, TAU, true));
    }
    const t = 0.1;
    const wg = new THREE.ExtrudeGeometry(shape, { depth: t - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelOffset: -0.006, bevelSegments: 1, curveSegments: 12 });
    wg.translate(0, 0, -(t - 0.012) / 2);
    add(wheel, wg, bronze({ roughness: 0.32 }));
    add(wheel, latheZ([[0.07, -0.08], [0.15, -0.08], [0.15, 0.08], [0.07, 0.08], [0.07, -0.08]], 40), bronze({ roughness: 0.32 }));
    g.add(wheel);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildBase(): void {
    add(this.group, new RoundedBoxGeometry(2.3, SLAB_H, 2.3, 3, 0.05), plastic(0xb4b0a6, { roughness: 0.92 }), 0, SLAB_H / 2, 0.4);
  }

  private buildPole(): void {
    add(this.group, lathe([[0, SLAB_H], [0.3, SLAB_H], [0.3, SLAB_H + 0.03], [0.22, SLAB_H + 0.12], [0.115, SLAB_H + 0.2], [0.085, POLE_TOP], [0, POLE_TOP]], 40), aluminum({ color: 0xeef1f4, roughness: 0.3 }));
    // 이음 띠
    for (const y of [2.6, 4.2, 5.8]) add(this.group, cylAxis(0.098 - (y - 2.6) * 0.0035, y - 0.04, y + 0.04, 'y', 32), steel(), 0, 0, 0);
    // 기단 앵커 볼트
    const bolts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      bolts.push(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6).translate(Math.cos(a) * 0.26, SLAB_H + 0.015, Math.sin(a) * 0.26));
    }
    add(this.group, merge(bolts), steel());
  }

  /** 기둥 꼭대기: 들보, 도르래 볼 뺨판 + 축 핀, 꼭대기 장식 */
  private buildTop(): void {
    const frame = darkSteel({ roughness: 0.45 });
    add(this.group, new RoundedBoxGeometry(0.2, 0.12, 0.74, 2, 0.03), frame, 0, POLE_TOP + 0.06, 0.28);
    // 뺨판은 반투명 — 안의 도르래가 보여야 한다
    const cheek = ghost(0x8fa3b8, 0.3);
    for (const s of [-1, 1]) {
      const z = ZR + s * 0.1;
      add(this.group, new THREE.CylinderGeometry(0.42, 0.42, 0.03, 48).rotateX(Math.PI / 2), cheek, 0, PUL_Y, z);
      add(this.group, new THREE.BoxGeometry(0.34, POLE_TOP + 0.02 - PUL_Y, 0.03), frame, 0, (PUL_Y + POLE_TOP + 0.02) / 2, z);
    }
    // 축 핀 + 머리·너트: 풀리를 끼우기 전에도 보인다
    add(this.group, cylAxis(0.04, ZR - 0.17, ZR + 0.17, 'z', 20), steel(), 0, PUL_Y, 0);
    add(this.group, cylAxis(0.065, ZR + 0.115, ZR + 0.15, 'z', 6), steel(), 0, PUL_Y, 0);
    add(this.group, cylAxis(0.065, ZR - 0.15, ZR - 0.115, 'z', 6), steel(), 0, PUL_Y, 0);
    // 꼭대기 장식(구)
    add(this.group, cylAxis(0.05, POLE_TOP + 0.12, POLE_TOP + 0.2, 'y', 20), brassLike());
    add(this.group, new THREE.SphereGeometry(0.15, 32, 20), brassLike(), 0, POLE_TOP + 0.3, 0);
  }

  private buildBox(): void {
    const w = BOX.x1 - BOX.x0;
    const h = BOX.y1 - BOX.y0;
    const d = BOX.z1 - BOX.z0;
    const cx = (BOX.x0 + BOX.x1) / 2;
    const cz = (BOX.z0 + BOX.z1) / 2;
    const m = add(this.group, new RoundedBoxGeometry(w, h, d, 3, 0.04), ghost(0xa8c0d8, 0.28), cx, (BOX.y0 + BOX.y1) / 2, cz);
    m.castShadow = false;
    const plate = paint(0x2d5aa8, { roughness: 0.5 });
    add(this.group, new RoundedBoxGeometry(w + 0.06, 0.07, d + 0.06, 2, 0.02), plate, cx, BOX.y0 + 0.035, cz);
    add(this.group, new RoundedBoxGeometry(w + 0.06, 0.07, d + 0.06, 2, 0.02), plate, cx, BOX.y1 - 0.035, cz);
    // 모서리 기둥(상자 뼈대)
    for (const x of [BOX.x0 + 0.02, BOX.x1 - 0.02]) for (const z of [BOX.z0 + 0.02, BOX.z1 - 0.02]) add(this.group, cylAxis(0.025, BOX.y0, BOX.y1, 'y', 12), plate, x, 0, z);
    // 줄이 드나드는 구멍 테
    for (const s of [-1, 1]) add(this.group, new THREE.TorusGeometry(0.06, 0.016, 10, 24).rotateX(Math.PI / 2), steel(), s * R_ROPE, BOX.y1 + 0.005, ZR);
    // 웜 축 받침(왼쪽·오른쪽 벽 안쪽)
    const boss = castIron({ color: 0x4a5058 });
    add(this.group, latheX([[0.075, -0.1], [0.15, -0.1], [0.15, 0.1], [0.075, 0.1], [0.075, -0.1]], 32), boss, BOX.x0 + 0.13, WORM_Y, WORM_Z);
    add(this.group, latheX([[0.075, -0.1], [0.15, -0.1], [0.15, 0.1], [0.075, 0.1], [0.075, -0.1]], 32), boss, BOX.x1 - 0.13, WORM_Y, WORM_Z);
    // 드럼 축 받침(뒤쪽 벽)
    add(this.group, latheZ([[0.075, -0.05], [0.16, -0.05], [0.16, 0.05], [0.075, 0.05], [0.075, -0.05]], 32), boss, 0, DRUM_Y, BOX.z0 + 0.06);
  }

  /** 드럼 그룹(원점 = 드럼 중심, z = ZR): 축 + 플랜지 드럼. 웜 휠은 설치 시 z = WHEEL_DZ 에 붙는다 */
  private buildDrum(): void {
    const d = this.drum;
    d.position.set(0, DRUM_Y, ZR);
    this.group.add(d);
    add(d, cylAxis(0.07, BOX.z0 + 0.03 - ZR, BOX.z1 - 0.12 - ZR, 'z', 24), steel({ roughness: 0.28 }));
    add(d, latheZ([[0.07, -0.075], [0.275, -0.075], [0.36, -0.075], [0.36, -0.055], [0.285, -0.05], [0.275, -0.04], [0.275, 0.04], [0.285, 0.05], [0.36, 0.055], [0.36, 0.075], [0.07, 0.075], [0.07, -0.075]], 64), darkSteel({ roughness: 0.4 }));
    // 홈 줄(줄이 자리잡는 얕은 홈) + 육각 볼트: 회전이 보이는 표식
    const bolts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      bolts.push(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 6).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.065));
    }
    add(d, merge(bolts), chrome());
    add(d, new THREE.BoxGeometry(0.05, 0.1, 0.012), plastic(0xf4f6f8), 0.32, 0, 0.079);
  }

  /** 웜 축 그룹(원점 = 웜 중심, 축 = X): 축 + 크랭크 손잡이. 웜은 설치 시 원점에 붙는다 */
  private buildWormShaft(): void {
    const s = this.wormShaft;
    s.position.set(0, WORM_Y, WORM_Z);
    this.group.add(s);
    add(s, cylAxis(0.07, SHAFT_X0, SHAFT_X1, 'x', 24), steel({ roughness: 0.28 }));
    add(s, new THREE.BoxGeometry(0.05, 0.02, 0.016), plastic(0x0d0e10), SHAFT_X0 + 0.15, 0.07, 0);
    // 크랭크: 허브 + 팔 + 손잡이
    add(s, cylAxis(0.12, SHAFT_X1 - 0.12, SHAFT_X1 + 0.1, 'x', 28), darkSteel());
    add(s, new THREE.CapsuleGeometry(0.055, 0.5, 6, 16), darkSteel(), SHAFT_X1 - 0.02, 0.3, 0);
    add(s, cylAxis(0.035, SHAFT_X1 - 0.02, SHAFT_X1 + 0.2, 'x', 16), steel(), 0, 0.55, 0);
    add(s, cylAxis(0.075, SHAFT_X1 + 0.1, SHAFT_X1 + 0.62, 'x', 28), wood(0x8a5a33, { roughness: 0.55 }), 0, 0.55, 0);
    add(s, new THREE.SphereGeometry(0.075, 20, 12), wood(0x8a5a33, { roughness: 0.55 }), SHAFT_X1 + 0.62, 0.55, 0);
  }

  private buildRope(): void {
    const rope = plastic(0xe6d9b8, { roughness: 0.85 });
    for (const s of [-1, 1]) add(this.group, cylAxis(ROPE_R, DRUM_Y, PUL_Y, 'y', 12), rope, s * R_ROPE, 0, ZR);
    add(this.group, new THREE.TorusGeometry(R_ROPE, ROPE_R, 10, 40, Math.PI), rope, 0, PUL_Y, ZR);
    const g = new THREE.TorusGeometry(R_ROPE, ROPE_R, 10, 40, Math.PI);
    g.rotateZ(Math.PI);
    add(this.group, g, rope, 0, DRUM_Y, ZR);
    // 줄 위의 표시 매듭(줄이 움직이는 것이 보인다)
    this.beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 14, 10), plastic(0xb8412f, { roughness: 0.5 }), 18);
    this.beads.castShadow = true;
    this.group.add(this.beads);
  }

  private buildFlag(): void {
    this.flag.position.set(R_ROPE, FLAG_Y0, ZR);
    this.group.add(this.flag);
    const geo = new THREE.PlaneGeometry(FW, FH, 30, 16);
    geo.translate(FW / 2, FH / 2, 0);
    this.flagBase = (geo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;
    const fm = new THREE.MeshStandardMaterial({ map: drawTaegeukgi(), side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
    this.flagMesh = new THREE.Mesh(geo, fm);
    this.flagMesh.castShadow = true;
    this.flag.add(this.flagMesh);
    // 줄에 거는 고리 2개(깃발 윗변·아랫변)
    for (const y of [0.1, FH - 0.1]) {
      const c = add(this.flag, new THREE.TorusGeometry(0.055, 0.014, 10, 24).rotateX(Math.PI / 2), steel(), 0, y, 0);
      c.name = y < 1 ? 'clipBottom' : 'clipTop';
    }
  }
}

function brassLike(): THREE.Material {
  return bronze({ color: 0xd4a94a, roughness: 0.25 });
}
