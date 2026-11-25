// 187 분리 장치 변형 1 — 186 의 변형. 편심 막대 끝의 갭이 팔의 핀을 문다. 막대 위 귀에 걸린 집게 손잡이를 들어 올리면
// 머리 아랫면의 캠이 핀을 눌러 막대가 들리고 핀이 갭에서 빠진다(팔 멈춤) (판화 187번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K187, arm187, eccentric187, handle187, pose187, rod187 } from '../kit/k187';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM187(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 편심(구동) + 축
  const C = K187.C;
  const eShaft = shaftZ(C[0], C[1], 0.19, 0.05);
  eShaft.name = 'eccShaft';
  const ecc = eccentric187();
  ecc.name = 'eccentric';
  ecc.position.set(C[0], C[1], K187.zRod);
  g.add(eShaft, ecc);

  // 팔(흔들 축에 박힘)
  const O = K187.O;
  const aShaft = shaftZ(O[0], O[1], 0.09, 0.05);
  aShaft.name = 'armShaft';
  const arm = arm187();
  arm.name = 'arm';
  arm.position.set(O[0], O[1], K187.zArm);
  g.add(aShaft, arm);

  // 편심 막대(갭) + 스프링 손잡이
  const rod = rod187();
  rod.name = 'eccRod';
  const handle = handle187();
  handle.name = 'handle';
  rod.add(handle);
  handle.position.set(K187.K[0], K187.K[1], K187.zLev - K187.zRod);
  g.add(rod);

  const arrow = rotArrow(0.36, true);
  arrow.position.set(C[0], C[1], 0.21);
  g.add(arrow);

  const rodTag = leaderTo(tag('편심 막대(갭)', v(-0.9, 1.25, 0.4)), rod);
  const handleTag = leaderTo(tag('집게 손잡이(캠 머리)', v(1.45, 1.15, 0.4)), handle);
  g.add(
    leaderTo(tag('편심(구동)', v(-1.65, 2.35, 0.4)), eShaft),
    leaderTo(tag('팔과 핀', v(-0.85, 2.75, 0.4)), arm),
    rodTag,
    handleTag
  );

  let st = pose187(0);
  const apply = (): void => {
    st = pose187(theta);
    eShaft.rotation.z = theta;
    ecc.rotation.z = theta;
    arm.rotation.z = st.armAng;
    aShaft.rotation.z = st.armAng;
    rod.position.set(st.G[0], st.G[1], K187.zRod);
    rod.rotation.z = st.rodAng;
    handle.rotation.z = st.psi;
    rodTag.position.set(st.G[0] - 0.9, st.G[1] - 0.55, 0.4);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.8, 6.4], target: [0, 1.75, 0] },
    notes: () => [
      { label: '상태', value: st.engaged ? '맞물림 — 갭이 핀을 물고 팔을 흔든다' : st.h > 0.98 ? '분리 — 손잡이를 들어 막대가 들림, 팔 멈춤' : '손잡이를 움직이는 중' },
      { label: '막대 들림', value: `${(st.h * K187.lift).toFixed(3)}` },
      { label: '팔 각', value: `${(st.armAng * DEG).toFixed(1)}°` },
      { label: '원리', value: '손잡이를 들면 머리 캠이 핀을 눌러 막대 끝이 들리고 핀이 갭에서 빠진다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
