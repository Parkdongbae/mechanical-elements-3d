// 074 간헐 베벨 기어 장치 — 이가 일부만 난 베벨 C 가 마주 보는 베벨 A·B 를 번갈아 서로 반대로 돌린다 (판화 74번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import { wallBearing } from '../kit/gear6';
import { rodY } from '../kit/k053';
import { shaftX } from '../kit/k061';
import { sectorBevelGear, windowAngle } from '../kit/k074';

const AY = 1.75;
const AZ = 0.28;
const dA = Math.atan(24 / 30);
const dC = Math.atan(30 / 24);
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM074(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 기어 셋 (받침 그룹이 방향을 잡고, 도는 기어 그룹에 name)
  const gearC = sectorBevelGear(30, 0.03, dC, 14, { face: 0.16, driver: true });
  gearC.name = 'gearC';
  const baseC = new THREE.Group();
  baseC.position.set(0, 1.39, AZ);
  baseC.rotation.x = -Math.PI / 2;
  baseC.add(gearC);

  const gearA = sectorBevelGear(24, 0.03, dA, 24, { face: 0.16 });
  gearA.name = 'gearA';
  const baseA = new THREE.Group();
  baseA.position.set(-0.45, AY, AZ);
  baseA.rotation.y = Math.PI / 2;
  baseA.add(gearA);

  const gearB = sectorBevelGear(24, 0.03, dA, 24, { face: 0.16 });
  gearB.name = 'gearB';
  const baseB = new THREE.Group();
  baseB.position.set(0.45, AY, AZ);
  baseB.rotation.y = -Math.PI / 2;
  baseB.add(gearB);
  g.add(baseA, baseB, baseC);

  // 축
  const shA = shaftX(-1.3, -0.3, AY, AZ);
  const shB = shaftX(0.3, 1.3, AY, AZ);
  const shC = rodY(0.6, 1.5, 0.045);
  shC.position.set(0, 0, AZ);
  // 키트 shaftX 의 안쪽 끝 표시(끝에서 0.07)는 기어 A·B 허브 구멍 속에 묻혀 기어가 그 위를 돈다 — 축받이와 기어 사이(x ∓0.75)로 옮긴다
  shA.children[2]!.position.x = 0.55; // 월드 x −0.75
  shB.children[1]!.position.x = 0.45; // 월드 x 0.75
  g.add(shA, shB, shC);

  // 축받이 (판화에 없음 — 뒤판에서 나온 팔 + 링)
  g.add(
    wallBearing(-0.95, AY, AZ, 'x', 0.052),
    wallBearing(0.95, AY, AZ, 'x', 0.052),
    wallBearing(0, 1.02, AZ, 'y', 0.052),
    wallBearing(0, 0.7, AZ, 'y', 0.052)
  );

  // 회전 화살표
  const arrC = rotArrow(0.22, true);
  arrC.position.set(0, 1.2, AZ);
  arrC.rotation.x = -Math.PI / 2;
  const arrA = rotArrow(0.2, false);
  arrA.position.set(-0.72, AY, AZ);
  arrA.rotation.y = Math.PI / 2;
  const arrB = rotArrow(0.2, true);
  arrB.position.set(0.72, AY, AZ);
  arrB.rotation.y = Math.PI / 2;
  g.add(arrC, arrA, arrB);

  g.add(
    leaderTo(tag('A (반 바퀴 돌고 쉼)', v(-1.35, 2.4, 0.3)), 'gearA'),
    leaderTo(tag('B (A 와 반대로)', v(1.35, 2.4, 0.3)), 'gearB'),
    leaderTo(tag('C 이가 일부만 난 베벨(구동)', v(1.25, 0.95, 0.4)), 'gearC'),
    leaderTo(tag('이를 깎아 낸 민 면', v(-1.15, 1.05, 0.4)), 'gearC')
  );

  let spinA = 0;
  let spinB = 0;
  let aTurn = true;
  const apply = (): void => {
    const psiC = theta + Math.PI / 15;
    const wa = windowAngle(theta, 0, Math.PI);
    const wb = windowAngle(theta, Math.PI, Math.PI);
    spinA = -1.25 * wa + Math.PI / 24;
    spinB = -1.25 * wb + Math.PI / 24;
    gearC.rotation.z = psiC;
    shC.rotation.y = psiC;
    gearA.rotation.z = spinA;
    shA.rotation.x = spinA;
    gearB.rotation.z = spinB;
    shB.rotation.x = -spinB;
    const f = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    aTurn = f < Math.PI;
    arrA.visible = aTurn;
    arrB.visible = !aTurn;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 2.7, 6.4], target: [0, 1.6, 0.2] },
    notes: () => [
      { label: '상태', value: aTurn ? 'A 가 돈다(B 는 쉼)' : 'B 가 돈다(A 는 쉼)' },
      { label: '잇수', value: 'A·B 24, C 30칸 중 14개' },
      { label: '속도비(구동 중)', value: 'C : A(B) = 1 : 1.25' },
      { label: 'C 한 바퀴에', value: 'A·B 가 각각 15이(225°)씩' },
      { label: '방향', value: 'A 와 B 는 서로 반대' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
