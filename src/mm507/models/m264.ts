// 264 이 수가 하나 다른 웜휠 — 지름이 같고 이 수가 하나(30·31 개) 다른 웜휠 둘이 같은 웜 하나에
// 함께 물려 거의 같이 돈다. 빨간 바늘(30)이 파란 바늘(31)보다 조금씩 앞서 벌어짐이 쌓인다(웜 930 바퀴에 한 바퀴).
// 설계표 docs/mm507-sheets/264.md — 휠 축을 깊이(Z)로 두고 오른쪽 앞 위에서 본다.
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { displayStand, leaderTo, pulley, rod, rotArrow, shaftZ, tag, wormScrew, wormWheel } from '../kit';
import { wallBearing } from '../kit/gear6';
import { K264, needle264, state264 } from '../kit/k264';
import { brass, darkSteel, steel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM264(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 휠 축(뒤판 보스, φ₂ 로 돎) — 칼라·바늘 31 이 함께 돈다
  const shaft31 = shaftZ(K264.O[0], K264.O[1], 0.221, 0.04);
  shaft31.name = 'shaft31';
  g.add(shaft31);
  // 칼라: 보스 앞면(−0.20)에서 휠 31 허브 뒷면(−0.048) 앞 0.001 까지
  const collarGeo = lathe(tubeProfile(0.041, 0.065, -0.2, -0.049, 0.004), 32);
  collarGeo.rotateX(Math.PI / 2);
  shaft31.add(mesh(collarGeo, darkSteel()));

  // 휠 31(뒤, steel 로 칠함): 키트의 노란 표시만 남기고 전부 steel
  const wheel31 = wormWheel(K264.Z2, 0.0387097, { width: 0.06, spokes: 6, tanLead: K264.TAN_LEAD });
  wheel31.name = 'wheel31';
  wheel31.position.set(K264.O[0], K264.O[1], 0.0);
  const body31 = wheel31.children[0];
  if (body31) body31.name = 'wheel31Body';
  wheel31.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh === true && !(m.material instanceof THREE.MeshPhysicalMaterial)) m.material = steel();
  });
  g.add(wheel31);
  // 휠 31 안 관: 키트 허브 구멍(0.084)을 메워 축과의 틈 0.001
  const bush31Geo = lathe(tubeProfile(0.041, 0.0842, -0.048, 0.048, 0.003), 32);
  bush31Geo.rotateX(Math.PI / 2);
  wheel31.add(mesh(bush31Geo, steel()));

  // 휠 30(앞, brass) — 축 위에서 헐겁게
  const wheel30 = wormWheel(K264.Z1, 0.04, { width: 0.06, spokes: 6, tanLead: K264.TAN_LEAD });
  wheel30.name = 'wheel30';
  wheel30.position.set(K264.O[0], K264.O[1], 0.1);
  const body30 = wheel30.children[0];
  if (body30) body30.name = 'wheel30Body';
  g.add(wheel30);
  // 휠 30 안 관(세계 z 0.052 ~ 0.150)
  const bush30Geo = lathe(tubeProfile(0.041, 0.0842, -0.048, 0.05, 0.003), 32);
  bush30Geo.rotateX(Math.PI / 2);
  wheel30.add(mesh(bush30Geo, brass()));

  // 바늘 30(빨강, 휠 30 과 함께) — 허브 세계 z 0.150 ~ 0.164
  const needle30 = needle264(0.415, 0xd2552e, 0.05, 0.064, 0.041, 0.07);
  needle30.name = 'needle30';
  needle30.rotation.z = Math.PI / 2 - K264.C1;
  wheel30.add(needle30);
  // 바늘 31(파랑, 휠 축과 함께) — 허브 z 0.169 ~ 0.185, 뒤 너트가 앞을 막음
  const needle31 = needle264(0.485, 0x2e6fd2, 0.169, 0.185, 0.04, 0.065);
  needle31.name = 'needle31';
  needle31.rotation.z = Math.PI / 2 - K264.C2;
  shaft31.add(needle31);

  // 웜 묶음(위치 (0, 2.02, 0.05), rotation.x = θ)
  const wormG = new THREE.Group();
  wormG.position.set(0, K264.WORM_Y, K264.ZW);
  g.add(wormG);
  const worm = wormScrew(0.0708, 0.1593, K264.PITCH, 0.5, { driver: true });
  worm.name = 'worm';
  wormG.add(worm);
  // 웜 축(steel): 로컬 x −0.75 ~ 0.80
  const wsGeo = lathe(rodProfile(0.045, -0.75, 0.8, 0.008, 0.008), 32);
  wsGeo.rotateZ(-Math.PI / 2);
  wormG.add(mesh(wsGeo, steel()));
  // 멈춤 고리 둘: 축받이 보스 끝(±0.62) 바깥 0.005
  const ringSpans: ReadonlyArray<readonly [number, number]> = [
    [-0.66, -0.625],
    [0.625, 0.66]
  ];
  for (const [x0, x1] of ringSpans) {
    const ringGeo = lathe(tubeProfile(0.045, 0.065, x0, x1, 0.004), 32);
    ringGeo.rotateZ(-Math.PI / 2);
    wormG.add(mesh(ringGeo, darkSteel()));
  }
  // 손바퀴(구동) — 로컬 x 0.78, 축 끝 0.80 이 허브 속
  const hwG = new THREE.Group();
  hwG.rotation.y = Math.PI / 2;
  hwG.position.set(0.78, 0, 0);
  wormG.add(hwG);
  const handWheel = pulley(0.14, { flat: true, width: 0.04, spokes: 4, hub: 0.045, driver: true });
  handWheel.name = 'handWheel';
  hwG.add(handWheel);
  // 손잡이: 반지름 0.11 핀(휠 림 바깥면 x 0.80 에 닿게) + 구 머리
  wormG.add(rod(v(0.8, 0.11, 0), v(0.92, 0.11, 0), 0.016));
  const knob = mesh(new THREE.SphereGeometry(0.026, 16, 12), steel());
  knob.position.set(0.92, 0.11, 0);
  wormG.add(knob);

  // 웜 축받이 둘(뒤판 벽걸이, 구멍 0.05)
  const bearingWL = wallBearing(-0.55, K264.WORM_Y, K264.ZW, 'x', 0.05);
  bearingWL.name = 'bearingWL';
  const bearingWR = wallBearing(0.55, K264.WORM_Y, K264.ZW, 'x', 0.05);
  bearingWR.name = 'bearingWR';
  g.add(bearingWL, bearingWR);

  // 회전 화살표: 웜 회전(+X 에서 보아 반시계)
  const arrowG = new THREE.Group();
  arrowG.rotation.y = Math.PI / 2;
  arrowG.position.set(0.98, K264.WORM_Y, K264.ZW);
  arrowG.add(rotArrow(0.2, true));
  g.add(arrowG);

  // 이름표 5개(이름표 표대로, leaderTo 로 대상 직접 지정)
  g.add(
    leaderTo(tag('웜(구동)', v(0.0, 2.65, 0.4)), 'worm'),
    leaderTo(tag('웜휠 30', v(-1.75, 0.75, 0.4)), 'wheel30Body'),
    leaderTo(tag('웜휠 31', v(1.6, 1.5, -0.1)), 'wheel31Body'),
    leaderTo(tag('바늘 30', v(-1.45, 2.15, 0.5)), 'needle30'),
    leaderTo(tag('바늘 31', v(1.25, 0.62, 0.5)), 'needle31')
  );

  return {
    group: g,
    view: { pos: [3.8, 3.0, 3.4], target: [0.0, 1.45, 0.05] },
    notes: () => [
      { label: '웜', value: '바퀴 수(θ/2π)' },
      { label: '휠 30 / 휠 31', value: '각 (°) — 웜 1바퀴에 12° / 11.61°' },
      { label: '두 바늘 차이', value: `Δ = θ/930 = ${state264(t).diffDeg.toFixed(2)}°` },
      { label: '원리', value: '웜 30 × 31 = 930 바퀴에 휠 30 이 한 바퀴 앞선다(원문 100 × 101 = 10,100 바퀴)' },
      { label: '모델 메모', value: '보이게 잇수를 30·31 로 줄임. 같은 지름이라 피치가 1.6% 달라 이 틈으로 받는다' }
    ],
    update(dt: number, speed: number): void {
      t += speed * dt;
      const s = state264(t);
      wormG.rotation.x = s.theta;
      wheel30.rotation.z = s.phi1;
      wheel31.rotation.z = s.phi2;
      shaft31.rotation.z = s.phi2;
    }
  };
}
