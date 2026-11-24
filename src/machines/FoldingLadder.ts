// 접이식 사다리(A형, 알루미늄): 앞 다리(발판 5단)와 뒤 다리가 위 경첩에서 벌어진다.
// 1단계: 두 다리 사이를 잡는 링크(2절 막대 한 쌍). 중간 관절이 꺾이며 벌어짐을 제한한다.
// 2단계: 중간 관절의 핀 끝에 끼우는 분할 핀. 끝이 두 갈래로 벌어져 핀이 빠지지 않는다.
// 좌표: 바닥 y=0, +X 오른쪽(앞 다리 쪽), +Z 화면 앞. 링크는 다리 바깥쪽 면(±Z)에 달린다.
// 기구: 경첩 H = (0, L cosθ). 다리 끝은 바닥에 닿아 있다(x = ±L sinθ). 링크 길이 a = d sinθ_open
//       으로 두면 펼친 상태에서 두 막대가 일직선이 되어 더 벌어지지 않는다(잠김).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, paint, plastic, rubber, steel } from '../models/materials';

// 다리
const LEG_L = 3.4; // 다리 길이(경첩 중심 ~ 발 끝) — 전체가 반경 3 안에
const RZ = 0.42; // 두 레일의 z 위치(±)
const RAIL_T = 0.1; // 레일 두께(다리 면 방향)
const RAIL_W = 0.09; // 레일 폭(z)
const RAIL_LEN = LEG_L - 0.1; // 레일 길이(발 고무 제외)
const RUNGS = [0.55, 1.15, 1.75, 2.35, 2.9]; // 같은 간격 // 앞 다리 발판 위치(발 쪽에서 잰 거리)

// 링크
const HINGE_D = 1.4; // 다리 위에서 링크가 달리는 거리(경첩에서)
const THETA_OPEN = 0.32; // 펼친 상태: 다리 반각 ≈ 18°
const THETA_CLOSE = 0.05; // 접은 상태
const LINK_A = HINGE_D * Math.sin(THETA_OPEN); // 막대 길이(고정)
const ZL = RZ + 0.1; // 링크 면의 z(±)
const SPLIT_SPREAD = 0.45; // 분할 핀 다리가 벌어진 각

// 한 주기 8초: 펼침 유지 → 접음 → 접힘 유지 → 펴짐
const CYCLE = 8;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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

function roundBox(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
}

/** z 방향 축의 원기둥 (z0~z1 구간, 절대 좌표) */
function zCyl(r: number, z0: number, z1: number, seg = 24): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

/** 경첩 각도 θ에서의 기구 위치 */
interface Pose {
  hingeY: number; // 경첩 높이 L cosθ
  ax: number; // 링크 연결점의 x (±)
  ay: number; // 링크 연결점의 y
  my: number; // 중간 관절의 y (두 원의 교점 중 아래쪽)
}

function pose(th: number): Pose {
  const hingeY = LEG_L * Math.cos(th);
  const ax = HINGE_D * Math.sin(th);
  const ay = hingeY - HINGE_D * Math.cos(th);
  // 두 막대 길이가 같으므로 교점은 x=0 위: 연결점 거리의 절반 ax, 높이 차 sqrt(a² - ax²)
  const my = ay - Math.sqrt(Math.max(0, LINK_A * LINK_A - ax * ax));
  return { hingeY, ax, ay, my };
}

/** 한 주기의 경첩 각도 θ와 상태 이름 */
function cycle(tm: number): { th: number; label: string } {
  const tt = tm % CYCLE;
  if (tt < 1.5) return { th: THETA_OPEN, label: '펴짐 유지' };
  if (tt < 3.5) return { th: lerp(THETA_OPEN, THETA_CLOSE, smooth((tt - 1.5) / 2)), label: '접는 중' };
  if (tt < 4.5) return { th: THETA_CLOSE, label: '접힘 유지' };
  if (tt < 6.5) return { th: lerp(THETA_CLOSE, THETA_OPEN, smooth((tt - 4.5) / 2)), label: '펴는 중' };
  return { th: THETA_OPEN, label: '펴짐 유지' };
}

/** 원점이 x축 길이 a 막대의 중심에 오도록 두 점 사이에 놓는다 */
function placeBar(m: THREE.Mesh, x0: number, y0: number, x1: number, y1: number, z: number): void {
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(x1 - x0, y1 - y0, 0).normalize());
}

interface LinkPart {
  sz: number;
  bar1: THREE.Mesh; // 앞 다리 연결점 → 중간 관절
  bar2: THREE.Mesh; // 중간 관절 → 뒤 다리 연결점
  pinF: THREE.Mesh;
  pinB: THREE.Mesh;
  pinM: THREE.Mesh;
}

interface SplitPart {
  g: THREE.Group;
  sz: number;
  tines: THREE.Mesh[];
}

export class FoldingLadder extends BaseMachine {
  readonly id = 'ladder';
  /** 원점 = 경첩 중심. 높이 = L cosθ (다리 끝이 바닥에 닿도록 경첩이 같이 움직인다) */
  private frame = new THREE.Group();
  /** 앞 다리(발판 있음): 원점 = 경첩, rotation.z = +θ */
  private frontLeg = new THREE.Group();
  /** 뒤 다리: 원점 = 경첩, rotation.z = -θ */
  private backLeg = new THREE.Group();
  private linkModel: THREE.Group | null = null;
  private splitModel: THREE.Group | null = null;
  private links: LinkPart[] = [];
  private splits: SplitPart[] = [];
  private theta = THETA_OPEN;
  private splitSlide = 0;
  private splitSpread = SPLIT_SPREAD;
  private splitAnim: { k: number; last: number } | null = null;

  private readonly alu = aluminum();
  private readonly railMat = aluminum();

  constructor() {
    super();
    this.group.add(this.frame);
    this.frame.add(this.frontLeg, this.backLeg);
    this.buildHinge();
    this.buildLeg(true);
    this.buildLeg(false);
    this.setTheta(THETA_OPEN);

    const yOpen = pose(THETA_OPEN).my;
    this.addSlot(0, 0.24, new THREE.Vector3(0, yOpen, ZL + 0.25), 0.016);
    this.addSlot(1, 0.11, new THREE.Vector3(0, yOpen, ZL + 0.4), 0.012);
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
    return step === 0 ? this.linkModel !== null : this.splitModel !== null;
  }

  getFlyTarget(): THREE.Vector3 {
    return new THREE.Vector3(0, pose(THETA_OPEN).my, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return new THREE.Vector3(0, pose(THETA_OPEN).my, ZL + (step === 0 ? 0.25 : 0.4));
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildLink() : this.buildSplit();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      this.linkModel = model;
      this.hideSlot(0);
      this.showSlot(1);
      this.placeLink(this.theta);
    } else {
      this.splitModel = model;
      this.hideSlot(1);
      this.splitSlide = 0.5;
      this.splitSpread = 0;
      this.splitAnim = { k: 0, last: -1 };
      this.placeLink(this.theta);
    }
  }

  reset(): void {
    if (this.linkModel) this.group.remove(this.linkModel);
    if (this.splitModel) this.group.remove(this.splitModel);
    this.linkModel = this.splitModel = null;
    this.links = [];
    this.splits = [];
    this.splitAnim = null;
    this.splitSlide = 0;
    this.splitSpread = SPLIT_SPREAD;
    this.setTheta(THETA_OPEN);
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (!this.splitAnim) return;
    const dt = this.splitAnim.last < 0 ? 0 : Math.min(0.05, t - this.splitAnim.last);
    this.splitAnim.last = t;
    this.splitAnim.k += dt / 1.2;
    if (this.splitAnim.k >= 1) {
      this.finishSplit();
      return;
    }
    // 앞부분: 핀이 구멍에 들어감, 뒷부분: 끝이 벌어짐
    const k = this.splitAnim.k;
    this.splitSlide = 0.5 * (1 - smooth(k / 0.6));
    this.splitSpread = SPLIT_SPREAD * smooth((k - 0.6) / 0.4);
    this.placeLink(this.theta);
  }

  createSim(): MachineSim {
    if (!this.linkModel || !this.splitModel) throw new Error('ladder mission incomplete');
    this.finishSplit();
    let time = 0;
    let th = THETA_OPEN;
    let label = '펴짐 유지';
    return {
      update: (dt: number) => {
        time += dt;
        const ph = cycle(time);
        th = ph.th;
        label = ph.label;
        this.setTheta(th);
      },
      getDisplay: () => {
        const spreadDeg = Math.round(2 * th * (180 / Math.PI));
        const state = th >= THETA_OPEN - 1e-3 ? '펴짐 (잠김)' : th <= THETA_CLOSE + 1e-3 ? '접힘' : '움직이는 중';
        return [
          { label: '벌어짐 각도', value: String(spreadDeg), unit: '°' },
          { label: '링크 상태', value: state, tone: 'blue' },
          { label: '상태', value: label, tone: 'red' }
        ];
      }
    };
  }

  // ───────────────────────── 조립 연출 ─────────────────────────

  private finishSplit(): void {
    this.splitAnim = null;
    this.splitSlide = 0;
    this.splitSpread = SPLIT_SPREAD;
    this.placeLink(this.theta);
  }

  /** 경첩 각도 설정: 다리 두 쪽, 경첩 높이, 링크와 분할 핀 위치를 한 번에 갱신 */
  private setTheta(th: number): void {
    this.theta = th;
    this.frame.position.y = pose(th).hingeY;
    this.frontLeg.rotation.z = th;
    this.backLeg.rotation.z = -th;
    this.placeLink(th);
  }

  /** 링크 막대 길이는 상수. 연결점과 중간 관절만 기구 위치대로 옮긴다 */
  private placeLink(th: number): void {
    const p = pose(th);
    for (const l of this.links) {
      const z = l.sz * ZL;
      placeBar(l.bar1, p.ax, p.ay, 0, p.my, z);
      placeBar(l.bar2, 0, p.my, -p.ax, p.ay, z);
      l.pinF.position.set(p.ax, p.ay, 0);
      l.pinB.position.set(-p.ax, p.ay, 0);
      l.pinM.position.set(0, p.my, 0);
    }
    for (const s of this.splits) {
      s.g.position.set(0, p.my, s.sz * this.splitSlide);
      s.tines.forEach((t, i) => {
        t.rotation.z = (i === 0 ? 1 : -1) * this.splitSpread;
      });
    }
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 링크: 막대 2개(연결점~중간 관절) × 2조, 각 관절에 핀. 중간 핀 끝에는 분할 핀 구멍이 있다 */
  private buildLink(): THREE.Group {
    const g = new THREE.Group();
    const barMat = paint(CATEGORY_COLORS.control, { roughness: 0.35 });
    const pinMat = steel({ roughness: 0.3 });
    const holeMat = plastic(0x0d0e10, { roughness: 0.9 });
    const barGeo = new RoundedBoxGeometry(LINK_A, 0.08, 0.04, 2, 0.015);
    const holeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.004, 16);
    holeGeo.rotateX(Math.PI / 2);
    this.links = [];
    for (const sz of [-1, 1]) {
      const bar1 = new THREE.Mesh(barGeo, barMat);
      const bar2 = new THREE.Mesh(barGeo, barMat);
      const pinF = new THREE.Mesh(zCyl(0.03, sz * RZ, sz * (ZL + 0.05), 20), pinMat);
      const pinB = new THREE.Mesh(zCyl(0.03, sz * RZ, sz * (ZL + 0.05), 20), pinMat);
      const pinM = new THREE.Mesh(zCyl(0.034, sz * (ZL - 0.05), sz * (ZL + 0.12), 24), pinMat);
      const hole = new THREE.Mesh(holeGeo, holeMat);
      hole.position.set(0, 0, sz * (ZL + 0.122));
      pinM.add(hole);
      this.links.push({ sz, bar1, bar2, pinF, pinB, pinM });
      g.add(bar1, bar2, pinF, pinB, pinM);
    }
    this.placeLink(this.theta);
    return g;
  }

  /** 분할 핀 2개: 중간 핀 끝을 세로로 관통하는 두 가닥 + 고리 머리. 설치 후 끝이 벌어진다 */
  private buildSplit(): THREE.Group {
    const g = new THREE.Group();
    const mat = steel({ color: 0xd4d9de, roughness: 0.3 });
    const tineGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 16);
    const headGeo = new THREE.TorusGeometry(0.035, 0.011, 12, 32);
    this.splits = [];
    for (const sz of [-1, 1]) {
      const sg = new THREE.Group();
      const zS = sz * (ZL + 0.08);
      const tines: THREE.Mesh[] = [];
      for (const sx of [-1, 1]) {
        const t = new THREE.Mesh(tineGeo, mat);
        t.position.set(sx * 0.02, 0, zS);
        tines.push(t);
        sg.add(t);
      }
      const head = new THREE.Mesh(headGeo, mat);
      head.position.set(0, 0.1, zS);
      sg.add(head);
      this.splits.push({ g: sg, sz, tines });
      g.add(sg);
    }
    return g;
  }

  private buildHinge(): void {
    const hingeMat = steel({ roughness: 0.3 });
    const cap = roundBox(0.5, 0.12, 2 * RZ + 0.3, 0.03, this.alu, 0, 0.06, 0);
    this.frame.add(cap);
    this.frame.add(new THREE.Mesh(zCyl(0.04, -RZ - 0.12, RZ + 0.12, 24), hingeMat));
  }

  /** 다리 한쪽: 레일 2개(z ±RZ), 발 고무 2개, 앞 다리만 발판 */
  private buildLeg(front: boolean): void {
    const leg = front ? this.frontLeg : this.backLeg;
    const footMat = rubber();
    for (const sz of [-1, 1]) {
      leg.add(roundBox(RAIL_T, RAIL_LEN, RAIL_W, 0.03, this.railMat, 0, -RAIL_LEN / 2, sz * RZ));
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.1, 24), footMat);
      foot.position.set(0, -LEG_L + 0.05, sz * RZ);
      leg.add(foot);
    }
    if (front) {
      for (const s of RUNGS) {
        leg.add(roundBox(0.13, 0.07, 2 * RZ + 0.09, 0.02, this.alu, 0, -s, 0));
      }
    }
  }
}
