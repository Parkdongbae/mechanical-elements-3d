// 194 맹글 휠 3 전용 키트 — 이(홈)가 한 줄뿐인 맹글 휠: 타원 구멍이 늘어선 고리 모양 판, 피니언 축 안내 홈(닫힌 길), 구멍에 들어가는 이 못
//  피니언 중심의 닫힌 경로(바깥 팔 R1, 안쪽 팔 R2 = R1 − 2rp, 양끝 반원 ρ = rp)는 mangleTrack(rib) 와 같다. 구멍 고리의 피치 반지름 Rp = R1 − rp = R2 + rp.
import * as THREE from 'three';
import { darkSteel } from '../../models/materials';
import { brass } from '../../models/materials';
import { circlePts, extrude, loft, mesh, pathFrom, shapeFrom, TAU, type LoftLayer } from '../../models/parts/geom';
import type { V2 } from './belt';
import { setMM } from './mm';

export const K194 = {
  nz: 12, // 피니언 잇수
  m: 0.0408, // 모듈 → 피치 반지름 0.2448
  R1: 0.9, // 바깥 팔(피니언 중심 거리)
  R2: 0.41, // 안쪽 팔
  loop: 65, // 경로 길이 = 65 × 원피치
  RW: 1.15, // 휠 반지름
  z0: 0, // 판 뒷면
  zPlate: 0.06 // 판 앞면
};
export const RP194 = (K194.nz * K194.m) / 2;
export const RING194 = K194.R1 - RP194; // 구멍 고리 피치 반지름 0.655
export const PITCH194 = RP194 * (TAU / K194.nz); // 원피치(호)

/** 피니언 중심 경로(닫힌 곡선): 점 (x, y) 와 진행 방향 h, 호장 s ∈ [0, L). mangleTrack 과 같은 식 */
export function loopPath194(): { L: number; A: number; at(s: number): { x: number; y: number; h: number } } {
  const { R1, R2, loop } = K194;
  const rho = (R1 - R2) / 2;
  const L = loop * PITCH194;
  const A = (L - 2 * Math.PI * rho) / (2 * (R1 + R2));
  const defs = [
    { len: 2 * A * R1, k: 1 / R1 },
    { len: Math.PI * rho, k: 1 / rho },
    { len: 2 * A * R2, k: -1 / R2 },
    { len: Math.PI * rho, k: 1 / rho }
  ];
  const segs: { s0: number; k: number; x0: number; y0: number; h0: number }[] = [];
  let sx = R1 * Math.cos(-A);
  let sy = R1 * Math.sin(-A);
  let sh = -A + Math.PI / 2;
  let s0 = 0;
  for (const d of defs) {
    segs.push({ s0, k: d.k, x0: sx, y0: sy, h0: sh });
    const hEnd = sh + d.k * d.len;
    sx += (Math.sin(hEnd) - Math.sin(sh)) / d.k;
    sy += (Math.cos(sh) - Math.cos(hEnd)) / d.k;
    sh = hEnd;
    s0 += d.len;
  }
  const at = (s: number): { x: number; y: number; h: number } => {
    const ss = ((s % L) + L) % L;
    let seg = segs[0]!;
    for (const q of segs) if (ss >= q.s0) seg = q;
    const u = ss - seg.s0;
    const h = seg.h0 + seg.k * u;
    return { x: seg.x0 + (Math.sin(h) - Math.sin(seg.h0)) / seg.k, y: seg.y0 + (Math.cos(seg.h0) - Math.cos(h)) / seg.k, h };
  };
  return { L, A, at };
}

/** 타원 구멍 하나의 윤곽(휠 좌표, 중심 각 psi, 고리 반지름 Rp, 반경 방향으로 긴 캡슐) */
export function slotOutline194(psi: number, halfLen = 0.03, r = 0.045): V2[] {
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  const pts: V2[] = [];
  const n = 10;
  // 바깥쪽 반원(반경 +)과 안쪽 반원
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    pts.push([RING194 + halfLen + Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI;
    pts.push([RING194 - halfLen + Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c] as V2);
}

/** 구멍 판: 원판에 타원 구멍들(고리)을 뚫고 안내 홈 띠를 얹는다. 원점 = 휠 중심, 판 z ∈ [z0, zPlate] */
export function slotWheel194(psis: number[]): THREE.Group {
  const g = new THREE.Group();
  const holes = psis.map((p) => slotOutline194(p));
  const layers: LoftLayer[] = [
    { z: K194.z0, s: 1, hs: 1 },
    { z: K194.zPlate, s: 1, hs: 1 }
  ];
  const plate = mesh(loft(circlePts(K194.RW - 0.07, 128), holes, layers), brass({ roughness: 0.45 }));
  g.add(plate);
  const outlines: Record<string, V2[]> = {};
  holes.forEach((h, i) => (outlines[`hole${i}`] = h));
  g.userData.outlines = outlines; // 검사용(2D 윤곽 — 구멍)
  // 안내 홈 띠(닫힌 길 둘레의 어두운 띠 — 피니언 축이 지나는 홈): 길을 ±w 로 부풀린 고리
  const lp = loopPath194();
  const N = 360;
  const outer: V2[] = [];
  const inner: V2[] = [];
  const w = 0.03;
  for (let i = 0; i < N; i++) {
    const p = lp.at((lp.L * i) / N);
    const nx = Math.sin(p.h);
    const ny = -Math.cos(p.h);
    outer.push([p.x + nx * w, p.y + ny * w]);
    inner.push([p.x - nx * w, p.y - ny * w]);
  }
  const ring = shapeFrom(outer);
  ring.holes.push(pathFrom(inner));
  const groove = mesh(extrude(ring, 0.006, 0.001, 8), darkSteel());
  groove.position.z = K194.zPlate + 0.004;
  g.add(groove);
  setMM(g, { kind: 'gear', fn: 'slotWheel194', teeth: psis.length, module: K194.m, internal: false, noncircular: true, axis: 'z', width: K194.zPlate - K194.z0 });
  return g;
}
