// 294번 원통 탈진기 전용 키트 — 탈진 바퀴(쐐기 이 12)·원통(반 껍질·입술·밸런스)과 접촉 계산(원·원, 원·선분 교점).
// 설계표 docs/mm507-sheets/294.md. 295번(확대)도 같은 계산·같은 부품 만드는 법을 크기만 바꿔 쓰므로 k295.ts 가 여기 공용 부분(EscCfg·buildEscWheel·buildEscCylinder·escContact·escState)을 불러 쓴다.
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, merge, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';

export const D2R = Math.PI / 180;

/** 크기만 다른 두 판이 같은 식을 쓰도록 모은 설정 */
export interface EscCfg {
  WC: V2;
  C: V2;
  RP: number;
  RH: number;
  RB: number;
  RO: number;
  RI: number;
  /** 바퀴 테 고리 안·바깥 반지름 */
  RIM: [number, number];
  /** 줄기 안·바깥 반지름, 반폭 */
  STEM: [number, number];
  STEMW: number;
  /** 바퀴 판 z 범위, 쐐기 z 범위(판에 0.002 박음) */
  ZW: [number, number];
  ZT: [number, number];
  /** 허브 칼라 z 범위(판에 0.002 박음) */
  ZCOL: [number, number];
  /** 태엽통 반지름·z 범위 */
  BAR: { R: number; z0: number; z1: number };
  T1: number;
  T2: number;
}

export const K294 = {
  S: 1.1,
  WC: [0, 1.3] as V2,
  C: [0, 2.323] as V2,
  Z: 12,
  PITCH: 30,
  TH0: 96,
  RP: 0.9845,
  RH: 1.0615,
  RB: 0.9713,
  DEL: 9.8,
  RO: 0.1265,
  RI: 0.1045,
  SHELL: 192,
  BEV: 15,
  PASS: 90,
  AMP: 110,
  T1: 0.577069,
  T2: 1.555028,
  STEM_ANG: 6.86,
  HOLE: 0.042,
  /** 표 기대값 [t, ψ, φ] */
  EXPECT: [
    [0, 110, 0.8837],
    [0.45, 17.208, 0.8837],
    [0.48, 6.907, 0.1521],
    [0.5, 0, -2.0072],
    [0.52, -6.907, -4.0266],
    [0.55, -17.208, -6.8374],
    [0.58, -27.356, -11.5486],
    [1.0, -110, -11.5486],
    [1.45, -17.208, -13.7671],
    [1.5, 0, -18.0325],
    [1.54, 13.787, -20.4517],
    [1.56, 20.612, -29.1163],
    [2.0, 110, -29.1163],
    [30, 110, -449.1163]
  ] as [number, number, number][]
} as const;
const KK = K294;

export const CFG294: EscCfg = {
  WC: K294.WC,
  C: K294.C,
  RP: K294.RP,
  RH: K294.RH,
  RB: K294.RB,
  RO: K294.RO,
  RI: K294.RI,
  RIM: [0.726, 0.858],
  STEM: [0.836, 0.9757],
  STEMW: 0.0132,
  ZW: [0, 0.03],
  ZT: [0.028, 0.08],
  ZCOL: [0.028, 0.09],
  BAR: { R: 0.45, z0: -0.19, z1: -0.08 },
  T1: K294.T1,
  T2: K294.T2
};

const pol = (r: number, deg: number): V2 => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
const angOf = (x: number, y: number): number => Math.atan2(y, x) / D2R;
const mod360 = (a: number): number => ((a % 360) + 360) % 360;
const wrap180 = (a: number): number => mod360(a + 180) - 180;

// ───────────────────────── 접촉 계산 ─────────────────────────

/** 원점 중심 반지름 r1 원과 (c2, r2) 원의 교점 */
function circCirc(r1: number, c2: V2, r2: number): V2[] {
  const d = Math.hypot(c2[0], c2[1]);
  if (d === 0 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const ex = c2[0] / d;
  const ey = c2[1] / d;
  const mx = a * ex;
  const my = a * ey;
  return [
    [mx - h * ey, my + h * ex],
    [mx + h * ey, my - h * ex]
  ];
}

/** 원점 중심 반지름 r 원과 선분 p–q 의 교점 */
function circSeg(r: number, p: V2, q: V2): V2[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const A = dx * dx + dy * dy;
  const B = 2 * (p[0] * dx + p[1] * dy);
  const Cc = p[0] * p[0] + p[1] * p[1] - r * r;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  const out: V2[] = [];
  for (const u of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) if (u >= 0 && u <= 1) out.push([p[0] + u * dx, p[1] + u * dy]);
  return out;
}

export interface EscContact {
  phi: number;
  /** wall = 끝 P 가 껍질 벽에, lip = 비탈이 입술 모서리에 */
  kind: 'wall' | 'lip';
}

/** 설계표 '동작' 3·4 — phase 'O' 바깥 단계, 'I' 안 단계. 이 k 의 φ(도)와 닿은 곳. 없으면 null. 가장 큰 φ 가 먼저 닿는 것 */
export function escContact(cfg: EscCfg, phase: 'O' | 'I', k: number, psi: number): EscContact | null {
  const dC: V2 = [cfg.C[0] - cfg.WC[0], cfg.C[1] - cfg.WC[1]];
  const base = KK.TH0 + KK.PITCH * k;
  const cands: EscContact[] = [];
  const rad = phase === 'O' ? cfg.RO : cfg.RI;
  for (const q of circCirc(cfg.RP, dC, rad)) {
    const sideOk = phase === 'O' ? q[0] < dC[0] : q[0] > dC[0];
    const a = mod360(angOf(q[0] - dC[0], q[1] - dC[1]) - psi);
    if (sideOk && a <= KK.SHELL) cands.push({ phi: angOf(q[0], q[1]) - base, kind: 'wall' });
  }
  const lip = phase === 'O' ? KK.SHELL + psi : psi;
  const Pp = pol(cfg.RP, base);
  const Hp = pol(cfg.RH, base + KK.DEL);
  const edges: [number, number][] = phase === 'O' ? [[cfg.RO, 0], [cfg.RI, -KK.BEV]] : [[cfg.RO, KK.BEV], [cfg.RI, 0]];
  for (const [r, dl] of edges) {
    const lx = dC[0] + r * Math.cos((lip + dl) * D2R);
    const ly = dC[1] + r * Math.sin((lip + dl) * D2R);
    const rr = Math.hypot(lx, ly);
    for (const Q of circSeg(rr, Pp, Hp)) cands.push({ phi: angOf(lx, ly) - angOf(Q[0], Q[1]), kind: 'lip' });
  }
  let best: EscContact | null = null;
  for (const c of cands) {
    const phi = wrap180(c.phi);
    if (best === null || phi > best.phi) best = { phi, kind: c.kind };
  }
  return best;
}

export type EscPhase = 'out' | 'in1' | 'in' | 'out2';

export interface EscState {
  psi: number;
  phi: number;
  /** out: 쐐기 끝이 껍질 바깥에 · in1: 입구 입술 충격 · in: 안쪽 벽에 · out2: 출구 입술 충격 */
  phase: EscPhase;
  justDropped: boolean;
}

/** 설계표 '동작' 1~7 */
export function escState(cfg: EscCfg, t: number): EscState {
  const n = Math.floor(t / 2 + 1e-12);
  const tau = t - 2 * n;
  const psi = KK.AMP * Math.cos(Math.PI * tau);
  let r: EscContact | null;
  let phase: EscPhase;
  if (tau < cfg.T1) {
    r = escContact(cfg, 'O', 0, psi);
    phase = r !== null && r.kind === 'lip' ? 'in1' : 'out';
  } else if (tau < cfg.T2) {
    r = escContact(cfg, 'I', 0, psi);
    phase = r !== null && r.kind === 'lip' ? 'out2' : 'in';
  } else {
    r = escContact(cfg, 'O', 1, psi);
    phase = 'out';
  }
  // 설계표대로면 일어나지 않는다(경계의 수치 오차만) — 튀지 않게 직전 구간 값으로
  if (r === null) r = { phi: tau < cfg.T1 ? 0.8837 : tau < cfg.T2 ? -11.5486 : -29.1163, kind: 'wall' };
  const justDropped = (tau >= cfg.T1 && tau < cfg.T1 + 0.04) || (tau >= cfg.T2 && tau < cfg.T2 + 0.04);
  return { psi, phi: r.phi - KK.PITCH * n, phase, justDropped };
}

export function contact294(phase: 'O' | 'I', k: number, psi: number): number | null {
  const r = escContact(CFG294, phase, k, psi);
  return r === null ? null : r.phi;
}
export function state294(t: number): EscState {
  return escState(CFG294, t);
}

// ───────────────────────── 부품 ─────────────────────────

/** 원호 점열(반시계 또는 시계) — 약 1.5° 간격 */
function arc(r: number, a0: number, a1: number): V2[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 1.5));
  const o: V2[] = [];
  for (let i = 0; i <= n; i++) o.push(pol(r, a0 + ((a1 - a0) * i) / n));
  return o;
}

/** 다각형(여러 구멍 가능) 판 — z0~z1 */
function slab(outline: V2[], holes: THREE.Path[], z0: number, z1: number): THREE.BufferGeometry {
  const shape = shapeFrom(outline);
  for (const h of holes) shape.holes.push(h);
  const geo = extrude(shape, z1 - z0, 0, 8);
  geo.translate(0, 0, (z0 + z1) / 2);
  return geo;
}

/** 살 사이 빈 곳(구멍) — 살 중심선 각 a0·a1, 살 반폭 w, 반지름 r0~r1 */
function gapHole(r0: number, r1: number, a0: number, a1: number, w: number): THREE.Path {
  const o0 = Math.asin(w / r1) / D2R;
  const i0 = Math.asin(w / r0) / D2R;
  const pts: V2[] = [...arc(r1, a0 + o0, a1 - o0), ...arc(r0, a1 - i0, a0 + i0)];
  return pathFrom(pts);
}

/** 바퀴 윤곽 — 테 바깥 원 + 줄기 12(이 k 기준각 + STEM_ANG 방향 막대) */
function wheelOutline(cfg: EscCfg): V2[] {
  const R = cfg.RIM[1];
  const w = cfg.STEMW;
  const s0 = Math.sqrt(R * R - w * w);
  const da = Math.asin(w / R) / D2R;
  const L = cfg.STEM[1];
  const at = (dir: number, l: number, o: number): V2 => {
    const ux = Math.cos(dir * D2R);
    const uy = Math.sin(dir * D2R);
    return [l * ux - o * uy, l * uy + o * ux];
  };
  const pts: V2[] = [];
  for (let k = 0; k < KK.Z; k++) {
    const d = KK.TH0 + KK.PITCH * k + KK.STEM_ANG;
    pts.push(at(d, s0, -w), at(d, L, -w), at(d, L, w), at(d, s0, w));
    pts.push(...arc(R, d + da, d + KK.PITCH - da).slice(1, -1));
  }
  return pts;
}

/** 쐐기 이 k 의 삼각형(바퀴 좌표): 끝 P, 굽 위 H, 굽 아래 B */
export function wedgeTri(cfg: EscCfg, k: number): V2[] {
  const th = KK.TH0 + KK.PITCH * k;
  return [pol(cfg.RP, th), pol(cfg.RH, th + KK.DEL), pol(cfg.RB, th + KK.DEL)];
}

/**
 * 탈진 바퀴 + 쐐기 이 + 허브 칼라 + 태엽통(+ 표시). 원점 = 바퀴 축, 회전축 = 로컬 Z.
 * 몸통 메시 name `escapeWheel`·`wheelTeeth`·`barrel`
 */
export function buildEscWheel(cfg: EscCfg, mark: 'red' | 'dots'): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelGroup';
  const outline = wheelOutline(cfg);
  const holes: THREE.Path[] = [circlePath(0, 0, KK.HOLE)];
  const rin = 0.11;
  for (let j = 0; j < 4; j++) holes.push(gapHole(rin, cfg.RIM[0], 90 * j, 90 * (j + 1), 0.03));
  const wheel = mesh(slab(outline, holes, cfg.ZW[0], cfg.ZW[1]), brass());
  wheel.name = 'escapeWheel';
  g.add(wheel);

  // 쐐기 이 12 — 한 메시
  const triGeos: THREE.BufferGeometry[] = [];
  const outlines: Record<string, V2[]> = {};
  for (let k = 0; k < KK.Z; k++) {
    const tri = wedgeTri(cfg, k);
    triGeos.push(slab(tri, [], cfg.ZT[0], cfg.ZT[1]));
    outlines['tooth' + k] = tri;
  }
  const teethMat = steel();
  const teeth = mesh(merge(triGeos), teethMat);
  teeth.name = 'wheelTeeth';
  teeth.userData.outlines = outlines;
  g.add(teeth);

  // 허브 칼라
  const colGeo = lathe(tubeProfile(KK.HOLE, 0.08, cfg.ZCOL[0], cfg.ZCOL[1], 0.002), 40);
  colGeo.rotateX(Math.PI / 2);
  g.add(mesh(colGeo, darkSteel()));

  if (mark === 'red') {
    // 빨간 표시 — 판 앞면 위(0.001 박음), 살 위 반지름 0.45
    const red = mesh(new THREE.BoxGeometry(0.04, 0.12, 0.004), paint(0xd03020));
    red.position.set(0, 0.45, cfg.ZW[1] + 0.001);
    g.add(red);
  } else {
    // 색 점 — 이 0·1·2 쐐기 윗면(0.001 박음), 지름 0.03
    const dotMat = paint(0xd03020);
    for (let k = 0; k < 3; k++) {
      const tri = wedgeTri(cfg, k);
      const cx = (tri[0]![0] + tri[1]![0] + tri[2]![0]) / 3;
      const cy = (tri[0]![1] + tri[1]![1] + tri[2]![1]) / 3;
      const dg = lathe(rodProfile(0.015, 0, 0.004), 20);
      dg.rotateX(Math.PI / 2);
      const dot = mesh(dg, dotMat);
      dot.position.set(cx, cy, cfg.ZT[1] - 0.003);
      g.add(dot);
    }
  }

  // 태엽통
  const barGeo = lathe(tubeProfile(KK.HOLE, cfg.BAR.R, cfg.BAR.z0, cfg.BAR.z1, 0.004), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  g.add(barrel);
  g.userData.teethMat = teethMat;
  return g;
}

/** 원통 층 구성(z) — 294 는 앞뒤 온 관·앞 피벗이 있고, 295 는 위끝이 반 껍질 */
export interface CylLayers {
  cap: [number, number];
  /** 뒤 마개를 몸통과 따로 darkSteel 로 */
  capSeparate: boolean;
  tube1: [number, number] | null;
  pass: [number, number];
  shell: [number, number];
  tube2: [number, number] | null;
  front: [number, number] | null;
  pivot: [number, number] | null;
}

export const LAYERS294: CylLayers = {
  cap: [-0.2, -0.1],
  capSeparate: false,
  tube1: [-0.1, -0.02],
  pass: [-0.02, 0.035],
  shell: [0.035, 0.09],
  tube2: [0.09, 0.28],
  front: [0.28, 0.3],
  pivot: [0.3, 0.34]
};

/** 입술 판 폭(각) — 끝면에서 이만큼 안쪽을 껍질과 나눈다 */
const LIP_A = 4.5;

/** 반 껍질 윤곽(원통 좌표, C 원점) 전체 — 입술 판 포함 */
export function shellOutline(cfg: EscCfg): V2[] {
  return [...arc(cfg.RO, KK.BEV, KK.SHELL), ...arc(cfg.RI, KK.SHELL - KK.BEV, 0)];
}

/**
 * 원통(C 원점, ψ = 0). 몸통 메시 name `cylinder`, 입술 name `lipA`(입구, 주황)·`lipB`(출구, 파랑).
 * 입술 판은 껍질 끝에서 LIP_A° 만큼을 따로 떼어 색을 입힌 것 — 접촉 모양은 그대로, 끝면이 눈에 보인다.
 */
export function buildEscCylinder(cfg: EscCfg, L: CylLayers): THREE.Group {
  const g = new THREE.Group();
  g.name = 'cylinderGroup';
  const { RO, RI } = cfg;
  const ring = (z: [number, number]): THREE.BufferGeometry => slab(arc(RO, 0, 360).slice(0, -1), [circlePath(0, 0, RI)], z[0], z[1]);
  const geos: THREE.BufferGeometry[] = [];
  const disc = (z: [number, number], holeR: number): THREE.BufferGeometry =>
    slab(arc(RO, 0, 360).slice(0, -1), holeR > 0 ? [circlePath(0, 0, holeR)] : [], z[0], z[1]);

  const capGeo = disc(L.cap, KK.HOLE);
  if (L.capSeparate) {
    const cap = mesh(capGeo, darkSteel());
    cap.name = 'cylinderCap';
    g.add(cap);
  } else geos.push(capGeo);
  if (L.tube1) geos.push(ring(L.tube1));
  // 통로: PASS° 껍질만(줄기가 지나감) — 51°~141°
  const p0 = 51;
  const p1 = p0 + KK.PASS;
  geos.push(slab([...arc(RO, p0, p1), ...arc(RI, p1, p0)], [], L.pass[0], L.pass[1]));
  // 반 껍질(몸통) — 양끝 LIP_A° 는 입술 판으로 따로
  const a = LIP_A;
  const body: V2[] = [...arc(RO, KK.BEV + a, KK.SHELL - a), ...arc(RI, KK.SHELL - KK.BEV - a, a)];
  geos.push(slab(body, [], L.shell[0], L.shell[1]));
  if (L.tube2) geos.push(ring(L.tube2));
  if (L.front) geos.push(disc(L.front, 0));
  if (L.pivot) {
    const pg = lathe(rodProfile(0.02, L.pivot[0] - 0.002, L.pivot[1], 0, 0.004), 24);
    pg.rotateX(Math.PI / 2);
    geos.push(pg);
  }
  const body0 = mesh(merge(geos), steel());
  body0.name = 'cylinder';
  body0.userData.outline = shellOutline(cfg);
  g.add(body0);

  // 입술 판 — A(입구, L1 끝: 바깥 192° → 안 177°), B(출구, L2 끝: 안 0° → 바깥 15°)
  const plateA: V2[] = [...arc(RO, KK.SHELL - a, KK.SHELL), ...arc(RI, KK.SHELL - KK.BEV, KK.SHELL - KK.BEV - a)];
  const plateB: V2[] = [...arc(RI, a, 0), ...arc(RO, KK.BEV, KK.BEV + a)];
  const matA = paint(0xd06a10);
  const matB = paint(0x2a7fd0);
  const lipA = mesh(slab(plateA, [], L.shell[0], L.shell[1]), matA);
  lipA.name = 'lipA';
  const lipB = mesh(slab(plateB, [], L.shell[0], L.shell[1]), matB);
  lipB.name = 'lipB';
  g.add(lipA, lipB);
  g.userData.matA = matA;
  g.userData.matB = matB;
  return g;
}

/** 294 밸런스 테 — 고리 0.41~0.45 + 살 3(폭 0.04, 0.12~0.42). 원통 뒤 마개에 붙음. name `balanceRing` */
export function balanceRing294(): THREE.Mesh {
  const R = 0.45;
  const w = 0.02;
  const holes: THREE.Path[] = [circlePath(0, 0, KK.HOLE)];
  const base = 90;
  for (let j = 0; j < 3; j++) holes.push(gapHole(0.12, 0.41, base + 120 * j, base + 120 * (j + 1), w));
  const geo = slab(arc(R, 0, 360).slice(0, -1), holes, -0.198, -0.16);
  const m = mesh(geo, brass());
  m.name = 'balanceRing';
  return m;
}

export function cylWheel294(): THREE.Group {
  return buildEscWheel(CFG294, 'red');
}

export function cylinder294(): THREE.Group {
  const g = buildEscCylinder(CFG294, LAYERS294);
  g.add(balanceRing294());
  return g;
}
