// 맛보기 유동 모델 + 유선/입자 시각화.
// 진짜 CFD(나비에–스토크스 방정식 풀이)가 아니라, 차체 거리 함수 주위로 흐름을 "미끄러지게" 꺾는 퍼텐셜 유동 근사에
// 부품별 난류 볼륨(무작위 소용돌이 속도)과 차 뒤 후류(느려지고 휘도는 영역)를 더한 것이다.

import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { XF, XR, WHEEL_X, WHEEL_R, WHEEL_Z, type BodyShape } from './carModel';
import { aero, CD_BODY, type Config } from './aero';

export interface Disturb {
  /** 시작점(부품 위치) */
  x: number;
  y: number;
  z: number;
  /** 하류 쪽 길이, 반지름, 세기(0~1), 감속 */
  len: number;
  r: number;
  amp: number;
  slow: number;
  /** 반지름이 z 방향으로 늘어난 판 모양일 때 반폭 */
  hz?: number;
  /** 하부처럼 상자 모양 영역 */
  box?: { x0: number; x1: number; y1: number; hz: number };
  /** 디퓨저처럼 빨라지는 영역 */
  speedUp?: number;
}

const tmp = new Float32Array(5);
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class FlowField {
  shape: BodyShape;
  disturb: Disturb[] = [];
  wakeLen = 2;
  wakeAmp = 0.6;
  wakeH = 0.9;
  wing: { x0: number; x1: number; y0: number; y1: number; hz: number } | null = null;

  constructor(shape: BodyShape) {
    this.shape = shape;
  }

  /** 설정에 맞춰 후류 크기와 부품별 교란을 정한다 */
  configure(shape: BodyShape, cfg: Config, wing: FlowField['wing']): void {
    this.shape = shape;
    this.wing = wing;
    const a = aero(cfg);
    // 후류: Cd가 클수록 길고 세다
    this.wakeLen = 1.3 + 20 * (a.cd - CD_BODY);
    this.wakeAmp = Math.min(1.2, 0.45 + 5 * (a.cd - CD_BODY));
    this.wakeH = shape.yT(XR - 0.1) + 0.05;
    const dy = shape.dy;
    const d: Disturb[] = [];
    const side = (z: number): number[] => [z, -z];
    // 사이드미러
    const mir = [
      { r: 0.17, len: 1.6, amp: 1.0 },
      { r: 0.11, len: 1.0, amp: 0.55 },
      { r: 0.06, len: 0.45, amp: 0.25 }
    ][cfg.mirror]!;
    for (const z of side(0.86)) d.push({ x: -0.55, y: shape.yS(-0.55) + 0.08, z, len: mir.len, r: mir.r, amp: mir.amp, slow: 0.45 * mir.amp });
    // A필러 소용돌이 — 옆 유리를 따라 뒤로
    const pil = cfg.pillar === 0 ? { amp: 0.85, r: 0.15, len: 1.5 } : { amp: 0.2, r: 0.09, len: 0.7 };
    for (const z of side(0.6)) d.push({ x: -0.42, y: 0.98 + dy, z, len: pil.len, r: pil.r, amp: pil.amp, slow: 0.2 * pil.amp });
    // 돌출 손잡이
    if (cfg.handle === 0) for (const x of [-0.12, 0.66]) for (const z of side(0.74)) d.push({ x, y: shape.yS(x) - 0.075, z, len: 0.5, r: 0.07, amp: 0.55, slow: 0.25 });
    // 도어 틈새
    if (cfg.gap === 0) for (const x of [-0.6, 0.31, 1.0]) for (const z of side(0.72)) d.push({ x, y: 0.45 + dy, z, len: 0.35, r: 0.06, amp: 0.4, slow: 0.2, hz: 0 });
    // 휠
    const wh = cfg.wheel === 0 ? { amp: 0.75, len: 0.9 } : { amp: 0.3, len: 0.5 };
    for (const x of WHEEL_X) for (const z of side(WHEEL_Z)) d.push({ x: x + 0.1, y: WHEEL_R * 0.8, z, len: wh.len, r: 0.22, amp: wh.amp, slow: 0.35 * wh.amp });
    // 하부
    const c = shape.clearance;
    if (cfg.under === 0) d.push({ x: -1.5, y: c * 0.5, z: 0, len: 4, r: 0, amp: 0.95, slow: 0.45, box: { x0: -1.5, x1: 2.6, y1: c + 0.01, hz: 0.55 } });
    else if (cfg.under === 1) d.push({ x: -1.5, y: c * 0.5, z: 0, len: 4, r: 0, amp: 0.12, slow: 0.05, box: { x0: -1.5, x1: 2.2, y1: c + 0.01, hz: 0.55 } });
    else d.push({ x: -1.5, y: c * 0.5, z: 0, len: 4, r: 0, amp: 0.08, slow: 0, speedUp: 0.35, box: { x0: -1.2, x1: 1.9, y1: c + 0.06, hz: 0.55 } });
    // 스포일러
    if (wing) d.push({ x: wing.x1, y: (wing.y0 + wing.y1) / 2, z: 0, len: 1.4, r: 0.16, amp: 0.7, slow: 0.35, hz: wing.hz });
    else if (cfg.spoiler === 1) d.push({ x: XR, y: shape.yT(XR - 0.05) + 0.04, z: 0, len: 0.6, r: 0.08, amp: 0.25, slow: 0.1, hz: 0.5 });
    this.disturb = d;
  }

  /** 부호 있는 거리(차체 밖 +) — 둥근 상자형 근사 */
  sdf(x: number, y: number, z: number): number {
    const sh = this.shape;
    sh.sample(x, tmp);
    const w = tmp[0]!;
    const yb = tmp[1]!;
    const ys = tmp[3]!;
    const yt = tmp[4]!;
    const wr = w - (sh.angular ? 0.13 : 0.17);
    let we = w;
    if (y > ys && yt - ys > 0.01) we = w - 0.04 + (wr - (w - 0.04)) * Math.min(1, (y - ys) / (yt - ys));
    else if (y < yb + 0.08) we = w - 0.06 * (1 - (y - yb) / 0.08);
    const dz = Math.abs(z) - we;
    const dyy = Math.max(yb - y, y - yt);
    const dx = Math.max(XF - x, x - XR);
    const qx = Math.max(dx, 0);
    const qy = Math.max(dyy, 0);
    const qz = Math.max(dz, 0);
    let d = Math.sqrt(qx * qx + qy * qy + qz * qz) + Math.min(Math.max(dx, dyy, dz), 0);
    const wg = this.wing;
    if (wg) {
      const ex = Math.max(wg.x0 - x, x - wg.x1, 0);
      const ey = Math.max(wg.y0 - y, y - wg.y1, 0);
      const ez = Math.max(Math.abs(z) - wg.hz, 0);
      const inside = Math.min(Math.max(wg.x0 - x, x - wg.x1, wg.y0 - y, y - wg.y1, Math.abs(z) - wg.hz), 0);
      d = Math.min(d, Math.sqrt(ex * ex + ey * ey + ez * ez) + inside);
    }
    return d;
  }

  /**
   * 속도(자유류 = 1). out = [vx, vy, vz, 난류세기]
   */
  velocity(x: number, y: number, z: number, t: number, out: Float32Array): void {
    const e = 0.03;
    const d = this.sdf(x, y, z);
    let vx = 1;
    let vy = 0;
    let vz = 0;
    let turb = 0;
    if (d < 0.9) {
      let nx = this.sdf(x + e, y, z) - this.sdf(x - e, y, z);
      let ny = this.sdf(x, y + e, z) - this.sdf(x, y - e, z);
      let nz = this.sdf(x, y, z + e) - this.sdf(x, y, z - e);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const a = Math.exp(-Math.max(d, 0) / 0.2);
      // 정면·윗면·옆면: 표면 법선 성분을 지워 흐름을 표면과 나란히 꺾는다. 뒷면은 흐름이 떨어져 나가 덜 따라간다.
      const un = nx;
      const follow = un > 0.15 ? 0.35 : 1;
      vx -= nx * un * a * follow;
      vy -= ny * un * a * follow;
      vz -= nz * un * a * follow;
      // 정면을 향해 오는 흐름은 표면 바깥쪽으로 비켜 간다
      if (un < 0) {
        const push = a * -un * 0.35;
        vy += Math.max(0, ny) * push + 0.12 * a * -un * (y > 0.5 ? 1 : -0.3);
        vz += nz * push;
      }
      // 속도 크기: 정체점 근처 느림, 지붕·옆면은 빨라짐 (Cp ≈ 1 − s²)
      const tang = 1 - un * un;
      const top = smooth(0.3, 0.8, ny);
      const k = 1.15 + 0.75 * top;
      const cp = un > 0.15 ? -0.2 : 1 - k * tang;
      const s = Math.sqrt(Math.max(0.03, 1 - cp));
      const ss = 1 + (s - 1) * a;
      const vl = Math.hypot(vx, vy, vz);
      if (vl < 1e-3) {
        vx = 0;
        vy = 0.05;
        vz = 0;
      } else {
        vx = (vx / vl) * ss;
        vy = (vy / vl) * ss;
        vz = (vz / vl) * ss;
      }
      if (d < 0) {
        // 차체 안으로 들어간 입자는 밖으로 밀어낸다
        vx += nx * -d * 10;
        vy += ny * -d * 10;
        vz += nz * -d * 10;
      }
    }
    // 차 뒤 후류
    const wx = x - (XR - 0.15);
    if (wx > 0 && wx < this.wakeLen) {
      const tw = wx / this.wakeLen;
      const hz = 0.62 + 0.25 * tw;
      const hy = this.wakeH * (1 - 0.35 * tw);
      const fz = 1 - smooth(hz * 0.7, hz * 1.15, Math.abs(z));
      const fy = 1 - smooth(hy * 0.75, hy * 1.15, y);
      const f = fz * fy * (1 - tw) * (1 - tw * 0.3);
      if (f > 0) {
        const amp = this.wakeAmp * f;
        vx *= 1 - 0.8 * f;
        // 위에서 내려오는 흐름(다운워시) + 휘도는 소용돌이
        vy += -0.18 * f + amp * 0.8 * (Math.sin(3.1 * y + 2.6 * t + 1.7 * x) + Math.sin(2.3 * z - 2.1 * t + 0.6 * x)) * 0.5;
        vz += amp * 0.8 * (Math.sin(2.7 * z + 2.9 * t - 1.3 * x) + Math.cos(3.7 * y - 1.7 * t)) * 0.5;
        vx += amp * 0.4 * Math.cos(2.9 * x - 3.3 * t + 1.1 * y);
        turb = Math.max(turb, amp);
      }
      // 후류 바로 위: 지붕을 넘은 흐름이 빈자리로 끌려 내려온다
      const above = Math.max(0, 1 - Math.abs(y - hy * 1.25) / 0.6) * fz * (1 - tw);
      vy -= 0.22 * above * (0.6 + this.wakeAmp * 0.5);
    }
    // 부품별 난류 볼륨
    for (const q of this.disturb) {
      let f = 0;
      if (q.box) {
        const b = q.box;
        if (x > b.x0 && x < b.x1 + 0.8 && y < b.y1 + 0.05 && Math.abs(z) < b.hz + 0.1) {
          f = (1 - smooth(b.y1 - 0.02, b.y1 + 0.05, y)) * (1 - smooth(b.hz - 0.05, b.hz + 0.1, Math.abs(z))) * (1 - smooth(b.x1, b.x1 + 0.8, x));
        }
      } else {
        const lx = x - q.x;
        if (lx > -q.r && lx < q.len) {
          const tl = Math.max(0, lx) / q.len;
          const rr = q.r * (1 + 1.2 * tl);
          const dzz = q.hz !== undefined ? Math.max(0, Math.abs(z) - q.hz) : Math.abs(z - q.z);
          const dist = Math.hypot(y - q.y, dzz);
          if (dist < rr) f = (1 - dist / rr) * (1 - tl);
        }
      }
      if (f <= 0) continue;
      if (q.speedUp) {
        vx *= 1 + q.speedUp * f;
        continue;
      }
      const amp = q.amp * f;
      vx *= 1 - q.slow * f;
      const fr = 9;
      vy += amp * 0.9 * Math.sin(fr * z + 7.1 * t + 3.3 * x);
      vz += amp * 0.9 * Math.cos(fr * y - 6.3 * t + 2.7 * x);
      vx += amp * 0.3 * Math.sin(fr * 0.7 * y + 5.1 * t);
      turb = Math.max(turb, amp);
    }
    // 바닥: 땅 아래로 내려가지 않게
    if (y < 0.03 && vy < 0) vy = 0;
    out[0] = vx;
    out[1] = vy;
    out[2] = vz;
    out[3] = turb;
  }
}

// ───────────────────────── 색 ─────────────────────────

const STOPS: [number, THREE.Color][] = [
  [0.15, new THREE.Color(0x2a4fe0)],
  [0.6, new THREE.Color(0x1fb3e0)],
  [0.95, new THREE.Color(0x2cc46b)],
  [1.12, new THREE.Color(0xf2c522)],
  [1.35, new THREE.Color(0xef4b3a)]
];

/** 속도비 → 색(느림 파랑 → 빠름 빨강) */
export function speedColor(s: number, out: THREE.Color): THREE.Color {
  if (s <= STOPS[0]![0]) return out.copy(STOPS[0]![1]);
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i]!;
    const [a, ca] = STOPS[i - 1]!;
    if (s <= b) return out.copy(ca).lerp(cb, (s - a) / (b - a));
  }
  return out.copy(STOPS[STOPS.length - 1]![1]);
}

// ───────────────────────── 시각화 ─────────────────────────

const SEEDS: [number, number, number?][] = [];
{
  // 가운데 면: 바닥 밑 ~ 지붕 위
  for (const y of [0.07, 0.27, 0.45, 0.62, 0.8, 0.97, 1.16, 1.38]) SEEDS.push([y, 0]);
  // 지붕·보닛 가장자리
  for (const z of [0.42, -0.42]) for (const y of [0.78, 1.02]) SEEDS.push([y, z]);
  // 옆면(문·미러 높이)
  // 앞 범퍼를 만나 옆으로 비켜 가며 옆면을 따라 흐르는 선
  for (const z of [0.5, -0.5]) for (const y of [0.32, 0.52]) SEEDS.push([y, z]);
  for (const z of [0.86, -0.86]) SEEDS.push([0.92, z]);
  for (const z of [1.15, -1.15]) for (const y of [0.55]) SEEDS.push([y, z]);
  // 후류 시드: 차 바로 뒤에서 출발 — 후류의 크기·소용돌이가 부품 설정에 따라 달라지는 것이 보이게
  for (const z of [-0.45, 0, 0.45]) for (const y of [0.22, 0.48, 0.74]) SEEDS.push([y, z, 1.9]);
}
const STEPS = 300;
const DS = 0.036;
const X_START = -4.6;
const X_END = 6.6;
const PARTICLES = 2200;

export class FlowViz {
  readonly group = new THREE.Group();
  private field: FlowField;
  private lineGeo: LineSegmentsGeometry;
  private lineMat: LineMaterial;
  private lines: LineSegments2;
  private linePos: Float32Array;
  private lineCol: Float32Array;
  private ghostGeo: THREE.BufferGeometry;
  private ghostMat: THREE.LineBasicMaterial;
  readonly ghost: THREE.LineSegments;
  private pts: THREE.Points;
  private pPos: Float32Array;
  private pCol: Float32Array;
  private pAge: Float32Array;
  private pTex: THREE.CanvasTexture;
  private rolling = 0;
  private vel = new Float32Array(4);
  private col = new THREE.Color();
  speed = 0; // km/h
  private time = 0;

  constructor(field: FlowField) {
    this.field = field;
    this.group.name = 'wind-flow';
    const nSeg = SEEDS.length * STEPS;
    this.linePos = new Float32Array(nSeg * 6);
    this.lineCol = new Float32Array(nSeg * 6);
    this.lineGeo = new LineSegmentsGeometry();
    this.lineGeo.setPositions(this.linePos);
    this.lineGeo.setColors(this.lineCol);
    this.lineMat = new LineMaterial({ linewidth: 2.2, vertexColors: true, transparent: true, opacity: 0.9, worldUnits: false });
    this.lineMat.resolution.set(window.innerWidth, window.innerHeight);
    this.lines = new LineSegments2(this.lineGeo, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.userData.noAO = true;
    this.lines.renderOrder = 2;
    this.group.add(this.lines);

    // 저장한 A의 유선(옅은 회색)
    this.ghostGeo = new THREE.BufferGeometry();
    this.ghostGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSeg * 6), 3));
    this.ghostMat = new THREE.LineBasicMaterial({ color: 0x8a96a8, transparent: true, opacity: 0.55, depthWrite: false });
    this.ghost = new THREE.LineSegments(this.ghostGeo, this.ghostMat);
    this.ghost.frustumCulled = false;
    this.ghost.visible = false;
    this.group.add(this.ghost);

    // 입자
    this.pPos = new Float32Array(PARTICLES * 3);
    this.pCol = new Float32Array(PARTICLES * 3);
    this.pAge = new Float32Array(PARTICLES);
    for (let i = 0; i < PARTICLES; i++) this.spawn(i, true);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.55, 'rgba(255,255,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    }
    this.pTex = new THREE.CanvasTexture(c);
    const pm = new THREE.PointsMaterial({ size: 0.075, map: this.pTex, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.05, sizeAttenuation: true });
    this.pts = new THREE.Points(pg, pm);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = 3;
    this.group.add(this.pts);
  }

  private spawn(i: number, anywhere: boolean): void {
    // 차 높이 근처에 입자를 더 많이
    // 70%는 차가 막는 단면(차 뒤 후류가 잘 보이게), 나머지는 넓게
    const near = Math.random() < 0.7;
    const y = near ? 0.03 + Math.random() * 1.15 : 0.03 + Math.random() * 1.9;
    const z = (Math.random() * 2 - 1) * (near ? 0.85 : 1.6);
    const x = anywhere ? X_START + Math.random() * (X_END - X_START) : X_START + Math.random() * 0.4;
    this.pPos.set([x, y, z], i * 3);
    this.pAge[i] = 0;
  }

  setResolution(w: number, h: number): void {
    this.lineMat.resolution.set(w, h);
  }

  /** 설정이 바뀌면 유선 전체를 다시 계산 */
  rebuild(): void {
    for (let k = 0; k < SEEDS.length; k++) this.traceLine(k);
    this.flush();
    // 차 안에 갇힌 입자 정리
    for (let i = 0; i < PARTICLES; i++) {
      const o = i * 3;
      if (this.field.sdf(this.pPos[o]!, this.pPos[o + 1]!, this.pPos[o + 2]!) < 0) this.spawn(i, false);
    }
  }

  private traceLine(k: number): void {
    const seed = SEEDS[k]!;
    let x = seed[2] ?? X_START;
    let y = seed[0];
    let z = seed[1];
    const v = this.vel;
    const t = this.time;
    let o = k * STEPS * 6;
    let px = x;
    let py = y;
    let pz = z;
    let pc = 1;
    for (let s = 0; s < STEPS; s++) {
      if (x < X_END) {
        // 중점법(RK2) — 차체 모서리에서 선이 덜 꺾이게
        this.field.velocity(x, y, z, t, v);
        let l = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
        const mx = x + (v[0]! / l) * DS * 0.5;
        const my = y + (v[1]! / l) * DS * 0.5;
        const mz = z + (v[2]! / l) * DS * 0.5;
        this.field.velocity(mx, my, mz, t, v);
        l = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
        x += (v[0]! / l) * DS;
        y = Math.max(0.025, y + (v[1]! / l) * DS);
        z += (v[2]! / l) * DS;
        const sp = Math.hypot(v[0]!, v[1]!, v[2]!) - v[3]! * 0.35;
        speedColor(sp, this.col);
        this.linePos.set([px, py, pz, x, y, z], o);
        this.lineCol.set([this.col.r, this.col.g, this.col.b, this.col.r, this.col.g, this.col.b], o);
        void pc;
        pc = sp;
        px = x;
        py = y;
        pz = z;
      } else {
        // 남는 구간은 길이 0 선분
        this.linePos.set([x, y, z, x, y, z], o);
      }
      o += 6;
    }
  }

  private flush(): void {
    const ps = this.lineGeo.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
    const cs = this.lineGeo.getAttribute('instanceColorStart') as THREE.InterleavedBufferAttribute;
    (ps.data.array as Float32Array).set(this.linePos);
    ps.data.needsUpdate = true;
    (cs.data.array as Float32Array).set(this.lineCol);
    cs.data.needsUpdate = true;
  }

  /** 지금 유선을 A로 저장(옅게 겹쳐 보기) */
  snapshotGhost(): void {
    const a = this.ghostGeo.getAttribute('position') as THREE.BufferAttribute;
    (a.array as Float32Array).set(this.linePos);
    a.needsUpdate = true;
  }

  get lineCount(): number {
    return SEEDS.length;
  }

  update(dt: number): void {
    this.time += dt;
    const on = this.speed > 0.5;
    this.lines.visible = on;
    this.pts.visible = on;
    if (!on) return;
    // 후류 안의 유선이 살아 움직이도록 몇 줄씩 돌아가며 다시 계산
    for (let n = 0; n < 3; n++) {
      this.traceLine(this.rolling);
      this.rolling = (this.rolling + 1) % SEEDS.length;
    }
    this.flush();
    // 입자 이동(화면 속도는 풍속에 비례하되 보기 좋게 줄임)
    const vis = 0.5 + 2.6 * (this.speed / 200);
    const v = this.vel;
    const f = this.field;
    const t = this.time;
    for (let i = 0; i < PARTICLES; i++) {
      const o = i * 3;
      let x = this.pPos[o]!;
      let y = this.pPos[o + 1]!;
      let z = this.pPos[o + 2]!;
      f.velocity(x, y, z, t, v);
      const tb = v[3]!;
      x += (v[0]! + (Math.random() - 0.5) * tb * 1.4) * vis * dt;
      y += (v[1]! + (Math.random() - 0.5) * tb * 1.4) * vis * dt;
      z += (v[2]! + (Math.random() - 0.5) * tb * 1.4) * vis * dt;
      y = Math.max(0.02, y);
      this.pAge[i] = this.pAge[i]! + dt;
      if (x > X_END || y > 2.6 || Math.abs(z) > 2.4 || this.pAge[i]! > 40) {
        this.spawn(i, false);
        continue;
      }
      this.pPos[o] = x;
      this.pPos[o + 1] = y;
      this.pPos[o + 2] = z;
      speedColor(Math.hypot(v[0]!, v[1]!, v[2]!) - tb * 0.4, this.col);
      this.pCol[o] = this.col.r;
      this.pCol[o + 1] = this.col.g;
      this.pCol[o + 2] = this.col.b;
    }
    const g = this.pts.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  dispose(): void {
    this.lineGeo.dispose();
    this.lineMat.dispose();
    this.ghostGeo.dispose();
    this.ghostMat.dispose();
    this.pts.geometry.dispose();
    (this.pts.material as THREE.Material).dispose();
    this.pTex.dispose();
  }
}
