// 058 세 단 속도 기어 — 원동 드럼의 평벨트를 아래 풀리 4개(헐거운 것 + 고정 3개) 사이로 옮겨 걸면
// 겹친 세 축(주축·속 빈 축 1·속 빈 축 2)의 기어 세 쌍 가운데 하나가 아래 축을 돌려 세 가지 속도가 난다 (판화 58번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, meshAngle, openBeltPath, planar, pulley, rod, rotArrow, spurGear, tag, type V2 } from '../kit';
import { sleeveZ, wallBracket } from '../kit/k057';

const ZC = 0.275; // 모든 축의 깊이(z)
const Y_DRUM = 2.52;
const Y_MAIN = 1.52;
const Y_LOW = 0.76; // 중심 거리 0.76 = 피치 반지름 합(모듈 0.04)
const MOD = 0.04;
const R_PUL = 0.42; // 드럼·풀리 반지름(같음 → 벨트 속도비 1)
const PUL_W = 0.15;
const BELT_T = 0.02;
const R_BELT = R_PUL + BELT_T / 2; // 벨트 중심선 반지름 0.43
const X_DRUM = 0.405;

// 아래 풀리 x 위치 (오른쪽부터 헐거운 L → P1 주축 고정 → P2 속 빈 축 1 → P3 속 빈 축 2)
const X_L = 0.66;
const X_P1 = 0.49;
const X_P2 = 0.32;
const X_P3 = 0.15;
// 기어 쌍 x 위치와 잇수 (주축 쪽 / 아래 축 쪽)
const X_A = -1.1;
const X_B = -0.65;
const X_C = -0.2;
const ZA = 14;
const ZB = 19;
const ZC_T = 24; // 기어 C 잇수
// 아래 기어 잇수(반대 차례)
const ZA2 = 24;
const ZB2 = 19;
const ZC2 = 14;

// 맞물림 위상 계산용 로컬 평면 좌표 (X 축 기어 그룹의 로컬 xy — 로컬 y = 월드 y)
const CM: V2 = [0, Y_MAIN];
const CL: V2 = [0, Y_LOW];

// 벨트 시간표: 상태 [P1, P2, P3, P2, P1, L], 각 5 rad, 주기 30 rad
const STEP = 5;
const PERIOD = 30;
const BLEND = 0.6; // 경계 앞뒤 옮김 시간(rad)
type PulleyId = 0 | 1 | 2 | 3; // 0 = L, 1 = P1, 2 = P2, 3 = P3
const SCHEDULE: PulleyId[] = [1, 2, 3, 2, 1, 0];
const PX: Record<PulleyId, number> = { 0: X_L, 1: X_P1, 2: X_P2, 3: X_P3 };
const PNAME: Record<PulleyId, string> = { 0: '헐거운 풀리(멈춤)', 1: '작은 기어 풀리(P1)', 2: '중간 기어 풀리(P2)', 3: '큰 기어 풀리(P3)' };

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

const smooth = (t: number): number => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

/** θ 에서 벨트가 걸린 상태 번호(0~5) */
function stateIndex(theta: number): number {
  const r = theta - Math.floor(theta / PERIOD) * PERIOD;
  return Math.min(5, Math.floor(r / STEP));
}

/** 벨트 중심 x — 경계 ±BLEND 동안 smoothstep 으로 옮겨 간다 */
function beltX(theta: number): number {
  const r = theta - Math.floor(theta / PERIOD) * PERIOD;
  const k = Math.round(r / STEP); // 가장 가까운 경계(0~6)
  const b = k * STEP;
  if (Math.abs(r - b) < BLEND) {
    const prev = SCHEDULE[(k + 5) % 6]!;
    const next = SCHEDULE[k % 6]!;
    return PX[prev] + (PX[next] - PX[prev]) * smooth((r - (b - BLEND)) / (2 * BLEND));
  }
  return PX[SCHEDULE[stateIndex(theta)]!];
}

/** 누적 구동각 [D_L, D_P1, D_P2, D_P3] — 각 풀리가 구동 풀리였던 구간 길이 합(θ 의 직접 함수) */
function driveAngles(theta: number): [number, number, number, number] {
  const n = Math.floor(theta / PERIOD);
  const r = theta - n * PERIOD;
  const d: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 6; i++) {
    const id = SCHEDULE[i]!;
    d[id] += n * STEP + Math.min(STEP, Math.max(0, r - i * STEP));
  }
  return d;
}

/** X 방향 축 조립: outer 는 자리·방향(로컬 z → 월드 +X), inner.rotation.z 가 +X 에서 볼 때 반시계 회전 */
function xAxis(x: number, y: number): { outer: THREE.Group; inner: THREE.Group } {
  const outer = new THREE.Group();
  outer.rotation.y = Math.PI / 2;
  outer.position.set(x, y, ZC);
  const inner = new THREE.Group();
  outer.add(inner);
  return { outer, inner };
}

/** inner 안에 로컬 z = 월드 x - x0 로 부품을 끼운다 */
function placeAt(obj: THREE.Object3D, dz: number): THREE.Object3D {
  obj.position.set(0, 0, dz);
  return obj;
}

export default function buildM058(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // ── 원동 드럼 + 드럼 축 ──
  const drumAx = xAxis(0, Y_DRUM);
  const drum = pulley(R_PUL, { flat: true, width: 0.7, spokes: 0, driver: true, hub: 0.04 });
  drum.name = 'drum';
  drumAx.inner.add(placeAt(drum, X_DRUM));
  drumAx.inner.add(rod(v(0, 0, -0.1), v(0, 0, 0.9), 0.04));
  g.add(drumAx.outer);

  // ── 주축 + P1 + 기어 A (한 몸) ──
  const mainAx = xAxis(0, Y_MAIN);
  mainAx.inner.add(rod(v(0, 0, -1.3), v(0, 0, 0.98), 0.04));
  const p1 = pulley(R_PUL, { flat: true, width: PUL_W, spokes: 4, hub: 0.04 });
  p1.name = 'pulleyP1';
  mainAx.inner.add(placeAt(p1, X_P1));
  const gearA = spurGear(ZA, MOD, { width: 0.12, spokes: 4 });
  gearA.name = 'gearA';
  mainAx.inner.add(placeAt(gearA, X_A));
  g.add(mainAx.outer);

  // ── 속 빈 축 1 + P2 + 기어 B ──
  const s1Ax = xAxis(0, Y_MAIN);
  s1Ax.inner.add(placeAt(sleeveZ(0.065, 0.045, 1.09), -0.71));
  const p2 = pulley(R_PUL, { flat: true, width: PUL_W, spokes: 4, hub: 0.065 });
  p2.name = 'pulleyP2';
  s1Ax.inner.add(placeAt(p2, X_P2));
  const gearB = spurGear(ZB, MOD, { width: 0.12, spokes: 4 });
  gearB.name = 'gearB';
  s1Ax.inner.add(placeAt(gearB, X_B));
  g.add(s1Ax.outer);

  // ── 속 빈 축 2 + P3 + 기어 C ──
  const s2Ax = xAxis(0, Y_MAIN);
  s2Ax.inner.add(placeAt(sleeveZ(0.085, 0.067, 0.47), -0.26));
  const p3 = pulley(R_PUL, { flat: true, width: PUL_W, spokes: 4, hub: 0.085 });
  p3.name = 'pulleyP3';
  s2Ax.inner.add(placeAt(p3, X_P3));
  const gearC = spurGear(ZC_T, MOD, { width: 0.12, spokes: 4 });
  gearC.name = 'gearC';
  s2Ax.inner.add(placeAt(gearC, X_C));
  g.add(s2Ax.outer);

  // ── 헐거운 풀리 L (주축 위에서 헐겁게) ──
  const lAx = xAxis(0, Y_MAIN);
  const loose = pulley(R_PUL, { flat: true, width: PUL_W, spokes: 4, hub: 0.04 });
  loose.name = 'loosePulley';
  lAx.inner.add(placeAt(loose, X_L));
  g.add(lAx.outer);

  // ── 아래 축 + 아래 기어 A′ B′ C′ (한 몸, name lowerShaft) ──
  const lowAx = xAxis(0, Y_LOW);
  const lower = lowAx.inner;
  lower.name = 'lowerShaft';
  lower.add(rod(v(0, 0, -1.3), v(0, 0, 0.08), 0.04));
  const gA2 = spurGear(ZA2, MOD, { width: 0.12, spokes: 4 });
  gA2.name = 'gearA2';
  const gB2 = spurGear(ZB2, MOD, { width: 0.12, spokes: 4 });
  gB2.name = 'gearB2';
  const gC2 = spurGear(ZC2, MOD, { width: 0.12, spokes: 4 });
  gC2.name = 'gearC2';
  lower.add(placeAt(gA2, X_A), placeAt(gB2, X_B), placeAt(gC2, X_C));
  g.add(lowAx.outer);

  // ── 뒤판 축받이 팔 6개 (판화에 없음 — 보충) ──
  g.add(
    wallBracket(-0.04, Y_DRUM, ZC),
    wallBracket(0.85, Y_DRUM, ZC),
    wallBracket(-1.22, Y_MAIN, ZC),
    wallBracket(0.92, Y_MAIN, ZC),
    wallBracket(-1.22, Y_LOW, ZC),
    wallBracket(0.0, Y_LOW, ZC)
  );

  // ── 평벨트: 드럼(위) – 걸린 풀리(아래), 벨트 평면 YZ, 폭 X ──
  // 평벨트 폭은 Belt 기본(경로 평면 안 = 반지름 방향)이 아니라 드럼 축 방향이어야 넓은 면이 원통에 닿는다 → 점마다 로컬 Z(= 월드 X)
  const beltPath = planar(openBeltPath([0, Y_DRUM], R_BELT, [0, Y_MAIN], R_BELT), 0);
  const belt = new Belt(beltPath, { style: 'flat', width: 0.13, thickness: BELT_T, widthDirs: beltPath.map(() => new THREE.Vector3(0, 0, 1)) });
  belt.group.name = 'belt';
  belt.group.rotation.y = Math.PI / 2; // 로컬 x → 월드 −z, 로컬 z(폭) → 월드 x
  belt.group.position.set(X_P1, 0, ZC);
  g.add(belt.group);

  // ── 회전 방향 화살표 (+X 에서 본 기준: 드럼 반시계, 아래 축 시계) ──
  const a1 = rotArrow(0.5, true);
  a1.rotation.y = Math.PI / 2; // 드럼 축(X)에 수직인 면 — 정면에서 세로로 선다
  a1.position.set(0.85, Y_DRUM, ZC);
  const a2 = rotArrow(0.3, false);
  a2.rotation.y = Math.PI / 2;
  a2.position.set(-0.42, Y_LOW, ZC);
  g.add(a1, a2);

  g.add(
    tag('원동 드럼', v(0.4, 3.1, 0.5)),
    tag('헐거운 풀리', v(1.25, 1.95, 0.5)),
    tag('풀리 3개(고정)', v(0.62, 0.9, 0.7)), // 아래 축 오른쪽 축받이 팔·회전 화살표를 가리지 않게 오른쪽으로
    tag('작은 기어(주축)', v(-1.55, 1.95, 0.5)),
    tag('중간 기어(속 빈 축 1)', v(-1.0, 2.5, 0.5)),
    tag('큰 기어(속 빈 축 2)', v(-0.2, 2.2, 0.75)),
    tag('아래 축(출력)', v(-1.6, 0.45, 0.5))
  );

  let thetaLow = 0;
  const pose = (): void => {
    const [dL, dP1, dP2, dP3] = driveAngles(theta);
    thetaLow = -(ZA / ZA2) * dP1 - (ZB / ZB2) * dP2 - (ZC_T / ZC2) * dP3;
    drumAx.inner.rotation.z = theta;
    lower.rotation.z = thetaLow;
    mainAx.inner.rotation.z = meshAngle(CL, ZA2, thetaLow, CM, ZA);
    s1Ax.inner.rotation.z = meshAngle(CL, ZB2, thetaLow, CM, ZB);
    s2Ax.inner.rotation.z = meshAngle(CL, ZC2, thetaLow, CM, ZC_T);
    lAx.inner.rotation.z = dL;
    belt.group.position.x = beltX(theta);
    belt.setOffset(theta * R_BELT);
  };
  pose();

  return {
    group: g,
    view: { pos: [1.6, 2.3, 6.4], target: [-0.1, 1.65, 0.2] },
    notes: () => {
      const id = SCHEDULE[stateIndex(theta)]!;
      return [
        { label: '벨트 위치', value: PNAME[id] },
        { label: '출력 속도비', value: '0.58 : 1 : 1.71 (드럼 1 기준, 방향 반대)' },
        { label: '아래 축 회전수', value: `${(Math.abs(thetaLow) / (2 * Math.PI)).toFixed(1)} 바퀴` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
