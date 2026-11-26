// 192·193·194 맹글 휠 공통 — 피니언을 이 쪽으로 붙잡는 안내 홈(휠 면에 파인 닫힌 홈)과 홈 속을 달리는 굴림대
//  피니언 중심의 닫힌 경로(바깥 팔 R1 → 끝 반원 → 안쪽 팔 R2 → 끝 반원, 반시계)는 mangleTrack 과 같은 식이다.
//  휠 판을 두 층으로 만든다: 뒤판(통판) + 앞 층(홈 띠를 뺀 바깥 조각 + 고리 안쪽 섬). 홈 바닥 = 뒤판 앞면.
import * as THREE from 'three';
import { brass, darkSteel, steel } from '../../models/materials';
import { circlePts, lathe, loft, mesh, rodProfile, type LoftLayer } from '../../models/parts/geom';
import type { V2 } from './belt';

/** 피니언 중심 경로: 길이 L, 호장 s 의 점·진행 방향 h (mangleTrack 과 같은 식) */
export function manglePath(R1: number, R2: number, L: number): { L: number; at(s: number): { x: number; y: number; h: number } } {
  const rho = (R1 - R2) / 2;
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
    const h = seg.h0 + seg.k * (ss - seg.s0);
    return { x: seg.x0 + (Math.sin(h) - Math.sin(seg.h0)) / seg.k, y: seg.y0 + (Math.cos(seg.h0) - Math.cos(h)) / seg.k, h };
  };
  return { L, at };
}

/** 경로를 ±hw 로 띄운 두 벽: outside = 고리 바깥쪽(오른쪽), inside = 고리 안쪽 섬 둘레 */
export function grooveWalls(R1: number, R2: number, L: number, hw: number, n = 480): { outside: V2[]; inside: V2[] } {
  const p = manglePath(R1, R2, L);
  const outside: V2[] = [];
  const inside: V2[] = [];
  for (let i = 0; i < n; i++) {
    const q = p.at((L * i) / n);
    const nx = Math.sin(q.h);
    const ny = -Math.cos(q.h);
    outside.push([q.x + nx * hw, q.y + ny * hw]);
    inside.push([q.x - nx * hw, q.y - ny * hw]);
  }
  return { outside, inside };
}

export interface GroovedDiscOpts {
  R1: number;
  R2: number;
  L: number;
  /** 홈 반폭 */
  hw: number;
  /** 뒤판 반지름, 앞 층 바깥 반지름 */
  rBack: number;
  rFront: number;
  /** 뒤판 뒷면, 홈 바닥(= 뒤판 앞면), 앞 층 앞면 */
  z0: number;
  zBot: number;
  z1: number;
  /** 섬(고리 안쪽)에 뚫을 구멍 */
  islandHoles?: V2[][];
}

/** 안내 홈이 파인 휠 판. 원점 = 휠 중심. userData.groove = { outside, inside, zBot, z1 } (검사용) */
export function groovedDisc(o: GroovedDiscOpts): THREE.Group {
  const g = new THREE.Group();
  g.name = 'guideGroove';
  const backGeo = lathe(rodProfile(o.rBack, o.z0, o.zBot, 0.006, 0), 96);
  backGeo.rotateX(Math.PI / 2);
  g.add(mesh(backGeo, darkSteel()));
  const { outside, inside } = grooveWalls(o.R1, o.R2, o.L, o.hw);
  const layers: LoftLayer[] = [
    { z: o.zBot, s: 1, hs: 1 },
    { z: o.z1, s: 1, hs: 1 }
  ];
  g.add(mesh(loft(circlePts(o.rFront, 128), [outside], layers), brass()));
  g.add(mesh(loft(inside, o.islandHoles ?? [], layers), brass()));
  g.userData.groove = { outside, inside, zBot: o.zBot, z1: o.z1 };
  return g;
}

/** 피니언 축 끝 굴림대(원점 = 피니언 중심, z0~z1) */
export function grooveRoller(r: number, z0: number, z1: number): THREE.Mesh {
  const geo = lathe(rodProfile(r, z0, z1, 0.004, 0.004), 28);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, steel());
  m.name = 'grooveRoller';
  m.userData.roller = { r, z0, z1 };
  return m;
}
