// 266 피치가 다른 두 나사 — 한 축에 피치 0.12·0.09 나사 두 구간. 축이 고정 암나사 속을 파고들며 옆으로 나아가고(한 바퀴 0.12),
// 움직이는 기둥은 고운 나사가 밀어 되돌려(한 바퀴 0.09) 차이 0.03 만 나아간다 — 크게 움직이는 축 vs 조금 움직이는 베어링.
// 설계표 docs/mm507-sheets/266.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, tag } from '../kit';
import { K266, nutPost266, state266 } from '../kit/k266';
import { aluminum, castIron, darkSteel, glow, paint, steel, wood } from '../../models/materials';
import { extrude, hexPrism, lathe, merge, mesh, rodProfile, shapeFrom, threadedRod, tubeProfile, TAU } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const K = K266;

export default function buildM266(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // ── 다리 둘 + 바닥판(고정) ──
  const legs = new THREE.Group();
  legs.name = 'legs';
  for (const x of [-1.6, 1.6]) {
    const leg = mesh(new THREE.BoxGeometry(0.2, 0.42, 0.45), castIron());
    leg.position.set(x, 0.39, 0.125); // x ±1.70~±1.50, y 0.18~0.60, z −0.10~0.35
    legs.add(leg);
  }
  g.add(legs);

  const bed = mesh(
    extrude(
      shapeFrom([
        [-1.8, 0.6],
        [1.8, 0.6],
        [1.8, 0.79],
        [1.79, 0.8],
        [-1.79, 0.8],
        [-1.8, 0.79]
      ]),
      0.65
    ),
    castIron()
  );
  bed.name = 'bed'; // x −1.80~1.80, y 0.60~0.80, z −0.20~0.45, 위 모서리 모따기 0.01
  bed.position.z = 0.125;
  g.add(bed);

  // ── 고정 기둥(기둥 몸 + 둥근 발 + 볼트 2, 고정) ──
  const fixedStand = new THREE.Group();
  fixedStand.name = 'fixedStand';
  const fixedPost = nutPost266(-1.0, -0.76, 0.8);
  fixedPost.name = 'fixedPost'; // x −1.00~−0.76, 암나사 구멍(반지름 0.122)
  fixedStand.add(fixedPost);
  const footPts: [number, number][] = [
    [-0.76, 0.8],
    [-0.4, 0.8],
    [-0.4, 0.88],
    [-0.64, 0.88]
  ];
  for (let i = 1; i <= 7; i++) {
    const a = -PI / 2 - (PI / 2) * (i / 7); // 1/4 원호, 중심 (−0.64, 1.00), 반지름 0.12, −90°→−180° 8점
    footPts.push([-0.64 + 0.12 * Math.cos(a), 1.0 + 0.12 * Math.sin(a)]);
  }
  const fixedFoot = mesh(extrude(shapeFrom(footPts), 0.36), castIron());
  fixedFoot.name = 'fixedFoot'; // z −0.08~0.28
  fixedFoot.position.z = 0.1;
  fixedStand.add(fixedFoot);
  const boltHeadGeo = hexPrism(0.07, 0.039, true, false); // 머리 y 0.881~0.920
  const boltBodyGeo = lathe(rodProfile(0.02, 0.8, 0.881), 16); // 몸은 발 속(보이지 않음)
  for (const bx of [-0.62, -0.48]) {
    const head = mesh(boltHeadGeo, darkSteel());
    head.position.set(bx, 0.9005, 0.1);
    const body = mesh(boltBodyGeo, darkSteel());
    body.position.set(bx, 0, 0.1);
    fixedStand.add(head, body);
  }
  g.add(fixedStand);

  // ── 안내 레일 2(L 자: 몸 + 턱, 고정) — 블록이 옆으로만 미끄러지게 ──
  const guideRail = new THREE.Group();
  guideRail.name = 'guideRail';
  const railBoxes: [number, number, number, number, number][] = [
    // [x0, y0, z0, x1, y1] — z1 은 아래에서
    [0.4, 0.8, 0.342, 1.4, 0.9], // 앞 몸
    [0.4, 0.882, 0.3, 1.4, 0.9], // 앞 턱
    [0.4, 0.8, -0.22, 1.4, 0.9], // 뒤 몸
    [0.4, 0.882, -0.142, 1.4, 0.9] // 뒤 턱
  ];
  const railZ1 = [0.42, 0.342, -0.142, -0.1];
  railBoxes.forEach(([x0, y0, z0, x1, y1], i) => {
    const z1 = railZ1[i]!;
    const b = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), darkSteel());
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    guideRail.add(b);
  });
  g.add(guideRail);

  // ── 눈금판(고정) — 한 칸 = 한 바퀴 = 0.03 ──
  const scale = new THREE.Group();
  scale.name = 'scale';
  const plate = mesh(new THREE.BoxGeometry(0.25, 0.004, 0.06), aluminum()); // x 0.75~1.00, y 0.900~0.904, z 0.35~0.41
  plate.position.set(0.875, 0.902, 0.38);
  scale.add(plate);
  const darkTicks: THREE.BufferGeometry[] = [];
  const redTicks: THREE.BufferGeometry[] = [];
  for (let k = 0; k <= 5; k++) {
    const tick = new THREE.BoxGeometry(0.005, 0.003, 0.04);
    tick.translate(0.8 + 0.03 * k, 0.9055, 0.38); // y 0.904~0.907, z 0.36~0.40
    (k === 0 ? redTicks : darkTicks).push(tick);
  }
  scale.add(mesh(merge(darkTicks), paint(0x222222)));
  scale.add(mesh(merge(redTicks), paint(0xd2352e)));
  g.add(scale);

  // ── 움직이는 베어링(받침 블록 + 기둥 몸 + 바늘, 매 프레임 position.x = w) ──
  const movingBearing = new THREE.Group();
  movingBearing.name = 'movingBearing';
  const slideBlock = mesh(new THREE.BoxGeometry(0.4, 0.08, 0.48), castIron());
  slideBlock.name = 'slideBlock'; // x 0.60~1.00, y 0.80~0.88, z −0.14~0.34
  slideBlock.position.set(0.8, 0.84, 0.1);
  movingBearing.add(slideBlock);
  const movingNut = nutPost266(0.7, 0.9, 0.88);
  movingNut.name = 'movingNut'; // x 0.70~0.90, 블록 윗면 0.88 에 앉음
  movingBearing.add(movingNut);
  const pointer = mesh(new THREE.BoxGeometry(0.01, 0.008, 0.125), paint(0xd2352e));
  pointer.name = 'pointer'; // x 0.795~0.805, y 0.910~0.918, z 0.275~0.40, 뿌리가 기둥 앞면에 박힘
  pointer.position.set(0.8, 0.914, 0.3375);
  movingBearing.add(pointer);
  g.add(movingBearing);

  // ── 축 묶음(원점 (0, 1.40, 0.10), position.x = u, rotation.x = θ) ──
  const shaft = new THREE.Group();
  shaft.name = 'shaft';
  shaft.position.set(0, K.Y_AXIS, K.Z_AXIS);
  setMM(shaft, { kind: 'shaft', axis: 'x' });
  const plainShaft = mesh(lathe(rodProfile(0.06, -1.8, 0.2, 0.004, 0.004), 28).rotateZ(-PI / 2), steel());
  plainShaft.name = 'plainShaft'; // 반지름 0.06, x −1.80~0.20(나사 속까지 한 막대)
  shaft.add(plainShaft);
  const screwA = mesh(threadedRod({ rMajor: K.SCREW_R, depth: 0.026, pitch: K.P_A, y0: 0, y1: 0.95 }), steel());
  screwA.name = 'screwA';
  screwA.rotation.z = -PI / 2; // 로컬 y → +x, 오른나사 유지
  screwA.position.x = -1.66; // x −1.66~−0.71
  shaft.add(screwA);
  const screwB = mesh(threadedRod({ rMajor: K.SCREW_R, depth: 0.026, pitch: K.P_B, y0: 0, y1: 0.75 }), steel());
  screwB.name = 'screwB';
  screwB.rotation.z = -PI / 2;
  screwB.position.x = 0.2; // x 0.20~0.95
  shaft.add(screwB);
  const shaftEnd = mesh(lathe(rodProfile(0.1, 0.95, 0.97, 0.003, 0.003), 28).rotateZ(-PI / 2), paint(0xd2352e));
  shaftEnd.name = 'shaftEnd'; // 끝 덮개, 원판 반지름 0.10
  shaft.add(shaftEnd);
  const hub = mesh(lathe(tubeProfile(0.06, 0.09, 0, 0.08), 32).rotateZ(-PI / 2), steel());
  hub.position.x = -1.8; // 크랭크 허브 관, x −1.80~−1.72, 구멍 0.06 = 민 축
  shaft.add(hub);
  const crank = mesh(new THREE.BoxGeometry(0.04, 0.24, 0.07), steel());
  crank.name = 'crank'; // 크랭크 팔, x −1.80~−1.76, 축 중심에서 +y 0~0.24(θ = 0 에서 위)
  crank.position.set(-1.78, 0.12, 0);
  shaft.add(crank);
  const gripPin = mesh(lathe(rodProfile(0.02, -1.845, -1.8), 16).rotateZ(-PI / 2), steel());
  gripPin.position.y = 0.24; // 손잡이 핀, 팔 끝
  shaft.add(gripPin);
  const grip = mesh(lathe(rodProfile(0.03, -1.96, -1.845), 20).rotateZ(-PI / 2), wood());
  grip.name = 'grip'; // 손잡이, x −1.96~−1.845
  grip.position.y = 0.24;
  shaft.add(grip);
  g.add(shaft);

  // ── 표시: 회전 화살표(앞으로/되돌림 두 개를 번갈아 켬) + 베어링 이동 화살표 ──
  const rotFwd = rotArrow(0.32, true);
  const rotBack = rotArrow(0.32, false);
  for (const a of [rotFwd, rotBack]) {
    a.rotation.y = PI / 2; // x 축 둘레로
    a.position.set(-1.9, K.Y_AXIS, K.Z_AXIS);
    g.add(a);
  }
  const xArrow = new THREE.Group();
  const arrowMat = glow(0xd8362f, 0.85);
  const arrowBody = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 12).rotateZ(-PI / 2), arrowMat);
  arrowBody.position.x = 0.055;
  const arrowHead = mesh(new THREE.ConeGeometry(0.02, 0.04, 16).rotateZ(-PI / 2), arrowMat);
  arrowHead.position.x = 0.13;
  xArrow.add(arrowBody, arrowHead); // 빨강, 길이 0.15
  xArrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(xArrow, { kind: 'arrow' });
  g.add(xArrow);

  // ── 이름표 6(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('크랭크', v(-1.4, 2.05, 0.5)), 'crank'),
    leaderTo(tag('거친 나사 A', v(-0.3, 2.45, 0.5)), 'screwA'),
    leaderTo(tag('고운 나사 B', v(1.25, 2.45, 0.5)), 'screwB'),
    leaderTo(tag('고정 베어링', v(-1.45, 0.35, 0.6)), 'fixedPost'),
    leaderTo(tag('움직이는 베어링', v(0.15, 0.35, 0.6)), 'movingNut'),
    leaderTo(tag('눈금', v(1.45, 0.45, 0.6)), 'scale')
  );

  let turnsNow = 0;
  let uNow = 0;
  let wNow = 0;
  const apply = (): void => {
    const st = state266(tm);
    turnsNow = st.theta / TAU;
    uNow = st.u;
    wNow = st.w;
    shaft.position.x = st.u;
    shaft.rotation.x = st.theta;
    movingBearing.position.x = st.w;
    rotFwd.position.x = -1.9 + st.u;
    rotBack.position.x = -1.9 + st.u;
    rotFwd.visible = st.dir === 1;
    rotBack.visible = st.dir === -1;
    xArrow.position.set(0.8 + st.w, 1.78, 0.1);
    xArrow.scale.x = st.dir < 0 ? -1 : 1; // 나아갈 때 오른쪽, 돌아올 때 왼쪽
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '크랭크', value: turnsNow.toFixed(2) + ' 바퀴' },
      { label: '축 이동', value: uNow.toFixed(3) + ' (= 0.12 × 바퀴)' },
      { label: '베어링 이동', value: wNow.toFixed(3) + ' (= (0.12 − 0.09) × 바퀴)' },
      { label: '원리', value: '한 바퀴마다 두 피치의 차이(0.03)만큼만 움직인다 — 작은 이동을 정밀하게' }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [0.1, 2.4, 5.4], target: [0, 1.15, 0.1] }
  };
}
