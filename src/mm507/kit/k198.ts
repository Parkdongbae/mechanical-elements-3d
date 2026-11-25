// 198번 이음 맹글 랙 전용 키트 — 위·아래 이 줄이 난 고리(랙), 미끄럼 틀, 닫힌 시간표
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint } from '../../models/materials';
import { extrude, lathe, mesh, pathFrom, rodProfile, roundedRect } from '../../models/parts/geom';
import type { V2 } from './belt';
import { setMM } from './mm';

export const K198 = {
  N: 10,
  m: 0.05,
  YC: 1.7,
  n: 6, // 한 행정에 맞물리는 이 수
  lift: 0.24, // 랙이 들리는 높이
  zRing0: 0.06,
  zRing1: 0.14,
  zFrame0: -0.06,
  zFrame1: -0.02,
  frameHalf: 1.2,
  frameH: 0.62,
  ringHalf: 1.1,
  ringH: 0.55,
  winHalf: 1.02,
  pivX: 0.95, // 막대 핀의 x (틀·고리 로컬, 틀은 −, 고리는 +)
  pivY: 0.47,
  rodLen: 1.9,
  rollerR: 0.09
} as const;

export const RP198 = (K198.N * K198.m) / 2; // 0.25
export const P198 = Math.PI * K198.m;
export const TAU198 = (2 * Math.PI) / K198.N;
export const D198 = 2 * RP198 + K198.lift; // 위·아래 피치선 간격
export const S198 = K198.n * P198; // 행정

const ss = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const invSs = (y: number): number => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ss(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
const M = K198.m;
const UA = invSs((2 * M) / K198.lift); // 위 이끝이 피니언 이끝원을 벗어나는 때
const UB = invSs((K198.lift - 2 * M) / K198.lift); // 아래 이끝이 이끝원에 들어오는 때
const W198 = 3 * TAU198; // 들림 창
export const WF198 = (UB - UA) * W198; // 어느 줄도 안 물리는 정지 구간(피니언 각)
export const PERIOD198 = 2 * (K198.n * TAU198 + WF198);

export interface State198 {
  /** 고리 기준 x(세계) */
  X: number;
  /** 고리 가운데의 피니언 중심 대비 높이(−lift/2 위 줄 물림 ~ +lift/2 아래 줄 물림) */
  yr: number;
  /** 0 = 위 줄 물림, 1 = 아래 줄 물림(진행도) */
  lift: number;
  mode: 'A' | 'B' | 'F1' | 'F2';
}

/** 피니언 각 theta 의 닫힌 식(주기 PERIOD198) */
export function ring198(theta: number): State198 {
  const T = PERIOD198;
  const q = ((theta % T) + T) % T;
  const nT = K198.n * TAU198;
  const c1 = nT + WF198 / 2;
  const c2 = 2 * nT + WF198 + WF198 / 2;
  let L: number;
  if (q >= c2 - W198 / 2) L = 1 - ss((q - c2) / W198 + 0.5);
  else if (q < c2 + W198 / 2 - T) L = 1 - ss((q + T - c2) / W198 + 0.5);
  else L = ss((q - c1) / W198 + 0.5);
  let X: number;
  let mode: State198['mode'];
  if (q < nT) {
    X = S198 / 2 - RP198 * q;
    mode = 'A';
  } else if (q < nT + WF198) {
    X = -S198 / 2;
    mode = 'F1';
  } else if (q < 2 * nT + WF198) {
    X = -S198 / 2 + RP198 * (q - nT - WF198);
    mode = 'B';
  } else {
    X = S198 / 2;
    mode = 'F2';
  }
  return { X, yr: -K198.lift / 2 + K198.lift * L, lift: L, mode };
}

const mod = (a: number, b: number): number => ((a % b) + b) % b;
/** 이 가운데 위치(고리 로컬 x, 피치 간격 안) — 위 줄·아래 줄 */
export const T_TOP198 = mod((RP198 * Math.PI) / 2 - S198 / 2, P198);
export const T_BOT198 = mod(T_TOP198 + RP198 * WF198, P198);

/** 이 하나의 점(왼쪽 뿌리 → 이끝 → 이끝 → 오른쪽 뿌리). dir=+1 이면 이끝이 +y */
function oneTooth(c: number, pitchY: number, dir: 1 | -1): V2[] {
  const t20 = Math.tan((20 * Math.PI) / 180);
  const hw = 0.23 * P198;
  const th = hw - M * t20;
  const hr = hw + 1.25 * M * t20;
  const yTip = pitchY + dir * M;
  const yRoot = pitchY - dir * 1.25 * M;
  return [
    [c - hr, yRoot],
    [c - th, yTip],
    [c + th, yTip],
    [c + hr, yRoot]
  ];
}

/** 고리(랙) 로컬: 원점 = 고리 기준 x·가운데 높이. 두께 z 0.06~0.14 */
export function ringBody198(): THREE.Group {
  const K = K198;
  const g = new THREE.Group();
  const ks: number[] = [];
  for (let k = -6; k <= 5; k++) ks.push(k);
  const yb = -D198 / 2 - 1.25 * M;
  const yt = D198 / 2 + 1.25 * M;
  const bot: V2[] = [];
  for (const k of ks) bot.push(...oneTooth(T_BOT198 + k * P198, -D198 / 2, 1));
  const top: V2[] = [];
  for (const k of [...ks].reverse()) top.push(...oneTooth(T_TOP198 + k * P198, D198 / 2, -1).reverse());
  const hole: V2[] = [[-K.winHalf, yb], ...bot, [K.winHalf, yb], [K.winHalf, yt], ...top, [-K.winHalf, yt]];
  const shape = roundedRect(-K.ringHalf, -K.ringH, K.ringHalf, K.ringH, 0.12);
  shape.holes.push(pathFrom(hole));
  const depth = K.zRing1 - K.zRing0;
  const body = mesh(extrude(shape, depth, 0.005, 12), brass({ roughness: 0.4 }));
  body.position.z = (K.zRing0 + K.zRing1) / 2;
  g.add(body);
  // 막대 핀 2개(고리 쪽)
  for (const sy of [1, -1]) {
    const pin = lathe(rodProfile(0.03, 0, 0.1, 0.004, 0.008), 20);
    pin.rotateX(Math.PI / 2);
    const m = mesh(pin, darkSteel());
    m.position.set(K.pivX, sy * K.pivY, 0.0);
    g.add(m);
  }
  const mk = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.006), paint(0xf2b619));
  mk.position.set(-1.06, 0, K.zRing1 + 0.001);
  g.add(mk);
  setMM(g, { kind: 'rack', fn: 'ringBody198', module: M, teeth: ks.length, half: K.ringHalf, width: depth, axis: 'x', rows: 2 });
  return g;
}

/** 미끄럼 틀(로컬 원점 = 틀 가운데 (x, YC)): 둥근 사각 판 + 축 홈 + 막대 핀 2개 */
export function frame198(): THREE.Group {
  const K = K198;
  const g = new THREE.Group();
  const shape = roundedRect(-K.frameHalf, -K.frameH, K.frameHalf, K.frameH, 0.06);
  const win = roundedRect(-0.62, -0.1, 0.62, 0.1, 0.06);
  shape.holes.push(new THREE.Path(win.getPoints(16)));
  const depth = K.zFrame1 - K.zFrame0;
  const plate = mesh(extrude(shape, depth, 0.005, 12), castIron());
  plate.position.z = (K.zFrame0 + K.zFrame1) / 2;
  g.add(plate);
  for (const sy of [1, -1]) {
    const pin = lathe(rodProfile(0.03, 0, 0.1, 0.004, 0.008), 20);
    pin.rotateX(Math.PI / 2);
    const m = mesh(pin, darkSteel());
    m.position.set(-K.pivX, sy * K.pivY, -0.03);
    g.add(m);
  }
  return g;
}
