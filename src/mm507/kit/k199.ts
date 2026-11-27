// 199번 등롱 피니언 맹글 랙 전용 키트 — 반원에만 핀이 선 등롱 피니언, 위·아래 이 줄이 안쪽에 난 틀, 닫힌 시간표
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, lathe, loft, merge, mesh, pathFrom, rodProfile, tubeProfile, shapeFrom, TAU } from '../../models/parts/geom';
import type { V2 } from './belt';
import { setMM } from './mm';

export const K199 = {
  YC: 1.7,
  rp: 0.3, // 핀 원 반지름
  pins: 5, // 핀 수(36° 간격 → 반 바퀴)
  pinR: 0.04, // 핀 지름 0.08 ≈ 이골 폭 0.09 − 여유(판화에서도 핀이 이골을 거의 채움)
  zFrame0: 0.06,
  zFrame1: 0.14,
  frameHalf: 1.3,
  frameH: 0.62,
  rollerR: 0.09,
  slotRoot: 0.345, // 이뿌리까지(가운데에서)
  slotTip: 0.255, // 이끝까지
  gapW: 0.09,
  clr: 0.003 // 핀 훑는 영역 바깥 여유(틈)
} as const;

const RP = K199.rp;
export const TAU199 = TAU / 10; // 핀 간격 각 36°
export const P199 = RP * TAU199; // 핀 간격(호)
export const S199 = Math.PI * RP; // 틀 행정(반 바퀴 동안)
const D2R = Math.PI / 180;
const B0 = 108 * D2R; // 아래 줄 물림 시작
const B1 = 288 * D2R; // 아래 줄 물림 끝 = 위 줄 물림 시작

/** 틀 위치(피니언 각 theta, 주기 2π): 아래 줄 물림은 오른쪽으로, 위 줄 물림은 왼쪽으로 */
export function frame199(theta: number): { X: number; side: 'bottom' | 'top' } {
  const q = ((theta % TAU) + TAU) % TAU;
  if (q >= B0 && q < B1) return { X: -S199 / 2 + RP * (q - B0), side: 'bottom' };
  const r = q >= B1 ? q : q + TAU;
  return { X: S199 / 2 - RP * (r - B1), side: 'top' };
}

/** 틀 로컬 이골(핀이 드는 자리) x 좌표: 핀이 줄 한가운데(피니언 바로 위·아래)를 지날 때 틀 위치로 계산 */
export function gaps199(side: 'bottom' | 'top'): number[] {
  const out: number[] = [];
  for (let j = 0; j < K199.pins; j++) {
    const th = side === 'bottom' ? 270 * D2R - j * TAU199 : 90 * D2R - j * TAU199 + TAU;
    out.push(-frame199(th).X);
  }
  return out.sort((a, b) => a - b);
}


/** 한 줄(아래/위)의 이 높이 곡선: 핀이 한 주기 동안 틀 안에서 훑는 영역(핀 반지름+여유)을 이끝(0.255)에서 이뿌리까지 깎고 남은 자리.
 *  [x(틀 로컬), 깊이(가운데에서 이 줄까지의 거리)] 목록 — 이 사이 홈은 핀 둘레에 꼭 맞고, 핀이 들고 나는 길도 깎여 모서리를 파고들지 않는다. */
const rowCache: Record<string, V2[]> = {};
export function rowTop199(side: 'bottom' | 'top'): V2[] {
  if (rowCache[side]) return rowCache[side]!;
  const K = K199;
  const Rc = K.pinR + K.clr;
  const g = gaps199(side);
  const disks: V2[] = [];
  const sg = side === 'bottom' ? -1 : 1;
  for (let th = 0; th < TAU; th += 0.2 * D2R) {
    const X = frame199(th).X;
    for (let j = 0; j < K.pins; j++) {
      const ph = th + j * TAU199;
      disks.push([RP * Math.cos(ph) - X, sg * RP * Math.sin(ph)]);
    }
  }
  const xl = g[0]! - P199 / 2 - 0.5 * (P199 - K.gapW);
  const xr = g[g.length - 1]! + P199 / 2 + 0.5 * (P199 - K.gapW);
  const out: V2[] = [];
  const n = Math.round((xr - xl) / 0.002);
  for (let i = 0; i <= n; i++) {
    const x = xl + (i * (xr - xl)) / n;
    let top: number = K.slotTip;
    for (const [cx, cd] of disks) {
      const dx = x - cx;
      if (Math.abs(dx) < Rc) top = Math.max(top, cd + Math.sqrt(Rc * Rc - dx * dx));
    }
    out.push([x, Math.min(top, K.slotRoot)]);
  }
  rowCache[side] = out;
  return out;
}

/** 틀 바깥 윤곽(양끝이 오목하게 파인 판) + 안쪽 홈(양쪽에 이 줄) */
export function frameBody199(): THREE.Group {
  const K = K199;
  const g = new THREE.Group();
  const H = K.frameH;
  const W = K.frameHalf;
  const pts: V2[] = [];
  // 끝 가장자리: 아래 귀퉁이 → 오목한 호 → 위 귀퉁이 (sx = 오른쪽 +1 / 왼쪽 −1)
  const edge = (sx: 1 | -1): V2[] => {
    const a: V2[] = [];
    const half = 0.4;
    const sag = 0.28;
    const r = (half * half + sag * sag) / (2 * sag);
    const cx = sx * (W - sag + r);
    const a0 = Math.asin(half / r);
    for (let i = 0; i <= 14; i++) {
      const ang = -a0 + (2 * a0 * i) / 14;
      a.push([cx - sx * r * Math.cos(ang), r * Math.sin(ang)]);
    }
    return a;
  };
  pts.push([-W + 0.1, -H], [W - 0.1, -H], [W, -H + 0.1], [W, -0.4]);
  pts.push(...edge(1));
  pts.push([W, 0.4], [W, H - 0.1], [W - 0.1, H], [-W + 0.1, H], [-W, H - 0.1], [-W, 0.4]);
  pts.push(...edge(-1).reverse());
  pts.push([-W, -0.4], [-W, -H + 0.1]);
  // 안쪽 홈(양끝 둥근 홈 + 위·아래 이 줄)
  const gb = gaps199('bottom');
  const rr = K.slotRoot;
  const cL = -0.52;
  const cR = 0.52;
  const hole: V2[] = [];
  // 아래 줄: 왼쪽 → 오른쪽 (이끝이 +y). 이 높이는 핀이 훑는 영역대로 깎음
  const rb = rowTop199('bottom');
  hole.push([rb[0]![0], -rr]);
  for (const [x, d] of rb) hole.push([x, -d]);
  hole.push([rb[rb.length - 1]![0], -rr]);
  // 오른쪽 둥근 끝
  for (let i = 1; i < 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 12;
    hole.push([cR + rr * Math.cos(a), rr * Math.sin(a)]);
  }
  // 위 줄: 오른쪽 → 왼쪽 (이끝이 −y)
  const rt = rowTop199('top');
  hole.push([rt[rt.length - 1]![0], rr]);
  for (let i = rt.length - 1; i >= 0; i--) hole.push([rt[i]![0], rt[i]![1]]);
  hole.push([rt[0]![0], rr]);
  for (let i = 1; i < 12; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 12;
    hole.push([cL + rr * Math.cos(a), rr * Math.sin(a)]);
  }
  const shape = shapeFrom(pts);
  shape.holes.push(pathFrom(hole));
  const depth = K.zFrame1 - K.zFrame0;
  const plate = mesh(extrude(shape, depth, 0.005, 12), castIron());
  plate.position.z = (K.zFrame0 + K.zFrame1) / 2;
  g.add(plate);
  const mk = mesh(new THREE.BoxGeometry(0.2, 0.04, 0.006), paint(0xf2b619));
  mk.position.set(-0.9, H - 0.1, K.zFrame1 + 0.001);
  g.add(mk);
  g.userData.outlines = { window: hole };
  setMM(g, { kind: 'rack', fn: 'frameBody199', module: P199 / Math.PI, teeth: gb.length, half: W, width: depth, axis: 'x', rows: 2 });
  return g;
}

/** 등롱 피니언: 원점 = 축, 핀 j 는 로컬 각 j·36°(j = 0..4), 이 없는 쪽은 반원 판 */
export function lantern199(): THREE.Group {
  const K = K199;
  const g = new THREE.Group();
  const rd = 0.36;
  for (const [z0, z1] of [
    [0.02, 0.04]
  ] as [number, number][]) {
    const geo = loft(circlePts(rd, 64), [circlePts(0.04, 24)], [
      { z: z0, s: 1, hs: 1 },
      { z: z1, s: 1, hs: 1 }
    ]);
    g.add(mesh(geo, brass()));
  }
  const geos: THREE.BufferGeometry[] = [];
  for (let j = 0; j < K.pins; j++) {
    const a = j * TAU199;
    const geo = lathe(rodProfile(K.pinR, 0.035, 0.165, 0.003, 0.003), 20);
    geo.rotateX(Math.PI / 2);
    geo.translate(RP * Math.cos(a), RP * Math.sin(a), 0);
    geos.push(geo);
  }
  g.add(mesh(merge(geos), steel()));
  // 이 없는 반쪽: 핀이 안 선 반원(핀 반 원 맞은편) — 이끝 안쪽으로 닿는 매끈한 반원 판
  const a0 = (K.pins - 0.5) * TAU199 + 0.0;
  const sec = new THREE.Shape();
  sec.moveTo(0, 0);
  sec.absarc(0, 0, 0.225, a0, a0 + Math.PI, false);
  sec.closePath();
  const secMesh = mesh(extrude(sec, 0.06, 0.004, 24), bronze({ roughness: 0.4 }));
  secMesh.position.z = 0.1;
  g.add(secMesh);
  const hubGeo = lathe(tubeProfile(0.04, 0.09, 0.0, 0.2, 0.008), 28);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  const mk = mesh(new THREE.BoxGeometry(0.1, 0.018, 0.008), paint(0xf2b619));
  mk.position.set(0.15, 0, 0.184);
  g.add(mk);
  setMM(g, { kind: 'pinion', fn: 'lantern199', pins: K.pins, pitchR: RP });
  return g;
}
