// 016 스페인 바턴 — 고정 도르래 A 아래 움직도르래 M·B, 자유 끝을 당기면 추가 4배 속도로 오른다 (판화 16번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, arcPoints, ceilingBeam, displayStand, leaderTo, pulleyBlock, rod, ropeEnd, rotArrow, tag, weight } from '../kit';

const Z = 0.22; // 도르래·줄 중심 면
const R = 0.2; // 도르래 반지름
const EYE = R + 0.06; // 눈고리 중심(도르래 중심에서 위·아래로)
const AY = 2.55; // A 중심 y

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** theta → 당김 주기 위상 p(0~1)·당김 높이 h */
function phase(theta: number): { p: number; h: number } {
  const p = (1 - Math.cos(theta * 0.5)) / 2;
  return { p, h: 0.25 * p };
}

export default function buildM016(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let h = 0; // notes() 가 읽는 현재 당김 높이

  g.add(displayStand());
  g.add(ceilingBeam(-0.9, 0.9, 3.0, [-0.4, 0.0]));

  // 고정 도르래 A — 윗 눈고리를 rod 로 들보 오른쪽 고리에 매단다
  const blockA = pulleyBlock(R, { hookUp: 0.06 });
  blockA.position.set(0, AY, Z);
  g.add(blockA);
  g.add(rod(v(0, AY + EYE, Z), v(0, 2.94, Z)));

  // 움직도르래 M(위·아래 눈고리) · B(윗 눈고리)
  const blockM = pulleyBlock(R, { hookUp: 0.06, hookDown: 0.06 });
  const blockB = pulleyBlock(R, { hookUp: 0.06 });
  g.add(blockM, blockB);

  // 추 + M 아래 눈고리→추 윗면 잇는 짧은 막대(길이 0.10 고정, 매 프레임 y 이동)
  const wt = weight(0.44, 0.30);
  const link = rod(v(0, 0, Z), v(0, 0.1, Z), 0.008);
  g.add(wt, link);

  // 줄 X(들보 고리→M 밑→B 위→자유 끝)·줄 Y(M 눈고리→A 위→B 눈고리)
  const ropeX = new Rope(0.014);
  const ropeY = new Rope(0.014);
  g.add(ropeX.group, ropeY.group);

  // 자유 끝 손잡이
  const handle = ropeEnd();
  g.add(handle);

  // A 앞 회전 방향 화살표(시계) + 이름표
  const arrow = rotArrow(0.3, false);
  arrow.position.set(0, AY, 0.4);
  g.add(arrow);
  const tagA = leaderTo(tag('A 고정 도르래', v(0.9, 2.8, 0.4)), blockA);
  const tagB = tag('B 움직도르래', v(1.1, 2.15, 0.4));
  const tagM = tag('M 움직도르래', v(-1.1, 0.92, 0.4));
  const tagW = tag('추', v(-0.9, 0.41, 0.4));
  const tagF = tag('당기는 곳', v(1.35, 1.78, 0.4));
  g.add(tagA, tagB, tagM, tagW, tagF);

  const sheaveA = blockA.userData.sheave as THREE.Group;
  const sheaveM = blockM.userData.sheave as THREE.Group;
  const sheaveB = blockB.userData.sheave as THREE.Group;

  /** theta 하나에서 모든 부품의 절대 자세를 다시 계산 */
  function apply(): void {
    h = phase(theta).h;
    const yM = 0.92 + h; // M 중심 높이
    const yB = 2.0 - h; // B 중심 높이 (yM + yB = 2.92 일정)
    const yF = 1.78 - 4 * h; // 자유 끝 높이

    blockM.position.set(-0.2, yM, Z);
    blockB.position.set(0.2, yB, Z);
    wt.position.set(-0.2, yM - 0.51, Z);
    link.position.set(-0.2, yM - 0.36, Z);
    handle.position.set(0.4, yF, Z);

    // 도르래 회전(반시계 +): A·B 시계, M 은 왼쪽 고정 줄을 타고 반시계
    sheaveA.rotation.z = -h / R;
    sheaveM.rotation.z = h / R;
    sheaveB.rotation.z = (-3 * h) / R;

    ropeX.setPath([
      v(-0.4, 2.94, Z),
      v(-0.4, yM, Z),
      ...arcPoints([-0.2, yM], R, Math.PI, 2 * Math.PI, Z), // M 밑을 반시계로 감음
      v(0, yM, Z),
      v(0, yB, Z),
      ...arcPoints([0.2, yB], R, Math.PI, 0, Z), // B 위를 시계로 넘음
      v(0.4, yB, Z),
      v(0.4, yF, Z)
    ]);
    ropeY.setPath([
      v(-0.2, yM + EYE, Z),
      v(-0.2, AY, Z),
      ...arcPoints([0, AY], R, Math.PI, 0, Z), // A 위를 시계로 넘음
      v(0.2, AY, Z),
      v(0.2, yB + EYE, Z)
    ]);

    // 이름표가 움직이는 부품을 따라간다
    tagB.position.set(1.1, yB + 0.15, 0.4);
    tagM.position.set(-1.1, yM, 0.4);
    tagW.position.set(-0.9, yM - 0.51, 0.4);
    tagF.position.set(1.35, yF, 0.4);
  }

  apply(); // 첫 프레임 전 초기 자세

  return {
    group: g,
    notes: () => [
      { label: '이득', value: '4배' },
      { label: '당긴 줄 : 오른 높이', value: (4 * h).toFixed(2) + ' : ' + h.toFixed(2) },
      { label: '움직도르래', value: '2개(M, B)' }
    ],
    update(dt: number, speed: number): void {
      // 절대 위상에서 전체 자세 재계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
