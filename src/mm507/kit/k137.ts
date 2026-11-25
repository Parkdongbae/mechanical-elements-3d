// 137 전용 부품 — 팽창 편심(크랭크축에 고정된 편심 원판)과 갈라진 진동 팔·밸브 막대
// 공용 키트는 고치지 않는다. 모델은 '../kit/k137' 에서 직접 import.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';
import { circleIntersect } from './misc';

const D = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z축 원기둥(z0~z1) */
function cylZ(r: number, z0: number, z1: number, c = 0.005, segs = 40): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.005, segs = 48): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 변을 잘게 나눈다(침범 검사가 호 위의 점도 보도록) */
function fine(poly: V2[], per = 6): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k]!;
    const b = poly[(k + 1) % poly.length]!;
    for (let i = 0; i < per; i++) out.push([a[0] + ((b[0] - a[0]) * i) / per, a[1] + ((b[1] - a[1]) * i) / per]);
  }
  return out;
}

/**
 * 137번 치수. R = 편심 테 반지름, e = 편심량(축구멍이 테 중심에서 어긋난 거리),
 * rT·rB = 위·아래 굴른 반지름(위것이 테에 맞물리고 아래것은 0.008 안의 틈으로 붙어 미끄러진다),
 * (OX, OY) = 크랭크축, (PX, PY) = 팔의 오른쪽 눈 축(피벗). phi0 = t=1 의 편심각(판화 자세 −49°).
 * Ri·Ro = C띠 안·바깥 반지름, nibR = 끝 니브(굴른 핀을 감싼 패드), bossR·eyeBore = 피벗 눈 보스·구멍.
 */
export const K137 = {
  R: 0.34,
  e: 0.05,
  rT: 0.06,
  rB: 0.052,
  OX: -0.55,
  OY: 2.0,
  PX: 0.87,
  PY: 2.0,
  phi0: -0.855,
  Ri: 0.45,
  Ro: 0.63,
  nibR: 0.075,
  bossR: 0.13,
  armH: 0.115,
  eyeBore: 0.062,
  webT: 0.08,
  zWeb0: 0.06,
  hubTop: 0.22,
  zRoll0: 0.045, // 굴른이 편심 테 두께(z 0.065~0.145)를 다 덮도록 더 뒤에서 시작(길이 0.11) — 사용자 지적
  pinR: 0.02,
  pinTopZ1: 0.26,
  pinBotZ1: 0.31,
  zFork0: 0.155,
  forkT: 0.08,
  zRod0: 0.25,
  rodT: 0.05,
  rodLen: 0.66,
  rodR: 0.032,
  shaftR: 0.05,
  crankZ1: 0.3,
  pivotZ1: 0.28
} as const;

/** 끝 눈의 rest 거리(위·아래 같다): 테 접촉원(0.40)이 편심량을 포함해 지나가는 자리 */
export const Y_TIP137: number = Math.sqrt((K137.R + K137.rT) ** 2 - K137.e * K137.e);
/** 피벗에서 끝 눈까지의 팔 길이 */
export const ARM_A137: number = Math.hypot(K137.PX - K137.OX, Y_TIP137);
/** 팔의 rest 각(로컬 −X 축이 살짝 위로) */
export const PSI0_137: number = Math.atan2(Y_TIP137, K137.OX - K137.PX);

/** rock137 이 돌려주는 자세 */
export interface Rock137 {
  /** 편심각(rad) — eccentric.rotation.z */
  phi: number;
  /** 편심 테의 중심(세계) */
  E: V2;
  /** 팔 기울기(rad) — fork.rotation.z */
  psi: number;
  /** 위 끝(굴른 핀)의 세계 자리 */
  tipT: V2;
  /** 아래 끝(굴른 핀 = 밸브 막대 눈)의 세계 자리 */
  tipB: V2;
  /** 아래 굴른의 접촉 틈(0 이상 — 미끄럼 접촉) */
  gapB: number;
  /** 위 굴른의 굴름 간(rad) */
  spin: number;
}

/**
 * 137번 운동식(모두 theta 의 닫힌 식). 편심이 돈 각 phi 에서 위 굴른이 테에 접촉한 팔의 자리를 원 교점으로 푼다.
 * 아래 굴른은 팔과 함께 가며(강체) 0.0017~0.008 의 틈으로 테에 붙어 미끄러진다 — 두 접촉은 동시에 맞물릴 수 없다.
 */
export function rock137(theta: number): Rock137 {
  const phi = theta - 1.6 + K137.phi0;
  const E: V2 = [K137.OX + K137.e * Math.cos(phi), K137.OY + K137.e * Math.sin(phi)];
  const h1 = circleIntersect([K137.PX, K137.PY], ARM_A137, E, K137.R + K137.rT, false);
  const h2 = circleIntersect([K137.PX, K137.PY], ARM_A137, E, K137.R + K137.rT, true);
  const tipT: V2 = h2 !== null && (h1 === null || h2[1] > h1[1]) ? [h2[0], h2[1]] : h1 !== null ? [h1[0], h1[1]] : [K137.PX - (K137.PX - K137.OX), K137.PY + Y_TIP137];
  const psi = Math.atan2(tipT[1] - K137.PY, tipT[0] - K137.PX) - PSI0_137;
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  const tipB: V2 = [K137.PX - (K137.PX - K137.OX) * c + Y_TIP137 * s, K137.PY - (K137.PX - K137.OX) * s - Y_TIP137 * c];
  const gapB = Math.hypot(tipB[0] - E[0], tipB[1] - E[1]) - (K137.R + K137.rB);
  const spin = -(tipT[1] - (K137.OY + Y_TIP137)) / K137.rT;
  return { phi, E, psi, tipT, tipB, gapB, spin };
}

/**
 * 편심 원판(137번, 축에 고정 — 축과 함께 돈다): 테 반지름 R 의 원판 가운데에 축구멍이 e 어긋난 웹(테의 중심이 로컬 (e, 0))
 * + 축을 감싼 허브 관 + 키웨이 키(−70°) + 앞면 줄무늬(회전 표시). 원점 = 축, 회전축 = 로컬 Z. 청동.
 * userData.outline = 테의 원(중심 (e, 0)) — 굴른이 이 바깥에 접촉한다.
 */
export function eccentric137(): THREE.Group {
  const g = new THREE.Group();
  const web = shapeFrom(circlePts(K137.R, 96, K137.e, 0));
  web.holes.push(pathFrom([...circlePts(0.051, 48)].reverse()));
  g.add(meshAt(extrude(web, K137.webT, 0.005, 64), bronze({ roughness: 0.4 }), 0, 0, K137.zWeb0 + 0.005));
  g.add(mesh(tubeZ(0.052, 0.105, K137.zWeb0, K137.hubTop, 0.006), darkSteel()));
  const key = meshAt(new THREE.BoxGeometry(0.032, 0.028, 0.155), darkSteel(), 0.066 * Math.cos(-70 * D), 0.066 * Math.sin(-70 * D), K137.zWeb0 + 0.0775);
  key.rotation.z = -70 * D;
  g.add(key);
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.012, 0.005), paint(0xf2b619), K137.e + 0.2, 0, K137.zWeb0 + K137.webT + 0.0075));
  g.userData.outline = fine(circlePts(K137.R, 96, K137.e, 0), 3);
  setMM(g, { kind: 'cam', shape: 'eccentric', fn: 'eccentric137', r: K137.R, e: K137.e, axis: 'z' });
  return g;
}

/** 갈라진 진동 팔의 외곽 윤곽(피벗 로컬, 원점 = 오른쪽 눈 축, rest 자세 — 안쪽 호 위 끝→위 니브→C띠→피벗 보스→아래 니브→안쪽 호. 닫는 변이 굴른을 가르지 않게 위 니브를 중간에 놓는다) */
export function forkOutline137(): V2[] {
  const Ox = K137.OX - K137.PX;
  const yt = Y_TIP137;
  const pts: V2[] = [];
  const seg = (cx: number, cy: number, rr: number, a0: number, a1: number, n: number): void => {
    for (let i = 0; i <= n; i++) {
      const ang = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)]);
    }
  };
  pts.push([Ox + K137.Ri * Math.cos(83 * D), K137.Ri * Math.sin(83 * D)]); // 안쪽 호 위 끝 — 니브 오른쪽 끝과 이어짐
  seg(Ox, yt, K137.nibR, 10 * D, 170 * D, 12); // 위 니브(오른→왼, 굴른 바깥을 돌아 감 — 끝의 닫는 변이 굴른을 가르지 않게)
  pts.push([Ox + K137.Ro * Math.cos(97 * D), K137.Ro * Math.sin(97 * D)]); // 니브 왼쪽 끝 → 바깥 호 위 끝
  const aArm = Math.asin(K137.armH / K137.Ro);
  seg(Ox, 0, K137.Ro, 97 * D, aArm, 10); // C띠 바깥 호(위쪽 절반)
  const aBoss = Math.asin(K137.armH / K137.bossR);
  pts.push([K137.bossR * Math.cos(aBoss), K137.bossR * Math.sin(aBoss)]);
  seg(0, 0, K137.bossR, aBoss, -aBoss, 10); // 피벗 눈 보스
  pts.push([Ox + K137.Ro * Math.cos(aArm), -K137.armH]);
  seg(Ox, 0, K137.Ro, -aArm, -97 * D, 10); // C띠 바깥 호(아래쪽 절반)
  seg(Ox, -yt, K137.nibR, -170 * D, -10 * D, 12); // 아래 니브
  pts.push([Ox + K137.Ri * Math.cos(-83 * D), K137.Ri * Math.sin(-83 * D)]);
  seg(Ox, 0, K137.Ri, -83 * D, 83 * D, 20); // C띠 안쪽 호(테에서 0.06 떨어진 채 돌러싼다)
  pts.reverse(); // 반시계로
  return fine(pts, 3);
}

/**
 * 갈라진 진동 팔(137번): C띠(안 0.45/바깥 0.63) + 오른쪽 팔 + 피벗 눈(구멍 eyeBore) + 두 끝의 니브·굴른·핀.
 * **원점 = 피벗 눈 축**, rest 자세(로컬 −X 쪽이 축). 모델은 rotation.z = rock137(theta).psi 로 흔들린다. 주철.
 * 굴른은 표시 점이 있는 청동(위 0.06 — 테에 맞물림 / 아래 0.052 — 미끄럼), userData.outline 을 남긴다.
 * 표식 child: pinTop(위 끝, 굴른과 같은 z), pinBot(아래 끝, 밸브 막대 눈과 같은 z).
 */
export function forkArm137(): THREE.Group {
  const g = new THREE.Group();
  const Ox = K137.OX - K137.PX;
  const outline = forkOutline137();
  const shape = shapeFrom(outline);
  shape.holes.push(pathFrom([...circlePts(K137.eyeBore, 40)].reverse()));
  g.add(meshAt(extrude(shape, K137.forkT, 0.004, 48), castIron(), 0, 0, K137.zFork0 + 0.004));
  const makeRoller = (name: string, r: number, y: number): THREE.Mesh => {
    const roll = meshAt(cylZ(r, 0, 0.11, 0.004, 48), bronze({ roughness: 0.34 }), Ox, y, K137.zRoll0);
    roll.name = name;
    const dot = meshAt(new THREE.CylinderGeometry(0.012, 0.012, 0.005, 16), paint(0xf2b619), 0.028, 0, 0.1125);
    roll.add(dot);
    roll.userData.outline = circlePts(r, 64);
    setMM(roll, { kind: 'roller', r });
    return roll;
  };
  g.add(makeRoller('rollTop', K137.rT, Y_TIP137));
  g.add(makeRoller('rollBot', K137.rB, -Y_TIP137));
  g.add(meshAt(cylZ(K137.pinR, K137.zRoll0 - 0.01, K137.pinTopZ1, 0.003), steel(), Ox, Y_TIP137, 0));
  g.add(meshAt(cylZ(K137.pinR, K137.zRoll0 - 0.01, K137.pinBotZ1, 0.003), steel(), Ox, -Y_TIP137, 0));
  const pinTop = new THREE.Object3D();
  pinTop.name = 'pinTop';
  pinTop.position.set(Ox, Y_TIP137, K137.zRoll0);
  markPin(pinTop);
  const pinBot = new THREE.Object3D();
  pinBot.name = 'pinBot';
  pinBot.position.set(Ox, -Y_TIP137, K137.zRod0);
  markPin(pinBot);
  g.add(pinTop, pinBot);
  g.userData.outline = outline;
  setMM(g, { kind: 'fork', fn: 'forkArm137', ri: K137.Ri, ro: K137.Ro, armH: K137.armH, eye: K137.eyeBore });
  return g;
}

/**
 * 밸브 막대(137번): 위 눈(팔 아래 끝 핀에 걸쳐 세로로 미끄러진다) + 막대 + 황동 칼라 + 끝의 갈라진 텅(판화의 슬롯).
 * **원점 = 위 눈의 중심**, 로컬 −Y 로 내려간다(길이 rodLen). 모델은 position = rock137(theta).tipB, 회전 없음. 강.
 */
export function valveRod137(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(tubeZ(0.024, 0.052, 0, K137.rodT, 0.004), steel()));
  const L = K137.rodLen - 0.16;
  g.add(meshAt(new THREE.CylinderGeometry(K137.rodR, K137.rodR, L, 24), steel(), 0, -0.02 - L / 2, K137.rodT / 2));
  g.add(meshAt(new THREE.CylinderGeometry(0.05, 0.05, 0.028, 28), brass(), 0, -(K137.rodLen - 0.155), K137.rodT / 2));
  // 텅: 칼라 아랫면(rodLen − 0.141)까지 올려 막대와 이어지게(예전엔 0.04 떠 있었다 — 사용자 지적)
  for (const sx of [-1, 1]) g.add(meshAt(new THREE.BoxGeometry(0.012, 0.145, 0.036), steel(), sx * 0.021, -(K137.rodLen - 0.0725), K137.rodT / 2));
  const xpin = new THREE.CylinderGeometry(0.011, 0.011, 0.075, 16);
  xpin.rotateZ(Math.PI / 2);
  g.add(meshAt(xpin, darkSteel(), 0, -(K137.rodLen - 0.05), K137.rodT / 2));
  setMM(g, { kind: 'rod', fn: 'valveRod137', len: K137.rodLen, bore: 0.024 });
  return g;
}
