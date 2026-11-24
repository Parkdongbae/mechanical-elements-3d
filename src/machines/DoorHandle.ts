// 문 손잡이(레버형): 캠 + 스프링 미션 — 문짝 조각과 문틀 조각을 확대한 단면 모형.
// 손잡이 축(각봉)에 캠이 달려 있고, 돌면 캠 윤곽이 걸쇠 틀(요크)의 받침판을 밀어 걸쇠를 문 안으로 당긴다.
// 걸쇠 위치 = 캠 윤곽에서 계산한 받침판 접촉점(평면 종동절): 접촉 x = min_φ ρ(φ)·cos(φ+θ).
// 복귀 스프링은 받침판 뒤(왼쪽)에서 받침판을 밀어 걸쇠를 내보내고, 캠과 손잡이도 되돌린다.
// 좌표: +X 오른쪽(걸쇠 쪽), +Z 화면 앞. 문짝 그룹 원점 = 경첩 축(HX, 0, HZ).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, brass, castIron, chrome, darkSteel, ghost, paint, plastic, steel, wood } from '../models/materials';
import { TAU } from '../models/parts/geom';

// ── 문·문틀 (월드 좌표) ──
const HX = -3.0;
const HZ = 0.38;
const EDGE = 0.6; // 문짝 오른쪽 끝(걸쇠 쪽)
const DOOR_Y0 = 0.06;
const DOOR_Y1 = 3.5;
const DOOR_Z0 = -0.4;
const DOOR_Z1 = 0.4;
const JAMB_W = 0.5;
const CX = -0.5; // 손잡이 축(캠 중심) x
const CY = 1.8; // 손잡이 축 높이
const STRIKE_X = EDGE + 0.12; // 받이쇠 면
const AMAX = (9 * Math.PI) / 180;

// ── 래치 케이스 ──
const CASE_X0 = -1.75;
const CASE_X1 = 0.45;
const CASE_H = 1.05; // 중심 ±
const YOKE_H = 0.9; // 요크 막대 위치 ±
const PLATE_T = 0.08;
const SPRING_R = 0.15;
const SPRING_COILS = 8;

// ── 캠 ──
const CAM_R0 = 0.24;
const CAM_A = 0.5;
const CAM_PHI0 = (105 * Math.PI) / 180;
const CAM_W = (70 * Math.PI) / 180;
const THETA_MAX = (55 * Math.PI) / 180;

const PERIOD = 8;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** 캠 윤곽 반지름 ρ(φ) */
function camRho(phi: number): number {
  let d = ((phi - CAM_PHI0 + Math.PI) % TAU + TAU) % TAU - Math.PI;
  d = Math.abs(d);
  if (d >= CAM_W) return CAM_R0;
  const c = Math.cos((Math.PI * d) / (2 * CAM_W));
  return CAM_R0 + CAM_A * c * c;
}

/** 캠을 θ만큼 반시계로 돌렸을 때 가장 왼쪽 점의 x(축 기준, 음수) = 받침판이 닿는 위치 */
function camLeft(theta: number): number {
  let m = 0;
  const n = 360;
  for (let i = 0; i < n; i++) {
    const phi = (i / n) * TAU;
    const x = camRho(phi) * Math.cos(phi + theta);
    if (x < m) m = x;
  }
  return m;
}

const LEFT0 = camLeft(0);
/** 손잡이 θ에서 걸쇠가 들어가는 거리 */
function camRetract(theta: number): number {
  return LEFT0 - camLeft(theta);
}
const P_EXT = camRetract(THETA_MAX); // 걸쇠 최대 돌출 = 최대 후퇴량 → 손잡이를 끝까지 내리면 문 끝면과 같아진다

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

/** (z,y) 평면 판 — 법선 = X, x 범위 [x0, x0+t] 의 구멍 뚫린 판 */
function plateX(x0: number, t: number, outer: [number, number, number, number], hole: [number, number, number, number]): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(outer[0], outer[1]);
  s.lineTo(outer[2], outer[1]);
  s.lineTo(outer[2], outer[3]);
  s.lineTo(outer[0], outer[3]);
  s.closePath();
  const h = new THREE.Path();
  h.moveTo(hole[0], hole[1]);
  h.lineTo(hole[0], hole[3]);
  h.lineTo(hole[2], hole[3]);
  h.lineTo(hole[2], hole[1]);
  h.closePath();
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.rotateY(Math.PI / 2); // 모양 x → −z, 압출 → +x
  g.translate(x0, 0, 0);
  return g;
}

/** 단위 길이(x) 코일 스프링 — mesh.scale.x 로 길이를 맞춘다 */
function springGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = SPRING_COILS * 28;
  const endK = 0.5 / SPRING_COILS;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * SPRING_COILS * TAU;
    const xc = u < endK ? (u / endK) * 0.03 : u > 1 - endK ? 1 - ((1 - u) / endK) * 0.03 : 0.03 + ((u - endK) / (1 - 2 * endK)) * 0.94;
    pts.push(new THREE.Vector3(xc - 0.5, Math.cos(a) * SPRING_R, Math.sin(a) * SPRING_R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.026, 8, false);
}

export class DoorHandle extends BaseMachine {
  readonly id = 'doorhandle';
  /** 원점 = 경첩 축. 문짝 전체(손잡이·래치 포함)가 이 그룹 안에서 경첩 둘레로 열린다 */
  private readonly door = new THREE.Group();
  private readonly lever = new THREE.Group();
  private readonly latch = new THREE.Group();
  private camModel: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private readonly plateX0: number; // 휴지 상태에서 받침판 오른쪽 면의 x

  constructor() {
    super();
    this.plateX0 = CX + LEFT0;
    this.door.position.set(HX, 0, HZ);
    this.group.add(this.door);
    this.buildFrame();
    this.buildDoor();
    this.buildCase();
    this.buildLatch();
    this.buildLever();

    this.addSlot(0, 0.62, new THREE.Vector3(CX, CY, 0.03), 0.02);
    this.addSlot(1, 0.3, new THREE.Vector3(-1.25, CY, 0.03), 0.016);
    this.slots[1]!.rotation.y = Math.PI / 2;
    this.hideSlot(1);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
    }
    this.apply(0, 0, 0);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.camModel !== null : this.springModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(CX, CY, 0.2) : new THREE.Vector3(-1.25, CY, 0.2);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(CX, CY, 0.4) : new THREE.Vector3(-1.25, CY, 0.4);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildCam() : this.buildSpring();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    this.door.add(model);
    if (step === 0) {
      model.position.set(CX - HX, CY, 0 - HZ);
      this.camModel = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.springModel = model;
      this.hideSlot(1);
    }
    this.apply(0, 0, 0);
  }

  reset(): void {
    if (this.camModel) this.door.remove(this.camModel);
    if (this.springModel) this.door.remove(this.springModel);
    this.camModel = this.springModel = null;
    this.showSlot(0);
    this.hideSlot(1);
    this.apply(0, 0, 0);
  }

  createSim(): MachineSim {
    if (!this.camModel || !this.springModel) throw new Error('doorhandle mission incomplete');
    let time = 0;
    let theta = 0;
    let prot = P_EXT;
    return {
      update: (dt: number) => {
        time += dt;
        const tc = time % PERIOD;
        // 손잡이: 0.7s 내림 → 유지 → 2.4s 놓음(스프링이 되돌림)
        theta = THETA_MAX * (smooth(tc / 0.7) - smooth((tc - 2.4) / 0.5));
        // 문: 0.7~1.5s 열림, 4.4~5.4s 닫힘
        const open = smooth((tc - 0.7) / 0.8) - smooth((tc - 4.4) / 1.0);
        // 닫히며 걸쇠 빗면이 받이쇠에 밀려 잠깐 들어갔다가 구멍에서 튀어나온다
        const k = (tc - 4.4) / 1.0;
        const dip = k > 0.78 && k < 1 ? Math.sin((Math.PI * (k - 0.78)) / 0.22) : 0;
        const retract = Math.max(camRetract(theta), dip * P_EXT * 0.9);
        prot = P_EXT - retract;
        this.apply(theta, open * AMAX, retract);
      },
      getDisplay: () => [
        { label: '손잡이 각도', value: ((theta * 180) / Math.PI).toFixed(0), unit: '°' },
        { label: '걸쇠 돌출', value: ((Math.max(0, prot) / P_EXT) * 13).toFixed(0), unit: 'mm', tone: 'red' },
        { label: '상태', value: prot > P_EXT * 0.5 ? '잠김' : '풀림', tone: prot > P_EXT * 0.5 ? 'red' : 'blue' }
      ]
    };
  }

  /** 손잡이 각 θ, 문 열린 각, 걸쇠 후퇴량 → 모든 가동 부품 배치 */
  private apply(theta: number, openAngle: number, retract: number): void {
    this.door.rotation.y = -openAngle;
    this.lever.rotation.z = theta;
    if (this.camModel) this.camModel.rotation.z = theta;
    this.latch.position.x = -retract;
    if (this.springModel) {
      // 왼쪽은 케이스 벽, 오른쪽은 받침판 왼쪽 면
      const x0 = CASE_X0 + 0.05;
      const x1 = this.plateX0 - PLATE_T - retract;
      const len = Math.max(0.25, x1 - x0);
      this.springModel.scale.set(len, 1, 1);
      this.springModel.position.set(x0 + len / 2 - HX, CY, 0 - HZ);
    }
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 캠 + 손잡이 각봉(사각 축). 원점 = 손잡이 축 중심, z=0 이 캠 평면 */
  private buildCam(): THREE.Group {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    const n = 160;
    for (let i = 0; i < n; i++) {
      const phi = (i / n) * TAU;
      const r = camRho(phi);
      if (i === 0) s.moveTo(r * Math.cos(phi), r * Math.sin(phi));
      else s.lineTo(r * Math.cos(phi), r * Math.sin(phi));
    }
    s.closePath();
    const hw = 0.1;
    const hole = new THREE.Path();
    hole.moveTo(-hw, -hw);
    hole.lineTo(-hw, hw);
    hole.lineTo(hw, hw);
    hole.lineTo(hw, -hw);
    hole.closePath();
    s.holes.push(hole);
    const cg = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 4 });
    cg.translate(0, 0, -0.07);
    add(g, cg, paint(CATEGORY_COLORS.power, { roughness: 0.35, metalness: 0.3 }));
    // 각봉: 캠 뒤쪽부터 손잡이 허브 속까지
    add(g, new THREE.BoxGeometry(0.2, 0.2, 0.75), steel({ roughness: 0.28 }), 0, 0, 0.175);
    return g;
  }

  /** 복귀 스프링: 원점 = 스프링 중심, 단위 길이(x) — 설치 후 scale.x 로 늘고 준다 */
  private buildSpring(): THREE.Group {
    const g = new THREE.Group();
    add(g, springGeo(), paint(CATEGORY_COLORS.control, { roughness: 0.3, metalness: 0.5 }));
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildFrame(): void {
    const w = wood(0x8a5a33, { roughness: 0.65 });
    const f = this.group;
    const y0 = 0;
    const y1 = 3.95;
    const jz0 = -0.5;
    const jz1 = DOOR_Z1;
    // 바닥판
    add(f, new RoundedBoxGeometry(6.4, 0.05, 2.6, 2, 0.02), wood(0x6f4a2b, { roughness: 0.75 }), -1.2, 0.025, 0);
    // 왼쪽(경첩) 문설주
    add(f, new RoundedBoxGeometry(JAMB_W, y1 - y0, jz1 - jz0, 2, 0.02), w, HX - 0.05 - JAMB_W / 2, (y0 + y1) / 2, (jz0 + jz1) / 2);
    // 오른쪽(받이쇠) 문설주
    add(f, new RoundedBoxGeometry(JAMB_W, y1 - y0, jz1 - jz0, 2, 0.02), w, STRIKE_X + JAMB_W / 2, (y0 + y1) / 2, (jz0 + jz1) / 2);
    // 위 인방
    add(f, new RoundedBoxGeometry(STRIKE_X + JAMB_W - (HX - 0.05 - JAMB_W), 0.45, jz1 - jz0, 2, 0.02), w, (STRIKE_X + JAMB_W + HX - 0.05 - JAMB_W) / 2, DOOR_Y1 + 0.225, (jz0 + jz1) / 2);
    // 받이쇠 판(구멍) + 구멍 속 어두운 홈
    add(f, plateX(STRIKE_X, 0.03, [-0.26, CY - 0.55, 0.26, CY + 0.55], [-0.17, CY - 0.3, 0.17, CY + 0.3]), steel());
    add(f, new THREE.BoxGeometry(0.4, 0.62, 0.36), plastic(0x0d0e10, { roughness: 0.9 }), STRIKE_X + 0.03 + 0.2 - 0.001, CY, 0);
    // 경첩 문틀 쪽 잎
    for (const y of [0.6, 1.8, 2.9]) add(f, new THREE.BoxGeometry(0.55, 0.5, 0.035), steel(), HX - 0.275, y, 0.4 + 0.0175);
  }

  private buildDoor(): void {
    const d = this.door;
    const L = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x - HX, y, z - HZ);
    const w = wood(0xb98552, { roughness: 0.6 });
    const w2 = wood(0x9c6b3e, { roughness: 0.6 });
    const dw = EDGE - HX;
    const dh = DOOR_Y1 - DOOR_Y0;
    const cy = (DOOR_Y0 + DOOR_Y1) / 2;
    // 뒷 판(불투명) + 앞 판(반투명: 안의 래치가 보이는 단면)
    const back = L(HX + dw / 2, cy, (DOOR_Z0 - 0.15) / 2);
    add(d, new RoundedBoxGeometry(dw, dh, -0.15 - DOOR_Z0, 2, 0.02), w, back.x, back.y, back.z);
    const front = L(HX + dw / 2, cy, (DOOR_Z1 - 0.15) / 2);
    const fm = add(d, new THREE.BoxGeometry(dw, dh, DOOR_Z1 + 0.15), ghost(0xd9b27c, 0.2), front.x, front.y, front.z);
    fm.castShadow = false;
    // 테두리(문 뼈대): 위·아래·왼쪽 + 오른쪽은 걸쇠 구멍을 비운 두 토막
    const bar = (x0: number, x1: number, y0: number, y1: number, mat: THREE.Material): void => {
      const p = L((x0 + x1) / 2, (y0 + y1) / 2, (DOOR_Z1 - 0.15) / 2);
      add(d, new RoundedBoxGeometry(x1 - x0, y1 - y0, DOOR_Z1 + 0.15, 2, 0.015), mat, p.x, p.y, p.z);
    };
    bar(HX, EDGE, DOOR_Y0, DOOR_Y0 + 0.14, w2);
    bar(HX, EDGE, DOOR_Y1 - 0.14, DOOR_Y1, w2);
    bar(HX, HX + 0.14, DOOR_Y0, DOOR_Y1, w2);
    bar(EDGE - 0.15, EDGE, DOOR_Y0, CY - 0.35, w2);
    bar(EDGE - 0.15, EDGE, CY + 0.35, DOOR_Y1, w2);
    // 문 끝면 판(걸쇠 구멍)
    const fp = plateX(EDGE, 0.03, [-0.24, CY - 0.5, 0.24, CY + 0.5], [-0.16, CY - 0.28, 0.16, CY + 0.28]);
    fp.translate(-HX, 0, -HZ);
    add(d, fp, steel(), 0, 0, 0);
    // 경첩 마디(문 쪽) + 문 쪽 잎
    for (const y of [0.6, 1.8, 2.9]) {
      add(d, new THREE.CylinderGeometry(0.085, 0.085, 0.5, 20), steel({ roughness: 0.3 }), 0, y, 0);
      add(d, new THREE.BoxGeometry(0.55, 0.5, 0.035), steel(), 0.275, y, 0.4 - HZ + 0.0175);
    }
  }

  /** 래치 케이스: 뒷판 + 테두리(문 단면). 앞은 비워 둔다(문 앞 판이 반투명) */
  private buildCase(): void {
    const d = this.door;
    const L = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x - HX, y, z - HZ);
    const mat = castIron({ color: 0x4a5058 });
    const w = CASE_X1 - CASE_X0;
    let p = L((CASE_X0 + CASE_X1) / 2, CY, -0.14);
    add(d, new THREE.BoxGeometry(w, CASE_H * 2, 0.03), steel({ roughness: 0.45 }), p.x, p.y, p.z);
    for (const s of [-1, 1]) {
      p = L((CASE_X0 + CASE_X1) / 2, CY + s * CASE_H, 0.04);
      add(d, new THREE.BoxGeometry(w, 0.06, 0.34), mat, p.x, p.y, p.z);
    }
    p = L(CASE_X0 + 0.03, CY, 0.04);
    add(d, new THREE.BoxGeometry(0.06, CASE_H * 2, 0.34), mat, p.x, p.y, p.z);
    // 케이스 앞쪽 가장자리 모서리 볼트 4개
    for (const x of [CASE_X0 + 0.15, CASE_X1 - 0.15]) for (const s of [-1, 1]) {
      p = L(x, CY + s * (CASE_H - 0.15), -0.115);
      add(d, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 6).rotateX(Math.PI / 2), steel(), p.x, p.y, p.z);
    }
  }

  /** 걸쇠 틀(요크): 받침판 + 위·아래 막대 + 오른쪽 연결대 + 걸쇠 머리. latch 그룹 전체가 x 로 움직인다 */
  private buildLatch(): void {
    const d = this.door;
    const L = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x - HX, y, z - HZ);
    d.add(this.latch);
    const plate = darkSteel({ roughness: 0.4 });
    const bar = steel({ roughness: 0.3 });
    const pxR = this.plateX0; // 받침판 오른쪽 면(휴지 상태)
    const hb = 0.3; // 연결대 위치
    let p = L(pxR - PLATE_T / 2, CY, 0);
    add(this.latch, new RoundedBoxGeometry(PLATE_T, YOKE_H * 2 + 0.1, 0.16, 2, 0.015), plate, p.x, p.y, p.z);
    for (const s of [-1, 1]) {
      p = L((pxR - PLATE_T + hb + 0.04) / 2, CY + s * YOKE_H, 0);
      add(this.latch, new RoundedBoxGeometry(hb + 0.04 - (pxR - PLATE_T), 0.08, 0.16, 2, 0.015), bar, p.x, p.y, p.z);
    }
    p = L(hb + 0.04, CY, 0);
    add(this.latch, new RoundedBoxGeometry(0.08, YOKE_H * 2 + 0.1, 0.16, 2, 0.015), plate, p.x, p.y, p.z);
    // 걸쇠 머리: 위쪽 모서리를 깎은 빗면 + 오른쪽 돌출
    const hs = new THREE.Shape();
    const len = EDGE + P_EXT - (hb + 0.08);
    hs.moveTo(0, -0.24);
    hs.lineTo(len, -0.24);
    hs.lineTo(len, 0.06);
    hs.lineTo(len - 0.24, 0.24);
    hs.lineTo(0, 0.24);
    hs.closePath();
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.26, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 4 });
    hg.translate(0, 0, -0.13);
    p = L(hb + 0.08, CY, 0);
    add(this.latch, hg, brass({ roughness: 0.28 }), p.x, p.y, p.z);
  }

  /** 레버: 문 앞면의 로즈(고정) + 허브 + 손잡이(−X 쪽으로 뻗음). 손잡이를 내리면 +Z 기준 반시계(θ>0) */
  private buildLever(): void {
    const d = this.door;
    const zf = DOOR_Z1 - HZ;
    const rose = new THREE.Group();
    add(rose, new THREE.CylinderGeometry(0.45, 0.47, 0.07, 48).rotateX(Math.PI / 2), chrome({ roughness: 0.18 }), 0, 0, 0.035);
    rose.position.set(CX - HX, CY, zf);
    d.add(rose);
    this.lever.position.set(CX - HX, CY, zf + 0.07);
    d.add(this.lever);
    const lv = aluminum({ roughness: 0.2 });
    add(this.lever, new THREE.CylinderGeometry(0.2, 0.22, 0.14, 40).rotateX(Math.PI / 2), lv, 0, 0, 0.07);
    add(this.lever, new RoundedBoxGeometry(1.75, 0.22, 0.16, 4, 0.07), lv, -0.9, 0, 0.1);
    add(this.lever, new THREE.SphereGeometry(0.11, 20, 12), lv, -1.75, 0, 0.1).scale.set(1, 1, 0.8);
    // 각봉 구멍 표시(캠이 없을 때는 비어 있다)
    add(this.lever, new THREE.BoxGeometry(0.2, 0.2, 0.01), plastic(0x0d0e10, { roughness: 0.9 }), 0, 0, 0.145);
  }
}
