// 161번 전용 키트 — 원심 조속기(centrifugal governor)
//  세로 스핀들 + 크라운 기어(위) · 두 팔과 공 · 링크 · 슬라이드(슬리브)와 조절 지레가 한 몸으로 도는
//  spin 그룹, 고정 받침(뒤판 팔 넷: 아래 베어링 링 · 밸브 지레 collar · 중간 베어링 링 · 구동축 링),
//  고정 밸브 지레(포크 끝), 구동 피니언+수평축. 판화에 구동축·받침은 없음 — 원문(베벨 기어 구동)과
//  "떠 있는 부품 없음" 규칙의 최소 보충이다.
//  운동식 gov161(theta): u = theta/2, 피니언 각 phiP = 4u + 1.5·sin(u+1.2) — 기관 속도 인자
//  w = 4 + 1.5·cos(u+1.2) ∈ [2.5, 5.5], 팔 각 α = 24° + 31°·((w−2.5)/3)² (원심력 ∝ 속도²),
//  슬라이드 Sy = 러그 y − √(링크² − Δx²). 한 주기(θ 4π = 7.85 s)에 피니언 4바퀴·스핀들 2바퀴라
//  기어 물림·조절 지레 방위까지 정확히 닫힌다.
//  t = 1 (θ 1.6, 판화 자세): α 26.6° · 조절 지레 −X · 크라운 이 0 이 +X 접촉 방위 · 피니언 최하점에 이골.
import * as THREE from 'three';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { rod } from './shaft';
import { crownGear, spurGear } from './gear';
import { markPin, setMM } from './mm';

export const K161 = {
  zc: 0.275, // 스핀들 축의 z — 공·지레 스윗의 중심 (전시 깊이 0.275 ± 0.516)
  hy: 2.34, // 팔 힌지 높이
  pinx: 0.052, // 힌지 핀의 축에서 오프셋
  armL: 0.45, // 힌지→공 중심 팔 길이
  rb: 0.095, // 공 반지름
  lug: 0.2745, // 힌지→러그(링크 위 핀) 거리
  lk: 0.32, // 링크 길이(러그 핀↔슬리브 핀)
  sp: 0.055, // 슬리브 핀 반경
  aIn: 24 * (Math.PI / 180), // 팔 각 하한(수직에서 바깥, 기관 느림)
  aOut: 55 * (Math.PI / 180), // 팔 각 상한(기관 빠름)
  nc: 20, // 크라운 잇수
  np: 10, // 피니언 잇수
  m: 0.024, // 모듈
  rm: 0.24, // 크라운 피치 반지름 = nc·m/2
  rp: 0.12, // 피니언 피치 반지름 = np·m/2
  yPlate: 2.54, // 크라운 이 뿌리 면 높이 (피치면 +1.25m)
  yp: 2.69, // 구동축 높이 = yPlate + 1.25m + rp
  leverY: 1.35, // 밸브 지레(고정) 높이
  psi0: -2.281973, // spin 위상 상수 — t=1 에서 조절 지레가 −X (판화 자세)
  pin0: 0.462602, // 피니언 위상 상수 — t=1 에서 접촉점(피니언 최하점)에 이골
} as const;

export interface Pose161 {
  /** 피니언 각 — 피벗 `pinion` 의 rotation.x = phiP + K161.pin0 */
  phiP: number;
  /** 스핀들 각 — spin rotation.y = phiS + K161.psi0 */
  phiS: number;
  /** spin 그룹에 바로 대입하는 각(phiS + psi0) */
  psi: number;
  /** 팔 각(rad, 수직에서 바깥) — armR.rotation.z = alpha, armL.rotation.z = −alpha */
  alpha: number;
  /** 슬라이드 핀 높이 — sleeve.position.y */
  sy: number;
  /** 링크 기울기(rad, 수직에서 바깥이 +) — linkR.rotation.z = −linkAng, linkL = +linkAng */
  linkAng: number;
  /** 러그(링크 위 핀)의 spin 로컬 반지름·높이 — linkR/L 위치 */
  lugR: number;
  lugY: number;
  /** 공 중심의 spin 로컬 반지름·높이(이름표 따라가기용) */
  ballR: number;
  ballY: number;
  /** 기관 속도 인자 w ∈ [2.5, 5.5] — notes 표시용 */
  w: number;
}

/** 모든 자세의 닫힌 식. u = theta/2, 한 주기 = θ 4π */
export function gov161(theta: number): Pose161 {
  const u = theta / 2;
  const phiP = 4 * u + 1.5 * Math.sin(u + 1.2);
  const phiS = (phiP * K161.np) / K161.nc;
  const w = 4 + 1.5 * Math.cos(u + 1.2);
  const s = (w - 2.5) / 3;
  const alpha = K161.aIn + (K161.aOut - K161.aIn) * s * s;
  const lugR = K161.pinx + K161.lug * Math.sin(alpha);
  const lugY = K161.hy - K161.lug * Math.cos(alpha);
  const sy = lugY - Math.sqrt(K161.lk * K161.lk - (lugR - K161.sp) * (lugR - K161.sp));
  const linkAng = Math.atan2(lugR - K161.sp, lugY - sy);
  return {
    phiP, phiS, psi: phiS + K161.psi0, alpha, sy, linkAng, lugR, lugY,
    ballR: K161.pinx + K161.armL * Math.sin(alpha),
    ballY: K161.hy - K161.armL * Math.cos(alpha),
    w,
  };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
/** Y축 원기둥/관(스핀들 주위 부품) */
function cylY(r: number, y0: number, y1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  return lathe(rodProfile(r, y0, y1, c, c), segs);
}
function tubeY(rIn: number, rOut: number, y0: number, y1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  return lathe(tubeProfile(rIn, rOut, y0, y1, c), segs);
}
/** Z축 원기둥/관(핀·눈) */
function cylZ(r: number, z0: number, z1: number, c = 0.005, segs = 24): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.005, segs = 36): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** X축 관(구동축 베어링 링) */
function tubeX(rIn: number, rOut: number, x0: number, x1: number, c = 0.005, segs = 36): THREE.BufferGeometry {
  const g = tubeZ(rIn, rOut, x0, x1, c, segs);
  g.rotateY(Math.PI / 2);
  return g;
}
/** 두 점을 잇는 가늘어지는 판(반폭 w0→w1), 두께 depth 를 z 로 */
function taperPlate(p0: V2, p1: V2, w0: number, w1: number, depth: number): THREE.BufferGeometry {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: V2[] = [
    [p0[0] + nx * w0, p0[1] + ny * w0],
    [p1[0] + nx * w1, p1[1] + ny * w1],
    [p1[0] - nx * w1, p1[1] - ny * w1],
    [p0[0] - nx * w0, p0[1] - ny * w0],
  ];
  // extrude() 가 이미 두께를 중심 정렬하므로 추가 이동 없음
  return extrude(shapeFrom(pts), depth, 0.005, 8);
}
/** 이름만 있는 핀 표식(검사 선언 joints·links 용) */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/**
 * 도는 한 몸(spin 그룹). group 원점 = 스핀들 축 y 0 — 모델은 (0, 0, K161.zc) 에 놓고
 * setPose161(g, gov161(theta)) 를 매 프레임 부른다. 자식 이름: `crown` `head` `armR` `armL`
 * `linkR` `linkL` `sleeve`, 핀 표식 `headPinR/L` `lugPinR/L` `sleevePinR/L`,
 * 링크 위 `linkTopR/L` · 아래 `linkBotR/L`, 조절 지레 끝 `leverTip`.
 * 스핀들 r 0.032 (y 0.66~2.60) + 아래 장식 구 — 아래 링(받침) 위로 0.04 가 뜬 채 물린다.
 */
export function spin161(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'spin';
  const steelM = steel();
  const dark = darkSteel();
  // 스핀들 + 아래 장식 구
  g.add(rod(new THREE.Vector3(0, 0.66, 0), new THREE.Vector3(0, 2.6, 0), 0.032));
  g.add(meshAt(new THREE.SphereGeometry(0.045, 20, 14), dark, 0, 0.615, 0));
  // 크라운 기어(이 뿌리 면 y 2.54, 로컬 Z → +Y, 이 0 = 로컬 +X)
  const crown = new THREE.Group();
  crown.name = 'crown';
  const cg = crownGear(K161.nc, K161.m, { width: 0.05, bore: 0.036 });
  cg.rotation.x = -Math.PI / 2;
  crown.add(cg);
  crown.position.y = K161.yPlate;
  g.add(crown);
  // 팔 받침 머리: 스핀더 안감 블록 + 좌우 판(클리비스 — 팔이 판 사이에서 흔들린다)
  const head = new THREE.Group();
  head.name = 'head';
  head.add(meshAt(new THREE.BoxGeometry(0.072, 0.15, 0.07), castIron(), 0, 2.315, 0));
  for (const s of [1, -1] as const) {
    head.add(meshAt(new THREE.BoxGeometry(0.059, 0.15, 0.024), castIron(), s * 0.0655, 2.315, s * 0.047));
    head.add(meshAt(cylZ(0.02, -0.075, 0.075), dark, s * K161.pinx, K161.hy, 0)); // 힌지 핀
    head.add(pinMark(s > 0 ? 'headPinR' : 'headPinL', s * K161.pinx, K161.hy, 0));
  }
  g.add(head);
  // 두 팔(공 달림) — 원점 = 힌지, 로컬 −Y 로 늘어짐
  for (const side of ['R', 'L'] as const) {
    const s = side === 'R' ? 1 : -1;
    const arm = new THREE.Group();
    arm.name = `arm${side}`;
    arm.position.set(s * K161.pinx, K161.hy, 0);
    arm.rotation.z = s * K161.aIn;
    arm.add(mesh(taperPlate([0, 0], [0, -K161.armL], 0.02, 0.015, 0.032), steelM));
    arm.add(meshAt(cylZ(0.02, -0.042, 0.042), dark, 0, -K161.lug, 0)); // 러그 핀
    arm.add(meshAt(new THREE.SphereGeometry(K161.rb, 24, 18), brass(), 0, -K161.armL, 0));
    arm.add(pinMark(`armRoot${side}`, 0, 0, 0));
    arm.add(pinMark(`lugPin${side}`, 0, -K161.lug, 0));
    g.add(arm);
  }
  // 링크(러그→슬리브 핀) — 원점 = 위 눈, 로컬 −Y 로 늘어짐
  for (const side of ['R', 'L'] as const) {
    const link = new THREE.Group();
    link.name = `link${side}`;
    link.add(meshAt(tubeZ(0.021, 0.04, -0.018, 0.018, 0.005, 32), steelM, 0, 0, 0));
    link.add(mesh(taperPlate([0, -0.012], [0, -K161.lk + 0.012], 0.016, 0.013, 0.026), steelM));
    link.add(meshAt(tubeZ(0.021, 0.04, -0.018, 0.018, 0.005, 32), steelM, 0, -K161.lk, 0));
    link.add(pinMark(`linkTop${side}`, 0, 0, 0));
    link.add(pinMark(`linkBot${side}`, 0, -K161.lk, 0));
    g.add(link);
  }
  // 슬라이드(슬리브) + 조절 지레 — spin 과 함께 돌고 y 로 오르내린다
  const sleeve = new THREE.Group();
  sleeve.name = 'sleeve';
  sleeve.position.y = 1.8;
  sleeve.add(mesh(tubeY(0.034, 0.075, -0.15, 0.02), dark));
  sleeve.add(mesh(cylY(0.058, 0.018, 0.05, 0.012, 16), dark)); // 위 둥근 뚜껑 — 5번째 인자는 segs(0.016 을 넘기면 라떼가 1열로 뭉개져 빈 메시)
  for (const s of [1, -1] as const) {
    sleeve.add(meshAt(cylZ(0.02, -0.052, 0.052), dark, s * K161.sp, 0, 0)); // 링크 아래 핀
    sleeve.add(pinMark(s > 0 ? 'sleevePinR' : 'sleevePinL', s * K161.sp, 0, 0));
  }
  sleeve.add(mesh(tubeY(0.034, 0.062, -0.185, -0.135), dark)); // 지레 허브
  sleeve.add(mesh(taperPlate([-0.05, -0.16], [-0.45, -0.16], 0.02, 0.012, 0.028), steelM));
  sleeve.add(pinMark('leverTip', -0.45, -0.16, 0));
  g.add(sleeve);
  return g;
}

/** 매 프레임 자세 대입 — spin161() 이 만든 그룹에 */
export function setPose161(spin: THREE.Object3D, p: Pose161): void {
  spin.rotation.y = p.psi;
  const armR = spin.getObjectByName('armR');
  if (armR) armR.rotation.z = p.alpha;
  const armL = spin.getObjectByName('armL');
  if (armL) armL.rotation.z = -p.alpha;
  const sleeve = spin.getObjectByName('sleeve');
  if (sleeve) sleeve.position.y = p.sy;
  const linkR = spin.getObjectByName('linkR');
  if (linkR) {
    linkR.position.set(p.lugR, p.lugY, 0);
    linkR.rotation.z = -p.linkAng;
  }
  const linkL = spin.getObjectByName('linkL');
  if (linkL) {
    linkL.position.set(-p.lugR, p.lugY, 0);
    linkL.rotation.z = p.linkAng;
  }
}

/**
 * 고정 받침 — 뒤판에서 나온 팔 넷(원점 = 모델 루트, 절대 좌표로 넣는다):
 *  아래 베어링 링 y 0.70 · 밸브 지레 collar y 1.35 · 중간 베어링 링 y 2.17 (모두 구멍 Y 방향,
 *  팔은 링 바깥면 z 0.213/0.200 에서 멈춘다) · 구동축 링 x 0.58 y 2.69 (구멍 X 방향).
 *  판화에 없음 — 떠 있는 부품이 없게 하는 최소 보충.
 */
export function bedFrame161(): THREE.Group {
  const g = new THREE.Group();
  const frame = castIron();
  const dark = darkSteel();
  // 아래 베어링 링 (스핀들 y 0.66 이 링 위 0.66−0.045 = 위면 위)
  g.add(meshAt(new THREE.BoxGeometry(0.09, 0.06, 0.516), frame, 0, 0.7, -0.045));
  g.add(meshAt(tubeY(0.036, 0.062, -0.045, 0.045), dark, 0, 0.7, K161.zc));
  // 밸브 지레 collar (지레의 고정 피벗) — 팔 앞면 0.165: 눈 뒷 rim(z 0.170) 뒤에서 멈춘다
  g.add(meshAt(new THREE.BoxGeometry(0.09, 0.05, 0.468), frame, 0, K161.leverY, -0.069));
  g.add(meshAt(tubeY(0.036, 0.075, -0.05, 0.05), dark, 0, K161.leverY, K161.zc));
  // 중간 베어링 링 (슬라이드 최고 2.007 과 머리 2.24 사이)
  g.add(meshAt(new THREE.BoxGeometry(0.09, 0.05, 0.516), frame, 0, 2.17, -0.045));
  g.add(meshAt(tubeY(0.036, 0.062, -0.045, 0.045), dark, 0, 2.17, K161.zc));
  // 구동축 베어링 링 (구멍 X 방향, 팔은 링 바깥면에서 멈춘다)
  g.add(meshAt(new THREE.BoxGeometry(0.07, 0.05, 0.516), frame, 0.58, K161.yp, -0.045));
  g.add(meshAt(tubeX(0.036, 0.062, -0.045, 0.045), dark, 0.58, K161.yp, K161.zc));
  setMM(g, { kind: 'frame' });
  return g;
}

/**
 * 밸브 지레(고정) — 원점 = collar 가운데 (0, K161.leverY, K161.zc). 눈(구멍 0.078)이 collar
 * 바깥면 0.075 를 감싸고(틈 0.003), 스핀들 r 0.032 은 구멍 속을 자유로 지나간다(틈 0.046).
 * 팔 −X 로 0.78, 바깥 절반에 긴 홈(포크 끝 — 조절 밸브 연결 봉 핀 자리, 연결 봉은 판화에도 없음).
 */
export function valveLever161(): THREE.Group {
  const g = new THREE.Group();
  const dark = darkSteel();
  // 눈(평 링) — rotateX 로 XZ 평면(두께 y ±0.015)에 세워 collar(0.075)를 감싼다. XY 눕히면 판이 스핀들 rod 에 0.032 박힘
  const eye = shapeFrom(circlePts(0.105, 40));
  eye.holes.push(pathFrom(circlePts(0.078, 32)));
  const eyeGeo = extrude(eye, 0.03, 0.005, 24);
  eyeGeo.rotateX(-Math.PI / 2);
  g.add(mesh(eyeGeo, dark));
  // 팔 + 포크 홈
  const armPts: V2[] = [
    [-0.095, 0.034], [-0.78, 0.02], [-0.78, -0.02], [-0.095, -0.034],
  ];
  const arm = shapeFrom(armPts);
  arm.holes.push(stadiumShape(-0.72, 0, -0.5, 0, 0.013));
  const armGeo = extrude(arm, 0.03, 0.005, 16);
  g.add(mesh(armGeo, dark));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [-0.78, 0, 0], fixed: true });
  return g;
}

/**
 * 구동축 + 피니언(구동). group 원점 = 축 가운데 — 모델은 (K161.rm, K161.yp, K161.zc) 에 놓고
 * 매 프레임 getObjectByName('pinion').rotation.x = p.phiP + K161.pin0 를 대입한다.
 * 피니언 spurGear(10, 0.024) 디스크 x 0.205~0.275 (크라운 이 띠 0.215~0.265 를 가로지름),
 * 축 로컬 x −0.08~0.54 (세계 0.16~0.78), x 0.50 에 축대(베어링 링 안에서 도는 자리 표시).
 */
export function drive161(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'drive';
  const pivot = new THREE.Group();
  pivot.name = 'pinion';
  const pin = spurGear(K161.np, K161.m, { width: 0.07, spokes: 0, driver: true });
  pin.rotation.y = Math.PI / 2; // 로컬 Z(기어 축) → 세계 +X, 이 0 → −Z(최하점 시작)
  pivot.add(pin);
  pivot.add(rod(new THREE.Vector3(-0.08, 0, 0), new THREE.Vector3(0.54, 0, 0), 0.023));
  const collar = tubeZ(0.024, 0.05, -0.02, 0.02);
  collar.rotateY(Math.PI / 2);
  pivot.add(meshAt(collar, darkSteel(), 0.5, 0, 0));
  g.add(pivot);
  return g;
}
