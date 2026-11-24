// 128·129·130번 전용 키트 — 세 날개 축과 턱 달린 네모 틀 / 중국식 윈들러스(차동 권양기) / 편심 캠으로 닫는 쇠판 가위
// 치수 검증: shots/_verify/s128.mjs, s129.mjs, s130.mjs (윤곽·운동식이 이 파일과 같다)
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, rubber, steel, wood } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, pathFrom, rodProfile, roundedRect, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { pulley } from './pulley';
import { markAnchor, setMM, tagArc } from './mm';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z 방향 원통 */
function cylZ(r: number, len: number, seg = 28): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** X 방향 원통 */
function cylX(r: number, len: number, seg = 28): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** 원호 점열(도) */
function arcDeg(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const o: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return o;
}

/** 닫힌 다각형의 변을 step 이하로 잘게 나눈다(침범 검사가 변 위의 점도 보도록) */
function fineClosed(pts: V2[], step = 0.02): V2[] {
  const o: V2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < n; j++) o.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  return o;
}

// ═════════════════════════ 128: 세 날개 축과 턱 달린 네모 틀 ═════════════════════════

/** 128번 치수. 길이 단위 = 전시 좌표. 축 중심이 원점, 틀 좌표는 틀 창의 중심이 원점 */
export const K128 = {
  /** 날개 끝 공 중심의 반지름 */
  R: 0.5,
  /** 날개 끝 공의 반지름 */
  rb: 0.085,
  /** 허브 반지름 */
  hubR: 0.19,
  /** 팔 반폭 */
  armW: 0.045,
  /** 축 구멍 반지름 */
  bore: 0.09,
  /** 틀 창의 반폭·반높이 */
  Wi: 0.91,
  Hi: 0.65,
  /** 창 모서리 둥글림 */
  rc: 0.12,
  /** 틀 테 폭 */
  band: 0.16,
  /** 틀 중심에서 턱의 일하는 면까지(위 턱은 +d, 아래 턱은 −d) */
  d: 0.41,
  /** 턱 두께(가로) */
  tw: 0.147,
  /** 일하는 면이 끝나는 높이(위 턱은 +yc 까지 내려옴) */
  yc: 0.245,
  /** 턱 끝이 일하는 면 끝보다 더 내려온 양(밑면이 비스듬) */
  tipDrop: 0.096,
  /** 일하는 면 뿌리의 둥근 살 반지름 */
  fillet: 0.13,
  /** 판화 자세(t = 1)에서 미는 날개의 각(도, +X 에서 반시계) */
  pose: 35,
  /** 안내 막대 반지름·길이(틀 바깥 면에서) */
  rodR: 0.05,
  rodLen: 0.52
} as const;

/** 턱 모서리가 밀려나는 가장 먼 자리(축 기준 x) = 공·모서리·축이 한 줄일 때 */
const REACH128 = Math.sqrt((K128.R + K128.rb) ** 2 - K128.yc ** 2);
/** 공이 턱 모서리를 놓는 각(도) */
export const PHI_E128 = Math.asin(K128.yc / (K128.R + K128.rb)) / DEG;
/** 틀의 반 행정(±) */
export const SMAX128 = REACH128 - K128.d;
/** 공이 일하는 면에 처음 닿는 각(도) */
export const PHI_1128 = Math.acos((REACH128 - 2 * SMAX128 - K128.rb) / K128.R) / DEG;
/** 한 번 미는 동안 축이 도는 각(도). 60 − 이 값 = 멈춤 */
export const PUSH128 = PHI_1128 - PHI_E128;

/** 위 턱을 미는 공이 각 phi(도)일 때 일하는 면의 x(축 기준). 면 접촉 → 모서리 접촉 */
function faceX128(phi: number): number {
  const y = K128.R * Math.sin(phi * DEG);
  if (y >= K128.yc) return K128.R * Math.cos(phi * DEG) + K128.rb;
  return K128.R * Math.cos(phi * DEG) + Math.sqrt(Math.max(0, K128.rb ** 2 - (K128.yc - y) ** 2));
}

/** 축이 시계 방향으로 rot(도) 돌았을 때 틀의 변위. rot = 0 은 위쪽 공이 PHI_1128 에서 위 턱에 막 닿는 순간. 주기 120° */
export function frameShift128(rot: number): number {
  const p = ((rot % 120) + 120) % 120;
  if (p < PUSH128) return faceX128(PHI_1128 - p) - K128.d;
  if (p < 60) return SMAX128;
  if (p < 60 + PUSH128) return -(faceX128(PHI_1128 - (p - 60)) - K128.d);
  return -SMAX128;
}

export interface Wiper128 {
  /** 날개 0 번의 각(rad, +X 에서 반시계) = 날개 그룹의 rotation.z. 시계 방향으로 돌므로 줄어든다 */
  phi: number;
  /** 틀의 변위(+ = 오른쪽) */
  s: number;
  /** 0 = 오른쪽으로 미는 중, 1 = 오른쪽 끝에서 멈춤, 2 = 왼쪽으로 미는 중, 3 = 왼쪽 끝에서 멈춤 */
  phase: 0 | 1 | 2 | 3;
  /** 축 회전수(누적) */
  turns: number;
}

/** 128번 운동식. theta = 구동 누적각(축 시계 방향). theta = 1.6(t = 1)에서 판화 자세(미는 날개가 35°) */
export function wiper128(theta: number): Wiper128 {
  const rot = (theta - 1.6) / DEG + (PHI_1128 - K128.pose);
  const p = ((rot % 120) + 120) % 120;
  const phase: 0 | 1 | 2 | 3 = p < PUSH128 ? 0 : p < 60 ? 1 : p < 60 + PUSH128 ? 2 : 3;
  return { phi: (PHI_1128 - rot) * DEG, s: frameShift128(rot), phase, turns: theta / TAU };
}

/** 세 날개(허브 + 팔 셋 + 끝 공)의 윤곽. 원점 = 축, 날개 0 번 = 로컬 +X. 반시계 */
export function wiperOutline128(): V2[] {
  const p: V2[] = [];
  const hb = Math.asin(K128.armW / K128.hubR);
  const bb = Math.asin(K128.armW / K128.rb);
  for (let k = 0; k < 3; k++) {
    const A = k * 120 * DEG;
    const rot = (x: number, y: number): V2 => [x * Math.cos(A) - y * Math.sin(A), x * Math.sin(A) + y * Math.cos(A)];
    for (let i = 0; i <= 10; i++) {
      const a = -120 * DEG + hb + ((120 * DEG - 2 * hb) * i) / 10;
      p.push(rot(K128.hubR * Math.cos(a), K128.hubR * Math.sin(a)));
    }
    for (let i = 0; i <= 36; i++) {
      const a = -(Math.PI - bb) + (2 * (Math.PI - bb) * i) / 36;
      p.push(rot(K128.R + K128.rb * Math.cos(a), K128.rb * Math.sin(a)));
    }
  }
  return p;
}

/** 틀 창의 윤곽(턱 둘이 창 안으로 내밀었다). 원점 = 창 중심. 위 턱은 오른쪽 위에서 내려오고 아래 턱은 그 점대칭. 반시계 */
export function frameHoleOutline128(): V2[] {
  const { Wi, Hi, rc, d, tw, yc, tipDrop, fillet } = K128;
  const T: V2[] = [
    [Wi, 0],
    ...arcDeg(Wi - rc, Hi - rc, rc, 0, 90, 6),
    [d + tw, Hi],
    [d + tw, yc - tipDrop],
    [d, yc],
    [d, Hi - fillet],
    ...arcDeg(d - fillet, Hi - fillet, fillet, 0, 90, 8).slice(1),
    ...arcDeg(-Wi + rc, Hi - rc, rc, 90, 180, 6)
  ];
  return fineClosed([...T, ...T.map(([x, y]): V2 => [-x, -y])]);
}

/**
 * 세 날개 축(128번 구동): 허브 + 팔 셋 + 끝의 둥근 공(원판). **원점 = 축**, 회전축 = 로컬 Z, 두께 가운데 z = 0. 청동.
 * userData.outline = wiperOutline128(). 날개 0 번(+X) 공에 밝은 표시점.
 */
export function wiperStar128(thick = 0.1): THREE.Group {
  const g = new THREE.Group();
  const outline = wiperOutline128();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, K128.bore));
  g.add(mesh(extrude(shape, thick, 0.008, 24), bronze({ roughness: 0.36 })));
  const hub = lathe(tubeProfile(K128.bore, K128.hubR * 0.8, -thick / 2 - 0.02, thick / 2 + 0.02, 0.008), 40);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, bronze({ roughness: 0.3 })));
  g.add(meshAt(cylZ(0.022, 0.01), paint(0xf2b619), K128.R, 0, thick / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', shape: 'wiper3', R: K128.R, rb: K128.rb, width: thick, axis: 'z' });
  return g;
}

/**
 * 턱 달린 네모 틀(128번 종동): 창 + 테 + 창 안으로 내민 턱 둘(오른쪽 위, 왼쪽 아래) + 양옆 안내 막대.
 * **원점 = 창 중심**, 미끄럼 방향 = 로컬 X, 두께 가운데 z = 0. 황동 틀 + 강 막대.
 * 바깥 반폭 = Wi + band = 1.07, 반높이 = Hi + band = 0.81. 막대 끝 = ±(1.07 + rodLen).
 * userData.outlines.hole = frameHoleOutline128() (날개 윤곽이 이 안에 있어야 한다).
 */
export function toothedFrame128(thick = 0.12): THREE.Group {
  const g = new THREE.Group();
  const Wo = K128.Wi + K128.band;
  const Ho = K128.Hi + K128.band;
  const hole = frameHoleOutline128();
  const shape = roundedRect(-Wo, -Ho, Wo, Ho, 0.2);
  shape.holes.push(pathFrom([...hole].reverse()));
  g.add(mesh(extrude(shape, thick, 0.008, 24), brass()));
  for (const sx of [-1, 1]) {
    g.add(meshAt(cylX(K128.rodR, K128.rodLen + 0.02), steel(), sx * (Wo + K128.rodLen / 2 - 0.01), 0, 0));
    // 막대 뿌리의 턱(판화의 양옆 돌기)
    g.add(meshAt(cylX(K128.rodR * 1.7, 0.05), brass(), sx * (Wo + 0.02), 0, 0));
  }
  g.userData.outlines = { hole };
  setMM(g, { kind: 'frame', halfW: Wo, halfH: Ho, width: thick, rodLen: K128.rodLen, stroke: 2 * SMAX128 });
  return g;
}

/**
 * 가로(X) 막대 안내 블록(판화에 없음): 구멍이 **X 방향**으로 뚫린 블록 + 뒤판까지 닿는 받침 기둥. 주철.
 * **원점 = 구멍 중심**(모델이 (x, y, zc) 에 놓는다). holeR = 막대 반지름, zc = 놓일 z, len = 막대 방향 길이.
 */
export function slideGuide128(holeR: number, zc: number, len = 0.14): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  const wall = 0.06;
  const half = holeR + wall;
  const shape = roundedRect(-half, -half, half, half, 0.02);
  shape.holes.push(circlePath(0, 0, holeR + 0.003));
  const block = extrude(shape, len, 0.006);
  block.rotateY(Math.PI / 2);
  g.add(mesh(block, iron));
  const back = STAGE.backZ - zc;
  const postLen = -half - back + 0.01;
  if (postLen > 0.005) {
    g.add(meshAt(new THREE.BoxGeometry(len * 0.7, half * 1.4, postLen), iron, 0, 0, back + postLen / 2));
    g.add(meshAt(new THREE.BoxGeometry(len * 1.5, half * 2.6, 0.03), darkSteel(), 0, 0, back + 0.015));
  }
  setMM(g, { kind: 'guide', axis: 'x', len });
  return g;
}

// ═════════════════════════ 129: 중국식 윈들러스 ═════════════════════════

/** 129번 치수. 통의 축 = 월드 X, 축 중심선 = (y = YA, z = ZC) */
export const K129 = {
  /** 큰 통·작은 통 반지름 */
  R1: 0.3,
  R2: 0.15,
  /** 줄 반지름 */
  rho: 0.045,
  /** 감긴 줄의 피치(한 바퀴에 옆으로 가는 양) */
  pitch: 0.095,
  /** 통 축의 높이·깊이 */
  YA: 2.72,
  ZC: 0.3,
  /** 움직도르래 반지름(pulley 의 r — 줄 중심 반지름은 r + 0.01) */
  RP: 0.51,
  /** 구동이 한쪽으로 도는 바퀴 수(올림 1.15 바퀴 → 내림 1.15 바퀴) */
  turns: 1.15,
  /** 맨 아래일 때 큰 통에 감긴 바퀴 수(작은 통은 n1 + turns) */
  n1: 4,
  /** 맨 아래일 때 큰 통 쪽 가닥의 x */
  xA0: -0.52,
  /** 맨 아래일 때 도르래 중심 높이 */
  yP0: 1.14,
  /** 왕복 시간표의 느림 계수: beta = βmax·(1 − cos(theta/kappa))/2 */
  kappa: 4,
  /** 플랜지 반지름: 큰 통 양쪽 / 작은 통 오른쪽 */
  fl1: 0.44,
  fl2: 0.29,
  /** 통 길이: 큰 통 x −barrelL ~ −flT, 작은 통 flT ~ barrelL. 플랜지 두께 2·flT */
  barrelL: 1.0,
  flT: 0.03,
  /** 기둥 중심 x(±), 기둥 두께 */
  postX: 1.2,
  postT: 0.1,
  /** 감긴 줄 메시의 한 바퀴당 마디 수 */
  seg: 50
} as const;

const R1E = K129.R1 + K129.rho;
const R2E = K129.R2 + K129.rho;
const RPE = K129.RP + 0.01;
const DZ129 = R1E + R2E;
/** 두 가닥의 x 간격(도르래 지름이 두 가닥의 3D 거리와 같도록) */
const DX129 = Math.sqrt((2 * RPE) ** 2 - DZ129 ** 2);
/** 감긴 줄의 고정 끝 x: 큰 통(왼쪽 끝), 작은 통(오른쪽 끝) */
const XL0 = K129.xA0 - K129.pitch * K129.n1;
const XR0 = K129.xA0 + DX129 + K129.pitch * (K129.n1 + K129.turns);

export interface Windlass129 {
  /** 통이 돈 각(rad, 0 ~ 2π·turns). 통 그룹의 rotation.x = −beta (앞쪽 겉이 위로 올라가는 방향 = 큰 통에 감김) */
  beta: number;
  /** 큰 통·작은 통에 감긴 바퀴 수 */
  n1: number;
  n2: number;
  /** 큰 통에서 내려오는 가닥(앞쪽)의 위 끝·작은 통에서 내려오는 가닥(뒤쪽)의 위 끝 */
  topA: THREE.Vector3;
  topB: THREE.Vector3;
  /** 도르래 중심 */
  block: THREE.Vector3;
  /** 도르래 그룹의 rotation.y (두 가닥이 앞뒤로 어긋나 있어 비스듬히 선다, 일정) */
  yaw: number;
  /** 도르래 바퀴(sheave)의 rotation.z */
  spin: number;
  /** 도르래가 맨 아래에서 올라온 높이 */
  lift: number;
}

/** 129번 운동식. theta = 구동 누적각. 통은 1.15 바퀴 감았다가 1.15 바퀴 푸는 왕복(주기 theta = 2π·kappa) */
export function windlass129(theta: number): Windlass129 {
  const bmax = TAU * K129.turns;
  const beta = (bmax * (1 - Math.cos(theta / K129.kappa))) / 2;
  const xA = K129.xA0 + (K129.pitch * beta) / TAU;
  const xB = xA + DX129;
  const lift = ((R1E - R2E) * beta) / 2;
  const yP = K129.yP0 + lift;
  const zA = K129.ZC + R1E;
  const zB = K129.ZC - R2E;
  return {
    beta,
    n1: K129.n1 + beta / TAU,
    n2: K129.n1 + K129.turns - beta / TAU,
    topA: new THREE.Vector3(xA, K129.YA, zA),
    topB: new THREE.Vector3(xB, K129.YA, zB),
    block: new THREE.Vector3((xA + xB) / 2, yP, (zA + zB) / 2),
    yaw: Math.atan2(DZ129, DX129),
    spin: -((R1E + R2E) * beta) / (2 * RPE),
    lift
  };
}

/** 통 로컬 좌표(원점 = 축 위 x = 0, 축 = X)의 감긴 줄 점: 고정 끝에서 s 바퀴 간 자리 */
function coilPoint(big: boolean, s: number): THREE.Vector3 {
  if (big) {
    const a = TAU * (K129.n1 - s);
    return new THREE.Vector3(XL0 + K129.pitch * s, R1E * Math.sin(a), R1E * Math.cos(a));
  }
  const a = Math.PI - TAU * (K129.n1 + K129.turns - s);
  return new THREE.Vector3(XR0 - K129.pitch * s, R2E * Math.sin(a), R2E * Math.cos(a));
}

/**
 * 통에 감긴 줄(나선). **통 그룹의 자식으로 붙인다**(통과 함께 돈다). 고정 끝에서 최대 n1 + turns 바퀴까지 만들어 두고
 * setCoil129 로 지금 감긴 만큼만 보이게 한다. big = 큰 통(왼쪽 끝에 고정, 오른쪽으로 감겨 나감) / 작은 통(오른쪽 끝에 고정, 왼쪽으로).
 * 자식 'tip'(markAnchor) = 보이는 나선의 끝(풀린 줄이 이어지는 자리). mm.kind = 'coil' (줄 개수에 들지 않는다).
 */
export function ropeCoil129(big: boolean): THREE.Group {
  const g = new THREE.Group();
  const maxTurns = K129.n1 + K129.turns;
  const N = Math.round(maxTurns * K129.seg);
  const RAD = 8;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= N; j++) {
    const c = coilPoint(big, j / K129.seg);
    const er = new THREE.Vector3(0, c.y, c.z).normalize();
    for (let i = 0; i < RAD; i++) {
      const f = (i / RAD) * TAU;
      const n = er.clone().multiplyScalar(Math.cos(f)).add(new THREE.Vector3(Math.sin(f), 0, 0));
      pos.push(c.x + n.x * K129.rho, c.y + n.y * K129.rho, c.z + n.z * K129.rho);
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < RAD; i++) {
      const a = j * RAD + i;
      const b = j * RAD + ((i + 1) % RAD);
      const c = a + RAD;
      const d = b + RAD;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const mat = rubber().clone();
  mat.color.set(0x8a6a3a);
  mat.side = THREE.DoubleSide;
  const m = mesh(geo, mat);
  m.name = 'strand';
  g.add(m);
  // 고정 끝을 통에 무는 꺾쇠
  const a0 = coilPoint(big, 0);
  const clamp = meshAt(new THREE.BoxGeometry(0.05, 0.11, 0.11), darkSteel(), a0.x, a0.y, a0.z);
  g.add(clamp);
  const tip = new THREE.Object3D();
  tip.name = 'tip';
  markAnchor(tip, [0, 0, 0], { of: 'coil' });
  g.add(tip);
  g.userData.big = big;
  g.userData.perSeg = RAD * 6;
  setMM(g, { kind: 'coil', big, r: big ? R1E : R2E, pitch: K129.pitch, maxTurns });
  setCoil129(g, maxTurns);
  return g;
}

/** 감긴 바퀴 수를 정한다(마디 단위로 내림). 남는 토막은 windlassRopePath129 의 줄이 잇는다. 돌려주는 값 = 실제로 보이는 바퀴 수 */
export function setCoil129(coil: THREE.Group, turns: number): number {
  const big = coil.userData.big === true;
  const segs = Math.max(0, Math.floor(turns * K129.seg + 1e-9));
  const m = coil.getObjectByName('strand') as THREE.Mesh;
  m.geometry.setDrawRange(0, segs * (coil.userData.perSeg as number));
  const shown = segs / K129.seg;
  const tip = coil.getObjectByName('tip');
  if (tip) tip.position.copy(coilPoint(big, shown));
  return shown;
}

/**
 * 풀려 있는 줄의 경로(월드 좌표): 큰 통의 감긴 끝 → 앞쪽 가닥을 타고 아래로 → 도르래 밑을 반 바퀴 → 뒤쪽 가닥을 타고 위로 → 작은 통의 감긴 끝.
 * Rope(K129.rho).setPath() 에 그대로 넣는다. 도르래를 감는 호에는 검사 꼬리표(tagArc)가 달려 있다.
 */
export function windlassRopePath129(st: Windlass129): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const axis = new THREE.Vector3(0, K129.YA, K129.ZC);
  const world = (big: boolean, s: number): THREE.Vector3 => coilPoint(big, s).applyAxisAngle(new THREE.Vector3(1, 0, 0), -st.beta).add(axis);
  const q1 = Math.floor(st.n1 * K129.seg + 1e-9) / K129.seg;
  const k1 = Math.max(1, Math.ceil((st.n1 - q1) * K129.seg * 2));
  for (let i = 0; i < k1; i++) pts.push(world(true, q1 + ((st.n1 - q1) * i) / k1));
  pts.push(st.topA.clone());
  pts.push(new THREE.Vector3(st.topA.x, st.block.y, st.topA.z));
  const ex = new THREE.Vector3(st.topB.x - st.topA.x, 0, st.topB.z - st.topA.z).normalize();
  const ey = new THREE.Vector3(0, 1, 0);
  const arc: THREE.Vector3[] = [];
  const NA = 28;
  for (let i = 1; i < NA; i++) {
    const a = Math.PI + (Math.PI * i) / NA;
    arc.push(st.block.clone().addScaledVector(ex, RPE * Math.cos(a)).addScaledVector(ey, RPE * Math.sin(a)));
  }
  tagArc(arc, { c: st.block, r: RPE, ccw: true, axis: ex.clone().cross(ey), wheel: 'sheave', src: 'windlassRopePath129' });
  pts.push(...arc);
  pts.push(new THREE.Vector3(st.topB.x, st.block.y, st.topB.z));
  pts.push(st.topB.clone());
  const q2 = Math.floor(st.n2 * K129.seg + 1e-9) / K129.seg;
  const k2 = Math.max(1, Math.ceil((st.n2 - q2) * K129.seg * 2));
  for (let i = 1; i <= k2; i++) pts.push(world(false, st.n2 - ((st.n2 - q2) * i) / k2));
  return pts;
}

/**
 * 차동 통(129번 구동): 한 축에 큰 통(왼쪽)과 작은 통(오른쪽) + 플랜지 셋 + 오른쪽 끝의 크랭크 손잡이(판화에 없음).
 * **원점 = 축 위 가운데 플랜지 중심**, 회전축 = 로컬 X. 모델이 (0, K129.YA, K129.ZC) 에 놓고 rotation.x = −beta.
 * 축 양 끝은 x = ±1.3(기둥 구멍을 지나감). 크랭크 팔은 x = 1.33 ~ 1.38, 손잡이 끝 x = 1.64, 팔 길이 0.3.
 * mm.kind = 'drum' (바퀴 개수에 들지 않는다).
 */
export function diffBarrel129(): THREE.Group {
  const g = new THREE.Group();
  const { R1, R2, fl1, fl2, barrelL, flT } = K129;
  const woodMat = wood(0xb98a55);
  const iron = castIron();
  g.add(mesh(cylX(0.05, 2.6), steel()));
  g.add(meshAt(cylX(R1, barrelL - flT, 48), woodMat, -(barrelL + flT) / 2, 0, 0));
  g.add(meshAt(cylX(R2, barrelL - flT, 40), woodMat, (barrelL + flT) / 2, 0, 0));
  g.add(meshAt(cylX(fl1, 2 * flT, 48), iron, -barrelL - flT, 0, 0));
  g.add(meshAt(cylX(fl1, 2 * flT, 48), iron, 0, 0, 0));
  g.add(meshAt(cylX(fl2, 2 * flT, 40), iron, barrelL + flT, 0, 0));
  // 회전이 보이게: 플랜지 옆면·통 겉의 밝은 표시
  g.add(meshAt(new THREE.BoxGeometry(0.012, 0.1, 0.03), paint(0xf2b619), -barrelL - 2 * flT - 0.004, fl1 * 0.75, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.01, 0.03), paint(0xf2b619), -0.2, R1 + 0.003, 0));
  // 크랭크(판화에 없음)
  const crank = new THREE.Group();
  crank.name = 'crank';
  crank.add(meshAt(new THREE.BoxGeometry(0.05, 0.36, 0.07), darkSteel(), 1.355, 0.15, 0));
  crank.add(meshAt(cylX(0.075, 0.07), darkSteel(), 1.355, 0, 0));
  crank.add(meshAt(cylX(0.032, 0.27, 20), wood(), 1.51, 0.3, 0));
  g.add(crank);
  setMM(g, { kind: 'drum', axis: 'x', r1: R1, r2: R2, span: [-barrelL - 2 * flT, barrelL + 2 * flT] });
  return g;
}

/**
 * 윈들러스 틀(고정): 세로 기둥 둘(축 구멍이 **X 방향**으로 뚫린 널) + 바깥 발 + 뒤쪽 아래 가로 널. 나무. **원점 = 월드 원점**.
 * 기둥: x = ±postX(두께 postT), z = ZC ± 0.25, y = yBottom ~ yTop, 구멍 중심 (YA, ZC) 반지름 0.058(축 0.05).
 * 가로 널: x −1.15 ~ 1.15, y yBottom ~ 0.7, z 0.05 ~ 0.09 (기둥 뒤 가장자리에 붙음). 발: 기둥 바깥 0.3 × 0.1.
 */
export function windlassFrame129(yBottom = 0.18, yTop = 3.22): THREE.Group {
  const g = new THREE.Group();
  const w = wood();
  const { postX, postT, YA, ZC } = K129;
  for (const sx of [-1, 1]) {
    // 단면(로컬 u = −z 쪽, v = y) 을 X 로 눌러 낸다
    const shape = roundedRect(-0.25, yBottom, 0.25, yTop, 0.03);
    shape.holes.push(circlePath(0, YA, 0.058));
    const geo = extrude(shape, postT, 0.006);
    geo.rotateY(Math.PI / 2);
    g.add(meshAt(geo, w, sx * postX, 0, ZC));
    g.add(meshAt(new THREE.BoxGeometry(0.3, 0.1, 0.4), w, sx * (postX + postT / 2 + 0.15), yBottom + 0.05, ZC));
  }
  const railTop = 0.7;
  g.add(meshAt(new THREE.BoxGeometry(2 * (postX - postT / 2), railTop - yBottom, 0.04), wood(0x9a6f45), 0, (railTop + yBottom) / 2, ZC - 0.25 + 0.02));
  setMM(g, { kind: 'frame', of: 'windlass' });
  return g;
}

/**
 * 갈고리 달린 움직도르래(129번): 홈 바퀴(로프 홈) + 앞뒤 띠쇠 + 아래 멍에 + 갈고리.
 * **원점 = 바퀴 중심**, 회전축 = 로컬 Z. 바퀴는 userData.sheave (name 'sheave') — 모델이 sheave.rotation.z = spin.
 * 그룹은 rotation.y = yaw 로 비스듬히 세운다. 갈고리 맨 아래 = 로컬 y −0.862.
 */
export function hookBlock129(): THREE.Group {
  const g = new THREE.Group();
  const r = K129.RP;
  const width = 0.16;
  const sheave = pulley(r, { width, spokes: 0 });
  sheave.name = 'sheave';
  g.add(sheave);
  g.userData.sheave = sheave;
  const iron = castIron();
  const yoke = -(r + 0.07);
  for (const sz of [-1, 1]) {
    const z = sz * (width / 2 + 0.035);
    g.add(meshAt(new THREE.BoxGeometry(0.2, -yoke, 0.02), iron, 0, yoke / 2, z));
    g.add(meshAt(cylZ(0.1, 0.02, 32), iron, 0, 0, z));
  }
  g.add(mesh(cylZ(0.03, width + 0.12), steel()));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.08, width + 0.09), iron, 0, yoke - 0.04, 0));
  g.add(meshAt(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 20), darkSteel(), 0, yoke - 0.11, 0));
  const hookR = 0.06;
  const hookGeo = new THREE.TorusGeometry(hookR, 0.022, 12, 30, Math.PI * 1.5);
  hookGeo.rotateZ(Math.PI);
  g.add(meshAt(hookGeo, darkSteel(), 0, yoke - 0.14 - hookR, 0));
  setMM(g, { kind: 'block', r, width, hookDown: 0.352 });
  return g;
}

// ═════════════════════════ 130: 쇠판 자르는 가위 ═════════════════════════

/** 130번 치수. 좌표는 위 날의 받침 핀 P 가 원점 */
export const K130 = {
  /** 캠 축의 자리(P 기준) */
  S: [-1.76, -0.406] as V2,
  /** 편심 원판 반지름·편심량 */
  r: 0.364,
  e: 0.232,
  /** 캠 축 반지름 */
  shaftR: 0.055,
  /** P 에서 긴 팔 밑면(곧은 선)까지의 수직 거리 */
  h: 0.274,
  /** 벌어졌을 때(판화) 윗날 선의 각(도) — 날 선은 P 를 지나는 반지름 선 */
  openDeg: 16.5,
  /** 받침 윗면의 y, 받침의 x 범위(P 기준) */
  baseTop: -0.74,
  baseX0: -1.18,
  baseX1: 1.25,
  /** 받침 핀 구멍 반지름 */
  pinR: 0.045
} as const;

export interface Shear130 {
  /** 편심 원판 중심의 방향각(rad) = 캠 그룹의 rotation.z. 시계 방향으로 돌므로 줄어든다 */
  psi: number;
  /** 위 날의 회전각(rad) = 위 날 그룹의 rotation.z. 0 = 판화 자세(벌어짐), 음수 = 긴 팔이 올라가고 날이 닫힘 */
  gamma: number;
  /** 윗날 선이 수평과 이루는 각(도). 16.5(벌어짐) ~ 0.7(닫힘) */
  bladeDeg: number;
}

/** 캠 중심 방향각 psi 일 때 위 날의 회전각(밑면이 원판 꼭대기에 접한다 — 닫힌 식) */
export function leverAngle130(psi: number): number {
  const Dx = K130.S[0] + K130.e * Math.cos(psi);
  const Dy = K130.S[1] + K130.e * Math.sin(psi);
  const g = Math.atan2(Dy, Dx) - Math.PI - Math.asin((K130.h + K130.r) / Math.hypot(Dx, Dy));
  return Math.atan2(Math.sin(g), Math.cos(g));
}

/** 130번 운동식. theta = 구동 누적각(캠 시계 방향). theta = 1.6(t = 1)에서 판화 자세(원판 중심이 축 바로 아래, 날 벌어짐) */
export function shear130(theta: number): Shear130 {
  const psi = -Math.PI / 2 - (theta - 1.6);
  const gamma = leverAngle130(psi);
  return { psi, gamma, bladeDeg: K130.openDeg + gamma / DEG };
}

/** 위 날(지레)의 윤곽 — 판화 자세, P 기준, 반시계. 밑면은 y = −h 의 곧은 선(x −2.22 ~ 0.09), 날 선은 P 에서 openDeg 로 뻗은 선(x 0.39 ~ 1.3) */
export function upperOutline130(): V2[] {
  const k = 0.002;
  const t = Math.tan(K130.openDeg * DEG);
  const pts: V2[] = [
    [-2.22, -K130.h],
    [0.09, -K130.h],
    [80 * k, -120 * k],
    [115 * k, -45 * k],
    [150 * k, 10 * k],
    [0.39, 0.39 * t],
    [1.3, 1.3 * t]
  ];
  const top: V2[] = [
    [660, 205],
    [640, 232],
    [605, 255],
    [505, 295],
    [365, 285],
    [65, 250],
    [-35, 225],
    [-85, 155],
    [-125, 85],
    [-185, 35],
    [-285, 10],
    [-535, -15],
    [-965, -65],
    [-1110, -85],
    [-1132, -100],
    [-1135, -118],
    [-1125, -132]
  ];
  for (const [x, y] of top) pts.push([x * k, y * k]);
  return pts;
}

/** 아래 날 + 받침 기둥(한 몸, 고정)의 윤곽 — P 기준, 반시계. 아래 날 선: (0.41, 0.09) → (1.31, 0.04). 밑변 y = baseTop */
export function lowerOutline130(): V2[] {
  return [
    [-0.35, K130.baseTop],
    [0.39, K130.baseTop],
    [0.28, -0.64],
    [0.22, -0.52],
    [0.24, -0.4],
    [0.36, -0.3],
    [0.6, -0.24],
    [1.0, -0.19],
    [1.28, -0.06],
    [1.33, 0.0],
    [1.31, 0.04],
    [0.41, 0.09],
    ...arcDeg(0, 0, 0.2, 25, 150, 10),
    [-0.244, -0.05],
    [-0.244, -0.6],
    [-0.27, -0.68]
  ];
}

/**
 * 편심 캠(130번 구동): 둥근 원판을 중심에서 e 만큼 벗어난 자리에서 축에 꿴 것. **원점 = 축**, 원판 중심 = 로컬 (e, 0),
 * 회전축 = 로컬 Z, 두께 가운데 z = 0. 청동. userData.outline = 바깥 원(96점). 모델이 rotation.z = psi.
 */
export function eccentricCam130(thick = 0.1): THREE.Group {
  const g = new THREE.Group();
  const outline: V2[] = [];
  for (let i = 0; i < 96; i++) outline.push([K130.e + K130.r * Math.cos((i / 96) * TAU), K130.r * Math.sin((i / 96) * TAU)]);
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, K130.shaftR));
  g.add(mesh(extrude(shape, thick, 0.008, 48), bronze({ roughness: 0.36 })));
  const hub = lathe(tubeProfile(K130.shaftR, K130.shaftR * 1.9, -thick / 2 - 0.02, thick / 2 + 0.02, 0.008), 36);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, bronze({ roughness: 0.3 })));
  g.add(meshAt(cylZ(0.024, 0.01), paint(0xf2b619), K130.e + K130.r * 0.8, 0, thick / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', shape: 'eccentric', r: K130.r, e: K130.e, width: thick, axis: 'z' });
  return g;
}

/**
 * 위 날(130번 종동 지레): 긴 팔(왼쪽) + 날(오른쪽)이 한 몸. **원점 = 받침 핀 P**, 회전축 = 로컬 Z, 두께 가운데 z = 0. 강.
 * userData.outline = upperOutline130(). 모델이 rotation.z = gamma. 날 선에는 밝은 강 띠.
 */
export function shearUpper130(thick = 0.1): THREE.Group {
  const g = new THREE.Group();
  const outline = upperOutline130();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, K130.pinR));
  g.add(mesh(extrude(shape, thick, 0.008), steel()));
  // 날 선 띠(날 뒷면 쪽 — 아래 날과 맞닿는 면)
  const a = K130.openDeg * DEG;
  const edge = mesh(new THREE.BoxGeometry(0.9 / Math.cos(a), 0.02, 0.012), paint(0xd9dde2));
  edge.position.set(0.85, 0.85 * Math.tan(a) + 0.012, thick / 2 + 0.002);
  edge.rotation.z = a;
  g.add(edge);
  g.userData.outline = outline;
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [-2.27, -0.236, 0], width: thick });
  return g;
}

/**
 * 아래 날과 받침 기둥(130번 고정): **원점 = 받침 핀 P**, 두께 가운데 z = 0. 주철. 밑변(y = baseTop)이 받침 윗면에 앉는다.
 * 윤곽은 userData 에 남기지 않는다(위 날과 층이 달라 겹쳐 지나가는 것이 정상).
 */
export function shearLower130(thick = 0.1): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(lowerOutline130());
  shape.holes.push(circlePath(0, 0, K130.pinR));
  g.add(mesh(extrude(shape, thick, 0.008), castIron()));
  const edge = mesh(new THREE.BoxGeometry(0.9, 0.02, 0.012), paint(0xd9dde2));
  edge.position.set(0.86, 0.065 - 0.012, thick / 2 + 0.002);
  edge.rotation.z = Math.atan2(-0.05, 0.9);
  g.add(edge);
  setMM(g, { kind: 'frame', of: 'shear' });
  return g;
}

/**
 * 가위 받침(130번 고정 — 판화의 빗금 친 바닥): 상자. **원점 = 받침 핀 P**(아래 날과 같은 자리에 놓는다).
 * x = baseX0 ~ baseX1, 윗면 y = baseTop, 아래로 height, 깊이 depth(가운데 z = 0). 주철.
 */
export function shearBase130(height: number, depth = 0.5): THREE.Group {
  const g = new THREE.Group();
  const w = K130.baseX1 - K130.baseX0;
  g.add(meshAt(new THREE.BoxGeometry(w, height, depth), castIron({ roughness: 0.8 }), (K130.baseX0 + K130.baseX1) / 2, K130.baseTop - height / 2, 0));
  setMM(g, { kind: 'frame', of: 'shearBase' });
  return g;
}

/** 받침 핀(130번): Z 방향 핀 + 양 끝 머리. **원점 = 핀 가운데**. len = 두 판 두께의 합 + 여유. 강 */
export function pivotPin130(len = 0.26): THREE.Group {
  const g = new THREE.Group();
  const body = lathe(rodProfile(K130.pinR - 0.002, -len / 2, len / 2, 0.006, 0.006), 28);
  body.rotateX(Math.PI / 2);
  g.add(mesh(body, steel()));
  for (const sz of [-1, 1]) g.add(meshAt(cylZ(K130.pinR * 1.7, 0.02), darkSteel(), 0, 0, sz * (len / 2 - 0.01)));
  setMM(g, { kind: 'pin', point: [0, 0, 0] });
  return g;
}
