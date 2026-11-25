// 134 드럼과 밧줄 — 고른 원운동을 드럼에 한 바퀴 감은 밧줄로 직선 운동으로 (판화 134번)
// 드럼이 제자리에서 ±80° 왕복하면 줄이 풀렸다 감기며 미끄럼대가 곧게 왕복한다.
// 모든 자세는 누적 theta 의 닫힌 식 swing134 에서 절대로 다시 계산한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { K134, RC134, ROPE_Y134, carriageRail134, drumRopePath134, ropeCarriage134, ropeDrum134, swing134 } from '../kit/k134';

const DEG = Math.PI / 180;

export default function buildM134(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let phi = 0;
  let dir: 1 | -1 = 1;
  let x = 0;

  g.add(displayStand());

  // 축: 뒤판 보스에서 허브 앞(끝 너트)까지
  g.add(shaftZ(K134.CX, K134.CY, 0.36, 0.05));

  // 드럼(구동): 원점 = 축 위·통 폭 가운데
  const drum = ropeDrum134();
  drum.name = 'drum';
  drum.position.set(K134.CX, K134.CY, K134.ZD);
  g.add(drum);

  // 밧줄: 매 프레임 경로를 다시 잡는다(나선은 그대로, 곧은 두 가닥 길이만 변함)
  const rope = new Rope(K134.rho);
  rope.group.name = 'rope';
  g.add(rope.group);

  // 미끄럼대(판화에 없음 — 줄 양 끝이 묶이는 대): 원점 = 막대 윗면 가운데
  const carriage = ropeCarriage134();
  carriage.name = 'carriage';
  carriage.position.set(0, ROPE_Y134 - K134.postH, K134.ZD);
  g.add(carriage);

  // 레일(고정): 원점 = 윗면 가운데
  const rail = carriageRail134(K134.ZD);
  rail.name = 'rail';
  rail.position.set(0, ROPE_Y134 - K134.postH - K134.barH, K134.ZD);
  g.add(rail);

  // 회전 화살표 둘 — dir 에 따라 하나만 보인다(살 안쪽, 줄을 가리지 않음)
  const arrowCcw = rotArrow(0.3, true);
  const arrowCw = rotArrow(0.3, false);
  for (const a of [arrowCcw, arrowCw]) a.position.set(K134.CX, K134.CY, 0.42);
  g.add(arrowCcw, arrowCw);

  // 이름표 4개 — 미끄럼대 이름표만 따라간다
  g.add(leaderTo(tag('드럼(구동 — 고른 속도로 돈다)', new THREE.Vector3(-1.35, 2.55, 0.3)), drum));
  g.add(tag('밧줄(드럼에 꼭 한 바퀴 감김)', new THREE.Vector3(1.35, 2.2, 0.3)));
  const tagCarriage = tag('미끄럼대(줄에 끌려 곧게 간다)', new THREE.Vector3(0, 0.62, 0.35));
  g.add(tagCarriage);
  g.add(tag('걸림쇠(줄이 옆으로 벗어나지 않게)', new THREE.Vector3(-1.45, 1.95, 0.3)));

  function apply(): void {
    const r = swing134(theta);
    phi = r.phi;
    dir = r.dir;
    x = r.x;
    drum.rotation.z = phi;
    carriage.position.x = x;
    rope.setPath(drumRopePath134(x - K134.HL, x + K134.HL));
    arrowCcw.visible = dir === 1;
    arrowCw.visible = dir === -1;
    tagCarriage.position.x = x;
  }

  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0.1] },
    notes: () => [
      { label: '드럼 각', value: `${Math.abs(phi / DEG).toFixed(1)}° ${dir === 1 ? '반시계 → 줄이 오른쪽으로' : '시계 → 왼쪽으로'}` },
      { label: '미끄럼대 변위', value: `x = ${(x >= 0 ? '+' : '−')}${Math.abs(x).toFixed(3)} (±0.742, 행정 1.484)` },
      { label: '줄이 간 거리', value: `반지름 ${RC134.toFixed(2)} × 돈 각 ${Math.abs(phi).toFixed(2)} rad = ${(RC134 * Math.abs(phi)).toFixed(3)}` },
      { label: '감긴 줄', value: '한 바퀴 그대로 — 한쪽에서 감기는 만큼 반대쪽에서 풀린다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
