// 197번 맹글 랙 전용 키트 — 핀 랙(스타디움 판 + 핀 줄), 피니언 중심 경로, 축 안내판, 끝 안내 호
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, circlePts, extrude, lathe, loft, merge, mesh, rodProfile, roundedRect, stadiumShape} from '../../models/parts/geom';
import { STAGE } from './stand';
import { setMM } from './mm';

/** 치수 상수 — 피니언 10 잇수, 핀 9개, 판 반높이 H, 층 z */
export const K197 = {
  N: 10,
  m: 0.056,
  pins: 9,
  YC: 1.7,
  H: 0.2,
  pinR: 0.026,
  zPlate0: -0.07,
  zPlate1: -0.01,
  zPin1: 0.17,
  zPinion: 0.1,
  pinionW: 0.1
} as const;

export const RP197 = (K197.N * K197.m) / 2; // 피니언 피치 반지름 0.28
export const P197 = Math.PI * K197.m; // 핀 간격(원피치)
export const LH197 = ((K197.pins - 1) / 2) * P197; // 핀 줄 반길이
export const LOOP197 = 4 * LH197 + 2 * Math.PI * RP197; // 피니언 중심이 랙 둘레를 한 바퀴 도는 길이

export interface Loop197 {
  /** 랙에서 본 피니언 중심(랙 가운데 = 원점) */
  cx: number;
  cy: number;
  /** 피니언 절대 각(반시계 +) — 이골이 늘 물린 핀 쪽을 향한다 */
  psi: number;
}

/**
 * 피니언 중심 경로(랙 기준): 위쪽 직선(왼쪽으로) → 왼쪽 끝 핀 둘레 반원 → 아래 직선(오른쪽으로) → 오른쪽 끝 핀 둘레 반원.
 * u = 중심이 간 호장. 순수 구름이라 피니언 각 = (u − LH)/RP + 3π/2 (이골이 핀을 문 채 반원도 같은 비율로 돈다).
 */
export function loop197(u: number): Loop197 {
  const L = LOOP197;
  const w = ((u % L) + L) % L;
  const s1 = 2 * LH197;
  const s2 = s1 + Math.PI * RP197;
  const s3 = s2 + s1;
  let cx: number;
  let cy: number;
  if (w < s1) {
    cx = LH197 - w;
    cy = RP197;
  } else if (w < s2) {
    const f = (w - s1) / RP197;
    cx = -LH197 - RP197 * Math.sin(f);
    cy = RP197 * Math.cos(f);
  } else if (w < s3) {
    cx = -LH197 + (w - s2);
    cy = -RP197;
  } else {
    const f = (w - s3) / RP197;
    cx = LH197 + RP197 * Math.sin(f);
    cy = -RP197 * Math.cos(f);
  }
  return { cx, cy, psi: (3 * Math.PI) / 2 + (u - LH197) / RP197 };
}

function atZ(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 핀 랙: 원점 = 핀 줄 가운데(피치선), 판 z −0.07~−0.01, 핀은 판에서 앞으로 z 0.17 까지. userData.outline = 판 윤곽 */
export function rack197(): THREE.Group {
  const g = new THREE.Group();
  const K = K197;
  const depth = K.zPlate1 - K.zPlate0;
  const plate = mesh(extrude(stadiumShape(-LH197, 0, LH197, 0, K.H), depth, 0.006, 32), steel({ roughness: 0.42 }));
  plate.position.z = (K.zPlate0 + K.zPlate1) / 2;
  g.add(plate);
  const geos: THREE.BufferGeometry[] = [];
  for (let k = 0; k < K.pins; k++) {
    const x = (k - (K.pins - 1) / 2) * P197;
    const geo = lathe(rodProfile(K.pinR, 0, K.zPin1 - K.zPlate1 + 0.015, 0.004, 0.008), 20);
    geo.rotateX(Math.PI / 2);
    geo.translate(x, 0, K.zPlate1 - 0.015);
    geos.push(geo);
  }
  g.add(mesh(merge(geos), darkSteel()));
  // 표시: 판 앞면의 가운데 줄
  g.add(atZ(new THREE.BoxGeometry(0.02, 0.1, 0.006), paint(0xf2b619), 0, 0.0, K.zPlate1 + 0.001));
  setMM(g, { kind: 'rack', fn: 'rack197', module: K.m, teeth: K.pins, half: LH197 + K.H, width: depth, axis: 'x', pins: true });
  return g;
}

/** 피니언 축 안내판(고정): 뒤판에 붙은 판, 세로 홈이 축을 안내. 원점 = 홈 가운데 (x, yc), 판 z −0.30~−0.20 */
export function shaftGuide197(x: number, yc: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, yc, 0);
  const shape = roundedRect(-0.17, -0.5, 0.17, 0.5, 0.03);
  const hole = stadiumShape(0, -RP197, 0, RP197, 0.05);
  shape.holes.push(new THREE.Path(hole.getPoints(24)));
  const plate = mesh(extrude(shape, 0.1, 0.006), castIron());
  plate.position.z = STAGE.backZ + 0.05;
  g.add(plate);
  // 홈 가장자리 쇠테(앞면)
  const rimShape = stadiumShape(0, -RP197, 0, RP197, 0.066);
  rimShape.holes.push(new THREE.Path(stadiumShape(0, -RP197, 0, RP197, 0.05).getPoints(24)));
  const rim = mesh(extrude(rimShape, 0.012, 0.003), darkSteel());
  rim.position.z = STAGE.backZ + 0.1 + 0.004;
  g.add(rim);
  return g;
}

/** 랙 둘레 안내 레일(고정): 판의 위·아래 가장자리 바깥에서 뒤판까지 닿는 막대 — x0~x1, y 높이 가운데 */
export function rail197(x0: number, x1: number, y: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(x1 - x0, 0.03, K197.zPlate1 - STAGE.backZ);
  const m = atZ(geo, castIron(), (x0 + x1) / 2, y, (K197.zPlate1 + STAGE.backZ) / 2);
  return m;
}

/** 끝 안내 호(고정): 판 끝 둘레를 둘러싸는 C 모양 — 원점 = 호 중심, dir=+1 이면 오른쪽 ')' */
export function endArc197(dir: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  const span = (72 * Math.PI) / 180;
  const a0 = dir > 0 ? -span : Math.PI - span;
  const a1 = dir > 0 ? span : Math.PI + span;
  const depth = K197.zPlate1 - STAGE.backZ;
  const geo = extrude(annularSector(0.32, 0.37, a0, a1), depth, 0.004, 24);
  g.add(atZ(geo, castIron(), 0, 0, (K197.zPlate1 + STAGE.backZ) / 2));
  return g;
}

/**
 * 핀 랙에 맞춘 피니언 이 윤곽(기어 로컬, 이골 중심 = 각 0). 핀(반지름 pinR + 여유 0.002)이 구름 운동으로
 * 훑는 영역을 반지름 방향으로 깎아 낸 포락선이라, 핀이 늘 이 사이 골에 꼭 들어가 한쪽 옆면에 닿는다.
 */
export function pinionOutline197(): [number, number][] {
  const K = K197;
  const rho = K.pinR + 0.002;
  const ra = RP197 + K.m;
  const step = (2 * Math.PI) / K.N;
  const discs: [number, number][] = [];
  for (let si = 0; si <= 240; si++) {
    const s = -2 * P197 + (4 * P197 * si) / 240;
    const psi = 1.5 * Math.PI + s / RP197;
    const c = Math.cos(-psi);
    const sn = Math.sin(-psi);
    for (let j = -3; j <= 3; j++) {
      const x = j * P197 + s;
      const y = -RP197;
      discs.push([x * c - y * sn, x * sn + y * c]);
    }
  }
  const radius = (th: number): number => {
    let best = ra;
    const dx = Math.cos(th);
    const dy = Math.sin(th);
    for (const [cx, cy] of discs) {
      const b = cx * dx + cy * dy;
      const d2 = cx * cx + cy * cy - b * b;
      if (d2 > rho * rho) continue;
      const h = b - Math.sqrt(rho * rho - d2);
      if (h > 0 && h < best) best = h;
    }
    return best;
  };
  const per = 72;
  const one: number[] = [];
  for (let i = 0; i < per; i++) one.push(radius(-step / 2 + (step * i) / per));
  const pts: [number, number][] = [];
  for (let t = 0; t < K.N; t++) {
    for (let i = 0; i < per; i++) {
      const a = t * step - step / 2 + (step * i) / per;
      pts.push([Math.cos(a) * one[i]!, Math.sin(a) * one[i]!]);
    }
  }
  return pts;
}

/** 피니언 몸통(핀 랙용 이): spurGear 의 림과 같은 층 구성, 이 윤곽만 교체 */
export function pinionBody197(): THREE.BufferGeometry {
  const K = K197;
  const w = K.pinionW;
  const ra = RP197 + K.m;
  const rf = RP197 - 1.25 * K.m;
  const rRim = rf * 0.72;
  const c = Math.min(K.m * 0.35, w * 0.16);
  const layers = [
    { z: -w / 2, s: (ra - c) / ra, hs: (rRim + c) / rRim },
    { z: -w / 2 + c, s: 1, hs: 1 },
    { z: w / 2 - c, s: 1, hs: 1 },
    { z: w / 2, s: (ra - c) / ra, hs: (rRim + c) / rRim }
  ];
  return loft(pinionOutline197(), [circlePts(rRim, 64)], layers);
}
