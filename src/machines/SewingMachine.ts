// 재봉틀: 벨트와 풀리 · 크랭크축 미션 — 가정용 재봉틀(베드·기둥·암·머리, 손바퀴, 뒤쪽 모터)
// 모터 풀리(피치 반지름 0.052) → 둥근 가죽 벨트(열린 벨트, 두 풀리의 외접선) → 손바퀴 홈(0.26): 1/5 감속
// → 윗축(크랭크축) → 머리 쪽 크랭크 핀 → 커넥팅 로드 → 바늘대(크랭크-슬라이더를 매 프레임 풀어서 위치 계산).
// 바늘이 천 위로 올라와 있는 동안에만 천이 뒤(-Z)로 한 땀씩 이송되고, 바늘이 내려갈 때마다 땀이 하나 생긴다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';
import { CATEGORY_COLORS, aluminum, brass, castIron, chrome, darkSteel, ghost, paint, plastic, rubber, steel, wood } from '../models/materials';
import { type V2, TAU, lathe, extrude, kidneyPath, roundedRect, stadiumShape, circlePath } from '../models/parts/geom';

// ── 치수 ──
const SHAFT_Y = 1.42; // 윗축 높이
const BED_Y0 = 0.06;
const BED_Y1 = 0.28;
const PLATE_TOP = BED_Y1 + 0.006;
const CLOTH_T = 0.008;
const CLOTH_Y = PLATE_TOP + CLOTH_T / 2;
const NEEDLE_X = -1.27;
const CROD_X = -1.19; // 커넥팅 로드 평면
const CRANK_X = -1.13;
const ECC = 0.1; // 크랭크 반지름 → 바늘 행정 0.2
const ROD_L = 0.34;
const BAR_DOWN = 0.48; // 클램프 → 바늘대 아래 끝
const NEEDLE_LEN = 0.28;
const BELT_X = 1.31;
const HW_R = 0.26; // 손바퀴 벨트 홈 피치 반지름
const MP_R = 0.052; // 모터 풀리 피치 반지름
const MOTOR_C = new THREE.Vector2(0.62, -0.42); // (y, z)
const MOTOR_RPM = 600;
const BELT_R = 0.011;
const STITCH = 0.05;
const MAX_STITCH = 8;
const PILLAR = { x0: 0.65, x1: 1.2, z: 0.19 };
const ARM = { x0: -1.0, x1: 1.2, y0: 1.2, y1: 1.64, z: 0.17 };
const HEAD = { x0: -1.48, x1: -1.0, y0: 0.78, y1: 1.68, z: 0.19 };
const SHAFT_ANCHOR = new THREE.Vector3(0, SHAFT_Y, 0);
const BELT_ANCHOR = new THREE.Vector3(BELT_X, (SHAFT_Y + MOTOR_C.x) / 2, MOTOR_C.y / 2);
const THREAD_G = new THREE.Vector3(NEEDLE_X, HEAD.y0 + 0.05, HEAD.z + 0.012);

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** (r, 축방향) 프로파일 회전체를 X축으로 눕힘 */
function latheX(profile: V2[], segs = 48): THREE.BufferGeometry {
  const g = lathe(profile, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 관 단면(축 방향 a0~a1) */
function ring(rIn: number, rOut: number, a0: number, a1: number, c = 0.006): V2[] {
  return [
    [rIn, a0 + c],
    [rIn + c, a0],
    [rOut - c, a0],
    [rOut, a0 + c],
    [rOut, a1 - c],
    [rOut - c, a1],
    [rIn + c, a1],
    [rIn, a1 - c],
    [rIn, a0 + c]
  ];
}

/** XY 둥근 사각 판을 Z 두께로 압출 */
function slabXY(x0: number, y0: number, x1: number, y1: number, depth: number, r: number, c = 0.025): THREE.BufferGeometry {
  return extrude(roundedRect(x0, y0, x1, y1, r), depth, c, 12, 3);
}

interface BeltPath {
  pts: THREE.Vector2[]; // (y, z) — 양의 회전(+X축) 방향으로 진행
  cum: number[];
  length: number;
}

/**
 * 열린 벨트: 두 원의 외접선 2개 + 감기는 호 2개. 2D 좌표 (y, z)에서 반시계(= +X축 회전 방향)로 진행.
 * 두 접점의 법선 각이 같으므로(φ ± β) 직선 구간은 두 풀리에 정확히 접한다.
 */
function openBelt(c1: THREE.Vector2, r1: number, c2: THREE.Vector2, r2: number): BeltPath {
  const d = c2.clone().sub(c1);
  const D = d.length();
  const phi = Math.atan2(d.y, d.x);
  const beta = Math.acos((r1 - r2) / D);
  const pts: THREE.Vector2[] = [];
  const arc = (c: THREE.Vector2, r: number, a0: number, a1: number, n: number): void => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(new THREE.Vector2(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r));
    }
  };
  const line = (a: THREE.Vector2, b: THREE.Vector2, n: number): void => {
    for (let i = 1; i < n; i++) pts.push(a.clone().lerp(b, i / n));
  };
  // 원1: φ+β → φ-β+2π (바깥쪽으로 크게 감김), 원2: φ-β → φ+β
  arc(c1, r1, phi + beta, phi - beta + TAU, 96);
  const p1e = pts[pts.length - 1]!.clone();
  const p2s = new THREE.Vector2(c2.x + Math.cos(phi - beta) * r2, c2.y + Math.sin(phi - beta) * r2);
  line(p1e, p2s, 24);
  arc(c2, r2, phi - beta, phi + beta, 24);
  const p2e = pts[pts.length - 1]!.clone();
  const p1s = pts[0]!.clone();
  line(p2e, p1s, 24);
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) cum.push(cum[i - 1]! + pts[i % pts.length]!.distanceTo(pts[i - 1]!));
  return { pts, cum, length: cum[cum.length - 1]! };
}

function beltAt(path: BeltPath, s: number): { p: THREE.Vector2; t: THREE.Vector2 } {
  const L = path.length;
  const u = ((s % L) + L) % L;
  let lo = 0;
  let hi = path.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.cum[mid]! <= u) lo = mid;
    else hi = mid;
  }
  const n = path.pts.length;
  const a = path.pts[lo % n]!;
  const b = path.pts[(lo + 1) % n]!;
  const f = (u - path.cum[lo]!) / Math.max(1e-6, path.cum[lo + 1]! - path.cum[lo]!);
  return { p: a.clone().lerp(b, f), t: b.clone().sub(a).normalize() };
}

/** 크랭크-슬라이더 해: 크랭크각 θ(윗축 rotation.x)일 때 바늘대 클램프 높이와 로드 각 */
function solveCrank(theta: number): { yS: number; pinY: number; pinZ: number; rodA: number } {
  const pinY = SHAFT_Y + ECC * Math.cos(theta);
  const pinZ = ECC * Math.sin(theta);
  const yS = pinY - Math.sqrt(ROD_L * ROD_L - pinZ * pinZ);
  return { yS, pinY, pinZ, rodA: Math.asin(pinZ / ROD_L) };
}

export class SewingMachine extends BaseMachine {
  readonly id = 'sewing';
  private shaftPivot = new THREE.Group(); // 윗축·손바퀴 회전
  private motorPivot = new THREE.Group();
  private needleBar = new THREE.Group();
  private cloth = new THREE.Group();
  private stitches: THREE.InstancedMesh;
  private threadEnd: THREE.Mesh;
  private beltModel: THREE.Group | null = null;
  private motorPulley: THREE.Object3D | null = null;
  private shaftModel: THREE.Group | null = null;
  private conrod: THREE.Object3D | null = null;
  private beltHook: THREE.Object3D | null = null;
  private path = openBelt(new THREE.Vector2(SHAFT_Y, 0), HW_R, MOTOR_C, MP_R);
  private theta = 0;
  private beltS = 0;

  private readonly bodyMat = paint(0x5aa99e, { roughness: 0.36 });
  private readonly ghostMat = ghost(0x2f7f76, 0.5);
  private readonly steelMat = steel();
  private readonly chromeMat = chrome({ roughness: 0.12 });
  private readonly brassMat = brass();
  private readonly threadMat = plastic(0xd8362f, { roughness: 0.6, grain: false });

  constructor() {
    super();
    this.shaftPivot.position.copy(SHAFT_ANCHOR);
    this.motorPivot.position.set(0, MOTOR_C.x, MOTOR_C.y);
    this.group.add(this.shaftPivot, this.motorPivot, this.needleBar, this.cloth);

    this.buildBody();
    this.buildHandwheel();
    this.buildMotor();
    this.buildNeedleBar();
    this.buildThread();
    this.stitches = this.buildCloth();
    this.threadEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6), this.threadMat);
    this.group.add(this.threadEnd);
    this.poseNeedle(0);
    this.setFeed(0);

    this.addSlot(0, 0.11, new THREE.Vector3(BELT_X + 0.03, MOTOR_C.x, MOTOR_C.y), 0.018);
    this.slots[0]!.rotation.y = Math.PI / 2;
    this.addSlot(1, 0.12, new THREE.Vector3(0.2, SHAFT_Y, 0), 0.016);
    this.slots[1]!.rotation.y = Math.PI / 2;
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = s.receiveShadow = false;
    }
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.beltModel !== null : this.shaftModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? BELT_ANCHOR.clone() : SHAFT_ANCHOR.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(BELT_X + 0.03, MOTOR_C.x, MOTOR_C.y) : new THREE.Vector3(0.2, SHAFT_Y, 0);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildBelt() : this.buildCrankShaft();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      model.position.copy(BELT_ANCHOR);
      this.group.add(model);
      this.beltModel = model;
      const pulley = model.getObjectByName('motorPulley');
      if (pulley) {
        this.motorPivot.add(pulley);
        pulley.position.set(BELT_X, 0, 0);
        this.motorPulley = pulley;
      }
      this.beltHook = model.getObjectByName('beltHook') ?? null;
      this.placeHook();
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(0, 0, 0);
      this.shaftPivot.add(model);
      this.shaftModel = model;
      const rod = model.getObjectByName('conrod');
      if (rod) {
        this.group.add(rod);
        this.conrod = rod;
      }
      this.hideSlot(1);
      this.poseNeedle(this.theta);
    }
  }

  reset(): void {
    if (this.motorPulley) this.motorPivot.remove(this.motorPulley);
    if (this.beltModel) this.group.remove(this.beltModel);
    if (this.conrod) this.group.remove(this.conrod);
    if (this.shaftModel) this.shaftPivot.remove(this.shaftModel);
    this.beltModel = this.shaftModel = null;
    this.motorPulley = this.conrod = this.beltHook = null;
    this.theta = 0;
    this.beltS = 0;
    this.shaftPivot.rotation.x = 0;
    this.motorPivot.rotation.x = 0;
    this.poseNeedle(0);
    this.setFeed(0);
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.beltModel || !this.shaftModel) throw new Error('sewing mission incomplete');
    const ratio = HW_R / MP_R; // 5
    const wM = (MOTOR_RPM / 60) * TAU;
    const shaftRpm = MOTOR_RPM / ratio;
    const display: MachineDisplayItem[] = [
      { label: '모터 회전수', value: String(MOTOR_RPM), unit: 'rpm', tone: 'blue' },
      { label: `윗축 회전수 (풀리 지름비 ${ratio}:1)`, value: shaftRpm.toFixed(0), unit: 'rpm' },
      { label: '바늘 왕복', value: shaftRpm.toFixed(0), unit: '회/분', tone: 'red' }
    ];
    let total = 0; // 리셋 이후 누적 크랭크각
    return {
      update: (dt: number) => {
        const dM = wM * dt;
        this.motorPivot.rotation.x = (this.motorPivot.rotation.x + dM) % TAU;
        // 벨트 속도 = ω모터·r모터 = ω윗축·r손바퀴
        this.beltS += dM * MP_R;
        const dS = dM / ratio;
        this.theta = (this.theta + dS) % TAU;
        this.shaftPivot.rotation.x = this.theta;
        total += dS;
        if (total / TAU > MAX_STITCH + 0.5) total -= TAU * MAX_STITCH; // 천을 처음 자리로
        this.poseNeedle(this.theta);
        this.setFeed(total);
        this.placeHook();
      },
      getDisplay: () => display
    };
  }

  // ── 동작 ──

  private poseNeedle(theta: number): void {
    const c = solveCrank(theta);
    this.needleBar.position.y = c.yS;
    if (this.conrod) {
      this.conrod.position.set(CROD_X, c.pinY, c.pinZ);
      this.conrod.rotation.x = c.rodA;
    }
    // 실 끝: 아래 실 걸이 → 바늘귀
    const eye = new THREE.Vector3(NEEDLE_X, c.yS - BAR_DOWN - NEEDLE_LEN + 0.035, 0.006);
    const d = eye.clone().sub(THREAD_G);
    this.threadEnd.position.copy(THREAD_G).addScaledVector(d, 0.5);
    this.threadEnd.scale.set(1, d.length(), 1);
    this.threadEnd.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }

  /**
   * 천 이송: 누적 크랭크각 기준 u = θ/2π + 1/6 → 바늘이 위에 있는 구간(θ ∈ [-60°, 60°])에만 한 땀씩 이동.
   * k번째 관통(u = k + 2/3) 때 천은 이미 (k+1)땀 이동해 있으므로 땀은 천 좌표 z ∈ [k·p, (k+1)·p]에 생긴다.
   */
  private setFeed(total: number): void {
    const u = total / TAU + 1 / 6;
    const k = Math.floor(u);
    const f = THREE.MathUtils.smootherstep(Math.min(1, (u - k) * 3), 0, 1);
    this.cloth.position.z = -STITCH * (k + f);
    const n = total <= 0 ? 0 : Math.max(0, Math.floor(u - 2 / 3) + 1);
    this.stitches.count = Math.min(n, MAX_STITCH + 1);
  }

  private placeHook(): void {
    if (!this.beltHook) return;
    const { p, t } = beltAt(this.path, this.beltS);
    // 벨트 모델 좌표 = 기계 좌표 - BELT_ANCHOR
    this.beltHook.position.set(0, p.x - BELT_ANCHOR.y, p.y - BELT_ANCHOR.z);
    this.beltHook.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, t.x, t.y));
  }

  // ── 미션 부품 ──

  /** ① 모터 풀리 + 둥근 가죽 벨트(이음 고리 포함) — 원점 = BELT_ANCHOR */
  private buildBelt(): THREE.Group {
    const g = new THREE.Group();
    const pts = this.path.pts.map((p) => new THREE.Vector3(0, p.x - BELT_ANCHOR.y, p.y - BELT_ANCHOR.z));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const leather = rubber({ color: 0x6b3f22, roughness: 0.62 });
    add(g, new THREE.TubeGeometry(curve, 420, BELT_R, 12, true), leather);
    const hook = new THREE.Group();
    hook.name = 'beltHook';
    const clip = new THREE.CylinderGeometry(BELT_R * 1.35, BELT_R * 1.35, 0.045, 14);
    add(hook, clip, this.chromeMat);
    g.add(hook);

    const pulley = new THREE.Group();
    pulley.name = 'motorPulley';
    pulley.position.set(0, MOTOR_C.x - BELT_ANCHOR.y, MOTOR_C.y - BELT_ANCHOR.z);
    const red = paint(CATEGORY_COLORS.power, { roughness: 0.4 });
    const vr = MP_R - BELT_R * 0.7;
    add(
      pulley,
      latheX(
        [
          [0.018, -0.035],
          [0.03, -0.035],
          [0.068, -0.03],
          [0.07, -0.024],
          [vr, -0.004],
          [vr, 0.004],
          [0.07, 0.024],
          [0.068, 0.03],
          [0.034, 0.034],
          [0.034, 0.06],
          [0.018, 0.06],
          [0.018, -0.035]
        ],
        48
      ),
      red
    );
    // 회전이 보이도록 고정 나사 1개
    const screw = new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10);
    add(pulley, screw, darkSteel(), 0.048, 0.035, 0);
    g.add(pulley);
    return g;
  }

  /** ② 크랭크축(윗축): 축 + 크랭크 원판(균형추) + 크랭크 핀 + 커넥팅 로드 + 손바퀴 고정 노브 — 원점 = SHAFT_ANCHOR */
  private buildCrankShaft(): THREE.Group {
    const g = new THREE.Group();
    const shaftMat = steel({ color: 0xdde3e8, roughness: 0.2 });
    const blue = paint(CATEGORY_COLORS.shaft, { roughness: 0.38 });
    add(g, latheX([[0, CRANK_X - 0.01], [0.026, CRANK_X - 0.01], [0.03, CRANK_X - 0.005], [0.03, 1.555], [0.026, 1.56], [0, 1.56]], 24), shaftMat);
    // 크랭크 원판 (YZ 평면, 핀은 +Y 반지름 ECC)
    const disc = new THREE.Shape();
    disc.absarc(0, 0, 0.135, 0, TAU, false);
    disc.holes.push(circlePath(0, 0, 0.03));
    const discGeo = extrude(disc, 0.045, 0.008, 32);
    discGeo.rotateY(Math.PI / 2);
    add(g, discGeo, blue, CRANK_X, 0, 0);
    add(g, latheX([[0, CRANK_X - 0.075], [0.016, CRANK_X - 0.075], [0.018, CRANK_X - 0.07], [0.018, CRANK_X], [0, CRANK_X]], 20), shaftMat).position.set(0, ECC, 0);
    // 축 칼라 2개(베어링 사이 위치 고정) + 회전 표시 키
    for (const x of [-0.82, 1.02]) add(g, latheX(ring(0.03, 0.05, x, x + 0.035), 32), blue);
    const key = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.012, 0.016, 1, 0.004), blue);
    key.position.set(0.45, 0.03, 0);
    g.add(key);
    // 손바퀴 고정 노브(축 끝)
    add(
      g,
      latheX(
        [
          [0.03, 1.5],
          [0.07, 1.5],
          [0.075, 1.51],
          [0.075, 1.56],
          [0.06, 1.585],
          [0, 1.59],
          [0, 1.56],
          [0.03, 1.56]
        ],
        40
      ),
      this.chromeMat
    );

    // 커넥팅 로드(국소: 큰 끝 = 원점, 작은 끝 = (0, -ROD_L, 0), 두께는 X)
    const rod = new THREE.Group();
    rod.name = 'conrod';
    const rs = stadiumShape(0, 0, 0, -ROD_L, 0.035);
    rs.holes.push(circlePath(0, 0, 0.019), circlePath(0, -ROD_L, 0.013));
    const rodGeo = extrude(rs, 0.026, 0.006, 24);
    rodGeo.rotateY(Math.PI / 2);
    add(rod, rodGeo, steel({ color: 0xb9c2cb }));
    for (const [y, r] of [
      [0, 0.019],
      [-ROD_L, 0.013]
    ] as const) {
      add(rod, latheX(ring(r - 0.006, r + 0.002, -0.016, 0.016, 0.003), 24), this.brassMat, 0, y, 0);
    }
    rod.position.set(CROD_X - SHAFT_ANCHOR.x, ECC, 0); // θ=0 자세
    g.add(rod);
    return g;
  }

  // ── 고정 부품 ──

  private buildBody(): void {
    const f = this.group;
    // 베드 + 고무발
    const bed = new THREE.Mesh(new RoundedBoxGeometry(2.95, BED_Y1 - BED_Y0, 1.0, 4, 0.05), this.bodyMat);
    bed.position.set(-0.125, (BED_Y0 + BED_Y1) / 2, 0);
    f.add(bed);
    const footGeo = new THREE.CylinderGeometry(0.06, 0.07, BED_Y0, 24);
    const footMat = rubber();
    for (const x of [-1.45, 1.2]) for (const z of [-0.38, 0.38]) add(f, footGeo, footMat, x, BED_Y0 / 2, z);
    // 바늘판(크롬) + 이송 톱니 홈 + 바늘 구멍
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.012, 0.34, 2, 0.004), this.chromeMat);
    plate.position.set(NEEDLE_X, BED_Y1, 0);
    f.add(plate);
    const slotMat = plastic(0x15181c, { grain: false });
    for (const dx of [-0.045, 0.045]) {
      const s = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.004, 0.14, 1, 0.002), slotMat);
      s.position.set(NEEDLE_X + dx, PLATE_TOP - 0.001, 0);
      f.add(s);
    }
    add(f, new THREE.CylinderGeometry(0.014, 0.014, 0.004, 16), slotMat, NEEDLE_X, PLATE_TOP - 0.001, 0);
    // 북집 덮개(투명) 자리
    const cover = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.008, 0.22, 2, 0.004), aluminum({ roughness: 0.25 }));
    cover.position.set(NEEDLE_X + 0.36, BED_Y1, 0.05);
    f.add(cover);

    // 기둥(불투명) — 위로 갈수록 살짝 가늘어지는 판
    const pil = new THREE.Shape();
    pil.moveTo(PILLAR.x0, BED_Y1 - 0.02);
    pil.lineTo(PILLAR.x1, BED_Y1 - 0.02);
    pil.lineTo(PILLAR.x1, ARM.y0);
    pil.lineTo(PILLAR.x0 + 0.1, ARM.y0);
    pil.quadraticCurveTo(PILLAR.x0 + 0.02, ARM.y0 - 0.25, PILLAR.x0, ARM.y0 - 0.55);
    pil.closePath();
    add(f, extrude(pil, PILLAR.z * 2, 0.03, 24, 3), this.bodyMat);
    // 암·머리 커버(ghost) — 내부 축·크랭크가 보인다
    add(f, slabXY(ARM.x0, ARM.y0, ARM.x1, ARM.y1, ARM.z * 2, 0.12), this.ghostMat);
    add(f, slabXY(HEAD.x0, HEAD.y0, HEAD.x1, HEAD.y1, HEAD.z * 2, 0.07), this.ghostMat);
    // 암 끝 베어링 슬리브(손바퀴가 얹힘)
    add(f, latheX(ring(0.031, 0.055, ARM.x1 - 0.02, 1.5), 40), castIron({ color: 0x4c5560 }));

    // 윗축 베어링(받침대 + 황동 부싱) 3곳
    const pedMat = paint(0x3f8f86, { roughness: 0.45 });
    for (const x of [-0.9, 0.12, 1.08]) {
      // 암 위·아래 벽을 잇는 칸막이 리브에 부싱이 박혀 있다
      const ped = new THREE.Mesh(new RoundedBoxGeometry(0.05, ARM.y1 - ARM.y0 - 0.03, 0.07, 2, 0.012), pedMat);
      ped.position.set(x, (ARM.y1 + ARM.y0) / 2, 0);
      f.add(ped);
      add(f, latheX(ring(0.031, 0.058, x - 0.04, x + 0.04), 32), this.brassMat);
    }
    // 바늘대 부싱(머리 위·아래) + 노루발대
    const bushGeo = lathe(ring(0.02, 0.04, -0.03, 0.03), 28);
    add(f, bushGeo, this.brassMat, NEEDLE_X, HEAD.y0 + 0.03, 0);
    add(f, bushGeo, this.brassMat, NEEDLE_X, HEAD.y1 - 0.1, 0);
    const pbar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, HEAD.y1 - 0.1 - (CLOTH_Y + 0.07), 16), this.steelMat);
    pbar.position.set(NEEDLE_X, (HEAD.y1 - 0.1 + CLOTH_Y + 0.07) / 2, -0.1);
    f.add(pbar);
    add(f, lathe(ring(0.016, 0.034, -0.03, 0.03), 24), this.brassMat, NEEDLE_X, HEAD.y0 + 0.03, -0.1);
    // 노루발: 바늘이 지나가도록 두 갈래 발
    const footShank = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.08, 0.04, 2, 0.01), this.chromeMat);
    footShank.position.set(NEEDLE_X, CLOTH_Y + 0.06, -0.1);
    f.add(footShank);
    const toeGeo = new RoundedBoxGeometry(0.024, 0.02, 0.24, 2, 0.008);
    for (const dx of [-0.028, 0.028]) add(f, toeGeo, this.chromeMat, NEEDLE_X + dx, CLOTH_Y + CLOTH_T / 2 + 0.01, -0.02);
    const bridge = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.04, 2, 0.01), this.chromeMat);
    bridge.position.set(NEEDLE_X, CLOTH_Y + 0.025, -0.1);
    f.add(bridge);

    // 장식: 땀 길이 다이얼(기둥 앞), 실 조절 노브(머리 앞), 실패 핀
    const dial = latheX([[0, 0], [0.07, 0], [0.075, 0.01], [0.075, 0.04], [0.065, 0.05], [0, 0.05]], 40);
    dial.rotateY(-Math.PI / 2);
    add(f, dial, this.chromeMat, 0.93, 0.78, PILLAR.z);
    const tension = latheX([[0, 0], [0.045, 0], [0.05, 0.01], [0.05, 0.05], [0.04, 0.06], [0, 0.06]], 32);
    tension.rotateY(-Math.PI / 2);
    add(f, tension, plastic(0xeef1f4), -1.12, 1.38, HEAD.z);
    add(f, new THREE.CylinderGeometry(0.008, 0.008, 0.28, 12), this.chromeMat, 0.35, ARM.y1 + 0.14, 0);
    const spool = lathe(
      [
        [0.012, 0],
        [0.06, 0],
        [0.062, 0.012],
        [0.046, 0.016],
        [0.046, 0.144],
        [0.062, 0.148],
        [0.06, 0.16],
        [0.012, 0.16]
      ],
      40
    );
    add(f, spool, wood(0xd8b07a), 0.35, ARM.y1 + 0.02, 0);
    add(f, lathe([[0.046, 0.018], [0.052, 0.02], [0.054, 0.08], [0.052, 0.14], [0.046, 0.142]], 40), this.threadMat, 0.35, ARM.y1 + 0.02, 0);
  }

  private buildHandwheel(): void {
    const hw = new THREE.Group();
    hw.position.set(0, 0, 0);
    this.shaftPivot.add(hw);
    const vr = HW_R - BELT_R * 0.7;
    const groove = latheX(
      [
        [0.056, 1.25],
        [0.29, 1.25],
        [0.296, 1.258],
        [0.292, 1.27],
        [vr, BELT_X - 0.006],
        [vr, BELT_X + 0.006],
        [0.292, 1.35],
        [0.296, 1.362],
        [0.29, 1.37],
        [0.056, 1.37],
        [0.056, 1.25]
      ],
      96
    );
    add(hw, groove, darkSteel({ roughness: 0.35 }));
    const wheelMat = paint(0xeef1f4, { roughness: 0.3 });
    add(
      hw,
      latheX(
        [
          [0.27, 1.37],
          [0.33, 1.37],
          [0.345, 1.385],
          [0.35, 1.43],
          [0.345, 1.48],
          [0.33, 1.5],
          [0.27, 1.5],
          [0.27, 1.37]
        ],
        96
      ),
      wheelMat
    );
    const face = new THREE.Shape();
    face.absarc(0, 0, 0.28, 0, TAU, false);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      face.holes.push(kidneyPath(0.17, 0.055, a - 0.62, a + 0.62));
    }
    face.holes.push(circlePath(0, 0, 0.056));
    const faceGeo = extrude(face, 0.04, 0.008, 48);
    faceGeo.rotateY(Math.PI / 2);
    add(hw, faceGeo, wheelMat, 1.455, 0, 0);
    add(hw, latheX(ring(0.056, 0.1, 1.37, 1.5), 48), wheelMat);
  }

  private buildMotor(): void {
    const f = this.group;
    const mg = new THREE.Group();
    mg.position.set(0, MOTOR_C.x, MOTOR_C.y);
    f.add(mg);
    const body: V2[] = [[0, 0.95]];
    // 냉각 리브가 있는 몸통
    for (let i = 0; i <= 10; i++) {
      const x = 0.99 + i * 0.024;
      body.push([i % 2 === 0 ? 0.135 : 0.145, x], [i % 2 === 0 ? 0.135 : 0.145, x + 0.012]);
    }
    body.push([0.14, 1.25], [0.11, 1.27], [0, 1.27]);
    add(mg, latheX(body, 48), castIron({ color: 0x3b4148 }));
    add(mg, latheX([[0, 0.93], [0.12, 0.93], [0.128, 0.95], [0.128, 0.99], [0, 0.99]], 48), aluminum());
    add(mg, latheX([[0, 1.26], [0.06, 1.26], [0.06, 1.29], [0.02, 1.29], [0.018, 1.38], [0, 1.38]], 32), this.steelMat);
    // 받침 브래킷: 기둥 뒷면에 볼트로 고정
    const br = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.12, PILLAR.z * -1 - (MOTOR_C.y + 0.12) + 0.04, 2, 0.015), darkSteel());
    br.position.set(1.08, MOTOR_C.x, (MOTOR_C.y + 0.12 - PILLAR.z) / 2);
    f.add(br);
    // 전원선
    const cable = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.95, MOTOR_C.x, MOTOR_C.y),
      new THREE.Vector3(0.82, MOTOR_C.x - 0.15, MOTOR_C.y - 0.1),
      new THREE.Vector3(0.6, BED_Y1 + 0.02, MOTOR_C.y - 0.2),
      new THREE.Vector3(0.3, BED_Y1 - 0.06, -0.52)
    ]);
    add(f, new THREE.TubeGeometry(cable, 40, 0.012, 8, false), rubber());
  }

  private buildNeedleBar(): void {
    const nb = this.needleBar;
    add(nb, new THREE.CylinderGeometry(0.019, 0.019, BAR_DOWN + 0.42, 20), this.steelMat, NEEDLE_X, (0.42 - BAR_DOWN) / 2, 0);
    // 클램프 + 로드 작은 끝 핀(+X)
    add(nb, new RoundedBoxGeometry(0.06, 0.06, 0.06, 2, 0.012), darkSteel(), NEEDLE_X, 0, 0);
    const stud = new THREE.CylinderGeometry(0.012, 0.012, CROD_X - NEEDLE_X + 0.03, 14);
    stud.rotateZ(Math.PI / 2);
    add(nb, stud, this.steelMat, (NEEDLE_X + CROD_X) / 2 + 0.015, 0, 0);
    // 바늘 고정쇠 + 바늘
    add(nb, new RoundedBoxGeometry(0.044, 0.05, 0.044, 2, 0.008), this.chromeMat, NEEDLE_X, -BAR_DOWN, 0);
    const screw = new THREE.CylinderGeometry(0.009, 0.009, 0.03, 10);
    screw.rotateZ(Math.PI / 2);
    add(nb, screw, this.steelMat, NEEDLE_X + 0.03, -BAR_DOWN, 0);
    const needle = lathe(
      [
        [0, -NEEDLE_LEN],
        [0.004, -NEEDLE_LEN + 0.03],
        [0.0065, -NEEDLE_LEN + 0.06],
        [0.0065, -0.06],
        [0.011, -0.05],
        [0.011, 0],
        [0, 0]
      ],
      16
    );
    add(nb, needle, chrome({ roughness: 0.1 }), NEEDLE_X, -BAR_DOWN, 0);
  }

  private buildThread(): void {
    const f = this.group;
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const curve = new THREE.CatmullRomCurve3(
      [
        P(0.35 - 0.05, ARM.y1 + 0.1, 0.0),
        P(0.15, ARM.y1 + 0.03, 0.1),
        P(-0.4, ARM.y1 + 0.02, ARM.z - 0.02),
        P(-0.98, HEAD.y1 + 0.015, HEAD.z - 0.04),
        P(-1.08, HEAD.y1 - 0.08, HEAD.z + 0.01),
        P(-1.12, 1.38, HEAD.z + 0.035),
        P(-1.2, 1.12, HEAD.z + 0.012),
        P(-1.25, 0.95, HEAD.z + 0.012),
        THREAD_G.clone()
      ],
      false,
      'centripetal'
    );
    add(f, new THREE.TubeGeometry(curve, 120, 0.0035, 6, false), this.threadMat);
    // 실 걸이(크롬 고리)
    const hookGeo = new THREE.TorusGeometry(0.014, 0.004, 8, 20);
    for (const p of [P(0.15, ARM.y1 + 0.02, 0.1), P(-0.98, HEAD.y1 + 0.005, HEAD.z - 0.04), THREAD_G.clone()]) {
      const h = new THREE.Mesh(hookGeo, this.chromeMat);
      h.position.copy(p);
      h.rotation.x = Math.PI / 2;
      f.add(h);
    }
  }

  private buildCloth(): THREE.InstancedMesh {
    const c = this.cloth;
    const z0 = -0.28;
    const z1 = 0.62;
    const fabric = new THREE.Mesh(new RoundedBoxGeometry(0.7, CLOTH_T, z1 - z0, 2, 0.003), plastic(0x3f6fb8, { roughness: 0.92 }));
    fabric.position.set(NEEDLE_X + 0.05, CLOTH_Y, (z0 + z1) / 2);
    c.add(fabric);
    // 박음질 땀: k번째 땀은 천 좌표 z ∈ [k·p, (k+1)·p]
    const geo = new THREE.CapsuleGeometry(0.005, STITCH * 0.72, 3, 8);
    geo.rotateX(Math.PI / 2);
    const st = new THREE.InstancedMesh(geo, this.threadMat, MAX_STITCH + 1);
    const m = new THREE.Matrix4();
    for (let k = 0; k <= MAX_STITCH; k++) {
      m.makeTranslation(NEEDLE_X, CLOTH_Y + CLOTH_T / 2 + 0.002, (k + 0.5) * STITCH);
      st.setMatrixAt(k, m);
    }
    st.count = 0;
    // count가 0일 때 계산된 경계구로 영구 컬링되지 않도록
    st.frustumCulled = false;
    c.add(st);
    return st;
  }
}
