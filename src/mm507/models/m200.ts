// 200 한 바퀴로 두 속도 — 세로축 자리에 속 빈 슬리브(위 큰 베벨 24잇수)와 그 속을 지나는 안쪽 축(아래 작은 베벨 14잇수)이 있고,
// 오른쪽 아래로 비스듬한 축의 구동 베벨 하나가 두 베벨에 늘 동시에 물려 슬리브는 느리게, 안쪽 축은 빠르게 서로 반대로 돌린다(판화 200번 그대로).
// 클러치 없음 — 설계표 docs/mm507-sheets/200.md
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
  bevel200,
  state200,
  type Frame200
} from '../kit/k200';
import { aluminum, darkSteel, paint, steel } from '../../models/materials';
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

  // 안쪽 축(+Y 둘레): 아래 작은 베벨에 고정. 아래쪽은 굵게(베벨 구멍을 채움), 슬리브 안은 가늘게 올라가 슬리브 위로 나온다
  const SR = 0.0505; // 베벨 구멍(0.05)을 채우는 굵기
  const SI = 0.03; // 슬리브 안을 지나는 굵기
  const Y_SB = 0.8; // 안쪽 축 아래 끝
  const Y_ST = 2.5; // 안쪽 축 위 끝
  const Y_SL0 = 1.757; // 슬리브 아래 끝 = 위 베벨 앞 허브 끝
  const Y_SL1 = 2.3; // 슬리브 위 끝
  const innerShaft = new THREE.Group();
  innerShaft.name = 'innerShaft';
  innerShaft.position.set(K.XC, 0, K.ZC);
  g.add(innerShaft);
  innerShaft.add(
    mesh(
      lathe(
        [
          [0, Y_SB],
          [SR - 0.004, Y_SB],
          [SR, Y_SB + 0.004],
          [SR, Y_SL0 + 0.001],
          [SI, Y_SL0 + 0.001],
          [SI, Y_ST - 0.004],
          [SI - 0.004, Y_ST],
          [0, Y_ST]
        ],
        32
      ),
      steel()
    )
  );
  // 안쪽 축 아래 끝 노란 표지(축에 박힌 막대)
  const flagL = mesh(new THREE.BoxGeometry(0.14, 0.024, 0.024), paint(0xf2b619));
  flagL.position.set(0.09, Y_SB + 0.06, 0);
  innerShaft.add(flagL);

  // 속 빈 슬리브(+Y 둘레): 위 큰 베벨에 고정. 베벨 구멍을 채우고 위 베벨 위로 굵게 올라가 위 받침에 걸린다
  const sleeve = new THREE.Group();
  sleeve.name = 'sleeve';
  sleeve.position.set(K.XC, 0, K.ZC);
  g.add(sleeve);
  sleeve.add(
    mesh(
      lathe(
        [
          [SI, Y_SL0],
          [SR, Y_SL0],
          [SR, 1.985],
          [0.07, 1.985],
          [0.07, Y_SL1 - 0.004],
          [0.066, Y_SL1],
          [SI, Y_SL1],
          [SI, Y_SL0]
        ],
        40
      ),
      aluminum()
    )
  );
  // 슬리브 꼭대기 노란 표지(윗면 고리 위에 얹은 막대)
  const flagU = mesh(new THREE.BoxGeometry(0.05, 0.024, 0.03), paint(0xf2b619));
  flagU.position.set(0.05, Y_SL1 + 0.011, 0);
  sleeve.add(flagU);
  g.add(wallBearing(K.XC, 2.12, K.ZC, 'y', 0.076), wallBearing(K.XC, 1.05, K.ZC, 'y', 0.056));

  // 위 큰 베벨(이가 아래로, 꼭짓점 P 를 본다, 슬리브에 고정) · 아래 작은 베벨(이가 위로, 안쪽 축에 고정)
  const wU = wrapAt(FR_U);
  const bevU = bevel200(K.Nu, K.m, GU200, { face: K.face, bore: 0.05, marker: 'web' });
  bevU.name = 'bevelU';
  wU.add(bevU);
  const wL = wrapAt(FR_L);
  const bevL = bevel200(K.Nl, K.m, GL200, { face: K.face, bore: 0.05, marker: 'rim' });
  bevL.name = 'bevelL';
  wL.add(bevL);
  g.add(wU, wL);

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

  // 회전 화살표(위에서 본 모양): 슬리브 꼭대기 · 안쪽 축 아래 끝 — 서로 반대
  const mkArrow = (ccw: boolean, y: number): THREE.Group => {
    const a = rotArrow(0.24, ccw);
    a.rotation.x = -PI / 2;
    a.position.set(K.XC, y, K.ZC);
    g.add(a);
    return a;
  };
  const stI = state200(0);
  mkArrow(stI.dirU > 0, 2.4);
  mkArrow(stI.dirL > 0, 0.93);

  g.add(
    leaderTo(tag('큰 베벨(위, 24)', v(-1.6, 2.35, 0.35)), 'bevelU'),
    leaderTo(tag('작은 베벨(아래, 14)', v(-1.6, 1.2, 0.35)), 'bevelL'),
    leaderTo(tag('구동 베벨 피니언(14)', v(0.9, 2.3, 0.35)), 'pinion'),
    leaderTo(tag('속 빈 슬리브(위 베벨)', v(-1.6, 2.75, 0.35)), 'sleeve'),
    leaderTo(tag('안쪽 축(아래 베벨)', v(-1.6, 0.85, 0.35)), 'innerShaft')
  );

  const apply = (): void => {
    const st = state200(theta);
    sleeve.rotation.y = -st.phiU; // 위 베벨 로컬 +Z = −Y
    innerShaft.rotation.y = st.phiL;
    bevU.rotation.z = st.phiU;
    bevL.rotation.z = st.phiL;
    pin.rotation.z = theta;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '구동', value: '구동 베벨 하나가 위 베벨과 아래 베벨을 늘 함께 돌린다' },
      { label: '위 베벨 → 속 빈 슬리브', value: '14 : 24 = 0.58 — 느리게' },
      { label: '아래 베벨 → 안쪽 축', value: '14 : 14 = 1.00 — 빠르게' },
      { label: '방향', value: '슬리브와 안쪽 축은 같은 축선에서 서로 반대 방향으로 돈다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 2.2, 6.3], target: [0, 1.7, 0] }
  };
}
