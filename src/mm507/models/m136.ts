// 136 톱니 모양 캠 바퀴 — 테 옆면에 톱니 난 왕관 캠이 돌아, 스프링으로 톱니에 눌린 따름 막대를 좌우로 밀었다 당긴다 (판화 136번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { coilSpring, displayStand, rotArrow, tag, leaderTo } from '../kit';
import { shaftX } from '../kit/k061';
import { pedestalX } from '../kit/gear6';
import {
  K136,
  bench136,
  camSection136,
  faceCamLift136,
  faceCamWheel136,
  followerRod136,
  setCamSection136,
  springBracket136
} from '../kit/k134';

const XW = -0.05; // 톱니 골 평면의 x
const CY = 1.4; // 축 높이
const ZC = 0.26; // 바퀴 축의 z
const ZR = 0.7; // 막대의 z = ZC + 테 가운데 반지름 0.44
const XB = 0.72; // 세운 판 구멍의 x
const TOP = 0.86; // 받침 대 윗면
const PHASE = 1.6; // psi = 0.5(theta − PHASE) + 0.02 — t = 1 에 막대가 골에 앉는다

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM136(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 받침 대(판화의 빗금 친 바닥) — 오른쪽 끝이 세운 판 오른쪽 면과 같다
  const bench = bench136(-1.25, 0.755, TOP);
  bench.name = 'bench';
  g.add(bench);

  // 가로(X) 축 + 축받이 기둥 둘(판화에 없는 최소 보충)
  const shaft = shaftX(-1.05, -0.1, CY, ZC, 0.05);
  shaft.name = 'shaft';
  g.add(shaft);
  for (const x of [-0.9, -0.42]) {
    const ped = pedestalX(x, CY, ZC, -1, TOP);
    ped.name = 'pedestal';
    g.add(ped);
  }

  // 옆면 톱니 캠 바퀴 — 원점 = 축 위·톱니 골 평면, 회전축 로컬 X
  const camWheel = faceCamWheel136();
  camWheel.name = 'camWheel';
  camWheel.position.set(XW, CY, ZC);

  // 검사용 단면(보이지 않음, 돌지 않음) — 매 프레임 setCamSection136 로 갱신
  const camSection = camSection136();
  camSection.name = 'camSection';
  camSection.position.set(XW, CY, ZR);

  // 따름 막대 — 원점 = 둥근 날의 맨 왼쪽 점
  const rod = followerRod136();
  rod.name = 'rod';
  rod.position.set(XW, CY, ZR);

  // 누름 스프링 — 로컬 +X 길이 1, scale.x 로 길이를 맞춘다. y·z 는 여기서 고정, x 만 apply 에서 맞춘다
  const spring = coilSpring(0.055, 0.011, 5);
  spring.name = 'spring';
  spring.position.set(0, CY, ZR);

  // 세운 판(고정) + 굽은 보강 살 — 원점 = 구멍 중심
  const bracket = springBracket136(0.54);
  bracket.name = 'bracket';
  bracket.position.set(XB, CY, ZR);

  g.add(camWheel, camSection, rod, spring, bracket);

  // 회전 방향 화살표(+X 둘레 반시계) — 두 축받이 사이 축 둘레
  const arrow = rotArrow(0.2, true);
  arrow.position.set(-0.66, CY, ZC);
  arrow.rotation.y = Math.PI / 2;
  g.add(arrow);

  // 이름표 5개 — 막대 이름표만 막대를 따라간다
  g.add(
    tag('옆면 톱니 캠 바퀴(구동)', v(-0.95, 2.3, 0.3)),
    leaderTo(tag('누름 스프링(막대를 톱니에 붙인다)', v(1.55, 1.15, 0.7)), spring),
    leaderTo(tag('세운 판(고정)', v(1.5, 1.6, 0.7)), bracket),
    leaderTo(tag('축받이', v(-1.6, 1.75, 0.3)), 'pedestal')
  );
  const tagRod = tag('따름 막대(톱니 모양대로 좌우로)', v(XW + 0.75, 1.95, ZR));
  g.add(tagRod);

  let psi = 0;
  let lift = 0;
  const apply = (): void => {
    psi = 0.5 * (theta - PHASE) + 0.02; // 바퀴는 구동각의 절반 속도
    camWheel.rotation.x = psi;
    shaft.rotation.x = psi;
    lift = faceCamLift136(psi);
    rod.position.x = XW + lift;
    spring.position.x = rod.position.x + 0.3; // 스프링 왼쪽 끝 = 막대 턱 오른쪽 면
    spring.scale.x = 0.685 - spring.position.x; // 오른쪽 끝 = 세운 판 왼쪽 면 x 0.685
    setCamSection136(camSection, psi);
    tagRod.position.x = rod.position.x + 0.75;
  };
  apply();

  return {
    group: g,
    view: { pos: [1.7, 2.3, 6.3], target: [0, 1.2, 0.25] },
    notes: () => {
      // 한 톱니 접기: u = psi 를 30° 로 접은 값 — u 0.04~0.68 은 천천히 밀려난다
      const pitch = (2 * Math.PI) / K136.N;
      const u = (((psi / pitch) % 1) + 1) % 1;
      const state = u >= 0.04 && u < 0.68 ? '천천히 밀려남' : '빠르게 되돌아옴';
      return [
        { label: '지금 상태', value: state },
        { label: '막대 변위', value: `${lift.toFixed(3)} (0~0.1), 행정 0.098` },
        { label: '왕복 횟수', value: '톱니 12개 → 바퀴 한 바퀴에 막대 12번 왕복' },
        { label: '원문 한 줄', value: '톱니 모양을 바꾸면 막대의 움직임이 바뀐다' },
        { label: '바퀴 회전수', value: `${(psi / (2 * Math.PI)).toFixed(2)}` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
