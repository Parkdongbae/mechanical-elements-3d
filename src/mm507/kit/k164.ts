// 164번 전용 키트 — 무릎 지레(토글 프레스)
//  천장 들보 + 지게대(고정, 핀 A) · 무릎 지레(한 몸: 눈 A — 목 — 허브 B — 수평 팔, 핀 A 에 걸려 흔들림)
//  · 압축 봉(방추형, 위 눈 = 핀 B, 아래 눈 = 핀 P) · 누름 블록(램, 핀 P, 안내 사이에서 세로로만 움직임)
//  · 모루 판 + 안내 볼 둘(고정).
//  운동식 pose164(theta): 지레 각 u = AMP·sin(theta − phase) — 닫힌 식, 주기 2π 로 정확히 닫힌다.
//  판화의 자세(팔이 오른쪽으로 6° 내려감 · 목이 왼쪽으로 18° 기울음)가 u = 0 (t = 1) 이다.
import * as THREE from 'three';
import { castIron, darkSteel, glow, paint, steel, wood } from '../../models/materials';
import { annularSector, circlePts, extrude, hexPrism, lathe, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const D2R = Math.PI / 180;

export const K164 = {
  ax: -0.25, // 핀 A (지게대 눈 · 지레 거점)
  ay: 2.84,
  zL: 0.1, // 지레 판 가운데 평면 (두께 0.06)
  zS: 0.18, // 봉 · 램 가운데 평면
  neck: 0.52, // 눈 A — 허브 B 사이(무릎 팔의 목)
  bend: -108 * D2R, // u = 0 에서 목의 방향(세로에서 왼쪽으로 18°)
  arm: 1.98, // 허브 B — 팔 끝
  slope: -6 * D2R, // u = 0 에서 팔의 기울기(오른쪽으로 내려감)
  amp: 12 * D2R, // 지레 흔들림 크기
  phase: 1.6, // t = 1 (theta 1.6) 에서 u = 0 — 판화 자세
  xs: -0.41, // 램(누름 블록)의 세로 안내선 x
  anvilTop: 0.26, // 모루 판 윗면 높이
  ramGap: 0.002, // 가장 눌렸을 때(u = +12°) 램 바닥 — 모루 틈
  pinUp: 0.26, // 램 바닥 → 핀 P
  ramW: 0.46, // 램 가로
  ramH: 0.17, // 램 몸통 높이
  ramD: 0.2, // 램 깊이(z)
  cheekW: 0.06, // 안내 볼 두께(x)
  cheekH: 0.42, // 안내 볼 높이(모루 위)
  slide: 0.004, // 램 — 안내 볼 틈
} as const;

/** 지레 각 u 에서 무릎 B 의 세계 좌표 */
export function knee164(u: number): V2 {
  return [K164.ax + K164.neck * Math.cos(K164.bend + u), K164.ay + K164.neck * Math.sin(K164.bend + u)];
}

/** 가장 눌린 자세(u = +amp)에서 핀 P 높이 */
const P_LOW = K164.anvilTop + K164.ramGap + K164.pinUp;
const B_LOW = knee164(K164.amp);
/** 봉 길이(핀 B — 핀 P). u = +amp 에서 램 바닥이 모루 위 ramGap 에 오도록 정한다 */
export const STRUT164 = Math.hypot(B_LOW[0] - K164.xs, B_LOW[1] - P_LOW);

export interface Pose164 {
  /** 지레 각(rad) — 지레 rotation.z 에 대입 */
  u: number;
  /** 무릎 핀 B 의 세계 좌표(봉 group 이 여기로 옮아간다) */
  B: V2;
  /** 핀 P 의 세계 높이(x 는 늘 K164.xs) */
  py: number;
  /** 봉 각 — 봉 rotation.z 에 대입(로컬 −Y 가 B → P) */
  strut: number;
  /** 팔 끝의 세계 좌표 */
  tipArm: V2;
  /** 램 바닥이 모루 윗면 위로 뜬 높이(ramGap 에서 가장 눌림) */
  lift: number;
}

/** 모든 자세의 닫힌 식. u = amp·sin(theta − phase) — 주기 2π 로 정확히 닫힌다 */
export function pose164(theta: number): Pose164 {
  const u = K164.amp * Math.sin(theta - K164.phase);
  const B = knee164(u);
  const dx = K164.xs - B[0];
  const py = B[1] - Math.sqrt(STRUT164 * STRUT164 - dx * dx);
  const strut = Math.atan2(dx, B[1] - py);
  const ox = K164.neck * Math.cos(K164.bend) + K164.arm * Math.cos(K164.slope);
  const oy = K164.neck * Math.sin(K164.bend) + K164.arm * Math.sin(K164.slope);
  const r = Math.hypot(ox, oy);
  const a0 = Math.atan2(oy, ox);
  const tipArm: V2 = [K164.ax + r * Math.cos(a0 + u), K164.ay + r * Math.sin(a0 + u)];
  return { u, B, py, strut, tipArm, lift: py - K164.pinUp - K164.anvilTop };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
/** Z축 원기둥(z0~z1, 양끝 모따기 c) */
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** Z축 관(rIn~rOut, z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** 두 점을 잇는 가늘어지는 네모 판(반폭 w0 → w1) — z 가운데 정렬(두께 depth) */
function taperPlate(p0: V2, p1: V2, w0: number, w1: number, depth: number): THREE.BufferGeometry {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: V2[] = [
    [p0[0] + nx * w0, p0[1] + ny * w0],
    [p1[0] + nx * w1, p1[1] + ny * w1],
    [p1[0] - nx * w1, p1[1] - ny * w1],
    [p0[0] - nx * w0, p0[1] - ny * w0],
  ];
  return extrude(shapeFrom(pts), depth, 0.006, 8);
}
/** 육각 너트(축 = Z, 가운데 z) */
function nutZ(r: number, z: number, x = 0, y = 0): THREE.Mesh {
  const g = hexPrism(r * 2.2, r * 0.9, true, true, r * 1.05);
  g.rotateX(Math.PI / 2);
  return meshAt(g, darkSteel(), x, y, z);
}
/** 이름만 있는 핀 표식 */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/**
 * 천장 들보 + 지게대(고정). group 원점 = 핀 A 가운데 — 모델은 (K164.ax, K164.ay, 0) 에 놓는다.
 * 들보는 뒤판(STAGE.backZ)에서 앞 0.02 까지, 지게대 판 z 0.01~0.05, 눈 보스 −0.005~0.065,
 * 핀 A r 0.042 가 눈을 꿰고 앞 너트(z 0.17~0.21)로 막는다(지레 판 앞면 0.13 밖).
 * 표식 child `pinA` = 핀 A 가운데.
 */
export function bracket164(): THREE.Group {
  const g = new THREE.Group();
  // 천장 들보(나무 — 판화의 빗금 천장)
  const beamD = 0.02 - STAGE.backZ;
  g.add(meshAt(new THREE.BoxGeometry(1.5, 0.14, beamD), wood(), 0, 0.23, STAGE.backZ + beamD / 2));
  // 지게대 판: 들보 아랫면(로컬 y 0.16) 에서 눈까지 내려온 좁은 판
  g.add(meshAt(new THREE.BoxGeometry(0.15, 0.19, 0.04), castIron(), 0, 0.065, 0.03));
  // 눈 보스(관) — 핀 A 둘레
  g.add(mesh(tubeZ(0.042, 0.085, -0.005, 0.065, 0.008, 40), darkSteel()));
  // 핀 A + 앞 너트
  g.add(mesh(cylZ(0.042, -0.005, 0.21, 0.008), darkSteel()));
  g.add(nutZ(0.042, 0.19));
  g.add(pinMark('pinA', 0, 0, 0));
  setMM(g, { kind: 'frame', pin: [0, 0, 0] });
  return g;
}

/**
 * 무릎 지레(한 몸). group 원점 = 눈 A 가운데, 로컬 자세가 판화의 자세(u = 0) — 모델은 (K164.ax, K164.ay, K164.zL) 에
 * 놓고 rotation.z = pose164(theta).u 를 대입한다. 눈 A(구멍 0.046) — 목(반폭 0.045 → 0.068) — 허브 B(바깥 0.16,
 * 구멍 0.046) — 수평 팔(반폭 0.085 → 0.055, 끝 둥근 판)이 한 판(두께 0.06) 위에 놓인다.
 * 핀 B(r 0.042, 로컬 z −0.03~0.16) 가 허브·봉 눈을 꿰고 앞 너트(로컬 z 0.13~0.17)로 막는다.
 * 표식 child `hubA` · `hubB` · `armTip`.
 */
export function lever164(): THREE.Group {
  const g = new THREE.Group();
  const B: V2 = [K164.neck * Math.cos(K164.bend), K164.neck * Math.sin(K164.bend)];
  const tip: V2 = [B[0] + K164.arm * Math.cos(K164.slope), B[1] + K164.arm * Math.sin(K164.slope)];
  const body = steel();
  // 눈 A
  g.add(mesh(tubeZ(0.046, 0.085, -0.03, 0.03, 0.006, 36), body));
  // 목(눈 A → 허브 B)
  const nb = Math.hypot(B[0], B[1]);
  const ub: V2 = [B[0] / nb, B[1] / nb];
  g.add(mesh(taperPlate([ub[0] * 0.075, ub[1] * 0.075], [ub[0] * (nb - 0.145), ub[1] * (nb - 0.145)], 0.045, 0.068, 0.06), body));
  // 허브 B
  g.add(meshAt(tubeZ(0.046, 0.16, -0.03, 0.03, 0.008, 44), body, B[0], B[1], 0));
  // 수평 팔(허브 B → 끝, 가늘어짐) + 둥근 끝판
  const ca = Math.cos(K164.slope);
  const sa = Math.sin(K164.slope);
  g.add(mesh(taperPlate([B[0] + 0.145 * ca, B[1] + 0.145 * sa], tip, 0.085, 0.055, 0.06), body));
  const cap = extrude(shapeFrom(circlePts(0.055, 24, tip[0], tip[1])), 0.06, 0.008, 8);
  g.add(mesh(cap, body));
  // 손잡이 표시(팔 끝 가까이 노랑 띠)
  const band = meshAt(new THREE.BoxGeometry(0.03, 0.12, 0.004), paint(0xf2b619), tip[0] - 0.25, tip[1] + 0.026, 0.032);
  band.rotation.z = K164.slope;
  g.add(band);
  // 핀 B + 앞 너트(허브·봉 눈을 꿴다)
  g.add(meshAt(cylZ(0.042, -0.03, 0.16, 0.008), darkSteel(), B[0], B[1], 0));
  g.add(nutZ(0.042, 0.15, B[0], B[1]));
  // 표식
  g.add(pinMark('hubA', 0, 0, 0));
  g.add(pinMark('hubB', B[0], B[1], 0));
  g.add(pinMark('armTip', tip[0], tip[1], 0));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [tip[0], tip[1], 0], length: K164.arm + K164.neck });
  return g;
}

/**
 * 압축 봉(방추형). group 원점 = 위 눈 가운데(= 핀 B), 로컬 −Y 로 STRUT164 만큼 내려가 아래 눈(= 핀 P).
 * 모델은 position.set(B.x, B.y, K164.zS), rotation.z = pose164(theta).strut.
 * 위 눈(구멍 0.046, 바깥 0.08) — 방추 몸통(최대 반폭 0.148, 두께 0.05) — 아래 눈(구멍 0.034, 바깥 0.07). 두께 0.05.
 * 표식 child `strutTop` · `strutBot`.
 */
export function strut164(): THREE.Group {
  const g = new THREE.Group();
  const L = STRUT164;
  g.add(mesh(tubeZ(0.046, 0.08, -0.025, 0.025, 0.006, 36), steel()));
  g.add(meshAt(tubeZ(0.034, 0.07, -0.025, 0.025, 0.006, 36), steel(), 0, -L, 0));
  // 방추 몸통: 위 눈 아래(−0.07)에서 아래 눈 위(−L + 0.06)까지. 위에서 1/4 쯤이 가장 굵다(판화)
  const y0 = -0.07;
  const y1 = -L + 0.06;
  const n = 14;
  const right: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    right.push([0.048 + 0.1 * Math.sin(Math.PI * Math.pow(s, 0.7)), y0 + (y1 - y0) * s]);
  }
  const pts: V2[] = [...right, ...right.slice().reverse().map(([x, y]) => [-x, y] as V2)];
  g.add(mesh(extrude(shapeFrom(pts), 0.044, 0.006, 8), darkSteel()));
  g.add(pinMark('strutTop', 0, 0, 0));
  g.add(pinMark('strutBot', 0, -L, 0));
  setMM(g, { kind: 'link', a: [0, 0, 0], b: [0, -L, 0], length: L });
  return g;
}

/**
 * 누름 블록(램). group 원점 = 램 바닥 가운데 — 모델은 (K164.xs, py − pinUp, 0) 에 놓는다(z 는 절대값).
 * 몸통 0.46 × 0.17 × 0.2 (z 0.08~0.28) 주철, 윗면에 귀 둘(z 0.121~0.151, 0.209~0.239)이 핀 P(r 0.03, z 0.1~0.26)를
 * 받친다. 봉 아래 눈(z 0.155~0.205)이 두 귀 사이에 든다. 앞면 노랑 표시줄.
 * 표식 child `pinP` = 핀 P 가운데, `ramFoot` = 바닥 가운데.
 */
export function ram164(): THREE.Group {
  const g = new THREE.Group();
  const { ramW, ramH, ramD, zS, pinUp } = K164;
  g.add(meshAt(new THREE.BoxGeometry(ramW, ramH, ramD), castIron(), 0, ramH / 2, zS));
  g.add(meshAt(new THREE.BoxGeometry(0.26, 0.016, 0.004), paint(0xf2b619), 0, ramH / 2, zS + ramD / 2 + 0.002));
  // 귀(둥근 머리 판) 둘
  const earPts: V2[] = [[-0.07, ramH - 0.005], [0.07, ramH - 0.005], ...circlePts(0.07, 24, 0, pinUp).filter(([, y]) => y >= pinUp).sort((a, b) => b[0] - a[0])];
  for (const zc of [zS - 0.044, zS + 0.044]) {
    g.add(meshAt(extrude(shapeFrom(earPts), 0.03, 0.004, 8), castIron(), 0, 0, zc));
  }
  g.add(meshAt(cylZ(0.03, zS - 0.08, zS + 0.08, 0.005), darkSteel(), 0, pinUp, 0));
  g.add(pinMark('pinP', 0, pinUp, zS));
  g.add(pinMark('ramFoot', 0, 0, zS));
  setMM(g, { kind: 'slider', axis: 'y' });
  return g;
}

/**
 * 모루 판 + 안내 볼 둘(고정). group 원점 = (K164.xs, 0, 0) — 모델은 그 자리에 놓는다.
 * 모루 판: 받침 윗면 0.18 ~ anvilTop 0.26, x ±0.45, z −0.02~0.38. 안내 볼: 램 양옆 틈 0.004, 두께 0.06,
 * 모루 위 높이 0.42, 깊이는 램과 같다(z 0.08~0.28) + 앞 턱(램이 앞으로 빠지지 않게, z 0.28~0.3, 안쪽으로 0.03).
 * 표식 child `anvilTop` = 모루 윗면 가운데.
 */
export function guide164(): THREE.Group {
  const g = new THREE.Group();
  const { anvilTop, ramW, ramD, zS, cheekW, cheekH, slide } = K164;
  const baseY = 0.18;
  g.add(meshAt(new THREE.BoxGeometry(0.9, anvilTop - baseY, 0.4), castIron(), 0, (anvilTop + baseY) / 2, 0.18));
  const cx = ramW / 2 + slide + cheekW / 2;
  for (const s of [-1, 1]) {
    g.add(meshAt(new THREE.BoxGeometry(cheekW, cheekH, ramD), castIron(), s * cx, anvilTop + cheekH / 2, zS));
    // 앞 턱
    g.add(meshAt(new THREE.BoxGeometry(cheekW + 0.03, cheekH, 0.02), darkSteel(), s * (cx - 0.015), anvilTop + cheekH / 2, zS + ramD / 2 + 0.01));
  }
  g.add(pinMark('anvilTop', 0, anvilTop, zS));
  setMM(g, { kind: 'frame' });
  return g;
}

/**
 * 흔들림 화살표(양쪽 화살촉 호). 원점 = 호의 중심, 반지름 r, 각 a0 ~ a1(반시계). layer 1, userData.noAO.
 */
export function swingArrow164(r: number, a0: number, a1: number): THREE.Group {
  const g = new THREE.Group();
  const mat = glow(0xd8362f, 0.85);
  g.add(mesh(extrude(annularSector(r - 0.018, r + 0.018, a0, a1), 0.014, 0.004, 16), mat));
  for (const [a, dir] of [[a1, 1], [a0, -1]] as const) {
    const ex = Math.cos(a) * r;
    const ey = Math.sin(a) * r;
    const tx = -Math.sin(a) * dir;
    const ty = Math.cos(a) * dir;
    const head = new THREE.ConeGeometry(0.045, 0.12, 16);
    head.rotateZ(Math.atan2(ty, tx) - Math.PI / 2);
    head.translate(ex + tx * 0.05, ey + ty * 0.05, 0);
    g.add(mesh(head, mat));
  }
  g.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(g, { kind: 'arrow', r, swing: true });
  return g;
}
