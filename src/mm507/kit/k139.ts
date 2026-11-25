// 139번 전용 키트 — 내부 랙 틀과 피니언(왕복 직선 운동)
//  피니언(고정 축 위, 정면 시계)이 스타디움 꼴 내부 랙의 안둘레를 물고 계속 돌면,
//  랙은 틀 창 안에서 위아래로 미끄러지며(윗변 → 왼 끝 호 → 아랫변 → 오른 끝 호를 차례로 물고)
//  랙을 받친 직사각형 틀이 왕복 직선 운동을 한다.
//  위의 크랭크 둘 + 동기 바 + 링크 둘은 랙을 수평으로 떠받치는 평행 가이드(세 링크 길이 일정),
//  밑의 바퀴 둘은 받침대 위를 굴러간다. 판화의 옆 돌출부는 부시 러그로 두었다(고정 봉으로는
//  틀의 왕복과 부딪혀 계속 돌 수 없다 — 설계표 판화 읽기 9번).
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, extrude, lathe, loft, mesh, pathFrom, rodProfile, roundedRect, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { shaftZ } from './shaft';
import { spurGear } from './gear';
import { pulley } from './pulley';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function boxAt(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  return meshAt(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}
/** Z축 원기둥(z0~z1) */
function cylZ(r: number, z0: number, z1: number, c = 0.005, segs = 24): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.005, segs = 32): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** 이름만 있는 핀 표식(검사 선언 links 용) */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

// ═══════════════════════════ 치수 상수 ═══════════════════════════

/** 139번 치수(세계 좌표·길이). 판화 비: 랙 피치 2b = 125px, 피니언 지름 56px, 틀 330×230px, 바퀴 지름 55px (1px ≈ 0.00704) */
export const K139 = {
  /** 모듈·피니언 잇수·랙 잇수(안둘레 전체)·끝 호 피치 반지름 */
  m: 0.032,
  zp: 12,
  N: 41,
  b: 0.42,
  /** 피니언·랙 중심의 높이(피니언 축 = 고정) */
  PY: 1.52,
  /** 랙·피니언 가운데 z·두께 */
  zGear: 0.14,
  width: 0.07,
  /** 틀 판: 가운데 z·두께, 반폭, 몸통 아래·위(세계 y) */
  zPlate: 0.055,
  plateT: 0.07,
  Wf: 1.0,
  frameBot: 0.42,
  frameTop: 2.36,
  /** 틀 창(틀 로컬, PY 기준): 반폭·반높이 — 랙이 위아래 ±d 로 미끄러진다 */
  winW: 0.879,
  winH: 0.76,
  /** 바퀴: x(±), 반지름, 축 높이, 폭, 가운데 z */
  wheelX: 0.44,
  rw: 0.13,
  wheelY: 0.31,
  wheelW: 0.06,
  zWheel: 0.08,
  /** 위 가이드: 크랭크 축 x(±)·높이, 크랭크 팔, 링크, 랙 귀 핀(랙 로컬 x·y) */
  gx: 0.34,
  Ay: 2.4,
  La: 0.3,
  Lr: 0.41,
  earX: 0.34,
  earY: 0.49,
  /** 판화 자세(t = 1)의 theta */
  theta1: 1.6
} as const;

/** 피니언 피치 반지름 */
export const K139_RP = (K139.zp * K139.m) / 2;
/** 랙 곧은 변의 반길이 — 잇수 41 이 둘레를 정확히 채우도록 정해진다 */
export const K139_H = (K139.N * Math.PI * K139.m - 2 * Math.PI * K139.b) / 4;
/** 곧은 변 길이 */
export const K139_L = 2 * K139_H;
/** 랙의 위아래 미끄럼 진폭 = b − rp (윗변·아랫변을 번갈아 물기 위한 거리) */
export const K139_D = K139.b - K139_RP;
/** 안둘레 피치 둘레 = 41πm */
export const K139_P = 2 * K139_L + 2 * Math.PI * K139.b;
/** 한 주기의 theta(접점이 안둘레 한 바퀴) */
export const K139_DU = (2 * K139_L + 2 * Math.PI * K139_D) / K139_RP;
/** t = 1 접점의 랙 위 자리(아랫변 한가운데 — 판화 순간) */
const K139_S1 = 3 * K139_H + Math.PI * K139.b;
/** 랙 이 위상(이 k 의 중심 = (k + K139_GAMMA)·πm) */
export const K139_GAMMA = (K139_S1 / (Math.PI * K139.m)) % 1;
/** 피니언 위상(rotation.z = −theta + K139_BETA0) — t = 1 에 랙 이골이 피니언 이와 마주 보게 */
export const K139_BETA0 = (1.5 * Math.PI + K139.theta1) % (TAU / K139.zp);

// ═══════════════════════════ 운동식 ═══════════════════════════

export interface Pose139 {
  /** 접점이 랙 피치선 위에 있는 자리(호 길이, s = 0 이 윗변 한가운데) */
  s: number;
  /** 랙·틀의 가로 자리(둘이 같다 — 랙은 틀 안에서 세로로만 미끄러진다) */
  X: number;
  /** 랙 중심의 세로 자리(틀 안에서의 미끄럼 = Y, ±K139_D) */
  Y: number;
  /** 지금 물린 구간 */
  seg: 'top' | 'left' | 'bottom' | 'right';
  /** 피니언 rotation.z (시계) */
  beta: number;
  /** 크랭크 rotation.z (둘 같다 — 평행 사변형) */
  crank: number;
  /** 바퀴 rotation.z (굴름 = −X/rw) */
  wheel: number;
  /** 크랭크 핀 둘(세계) — 동기 바의 눈 */
  B: [V2, V2];
  /** 랙 귀 핀 둘(세계) — 링크 아래 눈 */
  C: [V2, V2];
}

/**
 * 139번 운동(theta 의 닫힌 식). 접점이 랙 안둘레를 따라 미끄럼 없이 나아간다: 곧은 변에서
 * ds = rp·dθ, 끝 호(반지름 b)에서 ds = rp·(b/d)·dθ (d = b − rp) — 그래서 한 주기는
 * (2L + 2πd)/rp 라 윗변·아랫변 구간보다 끝 호 구간이 피니언이 천천히 도는 구간이 된다.
 * 랙 자리는 접점 구간 넷의 닫힌 표(설계표 동작 절)로 정해진다.
 */
export function motion139(theta: number): Pose139 {
  const { b, PY, gx, earX, earY, Ay, La, Lr, rw, theta1 } = K139;
  const rp = K139_RP;
  const h = K139_H;
  const L = K139_L;
  const d = K139_D;
  // t = 1(판화 자세)에서 한 주기를 도는 진행량
  let uu = (theta - theta1) % K139_DU;
  if (uu < 0) uu += K139_DU;
  const uC = h / rp; // 아랫변 뒤반(S1 → 오른 아래 모서리)
  const uD = (Math.PI * d) / rp; // 오른 끝 호
  const uA = L / rp; // 윗변
  const uB = (Math.PI * d) / rp; // 왼 끝 호(마지막 else 는 아랫변 앞반: 왼 아래 모서리 → S1)
  let s: number;
  let seg: Pose139['seg'];
  if (uu < uC) {
    seg = 'bottom';
    s = K139_S1 + uu * rp;
  } else if (uu < uC + uD) {
    seg = 'right';
    s = 2 * L + Math.PI * b + (uu - uC) * rp * (b / d);
  } else if (uu < uC + uD + uA) {
    seg = 'top';
    s = (uu - uC - uD) * rp;
  } else if (uu < uC + uD + uA + uB) {
    seg = 'left';
    s = L + (uu - uC - uD - uA) * rp * (b / d);
  } else {
    seg = 'bottom';
    s = L + Math.PI * b + (uu - uC - uD - uA - uB) * rp;
  }
  // 랙·틀 자리(구간 넷의 닫힌 표)
  let X: number;
  let Y: number;
  if (seg === 'top') {
    X = s - h;
    Y = -d;
  } else if (seg === 'left') {
    const psi = Math.PI / 2 + (s - L) / b;
    X = h - d * Math.cos(psi);
    Y = -d * Math.sin(psi);
  } else if (seg === 'bottom') {
    X = h - (s - L - Math.PI * b);
    Y = d;
  } else {
    const psi = -Math.PI / 2 + (s - 2 * L - Math.PI * b) / b;
    X = -h - d * Math.cos(psi);
    Y = -d * Math.sin(psi);
  }
  // 크랭크: 축→귀 핀의 세로 거리 D 에서 |B − C| = Lr 로 푼다(평행 사변형 — 둘 같은 각)
  const D = Ay - (PY + Y + earY);
  const sin = (Lr * Lr - La * La - D * D) / (2 * La * D);
  const crank = Math.asin(Math.max(-1, Math.min(1, sin)));
  const by = Ay + La * Math.sin(crank);
  const B: [V2, V2] = [
    [X - gx + La * Math.cos(crank), by],
    [X + gx + La * Math.cos(crank), by]
  ];
  const C: [V2, V2] = [
    [X - earX, PY + Y + earY],
    [X + earX, PY + Y + earY]
  ];
  return { s, X, Y, seg, beta: -theta + K139_BETA0, crank, wheel: -X / rw, B, C };
}

// ═══════════════════════════ 랙(스타디움 내부 기어) ═══════════════════════════

export interface RackPathPt {
  p: V2;
  /** 바깥 단위 법선(이는 안쪽으로 나므로 이끝 오프셋은 음수) */
  n: V2;
}

/** 랙 피치선 위의 점(s = 0 이 윗변 한가운데, 접점이 나아가는 방향 = 시계). r(…) 은 같은 자리 */
export function rackPath139(s: number): RackPathPt {
  const b = K139.b;
  const h = K139_H;
  const L = K139_L;
  const ss = ((s % K139_P) + K139_P) % K139_P;
  if (ss < L) return { p: [h - ss, b], n: [0, 1] };
  if (ss < L + Math.PI * b) {
    const psi = Math.PI / 2 + (ss - L) / b;
    return { p: [-h + b * Math.cos(psi), b * Math.sin(psi)], n: [Math.cos(psi), Math.sin(psi)] };
  }
  if (ss < 2 * L + Math.PI * b) return { p: [-h + (ss - L - Math.PI * b), -b], n: [0, -1] };
  const psi = -Math.PI / 2 + (ss - 2 * L - Math.PI * b) / b;
  return { p: [h + b * Math.cos(psi), b * Math.sin(psi)], n: [Math.cos(psi), Math.sin(psi)] };
}

/** 안쪽 이 윤곽(스타디움 안둘레를 따라 감긴 닫힌 고리 — loft 의 구멍·침범 검사용). 이끝은 피치선 안쪽 m */
export function rackOutline139(): V2[] {
  const P = Math.PI * K139.m; // 이 피치(호 길이)
  const t20 = Math.tan(20 * DEG);
  const tp = 0.23; // 피치선에서 이 반두께(피치 단위) — 옆틈 0.02·피치
  const ha = K139.m;
  const hf = 1.2 * K139.m;
  const ut = tp - (ha * t20) / P;
  const ur = tp + (hf * t20) / P;
  const prof: [number, number][] = [
    [-ur, hf],
    [-tp, 0],
    [-ut, -ha],
    [0, -ha],
    [ut, -ha],
    [tp, 0],
    [ur, hf],
    [0.5, hf]
  ];
  const out: V2[] = [];
  for (let k = 0; k < K139.N; k++) {
    for (const [u, off] of prof) {
      const q = rackPath139((k + K139_GAMMA + u) * P);
      out.push([q.p[0] + q.n[0] * off, q.p[1] + q.n[1] * off]);
    }
  }
  return out;
}

/** 스타디움 바깥 윤곽(반시계): 반폭·반높이(모서리 반지름 = 반높이) — 끝 반원은 y = 0 중심(캡슐) */
function stadiumPts(halfW: number, halfH: number, n = 40): V2[] {
  const sx = halfW - halfH;
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push([sx + halfH * Math.cos(t), halfH * Math.sin(t)]);
  }
  for (let i = 1; i < n; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / n;
    pts.push([-sx + halfH * Math.cos(t), halfH * Math.sin(t)]);
  }
  return pts;
}

/**
 * 내부 랙(139번): 원점 = 스타디움 중심, 회전 없음(가로는 틀과, 세로는 ±K139_D 미끄럼).
 * 이름 'rack'. userData.outlines.hole = 안쪽 이 윤곽(피니언이 이 안에 머물러야 한다 — 침범 검사가 이 띠에 묻힌 깊이를 잰다), mm.kind = 'gear'(internal).
 * 위 귀에 핀 둘(로컬 ±K139.earX, earY, 앞면에서 z 0.112 = 세계 0.252 까지) — 링크가 걸린다.
 * child 'rackPinL'·'rackPinR'(세계 링크 평면 z 0.22).
 */
export function internalRack139(): THREE.Group {
  const teeth = rackOutline139();
  const body = 1.2 * K139.m + 0.03; // 이뿌리 바깥 림 두께
  const bOut = K139.b + body;
  const aOut = K139_H + K139.b + body;
  const c = 0.006;
  const layers = [
    { z: -K139.width / 2, s: (bOut - c) / bOut, hs: 1 + c / (K139.b - K139.m) },
    { z: -K139.width / 2 + c, s: 1, hs: 1 },
    { z: K139.width / 2 - c, s: 1, hs: 1 },
    { z: K139.width / 2, s: (bOut - c) / bOut, hs: 1 + c / (K139.b - K139.m) }
  ];
  const g = new THREE.Group();
  g.name = 'rack';
  g.add(mesh(loft(stadiumPts(aOut, bOut), [teeth], layers), brass()));
  // 귀 둘 + 핀(앞으로) — 링크가 거는 자리(핀·머리·표식 z는 그룹 기준, 세계 0.165~0.252·0.234~0.252·0.22 — 설계표 연결 표)
  const iron = castIron();
  for (const sx of [-1, 1]) {
    g.add(boxAt(0.1, 0.075, K139.width, iron, sx * K139.earX, K139.earY - 0.007, 0));
    g.add(meshAt(cylZ(0.028, K139.width / 2 - 0.01, 0.112, 0.004, 20), steel(), sx * K139.earX, K139.earY, 0));
    g.add(meshAt(cylZ(0.04, 0.094, 0.112, 0.004, 20), darkSteel(), sx * K139.earX, K139.earY, 0));
    g.add(pinMark(sx < 0 ? 'rackPinL' : 'rackPinR', sx * K139.earX, K139.earY, 0.08));
  }
  // 표시 막대(랙이 위아래로 미끄러지는 것이 보이게)
  g.add(meshAt(new THREE.BoxGeometry(0.09, 0.014, 0.008), paint(MARK), K139_H * 0.5, -bOut - 0.012, K139.width / 2 + 0.005));
  g.userData.outlines = { hole: teeth };
  setMM(g, { kind: 'gear', fn: 'internalRack139', teeth: K139.N, module: K139.m, internal: true, rp: K139.b, ra: bOut, width: K139.width, axis: 'z' });
  return g;
}

// ═══════════════════════════ 틀·바퀴·받침 ═══════════════════════════

/**
 * 직사각형 틀(139번): 원점 = 세계 (0, 0, 0) 의 틀 중심선(모델이 position.x = X 로 왕복).
 * 이름 'frame'. 네모 판(창 = 랙이 다니는 구멍) + 옆 부시 러그(판화의 옆 돌출부) + 바퀴 축 받침 +
 * 크랭크 축 받침대 둘(윗판 위). 바퀴 둘은 child 'wheelL'·'wheelR'(굴름은 모델이 rotation.z 로).
 */
export function rackFrame139(): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  g.name = 'frame';
  const iron = castIron();
  // 판(창 구멍): z 가운데 K.zPlate
  const outer = roundedRect(-K.Wf, K.frameBot, K.Wf, K.frameTop, 0.03);
  const win = roundedRect(-K.winW, K.PY - K.winH, K.winW, K.PY + K.winH, 0.02);
  outer.holes.push(pathFrom(win.getPoints(24).map((p) => [p.x, p.y] as V2)));
  g.add(meshAt(extrude(outer, K.plateT, 0.008, 16), iron, 0, 0, K.zPlate));
  // 옆 부시 러그(판화의 돌출부 — 받침 부시, 고정 봉은 없음: 판화 읽기 9)
  for (const sx of [-1, 1]) {
    g.add(boxAt(0.12, 0.2, 0.1, iron, sx * (K.Wf + 0.05), K.PY, K.zPlate));
    g.add(meshAt(cylZ(0.045, 0.005, 0.105, 0.005, 20), darkSteel(), sx * (K.Wf + 0.11), K.PY, K.zPlate));
  }
  // 바퀴 축 받침 + 축 + 바퀴
  const axleZ0 = K.zWheel - 0.08;
  const axleZ1 = K.zWheel + 0.08;
  for (const sx of [-1, 1]) {
    g.add(boxAt(0.09, 0.14, 0.09, iron, sx * K.wheelX, K.frameBot - 0.03, K.zPlate));
    g.add(meshAt(cylZ(0.02, axleZ0, axleZ1, 0.004, 16), steel(), sx * K.wheelX, K.wheelY, 0));
    const wheel = pulley(K.rw, { width: K.wheelW, spokes: 4, flat: true });
    wheel.name = sx < 0 ? 'wheelL' : 'wheelR';
    wheel.position.set(sx * K.wheelX, K.wheelY, K.zWheel);
    g.add(wheel);
  }
  // 크랭크 축 받침대(윗판 위, 윗면 0.174 — 크랭크 허브 밑면 0.204 와 0.03 틈) + 축 핀
  for (const sx of [-1, 1]) {
    g.add(boxAt(0.09, 0.1, 0.084, iron, sx * K.gx, K.frameTop + 0.03, 0.132));
    g.add(meshAt(cylZ(0.026, 0.174, 0.253, 0.004, 20), steel(), sx * K.gx, K.Ay, 0));
    g.add(pinMark(sx < 0 ? 'crankPivotL' : 'crankPivotR', sx * K.gx, K.Ay, 0.22));
  }
  setMM(g, { kind: 'frame', fn: 'rackFrame139', winW: K.winW, winH: K.winH });
  return g;
}

/**
 * 크랭크(139번, 틀 윗판 받침대 위에서 흔들린다): 원점 = 축, 로컬 +X 로 K139.La 에 핀.
 * 팔(스타디움 단면 판) + 축 허브 + 핀 보스. child 'crankPinL'/'crankPinR'(핀 자리, z 0.22).
 */
export function crank139(side: 'L' | 'R'): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  g.name = side === 'L' ? 'crankL' : 'crankR';
  // 팔(z 0.177~0.203 — 동기 바 판 0.149~0.175 과 층을 나눔) + 축·핀 자리 관 보스(핀 구멍 0.03)
  g.add(meshAt(extrude(shapeFromStadium(0.24, 0.028, 0.032), 0.026, 0.005, 12), steel(), 0, 0, 0.19));
  g.add(meshAt(tubeZ(0.03, 0.052, 0.177, 0.203, 0.005, 28), darkSteel(), 0, 0, 0));
  g.add(meshAt(tubeZ(0.03, 0.052, 0.177, 0.203, 0.005, 28), darkSteel(), K.La, 0, 0));
  // 축 허브(구멍 0.028 — 틀 축 핀 위에 앉는다)
  g.add(meshAt(tubeZ(0.028, 0.052, 0.204, 0.268, 0.005, 28), darkSteel(), 0, 0, 0));
  // 핀(밑점 0.15 — 동기 바 눈 0.148~0.176 을 꿰고 머리 0.24~0.258 이 링크 눈 0.2~0.23 을 막는다)
  g.add(meshAt(cylZ(0.026, 0.15, 0.258, 0.004, 20), steel(), K.La, 0, 0));
  g.add(meshAt(cylZ(0.038, 0.24, 0.258, 0.004, 20), darkSteel(), K.La, 0, 0));
  g.add(pinMark(side === 'L' ? 'crankPinL' : 'crankPinR', K.La, 0, 0.22));
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.014, 0.01), paint(MARK), K.La * 0.55, 0, 0.208));
  return g;
}

/** (x0,0)→(x0+len,0) 스타디움 판 모양 — 끝 반원은 y = 0 중심(캡슐) */
function shapeFromStadium(len: number, half: number, x0 = 0): THREE.Shape {
  const pts: V2[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push([x0 + len - half + half * Math.cos(t), half * Math.sin(t)]);
  }
  for (let i = 1; i < n; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / n;
    pts.push([x0 + half * Math.cos(t), half * Math.sin(t)]);
  }
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}

/** 동기 바(139번): 두 크랭크 핀을 잇는 수평 판. 원점 = 바 가운데, 판은 가운데 0.6, 끝은 칼라+눈 */
export function syncBar139(): THREE.Group {
  const K = K139;
  const g = new THREE.Group();
  g.name = 'bar';
  // 판(z 0.149~0.175 — 크랭크 팔 0.177~0.203 과 층을 나눠 판끼리 안 겹치게)
  g.add(meshAt(extrude(shapeFromStadium(0.6, 0.024, -0.3), 0.026, 0.004, 12), steel(), 0, 0, 0.162));
  for (const sx of [-1, 1]) {
    // 끝 칼라(판과 눈을 잇는 짧은 관) + 눈(구멍 0.031 — 크랭크 핀 0.15~0.258 을 꿴다)
    g.add(meshAt(tubeZ(0.03, 0.055, 0.149, 0.175, 0.004, 24), darkSteel(), sx * K.gx, 0, 0));
    g.add(meshAt(tubeZ(0.031, 0.056, 0.148, 0.176, 0.004, 24), darkSteel(), sx * K.gx, 0, 0));
  }
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.014, 0.01), paint(MARK), 0, 0, 0.18));
  setMM(g, { kind: 'link', fn: 'syncBar139', length: 2 * K.gx, a: [-K.gx, 0, 0], b: [K.gx, 0, 0] });
  return g;
}

/** 링크(139번, 크랭크 핀 ↔ 랙 귀 핀): 원점 = 위 눈 중심, 로컬 −Y 로 length 에 아래 눈. 모델이 B→C 로 겨눈다 */
export function linkRod139(length: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'rod';
  for (const y of [0, -length]) g.add(meshAt(tubeZ(0.031, 0.056, -0.015, 0.015, 0.004, 24), darkSteel(), 0, y, 0));
  g.add(mesh(lathe(rodProfile(0.02, -length + 0.05, -0.05, 0.004, 0.004), 16), steel()));
  setMM(g, { kind: 'link', fn: 'linkRod139', length, a: [0, 0, 0], b: [0, -length, 0] });
  return g;
}

// ═══════════════════════════ 피니언과 고정 축 ═══════════════════════════

/**
 * 피니언(139번, 구동): spurGear(12, 0.032) 그대로 + userData.outline(침범 검사용).
 * 이름 'pinion'. 모델이 position (0, K139.PY, K139.zGear), rotation.z = pose.beta 로 놓는다.
 */
export function pinion139(): THREE.Group {
  const g = spurGear(K139.zp, K139.m, { width: K139.width, spokes: 0, driver: true });
  g.name = 'pinion';
  g.userData.outline = involuteOutline(K139.zp, K139_RP + K139.m, K139_RP - 1.25 * K139.m);
  setMM(g, { fn: 'pinion139' });
  return g;
}

/** 피니언 고정 축(뒤판에서 나온 스터드 — 판화의 검은 허브. 뒤판 받침은 판화에 없음) */
export function pinionStud139(): THREE.Group {
  const g = shaftZ(0, K139.PY, 0.22, 0.023);
  g.name = 'stud';
  return g;
}
