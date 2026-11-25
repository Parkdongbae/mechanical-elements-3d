// 196 흔들리는 팔의 기어 전용 키트 — 두 덩이가 붙은 듯 좌우로 길쭉한(땅콩꼴) 바퀴 A 의 피치 곡선과, 고정 축 피니언 B 가 팔 끝의 A 를 굴려 흔드는 운동 풀이
//  피니언 B(고정 축)가 돌면, 팔(고정 받침 P 에서 길이 Lp)이 흔들리고 A 는 자기 축에서 돌며 B 와 미끄럼 없이 맞물린다.
import type { PitchCurve } from './gear2';
import { TAU } from '../../models/parts/geom';
import type { V2 } from './belt';

export const K196 = {
  /** 팔 받침 축 P, 팔 길이 Lp, 피니언 B 축 (판화: 팔이 거의 수평, B 는 A 바로 아래) */
  P: [0.75, 1.95] as V2,
  Lp: 1.68,
  B: [-0.81, 1.29] as V2,
  /** B 잇수, A 잇수, 피치(호) */
  nb: 12,
  na: 30,
  pitch: 0.13,
  /** A 피치 곡선 모양(크기 맞추기 전): 축 둘레 덩이(반지름 R1) + 오른쪽 위 덩이(중심 C2, 반지름 R2), 위·아래 허리는 오목 원호(반지름 rhoT, rhoB) */
  R1: 0.4,
  C2: [0.76, 0.14] as V2,
  R2: 0.35,
  rhoT: 0.4,
  rhoB: 0.7,
  /** 층(z) */
  zWheel: 0.07,
  zArm: 0.2
};
export const RP196 = (K196.nb * K196.pitch) / TAU; // B 피치 반지름 ≈ 0.248

/** 두 원(중심 c1, c2, 반지름 r1, r2)에 바깥으로 닿는 반지름 rho 의 오목 원호 중심. side=+1 위, −1 아래 */
function filletCentre(c1: V2, r1: number, c2: V2, r2: number, rho: number, side: number): V2 {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  const a1 = r1 + rho;
  const a2 = r2 + rho;
  const x = (a1 * a1 - a2 * a2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a1 * a1 - x * x));
  return [c1[0] + (x * dx - side * h * dy) / d, c1[1] + (x * dy + side * h * dx) / d];
}

/** 경계 점을 반시계로 촘촘히 뽑는다(축 = 원점, 별 모양이라 φ 가 단조) */
function outline196(): V2[] {
  const { R1, C2, R2, rhoT, rhoB } = K196;
  const C1: V2 = [0, 0];
  const FT = filletCentre(C1, R1, C2, R2, rhoT, 1);
  const FB = filletCentre(C1, R1, C2, R2, rhoB, -1);
  const ang = (c: V2, p: V2): number => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const out: V2[] = [];
  const arc = (c: V2, r: number, a0: number, a1: number, ccw: boolean): void => {
    let d = a1 - a0;
    if (ccw) while (d <= 0) d += TAU;
    else while (d >= 0) d -= TAU;
    const n = Math.max(8, Math.ceil(Math.abs(d * r) / 0.002));
    for (let i = 0; i < n; i++) {
      const a = a0 + (d * i) / n;
      out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
    }
  };
  // 오른쪽 덩이: 아래 접점 → 위 접점(반시계, 바깥쪽)
  arc(C2, R2, ang(C2, FB), ang(C2, FT), true);
  // 위 허리(오목): FT 둘레를 시계로
  arc(FT, rhoT, ang(FT, C2), ang(FT, C1), false);
  // 축 둘레 덩이: 위 접점 → 아래 접점(반시계, 왼쪽)
  arc(C1, R1, ang(C1, FT), ang(C1, FB), true);
  // 아래 허리(오목): FB 둘레를 시계로
  arc(FB, rhoB, ang(FB, C1), ang(FB, C2), false);
  return out;
}

/** 땅콩꼴 피치 곡선(극좌표 표 r(φ)). 둘레 = na × pitch 로 크기를 맞춘다 */
export function wavyPitch196(): PitchCurve {
  const pts = outline196();
  // 둘레로 크기 계수
  let L0 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    L0 += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const k = (K196.na * K196.pitch) / L0;
  // 극좌표 표(균일 φ 격자)
  const NG = 4096;
  const pol = pts.map(([x, y]) => [((Math.atan2(y, x) % TAU) + TAU) % TAU, Math.hypot(x, y) * k] as [number, number]);
  pol.sort((p, q) => p[0] - q[0]);
  const rT = new Float64Array(NG);
  let j = 0;
  for (let i = 0; i < NG; i++) {
    const f = (i / NG) * TAU;
    while (j < pol.length - 1 && pol[j + 1]![0] <= f) j++;
    const p0 = pol[j]!;
    const p1 = j < pol.length - 1 ? pol[j + 1]! : ([pol[0]![0] + TAU, pol[0]![1]] as [number, number]);
    let a0 = p0[0];
    let a1 = p1[0];
    let ff = f;
    if (f < pol[0]![0]) {
      // 0 바로 앞: 마지막 점과 첫 점 사이
      const last = pol[pol.length - 1]!;
      a0 = last[0] - TAU;
      a1 = pol[0]![0];
      rT[i] = last[1] + ((pol[0]![1] - last[1]) * (ff - a0)) / (a1 - a0);
      continue;
    }
    rT[i] = p0[1] + ((p1[1] - p0[1]) * (ff - a0)) / Math.max(1e-12, a1 - a0);
  }
  // 살짝 고르기(이웃 평균 2번) + 중앙 차분 도함수
  for (let pass = 0; pass < 2; pass++) {
    const c = rT.slice();
    for (let i = 0; i < NG; i++) rT[i] = (c[(i - 1 + NG) % NG]! + 2 * c[i]! + c[(i + 1) % NG]!) / 4;
  }
  const h = TAU / NG;
  const dT = new Float64Array(NG);
  for (let i = 0; i < NG; i++) dT[i] = (rT[(i + 1) % NG]! - rT[(i - 1 + NG) % NG]!) / (2 * h);
  const look = (t: Float64Array, phi: number): number => {
    const u = ((((phi % TAU) + TAU) % TAU) / TAU) * NG;
    const i = Math.floor(u) % NG;
    const w = u - Math.floor(u);
    return t[i]! * (1 - w) + t[(i + 1) % NG]! * w;
  };
  const r = (phi: number): number => look(rT, phi);
  const dr = (phi: number): number => look(dT, phi);
  // 호 길이 표
  const N = 8192;
  const tbl: number[] = [0];
  const f = (p: number): number => Math.hypot(r(p), dr(p));
  for (let i = 1; i <= N; i++) {
    const p0 = ((i - 1) / N) * TAU;
    const p1 = (i / N) * TAU;
    tbl.push(tbl[i - 1]! + ((p1 - p0) / 6) * (f(p0) + 4 * f((p0 + p1) / 2) + f(p1)));
  }
  const L = tbl[N]!;
  let rMin = Infinity;
  let rMax = 0;
  for (let i = 0; i < NG; i++) {
    rMin = Math.min(rMin, rT[i]!);
    rMax = Math.max(rMax, rT[i]!);
  }
  const S = (phi: number): number => {
    const kk = Math.floor(phi / TAU);
    const ff = ((phi - kk * TAU) / TAU) * N;
    const i = Math.min(N - 1, Math.floor(ff));
    return tbl[i]! + (tbl[i + 1]! - tbl[i]!) * (ff - i) + kk * L;
  };
  const phiAtS = (s: number): number => {
    const kk = Math.floor(s / L);
    const sn = s - kk * L;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tbl[mid]! <= sn) lo = mid;
      else hi = mid;
    }
    const ff = lo + (sn - tbl[lo]!) / (tbl[lo + 1]! - tbl[lo]!);
    return (ff / N) * TAU + kk * TAU;
  };
  const pt = (phi: number): V2 => [r(phi) * Math.cos(phi), r(phi) * Math.sin(phi)];
  const tangent = (phi: number): number => {
    const rr = r(phi);
    const rp = dr(phi);
    return Math.atan2(rp * Math.sin(phi) + rr * Math.cos(phi), rp * Math.cos(phi) - rr * Math.sin(phi));
  };
  const normal = (phi: number): V2 => {
    const t = tangent(phi);
    return [Math.sin(t), -Math.cos(t)];
  };
  return { L, d: rMax + rMin, rMin, rMax, r, pt, tangent, normal, S, phiAtS };
}
export interface Swing196 {
  /** 팔의 각(받침 P 에서 A 를 향하는 방향각) */
  alpha: number;
  /** A 의 세계 회전각 */
  beta: number;
  /** A 중심 */
  a: V2;
  /** 접점의 A 위 호 길이 */
  sigma: number;
  /** A 중심 ↔ B 거리 */
  dist: number;
}

export interface Swing196Solver {
  /** B 의 절대 각 θ(증가) → 자세 */
  at(theta: number): Swing196;
  /** θ 한 주기 */
  period: number;
  alphaMin: number;
  alphaMax: number;
  distMin: number;
  distMax: number;
}

/**
 * 풀이표: A 의 접점 호 길이 σ 를 변수로 한다. 접점에서 A 윤곽의 바깥 법선으로 rp 만큼 간 곳이 B 축(A 몸 기준 b(σ)).
 * A 축은 P 에서 Lp 인 원 위에 있으므로 |B − A| = |b(σ)| 로 팔 각을 정하고(B 보다 위쪽 해), A 의 각 β = (A→B 방향) − (b 의 몸 기준 방향).
 * 미끄럼 없이 구름: B 몸 위 접점 각 κ = ψ − θ (ψ = B→접점 세계 방향) 가 σ 가 늘 때 같은 호 길이만큼 줄어든다 → θ = ψ + σ/rp.
 */
export function swingSolver196(pitch: PitchCurve): Swing196Solver {
  const rp = RP196;
  const { P, Lp, B } = K196;
  const NT = 4096;
  const L = pitch.L;
  const sig: number[] = [];
  const th: number[] = [];
  const al: number[] = [];
  const be: number[] = [];
  const ds: number[] = [];
  let prevB = 0;
  let prevPsi = 0;
  for (let i = 0; i <= NT; i++) {
    const s = (L * i) / NT;
    const phi = pitch.phiAtS(s);
    const p = pitch.pt(phi);
    const n = pitch.normal(phi);
    const bx = p[0] + rp * n[0];
    const by = p[1] + rp * n[1];
    const D = Math.hypot(bx, by);
    const xi = Math.atan2(by, bx);
    const tau = Math.atan2(n[1], n[0]);
    // 원 (P, Lp) 과 원 (B, D) 의 교점 중 위쪽
    const dx = B[0] - P[0];
    const dy = B[1] - P[1];
    const dd = Math.hypot(dx, dy);
    const aa = (Lp * Lp - D * D + dd * dd) / (2 * dd);
    const hh = Math.sqrt(Math.max(0, Lp * Lp - aa * aa));
    const mx = P[0] + (aa * dx) / dd;
    const my = P[1] + (aa * dy) / dd;
    const c1: V2 = [mx + (hh * -dy) / dd, my + (hh * dx) / dd];
    const c2: V2 = [mx - (hh * -dy) / dd, my - (hh * dx) / dd];
    const A = c1[1] >= c2[1] ? c1 : c2;
    const alpha = Math.atan2(A[1] - P[1], A[0] - P[0]);
    const gamma = Math.atan2(B[1] - A[1], B[0] - A[0]);
    let beta = gamma - xi;
    let psi = beta + tau + Math.PI;
    if (i > 0) {
      beta += TAU * Math.round((prevB - beta) / TAU);
      psi = beta + tau + Math.PI;
      psi += TAU * Math.round((prevPsi - psi) / TAU);
    }
    prevB = beta;
    prevPsi = psi;
    sig.push(s);
    th.push(psi + s / rp);
    al.push((alpha + TAU) % TAU); // 팔은 왼쪽(≈180°)을 향하므로 0~2π 로 두어 ±180° 경계에서 끊기지 않게
    be.push(beta);
    ds.push(D);
  }
  const period = th[NT]! - th[0]!;
  let aMin = Infinity;
  let aMax = -Infinity;
  for (const a of al) {
    aMin = Math.min(aMin, a);
    aMax = Math.max(aMax, a);
  }
  return {
    period,
    alphaMin: aMin,
    alphaMax: aMax,
    distMin: Math.min(...ds),
    distMax: Math.max(...ds),
    at(theta: number): Swing196 {
      const kk = Math.floor((theta - th[0]!) / period);
      const t = theta - kk * period;
      let lo = 0;
      let hi = NT;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (th[mid]! <= t) lo = mid;
        else hi = mid;
      }
      const u = (t - th[lo]!) / (th[hi]! - th[lo]!);
      const lerp = (a: number[]): number => a[lo]! + (a[hi]! - a[lo]!) * u;
      const alpha = lerp(al);
      return {
        alpha,
        beta: lerp(be) - kk * TAU,
        a: [P[0] + Lp * Math.cos(alpha), P[1] + Lp * Math.sin(alpha)],
        sigma: lerp(sig) + kk * L,
        dist: lerp(ds)
      };
    }
  };
}
