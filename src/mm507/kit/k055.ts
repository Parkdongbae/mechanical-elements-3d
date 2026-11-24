// 055·056 전용 키트 — 홈 뚫린 블록·홈 레버 판 (설계표 055·056)
import * as THREE from 'three';
import { castIron, darkSteel, steel } from '../../models/materials';
import { extrude, mesh, roundedRect } from '../../models/parts/geom';
import type { V2 } from './belt';

const TAU = Math.PI * 2;

/** 스타디움(알약) 모양 구멍 경로: 두 끝 중심 a, b, 반폭 r */
function stadiumHole(a: V2, b: V2, r: number): THREE.Path {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const p = new THREE.Path();
  p.absarc(b[0], b[1], r, ang - Math.PI / 2, ang + Math.PI / 2, false);
  p.absarc(a[0], a[1], r, ang + Math.PI / 2, ang + Math.PI * 1.5, false);
  p.closePath();
  return p;
}

/**
 * 가로 홈이 뚫린 안내 블록. 원점 = 홈 중심, 홈의 긴 방향 = X, 두께는 z 로 가운데(−depth/2 ~ +depth/2).
 * slotLen = 홈 전체 길이(끝 둥근 부분 포함), slotW = 홈 폭. 뒤판에 붙이는 안내 레일 역할.
 */
export function slotBlock(w: number, h: number, depth: number, slotLen: number, slotW: number): THREE.Group {
  const shape = roundedRect(-w / 2, -h / 2, w / 2, h / 2, Math.min(0.03, h * 0.2));
  const r = slotW / 2;
  const half = Math.max(0, slotLen / 2 - r);
  shape.holes.push(stadiumHole([-half, 0], [half, 0], r));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, depth, Math.min(0.012, depth * 0.2), 24), castIron({ roughness: 0.5 })));
  return g;
}

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

export interface CamLeverPlateOpts {
  /** 받침점 둘레 판 반지름 (기본 0.13) */
  pivotR?: number;
  /** 홈 둘레 판 반폭 (기본 0.11) */
  edgeR?: number;
  /** 홈 반폭 = 핀 반지름 + 여유 (기본 0.036) */
  slotR?: number;
  /** 두께 (기본 0.045) */
  thick?: number;
}

/**
 * 변속 레버의 홈 판. 원점 = 받침점(레버 회전축), 평면 = XY, z 가운데.
 * 판 윤곽 = 받침점 원 · 홈 양 끝 원 세 개의 볼록 껍질. 홈은 slotA~slotB(레버 로컬 좌표) 를 잇는 알약 구멍.
 * 받침점에 축 구멍(작은 원통) 하나가 붙는다. 레버 막대는 키트 lever() 를 따로 겹쳐 쓴다.
 */
export function camLeverPlate(slotA: V2, slotB: V2, opts: CamLeverPlateOpts = {}): THREE.Group {
  const pr = opts.pivotR ?? 0.13;
  const er = opts.edgeR ?? 0.11;
  const sr = opts.slotR ?? 0.036;
  const t = opts.thick ?? 0.045;
  const pts: V2[] = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    pts.push([Math.cos(a) * pr, Math.sin(a) * pr]);
    pts.push([slotA[0] + Math.cos(a) * er, slotA[1] + Math.sin(a) * er]);
    pts.push([slotB[0] + Math.cos(a) * er, slotB[1] + Math.sin(a) * er]);
  }
  const outline = hull(pts);
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  shape.holes.push(stadiumHole(slotA, slotB, sr));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, t, Math.min(0.01, t * 0.22), 24), steel({ roughness: 0.4 })));
  // 받침점 머리(어두운 캡)
  const cap = mesh(new THREE.CylinderGeometry(0.05, 0.05, t + 0.03, 24), darkSteel());
  cap.rotation.x = Math.PI / 2;
  g.add(cap);
  return g;
}
