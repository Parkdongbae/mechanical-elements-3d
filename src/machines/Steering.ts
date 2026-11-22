// 자동차 조향 장치: 래크와 피니언, 링크 미션 — 회전 운동 → 직선 운동 변환
// 좌표: +Z = 차의 앞, Y = 위, X = 좌우(운전자는 -Z 쪽에서 +Z를 바라보며 +X가 왼쪽, 좌핸들).
// 핸들 +θ(운전자가 보기에 반시계) → 피니언 +θ → 래크 -X(오른쪽) → 바퀴 왼쪽으로 조향.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { aluminum, castIron, chrome, darkSteel, ghost, paint, plastic, rubber, steel, brass } from '../models/materials';
import { BaseMachine, type MachineSim } from './types';

/** 표시용 래크 이동 계수(핸들 1rad당 30cm) — 화면 수치 관계 유지 */
const RACK_TRAVEL = 0.3;
const STEER_RATIO = 0.6;

const RACK_Y = 0.5;
const RACK_Z = 0.2;
const RACK_HALF = 0.8; // 래크 끝(안쪽 볼조인트) x
const HOUSING_HALF = 0.62;
const PINION_X = 0.3;
const PINION_TEETH = 10;
const MODULE = 0.024;
/** 피니언 피치 반지름 — 래크 이동 = 피니언 각 × 이 값(피치 일치) */
const PINION_R = (PINION_TEETH * MODULE) / 2;
const PITCH = Math.PI * MODULE;
const PRESSURE = (20 * Math.PI) / 180;
const RACK_PITCH_Y = 0.05; // 래크 축선 → 피치선 거리
/** 피니언 축 기울기(수직에서 운전자 쪽으로 45°) */
const PIN_TILT = Math.PI / 4;
const PIN_AXIS = new THREE.Vector3(0, Math.cos(PIN_TILT), -Math.sin(PIN_TILT));
/** 피니언 중심 → 래크 방향(피니언 평면 안) */
const PIN_TO_RACK = new THREE.Vector3(0, -Math.sin(PIN_TILT), -Math.cos(PIN_TILT));
const PINION_POS = new THREE.Vector3(PINION_X, RACK_Y, RACK_Z).addScaledVector(PIN_TO_RACK, -(RACK_PITCH_Y + PINION_R));
/** 조향 암 길이: 래크 이동(r·θ)이 바퀴 각(0.6θ)을 만들도록 r/0.6 */
const ARM_LEN = PINION_R / STEER_RATIO;

const WHEEL_Z = 0.62;
const WHEEL_X = 1.27;
const WHEEL_Y = 0.42;
const TIRE_R = 0.42;
const RAIL_X = 0.62;
const RAIL_Y = 0.24;

const SW_CENTER = new THREE.Vector3(0.42, 1.4, -1.25);
const UJ1 = new THREE.Vector3(0.4, 1.08, -0.52);
const UJ2 = PINION_POS.clone().addScaledVector(PIN_AXIS, 0.3);

const Y_UP = new THREE.Vector3(0, 1, 0);

function latheY(profile: [number, number][], segs = 48): THREE.LatheGeometry {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

/** Y축 회전체를 X축(바퀴 축)으로 */
function latheX(profile: [number, number][], segs = 48): THREE.LatheGeometry {
  const g = latheY(profile, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, p?: THREE.Vector3): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  if (p) o.position.copy(p);
  return o;
}

/** a→b를 잇는 원기둥(길이 방향 Y) */
function rodBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, segs = 20): THREE.Mesh {
  const dir = b.clone().sub(a);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), segs), m);
  o.position.copy(a).addScaledVector(dir, 0.5);
  o.quaternion.setFromUnitVectors(Y_UP, dir.normalize());
  return o;
}

/** a→b를 잇는 둥근 각재 */
function barBetween(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, m: THREE.Material, roll = 0): THREE.Mesh {
  const dir = b.clone().sub(a);
  const o = new THREE.Mesh(new RoundedBoxGeometry(w, dir.length(), d, 2, Math.min(w, d) * 0.3), m);
  o.position.copy(a).addScaledVector(dir, 0.5);
  o.quaternion.setFromUnitVectors(Y_UP, dir.normalize());
  if (roll) o.rotateY(roll);
  return o;
}

function mergeInto(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const norm = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(norm);
  geos.forEach((g) => g.dispose());
  norm.forEach((g) => g.dispose());
  return merged;
}

/** 인벌류트 치형 평기어 단면(XY, 축 Z). phase = 0번 이의 중심 각 */
function involuteGearShape(teeth: number, mod: number, phase: number): THREE.Shape {
  const rp = (teeth * mod) / 2;
  const ra = rp + mod;
  const rf = rp - 1.25 * mod;
  const rb = rp * Math.cos(PRESSURE);
  const inv = (a: number) => Math.tan(a) - a;
  const half = (r: number) => Math.PI / (2 * teeth) + inv(PRESSURE) - inv(Math.acos(rb / Math.max(r, rb)));
  const step = (Math.PI * 2) / teeth;
  const radii = Array.from({ length: 7 }, (_, i) => rf + ((ra - rf) * i) / 6);
  const shape = new THREE.Shape();
  let first = true;
  const put = (r: number, a: number) => {
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (first) {
      shape.moveTo(x, y);
      first = false;
    } else shape.lineTo(x, y);
  };
  for (let k = 0; k < teeth; k++) {
    const c = phase + k * step;
    for (const r of radii) put(r, c - half(r));
    put(ra, c);
    for (let i = radii.length - 1; i >= 0; i--) put(radii[i]!, c + half(radii[i]!));
    const a0 = c + half(rf);
    const a1 = c + step - half(rf);
    put(rf, a0 + (a1 - a0) * 0.33);
    put(rf, a0 + (a1 - a0) * 0.66);
  }
  shape.closePath();
  return shape;
}

export class Steering extends BaseMachine {
  readonly id = 'steering';
  private driveMesh: THREE.Group | null = null;
  private linkMesh: THREE.Group | null = null;
  private pinionSpin: THREE.Group | null = null;
  private rackGroup = new THREE.Group();
  private boots: { obj: THREE.Object3D; side: number }[] = [];
  private wheelTilt = new THREE.Group();
  private steeringWheel = new THREE.Group();
  private upperShaft = new THREE.Group();
  private midShaft = new THREE.Group();
  private upperBase = new THREE.Quaternion();
  private midBase = new THREE.Quaternion();
  private pivots: { pivot: THREE.Group; base: THREE.Quaternion; tipLocal: THREE.Vector3; side: number }[] = [];
  private tieRods: THREE.Group[] = [];
  private theta = 0;

  constructor() {
    super();
    this.buildChassis();
    this.buildCorners();
    this.buildColumn();
    this.buildRackHousing();

    this.addSlot(0, 0.19, PINION_POS);
    const s0 = this.slots[0];
    if (s0) s0.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), PIN_AXIS);
    const s1pos = this.tieRodSlotPos();
    this.addSlot(1, 0.09, s1pos);
    const s1 = this.slots[1];
    if (s1) {
      const tip = this.armTip(1);
      const inner = new THREE.Vector3(RACK_HALF, RACK_Y, RACK_Z);
      s1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tip.sub(inner).normalize());
    }
    this.hideSlot(1);
    this.applyShadows(this.group);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.driveMesh !== null : this.linkMesh !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? PINION_POS.clone() : this.tieRodSlotPos();
  }

  buildStepModel(step: number): THREE.Group {
    return step === 0 ? this.buildRackAndPinion() : this.buildTieRods();
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.applyShadows(model);
    this.group.add(model);
    if (step === 0) {
      this.driveMesh = model;
      this.pinionSpin = (model.getObjectByName('pinionSpin') as THREE.Group | undefined) ?? null;
      const rack = model.getObjectByName('rack');
      if (rack instanceof THREE.Group) this.rackGroup = rack;
      this.boots = [];
      model.traverse((o) => {
        if (typeof o.userData.bootSide === 'number') this.boots.push({ obj: o, side: o.userData.bootSide as number });
      });
      this.updateBoots();
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.linkMesh = model;
      this.tieRods = model.children.filter((c): c is THREE.Group => c instanceof THREE.Group && typeof c.userData.side === 'number');
      this.hideSlot(1);
      this.updateTieRods();
    }
  }

  reset(): void {
    if (this.driveMesh) {
      this.group.remove(this.driveMesh);
      this.driveMesh = null;
      this.pinionSpin = null;
      this.rackGroup = new THREE.Group();
      this.boots = [];
    }
    if (this.linkMesh) {
      this.group.remove(this.linkMesh);
      this.linkMesh = null;
      this.tieRods = [];
    }
    this.showSlot(0);
    this.hideSlot(1);
    this.applyTheta(0);
  }

  createSim(): MachineSim {
    if (!this.driveMesh || !this.linkMesh) throw new Error('steering mission incomplete');
    let t = 0;
    const self = this;
    return {
      update(dt: number) {
        t += dt;
        self.applyTheta(0.96 * Math.sin(1.1 * t));
      },
      getDisplay: () => [
        { label: '핸들 각도', value: ((self.theta * 180) / Math.PI).toFixed(0), unit: '°', tone: 'blue' },
        { label: '래크 이동', value: (Math.abs(-self.theta * RACK_TRAVEL) * 100).toFixed(1), unit: 'cm', tone: 'red' },
        { label: '조향비', value: STEER_RATIO.toFixed(1), unit: ': 1' }
      ]
    };
  }

  /** 핸들 각 θ를 모든 연결 부품에 반영 */
  private applyTheta(theta: number): void {
    this.theta = theta;
    this.steeringWheel.rotation.y = theta; // 핸들 회전 방향 (요청: 반대 방향)
    const qy = new THREE.Quaternion();
    this.upperShaft.quaternion.copy(this.upperBase).multiply(qy.setFromAxisAngle(Y_UP, theta));
    this.midShaft.quaternion.copy(this.midBase).multiply(qy.setFromAxisAngle(Y_UP, theta));
    if (this.pinionSpin) this.pinionSpin.rotation.z = theta;
    // 피니언이 θ 돌면 피치원 위 점이 r·θ 이동 → 래크도 정확히 그만큼(구름 접촉)
    this.rackGroup.position.x = -theta * PINION_R;
    for (const p of this.pivots) {
      p.pivot.quaternion.copy(p.base).multiply(qy.setFromAxisAngle(Y_UP, theta * STEER_RATIO));
    }
    this.updateBoots();
    this.updateTieRods();
  }

  private armTip(side: number): THREE.Vector3 {
    const p = this.pivots.find((v) => v.side === side);
    if (!p) return new THREE.Vector3(side * 1.07, 0.48, WHEEL_Z - ARM_LEN);
    p.pivot.updateMatrix();
    return p.tipLocal.clone().applyMatrix4(p.pivot.matrix);
  }

  private tieRodSlotPos(): THREE.Vector3 {
    return new THREE.Vector3(RACK_HALF, RACK_Y, RACK_Z).add(this.armTip(1)).multiplyScalar(0.5);
  }

  private updateBoots(): void {
    for (const b of this.boots) {
      const end = b.side * RACK_HALF + this.rackGroup.position.x - 0.03 * b.side;
      b.obj.scale.x = Math.max(0.05, Math.abs(end - b.side * HOUSING_HALF));
    }
  }

  private updateTieRods(): void {
    for (const rod of this.tieRods) {
      const side = rod.userData.side === -1 ? -1 : 1;
      // 안쪽 끝: 래크 끝 볼조인트(래크와 함께 이동), 바깥 끝: 너클 조향 암 끝(조향축 따라 회전)
      const a = new THREE.Vector3(side * RACK_HALF + this.rackGroup.position.x, RACK_Y, RACK_Z);
      const b = this.armTip(side);
      const dir = b.clone().sub(a);
      const len = dir.length();
      rod.position.copy(a);
      rod.quaternion.setFromUnitVectors(Y_UP, dir.normalize());
      const shaft = rod.getObjectByName('shaft');
      const end = rod.getObjectByName('end');
      if (shaft) shaft.scale.y = len;
      if (end) end.position.y = len;
    }
  }

  // ───────────────────────── 1단계: 래크와 피니언 ─────────────────────────

  private buildRackAndPinion(): THREE.Group {
    const g = new THREE.Group();
    const rack = new THREE.Group();
    rack.name = 'rack';
    rack.position.set(0, RACK_Y, RACK_Z);
    const rackMat = chrome();
    rack.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, RACK_HALF * 2 - 0.04, 28).rotateZ(Math.PI / 2), rackMat));

    // 치형 띠: 이끝이 피니언 쪽(PIN_TO_RACK 반대)을 향하도록 X축 회전
    const yr = RACK_PITCH_Y - 1.25 * MODULE;
    const yt = RACK_PITCH_Y + MODULE;
    const tanA = Math.tan(PRESSURE);
    const hwR = PITCH / 4 + 1.25 * MODULE * tanA;
    const hwT = PITCH / 4 - MODULE * tanA;
    const shape = new THREE.Shape();
    const nT = 10;
    const x0 = PINION_X - (nT / 2) * PITCH;
    const x1 = PINION_X + (nT / 2) * PITCH;
    shape.moveTo(x0, 0);
    shape.lineTo(x0, yr);
    for (let k = 0; k < nT; k++) {
      // 이 수가 짝수 → PINION_X에는 홈이 온다(피니언 이(각 -90°)가 들어가는 자리)
      const c = x0 + (k + 0.5) * PITCH;
      shape.lineTo(c - hwR, yr);
      shape.lineTo(c - hwT, yt);
      shape.lineTo(c + hwT, yt);
      shape.lineTo(c + hwR, yr);
    }
    shape.lineTo(x1, yr);
    shape.lineTo(x1, 0);
    shape.closePath();
    const teethW = 0.05;
    const teethGeo = new THREE.ExtrudeGeometry(shape, { depth: teethW, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
    teethGeo.translate(0, 0, -teethW / 2);
    teethGeo.rotateX(Math.PI / 2 - PIN_TILT);
    rack.add(mesh(teethGeo, steel()));

    // 래크 끝 안쪽 볼조인트(소켓)
    const sockGeo = new THREE.SphereGeometry(0.042, 24, 16);
    const sockMat = darkSteel();
    for (const s of [-1, 1]) {
      rack.add(mesh(sockGeo, sockMat, new THREE.Vector3(s * RACK_HALF, 0, 0)));
      rack.add(mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 20).rotateZ(Math.PI / 2), sockMat, new THREE.Vector3(s * (RACK_HALF - 0.04), 0, 0)));
    }
    g.add(rack);

    // 고무 부트(주름관): 하우징 끝 ~ 래크 끝, 래크 이동에 따라 늘었다 줄었다
    const prof: [number, number][] = [[0.03, 0]];
    const folds = 7;
    for (let i = 0; i < folds; i++) {
      const y0 = 0.04 + (i / folds) * 0.92;
      const rr = 0.07 - (i / folds) * 0.022;
      prof.push([rr - 0.016, y0], [rr, y0 + 0.92 / folds / 2]);
    }
    prof.push([0.04, 0.97], [0.034, 1]);
    const bootGeo = latheX(prof, 32);
    const bootMat = rubber({ roughness: 0.75 });
    for (const s of [-1, 1]) {
      const holder = new THREE.Group();
      holder.position.set(s * HOUSING_HALF, RACK_Y, RACK_Z);
      if (s < 0) holder.rotation.y = Math.PI;
      const boot = mesh(bootGeo, bootMat);
      boot.userData.bootSide = s;
      holder.add(boot);
      g.add(holder);
    }

    // 피니언 + 입력축(피니언 축 기울기대로)
    const pinionFrame = new THREE.Group();
    pinionFrame.position.copy(PINION_POS);
    // 로컬 Z → 피니언 축, 로컬 -Y → 래크 방향
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3().crossVectors(PIN_TO_RACK.clone().negate(), PIN_AXIS),
      PIN_TO_RACK.clone().negate(),
      PIN_AXIS
    );
    pinionFrame.quaternion.setFromRotationMatrix(m);
    const spin = new THREE.Group();
    spin.name = 'pinionSpin';
    const faceW = 0.07;
    const gearGeo = new THREE.ExtrudeGeometry(involuteGearShape(PINION_TEETH, MODULE, -Math.PI / 2), {
      depth: faceW,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.003,
      bevelSegments: 2
    });
    gearGeo.translate(0, 0, -faceW / 2);
    spin.add(mesh(gearGeo, brass()));
    const shaftLen = 0.3;
    const shaft = new THREE.CylinderGeometry(0.024, 0.024, shaftLen + 0.08, 20).rotateX(Math.PI / 2);
    shaft.translate(0, 0, (shaftLen + 0.08) / 2 - 0.08);
    spin.add(mesh(shaft, steel()));
    // 입력축 쪽 요크(아래 유니버설 조인트 절반)
    const pinYoke = this.yokeMesh(shaftLen, 'z');
    pinYoke.rotation.z = Math.PI / 2; // 중간축 아래 요크와 90° 엇갈림
    spin.add(pinYoke);
    pinionFrame.add(spin);
    g.add(pinionFrame);
    return g;
  }

  // ───────────────────────── 2단계: 타이로드(링크) ─────────────────────────

  private buildTieRods(): THREE.Group {
    const g = new THREE.Group();
    const rodMat = steel();
    const endMat = castIron();
    for (const side of [-1, 1]) {
      const rod = new THREE.Group();
      rod.userData.side = side;
      // 길이 1짜리 축을 scale.y로 늘린다(끝 부품은 비율 유지)
      const shaftGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 18);
      shaftGeo.translate(0, 0.5, 0);
      const shaftMesh = mesh(shaftGeo, rodMat);
      shaftMesh.name = 'shaft';
      rod.add(shaftMesh);
      // 안쪽 볼 스터드
      rod.add(mesh(new THREE.SphereGeometry(0.03, 20, 14), chrome()));
      const end = new THREE.Group();
      end.name = 'end';
      // 바깥 타이로드 엔드: 조절 슬리브 + 잠금 너트 + 볼조인트 하우징
      const sleeve = new THREE.CylinderGeometry(0.03, 0.03, 0.12, 20);
      sleeve.translate(0, -0.11, 0);
      end.add(mesh(sleeve, endMat));
      const nut = new THREE.CylinderGeometry(0.036, 0.036, 0.022, 6);
      nut.translate(0, -0.18, 0);
      end.add(mesh(nut, darkSteel()));
      end.add(mesh(new THREE.SphereGeometry(0.042, 22, 16), endMat));
      rod.add(end);
      g.add(rod);
    }
    return g;
  }

  // ───────────────────────── 고정 구조물 ─────────────────────────

  /** 래크 하우징(반투명 컷어웨이) + 피니언 하우징 + 클램프 */
  private buildRackHousing(): void {
    const glassMat = ghost(0xb7cbe0, 0.28);
    const tube = mesh(
      latheX(
        [
          [0.062, -HOUSING_HALF],
          [0.075, -HOUSING_HALF],
          [0.075, HOUSING_HALF],
          [0.062, HOUSING_HALF]
        ],
        48
      ),
      glassMat,
      new THREE.Vector3(0, RACK_Y, RACK_Z)
    );
    tube.userData.ghost = true;
    tube.renderOrder = 2;
    this.group.add(tube);
    const alu = aluminum();
    // 하우징 양 끝 칼라(부트가 물리는 곳)
    const collar = latheX(
      [
        [0.05, -0.03],
        [0.082, -0.03],
        [0.086, -0.02],
        [0.086, 0.02],
        [0.082, 0.03],
        [0.05, 0.03]
      ],
      40
    );
    for (const s of [-1, 1]) this.group.add(mesh(collar, alu, new THREE.Vector3(s * (HOUSING_HALF - 0.03), RACK_Y, RACK_Z)));

    // 피니언 하우징(축 기울기대로 세운 반투명 통 + 알루미늄 윗 보스)
    const pinFrame = new THREE.Group();
    pinFrame.position.copy(PINION_POS);
    pinFrame.quaternion.setFromUnitVectors(Y_UP, PIN_AXIS);
    const pinCase = mesh(
      latheY(
        [
          [0.0, -0.07],
          [0.16, -0.07],
          [0.17, -0.06],
          [0.17, 0.07],
          [0.16, 0.08],
          [0.0, 0.08]
        ],
        48
      ),
      glassMat
    );
    pinCase.userData.ghost = true;
    pinCase.renderOrder = 2;
    pinFrame.add(pinCase);
    const boss = latheY(
      [
        [0.03, 0.08],
        [0.075, 0.08],
        [0.075, 0.14],
        [0.06, 0.16],
        [0.03, 0.16]
      ],
      40
    );
    pinFrame.add(mesh(boss, alu));
    this.group.add(pinFrame);

    // 클램프(고무 부싱 + 강판 밴드) → 뒤 크로스멤버에 볼트 체결
    const bandGeo = latheX(
      [
        [0.075, -0.03],
        [0.092, -0.03],
        [0.092, 0.03],
        [0.075, 0.03]
      ],
      40
    );
    const footGeo = new RoundedBoxGeometry(0.1, RACK_Y - 0.075 - (RAIL_Y + 0.07) + 0.02, 0.12, 2, 0.015);
    const bandMat = darkSteel();
    for (const x of [-0.42, 0.0]) {
      this.group.add(mesh(bandGeo, bandMat, new THREE.Vector3(x, RACK_Y, RACK_Z)));
      const fy = (RACK_Y - 0.08 + RAIL_Y + 0.07) / 2;
      this.group.add(mesh(footGeo, bandMat, new THREE.Vector3(x, fy, RACK_Z)));
    }
  }

  private buildChassis(): void {
    const frameMat = paint(0x3b4552, { roughness: 0.4 });
    // 좌우 프레임 레일(차체 하부 골격) — 뒤쪽은 잭 스탠드, 앞쪽은 바퀴가 받친다
    const zBack = -1.3;
    const zFront = 1.0;
    const railGeo = new RoundedBoxGeometry(0.1, 0.14, zFront - zBack, 3, 0.025);
    for (const s of [-1, 1]) this.group.add(mesh(railGeo, frameMat, new THREE.Vector3(s * RAIL_X, RAIL_Y, (zFront + zBack) / 2)));
    // 크로스멤버 2개(뒤: 래크 장착, 앞: 아래팔 앞 피벗)
    const xmGeo = new RoundedBoxGeometry(RAIL_X * 2 - 0.1, 0.12, 0.14, 3, 0.025);
    for (const z of [RACK_Z, WHEEL_Z + 0.32]) this.group.add(mesh(xmGeo, frameMat, new THREE.Vector3(0, RAIL_Y + 0.01, z)));
    // 위팔용 타워
    // 위팔용 타워: 파이프 기둥 2개 + 윗 가로대(가려지지 않게 성기게)
    const towerTop = 0.72;
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, towerTop - (RAIL_Y + 0.07), 20);
    for (const s of [-1, 1]) {
      for (const dz of [-0.14, 0.14]) this.group.add(mesh(postGeo, frameMat, new THREE.Vector3(s * RAIL_X, (towerTop + RAIL_Y + 0.07) / 2, WHEEL_Z + dz)));
      this.group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 20).rotateX(Math.PI / 2), frameMat, new THREE.Vector3(s * RAIL_X, towerTop, WHEEL_Z)));
    }

    // 대시 크로스빔 + 기둥(조향 컬럼을 붙잡는 곳)
    const beamZ = -0.85;
    const beamY = 1.12;
    const pillarGeo = new RoundedBoxGeometry(0.09, beamY - (RAIL_Y + 0.07), 0.12, 2, 0.02);
    for (const s of [-1, 1]) this.group.add(mesh(pillarGeo, frameMat, new THREE.Vector3(s * RAIL_X, (beamY + RAIL_Y + 0.07) / 2, beamZ)));
    this.group.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, RAIL_X * 2 + 0.1, 24).rotateZ(Math.PI / 2), darkSteel(), new THREE.Vector3(0, beamY, beamZ)));

    // 잭 스탠드(레일 뒤쪽 받침)
    const standMat = paint(0xd8362f, { roughness: 0.4 });
    const legH = RAIL_Y - 0.07;
    for (const s of [-1, 1]) {
      const top = new THREE.Vector3(s * RAIL_X, legH, -1.05);
      const legs: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        const foot = new THREE.Vector3(top.x + Math.cos(a) * 0.2, 0.0, top.z + Math.sin(a) * 0.2);
        const leg = rodBetween(foot, top.clone().setY(legH * 0.55), 0.02, standMat);
        leg.updateMatrix();
        legs.push(leg.geometry.clone().applyMatrix4(leg.matrix));
        leg.geometry.dispose();
      }
      this.group.add(mesh(mergeInto(legs), standMat));
      this.group.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, legH * 0.5, 16), standMat, new THREE.Vector3(top.x, legH * 0.72, top.z)));
      this.group.add(mesh(new RoundedBoxGeometry(0.12, 0.02, 0.12, 1, 0.008), darkSteel(), new THREE.Vector3(top.x, legH - 0.005, top.z)));
    }
  }

  /** 좌우 바퀴 코너: 위·아래 A암(고정) + 너클·바퀴(킹핀 축으로 조향) */
  private buildCorners(): void {
    const armMat = paint(0x23262b, { roughness: 0.45 });
    const bushMat = rubber();
    const jointMat = darkSteel();
    const knuckleMat = castIron();
    const tireMat = this.tireMaterial();
    const rimMat = aluminum({ roughness: 0.28 });
    const discMat = steel({ roughness: 0.42 });
    const caliperMat = paint(0xd8362f, { roughness: 0.35 });

    for (const s of [-1, 1]) {
      const lbj = new THREE.Vector3(s * 1.1, 0.24, WHEEL_Z);
      const ubj = new THREE.Vector3(s * 1.05, 0.64, WHEEL_Z);
      const kp = ubj.clone().sub(lbj).normalize();
      const C = new THREE.Vector3(s * WHEEL_X, WHEEL_Y, WHEEL_Z);
      const kpAt = (y: number) => lbj.clone().addScaledVector(kp, (y - lbj.y) / kp.y);
      const armRoot = kpAt(0.48);
      const tip = armRoot.clone().add(new THREE.Vector3(0, 0, -ARM_LEN));

      // A암(고정): 안쪽 피벗 2곳 → 볼조인트
      const lowerIn = [new THREE.Vector3(s * (RAIL_X + 0.05), RAIL_Y, WHEEL_Z - 0.22), new THREE.Vector3(s * (RAIL_X + 0.05), RAIL_Y, WHEEL_Z + 0.22)];
      const upperIn = [new THREE.Vector3(s * (RAIL_X + 0.045), 0.72, WHEEL_Z - 0.1), new THREE.Vector3(s * (RAIL_X + 0.045), 0.72, WHEEL_Z + 0.1)];
      for (const [ins, bj, r] of [
        [lowerIn, lbj, 0.024],
        [upperIn, ubj, 0.019]
      ] as const) {
        for (const p of ins) {
          this.group.add(rodBetween(p, bj, r, armMat));
          const bush = new THREE.CylinderGeometry(0.036, 0.036, 0.07, 20).rotateX(Math.PI / 2);
          this.group.add(mesh(bush, bushMat, p));
        }
        this.group.add(mesh(new THREE.SphereGeometry(0.04, 20, 14), jointMat, bj));
      }

      // 조향되는 부분 — 월드 좌표로 만든 뒤 킹핀 피벗에 attach
      const parts: THREE.Object3D[] = [];
      // 너클 몸통(아래·위 볼조인트를 잇는 기둥) + 스핀들 보스
      parts.push(barBetween(lbj.clone().addScaledVector(kp, 0.02), ubj.clone().addScaledVector(kp, -0.02), 0.07, 0.1, knuckleMat));
      parts.push(rodBetween(new THREE.Vector3(s * 1.08, WHEEL_Y, WHEEL_Z), new THREE.Vector3(s * 1.2, WHEEL_Y, WHEEL_Z), 0.05, knuckleMat, 24));
      // 조향 암(킹핀에서 뒤로 ARM_LEN) + 끝 아이
      parts.push(barBetween(armRoot, tip, 0.05, 0.045, knuckleMat));
      parts.push(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 20), knuckleMat, tip));
      // 브레이크 캘리퍼(디스크 위 뒤쪽)
      const cal = mesh(new RoundedBoxGeometry(0.1, 0.12, 0.16, 3, 0.025), caliperMat, new THREE.Vector3(s * 1.17, WHEEL_Y + 0.14, WHEEL_Z - 0.1));
      cal.rotation.x = 0.6;
      parts.push(cal);
      // 바퀴(타이어·림·디스크·허브)
      const wheel = this.buildWheel(tireMat, rimMat, discMat);
      wheel.position.copy(C);
      if (s < 0) wheel.rotation.y = Math.PI;
      parts.push(wheel);

      const pivot = new THREE.Group();
      pivot.position.copy(lbj);
      const base = new THREE.Quaternion().setFromUnitVectors(Y_UP, kp);
      pivot.quaternion.copy(base);
      this.group.add(pivot);
      pivot.updateMatrixWorld(true);
      for (const p of parts) {
        this.group.add(p);
        p.updateMatrixWorld(true);
        pivot.attach(p);
      }
      const tipLocal = tip.clone().sub(lbj).applyQuaternion(base.clone().invert());
      this.pivots.push({ pivot, base, tipLocal, side: s });
    }
  }

  /** 바깥쪽 = +X 기준 바퀴 */
  private buildWheel(tireMat: THREE.Material, rimMat: THREE.Material, discMat: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const R = TIRE_R;
    const hw = 0.14;
    // 타이어: 둥근 숄더 + 원주 홈 3줄
    const prof: [number, number][] = [
      [0.27, -hw + 0.02],
      [0.3, -hw],
      [0.355, -hw - 0.006],
      [0.395, -hw + 0.008],
      [R - 0.006, -hw + 0.03],
      [R, -hw + 0.045]
    ];
    for (const gy of [-0.06, 0, 0.06]) {
      prof.push([R, gy - 0.012], [R - 0.014, gy - 0.008], [R - 0.014, gy + 0.008], [R, gy + 0.012]);
    }
    prof.push([R, hw - 0.045], [R - 0.006, hw - 0.03], [0.395, hw - 0.008], [0.355, hw + 0.006], [0.3, hw], [0.27, hw - 0.02], [0.27, -hw + 0.02]);
    g.add(mesh(latheX(prof, 96), tireMat));

    // 림 배럴 + 플랜지
    const rim = latheX(
      [
        [0.25, -hw + 0.01],
        [0.29, -hw + 0.005],
        [0.295, -hw + 0.02],
        [0.272, -hw + 0.03],
        [0.272, hw - 0.03],
        [0.295, hw - 0.02],
        [0.29, hw - 0.005],
        [0.25, hw - 0.01],
        [0.25, -hw + 0.01]
      ],
      72
    );
    g.add(mesh(rim, rimMat));

    // 5 스포크 휠 면
    const face = new THREE.Shape();
    face.absarc(0, 0, 0.262, 0, Math.PI * 2, false);
    for (let i = 0; i < 5; i++) {
      const sa = (i / 5) * Math.PI * 2;
      const sb = ((i + 1) / 5) * Math.PI * 2;
      const ro = 0.225;
      const ri = 0.1;
      const hole = new THREE.Path();
      hole.absarc(0, 0, ro, sa + 0.17, sb - 0.17, false);
      hole.absarc(0, 0, ri, sb - 0.42, sa + 0.42, true);
      hole.closePath();
      face.holes.push(hole);
    }
    const faceGeo = new THREE.ExtrudeGeometry(face, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 40 });
    faceGeo.rotateY(Math.PI / 2);
    faceGeo.translate(0.06, 0, 0);
    g.add(mesh(faceGeo, rimMat));
    // 센터 캡 + 휠 너트 5개
    const cap = latheX(
      [
        [0, 0.12],
        [0.03, 0.118],
        [0.05, 0.105],
        [0.055, 0.09],
        [0, 0.09]
      ],
      32
    );
    g.add(mesh(cap, chrome()));
    const nuts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
      const n = new THREE.CylinderGeometry(0.013, 0.013, 0.03, 6).rotateZ(Math.PI / 2);
      n.translate(0.1, Math.cos(a) * 0.075, Math.sin(a) * 0.075);
      nuts.push(n);
    }
    g.add(mesh(mergeInto(nuts), chrome()));

    // 브레이크 디스크 + 허브(안쪽)
    const disc = latheX(
      [
        [0.09, -0.1],
        [0.205, -0.1],
        [0.205, -0.075],
        [0.12, -0.075],
        [0.1, -0.03],
        [0.09, -0.03],
        [0.09, -0.1]
      ],
      64
    );
    g.add(mesh(disc, discMat));
    g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 32).rotateZ(Math.PI / 2), darkSteel(), new THREE.Vector3(-0.03, 0, 0)));
    return g;
  }

  /** 타이어 트레드 블록 범프맵(원주 방향 반복) */
  private tireMaterial(): THREE.MeshStandardMaterial {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d');
    const m = rubber({ roughness: 0.9, grain: false });
    if (!ctx) return m;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = '#202020';
    // v(세로) = 프로파일 진행 방향, u(가로) = 원주. 트레드 영역(가운데)만 홈
    for (let k = 0; k < 2; k++) {
      const x = k * 32;
      ctx.fillRect(x + 4, 70, 5, 50);
      ctx.fillRect(x + 20, 136, 5, 50);
      ctx.save();
      ctx.translate(x + 14, 128);
      ctx.rotate(0.5);
      ctx.fillRect(-2, -30, 4, 60);
      ctx.restore();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(36, 1);
    m.bumpMap = tex;
    m.bumpScale = 1.2;
    return m;
  }

  /** 유니버설 조인트 요크(두 귀) — 축 끝 at, 축 방향 axis */
  private yokeMesh(at: number, axis: 'y' | 'z'): THREE.Mesh {
    const geos: THREE.BufferGeometry[] = [];
    const hub = new THREE.CylinderGeometry(0.036, 0.036, 0.05, 20);
    hub.translate(0, at - 0.045, 0);
    geos.push(hub);
    for (const s of [-1, 1]) {
      const ear = new THREE.BoxGeometry(0.018, 0.06, 0.05);
      ear.translate(s * 0.034, at - 0.01, 0);
      geos.push(ear);
    }
    const g = mergeInto(geos);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    return mesh(g, darkSteel());
  }

  /** 십자축(스파이더) */
  private spiderMesh(): THREE.Mesh {
    const a = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12).rotateZ(Math.PI / 2);
    const b = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12).rotateX(Math.PI / 2);
    const c = new THREE.SphereGeometry(0.018, 14, 10);
    return mesh(mergeInto([a, b, c]), chrome());
  }

  /** 핸들 · 컬럼 · 중간축(유니버설 조인트 2개) */
  private buildColumn(): void {
    // 윗 컬럼(핸들 → UJ1): 회전축은 Y로 두고 base 쿼터니언으로 기울인다
    const upDir = SW_CENTER.clone().sub(UJ1);
    const upLen = upDir.length();
    this.upperShaft.position.copy(UJ1);
    this.upperBase.setFromUnitVectors(Y_UP, upDir.clone().normalize());
    this.upperShaft.quaternion.copy(this.upperBase);
    const shaftMat = steel();
    const sGeo = new THREE.CylinderGeometry(0.022, 0.022, upLen, 18);
    sGeo.translate(0, upLen / 2, 0);
    this.upperShaft.add(mesh(sGeo, shaftMat));
    // UJ1 아래쪽 요크(윗 컬럼에 붙음)
    const yU = this.yokeMesh(0, 'y');
    yU.rotation.x = Math.PI;
    yU.rotation.y = Math.PI / 2;
    this.upperShaft.add(yU);
    this.upperShaft.add(this.spiderMesh());
    this.group.add(this.upperShaft);

    // 컬럼 튜브(고정) + 쉬라우드 + 대시 브래킷
    const tubeA = UJ1.clone().addScaledVector(upDir.clone().normalize(), 0.1);
    const tubeB = SW_CENTER.clone().addScaledVector(upDir.clone().normalize(), -0.16);
    this.group.add(rodBetween(tubeA, tubeB, 0.045, darkSteel(), 28));
    const shroudA = SW_CENTER.clone().addScaledVector(upDir.clone().normalize(), -0.42);
    const shroud = barBetween(shroudA, tubeB.clone().addScaledVector(upDir.clone().normalize(), 0.06), 0.16, 0.14, plastic(0x2a2e34));
    this.group.add(shroud);
    const tubeAtBeam = UJ1.clone().addScaledVector(upDir.clone().normalize(), (-0.85 - UJ1.z) / upDir.clone().normalize().z);
    this.group.add(barBetween(new THREE.Vector3(tubeAtBeam.x, 1.12, -0.85), tubeAtBeam, 0.06, 0.05, darkSteel()));

    // 핸들: 기울어진 프레임(Y = 컬럼 방향) 안에서 Y축 회전
    this.wheelTilt.position.copy(SW_CENTER);
    this.wheelTilt.quaternion.setFromUnitVectors(Y_UP, upDir.clone().normalize());
    this.wheelTilt.add(this.steeringWheel);
    this.group.add(this.wheelTilt);
    const rimMat = plastic(0x1f2226, { roughness: 0.62 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.036, 24, 96), rimMat);
    rim.rotation.x = Math.PI / 2;
    this.steeringWheel.add(rim);
    // 스포크 3개: 3시·9시·6시(로컬 ±X, -Z)
    const spokeMat = plastic(0x2c3036, { roughness: 0.5 });
    const spokeTrim = aluminum({ roughness: 0.3 });
    for (const ang of [0, Math.PI, -Math.PI / 2]) {
      const dir = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
      const a = dir.clone().multiplyScalar(0.1).add(new THREE.Vector3(0, 0.02, 0));
      const b = dir.clone().multiplyScalar(0.345);
      const sp = new THREE.Mesh(new RoundedBoxGeometry(0.075, a.distanceTo(b), 0.028, 2, 0.012), spokeMat);
      sp.position.copy(a).add(b).multiplyScalar(0.5);
      sp.quaternion.setFromUnitVectors(Y_UP, b.clone().sub(a).normalize());
      sp.rotateY(Math.PI / 2);
      this.steeringWheel.add(sp);
      const trim = new THREE.Mesh(new RoundedBoxGeometry(0.02, a.distanceTo(b) * 0.7, 0.032, 1, 0.006), spokeTrim);
      trim.position.copy(sp.position);
      trim.quaternion.copy(sp.quaternion);
      this.steeringWheel.add(trim);
    }
    // 혼 패드 + 엠블럼
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.07, 0.2, 4, 0.03), plastic(0x24272c, { roughness: 0.55 }));
    pad.position.y = 0.03;
    this.steeringWheel.add(pad);
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24), chrome());
    emblem.position.y = 0.068;
    this.steeringWheel.add(emblem);
    // 핸들 허브 아래 보스
    const bossG = new THREE.CylinderGeometry(0.05, 0.06, 0.08, 24);
    bossG.translate(0, -0.03, 0);
    this.steeringWheel.add(new THREE.Mesh(bossG, darkSteel()));

    // 중간축(UJ1 → UJ2)
    const midDir = UJ2.clone().sub(UJ1);
    const midLen = midDir.length();
    this.midShaft.position.copy(UJ1);
    this.midBase.setFromUnitVectors(Y_UP, midDir.clone().normalize());
    this.midShaft.quaternion.copy(this.midBase);
    const mGeo = new THREE.CylinderGeometry(0.02, 0.02, midLen - 0.1, 18);
    mGeo.translate(0, midLen / 2, 0);
    this.midShaft.add(mesh(mGeo, shaftMat));
    // 슬립 슬리브(신축부)
    const sleeve = new THREE.CylinderGeometry(0.03, 0.03, midLen * 0.4, 20);
    sleeve.translate(0, midLen * 0.62, 0);
    this.midShaft.add(mesh(sleeve, darkSteel()));
    const yTop = this.yokeMesh(0, 'y');
    yTop.rotation.x = Math.PI;
    this.midShaft.add(yTop);
    this.midShaft.add(this.yokeMesh(midLen, 'y'));
    const sp2 = this.spiderMesh();
    sp2.position.y = midLen;
    this.midShaft.add(sp2);
    this.group.add(this.midShaft);
  }

  private applyShadows(root: THREE.Object3D): void {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.slot) return;
      if (m.userData.ghost) {
        m.castShadow = false;
        m.receiveShadow = false;
        return;
      }
      m.castShadow = true;
      m.receiveShadow = true;
    });
  }
}
