// 201번 불규칙 기어와 진동 팔 전용 키트 — 상수, 닫힌 식 동작 motion201(phi), 벨 크랭크 팔 판 bellArm201()
// 설계표 docs/mm507-sheets/201.md
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, roundedRect, rodProfile, shapeFrom, stadiumShape, TAU } from '../../models/parts/geom';
import { STAGE } from './stand';

export const K201 = {
  O: [-0.32, 2.63] as [number, number], // 불규칙 기어 축
  Q: [0.22, 1.0] as [number, number], // 팔·큰 바퀴 고정 축
  LA: 1.63, // Q → 피니언 중심
  E: 0.24, // 편심
  PHC: (225 * Math.PI) / 180, // 기어 몸 중심 방향(로컬)
  DA: 1.1, // 막대 핀의 팔 위 수평 거리
  XA: -0.88, // 막대 A 세로선
  W: 0.8, // 기어 각속도(rad/s)
  Nz: 24,
  Np: 12,
  m: 0.03,
  RB: 0.716, // 큰 바퀴 벨트 중심 반지름
  RS: 0.226 // 작은 풀리 벨트 중심 반지름
} as const;
const K = K201;
const DMESH = ((K.Nz + K.Np) * K.m) / 2; // 0.54

export interface Motion201 {
  C: [number, number];
  P: [number, number];
  alpha: number;
  beta: number;
  psi: number;
  Theta: number;
  yA: number;
  beltOffset: number;
}

/** φ(기어 각, 반시계 양수)의 닫힌 식. β 는 (−π/2, π/2) 안에서만 움직여 감기지 않으므로 atan2 가 곧 연속 가지다 */
export function motion201(phi: number): Motion201 {
  const cx = K.O[0] + K.E * Math.cos(phi + K.PHC);
  const cy = K.O[1] + K.E * Math.sin(phi + K.PHC);
  const dx = cx - K.Q[0];
  const dy = cy - K.Q[1];
  const d = Math.hypot(dx, dy);
  const ux = dx / d;
  const uy = dy / d;
  const a = (K.LA * K.LA - DMESH * DMESH + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, K.LA * K.LA - a * a));
  const px = K.Q[0] + a * ux + h * uy;
  const py = K.Q[1] + a * uy - h * ux;
  const alpha = Math.atan2(py - K.Q[1], px - K.Q[0]) - Math.PI / 2;
  const beta = Math.atan2(py - cy, px - cx);
  const psi = beta + Math.PI + Math.PI / 12 + 2 * (beta - phi);
  const rr = K.RS / K.RB;
  return {
    C: [cx, cy],
    P: [px, py],
    alpha,
    beta,
    psi,
    Theta: alpha + rr * (psi - alpha),
    yA: K.Q[1] - K.DA * Math.tan(alpha),
    beltOffset: K.RS * (psi - alpha)
  };
}

/** 팔 판(두께 0.05, 로컬 원점 = Q, 세로 팔 +Y, 수평 팔 −X). z 는 0.175~0.225 */
export function bellArm201(): THREE.Group {
  const g = new THREE.Group();
  const body = steel({ roughness: 0.4 });
  const plate = (shape: THREE.Shape, t: number, z0: number): THREE.Mesh => {
    const m = mesh(extrude(shape, t, 0.004, 24), body);
    m.position.z = z0 + t / 2;
    return m;
  };
  const withHole = (s: THREE.Shape, cx: number, cy: number, r: number): THREE.Shape => {
    s.holes.push(circlePath(cx, cy, r));
    return s;
  };
  // 허브 원판
  const hubS = new THREE.Shape();
  hubS.absarc(0, 0, 0.26, 0, TAU, false);
  g.add(plate(withHole(hubS, 0, 0, 0.045), 0.05, 0.175));
  // 세로 팔(사다리꼴) + 위 끝 눈
  const vS = shapeFrom([
    [-0.1, 0],
    [0.1, 0],
    [0.05, 1.63],
    [-0.05, 1.63]
  ]);
  withHole(vS, 0, 0, 0.045);
  g.add(plate(vS, 0.046, 0.177));
  const eyeS = new THREE.Shape();
  eyeS.absarc(0, 1.63, 0.1, 0, TAU, false);
  g.add(plate(withHole(eyeS, 0, 1.63, 0.032), 0.05, 0.175));
  // 수평 팔
  const hS = shapeFrom([
    [0, -0.07],
    [0, 0.07],
    [-0.76, 0.05],
    [-0.76, -0.05]
  ]);
  withHole(hS, 0, 0, 0.045);
  g.add(plate(hS, 0.044, 0.178));
  // 끝 홈 고리
  const ring = roundedRect(-1.44, -0.13, -0.76, 0.13, 0.13);
  ring.holes.push(stadiumShape(-1.31, 0, -0.9, 0, 0.031));
  g.add(plate(ring, 0.046, 0.177));
  // 세로 팔 가운데 노란 띠
  const band = mesh(new THREE.BoxGeometry(0.02, 1.0, 0.004), paint(0xf2b619));
  band.position.set(0, 0.9, 0.2255);
  g.add(band);
  const pinP = new THREE.Object3D();
  pinP.name = 'pinP';
  pinP.position.set(0, K.LA, 0.3);
  g.add(pinP);
  return g;
}

/** Q 고정 핀 + 뒤판 보스 + 앞 와셔 너트 */
export function fixedPinQ201(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(K.Q[0], K.Q[1], 0);
  const back = STAGE.backZ;
  const pin = lathe(rodProfile(0.04, 0, 0.26 - back, 0.004, 0.004), 28);
  pin.rotateX(Math.PI / 2);
  const pm = mesh(pin, steel());
  pm.position.z = back;
  g.add(pm);
  const boss = lathe(rodProfile(0.09, 0, 0.1, 0.01, 0.01), 32);
  boss.rotateX(Math.PI / 2);
  const bm = mesh(boss, castIron());
  bm.position.z = back;
  g.add(bm);
  const nut = lathe(rodProfile(0.07, 0, 0.03, 0.005, 0.005), 28);
  nut.rotateX(Math.PI / 2);
  const nm = mesh(nut, darkSteel());
  nm.position.z = 0.23;
  g.add(nm);
  const pivotQ = new THREE.Object3D();
  pivotQ.name = 'pivotQ';
  pivotQ.position.set(0, 0, 0.3);
  g.add(pivotQ);
  return g;
}
