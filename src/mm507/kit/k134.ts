// 134·135·136 전용 부품 — 드럼과 밧줄(134), 원판에 단 삼각 태핏(135), 옆면 톱니 캠 바퀴(136)
// 공용 키트는 고치지 않는다. 모델은 '../kit/k134' 에서 직접 import.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, steel } from '../../models/materials';
import { creased, extrude, hexPrism, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markAnchor, setMM, tagArc } from './mm';
import { triCamLift, triCamOutline } from './k089';

const TAU = Math.PI * 2;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z축 원기둥(z0~z1) */
function cylZ(r: number, z0: number, z1: number, c = 0.005, segs = 40): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.005, segs = 48): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** X축 관(x0~x1) */
function tubeX(rIn: number, rOut: number, x0: number, x1: number, c = 0.004, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, x0, x1, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 변을 잘게 나눈 다각형(침범 검사가 변 위의 점도 보도록) */
function fine(poly: V2[], per = 12): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k]!;
    const b = poly[(k + 1) % poly.length]!;
    for (let i = 0; i < per; i++) out.push([a[0] + ((b[0] - a[0]) * i) / per, a[1] + ((b[1] - a[1]) * i) / per]);
  }
  return out;
}

// ═══════════════════════════ 134 드럼과 밧줄 ═══════════════════════════

/**
 * 134번 치수와 배치. 드럼 통 반지름 R, 밧줄 반지름 rho(중심선은 R + rho), 뒤 테(플랜지) 반지름 flangeR, 통 폭 width,
 * 한 바퀴 감기는 동안 축 방향으로 pitch 만큼 옮겨 간다(들어오는 가닥 z = ZD − pitch/2, 나가는 가닥 z = ZD + pitch/2).
 * 드럼 축 (CX, CY), 통 가운데 평면 z = ZD. A = 왕복 반각(rad), HL = 미끄럼대 가운데에서 줄 끝 고리까지, postH = 미끄럼대 윗면에서 줄 높이까지.
 */
export const K134 = {
  R: 0.5,
  rho: 0.03,
  flangeR: 0.59,
  width: 0.24,
  pitch: 0.1,
  CX: 0,
  CY: 1.8,
  ZD: 0.15,
  A: 1.4,
  HL: 1.3,
  postH: 0.15,
  barH: 0.08,
  railH: 0.07
} as const;

/** 밧줄 중심선이 도는 반지름 */
export const RC134: number = K134.R + K134.rho;
/** 곧은 가닥의 높이(드럼 맨 아래 접선) */
export const ROPE_Y134: number = K134.CY - RC134;

/**
 * 134번 운동식(누적 오차 없는 왕복 시간표). theta = 구동 누적각.
 * 드럼은 고른 속도로 −A → +A 로 돌고(dir = +1, 반시계) 끝에서 뒤집혀 +A → −A(dir = −1). 주기 = 4A.
 * phi = 드럼 각, x = 미끄럼대(줄 끝 두 곳)의 가로 변위 = (R + rho)·phi.
 */
export function swing134(theta: number): { phi: number; dir: 1 | -1; x: number } {
  const T = 2 * K134.A;
  const P = 2 * T;
  const m = ((theta % P) + P) % P;
  const up = m < T;
  const phi = (up ? m : P - m) - K134.A;
  return { phi, dir: up ? 1 : -1, x: RC134 * phi };
}

/**
 * 밧줄 드럼(134번): 통(납작 림) + 뒤 테 + 앞쪽 가장자리의 걸림쇠 8개(판화의 흰 네모) + 굽은 살 4개 + 허브.
 * **원점 = 축 위, 통 폭의 가운데**(로컬 z −width/2 ~ +width/2), 회전축 = 로컬 Z. 주철 + 황동 걸림쇠.
 * userData.mm = { kind:'wheel', r: R, width, rim:'flat', axis:'z' }.
 */
export function ropeDrum134(): THREE.Group {
  const K = K134;
  const g = new THREE.Group();
  const iron = castIron();
  const hw = K.width / 2;
  g.add(mesh(tubeZ(K.R - 0.06, K.R, -hw, hw, 0.006, 64), iron));
  g.add(mesh(tubeZ(K.R - 0.06, K.flangeR, -hw - 0.03, -hw, 0.004, 64), iron));
  // 걸림쇠 8개: 통 앞 가장자리에서 반지름 방향으로 선 납작한 쇠
  const r0 = K.R - 0.04;
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 2 + (k * TAU) / 8;
    const lug = mesh(new THREE.BoxGeometry(K.flangeR - r0, 0.075, 0.03), brass());
    const rm = (K.flangeR + r0) / 2;
    lug.position.set(Math.cos(a) * rm, Math.sin(a) * rm, hw + 0.015);
    lug.rotation.z = a;
    g.add(lug);
  }
  // 굽은 살 4개(판화: 대각 방향, 한쪽으로 살짝 휨)
  const rh = 0.1;
  const rr = K.R - 0.03;
  for (let k = 0; k < 4; k++) {
    const base = Math.PI / 4 + (k * TAU) / 4;
    const left: V2[] = [];
    const right: V2[] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r = rh + (rr - rh) * t;
      const a = base + 0.3 * Math.sin(Math.PI * t) * (1 - t * 0.4);
      const w = 0.05 - 0.018 * t;
      const da = w / r;
      left.push([r * Math.cos(a + da), r * Math.sin(a + da)]);
      right.push([r * Math.cos(a - da), r * Math.sin(a - da)]);
    }
    g.add(mesh(extrude(shapeFrom([...right, ...left.reverse()]), 0.07, 0.006), iron));
  }
  g.add(mesh(tubeZ(0.05, 0.135, -hw - 0.02, hw + 0.02, 0.008), iron));
  setMM(g, { kind: 'wheel', fn: 'ropeDrum134', r: K.R, width: K.width, rim: 'flat', axis: 'z' });
  return g;
}

/**
 * 밧줄 경로(월드 좌표): 왼쪽 끝 (xL, 줄 높이, ZD − pitch/2) → 드럼 맨 아래 접점 → 반시계로 **꼭 한 바퀴**(나선, z 가 pitch 만큼 앞으로)
 * → 다시 맨 아래 접점 → 오른쪽 끝 (xR, 줄 높이, ZD + pitch/2). Rope(K134.rho).setPath() 에 그대로 넣는다.
 * 감긴 호에는 검사 꼬리표(tagArc, wheel 'drum')가 달려 있다. 줄 전체 길이 = (xR − xL) + 2π(R + rho) 로 일정.
 */
export function drumRopePath134(xL: number, xR: number): THREE.Vector3[] {
  const K = K134;
  const z0 = K.ZD - K.pitch / 2;
  const n = 72;
  const arc: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (TAU * i) / n;
    arc.push(new THREE.Vector3(K.CX + RC134 * Math.cos(a), K.CY + RC134 * Math.sin(a), z0 + (K.pitch * i) / n));
  }
  tagArc(arc, { c: [K.CX, K.CY, K.ZD], r: RC134, ccw: true, wheel: 'drum', src: 'drumRopePath134' });
  return [new THREE.Vector3(xL, ROPE_Y134, z0), ...arc, new THREE.Vector3(xR, ROPE_Y134, z0 + K.pitch)];
}

/**
 * 미끄럼대(134번, 판화에 없음 — 줄 양 끝이 묶이는 곧게 움직이는 대): 긴 막대 + 양 끝에 선 기둥 둘 + 레일을 감싸는 앞뒤 턱.
 * **원점 = 막대 윗면의 가운데**, 통 가운데 평면이 로컬 z 0. 줄 끝 고리 = 자식 'endL' (−HL, postH, −pitch/2), 'endR' (+HL, postH, +pitch/2).
 */
export function ropeCarriage134(): THREE.Group {
  const K = K134;
  const g = new THREE.Group();
  const len = 2 * K.HL + 0.12;
  g.add(meshAt(new THREE.BoxGeometry(len, K.barH, 0.24), steel(), 0, -K.barH / 2, 0));
  for (const sz of [-1, 1]) g.add(meshAt(new THREE.BoxGeometry(len, 0.05, 0.02), steel(), 0, -K.barH - 0.025, sz * 0.13));
  const ends: [string, number, number][] = [
    ['endL', -1, -K.pitch / 2],
    ['endR', 1, K.pitch / 2]
  ];
  for (const [name, sx, z] of ends) {
    g.add(meshAt(new THREE.BoxGeometry(0.06, K.postH + 0.06, 0.24), darkSteel(), sx * (K.HL + 0.03), (K.postH + 0.06) / 2, 0));
    // 줄을 무는 고리(기둥 안쪽 면)
    g.add(meshAt(cylX(0.05, -0.012, 0.012), brass(), sx * (K.HL + 0.012), K.postH, z));
    const mk = new THREE.Object3D();
    mk.name = name;
    mk.position.set(sx * K.HL, K.postH, z);
    markAnchor(mk, [0, 0, 0], { of: 'ropeCarriage134' });
    g.add(mk);
  }
  setMM(g, { kind: 'carriage', halfLen: K.HL, postH: K.postH });
  return g;
}

/**
 * 미끄럼대 레일(134번, 판화에 없음, 고정): 곧은 레일(길이 len) + 레일 밑에서 뒤판까지 가는 받침 팔 셋.
 * **원점 = 레일 윗면의 가운데**(미끄럼대 막대의 바닥이 얹히는 면), 로컬 z 0 = 통 가운데 평면. zc = 놓일 z(팔이 뒤판 STAGE.backZ 까지 닿게).
 */
export function carriageRail134(zc: number, len = 4.2): THREE.Group {
  const K = K134;
  const g = new THREE.Group();
  const iron = castIron();
  g.add(meshAt(new THREE.BoxGeometry(len, K.railH, 0.2), iron, 0, -K.railH / 2, 0));
  const back = STAGE.backZ - zc;
  const armLen = 0.1 - back;
  for (const x of [-len / 2 + 0.5, 0, len / 2 - 0.5]) {
    g.add(meshAt(new THREE.BoxGeometry(0.16, 0.06, armLen), iron, x, -K.railH - 0.03, back + armLen / 2));
    g.add(meshAt(new THREE.BoxGeometry(0.26, 0.2, 0.03), darkSteel(), x, -K.railH - 0.03, back + 0.015));
  }
  setMM(g, { kind: 'rail', len });
  return g;
}

// ═══════════════════════════ 135 삼각 편심 변형(원판에 단 삼각 태핏) ═══════════════════════════

/**
 * 135번 치수. w = 뢸로 삼각형의 폭(행정), rho = 모서리 둥글림, clear = 태핏과 틀 면 사이 틈(한쪽),
 * discR = 뒤 원판 반지름, halfW = 틀 창의 가로 반폭, bar = 틀 위·아래 가로대 두께, rodEnd = 창 중심에서 막대 끝까지.
 */
export const K135 = {
  w: 0.5,
  rho: 0.03,
  clear: 0.002,
  discR: 0.6,
  discT: 0.05,
  tappetT: 0.15,
  halfW: 0.585,
  bar: 0.1,
  side: 0.07,
  bow: 0.06,
  yokeT: 0.12,
  rodR: 0.05,
  nutAF: 0.15,
  nutH: 0.13,
  rodEnd: 1.282
} as const;

/** 틀 창의 세로 간격(위·아래 맞닿는 면 사이) = w + 2·rho + 2·clear */
export const GAP135: number = K135.w + 2 * K135.rho + 2 * K135.clear;

/**
 * 135번 운동식: 태핏이 대칭축을 위로 한 자세에서 thetaE(rad) 돌았을 때 h(0 ~ w).
 * 틀 창 중심의 높이 = 축 높이 + h − w/2. (식은 91번 triCamLift 와 같다 — 축이 삼각형의 꼭짓점에 있다.)
 * 한 바퀴: thetaE −30°~30° 위 멈춤(h = w) → 30°~150° 내려감 → 150°~210° 아래 멈춤(h = 0) → 210°~330° 올라감.
 */
export function tappetLift135(thetaE: number): number {
  return triCamLift(K135.w, thetaE);
}

/** 태핏 윤곽(원점 = 축 = 꼭짓점 V0, 대칭축 = +Y). 240점, 반시계 */
export function tappetOutline135(): V2[] {
  return triCamOutline(K135.w, K135.rho);
}

/**
 * 원판 + 삼각 태핏(135번, 한 몸으로 돈다): 뒤의 둥근 원판(축과 같은 중심) 앞면에 삼각 태핏을 볼트로 달았다.
 * **원점 = 축 중심 = 태핏의 꼭짓점 V0**, 대칭축 = 로컬 +Y(넓은 호가 위), 회전축 = 로컬 Z.
 * 로컬 z: 뒤 보스 −discT−0.1 ~ −discT, 원판 −discT ~ 0, 태핏 0 ~ tappetT, 볼트 머리 ~ tappetT + 0.045.
 * 볼트(네모 머리 + 와셔)는 태핏의 도심 (0, w/√3) 에 있다 — **축이 아니다**. userData.outline = 태핏 윤곽.
 */
export function tappetDisc135(): THREE.Group {
  const K = K135;
  const g = new THREE.Group();
  g.add(mesh(cylZ(K.discR, -K.discT, 0, 0.006, 96), castIron()));
  g.add(mesh(tubeZ(0.05, 0.125, -K.discT - 0.1, -K.discT, 0.006), darkSteel()));
  const outline = tappetOutline135();
  g.add(meshAt(extrude(shapeFrom(outline), K.tappetT, 0.008, 48), bronze({ roughness: 0.36 }), 0, 0, K.tappetT / 2));
  const by = K.w / Math.sqrt(3);
  g.add(meshAt(cylZ(0.06, 0, 0.015, 0.003), steel(), 0, by, K.tappetT));
  g.add(meshAt(new THREE.BoxGeometry(0.062, 0.062, 0.03), darkSteel(), 0, by, K.tappetT + 0.03));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', shape: 'triangular', fn: 'tappetDisc135', w: K.w, rho: K.rho, discR: K.discR, axis: 'z' });
  return g;
}

/**
 * 밸브 막대의 네모 틀(135번): 곧은 네모 창(가로 ±halfW, 세로 ±GAP135/2) + 옆변이 바깥으로 볼록한 테 + 위·아래 육각 너트와 둥근 막대.
 * **원점 = 창 중심**, 막대 = 로컬 ±Y(끝이 ±rodEnd), 두께 가운데 z = 0. 황동 테, 강 막대.
 * userData.outlines.hole = 창 윤곽(태핏이 이 안에 있어야 한다).
 */
export function valveYoke135(): THREE.Group {
  const K = K135;
  const g = new THREE.Group();
  const hi = GAP135 / 2;
  const ho = hi + K.bar;
  const hx = K.halfW + K.side;
  const outer: V2[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const y = -ho + (2 * ho * i) / n;
    outer.push([hx + K.bow * (1 - (y / ho) ** 2), y]);
  }
  for (let i = 0; i <= n; i++) {
    const y = ho - (2 * ho * i) / n;
    outer.push([-hx - K.bow * (1 - (y / ho) ** 2), y]);
  }
  const hole: V2[] = [
    [-K.halfW, -hi],
    [K.halfW, -hi],
    [K.halfW, hi],
    [-K.halfW, hi]
  ];
  const shape = shapeFrom(outer);
  shape.holes.push(pathFrom([...hole].reverse()));
  g.add(mesh(extrude(shape, K.yokeT, 0.008), brass()));
  const rodLen = K.rodEnd - ho;
  for (const sy of [-1, 1]) {
    g.add(meshAt(new THREE.CylinderGeometry(K.rodR, K.rodR, rodLen + 0.01, 28), steel(), 0, sy * (ho + rodLen / 2 - 0.005), 0));
    g.add(meshAt(hexPrism(K.nutAF, K.nutH, true, true, 0), darkSteel(), 0, sy * (ho + K.nutH / 2), 0));
  }
  g.userData.outlines = { hole: fine(hole) };
  setMM(g, { kind: 'frame', fn: 'valveYoke135', halfW: K.halfW, gap: GAP135, halfH: ho, width: K.yokeT, rodEnd: K.rodEnd });
  return g;
}

/**
 * 끝 너트가 없는 Z 방향 축(135·공용): 뒤판 앞면(z = STAGE.backZ)에서 z1 까지 + 뒤판 쪽 보스. 그룹 원점 = (x, y, 0).
 * 원판 뒤 보스에 꽂혀 앞에서는 보이지 않는 축에 쓴다.
 */
export function plainShaftZ(x: number, y: number, z1: number, r = 0.05): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  g.add(mesh(cylZ(r, STAGE.backZ, z1, r * 0.25, 32), steel()));
  g.add(mesh(cylZ(r * 2.4, STAGE.backZ, STAGE.backZ + 0.1, 0.012), darkSteel()));
  setMM(g, { kind: 'shaft', axis: 'z', r, z0: STAGE.backZ, z1 });
  return g;
}

// ═══════════════════════════ 136 옆면 톱니 캠 바퀴 ═══════════════════════════

/**
 * 136번 치수. 바퀴 테 바깥 반지름 R, 안 반지름 ri(막대 끝은 그 가운데 반지름 rm 에 선다), 톱니 수 N, 톱니 높이 D(축 방향),
 * 몸통 두께 B(톱니 골 평면의 뒤쪽), rise = 한 톱니 가운데 천천히 오르는 몫, rt = 막대 끝 둥근 날의 반지름.
 * collarAt·collarT = 막대의 턱(스프링 자리), rodLen = 막대 길이. ZC = 바퀴 축의 z(깊이로 지름이 나온다).
 */
export const K136 = {
  R: 0.48,
  ri: 0.4,
  rm: 0.44,
  N: 12,
  D: 0.1,
  B: 0.1,
  rise: 0.68,
  rt: 0.03,
  tipLen: 0.09,
  rodR: 0.026,
  collarAt: 0.27,
  collarT: 0.03,
  collarR: 0.062,
  rodLen: 1.05,
  springR: 0.055,
  springWire: 0.011,
  ZC: 0.26
} as const;

/** 한 톱니의 모양(0~1 → 0~1): rise 구간에서 천천히 오르고 나머지에서 빨리 내린다. 골과 끝은 둥글다 */
function tooth136(u: number): number {
  const f = u - Math.floor(u);
  const a = K136.rise;
  return f < a ? (1 - Math.cos((Math.PI * f) / a)) / 2 : (1 + Math.cos((Math.PI * (f - a)) / (1 - a))) / 2;
}

/**
 * 바퀴 로컬 각 a(rad)에서의 톱니 높이(골 평면에서 +X 로, 0 ~ D).
 * 로컬 각: 테 위의 점 = (x, r·sin a, r·cos a) — a = 0 이 로컬 +Z, 양의 방향이 +Y 쪽.
 */
export function faceCamHeight136(a: number): number {
  return K136.D * tooth136((K136.N * a) / TAU);
}

const LIFT_M = 2048;
let liftTable: Float64Array | null = null;

function liftAt(psi: number): number {
  // 막대 끝의 둥근 날(축 = 바퀴 반지름 방향, 반지름 rt)이 테 안쪽 모서리(반지름 ri — 톱니가 가장 가파른 곳)에 닿는 높이
  const K = K136;
  const bMax = Math.asin(K.rt / K.ri);
  let best = -Infinity;
  const n = 160;
  for (let i = -n; i <= n; i++) {
    const b = (bMax * i) / n;
    const s = K.ri * Math.sin(b);
    const v = faceCamHeight136(b + psi) + Math.sqrt(Math.max(0, K.rt * K.rt - s * s)) - K.rt;
    if (v > best) best = v;
  }
  return best;
}

/**
 * 136번 운동식: 바퀴가 rotation.x = psi 만큼 돌았을 때 **막대 끝(둥근 날의 맨 왼쪽 점)이 톱니 골 평면에서 떨어진 거리**(+X).
 * psi 가 늘면 천천히 오르고(톱니 한 칸의 68 %) 빨리 떨어진다. 주기 = 2π/N. 표(2048칸) 보간이라 누적 오차 없음.
 */
export function faceCamLift136(psi: number): number {
  if (liftTable === null) {
    liftTable = new Float64Array(LIFT_M + 1);
    const pitch = TAU / K136.N;
    for (let i = 0; i <= LIFT_M; i++) liftTable[i] = liftAt((pitch * i) / LIFT_M);
  }
  const pitch = TAU / K136.N;
  const u = (((psi / pitch) % 1) + 1) % 1;
  const f = u * LIFT_M;
  const i = Math.min(LIFT_M - 1, Math.floor(f));
  const t = f - i;
  return liftTable[i]! * (1 - t) + liftTable[i + 1]! * t;
}

/**
 * 옆면 톱니 캠 바퀴(136번): 테의 오른쪽 가장자리(+X)를 톱니 모양으로 깎은 왕관 꼴 바퀴 + 왼쪽 원판(웨브) + 허브 턱.
 * **원점 = 축 위, 톱니 골 평면**(로컬 x: 허브 턱 −B−0.07 ~ −B, 몸통 −B ~ 0, 톱니 0 ~ D), 회전축 = 로컬 X. 청동(구동).
 * 모델은 rotation.x = psi 로 돌린다(앞에서 보면 앞면이 아래로 내려간다).
 */
export function faceCamWheel136(): THREE.Group {
  const K = K136;
  const g = new THREE.Group();
  const pos: number[] = [];
  const P = (x: number, r: number, a: number): [number, number, number] => [x, r * Math.sin(a), r * Math.cos(a)];
  const quad = (p0: number[], p1: number[], p2: number[], p3: number[]): void => {
    pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  };
  const steps = K.N * 48;
  for (let i = 0; i < steps; i++) {
    const a0 = (TAU * i) / steps;
    const a1 = (TAU * (i + 1)) / steps;
    const h0 = faceCamHeight136(a0);
    const h1 = faceCamHeight136(a1);
    // 바깥 벽, 안 벽, 톱니 면(+X), 뒷면(−X)
    quad(P(-K.B, K.R, a0), P(h0, K.R, a0), P(h1, K.R, a1), P(-K.B, K.R, a1));
    quad(P(-K.B, K.ri, a1), P(h1, K.ri, a1), P(h0, K.ri, a0), P(-K.B, K.ri, a0));
    quad(P(h0, K.ri, a0), P(h1, K.ri, a1), P(h1, K.R, a1), P(h0, K.R, a0));
    quad(P(-K.B, K.R, a0), P(-K.B, K.R, a1), P(-K.B, K.ri, a1), P(-K.B, K.ri, a0));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const mat = bronze({ roughness: 0.38 }).clone();
  mat.side = THREE.DoubleSide;
  g.add(mesh(creased(geo, 40), mat));
  g.add(mesh(tubeX(0.05, K.ri + 0.004, -K.B, -K.B + 0.05, 0.004, 64), bronze({ roughness: 0.42 })));
  g.add(mesh(tubeX(0.05, 0.13, -K.B - 0.07, -K.B, 0.006), darkSteel()));
  setMM(g, { kind: 'cam', shape: 'face', fn: 'faceCamWheel136', teeth: K.N, depth: K.D, r: K.R, ri: K.ri, axis: 'x' });
  return g;
}

const SEC_N = 241;
const SEC_B = 0.9;

/**
 * 침범 검사용 단면(136번, 보이지 않는 표식): 테 안쪽 모서리(반지름 ri)의 톱니 윤곽을 정면(XY)으로 비춘 다각형.
 * **바퀴와 따로 놓는다**(돌지 않는다): position = (톱니 골 평면 x, 축 높이, 막대의 z). 매 프레임 setCamSection136(sec, psi) 로 갱신.
 * userData.outline = [(톱니 높이, ri·sin b)] (b = −0.9 ~ 0.9 rad) + 뒤쪽 닫는 두 점. 배열 객체는 바뀌지 않는다(값만 고쳐 쓴다).
 */
export function camSection136(): THREE.Object3D {
  const o = new THREE.Object3D();
  const pts: V2[] = [];
  for (let i = 0; i < SEC_N + 2; i++) pts.push([0, 0]);
  o.userData.outline = pts;
  setMM(o, { kind: 'section', of: 'faceCamWheel136' });
  setCamSection136(o, 0);
  return o;
}

/** camSection136 의 윤곽을 바퀴 각 psi 에 맞춘다 */
export function setCamSection136(sec: THREE.Object3D, psi: number): void {
  const pts = sec.userData.outline as V2[];
  const K = K136;
  for (let i = 0; i < SEC_N; i++) {
    const b = -SEC_B + (2 * SEC_B * i) / (SEC_N - 1);
    const p = pts[i]!;
    p[0] = faceCamHeight136(b + psi);
    p[1] = K.ri * Math.sin(b);
  }
  const y1 = K.ri * Math.sin(SEC_B);
  pts[SEC_N]![0] = -K.B;
  pts[SEC_N]![1] = y1;
  pts[SEC_N + 1]![0] = -K.B;
  pts[SEC_N + 1]![1] = -y1;
}

/**
 * 따름 막대(136번): 왼쪽 끝의 둥근 날(축 = 로컬 Z, 반지름 rt, 길이 tipLen) + 곧은 막대(+X 로 rodLen) + 스프링이 기대는 턱.
 * **원점 = 둥근 날의 맨 왼쪽 점**(톱니에 닿는 자리). 모델은 position.x = 톱니 골 평면 x + faceCamLift136(psi).
 * 턱은 로컬 x collarAt ~ collarAt + collarT. userData.outline = 날의 단면 원(중심 (rt, 0)).
 */
export function followerRod136(): THREE.Group {
  const K = K136;
  const g = new THREE.Group();
  g.add(meshAt(cylZ(K.rt, -K.tipLen / 2, K.tipLen / 2, 0.004, 40), darkSteel(), K.rt, 0, 0));
  g.add(mesh(cylX(K.rodR, K.rt, K.rodLen, 0.004), steel()));
  g.add(mesh(tubeX(K.rodR - 0.002, K.collarR, K.collarAt, K.collarAt + K.collarT, 0.004), brass()));
  const outline: V2[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (TAU * i) / 64;
    outline.push([K.rt + K.rt * Math.cos(a), K.rt * Math.sin(a)]);
  }
  g.userData.outline = outline;
  setMM(g, { kind: 'follower', fn: 'followerRod136', rt: K.rt, len: K.rodLen, collar: K.collarAt + K.collarT });
  return g;
}

/**
 * 스프링 받침 기둥(136번, 판화의 오른쪽 세운 판 + 굽은 보강 살): 막대가 지나는 구멍(축 X)이 난 세운 판.
 * **원점 = 구멍 중심**. 판은 로컬 x ±0.035, z ±0.075, y −drop(받침 윗면) ~ +0.12. 보강 살은 판의 왼쪽(−X) 아래.
 */
export function springBracket136(drop: number): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  const hz = 0.075;
  const plate = new THREE.Shape();
  plate.moveTo(-hz, -drop);
  plate.lineTo(hz, -drop);
  plate.lineTo(hz, 0.12);
  plate.lineTo(-hz, 0.12);
  plate.closePath();
  const holeP = new THREE.Path();
  holeP.absarc(0, 0, K136.rodR + 0.004, 0, TAU, true);
  plate.holes.push(holeP);
  const pg = extrude(plate, 0.07, 0.005);
  pg.rotateY(Math.PI / 2);
  g.add(mesh(pg, iron));
  // 굽은 보강 살(오목한 곡선)
  const gl = 0.32;
  const gh = drop * 0.55;
  const pts: V2[] = [[-0.035, -drop]];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (Math.PI / 2);
    pts.push([-0.035 - gl * (1 - Math.sin(t)), -drop + gh * (1 - Math.cos(t))]);
  }
  g.add(mesh(extrude(shapeFrom(pts), 0.035, 0.003), iron));
  setMM(g, { kind: 'bracket', fn: 'springBracket136', drop });
  return g;
}

/**
 * 받침 대(136번, 판화의 빗금 친 바닥): 전시대 받침 윗면(y 0.18)에서 top 까지 올린 네모 대. x0 ~ x1, z −0.24 ~ 0.79.
 */
export function bench136(x0: number, x1: number, top: number): THREE.Mesh {
  const y0 = 0.18;
  const z0 = -0.24;
  const z1 = 0.79;
  const m = meshAt(new THREE.BoxGeometry(x1 - x0, top - y0, z1 - z0), castIron(), (x0 + x1) / 2, (y0 + top) / 2, (z0 + z1) / 2);
  setMM(m, { kind: 'bench', top });
  return m;
}
