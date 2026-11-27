// 286 증기 기관 밸브 들개 — 흔들 축에 달린 굽은 토의 볼록한 윗면이 들개의 평평한 밑면을 밀어 올려 막대째 퍼핏 밸브를 들어 올린다.
// 축이 되돌아가면 막대는 제 무게로 내려와 밸브가 자리에 앉고 토는 아래로 떨어진다. 설계표 docs/mm507-sheets/286.md · 키트 kit/k286.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, shaftZ, tag } from '../kit';
import { K286, lifterOutline286, state286, toeOutline286, type State286 } from '../kit/k286';
import { bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, roundedRect, shapeFrom, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const DEG = PI / 180;
const K = K286;
const ROD_X = 1.13;
const ROD_Z = 0.17;

/** 윤곽 → 깊이 z0 ~ z1 판 */
function plate(shape: THREE.Shape, z0: number, z1: number, mat: THREE.Material, c = 0.002): THREE.Mesh {
  const m = mesh(extrude(shape, z1 - z0, c), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** 상자 x0..x1, y0..y1, z0..z1 */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(extrude(roundedRect(x0, y0, x1, y1, 0.004), z1 - z0, 0.002), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** 세로(Y 축) 회전체, 중심 (ROD_X, ·, ROD_Z) */
function revY(profile: [number, number][], mat: THREE.Material): THREE.Mesh {
  const m = mesh(lathe(profile, 48), mat);
  m.position.set(ROD_X, 0, ROD_Z);
  return m;
}

export default function buildM286(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 흔들 축 ──
  const shaft = shaftZ(K.S[0], K.S[1], 0.188, 0.13);
  shaft.name = 'rockShaft';
  g.add(shaft);

  // ── 토 묶음(그룹 위치 S) ──
  const toeRig = new THREE.Group();
  toeRig.name = 'toeRig';
  toeRig.position.set(K.S[0], K.S[1], 0);
  const toeMat = steel();
  const toeOutline = toeOutline286();
  const toe = plate(shapeFrom(toeOutline), -0.06, 0.06, toeMat, 0.002);
  toe.name = 'toe';
  toe.userData.outline = toeOutline;
  const hubGeo = lathe(tubeProfile(0.13, 0.3, -0.07, 0.07, 0.003), 64);
  hubGeo.rotateX(PI / 2);
  const hub = mesh(hubGeo, darkSteel());
  hub.name = 'rockHub';
  const mark = mesh(new THREE.BoxGeometry(0.1, 0.025, 0.004), paint(0xf2b619));
  mark.name = 'rockMark';
  mark.position.set(0, 0.22, 0.0725);
  mark.rotation.z = PI / 2;
  toeRig.add(toe, hub, mark);
  g.add(toeRig);

  // ── 들어올림 묶음(그룹 위치 (0, lift, 0)) ──
  const liftRig = new THREE.Group();
  liftRig.name = 'liftRig';
  const lifterPts = lifterOutline286();
  const lifter = plate(shapeFrom(lifterPts), -0.08, 0.08, bronze(), 0.002);
  lifter.name = 'lifter';
  lifter.userData.outline = lifterPts;
  const collar = box(0.9, 1.36, K.H0 - 0.002, 2.665, -0.082, 0.28, bronze());
  collar.name = 'liftCollar';
  const rod = revY(tubeProfile(0, 0.09, 0.55, 2.93, 0.003), steel());
  rod.name = 'liftRod';
  const head = revY(tubeProfile(0, 0.22, 2.9, 2.96, 0.003), bronze());
  head.name = 'valveHead';
  const headNut = revY(tubeProfile(0, 0.06, 2.958, 2.99, 0.003), bronze());
  headNut.name = 'valveNut';
  liftRig.add(lifter, collar, rod, head, headNut);
  g.add(liftRig);

  // ── 밸브 자리(고정) ──
  const iron = castIron();
  const seat = revY(tubeProfile(0.095, 0.2, 2.84, 2.9, 0.003), iron);
  seat.name = 'valveSeat';
  const seatBase = box(1.05, 1.21, 2.842, 2.898, -0.3, 0.0, iron);
  seatBase.name = 'valveSeatBase';
  g.add(seat, seatBase);

  // ── 아래 안내(고정) — 세로 구멍 0.095 ──
  const gs = shapeFrom([
    [0.98, -0.34],
    [1.28, -0.34],
    [1.28, 0],
    [0.98, 0]
  ]);
  gs.holes.push(circlePath(ROD_X, -ROD_Z, 0.095));
  const guideGeo = extrude(gs, 0.16, 0.002);
  guideGeo.rotateX(-PI / 2);
  const guide = mesh(guideGeo, iron);
  guide.position.y = 0.78;
  guide.name = 'lowerGuide';
  const guideArm = box(1.08, 1.18, 0.702, 0.858, -0.3, 0.01, iron);
  guideArm.name = 'lowerGuideArm';
  g.add(guide, guideArm);

  // ── 이름표 5(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('굽은 토', v(-1.25, 1.3, 0.3)), 'toe'),
    leaderTo(tag('들개', v(-1.55, 2.5, 0.3)), 'lifter'),
    leaderTo(tag('들어올림 막대', v(0.1, 0.58, 0.3)), 'liftRod'),
    leaderTo(tag('흔들 축', v(-0.1, 1.02, 0.3)), 'rockHub'),
    leaderTo(tag('퍼핏 밸브', v(-0.3, 3.0, 0.3)), 'valveHead')
  );

  let st: State286 = state286(0);
  const apply = (): void => {
    st = state286(t);
    toeRig.rotation.z = -st.b * DEG;
    liftRig.position.y = st.lift;
    (toeMat as THREE.MeshStandardMaterial).emissive.setHex(st.touching ? 0x553300 : 0x000000);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.9, 5.0], target: [0, 1.85, 0] },
    notes: () => [
      { label: '흔들 축 각', value: `${st.b.toFixed(1)}°` },
      { label: '밸브 들림', value: st.lift.toFixed(3) },
      { label: '토', value: st.touching ? '들개를 밀어 올리는 중' : '들개에서 떨어짐 — 밸브 닫힘' },
      { label: '메모', value: '토 윗면은 큰 원호라서, 닿는 점이 늘 원호 중심 바로 위에 온다 — 축이 4° 돌면 밸브가 0.117 올라간다' },
      { label: '메모', value: '판화에는 밸브가 없어 막대 위 끝에 밸브 머리와 자리를 그려 넣었다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
