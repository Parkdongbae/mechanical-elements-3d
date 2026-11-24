// 검사 표식 userData.mm — 키트가 남기는 기계 판독용 정보 (작업 지시서 20 · 3-2, 필드 표는 shots/_verify/USERDATA.md)
// 형상·동작에는 손대지 않는다. 물체를 더하지 않고 userData 만 쓴다.
import * as THREE from 'three';

export type MmVec = [number, number, number];

/** 줄·벨트가 감은 원호 하나 (줄·벨트 그룹 로컬 좌표) */
export interface MmWrap {
  /** 원 중심 */
  c: MmVec;
  /** 원 법선(단위). ccw 는 이 축 둘레 반시계 */
  axis: MmVec;
  /** 줄 중심선이 도는 반지름 */
  r: number;
  ccw: boolean;
  /** 감긴 각(도) */
  deg: number;
  from: MmVec;
  to: MmVec;
  mid: MmVec;
  /** 이 호에 든 경로 점 수 */
  n: number;
  src: string;
  wheel?: string;
}

/** 3D 꼬리표 — 호 위 Vector3 에 단다 */
interface Seed3 {
  c: MmVec;
  axis: MmVec;
  r: number;
  ccw: boolean;
  src: string;
  wheel?: string;
}
/** 2D 꼬리표 — 평면 경로(V2) 의 호 위 점에 단다. planar/carryTags 가 3D 로 올린다 */
interface Seed2 {
  u: [number, number];
  r: number;
  ccw: boolean;
  src: string;
  wheel?: string;
}

const tags3 = new WeakMap<object, Seed3>();
const tags2 = new WeakMap<object, Seed2>();

/** userData.mm 에 필드를 합친다(없으면 새로). 돌려주는 값은 obj */
export function setMM<T extends THREE.Object3D>(obj: T, data: Record<string, unknown>): T {
  const prev = obj.userData.mm as Record<string, unknown> | undefined;
  obj.userData.mm = prev ? { ...prev, ...data } : { ...data };
  return obj;
}

/** 줄 끝이 붙어야 할 자리(obj 로컬) */
export function markAnchor<T extends THREE.Object3D>(obj: T, point: MmVec = [0, 0, 0], extra: Record<string, unknown> = {}): T {
  return setMM(obj, { kind: 'anchor', of: 'model', point, ...extra });
}

/** 링크 핀 자리(obj 로컬) — 검사 선언 links 용 */
export function markPin<T extends THREE.Object3D>(obj: T, point: MmVec = [0, 0, 0]): T {
  return setMM(obj, { kind: 'pin', point });
}

/** rope/belt 그룹에 wraps 를 고정으로 적는다(이후 setPath 가 덮어쓰지 않음) */
export function markWraps<T extends THREE.Object3D>(obj: T, wraps: Partial<MmWrap>[]): T {
  return setMM(obj, { wraps, wrapsFixed: true });
}

// ── 키트 내부용 꼬리표 ──

/** 평면 경로 호 점(V2 객체)에 2D 꼬리표 */
export function tag2(points: object[], c: [number, number], r: number, ccw: boolean, src: string): void {
  const s: Seed2 = { u: [c[0], c[1]], r, ccw, src };
  for (const p of points) tags2.set(p, s);
}

/** 점에 2D 꼬리표가 있는가 */
export function tags2Has(p: object): boolean {
  return tags2.has(p);
}

/** 이미 만든 3D 꼬리표 하나를 여러 점에 */
function tag3(points: object[], s: Seed3): void {
  for (const p of points) tags3.set(p, s);
}

/** 모델이 직접 만든 호 점(Vector3[])에 꼬리표를 단다. axis 기본 +Z */
export function tagArc(
  points: THREE.Vector3[],
  o: { c: THREE.Vector3 | MmVec; r: number; ccw: boolean; axis?: THREE.Vector3 | MmVec; wheel?: string; src?: string }
): THREE.Vector3[] {
  const c: MmVec = Array.isArray(o.c) ? [o.c[0], o.c[1], o.c[2]] : [o.c.x, o.c.y, o.c.z];
  const ax = o.axis === undefined ? [0, 0, 1] : Array.isArray(o.axis) ? o.axis : [o.axis.x, o.axis.y, o.axis.z];
  const L = Math.hypot(ax[0]!, ax[1]!, ax[2]!) || 1;
  const s: Seed3 = { c, axis: [ax[0]! / L, ax[1]! / L, ax[2]! / L], r: o.r, ccw: o.ccw, src: o.src ?? 'tagArc' };
  if (o.wheel !== undefined) s.wheel = o.wheel;
  tag3(points, s);
  return points;
}

/** (u,v,w)→3D 사상으로 2D 꼬리표를 3D 로 올린다 */
function lift(s: Seed2, w: number, map: (u: number, v: number, w: number) => THREE.Vector3): Seed3 {
  const c = map(s.u[0], s.u[1], w);
  const e = 1e-3;
  const du = map(s.u[0] + e, s.u[1], w).sub(c);
  const dv = map(s.u[0], s.u[1] + e, w).sub(c);
  const n = du.cross(dv);
  if (n.lengthSq() < 1e-18) n.set(0, 0, 1);
  n.normalize();
  const out: Seed3 = { c: [c.x, c.y, c.z], axis: [n.x, n.y, n.z], r: s.r, ccw: s.ccw, src: s.src };
  if (s.wheel !== undefined) out.wheel = s.wheel;
  return out;
}

/**
 * src[i] 의 2D 꼬리표를 dst[i](Vector3)로 옮긴다 — 모델이 평면 경로를 직접 map 으로 3D 로 바꿀 때 한 줄로.
 * map(u, v, w) 는 그 모델이 점을 옮긴 식과 같게(예: (u, v) => new Vector3(x, v, u)). 없으면 XY 평면(z = 그 호 첫 점의 z).
 */
export function carryTags(
  src: readonly object[],
  dst: readonly THREE.Vector3[],
  map?: (u: number, v: number, w: number) => THREE.Vector3,
  w = 0
): void {
  const cache = new Map<Seed2, Seed3>();
  // map 이 없으면 XY 평면 경로로 보고 z 는 그 호의 첫 점 z 를 쓴다
  const xy = (z: number) => (u: number, v: number): THREE.Vector3 => new THREE.Vector3(u, v, z);
  const n = Math.min(src.length, dst.length);
  for (let i = 0; i < n; i++) {
    const s = tags2.get(src[i]!);
    if (s === undefined) {
      const s3 = tags3.get(src[i]!);
      if (s3 !== undefined) tags3.set(dst[i]!, s3);
      continue;
    }
    let s3 = cache.get(s);
    if (s3 === undefined) {
      s3 = lift(s, w, map ?? xy(dst[i]!.z));
      cache.set(s, s3);
    }
    tags3.set(dst[i]!, s3);
  }
}

/** ropeAround 용: 3D 꼬리표 하나 만들기(사상 포함) */
export function seedFor(
  c: [number, number],
  w: number,
  r: number,
  ccw: boolean,
  src: string,
  map: (u: number, v: number, w: number) => THREE.Vector3
): (points: THREE.Vector3[]) => void {
  const s = lift({ u: c, r, ccw, src }, w, map);
  return (points) => tag3(points, s);
}

const v = (p: THREE.Vector3): MmVec => [p.x, p.y, p.z];

/** 점열의 꼬리표를 차례로 모아 wraps 로. closed 면 이음매에서 갈린 호를 잇는다 */
export function collectWraps(points: readonly THREE.Vector3[], closed: boolean): MmWrap[] {
  type Run = { s: Seed3; pts: THREE.Vector3[] };
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (const p of points) {
    const s = tags3.get(p);
    if (s === undefined) {
      cur = null;
      continue;
    }
    if (cur !== null && cur.s === s) cur.pts.push(p);
    else {
      cur = { s, pts: [p] };
      runs.push(cur);
    }
  }
  if (closed && runs.length > 1) {
    const first = runs[0]!;
    const last = runs[runs.length - 1]!;
    const firstAtStart = tags3.get(points[0]!) === first.s;
    const lastAtEnd = tags3.get(points[points.length - 1]!) === last.s;
    if (first.s === last.s && firstAtStart && lastAtEnd) {
      last.pts.push(...first.pts);
      runs.shift();
    }
  }
  const out: MmWrap[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const cr = new THREE.Vector3();
  for (const run of runs) {
    if (run.pts.length < 2) continue;
    const c = new THREE.Vector3(...run.s.c);
    const ax = new THREE.Vector3(...run.s.axis);
    let sum = 0;
    for (let k = 1; k < run.pts.length; k++) {
      a.copy(run.pts[k - 1]!).sub(c);
      b.copy(run.pts[k]!).sub(c);
      a.addScaledVector(ax, -a.dot(ax));
      b.addScaledVector(ax, -b.dot(ax));
      cr.crossVectors(a, b);
      sum += Math.atan2(cr.dot(ax), a.dot(b));
    }
    const w: MmWrap = {
      c: run.s.c,
      axis: run.s.axis,
      r: run.s.r,
      ccw: sum >= 0,
      deg: (Math.abs(sum) * 180) / Math.PI,
      from: v(run.pts[0]!),
      to: v(run.pts[run.pts.length - 1]!),
      mid: v(run.pts[Math.floor((run.pts.length - 1) / 2)]!),
      n: run.pts.length,
      src: run.s.src
    };
    if (run.s.wheel !== undefined) w.wheel = run.s.wheel;
    out.push(w);
  }
  return out;
}
