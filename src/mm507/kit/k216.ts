// 216번 안팎 결손 기어 전용 키트 — 안쪽 이가 반쪽에만 있는 링, 구동 식. 설계표 docs/mm507-sheets/216.md
import * as THREE from 'three';
import { brass } from '../../models/materials';
import { extrude, pathFrom, mesh, TAU } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import type { V2 } from './belt';
import { setMM } from './mm';

export const K216 = {
  S: [0, 1.75] as [number, number],
  P: [0, 0.985] as [number, number],
  M: 0.045,
  ZR: 50,
  ZW: 18,
  ZP: 16,
  D: 0.765,
  OMEGA_BODY: 0.5
};

export interface PartialRingOpts {
  width?: number;
  wall?: number;
}

/**
 * 안쪽 이가 일부에만 있는 링(internalGear 와 같은 치형·위상: 이골 i 중심각 i·2π/teeth, 이끝 rp−1.15m, 이뿌리 rp+1.1m).
 * 이골 중심각 from·step ~ (from+count)·step 구간에만 이를 남기고 나머지 안쪽 윤곽은 반지름 rp+1.25m 의 매끈한 원호.
 */
export function partialRing216(teeth: number, module: number, from: number, count: number, opts: PartialRingOpts = {}): THREE.Group {
  const w = opts.width ?? 0.12;
  const wall = opts.wall ?? 0.08;
  const rp = (teeth * module) / 2;
  const rSmooth = rp + 1.25 * module;
  const rOut = rp + 1.1 * module + wall;
  const step = TAU / teeth;
  const full = involuteOutline(teeth, rp + 1.1 * module, rp - 1.15 * module, 0);
  const a0 = from * step;
  const span = count * step;
  const rel = (p: V2): number => {
    const a = Math.atan2(p[1], p[0]) - a0 + 1e-9;
    return ((a % TAU) + TAU) % TAU;
  };
  const kept = full
    .map((p) => ({ p, a: rel(p) }))
    .filter((q) => q.a <= span + 2e-9)
    .sort((x, y) => x.a - y.a)
    .map((q) => q.p);
  const outline: V2[] = [...kept];
  const nArc = Math.max(8, Math.round(((TAU - span) / TAU) * 96));
  for (let k = 1; k < nArc; k++) {
    const a = a0 + span + ((TAU - span) * k) / nArc;
    outline.push([Math.cos(a) * rSmooth, Math.sin(a) * rSmooth]);
  }
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, TAU, false);
  shape.holes.push(pathFrom(outline));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, w, Math.min(0.012, module * 0.3), 96), brass({ roughness: 0.3 })));
  g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'partialRing216', teeth, module, internal: true, rp, ra: rp - 1.15 * module, rf: rp + 1.1 * module, rOut, width: w, axis: 'z', from, count });
  return g;
}

const DEG = 180 / Math.PI;

/**
 * 결손 이 배치(설계표 216 — 전환 구간 수정판).
 * 링: 이 i = 1..23(이 중심 10.8°~169.2°) — partialRing216(50, m, 1, 23). 끝 이 i = 0·24 는 뺀다.
 * 바퀴: 이 j = 10..16(이 중심 210°~330°) — partialGear(18, m, 10, 7). 끝 이 j = 9·17 은 뺀다.
 * 끝 이를 빼서 생긴 빈 구간(주축 80°~86°, 274°~280°)에서는 피니언이 어느 이와도 닿지 않고,
 * 그동안 피니언 각을 3차 에르미트 곡선으로 이어 방향을 바꾼다(속도도 이어짐). 파이썬으로 0.1° 간격 두 주기 침범 0.
 */
export const BLEND216 = { a1: 80, b1: 86, a2: 274, b2: 280, cycle: 405 } as const;

const pe = (p: number): number => 90 - 1.125 * p; // 바깥 물림(느린 전진)
const pi = (p: number): number => 11.25 + 3.125 * (p - 90); // 안쪽 물림(빠른 후진)
const pe2 = (p: number): number => 900 - 1.125 * p; // 다음 바깥 물림(같은 이 위상 가족)
function hermite(p: number, a: number, b: number, ya: number, yb: number, sa: number, sb: number): number {
  const h = b - a;
  const s = (p - a) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * ya + (s3 - 2 * s2 + s) * h * sa + (-2 * s3 + 3 * s2) * yb + (s3 - s2) * h * sb;
}

/** 피니언 각 ψ(라디안) — 입력 몸 각 φ(라디안). 주기 구간 p ∈ [−60°, 300°), 한 주기에 ψ +405° */
export function pinion216Psi(phi: number): number {
  const d = phi * DEG;
  const n = Math.floor((d + 60) / 360);
  const p = d - 360 * n;
  const { a1, b1, a2, b2, cycle } = BLEND216;
  let v: number;
  if (p < a1) v = pe(p);
  else if (p < b1) v = hermite(p, a1, b1, pe(a1), pi(b1), -1.125, 3.125);
  else if (p < a2) v = pi(p);
  else if (p < b2) v = hermite(p, a2, b2, pi(a2), pe2(b2), 3.125, -1.125);
  else v = pe2(p);
  return (v + cycle * n) / DEG;
}

/** 물림 모드 — 전환 구간 가운데(83°, 277°)에서 바뀐다 */
export function mode216(phi: number): 'ext' | 'int' {
  const d = phi * DEG;
  const p = d - 360 * Math.floor((d + 60) / 360);
  return p >= 83 && p < 277 ? 'int' : 'ext';
}

export function state216(t: number): { phi: number; psi: number; mode: 'ext' | 'int' } {
  const phi = K216.OMEGA_BODY * t;
  return { phi, psi: pinion216Psi(phi), mode: mode216(phi) };
}
