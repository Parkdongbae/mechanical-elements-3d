// 271 래칫 막대 이송 — 지렛대를 흔들면 받침점 위·아래 두 핀에 달린 긴 폴이 번갈아 톱니 막대를 밀어 막대가 거의 쉬지 않고 왼쪽으로 나아간다.
// 이송 6 초(지렛대 두 번 왕복, 막대 0.48) + 되돌림 4 초(폴을 젖히고 막대를 돌려놓음, 전시용). 설계표 docs/mm507-sheets/271.md · 키트 kit/k271.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { K271, bed271, lever271, pawl271, ratchetBar271, state271, type State271 } from '../kit/k271';
import { castIron, darkSteel, glow, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import { setMM } from '../kit/mm';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K271;
const PI = Math.PI;

/** 깊이 z0 → z1 의 Z 축 원기둥 */
function pinZ(r: number, z0: number, z1: number, mat: THREE.Material, c = 0.003): THREE.Mesh {
  const geo = lathe(rodProfile(r, z0, z1, c, c), 28);
  geo.rotateX(PI / 2);
  return mesh(geo, mat);
}

/** xy 직사각형(구멍 하나)을 깊이 z0 → z1 로 압출 */
function plateXY(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, hole: { x: number; y: number; r: number }, mat: THREE.Material, c = 0.006): THREE.Mesh {
  const shape = shapeFrom([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ]);
  shape.holes.push(circlePath(hole.x, hole.y, hole.r));
  const m = mesh(extrude(shape, z1 - z0, c), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

export default function buildM271(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 받침 틀(고정) ──
  const bed = bed271();
  bed.name = 'bed';
  g.add(bed);

  // ── 톱니 막대 ──
  const bar = ratchetBar271();
  bar.name = 'ratchetBar';
  g.add(bar);

  // ── 받침 롤러 + 받침 판 + 축 ──
  const RX = -1.4;
  const RY = 1.0;
  const roller = new THREE.Group();
  roller.name = 'feedRoller';
  roller.position.set(RX, RY, 0);
  const tube = lathe(tubeProfile(0.021, 0.08, -0.1, 0.1, 0.004), 56);
  tube.rotateX(PI / 2);
  const rollerBody = mesh(tube, darkSteel());
  rollerBody.name = 'feedRollerBody';
  roller.add(rollerBody);
  const dot = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 16).rotateX(PI / 2), paint(0xf2b619));
  dot.position.set(0.05, 0, 0.102);
  roller.add(dot);
  g.add(roller);
  const rollerPlate = plateXY(RX - 0.06, RX + 0.06, 0.18, 1.04, -0.16, -0.12, { x: RX, y: RY, r: 0.0202 }, castIron(), 0.008);
  rollerPlate.name = 'rollerPlate';
  g.add(rollerPlate);
  const axle = new THREE.Group();
  axle.name = 'rollerAxle';
  axle.position.set(RX, RY, 0);
  axle.add(pinZ(0.02, -0.16, 0.118, steel(), 0.002), pinZ(0.03, 0.117, 0.129, steel(), 0.003));
  g.add(axle);

  // ── 받침 기둥 + 받침 핀 ──
  const post = plateXY(1.04, 1.16, 0.18, 1.68, -0.3, -0.14, { x: K.P[0], y: K.P[1], r: 0.0252 }, castIron(), 0.006);
  post.name = 'post';
  g.add(post);
  const pivot = new THREE.Group();
  pivot.name = 'pivotPin';
  pivot.position.set(K.P[0], K.P[1], 0);
  pivot.add(pinZ(0.025, -0.3, -0.08, steel(), 0.002), pinZ(0.04, -0.083, -0.069, steel(), 0.004));
  g.add(pivot);

  // ── 지렛대 + 폴 둘 ──
  const lever = lever271();
  lever.name = 'lever';
  lever.position.set(K.P[0], K.P[1], 0);
  g.add(lever);
  const pawl1 = pawl271(1);
  pawl1.name = 'pawl1';
  const pawl2 = pawl271(2);
  pawl2.name = 'pawl2';
  g.add(pawl1, pawl2);

  // ── 막대 이동 방향 화살(노랑) ──
  const arrow = new THREE.Group();
  arrow.name = 'dirArrow';
  const arrowMesh = mesh(
    extrude(
      shapeFrom([
        [-0.08, -0.008],
        [0.02, -0.008],
        [0.02, -0.015],
        [0.08, 0],
        [0.02, 0.015],
        [0.02, 0.008],
        [-0.08, 0.008]
      ]),
      0.008,
      0.002
    ),
    glow(0xf2b619, 0.9)
  );
  arrow.add(arrowMesh);
  arrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(arrow, { kind: 'arrow' });
  arrow.position.set(-1.25, 1.42, 0.12);
  g.add(arrow);

  // ── 이름표 6(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('래칫 막대', v(-1.0, 1.75, 0.3)), 'ratchetBar'),
    leaderTo(tag('위 폴', v(-0.4, 2.25, 0.3)), 'pawl1'),
    leaderTo(tag('아래 폴', v(0.55, 2.2, 0.3)), 'pawl2'),
    leaderTo(tag('지렛대(손잡이)', v(1.55, 2.5, 0.3)), 'lever'),
    leaderTo(tag('받침 기둥', v(1.6, 0.8, 0.3)), 'post'),
    leaderTo(tag('받침 롤러', v(-1.75, 0.62, 0.3)), 'feedRoller')
  );

  let st: State271 = state271(0);
  let uNow = 0;
  const apply = (): void => {
    st = state271(t);
    lever.rotation.z = st.phi;
    pawl1.position.set(st.q1[0], st.q1[1], 0);
    pawl1.rotation.z = st.gamma1 - K.G1_REF;
    pawl2.position.set(st.q2[0], st.q2[1], 0);
    pawl2.rotation.z = st.gamma2 - K.G2_REF;
    bar.position.x = st.X;
    roller.rotation.z = -st.X / 0.08;
    // 화살: 이송은 왼쪽, 되돌림 중 움직일 때만 오른쪽, 멈춤 숨김
    uNow = ((t % K.PERIOD) + K.PERIOD) % K.PERIOD - 2 * K.T_SWING;
    if (st.phase === 'reset') {
      arrow.visible = uNow > 0.6 && uNow < 3.4;
      arrow.rotation.z = 0;
    } else {
      arrow.visible = true;
      arrow.rotation.z = PI;
    }
  };
  apply();

  return {
    group: g,
    view: { pos: [-0.15, 1.6, 5.8], target: [-0.15, 1.35, 0] },
    notes: () => [
      { label: '지금', value: st.phase === 'feed1' ? '이송(위 폴이 밂)' : st.phase === 'feed2' ? '이송(아래 폴이 밂)' : '되돌림(폴을 젖히고 막대를 되돌림)' },
      { label: '막대 이동', value: (-st.X).toFixed(3) },
      { label: '원리', value: '받침점 위·아래의 두 핀이 서로 반대로 움직여, 한 폴이 밀 때 다른 폴은 이를 넘어 물러난다 — 손잡이를 올릴 때도 내릴 때도 막대가 나아간다' },
      { label: '참고', value: '되돌림 구간은 전시용(판화에 없음)' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
