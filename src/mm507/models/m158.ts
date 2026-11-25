// 158 발판과 원판 — 발판(트레들)의 왕복 곡선 운동이 크랭크 원판에 원운동을 준다(4절 링크, 판화 158번)
//  설계표 docs/mm507-sheets/158.md · 부품은 전부 kit/k158 (배치·treadle158 결과 대입만 한다)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { K158, bellStandard158, crankDisc158, eyeRod158, pivotPin158, rodLug158, treadle158, treadleBar158 } from '../kit/k158';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

// 층(앞뒤 차례, 판화대로): 받침대(맨 뒤) → 원판 → 발판 막대 → 연결봉(맨 앞)
const ZP = -0.13;
const ZB = 0.15;
const ZR = 0.255;
const ZL = 0.25;

export default function buildM158(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 종 모양 받침대(주철, 고정) — 받침판 위 구멍 중심이 원판 축 O
  const pedestal = bellStandard158(1.57, {
    topR: 0.25, waist: 0.25, foot: 0.52, flareH: 0.55, thick: 0.14, bore: 0.062,
    bossR: 0.1, bossLen: 0.02, base: [-0.66, 1.21], baseH: 0.09, baseZ: [-0.11, 0.46]
  });
  pedestal.name = 'pedestal';
  pedestal.position.set(K158.O[0], K158.floor, ZP);
  g.add(pedestal);

  // 크랭크 원판(황동) — 축이 받침대 구멍을 지나고 child crankPin 이 봉에 걸린다
  const disc = crankDisc158(K158.R, K158.crank, { shaftBack: -0.22, shaftFront: 0.08, pinTop: 0.3, pinZ: ZR });
  disc.name = 'disc';
  disc.position.set(K158.O[0], K158.O[1], 0);
  g.add(disc);

  // 연결봉 — 원점(큰 눈)을 크랭크 핀에 둔다
  const rod = eyeRod158(K158.rod);
  rod.name = 'rod';
  g.add(rod);

  // 발판 막대 — 원점 = 받침 핀 Q, 로컬 −X 로 뻗는다. 밑에 봉 핀 귀(child treadlePin)
  const treadle = treadleBar158(K158.bar, { h: K158.barH, depth: 0.1 });
  treadle.name = 'treadle';
  treadle.position.set(K158.Q[0], K158.Q[1], ZB);
  const lug = rodLug158(K158.e, 0.1, 0.145, ZR - ZB);
  lug.position.set(-K158.a, -K158.e, 0);
  treadle.add(lug);
  g.add(treadle);

  // 받침 귀(고정) — 받침판 위에서 발판 막대 끝을 앞쪽에서 가린다
  const lugStd = bellStandard158(0.23, { topR: 0.19, thick: 0.08, bore: 0.042 });
  lugStd.name = 'lug';
  lugStd.position.set(K158.Q[0], 0.27, ZL);
  g.add(lugStd);

  // 받침 핀(고정) — 발판 허브와 받침 귀를 함께 꿴다
  const pin = pivotPin158(0.09, 0.3);
  pin.position.set(K158.Q[0], K158.Q[1], 0);
  g.add(pin);

  // 회전 방향 화살표(반시계) — 봉 핀 끝(0.30)보다 앞
  const arrow = rotArrow(0.3, true);
  arrow.position.set(K158.O[0], K158.O[1], 0.36);
  g.add(arrow);

  // 이름표 4개 — 연결봉·발판은 움직이는 부품을 따라간다
  const tagDisc = tag('크랭크 원판', v(1.1, 2.65, 0.3));
  const tagRod = tag('연결봉', v(0, 0, 0.4));
  const tagTreadle = tag('발판(구동)', v(0, 0, 0.4));
  const tagPin = tag('받침 핀', v(1.6, 0.95, 0.45));
  g.add(tagDisc, tagRod, tagTreadle, tagPin);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const s = treadle158(th);
    disc.rotation.z = s.a;
    rod.position.set(s.pin[0], s.pin[1], ZR);
    rod.rotation.z = s.rodAngle;
    treadle.rotation.z = -s.tilt;
    // 발판 왼쪽 끝(받침 핀에서 bar 만큼 −X, tilt 만큼 올라간 곳)
    const endX = K158.Q[0] - K158.bar * Math.cos(s.tilt);
    const endY = K158.Q[1] + K158.bar * Math.sin(s.tilt);
    tagRod.position.set((s.pin[0] + s.T[0]) / 2 - 0.55, (s.pin[1] + s.T[1]) / 2 + 0.05, 0.4);
    tagTreadle.position.set(Math.max(endX - 0.2, -1.75), endY + 0.28, 0.4);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.45, 0] },
    notes: () => {
      const s = treadle158(theta);
      return [
        { label: '크랭크 반지름', value: '0.66(원판 반지름의 0.83배)' },
        { label: '연결봉', value: '핀 사이 0.945' },
        { label: '발판 기울기', value: `${(s.tilt * DEG).toFixed(1)}°(−3° ~ 46°)` },
        { label: '원판 회전수', value: `${(theta / (Math.PI * 2)).toFixed(2)}회` },
        { label: '발판 한 번 왕복', value: '= 원판 한 바퀴' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
