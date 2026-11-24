// 084 엔진 조속기용 이중 랙 틀 — 계속 도는 손가락 캠 D 가 막대 A 로 올리고 내린 틀 B 의 윗랙·아랫랙을 한 피치씩 밀어 틀을 좌우로 옮긴다 (판화 84번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, pulley, rotArrow, shaftZ, tag } from '../kit';
import { fingerCam, k84State, rackFrame, wallGuide, yokeRod } from '../kit/k083';

const CY = 1.45; // 캠 축 높이
const ALPHA0 = 0.15; // theta → 캠 각 오프셋 — t = 1 이 판화 자세(손가락이 위, 윗랙을 미는 중)
const MODE_KR = { down: '내림: 윗랙 물림(왼쪽으로)', neutral: '중립: 닿지 않음', up: '올림: 아랫랙 물림(오른쪽으로)', move: '막대 A 이동 중' } as const;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM084(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 캠 축 + 틀 뒤의 큰 바퀴(살 4개) + 손가락 캠 D — 한 몸, 반시계
  g.add(shaftZ(0, CY, 0.42, 0.05));
  const flywheel = pulley(0.62, { width: 0.1, spokes: 4, flat: true });
  flywheel.name = 'flywheel';
  flywheel.position.set(0, CY, 0.06);
  const camD = fingerCam(0.05);
  camD.name = 'camD';
  camD.position.set(0, CY, 0.3);
  g.add(flywheel, camD);

  // 이중 랙 틀 B, 멍에 막대 A
  const frameB = rackFrame(0.06);
  frameB.name = 'frameB';
  frameB.position.set(0.2, CY, 0.3);
  const rodA = yokeRod(0.5, 0.12);
  rodA.name = 'rodA';
  rodA.position.set(0, 2.06, 0.37);
  g.add(frameB, rodA);

  // 좌우 안내 블록 둘 + 막대 A 안내
  for (const s of [-1, 1]) {
    const gd = wallGuide(0.1, 0.24, 0.6, 'x');
    gd.position.set(s * 1.42, CY, 0.3);
    g.add(gd);
  }
  const gy = wallGuide(0.078, 0.1, 0.67, 'y');
  gy.position.set(0, 2.8, 0.37);
  g.add(gy);

  // 회전 화살표(반시계) + 이름표 5개
  const arrow = rotArrow(0.2, true);
  arrow.position.set(0, CY, 0.36);
  g.add(arrow);
  const tagA = tag('막대 A(조속기로)', v(0.75, 2.85, 0.4));
  const tagB = tag('이중 랙 틀 B', v(-1.2, 2.25, 0.35));
  g.add(
    tagA,
    tagB,
    tag('캠 D(손가락 하나)', v(0.7, 0.78, 0.4)),
    tag('안내 블록', v(1.75, 0.78, 0.35)),
    tag('큰 바퀴(캠 축 구동)', v(-0.75, 0.45, 0.15))
  );

  let st = k84State(ALPHA0);
  const apply = (): void => {
    st = k84State(theta + ALPHA0);
    flywheel.rotation.z = st.alpha;
    camD.rotation.z = st.alpha;
    frameB.position.set(st.x, CY + st.y, 0.3);
    rodA.position.y = 2.06 + st.y;
    tagA.position.y = 2.85 + st.y;
    tagB.position.set(-1.2 + st.x - 0.2, 2.25 + st.y, 0.35);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.8, 6.4], target: [0, 1.7, 0.2] },
    notes: () => [
      { label: '상태', value: MODE_KR[st.mode] },
      { label: '틀의 가로 자리 x', value: `${st.x.toFixed(3)} (−0.2 ~ +0.2)` },
      { label: '막대 A 높이', value: st.y > 0.035 ? '+0.07' : st.y < -0.035 ? '−0.07' : '0' },
      { label: '밀기', value: '캠 한 바퀴에 랙 한 피치(0.2)' }
    ],
    update(dt: number, speed: number): void {
      // 절대 자세 — 누적 theta 의 닫힌 식, 한 주기(캠 6바퀴)에 제자리
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
