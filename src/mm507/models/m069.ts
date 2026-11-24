// 069 한 톱니 정지 바퀴 — 한 개의 톱니(손가락)가 있는 작은 바퀴 B 가 구동. 손가락이 닿지 않는 동안 B 의 둥근 둘레가
// A 의 두 이 사이에 앉아 A 를 잠그고, 손가락이 지나갈 때만 A 가 이 하나만큼 전진한다 (판화 69번, 설계표 069)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { K69, oneToothAngle, oneToothDriver, onePushDeg, pointedWheel } from '../kit/k069';

const DEG = Math.PI / 180;
const CA = new THREE.Vector3(-0.3, 1.5, 0.12); // A 중심
const DIR = K69.dirDeg * DEG;
const CB = new THREE.Vector3(CA.x + K69.dist * Math.cos(DIR), CA.y + K69.dist * Math.sin(DIR), 0.12); // B 중심
const REL0 = -150; // 시작 때 손가락 각(도) — 판화 자세에 가깝다
const PUSH_FROM = -48;
const PUSH_TO = 36;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM069(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 누적 각(B)
  g.add(displayStand());

  const wheelA = pointedWheel(K69.teeth, K69.rTip, K69.rRoot, { width: 0.1, holes: 6 });
  wheelA.name = 'wheelA';
  wheelA.position.copy(CA);
  const driverB = oneToothDriver(K69.rB, K69.rFinger, K69.fingerW, K69.cutHalfDeg, { width: 0.1 });
  driverB.name = 'driverB';
  driverB.position.copy(CB);
  g.add(wheelA, driverB, shaftZ(CA.x, CA.y, 0.3), shaftZ(CB.x, CB.y, 0.3));

  const arrB = rotArrow(0.45, true); // 손가락 끝(0.37) 바깥
  arrB.position.set(CB.x, CB.y, 0.17);
  const arrA = rotArrow(0.32, false); // 허브와 구멍 사이 — 구멍을 가리지 않게
  arrA.position.set(CA.x, CA.y, 0.17);
  g.add(arrB, arrA);

  g.add(
    tag('B(구동 · 이 하나)', v(CB.x + 0.75, CB.y + 0.3, 0.3)),
    tag('A(톱니 28 · 한 칸씩)', v(CA.x - 0.2, 0.3, 0.3)),
    tag('B 의 둥근 면 = 잠금', v(CB.x + 0.7, CB.y - 0.32, 0.3)),
    tag('도려 낸 곳(이가 지나감)', v(CB.x + 0.15, CB.y + 0.62, 0.3))
  );

  const fold = (total: number): { rel: number; q: number } => {
    const q = Math.floor((total + 180) / 360);
    return { rel: total - 360 * q, q };
  };
  const pose = (): void => {
    const total = REL0 + theta / DEG;
    const { rel } = fold(total);
    driverB.rotation.z = (K69.dirDeg + 180 + rel) * DEG;
    wheelA.rotation.z = -oneToothAngle(total) * DEG;
  };
  pose();

  return {
    group: g,
    view: { pos: [0.4, 2.0, 5.6], target: [0.2, 1.75, 0.1] },
    notes: () => {
      const total = REL0 + theta / DEG;
      const { rel } = fold(total);
      const a = oneToothAngle(total);
      const step = K69.stepDeg;
      const inBar = onePushDeg(rel);
      return [
        { label: '한 톱니 B : 톱니 28 A', value: '28 : 1' },
        { label: '이번 바퀴 A 전진', value: `${inBar.toFixed(1)} / ${step.toFixed(2)}°` },
        { label: '상태', value: rel > PUSH_FROM && rel < PUSH_TO ? '미는 중' : '잠금 중' },
        { label: 'A 회전수', value: `${(a / 360).toFixed(3)}바퀴` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
