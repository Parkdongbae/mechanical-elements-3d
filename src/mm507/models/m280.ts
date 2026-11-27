// 280 마찰로 감는 윈들러스 — 손잡이 레버를 흔들면 연결 막대가 짧은 레버를 올렸다 내린다. 올릴 때 레버 끝(편심 원)과 블록 플랜지가 테를 물어 바퀴가 함께 돌고,
// 내릴 때는 놓고 블록만 테 위를 미끄러져 내려간다. 거꾸로 도는 것은 래칫과 폴 둘이 막는다. 설계표 docs/mm507-sheets/280.md · 키트 kit/k280.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, markAnchor, rotArrow, setMM, shaftZ, tag } from '../kit';
import { ratchetWheel } from '../kit/gear6';
import {
  K280,
  handLever280,
  handLeverOutline280,
  jawOutline280,
  jawPlate280,
  pawl280,
  pawlAngle280,
  pawlOutline280,
  sdfOutline,
  shortLever280,
  shortLeverOutline280,
  state280,
  type State280
} from '../kit/k280';
import { bronze, castIron, darkSteel, glow, paint, steel, wood } from '../../models/materials';
import { annularSector, extrude, lathe, mesh, roundedRect, shapeFrom, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K280;
const PI = Math.PI;
const DEG = PI / 180;

/** 깊이 z0 → z1 의 Z 축 회전체(프로파일 [반지름, 깊이]) */
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

/** 지시선 화살(좌우) — 납작한 화살 모양, 빨강 */
function sideArrow(dir: 1 | -1): THREE.Group {
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
  if (dir < 0) g.rotation.z = PI;
  g.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(g, { kind: 'arrow' });
  return g;
}

export default function buildM280(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 틀(고정, 나무) ──
  const woodMat = wood(0x8a6a44);
  const FZ0 = -0.3;
  const FZ1 = -0.16;
  const postR = box(0.88, 1.02, 0.18, 2.95, FZ0, FZ1, woodMat);
  postR.name = 'postR';
  const postL = box(-0.62, -0.3, 0.18, 1.92, FZ0, FZ1, woodMat);
  postL.name = 'postL';
  // 겹치는 곳은 앞면을 0.002 어긋나게(빗장이 가장 앞, 폴 받침이 가장 뒤)
  const bracket = box(-0.3, 0.28, 1.55, 2.0, FZ0, FZ1 - 0.002, woodMat);
  bracket.name = 'pawlBracket';
  const braceLen = Math.hypot(0.95 + 0.46, 2.95 - 1.92);
  const brace = box(-braceLen / 2, braceLen / 2, -0.06, 0.06, FZ0, FZ1 + 0.002, woodMat);
  brace.name = 'brace';
  brace.position.x = (-0.46 + 0.95) / 2;
  brace.position.y = (1.92 + 2.95) / 2;
  brace.rotation.z = Math.atan2(2.95 - 1.92, 0.95 + 0.46);
  g.add(postR, postL, bracket, brace);

  // ── 바퀴 축 ──
  const shaft = shaftZ(K.W[0], K.W[1], 0.175, 0.06);
  shaft.name = 'wheelShaft';
  g.add(shaft);

  // ── 마찰 바퀴 ──
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  wheel.position.set(K.W[0], K.W[1], 0);
  const rimGeo = lathe(tubeProfile(K.R_IN, K.R_OUT, 0, 0.1, 0.004), 112);
  rimGeo.rotateX(PI / 2);
  const rim = mesh(rimGeo, steel({ roughness: 0.35 }));
  rim.name = 'wheelRim';
  const webGeo = lathe(tubeProfile(0.135, 0.555, 0.03, 0.07, 0.003), 96);
  webGeo.rotateX(PI / 2);
  const web = mesh(webGeo, bronze());
  web.name = 'wheelWeb';
  const hubGeo = lathe(tubeProfile(0.06, 0.14, -0.069, 0.12, 0.004), 56);
  hubGeo.rotateX(PI / 2);
  const hub = mesh(hubGeo, darkSteel());
  hub.name = 'wheelHub';
  wheel.add(rim, web, hub);
  for (let k = 0; k < 3; k++) {
    const a = (k * 120 * PI) / 180;
    const mk = mesh(new THREE.BoxGeometry(0.05, 0.016, 0.003), paint(0xf2b619));
    mk.name = 'wheelMark';
    mk.position.set(0.605 * Math.cos(a), 0.605 * Math.sin(a), 0.1017);
    mk.rotation.z = a;
    wheel.add(mk);
  }
  setMM(wheel, { kind: 'wheel', fn: 'frictionWheel280', axis: 'z', r: K.R_OUT, width: 0.1, span: [0, 0.1] });
  g.add(wheel);

  // ── 래칫 바퀴(바퀴 뒤, 같은 축) ──
  const ratchet = ratchetWheel(K.RATCHET.teeth, K.RATCHET.rOut, K.RATCHET.rRoot, 0.06, 0.062);
  ratchet.name = 'ratchet';
  (ratchet.children[0] as THREE.Mesh).name = 'ratchetBody';
  ratchet.position.set(K.W[0], K.W[1], -0.1);
  g.add(ratchet);

  // ── 집게(블록) ──
  const clamp = new THREE.Group();
  clamp.name = 'clamp';
  clamp.position.set(K.W[0], K.W[1], 0);
  const iron = castIron();
  const jawFront = plate(jawPlate280(), 0.105, 0.135, iron, 0.003);
  jawFront.name = 'jawFront';
  jawFront.userData.outline = jawOutline280();
  const jawBack = plate(jawPlate280(), -0.035, -0.005, iron, 0.003);
  jawBack.name = 'jawBack';
  jawBack.userData.outline = jawOutline280();
  const flangeFront = plate(annularSector(0.51, 0.548, -20 * DEG, 22 * DEG), 0.075, 0.105, iron, 0);
  flangeFront.name = 'flangeFront';
  const flangeBack = plate(annularSector(0.51, 0.548, -20 * DEG, 22 * DEG), -0.005, 0.025, iron, 0);
  flangeBack.name = 'flangeBack';
  const pinP = revZ(
    [
      [0, -0.057],
      [0.036, -0.057],
      [0.04, -0.053],
      [0.04, -0.037],
      [0.025, -0.037],
      [0.025, 0.137],
      [0.04, 0.137],
      [0.04, 0.153],
      [0.036, 0.157],
      [0, 0.157]
    ],
    steel()
  );
  pinP.name = 'pinP';
  pinP.position.set(K.P[0], K.P[1], 0);
  clamp.add(jawFront, jawBack, flangeFront, flangeBack, pinP);

  // 짧은 레버(파랑): 핀 P 둘레로 λ
  const shortRig = new THREE.Group();
  shortRig.name = 'shortLeverRig';
  shortRig.position.set(K.P[0], K.P[1], 0);
  const shortLever = plate(shortLever280(), 0.01, 0.09, paint(0x3c78c8), 0.002);
  shortLever.name = 'shortLever';
  shortLever.userData.outline = shortLeverOutline280();
  const qa = Math.atan2(-K.Q_OFF[1] - K.P[1], -K.Q_OFF[0] - K.P[0]); // 편심 원 중심 → 바퀴 중심 방향(접점)
  const stripe = plate(annularSector(0.084, 0.09, qa - 30 * DEG, qa + 30 * DEG), 0.089, 0.092, paint(0xf2b619), 0);
  stripe.name = 'contactStripe';
  stripe.position.x = K.Q_OFF[0];
  stripe.position.y = K.Q_OFF[1];
  const leverEnd = new THREE.Object3D();
  leverEnd.name = 'leverEnd';
  leverEnd.position.set(K.E_LEN, 0, 0);
  markAnchor(leverEnd, [0, 0, 0.12]);
  shortRig.add(shortLever, stripe, leverEnd);
  clamp.add(shortRig);
  g.add(clamp);

  // ── 연결 막대 ──
  const link = new THREE.Group();
  link.name = 'linkRig';
  const L = K.LINK;
  const linkOutline = sdfOutline(
    (x, y) => Math.min(Math.hypot(x, y) - 0.04, Math.hypot(x - L, y) - 0.04, Math.max(-x, x - L, Math.abs(y) - 0.03)),
    -0.06,
    -0.06,
    L + 0.06,
    0.06,
    0.001,
    1e-5
  );
  const linkShape = shapeFrom(linkOutline);
  linkShape.holes.push(
    (() => {
      const p = new THREE.Path();
      p.absarc(0, 0, 0.0205, 0, PI * 2, true);
      return p;
    })(),
    (() => {
      const p = new THREE.Path();
      p.absarc(L, 0, 0.0205, 0, PI * 2, true);
      return p;
    })()
  );
  const linkBar = plate(linkShape, 0.1, 0.14, steel(), 0.002);
  linkBar.name = 'link';
  const pinLow = revZ(
    [
      [0, 0.002],
      [0.02, 0.002],
      [0.02, 0.142],
      [0.03, 0.142],
      [0.03, 0.152],
      [0, 0.152]
    ],
    darkSteel()
  );
  pinLow.name = 'linkPinLow';
  const pinHigh = revZ(
    [
      [0, 0.098],
      [0.02, 0.098],
      [0.02, 0.2125],
      [0.03, 0.2125],
      [0.03, 0.2225],
      [0, 0.2225]
    ],
    darkSteel()
  );
  pinHigh.name = 'linkPinHigh';
  pinHigh.position.x = L;
  const linkLow = new THREE.Object3D();
  linkLow.name = 'linkLow';
  markAnchor(linkLow, [0, 0, 0.12]);
  const linkHigh = new THREE.Object3D();
  linkHigh.name = 'linkHigh';
  linkHigh.position.x = L;
  markAnchor(linkHigh, [0, 0, 0.12]);
  link.add(linkBar, pinLow, pinHigh, linkLow, linkHigh);
  g.add(link);

  // ── 손잡이 레버 ──
  const axle = revZ(
    [
      [0, -0.2],
      [0.027, -0.2],
      [0.03, -0.197],
      [0.03, 0.237],
      [0.027, 0.24],
      [0, 0.24]
    ],
    steel()
  );
  axle.name = 'handAxle';
  axle.position.set(K.G[0], K.G[1], 0);
  const axleNut = pinZ(0.05, 0.212, 0.236, darkSteel(), 0.004);
  axleNut.name = 'handNut';
  axleNut.position.set(K.G[0], K.G[1], 0);
  g.add(axle, axleNut);

  const handRig = new THREE.Group();
  handRig.name = 'handLeverRig';
  handRig.position.set(K.G[0], K.G[1], 0);
  const handArm = plate(handLever280(), 0.15, 0.21, steel(), 0.003);
  handArm.name = 'handLever';
  handArm.userData.outline = handLeverOutline280();
  const ha = -85 * DEG;
  const hp: [number, number][] = [[0, 0]];
  for (let k = 0; k <= 14; k++) {
    const s = (0.35 * k) / 14;
    hp.push([0.028 + 0.022 * Math.sin((PI * s) / 0.35), s]);
  }
  hp.push([0, 0.35]);
  const handleGeo = lathe(hp, 28);
  const handle = mesh(handleGeo, wood(0x6b4a2a));
  handle.name = 'handGrip';
  handle.rotation.z = ha - PI / 2;
  handle.position.set(2.1 * Math.cos(ha), 2.1 * Math.sin(ha), 0.18);
  const crankPin = new THREE.Object3D();
  crankPin.name = 'crankPin';
  crankPin.position.set(-K.CRANK_R, 0, 0);
  markAnchor(crankPin, [0, 0, 0.12]);
  handRig.add(handArm, handle, crankPin);
  g.add(handRig);

  // ── 폴 둘 ──
  const pawlMat = paint(0xc8553d);
  const pawlShape = pawl280();
  const pawlRigs: THREE.Group[] = [];
  K.PAWL_PIV.forEach((pv, i) => {
    const rig = new THREE.Group();
    rig.name = `pawl${i + 1}Rig`;
    rig.position.set(pv[0], pv[1], 0);
    const body = plate(pawlShape, -0.13, -0.07, pawlMat, 0.002);
    body.name = `pawl${i + 1}`;
    body.userData.outline = pawlOutline280();
    rig.add(body);
    g.add(rig);
    pawlRigs.push(rig);
    const pin = revZ(
      [
        [0, -0.2],
        [0.02, -0.2],
        [0.02, -0.068],
        [0.035, -0.068],
        [0.035, -0.06],
        [0, -0.06]
      ],
      steel()
    );
    pin.name = `pawlPin${i + 1}`;
    pin.position.set(pv[0], pv[1], 0);
    g.add(pin);
  });

  // ── 화살표 ──
  const wheelArrow = rotArrow(0.2, true);
  wheelArrow.position.set(-1.62, 1.85, 0.15);
  const arrowL = sideArrow(-1);
  arrowL.position.set(0.85, 0.26, 0.2);
  const arrowR = sideArrow(1);
  arrowR.position.set(1.45, 0.26, 0.2);
  g.add(wheelArrow, arrowL, arrowR);

  // ── 이름표 7(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('마찰 바퀴', v(-1.85, 2.0, 0.35)), 'wheelRim'),
    leaderTo(tag('래칫 바퀴', v(-1.8, 0.4, 0.35)), 'ratchetBody'),
    leaderTo(tag('멈춤쇠', v(-0.6, 2.55, 0.35)), 'pawl1'),
    leaderTo(tag('연결 막대', v(-0.15, 3.05, 0.35)), 'link'),
    leaderTo(tag('손잡이 레버', v(1.95, 2.4, 0.35)), 'handLever'),
    leaderTo(tag('짧은 레버', v(0.75, 0.42, 0.35)), 'shortLever'),
    leaderTo(tag('블록 턱', v(-0.55, 0.3, 0.35)), 'jawFront')
  );

  let st: State280 = state280(0);
  const apply = (): void => {
    st = state280(t);
    handRig.rotation.z = st.eps;
    clamp.rotation.z = st.phiC;
    shortRig.rotation.z = st.lam;
    link.position.set(st.E[0], st.E[1], 0);
    link.rotation.z = Math.atan2(st.B[1] - st.E[1], st.B[0] - st.E[0]);
    wheel.rotation.z = st.phiW;
    ratchet.rotation.z = st.phiW;
    shaft.rotation.z = st.phiW;
    pawlRigs[0]!.rotation.z = pawlAngle280(0, st.phiW);
    pawlRigs[1]!.rotation.z = pawlAngle280(1, st.phiW);
    arrowL.visible = st.up;
    arrowR.visible = !st.up;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.75, 6.2], target: [0.1, 1.65, 0] },
    notes: () => [
      { label: '손잡이', value: st.up ? '왼쪽으로(물고 돌림)' : '오른쪽으로(놓고 미끄러짐)' },
      { label: '짧은 레버', value: st.grip ? '물림' : '놓음' },
      { label: '바퀴 누적 회전', value: `${((st.phiW * 180) / PI).toFixed(1)}°` },
      { label: '원리', value: '레버 끝(편심)과 블록 플랜지 사이에 테가 끼면 마찰로 함께 돈다(쐐기 13.75°, 마찰계수 0.245 이상)' },
      { label: '래칫', value: '거꾸로 도는 것은 래칫과 폴 둘이 막는다(반 피치 어긋나 7.5° 마다 걸림)' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
