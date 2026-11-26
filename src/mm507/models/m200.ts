// 200 한 바퀴로 두 속도 — 세로축에 크기가 다른 베벨 둘(위 24·아래 14 잇수)이 마주 보고 헐겁게 끼워져 있고,
// 오른쪽 아래로 비스듬한 축의 구동 베벨 피니언이 두 베벨에 동시에 물린다(판화 200번 그대로).
// 두 베벨 사이 클러치 슬리브가 위 또는 아래 베벨에 붙어 세로축을 느리게(14/24) 또는 빠르게(14/14) 돌린다 — 설계표 docs/mm507-sheets/200.md
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { wallBearing } from '../kit/gear6';
import {
  A200,
  B200,
  FR_L,
  FR_P,
  FR_U,
  GL200,
  GU200,
  K200,
  PERIOD200,
  bevel200,
  clutch200,
  fork200,
  forkGuide200,
  state200,
  type Frame200
} from '../kit/k200';
import { darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K200;
const PI = Math.PI;

const wrapAt = (fr: Frame200): THREE.Group => {
  const w = new THREE.Group();
  w.position.copy(fr.pos);
  w.quaternion.copy(fr.quat);
  return w;
};

export default function buildM200(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 세로축(종동, +Y 둘레): 클러치 슬리브는 축에 키로 끼워 함께 돈다
  const axis = new THREE.Group();
  axis.name = 'axisY';
  axis.position.set(K.XC, 0, K.ZC);
  g.add(axis);
  const shaft = mesh(lathe(rodProfile(K.shaftR, 0.8, 2.72, 0.006, 0.006), 28), steel());
  axis.add(shaft);
  // 노란 표지 막대: 위 끝 · 아래 끝(같은 쪽을 가리킨다) — 세로축이 어느 속도로 도는지 위아래에서 다 보인다
  for (const fy of [2.62, 0.86]) {
    const flag = mesh(new THREE.BoxGeometry(0.14, 0.024, 0.024), paint(0xf2b619));
    flag.position.set(0.09, fy, 0);
    axis.add(flag);
  }
  g.add(wallBearing(K.XC, 2.4, K.ZC, 'y', 0.046), wallBearing(K.XC, 1.05, K.ZC, 'y', 0.046));

  // 위 큰 베벨(이가 아래로, 꼭짓점 P 를 본다) · 아래 작은 베벨(이가 위로) — 헐거움
  const wU = wrapAt(FR_U);
  const bevU = bevel200(K.Nu, K.m, GU200, { face: K.face, bore: 0.05, marker: 'web' });
  bevU.name = 'bevelU';
  wU.add(bevU);
  const wL = wrapAt(FR_L);
  const bevL = bevel200(K.Nl, K.m, GL200, { face: K.face, bore: 0.05, marker: 'rim' });
  bevL.name = 'bevelL';
  wL.add(bevL);
  g.add(wU, wL);

  // 클러치 슬리브 + 포크(위아래) + 안내
  const clutch = clutch200();
  clutch.name = 'clutch';
  g.add(clutch);
  const fork = fork200();
  fork.name = 'fork';
  g.add(fork);
  g.add(forkGuide200());

  // 구동 베벨 피니언(오른쪽 아래로 기운 축) + 축 + 받침 + 손잡이(구동 바퀴)
  const wP = wrapAt(FR_P);
  const pin = new THREE.Group();
  pin.name = 'pinion';
  wP.add(pin);
  pin.add(bevel200(K.Np, K.m, B200, { face: K.face, bore: 0.03, hubR: 0.055, driver: true }));
  const pShaft = mesh(lathe(rodProfile(0.026, -0.05, 1.19, 0.004, 0.004), 20), steel());
  pShaft.rotation.x = -PI / 2; // 로컬 +Y → −Z(피니언 뒤쪽, 오른쪽 아래)
  pin.add(pShaft);
  const hw = new THREE.Group(); // 손잡이 바퀴: 피니언 로컬 z = −1.15
  hw.position.z = -1.12;
  const disc = mesh(lathe(rodProfile(0.13, -0.02, 0.02, 0.006, 0.006), 36), darkSteel());
  disc.rotation.x = PI / 2;
  hw.add(disc);
  const handle = mesh(lathe(rodProfile(0.022, 0, 0.14, 0.004, 0.006), 16), paint(0xb8742a));
  handle.rotation.x = -PI / 2;
  handle.position.set(0.1, 0, -0.02);
  hw.add(handle);
  pin.add(hw);
  g.add(wP);
  const bPos = FR_P.pos.clone().addScaledVector(A200, 0.7);
  g.add(wallBearing(bPos.x, bPos.y, K.ZC, A200, 0.034));

  // 세로축 방향 화살표 둘(위에서 본 모양, 그때그때 하나만 보임)
  const arrCcw = rotArrow(0.24, true);
  const arrCw = rotArrow(0.24, false);
  for (const a of [arrCcw, arrCw]) {
    a.rotation.x = -PI / 2;
    a.position.set(K.XC, 2.75, K.ZC);
    g.add(a);
  }

  g.add(
    leaderTo(tag('큰 베벨(위, 24)', v(-1.6, 2.35, 0.35)), 'bevelU'),
    leaderTo(tag('작은 베벨(아래, 14)', v(-1.6, 1.2, 0.35)), 'bevelL'),
    leaderTo(tag('구동 베벨 피니언(14)', v(0.9, 2.3, 0.35)), 'pinion'),
    leaderTo(tag('클러치(위·아래 바꿈)', v(-1.6, 1.75, 0.35)), 'clutch')
  );

  let st = state200(0);
  const apply = (): void => {
    st = state200(theta);
    axis.rotation.y = st.psi;
    bevU.rotation.z = st.phiU;
    bevL.rotation.z = st.phiL;
    pin.rotation.z = theta;
    clutch.position.set(K.XC, st.yc, K.ZC);
    clutch.rotation.y = st.psi;
    fork.position.set(K.XC, st.yc, K.ZC);
    arrCcw.visible = st.dir > 0;
    arrCw.visible = st.dir < 0;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '클러치', value: st.mode === 'U' ? '큰 베벨(위, 24)에 붙음 — 느리게' : st.mode === 'L' ? '작은 베벨(아래, 14)에 붙음 — 빠르게' : '옮기는 중(세로축 멈춤)' },
      { label: '속도비 (세로축 : 피니언)', value: st.mode === 'U' ? '14 : 24 = 0.58' : st.mode === 'L' ? '14 : 14 = 1.00' : '—' },
      { label: '한 주기', value: `피니언 ${(PERIOD200 / (2 * PI)).toFixed(1)} 회전` },
      { label: '원리', value: '피니언이 위·아래 베벨을 늘 함께 돌리고(서로 반대 방향), 클러치가 붙은 쪽의 속도가 세로축에 전해진다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 2.2, 6.3], target: [0, 1.7, 0] }
  };
}
