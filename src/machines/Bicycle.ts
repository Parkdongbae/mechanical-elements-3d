// 자전거: 차축 → 크랭크축 → 스프로킷 → 체인 → 평행 핀 → 스프링 → 블록 브레이크 7단계 조립 미션
// 차축 정답 시 양쪽 허브에 축이 먼저 들어가고 바퀴가 자동 장착되며,
// 크랭크축 정답 시 앞 스프로킷(체인링)이 자동 장착된다 — 팝업은 후속 장착까지 끝난 뒤 표시
// 교과서 근거: 차축 = 바퀴 회전축(축용), 스프링(제어용) = 안장 충격 흡수, 블록 브레이크(제어용) = 림을 눌러 멈춤
// 블록 브레이크는 기본 카메라에서 정면으로 보이는 앞 포크 크라운에 단다(뒤 시트스테이 브리지는 시트튜브에 가린다).
// 앞바퀴는 구동과 무관하므로, 완성 후 시연에서 앞바퀴를 손으로 툭 쳐서 돌린 뒤 레버를 쥐어 세운다.
// v2: 다이아몬드 프레임 비례(헤드 72°·시트 73.5°)로 재모델링, 시트포스트를 무는 정비 스탠드에 걸려
//     두 바퀴가 바닥에서 떠 있다(페달을 돌리면 뒷바퀴만 돈다 — 앞바퀴는 구동과 무관하므로 정지).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { gearShape, ChainPath2D, buildChainAlongPath } from '../models/factory';
import { CATEGORY_COLORS, paint, steel, darkSteel, chrome, aluminum, rubber, plastic, glow } from '../models/materials';
import { BaseMachine, type MachineSim, type MachineDisplayItem, type FollowUpPart } from './types';

/** 체인링·뒤 스프로킷 피치원 반지름 — 체인 경로·기어비(1.67)의 기준 */
export const RING_R = 0.45;
export const SPR_R = 0.27;
const RING_TEETH = 30;
const SPR_TEETH = 18; // 30:18 = 0.45:0.27 → 이 피치가 체인 피치와 같다
const CHAIN_PITCH = (Math.PI * 2 * RING_R) / RING_TEETH;

const deg = Math.PI / 180;
const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
const along = (p: THREE.Vector2, d: THREE.Vector2, t: number) => p.clone().addScaledVector(d, t);

// ── 기하 기준점 (XY = 자전거 측면, +Z = 구동측) ──
const WHEEL_R = 1.05; // 타이어 바깥 반지름
const LIFT = 0.3; // 정비 스탠드가 들어 올린 높이
const AXLE_Y = WHEEL_R + LIFT;
const BB = v2(0, AXLE_Y - 0.22);
const FRONT = v2(1.6, AXLE_Y);
const CHAIN_LINKS = 54; // 짝수(안/바깥 링크 교대)
/** 체인 길이가 정확히 CHAIN_LINKS × 피치가 되도록 체인스테이 길이(뒤 차축 x)를 맞춘다 → 롤러가 이골에 앉는다 */
const REAR = (() => {
  const len = (x: number) => new ChainPath2D(x, AXLE_Y, SPR_R, BB.x, BB.y, RING_R).length;
  let lo = -1.6;
  let hi = -1.2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (len(mid) > CHAIN_LINKS * CHAIN_PITCH) lo = mid;
    else hi = mid;
  }
  return v2((lo + hi) / 2, AXLE_Y);
})();
const SEAT_DIR = v2(-Math.cos(73.5 * deg), Math.sin(73.5 * deg));
const HEAD_DIR = v2(-Math.cos(72 * deg), Math.sin(72 * deg));
const HEAD_FWD = v2(HEAD_DIR.y, -HEAD_DIR.x);
const ST_TOP = along(BB, SEAT_DIR, 1.62);
const SEAT_CLUSTER = along(BB, SEAT_DIR, 1.55);
const STEER_BASE = along(FRONT, HEAD_FWD, -0.13); // 포크 오프셋(레이크)
const CROWN = along(STEER_BASE, HEAD_DIR, 1.1);
const HT_BOT = along(CROWN, HEAD_DIR, 0.04);
const HT_TOP = along(HT_BOT, HEAD_DIR, 0.44);
const TT_FRONT = along(HT_BOT, HEAD_DIR, 0.37);
const DT_FRONT = along(HT_BOT, HEAD_DIR, 0.08);
const STEM_C = along(HT_TOP, HEAD_DIR, 0.13);
const STEM_DIR = v2(Math.cos(14 * deg), Math.sin(14 * deg));
const BAR_POS = along(STEM_C, STEM_DIR, 0.3);
const POST_HEAD = along(BB, SEAT_DIR, 1.95);
const STAND_CLAMP = along(BB, SEAT_DIR, 1.79);

const CHAIN_Z = 0.2;
const REAR_DROP_Z = 0.26;
const FRONT_DROP_Z = 0.15;
const CRANK_LEN = 0.5;
const CRANK_Z = 0.29;

// 안장 밑 스프링: 레일 뒤 브리지(아래)와 안장 칸틀 판(위) 사이, 높이 0.14
const RAIL_Y = POST_HEAD.y + 0.03;
const SADDLE_SPRING_POS = new THREE.Vector3(POST_HEAD.x - 0.3, RAIL_Y + 0.085, 0);
const SPRING_H = 0.14;

const CHAIN_PATH = new ChainPath2D(REAR.x, REAR.y, SPR_R, BB.x, BB.y, RING_R);
// 스프로킷 초기 위상: 체인 롤러(호장거리 (k+½)·피치)가 이골(각도 0 + k·step) 중심에 오도록
const SPROCKET_PHASE = (() => {
  const dx = BB.x - REAR.x;
  const dy = BB.y - REAR.y;
  const D = Math.hypot(dx, dy);
  const delta = Math.acos((RING_R - SPR_R) / D);
  const aTop = Math.atan2(dy, dx) + Math.PI - delta;
  const topLen = Math.sqrt(D * D - (RING_R - SPR_R) ** 2);
  return { rear: aTop + (0.5 * CHAIN_PITCH) / SPR_R, front: aTop + (topLen - 0.5 * CHAIN_PITCH) / RING_R };
})();
const CHAIN_PIN_POS = (() => {
  const p = CHAIN_PATH.pointAt(0.62); // 윗줄(장력측) 중간 — 정면에서 잘 보인다
  return new THREE.Vector3(p.x, p.y, CHAIN_Z);
})();

// ── 앞 블록 브레이크(사이드풀 캘리퍼) ──
// 국소 좌표: 원점 = 크라운 앞면의 피벗 볼트 자리, +Y = 허브→피벗 방사 방향, +X = 앞쪽(피벗 볼트 축), Z = 바퀴 축.
// 두 암이 피벗 볼트(X축) 둘레로 돌며 블록을 림 옆면(z = ±RIM_HW)으로 민다.
const BRAKE_M = along(CROWN, HEAD_FWD, 0.08);
const BRAKE_U = BRAKE_M.clone().sub(FRONT).normalize();
const BRAKE_X = v2(BRAKE_U.y, -BRAKE_U.x);
const BRAKE_RM = BRAKE_M.distanceTo(FRONT);
const BRAKE_ROT = Math.atan2(BRAKE_U.y, BRAKE_U.x) - Math.PI / 2;
const RIM_HW = 0.05; // 림 제동면 반폭(바퀴 림 프로파일과 같은 값)
const PAD_T = 0.025; // 블록 중심의 앞뒤 위치
const PAD_Y = Math.sqrt(0.876 ** 2 - PAD_T ** 2) - BRAKE_RM; // 제동면(0.858~0.896, 타이어 비드 아래) 중앙
const PAD_H = 0.034; // 블록 방사 방향 높이
const PAD_THK = 0.02; // 고무 두께
const BRAKE_GAP = 0.018; // 해제 시 블록–림 간격(≈6mm, 화면에서 벌어짐이 읽히도록 실물보다 약간 넓게)
const PAD_FACE_Z = RIM_HW + BRAKE_GAP;
const BARREL_P = { t: 0.048, y: 0.085, z: 0.1 }; // 오른쪽 암 윗탭: 케이블 겉피 받침(배럴)
const ANCHOR_P = { t: 0.05, y: 0.035, z: 0.1 }; // 왼쪽 암 아랫탭: 속케이블 고정 볼트
/** 국소 (y, z)를 피벗 볼트(X축) 둘레로 a만큼 회전 */
function rotX(y: number, z: number, a: number): { y: number; z: number } {
  return { y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) };
}
/** 블록 아래 모서리(가장 먼저 닿는 곳)가 림에 닿는 암 회전각 */
const BRAKE_THETA_C = (() => {
  let lo = 0;
  let hi = 0.3;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (rotX(PAD_Y - PAD_H / 2, PAD_FACE_Z, mid).z > RIM_HW + 0.0005) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();
const BRAKE_THETA_MAX = BRAKE_THETA_C + 0.004; // 고무가 살짝 눌릴 만큼 더
const LEVER_MAX = 0.3; // 레버 최대 당김각(rad)
const LEVER_AXIS = new THREE.Vector3(-0.4, -1, 0).normalize();
const W_NUDGE = Math.PI * 3; // 손으로 툭 친 앞바퀴 초기 각속도(90rpm)
const BRAKE_CYCLE = 8;
function brakeWorld(t: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(BRAKE_M.x + BRAKE_X.x * t + BRAKE_U.x * y, BRAKE_M.y + BRAKE_X.y * t + BRAKE_U.y * y, z);
}
const BRAKE_SLOT_POS = brakeWorld(0.03, -0.09, 0.21); // 포크 다리(z≤0.17)보다 바깥

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

// ── 지오메트리 헬퍼 (병합용: 메시가 아니라 변환된 지오메트리를 돌려준다) ──

const Y_UP = new THREE.Vector3(0, 1, 0);

function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 24, r2 = r): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r2, r, dir.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

function zCyl(r: number, z0: number, z1: number, seg = 32, x = 0, y = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

function ball(p: THREE.Vector3, r: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 24, 16);
  g.translate(p.x, p.y, p.z);
  return g;
}

/** (반지름, z) 프로파일을 Z축 둘레로 회전 */
function latheZ(profile: [number, number][], seg = 48): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 인덱스 유무·속성 차이를 맞춰 하나로 병합 (드로콜 절약) */
function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(n.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') n.deleteAttribute(key);
    }
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position!.count * 2), 2));
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  });
  const merged = mergeGeometries(prepared);
  if (!merged) throw new Error('bicycle: geometry merge failed');
  return merged;
}

const P3 = (p: THREE.Vector2, z = 0) => new THREE.Vector3(p.x, p.y, z);

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, receive = false): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = receive;
  return m;
}

interface BicycleSimState {
  crank: THREE.Object3D;
  rear: THREE.Object3D;
  chainGroup: THREE.Group;
  path: ChainPath2D;
  pin: THREE.Object3D | null;
  pedals: THREE.Object3D[];
  front: THREE.Object3D;
  lever: THREE.Object3D;
  armR: THREE.Object3D;
  armL: THREE.Object3D;
  wire: THREE.Object3D;
}

export class Bicycle extends BaseMachine {
  readonly id = 'bicycle';
  readonly stepCount = 7;
  private brakeModel: THREE.Group | null = null;
  /** 오른쪽(+Z, 앞 브레이크) 레버 날 — 시연 때 쥐어진다 */
  private frontLever = new THREE.Group();
  private sprocketMesh: THREE.Group | null = null;
  private chainGroup: THREE.Group | null = null;
  private crankModel: THREE.Group | null = null;
  private frontSprocketMesh: THREE.Group | null = null;
  private chainPin: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private axleRods: THREE.Object3D[] = [];
  private crank = new THREE.Group();
  private rearWheel = new THREE.Group();
  private frontWheel = new THREE.Group();

  constructor() {
    super();
    this.buildFrame();
    this.buildCockpit();
    this.buildSaddle();
    this.buildStand();
    this.buildWheel(this.rearWheel, REAR, true);
    this.buildWheel(this.frontWheel, FRONT, false);
    this.crank.position.set(BB.x, BB.y, 0);
    this.group.add(this.crank);

    this.addSlot(0, 0.12, new THREE.Vector3(REAR.x, REAR.y, 0));
    // 인덱스 7 = 차축 단계의 둘째(앞바퀴) 링 — 6은 브레이크 단계가 쓴다
    this.addSlot(7, 0.12, new THREE.Vector3(FRONT.x, FRONT.y, 0));
    this.addSlot(1, 0.13, new THREE.Vector3(BB.x, BB.y, 0));
    this.addSlot(2, SPR_R + 0.03, new THREE.Vector3(REAR.x, REAR.y, CHAIN_Z));
    this.addChainSlotOutline();
    this.addSlot(4, 0.08, CHAIN_PIN_POS);
    this.addSlot(5, 0.11, SADDLE_SPRING_POS);
    this.addSlot(6, 0.15, BRAKE_SLOT_POS, 0.02);
    this.hideSlot(1);
    this.hideSlot(2);
    this.hideSlot(3);
    this.hideSlot(4);
    this.hideSlot(5);
    this.hideSlot(6);
    this.enableShadows();
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
    }
  }

  getChainPath(): ChainPath2D {
    return new ChainPath2D(REAR.x, REAR.y, SPR_R, BB.x, BB.y, RING_R);
  }

  isInstalled(step: number): boolean {
    switch (step) {
      case 0: return this.rearWheel.parent === this.group && this.frontWheel.parent === this.group;
      case 1: return this.crankModel !== null && this.frontSprocketMesh !== null;
      case 2: return this.sprocketMesh !== null;
      case 3: return this.chainGroup !== null;
      case 4: return this.chainPin !== null;
      case 5: return this.springModel !== null;
      case 6: return this.brakeModel !== null;
      default: return false;
    }
  }

  getFlyTarget(step: number): THREE.Vector3 {
    switch (step) {
      case 0: return new THREE.Vector3(0, 0, 0);
      case 1: return new THREE.Vector3(BB.x, BB.y, 0);
      case 2: return new THREE.Vector3(REAR.x, REAR.y, CHAIN_Z);
      case 3: return new THREE.Vector3(0, 0, 0);
      case 4: return CHAIN_PIN_POS.clone();
      case 5: return SADDLE_SPRING_POS.clone();
      case 6: return P3(BRAKE_M);
      default: return new THREE.Vector3();
    }
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 6 ? BRAKE_SLOT_POS.clone() : this.getFlyTarget(step);
  }

  buildStepModel(step: number): THREE.Group {
    switch (step) {
      case 0: return this.buildAxlePair();
      case 1: return this.buildCrankShaft();
      case 2: return this.createSprocketModel();
      case 3: return buildChainAlongPath(this.getChainPath(), CHAIN_PITCH, CHAIN_Z);
      case 4: return this.buildChainPin();
      case 5: return this.buildSaddleSpring();
      default: return this.buildBlockBrake();
    }
  }

  getFollowUps(step: number): FollowUpPart[] {
    switch (step) {
      case 0:
        return [
          { model: this.frontWheel, to: new THREE.Vector3(FRONT.x, FRONT.y, 0), noSpin: true },
          { model: this.rearWheel, to: new THREE.Vector3(REAR.x, REAR.y, 0), noSpin: true }
        ];
      case 1:
        return [{ model: this.buildFrontSprocket(), to: new THREE.Vector3(BB.x, BB.y, CHAIN_Z) }];
      default:
        return [];
    }
  }

  installFollowUp(step: number, index: number, model: THREE.Group): void {
    if (step === 0) {
      const pos = index === 0 ? FRONT : REAR;
      model.position.set(pos.x, pos.y, 0);
      model.rotation.set(0, 0, 0);
      this.enableMeshShadows(model);
      this.group.add(model);
      return;
    }
    if (step === 1) {
      model.position.set(0, 0, CHAIN_Z);
      model.rotation.set(0, 0, SPROCKET_PHASE.front);
      this.crank.add(model);
      this.frontSprocketMesh = model;
    }
  }

  installStep(step: number, model: THREE.Group): void {
    switch (step) {
      case 0: {
        this.axleRods = [...model.children];
        for (const rod of this.axleRods) this.group.add(rod);
        model.removeFromParent();
        this.hideSlot(0);
        this.hideSlot(7);
        this.showSlot(1);
        break;
      }
      case 1:
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        this.crank.add(model);
        this.crankModel = model;
        this.hideSlot(1);
        this.showSlot(2);
        break;
      case 2:
        model.position.set(0, 0, CHAIN_Z);
        model.rotation.set(0, 0, SPROCKET_PHASE.rear);
        this.rearWheel.add(model);
        this.sprocketMesh = model;
        this.hideSlot(2);
        this.showSlot(3);
        break;
      case 3:
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        this.group.add(model);
        this.chainGroup = model;
        this.hideSlot(3);
        this.showSlot(4);
        break;
      case 4: {
        model.position.copy(CHAIN_PIN_POS);
        const s = this.nearestChainS(CHAIN_PIN_POS);
        model.rotation.set(0, 0, this.getChainPath().pointAt(s).angle);
        this.group.add(model);
        this.chainPin = model;
        model.userData.s = s;
        this.hideSlot(4);
        this.showSlot(5);
        break;
      }
      case 5:
        model.position.copy(SADDLE_SPRING_POS);
        model.rotation.set(0, 0, 0);
        this.group.add(model);
        this.springModel = model;
        this.hideSlot(5);
        this.showSlot(6);
        break;
      case 6:
        model.position.copy(P3(BRAKE_M));
        model.rotation.set(0, 0, 0);
        this.group.add(model);
        this.brakeModel = model;
        this.hideSlot(6);
        break;
    }
  }

  private enableMeshShadows(root: THREE.Object3D): void {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.slot) m.castShadow = true;
    });
  }

  private nearestChainS(pos: THREE.Vector3): number {
    const path = this.getChainPath();
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < 480; i++) {
      const s = (i / 480) * path.length;
      const p = path.pointAt(s);
      const d = (p.x - pos.x) ** 2 + (p.y - pos.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  reset(): void {
    this.rearWheel.removeFromParent();
    this.frontWheel.removeFromParent();
    this.rearWheel.rotation.set(0, 0, 0);
    this.frontWheel.rotation.set(0, 0, 0);
    for (const rod of this.axleRods) this.group.remove(rod);
    this.axleRods = [];
    this.crank.rotation.set(0, 0, 0);
    if (this.crankModel) {
      this.crank.remove(this.crankModel);
      this.crankModel = null;
    }
    if (this.frontSprocketMesh) {
      this.crank.remove(this.frontSprocketMesh);
      this.frontSprocketMesh = null;
    }
    if (this.sprocketMesh) {
      this.rearWheel.remove(this.sprocketMesh);
      this.sprocketMesh = null;
    }
    if (this.chainGroup) {
      this.group.remove(this.chainGroup);
      this.chainGroup = null;
    }
    if (this.chainPin) {
      this.group.remove(this.chainPin);
      this.chainPin = null;
    }
    if (this.springModel) {
      this.group.remove(this.springModel);
      this.springModel = null;
    }
    if (this.brakeModel) {
      this.group.remove(this.brakeModel);
      this.brakeModel = null;
    }
    this.frontLever.quaternion.identity();
    this.showSlot(0);
    this.showSlot(7);
    this.hideSlot(1);
    this.hideSlot(2);
    this.hideSlot(3);
    this.hideSlot(4);
    this.hideSlot(5);
    this.hideSlot(6);
  }

  createSim(): MachineSim {
    if (!this.chainGroup || !this.sprocketMesh || !this.crankModel || !this.frontSprocketMesh || !this.springModel || !this.brakeModel) throw new Error('bicycle mission incomplete');
    const armR = this.brakeModel.getObjectByName('brakeArmR');
    const armL = this.brakeModel.getObjectByName('brakeArmL');
    const wire = this.brakeModel.getObjectByName('brakeWire');
    if (!armR || !armL || !wire) throw new Error('bicycle brake model broken');
    const pedals: THREE.Object3D[] = [];
    this.crankModel.traverse((o) => {
      if (o.name === 'pedal') pedals.push(o);
    });
    const state: BicycleSimState = {
      crank: this.crank,
      rear: this.rearWheel,
      chainGroup: this.chainGroup,
      path: this.getChainPath(),
      pin: this.chainPin,
      pedals,
      front: this.frontWheel,
      lever: this.frontLever,
      armR,
      armL,
      wire
    };
    let angle = 0;
    let chainOffset = 0;
    // 브레이크 시연(앞바퀴): 구동계 표시값(페달·뒷바퀴·기어비)과 독립
    let bt = 0;
    let wFront = 0;
    let frontAngle = 0;
    const brakeItem: MachineDisplayItem = { label: '브레이크', value: '해제' };
    const display: MachineDisplayItem[] = [
      { label: '페달', value: '60', unit: 'rpm' },
      { label: '뒷바퀴', value: '100', unit: 'rpm', tone: 'red' },
      { label: '기어비', value: '1.67', unit: ': 1', tone: 'blue' },
      brakeItem
    ];
    const pivot = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    return {
      update(dt: number) {
        bt = (bt + dt) % BRAKE_CYCLE;
        // 0~0.5초 앞바퀴를 툭 쳐서 돌림 → 4초 레버를 쥠 → 6.3초 놓음
        const squeeze =
          bt < 4 ? 0 : bt < 4.35 ? smooth01((bt - 4) / 0.35) : bt < 6.3 ? 1 : bt < 6.65 ? 1 - smooth01((bt - 6.3) / 0.35) : 0;
        const theta = squeeze * BRAKE_THETA_MAX;
        const engaged = theta >= BRAKE_THETA_C;
        if (bt < 0.5) wFront = Math.max(wFront, W_NUDGE * smooth01(bt / 0.5));
        else if (engaged) wFront = Math.max(0, wFront - 14 * dt); // 블록 마찰이 림을 세운다
        else wFront *= Math.exp(-0.06 * dt); // 허브 베어링의 작은 저항
        frontAngle -= wFront * dt; // 앞으로 구르는 방향(구동측에서 보아 시계 방향)
        state.front.rotation.z = frontAngle;
        state.armR.rotation.x = theta;
        state.armL.rotation.x = -theta;
        // 레버 당김각은 케이블 당김량(두 탭 사이 거리 감소)에 비례
        state.lever.quaternion.setFromAxisAngle(LEVER_AXIS, LEVER_MAX * (theta / BRAKE_THETA_MAX));
        const pb = rotX(BARREL_P.y, BARREL_P.z, theta);
        const pa = rotX(ANCHOR_P.y, ANCHOR_P.z, -theta);
        a.set(BARREL_P.t, pb.y, pb.z);
        b.set(ANCHOR_P.t, pa.y, pa.z);
        pivot.copy(a).add(b).multiplyScalar(0.5);
        state.wire.position.copy(pivot);
        state.wire.scale.set(1, a.distanceTo(b), 1);
        state.wire.quaternion.setFromUnitVectors(Y_UP, b.sub(a).normalize());
        brakeItem.value = engaged ? '작동' : '해제';
        brakeItem.tone = engaged ? 'red' : 'default';

        const wCrank = Math.PI * 2; // 60rpm
        angle -= wCrank * dt; // 구동측(+Z)에서 보아 시계 방향 = 전진
        state.crank.rotation.z = angle;
        // 페달은 베어링으로 크랭크에 대해 자유 회전 — 발판이 수평을 유지
        for (const p of state.pedals) p.rotation.z = -angle;
        chainOffset += wCrank * RING_R * dt;
        state.rear.rotation.z = angle * (RING_R / SPR_R);
        state.chainGroup.traverse((o) => {
          const s = o.userData.s as number | undefined;
          if (typeof s === 'number') {
            const p = state.path.pointAt(s + chainOffset);
            o.position.set(p.x, p.y, o.position.z);
            o.rotation.z = p.angle;
          }
        });
        if (state.pin) {
          const s = state.pin.userData.s as number | undefined;
          if (typeof s === 'number') {
            const p = state.path.pointAt(s + chainOffset);
            state.pin.position.set(p.x, p.y, CHAIN_PIN_POS.z);
            state.pin.rotation.z = p.angle;
          }
        }
      },
      getDisplay: () => display
    };
  }

  // ─────────────────────────── 조립 부품 ───────────────────────────

  /** 크랭크축(BB 스핀들) + 크랭크 암 2개 + 페달 2개 */
  private buildCrankShaft(): THREE.Group {
    const g = new THREE.Group();
    g.add(mesh(zCyl(0.034, -CRANK_Z - 0.03, CRANK_Z + 0.03, 24), steel()));

    // 테이퍼진 크랭크 암 (단조 알루미늄 느낌)
    const armShape = new THREE.Shape();
    armShape.moveTo(0, 0.068);
    armShape.lineTo(CRANK_LEN, 0.04);
    armShape.absarc(CRANK_LEN, 0, 0.04, Math.PI / 2, -Math.PI / 2, true);
    armShape.lineTo(0, -0.068);
    armShape.absarc(0, 0, 0.068, -Math.PI / 2, Math.PI / 2, true);
    const armGeo = new THREE.ExtrudeGeometry(armShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 });
    armGeo.translate(0, 0, -0.015);
    const armMat = aluminum({ color: 0xc9ced4 });
    const armR = mesh(armGeo, armMat);
    armR.position.z = CRANK_Z;
    const armL = mesh(armGeo, armMat);
    armL.rotation.z = Math.PI;
    armL.position.z = -CRANK_Z;
    const capMat = darkSteel();
    const capR = mesh(zCyl(0.045, CRANK_Z + 0.02, CRANK_Z + 0.032, 24), capMat);
    const capL = mesh(zCyl(0.045, -CRANK_Z - 0.032, -CRANK_Z - 0.02, 24), capMat);
    g.add(armR, armL, capR, capL);

    const bodyGeo = new RoundedBoxGeometry(0.26, 0.05, 0.17, 3, 0.015);
    const bodyMat = plastic(0x2a2d33);
    const spindleMat = steel();
    const reflMat = glow(0xff8a1c, 0.35);
    for (const side of [1, -1]) {
      const pedal = new THREE.Group();
      pedal.name = 'pedal';
      pedal.position.set(side * CRANK_LEN, 0, side * CRANK_Z);
      const spindle = mesh(zCyl(0.014, Math.min(0, side * 0.16), Math.max(0, side * 0.16), 16), spindleMat);
      const body = mesh(bodyGeo, bodyMat);
      body.position.z = side * 0.12;
      const refl = mesh(new THREE.BoxGeometry(0.012, 0.025, 0.09), reflMat);
      refl.position.set(0.133, 0, side * 0.12);
      const refl2 = refl.clone();
      refl2.position.x = -0.133;
      pedal.add(spindle, body, refl, refl2);
      g.add(pedal);
    }
    return g;
  }

  /** 체인링(앞 스프로킷) — factory 치형 + 5암 스파이더 일체형 */
  private buildFrontSprocket(): THREE.Group {
    const g = new THREE.Group();
    const shape = gearShape(RING_TEETH, RING_R + 0.032, 0.07, 0.16);
    const rIn = 0.1;
    const rOut = RING_R - 0.085;
    for (let i = 0; i < 5; i++) {
      const a0 = (i / 5) * Math.PI * 2 + 0.2;
      const a1 = a0 + (Math.PI * 2) / 5 - 0.4;
      const hole = new THREE.Path();
      hole.absarc(0, 0, rOut, a0, a1, false);
      hole.absarc(0, 0, rIn + 0.06, a1 - 0.12, a0 + 0.12, true);
      hole.closePath();
      shape.holes.push(hole);
    }
    const center = new THREE.Path();
    center.absarc(0, 0, 0.036, 0, Math.PI * 2, true);
    shape.holes.push(center);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 10 });
    geo.translate(0, 0, -0.008);
    g.add(mesh(geo, aluminum({ color: 0xdfe3e8, roughness: 0.32 })));

    // 스파이더 보스(크랭크 암 쪽으로 이어짐) + 체인링 볼트 5개
    g.add(mesh(latheZ([[0.036, 0.0], [0.1, 0.0], [0.11, 0.01], [0.09, 0.07], [0.036, 0.07]], 40), darkSteel()));
    const boltGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.cos(a) * (rOut - 0.035);
      const y = Math.sin(a) * (rOut - 0.035);
      boltGeos.push(zCyl(0.02, -0.018, 0.02, 16, x, y));
    }
    g.add(mesh(merge(boltGeos), chrome()));
    return g;
  }

  /** 뒤 스프로킷(18T) + 락링 */
  private createSprocketModel(): THREE.Group {
    const g = new THREE.Group();
    const shape = gearShape(SPR_TEETH, SPR_R + 0.032, 0.07, 0.16);
    const center = new THREE.Path();
    center.absarc(0, 0, 0.056, 0, Math.PI * 2, true);
    shape.holes.push(center);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const hole = new THREE.Path();
      hole.absarc(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.032, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 10 });
    geo.translate(0, 0, -0.008);
    g.add(mesh(geo, steel({ color: 0xb4bcc6 })));
    g.add(mesh(latheZ([[0.04, 0.012], [0.072, 0.012], [0.072, 0.034], [0.04, 0.034]], 36), darkSteel()));
    return g;
  }

  /** 평행 핀: 체인 링크를 관통하는 연결 핀 */
  private buildChainPin(): THREE.Group {
    const g = new THREE.Group();
    g.add(mesh(zCyl(0.022, -0.06, 0.06, 20), steel()));
    g.add(mesh(latheZ([[0, 0.05], [0.045, 0.05], [0.05, 0.058], [0.045, 0.066], [0, 0.066]], 24), chrome()));
    g.add(mesh(latheZ([[0, -0.05], [0.045, -0.05], [0.05, -0.058], [0.045, -0.066], [0, -0.066]], 24), chrome()));
    return g;
  }

  /** 안장 밑 코일 스프링 (양 끝은 닫힌 감김, 높이 SPRING_H) */
  private buildSaddleSpring(): THREE.Group {
    const turns = 5.5;
    const pts: THREE.Vector3[] = [];
    const n = 220;
    const wire = 0.014;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * turns * Math.PI * 2;
      // 양 끝 0.6바퀴는 피치 0(닫힌 끝) — 받침에 평평하게 앉는다
      const endT = 0.6 / turns;
      const k = t < endT ? 0 : t > 1 - endT ? 1 : (t - endT) / (1 - 2 * endT);
      const y = -SPRING_H / 2 + wire + k * (SPRING_H - 2 * wire);
      pts.push(new THREE.Vector3(Math.cos(a) * 0.068, y, Math.sin(a) * 0.068));
    }
    const g = new THREE.Group();
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 480, wire, 10), chrome()));
    return g;
  }

  /**
   * 블록 브레이크(사이드풀 캘리퍼): 피벗 볼트 1개에 두 암이 겹쳐 돈다.
   * 속케이블이 왼쪽 암 아랫탭(고정 볼트)을 오른쪽 암 윗탭(배럴) 쪽으로 끌면
   * 오른쪽 암은 +θ, 왼쪽 암은 -θ 돌아 아래 끝의 고무 블록이 림 양옆을 누른다.
   * 원점 = 피벗 볼트 자리(크라운 앞면), 회전 0으로 날아와도 장착 자세 그대로 보이도록 안쪽 그룹이 방향을 맡는다.
   */
  private buildBlockBrake(): THREE.Group {
    const g = new THREE.Group();
    const frame = new THREE.Group();
    frame.rotation.z = BRAKE_ROT;
    g.add(frame);

    const armMat = aluminum({ color: 0xc8cdd3, roughness: 0.3 });
    const shoeMat = darkSteel();
    const boltMat = chrome();
    const padMat = rubber({ color: CATEGORY_COLORS.control, roughness: 0.75 });

    /** 국소 (z, y) 두 점을 잇는 둥근 판(두께 방향 = 피벗 축 X, t0~t1) */
    const strap = (za: number, ya: number, zb: number, yb: number, w: number, t0: number, t1: number): THREE.BufferGeometry => {
      const ang = Math.atan2(yb - ya, zb - za);
      const r = w / 2;
      const sh = new THREE.Shape();
      sh.absarc(zb, yb, r, ang - Math.PI / 2, ang + Math.PI / 2, false);
      sh.absarc(za, ya, r, ang + Math.PI / 2, ang + Math.PI * 1.5, false);
      sh.closePath();
      const bev = 0.004;
      const geo = new THREE.ExtrudeGeometry(sh, { depth: t1 - t0 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 12 });
      // 셰이프 (x=z, y=y, d) → 국소 (X=t, Y=y, Z=z): Y축 -90° 회전은 x' = -d, z' = x
      geo.rotateY(-Math.PI / 2);
      geo.translate(t1 - bev, 0, 0);
      return geo;
    };
    const xCyl = (r: number, t0: number, t1: number, y: number, z: number, seg = 20): THREE.BufferGeometry => {
      const c = new THREE.CylinderGeometry(r, r, t1 - t0, seg);
      c.rotateZ(-Math.PI / 2);
      c.translate((t0 + t1) / 2, y, z);
      return c;
    };
    const boxAt = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rad = 0.006): THREE.BufferGeometry => {
      const bx = new RoundedBoxGeometry(sx, sy, sz, 2, rad);
      bx.translate(x, y, z);
      return bx;
    };

    // 피벗 볼트(크라운을 앞뒤로 관통) + 와셔 + 앞 돔 너트 + 뒤 너트
    const pivotGeos = [
      xCyl(0.011, -0.175, 0.05, 0, 0, 20),
      xCyl(0.024, 0.0, 0.005, 0, 0, 28),
      xCyl(0.022, 0.022, 0.026, 0, 0, 28)
    ];
    const dome = new THREE.SphereGeometry(0.019, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.rotateZ(-Math.PI / 2);
    dome.translate(0.058, 0, 0);
    pivotGeos.push(xCyl(0.019, 0.045, 0.058, 0, 0, 6), dome, xCyl(0.019, -0.178, -0.162, 0, 0, 6));
    frame.add(mesh(merge(pivotGeos), boltMat));

    const footY = PAD_Y;
    const shoeZ = PAD_FACE_Z + PAD_THK + 0.006;
    const footZ = shoeZ + 0.006 + 0.012;
    const buildArm = (side: 1 | -1, name: string, t0: number, t1: number): THREE.Group => {
      const arm = new THREE.Group();
      arm.name = name;
      const s = side;
      const plate = [
        xCyl(0.034, t0, t1, 0, 0, 32), // 피벗 보스
        strap(0, 0, s * 0.128, -0.055, 0.04, t0, t1),
        strap(s * 0.128, -0.055, s * footZ, footY + 0.012, 0.032, t0, t1),
        // 발: 블록 스터드가 Z 방향으로 지나가는 덩어리
        boxAt(0.05, 0.04, 0.024, PAD_T, footY, s * footZ, 0.007)
      ];
      if (s > 0) {
        // 윗탭 + 케이블 겉피 받침(배럴 어저스터)
        plate.push(strap(0, 0, BARREL_P.z, BARREL_P.y, 0.034, t0, t1));
      } else {
        // 반대편으로 넘어오는 아랫탭(속케이블 고정)
        plate.push(strap(0, 0, ANCHOR_P.z, ANCHOR_P.y, 0.03, t0, t1));
      }
      arm.add(mesh(merge(plate), armMat));

      // 슈(금속 받침) + 스터드 너트
      const shoe = [boxAt(0.12, 0.042, 0.012, PAD_T, footY, s * shoeZ, 0.004)];
      const stud = new THREE.CylinderGeometry(0.008, 0.008, footZ - shoeZ + 0.03, 12);
      stud.rotateX(Math.PI / 2);
      stud.translate(PAD_T, footY, s * ((shoeZ + footZ) / 2 + 0.01));
      const nut = s > 0 ? zCyl(0.016, footZ + 0.012, footZ + 0.024, 6, PAD_T, footY) : zCyl(0.016, -footZ - 0.024, -footZ - 0.012, 6, PAD_T, footY);
      shoe.push(stud);
      arm.add(mesh(merge(shoe), shoeMat));
      arm.add(mesh(nut, boltMat));

      // 고무 블록(제어용 강조색) — 림 쪽 면이 PAD_FACE_Z
      const pad = new RoundedBoxGeometry(0.11, PAD_H, PAD_THK, 3, 0.006);
      pad.translate(PAD_T, footY, s * (PAD_FACE_Z + PAD_THK / 2));
      arm.add(mesh(pad, padMat));

      if (s > 0) {
        const barrel = latheZ([[0, 0], [0.012, 0], [0.013, 0.004], [0.013, 0.028], [0.0105, 0.03], [0.0105, 0.05], [0, 0.05]], 20);
        // latheZ는 Z축 회전체 → 방사(Y) 방향으로 세운다
        barrel.rotateX(-Math.PI / 2);
        barrel.translate(BARREL_P.t, BARREL_P.y, BARREL_P.z);
        arm.add(mesh(barrel, boltMat));
      } else {
        const anchor = [
          xCyl(0.007, t0 - 0.004, ANCHOR_P.t + 0.006, ANCHOR_P.y, ANCHOR_P.z, 12),
          xCyl(0.016, ANCHOR_P.t - 0.003, ANCHOR_P.t + 0.002, ANCHOR_P.y, ANCHOR_P.z, 20),
          xCyl(0.012, ANCHOR_P.t + 0.002, ANCHOR_P.t + 0.012, ANCHOR_P.y, ANCHOR_P.z, 6)
        ];
        arm.add(mesh(merge(anchor), boltMat));
      }
      return arm;
    };
    // 오른쪽 암은 앞 층, 왼쪽 암은 크라운 쪽 층
    frame.add(buildArm(1, 'brakeArmR', 0.026, 0.044));
    frame.add(buildArm(-1, 'brakeArmL', 0.006, 0.022));

    // 속케이블(배럴 → 고정 볼트) — 시뮬레이션이 매 프레임 두 끝에 맞춰 늘인다
    const wire = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 8), steel({ grain: false }));
    wire.name = 'brakeWire';
    const a = new THREE.Vector3(BARREL_P.t, BARREL_P.y, BARREL_P.z);
    const b = new THREE.Vector3(ANCHOR_P.t, ANCHOR_P.y, ANCHOR_P.z);
    wire.position.copy(a).add(b).multiplyScalar(0.5);
    wire.scale.set(1, a.distanceTo(b), 1);
    wire.quaternion.setFromUnitVectors(Y_UP, b.clone().sub(a).normalize());
    frame.add(wire);
    // 겉피 쪽으로 이어지는 짧은 속케이블(배럴 위 페룰까지)
    frame.add(mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.012, 8).translate(BARREL_P.t, BARREL_P.y + 0.056, BARREL_P.z), steel({ grain: false })));
    return g;
  }

  /** 앞·뒤 차축(너트 포함) */
  private buildAxlePair(): THREE.Group {
    const g = new THREE.Group();
    const axleMat = steel();
    const nutMat = chrome();
    for (const [pos, half] of [[REAR, REAR_DROP_Z + 0.06], [FRONT, FRONT_DROP_Z + 0.06]] as const) {
      const axle = new THREE.Group();
      axle.position.set(pos.x, pos.y, 0);
      axle.add(mesh(zCyl(0.022, -half, half, 20), axleMat));
      const dz = half - 0.06;
      const nuts = merge([zCyl(0.045, dz + 0.014, dz + 0.042, 6), zCyl(0.045, -dz - 0.042, -dz - 0.014, 6)]);
      axle.add(mesh(nuts, nutMat));
      g.add(axle);
    }
    return g;
  }

  // ─────────────────────────── 고정 구조 ───────────────────────────

  private buildFrame(): void {
    const geos: THREE.BufferGeometry[] = [];
    const TT = 0.042;
    const DT = 0.054;
    const ST = 0.046;
    // 메인 삼각형
    geos.push(cylBetween(P3(BB), P3(DT_FRONT), DT, 32));
    geos.push(cylBetween(P3(SEAT_CLUSTER), P3(TT_FRONT), TT, 32));
    geos.push(cylBetween(P3(along(BB, SEAT_DIR, -0.02)), P3(ST_TOP), ST, 32));
    // 헤드튜브: 양 끝이 살짝 벌어진 러그 형태
    const htLen = HT_BOT.distanceTo(HT_TOP);
    const ht = new THREE.LatheGeometry(
      ([[0, 0], [0.066, 0], [0.068, 0.02], [0.06, 0.06], [0.058, htLen - 0.06], [0.066, htLen - 0.02], [0.064, htLen], [0, htLen]] as const).map(
        ([r, y]) => new THREE.Vector2(r, y)
      ),
      40
    );
    ht.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, new THREE.Vector3(HEAD_DIR.x, HEAD_DIR.y, 0)));
    ht.translate(HT_BOT.x, HT_BOT.y, 0);
    geos.push(ht);
    // 접합부 필렛
    geos.push(ball(P3(SEAT_CLUSTER), 0.05), ball(P3(TT_FRONT), 0.046), ball(P3(DT_FRONT), 0.058));
    // BB 쉘
    const bbShell = latheZ([[0, -0.12], [0.06, -0.12], [0.068, -0.11], [0.068, 0.11], [0.06, 0.12], [0, 0.12]], 40);
    bbShell.translate(BB.x, BB.y, 0);
    geos.push(bbShell);
    // 체인스테이·시트스테이 (드롭아웃으로 벌어짐)
    const seatStayTop = along(SEAT_CLUSTER, SEAT_DIR, -0.06);
    for (const s of [1, -1]) {
      const drop = P3(REAR, s * REAR_DROP_Z);
      geos.push(cylBetween(P3(along(BB, v2(-1, 0), 0.04), s * 0.085), drop, 0.026, 20, 0.032));
      geos.push(cylBetween(P3(seatStayTop, s * 0.05), drop, 0.022, 20, 0.024));
      geos.push(ball(P3(seatStayTop, s * 0.05), 0.026));
      // 드롭아웃 판(축 홈은 아래로 열린 형태)
      const dShape = new THREE.Shape();
      dShape.moveTo(-0.07, 0.06);
      dShape.quadraticCurveTo(0.0, 0.11, 0.07, 0.05);
      dShape.lineTo(0.06, -0.035);
      dShape.lineTo(0.025, -0.06);
      dShape.lineTo(0.025, 0.0);
      dShape.absarc(0, 0, 0.025, 0, Math.PI, false);
      dShape.lineTo(-0.025, -0.06);
      dShape.lineTo(-0.06, -0.035);
      dShape.closePath();
      const dGeo = new THREE.ExtrudeGeometry(dShape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 8 });
      dGeo.translate(0, 0, -0.009);
      dGeo.rotateZ(0.35);
      dGeo.translate(REAR.x, REAR.y, s * REAR_DROP_Z);
      geos.push(dGeo);
    }
    // 시트스테이 브리지(뒤 브레이크 장착)
    const bridgeC = along(REAR, along(seatStayTop, REAR, -1).normalize(), 1.16);
    geos.push(cylBetween(P3(bridgeC, -0.09), P3(bridgeC, 0.09), 0.016, 16));

    // 포크: 크라운 + 레이크가 들어간 블레이드
    const crownGeo = new RoundedBoxGeometry(0.16, 0.08, 0.3, 3, 0.03);
    crownGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, new THREE.Vector3(HEAD_DIR.x, HEAD_DIR.y, 0)));
    crownGeo.translate(CROWN.x, CROWN.y, 0);
    geos.push(crownGeo);
    for (const s of [1, -1]) {
      const pts = [
        P3(along(CROWN, HEAD_DIR, -0.02), s * 0.12),
        P3(along(CROWN, HEAD_DIR, -0.4), s * 0.14),
        P3(along(along(CROWN, HEAD_DIR, -0.85), HEAD_FWD, 0.04), s * FRONT_DROP_Z),
        P3(FRONT, s * FRONT_DROP_Z)
      ];
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.028, 16));
      geos.push(ball(P3(FRONT, s * FRONT_DROP_Z), 0.028));
      const tip = new THREE.CylinderGeometry(0.04, 0.04, 0.016, 24);
      tip.rotateX(Math.PI / 2);
      tip.translate(FRONT.x, FRONT.y, s * FRONT_DROP_Z);
      geos.push(tip);
    }
    const frame = mesh(merge(geos), paint(0xc62f2a), true);
    this.group.add(frame);

    // 헤드셋 컵·BB 컵(어두운 금속)
    const cupGeos = [
      latheZ([[0.04, 0.115], [0.072, 0.115], [0.072, 0.135], [0.04, 0.135]], 40),
      latheZ([[0.04, -0.135], [0.072, -0.135], [0.072, -0.115], [0.04, -0.115]], 40)
    ];
    for (const c of cupGeos) c.translate(BB.x, BB.y, 0);
    for (const [p, t] of [[HT_BOT, -0.03], [HT_TOP, 0.0]] as const) {
      const cup = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 40);
      cup.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, new THREE.Vector3(HEAD_DIR.x, HEAD_DIR.y, 0)));
      const c = along(p, HEAD_DIR, t + 0.015);
      cup.translate(c.x, c.y, 0);
      cupGeos.push(cup);
    }
    this.group.add(mesh(merge(cupGeos), darkSteel()));

    // 뒤 림 브레이크 캘리퍼(시트스테이 브리지) — 고정 부품. 앞 브레이크는 조립 단계(블록 브레이크)
    const calGeos: THREE.BufferGeometry[] = [];
    const padGeos: THREE.BufferGeometry[] = [];
    const addCaliper = (mount: THREE.Vector2, hub: THREE.Vector2) => {
      const dir = mount.clone().sub(hub).normalize();
      const padC = along(hub, dir, 0.895);
      for (const s of [1, -1]) {
        calGeos.push(cylBetween(P3(mount, s * 0.02), P3(along(mount, dir, -0.02), s * 0.115), 0.014, 12));
        calGeos.push(cylBetween(P3(along(mount, dir, -0.02), s * 0.115), P3(padC, s * 0.075), 0.013, 12));
        const pad = new RoundedBoxGeometry(0.1, 0.024, 0.022, 2, 0.008);
        pad.rotateZ(Math.atan2(dir.y, dir.x) + Math.PI / 2);
        pad.translate(padC.x, padC.y, s * 0.067); // 림(±0.05)에서 살짝 떨어져 회전 중 끌리지 않는다
        padGeos.push(pad);
      }
      calGeos.push(zCyl(0.02, -0.04, 0.04, 16, mount.x, mount.y));
    };
    addCaliper(bridgeC, REAR);
    this.group.add(mesh(merge(calGeos), aluminum({ color: 0xb9c0c8 })));
    this.group.add(mesh(merge(padGeos), rubber({ color: 0x2b2b2b })));
  }

  private buildCockpit(): void {
    const alu = aluminum({ color: 0xbfc5cc });
    const geos: THREE.BufferGeometry[] = [];
    const hd = new THREE.Vector3(HEAD_DIR.x, HEAD_DIR.y, 0);
    // 스페이서 + 스템 클램프 + 탑캡
    geos.push(cylBetween(P3(HT_TOP), P3(along(STEM_C, HEAD_DIR, -0.065)), 0.044, 32));
    geos.push(cylBetween(P3(along(STEM_C, HEAD_DIR, -0.065)), P3(along(STEM_C, HEAD_DIR, 0.065)), 0.05, 32));
    const cap = new THREE.CylinderGeometry(0.044, 0.05, 0.016, 32);
    cap.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, hd));
    const capC = along(STEM_C, HEAD_DIR, 0.073);
    cap.translate(capC.x, capC.y, 0);
    geos.push(cap);
    // 스템 몸통
    geos.push(cylBetween(P3(STEM_C), P3(BAR_POS), 0.034, 24, 0.03));
    geos.push(zCyl(0.05, -0.07, 0.07, 32, BAR_POS.x, BAR_POS.y));
    // 핸들바(살짝 뒤로 휜 플랫바)
    const barPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const z = -0.62 + (i / 16) * 1.24;
      const a = Math.max(0, Math.abs(z) - 0.16) / 0.46;
      barPts.push(new THREE.Vector3(BAR_POS.x - 0.09 * a * a, BAR_POS.y + 0.02 * a, z));
    }
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(barPts), 64, 0.03, 20));
    geos.push(zCyl(0.04, -0.13, 0.13, 32, BAR_POS.x, BAR_POS.y));
    this.group.add(mesh(merge(geos), alu));

    // 그립(골이 있는 고무) + 브레이크 레버
    const gripProfile: [number, number][] = [[0.03, 0], [0.05, 0], [0.05, 0.02]];
    for (let i = 0; i < 9; i++) {
      const z = 0.03 + i * 0.016;
      gripProfile.push([0.043, z], [0.046, z + 0.008]);
    }
    gripProfile.push([0.046, 0.18], [0.04, 0.19], [0.0, 0.19]);
    const gripGeos: THREE.BufferGeometry[] = [];
    const leverGeos: THREE.BufferGeometry[] = [];
    const bladeGeos: THREE.BufferGeometry[] = [];
    const leverMat = darkSteel();
    let housingStart = new THREE.Vector3();
    for (const s of [1, -1]) {
      const z0 = s * 0.43;
      const gGeo = latheZ(gripProfile, 32);
      if (s < 0) gGeo.rotateY(Math.PI);
      const a = (Math.abs(z0) - 0.16) / 0.46;
      gGeo.translate(BAR_POS.x - 0.09 * a * a - 0.004, BAR_POS.y + 0.02 * a, z0);
      gripGeos.push(gGeo);
      const lx = BAR_POS.x - 0.09 * a * a;
      const ly = BAR_POS.y + 0.02 * a;
      leverGeos.push(zCyl(0.042, z0 - s * 0.04, z0 - s * 0.012, 24, lx, ly));
      const root = new THREE.Vector3(lx + 0.04, ly - 0.01, z0 - s * 0.03);
      const knee = new THREE.Vector3(lx + 0.09, ly - 0.04, z0 + s * 0.06);
      const tip = new THREE.Vector3(lx + 0.08, ly - 0.05, z0 + s * 0.16);
      if (s > 0) {
        // 앞 브레이크 레버 날: 뿌리(피벗) 기준 지오메트리로 따로 두어 시연 때 쥐어지게 한다
        this.frontLever.position.copy(root);
        const o = root.clone().negate();
        bladeGeos.push(cylBetween(root.clone().add(o), knee.clone().add(o), 0.012, 12));
        bladeGeos.push(cylBetween(knee.clone().add(o), tip.clone().add(o), 0.012, 12));
        bladeGeos.push(ball(new THREE.Vector3(), 0.016));
        housingStart = new THREE.Vector3(lx + 0.03, ly + 0.03, z0 - s * 0.03);
        // 겉피를 받는 레버 배럴
        leverGeos.push(cylBetween(new THREE.Vector3(lx + 0.012, ly + 0.03, z0 - s * 0.03), housingStart, 0.013, 16));
      } else {
        leverGeos.push(cylBetween(root, knee, 0.012, 12));
        leverGeos.push(cylBetween(knee, tip, 0.012, 12));
      }
    }
    this.group.add(mesh(merge(gripGeos), rubber({ color: 0x23252a }), true));
    this.group.add(mesh(merge(leverGeos), leverMat));
    this.frontLever.add(mesh(merge(bladeGeos), leverMat));
    this.group.add(this.frontLever);

    // 앞 브레이크 케이블 겉피: 레버 → 헤드튜브 앞 → 캘리퍼 배럴 위(브레이크가 없을 땐 끝 페룰만 남는다)
    const end = brakeWorld(BARREL_P.t, BARREL_P.y + 0.062, BARREL_P.z);
    const endUp = brakeWorld(BARREL_P.t, BARREL_P.y + 0.2, BARREL_P.z + 0.01);
    const midHT = along(along(HT_BOT, HEAD_DIR, 0.2), HEAD_FWD, 0.24);
    const hPts = [
      housingStart,
      new THREE.Vector3(housingStart.x + 0.1, housingStart.y + 0.02, housingStart.z - 0.04),
      new THREE.Vector3(housingStart.x + 0.16, housingStart.y - 0.16, 0.26),
      P3(midHT, 0.15),
      endUp,
      end
    ];
    const housing = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hPts, false, 'centripetal'), 96, 0.013, 12);
    this.group.add(mesh(housing, plastic(0x1b1d21, { roughness: 0.35, grain: false })));
    const ferrule = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 16);
    ferrule.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, new THREE.Vector3(BRAKE_U.x, BRAKE_U.y, 0)));
    const fc = brakeWorld(BARREL_P.t, BARREL_P.y + 0.062, BARREL_P.z);
    ferrule.translate(fc.x, fc.y, fc.z);
    this.group.add(mesh(ferrule, chrome()));
  }

  private buildSaddle(): void {
    // 시트포스트 + 시트 클램프 칼라
    const postGeos = [cylBetween(P3(along(BB, SEAT_DIR, 1.45)), P3(POST_HEAD), 0.034, 32)];
    postGeos.push(zCyl(0.032, -0.08, 0.08, 32, POST_HEAD.x, RAIL_Y - 0.004));
    this.group.add(mesh(merge(postGeos), aluminum({ color: 0xc7ccd2 })));
    const collar = new THREE.CylinderGeometry(0.056, 0.056, 0.05, 32);
    collar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_UP, new THREE.Vector3(SEAT_DIR.x, SEAT_DIR.y, 0)));
    const cc = along(ST_TOP, SEAT_DIR, -0.01);
    collar.translate(cc.x, cc.y, 0);
    const collarBolt = zCyl(0.014, 0.03, 0.09, 12, cc.x - 0.05, cc.y);
    this.group.add(mesh(merge([collar, collarBolt]), darkSteel()));

    // 가죽 안장(곡면) — 뒤가 넓고 코가 좁은 형태
    const rearX = POST_HEAD.x - 0.4;
    const len = 0.84;
    const thick = (u: number) => 0.075 * (0.55 + 0.45 * (1 - u));
    const dip = (u: number) => -0.022 * Math.sin(Math.PI * u);
    const uS = (SADDLE_SPRING_POS.x - rearX) / len;
    // 스프링 윗면(y+H/2)에 안장 바닥이 닿도록 기준 높이를 맞춘다(칸틀 판 두께 0.012 포함)
    const topY = SADDLE_SPRING_POS.y + SPRING_H / 2 + 0.012 + thick(uS) - dip(uS);
    const saddleGeo = new ParametricGeometry(
      (u: number, v: number, target: THREE.Vector3) => {
        const e = Math.pow(Math.sin(Math.PI * u), 0.42);
        const sm = THREE.MathUtils.smoothstep(u, 0.2, 0.74);
        const w = 0.05 + 0.18 * (1 - sm);
        const ang = v * Math.PI * 2;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.5);
        const sy = Math.sign(s) * Math.pow(Math.abs(s), 0.65);
        const t = thick(u);
        const yTop = topY + dip(u);
        let y = yTop - t / 2 + (t / 2) * sy;
        if (s > 0) y += 0.014 * (1 - sx * sx) * e;
        target.set(rearX + u * len, y, w * e * sx);
      },
      64,
      40
    );
    this.group.add(mesh(saddleGeo, plastic(0x6e4529, { roughness: 0.5 }), true));

    // 레일(코 → 클램프 → 뒤 브리지) + 스프링 받침
    const railGeos: THREE.BufferGeometry[] = [];
    const noseU = 0.86;
    const noseBot = topY + dip(noseU) - thick(noseU);
    for (const s of [1, -1]) {
      const pts = [
        new THREE.Vector3(SADDLE_SPRING_POS.x - 0.07, RAIL_Y, s * 0.05),
        new THREE.Vector3(POST_HEAD.x - 0.12, RAIL_Y, s * 0.05),
        new THREE.Vector3(POST_HEAD.x + 0.12, RAIL_Y, s * 0.045),
        new THREE.Vector3(rearX + len * 0.78, RAIL_Y + 0.05, s * 0.03),
        new THREE.Vector3(rearX + len * noseU, noseBot + 0.01, s * 0.012)
      ];
      railGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 10));
    }
    const sp = SADDLE_SPRING_POS;
    const bottomSeat = latheZ([[0, 0], [0.085, 0], [0.09, 0.008], [0.085, 0.016], [0, 0.016]], 32);
    bottomSeat.rotateX(-Math.PI / 2);
    bottomSeat.translate(sp.x, sp.y - SPRING_H / 2 - 0.016, 0);
    const topSeat = latheZ([[0, 0], [0.085, 0], [0.09, 0.006], [0.085, 0.012], [0, 0.012]], 32);
    topSeat.rotateX(-Math.PI / 2);
    topSeat.translate(sp.x, sp.y + SPRING_H / 2, 0);
    railGeos.push(bottomSeat, topSeat);
    this.group.add(mesh(merge(railGeos), chrome()));
  }

  /** 시트포스트를 무는 정비 스탠드(비구동측 -Z에 세움) */
  private buildStand(): void {
    const blue = paint(0x2468c9);
    const mastX = STAND_CLAMP.x;
    const mastZ = -0.85;
    const topY = STAND_CLAMP.y;
    const geos: THREE.BufferGeometry[] = [];
    geos.push(cylBetween(new THREE.Vector3(mastX, 0.28, mastZ), new THREE.Vector3(mastX, 1.75, mastZ), 0.05, 32));
    geos.push(cylBetween(new THREE.Vector3(mastX, 0.5, mastZ), new THREE.Vector3(mastX, 0.62, mastZ), 0.068, 32));
    // 삼각 다리
    const feet: THREE.Vector3[] = [];
    for (const a of [90, 210, 330]) {
      const foot = new THREE.Vector3(mastX + Math.cos(a * deg) * 0.85, 0.035, mastZ + Math.sin(a * deg) * 0.85);
      feet.push(foot);
      geos.push(cylBetween(new THREE.Vector3(mastX, 0.56, mastZ), foot, 0.03, 20));
    }
    // 머리: 회전 헤드 + 수평 암 + 클램프 몸체
    geos.push(ball(new THREE.Vector3(mastX, topY, mastZ), 0.07));
    geos.push(cylBetween(new THREE.Vector3(mastX, topY, mastZ), new THREE.Vector3(mastX, topY, -0.16), 0.042, 24));
    this.group.add(mesh(merge(geos), blue, true));

    const steelGeos: THREE.BufferGeometry[] = [];
    steelGeos.push(cylBetween(new THREE.Vector3(mastX, 1.7, mastZ), new THREE.Vector3(mastX, topY, mastZ), 0.038, 32));
    steelGeos.push(cylBetween(new THREE.Vector3(mastX, 1.7, mastZ), new THREE.Vector3(mastX, 1.8, mastZ), 0.062, 32));
    steelGeos.push(cylBetween(new THREE.Vector3(mastX + 0.06, 1.75, mastZ), new THREE.Vector3(mastX + 0.2, 1.72, mastZ), 0.014, 12));
    this.group.add(mesh(merge(steelGeos), darkSteel()));

    // 클램프 턱: 시트포스트 각도에 맞춰 기울임
    const jaw = new THREE.Group();
    jaw.position.set(STAND_CLAMP.x, STAND_CLAMP.y, 0);
    jaw.rotation.z = Math.atan2(SEAT_DIR.y, SEAT_DIR.x) - Math.PI / 2;
    const body = new RoundedBoxGeometry(0.2, 0.13, 0.08, 3, 0.02);
    body.translate(0, 0, -0.12);
    const jawGeos = [body];
    for (const s of [1, -1]) {
      const plate = new RoundedBoxGeometry(0.04, 0.12, 0.13, 2, 0.012);
      plate.translate(s * 0.058, 0, -0.03);
      jawGeos.push(plate);
    }
    jaw.add(mesh(merge(jawGeos), blue));
    const padGeos: THREE.BufferGeometry[] = [];
    for (const s of [1, -1]) {
      const pad = new RoundedBoxGeometry(0.014, 0.11, 0.09, 2, 0.005);
      pad.translate(s * 0.036, 0, -0.005);
      padGeos.push(pad);
    }
    jaw.add(mesh(merge(padGeos), rubber()));
    const screw = merge([
      cylBetween(new THREE.Vector3(0.08, 0, -0.03), new THREE.Vector3(0.22, 0, -0.03), 0.014, 12),
      cylBetween(new THREE.Vector3(0.22, -0.07, -0.03), new THREE.Vector3(0.22, 0.07, -0.03), 0.012, 12)
    ]);
    jaw.add(mesh(screw, steel()));
    this.group.add(jaw);

    const footGeos = feet.map((f) => {
      const g = new THREE.SphereGeometry(0.05, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1.2, 0.75, 1.2);
      g.translate(f.x, 0, f.z);
      return g;
    });
    this.group.add(mesh(merge(footGeos), rubber()));
  }

  private addChainSlotOutline(): void {
    const path = this.getChainPath();
    const pts: THREE.Vector3[] = Array.from({ length: 120 }, (_, i) => {
      const p = path.pointAt((i / 120) * path.length);
      return new THREE.Vector3(p.x, p.y, CHAIN_Z);
    });
    const ring = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.02, 8, true),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.userData.slot = true;
    this.slots[3] = ring;
    this.group.add(ring);
  }

  /** 바퀴: 트레드 타이어 + 림 + 플랜지 허브 + 3크로스 스포크 32개 + 밸브 */
  private buildWheel(wheel: THREE.Group, pos: THREE.Vector2, rear: boolean): void {
    const TUBE = 0.085;
    const RT = WHEEL_R - TUBE;
    const tireGeo = new THREE.TorusGeometry(RT, TUBE, 20, 384);
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
      const zc = v.z / TUBE;
      if (out > 0.35) {
        // 접지면에 V자 트레드 블록
        const band = THREE.MathUtils.smoothstep(out, 0.35, 0.7);
        const s = THREE.MathUtils.smoothstep(Math.sin(th * 90 + Math.abs(zc) * 2.6), -0.25, 0.25);
        const k = 1 + (0.075 * s * band) / 1;
        v.set(cx + dx * k, cy + dy * k, v.z * k);
        p.setXYZ(i, v.x, v.y, v.z);
      }
    }
    tireGeo.computeVertexNormals();
    wheel.add(mesh(tireGeo, rubber({ color: 0x1d1f23 }), true));

    const rim = latheZ(
      [
        [0.845, -0.022], [0.858, -0.043], [0.912, -0.05], [0.92, -0.044], [0.905, -0.036],
        [0.905, 0.036], [0.92, 0.044], [0.912, 0.05], [0.858, 0.043], [0.845, 0.022], [0.845, -0.022]
      ],
      128
    );
    wheel.add(mesh(rim, aluminum({ color: 0xd3d8de, roughness: 0.28 })));

    // 허브: 뒤는 구동측에 프리허브 바디(스프로킷 자리)가 있다
    const flL = rear ? -0.13 : -0.085;
    const flR = rear ? 0.07 : 0.085;
    const lock = rear ? REAR_DROP_Z - 0.012 : FRONT_DROP_Z - 0.012;
    const hubProfile: [number, number][] = [
      [0.026, -lock], [0.04, -lock], [0.04, flL - 0.03], [0.045, flL - 0.012], [0.1, flL - 0.008], [0.1, flL + 0.008],
      [0.042, flL + 0.02], [0.036, 0], [0.042, flR - 0.02], [0.1, flR - 0.008], [0.1, flR + 0.008], [0.045, flR + 0.012]
    ];
    if (rear) hubProfile.push([0.05, flR + 0.02], [0.052, lock - 0.01], [0.04, lock - 0.005], [0.04, lock], [0.026, lock]);
    else hubProfile.push([0.04, flR + 0.03], [0.04, lock], [0.026, lock]);
    wheel.add(mesh(latheZ(hubProfile, 48), aluminum({ color: 0xaab2bb })));

    // 스포크 32개(3크로스) — InstancedMesh 1드로콜
    const N = 32;
    const spokes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0065, 0.0065, 1, 6), steel({ color: 0xd0d6dc, grain: false }), N);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const cross = (3 * 4 * Math.PI) / N;
    for (let i = 0; i < N; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const aR = (i / N) * Math.PI * 2;
      const lead = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
      const aH = aR + lead * cross;
      const fz = side > 0 ? flR : flL;
      a.set(Math.cos(aH) * 0.092, Math.sin(aH) * 0.092, fz);
      b.set(Math.cos(aR) * 0.85, Math.sin(aR) * 0.85, side * 0.006);
      const d = b.clone().sub(a);
      const len = d.length();
      q.setFromUnitVectors(Y_UP, d.normalize());
      m4.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
      spokes.setMatrixAt(i, m4);
    }
    spokes.castShadow = true;
    wheel.add(spokes);

    // 밸브(회전이 눈에 보이는 표식) + 니플 링
    const va = Math.PI / N;
    const valve = new THREE.Group();
    valve.rotation.z = va - Math.PI / 2;
    const stem = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 12), chrome());
    stem.position.y = 0.815;
    const capV = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.035, 12), plastic(0x1a1a1a));
    capV.position.y = 0.76;
    valve.add(stem, capV);
    wheel.add(valve);

    wheel.position.set(pos.x, pos.y, 0);
  }
}
