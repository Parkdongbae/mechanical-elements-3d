// 연필깎이: 전동축 + 헬리컬 기어 미션 (책상 위 전시용 확대 모형, 연필 길이 약 2.7).
// 구조: 손잡이(크랭크) → 전동축 → 끝의 캐리어(원판)가 연필 둘레를 공전 → 캐리어에 비스듬히 단 원통 헬리컬 칼날이
// 고정 링 기어(잇수 24)와 맞물려 자전(칼날 잇수 8). 링 기어가 고정이므로 칼날의 캐리어 기준 자전 = −(24/8) × 공전.
// 칼날 축은 연필 원뿔 모선과 나란히 기울어(α) 있어 연필 끝이 원뿔로 깎인다.
// 좌표: 연필·축 = X 방향(축 높이 PY), +Z = 화면 앞. 손잡이는 왼쪽(-X), 연필은 오른쪽(+X)에서 들어간다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, castIron, chrome, darkSteel, ghost, paint, plastic, rubber, steel, wood } from '../models/materials';
import { lathe, TAU, type V2 } from '../models/parts/geom';
import { buildHelicalGearMesh } from '../models/factory';
import { involuteOutline } from '../models/parts/gears';

const PY = 1.6; // 축 높이
const DESK = { x0: -3.5, x1: 3.0, z: 1.75, h: 0.14 };
const BODY = { x0: -1.4, x1: 1.5, z: 1.15, yBin: 0.58, yTop: 2.7, wall: 0.14 };

// 기어 치수: 링 피치 반지름 = 3 × 칼날 피치 반지름 → 잇수비 24 : 8
const N_RING = 24;
const N_CUT = 8;
const R_CUT_P = 0.225;
const R_RING_P = R_CUT_P * (N_RING / N_CUT);
const RC = R_RING_P - R_CUT_P; // 캐리어 반지름(공전 반지름)
const MOD = (2 * R_RING_P) / N_RING;
const CUT_R = R_CUT_P + MOD; // 칼날 이끝 반지름
const CUT_LEN = 1.1;
const XC = 0.1; // 칼날 중심 x
const RATIO = N_RING / N_CUT;

// 연필: 원뿔 모선 기울기 = 칼날 안쪽 모선 기울기
const PR = 0.27;
const SLOPE = 0.29;
const ALPHA = Math.atan(SLOPE);
const X_BASE = 0.393; // 원뿔 밑면(깎이는 부분의 끝) x
const L_CONE = 0.79;
const PENCIL_LEN = 2.3;
const PULL = 0.9; // 교체하려고 뽑아내는 거리

const PERIOD = 8;
const CRANK_RPS = 0.9;
const SHAVE_MAX = 80;

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

/** 축 = X 원기둥 */
function cylX(r: number, a: number, b: number, seg = 28): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, b - a, seg);
  g.rotateZ(-Math.PI / 2);
  g.translate((a + b) / 2, 0, 0);
  return g;
}

/** (r, x) 프로파일 회전체, 축 = X */
function latheX(p: V2[], seg = 40): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 양쪽 벽: 앞뒤(z) 폭 2·BODY.z, y 0.14~yTop, 중심에 구멍 */
function wallGeo(holeR: number, xRight: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const z = BODY.z;
  s.moveTo(-z, DESK.h);
  s.lineTo(z, DESK.h);
  s.lineTo(z, BODY.yTop);
  s.lineTo(-z, BODY.yTop);
  s.closePath();
  s.holes.push(new THREE.Path().absarc(0, PY, holeR, 0, TAU, true));
  const g = new THREE.ExtrudeGeometry(s, { depth: BODY.wall, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 32 });
  g.rotateY(Math.PI / 2);
  g.translate(xRight, 0, 0);
  return g;
}

/** 고정 링 기어(안쪽 이): 바깥 원 − 외접 기어 윤곽 구멍. 축 = X, x 범위 [x0, x0+w] */
function ringGearGeo(x0: number, w: number): THREE.BufferGeometry {
  const outline = involuteOutline(N_RING, R_RING_P + MOD, R_RING_P - 1.25 * MOD);
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.95, 0, TAU, false);
  const hole = new THREE.Path();
  const pts = outline.slice().reverse();
  pts.forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
  hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 48 });
  g.rotateY(Math.PI / 2);
  g.translate(x0 + w, PY, 0);
  return g;
}

export class PencilSharpener extends BaseMachine {
  readonly id = 'sharpener';

  /** 원점 = 축 위(0, PY, 0), X축 둘레로 회전하는 그룹: 크랭크 + (설치되면) 전동축 + 칼날 */
  private readonly spin = new THREE.Group();
  private shaftModel: THREE.Group | null = null;
  private cutterModel: THREE.Group | null = null;
  private cutterSpin: THREE.Object3D | null = null;
  private readonly pencil = new THREE.Group();
  private woodCone!: THREE.Mesh;
  private graphiteCone!: THREE.Mesh;
  private shavings!: THREE.InstancedMesh;
  private lastSharp = -1;

  constructor() {
    super();
    this.buildDesk();
    this.buildBody();
    this.buildCrank();
    this.buildPencil();
    this.buildShavings();

    this.addSlot(0, 0.34, new THREE.Vector3(-0.95, PY, 0), 0.02);
    this.slots[0]!.rotation.y = Math.PI / 2;
    this.addSlot(1, 0.5, new THREE.Vector3(XC, PY + RC, 0), 0.02);
    this.slots[1]!.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.cos(ALPHA), Math.sin(ALPHA), 0));
    this.hideSlot(1);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
    }
    this.setSharp(0.0, 3);
    this.setShavings(6);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.shaftModel !== null : this.cutterModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(-1.0, PY, 0.1) : new THREE.Vector3(XC, PY + RC, 0.1);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(-0.95, PY, 0.3) : new THREE.Vector3(XC, PY + RC, 0.3);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildShaft() : this.buildCutter();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    if (step === 0) {
      // 모델은 spin 좌표(축 = x)로 만들어 두었다. 비행 중에는 가운데가 원점이 되도록 안쪽 그룹을 옮겨 둔 상태
      model.position.set(SHAFT_CX, 0, 0);
      model.rotation.set(0, 0, 0);
      this.spin.add(model);
      this.shaftModel = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(XC, RC, 0);
      model.rotation.set(0, 0, 0);
      this.spin.add(model);
      this.cutterModel = model;
      this.cutterSpin = model.getObjectByName('spin') ?? null;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.shaftModel) this.spin.remove(this.shaftModel);
    if (this.cutterModel) this.spin.remove(this.cutterModel);
    this.shaftModel = this.cutterModel = this.cutterSpin = null;
    this.spin.rotation.x = 0;
    this.pencil.position.x = 0;
    this.setSharp(0, 3);
    this.setShavings(6);
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.shaftModel || !this.cutterModel) throw new Error('sharpener mission incomplete');
    let time = 0;
    let phi = 0;
    let cranking = false;
    let sharp = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const tc = time % PERIOD;
        const cycles = Math.floor(time / PERIOD);
        let off = 0;
        if (tc < 0.7) {
          off = PULL * (1 - smooth(tc / 0.7));
          sharp = 0;
          cranking = false;
        } else if (tc < 6.2) {
          sharp = (tc - 0.7) / 5.5;
          cranking = true;
        } else if (tc < 6.7) {
          sharp = 1;
          cranking = false;
        } else if (tc < 7.4) {
          off = PULL * smooth((tc - 6.7) / 0.7);
          sharp = 1;
          cranking = false;
        } else {
          off = PULL;
          sharp = 0; // 새 연필로 교체
          cranking = false;
        }
        if (cranking) phi += TAU * CRANK_RPS * dt;
        this.spin.rotation.x = phi;
        // 링 기어 고정: 칼날의 캐리어 기준 자전 = −(N_링/N_칼날) × 공전각
        if (this.cutterSpin) this.cutterSpin.rotation.x = -RATIO * phi;
        this.pencil.position.x = off;
        this.setSharp(sharp, 3);
        this.setShavings(Math.min(SHAVE_MAX, Math.round(6 + (cycles + (tc > 6.2 ? 1 : sharp)) * 10)));
      },
      getDisplay: () => {
        const rpm = cranking ? CRANK_RPS * 60 : 0;
        return [
          { label: '손잡이 회전수', value: rpm.toFixed(0), unit: 'rpm', tone: 'blue' },
          { label: `칼날 자전 회전수 (×${RATIO})`, value: (rpm * RATIO).toFixed(0), unit: 'rpm', tone: 'red' },
          { label: '깎인 정도', value: (sharp * 100).toFixed(0), unit: '%' }
        ];
      }
    };
  }

  // ───────────────────────── 연필 끝(원뿔) ─────────────────────────

  /** 깎인 정도 p(0~1): 원뿔 길이 Lc, 나무 끝면 반지름 = PR − SLOPE·Lc (칼날 모선과 같은 기울기) */
  private setSharp(p: number, _unused: number): void {
    void _unused;
    if (Math.abs(p - this.lastSharp) < 1e-4) return;
    this.lastSharp = p;
    const lc = 0.06 + (L_CONE - 0.06) * p;
    const rTip = PR - SLOPE * lc;
    const wg = new THREE.CylinderGeometry(PR, rTip, lc, 36);
    wg.rotateZ(-Math.PI / 2);
    wg.translate(-lc / 2, 0, 0);
    this.woodCone.geometry.dispose();
    this.woodCone.geometry = wg;
    const gr = Math.min(0.05, rTip);
    const lg = 0.05 + 0.2 * p;
    const gg = new THREE.CylinderGeometry(gr, 0.008, lg, 20);
    gg.rotateZ(-Math.PI / 2);
    gg.translate(-lc - lg / 2, 0, 0);
    this.graphiteCone.geometry.dispose();
    this.graphiteCone.geometry = gg;
  }

  private setShavings(n: number): void {
    this.shavings.count = n;
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 전동축: 커플링 + 축 + 캐리어 원판(+ 칼날 핀 자리). spin 좌표(x = 축 방향), 가운데를 원점으로 */
  private buildShaft(): THREE.Group {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.x = -SHAFT_CX;
    g.add(inner);
    const rod = steel({ roughness: 0.26 });
    add(inner, cylX(0.1, SHAFT_X0, SHAFT_X1, 32), rod);
    // 커플링 슬리브(크랭크 축과 잇는다)
    add(inner, latheX([[0, -2.05], [0.16, -2.05], [0.16, -1.75], [0, -1.75]], 36), darkSteel());
    // 축용 표시 띠(파랑)
    add(inner, cylX(0.108, -1.2, -1.05, 32), paint(CATEGORY_COLORS.shaft, { roughness: 0.35 }));
    // 캐리어: 원판 + 가벼운 구멍 3개 + 중앙 허브
    const disc = new THREE.Shape();
    disc.absarc(0, 0, 0.78, 0, TAU, false);
    disc.holes.push(new THREE.Path().absarc(0, 0, 0.1, 0, TAU, true));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + Math.PI / 6;
      disc.holes.push(new THREE.Path().absarc(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.13, 0, TAU, true));
    }
    const dg = new THREE.ExtrudeGeometry(disc, { depth: 0.12, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 40 });
    dg.rotateY(Math.PI / 2);
    dg.translate(CARRIER_X1, 0, 0);
    add(inner, dg, darkSteel({ roughness: 0.4 }));
    add(inner, latheX([[0.1, CARRIER_X0 - 0.04], [0.2, CARRIER_X0 - 0.04], [0.2, CARRIER_X1 + 0.04], [0.1, CARRIER_X1 + 0.04], [0.1, CARRIER_X0 - 0.04]], 32), steel());
    // 칼날 핀 받침(캐리어 앞면의 보스)
    const boss = add(inner, new THREE.CylinderGeometry(0.1, 0.12, 0.14, 24), steel(), 0, 0, 0);
    boss.geometry.rotateZ(-Math.PI / 2);
    boss.position.set(CARRIER_X1 + 0.06, RC - 0.24 * 0 - 0.22, 0);
    return g;
  }

  /** 칼날 조립: 원점 = 칼날 중심, tilt(기울임) → spin(자전) → 헬리컬 칼날 + 핀 */
  private buildCutter(): THREE.Group {
    const g = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.z = ALPHA;
    g.add(tilt);
    const sp = new THREE.Group();
    sp.name = 'spin';
    tilt.add(sp);
    const blade = buildHelicalGearMesh(N_CUT, CUT_R, 1.25 * MOD, CUT_LEN, 0.9, 0xd8dde3);
    blade.geometry.rotateY(Math.PI / 2);
    sp.add(blade);
    // 핀: 캐리어 보스에 박혀 칼날 중심을 지난다 + 끝 캡(전동용 빨강 포인트)
    add(sp, cylX(0.04, -0.82, 0.62, 20), chrome());
    add(sp, cylX(0.075, 0.55, 0.64, 24), paint(CATEGORY_COLORS.power, { roughness: 0.35 }));
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildDesk(): void {
    const w = DESK.x1 - DESK.x0;
    add(this.group, new RoundedBoxGeometry(w, DESK.h, DESK.z * 2, 3, 0.03), wood(0xb98552), (DESK.x0 + DESK.x1) / 2, DESK.h / 2, 0);
  }

  private buildBody(): void {
    const red = paint(0xd6453a, { roughness: 0.4 });
    const cx = (BODY.x0 + BODY.x1) / 2;
    const w = BODY.x1 - BODY.x0;
    // 책상 고정 받침(볼트 4개)
    add(this.group, new RoundedBoxGeometry(w + 0.5, 0.07, BODY.z * 2 + 0.3, 2, 0.02), darkSteel(), cx, DESK.h + 0.035, 0);
    const bolts = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6);
    for (const x of [BODY.x0 - 0.1, BODY.x1 + 0.1]) for (const z of [-1.3, 1.3]) add(this.group, bolts, steel(), x, DESK.h + 0.095, z);
    // 양 끝 벽(왼쪽: 축 구멍, 오른쪽: 연필 구멍)
    add(this.group, wallGeo(0.13, BODY.x0 + BODY.wall), red);
    add(this.group, wallGeo(0.31, BODY.x1), red);
    // 부스러기 통(투명) + 바닥판 + 통 앞 손잡이판
    const midW = BODY.x1 - BODY.x0 - 2 * BODY.wall + 0.01;
    const midX = cx;
    const bin = add(this.group, new RoundedBoxGeometry(midW, BODY.yBin - DESK.h - 0.07, BODY.z * 2, 2, 0.02), ghost(0xcfe0ef, 0.22), midX, (BODY.yBin + DESK.h + 0.07) / 2, 0);
    bin.castShadow = false;
    add(this.group, new RoundedBoxGeometry(midW, 0.06, BODY.z * 2, 2, 0.015), red, midX, BODY.yBin + 0.03, 0);
    const knob = add(this.group, new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16), steel(), midX, (BODY.yBin + DESK.h + 0.07) / 2, BODY.z + 0.04);
    knob.rotation.x = Math.PI / 2;
    // 기구부 투명 덮개(앞·뒤·위)
    const mechH = BODY.yTop - BODY.yBin - 0.06;
    const mech = add(this.group, new RoundedBoxGeometry(midW, mechH, BODY.z * 2, 3, 0.04), ghost(0xa8c0d8, 0.26), midX, BODY.yBin + 0.06 + mechH / 2, 0);
    mech.castShadow = false;
    // 가장자리 테(윗면 앞·뒤, 바닥면 앞·뒤)
    for (const y of [BODY.yBin + 0.07, BODY.yTop - 0.03]) for (const z of [-BODY.z + 0.03, BODY.z - 0.03]) add(this.group, new RoundedBoxGeometry(midW, 0.06, 0.06, 2, 0.015), red, midX, y, z);
    // 링 기어 + 받침 러그(앞·뒤·위·아래로 덮개 테에 고정)
    add(this.group, ringGearGeo(0, 0.2), darkSteel({ roughness: 0.4 }));
    const lug = (x: number, y: number, z: number, sx: number, sy: number, sz: number): void => {
      add(this.group, new THREE.BoxGeometry(sx, sy, sz), darkSteel(), x, y, z);
    };
    lug(0.1, PY, (0.95 + BODY.z) / 2 - 0.01, 0.2, 0.22, BODY.z - 0.95 + 0.02);
    lug(0.1, PY, -((0.95 + BODY.z) / 2 - 0.01), 0.2, 0.22, BODY.z - 0.95 + 0.02);
    lug(0.1, (PY + 0.95 + BODY.yTop) / 2, 0, 0.2, BODY.yTop - PY - 0.95 + 0.02, 0.22);
    lug(0.1, (PY - 0.95 + BODY.yBin + 0.06) / 2, 0, 0.2, PY - 0.95 - BODY.yBin - 0.06 + 0.02, 0.22);
    // 축 받침(왼쪽 벽 바깥 보스) + 연필 구멍 칼라(오른쪽 벽 바깥)
    add(this.group, latheX([[0.12, BODY.x0 - 0.22], [0.24, BODY.x0 - 0.22], [0.24, BODY.x0 - 0.02], [0.12, BODY.x0 - 0.02], [0.12, BODY.x0 - 0.22]], 36), castIron({ color: 0x4a5058 }), 0, PY, 0);
    add(this.group, latheX([[0.31, BODY.x1 + 0.0], [0.5, BODY.x1], [0.5, BODY.x1 + 0.12], [0.43, BODY.x1 + 0.2], [0.31, BODY.x1 + 0.2], [0.31, BODY.x1]], 40), steel({ roughness: 0.3 }), 0, PY, 0);
  }

  private buildCrank(): void {
    this.spin.position.set(0, PY, 0);
    this.group.add(this.spin);
    const dark = darkSteel();
    // 크랭크 축(스텁): 커플링에 끼워진다
    add(this.spin, cylX(0.1, -2.35, -1.9, 28), steel());
    add(this.spin, cylX(0.22, -2.5, -2.22, 36), dark);
    add(this.spin, new RoundedBoxGeometry(0.16, 1.0, 0.24, 3, 0.05), dark, -2.36, 0.45, 0);
    add(this.spin, cylX(0.04, -2.36, -2.55, 16), steel(), 0, 0.9, 0);
    add(this.spin, cylX(0.11, -3.0, -2.55, 28), wood(0x8a5a33, { roughness: 0.5 }), 0, 0.9, 0);
    const end = add(this.spin, new THREE.SphereGeometry(0.11, 20, 12), wood(0x8a5a33, { roughness: 0.5 }), -3.0, 0.9, 0);
    end.scale.set(0.8, 1, 1);
  }

  /** 연필(원점 = 원뿔 밑면 x_base, 축 +x). 처음에는 뭉툭, 구멍으로 들어가 있다 */
  private buildPencil(): void {
    const p = this.pencil;
    this.group.add(p);
    const holder = new THREE.Group();
    holder.position.set(X_BASE, PY, 0);
    p.add(holder);
    const body = paint(0xf2c230, { roughness: 0.38, metalness: 0 });
    const bodyLen = PENCIL_LEN - 0.5;
    add(holder, cylX(PR, 0, bodyLen, 36), body);
    // 육각 연필 느낌의 줄무늬 + 끝 띠
    for (const a of [0, 1, 2, 3, 4, 5]) {
      const st = add(holder, new THREE.BoxGeometry(bodyLen - 0.1, 0.012, 0.018), plastic(0x1f1f1f, { roughness: 0.6 }), bodyLen / 2, 0, 0);
      st.position.set(bodyLen / 2, Math.sin((a / 6) * TAU) * (PR + 0.001), Math.cos((a / 6) * TAU) * (PR + 0.001));
      st.rotation.x = -(a / 6) * TAU;
    }
    add(holder, latheX([[0.02, bodyLen], [PR * 0.97, bodyLen], [PR * 0.97, bodyLen + 0.32], [0.02, bodyLen + 0.32]], 36), steel({ roughness: 0.25 }));
    for (const x of [0.08, 0.16, 0.24]) add(holder, new THREE.TorusGeometry(PR * 0.975, 0.012, 8, 36).rotateY(Math.PI / 2), chrome(), bodyLen + x, 0, 0);
    add(holder, latheX([[0.01, bodyLen + 0.32], [PR * 0.88, bodyLen + 0.32], [PR * 0.88, PENCIL_LEN - 0.04], [PR * 0.8, PENCIL_LEN], [0.01, PENCIL_LEN]], 32), rubber({ color: 0xe88aa0 }));
    // 깎이는 끝: 나무 원뿔(깎인 면) + 흑연
    this.woodCone = add(holder, new THREE.BufferGeometry(), wood(0xe6c58e, { roughness: 0.65 }));
    this.graphiteCone = add(holder, new THREE.BufferGeometry(), plastic(0x3a3d42, { roughness: 0.35, metalness: 0.4 }));
    // 흑연 심(몸통 안쪽을 지난다 — 끝면에서 보이는 점)
  }

  private buildShavings(): void {
    const g = new THREE.TorusGeometry(0.1, 0.014, 6, 14, 4.4);
    this.shavings = new THREE.InstancedMesh(g, wood(0xe6c58e, { roughness: 0.7 }), SHAVE_MAX);
    this.shavings.castShadow = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    // 결정적 의사 난수(리셋해도 같은 모양)
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < SHAVE_MAX; i++) {
      e.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
      q.setFromEuler(e);
      const s = 0.7 + rnd() * 0.7;
      m.compose(new THREE.Vector3(-0.9 + rnd() * 1.9, DESK.h + 0.2 + rnd() * 0.12, (rnd() - 0.5) * 1.7), q, new THREE.Vector3(s, s, s));
      this.shavings.setMatrixAt(i, m);
    }
    this.group.add(this.shavings);
  }
}

// ── 전동축 치수(spin 좌표) ──
const SHAFT_X0 = -1.9;
const CARRIER_X0 = -0.68;
const CARRIER_X1 = -0.56;
const SHAFT_X1 = CARRIER_X0 + 0.02;
const SHAFT_CX = (-2.05 + CARRIER_X1) / 2;
