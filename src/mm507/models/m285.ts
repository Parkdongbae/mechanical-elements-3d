// 285 선반 심압대 — 손잡이 바퀴와 나사는 제자리에서 돌고, 돌지 못하는 스핀들 속 너트가 나사를 따라 밀려 나온다(앞 반쪽 단면).
// 설계표 docs/mm507-sheets/285.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, pulley, rotArrow, setMM, tag } from '../kit';
import { halfTube285, K285, spindle285, state285 } from '../kit/k285';
import { castIron, darkSteel, glow, paint, steel } from '../../models/materials';
import {
  circlePath,
  extrude,
  hexPrism,
  lathe,
  merge,
  mesh,
  rodProfile,
  shapeFrom,
  threadedRod,
  trapezoidThread,
  tubeProfile,
  type V2
} from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const { YA, ZC } = K285;

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry =>
  new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** 세계 x 축 원기둥/관(로컬 y → +x) */
const rodX = (r: number, x0: number, x1: number, c = 0.002): THREE.BufferGeometry => lathe(rodProfile(r, x0, x1, c, c), 32).rotateZ(-PI / 2);
const tubeX = (rIn: number, rOut: number, x0: number, x1: number, c = 0.002): THREE.BufferGeometry =>
  lathe(tubeProfile(rIn, rOut, x0, x1, c), 36).rotateZ(-PI / 2);

export default function buildM285(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // ── 베드(고정): 앞·뒤 레일 + 다리 2 ──
  const bed = mesh(
    merge([
      box(-1.75, 1.9, 0.55, 0.8, 0.21, 0.46), // 앞 레일
      box(-1.75, 1.9, 0.55, 0.8, -0.1, 0.15), // 뒤 레일(사이 홈 0.15~0.21 에 볼트)
      box(-1.6, -1.45, 0.18, 0.55, -0.1, 0.46), // 다리
      box(1.7, 1.85, 0.18, 0.55, -0.1, 0.46)
    ]),
    castIron()
  );
  bed.name = 'bed';
  g.add(bed);

  // ── 몸체(고정): x-y 윤곽 + 팔각 창, 깊이 −0.04~0.40 ──
  const cx = 0.19;
  const cy = 1.33;
  const hw = 0.48;
  const hh = 0.32;
  const cc = 0.1;
  const body = shapeFrom([
    [-0.66, 0.8],
    [1.06, 0.8],
    [1.06, 0.9],
    [0.94, 1.0],
    [0.94, 1.85],
    [-0.56, 1.85],
    [-0.56, 0.95],
    [-0.66, 0.9]
  ]);
  const octagon: V2[] = [
    [cx - hw + cc, cy - hh],
    [cx + hw - cc, cy - hh],
    [cx + hw, cy - hh + cc],
    [cx + hw, cy + hh - cc],
    [cx + hw - cc, cy + hh],
    [cx - hw + cc, cy + hh],
    [cx - hw, cy + hh - cc],
    [cx - hw, cy - hh + cc]
  ];
  const hole = new THREE.Path();
  octagon.forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
  hole.closePath();
  body.holes.push(hole);
  const tailBody = mesh(extrude(body, 0.44), castIron());
  tailBody.name = 'tailBody'; // 깊이 −0.04~0.40
  tailBody.position.z = 0.18;
  g.add(tailBody);

  // ── 볼트 + 위·밑 너트 + 밑 판(고정) ──
  const bolt = new THREE.Group();
  bolt.name = 'holdBoltSet';
  const boltBody = mesh(lathe(rodProfile(0.03, 0.42, 1.07), 20), darkSteel());
  boltBody.name = 'holdBolt';
  const nutTop = mesh(hexPrism(0.1, 0.06, true, true, 0.031), darkSteel());
  nutTop.position.y = 1.04; // y 1.01~1.07, 창 바닥에 얹힘
  const nutBot = mesh(hexPrism(0.1, 0.05, true, true, 0.031), darkSteel());
  nutBot.position.y = 0.445; // y 0.42~0.47
  bolt.add(boltBody, nutTop, nutBot);
  bolt.position.set(cx, 0, ZC);
  g.add(bolt);
  const plateShape = shapeFrom([
    [0.02, -0.28],
    [0.36, -0.28],
    [0.36, -0.08],
    [0.02, -0.08]
  ]);
  plateShape.holes.push(circlePath(cx, -ZC, 0.031));
  const plate = mesh(extrude(plateShape, 0.08).rotateX(-PI / 2), castIron());
  plate.name = 'clampPlate';
  plate.position.y = 0.51; // y 0.47~0.55, 레일 아랫면을 받침
  g.add(plate);

  // ── 배럴 + 끝 마개(고정, 앞 반쪽 단면) ──
  const barrel = halfTube285(0.2, 0.3, -0.85, 1.048, castIron(), { slot: [-0.382, -0.318], name: 'barrel' });
  barrel.position.set(0, YA, ZC);
  g.add(barrel);
  const endCap = halfTube285(0.062, 0.3, 1.05, 1.13, castIron(), { name: 'endCap' });
  endCap.position.set(0, YA, ZC);
  g.add(endCap);

  // ── 스핀들 묶음(너트·센터 포함, position.x = x_s) ──
  const spindleGroup = spindle285();
  spindleGroup.position.set(K285.XS0, YA, ZC);
  g.add(spindleGroup);

  // ── 나사 묶음(원점 (0, YA, ZC), rotation.x = θ) ──
  const screwSpin = new THREE.Group();
  screwSpin.name = 'screwSpin';
  screwSpin.position.set(0, YA, ZC);
  setMM(screwSpin, { kind: 'shaft', axis: 'x' });
  const acme = trapezoidThread(0.3, 0.3);
  const screw = mesh(
    threadedRod({ rMajor: K285.RMAJ, depth: K285.DEPTH, pitch: K285.P, y0: -0.25, y1: 0.7, ...acme, chamfer0: true, capTop: true }).rotateZ(-PI / 2),
    steel()
  );
  screw.name = 'screw'; // 세계 x −0.25~0.70
  screwSpin.add(screw);
  const pushGeo = lathe(
    [
      [0, 0.65],
      [0.058, 0.65],
      [0.058, 0.701],
      [0.06, 0.701],
      [0.06, 1.32],
      [0, 1.32]
    ],
    32
  ).rotateZ(-PI / 2);
  const pushShaft = mesh(pushGeo, steel());
  pushShaft.name = 'pushShaft'; // 민 축, 반지름 0.06
  screwSpin.add(pushShaft);
  const collarIn = mesh(tubeX(0.058, 0.11, 0.99, 1.049), darkSteel());
  collarIn.name = 'collarIn';
  const collarOut = mesh(tubeX(0.058, 0.11, 1.131, 1.209), darkSteel());
  collarOut.name = 'collarOut'; // 바퀴 허브(1.21)까지 이어져 나사가 앞뒤로 못 움직임
  screwSpin.add(collarIn, collarOut);

  const wheel = pulley(0.4, { width: 0.06, spokes: 4, hub: 0.06, driver: true });
  wheel.name = 'handWheel';
  wheel.rotation.y = PI / 2; // 축 → 세계 x
  wheel.position.x = 1.26;
  wheel.children[0]!.name = 'handRim';
  screwSpin.add(wheel);
  const knob = mesh(rodX(0.03, 1.285, 1.41, 0.004), paint(0xc0392b));
  knob.name = 'knob';
  knob.position.y = 0.33; // θ = 0 에서 위
  screwSpin.add(knob);
  const endNut = mesh(hexPrism(0.12, 0.03, true, true).rotateZ(-PI / 2), darkSteel());
  endNut.name = 'endNut';
  endNut.position.x = 1.326; // x 1.311~1.341
  screwSpin.add(endNut);
  const mark = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), paint(0xf2b619));
  mark.name = 'yellowMark';
  mark.position.set(0.8, 0, 0.062);
  screwSpin.add(mark);
  g.add(screwSpin);

  // ── 잠금 나사(고정): 끝이 스핀들 키 홈에 들어간다 ──
  const lock = new THREE.Group();
  lock.name = 'lockSet';
  lock.position.set(-0.35, 0, ZC);
  const stem = mesh(lathe(rodProfile(0.03, 2.26, 2.5, 0, 0.003), 24), steel());
  stem.name = 'lockScrew';
  const head = mesh(lathe(tubeProfile(0.03, 0.05, 2.395, 2.46, 0.003), 28), darkSteel());
  head.name = 'lockHead';
  const bar = mesh(lathe(rodProfile(0.015, 0, 0.25, 0.002, 0.002), 16).rotateZ(-PI / 2), steel());
  bar.name = 'lockBar';
  bar.position.y = 2.48; // x −0.35 → −0.10 (그룹 기준 0~0.25)
  const ball = mesh(new THREE.SphereGeometry(0.03, 20, 14), paint(0xc0392b));
  ball.name = 'lockBall';
  ball.position.set(0.25, 2.48, 0);
  lock.add(stem, head, bar, ball);
  g.add(lock);

  // ── 표시: 바퀴 회전 화살표(늘 때/줄 때) + 스핀들 이동 화살 ──
  const rotFwd = rotArrow(0.48, true);
  const rotBack = rotArrow(0.48, false);
  for (const a of [rotFwd, rotBack]) {
    a.rotation.y = PI / 2;
    a.position.set(1.36, YA, ZC);
    g.add(a);
  }
  const xArrow = new THREE.Group();
  const arrowMat = glow(0xf2b619, 0.85);
  const arrowBody = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 12).rotateZ(-PI / 2), arrowMat);
  arrowBody.position.x = 0.055;
  const arrowHead = mesh(new THREE.ConeGeometry(0.02, 0.04, 16).rotateZ(-PI / 2), arrowMat);
  arrowHead.position.x = 0.13;
  xArrow.add(arrowBody, arrowHead);
  xArrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(xArrow, { kind: 'arrow' });
  g.add(xArrow);

  // ── 이름표 6(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('손잡이 바퀴', v(1.75, 2.9, 0.5)), 'handRim'),
    leaderTo(tag('나사', v(0.45, 2.9, 0.5)), 'screw'),
    leaderTo(tag('스핀들', v(-0.95, 2.8, 0.5)), 'spindle'),
    leaderTo(tag('센터', v(-1.6, 1.6, 0.5)), 'center'),
    leaderTo(tag('너트', v(0.05, 1.25, 0.6)), 'nut'),
    leaderTo(tag('심압대 몸체', v(1.5, 1.2, 0.6)), 'tailBody')
  );

  let thetaNow = 0;
  let xsNow = K285.XS0;
  const apply = (): void => {
    const st = state285(tm);
    thetaNow = st.theta;
    xsNow = st.xs;
    screwSpin.rotation.x = st.theta;
    spindleGroup.position.x = st.xs;
    rotFwd.visible = st.dir === 1;
    rotBack.visible = st.dir === -1;
    const s = st.dir === 1 ? -1 : 1; // θ 가 늘면 스핀들이 왼쪽으로
    xArrow.scale.x = s;
    xArrow.position.set(st.xs - 0.4 - 0.075 * s, YA, 0.3);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '바퀴', value: (thetaNow / (2 * PI)).toFixed(2) + ' 바퀴' },
      { label: '스핀들 나온 길이', value: (K285.XS0 - xsNow).toFixed(3) },
      { label: '원리', value: '나사는 제자리에서 돌고, 돌지 못하는 스핀들 속 너트가 나사를 따라 밀려 나온다 — 바퀴 한 바퀴에 나사 한 피치(0.12)' },
      { label: '메모', value: '판화처럼 속이 보이게 배럴·스핀들·너트의 앞 반쪽을 잘라 냈다(주홍 면). 잠금 나사 끝이 스핀들 홈에 들어가 스핀들이 돌지 않는다' }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [2.2, 2.5, 5.4], target: [0.05, 1.6, 0.15] }
  };
}
