// 059 두 단 속도 기어 — 위 원동 드럼의 벨트가 헐거운·가운데·오른쪽 풀리로 옮겨 가며 아래 축 B 를 느리게/빠르게 돌린다 (판화 59번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, meshAngle, pulley, rod, rotArrow, spurGear, tag, leaderTo, STAGE } from '../kit';
import { hollowShaft, rimStripes, verticalBelt, wallBracket } from '../kit/k059';

const ZC = 0.28; // 모든 축 높이(깊이 z)
const YU = 2.8; // 드럼 축
const YA = 1.55; // 축 A
const YB = 0.925; // 축 B
const MOD = 0.025;
const NBIG = 36;
const NSMALL = 14;
const R_WHEEL = 0.45; // 드럼·아래 풀리 반지름(같음)
const R_BELT = 0.46; // 벨트 중심 반지름
const PERIOD = 20; // 한 주기 θ (rad)
const BELT_X = { L: -0.45, M: -0.15, R: 0.17 } as const; // 벨트 중심 x = 걸린 풀리 중심 x
const RATIO_SLOW = NSMALL / NBIG;
const RATIO_FAST = NBIG / NSMALL;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const clamp = (x: number, a: number, b: number): number => Math.min(Math.max(x, a), b);

/** 주기마다 구간 segs 에 머문 θ 길이의 누적 */
function acc(theta: number, segs: [number, number][]): number {
  const per = segs.reduce((s, [a, b]) => s + (b - a), 0);
  const k = Math.floor(theta / PERIOD);
  const m = theta - k * PERIOD;
  return k * per + segs.reduce((s, [a, b]) => s + clamp(m - a, 0, b - a), 0);
}

/** 벨트 x 위치 시간표 */
function beltX(theta: number): number {
  const m = theta - Math.floor(theta / PERIOD) * PERIOD;
  const lerp = (a: number, b: number, t0: number, t1: number): number => a + (b - a) * clamp((m - t0) / (t1 - t0), 0, 1);
  if (m < 2.5) return BELT_X.L;
  if (m < 3.5) return lerp(BELT_X.L, BELT_X.M, 2.5, 3.5);
  if (m < 9) return BELT_X.M;
  if (m < 10) return lerp(BELT_X.M, BELT_X.R, 9, 10);
  if (m < 15.5) return BELT_X.R;
  if (m < 17) return lerp(BELT_X.R, BELT_X.L, 15.5, 17);
  return BELT_X.L;
}

/** X 축 둘레로 도는 묶음: 바깥(y 90° — 로컬 z → 월드 +x)과 안쪽(rotation.z = 월드 +X 둘레 각) */
function xSpinner(y: number, name: string): { outer: THREE.Group; inner: THREE.Group } {
  const outer = new THREE.Group();
  outer.rotation.y = Math.PI / 2;
  outer.position.set(0, y, ZC);
  const inner = new THREE.Group();
  inner.name = name;
  outer.add(inner);
  return { outer, inner };
}

/** 납작 풀리(+ 림 줄무늬)를 x 중심 xc 에 놓는다(안쪽 묶음 로컬 z = 월드 x) */
function addWheel(inner: THREE.Group, xc: number, width: number, name: string, driver = false): void {
  const w = new THREE.Group();
  w.position.z = xc;
  const p = pulley(R_WHEEL, { width, spokes: 6, flat: true, driver });
  p.name = name; // 검사(감긴 각)가 바퀴 표식의 이름으로 찾는다
  w.add(p, rimStripes(R_WHEEL, width, 6));
  inner.add(w);
}

function addGear(inner: THREE.Group, xc: number, teeth: number): void {
  const gr = spurGear(teeth, MOD, { width: 0.08, spokes: 6 });
  gr.position.z = xc;
  inner.add(gr);
}

export default function buildM059(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 축 3개와 뒤판 지지대 6개
  // 축 끝면은 받침 블록 옆면(블록 중심 ± 0.05)에 닿는다
  g.add(rod(v(-1.2, YU, ZC), v(0.9, YU, ZC), 0.045), rod(v(-1.2, YA, ZC), v(1.1, YA, ZC), 0.045), rod(v(-1.2, YB, ZC), v(1.1, YB, ZC), 0.045));
  for (const [x, y] of [[-1.25, YU], [0.95, YU], [-1.25, YA], [1.15, YA], [-1.25, YB], [1.15, YB]] as const) {
    g.add(wallBracket(x, y, ZC, STAGE.backZ));
  }

  // 드럼(x −0.58…0.32)
  const U = xSpinner(YU, 'drum');
  addWheel(U.inner, -0.13, 0.9, 'drum', true);
  g.add(U.outer);

  // 헐거운 풀리 L — 축 A 에 헐겁게
  const L = xSpinner(YA, 'pulleyL');
  addWheel(L.inner, BELT_X.L, 0.26, 'pulleyL');
  g.add(L.outer);

  // 축 A 에 고정: 가운데 풀리 M + 작은 피니언 Pa
  const A = xSpinner(YA, 'pulleyM');
  addWheel(A.inner, BELT_X.M, 0.3, 'pulleyM');
  addGear(A.inner, -1.0, NSMALL);
  g.add(A.outer);

  // 속 빈 축에 고정: 오른쪽 풀리 R + 속 빈 축 + 큰 기어 Gh
  const H = xSpinner(YA, 'gearH');
  addWheel(H.inner, BELT_X.R, 0.3, 'pulleyR');
  const hs = hollowShaft(0.075, 0.05, 0.5);
  hs.position.z = 0.3;
  H.inner.add(hs);
  addGear(H.inner, 0.78, NBIG);
  g.add(H.outer);

  // 축 B: 큰 기어 Gb + 작은 피니언 Pb
  const B = xSpinner(YB, 'shaftB');
  addGear(B.inner, -1.0, NBIG);
  addGear(B.inner, 0.78, NSMALL);
  g.add(B.outer);

  // 벨트(YZ 평면, 폭 방향 x)
  const vb = verticalBelt([{ c: [ZC, YU], r: R_BELT, ccw: false }, { c: [ZC, YA], r: R_BELT, ccw: false }], { width: 0.2 });
  // 평벨트 폭을 풀리 축(x = 로컬 z) 쪽으로 세운다(기본은 면 안쪽을 향함)
  const bpath = (vb.belt.group.userData.mm as { path: THREE.Vector3[] }).path;
  vb.belt.setPath(bpath, bpath.map(() => new THREE.Vector3(0, 0, 1)));
  vb.belt.group.name = 'belt';
  vb.group.name = 'belt';
  g.add(vb.group);

  // 회전 방향 화살표 (+X 회전 기준, B 는 반대)
  const aU = rotArrow(0.55, true);
  aU.rotation.y = Math.PI / 2; // 축(X)에 수직인 면 — 정면에서 세로
  aU.position.set(-0.7, YU, ZC);
  // B 화살표: 반지름 0.3, 호의 빈 곳(110°)을 위로 — 위쪽 축 A 의 풀리·벨트(아래 끝 y 1.1)를 뚫지 않게
  const aB = rotArrow(0.3, false);
  aB.rotation.y = Math.PI / 2; // 축(X)에 수직인 면 — 정면에서 세로
  aB.rotation.z = (98 * Math.PI) / 180;
  aB.position.set(-0.1, YB, ZC);
  g.add(aU, aB);

  g.add(
    tag('원동 드럼', v(0.75, 3.1, 0.5)),
    tag('헐거운 풀리', v(-0.72, 2.12, 0.75)),
    leaderTo(tag('고정 풀리(느림)', v(-0.2, 2.3, 0.75)), 'pulleyM'),
    tag('속 빈 축 풀리(빠름)', v(0.45, 2.12, 0.75)),
    tag('작은 기어', v(-1.45, 1.95, 0.5)),
    tag('큰 기어', v(1.3, 2.15, 0.5)),
    tag('출력 축 B', v(0.25, 0.62, 0.6))
  );

  let where = '헐거운 풀리';
  let out = '정지';

  function pose(): void {
    const m = theta - Math.floor(theta / PERIOD) * PERIOD;
    const dm = acc(theta, [[3.5, 9]]);
    const dr = acc(theta, [[10, 15.5]]);
    const dl = acc(theta, [[0, 2.5], [17, 20]]);
    const thB = -(RATIO_SLOW * dm + RATIO_FAST * dr);
    U.inner.rotation.z = theta;
    L.inner.rotation.z = dl;
    B.inner.rotation.z = thB;
    A.inner.rotation.z = meshAngle([0, YB], NBIG, thB, [0, YA], NSMALL);
    H.inner.rotation.z = meshAngle([0, YB], NSMALL, thB, [0, YA], NBIG);
    vb.setX(beltX(theta));
    vb.belt.setOffset(R_BELT * theta);
    if (m < 2.5 || m >= 17) { where = '헐거운 풀리'; out = '정지'; }
    else if (m < 3.5) { where = '헐거운 → 가운데(이동 중)'; out = '정지'; }
    else if (m < 9) { where = '가운데 풀리'; out = '느림(−0.39)'; }
    else if (m < 10) { where = '가운데 → 오른쪽(이동 중)'; out = '정지'; }
    else if (m < 15.5) { where = '오른쪽 풀리'; out = '빠름(−2.57)'; }
    else { where = '오른쪽 → 헐거움(이동 중)'; out = '정지'; }
  }
  pose();

  return {
    group: g,
    view: { pos: [0, 1.8, 6.6], target: [0, 1.8, 0.2] },
    notes: () => [
      { label: '벨트 위치', value: where },
      { label: '출력 속도', value: `${out}, 드럼 대비` },
      { label: '기어', value: '14↔36, 36↔14' },
      { label: '속도비', value: '약 6.6 : 1' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
