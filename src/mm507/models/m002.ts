// 002 엇걸이(교차) 벨트 — 벨트가 가운데서 X자로 교차, 두 풀리가 반대 방향 1:1 (판화 2번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, crossedBeltPath, displayStand, pulley, rotArrow, shaftZ, tag, type V2 } from '../kit';

const RA = 0.52; // 풀리 A(구동) 반지름
const RB = 0.52; // 풀리 B(종동) 반지름
const RP = 0.53; // 벨트 중심선 반지름(림 위)
const CA: V2 = [0, 2.55]; // A 중심
const CB: V2 = [0, 0.95]; // B 중심
const Z = 0.25; // 풀리·호 높이
const DZ = 0.03; // 교차점에서 가닥을 띄우는 반칸 (0.22 / 0.28)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 교차 벨트 3D 점열: 호는 z=Z 고정, 두 직선 가닥에서만 z를 선형으로 달리해 교차점에서 Z∓DZ */
function crossedPath3D(): THREE.Vector3[] {
  const seg = 24;
  const flat = crossedBeltPath(CA, RP, CB, RP, seg);
  const mid = (a: V2, b: V2): V2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const out: THREE.Vector3[] = [];
  const put = (p: V2, z: number): void => {
    out.push(v(p[0], p[1], z));
  };
  // 가닥 1(A 접점 → B 접점): 교차점에서 Z−DZ
  put(flat[0]!, Z);
  put(mid(flat[0]!, flat[1]!), Z - DZ);
  put(flat[1]!, Z);
  // B 주위 호(인덱스 2..seg)
  for (let i = 2; i <= seg; i++) put(flat[i]!, Z);
  // 가닥 2(B 접점 → A 접점): 교차점에서 Z+DZ
  put(flat[seg + 1]!, Z);
  put(mid(flat[seg + 1]!, flat[seg + 2]!), Z + DZ);
  put(flat[seg + 2]!, Z);
  // A 주위 호(인덱스 seg+3..끝)
  for (let i = seg + 3; i < flat.length; i++) put(flat[i]!, Z);
  return out;
}

export default function buildM002(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 풀리 A(구동, bronze)·B(종동, brass) — 001 과 같은 배치
  const pA = pulley(RA, { spokes: 4, driver: true });
  pA.position.set(CA[0], CA[1], Z);
  const pB = pulley(RB, { spokes: 4 });
  pB.position.set(CB[0], CB[1], Z);
  g.add(pA, pB, shaftZ(CA[0], CA[1]), shaftZ(CB[0], CB[1]));

  // 엇걸이 벨트: 교차부 두 가닥의 z 를 갈라 뚫고 지나가 보이지 않게
  const belt = new Belt(crossedPath3D(), { width: 0.13 });
  g.add(belt.group);

  // 회전 방향 화살표: A 반시계, B 시계
  const arrowA = rotArrow(0.7, true);
  arrowA.position.set(CA[0], CA[1], Z + 0.09);
  const arrowB = rotArrow(0.7, false);
  arrowB.position.set(CB[0], CB[1], Z + 0.09);
  g.add(arrowA, arrowB);
  g.add(tag('구동 풀리', v(CA[0] + 1.0, CA[1] + 0.2, Z + 0.1)), tag('종동 풀리', v(CB[0] + 1.0, CB[1] + 0.2, Z + 0.1)));

  return {
    group: g,
    notes: () => [
      { label: '회전 방향', value: '서로 반대' },
      { label: '속도비', value: '1 : 1' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 교차 벨트라 B 는 반대 방향
      theta += OMEGA * speed * dt;
      pA.rotation.z = theta;
      pB.rotation.z = -theta;
      belt.setOffset(theta * RP); // 표시가 벨트 따라 흐른다
    }
  };
}
