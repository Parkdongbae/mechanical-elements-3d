// 070 스터드 원판 간헐 회전 — 구동 바퀴 C 의 테·탭핏이 스터드 원판 A 를 한 바퀴에 스터드 하나(36°)씩 돌린다 (판화 70번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { K70, rimDriver, studDisc, studWheelAngle } from '../kit/k069';

const AX = -0.91;
const AY = 1.75;
const AZ = 0.03;
const CX = AX + K70.dist; // 0.87
const CZ = 0.34;
const CHI0 = 84; // 시작 탭핏 각(도)
const D2R = Math.PI / 180;
const PUSH_FROM = 171.5;
const PUSH_TO = 203.75;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM070(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 스터드 원판 A
  const A = studDisc(K70.plateA, K70.studs, K70.ringR, K70.studR, K70.psi0Deg, 0.22);
  A.name = 'discA';
  A.position.set(AX, AY, AZ);
  g.add(A);

  // 구동 바퀴 C (앞판 반투명 + 뒤로 뻗은 테 + 탭핏)
  const C = rimDriver(K70.rimR, K70.rimThick, K70.gapHalfDeg, K70.tipHalf, K70.baseHalf, K70.baseR, 0.195);
  C.name = 'wheelC';
  C.position.set(CX, AY, CZ);
  g.add(C);

  // 축
  g.add(shaftZ(AX, AY, 0.45), shaftZ(CX, AY, 0.5));

  // 회전 방향 화살표 — C 반시계, A 시계
  const arrC = rotArrow(0.5, true);
  arrC.position.set(CX, AY, 0.4);
  // 시계 화살표 — 빈 곳(110°)을 오른쪽 아래(−62°)에 두어 예전 Y 뒤집기 판과 같은 자리에 호가 오게
  const arrA = rotArrow(0.5, false);
  arrA.rotation.z = -0.3 * Math.PI;
  arrA.position.set(AX, AY, 0.1);
  g.add(arrC, arrA);

  g.add(
    tag('구동 바퀴 C(앞판은 비쳐 보이게)', v(1.3, 3.05, 0.5)),
    tag('탭핏 B(틈 가운데)', v(0.2, 0.5, 0.5)),
    tag('테의 틈(스터드가 드나듦)', v(-0.3, 3.05, 0.5)),
    tag('A(스터드 10개)', v(-1.5, 3.05, 0.3)),
    tag('테 바깥면이 스터드를 받쳐 잠금', v(1.2, 0.5, 0.5))
  );

  let aDeg = 0;
  let chiDeg = CHI0;
  const apply = (): void => {
    chiDeg = CHI0 + (theta / D2R);
    C.rotation.z = chiDeg * D2R;
    aDeg = studWheelAngle(chiDeg);
    A.rotation.z = -aDeg * D2R;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.5, 2.2, 6.4], target: [0, 1.85, 0.2] },
    notes: () => {
      const f = ((chiDeg % 360) + 360) % 360;
      const pushing = f >= PUSH_FROM && f <= PUSH_TO;
      const step = 360 / K70.studs;
      return [
        { label: '스터드 : 구동', value: '스터드 10개 : C 10 바퀴에 A 1 바퀴' },
        { label: '이번 바퀴 A 전진', value: `${(((aDeg % step) + step) % step).toFixed(1)} / ${step}°` },
        { label: '상태', value: pushing ? '미는 중(chi 171.5 ~ 203.75°)' : '잠김(테가 받침)' },
        { label: 'A 회전수', value: (aDeg / 360).toFixed(2) }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
