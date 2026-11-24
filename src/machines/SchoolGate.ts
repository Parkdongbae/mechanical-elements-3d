// 슬라이딩 교문: 래크와 피니언, 차축 미션 — 모터 축의 피니언이 문짝 아랫단의 래크를 밀어 문을 옆으로 연다.
// 문짝 아래 호차의 바퀴는 몸체(호차 판)에 고정된 차축 위에서 돌며 레일을 미끄럼 없이 굴러간다.
// 기구학: 피니언 각 = -이동거리 / 피치 반지름(래크 피치 = π·모듈, 이가 실제로 맞물림), 바퀴 각 = -이동거리 / 바퀴 반지름.
// 좌표: +X 오른쪽(문이 열리는 방향), +Z 화면 앞, 문짝 평면 z = 0, 담장·기둥은 그 뒤(z = -0.45).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, brass, castIron, chrome, darkSteel, ghost, glow, paint, plastic, steel } from '../models/materials';
import { involuteOutline } from '../models/parts/gears';
import { extrude, lathe, roundedRect, type V2 } from '../models/parts/geom';

// ── 문짝 ──
const LEAF_L = 2.4;
const X0 = -1.2; // 닫힌 상태에서 문짝 왼쪽 끝
const TRAVEL = 1.9;
const GROUND = 0.02;
const BEAM_BOT = 0.82;
const BAR_TOP = 2.78;
const PERIOD = 8;

// ── 바퀴·차축·레일 ──
const WR = 0.2;
const YW = GROUND + WR; // 차축 중심 높이(= 바퀴가 레일에 앉았을 때)
const WZ = 0.025; // 바퀴 중심 z (호차 판 앞쪽)
const PLATE_Z = -0.06;
const CARRIAGE_X = [0.35, 1.35] as const; // 문짝 로컬 x
const WHEEL_HALF = 0.065;

// ── 래크·피니언 ──
const MODULE = 0.04;
const PINION_TEETH = 12;
const RP = (PINION_TEETH * MODULE) / 2; // 피니언 피치 반지름
const PITCH = Math.PI * MODULE; // 래크 피치 = 원주 피치
const Y_PL = 0.74; // 래크 피치선 높이
const YP = Y_PL - RP; // 피니언 중심 높이
const RACK_Z = -0.32; // 문짝 뒤쪽(모터 박스 쪽) — 앞에서 보면 문짝 아래 빈 공간 너머로 맞물림이 보인다
const FACE = 0.14;
const PIN_LOC = 2.14; // 닫힌 상태에서 피니언의 문짝 로컬 x
const PIN_X = X0 + PIN_LOC;
const PRESSURE = (20 * Math.PI) / 180;
const BRACKETS = [0.08, 0.8, 1.7, 2.3] as const;

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
    if (m.isMesh && !m.userData.ghost && !m.userData.slot) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

function brickTexture(rx: number, ry: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#d9d2c6';
    ctx.fillRect(0, 0, 256, 128);
    const cols = ['#b5694c', '#aa6045', '#bf7656', '#b06a4d'];
    for (let r = 0; r < 4; r++) {
      for (let k = -1; k < 4; k++) {
        const x = k * 64 + (r % 2 ? 32 : 0);
        ctx.fillStyle = cols[(r * 3 + k + 8) % 4]!;
        ctx.fillRect(x + 2, r * 32 + 2, 60, 28);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}

export class SchoolGate extends BaseMachine {
  readonly id = 'gate';
  /** 문짝: 원점 = 문짝 왼쪽 끝 바닥(x), 이동은 이 그룹의 x */
  private leaf = new THREE.Group();
  private pinionPivot = new THREE.Group();
  private props = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private caps: THREE.Object3D[] = [];
  private driveParts: THREE.Object3D[] = [];
  private driveModel: THREE.Group | null = null;
  private axleModel: THREE.Group | null = null;
  private mount: { k: number; last: number } | null = null;
  private wheelsOn = false;

  private readonly leafMat = paint(0x2f5d46, { roughness: 0.4 });
  private readonly darkMat = darkSteel();
  private readonly steelMat = steel();

  constructor() {
    super();
    this.leaf.position.set(X0, 0, 0);
    this.pinionPivot.position.set(PIN_X, YP, RACK_Z);
    this.group.add(this.leaf, this.pinionPivot, this.props);
    this.buildLeaf();
    this.buildGround();
    this.buildWalls();
    this.buildMotor();
    this.buildProps();
    for (let i = 0; i < 2; i++) {
      const w = this.buildWheel();
      this.wheels.push(w);
      this.group.add(w);
    }
    this.placeWheelsWaiting();

    this.addSlot(0, 0.34, new THREE.Vector3(PIN_X, YP, RACK_Z), 0.022);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.03), (this.slots[0] as THREE.Mesh).material);
    bar.position.set(X0 + LEAF_L / 2 - PIN_X, Y_PL + 0.1 - YP, 0);
    bar.userData.slot = true;
    this.slots[0]!.add(bar);
    this.addSlot(1, 0.15, new THREE.Vector3(X0 + CARRIAGE_X[1], YW, 0.12), 0.016);
    const twin = new THREE.Mesh(this.slots[1]!.geometry, this.slots[1]!.material);
    twin.position.x = CARRIAGE_X[0] - CARRIAGE_X[1];
    twin.userData.slot = true;
    this.slots[1]!.add(twin);
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
    return step === 0 ? this.driveModel !== null : this.axleModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, Y_PL, RACK_Z) : new THREE.Vector3(0, YW, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(PIN_X, YP, RACK_Z + 0.35) : new THREE.Vector3(X0 + CARRIAGE_X[1], YW, 0.15);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildDrive() : this.buildAxles();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      const rack = model.getObjectByName('rack');
      const pinion = model.getObjectByName('pinion');
      if (rack) {
        this.leaf.add(rack);
        rack.position.set(0, 0, 0);
        this.driveParts.push(rack);
      }
      if (pinion) {
        this.pinionPivot.add(pinion);
        pinion.position.set(0, 0, 0);
        this.driveParts.push(pinion);
      }
      this.driveModel = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(LEAF_L / 2, YW, 0);
      this.leaf.add(model);
      this.axleModel = model;
      this.caps = [];
      model.traverse((o) => {
        if (o.name === 'cap') {
          o.visible = false;
          this.caps.push(o);
        }
      });
      this.hideSlot(1);
      // 받침목이 문짝을 받친 채로 바퀴가 옆에서 차축에 끼워진다
      this.mount = { k: 0, last: -1 };
    }
  }

  reset(): void {
    for (const o of this.driveParts) o.parent?.remove(o);
    this.driveParts = [];
    if (this.axleModel) this.leaf.remove(this.axleModel);
    this.driveModel = this.axleModel = null;
    this.caps = [];
    this.mount = null;
    this.leaf.position.set(X0, 0, 0);
    this.pinionPivot.rotation.z = 0;
    this.props.visible = true;
    this.props.position.y = 0;
    this.placeWheelsWaiting();
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.mount) {
      const dt = this.mount.last < 0 ? 0 : Math.min(0.05, t - this.mount.last);
      this.mount.last = t;
      this.mount.k += dt / 3.6;
      if (this.mount.k >= 1) this.finishMount();
      else this.applyMount(this.mount.k);
    }
  }

  createSim(): MachineSim {
    if (!this.driveModel || !this.axleModel) throw new Error('gate mission incomplete');
    this.finishMount();
    let time = 0;
    let d = 0;
    let v = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const u = time % PERIOD;
        let nd: number;
        if (u < 1) nd = 0;
        else if (u < 3.8) nd = TRAVEL * smooth((u - 1) / 2.8);
        else if (u < 5) nd = TRAVEL;
        else if (u < 7.8) nd = TRAVEL * (1 - smooth((u - 5) / 2.8));
        else nd = 0;
        v = dt > 0 ? (nd - d) / dt : 0;
        d = nd;
        this.leaf.position.x = X0 + d;
        this.pinionPivot.rotation.z = -d / RP; // 피치 접촉점 속도 = 문 속도
        for (const w of this.wheels) w.rotation.z = -d / WR; // 미끄럼 없는 구름
      },
      getDisplay: () => {
        const pinionRpm = (Math.abs(v) / (Math.PI * 2 * RP)) * 60;
        const wheelRpm = (Math.abs(v) / (Math.PI * 2 * WR)) * 60;
        return [
          { label: '문 열림', value: ((d / TRAVEL) * 100).toFixed(0), unit: '%' },
          { label: `피니언 회전수 (이 ${PINION_TEETH}개)`, value: pinionRpm.toFixed(1), unit: 'rpm', tone: 'red' },
          { label: '바퀴 회전수 (차축은 0 rpm 고정)', value: wheelRpm.toFixed(1), unit: 'rpm', tone: 'blue' }
        ];
      }
    };
  }

  // ───────────────────────── 조립 연출 ─────────────────────────

  private carriageX(i: number): number {
    return X0 + CARRIAGE_X[i === 0 ? 0 : 1];
  }

  private placeWheelsWaiting(): void {
    this.wheelsOn = false;
    this.wheels.forEach((w, i) => {
      this.leaf.remove(w);
      this.group.add(w);
      w.position.set(this.carriageX(i) - (i === 0 ? 0.1 : 0), GROUND + WHEEL_HALF, 1.55);
      w.rotation.set(Math.PI / 2, 0, i * 0.8);
    });
  }

  /** k 0~0.8: 바퀴가 일어서서 차축 위로 밀려 들어간다, 0.8~: 고정 너트 → 받침목이 내려감 */
  private applyMount(k: number): void {
    const kw = Math.min(1, k / 0.8);
    this.wheels.forEach((w, i) => {
      const x = this.carriageX(i);
      const x0 = x - (i === 0 ? 0.1 : 0);
      const up = smooth(kw / 0.4);
      const slide = smooth((kw - 0.4) / 0.6);
      w.rotation.set((Math.PI / 2) * (1 - up), 0, i * 0.8 * (1 - up));
      w.position.set(x0 + (x - x0) * up, GROUND + WHEEL_HALF + (YW - GROUND - WHEEL_HALF) * up, 1.55 + (WZ - 1.55) * slide);
    });
    const nut = k > 0.82;
    for (const c of this.caps) c.visible = nut;
    this.props.position.y = -0.85 * smooth((k - 0.85) / 0.15);
  }

  private finishMount(): void {
    this.mount = null;
    if (!this.axleModel || this.wheelsOn) return;
    this.wheelsOn = true;
    this.wheels.forEach((w, i) => {
      this.group.remove(w);
      this.leaf.add(w);
      w.position.set(CARRIAGE_X[i === 0 ? 0 : 1], YW, WZ);
      w.rotation.set(0, 0, 0);
    });
    for (const c of this.caps) c.visible = true;
    this.props.visible = false;
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 1단계: 래크(문짝 로컬 좌표) + 피니언(모터 축). 모델 원점 = (0, Y_PL, RACK_Z) */
  private buildDrive(): THREE.Group {
    const g = new THREE.Group();
    const rack = new THREE.Group();
    rack.name = 'rack';
    rack.position.set(-LEAF_L / 2, -Y_PL, -RACK_Z);
    // 이 중심: 피니언 이가 닫힌 위치에서 래크 이골 중심에 오도록 PIN_LOC + (m+½)·피치
    const centers: number[] = [];
    for (let m = -40; m < 40; m++) {
      const c = PIN_LOC + (m + 0.5) * PITCH;
      if (c > 0.1 && c < 2.3) centers.push(c);
    }
    const xa = centers[0]! - PITCH / 2;
    const xb = centers[centers.length - 1]! + PITCH / 2;
    const tanA = Math.tan(PRESSURE);
    const yTip = -MODULE;
    const yRoot = 1.25 * MODULE;
    const yTop = yRoot + 0.09;
    const hwR = PITCH / 4 + 1.25 * MODULE * tanA;
    const hwT = PITCH / 4 - MODULE * tanA;
    const shape = new THREE.Shape();
    shape.moveTo(xa, yTop);
    shape.lineTo(xa, yRoot);
    for (const c of centers) {
      shape.lineTo(c - hwR, yRoot);
      shape.lineTo(c - hwT, yTip);
      shape.lineTo(c + hwT, yTip);
      shape.lineTo(c + hwR, yRoot);
    }
    shape.lineTo(xb, yRoot);
    shape.lineTo(xb, yTop);
    shape.closePath();
    const bar = new THREE.Mesh(extrude(shape, FACE, 0.004, 4), steel({ roughness: 0.3 }));
    bar.position.set(0, Y_PL, RACK_Z);
    rack.add(bar);
    const strip = box(xb - xa - 0.04, 0.012, FACE - 0.03, 0.003, paint(CATEGORY_COLORS.power, { roughness: 0.35 }), (xa + xb) / 2, Y_PL + yTop + 0.004, RACK_Z);
    rack.add(strip);
    g.add(rack);

    const pinion = new THREE.Group();
    pinion.name = 'pinion';
    pinion.position.set(PIN_X, YP - Y_PL, 0);
    const flip = new THREE.Group();
    flip.rotation.y = Math.PI; // 허브가 모터 쪽(-z)을 향하게(이 모양은 좌우 대칭이라 맞물림 위상 불변)
    pinion.add(flip);
    const ra = RP + MODULE;
    const rf = RP - 1.25 * MODULE;
    const pts = involuteOutline(PINION_TEETH, ra, rf, Math.PI / 2);
    const gs = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    gs.holes.push(new THREE.Path().absarc(0, 0, 0.041, 0, Math.PI * 2, true));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      gs.holes.push(new THREE.Path().absarc(Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0.032, 0, Math.PI * 2, true));
    }
    flip.add(new THREE.Mesh(extrude(gs, FACE, 0.006, 8), brass({ roughness: 0.3 })));
    // 허브(모터 쪽 +z) + 빨강 링, 앞쪽 고정 볼트
    flip.add(new THREE.Mesh(latheZ([[0.041, FACE / 2], [0.07, FACE / 2], [0.075, FACE / 2 + 0.005], [0.075, FACE / 2 + 0.05], [0.041, FACE / 2 + 0.05]], 36), this.darkMat));
    flip.add(new THREE.Mesh(latheZ([[0.05, FACE / 2 + 0.05], [0.07, FACE / 2 + 0.05], [0.07, FACE / 2 + 0.058], [0.05, FACE / 2 + 0.058]], 36), paint(CATEGORY_COLORS.power, { roughness: 0.35 })));
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 6), this.steelMat);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.z = -FACE / 2 - 0.01;
    flip.add(bolt);
    g.add(pinion);
    return g;
  }

  /** 2단계: 호차 판에 박는 차축 2개(회전하지 않음). 모델 원점 = (문짝 중심 x, YW, 0) */
  private buildAxles(): THREE.Group {
    const g = new THREE.Group();
    const mark = paint(CATEGORY_COLORS.shaft, { roughness: 0.35 });
    const white = paint(0xf4f6f8, { roughness: 0.4 });
    for (const cx of CARRIAGE_X) {
      const a = new THREE.Group();
      a.position.set(cx - LEAF_L / 2, 0, 0);
      a.add(new THREE.Mesh(latheZ([[0, -0.075], [0.03, -0.075], [0.03, 0.145], [0.025, 0.15], [0, 0.15]], 32), steel({ roughness: 0.26 })));
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 6), this.steelMat);
      head.rotation.x = Math.PI / 2;
      head.position.z = -0.0875;
      a.add(head);
      const face = new THREE.Mesh(latheZ([[0, 0.1505], [0.022, 0.1505], [0.022, 0.154], [0, 0.154]], 24), mark);
      a.add(face);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.04, 0.004), white);
      stripe.position.z = 0.156;
      a.add(stripe);
      const cap = new THREE.Mesh(latheZ([[0.032, 0.095], [0.055, 0.095], [0.055, 0.12], [0.032, 0.12]], 6), this.darkMat);
      cap.name = 'cap';
      a.add(cap);
      g.add(a);
    }
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildLeaf(): void {
    const l = this.leaf;
    const lm = this.leafMat;
    const yMid = (BEAM_BOT + BAR_TOP) / 2;
    for (const x of [0.04, LEAF_L - 0.04]) {
      l.add(box(0.08, BAR_TOP - BEAM_BOT, 0.08, 0.012, lm, x, yMid, 0));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), brass());
      ball.position.set(x, BAR_TOP + 0.04, 0);
      l.add(ball);
    }
    l.add(box(LEAF_L, 0.15, 0.1, 0.012, lm, LEAF_L / 2, BEAM_BOT + 0.075, 0));
    l.add(box(LEAF_L, 0.12, 0.08, 0.012, lm, LEAF_L / 2, 2.55, 0));
    l.add(box(LEAF_L, 0.05, 0.05, 0.01, lm, LEAF_L / 2, 1.65, 0));
    // 창살 + 창끝(스피어)
    const n = 19;
    const barH = BAR_TOP - (BEAM_BOT + 0.15);
    const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, barH, 12), lm, n);
    const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.028, 0.13, 12), this.steelMat, n);
    const dm = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const x = 0.12 + i * 0.12;
      dm.position.set(x, BEAM_BOT + 0.15 + barH / 2, 0);
      dm.updateMatrix();
      bars.setMatrixAt(i, dm.matrix);
      dm.position.set(x, BAR_TOP + 0.065, 0);
      dm.updateMatrix();
      tips.setMatrixAt(i, dm.matrix);
    }
    l.add(bars, tips);
    // 래크 받침 브래킷
    for (const x of BRACKETS) l.add(box(0.06, 0.12, Math.abs(RACK_Z + FACE / 2 + 0.05) + 0.02, 0.008, this.darkMat, x, 0.86, (RACK_Z + FACE / 2 - 0.05) / 2));
    // 호차: 윗판 + 옆판(차축 구멍) — 바퀴는 판 앞쪽에서 차축에 낀다
    const plateGeo = (() => {
      const s = roundedRect(-0.17, -0.08, 0.17, BEAM_BOT - 0.03 - YW, 0.08);
      s.holes.push(new THREE.Path().absarc(0, 0, 0.0315, 0, Math.PI * 2, true));
      return extrude(s, 0.03, 0.004, 24);
    })();
    const cm = castIron({ color: 0x4a5058 });
    for (const cx of CARRIAGE_X) {
      const p = new THREE.Mesh(plateGeo, cm);
      p.position.set(cx, YW, PLATE_Z);
      l.add(p);
      l.add(box(0.34, 0.03, 0.2, 0.006, cm, cx, BEAM_BOT - 0.015, 0.0));
    }
  }

  private buildWheel(): THREE.Group {
    const w = new THREE.Group();
    const rim = latheZ([[0.12, -0.065], [0.19, -0.065], [0.2, -0.055], [0.14, 0], [0.2, 0.055], [0.19, 0.065], [0.12, 0.065], [0.12, -0.065]], 64);
    w.add(new THREE.Mesh(rim, steel({ roughness: 0.32 })));
    const web = new THREE.Shape();
    web.absarc(0, 0, 0.125, 0, Math.PI * 2, false);
    web.holes.push(new THREE.Path().absarc(0, 0, 0.05, 0, Math.PI * 2, true));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      web.holes.push(new THREE.Path().absarc(Math.cos(a) * 0.088, Math.sin(a) * 0.088, 0.026, 0, Math.PI * 2, true));
    }
    w.add(new THREE.Mesh(extrude(web, 0.03, 0.004, 24), steel({ roughness: 0.4 })));
    w.add(new THREE.Mesh(latheZ([[0.034, -0.065], [0.058, -0.065], [0.062, -0.06], [0.062, 0.06], [0.058, 0.065], [0.034, 0.065], [0.034, -0.065]], 36), this.darkMat));
    return w;
  }

  private buildGround(): void {
    const g = this.group;
    g.add(box(6.4, 0.04, 0.5, 0.008, plastic(0xb9b4aa, { roughness: 0.9 }), 0.6, 0.0, 0.0));
    const tri = new THREE.Shape();
    tri.moveTo(-0.06, 0);
    tri.lineTo(0.06, 0);
    tri.lineTo(0, 0.055);
    tri.closePath();
    const geo = extrude(tri, 6.0, 0, 1);
    geo.rotateY(Math.PI / 2);
    const rail = new THREE.Mesh(geo, this.darkMat);
    rail.position.set(0.6, GROUND, WZ);
    g.add(rail);
  }

  private buildWalls(): void {
    const g = this.group;
    const stone = plastic(0xd8d0bf, { roughness: 0.85, grain: false });
    const cap = plastic(0xb8b0a0, { roughness: 0.8, grain: false });
    const wallZ = -0.45;
    for (const sx of [-1, 1]) {
      g.add(box(0.34, 2.5, 0.34, 0.01, stone, sx * 1.3, GROUND + 1.25, wallZ));
      g.add(box(0.44, 0.08, 0.44, 0.012, cap, sx * 1.3, GROUND + 2.54, wallZ));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 18), cap);
      ball.position.set(sx * 1.3, GROUND + 2.68, wallZ);
      g.add(ball);
    }
    const wall = (x0: number, x1: number) => {
      const w = x1 - x0;
      const m = plastic(0xffffff, { roughness: 0.9, grain: false });
      m.map = brickTexture(w / 0.64, 1.0 / 0.32 * 0.5);
      g.add(box(w, 1.0, 0.3, 0.006, m, (x0 + x1) / 2, GROUND + 0.5, wallZ));
      g.add(box(w + 0.04, 0.06, 0.38, 0.01, cap, (x0 + x1) / 2, GROUND + 1.03, wallZ));
    };
    wall(1.47, 3.4);
    wall(-2.3, -1.47);
    // 교명판 자리(글자 없음)
    g.add(box(0.66, 0.36, 0.02, 0.01, this.darkMat, -1.885, 0.62, wallZ + 0.16));
    g.add(box(0.6, 0.3, 0.02, 0.008, plastic(0xe9e2cf, { roughness: 0.6 }), -1.885, 0.62, wallZ + 0.17));
  }

  private buildMotor(): void {
    const g = this.group;
    const bz = -0.735;
    const bx = 0.87;
    g.add(box(0.6, 0.04, 0.63, 0.006, castIron({ color: 0x4a5058 }), bx, GROUND + 0.02, bz));
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.94, 0.53, 2, 0.02), ghost(0xb7cbe0, 0.28));
    body.position.set(bx, GROUND + 0.04 + 0.47, bz);
    body.userData.ghost = true;
    body.renderOrder = 2;
    g.add(body);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.94, 12), this.darkMat);
      post.position.set(bx + sx * 0.25, GROUND + 0.51, bz + sz * 0.265);
      g.add(post);
    }
    g.add(box(0.54, 0.03, 0.57, 0.006, this.darkMat, bx, GROUND + 0.995, bz));
    // 내부: 감속기 + 모터
    g.add(box(0.26, 0.3, 0.22, 0.02, castIron({ color: 0x4a5058 }), PIN_X, YP, -0.62));
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 40), paint(0x5d6f80, { roughness: 0.45 }));
    motor.rotation.x = Math.PI / 2;
    motor.position.set(PIN_X, YP, -0.86);
    g.add(motor);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), glow(0x46d17a, 0.9));
    lamp.position.set(bx + 0.15, GROUND + 1.04, bz - 0.1);
    g.add(lamp);
    // 모터 출력축(피니언이 끼는 축): 피니언 장착 전에도 앞으로 나와 있다
    const shaft = new THREE.Mesh(latheZ([[0, -0.3], [0.04, -0.3], [0.04, 0.11], [0.038, 0.12], [0, 0.12]], 28), chrome({ roughness: 0.2 }));
    this.pinionPivot.add(shaft);
    const key = box(0.012, 0.012, 0.28, 0.002, this.darkMat, 0, 0.043, -0.15);
    this.pinionPivot.add(key);
  }

  /** 바퀴가 없을 때 문짝을 받치는 임시 받침목(레일 위) */
  private buildProps(): void {
    const m = plastic(0xb98552, { roughness: 0.7 });
    for (const x of [-0.4, 0.6]) {
      this.props.add(box(0.2, BEAM_BOT - (GROUND + 0.055), 0.09, 0.01, m, x, (BEAM_BOT + GROUND + 0.055) / 2, -0.005));
    }
  }
}
