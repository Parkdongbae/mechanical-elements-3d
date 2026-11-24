// 킥보드: 차축과 볼 베어링 미션 — 앞바퀴는 처음에 옆 바닥에 누워 있다.
// 차축은 포크에 고정되어 돌지 않는다(고정축 — 끝면 파란 표시). 바퀴 허브 속 볼 베어링이
// 내륜(차축, 고정)과 외륜(허브, 바퀴와 같이 회전) 사이에서 구른다.
// 완료: 제자리 주행 — 속도가 6초 주기로 0 → 최대 → 브레이크(펜더가 바퀴를 누름) → 0.
// 바퀴는 미끄럼 없이 구른다(θ = -dist / R), 바닥 표시선이 뒤로 흐른다.
// 좌표: 바닥 y=0, +X = 진행 방향, +Z = 카메라 쪽.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, brass, chrome, darkSteel, paint, plastic, rubber, steel } from '../models/materials';
import { lathe, merge, tubeProfile, type V2 } from '../models/parts/geom';

// ── 치수 상수 (설계표 5-2, 1 단위 ≈ 0.35m) ──
const WHEEL_R = 0.26; // 바퀴 바깥 반지름
const DECK_W = 1.9, DECK_H = 0.08, DECK_D = 0.42, DECK_Y = 0.42; // 발판(데크)
const TAPE_W = 1.5, TAPE_D = 0.34; // 미끄럼 방지 테이프
const R = new THREE.Vector3(-1.05, 0.26, 0); // 뒷바퀴 중심
const F = new THREE.Vector3(1.15, 0.26, 0); // 앞바퀴 중심 = 차축 위치
const FORK_Z = 0.09; // 포크판 z 오프셋
const REAR_FORK_A = new THREE.Vector3(-0.62, 0.44, 0); // 뒷 포크 위 끝(데크 밑면)
const REAR_FORK_B = new THREE.Vector3(-1.07, 0.14, 0); // 뒷 포크 아래 끝(축 옆)
const FRONT_FORK_A = new THREE.Vector3(1.07, 0.58, 0); // 앞 포크 위 끝(헤드튜브 안)
const FRONT_FORK_B = new THREE.Vector3(1.20, 0.095, 0); // 앞 포크 아래 끝(바퀴 옆)
const HEAD_TILT = 0.2; // 헤드튜브·손잡이 기둥 기울임(rad, 뒤로)
const HEAD_C = new THREE.Vector3(1.05, 0.75, 0);
const HEAD_R = 0.06, HEAD_LEN = 0.5;
const STEM_R = 0.04, STEM_LEN = 2.2;
const BAR_R = 0.035, BAR_LEN = 0.9, GRIP_R = 0.045, GRIP_LEN = 0.18;
const AXLE_R = 0.03, AXLE_HALF = 0.17; // 앞 차축(미션 ①)
const RAXLE_R = 0.025, RAXLE_HALF = 0.12; // 뒷 차축(고정 구조)
const TIRE_RING = WHEEL_R - 0.045, TIRE_TUBE = 0.045; // 타이어 토러스(바깥 = WHEEL_R)
const RIM_IN = 0.148, RIM_OUT = 0.172, RIM_HALF = 0.032; // 휠 림
const HUB_IN = 0.112, HUB_OUT = 0.132, HUB_HALF = 0.045; // 허브 관(속이 보임)
const SPOKE_N = 5, SPOKE_R = 0.012, SPOKE_R0 = 0.122, SPOKE_R1 = 0.152; // 스포크
const BEARING_OR = 0.09, BEARING_TUBE = 0.02; // 베어링 외륜 토러스
const INNER_R = 0.044, INNER_TUBE = 0.013; // 내륜
const BALL_N = 7, BALL_R = 0.018, BALL_PITCH = 0.063; // 볼
const FENDER_HINGE = new THREE.Vector3(-1.30, 0.42, 0); // 브레이크 펜더 경첩
const FENDER_LOCAL_Y = 0.13; // 펜더판 중심(경첩 기준)
const FENDER_ANGLE = -0.06; // 브레이크 시 누름 각(판 밑면이 타이어에 닿음)
const LYING = new THREE.Vector3(1.15, 0.056, 0.9); // 대기 중 앞바퀴(바닥에 눕혀짐)
// ── 동작 상수 ──
const PERIOD = 6; // 주행 주기(s)
const V_MAX = 2.4; // 최대 속도(단위/s)
const RAMP_T = 2.0; // 가속 시간(s)
const BRAKE_T0 = 4.5, BRAKE_T1 = 5.3; // 브레이크 구간(s)
const PRESS_T = 0.2; // 펜더 눌림/복귀 시간(s)
const MARK_LEN = 1.6, MARK_STEP = 0.5, MARK_N = 12, MARK_SPAN = MARK_N * MARK_STEP; // 바닥 표시선(침목: Z 방향 막대, X로 0.5 간격)
const M_PER_UNIT = 0.35;
const CAGE_RATIO = 0.5; // 볼 케이지 공전비(외륜과 고정 내륜 사이)
const MOUNT_T = 2.0; // 바퀴 장착 연출 시간(s)
const SEAT_T = 0.9; // 베어링 안착 연출 시간(s)
const HEAD_DIR = new THREE.Vector3(-Math.sin(HEAD_TILT), Math.cos(HEAD_TILT), 0); // 헤드축 방향
const HEAD_TOP = HEAD_C.clone().addScaledVector(HEAD_DIR, HEAD_LEN / 2);
const STEM_C = HEAD_TOP.clone().addScaledVector(HEAD_DIR, STEM_LEN / 2);
const STEM_TOP = HEAD_TOP.clone().addScaledVector(HEAD_DIR, STEM_LEN);

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** 표시선 흐름 좌표(-SPAN/2 ~ +SPAN/2 되돌림) */
function wrap(x: number): number {
  return ((x % MARK_SPAN) + MARK_SPAN) % MARK_SPAN - MARK_SPAN / 2;
}

/** lathe(Y축 회전체)를 Z축 회전체로 */
function latheZ(profile: V2[], seg = 40): THREE.BufferGeometry {
  const g = lathe(profile, seg);
  g.rotateX(Math.PI / 2);
  return g;
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

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.008, Math.min(w, h, d) / 2 - 0.001)), mat);
}

/** a→b 방향으로 눕힌 판(포크·브래킷) */
function diagBox(len: number, h: number, d: number, a: THREE.Vector3, b: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
  const m = box(len, h, d, mat);
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
  return m;
}

export class KickScooter extends BaseMachine {
  readonly id = 'scooter';
  private wheels: THREE.Group[] = []; // [앞(대기 → 장착), 뒤(항상 장착)]
  private axleModel: THREE.Group | null = null;
  private nutFront: THREE.Object3D[] = []; // +Z 너트·표시(바퀴 장착 후 등장)
  private bearingModel: THREE.Group | null = null;
  private bearingOuter: THREE.Object3D | null = null;
  private bearingBalls: THREE.Object3D | null = null;
  private fender = new THREE.Group();
  private marks: THREE.InstancedMesh | null = null;
  private mount: { k: number; last: number } | null = null;
  private seat: { k: number; last: number } | null = null;
  private wheelOn = false;

  constructor() {
    super();
    this.buildBody();
    this.buildRearAxle();
    this.buildMarks();
    for (let i = 0; i < 2; i++) {
      const w = this.buildWheel();
      this.wheels.push(w);
      this.group.add(w);
    }
    // 앞바퀴: 옆 바닥에 누워 대기, 뒷바퀴: 처음부터 장착
    this.wheels[0]!.position.copy(LYING);
    this.wheels[0]!.rotation.set(Math.PI / 2, 0, 0);
    this.wheels[1]!.position.copy(R);

    this.addSlot(0, 0.12, F.clone(), 0.016); // ① 차축 슬롯(Z축 방향)
    this.addSlot(1, 0.14, new THREE.Vector3(F.x, F.y, F.z + 0.12), 0.016); // ② 볼 베어링 슬롯
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
    return step === 0 ? F.clone() : new THREE.Vector3(F.x, F.y, F.z + 0.2);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? F.clone() : new THREE.Vector3(F.x, F.y, F.z + 0.12);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildAxle() : this.buildBearing();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      // 차축은 포크에 고정(회전하지 않음) → 그 후 바퀴가 일어나 축에 끼워진다
      model.position.copy(F);
      this.axleModel = model;
      this.nutFront = [];
      model.traverse((o) => {
        if (o.name === 'nutFront') {
          o.visible = false;
          o.userData.z = o.position.z;
          this.nutFront.push(o);
        }
      });
      this.hideSlot(0);
      this.showSlot(1);
      this.mount = { k: 0, last: -1 };
    } else {
      // 볼 베어링: 허브 입구에서 안쪽으로 밀려 안착(바퀴 중심면)
      model.position.set(F.x, F.y, F.z + 0.28);
      this.bearingModel = model;
      this.bearingOuter = model.getObjectByName('outer') ?? null;
      this.bearingBalls = model.getObjectByName('balls') ?? null;
      this.hideSlot(1);
      this.seat = { k: 0, last: -1 };
    }
  }

  reset(): void {
    if (this.axleModel) this.group.remove(this.axleModel);
    if (this.bearingModel) this.group.remove(this.bearingModel);
    this.axleModel = this.bearingModel = null;
    this.bearingOuter = this.bearingBalls = null;
    this.nutFront = [];
    this.mount = this.seat = null;
    this.wheelOn = false;
    this.wheels[0]!.position.copy(LYING);
    this.wheels[0]!.rotation.set(Math.PI / 2, 0, 0);
    this.wheels[1]!.rotation.set(0, 0, 0);
    this.fender.rotation.set(0, 0, 0);
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.mount) {
      const dt = this.mount.last < 0 ? 0 : Math.min(0.05, t - this.mount.last);
      this.mount.last = t;
      this.mount.k += dt / MOUNT_T;
      if (this.mount.k >= 1) this.finishMount();
      else this.applyMount(this.mount.k);
    }
    if (this.seat) {
      const dt = this.seat.last < 0 ? 0 : Math.min(0.05, t - this.seat.last);
      this.seat.last = t;
      this.seat.k += dt / SEAT_T;
      if (this.seat.k >= 1) this.finishSeat();
      else if (this.bearingModel) this.bearingModel.position.z = F.z + 0.28 * (1 - smooth(this.seat.k));
    }
  }

  createSim(): MachineSim {
    if (!this.axleModel || !this.bearingModel) throw new Error('scooter mission incomplete');
    this.finishMount();
    this.finishSeat();
    let time = 0;
    let dist = 0;
    let v = 0;
    const dummy = new THREE.Object3D();
    return {
      update: (dt: number) => {
        time = (time + dt) % PERIOD;
        // 속도: 가속 → 최대 → 브레이크 → 정지
        if (time < RAMP_T) v = V_MAX * smooth(time / RAMP_T);
        else if (time < BRAKE_T0) v = V_MAX;
        else if (time < BRAKE_T1) v = V_MAX * (1 - smooth((time - BRAKE_T0) / (BRAKE_T1 - BRAKE_T0)));
        else v = 0;
        dist += v * dt;
        // 미끄럼 없는 구름: 회전각 = 이동 거리 ÷ 반지름(앞뒤 바퀴 모두)
        const th = -dist / WHEEL_R;
        for (const w of this.wheels) w.rotation.z = th;
        // 외륜 = 허브와 같이 회전, 내륜 = 차축에 고정(돌지 않음), 볼 케이지는 그 사이
        if (this.bearingOuter) this.bearingOuter.rotation.z = th;
        if (this.bearingBalls) this.bearingBalls.rotation.z = th * CAGE_RATIO;
        // 발판 브레이크: 펜더가 타이어를 누름
        let press = 0;
        if (time >= BRAKE_T0 && time < BRAKE_T1) press = smooth((time - BRAKE_T0) / PRESS_T);
        else if (time >= BRAKE_T1) press = 1 - smooth((time - BRAKE_T1) / PRESS_T);
        this.fender.rotation.z = FENDER_ANGLE * press;
        // 바닥 표시선이 뒤로 흐른다(되돌림 타일링)
        for (let i = 0; i < MARK_N; i++) {
          dummy.position.set(wrap(i * MARK_STEP - dist), 0.005, 0);
          dummy.updateMatrix();
          this.marks!.setMatrixAt(i, dummy.matrix);
        }
        this.marks!.instanceMatrix.needsUpdate = true;
      },
      getDisplay: () => {
        const rpm = (Math.abs(v) / (Math.PI * 2 * WHEEL_R)) * 60;
        return [
          { label: '바퀴 회전수', value: rpm.toFixed(0), unit: 'rpm', tone: 'red' },
          { label: '차축 회전수 (고정축)', value: '0', unit: 'rpm', tone: 'blue' },
          { label: '속도', value: (Math.abs(v) * M_PER_UNIT * 3.6).toFixed(1), unit: 'km/h' }
        ];
      }
    };
  }

  // ───────────────────────── 장착 연출 ─────────────────────────

  /** 바퀴가 일어나 포크 사이로 들어가 차축에 끼워진다 */
  private applyMount(k: number): void {
    const w = this.wheels[0]!;
    const pts = [
      LYING,
      new THREE.Vector3(LYING.x, 1.2, 0.62),
      new THREE.Vector3(F.x, F.y, 0.42),
      F.clone()
    ];
    const seg = [0.4, 0.25, 0.35];
    let u = k;
    let j = 0;
    while (j < seg.length - 1 && u > seg[j]!) {
      u -= seg[j]!;
      j++;
    }
    const a = smooth(u / seg[j]!);
    w.position.lerpVectors(pts[j]!, pts[j + 1]!, a);
    const up = smooth(Math.min(1, k / 0.4));
    w.rotation.set((Math.PI / 2) * (1 - up), 0, 0);
    // +Z 너트: 바퀴가 통과한 뒤 축 끝으로 들어온다
    const kh = smooth((k - 0.85) / 0.15);
    for (const n of this.nutFront) {
      n.visible = k > 0.85;
      n.position.z = (n.userData.z as number) + (1 - kh) * 0.12;
    }
  }

  private finishMount(): void {
    if (!this.axleModel || this.wheelOn) {
      this.mount = null;
      return;
    }
    this.mount = null;
    this.wheelOn = true;
    this.wheels[0]!.position.copy(F);
    this.wheels[0]!.rotation.set(0, 0, 0);
    for (const n of this.nutFront) {
      n.visible = true;
      n.position.z = n.userData.z as number;
    }
  }

  private finishSeat(): void {
    this.seat = null;
    if (this.bearingModel) this.bearingModel.position.set(F.x, F.y, F.z);
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** ① 차축: 모따기 원기둥 + 양끝 육각 너트 + 끝면 파란 표시(고정축 — 돌지 않음) */
  private buildAxle(): THREE.Group {
    const g = new THREE.Group();
    const c = 0.006;
    g.add(new THREE.Mesh(
      latheZ([[0, -AXLE_HALF], [AXLE_R - c, -AXLE_HALF], [AXLE_R, -AXLE_HALF + c], [AXLE_R, AXLE_HALF - c], [AXLE_R - c, AXLE_HALF], [0, AXLE_HALF]], 32),
      steel({ roughness: 0.26 })
    ));
    const nutMat = steel({ roughness: 0.3 });
    const markMat = paint(CATEGORY_COLORS.shaft, { roughness: 0.35 });
    const whiteMat = paint(0xf4f6f8, { roughness: 0.4 });
    for (const s of [-1, 1]) {
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.038, 6), nutMat);
      nut.rotation.x = Math.PI / 2;
      nut.position.z = s * (AXLE_HALF + 0.024);
      const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 24), markMat);
      mark.rotation.x = Math.PI / 2;
      mark.position.z = s * (AXLE_HALF + 0.045);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.004), whiteMat);
      bar.position.z = s * (AXLE_HALF + 0.048);
      if (s > 0) {
        // +Z 너트 쪽은 바퀴 장착이 끝난 뒤 나타난다
        nut.name = 'nutFront';
        mark.name = 'nutFront';
        bar.name = 'nutFront';
      }
      g.add(nut, mark, bar);
    }
    return g;
  }

  /** ② 볼 베어링: 외륜(허브용) + 볼 7개 + 내륜(차축용) + 샤프트색 씰 */
  private buildBearing(): THREE.Group {
    const g = new THREE.Group();
    const outer = new THREE.Group();
    outer.name = 'outer';
    outer.add(new THREE.Mesh(new THREE.TorusGeometry(BEARING_OR, BEARING_TUBE, 24, 48), chrome({ roughness: 0.14 })));
    g.add(outer);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(INNER_R, INNER_TUBE, 24, 40), steel({ roughness: 0.28 })));
    const sealMat = paint(CATEGORY_COLORS.shaft, { roughness: 0.4 });
    for (const s of [-1, 1]) {
      const seal = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 16, 36), sealMat);
      seal.position.z = s * 0.02;
      g.add(seal);
    }
    const balls = new THREE.Group();
    balls.name = 'balls';
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < BALL_N; i++) {
      const a = (i / BALL_N) * Math.PI * 2;
      const s = new THREE.SphereGeometry(BALL_R, 16, 12);
      s.translate(Math.cos(a) * BALL_PITCH, Math.sin(a) * BALL_PITCH, 0);
      geos.push(s);
    }
    balls.add(new THREE.Mesh(merge(geos), chrome()));
    // 볼 케이지 링(볼과 같이 공전)
    balls.add(new THREE.Mesh(new THREE.TorusGeometry(BALL_PITCH, 0.005, 16, 40), brass()));
    g.add(balls);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildBody(): void {
    const g = this.group;
    const al = aluminum();
    // 발판(데크) + 미끄럼 방지 테이프
    const deck = box(DECK_W, DECK_H, DECK_D, al);
    deck.position.y = DECK_Y;
    g.add(deck);
    const tape = box(TAPE_W, 0.01, TAPE_D, rubber({ color: 0x2b2d31, roughness: 0.9 }));
    tape.position.set(0, DECK_Y + DECK_H / 2 + 0.005, 0);
    g.add(tape);
    // 데크 앞 끝 → 헤드튜브 받침
    const joint = diagBox(0.21, 0.07, 0.12, new THREE.Vector3(0.9, 0.44, 0), HEAD_C.clone().addScaledVector(HEAD_DIR, -HEAD_LEN / 2), al);
    g.add(joint);
    // 뒷 포크 2장 + 앞 포크 2장
    for (const s of [-1, 1]) {
      const ra = REAR_FORK_A.clone().setZ(s * FORK_Z);
      const rb = REAR_FORK_B.clone().setZ(s * FORK_Z);
      g.add(diagBox(0.5, 0.06, 0.02, ra, rb, al));
      const fa = FRONT_FORK_A.clone().setZ(s * FORK_Z);
      const fb = FRONT_FORK_B.clone().setZ(s * FORK_Z);
      g.add(diagBox(0.5, 0.06, 0.02, fa, fb, al));
    }
    // 헤드튜브 + 손잡이 기둥 + 핸들바 + 그립 2개 + 클램프
    const head = new THREE.Mesh(new THREE.CylinderGeometry(HEAD_R, HEAD_R, HEAD_LEN, 32), darkSteel());
    head.position.copy(HEAD_C);
    head.rotation.z = HEAD_TILT;
    g.add(head);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(STEM_R, STEM_R, STEM_LEN, 28), al);
    stem.position.copy(STEM_C);
    stem.rotation.z = HEAD_TILT;
    g.add(stem);
    const barGeo = new THREE.CylinderGeometry(BAR_R, BAR_R, BAR_LEN, 28);
    barGeo.rotateX(Math.PI / 2);
    const bar = new THREE.Mesh(barGeo, al);
    bar.position.copy(STEM_TOP);
    g.add(bar);
    for (const s of [-1, 1]) {
      const gripGeo = new THREE.CylinderGeometry(GRIP_R, GRIP_R, GRIP_LEN, 28);
      gripGeo.rotateX(Math.PI / 2);
      const grip = new THREE.Mesh(gripGeo, rubber({ color: 0x2b2d31, roughness: 0.8 }));
      grip.position.set(STEM_TOP.x, STEM_TOP.y, s * (BAR_LEN / 2 - GRIP_LEN / 2));
      g.add(grip);
    }
    const clamp = box(0.16, 0.11, 0.09, darkSteel());
    clamp.position.copy(STEM_TOP);
    clamp.rotation.z = HEAD_TILT;
    g.add(clamp);
    // 브레이크 펜더: 지지 팔 2개(데크 뒤 끝 → 경첩) + 경첩 핀 + 판(고무 패드)
    for (const s of [-1, 1]) {
      g.add(diagBox(0.37, 0.035, 0.02, new THREE.Vector3(-0.93, 0.4, s * FORK_Z), FENDER_HINGE.clone().setZ(s * FORK_Z), darkSteel()));
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 24), steel({ roughness: 0.3 }));
    pin.rotation.x = Math.PI / 2;
    pin.position.copy(FENDER_HINGE);
    g.add(pin);
    this.fender.position.copy(FENDER_HINGE);
    const plate = box(0.5, 0.03, 0.14, paint(0xd8362f, { roughness: 0.4 }));
    plate.position.set(0.25, FENDER_LOCAL_Y, 0);
    this.fender.add(plate);
    const pad = box(0.4, 0.012, 0.12, rubber({ roughness: 0.95 }));
    pad.position.set(0.25, FENDER_LOCAL_Y - 0.018, 0);
    this.fender.add(pad);
    g.add(this.fender);
  }

  /** 뒷 차축(고정 구조 — 포크에 붙어 있고 바퀴만 돈다) */
  private buildRearAxle(): void {
    const g = new THREE.Group();
    const c = 0.005;
    g.add(new THREE.Mesh(
      latheZ([[0, -RAXLE_HALF], [RAXLE_R - c, -RAXLE_HALF], [RAXLE_R, -RAXLE_HALF + c], [RAXLE_R, RAXLE_HALF - c], [RAXLE_R - c, RAXLE_HALF], [0, RAXLE_HALF]], 24),
      steel({ roughness: 0.3 })
    ));
    for (const s of [-1, 1]) {
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 6), steel({ roughness: 0.3 }));
      nut.rotation.x = Math.PI / 2;
      nut.position.z = s * (RAXLE_HALF + 0.017);
      g.add(nut);
    }
    g.position.copy(R);
    this.group.add(g);
  }

  /** 바닥 표시선(침목처럼 0.5 간격) — 주행 시 뒤로 흐른다 */
  private buildMarks(): void {
    const m = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.06, 0.01, MARK_LEN),
      plastic(0x8d99a6, { roughness: 0.7 }),
      MARK_N
    );
    m.castShadow = false;
    m.receiveShadow = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < MARK_N; i++) {
      dummy.position.set(wrap(i * MARK_STEP), 0.005, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    this.group.add(m);
    this.marks = m;
  }

  /** 작은 바퀴: 타이어(토러스) + 노란 림 + 스포크 5개 + 허브 관(속에 베어링이 보임) */
  private buildWheel(): THREE.Group {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.TorusGeometry(TIRE_RING, TIRE_TUBE, 24, 48), rubber({ color: 0x232529, roughness: 0.9 })));
    w.add(new THREE.Mesh(latheZ(tubeProfile(RIM_IN, RIM_OUT, -RIM_HALF, RIM_HALF, 0.006), 40), plastic(0xf2b619, { roughness: 0.35 })));
    const spokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < SPOKE_N; i++) {
      const a = (i / SPOKE_N) * Math.PI * 2;
      const s = new THREE.CylinderGeometry(SPOKE_R, SPOKE_R, SPOKE_R1 - SPOKE_R0 + 0.02, 24);
      s.translate(0, (SPOKE_R0 + SPOKE_R1) / 2, 0);
      s.rotateZ(a);
      spokes.push(s);
    }
    w.add(new THREE.Mesh(merge(spokes), chrome()));
    w.add(new THREE.Mesh(latheZ(tubeProfile(HUB_IN, HUB_OUT, -HUB_HALF, HUB_HALF, 0.006), 40), darkSteel()));
    const bolts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < SPOKE_N; i++) {
      const a = ((i + 0.5) / SPOKE_N) * Math.PI * 2;
      const b = new THREE.CylinderGeometry(0.012, 0.012, 0.014, 6);
      b.rotateX(Math.PI / 2);
      b.translate(Math.cos(a) * 0.122, Math.sin(a) * 0.122, HUB_HALF + 0.006);
      bolts.push(b);
    }
    w.add(new THREE.Mesh(merge(bolts), chrome()));
    return w;
  }
}
