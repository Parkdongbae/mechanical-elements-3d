// 062 가변 두 단 속도 — 061 의 베벨 차동에서 셋째 베벨 C 를 넷째 풀리에 붙이고 위 축의 작은 풀리가 벨트로 돌린다 (판화 62번)
// 판화: 가로 축 옆모습. 위 축 = 큰 긴 드럼(왼쪽) + 지름 절반인 작은 풀리(오른쪽). 아래 축 = 풀리 L·M·R + 넷째 풀리(모두 같은 지름, 붙어 있음).
// 큰 벨트는 드럼 ↔ 아래 풀리(시간표로 M → R 옮김), 작은 벨트는 작은 풀리 ↔ 넷째 풀리(열린 것 = 같은 방향 → 뺄셈, 엇걸이 = 반대 → 덧셈).
// 차동 관계 αA + αC = 2φ. 베벨은 판화와 달리 M–R 틈에 드러내고, 케이지·축받이는 보충 부품(판화에 없음).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, bevelGear, crossedBeltPath, displayStand, openBeltPath, pulley, rotArrow, tag } from '../kit';
import { carryTags } from '../kit/mm';
import { bearingX, beltLoopYZ, crossedLoopYZ, diffCarrier, rimMarks, shaftX, tubeZ } from '../kit/k061';

// ── 치수(설계표 062 '부품과 치수') ──
const ZC = 0.25; // 두 축의 깊이
const YU = 2.5; // 위 축 높이
const YL = 0.95; // 아래 축 높이
const R = 0.38; // 큰 드럼·L·M·R·넷째 풀리 반지름(판화: 넷 다 같은 지름)
const RS = 0.19; // 작은 풀리 반지름(큰 드럼의 절반)
const BT = 0.012; // 벨트 두께 중심(0.02/2 + 여유) → 경로 반지름 = r + BT
const RB = R + BT; // 0.392
const RSB = RS + BT; // 0.202
const XS = 1.32; // 작은 풀리 = 넷째 풀리 = 작은 벨트 평면 x(판화: 한 세로선)
const XL = -1.2;
const XM = -0.75;
const XR = 0.85;
const XO = -0.05; // 베벨 꼭짓점 x
const RP = 0.2; // 베벨 피치 반지름 = 16 × 0.025 / 2
const XA = XO - RP; // A 피치 평면
const XC = XO + RP; // C 피치 평면
const NT = 16;
const K_SMALL = RS / R; // 작은 벨트 속도비 1/2

// ── 주기 시간표(설계표 '동작'): [u0, u1, dαA/dθ, dαC/dθ, dφ/dθ] ──
const T = 40;
const SEGS: [number, number, number, number, number][] = [
  [0, 10, 1, K_SMALL, (1 + K_SMALL) / 2], // 큰 벨트 M: 단순 운동
  [10, 12, 0, 0, 0], // M → R 옮김
  [12, 24, 2 - K_SMALL, K_SMALL, 1], // R + 열린 것 = 뺄셈
  [24, 26, 0, 0, 0], // 작은 벨트 엇걸이로 교체
  [26, 38, 2 + K_SMALL, -K_SMALL, 1], // R + 엇걸이 = 덧셈
  [38, 40, 0, 0, 0] // R → M 되돌림 + 열린 것으로 교체
];
const GAIN = SEGS.reduce<[number, number, number]>((s, g) => [s[0] + (g[1] - g[0]) * g[2], s[1] + (g[1] - g[0]) * g[3], s[2] + (g[1] - g[0]) * g[4]], [0, 0, 0]);

interface Pose {
  aA: number;
  aC: number;
  phi: number;
  u: number;
  seg: number;
}

function pose(theta: number): Pose {
  const n = Math.floor(theta / T);
  const u = theta - n * T;
  let aA = n * GAIN[0];
  let aC = n * GAIN[1];
  let phi = n * GAIN[2];
  let seg = 0;
  for (let i = 0; i < SEGS.length; i++) {
    const [u0, u1, dA, dC, dP] = SEGS[i]!;
    if (u <= u0) break;
    const d = Math.min(u, u1) - u0;
    aA += d * dA;
    aC += d * dC;
    phi += d * dP;
    if (u < u1) {
      seg = i;
      break;
    }
  }
  return { aA, aC, phi, u, seg };
}

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** 큰 벨트 x(시간표) */
function beltX(u: number): number {
  if (u < 10) return XM;
  if (u < 12) return XM + (XR - XM) * smooth((u - 10) / 2);
  if (u < 38) return XR;
  return XR + (XM - XR) * smooth((u - 38) / 2);
}

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** X 축으로 눕힌 pivot(로컬 z → 세계 +X 또는 −X) */
function pivotX(x: number, sign: 1 | -1, ...kids: THREE.Object3D[]): THREE.Group {
  const p = new THREE.Group();
  p.position.x = x;
  p.rotation.y = (sign * Math.PI) / 2;
  p.add(...kids);
  return p;
}

function named<T extends THREE.Object3D>(o: T, name: string): T {
  o.name = name;
  return o;
}

export default function buildM062(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // ── 위 축: 큰 드럼 + 작은 풀리 (같은 축·같은 각) ──
  const upper = new THREE.Group();
  upper.position.set(0, YU, ZC);
  upper.add(shaftX(-1.9, 1.9, 0, 0));
  const drum = named(pulley(R, { width: 2.45, spokes: 0, flat: true, driver: true }), 'drumTop');
  upper.add(pivotX(-0.175, 1, drum, rimMarks(R, 2.45, 4)));
  const small = named(pulley(RS, { width: 0.34, flat: true, driver: true }), 'smallTop');
  upper.add(pivotX(XS, 1, small, rimMarks(RS, 0.34, 3)));
  g.add(upper);
  g.add(bearingX(-1.7, YU, ZC), bearingX(1.7, YU, ZC), bearingX(-1.7, YL, ZC), bearingX(1.7, YL, ZC));

  // ── 아래 축 ──
  const lower = (): THREE.Group => {
    const q = new THREE.Group();
    q.position.set(0, YL, ZC);
    g.add(q);
    return q;
  };
  // L: 놀고 있는 풀리(이 모델에서는 벨트가 걸리지 않아 정지)
  const grpL = lower();
  grpL.add(pivotX(XL, 1, named(pulley(R, { width: 0.4, flat: true }), 'pulleyL'), rimMarks(R, 0.4, 4)));
  // M + A + 축: 축에 고정
  const grpA = lower();
  grpA.add(shaftX(-1.9, 1.9, 0, 0));
  grpA.add(pivotX(XM, 1, named(pulley(R, { width: 0.4, flat: true }), 'pulleyM'), rimMarks(R, 0.4, 4), tubeZ(0.05, 0.075, 0.2, 0.42)));
  grpA.add(pivotX(XA, 1, bevelGear(NT, 0.025, { width: 0.1, bore: 0.05, driver: true })));
  // R(운반 풀리) + 케이지 + 유성 P
  const carrier = lower();
  carrier.add(pivotX(XR, 1, named(pulley(R, { width: 0.4, flat: true, hub: 0.1 }), 'pulleyR'), rimMarks(R, 0.4, 4)));
  carrier.add(diffCarrier({ xFace: XR - 0.2, xO: XO, R: RP }));
  const planet = bevelGear(NT, 0.025, { width: 0.1, spokes: 0 });
  const pP = new THREE.Group();
  pP.position.set(XO, RP, 0);
  pP.rotation.x = Math.PI / 2; // 로컬 z → −Y: 이가 축을 향함
  pP.add(planet);
  carrier.add(pP);
  // C + 슬리브 + 넷째 풀리(한 몸). 넷째 풀리는 따로 +π/2 pivot(속도비 부호가 드럼과 같게)
  const grpC = lower();
  grpC.add(pivotX(XC, -1, bevelGear(NT, 0.025, { width: 0.1, bore: 0.05 }), tubeZ(0.05, 0.085, -(XS + 0.17 - XC), -0.07)));
  grpC.add(pivotX(XS, 1, named(pulley(R, { width: 0.34, flat: true, hub: 0.09 }), 'pulley4'), rimMarks(R, 0.34, 4)));

  // ── 벨트 ──
  // 큰 벨트: 평면 x = 0 에서 만들고 그룹을 x 로 옮긴다
  const mainLoop = beltLoopYZ(YU, RB, YL, RB, ZC, 0);
  carryTags(openBeltPath([YL, ZC], RB, [YU, ZC], RB, 24), mainLoop.pts, (a, b) => v(0, a, b));
  const beltMain = new Belt(mainLoop.pts, { style: 'flat', width: 0.32, thickness: 0.02, widthDirs: mainLoop.dirs, marks: 8 });
  beltMain.group.name = 'beltMain';
  g.add(beltMain.group);
  // 작은 벨트 둘(같은 자리, 하나만 보인다)
  const openLoop = beltLoopYZ(YU, RSB, YL, RB, ZC, XS);
  carryTags(openBeltPath([YL, ZC], RB, [YU, ZC], RSB, 24), openLoop.pts, (a, b) => v(XS, a, b));
  const beltOpen = new Belt(openLoop.pts, { style: 'flat', width: 0.14, thickness: 0.02, widthDirs: openLoop.dirs, marks: 6 });
  beltOpen.group.name = 'beltSmallOpen';
  const crossLoop = crossedLoopYZ(YU, RSB, YL, RB, ZC, XS, 0.08);
  carryTags(crossedBeltPath([YL, ZC], RB, [YU, ZC], RSB, 24), crossLoop.pts, (a, b) => v(XS, a, b));
  const beltCross = new Belt(crossLoop.pts, { style: 'flat', width: 0.14, thickness: 0.02, widthDirs: crossLoop.dirs, marks: 6 });
  beltCross.group.name = 'beltSmallCross';
  g.add(beltOpen.group, beltCross.group);

  // ── 화살표·이름표 ──
  const arrow = (r: number, ccw: boolean, x: number, y: number): THREE.Group => {
    const a = rotArrow(r, ccw);
    a.rotation.y = Math.PI / 2; // 로컬 z → +X (오른쪽에서 보아 반시계 = +X 둘레 양)
    a.position.set(x, y, ZC);
    g.add(a);
    return a;
  };
  arrow(0.3, true, -2.05, YU);
  arrow(0.3, true, -2.05, YL);
  const arr4p = arrow(0.25, true, 1.95, YL);
  const arr4n = arrow(0.25, false, 1.95, YL);
  g.add(
    tag('구동 드럼', v(-0.2, 3.1, 0.5)),
    tag('작은 풀리', v(1.45, 3.15, 0.5)),
    tag('차동 베벨', v(-0.05, 1.7, 0.5)),
    tag('운반 풀리', v(0.3, 0.38, 0.5)),
    tag('넷째 풀리', v(1.55, 0.38, 0.5))
  );

  let cur: Pose = pose(0);
  const apply = (): void => {
    cur = pose(theta);
    upper.rotation.x = theta;
    grpL.rotation.x = 0;
    grpA.rotation.x = cur.aA;
    grpC.rotation.x = cur.aC;
    carrier.rotation.x = cur.phi;
    planet.rotation.z = cur.phi - cur.aA - Math.PI / NT; // 검증된 위상(s061_phase.mjs)
    beltMain.group.position.x = beltX(cur.u);
    beltMain.setOffset(RB * theta);
    const crossed = cur.u >= 25 && cur.u < 39;
    beltOpen.group.visible = !crossed;
    beltCross.group.visible = crossed;
    beltOpen.setOffset(RSB * theta);
    beltCross.setOffset(-RSB * theta); // 엇걸이: 위 풀리 호가 경로 순서와 반대로 감김
    arr4p.visible = !crossed;
    arr4n.visible = crossed;
  };
  apply();

  const fmt = (x: number): string => (Math.round(x * 100) / 100).toString();
  return {
    group: g,
    view: { pos: [1.6, 2.3, 6.4], target: [0, 1.7, 0.2] },
    notes: () => {
      const s = cur.seg;
      const bigPos = s === 0 ? '가운데 고정 풀리(M)' : s === 1 || s === 5 ? '옮기는 중' : '오른쪽 운반 풀리(R)';
      const smallSt = s === 3 || s === 5 ? '바꿔 거는 중' : s === 4 ? '엇걸이 · 반대 방향' : '열린 것 · 같은 방향';
      const g0 = SEGS[s]!;
      const speedTxt = g0[2] === 0 ? '정지(옮기는 중)' : s === 0 ? '단순 1 : 1' : s === 2 ? '3/2 : 1 = 2 − 1/2 (뺄셈)' : '5/2 : 1 = 2 + 1/2 (덧셈)';
      return [
        { label: '큰 벨트', value: bigPos },
        { label: '작은 벨트', value: smallSt },
        { label: '아래 축 속도', value: speedTxt },
        { label: '식', value: `αA = 2φ − αC  (축 ${fmt(cur.aA)}, 운반 ${fmt(cur.phi)}, 넷째 ${fmt(cur.aC)} rad)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
