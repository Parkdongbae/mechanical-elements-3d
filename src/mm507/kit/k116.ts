// 116·117·118번 전용 키트
//   116 크랭크 대신 쓰는 이중 랙 — 두 평면의 랙이 달린 틀, 축 위에서 헐겁게 도는 피니언 둘, 래칫 바퀴 둘과 폴, 주기 시간표
//   117 요크 안의 캠과 롤러 — 지름이 일정한 캠(피치 곡선 ρ(α) + ρ(α + π) = L), 롤러 요크, 안내
//   118 행정을 두 배로 — 고정 랙(받침대), 구르는 피니언, 안내봉에 매달린 윗랙, 크랭크·연결봉·뒤 안내 레일
// 순수 계산 함수(state…, …Outline, …Lift)는 three 물체를 만들지 않는다 → shots/_verify/s116.mjs 가 번들로 불러 침범을 잰다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, lathe, loft, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  return meshAt(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}
/** Z축 원기둥(z0~z1) */
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** Y축 원기둥(y0~y1) */
function cylY(r: number, y0: number, y1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  return lathe(rodProfile(r, y0, y1, c, c), segs);
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}
/** 스타디움 다각형(가로로 누운 것): 직선부 반길이 half, 끝 반지름 r. 반시계 */
function stadium(half: number, r: number, n = 20, cx = 0, cy = 0): V2[] {
  return [...arc(cx + half, cy, r, -Math.PI / 2, Math.PI / 2, n), ...arc(cx - half, cy, r, Math.PI / 2, Math.PI * 1.5, n)];
}
const rot2 = (p: V2, a: number): V2 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const pmod = (a: number, m: number): number => ((a % m) + m) % m;

/** 점이 다각형 안인가 */
export function inPoly116(p: V2, poly: readonly V2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as V2;
    const [xj, yj] = poly[j] as V2;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ════════════════════════════ 공용: 랙 빗 윤곽 · 피니언 · 안내 블록 ════════════════════════════

/**
 * 랙의 이 윤곽(빗 모양 다각형, 반시계). 로컬 원점 = 피치선 위의 랙 가운데. 이 k 의 중심 x = (k − (teeth − 1)/2)·πm
 * (잇수가 홀수면 x = 0 에 이, 짝수면 x = 0 에 이골). up = false: 이가 아래(−y)를 향함(피니언 위의 랙), true: 위(+y)를 향함.
 * 이끝 = 피치선에서 m, 이뿌리 = 1.25m, 압력각 20°. 이뿌리선 뒤로 back 만큼의 띠가 붙는다(몸통에 묻히는 부분).
 */
export function rackOutline116(teeth: number, module: number, up: boolean, back = 0.03, endPad = 0.02): V2[] {
  const p = Math.PI * module;
  const hp = (p / 4) * 0.94; // 피치선에서의 반 두께(백래시 조금)
  const ht = hp - module * Math.tan(20 * DEG);
  const hr = hp + 1.25 * module * Math.tan(20 * DEG);
  const yTip = -module;
  const yRoot = 1.25 * module;
  const xL = -((teeth - 1) / 2) * p - hr - endPad;
  const pts: V2[] = [
    [xL, yRoot + back],
    [xL, yRoot]
  ];
  for (let k = 0; k < teeth; k++) {
    const c = (k - (teeth - 1) / 2) * p;
    pts.push([c - hr, yRoot], [c - ht, yTip], [c + ht, yTip], [c + hr, yRoot]);
  }
  pts.push([-xL, yRoot], [-xL, yRoot + back]);
  return up ? pts.map(([x, y]): V2 => [x, -y]).reverse() : pts;
}

/** 피니언 이 윤곽(인벌류트, 반시계). 각 0 에 이골(spurGear 와 같은 위상) */
export function pinionOutline116(teeth: number, module: number): V2[] {
  const rp = (teeth * module) / 2;
  return involuteOutline(teeth, rp + module, rp - 1.25 * module, Math.PI / teeth);
}

export interface Pinion116Opts {
  width?: number;
  /** 축 구멍 반지름 */
  bore?: number;
  driver?: boolean;
  /** true 면 userData.outline 을 남긴다(같은 평면에 물리는 랙만 있을 때) */
  outline?: boolean;
  /** 앞면에 둥근 구멍(무게 줄임 구멍) 수 — 회전이 보이게 */
  holes?: number;
}

/**
 * 민판 피니언(축 구멍 bore). 회전축 = 로컬 Z, 원점 중심, 각 0 에 이골. userData.mm = gear.
 * 앞면에 노란 표시점 하나.
 */
export function pinion116(teeth: number, module: number, o: Pinion116Opts = {}): THREE.Group {
  const w = o.width ?? 0.09;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const bore = o.bore ?? 0.05;
  const c = Math.min(module * 0.3, w * 0.14);
  const outline = pinionOutline116(teeth, module);
  const holes: V2[][] = [circlePts(bore, 32)];
  const nh = o.holes ?? 0;
  const rh = (bore + rf) / 2;
  const hr = Math.min((rf - bore) * 0.26, 0.05);
  for (let i = 0; i < nh; i++) {
    const a = ((i + 0.5) / nh) * TAU;
    holes.push(circlePts(hr, 20, rh * Math.cos(a), rh * Math.sin(a)));
  }
  const g = new THREE.Group();
  const layers = [
    { z: -w / 2, s: (ra - c) / ra, hs: 1 },
    { z: -w / 2 + c, s: 1, hs: 1 },
    { z: w / 2 - c, s: 1, hs: 1 },
    { z: w / 2, s: (ra - c) / ra, hs: 1 }
  ];
  g.add(mesh(loft(outline, holes, layers), o.driver === true ? bronze({ roughness: 0.34 }) : brass()));
  g.add(box(Math.max(0.03, (rf - bore) * 0.45), 0.016, 0.008, paint(MARK), (bore + rf) / 2, 0, w / 2 + 0.003));
  if (o.outline === true) g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'pinion116', teeth, module, internal: false, rp, ra, rf, width: w, axis: 'z' });
  return g;
}

export interface SlideGuide116Opts {
  /** 막대 방향의 블록 길이 */
  len?: number;
  /** 구멍 둘레 살 두께 */
  wall?: number;
  /** 블록의 깊이(z) 크기 — 네모 구멍일 때만. 기본 = 구멍 깊이 + 2·wall */
  wide?: number;
  /** 네모 구멍일 때 막대와 직각인 가로 방향으로 블록을 넓힌다(판 모양 안내) */
  span?: number;
}

/**
 * 뒤판에서 나온 미끄럼 안내 블록. 원점 = 구멍 중심(모델이 position 으로 (x, y, zc) 에 둔다 — zc 는 세 번째 인자와 같아야 한다).
 * axis = 지나가는 막대의 방향('x' | 'y'). hole = 숫자(둥근 구멍 반지름) | { w, d }(막대와 직각인 화면 안 방향 w × 깊이 d 의 네모 구멍).
 * 구멍은 막대 방향으로 뚫려 있고, 팔은 블록의 뒷면에서 뒤판(z = STAGE.backZ)까지 뻗는다(막대에 박히지 않는다).
 */
export function slideGuide116(axis: 'x' | 'y', hole: number | { w: number; d: number }, zc: number, o: SlideGuide116Opts = {}): THREE.Group {
  const g = new THREE.Group();
  const body = castIron();
  const len = o.len ?? 0.1;
  const t = o.wall ?? 0.035;
  const back = STAGE.backZ - zc; // 로컬 z 로 본 뒤판 앞면
  let rearZ: number; // 블록 뒷면의 로컬 z
  let across: number; // 막대와 직각(화면 안) 방향의 블록 바깥 크기
  const put = (m: THREE.Mesh): void => {
    if (axis === 'y') {
      // 로컬 (막대 방향 = x, 가로 = y) → (막대 방향 = y, 가로 = x)
      const p = m.position.clone();
      m.position.set(-p.y, p.x, p.z);
      m.rotation.z = Math.PI / 2;
    }
    g.add(m);
  };
  if (typeof hole === 'number') {
    const ro = hole + t;
    put(mesh(lathe(tubeProfile(hole, ro, -len / 2, len / 2, 0.006), 36).rotateZ(-Math.PI / 2), darkSteel()));
    rearZ = -ro * 0.8;
    across = ro * 2;
  } else {
    const span = o.span ?? hole.w + 2 * t;
    const sideT = (span - hole.w) / 2;
    const depth = o.wide ?? hole.d + 2 * t;
    const zt = (depth - hole.d) / 2;
    put(box(len, sideT, depth, body, 0, hole.w / 2 + sideT / 2, 0));
    put(box(len, sideT, depth, body, 0, -hole.w / 2 - sideT / 2, 0));
    put(box(len, hole.w, zt, body, 0, 0, hole.d / 2 + zt / 2));
    put(box(len, hole.w, zt, body, 0, 0, -hole.d / 2 - zt / 2));
    rearZ = -depth / 2;
    across = span;
  }
  // 팔 + 벽판
  const armLen = rearZ - back - 0.03;
  const aw = Math.min(0.09, across * 0.8);
  if (armLen > 0.005) put(box(Math.min(len, 0.08), aw, armLen, body, 0, 0, back + 0.03 + armLen / 2));
  put(box(Math.max(len + 0.08, 0.18), Math.max(across, 0.18), 0.03, body, 0, 0, back + 0.015));
  setMM(g, { kind: 'guide', axis, hole: typeof hole === 'number' ? hole : [hole.w, hole.d] });
  return g;
}

// ════════════════════════════ 116 크랭크 대신 쓰는 이중 랙 ════════════════════════════

/**
 * 116 치수. 좌표 원점 = 피니언 축 중심(정면 xy). 앞 평면 zF 에 윗랙 + 앞 피니언 + (그 앞) 앞 래칫,
 * 뒤 평면 zR 에 아랫랙 + 뒤 피니언 + (그 뒤) 뒤 래칫.
 */
export const K116 = (() => {
  const Z = 12;
  const MOD = 0.05;
  const RP = (Z * MOD) / 2;
  /** 래칫 잇수 */
  const N = 8;
  const PITCH = TAU / N;
  /** 틀의 반 행정: 한 행정에 피니언이 90°(= 래칫 2피치) 돈다 → 헛도는 행정에서 폴이 정확히 4피치를 넘는다 */
  const A = (RP * Math.PI) / 4;
  const shaftR = 0.07;
  const rRoot = 0.105;
  const rOut = 0.15;
  /** 폴 끝면 가운데가 닿는 반지름, 끝면 반폭 */
  const rT = 0.1295;
  const tipHalf = 0.0185;
  /** 폴 받침 핀(피니언 면 위)의 반지름·각 */
  const pivotR = 0.2;
  const pivotA = 135 * DEG;
  const pawlLen = Math.sqrt(pivotR * pivotR - rT * rT);
  /** 폴 끝면이 놓이는 각(피니언 기준) */
  const tipA = pivotA - Math.atan2(pawlLen, rT);
  /** 래칫 이 면(반지름 방향 면)의 각 — 폴 끝면과 0.0015 틈 */
  const faceA = tipA - 0.0015 / rT;
  return {
    Z,
    MOD,
    RP,
    N,
    PITCH,
    A,
    shaftR,
    rRoot,
    rOut,
    rT,
    tipHalf,
    pivotR,
    pivotA,
    pawlLen,
    tipA,
    faceA,
    /** 랙 하나의 잇수(홀수 — 가운데에 이) */
    rackTeeth: 9,
    /** 창(안쪽 구멍)의 직선부 반길이, 틀 살 두께 */
    winHalf: 0.7,
    rim: 0.1,
    /** 앞·뒤 평면의 z, 랙·피니언 폭, 래칫 폭, 래칫이 제 피니언에서 떨어진 거리 */
    zF: 0.14,
    zR: 0,
    width: 0.09,
    ratchetW: 0.06,
    ratchetOff: 0.09,
    /** 양끝 막대가 틀 가운데에서 뻗는 끝(로컬 x) */
    stubEnd: 1.9,
    /** 구동 위상: u = SPEED·(theta − T0) + π/2 → t = 1(theta = 1.6)에 틀이 가운데(판화 자세) */
    SPEED: 2,
    T0: 1.6
  } as const;
})();

/** 래칫 바퀴 윤곽(반시계). 이 면(반지름 방향)은 faceA + k·PITCH, 면의 시계 쪽이 살 → 폴이 시계 방향으로 민다. 등은 곧은 선 */
export function ratchetOutline116(): V2[] {
  const pts: V2[] = [];
  for (let k = 0; k < K116.N; k++) {
    const a = K116.faceA + k * K116.PITCH;
    pts.push([K116.rOut * Math.cos(a), K116.rOut * Math.sin(a)], [K116.rRoot * Math.cos(a), K116.rRoot * Math.sin(a)]);
  }
  return pts;
}

/** 폴 윤곽(폴 로컬: 원점 = 받침 핀, +x = 끝면 쪽, +y = 바깥쪽). 끝면은 x = pawlLen 의 곧은 면 */
export function pawlOutline116(): V2[] {
  const e = 0.03;
  const a0 = Math.asin(K116.tipHalf / e); // 막대 양쪽 가장자리가 끝면까지 나란하다(안쪽 가장자리가 다음 이끝을 스치지 않게)
  return [[K116.pawlLen, -K116.tipHalf], [K116.pawlLen, K116.tipHalf], ...arc(0, 0, e, a0, TAU - a0, 14)];
}

/** 폴의 자세(피니언 로컬): 받침 핀 자리와, 들림 0 일 때의 방향각 */
export function pawlPose116(): { pivot: V2; dir: number } {
  return { pivot: [K116.pivotR * Math.cos(K116.pivotA), K116.pivotR * Math.sin(K116.pivotA)], dir: K116.tipA - Math.PI / 2 };
}

function densify(poly: readonly V2[], step: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as V2;
    const b = poly[(i + 1) % poly.length] as V2;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

let liftTable: number[] | null = null;
const LIFT_N = 180;
function buildLift(): number[] {
  const ratchet = ratchetOutline116();
  const tips = ratchet.filter((_, i) => i % 2 === 0);
  const pawl = pawlOutline116();
  const dense = densify(pawl, 0.004);
  const { pivot, dir } = pawlPose116();
  /** 래칫에 대한 피니언의 상대각 psi, 폴 들림 gamma 에서 겹치는가 */
  const hit = (psi: number, gamma: number): boolean => {
    const place = (p: V2): V2 => {
      const q = rot2(p, dir + gamma);
      return rot2([q[0] + pivot[0], q[1] + pivot[1]], psi);
    };
    for (const p of dense) if (inPoly116(place(p), ratchet)) return true;
    const poly = pawl.map(place);
    for (const t of tips) if (inPoly116(t, poly)) return true;
    return false;
  };
  const out: number[] = [];
  for (let i = 0; i <= LIFT_N; i++) {
    const psi = i === LIFT_N ? K116.PITCH - 1e-7 : (i / LIFT_N) * K116.PITCH;
    if (!hit(psi, 0)) {
      out.push(0);
      continue;
    }
    let lo = 0;
    let hi = 0;
    for (let s = 1; s <= 120; s++) {
      hi = s * 0.01;
      if (!hit(psi, hi)) break;
      lo = hi;
    }
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2;
      if (hit(psi, mid)) lo = mid;
      else hi = mid;
    }
    out.push(hi + 0.004);
  }
  return out;
}

/**
 * 폴 들림 각(rad, ≥ 0): psi = 피니언 각 − 래칫 각. psi ≡ 0 (mod PITCH) 이면 폴이 이 면에 걸린 자리(들림 0),
 * psi 가 커지면(피니언이 래칫보다 반시계로 앞서면 = 헛돌면) 이의 등을 타고 올랐다가 PITCH 에서 다음 이골로 떨어진다.
 */
export function pawlLift116(psi: number): number {
  if (liftTable === null) liftTable = buildLift();
  const f = (pmod(psi, K116.PITCH) / K116.PITCH) * LIFT_N;
  const i = Math.min(LIFT_N - 1, Math.floor(f));
  const l0 = liftTable[i] ?? 0;
  const l1 = liftTable[i + 1] ?? l0;
  return l0 + (l1 - l0) * (f - i);
}

export interface State116 {
  /** 틀의 x(축 기준, ±A) */
  x: number;
  /** 축(과 두 래칫)의 각 — 늘 줄어든다(시계 방향) */
  shaft: number;
  /** 앞 피니언(윗랙)·뒤 피니언(아랫랙)의 각 */
  pinF: number;
  pinR: number;
  /** 두 폴의 들림 각 */
  liftF: number;
  liftR: number;
  /** 지금 축을 돌리는 피니언 */
  drive: 'F' | 'R';
  /** 지나온 행정 수(소수) */
  strokes: number;
}

/**
 * 116 한 주기 시간표(theta 의 닫힌 식 — 누적 없음).
 * 틀 x = −A·cos u (u = SPEED·(theta − T0) + π/2). 짝수 행정(오른쪽으로)은 앞 피니언이, 홀수 행정(왼쪽으로)은 뒤 피니언이 축을 시계 방향으로 돌린다.
 * 축 각 = −(틀이 움직인 총 거리)/RP.
 */
export function state116(theta: number): State116 {
  const { A, RP, PITCH } = K116;
  const u = K116.SPEED * (theta - K116.T0) + Math.PI / 2;
  const k = Math.floor(u / Math.PI);
  const up = u - k * Math.PI;
  const even = pmod(k, 2) === 0;
  const x = -A * Math.cos(u);
  const path = 2 * A * k + A * (1 - Math.cos(up));
  const shaft = -path / RP;
  const pinF = -x / RP;
  const pinR = x / RP;
  // 미는 쪽은 상대각이 정확히 PITCH 의 배수(식으로 0) — 반올림 잡음이 들림으로 번지지 않게 0 으로 둔다
  const liftF = even ? 0 : pawlLift116(pmod(pinF - shaft, PITCH));
  const liftR = even ? pawlLift116(pmod(pinR - shaft, PITCH)) : 0;
  return { x, shaft, pinF, pinR, liftF, liftR, drive: even ? 'F' : 'R', strokes: u / Math.PI };
}

/** 래칫 바퀴: 원점 = 축, 로컬 Z 축. rotation.z = state116().shaft. userData.outline = 윤곽 */
export function ratchet116(): THREE.Group {
  const g = new THREE.Group();
  const outline = ratchetOutline116();
  const s = shapeFrom(outline);
  s.holes.push(circlePath(0, 0, K116.shaftR - 0.002));
  g.add(mesh(extrude(s, K116.ratchetW, 0.004), steel()));
  g.add(box(0.02, 0.012, 0.008, paint(MARK), (K116.shaftR + K116.rRoot) / 2 + 0.004, 0, K116.ratchetW / 2 + 0.002));
  g.userData.outline = outline;
  setMM(g, { kind: 'ratchet', teeth: K116.N, rOut: K116.rOut, rRoot: K116.rRoot });
  return g;
}

export interface LoosePinion116 {
  /** 피니언(회전: rotation.z = pinF 또는 pinR) */
  group: THREE.Group;
  /** 폴(피니언의 자식, rotation.z = pawlBase + 들림) */
  pawl: THREE.Group;
  /** 들림 0 일 때 폴의 rotation.z */
  pawlBase: number;
}

/**
 * 축 위에서 헐겁게 도는 피니언 + 받침 핀 + 폴. side = +1: 폴이 앞면(+z) 쪽 래칫 평면에, −1: 뒷면 쪽.
 * 폴은 group 의 자식(name 'pawl')이라 피니언을 따라 돈다. 모델은 pawl.rotation.z = pawlBase + lift 만 넣는다.
 */
export function loosePinion116(side: 1 | -1): LoosePinion116 {
  const group = pinion116(K116.Z, K116.MOD, { width: K116.width, bore: K116.shaftR + 0.004, holes: 0 });
  const { pivot, dir } = pawlPose116();
  const zP = side * K116.ratchetOff;
  // 받침 핀(피니언 면에서 폴 평면까지)
  const z0 = side > 0 ? K116.width / 2 - 0.01 : zP - 0.03;
  const z1 = side > 0 ? zP + 0.03 : -K116.width / 2 + 0.01;
  group.add(meshAt(cylZ(0.014, z0, z1, 0.003, 16), darkSteel(), pivot[0], pivot[1], 0));
  const pawl = new THREE.Group();
  pawl.name = 'pawl';
  const outline = pawlOutline116();
  const s = shapeFrom(outline);
  s.holes.push(circlePath(0, 0, 0.014));
  pawl.add(mesh(extrude(s, 0.04, 0.003), darkSteel()));
  pawl.position.set(pivot[0], pivot[1], zP);
  pawl.rotation.z = dir;
  pawl.userData.outline = outline;
  setMM(pawl, { kind: 'pawl', length: K116.pawlLen });
  group.add(pawl);
  return { group, pawl, pawlBase: dir };
}

/**
 * 이중 랙 틀: 원점 = 창 가운데(가운데 자리에서 축과 겹침), 로컬 z = 0 이 뒤 평면(zR).
 * 길쭉한 고리(두 평면을 다 덮는 두께) + 윗랙(앞 평면 zF 에만) + 아랫랙(뒤 평면 zR 에만) + 왼쪽 네모 막대·오른쪽 둥근 막대.
 * userData.outlines = { rackUpper, rackLower } (빗 윤곽 — 침범 검사용)
 */
export function doubleRackFrame116(): THREE.Group {
  const g = new THREE.Group();
  const { RP, MOD, winHalf, rim, zF, zR, width } = K116;
  const hw = RP + 1.25 * MOD; // 창의 반 높이 = 이뿌리선
  const zMid = (zF + zR) / 2;
  const thick = zF - zR + width + 0.01;
  const ring = shapeFrom(stadium(winHalf, hw + rim, 24));
  ring.holes.push(pathFrom(stadium(winHalf, hw, 24).reverse()));
  g.add(meshAt(extrude(ring, thick, 0.008), bronze({ roughness: 0.36 }), 0, 0, zMid));
  const up = rackOutline116(K116.rackTeeth, MOD, false).map(([x, y]): V2 => [x, y + RP]);
  const lo = rackOutline116(K116.rackTeeth, MOD, true).map(([x, y]): V2 => [x, y - RP]);
  g.add(meshAt(extrude(shapeFrom(up), width, 0.003), brass(), 0, 0, zF));
  g.add(meshAt(extrude(shapeFrom(lo), width, 0.003), brass(), 0, 0, zR));
  // 양끝 막대
  const xo = winHalf + hw + rim;
  g.add(box(K116.stubEnd - xo + 0.02, 0.09, 0.09, steel(), -(xo - 0.02 + K116.stubEnd) / 2, 0, zMid));
  const neck = lathe(
    [
      [0, 0],
      [0.085, 0],
      [0.045, 0.1],
      [0.045, K116.stubEnd - xo + 0.02],
      [0, K116.stubEnd - xo + 0.02]
    ],
    28
  );
  neck.rotateZ(-Math.PI / 2);
  g.add(meshAt(neck, steel(), xo - 0.02, 0, zMid));
  g.userData.outlines = { rackUpper: up, rackLower: lo };
  setMM(g, { kind: 'rackFrame', pitch: Math.PI * MOD, teeth: K116.rackTeeth });
  return g;
}

// ════════════════════════════ 117 요크 안의 캠과 롤러 ════════════════════════════

/** 117 치수. 좌표 원점 = 캠 축 중심. 캠·롤러는 같은 평면(로컬 z = 0) */
export const K117 = {
  /** 롤러 반지름 */
  rr: 0.12,
  /** 캠의 가장 작은 반지름, 들림(= 요크 행정) */
  rMin: 0.25,
  lift: 0.28,
  /** 가장 높은 자리·낮은 자리에서 머무는 각(반 바퀴 가운데의 비율) */
  dwell: 0.225,
  shaftR: 0.12,
  /** 캠·롤러 폭 */
  camW: 0.1,
  /** 요크: 가로대 반폭·높이·깊이 반, 가로대 안쪽 면까지(요크 가운데에서) */
  barHalf: 0.36,
  barH: 0.1,
  barDepth: 0.2,
  barIn: 0.68,
  /** 옆 막대: x, 앞·뒤 z, 반지름, 가운데 굵은 마디 반지름·길이 */
  rodX: 0.26,
  rodZ: 0.16,
  rodR: 0.028,
  sleeveR: 0.05,
  sleeveLen: 0.36,
  /** 위·아래 막대(스템) 반지름·길이 */
  stemR: 0.05,
  stemTop: 0.5,
  stemBottom: 0.56
} as const;

/** 롤러 중심이 그리는 피치 곡선의 최소·최대 반지름, 두 롤러 중심 사이 거리 L */
export const K117_RHO = { min: K117.rMin + K117.rr, max: K117.rMin + K117.rr + K117.lift, L: 2 * (K117.rMin + K117.rr) + K117.lift } as const;

/**
 * 피치 곡선 ρ(α) (캠 로컬 극좌표, α 는 +x 에서 반시계). ρ(α) + ρ(α + π) = L 이라 두 롤러가 늘 함께 닿는다.
 * α = 90° 에서 최소(판화 자세: 위 롤러가 가장 낮음), 270° 에서 최대. 최대·최소 뒤로 dwell·180° 만큼 머문 뒤 코사인 곡선으로 넘어간다
 * → 0°(오른쪽) 반지름이 180°(왼쪽)보다 큰, 판화처럼 한쪽으로 불룩한 꼴.
 */
export function camPitch117(alpha: number): number {
  const w = pmod(alpha - 1.5 * Math.PI, TAU) / Math.PI; // 0..2
  const S = (v: number): number => (v < K117.dwell ? 0 : (1 - Math.cos((Math.PI * (v - K117.dwell)) / (1 - K117.dwell))) / 2);
  const g = w < 1 ? 1 - S(w) : S(w - 1);
  return K117_RHO.min + K117.lift * g;
}

/** 캠 윤곽(반시계) = 피치 곡선을 안쪽으로 롤러 반지름만큼 물린 곡선 */
export function camOutline117(n = 720): V2[] {
  const out: V2[] = [];
  const P = (a: number): V2 => {
    const r = camPitch117(a);
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  const h = 1e-4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const p = P(a);
    const p1 = P(a + h);
    const p0 = P(a - h);
    const tx = p1[0] - p0[0];
    const ty = p1[1] - p0[1];
    const tl = Math.hypot(tx, ty);
    out.push([p[0] - (K117.rr * ty) / tl, p[1] + (K117.rr * tx) / tl]);
  }
  return out;
}

/** 캠 각 c(rotation.z)일 때 요크 가운데의 높이(축 기준): 위 롤러 중심 높이 − L/2. 범위 ±lift/2 */
export function yokeLift117(c: number): number {
  return camPitch117(Math.PI / 2 - c) - K117_RHO.L / 2;
}

let rhoInt: number[] | null = null;
const RHO_N = 720;
/** ∫0..α ρ dα (주기 연장: 한 바퀴에 π·L) */
function rhoIntegral(alpha: number): number {
  if (rhoInt === null) {
    rhoInt = [0];
    const d = TAU / RHO_N;
    let acc = 0;
    for (let i = 0; i < RHO_N; i++) {
      acc += ((camPitch117(i * d) + camPitch117((i + 1) * d)) / 2) * d;
      rhoInt.push(acc);
    }
  }
  const turns = Math.floor(alpha / TAU);
  const f = ((alpha - turns * TAU) / TAU) * RHO_N;
  const i = Math.min(RHO_N - 1, Math.floor(f));
  const r0 = rhoInt[i] ?? 0;
  const r1 = rhoInt[i + 1] ?? r0;
  return turns * (rhoInt[RHO_N] ?? 0) + r0 + (r1 - r0) * (f - i);
}

/** 롤러의 회전각(구름 — 닿는 자리의 캠 둘레 속도를 따라감, 어림). top = 위 롤러. 캠이 반시계면 둘 다 시계 방향 */
export function rollerTurn117(c: number, top: boolean): number {
  const a0 = top ? Math.PI / 2 : 1.5 * Math.PI;
  const swept = rhoIntegral(a0) - rhoIntegral(a0 - c); // ∫ ρ dc
  return -(swept - K117.rr * c) / K117.rr;
}

/** 캠: 원점 = 축, 로컬 Z 축, rotation.z = c. userData.outline = 윤곽 */
export function valveCam117(): THREE.Group {
  const g = new THREE.Group();
  const outline = camOutline117();
  const s = shapeFrom(outline);
  s.holes.push(circlePath(0, 0, K117.shaftR - 0.002));
  g.add(mesh(extrude(s, K117.camW, 0.006, 8), bronze({ roughness: 0.34 })));
  g.add(mesh(tubeZ(K117.shaftR - 0.002, K117.shaftR + 0.045, -K117.camW / 2 - 0.02, K117.camW / 2 + 0.02), darkSteel()));
  // 표시: 가장 큰 반지름 쪽(로컬 −y)으로 노란 줄
  g.add(box(0.016, 0.2, 0.008, paint(MARK), 0, -(K117.shaftR + 0.045 + 0.12), K117.camW / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', rMin: K117.rMin, rMax: K117.rMin + K117.lift, constantDiameter: K117_RHO.L - 2 * K117.rr });
  return g;
}

function roller117(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(tubeZ(0.03, K117.rr, -K117.camW / 2, K117.camW / 2, 0.008, 48), steel()));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    g.add(meshAt(cylZ(0.016, K117.camW / 2 - 0.002, K117.camW / 2 + 0.004, 0.001, 12), paint(MARK), 0.075 * Math.cos(a), 0.075 * Math.sin(a), 0));
  }
  g.userData.outline = circlePts(K117.rr, 64);
  setMM(g, { kind: 'roller', r: K117.rr, width: K117.camW });
  return g;
}

export interface RollerYoke117 {
  /** 요크 전체(위아래로만 움직인다: position.y = 축 높이 + yokeLift117(c)) */
  group: THREE.Group;
  /** 위·아래 롤러(group 의 자식, rotation.z = rollerTurn117) */
  rollerTop: THREE.Group;
  rollerBottom: THREE.Group;
}

/**
 * 롤러 요크: 원점 = 두 롤러 중심의 한가운데, 로컬 z = 0 이 캠 평면.
 * 위·아래 가로대 + 옆 막대 4개(앞 둘·뒤 둘, 가운데 굵은 마디) + 롤러 받이(V 꼴 볼판 앞뒤) + 롤러 2개 + 위·아래 막대(스템).
 */
export function rollerYoke117(): RollerYoke117 {
  const g = new THREE.Group();
  const K = K117;
  const half = K117_RHO.L / 2; // 롤러 중심까지
  const iron = castIron();
  const yBar = K.barIn + K.barH / 2;
  for (const sy of [-1, 1]) {
    g.add(box(2 * K.barHalf, K.barH, 2 * K.barDepth, iron, 0, sy * yBar, 0));
    // V 꼴 볼판(앞·뒤): 가로대 안쪽 면에서 롤러 핀으로 모인다
    const cheek: V2[] = [[-0.17, sy * K.barIn], [0.17, sy * K.barIn], ...(sy > 0 ? arc(0, half, 0.045, -20 * DEG, -160 * DEG, 10) : arc(0, -half, 0.045, 20 * DEG, 160 * DEG, 10))];
    const cs = shapeFrom(sy > 0 ? cheek : [...cheek].reverse());
    for (const sz of [-1, 1]) g.add(meshAt(extrude(cs, 0.02, 0.003), steel(), 0, 0, sz * (K.camW / 2 + 0.025)));
    // 롤러 핀
    g.add(meshAt(cylZ(0.028, -(K.camW / 2 + 0.045), K.camW / 2 + 0.045, 0.004, 20), darkSteel(), 0, sy * half, 0));
  }
  // 옆 막대 4개 + 굵은 마디 + 끝 고리
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      g.add(meshAt(cylY(K.rodR, -K.barIn - 0.01, K.barIn + 0.01, 0.002, 16), steel(), sx * K.rodX, 0, sz * K.rodZ));
      g.add(meshAt(lathe(tubeProfile(K.rodR - 0.001, K.sleeveR, -K.sleeveLen / 2, K.sleeveLen / 2, 0.006), 24), darkSteel(), sx * K.rodX, 0, sz * K.rodZ));
      for (const sy of [-1, 1]) {
        g.add(meshAt(cylY(0.045, 0, 0.04, 0.004, 20), darkSteel(), sx * K.rodX, sy * K.barIn - (sy > 0 ? 0.04 : 0), sz * K.rodZ));
        g.add(meshAt(cylY(0.04, 0, 0.035, 0.004, 6), darkSteel(), sx * K.rodX, sy * (K.barIn + K.barH) - (sy > 0 ? 0 : 0.035), sz * K.rodZ));
      }
    }
  // 스템(위: 둥근 막대, 아래: 턱 + 막대)
  const yOut = K.barIn + K.barH;
  g.add(meshAt(cylY(K.stemR, 0, K.stemTop, 0.004, 24), steel(), 0, yOut - 0.005, 0));
  g.add(meshAt(cylY(0.13, 0, 0.035, 0.004, 28), iron, 0, -yOut - 0.035, 0));
  g.add(meshAt(cylY(0.085, 0, 0.035, 0.004, 28), iron, 0, -yOut - 0.07, 0));
  g.add(meshAt(cylY(K.stemR, 0, K.stemBottom, 0.004, 24), steel(), 0, -yOut - K.stemBottom + 0.005, 0));
  const rollerTop = roller117();
  rollerTop.name = 'rollerTop';
  rollerTop.position.set(0, half, 0);
  const rollerBottom = roller117();
  rollerBottom.name = 'rollerBottom';
  rollerBottom.position.set(0, -half, 0);
  g.add(rollerTop, rollerBottom);
  setMM(g, { kind: 'yoke', rollers: [[0, half, 0], [0, -half, 0]], stroke: K.lift });
  return { group: g, rollerTop, rollerBottom };
}

// ════════════════════════════ 118 행정을 두 배로 ════════════════════════════

/** 118 치수. 랙·피니언은 같은 평면. 크랭크·연결봉·뒤 안내 레일은 판화에 없는 보충 */
export const K118 = (() => {
  const Z = 14;
  const MOD = 0.05;
  const RP = (Z * MOD) / 2;
  return {
    Z,
    MOD,
    RP,
    /** 랙 하나의 잇수(짝수 — 가운데에 이골) */
    rackTeeth: 10,
    width: 0.1,
    /** 크랭크 반지름(피니언 행정 = 2·crank, 윗랙 행정 = 4·crank), 연결봉 길이, 크랭크 원판 반지름 */
    crank: 0.25,
    rod: 1.7,
    discR: 0.33,
    /** 윗랙 몸통 두께(이뿌리선 위로), 안내봉이 피치선 위로 떨어진 높이, 걸이 두 개의 x(랙 가운데 기준) */
    upperBody: 0.12,
    rodDy: 0.37,
    lugX: 0.5,
    guideRodR: 0.035,
    /** 뒤 안내 레일: 홈 반높이, 블록 반폭·틈 */
    slotHalf: 0.07,
    blockHalf: 0.1,
    clear: 0.003,
    /** t = 1(theta = 1.6)에서의 크랭크 각(판화 자세: 연결봉 왼쪽 끝이 아래로 처짐) */
    pose: -150 * DEG,
    T0: 1.6
  } as const;
})();

export interface State118 {
  /** 크랭크 각 */
  a: number;
  /** 크랭크 핀(크랭크 축 기준) */
  pin: V2;
  /** 피니언 축의 x(크랭크 축 기준): rod − crank ~ rod + crank */
  xp: number;
  /** 피니언이 가운데(xp = rod)에서 벗어난 거리 s */
  s: number;
  /** 피니언 회전각 = −s/RP (아래 고정 랙 위를 구른다) */
  roll: number;
  /** 윗랙이 가운데에서 벗어난 거리 = 2s */
  rack: number;
  /** 연결봉 방향각(핀 → 피니언 축) */
  rodAngle: number;
}

/** 118 운동(theta 의 닫힌 식). 크랭크 반시계: a = theta − T0 + pose */
export function state118(theta: number): State118 {
  const a = theta - K118.T0 + K118.pose;
  const pin: V2 = [K118.crank * Math.cos(a), K118.crank * Math.sin(a)];
  const xp = pin[0] + Math.sqrt(K118.rod * K118.rod - pin[1] * pin[1]);
  const s = xp - K118.rod;
  return { a, pin, xp, s, roll: -s / K118.RP, rack: 2 * s, rodAngle: Math.atan2(-pin[1], xp - pin[0]) };
}

/** 받침대 윗면(= 고정 랙 이뿌리선)에서 바닥까지의 높이 bedH 인 고정 랙 받침대. 원점 = 피치선 위 랙 가운데. userData.outlines.rackLower */
export function fixedRackBed118(bedH: number, depth = 0.16): THREE.Group {
  const g = new THREE.Group();
  const { MOD, rackTeeth, width } = K118;
  const comb = rackOutline116(rackTeeth, MOD, true, 0.03, 0.03);
  g.add(mesh(extrude(shapeFrom(comb), width, 0.003), brass()));
  const yTop = -1.25 * MOD - 0.02;
  const yBot = -1.25 * MOD - bedH;
  const hl = (rackTeeth * Math.PI * MOD) / 2 + 0.06;
  const body = shapeFrom([
    [-hl, yBot + 0.05],
    [-hl - 0.07, yBot + 0.05],
    [-hl - 0.07, yBot],
    [hl + 0.07, yBot],
    [hl + 0.07, yBot + 0.05],
    [hl, yBot + 0.05],
    [hl, yTop - 0.04],
    [hl - 0.04, yTop],
    [-hl + 0.04, yTop],
    [-hl, yTop - 0.04]
  ]);
  // 타원 창 3개(판화) — 서로 겹치지 않게(겹친 구멍은 삼각분할이 깨진다): 창 너비·간격을 hl 로 나눠 정한다
  const wy = (yTop + yBot) / 2 - 0.02;
  const wr = Math.max(0.03, Math.min(0.15, (yTop - yBot) / 2 - 0.12));
  const pitchW = (2 * hl) / 3; // 창 하나가 차지하는 칸
  const wHalf = Math.max(0.01, pitchW / 2 - 0.05 - wr); // 곧은 부분 반길이(칸 사이 벽 ≥ 0.1)
  for (const [cx, half] of [
    [-pitchW, wHalf],
    [0, wHalf],
    [pitchW, wHalf]
  ] as [number, number][])
    body.holes.push(pathFrom(stadium(half, wr, 12, cx, wy).reverse()));
  g.add(mesh(extrude(body, depth, 0.008), castIron()));
  g.userData.outlines = { rackLower: comb };
  setMM(g, { kind: 'rack', fixed: true, teeth: rackTeeth, pitch: Math.PI * MOD });
  return g;
}

/**
 * 움직이는 윗랙: 원점 = 피치선 위 랙 가운데(이는 아래를 향함). 몸통 + 걸이 2개(위 안내봉을 감싸는 고리, 구멍이 x 방향).
 * 안내봉 중심은 로컬 y = K118.rodDy. userData.outlines.rackUpper
 */
export function slidingRack118(): THREE.Group {
  const g = new THREE.Group();
  const { MOD, rackTeeth, width, upperBody, rodDy, lugX, guideRodR } = K118;
  const comb = rackOutline116(rackTeeth, MOD, false, upperBody, 0.03);
  g.add(mesh(extrude(shapeFrom(comb), width, 0.004), bronze({ roughness: 0.36 })));
  const yTop = 1.25 * MOD + upperBody;
  const ro = guideRodR + 0.03;
  for (const sx of [-1, 1]) {
    g.add(box(0.07, rodDy - ro * 0.8 - yTop + 0.01, width * 0.7, steel(), sx * lugX, (yTop + rodDy - ro * 0.8) / 2, 0));
    g.add(meshAt(lathe(tubeProfile(guideRodR + 0.002, ro, -0.06, 0.06, 0.005), 28).rotateZ(-Math.PI / 2), darkSteel(), sx * lugX, rodDy, 0));
  }
  // 표시 줄(움직임이 보이게)
  g.add(box(0.016, upperBody * 0.7, 0.008, paint(MARK), 0, 1.25 * MOD + upperBody / 2, width / 2 + 0.003));
  g.userData.outlines = { rackUpper: comb };
  setMM(g, { kind: 'rack', fixed: false, teeth: rackTeeth, pitch: Math.PI * MOD });
  return g;
}

/**
 * 고정 안내봉(x 방향, x0 ~ x1) + 양끝 받침(뒤판까지). 원점 = 봉 중심선 위 x = 0(모델이 position 으로 (0, y, zc) 에 둔다 — zc 는 네 번째 인자와 같게).
 */
export function hangerRod118(x0: number, x1: number, zc: number, r: number = K118.guideRodR): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylX(r, x0, x1, 0.004, 20), steel()));
  const back = STAGE.backZ - zc;
  for (const x of [x0 + 0.03, x1 - 0.03]) {
    g.add(box(0.08, 0.12, 0.1, castIron(), x, 0, 0));
    const armLen = -0.05 - back - 0.03;
    g.add(box(0.07, 0.09, armLen, castIron(), x, 0, back + 0.03 + armLen / 2));
    g.add(box(0.18, 0.18, 0.03, castIron(), x, 0, back + 0.015));
  }
  setMM(g, { kind: 'guideRod', axis: 'x', r });
  return g;
}

/** 구르는 피니언(로컬 Z 축, 잇수 14 라 rotation.z = roll 이면 roll = 0 에서 이가 정확히 위·아래 = 두 랙의 가운데 이골). userData.outline 있음 */
export function rollingPinion118(): THREE.Group {
  return pinion116(K118.Z, K118.MOD, { width: K118.width, bore: 0.05, driver: true, outline: true, holes: 4 });
}

/**
 * 피니언 축(스핀들) + 뒤 안내 블록: 원점 = 피니언 중심(피니언 평면). 스핀들은 로컬 z = backZ 쪽 블록에서 앞으로 zFront 까지.
 * blockZ = 블록 가운데의 로컬 z(뒤 안내 레일의 홈 속). 자식 'spindle'(연결봉이 걸리는 자리, markPin).
 * 블록에 userData.outline(네모) — 레일 홈 윤곽과 침범 검사.
 */
export function spindleBlock118(blockZ: number, zFront: number, rodZ: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cylZ(0.046, blockZ, zFront, 0.005, 24), steel()));
  g.add(mesh(cylZ(0.07, zFront - 0.02, zFront + 0.012, 0.004, 6), darkSteel()));
  const bh = K118.slotHalf - K118.clear;
  const blockOutline: V2[] = [
    [-K118.blockHalf, -bh],
    [K118.blockHalf, -bh],
    [K118.blockHalf, bh],
    [-K118.blockHalf, bh]
  ];
  const block = mesh(extrude(shapeFrom(blockOutline), 0.08, 0.004), bronze());
  block.position.z = blockZ;
  block.userData.outline = blockOutline;
  g.add(block);
  const pin = new THREE.Group();
  pin.name = 'spindle';
  pin.position.z = rodZ;
  markPin(pin);
  g.add(pin);
  setMM(g, { kind: 'spindle' });
  return g;
}

/**
 * 뒤 안내 레일(뒤판에 붙은 홈 판): 원점 = 홈 가운데(모델이 z 를 블록 평면에 맞춘다). 홈 길이 = 2·halfLen, 홈 반높이 K118.slotHalf.
 * 두께 thick 의 판이 뒤판 앞면까지 닿도록 모델이 z = STAGE.backZ + thick/2 에 둔다. userData.outlines.slot(구멍)
 */
export function slideRail118(halfLen: number, thick = 0.1): THREE.Group {
  const g = new THREE.Group();
  const sh = K118.slotHalf;
  const slot: V2[] = [
    [-halfLen, -sh],
    [halfLen, -sh],
    [halfLen, sh],
    [-halfLen, sh]
  ];
  const outer = shapeFrom([
    [-halfLen - 0.07, -sh - 0.06],
    [halfLen + 0.07, -sh - 0.06],
    [halfLen + 0.07, sh + 0.06],
    [-halfLen - 0.07, sh + 0.06]
  ]);
  outer.holes.push(pathFrom([...slot].reverse()));
  g.add(mesh(extrude(outer, thick, 0.005), castIron()));
  g.userData.outlines = { slot };
  setMM(g, { kind: 'rail', axis: 'x', halfLen });
  return g;
}

/**
 * 크랭크 원판(판화에 없는 구동 보충): 원점 = 축, 로컬 Z 축. 핀은 로컬 +x 로 crankR, 앞으로 pinZ 까지. 자식 'crankPin'(z = rodZ, markPin)
 */
export function crankDisc118(pinZ: number, rodZ: number, thick = 0.08): THREE.Group {
  const g = new THREE.Group();
  const s = shapeFrom(circlePts(K118.discR, 64));
  s.holes.push(circlePath(0, 0, 0.062));
  for (let i = 0; i < 3; i++) {
    const a = ((i + 0.5) / 3) * TAU + Math.PI;
    s.holes.push(circlePath(0.19 * Math.cos(a), 0.19 * Math.sin(a), 0.06));
  }
  g.add(mesh(extrude(s, thick, 0.006), bronze({ roughness: 0.34 })));
  g.add(meshAt(cylZ(0.04, thick / 2 - 0.01, pinZ, 0.004, 20), darkSteel(), K118.crank, 0, 0));
  const pin = new THREE.Group();
  pin.name = 'crankPin';
  pin.position.set(K118.crank, 0, rodZ);
  markPin(pin);
  g.add(pin);
  setMM(g, { kind: 'crankDisc', R: K118.discR, crank: K118.crank });
  return g;
}

/** 연결봉(피트먼): 원점 = 한쪽 눈(크랭크 핀), +X 로 length 에 다른 눈(피니언 스핀들). 납작 막대, 두께 thick */
export function pitman118(length: number = K118.rod, thick = 0.05): THREE.Group {
  const g = new THREE.Group();
  const e = 0.075;
  const hw = 0.035;
  const a0 = Math.asin(hw / e);
  const s = shapeFrom([...arc(length, 0, e, -Math.PI + a0, Math.PI - a0, 20), ...arc(0, 0, e, a0, TAU - a0, 20)]);
  s.holes.push(circlePath(0, 0, 0.041));
  s.holes.push(circlePath(length, 0, 0.047));
  g.add(mesh(extrude(s, thick, 0.005), steel()));
  setMM(g, { kind: 'link', length, a: [0, 0, 0], b: [length, 0, 0] });
  return g;
}
