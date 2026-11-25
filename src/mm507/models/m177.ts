// 177 기관 분리 장치(풀림) — 홈 난 고리가 수평(177)이면 보이지 않는 크랭크의 손목 핀이 홈을 그냥 지나가고
//  크랭크는 한 자세다(원문: "the wrist passes through the slot without turning the crank"). 판화 177번 ·
//  설계표 docs/mm507-sheets/177.md. 부품은 전부 kit/k177(이미 구현됨) + 공용 키트 — 모델은 배치와
//  release177 결과 대입만 한다. 한 주기 theta 19.2 rad = 12 s: 가·나 통과, 다 재결합(176 자세), 라 대기, 마 풀기.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, tag } from '../kit';
import {
  crankBody177,
  K177,
  passageArrows177,
  release177,
  releaseRing177,
  swingArrows177,
  wristPin177
} from '../kit/k177';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM177(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 크랭크 몸통(고정 — 원문대로 통과 중에는 돌지 않는다) — group 원점 = 축 축선 (0, 1.06)
  const crank = crankBody177();
  crank.name = 'crank';
  crank.position.set(K177.S[0], K177.S[1], 0);
  g.add(crank);

  // 홈 난 고리(눈 위에서 돌아감) — 원점 = 눈 중심 (0, 2.78), 두께 0.06(z 0.07~0.13)
  const ring = releaseRing177();
  ring.name = 'ring';
  ring.position.set(K177.E[0], K177.E[1], K177.zRing);
  g.add(ring);

  // 유령 손목 핀(보이지 않는 크랭크의 손목) — y·z 고정, x 만 왕복(±0.72)
  const pin = wristPin177();
  pin.name = 'pin';
  pin.position.set(-K177.stroke, K177.E[1], K177.zPin);
  g.add(pin);

  // 통과 화살표 둘(판화의 검은 화살표 — 안쪽을 향함, 늘 보임)
  const pass = passageArrows177();
  pass.name = 'pass';
  pass.position.set(0, 2.72, K177.zPass);
  g.add(pass);

  // 고리 회전 방향 화살표 쌍 — 다(시계 재결합)·마(반시계 풀기)에만, 통과 중에는 숨김
  const swing = swingArrows177(0.48);
  swing.group.position.set(K177.E[0], K177.E[1], K177.zSwing);
  g.add(swing.group);

  // 이름표 5개(z 0.3) — 핀 이름표만 핀을 따라간다
  const tagRing = tag('홈 난 고리(링)', v(-1.35, 2.85, 0.3));
  const tagPin = tag('손목 핀', v(-K177.stroke, 3.42, 0.3));
  const tagArm = tag('크랭크 팔·축', v(1.3, 1.35, 0.3));
  const tagPass = tag('핀이 홈을 통과', v(1.35, 2.6, 0.3));
  const tagShaft = tag('크랭크 축(고정)', v(-1.5, 0.92, 0.3));
  g.add(tagRing, tagPin, tagArm, tagPass, tagShaft);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const A = release177(th);
    ring.rotation.z = A.beta;
    pin.position.x = A.pinX;
    tagPin.position.x = A.pinX;
    if (A.dir === 0) {
      swing.group.visible = false; // 통과·대기 중 — 크랭크가 도는 일이 없다
    } else {
      swing.group.visible = true;
      swing.set(A.dir); // +1 반시계(마 풀기) · −1 시계(다 재결합)
    }
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.35, 1.8, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const A = release177(theta);
      const P = K177.phase;
      const deg = Math.round((A.beta * 180) / Math.PI);
      const stage =
        A.u < P[0]
          ? '가·통과(→)'
          : A.u < P[0] + P[1]
            ? '나·되통과(←)'
            : A.u < P[0] + P[1] + P[2]
              ? '다·재결합'
              : A.u < P[0] + P[1] + P[2] + P[3]
                ? '라·맞물림 대기'
                : '마·풀기';
      return [
        { label: '홈 각도', value: `${deg}° (0 = 수평 풀림, −90° = 세로 맞물림)` },
        { label: '손목 핀', value: `x = ${A.pinX >= 0 ? '+' : ''}${A.pinX.toFixed(2)} (행정 1.44)` },
        { label: '단계', value: `${stage} (u ${A.u.toFixed(1)})` },
        { label: '설명', value: '고리가 수평일 때만 핀이 홈을 지나가고, 크랭크는 한 자세(돌지 않는다)' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
