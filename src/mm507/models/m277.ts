// 277 콜트의 실린더 회전 장치 — 해머를 젖히면 텀블러에 핀으로 달린 도그가 올라가 실린더 뒤 래칫의 이 하나를 밀어 실린더를 60° 돌린다.
// 설계표 docs/mm507-sheets/277.md · 키트 kit/k277.ts. 한 주기 3 초(젖힘 1.4 · 멈춤 0.5 · 떨어짐·되밀어 넣기 · 쉼).
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K277, dogOutline277, dogShape277, hammerOutline277, hammerShape277, springC277, state277, tumblerOutline277, tumblerShape277, type State277 } from '../kit/k277';
import { ratchetWheel } from '../kit/gear6';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, merge, mesh, rodProfile, roundedRect, shapeFrom, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K277;
const PI = Math.PI;
const D2R = PI / 180;

/** z0 → z1 의 Z 축 원기둥(모따기 c) */
function pinZ(r: number, z0: number, z1: number, c = 0.002): THREE.BufferGeometry {
  const geo = lathe(rodProfile(r, z0, z1, c, c), 28);
  geo.rotateX(PI / 2);
  return geo;
}

/** 상자 지오메트리(범위로 지정) */
function boxG(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** 깊이 z0 → z1 로 압출(모양은 xy 평면, 중심 정렬 압출을 옮김) */
function slab(shape: THREE.Shape, z0: number, z1: number, mat: THREE.Material, c: number): THREE.Mesh {
  const m = mesh(extrude(shape, z1 - z0, c), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** x 방향 원기둥(반지름 r, x0 → x1) */
function rodX(r: number, x0: number, x1: number, c = 0.002): THREE.BufferGeometry {
  const geo = lathe(rodProfile(r, x0, x1, c, c), 32);
  geo.rotateZ(-PI / 2);
  return geo;
}

/** x 방향 관(안 rIn · 바깥 rOut, x0 → x1) */
function tubeX(rIn: number, rOut: number, x0: number, x1: number, c = 0.002): THREE.BufferGeometry {
  const geo = lathe(tubeProfile(rIn, rOut, x0, x1, c), 36);
  geo.rotateZ(-PI / 2);
  return geo;
}

/** 실린더 몸: (z′, y′) 윤곽 = 원 0.50 + 세로 홈 6 + 약실 구멍 6 + 굴대 구멍, x 방향으로 1.0 */
function cylinderBodyGeo(): THREE.BufferGeometry {
  const R = K.CYL_R;
  const outline: [number, number][] = [];
  const half = 2.6 * D2R;
  const STEP = 3 * D2R;
  for (let k = 0; k < 6; k++) {
    const a0 = (60 * k) * D2R + half;
    const a1 = (60 * (k + 1)) * D2R - half;
    const n = Math.max(2, Math.round((a1 - a0) / STEP));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      outline.push([R * Math.cos(a), R * Math.sin(a)]);
    }
    // 세로 홈(깊이 0.01) — 다음 호 시작 직전
    outline.push([(R - 0.01) * Math.cos(a1), (R - 0.01) * Math.sin(a1)]);
    outline.push([(R - 0.01) * Math.cos(a1 + 2 * half), (R - 0.01) * Math.sin(a1 + 2 * half)]);
  }
  const shape = shapeFrom(outline);
  for (let k = 0; k < 6; k++) {
    const a = (30 + 60 * k) * D2R;
    shape.holes.push(circlePath(0.37 * Math.cos(a), 0.37 * Math.sin(a), 0.09));
  }
  shape.holes.push(circlePath(0, 0, 0.062));
  const len = K.CYL[1] - K.CYL[0];
  const geo = extrude(shape, len, 0.015);
  geo.rotateY(-PI / 2); // 모양 x → 세계 z′, 압출 z → 세계 −x
  geo.translate((K.CYL[0] + K.CYL[1]) / 2, 0, 0);
  return geo;
}

export default function buildM277(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 틀(고정) ──
  // 앞 기둥 + 발판(같은 메시)
  const frontPost = mesh(merge([boxG(-1.92, -1.78, 0.28, 2.15, 0.1, 0.46), boxG(-2.05, -1.65, 0.17, 0.3, -0.31, 0.5)]), castIron());
  frontPost.name = 'frontPost';
  g.add(frontPost);

  // 굴대 + 앞·뒤 칼라(같은 메시) — 앞 칼라는 기둥에 0.01 박음
  const arbor = mesh(merge([rodX(0.06, -1.85, -0.57, 0.003), tubeX(0.059, 0.1, -1.79, -1.702, 0.003), tubeX(0.059, 0.1, -0.618, -0.57, 0.003)]), steel());
  arbor.name = 'arbor';
  arbor.position.set(0, K.AXIS_Y, K.ZC);
  g.add(arbor);

  // 옆판 + 뒤판으로 가는 기둥 4
  const side = slab(
    (() => {
      const s = roundedRect(-0.55, 0.8, 1.25, 2.35, 0.08);
      return s;
    })(),
    0.02,
    0.16,
    darkSteel(),
    0.006
  );
  side.name = 'sidePlate';
  g.add(side);
  const postGeos: THREE.BufferGeometry[] = [];
  for (const [px, py] of [
    [-0.47, 0.88],
    [1.17, 0.88],
    [-0.47, 2.27],
    [1.17, 2.27]
  ] as [number, number][])
    postGeos.push(boxG(px - 0.04, px + 0.04, py - 0.04, py + 0.04, -0.305, 0.04));
  const sidePosts = mesh(merge(postGeos), darkSteel());
  sidePosts.name = 'sidePosts';
  g.add(sidePosts);

  // 해머 축 + 앞 너트(같은 메시) — 옆판에 박힘
  const hammerAxle = mesh(merge([pinZ(0.035, 0.1, 0.497, 0.002), pinZ(0.055, 0.48, 0.5, 0.003)]), steel());
  hammerAxle.name = 'hammerAxle';
  hammerAxle.position.set(K.H[0], K.H[1], 0);
  g.add(hammerAxle);

  // 스프링 받침: 뒤판에서 해머 위(y 2.8)로 넘어오는 팔 + 내려오는 걸이(같은 메시), 덩이(따로)
  const springPost = mesh(merge([boxG(-0.17, -0.11, 2.8, 2.88, -0.31, 0.64), boxG(-0.17, -0.11, 2.12, 2.84, 0.56, 0.64)]), castIron());
  springPost.name = 'springPost';
  g.add(springPost);
  const springBlock = mesh(boxG(-0.2, -0.08, 2.06, 2.16, 0.49, 0.645), castIron({ color: 0x5a6068 }));
  springBlock.name = 'springBlock';
  g.add(springBlock);

  // ── 실린더 묶음 ──
  const cylinder = new THREE.Group();
  cylinder.name = 'cylinder';
  cylinder.position.set(0, K.AXIS_Y, K.ZC);
  const cylinderBody = mesh(cylinderBodyGeo(), steel());
  cylinderBody.name = 'cylinderBody';
  cylinder.add(cylinderBody);

  // 60° 눈금: 옆면 노란 줄(면에 0.001 묻음) — 각 30°
  const mark = mesh(new THREE.BoxGeometry(0.6, 0.03, 0.01), paint(0xf2b619));
  mark.name = 'cylinderMark';
  mark.rotation.x = -30 * D2R;
  mark.position.set(-1.2, 0.504 * Math.sin(30 * D2R), 0.504 * Math.cos(30 * D2R));
  cylinder.add(mark);

  // 래칫 b — 키트 ratchetWheel(6, 0.30, 0.20, 0.08, 0.062): 안쪽 rotation.z −24°, 바깥 rotation.y −π/2
  const ratchet = new THREE.Group();
  ratchet.name = 'ratchet';
  ratchet.rotation.y = -PI / 2;
  ratchet.position.x = -0.66; // 두께 0.08 이 가운데 정렬이라 x −0.70 ~ −0.62
  const wheel = ratchetWheel(6, K.RAT_TIP, K.RAT_ROOT, 0.08, 0.062);
  wheel.rotation.z = K.FACE0;
  (wheel.children[0] as THREE.Mesh).name = 'ratchetBody';
  ratchet.add(wheel);
  cylinder.add(ratchet);
  g.add(cylinder);

  // ── 해머 묶음(해머 좌표) ──
  const hammerGroup = new THREE.Group();
  hammerGroup.name = 'hammerGroup';
  hammerGroup.position.set(K.H[0], K.H[1], 0);
  const hammer = slab(hammerShape277(), 0.21, 0.35, steel({ color: 0xb9bec6 }), 0.004);
  hammer.name = 'hammer';
  hammer.userData.outline = hammerOutline277();
  hammerGroup.add(hammer);
  // 손잡이 미끄럼 막이 줄무늬 4
  const ribs: THREE.BufferGeometry[] = [];
  const dirX = 0.6;
  const dirY = 0.8;
  for (let i = 0; i < 4; i++) {
    const cx = 0.88 - K.H[0] + dirX * 0.045 * i;
    const cy = 2.46 - K.H[1] + dirY * 0.045 * i;
    const rg = new THREE.BoxGeometry(0.12, 0.012, 0.008);
    rg.rotateZ(Math.atan2(0.6, -0.8)); // 막대 방향(−0.8, 0.6)
    rg.translate(cx, cy, 0.352);
    ribs.push(rg);
  }
  const grip = mesh(merge(ribs), darkSteel());
  grip.name = 'gripRibs';
  hammerGroup.add(grip);
  // 텀블러(해머 축에 한 몸) + 받침 고리
  const tumbler = slab(tumblerShape277(), 0.36, 0.47, steel(), 0.004);
  tumbler.name = 'tumbler';
  tumbler.userData.outline = tumblerOutline277();
  hammerGroup.add(tumbler);
  const ring = mesh(pinZ(0.035, 0.468, 0.488, 0.001), steel());
  ring.name = 'pinRing';
  ring.position.set(K.A_REL[0], K.A_REL[1], 0);
  hammerGroup.add(ring);
  // 핀 a(텀블러에 박힘) + 머리
  const pinA = mesh(merge([pinZ(0.02, 0.36, 0.57, 0.001), pinZ(0.035, 0.542, 0.57, 0.003)]), steel());
  pinA.name = 'pinA';
  pinA.position.set(K.A_REL[0], K.A_REL[1], 0);
  hammerGroup.add(pinA);
  g.add(hammerGroup);

  // ── 도그 a ──
  const dog = new THREE.Group();
  dog.name = 'dogGroup';
  const dogBody = slab(dogShape277(), 0.49, 0.54, paint(0xf2b619), 0.004);
  dogBody.name = 'dog';
  dogBody.userData.outline = dogOutline277();
  dog.add(dogBody);
  const springEnd = new THREE.Object3D();
  springEnd.name = 'springEnd';
  springEnd.position.set(K.S_LOC[0], K.S_LOC[1], 0.515);
  dog.add(springEnd);
  g.add(dog);

  // ── 판 스프링 c ──
  let springGeo = springC277(v(-0.42, 1.45, 0));
  const springC = mesh(springGeo, steel());
  springC.name = 'springC';
  g.add(springC);
  const springTip = new THREE.Object3D();
  springTip.name = 'springTip';
  g.add(springTip);

  // ── 화살표: 실린더 회전(x 축 둘레, 미는 동안만) · 해머 젖힘(빨강) ──
  const cylArrow = rotArrow(0.25, true);
  cylArrow.name = 'cylArrow';
  cylArrow.rotation.y = PI / 2;
  cylArrow.position.set(-1.2, 2.45, 0.8);
  g.add(cylArrow);
  const hamArrow = rotArrow(0.2, false);
  hamArrow.name = 'hammerArrow';
  hamArrow.position.set(1.3, 2.05, 0.45);
  g.add(hamArrow);

  // ── 이름표 6(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('실린더', v(-1.75, 2.85, 0.6)), 'cylinderBody'),
    leaderTo(tag('래칫 b', v(-1.75, 1.05, 0.9)), 'ratchetBody'),
    leaderTo(tag('도그 a', v(-0.85, 0.45, 0.9)), 'dog'),
    leaderTo(tag('스프링 c', v(0.15, 3.0, 0.7)), 'springC'),
    leaderTo(tag('해머', v(1.45, 2.95, 0.3)), 'hammer'),
    leaderTo(tag('텀블러', v(1.05, 0.45, 0.7)), 'tumbler')
  );

  let st: State277 = state277(0);
  const apply = (): void => {
    st = state277(t);
    hammerGroup.rotation.z = -st.beta;
    dog.position.set(st.A[0], st.A[1], 0);
    dog.rotation.z = st.thetaD;
    cylinder.rotation.x = -st.psi;
    // 스프링: 끝을 도그 등 S 로 — 다시 만듦
    springC.geometry.dispose();
    springGeo = springC277(v(st.S[0], st.S[1], 0));
    springC.geometry = springGeo;
    springTip.position.set(st.S[0], st.S[1], 0.515);
    cylArrow.visible = st.phase === 'cock' && st.tc > 0.15;
    hamArrow.visible = st.phase === 'cock' && st.tc > 0.15;
  };
  apply();

  return {
    group: g,
    view: { pos: [2.3, 2.6, 5.6], target: [-0.15, 1.7, 0.25] },
    notes: () => [
      { label: '해머', value: st.phase === 'cock' ? '젖히는 중' : st.phase === 'hold' ? '젖힘' : st.phase === 'rest' ? '내려감' : '떨어짐' },
      { label: '실린더 각', value: ((st.psi / D2R) % 360).toFixed(1) + '°' },
      { label: '약실', value: '다음 약실이 해머 앞으로 — 한 번에 60°' },
      { label: '원리', value: '해머를 젖히면 텀블러가 함께 돌아 핀 a 가 올라가고, 도그 끝이 래칫 이면을 밑에서 밀어 실린더를 1/6 바퀴 돌린다' },
      { label: '메모', value: '실제 콜트는 도그가 내려올 때 다음 이의 모따기가 도그를 밀어낸다 — 모델은 도그가 래칫 뒷면 뒤로 물러나 미끄러져 내려오게 했다. 실린더를 멈추는 걸쇠는 판화에 없어 생략' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
