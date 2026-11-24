// 자동 우산: 스프링·링크 미션 — 우산 스탠드에 세운 자동 우산(손잡이 버튼·중봉·위 고정 꼭지·러너·살 8개·천).
// 버튼을 누르면 걸쇠가 풀리고, 중봉의 압축 스프링이 러너를 밀어 올린다(용수철 힘 → 가속도로 적분).
// 큰 살은 위 고정 꼭지(T)에, 받침살은 러너(R)에 핀으로 이어져 있고 받침살 끝은 큰 살의 S점에 붙는다.
// 삼각 링크 T–S–R: S = 원(T, a) ∩ 원(R, b) — 러너 높이만 정하면 살 각도가 계산된다(막대 길이 불변).
// 좌표: 바닥 y=0, 중봉 = Y축.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, castIron, chrome, darkSteel, paint, plastic, rubber, steel } from '../models/materials';
import { lathe, type V2 } from '../models/parts/geom';

// ── 치수 ──
const TOP_N = 2.75; // 위 고정 꼭지(큰 살 핀) 높이
const R_N = 0.07; // 꼭지 핀 반지름 위치
const R_E = 0.078; // 러너 핀 반지름 위치
const RIB_L = 1.6; // 큰 살 길이
const SA = 0.55; // T → S (받침살이 붙는 점)
const SB = 0.6; // 받침살 길이
const RIBS = 8;
const SHAFT_R = 0.03;
const HANDLE_TOP = 0.95;
const RUNNER_H = 0.14;
const DEG = Math.PI / 180;
const OPEN_A = 68 * DEG;
const CLOSED_A = 5 * DEG;
const CM_PER_UNIT = 35;

/** 살 각도 α(중봉 아래 방향에서 잰 각) → 그 자세가 되는 러너 높이 */
function runnerFor(alpha: number): number {
  const sx = R_N + SA * Math.sin(alpha);
  const sy = TOP_N - SA * Math.cos(alpha);
  const dx = sx - R_E;
  return sy - Math.sqrt(SB * SB - dx * dx);
}
const Y_OPEN = runnerFor(OPEN_A);
const Y_CLOSED = runnerFor(CLOSED_A);
const SEAT_Y = Y_CLOSED - RUNNER_H / 2 - 0.16; // 스프링 아래 자리(고정 칼라 윗면)
const SPRING_R = 0.052;
const SPRING_FREE = 1.05; // 스프링 자유 길이(펴진 상태에서도 아직 밀고 있음)
const LATCH_Y = Y_CLOSED + RUNNER_H / 2 + 0.012;

// 동작(주기 7초)
const PERIOD = 7;
const T_PRESS = 0.6;
const T_RELEASE = 0.9;
const T_CLOSE0 = 4.4;
const T_CLOSE1 = 6.4;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function circleHit(c0: THREE.Vector2, r0: number, c1: THREE.Vector2, r1: number, near: THREE.Vector2): THREE.Vector2 {
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy);
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = c0.x + (a * dx) / d;
  const my = c0.y + (a * dy) / d;
  const s1 = new THREE.Vector2(mx - (h * dy) / d, my + (h * dx) / d);
  const s2 = new THREE.Vector2(mx + (h * dy) / d, my - (h * dx) / d);
  return s1.distanceToSquared(near) < s2.distanceToSquared(near) ? s1 : s2;
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

function cylY(r: number, y0: number, y1: number, seg = 24): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

/** 압축 코일 스프링(축 Y, 0~len, 양끝 닫힌 감김) */
function coilGeo(R: number, wire: number, coils: number, len: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = Math.ceil(coils * 32);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * coils * Math.PI * 2;
    const endK = 0.7 / coils;
    const y = u < endK ? (u / endK) * 0.04 : u > 1 - endK ? 1 - ((1 - u) / endK) * 0.04 : 0.04 + ((u - endK) / (1 - 2 * endK)) * 0.92;
    pts.push(new THREE.Vector3(Math.cos(a) * R, wire + y * (len - 2 * wire), Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 8, false);
}

/** 원점에서 +Y로 len 막대(양끝 둥근) */
function stickGeo(len: number, r: number): THREE.BufferGeometry {
  const p: V2[] = [[0, 0]];
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    p.push([Math.sin(a) * r, r - Math.cos(a) * r]);
  }
  p.push([r, len - r]);
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    p.push([Math.cos(a) * r, len - r + Math.sin(a) * r]);
  }
  p.push([0, len]);
  return lathe(p, 12);
}

interface RibRig {
  pivot: THREE.Group;
  rib: THREE.Group;
  dirX: number;
  dirZ: number;
}

export class AutoUmbrella extends BaseMachine {
  readonly id = 'umbrella';
  private springModel: THREE.Group | null = null;
  private linkModel: THREE.Group | null = null;
  private coil: THREE.Object3D | null = null;
  private stretchers: THREE.Object3D[] = [];
  private ribs: RibRig[] = [];
  private runner = new THREE.Group();
  private button!: THREE.Mesh;
  private latch!: THREE.Mesh;
  private canopy: { geo: THREE.BufferGeometry; panels: number[] }[] = [];
  private yR = Y_CLOSED;
  private alpha = CLOSED_A;
  private sNear = new THREE.Vector2(R_N + SA, TOP_N - SA);
  private coilLen0 = 1;

  private readonly ribMat = darkSteel({ color: 0x3b4048, roughness: 0.4 });

  constructor() {
    super();
    this.buildStand();
    this.buildShaft();
    this.buildRibs();
    this.buildCanopy();
    this.addSlot(0, 0.36, new THREE.Vector3(0, (SEAT_Y + Y_CLOSED - RUNNER_H / 2) / 2, 0), 0.02);
    this.slots[0]!.rotation.x = Math.PI / 2;
    this.addSlot(1, 0.36, new THREE.Vector3(0, Y_CLOSED + 0.32, 0), 0.02);
    this.slots[1]!.rotation.x = Math.PI / 2;
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
      s.receiveShadow = false;
    }
    this.pose(Y_CLOSED, 0, false);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.springModel !== null : this.linkModel !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, SEAT_Y + 0.1, 0) : new THREE.Vector3(0, Y_CLOSED + 0.32, 0);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildSpring() : this.buildStretchers();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      this.springModel = model;
      this.coil = model.getObjectByName('coil') ?? null;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.linkModel = model;
      this.stretchers = [];
      for (let i = 0; i < RIBS; i++) {
        const s = model.getObjectByName(`st${i}`);
        if (s) this.stretchers.push(s);
      }
      this.hideSlot(1);
    }
    this.pose(this.yR, 0, false);
  }

  reset(): void {
    if (this.springModel) this.group.remove(this.springModel);
    if (this.linkModel) this.group.remove(this.linkModel);
    this.springModel = this.linkModel = null;
    this.coil = null;
    this.stretchers = [];
    this.sNear.set(R_N + SA, TOP_N - SA);
    this.pose(Y_CLOSED, 0, false);
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.springModel || !this.linkModel) throw new Error('umbrella mission incomplete');
    let time = 0;
    let y = Y_CLOSED;
    let v = 0;
    let latched = true;
    let state = '접힘';
    // 스프링 상수: 러너+살을 0.4초 안에 끝까지 밀어 올리는 정도 (화면 단위)
    const K = 60;
    const G_EFF = 1.5;
    return {
      update: (dt: number) => {
        time += dt;
        const tc = time % PERIOD;
        if (tc < dt * 1.5) latched = true;
        const press = smooth((tc - T_PRESS) / 0.15) * (1 - smooth((tc - 1.3) / 0.2));
        if (tc >= T_RELEASE && tc < T_CLOSE0) {
          latched = false;
          // 압축 스프링 힘(길이에 비례) − 무게 → 가속도. 끝(펴짐 멈춤)에 닿으면 정지
          const len = y - RUNNER_H / 2 - SEAT_Y;
          const a = K * (SPRING_FREE - len) - G_EFF;
          v += a * dt;
          y += v * dt;
          if (y >= Y_OPEN) {
            y = Y_OPEN;
            v = 0;
          }
          state = y < Y_OPEN - 1e-4 ? '펴지는 중' : '펴짐';
        } else if (tc >= T_CLOSE0 && tc < T_CLOSE1) {
          // 손으로 러너를 끌어내려 접는다 → 스프링이 다시 눌림, 끝에서 걸쇠에 걸림
          const k = smooth((tc - T_CLOSE0) / (T_CLOSE1 - T_CLOSE0));
          y = Y_OPEN + (Y_CLOSED - Y_OPEN) * k;
          v = 0;
          state = '접는 중 (손)';
        } else {
          y = Y_CLOSED;
          v = 0;
          state = latched ? '접힘 (걸쇠)' : '접힘';
        }
        this.pose(y, press, !latched || (tc > T_CLOSE1 - 0.4 && tc < T_CLOSE1));
      },
      getDisplay: () => [
        { label: '러너 높이', value: ((this.yR - Y_CLOSED) * CM_PER_UNIT).toFixed(1), unit: 'cm' },
        { label: '살 벌어진 각도', value: ((this.alpha * 180) / Math.PI).toFixed(0), unit: '°', tone: 'blue' },
        { label: '상태', value: state, tone: state.startsWith('펴') ? 'red' : 'default' }
      ]
    };
  }

  // ── 자세 ──

  /** 러너 높이 y → 삼각 링크 풀이 → 살·받침살·스프링·천 */
  private pose(y: number, press: number, latchIn: boolean): void {
    this.yR = y;
    this.runner.position.y = y;
    // 받침살이 없으면 살은 접힌 채로 늘어져 있다
    let alpha = CLOSED_A;
    let s = new THREE.Vector2(R_N + SA * Math.sin(alpha), TOP_N - SA * Math.cos(alpha));
    if (this.linkModel) {
      s = circleHit(new THREE.Vector2(R_N, TOP_N), SA, new THREE.Vector2(R_E, y), SB, this.sNear);
      this.sNear.copy(s);
      alpha = Math.atan2(s.x - R_N, TOP_N - s.y);
    }
    this.alpha = alpha;
    for (const r of this.ribs) r.rib.rotation.z = alpha;
    const beta = Math.atan2(s.x - R_E, s.y - y);
    this.stretchers.forEach((st) => {
      st.position.y = y;
      const arm = st.children[0];
      if (arm) arm.rotation.z = -beta;
    });
    if (this.coil) this.coil.scale.y = Math.max(0.05, (y - RUNNER_H / 2 - SEAT_Y) / this.coilLen0);
    this.button.position.z = 0.088 - 0.022 * press;
    this.latch.scale.x = latchIn ? 0.25 : 1;
    this.updateCanopy(alpha);
  }

  private updateCanopy(alpha: number): void {
    const open = (alpha - CLOSED_A) / (OPEN_A - CLOSED_A);
    const NU = 7;
    const NV = 13;
    const sa = Math.sin(alpha);
    const ca = Math.cos(alpha);
    for (const part of this.canopy) {
      const pos = part.geo.getAttribute('position') as THREE.BufferAttribute;
      let o = 0;
      for (const i of part.panels) {
        const a0 = (i / RIBS) * Math.PI * 2;
        const a1 = ((i + 1) / RIBS) * Math.PI * 2;
        for (let iu = 0; iu < NU; iu++) {
          const u = iu / (NU - 1);
          const a = a0 + (a1 - a0) * u;
          // 살 사이 천: 살 두 개를 잇는 현(弦)을 따라가되, 접히면 바깥으로 주름, 펴지면 끝단이 물결
          const chord = Math.cos((a1 - a0) / 2) / Math.cos(a - (a0 + a1) / 2);
          const bulge = Math.sin(Math.PI * u);
          for (let iv = 0; iv < NV; iv++) {
            const v = iv / (NV - 1);
            const d = v * RIB_L;
            let r = (R_N + d * sa) * chord;
            let yy = TOP_N - d * ca + 0.018;
            r += bulge * v * (0.09 * (1 - open)) - bulge * v * v * 0.05 * open;
            yy += bulge * v * v * 0.04 * open;
            pos.setXYZ(o++, Math.cos(a) * r, yy, Math.sin(a) * r);
          }
        }
      }
      pos.needsUpdate = true;
      part.geo.computeVertexNormals();
      part.geo.computeBoundingSphere();
    }
  }

  // ── 미션 부품 ──

  /** ① 압축 코일 스프링: 칼라 자리 위, 중봉을 감싼다 */
  private buildSpring(): THREE.Group {
    const g = new THREE.Group();
    const coil = new THREE.Group();
    coil.name = 'coil';
    coil.position.y = SEAT_Y;
    this.coilLen0 = 0.6;
    coil.add(new THREE.Mesh(coilGeo(SPRING_R, 0.0065, 10, this.coilLen0), paint(CATEGORY_COLORS.control, { roughness: 0.3, metalness: 0.5 })));
    coil.scale.y = (Y_CLOSED - RUNNER_H / 2 - SEAT_Y) / this.coilLen0;
    g.add(coil);
    return g;
  }

  /** ② 받침살 8개: 러너 핀에서 큰 살의 S점까지 */
  private buildStretchers(): THREE.Group {
    const g = new THREE.Group();
    const mat = paint(CATEGORY_COLORS.power, { roughness: 0.35, metalness: 0.4 });
    const geo = stickGeo(SB, 0.016);
    const jointGeo = new THREE.SphereGeometry(0.018, 14, 10);
    for (let i = 0; i < RIBS; i++) {
      const phi = ((i + 0.5) / RIBS) * Math.PI * 2 - Math.PI / RIBS;
      const st = new THREE.Group();
      st.name = `st${i}`;
      st.rotation.y = -phi;
      st.position.y = Y_CLOSED;
      const arm = new THREE.Group();
      arm.position.x = R_E;
      arm.add(new THREE.Mesh(geo, mat));
      const top = new THREE.Mesh(jointGeo, mat);
      top.position.y = SB;
      arm.add(top);
      st.add(arm);
      g.add(st);
    }
    return g;
  }

  // ── 고정 구조 ──

  private buildStand(): void {
    const grp = this.group;
    const base = new THREE.Mesh(lathe([[0, 0], [0.62, 0], [0.66, 0.03], [0.64, 0.08], [0.5, 0.11], [0.2, 0.12], [0, 0.12]], 64), castIron({ color: 0x40464e }));
    grp.add(base);
    const cup = new THREE.Mesh(lathe([[0.11, 0.5], [0.13, 0.5], [0.135, 0.47], [0.135, 0.12], [0.16, 0.1], [0.11, 0.1]], 48), paint(0x2f9e6b, { roughness: 0.35 }));
    grp.add(cup);
    const cupIn = new THREE.Mesh(lathe([[0, 0.12], [0.11, 0.12], [0.11, 0.49], [0.1, 0.49]], 48), plastic(0x1d2024));
    grp.add(cupIn);
  }

  private buildShaft(): void {
    const grp = this.group;
    // 손잡이: 홈 있는 고무 그립 + 위 칼라 + 버튼
    const prof: V2[] = [[0, 0.2], [0.075, 0.2]];
    for (let i = 0; i <= 24; i++) {
      const y = 0.24 + (i / 24) * 0.62;
      prof.push([0.082 + 0.006 * Math.cos(i * Math.PI), y]);
    }
    prof.push([0.075, HANDLE_TOP - 0.04], [0.05, HANDLE_TOP], [0, HANDLE_TOP]);
    grp.add(new THREE.Mesh(lathe(prof, 48), rubber({ color: 0x2b2d31, roughness: 0.75 })));
    const collar = new THREE.Mesh(lathe([[0.03, HANDLE_TOP - 0.06], [0.07, HANDLE_TOP - 0.06], [0.072, HANDLE_TOP + 0.02], [0.04, HANDLE_TOP + 0.04], [0.03, HANDLE_TOP + 0.04]], 40), chrome());
    grp.add(collar);
    const btnSeat = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.12, 0.03, 2, 0.012), plastic(0x4a5058));
    btnSeat.position.set(0, 0.8, 0.078);
    grp.add(btnSeat);
    this.button = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.09, 0.04, 3, 0.016), paint(0xd8362f, { roughness: 0.3 }));
    this.button.position.set(0, 0.8, 0.088);
    grp.add(this.button);

    // 중봉 + 위 꼭지 + 끝 장식
    grp.add(new THREE.Mesh(cylY(SHAFT_R, HANDLE_TOP, TOP_N + 0.1, 24), steel({ color: 0xc9d0d8, roughness: 0.25 })));
    const seat = new THREE.Mesh(lathe([[SHAFT_R, SEAT_Y - 0.05], [0.062, SEAT_Y - 0.05], [0.066, SEAT_Y - 0.03], [0.066, SEAT_Y], [SHAFT_R, SEAT_Y]], 40), darkSteel());
    grp.add(seat);
    const notch = new THREE.Mesh(lathe([[SHAFT_R, TOP_N - 0.07], [0.07, TOP_N - 0.07], [0.085, TOP_N - 0.05], [0.085, TOP_N + 0.05], [0.07, TOP_N + 0.07], [SHAFT_R, TOP_N + 0.07]], 48), plastic(0x2b2e33, { roughness: 0.45 }));
    grp.add(notch);
    const tip = new THREE.Mesh(lathe([[0, TOP_N + 0.06], [0.05, TOP_N + 0.06], [0.04, TOP_N + 0.12], [0.022, TOP_N + 0.3], [0.03, TOP_N + 0.32], [0.02, TOP_N + 0.36], [0, TOP_N + 0.37]], 32), chrome());
    grp.add(tip);
    // 걸쇠: 러너 바로 위 중봉에서 튀어나온 쐐기(버튼을 누르면 들어간다)
    this.latch = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.035, 0.03, 1, 0.006), steel({ color: 0xe0e4ea }));
    this.latch.geometry.translate(0.015, 0, 0);
    this.latch.position.set(SHAFT_R - 0.004, LATCH_Y, 0);
    this.latch.rotation.y = -Math.PI / 2;
    grp.add(this.latch);

    // 러너: 미끄럼 칼라 + 받침살 핀 귀 8개
    const rp: V2[] = [[SHAFT_R + 0.002, -RUNNER_H / 2], [0.07, -RUNNER_H / 2], [0.082, -RUNNER_H / 2 + 0.02], [0.082, RUNNER_H / 2 - 0.03], [0.06, RUNNER_H / 2], [SHAFT_R + 0.002, RUNNER_H / 2]];
    this.runner.add(new THREE.Mesh(lathe(rp, 48), plastic(0x2b2e33, { roughness: 0.45 })));
    const earGeo = new RoundedBoxGeometry(0.03, 0.05, 0.03, 1, 0.006);
    for (let i = 0; i < RIBS; i++) {
      const phi = ((i + 0.5) / RIBS) * Math.PI * 2 - Math.PI / RIBS;
      const ear = new THREE.Mesh(earGeo, this.ribMat);
      ear.position.set(Math.cos(phi) * (R_E - 0.002), 0.0, Math.sin(phi) * (R_E - 0.002));
      ear.rotation.y = -phi;
      this.runner.add(ear);
    }
    grp.add(this.runner);
  }

  private buildRibs(): void {
    const geo = stickGeo(RIB_L, 0.012);
    const capGeo = new THREE.SphereGeometry(0.022, 14, 10);
    const capMat = plastic(0xeef1f4, { roughness: 0.4 });
    const jointGeo = new THREE.SphereGeometry(0.016, 12, 8);
    for (let i = 0; i < RIBS; i++) {
      const phi = ((i + 0.5) / RIBS) * Math.PI * 2 - Math.PI / RIBS;
      const pivot = new THREE.Group();
      pivot.position.set(0, TOP_N, 0);
      pivot.rotation.y = -phi;
      const rib = new THREE.Group();
      rib.position.x = R_N;
      const stick = new THREE.Mesh(geo, this.ribMat);
      stick.rotation.z = Math.PI; // +Y 막대를 아래(-Y)로
      rib.add(stick);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = -RIB_L;
      rib.add(cap);
      const joint = new THREE.Mesh(jointGeo, this.ribMat);
      joint.position.y = -SA;
      rib.add(joint);
      pivot.add(rib);
      this.group.add(pivot);
      this.ribs.push({ pivot, rib, dirX: Math.cos(phi), dirZ: Math.sin(phi) });
    }
  }

  private buildCanopy(): void {
    const NU = 7;
    const NV = 13;
    const colors = [0x2468c9, 0xf2f5f8];
    for (let c = 0; c < 2; c++) {
      const panels: number[] = [];
      for (let i = c; i < RIBS; i += 2) panels.push(i);
      // 기준 각도: 살 사이 칸 i 는 살 i(φ_i)와 살 i+1 사이 — 살 φ는 (i/RIBS)·2π 기준으로 둔다
      const count = panels.length * NU * NV;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const idx: number[] = [];
      for (let p = 0; p < panels.length; p++) {
        const base = p * NU * NV;
        for (let iu = 0; iu < NU - 1; iu++) {
          for (let iv = 0; iv < NV - 1; iv++) {
            const a = base + iu * NV + iv;
            const b = a + NV;
            idx.push(a, a + 1, b, b, a + 1, b + 1);
          }
        }
      }
      geo.setIndex(idx);
      const mat = plastic(colors[c]!, { roughness: 0.6 });
      mat.side = THREE.DoubleSide;
      mat.transparent = true;
      mat.opacity = 0.88;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.noAO = true;
      this.group.add(mesh);
      this.canopy.push({ geo, panels });
    }
  }
}
