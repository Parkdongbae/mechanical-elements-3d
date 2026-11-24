// 082 두 발판으로 돌리는 래칫 — 두 발판 D 를 번갈아 밟으면 이음대·흔들 팔 B·미는 폴을 거쳐 래칫 바퀴 A 가 거의 끊김 없이 반시계로 돈다.
// 두 발판은 풀리 C 를 넘는 줄로 묶여 한쪽을 밟으면 다른 쪽이 올라온다 (판화 82번, 설계표 docs/mm507-sheets/082.md)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, pulley, ropeAround, rotArrow, shaftZ, tag } from '../kit';
import {
  K82,
  eyeRod82,
  k82State,
  pulleyFrame82,
  pushPawl82,
  ratchetWheel82,
  rockArm82,
  treadle82,
  treadlePedestal82,
  type K82State
} from '../kit/k080';

const D2R = Math.PI / 180;
const WX = K82.W[0];
const WY = K82.W[1];
const FX = K82.F[0];
const FY = K82.F[1];
/** 받침 윗면 높이 */
const BASE_Y = 0.18;
/** 풀리 C 의 자리(틀 가운데 x, 축 높이, 깊이) */
const PX = K82.pulleyX;
const PY = K82.pulleyY;
const PZ = 0.25;
/** 앞뒤 층 */
const Z_WHEEL = 0.25;
const Z_ARM1 = 0.37;
const Z_ARM2 = 0.13;
const Z_PAWL1 = 0.285;
const Z_PAWL2 = 0.215;
const Z_TR1 = 0.372;
const Z_TR2 = 0.128;
const Z_ROD1 = 0.42;
const Z_ROD2 = 0.08;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM082(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 래칫 바퀴 A + 축(뒤판에서 받침)
  const wheelA = ratchetWheel82(0.14);
  wheelA.name = 'wheelA';
  wheelA.position.set(WX, WY, Z_WHEEL);
  g.add(wheelA, shaftZ(WX, WY, 0.45, 0.05));

  // 흔들 팔 B 둘(바퀴 축에 헐겁게) — 위 팔이 앞, 아래 팔이 뒤
  const arm1 = rockArm82(1, -0.115, 0.065);
  arm1.name = 'arm1';
  arm1.position.set(WX, WY, Z_ARM1);
  (arm1.userData.rodPin as THREE.Object3D).name = 'armPin1';
  const arm2 = rockArm82(2, 0.115, -0.065);
  arm2.name = 'arm2';
  arm2.position.set(WX, WY, Z_ARM2);
  (arm2.userData.rodPin as THREE.Object3D).name = 'armPin2';
  g.add(arm1, arm2);

  // 미는 폴 둘(팔 끝 핀에 매달려 바퀴 폭의 앞 절반·뒤 절반에 걸림)
  const pawl1 = pushPawl82(1);
  pawl1.name = 'pawl1';
  const pawl2 = pushPawl82(2);
  pawl2.name = 'pawl2';
  g.add(pawl1, pawl2);

  // 발판 D 둘 + 받침축 + 받침대
  const treadle1 = treadle82(1, 0.063);
  treadle1.name = 'treadle1';
  treadle1.position.set(FX, FY, Z_TR1);
  (treadle1.userData.rodPin as THREE.Object3D).name = 'treadlePin1';
  (treadle1.userData.eye as THREE.Object3D).name = 'treadleEye1';
  const treadle2 = treadle82(2, -0.063);
  treadle2.name = 'treadle2';
  treadle2.position.set(FX, FY, Z_TR2);
  (treadle2.userData.rodPin as THREE.Object3D).name = 'treadlePin2';
  (treadle2.userData.eye as THREE.Object3D).name = 'treadleEye2';
  const pedestal = treadlePedestal82(FY - BASE_Y);
  pedestal.position.set(FX, BASE_Y, 0.25);
  g.add(treadle1, treadle2, shaftZ(FX, FY, 0.45, 0.035), pedestal);

  // 이음대 둘(긴 것: 위 팔 귀 ↔ 앞 발판, 짧은 것: 아래 팔 귀 ↔ 뒤 발판)
  const rod1 = eyeRod82(K82.len1);
  rod1.name = 'rod1';
  const rod2 = eyeRod82(K82.len2);
  rod2.name = 'rod2';
  g.add(rod1, rod2);

  // 풀리 틀 C + 옆으로 누운 풀리(축 X)
  const frameC = pulleyFrame82(PY - BASE_Y);
  frameC.name = 'frameC';
  frameC.position.set(PX, BASE_Y, PZ);
  const pulleyHolder = new THREE.Group();
  pulleyHolder.rotation.y = Math.PI / 2;
  pulleyHolder.position.set(PX, PY, PZ);
  const pulleyC = pulley(0.12, { width: 0.1, grooved: true, spokes: 0 });
  pulleyC.name = 'pulleyC';
  pulleyHolder.add(pulleyC);
  g.add(frameC, pulleyHolder);

  // 줄(두 발판의 줄 고리를 잇고 풀리 위를 넘는다)
  const chain = new Rope(0.014);
  chain.group.name = 'chain';
  g.add(chain.group);

  // 회전 화살표(바퀴 A 반시계) + 이름표
  const arrow = rotArrow(0.45, true);
  arrow.position.set(WX, WY, 0.34);
  g.add(arrow);
  g.add(
    tag('래칫 바퀴 A(톱니 30)', v(-1.35, 1.1, 0.5)),
    tag('흔들 팔 B와 폴', v(0.95, 2.95, 0.5)),
    tag('풀리 C', v(1.6, 1.95, 0.5)),
    tag('발판 D', v(1.75, 1.2, 0.5)),
    tag('이음대', v(-0.1, 1.2, 0.5))
  );

  const eye1 = treadle1.userData.eye as THREE.Object3D;
  const eye2 = treadle2.userData.eye as THREE.Object3D;
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const ropeMap = (u: number, vv: number, w: number): THREE.Vector3 => new THREE.Vector3(w, vv, u);

  let st: K82State = k82State(-1.6);
  const apply = (): void => {
    st = k82State(theta - 1.6);
    treadle1.rotation.z = st.g1;
    treadle2.rotation.z = st.g2;
    arm1.rotation.z = st.a1;
    arm2.rotation.z = st.a2;
    wheelA.rotation.z = st.wheel;
    pawl1.position.set(st.Q1[0], st.Q1[1], Z_PAWL1);
    pawl1.rotation.z = st.b1;
    pawl2.position.set(st.Q2[0], st.Q2[1], Z_PAWL2);
    pawl2.rotation.z = st.b2;
    rod1.position.set(st.T1[0], st.T1[1], Z_ROD1);
    rod1.rotation.z = Math.atan2(st.E1[1] - st.T1[1], st.E1[0] - st.T1[0]);
    rod2.position.set(st.T2[0], st.T2[1], Z_ROD2);
    rod2.rotation.z = Math.atan2(st.E2[1] - st.T2[1], st.E2[0] - st.T2[0]);
    pulleyC.rotation.z = st.pulley;

    // 줄 끝 = 발판 고리의 전시 좌표(발판 그룹 행렬에서 읽음)
    g.updateMatrixWorld(true);
    eye1.getWorldPosition(p1);
    eye2.getWorldPosition(p2);
    g.worldToLocal(p1);
    g.worldToLocal(p2);
    chain.setPath(
      ropeAround(
        { p: [p1.z, p1.y], w: p1.x },
        [{ c: [PZ, PY], r: K82.ropeR, ccw: true, w: PX }],
        { p: [p2.z, p2.y], w: p2.x },
        { seg: 24, map: ropeMap }
      )
    );
  };
  apply();

  return {
    group: g,
    view: { pos: [0.1, 1.9, 6.4], target: [0, 1.65, 0.2] },
    notes: () => {
      const wDeg = st.wheel / D2R;
      return [
        { label: '지금 미는 폴', value: st.pusher === 1 ? '위 팔의 폴' : '아래 팔의 폴' },
        { label: '바퀴 A 가 돈 각', value: `${wDeg.toFixed(1)}° (톱니 ${(wDeg / 12).toFixed(1)}개)` },
        { label: '발판 기울기 g1 · g2', value: `${(st.g1 / D2R).toFixed(2)}° · ${(st.g2 / D2R).toFixed(2)}° (±${(K82.G / D2R).toFixed(1)}°)` },
        { label: '한 왕복', value: '발판 한 번 왕복에 톱니 2개(24°)' },
        { label: '팔 흔들림', value: `${(K82.swing1 / D2R).toFixed(1)}° · ${(K82.swing2 / D2R).toFixed(1)}°` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
