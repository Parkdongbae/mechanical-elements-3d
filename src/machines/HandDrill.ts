// 핸드 드릴: 베벨 기어와 전동축 미션 — 스탠드에 물린 달걀 거품기형 수동 드릴
// 크랭크 휠(큰 베벨 기어, 40잇)이 X축으로 돌면 직각으로 맞물린 피니언(10잇)이 Y축으로 4배 빠르게 돌고,
// 피니언 → 주축(전동축) → 척 → 드릴 날로 회전이 내려간다.
// 두 베벨 기어는 원뿔 꼭짓점을 공유한다(축 교점 = (0, WHEEL_Y, 0)): 휠 피치원 반지름 = 피니언 꼭짓점 거리,
// 피니언 피치원 반지름 = 휠 꼭짓점 거리 — 그래서 휠 면은 x = R_PIN, 피니언은 y = WHEEL_Y - R_WHEEL 에서 맞물린다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';
import { CATEGORY_COLORS, castIron, chrome, darkSteel, paint, steel, wood } from '../models/materials';
import { involuteOutline } from '../models/parts/gears';
import { type V2, TAU, circlePts, creased, merge, lathe, loft, radialSurface, extrude, hexPrism, kidneyPath } from '../models/parts/geom';

// ── 기어 ──
const N_WHEEL = 40;
const N_PIN = 10;
const R_WHEEL = 0.5; // 피치원 반지름 (큰 끝)
const R_PIN = (R_WHEEL * N_PIN) / N_WHEEL; // 0.125 — 같은 모듈
const D_WHEEL = Math.atan2(R_WHEEL, R_PIN); // 휠 피치 원뿔 반각 ≈ 76°
const D_PIN = Math.PI / 2 - D_WHEEL; // ≈ 14°
const FACE = 0.11;
const HOLE_DEPTH = 0.06;
const CRANK_RPM = 60;

// ── 세로 배치 (y) ──
const WHEEL_Y = 2.2; // 휠 축 높이 = 두 축의 교점
const BASE_T = 0.09;
const WOOD_TOP = 0.37;
const BIT_TIP = 0.345;
const BIT_LEN = 0.56;
const CHUCK_Y0 = 0.84; // 척 코 끝
const CHUCK_Y1 = 1.13;
const LBOSS_Y0 = 1.18;
const LBOSS_Y1 = 1.28;
const UBOSS_Y0 = 1.52;
const UBOSS_Y1 = 1.6;
const SPINDLE_R = 0.026;
const SPINDLE_ANCHOR = new THREE.Vector3(0, 1.42, 0);
const SPINE_X = -0.22;
const TOP_Y = 2.95;
const COLUMN_X = -0.86;

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

/** 단순 메시 생성 + 부모 추가 */
function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** (r, y) 관 단면 — 바깥/안 모서리 모따기 */
function ringProfile(rIn: number, rOut: number, y0: number, y1: number, c = 0.008): V2[] {
  return [
    [rIn, y0 + c],
    [rIn + c, y0],
    [rOut - c, y0],
    [rOut, y0 + c],
    [rOut, y1 - c],
    [rOut - c, y1],
    [rIn + c, y1],
    [rIn, y1 - c],
    [rIn, y0 + c]
  ];
}

/** Y축 회전체를 X축 방향으로 눕힘 */
function toX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.rotateZ(-Math.PI / 2);
  return g;
}

/**
 * 원뿔 베벨 기어 — 꼭짓점이 원점, 축 = +Z(본체 쪽).
 * 큰 끝 단면(배원뿔)의 인벌류트 치형을 꼭짓점을 향해 비례 축소하며 원뿔 위에 감는다:
 * 이 높이 방향은 원뿔 면의 법선이므로 피치 원뿔끼리 접하는 두 기어의 이가 실제로 맞물린다.
 */
function bevelGearGeo(N: number, R: number, delta: number, face: number, holeDepth: number, phase: number): THREE.BufferGeometry {
  const m = (2 * R) / N;
  const ccw = (ring: V2[]): V2[] =>
    THREE.ShapeUtils.isClockWise(ring.map(([x, y]) => new THREE.Vector2(x, y))) ? [...ring].reverse() : ring;
  const outline = ccw(involuteOutline(N, R + m, R - 1.25 * m, phase));
  const hole = ccw(circlePts(R - holeDepth, Math.max(64, N * 4)));
  const A = R / Math.sin(delta);
  const k0 = (A - face) / A;
  const sd = Math.sin(delta);
  const cd = Math.cos(delta);
  const map = (p: V2, k: number): THREE.Vector3 => {
    const rho = Math.hypot(p[0], p[1]);
    const c = p[0] / rho;
    const s = p[1] / rho;
    const h = rho - R;
    const rr = A * sd + h * cd;
    const zz = A * cd - h * sd;
    return new THREE.Vector3(k * rr * c, k * rr * s, k * zz);
  };
  const parts: THREE.BufferGeometry[] = [];
  const wall = (ring: V2[], isHole: boolean): void => {
    const n = ring.length;
    const pos: number[] = [];
    for (const k of [k0, 1]) {
      for (const p of ring) {
        const v = map(p, k);
        pos.push(v.x, v.y, v.z);
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      if (isHole) idx.push(i, n + i1, i1, i, n + i, n + i1);
      else idx.push(i, i1, n + i1, i, n + i1, n + i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    parts.push(g);
  };
  wall(outline, false);
  wall(hole, true);
  const faces = THREE.ShapeUtils.triangulateShape(
    outline.map(([x, y]) => new THREE.Vector2(x, y)),
    [hole.map(([x, y]) => new THREE.Vector2(x, y))]
  );
  const flat = [...outline, ...hole];
  for (const [k, sign] of [
    [k0, -1],
    [1, 1]
  ] as const) {
    const cp: number[] = [];
    for (const f of faces) {
      const tri = f.map((i) => map(flat[i]!, k));
      const a = tri[0]!;
      const b = tri[1]!;
      const c = tri[2]!;
      const nrm = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
      const cen = a.clone().add(b).add(c);
      // 큰 끝 면은 꼭짓점 반대쪽, 작은 끝 면은 꼭짓점 쪽을 향한다
      if (nrm.dot(cen) * sign < 0) tri.reverse();
      for (const v of tri) cp.push(v.x, v.y, v.z);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    parts.push(cap);
  }
  return creased(merge(parts), 30);
}

/** 두 갈래 나선 홈 드릴 날(축 = +Y, y=0이 날 끝) */
function twistDrillGeo(R: number, flute: number, total: number): THREE.BufferGeometry {
  const n = 72;
  const outline: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const f = Math.sin(a) ** 2;
    const r = R * (1 - 0.62 * f * f);
    outline.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const lead = 0.2;
  const tipLen = R * 0.62; // 118° 날끝
  const layers: { z: number; s: number; rot: number }[] = [];
  const zs: number[] = [0, tipLen * 0.25, tipLen * 0.55, tipLen];
  for (let z = tipLen + 0.012; z < flute; z += 0.012) zs.push(z);
  zs.push(flute);
  for (const z of zs) {
    const s = z < tipLen ? Math.max(0.04, z / tipLen) : 1;
    layers.push({ z, s, rot: (z / lead) * TAU });
  }
  const body = loft(outline, [], layers, 40);
  const shank = lathe(
    [
      [0, flute - 0.01],
      [R * 0.98, flute - 0.01],
      [R * 0.98, total - 0.006],
      [R * 0.98 - 0.006, total],
      [0, total]
    ],
    32
  );
  // loft 축 Z → Y
  body.rotateX(-Math.PI / 2);
  return merge([body, shank]);
}

/** 시드 고정 난수(톱밥 배치가 매번 같게) */
function rand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class HandDrill extends BaseMachine {
  readonly id = 'handdrill';
  private wheelPivot = new THREE.Group();
  private spin = new THREE.Group(); // 주축 회전(척·날·피니언·주축)
  private pinionMount = new THREE.Group();
  private spindleMount = new THREE.Group();
  private gearModel: THREE.Group | null = null;
  private wheelPart: THREE.Object3D | null = null;
  private pinionPart: THREE.Object3D | null = null;
  private spindleModel: THREE.Group | null = null;
  private chips: THREE.InstancedMesh | null = null;
  private chipBase: THREE.Matrix4[] = [];
  private crankAngle = 0;
  private drillTime = 0;

  private readonly frameMat = paint(0x2b3036, { roughness: 0.4 });
  private readonly steelMat = steel();
  private readonly woodMat = wood(0xb4794a);
  private readonly standMat = paint(0x46525e, { roughness: 0.5 });

  constructor() {
    super();
    this.wheelPivot.position.set(0, WHEEL_Y, 0);
    this.group.add(this.wheelPivot, this.spin);
    this.pinionMount.position.set(0, WHEEL_Y, 0);
    this.spindleMount.position.copy(SPINDLE_ANCHOR);
    this.spin.add(this.pinionMount, this.spindleMount);

    this.buildStand();
    this.buildFrame();
    this.buildChuckAndBit();
    this.buildWorkpiece();

    this.addSlot(0, 0.58, new THREE.Vector3(0.14, WHEEL_Y, 0), 0.024);
    this.slots[0]!.rotation.y = Math.PI / 2;
    this.addSlot(1, 0.085, new THREE.Vector3(0, (LBOSS_Y1 + UBOSS_Y0) / 2, 0), 0.016);
    this.slots[1]!.rotation.x = Math.PI / 2;
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = s.receiveShadow = false;
    }
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.gearModel !== null : this.spindleModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, WHEEL_Y, 0) : SPINDLE_ANCHOR.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0.14, WHEEL_Y, 0) : new THREE.Vector3(0, (LBOSS_Y1 + UBOSS_Y0) / 2, 0);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildGears() : this.buildSpindle();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      this.gearModel = model;
      const wheel = model.getObjectByName('wheel');
      const pinion = model.getObjectByName('pinion');
      if (wheel) {
        this.wheelPivot.add(wheel);
        this.wheelPart = wheel;
      }
      if (pinion) {
        this.pinionMount.add(pinion);
        this.pinionPart = pinion;
      }
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.spindleMount.add(model);
      this.spindleModel = model;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.wheelPart) this.wheelPivot.remove(this.wheelPart);
    if (this.pinionPart) this.pinionMount.remove(this.pinionPart);
    if (this.spindleModel) this.spindleMount.remove(this.spindleModel);
    this.wheelPart = this.pinionPart = null;
    this.gearModel = this.spindleModel = null;
    this.crankAngle = 0;
    this.drillTime = 0;
    this.wheelPivot.rotation.x = 0;
    this.spin.rotation.y = 0;
    this.updateChips();
    if (this.chips) this.chips.visible = false;
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.gearModel || !this.spindleModel) throw new Error('handdrill mission incomplete');
    const ratio = N_WHEEL / N_PIN;
    const w = (CRANK_RPM / 60) * TAU;
    const display: MachineDisplayItem[] = [
      { label: '손잡이 회전수', value: String(CRANK_RPM), unit: 'rpm', tone: 'blue' },
      { label: '드릴 날 회전수', value: String(CRANK_RPM * ratio), unit: 'rpm', tone: 'red' },
      { label: '속도비 (잇수비)', value: `${N_WHEEL}:${N_PIN} = ${ratio}`, unit: '배' }
    ];
    if (this.chips) this.chips.visible = true;
    return {
      update: (dt: number) => {
        this.crankAngle = (this.crankAngle + w * dt) % (TAU * N_PIN);
        this.wheelPivot.rotation.x = this.crankAngle;
        // 접점 속도 일치: R_WHEEL·ω휠 = R_PIN·ω피니언 → 피니언은 잇수비만큼 빠르게
        this.spin.rotation.y = this.crankAngle * ratio;
        this.drillTime += dt;
        this.updateChips();
      },
      getDisplay: () => display
    };
  }

  // ── 톱밥: 날이 도는 동안 구멍 둘레에 조금씩 쌓인다 ──
  private updateChips(): void {
    const chips = this.chips;
    if (!chips) return;
    const k = Math.min(1, this.drillTime / 4);
    const m = new THREE.Matrix4();
    const s = new THREE.Matrix4();
    this.chipBase.forEach((base, i) => {
      const appear = THREE.MathUtils.clamp(k * this.chipBase.length - i, 0, 1);
      s.makeScale(appear, appear, appear);
      m.multiplyMatrices(base, s);
      chips.setMatrixAt(i, m);
    });
    chips.instanceMatrix.needsUpdate = true;
  }

  // ── 미션 부품 ──

  /** ① 베벨 기어 한 쌍: 크랭크 휠(+크랭크 손잡이) + 피니언 — 원점 = 두 축의 교점 */
  private buildGears(): THREE.Group {
    const g = new THREE.Group();
    const red = paint(CATEGORY_COLORS.power, { roughness: 0.38 });

    // 크랭크 휠: 국소 Z = 휠 축 → rotation.y = π/2 로 세계 +X
    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    const orient = new THREE.Group();
    orient.rotation.y = Math.PI / 2;
    wheel.add(orient);
    // 이골이 국소 -π/2(세계 -Y, 피니언 접점)에 오도록 기본 위상(π/N: 각도 0이 이골) 유지 — N=40은 4의 배수
    add(orient, bevelGearGeo(N_WHEEL, R_WHEEL, D_WHEEL, FACE, HOLE_DEPTH, Math.PI / N_WHEEL), red);
    // 살(스포크) 4개가 뚫린 바퀴판
    const web = new THREE.Shape();
    web.absarc(0, 0, 0.47, 0, TAU, false);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      web.holes.push(kidneyPath(0.27, 0.085, a - 0.52, a + 0.52));
    }
    const hub = new THREE.Path();
    hub.absarc(0, 0, 0.03, 0, TAU, true);
    web.holes.push(hub);
    add(orient, extrude(web, 0.035, 0.008, 48), red, 0, 0, 0.168);
    // 허브 보스(축 구멍)
    const hubGeo = lathe(ringProfile(0.03, 0.068, 0.07, 0.24, 0.01), 40);
    hubGeo.rotateX(Math.PI / 2);
    add(orient, hubGeo, red);
    // 크랭크 팔 + 손잡이(바깥쪽 +Z)
    const armShape = new THREE.Shape();
    armShape.absarc(0, 0, 0.075, Math.PI / 2, (Math.PI * 3) / 2, false);
    armShape.absarc(0.4, 0, 0.05, -Math.PI / 2, Math.PI / 2, false);
    armShape.closePath();
    const darkRed = paint(0xa8302e, { roughness: 0.4 });
    add(orient, extrude(armShape, 0.035, 0.01, 32), darkRed, 0, 0, 0.255);
    const nutGeo = hexPrism(0.07, 0.03, true, true);
    nutGeo.rotateX(Math.PI / 2);
    add(orient, nutGeo, this.steelMat, 0, 0, 0.288);
    const pinGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.3, 16);
    pinGeo.rotateX(Math.PI / 2);
    add(orient, pinGeo, this.steelMat, 0.4, 0, 0.42);
    const gripPts: V2[] = [[0, 0]];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      gripPts.push([0.036 + 0.014 * Math.sin(t * Math.PI) - (t > 0.9 ? (t - 0.9) * 0.2 : 0), t * 0.24]);
    }
    gripPts.push([0, 0.24]);
    const gripGeo = lathe(gripPts, 28);
    gripGeo.rotateX(Math.PI / 2);
    add(orient, gripGeo, this.woodMat, 0.4, 0, 0.285);
    const capGeo = lathe(
      [
        [0, 0],
        [0.026, 0],
        [0.03, 0.008],
        [0.022, 0.02],
        [0, 0.022]
      ],
      20
    );
    capGeo.rotateX(Math.PI / 2);
    add(orient, capGeo, this.steelMat, 0.4, 0, 0.523);
    g.add(wheel);

    // 피니언: 국소 Z → 세계 -Y (rotation.x = π/2), 이가 국소 각도 0(세계 +X, 휠 접점)에 오도록 위상 0
    const pinion = new THREE.Group();
    pinion.name = 'pinion';
    const po = new THREE.Group();
    po.rotation.x = Math.PI / 2;
    pinion.add(po);
    const pinMat = steel({ color: 0xd2d8de });
    add(po, bevelGearGeo(N_PIN, R_PIN, D_PIN, FACE, HOLE_DEPTH, 0), pinMat);
    // 피니언 허브: 이 아래로 내려와 위 베어링 보스에 얹힌다
    const hubLen = WHEEL_Y - UBOSS_Y1;
    const hubGeo2 = lathe(ringProfile(SPINDLE_R, 0.068, 0.395, hubLen, 0.008), 40);
    hubGeo2.rotateX(Math.PI / 2);
    add(po, hubGeo2, pinMat);
    g.add(pinion);
    return g;
  }

  /** ② 전동축: 척 목에서 피니언 위까지 — 원점 = SPINDLE_ANCHOR */
  private buildSpindle(): THREE.Group {
    const g = new THREE.Group();
    const y0 = CHUCK_Y1 - 0.04 - SPINDLE_ANCHOR.y;
    const y1 = WHEEL_Y - 0.385 + 0.02 - SPINDLE_ANCHOR.y;
    const rodMat = steel({ color: 0xdfe5ea, roughness: 0.22 });
    const blue = paint(CATEGORY_COLORS.shaft, { roughness: 0.4 });
    add(g, lathe([[0, y0], [SPINDLE_R - 0.004, y0], [SPINDLE_R, y0 + 0.004], [SPINDLE_R, y1 - 0.004], [SPINDLE_R - 0.004, y1], [0, y1]], 24), rodMat);
    // 키 홈 자리 표시(회전이 읽히게) + 피니언 위 고정 너트
    const key = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.16, 0.014, 1, 0.004), blue);
    key.position.set(SPINDLE_R - 0.002, UBOSS_Y0 - 0.12 - SPINDLE_ANCHOR.y, 0);
    g.add(key);
    const nut = hexPrism(0.07, 0.03, true, true, SPINDLE_R * 0.6);
    add(g, nut, darkSteel(), 0, y1 - 0.005, 0);
    // 위·아래 베어링 사이를 칠한 띠(전동축 강조)
    add(g, lathe(ringProfile(SPINDLE_R, SPINDLE_R + 0.006, LBOSS_Y1 + 0.05 - SPINDLE_ANCHOR.y, UBOSS_Y0 - 0.05 - SPINDLE_ANCHOR.y, 0.003), 24), blue);
    return g;
  }

  // ── 고정 부품 ──

  private buildFrame(): void {
    const f = this.group;
    // C자 프레임: 아래 보스 → 등뼈 → 위 손잡이 (둥근 단면 파이프로 스윕)
    const path = new THREE.CurvePath<THREE.Vector3>();
    const p = (x: number, y: number) => new THREE.Vector3(x, y, 0);
    const r = 0.09;
    path.add(new THREE.LineCurve3(p(-0.06, (LBOSS_Y0 + LBOSS_Y1) / 2), p(SPINE_X + r, (LBOSS_Y0 + LBOSS_Y1) / 2)));
    path.add(new THREE.QuadraticBezierCurve3(p(SPINE_X + r, (LBOSS_Y0 + LBOSS_Y1) / 2), p(SPINE_X, (LBOSS_Y0 + LBOSS_Y1) / 2), p(SPINE_X, (LBOSS_Y0 + LBOSS_Y1) / 2 + r)));
    path.add(new THREE.LineCurve3(p(SPINE_X, (LBOSS_Y0 + LBOSS_Y1) / 2 + r), p(SPINE_X, TOP_Y - r)));
    path.add(new THREE.QuadraticBezierCurve3(p(SPINE_X, TOP_Y - r), p(SPINE_X, TOP_Y), p(SPINE_X + r, TOP_Y)));
    path.add(new THREE.LineCurve3(p(SPINE_X + r, TOP_Y), p(0, TOP_Y)));
    add(f, new THREE.TubeGeometry(path, 160, 0.036, 20, false), this.frameMat);
    // 위 보스 팔
    const armGeo = new THREE.CylinderGeometry(0.03, 0.03, -0.05 - SPINE_X, 18);
    armGeo.rotateZ(Math.PI / 2);
    add(f, armGeo, this.frameMat, (SPINE_X - 0.05) / 2, (UBOSS_Y0 + UBOSS_Y1) / 2, 0);
    // 베어링 보스 2개(주축이 지나는 구멍)
    add(f, lathe(ringProfile(0.032, 0.078, LBOSS_Y0, LBOSS_Y1, 0.012), 40), this.frameMat);
    add(f, lathe(ringProfile(SPINDLE_R + 0.004, 0.072, UBOSS_Y0, UBOSS_Y1, 0.012), 40), this.frameMat);
    // 휠 축: 등뼈에서 +X로 나와 휠 허브를 받친다 (교점 위를 지나므로 피니언과 닿지 않음)
    const stub = new THREE.CylinderGeometry(0.028, 0.028, 0.3 - SPINE_X, 20);
    stub.rotateZ(Math.PI / 2);
    add(f, stub, this.steelMat, (0.3 + SPINE_X) / 2, WHEEL_Y, 0);
    const stubBoss = lathe(ringProfile(0.0, 0.055, 0, 0.07, 0.01), 32);
    toX(stubBoss);
    add(f, stubBoss, this.frameMat, SPINE_X, WHEEL_Y, 0);
    // 위 손잡이(버섯 모양 나무)
    const capPts: V2[] = [[0, 0]];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const y = t * 0.3;
      const rr = 0.05 + 0.05 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.62) + (t > 0.75 ? -(t - 0.75) * 0.22 : 0);
      capPts.push([rr, y]);
    }
    capPts.push([0.05, 0.3], [0, 0.31]);
    add(f, lathe(capPts, 40), this.woodMat, 0, TOP_Y + 0.02, 0);
    add(f, lathe(ringProfile(0, 0.055, 0, 0.04, 0.008), 32), this.frameMat, 0, TOP_Y - 0.02, 0);
  }

  private buildChuckAndBit(): void {
    const s = this.spin;
    const chuckMat = chrome({ roughness: 0.16 });
    // 척 몸체(널링 슬리브) + 코
    const sleeve = radialSurface(
      (th, y) => {
        const knurl = y > 0.06 && y < 0.24 ? 0.0035 * Math.max(0, Math.cos(th * 30)) ** 0.5 : 0;
        const taper = y < 0.06 ? 0.062 + (y / 0.06) * 0.012 : 0.074;
        return taper + knurl;
      },
      [0, 0.02, 0.04, 0.06, 0.062, 0.09, 0.12, 0.15, 0.18, 0.21, 0.238, 0.24, CHUCK_Y1 - CHUCK_Y0],
      240,
      0,
      0
    );
    add(s, sleeve, chuckMat, 0, CHUCK_Y0, 0);
    add(s, lathe(ringProfile(0.024, 0.062, CHUCK_Y0 - 0.035, CHUCK_Y0 + 0.002, 0.01), 40), chuckMat);
    // 척 목: 아래 보스를 지나 위 칼라로 걸린다
    add(s, lathe(ringProfile(SPINDLE_R + 0.001, 0.031, CHUCK_Y1 - 0.01, LBOSS_Y1 + 0.004, 0.004), 32), this.steelMat);
    add(s, lathe(ringProfile(SPINDLE_R + 0.001, 0.05, LBOSS_Y1 + 0.004, LBOSS_Y1 + 0.03, 0.006), 32), darkSteel());
    add(s, lathe(ringProfile(0.03, 0.05, CHUCK_Y1 - 0.002, CHUCK_Y1 + 0.03, 0.006), 32), darkSteel());
    // 조(jaw) 3개가 날 생크를 문다
    const jawMat = darkSteel();
    const jawGeo = new RoundedBoxGeometry(0.018, 0.06, 0.022, 1, 0.005);
    for (let i = 0; i < 3; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = (i / 3) * TAU;
      const jaw = new THREE.Mesh(jawGeo, jawMat);
      // 아래로 갈수록 축에 붙도록 위쪽을 바깥으로 기울임
      jaw.position.set(0.036, CHUCK_Y0 - 0.045, 0);
      jaw.rotation.z = -0.25;
      holder.add(jaw);
      s.add(holder);
    }
    // 드릴 날
    const bitMat = steel({ color: 0xc9b27a, roughness: 0.26 });
    add(s, twistDrillGeo(0.024, 0.4, BIT_LEN), bitMat, 0, BIT_TIP, 0);
  }

  private buildWorkpiece(): void {
    const f = this.group;
    // 나무 조각 + 고정 클램프 2개
    const block = new THREE.Mesh(new RoundedBoxGeometry(0.78, WOOD_TOP - BASE_T, 0.5, 3, 0.02), wood(0xd2a675));
    block.position.set(0, (WOOD_TOP + BASE_T) / 2, 0);
    block.receiveShadow = true;
    f.add(block);
    // 뚫리는 구멍(어두운 자리)
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.02, 28), wood(0x4a2e18, { roughness: 0.95 }));
    hole.position.set(0, WOOD_TOP - 0.009, 0);
    f.add(hole);
    const clampMat = paint(0x2f7fd0, { roughness: 0.4 });
    for (const sx of [-1, 1]) {
      const c = new THREE.Group();
      c.position.set(sx * 0.3, 0, 0);
      const jaw = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.04, 0.24, 2, 0.012), clampMat);
      jaw.position.y = WOOD_TOP + 0.02;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, WOOD_TOP - BASE_T + 0.1, 16), this.steelMat);
      post.position.set(sx * 0.04, (WOOD_TOP + BASE_T) / 2 + 0.04, 0.16);
      const knob = new THREE.Mesh(hexPrism(0.05, 0.03, true, true), darkSteel());
      knob.position.set(sx * 0.04, WOOD_TOP + 0.075, 0.16);
      jaw.position.x = 0;
      c.add(jaw, post, knob);
      f.add(c);
    }
    // 톱밥(가동 중에 쌓임)
    const rnd = rand(7);
    const n = 48;
    const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.006, 0.01), wood(0xe0bb88), n);
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const rr = 0.04 + rnd() * rnd() * 0.15;
      const m = new THREE.Matrix4();
      q.setFromEuler(new THREE.Euler(rnd() * 0.5, rnd() * TAU, rnd() * 0.5));
      m.compose(new THREE.Vector3(Math.cos(a) * rr, WOOD_TOP + 0.004 + rnd() * 0.004, Math.sin(a) * rr), q, new THREE.Vector3(1, 1, 1));
      this.chipBase.push(m);
      chips.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    }
    chips.visible = false;
    chips.frustumCulled = false;
    this.chips = chips;
    f.add(chips);
  }

  private buildStand(): void {
    const f = this.group;
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.75, BASE_T, 1.1, 3, 0.025), castIron({ color: 0x3c444c }));
    base.position.set(-0.3, BASE_T / 2, 0);
    base.receiveShadow = true;
    f.add(base);
    // 기둥 + 받침 보스
    add(f, lathe(ringProfile(0, 0.11, BASE_T, BASE_T + 0.08, 0.02), 40), this.standMat, COLUMN_X, 0, 0);
    add(f, lathe([[0, BASE_T], [0.045, BASE_T], [0.045, 2.74], [0.04, 2.76], [0, 2.76]], 32), chrome({ roughness: 0.14 }), COLUMN_X, 0, 0);
    // 클램프 팔 2개: 기둥 칼라 → 프레임 등뼈를 문 조
    for (const y of [1.55, 2.62]) {
      add(f, lathe(ringProfile(0.045, 0.085, y - 0.06, y + 0.06, 0.012), 36), this.standMat, COLUMN_X, 0, 0);
      const len = SPINE_X - COLUMN_X - 0.13;
      const arm = new THREE.Mesh(new RoundedBoxGeometry(len, 0.07, 0.06, 2, 0.015), this.standMat);
      arm.position.set(COLUMN_X + 0.075 + len / 2, y, 0);
      f.add(arm);
      const jaw = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.11, 0.12, 2, 0.02), this.standMat);
      jaw.position.set(SPINE_X - 0.02, y, 0);
      f.add(jaw);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 16), this.steelMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(SPINE_X - 0.02, y, 0.1);
      const wing = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.025, 0.02, 1, 0.008), darkSteel());
      wing.position.set(SPINE_X - 0.02, y, 0.15);
      f.add(knob, wing);
    }
  }
}
