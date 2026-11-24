// 자전거 구동계 3D: 프레임 뒤 삼각 일부 + 크랭크·체인링 + 카세트 + 체인 + 앞·뒤 변속기 + 뒷바퀴 + 트레이너.
// 체인은 ChainLoop(스프로킷 바깥을 감는 경로)를 따라 InstancedMesh 2개(안/바깥 링크)로 그린다.
// 회전 부품은 체인 진행 거리로부터 각도를 얻고, 롤러가 이골에 앉도록 위상을 살짝 보정한다.

import * as THREE from 'three';
import { sprocketOutline } from '../../models/parts/gears';
import { chainLinkGeometry, chainMaterial } from '../../models/parts/chain';
import { merge, extrude, shapeFrom, pathFrom, circlePts, kidneyPath, stadiumShape, lathe, type V2 } from '../../models/parts/geom';
import { paint, steel, darkSteel, chrome, aluminum, rubber, plastic } from '../../models/materials';
import { disposeObject } from '../../models/factory';
import type { BikeSpec } from './spec';
import { makeBase, solveRig, stateFor, PITCH, ROLLER_R, S, type Base, type DriveState, type Rig } from './layout';
import { approachPhase, type LoopPoint } from './chainLoop';
import { localAnchor, type LabelSpec, type Anchor } from '../common/labels';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const SHIFT_DUR = 0.6;
const CRANK_LEN = 0.17 * S;
const SEAT_ANG = (180 - 73.5) * DEG;

// ── 지오메트리 헬퍼 ──

function zCyl(r: number, z0: number, z1: number, seg = 32, x = 0, y = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 24, r2 = r): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r2, r, dir.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

function ball(p: THREE.Vector3, r: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 24, 16);
  g.translate(p.x, p.y, p.z);
  return g;
}

/** (반지름, z) 프로파일을 Z축 둘레로 회전 */
function latheZ(profile: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(profile, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

function mk(geo: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, receive = false): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 롤러 체인용 스프로킷 판(이골 0번이 로컬 각도 0) */
function sprocketGeo(teeth: number, thick: number, bore: number, windows: { n: number; r0: number; r1: number } | null): THREE.BufferGeometry {
  const shape = shapeFrom(sprocketOutline(teeth, PITCH, ROLLER_R, 0));
  shape.holes.push(pathFrom(circlePts(bore, 40).reverse()));
  if (windows) {
    const mid = (windows.r0 + windows.r1) / 2;
    const half = (windows.r1 - windows.r0) / 2;
    const span = TAU / windows.n;
    for (let i = 0; i < windows.n; i++) {
      const a0 = i * span + span * 0.18;
      const a1 = (i + 1) * span - span * 0.18;
      shape.holes.push(kidneyPath(mid, half, a0, a1));
    }
  }
  return extrude(shape, thick, thick * 0.18, 12);
}

/** 두 점 사이에 단위 상자를 놓는다(변속기 링크처럼 매 프레임 움직이는 막대) */
function placeBar(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, h: number, w: number): void {
  const d = b.clone().sub(a);
  const len = d.length();
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(X_AXIS, d.normalize());
  m.scale.set(Math.max(0.001, len), h, w);
}

const easeInOut = (k: number): number => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export class BikeDrive {
  readonly group = new THREE.Group();
  readonly base: Base;
  front: number;
  rear: number;

  private st: DriveState;
  private from: DriveState;
  private to: DriveState;
  private shiftT = SHIFT_DUR;
  private rig: Rig;

  private offset = 0;
  private psiCrank = 0;
  private psiWheel = 0;
  private psiG = 0;
  private psiT = 0;

  private crank = new THREE.Group();
  private pedals: THREE.Object3D[] = [];
  private wheel = new THREE.Group();
  private chainIn: THREE.InstancedMesh;
  private chainOut: THREE.InstancedMesh;
  private links: number;
  private cage = new THREE.Group();
  private pulleyG = new THREE.Group();
  private pulleyT = new THREE.Group();
  private pKnuckle: THREE.Mesh;
  private rdLinks: THREE.Mesh[] = [];
  private bKnuckle = new THREE.Vector3();
  private fdCage: THREE.Group | null = null;
  private fdArm: THREE.Mesh | null = null;
  private fdMount = new THREE.Vector3();

  // 매 프레임 재사용
  private pt: LoopPoint = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 };
  private pt2: LoopPoint = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 };
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);

  constructor(readonly spec: BikeSpec, front: number, rear: number) {
    this.base = makeBase(spec);
    this.front = front;
    this.rear = rear;
    this.st = stateFor(this.base, front, rear);
    this.from = { ...this.st };
    this.to = { ...this.st };
    this.rig = solveRig(this.base, this.st);

    this.buildFrame();
    this.buildWheel();
    this.buildCassette();
    this.buildCrank();
    this.buildStand();
    const rd = this.buildRearDerailleur();
    this.pKnuckle = rd;
    if (spec.rings.length > 1) this.buildFrontDerailleur();

    this.links = Math.round(this.base.chainLen / PITCH);
    const half = this.links / 2;
    const cm = chainMaterial();
    this.chainIn = new THREE.InstancedMesh(chainLinkGeometry(PITCH, true), cm, half);
    this.chainOut = new THREE.InstancedMesh(chainLinkGeometry(PITCH, false), cm, half);
    for (const c of [this.chainIn, this.chainOut]) {
      c.castShadow = true;
      c.receiveShadow = true;
      c.frustumCulled = false;
      this.group.add(c);
    }

    // 초기 위상: 바로 이골에 맞춘다
    this.applyPhases(0, 0, true);
    this.layoutDynamic();
  }

  /** 카메라 기준점(구동계 중심) */
  center(): THREE.Vector3 {
    return new THREE.Vector3((this.base.rx + this.base.bx) / 2, (this.base.ry + this.base.by) / 2 - 0.05, 0.15);
  }

  isShifting(): boolean {
    return this.shiftT < SHIFT_DUR;
  }

  shiftTo(front: number, rear: number): void {
    if (front === this.front && rear === this.rear) return;
    this.from = { ...this.st };
    this.front = front;
    this.rear = rear;
    this.to = stateFor(this.base, front, rear);
    this.shiftT = 0;
  }

  /** 지금 단의 이름표 글자(변속하면 잇수가 바뀐다) */
  ringText(): string {
    return `체인링(앞 스프로킷) ${this.spec.rings[this.front]}T`;
  }

  cogText(): string {
    return `뒤 스프로킷 ${this.spec.cogs[this.rear]}T`;
  }

  /** 이름표 목록(지시서 18 4-1). 기준점은 모두 매 프레임 현재 자세를 읽는다 */
  anchors(): LabelSpec[] {
    const b = this.base;
    const rMax = b.ringR[b.ringR.length - 1]!;
    const g = this.group;
    const fixed = (x: number, y: number, z: number): Anchor => (out) => {
      g.updateWorldMatrix(true, false);
      out.set(x, y, z).applyMatrix4(g.matrixWorld);
      return true;
    };
    const live = (f: (o: THREE.Vector3) => void): Anchor => (out) => {
      f(out);
      g.updateWorldMatrix(true, false);
      out.applyMatrix4(g.matrixWorld);
      return true;
    };
    const list: LabelSpec[] = [
      {
        key: 'ring',
        text: this.ringText(),
        // 지금 물린 체인링의 아래쪽 이끝
        at: live((o) => o.set(b.bx + this.st.ringR * 0.5, b.by - this.st.ringR * 0.866, this.st.ringZ + 0.01)),
        side: 'below',
        priority: 1,
        tone: 'power'
      },
      {
        key: 'cog',
        text: this.cogText(),
        // 지금 물린 뒤 스프로킷의 위쪽 이끝
        at: live((o) => o.set(b.rx - this.st.cogR * 0.5, b.ry + this.st.cogR * 0.866, this.st.cogZ + 0.01)),
        side: 'above',
        priority: 1,
        tone: 'shaft'
      },
      {
        key: 'chain',
        text: '체인',
        at: live((o) => o.set((b.bx + b.rx) / 2, (b.by + this.st.ringR + b.ry + this.st.cogR) / 2, (this.st.ringZ + this.st.cogZ) / 2)),
        side: 'above',
        priority: 1
      },
      {
        key: 'rd',
        text: '뒤 변속기',
        at: live((o) => o.set((this.rig.gx + this.rig.tx) / 2, (this.rig.gy + this.rig.ty) / 2, this.st.cogZ + 0.06)),
        side: 'below',
        priority: 2,
        tone: 'control'
      }
    ];
    if (this.spec.rings.length > 1) {
      const topR = rMax + 0.12;
      list.push({
        key: 'fd',
        text: '앞 변속기',
        at: (out) => (this.fdCage ? localAnchor(this.fdCage, Math.cos(SEAT_ANG) * topR, Math.sin(SEAT_ANG) * topR, 0.05)(out) : false),
        side: 'left',
        priority: 2,
        tone: 'control'
      });
    }
    list.push(
      { key: 'pulley', text: '텐션 풀리', at: live((o) => o.set(this.rig.tx, this.rig.ty, this.st.cogZ + 0.06)), side: 'right', priority: 3, tone: 'control' },
      { key: 'crank', text: '크랭크', at: localAnchor(this.crank, CRANK_LEN * 0.5, 0, b.ringZ[b.ringZ.length - 1]! + 0.1), side: 'left', priority: 2 },
      { key: 'pedal', text: '페달', at: (out) => (this.pedals[0] ? localAnchor(this.pedals[0], 0, 0.03, 0.4)(out) : false), side: 'below', priority: 2 },
      { key: 'wheel', text: '뒷바퀴', at: fixed(b.rx + Math.cos(4.6) * b.wheelR, b.ry + Math.sin(4.6) * b.wheelR, 0), side: 'left', priority: 2 },
      { key: 'axle', text: '차축(뒷바퀴 축)', at: fixed(b.rx, b.ry, b.hubHalf + 0.07), side: 'right', priority: 2 },
      { key: 'frame', text: '프레임', at: fixed(b.bx + Math.cos(SEAT_ANG), b.by + Math.sin(SEAT_ANG), 0.07), side: 'left', priority: 3 }
    );
    return list;
  }

  /** cadence: 페달 rpm, scale: 화면 재생 배속(느리게 보기) */
  update(dt: number, cadence: number, scale: number): void {
    if (this.shiftT < SHIFT_DUR) {
      this.shiftT = Math.min(SHIFT_DUR, this.shiftT + dt);
      // 실제처럼 체인이 먼저 옆으로 밀리고, 이어서 새 톱니로 올라탄다
      const kz = easeInOut(this.shiftT / (SHIFT_DUR * 0.75));
      const kr = easeInOut((this.shiftT - SHIFT_DUR * 0.25) / (SHIFT_DUR * 0.75));
      this.st.ringZ = THREE.MathUtils.lerp(this.from.ringZ, this.to.ringZ, kz);
      this.st.cogZ = THREE.MathUtils.lerp(this.from.cogZ, this.to.cogZ, kz);
      this.st.ringR = THREE.MathUtils.lerp(this.from.ringR, this.to.ringR, kr);
      this.st.cogR = THREE.MathUtils.lerp(this.from.cogR, this.to.cogR, kr);
      this.rig = solveRig(this.base, this.st);
    }
    const wc = ((cadence * TAU) / 60) * scale; // 크랭크 각속도 rad/s
    const v = wc * this.st.ringR; // 체인 속도
    this.offset += v * dt;
    this.applyPhases(dt, v, false);
    this.layoutDynamic();
  }

  private applyPhases(dt: number, v: number, snap: boolean): void {
    const loop = this.rig.loop;
    const b = this.base;
    const corr = snap ? 10 : 1.2 * dt; // 위상 보정 한도(rad)
    const stepRing = TAU / this.spec.rings[this.front]!;
    const stepCog = TAU / this.spec.cogs[this.rear]!;
    const stepP = TAU / this.spec.pulleyTeeth;
    // 구동측에서 보아 시계 방향(각도 감소)이 전진
    this.psiCrank = approachPhase(this.psiCrank - (v / this.st.ringR) * dt, loop.seatAngle(1, this.offset, PITCH), stepRing, corr);
    this.psiWheel = approachPhase(this.psiWheel - (v / this.st.cogR) * dt, loop.seatAngle(0, this.offset, PITCH), stepCog, corr);
    this.psiT = approachPhase(this.psiT - (v / b.pulleyR) * dt, loop.seatAngle(2, this.offset, PITCH), stepP, corr);
    this.psiG = approachPhase(this.psiG + (v / b.pulleyR) * dt, loop.seatAngle(3, this.offset, PITCH), stepP, corr);
  }

  private layoutDynamic(): void {
    const rig = this.rig;
    this.crank.rotation.z = this.psiCrank;
    for (const p of this.pedals) p.rotation.z = -this.psiCrank;
    this.wheel.rotation.z = this.psiWheel;

    // 뒤 변속기 케이지
    this.cage.position.set(rig.gx, rig.gy, this.st.cogZ);
    this.cage.rotation.z = rig.phi;
    this.pulleyG.rotation.z = this.psiG - rig.phi;
    this.pulleyT.rotation.z = this.psiT - rig.phi;
    // P-너클: 케이지 윗부분(위 풀리 뒤쪽)에 붙어 케이지 회전축을 품는다
    const pk = V3(rig.gx - 0.075, rig.gy + 0.05, this.st.cogZ + 0.085);
    this.pKnuckle.position.copy(pk);
    const l0 = this.rdLinks[0];
    const l1 = this.rdLinks[1];
    if (l0 && l1) {
      // 평행사변형 링크 2장(위·아래) — 변속 때 옆으로 비스듬히 움직여 케이지를 다른 스프로킷 아래로 보낸다
      placeBar(l0, this.bKnuckle.clone().add(V3(0.005, 0.032, 0.012)), pk.clone().add(V3(0.005, 0.032, 0.012)), 0.04, 0.03);
      placeBar(l1, this.bKnuckle.clone().add(V3(-0.005, -0.032, -0.012)), pk.clone().add(V3(-0.005, -0.032, -0.012)), 0.04, 0.03);
    }

    // 앞 변속기 케이지
    if (this.fdCage && this.fdArm) {
      this.fdCage.position.z = this.st.ringZ;
      const top = this.fdCage.userData.top as THREE.Vector3;
      placeBar(this.fdArm, this.fdMount, V3(top.x, top.y, this.st.ringZ + 0.045), 0.075, 0.05);
    }

    // 체인 링크: 이음매(롤러) 두 점 사이에 링크를 놓는다
    const loop = rig.loop;
    const P = PITCH;
    let ii = 0;
    let oi = 0;
    loop.pointAt(this.offset - P * 0.5, this.pt);
    for (let i = 0; i < this.links; i++) {
      const a = i % 2 === 0 ? this.pt : this.pt2;
      const c = i % 2 === 0 ? this.pt2 : this.pt;
      loop.pointAt(this.offset + (i + 0.5) * P, c);
      this.v.set(c.x - a.x, c.y - a.y, c.z - a.z).normalize();
      this.q.setFromUnitVectors(X_AXIS, this.v);
      this.m4.compose(this.v.set((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2), this.q, this.one);
      if (i % 2 === 0) this.chainIn.setMatrixAt(ii++, this.m4);
      else this.chainOut.setMatrixAt(oi++, this.m4);
    }
    this.chainIn.instanceMatrix.needsUpdate = true;
    this.chainOut.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    disposeObject(this.group);
  }

  // ─────────────────────────── 고정 구조 ───────────────────────────

  private buildFrame(): void {
    const b = this.base;
    const geos: THREE.BufferGeometry[] = [];
    const st = new THREE.Vector2(Math.cos(SEAT_ANG), Math.sin(SEAT_ANG));
    const at = (d: number) => V3(b.bx + st.x * d, b.by + st.y * d, 0);
    const stTop = at(1.95);
    // 시트튜브(위쪽은 잘라낸 단면), 다운튜브·탑튜브 일부
    geos.push(cylBetween(at(-0.05), stTop, 0.064, 40));
    const dtDir = new THREE.Vector3(Math.cos(48 * DEG), Math.sin(48 * DEG), 0);
    geos.push(cylBetween(V3(b.bx, b.by, 0), V3(b.bx, b.by, 0).addScaledVector(dtDir, 1.15), 0.078, 40));
    const ttStart = at(1.78);
    geos.push(cylBetween(ttStart, ttStart.clone().add(V3(1.0, 0.07, 0)), 0.064, 40));
    geos.push(ball(ttStart, 0.066));
    // BB 쉘(폭 68mm)
    const shellHalf = 0.034 * S;
    const shell = latheZ([[0, -shellHalf], [0.075, -shellHalf], [0.084, -shellHalf + 0.01], [0.084, shellHalf - 0.01], [0.075, shellHalf], [0, shellHalf]], 48);
    shell.translate(b.bx, b.by, 0);
    geos.push(shell);
    // 체인스테이·시트스테이 → 드롭아웃
    const ssTop = at(1.62);
    const dropZ = b.hubHalf + 0.018;
    for (const s of [1, -1]) {
      const drop = V3(b.rx, b.ry, s * dropZ);
      geos.push(cylBetween(V3(b.bx - 0.1, b.by, s * 0.09), drop.clone().add(V3(0.07, 0, 0)), 0.03, 24, 0.042));
      geos.push(cylBetween(V3(ssTop.x, ssTop.y, s * 0.07), drop.clone().add(V3(0.04, 0.06, 0)), 0.026, 24, 0.03));
      geos.push(ball(V3(ssTop.x, ssTop.y, s * 0.07), 0.032));
      const dShape = stadiumShape(0, 0, 0.1, 0.06, 0.07);
      const dGeo = extrude(dShape, 0.03, 0.006, 16);
      dGeo.translate(b.rx, b.ry, s * dropZ);
      geos.push(dGeo);
    }
    // 시트스테이 브리지
    const br = V3(ssTop.x, ssTop.y, 0).lerp(V3(b.rx, b.ry, 0), 0.45);
    geos.push(cylBetween(V3(br.x, br.y, -0.1), V3(br.x, br.y, 0.1), 0.02, 16));
    mk(merge(geos), paint(this.spec.frameColor), this.group, true);
    // 잘라낸 튜브 단면(안쪽이 보이는 어두운 원)
    const caps: THREE.BufferGeometry[] = [];
    const capAt = (p: THREE.Vector3, dir: THREE.Vector3, r: number) => {
      const g = new THREE.CircleGeometry(r * 0.82, 32);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()));
      g.translate(p.x + dir.x * 0.001, p.y + dir.y * 0.001, p.z + dir.z * 0.001);
      caps.push(g);
    };
    capAt(stTop, V3(st.x, st.y, 0), 0.064);
    capAt(V3(b.bx, b.by, 0).addScaledVector(dtDir, 1.15), dtDir, 0.078);
    capAt(ttStart.clone().add(V3(1.0, 0.07, 0)), V3(1.0, 0.07, 0), 0.064);
    mk(merge(caps), plastic(0x15181d), this.group);

    // 뒤 변속기 행어(드롭아웃 아래로)
    const hz = dropZ + 0.026;
    this.bKnuckle.set(b.rx - 0.01, b.ry - 0.12, hz + 0.055);
    const hanger = extrude(stadiumShape(0, 0, -0.01, -0.12, 0.045), 0.022, 0.005, 16);
    hanger.translate(b.rx, b.ry, hz);
    const hMat = darkSteel();
    mk(hanger, hMat, this.group);
    // 뒤 변속기 B-너클(행어에 고정)
    const bk = new THREE.Mesh(zCyl(0.05, hz + 0.01, hz + 0.1, 32, this.bKnuckle.x, this.bKnuckle.y), aluminum({ color: 0x30343b }));
    bk.castShadow = true;
    this.group.add(bk);
  }

  private buildWheel(): void {
    const b = this.base;
    const w = this.wheel;
    w.position.set(b.rx, b.ry, 0);
    this.group.add(w);
    const RT = b.rimR + b.tireTube * 0.95;
    const tube = b.tireTube;
    const tireGeo = new THREE.TorusGeometry(RT, tube, 24, 320);
    const knobby = this.spec.id === 'mtb';
    const p = tireGeo.attributes.position as THREE.BufferAttribute;
    const vv = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      vv.fromBufferAttribute(p, i);
      const th = Math.atan2(vv.y, vv.x);
      const cx = Math.cos(th) * RT;
      const cy = Math.sin(th) * RT;
      const dx = vv.x - cx;
      const dy = vv.y - cy;
      const out = (dx * Math.cos(th) + dy * Math.sin(th)) / tube;
      if (out > 0.3) {
        const band = THREE.MathUtils.smoothstep(out, 0.3, 0.7);
        const zc = vv.z / tube;
        const pat = knobby
          ? THREE.MathUtils.smoothstep(Math.sin(th * 70) * Math.cos(zc * 4.5), 0.1, 0.4) * 0.16
          : this.spec.id === 'city'
            ? THREE.MathUtils.smoothstep(Math.sin(th * 110 + Math.abs(zc) * 3), -0.2, 0.2) * 0.05
            : 0;
        const k = 1 + pat * band;
        vv.set(cx + dx * k, cy + dy * k, vv.z * k);
        p.setXYZ(i, vv.x, vv.y, vv.z);
      }
    }
    tireGeo.computeVertexNormals();
    mk(tireGeo, rubber({ color: 0x1d1f23 }), w, true);

    const rw = Math.max(0.07, this.spec.tireWidth * S * 0.62);
    const r0 = b.rimR;
    const rim = latheZ(
      [
        [r0 - 0.08, -rw * 0.3], [r0 - 0.03, -rw * 0.5], [r0 + 0.012, -rw * 0.5], [r0 + 0.02, -rw * 0.42], [r0 + 0.006, -rw * 0.36],
        [r0 + 0.006, rw * 0.36], [r0 + 0.02, rw * 0.42], [r0 + 0.012, rw * 0.5], [r0 - 0.03, rw * 0.5], [r0 - 0.08, rw * 0.3], [r0 - 0.08, -rw * 0.3]
      ],
      160
    );
    mk(rim, aluminum({ color: 0x2c3036, roughness: 0.35 }), w);

    // 허브: 플랜지 2장 + 프리허브 바디(카세트 자리)
    const flD = 0.019 * S;
    const flN = -0.035 * S;
    const lock = b.hubHalf;
    const hub = latheZ(
      [
        [0.03, -lock], [0.05, -lock], [0.05, flN - 0.04], [0.06, flN - 0.012], [0.11, flN - 0.01], [0.11, flN + 0.01],
        [0.055, flN + 0.03], [0.045, 0], [0.055, flD - 0.03], [0.11, flD - 0.01], [0.11, flD + 0.01], [0.06, flD + 0.02], [0.03, flD + 0.02]
      ],
      48
    );
    mk(hub, aluminum({ color: 0xaab2bb }), w);
    // 차축 + 양 끝 너트(스루 액슬 끝)
    const axle = merge([zCyl(0.03, -lock - 0.06, lock + 0.06, 24), zCyl(0.04, lock + 0.045, lock + 0.07, 6), zCyl(0.04, -lock - 0.07, -lock - 0.045, 6)]);
    mk(axle, steel(), this.group).position.set(b.rx, b.ry, 0);

    // 스포크 32개(3크로스)
    const N = 32;
    const spokes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0075, 0.0075, 1, 6), steel({ color: 0xd0d6dc, grain: false }), N);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const a = new THREE.Vector3();
    const c = new THREE.Vector3();
    const cross = (3 * 4 * Math.PI) / N;
    for (let i = 0; i < N; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const aR = (i / N) * TAU;
      const lead = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
      const aH = aR + lead * cross;
      const fz = side > 0 ? flD : flN;
      a.set(Math.cos(aH) * 0.1, Math.sin(aH) * 0.1, fz);
      c.set(Math.cos(aR) * (r0 - 0.075), Math.sin(aR) * (r0 - 0.075), side * 0.008);
      const d = c.clone().sub(a);
      const len = d.length();
      q.setFromUnitVectors(Y_AXIS, d.normalize());
      m4.compose(a.clone().add(c).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
      spokes.setMatrixAt(i, m4);
    }
    spokes.castShadow = true;
    w.add(spokes);
    // 밸브(바퀴가 도는 것이 눈에 보이는 표식)
    const valve = new THREE.Group();
    valve.rotation.z = Math.PI / N - Math.PI / 2;
    mk(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 12), chrome(), valve).position.y = r0 - 0.07;
    w.add(valve);
  }

  private buildCassette(): void {
    const b = this.base;
    const geos: THREE.BufferGeometry[] = [];
    const teeth = this.spec.cogs;
    const minRp = Math.min(...teeth.map((t) => PITCH / (2 * Math.sin(Math.PI / t))));
    const bore = Math.min(0.07, minRp - 0.034);
    const thick = 0.0019 * S;
    teeth.forEach((t, i) => {
      const rp = PITCH / (2 * Math.sin(Math.PI / t));
      const win = rp > 0.2 ? { n: rp > 0.32 ? 6 : 5, r0: bore + 0.045, r1: rp - 0.065 } : null;
      const g = sprocketGeo(t, thick, bore, win);
      g.translate(0, 0, b.cogZ[i]!);
      geos.push(g);
      // 이웃 스프로킷 사이 스페이서(안쪽 고리)
      const zNext = b.cogZ[i + 1];
      if (zNext !== undefined) geos.push(zCyl(bore + 0.02, b.cogZ[i]! + thick / 2, zNext - thick / 2, 40));
    });
    const cas = new THREE.Mesh(merge(geos), steel({ color: 0xb9c1ca, roughness: 0.3 }));
    cas.castShadow = true;
    cas.receiveShadow = true;
    this.wheel.add(cas);
    // 프리허브 바디 + 락링
    const zOut = b.cogZ[b.cogZ.length - 1]!;
    mk(zCyl(bore - 0.004, 0.019 * S + 0.02, zOut + 0.01, 40), darkSteel(), this.wheel);
    mk(latheZ([[bore - 0.004, zOut + 0.004], [bore + 0.03, zOut + 0.004], [bore + 0.034, zOut + 0.01], [bore + 0.03, zOut + 0.022], [bore - 0.004, zOut + 0.022]], 40), darkSteel(), this.wheel);
  }

  private buildCrank(): void {
    const b = this.base;
    const c = this.crank;
    c.position.set(b.bx, b.by, 0);
    this.group.add(c);
    const n = this.spec.rings.length;
    const zBig = b.ringZ[n - 1]!;
    const zSpider = zBig + 0.018;
    const armZ = zBig + 0.05;
    const rBig = PITCH / (2 * Math.sin(Math.PI / this.spec.rings[n - 1]!));

    // 체인링(알루미늄 띠) — 이골 0번이 크랭크 로컬 각도 0
    const ringGeos: THREE.BufferGeometry[] = [];
    const boltGeos: THREE.BufferGeometry[] = [];
    const ARMS = n === 1 ? 4 : 5;
    const armA = (k: number) => (k / ARMS) * TAU + Math.PI / ARMS;
    this.spec.rings.forEach((t, i) => {
      const rp = PITCH / (2 * Math.sin(Math.PI / t));
      const rIn = rp - 0.085;
      const g = sprocketGeo(t, 0.0022 * S, rIn, null);
      g.translate(0, 0, b.ringZ[i]!);
      ringGeos.push(g);
      // 링 → 스파이더 암으로 이어지는 볼트·스탠드오프
      const rb = rIn + 0.03;
      for (let k = 0; k < ARMS; k++) {
        const a = armA(k);
        boltGeos.push(zCyl(0.022, b.ringZ[i]! - 0.012, zSpider + 0.012, 16, Math.cos(a) * rb, Math.sin(a) * rb));
      }
    });
    mk(merge(ringGeos), aluminum({ color: 0x8d949d, roughness: 0.32 }), c);
    mk(merge(boltGeos), chrome(), c);

    // 스파이더 + 크랭크 암(검은 아노다이징)
    const darkAl = aluminum({ color: 0x2b2f36, roughness: 0.4 });
    const spider: THREE.BufferGeometry[] = [];
    const reach = rBig - 0.085 + 0.03;
    for (let k = 0; k < ARMS; k++) {
      const a = armA(k);
      const g = extrude(stadiumShape(0, 0, Math.cos(a) * reach, Math.sin(a) * reach, 0.026), 0.028, 0.006, 12);
      g.translate(0, 0, zSpider);
      spider.push(g);
    }
    const hubDisk = extrude(shapeFrom(circlePts(0.13, 48)), 0.036, 0.008, 12);
    hubDisk.translate(0, 0, zSpider + 0.01);
    spider.push(hubDisk);
    mk(merge(spider), darkAl, c);

    const armShape = new THREE.Shape();
    armShape.moveTo(0, 0.085);
    armShape.lineTo(CRANK_LEN, 0.05);
    armShape.absarc(CRANK_LEN, 0, 0.05, Math.PI / 2, -Math.PI / 2, true);
    armShape.lineTo(0, -0.085);
    armShape.absarc(0, 0, 0.085, -Math.PI / 2, Math.PI / 2, true);
    const armGeo = extrude(armShape, 0.06, 0.014, 16);
    const armR = mk(armGeo, darkAl, c);
    armR.position.z = armZ;
    const armL = mk(armGeo, darkAl, c);
    armL.rotation.z = Math.PI;
    armL.position.z = -armZ;
    mk(zCyl(0.048, -armZ, armZ, 32), steel(), c);
    mk(merge([zCyl(0.06, armZ + 0.028, armZ + 0.04, 32), zCyl(0.06, -armZ - 0.04, -armZ - 0.028, 32)]), darkSteel(), c);

    // 평페달(베어링으로 자유 회전 — 발판이 수평 유지)
    const bodyMat = plastic(0x2a2d33);
    const pinMat = steel({ grain: false });
    for (const side of [1, -1]) {
      const pedal = new THREE.Group();
      pedal.position.set(side * CRANK_LEN, 0, side * armZ);
      mk(zCyl(0.022, side * 0.03, side * 0.1, 16), pinMat, pedal);
      const body = new THREE.Shape();
      body.moveTo(-0.17, -0.028);
      body.lineTo(0.17, -0.028);
      body.lineTo(0.17, 0.028);
      body.lineTo(-0.17, 0.028);
      body.closePath();
      const bg = extrude(body, 0.3, 0.012, 4);
      bg.translate(0, 0, side * 0.26);
      mk(bg, bodyMat, pedal);
      pedal.rotation.z = 0;
      c.add(pedal);
      this.pedals.push(pedal);
    }
  }

  /** 비구동측(-Z)에 세운 전시 스탠드: 뒤 차축 끝과 BB를 받쳐 구동측 시야를 가리지 않는다 */
  private buildStand(): void {
    const b = this.base;
    const zPost = -0.75;
    const geos: THREE.BufferGeometry[] = [];
    const posts: [number, number, number][] = [
      [b.rx, b.ry, b.hubHalf + 0.075],
      [b.bx, b.by, 0.034 * S]
    ];
    for (const [x, y, half] of posts) {
      // 기둥 + 수평 팔(축 끝을 문다)
      geos.push(cylBetween(V3(x, 0.06, zPost), V3(x, y, zPost), 0.045, 28));
      geos.push(ball(V3(x, y, zPost), 0.06));
      geos.push(cylBetween(V3(x, y, zPost), V3(x, y, -half - 0.01), 0.04, 24));
      geos.push(zCyl(0.07, -half - 0.05, -half - 0.005, 32, x, y));
    }
    // 두 기둥을 잇는 바닥 레일
    geos.push(cylBetween(V3(b.rx - 0.25, 0.06, zPost), V3(b.bx + 0.25, 0.06, zPost), 0.05, 24));
    mk(merge(geos), paint(0x3b4250), this.group, true);
    // 바닥 받침(고무 발)
    const feet: THREE.BufferGeometry[] = [];
    for (const x of [b.rx - 0.25, b.bx + 0.25]) {
      const g = new THREE.CylinderGeometry(0.16, 0.18, 0.05, 32);
      g.scale(1, 1, 2.2);
      g.translate(x, 0.025, zPost);
      feet.push(g);
    }
    mk(merge(feet), rubber(), this.group, true);
  }

  private buildRearDerailleur(): THREE.Mesh {
    const b = this.base;
    const bodyMat = aluminum({ color: 0x30343b, roughness: 0.38 });
    const cageMat = aluminum({ color: 0x9aa2ab, roughness: 0.35 });
    this.group.add(this.cage);
    // 케이지 바깥·안쪽 판 (위 풀리 중심이 원점, 아래 풀리가 +X)
    // 판을 풀리보다 조금 작게 → 풀리 톱니와 그 위를 감는 체인이 옆에서 보인다
    const w = b.pulleyR * 0.8;
    for (const s of [1, -1]) {
      const g = extrude(stadiumShape(0, 0, b.cageLen, 0, w), 0.014, 0.004, 16);
      g.translate(0, 0, s * 0.05);
      mk(g, s > 0 ? cageMat : bodyMat, this.cage);
    }
    // 풀리 2개(톱니 있는 작은 스프로킷)
    const pulleyMat = plastic(0x1f2226, { roughness: 0.45 });
    const pg = sprocketGeo(this.spec.pulleyTeeth, 0.012, 0.022, null);
    const boltMat = chrome();
    for (const [grp, x] of [[this.pulleyG, 0], [this.pulleyT, b.cageLen]] as const) {
      grp.position.set(x, 0, 0);
      mk(pg, pulleyMat, grp);
      mk(zCyl(0.026, -0.058, 0.058, 20), boltMat, grp);
      this.cage.add(grp);
    }
    // 평행사변형 링크 2장 + P-너클
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bodyMat);
      m.castShadow = true;
      this.group.add(m);
      this.rdLinks.push(m);
    }
    const pk = new THREE.Mesh(zCyl(0.055, -0.035, 0.035, 32), bodyMat);
    pk.castShadow = true;
    this.group.add(pk);
    return pk;
  }

  private buildFrontDerailleur(): void {
    const b = this.base;
    const n = this.spec.rings.length;
    const rBig = PITCH / (2 * Math.sin(Math.PI / this.spec.rings[n - 1]!));
    const mat = aluminum({ color: 0xaeb5bd, roughness: 0.3 });
    const cage = new THREE.Group();
    cage.position.set(b.bx, b.by, 0);
    const a0 = SEAT_ANG - 26 * DEG;
    const a1 = SEAT_ANG + 20 * DEG;
    const arcShape = (r0: number, r1: number) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, r1, a0, a1, false);
      s.absarc(0, 0, r0, a1, a0, true);
      s.closePath();
      return s;
    };
    const outer = extrude(arcShape(rBig + 0.02, rBig + 0.12), 0.012, 0.004, 24);
    outer.translate(0, 0, 0.045);
    const inner = extrude(arcShape(rBig - 0.05, rBig + 0.12), 0.012, 0.004, 24);
    inner.translate(0, 0, -0.045);
    // 두 판을 잇는 다리(앞·뒤)
    const bridges: THREE.BufferGeometry[] = [];
    for (const a of [a0 + 3 * DEG, a1 - 3 * DEG]) {
      const r = rBig + 0.1;
      bridges.push(zCyl(0.016, -0.045, 0.045, 12, Math.cos(a) * r, Math.sin(a) * r));
    }
    mk(merge([outer, inner, ...bridges]), mat, cage);
    const topR = rBig + 0.12;
    cage.userData.top = V3(b.bx + Math.cos(SEAT_ANG) * topR, b.by + Math.sin(SEAT_ANG) * topR, 0);
    this.group.add(cage);
    this.fdCage = cage;
    // 시트튜브 클램프 밴드 + 링크 몸체
    const dClamp = rBig + 0.24;
    const cp = V3(b.bx + Math.cos(SEAT_ANG) * dClamp, b.by + Math.sin(SEAT_ANG) * dClamp, 0);
    const band = new THREE.CylinderGeometry(0.078, 0.078, 0.1, 40, 1, true);
    band.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, V3(Math.cos(SEAT_ANG), Math.sin(SEAT_ANG), 0)));
    band.translate(cp.x, cp.y, 0);
    const bodyMat = aluminum({ color: 0x30343b });
    const bandMesh = new THREE.Mesh(band, bodyMat);
    bandMesh.material.side = THREE.DoubleSide;
    bandMesh.castShadow = true;
    this.group.add(bandMesh);
    this.fdMount.set(cp.x, cp.y, 0.075);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bodyMat);
    arm.castShadow = true;
    this.group.add(arm);
    this.fdArm = arm;
  }
}
