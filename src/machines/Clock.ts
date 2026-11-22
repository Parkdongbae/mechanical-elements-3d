// 시계: 태엽(스프링) → 평 기어 2단계 미션
// v2: 무브먼트가 훤히 보이는 스켈레톤 탁상시계. 태엽통(배럴) 톱니 → 중앙 바퀴(평 기어, 2단계) → 3번 바퀴 →
//     탈진 바퀴·앵커 → 진자. 중앙 바퀴 축 앞쪽의 캐넌 피니언 → 분 바퀴 → 시 바퀴(12:1)가 시침을 돈다.
//     같은 모듈끼리만 맞물리게 잇수를 정했다(배럴 18T : 중앙 35T = 반지름 0.18 : 0.35 → 표시 rpm 유지).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { brass, steel, darkSteel, plastic, wood, glass } from '../models/materials';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';

const DRUM_GEAR_R = 0.18;
const CENTER_GEAR_R = 0.35;
const DRUM_RPM = 6;

// ── 기어 트레인 치수 (모듈 m, 잇수 N → 피치원 반지름 mN/2) ──
const M1 = 0.02; // 배럴·중앙 바퀴·3번 피니언
const M2 = 0.014; // 3번 바퀴·탈진 피니언
const M3 = 0.012; // 시계 앞쪽 운동 장치(모션 워크)
const N_BARREL = 18;
const N_CENTER = 35;
const N_P3 = 8;
const N_W3 = 30;
const N_PE = 8;
const N_CANNON = 10;
const N_MW = 30;
const N_MP = 8;
const N_HW = 32;

// ── 배치 (XY = 문자판 평면, +Z = 앞) ──
const C = new THREE.Vector2(0, 1.85);
const Z_BACK = -0.325; // 뒤 지판 중심
const Z_FRONT = 0.045; // 앞 지판 중심
const PLATE_T = 0.03;
const Z1 = -0.22; // 배럴 톱니·중앙 바퀴·3번 피니언
const Z2 = -0.12; // 3번 바퀴·탈진 피니언
const Z3 = -0.03; // 탈진 바퀴·앵커
const Z_MW = 0.08; // 캐넌 피니언·분 바퀴
const Z_HW = 0.1; // 분 피니언·시 바퀴
const Z_DIAL = 0.12;
const DIAL_IN = 0.78;
const DIAL_OUT = 1.1;

const CENTER = new THREE.Vector3(C.x, C.y, Z1);
const DRUM_DIR = (210 * Math.PI) / 180;
const DRUM = new THREE.Vector3(
  C.x + Math.cos(DRUM_DIR) * (DRUM_GEAR_R + CENTER_GEAR_R),
  C.y + Math.sin(DRUM_DIR) * (DRUM_GEAR_R + CENTER_GEAR_R),
  -0.14
);
// 탈진 바퀴는 12시 방향 위, 3번 바퀴 축은 두 중심거리를 동시에 만족하는 점
const ESC = new THREE.Vector2(C.x, C.y + 0.64);
const THIRD = (() => {
  const d1 = M1 * (N_CENTER + N_P3) / 2;
  const d2 = M2 * (N_W3 + N_PE) / 2;
  const e = ESC.y - C.y;
  const y = (d1 * d1 - d2 * d2 + e * e) / (2 * e);
  return new THREE.Vector2(C.x + Math.sqrt(Math.max(0, d1 * d1 - y * y)), C.y + y);
})();
const ANCHOR = new THREE.Vector2(ESC.x, ESC.y + 0.25);
const MINUTE_WHEEL = new THREE.Vector2(
  C.x + Math.cos(-0.7) * (M3 * (N_CANNON + N_MW)) / 2,
  C.y + Math.sin(-0.7) * (M3 * (N_CANNON + N_MW)) / 2
);
const PEND_LEN = ANCHOR.y - 0.48;

// 10시 10분 — 시침·분침이 겹치지 않는 전시용 시각
const MINUTE_START = -(10 / 60) * Math.PI * 2;
const HOUR_START = -((10 + 10 / 60) / 12) * Math.PI * 2;

// ── 치형·지오메트리 헬퍼 ──

type Kind = 'wheel' | 'pinion';

/** 시계용 오지브(뾰족 둥근) 치형 외곽 — 이골 중심 각도 0 + k·step, 이 중심 (k+½)·step */
function toothOutline(n: number, m: number, kind: Kind): THREE.Vector2[] {
  const rp = (m * n) / 2;
  const ha = kind === 'wheel' ? 1.3 * m : 0.95 * m;
  const hf = 1.55 * m;
  const rr = rp - hf;
  const step = (Math.PI * 2) / n;
  const halfW = (kind === 'wheel' ? 0.25 : 0.19) * step * rp; // 피치원에서의 이 두께 절반(선 길이)
  const pts: THREE.Vector2[] = [];
  const at = (r: number, a: number) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  for (let i = 0; i < n; i++) {
    const c = (i + 0.5) * step;
    const aRoot = halfW / rr;
    // 이골 바닥(이전 이 → 이번 이) 둥근 호
    const g0 = c - step / 2;
    for (let k = 0; k <= 3; k++) {
      const a = g0 + ((c - aRoot - g0) * k) / 3;
      pts.push(at(rr, a));
    }
    // 왼쪽 반경 방향 플랭크 → 오지브 → 오른쪽
    pts.push(at(rp, c - halfW / rp));
    const seg = 7;
    for (let k = 1; k <= seg; k++) {
      const t = (k / seg) * (Math.PI / 2);
      pts.push(at(rp + ha * Math.sin(t), c - (halfW / rp) * Math.cos(t)));
    }
    for (let k = seg - 1; k >= 0; k--) {
      const t = (k / seg) * (Math.PI / 2);
      pts.push(at(rp + ha * Math.sin(t), c + (halfW / rp) * Math.cos(t)));
    }
    pts.push(at(rr, c + aRoot));
    for (let k = 1; k < 3; k++) {
      const a = c + aRoot + ((c + step / 2 - (c + aRoot)) * k) / 3;
      pts.push(at(rr, a));
    }
  }
  return pts;
}

function holeCircle(r: number, x = 0, y = 0): THREE.Path {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, Math.PI * 2, true);
  return p;
}

function extrudeZ(shape: THREE.Shape, depth: number, z: number, bevel = 0.003, curve = 12): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
  g.translate(0, 0, z - depth / 2);
  return g;
}

/** 살(크로싱)이 있는 황동 바퀴 */
function wheelGeometry(n: number, m: number, spokes: number, depth: number, arborR: number): THREE.BufferGeometry {
  const rp = (m * n) / 2;
  const shape = new THREE.Shape(toothOutline(n, m, 'wheel'));
  const rRim = rp - 1.55 * m - Math.max(0.018, rp * 0.1);
  const rHub = Math.max(arborR + 0.025, rp * 0.2);
  const ws = Math.max(0.016, rp * 0.09);
  if (rRim - rHub > 0.03) {
    for (let j = 0; j < spokes; j++) {
      const a0 = (j / spokes) * Math.PI * 2 + 0.3;
      const a1 = a0 + (Math.PI * 2) / spokes;
      const hole = new THREE.Path();
      hole.absarc(0, 0, rRim, a0 + ws / (2 * rRim), a1 - ws / (2 * rRim), false);
      hole.absarc(0, 0, rHub, a1 - ws / (2 * rHub), a0 + ws / (2 * rHub), true);
      hole.closePath();
      shape.holes.push(hole);
    }
  }
  shape.holes.push(holeCircle(arborR));
  return extrudeZ(shape, depth, 0, 0.003, 10);
}

function pinionGeometry(n: number, m: number, length: number, arborR: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(toothOutline(n, m, 'pinion'));
  shape.holes.push(holeCircle(arborR));
  return extrudeZ(shape, length, 0, 0.002, 8);
}

function zCyl(r: number, z0: number, z1: number, seg = 24, x = 0, y = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

function latheZ(profile: [number, number][], seg = 48): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 양 끝이 둥근 막대 Shape (지판 살·앵커 팔) */
function capsule(a: THREE.Vector2, b: THREE.Vector2, w: number): THREE.Shape {
  const d = b.clone().sub(a);
  const ang = Math.atan2(d.y, d.x);
  const s = new THREE.Shape();
  s.absarc(b.x, b.y, w / 2, ang - Math.PI / 2, ang + Math.PI / 2, false);
  s.absarc(a.x, a.y, w / 2, ang + Math.PI / 2, ang + (Math.PI * 3) / 2, false);
  s.closePath();
  return s;
}

function disc(c: THREE.Vector2, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(c.x, c.y, r, 0, Math.PI * 2, false);
  return s;
}

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
  if (!merged) throw new Error('clock: geometry merge failed');
  return merged;
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, receive = false): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = receive;
  return m;
}

const wrap = (a: number, period: number) => a - period * Math.round(a / period);

/**
 * 맞물림 위상: 구동 기어(회전 θd, 잇수 Nd)가 방향 φ에 있는 피동 기어(잇수 Nf)와 이가 엇갈리도록
 * 피동 기어의 회전각을 돌려준다. (이 중심 (k+½)step, 이골 중심 k·step 규약)
 */
function meshPhase(thetaD: number, nD: number, phi: number, nF: number): number {
  const stepD = (Math.PI * 2) / nD;
  const eps = wrap(thetaD + stepD / 2 - phi, stepD);
  return phi + Math.PI - (eps * nD) / nF;
}

const dirOf = (from: THREE.Vector2, to: THREE.Vector2) => Math.atan2(to.y - from.y, to.x - from.x);

// 초기 위상(배럴 회전 0 기준) — reset 후에도 같은 값으로 되돌려 맞물림이 유지된다
const PHASE_CENTER = meshPhase(0, N_BARREL, DRUM_DIR + Math.PI, N_CENTER);
const PHASE_THIRD = meshPhase(PHASE_CENTER, N_CENTER, dirOf(C, THIRD), N_P3);
const PHASE_ESC = meshPhase(PHASE_THIRD, N_W3, dirOf(THIRD, ESC), N_PE);
const PHASE_MW = meshPhase(MINUTE_START, N_CANNON, dirOf(C, MINUTE_WHEEL), N_MW);
const HOUR_WHEEL_OFFSET = meshPhase(PHASE_MW, N_MP, dirOf(MINUTE_WHEEL, C), N_HW) - HOUR_START;

export class Clock extends BaseMachine {
  readonly id = 'clock';
  private springMesh: THREE.Group | null = null;
  private gearMesh: THREE.Group | null = null;
  private minuteHand = new THREE.Group();
  private hourHand = new THREE.Group();
  private drumGroup = new THREE.Group();
  private thirdGroup = new THREE.Group();
  private escGroup = new THREE.Group();
  private anchorGroup = new THREE.Group();
  private pendulum = new THREE.Group();
  private minuteWheel = new THREE.Group();
  private glassMesh: THREE.Mesh | null = null;

  constructor() {
    super();
    this.buildBase();
    this.buildPlates();
    this.buildDrum();
    this.buildTrain();
    this.buildDial();
    this.buildHands();
    this.addSlot(0, 0.17, DRUM);
    this.addSlot(1, CENTER_GEAR_R - 0.01, CENTER);
    this.hideSlot(1);
    this.enableShadows();
    // 유리는 그림자를 드리우지 않는다(문자판이 검게 덮이는 것 방지)
    if (this.glassMesh) this.glassMesh.castShadow = false;
    this.resetPose();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.springMesh !== null : this.gearMesh !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? DRUM.clone() : CENTER.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? DRUM.clone() : CENTER.clone();
  }

  buildStepModel(step: number): THREE.Group {
    return step === 0 ? this.buildSpringSpiral() : this.buildCenterGear();
  }

  installStep(step: number, model: THREE.Group): void {
    if (step === 0) {
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      this.drumGroup.add(model);
      this.springMesh = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.copy(CENTER);
      model.rotation.set(0, 0, PHASE_CENTER + this.drumGroup.rotation.z * -(N_BARREL / N_CENTER));
      this.group.add(model);
      this.gearMesh = model;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.springMesh) {
      this.drumGroup.remove(this.springMesh);
      this.springMesh = null;
    }
    if (this.gearMesh) {
      this.group.remove(this.gearMesh);
      this.gearMesh = null;
    }
    this.showSlot(0);
    this.hideSlot(1);
    this.resetPose();
  }

  private resetPose(): void {
    this.drumGroup.rotation.z = 0;
    this.thirdGroup.rotation.z = PHASE_THIRD;
    this.escGroup.rotation.z = PHASE_ESC;
    this.minuteWheel.rotation.z = PHASE_MW;
    this.anchorGroup.rotation.z = 0;
    this.pendulum.rotation.z = 0;
    this.minuteHand.rotation.z = MINUTE_START;
    this.hourHand.rotation.z = HOUR_START;
  }

  createSim(): MachineSim {
    if (!this.springMesh || !this.gearMesh) throw new Error('clock mission incomplete');
    const ratio = DRUM_GEAR_R / CENTER_GEAR_R;
    const centerRpm = DRUM_RPM * ratio;
    const display: MachineDisplayItem[] = [
      { label: '태엽 드럼', value: String(DRUM_RPM), unit: 'rpm', tone: 'blue' },
      { label: '분침', value: String(Math.round(centerRpm)), unit: 'rpm', tone: 'red' },
      { label: '시침', value: (centerRpm / 12).toFixed(2), unit: 'rpm' }
    ];
    const self = this;
    let time = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const wDrum = (DRUM_RPM / 60) * Math.PI * 2;
        self.drumGroup.rotation.z += wDrum * dt;
        const wCenter = wDrum * ratio;
        if (self.gearMesh) self.gearMesh.rotation.z -= wCenter * dt;
        self.minuteHand.rotation.z -= wCenter * dt;
        self.hourHand.rotation.z -= (wCenter / 12) * dt;
        // 외접 맞물림마다 방향 반전, 속도는 잇수비
        const w3 = wCenter * (N_CENTER / N_P3);
        self.thirdGroup.rotation.z += w3 * dt;
        self.escGroup.rotation.z -= w3 * (N_W3 / N_PE) * dt;
        self.minuteWheel.rotation.z += wCenter * (N_CANNON / N_MW) * dt;
        const swing = 0.06 * Math.sin((time * Math.PI * 2) / 1.6);
        self.pendulum.rotation.z = swing;
        self.anchorGroup.rotation.z = swing;
      },
      getDisplay: () => display
    };
  }

  // ─────────────────────────── 조립 부품 ───────────────────────────

  /** 태엽: 푸른 강철 띠가 5바퀴 반 감긴 나선(배럴 안) */
  private buildSpringSpiral(): THREE.Group {
    const turns = 5.5;
    const r0 = 0.034;
    const r1 = 0.136;
    const w = 0.1;
    const h = 0.0065;
    const n = 420;
    const pos: number[] = [];
    const nor: number[] = [];
    const idx: number[] = [];
    // 면마다 정점을 따로 둬 모서리를 날카롭게 (바깥·안·앞·뒤)
    // [반경 방향 법선 부호, z 방향 법선 부호]
    const faces: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let f = 0; f < faces.length; f++) {
      const [fn, fz] = faces[f]!;
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = t * turns * Math.PI * 2;
        const r = r0 + (r1 - r0) * t;
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        // 면의 두 모서리
        const corners: [number, number][] =
          fn !== 0 ? [[fn * h / 2, -w / 2], [fn * h / 2, w / 2]] : [[-h / 2, (fz * w) / 2], [h / 2, (fz * w) / 2]];
        for (const [dn, dz] of corners) {
          pos.push(cx * (r + dn), cy * (r + dn), dz);
          nor.push(cx * fn, cy * fn, fz);
        }
      }
      for (let i = 0; i < n; i++) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    const springMat = steel({ color: 0x3b5794, roughness: 0.3, grain: false });
    springMat.side = THREE.DoubleSide;
    const g = new THREE.Group();
    g.add(mesh(geo, springMat));
    // 안쪽 끝을 무는 태엽 축 후크
    g.add(mesh(zCyl(0.03, -0.055, 0.055, 24), steel()));
    return g;
  }

  /** 중앙 바퀴(평 기어 35T) + 콜릿 */
  private buildCenterGear(): THREE.Group {
    const g = new THREE.Group();
    g.add(mesh(wheelGeometry(N_CENTER, M1, 5, 0.022, 0.02), brass()));
    g.add(mesh(latheZ([[0.02, -0.03], [0.05, -0.03], [0.058, -0.022], [0.058, 0.012], [0.04, 0.03], [0.02, 0.03]], 32), brass({ color: 0xc89a3e })));
    return g;
  }

  // ─────────────────────────── 고정 구조 ───────────────────────────

  private buildBase(): void {
    const plinth = (w: number, d: number, h: number, y: number, r: number) => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2 + r, -d / 2);
      s.lineTo(w / 2 - r, -d / 2);
      s.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
      s.lineTo(w / 2, d / 2 - r);
      s.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
      s.lineTo(-w / 2 + r, d / 2);
      s.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
      s.lineTo(-w / 2, -d / 2 + r);
      s.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, Math.PI * 1.5, false);
      const g = new THREE.ExtrudeGeometry(s, { depth: h - 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 8 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, y + 0.015, -0.15);
      return g;
    };
    const woodMat = wood(0x5b3520, { roughness: 0.5 });
    this.group.add(mesh(merge([plinth(2.3, 1.05, 0.1, 0.04, 0.06), plinth(2.05, 0.85, 0.06, 0.14, 0.05)]), woodMat, true));

    const brassMat = brass({ color: 0xc99a42 });
    const geos: THREE.BufferGeometry[] = [];
    // 번 피트 4개
    for (const [x, z] of [[-1.0, 0.25], [1.0, 0.25], [-1.0, -0.55], [1.0, -0.55]] as const) {
      const f = new THREE.SphereGeometry(0.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      f.scale(1, 0.7, 1);
      f.rotateX(Math.PI);
      f.translate(x, 0.042, z);
      geos.push(f);
    }
    // 무브먼트를 받치는 선반 기둥 2개
    const colTop = C.y - 0.905 * Math.SQRT1_2;
    const colH = colTop - 0.2;
    const prof: [number, number][] = [
      [0, 0], [0.075, 0], [0.075, 0.03], [0.055, 0.05], [0.055, 0.07], [0.04, 0.1], [0.032, 0.2],
      [0.03, colH * 0.5], [0.042, colH * 0.5 + 0.03], [0.03, colH * 0.5 + 0.06], [0.028, colH - 0.1],
      [0.04, colH - 0.06], [0.05, colH - 0.03], [0.05, colH], [0, colH]
    ];
    for (const sx of [-1, 1]) {
      const col = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
      col.translate(sx * 0.905 * Math.SQRT1_2, 0.2, Z_BACK / 2 + Z_FRONT / 2 - 0.0);
      geos.push(col);
    }
    this.group.add(mesh(merge(geos), brassMat));
  }

  /** 앞·뒤 스켈레톤 지판 + 기둥 + 보석 베어링 */
  private buildPlates(): void {
    const arbors = [C, new THREE.Vector2(DRUM.x, DRUM.y), THIRD, ESC, ANCHOR];
    const plateGeo = (front: boolean): THREE.BufferGeometry => {
      const z = front ? Z_FRONT : Z_BACK;
      const geos: THREE.BufferGeometry[] = [];
      const ring = new THREE.Shape();
      ring.absarc(0, 0, 0.95, 0, Math.PI * 2, false);
      ring.holes.push(holeCircle(0.86));
      const rg = extrudeZ(ring, PLATE_T, z, 0.004, 48);
      rg.translate(C.x, C.y, 0);
      geos.push(rg);
      // 앞판은 살을 가늘게(0.65배) 하고 개수도 줄여 뒤쪽 기어 트레인이 잘 보이게 한다
      const k = front ? 0.62 : 1;
      const bar = (a: THREE.Vector2, b: THREE.Vector2, w = 0.07) => geos.push(extrudeZ(capsule(a, b, w * k), PLATE_T - 0.004, z, 0.004, 10));
      const onRing = (deg: number) => new THREE.Vector2(C.x + Math.cos((deg * Math.PI) / 180) * 0.9, C.y + Math.sin((deg * Math.PI) / 180) * 0.9);
      bar(C, onRing(90));
      bar(C, new THREE.Vector2(DRUM.x, DRUM.y));
      bar(new THREE.Vector2(DRUM.x, DRUM.y), onRing(210));
      bar(C, THIRD, 0.06);
      bar(THIRD, onRing(40), 0.06);
      bar(C, onRing(320));
      if (!front) bar(C, onRing(150), 0.05);
      for (const p of arbors) geos.push(extrudeZ(disc(p, (p === C ? 0.075 : 0.06) * (front ? 0.8 : 1)), PLATE_T + 0.004, z, 0.004, 24));
      if (front) geos.push(extrudeZ(disc(MINUTE_WHEEL, 0.045), PLATE_T + 0.004, z, 0.004, 20));
      return merge(geos);
    };
    const plateMat = darkSteel({ color: 0x4d5560 });
    this.group.add(mesh(plateGeo(false), plateMat, true), mesh(plateGeo(true), plateMat, true));

    // 기둥 4개(지판 사이) + 문자판 다리 + 파란 나사
    const pillarGeos: THREE.BufferGeometry[] = [];
    const screwGeos: THREE.BufferGeometry[] = [];
    const zIn0 = Z_BACK + PLATE_T / 2;
    const zIn1 = Z_FRONT - PLATE_T / 2;
    for (const deg of [45, 135, 225, 315]) {
      const a = (deg * Math.PI) / 180;
      const x = C.x + Math.cos(a) * 0.905;
      const y = C.y + Math.sin(a) * 0.905;
      const p = latheZ([[0, zIn0], [0.04, zIn0], [0.04, zIn0 + 0.03], [0.028, zIn0 + 0.06], [0.026, (zIn0 + zIn1) / 2], [0.028, zIn1 - 0.06], [0.04, zIn1 - 0.03], [0.04, zIn1], [0, zIn1]], 24);
      p.translate(x, y, 0);
      pillarGeos.push(p);
      pillarGeos.push(zCyl(0.022, Z_FRONT + PLATE_T / 2, Z_DIAL - 0.008, 16, x, y));
      const s = new THREE.SphereGeometry(0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      s.rotateX(Math.PI / 2);
      s.translate(x, y, Z_FRONT + PLATE_T / 2);
      screwGeos.push(s);
    }
    this.group.add(mesh(merge(pillarGeos), steel()));

    // 보석 베어링(루비) + 황동 샤통 — 앞판 앞면·뒤판 뒷면
    const chatons: THREE.BufferGeometry[] = [];
    const jewels: THREE.BufferGeometry[] = [];
    for (const p of [C, THIRD, ESC, ANCHOR]) {
      for (const [zf, sgn] of [[Z_FRONT + PLATE_T / 2 + 0.002, 1], [Z_BACK - PLATE_T / 2 - 0.002, -1]] as const) {
        if (p === C && sgn > 0) continue; // 중앙 축 앞쪽은 운동 장치가 덮는다
        chatons.push(latheZ([[0.018, 0], [0.034, 0], [0.036, sgn * 0.006], [0.03, sgn * 0.012], [0.018, sgn * 0.012]], 24).translate(p.x, p.y, zf));
        const j = new THREE.SphereGeometry(0.018, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        j.scale(1, 0.45, 1);
        j.rotateX(sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
        j.translate(p.x, p.y, zf + sgn * 0.006);
        jewels.push(j);
      }
    }
    this.group.add(mesh(merge(chatons), brass({ color: 0xe0b85a })));
    this.group.add(mesh(merge(jewels), plastic(0xc0102c, { roughness: 0.12, grain: false })));
    this.group.add(mesh(merge(screwGeos), steel({ color: 0x2e4a8c, roughness: 0.25, grain: false })));

    // 축(아버) — 지판 사이를 관통
    const arborGeos: THREE.BufferGeometry[] = [];
    for (const p of [THIRD, ESC, ANCHOR]) arborGeos.push(zCyl(0.013, Z_BACK - PLATE_T / 2, Z_FRONT + PLATE_T / 2, 16, p.x, p.y));
    arborGeos.push(zCyl(0.016, Z_BACK - PLATE_T / 2, Z_DIAL + 0.06, 16, C.x, C.y));
    arborGeos.push(zCyl(0.028, Z_BACK - PLATE_T / 2, Z_FRONT + PLATE_T / 2, 24, DRUM.x, DRUM.y));
    arborGeos.push(zCyl(0.013, Z_FRONT, Z_HW + 0.02, 16, MINUTE_WHEEL.x, MINUTE_WHEEL.y));
    arborGeos.push(zCyl(0.013, Z_BACK - 0.14, Z_BACK - PLATE_T / 2, 16, ANCHOR.x, ANCHOR.y));
    this.group.add(mesh(merge(arborGeos), steel()));

    // 진자 걸이(뒤판 위쪽) — 앵커 축 뒤 끝을 받친다
    const cock = new THREE.Shape();
    cock.moveTo(-0.09, -0.12);
    cock.lineTo(0.09, -0.12);
    cock.lineTo(0.05, 0.05);
    cock.absarc(0, 0.05, 0.05, 0, Math.PI, false);
    cock.closePath();
    const cockGeo = extrudeZ(cock, 0.02, Z_BACK - 0.1, 0.004, 12);
    cockGeo.translate(ANCHOR.x, ANCHOR.y, 0);
    const cockFeet = [zCyl(0.016, Z_BACK - 0.1, Z_BACK - PLATE_T / 2, 12, ANCHOR.x - 0.07, ANCHOR.y - 0.1), zCyl(0.016, Z_BACK - 0.1, Z_BACK - PLATE_T / 2, 12, ANCHOR.x + 0.07, ANCHOR.y - 0.1)];
    this.group.add(mesh(merge([cockGeo, ...cockFeet]), plateMat));
  }

  private buildDrum(): void {
    this.drumGroup.position.copy(DRUM);
    const brassMat = brass();
    const zg = Z1 - DRUM.z;
    const gear = mesh(wheelGeometry(N_BARREL, M1, 0, 0.024, 0.03), brassMat);
    gear.position.z = zg;
    // 앞이 열린 배럴 통 — 안쪽 태엽이 보인다
    const shell = mesh(
      latheZ([[0.03, zg + 0.012], [0.155, zg + 0.012], [0.155, 0.055], [0.162, 0.062], [0.158, 0.07], [0.142, 0.07], [0.142, zg + 0.022], [0.03, zg + 0.022]], 64),
      brass({ color: 0xc8a050 })
    );
    this.drumGroup.add(gear, shell);
    this.group.add(this.drumGroup);
  }

  private buildTrain(): void {
    const brassMat = brass();
    const pinionMat = steel({ color: 0xd5dbe2 });
    // 3번 바퀴(Z2) + 3번 피니언(Z1)
    this.thirdGroup.position.set(THIRD.x, THIRD.y, 0);
    const w3 = mesh(wheelGeometry(N_W3, M2, 4, 0.02, 0.013), brassMat);
    w3.position.z = Z2;
    const p3 = mesh(pinionGeometry(N_P3, M1, 0.04, 0.012), pinionMat);
    p3.position.z = Z1;
    const c3 = mesh(latheZ([[0.013, Z2 - 0.02], [0.03, Z2 - 0.02], [0.03, Z2 - 0.008], [0.013, Z2 - 0.008]], 20), brassMat);
    this.thirdGroup.add(w3, p3, c3);

    // 탈진 바퀴(Z3, 래칫 치형 20T) + 탈진 피니언(Z2)
    this.escGroup.position.set(ESC.x, ESC.y, 0);
    const escShape = new THREE.Shape();
    const nE = 20;
    const rT = 0.15;
    const rR = 0.118;
    const stepE = (Math.PI * 2) / nE;
    for (let i = 0; i < nE; i++) {
      const a = i * stepE;
      const P = (r: number, t: number) => [Math.cos(t) * r, Math.sin(t) * r] as const;
      const [x0, y0] = P(rR, a);
      if (i === 0) escShape.moveTo(x0, y0);
      else escShape.lineTo(x0, y0);
      const [x1, y1] = P(rR + 0.012, a + stepE * 0.35);
      escShape.lineTo(x1, y1);
      const [x2, y2] = P(rT, a + stepE * 0.62);
      escShape.lineTo(x2, y2);
      const [x3, y3] = P(rT - 0.004, a + stepE * 0.7);
      escShape.lineTo(x3, y3);
      const [x4, y4] = P(rR + 0.004, a + stepE * 0.82);
      escShape.lineTo(x4, y4);
    }
    escShape.closePath();
    for (let j = 0; j < 4; j++) {
      const a0 = (j / 4) * Math.PI * 2 + 0.2;
      const a1 = a0 + Math.PI / 2;
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.098, a0 + 0.1, a1 - 0.1, false);
      hole.absarc(0, 0, 0.035, a1 - 0.3, a0 + 0.3, true);
      hole.closePath();
      escShape.holes.push(hole);
    }
    escShape.holes.push(holeCircle(0.013));
    const ew = mesh(extrudeZ(escShape, 0.016, Z3, 0.002, 10), brassMat);
    const pe = mesh(pinionGeometry(N_PE, M2, 0.035, 0.012), pinionMat);
    pe.position.z = Z2;
    this.escGroup.add(ew, pe);

    // 앵커(Z3): 축에서 두 팔이 탈진 바퀴 위를 감싸고, 끝에 루비 팔레트
    this.anchorGroup.position.set(ANCHOR.x, ANCHOR.y, 0);
    const rel = new THREE.Vector2(ESC.x - ANCHOR.x, ESC.y - ANCHOR.y);
    const palAng = (38 * Math.PI) / 180;
    const palL = new THREE.Vector2(rel.x - Math.sin(palAng) * (rT + 0.01), rel.y + Math.cos(palAng) * (rT + 0.01));
    const palR = new THREE.Vector2(rel.x + Math.sin(palAng) * (rT + 0.01), rel.y + Math.cos(palAng) * (rT + 0.01));
    const o = new THREE.Vector2(0, 0);
    const elbowL = new THREE.Vector2(palL.x * 0.85, palL.y * 0.35);
    const elbowR = new THREE.Vector2(palR.x * 0.85, palR.y * 0.35);
    const anchorGeos = [
      extrudeZ(capsule(o, elbowL, 0.04), 0.014, Z3, 0.002),
      extrudeZ(capsule(elbowL, palL, 0.034), 0.014, Z3, 0.002),
      extrudeZ(capsule(o, elbowR, 0.04), 0.014, Z3, 0.002),
      extrudeZ(capsule(elbowR, palR, 0.034), 0.014, Z3, 0.002),
      extrudeZ(disc(o, 0.04), 0.018, Z3, 0.002, 20)
    ];
    this.anchorGroup.add(mesh(merge(anchorGeos), steel({ color: 0xb8c0c9 })));
    const stoneGeos = [palL, palR].map((p) => {
      const b = new THREE.BoxGeometry(0.02, 0.034, 0.02);
      b.rotateZ(Math.atan2(p.y - rel.y, p.x - rel.x) - Math.PI / 2);
      b.translate(p.x, p.y, Z3);
      return b;
    });
    this.anchorGroup.add(mesh(merge(stoneGeos), plastic(0xc0102c, { roughness: 0.12, grain: false })));

    // 진자: 앵커 축 뒤 끝(걸이)에 매달려 앵커와 함께 흔들린다
    this.pendulum.position.set(ANCHOR.x, ANCHOR.y, Z_BACK - 0.13);
    const rod = mesh(zCyl(0.011, 0, 1, 12), steel());
    rod.geometry = new THREE.CylinderGeometry(0.011, 0.011, PEND_LEN, 12).translate(0, -PEND_LEN / 2, 0);
    const bob = mesh(new THREE.SphereGeometry(0.17, 40, 20).scale(1, 1, 0.3).translate(0, -PEND_LEN, 0), brass({ color: 0xd9ae55, roughness: 0.22 }));
    const nut = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6).translate(0, -PEND_LEN - 0.2, 0), steel());
    const hub = mesh(zCyl(0.03, -0.02, 0.03, 20), steel());
    this.pendulum.add(rod, bob, nut, hub);

    // 앞쪽 운동 장치: 분 바퀴(Z_MW) + 분 피니언(Z_HW)
    this.minuteWheel.position.set(MINUTE_WHEEL.x, MINUTE_WHEEL.y, 0);
    const mw = mesh(wheelGeometry(N_MW, M3, 4, 0.014, 0.013), brassMat);
    mw.position.z = Z_MW;
    const mp = mesh(pinionGeometry(N_MP, M3, 0.03, 0.012), pinionMat);
    mp.position.z = Z_HW;
    this.minuteWheel.add(mw, mp);

    this.group.add(this.thirdGroup, this.escGroup, this.anchorGroup, this.pendulum, this.minuteWheel);
  }

  /** 문자판 링(로마 숫자·분 눈금) + 베젤 + 앞 유리 */
  private buildDial(): void {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const k = size / (2 * DIAL_OUT);
      const cx = size / 2;
      ctx.fillStyle = '#f3ecdc';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#2a2622';
      ctx.fillStyle = '#2a2622';
      ctx.lineWidth = 2.5;
      for (const r of [1.0, 1.06, 0.8]) {
        ctx.beginPath();
        ctx.arc(cx, cx, r * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const r0 = (i % 5 === 0 ? 0.985 : 1.0) * k;
        const r1 = 1.06 * k;
        ctx.lineWidth = i % 5 === 0 ? 6 : 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.sin(a) * r0, cx - Math.cos(a) * r0);
        ctx.lineTo(cx + Math.sin(a) * r1, cx - Math.cos(a) * r1);
        ctx.stroke();
      }
      const romans = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      ctx.font = `600 ${Math.round(0.135 * k)}px "Times New Roman", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      romans.forEach((txt, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r = 0.895 * k;
        ctx.save();
        ctx.translate(cx + Math.sin(a) * r, cx - Math.cos(a) * r);
        ctx.rotate(a);
        ctx.scale(0.8, 1);
        ctx.fillText(txt, 0, 0);
        ctx.restore();
      });
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const ringShape = new THREE.Shape();
    ringShape.absarc(0, 0, DIAL_OUT, 0, Math.PI * 2, false);
    ringShape.holes.push(holeCircle(DIAL_IN));
    const ringGeo = extrudeZ(ringShape, 0.012, Z_DIAL, 0.003, 96);
    const uv = ringGeo.attributes.uv as THREE.BufferAttribute;
    const p = ringGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / (2 * DIAL_OUT) + 0.5, p.getY(i) / (2 * DIAL_OUT) + 0.5);
    ringGeo.translate(C.x, C.y, 0);
    const dialMat = plastic(0xffffff, { roughness: 0.6, grain: false });
    dialMat.map = tex;
    this.group.add(mesh(ringGeo, dialMat, true));

    const bezel = latheZ([[1.085, Z_DIAL - 0.012], [1.19, Z_DIAL - 0.012], [1.215, Z_DIAL + 0.02], [1.21, Z_DIAL + 0.11], [1.18, Z_DIAL + 0.14], [1.14, Z_DIAL + 0.14], [1.125, Z_DIAL + 0.12], [1.12, Z_DIAL + 0.02], [1.085, Z_DIAL + 0.01]], 128);
    bezel.translate(C.x, C.y, 0);
    this.group.add(mesh(bezel, brass({ color: 0xd2a64c })));

    const glassGeo = new THREE.CircleGeometry(1.13, 96);
    glassGeo.translate(C.x, C.y, Z_DIAL + 0.115);
    this.glassMesh = new THREE.Mesh(glassGeo, glass(0xdff0ff, 0.16));
    this.glassMesh.userData.noAO = true;
    this.group.add(this.glassMesh);
  }

  private buildHands(): void {
    const handMat = steel({ color: 0x2b3f7a, roughness: 0.22, grain: false });
    /** 브레게(달 고리) 바늘: 꼬리 → 가는 몸통 → 고리 → 창끝 */
    const breguet = (len: number, ring: number, w: number): THREE.BufferGeometry => {
      const ringY = len * 0.72;
      const body = new THREE.Shape();
      body.moveTo(-w, -len * 0.18);
      body.lineTo(w, -len * 0.18);
      body.lineTo(w * 0.55, ringY - ring * 0.8);
      body.lineTo(-w * 0.55, ringY - ring * 0.8);
      body.closePath();
      const r = new THREE.Shape();
      r.absarc(0, ringY, ring, 0, Math.PI * 2, false);
      r.holes.push(holeCircle(ring * 0.62, 0, ringY));
      const tip = new THREE.Shape();
      tip.moveTo(-w * 0.9, ringY + ring * 0.85);
      tip.lineTo(w * 0.9, ringY + ring * 0.85);
      tip.lineTo(0, len);
      tip.closePath();
      const hub = new THREE.Shape();
      hub.absarc(0, 0, w * 2.2, 0, Math.PI * 2, false);
      const tail = new THREE.Shape();
      tail.absarc(0, -len * 0.18, w * 1.8, 0, Math.PI * 2, false);
      return merge([body, r, tip, hub, tail].map((s) => extrudeZ(s, 0.006, 0, 0.0015, 24)));
    };
    const minuteMesh = mesh(breguet(0.95, 0.045, 0.012), handMat);
    // 캐넌 피니언(분침과 함께 돈다)
    const cannon = mesh(pinionGeometry(N_CANNON, M3, 0.026, 0.016), steel({ color: 0xd5dbe2 }));
    cannon.position.z = Z_MW - 0.165;
    const pipe = mesh(zCyl(0.022, Z_MW - 0.165, 0, 20), brass());
    this.minuteHand.add(minuteMesh, cannon, pipe);
    this.minuteHand.position.set(C.x, C.y, 0.165);

    const hourMesh = mesh(breguet(0.6, 0.055, 0.016), handMat);
    // 시 바퀴(시침 파이프와 한 몸)
    const hw = mesh(wheelGeometry(N_HW, M3, 5, 0.012, 0.024), brass());
    hw.position.z = Z_HW - 0.148;
    hw.rotation.z = HOUR_WHEEL_OFFSET;
    const hpipe = mesh(zCyl(0.03, Z_HW - 0.148, 0, 20), brass());
    this.hourHand.add(hourMesh, hw, hpipe);
    this.hourHand.position.set(C.x, C.y, 0.148);

    const hubCap = mesh(latheZ([[0, 0], [0.034, 0], [0.03, 0.01], [0.016, 0.018], [0, 0.02]], 24), brass({ color: 0xd9b25c }));
    hubCap.position.set(C.x, C.y, 0.172);
    this.group.add(this.minuteHand, this.hourHand, hubCap);
  }
}
