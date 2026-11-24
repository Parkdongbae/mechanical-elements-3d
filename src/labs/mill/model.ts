// 물레방아 3D 모델 — 방앗간 바닥·구덩이, 물레바퀴(날개 32장), 굴통, 받침 기둥, 누름대 2개,
// 방아채 2개(볼씨·방아공이), 확돌, 물홈·수문, 물. 치수는 실제 m 이고 root.scale = 0.8.
// 부품은 모두 materials.ts 의 재질만 쓰고, 이름표 위치는 anchor() 로 내보낸다.

import * as THREE from 'three';
import { plastic } from '../../models/materials';
import type { CameraView } from '../../scene/SceneSetup';
import { MILL, type MillState, type PartKey, type ViewKey } from './types';
import {
  DEG, BOWL_Z, GATE_H, GATE_LIFT, GATE_Z, POST_X, BLADE_LAG,
  chuteTopY, buildGround, buildWheel, buildShaft, buildPosts, buildArm, buildBeam, buildPivot, buildBowl,
  buildChute, buildGate, polar, type Reg
} from './parts';
import { MillWater } from './water';

export const MILL_SCALE = 0.8;
const ROOT_POS = new THREE.Vector3(-1.2, 0.85, -0.3);
const TWO_PI = Math.PI * 2;

interface Grain { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }

export class MillModel {
  readonly root = new THREE.Group();

  private reg: Reg = new Map();
  private wheelG: THREE.Group;
  private shaftG: THREE.Group;
  private armG: [THREE.Group, THREE.Group];
  private beamG: [THREE.Group, THREE.Group];
  private gateSlide: THREE.Group;
  private water: MillWater;
  private grains: Grain[] = [];
  private grainMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private dimBase = new Map<THREE.Material, THREE.Color>();
  private theta = 0;
  private betas: [number, number] = [MILL.betaRest * DEG, MILL.betaRest * DEG];
  private gateOpen = 0;
  private gateForced: boolean | null = null;
  private tmpInv = new THREE.Matrix4();
  private tmpRay = new THREE.Ray();
  private disposed = false;
  private viewKey: ViewKey = 'all';

  constructor() {
    this.root.scale.setScalar(MILL_SCALE);
    this.root.position.copy(ROOT_POS);
    this.root.name = 'waterMill';
    const R = this.reg;

    buildGround(this.root);
    buildPosts(R, this.root);

    this.wheelG = buildWheel(R);
    this.wheelG.position.set(0, MILL.axisY, 0);
    this.root.add(this.wheelG);

    this.shaftG = buildShaft(R);
    this.shaftG.position.set(0, MILL.axisY, 0);
    this.root.add(this.shaftG);

    const arms: THREE.Group[] = [];
    const beams: THREE.Group[] = [];
    for (const i of [0, 1] as const) {
      const a = buildArm(R, i);
      a.position.set(MILL.armX[i], MILL.axisY, 0);
      this.root.add(a);
      arms.push(a);
      const b = buildBeam(R, i);
      b.position.set(MILL.armX[i], MILL.pivotY, MILL.pivotZ);
      b.rotation.x = -MILL.betaRest * DEG;
      this.root.add(b);
      beams.push(b);
      buildPivot(R, i, this.root);
      buildBowl(R, i, this.root);
    }
    this.armG = [arms[0]!, arms[1]!];
    this.beamG = [beams[0]!, beams[1]!];

    buildChute(R, this.root);
    this.gateSlide = buildGate(R, this.root);

    this.water = new MillWater();
    this.root.add(this.water.root);

    // 곡식 알갱이(확돌에서 튀는 것)
    const gg = new THREE.SphereGeometry(0.022, 8, 6);
    const gm = plastic(0xe6c36a, { roughness: 0.9 });
    this.grainMesh = new THREE.InstancedMesh(gg, gm, 48);
    this.grainMesh.castShadow = true;
    this.grainMesh.frustumCulled = false;
    this.grainMesh.count = 0;
    this.root.add(this.grainMesh);

    // 재질별 원래 색(setFocus 에서 복원)
    for (const arr of this.reg.values()) {
      for (const m of arr) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (!this.dimBase.has(mat)) this.dimBase.set(mat, mat.color.clone());
      }
    }
    this.apply(this.stillState());
    this.root.updateMatrixWorld(true);
  }

  private stillState(): MillState {
    const b = { beta: MILL.betaRest * DEG, betaDot: 0, engaged: false, lift: 0 };
    return {
      t: 0, theta: 100 * DEG, omega: 0, waterMass: 0, flow: 0,
      beams: [{ ...b }, { ...b }], strikes: [0, 0], last: [null, null]
    };
  }

  // ───────────────────────── 매 프레임 ─────────────────────────

  apply(s: MillState): void {
    this.theta = s.theta;
    this.wheelG.rotation.x = s.theta;
    this.shaftG.rotation.x = s.theta;
    for (const i of [0, 1] as const) {
      this.armG[i].rotation.x = s.theta + MILL.armOffset[i] * DEG;
      const beta = s.beams[i].beta;
      this.betas[i] = beta;
      this.beamG[i].rotation.x = -beta;
    }
  }

  /** 수문 열림을 직접 알려 줄 때(화면). 부르지 않으면 flow > 0 이면 열린 것으로 본다 */
  setGate(open: boolean | null): void {
    this.gateForced = open;
  }

  updateWater(s: MillState, dt: number): void {
    const target = (this.gateForced ?? s.flow > 1e-4) ? 1 : 0;
    const step = dt / 0.8;
    this.gateOpen = target > this.gateOpen ? Math.min(target, this.gateOpen + step) : Math.max(target, this.gateOpen - step);
    this.gateSlide.position.y = chuteTopY(GATE_Z) + GATE_LIFT * this.gateOpen;
    this.water.update(s, dt);
    this.updateGrains(dt);
  }

  /** 확돌에서 곡식 알갱이가 살짝 튄다 */
  strike(beam: 0 | 1, energy: number): void {
    const k = Math.sqrt(Math.max(energy, 0) / 230);
    const n = Math.round(6 + 6 * Math.min(2, k));
    const x = MILL.armX[beam];
    for (let i = 0; i < n && this.grains.length < 48; i++) {
      const a = Math.random() * TWO_PI;
      const rr = Math.random() * 0.12;
      this.grains.push({
        x: x + Math.cos(a) * rr,
        y: -0.13,
        z: BOWL_Z + Math.sin(a) * rr,
        vx: Math.cos(a) * (0.2 + Math.random() * 0.4) * k,
        vy: (0.9 + Math.random() * 1.2) * k,
        vz: Math.sin(a) * (0.2 + Math.random() * 0.4) * k,
        life: 1
      });
    }
  }

  private updateGrains(dt: number): void {
    let n = 0;
    for (let i = 0; i < this.grains.length; i++) {
      const g = this.grains[i]!;
      g.vy -= 9.81 * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
      g.life -= dt;
      if (g.y < -0.15 && g.vy < 0) continue; // 곡식 더미로 돌아감
      if (g.life <= 0) continue;
      this.grains[n++] = g;
    }
    this.grains.length = n;
    for (let i = 0; i < n; i++) {
      const g = this.grains[i]!;
      this.dummy.position.set(g.x, g.y, g.z);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.grainMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.grainMesh.count = n;
    this.grainMesh.instanceMatrix.needsUpdate = true;
  }

  // ───────────────────────── 강조 ─────────────────────────

  setFocus(parts: PartKey[] | null): void {
    const keep = new Set<PartKey>(parts ?? []);
    const grey = new THREE.Color(0x8b9199);
    for (const [key, arr] of this.reg) {
      for (const m of arr) {
        const mat = m.material as THREE.MeshStandardMaterial;
        const base = this.dimBase.get(mat);
        if (!base) continue;
        if (!parts || keep.has(key)) mat.color.copy(base);
        else mat.color.copy(base).lerp(grey, 0.55);
      }
    }
  }

  // ───────────────────────── 이름표 위치(root 로컬, 실제 m) ─────────────────────────

  /** 방아채 i 의 로컬 점 (z, y) → root 로컬 */
  private beamPoint(i: 0 | 1, lz: number, ly: number, dx = 0): THREE.Vector3 {
    const b = this.betas[i];
    const c = Math.cos(b);
    const s = Math.sin(b);
    return new THREE.Vector3(MILL.armX[i] + dx, MILL.pivotY + ly * c + lz * s, MILL.pivotZ - ly * s + lz * c);
  }

  /** 누름대 이름표 자리: 두 끝 중 위쪽 끝(굴통 위로 솟은 쪽). 누르는 끝은 방아채 꼬리·다른 방아채에 가려지기 쉽다 */
  private armTip(i: 0 | 1): THREE.Vector3 {
    const base = this.theta + MILL.armOffset[i] * DEG;
    const a = Math.cos(base) >= 0 ? base : base + Math.PI;
    const p = polar(MILL.armR - 0.08, a);
    return new THREE.Vector3(MILL.armX[i] + 0.07, p.y, p.z);
  }

  /** 지금 시점을 알려 준다 — 바퀴 시점(−x 쪽에서 봄)에서는 바퀴 뒤에 가린 부품의 이름표를 숨기거나 앞쪽 부품으로 옮긴다 */
  setView(key: ViewKey): void {
    this.viewKey = key;
  }

  anchor(key: PartKey): THREE.Vector3 | null {
    const ax = MILL.axisY;
    if (this.viewKey === 'wheel') {
      // 누름대 1·굴통 가운데는 바퀴 뒤에 가려진다
      if (key === 'arm1' || key === 'arm2') return null;
      if (key === 'post') return new THREE.Vector3(POST_X[0] - 0.09, 0.6, 0.18);
      if (key === 'shaft') return new THREE.Vector3(-0.72, ax, MILL.shaftR * 0.7);
    }
    switch (key) {
      case 'chute': return new THREE.Vector3(0.3, chuteTopY(-1.5) + 0.12, -1.5);
      case 'gate': return new THREE.Vector3(0.3, chuteTopY(GATE_Z) + GATE_H + GATE_LIFT * this.gateOpen, GATE_Z);
      case 'wheel': {
        const p = polar(MILL.wheelR - 0.05, -50 * DEG);
        return new THREE.Vector3(0.5, p.y, p.z);
      }
      case 'blade': {
        // 지금 100° 근처에 있는 날개의 바깥 끝
        const pitch = TWO_PI / MILL.blades;
        const want = 100 * DEG - BLADE_LAG;
        const k = Math.round((want - this.theta) / pitch);
        const a = k * pitch + this.theta - BLADE_LAG;
        const p = polar(MILL.wheelR, a);
        return new THREE.Vector3(0.5, p.y, p.z);
      }
      case 'shaft': return new THREE.Vector3(2.15, ax + MILL.shaftR, 0);
      case 'post': return new THREE.Vector3(POST_X[1] + 0.09, 0.6, 0.18); // 기둥 몸통 옆면(위 홈은 굴통이 가린다)
      case 'arm1': return this.armTip(0);
      case 'arm2': return this.armTip(1);
      case 'beam1': return this.beamPoint(0, 0.9, 0.0, 0.11);
      case 'beam2': return this.beamPoint(1, 0.9, 0.0, 0.11);
      case 'pivot1': return new THREE.Vector3(MILL.armX[0] + 0.2, MILL.pivotY + 0.14, MILL.pivotZ);
      case 'pivot2': return new THREE.Vector3(MILL.armX[1] + 0.2, MILL.pivotY + 0.14, MILL.pivotZ);
      case 'pestle1': return this.beamPoint(0, MILL.pestleArm, -0.45, 0.08);
      case 'pestle2': return this.beamPoint(1, MILL.pestleArm, -0.45, 0.08);
      case 'bowl1': return new THREE.Vector3(MILL.armX[0] + 0.3, 0.1, BOWL_Z + 0.27);
      case 'bowl2': return new THREE.Vector3(MILL.armX[1] + 0.3, 0.1, BOWL_Z + 0.27);
      default: return null;
    }
  }

  /** 레이(월드)와 바퀴 평면(root 로컬 x = 0)의 교점을 root 로컬 좌표로 돌려준다. 앞으로 향하는 교점이 없으면 false */
  rimPoint(ray: THREE.Ray, out: THREE.Vector3): boolean {
    this.root.updateWorldMatrix(true, false);
    this.tmpInv.copy(this.root.matrixWorld).invert();
    this.tmpRay.copy(ray).applyMatrix4(this.tmpInv);
    const o = this.tmpRay.origin;
    const d = this.tmpRay.direction;
    if (Math.abs(d.x) < 1e-6) return false;
    const t = -o.x / d.x;
    if (t <= 0) return false;
    out.set(0, o.y + d.y * t, o.z + d.z * t);
    return true;
  }

  // ───────────────────────── 시점 ─────────────────────────

  private w(x: number, y: number, z: number): [number, number, number] {
    return [ROOT_POS.x + x * MILL_SCALE, ROOT_POS.y + y * MILL_SCALE, ROOT_POS.z + z * MILL_SCALE];
  }

  view(key: ViewKey, aspect: number): CameraView {
    const k = aspect < 1 ? 1 + (1 - aspect) * 0.95 : 1;
    const tall = aspect < 1;
    let t: [number, number, number];
    let dir: [number, number, number];
    let dist: number;
    switch (key) {
      case 'wheel':
        t = [0, 1.2, 0.25]; dir = [-1, 0.3, 0.38]; dist = 7.6;
        break;
      case 'cam':
        t = [1.9, 0.8, 0.45]; dir = [1, 0.85, 0.3]; dist = 5.0;
        break;
      case 'pestle':
        t = [2.1, 0.35, 2.55]; dir = [1, 0.38, 0.42]; dist = 5.2;
        break;
      default:
        t = [1.5, 1.0, 0.2]; dir = [0.78, 0.52, 0.95]; dist = 11;
        break;
    }
    if (tall && key !== 'all') t = [t[0], t[1] + 0.2, t[2]];
    const n = Math.hypot(dir[0], dir[1], dir[2]);
    const d = dist * k;
    const pos = this.w(t[0] + (dir[0] / n) * d, t[1] + (dir[1] / n) * d, t[2] + (dir[2] / n) * d);
    return { pos, target: this.w(t[0], t[1], t[2]) };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.water.dispose();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
    this.grainMesh.dispose();
    this.root.removeFromParent();
  }
}
