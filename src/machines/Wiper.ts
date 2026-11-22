// 와이퍼: 웜과 웜 기어, 링크 미션 — 모터 3000rpm → 웜(1줄)·웜 휠(50잇수) 1/50 감속 → 크랭크 60rpm
// → 크랭크-로커 4절 링크(실제로 풀이) → 평행 4절 링크 → 와이퍼 암 2개가 100° 왕복.
// 앞유리 국소 좌표계(gf): X = 차 폭, Y = 유리 법선, Z = 유리를 따라 아래(보닛 쪽). 평면 좌표 (x, u=-z).
// 모든 피벗 축이 국소 Y에 평행하므로 링크는 평면 기구 — 원-원 교점으로 정확히 풀고 로드 길이는 변하지 않는다.
// 블레이드는 곡면 유리에 눌려 휘는 고무 블레이드처럼 매 프레임 유리 높이를 따라 다시 만든다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gearShape } from '../models/factory';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';
import { aluminum, bronze, copper, darkSteel, ghost, glass, glow, paint, plastic, rubber, steel } from '../models/materials';

// ── 유리 좌표계 ──
const TILT = (40 * Math.PI) / 180;
const G0 = new THREE.Vector3(0, 1.25, 0.55);
const EX = new THREE.Vector3(1, 0, 0);
const NY = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
const NZ = new THREE.Vector3(0, -Math.sin(TILT), Math.cos(TILT));
const GF_MATRIX = new THREE.Matrix4().makeBasis(EX, NY, NZ).setPosition(G0);
const GF_QUAT = new THREE.Quaternion().setFromRotationMatrix(GF_MATRIX);
const RX = 14; // 좌우 곡률 반지름
const RZ = 30; // 상하 곡률 반지름
const GLASS_H = 2.35;
const glassHalfW = (b: number): number => 2.25 - 0.3 * (b / GLASS_H);
/** 유리(및 연장 곡면) 높이 — 국소 Y */
const surfY = (x: number, z: number): number => -(x * x) / (2 * RX) - (z * z) / (2 * RZ);

// ── 링크 설계 (평면 좌표 x,u) ──
const D = Math.PI / 180;
const PA = new THREE.Vector2(-1.25, -0.07);
const PB = new THREE.Vector2(0.45, -0.07);
const R1 = 0.2; // 피벗 B 레버(크랭크 쪽)
const R2 = 0.2; // 평행 링크 레버
const SWING = 100 * D;
const MU = -110 * D; // 레버 B 1번 팔의 흔들림 중심 방향
const L1 = 0.9; // 크랭크 연결 로드
const CR = R1 * Math.sin(SWING / 2); // 크랭크 반지름: 시간비 1인 크랭크-로커 조건
const CC = new THREE.Vector2(
  PB.x + R1 * Math.cos(SWING / 2) * Math.cos(MU) - L1 * Math.sin(MU),
  PB.y + R1 * Math.cos(SWING / 2) * Math.sin(MU) + L1 * Math.cos(MU)
);
const PSI_MIN = 7.5 * D;
const BETA1 = MU - SWING / 2 - PSI_MIN; // 레버 B 1번 팔 = ψ + β1
const BETA2 = -90 * D - (PSI_MIN + SWING / 2); // 평행 링크 팔 = ψ + β2 (흔들림 중심이 -90°)
const L2 = PB.x - PA.x;

// 층(국소 Y)
const Y_FRAME = -0.24;
const Y_GEAR = -0.26;
const Y_CRANK = -0.36;
const Y_ROD1 = -0.42;
const Y_LEV1 = -0.48;
const Y_LEV2 = -0.54;
const Y_ROD2 = -0.6;

// 기어
const WHEEL_TEETH = 50;
const WHEEL_R = 0.24;
const WORM_R = 0.055; // 피치원
const WORM_PITCH = (2 * Math.PI * (WHEEL_R - 0.01)) / WHEEL_TEETH;
const WORM_Z = -CC.y - (WHEEL_R - 0.01 + WORM_R); // 웜 축은 유리 쪽(국소 z 작은 쪽)
const MOTOR_RPM = 3000;
const WHEEL_RPM = MOTOR_RPM / WHEEL_TEETH;
const W_WHEEL = (WHEEL_RPM / 60) * Math.PI * 2;
const W_MOTOR_VIS = 5 * Math.PI * 2; // 화면 표시용 모터 회전(초당 5바퀴 — 실제 50바퀴는 깜빡임으로 보임)

// 와이퍼 암
const ARMS = [
  { pivot: PA, len: 1.25, blade: 1.2 },
  { pivot: PB, len: 1.05, blade: 1.0 }
] as const;
const HINGE_S = 0.2;
const HINGE_H = 0.1;
const BLADE_H = 0.05;
const BLADE_N = 26;

const DROPS = 170;

const toLocal = (p: THREE.Vector2, y: number): THREE.Vector3 => new THREE.Vector3(p.x, y, -p.y);

function circleHit(c0: THREE.Vector2, r0: number, c1: THREE.Vector2, r1: number, near: THREE.Vector2): THREE.Vector2 {
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy);
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = c0.x + (a * dx) / d;
  const my = c0.y + (a * dy) / d;
  const s1 = new THREE.Vector2(mx - (h * dy) / d, my + (h * dx) / d);
  const s2 = new THREE.Vector2(mx + (h * dy) / d, my - (h * dx) / d);
  return s1.distanceToSquared(near) < s2.distanceToSquared(near) ? s1 : s2;
}

const dir2 = (a: number): THREE.Vector2 => new THREE.Vector2(Math.cos(a), Math.sin(a));

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

/** 국소 Y축 원기둥(y0~y1) */
function cylY(r: number, y0: number, y1: number, seg = 24): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

/** 두 점 사이 막대(Y축 정렬) */
function alignY(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): number {
  const d = b.clone().sub(a);
  const len = d.length();
  obj.position.copy(a).addScaledVector(d, 0.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return len;
}

/** 레버/크랭크 팔: 원점에서 +X로 len, 양끝 둥근 판 */
function leverGeo(len: number, w0: number, w1: number, t: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.absarc(0, 0, w0, Math.PI / 2, (Math.PI * 3) / 2, false);
  s.absarc(len, 0, w1, -Math.PI / 2, Math.PI / 2, false);
  s.closePath();
  const b = 0.006;
  const g = new THREE.ExtrudeGeometry(s, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -(t - 2 * b) / 2);
  g.rotateX(-Math.PI / 2); // 판이 국소 XZ 평면에 눕도록 (shape y → -z)
  return g;
}

/** 1줄 웜: 반지름이 (x/피치 - θ/2π) 위상에 따라 사다리꼴로 변하는 나사면 (축 = X) */
function wormGeo(len: number, rRoot: number, rTip: number, pitch: number): THREE.BufferGeometry {
  const nx = Math.ceil((len / pitch) * 18);
  const na = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= nx; i++) {
    const x = -len / 2 + (i / nx) * len;
    for (let j = 0; j <= na; j++) {
      const th = (j / na) * Math.PI * 2;
      let f = x / pitch - th / (Math.PI * 2);
      f -= Math.floor(f);
      const d = Math.abs(f - 0.5) * 2; // 0 = 이끝 중앙, 1 = 이뿌리 중앙
      const k = d < 0.35 ? 1 : d > 0.75 ? 0 : 1 - (d - 0.35) / 0.4;
      // 양 끝은 이뿌리로 모따기
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

/** 블레이드 단면 상자를 중심선 표본을 따라 만든 동적 지오메트리 */
class BladeStrip {
  readonly geo = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  constructor(
    private readonly halfW: number,
    private readonly h0: number,
    private readonly h1: number
  ) {
    this.pos = new Float32Array(BLADE_N * 4 * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const idx: number[] = [];
    for (let i = 0; i < BLADE_N - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const a = i * 4 + k;
        const b = i * 4 + ((k + 1) % 4);
        idx.push(a, a + 4, b, b, a + 4, b + 4);
      }
    }
    const e = (BLADE_N - 1) * 4;
    idx.push(0, 1, 2, 0, 2, 3, e, e + 2, e + 1, e, e + 3, e + 2);
    this.geo.setIndex(idx);
  }

  /** 중심선 (x,z) 표본과 폭 방향 (px,pz) — 높이는 유리 곡면을 따른다 */
  update(cx: number[], cz: number[], px: number, pz: number): void {
    const p = this.pos;
    for (let i = 0; i < BLADE_N; i++) {
      const x = cx[i]!;
      const z = cz[i]!;
      const y = surfY(x, z);
      const corners: [number, number][] = [
        [-this.halfW, this.h0],
        [this.halfW, this.h0],
        [this.halfW, this.h1],
        [-this.halfW, this.h1]
      ];
      corners.forEach(([w, h], k) => {
        const o = (i * 4 + k) * 3;
        p[o] = x + px * w;
        p[o + 1] = y + h;
        p[o + 2] = z + pz * w;
      });
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}

interface ArmRig {
  pivot: THREE.Group;
  hinge: THREE.Group;
  rubber: BladeStrip;
  beam: BladeStrip;
  psi: number;
}

interface LinkRig {
  crank: THREE.Object3D;
  leverA: THREE.Object3D;
  leverB: THREE.Object3D;
  rod1: THREE.Object3D;
  rod2: THREE.Object3D;
}

export class Wiper extends BaseMachine {
  readonly id = 'wiper';
  private gf = new THREE.Group();
  private gearModel: THREE.Group | null = null;
  private linkModel: THREE.Group | null = null;
  private motorShaft = new THREE.Group();
  private worm: THREE.Object3D | null = null;
  private wheel: THREE.Object3D | null = null;
  private link: LinkRig | null = null;
  private arms: ArmRig[] = [];
  private drops!: THREE.InstancedMesh;
  private dropPos: THREE.Vector2[] = [];
  private dropAge: number[] = [];
  private motorAngle = 0;
  private wheelAngle = 0;
  private crankOffset = 0;
  private q1 = new THREE.Vector2();
  private q3 = new THREE.Vector2();
  private lastT = -1;
  private simActive = false;


  private readonly steelMat = steel();
  private readonly alu = aluminum({ color: 0xb9c0c8 });
  private readonly linkMat = darkSteel({ roughness: 0.4 });
  private readonly bodyPaint = paint(0x34495e, { roughness: 0.36 });

  constructor() {
    super();
    this.gf.quaternion.copy(GF_QUAT);
    this.gf.position.copy(G0);
    this.group.add(this.gf);
    this.buildBody();
    this.buildGlass();
    this.buildModule();
    this.buildArms();
    this.buildDrops();
    this.buildSlots();
    shadowAll(this.group);
    this.drops.castShadow = false;
    for (const s of this.slots) {
      if (!s) continue;
      s.castShadow = false;
      s.receiveShadow = false;
    }
    this.poseArms(PSI_MIN, PSI_MIN);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.gearModel !== null : this.linkModel !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return G0.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    const p = step === 0 ? toLocal(CC, Y_GEAR + 0.3) : toLocal(PB, Y_LEV1 + 0.4);
    return p.applyMatrix4(GF_MATRIX);
  }

  buildStepModel(step: number): THREE.Group {
    // 비행 중에도 유리 좌표계 자세를 유지하도록 루트에 회전을 넣고 내용은 gf 국소 좌표로 둔다
    const g = new THREE.Group();
    g.quaternion.copy(GF_QUAT);
    if (step === 0) this.buildGears(g);
    else this.buildLinks(g);
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.quaternion.identity();
    if (step === 0) {
      this.gearModel = model;
      // 웜은 모터 축에 끼워져 함께 돈다
      const worm = model.getObjectByName('worm');
      if (worm) {
        worm.position.set(0, 0, 0);
        this.motorShaft.add(worm);
        this.worm = worm;
      }
      this.wheel = model.getObjectByName('wheel') ?? null;
      this.gf.add(model);
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.linkModel = model;
      this.gf.add(model);
      const get = (n: string): THREE.Object3D => model.getObjectByName(n) ?? new THREE.Object3D();
      this.link = { crank: get('crank'), leverA: get('leverA'), leverB: get('leverB'), rod1: get('rod1'), rod2: get('rod2') };
      // 크랭크를 출력축에 끼우는 각도: 와이퍼가 정지 위치(ψ 최소)에서 출발하도록
      this.crankOffset = this.findParkCrankAngle() - this.wheelAngle;
      this.q1.set(0, 0);
      this.hideSlot(1);
      this.applyLinkage(true);
    }
  }

  reset(): void {
    if (this.worm) this.motorShaft.remove(this.worm);
    if (this.gearModel) this.gf.remove(this.gearModel);
    if (this.linkModel) this.gf.remove(this.linkModel);
    this.gearModel = this.linkModel = null;
    this.worm = this.wheel = null;
    this.link = null;
    this.simActive = false;
    this.wheelAngle = this.crankOffset = 0;

    this.lastT = -1;
    this.poseArms(PSI_MIN, PSI_MIN);
    for (let i = 0; i < DROPS; i++) this.dropAge[i] = 10;
    this.writeDrops();
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    const dt = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, t - this.lastT));
    this.lastT = t;
    // 시뮬레이션 전에도 모터는 돈다(웜이 없으면 헛돈다). 시뮬레이션 중에는 sim.update가 구동한다.
    if (!this.simActive) this.drive(dt);
  }

  createSim(): MachineSim {
    if (!this.gearModel || !this.linkModel) throw new Error('wiper mission incomplete');
    this.simActive = true;
    const display: MachineDisplayItem[] = [
      { label: '모터 회전수', value: String(MOTOR_RPM), unit: 'rpm', tone: 'blue' },
      { label: '웜 휠 회전수', value: WHEEL_RPM.toFixed(0), unit: `rpm (1/${WHEEL_TEETH})` },
      { label: '와이퍼 왕복', value: WHEEL_RPM.toFixed(0), unit: '회/분', tone: 'red' }
    ];
    return {
      update: (dt: number) => this.drive(dt),
      getDisplay: () => display
    };
  }

  // ── 구동 ──

  private drive(dt: number): void {
    this.motorAngle = (this.motorAngle + W_MOTOR_VIS * dt) % (Math.PI * 2);
    this.motorShaft.rotation.x = this.motorAngle;
    if (this.gearModel) {
      this.wheelAngle = (this.wheelAngle + W_WHEEL * dt) % (Math.PI * 2);
      if (this.wheel) this.wheel.rotation.y = this.wheelAngle;
      if (this.link) this.applyLinkage(false);
    }
    this.growDrops(dt);
  }

  private crankPin(theta: number): THREE.Vector2 {
    return CC.clone().add(dir2(theta).multiplyScalar(CR));
  }

  /** 크랭크 각 → 레버 B 각(크랭크-로커). near가 없으면 설계 흔들림 범위 쪽 해를 고른다 */
  private solveRocker(theta: number, near: THREE.Vector2 | null): THREE.Vector2 {
    const guess = near ?? PB.clone().add(dir2(MU).multiplyScalar(R1));
    return circleHit(PB, R1, this.crankPin(theta), L1, guess);
  }

  private findParkCrankAngle(): number {
    let best = 0;
    let bestPsi = Infinity;
    for (let i = 0; i < 720; i++) {
      const th = (i / 720) * Math.PI * 2;
      const q = this.solveRocker(th, null);
      const psi = Math.atan2(q.y - PB.y, q.x - PB.x) - BETA1;
      const w = Math.atan2(Math.sin(psi), Math.cos(psi));
      if (w < bestPsi) {
        bestPsi = w;
        best = th;
      }
    }
    return best;
  }

  private applyLinkage(init: boolean): void {
    const link = this.link;
    if (!link) return;
    const theta = this.wheelAngle + this.crankOffset;
    // 1) 크랭크-로커: 레버 B 1번 팔 끝 = 원(PB,R1) ∩ 원(크랭크 핀, L1)
    const q1 = this.solveRocker(theta, init ? null : this.q1);
    this.q1.copy(q1);
    const psiB = Math.atan2(q1.y - PB.y, q1.x - PB.x) - BETA1;
    // 2) 평행 4절: 레버 A 끝 = 원(PA,R2) ∩ 원(레버 B 2번 팔 끝, L2)
    const q2 = PB.clone().add(dir2(psiB + BETA2).multiplyScalar(R2));
    const guess = init ? q2.clone().add(PA).sub(PB) : this.q3;
    const q3 = circleHit(PA, R2, q2, L2, guess);
    this.q3.copy(q3);
    const psiA = Math.atan2(q3.y - PA.y, q3.x - PA.x) - BETA2;

    link.crank.rotation.y = theta;
    link.leverB.rotation.y = psiB;
    link.leverA.rotation.y = psiA;
    alignY(link.rod1, toLocal(this.crankPin(theta), Y_ROD1), toLocal(q1, Y_ROD1));
    alignY(link.rod2, toLocal(q2, Y_ROD2), toLocal(q3, Y_ROD2));
    this.poseArms(psiA, psiB);
  }

  // ── 와이퍼 암 + 블레이드 ──

  private poseArms(psiA: number, psiB: number): void {
    [psiA, psiB].forEach((psi, i) => {
      const rig = this.arms[i];
      const spec = ARMS[i];
      if (!rig || !spec) return;
      const prev = rig.psi;
      rig.psi = psi;
      rig.pivot.rotation.y = psi;
      const P = spec.pivot;
      const baseY = rig.pivot.position.y;
      const c = Math.cos(psi);
      const s = Math.sin(psi);
      // 강체 암이 힌지에서 숙여져 블레이드를 유리에 누른다: 끝 높이 = 유리 높이 + 블레이드 높이
      let tau = 0;
      for (let k = 0; k < 4; k++) {
        const reach = HINGE_S + spec.len * Math.cos(tau);
        const tx = P.x + c * reach;
        const tz = -P.y - s * reach;
        const need = surfY(tx, tz) + BLADE_H - baseY - HINGE_H;
        tau = Math.asin(Math.max(-1, Math.min(1, need / spec.len)));
      }
      rig.hinge.rotation.z = tau;
      const reach = HINGE_S + spec.len * Math.cos(tau);
      const cx: number[] = [];
      const cz: number[] = [];
      for (let k = 0; k < BLADE_N; k++) {
        const r = reach - spec.blade / 2 + (k / (BLADE_N - 1)) * spec.blade;
        cx.push(P.x + c * r);
        cz.push(-P.y - s * r);
      }
      rig.rubber.update(cx, cz, s, c);
      rig.beam.update(cx, cz, s, c);
      if (Math.abs(psi - prev) > 1e-6) this.wipeDrops(P, reach, spec.blade, prev, psi);
    });
  }

  private buildArms(): void {
    const armMat = paint(0x1c1e22, { roughness: 0.5, metalness: 0.3 });
    const rubberMat = rubber();
    const beamMat = plastic(0x2a2d32, { roughness: 0.45 });
    ARMS.forEach((spec) => {
      const pivot = new THREE.Group();
      const P = spec.pivot;
      pivot.position.set(P.x, surfY(P.x, -P.y) + 0.012, -P.y);
      // 피벗 캡 + 암 머리
      pivot.add(new THREE.Mesh(cylY(0.05, -0.02, 0.07, 28), armMat));
      const head = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.07, 0.085, 2, 0.02), armMat);
      head.position.set(0.11, 0.08, 0);
      pivot.add(head);
      const nut = new THREE.Mesh(cylY(0.028, 0.07, 0.1, 6), this.steelMat);
      pivot.add(nut);
      const hinge = new THREE.Group();
      hinge.position.set(HINGE_S, HINGE_H, 0);
      const bar = new THREE.Mesh(new RoundedBoxGeometry(spec.len, 0.03, 0.045, 2, 0.012), armMat);
      bar.position.x = spec.len / 2;
      const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 16), armMat);
      knuckle.rotation.x = Math.PI / 2;
      // 블레이드 어댑터(암 끝 → 빔 윗면)
      const adapter = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.035, 0.05, 2, 0.01), armMat);
      adapter.position.set(spec.len, -0.012, 0);
      hinge.add(bar, knuckle, adapter);
      pivot.add(hinge);
      this.gf.add(pivot);
      const rub = new BladeStrip(0.011, 0.002, 0.028);
      const beam = new BladeStrip(0.026, 0.026, BLADE_H);
      this.gf.add(new THREE.Mesh(rub.geo, rubberMat), new THREE.Mesh(beam.geo, beamMat));
      this.arms.push({ pivot, hinge, rubber: rub, beam, psi: PSI_MIN });
    });
  }

  // ── 빗방울 ──

  private buildDrops(): void {
    const geo = new THREE.SphereGeometry(0.03, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    this.drops = new THREE.InstancedMesh(geo, glass(0xeaf6ff, 0.55), DROPS);
    this.drops.userData.noAO = true;
    for (let i = 0; i < DROPS; i++) {
      this.dropPos.push(this.randomDrop());
      this.dropAge.push(10);
    }
    this.writeDrops();
    this.gf.add(this.drops);
  }

  private randomDrop(): THREE.Vector2 {
    const b = 0.06 + Math.random() * (GLASS_H - 0.14);
    const hw = glassHalfW(b) - 0.08;
    return new THREE.Vector2((Math.random() * 2 - 1) * hw, b);
  }

  private writeDrops(): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < DROPS; i++) {
      const p = this.dropPos[i]!;
      const z = -p.y;
      const n = new THREE.Vector3(p.x / RX, 1, z / RZ).normalize();
      q.setFromUnitVectors(up, n);
      const age = this.dropAge[i]!;
      const s = age < 0 ? 0 : Math.min(1, age / 0.5) * (0.6 + ((i * 37) % 10) / 20);
      m.compose(new THREE.Vector3(p.x, surfY(p.x, z), z), q, new THREE.Vector3(s, s * 0.5, s));
      this.drops.setMatrixAt(i, m);
    }
    this.drops.instanceMatrix.needsUpdate = true;
  }

  /** 블레이드가 지나간 부채꼴 안의 빗방울을 지운다 (평면 좌표에서 피벗 기준 극좌표) */
  private wipeDrops(P: THREE.Vector2, reach: number, blade: number, a0: number, a1: number): void {
    const lo = Math.min(a0, a1);
    const hi = Math.max(a0, a1);
    let changed = false;
    for (let i = 0; i < DROPS; i++) {
      if (this.dropAge[i]! < 0) continue;
      const p = this.dropPos[i]!;
      const dx = p.x - P.x;
      const du = p.y - P.y;
      const r = Math.hypot(dx, du);
      if (Math.abs(r - reach) > blade / 2) continue;
      const a = Math.atan2(du, dx);
      if (a >= lo - 0.01 && a <= hi + 0.01) {
        this.dropAge[i] = -(0.4 + Math.random() * 2.5); // 잠시 뒤 다른 곳에 다시 떨어진다
        changed = true;
      }
    }
    if (changed) this.writeDrops();
  }

  private growDrops(dt: number): void {
    if (dt <= 0) return;
    let changed = false;
    for (let i = 0; i < DROPS; i++) {
      const a = this.dropAge[i]!;
      if (a >= 0.5) continue;
      const next = a + dt;
      if (a < 0 && next >= 0) this.dropPos[i] = this.randomDrop();
      this.dropAge[i] = next;
      changed = true;
    }
    if (changed) this.writeDrops();
  }

  // ── 미션 부품 ──

  private buildGears(g: THREE.Group): void {
    // 웜(모터 축에 끼움) — 축 X, 1줄 나사
    const worm = new THREE.Group();
    worm.name = 'worm';
    const wormMesh = new THREE.Mesh(wormGeo(0.3, WORM_R - 0.017, WORM_R + 0.013, WORM_PITCH), steel({ roughness: 0.28 }));
    worm.add(wormMesh);
    worm.position.set(CC.x, Y_GEAR, WORM_Z);
    g.add(worm);

    // 웜 휠(50잇수) + 출력축
    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    wheel.position.set(CC.x, 0, -CC.y);
    const shape = gearShape(WHEEL_TEETH, WHEEL_R, 0.024, 0.28);
    const hub = new THREE.Path();
    hub.absarc(0, 0, 0.025, 0, Math.PI * 2, true);
    shape.holes.push(hub);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.04, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    const t = 0.05;
    const wg = new THREE.ExtrudeGeometry(shape, { depth: t - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelOffset: -0.004, bevelSegments: 1, curveSegments: 12 });
    wg.translate(0, 0, -(t - 0.008) / 2);
    wg.rotateX(-Math.PI / 2);
    const wm = new THREE.Mesh(wg, bronze());
    wm.position.y = Y_GEAR;
    wheel.add(wm);
    const shaft = new THREE.Mesh(cylY(0.025, Y_CRANK - 0.03, Y_GEAR + 0.06, 20), this.steelMat);
    wheel.add(shaft);
    const boss = new THREE.Mesh(cylY(0.05, Y_GEAR - 0.04, Y_GEAR + 0.04, 28), bronze());
    wheel.add(boss);
    g.add(wheel);
  }

  private buildLinks(g: THREE.Group): void {
    const pinGeo = (y0: number, y1: number): THREE.CylinderGeometry => cylY(0.017, y0, y1, 14);
    const ballMat = this.steelMat;

    // 크랭크(출력축 끝)
    const crank = new THREE.Group();
    crank.name = 'crank';
    crank.position.set(CC.x, 0, -CC.y);
    const crankArm = new THREE.Mesh(leverGeo(CR, 0.05, 0.035, 0.03), this.linkMat);
    crankArm.position.y = Y_CRANK;
    crank.add(crankArm, new THREE.Mesh(cylY(0.04, Y_CRANK - 0.02, Y_CRANK + 0.025, 20), this.steelMat));
    const crankPin = new THREE.Mesh(pinGeo(Y_ROD1 - 0.02, Y_CRANK), ballMat);
    crankPin.position.x = CR;
    crank.add(crankPin);
    g.add(crank);

    // 피벗 B 레버(2개 팔: 크랭크 로드용, 평행 링크용)
    const leverB = new THREE.Group();
    leverB.name = 'leverB';
    leverB.position.set(PB.x, 0, -PB.y);
    const arm1 = new THREE.Group();
    arm1.rotation.y = BETA1;
    const a1 = new THREE.Mesh(leverGeo(R1, 0.04, 0.03, 0.028), this.linkMat);
    a1.position.y = Y_LEV1;
    const p1 = new THREE.Mesh(pinGeo(Y_ROD1 - 0.02, Y_LEV1), ballMat);
    p1.position.x = R1;
    arm1.add(a1, p1);
    const arm2 = new THREE.Group();
    arm2.rotation.y = BETA2;
    const a2 = new THREE.Mesh(leverGeo(R2, 0.04, 0.03, 0.028), this.linkMat);
    a2.position.y = Y_LEV2;
    const p2 = new THREE.Mesh(pinGeo(Y_ROD2, Y_LEV2), ballMat);
    p2.position.x = R2;
    arm2.add(a2, p2);
    leverB.add(arm1, arm2, new THREE.Mesh(cylY(0.038, Y_LEV2 - 0.02, Y_LEV1 + 0.02, 20), this.linkMat));
    g.add(leverB);

    // 피벗 A 레버
    const leverA = new THREE.Group();
    leverA.name = 'leverA';
    leverA.position.set(PA.x, 0, -PA.y);
    const armA = new THREE.Group();
    armA.rotation.y = BETA2;
    const aa = new THREE.Mesh(leverGeo(R2, 0.04, 0.03, 0.028), this.linkMat);
    aa.position.y = Y_LEV2;
    const pa = new THREE.Mesh(pinGeo(Y_ROD2, Y_LEV2), ballMat);
    pa.position.x = R2;
    armA.add(aa, pa);
    leverA.add(armA, new THREE.Mesh(cylY(0.038, Y_LEV2 - 0.02, Y_LEV2 + 0.03, 20), this.linkMat));
    g.add(leverA);

    // 연결 로드 2개(길이 고정, 양끝 볼 소켓)
    const rodMat = paint(0xa8423f, { roughness: 0.4, metalness: 0.4 });
    const makeRod = (name: string, len: number): THREE.Group => {
      const rod = new THREE.Group();
      rod.name = name;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len - 0.06, 16), rodMat);
      rod.add(body);
      const sockGeo = new THREE.SphereGeometry(0.035, 18, 12);
      for (const s of [-1, 1]) {
        const sock = new THREE.Mesh(sockGeo, rodMat);
        sock.position.y = (s * len) / 2;
        rod.add(sock);
      }
      return rod;
    };
    g.add(makeRod('rod1', L1), makeRod('rod2', L2));
  }

  // ── 고정 구조: 모듈 프레임·모터·피벗 하우징 ──

  private buildModule(): void {
    const gf = this.gf;
    // 피벗 하우징 + 피벗 축(축은 와이퍼 암과 함께 돌지만 원통이라 회전이 보이지 않는다)
    for (const P of [PA, PB]) {
      const housing = new THREE.Mesh(cylY(0.065, -0.31, -0.09, 28), this.alu);
      housing.position.set(P.x, 0, -P.y);
      const shaft = new THREE.Mesh(cylY(0.022, Y_LEV2 - 0.03, surfY(P.x, -P.y) + 0.01, 16), this.steelMat);
      shaft.position.set(P.x, 0, -P.y);
      const grommet = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 24), rubber());
      grommet.rotation.x = Math.PI / 2;
      grommet.position.set(P.x, surfY(P.x, -P.y) - 0.005, -P.y);
      gf.add(housing, shaft, grommet);
    }
    // 프레임 파이프: 피벗 A — 피벗 B — 기어 하우징
    const tubeMat = darkSteel({ roughness: 0.5 });
    const gearC = toLocal(CC, Y_FRAME);
    const pts = [
      toLocal(PA, Y_FRAME).add(new THREE.Vector3(-0.25, -0.1, 0.05)),
      toLocal(PA, Y_FRAME),
      toLocal(PB, Y_FRAME),
      new THREE.Vector3(PB.x + 0.35, Y_FRAME, -PB.y + 0.18),
      gearC.clone().add(new THREE.Vector3(-0.24, 0, -0.06))
    ];
    const frame = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 80, 0.026, 14, false), tubeMat);
    gf.add(frame);
    // 프레임 끝 → 차체 플레넘 바닥(세계 y=0.36)까지 수직 브래킷
    const toWorld = (v: THREE.Vector3): THREE.Vector3 => v.clone().applyMatrix4(GF_MATRIX);
    const legMat = darkSteel({ roughness: 0.55 });
    const legTops = [toWorld(pts[0]!), toWorld(gearC.clone().add(new THREE.Vector3(0.12, -0.06, 0.25)))];
    for (const top of legTops) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.07, 1, 0.07, 2, 0.015), legMat);
      leg.scale.y = alignY(leg, top, new THREE.Vector3(top.x, 0.38, top.z));
      const foot = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.025, 0.14, 2, 0.008), legMat);
      foot.position.set(top.x, 0.375, top.z);
      this.group.add(leg, foot);
    }

    // 기어 하우징(반투명) + 모터
    const housing = new THREE.Group();
    housing.position.set(CC.x, 0, -CC.y);
    const hMat = ghost(0x9fb4c8, 0.3);
    const drum = new THREE.Mesh(cylY(WHEEL_R + 0.05, Y_GEAR - 0.06, Y_GEAR + 0.07, 48), hMat);
    housing.add(drum);
    const channel = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.15, 0.17, 3, 0.04), hMat);
    channel.position.set(0, Y_GEAR, WORM_Z + CC.y);
    housing.add(channel);
    gf.add(housing);
    // 하우징 외곽선(유령 재질만으로는 형태가 흐려서 가장자리 링을 둔다)
    const rimGeo = new THREE.TorusGeometry(WHEEL_R + 0.05, 0.008, 6, 64);
    rimGeo.rotateX(Math.PI / 2);
    for (const y of [Y_GEAR - 0.06, Y_GEAR + 0.07]) {
      const rim = new THREE.Mesh(rimGeo, this.alu);
      rim.position.set(CC.x, y, -CC.y);
      gf.add(rim);
    }

    const motorX0 = CC.x + 0.26;
    const motorLen = 0.42;
    const motorMat = paint(0x24272c, { roughness: 0.45, metalness: 0.4 });
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, motorLen, 40), motorMat);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(motorX0 + motorLen / 2, Y_GEAR, WORM_Z);
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.03, 40), this.alu);
    flange.rotation.z = Math.PI / 2;
    flange.position.set(motorX0, Y_GEAR, WORM_Z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), motorMat);
    cap.scale.y = 0.35;
    cap.rotation.z = -Math.PI / 2;
    cap.position.set(motorX0 + motorLen, Y_GEAR, WORM_Z);
    // 모터 권선이 살짝 보이는 냉각 띠
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.06, 40), copper());
    band.rotation.z = Math.PI / 2;
    band.position.set(motorX0 + 0.12, Y_GEAR, WORM_Z);
    const plug = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.06, 0.08, 2, 0.015), plastic(0x2d2f33));
    plug.position.set(motorX0 + 0.3, Y_GEAR + 0.11, WORM_Z);
    gf.add(motor, flange, cap, band, plug);
    // 모터 브래킷: 모터를 프레임 쪽 다리에 고정
    const mBracket = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.2, 0.22, 2, 0.015), legMat);
    mBracket.position.set(motorX0 + 0.06, Y_GEAR - 0.06, WORM_Z + 0.12);
    gf.add(mBracket);

    // 모터 축(웜이 끼워질 자리) + 축 끝 회전 마커
    this.motorShaft.position.set(CC.x, Y_GEAR, WORM_Z);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 16), this.steelMat);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = 0.02;
    this.motorShaft.add(shaft);
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 24), plastic(0xeef1f4));
    marker.rotation.z = Math.PI / 2;
    marker.position.x = -0.3;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.04, 0.02), glow(0xe5484d, 0.6));
    stripe.position.set(-0.3, 0.025, 0);
    this.motorShaft.add(marker, stripe);
    gf.add(this.motorShaft);
  }

  private buildSlots(): void {
    const slotMat = (): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 });
    const ring = (r: number, at: THREE.Vector3): THREE.BufferGeometry => {
      const t = new THREE.TorusGeometry(r, 0.022, 10, 48);
      t.rotateX(Math.PI / 2);
      t.translate(at.x, at.y, at.z);
      return t;
    };
    const s0 = new THREE.Mesh(ring(WHEEL_R + 0.1, toLocal(CC, Y_GEAR)), slotMat());
    const geos = [ring(CR + 0.07, toLocal(CC, Y_CRANK)), ring(R1 + 0.07, toLocal(PB, Y_LEV1)), ring(R2 + 0.07, toLocal(PA, Y_LEV2))];
    const s1 = new THREE.Mesh(mergeGeometries(geos), slotMat());
    geos.forEach((x) => x.dispose());
    for (const [i, s] of [s0, s1].entries()) {
      s.userData.slot = true;
      s.userData.noAO = true;
      this.slots[i] = s;
      this.gf.add(s);
    }
    this.hideSlot(1);
  }

  // ── 유리·카울·차체 ──

  private buildGlass(): void {
    const nu = 48;
    const nv = 24;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= nv; j++) {
      const b = (j / nv) * GLASS_H;
      const hw = glassHalfW(b);
      for (let i = 0; i <= nu; i++) {
        const x = -hw + (i / nu) * 2 * hw;
        pos.push(x, surfY(x, -b), -b);
        uv.push(i / nu, j / nv);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        const c = a + nu + 1;
        idx.push(a, a + 1, c, c, a + 1, c + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const glassMesh = new THREE.Mesh(geo, glass(0xcfe8ff, 0.12));
    glassMesh.userData.noAO = true;
    this.gf.add(glassMesh);

    // A필러·루프 헤더(차체 색) + 아래 가장자리 고무 몰딩
    const edge = (side: number, k: number): THREE.Vector3 => {
      const b = k * GLASS_H;
      const x = side * (glassHalfW(b) + 0.045);
      return new THREE.Vector3(x, surfY(x, -b) + 0.02, -b);
    };
    for (const side of [-1, 1]) {
      const pts = Array.from({ length: 12 }, (_, i) => edge(side, -0.02 + (i / 11) * 1.03));
      this.gf.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.075, 16, false), this.bodyPaint));
    }
    const top = Array.from({ length: 16 }, (_, i) => {
      const x = -glassHalfW(GLASS_H) - 0.04 + (i / 15) * 2 * (glassHalfW(GLASS_H) + 0.04);
      return new THREE.Vector3(x, surfY(x, -GLASS_H - 0.05) + 0.03, -GLASS_H - 0.05);
    });
    this.gf.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), 48, 0.085, 16, false), this.bodyPaint));
    const bottom = Array.from({ length: 16 }, (_, i) => {
      const x = -2.0 + (i / 15) * 4.0;
      return new THREE.Vector3(x, surfY(x, 0.0) + 0.004, 0.0);
    });
    this.gf.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bottom), 48, 0.016, 8, false), rubber()));
  }

  private buildBody(): void {
    const W0 = 2.0;
    const W1 = 2.27;
    // 측면 형상(세계 z, y) → Shape(x = -z, y)를 X 방향으로 압출
    const extrudeProfile = (pts: [number, number][], x0: number, x1: number): THREE.ExtrudeGeometry => {
      const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
      const bev = 0.025;
      const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: 8 });
      g.translate(0, 0, x0 + bev);
      g.rotateY(Math.PI / 2); // shape x → 세계 -z, 압출 → 세계 x
      return g;
    };
    // 가운데: 보닛 + 플레넘(와이퍼 모듈이 들어가는 홈) + 대시보드 받침
    const center: [number, number][] = [
      [2.3, 0.25],
      [2.4, 0.5],
      [2.38, 0.68],
      [2.25, 0.79],
      [1.6, 0.83],
      [1.15, 0.8],
      [1.12, 0.77],
      [1.12, 0.36],
      [-0.05, 0.36],
      [-0.05, 0.86],
      [-0.25, 0.98],
      [-1.5, 0.98],
      [-1.5, 0.25]
    ];
    const plinthTop = 0.25;
    const bodyMeshes = [new THREE.Mesh(extrudeProfile(center, -W0, W0), this.bodyPaint)];
    // 양옆 펜더 윗면: 유리 아래 모서리(곡률로 내려간 지점)까지 차오른다
    const corner = new THREE.Vector3(W1 - 0.02, surfY(W1 - 0.02, 0.02), 0.02).applyMatrix4(GF_MATRIX);
    const side: [number, number][] = [
      [2.3, 0.25],
      [2.4, 0.5],
      [2.38, 0.68],
      [2.25, 0.79],
      [1.6, 0.83],
      [1.15, 0.8],
      [corner.z, corner.y],
      [corner.z - 0.25, corner.y - 0.02],
      [-0.25, 0.98],
      [-1.5, 0.98],
      [-1.5, 0.25]
    ];
    for (const sx of [-1, 1]) {
      const geo = extrudeProfile(side, 0, W1 + 0.06 - W0);
      const m = new THREE.Mesh(geo, this.bodyPaint);
      m.position.x = sx > 0 ? W0 - 0.005 : -W1 - 0.06 + 0.005;
      bodyMeshes.push(m);
    }
    for (const m of bodyMeshes) this.group.add(m);
    // 플레넘 바닥 판(어두운 금속)과 대시보드
    const tray = new THREE.Mesh(new RoundedBoxGeometry(2 * W0 - 0.04, 0.02, 1.15, 2, 0.008), darkSteel({ roughness: 0.6 }));
    tray.position.set(0, 0.37, 0.535);
    const dash = new THREE.Mesh(new RoundedBoxGeometry(2 * W1, 0.2, 1.1, 3, 0.06), plastic(0x2b2e33, { roughness: 0.7 }));
    dash.position.set(0, 1.07, -0.85);
    this.group.add(tray, dash);
    // 전시대
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(4.95, plinthTop, 4.1, 3, 0.04), plastic(0x6d7782, { roughness: 0.75 }));
    plinth.position.set(0, plinthTop / 2, 0.42);
    this.group.add(plinth);

    // 카울 패널(반투명): 유리 아래 가장자리 곡선 → 보닛 뒤끝 직선을 잇는 면
    const n = 40;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const x = -W0 + (i / n) * 2 * W0;
      const topP = new THREE.Vector3(x, surfY(x, 0) - 0.004, 0).applyMatrix4(GF_MATRIX);
      pos.push(topP.x, topP.y, topP.z, x, 0.815, 1.14);
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.setIndex(idx);
    cg.computeVertexNormals();
    const cowlMat = ghost(0x8a9cb0, 0.16);
    cowlMat.side = THREE.DoubleSide;
    const cowl = new THREE.Mesh(cg, cowlMat);
    cowl.userData.noAO = true;
    // 카울 앞 가장자리 몰딩(보닛 뒤끝과 만나는 선)
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2 * W0, 16), plastic(0x24272c));
    lip.rotation.z = Math.PI / 2;
    lip.position.set(0, 0.82, 1.14);
    this.group.add(cowl, lip);
  }
}
