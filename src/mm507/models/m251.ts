// 251 말뚝 박는 기계의 해제 고리 — 줄이 고리 받침을 끌어 올리면 받침에 핀으로 달린 두 집게(고리 A)가 추 W 의 T 머리를 물고 함께 오른다.
// 집게 윗끝(코)이 틀 꼭대기 홈 B 의 옆면에 들어가면 옆면이 코를 안쪽으로 밀어 집게가 핀을 중심으로 돌고, 발끝이 벌어져 추가 떨어진다.
// 집게 각은 시간표가 아니라 홈 옆면(닫힌 식)과 T 머리 모따기(이분법)가 정한다 — 설계표 docs/mm507-sheets/251.md, 키트 kit/k251.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { coilSpring, displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K251, hook251, state251 } from '../kit/k251';
import { aluminum, castIron, paint, steel, wood } from '../../models/materials';
import { extrude, mesh, shapeFrom, type V2 } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K251;
const DRUM_C: [number, number] = [0.062, 3.1];
const EYE_TOP = 0.672; // 받침 원점 기준 고리 위 끝
const PILE_Y0 = 0.18; // 말뚝 밑(땅 구멍 바닥 = 받침대 윗면)
const SLOT_DX = 0.02 * Math.hypot(1, K.K); // 덧판 두께 0.02 의 가로 환산(0.0239)

const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, name?: string): THREE.Mesh => {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (name) m.name = name;
  return m;
};
/** z 방향 원기둥: 반지름 r, z0~z1, 중심 (x, y) */
const cylZ = (r: number, z0: number, z1: number, x: number, y: number, mat: THREE.Material): THREE.Mesh => {
  const geo = new THREE.CylinderGeometry(r, r, z1 - z0, 28);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, mat);
  m.position.set(x, y, (z0 + z1) / 2);
  return m;
};
/** 다각형(xy)을 z0~z1 로 압출 */
const prism = (pts: V2[], z0: number, z1: number, mat: THREE.Material, c = 0): THREE.Mesh => {
  const m = mesh(extrude(shapeFrom(pts), z1 - z0, c), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
};
const mirrorPts = (pts: V2[]): V2[] => pts.map(([x, y]) => [-x, y] as V2).reverse();

export default function buildM251(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 땅(고정): 말뚝 구멍을 뺀 네 덩이 ──
  const groundMat = paint(0x7a5c3e);
  const ground = new THREE.Group();
  ground.name = 'ground';
  ground.add(
    box(1.9, 0.18, 0.238, 0, 0.27, 0.181, groundMat, 'groundFront'),
    box(1.9, 0.18, 0.138, 0, 0.27, -0.231, groundMat, 'groundBack'),
    box(0.838, 0.18, 0.224, -0.531, 0.27, -0.05, groundMat, 'groundLeft'),
    box(0.838, 0.18, 0.224, 0.531, 0.27, -0.05, groundMat, 'groundRight')
  );
  g.add(ground);

  // ── 말뚝: 높이 늘이는 상자 + 쇠테(머리가 보이지 않는 동안 옮긴다) ──
  const pileMat = wood(0x9b7a4e);
  pileMat.transparent = true;
  const ringMat = steel();
  ringMat.transparent = true;
  const pile = mesh(new THREE.BoxGeometry(0.22, 1, 0.22), pileMat);
  pile.name = 'pile';
  const pileRing = mesh(new THREE.BoxGeometry(0.23, 0.02, 0.23), ringMat);
  pileRing.name = 'pileRing';
  g.add(pile, pileRing);

  // ── 기둥 둘·가로대(홈 B) ──
  const post = (sx: number): THREE.Mesh => box(0.12, 2.4, 0.3, sx * 0.58, 1.56, -0.05, wood(), sx > 0 ? 'postR' : 'postL');
  g.add(post(1), post(-1));
  const beamPts: V2[] = [
    [0.8, K.YB],
    [0.8, K.YT],
    [0.187 + SLOT_DX, K.YT],
    [K.XB + SLOT_DX, K.YB]
  ];
  const beamR = prism(beamPts, -0.1, 0.12, wood());
  beamR.name = 'beam';
  const beamL = prism(mirrorPts(beamPts), -0.1, 0.12, wood());
  beamL.name = 'beamL';
  const beamBack = box(1.6, 0.22, 0.1, 0, 2.87, -0.15, wood(), 'beamBack');
  // 홈 B 덧판(밝은 알루미늄): 안쪽 면 = (0.33, 2.76) → (0.187, 2.98)
  const slotPts: V2[] = [
    [K.XB, K.YB],
    [0.187, K.YT],
    [0.187 + SLOT_DX, K.YT],
    [K.XB + SLOT_DX, K.YB]
  ];
  const slotB = prism(slotPts, -0.1, 0.12, aluminum({ color: 0xdfe6ee }));
  slotB.name = 'slotB';
  const slotBL = prism(mirrorPts(slotPts), -0.1, 0.12, aluminum({ color: 0xdfe6ee }));
  slotBL.name = 'slotBL';
  g.add(beamR, beamL, beamBack, slotB, slotBL);

  // ── 감개(드럼) + 크랭크: 틀 꼭대기 위, 축은 뒤 받침을 꿰고 돈다 ──
  const drumBoss = box(0.1, 0.1, 0.1, DRUM_C[0], DRUM_C[1], -0.25, wood(), 'drumBoss');
  g.add(drumBoss);
  const drumG = new THREE.Group();
  drumG.name = 'drumGroup';
  drumG.position.set(DRUM_C[0], DRUM_C[1], 0);
  const barrel = cylZ(0.05, -0.05, 0.05, 0, 0, wood());
  barrel.name = 'drum';
  const band = cylZ(K.DRUM_R, -0.045, 0.045, 0, 0, paint(0xc9b48a));
  band.name = 'drumBand';
  const flangeB = cylZ(0.085, -0.06, -0.05, 0, 0, castIron());
  const flangeF = cylZ(0.085, 0.05, 0.06, 0, 0, castIron());
  const mark = box(0.05, 0.012, 0.0045, 0.05, 0, 0.06025, paint(0xf2c200), 'drumMark');
  const axle = cylZ(0.018, -0.3, 0.1, 0, 0, steel());
  axle.name = 'drumAxle';
  const collar = cylZ(0.03, 0.058, 0.075, 0, 0, steel());
  const crankG = new THREE.Group();
  crankG.name = 'crank';
  crankG.add(box(0.12, 0.024, 0.02, 0.04, 0, 0.085, steel(), 'crankArm'), cylZ(0.012, 0.088, 0.17, 0.1, 0, paint(0xd0302a)));
  drumG.add(barrel, band, flangeB, flangeF, mark, axle, collar, crankG);
  g.add(drumG);

  // ── 줄(곧은 원기둥): 받침 고리 위 → 드럼 접점 (0, 3.10) ──
  const rope = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 12), paint(0xb89a64));
  rope.name = 'rope';
  const ropeLow = new THREE.Object3D();
  ropeLow.name = 'ropeLow';
  g.add(rope, ropeLow);

  // ── 받침(carrier) ──
  const carrier = new THREE.Group();
  carrier.name = 'carrier';
  const bodyPts: V2[] = [[-0.1, -0.14], [0.1, -0.14], [0.1, 0.06], [0.04, 0.06], [0.04, 0.53], [-0.04, 0.53], [-0.04, 0.06], [-0.1, 0.06]];
  const carrierBody = prism(bodyPts, -0.025, 0.025, castIron());
  carrierBody.name = 'carrierBody';
  const crosshead = box(0.24, 0.05, 0.12, 0, 0.555, 0, castIron(), 'crosshead');
  const eye = mesh(new THREE.TorusGeometry(0.04, 0.012, 12, 28), steel());
  eye.name = 'eye';
  eye.position.set(0, 0.62, 0);
  const eyeTop = new THREE.Object3D();
  eyeTop.name = 'eyeTop';
  eyeTop.position.set(0, EYE_TOP, 0);
  const platePts: V2[] = [[-0.25, 0.06], [0.25, 0.06], [0.25, -0.05], [0.12, -0.14], [-0.12, -0.14], [-0.25, -0.05]];
  const plateF = prism(platePts, 0.025, 0.06, castIron());
  plateF.name = 'plateF';
  const plateB = prism(platePts, -0.06, -0.025, castIron());
  plateB.name = 'plateB';
  carrier.add(carrierBody, crosshead, eye, eyeTop, plateF, plateB);
  for (const sx of [-1, 1]) {
    const pinMat = steel();
    const pin = cylZ(0.02, -0.062, 0.062, sx * K.PX, 0, pinMat);
    pin.name = sx > 0 ? 'pinR' : 'pinL';
    carrier.add(pin, cylZ(0.035, 0.06, 0.075, sx * K.PX, 0, steel()), cylZ(0.035, -0.075, -0.06, sx * K.PX, 0, steel()));
  }
  const hookR = hook251(false);
  hookR.name = 'hookR';
  hookR.position.set(K.PX, 0, 0);
  const hookL = hook251(true);
  hookL.name = 'hookL';
  hookL.position.set(-K.PX, 0, 0);
  const springR = coilSpring(0.016, 0.004, 7);
  springR.name = 'springR';
  const springL = coilSpring(0.016, 0.004, 7);
  springL.name = 'springL';
  carrier.add(hookR, hookL, springR, springL);
  g.add(carrier);

  // ── 추(weight): 원점 = 밑면 가운데 ──
  const weight = new THREE.Group();
  weight.name = 'weight';
  const weightBody = box(1.03, 0.5, 0.304, 0, 0.25, -0.05, paint(0x59616d), 'weightBody');
  const wPlate = box(0.1, 0.1, 0.002, 0, 0.25, 0.103, paint(0xf2f2ee), 'wPlate');
  weight.add(weightBody, wPlate);
  // 글자판의 'W' — 얇은 막대 네 개
  const wPts: [number, number][] = [[-0.035, 0.035], [-0.0175, -0.035], [0, 0.005], [0.0175, -0.035], [0.035, 0.035]];
  const wMat = paint(0x1d2128);
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = wPts[i]!;
    const [x1, y1] = wPts[i + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const s = box(0.011, len, 0.003, (x0 + x1) / 2, 0.25 + (y0 + y1) / 2, 0.1045, wMat);
    s.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
    weight.add(s);
  }
  for (const sx of [-1, 1]) {
    for (const [y0, y1] of [[0.03, 0.11], [0.39, 0.47]] as [number, number][]) {
      for (const [z0, z1] of [[0.102, 0.122], [-0.222, -0.202]] as [number, number][]) {
        weight.add(box(0.17, y1 - y0, z1 - z0, sx * 0.485, (y0 + y1) / 2, (z0 + z1) / 2, steel(), 'shoe'));
      }
    }
  }
  weight.add(box(0.07, 0.1, 0.07, 0, 0.55, 0, steel(), 'stem'));
  const tPts: V2[] = [[-0.12, 0.6], [0.12, 0.6], [0.12, 0.63], [0.09, 0.66], [-0.09, 0.66], [-0.12, 0.63]];
  const tHead = prism(tPts, -0.035, 0.035, steel(), 0.003);
  tHead.name = 'tHead';
  tHead.userData.outline = tPts;
  weight.add(tHead);
  g.add(weight);

  // ── 화살표(감개 옆): 감을 때 시계, 풀 때 반시계 ──
  const arrowCW = rotArrow(0.12, false);
  arrowCW.name = 'arrowWind';
  const arrowCCW = rotArrow(0.12, true);
  arrowCCW.name = 'arrowUnwind';
  arrowCW.position.set(DRUM_C[0], DRUM_C[1], 0.2);
  arrowCCW.position.set(DRUM_C[0], DRUM_C[1], 0.2);
  g.add(arrowCW, arrowCCW);

  // ── 이름표 6개(z 0.4, 기구 바깥) ──
  const Z = 0.4;
  const tHook = leaderTo(tag('고리 A(집게)', v(1.25, 0, Z)), 'hookR');
  const tSlot = leaderTo(tag('홈 B(틀 꼭대기)', v(1.25, 2.87, Z)), 'slotB');
  const tWeight = leaderTo(tag('추 W', v(-1.25, 0, Z)), 'weightBody');
  const tPile = leaderTo(tag('말뚝', v(1.25, 0.45, Z)), 'pile');
  const tCarrier = leaderTo(tag('고리 받침', v(-1.25, 0, Z)), 'carrierBody');
  const tDrum = leaderTo(tag('감개(줄을 감음)', v(-1.1, 3.1, Z)), 'drum');
  g.add(tHook, tSlot, tWeight, tPile, tCarrier, tDrum);

  // ── 스프링: 받침 기둥 면 → 집게 윗팔 안쪽 면 (집게 각을 따라 늘고 줄어듦) ──
  const placeSpring = (spr: THREE.Mesh, sx: number, a: number): void => {
    const ang = sx * a;
    const qx = sx * 0.1315;
    const qy = 0.3691;
    const p1x = sx * K.PX + qx * Math.cos(ang) - qy * Math.sin(ang);
    const p1y = qx * Math.sin(ang) + qy * Math.cos(ang);
    const p0x = sx * 0.04;
    const p0y = 0.369;
    spr.position.set(p0x, p0y, 0);
    spr.rotation.z = Math.atan2(p1y - p0y, p1x - p0x);
    spr.scale.x = Math.hypot(p1x - p0x, p1y - p0y);
  };

  let st = state251(0);
  const apply = (): void => {
    st = state251(t);
    const { Yp, alpha, Wb } = st;
    carrier.position.set(0, Yp, 0);
    hookR.rotation.z = alpha;
    hookL.rotation.z = -alpha;
    placeSpring(springR, 1, alpha);
    placeSpring(springL, -1, alpha);
    weight.position.set(0, Wb, 0);
    // 말뚝(머리 높이·투명도)
    const h = st.pileTop;
    pile.scale.y = h - PILE_Y0;
    pile.position.set(0, PILE_Y0 + (h - PILE_Y0) / 2, -0.05);
    pileRing.position.set(0, h - 0.004 - 0.01, -0.05);
    pileMat.opacity = st.pileOpacity;
    ringMat.opacity = st.pileOpacity;
    pile.visible = pileRing.visible = st.pileOpacity > 0.003;
    // 줄: 아래 끝은 받침 고리 위 끝과 같은 변수에서
    const yEye = Yp + EYE_TOP;
    ropeLow.position.set(0, yEye, 0);
    rope.position.set(0, (yEye + DRUM_C[1]) / 2, 0);
    rope.scale.y = DRUM_C[1] - yEye;
    // 감개: 올릴 때 시계 방향(−)
    drumG.rotation.z = st.drum;
    const tc = st.tc;
    arrowCW.visible = tc < 5.5;
    arrowCCW.visible = tc >= 6.5 && tc < 10.5;
    // 이름표(움직이는 부품을 따라감)
    tHook.position.y = Yp + 0.45;
    tWeight.position.y = Wb + 0.25;
    tCarrier.position.y = Yp + 0.3;
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 5.6], target: [0, 1.68, 0] },
    notes: () => [
      { label: '단계', value: st.phase },
      { label: '받침 높이', value: st.Yp.toFixed(3) },
      { label: '고리 각', value: ((st.alpha * 180) / Math.PI).toFixed(1) + '°' },
      { label: '추', value: st.hanging ? '매달림' : st.Wb > st.pileTop + 0.005 ? '떨어지는 중' : '말뚝 위' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
