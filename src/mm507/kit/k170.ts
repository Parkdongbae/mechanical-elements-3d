// 170번 전용 키트 — 교차 팔 조속기(crossed-arm governor)
//  세로 스핀들 위 끝의 혀(핀 P)에 두 팔이 가위처럼 꽂혀(서로 다른 층) 아래 끝에 공, 위 끝에 핀을 달고,
//  위 핀 둘이 짧은 링크 둘로 위 꼭짓점 T(밸브 막대 아래 끝)에 모인다(마름모). 슬라이드 없음.
//  공이 벌어지면 팔 윗부분이 더 옆으로 벌어져 마름모가 납작해지고 T(밸브 막대)가 내려온다.
//  판화의 곡선 막대(팔 사이를 가로지르는 활 모양)는 피벗과 같은 중심의 곡선 버팀대 — 스핀들 집게에 붙은 고정 한 몸으로 읽었다.
//  스핀들·크라운(바닥 쪽) + 수평 구동 피니언은 161 과 같은 짝(크라운 20 · 피니언 10 · 모듈 0.024)이며 위상 상수도 같다.
//  자세식 gov170(theta): u = theta/2, 피니언 phiP = 4u + 1.5·sin(u+1.2), 속도 인자 w = 4 + 1.5·cos(u+1.2),
//  팔 각 alpha = 24° + 24°·((w−2.5)/3)², T 높이 = 위 핀 높이 + √(링크² − 핀 옆거리²). 주기 θ 4π.
import * as THREE from 'three';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { annularSector, circlePts, extrude, lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { crownGear, spurGear } from './gear';
import { rod } from './shaft';
import { cylZ, flatPlate, hullOf, pinMark } from './k168';
import { setMM } from './mm';

export const K170 = {
  zc: 0.275, // 스핀들 축 z (공 스윗 0.275 ± 0.47)
  pv: 2.05, // 팔 피벗 높이
  Lu: 0.28, // 피벗 → 팔 위 핀
  La: 0.5, // 피벗 → 공 중심
  Lk: 0.26, // 짧은 링크 길이
  rb: 0.1, // 공 반지름
  aIn: 24 * (Math.PI / 180),
  aOut: 48 * (Math.PI / 180),
  yCrown: 0.9, // 크라운 이 뿌리 면
  yp: 1.05, // 구동축 높이
  rm: 0.24, // 크라운 피치 반지름
  nc: 20,
  np: 10,
  m: 0.024,
  psi0: -2.281973, // 161 과 같은 위상 상수: t = 1 에서 spin 이 정면(psi 0)
  pin0: 0.462602,
  yRingLow: 0.7,
  yRingMid: 1.25,
  yRingTop: 2.95,
  rodTop: 3.08,
  arcR0: 0.26,
  arcR1: 0.36,
  zA: [-0.045, -0.015] as const, // 공이 왼쪽에 달린 팔(뒤층)
  zB: [0.015, 0.045] as const,
  zLA: [-0.078, -0.048] as const, // 링크 A
  zLB: [0.048, 0.078] as const,
} as const;

export interface Pose170 {
  phiP: number;
  phiS: number;
  psi: number;
  alpha: number;
  /** 위 핀(링크 아래 끝) 오른쪽 x, 높이 */
  px: number;
  py: number;
  /** 위 꼭짓점 높이 */
  ty: number;
  /** 링크 방향(위 핀 → T)의 각 — A(오른쪽 핀) / B(왼쪽 핀) */
  linkA: number;
  linkB: number;
  ballR: number;
  ballY: number;
  w: number;
}

export function gov170(theta: number): Pose170 {
  const K = K170;
  const u = theta / 2;
  const phiP = 4 * u + 1.5 * Math.sin(u + 1.2);
  const phiS = (phiP * K.np) / K.nc;
  const w = 4 + 1.5 * Math.cos(u + 1.2);
  const s = (w - 2.5) / 3;
  const alpha = K.aIn + (K.aOut - K.aIn) * s * s;
  const px = K.Lu * Math.sin(alpha);
  const py = K.pv + K.Lu * Math.cos(alpha);
  const ty = py + Math.sqrt(K.Lk * K.Lk - px * px);
  return {
    phiP, phiS, psi: phiS + K.psi0, alpha, px, py, ty,
    linkA: Math.atan2(ty - py, -px),
    linkB: Math.atan2(ty - py, px),
    ballR: K.La * Math.sin(alpha),
    ballY: K.pv - K.La * Math.cos(alpha),
    w,
  };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylY(r: number, y0: number, y1: number, c = 0.005, segs = 28): THREE.BufferGeometry {
  return lathe(rodProfile(r, y0, y1, c, c), segs);
}
function tubeY(rIn: number, rOut: number, y0: number, y1: number, c = 0.005, segs = 40): THREE.BufferGeometry {
  return lathe(tubeProfile(rIn, rOut, y0, y1, c), segs);
}
function tubeX(rIn: number, rOut: number, x0: number, x1: number, c = 0.005, segs = 36): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, x0, x1, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** z 를 꿴 핀: 로컬 z0~z1, 머리(반지름 hr, 두께 0.012)를 heads 쪽 끝에 */
function zPin(r: number, z0: number, z1: number, hr: number, heads: 'both' | 'back' | 'front'): THREE.Group {
  const g = new THREE.Group();
  const h = 0.012;
  const a = heads === 'front' ? z0 : z0 + h;
  const b = heads === 'back' ? z1 : z1 - h;
  g.add(meshAt(cylZ(r, a, b, 0.002, 20), darkSteel(), 0, 0, 0));
  if (heads !== 'front') g.add(meshAt(cylZ(hr, z0, z0 + h, 0.003, 20), darkSteel(), 0, 0, 0));
  if (heads !== 'back') g.add(meshAt(cylZ(hr, z1 - h, z1, 0.003, 20), darkSteel(), 0, 0, 0));
  return g;
}

/**
 * 도는 한 몸(spin). 원점 = 스핀들 축 y 0 — 모델은 (0, 0, K170.zc) 에 놓고 setPose170 을 매 프레임.
 * 자식 이름: crown, armA(공이 왼쪽) armB(공이 오른쪽), linkA linkB, tee(위 꼭짓점 + 밸브 막대), arc(곡선 버팀대),
 * 표식 child pivotPin · topA · topB · teePin.
 */
export function spin170(): THREE.Group {
  const K = K170;
  const g = new THREE.Group();
  g.name = 'spin';
  // 스핀들 + 아래 장식 구
  g.add(rod(new THREE.Vector3(0, 0.66, 0), new THREE.Vector3(0, K.pv - 0.09, 0), 0.032));
  g.add(meshAt(new THREE.SphereGeometry(0.045, 20, 14), darkSteel(), 0, 0.615, 0));
  // 크라운(이 뿌리 면 y = yCrown, 이 0 = 로컬 +X)
  const crown = new THREE.Group();
  crown.name = 'crown';
  const cg = crownGear(K.nc, K.m, { width: 0.05, bore: 0.036 });
  cg.rotation.x = -Math.PI / 2;
  crown.add(cg);
  crown.position.y = K.yCrown;
  g.add(crown);
  // 스핀들 윗 끝의 혀(두 팔 사이 층 −0.012~0.012) — 피벗 핀이 꿴다
  const tongue = flatPlate(hullOf([[0, 0, 0.05], [0, -0.12, 0.032]], 28), [circlePts(0.0215, 20)], [-0.012, 0.012], castIron());
  tongue.position.y = K.pv;
  g.add(tongue);
  const pivotPin = zPin(0.02, -0.09, 0.09, 0.034, 'both');
  pivotPin.position.set(0, K.pv, 0);
  g.add(pivotPin);
  g.add(pinMark('pivotPin', 0, K.pv, 0));
  // 두 팔 — 원점 = 피벗. 로컬 −Y 로 La(공), +Y 로 Lu(위 핀 눈). A: 공 왼쪽(rotation.z = −alpha), B: 공 오른쪽(+alpha)
  for (const side of ['A', 'B'] as const) {
    const arm = new THREE.Group();
    arm.name = `arm${side}`;
    arm.position.set(0, K.pv, 0);
    const z = side === 'A' ? K.zA : K.zB;
    const outline = hullOf([[0, K.Lu, 0.04], [0, -K.La, 0.026]], 28);
    arm.add(flatPlate(outline, [circlePts(0.0215, 20), circlePts(0.0215, 20, 0, K.Lu)], z, steel()));
    arm.add(meshAt(new THREE.SphereGeometry(K.rb, 24, 18), brass(), 0, -K.La, (z[0] + z[1]) / 2));
    // 위 핀(링크와 이음): 팔 바깥 쪽으로 머리
    const pz0 = side === 'A' ? -0.09 : 0.01;
    const pz1 = side === 'A' ? -0.01 : 0.09;
    const pin = zPin(0.02, pz0, pz1, 0.034, side === 'A' ? 'back' : 'front');
    pin.position.set(0, K.Lu, 0);
    arm.add(pin);
    arm.add(pinMark(`top${side}`, 0, K.Lu, (z[0] + z[1]) / 2));
    g.add(arm);
  }
  // 짧은 링크 둘 — 원점 = 위 핀, 로컬 +X 가 T 쪽
  for (const side of ['A', 'B'] as const) {
    const link = new THREE.Group();
    link.name = `link${side}`;
    const z = side === 'A' ? K.zLA : K.zLB;
    link.add(flatPlate(hullOf([[0, 0, 0.034], [K.Lk, 0, 0.034]], 24), [circlePts(0.0215, 20), circlePts(0.0215, 20, K.Lk, 0)], z, steel()));
    g.add(link);
  }
  // 위 꼭짓점 T + 밸브 막대(원점 = T)
  const tee = new THREE.Group();
  tee.name = 'tee';
  tee.add(flatPlate(hullOf([[0, 0, 0.04], [0, 0.1, 0.022]], 24), [circlePts(0.0215, 20)], [-0.044, 0.044], castIron()));
  tee.add(meshAt(cylY(0.02, 0.09, 0.6, 0.004, 20), steel(), 0, 0, 0));
  tee.add(zPin(0.02, -0.09, 0.09, 0.034, 'both'));
  tee.add(pinMark('teePin', 0, 0, 0));
  g.add(tee);
  // 곡선 버팀대: 피벗과 같은 중심의 활 — 아래 방향 ±62°, 두께 0.03, 뒤층. 집게 블록이 스핀들에 붙는다.
  const arc = new THREE.Group();
  arc.name = 'arc';
  const sector = annularSector(K.arcR0, K.arcR1, -Math.PI / 2 - 1.08, -Math.PI / 2 + 1.08);
  const arcMesh = mesh(extrude(sector, 0.03, 0.004, 24), darkSteel());
  arcMesh.position.set(0, K.pv, -0.108);
  arc.add(arcMesh);
  const yMid = K.pv - (K.arcR0 + K.arcR1) / 2;
  arc.add(meshAt(new THREE.BoxGeometry(0.1, 0.1, 0.06), castIron(), 0, yMid, -0.063));
  g.add(arc);
  return g;
}

/** 매 프레임 자세 대입 */
export function setPose170(spin: THREE.Object3D, p: Pose170): void {
  spin.rotation.y = p.psi;
  const armA = spin.getObjectByName('armA');
  if (armA) armA.rotation.z = -p.alpha;
  const armB = spin.getObjectByName('armB');
  if (armB) armB.rotation.z = p.alpha;
  const linkA = spin.getObjectByName('linkA');
  if (linkA) {
    linkA.position.set(p.px, p.py, 0);
    linkA.rotation.z = p.linkA;
  }
  const linkB = spin.getObjectByName('linkB');
  if (linkB) {
    linkB.position.set(-p.px, p.py, 0);
    linkB.rotation.z = p.linkB;
  }
  const tee = spin.getObjectByName('tee');
  if (tee) tee.position.set(0, p.ty, 0);
}

/** 고정 받침: 아래·가운데 베어링 링(스핀들), 위 안내 링(밸브 막대), 구동축 링(왼쪽, 구멍 X 방향). 뒤판에서 나온 팔로 붙는다 */
export function frame170(): THREE.Group {
  const K = K170;
  const g = new THREE.Group();
  const frame = castIron();
  const dark = darkSteel();
  const arm = (x: number, y: number, w: number, h: number): void => {
    g.add(meshAt(new THREE.BoxGeometry(w, h, 0.516), frame, x, y, -0.045));
  };
  arm(0, K.yRingLow, 0.09, 0.06);
  g.add(meshAt(tubeY(0.036, 0.062, -0.045, 0.045), dark, 0, K.yRingLow, K.zc));
  arm(0, K.yRingMid, 0.09, 0.06);
  g.add(meshAt(tubeY(0.036, 0.062, -0.045, 0.045), dark, 0, K.yRingMid, K.zc));
  arm(0, K.yRingTop, 0.07, 0.05);
  g.add(meshAt(tubeY(0.0245, 0.05, -0.03, 0.03), dark, 0, K.yRingTop, K.zc));
  arm(-0.58, K.yp, 0.07, 0.05);
  g.add(meshAt(tubeX(0.036, 0.062, -0.045, 0.045), dark, -0.58, K.yp, K.zc));
  setMM(g, { kind: 'frame' });
  return g;
}

/** 구동축 + 피니언 — 왼쪽(−X)에서 물린다. 원점 = 피니언 가운데, 모델이 rotation.y = π 로 놓는다. */
export function drive170(): THREE.Group {
  const K = K170;
  const g = new THREE.Group();
  g.name = 'drive';
  const pivot = new THREE.Group();
  pivot.name = 'pinion';
  const pin = spurGear(K.np, K.m, { width: 0.07, spokes: 0, driver: true });
  pin.rotation.y = Math.PI / 2;
  pivot.add(pin);
  pivot.add(rod(new THREE.Vector3(-0.08, 0, 0), new THREE.Vector3(0.54, 0, 0), 0.023));
  const collar = lathe(tubeProfile(0.024, 0.05, -0.02, 0.02, 0.005), 36);
  collar.rotateZ(-Math.PI / 2);
  pivot.add(meshAt(collar, darkSteel(), 0.5, 0, 0));
  g.add(pivot);
  return g;
}
