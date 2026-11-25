// 172 달걀형 타원 운동 — 크랭크·막대·흔들이 4절 링크, 막대 위 한 점이 달걀 모양으로 돈다 (판화 172번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, markPin, rotArrow, shaftZ, tag } from '../kit';
import { K172, cylZ172, eggDots172, four172, linkPlate172 } from '../kit/k172';
import { bronze } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM172(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  g.add(shaftZ(K172.O1[0], K172.O1[1], 0.2, 0.045), shaftZ(K172.O2[0], K172.O2[1], 0.2, 0.045));

  // 크랭크(구동): 원점 = O1, 끝에 핀 pinA
  const crank = new THREE.Group();
  crank.name = 'crank';
  const crankPlate = linkPlate172(K172.a, 0.06, K172.holeR, bronze());
  crankPlate.position.z = K172.zCrank + K172.thick / 2;
  crank.add(crankPlate);
  const pinA = new THREE.Group();
  pinA.name = 'pinA';
  pinA.position.set(K172.a, 0, 0);
  pinA.add(cylZ172(K172.pinR, K172.zCrank - 0.02, K172.zRod + K172.thick + 0.02), cylZ172(0.05, K172.zRod + K172.thick + 0.02, K172.zRod + K172.thick + 0.04));
  markPin(pinA);
  crank.add(pinA);
  crank.position.set(K172.O1[0], K172.O1[1], 0);
  g.add(crank);

  // 막대(커플러): 원점 = A
  const rod = new THREE.Group();
  rod.name = 'rod';
  const rodPlate = linkPlate172(K172.L, 0.06, K172.holeR);
  rodPlate.position.z = K172.zRod + K172.thick / 2;
  rod.add(rodPlate);
  const tracer = new THREE.Group();
  tracer.name = 'tracer';
  tracer.position.set(K172.s * K172.L, 0, 0);
  tracer.add(cylZ172(0.035, K172.zRod + K172.thick - 0.005, K172.zRod + K172.thick + 0.05, bronze()));
  rod.add(tracer);
  g.add(rod);

  // 흔들이: 원점 = O2, 끝에 핀 pinB
  const rocker = new THREE.Group();
  rocker.name = 'rocker';
  const rockPlate = linkPlate172(K172.c, 0.06, K172.holeR, bronze());
  rockPlate.position.z = K172.zCrank + K172.thick / 2;
  rocker.add(rockPlate);
  const pinB = new THREE.Group();
  pinB.name = 'pinB';
  pinB.position.set(K172.c, 0, 0);
  pinB.add(cylZ172(K172.pinR, K172.zCrank - 0.02, K172.zRod + K172.thick + 0.02), cylZ172(0.05, K172.zRod + K172.thick + 0.02, K172.zRod + K172.thick + 0.04));
  markPin(pinB);
  rocker.add(pinB);
  rocker.position.set(K172.O2[0], K172.O2[1], 0);
  g.add(rocker);

  g.add(eggDots172(0.3));

  const arrow = rotArrow(0.32, true);
  arrow.position.set(K172.O1[0], K172.O1[1], 0.34);
  g.add(arrow);

  const rodTag = leaderTo(tag('막대(커플러)', v(0.3, 1.0, 0.35)), 'rod');
  g.add(
    leaderTo(tag('구동 크랭크', v(-1.55, 2.75, 0.35)), 'crank'),
    rodTag,
    leaderTo(tag('흔들이', v(1.55, 0.5, 0.35)), 'rocker'),
    leaderTo(tag('달걀 궤적(점선)', v(-0.2, 2.5, 0.35)), 'egg')
  );

  let cur = four172(0);
  const apply = (): void => {
    cur = four172(theta);
    crank.rotation.z = cur.phi;
    rod.position.set(cur.A[0], cur.A[1], 0);
    rod.rotation.z = cur.rodAng;
    rocker.rotation.z = cur.rockAng;
    rodTag.position.set(cur.P[0], cur.P[1] - 0.6, 0.35);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '크랭크 각', value: `${(((cur.phi * DEG) % 360) + 360) % 360 | 0}°` },
      { label: '흔들이 각', value: `${(cur.rockAng * DEG).toFixed(1)}°` },
      { label: '표시점 궤적', value: '달걀 모양 — 가로 1.13 × 세로 0.80' },
      { label: '막대 길이', value: `${K172.L} (항상 일정)` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.7, 6.4], target: [0, 1.6, 0] }
  };
}
