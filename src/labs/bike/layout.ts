// 구동계 배치 계산(순수 수학): 축 위치, 뒤 변속기 풀리 위치, 체인 길이에 맞는 케이지 각도.
// XY = 자전거 옆면(+X = 앞쪽), +Z = 구동측(체인 쪽). 단위: three 1 = 실물 0.25m.

import { ChainLoop, effRadius, type LoopCircle } from './chainLoop';
import type { BikeSpec } from './spec';

export const S = 4;
/** 자전거 체인 피치 1/2인치 = 12.7mm */
export const PITCH = 0.0127 * S;
export const ROLLER_R = PITCH * 0.31;
const LIFT = 0.42; // 전시 스탠드가 뒷바퀴를 바닥에서 들어 올린 높이
const BB_DROP = 0.07 * S;
const GUIDE_GAP = 0.006 * S; // 스프로킷 이끝과 위 풀리 사이 간격
const GUIDE_ANG = (-100 * Math.PI) / 180; // 위 풀리가 놓이는 방향(뒤 차축 기준, 아래·약간 뒤)
export const PHI_MIN = (-175 * Math.PI) / 180;
export const PHI_MAX = (-35 * Math.PI) / 180;
const PHI_TIGHT = (-48 * Math.PI) / 180; // 가장 큰 앞 × 가장 큰 뒤에서의 케이지 각도 → 체인 길이 결정

export interface Base {
  wheelR: number;
  rimR: number;
  tireTube: number;
  axleY: number;
  rx: number;
  ry: number;
  bx: number;
  by: number;
  pulleyR: number;
  cageLen: number;
  hubHalf: number;
  ringR: number[];
  ringZ: number[];
  cogR: number[];
  cogZ: number[];
  chainLen: number;
}

export interface DriveState {
  ringR: number;
  ringZ: number;
  cogR: number;
  cogZ: number;
}

export interface Rig {
  gx: number;
  gy: number;
  tx: number;
  ty: number;
  phi: number;
  loop: ChainLoop;
  /** 체인 길이를 맞추지 못해 케이지가 한계에 닿았는가 */
  clamped: boolean;
}

export function guidePos(b: Base, st: DriveState): { x: number; y: number } {
  const d = st.cogR + b.pulleyR + GUIDE_GAP;
  return { x: b.rx + d * Math.cos(GUIDE_ANG), y: b.ry + d * Math.sin(GUIDE_ANG) };
}

/** 체인 감는 순서: 뒤 스프로킷 → (윗줄, 앞으로) → 체인링 → (아랫줄) → 아래 풀리 → 위 풀리(S자) → 뒤 스프로킷 */
export function loopFor(b: Base, st: DriveState, phi: number): ChainLoop {
  const g = guidePos(b, st);
  const circles: LoopCircle[] = [
    { x: b.rx, y: b.ry, r: st.cogR, z: st.cogZ, dir: -1 },
    { x: b.bx, y: b.by, r: st.ringR, z: st.ringZ, dir: -1 },
    { x: g.x + b.cageLen * Math.cos(phi), y: g.y + b.cageLen * Math.sin(phi), r: b.pulleyR, z: st.cogZ, dir: -1 },
    { x: g.x, y: g.y, r: b.pulleyR, z: st.cogZ, dir: 1 }
  ];
  return new ChainLoop(circles);
}

export function solveRig(b: Base, st: DriveState, length = b.chainLen): Rig {
  // 케이지를 뒤로 돌릴수록(phi 감소) 아래 풀리가 멀어져 경로가 길어진다 → 이분법
  let lo = PHI_MIN;
  let hi = PHI_MAX;
  const lenAt = (p: number): number => loopFor(b, st, p).length;
  let clamped = false;
  let phi: number;
  if (lenAt(hi) >= length) {
    phi = hi;
    clamped = true;
  } else if (lenAt(lo) <= length) {
    phi = lo;
    clamped = true;
  } else {
    for (let i = 0; i < 34; i++) {
      const mid = (lo + hi) / 2;
      if (lenAt(mid) > length) lo = mid;
      else hi = mid;
    }
    phi = (lo + hi) / 2;
  }
  const loop = loopFor(b, st, phi);
  const g = guidePos(b, st);
  return { gx: g.x, gy: g.y, tx: g.x + b.cageLen * Math.cos(phi), ty: g.y + b.cageLen * Math.sin(phi), phi, loop, clamped };
}

export function makeBase(spec: BikeSpec): Base {
  const wheelR = (spec.circumference / (Math.PI * 2)) * S;
  const rimR = 0.311 * S; // 700C·29인치 림 지름 622mm
  const axleY = wheelR + LIFT;
  const cs = Math.sqrt((spec.chainstay * S) ** 2 - BB_DROP ** 2);
  const nR = spec.rings.length;
  const nC = spec.cogs.length;
  const base: Base = {
    wheelR,
    rimR,
    tireTube: (wheelR - rimR) / 2,
    axleY,
    rx: -cs,
    ry: axleY,
    bx: 0,
    by: axleY - BB_DROP,
    pulleyR: effRadius(spec.pulleyTeeth, PITCH),
    cageLen: spec.cageLen * S,
    hubHalf: spec.hubHalf * S,
    // 체인링: 작은 것이 안쪽(z 작음), 스프로킷: 큰 것이 안쪽
    ringR: spec.rings.map((t) => effRadius(t, PITCH)),
    ringZ: spec.rings.map((_, i) => (spec.ringCenterZ + (i - (nR - 1) / 2) * spec.ringSpacing) * S),
    cogR: spec.cogs.map((t) => effRadius(t, PITCH)),
    cogZ: spec.cogs.map((_, i) => (spec.cogCenterZ + (i - (nC - 1) / 2) * spec.cogSpacing) * S),
    chainLen: 0
  };
  // 체인 길이: 가장 큰 앞 × 가장 큰 뒤에서 케이지가 앞으로 많이 당겨진 상태 + 짝수 링크로 올림
  const big: DriveState = { ringR: base.ringR[nR - 1]!, ringZ: base.ringZ[nR - 1]!, cogR: base.cogR[0]!, cogZ: base.cogZ[0]! };
  const raw = loopFor(base, big, PHI_TIGHT).length;
  base.chainLen = Math.ceil(raw / (2 * PITCH)) * 2 * PITCH;
  return base;
}

export function stateFor(b: Base, front: number, rear: number): DriveState {
  return { ringR: b.ringR[front]!, ringZ: b.ringZ[front]!, cogR: b.cogR[rear]!, cogZ: b.cogZ[rear]! };
}
