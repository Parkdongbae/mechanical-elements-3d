// 시소: 차축과 스프링 미션 — 작업 지시서 14 · 설계표 5-3 그대로 구현.
// 차축은 받침대 브래킷 두 판에 끼워 몸체에 고정되어 돌지 않고(축용),
// 널빤지 가운데 청동 부싱이 축 위에서 돈다. 스프링은 널빤지 양끝과
// 바닥 완충 타이어 사이에서 눌렸다 늘어나며 충격을 줄인다.
// 좌표: +X 오른쪽, 바닥 y=0, 널빤지 회전축 = Z(카메라 쪽).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, bronze, darkSteel, paint, rubber, steel, wood } from '../models/materials';
import { circlePath, extrude, lathe, rodProfile, type V2 } from '../models/parts/geom';

// ── 설계표 5-3 고정 치수 ──
const MAT_R = 2.6; // 바닥 매트 반지름
const MAT_H = 0.04; // 매트 두께
const MAT_TOP = MAT_H; // 매트 윗면 높이
const P_Y = 0.8; // 꼭대기 축 구멕 위치 P = (0, 0.8, 0)
const BRACKET_BASE = 0.9; // 받침대 삼각형 밑변
const BRACKET_H = 0.8; // 받침대 높이(구멍까지)
const BRACKET_T = 0.05; // 받침대 판 두께
const BRACKET_Z = 0.2; // 받침대 판 z 위치
const BOSS_R = 0.13; // 꼭대기 보스(구멍 둘레) 반지름
const BORE_R = 0.048; // 축 구멍 반지름
const BOARD_LEN = 4.4; // 널빤지 길이
const BOARD_T = 0.09; // 널빤지 두께
const BOARD_W = 0.42; // 널빤지 폭
const BOARD_Y = 0.06; // 널빤지 중심(보드 그룹 원점 = P 기준)
const BOARD_TOP = BOARD_Y + BOARD_T / 2;
const BOARD_BOTTOM = BOARD_Y - BOARD_T / 2;
const SLAB_W = 2 * (BRACKET_Z - BRACKET_T / 2 - 0.005); // 브래킷 두 판 사이로 지나가는 중앙부 폭
const SLAB_X = 0.3; // 중앙부 반길이(밖부터는 전체 폭)
const STRIP_L = BOARD_LEN / 2 - SLAB_X; // 양옆 판 길이
const GROOVE_R = 0.056; // 부싱 홈 반지름
const LINER_IN = 0.048; // 부싱 안지름(차축보다 살짝 큼)
const LINER_OUT = 0.054; // 부싱 바깥지름
const LINER_HALF = SLAB_W / 2; // 부싱 반길이
const AXLE_R = 0.045; // 차축 반지름
const AXLE_LEN = 0.6; // 차축 길이
const CAP_R = 0.062; // 차축 양끝 캡 반지름
const CAP_L = 0.04; // 캡 길이
const END_X = 1.9; // 널빤지 양끝 아래(스프링·타이어 x 위치)
const TIRE_R = 0.22; // 완충 타이어 반지름
const TIRE_TUBE = 0.09; // 타이어 관 반지름
const SPRING_R = 0.12; // 스프링 코일 반지름
const SPRING_TURNS = 6; // 감은 수
const SPRING_WIRE = 0.024; // 선 반지름
const SPRING_FREE = 0.78; // 자연 길이
const SPRING_MIN = 0.12; // 최소 길이 제한
const SEAT_X = 1.7; // 좌석 중심(양끝에서 0.5 안쪽)
const SEAT_L = 0.5;
const SEAT_T = 0.04;
const SEAT_W = 0.4;
const HANDLE_X = 1.42; // 손잡이(좌석 안쪽 끝)
const HANDLE_H = 0.32;
const HANDLE_Z = 0.15;
const MM_PER_UNIT = 350; // 표시 mm 환산(1단위 ≈ 0.35m)
const THETA_AMP = 0.2; // 동작 진폭(rad)
const PERIOD = 4; // 동작 주기(s)
const MOUNT_DUR = 1.5; // 널빤지 장착 연출 시간
const SPRING_DUR = 0.7; // 스프링 장착 연출 시간
const LIFT_Y = 1.08; // 널빤지 옮길 때 들어 올리는 높이(브래킷 꼭대기 위)
const BOARD_WAIT = new THREE.Vector3(0, MAT_TOP + LINER_OUT, -0.9); // 설치 전 대기(부싱이 매트에 닿음, y≈0.1)
const BOARD_WAIT_YAW = 0.12; // 대기할 때 살짝 비틀어 둔 각도

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** (r, y) 프로파일을 Y축으로 회전한 뒤 Z축 방향으로 눕힌다. 부분 회전(phi) 가능 */
function latheZ(p: V2[], seg = 48, phiStart = 0, phiLength = Math.PI * 2): THREE.BufferGeometry {
  const g = lathe(p, seg, phiStart, phiLength);
  g.rotateX(Math.PI / 2);
  return g;
}

function box(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
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

/** 나선(코일 스프링 중심선) — 로컬 Y축, y 0~h */
class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private h: number, private turns: number) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(this.r * Math.cos(a), t * this.h, this.r * Math.sin(a));
  }
}

export class Seesaw extends BaseMachine {
  readonly id = 'seesaw';
  /** 널빤지(원점 = 차축 중심 P). 기울임·이동은 이 그룹에만 준다 */
  private board = new THREE.Group();
  private axleModel: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private springMeshes: THREE.Mesh[] = []; // [왼쪽, 오른쪽]
  private mount: { k: number; last: number } | null = null;
  private springAnim: { k: number; last: number } | null = null;

  constructor() {
    super();
    this.buildMat();
    this.buildBrackets();
    this.buildBoard();
    this.buildTires();
    this.group.add(this.board);
    this.placeBoardWaiting();
    // 슬롯: ① 차축(위치 P, 링이 Z축 방향) ② 스프링(오른쪽 자리, 수평 링)
    this.addSlot(0, 0.14, new THREE.Vector3(0, P_Y, 0), 0.018);
    this.addSlot(1, 0.2, new THREE.Vector3(END_X, 0.35, 0), 0.022);
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
    return step === 0 ? this.axleModel !== null : this.springModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, P_Y, 0) : new THREE.Vector3(END_X, 0.35, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, P_Y, 0.4) : new THREE.Vector3(END_X, 0.35, 0.3);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildAxle() : this.buildSprings();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      this.axleModel = model;
      this.hideSlot(0);
      // 바닥에 누워 있던 널빤지가 차축 위로 날아와 내려앉는다
      this.mount = { k: 0, last: -1 };
    } else {
      this.finishMount();
      this.springModel = model;
      this.springMeshes = [];
      model.traverse((o) => {
        if (o instanceof THREE.Mesh && o.name === 'coil') this.springMeshes.push(o);
      });
      this.hideSlot(1);
      // 타이어 안에 웅크린 스프링이 위로 늘어나 널빤지 끝에 닿는다
      this.springAnim = { k: 0, last: -1 };
      this.applySprings(0);
    }
  }

  reset(): void {
    if (this.axleModel) this.group.remove(this.axleModel);
    if (this.springModel) this.group.remove(this.springModel);
    this.axleModel = this.springModel = null;
    this.springMeshes = [];
    this.mount = this.springAnim = null;
    this.placeBoardWaiting();
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.mount) {
      const dt = this.mount.last < 0 ? 0 : Math.min(0.05, t - this.mount.last);
      this.mount.last = t;
      this.mount.k += dt / MOUNT_DUR;
      if (this.mount.k >= 1) this.finishMount();
      else this.applyMount(this.mount.k);
    }
    if (this.springAnim) {
      const dt = this.springAnim.last < 0 ? 0 : Math.min(0.05, t - this.springAnim.last);
      this.springAnim.last = t;
      this.springAnim.k += dt / SPRING_DUR;
      if (this.springAnim.k >= 1) {
        this.applySprings(1);
        this.springAnim = null;
      } else {
        this.applySprings(smooth(this.springAnim.k));
      }
    }
  }

  createSim(): MachineSim {
    if (!this.axleModel || !this.springModel) throw new Error('seesaw mission incomplete');
    this.finishMount();
    let time = 0;
    let theta = 0;
    return {
      update: (dt: number) => {
        time += dt;
        // θ = 0.2·sin(2πt/4) — 널빤지가 차축을 중심으로 오르내린다
        theta = THETA_AMP * Math.sin((time * Math.PI * 2) / PERIOD);
        this.board.rotation.z = theta;
        // 스프링 길이 = 널빤지 끝 아래 높이(정확히 지오메트리에서 계산)
        for (let i = 0; i < this.springMeshes.length; i++) {
          const m = this.springMeshes[i];
          if (!m) continue;
          m.scale.y = this.springLen(i === 0 ? -1 : 1, theta) / SPRING_FREE;
        }
      },
      getDisplay: () => [
        { label: '기울기', value: ((theta * 180) / Math.PI).toFixed(1), unit: '°' },
        { label: '왼쪽 스프링', value: (this.springLen(-1, theta) * MM_PER_UNIT).toFixed(0), unit: 'mm', tone: 'red' },
        { label: '오른쪽 스프링', value: (this.springLen(1, theta) * MM_PER_UNIT).toFixed(0), unit: 'mm', tone: 'blue' }
      ]
    };
  }

  // ───────────────────────── 조립 연출 ─────────────────────────

  private placeBoardWaiting(): void {
    this.board.position.copy(BOARD_WAIT);
    this.board.rotation.set(0, BOARD_WAIT_YAW, 0);
  }

  /** 0~0.25 들어 올림 → 0.25~0.6 브래킷 위를 가로 이동 → 0.6~1 차축 위에 내려앉음(부싱 홈에 축이 들어옴) */
  private applyMount(k: number): void {
    const p = this.board.position;
    if (k < 0.25) {
      const e = smooth(k / 0.25);
      p.set(0, THREE.MathUtils.lerp(BOARD_WAIT.y, LIFT_Y, e), BOARD_WAIT.z);
      this.board.rotation.set(0, BOARD_WAIT_YAW * (1 - e), 0);
    } else if (k < 0.6) {
      const e = smooth((k - 0.25) / 0.35);
      p.set(0, LIFT_Y, THREE.MathUtils.lerp(BOARD_WAIT.z, 0, e));
      this.board.rotation.set(0, 0, 0);
    } else {
      const e = smooth((k - 0.6) / 0.4);
      p.set(0, THREE.MathUtils.lerp(LIFT_Y, P_Y, e), 0);
      // 축에 얹히며 살짝 흔들리는 느낌(부싱 홈은 원이므로 안전)
      this.board.rotation.set(0, 0, 0.06 * Math.sin(Math.PI * e));
    }
  }

  private finishMount(): void {
    this.mount = null;
    if (!this.axleModel) return;
    this.board.position.set(0, P_Y, 0);
    this.board.rotation.set(0, 0, 0);
    if (!this.springModel) this.showSlot(1);
  }

  /** k 0~1: 타이어 안 최소 길이에서 수평 위치의 길이까지 늘어남 */
  private applySprings(k: number): void {
    const len = SPRING_MIN + (this.springLen(1, 0) - SPRING_MIN) * k;
    for (const m of this.springMeshes) m.scale.y = len / SPRING_FREE;
  }

  // ───────────────────────── 기하 계산 ─────────────────────────

  /** 기울기 θ에서 널빤지 아랫면이 world x = s·END_X에 놓이는 높이(링크 불변, 정확히 풂) */
  private plankBottomY(s: number, theta: number): number {
    const u = (s * END_X + BOARD_BOTTOM * Math.sin(theta)) / Math.cos(theta);
    return P_Y + u * Math.sin(theta) + BOARD_BOTTOM * Math.cos(theta);
  }

  private springLen(s: number, theta: number): number {
    return Math.max(SPRING_MIN, this.plankBottomY(s, theta) - MAT_TOP);
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** ① 차축: 받침대 구멍에 끼워 고정되는 축(회전하지 않음) + 양끝 캡 */
  private buildAxle(): THREE.Group {
    const g = new THREE.Group();
    const axle = new THREE.Mesh(latheZ(rodProfile(AXLE_R, -AXLE_LEN / 2, AXLE_LEN / 2, 0.008, 0.008), 40), steel());
    axle.position.set(0, P_Y, 0);
    g.add(axle);
    const capGeo = latheZ(rodProfile(CAP_R, -CAP_L / 2, CAP_L / 2, 0.006, 0.006), 24);
    const capMat = darkSteel();
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0, P_Y, s * (AXLE_LEN / 2 - CAP_L / 2 + 0.005));
      g.add(cap);
    }
    return g;
  }

  /** ② 스프링: 널빤지 양끝 아래 압축 코일 2개 — scale.y로 길이가 변한다 */
  private buildSprings(): THREE.Group {
    const g = new THREE.Group();
    const coilGeo = new THREE.TubeGeometry(
      new Helix(SPRING_R, SPRING_FREE, SPRING_TURNS),
      SPRING_TURNS * 26,
      SPRING_WIRE,
      8,
      false
    );
    const coilMat = paint(CATEGORY_COLORS.control, { roughness: 0.35 });
    for (const s of [-1, 1]) {
      const coil = new THREE.Mesh(coilGeo, coilMat);
      coil.name = 'coil';
      coil.position.set(s * END_X, MAT_TOP, 0);
      coil.scale.y = SPRING_MIN / SPRING_FREE; // 타이어 안에 웅크린 상태로 시작
      g.add(coil);
    }
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildMat(): void {
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(MAT_R, MAT_R, MAT_H, 48), rubber({ color: 0x7fb08a }));
    mat.position.set(0, MAT_H / 2, 0);
    this.group.add(mat);
  }

  /** 받침대: 삼각 브래킷 2장 — 꼭대기 보스에 축 구멍(P) */
  private buildBrackets(): void {
    const half = BRACKET_BASE / 2;
    const d = Math.hypot(half, BRACKET_H); // 밑모서리→구멍 중심 거리
    const phi = Math.acos(BOSS_R / d); // 접선이 나오는 각
    const tA = Math.atan2(-BRACKET_H, half) + phi; // 오른쪽 접점의 각도(구멍 기준)
    const tx = Math.cos(tA) * BOSS_R;
    const ty = P_Y + Math.sin(tA) * BOSS_R;
    const shape = new THREE.Shape();
    shape.moveTo(half, 0);
    shape.lineTo(tx, ty);
    shape.absarc(0, P_Y, BOSS_R, tA, Math.PI - tA, false); // 꼭대기 보스 반원
    shape.lineTo(-half, 0);
    shape.closePath();
    shape.holes.push(circlePath(0, P_Y, BORE_R));
    const geo = extrude(shape, BRACKET_T, 0.005, 24);
    const mat = paint(0x2468c9);
    for (const s of [-1, 1]) {
      const plate = new THREE.Mesh(geo, mat);
      plate.position.set(0, 0, s * BRACKET_Z);
      this.group.add(plate);
    }
  }

  private buildBoard(): void {
    const plankMat = wood();
    // 중앙부: 아랫면에 부싱 홈(원호)을 파고 브래킷 두 판 사이로 지나간다
    const gw = Math.sqrt(GROOVE_R * GROOVE_R - BOARD_BOTTOM * BOARD_BOTTOM);
    const ga = Math.atan2(BOARD_BOTTOM, gw);
    const slab = new THREE.Shape();
    slab.moveTo(-SLAB_X, BOARD_BOTTOM);
    slab.lineTo(-gw, BOARD_BOTTOM);
    slab.absarc(0, 0, GROOVE_R, Math.PI - ga, ga, true); // 아래 홈(시계 방향 오목하게)
    slab.lineTo(SLAB_X, BOARD_BOTTOM);
    slab.lineTo(SLAB_X, BOARD_TOP);
    slab.lineTo(-SLAB_X, BOARD_TOP);
    slab.closePath();
    this.board.add(new THREE.Mesh(extrude(slab, SLAB_W, 0.005, 24), plankMat));
    // 양옆 판: 전체 폭
    for (const s of [-1, 1]) {
      this.board.add(box(STRIP_L, BOARD_T, BOARD_W, 0.01, plankMat, s * (SLAB_X + STRIP_L / 2), BOARD_Y, 0));
    }
    // 청동 부싱(아래 반원만 감싸고 위가 열림 → 차축이 위에서 내려와 끼워진다)
    const c = 0.003;
    const bush: V2[] = [
      [LINER_IN, -LINER_HALF],
      [LINER_OUT - c, -LINER_HALF],
      [LINER_OUT, -LINER_HALF + c],
      [LINER_OUT, LINER_HALF - c],
      [LINER_OUT - c, LINER_HALF],
      [LINER_IN, LINER_HALF],
      [LINER_IN, -LINER_HALF]
    ];
    this.board.add(new THREE.Mesh(latheZ(bush, 32, -Math.PI / 2, Math.PI), bronze()));

    const steelMat = steel();
    for (const s of [-1, 1]) {
      // 손잡이(ㄷ자: 기둥 2 + 가로바 1)
      const hx = s * HANDLE_X;
      for (const hz of [-HANDLE_Z, HANDLE_Z]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, HANDLE_H, 20), steelMat);
        post.position.set(hx, BOARD_TOP + HANDLE_H / 2, hz);
        this.board.add(post);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, HANDLE_Z * 2 + 0.05, 20), steelMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(hx, BOARD_TOP + HANDLE_H - 0.005, 0);
      this.board.add(bar);
      // 좌석 패드(빨강/파랑)
      const pad = new THREE.Mesh(new RoundedBoxGeometry(SEAT_L, SEAT_T, SEAT_W, 2, 0.012), paint(s < 0 ? 0xd8362f : 0x2468c9));
      pad.position.set(s * SEAT_X, BOARD_TOP + SEAT_T / 2, 0);
      this.board.add(pad);
      // 앉은 사람 대신 올린 추(색·크기가 다른 상자)
      const w =
        s < 0
          ? box(0.28, 0.24, 0.3, 0.015, paint(0xf2b619), s * SEAT_X, BOARD_TOP + SEAT_T + 0.12, 0)
          : box(0.32, 0.32, 0.32, 0.015, paint(0x2f9e6b), s * SEAT_X, BOARD_TOP + SEAT_T + 0.16, 0);
      this.board.add(w);
    }
  }

  /** 완충용 고무 타이어 반쪽: 발판이 평평하게 잘린 아치가 바닥에 박혀 스프링을 감싼다 */
  private buildTires(): void {
    const geo = new THREE.TorusGeometry(TIRE_R, TIRE_TUBE, 18, 48, Math.PI);
    const mat = rubber({ color: 0x232529 });
    for (const s of [-1, 1]) {
      const tire = new THREE.Mesh(geo, mat);
      tire.position.set(s * END_X, 0.02, 0);
      this.group.add(tire);
    }
  }
}
