// 209 타원 구름 접촉 — 초점에 축이 있는 같은 타원 두 개가 닿은 채 구른다. 반쪽에만 이가 있어, 접점 반지름이 커지는 반 바퀴는
// 매끈한 면으로 밀고 줄어드는 반 바퀴는 이로 물린다. 갈래 걸쇠가 첫 이(안내 핀)를 받아 이끈다 — 설계표 docs/mm507-sheets/209.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K209, ellipseGear209, fork209, guidePin209, state209 } from '../kit/k209';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { castIron, paint } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K209;

export default function buildM209(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 왼쪽(구동): 축 O1 에서 도는 틀 = 기어 + 안내 핀
  const spinL = new THREE.Group();
  spinL.position.set(K.O1[0], K.O1[1], 0);
  const gearL = ellipseGear209('L');
  gearL.name = 'gearL';
  gearL.position.z = K.zG;
  const pinL = guidePin209();
  pinL.name = 'pinL';
  spinL.add(gearL, pinL);
  // 오른쪽(피동): 기어 + 걸쇠(받침 기둥으로 한 몸)
  const spinR = new THREE.Group();
  spinR.position.set(K.O2[0], K.O2[1], 0);
  const gearR = ellipseGear209('R');
  gearR.name = 'gearR';
  gearR.position.z = K.zG;
  const forkR = fork209();
  spinR.add(gearR, forkR);
  g.add(spinL, spinR);

  // 축 두 개(왼쪽은 손잡이가 달려 구동과 함께 돈다)
  const shL = shaftZ(K.O1[0], K.O1[1], 0.27, 0.045);
  const shR = shaftZ(K.O2[0], K.O2[1], 0.27, 0.045);
  const crank = new THREE.Group();
  crank.name = 'crank';
  const hubGeo = lathe(rodProfile(0.06, 0, 0.04, 0.005, 0.005), 24);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, castIron());
  hub.position.z = 0.27;
  const arm = mesh(new THREE.BoxGeometry(0.25 + 0.06, 0.04, 0.03), castIron());
  arm.position.set(0.125, 0, 0.295);
  const hGeo = lathe(rodProfile(0.035, 0, 0.1, 0.005, 0.008), 20);
  hGeo.rotateX(Math.PI / 2);
  const handle = mesh(hGeo, paint(0xb8742a));
  handle.position.set(0.25, 0, 0.31);
  crank.add(hub, arm, handle);
  shL.add(crank);
  g.add(shL, shR);

  // 접점 표시(빨강 원판)
  const cGeo = lathe(rodProfile(0.03, 0, 0.01, 0.002, 0.002), 24);
  cGeo.rotateX(Math.PI / 2);
  const contact = mesh(cGeo, paint(0xd62828));
  contact.name = 'contact';
  g.add(contact);

  const a1 = rotArrow(0.3, false); // 왼쪽 시계
  a1.position.set(K.O1[0], K.O1[1], 0.44);
  const a2 = rotArrow(0.3, true); // 오른쪽 반시계
  a2.position.set(K.O2[0], K.O2[1], 0.3);
  g.add(a1, a2);

  g.add(
    leaderTo(tag('구동 타원 기어', v(-1.75, 3.1, 0.55)), 'gearL'),
    leaderTo(tag('피동 타원 기어', v(1.75, 3.1, 0.55)), 'gearR'),
    leaderTo(tag('갈래 걸쇠', v(0.55, 3.15, 0.55)), 'forkR'),
    leaderTo(tag('안내 핀(먼 끝 이)', v(-0.45, 3.15, 0.55)), 'pinL'),
    leaderTo(tag('매끈한 구름면', v(-1.6, 0.35, 0.55)), 'gearL'),
    leaderTo(tag('접점', v(0.0, 0.35, 0.55)), 'contact')
  );

  let st = state209(0);
  const apply = (): void => {
    st = state209(t);
    spinL.rotation.z = st.th1;
    shL.rotation.z = st.th1;
    spinR.rotation.z = st.th2;
    shR.rotation.z = st.th2;
    contact.position.set(K.O1[0] + st.r1, K.O1[1], 0.175);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '지금 구간', value: st.toothed ? '이 물림(접점 반지름이 줄어드는 반 바퀴)' : '매끈한 면이 밀며 구름(접점 반지름이 커지는 반 바퀴)' },
      { label: '속도비 ω₂/ω₁', value: `${st.ratio.toFixed(2)} (범위 0.25 ~ 4.0)` },
      { label: '접점 거리 r₁ : r₂', value: `${st.r1.toFixed(2)} : ${(2 * K.A - st.r1).toFixed(2)}` },
      { label: '왼쪽 기어 바퀴 수', value: `${(Math.abs(st.th1 - K.TH0) / (2 * Math.PI)).toFixed(2)} 바퀴` },
      { label: '원리', value: '접점 반지름이 커지는 반 바퀴는 매끈한 면으로 밀고, 줄어드는 반 바퀴는 이로 물린다. 걸쇠가 첫 이를 이끈다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [0, 1.85, 6.3], target: [0, 1.8, 0] }
  };
}
