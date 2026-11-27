// 226 속도를 두 배로 하는 기어 — 지름·잇수가 같은 베벨 여섯. B 가 F 기어와 C 뒤 기어를 함께 돌리고(C 와 F 는 반대),
// F 에 고정된 틀 A 가 D 를 데려가며, D 는 E 와 C 앞 기어 사이에 물린다. 판화 배치대로면 E 는 F 의 3배(원문은 2배) — 설계표 docs/mm507-sheets/226.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { bevelGear, displayStand, leaderTo, rotArrow, setMM, tag } from '../kit';
import { K226, flag226, frame226, handwheel226 } from '../kit/k226';
import { pedestalX, wallBearing } from '../kit/gear6';
import { paint, steel } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const PI = Math.PI;
const K = K226;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const cylX = (r: number, len: number): THREE.Mesh => mesh(new THREE.CylinderGeometry(r, r, len, 28).rotateZ(PI / 2), steel());
const bev = (bore: number, ry: number, driver = false): THREE.Group => {
  const b = bevelGear(K.TEETH, K.MOD, { width: 0.08, spokes: 0, bore, driver });
  b.rotation.y = ry;
  return b;
};

export default function buildM226(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // B 묶음(세로 입력)
  const gearB = new THREE.Group();
  gearB.name = 'gearB';
  gearB.position.set(K.O1[0], 1.55, K.ZF);
  setMM(gearB, { axis: 'y' });
  const bevB = bevelGear(K.TEETH, K.MOD, { width: 0.08, bore: 0.035, driver: true });
  bevB.rotation.x = PI / 2;
  gearB.add(bevB, handwheel226());
  g.add(gearB, wallBearing(K.O1[0], 1.95, K.ZF, 'y', 0.045));

  // F 묶음(가로 축 + F 기어 + 원판·깃 + 틀 A)
  const shaftF = new THREE.Group();
  shaftF.name = 'shaftF';
  shaftF.position.set(0, K.YF, K.ZF);
  setMM(shaftF, { axis: 'x' });
  const fAxle = cylX(0.035, 3.8);
  fAxle.position.x = -0.05;
  shaftF.add(fAxle);
  const gearF = new THREE.Group();
  gearF.name = 'gearF';
  gearF.position.x = 1.05;
  gearF.rotation.x = -PI / 2;
  gearF.add(bev(0.035, -PI / 2));
  shaftF.add(gearF);
  const fDisc = cylX(0.18, 0.04);
  fDisc.position.x = 1.55;
  const fFlag = flag226(0.24, 0xf2b619);
  fFlag.position.set(1.55, 0.27, 0);
  const fFlagL = mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), paint(0xf2b619));
  fFlagL.position.set(-1.8, 0.1, 0);
  shaftF.add(fDisc, fFlag, fFlagL);

  const frameA = new THREE.Group();
  frameA.name = 'frameA';
  frameA.position.x = K.O2[0];
  frameA.rotation.x = PI / 2;
  frameA.add(frame226());
  const gearD = new THREE.Group();
  gearD.name = 'gearD';
  gearD.position.y = K.R;
  const bevD = bevelGear(K.TEETH, K.MOD, { width: 0.08, bore: 0.03 });
  bevD.rotation.x = PI / 2;
  gearD.add(bevD);
  const dStripe = mesh(new THREE.BoxGeometry(0.12, 0.004, 0.02), paint(0xd8362f));
  dStripe.position.set(0.14, 0.058, 0);
  gearD.add(dStripe);
  frameA.add(gearD);
  shaftF.add(frameA);
  g.add(shaftF);

  // C 묶음(속 빈 축 + 앞·뒤 기어)
  const sleeveC = new THREE.Group();
  sleeveC.name = 'sleeveC';
  sleeveC.position.set(0, K.YF, K.ZF);
  setMM(sleeveC, { axis: 'x' });
  const cTube = cylX(0.05, 0.89);
  cTube.position.x = -0.025;
  sleeveC.add(cTube);
  const gearC1 = new THREE.Group();
  gearC1.name = 'gearC1';
  gearC1.position.x = -0.5;
  gearC1.add(bev(0.05, -PI / 2));
  const gearC2 = new THREE.Group();
  gearC2.name = 'gearC2';
  gearC2.position.x = 0.45;
  gearC2.rotation.x = PI / 2;
  gearC2.add(bev(0.05, PI / 2));
  sleeveC.add(gearC1, gearC2);
  g.add(sleeveC);

  // E 묶음(출력)
  const outputE = new THREE.Group();
  outputE.name = 'outputE';
  outputE.position.set(0, K.YF, K.ZF);
  setMM(outputE, { axis: 'x' });
  const eGear = bev(0.05, PI / 2);
  eGear.position.x = -1.1;
  const eTube = cylX(0.05, 0.52);
  eTube.position.x = -1.4;
  const eDisc = cylX(0.16, 0.04);
  eDisc.position.x = -1.62;
  const eFlag = flag226(0.25, 0xd8362f);
  eFlag.position.set(-1.62, 0.175, 0);
  outputE.add(eGear, eTube, eDisc, eFlag);
  g.add(outputE);

  // 받침 기둥
  g.add(pedestalX(-1.95, K.YF, K.ZF, -1, 0.18, 0.04), pedestalX(-0.05, K.YF, K.ZF, 1, 0.18, 0.058), pedestalX(1.85, K.YF, K.ZF, 1, 0.18, 0.04));

  const arrow = rotArrow(0.3, true);
  arrow.rotation.x = -PI / 2;
  arrow.position.set(K.O1[0], 2.4, K.ZF);
  g.add(arrow);

  g.add(
    leaderTo(tag('A 틀', v(-0.55, 2.5, 0.5)), 'frameA'),
    leaderTo(tag('B 입력', v(1.75, 2.8, 0.5)), 'gearB'),
    leaderTo(tag('C 속 빈 축', v(0.6, 0.38, 0.5)), 'sleeveC'),
    leaderTo(tag('D 유성 베벨', v(-1.7, 0.35, 0.5)), 'gearD'),
    leaderTo(tag('E 출력(3배)', v(-2.0, 1.85, 0.5)), 'outputE'),
    leaderTo(tag('F 축', v(1.95, 0.75, 0.5)), 'shaftF')
  );

  let beta = 0;
  const apply = (): void => {
    beta = K.OMEGA * t;
    gearB.rotation.y = beta + PI - PI / 20;
    shaftF.rotation.x = -beta;
    sleeveC.rotation.x = beta;
    outputE.rotation.x = -3 * beta + PI;
    gearD.rotation.y = -2 * beta + PI - PI / 20;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: 'B(입력) 바퀴 수', value: (beta / (2 * PI)).toFixed(2) },
      { label: 'E(출력) 바퀴 수', value: `${((3 * beta) / (2 * PI)).toFixed(2)} — 입력의 3배` },
      { label: '원문과 다른 점', value: '원문은 2배라 했으나, C 가 F 와 반대로 돌아 D 가 제자리에서 2 바퀴 → E 는 3배' },
      { label: '원리', value: 'E = 틀 A 한 바퀴 + D 자전으로 더해지는 바퀴' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [2.6, 2.9, 5.6], target: [-0.1, 1.3, 0.2] }
  };
}
