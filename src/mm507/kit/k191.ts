// 번호 전용 키트 (507 · 191번) — 소용돌이(스크롤) 기어: 피치 곡선이 대수 나선 r = rmin·e^(φ/k) (φ = 0 ~ 2π, rmax/rmin = e^(2π/k))이고
// 끝에 반지름 방향 계단 벽이 있는 같은 기어 두 개. 두 기어의 중심 거리 C = rmin + rmax 이면 접점에서 r1 + r2 = C 가 늘 성립하고
// 두 기어가 서로 같은 모양으로 맞물린다(대수 나선의 성질). 접점 호장 s1 + s2 = S(나선 전체 길이), 이는 피치 곡선을 따라 일정 간격.
import * as THREE from 'three';
import { brass, bronze, darkSteel, steel } from '../../models/materials';
import { circlePts, lathe, loft, mesh, tubeProfile, TAU } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { setMM } from './mm';

export const K191 = {
  rmin: 0.5,
  rmax: 0.74,
  N: 35, // 이 수(나선 위, 끝에 반 개가 벽에 잘림)
  ha: 0.032, // 이끝 높이(피치 곡선 밖으로)
  hd: 0.05, // 이뿌리 깊이
  width: 0.1,
  zc: 0.1, // 기어 z 가운데
  bore: 0.062,
  boss: 0.19,
  eps: 0.05, // 계단 벽이 닿기 직전에 멈추는 각(rad)
  cy1: 2.3, // 위 기어 중심 y
  cx: 0
} as const;

export const C191 = K191.rmin + K191.rmax;
export const CY2_191 = K191.cy1 - C191;

/** 나선 상수 k = 2π / ln(rmax/rmin), 호장 계수 κ = √(k²+1), 전체 길이 S */
const k = TAU / Math.log(K191.rmax / K191.rmin);
const kappa = Math.sqrt(k * k + 1);
export const S191 = kappa * (K191.rmax - K191.rmin);
export const PITCH191 = S191 / (K191.N + 0.5);

const rOf = (phi: number): number => K191.rmin * Math.exp(phi / k);
/** 호장 s → 나선 각 φ (r 이 s 에 선형: r = rmin + s/κ) */
const phiOfS = (s: number): number => k * Math.log(1 + s / (kappa * K191.rmin));

let cacheOutline: V2[] | null = null;
/** 기어 외곽(원점 = 축, 반시계). 나선 피치 곡선을 따라 일정 간격의 이, 끝은 반지름 방향 벽 */
export function scrollOutline191(): V2[] {
  if (cacheOutline) return cacheOutline;
  const pts: V2[] = [];
  const per = 16;
  const nTot = Math.round((S191 / PITCH191) * per);
  for (let i = 0; i <= nTot; i++) {
    const s = (i / nTot) * S191;
    const f = (s / PITCH191) % 1;
    const u = Math.abs(f - 0.5);
    const tipEnd = 0.06;
    const rootStart = 0.27;
    let h: number;
    if (s > S191 - 0.5 * PITCH191) h = -K191.hd; // 벽에 잘리는 반 개 이는 없앰
    else if (u <= tipEnd) h = K191.ha;
    else if (u >= rootStart) h = -K191.hd;
    else h = K191.ha + (-K191.hd - K191.ha) * ((u - tipEnd) / (rootStart - tipEnd));
    const phi = phiOfS(s);
    const r = rOf(phi);
    const rp = r / k;
    // 접선 (r' er + r eφ), 바깥 법선 = (Ty, −Tx)
    const tx = rp * Math.cos(phi) - r * Math.sin(phi);
    const ty = rp * Math.sin(phi) + r * Math.cos(phi);
    const tn = Math.hypot(tx, ty);
    pts.push([r * Math.cos(phi) + (ty / tn) * h, r * Math.sin(phi) - (tx / tn) * h]);
  }
  cacheOutline = pts;
  return pts;
}

export interface Pose191 {
  /** 위·아래 기어의 접점 나선 각 */
  phi1: number;
  phi2: number;
  /** 각 기어의 회전(rad, 로컬 → 월드). 위 기어는 시계, 아래는 반시계로 돎 */
  th1: number;
  th2: number;
  /** 0 = 계단 벽이 처음 닿는 쪽, 1 = 판화 자세(두 계단 벽이 맞닿음) */
  u: number;
  /** 각속도비 ω2/ω1 = r1/r2 */
  ratio: number;
}

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** theta → 자세. u = 1 (theta 1.6) 이 판화 자세 */
export function pose191(theta: number): Pose191 {
  const u = smooth(0.5 + 0.575 * Math.cos(theta - 1.6));
  const phi1 = K191.eps + (TAU - 2 * K191.eps) * u;
  const r1 = rOf(phi1);
  const r2 = C191 - r1;
  const phi2 = k * Math.log(r2 / K191.rmin);
  return { phi1, phi2, th1: -Math.PI / 2 - phi1, th2: Math.PI / 2 - phi2, u, ratio: r1 / r2 };
}

/** 소용돌이 기어: 원점 = 축, 회전축 = 로컬 Z. outline = 외곽. 위·아래가 같은 모양(주철·청동) */
export function scrollGear191(driver: boolean): THREE.Group {
  const g = new THREE.Group();
  const out = scrollOutline191();
  const w = K191.width;
  const c = 0.012;
  const body = driver ? bronze({ roughness: 0.34 }) : brass();
  const layers = [
    { z: -w / 2, s: 0.985, hs: 1 + c / K191.bore },
    { z: -w / 2 + c, s: 1, hs: 1 },
    { z: w / 2 - c, s: 1, hs: 1 },
    { z: w / 2, s: 0.985, hs: 1 + c / K191.bore }
  ];
  const plate = mesh(loft(out, [circlePts(K191.bore, 32)], layers), body);
  plate.position.z = K191.zc;
  g.add(plate);
  // 돋은 허브 고리(판화의 흰 고리)
  const hubGeo = lathe(tubeProfile(K191.bore, K191.boss, 0, 0.04, 0.008), 40);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, steel());
  hub.position.z = K191.zc + w / 2;
  g.add(hub);
  g.userData.outline = out;
  setMM(g, { kind: 'gear', fn: 'scrollGear191', noncircular: true, teeth: K191.N, internal: false, axis: 'z' });
  return g;
}

/** 축 끝 마개(고정, 판화의 짙은 원판): 중심 축 위 */
export function pinCap191(): THREE.Mesh {
  const z0 = K191.zc + K191.width / 2 + 0.045;
  const cap = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 32).rotateX(Math.PI / 2), darkSteel());
  cap.position.z = z0 + 0.015;
  return cap;
}
export const SHAFT_Z191 = K191.zc + K191.width / 2 + 0.045;
