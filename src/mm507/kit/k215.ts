// 215번 멈추개 변형 2 전용 키트 — 홈 6개 별 바퀴, 큰 원판(핀) + 잠금 원판, 표시등, 상태 닫힌 식. 설계표 docs/mm507-sheets/215.md
// 계산 틀(B 중심 원점, A 가 (0, −1.30))을 −90° 돌려 세계에서는 A 가 왼쪽: A rotation.z = α − 90°, B rotation.z = β − 90°.
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, extrude, mesh, type V2 } from '../../models/parts/geom';
import { D2R, circleOutline, cylZ, lockOutline, shapeOf, tubeZ, zMesh } from './k212';

const TAU = Math.PI * 2;

const STAR: V2[] = [
  [-0.3146, -0.6769], [-0.2398, -0.6445], [-0.1617, -0.621], [-0.0814, -0.6068], [0.0, -0.602], [0.0814, -0.6068], [0.1617, -0.621], [0.2398, -0.6445], [0.3146, -0.6769],
  [0.2273, -0.5258], [0.2191, -0.5014], [0.2207, -0.4757], [0.2321, -0.4526], [0.2515, -0.4356], [0.2759, -0.4273], [0.3016, -0.429], [0.3247, -0.4404], [0.3417, -0.4598], [0.4289, -0.6109],
  [0.4382, -0.5299], [0.4569, -0.4505], [0.4848, -0.3739], [0.5213, -0.301], [0.5662, -0.2329], [0.6186, -0.1705], [0.678, -0.1146], [0.7435, -0.066],
  [0.569, -0.066], [0.5437, -0.061], [0.5223, -0.0467], [0.508, -0.0253], [0.503, 0.0], [0.508, 0.0253], [0.5223, 0.0467], [0.5437, 0.061], [0.569, 0.066], [0.7435, 0.066],
  [0.678, 0.1146], [0.6186, 0.1705], [0.5662, 0.2329], [0.5213, 0.301], [0.4848, 0.3739], [0.4569, 0.4505], [0.4382, 0.5299], [0.4289, 0.6109],
  [0.3417, 0.4598], [0.3247, 0.4404], [0.3016, 0.429], [0.2759, 0.4273], [0.2515, 0.4356], [0.2321, 0.4526], [0.2207, 0.4757], [0.2191, 0.5014], [0.2273, 0.5258], [0.3146, 0.6769],
  [0.2774, 0.693], [0.2393, 0.7071], [0.2005, 0.719], [0.1611, 0.7289], [0.1212, 0.7366], [0.081, 0.7421], [0.0406, 0.7454], [0.0, 0.7465],
  [-0.0406, 0.7454], [-0.081, 0.7421], [-0.1212, 0.7366], [-0.1611, 0.7289], [-0.2005, 0.719], [-0.2393, 0.7071], [-0.2774, 0.693], [-0.3146, 0.6769],
  [-0.2273, 0.5258], [-0.2191, 0.5014], [-0.2207, 0.4757], [-0.2321, 0.4526], [-0.2515, 0.4356], [-0.2759, 0.4273], [-0.3016, 0.429], [-0.3247, 0.4404], [-0.3417, 0.4598], [-0.4289, 0.6109],
  [-0.4382, 0.5299], [-0.4569, 0.4505], [-0.4848, 0.3739], [-0.5213, 0.301], [-0.5662, 0.2329], [-0.6186, 0.1705], [-0.678, 0.1146], [-0.7435, 0.066],
  [-0.569, 0.066], [-0.5437, 0.061], [-0.5223, 0.0467], [-0.508, 0.0253], [-0.503, 0.0], [-0.508, -0.0253], [-0.5223, -0.0467], [-0.5437, -0.061], [-0.569, -0.066], [-0.7435, -0.066],
  [-0.678, -0.1146], [-0.6186, -0.1705], [-0.5662, -0.2329], [-0.5213, -0.301], [-0.4848, -0.3739], [-0.4569, -0.4505], [-0.4382, -0.5299], [-0.4289, -0.6109],
  [-0.3417, -0.4598], [-0.3247, -0.4404], [-0.3016, -0.429], [-0.2759, -0.4273], [-0.2515, -0.4356], [-0.2321, -0.4526], [-0.2207, -0.4757], [-0.2191, -0.5014], [-0.2273, -0.5258]
];

export const K215 = {
  A: [-0.75, 1.75] as [number, number],
  B: [0.55, 1.75] as [number, number],
  d: 1.3,
  Re: 0.805,
  rf: 0.7249,
  pinR: 0.06,
  aw: 33.73,
  RD: 0.82, // 큰 원판
  RL: 0.69, // 잠금 원판
  cutD: 1.3,
  cutR: 0.77,
  RB: 0.7465,
  bore: 0.05,
  hubR: 0.11,
  star: STAR,
  alphaB: -272.22,
  alphaF: 1532.22,
  omega: 2.0,
  hold: 1.5,
  zDisc: [0.0, 0.04] as [number, number],
  zStar: [0.05, 0.11] as [number, number],
  zPin: [0.04, 0.14] as [number, number],
  zBlock: [0.04, 0.14] as [number, number]
} as const;
const K = K215;

const SWEEP = (K.alphaF - K.alphaB) / (K.omega / D2R);
export const T215 = 2 * (SWEEP + K.hold);

/** 별 바퀴: 원점 = B 축. name `starB`(윤곽 userData.outline), 안에 `stopFlank`·허브 */
export function star215(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'starB';
  const [z0, z1] = K.zStar;
  g.add(zMesh(extrude(shapeOf(K.star, K.hubR), z1 - z0, 0.005, 8), brass(), z0, z1));
  g.add(mesh(tubeZ(K.bore, K.hubR, 0.03, 0.13, 0.005, 40), darkSteel()));
  // 볼록 띠: 호 65.07°~114.93° 안쪽 폭 0.03(양끝은 홈 벽에서 조금 물림)
  const band = mesh(extrude(annularSector(K.RB - 0.03, K.RB - 0.002, 66 * D2R, 114 * D2R), 0.004, 0, 20), paint(0x8a1c1c));
  band.name = 'stopFlank';
  band.position.z = z1 + 0.002;
  g.add(band);
  g.userData.outline = K.star;
  return g;
}

/** 큰 원판 한 몸: 원점 = A 축. name `discA`, 안에 `lockA`(윤곽)·`pinA`(윤곽)·네모 축 덩이·`key` */
export function driver215(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'discA';
  const [d0, d1] = K.zDisc;
  const big = new THREE.Shape();
  big.absarc(0, 0, K.RD, 0, TAU, false);
  const bh = new THREE.Path();
  bh.absarc(0, 0, K.bore, 0, TAU, true);
  big.holes.push(bh);
  g.add(zMesh(extrude(big, d1 - d0, 0.004, 64), brass(), d0, d1));

  // 네모 축 덩이(구멍 = 축)
  const sq = new THREE.Shape();
  sq.moveTo(-0.07, -0.07);
  sq.lineTo(0.07, -0.07);
  sq.lineTo(0.07, 0.07);
  sq.lineTo(-0.07, 0.07);
  sq.closePath();
  const sh = new THREE.Path();
  sh.absarc(0, 0, K.bore, 0, TAU, true);
  sq.holes.push(sh);
  g.add(zMesh(extrude(sq, K.zBlock[1] - K.zBlock[0], 0.004, 8), darkSteel(), K.zBlock[0], K.zBlock[1]));

  // 잠금 원판(네모 구멍 0.14)
  const lock = lockOutline(K.RL, K.cutD, K.cutR);
  const ls = shapeOf(lock);
  const hole = new THREE.Path();
  hole.moveTo(-0.07, -0.07);
  hole.lineTo(-0.07, 0.07);
  hole.lineTo(0.07, 0.07);
  hole.lineTo(0.07, -0.07);
  hole.closePath();
  ls.holes.push(hole);
  const lockMesh = zMesh(extrude(ls, K.zStar[1] - K.zStar[0], 0.005, 24), steel(), K.zStar[0], K.zStar[1]);
  lockMesh.name = 'lockA';
  lockMesh.userData.outline = lock;
  g.add(lockMesh);

  // 핀
  const pin = new THREE.Group();
  pin.name = 'pinA';
  pin.position.set(K.rf, 0, 0);
  pin.add(mesh(cylZ(K.pinR, K.zPin[0], K.zPin[1], 0.004, 28), paint(0xc8352a))); // 핀만 빨강 — 별 바퀴(놋쇠)와 구분(2026-11-27 사용자 지적)
  pin.userData.outline = circleOutline(K.pinR, 28);
  g.add(pin);

  // 감기 손잡이: 팔 0.30(로컬 +Y, z 0.25~0.28) + 손잡이 반지름 0.035(z 0.28~0.38)
  const key = new THREE.Group();
  key.name = 'key';
  const arm = new THREE.Shape();
  arm.absarc(0, 0, 0.05, Math.PI, TAU, false);
  arm.absarc(0, 0.3, 0.04, 0, Math.PI, false);
  arm.closePath();
  key.add(zMesh(extrude(arm, 0.06, 0.004, 16), darkSteel(), 0.22, 0.28));
  const knob = mesh(cylZ(0.035, 0.28, 0.38, 0.008, 24), paint(0xb3541e));
  knob.position.y = 0.3;
  key.add(knob);
  g.add(key);
  return g;
}

export type Phase215 = 'wind' | 'stopF' | 'unwind' | 'stopB';

export function state215(t: number): { alpha: number; beta: number; turns: number; phase: Phase215; stopped: boolean } {
  const w = K.omega / D2R;
  const u = ((t % T215) + T215) % T215;
  let alpha: number;
  let phase: Phase215;
  if (u < SWEEP) {
    alpha = K.alphaB + w * u;
    phase = 'wind';
  } else if (u < SWEEP + K.hold) {
    alpha = K.alphaF;
    phase = 'stopF';
  } else if (u < 2 * SWEEP + K.hold) {
    alpha = K.alphaF - w * (u - SWEEP - K.hold);
    phase = 'unwind';
  } else {
    alpha = K.alphaB;
    phase = 'stopB';
  }
  const j = Math.floor((alpha - 90 + 180) / 360);
  const ac = 90 + 360 * j;
  const base = 120 - 60 * j;
  let beta: number;
  if (alpha < ac - K.aw) beta = base;
  else if (alpha > ac + K.aw) beta = base - 60;
  else {
    const x = K.rf * Math.cos(alpha * D2R);
    const y = -K.d + K.rf * Math.sin(alpha * D2R);
    beta = base + Math.atan2(y, x) / D2R + 60;
  }
  return { alpha, beta, turns: (alpha - K.alphaB) / 360, phase, stopped: phase === 'stopF' || phase === 'stopB' };
}
