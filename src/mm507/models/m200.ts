// 200 한 바퀴로 두 속도 — 세로축에 크기가 다른 이판(크라운) 둘이 마주 보고 있고(위 24·아래 16 잇수),
// 구동 평기어가 비스듬히 미끄러져 위 이판 또는 아래 이판에 물려 세로축을 두 가지 속도로 돌린다 (판화 200번)
// 판화의 베벨 원뿔 둘 대신 이 면 기어(크라운)와 평기어로 풀었다 — 설계표 docs/mm507-sheets/200.md
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { crownGear, displayStand, leaderTo, rotArrow, spurGear, tag } from '../kit';
import { EPS200, K200, PERIOD200, RM_L, RM_U, Y_L, Y_U, YPL, slotPlate200, state200, wallRing200 } from '../kit/k200';
import { darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K200;
const PI = Math.PI;

export default function buildM200(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 세로축 + 이판 둘 (피벗이 +Y 둘레로 돈다)
  const axis = new THREE.Group();
  axis.name = 'axisY';
  axis.position.set(K.XC, 0, K.ZC);
  g.add(axis);
  const shaftGeo = lathe(rodProfile(0.038, 0, 2.1, 0.006, 0.006), 28);
  const shaft = mesh(shaftGeo, steel());
  shaft.position.y = 0.85;
  axis.add(shaft);
  const flag = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), paint(0xf2b619));
  flag.position.set(0.07, 2.78, 0);
  axis.add(flag);

  // 위 이판: 이가 아래(로컬 +Z → −Y)
  const upWrap = new THREE.Group();
  upWrap.name = 'crownU';
  upWrap.position.y = K.yPu + 1.25 * K.m;
  upWrap.rotation.x = PI / 2;
  upWrap.add(crownGear(K.Nu, K.m, { width: 0.12, bore: 0.045 }));
  axis.add(upWrap);
  // 아래 이판: 이가 위(로컬 +Z → +Y), 위 이판에 대해 EPS 만큼 돌려 놓는다
  const loWrap = new THREE.Group();
  loWrap.name = 'crownL';
  loWrap.position.y = YPL - 1.25 * K.m;
  loWrap.rotation.x = -PI / 2;
  const loMesh = crownGear(K.Nl, K.m, { width: 0.12, bore: 0.045, driver: true });
  loMesh.rotation.z = EPS200;
  loWrap.add(loMesh);
  axis.add(loWrap);

  g.add(wallRing200(K.XC, 2.55), wallRing200(K.XC, 1.1));
  g.add(slotPlate200());

  // 평기어 수레: 비스듬히 미끄러진다
  const car = new THREE.Group();
  car.name = 'carriage';
  g.add(car);
  const pin = new THREE.Group();
  pin.name = 'pinion';
  car.add(pin);
  const pg = spurGear(K.Np, K.m, { width: 0.1, spokes: 4, driver: true });
  pg.rotation.y = PI / 2; // 로컬 Z → +X
  pin.add(pg);
  const sh = mesh(lathe(rodProfile(0.022, -0.12, 1.5, 0.004, 0.004), 20), steel());
  sh.rotation.z = -PI / 2; // +Y → +X
  pin.add(sh);
  const knob = mesh(lathe(rodProfile(0.1, 0, 0.04, 0.006, 0.006), 28), darkSteel());
  knob.rotation.z = -PI / 2;
  knob.position.x = 1.42;
  pin.add(knob);
  const knobMark = mesh(new THREE.BoxGeometry(0.02, 0.07, 0.014), paint(0xf2b619));
  knobMark.position.set(1.46, 0.0, 0.0);
  knobMark.position.y = 0.06;
  pin.add(knobMark);

  // 세로축 방향 화살표 둘(위에서 본 모양, 그때그때 하나만 보임)
  const arrCcw = rotArrow(0.24, true);
  const arrCw = rotArrow(0.24, false);
  for (const a of [arrCcw, arrCw]) {
    a.rotation.x = -PI / 2;
    a.position.set(K.XC, 2.55 + 0.22, K.ZC);
    g.add(a);
  }

  const tCar = leaderTo(tag('평기어(구동·미끄러짐)', v(1.0, 1.15, 0.35)), 'pinion');
  g.add(
    leaderTo(tag('큰 이판(위, 24)', v(-1.55, 2.5, 0.35)), 'crownU'),
    leaderTo(tag('작은 이판(아래, 16)', v(-1.55, 1.15, 0.35)), 'crownL'),
    tCar,
    leaderTo(tag('미끄럼 안내(고정)', v(1.7, 2.45, 0.35)), 'axisY')
  );

  let st = state200(0);
  const apply = (): void => {
    st = state200(theta);
    axis.rotation.y = st.psi;
    car.position.set(st.x, st.y, K.ZC);
    pin.rotation.x = theta;
    arrCcw.visible = st.dir > 0;
    arrCw.visible = st.dir < 0;
    tCar.position.set(st.x + 1.0, st.y - 0.6, 0.35);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '물린 이판', value: st.mode === 'U' ? '큰 이판(위, 24잇수)' : st.mode === 'L' ? '작은 이판(아래, 16잇수)' : '옮겨 가는 중(어느 쪽에도 안 물림)' },
      { label: '속도비 (이판 : 평기어)', value: st.mode === 'U' ? '10 : 24 = 0.42' : st.mode === 'L' ? '10 : 16 = 0.63' : '—' },
      { label: '한 주기', value: `평기어 ${(PERIOD200 / (2 * PI)).toFixed(1)} 회전` },
      { label: '원리', value: '한 평기어가 큰 이판에 물리면 느리게, 작은 이판에 물리면 빠르게 세로축을 돌린다(방향은 서로 반대)' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 2.3, 6.3], target: [0, 1.7, 0] }
  };
}
void RM_L;
void RM_U;
void Y_L;
void Y_U;
