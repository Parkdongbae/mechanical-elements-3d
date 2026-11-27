// 272 비스듬한 원판 캠 — 축에 20° 비스듬히 끼운 두꺼운 원판이 돌면 면이 앞뒤로 흔들려, 그 면에 공 끝이 기댄 막대가 안내 부시를 따라 한 바퀴에 한 번 왕복한다.
// 설계표 docs/mm507-sheets/272.md · 키트 kit/k272.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, pulley, rotArrow, tag } from '../kit';
import { K272, followerRod272, guide272, hanger272, state272, swashDisc272, type State272 } from '../kit/k272';
import { darkSteel, glow, paint, steel } from '../../models/materials';
import { extrude, hexPrism, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import { setMM } from '../kit/mm';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K272;
const PI = Math.PI;
const DEG = PI / 180;
const [OX, OY, OZ] = K.O;

/** x 방향 원기둥/관: x0 → x1 (그룹 안 좌표, y·z = 0) */
function tubeX(rIn: number, rOut: number, x0: number, x1: number, mat: THREE.Material, c = 0.004): THREE.Mesh {
  const geo = lathe(rIn > 0 ? tubeProfile(rIn, rOut, x0, x1, c) : rodProfile(rOut, x0, x1, c, c), 40);
  geo.rotateZ(-PI / 2);
  return mesh(geo, mat);
}

export default function buildM272(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 회전 묶음: 축 + 원판 + 허브 + 손바퀴 + 칼라 ──
  const spin = new THREE.Group();
  spin.name = 'camSpin';
  spin.position.set(0, OY, OZ);

  const shaft = tubeX(0, 0.04, -1.0, 1.32, steel(), 0.004);
  shaft.name = 'camShaft';
  spin.add(shaft);

  const disc = swashDisc272();
  disc.name = 'camDisc';
  disc.position.set(OX, 0, 0);
  spin.add(disc);

  const hub = tubeX(0.04, 0.09, 0.3, 0.62, darkSteel(), 0.005);
  hub.name = 'camHub';
  spin.add(hub);
  const screw = mesh(hexPrism(0.03, 0.015, true, true, 0), darkSteel());
  screw.position.set(0.46, 0.0975, 0);
  hub.add(screw);

  // 축 칼라 둘(받침 안쪽 면에 붙음, 받침 관 끝면과 0.002 띄움)
  const collarL = tubeX(0.04, 0.065, -0.798, -0.768, steel(), 0.003);
  collarL.name = 'collarL';
  const collarR = tubeX(0.04, 0.065, 0.968, 0.998, steel(), 0.003);
  collarR.name = 'collarR';
  spin.add(collarL, collarR);

  // 손바퀴
  const handWheel = new THREE.Group();
  handWheel.name = 'handWheel';
  handWheel.position.set(1.22, 0, 0);
  handWheel.rotation.y = PI / 2;
  const pl = pulley(0.16, { width: 0.08, spokes: 4, hub: 0.04, driver: true });
  pl.children[0]!.name = 'handRim';
  handWheel.add(pl);
  spin.add(handWheel);
  const grip = tubeX(0, 0.02, 1.258, 1.358, paint(0xd8362f), 0.004);
  grip.position.y = 0.13;
  grip.name = 'handGrip';
  spin.add(grip);
  g.add(spin);

  // ── 축 받침 둘(고정) ──
  const brgL = hanger272(-0.85);
  brgL.name = 'bearingL';
  const brgR = hanger272(1.05);
  brgR.name = 'bearingR';
  g.add(brgL, brgR);

  // ── 안내 부시 둘(고정) ──
  const mkGuide = (name: string, off: number): THREE.Group => {
    const gd = guide272();
    gd.name = name;
    gd.position.set(K.P_REF[0] + off * K.D[0], K.P_REF[1] + off * K.D[1], OZ);
    return gd;
  };
  g.add(mkGuide('guideL', K.GUIDE_L), mkGuide('guideU', K.GUIDE_U));

  // ── 막대 + 공 ──
  const rod = followerRod272();
  rod.name = 'followerRod';
  g.add(rod);

  // ── 표시: 축 회전 화살표 + 막대 방향 화살표 ──
  const rArrow = rotArrow(0.2, true);
  rArrow.rotation.y = PI / 2;
  rArrow.position.set(1.45, OY, OZ);
  g.add(rArrow);

  const dArrow = new THREE.Group();
  dArrow.name = 'rodArrow';
  dArrow.add(
    mesh(
      extrude(
        shapeFrom([
          [-0.06, -0.007],
          [0.015, -0.007],
          [0.015, -0.014],
          [0.06, 0],
          [0.015, 0.014],
          [0.015, 0.007],
          [-0.06, 0.007]
        ]),
        0.008,
        0.002
      ),
      glow(0xf2b619, 0.9)
    )
  );
  dArrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(dArrow, { kind: 'arrow' });
  dArrow.position.set(0.05, 1.95, 0.35);
  g.add(dArrow);

  // ── 이름표 6(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('비스듬한 원판', v(1.25, 0.55, 0.3)), 'camDisc'),
    leaderTo(tag('막대', v(-1.2, 2.55, 0.3)), 'followerRod'),
    leaderTo(tag('공 끝(원판 면에 닿음)', v(-0.85, 1.2, 0.3)), 'rodBall'),
    leaderTo(tag('안내 부시', v(0.45, 2.45, 0.3)), 'guideL'),
    leaderTo(tag('축', v(-1.5, 0.75, 0.3)), 'camShaft'),
    leaderTo(tag('손바퀴', v(1.55, 1.95, 0.3)), 'handRim')
  );

  let st: State272 = state272(0);
  const apply = (): void => {
    st = state272(K.OMEGA * t);
    spin.rotation.x = st.theta;
    rod.position.set(st.ball[0], st.ball[1], st.ball[2]);
    // 막대 방향 화살: s 가 줄면(올라감) −d, 늘면 +d
    const ds = state272(K.OMEGA * t + 0.01).s - st.s;
    dArrow.rotation.z = ds < 0 ? 147 * DEG : -33 * DEG;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.3, 1.9, 5.6], target: [0.05, 1.45, 0.2] },
    notes: () => [
      { label: '축 각', value: `${Math.round((((st.theta % (2 * PI)) + 2 * PI) % (2 * PI)) * (180 / PI))}°` },
      { label: '막대 위치', value: st.s.toFixed(3) },
      { label: '원리', value: '원판이 축에 20° 비스듬히 끼워져 있어 한 바퀴에 원판 면이 앞뒤로 한 번 흔들리고, 그 면에 기댄 막대가 한 번 왕복한다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
