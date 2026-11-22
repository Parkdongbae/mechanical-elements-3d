// 롤러 체인: 경로(ChainPath2D) + 링크(8자형 안/바깥 플레이트, 롤러, 핀)
// 자전거가 자식들의 userData.s(경로 호장거리)로 체인을 움직이므로, 링크 1개 = 자식 메시 1개로 유지한다.

import * as THREE from 'three';
import { steel } from '../materials';
import { type V2, merge, tint, extrude, shapeFrom, pathFrom, circlePts, lathe } from './geom';

/** 두 스프로킷(반지름 다름 가능)을 감싸는 체인 경로. 2D XY 평면. */
export class ChainPath2D {
  readonly length: number;
  private readonly c1: [number, number];
  private readonly r1: number;
  private readonly c2: [number, number];
  private readonly r2: number;
  private readonly aTop: number;
  private readonly aBot: number;
  private readonly p1Top: [number, number];
  private readonly p2Top: [number, number];
  private readonly p1Bot: [number, number];
  private readonly p2Bot: [number, number];
  private readonly topLen: number;
  private readonly botLen: number;
  private readonly arc2Len: number;
  private readonly arc1Len: number;

  constructor(c1x: number, c1y: number, r1: number, c2x: number, c2y: number, r2: number) {
    this.c1 = [c1x, c1y];
    this.r1 = r1;
    this.c2 = [c2x, c2y];
    this.r2 = r2;
    const dx = c2x - c1x;
    const dy = c2y - c1y;
    const D = Math.hypot(dx, dy);
    const beta = Math.atan2(dy, dx);
    const delta = Math.acos(Math.min(1, Math.max(-1, (r2 - r1) / D)));
    this.aTop = beta + Math.PI - delta;
    this.aBot = beta - Math.PI + delta;
    this.p1Top = [c1x + r1 * Math.cos(this.aTop), c1y + r1 * Math.sin(this.aTop)];
    this.p2Top = [c2x + r2 * Math.cos(this.aTop), c2y + r2 * Math.sin(this.aTop)];
    this.p1Bot = [c1x + r1 * Math.cos(this.aBot), c1y + r1 * Math.sin(this.aBot)];
    this.p2Bot = [c2x + r2 * Math.cos(this.aBot), c2y + r2 * Math.sin(this.aBot)];
    this.topLen = Math.hypot(this.p2Top[0] - this.p1Top[0], this.p2Top[1] - this.p1Top[1]);
    this.botLen = Math.hypot(this.p1Bot[0] - this.p2Bot[0], this.p1Bot[1] - this.p2Bot[1]);
    this.arc2Len = r2 * (2 * Math.PI - 2 * delta);
    this.arc1Len = r1 * (2 * delta);
    this.length = this.topLen + this.arc2Len + this.botLen + this.arc1Len;
  }

  /** 경로상 호장거리 s 위치의 {x, y, angle(접선 방향)} */
  pointAt(s: number): { x: number; y: number; angle: number } {
    let u = s % this.length;
    if (u < 0) u += this.length;
    if (u < this.topLen) {
      const k = u / this.topLen;
      return {
        x: this.p1Top[0] + (this.p2Top[0] - this.p1Top[0]) * k,
        y: this.p1Top[1] + (this.p2Top[1] - this.p1Top[1]) * k,
        angle: Math.atan2(this.p2Top[1] - this.p1Top[1], this.p2Top[0] - this.p1Top[0])
      };
    }
    u -= this.topLen;
    if (u < this.arc2Len) {
      const ang = this.aTop - u / this.r2;
      return { x: this.c2[0] + this.r2 * Math.cos(ang), y: this.c2[1] + this.r2 * Math.sin(ang), angle: ang - Math.PI / 2 };
    }
    u -= this.arc2Len;
    if (u < this.botLen) {
      const k = u / this.botLen;
      return {
        x: this.p2Bot[0] + (this.p1Bot[0] - this.p2Bot[0]) * k,
        y: this.p2Bot[1] + (this.p1Bot[1] - this.p2Bot[1]) * k,
        angle: Math.atan2(this.p1Bot[1] - this.p2Bot[1], this.p1Bot[0] - this.p2Bot[0])
      };
    }
    u -= this.botLen;
    // 뒤쪽 원(원쪽 스프로킷)의 바깥면(원접면)을 감는 호: 각도 감소 방향
    const ang = this.aBot - u / this.r1;
    return { x: this.c1[0] + this.r1 * Math.cos(ang), y: this.c1[1] + this.r1 * Math.sin(ang), angle: ang - Math.PI / 2 };
  }
}

const PLATE_COLOR = 0x59626c;
const ROLLER_COLOR = 0xc9d1d9;
const PIN_COLOR = 0xe6ebf0;

/** 8자형 링크 플레이트 외곽 (중심 원점, 롤러 중심 ±P/2) */
function plateOutline(P: number, a: number, w: number): V2[] {
  const half = P / 2 + a;
  const yAt = (x: number): number => {
    const lobe = (u: number): number => (Math.abs(u) < a ? Math.sqrt(a * a - u * u) : 0);
    const t = Math.min(1, Math.abs(x) / (P / 2));
    const waist = w + (a - w) * t * t;
    return Math.max(lobe(x - P / 2), lobe(x + P / 2), Math.abs(x) <= P / 2 ? waist : 0);
  };
  const n = 22;
  const top: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const x = half * Math.cos((i / n) * Math.PI);
    top.push([x, yAt(x)]);
  }
  const bottom: V2[] = top.slice(1, -1).reverse().map(([x, y]) => [x, -y] as V2);
  return [...top, ...bottom];
}

/** 링크 1개(안쪽: 플레이트+롤러, 바깥쪽: 플레이트+핀). x축 방향, 정점색 포함 */
export function chainLinkGeometry(P: number, inner: boolean): THREE.BufferGeometry {
  const t = P * 0.1;
  const a = inner ? P * 0.36 : P * 0.38;
  const outline = plateOutline(P, a, a * 0.72);
  const holeR = inner ? P * 0.19 : P * 0.16;
  const shape = shapeFrom(outline);
  shape.holes.push(pathFrom(circlePts(holeR, 14, -P / 2).reverse()), pathFrom(circlePts(holeR, 14, P / 2).reverse()));
  const parts: THREE.BufferGeometry[] = [];
  const zPlate = inner ? P * 0.25 : P * 0.36;
  for (const sgn of [-1, 1]) {
    const g = extrude(shape, t, t * 0.22, 4);
    g.translate(0, 0, sgn * zPlate);
    parts.push(tint(g, PLATE_COLOR));
  }
  for (const sx of [-P / 2, P / 2]) {
    if (inner) {
      const r = P * 0.31;
      const h = P * 0.2;
      const g = lathe([[0, -h], [r - P * 0.03, -h], [r, -h + P * 0.03], [r, h - P * 0.03], [r - P * 0.03, h], [0, h]], 20);
      g.rotateX(Math.PI / 2);
      g.translate(sx, 0, 0);
      parts.push(tint(g, ROLLER_COLOR));
    } else {
      const r = P * 0.155;
      const h = P * 0.47;
      const g = lathe([[0, -h - P * 0.03], [r * 0.7, -h - P * 0.02], [r, -h], [r, h], [r * 0.7, h + P * 0.02], [0, h + P * 0.03]], 14);
      g.rotateX(Math.PI / 2);
      g.translate(sx, 0, 0);
      parts.push(tint(g, PIN_COLOR));
    }
  }
  return merge(parts);
}

/** 체인 링크 재질: 정점색으로 플레이트(어두운 강)·롤러(밝은 강)를 한 메시에 담는다 */
export function chainMaterial(): THREE.MeshStandardMaterial {
  const m = steel({ color: 0xffffff, roughness: 0.36, grain: false });
  m.vertexColors = true;
  return m;
}

/** 경로를 따라 체인 링크들을 배치한 Group 생성 (자식마다 userData.s = 경로 호장거리) */
export function buildChainAlongPath(path: ChainPath2D, linkPitch = 0.16, z = 0): THREE.Group {
  const group = new THREE.Group();
  let count = Math.max(12, Math.round(path.length / linkPitch));
  if (count % 2 === 1) count += 1; // 안/바깥 링크가 번갈아 이어지도록 짝수
  const P = path.length / count;
  const innerGeo = chainLinkGeometry(P, true);
  const outerGeo = chainLinkGeometry(P, false);
  const material = chainMaterial();
  for (let i = 0; i < count; i++) {
    const s = (i / count) * path.length;
    const p = path.pointAt(s);
    const m = new THREE.Mesh(i % 2 === 0 ? innerGeo : outerGeo, material);
    m.position.set(p.x, p.y, z);
    m.rotation.z = p.angle;
    m.userData.s = s;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
