// 139 내부 랙 틀과 피니언 — 피니언이 스타디움 내부 랙의 안둘레를 물고 계속 돌면
//  랙은 틀 창 안에서 위아래로 미끄러지고, 랙을 받친 직사각형 틀이 왕복 직선 운동을 한다.
//  위의 크랭크 둘·동기 바·링크 둘은 랙을 수평으로 떠받치는 평행 가이드, 밑의 바퀴 둘은 받침대 위를 굴른다.
//  (설계표 docs/mm507-sheets/139.md — 모델은 배치·motion139 대입, 따라가는 이름표만 담당)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import {
  K139,
  crank139,
  internalRack139,
  linkRod139,
  motion139,
  pinion139,
  pinionStud139,
  rackFrame139,
  syncBar139,
  type Pose139
} from '../kit/k139';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 물린 구간 한글 이름 */
const SEG_KR: Record<Pose139['seg'], string> = { top: '윗변', bottom: '아랫변', left: '왼 끝 호', right: '오른 끝 호' };

export default function buildM139(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 고정 스터드(판화의 검은 허브 — 뒤판 보스에서 나와 피니언 구멍을 꿰는 고정 축)
  g.add(pinionStud139());

  // 피니언(구동·시계) — 고정 축 위, 랙 가운데 빈 곳에서 안둘레와 물린다
  const pinion = pinion139();
  pinion.position.set(0, K139.PY, K139.zGear);
  g.add(pinion);

  // 내부 랙(스타디움) — 틀과 가로는 같이, 세로는 창 안에서 ±K139_D 로만 미끄러진다
  const rack = internalRack139();
  g.add(rack);

  // 직사각형 틀 — 바퀴 둘(child)이 받침대 윗면 위를 굴러 왕복한다
  const frame = rackFrame139();
  g.add(frame);
  const wheelL = frame.getObjectByName('wheelL') as THREE.Group;
  const wheelR = frame.getObjectByName('wheelR') as THREE.Group;

  // 위 가이드(평행 사변형): 크랭크 둘(틀 윗판 받침대 위) + 동기 바 + 링크 둘(랙 귀 핀에 걸린다)
  const crankL = crank139('L');
  crankL.position.set(-K139.gx, K139.Ay, 0);
  const crankR = crank139('R');
  crankR.position.set(K139.gx, K139.Ay, 0);
  const bar = syncBar139();
  const rodL = linkRod139(K139.Lr);
  const rodR = linkRod139(K139.Lr);
  g.add(crankL, crankR, bar, rodL, rodR);

  // 회전 방향 화살표(시계 — 아랫변 물림 때 틀이 왼쪽으로, 윗변일 때 오른쪽으로)
  const arrow = rotArrow(0.16, false);
  arrow.position.set(0, K139.PY, 0.185);
  g.add(arrow);

  // 이름표 5개 — '피니언' 하나만 고정, 나머지 넷은 부품을 따라간다
  //  (고정 이름표는 틀 상자 x ±1.16 밖, 크랭크 중심 0.9 밖에 둔다 — 가림·따라가기 경보 피함)
  g.add(leaderTo(tag('피니언(구동·고정축)', v(-1.45, 2.62, 0.3)), pinion));
  const tagRack = leaderTo(tag('내부 랙', v(-1.32, K139.PY - 0.5, 0.3)), rack);
  const tagFrame = tag('직사각형 틀', v(1.28, 1.02, 0.3));
  const tagBar = tag('동기 바', v(0, K139.Ay + 0.16, 0.3));
  const tagWheel = leaderTo(tag('바퀴', v(-1.28, 0.62, 0.3)), wheelL);
  g.add(tagRack, tagFrame, tagBar, tagWheel);

  // theta 의 닫힌 식으로 전체 자세를 다시 놓는다(절대 자세 — 역회전·누적 오차 없음)
  const apply = (p: Pose139): void => {
    pinion.rotation.z = p.beta;
    rack.position.set(p.X, K139.PY + p.Y, K139.zGear);
    frame.position.x = p.X;
    wheelL.rotation.z = p.wheel; // 굴름 — 접촉점이 미끄러지지 않는다
    wheelR.rotation.z = p.wheel;
    crankL.position.set(p.X - K139.gx, K139.Ay, 0); // 축이 틀 윗판 받침대 위 — 틀과 같이 왕복한다
    crankR.position.set(p.X + K139.gx, K139.Ay, 0);
    crankL.rotation.z = p.crank;
    crankR.rotation.z = p.crank;
    const bx = p.X + K139.La * Math.cos(p.crank); // 동기 바 가운데(늘 수평)
    const by = K139.Ay + K139.La * Math.sin(p.crank);
    bar.position.set(bx, by, 0);
    rodL.position.set(p.B[0][0], p.B[0][1], 0.215); // 위 눈 = 크랭크 핀(z 0.2~0.23 — 팔 판 0.177~0.203 위), 로컬 −Y 가 랙 귀 핀을 본다
    rodL.rotation.z = Math.atan2(p.C[0][0] - p.B[0][0], -(p.C[0][1] - p.B[0][1]));
    rodR.position.set(p.B[1][0], p.B[1][1], 0.215);
    rodR.rotation.z = Math.atan2(p.C[1][0] - p.B[1][0], -(p.C[1][1] - p.B[1][1]));
    tagRack.position.set(p.X - 1.32, K139.PY + p.Y - 0.5, 0.3);
    tagFrame.position.set(p.X + 1.28, 1.02, 0.3);
    tagBar.position.set(bx, by + 0.16, 0.3);
    tagWheel.position.set(p.X - 1.28, 0.62, 0.3);
  };
  apply(motion139(theta));

  return {
    group: g,
    view: { pos: [0, 1.6, 6.4], target: [0, 1.5, 0] },
    notes: () => {
      const p = motion139(theta);
      const sgn = (x: number): string => `${x < 0 ? '-' : '+'}${Math.abs(x).toFixed(2)}`;
      return [
        { label: '지금 물린 쪽', value: SEG_KR[p.seg] },
        { label: '틀 위치', value: `${sgn(p.X)} (행정 1.20)` },
        { label: '랙의 위아래 미끄럼', value: `${sgn(p.Y)} (최대 0.228)` },
        { label: '피니언 회전수', value: `${(theta / (2 * Math.PI)).toFixed(1)} 바퀴` },
        { label: '왕복 주기', value: '접점이 랙 안둘레를 한 바퀴 돌면 틀이 한 번 왕복(9.49 s)' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply(motion139(theta));
    }
  };
}
