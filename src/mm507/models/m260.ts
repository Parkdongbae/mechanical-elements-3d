// 260 차동 나사 — 위 축 A 의 피니언 F(8)·B(14)가 바퀴 D(48, 나사와 한 몸)·E(42, 너트와 한 몸)를 물린다.
// E 가 D 의 두 배로 돌아 너트가 나사를 앞지르므로 나사가 차이만큼 천천히 오른쪽으로 나아간다(눈금자로 읽음).
// D 는 나사와 함께 옆으로 미끄러져도 긴 피니언 F 와 계속 물린다 — 설계표 docs/mm507-sheets/260.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, meshAngle, rotArrow, setMM, spurGear, tag } from '../kit';
import { pedestalX, wallBearing } from '../kit/gear6';
import { K260, state260 } from '../kit/k260';
import { aluminum, bronze, darkSteel, glow, paint, steel } from '../../models/materials';
import { hexPrism, lathe, merge, mesh, rodProfile, threadedRod, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const K = K260;

// 초기 위상(기어 평면 (−z, y)): F·B 는 0, D·E 는 meshAngle 로 물림에 맞춘다
const D0 = meshAngle([0, K.YA], K.Z_F, 0, [0, K.YC], K.Z_D);
const E0 = meshAngle([0, K.YA], K.Z_B, 0, [0, K.YC], K.Z_E);

/** 세계 +x 축 기어 묶음: 바깥 rotation.y = π/2(로컬 z → 세계 +x), 안쪽 spurGear rotation.z = 초기 위상 */
function gearX(name: string, teeth: number, width: number, spokes: number, driver: boolean, x: number): THREE.Group {
  const w = new THREE.Group();
  w.name = name;
  w.position.x = x;
  w.rotation.y = PI / 2;
  const gr = spurGear(teeth, K.M, { width, spokes, driver });
  gr.rotation.z = 0;
  w.add(gr);
  return w;
}

export default function buildM260(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // ── 기둥·베어링(고정) ──
  const standL = new THREE.Group();
  standL.name = 'standL';
  standL.add(pedestalX(-1.57, K.YA, K.ZC, -1, 0.18, 0.041));
  const ringL = mesh(lathe(tubeProfile(0.046, 0.096, -0.07, 0.07, 0.008), 36), darkSteel());
  ringL.rotation.z = PI / 2; // 관 축 → +x (민 축 베어링)
  ringL.position.set(-1.57, K.YC, K.ZC);
  standL.add(ringL);
  g.add(standL);

  const standR = pedestalX(1.2, K.YC, K.ZC, 1, 0.18, 0.0598); // 너트 허브 베어링
  standR.name = 'standR';
  g.add(standR);

  const bearingA = wallBearing(1.5, K.YA, K.ZC, 'x', 0.041); // 축 A 오른쪽 벽 베어링
  bearingA.name = 'bearingA';
  g.add(bearingA);

  // ── 구동축 A(피니언 F·B + 손 크랭크) ──
  const shaftA = new THREE.Group();
  shaftA.name = 'shaftA';
  shaftA.position.set(0, K.YA, K.ZC);
  setMM(shaftA, { kind: 'shaft', axis: 'x' });
  const axle = mesh(lathe(rodProfile(0.04, -1.7, 1.62, 0.004, 0.004), 28), steel());
  axle.rotation.z = -PI / 2;
  shaftA.add(axle);
  shaftA.add(gearX('pinionF', K.Z_F, 1.32, 0, true, -0.66));
  shaftA.add(gearX('pinionB', K.Z_B, 0.16, 0, true, 0.93));
  const crank = new THREE.Group();
  crank.name = 'crank';
  const arm = mesh(new THREE.BoxGeometry(0.02, 0.15, 0.04), steel());
  arm.position.set(-1.69, -0.075, 0);
  const grip = mesh(lathe(rodProfile(0.012, -1.8, -1.7, 0.003, 0.003), 16), paint(0xd8362f));
  grip.rotation.z = -PI / 2;
  grip.position.set(0, -0.15, 0);
  crank.add(arm, grip);
  shaftA.add(crank);
  g.add(shaftA);

  // ── 나사 묶음(민 축·나사·바퀴 D·덧통·끝 덮개 — 한 몸, θD 로 돌고 xs 로 미끄러짐) ──
  const screwC = new THREE.Group();
  screwC.name = 'screwC';
  screwC.position.set(0, K.YC, K.ZC);
  setMM(screwC, { kind: 'shaft', axis: 'x' });
  const screwShaft = mesh(lathe(rodProfile(0.045, -1.8, -0.16, 0.004, 0.004), 28), steel());
  screwShaft.name = 'screwShaft';
  screwShaft.rotation.z = -PI / 2;
  screwC.add(screwShaft);
  const screw = mesh(threadedRod({ rMajor: 0.055, depth: 0.013, pitch: K.PITCH, y0: 0, y1: 1.71 }), steel());
  screw.name = 'screw';
  screw.rotation.z = -PI / 2; // 로컬 y → +x, 오른나사 유지
  screw.position.x = -0.16;
  screwC.add(screw);
  screwC.add(gearX('gearD', K.Z_D, 0.14, 6, false, -0.23));
  const bushD = mesh(lathe(tubeProfile(0.045, 0.0672, -0.318, -0.142, 0.004), 32), darkSteel());
  bushD.name = 'bushD';
  bushD.rotation.z = -PI / 2;
  screwC.add(bushD);
  const screwEnd = mesh(lathe(rodProfile(0.06, 1.55, 1.57, 0.003, 0.003), 28), paint(0xd8362f));
  screwEnd.name = 'screwEnd'; // 눈금 바늘
  screwEnd.rotation.z = -PI / 2;
  screwC.add(screwEnd);
  g.add(screwC);

  // ── 너트 묶음(바퀴 E·허브·너트 머리·고리 2 — 한 몸, 제자리에서 θE 로 돎) ──
  const nutE = new THREE.Group();
  nutE.name = 'nutE';
  nutE.position.set(0, K.YC, K.ZC);
  setMM(nutE, { kind: 'shaft', axis: 'x' });
  nutE.add(gearX('gearE', K.Z_E, 0.16, 6, false, 0.93));
  const nutHub = mesh(
    lathe(
      [
        [0.057, 0.8],
        [0.0588, 0.8],
        [0.0588, 1.31],
        [0.057, 1.31],
        [0.057, 0.8]
      ],
      32
    ),
    bronze()
  );
  nutHub.name = 'nutHub';
  nutHub.rotation.z = -PI / 2;
  nutE.add(nutHub);
  const nut = mesh(hexPrism(0.18, 0.04, true, true, 0.057), bronze());
  nut.name = 'nut';
  nut.rotation.z = -PI / 2;
  nut.position.x = 0.8;
  nutE.add(nut);
  const collarGeo = (x0: number, x1: number): THREE.BufferGeometry =>
    lathe(tubeProfile(0.0588, 0.09, x0, x1, 0.003), 32).rotateZ(-PI / 2);
  const collarL = mesh(collarGeo(1.09, 1.13), steel());
  collarL.name = 'collarL';
  const collarR = mesh(collarGeo(1.27, 1.31), steel());
  collarR.name = 'collarR';
  nutE.add(collarL, collarR); // 낮은 기둥 보스 양 끝면을 막아 옆 이동 차단
  g.add(nutE);

  // ── 눈금자(고정): 나사 끝 빨간 덮개가 눈금 위를 지나며 이동을 읽는다 ──
  const scale = new THREE.Group();
  scale.name = 'scale';
  const plate = mesh(new THREE.BoxGeometry(0.4, 0.02, 0.16), aluminum());
  plate.position.set(1.6, 1.11, 0.28);
  scale.add(plate);
  const darkTicks: THREE.BufferGeometry[] = [];
  const redTicks: THREE.BufferGeometry[] = [];
  for (let k = -7; k <= 12; k++) {
    const x = 1.55 + k * 0.02; // 0 눈금 = x 1.55 (나사 끝 초기 자리)
    const len = k % 5 === 0 ? 0.16 : 0.1; // 0.1 마다 긴 눈금
    const box = new THREE.BoxGeometry(0.004, 0.008, len);
    box.translate(x, 1.125, 0.28);
    (k === 0 ? redTicks : darkTicks).push(box);
  }
  scale.add(mesh(merge(darkTicks), darkSteel()));
  scale.add(mesh(merge(redTicks), paint(0xd8362f)));
  const post = mesh(new THREE.BoxGeometry(0.04, 0.92, 0.04), darkSteel());
  post.position.set(1.76, 0.64, 0.28);
  scale.add(post);
  g.add(scale);

  // ── 표시: 축 A 회전 화살표 + 나사 이동 화살표 ──
  const rArrow = rotArrow(0.2, true); // θA 가 커지는 방향(크랭크와 같음)
  rArrow.rotation.y = PI / 2; // x 축 둘레로
  rArrow.position.set(-1.75, K.YA, K.ZC);
  g.add(rArrow);

  const xArrow = new THREE.Group();
  const aMat = glow(0xd8362f, 0.85);
  const aBody = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 12).rotateZ(-PI / 2), aMat);
  aBody.position.x = 0.055;
  const aHead = mesh(new THREE.ConeGeometry(0.02, 0.04, 16).rotateZ(-PI / 2), aMat);
  aHead.position.x = 0.13;
  xArrow.add(aBody, aHead);
  xArrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(xArrow, { kind: 'arrow' });
  g.add(xArrow);

  // ── 이름표 7(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('구동축 A', v(-1.2, 2.25, 0.5)), 'shaftA'),
    leaderTo(tag('긴 피니언 F', v(-0.5, 2.55, 0.5)), 'pinionF'),
    leaderTo(tag('피니언 B', v(0.95, 2.45, 0.5)), 'pinionB'),
    leaderTo(tag('바퀴 D(나사에 고정)', v(-0.85, 0.45, 0.5)), 'gearD'),
    leaderTo(tag('바퀴 E(너트 달림)', v(0.55, 0.45, 0.5)), 'gearE'),
    leaderTo(tag('나사 C', v(0.4, 2.0, 0.5)), 'screw'),
    leaderTo(tag('눈금(나사 이동)', v(1.75, 0.7, 0.5)), 'scale')
  );

  let omegaA = 0;
  let xsNow = 0;
  const apply = (): void => {
    const st = state260(tm);
    omegaA = st.omegaA;
    xsNow = st.xs;
    shaftA.rotation.x = st.thetaA;
    screwC.position.x = st.xs;
    screwC.rotation.x = D0 + st.thetaD;
    nutE.rotation.x = E0 + st.thetaE;
    xArrow.position.set(1.66 + st.xs, 1.32, K.ZC);
    xArrow.scale.x = st.omegaA >= 0 ? 1 : -1; // 나아갈 때 오른쪽, 돌아올 때 왼쪽
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '축 A 각속도', value: omegaA.toFixed(2) + ' rad/s' },
      { label: 'D·E 속도', value: 'D = A/6, E = A/3 (E 가 두 배 빠름)' },
      { label: '나사 이동', value: xsNow.toFixed(4) },
      { label: '원리', value: '이동 = 피치 × (D 회전 − E 회전)/2π — 같은 속도면 0' }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [1.6, 2.1, 5.0], target: [0, 1.25, 0.28] }
  };
}
