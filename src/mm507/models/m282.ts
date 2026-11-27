// 282 원판과 톱니 부채꼴 레버 — 원판 핀이 세운 막대의 긴 홈 속을 오르내리며 막대를 좌우로 흔든다. 막대 아래 톱니 부채꼴은 가로 랙을 밀고, 위 끝의 줄은 도르래를 넘어 추를 오르내린다.
// 막대 각은 핀 위치에서 바로 나온다(시간표 아님). 설계표 docs/mm507-sheets/282.md · 키트 kit/k282.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { Rope, displayStand, leaderTo, pulley, ropeAround, rotArrow, setMM, tag, weight } from '../kit';
import { K282, rack282, sector282, sleeve282, state282, type State282 } from '../kit/k282';
import { brass, bronze, castIron, darkSteel, glow, paint, steel } from '../../models/materials';
import { annularSector, circlePath, extrude, lathe, mesh, rodProfile, roundedRect, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K282;
const PI = Math.PI;
const DEG = PI / 180;
type V2 = [number, number];

function revZ(profile: [number, number][], mat: THREE.Material): THREE.Mesh {
  const geo = lathe(profile, 40);
  geo.rotateX(PI / 2);
  return mesh(geo, mat);
}
function cylZ(r: number, z0: number, z1: number, mat: THREE.Material, c = 0.002): THREE.Mesh {
  return revZ([[0, z0], [r - c, z0], [r, z0 + c], [r, z1 - c], [r - c, z1], [0, z1]], mat);
}
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(extrude(roundedRect(x0, y0, x1, y1, 0.005), z1 - z0, 0.003), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}
function mark(w: number, h: number, x: number, y: number, z: number, rot = 0): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, 0.004), paint(0xf2b619));
  m.position.set(x, y, z);
  m.rotation.z = rot;
  return m;
}
/** 납작한 화살(+x 방향, 길이 0.2) */
function flatArrow(color: number): THREE.Group {
  const g = new THREE.Group();
  const s = shapeFrom([[-0.1, -0.012], [0.04, -0.012], [0.04, -0.03], [0.1, 0], [0.04, 0.03], [0.04, 0.012], [-0.1, 0.012]]);
  g.add(mesh(extrude(s, 0.012, 0.002), glow(color, 0.85)));
  g.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(g, { kind: 'arrow' });
  return g;
}

export default function buildM282(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());
  const iron = castIron();

  // ── 틀(고정) ──
  const postL = box(-1.18, -1.1, 0.18, 2.45, -0.22, -0.14, iron);
  postL.name = 'postL';
  const postR = box(1.1, 1.18, 0.18, 2.45, -0.22, -0.14, iron);
  postR.name = 'postR';
  const arms = [
    box(-1.18, -1.1, 2.35, 2.45, -0.3, -0.22, iron),
    box(-1.18, -1.1, 0.18, 0.28, -0.3, -0.22, iron),
    box(1.1, 1.18, 2.35, 2.45, -0.3, -0.22, iron),
    box(1.1, 1.18, 0.18, 0.28, -0.3, -0.22, iron)
  ];
  arms.forEach((a, i) => (a.name = `postArm${i}`));
  const crossbar = box(-1.1, 1.1, 0.88, 1.02, -0.22, -0.14, iron);
  crossbar.name = 'crossbar';
  const archShape = annularSector(1.75, 1.98, 52 * DEG, 128 * DEG);
  archShape.holes.push(annularSector(1.827, 1.893, 64 * DEG, 116 * DEG));
  const arch = mesh(extrude(archShape, 0.04, 0, 48), iron);
  arch.name = 'arch';
  arch.position.set(K.O[0], K.O[1], -0.12);
  const bolts = [-1, 1].map((s) => {
    const b = cylZ(0.02, -0.18, -0.09, darkSteel(), 0.002);
    b.name = s < 0 ? 'boltL' : 'boltR';
    b.position.set(s * 1.14, 2.43, 0);
    return b;
  });
  const archMarks = [90, 75, 105].map((a) => {
    const p = a * DEG;
    return mark(0.02, 0.06, K.O[0] + 1.95 * Math.cos(p), K.O[1] + 1.95 * Math.sin(p), -0.098, p - PI / 2);
  });
  g.add(postL, postR, ...arms, crossbar, arch, ...bolts, ...archMarks);

  // ── 원판 축(원판과 함께 돈다) + 뒤판 보스·칼라 ──
  const shaftGeo = lathe(rodProfile(0.05, -0.3, -0.038), 40);
  shaftGeo.rotateX(PI / 2);
  const shaft = mesh(shaftGeo, steel());
  shaft.name = 'discShaft';
  shaft.position.set(K.D[0], K.D[1], 0);
  const shaftDot = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.003, 16), paint(0xf2b619));
  shaftDot.rotation.x = PI / 2;
  shaftDot.position.set(0.025, 0, -0.0365);
  shaft.add(shaftDot);
  const boss = revZ(tubeProfile(0.05, 0.12, -0.3, -0.2, 0.003), darkSteel());
  boss.name = 'discBoss';
  boss.position.set(K.D[0], K.D[1], 0);
  const collar = revZ(tubeProfile(0.05, 0.09, -0.2, -0.122, 0.002), steel());
  collar.name = 'discCollar';
  collar.position.set(K.D[0], K.D[1], 0);
  g.add(shaft, boss, collar);

  // ── 원판 묶음 ──
  const discSpin = new THREE.Group();
  discSpin.name = 'discSpin';
  discSpin.position.set(K.D[0], K.D[1], 0);
  const circ: V2[] = Array.from({ length: 128 }, (_, i) => [0.65 * Math.cos((i / 128) * 2 * PI), 0.65 * Math.sin((i / 128) * 2 * PI)] as V2);
  const disc = mesh(extrude(shapeFrom(circ), 0.08, 0.002), steel());
  disc.name = 'disc';
  disc.position.z = -0.08;
  const discBand = mark(0.2, 0.02, -0.4, 0, -0.038);
  const crankPin = cylZ(0.025, -0.06, 0.068, steel(), 0.002);
  crankPin.name = 'crankPin';
  crankPin.position.x = K.PIN_R;
  const pinRoller = revZ(tubeProfile(0.027, 0.05, -0.018, 0.058, 0.002), bronze());
  pinRoller.name = 'pinRoller';
  pinRoller.position.x = K.PIN_R;
  const pinWasher = cylZ(0.075, 0.062, 0.072, darkSteel(), 0.002);
  pinWasher.name = 'pinWasher';
  pinWasher.position.x = K.PIN_R;
  discSpin.add(disc, discBand, crankPin, pinRoller, pinWasher);
  g.add(discSpin);

  // ── 받침 핀(고정) ──
  const pivotPin = cylZ(0.04, -0.18, 0.075, steel(), 0.002);
  pivotPin.name = 'pivotPin';
  pivotPin.position.set(K.O[0], K.O[1], 0);
  const pivotCollar = revZ(tubeProfile(0.04, 0.07, -0.15, -0.022, 0.002), steel());
  pivotCollar.name = 'pivotCollar';
  pivotCollar.position.set(K.O[0], K.O[1], 0);
  const pivotNut = cylZ(0.07, 0.062, 0.08, darkSteel(), 0.003);
  pivotNut.name = 'pivotNut';
  pivotNut.position.set(K.O[0], K.O[1], 0);
  g.add(pivotPin, pivotCollar, pivotNut);

  // ── 막대 묶음 ──
  const bar = new THREE.Group();
  bar.name = 'bar';
  bar.position.set(K.O[0], K.O[1], 0);
  const outline: V2[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (200 + (140 * i) / 40) * DEG;
    outline.push([0.4 * Math.cos(a), 0.4 * Math.sin(a)]);
  }
  outline.push([0.11, 0.2], [0.11, 2.05]);
  for (let i = 1; i < 24; i++) {
    const a = (PI * i) / 24;
    outline.push([0.11 * Math.cos(a), 2.05 + 0.11 * Math.sin(a)]);
  }
  outline.push([-0.11, 2.05], [-0.11, 0.2]);
  const barShape = shapeFrom(outline);
  barShape.holes.push(circlePath(0, 0, 0.042), stadiumShape(0, 0.6, 0, 1.5, 0.053));
  const barBody = mesh(extrude(barShape, 0.08, 0.002), brass());
  barBody.name = 'barBody';
  barBody.position.z = 0.02;
  barBody.userData.outline = outline;
  const sector = sector282();
  const guidePin = cylZ(0.018, -0.15, 0.0, steel(), 0.002);
  guidePin.name = 'guidePin';
  guidePin.position.set(0, 1.86, 0);
  const guideRoller = revZ(tubeProfile(0.019, 0.03, -0.138, -0.102, 0.001), bronze());
  guideRoller.name = 'guideRoller';
  guideRoller.position.set(0, 1.86, 0);
  const guideWasher = cylZ(0.05, -0.152, -0.142, darkSteel(), 0.002);
  guideWasher.name = 'guideWasher';
  guideWasher.position.set(0, 1.86, 0);
  const cordStud = cylZ(0.015, 0.055, 0.13, steel(), 0.002);
  cordStud.name = 'cordStud';
  cordStud.position.set(0, 2.0, 0);
  bar.add(barBody, sector, guidePin, guideRoller, guideWasher, cordStud, mark(0.12, 0.02, 0, 1.75, 0.062));
  g.add(bar);

  // ── 가로 랙 + 소매 ──
  const rack = rack282();
  rack.position.set(0, 0.41, 0.02);
  rack.add(mark(0.12, 0.02, -1.0, -0.13, 0.042));
  const sleeveL = sleeve282(-0.85);
  const sleeveR = sleeve282(0.85);
  g.add(rack, sleeveL, sleeveR);

  // ── 도르래·줄·추 ──
  const pBracket = box(1.24, 1.36, 2.9, 3.02, -0.3, 0.048, iron);
  pBracket.name = 'pulleyBracket';
  const pAxle = cylZ(0.025, -0.05, 0.158, steel(), 0.002);
  pAxle.name = 'pulleyAxle';
  pAxle.position.set(K.PULLEY[0], K.PULLEY[1], 0);
  const pWasher = cylZ(0.05, 0.152, 0.162, darkSteel(), 0.002);
  pWasher.name = 'pulleyWasher';
  pWasher.position.set(K.PULLEY[0], K.PULLEY[1], 0);
  const pul = pulley(0.12, { width: 0.06, grooved: true, spokes: 4 });
  pul.name = 'pulley';
  pul.position.set(K.PULLEY[0], K.PULLEY[1], 0.1);
  const rope = new Rope(0.007);
  rope.group.name = 'cord';
  const wt = weight(0.18, 0.26);
  wt.name = 'weightBlock';
  g.add(pBracket, pAxle, pWasher, pul, rope.group, wt);

  // ── 화살표 ──
  const discArrow = rotArrow(0.78, true);
  discArrow.position.set(K.D[0], K.D[1], -0.03);
  const rackArrow = flatArrow(0xd8362f);
  const weightArrow = flatArrow(0xf2b619);
  g.add(discArrow, rackArrow, weightArrow);

  // ── 이름표 7(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('원판', v(-1.6, 2.45, 0.3)), 'disc'),
    leaderTo(tag('원판 핀', v(-1.6, 1.7, 0.3)), 'pinRoller'),
    leaderTo(tag('홈 막대', v(-1.6, 1.05, 0.3)), 'barBody'),
    leaderTo(tag('톱니 부채꼴', v(0.95, 0.75, 0.3)), 'sector'),
    leaderTo(tag('가로 랙', v(-1.35, 0.05, 0.3)), 'rack'),
    leaderTo(tag('추', v(1.85, 1.45, 0.3)), 'weightBlock'),
    leaderTo(tag('안내 아치', v(-1.25, 3.05, 0.3)), 'arch')
  );

  let st: State282 = state282(0);
  const apply = (): void => {
    st = state282(t);
    const nx = state282(t + 0.01);
    discSpin.rotation.z = st.phi;
    shaft.rotation.z = st.phi;
    bar.rotation.z = st.beta;
    rack.position.x = st.X;
    pul.rotation.z = -st.s / K.ROPE_RC;
    rope.setPath(
      ropeAround(
        { p: st.T, w: 0.1 },
        [{ c: K.PULLEY, r: K.ROPE_RC, ccw: false }],
        { p: [K.PULLEY[0] + K.ROPE_RC, st.yHook], w: 0.1 },
        { seg: 24 }
      )
    );
    wt.position.set(K.PULLEY[0] + K.ROPE_RC, st.yHook - 0.1768, 0.1);
    rackArrow.position.set(st.X + 1.25, 0.55, 0.1);
    rackArrow.rotation.z = nx.X >= st.X ? 0 : PI;
    weightArrow.position.set(1.2, st.yHook - 0.18, 0.1);
    weightArrow.rotation.z = nx.yHook >= st.yHook ? PI / 2 : -PI / 2;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.7, 6.2], target: [0.1, 1.65, 0] },
    notes: () => [
      { label: '원판 각', value: `${((((st.phi * 180) / PI) % 360) + 360) % 360 | 0}°` },
      { label: '막대 각', value: `${((st.beta * 180) / PI).toFixed(1)}°` },
      { label: '랙 위치', value: st.X.toFixed(3) },
      { label: '추 높이', value: st.yHook.toFixed(3) },
      { label: '원리', value: '원판 핀이 막대 홈 속을 오르내리며 막대를 흔든다 — 아래 부채꼴은 랙을, 위 끝은 줄로 추를 움직인다' },
      { label: '메모', value: '아치의 활꼴 홈은 받침점 중심 원호라 막대 움직임을 막지 않고 앞뒤 기울어짐만 막는다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
