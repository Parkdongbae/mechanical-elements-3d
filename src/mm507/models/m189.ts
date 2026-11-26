// 189 분리 장치 변형 3 (186 의 또 다른 변형) — 편심이 가로 막대(편심 막대)를 왕복시키고, 막대 허브 아래의 갭이
// 위 흔들 축에 매달린 팔의 핀을 물어 팔(밸브 쪽)을 흔든다. 당김 막대를 끌어올리면 링크가 막대 오른쪽 끝을 들어
// 갭이 핀에서 위로 빠진다 → 막대는 계속 왕복, 팔은 멈춤. 다시 내리면 갭이 핀을 물어 연결 (판화 189번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { eccentric186 } from '../kit/k186';
import { K189, arm189, gear189, guide189, link189, pinE189, puller189, rockShaft189, rod189 } from '../kit/k189';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM189(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 편심(구동, 판화 밖 왼쪽 — 186 처럼 보충) + 축
  const C = K189.C;
  const zc = (K189.zR0 + K189.zR1) / 2;
  const eShaft = shaftZ(C[0], C[1], 0.19, 0.05);
  eShaft.name = 'eccShaft';
  const ecc = eccentric186();
  ecc.name = 'eccentric';
  ecc.position.set(C[0], C[1], zc);
  g.add(eShaft, ecc);

  // 흔들 축 + 팔(밸브 쪽, 핀)
  const O = K189.O;
  const rShaft = rockShaft189();
  rShaft.name = 'rockShaft';
  rShaft.position.set(O[0], O[1], 0);
  const arm = arm189();
  arm.name = 'arm';
  arm.position.set(O[0], O[1], 0);
  g.add(rShaft, arm);

  // 편심 막대(갭), 링크, R 핀, 당김판, 안내
  const rod = rod189();
  rod.name = 'rod';
  const link = link189();
  link.name = 'link';
  const pinE = pinE189();
  pinE.name = 'pinE';
  const puller = puller189();
  puller.name = 'puller';
  const guide = guide189();
  guide.name = 'guide';
  guide.position.set(K189.DX - K189.ARM, K189.guideY, 0);
  g.add(rod, link, pinE, puller, guide);

  const arrow = rotArrow(0.36, true);
  arrow.position.set(C[0], C[1], 0.25);
  g.add(arrow);

  const tEcc = leaderTo(tag('편심(구동)', v(-1.5, 2.0, 0.35)), 'eccentric');
  const tRod = leaderTo(tag('편심 막대', v(-0.6, 0.5, 0.35)), 'rod');
  const tGab = leaderTo(tag('갭(핀을 무는 홈)', v(0.2, 0.42, 0.35)), 'rod');
  const tArm = leaderTo(tag('흔들 팔과 핀(밸브 쪽)', v(-0.75, 2.3, 0.35)), 'arm');
  const tPull = leaderTo(tag('당김 막대(손잡이)', v(1.75, 2.95, 0.35)), 'puller');
  const tLink = leaderTo(tag('링크', v(1.85, 1.55, 0.35)), 'link');
  g.add(tEcc, tRod, tGab, tArm, tPull, tLink);

  let st = gear189(0);
  const apply = (): void => {
    st = gear189(theta);
    eShaft.rotation.z = theta;
    ecc.rotation.z = theta;
    rod.position.set(st.G[0], st.G[1], 0);
    rod.rotation.z = st.rodAng;
    arm.rotation.z = st.armAng;
    rShaft.rotation.z = st.armAng;
    link.position.set(st.R[0], st.R[1], 0);
    link.rotation.z = -st.link;
    pinE.position.set(st.R[0], st.R[1], 0);
    puller.position.set(st.D[0] - K189.ARM, st.D[1], 0);
    tPull.position.y = 2.95 + st.lift;
    tLink.position.y = 1.55 + st.lift / 2;
    tRod.position.set(st.G[0] - 1.1, st.G[1] - 0.45, 0.35);
    tGab.position.set(st.G[0] - 0.3, st.G[1] - 0.53, 0.35);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.8, 6.4], target: [0, 1.75, 0] },
    notes: () => [
      {
        label: '상태',
        value: st.engaged
          ? '연결 — 갭이 핀을 물어 편심 왕복이 팔(밸브 쪽)을 흔든다'
          : st.h > 0.98
            ? '분리 — 당김 막대로 막대를 들어 갭이 핀에서 빠짐, 막대만 왕복하고 팔은 멈춤'
            : theta % (8 * Math.PI) < 5 * Math.PI
              ? '전환 — 당겨 올리는 중'
              : '전환 — 내려 다시 무는 중'
      },
      { label: '갭–핀 높이', value: st.clear < 0 ? '물림' : `핀 위 ${st.clear.toFixed(3)}` },
      { label: '당김 막대 오름', value: `${st.lift.toFixed(3)}` },
      { label: '팔 각', value: `${(st.armAng * DEG).toFixed(1)}°` },
      { label: '원리', value: '편심이 막대를 왕복시키고, 막대를 들어 갭이 핀에서 빠지면 밸브 쪽 팔만 멈춘다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
