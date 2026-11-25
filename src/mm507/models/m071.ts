// 071 안쪽 테 잠금 간헐 회전 — 구동 바퀴 B 의 테 안쪽 면이 스터드 원판 C 를 잠그고, 탭핏 A 가 한 바퀴에 스터드 하나(36°)씩 민다 (판화 71번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { K71, notchedRimWheel71, pushSpan71, studAngle71, studWheel71 } from '../kit/k071';

const CX = -0.62; // 스터드 원판 C
const BX = CX + K71.dist; // 0.74 구동 바퀴 B
const AY = 1.75;
const CZ = 0.03;
const BZ = 0.34;
const CHI0 = 65.33; // theta = 0 일 때 탭핏 방향각(도)
const D2R = Math.PI / 180;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM071(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 스터드 원판 C
  const C = studWheel71(0.22);
  C.name = 'discC';
  C.position.set(CX, AY, CZ);
  g.add(C);

  // 구동 바퀴 B (반투명 앞판 + 테 두 조각 + 탭핏 A)
  const B = notchedRimWheel71();
  B.name = 'wheelB';
  B.position.set(BX, AY, BZ);
  g.add(B);

  // 축
  g.add(shaftZ(CX, AY, 0.45), shaftZ(BX, AY, 0.5));

  // 회전 화살표 — B 반시계, C 시계
  const arrB = rotArrow(0.5, true);
  arrB.position.set(BX, AY, 0.4);
  const arrC = rotArrow(0.5, false);
  arrC.position.set(CX, AY, 0.1);
  g.add(arrB, arrC);

  g.add(
    tag('구동 바퀴 B(앞판은 비쳐 보이게)', v(1.3, 3.05, 0.5)),
    tag('탭핏 A', v(0.75, 0.45, 0.5)),
    leaderTo(tag('위쪽 틈(스터드가 들어옴)', v(-0.2, 3.05, 0.5)), 'wheelB'),
    leaderTo(tag('아래쪽 틈(스터드가 나감)', v(-0.45, 0.45, 0.5)), 'wheelB'),
    tag('C(스터드 10개)', v(-1.5, 3.05, 0.3))
  );

  const [PUSH_FROM, PUSH_TO] = pushSpan71();
  let aDeg = 0;
  let chiDeg = CHI0;
  const apply = (): void => {
    chiDeg = CHI0 + theta / D2R;
    B.rotation.z = chiDeg * D2R;
    aDeg = studAngle71(chiDeg);
    C.rotation.z = -aDeg * D2R;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 2.2, 6.4], target: [0, 1.85, 0.2] },
    notes: () => {
      const f = ((chiDeg % 360) + 360) % 360;
      const pushing = f >= PUSH_FROM && f <= PUSH_TO;
      const step = 360 / K71.studs;
      return [
        { label: '스터드 : 구동', value: '스터드 10개 — B 10 바퀴에 C 1 바퀴' },
        { label: '상태', value: pushing ? '미는 중' : '잠김(테 안쪽 면이 스터드 둘을 받침)' },
        { label: '이번 바퀴 C 전진', value: `${(((aDeg % step) + step) % step).toFixed(1)} / ${step}°` },
        { label: 'B 회전수', value: (chiDeg / 360).toFixed(2) }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
