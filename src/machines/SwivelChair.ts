// 회전의자: 볼 베어링 + 스프링 미션 — 사무용 5발 의자(좌판·등받이·팔걸이)와 기둥 속 구조를 투명하게 보여 준다.
// ① 좌판 아래 스러스트(회전) 베어링: 아래 궤도륜(피스톤 쪽, 고정) + 볼 + 위 궤도륜(좌판 쪽, 회전).
//    궤도륜 하나가 고정이므로 볼 케이지의 공전은 좌판 회전의 약 1/2.
// ② 기둥(투명 슬리브) 속 스프링: 바닥(허브) ↔ 피스톤 플랜지 사이 압축 스프링. 스프링이 없으면 좌판이 아래로 주저앉아 있다.
// 피스톤 높이 오프셋 dy = L − L_FREE (L = 스프링 길이). 좌판·피스톤이 함께 오르내린다.
// 좌표: 바닥 y=0, 의자 앞 = +Z, 단위 1 ≈ 0.35 m.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, bronze, chrome, darkSteel, ghost, paint, plastic, rubber, steel } from '../models/materials';
import { lathe, TAU, type V2 } from '../models/parts/geom';

const M_PER_UNIT = 0.35;

// ── 받침·기둥 ──
const LEG_R = 1.6;
const LEG_N = 5;
const HUB_TOP = 0.66; // 허브 윗면 = 슬리브 바닥(스프링 아래 끝)
const SLEEVE_TOP = 1.72;
const SLEEVE_R = 0.36;
const CAP_Y0 = 1.64;
const ROD_R = 0.1;
const FLANGE_R = 0.3;
const FLANGE_T = 0.08;
const L_FREE = 0.8; // 스프링 자유 길이(= 좌판이 하중 없이 있는 높이)
const L_MIN = 0.5; // 스프링이 없을 때 플랜지가 얹히는 고무 멈춤의 높이
const SIT = 0.2; // 앉았을 때 줄어드는 길이
const SPRING_R = 0.22;
const SPRING_COILS = 9;

// ── 좌판 아래 (공칭 높이 기준, 피스톤 오프셋 dy 를 더하면 실제 높이) ──
const PLATE_Y = 2.05; // 아래 궤도륜 받침판 아랫면
const PLATE_T = 0.05;
const CAV_Y0 = PLATE_Y + PLATE_T; // 베어링 방 아랫면
const CAV_H = 0.22;
const BEAR_Y = CAV_Y0 + CAV_H / 2;
const SEAT_PLATE_Y = CAV_Y0 + CAV_H; // 좌판 아래 판 아랫면
const SEAT_Y0 = SEAT_PLATE_Y + 0.06; // 쿠션 아랫면
const SEAT_H = 0.32;
const HOUSING_RI = 0.5;
const HOUSING_RO = 0.62;

const PERIOD = 8;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

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

function cylY(r: number, y0: number, y1: number, seg = 32): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 20): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** 단위 길이(y) 압축 스프링 — mesh.scale.y 로 길이를 맞춘다 */
function springGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = SPRING_COILS * 28;
  const endK = 0.5 / SPRING_COILS;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * SPRING_COILS * TAU;
    const yc = u < endK ? (u / endK) * 0.03 : u > 1 - endK ? 1 - ((1 - u) / endK) * 0.03 : 0.03 + ((u - endK) / (1 - 2 * endK)) * 0.94;
    pts.push(new THREE.Vector3(Math.cos(a) * SPRING_R, yc - 0.5, Math.sin(a) * SPRING_R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.036, 10, false);
}

export class SwivelChair extends BaseMachine {
  readonly id = 'swivelchair';
  /** 피스톤(로드·플랜지·받침판): 위아래로만 움직인다 */
  private readonly piston = new THREE.Group();
  /** 좌판(하우징·좌판·등받이·팔걸이): 피스톤과 함께 오르내리고 요(yaw) 회전한다 */
  private readonly seat = new THREE.Group();
  private bearingModel: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private upperRace: THREE.Object3D | null = null;
  private balls: THREE.Object3D | null = null;
  private L = L_MIN;
  private rise: { k: number; last: number } | null = null;

  constructor() {
    super();
    this.group.add(this.piston, this.seat);
    this.buildBase();
    this.buildColumn();
    this.buildPiston();
    this.buildSeat();
    this.addSlot(0, 0.68, new THREE.Vector3(0, BEAR_Y + (L_MIN - L_FREE), 0), 0.02);
    this.slots[0]!.rotation.x = Math.PI / 2;
    this.addSlot(1, 0.5, new THREE.Vector3(0, 1.15, 0), 0.02);
    this.slots[1]!.rotation.x = Math.PI / 2;
    this.hideSlot(1);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
    }
    this.apply(L_MIN, 0, 0);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.bearingModel !== null : this.springModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, BEAR_Y + (this.L - L_FREE), 0) : new THREE.Vector3(0, 1.15, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0.5, BEAR_Y + (this.L - L_FREE) + 0.1, 0.6) : new THREE.Vector3(0.5, 1.15, 0.5);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildBearing() : this.buildSpring();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    if (step === 0) {
      model.position.set(0, BEAR_Y, 0);
      this.piston.add(model);
      this.bearingModel = model;
      this.upperRace = model.getObjectByName('upper') ?? null;
      this.balls = model.getObjectByName('balls') ?? null;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.group.add(model);
      this.springModel = model;
      this.hideSlot(1);
      // 스프링이 들어가면 주저앉았던 좌판이 올라온다
      this.rise = { k: 0, last: -1 };
    }
    this.apply(this.L, 0, 0);
  }

  reset(): void {
    if (this.bearingModel) this.piston.remove(this.bearingModel);
    if (this.springModel) this.group.remove(this.springModel);
    this.bearingModel = this.springModel = this.upperRace = this.balls = null;
    this.rise = null;
    this.L = L_MIN;
    this.showSlot(0);
    this.hideSlot(1);
    this.apply(L_MIN, 0, 0);
  }

  update(t: number): void {
    super.update(t);
    if (this.rise) {
      const dt = this.rise.last < 0 ? 0 : Math.min(0.05, t - this.rise.last);
      this.rise.last = t;
      this.rise.k += dt / 1.2;
      const k = Math.min(1, this.rise.k);
      this.apply(L_MIN + (L_FREE - L_MIN) * smooth(k), 0, 0);
      if (k >= 1) this.rise = null;
    }
  }

  createSim(): MachineSim {
    if (!this.bearingModel || !this.springModel) throw new Error('swivelchair mission incomplete');
    this.rise = null;
    let time = 0;
    let yaw = 0;
    let L = L_FREE;
    let sit = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const tc = time % PERIOD;
        yaw = 0.8 * Math.sin((TAU * time) / PERIOD);
        // 앉기(1.2s) → 일어서기(4.6s). 앉을 때 스프링이 살짝 출렁인다
        sit = smooth((tc - 1.2) / 0.35) - smooth((tc - 4.6) / 0.5);
        const b1 = tc > 1.2 && tc < 3 ? 0.025 * Math.sin(18 * (tc - 1.2)) * Math.exp(-4 * (tc - 1.2)) : 0;
        const b2 = tc > 4.6 && tc < 6.4 ? -0.02 * Math.sin(18 * (tc - 4.6)) * Math.exp(-4 * (tc - 4.6)) : 0;
        L = L_FREE - SIT * sit + b1 + b2;
        this.L = L;
        this.apply(L, yaw, time);
      },
      getDisplay: () => [
        { label: '회전 각도', value: ((yaw * 180) / Math.PI).toFixed(0), unit: '°', tone: 'blue' },
        { label: '스프링 변형', value: (Math.max(0, L_FREE - L) * M_PER_UNIT * 1000).toFixed(0), unit: 'mm', tone: 'red' },
        { label: '상태', value: sit > 0.5 ? '앉는 중 (스프링 압축)' : '일어남 (스프링 복원)' }
      ]
    };
  }

  /** 스프링 길이 L, 좌판 요 각 → 피스톤·좌판·베어링·스프링 배치 */
  private apply(L: number, yaw: number, _time: number): void {
    void _time;
    this.L = L;
    const dy = L - L_FREE;
    this.piston.position.y = dy;
    this.seat.position.y = dy;
    this.seat.rotation.y = yaw;
    if (this.upperRace) this.upperRace.rotation.y = yaw;
    // 아래 궤도륜은 고정, 볼 케이지는 좌판 회전의 약 1/2
    if (this.balls) this.balls.rotation.y = 0.5 * yaw;
    if (this.springModel) {
      this.springModel.scale.set(1, L, 1);
      this.springModel.position.set(0, HUB_TOP + L / 2, 0);
    }
    if (!this.bearingModel && this.slots[0]) this.slots[0].position.y = BEAR_Y + dy;
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 스러스트 볼 베어링: 원점 = 베어링 방 중심. 'upper'(좌판과 함께 회전) / 'balls'(케이지) / 아래 궤도륜(고정) */
  private buildBearing(): THREE.Group {
    const g = new THREE.Group();
    const race = steel({ roughness: 0.22 });
    const accent = paint(CATEGORY_COLORS.shaft, { roughness: 0.35, metalness: 0.4 });
    const ring = (y0: number, y1: number): V2[] => [[0.3, y0], [0.5, y0], [0.5, y1], [0.3, y1], [0.3, y0]];
    add(g, lathe(ring(-0.11, -0.06), 64), race);
    add(g, new THREE.TorusGeometry(0.5, 0.012, 8, 64).rotateX(Math.PI / 2), accent, 0, -0.085, 0);
    const upper = new THREE.Group();
    upper.name = 'upper';
    add(upper, lathe(ring(0.06, 0.11), 64), race);
    add(upper, new THREE.TorusGeometry(0.5, 0.012, 8, 64).rotateX(Math.PI / 2), accent, 0, 0.085, 0);
    g.add(upper);
    const balls = new THREE.Group();
    balls.name = 'balls';
    const ballGeo = new THREE.SphereGeometry(0.06, 20, 14);
    const bm = chrome();
    const N = 10;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      add(balls, ballGeo, bm, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
    }
    add(balls, lathe([[0.34, -0.012], [0.46, -0.012], [0.46, 0.012], [0.34, 0.012], [0.34, -0.012]], 48), bronze({ roughness: 0.35 }));
    g.add(balls);
    return g;
  }

  /** 압축 스프링: 원점 = 스프링 중심, 단위 길이(y) — scale.y 로 길이를 맞춘다 */
  private buildSpring(): THREE.Group {
    const g = new THREE.Group();
    add(g, springGeo(), paint(CATEGORY_COLORS.control, { roughness: 0.3, metalness: 0.5 }));
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildBase(): void {
    const g = this.group;
    const leg = aluminum({ roughness: 0.4 });
    const dark = darkSteel();
    add(g, lathe([[0, 0.38], [0.3, 0.38], [0.42, 0.5], [0.42, 0.6], [0.37, HUB_TOP], [0, HUB_TOP]], 48), dark);
    for (let i = 0; i < LEG_N; i++) {
      const a = (i / LEG_N) * TAU + Math.PI / 2 / LEG_N;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      add(g, cylBetween(new THREE.Vector3(dx * 0.3, 0.55, dz * 0.3), new THREE.Vector3(dx * LEG_R, 0.36, dz * LEG_R), 0.075, 20), leg);
      add(g, new THREE.SphereGeometry(0.075, 20, 12), leg, dx * LEG_R, 0.36, dz * LEG_R);
      // 바퀴(캐스터): 줄기 + 포크 + 바퀴(축은 접선 방향)
      const c = new THREE.Group();
      c.position.set(dx * LEG_R, 0, dz * LEG_R);
      c.rotation.y = -a;
      add(c, cylY(0.04, 0.28, 0.42, 16), dark);
      for (const s of [-1, 1]) add(c, new RoundedBoxGeometry(0.2, 0.2, 0.025, 2, 0.01), dark, 0, 0.2, s * 0.065);
      add(c, new THREE.CylinderGeometry(0.14, 0.14, 0.08, 28).rotateX(Math.PI / 2), rubber(), 0, 0.14, 0);
      add(c, new THREE.CylinderGeometry(0.075, 0.075, 0.1, 20).rotateX(Math.PI / 2), plastic(0xd9dde2), 0, 0.14, 0);
      g.add(c);
    }
  }

  /** 기둥: 투명 슬리브 + 윗덮개 + 아래 고무 멈춤. 스프링은 미션 부품 */
  private buildColumn(): void {
    const g = this.group;
    const sl = add(g, lathe([[0.34, HUB_TOP], [SLEEVE_R, HUB_TOP], [SLEEVE_R, CAP_Y0], [0.34, CAP_Y0], [0.34, HUB_TOP]], 48), ghost(0xb4c6d8, 0.3));
    sl.castShadow = false;
    add(g, lathe([[ROD_R + 0.012, CAP_Y0], [0.4, CAP_Y0], [0.4, SLEEVE_TOP - 0.03], [0.37, SLEEVE_TOP], [ROD_R + 0.012, SLEEVE_TOP], [ROD_R + 0.012, CAP_Y0]], 48), darkSteel());
    add(g, cylY(0.15, HUB_TOP, HUB_TOP + L_MIN, 24), rubber({ color: 0x3a3d42 }));
  }

  private buildPiston(): void {
    const p = this.piston;
    const fl = HUB_TOP + L_FREE; // 공칭 플랜지 아랫면
    add(p, cylY(ROD_R, fl, PLATE_Y + 0.02, 24), chrome());
    add(p, lathe([[0, fl], [FLANGE_R - 0.02, fl], [FLANGE_R, fl + 0.02], [FLANGE_R, fl + FLANGE_T], [0, fl + FLANGE_T]], 40), steel());
    // 아래 궤도륜 받침판(피스톤 위)
    add(p, lathe([[0, PLATE_Y], [0.55, PLATE_Y], [0.58, PLATE_Y + 0.02], [0.58, PLATE_Y + PLATE_T], [0, PLATE_Y + PLATE_T]], 48), darkSteel());
  }

  private buildSeat(): void {
    const s = this.seat;
    const fabric = plastic(0x34415f, { roughness: 0.9 });
    const trim = darkSteel();
    // 베어링 방을 둘러싼 투명 하우징(받침판 위에 얹혀 좌판을 받친다)
    const h = add(s, lathe([[HOUSING_RI, CAV_Y0], [HOUSING_RO, CAV_Y0], [HOUSING_RO, SEAT_PLATE_Y], [HOUSING_RI, SEAT_PLATE_Y], [HOUSING_RI, CAV_Y0]], 56), ghost(0xb7c9dc, 0.32));
    h.castShadow = false;
    // 좌판 아래 판 + 쿠션
    add(s, lathe([[0, SEAT_PLATE_Y], [0.72, SEAT_PLATE_Y], [0.72, SEAT_PLATE_Y + 0.06], [0, SEAT_PLATE_Y + 0.06]], 48), trim);
    add(s, new RoundedBoxGeometry(2.0, SEAT_H, 1.9, 5, 0.12), fabric, 0, SEAT_Y0 + SEAT_H / 2, 0.1);
    // 등받이: 좌판 밑에서 뒤로 나온 막대 → 위로 선 줄기 → 등판
    add(s, new RoundedBoxGeometry(0.22, 0.08, 0.7, 2, 0.02), trim, 0, SEAT_PLATE_Y + 0.02, -0.7);
    add(s, new RoundedBoxGeometry(0.22, 1.0, 0.08, 2, 0.02), trim, 0, SEAT_PLATE_Y + 0.5, -1.0);
    const back = add(s, new RoundedBoxGeometry(1.8, 1.4, 0.2, 5, 0.1), fabric, 0, SEAT_Y0 + 1.5, -1.05);
    back.rotation.x = -0.1;
    // 팔걸이
    for (const sx of [-1, 1]) {
      add(s, new RoundedBoxGeometry(0.07, 0.16, 0.5, 2, 0.02), trim, sx * 1.04, SEAT_Y0 + 0.05, -0.05);
      add(s, cylY(0.045, SEAT_Y0 + 0.05, SEAT_Y0 + 0.78, 20), trim, sx * 1.07, 0, -0.05);
      add(s, new RoundedBoxGeometry(0.26, 0.09, 1.05, 3, 0.04), plastic(0x16181c, { roughness: 0.6 }), sx * 1.07, SEAT_Y0 + 0.82, 0.1);
    }
  }
}
