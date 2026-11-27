// 251번 말뚝 박는 기계의 해제 고리 전용 키트 — 집게 윤곽, 홈 옆면이 정하는 집게 각(닫힌 식), T 머리 모따기가 정하는 집게 각(이분법), 추를 받친 높이, 상태 닫힌 식
// 설계표 docs/mm507-sheets/251.md — 집게 각은 시간표가 아니라 홈 옆면·T 머리 모양에서 나온다.
import * as THREE from 'three';
import { brass } from '../../models/materials';
import { circlePath, extrude, mesh, shapeFrom, type V2 } from '../../models/parts/geom';

export const K251 = {
  PX: 0.185,
  N0: [0.105, 0.76] as [number, number],
  RN: 0.03,
  L0: [-0.08, -0.305] as [number, number],
  RT: 0.025,
  AT: 0.12,
  XB: 0.33,
  K: 0.65,
  YB: 2.76,
  YT: 2.98,
  YO: 1.38,
  YTOP: 2.17143,
  YREL: 2.15143,
  AREL: 0.129317,
  TR: 4.9785,
  TI: 5.3506,
  WREL: 1.2387,
  G: 9.8,
  PERIOD: 12,
  DRUM_R: 0.062
};

/** 오른쪽 집게 윤곽(핀 기준, α 0, 반시계 89 점) */
export const HOOK251: [number, number][] = [
  [-0.081, -0.330], [-0.088, -0.329], [-0.095, -0.325], [-0.100, -0.320], [-0.104, -0.313], [-0.105, -0.305], [-0.104, -0.298], [-0.100, -0.291],
  [-0.095, -0.285], [-0.087, -0.281], [-0.078, -0.280], [-0.073, -0.281], [-0.068, -0.283], [-0.064, -0.286], [-0.060, -0.290], [-0.030, -0.290],
  [-0.030, -0.034], [-0.038, -0.024], [-0.043, -0.012], [-0.045, 0.000], [-0.043, 0.013], [-0.037, 0.025], [-0.029, 0.035], [-0.017, 0.042],
  [-0.011, 0.044], [-0.004, 0.045], [0.013, 0.070], [0.035, 0.104], [0.064, 0.156], [0.080, 0.191], [0.088, 0.208], [0.101, 0.244],
  [0.107, 0.261], [0.117, 0.297], [0.122, 0.315], [0.129, 0.351], [0.134, 0.387], [0.136, 0.406], [0.137, 0.442], [0.138, 0.461],
  [0.136, 0.498], [0.135, 0.517], [0.131, 0.555], [0.124, 0.593], [0.120, 0.612], [0.111, 0.650], [0.092, 0.709], [0.077, 0.751],
  [0.075, 0.759], [0.075, 0.765], [0.077, 0.771], [0.080, 0.777], [0.085, 0.782], [0.091, 0.786], [0.097, 0.789], [0.104, 0.790],
  [0.110, 0.790], [0.116, 0.788], [0.120, 0.786], [0.125, 0.782], [0.129, 0.778], [0.132, 0.772], [0.141, 0.750], [0.156, 0.708],
  [0.168, 0.666], [0.179, 0.625], [0.187, 0.584], [0.193, 0.542], [0.195, 0.522], [0.197, 0.481], [0.198, 0.461], [0.197, 0.421],
  [0.195, 0.401], [0.191, 0.361], [0.188, 0.341], [0.180, 0.302], [0.170, 0.263], [0.158, 0.224], [0.143, 0.186], [0.127, 0.148],
  [0.117, 0.129], [0.097, 0.091], [0.075, 0.054], [0.044, 0.009], [0.045, -0.002], [0.043, -0.014], [0.037, -0.025], [0.030, -0.034],
  [0.030, -0.330]
];

/** 집게(두께 z −0.022~0.022, 핀 구멍 0.0205). mirror = 왼쪽 집게(윤곽 x 거울) */
export function hook251(mirror = false): THREE.Mesh {
  const pts: V2[] = mirror ? HOOK251.map(([x, y]) => [-x, y] as V2).reverse() : HOOK251.map(([x, y]) => [x, y] as V2);
  const sh = shapeFrom(pts);
  sh.holes.push(circlePath(0, 0, 0.0205));
  const m = mesh(extrude(sh, 0.044, 0.004), brass());
  m.userData.outline = pts;
  return m;
}

// ───────────────────────── 집게 각 ─────────────────────────

const NLEN = Math.hypot(1, K251.K);
const NV: [number, number] = [-1 / NLEN, -K251.K / NLEN]; // 홈 오른쪽 면의 안쪽 법선
const B0: [number, number] = [K251.XB, K251.YB]; // 면 위 한 점
const dot = (a: [number, number], b: [number, number]): number => a[0] * b[0] + a[1] * b[1];

const wrapPi = (a: number): number => {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x <= -Math.PI) x += 2 * Math.PI;
  return x;
};

/** 홈 옆면이 코를 밀어 정하는 집게 각(rad): 코 원이 면에 닿는 가장 작은 양의 근. 닿지 않으면 0 */
export function alphaSlot251(Yp: number): number {
  const { PX, N0, RN } = K251;
  const n0: [number, number] = [PX + N0[0], Yp + N0[1]];
  if (dot(NV, [n0[0] - B0[0], n0[1] - B0[1]]) >= RN) return 0;
  const A = dot(NV, N0);
  const B = dot(NV, [-N0[1], N0[0]]);
  const c = RN + dot(NV, B0) - dot(NV, [PX, Yp]);
  const r = Math.hypot(A, B);
  const phi = Math.atan2(B, A);
  const d = Math.acos(Math.max(-1, Math.min(1, c / r)));
  const roots = [wrapPi(phi - d), wrapPi(phi + d)].filter((x) => x >= -1e-9);
  return roots.length ? Math.max(0, Math.min(...roots)) : 0;
}

/** 발끝 원 중심(세계) — 핀 (PX, Yp) 기준 L0 를 α 만큼 반시계 회전 */
function footCenter(Yp: number, a: number): [number, number] {
  const { PX, L0 } = K251;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [PX + L0[0] * c - L0[1] * s, Yp + L0[0] * s + L0[1] * c];
}

/** 추를 받친 T 머리 밑면 높이 Tu. 발끝이 T 머리 끝을 벗어나면 −Infinity(받치지 못함) */
export function support251(Yp: number, a: number): number {
  const { AT, RT } = K251;
  const [cx, cy] = footCenter(Yp, a);
  if (cx <= AT) return cy + RT;
  if (cx <= AT + RT) return cy + Math.sqrt(Math.max(0, RT * RT - (cx - AT) * (cx - AT)));
  return -Infinity;
}

/** T 머리 다각형(오른쪽 반이 아니라 전체, 밑면 높이 Tu) */
function tPoly(Tu: number): V2[] {
  return [[-0.12, Tu], [0.12, Tu], [0.12, Tu + 0.03], [0.09, Tu + 0.06], [-0.09, Tu + 0.06], [-0.12, Tu + 0.03]];
}

function inPoly(p: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distSeg(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 발끝 원(반지름 RT)이 T 머리와 겹치지 않는 가장 작은 α ≥ 0 — 이분법 40 회(α 0~0.5 rad) */
export function alphaT251(Yp: number, Tu: number): number {
  const poly = tPoly(Tu);
  const ok = (a: number): boolean => {
    const c = footCenter(Yp, a);
    if (inPoly(c, poly)) return false;
    for (let i = 0; i < poly.length; i++) {
      if (distSeg(c, poly[i]!, poly[(i + 1) % poly.length]!) < K251.RT) return false;
    }
    return true;
  };
  if (ok(0)) return 0;
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// ───────────────────────── 상태 ─────────────────────────

const ss = (u: number): number => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

/** 받침 높이 Yp(tc) — 받침 높이만 시간표 */
function carrierY(tc: number): number {
  const { YO, YTOP } = K251;
  if (tc < 5.5) return YO + (YTOP - YO) * ss(tc / 5.5);
  if (tc < 6.5) return YTOP;
  if (tc < 10.5) return YTOP - (YTOP - YO) * ss((tc - 6.5) / 4);
  return YO;
}

export interface State251 {
  tc: number;
  Yp: number;
  alpha: number;
  Wb: number;
  pileTop: number;
  pileOpacity: number;
  drum: number;
  phase: string;
  /** 추가 매달렸나(true) 말뚝 위·떨어지는 중이면 false */
  hanging: boolean;
}

export function state251(t: number): State251 {
  const { PERIOD: P, TR, TI, WREL, G } = K251;
  const tc = ((t % P) + P) % P;
  const Yp = carrierY(tc);
  // 말뚝: 머리 높이·투명도
  let pileTop = 0.52;
  let pileOpacity = 1;
  if (tc < 2) {
    /* 처음 상태 */
  } else if (tc < 2.5) {
    pileOpacity = 1 - (tc - 2) / 0.5;
  } else if (tc < 3) {
    pileTop = 0.56;
    pileOpacity = (tc - 2.5) / 0.5;
  } else if (tc < TI) {
    pileTop = 0.56;
  } else if (tc < TI + 0.05) {
    pileTop = 0.56 - (0.04 * (tc - TI)) / 0.05;
  }
  // 집게 각·추 높이
  let alpha: number;
  let Wb: number;
  let hanging = false;
  if (tc < TR) {
    alpha = alphaSlot251(Yp);
    const Tu = Math.max(support251(Yp, alpha), pileTop + 0.6);
    Wb = Tu - 0.6;
    hanging = Wb > pileTop + 1e-6;
  } else {
    alpha = tc < 5.5 ? alphaSlot251(Yp) : Math.max(alphaSlot251(Yp), alphaT251(Yp, 1.12));
    Wb = Math.max(WREL - 0.5 * G * (tc - TR) * (tc - TR), pileTop);
  }
  const drum = -(Yp - K251.YO) / K251.DRUM_R;
  const contact = alphaSlot251(Yp) > 1e-6;
  let phase: string;
  if (tc < TR) phase = contact ? '홈이 고리를 오므림' : '올림';
  else if (tc < 6.5) phase = '추 떨어짐';
  else if (tc < 10.5) phase = '내림';
  else phase = '다시 묾';
  return { tc, Yp, alpha, Wb, pileTop, pileOpacity, drum, phase, hanging };
}
