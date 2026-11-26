// 211번 간헐 회전 기어 전용 키트 — 잠금판(이 없는 테)·핀·오목판·안내 조각, 상태 닫힌 식. 설계표 docs/mm507-sheets/211.md
import * as THREE from 'three';
import { brass, bronze, steel } from '../../models/materials';
import { annularSector, circlePath, circlePts, extrude, lathe, mesh, rodProfile, shapeFrom, type V2 } from '../../models/parts/geom';

const D2R = Math.PI / 180;

export const K211 = {
  W: [0.45, 1.7] as [number, number],
  P: [-1.23, 1.7] as [number, number],
  m: 0.06,
  from: 4,
  count: 14,
  zG: 0.07, // 기어 가운데 z (폭 0.10)
  ratio: -2.5,
  // 잠금판(바퀴 로컬, 그룹 원점 = 바퀴 축). 로컬 z = 세계 z − 0.07
  lockZ0: 0.06,
  lockZ1: 0.11,
  rDisc: 0.9,
  rBandIn: 0.85,
  rBandOut: 1.4,
  bandA0: 188,
  bandA1: 378,
  armAng: 166.5,
  armOuter: 1.2,
  armW: 0.07,
  bossR: 0.06,
  pinR: 0.045,
  pinZ0: 0.13,
  pinZ1: 0.245,
  // 오목판(피니언 로컬)
  plateR: 0.36,
  plateCenterAng: 316.25,
  plateCircleR: 1.408,
  plateZ0: 0.13,
  plateZ1: 0.18,
  guideZ0: 0.19,
  guideZ1: 0.24,
  // 안내 조각(피니언 로컬)
  guideQuad: [
    [0.5595, -0.3501],
    [0.0741, 0.083],
    [0.0242, 0.027],
    [0.5096, -0.4061]
  ] as V2[],
  guideTip: [0.5345, -0.3781] as V2,
  guideTipR: 0.0375,
  guideHubR: 0.13,
  // 한 주기(도)
  hit0: 5,
  mesh0: 11,
  meshEnd: 149,
  spanDeg: 144,
  lock0: 168,
  lock1: 346,
  push1: 16.8,
  phi0: 43.75,
  wDeg: 34.3775
};
// 핀 로컬 좌표(바퀴 그룹 안) — 받침 팔 끝 보스와 같은 변수
export const PIN211: V2 = [K211.armOuter * Math.cos(K211.armAng * D2R), K211.armOuter * Math.sin(K211.armAng * D2R)];
// 오목판 호 중심(피니언 로컬) = 정지 때 바퀴 축
export const PLATE_C211: V2 = [
  1.68 * Math.cos(K211.plateCenterAng * D2R),
  1.68 * Math.sin(K211.plateCenterAng * D2R)
];

/** 바퀴 잠금판 + 받침 팔 + 핀. 바퀴 그룹(원점 = 바퀴 축, 세계 z 0.07)의 자식으로 넣는다 */
export function wheelLock211(): { band: THREE.Group; pin: THREE.Mesh } {
  const zc = (K211.lockZ0 + K211.lockZ1) / 2;
  const th = K211.lockZ1 - K211.lockZ0;
  const mat = brass();
  const band = new THREE.Group();
  band.name = 'lockBand';
  // ① 원판(축 구멍) ② 테 부채꼴 ③ 받침 팔 + 보스 — 같은 층. 겹침면 z-fighting 을 피해 원판·팔을 0.0015 얇게
  // 바퀴 허브 쪽 작은 원판 + 테를 허브에 잇는 얇은 살 2개 + 핀 받침 팔(허브에서 보스까지)
  const discShape = shapeFrom(circlePts(0.3, 64));
  discShape.holes.push(circlePath(0, 0, 0.052));
  const disc = mesh(extrude(discShape, th - 0.003, 0.004, 24), mat);
  disc.position.z = zc;
  const sector = mesh(
    extrude(annularSector(K211.rBandIn, K211.rBandOut, K211.bandA0 * D2R, K211.bandA1 * D2R), th, 0.004, 48),
    mat
  );
  sector.position.z = zc;
  const spokeMesh = (ang: number, r0: number, r1: number, w: number): THREE.Mesh => {
    const len = r1 - r0;
    const sp = mesh(extrude(shapeFrom([[0, -w / 2], [len, -w / 2], [len, w / 2], [0, w / 2]]), th - 0.003, 0.003, 4), mat);
    sp.rotation.z = ang * D2R;
    sp.position.set(r0 * Math.cos(ang * D2R), r0 * Math.sin(ang * D2R), zc);
    return sp;
  };
  const arm = spokeMesh(K211.armAng, 0.25, K211.armOuter, K211.armW);
  const spokes = [spokeMesh(250, 0.25, K211.rBandIn + 0.02, 0.07), spokeMesh(320, 0.25, K211.rBandIn + 0.02, 0.07)];
  const boss = mesh(extrude(shapeFrom(circlePts(K211.bossR, 32, PIN211[0], PIN211[1])), th - 0.003, 0.004, 16), mat);
  boss.position.z = zc;
  // 테 바깥 모서리 앞면의 은색 모따기 띠(r 1.392 ~ 1.40)
  const chamfer = mesh(
    extrude(annularSector(K211.rBandOut - 0.008, K211.rBandOut, K211.bandA0 * D2R, K211.bandA1 * D2R), 0.002, 0, 48),
    new THREE.MeshStandardMaterial({ color: 0xe8e8ec, metalness: 0.9, roughness: 0.25 })
  );
  chamfer.position.z = K211.lockZ1 + 0.001;
  band.add(disc, sector, arm, ...spokes, boss, chamfer);

  const pinGeo = lathe(rodProfile(K211.pinR, 0, K211.pinZ1 - K211.pinZ0, 0.004, 0.006), 28);
  pinGeo.rotateX(Math.PI / 2);
  const pin = mesh(pinGeo, brass());
  pin.name = 'pin';
  pin.position.set(PIN211[0], PIN211[1], K211.pinZ0 - K211.zG);
  return { band, pin };
}

/** 피니언 오목판: 원판 r 0.36 에서 중심 PLATE_C211·반지름 1.408 의 원을 뺀 모양. 피니언 그룹(세계 z 0.07)의 자식으로 넣는다 */
export function pinionLock211(): THREE.Mesh {
  const d = 1.68;
  const R = K211.plateR;
  const Rc = K211.plateCircleR;
  const aC = K211.plateCenterAng * D2R;
  const alpha = Math.acos((d * d + R * R - Rc * Rc) / (2 * d * R));
  const out: V2[] = [];
  const n = 120;
  const a0 = aC + alpha;
  const a1 = aC - alpha + 2 * Math.PI;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  // 오목호: 호 중심에서 본 방향이 원점 쪽(aC + π)을 지나게 H- → H+
  const hm: V2 = [R * Math.cos(aC - alpha), R * Math.sin(aC - alpha)];
  const hp: V2 = [R * Math.cos(aC + alpha), R * Math.sin(aC + alpha)];
  const mid = aC + Math.PI;
  const rel = (p: V2): number => {
    let a = Math.atan2(p[1] - PLATE_C211[1], p[0] - PLATE_C211[0]) - mid;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  };
  const r0 = rel(hm);
  const r1 = rel(hp);
  for (let i = 1; i < 60; i++) {
    const a = mid + r0 + ((r1 - r0) * i) / 60;
    out.push([PLATE_C211[0] + Rc * Math.cos(a), PLATE_C211[1] + Rc * Math.sin(a)]);
  }
  const shape = shapeFrom(out);
  shape.holes.push(circlePath(0, 0, 0.045));
  const th = K211.plateZ1 - K211.plateZ0;
  const m = mesh(extrude(shape, th, 0.004, 24), steel());
  m.name = 'lockPlate';
  m.position.z = (K211.plateZ0 + K211.plateZ1) / 2 - K211.zG;
  return m;
}

/** 안내 조각(피니언 로컬). 사각 팔 ∪ 둥근 끝 ∪ 허브. 피니언 그룹의 자식 */
export function guide211(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'guide';
  const mat = bronze({ roughness: 0.4 });
  const th = K211.guideZ1 - K211.guideZ0;
  const zc = (K211.guideZ0 + K211.guideZ1) / 2 - K211.zG;
  const arm = mesh(extrude(shapeFrom(K211.guideQuad), th, 0.003, 4), mat);
  arm.position.z = zc;
  const tip = mesh(extrude(shapeFrom(circlePts(K211.guideTipR, 24, K211.guideTip[0], K211.guideTip[1])), th - 0.002, 0.003, 12), mat);
  tip.position.z = zc;
  const hub = mesh(extrude(shapeFrom(circlePts(K211.guideHubR, 48)), th - 0.002, 0.004, 24), mat);
  hub.position.z = zc;
  g.add(arm, tip, hub);
  return g;
}

export interface State211 {
  theta: number;
  phi: number;
  r: number;
  k: number;
  phase: string;
  turns: number;
  rotating: boolean;
  pushing: boolean;
  locked: boolean;
}

export function state211(t: number): State211 {
  const thDeg = -15 + K211.wDeg * t;
  const k = Math.floor((thDeg - K211.hit0) / 360);
  const r = thDeg - 360 * k;
  const adv = Math.min(K211.spanDeg, Math.max(0, r - K211.hit0));
  const phiDeg = K211.phi0 - 360 * k + K211.ratio * adv;
  let phase: string;
  if (r < K211.mesh0) phase = '핀이 안내 조각을 침';
  else if (r <= K211.meshEnd) phase = '이가 물려 한 바퀴';
  else if (r < K211.lock0) phase = '멈춤(잠금 들어가는 중)';
  else if (r < K211.lock1) phase = '잠김 — 이 없는 테가 오목면에';
  else phase = '풀림(핀이 다가옴)';
  return {
    theta: thDeg * D2R,
    phi: phiDeg * D2R,
    r,
    k,
    phase,
    turns: -(phiDeg - K211.phi0) / 360,
    rotating: r > K211.hit0 && r < K211.meshEnd,
    pushing: r >= K211.hit0 && r <= K211.push1,
    locked: r >= K211.lock0 && r <= K211.lock1
  };
}
