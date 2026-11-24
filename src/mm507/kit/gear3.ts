// 기어 3종 키트(36~40번 전용) — 맹글 휠 톱니 고리, 부분 이 기어, 홈 원뿔, 헤링본 기어
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { circlePts, lathe, loft, merge, mesh, tubeProfile, TAU, type LoftLayer } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import type { V2 } from './belt';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// ───────────────────────── 맹글 휠 톱니 고리 (036) ─────────────────────────

export interface MangleOpts {
  /** 피니언 잇수 / 모듈 */
  pinionTeeth: number;
  module: number;
  /** 피니언 중심이 지나는 닫힌 경로: 바깥 팔 반지름 R1, 안쪽 팔 반지름 R2 (R1 > R2) */
  rOuter: number;
  rInner: number;
  /** 경로 길이 = loopTeeth × 원피치 — 고리 위 이 수가 정수로 닫히게 팔 각도를 맞춘다 */
  loopTeeth: number;
  /** 판 두께(z), 판 가장자리 벽 두께 */
  width?: number;
  wall?: number;
}

export interface MangleTrack {
  /** 톱니 고리판 — 원점 = 휠 중심, 두께 z 중심 0 */
  group: THREE.Group;
  /** 피니언 피치 반지름 */
  pinionPitchR: number;
  /** 피니언 중심 경로 길이 L */
  length: number;
  /** 피니언 절대 각(theta) → 휠 각, 휠 중심에서 아래 슬롯 위 피니언 중심까지의 거리 */
  solve(thetaP: number): { wheel: number; dist: number };
}

interface LoopSeg {
  s0: number;
  len: number;
  k: number; // 왼쪽 회전율(진행각 증가율)
  x0: number;
  y0: number;
  h0: number;
}

/**
 * 맹글 휠의 닫힌 톱니 고리(안쪽 래크) — C자 띠: 바깥 팔·안쪽 팔·양끝 반원.
 * 피니언 중심 경로(닫힌 곡선, 반시계 진행) C(s) 의 오른쪽(바깥) rp 만큼 띄운 곡선이 피치선이다.
 * 순수 구름: 피니언의 휠 기준 각 = -s/rp (s = 중심 경로 호장). 슬롯이 휠 중심 바로 아래 수직선이라
 * 휠 각 φ(s) = -π/2 - arg C(s), 피니언 절대각 θp = φ(s) - s/rp. θp 는 s 에 단조 감소 → 역산해 푼다.
 */
export function mangleTrack(o: MangleOpts): MangleTrack {
  const m = o.module;
  const z = o.pinionTeeth;
  const rp = (z * m) / 2;
  const step = TAU / z;
  const pc = rp * step; // 원피치(호)
  const R1 = o.rOuter;
  const R2 = o.rInner;
  const rho = (R1 - R2) / 2;
  const L = o.loopTeeth * pc;
  const A = (L - 2 * Math.PI * rho) / (2 * (R1 + R2));
  const w = o.width ?? 0.09;
  const wall = o.wall ?? 0.06;

  // 닫힌 경로 구간: 바깥 팔 → 끝 반원 → 안쪽 팔 → 끝 반원
  const defs: { len: number; k: number }[] = [
    { len: 2 * A * R1, k: 1 / R1 },
    { len: Math.PI * rho, k: 1 / rho },
    { len: 2 * A * R2, k: -1 / R2 },
    { len: Math.PI * rho, k: 1 / rho }
  ];
  const segs: LoopSeg[] = [];
  let sx = R1 * Math.cos(-A);
  let sy = R1 * Math.sin(-A);
  let sh = -A + Math.PI / 2;
  let s0 = 0;
  for (const d of defs) {
    segs.push({ s0, len: d.len, k: d.k, x0: sx, y0: sy, h0: sh });
    const hEnd = sh + d.k * d.len;
    sx += (Math.sin(hEnd) - Math.sin(sh)) / d.k;
    sy += (Math.cos(sh) - Math.cos(hEnd)) / d.k;
    sh = hEnd;
    s0 += d.len;
  }
  const at = (s: number): { x: number; y: number; h: number } => {
    let seg = segs[0]!;
    for (const q of segs) if (s >= q.s0) seg = q;
    const u = s - seg.s0;
    const h = seg.h0 + seg.k * u;
    return {
      x: seg.x0 + (Math.sin(h) - Math.sin(seg.h0)) / seg.k,
      y: seg.y0 + (Math.cos(seg.h0) - Math.cos(h)) / seg.k,
      h
    };
  };
  // 접촉 위상 g(s) = (오른쪽 법선 각) + s/rp, 구간마다 선형
  const g0 = at(0).h - Math.PI / 2;
  const gSeg = segs.map((q) => g0 + (q.h0 - segs[0]!.h0) + q.s0 / rp);
  const gEnd = g0 + 2 * Math.PI + L / rp;
  const invG = (G: number): number => {
    let i = 0;
    for (let j = 0; j < segs.length; j++) if (G >= gSeg[j]!) i = j;
    const q = segs[i]!;
    return q.s0 + (G - gSeg[i]!) / (q.k + 1 / rp);
  };

  // 이 단면: 이골 중심 f=0 에서 +1.25m(깊음), 이끝 |f|≥0.33 에서 -m
  const prof = (f: number): number => {
    const a = Math.abs(f);
    if (a >= 0.33) return -m;
    if (a <= 0.2) return 1.25 * m;
    return 1.25 * m + (-m - 1.25 * m) * ((a - 0.2) / 0.13);
  };
  const F = [-0.5, -0.415, -0.33, -0.2, -0.1, 0, 0.1, 0.2, 0.33, 0.415];
  const hole: V2[] = [];
  const j0 = Math.floor(g0 / step) - 1;
  const j1 = Math.ceil(gEnd / step) + 1;
  for (let j = j0; j <= j1; j++) {
    for (const f of F) {
      const G = (j + 0.5 + f) * step;
      if (G < g0 - 1e-9 || G >= gEnd - 1e-9) continue;
      const p = at(invG(G));
      const r = rp + prof(f);
      hole.push([p.x + Math.sin(p.h) * r, p.y - Math.cos(p.h) * r]);
    }
  }
  const outer: V2[] = [];
  const offO = rp + 1.25 * m + wall;
  const nO = Math.ceil(L / 0.035);
  for (let i = 0; i < nO; i++) {
    const p = at((L * i) / nO);
    outer.push([p.x + Math.sin(p.h) * offO, p.y - Math.cos(p.h) * offO]);
  }
  const group = new THREE.Group();
  const layers: LoftLayer[] = [
    { z: -w / 2, s: 1, hs: 1 },
    { z: w / 2, s: 1, hs: 1 }
  ];
  group.add(mesh(loft(outer, [hole], layers), bronze({ roughness: 0.4 })));

  // 풀이표: 경로를 촘촘히 샘플해 θp(s) 단조 감소 테이블을 만든다
  const NT = 4000;
  const phi: number[] = [];
  const dist: number[] = [];
  const th: number[] = [];
  let prevArg = 0;
  let unwrap = 0;
  for (let i = 0; i <= NT; i++) {
    const s = (L * i) / NT;
    const p = at(s);
    const a = Math.atan2(p.y, p.x);
    if (i === 0) prevArg = a;
    let d = a - prevArg;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    unwrap += d;
    prevArg = a;
    const arg = Math.atan2(at(0).y, at(0).x) + unwrap;
    phi.push(-Math.PI / 2 - arg);
    dist.push(Math.hypot(p.x, p.y));
    th.push(-Math.PI / 2 - arg - s / rp);
  }
  const per = L / rp; // 한 바퀴 동안 θp 감소량
  const solve = (thetaP: number): { wheel: number; dist: number } => {
    const t0 = th[0]!;
    const k = Math.floor((t0 - thetaP) / per);
    const t = thetaP + k * per; // (t0 - per, t0]
    let lo = 0;
    let hi = NT;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (th[mid]! >= t) lo = mid;
      else hi = mid;
    }
    const a = th[lo]!;
    const b = th[hi]!;
    const u = a === b ? 0 : (a - t) / (a - b);
    return { wheel: phi[lo]! + (phi[hi]! - phi[lo]!) * u, dist: dist[lo]! + (dist[hi]! - dist[lo]!) * u };
  };
  return { group, pinionPitchR: rp, length: L, solve };
}

// ───────────────────────── 부분 이 기어 (038) ─────────────────────────

export interface PartialGearOpts {
  width?: number;
  spokes?: number;
  driver?: boolean;
}

/**
 * 이가 일부에만 있는 기어(spurGear 와 같은 위상·치형). 이 번호 j(이 중심각 = (j+0.5)·피치각) 중
 * from 부터 count 개(잇수로 나머지)에만 이를 남기고 나머지는 이뿌리보다 약간 큰 매끈한 원호로 둔다.
 */
export function partialGear(teeth: number, module: number, from: number, count: number, opts: PartialGearOpts = {}): THREE.Group {
  const w = opts.width ?? 0.12;
  const spokes = opts.spokes ?? 6;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const rb = rp - 1.15 * module; // 이 없는 구간 반지름
  const step = TAU / teeth;
  const bore = Math.max(0.024, rp * 0.14);
  const c = Math.min(module * 0.35, w * 0.16);
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const full = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const regions: V2[][] = Array.from({ length: teeth }, () => []);
  for (const p of full) {
    let a = Math.atan2(p[1], p[0]);
    if (a < 0) a += TAU;
    const j = Math.min(teeth - 1, Math.floor(a / step));
    regions[j]!.push(p);
  }
  const has = (j: number): boolean => (((j - from) % teeth) + teeth) % teeth < count;
  const outline: V2[] = [];
  for (let j = 0; j < teeth; j++) {
    if (has(j)) outline.push(...regions[j]!);
    else for (let k = 0; k < 6; k++) outline.push([Math.cos((j + k / 6) * step) * rb, Math.sin((j + k / 6) * step) * rb]);
  }
  const g = new THREE.Group();
  const rRim = rf * 0.72;
  const hole = circlePts(rRim, 64);
  const layers: LoftLayer[] = [
    { z: -w / 2, s: (rb - c) / rb, hs: (rRim + c) / rRim },
    { z: -w / 2 + c, s: 1, hs: 1 },
    { z: w / 2 - c, s: 1, hs: 1 },
    { z: w / 2, s: (rb - c) / rb, hs: (rRim + c) / rRim }
  ];
  g.add(mesh(loft(outline, [hole], layers), body));
  const hubOut = bore + rp * 0.14;
  const hubGeo = lathe(tubeProfile(bore, hubOut, -(w / 2 + 0.018), w / 2 + 0.018, 0.01), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < spokes; i++) {
    const b = new THREE.BoxGeometry(rRim - hubOut, Math.max(0.02, rp * 0.1), w * 0.4);
    b.translate(hubOut + (rRim - hubOut) / 2, 0, 0);
    b.rotateZ((i / spokes) * TAU);
    geos.push(b);
  }
  g.add(mesh(merge(geos), body));
  // 표시점: 이가 있는 구간 첫 이 쪽 스포크 위
  const markGeo = new THREE.BoxGeometry(Math.max(0.03, rp * 0.1), 0.016, 0.01);
  g.add(meshAt(markGeo, paint(0xf2b619), (hubOut + rRim) / 2, 0, w * 0.2 + 0.004));
  return g;
}

// ───────────────────────── 홈 원뿔 (037) ─────────────────────────

export interface FlutedConeOpts {
  /** 축 구멍 반지름(기본 0.05) */
  bore?: number;
  driver?: boolean;
}

/**
 * 모선 방향으로 곧게 홈(리브)이 난 원뿔대. 회전축 = 로컬 Y, 바닥 y=0(피치 반지름 rBottom) ~ 위 y=height(rTop).
 * 리브 j 의 중심 방위 = j·2π/ribs, 방위각은 +X 에서 -Z 쪽으로 잰다(group.rotation.y 증가 방향과 같다).
 * 피치 반지름은 높이에 선형(꼭짓점을 지나는 원뿔).
 */
export function flutedCone(ribs: number, rBottom: number, rTop: number, height: number, opts: FlutedConeOpts = {}): THREE.Group {
  const p = TAU / ribs;
  const bore = opts.bore ?? 0.05;
  const pol = (r: number, a: number): V2 => [Math.cos(a) * r, Math.sin(a) * r];
  const outline: V2[] = [];
  for (let j = 0; j < ribs; j++) {
    const a = j * p;
    outline.push(pol(0.93, a - 0.25 * p), pol(1.05, a - 0.17 * p), pol(1.05, a + 0.17 * p), pol(0.93, a + 0.25 * p));
    outline.push(pol(0.93, a + 0.4 * p), pol(0.93, a + 0.6 * p));
  }
  const geo = loft(
    outline,
    [circlePts(bore, 24)],
    [
      { z: 0, s: rBottom, hs: 1 },
      { z: height, s: rTop, hs: 1 }
    ]
  );
  geo.rotateX(-Math.PI / 2); // 로프트 z → +Y, 방위각 → +X 에서 -Z 쪽
  const g = new THREE.Group();
  g.add(mesh(geo, opts.driver === true ? bronze({ roughness: 0.34 }) : brass()));
  // 표시점: 윗면 리브 0 자리
  g.add(meshAt(new THREE.BoxGeometry(rTop * 0.3, 0.012, 0.03), paint(0xf2b619), rTop * 0.62, height + 0.002, 0));
  return g;
}

// ───────────────────────── 헤링본(V자 이) 기어 (040) ─────────────────────────

export interface HerringboneOpts {
  /** 이 폭(축 방향) */
  width?: number;
  /** 가장자리에서의 단면 비틀림(rad). 가운데 0, 양끝 ±twist → V자 */
  twist?: number;
  /** 비틀림 방향. 맞물리는 상대 기어는 반대(-hand) */
  hand?: 1 | -1;
  driver?: boolean;
  bore?: number;
}

/**
 * V자 이 기어: 피치 반지름 = teeth·module/2. 회전축 = 로컬 Z, 가운데 평면(z=0)의 단면이 spurGear 와 같은 위상
 * (meshAngle 그대로 사용 가능). 단면은 z 에 따라 hand·twist·|z|/(폭/2) 만큼 돌아 V자가 된다.
 */
export function herringboneGear(teeth: number, module: number, opts: HerringboneOpts = {}): THREE.Group {
  const w = opts.width ?? 0.4;
  const tw = opts.twist ?? 0.24;
  const hand = opts.hand ?? 1;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const bore = opts.bore ?? Math.max(0.03, rp * 0.1);
  const c = Math.min(module * 0.35, w * 0.05);
  const h = w / 2;
  const outline = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const zs: number[] = [-h, -h + c];
  const N = 16;
  for (let i = 0; i <= N; i++) zs.push(-(h - c) + (2 * (h - c) * i) / N);
  zs.push(h - c, h);
  const layers: LoftLayer[] = zs.map((zz, i) => {
    const edge = i === 0 || i === zs.length - 1;
    return {
      z: zz,
      s: edge ? (ra - c) / ra : 1,
      hs: edge ? (bore + c) / bore : 1,
      rot: hand * tw * (Math.abs(zz) / h)
    };
  });
  const g = new THREE.Group();
  g.add(mesh(loft(outline, [circlePts(bore, 32)], layers), opts.driver === true ? bronze({ roughness: 0.34 }) : brass()));
  const hubGeo = lathe(tubeProfile(bore, bore + 0.035, -(h + 0.035), h + 0.035, 0.008), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 표시선: 이끝 위에 얹은 가는 노란 띠(폭 전체) — 회전이 보이게
  g.add(meshAt(new THREE.BoxGeometry(0.012, 0.012, w * 0.98), paint(0xf2b619), ra + 0.002, 0, 0));
  return g;
}
