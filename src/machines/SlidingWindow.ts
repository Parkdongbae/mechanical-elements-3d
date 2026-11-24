// 미닫이 창문: 호차(창 바퀴)의 차축과 볼 베어링 미션.
// 처음엔 차축이 없어 앞 창짝이 레일에서 0.12 들뜬 채 15° 기울어져 있다. 차축을 끼우면 호차가 레일에 앉는다.
// 완료: 창짝이 닫힘↔열림(주기 6초, 코사인) 왕복 — 호차는 미끄럼 없이 굴러가고(θ = -x/R),
// 베어링 케이지는 바퀴 각속도의 0.4배로 공전한다. 창 아래 확대 모형(5배)에서 장착·회전을 크게 보여 준다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, brass, chrome, darkSteel, glass, ghost, paint, plastic, steel } from '../models/materials';
import { lathe, merge, type V2 } from '../models/parts/geom';

// ── 설계표 고정 치수(단위 1 ≈ 0.35 m) ──
// 벽 조각 3.6 × 2.6 × 0.24, 창 구멍 폭 2.6 · 아래턱 y 0.7 · 높이 1.6
const WALL_W = 3.6;
const WALL_H = 2.6;
const WALL_T = 0.24;
const HOLE_W = 2.6;
const HOLE_BOT = 0.7;
const HOLE_TOP = 2.3; // HOLE_BOT + 1.6
// 창틀 각재 단면 0.08, 아래 레일 2줄(z = ±0.05)
const FRAME_S = 0.08;
const FRAME_D = 0.28;
const STRIP_H = 0.03;
const RAIL_Z = 0.05;
const RAIL_TOP = HOLE_BOT + STRIP_H; // 얇은 레일 상판 0.73
// 창짝 1.32 × 1.52 × 0.04, 테두리 두께 0.06
const SASH_W = 1.32;
const SASH_H = 1.52;
const SASH_T = 0.04;
const BAR_T = 0.06;
const SASH_Z_BACK = -0.05;
const SASH_Z_FRONT = 0.05;
const BACK_SASH_X = -0.65;
const SASH_X_CLOSED = 0.65;
const SASH_X_OPEN = -0.55; // 이동 거리 1.2
// 호차: 창짝 로컬 x ±0.45 · y -0.74, 바퀴 반지름 0.06 · 폭 0.03(가운데 V홈)
const WHEEL_R = 0.06;
const WHEEL_HALF = 0.015;
const ROLLER_X = 0.45;
const ROLLER_DY = -0.74;
const WHEEL_Y = RAIL_TOP + WHEEL_R; // 설치 후 호차 중심 y 0.79
const SASH_Y = WHEEL_Y - ROLLER_DY; // 앞 창짝 중심 y 1.53
// ① 차축: 호차 중심의 Z축 방향 핀(반지름 0.012 · 길이 0.07)
const AXLE_R = 0.012;
const AXLE_HALF = 0.035;
// ② 볼 베어링: 외륜 = 바퀴 안쪽, 내륜 = 축 쪽, 볼 8개
const BR_BALLS = 8;
const BR_MID = 0.021;
const BR_BALL_R = 0.0055;
// 확대 모형: 5배, 창 아래 벽 앞 (0, 0.38, 0.9)
const MAG = 5;
const MAG_POS = new THREE.Vector3(0, 0.38, 0.9);
const MAG_AXLE_R = AXLE_R * MAG;
const MAG_AXLE_HALF = 0.175; // 길이 0.35
const MAG_BR_IN = 0.09;
const MAG_BR_OUT = 0.135;
const MAG_BR_MID = 0.1125;
const MAG_BR_BALL = 0.032;
// 설치 전 창짝 상태: 0.12 들뜸 + 15° 기울어짐
const PRE_LIFT = 0.12;
const PRE_TILT = 15 * (Math.PI / 180);
const SETTLE_S = 1.4;
// 동작: 주기 6초, 케이지 공전 = 바퀴 각속도 × 0.4
const PERIOD = 6;
const CAGE_RATIO = 0.4;
const M_PER_UNIT = 0.35;

// 호차 바퀴 단면(가운데 V홈) — (r, y), y는 축방향. 보어 0.032 = 베어링 외륜 접촉면
const WHEEL_PROFILE: V2[] = [
  [0.032, -WHEEL_HALF], [0.048, -WHEEL_HALF], [0.06, -0.009], [0.05, 0],
  [0.06, 0.009], [0.048, WHEEL_HALF], [0.032, WHEEL_HALF], [0.032, -WHEEL_HALF]
];

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** Y축 레이트를 Z축으로 눕힌다(바퀴·디스크용) */
function latheZ(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 방향 원기둥 */
function cylZ(r: number, len: number, seg: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

function box(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
}

/** 볼 n개를 반지름 orbit 원 위에 배치해 하나로 합친다(케이지) */
function mergeBalls(orbit: number, r: number, n: number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = new THREE.SphereGeometry(r, 16, 12);
    g.translate(Math.cos(a) * orbit, Math.sin(a) * orbit, 0);
    geos.push(g);
  }
  return merge(geos);
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

export class SlidingWindow extends BaseMachine {
  readonly id = 'window';

  private sash = new THREE.Group(); // 앞 창짝(움직임)
  private rollers: THREE.Group[] = []; // 호차 바퀴(회전)
  private realAxles: THREE.Group[] = []; // 실물 차축(설치 전 숨김)
  private realBearings: THREE.Group[] = []; // 실물 베어링(설치 전 숨김)
  private mag = new THREE.Group(); // 확대 모형 받침(원점 = MAG_POS)
  private magWheel: THREE.Group | null = null; // 확대 바퀴
  private magCage: THREE.Group | null = null; // 확대 베어링 케이지
  private axleModel: THREE.Group | null = null;
  private bearingModel: THREE.Group | null = null;
  private settle: { k: number; last: number } | null = null;

  private readonly aluMat = aluminum();
  private readonly steelMat = steel();
  private readonly darkMat = darkSteel();

  constructor() {
    super();
    this.buildWall();
    this.buildFrame();
    this.buildBackSash();
    this.buildFrontSash();
    this.buildMagStand();
    this.group.add(this.sash, this.mag);
    this.placeSashWaiting();

    // 슬롯은 확대 모형 쪽에 크게: ① 차축(Z축 방향) ② 베어링(+Z 0.1 앞)
    this.addSlot(0, 0.22, MAG_POS.clone().add(new THREE.Vector3(0, 0, 0.16))); // 바퀴 앞면 밖에 보이게
    this.addSlot(1, 0.28, MAG_POS.clone().add(new THREE.Vector3(0, 0, 0.1)));
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
    return step === 0 ? this.axleModel !== null : this.bearingModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? MAG_POS.clone().add(new THREE.Vector3(0, 0, 0.16)) : MAG_POS.clone().add(new THREE.Vector3(0, 0, 0.1));
  }

  slotTarget(step: number): THREE.Vector3 {
    return this.getFlyTarget(step);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildMagAxle() : this.buildMagBearing();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.mag.add(model);
    if (step === 0) {
      this.axleModel = model;
      // 실물 차축도 양쪽 호차에 나타나고, 창짝이 레일에 앉는다
      for (const a of this.realAxles) a.visible = true;
      this.hideSlot(0);
      this.showSlot(1);
      this.settle = { k: 0, last: -1 };
    } else {
      this.bearingModel = model;
      this.magCage = (model.getObjectByName('cage') as THREE.Group | undefined) ?? null;
      for (const b of this.realBearings) b.visible = true;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.axleModel) this.mag.remove(this.axleModel);
    if (this.bearingModel) this.mag.remove(this.bearingModel);
    this.axleModel = this.bearingModel = null;
    this.magCage = null;
    this.settle = null;
    for (const a of this.realAxles) a.visible = false;
    for (const b of this.realBearings) b.visible = false;
    this.placeSashWaiting();
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (!this.settle) return;
    const dt = this.settle.last < 0 ? 0 : Math.min(0.05, t - this.settle.last);
    this.settle.last = t;
    this.settle.k += dt / SETTLE_S;
    if (this.settle.k >= 1) this.finishSettle();
    else this.applySettle(this.settle.k);
  }

  createSim(): MachineSim {
    if (!this.axleModel || !this.bearingModel) throw new Error('window mission incomplete');
    this.finishSettle();
    let time = 0;
    let x = SASH_X_CLOSED;
    let wheelRot = 0;
    let rpm = 0;
    return {
      update: (dt: number) => {
        time += dt;
        // 닫힘 ↔ 열림 코사인 왕복
        const k = 0.5 - 0.5 * Math.cos((time * Math.PI * 2) / PERIOD);
        const nx = SASH_X_CLOSED + (SASH_X_OPEN - SASH_X_CLOSED) * k;
        const dx = nx - x;
        x = nx;
        this.sash.position.x = x;
        // 미끄럼 없는 구름: 회전각 = 이동 거리 ÷ 반지름
        wheelRot -= dx / WHEEL_R;
        rpm = dt > 0 ? (Math.abs(dx / WHEEL_R / dt) / (Math.PI * 2)) * 60 : 0;
        for (const w of this.rollers) w.rotation.z = wheelRot;
        if (this.magWheel) this.magWheel.rotation.z = wheelRot; // 확대 바퀴도 같은 각도
        if (this.magCage) this.magCage.rotation.z = wheelRot * CAGE_RATIO;
      },
      getDisplay: () => [
        { label: '창 열림', value: ((SASH_X_CLOSED - x) * M_PER_UNIT * 100).toFixed(1), unit: 'cm', tone: 'default' },
        { label: '호차 회전수', value: rpm.toFixed(0), unit: 'rpm', tone: 'red' },
        { label: '차축 회전수 (고정축)', value: '0', unit: 'rpm', tone: 'blue' }
      ]
    };
  }

  // ───────────────────────── 상태 연출 ─────────────────────────

  /** 설치 전: 앞 창짝이 레일에서 들려 있고 기울어져 있다 */
  private placeSashWaiting(): void {
    this.sash.position.set(SASH_X_CLOSED, SASH_Y + PRE_LIFT, SASH_Z_FRONT);
    this.sash.rotation.z = PRE_TILT;
  }

  private applySettle(k: number): void {
    const s = smooth(k);
    this.sash.position.y = SASH_Y + PRE_LIFT * (1 - s);
    this.sash.rotation.z = PRE_TILT * (1 - s);
  }

  private finishSettle(): void {
    this.settle = null;
    this.sash.position.set(SASH_X_CLOSED, SASH_Y, SASH_Z_FRONT);
    this.sash.rotation.set(0, 0, 0);
  }

  // ───────────────────────── 미션 부품(확대 모형) ─────────────────────────

  /** ① 차축 5배: Z축 핀 + 육각 너트 + 끝면 파란 표시(차축은 돌지 않는 고정축) */
  private buildMagAxle(): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(cylZ(MAG_AXLE_R, MAG_AXLE_HALF * 2, 24), this.steelMat));
    for (const s of [-1, 1]) {
      const nut = new THREE.Mesh(cylZ(0.095, 0.045, 6), this.steelMat);
      nut.position.z = s * 0.185;
      g.add(nut);
    }
    const mark = new THREE.Mesh(cylZ(0.05, 0.004, 24), paint(CATEGORY_COLORS.shaft, { roughness: 0.35 }));
    mark.position.z = 0.2095;
    g.add(mark);
    // 흰색 막대 표시가 고정되어 있는 것으로 '안 돈다'가 보인다
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.004), paint(0xf4f6f8, { roughness: 0.4 }));
    bar.position.z = 0.2125;
    g.add(bar);
    return g;
  }

  /** ② 볼 베어링 5배: 외륜(바퀴 안쪽) + 내륜(축 쪽) + 볼 8개 케이지 */
  private buildMagBearing(): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(MAG_BR_OUT, 0.025, 16, 48), this.darkMat));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(MAG_BR_IN, 0.025, 16, 48), this.steelMat));
    const cage = new THREE.Group();
    cage.name = 'cage';
    cage.add(new THREE.Mesh(mergeBalls(MAG_BR_MID, MAG_BR_BALL, BR_BALLS), chrome()));
    cage.add(new THREE.Mesh(new THREE.TorusGeometry(MAG_BR_MID, 0.005, 10, 48), this.darkMat));
    g.add(cage);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  /** 벽 조각 4개: 3.6 × 2.6 판에서 창 구멍을 뺀 모양 */
  private buildWall(): void {
    const m = plastic(0xe9e4d8, { roughness: 0.8 });
    const sideW = (WALL_W - HOLE_W) / 2;
    for (const s of [-1, 1]) {
      this.group.add(box(sideW, WALL_H, WALL_T, 0.012, m, s * (HOLE_W / 2 + sideW / 2), WALL_H / 2, 0));
    }
    this.group.add(box(HOLE_W, HOLE_BOT, WALL_T, 0.012, m, 0, HOLE_BOT / 2, 0));
    this.group.add(box(HOLE_W, WALL_H - HOLE_TOP, WALL_T, 0.012, m, 0, (WALL_H + HOLE_TOP) / 2, 0));
  }

  /** 창틀 각재 4개 + 아래 레일 2줄(얇은 상자 위 볼록 레일) */
  private buildFrame(): void {
    const alu = this.aluMat;
    this.group.add(box(HOLE_W + FRAME_S * 2, FRAME_S, FRAME_D, 0.008, alu, 0, HOLE_BOT - FRAME_S / 2, 0));
    this.group.add(box(HOLE_W + FRAME_S * 2, FRAME_S, FRAME_D, 0.008, alu, 0, HOLE_TOP + FRAME_S / 2, 0));
    for (const s of [-1, 1]) {
      this.group.add(box(FRAME_S, HOLE_TOP - HOLE_BOT, FRAME_D, 0.008, alu, s * (HOLE_W / 2 + FRAME_S / 2), (HOLE_BOT + HOLE_TOP) / 2, 0));
    }
    for (const s of [-1, 1]) {
      this.group.add(box(HOLE_W, STRIP_H, 0.02, 0.004, alu, 0, HOLE_BOT + STRIP_H / 2, s * RAIL_Z));
      this.group.add(box(HOLE_W, 0.015, 0.012, 0.003, this.darkMat, 0, RAIL_TOP + 0.0075, s * RAIL_Z));
    }
  }

  /** 뒤 창짝(고정, z = -0.05, x 중심 -0.65) */
  private buildBackSash(): void {
    const g = this.buildSashPanel(false);
    g.position.set(BACK_SASH_X, SASH_Y, SASH_Z_BACK);
    this.group.add(g);
  }

  /** 앞 창짝 + 호차 2개(차축·베어링은 설치 전 숨김) */
  private buildFrontSash(): void {
    this.sash.add(this.buildSashPanel(true));
    const g = this.sash;
    for (const s of [-1, 1]) {
      const r = this.buildRoller();
      r.assembly.position.set(s * ROLLER_X, ROLLER_DY, 0);
      g.add(r.assembly);
      this.rollers.push(r.wheel);
      this.realAxles.push(r.axle);
      this.realBearings.push(r.bearing);
    }
  }

  /** 창짝 1장(테두리 4개 + 유리 + 크레센트). 앞 창짝 하단만 ghost로 호차가 보이게 */
  private buildSashPanel(front: boolean): THREE.Group {
    const g = new THREE.Group();
    const alu = this.aluMat;
    g.add(box(SASH_W, BAR_T, SASH_T, 0.008, alu, 0, SASH_H / 2 - BAR_T / 2, 0));
    g.add(box(SASH_W, BAR_T, SASH_T, 0.008, front ? ghost() : alu, 0, -(SASH_H / 2 - BAR_T / 2), 0));
    for (const s of [-1, 1]) {
      g.add(box(BAR_T, SASH_H - BAR_T * 2, SASH_T, 0.008, alu, s * (SASH_W / 2 - BAR_T / 2), 0, 0));
    }
    g.add(box(SASH_W - BAR_T * 2, SASH_H - BAR_T * 2, 0.008, 0.003, glass(), 0, 0, 0));
    if (front) {
      const lock = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 12, 24, Math.PI), brass());
      lock.position.set(0.12, SASH_H / 2 - BAR_T / 2, SASH_T / 2 + 0.004);
      g.add(lock);
    }
    return g;
  }

  /** 호차 1개: 바퀴(V홈) + ㄷ자 하우징 + 숨긴 차축·베어링. 원점 = 바퀴 중심 */
  private buildRoller(): { assembly: THREE.Group; wheel: THREE.Group; axle: THREE.Group; bearing: THREE.Group } {
    const a = new THREE.Group();
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(latheZ(WHEEL_PROFILE, 32), this.steelMat));
    a.add(wheel);
    // 하우징: 아래가 열린 ㄷ자 판
    for (const s of [-1, 1]) {
      a.add(box(0.14, 0.115, 0.012, 0.004, this.darkMat, 0, 0, s * (WHEEL_HALF + 0.006)));
    }
    a.add(box(0.14, 0.012, WHEEL_HALF * 2 + 0.024, 0.004, this.darkMat, 0, 0.0615, 0));
    // ① 차축(실물): 끝면 파란 표시
    const axle = new THREE.Group();
    axle.add(new THREE.Mesh(cylZ(AXLE_R, AXLE_HALF * 2, 24), this.steelMat));
    for (const s of [-1, 1]) {
      const nut = new THREE.Mesh(cylZ(0.02, 0.008, 6), this.steelMat);
      nut.position.z = s * 0.037;
      axle.add(nut);
    }
    const mark = new THREE.Mesh(cylZ(0.011, 0.002, 24), paint(CATEGORY_COLORS.shaft, { roughness: 0.35 }));
    mark.position.z = 0.042;
    axle.add(mark);
    axle.visible = false;
    a.add(axle);
    // ② 볼 베어링(실물): 내륜·외륜·볼 8개
    const bearing = new THREE.Group();
    bearing.add(new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 12, 24), this.steelMat));
    bearing.add(new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 12, 24), this.darkMat));
    bearing.add(new THREE.Mesh(mergeBalls(BR_MID, BR_BALL_R, BR_BALLS), chrome()));
    bearing.visible = false;
    a.add(bearing);
    return { assembly: a, wheel, axle, bearing };
  }

  /** 확대 모형: 받침대 + 볼록 레일 + 5배 하우징·바퀴. 바퀴 아랫선이 받침대에 닿는다 */
  private buildMagStand(): void {
    const g = this.mag;
    g.position.copy(MAG_POS);
    g.add(box(0.9, 0.08, 0.34, 0.01, aluminum(), 0, -0.34, 0)); // 받침대(바닥 y=0)
    g.add(box(0.9, 0.04, 0.04, 0.006, this.darkMat, 0, -0.28, 0)); // 볼록 레일(V홈에 물림)
    // 하우징(ㄷ판) + 받침 기둥 2개
    for (const s of [-1, 1]) {
      // 앞판은 반투명 — 확대 바퀴·축·베어링이 보이게
      g.add(box(0.72, 0.575, 0.06, 0.012, s > 0 ? ghost() : this.darkMat, 0, 0, s * 0.105));
      g.add(box(0.07, 0.5875, 0.05, 0.008, this.darkMat, s * 0.4, -0.00625, s * 0.105));
    }
    g.add(box(0.72, 0.06, 0.27, 0.012, this.darkMat, 0, 0.3175, 0));
    // 확대 바퀴(5배, 같은 각도로 회전)
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(latheZ(WHEEL_PROFILE.map(([r, y]) => [r * MAG, y * MAG] as V2), 48), this.steelMat));
    g.add(wheel);
    this.magWheel = wheel;
  }
}
