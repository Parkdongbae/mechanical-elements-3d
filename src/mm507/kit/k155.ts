// 155·156·157번 전용 키트 — 엘보 레버(벨 크랭크) 묶음
//  155 폴 이송 장치: 네모 이 톱니바퀴, 엘보 레버(팔 둘 + 핀 둘), 뒤집어 쓰는 폴, 폴 들림 풀이
//  156 홈 있는 벨 크랭크: 홈 난 팔 + 짧은 팔(원판의 핀이 홈 안에서 미끄러진다)
//  157 연결봉 달린 벨 크랭크: 크랭크–연결봉–벨 크랭크 4절 링크
// 치수 상수(K155·K156·K157)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s155.mjs 등)가 같은 식을 쓴다.
// 원판·연결봉·안내틀·미끄럼 블록은 k092 의 crankDisc·connectingRod·guideFrame·crosshead 를 모델이 그대로 가져다 쓴다.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, circlePath, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

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

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

const pol = (r: number, a: number): V2 => [r * Math.cos(a), r * Math.sin(a)];
const rot = (p: V2, a: number): V2 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

/** 원호 점열(a0 → a1, 양끝 포함 n+1 점) */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** 2차 곡선 점열(p0 → p2, 조절점 c). 양끝은 빼고 안쪽 n−1 점만 */
function quad(p0: V2, c: V2, p2: V2, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]]);
  }
  return out;
}

/** 점이 다각형 안에 있는가(홀짝 규칙) */
export function inPoly155(x: number, y: number, P: readonly V2[]): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i]!;
    const b = P[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** 다각형 변을 step 이하 간격으로 잘게 나눈 점열 */
export function densify155(P: readonly V2[], step: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i]!;
    const b = P[(i + 1) % P.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

// ═══════════════════════════ 공용: 팔 달린 레버 ═══════════════════════════

/** 레버의 팔 하나(레버 로컬: 원점 = 받침 구멍 중심) */
export interface LeverArm {
  /** 받침 중심 ~ 팔 끝 둥근 머리 중심 */
  len: number;
  /** 팔 방향(rad, 로컬 +X 에서 반시계) */
  angle: number;
  /** 팔 끝 둥근 머리 반지름 */
  endR: number;
  /** 뿌리 쪽 반폭(받침 중심에 둔 원의 반지름). 기본 endR */
  rootR?: number;
  /** 팔 끝 구멍 반지름(남의 핀이 꽂히는 구멍). pin 과 같이 쓰지 않는다 */
  holeR?: number;
  /** 긴 홈(팔 가운데선 위, 받침 중심에서 from ~ to 가 양끝 둥근 부분의 중심), half = 홈 반폭 */
  slot?: { from: number; to: number; half: number };
  /** 팔 끝에 박힌 핀: 반지름 r, 로컬 z0 ~ z1, 표식 child 의 name 과 그 z(at = 이어지는 부품의 평면) */
  pin?: { r: number; z0: number; z1: number; name: string; at: number };
}

export interface ElbowLeverOpts {
  /** 받침 보스 반지름 */
  hubR: number;
  /** 받침 구멍 반지름 */
  boreR: number;
  /** 판 두께(z). 기본 0.07 */
  thick?: number;
  /** 팔 사이 오목 모서리를 메우는 정도(p-노름 지수, 작을수록 살이 두껍다). 기본 8 */
  blend?: number;
  /** 재질. 기본 'iron' */
  metal?: 'iron' | 'brass' | 'steel';
}

/** 팔 하나(받침 원 + 끝 원의 볼록 껍질)의 받침 중심에서 phi 방향 가장자리까지 거리 */
export function armRadius(arm: LeverArm, phi: number): number {
  const r0 = arm.rootR ?? arm.endR;
  const e = arm.endR;
  const L = arm.len;
  let rel = (phi - arm.angle) % TAU;
  if (rel > Math.PI) rel -= TAU;
  if (rel < -Math.PI) rel += TAU;
  const kap = Math.acos(Math.max(-1, Math.min(1, (r0 - e) / L)));
  const ar = Math.abs(rel);
  if (ar >= kap) return r0;
  const tLine = r0 / Math.cos(kap - ar);
  if (tLine * Math.cos(ar) <= L + e * Math.cos(kap)) return tLine;
  const ls = L * Math.sin(ar);
  return L * Math.cos(ar) + Math.sqrt(Math.max(0, e * e - ls * ls));
}

/** 레버 판 윤곽(받침 중심에서 본 별꼴 — 각도 n 등분). 팔들의 p-노름 합과 받침 보스 원 가운데 큰 쪽 */
export function leverOutline(arms: readonly LeverArm[], hubR: number, blend = 8, n = 900): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const phi = (i / n) * TAU;
    let sum = 0;
    for (const a of arms) sum += Math.pow(armRadius(a, phi), blend);
    out.push(pol(Math.max(hubR, Math.pow(sum, 1 / blend)), phi));
  }
  return out;
}

/** 스타디움(양끝 둥근 홈) 다각형 — 두 중심 c0, c1, 반지름 r. 반시계 */
function stadium(c0: V2, c1: V2, r: number, n = 12): V2[] {
  const a = Math.atan2(c1[1] - c0[1], c1[0] - c0[0]);
  return [...arc(c1[0], c1[1], r, a - Math.PI / 2, a + Math.PI / 2, n), ...arc(c0[0], c0[1], r, a + Math.PI / 2, a + Math.PI * 1.5, n)];
}

/**
 * 팔 달린 레버(엘보 레버·벨 크랭크): 한 장의 판 + 받침 보스 + 팔 끝 핀. 회전축 = 로컬 Z, 원점 = 받침 구멍 중심, 판 두께의 가운데가 z = 0.
 * 팔의 pin 은 판에 박힌 강철 핀(표식 child 의 name = pin.name, kind 'pin').
 * 홈이 있으면 userData.outlines.slot_hole = 홈 윤곽(레버 로컬, 핀이 이 안에 있어야 한다).
 * 판 자체의 윤곽은 userData 에 남기지 않는다(다른 층의 부품과 겹쳐 보이는 것이 정상이라 침범 검사 대상이 아니다) — leverOutline 으로 얻는다.
 */
export function elbowLever(arms: readonly LeverArm[], o: ElbowLeverOpts): THREE.Group {
  const thick = o.thick ?? 0.07;
  const metal = o.metal ?? 'iron';
  const mat = (): THREE.Material => (metal === 'brass' ? brass() : metal === 'steel' ? steel() : castIron({ roughness: 0.5 }));
  const g = new THREE.Group();
  const shape = shapeFrom(leverOutline(arms, o.hubR, o.blend ?? 8));
  shape.holes.push(circlePath(0, 0, o.boreR));
  const outlines: Record<string, V2[]> = {};
  for (const a of arms) {
    const end = pol(a.len, a.angle);
    if (a.holeR !== undefined && a.pin === undefined) shape.holes.push(circlePath(end[0], end[1], a.holeR));
    if (a.slot !== undefined) {
      const hole = stadium(pol(a.slot.from, a.angle), pol(a.slot.to, a.angle), a.slot.half, 14);
      shape.holes.push(pathFrom(hole));
      outlines.slot_hole = hole;
    }
  }
  g.add(mesh(extrude(shape, thick, 0.006, 8), mat()));
  g.add(mesh(tubeZ(o.boreR, o.hubR * 0.97, -thick / 2 - 0.012, thick / 2 + 0.012, 0.006, 48), darkSteel()));
  for (const a of arms) {
    if (a.pin === undefined) continue;
    const end = pol(a.len, a.angle);
    g.add(meshAt(cylZ(a.pin.r, a.pin.z0, a.pin.z1, 0.006), steel(), end[0], end[1], 0));
    g.add(meshAt(tubeZ(a.pin.r, Math.min(a.endR * 0.92, a.pin.r * 1.7), -thick / 2 - 0.008, thick / 2 + 0.008, 0.004, 32), darkSteel(), end[0], end[1], 0));
    g.add(meshAt(new THREE.CylinderGeometry(a.pin.r * 0.5, a.pin.r * 0.5, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), end[0], end[1], Math.max(a.pin.z1, thick / 2) + 0.002));
    const mark = new THREE.Object3D();
    mark.name = a.pin.name;
    mark.position.set(end[0], end[1], a.pin.at);
    g.add(markPin(mark));
  }
  if (Object.keys(outlines).length > 0) g.userData.outlines = outlines;
  setMM(g, { kind: 'lever', fn: 'elbowLever', arms: arms.map((a) => ({ len: a.len, angle: a.angle })), pivot: [0, 0, 0] });
  return g;
}

/**
 * 곧은 안내에 끝이 묶인 막대의 풀이: 한쪽 핀 pin, 다른 쪽 핀은 세로선 x = guideX 위(dir = +1 이면 pin 보다 위, −1 이면 아래).
 * end = 안내 쪽 핀 자리, angle = 막대(+X 가 pin → end)의 rotation.z.
 */
export function guidedRod(pin: V2, guideX: number, len: number, dir: 1 | -1): { end: V2; angle: number } {
  const dx = guideX - pin[0];
  const dy = dir * Math.sqrt(Math.max(0, len * len - dx * dx));
  return { end: [guideX, pin[1] + dy], angle: Math.atan2(dy, dx) };
}

// ═══════════════════════════ 155 폴 이송 장치 ═══════════════════════════

/** 155번 치수. 각도는 rad, 길이는 전시 단위. 좌표 기준 = 톱니바퀴 중심, 기준 자세 = 판화(레버의 위 팔이 +Y, 옆 팔이 +X) */
export const K155 = {
  /** 잇수(판화: 한 피치 약 16° → 22개) */
  teeth: 22,
  /** 이끝 반지름 */
  rTip: 0.72,
  /** 이뿌리 반지름 */
  rRoot: 0.614,
  /** 레버 두 팔의 길이(축 중심 ~ 핀). 판화: 이끝 반지름의 1.22배 */
  arm: 0.88,
  /** 기준 자세에서 폴 끝(코)의 가운데 방향(바퀴 중심에서 본 각) — 위 팔에서 시계 쪽으로 28° */
  nibAt: 62 * DEG,
  /** 폴 코의 반각(코 옆면은 바퀴 중심을 지나는 반지름선) */
  nibHalf: 1.68 * DEG,
  /** 앉았을 때 코 밑면과 이뿌리 원 사이 틈 */
  nibClear: 0.003,
  /** 코 윗끝(몸통과 만나는 곳)의 반지름 */
  nibTop: 0.76,
  /** 미는 면과 이 옆면 사이 틈(각) */
  faceGap: 0.05 * DEG,
  /** 폴 받침 보스 반지름 */
  bossR: 0.085,
  /** 핀 반지름(폴 받침 핀·막대 핀) */
  pinR: 0.045,
  /** 폴 손잡이 뿔 끝 원의 중심(받침 핀 기준)과 반지름 */
  horn: [0.4, 0.11] as V2,
  hornR: 0.035,
  /** 한 번 왕복에 보내는 이 수 */
  steps: 2,
  /** 헛걸음(되돌아갈 때 이 하나를 더 넘어가 떨어지는 여유 각) */
  over: 3.2 * DEG,
  /** 왕복 막대의 핀 사이 길이 */
  rod: 0.7
} as const;

/** 한 피치(rad) */
export const PITCH155 = TAU / K155.teeth;
/** 레버의 흔들림 각(양 끝 사이) = 보내는 이 수 × 피치 + 헛걸음 */
export const SWING155 = K155.steps * PITCH155 + K155.over;
/** 기준 자세(폴이 이 옆면에 닿아 앉은 때)의 톱니바퀴 rotation.z — 이 0 번 가운데가 로컬 +X */
export const WHEEL_REF155 = K155.nibAt - K155.nibHalf - K155.faceGap - PITCH155 / 4;

/** 네모 이 톱니바퀴 윤곽(바퀴 로컬, 이 0 번 가운데가 +X, 이 폭 = 반 피치, 옆면은 반지름선). 반시계 */
export function wheelOutline155(teeth: number = K155.teeth, rTip: number = K155.rTip, rRoot: number = K155.rRoot): V2[] {
  const p = TAU / teeth;
  const out: V2[] = [];
  for (let k = 0; k < teeth; k++) {
    const c = k * p;
    out.push(pol(rRoot, c - p / 4), pol(rTip, c - p / 4), pol(rTip, c - p / 12), pol(rTip, c + p / 12), pol(rTip, c + p / 4), pol(rRoot, c + p / 4));
    out.push(pol(rRoot, c + (p * 5) / 12), pol(rRoot, c + (p * 7) / 12));
  }
  return out;
}

export interface ToothWheelOpts {
  /** 폭(z). 기본 0.1 */
  width?: number;
  /** 축 구멍 반지름. 기본 0.09 */
  boreR?: number;
  /** 허브 반지름. 기본 0.17 */
  hubR?: number;
  /** 테 안쪽 반지름(판화의 안쪽 원). 기본 0.69·rTip */
  rimIn?: number;
}

/**
 * 네모 이 톱니바퀴(155번): 회전축 = 로컬 Z, 폭의 가운데가 z = 0, 이 0 번 가운데가 로컬 +X(밝은 표시점).
 * 테(이 + 고리)는 온 폭, 안쪽 판은 얇게(판화의 안쪽 원 = 테 안쪽 가장자리). userData.outline = 이 윤곽.
 * kind 는 'ratchet'(기어 물림 검사·기어 수 세기 대상이 아니다).
 */
export function squareToothWheel(teeth: number = K155.teeth, rTip: number = K155.rTip, rRoot: number = K155.rRoot, o: ToothWheelOpts = {}): THREE.Group {
  const width = o.width ?? 0.1;
  const bore = o.boreR ?? 0.09;
  const hubR = o.hubR ?? 0.17;
  const rimIn = o.rimIn ?? rTip * 0.69;
  const g = new THREE.Group();
  const outline = wheelOutline155(teeth, rTip, rRoot);
  const ring = shapeFrom(outline);
  ring.holes.push(circlePath(0, 0, rimIn));
  g.add(mesh(extrude(ring, width, 0.006, 24), castIron({ roughness: 0.5 })));
  g.add(mesh(tubeZ(bore, rimIn + 0.006, -width * 0.3, width * 0.3, 0.004, 72), castIron({ roughness: 0.6 })));
  g.add(mesh(tubeZ(bore, hubR, -width / 2 - 0.01, width / 2 + 0.01, 0.008, 48), darkSteel()));
  g.add(meshAt(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), (rTip + rRoot) / 2, 0, width / 2 + 0.002));
  g.add(meshAt(new THREE.BoxGeometry(rimIn - hubR - 0.06, 0.014, 0.006), paint(MARK), (rimIn + hubR) / 2, 0, width * 0.3 + 0.002));
  g.userData.outline = outline;
  setMM(g, { kind: 'ratchet', fn: 'squareToothWheel', teeth, ra: rTip, rf: rRoot, width, axis: 'z' });
  return g;
}

/**
 * 폴 윤곽(폴 로컬: 원점 = 받침 핀, 축 방향 = 기준 자세의 세계 축). 반시계.
 * 코(끝)는 바퀴 중심을 지나는 두 반지름선 사이의 쐐기라 미는 면이 이 옆면에 납작하게 닿는다.
 * 몸통은 받침 보스 – 코 – 손잡이 뿔을 잇는 세모꼴(판화: 바깥 변은 곧고 안쪽 변은 오목).
 */
export function pawlOutline155(): V2[] {
  const K = K155;
  const pv: V2 = [0, K.arm];
  const a1 = K.nibAt - K.nibHalf; // 미는 면(시계 쪽)
  const a2 = K.nibAt + K.nibHalf;
  const rb = K.rRoot + K.nibClear;
  const n1b = pol(rb, a1);
  const n1t = pol(K.nibTop, a1);
  const n2b = pol(rb, a2);
  // 코 등쪽(반시계 쪽)은 이끝 원 바로 바깥(r = rTip + 0.012)까지만 반지름선, 그 위는 몸통 쪽으로
  // 넓게 퍼지는 둥근 목(필릿)으로 잇는다 — 꺾인 오목 모서리가 없어 부러질 듯한 가는 목이 생기지 않는다(사용자 지적).
  // 이끝 원 안쪽(이골에 들어가는 부분)은 그대로라 맞물림·들림 풀이는 바뀌지 않는다.
  const n2m = pol(K.rTip + 0.012, a2);
  const neck = pol(K.nibTop + 0.05, a2 + 9 * DEG);
  const hc: V2 = [pv[0] + K.horn[0], pv[1] + K.horn[1]];
  const hornArc = arc(hc[0], hc[1], K.hornR, -20 * DEG, 170 * DEG, 10);
  const bossArc = arc(pv[0], pv[1], K.bossR, 60 * DEG, 320 * DEG, 20);
  const world: V2[] = [
    n1b,
    n1t,
    ...hornArc,
    ...quad(hornArc[hornArc.length - 1]!, [0.2, 0.915], bossArc[0]!, 10),
    ...bossArc,
    ...quad(bossArc[bossArc.length - 1]!, [0.2, 0.84], neck, 10),
    ...quad(neck, pol(K.rTip + 0.02, a2 + 2.5 * DEG), n2m, 12).slice(1),
    n2b
  ];
  return world.map((p): V2 => [p[0] - pv[0], p[1] - pv[1]]);
}

/**
 * 폴(155번): 원점 = 받침 핀 구멍 중심, 두께의 가운데가 z = 0. 레버의 위 팔 핀에 꿰어 레버 그룹의 자식으로 둔다
 * (위치 = 팔 끝, rotation.z = 들림각). userData.outline = 폴 윤곽.
 */
export function pawl155(thick = 0.06): THREE.Group {
  const g = new THREE.Group();
  const outline = pawlOutline155();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, K155.pinR + 0.002));
  g.add(mesh(extrude(shape, thick, 0.005, 12), brass()));
  g.add(meshAt(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 16).rotateX(Math.PI / 2), paint(MARK), K155.horn[0], K155.horn[1], thick / 2 + 0.002));
  g.userData.outline = outline;
  setMM(g, { kind: 'pawl', fn: 'pawl155' });
  return g;
}

// ── 폴 들림 풀이: 바퀴를 기준 자세에 세워 두고, 레버가 반시계로 rho 만큼 더 간 자리에서 폴이 lam 만큼 들렸을 때 겹치는가 ──
let pawlDense: V2[] | null = null;
let wheelNear: V2[] | null = null;
let pawlPoly: V2[] | null = null;

function toothInside(x: number, y: number, tol: number): boolean {
  const r = Math.hypot(x, y);
  if (r < K155.rRoot - tol) return true;
  if (r >= K155.rTip - tol) return false;
  let d = (Math.atan2(y, x) - WHEEL_REF155) % PITCH155;
  if (d > PITCH155 / 2) d -= PITCH155;
  if (d < -PITCH155 / 2) d += PITCH155;
  return Math.abs(d) < PITCH155 / 4 - tol / r;
}

/** 폴이 바퀴와 겹치지 않는가(rho = 레버가 바퀴에 대해 반시계로 간 각, lam = 폴 들림각) */
export function pawlFree155(rho: number, lam: number): boolean {
  if (pawlPoly === null) pawlPoly = pawlOutline155();
  if (pawlDense === null) pawlDense = densify155(pawlPoly, 0.003);
  if (wheelNear === null) {
    wheelNear = [];
    for (let k = -2; k <= 7; k++) {
      const c = WHEEL_REF155 + k * PITCH155;
      for (let i = 0; i <= 18; i++) {
        const r = K155.rRoot + ((K155.rTip - K155.rRoot) * i) / 18;
        wheelNear.push(pol(r, c - PITCH155 / 4), pol(r, c + PITCH155 / 4));
      }
      for (let i = 1; i < 12; i++) wheelNear.push(pol(K155.rTip, c - PITCH155 / 4 + (PITCH155 / 2) * (i / 12)));
    }
  }
  const pv = rot([0, K155.arm], rho);
  const c = Math.cos(rho + lam);
  const s = Math.sin(rho + lam);
  for (const p of pawlDense) {
    if (toothInside(pv[0] + p[0] * c - p[1] * s, pv[1] + p[0] * s + p[1] * c, 0.0004)) return false;
  }
  for (const w of wheelNear) {
    const dx = w[0] - pv[0];
    const dy = w[1] - pv[1];
    if (dx * dx + dy * dy > 0.36) continue;
    const lx = dx * c + dy * s;
    const ly = -dx * s + dy * c;
    if (!inPoly155(lx, ly, pawlPoly)) continue;
    // 가장자리에 살짝 걸친 것(0.0004 이하)은 닿은 것으로 본다
    let near = false;
    for (let i = 0, j = pawlPoly.length - 1; i < pawlPoly.length && !near; j = i++) {
      const a = pawlPoly[j]!;
      const b = pawlPoly[i]!;
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((lx - a[0]) * ex + (ly - a[1]) * ey) / (ex * ex + ey * ey || 1e-12)));
      if (Math.hypot(lx - a[0] - t * ex, ly - a[1] - t * ey) < 0.0004) near = true;
    }
    if (!near) return false;
  }
  return true;
}

const LIFT_N = 720;
const LIFT_MAX = 32 * DEG;
let liftTab: Float64Array | null = null;
let liftBand = 0;

/** 위에서 내려놓은 폴이 멈추는 들림각(rho 는 0 ~ 한 피치) */
function dropLift(rho: number): number {
  const step = 0.2 * DEG;
  let hi = LIFT_MAX;
  if (!pawlFree155(rho, hi)) return hi;
  for (;;) {
    const lo = hi - step;
    if (lo <= 0) return pawlFree155(rho, 0) ? 0 : bisect(rho, 0, hi);
    if (!pawlFree155(rho, lo)) return bisect(rho, lo, hi);
    hi = lo;
  }
}
function bisect(rho: number, blocked: number, free: number): number {
  let lo = blocked;
  let hi = free;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (pawlFree155(rho, mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
function buildLift(): Float64Array {
  const tab = new Float64Array(LIFT_N + 1);
  for (let i = 0; i < LIFT_N; i++) tab[i] = dropLift((i / LIFT_N) * PITCH155);
  tab[LIFT_N] = tab[0]!;
  // 떨어지는 자리: 0 에서부터 처음으로 들림이 0 이 되는 rho
  let b = 0;
  while (b < LIFT_N && tab[b]! > 1e-5) b++;
  liftBand = (b / LIFT_N) * PITCH155;
  return tab;
}

/** 폴이 이 등에서 다음 이골로 떨어지는 자리(앉아서 닿은 자리에서 반시계로 잰 각). K155.over 는 이것보다 커야 한다 */
export function dropAngle155(): number {
  if (liftTab === null) liftTab = buildLift();
  return liftBand;
}

/**
 * 되돌아가는 동안의 폴 들림각. sigma = 되돌아가기 시작한 뒤 레버가 (서 있는) 바퀴에 대해 반시계로 간 각(0 ~ SWING155).
 * 처음엔 이골 안에서 앉은 채 가다가(0), 이 옆면을 타고 올라 이 등을 지나, 다음 이골로 떨어진다.
 */
export function pawlLift155(sigma: number): number {
  if (liftTab === null) liftTab = buildLift();
  if (sigma <= 0) return 0;
  const rho = sigma % PITCH155;
  if (sigma < PITCH155 && rho < liftBand) return 0; // 막 떠난 이골 안(이 등 위가 아니다)
  const f = (rho / PITCH155) * LIFT_N;
  const i = Math.min(LIFT_N - 1, Math.floor(f));
  const a = liftTab[i]!;
  const b = liftTab[i + 1]!;
  // 떨어지는 순간(큰 값 → 0)은 잇지 않고 뚝 떨어뜨린다
  if (Math.abs(a - b) > 3 * DEG) return f - i < 0.5 ? a : b;
  return a + (b - a) * (f - i);
}

export interface State155 {
  /** 레버 rotation.z(판화 자세 = 0, 반시계 +) */
  lever: number;
  /** 톱니바퀴가 기준 자세에서 돈 각(시계 방향이라 음수로 쌓인다). rotation.z = WHEEL_REF155 + wheel */
  wheel: number;
  /** 폴 들림각(레버에 대한 rotation.z) */
  lift: number;
  /** 'takeup' = 헛걸음(폴이 이 옆면에 닿으러 가는 중), 'drive' = 미는 중, 'return' = 되돌아가는 중 */
  phase: 'takeup' | 'drive' | 'return';
  /** 지금까지 보낸 이 수(미는 중에는 소수) */
  fed: number;
}

/**
 * 155번 운동식(모두 theta 의 닫힌 식). 한 주기 = theta 2π: 앞 반(0 ~ π)에 레버가 시계로 SWING155 를 가며 폴이 바퀴를 민다,
 * 뒤 반(π ~ 2π)에 레버만 되돌아가고 바퀴는 선다. 한 주기에 바퀴는 정확히 steps 피치를 가므로 오차가 쌓이지 않는다.
 */
export function state155(theta: number): State155 {
  const S = SWING155;
  const adv = K155.steps * PITCH155;
  const N = Math.floor(theta / TAU);
  const u = theta - N * TAU;
  const a = (S / 2) * Math.cos(u);
  if (u <= Math.PI) {
    const hold = S / 2 - K155.over;
    const w = Math.min(hold, a);
    return { lever: a, wheel: -N * adv + w, lift: 0, phase: a > hold ? 'takeup' : 'drive', fed: N * K155.steps + (hold - w) / PITCH155 };
  }
  return { lever: a, wheel: -N * adv - S / 2, lift: pawlLift155(a + S / 2), phase: 'return', fed: (N + 1) * K155.steps };
}

/** 155번 엘보 레버: 위 팔(+Y, 폴 받침 핀 'pawlPin')과 옆 팔(+X, 막대 핀 'rodPin'). 핀은 판 뒤로 back 만큼 나가 폴·막대를 꿴다 */
export function elbowLever155(back = 0.15, front = 0.05): THREE.Group {
  const K = K155;
  return elbowLever(
    [
      { len: K.arm, angle: 0, endR: 0.1, rootR: 0.19, pin: { r: K.pinR, z0: -back, z1: front, name: 'rodPin', at: -back + 0.04 } },
      { len: K.arm, angle: Math.PI / 2, endR: 0.1, rootR: 0.19, pin: { r: K.pinR, z0: -back, z1: front, name: 'pawlPin', at: -back + 0.04 } }
    ],
    { hubR: 0.235, boreR: 0.093, thick: 0.07, blend: 4, metal: 'iron' }
  );
}

// ═══════════════════════════ 156 홈 있는 벨 크랭크 ═══════════════════════════

/** 156번 치수(판화 비: 핀 0.74R, 받침점은 원판 중심에서 오른쪽 0.55R·아래 1.475R, 짧은 팔 1.56R, 두 팔 직각). 좌표 기준 = 원판 중심 */
export const K156 = {
  /** 원판 반지름 */
  R: 0.42,
  /** 크랭크 반지름(원판 중심 ~ 핀) */
  crank: 0.31,
  /** 핀 반지름 */
  pinR: 0.055,
  /** 벨 크랭크 받침점(원판 중심 기준) */
  pivot: [0.231, -0.6195] as V2,
  /** 홈 난 팔: 받침점 ~ 끝 둥근 머리 중심 */
  slotArm: 1.13,
  /** 홈 양끝 둥근 부분의 중심(받침점에서) */
  slotFrom: 0.24,
  slotTo: 1.12,
  /** 홈 반폭(핀 반지름 + 0.003) */
  slotHalf: 0.058,
  /** 짧은 팔: 받침점 ~ 막대 핀 */
  arm: 0.655,
  /** 막대 핀 반지름 */
  eyePinR: 0.04,
  /** 판화 자세(t = 1)에서 핀의 각 */
  pose: 146 * DEG,
  /** 매달린 막대의 핀 사이 길이 */
  rod: 0.6
} as const;

export interface State156 {
  /** 원판 rotation.z(핀이 로컬 +X) */
  a: number;
  /** 핀 자리(원판 중심 기준) */
  pin: V2;
  /** 벨 크랭크 rotation.z(홈 난 팔이 로컬 +X) */
  lever: number;
  /** 받침점 ~ 핀 거리(핀이 홈 안에서 있는 자리) */
  slide: number;
  /** 짧은 팔 끝 막대 핀 자리(원판 중심 기준) */
  eye: V2;
}

/** 156번 운동식. theta = 구동 누적각(원판 반시계) */
export function state156(theta: number): State156 {
  const K = K156;
  const a = theta - 1.6 + K.pose;
  const pin = pol(K.crank, a);
  const vx = pin[0] - K.pivot[0];
  const vy = pin[1] - K.pivot[1];
  const lever = Math.atan2(vy, vx);
  const e = pol(K.arm, lever - Math.PI / 2);
  return { a, pin, lever, slide: Math.hypot(vx, vy), eye: [K.pivot[0] + e[0], K.pivot[1] + e[1]] };
}

/** 156번 홈 있는 벨 크랭크: 홈 난 팔이 로컬 +X, 짧은 팔이 −Y(직각). 짧은 팔 끝 핀 'eyePin' 은 앞으로 front 까지 나가 막대를 꿴다 */
export function slottedBellCrank156(front = 0.125): THREE.Group {
  const K = K156;
  return elbowLever(
    [
      { len: K.slotArm, angle: 0, endR: 0.11, rootR: 0.11, slot: { from: K.slotFrom, to: K.slotTo, half: K.slotHalf } },
      { len: K.arm, angle: -Math.PI / 2, endR: 0.062, rootR: 0.062, pin: { r: K.eyePinR, z0: -0.02, z1: front, name: 'eyePin', at: front - 0.03 } }
    ],
    { hubR: 0.145, boreR: 0.068, thick: 0.07, blend: 8, metal: 'brass' }
  );
}

// ═══════════════════════════ 157 연결봉 달린 벨 크랭크 ═══════════════════════════

/**
 * 157번 치수. 좌표 기준 = 원판 중심. 막대 길이(크랭크 0.83R, 연결봉 2.44R, 위 팔 1.11R, 옆 팔 1.06R, 두 팔 사이 96.4°)는 판화 비 그대로이고,
 * 받침점 거리만 1.77R → 2.5R 로 늘렸다(판화 치수로는 0.83 + 2.44 > 1.11 + 1.77 이라 원판이 한 바퀴를 못 돈다).
 */
export const K157 = {
  R: 0.42,
  /** 크랭크 반지름 */
  crank: 0.349,
  /** 연결봉 핀 사이 */
  coupler: 1.025,
  /** 벨 크랭크 위 팔(받침점 ~ 연결봉 핀) */
  rocker: 0.466,
  /** 벨 크랭크 옆 팔(받침점 ~ 막대 핀) */
  arm: 0.445,
  /** 두 팔 사이각(위 팔이 옆 팔보다 반시계로) */
  bend: 96.4 * DEG,
  /** 벨 크랭크 받침점(원판 중심 기준) */
  pivot: [1.0496, 0.028] as V2,
  /** 핀 반지름 */
  pinR: 0.04,
  /** t = 1 에서 크랭크 핀의 각 — 이때 위 팔이 판화처럼 96.4°(옆 팔은 수평) */
  pose: 92.86 * DEG,
  /** 매달린 막대의 핀 사이 길이 */
  rod: 0.7
} as const;

export interface State157 {
  /** 원판 rotation.z(핀이 로컬 +X) */
  a: number;
  /** 크랭크 핀(원판 중심 기준) */
  pin: V2;
  /** 연결봉 핀 A(위 팔 끝) */
  top: V2;
  /** 연결봉 rotation.z(원점 = 크랭크 핀, +X 가 A 쪽) */
  coupler: number;
  /** 위 팔의 방향각 */
  rocker: number;
  /** 벨 크랭크 rotation.z(옆 팔이 로컬 +X) */
  lever: number;
  /** 옆 팔 끝 막대 핀 B */
  eye: V2;
  /** 연결봉과 위 팔 사이각(전달각) */
  mu: number;
}

/** 157번 운동식(크랭크–로커 4절 링크, A 는 크랭크 핀 → 받침점 선의 왼쪽 = 위쪽 해). theta = 구동 누적각(원판 반시계) */
export function state157(theta: number): State157 {
  const K = K157;
  const a = theta - 1.6 + K.pose;
  const pin = pol(K.crank, a);
  const ex = K.pivot[0] - pin[0];
  const ey = K.pivot[1] - pin[1];
  const d = Math.hypot(ex, ey);
  const x = (K.coupler * K.coupler - K.rocker * K.rocker + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, K.coupler * K.coupler - x * x));
  const top: V2 = [pin[0] + (x * ex - h * ey) / d, pin[1] + (x * ey + h * ex) / d];
  const rocker = Math.atan2(top[1] - K.pivot[1], top[0] - K.pivot[0]);
  const lever = rocker - K.bend;
  const e = pol(K.arm, lever);
  const mu = Math.acos(Math.max(-1, Math.min(1, (K.coupler * K.coupler + K.rocker * K.rocker - d * d) / (2 * K.coupler * K.rocker))));
  return { a, pin, top, coupler: Math.atan2(top[1] - pin[1], top[0] - pin[0]), rocker, lever, eye: [K.pivot[0] + e[0], K.pivot[1] + e[1]], mu };
}

/** 157번 벨 크랭크: 옆 팔이 로컬 +X(막대 핀 'eyePin'), 위 팔이 bend 만큼 반시계(연결봉 핀 'topPin'). 두 핀은 앞으로 front 까지 */
export function bellCrank157(front = 0.135): THREE.Group {
  const K = K157;
  return elbowLever(
    [
      { len: K.arm, angle: 0, endR: 0.06, rootR: 0.078, pin: { r: K.pinR, z0: -0.02, z1: front, name: 'eyePin', at: front - 0.04 } },
      { len: K.rocker, angle: K.bend, endR: 0.06, rootR: 0.06, pin: { r: K.pinR, z0: -0.02, z1: front, name: 'topPin', at: front - 0.04 } }
    ],
    { hubR: 0.105, boreR: 0.053, thick: 0.07, blend: 8, metal: 'brass' }
  );
}
