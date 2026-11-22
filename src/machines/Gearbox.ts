// 변속기: 전동축과 헬리컬 기어 미션 — 3단 수동 변속기 컷어웨이(하우징 반투명)
// 입력축 → 상시 물림 기어(16:24) → 부축 → 단수 기어쌍(12:28, 17:23, 22:18) → 출력축.
// 모든 기어쌍은 같은 모듈·같은 중심거리(잇수 합 40)라서 실제로 맞물린다. 출력축 기어는 늘 돌지만(공회전)
// 슬리브(도그 클러치)가 물린 기어만 출력축을 돌린다. 헬리컬 기어는 맞물리는 쌍끼리 비틀림 방향이 반대.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';
import { aluminum, bronze, castIron, chrome, darkSteel, ghost, paint, plastic, rubber, steel, CATEGORY_COLORS } from '../models/materials';
import { type V2, TAU, lathe, extrude, merge, annularSector } from '../models/parts/geom';
import { buildHelicalGearMesh, buildSpurGearMesh } from '../models/parts/gears';

// ── 치수 ──
const MOD = 0.03; // 모듈(정면)
const CDIST = 0.6; // 축간 거리 = 모듈 × 40 / 2
const Y_MAIN = 1.45;
const Y_CNT = Y_MAIN - CDIST;
const FACE = 0.15;
const HELIX = (26 * Math.PI) / 180;
const SHAFT_R = 0.072;
const CNT_R = 0.062;
const WF = -0.85; // 앞 벽
const WR = 0.66; // 뒤 벽
const H_MAIN_R = 0.6;
const H_CNT_R = 0.47;
const X_IN_GEAR = -0.62;
const Z_IN = 16;
const Z_CM = 24;
const S1_X = -0.14; // 3단/2단 슬리브
const S2_X = 0.495; // 1단 슬리브
const SLEEVE_TRAVEL = 0.065;
const LEVER_X = 0.17;
const RAIL_Y = 1.97;
const RAIL_Z = [-0.07, 0.07] as const; // S1, S2
const FINGER = 0.15;
const IN_RPM = 90;

interface Speed {
  gear: number;
  name: string;
  zc: number;
  zo: number;
  x: number;
  sleeve: 0 | 1;
  dir: -1 | 1; // 슬리브가 움직이는 방향
}
const SPEEDS: Speed[] = [
  { gear: 1, name: '1단', zc: 12, zo: 28, x: 0.3, sleeve: 1, dir: -1 },
  { gear: 2, name: '2단', zc: 17, zo: 23, x: 0.06, sleeve: 0, dir: 1 },
  { gear: 3, name: '3단', zc: 22, zo: 18, x: -0.34, sleeve: 0, dir: -1 }
];
const ratioOf = (s: Speed): number => (Z_CM / Z_IN) * (s.zo / s.zc);

const OUT_ANCHOR = new THREE.Vector3(0.3, Y_MAIN, 0);
const GEAR_ANCHOR = new THREE.Vector3(-0.15, (Y_MAIN + Y_CNT) / 2, 0);

/** X축 방향 회전체: 프로파일 [r, x] */
function latheX(profile: V2[], segs = 40): THREE.BufferGeometry {
  const g = lathe(profile, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function rodX(r: number, x0: number, x1: number, c = 0.006, segs = 32): THREE.BufferGeometry {
  return latheX(
    [
      [0, x0],
      [r - c, x0],
      [r, x0 + c],
      [r, x1 - c],
      [r - c, x1],
      [0, x1]
    ],
    segs
  );
}

function tubeX(rIn: number, rOut: number, x0: number, x1: number, c = 0.005, segs = 40): THREE.BufferGeometry {
  return latheX(
    [
      [rIn + c, x0],
      [rOut - c, x0],
      [rOut, x0 + c],
      [rOut, x1 - c],
      [rOut - c, x1],
      [rIn + c, x1],
      [rIn, x1 - c],
      [rIn, x0 + c],
      [rIn + c, x0]
    ],
    segs
  );
}

/** Shape(sx, sy)를 X축 방향으로 압출: sy → 세계 y, sx → 세계 -z */
function plateX(shape: THREE.Shape, d: number, c = 0.008, curve = 24): THREE.BufferGeometry {
  const g = extrude(shape, d, c, curve, 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** 두 원(위: 주축, 아래: 부축)을 감싸는 하우징 단면 */
function hullShape(rM: number, rC: number): THREE.Shape {
  const psi = Math.asin((rM - rC) / CDIST);
  const s = new THREE.Shape();
  s.absarc(0, Y_MAIN, rM, psi, Math.PI - psi, false);
  s.absarc(0, Y_CNT, rC, Math.PI - psi, TAU + psi, false);
  s.closePath();
  return s;
}

function hullPath(rM: number, rC: number): THREE.Path {
  const psi = Math.asin((rM - rC) / CDIST);
  const p = new THREE.Path();
  p.absarc(0, Y_MAIN, rM, psi, Math.PI - psi, false);
  p.absarc(0, Y_CNT, rC, Math.PI - psi, TAU + psi, false);
  p.closePath();
  return p;
}

/** X축 헬리컬 기어: twist 부호로 비틀림 방향(오른/왼) */
function helicalX(teeth: number, hand: 1 | -1, mat: THREE.Material): THREE.Mesh {
  const rp = (teeth * MOD) / 2;
  const twist = (hand * FACE * Math.tan(HELIX)) / rp;
  const m = buildHelicalGearMesh(teeth, rp + MOD, 2.25 * MOD, FACE, twist);
  (m.material as THREE.Material).dispose();
  m.material = mat;
  m.geometry.rotateY(Math.PI / 2);
  return m;
}

/** 볼 베어링 (X축, 중심 원점) */
function ballBearing(rIn: number, rOut: number, w: number): THREE.BufferGeometry[] {
  const t = (rOut - rIn) * 0.28;
  const races = merge([tubeX(rIn, rIn + t, -w / 2, w / 2, 0.004), tubeX(rOut - t, rOut, -w / 2, w / 2, 0.004)]);
  const ballR = (rOut - rIn - 2 * t) * 0.62;
  const rm = (rIn + rOut) / 2;
  const n = Math.max(8, Math.floor((TAU * rm) / (ballR * 2.6)));
  const balls: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const b = new THREE.SphereGeometry(ballR, 12, 8);
    b.translate(0, Math.cos(a) * rm, Math.sin(a) * rm);
    balls.push(b);
  }
  return [races, merge(balls)];
}

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      const see = (m.material as THREE.Material).transparent === true;
      m.castShadow = !see;
      m.receiveShadow = !see;
    }
  });
}

const smooth = (u: number): number => {
  const k = Math.min(1, Math.max(0, u));
  return k * k * (3 - 2 * k);
};

interface GearRefs {
  input: THREE.Object3D;
  counter: THREE.Object3D;
  outs: THREE.Object3D[]; // SPEEDS 순서
  pairMats: THREE.MeshStandardMaterial[][]; // SPEEDS 순서: [부축 기어, 출력 기어]
  constMats: THREE.MeshStandardMaterial[];
}

export class Gearbox extends BaseMachine {
  readonly id = 'gearbox';
  private inputPivot = new THREE.Group();
  private counterPivot = new THREE.Group();
  private outPivot = new THREE.Group();
  private gearRoot = new THREE.Group();
  private railGroups: THREE.Group[] = [];
  private lever = new THREE.Group();
  private shaftModel: THREE.Group | null = null;
  private gearModel: THREE.Group | null = null;
  private sleeves: THREE.Object3D[] = [];
  private refs: GearRefs | null = null;

  private thIn = 0;
  private thOut = 0;
  private time = 0;
  private sel = 0; // SPEEDS 인덱스
  private outRpm = 0;

  private readonly steelMat = steel();
  private readonly darkMat = darkSteel();
  private readonly aluMat = aluminum();

  constructor() {
    super();
    this.inputPivot.position.set(0, Y_MAIN, 0);
    this.counterPivot.position.set(0, Y_CNT, 0);
    this.outPivot.position.copy(OUT_ANCHOR);
    this.gearRoot.position.copy(GEAR_ANCHOR);
    this.group.add(this.inputPivot, this.counterPivot, this.outPivot, this.gearRoot);

    this.buildStand();
    this.buildHousing();
    this.buildInputSide();
    this.buildCounterShaft();
    this.buildShifter();

    // 슬롯: 출력축 자리(뒤 베어링·출력 플랜지), 기어 자리(주축 위 4곳)
    this.addRingSlot(0, [
      { c: new THREE.Vector3(WR + 0.06, Y_MAIN, 0), r: 0.17 },
      { c: new THREE.Vector3(1.2, Y_MAIN, 0), r: 0.2 }
    ]);
    const mainGears = [{ x: X_IN_GEAR, z: Z_IN }, ...SPEEDS.map((s) => ({ x: s.x, z: s.zo }))];
    this.addRingSlot(
      1,
      mainGears.map((g) => ({ c: new THREE.Vector3(g.x, Y_MAIN, 0), r: (g.z * MOD) / 2 + MOD + 0.02 }))
    );
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) if (s) s.castShadow = s.receiveShadow = false;
    this.applyShift(0, 0, 0, 0);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.shaftModel !== null : this.gearModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? OUT_ANCHOR.clone() : GEAR_ANCHOR.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(WR + 0.06, Y_MAIN, 0) : new THREE.Vector3(0.06, Y_MAIN, 0.2);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildOutputShaft() : this.buildGears();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    if (step === 0) {
      this.outPivot.add(model);
      this.shaftModel = model;
      this.sleeves = [];
      model.traverse((o) => {
        if (o.userData.sleeve !== undefined) this.sleeves[o.userData.sleeve as number] = o;
      });
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.gearRoot.add(model);
      this.gearModel = model;
      this.refs = this.collectRefs(model);
      this.hideSlot(1);
    }
    this.applyShift(0, 0, 0, 0);
  }

  reset(): void {
    if (this.shaftModel) this.outPivot.remove(this.shaftModel);
    if (this.gearModel) this.gearRoot.remove(this.gearModel);
    this.shaftModel = null;
    this.gearModel = null;
    this.sleeves = [];
    this.refs = null;
    this.thIn = 0;
    this.thOut = 0;
    this.time = 0;
    this.sel = 0;
    this.outRpm = 0;
    this.inputPivot.rotation.x = 0;
    this.counterPivot.rotation.x = 0;
    this.outPivot.rotation.x = 0;
    this.showSlot(0);
    this.hideSlot(1);
    this.applyShift(0, 0, 0, 0);
  }

  createSim(): MachineSim {
    if (!this.shaftModel || !this.gearModel || !this.refs) throw new Error('gearbox mission incomplete');
    const wIn = (IN_RPM / 60) * TAU;
    const HOLD = 3.2;
    const SHIFT = 1.0;
    const CYCLE = HOLD + SHIFT;
    this.time = 0;
    this.sel = 0;
    let wOut = wIn / ratioOf(SPEEDS[0]!);
    return {
      update: (dt: number) => {
        this.time += dt;
        const k = Math.floor(this.time / CYCLE);
        const u = this.time - k * CYCLE;
        const from = k % SPEEDS.length;
        const to = (k + 1) % SPEEDS.length;
        this.thIn += wIn * dt;
        let selNow = from;
        let shiftU = 0; // 0: 물림, 0~1: 변속 중
        if (u > HOLD) {
          shiftU = (u - HOLD) / SHIFT;
          if (shiftU > 0.65) selNow = to;
        }
        this.sel = selNow;
        // 출력축 속도: 물려 있으면 그 기어와 같은 속도, 중립 구간에선 새 기어 속도로 동기화
        const wFrom = wIn / ratioOf(SPEEDS[from]!);
        const wTo = wIn / ratioOf(SPEEDS[to]!);
        if (shiftU === 0) wOut = wFrom;
        else wOut = wFrom + (wTo - wFrom) * smooth((shiftU - 0.3) / 0.4);
        this.thOut += wOut * dt;
        this.outRpm = (wOut / TAU) * 60;
        this.spin();
        this.applyShift(from, to, shiftU, 1);
      },
      getDisplay: (): MachineDisplayItem[] => {
        const s = SPEEDS[this.sel]!;
        return [
          { label: '입력 회전수', value: String(IN_RPM), unit: 'rpm', tone: 'blue' },
          { label: '현재 단수 · 기어비', value: `${s.name} · ${ratioOf(s).toFixed(2)} : 1` },
          { label: '출력 회전수', value: this.outRpm.toFixed(0), unit: 'rpm', tone: 'red' }
        ];
      }
    };
  }

  // ── 동작 ──

  /** 맞물림 위상까지 맞춘 회전: 모든 각은 입력축 각에서 잇수비로 계산 */
  private spin(): void {
    const th = this.thIn;
    const thC = -th * (Z_IN / Z_CM);
    this.inputPivot.rotation.x = th;
    this.counterPivot.rotation.x = thC;
    this.outPivot.rotation.x = this.thOut;
    const r = this.refs;
    if (!r) return;
    r.input.rotation.x = th;
    r.counter.rotation.x = thC;
    SPEEDS.forEach((s, i) => {
      r.outs[i]!.rotation.x = -thC * (s.zc / s.zo);
    });
  }

  /** 슬리브·포크·레버 위치와 기어 강조. from→to 변속 진행도 u (0이면 from에 물림) */
  private applyShift(from: number, to: number, u: number, highlight: number): void {
    const engagedOffset = (idx: number): [number, number] => {
      const s = SPEEDS[idx]!;
      const o: [number, number] = [0, 0];
      o[s.sleeve] = s.dir * SLEEVE_TRAVEL;
      return o;
    };
    const ready = this.shaftModel !== null && this.gearModel !== null && highlight > 0;
    let off: [number, number] = [0, 0];
    let selZ = 0;
    if (ready) {
      const a = engagedOffset(from);
      const b = engagedOffset(to);
      const zA = RAIL_Z[SPEEDS[from]!.sleeve];
      const zB = RAIL_Z[SPEEDS[to]!.sleeve];
      if (u <= 0) {
        off = a;
        selZ = zA;
      } else if (u < 0.3) {
        const k = 1 - smooth(u / 0.3);
        off = [a[0] * k, a[1] * k];
        selZ = zA;
      } else if (u < 0.65) {
        const k = smooth((u - 0.3) / 0.35);
        selZ = zA + (zB - zA) * k;
      } else {
        const k = smooth((u - 0.65) / 0.35);
        off = [b[0] * k, b[1] * k];
        selZ = zB;
      }
    }
    this.railGroups.forEach((g, i) => (g.position.x = off[i]!));
    if (this.sleeves[0]) this.sleeves[0].position.x = S1_X - OUT_ANCHOR.x + off[0];
    if (this.sleeves[1]) this.sleeves[1].position.x = S2_X - OUT_ANCHOR.x + off[1];
    // 레버: 손가락 끝(피벗 아래 FINGER)이 선택한 레일의 홈을 따라간다
    const dx = off[0] + off[1];
    const rz = Math.asin(dx / FINGER);
    const rx = Math.asin(-selZ / (FINGER * Math.cos(rz)));
    this.lever.rotation.set(rx, 0, rz);

    // 기어 강조: 동력이 지나는 쌍
    const r = this.refs;
    if (!r) return;
    const amt = (idx: number): number => {
      if (!ready) return 0;
      if (u <= 0) return idx === from ? 1 : 0;
      if (idx === from) return 1 - smooth(u / 0.3);
      if (idx === to) return smooth((u - 0.65) / 0.35);
      return 0;
    };
    r.pairMats.forEach((mats, i) => {
      const k = amt(i);
      for (const m of mats) m.emissiveIntensity = 0.55 * k;
    });
    for (const m of r.constMats) m.emissiveIntensity = ready ? 0.14 : 0;
  }

  private collectRefs(model: THREE.Group): GearRefs {
    let input: THREE.Object3D | null = null;
    let counter: THREE.Object3D | null = null;
    const outs: THREE.Object3D[] = [];
    const pairMats: THREE.MeshStandardMaterial[][] = SPEEDS.map(() => []);
    const constMats: THREE.MeshStandardMaterial[] = [];
    model.traverse((o) => {
      const role = o.userData.role as string | undefined;
      if (role === 'input') input = o;
      else if (role === 'counter') counter = o;
      else if (role === 'out') outs[o.userData.idx as number] = o;
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.pair !== undefined) {
        const mat = m.material as THREE.MeshStandardMaterial;
        const p = m.userData.pair as number;
        if (p < 0) constMats.push(mat);
        else pairMats[p]!.push(mat);
      }
    });
    if (!input || !counter) throw new Error('gear model incomplete');
    return { input, counter, outs, pairMats, constMats };
  }

  // ── 미션 부품 ──

  /** 출력축(스플라인) + 싱크로 허브·슬리브 + 출력 플랜지. 원점 = OUT_ANCHOR */
  private buildOutputShaft(): THREE.Group {
    const g = new THREE.Group();
    const ax = OUT_ANCHOR.x;
    const x0 = -0.52;
    const x1 = 1.16;
    // 스플라인 단면: 원 + 이 16개
    const N = 16;
    const pts: V2[] = [];
    for (let i = 0; i < N * 8; i++) {
      const a = (i / (N * 8)) * TAU;
      const u = ((a / TAU) * N) % 1;
      const r = u > 0.25 && u < 0.75 ? SHAFT_R + 0.006 : SHAFT_R - 0.008;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const spline = new THREE.Shape();
    pts.forEach(([x, y], i) => (i === 0 ? spline.moveTo(x, y) : spline.lineTo(x, y)));
    spline.closePath();
    const shaftMat = steel({ color: 0xc9d2dc });
    // 매끈한 축(기어가 공회전하는 저널) + 스플라인 구간(싱크로 허브 자리, 출력 플랜지 쪽)
    const geos: THREE.BufferGeometry[] = [rodX(SHAFT_R - 0.002, x0 - ax, x1 - ax, 0.006, 32)];
    for (const [sa, sb] of [
      [S1_X - 0.07, S1_X + 0.07],
      [S2_X - 0.07, S2_X + 0.07],
      [WR + 0.08, 1.07]
    ] as const) {
      const sg = plateX(spline, sb - sa, 0.004, 4);
      sg.translate((sa + sb) / 2 - ax, 0, 0);
      geos.push(sg);
    }
    g.add(new THREE.Mesh(merge(geos), shaftMat));
    // 축용 강조색 띠(저널 칼라)
    const collar = new THREE.Mesh(tubeX(SHAFT_R - 0.002, SHAFT_R + 0.02, 0.69 - ax, 0.72 - ax, 0.004), paint(CATEGORY_COLORS.shaft, { roughness: 0.35 }));
    g.add(collar);

    // 싱크로 허브(축에 고정) + 슬리브(미끄럼)
    const hubGeo = tubeX(SHAFT_R + 0.004, 0.093, -0.03, 0.03, 0.004);
    const sleeveGeo = latheX(
      [
        [0.093, -0.05],
        [0.124, -0.05],
        [0.13, -0.044],
        [0.13, -0.016],
        [0.11, -0.014],
        [0.11, 0.014],
        [0.13, 0.016],
        [0.13, 0.044],
        [0.124, 0.05],
        [0.093, 0.05],
        [0.093, -0.05]
      ],
      48
    );
    const sleeveMat = steel({ color: 0xa9b2bc, roughness: 0.3 });
    [S1_X, S2_X].forEach((x, i) => {
      const hub = new THREE.Mesh(hubGeo, this.darkMat);
      hub.position.x = x - ax;
      g.add(hub);
      const sl = new THREE.Mesh(sleeveGeo, sleeveMat);
      sl.position.x = x - ax;
      sl.userData.sleeve = i;
      g.add(sl);
    });

    // 출력 플랜지(요크) + 회전 표시
    const flange = new THREE.Mesh(
      latheX([
        [0, 1.13 - ax],
        [0.09, 1.13 - ax],
        [0.1, 1.15 - ax],
        [0.165, 1.16 - ax],
        [0.17, 1.165 - ax],
        [0.17, 1.2 - ax],
        [0.164, 1.206 - ax],
        [0, 1.206 - ax]
      ], 56),
      this.darkMat
    );
    g.add(flange);
    const boltGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const b = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6);
      b.rotateZ(Math.PI / 2);
      b.translate(1.218 - ax, Math.cos(a) * 0.12, Math.sin(a) * 0.12);
      boltGeos.push(b);
    }
    g.add(new THREE.Mesh(merge(boltGeos), this.steelMat));
    const mark = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.08, 0.03, 1, 0.004), plastic(0xf4f4f4, { grain: false }));
    mark.position.set(1.212 - ax, 0.06, 0);
    g.add(mark);
    return g;
  }

  /** 헬리컬 기어 8개(상시 물림 1쌍 + 단수 3쌍). 원점 = GEAR_ANCHOR */
  private buildGears(): THREE.Group {
    const g = new THREE.Group();
    const a = GEAR_ANCHOR;
    const gearMat = (): THREE.MeshStandardMaterial => {
      const m = steel({ color: 0xc4ccd5, roughness: 0.28 });
      m.emissive.setHex(CATEGORY_COLORS.power);
      m.emissiveIntensity = 0;
      return m;
    };
    const hubGeo = (rIn: number, rOut: number): THREE.BufferGeometry => tubeX(rIn, rOut, -FACE / 2 - 0.03, FACE / 2 + 0.03, 0.006);
    const bushMat = bronze();
    const dogGeo = (): THREE.BufferGeometry => {
      const d = buildSpurGearMesh(18, 0.106, 0.014, 0.034);
      (d.material as THREE.Material).dispose();
      const geo = d.geometry;
      geo.rotateY(Math.PI / 2);
      return geo;
    };
    const dogMat = darkSteel({ color: 0x7a838d });

    // 입력 기어(오른 비틀림) — 주축 위 기어 위상: -π/2 - π/N
    const inG = new THREE.Group();
    inG.position.set(X_IN_GEAR - a.x, Y_MAIN - a.y, 0);
    inG.userData.role = 'input';
    const inMesh = helicalX(Z_IN, 1, gearMat());
    inMesh.rotation.x = -Math.PI / 2 - Math.PI / Z_IN;
    inMesh.userData.pair = -1;
    inG.add(inMesh);
    inG.add(new THREE.Mesh(hubGeo(SHAFT_R - 0.01, 0.11), this.darkMat));
    g.add(inG);

    // 부축 기어 묶음(왼 비틀림) — 부축 기어 위상: π/2
    const cnt = new THREE.Group();
    cnt.position.set(-a.x, Y_CNT - a.y, 0);
    cnt.userData.role = 'counter';
    const cGears: { x: number; z: number; pair: number }[] = [
      { x: X_IN_GEAR, z: Z_CM, pair: -1 },
      ...SPEEDS.map((s, i) => ({ x: s.x, z: s.zc, pair: i }))
    ];
    for (const cg of cGears) {
      const m = helicalX(cg.z, -1, gearMat());
      m.rotation.x = Math.PI / 2;
      m.position.x = cg.x;
      m.userData.pair = cg.pair;
      cnt.add(m);
      const hub = new THREE.Mesh(hubGeo(CNT_R - 0.004, Math.min(0.1, (cg.z * MOD) / 2 - 0.06)), this.darkMat);
      hub.position.x = cg.x;
      cnt.add(hub);
    }
    g.add(cnt);

    // 출력축 기어(오른 비틀림, 출력축 위에서 공회전) + 도그 링(슬리브 쪽)
    SPEEDS.forEach((s, i) => {
      const og = new THREE.Group();
      og.position.set(s.x - a.x, Y_MAIN - a.y, 0);
      og.userData.role = 'out';
      og.userData.idx = i;
      const m = helicalX(s.zo, 1, gearMat());
      m.rotation.x = -Math.PI / 2 - Math.PI / s.zo;
      m.userData.pair = i;
      og.add(m);
      og.add(new THREE.Mesh(tubeX(SHAFT_R - 0.001, SHAFT_R + 0.014, -FACE / 2 - 0.004, FACE / 2 + 0.004, 0.003), bushMat));
      // 도그 링은 슬리브가 다가오는 쪽 면에
      const side = -s.dir;
      const dog = new THREE.Mesh(dogGeo(), dogMat);
      dog.position.x = side * (FACE / 2 + 0.017);
      og.add(dog);
      g.add(og);
    });
    return g;
  }

  // ── 고정 구조 ──

  private addRingSlot(step: number, rings: { c: THREE.Vector3; r: number }[]): void {
    const geos = rings.map(({ c, r }) => {
      const t = new THREE.TorusGeometry(r, 0.022, 10, 56);
      t.rotateY(Math.PI / 2);
      t.translate(c.x, c.y, c.z);
      return t;
    });
    const ring = new THREE.Mesh(
      merge(geos),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.userData.slot = true;
    ring.userData.noAO = true;
    this.slots[step] = ring;
    this.group.add(ring);
  }

  private buildStand(): void {
    const baseMat = paint(0x2d5f8f, { roughness: 0.4 });
    const base = new THREE.Mesh(new RoundedBoxGeometry(3.3, 0.07, 1.6, 3, 0.03), baseMat);
    base.position.set(-0.2, 0.035, 0);
    this.group.add(base);
    // 하우징 밑면 곡률을 따르는 받침(새들) 2개
    const zS = 0.3;
    const yS = Y_CNT - Math.sqrt(H_CNT_R * H_CNT_R - zS * zS);
    const aS = Math.atan2(yS - Y_CNT, zS);
    const saddle = new THREE.Shape();
    saddle.moveTo(-zS - 0.06, 0.07);
    saddle.lineTo(zS + 0.06, 0.07);
    saddle.lineTo(zS + 0.06, yS);
    saddle.lineTo(zS, yS);
    saddle.absarc(0, Y_CNT, H_CNT_R, aS, -Math.PI - aS, true);
    saddle.lineTo(-zS - 0.06, yS);
    saddle.closePath();
    const sGeo = plateX(saddle, 0.12, 0.012, 32);
    for (const x of [-0.55, 0.4]) {
      const s = new THREE.Mesh(sGeo, baseMat);
      s.position.x = x;
      this.group.add(s);
    }
    // 엔진 뒷면(플라이휠이 달린 크랭크 끝을 받치는 판)
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.05, 2.05, 1.3, 3, 0.02), castIron());
    plate.position.set(-1.66, 0.07 + 2.05 / 2, 0);
    this.group.add(plate);
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.06, 1.3, 2, 0.02), baseMat);
    foot.position.set(-1.62, 0.1, 0);
    this.group.add(foot);
    const boss = new THREE.Mesh(tubeX(0.08, 0.16, -1.66, -1.6, 0.008), castIron());
    boss.position.y = Y_MAIN;
    this.group.add(boss);
  }

  private buildHousing(): void {
    const len = WR - WF;
    const caseGeo = plateX(hullShape(H_MAIN_R, H_CNT_R), len, 0.02, 48);
    caseGeo.translate((WF + WR) / 2, 0, 0);
    const caseMat = ghost(0x6f879d, 0.32);
    const housing = new THREE.Mesh(caseGeo, caseMat);
    housing.renderOrder = 2;
    this.group.add(housing);
    // 하우징 윤곽 리브(반투명 면만으로는 형태가 흐려서 길이 방향 모서리를 둔다)
    const ribGeos: THREE.BufferGeometry[] = [];
    const psi0 = Math.asin((H_MAIN_R - H_CNT_R) / CDIST);
    const ribAt = (y: number, z: number): void => {
      const r = rodX(0.011, WF, WR, 0.003, 10);
      r.translate(0, y, z);
      ribGeos.push(r);
    };
    ribAt(Y_MAIN + H_MAIN_R, 0);
    ribAt(Y_CNT - H_CNT_R, 0);
    for (const sz of [-1, 1]) {
      ribAt(Y_MAIN + Math.sin(psi0) * H_MAIN_R, sz * Math.cos(psi0) * H_MAIN_R);
      ribAt(Y_CNT + Math.sin(psi0) * H_CNT_R, sz * Math.cos(psi0) * H_CNT_R);
    }
    this.group.add(new THREE.Mesh(merge(ribGeos), this.aluMat));

    // 앞·뒤 플랜지 테(불투명) + 볼트
    const frame = hullShape(H_MAIN_R + 0.015, H_CNT_R + 0.015);
    frame.holes.push(hullPath(H_MAIN_R - 0.03, H_CNT_R - 0.03));
    const frameGeo = plateX(frame, 0.035, 0.008, 48);
    const boltGeos: THREE.BufferGeometry[] = [];
    const psi = Math.asin((H_MAIN_R - H_CNT_R) / CDIST);
    const boltAt = (y: number, z: number, x: number): void => {
      const b = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 6);
      b.rotateZ(Math.PI / 2);
      b.translate(x, y, z);
      boltGeos.push(b);
    };
    for (const [x, sx] of [
      [WF, -1],
      [WR, 1]
    ] as const) {
      const f = new THREE.Mesh(frameGeo, this.aluMat);
      f.position.x = x;
      this.group.add(f);
      const bx = x + sx * 0.026;
      for (let i = 0; i < 7; i++) {
        const a = psi + ((Math.PI - 2 * psi) * (i + 0.5)) / 7;
        boltAt(Y_MAIN + Math.sin(a) * (H_MAIN_R - 0.008), -Math.cos(a) * (H_MAIN_R - 0.008), bx);
      }
      for (let i = 0; i < 5; i++) {
        const a = Math.PI - psi + ((Math.PI + 2 * psi) * (i + 0.5)) / 5;
        boltAt(Y_CNT + Math.sin(a) * (H_CNT_R - 0.008), -Math.cos(a) * (H_CNT_R - 0.008), bx);
      }
    }
    this.group.add(new THREE.Mesh(merge(boltGeos), this.steelMat));

    // 베어링(앞·뒤 벽, 주축·부축)
    const bearingMat = chrome();
    const raceMat = this.steelMat;
    const boss = (y: number, r: number, x: number): void => {
      const b = new THREE.Mesh(tubeX(r, r + 0.035, x - 0.04, x + 0.04, 0.006), this.aluMat);
      b.position.y = y;
      this.group.add(b);
    };
    for (const x of [WF, WR]) {
      const [rM, bM] = ballBearing(SHAFT_R - 0.004, 0.135, 0.06);
      const [rC, bC] = ballBearing(CNT_R - 0.002, 0.118, 0.055);
      const m1 = new THREE.Mesh(rM, raceMat);
      const m2 = new THREE.Mesh(bM, bearingMat);
      m1.position.set(x, Y_MAIN, 0);
      m2.position.set(x, Y_MAIN, 0);
      const m3 = new THREE.Mesh(rC, raceMat);
      const m4 = new THREE.Mesh(bC, bearingMat);
      m3.position.set(x, Y_CNT, 0);
      m4.position.set(x, Y_CNT, 0);
      this.group.add(m1, m2, m3, m4);
      boss(Y_MAIN, 0.135, x);
      boss(Y_CNT, 0.118, x);
    }

    // 클러치 하우징(벨 하우징, 반투명) + 앞 테
    const bell = new THREE.Mesh(
      latheX([
        [H_MAIN_R - 0.02, WF - 0.02],
        [0.66, WF - 0.12],
        [0.72, -1.5],
        [0.72, -1.6]
      ], 64),
      ghost(0x7d93a8, 0.22)
    );
    bell.position.y = Y_MAIN;
    bell.renderOrder = 2;
    this.group.add(bell);
    const bellRing = new THREE.Mesh(tubeX(0.7, 0.76, -1.63, -1.6, 0.006, 72), this.aluMat);
    bellRing.position.y = Y_MAIN;
    this.group.add(bellRing);
    const bellRing2 = new THREE.Mesh(tubeX(0.6, 0.64, WF - 0.05, WF - 0.02, 0.006, 64), this.aluMat);
    bellRing2.position.y = Y_MAIN;
    this.group.add(bellRing2);

    // 연장 하우징(뒤, 반투명) + 오일 실
    const ext = new THREE.Mesh(
      latheX([
        [0.2, WR + 0.02],
        [0.17, WR + 0.18],
        [0.13, 1.06],
        [0.13, 1.1]
      ], 48),
      ghost(0x7d93a8, 0.26)
    );
    ext.position.y = Y_MAIN;
    ext.renderOrder = 2;
    this.group.add(ext);
    const seal = new THREE.Mesh(tubeX(SHAFT_R - 0.01, 0.14, 1.08, 1.12, 0.006), rubber());
    seal.position.y = Y_MAIN;
    this.group.add(seal);
    const extRing = new THREE.Mesh(tubeX(0.19, 0.22, WR + 0.02, WR + 0.05, 0.006), this.aluMat);
    extRing.position.y = Y_MAIN;
    this.group.add(extRing);
  }

  /** 엔진 쪽: 크랭크 끝·플라이휠·클러치 판·압력판·입력축 (모두 입력축과 함께 돈다) */
  private buildInputSide(): void {
    const p = this.inputPivot;
    p.add(new THREE.Mesh(rodX(0.08, -1.6, -1.52, 0.008, 40), this.steelMat));
    // 플라이휠 + 링 기어
    const ring = buildSpurGearMesh(120, 0.6, 0.016, 0.05);
    (ring.material as THREE.Material).dispose();
    ring.material = darkSteel();
    ring.geometry.rotateY(Math.PI / 2);
    ring.position.x = -1.5;
    p.add(ring);
    p.add(
      new THREE.Mesh(
        latheX([
          [0.06, -1.54],
          [0.56, -1.54],
          [0.575, -1.53],
          [0.575, -1.46],
          [0.56, -1.45],
          [0.06, -1.45]
        ], 72),
        castIron()
      )
    );
    // 클러치 판(마찰재) + 댐퍼 스프링
    p.add(new THREE.Mesh(tubeX(0.24, 0.44, -1.445, -1.42, 0.004, 64), rubber({ color: 0x5a4632 })));
    p.add(new THREE.Mesh(tubeX(0.08, 0.25, -1.44, -1.425, 0.003, 48), this.steelMat));
    p.add(new THREE.Mesh(tubeX(SHAFT_R, 0.1, -1.47, -1.39, 0.005, 32), this.darkMat));
    const springGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const s = new THREE.CylinderGeometry(0.022, 0.022, 0.08, 12);
      s.rotateX(Math.PI / 2);
      s.rotateX(a);
      s.translate(-1.432, Math.cos(a + Math.PI / 2) * 0.16, Math.sin(a + Math.PI / 2) * 0.16);
      springGeos.push(s);
    }
    p.add(new THREE.Mesh(merge(springGeos), steel({ color: 0x7fb3e6 })));
    // 압력판 + 다이어프램 스프링 + 커버
    p.add(new THREE.Mesh(tubeX(0.22, 0.46, -1.415, -1.375, 0.005, 64), this.steelMat));
    p.add(
      new THREE.Mesh(
        latheX([
          [0.12, -1.3],
          [0.42, -1.36],
          [0.43, -1.35],
          [0.13, -1.29]
        ], 48),
        darkSteel({ color: 0x6d7782 })
      )
    );
    p.add(new THREE.Mesh(tubeX(0.47, 0.53, -1.45, -1.33, 0.006, 72), this.darkMat));
    // 입력축: 클러치 스플라인 ~ 입력 기어 ~ 파일럿
    p.add(new THREE.Mesh(rodX(SHAFT_R, -1.52, -0.53, 0.006, 32), steel({ color: 0xc9d2dc })));
    // 릴리스 베어링 가이드(고정) — 회전체가 아니므로 group에 바로
    const guide = new THREE.Mesh(tubeX(SHAFT_R + 0.01, 0.1, -1.22, WF - 0.02, 0.006), this.aluMat);
    guide.position.y = Y_MAIN;
    this.group.add(guide);
    const rel = new THREE.Mesh(tubeX(0.1, 0.15, -1.27, -1.22, 0.006), this.darkMat);
    rel.position.y = Y_MAIN;
    this.group.add(rel);
  }

  private buildCounterShaft(): void {
    const c = this.counterPivot;
    c.add(new THREE.Mesh(rodX(CNT_R, WF - 0.05, WR + 0.05, 0.006, 32), steel({ color: 0xc9d2dc })));
  }

  private buildShifter(): void {
    // 시프트 레일 2개(포크와 함께 미끄러짐)
    const railMat = this.steelMat;
    const forkMat = bronze({ color: 0xc08a45 });
    const forkRing = annularSector(0.112, 0.158, 0.35, Math.PI - 0.35);
    const forkGeo = plateX(forkRing, 0.026, 0.005, 24);
    [S1_X, S2_X].forEach((sx, i) => {
      const rg = new THREE.Group();
      const z = RAIL_Z[i]!;
      const rail = new THREE.Mesh(rodX(0.018, WF - 0.04, WR + 0.04, 0.004, 20), railMat);
      rail.position.set(0, RAIL_Y, z);
      rg.add(rail);
      const fork = new THREE.Mesh(forkGeo, forkMat);
      fork.position.set(sx, Y_MAIN, 0);
      rg.add(fork);
      // 포크 팔: 반원 위쪽에서 레일까지
      const yBot = Y_MAIN + Math.sqrt(0.14 * 0.14 - z * z) - 0.01;
      const armH = RAIL_Y - yBot;
      const arm = new THREE.Mesh(new RoundedBoxGeometry(0.026, armH, 0.045, 2, 0.008), forkMat);
      arm.position.set(sx, yBot + armH / 2, z);
      rg.add(arm);
      const clamp = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.06, 0.06, 2, 0.012), forkMat);
      clamp.position.set(sx, RAIL_Y, z);
      rg.add(clamp);
      // 레버 손가락이 들어가는 홈 블록
      const notchShape = new THREE.Shape();
      notchShape.moveTo(-0.035, -0.03);
      notchShape.lineTo(0.035, -0.03);
      notchShape.lineTo(0.035, 0.03);
      notchShape.lineTo(0.012, 0.03);
      notchShape.lineTo(0.012, 0.0);
      notchShape.lineTo(-0.012, 0.0);
      notchShape.lineTo(-0.012, 0.03);
      notchShape.lineTo(-0.035, 0.03);
      notchShape.closePath();
      const notchGeo = extrude(notchShape, 0.05, 0.004, 4);
      const notch = new THREE.Mesh(notchGeo, this.darkMat);
      notch.position.set(LEVER_X, RAIL_Y + 0.005, z);
      rg.add(notch);
      this.group.add(rg);
      this.railGroups.push(rg);
    });

    // 레버 탑(하우징 위) + 레버
    const towerY = Y_MAIN + H_MAIN_R;
    const tower = new THREE.Mesh(
      lathe([
        [0, towerY - 0.02],
        [0.16, towerY - 0.02],
        [0.16, towerY + 0.02],
        [0.11, towerY + 0.07],
        [0.06, towerY + 0.08],
        [0, towerY + 0.08]
      ], 40),
      this.aluMat
    );
    tower.position.x = LEVER_X;
    this.group.add(tower);
    const pivotY = towerY + 0.07;
    this.lever.position.set(LEVER_X, pivotY, 0);
    this.group.add(this.lever);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 16), this.steelMat);
    this.lever.add(ball);
    const stick = new THREE.Mesh(rodX(0.016, 0, 0.62, 0.004, 16), chrome());
    stick.rotation.z = Math.PI / 2;
    this.lever.add(stick);
    const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, FINGER, 12), this.steelMat);
    finger.position.y = -FINGER / 2;
    this.lever.add(finger);
    const boot = new THREE.Mesh(
      lathe([
        [0, 0.02],
        [0.075, 0.02],
        [0.05, 0.1],
        [0.022, 0.18],
        [0, 0.18]
      ], 24),
      rubber()
    );
    this.lever.add(boot);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 20), plastic(0x23262b, { roughness: 0.35, grain: false }));
    knob.position.y = 0.64;
    this.lever.add(knob);
  }
}
