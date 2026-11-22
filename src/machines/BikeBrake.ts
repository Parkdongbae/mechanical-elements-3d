// 자전거 브레이크: 블록 브레이크와 스프링 미션 — 정비 스탠드에 물린 앞 포크 + 스포크 앞바퀴 + 핸들바·레버
// 림 브레이크(V브레이크형): 포크 다리의 보스에 두 암이 X축 둘레로 회전한다.
// 레버를 쥐면 속케이블이 두 암 윗끝을 끌어당기고(누들 쪽 암은 반력으로) 고무 블록이 림 옆면에 닿는다.
// 두 암 윗끝 사이의 압축 코일 스프링이 레버를 놓으면 암을 다시 벌린다.
// 레버 각 = 케이블 당김량 / R_LEVER, 케이블 당김량 = 두 스프링 자리 사이 거리 변화 — 레버·케이블·암·블록이 한 값에서 나온다.
// 좌표: 바퀴 축 = Z, 자전거 진행 방향 = +X, +Z = 카메라 쪽(오른쪽 레버).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, castIron, chrome, darkSteel, paint, plastic, rubber, steel } from '../models/materials';
import { type V2, TAU, lathe } from '../models/parts/geom';

const HUB = new THREE.Vector3(0, 1.15, 0);
const WHEEL_R = 0.95;
const TUBE = 0.075;
const S = 0.9; // Bicycle.ts 바퀴 치수 대비 비율
const RIM_HW = 0.05 * S; // 림 제동면 반폭
const PAD_R = 0.797; // 제동면 중앙 반지름
const MM_PER_UNIT = 340 / WHEEL_R; // 타이어 반지름 0.95 ≈ 340mm
const LEG_Z = 0.155;
const CROWN_Y = HUB.y + 1.08;
const STEER_TOP = 2.82;
const BAR = new THREE.Vector3(0.22, 2.86, 0);
// 브레이크 암
const PIV_Y = HUB.y + 0.68; // 보스는 림 제동면 바로 아래
const PIV_X = 0.06;
const PAD_X = 0.05;
const PAD_DY = HUB.y + Math.sqrt(PAD_R * PAD_R - PAD_X * PAD_X) - PIV_Y;
const PAD_T = 0.035;
const GAP = 0.012; // 해제 시 블록–림 간격(≈4mm)
const TOP_DY = 0.47;
const ARM_TOP_X = 0.17; // 암 윗끝이 앞으로 기울어 크라운을 피한다
const SEAT_DZ = 0.03; // 스프링 자리(누들 끝·클램프 면)가 암 중심선보다 안쪽
const R_LEVER = 0.31; // 레버 1rad당 케이블 당김량
// 동작
const MAX_RPM = 120;
const CYCLE = 6;
const LEVER_POS = new THREE.Vector3(0.28, BAR.y, 0.34);

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

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

/** (r, 축) 회전체를 Z축으로 */
function latheZ(pts: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(pts, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** (r, 축) 회전체를 X축으로 */
function latheX(pts: V2[], seg = 32): THREE.BufferGeometry {
  const g = lathe(pts, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function ring(rIn: number, rOut: number, a0: number, a1: number, c = 0.004): V2[] {
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

/** 두 점 사이 원기둥(단위 높이 지오메트리) 배치 */
function stretch(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = b.clone().sub(a);
  obj.position.copy(a).addScaledVector(d, 0.5);
  obj.scale.set(1, d.length(), 1);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

/** 암 국소점(피벗 기준 y, z)을 회전각 a(rotation.x)로 돌린 세계 z */
function rotYZ(y: number, z: number, a: number): { y: number; z: number } {
  return { y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) };
}

/** 오른쪽(+Z) 암 블록 면의 세계 z — 암이 안쪽으로 β만큼 돌았을 때 */
function padFaceZ(beta: number): number {
  return LEG_Z + rotYZ(PAD_DY, RIM_HW + GAP - LEG_Z, -beta).z;
}

/** 블록이 림에 닿는 암 회전각 */
const BETA_C = (() => {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (padFaceZ(mid) > RIM_HW) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** 스프링 자리(오른쪽 암 누들 끝) 세계 좌표 — 왼쪽은 z 대칭 */
function seat(beta: number): { y: number; z: number } {
  const r = rotYZ(TOP_DY, -SEAT_DZ, -beta);
  return { y: PIV_Y + r.y, z: LEG_Z + r.z };
}

const SPRING_POS = new THREE.Vector3(ARM_TOP_X, seat(0).y, 0);
const BRAKE_ANCHOR = new THREE.Vector3(PIV_X, PIV_Y + 0.25, 0);

export class BikeBrake extends BaseMachine {
  readonly id = 'bikebrake';
  private wheel = new THREE.Group();
  private lever = new THREE.Group();
  private armR: THREE.Object3D | null = null;
  private armL: THREE.Object3D | null = null;
  private wire: THREE.Object3D | null = null;
  private brakeModel: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private housing: THREE.Mesh;
  private housingBeta = -1;
  private spinAngle = 0;
  private omega = 0;
  private beta = 0;

  private readonly forkMat = paint(0x2a6fb0, { roughness: 0.32 });
  private readonly steelMat = steel();
  private readonly chromeMat = chrome({ roughness: 0.12 });
  private readonly housingMat = plastic(0x1d2024, { roughness: 0.35, grain: false });

  constructor() {
    super();
    this.wheel.position.copy(HUB);
    this.group.add(this.wheel, this.lever);
    this.buildWheel();
    this.buildFork();
    this.buildCockpit();
    this.buildStand();
    this.housing = new THREE.Mesh(new THREE.BufferGeometry(), this.housingMat);
    this.group.add(this.housing);
    this.updateHousing();

    this.addSlot(0, 0.22, new THREE.Vector3(0.08, PIV_Y + 0.22, 0.24), 0.022);
    this.addSlot(1, 0.065, SPRING_POS.clone(), 0.014);
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = s.receiveShadow = false;
    }
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.brakeModel !== null : this.springModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? BRAKE_ANCHOR.clone() : SPRING_POS.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0.08, PIV_Y + 0.22, 0.24) : SPRING_POS.clone();
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildBrake() : this.buildSpring();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      model.position.copy(BRAKE_ANCHOR);
      this.group.add(model);
      this.brakeModel = model;
      this.group.updateMatrixWorld(true);
      // 암·케이블은 기계 좌표로 옮겨 매 프레임 자세를 잡는다
      for (const name of ['armR', 'armL', 'wire'] as const) {
        const o = model.getObjectByName(name);
        if (!o) continue;
        this.group.attach(o);
        if (name === 'armR') this.armR = o;
        else if (name === 'armL') this.armL = o;
        else this.wire = o;
      }
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.copy(SPRING_POS);
      this.group.add(model);
      this.springModel = model;
      this.hideSlot(1);
    }
    this.applyBrake();
  }

  reset(): void {
    for (const o of [this.armR, this.armL, this.wire, this.brakeModel, this.springModel]) if (o) this.group.remove(o);
    this.armR = this.armL = this.wire = null;
    this.brakeModel = this.springModel = null;
    this.spinAngle = this.omega = this.beta = 0;
    this.wheel.rotation.z = 0;
    this.applyBrake();
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.brakeModel || !this.springModel) throw new Error('bikebrake mission incomplete');
    const wMax = (MAX_RPM / 60) * TAU;
    let time = 0;
    let b = 0;
    return {
      update: (dt: number) => {
        time = (time + dt) % CYCLE;
        const t = time;
        // 레버 쥠(0→1: 블록이 림에 닿을 때까지) → 유지 → 놓음
        if (t < 2.2) b = 0;
        else if (t < 2.45) b = smooth((t - 2.2) / 0.25);
        else if (t < 4.4) b = 1;
        else if (t < 4.75) b = 1 - smooth((t - 4.4) / 0.35);
        else b = 0;
        // 회전: 손으로 돌려 가속 → 정속 → 블록 마찰(일정 토크)로 선형 감속 → 정지
        if (t < 1.2) this.omega = wMax * smooth(t / 1.2);
        else if (t < 2.45) this.omega = wMax;
        else this.omega = wMax * Math.max(0, 1 - (t - 2.45) / 1.1);
        this.beta = b * BETA_C;
        // 앞으로 굴러가는 방향(+X) = Z축 기준 시계 방향
        this.spinAngle = (this.spinAngle - this.omega * dt) % TAU;
        this.wheel.rotation.z = this.spinAngle;
        this.applyBrake();
      },
      getDisplay: () => {
        const rpm = (this.omega / TAU) * 60;
        const gapMm = Math.max(0, padFaceZ(this.beta) - RIM_HW) * MM_PER_UNIT;
        const on = this.beta > BETA_C * 0.98;
        return [
          { label: '바퀴 회전수', value: rpm.toFixed(0), unit: 'rpm' },
          { label: '브레이크', value: on ? '작동' : this.beta > 0.001 ? '쥐는 중' : '해제', tone: on ? 'red' : 'blue' },
          { label: '블록–림 간격', value: gapMm.toFixed(1), unit: 'mm' }
        ];
      }
    };
  }

  // ── 자세 ──

  private applyBrake(): void {
    const beta = this.beta;
    if (this.armR) this.armR.rotation.x = -beta;
    if (this.armL) this.armL.rotation.x = beta;
    const sR = seat(beta);
    if (this.wire) {
      // 누들 끝 → 왼쪽 암 클램프(면 바깥으로 조금 더)
      stretch(this.wire, new THREE.Vector3(ARM_TOP_X, sR.y, sR.z), new THREE.Vector3(ARM_TOP_X, sR.y, -sR.z - 0.035));
    }
    if (this.springModel) {
      const len0 = 2 * seat(0).z;
      this.springModel.scale.set(1, 1, (2 * sR.z) / len0);
    }
    // 레버 각 = 케이블 당김량 / R_LEVER (블록·암·레버가 같은 값에서 나온다)
    const pull = 2 * (seat(0).z - sR.z);
    this.lever.rotation.y = -pull / R_LEVER;
    this.updateHousing();
  }

  /** 케이블 겉관: 레버 → 오른쪽 암 누들 끝(암과 함께 조금 움직인다) */
  private updateHousing(): void {
    const beta = this.armR ? this.beta : 0;
    if (Math.abs(beta - this.housingBeta) < 1e-4) return;
    this.housingBeta = beta;
    const n = this.noodleEnd(beta);
    const pts = [
      n,
      n.clone().add(new THREE.Vector3(0.0, 0.12, 0.03)),
      new THREE.Vector3(0.22, CROWN_Y + 0.25, 0.3),
      new THREE.Vector3(0.36, BAR.y - 0.18, 0.36),
      new THREE.Vector3(LEVER_POS.x + 0.07, BAR.y - 0.03, LEVER_POS.z - 0.04)
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.housing.geometry.dispose();
    this.housing.geometry = new THREE.TubeGeometry(curve, 90, 0.011, 10, false);
  }

  /** 누들 윗끝(겉관 시작점) 세계 좌표 */
  private noodleEnd(beta: number): THREE.Vector3 {
    const r = rotYZ(TOP_DY + 0.09, 0.075, -beta);
    return new THREE.Vector3(ARM_TOP_X, PIV_Y + r.y, LEG_Z + r.z);
  }

  // ── 미션 부품 ──

  /** ① 블록 브레이크: 두 암 + 고무 블록 + 누들 + 속케이블 — 원점 = BRAKE_ANCHOR */
  private buildBrake(): THREE.Group {
    const g = new THREE.Group();
    const armMat = aluminum({ roughness: 0.28 });
    const accent = paint(CATEGORY_COLORS.control, { roughness: 0.38 });
    const padMat = rubber({ color: 0x2a2b2e });
    for (const sz of [1, -1]) {
      const arm = new THREE.Group();
      arm.name = sz > 0 ? 'armR' : 'armL';
      arm.position.set(PIV_X - BRAKE_ANCHOR.x, PIV_Y - BRAKE_ANCHOR.y, sz * LEG_Z);
      // 암 몸체: 피벗에서 앞쪽 위로 휘어 오르는 막대
      const body = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.022, 0.16, sz * 0.012),
        new THREE.Vector3(0.068, 0.35, sz * 0.02),
        new THREE.Vector3(ARM_TOP_X - PIV_X, TOP_DY, sz * 0.02)
      ]);
      add(arm, new THREE.TubeGeometry(body, 48, 0.014, 14, false), armMat);
      add(arm, latheX(ring(0.012, 0.03, -0.024, 0.024), 32), armMat);
      add(arm, new THREE.SphereGeometry(0.014, 16, 12), armMat, ARM_TOP_X - PIV_X, TOP_DY, sz * 0.02);
      // 블록 홀더(볼트) + 고무 블록
      const faceZ = RIM_HW + GAP - LEG_Z; // 국소 z(오른쪽 기준)
      const boltLen = -faceZ - PAD_T + 0.01;
      const bolt = new THREE.CylinderGeometry(0.008, 0.008, boltLen, 12);
      bolt.rotateX(Math.PI / 2);
      add(arm, bolt, this.steelMat, PAD_X - PIV_X, PAD_DY, sz * (-boltLen / 2 + 0.005));
      const holder = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.04, 0.014, 2, 0.006), accent);
      holder.position.set(PAD_X - PIV_X, PAD_DY, sz * (faceZ + PAD_T + 0.006));
      arm.add(holder);
      const pad = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.032, PAD_T, 2, 0.008), padMat);
      pad.position.set(PAD_X - PIV_X, PAD_DY, sz * (faceZ + PAD_T / 2));
      arm.add(pad);
      // 블록 홈(물 빠짐)
      const grooveGeo = new THREE.BoxGeometry(0.006, 0.034, 0.012);
      for (const dx of [-0.035, 0, 0.035]) add(arm, grooveGeo, plastic(0x0f1012, { grain: false }), PAD_X - PIV_X + dx, PAD_DY, sz * (faceZ + 0.004));
      for (const dz of [-0.006, 0.006]) add(arm, new THREE.CylinderGeometry(0.014, 0.014, 0.004, 16).rotateX(Math.PI / 2), this.steelMat, PAD_X - PIV_X, PAD_DY, sz * (faceZ + PAD_T + 0.02 + dz));
      if (sz > 0) {
        // 누들: 스프링 자리(안쪽)에서 바깥으로 나와 위로 꺾이는 금속관
        const nd = new THREE.CatmullRomCurve3([
          new THREE.Vector3(ARM_TOP_X - PIV_X, TOP_DY, -SEAT_DZ),
          new THREE.Vector3(ARM_TOP_X - PIV_X, TOP_DY, 0.03),
          new THREE.Vector3(ARM_TOP_X - PIV_X, TOP_DY + 0.02, 0.062),
          new THREE.Vector3(ARM_TOP_X - PIV_X, TOP_DY + 0.06, 0.074),
          new THREE.Vector3(ARM_TOP_X - PIV_X, TOP_DY + 0.09, 0.075)
        ]);
        add(arm, new THREE.TubeGeometry(nd, 32, 0.0085, 12, false), this.chromeMat);
        add(arm, new RoundedBoxGeometry(0.03, 0.03, 0.03, 2, 0.006), armMat, ARM_TOP_X - PIV_X, TOP_DY, 0.0);
      } else {
        // 케이블 클램프 볼트
        const clamp = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.034, 0.04, 2, 0.006), armMat);
        clamp.position.set(ARM_TOP_X - PIV_X, TOP_DY, SEAT_DZ - 0.02);
        arm.add(clamp);
        const nut = new THREE.CylinderGeometry(0.012, 0.012, 0.016, 6);
        nut.rotateZ(Math.PI / 2);
        add(arm, nut, darkSteel(), ARM_TOP_X - PIV_X + 0.022, TOP_DY, SEAT_DZ - 0.02);
      }
      g.add(arm);
    }
    // 속케이블(스틸 와이어)
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 8), steel({ color: 0xe3e7eb, grain: false }));
    wire.name = 'wire';
    const s0 = seat(0);
    const a = new THREE.Vector3(ARM_TOP_X, s0.y, s0.z).sub(BRAKE_ANCHOR);
    const b = new THREE.Vector3(ARM_TOP_X, s0.y, -s0.z - 0.035).sub(BRAKE_ANCHOR);
    stretch(wire, a, b);
    g.add(wire);
    return g;
  }

  /** ② 복귀 스프링: 두 암 윗끝 사이 케이블에 끼우는 압축 코일 스프링 — 원점 = 스프링 중심, 축 = Z */
  private buildSpring(): THREE.Group {
    const g = new THREE.Group();
    const len = 2 * seat(0).z;
    const coils = 9;
    const R = 0.024;
    const pts: THREE.Vector3[] = [];
    const n = coils * 28;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      // 양끝은 피치를 좁혀 평평한 자리(닫힌 끝)를 만든다
      const a = u * coils * TAU;
      const endK = 0.6 / coils;
      const zc = u < endK ? (u / endK) * 0.03 : u > 1 - endK ? 1 - ((1 - u) / endK) * 0.03 : 0.03 + ((u - endK) / (1 - 2 * endK)) * 0.94;
      pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, (zc - 0.5) * len));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    add(g, new THREE.TubeGeometry(curve, n * 2, 0.0045, 8, false), paint(CATEGORY_COLORS.control, { roughness: 0.3, metalness: 0.5 }));
    return g;
  }

  // ── 고정 부품 ──

  private buildWheel(): void {
    const w = this.wheel;
    const RT = WHEEL_R - TUBE;
    const tireGeo = new THREE.TorusGeometry(RT, TUBE, 20, 320);
    const p = tireGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const th = Math.atan2(v.y, v.x);
      const cx = Math.cos(th) * RT;
      const cy = Math.sin(th) * RT;
      const dx = v.x - cx;
      const dy = v.y - cy;
      const out = (dx * Math.cos(th) + dy * Math.sin(th)) / TUBE;
      if (out > 0.4) {
        // 접지면 잔 트레드
        const band = THREE.MathUtils.smoothstep(out, 0.4, 0.75);
        const s = THREE.MathUtils.smoothstep(Math.sin(th * 120 + (v.z / TUBE) * 3), -0.2, 0.2);
        const k = 1 + 0.06 * s * band;
        p.setXYZ(i, cx + dx * k, cy + dy * k, v.z * k);
      }
    }
    tireGeo.computeVertexNormals();
    add(w, tireGeo, rubber({ color: 0x1d1f23 }));
    const rimPts: V2[] = (
      [
        [0.845, -0.022],
        [0.858, -0.05],
        [0.912, -0.05],
        [0.92, -0.044],
        [0.905, -0.036],
        [0.905, 0.036],
        [0.92, 0.044],
        [0.912, 0.05],
        [0.858, 0.05],
        [0.845, 0.022],
        [0.845, -0.022]
      ] as V2[]
    ).map(([r, z]) => [r * S, z * S] as V2);
    add(w, latheZ(rimPts, 128), aluminum({ color: 0xd3d8de, roughness: 0.24 }));
    // 허브
    const fl = 0.085 * S;
    const lock = LEG_Z - 0.012;
    add(
      w,
      latheZ(
        [
          [0.012, -lock],
          [0.036, -lock],
          [0.036, -fl - 0.03],
          [0.04, -fl - 0.012],
          [0.09, -fl - 0.007],
          [0.09, -fl + 0.007],
          [0.038, -fl + 0.02],
          [0.032, 0],
          [0.038, fl - 0.02],
          [0.09, fl - 0.007],
          [0.09, fl + 0.007],
          [0.04, fl + 0.012],
          [0.036, fl + 0.03],
          [0.036, lock],
          [0.012, lock]
        ],
        48
      ),
      aluminum({ color: 0xaab2bb })
    );
    // 스포크 32개(3크로스)
    const N = 32;
    const spokes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6), steel({ color: 0xd0d6dc, grain: false }), N);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const cross = (3 * 4 * Math.PI) / N;
    for (let i = 0; i < N; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const aR = (i / N) * TAU;
      const lead = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
      const aH = aR + lead * cross;
      a.set(Math.cos(aH) * 0.082, Math.sin(aH) * 0.082, side * fl);
      b.set(Math.cos(aR) * 0.765, Math.sin(aR) * 0.765, side * 0.005);
      const d = b.clone().sub(a);
      const len = d.length();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      m4.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
      spokes.setMatrixAt(i, m4);
    }
    w.add(spokes);
    // 밸브 + 반사판(회전 표시)
    const valve = new THREE.Group();
    valve.rotation.z = Math.PI / N - Math.PI / 2;
    add(valve, new THREE.CylinderGeometry(0.01, 0.01, 0.08, 12), this.chromeMat, 0, 0.735, 0);
    add(valve, new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12), plastic(0x1a1a1a), 0, 0.69, 0);
    w.add(valve);
    const refl = new THREE.Group();
    refl.rotation.z = Math.PI / 2 + (5 * Math.PI) / N;
    const rf = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.11, 0.022, 2, 0.008), plastic(0xf08a24, { roughness: 0.3 }));
    rf.position.set(0, 0.5, 0);
    refl.add(rf);
    w.add(refl);
    // 퀵릴리스 축
    add(this.group, latheZ(ring(0, 0.011, -LEG_Z - 0.03, LEG_Z + 0.03, 0.003), 16), this.steelMat, HUB.x, HUB.y, 0);
    const qrLever = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.17, 0.016, 2, 0.007), aluminum({ roughness: 0.3 }));
    qrLever.position.set(-0.05, HUB.y + 0.06, LEG_Z + 0.045);
    qrLever.rotation.z = 0.6;
    this.group.add(qrLever);
    add(this.group, latheZ(ring(0.011, 0.024, LEG_Z + 0.015, LEG_Z + 0.04, 0.004), 24), aluminum(), HUB.x, HUB.y, 0);
    add(this.group, latheZ(ring(0.011, 0.024, -LEG_Z - 0.04, -LEG_Z - 0.015, 0.004), 24), aluminum(), HUB.x, HUB.y, 0);
  }

  private buildFork(): void {
    const f = this.group;
    // 다리: 아래로 갈수록 가늘어지는 관 + 드롭아웃
    const legLen = CROWN_Y - HUB.y;
    const legGeo = lathe(
      [
        [0, 0],
        [0.018, 0],
        [0.021, 0.02],
        [0.025, legLen * 0.5],
        [0.03, legLen - 0.02],
        [0.03, legLen],
        [0, legLen]
      ],
      28
    );
    for (const sz of [-1, 1]) {
      add(f, legGeo, this.forkMat, 0, HUB.y + 0.02, sz * LEG_Z);
      const drop = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.08, 0.016, 2, 0.006), darkSteel());
      drop.position.set(0, HUB.y + 0.02, sz * LEG_Z);
      f.add(drop);
      // 브레이크 보스(피벗 축, +X로 돌출)
      add(f, latheX([[0, 0], [0.016, 0], [0.016, 0.06], [0.012, PIV_X + 0.03], [0, PIV_X + 0.03]], 20), this.steelMat, 0, PIV_Y, sz * LEG_Z);
      add(f, latheX(ring(0.016, 0.03, 0.0, 0.02), 24), this.forkMat, 0.012, PIV_Y, sz * LEG_Z);
    }
    // 크라운 + 스티어러 + 헤드셋
    const crown = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.08, 2 * LEG_Z + 0.08, 3, 0.03), this.forkMat);
    crown.position.set(0, CROWN_Y + 0.02, 0);
    f.add(crown);
    add(f, lathe([[0, CROWN_Y], [0.034, CROWN_Y], [0.034, STEER_TOP], [0, STEER_TOP]], 32), this.steelMat);
    add(f, lathe(ring(0.034, 0.05, CROWN_Y + 0.06, CROWN_Y + 0.1, 0.008), 36), darkSteel());
    // 반사판 브래킷 겸 케이블 가이드(크라운 앞)
    const guide = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.03, 0.04, 2, 0.008), darkSteel());
    guide.position.set(0.08, CROWN_Y + 0.03, 0);
    f.add(guide);
  }

  private buildCockpit(): void {
    const f = this.group;
    // 스템
    const stemDir = new THREE.Vector3(BAR.x, BAR.y - (STEER_TOP - 0.04), 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, stemDir.length(), 20), aluminum({ color: 0x3a3f45, roughness: 0.4 }));
    stretch(stem, new THREE.Vector3(0, STEER_TOP - 0.04, 0), BAR.clone());
    stem.scale.set(1, 1, 1);
    f.add(stem);
    add(f, lathe(ring(0, 0.042, STEER_TOP - 0.1, STEER_TOP + 0.01, 0.01), 32), aluminum({ color: 0x3a3f45, roughness: 0.4 }));
    add(f, latheZ(ring(0, 0.038, -0.05, 0.05, 0.01), 28), aluminum({ color: 0x3a3f45, roughness: 0.4 }), BAR.x, BAR.y, 0);
    // 핸들바 + 그립
    add(f, latheZ([[0, -0.55], [0.021, -0.55], [0.021, -0.12], [0.03, -0.07], [0.03, 0.07], [0.021, 0.12], [0.021, 0.55], [0, 0.55]], 28), aluminum({ roughness: 0.3 }), BAR.x, BAR.y, 0);
    const gripGeo = latheZ([[0.022, 0], [0.032, 0.005], [0.034, 0.08], [0.034, 0.16], [0.036, 0.17], [0.036, 0.19], [0.022, 0.19]], 28);
    add(f, gripGeo, rubber({ color: 0x2b2d31 }), BAR.x, BAR.y, 0.37);
    const gripL = add(f, gripGeo, rubber({ color: 0x2b2d31 }), BAR.x, BAR.y, -0.37);
    gripL.rotation.y = Math.PI;
    // 레버 몸체(고정): 핸들바 클램프 + 겉관 받이
    add(f, latheZ(ring(0.021, 0.034, 0.3, 0.345, 0.006), 28), plastic(0x2a2d32, { roughness: 0.4 }), BAR.x, BAR.y, 0);
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.05, 0.05, 2, 0.015), plastic(0x2a2d32, { roughness: 0.4 }));
    body.position.set(BAR.x + 0.055, BAR.y - 0.01, 0.325);
    f.add(body);
    const adj = new THREE.CylinderGeometry(0.014, 0.014, 0.04, 16);
    adj.rotateZ(Math.PI / 2);
    add(f, adj, aluminum({ roughness: 0.3 }), LEVER_POS.x + 0.05, BAR.y - 0.03, LEVER_POS.z - 0.04);
    // 레버 날(피벗 = LEVER_POS, 축 = Y): 그립 앞에서 손가락이 당긴다
    this.lever.position.copy(LEVER_POS);
    const blade = new THREE.Shape();
    blade.moveTo(-0.015, -0.01);
    blade.quadraticCurveTo(0.03, 0.02, 0.045, 0.06);
    blade.lineTo(0.05, 0.2);
    blade.quadraticCurveTo(0.045, 0.215, 0.032, 0.21);
    blade.lineTo(0.028, 0.07);
    blade.quadraticCurveTo(0.015, 0.035, -0.02, 0.02);
    blade.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 });
    bladeGeo.translate(0, 0, -0.009);
    bladeGeo.rotateX(Math.PI / 2); // Shape y(날 길이) → 세계 +Z, 두께 → Y
    this.lever.add(new THREE.Mesh(bladeGeo, aluminum({ color: 0xc4cad1, roughness: 0.25 })));
    add(this.lever, new THREE.CylinderGeometry(0.009, 0.009, 0.06, 12), this.steelMat);
  }

  private buildStand(): void {
    const f = this.group;
    const standMat = paint(0xc8483f, { roughness: 0.42 });
    const base = new THREE.Vector3(-0.3, 0, -0.85);
    // 무거운 원형 받침 + 기둥
    add(f, lathe([[0, 0], [0.4, 0], [0.42, 0.02], [0.4, 0.06], [0.12, 0.08], [0, 0.08]], 48), castIron({ color: 0x3a4047 }), base.x, 0, base.z);
    const postTop = 2.5;
    add(f, lathe([[0, 0.06], [0.045, 0.06], [0.045, postTop], [0.04, postTop + 0.02], [0, postTop + 0.02]], 32), standMat, base.x, 0, base.z);
    add(f, lathe(ring(0.045, 0.07, 1.2, 1.3, 0.01), 32), darkSteel(), base.x, 0, base.z);
    // 수평 팔 → 스티어러 클램프
    const clampY = CROWN_Y + 0.24;
    const a = new THREE.Vector3(base.x, clampY, base.z);
    const b = new THREE.Vector3(0, clampY, -0.06);
    add(f, lathe(ring(0.045, 0.075, clampY - 0.06, clampY + 0.06, 0.012), 32), standMat, base.x, 0, base.z);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1, 24), standMat);
    stretch(arm, a, b);
    f.add(arm);
    // 클램프 조(스티어러를 감싼다)
    add(f, lathe(ring(0.035, 0.075, clampY - 0.05, clampY + 0.05, 0.012), 36), darkSteel());
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 16), this.steelMat);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(-0.12, clampY, 0);
    f.add(knob);
    const tee = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.14, 0.03, 2, 0.01), darkSteel());
    tee.position.set(-0.18, clampY, 0);
    f.add(tee);
  }
}
