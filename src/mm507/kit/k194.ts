// 194 맹글 휠 3 전용 키트 — 이(홈)가 한 줄뿐인 맹글 휠: 바닥 있는 이 자리(구멍)가 늘어선 고리 띠, 피니언 축 안내 홈(휠 면에 파인 닫힌 홈), 이 자리에 들어가는 피니언 못
//  피니언 중심의 닫힌 경로(바깥 팔 R1, 안쪽 팔 R2 = R1 − 2rp, 양끝 반원 ρ = rp)는 mangleTrack(rib) 와 같다. 구멍 고리의 피치 반지름 Rp = R1 − rp = R2 + rp.
import * as THREE from 'three';
import { bronze } from '../../models/materials';
import { loft, merge, mesh, TAU, type LoftLayer } from '../../models/parts/geom';
import type { V2 } from './belt';
import { groovedDisc } from './k192';
import { setMM } from './mm';

export const K194 = {
  nz: 12, // 피니언 잇수
  m: 0.0408, // 모듈 → 피치 반지름 0.2448
  R1: 0.9, // 바깥 팔(피니언 중심 거리)
  R2: 0.41, // 안쪽 팔
  loop: 65, // 경로 길이 = 65 × 원피치
  RW: 1.15, // 휠 반지름
  z0: 0, // 판 뒷면
  zPlate: 0.08 // 판 맨 앞면(이 자리 띠 앞면)
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

/** 이 자리 띠의 반폭(고리 반지름 방향) — 못이 드나드는 구멍(이 자리)은 띠를 가로질러 양쪽으로 열린다 */
export const BAND194 = 0.03;
/** 층: 뒤판 뒷면 z0, 홈 바닥 zBot, 앞 층(바깥 조각·섬) 앞면 zFace, 이 자리 띠 앞면 zBand */
export const Z194 = { zBot: 0.02, zFace: 0.05, zBand: 0.08 };
/** 안내 홈 반폭 */
export const GROOVE_HW194 = 0.037;

/** 구멍 사이 이 막이(띠 조각) 하나의 윤곽: 구멍 a 의 +쪽 벽 ~ 구멍 b 의 −쪽 벽, 반지름 RING ± BAND */
export function bandBlock194(pa: number, pb: number, halfW = 0.045): V2[] {
  const r0 = RING194 - BAND194;
  const r1 = RING194 + BAND194;
  const side = (psi: number, sgn: number, r: number): V2 => [Math.cos(psi) * r - Math.sin(psi) * halfW * sgn, Math.sin(psi) * r + Math.cos(psi) * halfW * sgn];
  const pts: V2[] = [];
  const arc = (r: number, a0: number, a1: number): void => {
    const n = 6;
    for (let i = 1; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  };
  const ang = (p: V2): number => Math.atan2(p[1], p[0]);
  const aIn = side(pa, 1, r0);
  const aOut = side(pa, 1, r1);
  const bOut = side(pb, -1, r1);
  const bIn = side(pb, -1, r0);
  pts.push(aIn, aOut);
  arc(r1, ang(aOut), ang(aOut) + ((ang(bOut) - ang(aOut) + 3 * Math.PI) % TAU) - Math.PI);
  pts.push(bOut, bIn);
  arc(r0, ang(bIn), ang(bIn) + ((ang(aIn) - ang(bIn) + 3 * Math.PI) % TAU) - Math.PI);
  return pts;
}

/**
 * 맹글 휠 판(사용자 지적 수정): 뒤판 + 앞 층(안내 홈을 뺀 바깥 조각 + 고리 안쪽 섬) + 섬 위 이 자리 띠.
 * 이 자리 띠 = 고리를 따라 늘어선 막이들 — 막이 사이가 바닥(섬 앞면)이 있는 오목한 이 자리(구멍)이고, 피니언 뒤 못이 그 속에 들어가 막이를 밀어 휠을 돌린다.
 * 원점 = 휠 중심, 판 z ∈ [z0, zBand]
 */
export function slotWheel194(psis: number[]): THREE.Group {
  const g = new THREE.Group();
  const L = K194.loop * PITCH194;
  const disc = groovedDisc({ R1: K194.R1, R2: K194.R2, L, hw: GROOVE_HW194, rBack: K194.RW - 0.07, rFront: K194.RW - 0.07, z0: K194.z0, zBot: Z194.zBot, z1: Z194.zFace });
  g.add(disc);
  const blocks: V2[][] = [];
  for (let j = 0; j + 1 < psis.length; j++) blocks.push(bandBlock194(psis[j]!, psis[j + 1]!));
  const layers: LoftLayer[] = [
    { z: Z194.zFace, s: 1, hs: 1 },
    { z: Z194.zBand, s: 1, hs: 1 }
  ];
  const geos = blocks.map((b) => loft(b, [], layers));
  const band = mesh(merge(geos), bronze({ roughness: 0.4 }));
  band.name = 'toothBand';
  g.add(band);
  const outlines: Record<string, V2[]> = {};
  psis.forEach((p, i) => (outlines[`hole${i}`] = slotOutline194(p)));
  g.userData.outlines = outlines; // 검사용(2D 윤곽 — 이 자리)
  g.userData.blocks = blocks; // 검사용(2D 윤곽 — 막이)
  setMM(g, { kind: 'gear', fn: 'slotWheel194', teeth: psis.length, module: K194.m, internal: false, noncircular: true, axis: 'z', width: Z194.zBand - Z194.zFace });
  return g;
}
