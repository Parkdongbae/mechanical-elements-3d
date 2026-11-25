// 159 줄과 도르래 발판 — 158 의 변형: 연결봉 대신 줄이 도르래 위를 넘어 크랭크 핀을 당긴다(판화 159번)
//  설계표 docs/mm507-sheets/159.md · 부품은 전부 kit/k158(공용) + 공용 키트(배치·treadle159 결과 대입만 한다)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, pulley, rotArrow, ropeAround, shaftZ, tag } from '../kit';
import { K159, bellStandard158, cordEye158, cordLength159, cordLoop158, crankDisc158, pivotPin158, treadle159, treadleBar158 } from '../kit/k158';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

// 층(앞뒤 차례, 판화대로): 받침대 둘(맨 뒤) → 원판 → 발판 막대 → 줄·도르래·고리·눈 볼트(맨 앞, 한 평면)
const ZP = -0.13;
const ZB = 0.15;

export default function buildM159(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 왼쪽 받침대(주철, 고정) — 받침판 위 구멍 중심이 원판 축 O. 머리는 원판 뒤에 가려진다(판화의 점선 자리)
  const pedestal = bellStandard158(1.36, {
    topR: 0.25, waist: 0.25, foot: 0.52, flareH: 0.52, thick: 0.14, bore: 0.062,
    bossR: 0.1, bossLen: 0.02, base: [-0.6, 0.47], baseH: 0.09, baseZ: [-0.11, 0.13]
  });
  pedestal.name = 'pedestal';
  pedestal.position.set(K159.O[0], K159.floor, ZP);
  g.add(pedestal);

  // 크랭크 원판(황동) — 축이 받침대 구멍을 지나고 child crankPin(z = 줄 평면)에 줄 고리가 걸린다
  const disc = crankDisc158(K159.R, K159.crank, { shaftBack: -0.22, shaftFront: 0.08, pinTop: 0.31, pinZ: ZB });
  disc.name = 'disc';
  disc.position.set(K159.O[0], K159.O[1], 0);
  g.add(disc);

  // 도르래(황동, 민판·V홈) — 줄을 따라 앞뒤로 돈다. 줄 중심선 반지름 rc = K159.rc
  const pul = pulley(K159.rp, { width: K159.wp, spokes: 0, grooved: true });
  pul.name = 'pulley';
  pul.position.set(K159.C[0], K159.C[1], ZB);
  g.add(pul);

  // 도르래 축(고정, 판화에 없는 보충) — 뒤판 보스에서 나와 너트까지(너트 z ≤ 0.27, 도르래 앞면 0.21 보다 앞)
  const axle = shaftZ(K159.C[0], K159.C[1], 0.27, 0.045);
  axle.name = 'pulleyAxle';
  g.add(axle);

  // 발판 막대(강철) — 원점 = 받침 핀 Q, 로컬 −X 로 뻗는다. rotation.z = down(왼쪽 끝이 내려간 각)
  const treadle = treadleBar158(K159.bar, { h: K159.barH, depth: 0.1 });
  treadle.name = 'treadle';
  treadle.position.set(K159.Q[0], K159.Q[1], ZB);
  g.add(treadle);

  // 눈 볼트 — 발판의 child 로 막대와 같이 기울어진다. 표식 child cordEye = 줄 매듭 자리
  const eye = cordEye158(K159.barH, K159.up);
  eye.name = 'cordEye';
  eye.position.set(-K159.a, 0, 0);
  treadle.add(eye);

  // 오른쪽 받침대(주철, 고정) — 받침 핀을 받친다
  const pivotStd = bellStandard158(0.73, {
    topR: 0.15, waist: 0.15, foot: 0.44, flareH: 0.3, thick: 0.14, bore: 0.044,
    base: [-0.42, 0.46], baseH: 0.09, baseZ: [-0.11, 0.36]
  });
  pivotStd.name = 'pivotStd';
  pivotStd.position.set(K159.Q[0], K159.floor, ZP);
  g.add(pivotStd);

  // 받침 핀(고정) — 발판 허브와 받침대 구멍을 함께 꿴다
  const pin = pivotPin158(0.08, 0.28, 0.04);
  pin.name = 'pivotPin';
  pin.position.set(K159.Q[0], K159.Q[1], 0);
  g.add(pin);

  // 줄(둥근 로프) — 매 프레임 ropeAround 로 다시 건다(점 개수 일정)
  const cord = new Rope(K159.rho);
  cord.group.name = 'cord';
  g.add(cord.group);

  // 핀 줄 고리 — 크랭크 핀을 따라간다(핀 둘레를 자유롭게 감는 눈)
  const loop = cordLoop158(0.04);
  loop.name = 'loop';
  g.add(loop);

  // 회전 방향 화살표(반시계) — 핀 끝(0.31)·발판 막대(0.20)보다 앞
  const arrow = rotArrow(0.3, true);
  arrow.position.set(K159.O[0], K159.O[1], 0.34);
  g.add(arrow);

  // 이름표 4개 — 발판·줄은 움직이는 부품을 따라간다
  const tagDisc = tag('크랭크 원판', v(-1.45, 2.6, 0.3));
  const tagPulley = tag('도르래', v(0.62, 3.1, 0.3));
  const tagTreadle = tag('발판(구동)', v(0, 0, 0.4));
  const tagCord = tag('줄', v(0, 0, 0.35));
  g.add(tagDisc, tagPulley, tagTreadle, tagCord);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const s = treadle159(th);
    disc.rotation.z = s.a;
    pul.rotation.z = s.pulley;
    treadle.rotation.z = s.down;
    loop.position.set(s.pin[0], s.pin[1], ZB);
    // 줄: 핀 고리 → 도르래(왼쪽 위에서 시계 방향으로 넘음) → 발판 매듭
    const pts = ropeAround({ p: s.pin, w: ZB }, [{ c: K159.C, r: K159.rc, ccw: false, w: ZB }], { p: s.end, w: ZB });
    cord.setPath(pts);
    // 발판 왼쪽 끝(받침 핀에서 bar 만큼 −X, down 만큼 내려간 곳)
    const tipX = K159.Q[0] - K159.bar * Math.cos(s.down);
    const tipY = K159.Q[1] - K159.bar * Math.sin(s.down);
    tagTreadle.position.set(tipX - 0.15, tipY + 0.3, 0.4);
    // 줄 이름표: 수직 가닥 가운데(도르래 오른쪽 접점 = 경로의 마지막 호 점)
    const exit = pts[pts.length - 2]!;
    tagCord.position.set((exit.x + s.end[0]) / 2 + 0.45, (s.end[1] + K159.C[1]) / 2, 0.35);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const s = treadle159(theta);
      return [
        { label: '원판 회전수', value: `${(theta / (Math.PI * 2)).toFixed(2)}회` },
        { label: '발판 기울기', value: `${(s.down * DEG).toFixed(1)}°(−16° ~ 15°)` },
        { label: '도르래 감긴 각', value: `${s.wrapDeg.toFixed(0)}°(138° ~ 157°)` },
        { label: '줄 온 길이', value: `${cordLength159().toFixed(2)}(불변)` },
        { label: '발판 한 번 왕복', value: '= 원판 한 바퀴' },
        { label: '도르래', value: '줄을 따라 앞뒤로 — 누적 회전 없음' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
