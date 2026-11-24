// 농구 골대: 나사(볼트와 너트)와 스프링 미션 — 작업 지시서 14 · 설계표 5-4 그대로 구현.
// 백보드는 처음에 볼트 없이 z축으로 0.12 기울어 0.15 처져 있고, 볼트 4개로 조이면 제자리로 들어올려진다.
// 림은 경첩 Hr 에서 꺾이는 브레이크어웨이 림: 덩크 하중에 꺾이면 브래킷 아래 압축 스프링이 감쇠 진동으로 되돌린다.
// 좌표: 바닥 y=0, +X = 링 쪽(앞), +Z = 화면 앞.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, darkSteel, paint, plastic, steel } from '../models/materials';
import { merge } from '../models/parts/geom';

// ── 설계표 5-4 고정 치수 ──
const BASE_W = 1.6, BASE_H = 0.3, BASE_D = 1.1, BASE_X = -0.9; // 무게 베이스
const POLE_W = 0.16, POLE_H = 3.4, POLE_X = -0.9, POLE_Y = 1.9; // 기둥
const ARM_L = 0.9, ARM_H = 0.12, ARM_D = 0.12, ARM_X = -0.45, ARM_Y = 3.5; // 앞팔
const BOARD_T = 0.06, BOARD_H = 1.3, BOARD_W = 1.9, BOARD_X = 0, BOARD_Y = 3.5; // 백보드(중심 B)
const BOARD_TILT = 0.12; // 설치 전 기울어진 각(rad)
const BOARD_DROP = 0.15; // 설치 전 처진 높이
const BOR_T = 0.055, BOR_D = 0.03; // 테두리 두께(y)·돌출(x)
const SQ_W = 0.7, SQ_H = 0.45, SQ_Y = -0.17; // 안쪽 사각 표시(보드 로컬)
const BRACKET_W = 0.22, BRACKET_H = 0.16, BRACKET_D = 0.3, BRACKET_X = 0.14, BRACKET_Y = 3.05; // 림 브래킷
const HR = new THREE.Vector3(0.25, 3.05, 0); // 림 경첩 위치 Hr
const RIM_R = 0.42; // 림 반지름
const RIM_TUBE = 0.022;
const NET_TOP = 0.42, NET_BOT = 0.3, NET_H = 0.5, NET_STRINGS = 12; // 그물 원뿔대
const NET_WIRE = 0.008;
const BALL_R = 0.3; // 공 반지름
const BALL_START = new THREE.Vector3(2.6, BALL_R, 1.0); // 공이 대기하는 바닥 자리
const BOLT_X = -0.03; // 볼트 4개 x (백보드 뒷면)
const BOLT_DY = 0.35, BOLT_DZ = 0.5; // 볼트 y·z 오프셋
const BOLT_R = 0.018, BOLT_LEN = 0.1; // 볼트 축
const BOLT_HEAD_R = 0.036, BOLT_HEAD_L = 0.045;
const BOLT_NUT_R = 0.034, BOLT_NUT_L = 0.032;
const SPRING_R = 0.05; // 스프링 코일 반지름
const SPRING_TURNS = 6;
const SPRING_WIRE = 0.011;
const SPRING_NAT = 0.26; // 코일 자연 길이(자리 길이보다 길게 — 미리 눌린 되돌림 스프링)
const SPRING_A = new THREE.Vector3(0.2, 2.9, 0); // 아래 고정점(브래킷 아래)
const SPRING_P = new THREE.Vector3(0.15, -0.02, 0); // 위 끝점(rimGroup 로컬)
const LUG_W = 0.16, LUG_H = 0.1, LUG_D = 0.16; // 스프링 받이 러그(브래킷 아래)

// ── 동작(주기 5초) ──
const PERIOD = 5;
const T_FLIGHT = 1.6; // 공 포물선 비행
const T_DUNK = 2.2; // 덩크 하중 시작
const BEND_T = 0.2; // 꺾임까지 걸리는 시간
const DUNK_TH = 0.35; // 최대 꺾임(rad)
const DAMP = 3, W_OSC = 14; // θ = -0.35·e^(-3τ)·cos(14τ)
const G = 6; // 중력(화면 단위)
const REST = 0.55; // 바닥 반발계수
const VX0 = 0.25, VX_KEEP = 0.75; // 통과 후 앞쪽 튐 속도·감쇠
const REST_STOP = 0.28; // 튕김 종료 문턱
const SEAM = 0.12; // 반복 이음매 페이드 시간
const GOAL_T = 1.8; // 공이 림 평면을 통과하는 시각
const MM_PER_UNIT = 350;
const UP = new THREE.Vector3(0, 1, 0);

// 파생 상수
const NET_ENTER_Y = HR.y + 0.35; // 림 바로 위 통과 시작 높이
const NET_EXIT_Y = 2.35; // 그물을 빠져나올 때 공 중심
const NET_EXIT_VY = (NET_EXIT_Y - NET_ENTER_Y) / (T_DUNK - T_FLIGHT); // 그물이 늦추는 낙하 속도
const VY0 = (NET_ENTER_Y - BALL_START.y + 0.5 * G * T_FLIGHT * T_FLIGHT) / T_FLIGHT; // 비행 초속

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function box(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
}

/** 두 점 사이 원기둥(위치는 지오메트리에 구움) */
function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 24): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
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

/** 코일 스프링 중심선(로컬 Y, y 0~h) */
class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private h: number, private turns: number) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(this.r * Math.cos(a), t * this.h, this.r * Math.sin(a));
  }
}

/** 덩크 뒤 림 각: 0~2.2s 0 → 0.2s 동안 -0.35 → 감쇠 진동 θ = -0.35·e^(-3τ)·cos(14τ) */
function rimAngle(phi: number): number {
  if (phi < T_DUNK) return 0;
  if (phi < T_DUNK + BEND_T) return -DUNK_TH * smooth((phi - T_DUNK) / BEND_T);
  const tau = phi - T_DUNK - BEND_T;
  return -DUNK_TH * Math.exp(-DAMP * tau) * Math.cos(W_OSC * tau);
}

/** 림이 θ 만큼 꺾였을 때 스프링 위 끝점(기계 좌표) = rimGroup 로컬 SPRING_P 를 Hr 중심 회전 */
function springTop(theta: number): THREE.Vector3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return new THREE.Vector3(HR.x + SPRING_P.x * c - SPRING_P.y * s, HR.y + SPRING_P.x * s + SPRING_P.y * c, 0);
}

/** θ에서 스프링 두 고정점 사이 거리 */
function springLen(theta: number): number {
  return springTop(theta).sub(SPRING_A).length();
}

/** 그물 통과 후 공이 바닥에 튀는 구간(해석적으로 미리 계산 — 길이 보존, 프레임과 무관하게 결정적) */
interface BounceSeg { t0: number; t1: number; y0: number; vy0: number; x0: number; vx: number }
interface BouncePlan { segs: BounceSeg[]; restT: number; restX: number }

function buildBouncePlan(): BouncePlan {
  const segs: BounceSeg[] = [];
  // 그물 아래에서 자유낙하: y0 + vy0·τ − ½g·τ² = BALL_R 의 양의 해
  const tf = (NET_EXIT_VY + Math.sqrt(NET_EXIT_VY * NET_EXIT_VY + 2 * G * (NET_EXIT_Y - BALL_R))) / G;
  segs.push({ t0: 0, t1: tf, y0: NET_EXIT_Y, vy0: NET_EXIT_VY, x0: HR.x + RIM_R, vx: VX0 });
  let t = tf;
  let x = HR.x + RIM_R + VX0 * tf;
  let launch = -(NET_EXIT_VY - G * tf) * REST; // 충돌 속도 × 반발계수
  let vx = VX0 * VX_KEEP;
  while (launch > REST_STOP && segs.length < 10) {
    const air = (2 * launch) / G;
    segs.push({ t0: t, t1: t + air, y0: BALL_R, vy0: launch, x0: x, vx });
    t += air;
    x += vx * air;
    launch *= REST;
    vx *= VX_KEEP;
  }
  return { segs, restT: t, restX: x };
}

export class BasketballHoop extends BaseMachine {
  readonly id = 'hoop';
  /** 백보드(원점 = 판 중심 B). 기울어짐·처짐은 이 그룹에만 준다 */
  private board = new THREE.Group();
  /** 림(원점 = 경첩 Hr). 꺾임은 이 그룹의 rotation.z 로만 준다 */
  private rim = new THREE.Group();
  private ball = new THREE.Group();
  private boltModel: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private coil: THREE.Mesh | null = null;
  private boardAnim: { k: number; last: number } | null = null;

  constructor() {
    super();
    this.buildBase();
    this.buildPoleArm();
    this.buildBracket();
    this.buildBoard();
    this.buildRim();
    this.buildBall();
    this.group.add(this.board, this.rim);
    this.placeBoardWaiting();
    // 슬롯: ① 백보드-팔 체결 볼트(링이 X축 방향) ② 림 아래 스프링
    this.addSlot(0, 0.3, new THREE.Vector3(-0.12, 3.5, 0), 0.03);
    this.slots[0]!.rotation.y = Math.PI / 2;
    this.addSlot(1, 0.14, new THREE.Vector3(0.2, 2.92, 0), 0.02);
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
    return step === 0 ? this.boltModel !== null : this.springModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0
      ? new THREE.Vector3(BOLT_X, BOARD_Y, 0)
      : SPRING_A.clone().add(springTop(0)).multiplyScalar(0.5);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(-0.12, 3.5, 0.3) : new THREE.Vector3(0.2, 2.92, 0.3);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildBolts() : this.buildSpring();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      // 볼트 무리의 원점 = 4개 중심 → 한 번만 배치한다
      model.position.set(BOLT_X, BOARD_Y, 0);
      this.boltModel = model;
      this.hideSlot(0);
      // 처져 있던 백보드가 볼트에 매달려 제자리로 들어올려진다
      this.boardAnim = { k: 0, last: -1 };
    } else {
      this.finishBoard();
      this.springModel = model;
      const c = model.getObjectByName('coil');
      this.coil = c instanceof THREE.Mesh ? c : null;
      this.applySpring(0);
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.boltModel) this.group.remove(this.boltModel);
    if (this.springModel) this.group.remove(this.springModel);
    this.boltModel = this.springModel = null;
    this.coil = null;
    this.boardAnim = null;
    this.placeBoardWaiting();
    this.rim.rotation.set(0, 0, 0);
    this.ball.position.copy(BALL_START);
    this.ball.scale.setScalar(1);
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.boardAnim) {
      const dt = this.boardAnim.last < 0 ? 0 : Math.min(0.05, t - this.boardAnim.last);
      this.boardAnim.last = t;
      this.boardAnim.k += dt / 1.0;
      if (this.boardAnim.k >= 1) this.finishBoard();
      else this.applyBoard(smooth(this.boardAnim.k));
    }
  }

  createSim(): MachineSim {
    if (!this.boltModel || !this.springModel) throw new Error('hoop mission incomplete');
    this.finishBoard();
    this.rim.rotation.z = 0;
    this.applySpring(0);
    this.ball.position.copy(BALL_START);
    this.ball.scale.setScalar(1);
    const plan = buildBouncePlan();
    let time = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const phi = time % PERIOD;
        const th = rimAngle(phi);
        this.rim.rotation.z = th;
        this.applySpring(th);
        this.placeBall(phi, plan);
      },
      getDisplay: () => {
        const phi = time % PERIOD;
        const th = rimAngle(phi);
        const goals = Math.floor(time / PERIOD) + (phi >= GOAL_T ? 1 : 0);
        return [
          { label: '림 꺾임', value: ((Math.abs(th) * 180) / Math.PI).toFixed(1), unit: '°' },
          { label: '스프링 늘어남', value: (springLen(th) * MM_PER_UNIT).toFixed(0), unit: 'mm', tone: 'blue' },
          { label: '골', value: String(goals), unit: '회', tone: 'red' }
        ];
      }
    };
  }

  // ───────────────────────── 조립 연출 ─────────────────────────

  private placeBoardWaiting(): void {
    this.board.position.set(BOARD_X, BOARD_Y - BOARD_DROP, 0);
    this.board.rotation.set(0, 0, BOARD_TILT);
  }

  private applyBoard(k: number): void {
    this.board.position.set(BOARD_X, THREE.MathUtils.lerp(BOARD_Y - BOARD_DROP, BOARD_Y, k), 0);
    this.board.rotation.z = THREE.MathUtils.lerp(BOARD_TILT, 0, k);
  }

  private finishBoard(): void {
    this.boardAnim = null;
    this.board.position.set(BOARD_X, BOARD_Y, 0);
    this.board.rotation.set(0, 0, 0);
    if (!this.springModel) this.showSlot(1);
  }

  /** 스프링 코일을 두 고정점 사이 거리에 맞춰 늘리고 준다(길이 = 거리 → scale.y) */
  private applySpring(theta: number): void {
    const coil = this.coil;
    if (!coil) return;
    const top = springTop(theta);
    const dir = top.sub(SPRING_A);
    const len = Math.max(0.05, dir.length());
    dir.divideScalar(len);
    coil.position.copy(SPRING_A).addScaledVector(dir, len / 2);
    coil.quaternion.setFromUnitVectors(UP, dir);
    coil.scale.y = len / SPRING_NAT;
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** ① 볼트와 너트 4개 — 백보드 뒤 (BOLT_X, 3.5±0.35, ±0.5). 무리 중심을 원점으로 만든다 */
  private buildBolts(): THREE.Group {
    const g = new THREE.Group();
    const mat = steel();
    const dark = darkSteel();
    const shankGeo = new THREE.CylinderGeometry(BOLT_R, BOLT_R, BOLT_LEN, 24);
    const headGeo = new THREE.CylinderGeometry(BOLT_HEAD_R, BOLT_HEAD_R, BOLT_HEAD_L, 6); // 육각 머리
    const nutGeo = new THREE.CylinderGeometry(BOLT_NUT_R, BOLT_NUT_R, BOLT_NUT_L, 6); // 육각 너트
    const washerGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.008, 24);
    for (const geo of [shankGeo, headGeo, nutGeo, washerGeo]) geo.rotateZ(Math.PI / 2); // 축을 X방향으로
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const b = new THREE.Group();
        const washer = new THREE.Mesh(washerGeo, dark);
        washer.position.x = -0.006; // 판 뒷면에 밀착
        const nut = new THREE.Mesh(nutGeo, mat);
        nut.position.x = -0.026;
        const shank = new THREE.Mesh(shankGeo, mat);
        shank.position.x = -0.042 - BOLT_LEN / 2;
        const head = new THREE.Mesh(headGeo, mat);
        head.position.x = -0.042 - BOLT_LEN - BOLT_HEAD_L / 2 + 0.005;
        b.add(washer, nut, shank, head);
        b.position.set(0, sy * BOLT_DY, sz * BOLT_DZ);
        g.add(b);
      }
    }
    return g;
  }

  /** ② 스프링: 브래킷 아래 고정점과 림 걸이대 사이 압축 코일 — 자리에서 바로 맞춰져 있다 */
  private buildSpring(): THREE.Group {
    const g = new THREE.Group();
    const geo = new THREE.TubeGeometry(new Helix(SPRING_R, SPRING_NAT, SPRING_TURNS), SPRING_TURNS * 24, SPRING_WIRE, 8, false);
    geo.translate(0, -SPRING_NAT / 2, 0); // 코일 중심을 원점으로
    const coil = new THREE.Mesh(geo, paint(CATEGORY_COLORS.control, { roughness: 0.35 }));
    coil.name = 'coil';
    const rest = springLen(0);
    const dir = springTop(0).sub(SPRING_A).normalize();
    coil.position.copy(SPRING_A).addScaledVector(dir, rest / 2);
    coil.quaternion.setFromUnitVectors(UP, dir);
    coil.scale.y = rest / SPRING_NAT;
    g.add(coil);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildBase(): void {
    this.group.add(box(BASE_W, BASE_H, BASE_D, 0.02, plastic(0x23262b, { roughness: 0.7 }), BASE_X, BASE_H / 2, 0));
  }

  private buildPoleArm(): void {
    const mat = darkSteel();
    this.group.add(box(POLE_W, POLE_H, POLE_W, 0.012, mat, POLE_X, POLE_Y, 0));
    this.group.add(box(ARM_L, ARM_H, ARM_D, 0.012, mat, ARM_X, ARM_Y, 0));
  }

  /** 림 브래킷 + 그 아래 스프링 받이 러그 */
  private buildBracket(): void {
    const mat = steel();
    this.group.add(box(BRACKET_W, BRACKET_H, BRACKET_D, 0.01, mat, BRACKET_X, BRACKET_Y, 0));
    this.group.add(box(LUG_W, LUG_H, LUG_D, 0.012, mat, SPRING_A.x, 2.92, 0));
  }

  /** 백보드: 흰 판 + 빨강 테두리 + 안쪽 사각 표시(앞면에 살짝 돌출) */
  private buildBoard(): void {
    const bd = this.board;
    bd.add(new THREE.Mesh(new RoundedBoxGeometry(BOARD_T, BOARD_H, BOARD_W, 2, 0.01), plastic(0xf4f6f8, { roughness: 0.35 })));
    const borMat = paint(0xd8362f, { roughness: 0.4 });
    const bx = BOARD_T / 2 + BOR_D / 2;
    bd.add(box(BOR_D, BOR_T, BOARD_W, 0.006, borMat, bx, BOARD_H / 2 - BOR_T / 2, 0));
    bd.add(box(BOR_D, BOR_T, BOARD_W, 0.006, borMat, bx, -BOARD_H / 2 + BOR_T / 2, 0));
    bd.add(box(BOR_D, BOARD_H - 2 * BOR_T, BOR_T, 0.006, borMat, bx, 0, BOARD_W / 2 - BOR_T / 2));
    bd.add(box(BOR_D, BOARD_H - 2 * BOR_T, BOR_T, 0.006, borMat, bx, 0, -BOARD_W / 2 + BOR_T / 2));
    const sqMat = paint(0xe2571c, { roughness: 0.4 });
    const sx = BOARD_T / 2 + 0.01;
    bd.add(box(0.02, 0.04, SQ_W, 0.004, sqMat, sx, SQ_Y + SQ_H / 2 - 0.02, 0));
    bd.add(box(0.02, 0.04, SQ_W, 0.004, sqMat, sx, SQ_Y - SQ_H / 2 + 0.02, 0));
    bd.add(box(0.02, SQ_H - 0.08, 0.04, 0.004, sqMat, sx, SQ_Y, SQ_W / 2 - 0.02));
    bd.add(box(0.02, SQ_H - 0.08, 0.04, 0.004, sqMat, sx, SQ_Y, -SQ_W / 2 + 0.02));
  }

  /** 림(rimGroup, 원점 = 경첩 Hr): 링 + 경첩 너클 + 스프링 걸이대 + 그물 */
  private buildRim(): void {
    const rim = this.rim;
    rim.position.copy(HR);
    const rimMat = paint(0xe2571c, { roughness: 0.35 });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, RIM_TUBE, 16, 48), rimMat);
    torus.rotation.x = Math.PI / 2; // 수평
    torus.position.x = RIM_R; // 경첩에서 앞으로 +RIM_R
    rim.add(torus);
    const hingeMat = steel();
    const knuckleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.1, 24);
    knuckleGeo.rotateX(Math.PI / 2); // 축을 Z방향으로
    for (const s of [-1, 1]) {
      const knuckle = new THREE.Mesh(knuckleGeo, hingeMat);
      knuckle.position.set(0, 0, s * 0.08);
      rim.add(knuckle);
    }
    // 스프링 걸이대: 브래킷 앞 아래 모서리에서 걸이점(로컬 SPRING_P)까지
    rim.add(new THREE.Mesh(cylBetween(new THREE.Vector3(0, -0.055, 0), new THREE.Vector3(SPRING_P.x, -0.028, 0), 0.016, 24), hingeMat));
    // 그물: 가는 원기둥 12개(위 NET_TOP 아래 NET_BOT, 높이 NET_H) + 고리 2개
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < NET_STRINGS; i++) {
      const a = (i / NET_STRINGS) * Math.PI * 2;
      const top = new THREE.Vector3(RIM_R + Math.cos(a) * NET_TOP, -0.005, Math.sin(a) * NET_TOP);
      const bot = new THREE.Vector3(RIM_R + Math.cos(a) * NET_BOT, -NET_H, Math.sin(a) * NET_BOT);
      parts.push(cylBetween(top, bot, NET_WIRE, 10));
    }
    const netMat = plastic(0xf4f6f8, { roughness: 0.85 });
    rim.add(new THREE.Mesh(merge(parts), netMat));
    for (const [y, k] of [[-0.25, 0.5], [-NET_H + 0.005, 1]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(THREE.MathUtils.lerp(NET_TOP, NET_BOT, k) - 0.02, NET_WIRE, 8, 32), netMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(RIM_R, y, 0);
      rim.add(ring);
    }
  }

  /** 공: 주황 구 + 검은 십자 이음선. 처음엔 바닥에 대기 */
  private buildBall(): void {
    this.ball.add(new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), plastic(0xd9742b, { roughness: 0.6 })));
    const seamGeo = new THREE.TorusGeometry(BALL_R, 0.011, 8, 48);
    const seamMat = plastic(0x241d18, { roughness: 0.85 });
    const s1 = new THREE.Mesh(seamGeo, seamMat);
    s1.rotation.x = Math.PI / 2;
    const s2 = new THREE.Mesh(seamGeo, seamMat);
    s2.rotation.y = Math.PI / 2;
    const s3 = new THREE.Mesh(seamGeo, seamMat);
    this.ball.add(s1, s2, s3);
    this.ball.position.copy(BALL_START);
    this.group.add(this.ball);
  }

  // ───────────────────────── 공 운동 ─────────────────────────

  /** 주기 위상 phi에서 공 위치(포물선 비행 → 그물 통과 → 낙하·바운스)와 이음매 페이드 */
  private placeBall(phi: number, plan: BouncePlan): void {
    const p = this.ball.position;
    if (phi < T_FLIGHT) {
      // 포물선: 수평은 직선, 수직은 y = y0 + v0·t − ½g·t²
      const u = phi / T_FLIGHT;
      p.set(
        THREE.MathUtils.lerp(BALL_START.x, HR.x + RIM_R, u),
        BALL_START.y + VY0 * phi - 0.5 * G * phi * phi,
        THREE.MathUtils.lerp(BALL_START.z, 0, u)
      );
    } else if (phi < T_DUNK) {
      // 그물이 공을 늦추며 통과
      const u = (phi - T_FLIGHT) / (T_DUNK - T_FLIGHT);
      p.set(HR.x + RIM_R, THREE.MathUtils.lerp(NET_ENTER_Y, NET_EXIT_Y, u), 0);
    } else {
      const tau = phi - T_DUNK;
      if (tau >= plan.restT) {
        p.set(plan.restX, BALL_R, 0);
      } else {
        const seg = plan.segs.find((sg) => tau >= sg.t0 && tau < sg.t1) ?? plan.segs[plan.segs.length - 1]!;
        const u = tau - seg.t0;
        p.set(seg.x0 + seg.vx * u, seg.y0 + seg.vy0 * u - 0.5 * G * u * u, 0);
      }
    }
    // 반복 이음매: 대기 자리에서 페이드 아웃 → 시작 자리에서 페이드 인
    let s = 1;
    if (phi > PERIOD - SEAM) s = 1 - smooth((phi - (PERIOD - SEAM)) / SEAM);
    else if (phi < SEAM) s = smooth(phi / SEAM);
    this.ball.scale.setScalar(Math.max(0.001, s));
  }
}
