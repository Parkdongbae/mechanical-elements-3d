// 컨베이어: 스프로킷과 체인 미션 — 기어드 모터 → 작은 스프로킷(12T) → 롤러 체인 → 큰 스프로킷(24T) → 구동 롤러 → 벨트 → 상자
// 체인 길이가 정확히 링크 수 × 피치가 되도록 모터 위치를 정하고, 두 스프로킷 위상을 맞춰 롤러가 이골에 앉게 한다.
// 체인은 경로(ChainPath2D)의 바깥을 감아 돌고, 링크 이동량 = 스프로킷 피치원 호장 → 잇수비만큼 감속.
// 좌표: +X = 상자 진행 방향(머리 쪽 = 구동), Y = 위, Z = 롤러 축(+Z = 체인 쪽, 카메라 쪽).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, castIron, chrome, darkSteel, glow, paint, plastic, rubber, steel } from '../models/materials';
import { ChainPath2D, buildChainAlongPath } from '../models/factory';
import { sprocketOutline } from '../models/parts/gears';
import { lathe, merge, extrude, type V2 } from '../models/parts/geom';

// ── 롤러·벨트 ──
const ROLLER_R = 0.14;
const ROLLER_Y = 1.0;
const HEAD_X = 1.9;
const TAIL_X = -1.9;
const BELT_T = 0.016;
const BELT_W = 0.9;
const RM = ROLLER_R + BELT_T / 2;
const BELT_TOP = ROLLER_Y + ROLLER_R + BELT_T;
const RAIL_IN = 0.48;
const RAIL_OUT = 0.515;
const RAIL_BOT = 0.84;
const RAIL_TOP = 1.13;
const LEG_X = 1.7;
const IDLER_R = 0.05;
const IDLER_X = [-1.2, -0.6, 0, 0.6, 1.2] as const;
const M_PER_UNIT = 0.35;

// ── 체인 구동 ──
const PITCH = 0.07;
const T_MOTOR = 12;
const T_ROLLER = 24;
const R1 = (PITCH * T_MOTOR) / (Math.PI * 2);
const R2 = (PITCH * T_ROLLER) / (Math.PI * 2);
const LINKS = 38;
const CHAIN_Z = 0.65;
const MOTOR_X = 1.42;
const MOTOR_RPM = 60;
/** 체인 길이 = LINKS × PITCH 가 되도록 모터 스프로킷 높이를 이분법으로 맞춘다 */
const MOTOR_Y = (() => {
  const len = (y: number) => new ChainPath2D(MOTOR_X, y, R1, HEAD_X, ROLLER_Y, R2).length;
  let lo = 0.2;
  let hi = 0.75;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (len(mid) > LINKS * PITCH) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();
const PLATE_TOP = MOTOR_Y - 0.15;
/** 스프로킷 초기 위상: 체인 롤러(호장 (k+½)·피치)가 이골 중심(위상 + i·step)에 오도록 */
const PHASE = (() => {
  const dx = HEAD_X - MOTOR_X;
  const dy = ROLLER_Y - MOTOR_Y;
  const D = Math.hypot(dx, dy);
  const delta = Math.acos((R2 - R1) / D);
  const aTop = Math.atan2(dy, dx) + Math.PI - delta;
  const topLen = Math.sqrt(D * D - (R2 - R1) ** 2);
  return { motor: aTop + (0.5 * PITCH) / R1, roller: aTop + (topLen - 0.5 * PITCH) / R2 };
})();
const SPR_MID = new THREE.Vector3((MOTOR_X + HEAD_X) / 2, (MOTOR_Y + ROLLER_Y) / 2, CHAIN_Z);

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function latheZ(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
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

/** 같은 반지름 두 롤러를 감는 벨트 경로. s = 0에서 꼬리 롤러 꼭대기, 윗면은 +X로 진행 */
class LoopPath {
  readonly length: number;
  private readonly D: number;
  constructor(private readonly x1: number, private readonly x2: number, private readonly y: number, private readonly rm: number) {
    this.D = x2 - x1;
    this.length = 2 * this.D + 2 * Math.PI * rm;
  }
  /** 경로 위 점의 중심(cx, cy)과 바깥 법선(nx, ny) */
  frame(s: number): { cx: number; cy: number; nx: number; ny: number } {
    let u = s % this.length;
    if (u < 0) u += this.length;
    const arc = Math.PI * this.rm;
    if (u < this.D) return { cx: this.x1 + u, cy: this.y, nx: 0, ny: 1 };
    u -= this.D;
    if (u < arc) {
      const p = Math.PI / 2 - u / this.rm;
      return { cx: this.x2, cy: this.y, nx: Math.cos(p), ny: Math.sin(p) };
    }
    u -= arc;
    if (u < this.D) return { cx: this.x2 - u, cy: this.y, nx: 0, ny: -1 };
    u -= this.D;
    const p = -Math.PI / 2 - u / this.rm;
    return { cx: this.x1, cy: this.y, nx: Math.cos(p), ny: Math.sin(p) };
  }
  samples(arcSegs: number): number[] {
    const out: number[] = [];
    const arc = Math.PI * this.rm;
    const push = (start: number, len: number, n: number) => {
      for (let i = 0; i < n; i++) out.push(start + (len * i) / n);
    };
    push(0, this.D, 8);
    push(this.D, arc, arcSegs);
    push(this.D + arc, this.D, 8);
    push(2 * this.D + arc, arc, arcSegs);
    out.push(this.length);
    return out;
  }
}

/** 두께 있는 벨트 띠. uv.x = s / 둘레 */
function bandGeometry(path: LoopPath, rIn: number, rOut: number, width: number, arcSegs: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ss = path.samples(arcSegs);
  const hw = width / 2;
  for (let face = 0; face < 4; face++) {
    const base = pos.length / 3;
    for (const s of ss) {
      const f = path.frame(s);
      const u = s / path.length;
      const pIn = [f.cx + f.nx * rIn, f.cy + f.ny * rIn];
      const pOut = [f.cx + f.nx * rOut, f.cy + f.ny * rOut];
      if (face < 2) {
        const p = face === 0 ? pOut : pIn;
        const sg = face === 0 ? 1 : -1;
        pos.push(p[0]!, p[1]!, -hw, p[0]!, p[1]!, hw);
        nor.push(f.nx * sg, f.ny * sg, 0, f.nx * sg, f.ny * sg, 0);
        uv.push(u, 0, u, 1);
      } else {
        const z = face === 2 ? hw : -hw;
        const nz = face === 2 ? 1 : -1;
        pos.push(pIn[0]!, pIn[1]!, z, pOut[0]!, pOut[1]!, z);
        nor.push(0, 0, nz, 0, 0, nz);
        uv.push(u, 0, u, 0.03);
      }
    }
    for (let i = 0; i < ss.length - 1; i++) {
      const a = base + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // 면마다 바깥을 향하도록 감기 순서 지정 (정점 쌍: 바깥·안쪽면은 -Z,+Z / 옆면은 안,밖)
      if (face === 0) idx.push(a, b, c, b, d, c);
      else if (face === 1) idx.push(a, c, b, b, c, d);
      else if (face === 2) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

interface Crate {
  obj: THREE.Group;
  s0: number;
}

export class Conveyor extends BaseMachine {
  readonly id = 'conveyor';
  private driveRoller = new THREE.Group();
  private tailRoller = new THREE.Group();
  private motorShaft = new THREE.Group();
  private idlers: THREE.Group[] = [];
  private sprocketModel: THREE.Group | null = null;
  private chainModel: THREE.Group | null = null;
  private smallSpr: THREE.Object3D | null = null;
  private bigSpr: THREE.Object3D | null = null;
  private beltPath = new LoopPath(TAIL_X, HEAD_X, ROLLER_Y, RM);
  private chainPath = new ChainPath2D(MOTOR_X, MOTOR_Y, R1, HEAD_X, ROLLER_Y, R2);
  private beltTex: THREE.CanvasTexture | null = null;
  private beltRepeats = 1;
  private crates: Crate[] = [];
  private readonly travel = HEAD_X - TAIL_X - 0.45;

  private readonly frameMat = paint(0xf0b323, { roughness: 0.42 });
  private readonly steelMat = steel();
  private readonly darkMat = darkSteel();

  constructor() {
    super();
    this.driveRoller.position.set(HEAD_X, ROLLER_Y, 0);
    this.tailRoller.position.set(TAIL_X, ROLLER_Y, 0);
    this.motorShaft.position.set(MOTOR_X, MOTOR_Y, 0);
    this.group.add(this.driveRoller, this.tailRoller, this.motorShaft);
    this.buildFrame();
    this.buildRollers();
    this.buildBelt();
    this.buildMotor();
    this.buildCrates();
    this.buildControl();

    this.addSlot(0, R2 + 0.02, new THREE.Vector3(HEAD_X, ROLLER_Y, CHAIN_Z), 0.018);
    this.addChainSlot();
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
      s.receiveShadow = false;
    }
    this.placeCrates(0);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.sprocketModel !== null : this.chainModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? SPR_MID.clone() : new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(HEAD_X, ROLLER_Y, CHAIN_Z + 0.05) : SPR_MID.clone().add(new THREE.Vector3(0, 0, 0.05));
  }

  buildStepModel(step: number): THREE.Group {
    let g: THREE.Group;
    if (step === 0) {
      g = new THREE.Group();
      const big = this.buildSprocket(T_ROLLER, R2, true);
      big.name = 'bigSpr';
      big.position.set(HEAD_X - SPR_MID.x, ROLLER_Y - SPR_MID.y, 0);
      big.rotation.z = PHASE.roller;
      const small = this.buildSprocket(T_MOTOR, R1, false);
      small.name = 'smallSpr';
      small.position.set(MOTOR_X - SPR_MID.x, MOTOR_Y - SPR_MID.y, 0);
      small.rotation.z = PHASE.motor;
      g.add(big, small);
    } else {
      g = buildChainAlongPath(this.chainPath, PITCH, CHAIN_Z);
    }
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      this.sprocketModel = model;
      // 각 스프로킷을 자기 축(롤러·모터 출력축)으로 옮겨 단다
      const big = model.getObjectByName('bigSpr');
      const small = model.getObjectByName('smallSpr');
      if (big) {
        this.driveRoller.add(big);
        big.position.set(0, 0, CHAIN_Z);
        big.rotation.set(0, 0, PHASE.roller);
        this.bigSpr = big;
      }
      if (small) {
        this.motorShaft.add(small);
        small.position.set(0, 0, CHAIN_Z);
        small.rotation.set(0, 0, PHASE.motor);
        this.smallSpr = small;
      }
      this.driveRoller.rotation.z = 0;
      this.motorShaft.rotation.z = 0;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(0, 0, 0);
      this.group.add(model);
      this.chainModel = model;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.bigSpr) this.driveRoller.remove(this.bigSpr);
    if (this.smallSpr) this.motorShaft.remove(this.smallSpr);
    if (this.chainModel) this.group.remove(this.chainModel);
    this.bigSpr = this.smallSpr = null;
    this.sprocketModel = this.chainModel = null;
    this.driveRoller.rotation.z = 0;
    this.tailRoller.rotation.z = 0;
    this.motorShaft.rotation.z = 0;
    for (const i of this.idlers) i.rotation.z = 0;
    if (this.beltTex) this.beltTex.offset.x = 0;
    this.placeCrates(0);
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.sprocketModel || !this.chainModel) throw new Error('conveyor mission incomplete');
    const chain = this.chainModel;
    const path = this.chainPath;
    let time = 0;
    let offset = 0; // 체인 이동 호장
    let rpm = 0;
    return {
      update: (dt: number) => {
        time += dt;
        rpm = MOTOR_RPM * smooth(time / 1.0);
        const wM = (rpm / 60) * Math.PI * 2;
        offset += wM * R1 * dt; // 작은 스프로킷 피치원 속도 = 체인 속도
        // 시계 방향(-z) 회전 = 체인 경로 +s = 벨트 윗면 +X
        this.motorShaft.rotation.z = -offset / R1;
        const angR = -offset / R2; // 같은 체인 이동량 / 큰 피치 반지름 → 잇수비만큼 감속
        this.driveRoller.rotation.z = angR;
        this.tailRoller.rotation.z = angR;
        const beltS = -angR * RM;
        for (const i of this.idlers) i.rotation.z = -beltS / IDLER_R;
        if (this.beltTex) this.beltTex.offset.x = -((this.beltRepeats * beltS) / this.beltPath.length) % 1;
        chain.children.forEach((o) => {
          const s = o.userData.s as number | undefined;
          if (typeof s === 'number') {
            const p = path.pointAt(s + offset);
            o.position.set(p.x, p.y, o.position.z);
            o.rotation.z = p.angle;
          }
        });
        this.placeCrates(beltS);
      },
      getDisplay: () => {
        const rollerRpm = (rpm * T_MOTOR) / T_ROLLER;
        const v = (rollerRpm / 60) * Math.PI * 2 * RM * M_PER_UNIT;
        return [
          { label: '모터 회전수', value: rpm.toFixed(0), unit: 'rpm' },
          { label: `롤러 회전수 (잇수 ${T_MOTOR}:${T_ROLLER})`, value: rollerRpm.toFixed(0), unit: 'rpm', tone: 'red' },
          { label: '벨트 속도', value: v.toFixed(2), unit: 'm/s', tone: 'blue' }
        ];
      }
    };
  }

  /** 상자 위치 = 벨트 이동량. 끝에 닿으면 작아지며 사라지고 처음 자리에서 다시 나타난다 */
  private placeCrates(beltS: number): void {
    const L = this.travel;
    for (const c of this.crates) {
      let u = (c.s0 + beltS) % L;
      if (u < 0) u += L;
      c.obj.position.x = TAIL_X + 0.2 + u;
      const k = Math.min(smooth(u / 0.18), smooth((L - u) / 0.18));
      c.obj.scale.setScalar(Math.max(0.001, k));
    }
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 롤러 체인용 스프로킷: 피치원 반지름 R, 이골 중심이 국소 각 0 + i·step */
  private buildSprocket(teeth: number, R: number, big: boolean): THREE.Group {
    const g = new THREE.Group();
    const chord = 2 * R * Math.sin(Math.PI / teeth);
    const outline = sprocketOutline(teeth, chord, PITCH * 0.31, 0);
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes.push(new THREE.Path().absarc(0, 0, big ? 0.026 : 0.023, 0, Math.PI * 2, true));
    if (big) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        shape.holes.push(new THREE.Path().absarc(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.18, 0, Math.PI * 2, true));
      }
    }
    g.add(new THREE.Mesh(extrude(shape, 0.022, 0.004, 12), steel({ color: 0xb9c1ca, roughness: 0.3 })));
    // 허브 보스 + 멈춤 나사 (전동용 = 빨강 포인트 링)
    const hubR = big ? 0.07 : 0.055;
    const sh = big ? 0.026 : 0.023;
    g.add(new THREE.Mesh(latheZ([[sh, -0.05], [hubR - 0.006, -0.05], [hubR, -0.044], [hubR, -0.011], [sh, -0.011], [sh, -0.05]], 40), this.darkMat));
    g.add(new THREE.Mesh(latheZ([[hubR * 0.62, 0.011], [hubR * 0.9, 0.011], [hubR * 0.9, 0.016], [hubR * 0.62, 0.016], [hubR * 0.62, 0.011]], 40), paint(CATEGORY_COLORS.power, { roughness: 0.35 })));
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6), this.steelMat);
    screw.position.set(0, hubR + 0.005, -0.03);
    g.add(screw);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildFrame(): void {
    const g = this.group;
    const fm = this.frameMat;
    // C형강 옆 레일(웹 + 위·아래 플랜지)
    for (const s of [-1, 1]) {
      const zc = s * (RAIL_IN + RAIL_OUT) / 2;
      g.add(box(4.04, RAIL_TOP - RAIL_BOT, RAIL_OUT - RAIL_IN, 0.008, fm, 0, (RAIL_TOP + RAIL_BOT) / 2, zc));
      for (const y of [RAIL_TOP - 0.01, RAIL_BOT + 0.01]) {
        g.add(box(4.04, 0.02, 0.07, 0.006, fm, 0, y, s * (RAIL_OUT + 0.035 - 0.005)));
      }
    }
    // 다리 4 + 발 + 가로·세로 보강대(모터 판 받침)
    const braceY = PLATE_TOP - 0.03 - 0.025;
    const footMat = rubber();
    for (const x of [-LEG_X, LEG_X]) {
      for (const s of [-1, 1]) {
        g.add(box(0.07, RAIL_BOT, 0.07, 0.01, fm, x, RAIL_BOT / 2, s * 0.5));
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.025, 24), footMat);
        foot.position.set(x, 0.0125, s * 0.5);
        g.add(foot);
      }
      g.add(box(0.05, 0.05, 0.93, 0.008, fm, x, braceY, 0));
    }
    for (const s of [-1, 1]) {
      g.add(box(2 * LEG_X, 0.05, 0.05, 0.008, fm, 0, braceY, s * 0.5));
    }
    // 모터 받침판
    const plate = box(0.52, 0.03, 1.0, 0.006, castIron({ color: 0x555c64 }), LEG_X - 0.035 - 0.26, PLATE_TOP - 0.015, 0);
    g.add(plate);
  }

  private buildRollers(): void {
    const rollerMat = steel({ color: 0xc9d0d8, roughness: 0.3 });
    const capMat = this.darkMat;
    const L = RAIL_IN - 0.015;
    for (const [grp, drive] of [[this.driveRoller, true], [this.tailRoller, false]] as const) {
      // 롤러 관(가운데가 살짝 불룩한 크라운) + 끝판 + 볼트(회전 표식)
      grp.add(new THREE.Mesh(latheZ([[0.03, -L], [ROLLER_R - 0.008, -L], [ROLLER_R, -L + 0.008], [ROLLER_R + 0.004, 0], [ROLLER_R, L - 0.008], [ROLLER_R - 0.008, L], [0.03, L]], 64), rollerMat));
      const bolts: THREE.BufferGeometry[] = [];
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const b = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6);
          b.rotateX(Math.PI / 2);
          b.translate(Math.cos(a) * 0.08, Math.sin(a) * 0.08, s * (L + 0.004));
          bolts.push(b);
        }
      }
      grp.add(new THREE.Mesh(merge(bolts), capMat));
      const zEnd = drive ? CHAIN_Z + 0.05 : 0.6;
      grp.add(new THREE.Mesh(latheZ([[0, -0.6], [0.025, -0.598], [0.025, zEnd - 0.003], [0.021, zEnd], [0, zEnd]], 24), this.steelMat));
    }
    // 베어링 받침(필로 블록): 레일 바깥면에 볼트 고정
    const pbMat = castIron({ color: 0x3c4249 });
    for (const x of [HEAD_X, TAIL_X]) {
      for (const s of [-1, 1]) {
        const z = s * (RAIL_OUT + 0.035);
        this.group.add(box(0.2, 0.12, 0.07, 0.015, pbMat, x, ROLLER_Y, z));
        const ring = new THREE.Mesh(latheZ([[0.026, -0.04], [0.05, -0.04], [0.05, 0.04], [0.026, 0.04], [0.026, -0.04]], 32), chrome());
        ring.position.set(x, ROLLER_Y, z);
        this.group.add(ring);
        for (const bx of [-0.07, 0.07]) {
          const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), this.steelMat);
          bolt.rotation.x = Math.PI / 2;
          bolt.position.set(x + bx, ROLLER_Y, z);
          this.group.add(bolt);
        }
      }
    }
    // 상부 아이들러 롤러: 꼭대기가 벨트 안쪽면에 닿는다
    const idlerMat = steel({ color: 0xaeb6bf, roughness: 0.35 });
    for (const x of IDLER_X) {
      const idl = new THREE.Group();
      idl.position.set(x, ROLLER_Y + ROLLER_R - IDLER_R, 0);
      idl.add(new THREE.Mesh(latheZ([[0.012, -L], [IDLER_R - 0.005, -L], [IDLER_R, -L + 0.005], [IDLER_R, L - 0.005], [IDLER_R - 0.005, L], [0.012, L]], 32), idlerMat));
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.006), capMat);
      mark.position.set(0, 0.03, L + 0.003);
      idl.add(mark);
      this.group.add(idl);
      this.idlers.push(idl);
      const ax = new THREE.Mesh(latheZ([[0, -RAIL_OUT - 0.02], [0.012, -RAIL_OUT - 0.02], [0.012, RAIL_OUT + 0.02], [0, RAIL_OUT + 0.02]], 12), this.steelMat);
      ax.position.copy(idl.position);
      this.group.add(ax);
      for (const s of [-1, 1]) {
        const nut = new THREE.Mesh(latheZ(s > 0 ? [[0, RAIL_OUT], [0.02, RAIL_OUT], [0.02, RAIL_OUT + 0.018], [0, RAIL_OUT + 0.018]] : [[0, -RAIL_OUT - 0.018], [0.02, -RAIL_OUT - 0.018], [0.02, -RAIL_OUT], [0, -RAIL_OUT]], 6), this.steelMat);
        nut.position.copy(idl.position);
        this.group.add(nut);
      }
    }
  }

  private buildBelt(): void {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2f6a45';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 2;
      for (let i = -256; i < 256; i += 9) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 256, 256);
        ctx.stroke();
      }
      // 이음매(가로줄) + 흰 화살표 표식 — 벨트가 흐르는 방향이 보인다
      ctx.fillStyle = '#24543a';
      ctx.fillRect(0, 0, 10, 256);
      ctx.fillStyle = '#e9efe9';
      ctx.beginPath();
      ctx.moveTo(196, 128);
      ctx.lineTo(150, 98);
      ctx.lineTo(150, 116);
      ctx.lineTo(108, 116);
      ctx.lineTo(108, 140);
      ctx.lineTo(150, 140);
      ctx.lineTo(150, 158);
      ctx.closePath();
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    this.beltRepeats = Math.round(this.beltPath.length / 0.7);
    tex.repeat.set(this.beltRepeats, 1);
    this.beltTex = tex;
    const mat = rubber({ roughness: 0.75 });
    mat.color.set(0xffffff);
    mat.map = tex;
    const belt = new THREE.Mesh(bandGeometry(this.beltPath, RM - BELT_T / 2, RM + BELT_T / 2, BELT_W, 48), mat);
    this.group.add(belt);
  }

  private buildMotor(): void {
    const g = new THREE.Group();
    g.position.set(MOTOR_X, MOTOR_Y, 0);
    this.group.add(g);
    const body = paint(0x5d6f80, { roughness: 0.45 });
    // 감속기 하우징(출력축 쪽)
    g.add(box(0.3, 0.3, 0.22, 0.03, body, 0, 0, 0.41));
    g.add(new THREE.Mesh(latheZ([[0.03, 0.52], [0.075, 0.52], [0.08, 0.525], [0.08, 0.55], [0.03, 0.55]], 40), castIron()));
    // 모터 몸통: 냉각 핀 + 팬 커버
    const prof: V2[] = [[0.0, -0.33], [0.1, -0.33], [0.125, -0.315], [0.125, -0.25]];
    for (let i = 0; i < 9; i++) {
      const z = -0.24 + i * 0.058;
      prof.push([0.112, z], [0.13, z + 0.008], [0.13, z + 0.03], [0.112, z + 0.038]);
    }
    prof.push([0.112, 0.3], [0, 0.3]);
    g.add(new THREE.Mesh(latheZ(prof, 56), body));
    const grill = new THREE.Mesh(latheZ([[0, -0.336], [0.09, -0.336], [0.09, -0.331], [0, -0.331]], 40), plastic(0x1e2125, { roughness: 0.6 }));
    g.add(grill);
    // 단자함 + 발(받침판에 볼트)
    g.add(box(0.14, 0.07, 0.16, 0.012, body, 0, 0.15, 0.0));
    g.add(box(0.36, 0.03, 0.12, 0.006, castIron({ color: 0x4a5058 }), 0, -0.135, 0.41));
    g.add(box(0.28, 0.03, 0.4, 0.006, castIron({ color: 0x4a5058 }), 0, -0.135, -0.05));
    for (const z of [-0.2, 0.1]) {
      g.add(box(0.06, 0.012, 0.03, 0.004, this.darkMat, 0, -0.123, z).translateX(0.12), box(0.06, 0.012, 0.03, 0.004, this.darkMat, 0, -0.123, z).translateX(-0.12));
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), glow(0x46d17a, 0.9));
    lamp.position.set(0.05, 0.19, 0.06);
    g.add(lamp);
    // 출력축 + 키(회전 표식)
    this.motorShaft.add(new THREE.Mesh(latheZ([[0, 0.55], [0.022, 0.55], [0.022, CHAIN_Z + 0.045], [0.018, CHAIN_Z + 0.05], [0, CHAIN_Z + 0.05]], 24), this.steelMat));
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.06), this.darkMat);
    key.position.set(0, 0.024, CHAIN_Z + 0.015);
    this.motorShaft.add(key);
  }

  private buildCrates(): void {
    const card = plastic(0xc59b63, { roughness: 0.85 });
    const tape = plastic(0xe2cf9f, { roughness: 0.5 });
    const label = paint(0xf4f6f8, { roughness: 0.5 });
    const sizes: [number, number, number][] = [
      [0.46, 0.36, 0.44],
      [0.4, 0.3, 0.5],
      [0.5, 0.42, 0.42]
    ];
    sizes.forEach(([w, h, d], i) => {
      const o = new THREE.Group();
      const inner = new THREE.Group();
      inner.add(box(w, h, d, 0.014, card, 0, h / 2, 0));
      inner.add(box(w + 0.006, 0.01, 0.08, 0.003, tape, 0, h + 0.002, 0));
      const lab = box(0.14, 0.1, 0.006, 0.002, label, w * 0.15, h * 0.55, d / 2 + 0.002);
      inner.add(lab);
      inner.rotation.y = (i - 1) * 0.08;
      o.add(inner);
      o.position.set(0, BELT_TOP, (i - 1) * 0.06);
      this.group.add(o);
      this.crates.push({ obj: o, s0: 0.35 + (i * this.travel) / 3 });
    });
  }

  /** 꼬리 쪽 다리의 조작함(시작·정지 버튼) */
  private buildControl(): void {
    const g = this.group;
    const x = -LEG_X;
    const z = 0.5 + 0.035 + 0.06;
    g.add(box(0.16, 0.22, 0.12, 0.015, paint(0x4b5560, { roughness: 0.5 }), x, 0.7, z));
    const green = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 20), plastic(0x2fa35a, { roughness: 0.35 }));
    green.rotation.x = Math.PI / 2;
    green.position.set(x, 0.74, z + 0.065);
    const red = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.024, 20), plastic(0xd8362f, { roughness: 0.35 }));
    red.rotation.x = Math.PI / 2;
    red.position.set(x, 0.665, z + 0.066);
    g.add(green, red);
    // 조작함 → 모터 케이블
    const pts = [
      new THREE.Vector3(x, 0.59, z),
      new THREE.Vector3(x + 0.1, braceYFor(), 0.55),
      new THREE.Vector3(MOTOR_X - 0.6, braceYFor() + 0.02, 0.45),
      new THREE.Vector3(MOTOR_X, MOTOR_Y + 0.19, 0.08)
    ];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.011, 8, false), plastic(0x1c1d20, { roughness: 0.45 })));
  }

  private addChainSlot(): void {
    const pts: THREE.Vector3[] = Array.from({ length: 120 }, (_, i) => {
      const p = this.chainPath.pointAt((i / 120) * this.chainPath.length);
      return new THREE.Vector3(p.x, p.y, CHAIN_Z);
    });
    const ring = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.016, 8, true),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.userData.slot = true;
    this.slots[1] = ring;
    this.group.add(ring);
  }
}

function braceYFor(): number {
  return PLATE_TOP - 0.03 - 0.025 + 0.04;
}
