// 110·111·112번 전용 키트 — 나사 묶음
//  110 양쪽 나사 안내 롤러: 왼나사·오른나사 롤러, 흔들 축(반너트 팔 2개 + 레버), 옆판 틀, 주기 시간표
//  111 마이크로미터(차동) 나사: 굵은 나사 + 가는 나사 한 몸, 고정 너트 틀(안내 막대), 이동 너트
//  112 페르시아 드릴: 급한 여러 줄 나사 몸통, 머리, 손잡이 너트, 받침 나무
// 나사 면은 모두 threadR(spec, th, y) 하나에서 나온다(th = 축 둘레 각, +Z 에서 +X 쪽으로; y = 축 방향 위치).
// 오른나사(hand +1)는 th 가 늘면 산이 +축 쪽으로 올라간다 — 세로축을 앞에서 보면 산이 "/" 로 기운다.
// 나사를 축 둘레로 psi 만큼 돌리면(오른손 규칙) 같은 각에서 본 산은 축 방향으로 −hand·lead·psi/2π 만큼 움직인다.
// 치수 상수(K110·K111·K112)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s110.mjs 등)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, circlePath, circlePts, creased, extrude, hexPrism, lathe, mesh, polygonRadius, radialSurface, rodProfile, roundedRect, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Y축 원기둥(y0~y1, 양끝 모따기 c) */
function cylY(r: number, y0: number, y1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  return lathe(rodProfile(r, y0, y1, c, c), segs);
}

/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = cylY(r, x0, x1, c, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** X축 관(x0~x1) — 구멍이 축 방향 */
function tubeX(rIn: number, rOut: number, x0: number, x1: number, c = 0.006): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, x0, x1, c), 36);
  g.rotateZ(-Math.PI / 2);
  return g;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (s: number): number => {
  const t = clamp01(s);
  return t * t * (3 - 2 * t);
};

// ═══════════════════════════ 나사 면 ═══════════════════════════

export interface ThreadSpec {
  /** 골 반지름 */
  rCore: number;
  /** 산 높이(바깥 반지름 = rCore + depth) */
  depth: number;
  /** 이웃한 산 사이 축 방향 거리 */
  pitch: number;
  /** 줄 수(리드 = pitch·starts) */
  starts: number;
  /** +1 오른나사, −1 왼나사 */
  hand: 1 | -1;
  /** 산 꼭대기 폭(피치 비율, 기본 0.4) */
  crest?: number;
  /** 옆구리 폭(피치 비율, 기본 0.1) */
  flank?: number;
}

/** 리드(한 바퀴에 나아가는 거리) */
export function threadLead(s: ThreadSpec): number {
  return s.pitch * s.starts;
}

/** 산 모양: u∈[0,1) → 0(골)~1(산). 산 중심 u = 0.5, 사다리꼴 */
export function threadProfile(u: number, crest = 0.4, flank = 0.1): number {
  return clamp01((crest / 2 + flank - Math.abs(u - 0.5)) / flank);
}

/** 각 th·축 위치 y 에서의 산 위상 u∈[0,1) */
export function threadU(s: ThreadSpec, th: number, y: number, u0 = 0): number {
  const v = y / s.pitch - (s.hand * s.starts * th) / TAU + u0;
  return v - Math.floor(v);
}

/** 각 th·축 위치 y 에서 나사 면의 반지름 */
export function threadR(s: ThreadSpec, th: number, y: number, u0 = 0): number {
  return s.rCore + s.depth * threadProfile(threadU(s, th, y, u0), s.crest, s.flank);
}

export interface ScrewGeoOpts {
  u0?: number;
  segs?: number;
  /** 피치 하나에 넣는 행 수(기본 10) */
  rows?: number;
  cap0?: boolean;
  cap1?: boolean;
}

/**
 * 나사 면 지오메트리 — 축 = 로컬 +Y, y0~y1. 점 = (r·sin th, y, r·cos th).
 * 격자를 축에 나란하게(θ × y) 찍으면 비스듬한 산 모서리가 칸마다 꺾여 계단처럼 보였다(사용자 지적: 110·111번).
 * 그래서 격자 한 축을 나선(산 위상 u 가 일정한 선)에 맞춘다: y = w + hand·lead·θ/2π, w 는 나선 좌표.
 * w 행은 산 모양의 꺾이는 곳(꼭대기 양끝·옆구리 양끝)에 정확히 놓아 사다리꼴이 매끈하고 또렷하게 나온다. 양 끝은 y 를 잘라 평면으로 막는다.
 */
export function screwGeo(s: ThreadSpec, y0: number, y1: number, o: ScrewGeoOpts = {}): THREE.BufferGeometry {
  const lead = threadLead(s);
  const segs = Math.max(48, o.segs ?? 96) * 2;
  const crest = s.crest ?? 0.4;
  const flank = s.flank ?? 0.1;
  const u0 = o.u0 ?? 0;
  // 한 피치 안 w 표본(피치 비율): 골 구간을 몇 칸 + 산 모서리 4점
  const rootN = Math.max(2, Math.round((o.rows ?? 10) / 3));
  const a = 0.5 - crest / 2 - flank;
  const b = 0.5 - crest / 2;
  const c = 0.5 + crest / 2;
  const d = 0.5 + crest / 2 + flank;
  const per: number[] = [];
  for (let k = 0; k < rootN; k++) per.push((a * k) / rootN);
  per.push(a, b, (b + c) / 2, c, d);
  for (let k = 1; k < rootN; k++) per.push(d + ((1 - d) * k) / rootN);
  // w 는 θ 에 따른 y 이동을 모두 덮도록 넓게
  const shiftMax = Math.max(0, s.hand * lead);
  const shiftMin = Math.min(0, s.hand * lead);
  const wA = y0 - shiftMax;
  const wB = y1 - shiftMin;
  // 위상 u = w/pitch + u0' 가 per 값이 되도록 w 를 고른다(threadU: v = y/p − hand·starts·θ/2π + u0)
  const ws: number[] = [];
  const n0 = Math.floor(wA / s.pitch + u0) - 1;
  const n1 = Math.ceil(wB / s.pitch + u0) + 1;
  for (let n = n0; n <= n1; n++) for (const f of per) ws.push((n + f - u0) * s.pitch);
  const wsIn = ws.filter((w) => w >= wA - s.pitch && w <= wB + s.pitch);
  const R = s.rCore;
  const pos: number[] = [];
  const cols = segs + 1;
  for (let jj = 0; jj < wsIn.length; jj++) {
    for (let ii = 0; ii <= segs; ii++) {
      const th = (ii / segs) * TAU;
      const yRaw = wsIn[jj]! + (s.hand * lead * th) / TAU;
      const y = Math.min(y1, Math.max(y0, yRaw));
      const r = threadR(s, th, yRaw, u0);
      pos.push(r * Math.sin(th), y, r * Math.cos(th));
    }
  }
  const idx: number[] = [];
  for (let jj = 0; jj < wsIn.length - 1; jj++) {
    for (let ii = 0; ii < segs; ii++) {
      const p00 = jj * cols + ii;
      const p10 = p00 + 1;
      const p01 = p00 + cols;
      const p11 = p01 + 1;
      idx.push(p00, p10, p01, p10, p11, p01);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const parts: THREE.BufferGeometry[] = [geo.toNonIndexed()];
  parts[0]!.computeVertexNormals();
  // 끝 마개(속 빈 축 끝을 막는다)
  const cap = (y: number, up: boolean): THREE.BufferGeometry => {
    const g = new THREE.CircleGeometry(R + s.depth * 0.5, segs);
    g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
    g.translate(0, y, 0);
    g.deleteAttribute('uv');
    return g.toNonIndexed();
  };
  if (o.cap0 !== false) parts.push(cap(y0, false));
  if (o.cap1 !== false) parts.push(cap(y1, true));
  // 큰 배열을 펼쳐 넣으면(…spread) 호출 스택이 넘친다 → 미리 잡은 Float32Array 에 복사
  const total = parts.reduce((n, g) => n + g.getAttribute('position').array.length, 0);
  const all = new Float32Array(total);
  const nor = new Float32Array(total);
  let off = 0;
  for (const g of parts) {
    const pa = g.getAttribute('position').array as Float32Array;
    all.set(pa, off);
    nor.set(g.getAttribute('normal').array as Float32Array, off);
    off += pa.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(all, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

/** 축에 수직인 단면 윤곽(검사용). 로컬 z 가 축(+)을 향하도록 놓은 holder 좌표: (lx, ly) = (r·sin th, −r·cos th) */
function sectionPts(rFn: (th: number) => number, n = 72): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    const r = rFn(th);
    out.push([r * Math.sin(th), -r * Math.cos(th)]);
  }
  return out;
}

/** 로컬 z 가 부모의 +Y 를 향하는 빈 물체(윤곽 받침) */
function holderY(name: string, y: number): THREE.Object3D {
  const h = new THREE.Object3D();
  h.name = name;
  h.rotation.order = 'YXZ';
  h.rotation.set(-Math.PI / 2, 0, 0);
  h.position.y = y;
  return h;
}

// ═══════════════════════════ 110 양쪽 나사 안내 롤러 ═══════════════════════════

/** 110번 치수. 길이 좌표 x 는 롤러 가운데가 0, 흔들 축 좌표 (y, z) 는 흔들 축 중심이 0(롤러 축은 y = D, z = 0) */
export const K110 = {
  /** 흔들 축 ~ 롤러 축 거리(세로) */
  D: 0.9,
  /** 옆판 안쪽 면 x = ±half */
  half: 0.97,
  /** 옆판 두께(x)·깊이(z)·롤러 축 위로·흔들 축 아래로 */
  plateT: 0.3,
  plateZ: 0.44,
  plateUp: 0.31,
  plateDown: 0.24,
  /** 나사: 골 반지름·산 높이·피치·줄 수(리드 0.24) */
  rCore: 0.125,
  depth: 0.03,
  pitch: 0.08,
  starts: 3,
  /** 나사부는 x = ±threadX0 ~ ±half, 가운데 민 부분 반지름 midR */
  threadX0: 0.18,
  midR: 0.095,
  journalR: 0.06,
  /** 흔들 축 반지름과 양 끝 x */
  spindleR: 0.06,
  spindleX0: -1.22,
  spindleX1: 1.98,
  /** 반너트 A(앞·왼쪽 나사), B(뒤·오른쪽 나사)의 가운데 x, 폭, 감싼 반각, 두께, 나사 틈 */
  nutAX: -0.565,
  nutBX: 0.62,
  nutW: 0.29,
  nutHalf: 50 * DEG,
  nutT: 0.08,
  clear: 0.006,
  hubR: 0.15,
  hubW: 0.31,
  armW: 0.11,
  armHalfT: 0.04,
  /** 레버: 허브 x, 위·아래 길이 */
  leverX: 1.79,
  leverUp: 1.1,
  leverDown: 1.0,
  /** 흔들 축이 기우는 각(±) */
  delta: 7 * DEG,
  /** 시간표(롤러 회전수 단위): 한쪽 나사가 미는 구간, 둘 다 풀린 구간, 레버가 미리·늦게 움직이는 여유 */
  driveRev: 1.5,
  idleRev: 1 / 3,
  switchLead: 0.31,
  /** 판화 자세 맞춤: traverse110(theta + pose) 로 부르면 t = 1(theta 1.6)에서 막대가 가운데(x = 0, A 물림) */
  pose: Math.PI * 2 * 0.75 - 1.6
} as const;

/** 110번 나사 규격. A = 왼쪽 나사부(왼나사), B = 오른쪽 나사부(오른나사) */
export function thread110(which: 'A' | 'B'): ThreadSpec {
  return { rCore: K110.rCore, depth: K110.depth, pitch: K110.pitch, starts: K110.starts, hand: which === 'A' ? -1 : 1 };
}

/** 반너트 안쪽 나사의 위상 — traverse110 의 시간표에서 물릴 때 롤러 나사와 맞도록 */
export function nutPhase110(which: 'A' | 'B'): number {
  const lead = K110.pitch * K110.starts;
  const tr = (lead * K110.driveRev) / 2;
  // 너트 면은 흔들 축 좌표의 x 로 만든다: 물린 동안 (막대 이동 x)/pitch + hand·starts·spin/2π 가 일정 — 그 값이 위상
  const v = which === 'A' ? -tr / K110.pitch : (tr + lead * (K110.driveRev + K110.idleRev)) / K110.pitch;
  return v - Math.floor(v);
}

export interface Traverse110 {
  /** 롤러 회전각(= theta) */
  spin: number;
  /** 흔들 축(막대)의 x 이동(가운데 0, ±0.18) */
  x: number;
  /** 흔들 축이 기운 각(rotation.x). −delta = A(앞 너트) 물림, +delta = B(뒤 너트) 물림 */
  phi: number;
  /** 지금 막대를 미는 너트 */
  engaged: 'A' | 'B' | 'none';
  /** 주기 안 위치(롤러 회전수, 0 ~ 11/3) */
  v: number;
}

/**
 * 110번 주기 시간표(theta 의 닫힌 식). 한 주기 = 롤러 11/3 바퀴(리드 0.24 × 11/3 = 피치 11개 → 다시 물릴 때 산이 정확히 맞는다).
 *  v 0 ~ 1.5      : A(왼나사)가 물려 막대가 +x 로 0.36
 *  v 1.5 ~ 1.833  : 둘 다 풀림(막대 멈춤). 레버는 v 1.19 ~ 2.143 사이에 −delta → +delta(물린 너트는 막대와 함께 가며 빠지므로 긁지 않는다)
 *  v 1.833 ~ 3.333: B(오른나사)가 물려 막대가 −x 로 0.36
 *  v 3.333 ~ 3.667: 둘 다 풀림. 레버는 v 3.023 ~ 3.977(다음 주기 0.31) 사이에 +delta → −delta
 */
export function traverse110(theta: number): Traverse110 {
  const K = K110;
  const lead = K.pitch * K.starts;
  const U = 2 * (K.driveRev + K.idleRev);
  const u = theta / TAU;
  const v = u - Math.floor(u / U) * U;
  const tr = (lead * K.driveRev) / 2;
  const b0 = K.driveRev + K.idleRev;
  let x: number;
  let engaged: 'A' | 'B' | 'none';
  if (v < K.driveRev) {
    x = -tr + lead * v;
    engaged = 'A';
  } else if (v < b0) {
    x = tr;
    engaged = 'none';
  } else if (v < b0 + K.driveRev) {
    x = tr - lead * (v - b0);
    engaged = 'B';
  } else {
    x = -tr;
    engaged = 'none';
  }
  const span = K.idleRev + 2 * K.switchLead;
  const sAB = (v - (K.driveRev - K.switchLead)) / span;
  const startBA = b0 + K.driveRev - K.switchLead;
  const sBA = ((v < K.switchLead ? v + U : v) - startBA) / span;
  // v < switchLead 는 앞 주기에서 시작한 B→A 전환의 끝자락(+delta 에서 내려오는 중)
  const phi = v < K.switchLead ? K.delta - 2 * K.delta * smooth(sBA) : -K.delta + 2 * K.delta * (smooth(sAB) - smooth(sBA));
  return { spin: theta, x, phi, engaged, v };
}

/**
 * 110번 롤러 — 축 = 로컬 X, 원점 = 롤러 가운데. 왼쪽 나사부(왼나사)·민 가운데·오른쪽 나사부(오른나사) + 양 끝 저널.
 * rotation.x = traverse110(theta).spin 으로 돌린다. 골 원 윤곽(child 'coreA'·'coreB' 의 userData.outline)을 남긴다.
 */
export function roller110(): THREE.Group {
  const K = K110;
  const g = new THREE.Group();
  const end = K.half + K.plateT + 0.04;
  g.add(mesh(cylX(K.journalR, -end, end, 0.01), steel()));
  g.add(mesh(cylX(K.midR, -K.threadX0, K.threadX0, 0.004), brass()));
  for (const which of ['A', 'B'] as const) {
    const s = thread110(which);
    const geo = which === 'A' ? screwGeo(s, -K.half, -K.threadX0) : screwGeo(s, K.threadX0, K.half);
    geo.rotateZ(-Math.PI / 2);
    const m = mesh(geo, brass());
    m.name = which === 'A' ? 'threadA' : 'threadB';
    g.add(m);
    const h = new THREE.Object3D();
    h.name = which === 'A' ? 'coreA' : 'coreB';
    h.rotation.y = Math.PI / 2;
    h.position.x = which === 'A' ? K.nutAX : K.nutBX;
    h.userData.outline = circlePts(K.rCore, 48);
    g.add(h);
  }
  // 회전이 보이게: 민 가운데의 표시 줄
  g.add(meshAt(new THREE.BoxGeometry(K.threadX0 * 1.4, 0.012, 0.012), paint(MARK), 0, 0, K.midR));
  setMM(g, { kind: 'screw', fn: 'roller110', axis: 'x', rCore: K.rCore, rOuter: K.rCore + K.depth, pitch: K.pitch, starts: K.starts, lead: K.pitch * K.starts });
  return g;
}

/** 반너트(안쪽에 나사가 난 부채꼴 껍질). 물린 자세, 흔들 축 좌표. th0 = 가운데 각(앞 0, 뒤 π) */
function halfNutGeo(spec: ThreadSpec, u0: number, xc: number, th0: number): THREE.BufferGeometry {
  const K = K110;
  const nTh = 28;
  const nX = Math.ceil((K.nutW / K.pitch) * 12);
  const rOut = K.rCore + K.depth + K.nutT;
  const pos: number[] = [];
  const idx: number[] = [];
  const P = (x: number, r: number, th: number): number => {
    pos.push(x, K.D - r * Math.sin(th), r * Math.cos(th));
    return pos.length / 3 - 1;
  };
  const thAt = (i: number): number => th0 - K.nutHalf + (2 * K.nutHalf * i) / nTh;
  const xAt = (j: number): number => xc - K.nutW / 2 + (K.nutW * j) / nX;
  const rIn = (i: number, j: number): number => threadR(spec, thAt(i), xAt(j), u0) + K.clear;
  const inner: number[][] = [];
  const outer: number[][] = [];
  for (let i = 0; i <= nTh; i++) {
    const a: number[] = [];
    const b: number[] = [];
    for (let j = 0; j <= nX; j++) {
      a.push(P(xAt(j), rIn(i, j), thAt(i)));
      b.push(P(xAt(j), rOut, thAt(i)));
    }
    inner.push(a);
    outer.push(b);
  }
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const at = (k: number, t: THREE.Vector3): THREE.Vector3 => t.set(pos[k * 3]!, pos[k * 3 + 1]!, pos[k * 3 + 2]!);
  /** 사각형 a-b-c-d 를 바깥(ref 방향)이 앞면이 되게 */
  const quad = (a: number, b: number, c: number, d: number, ref: THREE.Vector3): void => {
    at(a, va);
    at(b, vb).sub(va);
    at(d, vc).sub(va);
    const flip = vb.cross(vc).dot(ref) < 0;
    if (flip) idx.push(a, d, b, b, d, c);
    else idx.push(a, b, d, b, c, d);
  };
  const ref = new THREE.Vector3();
  const radial = (th: number, sgn: number): THREE.Vector3 => ref.set(0, -Math.sin(th) * sgn, Math.cos(th) * sgn);
  for (let i = 0; i < nTh; i++) {
    const thm = (thAt(i) + thAt(i + 1)) / 2;
    for (let j = 0; j < nX; j++) {
      quad(inner[i]![j]!, inner[i + 1]![j]!, inner[i + 1]![j + 1]!, inner[i]![j + 1]!, radial(thm, -1));
      quad(outer[i]![j]!, outer[i + 1]![j]!, outer[i + 1]![j + 1]!, outer[i]![j + 1]!, radial(thm, 1));
    }
    // 양 끝 면(x = 끝)
    quad(inner[i]![0]!, inner[i + 1]![0]!, outer[i + 1]![0]!, outer[i]![0]!, ref.set(-1, 0, 0));
    quad(inner[i]![nX]!, inner[i + 1]![nX]!, outer[i + 1]![nX]!, outer[i]![nX]!, ref.set(1, 0, 0));
  }
  for (let j = 0; j < nX; j++) {
    // 부채꼴의 두 옆면(각 끝)
    const t0 = thAt(0);
    const t1 = thAt(nTh);
    quad(inner[0]![j]!, inner[0]![j + 1]!, outer[0]![j + 1]!, outer[0]![j]!, ref.set(0, Math.cos(t0), Math.sin(t0)));
    quad(inner[nTh]![j]!, inner[nTh]![j + 1]!, outer[nTh]![j + 1]!, outer[nTh]![j]!, ref.set(0, -Math.cos(t1), -Math.sin(t1)));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  geo.setIndex(idx);
  return creased(geo, 40);
}

/** 반너트의 단면 윤곽(롤러 축에 수직) — holder(rotation.y = π/2, 롤러 축 위) 좌표: (lx, ly) = (−z, y − D) */
export function halfNutOutline110(th0: number): V2[] {
  const K = K110;
  const rIn = K.rCore + K.clear;
  const rOut = K.rCore + K.depth + K.nutT;
  const n = 20;
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const th = th0 - K.nutHalf + (2 * K.nutHalf * i) / n;
    out.push([-rOut * Math.cos(th), -rOut * Math.sin(th)]);
  }
  for (let i = n; i >= 0; i--) {
    const th = th0 - K.nutHalf + (2 * K.nutHalf * i) / n;
    out.push([-rIn * Math.cos(th), -rIn * Math.sin(th)]);
  }
  return out;
}

/** 팔 하나(허브 + 비스듬한 팔 + 반너트). 물린 자세의 흔들 축 좌표. */
function arm110(which: 'A' | 'B'): THREE.Group {
  const K = K110;
  const g = new THREE.Group();
  const front = which === 'A';
  const sgn = front ? 1 : -1;
  const xc = front ? K.nutAX : K.nutBX;
  g.add(mesh(tubeX(K.spindleR, K.hubR, xc - K.hubW / 2, xc + K.hubW / 2, 0.012), castIron()));
  // 팔: (z, y) 평면의 스타디움을 x 로 압출
  const zP = sgn * (K.rCore + K.depth + K.nutT * 0.75);
  const bar = extrude(stadiumShape(0, 0, zP, K.D, K.armHalfT), K.armW, 0.008);
  bar.rotateY(-Math.PI / 2);
  g.add(meshAt(bar, castIron(), xc, 0, 0));
  const nut = mesh(halfNutGeo(thread110(which), nutPhase110(which), xc, front ? 0 : Math.PI), bronze());
  nut.name = front ? 'halfNutA' : 'halfNutB';
  g.add(nut);
  // 윤곽 받침 + 이름표가 따라갈 자리(너트 가운데, 롤러 축 위)
  const h = new THREE.Object3D();
  h.name = front ? 'nutA' : 'nutB';
  h.position.set(xc, K.D, 0);
  h.rotation.y = Math.PI / 2;
  h.userData.outline = halfNutOutline110(front ? 0 : Math.PI);
  g.add(h);
  return g;
}

/**
 * 110번 흔들 축 한 몸 — 축(막대) + 팔 2개(반너트 A 앞, B 뒤) + 레버. 원점 = 흔들 축 중심선 위, 롤러 가운데와 같은 x.
 * position.x 에 traverse110().x 를 더하고 rotation.x = traverse110().phi. child 'nutA'·'nutB'(너트 가운데), 'leverTop'(레버 위 끝).
 */
export function rockShaft110(): THREE.Group {
  const K = K110;
  const g = new THREE.Group();
  g.add(mesh(cylX(K.spindleR, K.spindleX0, K.spindleX1, 0.01), steel()));
  const a = arm110('A');
  a.rotation.x = K.delta;
  const b = arm110('B');
  b.rotation.x = -K.delta;
  g.add(a, b);
  // 레버: 허브 + 세로 막대 + 양 끝 손잡이 알 + 축 끝 너트
  g.add(mesh(tubeX(K.spindleR, 0.11, K.leverX - 0.1, K.leverX + 0.1, 0.012), darkSteel()));
  g.add(meshAt(cylY(0.03, -K.leverDown, K.leverUp, 0.006, 20), steel(), K.leverX, 0, 0));
  for (const y of [K.leverUp, -K.leverDown]) g.add(meshAt(new THREE.SphereGeometry(0.06, 20, 14), wood(), K.leverX, y, 0));
  const nutGeo = hexPrism(0.17, 0.06, true, true, 0);
  nutGeo.rotateZ(-Math.PI / 2);
  g.add(meshAt(nutGeo, darkSteel(), K.leverX + 0.14, 0, 0));
  const top = new THREE.Object3D();
  top.name = 'leverTop';
  top.position.set(K.leverX, K.leverUp, 0);
  g.add(top);
  setMM(g, { kind: 'rockShaft', axis: 'x', delta: K.delta });
  return g;
}

/**
 * 110번 틀 — 옆판 2개(롤러·흔들 축 구멍 자리에 축받이 고리, 구멍이 축 방향) + 받침 다리 2개(판화에 없음).
 * 원점 = 롤러 가운데. legH = 옆판 아랫면에서 받침대 윗면까지.
 */
export function frame110(legH: number): THREE.Group {
  const K = K110;
  const g = new THREE.Group();
  const y0 = -K.D - K.plateDown;
  const y1 = K.plateUp;
  for (const sx of [-1, 1]) {
    const xc = sx * (K.half + K.plateT / 2);
    g.add(meshAt(extrude(roundedRect(-K.plateT / 2, y0, K.plateT / 2, y1, 0.02), K.plateZ, 0.012), castIron(), xc, 0, 0));
    const xo = sx * (K.half + K.plateT);
    g.add(mesh(tubeX(K.journalR, K.journalR + 0.04, Math.min(xo, xo + sx * 0.03), Math.max(xo, xo + sx * 0.03), 0.006), darkSteel()));
    g.add(meshAt(tubeX(K.spindleR, K.spindleR + 0.04, Math.min(xo, xo + sx * 0.03), Math.max(xo, xo + sx * 0.03), 0.006), darkSteel(), 0, -K.D, 0));
    if (legH > 0) g.add(meshAt(extrude(roundedRect(-K.plateT / 2 - 0.04, -legH, K.plateT / 2 + 0.04, 0, 0.015), K.plateZ * 0.8, 0.01), darkSteel(), xc, y0, 0));
  }
  setMM(g, { kind: 'frame', fn: 'frame110' });
  return g;
}

// ═══════════════════════════ 111 마이크로미터(차동) 나사 ═══════════════════════════

/** 111번 치수. 나사 한 몸의 원점 = 굵은 나사와 가는 나사가 만나는 곳, 축 = +Y */
export const K111 = {
  /** 굵은(바깥) 나사: 피치·골 반지름·산 높이·길이 */
  p1: 0.2,
  r1: 0.16,
  d1: 0.08,
  len1: 0.76,
  /** 가는(안) 나사 */
  p2: 0.1,
  r2: 0.085,
  d2: 0.065,
  len2: 0.9,
  headLen: 0.2,
  tipLen: 0.08,
  /** 손잡이 막대(판화에 없음): 높이와 반길이 */
  handleY: 0.88,
  handleHalf: 0.3,
  /** 고정 너트: 가로·높이·깊이, 쉬는 자세에서 나사 원점 위 높이 */
  fixW: 1.1,
  fixH: 0.3,
  fixD: 0.5,
  fixAt: 0.38,
  /** 이동 너트: 가로·높이·깊이, 쉬는 자세에서 나사 원점 아래 깊이 */
  movW: 1.0,
  movH: 0.2,
  movD: 0.36,
  movAt: 0.45,
  /** 안내 막대(판화에 없음): 축에서의 거리·반지름·길이 */
  guideX: 0.42,
  guideR: 0.035,
  guideLen: 1.2,
  clear: 0.005,
  /** 나사를 돌리는 진폭(바퀴 수) */
  turns: 1
} as const;

export function thread111(which: 'outer' | 'inner', hand2: 1 | -1 = 1): ThreadSpec {
  const K = K111;
  return which === 'outer'
    ? { rCore: K.r1, depth: K.d1, pitch: K.p1, starts: 1, hand: 1, crest: 0.42, flank: 0.06 }
    : { rCore: K.r2, depth: K.d2, pitch: K.p2, starts: 1, hand: hand2, crest: 0.42, flank: 0.08 };
}

export interface Diff111 {
  /** 나사 회전각(rotation.y) */
  psi: number;
  /** 지금까지 돈 바퀴 수(부호 있음) */
  turns: number;
  /** 나사의 높이 변화(쉬는 자세 기준) = p1·turns */
  screwY: number;
  /** 이동 너트의 높이 변화 = (p1 − hand2·p2)·turns */
  nutY: number;
  /** +1 = 지금 반시계(위에서 보아)로 돌며 올라가는 중, −1 = 반대 */
  dir: 1 | -1;
}

/**
 * 111번 운동식. 나사를 ±turns 바퀴 사이로 되돌려 돌린다: psi = 2π·turns·sin(theta/2).
 * 굵은 오른나사가 고정 너트 안에서 돌면 나사 전체가 p1·(바퀴 수) 만큼 오르내리고,
 * 돌지 않는 이동 너트는 가는 나사 위에서 −hand2·p2·(바퀴 수) 만큼 더 움직인다.
 * hand2 = +1(같은 방향 나사) 이면 차 p1 − p2, −1(반대 방향) 이면 합 p1 + p2.
 */
export function diff111(theta: number, hand2: 1 | -1 = 1): Diff111 {
  const K = K111;
  const turns = K.turns * Math.sin(theta / 2);
  return { psi: TAU * turns, turns, screwY: K.p1 * turns, nutY: (K.p1 - hand2 * K.p2) * turns, dir: Math.cos(theta / 2) >= 0 ? 1 : -1 };
}

/**
 * 111번 나사 한 몸 — 머리 + 굵은 나사(오른나사) + 가는 나사(hand2) + 끝. 축 = +Y, 원점 = 두 나사가 만나는 곳.
 * rotation.y = psi, position.y = 쉬는 높이 + screwY. 손잡이 막대는 판화에 없음.
 * child 'secOuter'·'secInner' 가 바깥 원 윤곽(userData.outline)을 든다.
 */
export function diffScrew111(hand2: 1 | -1 = 1): THREE.Group {
  const K = K111;
  const g = new THREE.Group();
  const so = thread111('outer');
  const si = thread111('inner', hand2);
  g.add(mesh(screwGeo(so, 0, K.len1, { segs: 64, rows: 14 }), steel()));
  g.add(mesh(screwGeo(si, -K.len2, 0, { segs: 56, rows: 12 }), brass()));
  // 머리(위로 조금 가늘어짐)와 아래 끝
  g.add(mesh(lathe([[0, K.len1], [K.r1, K.len1], [K.r1 - 0.02, K.len1 + K.headLen - 0.01], [K.r1 - 0.03, K.len1 + K.headLen], [0, K.len1 + K.headLen]], 40), steel()));
  g.add(mesh(lathe([[0, -K.len2 - K.tipLen], [K.r2 - 0.04, -K.len2 - K.tipLen], [K.r2 - 0.015, -K.len2 - K.tipLen + 0.025], [K.r2 - 0.015, -K.len2], [0, -K.len2]], 32), brass()));
  // 손잡이 막대(판화에 없음)
  const bar = cylY(0.028, -K.handleHalf, K.handleHalf, 0.006, 18);
  bar.rotateZ(-Math.PI / 2);
  g.add(meshAt(bar, darkSteel(), 0, K.handleY, 0));
  for (const sx of [-1, 1]) g.add(meshAt(new THREE.SphereGeometry(0.05, 18, 12), wood(), sx * K.handleHalf, K.handleY, 0));
  const a = holderY('secOuter', K.fixAt);
  a.userData.outline = circlePts(K.r1 + K.d1, 48);
  const b = holderY('secInner', -K.movAt);
  b.userData.outline = circlePts(K.r2 + K.d2, 48);
  g.add(a, b);
  setMM(g, { kind: 'screw', fn: 'diffScrew111', axis: 'y', p1: K.p1, p2: K.p2, hand2 });
  return g;
}

/** 구멍 난 판(가로 w × 깊이 d, 두께 h — 구멍이 Y 방향). 원점 중심 */
function plateWithHoles(w: number, d: number, h: number, holes: [number, number, number][], c = 0.012): THREE.BufferGeometry {
  const sh = roundedRect(-w / 2, -d / 2, w / 2, d / 2, 0.03);
  for (const [x, z, r] of holes) sh.holes.push(circlePath(x, -z, r));
  const geo = extrude(sh, h, c, 32);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * 111번 고정 너트 틀 — 구멍 난 고정 너트 덩이 + 뒤판까지의 받침 팔(판화에 없음) + 아래로 드리운 안내 막대 2개(판화에 없음).
 * 원점 = 고정 너트 가운데(구멍 축 = Y). back = 원점에서 뒤판 앞면까지의 z 거리(양수).
 * child 'fixBore'(userData.outlines.boreHole), 'guideL'·'guideR'(userData.outline).
 */
export function nutFrame111(back: number): THREE.Group {
  const K = K111;
  const g = new THREE.Group();
  const bore = K.r1 + K.d1 + K.clear;
  g.add(mesh(plateWithHoles(K.fixW, K.fixD, K.fixH, [[0, 0, bore]]), castIron()));
  const armLen = back - K.fixD / 2;
  if (armLen > 0) g.add(meshAt(new THREE.BoxGeometry(0.4, K.fixH * 0.7, armLen), castIron(), 0, 0, -K.fixD / 2 - armLen / 2));
  const y1 = -K.fixH / 2;
  for (const sx of [-1, 1]) {
    g.add(meshAt(cylY(K.guideR, y1 - K.guideLen, y1 + 0.02, 0.005, 20), steel(), sx * K.guideX, 0, 0));
    g.add(meshAt(hexPrism(0.11, 0.05, true, true, 0), darkSteel(), sx * K.guideX, y1 - K.guideLen + 0.025, 0));
    const h = holderY(sx < 0 ? 'guideL' : 'guideR', -K.fixAt - K.movAt);
    h.position.x = sx * K.guideX;
    h.userData.outline = circlePts(K.guideR, 24);
    g.add(h);
  }
  const hb = holderY('fixBore', 0);
  hb.userData.outlines = { boreHole: circlePts(bore, 48) };
  g.add(hb);
  setMM(g, { kind: 'nut', fn: 'nutFrame111', fixed: true, bore });
  return g;
}

/**
 * 111번 이동 너트(다이) — 가는 나사에 끼운 가로대. 양 끝 구멍이 안내 막대에 끼워져 돌지 못한다. 원점 = 가운데(구멍 축 = Y).
 * position.y = 쉬는 높이 + nutY. child 'movBore'(userData.outlines.boreHole·guideHoleL·guideHoleR).
 */
export function travelNut111(): THREE.Group {
  const K = K111;
  const g = new THREE.Group();
  const bore = K.r2 + K.d2 + K.clear;
  const gh = K.guideR + K.clear;
  g.add(mesh(plateWithHoles(K.movW, K.movD, K.movH, [[0, 0, bore], [-K.guideX, 0, gh], [K.guideX, 0, gh]]), bronze()));
  // 눈금 바늘(움직임이 보이게): 앞면의 노란 줄
  g.add(meshAt(new THREE.BoxGeometry(0.3, 0.014, 0.01), paint(MARK), 0, 0, K.movD / 2 + 0.002));
  const h = holderY('movBore', 0);
  h.userData.outlines = { boreHole: circlePts(bore, 48), guideHoleL: circlePts(gh, 24, -K.guideX, 0), guideHoleR: circlePts(gh, 24, K.guideX, 0) };
  g.add(h);
  setMM(g, { kind: 'nut', fn: 'travelNut111', fixed: false, bore });
  return g;
}

// ═══════════════════════════ 112 페르시아 드릴 ═══════════════════════════

/** 112번 치수. 드릴 몸통의 원점 = 날 끝, 축 = +Y */
export const K112 = {
  /** 날 길이·반지름 */
  bitLen: 0.34,
  bitR: 0.05,
  /** 물림쇠(네모 덩이) 높이·맞변 거리 */
  ferruleLen: 0.2,
  ferruleAF: 0.24,
  /** 나사 몸통: 길이·골 반지름·산 높이·줄 수·리드(한 바퀴에 0.8 — 아주 급한 나사) */
  stockLen: 1.6,
  rCore: 0.075,
  depth: 0.02,
  starts: 6,
  lead: 0.8,
  /** 머리 속으로 들어가는 핀 */
  pinLen: 0.12,
  pinR: 0.05,
  /** 머리: 고리(칼라) 반지름·높이, 목 높이, 갓 반지름·높이 */
  collarR: 0.153,
  collarH: 0.09,
  neckH: 0.126,
  capR: 0.33,
  capH: 0.153,
  /** 손잡이 너트(실패 꼴): 테 반지름·허리 반지름·아래 테 높이·허리 높이·위 테 높이 */
  nutR: 0.29,
  waistR: 0.225,
  nutLow: 0.09,
  nutWaist: 0.135,
  nutUp: 0.125,
  clear: 0.004,
  /** 너트가 오르내리는 진폭 */
  amp: 0.5,
  /** 판화 자세(t = 1)에서의 구동각 */
  pose: 1.6
} as const;

export function thread112(): ThreadSpec {
  const K = K112;
  return { rCore: K.rCore, depth: K.depth, pitch: K.lead / K.starts, starts: K.starts, hand: 1, crest: 0.3, flank: 0.2 };
}

/** 나사 몸통의 아래 끝·가운데·위 끝(몸통 로컬 y) */
export function stockSpan112(): { y0: number; mid: number; y1: number } {
  const y0 = K112.bitLen + K112.ferruleLen;
  return { y0, mid: y0 + K112.stockLen / 2, y1: y0 + K112.stockLen };
}

export interface Drill112 {
  /** 너트 높이(나사 몸통 가운데 기준, ±amp) */
  nutY: number;
  /** 몸통 회전각(rotation.y) = −2π·nutY/lead */
  psi: number;
  /** 너트가 지금 올라가는 중(+1)인가 내려가는 중(−1)인가 */
  dir: 1 | -1;
}

/**
 * 112번 운동식. 손이 너트를 nutY = amp·sin(theta − pose) 로 오르내린다(t = 1 에서 가운데 = 판화 자세).
 * 너트는 돌지 않으므로 오른나사 몸통이 psi = −2π·nutY/lead 만큼 돈다(너트가 올라가면 위에서 보아 시계, 내려가면 반시계).
 */
export function drill112(theta: number): Drill112 {
  const K = K112;
  const nutY = K.amp * Math.sin(theta - K.pose);
  return { nutY, psi: (-TAU * nutY) / K.lead, dir: Math.cos(theta - K.pose) >= 0 ? 1 : -1 };
}

/**
 * 112번 드릴 몸통 — 날 + 네모 물림쇠 + 여러 줄 급한 나사 + 머리에 들어가는 핀. 축 = +Y, 원점 = 날 끝. rotation.y = psi.
 * child 'stockSec' 이 단면 윤곽(userData.outline)을 든다 — setSection112 로 너트 높이에 옮긴다.
 */
export function drillStock112(): THREE.Group {
  const K = K112;
  const g = new THREE.Group();
  const sp = stockSpan112();
  // 날: 뾰족 끝 + 몸
  g.add(mesh(lathe([[0, 0], [K.bitR, 0.1], [K.bitR, K.bitLen], [0, K.bitLen]], 20), darkSteel()));
  // 물림쇠: 네모 기둥(도는 것이 보인다)
  const sq = polygonRadius(K.ferruleAF, 4);
  g.add(mesh(radialSurface((th) => sq(th), [K.bitLen, sp.y0], 4 * 8, 0, 0, 30), darkSteel()));
  g.add(mesh(screwGeo(thread112(), sp.y0, sp.y1, { segs: 72, rows: 10 }), brass()));
  g.add(mesh(cylY(K.pinR, sp.y1, sp.y1 + K.pinLen, 0.008), steel()));
  const h = holderY('stockSec', sp.mid);
  const s = thread112();
  h.userData.outline = sectionPts((th) => threadR(s, th, 0), 96);
  g.add(h);
  setSection112(g, sp.mid);
  setMM(g, { kind: 'screw', fn: 'drillStock112', axis: 'y', lead: K.lead, starts: K.starts, rCore: K.rCore, rOuter: K.rCore + K.depth });
  return g;
}

/** 몸통 로컬 높이 h 의 단면으로 윤곽 받침('stockSec')을 옮긴다(단면은 높이에 따라 2π·h/lead 만큼 돌아간다) */
export function setSection112(stock: THREE.Object3D, h: number): void {
  const o = stock.getObjectByName('stockSec');
  if (!o) return;
  o.position.y = h;
  o.rotation.set(-Math.PI / 2, (TAU * h) / K112.lead, 0);
}

/**
 * 112번 머리(가슴받이) — 고리 + 목 + 버섯 갓, 고정. 원점 = 고리 아랫면 가운데(몸통 나사의 위 끝이 닿는 곳).
 * back > 0 이면 갓 뒤에서 뒤판까지 받침 팔(판화에 없음)을 단다(back = 원점에서 뒤판 앞면까지의 z 거리).
 */
export function drillHead112(back = 0): THREE.Group {
  const K = K112;
  const g = new THREE.Group();
  const y1 = K.collarH;
  const y2 = y1 + K.neckH;
  const y3 = y2 + K.capH;
  const prof: V2[] = [[K.pinR + 0.004, 0], [K.collarR - 0.008, 0], [K.collarR, 0.008], [K.collarR, y1 - 0.008], [K.collarR - 0.008, y1], [K.collarR - 0.03, y1]];
  // 목: 위로 벌어지는 오목 곡선
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    prof.push([K.collarR - 0.03 + (K.capR - 0.02 - (K.collarR - 0.03)) * t * t, y1 + K.neckH * t]);
  }
  prof.push([K.capR, y2 + 0.012]);
  // 갓: 둥근 윗면
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    prof.push([K.capR * Math.cos(a), y2 + 0.012 + (K.capH - 0.012) * Math.sin(a)]);
  }
  g.add(mesh(lathe(prof, 48), wood()));
  if (back > 0) {
    const z0 = -K.capR * 0.6;
    const len = back + z0;
    if (len > 0) g.add(meshAt(new THREE.BoxGeometry(0.22, 0.1, len), castIron(), 0, y2 + 0.07, z0 - len / 2));
  }
  setMM(g, { kind: 'head', fn: 'drillHead112', top: y3 });
  return g;
}

/**
 * 112번 손잡이 너트(단추) — 위아래 테와 오목한 허리가 있는 실패 꼴. 돌지 않고 position.y 만 바뀐다. 원점 = 가운데.
 * 구멍은 몸통 나사 단면 + 틈. child 'nutBore'(userData.outlines.boreHole). 옆면의 노란 점은 "돌지 않음" 표시.
 */
export function drillNut112(): THREE.Group {
  const K = K112;
  const g = new THREE.Group();
  const rIn = K.rCore + K.depth + K.clear;
  const hh = (K.nutLow + K.nutWaist + K.nutUp) / 2;
  const a = -hh;
  const b = a + K.nutLow;
  const c = b + K.nutWaist;
  const d = hh;
  const prof: V2[] = [[rIn, a], [K.nutR - 0.01, a], [K.nutR, a + 0.01], [K.nutR, b - 0.01], [K.nutR - 0.01, b]];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    prof.push([K.waistR + 0.03 * (2 * t - 1) * (2 * t - 1), b + K.nutWaist * t]);
  }
  prof.push([K.nutR - 0.01, c], [K.nutR, c + 0.01], [K.nutR, d - 0.045], [K.nutR - 0.05, d], [rIn, d], [rIn, a]);
  g.add(mesh(lathe(prof, 56), wood(0x8a5a33)));
  g.add(meshAt(new THREE.SphereGeometry(0.022, 14, 10), paint(MARK), 0, a + K.nutLow / 2, K.nutR));
  const s = thread112();
  const h = holderY('nutBore', 0);
  h.rotation.set(-Math.PI / 2, (TAU * stockSpan112().mid) / K.lead, 0);
  h.userData.outlines = { boreHole: sectionPts((th) => threadR(s, th, 0) + K.clear, 96) };
  g.add(h);
  setMM(g, { kind: 'nut', fn: 'drillNut112', fixed: false, bore: rIn });
  return g;
}

/** 112번 받침 나무(판화에 없음) — 날 끝이 얹히는 나무토막. 원점 = 윗면 가운데(날 끝 자리), 아래로 h */
export function workBlock112(h: number): THREE.Group {
  const g = new THREE.Group();
  const geo = extrude(roundedRect(-0.4, -h, 0.4, 0, 0.02), 0.5, 0.012);
  g.add(mesh(geo, wood(0xb98a55)));
  g.add(meshAt(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 16), paint(0x3a2a1c), 0, 0.001, 0));
  setMM(g, { kind: 'work', fn: 'workBlock112', h });
  return g;
}
