// 201 불규칙 기어와 진동 팔 — 축이 치우친 원형 기어가 피니언을 밀어 팔(벨 크랭크)이 흔들리고, 피니언 속도가 변한다.
// 피니언+작은 풀리는 팔 끝에 달리고, 평벨트가 큰 바퀴를 돌린다. 팔의 수평 끝 홈이 막대 A 의 핀을 물어 막대가 오르내린다. — 설계표 docs/mm507-sheets/201.md
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, leaderTo, openBeltPath, planar, pulley, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { wallBearing } from '../kit/gear6';
import { K201, bellArm201, fixedPinQ201, motion201 } from '../kit/k201';
import { castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';

const K = K201;
const PI = Math.PI;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const YEL = (): THREE.Material => paint(0xf2b619);
const cylZ = (r: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh => {
  const geo = lathe(rodProfile(r, 0, z1 - z0, 0.004, 0.004), 24);
  geo.rotateX(PI / 2);
  const m = mesh(geo, mat);
  m.position.z = z0;
  return m;
};
const cylY = (r: number, y0: number, y1: number, z: number, mat: THREE.Material): THREE.Mesh => {
  const m = mesh(lathe(rodProfile(r, 0, y1 - y0, 0.004, 0.004), 20), mat);
  m.position.set(0, y0, z);
  return m;
};
const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh => {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

export default function buildM201(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 불규칙 기어(편심 원형 기어): 그룹 = 축 O, 안의 기어 몸 중심은 로컬 (−0.1697, −0.1697)
  const cl = K.E * Math.cos(K.PHC);
  const cm = K.E * Math.sin(K.PHC);
  const irr = new THREE.Group();
  irr.name = 'irregularGear';
  irr.position.set(K.O[0], K.O[1], 0);
  const body = spurGear(K.Nz, K.m, { width: 0.08, spokes: 0, driver: true });
  body.position.set(cl, cm, 0.3);
  irr.add(body);
  irr.add(cylZ(0.06, 0.26, 0.34, darkSteel()));
  const gc = new THREE.Object3D();
  gc.name = 'gearCenter';
  gc.position.set(cl, cm, 0.3);
  irr.add(gc);
  // 노란 표지 막대: O → 기어 몸 중심 쪽, 길이 0.30
  const flag = box(0.3, 0.03, 0.008, 0, 0, 0.345, YEL());
  const flagG = new THREE.Group();
  flagG.rotation.z = K.PHC;
  flag.position.x = 0.15;
  flagG.add(flag);
  irr.add(flagG);
  g.add(irr);

  // 기어 축 + 손잡이
  const shaft = shaftZ(K.O[0], K.O[1], 0.4, 0.03);
  shaft.name = 'gearShaft';
  const crank = new THREE.Group();
  crank.name = 'crank';
  crank.add(box(0.2, 0.04, 0.03, 0.1, 0, 0.415, steel()));
  const handle = cylZ(0.03, 0.43, 0.53, paint(0xb8742a));
  handle.position.x = 0.2;
  crank.add(handle);
  shaft.add(crank);
  g.add(shaft);

  // 팔 + 고정 핀 Q
  g.add(fixedPinQ201());
  const arm = bellArm201();
  arm.name = 'arm';
  arm.position.set(K.Q[0], K.Q[1], 0);
  g.add(arm);

  // 벨트(팔과 같은 변환의 별도 그룹)
  const beltG = new THREE.Group();
  beltG.position.set(K.Q[0], K.Q[1], 0);
  const belt = new Belt(planar(openBeltPath([0, K.LA], K.RS, [0, 0], K.RB), 0.1), { style: 'flat', width: 0.06, thickness: 0.012, marks: 6 });
  belt.group.name = 'belt';
  beltG.add(belt.group);
  g.add(beltG);

  // 큰 바퀴
  const big = pulley(0.71, { width: 0.08, spokes: 6, flat: true });
  big.name = 'bigWheel';
  big.position.set(K.Q[0], K.Q[1], 0.1);
  big.add(box(0.5, 0.025, 0.01, 0.4, 0, 0.045, YEL()));
  g.add(big);

  // 피니언 + 작은 풀리 + 축(위치 P, 그룹은 돌지 않음)
  const pinG = new THREE.Group();
  g.add(pinG);
  const pinion = spurGear(K.Np, K.m, { width: 0.08, spokes: 0 });
  pinion.name = 'pinion';
  pinion.position.z = 0.3;
  pinion.add(box(0.12, 0.024, 0.008, 0.06, 0, 0.045, YEL()));
  pinG.add(pinion);
  const sp = pulley(0.22, { width: 0.08, spokes: 4, flat: true });
  sp.name = 'smallPulley';
  sp.position.z = 0.1;
  pinG.add(sp);
  pinG.add(cylZ(0.03, 0.05, 0.36, steel()));
  pinG.add(cylZ(0.045, 0.34, 0.37, darkSteel()));
  const arrP = rotArrow(0.25, true);
  arrP.position.z = 0.38;
  pinG.add(arrP);

  // 막대 A
  const rodA = new THREE.Group();
  rodA.name = 'rodA';
  const pinA = new THREE.Group();
  pinA.name = 'pinA';
  pinA.add(cylZ(0.025, 0.12, 0.225, steel()), cylZ(0.05, 0.225, 0.25, darkSteel()));
  rodA.add(pinA);
  rodA.add(box(0.09, 0.14, 0.08, 0, -0.05, 0.12, castIron()));
  rodA.add(box(0.09, 0.02, 0.004, 0, -0.05, 0.162, YEL()));
  rodA.add(cylY(0.025, -0.8, -0.12, 0.12, steel()));
  g.add(rodA);
  const gd1 = wallBearing(K.XA, 0.42, 0.12, 'y', 0.03);
  gd1.name = 'guideA1';
  const gd2 = wallBearing(K.XA, 0.62, 0.12, 'y', 0.03);
  gd2.name = 'guideA2';
  g.add(gd1, gd2);

  // 높이 눈금판
  const scale = new THREE.Group();
  scale.name = 'scaleA';
  scale.add(box(0.03, 0.4, 0.01, -0.745, 1.0, -0.29, wood()));
  for (let i = 0; i <= 8; i++) {
    const y = 0.8 + i * 0.05;
    scale.add(box(i === 4 ? 0.1 : 0.06, 0.008, 0.006, -0.745, y, -0.28, YEL()));
  }
  g.add(scale);

  // 화살표
  const arrG = rotArrow(0.45, false);
  arrG.position.set(K.O[0], K.O[1], 0.44);
  const arrB = rotArrow(0.5, true);
  arrB.position.set(K.Q[0], K.Q[1], 0.3);
  g.add(arrG, arrB);

  g.add(
    leaderTo(tag('불규칙 기어(구동)', v(-1.45, 3.05, 0.55)), 'irregularGear'),
    leaderTo(tag('피니언', v(0.75, 3.12, 0.55)), 'pinion'),
    leaderTo(tag('작은 풀리(피니언과 한 축)', v(1.55, 2.55, 0.55)), 'smallPulley'),
    leaderTo(tag('흔들 팔', v(1.55, 1.95, 0.55)), 'arm'),
    leaderTo(tag('평벨트', v(1.55, 1.35, 0.55)), 'belt'),
    leaderTo(tag('큰 바퀴', v(1.45, 0.4, 0.55)), 'bigWheel'),
    leaderTo(tag('막대 A', v(-1.55, 0.4, 0.55)), 'rodA')
  );

  let phi = 0;
  let prevY = motion201(0).yA;
  let rising = false;
  let ratio = 0;
  let cur = motion201(0);
  const apply = (): void => {
    phi = -K.W * t;
    const s = motion201(phi);
    irr.rotation.z = phi;
    shaft.rotation.z = phi;
    pinG.position.set(s.P[0], s.P[1], 0);
    pinion.rotation.z = s.psi;
    sp.rotation.z = s.psi;
    arm.rotation.z = s.alpha;
    beltG.rotation.z = s.alpha;
    belt.setOffset(s.beltOffset);
    big.rotation.z = s.Theta;
    rodA.position.set(K.XA, s.yA, 0);
    rising = s.yA > prevY + 1e-9 ? true : s.yA < prevY - 1e-9 ? false : rising;
    prevY = s.yA;
    const h = 1e-3;
    ratio = Math.abs((motion201(phi + h).psi - motion201(phi - h).psi) / (2 * h));
    cur = s;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '기어 각', value: `${Math.floor((((-phi * 180) / PI) % 360 + 360) % 360)}°` },
      { label: '피니언 속도 / 기어 속도 (0.66 ~ 3.36)', value: ratio.toFixed(2) },
      { label: '팔 각 (±8.5°)', value: `${((cur.alpha * 180) / PI).toFixed(1)}°` },
      { label: '막대 A 높이 (0.836 ~ 1.164)', value: `${cur.yA.toFixed(3)} · ${rising ? '오르는 중' : '내리는 중'}` },
      { label: '원리', value: '기어 축이 치우쳐 있어 피니언이 밀려나며 팔이 흔들리고, 피니언 속도가 한 바퀴 안에서 5배 넘게 변한다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed * ((OMEGA * 0.5) / K.W); // φ = −W·t, W = OMEGA·0.5
      apply();
    },
    view: { pos: [0.2, 1.8, 6.6], target: [0, 1.65, 0] }
  };
}
