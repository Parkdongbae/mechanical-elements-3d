// 056 전용 키트 — 휜(원호) 홈 레버 판 · 앞 프레임 판 (설계표 056)
import * as THREE from 'three';
import { castIron, darkSteel, steel } from '../../models/materials';
import { extrude, mesh } from '../../models/parts/geom';
import type { V2 } from './belt';

const TAU = Math.PI * 2;

function hull(pts: V2[]): V2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: V2[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: V2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop();
  up.pop();
  return [...lo, ...up];
}

function polyPath<T extends THREE.Path>(target: T, pts: V2[]): T {
  pts.forEach(([x, y], i) => (i === 0 ? target.moveTo(x, y) : target.lineTo(x, y)));
  target.closePath();
  return target;
}

/** 원호 홈(바나나 구멍) 윤곽: 중심선 = 중심 c, 반지름 R, 각 a0 → a1(어느 쪽으로 돌든 됨), 반폭 r */
function arcSlotPts(c: V2, R: number, a0: number, a1: number, r: number, seg = 28): V2[] {
  const out: V2[] = [];
  const at = (rad: number, a: number): V2 => [c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)];
  const dir = Math.sign(a1 - a0) || 1;
  for (let i = 0; i <= seg; i++) out.push(at(R + r, a0 + ((a1 - a0) * i) / seg));
  const e1 = at(R, a1);
  for (let i = 1; i < 12; i++) {
    const b = a1 + dir * (Math.PI * i) / 12; // 바깥 → 안쪽으로 끝 반원
    out.push([e1[0] + r * Math.cos(b), e1[1] + r * Math.sin(b)]);
  }
  for (let i = 0; i <= seg; i++) out.push(at(R - r, a1 + ((a0 - a1) * i) / seg));
  const e0 = at(R, a0);
  for (let i = 1; i < 12; i++) {
    const b = a0 + Math.PI + dir * (Math.PI * i) / 12; // 안쪽 → 바깥으로 끝 반원
    out.push([e0[0] + r * Math.cos(b), e0[1] + r * Math.sin(b)]);
  }
  return out;
}

export interface ArcSlotLeverPlateOpts {
  /** 받침점 둘레 판 반지름 (기본 0.13) */
  pivotR?: number;
  /** 홈 둘레 판 반폭 (기본 0.10) */
  edgeR?: number;
  /** 홈 반폭 = 핀 반지름 + 여유 (기본 0.036) */
  slotR?: number;
  /** 두께 (기본 0.045) */
  thick?: number;
}

/**
 * 변속 레버의 홈 판(판화 56: 받침점에 대해 치우친 원호 홈). 원점 = 받침점(레버 회전축), 평면 = XY, z 가운데.
 * 홈 중심선 = 중심 slotC(받침점에서 비켜난 점), 반지름 slotRad, 각 a0(맞물림 끝) → a1(풀림 끝) 의 원호.
 * 판 윤곽 = 받침점 원 + 홈을 따라 놓은 원들의 볼록 껍질. 받침점에 어두운 캡. 레버 막대는 키트 lever() 를 따로 겹친다.
 * userData.slot = { c, R, a0, a1, r } (검사용).
 */
export function arcSlotLeverPlate(slotC: V2, slotRad: number, a0: number, a1: number, opts: ArcSlotLeverPlateOpts = {}): THREE.Group {
  const pr = opts.pivotR ?? 0.13;
  const er = opts.edgeR ?? 0.1;
  const sr = opts.slotR ?? 0.036;
  const t = opts.thick ?? 0.045;
  const pts: V2[] = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    pts.push([Math.cos(a) * pr, Math.sin(a) * pr]);
    for (let k = 0; k <= 6; k++) {
      const b = a0 + ((a1 - a0) * k) / 6;
      pts.push([slotC[0] + slotRad * Math.cos(b) + Math.cos(a) * er, slotC[1] + slotRad * Math.sin(b) + Math.sin(a) * er]);
    }
  }
  const shape = polyPath(new THREE.Shape(), hull(pts));
  shape.holes.push(polyPath(new THREE.Path(), arcSlotPts(slotC, slotRad, a0, a1, sr)));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, t, Math.min(0.01, t * 0.22), 24), steel({ roughness: 0.4 })));
  const cap = mesh(new THREE.CylinderGeometry(0.05, 0.05, t + 0.03, 24), darkSteel());
  cap.rotation.x = Math.PI / 2;
  g.add(cap);
  g.userData.slot = { c: slotC, R: slotRad, a0, a1, r: sr };
  return g;
}

/**
 * 앞 프레임 판(주철): XY 평면의 다각형 outline(시계 반대든 시계든 됨)을 두께 thick 로 세운 판, z 가운데.
 * slots 는 알약 구멍(양 끝 중심 a, b, 반폭 r) — 미끄러지는 축의 안내 홈·축 구멍에 쓴다.
 */
export function framePlate(outline: V2[], slots: { a: V2; b: V2; r: number }[] = [], thick = 0.05): THREE.Group {
  const shape = polyPath(new THREE.Shape(), outline);
  for (const s of slots) {
    const ang = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
    const p = new THREE.Path();
    p.absarc(s.b[0], s.b[1], s.r, ang - Math.PI / 2, ang + Math.PI / 2, false);
    p.absarc(s.a[0], s.a[1], s.r, ang + Math.PI / 2, ang + Math.PI * 1.5, false);
    p.closePath();
    shape.holes.push(p);
  }
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, thick, Math.min(0.01, thick * 0.2), 24), castIron({ roughness: 0.5 })));
  return g;
}
