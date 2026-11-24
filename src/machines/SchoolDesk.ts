// 교실 책걸상: 높이 조절식 책상(상판·프레임·다리 4개)과 의자 1개.
// 1단계: 상판 프레임을 다리 브래킷에 조이는 볼트·너트 4곳. 설치 전에는 상판이 떠서 어긋나 있다.
// 2단계: 다리 높이 조절 구멍에 끼우는 평행 핀 4개. 핀을 빼고 다리가 한 칸 움직인 뒤 핀을 다시 끼운다.
// 좌표: 바닥 y=0, +X 오른쪽, +Z 화면 앞. 의자는 책상 앞(+Z)에 있고 등받이는 +Z 쪽에 있다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { paint, plastic, rubber, steel, wood } from '../models/materials';
import { lathe, tubeProfile } from '../models/parts/geom';

const M_PER_UNIT = 0.35;

// 다리: 바깥 관(몸체에 고정)과 안쪽 관(바닥에 닿아 있음). 두 관이 겹친 곳에서 핀이 구멍을 관통한다.
const LEG_X = 0.92;
const LEG_Z = 0.42;
const OUT_R = 0.065;
const OUT_RI = 0.053;
const OUT_BOT = 0.95; // 바깥 관 아랫끝
const IN_R = 0.046;
const IN_BOT = 0.03; // 안쪽 관 아랫끝(발 윗면)
const IN_TOP = 1.55; // 안쪽 관 윗끝. 바깥 관 안에 항상 겹쳐 있다
const PITCH = 0.2; // 구멍 한 칸 = 약 7cm

// 프레임·상판
const APRON_BOT = 1.8;
const APRON_TOP = 1.92;
const APRON_MID = 1.86;
const TOP_T = 0.1;
const TOP_Y = APRON_TOP + TOP_T / 2; // 상판 중심 1.97
const TOP_SURF = APRON_TOP + TOP_T; // 상판 윗면 2.02 (책상 높이 기준)
const TOP_W = 2.3;
const TOP_D = 1.16;
const FLOAT_X = 0.12; // 설치 전 상판의 어긋남
const FLOAT_Y = 0.22; // 설치 전 상판이 떠 있는 높이

// 볼트·너트 (z 방향 축, 바깥쪽이 머리)
const BOLT_HEAD_Z = 0.58;
const NUT_Z = 0.32;
const BOLT_IN = 0.5; // 설치 때 볼트가 바깥에서 들어오는 거리

// 평행 핀 (z 방향 축, 바깥쪽이 머리)
const PIN_Y = 1.2; // 핀 구멍 높이(설치 상태)
const PIN_R = 0.014;
const PIN_HALF = 0.1;
const PIN_HEAD_R = 0.024;
const PIN_HEAD_LEN = 0.03;
const PIN_PULL = 0.2; // 뽑힌 거리(핀 안쪽 끝이 바깥 관 면 밖으로 나올 정도)

// 의자
const CHAIR_Z = 1.35;
const CH_X = 0.5;
const CH_Z = 0.45;
const CH_TUBE = 0.03;
const FOOT_Y = 0.04;
const RAIL_Y = 1.18;
const SEAT_Y = 1.25;
const SEAT_W = 1.2;
const SEAT_D = 1.1;
const SEAT_H = 0.08;
const BACK_TOP = 2.12;
const BACK_Y = 1.85;
const BACK_H = 0.5;
const BACK_Z = 0.5;

// 한 주기 8초: 핀 뽑기 → 한 칸 올림 → 핀 끼움 → 유지 → 핀 뽑기 → 한 칸 내림 → 핀 끼움 → 유지
const CYCLE = 8;

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

function box(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
}

/** 임의의 두 점을 잇는 원기둥 */
function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 24): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** z 방향 축의 원기둥 (z0~z1 구간) */
function zCyl(r: number, z0: number, z1: number, seg = 24): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

/** z 방향 축의 육각 기둥 (볼트 머리·너트) */
function zHex(r: number, z0: number, z1: number): THREE.BufferGeometry {
  return zCyl(r, z0, z1, 6);
}

/** 한 주기의 핀 뽑힘 정도(0 끼움 ~ 1 뽑힘), 다리 이동 정도(0 낮음 ~ 1 한 칸 올림), 상태 이름 */
function cycle(tm: number): { pin: number; body: number; label: string } {
  if (tm < 0.8) return { pin: smooth(tm / 0.8), body: 0, label: '핀 뽑는 중' };
  if (tm < 1.6) return { pin: 1, body: smooth((tm - 0.8) / 0.8), label: '높이 올리는 중' };
  if (tm < 2.2) return { pin: 1 - smooth((tm - 1.6) / 0.6), body: 1, label: '핀 끼우는 중' };
  if (tm < 4.0) return { pin: 0, body: 1, label: '높게 고정' };
  if (tm < 4.8) return { pin: smooth((tm - 4.0) / 0.8), body: 1, label: '핀 뽑는 중' };
  if (tm < 5.6) return { pin: 1, body: 1 - smooth((tm - 4.8) / 0.8), label: '높이 내리는 중' };
  if (tm < 6.2) return { pin: 1 - smooth((tm - 5.6) / 0.6), body: 0, label: '핀 끼우는 중' };
  return { pin: 0, body: 0, label: '낮게 고정' };
}

interface PinPart {
  g: THREE.Group;
  baseZ: number;
  sz: number;
}

interface BoltPart {
  g: THREE.Group;
  sz: number;
}

export class SchoolDesk extends BaseMachine {
  readonly id = 'desk';
  /** 몸체(프레임·바깥 관·핀 구멍): 원점 = 바닥. 높이 조절은 이 그룹의 y 이동으로 한다 */
  private carriage = new THREE.Group();
  /** 상판: 설치 전에는 떠서 어긋나 있고, 볼트가 죄어지며 내려앉는다 */
  private top = new THREE.Group();
  private boltModel: THREE.Group | null = null;
  private pinModel: THREE.Group | null = null;
  private bolts: BoltPart[] = [];
  private pins: PinPart[] = [];
  private mount: { k: number; last: number } | null = null;
  private pinAnim: { k: number; last: number } | null = null;

  private readonly frameMat = paint(0x4a5c6a, { roughness: 0.4 });
  private readonly woodMat = wood(0xc08a55);

  constructor() {
    super();
    this.group.add(this.carriage);
    this.carriage.add(this.top);
    this.buildInnerLegs();
    this.buildOuterLegs();
    this.buildFrame();
    this.buildTop();
    this.buildHoleMarks();
    this.buildChair();
    this.top.position.set(FLOAT_X, FLOAT_Y, 0);

    this.addSlot(0, 0.13, new THREE.Vector3(LEG_X, APRON_MID, BOLT_HEAD_Z + 0.08), 0.016);
    this.addSlot(1, 0.12, new THREE.Vector3(LEG_X, PIN_Y, LEG_Z + 0.2), 0.012);
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
    return step === 0 ? this.boltModel !== null : this.pinModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, APRON_MID, 0) : new THREE.Vector3(0, PIN_Y, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0
      ? new THREE.Vector3(LEG_X, APRON_MID, BOLT_HEAD_Z + 0.08)
      : new THREE.Vector3(LEG_X, PIN_Y, LEG_Z + 0.2);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildBolts() : this.buildPins();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.carriage.add(model);
    if (step === 0) {
      this.boltModel = model;
      this.bolts = model.children.map((c) => ({ g: c as THREE.Group, sz: Number(c.userData.sz) }));
      this.hideSlot(0);
      this.mount = { k: 0, last: -1 };
      this.applyBolts(0);
    } else {
      this.finishMount();
      this.pinModel = model;
      this.pins = model.children.map((c) => ({ g: c as THREE.Group, baseZ: c.position.z, sz: Math.sign(c.position.z) }));
      this.pinAnim = { k: 0, last: -1 };
      this.applyPins(PIN_PULL);
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.boltModel) this.carriage.remove(this.boltModel);
    if (this.pinModel) this.carriage.remove(this.pinModel);
    this.boltModel = this.pinModel = null;
    this.bolts = [];
    this.pins = [];
    this.mount = this.pinAnim = null;
    this.carriage.position.set(0, 0, 0);
    this.top.position.set(FLOAT_X, FLOAT_Y, 0);
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
      else this.applyBolts(this.mount.k);
    }
    if (this.pinAnim) {
      const dt = this.pinAnim.last < 0 ? 0 : Math.min(0.05, t - this.pinAnim.last);
      this.pinAnim.last = t;
      this.pinAnim.k += dt / 1.0;
      if (this.pinAnim.k >= 1) this.finishPin();
      else this.applyPins(PIN_PULL * (1 - smooth(this.pinAnim.k)));
    }
  }

  createSim(): MachineSim {
    if (!this.boltModel || !this.pinModel) throw new Error('desk mission incomplete');
    this.finishMount();
    this.finishPin();
    let time = 0;
    let body = 0;
    let label = '낮게 고정';
    return {
      update: (dt: number) => {
        time += dt;
        const ph = cycle(time % CYCLE);
        body = ph.body;
        label = ph.label;
        this.carriage.position.y = body * PITCH;
        this.applyPins(PIN_PULL * ph.pin);
      },
      getDisplay: () => {
        const cm = Math.round((TOP_SURF + body * PITCH) * M_PER_UNIT * 100);
        return [
          { label: '책상 높이', value: String(cm), unit: 'cm' },
          { label: '체결 볼트 수', value: String(this.bolts.length), unit: '개', tone: 'blue' },
          { label: '상태', value: label, tone: 'red' }
        ];
      }
    };
  }

  // ───────────────────────── 조립 연출 ─────────────────────────

  /** k 0~1: 볼트가 바깥에서 들어오며 여러 바퀴 돈다. 뒤쪽 k 0.3~1: 상판이 내려앉아 프레임 위에 얹힌다 */
  private applyBolts(k: number): void {
    const enter = 1 - smooth(k);
    for (const b of this.bolts) {
      b.g.position.z = b.sz * enter * BOLT_IN;
      b.g.rotation.z = enter * 4 * Math.PI;
    }
    const lower = 1 - smooth((k - 0.3) / 0.7);
    this.top.position.set(FLOAT_X * lower, FLOAT_Y * lower, 0);
  }

  private finishMount(): void {
    this.mount = null;
    if (!this.boltModel) return;
    this.applyBolts(1);
    if (!this.pinModel) this.showSlot(1);
  }

  /** pull = 0 이면 핀이 구멍에 끼워진 상태, PIN_PULL 이면 바깥으로 뽑힌 상태 */
  private applyPins(pull: number): void {
    for (const p of this.pins) p.g.position.z = p.baseZ + p.sz * pull;
  }

  private finishPin(): void {
    this.pinAnim = null;
    this.applyPins(0);
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 볼트·너트 4곳: 각 조립체 원점은 다리 위 프레임 높이(z 축 방향), 머리는 바깥쪽 */
  private buildBolts(): THREE.Group {
    const g = new THREE.Group();
    const mat = steel({ roughness: 0.3 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const a = new THREE.Group();
        a.position.set(sx * LEG_X, APRON_MID, 0);
        a.userData.sz = sz;
        const head = new THREE.Mesh(zHex(0.05, sz * (BOLT_HEAD_Z - 0.025), sz * (BOLT_HEAD_Z + 0.025)), mat);
        const shaft = new THREE.Mesh(zCyl(0.014, sz * NUT_Z, sz * BOLT_HEAD_Z, 20), mat);
        const nut = new THREE.Mesh(zHex(0.042, sz * NUT_Z, sz * (NUT_Z + 0.04)), mat);
        a.add(head, shaft, nut);
        g.add(a);
      }
    }
    return g;
  }

  /** 평행 핀 4개: 각 원점 = 다리 구멍 중심. 머리는 바깥쪽(sz 방향)에 있다 */
  private buildPins(): THREE.Group {
    const g = new THREE.Group();
    const mat = steel({ color: 0xd4d9de, roughness: 0.3 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = new THREE.Group();
        p.position.set(sx * LEG_X, PIN_Y, sz * LEG_Z);
        const shaft = new THREE.Mesh(zCyl(PIN_R, -PIN_HALF, PIN_HALF, 20), mat);
        const head = new THREE.Mesh(
          zCyl(PIN_HEAD_R, sz * PIN_HALF, sz * (PIN_HALF + PIN_HEAD_LEN), 24),
          mat
        );
        p.add(shaft, head);
        g.add(p);
      }
    }
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  /** 안쪽 관: 바닥에서 시작해 바깥 관 안으로 들어간다. 발 고무 포함 */
  private buildInnerLegs(): void {
    const mat = steel({ roughness: 0.3 });
    const footMat = rubber();
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * LEG_X;
        const z = sz * LEG_Z;
        this.group.add(new THREE.Mesh(cylBetween(new THREE.Vector3(x, IN_BOT, z), new THREE.Vector3(x, IN_TOP, z), IN_R, 32), mat));
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, IN_BOT, 32), footMat);
        foot.position.set(x, IN_BOT / 2, z);
        this.group.add(foot);
      }
    }
  }

  /** 바깥 관(몸체에 붙음): 회전체 관 단면, 모서리 모따기 */
  private buildOuterLegs(): void {
    const geo = lathe(tubeProfile(OUT_RI, OUT_R, OUT_BOT, APRON_BOT, 0.008), 32);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(geo, this.frameMat);
        m.position.set(sx * LEG_X, 0, sz * LEG_Z);
        this.carriage.add(m);
      }
    }
  }

  /** 프레임 띠(상판을 받는 사각 띠) + 다리 위 브래킷 블록. 블록 뒤쪽에 볼트 너트가 물린다 */
  private buildFrame(): void {
    const c = this.carriage;
    const fm = this.frameMat;
    for (const sz of [-1, 1]) c.add(box(2.22, 0.12, 0.12, 0.01, fm, 0, APRON_MID, sz * 0.5));
    for (const sx of [-1, 1]) c.add(box(0.12, 0.12, 0.88, 0.01, fm, sx * 1.05, APRON_MID, 0));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) c.add(box(0.14, 0.12, 0.1, 0.01, fm, sx * LEG_X, APRON_MID, sz * 0.39));
    }
  }

  private buildTop(): void {
    this.top.add(box(TOP_W, TOP_T, TOP_D, 0.03, this.woodMat, 0, TOP_Y, 0));
  }

  /** 핀 구멍 표시(바깥 관 양쪽 면): 핀이 빠지면 검은 구멍이 보인다 */
  private buildHoleMarks(): void {
    const geo = new THREE.CylinderGeometry(0.016, 0.016, 0.01, 20);
    geo.rotateX(Math.PI / 2);
    const mat = plastic(0x0d0e10, { roughness: 0.9 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const side of [-1, 1]) {
          const m = new THREE.Mesh(geo, mat);
          m.position.set(sx * LEG_X, PIN_Y, sz * LEG_Z + side * OUT_R);
          this.carriage.add(m);
        }
      }
    }
  }

  /** 의자(고정): 강관 다리 4개, 뒷다리는 등받이 기둥으로 이어짐, 나무 좌판·등판 */
  private buildChair(): void {
    const c = new THREE.Group();
    c.position.set(0, 0, CHAIR_Z);
    const frame = paint(0x2468c9, { roughness: 0.4 });
    const seatMat = wood(0xc9975d);
    const footMat = rubber();
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * CH_X;
        const z = sz * CH_Z;
        const topY = sz > 0 ? BACK_TOP : RAIL_Y;
        c.add(new THREE.Mesh(cylBetween(new THREE.Vector3(x, FOOT_Y, z), new THREE.Vector3(x, topY, z), CH_TUBE), frame));
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, FOOT_Y, 20), footMat);
        foot.position.set(x, FOOT_Y / 2, z);
        c.add(foot);
      }
    }
    // 좌판 아래 가로대(앞뒤·좌우)
    for (const sz of [-1, 1]) {
      c.add(new THREE.Mesh(cylBetween(new THREE.Vector3(-CH_X, RAIL_Y, sz * CH_Z), new THREE.Vector3(CH_X, RAIL_Y, sz * CH_Z), CH_TUBE), frame));
    }
    for (const sx of [-1, 1]) {
      c.add(new THREE.Mesh(cylBetween(new THREE.Vector3(sx * CH_X, RAIL_Y, -CH_Z), new THREE.Vector3(sx * CH_X, RAIL_Y, CH_Z), CH_TUBE), frame));
    }
    c.add(box(SEAT_W, SEAT_H, SEAT_D, 0.03, seatMat, 0, SEAT_Y, 0));
    c.add(box(1.0, BACK_H, 0.05, 0.02, seatMat, 0, BACK_Y, BACK_Z));
    this.group.add(c);
  }
}
