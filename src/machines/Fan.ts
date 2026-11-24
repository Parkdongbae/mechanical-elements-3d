// 선풍기: 웜과 웜 기어, 링크 미션 — 스탠드 선풍기(받침·기둥·모터·안전망·날개 3장).
// 모터 축 뒤끝의 1줄 웜이 36잇수 웜 휠을 돌린다(1/36 감속). 웜 휠 아래 출력축의 크랭크 → 연결 막대 →
// 기둥 꼭대기에 고정된 팔 끝 핀(A). 머리(모터+기어함)는 목 축(N, 세로)을 중심으로 돈다.
// 머리 좌표계에서 보면 N·C(크랭크 중심)가 고정된 크랭크-로커 4절 링크이고, 로커 N→A가 ±40° 흔들리는 만큼
// 머리가 반대로 돈다. 매 프레임 원(N, G) ∩ 원(P, L) 교점으로 풀어 막대 길이가 변하지 않는다.
// 좌표: 바닥 y=0, +Z = 바람이 나가는 앞(카메라 쪽), 목 축 = 세계 Y.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';
import { gearShape } from '../models/factory';
import { CATEGORY_COLORS, aluminum, bronze, chrome, copper, darkSteel, ghost, paint, plastic, rubber, steel } from '../models/materials';
import { lathe, merge, extrude, type V2 } from '../models/parts/geom';

// ── 치수 ──
const BASE_R = 0.82;
const BASE_H = 0.13;
const POLE_R = 0.06;
const NECK_Y = 1.7; // 목 축 회전 중심(고정 칼라 윗면)
const N = new THREE.Vector3(0, NECK_Y, 0);

// 머리 국소 좌표(원점 = N)
const MOTOR_Y = 0.52;
const MOTOR_R = 0.24;
const MOTOR_Z0 = -0.2;
const MOTOR_Z1 = 0.2;
const GUARD_R = 0.78;
const BLADE_Z = 0.44;
const BLADE_R = 0.64;
const BLADES = 3;

// 기어
const WORM_PR = 0.06; // 웜 피치 반지름
const WHEEL_TEETH = 36;
const WHEEL_PR = 0.19; // 웜 휠 피치 반지름
const WHEEL_X = WORM_PR + WHEEL_PR; // 웜 휠 중심 x (웜은 x=0)
const WHEEL_Z = -0.5;
const WORM_PITCH = (2 * Math.PI * WHEEL_PR) / WHEEL_TEETH;

// 링크(머리 국소 평면 (x, z))
const Y_CRANK = 0.075;
const Y_ROD = 0.025;
const Y_ARM = -0.05; // 고정 팔(세계에 고정)
const SWING = (80 * Math.PI) / 180;
const G = 0.3; // 로커 N→A (고정 팔 길이)
const C2 = new THREE.Vector2(WHEEL_X, WHEEL_Z); // 크랭크 중심 = 웜 휠 축
const GC = G * Math.cos(SWING / 2);
const ROD_L = Math.sqrt(C2.lengthSq() - GC * GC);
const CRANK_R = G * Math.sin(SWING / 2); // 시간비 1 크랭크-로커 조건
const MU = Math.atan2(C2.y, C2.x) + Math.atan2(ROD_L, GC); // 로커 흔들림 중심 방향
const A_WORLD = new THREE.Vector2(Math.cos(MU) * G, Math.sin(MU) * G); // ψ=0 일 때 = 세계 고정점

// 속도: 크랭크 10rpm(6초 왕복) × 36 = 모터 360rpm
const CRANK_RPM = 10;
const MOTOR_RPM = CRANK_RPM * WHEEL_TEETH;
const W_CRANK = (CRANK_RPM / 60) * Math.PI * 2;
const W_MOTOR = W_CRANK * WHEEL_TEETH;

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

/** 평면 (x, z) → 머리 국소 3D */
const at = (p: THREE.Vector2, y: number): THREE.Vector3 => new THREE.Vector3(p.x, y, p.y);

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && !m.userData.slot) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

/** Y축 원기둥 y0~y1 */
function cylY(r: number, y0: number, y1: number, seg = 32): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

/** 프로파일 (r, z) 을 Z축 둘레로 회전 */
function latheZ(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 1줄 웜 나사면 (축 = Z) */
function wormGeo(len: number, rRoot: number, rTip: number, pitch: number): THREE.BufferGeometry {
  const nx = Math.ceil((len / pitch) * 20);
  const na = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= nx; i++) {
    const z = -len / 2 + (i / nx) * len;
    for (let j = 0; j <= na; j++) {
      const th = (j / na) * Math.PI * 2;
      let f = z / pitch - th / (Math.PI * 2);
      f -= Math.floor(f);
      const d = Math.abs(f - 0.5) * 2;
      const k = d < 0.35 ? 1 : d > 0.75 ? 0 : 1 - (d - 0.35) / 0.4;
      const edge = Math.min(1, (len / 2 - Math.abs(z)) / (pitch * 0.6));
      const r = rRoot + (rTip - rRoot) * k * Math.max(0, edge);
      pos.push(Math.cos(th) * r, Math.sin(th) * r, z);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < na; j++) {
      const a = i * (na + 1) + j;
      const b = a + na + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 크랭크·고정 팔: 원점에서 +X로 len, 양끝 둥근 판(XZ 평면에 누움) */
function leverGeo(len: number, w0: number, w1: number, t: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.absarc(0, 0, w0, Math.PI / 2, (Math.PI * 3) / 2, false);
  s.absarc(len, 0, w1, -Math.PI / 2, Math.PI / 2, false);
  s.closePath();
  const g = extrude(s, t, 0.006, 24);
  g.rotateX(-Math.PI / 2);
  return g;
}

export class Fan extends BaseMachine {
  readonly id = 'fan';
  private head = new THREE.Group();
  private rotor = new THREE.Group(); // 모터 축 + 날개 (+ 장착 후 웜)
  private gearModel: THREE.Group | null = null;
  private linkModel: THREE.Group | null = null;
  private wheel: THREE.Object3D | null = null;
  private crank: THREE.Object3D | null = null;
  private rod: THREE.Object3D | null = null;
  private motorAngle = 0;
  private crankAngle = 0;
  private crankOffset = 0;
  private aLocal = A_WORLD.clone();
  private psi = 0;
  private lastT = -1;
  private simActive = false;

  private readonly shellMat = paint(0xeef1f4, { roughness: 0.32 });
  private readonly greyMat = plastic(0x8d97a3, { roughness: 0.5 });
  private readonly steelMat = steel();
  private readonly linkMat = paint(CATEGORY_COLORS.power, { roughness: 0.35, metalness: 0.3 });

  constructor() {
    super();
    this.head.position.copy(N);
    this.group.add(this.head);
    this.buildStand();
    this.buildHead();
    this.buildGuards();
    this.buildRotor();

    this.addSlot(0, WHEEL_PR + 0.09, at(C2, MOTOR_Y).add(N), 0.022);
    this.slots[0]!.rotation.x = Math.PI / 2;
    const mid = C2.clone().add(A_WORLD).multiplyScalar(0.5);
    this.addSlot(1, C2.distanceTo(A_WORLD) / 2 + 0.12, at(mid, Y_ROD).add(N), 0.022);
    this.slots[1]!.rotation.x = Math.PI / 2;
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
      s.receiveShadow = false;
    }
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.gearModel !== null : this.linkModel !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return N.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? at(C2, MOTOR_Y).add(N) : at(C2, Y_CRANK + 0.1).add(N);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildGears() : this.buildLinks();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      this.gearModel = model;
      const worm = model.getObjectByName('worm');
      if (worm) {
        // 웜은 모터 축에 끼워져 함께 돈다(축 좌표로 다시 배치)
        worm.position.set(0, 0, WHEEL_Z);
        this.rotor.add(worm);
      }
      this.wheel = model.getObjectByName('wheel') ?? null;
      this.head.add(model);
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.linkModel = model;
      this.head.add(model);
      this.crank = model.getObjectByName('crank') ?? null;
      this.rod = model.getObjectByName('rod') ?? null;
      // 머리가 가운데(ψ=0)를 볼 때의 크랭크 각으로 끼운다 → 장착 순간 머리가 튀지 않는다
      const p = circleHit(C2, CRANK_R, A_WORLD, ROD_L, C2.clone().add(new THREE.Vector2(0, CRANK_R)));
      this.crankOffset = Math.atan2(p.y - C2.y, p.x - C2.x) - this.crankAngle;
      this.aLocal.copy(A_WORLD);
      this.hideSlot(1);
      this.applyLinkage();
    }
  }

  reset(): void {
    const worm = this.rotor.getObjectByName('worm');
    if (worm) this.rotor.remove(worm);
    if (this.gearModel) this.head.remove(this.gearModel);
    if (this.linkModel) this.head.remove(this.linkModel);
    this.gearModel = this.linkModel = null;
    this.wheel = this.crank = this.rod = null;
    this.simActive = false;
    this.crankAngle = this.crankOffset = 0;
    this.psi = 0;
    this.head.rotation.y = 0;
    this.aLocal.copy(A_WORLD);
    this.lastT = -1;
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    const dt = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, t - this.lastT));
    this.lastT = t;
    // 시뮬레이션 전에도 모터는 돈다(날개만 돌고 목은 고정). 시뮬레이션 중에는 sim.update가 구동
    if (!this.simActive) this.drive(dt);
  }

  createSim(): MachineSim {
    if (!this.gearModel || !this.linkModel) throw new Error('fan mission incomplete');
    this.simActive = true;
    const display: MachineDisplayItem[] = [
      { label: '날개 회전수', value: String(MOTOR_RPM), unit: 'rpm', tone: 'blue' },
      { label: '목 왕복', value: String(CRANK_RPM), unit: '회/분', tone: 'red' },
      { label: '감속비 (웜 1줄 : 휠 36잇수)', value: `1/${WHEEL_TEETH}`, unit: '' }
    ];
    return {
      update: (dt: number) => this.drive(dt),
      getDisplay: () => {
        const deg = (this.psi * 180) / Math.PI;
        return [...display, { label: '목 각도', value: `${deg >= 0 ? '+' : ''}${deg.toFixed(0)}`, unit: '°' }];
      }
    };
  }

  // ── 구동 ──

  private drive(dt: number): void {
    this.motorAngle = (this.motorAngle + W_MOTOR * dt) % (Math.PI * 2);
    this.rotor.rotation.z = -this.motorAngle;
    if (!this.gearModel) return;
    // 웜 1바퀴 = 웜 휠 1잇수: 휠 각속도 = 모터 / 36
    this.crankAngle = (this.crankAngle + W_CRANK * dt) % (Math.PI * 2);
    if (this.wheel) this.wheel.rotation.y = -this.crankAngle;
    if (this.linkModel) this.applyLinkage();
  }

  /** 머리 좌표계 크랭크-로커: A_local = 원(N, G) ∩ 원(P, L) → ψ = ∠A_local − ∠A_world */
  private applyLinkage(): void {
    const phi = this.crankAngle + this.crankOffset;
    const p = new THREE.Vector2(C2.x + Math.cos(phi) * CRANK_R, C2.y + Math.sin(phi) * CRANK_R);
    const a = circleHit(new THREE.Vector2(0, 0), G, p, ROD_L, this.aLocal);
    this.aLocal.copy(a);
    let psi = Math.atan2(a.y, a.x) - MU;
    psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    this.psi = psi;
    this.head.rotation.y = psi;
    if (this.crank) this.crank.rotation.y = -phi;
    if (this.rod) {
      const from = at(p, Y_ROD);
      const to = at(a, Y_ROD);
      const d = to.clone().sub(from);
      this.rod.position.copy(from);
      this.rod.rotation.set(0, -Math.atan2(d.z, d.x), 0);
    }
  }

  // ── 미션 부품 ──

  /** ① 웜(모터 축 뒤끝) + 웜 휠(36잇수) + 출력축 */
  private buildGears(): THREE.Group {
    const g = new THREE.Group();
    const worm = new THREE.Group();
    worm.name = 'worm';
    worm.position.set(0, MOTOR_Y, WHEEL_Z);
    worm.add(new THREE.Mesh(wormGeo(0.3, WORM_PR - 0.022, WORM_PR + 0.016, WORM_PITCH), steel({ roughness: 0.25 })));
    const hubGeo = latheZ([[0, -0.19], [0.03, -0.19], [0.03, 0.19], [0, 0.19]], 24);
    worm.add(new THREE.Mesh(hubGeo, this.steelMat));
    g.add(worm);

    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    wheel.position.set(WHEEL_X, 0, WHEEL_Z);
    const shape = gearShape(WHEEL_TEETH, WHEEL_PR + 0.014, 0.03, 0.28);
    shape.holes.push(new THREE.Path().absarc(0, 0, 0.022, 0, Math.PI * 2, true));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      shape.holes.push(new THREE.Path().absarc(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0.035, 0, Math.PI * 2, true));
    }
    const wg = extrude(shape, 0.06, 0.006, 6);
    wg.rotateX(-Math.PI / 2);
    const wm = new THREE.Mesh(wg, bronze());
    wm.position.y = MOTOR_Y;
    wheel.add(wm);
    wheel.add(new THREE.Mesh(cylY(0.045, MOTOR_Y - 0.05, MOTOR_Y + 0.05, 32), bronze()));
    // 출력축: 기어함 아래로 내려와 크랭크 자리까지
    wheel.add(new THREE.Mesh(cylY(0.022, Y_CRANK - 0.02, MOTOR_Y + 0.07, 24), this.steelMat));
    // 회전이 보이는 표식(흰 점)
    const dot = new THREE.Mesh(cylY(0.018, MOTOR_Y + 0.03, MOTOR_Y + 0.036, 16), plastic(0xf4f6f8));
    dot.position.x = 0.15;
    wheel.add(dot);
    g.add(wheel);
    return g;
  }

  /** ② 크랭크(출력축 끝) + 연결 막대 — 고정 팔 끝 핀 A와 이어진다 */
  private buildLinks(): THREE.Group {
    const g = new THREE.Group();
    const crank = new THREE.Group();
    crank.name = 'crank';
    crank.position.set(C2.x, 0, C2.y);
    const arm = new THREE.Mesh(leverGeo(CRANK_R, 0.06, 0.04, 0.035), this.linkMat);
    arm.position.y = Y_CRANK;
    crank.add(arm);
    crank.add(new THREE.Mesh(cylY(0.045, Y_CRANK - 0.02, Y_CRANK + 0.03, 28), this.steelMat));
    const pin = new THREE.Mesh(cylY(0.018, Y_ROD - 0.025, Y_CRANK + 0.02, 16), this.steelMat);
    pin.position.x = CRANK_R;
    crank.add(pin);
    g.add(crank);

    // 연결 막대: 원점 = 크랭크 핀, +X 방향으로 ROD_L (양끝 눈 구멍)
    const rod = new THREE.Group();
    rod.name = 'rod';
    const bar = new THREE.Mesh(leverGeo(ROD_L, 0.04, 0.04, 0.028), this.linkMat);
    bar.position.y = Y_ROD;
    rod.add(bar);
    for (const x of [0, ROD_L]) {
      const eye = new THREE.Mesh(cylY(0.026, Y_ROD - 0.018, Y_ROD + 0.018, 20), darkSteel());
      eye.position.x = x;
      rod.add(eye);
    }
    g.add(rod);
    return g;
  }

  // ── 고정 구조 ──

  private buildStand(): void {
    const grp = this.group;
    // 받침: 둥근 모서리 원판 + 고무 테
    const base = new THREE.Mesh(
      lathe([[0, 0.012], [BASE_R - 0.06, 0.012], [BASE_R - 0.01, 0.03], [BASE_R, 0.07], [BASE_R - 0.03, BASE_H - 0.01], [BASE_R - 0.12, BASE_H + 0.02], [0.2, BASE_H + 0.05], [0, BASE_H + 0.05]], 72),
      this.shellMat
    );
    grp.add(base);
    const foot = new THREE.Mesh(lathe([[BASE_R - 0.1, 0], [BASE_R - 0.04, 0], [BASE_R - 0.04, 0.014], [BASE_R - 0.1, 0.014]], 72), rubber());
    grp.add(foot);
    // 앞쪽 조작 버튼 4개 (끔·약·중·강)
    const btnGeo = new RoundedBoxGeometry(0.13, 0.05, 0.1, 2, 0.015);
    const btnColors = [0xd8362f, 0x8d97a3, 0x8d97a3, 0x8d97a3];
    btnColors.forEach((c, i) => {
      const b = new THREE.Mesh(btnGeo, plastic(c, { roughness: 0.4 }));
      const ang = ((i - 1.5) * 0.2);
      b.position.set(Math.sin(ang) * 0.5, BASE_H + 0.02 - 0.012, Math.cos(ang) * 0.5);
      b.rotation.set(-0.18, ang, 0);
      grp.add(b);
    });
    // 기둥: 아래 관 + 높이 조절 링 + 위 관
    grp.add(new THREE.Mesh(cylY(POLE_R + 0.025, BASE_H + 0.04, 0.95, 40), this.shellMat));
    grp.add(new THREE.Mesh(lathe([[POLE_R, 0.92], [POLE_R + 0.06, 0.93], [POLE_R + 0.065, 0.97], [POLE_R + 0.06, 1.02], [POLE_R, 1.03]], 48), this.greyMat));
    grp.add(new THREE.Mesh(cylY(POLE_R, 1.0, NECK_Y - 0.1, 32), aluminum({ color: 0xd6dbe0 })));
    // 목 고정 칼라 (머리 보스가 이 위에서 돈다)
    grp.add(new THREE.Mesh(lathe([[0, NECK_Y - 0.14], [0.08, NECK_Y - 0.14], [0.1, NECK_Y - 0.12], [0.1, NECK_Y - 0.01], [0.09, NECK_Y], [0, NECK_Y]], 48), this.greyMat));
    // 고정 팔(4절 링크의 고정 링크 N→A) + 핀 A
    const armGrp = new THREE.Group();
    armGrp.position.copy(N);
    const armLen = A_WORLD.length();
    const fixedArm = new THREE.Mesh(leverGeo(armLen, 0.07, 0.04, 0.04), darkSteel({ roughness: 0.45 }));
    fixedArm.position.y = Y_ARM;
    fixedArm.rotation.y = -Math.atan2(A_WORLD.y, A_WORLD.x);
    armGrp.add(fixedArm);
    const pinA = new THREE.Mesh(cylY(0.018, Y_ARM - 0.02, Y_ROD + 0.03, 16), this.steelMat);
    pinA.position.copy(at(A_WORLD, 0));
    const capA = new THREE.Mesh(cylY(0.028, Y_ROD + 0.02, Y_ROD + 0.035, 16), this.steelMat);
    capA.position.copy(pinA.position);
    armGrp.add(pinA, capA);
    grp.add(armGrp);
    // 전선: 기둥 밑동에서 나와 받침 윗면을 타고(단면 높이 + 선 반지름) 가장자리를 넘어 바닥으로
    const CABLE_R = 0.018;
    const dir = new THREE.Vector2(-0.33, -0.944).normalize();
    const along: [number, number][] = [
      [0.0, 0.3], [0.1, 0.27], [0.16, BASE_H + 0.05 + CABLE_R], [0.3, BASE_H + 0.048 + CABLE_R], [0.5, BASE_H + 0.035 + CABLE_R],
      [BASE_R - 0.12, BASE_H + 0.02 + CABLE_R], [BASE_R - 0.04, BASE_H - 0.005 + CABLE_R], [BASE_R + 0.01, 0.075 + CABLE_R],
      [BASE_R + 0.05, 0.035], [BASE_R + 0.12, CABLE_R], [1.1, CABLE_R], [1.45, CABLE_R]
    ];
    const cable = new THREE.CatmullRomCurve3(along.map(([r, y]) => new THREE.Vector3(dir.x * r, y, dir.y * r)), false, 'centripetal');
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 80, CABLE_R, 10, false), plastic(0x2b2e33)));
  }

  private buildHead(): void {
    const h = this.head;
    // 회전 보스 + 받침 기둥 + 모터 안장
    h.add(new THREE.Mesh(lathe([[0.04, 0.0], [0.095, 0.0], [0.1, 0.02], [0.1, 0.13], [0.085, 0.15], [0.04, 0.15]], 48), this.shellMat));
    h.add(new THREE.Mesh(cylY(0.055, 0.14, MOTOR_Y - MOTOR_R + 0.04, 32), this.shellMat));
    const saddle = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.08, 0.32, 3, 0.03), this.shellMat);
    saddle.position.set(0, MOTOR_Y - MOTOR_R + 0.01, 0);
    h.add(saddle);
    const knob = new THREE.Mesh(latheZ([[0, -0.03], [0.05, -0.03], [0.06, -0.015], [0.06, 0.02], [0, 0.03]], 32), this.greyMat);
    knob.rotation.y = Math.PI / 2;
    knob.position.set(0.14, MOTOR_Y - MOTOR_R + 0.01, 0);
    h.add(knob);

    // 모터 몸통(축 = Z): 몸통 + 냉각 홈 + 앞 베어링 덮개
    const motorProfile: V2[] = [
      [0, MOTOR_Z0],
      [MOTOR_R - 0.05, MOTOR_Z0],
      [MOTOR_R, MOTOR_Z0 + 0.05],
      [MOTOR_R, MOTOR_Z1 - 0.03],
      [MOTOR_R - 0.03, MOTOR_Z1],
      [0.13, MOTOR_Z1 + 0.02],
      [0.1, MOTOR_Z1 + 0.06],
      [0, MOTOR_Z1 + 0.06]
    ];
    const motor = new THREE.Mesh(latheZ(motorProfile, 64), this.shellMat);
    motor.position.y = MOTOR_Y;
    h.add(motor);
    for (const z of [-0.08, -0.02, 0.04, 0.1]) {
      const vent = new THREE.Mesh(new THREE.TorusGeometry(MOTOR_R + 0.002, 0.008, 8, 64), this.greyMat);
      vent.position.set(0, MOTOR_Y, z);
      h.add(vent);
    }
    // 뒤 덮개(반투명): 모터 뒤쪽 + 기어함 — 안의 웜·웜 휠이 보인다
    const gearBoxW = WHEEL_X + WHEEL_PR + 0.1 + 0.16;
    const box = new THREE.Mesh(new RoundedBoxGeometry(gearBoxW, 0.24, 0.56, 4, 0.08), ghost(0x9fb4c8, 0.3));
    box.position.set(-0.16 + gearBoxW / 2, MOTOR_Y, WHEEL_Z + 0.02);
    box.userData.noAO = true;
    h.add(box);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 8, 48), this.greyMat);
    rim.position.set(0, MOTOR_Y, MOTOR_Z0 - 0.01);
    h.add(rim);
    // 모터 뒤 권선(구리)이 보이는 뒤 판과 축 베어링
    const coil = new THREE.Mesh(latheZ([[0.05, MOTOR_Z0 - 0.06], [0.15, MOTOR_Z0 - 0.06], [0.15, MOTOR_Z0], [0.05, MOTOR_Z0]], 40), copper());
    coil.position.y = MOTOR_Y;
    h.add(coil);
    const brg = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.2, 0.05, 2, 0.015), darkSteel());
    brg.position.set(0, MOTOR_Y - 0.03, WHEEL_Z - 0.2);
    h.add(brg);
    // 출력축 부싱(기어함 바닥)
    const bush = new THREE.Mesh(cylY(0.04, MOTOR_Y - 0.14, MOTOR_Y - 0.1, 28), darkSteel());
    bush.position.set(WHEEL_X, 0, WHEEL_Z);
    h.add(bush);
    // 기어함 받침: 모터 안장에서 뒤로
    const strut = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.05, 0.42, 2, 0.015), this.shellMat);
    strut.position.set(0, MOTOR_Y - MOTOR_R + 0.02, -0.33);
    h.add(strut);
  }

  private buildGuards(): void {
    const h = this.head;
    const wireMat = chrome({ color: 0xdfe4ea });
    const geos: THREE.BufferGeometry[] = [];
    const frontZ = (r: number): number => BLADE_Z + 0.04 + 0.26 * (1 - (r / GUARD_R) ** 2);
    const rearZ = (r: number): number => MOTOR_Z1 + 0.06 + 0.16 * Math.min(1, (r - 0.15) / (GUARD_R - 0.15));
    const SPOKES = 40;
    for (let i = 0; i < SPOKES; i++) {
      const a = (i / SPOKES) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const fp: THREE.Vector3[] = [];
      const rp: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) {
        const r = 0.11 + (GUARD_R - 0.11) * (k / 10);
        fp.push(new THREE.Vector3(c * r, MOTOR_Y + s * r, frontZ(r)));
        const r2 = 0.15 + (GUARD_R - 0.15) * (k / 10);
        rp.push(new THREE.Vector3(c * r2, MOTOR_Y + s * r2, rearZ(r2)));
      }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fp), 14, 0.0065, 5, false));
      if (i % 2 === 0) geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), 10, 0.0065, 5, false));
    }
    for (const r of [0.3, 0.48, 0.64]) {
      const t = new THREE.TorusGeometry(r, 0.007, 6, 96);
      t.translate(0, MOTOR_Y, frontZ(r));
      geos.push(t);
    }
    for (const r of [0.42, 0.62]) {
      const t = new THREE.TorusGeometry(r, 0.007, 6, 96);
      t.translate(0, MOTOR_Y, rearZ(r));
      geos.push(t);
    }
    h.add(new THREE.Mesh(merge(geos), wireMat));
    // 테두리 링(앞·뒤 망을 잇는 클립 링) + 뒷망 중앙 고정 링 + 앞 배지
    const rimGeo = new THREE.TorusGeometry(GUARD_R, 0.02, 12, 120);
    const rim = new THREE.Mesh(rimGeo, this.shellMat);
    rim.position.set(0, MOTOR_Y, (frontZ(GUARD_R) + rearZ(GUARD_R)) / 2);
    rim.scale.z = 1.6;
    h.add(rim);
    const rearRing = new THREE.Mesh(latheZ([[0.13, MOTOR_Z1 + 0.04], [0.17, MOTOR_Z1 + 0.04], [0.17, MOTOR_Z1 + 0.08], [0.13, MOTOR_Z1 + 0.08]], 48), this.greyMat);
    rearRing.position.y = MOTOR_Y;
    h.add(rearRing);
    const badge = new THREE.Mesh(latheZ([[0, frontZ(0.11) - 0.01], [0.12, frontZ(0.11) - 0.01], [0.12, frontZ(0.11) + 0.01], [0.09, frontZ(0.11) + 0.025], [0, frontZ(0.11) + 0.03]], 48), plastic(0x2468c9, { roughness: 0.35 }));
    badge.position.y = MOTOR_Y;
    h.add(badge);
  }

  /** 모터 축(앞뒤로 관통) + 날개 3장 + 스피너 — 회전체 */
  private buildRotor(): void {
    const r = this.rotor;
    r.position.set(0, MOTOR_Y, 0);
    this.head.add(r);
    r.add(new THREE.Mesh(latheZ([[0, WHEEL_Z - 0.22], [0.018, WHEEL_Z - 0.22], [0.018, BLADE_Z], [0, BLADE_Z]], 20), this.steelMat));
    // 날개: 꽃잎 모양 판을 반지름 축 둘레로 비틀어 붙인다
    const s = new THREE.Shape();
    s.moveTo(0.07, -0.06);
    s.bezierCurveTo(0.25, -0.2, 0.55, -0.24, BLADE_R, -0.06);
    s.bezierCurveTo(BLADE_R + 0.04, 0.06, 0.5, 0.2, 0.3, 0.16);
    s.bezierCurveTo(0.18, 0.13, 0.1, 0.08, 0.07, 0.05);
    s.closePath();
    const bladeGeo = extrude(s, 0.016, 0.006, 32, 2);
    bladeGeo.rotateX(0.38);
    const bladeMat = plastic(0x5aa9e6, { roughness: 0.3 });
    bladeMat.transparent = true;
    bladeMat.opacity = 0.9;
    for (let i = 0; i < BLADES; i++) {
      const b = new THREE.Mesh(bladeGeo, bladeMat);
      b.rotation.z = (i / BLADES) * Math.PI * 2;
      b.position.z = BLADE_Z;
      r.add(b);
    }
    const spinner = new THREE.Mesh(latheZ([[0, BLADE_Z - 0.06], [0.1, BLADE_Z - 0.06], [0.11, BLADE_Z - 0.02], [0.1, BLADE_Z + 0.03], [0.06, BLADE_Z + 0.07], [0, BLADE_Z + 0.08]], 48), plastic(0x2468c9, { roughness: 0.35 }));
    r.add(spinner);
    // 회전 확인용 흰 줄
    const mark = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.02, 0.01, 1, 0.004), plastic(0xf4f6f8));
    mark.position.set(0.05, 0, BLADE_Z + 0.075);
    r.add(mark);
  }
}
