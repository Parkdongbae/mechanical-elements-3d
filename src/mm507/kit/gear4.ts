// 기어 키트 추가 — 원판 나선 기어(설계표 029), 사각(4엽) 비원형 기어(설계표 030)
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { circlePts, lathe, loft, mesh, tubeProfile, TAU, type V2 } from '../../models/parts/geom';

// ── 원판 나선 기어 (029) ──

export interface ScrollDiscOpts {
  thickness?: number; // 판 두께(기본 0.06)
  ridgeH?: number; // 능선 높이(기본 0.716·pitch)
  ridgeBase?: number; // 능선 밑 너비(기본 0.50·pitch)
  ridgeTop?: number; // 능선 위 너비(기본 0.26·pitch)
  turns?: number; // 감긴 횟수(기본 1)
  start?: number; // 능선 시작 각 β0 (기본 π/2)
  bore?: number; // 축 구멍 반지름(기본 0.05)
  driver?: boolean; // bronze / brass
}

/** 나선 능선이 있는 원판. 로컬 Z = 회전축, 앞면 z = 0(판 z ∈ [−thickness, 0]), 능선은 z ∈ [0, ridgeH]. 원점 = 회전축 */
export function scrollDisc(R: number, rStart: number, pitch: number, opts: ScrollDiscOpts = {}): THREE.Group {
  const th = opts.thickness ?? 0.06;
  const ridgeH = opts.ridgeH ?? 0.716 * pitch;
  const base = opts.ridgeBase ?? 0.5 * pitch;
  const top = opts.ridgeTop ?? 0.26 * pitch;
  const turns = opts.turns ?? 1;
  const b0 = opts.start ?? Math.PI / 2;
  const bore = opts.bore ?? 0.05;
  const mat = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = new THREE.Group();

  // 판 + 앞뒤 허브 (회전체 Y → Z)
  const plate = lathe(tubeProfile(bore, R, -th, 0.002, 0.008), 72);
  plate.rotateX(Math.PI / 2);
  g.add(mesh(plate, mat));
  const hubF = lathe(tubeProfile(bore, bore + 0.05, 0, 0.03, 0.006), 32);
  hubF.rotateX(Math.PI / 2);
  g.add(mesh(hubF, darkSteel()));
  const hubB = lathe(tubeProfile(bore, bore + 0.05, -th - 0.03, -th, 0.006), 32);
  hubB.rotateX(Math.PI / 2);
  g.add(mesh(hubB, darkSteel()));

  // 능선: 단면 4점(a 안 밑, b 안 위, c 바깥 위, d 바깥 밑)을 나선 따라 이어 붙인다
  const n = Math.round(160 * turns);
  const sec: THREE.Vector3[][] = [];
  for (let i = 0; i <= n; i++) {
    const beta = b0 + (TAU * turns * i) / n;
    const r = rStart - (pitch * (beta - b0)) / TAU;
    const ux = Math.cos(beta);
    const uy = Math.sin(beta);
    const p = (rr: number, z: number): THREE.Vector3 => new THREE.Vector3(rr * ux, rr * uy, z);
    sec.push([p(r - base / 2, -0.002), p(r - top / 2, ridgeH), p(r + top / 2, ridgeH), p(r + base / 2, -0.002)]);
  }
  const pos: number[] = [];
  const quad = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): void => {
    for (const q of [p0, p1, p2, p0, p2, p3]) pos.push(q.x, q.y, q.z);
  };
  for (let i = 0; i < n; i++) {
    const s0 = sec[i]!;
    const s1 = sec[i + 1]!;
    quad(s0[0]!, s0[1]!, s1[1]!, s1[0]!);
    quad(s0[1]!, s0[2]!, s1[2]!, s1[1]!);
    quad(s0[2]!, s0[3]!, s1[3]!, s1[2]!);
  }
  const f = sec[0]!;
  const l = sec[n]!;
  quad(f[0]!, f[3]!, f[2]!, f[1]!);
  quad(l[0]!, l[1]!, l[2]!, l[3]!);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  g.add(mesh(geo, mat));
  return g;
}

// ── 사각(4엽) 비원형 기어 (030) ──

export interface SquareGearSpec {
  C: number;
  e: number;
  P: number;
  rMax: number;
  rMin: number;
  L: number; // 피치곡선 둘레
  teeth: number; // 잇수(8 의 배수)
  pitch: number; // L / teeth
  module: number; // pitch / π
  /** 호 길이 표(내부용): s[k] = φ = 2πk/N 까지의 누적 길이 */
  s: number[];
}

const E_DEFAULT = 3 - 2 * Math.SQRT2;
const NS = 4096;

const rOf = (P: number, e: number, phi: number): number => P / (1 - e * Math.cos(4 * phi));

/** e 기본 3 − 2√2 (rMax/rMin = √2, 최대/최소 속도비 2) */
export function squareGearSpec(C: number, teeth: number, e: number = E_DEFAULT): SquareGearSpec {
  const P = (C * (1 - e * e)) / 2;
  const s: number[] = [0];
  let px = rOf(P, e, 0);
  let py = 0;
  for (let k = 1; k <= NS; k++) {
    const phi = (TAU * k) / NS;
    const r = rOf(P, e, phi);
    const x = r * Math.cos(phi);
    const y = r * Math.sin(phi);
    s.push(s[k - 1]! + Math.hypot(x - px, y - py));
    px = x;
    py = y;
  }
  const L = s[NS]!;
  const pitch = L / teeth;
  return { C, e, P, rMax: P / (1 - e), rMin: P / (1 + e), L, teeth, pitch, module: pitch / Math.PI, s };
}

/** 호 길이 위치 → 극각 φ (표 선형 보간) */
function phiAt(spec: SquareGearSpec, ssIn: number): number {
  const ss = ((ssIn % spec.L) + spec.L) % spec.L;
  const s = spec.s;
  let lo = 0;
  let hi = NS;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid]! <= ss) lo = mid;
    else hi = mid;
  }
  const t = (ss - s[lo]!) / (s[lo + 1]! - s[lo]!);
  return (TAU * (lo + t)) / NS;
}

const TOOTH: [number, number][] = [
  [0, -1.25],
  [0.14, -1.25],
  [0.41, 1.0],
  [0.59, 1.0],
  [0.86, -1.25]
];

/** 기어 몸 좌표(원점 = 회전축)에서 외곽 점열(반시계). phase 0: 몸 +X 모서리에 이골 가운데, 0.5: 반 피치 어긋남 */
export function squareGearOutline(spec: SquareGearSpec, phase: 0 | 0.5): V2[] {
  const { P, e, pitch, module: m } = spec;
  const out: V2[] = [];
  for (let i = 0; i < spec.teeth; i++) {
    for (const [u, h] of TOOTH) {
      const phi = phiAt(spec, (i + phase + u) * pitch);
      const d = 1 - e * Math.cos(4 * phi);
      const r = P / d;
      const rp = (-4 * e * P * Math.sin(4 * phi)) / (d * d);
      const tx = rp * Math.cos(phi) - r * Math.sin(phi);
      const ty = rp * Math.sin(phi) + r * Math.cos(phi);
      const tl = Math.hypot(tx, ty);
      // 바깥 법선 = (t_y, −t_x)/|t|
      out.push([r * Math.cos(phi) + (ty / tl) * h * m, r * Math.sin(phi) - (tx / tl) * h * m]);
    }
  }
  return out;
}

/** 로컬 Z = 회전축, 몸통 z ∈ [−width/2, width/2] */
export function squareGear(spec: SquareGearSpec, phase: 0 | 0.5, opts: { width?: number; driver?: boolean } = {}): THREE.Group {
  const w = opts.width ?? 0.12;
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = new THREE.Group();
  const outline = squareGearOutline(spec, phase);
  const bodyGeo = loft(outline, [circlePts(0.06, 40)], [
    { z: -w / 2, s: 0.99, hs: 1.1 },
    { z: -w / 2 + 0.008, s: 1, hs: 1 },
    { z: w / 2 - 0.008, s: 1, hs: 1 },
    { z: w / 2, s: 0.99, hs: 1.1 }
  ]);
  g.add(mesh(bodyGeo, body));
  // 안쪽 둥근 네모 테두리 — 피치곡선 모양
  const pc: V2[] = [];
  for (let k = 0; k < 160; k++) {
    const phi = (TAU * k) / 160;
    const r = rOf(spec.P, spec.e, phi);
    pc.push([r * Math.cos(phi), r * Math.sin(phi)]);
  }
  const sc = (k: number): V2[] => pc.map(([x, y]) => [x * k, y * k]);
  g.add(
    mesh(
      loft(sc(0.8), [sc(0.74)], [
        { z: w / 2 - 0.002, s: 1, hs: 1 },
        { z: w / 2 + 0.012, s: 1, hs: 1 }
      ]),
      body
    )
  );
  const hub = lathe(tubeProfile(0.06, 0.12, -w / 2 - 0.02, w / 2 + 0.025, 0.008), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  const mark = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.008), paint(0xd8362f));
  mark.position.set(0.3, 0, w / 2 + 0.004);
  g.add(mark);
  return g;
}

/** 기어 1 이 θ 돌 때 기어 2 가 피치곡선 위에서 더 구른 각 F(θ) */
export function squareGearAngle(theta: number, e: number = E_DEFAULT): number {
  const k = (1 + e) / (1 - e);
  const w = 2 * theta;
  const a = Math.atan2(k * Math.sin(w), Math.cos(w));
  const n = Math.round((w - a) / TAU);
  return 0.5 * (a + TAU * n);
}
