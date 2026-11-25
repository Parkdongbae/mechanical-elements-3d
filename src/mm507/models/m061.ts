// 061 차동 두 단 속도 — 위 긴 드럼에서 평벨트가 아래 축의 세 풀리(헐거운 L · 고정 M · 운반 R) 가운데 하나로 옮겨 걸린다.
// M 에 걸리면 아래 축이 위 축과 같은 속도(단순), R 에 걸리면 베벨 차동(A–P–C, C 는 마찰 밴드가 붙듦)으로 축이 2배 속도. L 이면 축 정지.
// 판화 61번: 축이 가로(세계 X)인 옆모습. 판화에서 풀리 안에 숨은 베벨은 M 과 R 사이에 드러낸다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, bevelGear, carryTags, displayStand, openBeltPath, pulley, rotArrow, tag, leaderTo } from '../kit';
import { bearingX, beltLoopYZ, brakeBand, diffCarrier, rimMarks, shaftX, tubeZ } from '../kit/k061';

const YU = 2.5; // 위 축 높이
const YL = 0.95; // 아래 축 높이
const ZC = 0.25; // 두 축의 깊이
const RP = 0.38; // 풀리 반지름(위 드럼·L·M·R 모두 같다 → 1:1)
const BT = 0.02; // 벨트 두께
const RB = RP + BT / 2; // 벨트 경로 반지름 0.392
const NT = 16; // 베벨 잇수(4 의 배수)
const MOD = 0.025; // 피치 반지름 0.2
const RG = (NT * MOD) / 2;
const XO = -0.05; // 세 베벨 원뿔의 꼭짓점 x
const X_L = -1.2;
const X_M = -0.75;
const X_R = 0.85;
const HALF_PITCH = Math.PI / NT;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 로컬 Z 축 부품을 세계 X 축으로 세우는 피벗(sign = +1: 로컬 z → +X, −1: → −X) */
function pivotX(x: number, sign: 1 | -1): THREE.Group {
  const p = new THREE.Group();
  p.position.x = x;
  p.rotation.y = (sign * Math.PI) / 2;
  return p;
}

// ── 주기 시간표 (T = 26 rad, 속도 단위 rad/θ) ──
type State = 'M' | 'MR' | 'R' | 'RL' | 'L' | 'LM';
interface Seg {
  u0: number;
  u1: number;
  dA: number;
  dP: number;
  dL: number;
  x0: number;
  x1: number;
  s: State;
}
const SEGS: Seg[] = [
  { u0: 0, u1: 8, dA: 1, dP: 0.5, dL: 0, x0: X_M, x1: X_M, s: 'M' },
  { u0: 8, u1: 10, dA: 0, dP: 0, dL: 0, x0: X_M, x1: X_R, s: 'MR' },
  { u0: 10, u1: 18, dA: 2, dP: 1, dL: 0, x0: X_R, x1: X_R, s: 'R' },
  { u0: 18, u1: 20, dA: 0, dP: 0, dL: 0, x0: X_R, x1: X_L, s: 'RL' },
  { u0: 20, u1: 24, dA: 0, dP: 0, dL: 1, x0: X_L, x1: X_L, s: 'L' },
  { u0: 24, u1: 26, dA: 0, dP: 0, dL: 0, x0: X_L, x1: X_M, s: 'LM' }
];
const T = 26;
const GAIN_A = SEGS.reduce((s, g) => s + g.dA * (g.u1 - g.u0), 0); // 24
const GAIN_P = SEGS.reduce((s, g) => s + g.dP * (g.u1 - g.u0), 0); // 12
const GAIN_L = SEGS.reduce((s, g) => s + g.dL * (g.u1 - g.u0), 0); // 4

interface Pose {
  aA: number;
  phi: number;
  aL: number;
  beltX: number;
  s: State;
}

const smooth = (k: number): number => k * k * (3 - 2 * k);

/** θ → 절대 자세 (누적 없이 매번 다시 계산, 음수 θ 도 floor) */
function pose(theta: number): Pose {
  const n = Math.floor(theta / T);
  const u = theta - n * T;
  let aA = n * GAIN_A;
  let phi = n * GAIN_P;
  let aL = n * GAIN_L;
  for (const g of SEGS) {
    const d = Math.max(0, Math.min(u, g.u1) - g.u0);
    aA += g.dA * d;
    phi += g.dP * d;
    aL += g.dL * d;
    if (u >= g.u0 && u < g.u1) {
      const k = smooth((u - g.u0) / (g.u1 - g.u0));
      return { aA, phi, aL, beltX: g.x0 + (g.x1 - g.x0) * k, s: g.s };
    }
  }
  return { aA, phi, aL, beltX: X_M, s: 'M' };
}

export default function buildM061(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // ── 위 축 + 긴 구동 드럼 ──
  const upper = new THREE.Group();
  upper.position.set(0, YU, ZC);
  upper.add(shaftX(-1.9, 1.9, 0, 0));
  const pD = pivotX(-0.175, 1);
  const drum = pulley(RP, { width: 2.45, spokes: 0, flat: true, driver: true });
  drum.name = 'drumTop';
  pD.add(drum, rimMarks(RP, 2.45, 4));
  upper.add(pD);
  g.add(upper, bearingX(-1.7, YU, ZC), bearingX(1.7, YU, ZC));

  // ── 아래 축 받침(고정) ──
  g.add(bearingX(-1.7, YL, ZC), bearingX(1.7, YL, ZC));
  const lowerGroup = (): THREE.Group => {
    const q = new THREE.Group();
    q.position.set(0, YL, ZC);
    g.add(q);
    return q;
  };

  // L 헐거운 풀리
  const grpL = lowerGroup();
  const pL = pivotX(X_L, 1);
  const pulL = pulley(RP, { width: 0.4, flat: true });
  pulL.name = 'pulleyL';
  pL.add(pulL, rimMarks(RP, 0.4, 4));
  grpL.add(pL);

  // M 고정 풀리 + 허브 슬리브 + 베벨 A + 아래 축(모두 축에 고정)
  const grpA = lowerGroup();
  grpA.add(shaftX(-1.9, 1.9, 0, 0));
  const pM = pivotX(X_M, 1);
  const pulM = pulley(RP, { width: 0.4, flat: true });
  pulM.name = 'pulleyM';
  pM.add(pulM, rimMarks(RP, 0.4, 4), tubeZ(0.05, 0.075, 0.2, 0.42));
  grpA.add(pM);
  const pA = pivotX(XO - RG, 1); // 피치 평면 x = −0.25, 이가 +X
  const gearA = bevelGear(NT, MOD, { width: 0.1, bore: 0.05, driver: true });
  gearA.name = 'bevelA';
  pA.add(gearA);
  grpA.add(pA);

  // R 운반 풀리 + 차동 케이지 + 유성 P
  const carrier = lowerGroup();
  const pR = pivotX(X_R, 1);
  const pulR = pulley(RP, { width: 0.4, flat: true, hub: 0.1 });
  pulR.name = 'pulleyR';
  pR.add(pulR, rimMarks(RP, 0.4, 4));
  carrier.add(pR, diffCarrier({ xFace: X_R - 0.2, xO: XO, R: RG }));
  const pP = new THREE.Group();
  pP.position.set(XO, RG, 0);
  pP.rotation.x = Math.PI / 2; // 로컬 z → −Y (이가 축을 향함)
  const gearP = bevelGear(NT, MOD, { width: 0.1, spokes: 0 });
  gearP.name = 'bevelP';
  pP.add(gearP);
  carrier.add(pP);

  // C 셋째 베벨 + 슬리브 + 제동 드럼 (마찰 밴드가 붙들어 늘 정지)
  const grpC = lowerGroup();
  const pC = pivotX(XO + RG, -1); // 피치 평면 x = +0.15, 이가 −X
  const gearC = bevelGear(NT, MOD, { width: 0.1, bore: 0.05 });
  gearC.name = 'bevelC';
  pC.add(gearC, tubeZ(0.05, 0.085, -1.0, -0.07), tubeZ(0.05, 0.14, -1.3, -1.0, 'dark'), rimMarks(0.14, 0.3, 3, -1.15));
  grpC.add(pC);

  // 제동 밴드(고정) + 매단 추
  const band = brakeBand(0.14, 0.3);
  band.position.set(1.3, YL, ZC);
  band.traverse((o) => {
    const mm = o.userData.mm as { kind?: string } | undefined;
    if (mm?.kind === 'weight') o.name = 'brakeWeight';
  });
  g.add(band);

  // ── 평벨트: 평면 x = 일정, 통째로 x 로만 옮긴다 ──
  const loop = beltLoopYZ(YU, RB, YL, RB, ZC, 0);
  // beltLoopYZ 는 openBeltPath 를 같은 인자로 부른다 — 감긴 호 꼬리표를 3D 점으로 옮긴다(검사 표식)
  const path2 = openBeltPath([YL, ZC], RB, [YU, ZC], RB, 24);
  carryTags(path2, loop.pts, (a, b) => v(0, a, b));
  const belt = new Belt(loop.pts, { style: 'flat', width: 0.32, thickness: BT, widthDirs: loop.dirs, marks: 8 });
  belt.group.name = 'beltMain';
  g.add(belt.group);

  // ── 회전 화살표(위·아래 축 왼쪽 끝 밖, 오른쪽에서 보아 반시계) ──
  for (const y of [YU, YL]) {
    const a = rotArrow(0.3, true);
    a.rotation.y = Math.PI / 2;
    a.position.set(-2.05, y, ZC);
    g.add(a);
  }

  // ── 이름표 ──
  g.add(
    tag('구동 드럼', v(-0.2, 3.1, 0.5)),
    tag('헐거운 풀리', v(-1.2, 0.38, 0.5)),
    leaderTo(tag('차동 베벨', v(-0.05, 1.7, 0.5)), 'bevelP'),
    tag('운반 풀리', v(0.85, 0.38, 0.5)),
    tag('제동 밴드', v(1.5, 1.42, 0.5)) // 설계표 y 1.30 은 아래 축 그룹 상자(y ≤ 1.33) 안이라 조금 올림
  );

  let cur: Pose = pose(0);
  const apply = (): void => {
    cur = pose(theta);
    upper.rotation.x = theta;
    grpL.rotation.x = cur.aL;
    grpA.rotation.x = cur.aA;
    carrier.rotation.x = cur.phi;
    grpC.rotation.x = 0; // αC ≡ 0 — 밴드가 붙든다(αA + αC = 2φ)
    gearP.rotation.z = cur.phi - cur.aA - HALF_PITCH; // 검증된 물림 위상
    belt.group.position.x = cur.beltX;
    belt.setOffset(RB * theta);
  };
  apply();

  const beltText: Record<State, string> = {
    M: '가운데 고정 풀리',
    MR: '옮기는 중(고정 → 운반)',
    R: '오른쪽 운반 풀리',
    RL: '옮기는 중(운반 → 헐거운)',
    L: '왼쪽 헐거운 풀리',
    LM: '옮기는 중(헐거운 → 고정)'
  };
  const speedText: Record<State, string> = {
    M: '1 : 1 (단순)',
    MR: '정지(벨트 옮김)',
    R: '1 : 2 (차동, 2배)',
    RL: '정지(벨트 옮김)',
    L: '정지(헐거운 풀리만 돎)',
    LM: '정지(벨트 옮김)'
  };

  return {
    group: g,
    view: { pos: [1.6, 2.3, 6.4], target: [0, 1.7, 0.2] },
    notes: () => [
      { label: '벨트 위치', value: beltText[cur.s] },
      { label: '위 축 : 아래 축', value: speedText[cur.s] },
      { label: '유성 베벨', value: cur.s === 'M' || cur.s === 'R' ? '자전 + 공전' : '멈춤' },
      { label: '제동 밴드', value: '셋째 베벨을 붙잡아 둠' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
