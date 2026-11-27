// 298번 옛 회중시계 탈진기(왕관 바퀴·버지) 전용 키트 — 왕관 바퀴·버지·깃발 팔레트·균형 바퀴와 닫힌 접촉 식. 설계표 docs/mm507-sheets/298.md
// 299번(날개형)도 같은 계열이라 k299.ts 가 여기 공용 부분(escState·crownTeeth·plateHole)을 불러 쓴다.
import * as THREE from 'three';
import { brass, castIron, paint, steel } from '../../models/materials';
import { annularSector, circlePath, creased, extrude, lathe, merge, mesh, rodProfile, shapeFrom, tubeProfile, TAU } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { shaftZ } from './shaft';
import { wormScrew, wormWheel } from './gear2';

export const D2R = Math.PI / 180;

export const K298 = {
  CROWN: [0, 1.55, 0.27] as const,
  VERGE: [0.55, 0.27] as const,
  Z: 15,
  PITCH: 24,
  RO: 0.42,
  RI: 0.38,
  XTIP: 0.48,
  XROOT: 0.38,
  BACK: 16,
  D: 0.07,
  LP: 0.12,
  TF: 0.016,
  CH: 0.025,
  G0: 50,
  AMP: 30,
  PERIOD: 2,
  GREL: 58.2198,
  /** 깃발 단면(버지 묶음 좌표 x′, z′) */
  FLAG_U: [
    [-0.0061, -0.0051],
    [-0.0833, 0.0868],
    [-0.0549, 0.0779],
    [0.0061, 0.0051]
  ] as V2[],
  FLAG_L: [
    [-0.0061, 0.0051],
    [-0.0833, -0.0868],
    [-0.0549, -0.0779],
    [0.0061, -0.0051]
  ] as V2[],
  /** 표 기대값 [t, θ, φ] */
  EXPECT: [
    [0, 0, 9.7293],
    [0.05, 4.693, 11.6758],
    [0.1, 9.271, 18.798],
    [0.25, 21.213, 16.0049],
    [0.5, 30, 14.3149],
    [1.0, 0, 21.7293],
    [1.05, -4.693, 23.6758],
    [1.1, -9.271, 30.798],
    [1.5, -30, 26.3149],
    [2.0, 0, 33.7293],
    [30, 0, 369.7293]
  ] as [number, number, number][]
} as const;
const K = K298;

// ───────────────────────── 접촉 계산(공용) ─────────────────────────

/** 왕관 탈진기 한 벌의 치수 — 298(위·아래)·299(앞·뒤)가 같은 식을 쓴다 */
export interface EscParams {
  /** 이 바깥 반지름 */
  RO: number;
  /** 버지 축선 ↔ 톱니 끝 면 거리 */
  D: number;
  /** 팔레트 닿는 면 길이 */
  LP: number;
  /** 팔레트 두께 */
  TF: number;
  /** 쉼 자세 팔레트 각(아래·옆에서 잼) */
  G0: number;
  AMP: number;
  PERIOD: number;
  /** 이 간격(도) */
  P: number;
}

export interface EscState {
  theta: number;
  phi: number;
  /** 'A' = 첫째 팔레트(298 위, 299 앞), 'B' = 둘째(아래, 뒤) */
  holder: 'A' | 'B';
  justDropped: boolean;
}

/** 깃발 닿는 면이 톱니 끝 면을 지나는 가로 위치 — 버지 축선에서 잰다 */
const wDist = (p: EscParams, g: number): number => p.D * Math.tan(g) - p.TF / (2 * Math.cos(g));
/** 닿는 점이 깃발 위 어디인가(끝에서의 거리) */
const sAt = (p: EscParams, g: number): number => (p.D - (p.TF / 2) * Math.sin(g)) / Math.cos(g);

/** 팔레트 하나가 이를 잡는 이 앞면 각 α(도). 놓였으면 null. first = 첫째 팔레트(위·앞), 그 밖은 둘째 */
export function contactAlpha(p: EscParams, first: boolean, theta: number): number | null {
  const gdeg = first ? p.G0 + theta : p.G0 - theta;
  if (gdeg >= 89.9) return null;
  const g = gdeg * D2R;
  if (sAt(p, g) > p.LP) return null;
  const a = Math.asin(wDist(p, g) / p.RO) / D2R;
  return first ? a : 180 + a;
}

const relCache = new Map<string, number>();
/** 놓이는 팔레트 각 γ(도) — sAt = LP 가 되는 값(이분법) */
export function releaseGamma(p: EscParams): number {
  const key = `${p.D}|${p.LP}|${p.TF}|${p.G0}`;
  const hit = relCache.get(key);
  if (hit !== undefined) return hit;
  let a = p.G0;
  let b = 89.9;
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (sAt(p, m * D2R) > p.LP) b = m;
    else a = m;
  }
  relCache.set(key, b);
  return b;
}

/** 한 시각의 균형 바퀴(날개) 각·왕관 바퀴 각·걸린 팔레트(설계표 '동작' 1~4) */
export function escState(p: EscParams, t: number): EscState {
  const n = Math.floor(t / p.PERIOD + 1e-12);
  const tau = t - n * p.PERIOD;
  const theta = p.AMP * Math.sin(Math.PI * tau);
  let a: number | null;
  let k: number;
  let holder: 'A' | 'B';
  if (tau < 0.5) {
    a = contactAlpha(p, true, theta);
    k = 0;
    holder = 'A';
    if (a === null) {
      a = contactAlpha(p, false, theta);
      k = 7;
      holder = 'B';
    }
  } else if (tau < 1.5) {
    a = contactAlpha(p, false, theta);
    k = 7;
    holder = 'B';
    if (a === null) {
      a = contactAlpha(p, true, theta);
      k = -1;
      holder = 'A';
    }
  } else {
    a = contactAlpha(p, true, theta);
    k = -1;
    holder = 'A';
  }
  // 설계표대로면 일어나지 않는다(드롭 순간의 수치 경계만) — 반대쪽 팔레트로 한 번 더
  if (a === null) {
    const first = holder === 'B';
    a = contactAlpha(p, first, theta) ?? 0;
    k = first ? (tau < 0.5 ? 0 : -1) : 7;
    holder = first ? 'A' : 'B';
  }
  const phi = a - p.P * k + p.P * n;
  // 드롭: 놓이는 각에 이르는 때(첫 반 주기 τ1, 둘째 반 주기 1 + τ1) 뒤 0.1 초
  const gr = releaseGamma(p) - p.G0;
  const tau1 = Math.asin(Math.min(1, gr / p.AMP)) / Math.PI;
  const justDropped = (tau >= tau1 && tau < tau1 + 0.1) || (tau >= 1 + tau1 && tau < 1 + tau1 + 0.1);
  return { theta, phi, holder, justDropped };
}

const P298: EscParams = { RO: K.RO, D: K.D, LP: K.LP, TF: K.TF, G0: K.G0, AMP: K.AMP, PERIOD: K.PERIOD, P: K.PITCH };

export interface State298 {
  theta: number;
  phi: number;
  holder: 'upper' | 'lower';
  justDropped: boolean;
}

export function state298(t: number): State298 {
  const s = escState(P298, t);
  return { theta: s.theta, phi: s.phi, holder: s.holder === 'A' ? 'upper' : 'lower', justDropped: s.justDropped };
}

/** 위(upper)·아래 팔레트가 이 앞면을 막는 α(도) 또는 null(놓임) */
export function contact298(upper: boolean, theta: number): number | null {
  return contactAlpha(P298, upper, theta);
}

// ───────────────────────── 왕관 이(공용) ─────────────────────────

export interface ToothCfg {
  z: number;
  pitchDeg: number;
  backDeg: number;
  ri: number;
  ro: number;
  /** 이 뿌리·끝 축 방향 위치 */
  u0: number;
  u1: number;
  /** (축 위치 u, 각 α 라디안, 반지름 ρ) → 묶음 좌표 */
  map: (u: number, a: number, rho: number) => [number, number, number];
}

/**
 * 왕관 이 z 개 — 이 하나는 펼친 단면 (u, α): (u0, 0) → (u1, 0) → (u0, −back) 삼각형을 반지름 ri·ro 두 원통에 감아 앞뒤를 이은 덩이.
 * 앞면(α = α_k)은 축 방향으로 곧은 평면 — 팔레트가 닿는 면.
 */
export function crownTeeth(c: ToothCfg): THREE.BufferGeometry {
  const N = 6;
  const T0: V2 = [c.u0, 0];
  const T1: V2 = [c.u1, 0];
  const T2: V2 = [c.u0, -c.backDeg];
  const at = (q: V2, rho: number, a0: number): THREE.Vector3 => new THREE.Vector3(...c.map(q[0], (a0 + q[1]) * D2R, rho));
  const lerp = (a: V2, b: V2, s: number): V2 => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  const grid = (i: number, j: number): V2 => [T0[0] + (i / N) * (T1[0] - T0[0]) + (j / N) * (T2[0] - T0[0]), T0[1] + (i / N) * (T1[1] - T0[1]) + (j / N) * (T2[1] - T0[1])];
  const pos: number[] = [];
  for (let k = 0; k < c.z; k++) {
    const a0 = c.pitchDeg * k;
    const tris: THREE.Vector3[][] = [];
    // 안쪽·바깥 원통 면(삼각 격자)
    for (const rho of [c.ri, c.ro]) {
      for (let i = 0; i < N; i++) {
        for (let j = 0; i + j < N; j++) {
          tris.push([at(grid(i, j), rho, a0), at(grid(i + 1, j), rho, a0), at(grid(i, j + 1), rho, a0)]);
          if (i + j < N - 1) tris.push([at(grid(i + 1, j), rho, a0), at(grid(i + 1, j + 1), rho, a0), at(grid(i, j + 1), rho, a0)]);
        }
      }
    }
    // 옆면 셋: 앞면(T0→T1) · 등면(T1→T2) · 뿌리면(T2→T0)
    for (const [ea, eb] of [[T0, T1], [T1, T2], [T2, T0]] as [V2, V2][]) {
      for (let s = 0; s < N; s++) {
        const q0 = lerp(ea, eb, s / N);
        const q1 = lerp(ea, eb, (s + 1) / N);
        const A0 = at(q0, c.ri, a0);
        const A1 = at(q1, c.ri, a0);
        const B0 = at(q0, c.ro, a0);
        const B1 = at(q1, c.ro, a0);
        tris.push([A0, A1, B1], [A0, B1, B0]);
      }
    }
    // 바깥쪽이 앞면이 되게 — 덩이 무게중심에서 멀어지는 쪽으로
    const cen = new THREE.Vector3();
    let cnt = 0;
    for (const tr of tris) for (const p of tr) (cen.add(p), cnt++);
    cen.divideScalar(cnt);
    for (const tr of tris) {
      const n = tr[1]!.clone().sub(tr[0]!).cross(tr[2]!.clone().sub(tr[0]!));
      const mid = tr[0]!.clone().add(tr[1]!).add(tr[2]!).divideScalar(3).sub(cen);
      const t = n.dot(mid) < 0 ? [tr[0]!, tr[2]!, tr[1]!] : tr;
      for (const p of t) pos.push(p.x, p.y, p.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return creased(geo, 40);
}

/** 펼친 이 윤곽(userData.outline) — (축 위치, 둘레 길이 = α·ro) 톱날 한 줄을 닫은 다각형 */
export function toothOutline(c: ToothCfg): V2[] {
  const out: V2[] = [];
  const s = (deg: number): number => deg * D2R * c.ro;
  for (let k = 0; k < c.z; k++) {
    const a = c.pitchDeg * k;
    out.push([c.u0, s(a - c.backDeg)], [c.u1, s(a)], [c.u0, s(a)]);
  }
  out.push([c.u0 - 0.1, s(c.pitchDeg * (c.z - 1))], [c.u0 - 0.1, s(-c.backDeg)]);
  return out;
}

/** 직사각형(u0~u1 × v0~v1)에 둥근 구멍(hu, hv, 반지름 hr)을 뚫은 판을 두께 depth 로 압출(w 가운데 0) */
export function plateHole(u0: number, u1: number, v0: number, v1: number, hu: number, hv: number, hr: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(u0, v0);
  s.lineTo(u1, v0);
  s.lineTo(u1, v1);
  s.lineTo(u0, v1);
  s.closePath();
  s.holes.push(circlePath(hu, hv, hr));
  return extrude(s, depth, 0, 32);
}

// ───────────────────────── 왕관 바퀴 묶음 ─────────────────────────

const toothCfg298: ToothCfg = {
  z: K.Z,
  pitchDeg: K.PITCH,
  backDeg: K.BACK,
  ri: K.RI,
  ro: K.RO,
  u0: K.XROOT,
  u1: K.XTIP,
  map: (u, a, rho) => [u, rho * Math.cos(a), rho * Math.sin(a)]
};

/** 왕관 바퀴·축·웜·빨간 표시·축 칼라. 원점 = 축선 위 (0, 1.55, 0.27), 회전축 = 로컬 X. 몸통 메시 name `crownWheel`·`crownArbor`·`worm` */
export function crown298(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'crownGroup';
  // 판: 원판 반지름 0.42, x 0.28~0.32, 창 4
  const disc = new THREE.Shape();
  disc.absarc(0, 0, K.RO, 0, TAU, false);
  for (let j = 0; j < 4; j++) disc.holes.push(annularSector(0.12, 0.33, (90 * j + 15) * D2R, (90 * j + 75) * D2R));
  const discGeo = extrude(disc, 0.04, 0.002, 48);
  discGeo.rotateY(Math.PI / 2);
  discGeo.translate(0.3, 0, 0);
  // 테: 관 반지름 0.38~0.42, x 0.32~0.38
  const rimGeo = lathe(tubeProfile(K.RI, K.RO, 0.32, 0.38), 96);
  rimGeo.rotateZ(-Math.PI / 2);
  const wheelMat = brass();
  const wheel = mesh(merge([discGeo, rimGeo, crownTeeth(toothCfg298)]), wheelMat);
  wheel.name = 'crownWheel';
  wheel.userData.outline = toothOutline(toothCfg298);
  g.add(wheel);
  // 축: x −1.55 ~ 0.30(판 속에 0.02 박음)
  const arbGeo = lathe(rodProfile(0.035, -1.55, 0.3, 0.004, 0), 32);
  arbGeo.rotateZ(-Math.PI / 2);
  const arbor = mesh(arbGeo, steel());
  arbor.name = 'crownArbor';
  g.add(arbor);
  // 웜: 한 줄 오른나사(축 = x), x −0.85 중심
  const worm = wormScrew(0.0575, 0.17, Math.PI * 0.05, 0.4, { driver: true });
  worm.name = 'worm';
  worm.position.set(-0.85, 0, 0);
  g.add(worm);
  // 축 칼라 둘: 받침 바깥쪽에 0.004 띄움(축에 고정)
  for (const x0 of [-1.509, -0.211]) {
    const cg = lathe(tubeProfile(0.033, 0.055, x0, x0 + 0.02, 0.002), 32);
    cg.rotateZ(-Math.PI / 2);
    const col = mesh(cg, steel());
    col.name = 'arborCollar';
    g.add(col);
  }
  // 빨간 표시: 테 바깥 둘레 α = 90°(앞 +z), x 0.35
  const red = mesh(new THREE.BoxGeometry(0.05, 0.03, 0.004), paint(0xd03020));
  red.position.set(0.35, 0, 0.4215);
  g.add(red);
  g.userData.wheelMat = wheelMat;
  return g;
}

// ───────────────────────── 버지 묶음 ─────────────────────────

/** xz 단면(x′, z′)을 y y0~y1 로 압출한 깃발 — 버지 묶음 좌표 */
function flagMesh(pts: V2[], y0: number, y1: number, mat: THREE.Material, name: string): THREE.Mesh {
  const geo = extrude(shapeFrom(pts), y1 - y0, 0, 4);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, (y0 + y1) / 2, 0);
  const m = mesh(geo, mat);
  m.name = name;
  // 깃발 xz 단면은 userData.outline 으로 달지 않는다 — 위·아래 깃발이 높이가 달라도 단면은 같은 평면에서 겹쳐 보여 다각형 침범 검사가 거짓 불합격을 낸다
  m.userData.flagSection = pts;
  return m;
}

/** 버지·두 깃발 팔레트·균형 바퀴·빨간 표시. 원점 = (0.55, 0, 0.27), 회전축 = 로컬 Y. 몸통 메시 name `verge`·`palletUpper`·`palletLower`·`balanceWheel` */
export function verge298(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'vergeGroup';
  const vg = lathe(rodProfile(0.02, 0.9, 2.82, 0.003, 0.003), 24);
  const verge = mesh(vg, steel());
  verge.name = 'verge';
  g.add(verge);
  const mU = steel();
  const mL = steel();
  g.add(flagMesh(K.FLAG_U, 1.85, 2.02, mU, 'palletUpper'), flagMesh(K.FLAG_L, 1.08, 1.25, mL, 'palletLower'));
  // 균형 바퀴 C: 고리 0.44~0.48, y 2.60~2.64, 살 3, 허브 반지름 0.05
  const geos: THREE.BufferGeometry[] = [lathe(tubeProfile(0.44, 0.48, 2.6, 2.64, 0.003), 96), lathe(rodProfile(0.05, 2.58, 2.66, 0.006, 0.006), 32)];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.BoxGeometry(0.43, 0.036, 0.04);
    b.translate(0.255, 2.62, 0);
    b.rotateY(-i * 120 * D2R);
    geos.push(b);
  }
  const bal = mesh(merge(geos), brass());
  bal.name = 'balanceWheel';
  g.add(bal);
  const mark = mesh(new THREE.BoxGeometry(0.08, 0.004, 0.03), paint(0xd03020));
  mark.position.set(0.46, 2.6411, 0);
  g.add(mark);
  g.userData.matU = mU;
  g.userData.matL = mL;
  return g;
}

// ───────────────────────── 받침·웜 휠 ─────────────────────────

/** 받침 둘(arborPosts)·버지 받침 둘·웜 휠(+허브·태엽통)·웜 휠 축. 세계 좌표. userData.wormSpin = 웜 휠 돌리는 묶음(원점 = 웜 휠 축선), wormWheelMat */
export function frame298(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'frame298';
  // 왕관 바퀴 축 받침 2: x −1.485~−1.415 · −0.285~−0.215, y 1.48~1.62, z −0.301~0.33, 구멍 반지름 0.037(y 1.55, z 0.27)
  const posts: THREE.BufferGeometry[] = [];
  for (const xc of [-1.45, -0.25]) {
    const pg = plateHole(-0.06, 0.571, -0.07, 0.07, 0, 0, 0.037, 0.07);
    pg.rotateY(Math.PI / 2);
    pg.translate(xc, 1.55, 0.27);
    posts.push(pg);
  }
  const arborPosts = mesh(merge(posts), castIron());
  arborPosts.name = 'arborPosts';
  g.add(arborPosts);
  // 버지 받침: 구멍은 버지 끝이 0.02 들어가는 막힌 구멍(깊이 0.022 — 끝과 0.002 틈)
  const vergeBlock = (yLo: number, yHi: number, holeFromTop: boolean, name: string): void => {
    const slabLo = holeFromTop ? yHi - 0.022 : yLo;
    const slab = plateHole(0.5, 0.6, -0.301, 0.31, 0.55, 0.27, 0.022, 0.022);
    slab.rotateX(Math.PI / 2);
    slab.translate(0, slabLo + 0.011, 0);
    const solidLo = holeFromTop ? yLo : yLo + 0.022;
    const solidHi = holeFromTop ? yHi - 0.022 : yHi;
    const solid = new THREE.BoxGeometry(0.1, solidHi - solidLo, 0.611);
    solid.translate(0.55, (solidLo + solidHi) / 2, 0.0045);
    const m = mesh(merge([slab, solid]), castIron());
    m.name = name;
    g.add(m);
  };
  vergeBlock(0.86, 0.92, true, 'vergeFoot');
  vergeBlock(2.8, 2.86, false, 'vergeCock');

  // 웜 휠 축(뒤판 보스에서 앞 너트까지)
  g.add(shaftZ(-0.85, 0.93, 0.4, 0.04));
  const spin = new THREE.Group();
  spin.name = 'wormSpin';
  spin.position.set(-0.85, 0.93, 0);
  g.add(spin);
  const wheel = wormWheel(20, 0.05, { width: 0.08, tanLead: -0.2083 });
  wheel.name = 'wormWheelAsm';
  wheel.position.z = 0.27;
  const body = wheel.children[0];
  if (body) body.name = 'wormWheel';
  spin.add(wheel);
  // 축에 끼운 관: 태엽통 앞면(−0.08) 속 → 휠 허브 구멍 → 허브 앞 칼라 → 너트(0.364) 앞 0.002
  const sleeveGeo = lathe(
    [
      [0.042, -0.082],
      [0.0705, -0.082],
      [0.0705, 0.31],
      [0.08, 0.31],
      [0.08, 0.362],
      [0.042, 0.362],
      [0.042, -0.082]
    ],
    40
  );
  sleeveGeo.rotateX(Math.PI / 2);
  const sleeve = mesh(sleeveGeo, steel());
  sleeve.name = 'wheelSleeve';
  spin.add(sleeve);
  // 태엽통(웜 휠과 함께 돎): z −0.19~−0.08
  const barGeo = lathe(tubeProfile(0.042, 0.4, -0.19, -0.08, 0.004), 64);
  barGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barGeo, steel());
  barrel.name = 'barrel';
  spin.add(barrel);
  const yel = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.004), paint(0xf2b619));
  yel.position.set(0.25, 0, -0.079);
  spin.add(yel);
  g.userData.wormSpin = spin;
  return g;
}
