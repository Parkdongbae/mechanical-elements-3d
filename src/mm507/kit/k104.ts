// 번호 전용 키트 (507 · 104~106번): 웜과 미끄럼대 위의 바퀴(104), 나사 찍기 프레스(105), 홈 원통 캠(106)
// 공용 키트는 고치지 않는다. 모델은 '../kit/k104' 에서 직접 import 한다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { circlePts, extrude, lathe, loft, mesh, rodProfile, TAU, tubeProfile } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import type { V2 } from './belt';
import { setMM } from './mm';
import { STAGE } from './stand';

const MARK = 0xf2b619;

function boxAt(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 이름만 있는 빈 표식(검사 선언 joints·links 용) */
function marker(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return o;
}

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

// ───────────────────────── 공용: 뒤판에서 나온 가로축 축받이 ─────────────────────────

/**
 * 가로축(X 방향) 축받이: 고리의 구멍이 X 방향. 원점 = 축 중심선 위(고리 가운데).
 * 고리 뒤쪽 바깥면에서 기둥이 −Z 로 뻗어 뒤판(z = STAGE.backZ)에 발판으로 붙는다 — 기둥은 축에 닿지 않는다.
 * z = 이 축받이를 놓을 월드 z(기둥 길이 계산용). 모델은 position.set(x, y, z) 로 놓는다.
 */
export function wallBearingX(z: number, shaftR: number, o: { width?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const w = o.width ?? 0.09;
  const rIn = shaftR + 0.003;
  const rOut = shaftR + 0.042;
  const ring = lathe(tubeProfile(rIn, rOut, -w / 2, w / 2, 0.008), 36);
  ring.rotateZ(Math.PI / 2); // 구멍 → X
  g.add(mesh(ring, darkSteel()));
  const back = STAGE.backZ - z; // 뒤판 앞면의 로컬 z (음수)
  const z0 = -(rOut - 0.012);
  const len = z0 - back;
  g.add(boxAt(w * 0.8, 0.075, len, castIron(), 0, 0, back + len / 2));
  g.add(boxAt(0.17, 0.17, 0.03, castIron(), 0, 0, back + 0.015));
  setMM(g, { kind: 'pillow', axis: 'x', bossY: 0, fn: 'wallBearingX', r: shaftR });
  return g;
}

// ───────────────────────── 104: 웜 + 미끄럼대 위의 바퀴 ─────────────────────────

const M104 = 0.055;
const N104 = 20;
/** 104번 치수. pitch = π·m, R = 바퀴 피치 반지름, wormRp = 웜 피치 반지름(= wormOuter − m) */
export const K104 = {
  N: N104,
  m: M104,
  R: (N104 * M104) / 2,
  pitch: Math.PI * M104,
  wormRoot: 0.061,
  wormOuter: 0.185,
  wormRp: 0.13,
  wormLen: 2.4,
  wheelW: 0.1,
  /** 축 사이 거리 = R + wormRp */
  centre: (N104 * M104) / 2 + 0.13,
  /** 미끄럼대 행정 = 나사산 2개 */
  travel: 2 * Math.PI * M104,
  /** 웜 휠 비틀림: 오른나사 웜이 위(+Y)에 있을 때 −tan(리드각) */
  tanLead: -(Math.PI * M104) / (TAU * 0.13),
  /** 한 주기의 theta 길이(4π): 나사 구동 1.5π → 바퀴 구동 0.5π → 나사 1.5π → 바퀴 0.5π */
  cycle: 2 * TAU
} as const;

export interface WormDrive104 {
  /** 웜 회전각(rotation.x, 오른나사) */
  phi: number;
  /** 미끄럼대(바퀴 축) x — 웜 가운데 기준 */
  x: number;
  /** 바퀴 회전각(rotation.z) — 어느 순간에도 나사산과 물리는 값 */
  beta: number;
  /** 'screw' = 나사가 돌아 바퀴가 제자리에서 돎, 'wheel' = 나사는 서 있고 바퀴가 돌아 미끄럼대가 감 */
  mode: 'screw' | 'wheel';
  /** 행정 진행(0 = 왼쪽 끝, 1 = 오른쪽 끝) */
  s: number;
}

/**
 * 104번 주기 시간표(닫힌 식). 한 주기(theta 4π)에 웜 3바퀴(바퀴 이 3개), 미끄럼대는 ±travel/2 를 한 번 오간다.
 * 물림 식: beta = π/2 + (x − pitch/2)/R + phi/N  (웜 = kit wormScrew 오른나사, 바퀴 이골 = i·2π/N).
 */
export function wormDrive104(theta: number): WormDrive104 {
  const C = K104.cycle;
  const n = Math.floor(theta / C);
  const u = theta - n * C;
  const A = 1.5 * Math.PI;
  const B = 0.5 * Math.PI;
  let phiC: number;
  let s: number;
  let mode: 'screw' | 'wheel';
  if (u < A) {
    phiC = 2 * u;
    s = 0;
    mode = 'screw';
  } else if (u < A + B) {
    phiC = 3 * Math.PI;
    s = smooth((u - A) / B);
    mode = 'wheel';
  } else if (u < 2 * A + B) {
    phiC = 3 * Math.PI + 2 * (u - A - B);
    s = 1;
    mode = 'screw';
  } else {
    phiC = 6 * Math.PI;
    s = 1 - smooth((u - 2 * A - B) / B);
    mode = 'wheel';
  }
  const phi = n * 6 * Math.PI + phiC;
  const x = K104.travel * (s - 0.5);
  const beta = Math.PI / 2 + (x - K104.pitch / 2) / K104.R + phi / K104.N;
  return { phi, x, beta, mode, s };
}

export interface SolidWormWheelOpts {
  width?: number;
  /** kit wormWheel 과 같은 뜻(웜이 위·오른나사면 −tan 리드각) */
  tanLead?: number;
  boreR?: number;
}

/**
 * 살 없는 원판 웜 바퀴(판화 104 의 민판 톱니바퀴). 축 = 로컬 Z, 이골이 각 i·2π/N 에 온다(spurGear·wormWheel 과 같은 위상).
 * 폭 가운데(z = 0) 단면 윤곽을 userData.outline 에 남긴다.
 */
export function solidWormWheel(teeth: number, module: number, o: SolidWormWheelOpts = {}): THREE.Group {
  const w = o.width ?? 0.1;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const bore = o.boreR ?? 0.07;
  const c = Math.min(module * 0.3, w * 0.15);
  const k = -(o.tanLead ?? 0) / rp;
  const outline = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const zs = [-w / 2, -w / 2 + c, 0, w / 2 - c, w / 2];
  const layers = zs.map((z, i) => {
    const end = i === 0 || i === zs.length - 1;
    return { z, s: end ? (ra - c) / ra : 1, hs: 1, rot: k * z };
  });
  const g = new THREE.Group();
  g.add(mesh(loft(outline, [circlePts(bore, 40)], layers), brass()));
  const hub = lathe(tubeProfile(bore, bore + 0.065, -(w / 2 + 0.016), w / 2 + 0.016, 0.008), 36);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  // 회전이 보이게 하는 표시 줄(허브 바깥 ~ 이뿌리 안쪽)
  g.add(boxAt(rf - bore - 0.13, 0.022, 0.008, paint(MARK), (rf + bore + 0.03) / 2, 0, w / 2 + 0.002));
  g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'solidWormWheel', teeth, module, internal: false, rp, ra, rf, width: w, axis: 'z' });
  return g;
}

/**
 * 웜의 축 단면(아래쪽 절반)을 다각형으로 가진 검사 표식 — 메시 없음.
 * kit wormScrew(rootR, outerR, pitch, length) 가 rotation.x = 0 일 때 평면 z = 0, y < 0 에서 보이는 단면과 같다(원점 = 웜 가운데).
 * 웜이 phi 만큼 돌면 단면은 −pitch·phi/2π 만큼 옮겨 가므로 모델은 매 프레임
 *   section.position.x = wormX − pitch·frac(phi/2π)
 * 로 둔다(y·z 는 웜 축). autocheck 의 다각형 침범이 바퀴 윤곽과 이 단면을 잰다.
 */
export function wormSection(rootR: number, outerR: number, pitch: number, length: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = 'wormSection';
  o.userData.outline = wormSectionOutline(rootR, outerR, pitch, length);
  setMM(o, { kind: 'probe', fn: 'wormSection', pitch });
  return o;
}

/** wormSection 의 다각형(로컬 XY). 나사산 가운데 = pitch/2 + k·pitch */
export function wormSectionOutline(rootR: number, outerR: number, pitch: number, length: number): V2[] {
  // kit/gear2.ts wormScrew 의 단면 상수와 같게
  const depth = outerR - rootR;
  const ha = depth / 2.25;
  const t20 = Math.tan((20 * Math.PI) / 180);
  const pitchHalf = 0.215 * pitch;
  const wt = Math.max(0.01 * pitch, pitchHalf - ha * t20);
  const wr = Math.min(0.46 * pitch, pitchHalf + 1.25 * ha * t20);
  const rIn = rootR - 0.006;
  const wRoot = wr - ((wr - wt) * (rootR - rIn)) / (outerR - rIn); // 코어 표면(rootR)에서의 반폭
  const turns = (length - 2 * wr) / pitch;
  const pts: V2[] = [[-length / 2, 0], [-length / 2, -rootR]];
  const kMin = Math.ceil(-turns / 2 - 0.5);
  const kMax = Math.floor(turns / 2 - 0.5);
  for (let k = kMin; k <= kMax; k++) {
    const xc = pitch / 2 + k * pitch;
    pts.push([xc - wRoot, -rootR], [xc - wt, -outerR], [xc + wt, -outerR], [xc + wRoot, -rootR]);
  }
  pts.push([length / 2, -rootR], [length / 2, 0]);
  return pts;
}

export interface SlideBedOpts {
  h?: number;
  depth?: number;
  /** 다리 x 위치들(로컬) */
  legs?: number[];
  /** 다리 높이(받침대 윗면까지) */
  legH?: number;
}

/** 미끄럼 받침(곧은 베드). 원점 = 윗면 가운데. 다리는 판화에 없는 보충 */
export function slideBed(len: number, o: SlideBedOpts = {}): THREE.Group {
  const g = new THREE.Group();
  const h = o.h ?? 0.16;
  const d = o.depth ?? 0.3;
  g.add(boxAt(len, h, d, castIron(), 0, -h / 2, 0));
  const legH = o.legH ?? 0.25;
  for (const x of o.legs ?? [-len / 2 + 0.2, len / 2 - 0.2]) g.add(boxAt(0.2, legH, d * 0.8, castIron(), x, -h - legH / 2, 0));
  setMM(g, { kind: 'bed', fn: 'slideBed', len, h, depth: d });
  return g;
}

export interface WheelCarriageOpts {
  /** 받침 블록(새들) 가로·높이 */
  blockW?: number;
  blockH?: number;
  /** 베드 깊이(새들이 앞뒤로 감싼다) */
  bedDepth?: number;
  /** 브래킷 판의 로컬 z(가운데)·두께 */
  bracketZ?: number;
  bracketT?: number;
  bossR?: number;
  shaftR?: number;
}

/**
 * 미끄럼대: 베드를 감싼 새들 블록 + 그 위에 선 브래킷(위가 둥근 보스, 구멍은 Z 방향) + 바퀴 축(Z, 브래킷 보스에 꽂힘).
 * 원점 = 베드 윗면 가운데(블록 바닥). 바퀴 축 중심 = (0, axisY, 0), 바퀴 평면 = 로컬 z 0.
 * 브래킷은 바퀴 앞(+Z)에 선다(판화: 브래킷이 바퀴를 가린다). child 'wheelAxis' = 바퀴 축 중심 표식.
 */
export function wheelCarriage(axisY: number, o: WheelCarriageOpts = {}): THREE.Group {
  const g = new THREE.Group();
  const bw = o.blockW ?? 0.86;
  const bh = o.blockH ?? 0.2;
  const bd = (o.bedDepth ?? 0.3) + 0.09;
  const bz = o.bracketZ ?? 0.12;
  const bt = o.bracketT ?? 0.06;
  const bossR = o.bossR ?? 0.15;
  const sr = o.shaftR ?? 0.07;
  const iron = castIron();
  // 새들: 윗판 + 앞뒤 턱(베드 옆면을 0.07 덮는다)
  g.add(boxAt(bw, bh, bd, iron, 0, bh / 2, 0));
  for (const s of [-1, 1]) g.add(boxAt(bw, 0.07, 0.04, iron, 0, -0.035, (s * (bd - 0.04)) / 2));
  // 브래킷: 발 폭 0.5 → 목 → 보스(원) — 한 장의 판. 발은 블록 윗면에 0.01 묻혀 선다
  const sh = new THREE.Shape();
  const foot = 0.25;
  const neck = bossR * 0.72;
  const yn = axisY - bossR * 0.7;
  sh.moveTo(-foot, bh - 0.01);
  sh.lineTo(foot, bh - 0.01);
  sh.quadraticCurveTo(neck + 0.01, bh + 0.08, neck, yn);
  const a = Math.asin((yn - axisY) / bossR); // 보스 원과 목이 만나는 각(음수)
  sh.absarc(0, axisY, bossR, a, Math.PI - a, false);
  sh.quadraticCurveTo(-neck - 0.01, bh + 0.08, -foot, bh - 0.01);
  const hole = new THREE.Path();
  hole.absarc(0, axisY, sr + 0.003, 0, TAU, true);
  sh.holes.push(hole);
  g.add(meshAt(extrude(sh, bt, 0.008, 20), iron, 0, 0, bz));
  // 바퀴 축: 바퀴 뒤 −0.08 ~ 브래킷 앞 +0.04
  const z0 = -0.085;
  const z1 = bz + bt / 2 + 0.04;
  const sg = lathe(rodProfile(sr, z0, z1, 0.01, 0.012), 32);
  sg.rotateX(Math.PI / 2);
  g.add(meshAt(sg, steel(), 0, axisY, 0));
  g.add(marker('wheelAxis', 0, axisY, 0));
  setMM(g, { kind: 'carriage', fn: 'wheelCarriage', axisY, blockW: bw, blockH: bh, zFront: z1 });
  return g;
}

// ───────────────────────── 105: 나사 찍기 프레스 ─────────────────────────

/** 105번 치수. 높이는 받침대 윗면(y = 0.18) 기준의 로컬 값 */
export const K105 = {
  screwRoot: 0.07,
  screwOuter: 0.1,
  lead: 0.24,
  starts: 3,
  screwLen: 0.98,
  /** 팔 끝(손잡이 꼭지 끝)까지의 반지름 — 깊이 한계 때문에 판화(나사 반지름의 8.4배)보다 짧다 */
  armR: 0.5,
  /** 한 번 내려찍는 회전각(rad) = 300° → 행정 = lead·swing/2π = 0.2 */
  swing: (300 * Math.PI) / 180,
  stroke: 0.2,
  nutY0: 1.32,
  nutY1: 1.62,
  nutR: 0.14,
  flangeR: 0.165,
  ramR: 0.12,
  ramLen: 0.42,
  /** 램 윗면(= 나사 끝)의 높이: 가장 높을 때 */
  ramTopUp: 0.94,
  collarY0: 0.6,
  collarY1: 0.72,
  legX0: 0.31,
  legX1: 0.61,
  baseH: 0.1,
  anvilH: 0.2,
  blankH: 0.02,
  frameT: 0.16,
  headH: 0.16
} as const;

export interface ScrewPress105 {
  /** 나사·팔의 회전각(rotation.y 에 더할 값, 0 ~ −swing). 위에서 보아 시계 방향이 내려감 */
  alpha: number;
  /** 나사·램의 내려간 양(0 ~ −stroke) = lead·alpha/2π */
  dy: number;
  /** 진행(0 = 맨 위, 1 = 찍는 순간) */
  s: number;
}

/** 105번 닫힌 식: alpha = −swing·(1 − cos theta)/2. theta 2π 에 한 번 찍고 올라온다 */
export function screwPress105(theta: number): ScrewPress105 {
  const s = (1 - Math.cos(theta)) / 2;
  const alpha = -K105.swing * s;
  return { alpha, dy: (K105.lead * alpha) / TAU, s };
}

/**
 * 여러 줄 오른나사 막대. 축 = 로컬 Y, y 0 ~ length, 원점 = 아래 끝 가운데. 정면에서 산이 "/" 로 기운다.
 * rotation.y = a 로 돌리면서 position.y 를 lead·a/2π 만큼 옮기면 고정 너트 안에서 산이 제자리에 있는 것처럼 보인다(나사 운동).
 * child 'screwTip'(아래 끝), 'screwTop'(위 끝).
 */
export function multiStartScrew(rootR: number, outerR: number, lead: number, starts: number, length: number, o: { driver?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const body = o.driver === true ? bronze({ roughness: 0.34 }) : steel();
  g.add(mesh(lathe(rodProfile(rootR, 0, length, 0.01, 0.01), 40), body));
  const pitch = lead / starts;
  const wr = 0.3 * pitch;
  const wt = 0.19 * pitch;
  const rIn = rootR - 0.005;
  const prof: V2[] = [
    [-wr, rIn],
    [-wt, outerR],
    [wt, outerR],
    [wr, rIn]
  ];
  const y0 = wr + 0.004;
  const y1 = length - wr - 0.004;
  const steps = Math.ceil(((y1 - y0) / lead) * 64);
  const pos: number[] = [];
  const idx: number[] = [];
  for (let s = 0; s < starts; s++) {
    const ph = (s / starts) * TAU;
    const at = (u: number, r: number, j: number): [number, number, number] => {
      const yc = y0 + ((y1 - y0) * j) / steps;
      const psi = (TAU * yc) / lead + ph;
      return [r * Math.sin(psi), yc + u, r * Math.cos(psi)];
    };
    for (let e = 0; e < 4; e++) {
      const a = prof[e]!;
      const b = prof[(e + 1) % 4]!;
      const base = pos.length / 3;
      for (let j = 0; j <= steps; j++) pos.push(...at(a[0], a[1], j), ...at(b[0], b[1], j));
      for (let j = 0; j < steps; j++) {
        const i0 = base + j * 2;
        idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
    }
    for (const j of [0, steps]) {
      const base = pos.length / 3;
      for (const [u, r] of prof) pos.push(...at(u, r, j));
      if (j === 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  fixWinding(pos, idx);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(mesh(geo, body));
  g.add(marker('screwTip', 0, 0, 0));
  g.add(marker('screwTop', 0, length, 0));
  setMM(g, { kind: 'screw', fn: 'multiStartScrew', axis: 'y', rootR, outerR, lead, starts, length });
  return g;
}

/** 닫힌 면의 부피 부호로 바깥쪽이 앞면이 되게 감김 방향을 맞춘다 */
function fixWinding(pos: number[], idx: number[]): void {
  let vol = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const i = idx[k]! * 3;
    const j = idx[k + 1]! * 3;
    const l = idx[k + 2]! * 3;
    const ax = pos[i]!, ay = pos[i + 1]!, az = pos[i + 2]!;
    const bx = pos[j]!, by = pos[j + 1]!, bz = pos[j + 2]!;
    const cx = pos[l]!, cy = pos[l + 1]!, cz = pos[l + 2]!;
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  if (vol < 0) {
    for (let k = 0; k < idx.length; k += 3) {
      const t = idx[k + 1]!;
      idx[k + 1] = idx[k + 2]!;
      idx[k + 2] = t;
    }
  }
}

/**
 * 플라이 바(휘두르는 팔): 머리 블록 + 가로 막대 + 양끝의 렌즈 꼴 쇠공 + 끝 꼭지 + 머리 위 꼭지.
 * 원점 = 머리 블록 가운데(막대 축). 막대는 로컬 X. 끝 꼭지 끝까지의 반지름 = tipR.
 */
export function flyBar(tipR: number, o: { headW?: number; headH?: number; ballR?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const hw = o.headW ?? 0.24;
  const hh = o.headH ?? 0.16;
  const br = o.ballR ?? 0.11;
  g.add(boxAt(hw, hh, hw * 0.92, darkSteel(), 0, 0, 0));
  const barLen = 2 * (tipR - 0.03);
  const bar = lathe(rodProfile(0.027, -barLen / 2, barLen / 2, 0.006, 0.006), 24);
  bar.rotateZ(Math.PI / 2);
  g.add(mesh(bar, steel()));
  for (const s of [-1, 1]) {
    const ball = mesh(new THREE.SphereGeometry(br, 32, 20), castIron());
    ball.scale.set(0.6, 1, 1);
    ball.position.set(s * (tipR - 0.11), 0, 0);
    g.add(ball);
    const knob = mesh(new THREE.SphereGeometry(0.024, 16, 12), brass());
    knob.position.set(s * (tipR - 0.024), 0, 0);
    g.add(knob);
  }
  g.add(meshAt(lathe(rodProfile(0.035, 0, 0.05, 0, 0.012), 20), brass(), 0, hh / 2, 0));
  setMM(g, { kind: 'handle', fn: 'flyBar', tipR, axis: 'y' });
  return g;
}

/**
 * 프레스 몸체(고정): 너트 보스(위아래 턱) + 거위목 팔(오른쪽으로 나가 아래로 굽은 한 덩어리) + 바닥판 + 모루 + 찍을 재료 + 램 안내 고리와 띠.
 * 원점 = 나사 축이 받침대 윗면과 만나는 점. 치수는 K105. 바닥판·모루·재료는 판화에 없음(보충).
 * child 'nut', 'guide'(안내 고리), 'anvilTop'(재료 윗면 가운데 표식).
 */
export function pressFrame(): THREE.Group {
  const K = K105;
  const g = new THREE.Group();
  const iron = castIron();
  const bore = K.screwOuter + 0.004;
  // 너트 보스 + 턱
  const nut = new THREE.Group();
  nut.name = 'nut';
  nut.add(mesh(lathe(tubeProfile(bore, K.nutR, K.nutY0, K.nutY1, 0.006), 40), iron));
  for (const y of [K.nutY0, K.nutY1 - 0.04]) nut.add(mesh(lathe(tubeProfile(bore, K.flangeR, y, y + 0.04, 0.006), 40), darkSteel()));
  g.add(nut);
  // 거위목 팔(XY 평면 윤곽을 Z 로 압출)
  const rO = 0.3;
  const rI = 0.1;
  const xa = K.nutR - 0.03;
  const sh = new THREE.Shape();
  sh.moveTo(xa, K.nutY1);
  sh.lineTo(K.legX1 - rO, K.nutY1);
  sh.absarc(K.legX1 - rO, K.nutY1 - rO, rO, Math.PI / 2, 0, true);
  sh.lineTo(K.legX1, K.baseH - 0.01);
  sh.lineTo(K.legX0, K.baseH - 0.01);
  sh.lineTo(K.legX0, K.nutY0 - rI);
  sh.absarc(K.legX0 - rI, K.nutY0 - rI, rI, 0, Math.PI / 2, false);
  sh.lineTo(xa, K.nutY0);
  sh.closePath();
  g.add(mesh(extrude(sh, K.frameT, 0.012, 20), iron));
  // 바닥판·모루·재료(판화에 없음)
  g.add(boxAt(K.legX1 + 0.05 + 0.32, K.baseH, 0.42, iron, (K.legX1 + 0.05 - 0.32) / 2, K.baseH / 2, 0));
  g.add(mesh(lathe(rodProfile(0.15, K.baseH, K.baseH + K.anvilH, 0, 0.012), 36), darkSteel()));
  g.add(mesh(lathe(rodProfile(0.085, K.baseH + K.anvilH, K.baseH + K.anvilH + K.blankH, 0, 0.003), 28), brass()));
  g.add(marker('anvilTop', 0, K.baseH + K.anvilH + K.blankH, 0));
  // 램 안내 고리 + 다리에 붙는 띠
  const guide = new THREE.Group();
  guide.name = 'guide';
  const rc = K.ramR + 0.035;
  guide.add(mesh(lathe(tubeProfile(K.ramR + 0.004, rc, K.collarY0, K.collarY1, 0.006), 36), darkSteel()));
  const sx0 = rc - 0.012;
  const sx1 = K.legX0 + 0.01;
  guide.add(boxAt(sx1 - sx0, K.collarY1 - K.collarY0, 0.07, darkSteel(), (sx0 + sx1) / 2, (K.collarY0 + K.collarY1) / 2, 0));
  g.add(guide);
  setMM(g, { kind: 'frame', fn: 'pressFrame' });
  return g;
}

/** 램(찍는 원기둥): 원점 = 윗면 가운데(나사 끝이 얹히는 자리), 아래로 len. 돌지 않고 위아래로만 움직인다. child 'ramSocket', 'ramFace'(아랫면) */
export function pressRam(r: number, len: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(lathe(rodProfile(r, -len, 0, 0.012, 0.01), 36), steel()));
  // 나사 끝을 감싸는 낮은 목(스위블 자리)
  g.add(mesh(lathe(tubeProfile(K105.screwRoot + 0.004, K105.screwOuter + 0.012, 0, 0.03, 0.005), 28), darkSteel()));
  g.add(marker('ramSocket', 0, 0, 0));
  g.add(marker('ramFace', 0, -len, 0));
  setMM(g, { kind: 'ram', fn: 'pressRam', r, len, axis: 'y' });
  return g;
}

// ───────────────────────── 106: 홈 원통 캠 ─────────────────────────

/** 106번 치수 */
export const K106 = {
  R: 0.5,
  width: 0.45,
  /** 홈 중심선의 좌우 진폭(행정 = 2·amp) */
  amp: 0.09,
  /** 따라가는 핀(스터드) 반지름 */
  pinR: 0.035,
  /** 핀과 홈 벽 사이 틈(홈 벽에 수직으로) */
  clear: 0.004,
  depth: 0.07,
  shaftR: 0.08,
  /** 막대 축에서 원통 겉면까지 */
  drop: 0.25,
  barHalf: 0.035,
  barLen: 1.56
} as const;

const wrapPi = (a: number): number => a - TAU * Math.round(a / TAU);
/** 세모 물결: tri(0) = −1, tri(±π) = +1, 주기 2π, 그 사이는 곧은 선(등속) */
const tri = (a: number): number => (2 * Math.abs(wrapPi(a))) / Math.PI - 1;

/** 원통이 a(rotation.x) 만큼 돌았을 때 맨 위(핀 자리)의 홈 중심 x — 원통 가운데 기준. a = 0 에서 왼쪽 끝 */
export function grooveCamX(a: number, amp: number = K106.amp): number {
  return amp * tri(a);
}

/** 홈의 축방향 폭: 비스듬한 홈 벽에 수직으로 (2·pinR + 2·clear) 가 되게 */
export function grooveAxialWidth(R: number = K106.R, amp: number = K106.amp, pinR: number = K106.pinR, clear: number = K106.clear): number {
  const tanL = (2 * amp) / (Math.PI * R);
  return 2 * (pinR + clear) * Math.sqrt(1 + tanL * tanL);
}

export interface GrooveDrumOpts {
  R?: number;
  width?: number;
  amp?: number;
  depth?: number;
  grooveW?: number;
}

/**
 * 홈 원통 캠: 축 = 로컬 X, 원점 = 가운데. 겉면에 한 바퀴 닫힌 홈 — 반 바퀴는 곧은 나선으로 오른쪽으로, 반 바퀴는 왼쪽으로(등속 왕복).
 * 원통 고정 각 ψ(로컬 +Y 에서 +Z 쪽으로)에서 홈 중심 x = amp·tri(ψ). rotation.x = a 로 돌리면 맨 위의 홈 중심 = grooveCamX(a).
 */
export function grooveDrum(o: GrooveDrumOpts = {}): THREE.Group {
  const R = o.R ?? K106.R;
  const W = o.width ?? K106.width;
  const amp = o.amp ?? K106.amp;
  const h = o.depth ?? K106.depth;
  const w = o.grooveW ?? grooveAxialWidth(R, amp);
  const n = 180;
  const profAt = (psi: number): V2[] => {
    const xc = amp * tri(psi);
    return [
      [-W / 2, R],
      [xc - w / 2, R],
      [xc - w / 2, R - h],
      [xc + w / 2, R - h],
      [xc + w / 2, R],
      [W / 2, R]
    ];
  };
  const pos: number[] = [];
  const idx: number[] = [];
  for (let e = 0; e < 5; e++) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const psi = (i / n) * TAU;
      const p = profAt(psi);
      const a = p[e]!;
      const b = p[e + 1]!;
      const c = Math.cos(psi);
      const s = Math.sin(psi);
      pos.push(a[0], a[1] * c, a[1] * s, b[0], b[1] * c, b[1] * s);
    }
    for (let i = 0; i < n; i++) {
      const i0 = base + i * 2;
      idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const iron = castIron();
  g.add(mesh(geo, iron));
  for (const s of [-1, 1]) {
    const cap = new THREE.CircleGeometry(R, 96);
    cap.rotateY((s * Math.PI) / 2);
    g.add(meshAt(cap, iron, (s * W) / 2, 0, 0));
  }
  setMM(g, { kind: 'cam', fn: 'grooveDrum', axis: 'x', R, width: W, amp, depth: h, grooveW: w });
  return g;
}

export interface GrooveProbe {
  /** 모델 루트에 더할 빈 물체(메시 없음) */
  group: THREE.Group;
  /** 매 프레임: a = 원통 rotation.x, x = 핀의 x − 원통 가운데 x (실제 놓은 값 그대로 넣는다) */
  set(a: number, x: number): void;
}

/**
 * 홈과 핀의 침범 검사 표식(메시 없음). 원통 겉면을 펼친 평면 (x, s = R·ψ) 에서
 * 홈 = userData.outlines.grooveHole(구멍 다각형, ψ −1.5π ~ 1.5π), 핀 = 원(userData.outline).
 * autocheck 의 다각형 침범이 "핀이 홈 안에 있는가"를 한 주기 내내 잰다.
 */
export function grooveProbe(o: GrooveDrumOpts & { pinR?: number } = {}): GrooveProbe {
  const R = o.R ?? K106.R;
  const amp = o.amp ?? K106.amp;
  const w = o.grooveW ?? grooveAxialWidth(R, amp);
  const pinR = o.pinR ?? K106.pinR;
  const group = new THREE.Group();
  group.name = 'grooveProbe';
  const map = new THREE.Object3D();
  map.name = 'grooveMap';
  map.userData.outlines = { grooveHole: grooveMapOutline(R, amp, w) };
  const pin = new THREE.Object3D();
  pin.name = 'pinSection';
  pin.userData.outline = circlePts(pinR, 24);
  group.add(map, pin);
  setMM(group, { kind: 'probe', fn: 'grooveProbe' });
  return {
    group,
    set(a: number, x: number): void {
      pin.position.set(x, R * wrapPi(-a), 0);
    }
  };
}

/** 펼친 홈 다각형 (x, R·ψ), ψ −1.5π ~ 1.5π */
export function grooveMapOutline(R: number = K106.R, amp: number = K106.amp, w: number = grooveAxialWidth(R, amp)): V2[] {
  const left: V2[] = [];
  const right: V2[] = [];
  const m = 180;
  for (let i = 0; i <= m; i++) {
    const psi = -1.5 * Math.PI + (3 * Math.PI * i) / m;
    const xc = amp * tri(psi);
    left.push([xc - w / 2, R * psi]);
    right.push([xc + w / 2, R * psi]);
  }
  return [...left, ...right.reverse()];
}

/**
 * 미끄럼 막대 + 보스 + 아래로 내린 팔 + 홈에 드는 핀(스터드, 축 = Y). 원점 = 막대 축 위 보스 가운데. 막대는 로컬 X(네모 단면 — 돌지 않는다).
 * 핀 가운데선 = 로컬 x 0, 원통 겉면 = 로컬 y −drop, 핀은 홈 속으로 depth − 0.012 만큼 든다. child 'follower'(겉면 높이의 핀 중심).
 */
export function followerBar(len: number = K106.barLen, o: { drop?: number; barHalf?: number; pinR?: number; depth?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const drop = o.drop ?? K106.drop;
  const bh = o.barHalf ?? K106.barHalf;
  const pr = o.pinR ?? K106.pinR;
  const dep = o.depth ?? K106.depth;
  g.add(boxAt(len, 2 * bh, 2 * bh, steel(), 0, 0, 0));
  // 보스(막대를 감싼 블록) + 앞면의 고정 핀 머리
  g.add(boxAt(0.16, 0.15, 0.14, darkSteel(), 0, 0, 0));
  const head = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16);
  head.rotateX(Math.PI / 2);
  g.add(meshAt(head, brass(), 0, 0, 0.076));
  // 팔: 보스 아랫면 ~ 겉면 위 0.03
  const y0 = -0.075;
  const y1 = -drop + 0.03;
  g.add(boxAt(0.07, y0 - y1 + 0.01, 0.05, darkSteel(), 0, (y0 + y1) / 2, 0));
  // 핀: 팔 끝 ~ 홈 바닥 위 0.012
  const p0 = -drop - dep + 0.012;
  const p1 = y1 + 0.02;
  g.add(mesh(lathe(rodProfile(pr, p0, p1, 0.006, 0), 24), bronze()));
  g.add(marker('follower', 0, -drop, 0));
  setMM(g, { kind: 'slider', fn: 'followerBar', axis: 'x', len, drop });
  return g;
}

/**
 * 천장에서 내려온 걸이(막대 안내): 얇은 판(두께 = X 방향)에 네모 구멍이 X 방향으로 뚫려 막대가 지나간다.
 * 원점 = 구멍 가운데(막대 축). 위로 up(천장 밑면까지), 아래로 0.11.
 */
export function hangerX(up: number, barHalf: number = K106.barHalf, o: { thick?: number; depth?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const t = o.thick ?? 0.1;
  const d = o.depth ?? 0.17;
  const sh = new THREE.Shape();
  sh.moveTo(-d / 2, -0.11);
  sh.lineTo(d / 2, -0.11);
  sh.lineTo(d / 2, up);
  sh.lineTo(-d / 2, up);
  sh.closePath();
  const q = barHalf + 0.004;
  const hole = new THREE.Path();
  hole.moveTo(-q, -q);
  hole.lineTo(-q, q);
  hole.lineTo(q, q);
  hole.lineTo(q, -q);
  hole.closePath();
  sh.holes.push(hole);
  const geo = extrude(sh, t, 0.006);
  geo.rotateY(Math.PI / 2); // 압출 방향(구멍) → X
  g.add(mesh(geo, castIron()));
  setMM(g, { kind: 'pillow', axis: 'x', bossY: 0, fn: 'hangerX' });
  return g;
}

/** 천장 판(뒤판에 붙은 나무 들보). 원점 = 밑면의 가운데 x, z = 0 기준. 뒤판 앞면(z = STAGE.backZ)에서 zFront 까지 */
export function ceilingSlab(len: number, o: { h?: number; zFront?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const h = o.h ?? 0.14;
  const zf = o.zFront ?? 0.5;
  g.add(boxAt(len, h, zf - STAGE.backZ, wood(), 0, h / 2, (zf + STAGE.backZ) / 2));
  setMM(g, { kind: 'ceiling', fn: 'ceilingSlab', len });
  return g;
}
