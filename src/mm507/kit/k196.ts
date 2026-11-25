// 196 흔들리는 팔의 기어 전용 키트 — 물결 모양(비원형) 바퀴 A 의 피치 곡선과, 고정 축 피니언 B 가 팔 끝의 A 를 굴려 흔드는 운동 풀이
//  피니언 B(고정 축)가 돌면, 팔(고정 받침 P 에서 길이 Lp)이 흔들리고 A 는 자기 축에서 돌며 B 와 미끄럼 없이 맞물린다.
import type { PitchCurve } from './gear2';
import { TAU } from '../../models/parts/geom';
import type { V2 } from './belt';

export const K196 = {
  /** 팔 받침 축 P, 팔 길이 Lp, 피니언 B 축 */
  P: [0.95, 2.05] as V2,
  Lp: 1.6,
  B: [-0.64, 1.58] as V2,
  /** B 잇수, A 잇수, 피치(호) */
  nb: 8,
  na: 24,
  pitch: 0.157,
  /** 층(z) */
  zWheel: 0.07,
  zArm: 0.2
};
export const RP196 = (K196.nb * K196.pitch) / TAU; // B 피치 반지름 ≈ 0.2

/** 물결 모양 곡선 r(φ)(축 = A 의 회전축) — 한쪽(+X)으로 길쭉하고 가장자리가 물결친다. 둘레 = na × pitch 로 크기를 맞춘다 */
function raw(phi: number): number {
  return 0.5 + 0.22 * Math.cos(phi) + 0.07 * Math.cos(2 * phi) + 0.012 * Math.cos(7 * phi);
}
function rawD(phi: number): number {
  return -0.22 * Math.sin(phi) - 0.14 * Math.sin(2 * phi) - 0.084 * Math.sin(7 * phi);
}

export function wavyPitch196(): PitchCurve {
  // 크기 계수 k: 둘레 L(k) = k·L(1)
  const N = 8192;
  const tbl1: number[] = [0];
  for (let i = 1; i <= N; i++) {
    const p0 = ((i - 1) / N) * TAU;
    const p1 = (i / N) * TAU;
    const f = (p: number): number => Math.hypot(raw(p), rawD(p));
    tbl1.push(tbl1[i - 1]! + ((p1 - p0) / 6) * (f(p0) + 4 * f((p0 + p1) / 2) + f(p1)));
  }
  const k = (K196.na * K196.pitch) / tbl1[N]!;
  const r = (phi: number): number => k * raw(phi);
  const dr = (phi: number): number => k * rawD(phi);
  const tbl = tbl1.map((s) => s * k);
  const L = tbl[N]!;
  let rMin = Infinity;
  let rMax = 0;
  for (let i = 0; i < N; i++) {
    const v = r((i / N) * TAU);
    rMin = Math.min(rMin, v);
    rMax = Math.max(rMax, v);
  }
  const S = (phi: number): number => {
    const kk = Math.floor(phi / TAU);
    const f = ((phi - kk * TAU) / TAU) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return tbl[i]! + (tbl[i + 1]! - tbl[i]!) * (f - i) + kk * L;
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
    const f = lo + (sn - tbl[lo]!) / (tbl[lo + 1]! - tbl[lo]!);
    return (f / N) * TAU + kk * TAU;
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
    al.push(alpha);
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
