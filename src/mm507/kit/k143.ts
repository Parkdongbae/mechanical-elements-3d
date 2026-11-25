// 번호 전용 키트 (507 · 143~145번)
//  143 웜 축으로 왕복시키는 장치: 고정 틀(기둥 2 + 가로 막대), 이동 틀(슬리브 + 귀 2개 + 바퀴 축), 키 홈 축 + 풀리, 손목 핀 달린 웜 바퀴
//  144 레이지 통즈: 구멍 뚫린 링크 막대, 눈 달린 끝 막대, 받침 기둥(고정 핀)
//  145 빔·레버·크랭크·플라이휠: 플라이휠, 크랭크 팔, 빔, 미끄럼 받침대, 바닥 단(구덩이 옆) + 안내 레일
// 치수 상수(K143·K144·K145)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s143.mjs 등)가 같은 식을 쓴다.
// 공용 키트는 고치지 않는다. 모델은 '../kit/k143' 에서 직접 import 한다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, circlePath, extrude, hexPrism, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';
import { pulley } from './pulley';
import { solidWormWheel, wormSection } from './k104';

export { solidWormWheel, wormSection };

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
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/**
 * (z, y) 평면의 윤곽을 X 방향으로 두께 t 만큼 압출한다(가운데 x = 0). 구멍은 (z, y) 중심·반지름.
 * 가로축이 지나는 기둥·귀를 "구멍이 축 방향"으로 만들 때 쓴다.
 */
function extrudeX(ptsZY: V2[], t: number, holes: { z: number; y: number; r: number }[] = [], c = 0.006): THREE.BufferGeometry {
  const sh = shapeFrom(ptsZY.map(([z, y]) => [-z, y] as V2));
  // 모따기(c)는 앞뒤 면에서 구멍을 c 만큼 좁힌다 → 구멍을 c 만큼 키워 면에서의 반지름이 h.r 이 되게 한다
  for (const h of holes) sh.holes.push(circlePath(-h.z, h.y, h.r + c));
  const geo = extrude(sh, t, c, 28);
  geo.rotateY(Math.PI / 2); // (x, y, z) → (z, y, −x): 윤곽의 −z 가 다시 +z 로, 압출 방향이 X 로
  return geo;
}

/** 이름만 있는 핀 표식(검사 선언 links·gain 용) */
function pinMarker(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

// ═══════════════════════════ 공용: 구멍 뚫린 링크 막대 ═══════════════════════════

export interface LinkBarOpts {
  /** 구멍 자리(로컬 x). 기본 [0, length] */
  holes?: number[];
  /** 막대 반폭. 기본 0.03 */
  half?: number;
  /** 두께(z). 기본 0.04 */
  thick?: number;
  /** 핀 구멍 반지름. 기본 0.024 */
  holeR?: number;
  /** 구멍 둘레 눈(고리) 바깥 반지름. half 보다 크면 구멍 자리가 둥글게 넓어진다. 기본 half. 반드시 holeR + 0.012 이상 */
  eyeR?: number;
  /** 재질. 기본 'steel' */
  mat?: 'steel' | 'brass' | 'bronze' | 'iron';
  /** 리벳(핀)을 꽂을 구멍 번호들 — 이 막대와 한 몸으로 움직인다 */
  pins?: number[];
  /** 리벳의 로컬 z 범위 [뒤, 앞]. 기본 [−thick/2 − 0.01, thick/2 + 0.01] */
  pinZ?: [number, number];
  /** 구멍 번호별 핀 표식 이름(검사 선언용). 없는 번호는 표식을 만들지 않는다 */
  names?: (string | undefined)[];
  /** 핀 표식의 로컬 z. 기본 0 */
  markZ?: number;
}

/**
 * 링크 막대: 원점 = 첫 구멍 중심, +X 로 length 떨어진 곳이 끝 구멍. 두께 가운데 z = 0.
 * 구멍은 실제로 뚫려 있다(핀이 막대 살에 박히지 않는다). 겹쳐 지나가는 막대끼리는 층(z)이 다르므로 윤곽(userData.outline)은 남기지 않는다.
 */
export function linkBar(length: number, o: LinkBarOpts = {}): THREE.Group {
  const holes = o.holes ?? [0, length];
  const half = o.half ?? 0.03;
  const thick = o.thick ?? 0.04;
  const holeR = o.holeR ?? 0.024;
  const eyeR = o.eyeR ?? half;
  const mat = o.mat === 'brass' ? brass() : o.mat === 'bronze' ? bronze({ roughness: 0.36 }) : o.mat === 'iron' ? castIron() : steel();
  const g = new THREE.Group();
  // 윤곽: 구멍마다 반지름 eyeR 의 눈, 그 사이는 반폭 half 의 곧은 살(eyeR = half 면 보통의 둥근 끝 막대). 반시계
  const er = Math.max(eyeR, half);
  const a = Math.asin(Math.min(1, half / er));
  const pts: V2[] = [];
  const arcTo = (cx: number, a0: number, a1: number): void => {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 14)));
    for (let k = 0; k <= n; k++) {
      const t = a0 + ((a1 - a0) * k) / n;
      pts.push([cx + er * Math.cos(t), er * Math.sin(t)]);
    }
  };
  const last = holes.length - 1;
  arcTo(holes[0] ?? 0, a, TAU - a);
  for (let i = 1; i < last; i++) arcTo(holes[i]!, Math.PI + a, TAU - a);
  arcTo(holes[last] ?? length, Math.PI + a, 3 * Math.PI - a);
  for (let i = last - 1; i >= 1; i--) arcTo(holes[i]!, a, Math.PI - a);
  const sh = shapeFrom(pts);
  for (const x of holes) sh.holes.push(circlePath(x, 0, holeR + 0.004)); // 모따기 0.004 만큼 키움(앞뒤 면에서 holeR)
  g.add(mesh(extrude(sh, thick, 0.004, 24), mat));
  g.add(boxAt(Math.min(0.3, length * 0.2), 0.01, 0.005, paint(MARK), ((holes[0] ?? 0) + (holes[1] ?? length)) / 2, 0, thick / 2 + 0.001)); // 표시 줄
  const pz = o.pinZ ?? [-thick / 2 - 0.01, thick / 2 + 0.01];
  for (const i of o.pins ?? []) {
    const x = holes[i];
    if (x === undefined) continue;
    g.add(meshAt(cylZ(holeR - 0.002, pz[0], pz[1], 0.004), darkSteel(), x, 0, 0));
    g.add(meshAt(cylZ(holeR + 0.012, pz[1], pz[1] + 0.012, 0.004), darkSteel(), x, 0, 0));
    g.add(meshAt(cylZ(holeR + 0.012, pz[0] - 0.012, pz[0], 0.004), darkSteel(), x, 0, 0));
  }
  (o.names ?? []).forEach((nm, i) => {
    const x = holes[i];
    if (nm !== undefined && x !== undefined) g.add(pinMarker(nm, x, 0, o.markZ ?? 0));
  });
  setMM(g, { kind: 'link', fn: 'linkBar', length, a: [0, 0, 0], b: [length, 0, 0], holes });
  return g;
}

// ═══════════════════════════ 143 웜 축으로 왕복시키는 장치 ═══════════════════════════

const N143 = 20;
const M143 = 0.04;
const R143 = (N143 * M143) / 2;
const PITCH143 = Math.PI * M143;
/** 웜 한 바퀴 = theta 의 1/G: 웜 각 = G·theta (웜이 빨리 돌아야 왕복이 보인다) */
const G143 = 8;
/** 판화 자세(t = 1, theta = 1.6)의 손목 핀 방향(바퀴 중심에서 왼쪽 아래) */
const POSE143 = 230 * DEG;

/** 143번 치수(월드 좌표). 판화 4배 확대에서 잰 비: 바퀴 바깥 반지름 46, 손목 핀 반지름 26, 연결봉 197, 축 사이 61 (px) */
export const K143 = {
  N: N143,
  m: M143,
  /** 바퀴 피치 반지름 */
  R: R143,
  pitch: PITCH143,
  wormRoot: 0.06,
  wormOuter: 0.15,
  wormRp: 0.11,
  wormLen: 0.44,
  wheelW: 0.08,
  /** 축 사이 거리 = R + wormRp */
  centre: R143 + 0.11,
  /** 웜 바퀴 비틀림: 오른나사 웜이 위(+Y)에 있을 때 −tan(리드각) */
  tanLead: -PITCH143 / (TAU * 0.11),
  /** 웜 각 = G·theta */
  G: G143,
  /** 가로 막대·바퀴 축 높이 */
  BY: 0.8,
  /** 웜 축 높이 = BY + centre */
  SY: 0.8 + R143 + 0.11,
  /** 웜·바퀴의 가운데 평면 */
  ZW: 0.14,
  /** 가로 막대의 가운데 평면(바퀴 뒤) */
  ZB: -0.12,
  /** 연결봉의 가운데 평면(바퀴 앞) */
  ZROD: 0.25,
  shaftR: 0.04,
  /** 손목 핀 반지름(바퀴 중심 ~ 핀) */
  crank: 0.24,
  /** 연결봉 핀 사이 길이 */
  rod: 1.81,
  /** 오른쪽 기둥의 고정 핀 */
  FX: 1.76,
  FY: 0.875,
  /** 바퀴 위 손목 핀의 로컬 각: t = 1 에 판화 자세가 되게 */
  pinLocal: POSE143 - (Math.PI / 2 - PITCH143 / (2 * R143) + (G143 * 1.6) / N143),
  postL: [-1.64, -1.44] as const,
  postR: [1.64, 1.88] as const,
  postTop: 1.5,
  postZ: [-0.21, 0.215] as const,
  barH: 0.2,
  barD: 0.1,
  sleeveLen: 1.08,
  floor: 0.18,
  pulleyX: -1.84,
  pulleyR: 0.38,
  pulleyW: 0.18
} as const;

export interface Traverse143 {
  /** 웜·축의 회전각(rotation.x) */
  phi: number;
  /** 바퀴 회전각(rotation.z) */
  beta: number;
  /** 손목 핀의 방향각(월드) */
  a: number;
  /** 이동 틀(바퀴 축·웜 가운데)의 x */
  x: number;
  /** 손목 핀의 월드 좌표 */
  pin: V2;
  /** 연결봉 각(손목 핀 → 고정 핀) */
  rodAngle: number;
  /** 행정 진행 0(왼쪽 끝) ~ 1(오른쪽 끝) */
  s: number;
}

/** 143번 이동 틀의 왼쪽·오른쪽 끝(x) — 손목 핀·바퀴 중심·고정 핀이 한 줄일 때 */
export const X143 = (() => {
  const C = K143;
  const dy = C.FY - C.BY;
  // 바퀴 중심에서 고정 핀까지의 거리가 rod ± crank 일 때가 양 끝
  const far = C.FX - Math.sqrt((C.rod + C.crank) ** 2 - dy * dy);
  const near = C.FX - Math.sqrt((C.rod - C.crank) ** 2 - dy * dy);
  return { min: far, max: near, stroke: near - far };
})();

/**
 * 143번 닫힌 식. 웜은 이동 틀과 같이 움직이므로(바퀴 바로 위) 물림 식에 x 가 들지 않는다:
 *   beta = π/2 − pitch/(2R) + phi/N   (kit wormScrew 오른나사 × solidWormWheel, k104 와 같은 위상)
 * 이동 틀의 x 는 손목 핀과 고정 핀 사이가 연결봉 길이라는 조건에서 나온다(치우친 슬라이더-크랭크의 뒤집힌 꼴).
 */
export function traverse143(theta: number): Traverse143 {
  const C = K143;
  const phi = C.G * theta;
  const beta = Math.PI / 2 - C.pitch / (2 * C.R) + phi / C.N;
  const a = beta + C.pinLocal;
  const px = C.crank * Math.cos(a);
  const py = C.crank * Math.sin(a);
  const dy = C.FY - C.BY - py;
  const x = C.FX - px - Math.sqrt(C.rod * C.rod - dy * dy);
  const pin: V2 = [x + px, C.BY + py];
  return { phi, beta, a, x, pin, rodAngle: Math.atan2(C.FY - pin[1], C.FX - pin[0]), s: (x - X143.min) / X143.stroke };
}

/**
 * 손목 핀이 달린 웜 바퀴(143): solidWormWheel + 앞면의 손목 핀. 축 = 로컬 Z, 원점 = 바퀴 중심(폭 가운데).
 * child 'wristPin' = 연결봉 평면의 핀 중심 표식. 윤곽은 solidWormWheel 의 userData.outline 그대로.
 */
export function crankWormWheel143(): THREE.Group {
  const C = K143;
  const g = solidWormWheel(C.N, C.m, { width: C.wheelW, tanLead: C.tanLead, boreR: 0.045 });
  const px = C.crank * Math.cos(C.pinLocal);
  const py = C.crank * Math.sin(C.pinLocal);
  const zTop = C.ZROD - C.ZW + 0.04;
  g.add(meshAt(cylZ(0.055, C.wheelW / 2 - 0.002, C.wheelW / 2 + 0.012, 0.004), darkSteel(), px, py, 0)); // 핀 뿌리 턱
  g.add(meshAt(cylZ(0.03, C.wheelW / 2, zTop, 0.006), steel(), px, py, 0));
  g.add(meshAt(cylZ(0.016, zTop, zTop + 0.004, 0), paint(MARK), px, py, 0));
  g.add(pinMarker('wristPin', px, py, C.ZROD - C.ZW));
  return g;
}

/**
 * 고정 틀(143): 바닥에 선 기둥 2개(웜 축이 지나는 구멍은 X 방향으로 뚫려 있다) + 그 사이의 가로 막대 + 왼쪽 기둥의 받침 발
 * + 오른쪽 기둥 앞면의 고정 핀. 좌표는 월드 그대로(원점에 놓는다). child 'fixedPin' = 연결봉 평면의 고정 핀 표식.
 */
export function fixedFrame143(): THREE.Group {
  const C = K143;
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.62 });
  const prof: V2[] = [
    [C.postZ[0], C.floor],
    [C.postZ[1], C.floor],
    [C.postZ[1], C.postTop],
    [C.postZ[0], C.postTop]
  ];
  for (const [x0, x1] of [C.postL, C.postR]) {
    g.add(meshAt(extrudeX(prof, x1 - x0, [{ z: C.ZW, y: C.SY, r: C.shaftR + 0.004 }]), iron, (x0 + x1) / 2, 0, 0));
  }
  // 가로 막대: 두 기둥의 안쪽 면 사이
  const bx0 = C.postL[1];
  const bx1 = C.postR[0];
  g.add(boxAt(bx1 - bx0, C.barH, C.barD, steel(), (bx0 + bx1) / 2, C.BY, C.ZB));
  // 왼쪽 기둥의 받침 발(판화의 곡선 삼각 받침)
  const foot: V2[] = [[C.postL[0], C.floor]];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    foot.push([C.postL[0] - 0.3 * (1 - t) ** 2, C.floor + 0.4 * t]);
  }
  g.add(meshAt(extrude(shapeFrom(foot), 0.14, 0.006), iron, 0, 0, 0));
  // 고정 핀: 오른쪽 기둥 앞면에서 연결봉을 꿰고 나온다
  g.add(meshAt(cylZ(0.03, C.postZ[1] - 0.002, C.ZROD + 0.04, 0.006), steel(), C.FX, C.FY, 0));
  g.add(meshAt(cylZ(0.016, C.ZROD + 0.04, C.ZROD + 0.044, 0), paint(MARK), C.FX, C.FY, 0));
  g.add(pinMarker('fixedPin', C.FX, C.FY, C.ZROD));
  g.userData.outlines = {
    // 두 기둥 사이의 빈 곳 — 웜 바퀴 윤곽과 웜 단면이 늘 이 안에 있어야 한다(이동 틀이 기둥에 부딪치지 않음)
    frameHole: [
      [bx0, C.floor],
      [bx1, C.floor],
      [bx1, C.postTop + 0.3],
      [bx0, C.postTop + 0.3]
    ] as V2[]
  };
  setMM(g, { kind: 'frame', fn: 'fixedFrame143' });
  return g;
}

/**
 * 이동 틀(143): 가로 막대를 감싼 네모 슬리브(구멍이 X 방향) + 바퀴 축과 그 턱 + 웜 양옆의 귀 2개(웜 축이 지나는 구멍이 X 방향).
 * 원점 = 바퀴 축 중심의 (x, y), z 는 월드 값 그대로 → 모델은 position.set(x, K143.BY, 0).
 * 귀는 바퀴 뒤에서 올라와 웜 높이에서 앞으로 나온다(ㄱ자) — 바퀴·웜에 닿지 않는다. child 'wheelAxis'.
 */
export function traversingFrame143(): THREE.Group {
  const C = K143;
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.5 });
  const bh = C.barH / 2;
  const bd = C.barD / 2;
  const wall = 0.041;
  const cl = 0.004;
  const ch = cl + 0.006; // 압출 모따기(0.006)가 끝 면에서 구멍을 좁히는 만큼 더 키운 구멍 치수
  const oy = bh + cl + wall;
  const z0 = C.ZB - bd - cl - wall;
  const z1 = C.ZB + bd + cl + wall;
  // 슬리브: (z, y) 네모 고리를 X 로 압출
  const outer = shapeFrom([
    [-z1, -oy],
    [-z0, -oy],
    [-z0, oy],
    [-z1, oy]
  ]);
  outer.holes.push(
    pathFrom([
      [-(C.ZB + bd + ch), -(bh + ch)],
      [-(C.ZB + bd + ch), bh + ch],
      [-(C.ZB - bd - ch), bh + ch],
      [-(C.ZB - bd - ch), -(bh + ch)]
    ])
  );
  const sl = extrude(outer, C.sleeveLen, 0.006);
  sl.rotateY(Math.PI / 2);
  g.add(mesh(sl, iron));
  // 바퀴 축 턱 + 축(슬리브 앞면에서 바퀴를 꿰고 나온다)
  const hubBack = C.ZW - C.wheelW / 2 - 0.018;
  g.add(meshAt(cylZ(0.09, z1 - 0.002, hubBack, 0.006), iron, 0, 0, 0));
  g.add(meshAt(cylZ(0.042, hubBack - 0.002, C.ZW + C.wheelW / 2 + 0.03, 0.006), steel(), 0, 0, 0));
  // 귀 2개: ㄱ자 윤곽 (z, y)
  const earT = 0.07;
  const ex = C.wormLen / 2 + 0.012 + earT / 2;
  const top = C.centre + 0.15;
  const ear: V2[] = [
    [-0.12, oy - 0.004],
    [C.ZW - C.wheelW / 2 - 0.03, oy - 0.004],
    [C.ZW - C.wheelW / 2 - 0.03, C.centre - 0.11],
    [C.ZW + 0.13, C.centre - 0.11],
    [C.ZW + 0.13, top],
    [-0.12, top]
  ];
  for (const s of [-1, 1]) g.add(meshAt(extrudeX(ear, earT, [{ z: C.ZW, y: C.centre, r: C.shaftR + 0.004 }]), iron, s * ex, 0, 0));
  const ax = new THREE.Object3D();
  ax.name = 'wheelAxis';
  ax.position.set(0, 0, C.ZW);
  g.add(ax);
  setMM(g, { kind: 'carriage', fn: 'traversingFrame143', axis: 'x' });
  return g;
}

/**
 * 키 홈이 난 웜 축 + 왼쪽 끝의 벨트 풀리(143). 축 = 로컬 X, 원점 = 월드 x 0 의 축 중심 → 모델은 position.set(0, K143.SY, K143.ZW),
 * 매 프레임 rotation.x = phi. 노란 줄 = 키 홈(두 기둥 사이) — 축이 도는 것이 보인다. child 'pulley'.
 */
export function keyedShaft143(): THREE.Group {
  const C = K143;
  const g = new THREE.Group();
  g.add(mesh(cylX(C.shaftR, -2.0, 2.0, 0.008), steel()));
  // 키 홈 줄: 축 표면에 묻혀 0.001 만 나온다(귀·기둥 구멍 반지름 0.044 안)
  const kx0 = C.postL[1] + 0.03;
  const kx1 = C.postR[0] - 0.03;
  g.add(boxAt(kx1 - kx0, 0.008, 0.016, paint(MARK), (kx0 + kx1) / 2, C.shaftR - 0.003, 0));
  const p = pulley(C.pulleyR, { width: C.pulleyW, flat: true, spokes: 4, driver: true, hub: C.shaftR + 0.001 });
  p.name = 'pulley';
  p.rotation.y = Math.PI / 2;
  p.position.x = C.pulleyX;
  g.add(p);
  // 풀리 왼쪽의 너트
  const nut = hexPrism(0.11, 0.05, true, true, 0);
  nut.rotateZ(Math.PI / 2);
  g.add(meshAt(nut, darkSteel(), C.pulleyX - C.pulleyW / 2 - 0.01, 0, 0));
  setMM(g, { kind: 'shaft', axis: 'x', r: C.shaftR, fn: 'keyedShaft143' });
  return g;
}

// ═══════════════════════════ 144 레이지 통즈 ═══════════════════════════

const L144 = 0.5;
const A144_MIN = 55 * DEG;
const A144_MAX = 72 * DEG;
const D144_MAX = 2 * L144 * Math.cos(A144_MIN);
const D144_MIN = 2 * L144 * Math.cos(A144_MAX);
/** 판화 자세(막대 기울기 67°)의 칸 길이 */
const D144_POSE = 2 * L144 * Math.cos(67 * DEG);

/** 144번 치수. L = 가운데 핀에서 끝 핀까지(온 막대는 2L), d = 가운데 핀 사이의 칸 길이 = 2L·cos(막대 기울기) */
export const K144 = {
  L: L144,
  /** 고정 핀(받침 기둥 꼭대기) */
  XF: 0.85,
  CY: 1.3,
  dMin: D144_MIN,
  dMax: D144_MAX,
  dMid: (D144_MIN + D144_MAX) / 2,
  dAmp: (D144_MAX - D144_MIN) / 2,
  /** t = 1(theta 1.6)에 판화 자세가 되는 위상 */
  phase: Math.asin((D144_POSE - (D144_MIN + D144_MAX) / 2) / ((D144_MAX - D144_MIN) / 2)),
  /** 층(월드 z 가운데): '/' 막대, '\' 막대, 끝 막대의 눈, 받침 기둥 */
  zA: 0.02,
  zB: 0.07,
  zEye: 0.12,
  zPost: 0.22,
  barHalf: 0.03,
  barT: 0.04,
  holeR: 0.024,
  rodR: 0.034,
  /** 끝 막대 길이(눈 중심 ~ 막대 끝): 왼쪽(큰 운동)·오른쪽(작은 운동) */
  rodL: 1.15,
  rodRt: 0.56,
  /** 막대 안내(뒤판에서 나온 고리)의 x */
  guideL: -1.08,
  guideR: 1.604
} as const;

export interface LazyTongs144 {
  /** 칸 길이 */
  d: number;
  /** 막대 기울기(가로선에서) */
  alpha: number;
  /** 가운데 줄에서 위·아래 핀까지의 높이 */
  h: number;
  /** 가운데 줄의 핀 5개(월드 x): [왼쪽 끝, 교차 1, 교차 2, 고정 핀, 오른쪽 끝] */
  mid: number[];
  /** 위·아래 줄의 핀 4개(월드 x) */
  out: number[];
  /** 오른쪽 끝의 진행 0(가장 접힘) ~ 1(가장 펴짐) */
  s: number;
}

/**
 * 144번 닫힌 식: 오른쪽 끝 핀이 고정 핀에서 d, 왼쪽 끝 핀이 반대쪽으로 3d — 오른쪽이 Δ 가면 왼쪽은 반대 방향으로 3Δ.
 * d = dMid + dAmp·sin(theta − 1.6 + phase).
 */
export function lazyTongs144(theta: number): LazyTongs144 {
  const C = K144;
  const d = C.dMid + C.dAmp * Math.sin(theta - 1.6 + C.phase);
  const alpha = Math.acos(d / (2 * C.L));
  const h = C.L * Math.sin(alpha);
  const mid = [0, 1, 2, 3, 4].map((j) => C.XF + (j - 3) * d);
  const out = [0, 1, 2, 3].map((i) => C.XF + (i - 2.5) * d);
  return { d, alpha, h, mid, out, s: (d - C.dMin) / (C.dMax - C.dMin) };
}

export interface EyeRodOpts {
  /** 끝에 손잡이(판화 오른쪽 막대의 뾰족한 자루). 기본 false */
  knob?: boolean;
  /** 눈 핀의 로컬 z 범위 [뒤, 앞] */
  pinZ?: [number, number];
  /** 눈 핀 표식 이름 */
  name?: string;
  /** 핀 표식의 로컬 z. 기본 0 */
  markZ?: number;
}

/**
 * 눈 달린 끝 막대(144): 원점 = 눈(핀 구멍) 중심, 둥근 막대가 +X 로 len 까지. 눈 고리 + 네모 목(판화의 갈래 블록) + 막대 + 핀.
 * 왼쪽 막대는 rotation.z = π 로 돌려 쓴다. 두께 가운데 z = 0.
 */
export function eyeRod(len: number, o: EyeRodOpts = {}): THREE.Group {
  const C = K144;
  const g = new THREE.Group();
  const t = C.barT;
  g.add(mesh(tubeZ(C.holeR, 0.07, -t / 2, t / 2, 0.006), brass()));
  g.add(boxAt(0.1, 0.09, t, brass(), 0.112, 0, 0));
  g.add(mesh(cylX(C.rodR, 0.16, len, 0.006), steel()));
  if (o.knob === true) {
    const k = lathe(
      [
        [0, len - 0.002],
        [0.05, len - 0.002],
        [0.056, len + 0.03],
        [0.03, len + 0.11],
        [0, len + 0.12]
      ],
      24
    );
    k.rotateZ(-Math.PI / 2);
    g.add(mesh(k, wood()));
  }
  const pz = o.pinZ ?? [-t / 2 - 0.01, t / 2 + 0.01];
  g.add(mesh(cylZ(C.holeR - 0.002, pz[0], pz[1], 0.004), darkSteel()));
  g.add(mesh(cylZ(C.holeR + 0.012, pz[1], pz[1] + 0.012, 0.004), darkSteel()));
  g.add(mesh(cylZ(C.holeR + 0.012, pz[0] - 0.012, pz[0], 0.004), darkSteel()));
  if (o.name !== undefined) g.add(pinMarker(o.name, 0, 0, o.markZ ?? 0));
  setMM(g, { kind: 'rod', fn: 'eyeRod', axis: 'x', r: C.rodR, length: len });
  return g;
}

/**
 * 받침 기둥(144): 바닥에서 올라와 꼭대기 근처의 핀으로 통즈의 한 교차점을 붙든다. 원점 = 핀 중심 (x, y), z 는 월드 값.
 * 기둥은 막대들 앞(z = K144.zPost)에 서고 핀이 뒤로 막대 두 층을 꿴다. drop = 핀에서 바닥까지. child 'fixedPin'.
 */
export function pivotPost144(drop: number): THREE.Group {
  const C = K144;
  const g = new THREE.Group();
  const w = 0.135;
  const sh = shapeFrom([
    [-w, -drop],
    [w, -drop],
    [w, 0.1],
    [-w, 0.13]
  ]);
  sh.holes.push(circlePath(0, 0, C.holeR + 0.002 + 0.008));
  g.add(meshAt(extrude(sh, 0.12, 0.008), castIron({ roughness: 0.6 }), 0, 0, C.zPost));
  g.add(boxAt(0.36, 0.05, 0.2, castIron({ roughness: 0.6 }), 0, -drop + 0.025, C.zPost)); // 발판
  const zBack = C.zA - C.barT / 2 - 0.01;
  const zFront = C.zPost + 0.07;
  g.add(mesh(cylZ(C.holeR - 0.002, zBack, zFront, 0.004), steel()));
  g.add(mesh(cylZ(C.holeR + 0.014, zFront, zFront + 0.014, 0.004), darkSteel()));
  g.add(mesh(cylZ(C.holeR + 0.012, zBack - 0.012, zBack, 0.004), darkSteel()));
  g.add(pinMarker('fixedPin', 0, 0, (C.zA + C.zB) / 2));
  setMM(g, { kind: 'post', fn: 'pivotPost144' });
  return g;
}

// ═══════════════════════════ 145 빔·레버·크랭크·플라이휠 ═══════════════════════════

/** 145번 치수(월드 좌표). 판화 4배 확대 px × 0.002: 바퀴 반지름 440, 크랭크 145, 레버 1100(크랭크 핀 ~ 받침대 핀), 연결봉 자리 630, 연결봉 825, 빔 팔 625 */
export const K145 = {
  /** 플라이휠 축 */
  OX: -0.85,
  OY: 1.1,
  R: 0.88,
  rimIn: 0.74,
  wheelW: 0.1,
  crank: 0.29,
  /** 레버: 크랭크 핀 A ~ 받침대 핀 B */
  lever: 2.2,
  /** 레버 위 연결봉 자리 M: A 에서 */
  leverM: 1.26,
  /** 연결봉(M ~ 빔 끝 E) */
  rod: 1.65,
  /** 빔 받침 축 */
  PX: 1.37,
  PY: 2.76,
  /** 빔 팔(받침 축 ~ 끝 핀 E) */
  beam: 1.25,
  beamTail: 0.3,
  /** 바닥 단 윗면(판화의 바닥선) */
  floor: 0.49,
  /** 층(월드 z 가운데) */
  zWheel: 0,
  zCrank: 0.09,
  zLever: 0.15,
  zRod: 0.21,
  zBeam: 0.15,
  zStd: 0.07,
  /** t = 1(theta 1.6)의 크랭크 각 = 판화 자세(핀이 왼쪽) */
  pose: Math.PI
} as const;

export interface BeamCrank145 {
  /** 크랭크 각(rotation.z) */
  phi: number;
  /** 크랭크 핀 */
  A: V2;
  /** 받침대 핀(가로로만 움직임) */
  B: V2;
  /** 레버 위 연결봉 핀 */
  M: V2;
  /** 빔 끝 핀 */
  E: V2;
  /** 레버 각(A → B) */
  leverAngle: number;
  /** 연결봉 각(M → E) */
  rodAngle: number;
  /** 빔 각(받침 축 → E). 가로로 누웠을 때 π */
  beamAngle: number;
  /** 받침대 진행 0(왼쪽 끝) ~ 1(오른쪽 끝) */
  s: number;
}

/**
 * 145번 닫힌 식(크랭크 각이 매개변수). 레버 A–M–B 는 한 몸의 곧은 막대: A 는 크랭크 핀(원), B 는 받침대 핀(가로 직선),
 * M 은 그 사이의 점(납작한 타원꼴 길). 빔 끝 E 는 "M 에서 연결봉 길이" 원과 "받침 축에서 빔 팔 길이" 원의 교점(왼쪽 것).
 */
export function beamCrank145(theta: number): BeamCrank145 {
  const C = K145;
  const phi = theta - 1.6 + C.pose;
  const ax = C.crank * Math.cos(phi);
  const ay = C.crank * Math.sin(phi);
  const A: V2 = [C.OX + ax, C.OY + ay];
  const B: V2 = [C.OX + ax + Math.sqrt(C.lever * C.lever - ay * ay), C.OY];
  const f = C.leverM / C.lever;
  const M: V2 = [A[0] + f * (B[0] - A[0]), A[1] + f * (B[1] - A[1])];
  const dx = C.PX - M[0];
  const dy = C.PY - M[1];
  const d = Math.hypot(dx, dy);
  const a = (C.rod * C.rod - C.beam * C.beam + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, C.rod * C.rod - a * a));
  const c1: V2 = [M[0] + (a * dx) / d - (h * dy) / d, M[1] + (a * dy) / d + (h * dx) / d];
  const c2: V2 = [M[0] + (a * dx) / d + (h * dy) / d, M[1] + (a * dy) / d - (h * dx) / d];
  const E = c1[0] < c2[0] ? c1 : c2;
  let beamAngle = Math.atan2(E[1] - C.PY, E[0] - C.PX);
  if (beamAngle < 0) beamAngle += TAU;
  return {
    phi,
    A,
    B,
    M,
    E,
    leverAngle: Math.atan2(B[1] - A[1], B[0] - A[0]),
    rodAngle: Math.atan2(E[1] - M[1], E[0] - M[0]),
    beamAngle,
    s: (B[0] - (C.OX + C.lever - C.crank)) / (2 * C.crank)
  };
}

export interface FlywheelOpts {
  rimIn?: number;
  width?: number;
  spokes?: number;
  hubR?: number;
  bore?: number;
}

/** 플라이휠: 무거운 테 + 살(기본 4개) + 허브. 축 = 로컬 Z, 원점 = 중심(폭 가운데). 테 앞면에 노란 표시 */
export function flywheel(R: number, o: FlywheelOpts = {}): THREE.Group {
  const rimIn = o.rimIn ?? R * 0.84;
  const w = o.width ?? 0.1;
  const n = o.spokes ?? 4;
  const hubR = o.hubR ?? 0.13;
  const bore = o.bore ?? 0.052;
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.55 });
  g.add(mesh(tubeZ(rimIn, R, -w / 2, w / 2, 0.012, 96), iron));
  g.add(mesh(tubeZ(bore, hubR, -w / 2 - 0.02, w / 2 + 0.02, 0.008), darkSteel()));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const len = rimIn - hubR + 0.02;
    const sp = new THREE.BoxGeometry(len, 0.075, w * 0.5);
    sp.translate(hubR - 0.01 + len / 2, 0, 0);
    sp.rotateZ(a);
    g.add(mesh(sp, iron));
    const rib = new THREE.BoxGeometry(len - 0.02, 0.02, w * 0.66);
    rib.translate(hubR + len / 2, 0, 0);
    rib.rotateZ(a);
    g.add(mesh(rib, iron));
  }
  const mk = new THREE.BoxGeometry((R - rimIn) * 0.7, 0.03, 0.006);
  mk.translate((R + rimIn) / 2, 0, w / 2 + 0.002);
  mk.rotateZ(TAU / 8);
  g.add(mesh(mk, paint(MARK)));
  setMM(g, { kind: 'flywheel', fn: 'flywheel', r: R, width: w, axis: 'z' });
  return g;
}

/**
 * 크랭크 팔(145): 원점 = 축 중심, 팔은 +X 로 r, 끝에 앞으로 솟은 핀. 두께 가운데 z = 0(두께 0.04).
 * 허브 구멍(bore)은 축 끝 너트를 감쌀 만큼 크다. pinTop = 핀 끝의 로컬 z, pinZ = 레버 평면의 로컬 z. child 'crankPin'.
 */
export function crankArm(r: number, o: { bore?: number; pinTop?: number; pinZ?: number } = {}): THREE.Group {
  const bore = o.bore ?? 0.07;
  const pinTop = o.pinTop ?? 0.1;
  const g = new THREE.Group();
  const t = 0.04;
  const sh = stadiumShape(0, 0, r, 0, 0.055);
  sh.holes.push(circlePath(0, 0, bore + 0.005));
  g.add(mesh(extrude(sh, t, 0.005), bronze({ roughness: 0.36 })));
  g.add(mesh(tubeZ(bore, bore + 0.05, -t / 2, t / 2 + 0.006, 0.005), bronze({ roughness: 0.36 })));
  g.add(meshAt(cylZ(0.03, t / 2 - 0.002, pinTop, 0.006), steel(), r, 0, 0));
  g.add(meshAt(cylZ(0.016, pinTop, pinTop + 0.004, 0), paint(MARK), r, 0, 0));
  g.add(pinMarker('crankPin', r, 0, o.pinZ ?? 0.06));
  setMM(g, { kind: 'crank', fn: 'crankArm', r, axis: 'z' });
  return g;
}

/**
 * 빔(145): 원점 = 받침 축 구멍 중심, 팔은 +X 로 arm 길이(끝으로 갈수록 가늘다), −X 로 tail 만큼 가다 톱니꼴로 잘려 있다(판화의 잘린 끝).
 * 끝 핀은 빔에 박혀 앞으로 솟는다. 두께 가운데 z = 0(두께 0.05). child 'beamEnd'(연결봉 평면 로컬 z = pinZ).
 */
export function beam145(arm: number, tail: number, o: { bore?: number; pinTop?: number; pinZ?: number } = {}): THREE.Group {
  const bore = o.bore ?? 0.062;
  const pinTop = o.pinTop ?? 0.1;
  const t = 0.05;
  const g = new THREE.Group();
  const pts: V2[] = [
    [-tail, 0.135],
    [0, 0.15]
  ];
  const er = 0.075;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 - (Math.PI * i) / 12;
    pts.push([arm + er * Math.cos(a), er * Math.sin(a)]);
  }
  pts.push([0, -0.15], [-tail, -0.135], [-tail - 0.03, -0.07], [-tail + 0.02, 0], [-tail - 0.03, 0.07]);
  pts.reverse(); // 반시계
  const sh = shapeFrom(pts);
  sh.holes.push(circlePath(0, 0, bore + 0.006));
  g.add(mesh(extrude(sh, t, 0.006), castIron({ roughness: 0.55 })));
  g.add(mesh(tubeZ(bore, 0.16, -t / 2 - 0.01, t / 2 + 0.01, 0.008), darkSteel()));
  g.add(meshAt(cylZ(0.03, t / 2 - 0.002, pinTop, 0.006), steel(), arm, 0, 0));
  g.add(meshAt(cylZ(0.016, pinTop, pinTop + 0.004, 0), paint(MARK), arm, 0, 0));
  g.add(pinMarker('beamEnd', arm, 0, o.pinZ ?? 0.06));
  setMM(g, { kind: 'beam', fn: 'beam145', arm, axis: 'z' });
  return g;
}

/**
 * 미끄럼 받침대(145, 판화의 종 모양 작은 받침대): 원점 = 꼭대기 핀 중심, 발바닥은 y = −h. 몸통 두께 가운데 z = 0(두께 0.085).
 * 핀은 받침대에 박혀 앞으로 솟아 레버 끝 구멍을 꿴다. 발판 옆모습을 userData.outline 으로 남긴다(바닥 레일 구간 검사). child 'standardPin'.
 */
export function slidingStandard145(h: number, o: { pinTop?: number; pinZ?: number } = {}): THREE.Group {
  const pinTop = o.pinTop ?? 0.12;
  const t = 0.085;
  const g = new THREE.Group();
  const wb = 0.25;
  const fh = 0.05;
  const right: V2[] = [[wb, -h + fh]];
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    right.push([0.06 + (wb - 0.03 - 0.06) * (1 - u) ** 2.2, -h + fh + (h - fh - 0.06) * u]);
  }
  const pts: V2[] = [...right];
  for (let i = 0; i <= 10; i++) {
    const a = -0.2 + ((Math.PI + 0.4) * i) / 10;
    pts.push([0.075 * Math.cos(a), 0.075 * Math.sin(a)]);
  }
  for (let i = right.length - 1; i >= 0; i--) pts.push([-right[i]![0], right[i]![1]]);
  g.add(mesh(extrude(shapeFrom(pts), t, 0.008), castIron({ roughness: 0.6 })));
  const foot: V2[] = [
    [-wb, -h],
    [wb, -h],
    [wb, -h + fh],
    [-wb, -h + fh]
  ];
  const fm = meshAt(new THREE.BoxGeometry(2 * wb, fh, 0.2), castIron({ roughness: 0.6 }), 0, -h + fh / 2, 0);
  fm.userData.outline = foot;
  g.add(fm);
  g.add(mesh(cylZ(0.03, t / 2 - 0.002, pinTop, 0.006), steel()));
  g.add(mesh(cylZ(0.016, pinTop, pinTop + 0.004, 0), paint(MARK)));
  g.add(pinMarker('standardPin', 0, 0, o.pinZ ?? 0.08));
  setMM(g, { kind: 'slider', fn: 'slidingStandard145', axis: 'x', h });
  return g;
}

export interface FloorPlinthOpts {
  /** 바닥 단의 아랫면(받침대 윗면). 기본 0.18 */
  y0?: number;
  /** 깊이 범위(월드 z). 기본 [−0.25, 0.45] */
  z?: [number, number];
  /** 안내 레일 구간(월드 x)과 레일 사이의 가운데 z·발판 깊이. 없으면 레일 없음 */
  rail?: { x0: number; x1: number; zc: number; footD: number };
}

/**
 * 바닥 단(145, 판화의 빗금 바닥): x0~x1, 윗면 y = top 의 나무 단. 플라이휠 자리는 비워 구덩이가 된다.
 * rail 이 있으면 받침대 발판 앞뒤에 낮은 안내 레일 2줄(판화에 없음)과 userData.outlines.slideHole(발판이 다닐 구간, 옆모습)을 둔다.
 * 좌표는 월드 그대로(원점에 놓는다).
 */
export function floorPlinth145(x0: number, x1: number, top: number, o: FloorPlinthOpts = {}): THREE.Group {
  const y0 = o.y0 ?? 0.18;
  const z = o.z ?? [-0.25, 0.45];
  const g = new THREE.Group();
  g.add(boxAt(x1 - x0, top - y0, z[1] - z[0], wood(0x8a6a48), (x0 + x1) / 2, (y0 + top) / 2, (z[0] + z[1]) / 2));
  if (o.rail !== undefined) {
    const r = o.rail;
    for (const s of [-1, 1]) g.add(boxAt(r.x1 - r.x0, 0.06, 0.03, darkSteel(), (r.x0 + r.x1) / 2, top + 0.03, r.zc + s * (r.footD / 2 + 0.006 + 0.015)));
    g.userData.outlines = {
      slideHole: [
        [r.x0, top - 0.002],
        [r.x1, top - 0.002],
        [r.x1, top + 0.3],
        [r.x0, top + 0.3]
      ] as V2[]
    };
  }
  setMM(g, { kind: 'floor', fn: 'floorPlinth145', top });
  return g;
}
