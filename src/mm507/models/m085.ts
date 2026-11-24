// 085 캠으로 들어 올리는 낙하 막대 — 와이퍼 캠 둘이 돌기 B 를 밀어 올리고, 놓이면 막대 A 가 제 무게로 떨어진다 (판화 85번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { anvilBlock, k85Lift, k85Mode, K85, K85_BEND, stampFrame, stampRod, wiperCam } from '../kit/k083';

const THETA_E0 = 2.6416; // theta → thetaE 오프셋 — t = 1 이 판화 자세(거의 다 들림, β 1.10)
const MODE_KR = { rest: '쉼', lift: '들어 올림', drop: '떨어짐' } as const;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM085(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 캠 축(뒤판 보스가 받침) + 와이퍼 캠(팔 둘) — 시계 방향 rotation.z = −thetaE
  g.add(shaftZ(0.224, 2.0, 0.42, 0.05));
  const cam = wiperCam(0.07);
  cam.name = 'cam';
  cam.position.set(0.224, 2.0, 0.31);
  g.add(cam);

  // 막대 A(원점 = 캠 축 높이의 중심선) + 기둥 틀 + 모루
  const rodA = stampRod(-1.48, 0.85, 0.11);
  rodA.name = 'rodA';
  rodA.position.set(0, 2.0, 0.2);
  const frame = stampFrame(2.57, 0.58, [1.07, 2.5], 0.2);
  frame.name = 'frame';
  frame.position.set(0.58, 0.18, 0.2);
  const anvil = anvilBlock(0.56, 0.09, 0.34);
  anvil.position.set(0, 0.18 + 0.09 / 2, 0.2); // 바닥면을 받침 윗면 y 0.18 에 — 윗면 y 0.27
  g.add(rodA, frame, anvil);

  // 회전 방향 화살표(시계) + 이름표 5개('돌기 B'·'스탬프 머리'·'막대 A'는 막대를 따라 움직인다)
  const arrow = rotArrow(0.2, false);
  arrow.position.set(0.224, 2.0, 0.38);
  arrow.rotation.z = Math.PI - 0.15; // 화살표의 빈 틈(110°)을 캠–돌기 닿는 자리(축 왼쪽 위) 쪽으로 — 닿는 곳을 가리지 않게
  g.add(arrow);
  const tagB = tag('돌기 B', v(-0.55, 2.3, 0.4));
  const tagHead = tag('스탬프 머리', v(-0.8, 0.55, 0.3));
  const tagRod = tag('막대 A(제 무게로 떨어짐)', v(-0.75, 1.45, 0.3));
  g.add(
    tagB,
    tagHead,
    tagRod,
    tag('캠(와이퍼) 둘', v(0.95, 2.3, 0.4)),
    tag('기둥 틀·안내 팔', v(1.3, 2.9, 0.3))
  );

  // 찧은 횟수 — 떨어짐이 끝나 머리가 모루에 닿은 횟수(π 주기마다 1회)
  const hits = (thetaE: number): number =>
    Math.max(0, Math.floor((thetaE - (K85_BEND + K85.DROP)) / Math.PI) + 1);

  let mode: keyof typeof MODE_KR = 'rest';
  let lift = 0;
  const apply = (): void => {
    const thetaE = theta + THETA_E0;
    lift = k85Lift(thetaE);
    mode = k85Mode(thetaE);
    cam.rotation.z = -thetaE;
    rodA.position.y = 2.0 + lift;
    tagB.position.y = 2.3 + lift;
    tagHead.position.y = 0.55 + lift;
    tagRod.position.y = 1.45 + lift;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.9, 2.0, 6.2], target: [0.2, 1.7, 0.2] },
    notes: () => [
      { label: '상태', value: MODE_KR[mode] },
      { label: '들린 높이', value: `${lift.toFixed(3)} (최대 0.221)` },
      { label: '찧는 간격', value: '캠 한 바퀴에 두 번 찧는다' },
      { label: '찧은 횟수', value: `${hits(theta + THETA_E0)}회` },
      { label: '올라가는 법', value: '인벌류트 캠: 등속으로 오름' }
    ],
    update(dt: number, speed: number): void {
      // 절대 자세 — thetaE(= theta + 오프셋)만의 닫힌 식이라 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
