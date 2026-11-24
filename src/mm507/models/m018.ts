// 018 고정 둘·움직 하나 도르래 — 고정 P1·P2 위아래 포개, 움직도르래 M 을 3:1로 받친다 (판화 18번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, arcPoints, ceilingBeam, displayStand, pulleyBlock, rod, ropeEnd, rotArrow, tag, weight } from '../kit';

const R1 = 0.26; // P1 반지름
const R2 = 0.22; // P2 반지름
const RM = 0.16; // M 반지름
const Y1 = 2.62; // P1 중심 y
const Y2 = 1.95; // P2 중심 y
const ZP1 = 0.15; // P1 높이
const ZP2 = 0.30; // P2 높이
const ZM = 0.225; // M 높이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** theta → 당김 주기 위상 p(0~1)·당김 높이 h */
function phase(theta: number): { p: number; h: number } {
  const p = (1 - Math.cos(theta * 0.5)) / 2;
  return { p, h: 0.25 * p };
}

export default function buildM018(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let h = 0; // notes() 가 읽는 현재 당김 높이

  g.add(displayStand());
  g.add(ceilingBeam(-0.9, 0.9, 3.0, [0.0]));

  // 고정 도르래 P1 — 윗 눈이 들보 고리와 바로 맞닿는다(막대 불필요)
  const blockP1 = pulleyBlock(R1, { hookUp: 0.06, hookDown: 0.06 });
  blockP1.position.set(0, Y1, ZP1);
  g.add(blockP1);

  // 고정 도르래 P2 — P1 아랫 눈과 P2 윗 눈을 가는 rod 로 연결
  const blockP2 = pulleyBlock(R2, { hookUp: 0.06 });
  blockP2.position.set(0, Y2, ZP2);
  g.add(blockP2);
  g.add(rod(v(0, Y1 - R1 - 0.06, ZP1), v(0, Y2 + R2 + 0.06, ZP2), 0.008));

  // 움직도르래 M(위·아래 눈고리, 소형이라 얇게)
  const blockM = pulleyBlock(RM, { hookUp: 0.06, hookDown: 0.06, width: 0.06 });
  g.add(blockM);

  // 추 + M 아랫 눈→추 윗면 잇는 막대(고정 길이 0.09, 매 프레임 y 이동)
  const wt = weight(0.30, 0.26);
  const link = rod(v(0, 0, ZM), v(0, 0.09, ZM), 0.008);
  g.add(wt, link);

  // 줄 1가닥 + 자유 끝 손잡이
  const rope = new Rope(0.014);
  g.add(rope.group);
  const handle = ropeEnd();
  g.add(handle);

  // P1 앞 회전 방향 화살표(시계) + 이름표
  const arrow = rotArrow(0.32, false);
  arrow.position.set(0, Y1, 0.40);
  g.add(arrow);
  const tagP1 = tag('고정 도르래 P1', v(-0.75, 2.72, 0.40));
  const tagP2 = tag('고정 도르래 P2', v(-0.72, 2.0, 0.40));
  const tagM = tag('움직도르래 M', v(-0.7, 0.85, 0.40));
  const tagW = tag('추', v(-0.65, 0.41, 0.40));
  const tagF = tag('당기는 곳', v(0.85, 1.6, 0.40));
  g.add(tagP1, tagP2, tagM, tagW, tagF);

  const sheaveP1 = blockP1.userData.sheave as THREE.Group;
  const sheaveP2 = blockP2.userData.sheave as THREE.Group;
  const sheaveM = blockM.userData.sheave as THREE.Group;

  /** theta 하나에서 모든 부품의 절대 자세를 다시 계산 */
  function apply(): void {
    h = phase(theta).h;
    const yM = 0.85 + h; // M 중심 높이
    const yF = 1.60 - 3 * h; // 자유 끝 높이

    blockM.position.set(0, yM, ZM);
    wt.position.set(0, yM - 0.44, ZM);
    link.position.set(0, yM - 0.22, ZM);
    handle.position.set(R1, yF, ZP1);

    // 도르래 회전(반시계 +): 모두 시계, M 이 가장 빠르다(비 1/0.22 : 2/0.16 : 3/0.26)
    sheaveP1.rotation.z = (-3 * h) / R1;
    sheaveP2.rotation.z = -h / R2;
    sheaveM.rotation.z = (-2 * h) / RM;

    // 줄: M 윗 눈 → P2 위 → M 오른쪽 → M 밑 → P1 위 → 자유 끝
    rope.setPath([
      v(0, yM + 0.22, ZM), // M 윗 눈에 맨 줄 끝
      v(-R2, Y2, ZP2),
      ...arcPoints([0, Y2], R2, Math.PI, 0, ZP2), // P2 위를 시계로 넘음
      v(RM, yM, ZM),
      ...arcPoints([0, yM], RM, 0, -Math.PI, ZM), // M 밑을 시계로 감음
      v(-R1, Y1, ZP1),
      ...arcPoints([0, Y1], R1, Math.PI, 0, ZP1), // P1 위를 시계로 넘음
      v(R1, yF, ZP1) // 자유 끝(손잡이)
    ]);

    // 이름표가 움직이는 부품을 따라간다
    tagM.position.set(-0.7, yM, 0.40);
    tagW.position.set(-0.65, yM - 0.44, 0.40);
    tagF.position.set(0.85, yF, 0.40);
  }

  apply(); // 첫 프레임 전 초기 자세

  return {
    group: g,
    notes: () => [
      { label: '이득', value: '3배' },
      { label: '당긴 줄 : 오른 높이', value: (3 * h).toFixed(2) + ' : ' + h.toFixed(2) },
      { label: '고정 도르래', value: '2개 (방향만 바꿈)' }
    ],
    update(dt: number, speed: number): void {
      // 절대 위상에서 전체 자세 재계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
