// 232번 끌어 당기는 폴 전용 키트 — 네모 이 톱니바퀴, 들보 A(멈춤 핀 둘), 팔 B, 폴 C(점열), 닫힌 식 운동
// 설계표 docs/mm507-sheets/232.md 의 수치·점열 그대로.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, circlePts, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import { circleIntersect } from './misc';
import { markPin, setMM } from './mm';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

/** 232번 배치 상수(세계 좌표, 각은 rad) */
export const K232 = {
  O: [-0.35, 1.25] as V2,
  teeth: 20,
  rT: 0.95,
  rR: 0.83,
  halfRoot: 4.75 * D2R,
  halfTip: 3.75 * D2R,
  CpA: [0.017173, 1.024856] as V2,
  Sup: [0.462, 0.209] as V2,
  Slo: [0.462, -0.121] as V2,
  stopR: 0.035,
  halfB: 0.0685,
  rb: 0.2917,
  rB2: 1.2,
  tail: 0.275,
  linkC: 1.035851,
  dLo: -2.1601 * D2R,
  dHi: 12.5636 * D2R,
  aHi: 9 * D2R,
  aLo: -9 * D2R,
  K: [0.865386, 0.599467] as V2,
  rk: 0.338043,
  Lk: 0.758043,
  thF: 95.2017 * D2R,
  rho0: 44.29 * D2R
} as const;
const K = K232;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.004, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 바퀴 윤곽 120점(바퀴 로컬, 반시계) — 이마다 6점 */
export function wheelOutline232(): V2[] {
  const out: V2[] = [];
  const p = 18;
  const at = (r: number, deg: number): V2 => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
  for (let k = 0; k < K.teeth; k++) {
    const a = k * p;
    out.push(at(K.rR, a - 4.75), at(K.rT, a - 3.75), at(K.rT, a + 3.75), at(K.rR, a + 4.75), at(K.rR, a + 7.5833), at(K.rR, a + 10.4167));
  }
  return out;
}

/** 네모 이 톱니바퀴: 원점 = 중심, 폭 0.12(z ±0.06), 구멍 0.065 */
export function squareWheel232(): THREE.Group {
  const g = new THREE.Group();
  const outline = wheelOutline232();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.065));
  g.add(mesh(extrude(shape, 0.12, 0.004, 8), steel()));
  g.add(meshAt(tubeZ(0.065, 0.13, -0.068, 0.068, 0.004, 48), darkSteel(), 0, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.4, 0.022, 0.008), paint(0xffcc00), 0.4, 0, 0.064));
  g.userData.outline = outline;
  setMM(g, { kind: 'ratchet', fn: 'squareWheel232', teeth: K.teeth, ra: K.rT, rf: K.rR, width: 0.12, axis: 'z' });
  return g;
}

export const C232: V2[] = [[-0.0282,0.0472],[-0.0350,0.0425],[-0.0409,0.0368],[-0.0464,0.0296],[-0.0502,0.0224],[-0.0530,0.0146],[-0.0546,0.0066],[-0.0549,-0.0025],[-0.0540,-0.0106],[-0.0518,-0.0184],[-0.0485,-0.0260],[-0.0441,-0.0328],[-0.0388,-0.0390],[-0.0326,-0.0443],[-0.0249,-0.0491],[-0.0106,-0.0540],[0.0055,-0.0547],[0.0184,-0.0518],[0.0349,-0.0433],[0.0426,-0.0417],[0.0676,-0.0435],[0.1123,-0.0484],[0.1567,-0.0553],[0.2222,-0.0694],[0.2655,-0.0813],[0.3083,-0.0952],[0.3504,-0.1110],[0.3917,-0.1287],[0.4322,-0.1483],[0.4717,-0.1697],[0.5102,-0.1929],[0.5476,-0.2179],[0.5839,-0.2445],[0.6142,-0.2689],[0.6186,-0.2740],[0.6211,-0.2803],[0.6214,-0.2863],[0.6195,-0.2929],[0.5542,-0.3916],[0.5525,-0.3955],[0.5520,-0.4000],[0.5531,-0.4047],[0.5558,-0.4088],[0.6202,-0.4758],[0.6245,-0.4788],[0.6309,-0.4801],[0.6371,-0.4784],[0.7379,-0.4153],[0.7466,-0.4136],[0.7516,-0.4144],[0.7581,-0.4169],[0.7620,-0.4160],[0.8527,-0.3452],[0.8545,-0.3429],[0.8550,-0.3400],[0.8541,-0.3372],[0.8418,-0.3218],[0.7915,-0.2645],[0.7376,-0.2110],[0.6801,-0.1612],[0.6194,-0.1156],[0.5559,-0.0742],[0.5117,-0.0489],[0.4439,-0.0151],[0.3737,0.0140],[0.3016,0.0384],[0.2281,0.0577],[0.1534,0.0720],[0.0782,0.0810],[0.0077,0.0848],[0.0044,0.0835],[0.0026,0.0812],[0.0016,0.0687],[-0.0015,0.0616],[-0.0062,0.0566],[-0.0210,0.0508]];

/** 폴 C: 원점 = C 피벗, 구멍 0.024, 두께 0.05(z ±0.025). 꼬리 핀·표식 `cTail`. 재질은 userData.mat */
export function pawlC232(): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(C232);
  shape.holes.push(circlePath(0, 0, 0.024));
  const mat = brass();
  g.add(mesh(extrude(shape, 0.05, 0.004), mat));
  g.add(meshAt(cylZ(0.022, -0.03, 0.27, 0.003), steel(), K.tail, 0, 0));
  const mark = new THREE.Object3D();
  mark.name = 'cTail';
  mark.position.set(K.tail, 0, 0.225);
  g.add(markPin(mark));
  g.userData.mat = mat;
  g.userData.outline = C232;
  setMM(g, { kind: 'pawl', fn: 'pawlC232' });
  return g;
}

/** 볼록 껍질(Andrew monotone chain) */
function hull(pts: V2[]): V2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: V2[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: V2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop();
  up.pop();
  return [...lo, ...up];
}

/** 들보 A: 원점 = 공용 축, α = 0 기준. 판 z 0.07~0.12, 멈춤 핀 `stopUp`·`stopLo`, C 피벗 핀 */
export function carrier232(): THREE.Group {
  const g = new THREE.Group();
  const mat = (): THREE.Material => castIron({ roughness: 0.5 });
  const [cx, cy] = K.CpA;
  const ang = Math.atan2(cy, cx);
  const len = Math.hypot(cx, cy);
  const plate = (shape: THREE.Shape): void => {
    g.add(meshAt(extrude(shape, 0.05, 0.004, 16), mat(), 0, 0, 0.095));
  };
  // 허브(구멍 0.063)
  const hub = shapeFrom(circlePts(0.13, 48));
  hub.holes.push(circlePath(0, 0, 0.063));
  plate(hub);
  // 들보 몸(허브 테두리에서 시작해 구멍을 덮지 않게: 직사각 0.07~0.15 + 둥근 막대 0.15~C 피벗)
  const dir = (d: number, w: number): V2 => [d * Math.cos(ang) - w * Math.sin(ang), d * Math.sin(ang) + w * Math.cos(ang)];
  plate(shapeFrom([dir(0.07, -0.075), dir(0.15, -0.075), dir(0.15, 0.075), dir(0.07, 0.075)]));
  plate(stadiumShape(0.15 * Math.cos(ang), 0.15 * Math.sin(ang), cx, cy, 0.075));
  plate(shapeFrom(circlePts(0.07, 32, cx, cy)));
  // 멈춤 핀 받침: 반지름 0.065 원 셋(S_up, S_lo, (0.20, 0))의 볼록 껍질 + 허브와 잇는 띠(원 (0.20,0) 은 허브에서 0.005 떨어져 있어 띠로 이음)
  const cs: V2[] = [K.Sup, K.Slo, [0.2, 0]];
  const hp: V2[] = [];
  for (const c of cs) hp.push(...circlePts(0.065, 32, c[0], c[1]));
  plate(shapeFrom(hull(hp)));
  plate(shapeFrom([[0.07, -0.065], [0.2, -0.065], [0.2, 0.065], [0.07, 0.065]]));
  // 멈춤 핀(머리 없음 — B 가 지나간다)
  for (const [nm, c] of [['stopUp', K.Sup], ['stopLo', K.Slo]] as const) {
    const s = meshAt(cylZ(K.stopR, 0.12, 0.21, 0.003), steel(), c[0], c[1], 0);
    s.name = nm;
    s.userData.outline = circlePts(K.stopR, 28, 0, 0);
    g.add(s);
  }
  // C 피벗 핀(뒤 머리)
  g.add(meshAt(cylZ(0.022, -0.035, 0.12, 0.003), steel(), cx, cy, 0));
  g.add(meshAt(cylZ(0.032, -0.035, -0.025, 0.003), steel(), cx, cy, 0));
  void len;
  setMM(g, { kind: 'lever', fn: 'carrier232', pivot: [0, 0, 0] });
  return g;
}

/** 팔 B: 원점 = 공용 축, +X = 팔 쪽. 판 z 0.13~0.19, 연결 막대 핀 표식 `bPin`, 크랭크 핀 표식 `bPin2` */
export function armB232(): THREE.Group {
  const g = new THREE.Group();
  const mat = (): THREE.Material => castIron({ roughness: 0.5 });
  const hw = K.halfB;
  const plate = (shape: THREE.Shape): void => {
    g.add(meshAt(extrude(shape, 0.06, 0.004, 16), mat(), 0, 0, 0.16));
  };
  const boss = shapeFrom(circlePts(0.1, 48));
  boss.holes.push(circlePath(0, 0, 0.063));
  plate(boss);
  plate(shapeFrom([[0.07, -hw], [0.2, -hw], [0.2, hw], [0.07, hw]]));
  plate(stadiumShape(0.2, 0, 1.3, 0, hw));
  g.add(meshAt(cylZ(0.022, 0.13, 0.27, 0.003), steel(), K.rb, 0, 0));
  const m1 = new THREE.Object3D();
  m1.name = 'bPin';
  m1.position.set(K.rb, 0, 0.225);
  g.add(markPin(m1));
  g.add(meshAt(cylZ(0.045, 0.13, 0.3, 0.005), steel(), K.rB2, 0, 0));
  const m2 = new THREE.Object3D();
  m2.name = 'bPin2';
  m2.position.set(K.rB2, 0, 0.24);
  g.add(markPin(m2));
  setMM(g, { kind: 'lever', fn: 'armB232', pivot: [0, 0, 0] });
  return g;
}

// ═══════════════════════════ 운동식 ═══════════════════════════

/** 동작 4: 헛돎 δ(= B − A)에서 C 의 들림 σ */
export function sigma232(delta: number): number {
  const Bp: V2 = [K.rb * Math.cos(delta), K.rb * Math.sin(delta)];
  const Ct = circleIntersect([K.CpA[0], K.CpA[1]], K.tail, Bp, K.linkC, true);
  if (Ct === null) return 0;
  return Math.atan2(Ct[1] - K.CpA[1], Ct[0] - K.CpA[0]);
}

export interface State232 {
  u: number;
  beta: number;
  alpha: number;
  delta: number;
  sigma: number;
  phi: number;
  wheel: number;
  P: V2;
  E: V2;
  phase: 'drop' | 'drive' | 'lift' | 'back';
  drive: boolean;
}

/** 232번 운동식(theta = 크랭크 누적각, 모두 닫힌 식) */
export function state232(theta: number): State232 {
  const n = Math.floor(theta / TAU);
  const u = theta - n * TAU;
  const P: V2 = [K.K[0] + K.rk * Math.cos(K.thF + u), K.K[1] + K.rk * Math.sin(K.thF + u)];
  const E = circleIntersect([K.O[0], K.O[1]], K.rB2, [P[0], P[1]], K.Lk, true) ?? [K.O[0] + K.rB2, K.O[1]];
  const beta = Math.atan2(E[1] - K.O[1], E[0] - K.O[0]);
  const down = u < Math.PI;
  const alpha = down ? Math.min(K.aHi, beta - K.dLo) : Math.max(K.aLo, beta - K.dHi);
  const delta = beta - alpha;
  const sigma = sigma232(delta);
  const p18 = 18 * D2R;
  const phi = down ? n * p18 + (K.aHi - alpha) : n * p18 + p18;
  const drive = down && beta - K.dLo < K.aHi;
  const phase: State232['phase'] = down ? (drive ? 'drive' : 'drop') : alpha <= K.aLo + 1e-12 ? 'lift' : 'back';
  return { u, beta, alpha, delta, sigma, phi, wheel: K.rho0 - phi, P, E, phase, drive };
}
