// 284 톱기계 이송 장치 전용 키트 — 크랭크 → 연결 막대 → 벨 크랭크 → 걸쇠 → 래칫 바퀴(+피니언) → 랙·수레.
// 설계표: docs/mm507-sheets/284.md. 좌표는 세계 좌표. 자세는 t(초)의 절대 함수이고, 걸쇠·멈춤쇠 기울기는 '처음 닿는 자리' 규칙으로 매 프레임 계산한다.
import * as THREE from 'three';
import { brass, bronze, castIron, paint, steel } from '../../models/materials';
import { annularSector, circlePath, extrude, mesh, shapeFrom, type V2 } from '../../models/parts/geom';
import { circleIntersect } from './misc';
import { setMM } from './mm';
import { sdfOutline } from './k280';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

export const K284 = {
  W: [-1.0, 1.45] as [number, number],
  NT: 24,
  RO: 0.55,
  RR: 0.46,
  A0: 45 * DEG,
  A_PUSH: 60 * DEG,
  a: [-1.317, 2.6666] as [number, number],
  LH: 2.17,
  LV: 0.53,
  CR: [0.853, 1.0666] as [number, number],
  RC: 0.45,
  LR: 1.6,
  CHI0: 1.593485,
  U_MIN: 0.50292,
  LC: 0.65,
  GC0: -35 * DEG,
  HD: [-1.5652, 1.0793] as [number, number],
  LD: 0.6,
  GD0: 75 * DEG,
  GD_REST: 76.465 * DEG,
  RP: 0.28,
  LIFT: 25 * DEG,
  PERIOD: 20
} as const;
const K = K284;
const STEP = TAU / K.NT; // 톱니 한 칸 15°
const NFEED = 8; // 이송 횟수(크랭크 바퀴 수)

const ss = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

// ───────────────────────── 래칫 윤곽 ─────────────────────────

/** 래칫 바퀴 윤곽(바퀴 좌표, 반시계 48점): 곧은 면 (0.55 → 0.46, 각 aj) 다음 비탈 0.46(aj) → 0.55(aj + 15°) */
function ratchetLocal(): V2[] {
  const out: V2[] = [];
  for (let j = 0; j < K.NT; j++) {
    const aj = K.A0 + STEP * j;
    out.push([K.RO * Math.cos(aj), K.RO * Math.sin(aj)], [K.RR * Math.cos(aj), K.RR * Math.sin(aj)]);
  }
  return out;
}
const RATCHET_LOCAL = ratchetLocal();

/** 바퀴를 psi 만큼 돌린 세계 좌표 윤곽 48점(교점 풀이용) */
export function ratchetOutline284(psi: number): [number, number][] {
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  return RATCHET_LOCAL.map(([x, y]): [number, number] => [K.W[0] + c * x - s * y, K.W[1] + s * x + c * y]);
}

/** 걸쇠·멈춤쇠가 내려앉는 각: 받침 핀 hinge 둘레 반지름 len 원과 윤곽의 교점 가운데, gNom ± 0.89 rad 안에서 각이 가장 큰 것 */
export function pawlRest284(hinge: [number, number], len: number, outline: [number, number][], gNom: number): number {
  let best = -Infinity;
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % n]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const fx = a[0] - hinge[0];
    const fy = a[1] - hinge[1];
    const A = dx * dx + dy * dy;
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - len * len;
    const disc = B * B - 4 * A * C;
    if (disc < -1e-12) continue;
    const sq = Math.sqrt(Math.max(0, disc));
    for (const sg of [-1, 1]) {
      const t = (-B + sg * sq) / (2 * A);
      if (t < -1e-7 || t > 1 + 1e-7) continue;
      const px = a[0] + t * dx - hinge[0];
      const py = a[1] + t * dy - hinge[1];
      let diff = Math.atan2(py, px) - gNom;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) <= 0.89 && diff > best) best = diff;
    }
  }
  return best === -Infinity ? gNom : gNom + best;
}

// ───────────────────────── 자세 ─────────────────────────

export interface State284 {
  /** 크랭크 각 */
  chi: number;
  /** 벨 크랭크 각 */
  lambda: number;
  /** 가로 팔 끝(연결 막대 위 끝) */
  E: [number, number];
  /** 크랭크 핀 */
  Pc: [number, number];
  /** 세로 팔 끝(걸쇠 핀) */
  K: [number, number];
  /** 바퀴 각(시계가 음수) */
  psi: number;
  gammaC: number;
  gammaD: number;
  /** 수레 위치 */
  X: number;
  /** 걸쇠·멈춤쇠 들어올림(rad) */
  lift: number;
  /** feed 이송 · lift 들어올림 · back 되돌림 · drop 내려놓음 */
  phase: 'feed' | 'lift' | 'back' | 'drop';
  /** 몇 번째 크랭크 바퀴(0 …) */
  k: number;
  /** 걸쇠가 톱니를 미는 중 */
  pushing: boolean;
}

export function state284(t: number): State284 {
  const tt = ((t % K.PERIOD) + K.PERIOD) % K.PERIOD;
  const feed = tt < 2 * NFEED;
  let k = NFEED - 1;
  let u = 1;
  if (feed) {
    k = Math.floor(tt / 2);
    u = tt / 2 - k;
  }
  const chi = feed ? K.CHI0 + TAU * u : K.CHI0;
  const Pc: [number, number] = [K.CR[0] + K.RC * Math.cos(chi), K.CR[1] + K.RC * Math.sin(chi)];
  const e1 = circleIntersect(K.a, K.LH, Pc, K.LR, true);
  const e2 = circleIntersect(K.a, K.LH, Pc, K.LR, false);
  const E = ((e1 && e2 ? (e1[0] >= e2[0] ? e1 : e2) : e1 ?? e2) ?? [K.a[0] + K.LH, K.a[1]]) as [number, number];
  const lambda = Math.atan2(E[1] - K.a[1], E[0] - K.a[0]);
  const Kp: [number, number] = [K.a[0] + K.LV * Math.sin(lambda), K.a[1] - K.LV * Math.cos(lambda)];

  let psi: number;
  let pushing = false;
  let lift = 0;
  let phase: State284['phase'] = 'feed';
  if (feed) {
    psi = -STEP * k;
    if (u >= K.U_MIN) {
      // 걸쇠 끝이 미는 골 모서리의 세계 각 A: |K − W − 0.46(cos A, sin A)| = 0.65
      const dx = Kp[0] - K.W[0];
      const dy = Kp[1] - K.W[1];
      let A = 52.5 * DEG;
      for (let i = 0; i < 20; i++) {
        const ex = Math.cos(A);
        const ey = Math.sin(A);
        const px = dx - K.RR * ex;
        const py = dy - K.RR * ey;
        const f = px * px + py * py - K.LC * K.LC;
        const fp = -2 * K.RR * (-px * ey + py * ex);
        if (Math.abs(fp) < 1e-12) break;
        A -= f / fp;
      }
      const dA = K.A_PUSH - A;
      if (dA > 0) {
        psi -= dA;
        pushing = true;
      }
    }
  } else if (tt < 16.6) {
    psi = -NFEED * STEP;
    lift = K.LIFT * ss((tt - 16) / 0.6);
    phase = 'lift';
  } else if (tt < 19.4) {
    psi = -NFEED * STEP * (1 - ss((tt - 16.6) / 2.8));
    lift = K.LIFT;
    phase = 'back';
  } else {
    psi = 0;
    lift = K.LIFT * (1 - ss((tt - 19.4) / 0.6));
    phase = 'drop';
  }

  let gammaC: number;
  let gammaD: number;
  if (feed) {
    const ol = ratchetOutline284(psi);
    gammaC = pawlRest284(Kp, K.LC, ol, K.GC0);
    gammaD = pawlRest284(K.HD, K.LD, ol, K.GD0);
  } else {
    gammaC = K.GC0 + lift;
    gammaD = K.GD_REST + lift;
  }
  return { chi, lambda, E, Pc, K: Kp, psi, gammaC, gammaD, X: -K.RP * psi, lift, phase, k, pushing };
}

// ───────────────────────── 부품 ─────────────────────────

/** 래칫 바퀴: 윤곽 24 톱니 + 축 구멍 + 창 4 + 앞면 노란 띠. 깊이 0 ~ 0.08(메시 position.z = 0.04) */
export function ratchet284(): THREE.Mesh {
  const shape = shapeFrom(RATCHET_LOCAL);
  shape.holes.push(circlePath(0, 0, 0.04));
  for (let i = 0; i < 4; i++) shape.holes.push(annularSector(0.13, 0.36, (10 + 90 * i) * DEG, (80 + 90 * i) * DEG));
  const m = mesh(extrude(shape, 0.08, 0.002), steel({ roughness: 0.34 }));
  m.position.z = 0.04;
  m.userData.outline = RATCHET_LOCAL;
  const band = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.004), paint(0xf2b619));
  band.name = 'ratchetBand';
  band.position.set(0.25, 0, 0.04 + 0.002); // 바퀴 앞면 0.08 위(0.08 ~ 0.084)
  m.add(band);
  return m;
}


/** 굽은 걸쇠 윤곽(로컬: x 축 = 받침 핀 → 끝점, 위로 부풂). 가운데선 원호, 반폭 w, 끝 tipLen 구간에서 0 으로 줄고, 시작에 둥근 귀 */
export function catchOutline284(chord: number, bendDeg: number, w = 0.025, tipLen = 0.12, earR = 0.04): V2[] {
  const half = (bendDeg * DEG) / 2;
  const R = chord / 2 / Math.sin(half);
  const cx = chord / 2;
  const cy = -R * Math.cos(half);
  const th0 = Math.PI / 2 + half;
  const L = R * 2 * half;
  const pos = (s: number): { p: V2; n: V2 } => {
    const th = th0 - s / R;
    return { p: [cx + R * Math.cos(th), cy + R * Math.sin(th)], n: [Math.cos(th), Math.sin(th)] };
  };
  const wAt = (s: number): number => w * Math.min(1, (L - s) / tipLen);
  const edge = (s: number, sign: 1 | -1): V2 => {
    const { p, n } = pos(s);
    const ww = wAt(s);
    return [p[0] + sign * ww * n[0], p[1] + sign * ww * n[1]];
  };
  // 귀 원과 만나는 s(두 변 각각 이분법)
  const exitS = (sign: 1 | -1): number => {
    let lo = 0;
    let hi = earR * 1.5;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const e = edge(mid, sign);
      if (Math.hypot(e[0], e[1]) < earR) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const sR = exitS(-1); // 안쪽(오른쪽) 변
  const sL = exitS(1); // 바깥쪽(왼쪽) 변
  const out: V2[] = [];
  const N = 48;
  // 안쪽 변: 귀 → 끝 (반시계 진행)
  for (let i = 0; i <= N; i++) {
    const s = sR + ((L - sR) * i) / N;
    out.push(edge(Math.min(s, L), -1));
  }
  // 바깥쪽 변: 끝 → 귀 (끝점은 위와 같으니 건너뜀)
  for (let i = N - 1; i >= 0; i--) {
    const s = sL + ((L - sL) * i) / N;
    out.push(edge(s, 1));
  }
  // 귀 호: 바깥쪽 변 출구각 → 안쪽 변 출구각(+2π), 반시계(뒤쪽을 돎)
  const eL = edge(sL, 1);
  const eR = edge(sR, -1);
  const aL = Math.atan2(eL[1], eL[0]);
  let aR = Math.atan2(eR[1], eR[0]);
  while (aR <= aL) aR += TAU;
  const M = 28;
  for (let i = 1; i < M; i++) {
    const a = aL + ((aR - aL) * i) / M;
    out.push([earR * Math.cos(a), earR * Math.sin(a)]);
  }
  return out;
}

/** 굽은 걸쇠(청동): 깊이 0.01 ~ 0.07(메시 position.z = 0.04), 귀 구멍 0.0205 */
export function catch284(chord: number, bendDeg: number): THREE.Mesh {
  const outline = catchOutline284(chord, bendDeg);
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.0205));
  const m = mesh(extrude(shape, 0.06, 0.0015), bronze({ roughness: 0.34 }));
  m.position.z = 0.04;
  m.userData.outline = outline;
  return m;
}

/** 랙(황동): 수레 로컬 좌표 x −1.95 ~ 1.35, 피치선 y 1.73, 이가 아래. 깊이 −0.10 ~ −0.04(메시 position.z = −0.07) */
export function rack284(): THREE.Mesh {
  const pts: V2[] = [[-1.95, 1.7738]];
  for (let k = -8; k <= 20; k++) {
    const c = -1.0 + 0.10996 * k;
    pts.push([c - 0.04341, 1.7738], [c - 0.01602, 1.6985], [c + 0.01602, 1.6985], [c + 0.04341, 1.7738]);
  }
  pts.push([1.35, 1.7738], [1.35, 1.9], [-1.95, 1.9]);
  const m = mesh(extrude(shapeFrom(pts), 0.06, 0.002), brass());
  m.position.z = -0.07;
  m.userData.outline = pts;
  return m;
}

/** y-깊이 단면(점 [깊이 양의 쪽 u = −z, y])을 x 방향으로 길이 len 뽑아 x0 부터 놓는다 */
function sweepX(profile: V2[], x0: number, len: number, mat: THREE.Material, c: number): THREE.Mesh {
  const geo = extrude(shapeFrom(profile), len, c);
  geo.rotateY(Math.PI / 2); // (u, v, w) → (x = w, y = v, z = −u)
  const m = mesh(geo, mat);
  m.position.x = x0 + len / 2;
  return m;
}

/** 수레 레일(주철, 고정): x −1.30 ~ 1.30, 몸 y 1.70 ~ 1.774(깊이 −0.30 ~ −0.10) + 혀 y 1.774 ~ 1.814(깊이 −0.20 ~ −0.16) */
export function rail284(): THREE.Mesh {
  const prof: V2[] = [
    [0.1, 1.7],
    [0.3, 1.7],
    [0.3, 1.774],
    [0.2, 1.774],
    [0.2, 1.814],
    [0.16, 1.814],
    [0.16, 1.774],
    [0.1, 1.774]
  ];
  return sweepX(prof, -1.3, 2.6, castIron(), 0.002);
}

/** 수레(주철) + 랙 + 노란 눈금 4. 로컬 = X 0 일 때 세계. 몸통 메시 name 'carriage', 랙 메시 name 'rack' */
export function carriage284(): THREE.Group {
  const g = new THREE.Group();
  const prof: V2[] = [
    [0.1, 1.774],
    [0.158, 1.774],
    [0.158, 1.816],
    [0.202, 1.816],
    [0.202, 1.774],
    [0.24, 1.774],
    [0.24, 2.08],
    [0.1, 2.08]
  ];
  const body = sweepX(prof, -1.95, 3.3, castIron(), 0.003);
  body.name = 'carriage';
  g.add(body);
  const rack = rack284();
  rack.name = 'rack';
  setMM(rack, { kind: 'rack', fn: 'rack284', module: 0.035, axis: 'x' });
  g.add(rack);
  for (const x of [-1.5, -0.5, 0.5, 1.0]) {
    const tick = mesh(new THREE.BoxGeometry(0.02, 0.04, 0.004), paint(0xf2b619));
    tick.name = 'carriageTick';
    tick.position.set(x, 2.03, -0.0985);
    g.add(tick);
  }
  return g;
}

/** 벨 크랭크 윤곽(받침 a 가 원점): 가로 팔 + 세로 팔 + 허브의 합집합 */
export function bellCrankOutline284(): V2[] {
  const seg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  return sdfOutline(
    (x, y) => Math.min(seg(x, y, 0, 0, K.LH, 0) - 0.08, seg(x, y, 0, 0.18, 0, -0.62) - 0.1, Math.hypot(x, y) - 0.09),
    -0.14,
    -0.76,
    K.LH + 0.12,
    0.32,
    0.002
  );
}
