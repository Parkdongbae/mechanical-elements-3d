// 188 분리 장치 변형 2 — 186 의 변형. 길고 둥글게 휜 고리 손잡이를 당기면 레버의 짧은 팔이 덮개 속에서
// 핀을 눌러 막대 끝이 들리고 핀이 갭에서 빠진다(팔 멈춤) (판화 188번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K188, arm188, eccentric188, handle188, pose188, rod188 } from '../kit/k188';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM188(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 편심(구동) + 축
  const C = K188.C;
  const eShaft = shaftZ(C[0], C[1], 0.19, 0.05);
  eShaft.name = 'eccShaft';
  const ecc = eccentric188();
  ecc.name = 'eccentric';
  ecc.position.set(C[0], C[1], K188.zRod);
  g.add(eShaft, ecc);

  // 팔(흔들 축에 박힘)
  const O = K188.O;
  const aShaft = shaftZ(O[0], O[1], 0.09, 0.05);
  aShaft.name = 'armShaft';
  const arm = arm188();
  arm.name = 'arm';
  arm.position.set(O[0], O[1], K188.zArm);
  g.add(aShaft, arm);

  // 편심 막대(갭) + 스프링 손잡이
  const rod = rod188();
  rod.name = 'eccRod';
  const handle = handle188();
  handle.name = 'handle';
  rod.add(handle);
  handle.position.set(K188.K[0], K188.K[1], K188.zLev - K188.zRod);
  g.add(rod);

  const arrow = rotArrow(0.36, true);
  arrow.position.set(C[0], C[1], 0.21);
  g.add(arrow);

  const rodTag = leaderTo(tag('편심 막대(갭)', v(-0.6, 1.0, 0.4)), rod);
  g.add(
    leaderTo(tag('편심(구동)', v(-1.6, 0.75, 0.4)), eShaft),
    leaderTo(tag('팔과 핀', v(1.15, 0.8, 0.4)), arm),
    leaderTo(tag('고리 손잡이', v(-1.7, 3.15, 0.4)), handle),
    leaderTo(tag('덮개', v(1.3, 1.95, 0.4)), rod),
    leaderTo(tag('노치 a', v(0.45, 2.85, 0.4)), handle),
    rodTag
  );

  let st = pose188(0);
  const apply = (): void => {
    st = pose188(theta);
    eShaft.rotation.z = theta;
    ecc.rotation.z = theta;
    arm.rotation.z = st.armAng;
    aShaft.rotation.z = st.armAng;
    rod.position.set(st.G[0], st.G[1], K188.zRod);
    rod.rotation.z = st.rodAng;
    handle.rotation.z = st.psi;
    rodTag.position.set(st.G[0] - 0.95, st.G[1] - 0.45, 0.4);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.8, 6.4], target: [0, 1.75, 0] },
    notes: () => [
      { label: '상태', value: st.engaged ? '맞물림 — 갭이 핀을 물고 팔을 흔든다' : st.h > 0.98 ? '분리 — 손잡이를 당겨 막대가 들림, 팔 멈춤' : '손잡이를 움직이는 중' },
      { label: '막대 들림', value: `${(st.h * K188.lift).toFixed(3)}` },
      { label: '팔 각', value: `${(st.armAng * DEG).toFixed(1)}°` },
      { label: '원리', value: '고리 손잡이를 당기면 짧은 팔이 핀을 눌러 막대 끝이 들리고 핀이 갭에서 빠진다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
