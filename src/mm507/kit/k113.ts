// 113·114·115번 전용 키트 — 랙 묶음
//  113 랙과 피니언: 랙 달린 탁자(판 + 이 아래로 난 랙), 벽 굴대 받침(굴림 바퀴 두 개), 왕복 운동식
//  114 결손 피니언과 이중 랙: 결손 피니언, 안쪽 위아래에 랙이 난 긴 고리 틀(+ 양 끝 납작 막대), 납작 막대 안내, 준정적 접촉으로 구운 틀 이동 표
//  115 두 바퀴로 움직이는 이중 랙: 같은 고리 틀(치수만 다름), 왕복 운동식
// 윤곽·운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s113.mjs · s114.mjs · s115.mjs)가 esbuild 묶음으로 같은 식을 쓴다.
// 좌표 규약: 랙 이는 피치선(y = 0)에서 −Y 로 뻗는다(이끝 y = −add·m, 이뿌리 y = +ded·m). spurGear 와 같은 20° 직선 측면.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { STAGE } from './stand';
import { setMM } from './mm';

const MARK = 0xf2b619;
const TAN20 = Math.tan((20 * Math.PI) / 180);

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// ═══════════════════════════ 랙 이 (공용, 순수 함수) ═══════════════════════════

export interface RackToothOpts {
  /** 이끝 높이(모듈 단위). 잇수 17 미만 피니언과 물릴 때는 1 보다 낮춘다(언더컷 간섭 방지) */
  add?: number;
  /** 이뿌리 깊이(모듈 단위) */
  ded?: number;
}

/**
 * 랙의 이 난 가장자리(왼쪽 → 오른쪽). 피치선 y = 0, 이는 −Y 로. 이 중심 x = x0 + i·πm (i = 0 … teeth−1).
 * 이마다 꼭짓점 4개(뿌리·끝·끝·뿌리). 피치선 이 두께 = 피치의 절반 × 0.96(spurGear 와 같은 백래시).
 */
export function rackEdge113(teeth: number, module: number, x0: number, o: RackToothOpts = {}): V2[] {
  const add = (o.add ?? 1) * module;
  const ded = (o.ded ?? 1.25) * module;
  const p = Math.PI * module;
  const hw = (p / 4) * 0.96;
  const out: V2[] = [];
  for (let i = 0; i < teeth; i++) {
    const c = x0 + i * p;
    out.push([c - hw - ded * TAN20, ded], [c - hw + add * TAN20, -add], [c + hw - add * TAN20, -add], [c + hw + ded * TAN20, ded]);
  }
  return out;
}

/**
 * spurGear(같은 위상 규약: 이 중심각 = 회전각 + (j + 0.5)·피치각)와 물리는 랙의 "이 중심" x 하나.
 * side = +1: 랙이 기어 위(이가 아래로), −1: 랙이 기어 아래(이가 위로). cx = 기어 중심 x, th = 기어 회전각.
 * 랙 이 중심들은 이 값 + k·πm. 랙은 기어가 반시계로 돌 때 위쪽은 −X, 아래쪽은 +X 로 간다.
 */
export function rackToothX113(side: 1 | -1, cx: number, teeth: number, module: number, th: number): number {
  const rp = (teeth * module) / 2;
  const a = th + Math.PI / teeth; // 이 하나의 중심각
  const gap = side === 1 ? cx - rp * (a - Math.PI / 2) : cx + rp * (a - 1.5 * Math.PI);
  const p = Math.PI * module;
  const x = gap + p / 2;
  return x - p * Math.round((x - cx) / p);
}

/** 랙 막대 윤곽(반시계): 아래쪽에 이, 위로 몸통 높이 body(이뿌리선 위). 좌우 끝은 이 바깥으로 pad */
export function rackBarOutline113(teeth: number, module: number, x0: number, body: number, pad: number, o: RackToothOpts = {}): V2[] {
  const edge = rackEdge113(teeth, module, x0, o);
  const ded = (o.ded ?? 1.25) * module;
  const xl = edge[0]![0] - pad;
  const xr = edge[edge.length - 1]![0] + pad;
  return [[xl, ded], ...edge, [xr, ded], [xr, ded + body], [xl, ded + body]];
}

// ═══════════════════════════ 113 랙과 피니언 ═══════════════════════════

/** 113번 치수(판화 비: 피니언 18개 이, 랙 14개 이, 랙 덩어리 길이 = 판 길이의 0.66, 굴림 바퀴가 덩어리 양 끝 바로 밖) */
export const K113 = {
  module: 0.045,
  pinionTeeth: 18,
  rackTeeth: 14,
  /** 랙 몸통 높이(이뿌리선 → 판 밑면) */
  body: 0.2,
  /** 랙 덩어리가 이 바깥으로 남는 길이 */
  pad: 0.14,
  rackW: 0.14,
  /** 판: 반길이·두께·깊이(z) */
  plateHalf: 1.8,
  plateT: 0.08,
  plateD: 0.54,
  /** 굴림 바퀴: 반지름·폭·축 x(±) */
  rollerR: 0.16,
  rollerW: 0.1,
  rollerX: 1.36,
  /** 탁자 왕복 반폭 */
  stroke: 0.3
} as const;

export interface K113State {
  /** 피니언 회전각(반시계 +) */
  phi: number;
  /** 탁자 이동(오른쪽 +) = −rp·phi */
  x: number;
  /** 굴림 바퀴 회전각 = −x / rollerR (피니언과 같은 방향) */
  roll: number;
  /** 피니언이 지금 반시계로 도는가 */
  ccw: boolean;
}

/** 흔들림 위상: t = 1(theta = 1.6)에 가운데(판화 자세)를 지나게 한다 */
export const SWING_POSE = 1.6;

/** 113 운동식(절대): 피니언이 ±stroke/rp 로 흔들린다. phi = (stroke/rp)·sin(theta − 1.6) */
export function k113State(theta: number): K113State {
  const rp = (K113.pinionTeeth * K113.module) / 2;
  const phi = (K113.stroke / rp) * Math.sin(theta - SWING_POSE);
  const x = -rp * phi;
  return { phi, x, roll: -x / K113.rollerR, ccw: Math.cos(theta - SWING_POSE) >= 0 };
}

/** 113: 탁자가 x = 0 일 때 피니언 회전각 0 과 물리는 랙의 첫(맨 왼쪽) 이 중심 x(탁자 좌표) */
export function k113RackX0(): number {
  const p = Math.PI * K113.module;
  const c = rackToothX113(1, 0, K113.pinionTeeth, K113.module, 0);
  // 이 14개를 가운데에 가장 가깝게 놓는다
  const n = K113.rackTeeth;
  return c - p * Math.round((c + ((n - 1) * p) / 2) / p);
}

/**
 * 랙 달린 탁자. 원점 = 랙 피치선 위(탁자 좌표 x = 0), z 가운데 0. 이는 아래(−Y)로.
 * 판은 양 끝이 비스듬(윗변이 더 김). userData.outline = 랙 덩어리 윤곽. child 'rack'·'plate'.
 */
export function rackTable113(): THREE.Group {
  const K = K113;
  const g = new THREE.Group();
  const outline = rackBarOutline113(K.rackTeeth, K.module, k113RackX0(), K.body, K.pad);
  const rack = mesh(extrude(shapeFrom(outline), K.rackW, 0.006), steel());
  rack.name = 'rack';
  g.add(rack);
  const y0 = 1.25 * K.module + K.body;
  const y1 = y0 + K.plateT;
  const plateOutline: V2[] = [[-K.plateHalf + 0.05, y0], [K.plateHalf - 0.05, y0], [K.plateHalf, y1], [-K.plateHalf, y1]];
  const plate = mesh(extrude(shapeFrom(plateOutline), K.plateD, 0.008), castIron());
  plate.name = 'plate';
  g.add(plate);
  // 판과 랙을 잇는 나사 머리(앞면) — 랙이 판에 붙어 있음을 보인다
  for (const sx of [-0.8, 0, 0.8]) g.add(meshAt(cylZ(0.022, K.rackW / 2 - 0.004, K.rackW / 2 + 0.012, 0.003, 16), darkSteel(), sx, 1.25 * K.module + K.body * 0.6, 0));
  g.userData.outline = outline;
  setMM(g, { kind: 'rack', fn: 'rackTable113', teeth: K.rackTeeth, module: K.module, pitch: Math.PI * K.module, plateBottom: y0, plateTop: y1 });
  return g;
}

export interface RollerYoke {
  group: THREE.Group;
  /** [뒤 바퀴, 앞 바퀴] — rotation.z 를 준다 */
  rollers: THREE.Group[];
}

/** 굴림 바퀴(고리 꼴 + 표시점). 축 = 로컬 Z, 원점 중심 */
export function roller113(r: number, width: number, bore = 0.03): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(tubeZ(bore, r, -width / 2, width / 2, 0.008), brass()));
  // 판화의 두 겹 원: 테 안쪽 턱
  g.add(mesh(tubeZ(r * 0.62, r * 0.7, width / 2 - 0.002, width / 2 + 0.006, 0.002), darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(r * 0.22, 0.018, 0.008), paint(MARK), r * 0.4, 0, width / 2 + 0.004));
  setMM(g, { kind: 'roller', r, width, axis: 'z' });
  return g;
}

/**
 * 벽 굴대 받침: 뒤판에서 팔이 랙 아래로 나와, 랙 양옆(앞·뒤)에 세운 볼 두 장이 굴림 바퀴 두 개를 받친다(랙은 두 볼 사이를 지난다).
 * 그룹 원점 = (x, yAxle, 0). zc = 랙의 z 가운데. 바퀴는 볼 바깥쪽에 끼운다.
 */
export function wallYoke113(x: number, yAxle: number, zc: number): RollerYoke {
  const K = K113;
  const g = new THREE.Group();
  g.position.set(x, yAxle, 0);
  const body = castIron();
  const back = STAGE.backZ;
  const cheekT = 0.05;
  const gapZ = K.rackW / 2 + 0.02; // 랙 옆면과 볼 사이 0.02
  const zIn = gapZ; // 볼 안쪽 면(랙 쪽)
  const zOut = zIn + cheekT;
  const zW = zOut + 0.01 + K.rollerW / 2; // 바퀴 가운데
  const armTop = -(K.rollerR + 0.03); // 팔 윗면(바퀴 밑보다 0.03 아래)
  const armH = 0.08;
  const front = zc + zW + K.rollerW / 2 - 0.03;
  // 벽판 + 팔
  g.add(meshAt(new THREE.BoxGeometry(0.24, 0.24, 0.035), body, 0, armTop - armH / 2, back + 0.0175));
  g.add(meshAt(new THREE.BoxGeometry(0.1, armH, front - back), body, 0, armTop - armH / 2, (front + back) / 2));
  const rollers: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    // 볼(세운 판): 팔 윗면에서 축 위 0.06 까지
    const h = 0.06 - armTop;
    g.add(meshAt(new THREE.BoxGeometry(0.08, h, cheekT), body, 0, armTop + h / 2, zc + s * (zIn + cheekT / 2)));
    // 굴대 핀: 볼에서 바깥으로, 끝에 머리
    const z0 = zc + s * zIn;
    const z1 = zc + s * (zW + K.rollerW / 2 + 0.012);
    g.add(mesh(cylZ(0.026, Math.min(z0, z1), Math.max(z0, z1), 0.004, 20), steel()));
    const zh = zc + s * (zW + K.rollerW / 2 + 0.012);
    g.add(mesh(cylZ(0.04, Math.min(zh, zh + s * 0.016), Math.max(zh, zh + s * 0.016), 0.004, 20), darkSteel()));
    const r = roller113(K.rollerR, K.rollerW, 0.03);
    r.position.set(0, 0, zc + s * zW);
    g.add(r);
    rollers.push(r);
  }
  setMM(g, { kind: 'support', fn: 'wallYoke113' });
  return { group: g, rollers };
}

// ═══════════════════════════ 고리 틀(114·115 공용) ═══════════════════════════

export interface RackFrameSpec {
  module: number;
  /** 틀 중심에서 위(+)·아래(−) 랙 피치선까지의 거리 */
  hp: number;
  /** 랙 한 줄의 이 수(아래 랙이 다르면 botTeeth) */
  teeth: number;
  botTeeth?: number;
  /** 위 랙의 맨 왼쪽 이 중심 x(틀 좌표). 아래 랙은 botX0 */
  topX0: number;
  botX0: number;
  /** 이끝·이뿌리(모듈 단위) */
  add: number;
  ded: number;
  /** 안쪽 구멍의 반길이(둥근 끝까지) */
  inHalf: number;
  /** 안쪽 끝 호의 반지름(≥ hp + ded·m. 같으면 반원, 크면 납작한 끝) */
  endR: number;
  /** 띠 두께 */
  band: number;
  /** 양 끝 납작 막대: 끝 x(±)와 높이 */
  rodHalf: number;
  rodH: number;
  /** 두께(z) */
  thick: number;
}

/** 고리 틀 안쪽 구멍 윤곽(반시계, 틀 좌표): 아래 랙(이가 위로) → 오른쪽 끝 호 → 위 랙(이가 아래로) → 왼쪽 끝 호 */
export function frameHole113(s: RackFrameSpec): V2[] {
  const rin = s.hp + s.ded * s.module;
  const c0 = s.inHalf - s.endR;
  const ga = Math.asin(rin / s.endR);
  const o = { add: s.add, ded: s.ded };
  const bot = rackEdge113(s.botTeeth ?? s.teeth, s.module, s.botX0, o).map(([x, y]): V2 => [x, -s.hp - y]);
  const top = rackEdge113(s.teeth, s.module, s.topX0, o)
    .map(([x, y]): V2 => [x, s.hp + y])
    .reverse();
  return [[-c0 - s.endR * Math.cos(ga), -rin], ...bot, ...arc(c0, 0, s.endR, -ga, ga, 24), ...top, ...arc(-c0, 0, s.endR, Math.PI - ga, Math.PI + ga, 24).slice(0, -1)];
}

/** 고리 틀 바깥 윤곽(반시계, 틀 좌표): 긴 고리 + 양 끝 납작 막대 */
export function frameOuter113(s: RackFrameSpec): V2[] {
  const rin = s.hp + s.ded * s.module;
  const ro = s.endR + s.band;
  const c0 = s.inHalf - s.endR;
  const ga = Math.asin((rin + s.band) / ro);
  const h = s.rodH / 2;
  const b = Math.asin(h / ro);
  return [
    ...arc(c0, 0, ro, -ga, -b, 14),
    [s.rodHalf, -h],
    [s.rodHalf, h],
    ...arc(c0, 0, ro, b, ga, 14),
    ...arc(-c0, 0, ro, Math.PI - ga, Math.PI - b, 14),
    [-s.rodHalf, h],
    [-s.rodHalf, -h],
    ...arc(-c0, 0, ro, Math.PI + b, Math.PI + ga, 14)
  ];
}

/**
 * 안쪽 위아래에 랙이 난 긴 고리 틀 + 양 끝 납작 막대(한 덩어리). 원점 = 틀 중심, z 가운데 0.
 * userData.outlines.hole = 안쪽 구멍 윤곽(이 포함) — 피니언 윤곽이 이 구멍 밖으로 나가면 침범.
 */
export function rackFrame113(s: RackFrameSpec): THREE.Group {
  const g = new THREE.Group();
  const hole = frameHole113(s);
  const shape = shapeFrom(frameOuter113(s));
  shape.holes.push(pathFrom([...hole].reverse()));
  g.add(mesh(extrude(shape, s.thick, 0.006), steel()));
  // 막대 끝 표시(움직임이 보이게)
  for (const sx of [-1, 1]) g.add(meshAt(new THREE.BoxGeometry(0.02, s.rodH * 0.6, 0.008), paint(MARK), sx * (s.rodHalf - 0.04), 0, s.thick / 2 + 0.003));
  g.userData.outlines = { hole };
  setMM(g, { kind: 'rack', fn: 'rackFrame113', teeth: s.teeth, module: s.module, pitch: Math.PI * s.module, hp: s.hp });
  return g;
}

/**
 * 납작 막대 안내(벽걸이): 뒤판에서 나온 받침 덩어리 + 위아래 턱 + 앞 덮개. 막대는 X 방향으로 미끄러진다(구멍이 축 방향).
 * 그룹 원점 = (x, y, 0), 막대 가운데 z = zc. barH·barT = 막대 높이·두께, len = 안내 길이(x).
 */
export function barGuide113(x: number, y: number, zc: number, barH: number, barT: number, len = 0.14): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const body = castIron();
  const back = STAGE.backZ;
  const cl = 0.004;
  const zb = zc - barT / 2 - cl; // 받침 덩어리 앞면
  const zf = zc + barT / 2 + cl; // 덮개 뒷면
  const jaw = 0.045;
  const H = barH + 2 * cl + 2 * jaw;
  g.add(meshAt(new THREE.BoxGeometry(len, H, zb - back), body, 0, 0, (zb + back) / 2));
  for (const s of [-1, 1]) g.add(meshAt(new THREE.BoxGeometry(len, jaw, zf - zb), body, 0, s * (barH / 2 + cl + jaw / 2), (zf + zb) / 2));
  g.add(meshAt(new THREE.BoxGeometry(len, H, 0.03), body, 0, 0, zf + 0.015));
  for (const s of [-1, 1]) g.add(meshAt(cylZ(0.016, zf + 0.03, zf + 0.042, 0.003, 12), darkSteel(), 0, s * (barH / 2 + cl + jaw / 2), 0));
  setMM(g, { kind: 'support', fn: 'barGuide113', axis: 'x' });
  return g;
}

// ═══════════════════════════ 114 결손 피니언과 이중 랙 ═══════════════════════════

/** 결손 피니언 윤곽(반시계): 이 번호 j(중심각 (j + 0.5)·피치각) 가운데 0 … count−1 만 남기고 나머지는 이뿌리 근처 원호 */
export function mutilatedOutline113(teeth: number, module: number, count: number): V2[] {
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const rb = rp - 1.2 * module;
  const step = TAU / teeth;
  const full = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const regions: V2[][] = Array.from({ length: teeth }, () => []);
  for (const pt of full) {
    let a = Math.atan2(pt[1], pt[0]);
    if (a < 0) a += TAU;
    regions[Math.min(teeth - 1, Math.floor(a / step))]!.push(pt);
  }
  const out: V2[] = [];
  for (let j = 0; j < teeth; j++) {
    if (j < count) out.push(...regions[j]!);
    else for (let k = 0; k < 6; k++) out.push([Math.cos((j + k / 6) * step) * rb, Math.sin((j + k / 6) * step) * rb]);
  }
  return out;
}

/**
 * 결손 피니언(민판 + 허브 고리 + 표시점). 축 = 로컬 Z. 이는 로컬 0° ~ count·피치각 구간에만.
 * userData.outline = 윤곽(틀 구멍 윤곽과의 침범 검사용).
 */
export function mutilatedPinion113(teeth: number, module: number, count: number, width = 0.1): THREE.Group {
  const g = new THREE.Group();
  const rp = (teeth * module) / 2;
  const outline = mutilatedOutline113(teeth, module, count);
  const bore = 0.05;
  const shape = shapeFrom(outline);
  shape.holes.push(pathFrom(circlePts(bore, 32).reverse()));
  g.add(mesh(extrude(shape, width, 0.005), bronze({ roughness: 0.34 })));
  g.add(mesh(tubeZ(bore, bore + 0.04, -(width / 2 + 0.015), width / 2 + 0.015, 0.006), darkSteel()));
  // 표시점: 이 난 구간의 가운데 방향
  const am = (count * TAU) / teeth / 2;
  const mark = meshAt(new THREE.BoxGeometry(rp * 0.3, 0.018, 0.008), paint(MARK), Math.cos(am) * rp * 0.55, Math.sin(am) * rp * 0.55, width / 2 + 0.004);
  mark.rotation.z = am;
  g.add(mark);
  g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'mutilatedPinion113', teeth, module, internal: false, rp, ra: rp + module, rf: rp - 1.25 * module, width, axis: 'z', from: 0, count, noncircular: true });
  return g;
}

/** 114번 치수(판화 비: 랙 9개 이 두 줄, 안쪽 길이 ≈ 랙 길이의 1.5배. 피니언은 12개 이 자리 가운데 count 개만) */
export const K114 = {
  module: 0.04,
  teeth: 12,
  /** 남긴 이 수 — 판화는 7개쯤 그렸으나 그러면 위아래 랙에 한꺼번에 물려 돌 수 없다(설계표 114 참고) */
  count: 4,
  frame: {
    module: 0.04,
    hp: 0.24,
    teeth: 9,
    topX0: -4 * Math.PI * 0.04,
    botX0: -4 * Math.PI * 0.04,
    add: 0.7,
    ded: 1.25,
    inHalf: 0.85,
    endR: 0.32,
    band: 0.09,
    rodHalf: 1.77,
    rodH: 0.09,
    thick: 0.1
  } as RackFrameSpec,
  /** t = 1 에 판화 자세가 되게 하는 피니언 위상: psi = theta + pose */
  pose: (250 * Math.PI) / 180 - 1.6
} as const;

/** 구운 표의 각 간격(도) */
export const SHIFT114_STEP = 1;
/**
 * 준정적 접촉으로 구운 틀 이동 표: 피니언 각 psi = i·SHIFT114_STEP(도), i = 0 … 179 일 때 틀 중심의 x.
 * 나머지 반 바퀴는 x(psi + 180°) = −x(psi). (shots/_verify/s114.mjs 가 이 파일의 윤곽으로 계산 — 치수를 바꾸면 다시 굽는다.)
 */
export const SHIFT114: readonly number[] = [
  0.1282, 0.12401, 0.11984, 0.11568, 0.11155, 0.10743, 0.10334, 0.09907, 0.09479, 0.09054, 0.08632, 0.08212,
  0.07796, 0.07383, 0.06973, 0.06545, 0.0612, 0.05699, 0.0528, 0.04861, 0.04443, 0.04025, 0.03605, 0.03188,
  0.02772, 0.02348, 0.0193, 0.01512, 0.01091, 0.00672, 0.00254, -0.00165, -0.00583, -0.00998, -0.01412, -0.01823,
  -0.02232, -0.02659, -0.03087, -0.03512, -0.03935, -0.04354, -0.0477, -0.05183, -0.05593, -0.06021, -0.06446, -0.06867,
  -0.07286, -0.07705, -0.08124, -0.08542, -0.08962, -0.09378, -0.09795, -0.10218, -0.10637, -0.11054, -0.11475, -0.11894,
  -0.12313, -0.12732, -0.13149, -0.13565, -0.13978, -0.14389, -0.14798, -0.15226, -0.15654, -0.16079, -0.16501, -0.1692,
  -0.17337, -0.1775, -0.1816, -0.18588, -0.19013, -0.19434, -0.19851, -0.20265, -0.20683, -0.21108, -0.21528, -0.21944,
  -0.22361, -0.22784, -0.23203, -0.2362, -0.24042, -0.2446, -0.24877, -0.25288, -0.25694, -0.26094, -0.26488, -0.26876,
  -0.27258, -0.27634, -0.28003, -0.28366, -0.28722, -0.29072, -0.29415, -0.29751, -0.3008, -0.30402, -0.30717, -0.31025,
  -0.31325, -0.31618, -0.31903, -0.3218, -0.3245, -0.32712, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851,
  -0.32851, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851, -0.32851,
  -0.32851, -0.32689, -0.32202, -0.31737, -0.3128, -0.30832, -0.30413, -0.29994, -0.29576, -0.29158, -0.2874, -0.28323,
  -0.27907, -0.27492, -0.27077, -0.26654, -0.2623, -0.25807, -0.25387, -0.24967, -0.2455, -0.24134, -0.23721, -0.2331,
  -0.22901, -0.22473, -0.22046, -0.2162, -0.21198, -0.20779, -0.20362, -0.19949, -0.19539, -0.19111, -0.18686, -0.18265,
  -0.17846, -0.17428, -0.17009, -0.16591, -0.16171, -0.15755, -0.15338, -0.14915, -0.14496, -0.14079, -0.13658, -0.13239
];

/** 114: 피니언 각 psi(rad, 반시계 누적) → 틀 중심 x. 한 바퀴마다 정확히 되풀이(누적 오차 없음) */
export function frameShift114(psi: number): number {
  const n = SHIFT114.length;
  if (n < 2) return 0;
  const d = (((psi * 180) / Math.PI / SHIFT114_STEP) % (2 * n) + 2 * n) % (2 * n);
  const i = Math.floor(d);
  const f = d - i;
  const at = (k: number): number => {
    const kk = k % (2 * n);
    return kk < n ? SHIFT114[kk]! : -SHIFT114[kk - n]!;
  };
  return at(i) * (1 - f) + at(i + 1) * f;
}

export interface K114State {
  /** 피니언 회전각(반시계) */
  psi: number;
  /** 틀 중심 x */
  x: number;
  /** 지금 물린 쪽: 1 = 위 랙, −1 = 아래 랙, 0 = 쉬는 중 */
  side: 1 | -1 | 0;
}

/** 114 운동식(절대): psi = theta + pose */
export function k114State(theta: number): K114State {
  const psi = theta + K114.pose;
  const x = frameShift114(psi);
  const dx = frameShift114(psi + 0.02) - x;
  return { psi, x, side: dx < -1e-5 ? 1 : dx > 1e-5 ? -1 : 0 };
}

// ═══════════════════════════ 115 두 바퀴로 움직이는 이중 랙 ═══════════════════════════

/** 115번 치수(판화 비: 같은 크기 기어 둘이 위아래로 물림, 랙 8개 안팎 이 두 줄, 안쪽 길이 ≈ 안쪽 높이의 1.63배) */
export const K115 = {
  module: 0.04,
  teeth: 14,
  /** 틀 왕복 반폭 */
  stroke: 0.3,
  frame: {
    module: 0.04,
    hp: 0.56,
    teeth: 8,
    /** 같은 잇수 기어 둘이 서로 물리면 위·아래 랙의 이 자리가 반 피치 어긋난다 → 아래는 9개라야 좌우 대칭 */
    botTeeth: 9,
    topX0: 0,
    botX0: 0,
    add: 0.8,
    ded: 1.25,
    inHalf: 1.0,
    endR: 1.0,
    band: 0.09,
    rodHalf: 1.87,
    rodH: 0.09,
    thick: 0.1
  } as RackFrameSpec
} as const;

/** 위 기어 각 phi 에 물리는 아래 기어 각(같은 잇수, 중심이 바로 아래 2·rp) — spurGear 위상 규약 */
export function k115LowerAngle(phi: number): number {
  const s = TAU / K115.teeth;
  const a = -Math.PI / 2;
  return a + Math.PI - s - (phi + s / 2 - a);
}

/** 115 고리 틀 치수: 두 랙의 위상을 기어 각 0(틀 x = 0)에 맞춘 것 */
export function k115Frame(): RackFrameSpec {
  const K = K115;
  const p = Math.PI * K.module;
  const rp = (K.teeth * K.module) / 2;
  const nTop = K.frame.teeth;
  const nBot = K.frame.botTeeth ?? nTop;
  const centre = (c: number, n: number): number => c - p * Math.round((c + ((n - 1) * p) / 2) / p);
  // 위 기어 중심 (0, +rp), 아래 기어 중심 (0, −rp) — x 만 쓰인다
  const top = centre(rackToothX113(1, 0, K.teeth, K.module, 0), nTop);
  const bot = centre(rackToothX113(-1, 0, K.teeth, K.module, k115LowerAngle(0)), nBot);
  return { ...K.frame, hp: 2 * rp, topX0: top, botX0: bot };
}

export interface K115State {
  /** 위 기어(구동) 회전각 */
  phiA: number;
  /** 아래 기어 회전각(반대 방향) */
  phiB: number;
  /** 틀 중심 x = −rp·phiA */
  x: number;
  ccw: boolean;
}

/** 115 운동식(절대): 위 기어가 ±stroke/rp 로 흔들린다. phiA = (stroke/rp)·sin(theta − 1.6) */
export function k115State(theta: number): K115State {
  const rp = (K115.teeth * K115.module) / 2;
  const phiA = (K115.stroke / rp) * Math.sin(theta - SWING_POSE);
  return { phiA, phiB: k115LowerAngle(phiA), x: -rp * phiA, ccw: Math.cos(theta - SWING_POSE) >= 0 };
}

/** spurGear 와 같은 치형 윤곽(회전각 0) — 검사 스크립트용 */
export function spurOutline113(teeth: number, module: number): V2[] {
  const rp = (teeth * module) / 2;
  return involuteOutline(teeth, rp + module, rp - 1.25 * module, Math.PI / teeth);
}
