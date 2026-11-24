// 물레방아의 물 — 물홈 속 흐름, 떨어지는 물줄기, 칸 속 물(윗면은 항상 수평), 쏟아지는 물방울, 구덩이 물.
// 좌표는 실제 m(MillModel.root 의 로컬). 물 메시는 그림자를 만들지 않는다.

import * as THREE from 'three';
import { glass } from '../../models/materials';
import { MILL, type MillState } from './types';
import {
  DEG, SLOPE, CHUTE_END_Y, CHUTE_END_Z, CHUTE_START_Z, CHUTE_W, GATE_Z, PIT, BLADE_LAG
} from './parts';

const NB = MILL.blades;
const PITCH = (Math.PI * 2) / NB;
const R_IN = MILL.wheelR - MILL.bladeLen;
const WATER_COLOR = 0x2f86e6;
const MAX_DROPS = 400;
const CELL_TRIS = 20;
const SURFACE_Y = PIT.waterTop;

function waterMat(op = 0.62): THREE.MeshPhysicalMaterial {
  const m = glass(WATER_COLOR, op);
  m.roughness = 0.08;
  return m;
}
function foamMat(): THREE.MeshPhysicalMaterial {
  const m = glass(0xe4f3ff, 0.5);
  m.roughness = 0.2;
  return m;
}
function flag(m: THREE.Mesh): THREE.Mesh {
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.noAO = true;
  return m;
}

interface Drop { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; r: number }

export class MillWater {
  readonly root = new THREE.Group();

  // 물홈
  private chuteG = new THREE.Group();
  private upstream: THREE.Mesh;
  private flowBox: THREE.Mesh;
  private stripes: THREE.Mesh[] = [];
  private stripeZ: number[] = [];
  // 물줄기
  private stream: THREE.Mesh;
  private streamGeo: THREE.BoxGeometry;
  private streamBase: Float32Array;
  // 칸 속 물
  private cells: THREE.Mesh;
  private cellPos: Float32Array;
  private cellGeo: THREE.BufferGeometry;
  // 구덩이·물길
  private pit: THREE.Mesh;
  private chan: THREE.Mesh;
  private pitStripes: THREE.Mesh[] = [];
  private pitStripeZ: number[] = [];
  // 물방울
  private drops: Drop[] = [];
  private dropMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private spillAcc = 0;
  private splashAcc = 0;

  constructor() {
    const base = waterMat(0.62);
    const surf = waterMat(0.66);
    const foam = foamMat();

    // ── 물홈 속(물홈 그룹과 같은 기울기) ──
    this.chuteG.position.set(0, CHUTE_END_Y, CHUTE_END_Z);
    this.chuteG.rotation.x = SLOPE;
    this.root.add(this.chuteG);
    const cw = CHUTE_W - 0.02;
    const gateLocal = (GATE_Z - CHUTE_END_Z) / Math.cos(SLOPE);
    const startLocal = (CHUTE_START_Z - CHUTE_END_Z) / Math.cos(SLOPE);
    const upLen = gateLocal - 0.04 - startLocal;
    this.upstream = flag(new THREE.Mesh(new THREE.BoxGeometry(cw, 1, upLen), base));
    this.upstream.scale.y = 0.2;
    this.upstream.position.set(0, 0.1, startLocal + upLen / 2);
    this.chuteG.add(this.upstream);
    const dLen = -(gateLocal + 0.04);
    this.flowBox = flag(new THREE.Mesh(new THREE.BoxGeometry(cw, 1, dLen), surf));
    this.flowBox.position.z = gateLocal + 0.04 + dLen / 2;
    this.chuteG.add(this.flowBox);
    for (let i = 0; i < 9; i++) {
      const s = flag(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.12), foam));
      this.stripes.push(s);
      this.stripeZ.push(gateLocal + 0.04 + (dLen * i) / 9);
      this.chuteG.add(s);
    }

    // ── 떨어지는 물줄기(여덟 마디로 휘어진 판) ──
    this.streamGeo = new THREE.BoxGeometry(0.56, 1, 1, 1, 8, 1);
    this.streamBase = (this.streamGeo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;
    this.stream = flag(new THREE.Mesh(this.streamGeo, surf));
    this.stream.frustumCulled = false;
    this.stream.visible = false;
    this.root.add(this.stream);

    // ── 칸 속 물(매 프레임 다시 만드는 프리즘) ──
    this.cellGeo = new THREE.BufferGeometry();
    this.cellPos = new Float32Array(NB * CELL_TRIS * 9);
    this.cellGeo.setAttribute('position', new THREE.BufferAttribute(this.cellPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.cellGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.cellPos.length), 3).setUsage(THREE.DynamicDrawUsage));
    this.cells = flag(new THREE.Mesh(this.cellGeo, waterMat(0.72)));
    this.cells.frustumCulled = false;
    this.root.add(this.cells);

    // ── 구덩이 물·물길 ──
    const depth = SURFACE_Y - PIT.floorY;
    this.pit = flag(new THREE.Mesh(new THREE.BoxGeometry(2 * PIT.x - 0.01, depth, PIT.z1 - PIT.z0 - 0.01), base));
    this.pit.position.set(0, PIT.floorY + depth / 2, (PIT.z0 + PIT.z1) / 2);
    this.root.add(this.pit);
    const chLen = 3.9 - PIT.z1;
    this.chan = flag(new THREE.Mesh(new THREE.BoxGeometry(0.9 - 0.01, depth, chLen + 0.15), base));
    this.chan.position.set(0, PIT.floorY + depth / 2, PIT.z1 + chLen / 2 - 0.075);
    this.root.add(this.chan);
    for (let i = 0; i < 16; i++) {
      const wide = i % 2 === 0;
      const s = flag(new THREE.Mesh(new THREE.BoxGeometry(wide ? 0.45 : 0.25, 0.004, 0.035), foam));
      s.position.x = (((i * 0.6180339) % 1) - 0.5) * 1.3;
      s.position.y = SURFACE_Y + 0.003;
      this.pitStripes.push(s);
      this.pitStripeZ.push(PIT.z0 + 0.1 + ((3.8 - PIT.z0 - 0.2) * i) / 16);
      this.root.add(s);
    }

    // ── 물방울 ──
    const dg = new THREE.SphereGeometry(0.035, 10, 8);
    this.dropMesh = flag(new THREE.InstancedMesh(dg, waterMat(0.8), MAX_DROPS)) as THREE.InstancedMesh;
    this.dropMesh.frustumCulled = false;
    this.dropMesh.count = 0;
    this.root.add(this.dropMesh);
  }

  /** 지금 물홈 끝에서 떨어지는 쪽 y(물 윗면) */
  update(s: MillState, dt: number): void {
    const f = s.flow / MILL.qMax;
    const on = s.flow > 1e-4;

    // 물홈 속 흐름: 깊이 ∝ 유량
    const depth = on ? 0.02 + 0.16 * Math.min(1, f) : 0;
    this.flowBox.visible = on;
    if (on) {
      this.flowBox.scale.y = depth;
      this.flowBox.position.y = depth / 2;
    }
    const gateLocal = (GATE_Z - CHUTE_END_Z) / Math.cos(SLOPE);
    const z0 = gateLocal + 0.04;
    const span = -z0;
    for (let i = 0; i < this.stripes.length; i++) {
      const st = this.stripes[i]!;
      st.visible = on;
      if (!on) continue;
      let z = (this.stripeZ[i] ?? z0) + 1.2 * dt;
      if (z > -0.07) z -= span - 0.14;
      this.stripeZ[i] = z;
      st.position.set(0, depth + 0.003, z);
    }
    // 수문 뒤 물은 늘 조금 고여 있다
    this.upstream.visible = true;

    this.updateStream(s, dt, on, f, depth);
    this.updateCells(s);
    this.updatePit(s, dt);
    this.updateDrops(s, dt, on);
  }

  private updateStream(s: MillState, dt: number, on: boolean, f: number, depth: number): void {
    void dt;
    this.stream.visible = on;
    if (!on) return;
    const p = this.streamGeo.attributes.position as THREE.BufferAttribute;
    const thick = 0.015 + 0.06 * Math.min(1, f);
    const y0 = CHUTE_END_Y + depth - 0.01;
    const y1 = MILL.axisY + MILL.wheelR - 0.12; // 날개 칸 안쪽
    const v0 = 0.7 + 1.1 * f;                   // 물홈 끝에서 나가는 빠르기(그림용)
    const g = 9.81;
    const tEnd = Math.sqrt((2 * (y0 - y1)) / g);
    for (let i = 0; i < p.count; i++) {
      const bx = this.streamBase[i * 3]!;
      const by = this.streamBase[i * 3 + 1]!;
      const bz = this.streamBase[i * 3 + 2]!;
      const u = 1 - (by + 0.5); // 0 = 물홈 끝, 1 = 칸
      const t = tEnd * u;
      const y = y0 - 0.5 * g * t * t;
      const z = CHUTE_END_Z + 0.02 + v0 * t;
      p.setXYZ(i, bx, y, z + bz * thick * (1 - 0.35 * u));
    }
    p.needsUpdate = true;
    this.streamGeo.computeVertexNormals();
    void s;
  }

  // ── 칸 속 물 ──
  private weight(phiDeg: number): number {
    const a = MILL.phiIn;
    const b = MILL.phiOut;
    if (phiDeg <= a || phiDeg >= b) return 0;
    const up = Math.min(1, (phiDeg - a) / 15);
    const down = Math.min(1, (b - phiDeg) / 30);
    return Math.min(up, down);
  }

  private updateCells(s: MillState): void {
    const pos = this.cellPos;
    pos.fill(0);
    const vTot = Math.max(0, s.waterMass) / 1000;
    if (vTot < 1e-5) {
      this.cellGeo.attributes.position!.needsUpdate = true;
      this.cells.visible = false;
      return;
    }
    // 칸마다 무게(위치별 비율) → 부피
    const w: number[] = [];
    let sum = 0;
    for (let k = 0; k < NB; k++) {
      const alpha = k * PITCH + s.theta + PITCH / 2;
      const deg = ((((alpha / DEG) % 360) + 360) % 360);
      const wk = this.weight(deg);
      w.push(wk);
      sum += wk;
    }
    this.cells.visible = sum > 0;
    if (sum <= 0) {
      this.cellGeo.attributes.position!.needsUpdate = true;
      return;
    }
    const XL = -0.44;
    const XR = 0.44;
    let o = 0;
    const pw: number[] = [];
    for (let k = 0; k < NB; k++) {
      const wk = w[k]!;
      if (wk <= 0) continue;
      const vol = (vTot * wk) / sum;
      const fill = Math.min(1, vol / MILL.bucketCap);
      if (fill < 1e-3) continue;
      // 칸 사각형(실제 z, y): 안쪽 k → 안쪽 k+1 → 바깥 k+1 → 바깥 k
      const a0 = k * PITCH + s.theta;
      const a1 = a0 + PITCH;
      const P: [number, number][] = [
        pt(R_IN, a0), pt(R_IN, a1), pt(MILL.wheelR, a1 - BLADE_LAG), pt(MILL.wheelR, a0 - BLADE_LAG)
      ];
      const area = polyArea(P);
      const spill = Math.min(P[2]![1], P[3]![1]); // 칸 입구의 낮은 쪽 — 이보다 높게는 못 담는다
      let lo = Math.min(P[0]![1], P[1]![1], P[2]![1], P[3]![1]);
      let hi = Math.max(P[0]![1], P[1]![1], P[2]![1], P[3]![1]);
      const target = fill * area;
      for (let it = 0; it < 16; it++) {
        const mid = (lo + hi) / 2;
        if (areaBelow(P, mid) < target) lo = mid;
        else hi = mid;
      }
      const level = Math.min((lo + hi) / 2, spill);
      const poly = clipBelow(P, level);
      if (poly.length < 3) continue;
      const area2 = polyArea(poly);
      if (area2 < 1e-5) continue;
      o = writePrism(pos, o, poly, XL, XR);
      void pw;
      if (o >= pos.length) break;
    }
    const pa = this.cellGeo.attributes.position as THREE.BufferAttribute;
    pa.needsUpdate = true;
    this.cellGeo.computeVertexNormals();
  }

  private updatePit(s: MillState, dt: number): void {
    const v = 0.1 + 0.9 * Math.min(1, s.flow / MILL.qMax);
    for (let i = 0; i < this.pitStripes.length; i++) {
      let z = (this.pitStripeZ[i] ?? 0) + v * dt;
      if (z > 3.8) z -= 3.8 - PIT.z0 - 0.2;
      this.pitStripeZ[i] = z;
      const st = this.pitStripes[i]!;
      st.position.z = z;
      // 물길(앞쪽)에서는 폭이 좁다 — 그 구간에서는 가운데 쪽으로 모은다
      if (z > PIT.z1) st.position.x = Math.max(-0.2, Math.min(0.2, st.position.x));
    }
  }

  // ── 물방울: 칸에서 쏟아지는 물 + 물줄기가 바퀴에 부딪혀 튀는 물 ──
  private updateDrops(s: MillState, dt: number, on: boolean): void {
    // 쏟아지는 양 = 칸에서 빠지는 물의 부피율 M·ω/Δφ ÷ ρ  (입자 1100개 = 1 m³)
    const dphi = (MILL.phiOut - MILL.phiIn) * DEG;
    const outRate = (s.waterMass * s.omega) / dphi / 1000; // m³/s
    this.spillAcc += outRate * 1100 * dt;
    while (this.spillAcc >= 1 && this.drops.length < MAX_DROPS) {
      this.spillAcc -= 1;
      const phi = (MILL.phiOut - 30 + Math.random() * 30) * DEG;
      const ang = phi;
      const r = 1.3 + Math.random() * 0.3;
      const wv = s.omega * r * 0.6;
      this.drops.push({
        x: (Math.random() - 0.5) * 0.8,
        y: MILL.axisY + r * Math.cos(ang),
        z: r * Math.sin(ang),
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.sin(ang) * wv - Math.random() * 0.3,
        vz: Math.cos(ang) * wv * 0.5 + (Math.random() - 0.5) * 0.3,
        life: 1.2,
        r: 0.7 + Math.random() * 0.6
      });
    }
    if (this.spillAcc > 4) this.spillAcc = 0;
    if (on) {
      this.splashAcc += 150 * (s.flow / MILL.qStd) * dt;
      while (this.splashAcc >= 1 && this.drops.length < MAX_DROPS) {
        this.splashAcc -= 1;
        this.drops.push({
          x: (Math.random() - 0.5) * 0.55,
          y: MILL.axisY + MILL.wheelR - 0.1,
          z: CHUTE_END_Z + 0.25 + Math.random() * 0.2,
          vx: (Math.random() - 0.5) * 0.5,
          vy: 0.5 + Math.random() * 0.9,
          vz: 0.2 + Math.random() * 0.9,
          life: 0.5,
          r: 0.5 + Math.random() * 0.5
        });
      }
      if (this.splashAcc > 4) this.splashAcc = 0;
    } else this.splashAcc = 0;

    // 적분 + 정리
    let n = 0;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i]!;
      d.vy -= 9.81 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.life -= dt;
      if (d.y <= SURFACE_Y || d.life <= 0) continue;
      this.drops[n++] = d;
    }
    this.drops.length = n;
    for (let i = 0; i < n; i++) {
      const d = this.drops[i]!;
      this.dummy.position.set(d.x, d.y, d.z);
      this.dummy.scale.setScalar(d.r);
      this.dummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.dropMesh.count = n;
    this.dropMesh.instanceMatrix.needsUpdate = true;
  }

  /** 지금 살아 있는 물방울 수(검사용) */
  get dropCount(): number {
    return this.drops.length;
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
    this.dropMesh.dispose();
    this.root.removeFromParent();
  }
}

// ───────────────────────── 기하 도우미 ─────────────────────────

function pt(r: number, a: number): [number, number] {
  return [r * Math.sin(a), MILL.axisY + r * Math.cos(a)]; // [z, y]
}

function polyArea(p: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i]!;
    const [x1, y1] = p[(i + 1) % p.length]!;
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

/** y ≤ level 인 부분만 남긴 볼록 다각형(Sutherland–Hodgman) */
function clipBelow(p: [number, number][], level: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const ina = a[1] <= level;
    const inb = b[1] <= level;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (level - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, level]);
    }
  }
  return out;
}

function areaBelow(p: [number, number][], level: number): number {
  const c = clipBelow(p, level);
  return c.length < 3 ? 0 : polyArea(c);
}

/** 단면(z,y) 다각형을 x 방향 [xl, xr] 로 압출한 삼각형들을 배열에 쓴다. 쓴 뒤의 오프셋을 돌려준다 */
function writePrism(a: Float32Array, o: number, poly: [number, number][], xl: number, xr: number): number {
  const n = Math.min(poly.length, 6);
  const tri = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void => {
    if (o + 9 > a.length) return;
    a[o++] = x0; a[o++] = y0; a[o++] = z0;
    a[o++] = x1; a[o++] = y1; a[o++] = z1;
    a[o++] = x2; a[o++] = y2; a[o++] = z2;
  };
  for (let i = 0; i < n; i++) {
    const [za, ya] = poly[i]!;
    const [zb, yb] = poly[(i + 1) % n]!;
    tri(xl, ya, za, xr, ya, za, xr, yb, zb);
    tri(xl, ya, za, xr, yb, zb, xl, yb, zb);
  }
  for (let i = 1; i < n - 1; i++) {
    const [z0, y0] = poly[0]!;
    const [z1, y1] = poly[i]!;
    const [z2, y2] = poly[i + 1]!;
    tri(xl, y0, z0, xl, y1, z1, xl, y2, z2);
    tri(xr, y0, z0, xr, y2, z2, xr, y1, z1);
  }
  return o;
}
