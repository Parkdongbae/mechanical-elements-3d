// 부품 모델링 공용 지오메트리 도구
// 회전체(lathe)·반경함수 회전면·나선 나사산·스윕·로프트(기어 치형 비틀기/수렴)를 직접 BufferGeometry로 만든다.
// 모든 결과는 "주름 법선(creased normals)"으로 정리 — 곡면은 매끈하게, 모서리는 날카롭게 보이도록.

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V2 = [number, number];
export const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ─────────────────────────── 기본 정리 ───────────────────────────

/**
 * 주름 각 이하로 꺾이는 면끼리만 법선을 평균한다.
 * toCreasedNormals는 좌표를 0.01 격자로 해시하므로, 작은 부품이 뭉개지지 않게 1000배 키운 뒤 계산한다.
 */
export function creased(geo: THREE.BufferGeometry, deg = 36): THREE.BufferGeometry {
  geo.scale(1000, 1000, 1000);
  const out = toCreasedNormals(geo, deg * DEG);
  if (out !== geo) geo.dispose();
  out.scale(0.001, 0.001, 0.001);
  return out;
}

/** 병합 가능하도록 속성을 position/normal/uv(/color)로 통일하고 비인덱스화 */
function unify(geo: THREE.BufferGeometry, withColor: boolean): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const count = g.getAttribute('position').count;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  if (withColor && !g.getAttribute('color')) {
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  }
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv' && !(withColor && name === 'color')) g.deleteAttribute(name);
  }
  return g;
}

export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const withColor = geos.some((g) => !!g.getAttribute('color'));
  const list = geos.map((g) => unify(g, withColor));
  const out = mergeGeometries(list, false);
  if (!out) throw new Error('mergeGeometries failed');
  geos.forEach((g) => g.dispose());
  list.forEach((g) => g.dispose());
  return out;
}

/** 지오메트리 전체에 단색 정점색 부여(체인처럼 한 메시에 여러 톤을 담을 때) */
export function tint(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  return geo;
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, parent?: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// ─────────────────────────── 회전체 ───────────────────────────

/** (r, y) 프로파일을 Y축 둘레로 회전. 바깥면이 앞면이 되려면 바깥벽에서 y가 증가하는 방향(단면 반시계)으로 적는다. */
export function lathe(profile: V2[], segs = 48, phiStart = 0, phiLength = TAU, crease = 36): THREE.BufferGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  return creased(new THREE.LatheGeometry(pts, segs, phiStart, phiLength), crease);
}

/** 모따기 있는 원기둥 프로파일 (Y축, y0→y1) */
export function rodProfile(r: number, y0: number, y1: number, c0 = 0, c1 = 0): V2[] {
  const p: V2[] = [[0, y0]];
  if (c0 > 0) p.push([r - c0, y0], [r, y0 + c0]);
  else p.push([r, y0]);
  if (c1 > 0) p.push([r, y1 - c1], [r - c1, y1]);
  else p.push([r, y1]);
  p.push([0, y1]);
  return p;
}

/** 관(구멍 있는 원통) 단면 — 바깥·안쪽 모서리 모따기 */
export function tubeProfile(rIn: number, rOut: number, y0: number, y1: number, c = 0): V2[] {
  return [
    [rIn + c, y0],
    [rOut - c, y0],
    [rOut, y0 + c],
    [rOut, y1 - c],
    [rOut - c, y1],
    [rIn + c, y1],
    [rIn, y1 - c],
    [rIn, y0 + c],
    [rIn + c, y0]
  ];
}

/** 계단 축 프로파일: steps를 y0부터 차례로 쌓는다. 바깥으로 튀어나온 모서리마다 모따기 c */
export function steppedProfile(steps: { r: number; len: number }[], y0: number, c: number): V2[] {
  const p: V2[] = [];
  let y = y0;
  const first = steps[0];
  if (!first) return p;
  p.push([0, y], [first.r - c, y], [first.r, y + c]);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    const next = steps[i + 1];
    y += s.len;
    if (!next) {
      p.push([s.r, y - c], [s.r - c, y], [0, y]);
    } else if (next.r > s.r) {
      p.push([s.r, y], [next.r - c, y], [next.r, y + c]);
    } else if (next.r < s.r) {
      p.push([s.r, y - c], [s.r - c, y], [next.r, y]);
    }
  }
  return p;
}

// ─────────────────────────── 반경함수 회전면 ───────────────────────────

/** 바깥 경계 rOuter(θ), 안쪽 반지름 rIn 인 평면 고리(뚜껑). up=true면 +Y를 향함 */
function ringCap(rOuter: (th: number) => number, rIn: number, y: number, segs: number, up: boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const ny = up ? 1 : -1;
  for (let i = 0; i < segs; i++) {
    const t0 = (i / segs) * TAU;
    const t1 = ((i + 1) / segs) * TAU;
    const ro0 = rOuter(t0);
    const ro1 = rOuter(t1);
    const o0: V2 = [ro0 * Math.sin(t0), ro0 * Math.cos(t0)];
    const o1: V2 = [ro1 * Math.sin(t1), ro1 * Math.cos(t1)];
    const i0: V2 = [rIn * Math.sin(t0), rIn * Math.cos(t0)];
    const i1: V2 = [rIn * Math.sin(t1), rIn * Math.cos(t1)];
    const tris: V2[][] = up ? [[o0, o1, i0], [o1, i1, i0]] : [[o0, i0, o1], [o1, i0, i1]];
    for (const tri of tris) {
      for (const [x, z] of tri) {
        pos.push(x, y, z);
        nrm.push(0, ny, 0);
        uv.push(x, z);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** 격자 정점 배열(열=θ, 행=높이)로 회전면 삼각형을 만든다. 바깥이 앞면. */
function gridSurface(pos: number[], uv: number[], cols: number, rows: number): THREE.BufferGeometry {
  const idx: number[] = [];
  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j;
      const b = (i + 1) * rows + j;
      const c = b + 1;
      const d = a + 1;
      idx.push(a, b, d, c, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * 반지름이 각도·높이에 따라 달라지는 회전면 (육각 머리 모따기, 평면 가공부 등).
 * ys는 오름차순. capBottom/capTop: 뚜껑 안쪽 반지름(0=막힘), null=뚜껑 없음.
 */
export function radialSurface(
  rFn: (theta: number, y: number) => number,
  ys: number[],
  segs: number,
  capBottom: number | null = 0,
  capTop: number | null = 0,
  crease = 36
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const rows = ys.length;
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * TAU;
    const s = Math.sin(th);
    const c = Math.cos(th);
    for (let j = 0; j < rows; j++) {
      const y = ys[j]!;
      const r = rFn(th, y);
      pos.push(r * s, y, r * c);
      uv.push(i / segs, y * 2);
    }
  }
  const parts = [gridSurface(pos, uv, segs + 1, rows)];
  const yb = ys[0]!;
  const yt = ys[rows - 1]!;
  if (capBottom !== null) parts.push(ringCap((t) => rFn(t, yb), capBottom, yb, segs, false));
  if (capTop !== null) parts.push(ringCap((t) => rFn(t, yt), capTop, yt, segs, true));
  return creased(merge(parts), crease);
}

/** 정다각형(육각) 반경 함수: 맞변거리 af, 꼭짓점이 θ=0(+Z)을 향함 */
export function polygonRadius(af: number, sides = 6): (th: number) => number {
  const seg = TAU / sides;
  return (th: number) => {
    let m = th % seg;
    if (m < 0) m += seg;
    return af / 2 / Math.cos(m - seg / 2);
  };
}

/**
 * 육각 너트/머리. y ∈ [-h/2, h/2], 30° 모따기(면 쪽 원 지름 ≈ 0.95·맞변거리).
 * bore: 구멍 반지름(0이면 막힘)
 */
export function hexPrism(af: number, h: number, chamferBottom: boolean, chamferTop: boolean, bore = 0): THREE.BufferGeometry {
  const hex = polygonRadius(af);
  const rFace = af * 0.5 * 0.94;
  const rCorner = af / Math.sqrt(3);
  const k = Math.tan(60 * DEG);
  const cz = (rCorner - rFace) / k;
  const ys: number[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) ys.push(-h / 2 + (chamferBottom ? (cz * i) / n : (i === 0 ? 0 : h * 0.02 * i)));
  for (let i = n; i >= 0; i--) ys.push(h / 2 - (chamferTop ? (cz * i) / n : (i === 0 ? 0 : h * 0.02 * i)));
  const sorted = [...new Set(ys.map((v) => Math.round(v * 1e7) / 1e7))].sort((a, b) => a - b);
  const rFn = (th: number, y: number): number => {
    let r = hex(th);
    if (chamferBottom) r = Math.min(r, rFace + (y + h / 2) * k);
    if (chamferTop) r = Math.min(r, rFace + (h / 2 - y) * k);
    return r;
  };
  const shell = radialSurface(rFn, sorted, 72, bore, bore, 40);
  if (bore <= 0) return shell;
  // 구멍 안쪽 벽 (안쪽을 향하도록 위→아래로 적음)
  const inner = lathe([[bore, h / 2], [bore, -h / 2]], 32);
  return merge([shell, inner]);
}

// ─────────────────────────── 나선 나사산 ───────────────────────────

export interface ThreadOpts {
  rMajor: number;
  depth: number;
  pitch: number;
  y0: number;
  y1: number;
  segs?: number;
  /** 산 형상: u∈[0,1) → 0(골)~1(산). 기본 ISO 60° */
  profile?: (u: number) => number;
  /** 프로파일의 꺾이는 위치들(행이 정확히 지나가도록) */
  uSamples?: number[];
  /** 위상 오프셋(맞물림 정렬용) */
  u0?: number;
  /** 끝단 45° 모따기 */
  chamfer0?: boolean;
  chamfer1?: boolean;
  /** 나사산이 사라지는 길이(불완전 나사부) */
  fade0?: number;
  fade1?: number;
  capBottom?: boolean;
  capTop?: boolean;
}

/** 사다리꼴 나사산 프로파일 생성: 산 중심 u=0.5, 골폭/산폭(피치 비율) */
export function trapezoidThread(rootFrac: number, crestFrac: number): { profile: (u: number) => number; uSamples: number[] } {
  const r2 = rootFrac / 2;
  const c0 = 0.5 - crestFrac / 2;
  const c1 = 0.5 + crestFrac / 2;
  const profile = (u: number): number => {
    if (u <= r2 || u >= 1 - r2) return 0;
    if (u < c0) return (u - r2) / (c0 - r2);
    if (u <= c1) return 1;
    return (1 - r2 - u) / (1 - r2 - c1);
  };
  const flankMid0 = (r2 + c0) / 2;
  const flankMid1 = (c1 + 1 - r2) / 2;
  return { profile, uSamples: [0, r2, flankMid0, c0, 0.5, c1, flankMid1, 1 - r2] };
}

export const ISO_THREAD = trapezoidThread(0.25, 0.125);

/**
 * 실제 나선 나사산 솔리드 표면. 격자 행을 나선을 따라 배치해 산·골 모서리가 계단 없이 이어진다.
 * 축 = Y, 오른나사.
 */
export function threadedRod(o: ThreadOpts): THREE.BufferGeometry {
  const segs = o.segs ?? 64;
  const { profile, uSamples } = o.profile && o.uSamples ? { profile: o.profile, uSamples: o.uSamples } : ISO_THREAD;
  const p = o.pitch;
  const u0 = o.u0 ?? 0;
  const rTip = o.rMajor - o.depth * 1.15;
  const rAt = (u: number, y: number): number => {
    let env = 1;
    if (o.fade1 && y > o.y1 - o.fade1) env = Math.min(env, (o.y1 - y) / o.fade1);
    if (o.fade0 && y < o.y0 + o.fade0) env = Math.min(env, (y - o.y0) / o.fade0);
    env = Math.max(0, Math.min(1, env));
    env = env * env * (3 - 2 * env);
    let r = o.rMajor - o.depth * (1 - profile(u)) * env;
    if (o.chamfer0) r = Math.min(r, rTip + (y - o.y0));
    if (o.chamfer1) r = Math.min(r, rTip + (o.y1 - y));
    return r;
  };
  const kStart = Math.floor(o.y0 / p) - 2;
  const kEnd = Math.ceil(o.y1 / p) + 1;
  const rowsBase: { y: number; u: number }[] = [];
  for (let k = kStart; k <= kEnd; k++) {
    for (const u of uSamples) {
      const yb = (k + u - u0) * p;
      // 한 바퀴 동안 [y0, y1]에 걸치는 행만 사용
      if (yb + p < o.y0 || yb > o.y1) continue;
      rowsBase.push({ y: yb, u });
    }
  }
  const rows = rowsBase.length;
  const pos: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * TAU;
    const s = Math.sin(th);
    const c = Math.cos(th);
    for (const row of rowsBase) {
      const y = Math.min(o.y1, Math.max(o.y0, row.y + (p * th) / TAU));
      const r = rAt(row.u, y);
      pos.push(r * s, y, r * c);
      uv.push(i / segs, y * 3);
    }
  }
  const parts = [gridSurface(pos, uv, segs + 1, rows)];
  if (o.capBottom ?? true) parts.push(ringCap((t) => rAt(frac(o.y0 / p - t / TAU + u0), o.y0), 0, o.y0, segs, false));
  if (o.capTop ?? false) parts.push(ringCap((t) => rAt(frac(o.y1 / p - t / TAU + u0), o.y1), 0, o.y1, segs, true));
  return creased(merge(parts), 40);
}

function frac(x: number): number {
  return x - Math.floor(x);
}

// ─────────────────────────── 스윕 ───────────────────────────

/**
 * 경로(점·법선 N·종법선 B)를 따라 2D 단면(n, b)을 스윕. 단면은 (n, b) 평면 반시계.
 * (N, B, T)가 오른손 좌표계(B = T × N)일 때 바깥이 앞면.
 */
export function sweep(
  pts: THREE.Vector3[],
  ns: THREE.Vector3[],
  bs: THREE.Vector3[],
  profile: V2[],
  closed: boolean,
  caps = true,
  crease = 40
): THREE.BufferGeometry {
  const np = profile.length;
  const nk = pts.length;
  const pos: number[] = [];
  const uv: number[] = [];
  let acc = 0;
  for (let k = 0; k < nk; k++) {
    const P = pts[k]!;
    const N = ns[k]!;
    const B = bs[k]!;
    if (k > 0) acc += P.distanceTo(pts[k - 1]!);
    for (let m = 0; m < np; m++) {
      const [a, b] = profile[m]!;
      pos.push(P.x + N.x * a + B.x * b, P.y + N.y * a + B.y * b, P.z + N.z * a + B.z * b);
      uv.push(acc * 4, m / np);
    }
  }
  const idx: number[] = [];
  const kMax = closed ? nk : nk - 1;
  for (let k = 0; k < kMax; k++) {
    const k1 = (k + 1) % nk;
    for (let m = 0; m < np; m++) {
      const m1 = (m + 1) % np;
      const a = k * np + m;
      const b = k1 * np + m;
      const c = k1 * np + m1;
      const d = k * np + m1;
      idx.push(a, d, b, b, d, c);
    }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.setIndex(idx);
  const parts: THREE.BufferGeometry[] = [body];
  if (!closed && caps) {
    const contour = profile.map(([a, b]) => new THREE.Vector2(a, b));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const end of [0, nk - 1]) {
      const P = pts[end]!;
      const N = ns[end]!;
      const B = bs[end]!;
      const T = end === 0 ? pts[1]!.clone().sub(P) : P.clone().sub(pts[end - 1]!);
      T.normalize();
      if (end === 0) T.negate();
      const cp: number[] = [];
      for (const f of faces) {
        const tri = f.map((i) => {
          const [a, b] = profile[i]!;
          return new THREE.Vector3(P.x + N.x * a + B.x * b, P.y + N.y * a + B.y * b, P.z + N.z * a + B.z * b);
        });
        const nrm = new THREE.Vector3().crossVectors(tri[1]!.clone().sub(tri[0]!), tri[2]!.clone().sub(tri[0]!));
        if (nrm.dot(T) < 0) tri.reverse();
        for (const v of tri) cp.push(v.x, v.y, v.z);
      }
      const cap = new THREE.BufferGeometry();
      cap.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
      parts.push(cap);
    }
  }
  return creased(merge(parts), crease);
}

/** 평면(XY) 경로 스윕: N = 진행방향 왼쪽(평면 내), B = +Z */
export function sweepPlanar(path: V2[], profile: V2[], closed: boolean, caps = true): THREE.BufferGeometry {
  const n = path.length;
  const pts: THREE.Vector3[] = [];
  const ns: THREE.Vector3[] = [];
  const bs: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const p = path[i]!;
    const prev = closed ? path[(i - 1 + n) % n]! : path[Math.max(0, i - 1)]!;
    const next = closed ? path[(i + 1) % n]! : path[Math.min(n - 1, i + 1)]!;
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const l = Math.hypot(tx, ty) || 1;
    pts.push(new THREE.Vector3(p[0], p[1], 0));
    ns.push(new THREE.Vector3(-ty / l, tx / l, 0));
    bs.push(new THREE.Vector3(0, 0, 1));
  }
  return sweep(pts, ns, bs, profile, closed, caps);
}

// ─────────────────────────── 로프트 (기어) ───────────────────────────

export interface LoftLayer {
  z: number;
  /** 외곽 배율 */
  s: number;
  /** 구멍 배율 */
  hs?: number;
  /** 회전(rad) — 헬리컬 비틀림 */
  rot?: number;
}

/**
 * 2D 외곽(반시계)+구멍을 층마다 회전·축소하며 Z로 쌓아 솔리드를 만든다.
 * 헬리컬 기어(비틀림), 베벨 기어(꼭짓점으로 수렴), 웜 휠(오목 목) 공용. 양끝 뚜껑 포함.
 */
export function loft(outlineIn: V2[], holesIn: V2[][], layers: LoftLayer[], crease = 34): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 모든 고리를 반시계로 통일(벽 법선 방향 계산의 전제)
  const ccw = (ring: V2[]): V2[] =>
    THREE.ShapeUtils.isClockWise(ring.map(([x, y]) => new THREE.Vector2(x, y))) ? [...ring].reverse() : ring;
  const outline = ccw(outlineIn);
  const holes = holesIn.map(ccw);
  const xf = (p: V2, L: LoftLayer, isHole: boolean): THREE.Vector3 => {
    const s = isHole ? (L.hs ?? 1) : L.s;
    const r = L.rot ?? 0;
    const c = Math.cos(r);
    const sn = Math.sin(r);
    const x = p[0] * s;
    const y = p[1] * s;
    return new THREE.Vector3(x * c - y * sn, x * sn + y * c, L.z);
  };
  const wall = (ring: V2[], isHole: boolean): void => {
    const n = ring.length;
    const pos: number[] = [];
    const uv: number[] = [];
    for (const L of layers) {
      for (let m = 0; m < n; m++) {
        const v = xf(ring[m]!, L, isHole);
        pos.push(v.x, v.y, v.z);
        uv.push(m / n * 8, L.z * 3);
      }
    }
    const idx: number[] = [];
    for (let l = 0; l < layers.length - 1; l++) {
      for (let m = 0; m < n; m++) {
        const m1 = (m + 1) % n;
        const a = l * n + m;
        const b = l * n + m1;
        const c = (l + 1) * n + m1;
        const d = (l + 1) * n + m;
        if (isHole) idx.push(a, c, b, a, d, c);
        else idx.push(a, b, c, a, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    parts.push(g);
  };
  wall(outline, false);
  holes.forEach((h) => wall(h, true));

  // 뚜껑
  let contour = outline.map(([x, y]) => new THREE.Vector2(x, y));
  if (!THREE.ShapeUtils.isClockWise(contour)) contour = contour.reverse();
  const holeVecs = holes.map((h) => {
    let v = h.map(([x, y]) => new THREE.Vector2(x, y));
    if (THREE.ShapeUtils.isClockWise(v)) v = v.reverse();
    return v;
  });
  const faces = THREE.ShapeUtils.triangulateShape(contour, holeVecs);
  const flat: { p: V2; hole: boolean }[] = [
    ...contour.map((v) => ({ p: [v.x, v.y] as V2, hole: false })),
    ...holeVecs.flatMap((h) => h.map((v) => ({ p: [v.x, v.y] as V2, hole: true })))
  ];
  for (const [li, up] of [[0, false], [layers.length - 1, true]] as const) {
    const L = layers[li]!;
    const cp: number[] = [];
    for (const f of faces) {
      const tri = f.map((i) => {
        const e = flat[i]!;
        return xf(e.p, L, e.hole);
      });
      const nz = (tri[1]!.x - tri[0]!.x) * (tri[2]!.y - tri[0]!.y) - (tri[1]!.y - tri[0]!.y) * (tri[2]!.x - tri[0]!.x);
      if ((nz > 0) !== up) tri.reverse();
      for (const v of tri) cp.push(v.x, v.y, v.z);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    const uvs = new Float32Array((cp.length / 3) * 2);
    for (let i = 0; i < cp.length / 3; i++) {
      uvs[i * 2] = cp[i * 3]!;
      uvs[i * 2 + 1] = cp[i * 3 + 1]!;
    }
    cap.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    parts.push(cap);
  }
  return creased(merge(parts), crease);
}

/** 원 점열 (반시계) */
export function circlePts(r: number, n = 48, cx = 0, cy = 0): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// ─────────────────────────── 압출 ───────────────────────────

/** Shape를 Z로 압출(중심 정렬). 모따기 c는 외곽을 키우지 않고 안쪽으로 깎는다. */
export function extrude(shape: THREE.Shape | THREE.Shape[], depth: number, c = 0, curveSegments = 24, bevelSegments = 1): THREE.BufferGeometry {
  const core = Math.max(0.0001, depth - 2 * c);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: c > 0,
    bevelThickness: c,
    bevelSize: c,
    bevelOffset: -c,
    bevelSegments,
    curveSegments
  });
  geo.translate(0, 0, -core / 2);
  return creased(geo, 34);
}

export function shapeFrom(pts: V2[]): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

export function pathFrom(pts: V2[]): THREE.Path {
  const s = new THREE.Path();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

export function circlePath(cx: number, cy: number, r: number): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, TAU, true);
  return p;
}

/** 양끝이 둥근 막대(스타디움) — 두 중심 (x0,y0)-(x1,y1), 반폭 w */
export function stadiumShape(x0: number, y0: number, x1: number, y1: number, w: number): THREE.Shape {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const s = new THREE.Shape();
  s.absarc(x1, y1, w, ang - Math.PI / 2, ang + Math.PI / 2, false);
  s.absarc(x0, y0, w, ang + Math.PI / 2, ang + Math.PI * 1.5, false);
  s.closePath();
  return s;
}

/** 둥근 모서리 사각형 */
export function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  s.closePath();
  return s;
}

/** 부채꼴 고리(annular sector) — 각 a0→a1, 반지름 r0~r1, 모서리 둥글림 없음 */
export function annularSector(r0: number, r1: number, a0: number, a1: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  s.closePath();
  return s;
}

/** 구멍용 부채꼴 고리(양끝 둥근 강낭콩 모양) */
export function kidneyPath(rMid: number, halfW: number, a0: number, a1: number): THREE.Path {
  const p = new THREE.Path();
  const end = (a: number): [number, number] => [Math.cos(a) * rMid, Math.sin(a) * rMid];
  p.absarc(0, 0, rMid + halfW, a0, a1, false);
  const [ex, ey] = end(a1);
  p.absarc(ex, ey, halfW, a1, a1 + Math.PI, false);
  p.absarc(0, 0, rMid - halfW, a1, a0, true);
  const [sx, sy] = end(a0);
  p.absarc(sx, sy, halfW, a0 + Math.PI, a0 + TAU, false);
  p.closePath();
  return p;
}

/** 단면 다각형을 평면 지오메트리로 (컷어웨이 단면용) */
export function polygonFace(pts: V2[]): THREE.BufferGeometry {
  return new THREE.ShapeGeometry(shapeFrom(pts));
}
