// 060 벨트 두 단 속도 — 위 축에 큰 통·작은 통 풀리, 아래 축에 같은 크기 풀리 넷(바깥 둘 헐겁고 안쪽 둘 고정).
// 두 벨트가 함께 옆으로 한 칸 옮겨 가면 아래 축이 느린(0.57배) 운동에서 빠른(1배) 운동으로 바뀐다. (판화 60번)
// 축은 모두 X 방향. 풀리는 로컬 XY 에 만들어 바깥 그룹을 rotation.y = π/2 로 눕힌다(로컬 z → 월드 +x).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, beltPathAround, displayStand, pulley, rod, rotArrow, tag, type V2 } from '../kit';
import { markWraps, type MmVec, type MmWrap } from '../kit/mm';
import { rimStripes, wallBracket } from '../kit/k059';

const ZC = 0.28; // 모든 축 높이(월드 z)
const BACK_Z = -0.3; // 뒤판 앞면
const YU = 2.85; // 위 축 높이(월드 y)
const YS = 1.3; // 아래 축 높이
const X0 = -1.65; // 축 왼쪽 끝
const X1 = 1.25; // 축 오른쪽 끝

const R_BIG = 0.42; // 큰 통 풀리·아래 풀리 반지름
const R_SMALL = 0.24; // 작은 통 풀리 반지름
const W_UP = 0.76; // 위 통 폭
const W_LO = 0.37; // 아래 풀리 폭
const BELT_W = 0.18;

// 풀리 x 중심 (판화: 통 하나의 폭 = 아래 풀리 둘의 폭, 통의 양 끝 = 묶음의 양 끝)
const X_UL = -1.02;
const X_UR = 0.5;
const X_LL = -1.215;
const X_FL = -0.825;
const X_FR = 0.305;
const X_LR = 0.695;
const MOVE = X_FL - X_LL; // 벨트가 옮겨 가는 거리 0.39(두 벨트 같음)

const BELT_R_BIG = R_BIG + 0.01; // 벨트 중심선 반지름(풀리 + 반 두께)
const BELT_R_SMALL = R_SMALL + 0.01;

const RATIO_SLOW = R_SMALL / R_BIG; // 0.5714 (오른 벨트: 작은 통 → 큰 풀리)
const RATIO_FAST = 1; // 왼 벨트: 큰 통 → 같은 크기 풀리

const PERIOD = 14; // θ 한 주기

const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const smooth = (u: number): number => u * u * (3 - 2 * u);

/** θ 한 주기(14) 가운데 구간 [a,b] 에 머문 θ 길이의 누적 */
function acc(theta: number, segs: [number, number][]): number {
  const n = Math.floor(theta / PERIOD);
  const m = theta - n * PERIOD;
  let s = 0;
  let per = 0;
  for (const [a, b] of segs) {
    per += b - a;
    s += Math.min(Math.max(m - a, 0), b - a);
  }
  return n * per + s;
}

/** 벨트 이동 u (0 → 1) — 0~6 0, 6~7 올라감, 7~13 1, 13~14 내려감 */
function slideU(theta: number): number {
  const m = theta - Math.floor(theta / PERIOD) * PERIOD;
  if (m < 6) return 0;
  if (m < 7) return smooth(m - 6);
  if (m < 13) return 1;
  return smooth(14 - m);
}

/**
 * 세로(YZ 평면) 평벨트. 경로는 로컬 (z, y), 폭 방향은 로컬 z(= 월드 −x)로 고정해 띠가 서지 않게 한다.
 * (kit/k059 의 verticalBelt 는 widthDirs 를 안 줘서 폭이 면 안쪽으로 눕는다 — 여기서 직접 만든다)
 */
function tallBelt(circles: { c: V2; r: number; ccw: boolean }[], width: number): { group: THREE.Group; belt: Belt; setX(x: number): void } {
  const pts = beltPathAround(circles).map(([a, b]) => new THREE.Vector3(a, b, 0));
  const dirs = pts.map(() => new THREE.Vector3(0, 0, 1));
  const belt = new Belt(pts, { style: 'flat', width, widthDirs: dirs });
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2; // 로컬 x → 월드 z, 로컬 z → 월드 −x
  inner.add(belt.group);
  const outer = new THREE.Group();
  outer.add(inner);
  return { group: outer, belt, setX: (x: number) => outer.position.set(x, 0, 0) };
}

/** X 축 부품 바깥 그룹: 원점 = (0, y, ZC), 로컬 z → 월드 +x */
function xFrame(y: number): THREE.Group {
  const o = new THREE.Group();
  o.position.set(0, y, ZC);
  o.rotation.y = Math.PI / 2;
  return o;
}

/** 풀리 + 림 줄무늬(한 덩어리). 로컬 z = x 중심 */
function wheelAt(name: string, r: number, width: number, xc: number, spokes: number, driver: boolean): THREE.Group {
  const p = pulley(r, { width, spokes, flat: true, driver });
  p.name = name;
  p.add(rimStripes(r, width, 6));
  p.position.set(0, 0, xc);
  return p;
}

export default function buildM060(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let state = '느림';

  g.add(displayStand());

  // ── 위 축 U: 두 통이 한 축에 고정(같은 각 θ) ──
  const upperOuter = xFrame(YU);
  const upper = new THREE.Group();
  upper.name = 'upperShaft';
  upper.add(rod(v3(0, 0, X0 + 0.05), v3(0, 0, X1 - 0.05), 0.045)); // 끝면이 받침 블록 옆면에 닿음
  upper.add(wheelAt('upperBig', R_BIG, W_UP, X_UL, 6, true));
  upper.add(wheelAt('upperSmall', R_SMALL, W_UP, X_UR, 6, true));
  upperOuter.add(upper);
  g.add(upperOuter);

  // ── 아래 축 S: 고정 풀리 둘은 S 에 고정, 헐거운 풀리 둘은 따로 돈다 ──
  const lowerOuter = xFrame(YS);
  const lower = new THREE.Group();
  lower.name = 'lowerShaft';
  lower.add(rod(v3(0, 0, X0 + 0.05), v3(0, 0, X1 - 0.05), 0.045)); // 끝면이 받침 블록 옆면에 닿음
  lower.add(wheelAt('fixedLeft', R_BIG, W_LO, X_FL, 4, false));
  lower.add(wheelAt('fixedRight', R_BIG, W_LO, X_FR, 4, false));
  lowerOuter.add(lower);
  const looseLeft = wheelAt('looseLeft', R_BIG, W_LO, X_LL, 4, false);
  const looseRight = wheelAt('looseRight', R_BIG, W_LO, X_LR, 4, false);
  lowerOuter.add(looseLeft, looseRight);
  g.add(lowerOuter);

  // ── 벨트 둘 (세로 YZ 평면, 평벨트) ──
  const beltL = tallBelt(
    [
      { c: [ZC, YU], r: BELT_R_BIG, ccw: false },
      { c: [ZC, YS], r: BELT_R_BIG, ccw: false }
    ],
    BELT_W
  );
  beltL.belt.group.name = 'beltLeft';
  const beltR = tallBelt(
    [
      { c: [ZC, YU], r: BELT_R_SMALL, ccw: false },
      { c: [ZC, YS], r: BELT_R_BIG, ccw: false }
    ],
    BELT_W
  );
  beltR.belt.group.name = 'beltRight';
  g.add(beltL.group, beltR.group);

  // 감긴 호 표식(벨트 그룹 로컬 = (z, y, 폭)): 왼 벨트 위·아래 180°, 오른 벨트는 6.7° 기울어 위 166.6°·아래 193.4°
  const tilt = Math.asin((BELT_R_BIG - BELT_R_SMALL) / (YU - YS));
  const degTop = 180 - (2 * tilt * 180) / Math.PI;
  const wrapPair = (rTop: number, dTop: number, dBot: number, wTop: string, wBot: string): Partial<MmWrap>[] => [
    { c: [ZC, YU, 0] as MmVec, axis: [0, 0, 1] as MmVec, r: rTop, ccw: false, deg: dTop, mid: [ZC, YU + rTop, 0] as MmVec, src: 'm060', wheel: wTop },
    { c: [ZC, YS, 0] as MmVec, axis: [0, 0, 1] as MmVec, r: BELT_R_BIG, ccw: false, deg: dBot, mid: [ZC, YS - BELT_R_BIG, 0] as MmVec, src: 'm060', wheel: wBot }
  ];
  markWraps(beltL.belt.group, wrapPair(BELT_R_BIG, 180, 180, 'upperBig', 'looseLeft'));
  markWraps(beltR.belt.group, wrapPair(BELT_R_SMALL, degTop, 360 - degTop, 'upperSmall', 'fixedRight'));

  // ── 뒤판 축받이 4개 ──
  for (const [x, y] of [
    [X0, YU],
    [X1, YU],
    [X0, YS],
    [X1, YS]
  ] as [number, number][]) {
    g.add(wallBracket(x, y, ZC, BACK_Z));
  }

  // ── 회전 화살표(+X 회전) ──
  for (const y of [YU, YS]) {
    const a = rotArrow(0.4, true); // 0.5 면 비스듬한 호의 x 폭(±0.39)이 양옆 통·풀리 옆면(x −0.64·0.12)에 닿는다
    a.position.set(-0.25, y, ZC);
    a.rotation.y = Math.PI / 2 - 0.9;
    g.add(a);
  }

  // ── 이름표 6개 ──
  g.add(
    tag('구동 축', v3(1.6, 3.1, 0.4)),
    tag('큰 통 풀리', v3(-1.0, 3.2, 0.75)),
    tag('작은 통 풀리', v3(0.5, 3.2, 0.75)),
    tag('헐거운 풀리(바깥)', v3(-1.75, 0.75, 0.6)),
    tag('고정 풀리(안쪽)', v3(-0.3, 0.75, 0.75)),
    tag('출력 축', v3(1.6, 1.0, 0.4))
  );

  /** θ 하나에서 모든 부품의 절대 자세를 다시 계산 */
  function apply(): void {
    const u = slideU(theta);
    const m = theta - Math.floor(theta / PERIOD) * PERIOD;
    state = m < 6 ? '느림' : m < 7 ? '이동 중(느림→빠름)' : m < 13 ? '빠름' : '이동 중(빠름→느림)';

    const ds = acc(theta, [[0, 6]]);
    const df = acc(theta, [[7, 13]]);

    upper.rotation.z = theta;
    lower.rotation.z = RATIO_SLOW * ds + RATIO_FAST * df;
    looseLeft.rotation.z = RATIO_FAST * ds; // 왼 벨트가 걸린 느림 구간에만 구동
    looseRight.rotation.z = RATIO_SLOW * df;

    beltL.setX(X_LL + MOVE * u);
    beltR.setX(X_FR + MOVE * u);
    beltL.belt.setOffset(BELT_R_BIG * theta);
    beltR.belt.setOffset(BELT_R_SMALL * theta);
  }
  apply();

  return {
    group: g,
    view: { pos: [-1.4, 2.3, 6.4], target: [0, 1.75, 0.2] },
    notes: () => {
      const m = theta - Math.floor(theta / PERIOD) * PERIOD;
      const out = m < 6 ? RATIO_SLOW : m >= 7 && m < 13 ? RATIO_FAST : null;
      return [
        { label: '상태', value: state },
        { label: '출력 속도(위 축 대비)', value: out === null ? '이동 중(전달 없음)' : out.toFixed(2) },
        { label: '속도비', value: '1 : 1.75' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
