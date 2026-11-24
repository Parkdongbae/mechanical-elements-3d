// 그네: 볼 베어링과 체인 미션 — 운동장 그네(A자 강관 프레임 2개 + 가로대, 고무 매트, 좌판 2개 중 1개가 미션 대상).
// ① 가로대 걸이(행어) 속 볼 베어링(안쪽 링은 핀에 고정, 바깥 링 + 매다는 팔이 그네와 함께 흔들림, 볼은 바깥 링 각속도 × Ro/(Ro+Ri)로 공전)
// ② 좌판을 매다는 체인 2줄(링크 InstancedMesh, 곧게 유지). 흔들림은 진자: θ = A·sin(ωt), ω = √(g/L).
// 좌표: 가로대 = X축, 흔들림 면 = YZ, +Z 화면 앞. 진자 그룹의 원점 = 베어링 축(피벗).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, castIron, chrome, darkSteel, paint, rubber, steel, wood } from '../models/materials';
import { extrude, kidneyPath, lathe, stadiumShape, type V2 } from '../models/parts/geom';

/** 1단위 ≈ 0.8m (프레임 높이 약 2.5m) — 주기 계산용 */
const M_PER_UNIT = 0.8;
const G = 9.8;

// ── 프레임 ──
const BEAM_Y = 3.1;
const BEAM_R = 0.075;
const XF = 2.0; // A자 프레임 x
const MAT_T = 0.035;
const LEG_Z = 1.2;

// ── 피벗·걸이 ──
const YP = BEAM_Y - 0.36; // 피벗(베어링 축) 높이
const XM = 0.78; // 미션 그네 중심 x
const XD = -0.78; // 완성된 그네
const CH = 0.35; // 체인·걸이 간격의 절반
const PLATE_DX = 0.08;
const RI_OUT = 0.095; // 안쪽 링 바깥 반지름(내륜 레이스)
const RO_IN = 0.135; // 바깥 링 안쪽 반지름
const KAPPA = RO_IN / (RO_IN + RI_OUT); // 볼 공전 각속도 / 바깥 링 각속도
const BALL_R = (RO_IN - RI_OUT) / 2;

// ── 체인(매다는 곧은 체인) ──
const LI = 0.11; // 링크 안쪽 길이 = 이음 피치
const WI = 0.05;
const RW = 0.016; // 철사 반지름
const LINKS = 15; // 홀수: 맨 위 링크가 팔 구멍을 꿰는 면(XY)에 놓인다
const EYE_Y = -0.4; // 팔 구멍(피벗 기준)
const TOP_LINK_Y = EYE_Y - 0.052;
const BOT_LINK_Y = TOP_LINK_Y - (LINKS - 1) * LI;
const RING_Y = BOT_LINK_Y - 0.084; // 좌판 아이볼트 고리 중심
const SEAT_T = 0.07;
const SEAT_Y = RING_Y - 0.05 - SEAT_T / 2; // 좌판 중심(피벗 기준) — 진자 길이
const L_PEND = -SEAT_Y;
const L_M = L_PEND * M_PER_UNIT;
const OMEGA = Math.sqrt(G / L_M);
const PERIOD = (Math.PI * 2) / OMEGA;
const A_MIN = 0.12;
const A_MAX = 0.52;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function latheX(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function box(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
}

function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 20): THREE.Mesh {
  const d = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  m.position.copy(a).add(b).multiplyScalar(0.5);
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

/** 둥근 직사각(스타디움) 고리 중심선 — 체인 링크용 */
class StadiumCurve extends THREE.Curve<THREE.Vector3> {
  private readonly r: number;
  private readonly s: number;
  constructor(halfLen: number, halfWid: number) {
    super();
    this.r = halfWid;
    this.s = halfLen - halfWid;
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const { r, s } = this;
    const straight = 2 * s;
    const arc = Math.PI * r;
    const total = 2 * straight + 2 * arc;
    let u = (t % 1) * total;
    if (u < straight) return target.set(r, -s + u, 0);
    u -= straight;
    if (u < arc) {
      const a = u / r;
      return target.set(r * Math.cos(a), s + r * Math.sin(a), 0);
    }
    u -= arc;
    if (u < straight) return target.set(-r, s - u, 0);
    u -= straight;
    const a = Math.PI + u / r;
    return target.set(r * Math.cos(a), -s + r * Math.sin(a), 0);
  }
}

/** 한 줄 체인의 링크 위치(피벗 기준 y, j = 0이 맨 아래) */
function linkY(j: number): number {
  return BOT_LINK_Y + j * LI;
}

export class Swing extends BaseMachine {
  readonly id = 'swing';
  private readonly pend = new THREE.Group(); // 미션 그네 진자
  private readonly cages: THREE.Group[] = []; // 미션 그네 볼 케이지(좌·우)
  private readonly staticParts = new THREE.Group();
  private readonly crate = new THREE.Group();
  private bearingModel: THREE.Group | null = null;
  private chainModel: THREE.Group | null = null;
  private chainMesh: THREE.InstancedMesh | null = null;
  private innerMeshes: THREE.Object3D[] = [];
  private outerMeshes: THREE.Object3D[] = [];
  private reveal: { k: number; last: number } | null = null;
  private readonly dummy = new THREE.Object3D();

  private readonly frameMat = paint(0x3b6ea5, { roughness: 0.4 });
  private readonly darkMat = darkSteel();
  private readonly steelMat = steel();
  private readonly linkGeo = new THREE.TubeGeometry(new StadiumCurve(LI / 2 + RW, (WI + 2 * RW) / 2), 40, RW, 8, true);

  constructor() {
    super();
    this.pend.position.set(XM, YP, 0);
    this.group.add(this.staticParts, this.pend, this.crate);
    this.buildFrame();
    this.buildHanger(XM);
    this.buildHanger(XD);
    this.buildDecorSwing();
    // 미션 그네 좌판: 처음에는 받침 상자 위에 얹혀 있다(체인이 달리면 상자를 치운다)
    this.pend.add(this.buildSeat(0, SEAT_Y, 0));
    const crateH = YP + SEAT_Y - SEAT_T / 2 - MAT_T;
    this.crate.add(box(0.7, crateH, 0.26, 0.012, wood(0xc08a55), XM, MAT_T + crateH / 2, 0));

    this.addSlot(0, 0.2, new THREE.Vector3(XM + CH, YP, 0), 0.02);
    const s0 = this.slots[0];
    if (s0) {
      s0.rotation.y = Math.PI / 2;
      const twin = new THREE.Mesh(s0.geometry, s0.material);
      twin.position.set(0, 0, -2 * CH);
      twin.userData.slot = true;
      s0.add(twin);
    }
    const len = TOP_LINK_Y - BOT_LINK_Y + 0.25;
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, len, 16),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    line.position.set(XM + CH, YP + (TOP_LINK_Y + BOT_LINK_Y) / 2, 0);
    line.userData.slot = true;
    const twin1 = new THREE.Mesh(line.geometry, line.material);
    twin1.position.x = -2 * CH;
    twin1.userData.slot = true;
    line.add(twin1);
    this.slots[1] = line;
    this.group.add(line);
    this.hideSlot(1);

    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.traverse((o) => {
        o.userData.noAO = true;
        (o as THREE.Mesh).castShadow = false;
        (o as THREE.Mesh).receiveShadow = false;
      });
    }
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.bearingModel !== null : this.chainModel !== null;
  }

  getFlyTarget(): THREE.Vector3 {
    return new THREE.Vector3(XM, YP, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(XM + CH, YP, 0.25) : new THREE.Vector3(XM + CH, YP - 1.0, 0.25);
  }

  buildStepModel(step: number): THREE.Group {
    const g = new THREE.Group();
    if (step === 0) {
      for (const sx of [-1, 1]) {
        const b = this.buildBearing();
        b.position.x = sx * CH;
        g.add(b);
      }
    } else {
      const mesh = new THREE.InstancedMesh(this.linkGeo, steel({ roughness: 0.3 }), LINKS * 2);
      mesh.frustumCulled = false;
      mesh.name = 'chain';
      g.add(mesh);
    }
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    model.position.set(0, 0, 0);
    if (step === 0) {
      this.bearingModel = model;
      this.innerMeshes = [];
      this.outerMeshes = [];
      this.cages.length = 0;
      for (const b of [...model.children]) {
        const sx = b.position.x < 0 ? -1 : 1;
        const inner = b.getObjectByName('inner');
        const balls = b.getObjectByName('balls');
        const outer = b.getObjectByName('outer');
        if (inner) {
          this.staticParts.add(inner);
          inner.position.set(XM + sx * CH, YP, 0);
          this.innerMeshes.push(inner);
        }
        if (balls) {
          this.staticParts.add(balls);
          balls.position.set(XM + sx * CH, YP, 0);
          this.cages.push(balls as THREE.Group);
          this.innerMeshes.push(balls);
        }
        if (outer) {
          this.pend.add(outer);
          outer.position.set(sx * CH, 0, 0);
          this.outerMeshes.push(outer);
        }
      }
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.chainModel = model;
      const mesh = model.getObjectByName('chain') as THREE.InstancedMesh | undefined;
      if (mesh) {
        this.pend.add(mesh);
        this.chainMesh = mesh;
        this.setReveal(0);
        this.reveal = { k: 0, last: -1 };
      }
      this.hideSlot(1);
    }
  }

  reset(): void {
    for (const o of this.innerMeshes) o.parent?.remove(o);
    for (const o of this.outerMeshes) o.parent?.remove(o);
    this.innerMeshes = [];
    this.outerMeshes = [];
    this.cages.length = 0;
    if (this.chainMesh) this.pend.remove(this.chainMesh);
    this.chainMesh = null;
    this.bearingModel = this.chainModel = null;
    this.reveal = null;
    this.pend.rotation.set(0, 0, 0);
    this.crate.visible = true;
    this.crate.position.z = 0;
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.reveal) {
      const dt = this.reveal.last < 0 ? 0 : Math.min(0.05, t - this.reveal.last);
      this.reveal.last = t;
      this.reveal.k += dt / 2.2;
      const k = this.reveal.k;
      this.setReveal(Math.min(1, k / 0.45)); // 체인이 위에서 아래로 늘어진다
      this.crate.position.z = 2.2 * smooth((k - 0.55) / 0.45); // 받침 상자를 앞으로 치운다
      if (k >= 1) this.finishReveal();
    }
  }

  private finishReveal(): void {
    this.reveal = null;
    this.setReveal(1);
    this.crate.visible = false;
  }

  /** 링크 j(0 = 맨 아래)의 위치·방향. k = 위에서부터 나타난 비율 */
  private setReveal(k: number): void {
    const mesh = this.chainMesh;
    if (!mesh) return;
    const d = this.dummy;
    for (let side = 0; side < 2; side++) {
      for (let j = 0; j < LINKS; j++) {
        d.position.set(side === 0 ? CH : -CH, linkY(j), 0);
        d.rotation.set(0, j % 2 === 0 ? 0 : Math.PI / 2, 0);
        // 맨 위(j = LINKS-1)부터 차례로 나타난다
        const s = Math.min(1, Math.max(0, k * LINKS - (LINKS - 1 - j)));
        d.scale.setScalar(Math.max(0.0001, s));
        d.updateMatrix();
        mesh.setMatrixAt(side * LINKS + j, d.matrix);
      }
    }
    d.scale.setScalar(1);
    mesh.instanceMatrix.needsUpdate = true;
  }

  createSim(): MachineSim {
    if (!this.bearingModel || !this.chainModel) throw new Error('swing mission incomplete');
    this.finishReveal();
    let amp = 0.04;
    let phi = 0;
    let pushing = true;
    let theta = 0;
    let omega = 0;
    let vmax = 0;
    return {
      update: (dt: number) => {
        // 밀 때는 진폭이 늘고, 놓으면 공기 저항·마찰로 서서히 줄어든다
        if (pushing && amp > A_MAX) pushing = false;
        else if (!pushing && amp < A_MIN) pushing = true;
        amp = pushing ? amp + 0.08 * dt : amp * Math.exp(-dt / 6);
        phi += OMEGA * dt;
        const nt = amp * Math.sin(phi);
        omega = dt > 0 ? (nt - theta) / dt : 0;
        theta = nt;
        this.pend.rotation.x = theta;
        for (const c of this.cages) c.rotation.x = KAPPA * theta;
        const v = Math.abs(omega) * L_M;
        vmax = Math.max(v, vmax * Math.exp(-dt / 2.5));
      },
      getDisplay: () => [
        { label: '흔들림 각도', value: ((theta * 180) / Math.PI).toFixed(0), unit: '°', tone: 'red' },
        { label: `주기 (T = 2π√(L/g), L = ${L_M.toFixed(1)}m)`, value: PERIOD.toFixed(2), unit: 's', tone: 'blue' },
        { label: '최고 속도 (좌판 중심)', value: vmax.toFixed(2), unit: 'm/s' }
      ]
    };
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 볼 베어링(축 = X): inner(내륜, 고정), balls(볼, 케이지), outer(외륜 + 매다는 팔, 진자와 함께 움직임). 포인트색 = 축용(파랑) */
  private buildBearing(): THREE.Group {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.name = 'inner';
    inner.add(new THREE.Mesh(latheX([[0.05, -0.06], [0.088, -0.06], [RI_OUT, -0.052], [RI_OUT, 0.052], [0.088, 0.06], [0.05, 0.06], [0.05, -0.06]], 48), chrome({ roughness: 0.18 })));
    const balls = new THREE.Group();
    balls.name = 'balls';
    const ballGeo = new THREE.SphereGeometry(BALL_R, 20, 14);
    const ballMat = chrome();
    const rb = (RO_IN + RI_OUT) / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = new THREE.Mesh(ballGeo, ballMat);
      b.position.set(0, Math.cos(a) * rb, Math.sin(a) * rb);
      balls.add(b);
    }
    const outer = new THREE.Group();
    outer.name = 'outer';
    outer.add(new THREE.Mesh(latheX([[RO_IN, -0.06], [0.168, -0.06], [0.175, -0.052], [0.175, 0.052], [0.168, 0.06], [RO_IN, 0.06], [RO_IN, -0.06]], 64), steel({ roughness: 0.3 })));
    const seal = new THREE.Mesh(latheX([[0.145, 0.0605], [0.172, 0.0605], [0.172, 0.066], [0.145, 0.066]], 64), paint(CATEGORY_COLORS.shaft, { roughness: 0.35 }));
    const seal2 = seal.clone();
    seal2.rotation.y = Math.PI;
    outer.add(seal, seal2);
    // 매다는 팔(볼 베어링 바깥 링에 붙은 걸이판): 아래 구멍에 체인 맨 위 링크가 걸린다
    const s = new THREE.Shape();
    s.moveTo(-0.1, -0.15);
    s.lineTo(0.1, -0.15);
    s.lineTo(0.06, EYE_Y);
    s.absarc(0, EYE_Y, 0.06, 0, -Math.PI, true);
    s.lineTo(-0.1, -0.15);
    s.holes.push(new THREE.Path().absarc(0, EYE_Y, 0.035, 0, Math.PI * 2, true));
    const armGeo = extrude(s, 0.06, 0.005, 24);
    armGeo.rotateY(-Math.PI / 2);
    outer.add(new THREE.Mesh(armGeo, this.darkMat));
    g.add(inner, balls, outer);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  /** 가로대에 거는 걸이: 판 2장(축 받침 + 볼이 보이는 창) + 고정 핀. 베어링은 미션 대상(또는 완성품) */
  private buildHanger(xh: number): void {
    const g = this.staticParts;
    const outline = stadiumShape(0, 0.36, 0, 0, 0.245);
    outline.holes.push(new THREE.Path().absarc(0, 0.36, BEAM_R + 0.004, 0, Math.PI * 2, true));
    for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * Math.PI * 2 + 0.35;
      outline.holes.push(kidneyPath(0.147, 0.042, a0, a0 + 1.25));
    }
    const plateGeo = extrude(outline, 0.03, 0.004, 24);
    plateGeo.rotateY(-Math.PI / 2);
    for (const sx of [-1, 1]) {
      for (const dx of [-1, 1]) {
        const p = new THREE.Mesh(plateGeo, this.darkMat);
        p.position.set(xh + sx * CH + dx * PLATE_DX, YP, 0);
        g.add(p);
      }
      // 고정 핀 + 육각 머리
      const cx = xh + sx * CH;
      const pin = new THREE.Mesh(latheX([[0, -0.12], [0.048, -0.12], [0.048, 0.12], [0, 0.12]], 28), steel({ roughness: 0.28 }));
      pin.position.set(cx, YP, 0);
      g.add(pin);
      for (const dx of [-1, 1]) {
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 6), this.steelMat);
        head.rotation.z = Math.PI / 2;
        head.position.set(cx + dx * 0.1075, YP, 0);
        g.add(head);
      }
    }
  }

  private buildSeat(x: number, y: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.add(box(0.8, SEAT_T, 0.28, 0.028, rubber({ color: 0x24262a, roughness: 0.8 }), 0, 0, 0));
    const ringMat = steel({ roughness: 0.28 });
    for (const sx of [-1, 1]) {
      g.add(box(0.14, 0.012, 0.1, 0.004, this.darkMat, sx * CH, SEAT_T / 2 + 0.004, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 12, 36), ringMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * CH, SEAT_T / 2 + 0.05, 0);
      g.add(ring);
    }
    return g;
  }

  /** 완성된 그네(좌판·체인·베어링이 모두 달린 정지 상태) */
  private buildDecorSwing(): void {
    const g = new THREE.Group();
    g.position.set(XD, YP, 0);
    for (const sx of [-1, 1]) {
      const b = this.buildBearing();
      const inner = b.getObjectByName('inner');
      const balls = b.getObjectByName('balls');
      const outer = b.getObjectByName('outer');
      for (const o of [inner, balls, outer]) {
        if (!o) continue;
        o.position.x = sx * CH;
        g.add(o);
      }
    }
    const mesh = new THREE.InstancedMesh(this.linkGeo, steel({ roughness: 0.3 }), LINKS * 2);
    const d = this.dummy;
    for (let side = 0; side < 2; side++) {
      for (let j = 0; j < LINKS; j++) {
        d.position.set(side === 0 ? CH : -CH, linkY(j), 0);
        d.rotation.set(0, j % 2 === 0 ? 0 : Math.PI / 2, 0);
        d.updateMatrix();
        mesh.setMatrixAt(side * LINKS + j, d.matrix);
      }
    }
    mesh.frustumCulled = false;
    g.add(mesh);
    g.add(this.buildSeat(0, SEAT_Y, 0));
    this.group.add(g);
  }

  private buildFrame(): void {
    const g = this.group;
    const fm = this.frameMat;
    // 고무 매트
    g.add(box(5.2, MAT_T, 3.0, 0.012, rubber({ color: 0x3e7a52, roughness: 0.9 }), 0, MAT_T / 2, 0));
    // 가로대
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(BEAM_R, BEAM_R, 4.9, 32), fm);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, BEAM_Y, 0);
    g.add(beam);
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(BEAM_R, 24, 14), fm);
      cap.position.set(sx * 2.45, BEAM_Y, 0);
      g.add(cap);
      // A자 프레임: 다리 2 + 꼭대기 클램프 + 가로 보강대 + 발판
      const apexY = BEAM_Y - 0.04;
      for (const sz of [-1, 1]) {
        const top = new THREE.Vector3(sx * XF, apexY, sz * 0.09);
        const foot = new THREE.Vector3(sx * XF, MAT_T, sz * LEG_Z);
        g.add(cylBetween(foot, top, 0.055, fm));
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.022, 32), this.darkMat);
        plate.position.set(sx * XF, MAT_T + 0.011, sz * LEG_Z);
        g.add(plate);
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 24), rubber());
        sleeve.position.set(sx * XF, MAT_T + 0.08, sz * (LEG_Z - 0.02));
        g.add(sleeve);
      }
      g.add(box(0.2, 0.28, 0.34, 0.02, castIron({ color: 0x4a5058 }), sx * XF, BEAM_Y - 0.02, 0));
      const yb = 0.9;
      const zb = LEG_Z - ((LEG_Z - 0.09) * (yb - MAT_T)) / (apexY - MAT_T);
      g.add(cylBetween(new THREE.Vector3(sx * XF, yb, -zb), new THREE.Vector3(sx * XF, yb, zb), 0.035, fm));
    }
  }
}
