// 전자레인지: 평 기어(턴테이블 감속 기어열) + 차축(롤러 링 바퀴 축) 미션
// 좌표: X = 폭(오른쪽에 조작부), Y = 위, Z = 앞(+Z가 문 쪽). 조리실 바닥 아래(기계실)가 컷어웨이로 보인다.
// 기어는 수평(축 = Y). 평면 계산은 (u, v) = (x, -z) — rotation.y 양(+)이 (u, v) 반시계와 같다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildSpurGearMesh } from '../models/factory';
import { gearDims } from '../models/parts/gears';
import { extrude, lathe, roundedRect, type V2 } from '../models/parts/geom';
import { CATEGORY_COLORS, brass, bronze, darkSteel, ghost, glass, glow, paint, plastic, rubber, steel, wood } from '../models/materials';
import { BaseMachine, type MachineDisplayItem, type MachineSim } from './types';

// ── 본체 치수 ──
const COUNTER_TOP = 0.08;
const X0 = -1.3;
const X1 = 1.3;
const Y0 = 0.14;
const Y1 = 1.64;
const Z0 = -0.9;
const Z1 = 0.9;
const T = 0.04;
/** 기계실 바닥판 윗면 */
const BASE = Y0 + T;
/** 조리실 바닥 윗면 */
const FLOOR = 0.52;
const CAV_X1 = 0.48;
const DIV_X1 = 0.54;

// ── 기어열 (모듈 0.016, 잇수비 48/12 × 60/10 = 24) ──
const MOD = 0.016;
const N1 = 12;
const N2 = 48;
const N3 = 10;
const N4 = 60;
const RP = (n: number) => (n * MOD) / 2;
const RATIO = (N2 / N1) * (N4 / N3);
const PLATE_RPM = 6;
const MOTOR_RPM = PLATE_RPM * RATIO;
const Y_STAGE1 = 0.31;
const Y_STAGE2 = 0.39;
const W_STAGE1 = 0.04;
const W_STAGE2 = 0.045;

/** 출력축(회전판 중심) — 조리실 중앙 */
const O = new THREE.Vector2(-0.37, -0.02); // (u, v) = (x, -z)
const angKO = (-35 * Math.PI) / 180;
const K = new THREE.Vector2(O.x + Math.cos(angKO) * (RP(N3) + RP(N4)), O.y + Math.sin(angKO) * (RP(N3) + RP(N4)));
const angKM = (-150 * Math.PI) / 180;
const M = new THREE.Vector2(K.x + Math.cos(angKM) * (RP(N1) + RP(N2)), K.y + Math.sin(angKM) * (RP(N1) + RP(N2)));
const toWorld = (p: THREE.Vector2, y: number) => new THREE.Vector3(p.x, y, -p.y);
const dirOf = (from: THREE.Vector2, to: THREE.Vector2) => Math.atan2(to.y - from.y, to.x - from.x);
const PHI_MK = dirOf(M, K);
const PHI_KO = dirOf(K, O);

// ── 롤러 링 / 회전판 ──
const WHEEL_R = 0.05;
const TRACK_R = 0.42;
const RING_Y = FLOOR + WHEEL_R;
/** 회전판 바닥 돌기(롤러가 닿는 면) 높이 */
const PLATE_Y = FLOOR + 2 * WHEEL_R;
const PLATE_R = 0.7;
const LOBE_ANG = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];

const wrap = (a: number, period: number) => a - period * Math.round(a / period);

/** 맞물림 위상(Clock.ts와 같은 규약: 이 중심 (k+½)·step) — 구동 기어 θd일 때 피동 기어 각도 */
function meshPhase(thetaD: number, nD: number, phi: number, nF: number): number {
  const stepD = (Math.PI * 2) / nD;
  const eps = wrap(thetaD + stepD / 2 - phi, stepD);
  return phi + Math.PI - (eps * nD) / nF;
}

const PH2 = meshPhase(0, N1, PHI_MK, N2);
const PH4 = meshPhase(PH2, N3, PHI_KO, N4);

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

function rbox(w: number, h: number, d: number, r: number, segs = 2): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, segs, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
}

/** 수평(축 = Y) 기어: 치형은 XY에서 만들어 X축으로 눕힌다 → 로컬 각 = (u, v) 각 */
function flatGear(n: number, depth: number, material: THREE.Material): THREE.Mesh {
  const { ra, rf } = gearDims(n, RP(n));
  const g = buildSpurGearMesh(n, ra, ra - rf, depth);
  (g.material as THREE.Material).dispose();
  g.material = material;
  g.geometry.rotateX(-Math.PI / 2);
  return g;
}

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Microwave extends BaseMachine {
  readonly id = 'microwave';
  private gearSet: THREE.Group | null = null;
  private ringSet: THREE.Group | null = null;
  private motorRotor = new THREE.Group();
  private compoundHolder = new THREE.Group();
  private outputHolder = new THREE.Group();
  private ringHolder = new THREE.Group();
  private wheels: THREE.Object3D[] = [];
  private plate = new THREE.Group();
  private bowl = new THREE.Group();
  private lampMat = glow(0xffe7a8, 0.35);

  constructor() {
    super();
    this.buildCounter();
    this.buildBody();
    this.buildDoor();
    this.buildControlPanel();
    this.buildMachineBay();
    this.buildPlate();
    this.buildBowl();

    this.motorRotor.position.copy(toWorld(M, 0));
    this.compoundHolder.position.copy(toWorld(K, 0));
    this.outputHolder.position.copy(toWorld(O, 0));
    this.ringHolder.position.copy(toWorld(O, RING_Y));
    this.group.add(this.motorRotor, this.compoundHolder, this.outputHolder, this.ringHolder, this.plate, this.bowl);
    this.parkPlate();

    this.addGearSlot();
    const s1 = new THREE.Mesh(
      new THREE.TorusGeometry(TRACK_R, 0.022, 10, 64),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    s1.rotation.x = Math.PI / 2;
    s1.position.copy(toWorld(O, FLOOR + 0.03));
    s1.userData.slot = true;
    this.slots[1] = s1;
    this.group.add(s1);
    this.hideSlot(1);
    this.applyShadows();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.gearSet !== null : this.ringSet !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? toWorld(O, 0) : toWorld(O, RING_Y);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? toWorld(K, Y_STAGE2) : toWorld(O, RING_Y);
  }

  buildStepModel(step: number): THREE.Group {
    return step === 0 ? this.buildGearSet() : this.buildRollerRing();
  }

  installStep(step: number, model: THREE.Group): void {
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    if (step === 0) {
      model.position.copy(toWorld(O, 0));
      model.rotation.set(0, 0, 0);
      this.group.add(model);
      this.gearSet = model;
      // 겹기어·출력 기어는 각자의 축(회전 홀더)으로 옮겨 단다
      const comp = model.getObjectByName('compound');
      const out = model.getObjectByName('output');
      if (comp) {
        this.compoundHolder.add(comp);
        comp.position.set(0, 0, 0);
      }
      if (out) {
        this.outputHolder.add(out);
        out.position.set(0, 0, 0);
      }
      this.setTrain(0);
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      this.ringHolder.add(model);
      this.ringSet = model;
      this.wheels = [];
      model.traverse((o) => {
        if (o.name === 'wheel') this.wheels.push(o);
      });
      this.ringHolder.rotation.y = 0;
      // 롤러 링 위에 회전판을 올리고 그릇을 얹는다(커플러 돌기와 판의 홈을 맞춘 각도)
      this.seatPlate();
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.gearSet) {
      const comp = this.compoundHolder.getObjectByName('compound');
      const out = this.outputHolder.getObjectByName('output');
      if (comp) this.compoundHolder.remove(comp);
      if (out) this.outputHolder.remove(out);
      this.group.remove(this.gearSet);
      this.gearSet = null;
    }
    if (this.ringSet) {
      this.ringHolder.remove(this.ringSet);
      this.ringSet = null;
    }
    this.wheels = [];
    this.setTrain(0);
    this.ringHolder.rotation.y = 0;
    this.parkPlate();
    this.lampMat.emissiveIntensity = 0.35;
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.gearSet || !this.ringSet) throw new Error('microwave mission incomplete');
    const wMotor = (MOTOR_RPM / 60) * Math.PI * 2;
    let motorAngle = 0;
    const out0 = this.outputHolder.rotation.y;
    const display: MachineDisplayItem[] = [
      { label: '모터', value: String(MOTOR_RPM), unit: 'rpm', tone: 'red' },
      { label: '감속비', value: `${RATIO}`, unit: `: 1 (${N2}/${N1}×${N4}/${N3})` },
      { label: '회전판', value: PLATE_RPM.toFixed(1), unit: 'rpm', tone: 'blue' }
    ];
    return {
      update: (dt: number) => {
        motorAngle += wMotor * dt;
        const outAngle = this.setTrain(motorAngle);
        // 판은 커플러와 함께, 롤러 링은 미끄럼 없는 구름 조건으로 판 각속도의 절반
        this.plate.rotation.y = outAngle;
        const ringAngle = (outAngle - out0) / 2;
        this.ringHolder.rotation.y = ringAngle;
        // 바퀴 중심 속도 Ω·R = 바퀴 자전 ω·r (바닥 접점 정지)
        const spin = -(ringAngle * TRACK_R) / WHEEL_R;
        for (const w of this.wheels) w.rotation.x = spin;
        this.lampMat.emissiveIntensity = 1.6;
      },
      getDisplay: () => display
    };
  }

  /** 모터 각 → 기어열 전체 위상(맞물림 유지). 출력축 각을 돌려준다 */
  private setTrain(motorAngle: number): number {
    // 초기 위상만 meshPhase로 맞추고 이후는 잇수비로 연속 계산(이 피치 단위 되감김 방지)
    this.motorRotor.rotation.y = motorAngle;
    const th2 = PH2 - (motorAngle * N1) / N2;
    this.compoundHolder.rotation.y = th2;
    const th4 = PH4 - ((th2 - PH2) * N3) / N4;
    this.outputHolder.rotation.y = th4;
    return th4;
  }

  private parkPlate(): void {
    // 롤러 링이 없으면 판을 올릴 수 없다 — 본체 오른쪽 옆판에 기대어 세워 둔다(윗면이 옆판 쪽)
    const beta = (10 * Math.PI) / 180;
    this.plate.position.set(X1 + PLATE_R * Math.sin(beta) + 0.062 * Math.cos(beta), COUNTER_TOP + PLATE_R * Math.cos(beta) + 0.012, 0.1);
    this.plate.rotation.set(0, 0, Math.PI / 2 + beta);
    this.group.add(this.bowl);
    this.bowl.position.set(2.05, COUNTER_TOP, 1.0);
    this.bowl.rotation.set(0, 0.4, 0);
  }

  private seatPlate(): void {
    this.plate.position.copy(toWorld(O, PLATE_Y));
    this.plate.rotation.set(0, this.outputHolder.rotation.y, 0);
    this.plate.add(this.bowl);
    this.bowl.position.set(0.16, 0.04, 0.08);
    this.bowl.rotation.set(0, 0, 0);
  }

  // ───────────────────────── 장착 부품 ─────────────────────────

  /** 1단계: 겹기어(48T + 10T) + 출력 기어(60T)·출력축·커플러 — 모델 원점 = 출력축 바닥 중심 */
  private buildGearSet(): THREE.Group {
    const g = new THREE.Group();
    const cream = plastic(0xf1ead8, { roughness: 0.38 });
    const red = plastic(0xd9574c, { roughness: 0.4 });

    const comp = new THREE.Group();
    comp.name = 'compound';
    comp.add(mesh(flatGear(N2, W_STAGE1, cream).geometry, cream, 0, Y_STAGE1, 0));
    comp.add(mesh(flatGear(N3, W_STAGE2, cream).geometry, cream, 0, Y_STAGE2, 0));
    // 두 기어를 잇는 보스(축 구멍)
    comp.add(mesh(lathe([[0.024, Y_STAGE1 - W_STAGE1 / 2 - 0.006], [0.058, Y_STAGE1 - W_STAGE1 / 2 - 0.006], [0.058, Y_STAGE2 - 0.01], [0.05, Y_STAGE2 + W_STAGE2 / 2 + 0.004], [0.024, Y_STAGE2 + W_STAGE2 / 2 + 0.004]], 40), cream));
    // 원판 리브 무늬(회전이 보이게) — 큰 기어 윗면의 구멍 대신 붉은 점 하나
    comp.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 20), glow(CATEGORY_COLORS.power, 0.25), 0.24, Y_STAGE1 + W_STAGE1 / 2 + 0.002, 0));
    const kOff = toWorld(K, 0).sub(toWorld(O, 0));
    comp.position.copy(kOff);
    g.add(comp);

    const out = new THREE.Group();
    out.name = 'output';
    out.add(mesh(flatGear(N4, W_STAGE2, red).geometry, red, 0, Y_STAGE2, 0));
    out.add(mesh(lathe([[0.024, Y_STAGE2 - W_STAGE2 / 2 - 0.008], [0.075, Y_STAGE2 - W_STAGE2 / 2 - 0.008], [0.075, Y_STAGE2 + W_STAGE2 / 2 + 0.008], [0.024, Y_STAGE2 + W_STAGE2 / 2 + 0.008]], 40), red));
    // 기어 웹의 구멍 4개(무게 줄임 + 회전 표시)
    const holeMat = darkSteel();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      out.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, W_STAGE2 + 0.002, 24), holeMat, Math.cos(a) * 0.25, Y_STAGE2, Math.sin(a) * 0.25));
    }
    // 출력축: 기계실 바닥 부싱 → 조리실 바닥 관통 → 커플러
    out.add(mesh(lathe([[0, BASE + 0.035], [0.022, BASE + 0.035], [0.022, FLOOR + 0.04], [0, FLOOR + 0.04]], 24), steel()));
    const couplerMat = plastic(0x4a5058, { roughness: 0.45 });
    out.add(mesh(lathe([[0, FLOOR + 0.004], [0.05, FLOOR + 0.004], [0.05, 0.615], [0.042, 0.625], [0, 0.625]], 32), couplerMat));
    const lobes: THREE.BufferGeometry[] = [];
    for (const a of LOBE_ANG) {
      const b = new RoundedBoxGeometry(0.035, 0.068, 0.13, 2, 0.008);
      b.translate(0, 0.59, 0.03 + 0.065);
      b.rotateY(a);
      lobes.push(b);
    }
    const lobeGeo = mergeGeometries(lobes);
    lobes.forEach((b) => b.dispose());
    out.add(mesh(lobeGeo, couplerMat));
    g.add(out);
    return g;
  }

  /** 2단계: 롤러 링(링 + 바퀴 3개) — 바퀴 축(차축)은 링에 고정, 바퀴만 돈다. 원점 = 바퀴 중심 높이 */
  private buildRollerRing(): THREE.Group {
    const g = new THREE.Group();
    const ringMat = plastic(0x5d6672, { roughness: 0.45 });
    g.add(mesh(lathe([[0.33, -0.011], [0.356, -0.011], [0.356, 0.011], [0.33, 0.011], [0.33, -0.011]], 96), ringMat));
    const axleMat = steel();
    const capMat = plastic(CATEGORY_COLORS.shaft, { roughness: 0.35 });
    const tireMat = rubber({ roughness: 0.7 });
    const hubMat = plastic(0xe9edf1, { roughness: 0.4 });
    const tireGeo = lathe(
      [
        [0.012, -0.016],
        [WHEEL_R - 0.006, -0.016],
        [WHEEL_R, -0.01],
        [WHEEL_R, 0.01],
        [WHEEL_R - 0.006, 0.016],
        [0.012, 0.016],
        [0.012, -0.016]
      ],
      40
    );
    tireGeo.rotateZ(-Math.PI / 2);
    const hubGeo = lathe([[0.007, -0.018], [0.026, -0.018], [0.026, 0.018], [0.007, 0.018], [0.007, -0.018]], 28);
    hubGeo.rotateZ(-Math.PI / 2);
    const axleGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.14, 16);
    axleGeo.rotateZ(Math.PI / 2);
    const capGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.014, 20);
    capGeo.rotateZ(Math.PI / 2);
    const bossGeo = rbox(0.03, 0.034, 0.04, 0.006);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = LOBE_ANG[i]! + Math.PI / 3;
      arm.add(mesh(axleGeo, axleMat, TRACK_R - 0.01, 0, 0));
      arm.add(mesh(capGeo, capMat, TRACK_R + 0.065, 0, 0));
      arm.add(mesh(bossGeo, ringMat, 0.343, 0, 0));
      const wheel = new THREE.Group();
      wheel.name = 'wheel';
      wheel.position.x = TRACK_R;
      wheel.add(mesh(tireGeo, tireMat));
      wheel.add(mesh(hubGeo, hubMat));
      // 바퀴 옆면의 흰 표시(구름이 보이게)
      wheel.add(mesh(new THREE.BoxGeometry(0.004, 0.016, 0.01), hubMat, 0.017, 0.034, 0));
      arm.add(wheel);
      g.add(arm);
    }
    return g;
  }

  private addGearSlot(): void {
    const t1 = new THREE.TorusGeometry(RP(N2) + 0.05, 0.02, 10, 64);
    t1.rotateX(Math.PI / 2);
    const kw = toWorld(K, Y_STAGE1);
    t1.translate(kw.x, kw.y, kw.z);
    const t2 = new THREE.TorusGeometry(RP(N4) + 0.05, 0.02, 10, 72);
    t2.rotateX(Math.PI / 2);
    const ow = toWorld(O, Y_STAGE2 + 0.02);
    t2.translate(ow.x, ow.y, ow.z);
    const merged = mergeGeometries([t1, t2]);
    t1.dispose();
    t2.dispose();
    const ring = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 }));
    ring.userData.slot = true;
    this.slots[0] = ring;
    this.group.add(ring);
  }

  // ───────────────────────── 고정 구조물 ─────────────────────────

  private buildCounter(): void {
    const top = mesh(rbox(4.5, COUNTER_TOP, 2.6, 0.03, 3), wood(0xa77b52), 0.45, COUNTER_TOP / 2, 0.2);
    this.group.add(top);
    const feetGeo = new THREE.CylinderGeometry(0.07, 0.08, Y0 - COUNTER_TOP, 24);
    const feetMat = rubber();
    for (const x of [X0 + 0.16, X1 - 0.16]) for (const z of [Z0 + 0.16, Z1 - 0.16]) this.group.add(mesh(feetGeo, feetMat, x, (Y0 + COUNTER_TOP) / 2, z));
  }

  private buildBody(): void {
    const shellMat = paint(0xeef0f2, { roughness: 0.3 });
    // 외함 슬리브(위·아래·좌·우) — 앞뒤로 뚫린 둥근 사각 관
    const outer = roundedRect(X0, Y0, X1, Y1, 0.07);
    outer.holes.push(roundedRect(X0 + T, Y0 + T, X1 - T, Y1 - T, 0.01));
    const depth = Z1 - 0.02 - Z0;
    const sleeve = mesh(extrude(outer, depth, 0.012, 16), shellMat, 0, 0, (Z0 + Z1 - 0.02) / 2);
    this.group.add(sleeve);
    this.group.add(mesh(rbox(X1 - X0 - 2 * T, Y1 - Y0 - 2 * T, 0.03, 0.005), shellMat, 0, (Y0 + Y1) / 2, Z0 + 0.035));

    // 조리실 내벽(밝은 법랑)
    const liner = paint(0xdfe3e7, { roughness: 0.5 });
    const cz = (Z0 + 0.05 + Z1 - 0.02) / 2;
    const cd = Z1 - 0.02 - (Z0 + 0.05);
    this.group.add(mesh(new THREE.BoxGeometry(0.04, Y1 - T - FLOOR, cd), liner, X0 + T + 0.02, (FLOOR + Y1 - T) / 2, cz));
    this.group.add(mesh(new THREE.BoxGeometry(DIV_X1 - (X0 + T), 0.04, cd), liner, (X0 + T + DIV_X1) / 2, Y1 - T - 0.02, cz));
    this.group.add(mesh(new THREE.BoxGeometry(DIV_X1 - (X0 + T), Y1 - T - FLOOR, 0.02), liner, (X0 + T + DIV_X1) / 2, (FLOOR + Y1 - T) / 2, Z0 + 0.06));
    this.group.add(mesh(new THREE.BoxGeometry(DIV_X1 - CAV_X1, Y1 - T - FLOOR, cd), liner, (CAV_X1 + DIV_X1) / 2, (FLOOR + Y1 - T) / 2, cz));
    // 도파관 커버(운모판)와 조리실 등
    const mica = plastic(0xcbb994, { roughness: 0.6 });
    this.group.add(mesh(rbox(0.012, 0.36, 0.42, 0.004), mica, CAV_X1 - 0.004, 1.18, -0.2));
    const lamp = mesh(rbox(0.012, 0.12, 0.2, 0.004), this.lampMat, CAV_X1 - 0.004, 1.42, 0.45);
    this.group.add(lamp);

    // 조리실 바닥: 반투명(아래 기계실의 기어열이 비쳐 보이게) + 둘레 테
    const floorMat = ghost(0xc9d3dc, 0.3);
    const floor = mesh(new THREE.BoxGeometry(DIV_X1 - (X0 + T), 0.02, cd), floorMat, (X0 + T + DIV_X1) / 2, FLOOR - 0.01, cz);
    floor.userData.ghost = true;
    floor.renderOrder = 2;
    this.group.add(floor);
    const rimMat = paint(0xc5ccd3, { roughness: 0.45 });
    this.group.add(mesh(new THREE.BoxGeometry(DIV_X1 - (X0 + T), 0.03, 0.03), rimMat, (X0 + T + DIV_X1) / 2, FLOOR - 0.015, Z1 - 0.035));
    this.group.add(mesh(new THREE.BoxGeometry(DIV_X1 - (X0 + T), 0.03, 0.03), rimMat, (X0 + T + DIV_X1) / 2, FLOOR - 0.015, Z0 + 0.065));
    // 바닥 관통 부싱
    const ow = toWorld(O, 0);
    this.group.add(mesh(lathe([[0.028, FLOOR - 0.03], [0.07, FLOOR - 0.03], [0.07, FLOOR + 0.004], [0.064, FLOOR + 0.008], [0.028, FLOOR + 0.008]], 36), plastic(0x8d959e), ow.x, 0, ow.z));
    // 조작부 쪽 칸 바닥(불투명 강판)
    this.group.add(mesh(new THREE.BoxGeometry(X1 - T - DIV_X1, 0.02, Z1 - Z0 - 0.1), darkSteel(), (DIV_X1 + X1 - T) / 2, FLOOR - 0.01, (Z0 + Z1) / 2 - 0.01));

    // 앞 베젤(문 닫히는 면) — 조리실 입구 둘레
    const bez = new THREE.Shape();
    bez.moveTo(X0, FLOOR - 0.02);
    bez.lineTo(0.56, FLOOR - 0.02);
    bez.lineTo(0.56, Y1);
    bez.lineTo(X0 + 0.07, Y1);
    bez.absarc(X0 + 0.07, Y1 - 0.07, 0.07, Math.PI / 2, Math.PI, false);
    bez.closePath();
    bez.holes.push(roundedRect(X0 + T + 0.04, FLOOR, CAV_X1, Y1 - T - 0.04, 0.03));
    this.group.add(mesh(extrude(bez, 0.03, 0.006, 12), paint(0xd6dade, { roughness: 0.4 }), 0, 0, Z1 - 0.005));
    // 기계실 앞 덮개: 컷어웨이(아주 옅은 반투명)
    const skirt = new THREE.Shape();
    skirt.moveTo(X0 + 0.07, Y0);
    skirt.lineTo(0.56, Y0);
    skirt.lineTo(0.56, FLOOR - 0.02);
    skirt.lineTo(X0, FLOOR - 0.02);
    skirt.lineTo(X0, Y0 + 0.07);
    skirt.absarc(X0 + 0.07, Y0 + 0.07, 0.07, Math.PI, Math.PI * 1.5, false);
    skirt.closePath();
    const sk = mesh(extrude(skirt, 0.02, 0.004, 12), ghost(0xb9c6d2, 0.14), 0, 0, Z1 - 0.01);
    sk.userData.ghost = true;
    sk.renderOrder = 3;
    this.group.add(sk);

    // 윗판 뒤쪽 통풍 슬롯
    const slotGeos: THREE.BufferGeometry[] = [];
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 14; i++) {
        const b = rbox(0.035, 0.012, 0.22, 0.005, 1);
        b.translate(-0.9 + i * 0.07 + r * 1.15, Y1 + 0.002, -0.62);
        slotGeos.push(b);
      }
    }
    const slots = mergeGeometries(slotGeos);
    slotGeos.forEach((b) => b.dispose());
    this.group.add(mesh(slots, plastic(0x2a2e34)));
  }

  private buildDoor(): void {
    const DW = 0.56 - X0 + 0.02;
    const DY0 = Y0 + 0.02;
    const DY1 = Y1 - 0.01;
    const DT = 0.07;
    const door = new THREE.Group();
    door.position.set(X0, 0, Z1 + 0.035);
    door.rotation.y = -1.85;
    const frame = roundedRect(0, DY0, DW, DY1, 0.06);
    frame.holes.push(roundedRect(0.2, 0.42, DW - 0.34, DY1 - 0.24, 0.05));
    door.add(mesh(extrude(frame, DT, 0.014, 16), paint(0xeef0f2, { roughness: 0.3 }), 0, 0, DT / 2));
    // 안쪽 초크 판(어두운 테두리)
    const inner = roundedRect(0.06, DY0 + 0.06, DW - 0.06, DY1 - 0.06, 0.04);
    inner.holes.push(roundedRect(0.2, 0.42, DW - 0.34, DY1 - 0.24, 0.05));
    door.add(mesh(extrude(inner, 0.014, 0.003, 12), plastic(0x3a3f46, { roughness: 0.5 }), 0, 0, -0.006));
    // 창: 유리 + 타공 차폐망(전자파 차단)
    const winW = DW - 0.34 - 0.2;
    const winH = DY1 - 0.24 - 0.42;
    const gl = mesh(new THREE.PlaneGeometry(winW, winH), glass(0x9fb8cc, 0.3), 0.2 + winW / 2, 0.42 + winH / 2, DT * 0.6);
    gl.renderOrder = 4;
    door.add(gl);
    const holes = canvasTex(64, 64, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#000000';
      for (const [x, y] of [
        [16, 16],
        [48, 16],
        [0, 48],
        [32, 48],
        [64, 48]
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    holes.colorSpace = THREE.NoColorSpace;
    holes.wrapS = THREE.RepeatWrapping;
    holes.wrapT = THREE.RepeatWrapping;
    holes.repeat.set(winW / 0.035, winH / 0.035);
    const meshMat = darkSteel({ roughness: 0.5 });
    meshMat.alphaMap = holes;
    meshMat.alphaTest = 0.5;
    meshMat.side = THREE.DoubleSide;
    door.add(mesh(new THREE.PlaneGeometry(winW + 0.02, winH + 0.02), meshMat, 0.2 + winW / 2, 0.42 + winH / 2, DT * 0.25));
    // 걸쇠 2개(닫으면 본체 구멍에 걸림)
    const latchMat = plastic(0xe6e9ec);
    for (const y of [0.62, 1.3]) door.add(mesh(rbox(0.03, 0.08, 0.09, 0.01), latchMat, DW - 0.1, y, -0.05));
    // 바깥 손잡이
    const handleMat = aluminum2();
    door.add(mesh(rbox(0.07, 0.9, 0.05, 0.022, 3), handleMat, DW - 0.12, (DY0 + DY1) / 2, DT + 0.06));
    for (const y of [(DY0 + DY1) / 2 - 0.38, (DY0 + DY1) / 2 + 0.38]) door.add(mesh(rbox(0.05, 0.05, 0.05, 0.012), handleMat, DW - 0.12, y, DT + 0.025));
    // 경첩
    const hingeMat = steel();
    for (const y of [0.4, 1.4]) door.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 20), hingeMat, 0.0, y, 0.0));
    this.group.add(door);
  }

  private buildControlPanel(): void {
    const sh = new THREE.Shape();
    const r = 0.07;
    const px0 = 0.56;
    sh.moveTo(px0, Y0);
    sh.lineTo(X1 - r, Y0);
    sh.absarc(X1 - r, Y0 + r, r, -Math.PI / 2, 0, false);
    sh.lineTo(X1, Y1 - r);
    sh.absarc(X1 - r, Y1 - r, r, 0, Math.PI / 2, false);
    sh.lineTo(px0, Y1);
    sh.closePath();
    this.group.add(mesh(extrude(sh, 0.03, 0.008, 12), plastic(0x2b3037, { roughness: 0.35 }), 0, 0, Z1 - 0.005));
    const cx = (px0 + X1) / 2;
    const fz = Z1 + 0.012;
    // 표시창
    const tex = canvasTex(256, 96, (ctx) => {
      ctx.fillStyle = '#06140c';
      ctx.fillRect(0, 0, 256, 96);
      ctx.fillStyle = '#5dff9b';
      ctx.font = 'bold 64px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('1:30', 128, 52);
    });
    const disp = glow(0xffffff, 0.9);
    disp.map = tex;
    disp.emissiveMap = tex;
    this.group.add(mesh(rbox(0.52, 0.2, 0.02, 0.01), plastic(0x15181c), cx, 1.42, fz));
    this.group.add(mesh(new THREE.PlaneGeometry(0.46, 0.15), disp, cx, 1.42, fz + 0.011));
    // 다이얼 2개(시간·출력)
    const knobGeo = lathe([[0, 0], [0.12, 0], [0.125, 0.01], [0.118, 0.05], [0.1, 0.065], [0, 0.068]], 48);
    knobGeo.rotateX(Math.PI / 2);
    const knobMat = paint(0xc9ced4, { roughness: 0.25, metalness: 0.6 });
    const ptrMat = paint(0xd8362f);
    for (const y of [1.08, 0.72]) {
      this.group.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 48).rotateX(Math.PI / 2), plastic(0x1d2025), cx, y, fz - 0.002));
      this.group.add(mesh(knobGeo, knobMat, cx, y, fz));
      this.group.add(mesh(rbox(0.018, 0.08, 0.012, 0.004), ptrMat, cx, y + 0.06, fz + 0.066));
    }
    // 문 열림 버튼
    this.group.add(mesh(rbox(0.42, 0.14, 0.04, 0.03), plastic(0xd7dbe0, { roughness: 0.4 }), cx, 0.36, fz + 0.01));
  }

  /** 조리실 바닥 아래 기계실: 턴테이블 모터(피니언 12T), 겹기어 고정 축, 출력축 부싱 */
  private buildMachineBay(): void {
    const mw = toWorld(M, 0);
    const kw = toWorld(K, 0);
    const ow = toWorld(O, 0);
    // 납작한 동기 모터(캔 + 장착 귀 + 전선)
    const can = steel({ roughness: 0.45 });
    this.group.add(
      mesh(
        lathe([[0.012, 0.205], [0.15, 0.205], [0.16, 0.215], [0.16, 0.265], [0.15, 0.277], [0.04, 0.277], [0.035, 0.285], [0.012, 0.285]], 48),
        can,
        mw.x,
        0,
        mw.z
      )
    );
    const earDir = new THREE.Vector3(Math.cos(0.5), 0, Math.sin(0.5));
    const earMat = darkSteel();
    for (const s of [-1, 1]) {
      const p = mw.clone().addScaledVector(earDir, s * 0.2);
      const ear = mesh(rbox(0.1, 0.012, 0.07, 0.004), earMat, p.x, 0.212, p.z);
      ear.rotation.y = -0.5;
      this.group.add(ear);
      this.group.add(mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.206 - BASE, 16), plastic(0x9aa2ab), p.x, (BASE + 0.206) / 2, p.z));
      this.group.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 6), steel(), p.x, 0.222, p.z));
    }
    // 단자 + 전선 2가닥(조작부 칸으로)
    const term = mw.clone().add(new THREE.Vector3(0.12, 0, -0.1));
    this.group.add(mesh(rbox(0.07, 0.04, 0.06, 0.008), plastic(0xf0f0ea), term.x, 0.245, term.z));
    for (const [i, col] of [
      [0, 0x2f6fc0],
      [1, 0xd8362f]
    ] as const) {
      const off = i * 0.025;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(term.x + 0.03, 0.25, term.z - 0.01 + off),
        new THREE.Vector3(term.x + 0.3, 0.22, term.z - 0.2 + off),
        new THREE.Vector3(0.75, BASE + 0.012, -0.2 + off),
        new THREE.Vector3(1.05, BASE + 0.012, -0.5 + off)
      ]);
      this.group.add(mesh(new THREE.TubeGeometry(curve, 40, 0.009, 10), plastic(col, { roughness: 0.5 })));
    }
    // 모터 축 + 피니언(회전부)
    this.motorRotor.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 16), steel(), 0, 0.305, 0));
    this.motorRotor.add(mesh(flatGear(N1, W_STAGE1, brass()).geometry, brass(), 0, Y_STAGE1, 0));
    this.motorRotor.add(mesh(new THREE.BoxGeometry(0.03, 0.004, 0.01), glow(0xf2b619, 0.3), 0.05, Y_STAGE1 + W_STAGE1 / 2 + 0.002, 0));

    // 겹기어 고정 축(핀) + 받침 보스 + 멈춤 와셔
    const postMat = steel();
    this.group.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.03, 32), plastic(0x9aa2ab), kw.x, BASE + 0.015, kw.z));
    this.group.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44 - BASE, 20), postMat, kw.x, (BASE + 0.44) / 2, kw.z));
    this.group.add(mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.006, 24), darkSteel(), kw.x, Y_STAGE2 + W_STAGE2 / 2 + 0.012, kw.z));
    // 출력축 아래 부싱(청동)
    this.group.add(mesh(lathe([[0.024, BASE], [0.065, BASE], [0.065, BASE + 0.03], [0.05, BASE + 0.045], [0.024, BASE + 0.045]], 36), bronze(), ow.x, 0, ow.z));
    // 기계실 바닥 보강 리브
    const ribMat = paint(0xd2d6db, { roughness: 0.5 });
    for (const z of [-0.6, 0.62]) this.group.add(mesh(new THREE.BoxGeometry(2.3, 0.02, 0.04), ribMat, 0, BASE + 0.01, z));
  }

  private buildPlate(): void {
    const prof: V2[] = [
      [0, 0.014],
      [0.4, 0.014],
      [0.404, 0.002],
      [0.41, 0],
      [0.43, 0],
      [0.436, 0.002],
      [0.44, 0.014],
      [0.665, 0.014],
      [0.69, 0.02],
      [PLATE_R, 0.04],
      [PLATE_R - 0.004, 0.06],
      [PLATE_R - 0.018, 0.066],
      [PLATE_R - 0.03, 0.058],
      [PLATE_R - 0.04, 0.04],
      [0, 0.04]
    ];
    const gMat = glass(0xd3ecff, 0.34);
    const plate = mesh(lathe(prof, 96), gMat);
    plate.renderOrder = 5;
    this.plate.add(plate);
    // 아래 허브: 커플러 돌기 3개가 들어가는 홈 사이의 부채꼴 3조각
    const gap = 0.26;
    for (const a of LOBE_ANG) {
      const seg = new THREE.LatheGeometry(
        [new THREE.Vector2(0.13, -0.03), new THREE.Vector2(0.17, -0.03), new THREE.Vector2(0.17, 0.014), new THREE.Vector2(0.13, 0.014), new THREE.Vector2(0.13, -0.03)],
        16,
        a + gap,
        (Math.PI * 2) / 3 - 2 * gap
      );
      const s = mesh(seg, glass(0xc4e2fb, 0.45));
      s.renderOrder = 5;
      this.plate.add(s);
    }
  }

  private buildBowl(): void {
    const ceramic = paint(0xf5f0e6, { roughness: 0.25 });
    this.bowl.add(
      mesh(
        lathe(
          [
            [0, 0],
            [0.13, 0],
            [0.15, 0.012],
            [0.21, 0.05],
            [0.255, 0.13],
            [0.265, 0.16],
            [0.258, 0.168],
            [0.245, 0.16],
            [0.205, 0.075],
            [0.13, 0.03],
            [0, 0.03]
          ],
          56
        ),
        ceramic
      )
    );
    // 파란 띠 무늬
    this.bowl.add(mesh(new THREE.TorusGeometry(0.257, 0.006, 8, 56).rotateX(Math.PI / 2), paint(0x2f6fc0), 0, 0.14, 0));
    // 국물 + 건더기
    this.bowl.add(mesh(new THREE.CylinderGeometry(0.228, 0.16, 0.08, 48), plastic(0xc8611f, { roughness: 0.25 }), 0, 0.075, 0));
    const bits: THREE.BufferGeometry[] = [];
    const cols = [0x3e9b4f, 0xf2c14e, 0xe7e2d3, 0x3e9b4f, 0xf2c14e];
    const pos: [number, number][] = [
      [0.08, 0.05],
      [-0.1, 0.06],
      [0.02, -0.12],
      [-0.06, -0.04],
      [0.12, -0.08]
    ];
    pos.forEach(([x, z], i) => {
      const b = rbox(0.06, 0.03, 0.05, 0.01, 1);
      b.rotateY(i * 0.9);
      b.translate(x, 0.118, z);
      const n = b.getAttribute('position').count;
      const c = new THREE.Color(cols[i]!);
      const arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) arr.set([c.r, c.g, c.b], k * 3);
      b.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
      bits.push(b);
    });
    const bitGeo = mergeGeometries(bits);
    bits.forEach((b) => b.dispose());
    const bitMat = plastic(0xffffff, { roughness: 0.5 });
    bitMat.vertexColors = true;
    this.bowl.add(mesh(bitGeo, bitMat));
  }

  private applyShadows(): void {
    this.enableShadows();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.slot) return;
      const mat = m.material as THREE.Material;
      if (m.userData.ghost || mat.transparent) {
        m.castShadow = false;
        return;
      }
      m.receiveShadow = true;
    });
  }
}

/** 손잡이: 무광 알루미늄 느낌의 도장 */
function aluminum2(): THREE.MeshPhysicalMaterial {
  return paint(0xb9c0c8, { roughness: 0.28, metalness: 0.7 });
}
