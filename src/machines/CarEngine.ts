// 자동차 엔진: 크랭크축과 캠 미션 — 직렬 4기통 DOHC 컷어웨이(블록·헤드 반투명)
// 피스톤 높이는 크랭크-슬라이더 식(커넥팅 로드 길이 일정)으로 풀고,
// 밸브 양정은 캠 윤곽 점열의 지지 함수(평면 버킷 종동절)로 매 프레임 계산한다 — 캠과 버킷이 항상 접한다.
// 점화 순서 1-3-4-2, 캠축은 타이밍 벨트(20:40)로 크랭크 2회전에 1회전.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';
import { aluminum, bronze, castIron, darkSteel, ghost, glow, paint, plastic, rubber, steel } from '../models/materials';
import { type V2, TAU, lathe, extrude, shapeFrom, circlePts, pathFrom, merge, roundedRect } from '../models/parts/geom';
import { buildSpurGearMesh } from '../models/parts/gears';

// ── 치수 (블록 길이 2.3 ≈ 실물 약 70cm) ──
const CRANK_Y = 0.95;
const CR = 0.17; // 크랭크 반지름 = 행정/2
const ROD_L = 0.6; // 커넥팅 로드 중심거리
const CYL_X = [0.825, 0.275, -0.275, -0.825] as const; // 1번(벨트 쪽) → 4번
const THROW = [0, Math.PI, Math.PI, 0] as const; // 크랭크 핀 위상 180°
// 각 실린더의 4행정 사이클(720°) 시작 오프셋 — 점화 순서 1-3-4-2
const CYCLE_OFF = [0, 3 * Math.PI, Math.PI, 2 * Math.PI] as const;
const PISTON_R = 0.182;
const BORE_R = 0.19;
const PIN_TO_TOP = 0.1;
const SKIRT = 0.14;
const DECK_Y = 1.88;
const BLOCK_X = 1.15;
const BLOCK_Z = 0.3;
const PAN_TOP = 0.68;
const HEAD_TOP = 2.27;
const COVER_TOP = 2.47;
const HEAD_Z = 0.34;
const MAIN_X = [1.07, 0.55, 0, -0.55, -1.07] as const;

// 밸브(펜트루프: 바깥쪽으로 12° 기울어짐)
const TILT = (12 * Math.PI) / 180;
const VALVE_Z0 = 0.09;
const VALVE_HEAD_R = 0.058;
const S_SPRING_SEAT = 0.12;
const S_RETAINER = 0.27;
const S_BUCKET_TOP = 0.34;
// 캠: 기초원 + 노즈원 + 접선 플랭크(볼록 → 평면 종동절이 항상 접함)
const CAM_BASE = 0.05;
const CAM_NOSE = 0.022;
const CAM_LIFT = 0.032;
const CAM_ECC = CAM_LIFT + CAM_BASE - CAM_NOSE;
const CAM_W = 0.08;
const S_CAM = S_BUCKET_TOP + CAM_BASE;
const CAM_Y = DECK_Y + S_CAM * Math.cos(TILT);
const CAM_Z = VALVE_Z0 + S_CAM * Math.sin(TILT);
// 밸브 최대 양정 시점(1번 기준 크랭크각): 흡입 110° ATDC, 배기 110° BTDC
const INTAKE_PEAK = (110 * Math.PI) / 180;
const EXHAUST_PEAK = (610 * Math.PI) / 180;

// 타이밍 벨트
const BELT_X = 1.25;
const BELT_W = 0.055;
const CRANK_TEETH = 20;
const CAM_TEETH = 40;
const RPM = 40;

const STROKES = ['흡입', '압축', '폭발', '배기'] as const;

/** X축 방향 회전체: 프로파일 [r, x] */
function latheX(profile: V2[], segs = 40): THREE.BufferGeometry {
  const g = lathe(profile, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 모따기 있는 X축 원기둥 [x0,x1] */
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

/** 평면 Shape(sx, sy)를 두께 d로 압출해 X축 방향으로 세움: sy → 세계 y, sx → 세계 -z */
function plateX(shape: THREE.Shape, d: number, c = 0.008, curve = 24): THREE.BufferGeometry {
  const g = extrude(shape, d, c, curve, 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** (y,z) 평면에서 X축 회전 */
function rotYZ(p: V2, a: number): V2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** 캠 윤곽(국소 (y,z), 노즈가 -y): 기초원과 노즈원의 볼록 껍질 */
function camProfile(): V2[] {
  const out: V2[] = [];
  const g = Math.acos((CAM_BASE - CAM_NOSE) / CAM_ECC); // 플랭크 접점 각
  const push = (u: number, v: number): void => {
    out.push([-u, -v]);
  };
  const nNose = 28;
  for (let i = 0; i <= nNose; i++) {
    const a = -g + (2 * g * i) / nNose;
    push(CAM_ECC + CAM_NOSE * Math.cos(a), CAM_NOSE * Math.sin(a));
  }
  const nBase = 56;
  for (let i = 0; i <= nBase; i++) {
    const a = g + ((TAU - 2 * g) * i) / nBase;
    push(CAM_BASE * Math.cos(a), CAM_BASE * Math.sin(a));
  }
  out.pop(); // 시작점과 겹침 방지(-g 지점은 노즈 쪽과 직선으로 이어짐)
  return out;
}

/** 원 여러 개를 바깥에서 감는 벨트 경로 ((y,z) 평면, 반시계 순서로 원을 준다) */
interface BeltSeg {
  line: boolean;
  a: V2;
  b: V2;
  c: V2;
  r: number;
  a0: number;
  sweep: number;
  len: number;
}

class BeltPath {
  readonly segs: BeltSeg[] = [];
  readonly length: number;
  readonly contactAngle: number[] = []; // 각 원 감김 구간 중앙의 각

  constructor(circles: { c: V2; r: number }[]) {
    const n = circles.length;
    const phi: number[] = [];
    for (let i = 0; i < n; i++) {
      const A = circles[i]!;
      const B = circles[(i + 1) % n]!;
      const dy = B.c[0] - A.c[0];
      const dz = B.c[1] - A.c[1];
      const D = Math.hypot(dy, dz);
      phi.push(Math.atan2(dz, dy) - Math.acos((A.r - B.r) / D));
    }
    let total = 0;
    for (let i = 0; i < n; i++) {
      const A = circles[i]!;
      const B = circles[(i + 1) % n]!;
      const f = phi[i]!;
      const a: V2 = [A.c[0] + A.r * Math.cos(f), A.c[1] + A.r * Math.sin(f)];
      const b: V2 = [B.c[0] + B.r * Math.cos(f), B.c[1] + B.r * Math.sin(f)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      this.segs.push({ line: true, a, b, c: [0, 0], r: 0, a0: 0, sweep: 0, len });
      total += len;
      const fNext = phi[(i + 1) % n]!;
      let sweep = (fNext - f) % TAU;
      if (sweep < 0) sweep += TAU;
      this.segs.push({ line: false, a, b, c: B.c, r: B.r, a0: f, sweep, len: B.r * sweep });
      this.contactAngle[(i + 1) % n] = f + sweep / 2;
      total += B.r * sweep;
    }
    this.length = total;
  }

  /** 호장 s의 위치 p, 접선 t, 바깥 법선 n */
  at(s: number): { p: V2; t: V2; n: V2 } {
    let u = s % this.length;
    if (u < 0) u += this.length;
    for (const g of this.segs) {
      if (u <= g.len || g === this.segs[this.segs.length - 1]) {
        if (g.line) {
          const k = Math.min(1, u / g.len);
          const t: V2 = [(g.b[0] - g.a[0]) / g.len, (g.b[1] - g.a[1]) / g.len];
          return { p: [g.a[0] + (g.b[0] - g.a[0]) * k, g.a[1] + (g.b[1] - g.a[1]) * k], t, n: [t[1], -t[0]] };
        }
        const ang = g.a0 + Math.min(g.sweep, u / g.r);
        const n: V2 = [Math.cos(ang), Math.sin(ang)];
        return { p: [g.c[0] + g.r * n[0], g.c[1] + g.r * n[1]], t: [-n[1], n[0]], n };
      }
      u -= g.len;
    }
    return { p: [0, 0], t: [1, 0], n: [0, 1] };
  }
}

/** 벨트 경로를 따라가는 사각 단면 띠(법선 방향 오프셋 off, 두께 th, 폭 w) */
function ribbonGeo(path: BeltPath, off: number, th: number, w: number, samples = 480): THREE.BufferGeometry {
  const rings: { o: THREE.Vector3; i: THREE.Vector3; n: THREE.Vector3 }[] = [];
  for (let k = 0; k <= samples; k++) {
    const q = path.at((k / samples) * path.length);
    const ny = q.n[0];
    const nz = q.n[1];
    rings.push({
      o: new THREE.Vector3(0, q.p[0] + ny * (off + th / 2), q.p[1] + nz * (off + th / 2)),
      i: new THREE.Vector3(0, q.p[0] + ny * (off - th / 2), q.p[1] + nz * (off - th / 2)),
      n: new THREE.Vector3(0, ny, nz)
    });
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, na: THREE.Vector3, nb: THREE.Vector3): void => {
    // a,b 는 k, c,d 는 k+1 (a-d, b-c 대응)
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    nor.push(na.x, na.y, na.z, na.x, na.y, na.z, nb.x, nb.y, nb.z, na.x, na.y, na.z, nb.x, nb.y, nb.z, nb.x, nb.y, nb.z);
  };
  const hx = w / 2;
  const px = new THREE.Vector3(1, 0, 0);
  const mx = new THREE.Vector3(-1, 0, 0);
  for (let k = 0; k < samples; k++) {
    const A = rings[k]!;
    const B = rings[k + 1]!;
    const oA0 = A.o.clone().setX(-hx);
    const oA1 = A.o.clone().setX(hx);
    const oB0 = B.o.clone().setX(-hx);
    const oB1 = B.o.clone().setX(hx);
    const iA0 = A.i.clone().setX(-hx);
    const iA1 = A.i.clone().setX(hx);
    const iB0 = B.i.clone().setX(-hx);
    const iB1 = B.i.clone().setX(hx);
    const inA = A.n.clone().negate();
    const inB = B.n.clone().negate();
    quad(oA1, oA0, oB0, oB1, A.n, B.n); // 바깥면
    quad(iA0, iA1, iB1, iB0, inA, inB); // 안쪽면
    quad(oA0, iA0, iB0, oB0, mx, mx);
    quad(iA1, oA1, oB1, iB1, px, px);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  // 감김 방향이 섞여도 보이도록 법선 기준으로 앞면 정렬
  const p = g.getAttribute('position');
  const nm = g.getAttribute('normal');
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const vn = new THREE.Vector3();
  for (let t = 0; t < p.count; t += 3) {
    va.fromBufferAttribute(p, t);
    vb.fromBufferAttribute(p, t + 1);
    vc.fromBufferAttribute(p, t + 2);
    vn.fromBufferAttribute(nm, t);
    const face = vb.clone().sub(va).cross(vc.clone().sub(va));
    if (face.dot(vn) < 0) {
      // 두 정점 교환
      for (let c = 0; c < 3; c++) {
        const i1 = (t + 1) * 3 + c;
        const i2 = (t + 2) * 3 + c;
        const pa = p.array as Float32Array;
        const na = nm.array as Float32Array;
        [pa[i1], pa[i2]] = [pa[i2]!, pa[i1]!];
        [na[i1], na[i2]] = [na[i2]!, na[i1]!];
      }
    }
  }
  return g;
}

/** 이 홈이 있는 타이밍 풀리 외곽 (국소 각 0에 홈 중심) */
function pulleyOutline(teeth: number, ra: number, depth: number): V2[] {
  const out: V2[] = [];
  const per = 16;
  const gw = 0.26;
  for (let i = 0; i < teeth * per; i++) {
    const a = (i / (teeth * per)) * TAU;
    let u = (a / TAU) * teeth;
    u = u - Math.round(u);
    const k = Math.abs(u) < gw ? Math.sqrt(1 - (u / gw) * (u / gw)) : 0;
    const r = ra - depth * k;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly r: number,
    private readonly h: number,
    private readonly turns: number
  ) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * TAU;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      const mat = m.material as THREE.Material;
      const see = mat.transparent === true;
      m.castShadow = !see;
      m.receiveShadow = !see;
    }
  });
}

interface Cylinder {
  piston: THREE.Group;
  rod: THREE.Group;
  gas: THREE.Mesh;
  gasMat: THREE.MeshStandardMaterial;
  spark: THREE.Mesh;
  sparkMat: THREE.MeshStandardMaterial;
}

interface Valve {
  cyl: number;
  intake: boolean;
  moving: THREE.Group;
  spring: THREE.Mesh;
  dir: V2; // 캠 중심 → 밸브 방향(단위, (y,z))
  lobePhase: number;
  lift: number;
}

export class CarEngine extends BaseMachine {
  readonly id = 'engine';
  private crankPivot = new THREE.Group();
  private camPivot = new THREE.Group();
  private crankModel: THREE.Group | null = null;
  private camModel: THREE.Group | null = null;
  private cylinders: Cylinder[] = [];
  private valves: Valve[] = [];
  private profile = camProfile();
  private theta = 0;
  private belt: BeltPath;
  private crankPulleyR: number;
  private beltTeeth: THREE.InstancedMesh | null = null;
  private beltToothCount = 0;
  private camShafts: THREE.Group[] = [];
  private flashLight = new THREE.PointLight(0xff8a30, 0, 1.6, 2);

  private readonly steelMat = steel();
  private readonly darkMat = darkSteel();
  private readonly aluMat = aluminum();
  private readonly ironMat = castIron();
  private readonly rubberMat = rubber();

  constructor() {
    super();
    // 벨트 피치가 크랭크 풀리 이 간격과 정확히 같아지도록 피치원 반지름을 맞춘다
    const solve = (rp: number): BeltPath =>
      new BeltPath([
        { c: [CAM_Y, -CAM_Z], r: rp * 2 },
        { c: [CAM_Y, CAM_Z], r: rp * 2 },
        { c: [CRANK_Y, 0], r: rp }
      ]);
    const rp0 = 0.075;
    const n = Math.round(solve(rp0).length / ((TAU * rp0) / CRANK_TEETH));
    let lo = 0.065;
    let hi = 0.085;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (solve(mid).length > (n * TAU * mid) / CRANK_TEETH) lo = mid;
      else hi = mid;
    }
    this.crankPulleyR = (lo + hi) / 2;
    this.belt = solve(this.crankPulleyR);
    this.beltToothCount = n;

    this.crankPivot.position.set(0, CRANK_Y, 0);
    this.camPivot.position.set(0, CAM_Y, 0);
    this.group.add(this.crankPivot, this.camPivot);

    this.buildStand();
    this.buildBlock();
    this.buildHead();
    this.buildCylinders();
    this.buildValves();
    this.flashLight.position.set(0, DECK_Y - 0.05, 0.4);
    this.group.add(this.flashLight);

    // 슬롯: 크랭크축 양끝, 캠축 풀리 두 곳
    this.addRingSlot(0, [new THREE.Vector3(1.36, CRANK_Y, 0), new THREE.Vector3(-1.34, CRANK_Y, 0)], 0.22);
    this.addRingSlot(1, [new THREE.Vector3(BELT_X + 0.02, CAM_Y, -CAM_Z), new THREE.Vector3(BELT_X + 0.02, CAM_Y, CAM_Z)], 0.17);
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) if (s) s.castShadow = s.receiveShadow = false;
    this.setRestPose();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.crankModel !== null : this.camModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, CRANK_Y, 0) : new THREE.Vector3(0, CAM_Y, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(1.36, CRANK_Y, 0) : new THREE.Vector3(BELT_X, CAM_Y, 0);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildCrankshaft() : this.buildCamTrain();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    if (step === 0) {
      this.crankPivot.add(model);
      this.crankModel = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.camPivot.add(model);
      this.camModel = model;
      this.camShafts = [];
      this.beltTeeth = null;
      model.traverse((o) => {
        if (o.userData.camShaft) this.camShafts.push(o as THREE.Group);
        if (o.userData.beltTeeth) this.beltTeeth = o as THREE.InstancedMesh;
      });
      this.hideSlot(1);
    }
    this.applyPose(0);
  }

  reset(): void {
    if (this.crankModel) this.crankPivot.remove(this.crankModel);
    if (this.camModel) this.camPivot.remove(this.camModel);
    this.crankModel = null;
    this.camModel = null;
    this.camShafts = [];
    this.beltTeeth = null;
    this.theta = 0;
    this.showSlot(0);
    this.hideSlot(1);
    this.setRestPose();
  }

  createSim(): MachineSim {
    if (!this.crankModel || !this.camModel) throw new Error('engine mission incomplete');
    const w = (RPM / 60) * TAU;
    this.theta = 0;
    this.applyPose(0);
    return {
      update: (dt: number) => {
        this.theta = (this.theta + w * dt) % (2 * TAU);
        this.applyPose(dt);
      },
      getDisplay: (): MachineDisplayItem[] => {
        const c = this.theta % (2 * TAU);
        const stroke = STROKES[Math.min(3, Math.floor(c / Math.PI))]!;
        return [
          { label: '엔진 회전수', value: String(RPM), unit: 'rpm', tone: 'blue' },
          { label: '캠축 회전수 (1/2)', value: String(RPM / 2), unit: 'rpm' },
          { label: '1번 실린더 행정', value: stroke, tone: stroke === '폭발' ? 'red' : 'default' }
        ];
      }
    };
  }

  // ── 자세 계산 ──

  /** 크랭크 없이 피스톤이 제각각 멈춰 있는 상태 */
  private setRestPose(): void {
    const pinY = [1.53, 1.66, 1.44, 1.6];
    const tilt = [0.1, -0.13, 0.06, -0.09];
    this.cylinders.forEach((c, i) => {
      c.piston.position.y = pinY[i]!;
      c.rod.position.y = pinY[i]!;
      c.rod.rotation.x = tilt[i]!;
      c.gas.visible = false;
      c.spark.visible = false;
    });
    for (const v of this.valves) this.setValve(v, 0);
    this.flashLight.intensity = 0;
  }

  private setValve(v: Valve, lift: number): void {
    v.lift = lift;
    v.moving.position.y = -lift;
    const h = S_RETAINER - 0.006 - S_SPRING_SEAT;
    v.spring.scale.y = (h - lift) / h;
  }

  private applyPose(dt: number): void {
    const th = this.theta;
    if (this.crankModel) {
      this.crankPivot.rotation.x = th;
      this.cylinders.forEach((c, i) => {
        const a = th + THROW[i]!;
        const py = CR * Math.cos(a);
        const pz = CR * Math.sin(a);
        // 크랭크-슬라이더: 피스톤 핀은 실린더 축(z=0) 위, 로드 길이 ROD_L 일정
        const pinY = CRANK_Y + py + Math.sqrt(ROD_L * ROD_L - pz * pz);
        c.piston.position.y = pinY;
        c.rod.position.y = pinY;
        c.rod.rotation.x = Math.atan2(-pz, -(CRANK_Y + py - pinY));
      });
    }
    if (this.camModel) {
      const alpha = th / 2;
      this.camPivot.rotation.x = 0;
      for (const s of this.camShafts) s.rotation.x = alpha;
      for (const v of this.valves) {
        const beta = alpha + v.lobePhase;
        let best = -Infinity;
        for (const p of this.profile) {
          const q = rotYZ(p, beta);
          const d = q[0] * v.dir[0] + q[1] * v.dir[1];
          if (d > best) best = d;
        }
        this.setValve(v, Math.max(0, best - CAM_BASE));
      }
      if (this.beltTeeth) this.updateBeltTeeth(th * this.crankPulleyR);
    }
    // 연소실 가스: 시뮬레이션 중에만(완성 후) 행정에 따라 색·밝기
    const running = this.crankModel !== null && this.camModel !== null && dt > 0;
    let flash = 0;
    let flashX = 0;
    this.cylinders.forEach((c, i) => {
      const top = c.piston.position.y + PIN_TO_TOP;
      c.gas.position.y = top;
      c.gas.scale.y = Math.max(0.001, DECK_Y - 0.004 - top);
      if (!running) {
        c.gas.visible = false;
        c.spark.visible = false;
        return;
      }
      let cyc = (th - CYCLE_OFF[i]!) % (2 * TAU);
      if (cyc < 0) cyc += 2 * TAU;
      const k = cyc / Math.PI; // 0~4
      const m = c.gasMat;
      c.gas.visible = true;
      if (k < 1) {
        m.color.setHex(0x5fb8ff);
        m.emissive.setHex(0x2a7bd0);
        m.emissiveIntensity = 0.35;
        m.opacity = 0.18 + 0.12 * k;
      } else if (k < 2) {
        const u = k - 1;
        m.color.setHex(0x3f8cff);
        m.emissive.setHex(0x2f6cff);
        m.emissiveIntensity = 0.4 + 0.5 * u;
        m.opacity = 0.3 + 0.2 * u;
      } else if (k < 3) {
        const u = k - 2;
        const e = Math.exp(-u * 3.2);
        m.color.setRGB(1, 0.45 + 0.25 * e, 0.12);
        m.emissive.setRGB(1, 0.35 + 0.3 * e, 0.05);
        m.emissiveIntensity = 0.5 + 3.5 * e;
        m.opacity = 0.35 + 0.4 * e;
        if (e > flash) {
          flash = e;
          flashX = CYL_X[i]!;
        }
      } else {
        const u = k - 3;
        m.color.setHex(0x8b8178);
        m.emissive.setHex(0x3a332c);
        m.emissiveIntensity = 0.3;
        m.opacity = 0.32 - 0.16 * u;
      }
      // 점화 플러그 불꽃: 폭발 행정 시작 직후 잠깐
      const sparkOn = k >= 2 && k < 2.12;
      c.spark.visible = sparkOn;
      c.sparkMat.emissiveIntensity = sparkOn ? 4 * (1 - (k - 2) / 0.12) + 1 : 0;
    });
    this.flashLight.intensity = 2.6 * flash;
    this.flashLight.position.x = flashX;
  }

  private updateBeltTeeth(s0: number): void {
    const im = this.beltTeeth;
    if (!im) return;
    const m = new THREE.Matrix4();
    const X = new THREE.Vector3(1, 0, 0);
    const N = new THREE.Vector3();
    const T = new THREE.Vector3();
    const step = this.belt.length / this.beltToothCount;
    for (let k = 0; k < this.beltToothCount; k++) {
      const q = this.belt.at(s0 + k * step);
      N.set(0, q.n[0], q.n[1]);
      T.set(0, q.t[0], q.t[1]);
      m.makeBasis(X, N, T);
      m.setPosition(BELT_X, q.p[0] - CAM_Y - q.n[0] * 0.008, q.p[1] - q.n[1] * 0.008);
      im.setMatrixAt(k, m);
    }
    im.instanceMatrix.needsUpdate = true;
  }

  // ── 미션 부품 ──

  private buildCrankshaft(): THREE.Group {
    const g = new THREE.Group();
    const journalGeos: THREE.BufferGeometry[] = [];
    const webGeos: THREE.BufferGeometry[] = [];
    const pinR = 0.06;
    const mainR = 0.07;
    const pinHalf = 0.07;
    const webT = 0.07;
    // 메인 저널(사이 구간 전체) + 앞 스너트 + 뒤 플랜지
    const spans: [number, number][] = [
      [-1.25, CYL_X[3] - pinHalf - webT],
      [CYL_X[3] + pinHalf + webT, CYL_X[2] - pinHalf - webT],
      [CYL_X[2] + pinHalf + webT, CYL_X[1] - pinHalf - webT],
      [CYL_X[1] + pinHalf + webT, CYL_X[0] - pinHalf - webT],
      [CYL_X[0] + pinHalf + webT, 1.2]
    ];
    for (const [x0, x1] of spans) journalGeos.push(rodX(mainR, x0, x1, 0.008, 36));
    journalGeos.push(rodX(0.05, 1.2, 1.44, 0.006, 28));
    // 크랭크 웜: 핀 쪽 둥근 팔 + 반대쪽 균형추
    const web = new THREE.Shape();
    web.absarc(0, CR, 0.085, 0, Math.PI, false);
    web.lineTo(-0.075, 0.02);
    web.absarc(0, 0, 0.215, Math.PI + 0.35, TAU - 0.35, false);
    web.lineTo(0.075, 0.02);
    web.closePath();
    const webGeo = plateX(web, webT, 0.012, 32);
    CYL_X.forEach((x, i) => {
      const th = THROW[i]!;
      for (const sx of [-1, 1]) {
        const w = webGeo.clone();
        w.rotateX(th);
        w.translate(x + sx * (pinHalf + webT / 2), 0, 0);
        webGeos.push(w);
      }
      const pin = rodX(pinR, x - pinHalf - 0.004, x + pinHalf + 0.004, 0.004, 32);
      pin.translate(0, CR, 0);
      pin.rotateX(th);
      journalGeos.push(pin);
    });
    webGeo.dispose();
    g.add(new THREE.Mesh(merge(journalGeos), this.steelMat));
    g.add(new THREE.Mesh(merge(webGeos), paint(0x2f6fb5, { roughness: 0.35, metalness: 0.5 })));

    // 플라이휠(링 기어)
    const fly = buildSpurGearMesh(96, 0.31, 0.014, 0.05, 0x58626d);
    fly.material = darkSteel();
    fly.geometry.rotateY(Math.PI / 2);
    fly.position.x = -1.3;
    g.add(fly);
    const flyDisc = new THREE.Mesh(
      latheX([
        [0.05, -1.36],
        [0.28, -1.36],
        [0.29, -1.35],
        [0.29, -1.25],
        [0.28, -1.24],
        [0.05, -1.24]
      ], 64),
      this.ironMat
    );
    g.add(flyDisc);
    const boltGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6);
    boltGeo.rotateZ(Math.PI / 2);
    const bolts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const b = boltGeo.clone();
      b.translate(-1.375, Math.cos(a) * 0.09, Math.sin(a) * 0.09);
      bolts.push(b);
    }
    // 회전이 읽히도록 플라이휠에 흰 표시
    g.add(new THREE.Mesh(merge(bolts), this.steelMat));
    const mark = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.09, 0.03, 1, 0.004), plastic(0xf2f2f2, { grain: false }));
    mark.position.set(-1.366, 0.2, 0);
    g.add(mark);
    boltGeo.dispose();

    // 크랭크 타이밍 풀리 + 크랭크 풀리(V벨트)
    g.add(this.timingPulley(CRANK_TEETH, this.crankPulleyR, [CRANK_Y, 0], this.belt.contactAngle[2]!, 0));
    const vp = new THREE.Mesh(
      latheX([
        [0.05, 1.33],
        [0.13, 1.33],
        [0.135, 1.336],
        [0.135, 1.35],
        [0.11, 1.37],
        [0.135, 1.39],
        [0.135, 1.404],
        [0.13, 1.41],
        [0.05, 1.41]
      ], 56),
      this.darkMat
    );
    g.add(vp);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 6), this.steelMat);
    nut.rotation.z = Math.PI / 2;
    nut.position.x = 1.43;
    g.add(nut);
    return g;
  }

  /** 타이밍 풀리: 피치원 rp, 홈이 벨트 이와 맞도록 위상 정렬(contact: 감김 중앙 각, base: 축 초기 회전) */
  private timingPulley(teeth: number, rp: number, center: V2, contact: number, base: number): THREE.Group {
    const g = new THREE.Group();
    const shape = shapeFrom(pulleyOutline(teeth, rp - 0.002, 0.014));
    shape.holes.push(pathFrom(circlePts(0.03, 24).reverse()));
    const geo = plateX(shape, BELT_W + 0.004, 0.003, 4);
    // plateX 후 국소각 φ → 세계 (y,z) 각 φ - π/2
    const step = TAU / teeth;
    const m = new THREE.Mesh(geo, this.aluMat);
    // 벨트 이 하나가 감김 중앙에 오는 각을 찾아 홈을 맞춘다
    const q = this.nearestToothAngle(center, contact, rp);
    m.rotation.x = ((((q + Math.PI / 2 - base) % step) + step) % step);
    m.position.x = BELT_X;
    g.add(m);
    const flangeGeo = latheX([
      [0.03, -0.004],
      [rp + 0.012, -0.004],
      [rp + 0.012, 0.004],
      [0.03, 0.004]
    ], 56);
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(flangeGeo, this.darkMat);
      f.position.x = BELT_X + sx * (BELT_W / 2 + 0.006);
      g.add(f);
    }
    const hub = new THREE.Mesh(rodX(0.045, BELT_X - BELT_W / 2 - 0.035, BELT_X - BELT_W / 2 - 0.009, 0.005, 32), this.darkMat);
    const boss = new THREE.Mesh(rodX(0.04, BELT_X + BELT_W / 2 + 0.009, BELT_X + BELT_W / 2 + 0.03, 0.006, 32), this.darkMat);
    g.add(hub, boss);
    return g;
  }

  /** θ=0일 때 벨트 이(호장 k·pitch) 중 감김 중앙 각에 가장 가까운 이의 각 */
  private nearestToothAngle(c: V2, contact: number, rp: number): number {
    const step = this.belt.length / this.beltToothCount;
    let bestA = contact;
    let bestD = Infinity;
    for (let k = 0; k < this.beltToothCount; k++) {
      const q = this.belt.at(k * step);
      const dy = q.p[0] - c[0];
      const dz = q.p[1] - c[1];
      if (Math.abs(Math.hypot(dy, dz) - rp) > 0.003) continue;
      const a = Math.atan2(dz, dy);
      let d = Math.abs(a - contact) % TAU;
      if (d > Math.PI) d = TAU - d;
      if (d < bestD) {
        bestD = d;
        bestA = a;
      }
    }
    return bestA;
  }

  private buildCamTrain(): THREE.Group {
    const g = new THREE.Group();
    const lobeShape = shapeFrom(this.profile.map(([y, z]) => [-z, y] as V2));
    const lobeGeo = plateX(lobeShape, CAM_W, 0.008, 4);
    const lobeMat = paint(0xc8483f, { roughness: 0.4, metalness: 0.4 });
    const rpCam = this.crankPulleyR * 2;
    for (const intake of [true, false]) {
      const shaft = new THREE.Group();
      const z = intake ? -CAM_Z : CAM_Z;
      shaft.position.set(0, 0, z);
      const geos: THREE.BufferGeometry[] = [rodX(0.03, -1.12, BELT_X + BELT_W / 2 + 0.04, 0.005, 24)];
      for (const x of MAIN_X) geos.push(rodX(0.04, x - 0.035, x + 0.035, 0.004, 28));
      shaft.add(new THREE.Mesh(merge(geos), this.steelMat));
      const lobes: THREE.BufferGeometry[] = [];
      this.valves
        .filter((v) => v.intake === intake)
        .forEach((v) => {
          const l = lobeGeo.clone();
          l.rotateX(v.lobePhase);
          l.translate(CYL_X[v.cyl]!, 0, 0);
          lobes.push(l);
        });
      shaft.add(new THREE.Mesh(merge(lobes), lobeMat));
      // 캠 풀리(40잇) — 축 국소 좌표 (y,z)=0 이 축 중심
      const circleIdx = intake ? 0 : 1;
      shaft.add(this.timingPulley(CAM_TEETH, rpCam, [CAM_Y, z], this.belt.contactAngle[circleIdx]!, 0));
      shaft.userData.camShaft = true;
      g.add(shaft);
    }
    lobeGeo.dispose();

    // 타이밍 벨트 (경로 좌표는 세계 (y,z) → camPivot 국소로 y - CAM_Y)
    const ribbon = ribbonGeo(this.belt, 0.006, 0.014, BELT_W);
    ribbon.translate(BELT_X, -CAM_Y, 0);
    const beltMat = rubber({ color: 0x24272c });
    g.add(new THREE.Mesh(ribbon, beltMat));
    const toothGeo = new THREE.BoxGeometry(BELT_W, 0.014, (this.belt.length / this.beltToothCount) * 0.42);
    const teeth = new THREE.InstancedMesh(toothGeo, beltMat, this.beltToothCount);
    teeth.frustumCulled = false;
    teeth.userData.beltTeeth = true;
    g.add(teeth);
    return g;
  }

  // ── 고정 구조 ──

  private addRingSlot(step: number, centers: THREE.Vector3[], r: number): void {
    const geos = centers.map((c) => {
      const t = new THREE.TorusGeometry(r, 0.024, 10, 48);
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
    const base = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.08, 1.5, 3, 0.03), baseMat);
    base.position.y = 0.04;
    this.group.add(base);
    const legH = 0.5;
    const legGeo = new RoundedBoxGeometry(0.1, legH, 0.1, 2, 0.02);
    const padGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.02, 24);
    const railGeo = new RoundedBoxGeometry(2.0, 0.06, 0.1, 2, 0.02);
    const railY = 0.08 + legH + 0.03 - 0.01;
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, baseMat);
        leg.position.set(sx * 0.95, 0.08 + legH / 2 - 0.01, sz * 0.4);
        this.group.add(leg);
      }
      // 다리 위 세로 받침 + 방진 고무(팬 플랜지 밑)
      const r = new THREE.Mesh(railGeo, baseMat);
      r.position.set(0, railY, sz * 0.4);
      this.group.add(r);
      for (const px of [-0.9, -0.3, 0.3, 0.9]) {
        const pad = new THREE.Mesh(padGeo, this.rubberMat);
        pad.position.set(px, railY + 0.03 + 0.01, sz * 0.4);
        this.group.add(pad);
      }
    }
  }

  private buildBlock(): void {
    // 오일팬 (불투명 주철): 플랜지 + 아래로 좁아지는 팬
    const flange = new THREE.Mesh(new RoundedBoxGeometry(2.36, 0.04, 0.9, 2, 0.015), this.ironMat);
    flange.position.y = PAN_TOP - 0.02;
    this.group.add(flange);
    const panShape = new THREE.Shape();
    panShape.moveTo(-1.1, PAN_TOP - 0.04);
    panShape.lineTo(1.1, PAN_TOP - 0.04);
    panShape.lineTo(1.02, 0.5);
    panShape.lineTo(0.2, 0.5);
    panShape.lineTo(0.1, 0.36);
    panShape.lineTo(-1.0, 0.36);
    panShape.lineTo(-1.08, 0.5);
    panShape.closePath();
    const pan = new THREE.Mesh(extrude(panShape, 0.56, 0.03, 4, 2), this.ironMat);
    this.group.add(pan);
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 6), this.steelMat);
    plug.rotation.z = Math.PI / 2;
    plug.position.set(-1.015, 0.42, 0.1);
    this.group.add(plug);

    // 메인 베어링 격벽(불투명) — 크랭크 저널을 받친다
    const bulk = roundedRect(-BLOCK_Z + 0.02, PAN_TOP, BLOCK_Z - 0.02, 1.2, 0.02);
    bulk.holes.push(pathFrom(circlePts(0.09, 40, 0, CRANK_Y).reverse()));
    const bulkGeo = plateX(bulk, 0.08, 0.01, 24);
    const shellGeo = latheX([
      [0.071, -0.045],
      [0.09, -0.045],
      [0.09, 0.045],
      [0.071, 0.045]
    ], 40);
    const shellMat = bronze();
    MAIN_X.forEach((x) => {
      const b = new THREE.Mesh(bulkGeo, this.ironMat);
      b.position.x = x;
      this.group.add(b);
      const s = new THREE.Mesh(shellGeo, shellMat);
      s.position.set(x, CRANK_Y, 0);
      this.group.add(s);
    });

    // 블록 뒷벽(불투명, 내부가 잘 보이도록 배경 역할)
    const back = new THREE.Mesh(new RoundedBoxGeometry(2 * BLOCK_X, DECK_Y - PAN_TOP, 0.04, 2, 0.012), this.ironMat);
    back.position.set(0, (DECK_Y + PAN_TOP) / 2, -BLOCK_Z - 0.02);
    this.group.add(back);

    // 블록(반투명) 껍데기
    const blockMat = ghost(0x9fb4c8, 0.2);
    const block = new THREE.Mesh(new RoundedBoxGeometry(2 * BLOCK_X, DECK_Y - PAN_TOP, 2 * BLOCK_Z, 3, 0.03), blockMat);
    block.position.y = (DECK_Y + PAN_TOP) / 2;
    block.renderOrder = 2;
    this.group.add(block);
    // 실린더 보어 윤곽(위·아래 링) — 반투명 블록 안에서 실린더가 읽히게
    const ringGeo = new THREE.TorusGeometry(BORE_R, 0.006, 8, 48);
    ringGeo.rotateX(Math.PI / 2);
    const rings: THREE.BufferGeometry[] = [];
    for (const x of CYL_X) {
      for (const y of [1.2, 1.5, DECK_Y - 0.01]) {
        const r = ringGeo.clone();
        r.translate(x, y, 0);
        rings.push(r);
      }
    }
    ringGeo.dispose();
    this.group.add(new THREE.Mesh(merge(rings), this.aluMat));
    // 보어 벽(아주 옅게)
    const linerMat = ghost(0xb7c6d4, 0.12);
    const linerGeo = new THREE.CylinderGeometry(BORE_R, BORE_R, DECK_Y - 1.2, 40, 1, true);
    for (const x of CYL_X) {
      const l = new THREE.Mesh(linerGeo, linerMat);
      l.position.set(x, (DECK_Y + 1.2) / 2, 0);
      l.renderOrder = 1;
      this.group.add(l);
    }
    // 블록 모서리 윤곽
    this.edgeFrame(2 * BLOCK_X, PAN_TOP, DECK_Y, 2 * BLOCK_Z);

    // 헤드 개스킷(보어 구멍이 뚫린 얇은 판)
    const gasket = roundedRect(-BLOCK_X, -BLOCK_Z, BLOCK_X, BLOCK_Z, 0.03);
    for (const x of CYL_X) gasket.holes.push(pathFrom(circlePts(BORE_R, 48, x, 0).reverse()));
    const gGeo = extrude(gasket, 0.012, 0.002, 24);
    gGeo.rotateX(Math.PI / 2);
    const gk = new THREE.Mesh(gGeo, this.darkMat);
    gk.position.y = DECK_Y;
    this.group.add(gk);
  }

  /** 반투명 상자의 세로·가로 모서리에 가는 알루미늄 테 */
  private edgeFrame(w: number, y0: number, y1: number, d: number): void {
    const r = 0.008;
    const geos: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const v = new THREE.CylinderGeometry(r, r, y1 - y0, 8);
        v.translate(sx * (w / 2 - 0.004), (y0 + y1) / 2, sz * (d / 2 - 0.004));
        geos.push(v);
      }
    }
    for (const y of [y0 + 0.004, y1 - 0.004]) {
      for (const sz of [-1, 1]) {
        const h = new THREE.CylinderGeometry(r, r, w, 8);
        h.rotateZ(Math.PI / 2);
        h.translate(0, y, sz * (d / 2 - 0.004));
        geos.push(h);
      }
      for (const sx of [-1, 1]) {
        const h = new THREE.CylinderGeometry(r, r, d, 8);
        h.rotateX(Math.PI / 2);
        h.translate(sx * (w / 2 - 0.004), y, 0);
        geos.push(h);
      }
    }
    this.group.add(new THREE.Mesh(merge(geos), this.aluMat));
  }

  private buildHead(): void {
    const headMat = ghost(0xa8bccd, 0.2);
    const head = new THREE.Mesh(new RoundedBoxGeometry(2 * BLOCK_X, HEAD_TOP - DECK_Y - 0.006, 2 * HEAD_Z, 3, 0.03), headMat);
    head.position.y = (HEAD_TOP + DECK_Y + 0.006) / 2;
    head.renderOrder = 2;
    this.group.add(head);
    const coverMat = ghost(0xd0574c, 0.22);
    const cover = new THREE.Mesh(new RoundedBoxGeometry(2 * BLOCK_X - 0.04, COVER_TOP - HEAD_TOP, 2 * HEAD_Z - 0.06, 4, 0.07), coverMat);
    cover.position.y = (COVER_TOP + HEAD_TOP) / 2;
    cover.renderOrder = 2;
    this.group.add(cover);
    this.edgeFrame(2 * BLOCK_X, DECK_Y + 0.006, HEAD_TOP, 2 * HEAD_Z);
    // 헤드 윗면 테두리(커버 경계)
    // 가운데가 비어 보이도록 테두리만: 앞뒤·좌우 띠 4개
    const bandX = new RoundedBoxGeometry(2 * BLOCK_X + 0.01, 0.018, 0.035, 2, 0.008);
    const bandZ = new RoundedBoxGeometry(0.035, 0.018, 2 * HEAD_Z + 0.01, 2, 0.008);
    for (const sz of [-1, 1]) {
      const b = new THREE.Mesh(bandX, this.aluMat);
      b.position.set(0, HEAD_TOP, sz * (HEAD_Z - 0.012));
      this.group.add(b);
    }
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(bandZ, this.aluMat);
      b.position.set(sx * (BLOCK_X - 0.012), HEAD_TOP, 0);
      this.group.add(b);
    }

    // 캠 베어링 캡(불투명 알루미늄) — 캠축이 놓일 자리
    const cap = roundedRect(-0.07, -0.055, 0.07, 0.055, 0.02);
    cap.holes.push(pathFrom(circlePts(0.042, 32).reverse()));
    const capGeo = plateX(cap, 0.06, 0.008, 16);
    const capMat = aluminum({ color: 0xc9d0d8 });
    const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6);
    const capBolts: THREE.BufferGeometry[] = [];
    for (const x of MAIN_X) {
      for (const sz of [-1, 1]) {
        const c = new THREE.Mesh(capGeo, capMat);
        c.position.set(x, CAM_Y, sz * CAM_Z);
        this.group.add(c);
        for (const bz of [-1, 1]) {
          capBolts.push(boltGeo.clone().translate(x, CAM_Y + 0.062, sz * CAM_Z + bz * 0.052));
        }
      }
    }
    this.group.add(new THREE.Mesh(merge(capBolts), this.steelMat));
    boltGeo.dispose();
    // 앞쪽 캠 실(seal) 하우징 — 캠축 앞끝이 나오는 곳
    const sealGeo = rodX(0.05, BLOCK_X - 0.01, BLOCK_X + 0.03, 0.006, 32);
    for (const sz of [-1, 1]) {
      const s = new THREE.Mesh(sealGeo, this.darkMat);
      s.position.set(0, CAM_Y, sz * CAM_Z);
      this.group.add(s);
    }
    const crankSeal = new THREE.Mesh(rodX(0.085, BLOCK_X - 0.01, BLOCK_X + 0.03, 0.006, 40), this.darkMat);
    crankSeal.position.y = CRANK_Y;
    this.group.add(crankSeal);
    const rearSeal = new THREE.Mesh(rodX(0.1, -BLOCK_X - 0.05, -BLOCK_X + 0.01, 0.006, 40), this.darkMat);
    rearSeal.position.y = CRANK_Y;
    this.group.add(rearSeal);

    // 점화 플러그(헤드 가운데) + 플러그 캡
    const plugGeo = lathe(
      [
        [0, DECK_Y - 0.004],
        [0.012, DECK_Y - 0.004],
        [0.016, DECK_Y + 0.05],
        [0.02, DECK_Y + 0.06],
        [0.02, DECK_Y + 0.16],
        [0.022, DECK_Y + 0.17],
        [0, DECK_Y + 0.17]
      ],
      20
    );
    const ceramicGeo = lathe(
      [
        [0, DECK_Y + 0.16],
        [0.016, DECK_Y + 0.16],
        [0.016, COVER_TOP - 0.02],
        [0, COVER_TOP - 0.02]
      ],
      20
    );
    const bootGeo = lathe(
      [
        [0, COVER_TOP - 0.03],
        [0.03, COVER_TOP - 0.03],
        [0.034, COVER_TOP + 0.04],
        [0.026, COVER_TOP + 0.09],
        [0, COVER_TOP + 0.09]
      ],
      24
    );
    const plugMat = this.steelMat;
    const ceramic = plastic(0xf0ede6, { roughness: 0.3, grain: false });
    const bootMat = rubber({ color: 0x2b2d31 });
    for (const x of CYL_X) {
      const p = new THREE.Mesh(plugGeo, plugMat);
      p.position.x = x;
      const c = new THREE.Mesh(ceramicGeo, ceramic);
      c.position.x = x;
      const b = new THREE.Mesh(bootGeo, bootMat);
      b.position.x = x;
      this.group.add(p, c, b);
    }
    // 점화 케이블 레일
    const rail = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.03, 0.08, 2, 0.012), bootMat);
    rail.position.set(0, COVER_TOP + 0.075, 0);
    this.group.add(rail);

    // 흡기 매니폴드(뒤쪽): 러너 4개 + 서지 탱크
    const intakeMat = aluminum({ color: 0xbfc6ce });
    const runners: THREE.BufferGeometry[] = [];
    for (const x of CYL_X) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 2.06, -HEAD_Z + 0.02),
        new THREE.Vector3(x, 2.08, -HEAD_Z - 0.14),
        new THREE.Vector3(x, 2.18, -HEAD_Z - 0.28),
        new THREE.Vector3(x, 2.3, -HEAD_Z - 0.33)
      ]);
      runners.push(new THREE.TubeGeometry(curve, 24, 0.052, 20, false));
      const fl = new RoundedBoxGeometry(0.16, 0.14, 0.03, 2, 0.01);
      fl.translate(x, 2.06, -HEAD_Z - 0.01);
      runners.push(fl);
    }
    const plenum = new THREE.Mesh(rodX(0.13, -1.05, 1.0, 0.04, 40), intakeMat);
    plenum.position.set(0, 2.36, -HEAD_Z - 0.36);
    this.group.add(plenum);
    const throttle = new THREE.Mesh(rodX(0.09, -1.2, -1.04, 0.01, 32), this.darkMat);
    throttle.position.set(0, 2.36, -HEAD_Z - 0.36);
    this.group.add(throttle);
    this.group.add(new THREE.Mesh(merge(runners), intakeMat));

    // 배기 포트(앞쪽): 플랜지 + 아래로 꺾인 짧은 주철 관(끝은 매니폴드 접속 플랜지)
    const exGeos: THREE.BufferGeometry[] = [];
    const exProf: V2[] = [
      [0.034, 0],
      [0.048, 0],
      [0.048, 0.1],
      [0.07, 0.1],
      [0.07, 0.125],
      [0.034, 0.125]
    ];
    for (const x of CYL_X) {
      const fl = new RoundedBoxGeometry(0.15, 0.13, 0.03, 2, 0.01);
      fl.translate(x, 2.06, HEAD_Z + 0.01);
      exGeos.push(fl);
      const pipe = lathe(exProf, 28);
      pipe.rotateX(Math.PI / 2 + 0.6);
      pipe.translate(x, 2.06, HEAD_Z + 0.02);
      exGeos.push(pipe);
    }
    this.group.add(new THREE.Mesh(merge(exGeos), castIron({ color: 0x4a3f38 })));
  }

  private buildCylinders(): void {
    // 피스톤(링 홈 포함) — 국소 원점 = 피스톤 핀
    const pr = PISTON_R;
    const prof: V2[] = [
      [0, -SKIRT],
      [pr - 0.006, -SKIRT],
      [pr, -SKIRT + 0.006],
      [pr, 0.03],
      [pr - 0.007, 0.032],
      [pr - 0.007, 0.042],
      [pr, 0.044],
      [pr, 0.056],
      [pr - 0.007, 0.058],
      [pr - 0.007, 0.066],
      [pr, 0.068],
      [pr, 0.076],
      [pr - 0.007, 0.078],
      [pr - 0.007, 0.086],
      [pr, 0.088],
      [pr, PIN_TO_TOP - 0.006],
      [pr - 0.006, PIN_TO_TOP],
      [pr * 0.55, PIN_TO_TOP],
      [0, PIN_TO_TOP - 0.012]
    ];
    const pistonGeo = lathe(prof, 56);
    const pistonMat = aluminum({ color: 0xd2d7dd });
    const ringMat = darkSteel();
    const ringGeo = new THREE.TorusGeometry(pr - 0.003, 0.004, 6, 56);
    ringGeo.rotateX(Math.PI / 2);
    const ringsGeo = merge([0.037, 0.062, 0.082].map((y) => ringGeo.clone().translate(0, y, 0)));
    ringGeo.dispose();

    // 커넥팅 로드(국소 원점 = 소단부, -y 로 ROD_L)
    const rodShape = new THREE.Shape();
    rodShape.absarc(0, 0, 0.046, -0.75, Math.PI + 0.75, false);
    rodShape.lineTo(-0.045, -ROD_L + 0.11);
    rodShape.absarc(0, -ROD_L, 0.088, Math.PI - 0.55, TAU + 0.55, false);
    rodShape.lineTo(0.045, -ROD_L + 0.11);
    rodShape.closePath();
    rodShape.holes.push(pathFrom(circlePts(0.022, 24).reverse()));
    rodShape.holes.push(pathFrom(circlePts(0.061, 40, 0, -ROD_L).reverse()));
    const rodGeo = plateX(rodShape, 0.066, 0.01, 24);
    // 로드 캡 경계 + 볼트
    const capLine = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.008, 0.19, 1, 0.003), this.darkMat);
    const rodMat = steel({ color: 0xaeb6bf });
    const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.09, 10);
    const pinGeo = rodX(0.022, -0.09, 0.09, 0.003, 20);

    const gasGeo = new THREE.CylinderGeometry(PISTON_R, PISTON_R, 1, 40, 1);
    gasGeo.translate(0, 0.5, 0);
    const sparkGeo = new THREE.SphereGeometry(0.022, 16, 10);

    CYL_X.forEach((x) => {
      const piston = new THREE.Group();
      piston.position.x = x;
      piston.add(new THREE.Mesh(pistonGeo, pistonMat));
      piston.add(new THREE.Mesh(ringsGeo, ringMat));
      piston.add(new THREE.Mesh(pinGeo, this.steelMat));
      this.group.add(piston);

      const rod = new THREE.Group();
      rod.position.x = x;
      rod.add(new THREE.Mesh(rodGeo, rodMat));
      const cl = capLine.clone();
      cl.position.y = -ROD_L + 0.0;
      rod.add(cl);
      for (const sz of [-1, 1]) {
        const b = new THREE.Mesh(boltGeo, this.darkMat);
        b.position.set(0, -ROD_L, sz * 0.072);
        rod.add(b);
      }
      this.group.add(rod);

      const gasMat = glow(0x5fb8ff, 0.4);
      gasMat.transparent = true;
      gasMat.opacity = 0.3;
      gasMat.depthWrite = false;
      const gas = new THREE.Mesh(gasGeo, gasMat);
      gas.position.x = x;
      gas.visible = false;
      gas.userData.noAO = true;
      gas.renderOrder = 1;
      this.group.add(gas);

      const sparkMat = glow(0xfff2a8, 3);
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.set(x, DECK_Y - 0.012, 0);
      spark.visible = false;
      spark.userData.noAO = true;
      this.group.add(spark);
      this.cylinders.push({ piston, rod, gas, gasMat, spark, sparkMat });
    });
  }

  private buildValves(): void {
    // 밸브(국소 +y = 밸브 축, 원점 = 밸브 시트 중심)
    const valveGeo = lathe(
      [
        [0, -0.004],
        [VALVE_HEAD_R - 0.004, -0.004],
        [VALVE_HEAD_R, 0.002],
        [VALVE_HEAD_R - 0.004, 0.01],
        [0.03, 0.026],
        [0.014, 0.05],
        [0.011, 0.07],
        [0.011, S_RETAINER + 0.02],
        [0, S_RETAINER + 0.02]
      ],
      36
    );
    const retGeo = lathe(
      [
        [0.011, S_RETAINER - 0.006],
        [0.036, S_RETAINER - 0.006],
        [0.036, S_RETAINER + 0.004],
        [0.022, S_RETAINER + 0.014],
        [0.011, S_RETAINER + 0.014]
      ],
      28
    );
    const bucketGeo = lathe(
      [
        [0, S_BUCKET_TOP - 0.05],
        [0.04, S_BUCKET_TOP - 0.05],
        [0.042, S_BUCKET_TOP - 0.046],
        [0.042, S_BUCKET_TOP - 0.004],
        [0.038, S_BUCKET_TOP],
        [0, S_BUCKET_TOP]
      ],
      32
    );
    const springH = S_RETAINER - 0.006 - S_SPRING_SEAT;
    const springGeo = new THREE.TubeGeometry(new Helix(0.028, springH, 6), 160, 0.0055, 8, false);
    const seatGeo = lathe(
      [
        [0.011, S_SPRING_SEAT - 0.012],
        [0.036, S_SPRING_SEAT - 0.012],
        [0.036, S_SPRING_SEAT],
        [0.011, S_SPRING_SEAT]
      ],
      28
    );
    const guideGeo = lathe(
      [
        [0.011, 0.07],
        [0.02, 0.07],
        [0.02, S_SPRING_SEAT - 0.012],
        [0.011, S_SPRING_SEAT - 0.012]
      ],
      20
    );
    const intakeMat = steel({ color: 0xd9dfe6 });
    const exhaustMat = steel({ color: 0x9c8a7a, roughness: 0.45 });
    const springMat = steel({ color: 0x7fb3e6, roughness: 0.3 });
    const bucketMat = this.steelMat;
    const fixedMat = this.darkMat;

    CYL_X.forEach((x, ci) => {
      for (const intake of [true, false]) {
        const sz = intake ? -1 : 1;
        const psi = intake ? -TILT : TILT;
        const root = new THREE.Group();
        root.position.set(x, DECK_Y, sz * VALVE_Z0);
        root.rotation.x = psi;
        const moving = new THREE.Group();
        moving.add(new THREE.Mesh(valveGeo, intake ? intakeMat : exhaustMat));
        moving.add(new THREE.Mesh(retGeo, this.steelMat));
        moving.add(new THREE.Mesh(bucketGeo, bucketMat));
        root.add(moving);
        const spring = new THREE.Mesh(springGeo, springMat);
        spring.position.y = S_SPRING_SEAT;
        root.add(spring);
        root.add(new THREE.Mesh(seatGeo, fixedMat));
        root.add(new THREE.Mesh(guideGeo, fixedMat));
        this.group.add(root);
        // 캠 중심 → 밸브 방향 = -(밸브 축)
        const dir: V2 = [-Math.cos(psi), -Math.sin(psi)];
        const peak = intake ? INTAKE_PEAK : EXHAUST_PEAK;
        const alphaPeak = (CYCLE_OFF[ci]! + peak) / 2;
        this.valves.push({ cyl: ci, intake, moving, spring, dir, lobePhase: psi - alphaPeak, lift: 0 });
      }
    });
  }
}
