// 281 홈 캠 원판과 레버 — 원판이 일정하게 돌면 앞면 닫힌 홈 속에 갇힌 롤러가 중심 쪽으로 끌렸다 밀려나, 위 받침점에 건 레버가 흔들린다.
// 레버 각은 시간표가 아니라 "롤러가 홈 가운데선 위에 있다"는 조건에서 나온다. 설계표 docs/mm507-sheets/281.md · 키트 kit/k281.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, shaftZ, tag } from '../kit';
import { K281, cam281Disc, lever281, state281, type State281 } from '../kit/k281';
import { castIron, darkSteel, glow, steel } from '../../models/materials';
import { extrude, lathe, mesh, roundedRect, shapeFrom, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K281;
const PI = Math.PI;
const DEG = PI / 180;

function revZ(profile: [number, number][], mat: THREE.Material): THREE.Mesh {
  const geo = lathe(profile, 40);
  geo.rotateX(PI / 2);
  return mesh(geo, mat);
}

/** 깊이 z0 → z1 원기둥(양끝 모따기 c) */
function cylZ(r: number, z0: number, z1: number, mat: THREE.Material, c = 0.002): THREE.Mesh {
  return revZ([[0, z0], [r - c, z0], [r, z0 + c], [r, z1 - c], [r - c, z1], [0, z1]], mat);
}

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(extrude(roundedRect(x0, y0, x1, y1, 0.006), z1 - z0, 0.004), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

function plate(pts: [number, number][], z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(extrude(shapeFrom(pts), z1 - z0, 0.002), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** 납작한 빨간 화살(+x 방향, 길이 0.18) */
function smallArrow(): THREE.Group {
  const g = new THREE.Group();
  const s = shapeFrom([[-0.09, -0.012], [0.03, -0.012], [0.03, -0.03], [0.09, 0], [0.03, 0.03], [0.03, 0.012], [-0.09, 0.012]]);
  g.add(mesh(extrude(s, 0.012, 0.002), glow(0xd8362f, 0.85)));
  g.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(g, { kind: 'arrow' });
  return g;
}

export default function buildM281(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 원판 축(원판과 함께 돈다) ──
  const shaft = shaftZ(K.C[0], K.C[1], 0.154, 0.06);
  shaft.name = 'discShaft';
  g.add(shaft);

  // ── 원판 묶음 ──
  const disc = cam281Disc();
  disc.position.set(K.C[0], K.C[1], 0);
  g.add(disc);

  // ── A 자 받침(고정) ──
  const iron = castIron();
  const ring = revZ(tubeProfile(0.062, 0.16, -0.12, -0.02, 0.003), iron);
  ring.name = 'bearingRing';
  ring.position.set(K.C[0], K.C[1], 0);
  const legL = plate([[-0.52, 1.64], [-0.44, 1.58], [-1.18, 0.18], [-1.32, 0.18]], -0.115, -0.03, iron);
  legL.name = 'legL';
  const legR = plate([[-0.36, 1.58], [-0.28, 1.64], [0.52, 0.18], [0.38, 0.18]], -0.115, -0.03, iron);
  legR.name = 'legR';
  g.add(ring, legL, legR);

  // ── 레버 받침대(고정, 뒤판에 붙음) ──
  const bracket = box(0.27, 0.43, 2.8, 3.0, -0.3, 0.11, iron);
  bracket.name = 'pivotBracket';
  const pPin = cylZ(0.035, 0.105, 0.19, steel(), 0.002);
  pPin.name = 'pivotPin';
  pPin.position.set(K.P[0], K.P[1], 0);
  const spacer = revZ(tubeProfile(0.034, 0.06, 0.108, 0.129, 0.002), darkSteel());
  spacer.name = 'pivotSpacer';
  spacer.position.set(K.P[0], K.P[1], 0);
  const nut = cylZ(0.06, 0.172, 0.21, darkSteel(), 0.003);
  nut.name = 'pivotNut';
  nut.position.set(K.P[0], K.P[1], 0);
  g.add(bracket, pPin, spacer, nut);

  // ── 레버 묶음 ──
  const arm = lever281();
  arm.position.set(K.P[0], K.P[1], 0);
  const barA = K.BAR_DEG * DEG;
  const barArrow = smallArrow();
  barArrow.position.set(2.05 * Math.cos(barA) - 0.2 * Math.sin(barA), 2.05 * Math.sin(barA) + 0.2 * Math.cos(barA), 0.2);
  arm.add(barArrow);
  g.add(arm);

  // ── 회전 화살표 ──
  const discArrow = rotArrow(0.25, true);
  discArrow.position.set(-1.2, 2.75, 0.12);
  g.add(discArrow);

  // ── 이름표 5(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('홈 캠 원판', v(-1.75, 2.6, 0.3)), 'discRim'),
    leaderTo(tag('홈 속 롤러', v(-1.75, 1.2, 0.3)), 'roller'),
    leaderTo(tag('레버', v(1.75, 2.45, 0.3)), 'lever'),
    leaderTo(tag('레버 받침', v(-0.75, 3.1, 0.3)), 'pivotBracket'),
    leaderTo(tag('받침 다리', v(-1.75, 0.45, 0.3)), 'legL')
  );

  let st: State281 = state281(0);
  const apply = (): void => {
    st = state281(t);
    disc.rotation.z = st.phi;
    shaft.rotation.z = st.phi;
    arm.rotation.z = st.thetaPin;
    // 막대 끝이 지금 가는 쪽(받침점 둘레 회전 방향)
    const dir = state281(t + 0.01).thetaPin - st.thetaPin >= 0 ? 1 : -1;
    barArrow.rotation.z = barA + (dir * PI) / 2;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.75, 6.2], target: [0.15, 1.7, 0] },
    notes: () => [
      { label: '원판 각', value: `${((((st.phi * 180) / PI) % 360) + 360) % 360 | 0}°` },
      { label: '롤러 ↔ 원판 중심', value: st.rho.toFixed(3) },
      { label: '레버 각', value: `${((st.thetaPin * 180) / PI + 90).toFixed(1)}°` },
      { label: '원리', value: '롤러가 홈 속에 갇혀 있어 원판이 돌면 홈이 롤러를 중심 쪽으로 당겼다 밀어 레버가 흔들린다 — 원판 한 바퀴에 레버 한 왕복' },
      { label: '메모', value: '판화의 받침점 기둥 대신 뒤판 받침대에 레버를 걸었다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
