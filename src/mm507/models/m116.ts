// 116 크랭크 대신 쓰는 이중 랙 — 틀이 곧게 왕복하면 두 피니언이 번갈아 래칫·폴로 축을 한 방향으로 돌린다 (판화 116번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { K116, doubleRackFrame116, loosePinion116, ratchet116, slideGuide116, state116 } from '../kit/k116';

const TAU = Math.PI * 2;
const CY = 1.75; // 축·틀 가운데선 높이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM116(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 출력 축 — 뒤판 보스에서 앞 래칫 앞까지(그룹째 회전)
  const shaft = shaftZ(0, CY, 0.33, 0.07);
  shaft.name = 'shaft';
  g.add(shaft);

  // 래칫 둘(축에 고정)
  const ratchetR = ratchet116();
  ratchetR.name = 'ratchetR';
  ratchetR.position.set(0, CY, -0.09);
  const ratchetF = ratchet116();
  ratchetF.name = 'ratchetF';
  ratchetF.position.set(0, CY, 0.23);
  g.add(ratchetR, ratchetF);

  // 피니언 둘(축 위에서 헐겁게) + 폴
  const pR = loosePinion116(-1);
  pR.group.name = 'pinionR';
  pR.group.position.set(0, CY, 0);
  const pF = loosePinion116(1);
  pF.group.name = 'pinionF';
  pF.group.position.set(0, CY, K116.zF);
  g.add(pR.group, pF.group);

  // 이중 랙 틀(구동)
  const frame = doubleRackFrame116();
  frame.name = 'frame';
  frame.position.set(0, CY, 0);
  g.add(frame);

  // 안내 블록 둘(고정)
  const guideL = slideGuide116('x', { w: 0.096, d: 0.096 }, 0.07);
  guideL.name = 'guideL';
  guideL.position.set(-1.56, CY, 0.07);
  const guideR = slideGuide116('x', 0.049, 0.07);
  guideR.name = 'guideR';
  guideR.position.set(1.56, CY, 0.07);
  g.add(guideL, guideR);

  // 회전 화살표(축이 도는 방향 = 시계) + 이름표
  const arrow = rotArrow(0.27, false);
  arrow.position.set(0, CY, 0.3);
  g.add(arrow);
  const frameTag = tag('랙 틀(구동)', v(0, 2.5, 0.3));
  g.add(frameTag, tag('윗랙·앞 피니언', v(-1.25, 2.95, 0.3)), tag('아랫랙·뒤 피니언', v(-1.2, 0.95, 0.3)), tag('래칫과 폴', v(1.2, 2.95, 0.3)), leaderTo(tag('출력 축(한 방향)', v(1.15, 0.95, 0.3)), 'shaft'));

  const apply = (): void => {
    const s = state116(theta);
    frame.position.x = s.x;
    frameTag.position.x = s.x;
    pF.group.rotation.z = s.pinF;
    pR.group.rotation.z = s.pinR;
    shaft.rotation.z = s.shaft;
    ratchetF.rotation.z = s.shaft;
    ratchetR.rotation.z = s.shaft;
    pF.pawl.rotation.z = pF.pawlBase + s.liftF;
    pR.pawl.rotation.z = pR.pawlBase + s.liftR;
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.8, 6.4], target: [0, 1.7, 0.1] },
    notes: () => {
      const s = state116(theta);
      return [
        { label: '틀 위치', value: `x = ${s.x >= 0 ? '+' : ''}${s.x.toFixed(2)} (행정 0.47)` },
        { label: '지금 미는 피니언', value: s.drive === 'F' ? '앞(윗랙)' : '뒤(아랫랙)' },
        { label: '축', value: `시계 방향으로만 ${(-s.shaft / TAU).toFixed(2)} 바퀴` },
        { label: '한 행정에', value: '축 90°' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
