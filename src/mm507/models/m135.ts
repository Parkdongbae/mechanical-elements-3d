// 135 삼각 편심 변형 — 뒤 원판 앞면에 삼각 태핏을 볼트로 달아 돌리고, 네모 틀이 태핏에 얹혀 왕복하다 끝에서 잠깐 쉰다 (판화 135번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import { rodGuide } from '../kit/k089';
import { K135, plainShaftZ, tappetDisc135, tappetLift135, valveYoke135 } from '../kit/k134';

const OX = 0; // 축 중심 x = 태핏 위 꼭짓점
const OY = 1.75; // 축 중심 y
const DISC_Z = 0.02; // 원판 앞면 = 태핏 뒷면 z
const FRAME_Z = 0.11; // 틀·막대 가운데 평면 z
const PHASE = 1.6; // θe = theta − PHASE + π (t = 1 에서 θe = 180° — 판화 자세, 아래 멈춤)
const D2R = Math.PI / 180;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM135(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 축 — 뒤판 보스에서 원판 뒷면(z −0.03)까지, 앞에서는 보이지 않는다
  const shaft = plainShaftZ(OX, OY, DISC_Z - K135.discT);
  shaft.name = 'shaft';
  g.add(shaft);

  // 원판 + 삼각 태핏(볼트로 한 몸) — 원점 = 축 = 태핏 위 꼭짓점 V0
  const cam = tappetDisc135();
  cam.name = 'cam';
  cam.position.set(OX, OY, DISC_Z);

  // 밸브 막대의 네모 틀(너트·막대 포함) — 원점 = 창 중심
  const frame = valveYoke135();
  frame.name = 'frame';
  frame.position.set(OX, OY, FRAME_Z);

  // 고정 안내 2개(판화에 없음) — 구멍 축이 세로, 막대 끝이 빠지지 않게
  const guideT = rodGuide('y', K135.rodR, FRAME_Z);
  guideT.name = 'guideT';
  guideT.position.set(OX, 2.66, FRAME_Z);
  const guideB = rodGuide('y', K135.rodR, FRAME_Z);
  guideB.name = 'guideB';
  guideB.position.set(OX, 0.84, FRAME_Z);
  g.add(cam, frame, guideT, guideB);

  // 회전 방향 화살표(반시계) — 볼트 머리(z 0.215)보다 앞
  const arrow = rotArrow(0.2, true);
  arrow.position.set(OX, OY, 0.3);
  g.add(arrow);

  // 이름표 5개 — 틀 이름표만 틀을 따라간다
  g.add(
    tag('뒤 원판(축과 한 중심)', v(-1.4, 2.5, 0.3)),
    leaderTo(tag('삼각 태핏(축은 위 꼭짓점 자리)', v(-1.5, 1.25, 0.3)), cam),
    leaderTo(tag('볼트(태핏을 원판에 고정 — 축이 아님)', v(1.6, 1.2, 0.3)), cam),
    tag('고정 안내', v(0.8, 2.95, 0.3))
  );
  const tagFrame = tag('밸브 막대의 틀(끝에서 잠깐 쉰다)', v(1.45, 2.0, 0.3));
  g.add(tagFrame);

  let thE = 0;
  let lift = 0;
  const apply = (): void => {
    thE = theta - PHASE + Math.PI;
    cam.rotation.z = thE;
    lift = tappetLift135(thE);
    const yF = OY + lift - K135.w / 2; // 틀 창 중심 = 축 + h − w/2
    frame.position.y = yF;
    tagFrame.position.y = yF + 0.5; // 틀을 따라감(범위 2.0~2.5)
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 2.0, 6.4], target: [0, OY, 0.1] },
    notes: () => {
      const f = (((thE / D2R) % 360) + 360) % 360;
      let state = '올라감';
      if (f >= 330 || f < 30) state = '위에서 멈춤';
      else if (f < 150) state = '내려감';
      else if (f < 210) state = '아래에서 멈춤';
      const disp = lift - K135.w / 2;
      return [
        { label: '지금 상태', value: state },
        { label: '멈춤', value: '한 바퀴 가운데 1/3 은 멈춤(60° 씩 두 번)' },
        { label: '틀 위치', value: `${disp >= 0 ? '+' : ''}${disp.toFixed(3)} (±0.25), 행정 ${K135.w}` },
        { label: '91번과 다른 점', value: '태핏이 뒤 원판에 달려 축이 앞으로 나오지 않는다' },
        { label: '구동 회전수', value: `${(theta / (2 * Math.PI)).toFixed(2)}` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
