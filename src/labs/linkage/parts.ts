// 링크 장치 부품 지오메트리 — 막대·삼각 링크·바퀴·타이어·받침 기호. 크기는 기구 배율과 무관하게 화면에서 일정하다.
// 막대와 삼각 링크는 "로컬 좌표(첫 점이 원점, 둘째 점이 +x)"로 만들어 두고 모델이 위치·회전만 갱신한다.

import * as THREE from 'three';
import { extrude, stadiumShape, circlePath, roundedRect, merge, TAU } from '../../models/parts/geom';
import type { Vec2 } from './types';

export const BAR_HW = 0.11; // 막대 반폭
export const BAR_T = 0.05; // 막대 두께
export const PIN_R = 0.05; // 핀 반지름
export const HOLE_R = 0.053; // 핀 구멍
export const HEAD_R = 0.085; // 핀 머리
export const LAYER_DZ = 0.09; // 층 간격
export const Z0 = 0.16; // 0층 중심 z (그 아래는 받침·바퀴·타이어 자리)

export const zOf = (layer: number): number => Z0 + layer * LAYER_DZ;

/** z축 방향 원기둥(z0~z1) */
export function cylZ(r: number, z0: number, z1: number, segs = 32): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, Math.max(1e-4, z1 - z0), segs, 1);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

/** 양 끝이 둥근 납작한 막대. holes: 핀 구멍의 x 위치, slot: 길게 판 홈 */
export function barGeometry(len: number, holes: number[], hw = BAR_HW, slot?: { x0: number; x1: number }): THREE.BufferGeometry {
  const shape = stadiumShape(0, 0, Math.max(len, 1e-3), 0, hw);
  for (const x of holes) shape.holes.push(circlePath(x, 0, HOLE_R));
  if (slot) shape.holes.push(roundedRect(slot.x0 - 0.105, -0.08, slot.x1 + 0.105, 0.08, 0.04));
  return extrude(shape, BAR_T, 0.008, 20, 1);
}

function triArea(a: Vec2, b: Vec2, c: Vec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** 세 점을 반지름 r로 감싼 둥근 삼각형 윤곽 */
function roundedTri(p: Vec2[], r: number): THREE.Shape {
  const pts = triArea(p[0]!, p[1]!, p[2]!) < 0 ? [p[0]!, p[2]!, p[1]!] : [p[0]!, p[1]!, p[2]!];
  const ang: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 3]!;
    ang.push(Math.atan2(-(b[0] - a[0]), b[1] - a[1])); // 반시계 방향 윤곽의 바깥 법선 각
  }
  const shape = new THREE.Shape();
  for (let i = 0; i < 3; i++) {
    const v = pts[i]!;
    const a0 = ang[(i + 2) % 3]!;
    let a1 = ang[i]!;
    while (a1 <= a0) a1 += TAU;
    if (i === 0) shape.moveTo(v[0] + r * Math.cos(a0), v[1] + r * Math.sin(a0));
    shape.absarc(v[0], v[1], r, a0, a1, false);
  }
  shape.closePath();
  return shape;
}

/** 삼각 링크(가운데를 덜어 낸 틀 모양). pts는 로컬 좌표 */
export function plateGeometry(pts: [Vec2, Vec2, Vec2]): THREE.BufferGeometry {
  const R = 0.12;
  const shape = roundedTri(pts, R);
  for (const p of pts) shape.holes.push(circlePath(p[0], p[1], HOLE_R));
  const [p0, p1, p2] = pts;
  const a = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
  const b = Math.hypot(p0[0] - p2[0], p0[1] - p2[1]);
  const c = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]);
  const per = a + b + c;
  const rho = Math.abs(triArea(p0, p1, p2)) / per; // 내접원 반지름
  if (rho > 0.35) {
    const ix = (a * p0[0] + b * p1[0] + c * p2[0]) / per;
    const iy = (a * p0[1] + b * p1[1] + c * p2[1]) / per;
    const k = (rho - 0.15) / rho;
    const dMin = Math.min(...pts.map((p) => Math.hypot(p[0] - ix, p[1] - iy)));
    if ((1 - k) * dMin - 0.03 >= 0.17) {
      const inner = pts.map((p) => [ix + (p[0] - ix) * k, iy + (p[1] - iy) * k] as Vec2);
      shape.holes.push(roundedTri(inner, 0.03));
    }
  }
  return extrude(shape, BAR_T, 0.008, 16, 1);
}

function circleShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, TAU, false);
  return s;
}

/** 기관차 바퀴 — 테두리 + 허브 + 스포크 6개. 로컬 +x 방향에 스포크 하나(크랭크 핀 자리) */
export function wheelGeometry(R: number): THREE.BufferGeometry {
  const T = 0.05;
  const rim = circleShape(R);
  rim.holes.push(circlePath(0, 0, Math.max(R - 0.14, 0.1)));
  const parts: THREE.BufferGeometry[] = [extrude(rim, T, 0.006, 48, 1), extrude(circleShape(0.24), T + 0.012, 0.006, 32, 1)];
  for (let k = 0; k < 6; k++) {
    const sp = extrude(roundedRect(0.1, -0.038, Math.max(R - 0.1, 0.2), 0.038, 0.02), T - 0.012, 0.004, 8, 1);
    sp.rotateZ((k * TAU) / 6);
    parts.push(sp);
  }
  return merge(parts);
}

/** 위에서 본 타이어(긴 쪽이 로컬 +y) — 고무 + 안쪽 휠 */
export function tireGeometry(len: number): { tire: THREE.BufferGeometry; rim: THREE.BufferGeometry } {
  const w = Math.max(0.26, len * 0.4);
  const tire = extrude(roundedRect(-w / 2, -len / 2, w / 2, len / 2, Math.min(0.12, w / 3)), 0.06, 0.01, 12, 1);
  const iw = w * 0.5;
  const il = len * 0.62;
  const rim = extrude(roundedRect(-iw / 2, -il / 2, iw / 2, il / 2, Math.min(0.08, iw / 3)), 0.07, 0.008, 12, 1);
  return { tire, rim };
}

/** 고정 링크 받침 기호 — 핀 아래로 내려가는 삼각형 + 바닥 선 + 빗금. 핀 위치가 원점 */
export function groundSymbol(flip: boolean): THREE.BufferGeometry {
  const T = 0.03;
  const tri = new THREE.Shape();
  tri.moveTo(0, 0);
  tri.lineTo(-0.27, -0.42);
  tri.lineTo(0.27, -0.42);
  tri.closePath();
  const parts: THREE.BufferGeometry[] = [extrude(tri, T, 0.004, 4, 1), extrude(roundedRect(-0.36, -0.48, 0.36, -0.42, 0.02), T, 0.004, 6, 1)];
  for (let i = 0; i < 5; i++) {
    const x = -0.3 + i * 0.15;
    parts.push(extrude(stadiumShape(x, -0.5, x - 0.1, -0.62, 0.018), T, 0.004, 6, 1));
  }
  const g = merge(parts);
  g.translate(0, 0, T / 2);
  if (flip) g.rotateZ(Math.PI);
  return g;
}

/** 얇은 선분 막대(x0,y0)-(x1,y1), 두께 t, 폭 w — 가이드·벽·바닥 선용 */
export function slab(x0: number, y0: number, x1: number, y1: number, w: number, t: number, z: number): THREE.BufferGeometry {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const g = extrude(roundedRect(0, -w / 2, Math.max(len, 1e-3), w / 2, Math.min(w / 2.5, 0.02)), t, Math.min(0.006, t / 4), 6, 1);
  g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
  g.translate(x0, y0, z);
  return g;
}
