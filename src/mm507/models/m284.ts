// 284 톱기계 이송 장치 — 크랭크가 돌면 연결 막대가 벨 크랭크의 가로 팔을 오르내리고, 세로 팔 끝의 굽은 걸쇠가 래칫 톱니 하나를 밀어 바퀴를 15° 돌린다.
// 되돌아갈 때는 비탈을 타고 넘고 멈춤쇠가 거꾸로 도는 것을 막는다. 바퀴 축의 피니언이 수레의 랙을 밀어 수레가 한 번에 0.073 씩 나아간다.
// 크랭크 8 바퀴(16 초) 이송 뒤 걸쇠·멈춤쇠를 들고 수레를 되돌림(4 초, 전시용). 설계표 docs/mm507-sheets/284.md · 키트 kit/k284.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, spurGear, tag } from '../kit';
import { K284, bellCrankOutline284, carriage284, catch284, rail284, ratchet284, state284, type State284 } from '../kit/k284';
import { castIron, darkSteel, glow, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, roundedRect, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K284;
const PI = Math.PI;
const DEG = PI / 180;

/** Z 축 회전체(프로파일 [반지름, 깊이]) */
function revZ(profile: [number, number][], mat: THREE.Material): THREE.Mesh {
  const geo = lathe(profile, 40);
  geo.rotateX(PI / 2);
  return mesh(geo, mat);
}

/** 깊이 z0 → z1 원기둥(양끝 모따기 c) */
function pinZ(r: number, z0: number, z1: number, mat: THREE.Material, c = 0.002): THREE.Mesh {
  return revZ(
    [
      [0, z0],
      [r - c, z0],
      [r, z0 + c],
      [r, z1 - c],
      [r - c, z1],
      [0, z1]
    ],
    mat
  );
}

/** 깊이 z0 → z1 관(안 반지름 rIn, 바깥 rOut) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, mat: THREE.Material, c = 0.002): THREE.Mesh {
  const geo = lathe(tubeProfile(rIn, rOut, z0, z1, c), 48);
  geo.rotateX(PI / 2);
  return mesh(geo, mat);
}

/** 윤곽 → 깊이 z0 ~ z1 판 */
function plate(shape: THREE.Shape, z0: number, z1: number, mat: THREE.Material, c = 0.002): THREE.Mesh {
  const m = mesh(extrude(shape, z1 - z0, c), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** 상자 x0..x1, y0..y1, z0..z1 */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(extrude(roundedRect(x0, y0, x1, y1, 0.006), z1 - z0, 0.004), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** 지시 화살(좌우) — 납작한 화살 모양, 빨강 */
function sideArrow(): THREE.Group {
  const g = new THREE.Group();
  const s = shapeFrom([
    [-0.1, -0.014],
    [0.03, -0.014],
    [0.03, -0.034],
    [0.12, 0],
    [0.03, 0.034],
    [0.03, 0.014],
    [-0.1, 0.014]
  ]);
  g.add(mesh(extrude(s, 0.012, 0.002), glow(0xd8362f, 0.85)));
  g.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(g, { kind: 'arrow' });
  return g;
}

export default function buildM284(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 고정: 레일(뒤판), 뒤판 보스 둘, 벨 크랭크 받침대 ──
  const rail = rail284();
  rail.name = 'rail';
  g.add(rail);

  const wheelBoss = tubeZ(0.038, 0.1, -0.3, -0.2, darkSteel(), 0.003);
  wheelBoss.name = 'wheelBoss';
  wheelBoss.position.set(K.W[0], K.W[1], 0);
  const crankBoss = tubeZ(0.04, 0.1, -0.3, -0.2, darkSteel(), 0.003);
  crankBoss.name = 'crankBoss';
  crankBoss.position.set(K.CR[0], K.CR[1], 0);
  g.add(wheelBoss, crankBoss);

  const bracket = box(K.a[0] - 0.08, K.a[0] + 0.08, K.a[1] - 0.08, K.a[1] + 0.08, -0.3, 0.098, castIron());
  bracket.name = 'pivotBracket';
  const pivotPin = pinZ(0.03, 0.098, 0.196, steel(), 0.002);
  pivotPin.name = 'pivotPin';
  pivotPin.position.set(K.a[0], K.a[1], 0);
  const pivotNut = pinZ(0.05, 0.162, 0.2, darkSteel(), 0.004);
  pivotNut.name = 'pivotNut';
  pivotNut.position.set(K.a[0], K.a[1], 0);
  g.add(bracket, pivotPin, pivotNut);

  // ── 바퀴 묶음(래칫 바퀴 + 피니언 + 축): 시계 방향으로 한 톱니씩 ──
  const wheelSpin = new THREE.Group();
  wheelSpin.name = 'wheelSpin';
  wheelSpin.position.set(K.W[0], K.W[1], 0);
  const shaft = pinZ(0.038, -0.3, 0.11, steel(), 0.002);
  shaft.name = 'wheelShaft';
  const collarBack = tubeZ(0.038, 0.06, -0.2, -0.097, steel(), 0.002);
  collarBack.name = 'collarBack';
  const collarMid = tubeZ(0.038, 0.06, -0.045, 0, steel(), 0.002);
  collarMid.name = 'collarMid';
  const wheelNut = tubeZ(0.038, 0.06, 0.08, 0.11, darkSteel(), 0.003);
  wheelNut.name = 'wheelNut';
  const ratchet = ratchet284();
  ratchet.name = 'ratchetWheel';
  const pinion = spurGear(16, 0.035, { width: 0.05, spokes: 0 });
  pinion.name = 'pinion';
  pinion.position.z = -0.07;
  wheelSpin.add(shaft, collarBack, collarMid, wheelNut, ratchet, pinion);
  g.add(wheelSpin);

  // ── 벨 크랭크 묶음(받침 a 둘레 λ) ──
  const bellArm = new THREE.Group();
  bellArm.name = 'bellCrankArm';
  bellArm.position.set(K.a[0], K.a[1], 0);
  const bcShape = shapeFrom(bellCrankOutline284());
  bcShape.holes.push(
    circlePath(0, 0, 0.031),
    circlePath(K.LH, 0, 0.026),
    circlePath(0, 0.15, 0.02),
    stadiumShape(0, -0.25, 0, -0.6, 0.04)
  );
  const bellCrank = plate(bcShape, 0.1, 0.16, steel(), 0.002);
  bellCrank.name = 'bellCrank';
  const screwGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 16);
  const screw = mesh(screwGeo, darkSteel());
  screw.name = 'adjustScrew';
  screw.position.set(0, -0.41, 0.13);
  const catchPin = pinZ(0.02, 0.005, 0.2, steel(), 0.002);
  catchPin.name = 'catchPin';
  catchPin.position.set(0, -K.LV, 0);
  const catchNut = pinZ(0.04, 0.162, 0.19, darkSteel(), 0.004);
  catchNut.name = 'catchNut';
  catchNut.position.set(0, -K.LV, 0);
  const ePin = pinZ(0.025, 0.1, 0.23, steel(), 0.002);
  ePin.name = 'ePin';
  ePin.position.set(K.LH, 0, 0);
  bellArm.add(bellCrank, screw, catchPin, catchNut, ePin);
  g.add(bellArm);

  // ── 크랭크 묶음 ──
  const crankSpin = new THREE.Group();
  crankSpin.name = 'crankSpin';
  crankSpin.position.set(K.CR[0], K.CR[1], 0);
  const crankArm = plate(stadiumShape(0, 0, K.RC, 0, 0.12), 0.08, 0.14, castIron(), 0.003);
  crankArm.name = 'crankArm';
  const crankAxle = pinZ(0.04, -0.3, 0.136, steel(), 0.002);
  crankAxle.name = 'crankAxle';
  const crankPin = pinZ(0.025, 0.136, 0.23, steel(), 0.002);
  crankPin.name = 'crankPin';
  crankPin.position.x = K.RC;
  const crankDot = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 20).rotateX(PI / 2), paint(0xf2b619));
  crankDot.name = 'crankDot';
  crankDot.position.set(0.3, 0, 0.1415);
  crankSpin.add(crankArm, crankAxle, crankPin, crankDot);
  g.add(crankSpin);

  // ── 연결 막대 ──
  const rod = new THREE.Group();
  rod.name = 'rodRig';
  const rodShape = stadiumShape(0, 0, K.LR, 0, 0.07);
  rodShape.holes.push(circlePath(0, 0, 0.027), circlePath(K.LR, 0, 0.027));
  const rodBar = plate(rodShape, 0.17, 0.21, steel(), 0.002);
  rodBar.name = 'rod';
  const nutC = pinZ(0.045, 0.212, 0.235, darkSteel(), 0.004);
  nutC.name = 'rodNutCrank';
  const nutE = pinZ(0.045, 0.212, 0.235, darkSteel(), 0.004);
  nutE.name = 'rodNutE';
  nutE.position.x = K.LR;
  rod.add(rodBar, nutC, nutE);
  g.add(rod);

  // ── 걸쇠와 멈춤쇠 ──
  const catchArm = new THREE.Group();
  catchArm.name = 'catchArm';
  const catchBody = catch284(K.LC, 140);
  catchBody.name = 'catch';
  catchArm.add(catchBody);
  g.add(catchArm);

  const detentArm = new THREE.Group();
  detentArm.name = 'detentArm';
  detentArm.position.set(K.HD[0], K.HD[1], 0);
  const detentBody = catch284(K.LD, 160);
  detentBody.name = 'detent';
  detentArm.add(detentBody);
  g.add(detentArm);
  const detentPin = pinZ(0.02, -0.3, 0.086, steel(), 0.002);
  detentPin.name = 'detentPin';
  detentPin.position.set(K.HD[0], K.HD[1], 0);
  const detentNut = pinZ(0.04, 0.072, 0.09, darkSteel(), 0.004);
  detentNut.name = 'detentNut';
  detentNut.position.set(K.HD[0], K.HD[1], 0);
  g.add(detentPin, detentNut);

  // ── 수레(랙 포함) ──
  const carriage = carriage284();
  carriage.name = 'carriageRig';
  g.add(carriage);

  // ── 화살표 ──
  const crankArrow = rotArrow(0.55, true);
  crankArrow.position.set(K.CR[0], K.CR[1], 0.25);
  const wheelArrow = rotArrow(0.62, false);
  wheelArrow.position.set(K.W[0], K.W[1], 0.1);
  const cartArrow = sideArrow();
  g.add(crankArrow, wheelArrow, cartArrow);

  // ── 이름표 7(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('래칫 바퀴', v(-1.85, 0.7, 0.3)), 'ratchetWheel'),
    leaderTo(tag('걸쇠', v(0.05, 1.95, 0.3)), 'catch'),
    leaderTo(tag('멈춤쇠', v(-1.85, 1.3, 0.3)), 'detent'),
    leaderTo(tag('벨 크랭크', v(-0.3, 3.05, 0.3)), 'bellCrank'),
    leaderTo(tag('크랭크', v(1.75, 0.8, 0.3)), 'crankArm'),
    leaderTo(tag('랙', v(-0.05, 1.4, 0.3)), 'rack'),
    leaderTo(tag('수레', v(1.75, 2.35, 0.3)), 'carriage')
  );

  let st: State284 = state284(0);
  const apply = (): void => {
    st = state284(t);
    crankSpin.rotation.z = st.chi;
    bellArm.rotation.z = st.lambda;
    rod.position.set(st.Pc[0], st.Pc[1], 0);
    rod.rotation.z = Math.atan2(st.E[1] - st.Pc[1], st.E[0] - st.Pc[0]);
    catchArm.position.set(st.K[0], st.K[1], 0);
    catchArm.rotation.z = st.gammaC;
    detentArm.rotation.z = st.gammaD;
    wheelSpin.rotation.z = st.psi;
    carriage.position.x = st.X;
    const tt = ((t % K.PERIOD) + K.PERIOD) % K.PERIOD;
    crankArrow.visible = tt < 16;
    wheelArrow.visible = st.pushing;
    cartArrow.visible = tt < 16 || st.phase === 'back';
    cartArrow.rotation.z = st.phase === 'back' ? PI : 0;
    cartArrow.position.set(st.X + 1.45, 2.2, 0);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.0, 1.8, 6.3], target: [-0.1, 1.75, 0] },
    notes: () => [
      { label: '크랭크', value: st.phase === 'feed' ? `${st.k + 1} / 8 바퀴` : '되돌림' },
      { label: '바퀴 이송', value: `${((-st.psi) / (15 * DEG)).toFixed(2)} 톱니` },
      { label: '수레 위치', value: st.X.toFixed(3) },
      { label: '원리', value: '걸쇠가 톱니 하나를 밀어 바퀴를 15° 돌리고, 되돌아갈 때는 비탈을 타고 넘는다. 멈춤쇠가 바퀴가 거꾸로 도는 것을 막는다' },
      { label: '메모', value: '피니언은 래칫 바퀴 뒤에 있어 바퀴 창으로 보인다. 이송량 조절 나사는 모양만 두었고 한 번에 한 톱니씩 보낸다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
