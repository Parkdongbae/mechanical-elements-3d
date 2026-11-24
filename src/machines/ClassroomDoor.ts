// 교실 문: 평행 핀(경첩 핀)과 스프링(도어 클로저) 미션 — 문짝이 처음에 문틀에서 떨어져 벽에 기대어 있다.
// ① 경첩 너클 안의 평행 핀 2개(회전 중심) → 문이 제자리에 걸린다(문이 기울어진 자세에서 닫힌 자세로).
// ② 도어 클로저 몸통(ghost) 속 압축 스프링 — 문이 열리면 스프링이 눌리고, 되돌리며 문을 천천히 닫는다.
// 클로저 팔은 2절 링크: 몸통 축 A와 문 고정점 C에서 반지름 L1·L2 두 원의 교점으로 관절 B를 푼다(막대 길이 불변).
// 좌표: 바닥 y=0, +X 오른쪽, +Z 화면 앞. 경첩 축선 x=-0.65, z=0.1.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, darkSteel, glass, ghost, paint, plastic, steel, wood } from '../models/materials';
import { extrude, lathe, rodProfile, TAU } from '../models/parts/geom';

// ── 설계표 5-5 고정 치수 ──
const WALL_W = 3.2, WALL_H = 3.0, WALL_T = 0.2;
const HOLE_W = 1.3, HOLE_H = 2.6; // 문 구멍
const HX = -0.65, HZ = 0.1; // 경첩 축선(구멍 왼쪽 끝)
const FLOOR_W = 3.6, FLOOR_H = 0.04, FLOOR_D = 2.4, FLOOR_Z = 0.25;
const FR_T = 0.06, FR_W = 0.09; // 문틀 두께·폭
const HINGE_YS = [0.5, 2.1]; // 경첩 높이
const KN_R = 0.03, KN_H = 0.28; // 너클
const LEAF_L = 0.1, LEAF_H = 0.28, LEAF_T = 0.02; // 경첩 잎
const DOOR_W = 1.28, DOOR_H = 2.56, DOOR_T = 0.07; // 문짝
const WIN_W = 0.5, WIN_H = 0.8, WIN_X = 0.74, WIN_Y = 1.85; // 유리창
const HND_X = 1.15, HND_Y = 1.2; // 손잡이(문 양면 ±Z)
const PIN_R = 0.022, PIN_LEN = 0.34; // 평행 핀
const CLS_POS = new THREE.Vector3(-0.2, 2.72, 0.16); // 클로저 몸통 중심
const CLS_W = 0.5, CLS_H = 0.12, CLS_D = 0.1;
const ARM_A = new THREE.Vector3(-0.35, 2.72, 0.2); // 몸통 축(고정)
const ARM_C_LOCAL = new THREE.Vector3(0.55, 2.5, 0.06); // 문 고정점(doorGroup 로컬)
const ARM_L1 = 0.5, ARM_L2 = 0.5; // 팔 2절 길이
const SPR_R = 0.04, SPR_COIL = 0.008, SPR_TURNS = 8; // 스프링 코일
const SPR_LEN0 = 0.4, SPR_STROKE = 0.25; // 길이 = 0.4 − 0.25·열림비율
const OPEN_MAX = 1.3; // 최대 열림각 (rad)
const PERIOD = 6, OPEN_T = 1.5, HOLD_END = 2.5; // 0~1.5 열림 · 1.5~2.5 유지 · 2.5~5.5 닫힘
const WAIT_OFF = new THREE.Vector3(0.2, 0, 0.35); // 설치 전 문 오프셋(앞·옆)
const WAIT_ROTY = 0.5; // 설치 전 기울어진 자세
const MM_PER_UNIT = 350; // 1단위 ≈ 0.35 m

const DOOR_POS = new THREE.Vector3(HX, 0, HZ);
const WAIT_POS = DOOR_POS.clone().add(WAIT_OFF);
const UP = new THREE.Vector3(0, 1, 0);

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

function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
}

/** 두 점 사이에 단위 길이 원기둥을 늘여 놓는다(팔 링크용) */
function stretch(o: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = b.clone().sub(a);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.scale.set(1, d.length(), 1);
  o.quaternion.setFromUnitVectors(UP, d.normalize());
}

export class ClassroomDoor extends BaseMachine {
  readonly id = 'door';
  /** 문짝: 원점 = 경첩 축선 바닥 (HX, 0, HZ) */
  private door = new THREE.Group();
  private pinModel: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private pinHeads: THREE.Group[] = []; // 핀 낙하 애니메이션용
  private coil: THREE.Mesh | null = null;
  private plates: THREE.Mesh[] = []; // 스프링 양끝 받침
  private arm1: THREE.Mesh | null = null;
  private arm2: THREE.Mesh | null = null;
  private elbow: THREE.Mesh | null = null;
  private mount: { k: number; last: number } | null = null;
  private hung = false;

  constructor() {
    super();
    this.buildFloor();
    this.buildWall();
    this.buildFrame();
    this.buildHinges();
    this.buildCloser();
    this.buildDoor();
    this.group.add(this.door);
    this.placeDoorWaiting();

    this.addSlot(0, 0.1, new THREE.Vector3(HX, HINGE_YS[1]!, HZ), 0.018);
    this.slots[0]!.rotation.x = Math.PI / 2; // 수평 링
    this.addSlot(1, 0.16, new THREE.Vector3(-0.2, 2.72, 0.3), 0.02);
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
    return step === 0 ? this.pinModel !== null : this.springModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(HX, 2.45, HZ) : new THREE.Vector3(-0.2, 2.95, 0.25);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(HX, HINGE_YS[1]!, HZ) : new THREE.Vector3(-0.2, 2.72, 0.3);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildPins() : this.buildSpring();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      this.group.add(model);
      this.pinModel = model;
      this.hideSlot(0);
      // 핀이 위에서 낙하 → 문이 기대어 있던 자세에서 제자리로
      this.mount = { k: 0, last: -1 };
    } else {
      this.finishMount();
      this.group.add(model);
      this.springModel = model;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.pinModel) this.group.remove(this.pinModel);
    if (this.springModel) this.group.remove(this.springModel);
    this.pinModel = this.springModel = null;
    this.pinHeads = [];
    this.coil = null;
    this.plates = [];
    this.mount = null;
    this.hung = false;
    if (this.arm1 && this.arm2 && this.elbow) {
      this.arm1.visible = this.arm2.visible = this.elbow.visible = false;
    }
    this.placeDoorWaiting();
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.mount) {
      const dt = this.mount.last < 0 ? 0 : Math.min(0.05, t - this.mount.last);
      this.mount.last = t;
      this.mount.k += dt / 1.8;
      if (this.mount.k >= 1) this.finishMount();
      else this.applyMount(this.mount.k);
    }
  }

  createSim(): MachineSim {
    if (!this.pinModel || !this.springModel) throw new Error('door mission incomplete');
    this.finishMount();
    let time = 0;
    let ratio = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const u = time % PERIOD;
        // 열림비율: 0~1.5s 부드럽게 열림 → 유지 → 2.5~5.5s 감속하며 닫힘(도어 클로저)
        if (u < OPEN_T) ratio = smooth(u / OPEN_T);
        else if (u < HOLD_END) ratio = 1;
        else {
          const v = (u - HOLD_END) / (PERIOD - HOLD_END);
          ratio = (1 - v) * (1 - v);
        }
        this.door.rotation.y = -OPEN_MAX * ratio; // 문이 +Z(화면 앞)로 열린다
        this.applySpring(ratio);
        this.updateArms();
      },
      getDisplay: () => {
        const deg = (OPEN_MAX * ratio * 180) / Math.PI;
        const len = SPR_LEN0 - SPR_STROKE * ratio;
        const u = time % PERIOD;
        let state = '닫힘';
        let tone: 'default' | 'red' | 'blue' = 'default';
        if (u < OPEN_T) {
          state = '여는 중';
          tone = 'blue';
        } else if (u < HOLD_END) {
          state = '열림';
          tone = 'red';
        } else if (ratio > 0.02) {
          state = '닫히는 중';
        }
        return [
          { label: '문 열림', value: deg.toFixed(0), unit: '°' },
          { label: '스프링 길이', value: (len * MM_PER_UNIT).toFixed(0), unit: 'mm', tone: 'blue' },
          { label: '상태', value: state, tone }
        ];
      }
    };
  }

  // ───────────────────────── 조립 연출 ─────────────────────────

  private placeDoorWaiting(): void {
    this.hung = false;
    this.door.position.copy(WAIT_POS);
    this.door.rotation.set(0, WAIT_ROTY, 0);
  }

  /** k 0~0.35: 핀 낙하, 0.35~1: 문이 제자리로 접힌다 */
  private applyMount(k: number): void {
    const drop = (1 - smooth(k / 0.35)) * 0.4;
    this.pinHeads.forEach((p, i) => {
      p.position.y = HINGE_YS[i]! + drop;
    });
    const mv = smooth((k - 0.35) / 0.65);
    this.door.position.lerpVectors(WAIT_POS, DOOR_POS, mv);
    this.door.rotation.y = WAIT_ROTY * (1 - mv);
  }

  private finishMount(): void {
    this.mount = null;
    if (this.hung) return;
    this.hung = true;
    this.door.position.copy(DOOR_POS);
    this.door.rotation.set(0, 0, 0);
    this.pinHeads.forEach((p, i) => {
      p.position.y = HINGE_YS[i]!;
    });
    if (this.arm1 && this.arm2 && this.elbow) {
      this.arm1.visible = this.arm2.visible = this.elbow.visible = true;
      this.updateArms();
    }
    if (!this.springModel) this.showSlot(1); // 다음 단계(스프링) 슬롯 표시
  }

  /** 스프링 길이 = 0.4 − 0.25·열림비율 → scale.x */
  private applySpring(ratio: number): void {
    const len = SPR_LEN0 - SPR_STROKE * ratio;
    if (this.coil) {
      this.coil.scale.x = len;
      this.coil.position.x = -len / 2;
    }
    const half = Math.max(0.01, len / 2 - 0.008);
    for (const p of this.plates) p.position.x = p.userData.end === 1 ? half : -half;
  }

  /** 클로저 팔: A(고정)–B(관절)–C(문 고정점), |AB|=|BC|=L — 두 원의 교점에서 B(위쪽 해) */
  private updateArms(): void {
    if (!this.arm1 || !this.arm2 || !this.elbow) return;
    const c = ARM_C_LOCAL.clone().applyAxisAngle(UP, this.door.rotation.y).add(this.door.position);
    const a = ARM_A;
    const reach = ARM_L1 + ARM_L2; // 팔이 닿는 최대 거리(가드용 — 실제 최대 0.54 로 도달하지 않음)
    const dist = Math.min(a.distanceTo(c), reach - 0.002);
    const mid = a.clone().add(c).multiplyScalar(0.5);
    const h = Math.sqrt(Math.max(0.0001, ARM_L1 * ARM_L1 - (dist * dist) / 4));
    const u = c.clone().sub(a).normalize();
    const n = UP.clone().addScaledVector(u, -u.y).normalize(); // A–C에 수직·위쪽 방향
    const b = mid.addScaledVector(n, h);
    stretch(this.arm1, a, b);
    stretch(this.arm2, b, c);
    this.elbow.position.copy(b);
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** ① 평행 핀 2개: 경첩 너클에 들어가는 Y축 원기둥 + 머리 캡(결합 강조색) */
  private buildPins(): THREE.Group {
    const g = new THREE.Group();
    const mat = steel({ roughness: 0.28 });
    const capMat = paint(CATEGORY_COLORS.joining, { roughness: 0.35 });
    for (const hy of HINGE_YS) {
      const p = new THREE.Group();
      p.position.set(HX, hy, HZ);
      p.add(new THREE.Mesh(lathe(rodProfile(PIN_R, -PIN_LEN / 2, PIN_LEN / 2, 0.005, 0.005), 24), mat));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.02, 24), capMat);
      cap.position.y = PIN_LEN / 2 + 0.01;
      p.add(cap);
      g.add(p);
      this.pinHeads.push(p);
    }
    return g;
  }

  /** ② 스프링: 클로저 몸통 안 압축 코일(X축), 지오메트리 축 길이 1 → scale.x 로 압축 */
  private buildSpring(): THREE.Group {
    const g = new THREE.Group();
    const pts: THREE.Vector3[] = [];
    const n = SPR_TURNS * 28;
    for (let i = 0; i <= n; i++) {
      const uu = i / n;
      const a = uu * SPR_TURNS * TAU;
      pts.push(new THREE.Vector3(uu, Math.cos(a) * SPR_R, Math.sin(a) * SPR_R));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const coil = new THREE.Mesh(
      new THREE.TubeGeometry(curve, n * 2, SPR_COIL, 8, false),
      paint(CATEGORY_COLORS.control, { roughness: 0.3, metalness: 0.5 })
    );
    coil.position.x = -SPR_LEN0 / 2;
    coil.scale.x = SPR_LEN0;
    this.coil = coil;
    g.add(coil);
    const plateMat = steel({ roughness: 0.35 });
    for (const e of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 24), plateMat);
      plate.rotation.z = Math.PI / 2; // 축 → X
      plate.userData.end = e;
      this.plates.push(plate);
      g.add(plate);
    }
    this.applySpring(0);
    g.position.copy(CLS_POS);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildFloor(): void {
    this.group.add(rbox(FLOOR_W, FLOOR_H, FLOOR_D, 0.008, wood(0x9c6b3e), 0, FLOOR_H / 2, FLOOR_Z));
  }

  /** 벽 조각: 3.2×3.0 판에서 문 구멍(1.3×2.6)을 뺀 3장 */
  private buildWall(): void {
    const mat = plastic(0xe9e4d8, { roughness: 0.8 });
    const sideW = (WALL_W - HOLE_W) / 2; // 0.95
    const cx = HOLE_W / 2 + sideW / 2; // 1.125
    this.group.add(rbox(sideW, WALL_H, WALL_T, 0.012, mat, -cx, WALL_H / 2, 0));
    this.group.add(rbox(sideW, WALL_H, WALL_T, 0.012, mat, cx, WALL_H / 2, 0));
    this.group.add(rbox(HOLE_W, WALL_H - HOLE_H, WALL_T, 0.012, mat, 0, HOLE_H + (WALL_H - HOLE_H) / 2, 0));
  }

  /** 문틀: 문구멍을 감싸는 얇은 상자 3개 */
  private buildFrame(): void {
    const mat = wood(0x8a5a33);
    const z = HZ + FR_T / 2;
    const jx = HOLE_W / 2 + FR_W / 2;
    this.group.add(rbox(FR_W, HOLE_H, FR_T, 0.008, mat, -jx, HOLE_H / 2, z));
    this.group.add(rbox(FR_W, HOLE_H, FR_T, 0.008, mat, jx, HOLE_H / 2, z));
    this.group.add(rbox(HOLE_W + FR_W * 2, FR_W, FR_T, 0.008, mat, 0, HOLE_H + FR_W / 2, z));
  }

  /** 경첩: 너클(틀 쪽, 고정) + 틀 잎 + 문 잎(문과 함께 회전) */
  private buildHinges(): void {
    const mat = steel({ roughness: 0.3 });
    for (const hy of HINGE_YS) {
      const knuckle = new THREE.Mesh(lathe(rodProfile(KN_R, -KN_H / 2, KN_H / 2, 0.006, 0.006), 24), mat);
      knuckle.position.set(HX, hy, HZ);
      this.group.add(knuckle);
      this.group.add(rbox(LEAF_L, LEAF_H, LEAF_T, 0.004, mat, HX - LEAF_L / 2, hy, HZ + 0.01));
    }
  }

  /** 도어 클로저: ghost 몸통 + 알루미늄 뚜껑 + 2절 팔(문 설치 후 표시) */
  private buildCloser(): void {
    const g = this.group;
    g.add(rbox(CLS_W, CLS_H, CLS_D, 0.015, ghost(0xaab7c4, 0.4), CLS_POS.x, CLS_POS.y, CLS_POS.z));
    const capMat = aluminum();
    for (const e of [-1, 1]) {
      g.add(rbox(0.05, CLS_H + 0.012, CLS_D + 0.012, 0.01, capMat, CLS_POS.x + e * (CLS_W / 2 - 0.025), CLS_POS.y, CLS_POS.z));
    }
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 24), capMat);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(ARM_A.x, ARM_A.y, ARM_A.z + 0.02);
    g.add(boss);
    const armMat = aluminum();
    const jointMat = steel({ roughness: 0.3 });
    this.arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 24), armMat);
    this.arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 24), armMat);
    this.elbow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), jointMat);
    this.arm1.visible = this.arm2.visible = this.elbow.visible = false;
    g.add(this.arm1, this.arm2, this.elbow);
  }

  /** 문짝(doorGroup): 구멍 뚫린 판넬 + 유리창 + 손잡이 양면 + 문 쪽 경첩 잎 + 팔 고정점 */
  private buildDoor(): void {
    const g = this.door;
    // 판넬: 유리창 구멍을 뚫어 압출(모따기)
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(DOOR_W, 0);
    s.lineTo(DOOR_W, DOOR_H);
    s.lineTo(0, DOOR_H);
    s.closePath();
    const hw = WIN_W / 2, hh = WIN_H / 2;
    const hole = new THREE.Path();
    hole.moveTo(WIN_X - hw, WIN_Y - hh);
    hole.lineTo(WIN_X - hw, WIN_Y + hh);
    hole.lineTo(WIN_X + hw, WIN_Y + hh);
    hole.lineTo(WIN_X + hw, WIN_Y - hh);
    hole.closePath();
    s.holes.push(hole);
    g.add(new THREE.Mesh(extrude(s, DOOR_T, 0.008), wood(0xb98552)));
    // 유리창 + 알루미늄 창틀
    const win = new THREE.Mesh(new THREE.BoxGeometry(WIN_W, WIN_H, 0.02), glass());
    win.position.set(WIN_X, WIN_Y, 0);
    g.add(win);
    const trim = aluminum();
    g.add(rbox(WIN_W + 0.06, 0.03, 0.09, 0.005, trim, WIN_X, WIN_Y + hh + 0.015, 0));
    g.add(rbox(WIN_W + 0.06, 0.03, 0.09, 0.005, trim, WIN_X, WIN_Y - hh - 0.015, 0));
    g.add(rbox(0.03, WIN_H + 0.06, 0.09, 0.005, trim, WIN_X - hw - 0.015, WIN_Y, 0));
    g.add(rbox(0.03, WIN_H + 0.06, 0.09, 0.005, trim, WIN_X + hw + 0.015, WIN_Y, 0));
    // 레버 손잡이 양면
    const roseMat = darkSteel({ roughness: 0.35 });
    const leverMat = steel({ roughness: 0.3 });
    for (const sz of [1, -1]) {
      const face = DOOR_T / 2;
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 24), roseMat);
      rose.rotation.x = Math.PI / 2;
      rose.position.set(HND_X, HND_Y, sz * (face + 0.007));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.036, 16), leverMat);
      neck.rotation.x = Math.PI / 2;
      neck.position.set(HND_X, HND_Y, sz * (face + 0.03));
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.15, 16), leverMat);
      lever.rotation.z = Math.PI / 2;
      lever.position.set(HND_X - 0.095, HND_Y, sz * (face + 0.05));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), roseMat);
      knob.position.set(HND_X - 0.17, HND_Y, sz * (face + 0.05));
      g.add(rose, neck, lever, knob);
    }
    // 문 쪽 경첩 잎 2개(문과 함께 회전)
    const hingeMat = steel({ roughness: 0.3 });
    for (const hy of HINGE_YS) {
      g.add(rbox(LEAF_L, LEAF_H, LEAF_T, 0.004, hingeMat, LEAF_L / 2, hy, DOOR_T / 2 + 0.01));
    }
    // 클로저 팔 고정점 브래킷 + 관절 구
    const c = ARM_C_LOCAL;
    g.add(rbox(0.09, 0.1, 0.045, 0.008, aluminum(), c.x, c.y, c.z - 0.01));
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.028, 20, 14), hingeMat);
    joint.position.copy(c);
    g.add(joint);
  }
}
