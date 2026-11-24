// 63·64번 전용 키트 — 점프(간헐) 회전: 별 바퀴, 핀 원판, 물방울 레버(드롭)·폴 판, 달팽이 캠, 잎스프링 등
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, annularSector, circlePath, circlePts, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import { STAGE } from './stand';
import type { V2 } from './belt';

const MARK = 0xf2b619;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

export type PlateKind = 'brass' | 'bronze' | 'steel' | 'darkSteel';

function matOf(kind: PlateKind): THREE.Material {
  if (kind === 'bronze') return bronze({ roughness: 0.34 });
  if (kind === 'steel') return steel();
  if (kind === 'darkSteel') return darkSteel();
  return brass();
}

// ───────────────────────── 다각형 도우미 ─────────────────────────

function segDist(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** 점 p 와 닫힌 다각형의 부호 있는 거리: 바깥이면 +(가장 가까운 변까지), 안이면 −. 검사·접촉 풀이용 */
export function polyDepth(p: V2, poly: V2[]): number {
  let m = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    m = Math.min(m, segDist(p, pj, pi));
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? -m : m;
}

// ───────────────────────── 얇은 판 ─────────────────────────

/**
 * 외곽 다각형(로컬 xy) 을 두께 thick 로 압출한 판. z 가운데 = 0. 원 구멍들(holes) 을 뚫는다.
 * userData.outline = 외곽(V2[]).
 */
export function plateFrom(outline: V2[], holes: { x: number; y: number; r: number }[], thick: number, kind: PlateKind = 'brass'): THREE.Mesh {
  const shape = shapeFrom(outline);
  for (const h of holes) shape.holes.push(circlePath(h.x, h.y, h.r));
  const m = mesh(extrude(shape, thick, Math.min(0.008, thick * 0.14)), matOf(kind));
  m.userData.outline = outline;
  return m;
}

// ───────────────────────── 별 바퀴(63번) ─────────────────────────

/** 별 바퀴 윤곽: 이끝(반지름 ro)이 로컬 각 m·(2π/teeth), 이뿌리(ri)가 그 사이 중간각. 직선 옆면 */
export function starOutline(teeth: number, ro: number, ri: number): V2[] {
  const pts: V2[] = [];
  const pitch = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch;
    pts.push([Math.cos(a) * ro, Math.sin(a) * ro]);
    const b = a + pitch / 2;
    pts.push([Math.cos(b) * ri, Math.sin(b) * ri]);
  }
  return pts;
}

/** 별 모양 바퀴: 판 + 축 구멍 허브 + 표시점. 회전축 = 로컬 Z, 두께 가운데 z = 0, 이끝 하나가 로컬 +X(0°) */
export function starWheel(teeth: number, ro: number, ri: number, thick = 0.07): THREE.Group {
  const g = new THREE.Group();
  const outline = starOutline(teeth, ro, ri);
  const bore = Math.max(0.04, ri * 0.2);
  g.add(plateFrom(outline, [{ x: 0, y: 0, r: bore }], thick, 'brass'));
  const hubGeo = lathe(tubeProfile(bore, bore + 0.07, -(thick / 2 + 0.014), thick / 2 + 0.014, 0.008), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 표시점: 이끝 하나 안쪽의 밝은 줄
  g.add(meshAt(new THREE.BoxGeometry(ri * 0.55, 0.016, 0.01), paint(MARK), ri * 0.55, 0, thick / 2 + 0.004));
  g.userData.outline = outline;
  return g;
}

// ───────────────────────── 핀 원판(63번) ─────────────────────────

/**
 * 핀 원판: 둥근 판 + 허브 + 앞면 핀들(pins: 반지름 r, 로컬 각 a). 회전축 = 로컬 Z, 판 두께 가운데 z = 0.
 * 핀은 판 앞면(z = thick/2)에서 pinLen 만큼 +Z 로 솟는다. 표시 홈 없이 핀 자체가 표시.
 * backLen > 0 이면 같은 핀이 판 뒷면(z = −thick/2)에서 backLen 만큼 −Z 로도 솟는다.
 */
export function pinDisc(R: number, pins: { r: number; a: number }[], pinR = 0.055, pinLen = 0.12, thick = 0.08, backLen = 0): THREE.Group {
  const g = new THREE.Group();
  const bore = Math.max(0.04, R * 0.12);
  g.add(plateFrom(circlePts(R, 72), [{ x: 0, y: 0, r: bore }], thick, 'bronze'));
  const hubGeo = lathe(tubeProfile(bore, R * 0.28, -(thick / 2 + 0.014), thick / 2 + 0.03, 0.01), 40);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  for (const p of pins) {
    const pg = lathe(rodProfile(pinR, 0, pinLen, 0.012, 0.014), 24);
    pg.rotateX(Math.PI / 2);
    g.add(meshAt(pg, steel(), Math.cos(p.a) * p.r, Math.sin(p.a) * p.r, thick / 2));
    if (backLen > 0) {
      // 뒤로도 솟는 핀(판화 63: 원판 뒤에 가려진 드롭 끝을 받쳐 올린다)
      const bg = lathe(rodProfile(pinR, -backLen, 0, 0.012, 0.014), 24);
      bg.rotateX(Math.PI / 2);
      g.add(meshAt(bg, steel(), Math.cos(p.a) * p.r, Math.sin(p.a) * p.r, -thick / 2));
    }
    // 핀 머리 표시
    g.add(meshAt(new THREE.CylinderGeometry(pinR * 0.55, pinR * 0.55, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), Math.cos(p.a) * p.r, Math.sin(p.a) * p.r, thick / 2 + pinLen + 0.002));
  }
  return g;
}

// ───────────────────────── 드롭(레버)·폴 윤곽(63번) ─────────────────────────

/**
 * 드롭(물방울) 레버 윤곽 — 피벗(나사 중심)을 원점으로 한 로컬 좌표(세계 좌표 − (−0.57, 2.74)).
 * 오른쪽 둥근 혹(핀 원판에 닿는 아랫면 L0→L1 직선 포함), 왼쪽 꼬리 혹. 반시계 24점(+끝 모따기 2점)
 */
export function dropOutline(): V2[] {
  const px = -0.57;
  const py = 2.74;
  const w: V2[] = [
    [-0.57, 3.1], [-0.8, 3.03], [-0.93, 2.85], [-0.95, 2.62], [-1.05, 2.45], [-1.25, 2.35], [-1.3, 2.18], [-1.12, 2.05],
    [-0.9, 2.08], [-0.7, 2.2], [-0.45, 2.28], [-0.2, 2.27], [0, 2.2], [0.33, 1.95], [0.62, 1.725], [0.69, 1.765],
    [0.78, 1.86], [0.88, 2.05], [0.95, 2.28], [0.92, 2.5], [0.8, 2.62], [0.55, 2.68], [0.2, 2.72], [-0.12, 2.8], [-0.33, 3.02]
  ];
  return w.map(([x, y]) => [x - px, y - py] as V2);
}

/** 폴(갈고리) 윤곽 — 힌지(Q)를 원점, 끝(뾰족한 이)을 +X 로 length 지점. 끝으로 갈수록 가늘다(별 이끝과 0.006 이내라 칼날처럼) */
export function pawlOutline(length: number): V2[] {
  const hw: [number, number][] = [
    [0.0, 0.075], [0.2, 0.055], [length - 0.45, 0.045], [length - 0.3, 0.026], [length - 0.2, 0.017], [length - 0.1, 0.011]
  ];
  const up: V2[] = hw.map(([x, y]) => [x, y] as V2);
  const dn: V2[] = hw
    .slice()
    .reverse()
    .map(([x, y]) => [x, -y] as V2);
  const pts: V2[] = [[-0.075, 0.0], ...up, [length, 0], ...dn];
  return pts;
}

// ───────────────────────── 판화 그대로의 드롭 판·갈고리 폴(63번, 교차 읽기 뒤 추가) ─────────────────────────
// 판화(63)는 드롭과 폴이 **같은 나사(피벗)에 따로 끼워진 두 레버**다. 위의 dropOutline·pawlOutline 은 폴을 드롭 코끝 힌지에 매단
// 옛 해석(설계표 063 의 "안 B")용이고, 아래 둘이 판화를 그대로 옮긴 윤곽이다. 둘 다 나사 중심이 원점, 판화의 쉬는 자세, 반시계.
// 축척: 핀 원판 반지름 0.76 기준(판화 1px(525 폭) = 0.00747).

function arcPts(r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

/** 드롭 판에 박힌 "때리는 핀"의 자리(나사 원점 로컬) — 갈고리 폴 팔의 윗변 바로 위 */
export const DROP63_STRIKE_PIN: V2 = [0.409, -0.167];
/** 드롭 판의 아래 뾰족 끝(핀 원판의 핀이 받쳐 올리는 곳, 나사 원점 로컬) */
export const DROP63_TOE: V2 = [1.333, -1.509];
/** 갈고리 폴의 끝(별 바퀴 틈에 앉는 이, 나사 원점 로컬) */
export const PAWL63_TIP: V2 = [0.789, -1.274];

/**
 * 드롭 판(뒤쪽 레버) 윤곽: 나사 둘레 혹(반지름 0.41) + 왼쪽 꼬리(스프링이 받치는 곳) + 오른쪽으로 뻗어 아래로 꺾이는 넓은 몸통,
 * 아래 끝은 뾰족(DROP63_TOE). 판화에서 몸통 오른쪽 아래는 점선(갈고리 폴·원판 뒤에 가림).
 */
export function dropPlateOutline63(): V2[] {
  return [
    ...arcPts(0.41, -7, 176, 14),
    [-0.643, -0.218], [-0.91, -0.34], [-0.825, -0.461], [-0.515, -0.564], [-0.196, -0.735],
    [-0.074, -0.564], [0.172, -0.441], [0.417, -0.456], [0.662, -0.637], [0.809, -0.882],
    [DROP63_TOE[0], DROP63_TOE[1]], [1.348, -0.343], [0.931, -0.2205]
  ];
}

/**
 * 갈고리 폴(앞쪽 레버) 윤곽: 나사 둘레 고리(반지름 0.28) + 오른쪽 아래로 뻗은 팔 + 잎 모양 큰 갈고리, 끝(PAWL63_TIP)이 별 바퀴 틈에 앉는다.
 * 팔의 윗변 (0.227, −0.243) → (0.925, −0.234) 을 드롭의 때리는 핀이 위에서 친다.
 */
export function clawPawlOutline63(): V2[] {
  return [
    ...arcPts(0.28, -15, 235, 14),
    [-0.045, -0.349], [0.227, -0.425], [0.531, -0.476], [0.849, -0.531], [0.819, -0.895],
    [PAWL63_TIP[0], PAWL63_TIP[1]],
    [0.986, -1.228], [1.198, -1.077], [1.35, -0.895], [1.441, -0.652], [1.456, -0.47], [1.38, -0.318], [1.259, -0.234], [1.107, -0.212],
    [0.925, -0.234], [0.743, -0.273], [0.561, -0.288], [0.379, -0.273], [0.227, -0.243]
  ];
}

// ───────────────────────── 달팽이 캠(64번) ─────────────────────────

const SNAIL_CTRL: V2[] = [
  [0.328, 0.894], [0.205, 0.902], [0.016, 0.869], [-0.221, 0.754], [-0.385, 0.549], [-0.484, 0.098], [-0.41, -0.098],
  [-0.287, -0.246], [-0.082, -0.361], [0.082, -0.377], [0.246, -0.344], [0.35, -0.27]
];

function catmull(p0: V2, p1: V2, p2: V2, p3: V2, t: number): V2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (i: 0 | 1): number => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
  return [f(0), f(1)];
}

/**
 * 달팽이(물방울) 캠 윤곽, 허브(회전축)가 원점. 모서리 C = (0.328, 0.894) 에서 반시계로 나선이 줄어들어(왼쪽 위 → 왼쪽 → 아래, 최소 반지름 ≈ 0.37)
 * 오른쪽 아래 둥근 모서리 → 곧은 변 x = 0.385(아래 −0.20 ~ 위 0.80) → 모서리 C. 반시계 92점
 */
export function snailOutline(): V2[] {
  const pts: V2[] = [];
  const n = SNAIL_CTRL.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = SNAIL_CTRL[Math.max(0, i - 1)]!;
    const p1 = SNAIL_CTRL[i]!;
    const p2 = SNAIL_CTRL[i + 1]!;
    const p3 = SNAIL_CTRL[Math.min(n - 1, i + 2)]!;
    for (let s = 0; s < 8; s++) pts.push(catmull(p0, p1, p2, p3, s / 8));
  }
  pts.push(SNAIL_CTRL[n - 1]!);
  pts.push([0.385, -0.2], [0.385, 0.8], [0.372, 0.865]);
  return pts;
}

/** 달팽이 캠 판(두께 thick, z 가운데 0) + 허브 구멍 반지름 hole. userData.outline = snailOutline() */
export function snailCam(thick = 0.06, hole = 0.075): THREE.Group {
  const g = new THREE.Group();
  const outline = snailOutline();
  g.add(plateFrom(outline, [{ x: 0, y: 0, r: hole }], thick, 'brass'));
  g.userData.outline = outline;
  return g;
}

// ───────────────────────── 막대·고리(64번 레버) ─────────────────────────

/**
 * 레버 팔: 피벗 구멍이 원점, +X 쪽으로 length, 끝에 구멍 뚫린 고리(ringR)와 롤러 핀. 두께 thick, z 가운데 0.
 * 고리 중심 = (length, 0)
 */
export function leverArm(length: number, width: number, ringR: number, holeR: number, thick = 0.05): THREE.Group {
  const g = new THREE.Group();
  const bar = stadiumShape(0, 0, length - ringR * 0.5, 0, width / 2);
  bar.holes.push(circlePath(0, 0, 0.04));
  g.add(mesh(extrude(bar, thick, 0.008), steel()));
  const ring = new THREE.Shape();
  ring.absarc(0, 0, ringR, 0, TAU, false);
  ring.holes.push(circlePath(0, 0, holeR));
  g.add(meshAt(extrude(ring, thick, 0.008), darkSteel(), length, 0, 0));
  const pinGeo = lathe(rodProfile(holeR * 0.9, -thick / 2 - 0.012, thick / 2 + 0.02, 0.006, 0.006), 20);
  pinGeo.rotateX(Math.PI / 2);
  g.add(meshAt(pinGeo, steel(), length, 0, 0));
  return g;
}

// ───────────────────────── 속 빈 축(반 잘림)·핀 손가락(64번) ─────────────────────────

/** 반쯤 잘린 속 빈 축 조각: 각 a0→a1(라디안, 로컬 반시계) 부채꼴 고리, 반지름 rIn~rOut, 두께 thick(z 가운데 0) */
export function halfCollar(rIn: number, rOut: number, thick: number, a0: number, a1: number): THREE.Mesh {
  return mesh(extrude(annularSector(rIn, rOut, a0, a1), thick, 0.006), bronze({ roughness: 0.34 }));
}

/** 축에 박힌 핀(손가락): 원점(축 중심)에서 +X 로 len, 반폭 halfW, 두께 thick(z 가운데 0). 끝에 밝은 표시 */
export function pinFinger(len: number, halfW: number, thick: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(len, halfW * 2, thick);
  geo.translate(len / 2, 0, 0);
  g.add(mesh(geo, steel()));
  g.add(meshAt(new THREE.BoxGeometry(halfW * 1.2, halfW * 1.2, thick + 0.004), paint(MARK), len - halfW * 0.7, 0, 0));
  return g;
}

// ───────────────────────── 잎스프링(64번) ─────────────────────────

/** 잎스프링(가는 막대형 곡선): set() 으로 두 끝점·접선을 주면 3차 베지어 관을 다시 만든다 */
export class LeafSpring {
  readonly group = new THREE.Group();
  private readonly m: THREE.Mesh;

  constructor(private readonly r = 0.018) {
    this.m = mesh(new THREE.BufferGeometry(), steel());
    this.group.add(this.m);
  }

  /** p0·p1 = 끝점, t0·t1 = 끝점에서 곡선이 향하는 단위 접선(시작은 나가는 쪽, 끝은 들어오는 쪽) */
  set(p0: THREE.Vector3, t0: THREE.Vector3, p1: THREE.Vector3, t1: THREE.Vector3): void {
    const d = p0.distanceTo(p1) * 0.38;
    const c = new THREE.CubicBezierCurve3(p0.clone(), p0.clone().addScaledVector(t0, d), p1.clone().addScaledVector(t1, -d), p1.clone());
    const old = this.m.geometry;
    this.m.geometry = new THREE.TubeGeometry(c, 28, this.r, 8, false);
    old.dispose();
  }
}

// ───────────────────────── 벽 블록 ─────────────────────────

/** 뒤판에 붙은 축받이 블록: 뒤판 앞면(z = backZ)에서 zFront 까지 한 변 size 인 상자 + 앞면 구멍 링. 원점 = (x, y, 0) */
export function wallBlock(x: number, y: number, zFront: number, size = 0.18): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const len = zFront - STAGE.backZ;
  g.add(meshAt(new THREE.BoxGeometry(size, size, len), castIron(), 0, 0, STAGE.backZ + len / 2));
  const ringGeo = lathe(tubeProfile(0.05, 0.085, 0, 0.02, 0.006), 32);
  ringGeo.rotateX(Math.PI / 2);
  g.add(meshAt(ringGeo, darkSteel(), 0, 0, zFront));
  return g;
}
