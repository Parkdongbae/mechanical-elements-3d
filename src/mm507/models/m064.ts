// 064 점프 운동(웜과 캠) — 웜이 웜 휠 B 를 돌리고, 휠 축에 박힌 핀이 반쯤 잘린 속 빈 축을 밀어 달팽이 캠 A 를 돌린다.
// 캠이 레버 고리를 가장 높이 들어 올린 뒤에는 잎스프링에 눌린 레버가 곧은 변을 타고 캠을 앞으로 "떨어뜨린다"(도약 110°),
// 그다음 핀이 홈 안에서 따라잡을 때까지 캠은 멈춘다 (판화 64번, 설계표 docs/mm507-sheets/064.md).
// 절대 자세: 모든 각은 누적 입력 U 의 함수(증분 누적 금지).
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { castIron, darkSteel } from '../../models/materials';
import { circlePts, mesh, TAU } from '../../models/parts/geom';
import { displayStand, markAnchor, rod, rotArrow, setMM, shaftZ, tag, wormScrew, wormWheel, type V2 } from '../kit';
import { halfCollar, LeafSpring, leverArm, pinFinger, polyDepth, snailCam, snailOutline } from '../kit/k063';

const D = Math.PI / 180;
const N = 24; // 웜 휠 잇수
const MOD = 0.06;
const H: V2 = [0.92, 1.7]; // 휠·캠 허브
const RP = (N * MOD) / 2; // 0.72
const RWP = 0.144; // 웜 피치 반지름
const WY = H[1] - RP - RWP; // 웜 축 높이 0.836
const PL: V2 = [-1.7, 2.72]; // 레버 피벗
const LEN = 2.87; // 피벗 → 고리 중심
const RING = 0.115; // 고리 반지름
const ZC = 0.26; // 캠·레버·잎스프링 층
const AT = 6 * D; // 도약 시작 각 αt
const J = 110 * D; // 도약 각
const DS = 0.4; // 도약에 걸리는 휠 각
const U0 = 4.2;
const FINGER = 77 * D; // 손가락의 휠 로컬각(옆면 안쪽 모서리가 홈 벽 90° 에 닿는 각)
const BLY = 3.06; // 잎스프링 고정 블록 높이(뒤판 윗끝 3.15 안 — 설계표 3.22 는 뒤판 밖이라 받침이 허공)
const LEAF_P0 = new THREE.Vector3(-1.34, BLY, ZC);
const LEAF_T0 = new THREE.Vector3(1, 0, 0);
const LEAF_T1 = new THREE.Vector3(0.25, -0.97, 0).normalize();
const LEAF_AT: V2 = [1.35, 0.056]; // 잎 끝이 누르는 레버 로컬 점(관 끝 단면 아래끝이 레버 윗면 0.05 에 닿게)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const smooth = (x: number): number => x * x * (3 - 2 * x);

/** 누적 입력 U → 휠 각 φ, 캠 각 α, 단계 */
function pose(U: number): { phi: number; alpha: number; phase: string } {
  const n = Math.floor(U / TAU);
  const u = U - TAU * n;
  const base = AT + TAU * n;
  let alpha: number;
  let phase: string;
  if (u < DS) {
    alpha = base + J * smooth(u / DS);
    phase = '도약';
  } else if (u < J) {
    alpha = base + J;
    phase = '멈춤(핀이 따라잡는 중)';
  } else {
    alpha = base + u;
    phase = '밀기';
  }
  return { phi: AT + U, alpha, phase };
}

const CAM = snailOutline();

/** 레버 각 γ 에서 고리 중심이 캠(각 α) 윤곽에서 떨어진 부호 거리 */
function ringDepth(alpha: number, g: number): number {
  const x = PL[0] + LEN * Math.cos(g) - H[0];
  const y = PL[1] + LEN * Math.sin(g) - H[1];
  const c = Math.cos(-alpha);
  const s = Math.sin(-alpha);
  return polyDepth([c * x - s * y, s * x + c * y], CAM);
}

/** 레버를 위에서 내려 고리가 캠에 처음 닿는 각(설계표: 0.02 에서 0.0005 씩 내려가며 파고들기 직전) */
function solveScan(alpha: number): number {
  let g = 0.02;
  while (g > -0.4 && ringDepth(alpha, g - 0.0005) >= RING) g -= 0.0005;
  return g;
}

export default function buildM064(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  // γ 표(캠 α 0.5° 간격, mod 2π)
  const STEP = 0.5 * D;
  const NT = 720;
  const table: number[] = [];
  for (let i = 0; i < NT; i++) table.push(solveScan(i * STEP));
  const gammaOf = (alpha: number): number => {
    const a = ((alpha % TAU) + TAU) % TAU;
    const f = a / STEP;
    const i = Math.floor(f) % NT;
    const t = f - Math.floor(f);
    let gm = table[i]! * (1 - t) + table[(i + 1) % NT]! * t;
    // 보간 오차 다듬기: 파고들면 올리고, 떠 있으면 닿을 때까지 내린다
    let k = 0;
    if (ringDepth(a, gm) < RING) while (ringDepth(a, gm) < RING && k++ < 200) gm += 0.0002;
    else while (ringDepth(a, gm - 0.0002) >= RING && k++ < 200) gm -= 0.0002;
    return gm;
  };

  // ── 웜 휠 B (반시계) ──
  const wheel = wormWheel(N, MOD, { width: 0.14, tanLead: -0.2083 });
  wheel.name = 'wheelB';
  wheel.position.set(H[0], H[1], 0);
  g.add(wheel, shaftZ(H[0], H[1], 0.4, 0.05));

  // ── 웜(한 줄 오른나사, 축 X) + 축 + 축받이 ──
  const worm = wormScrew(RWP - 1.25 * MOD, RWP + MOD, Math.PI * MOD, 0.62, { driver: true });
  worm.name = 'worm';
  setMM(worm, { axis: 'x' });
  worm.position.set(H[0], WY, 0);
  g.add(worm, rod(v(0.3, WY, 0), v(1.54, WY, 0), 0.045));
  for (const x of [0.4, 1.44]) {
    const len = 0.09 + 0.3;
    const b = mesh(new THREE.BoxGeometry(0.18, 0.18, len), castIron());
    b.position.set(x, WY, -0.3 + len / 2);
    g.add(b);
  }

  // ── 캠 A + 반쯤 잘린 속 빈 축(캠 로컬 90°~270°) ──
  const cam = new THREE.Group();
  cam.name = 'camA';
  cam.position.set(H[0], H[1], ZC);
  const plate = snailCam(0.06, 0.075);
  cam.add(plate);
  const collar = halfCollar(0.07, 0.16, 0.07, Math.PI / 2, (3 * Math.PI) / 2);
  collar.position.z = 0.065;
  cam.add(collar);
  g.add(cam);

  // ── 휠 축에 박힌 핀(손가락) — 휠과 같은 각 ──
  const finger = pinFinger(0.13, 0.016, 0.05);
  finger.position.set(H[0], H[1], 0.325);
  g.add(finger);

  // ── 레버 + 고리(롤러) + 피벗 핀 ──
  const lever = leverArm(LEN, 0.1, RING, 0.045, 0.05);
  lever.name = 'lever';
  lever.position.set(PL[0], PL[1], ZC);
  const roller = new THREE.Object3D();
  roller.name = 'roller';
  roller.position.set(LEN, 0, 0);
  roller.userData.outline = circlePts(RING, 48);
  setMM(roller, { kind: 'pin', point: [0, 0, 0], r: RING });
  lever.add(roller);
  g.add(lever, shaftZ(PL[0], PL[1], 0.34, 0.035));

  // ── 잎스프링: 고정 블록(뒤판에서 나온 받침 + 앞 블록) + 잎 ──
  const post = mesh(new THREE.BoxGeometry(0.09, 0.09, 0.21 + 0.3), castIron());
  post.position.set(-1.55, BLY, (0.21 - 0.3) / 2);
  const block = mesh(new THREE.BoxGeometry(0.4, 0.09, 0.1), darkSteel());
  block.position.set(-1.55, BLY, ZC);
  g.add(post, block);
  const leaf = new LeafSpring(0.018);
  g.add(leaf.group);
  const leafTip = new THREE.Object3D();
  leafTip.name = 'leafTip';
  markAnchor(leafTip);
  g.add(leafTip);

  // ── 표시 ──
  const ac = rotArrow(0.62, true);
  ac.position.set(H[0], H[1], 0.42);
  const aw = rotArrow(0.24, false);
  aw.rotation.y = Math.PI / 2;
  aw.position.set(1.66, WY, 0);
  g.add(ac, aw);
  g.add(
    tag('웜(구동)', v(0.92, 0.42, 0.45)),
    tag('웜 휠 B', v(-0.55, 1.15, 0.45)),
    tag('캠 A', v(-0.45, 1.85, 0.45)),
    tag('레버(고리)', v(-0.5, 2.35, 0.45)),
    tag('잎스프링', v(0.55, 3.05, 0.45))
  );

  let U = U0;
  let cur = pose(U);
  const E = new THREE.Vector3();
  let lastGamma = NaN;

  const apply = (): void => {
    cur = pose(U);
    const { phi, alpha } = cur;
    wheel.rotation.z = phi;
    finger.rotation.z = phi + FINGER;
    cam.rotation.z = alpha;
    // 웜: w = −N·φ (오른나사, 웜이 휠 아래 — 맨 아래 이가 나사산 골에 든다)
    worm.rotation.x = (-N * phi) % TAU;
    const gm = gammaOf(alpha);
    lever.rotation.z = gm;
    if (gm !== lastGamma) {
      lastGamma = gm;
      const c = Math.cos(gm);
      const s = Math.sin(gm);
      E.set(PL[0] + c * LEAF_AT[0] - s * LEAF_AT[1], PL[1] + s * LEAF_AT[0] + c * LEAF_AT[1], ZC);
      leaf.set(LEAF_P0, LEAF_T0, E, LEAF_T1);
      leafTip.position.copy(E);
    }
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '웜 : 휠', value: '24 : 1' },
      { label: '캠 도약 각', value: '110°' },
      { label: '단계', value: cur.phase },
      { label: '휠 각 φ', value: `${((((cur.phi / D) % 360) + 360) % 360).toFixed(0)}°` }
    ],
    update(dt: number, speed: number): void {
      U += 0.9 * speed * dt;
      apply();
    }
  };
}
