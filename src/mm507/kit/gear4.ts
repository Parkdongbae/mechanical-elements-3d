// 기어 키트 추가 — 원판 나선 기어(설계표 029), 사각(4엽) 비원형 기어(설계표 030)
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { circlePts, lathe, loft, mesh, tubeProfile, TAU, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

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
  setMM(g, { kind: 'part', fn: 'scrollDisc', R, rStart, pitch, thickness: th, axis: 'z' }); // 검사 표식
  return g;
}

// ── 사각(곧은 변) 비원형 기어 (030) ──
//
// 같은 모양 두 기어가 중심 거리 C 에서 미끄럼 없이 구른다. 피치곡선 = 곧은 변 4개(중심에서 거리 a)
// + 모서리 곡선 4개. 모서리 곡선은 맞은편 기어의 곧은 변과 짝을 이루는 곡선이다:
//   변 위 점: r = a / cos ψ, 호 길이 a·tan ψ  →  짝 모서리: r = C − a / cos ψ (같은 호 길이)
//   모서리 극각 G(ψ) = ∫₀^ψ a / (C cos t − a) dt = (2α/√(1−α²))·artanh(tan(ψ/2)·√((1+α)/(1−α))), α = a/C
// 변 끝(ψ0)에서 r = C/2 이어야 두 식이 겹치지 않고 이어진다 → cos ψ0 = 2α, 변 반쪽 b = a·tan ψ0 = 모서리 반쪽 호 길이.
// 4겹 대칭이 닫히려면 모서리 끝에서 변 가운데까지 π/4: ψ0 + G(ψ0) = π/4  →  α = 0.4575552 (C 와 무관한 상수).

export interface SquareGearSpec {
  C: number;
  alpha: number; // a / C
  rMin: number; // a = 변까지 거리(변 가운데)
  rMax: number; // C − a (모서리 끝)
  b: number; // 곧은 변 반쪽 길이 = 모서리 곡선 반쪽 호 길이
  psi0: number; // 변 끝의 ψ (cos ψ0 = 2α)
  G0: number; // 모서리 곡선이 차지하는 반쪽 극각 = π/4 − ψ0
  L: number; // 피치곡선 둘레 = 16 b
  teeth: number; // 잇수(8 의 배수: 모서리 끝과 변 가운데가 모두 정수 피치)
  pitch: number; // L / teeth
  module: number; // pitch / π
}

const QUARTER = Math.PI / 4;

function gCorner(al: number, psi: number): number {
  return ((2 * al) / Math.sqrt(1 - al * al)) * Math.atanh(Math.tan(psi / 2) / Math.sqrt((1 - al) / (1 + al)));
}

/** G(ψ) 의 역함수: 모서리 극각 φ → ψ */
function psiCorner(al: number, phi: number): number {
  return 2 * Math.atan(Math.sqrt((1 - al) / (1 + al)) * Math.tanh((phi * Math.sqrt(1 - al * al)) / (2 * al)));
}

/** ψ0 + G(ψ0) = π/4, cos ψ0 = 2α 를 이분법으로 */
function solveAlpha(): number {
  const f = (al: number): number => {
    const p0 = Math.acos(2 * al);
    return p0 + gCorner(al, p0) - QUARTER;
  };
  let lo = 0.3;
  let hi = 0.4999;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (f(lo) * f(m) <= 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

/** 곧은 변 사각 기어의 상수 α = a/C (≈ 0.4575552) */
export const SQUARE_GEAR_ALPHA = solveAlpha();
const AL = SQUARE_GEAR_ALPHA;
const PSI0 = Math.acos(2 * AL);
const G0 = QUARTER - PSI0;

/** C = 축 간 거리, teeth = 잇수(8 의 배수) */
export function squareGearSpec(C: number, teeth: number): SquareGearSpec {
  const a = AL * C;
  const b = a * Math.tan(PSI0);
  const L = 16 * b;
  const pitch = L / teeth;
  return { C, alpha: AL, rMin: a, rMax: C - a, b, psi0: PSI0, G0, L, teeth, pitch, module: pitch / Math.PI };
}

/** 피치곡선 반지름 r(φ) (몸 극각, φ = 0 이 모서리 끝, π/4 가 변 가운데) */
export function squareGearRadius(spec: SquareGearSpec, phiIn: number): number {
  const h = Math.PI / 2;
  let phi = ((phiIn % h) + h) % h;
  if (phi > QUARTER) phi = h - phi;
  if (phi <= G0) return spec.C - spec.rMin / Math.cos(psiCorner(AL, phi));
  return spec.rMin / Math.cos(QUARTER - phi);
}

/** 호 길이 s(모서리 끝 φ = 0 에서 반시계로) → 피치곡선 위 점 Q 와 단위 접선 T(반시계 방향) */
export function squareGearPoint(spec: SquareGearSpec, sIn: number): { x: number; y: number; tx: number; ty: number } {
  const { L, b, rMin: a, C } = spec;
  const Lq = L / 4;
  let s = sIn - Math.floor(sIn / L) * L; // [0, L)
  // 모서리 끝마다 사분원: q = round(s / Lq), 그 모서리 기준 부호 있는 호 길이 t ∈ [−L/8, L/8]
  const q = Math.round(s / Lq);
  s -= q * Lq;
  const sign = s < 0 ? -1 : 1;
  const t = Math.abs(s);
  let phi: number;
  let r: number;
  let rad: number; // dr/ds
  let tan: number; // r·dφ/ds
  if (t <= b) {
    const psi = Math.atan(t / a);
    phi = gCorner(AL, psi);
    r = C - a / Math.cos(psi);
    rad = -Math.sin(psi);
    tan = Math.cos(psi);
  } else {
    const psi = Math.atan((t - 2 * b) / a); // 변 가운데(t = L/8 = 2b) 기준, ≤ 0
    phi = QUARTER + psi;
    r = a / Math.cos(psi);
    rad = Math.sin(psi);
    tan = Math.cos(psi);
  }
  // s < 0 은 x축 대칭: 위치 = 반사, 접선 = −(반사된 접선) → rad 성분 부호만 바뀜
  phi *= sign;
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  let x = r * cp;
  let y = r * sp;
  let tx = sign * rad * cp - tan * sp;
  let ty = sign * rad * sp + tan * cp;
  // q·π/2 회전
  const ang = (q * Math.PI) / 2;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  [x, y] = [x * ca - y * sa, x * sa + y * ca];
  [tx, ty] = [tx * ca - ty * sa, tx * sa + ty * ca];
  return { x, y, tx, ty };
}

const TOOTH: [number, number][] = [
  [0, -1.25],
  [0.14, -1.25],
  [0.41, 1.0],
  [0.59, 1.0],
  [0.86, -1.25]
];

/** 기어 몸 좌표(원점 = 회전축)에서 외곽 점열(반시계). phase 0: 몸 +X 모서리 끝에 이골 가운데, 0.5: 반 피치 어긋남 */
export function squareGearOutline(spec: SquareGearSpec, phase: 0 | 0.5): V2[] {
  const { pitch, module: m } = spec;
  const out: V2[] = [];
  for (let i = 0; i < spec.teeth; i++) {
    for (const [u, h] of TOOTH) {
      const p = squareGearPoint(spec, (i + phase + u) * pitch);
      // 바깥 법선 = (t_y, −t_x)
      out.push([p.x + p.ty * h * m, p.y - p.tx * h * m]);
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
  // 안쪽 둥근 네모 테두리 — 피치곡선 모양(호 길이 등분)
  const pc: V2[] = [];
  for (let k = 0; k < 160; k++) {
    const p = squareGearPoint(spec, (spec.L * k) / 160);
    pc.push([p.x, p.y]);
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
  setMM(g, { kind: 'gear', fn: 'squareGear', teeth: spec.teeth, module: spec.module, internal: false, noncircular: true, rMin: spec.rMin, rMax: spec.rMax, pitchLength: spec.L, width: w, axis: 'z', phase }); // 검사 표식
  return g;
}

/**
 * 기어 1 이 θ 돌 때 기어 2 가 더 구른 각 F(θ). θ = 0 에서 기어 1 은 모서리 끝, 기어 2 는 변 가운데로 닿는다.
 *  |θ| ≤ G0 (기어 1 모서리 ↔ 기어 2 변): F = ψ, θ = G(ψ)
 *  G0 ≤ θ ≤ π/4 (기어 1 변 ↔ 기어 2 모서리): F = π/4 − G(π/4 − θ)
 * 홀함수, F(θ + π/2) = F(θ) + π/2 (연속으로 펼친 값).
 */
export function squareGearAngle(theta: number): number {
  const h = Math.PI / 2;
  const n = Math.round(theta / h);
  const t = theta - n * h; // [−π/4, π/4]
  const at = Math.abs(t);
  const f = at <= G0 ? psiCorner(AL, at) : QUARTER - gCorner(AL, QUARTER - at);
  return n * h + Math.sign(t) * f;
}

/** 속도비 ω2/ω1 = F′(θ) = r1/(C − r1) */
export function squareGearRatio(theta: number): number {
  const h = Math.PI / 2;
  let t = Math.abs(theta - Math.round(theta / h) * h);
  if (t <= G0) {
    const c = Math.cos(psiCorner(AL, t));
    return (1 - AL / c) / (AL / c); // 기어 1 모서리(r = C − a/cosψ), 기어 2 변(a/cosψ)
  }
  t = QUARTER - t;
  const c = Math.cos(t);
  return AL / c / (1 - AL / c);
}
