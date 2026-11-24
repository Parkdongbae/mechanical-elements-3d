// 107·108·109번 전용 키트 — 홈 캠·역나사 실린더·나사 절삭 묶음
//  107 물결 홈 캠: 홈 캠 드럼(가로축), 핀 달린 미끄럼 막대, 천장 걸이
//  108 역나사 홈 실린더: 오른·왼 나선 홈이 양 끝에서 이어진 실린더(+구동 기어), 안내 막대 위의 미끄럼 블록(뾰족 팔), 선반 틀
//  109 나사 절삭: 어미나사(+기어), 깎이는 나사(+기어·덮개 통), 너트와 공구, 선반 틀
// 치수 상수(K107·K108·K109)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s107.mjs)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, circlePath, circlePts, creased, extrude, hexPrism, lathe, mesh, rodProfile, roundedRect, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { meshAngle, spurGear } from './gear';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 양수 나머지 */
function pmod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

// ═══════════════════════════ 공통: 둥근 삼각파와 홈 곡선 ═══════════════════════════

/**
 * 둥근 삼각파. p = 주기 단위 위상. p = 0 에서 −1, p = 0.5 에서 +1, p = 1 에서 다시 −1.
 * 꼭대기·바닥마다 반주기의 round 배(0~1) 구간을 포물선으로 둥글린다(속도가 끊기지 않게). 나머지는 등속.
 */
export function roundTri(p: number, round: number): number {
  const q0 = p - Math.floor(p);
  const sgn = q0 < 0.5 ? 1 : -1;
  const q = q0 < 0.5 ? q0 : q0 - 0.5;
  const w = Math.max(1e-6, round / 4);
  const s = 2 / (0.5 - w);
  let v: number;
  if (q < w) v = -1 + (s / (2 * w)) * q * q;
  else if (q <= 0.5 - w) v = -1 + (s * w) / 2 + s * (q - w);
  else v = 1 - (s / (2 * w)) * (0.5 - q) * (0.5 - q);
  return sgn * v;
}

/** roundTri 의 기울기 d/dp */
export function roundTriSlope(p: number, round: number): number {
  const q0 = p - Math.floor(p);
  const sgn = q0 < 0.5 ? 1 : -1;
  const q = q0 < 0.5 ? q0 : q0 - 0.5;
  const w = Math.max(1e-6, round / 4);
  const s = 2 / (0.5 - w);
  if (q < w) return (sgn * s * q) / w;
  if (q <= 0.5 - w) return sgn * s;
  return (sgn * s * (0.5 - q)) / w;
}

/**
 * 원통 겉면의 닫힌 홈 곡선. 매개변수 u(rad) = 원통이 돈 각. 따름쇠 자리의 홈 축 방향 위치 = pos(u).
 * 곡선은 u 가 span(= 2π·turns) 만큼 가면 제자리로 돌아와 닫힌다.
 */
export interface GrooveCurve {
  /** 닫히는 매개변수 길이(rad) = 2π·turns */
  span: number;
  /** 닫힐 때까지 원통을 도는 횟수 */
  turns: number;
  /** 축 방향 위치 */
  pos(u: number): number;
  /** d pos / du */
  slope(u: number): number;
  /** 가장 가까운 점 찾기의 시작 오프셋(rad) */
  starts: number[];
  /** 기울기의 최댓값(|d pos/du|) */
  maxSlope: number;
}

/**
 * 반지름 R 원통 겉면의 점(각 alpha, 축 위치 y)에서 홈 중심선까지의 거리(겉면을 편 평면에서).
 * 원통 로컬 좌표: 점 = (R cos alpha, y, R sin alpha). 따름쇠는 alpha = π(−X 쪽)에 있고,
 * 원통을 rotation.y = u 로 돌리면 따름쇠 밑에 재료 각 alpha = π + u 가 온다.
 */
export function grooveDist(c: GrooveCurve, R: number, alpha: number, y: number, reject = Infinity): number {
  const base = pmod(alpha - Math.PI, TAU);
  let best = Infinity;
  for (let k = 0; k < c.turns; k++) {
    const uT = base + TAU * k;
    if (Math.abs(c.pos(uT) - y) > reject) continue;
    for (const o of c.starts) {
      let v = uT + o;
      for (let it = 0; it < 4; it++) {
        const sl = c.slope(v);
        const f = R * R * (v - uT) + (c.pos(v) - y) * sl;
        v -= f / (R * R + sl * sl);
      }
      const d = Math.hypot(R * (v - uT), c.pos(v) - y);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * 홈 띠 윤곽(겉면을 편 평면, 로컬 x = 둘레 길이 R·u, 로컬 y = 축 위치). u ∈ [−pad, span + pad].
 * 편 평면에서는 u 의 함수 그래프라 스스로 겹치지 않는다(겹침은 원통에 감을 때만 생긴다).
 */
export function grooveBand(c: GrooveCurve, R: number, hw: number, step = 0.02, pad = 0.5): V2[] {
  const up: V2[] = [];
  const dn: V2[] = [];
  const n = Math.ceil((c.span + 2 * pad) / step);
  for (let i = 0; i <= n; i++) {
    const u = -pad + ((c.span + 2 * pad) * i) / n;
    const sl = c.slope(u);
    const L = Math.hypot(R, sl);
    const nx = -sl / L;
    const ny = R / L;
    up.push([R * u + hw * nx, c.pos(u) + hw * ny]);
    dn.push([R * u - hw * nx, c.pos(u) - hw * ny]);
  }
  return [...up, ...dn.reverse()];
}

interface GrooveSurfaceOpts {
  /** 홈 반폭(바닥 폭의 절반) */
  hw: number;
  /** 홈 깊이 */
  depth: number;
  /** 홈 벽의 비탈 폭 */
  ramp: number;
  /** 둘레 방향 칸 수 */
  nA: number;
  /** 축 방향 칸 수 */
  nY: number;
}

/** 홈이 파인 원통 겉면(Y축, y0~y1). 높이장 격자 — 바깥이 앞면 */
function grooveSurface(R: number, y0: number, y1: number, c: GrooveCurve, o: GrooveSurfaceOpts): THREE.BufferGeometry {
  const { hw, depth, ramp, nA, nY } = o;
  const reach = hw + ramp;
  const reject = reach * 3 * Math.hypot(1, c.maxSlope / R) + 0.02;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= nA; i++) {
    const al = ((i % nA) / nA) * TAU;
    const ca = Math.cos(al);
    const sa = Math.sin(al);
    for (let j = 0; j <= nY; j++) {
      const y = y0 + ((y1 - y0) * j) / nY;
      let r = R;
      if (j > 0 && j < nY) {
        const d = grooveDist(c, R, al, y, reject);
        if (d < reach) r = R - depth * Math.min(1, (reach - d) / ramp);
      }
      pos.push(r * ca, y, r * sa);
    }
  }
  const W = nY + 1;
  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < nY; j++) {
      const a = i * W + j;
      const b = a + 1;
      const cc = a + W;
      const d = cc + 1;
      idx.push(a, b, cc, b, d, cc);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // 이음매(첫 줄 = 끝 줄)의 법선을 평균해 줄이 보이지 않게
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let j = 0; j <= nY; j++) {
    const a = j;
    const b = nA * W + j;
    const x = nrm.getX(a) + nrm.getX(b);
    const y = nrm.getY(a) + nrm.getY(b);
    const z = nrm.getZ(a) + nrm.getZ(b);
    const L = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(a, x / L, y / L, z / L);
    nrm.setXYZ(b, x / L, y / L, z / L);
  }
  return geo;
}

/**
 * 홈이 파인 원통 겉면(Y축, y0~y1) — 홈이 한 줄(turns = 1)일 때. 격자 줄을 홈 모서리에 맞춰 벽이 또렷하다.
 * 홈 벽의 축 방향 반폭 = 수직 반폭 / cos(기울기).
 */
function grooveSurfaceAligned(R: number, y0: number, y1: number, c: GrooveCurve, hw: number, depth: number, ramp: number, nA: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const ROWS = 10;
  for (let i = 0; i <= nA; i++) {
    const al = ((i % nA) / nA) * TAU;
    const u = al - Math.PI;
    const yc = c.pos(u);
    const sec = Math.hypot(1, c.slope(u) / R);
    const a = hw * sec;
    const b = (hw + ramp) * sec;
    const lo = yc - b;
    const hi = yc + b;
    const ys = [y0, y0 + (lo - y0) / 3, y0 + ((lo - y0) * 2) / 3, lo, yc - a, yc + a, hi, hi + (y1 - hi) / 3, hi + ((y1 - hi) * 2) / 3, y1];
    const rs = [R, R, R, R, R - depth, R - depth, R, R, R, R];
    for (let j = 0; j < ROWS; j++) pos.push(rs[j]! * Math.cos(al), ys[j]!, rs[j]! * Math.sin(al));
  }
  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < ROWS - 1; j++) {
      const p0 = i * ROWS + j;
      const p1 = p0 + 1;
      const p2 = p0 + ROWS;
      const p3 = p2 + 1;
      idx.push(p0, p1, p2, p1, p3, p2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return creased(geo, 40);
}

/** 홈 원통 조립체: group(고정 자리) 안에 rotor(도는 몸)와 검사용 홈 지도(map) */
export interface GrooveBarrel {
  /** 모델이 위치를 정하는 그룹(돌리지 않는다) */
  group: THREE.Group;
  /** 도는 몸 — set 이 돌린다 */
  rotor: THREE.Group;
  /** 침범 검사용 홈 지도(메시 없음). userData.outlines.grooveHole */
  map: THREE.Object3D;
  /** 원통을 angle(rad)로 돌린다(절대 각) */
  set(angle: number): void;
}

/** 침범 검사용 핀 윤곽(원). 로컬 XY 평면 */
function pinOutline(r: number, basis: THREE.Matrix4): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = 'pinOutline';
  o.quaternion.setFromRotationMatrix(basis);
  o.userData.outline = circlePts(r, 32);
  return o;
}

// 홈 지도·핀 윤곽의 방향(로컬 x = 둘레, 로컬 y = 축 방향, 로컬 z = 겉면 법선)
const BASIS_108 = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
const BASIS_107 = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0));

// ═══════════════════════════ 107 물결 홈 캠 ═══════════════════════════

/** 107번 치수(판화 비: 드럼 지름 : 길이 ≈ 2.3 : 1, 앞면에 물결 3주기) */
export const K107 = {
  /** 드럼 반지름 */
  R: 0.48,
  /** 드럼 길이(축 방향) */
  len: 0.42,
  /** 축 반지름 */
  shaftR: 0.07,
  /** 축이 드럼 가운데에서 왼쪽·오른쪽으로 뻗는 길이 */
  shaftL: 0.57,
  shaftRt: 0.46,
  /** 한 바퀴의 물결 수 */
  waves: 6,
  /** 홈 중심선의 진폭(막대 행정의 절반) */
  amp: 0.1,
  /** 꼭대기 둥글림(반주기의 비) */
  round: 0.5,
  /** 홈 반폭·깊이 */
  hw: 0.026,
  depth: 0.05,
  /** 핀 반지름 */
  pinR: 0.022,
  /** 미끄럼 막대 반지름·길이 */
  barR: 0.035,
  barLen: 0.84,
  /** 막대 축이 드럼 윗면보다 높은 거리 */
  barUp: 0.16,
  /** 걸이 x(±), 걸이 두께(x) */
  hangerX: 0.228,
  hangerW: 0.09,
  /** 막대 축에서 천장 들보 밑면까지 */
  ceilUp: 0.335,
  /** 판화 자세(t = 1)의 캠 각(rad): 핀이 가운데를 오른쪽으로 지나는 순간 */
  pose: (5 * Math.PI) / 12
} as const;

/** 107번 홈 곡선(한 바퀴에 물결 waves 개) */
export function cam107Curve(): GrooveCurve {
  const { waves, amp, round } = K107;
  const lam = TAU / waves;
  return {
    span: TAU,
    turns: 1,
    pos: (u) => amp * roundTri((waves * u) / TAU, round),
    slope: (u) => (amp * roundTriSlope((waves * u) / TAU, round) * waves) / TAU,
    starts: [0, lam / 4, -lam / 4, lam / 2, -lam / 2],
    maxSlope: (amp * (4 / (1 - round / 2)) * waves) / TAU
  };
}

/**
 * 107번 운동식. theta = 구동 누적각. 캠은 theta 의 절반 빠르기로 돈다(물결 6개라 막대가 너무 떨지 않게).
 * a = 캠 각(rotation.x), x = 막대(핀)의 가로 위치(드럼 가운데 기준), p = 물결 위상(주기 단위).
 */
export function cam107(theta: number): { a: number; x: number; p: number } {
  const a = theta / 2 - 0.8 + K107.pose;
  const p = (K107.waves * a) / TAU;
  return { a, x: K107.amp * roundTri(p, K107.round), p };
}

/**
 * 물결 홈 캠 드럼(107번): 회전축 = 로컬 X, 원점 = 드럼 가운데. set(a) 가 rotor.rotation.x = a 로 돌린다.
 * 따름쇠 핀은 윗면(+Y)에 있고, 그 자리의 홈 가로 위치 = cam107Curve().pos(a).
 * 축은 왼쪽 −shaftL, 오른쪽 +shaftRt 까지. rotor 이름 'drum'. map = 검사용 홈 지도(grooveHole).
 */
export function camDrum107(): GrooveBarrel {
  const { R, len, shaftR, hw, depth } = K107;
  const c = cam107Curve();
  const group = new THREE.Group();
  const rotor = new THREE.Group();
  rotor.name = 'drum';
  group.add(rotor);
  const ch = 0.012;
  const h = len / 2;
  const body = bronze({ roughness: 0.4, grain: false });
  const toX = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateZ(-Math.PI / 2); // +Y → +X
  rotor.add(mesh(toX(grooveSurfaceAligned(R, -h + ch, h - ch, c, hw, depth, 0.006, 720)), body));
  rotor.add(mesh(toX(lathe([[0, -h], [R - ch, -h], [R, -h + ch]], 96)), bronze({ roughness: 0.4 })));
  rotor.add(mesh(toX(lathe([[R, h - ch], [R - ch, h], [0, h]], 96)), bronze({ roughness: 0.4 })));
  rotor.add(mesh(toX(lathe(rodProfile(shaftR, -K107.shaftL, K107.shaftRt, 0.01, 0.01), 32)), steel()));
  rotor.add(mesh(toX(lathe(tubeProfile(shaftR - 0.002, 0.14, -h - 0.04, -h + 0.002, 0.008), 40)), darkSteel()));
  rotor.add(mesh(toX(lathe(tubeProfile(shaftR - 0.002, 0.14, h - 0.002, h + 0.04, 0.008), 40)), darkSteel()));
  // 표시: 오른쪽 옆면의 반지름 띠(회전이 보이게)
  rotor.add(meshAt(new THREE.BoxGeometry(0.008, R - 0.2, 0.03), paint(MARK), h + 0.003, (R + 0.14) / 2 - 0.02, 0));
  const map = new THREE.Object3D();
  map.name = 'grooveMap';
  map.quaternion.setFromRotationMatrix(BASIS_107);
  map.userData.outlines = { grooveHole: grooveBand(c, R, hw, 0.01, 0.6) };
  group.add(map);
  const set = (angle: number): void => {
    rotor.rotation.x = angle;
    map.position.set(0, R, R * pmod(angle, c.span));
  };
  set(0);
  setMM(group, { kind: 'camDrum', fn: 'camDrum107', axis: 'x', r: R, width: len, waves: K107.waves, amp: K107.amp });
  return { group, rotor, map, set };
}

/**
 * 핀 달린 미끄럼 막대(107번): 원점 = 막대 축 위, 핀 바로 위. 막대는 X 방향(길이 barLen), 가운데 블록 아래로 핀이 −Y 로 내려가
 * 드럼 홈(막대 축에서 barUp 아래가 드럼 윗면)에 꽂힌다. child 'followerPin'(드럼 윗면 높이), 'pinOutline'(검사용 원).
 */
export function sliderBar107(): THREE.Group {
  const { barR, barLen, barUp, pinR, depth } = K107;
  const g = new THREE.Group();
  const bar = lathe(rodProfile(barR, -barLen / 2, barLen / 2, 0.008, 0.008), 28);
  bar.rotateZ(-Math.PI / 2);
  g.add(mesh(bar, steel()));
  g.add(mesh(extrude(roundedRect(-0.065, -0.055, 0.065, 0.055, 0.014), 0.11, 0.008), brass()));
  // 블록 앞면의 조임 나사 머리
  const head = hexPrism(0.045, 0.02, false, true, 0);
  head.rotateX(Math.PI / 2);
  g.add(meshAt(head, darkSteel(), 0, 0, 0.062));
  // 핀 목(굵은 부분)과 핀
  g.add(mesh(lathe([[0, -0.1], [0.03, -0.1], [0.042, -0.05], [0, -0.05]], 28), brass()));
  const tip = -(barUp + depth - 0.008);
  g.add(mesh(lathe(rodProfile(pinR, tip, -0.06, 0.006, 0), 24), steel()));
  const pin = new THREE.Object3D();
  pin.name = 'followerPin';
  pin.position.set(0, -barUp, 0);
  g.add(markPin(pin));
  const ol = pinOutline(pinR, BASIS_107);
  ol.position.set(0, -barUp, 0);
  g.add(ol);
  setMM(g, { kind: 'slider', fn: 'sliderBar107', axis: 'x', pinR });
  return g;
}

/**
 * 천장 들보와 걸이 두 개(107번): 원점 = 막대 축의 가운데(걸이 구멍 높이). 걸이는 x = ±hangerX, 구멍 축 = X.
 * 들보는 뒤판(z = STAGE.backZ)에 붙는다. zc = 막대 축의 월드 z.
 */
export function hangerFrame107(zc: number): THREE.Group {
  const { hangerX, hangerW, ceilUp, barR } = K107;
  const g = new THREE.Group();
  const z0 = STAGE.backZ - 0.005 - zc;
  const z1 = 0.2;
  g.add(meshAt(new THREE.BoxGeometry(1.46, 0.2, z1 - z0), wood(0x8a5a36), -0.07, ceilUp + 0.1, (z0 + z1) / 2));
  for (const sx of [-1, 1]) {
    const shape = roundedRect(-0.08, -0.1, 0.08, ceilUp + 0.004, 0.02);
    shape.holes.push(circlePath(0, 0, barR + 0.005));
    const geo = extrude(shape, hangerW, 0.006, 20);
    geo.rotateY(Math.PI / 2);
    g.add(meshAt(geo, castIron({ roughness: 0.6 }), sx * hangerX, 0, 0));
  }
  setMM(g, { kind: 'frame', fn: 'hangerFrame107' });
  return g;
}

// ═══════════════════════════ 108 역나사 홈 실린더 ═══════════════════════════

/** 108번 치수(판화 비: 실린더 지름 : 리드 ≈ 2.3 : 1, 앞면 교차 5곳, 기어가 실린더보다 크다) */
export const K108 = {
  /** 실린더 반지름 */
  R: 0.3,
  /** 나선 리드(한 바퀴에 오르는 높이) */
  lead: 0.26,
  /** 한쪽 방향 곧은 나선의 바퀴 수 */
  straight: 4,
  /** 양 끝 되돌이 구간의 각(rad) — 반 바퀴 */
  turnAngle: Math.PI,
  /** 홈 반폭·깊이 */
  hw: 0.026,
  depth: 0.045,
  /** 따름 핀 반지름 */
  pinR: 0.022,
  /** 실린더 몸통의 아래·위 끝(홈 가운데 기준) */
  bodyLo: -0.78,
  bodyHi: 0.7,
  /** 축(저널) 반지름과 아래·위 끝 */
  journalR: 0.062,
  journalLo: -1.09,
  journalHi: 0.96,
  /** 기어: 잇수·모듈·폭·가운데 높이 */
  gearTeeth: 48,
  gearModule: 0.02,
  gearW: 0.09,
  gearY: -0.825,
  /** 안내 막대: 실린더 축에서 왼쪽으로 떨어진 거리, 반지름 */
  rodDX: 0.85,
  rodR: 0.04,
  /** 선반 판: 아래 판 윗면, 위 판 아랫면, 두께 */
  plateLo: -0.9,
  plateHi: 0.73,
  plateT: 0.16,
  /** 실린더 각 = 2·theta + pose */
  pose: 8.76
} as const;

/** 108번 홈 곡선: 올라가는 나선 4바퀴 + 반 바퀴 되돌이 + 내려가는 나선 4바퀴 + 반 바퀴 되돌이 = 9바퀴에 닫힌다 */
export function traverse108Curve(): GrooveCurve {
  const { lead, straight, turnAngle } = K108;
  const half = straight * TAU + turnAngle; // 반주기(rad)
  const span = 2 * half;
  const round = turnAngle / half;
  const c = lead / TAU; // 곧은 구간 기울기(길이/rad)
  const amp = (c * half * (1 - round / 2)) / 2;
  return {
    span,
    turns: Math.round(span / TAU),
    pos: (u) => amp * roundTri(u / span, round),
    slope: (u) => (amp * roundTriSlope(u / span, round)) / span,
    starts: [0, turnAngle / 2, -turnAngle / 2],
    maxSlope: c
  };
}

/** 108번 따름쇠 행정의 절반(홈 중심선 진폭) */
export function traverse108Amp(): number {
  return Math.abs(traverse108Curve().pos(0));
}

/**
 * 108번 운동식. theta = 구동 누적각. 실린더는 2·theta 로 돈다(18π 에 한 번 왕복 — 17.7 s).
 * psi = 실린더 각(rotation.y), y = 따름쇠 높이(홈 가운데 기준), up = 올라가는 중인가.
 */
export function traverse108(theta: number): { psi: number; y: number; up: boolean } {
  const c = traverse108Curve();
  const psi = 2 * theta + K108.pose;
  return { psi, y: c.pos(psi), up: c.slope(psi) >= 0 };
}

/**
 * 역나사 홈 실린더(108번): 회전축 = 로컬 Y, 원점 = 홈 구간의 가운데. set(psi) 가 rotor.rotation.y = psi 로 돌린다.
 * 따름쇠는 −X 쪽(x = −R)에 있고, 그 자리의 홈 높이 = traverse108Curve().pos(psi).
 * rotor(이름 'cylinder')에 몸통·위 테·축·구동 기어(이름 'driveGear')가 함께 돈다. map = 검사용 홈 지도.
 */
export function reverseCylinder108(): GrooveBarrel {
  const k = K108;
  const R = k.R;
  const c = traverse108Curve();
  const amp = traverse108Amp();
  const group = new THREE.Group();
  const rotor = new THREE.Group();
  rotor.name = 'cylinder';
  group.add(rotor);
  const gy = Math.ceil((amp + k.hw + 0.03) * 100) / 100; // 격자 구간의 반높이
  rotor.add(mesh(grooveSurface(R, -gy, gy, c, { hw: k.hw, depth: k.depth, ramp: 0.012, nA: 192, nY: Math.round((2 * gy) / 0.0035) }), brass({ grain: false })));
  const ch = 0.01;
  rotor.add(mesh(lathe([[0, k.bodyLo], [R - ch, k.bodyLo], [R, k.bodyLo + ch], [R, -gy]], 96), brass()));
  const fl = R + 0.014;
  rotor.add(
    mesh(
      lathe([[R, gy], [R, k.bodyHi - 0.065], [fl, k.bodyHi - 0.065], [fl, k.bodyHi - ch], [fl - ch, k.bodyHi], [0, k.bodyHi]], 96),
      brass()
    )
  );
  rotor.add(mesh(lathe(rodProfile(k.journalR, k.journalLo, k.journalHi, 0.008, 0.008), 32), steel()));
  const gear = spurGear(k.gearTeeth, k.gearModule, { width: k.gearW, spokes: 6, driver: true });
  gear.name = 'driveGear';
  gear.rotation.x = -Math.PI / 2;
  gear.position.y = k.gearY;
  rotor.add(gear);
  const map = new THREE.Object3D();
  map.name = 'grooveMap';
  map.quaternion.setFromRotationMatrix(BASIS_108);
  map.userData.outlines = { grooveHole: grooveBand(c, R, k.hw, 0.03, 0.8) };
  group.add(map);
  const set = (psi: number): void => {
    rotor.rotation.y = psi;
    map.position.set(-R, 0, R * pmod(psi, c.span));
  };
  set(0);
  setMM(group, { kind: 'grooveCylinder', fn: 'reverseCylinder108', axis: 'y', r: R, lead: k.lead, amp });
  return { group, rotor, map, set };
}

/**
 * 미끄럼 블록과 뾰족 팔(108번): 원점 = 안내 막대 축 위, 팔 높이. 팔은 +X 로 뻗어 끝 핀이 실린더 홈(x = rodDX − R 이 겉면)에 꽂힌다.
 * child 'followerPin'(겉면 자리), 'pinOutline'(검사용 원).
 */
export function slider108(): THREE.Group {
  const k = K108;
  const g = new THREE.Group();
  const shape = roundedRect(-0.14, -0.1, 0.14, 0.1, 0.02);
  shape.holes.push(circlePath(0, 0, k.rodR + 0.005));
  const block = extrude(shape, 0.19, 0.008, 20);
  block.rotateX(Math.PI / 2);
  g.add(mesh(block, bronze({ roughness: 0.4 })));
  const surf = k.rodDX - k.R;
  const tip = surf + k.depth - 0.008;
  const arm = lathe(
    [
      [0, 0.13],
      [0.05, 0.13],
      [0.05, 0.17],
      [0.026, surf - 0.1],
      [k.pinR, surf - 0.06],
      [k.pinR, tip - 0.008],
      [k.pinR - 0.008, tip],
      [0, tip]
    ],
    28
  );
  arm.rotateZ(-Math.PI / 2);
  g.add(mesh(arm, steel()));
  const pin = new THREE.Object3D();
  pin.name = 'followerPin';
  pin.position.set(surf, 0, 0);
  g.add(markPin(pin));
  const ol = pinOutline(k.pinR, BASIS_108);
  ol.position.set(surf, 0, 0);
  g.add(ol);
  setMM(g, { kind: 'slider', fn: 'slider108', axis: 'y', pinR: k.pinR });
  return g;
}

/** 구멍 뚫린 선반 판: 평면 (x, z) 의 둥근 네모, 두께 t(y 가운데 정렬). holes = [x, z, 반지름][] */
function shelfPlate(x0: number, x1: number, z0: number, z1: number, t: number, holes: [number, number, number][]): THREE.BufferGeometry {
  // extrude 뒤 rotateX(+90°): (x, y, z) → (x, −z, y) — 모양의 y 가 그대로 z 가 되고 두께가 y 로 선다
  const shape = roundedRect(x0, z0, x1, z1, 0.03);
  for (const [hx, hz, hr] of holes) shape.holes.push(circlePath(hx, hz, hr));
  const geo = extrude(shape, t, 0.008, 20);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/**
 * 선반 틀(108번): 원점 = 실린더 축 위, 홈 구간의 가운데(실린더·블록과 같은 원점). 위·아래 판이 뒤판에 붙고,
 * 판 사이 왼쪽(x = −rodDX)에 안내 막대가 선다. zc = 실린더 축의 월드 z.
 */
export function frame108(zc: number): THREE.Group {
  const k = K108;
  const g = new THREE.Group();
  const z0 = STAGE.backZ - 0.005 - zc;
  const z1 = 0.16;
  const x0 = -k.rodDX - 0.14;
  const x1 = 0.26;
  const iron = (): THREE.Material => castIron({ roughness: 0.6 });
  g.add(
    meshAt(
      shelfPlate(x0, x1, z0, z1, k.plateT, [
        [0, 0, k.journalR + 0.006],
        [-k.rodDX, 0, k.rodR + 0.003]
      ]),
      iron(),
      0,
      k.plateLo - k.plateT / 2,
      0
    )
  );
  g.add(
    meshAt(
      shelfPlate(x0, x1, z0, z1, k.plateT, [
        [0, 0, k.journalR + 0.006],
        [-k.rodDX, 0, k.rodR + 0.003]
      ]),
      iron(),
      0,
      k.plateHi + k.plateT / 2,
      0
    )
  );
  const lo = k.plateLo - k.plateT;
  const hi = k.plateHi + k.plateT;
  g.add(meshAt(lathe(rodProfile(k.rodR, lo - 0.05, hi + 0.05, 0.006, 0.006), 28), steel(), -k.rodDX, 0, 0));
  g.add(meshAt(hexPrism(0.13, 0.035, false, true, k.rodR), darkSteel(), -k.rodDX, hi + 0.0175, 0));
  g.add(meshAt(hexPrism(0.13, 0.035, true, false, k.rodR), darkSteel(), -k.rodDX, lo - 0.0175, 0));
  setMM(g, { kind: 'frame', fn: 'frame108' });
  return g;
}

// ═══════════════════════════ 109 나사 절삭 ═══════════════════════════

/** 109번 치수(판화 비: 기어 반지름 ≈ 5 : 8, 두 나사 굵기 거의 같음) */
export const K109 = {
  /** 잇수: 어미나사 쪽, 깎이는 나사 쪽 */
  zL: 20,
  zW: 32,
  module: 0.03,
  /** 축 사이 거리 = module·(zL + zW)/2 */
  C: 0.78,
  /** 어미나사: 피치, 골·산 반지름(왼나사) */
  pL: 0.12,
  leadRoot: 0.11,
  leadOuter: 0.15,
  /** 깎이는 나사: 피치 = pL·zW/zL, 골·산(= 소재) 반지름(오른나사) */
  pW: 0.192,
  workRoot: 0.105,
  workOuter: 0.14,
  /** 깎이는 나사의 골: 겉면에서의 반폭(피치의 0.22배) */
  grooveHalf: 0.042,
  /** 나사 구간 길이(가운데가 원점) */
  threadLen: 1.54,
  /** 기어 폭·가운데 높이 */
  gearW: 0.12,
  gearY: -0.87,
  /** 저널 반지름: 어미나사 아래, 깎이는 나사 아래, 두 축 위 */
  journalL: 0.04,
  journalW: 0.065,
  journalTop: 0.05,
  journalLo: -1.15,
  journalHi: 1.05,
  /** 공구가 깎기 시작하는 높이, 깎는 동안 어미나사가 도는 바퀴 수 */
  yTop: 0.5,
  cutTurns: 9,
  /** 선반 판: 위 판 아랫면, 아래 판 윗면, 두께 */
  plateHi: 0.81,
  plateHiT: 0.18,
  plateLo: -0.99,
  plateLoT: 0.12,
  /** 너트 블록: 왼쪽·오른쪽 끝(x), 높이, 깊이(z) */
  nutX0: -0.29,
  nutX1: 0.27,
  nutH: 0.2,
  nutD: 0.34
} as const;

/** 109번 한 주기의 theta 길이: 깎기 6π(어미나사 3·theta 로 9바퀴) + 되돌리기 3π(6·theta 로 거꾸로) */
export const CYCLE109 = 9 * Math.PI;

/** 깎이는 나사의 위상(rad): 공구 끝이 늘 나사 골 가운데에 오게 하는 값 */
function workPhase109(): number {
  return pmod((TAU * (K109.pW / 2 - K109.yTop)) / K109.pW, TAU);
}

export interface ScrewCut109 {
  /** 주기 안의 위상(0 ~ CYCLE109) */
  u: number;
  /** 깎는 중인가(아니면 되돌리는 중) */
  cutting: boolean;
  /** 어미나사가 시작부터 돈 각(rad, 0 ~ 18π) */
  a: number;
  /** 어미나사의 rotation.y */
  lead: number;
  /** 깎이는 나사의 회전각 — workPiece109().set 에 넣는다 */
  work: number;
  /** 너트·공구의 높이(나사 구간 가운데 기준) */
  nutY: number;
  /** 깎인 끝의 높이(깎는 중에는 공구 높이, 되돌리는 중에는 맨 아래) — workPiece109().set 에 넣는다 */
  cutY: number;
  /** 깎은 길이 / 전체 길이 (0~1) */
  progress: number;
}

/**
 * 109번 운동식(주기 시간표, theta 의 닫힌 식). 판화 자세(t = 1)는 공구가 가운데쯤(깎은 길이 44 %).
 * 어미나사(왼나사)가 위에서 보아 시계 방향으로 돌면 너트가 내려가고, 맞물린 기어로 깎이는 나사는 반대로 0.625배 돈다.
 * 다 깎으면 두 나사가 2배 빠르기로 거꾸로 돌아 공구가 같은 골을 타고 올라오고, 주기 끝에서 새 소재로 바뀐다.
 */
export function screwCut109(theta: number): ScrewCut109 {
  const k = K109;
  const u = pmod(theta - 1.6 + (8 * Math.PI) / 3, CYCLE109);
  const uc = (k.cutTurns * TAU) / 3; // 깎기 구간의 theta 길이(어미나사 = 3·theta)
  const cutting = u < uc;
  const a = cutting ? 3 * u : 3 * uc - 6 * (u - uc);
  const nutY = k.yTop - (k.pL * a) / TAU;
  const endY = k.yTop - k.pL * k.cutTurns;
  return {
    u,
    cutting,
    a,
    lead: -a,
    work: (k.zL / k.zW) * a + workPhase109(),
    nutY,
    cutY: cutting ? nutY : endY,
    progress: cutting ? a / (TAU * k.cutTurns) : 1
  };
}

/**
 * 나사산(Y축, 원점 가운데). 산 가운데는 각 ψ 에서 (−r cos ψ, hand·pitch·ψ/2π, r sin ψ) — 그룹을 rotation.y = β 로 돌리면
 * −X 쪽(공구 쪽)의 산 가운데 높이 = −hand·pitch·β/2π (+ k·pitch). hand = +1 오른나사(정면에서 "/"), −1 왼나사("\").
 * tipHalf·rootHalf = 산 꼭대기·뿌리의 반폭.
 */
function helixThread(root: number, outer: number, pitch: number, length: number, hand: 1 | -1, tipHalf: number, rootHalf: number): THREE.BufferGeometry {
  const rIn = root - 0.006;
  const prof: V2[] = [
    [-rootHalf, rIn],
    [-tipHalf, outer],
    [tipHalf, outer],
    [rootHalf, rIn]
  ];
  const turns = (length - 2 * rootHalf) / pitch;
  const steps = Math.ceil(turns * 64);
  const pos: number[] = [];
  const idx: number[] = [];
  const at = (u: number, r: number, j: number): [number, number, number] => {
    const psi = -Math.PI * turns + (j / steps) * TAU * turns;
    return [-r * Math.cos(psi), (hand * pitch * psi) / TAU + u, r * Math.sin(psi)];
  };
  for (let e = 0; e < 4; e++) {
    const a = prof[e]!;
    const b = prof[(e + 1) % 4]!;
    const base = pos.length / 3;
    for (let j = 0; j <= steps; j++) pos.push(...at(a[0], a[1], j), ...at(b[0], b[1], j));
    for (let j = 0; j < steps; j++) {
      const i0 = base + j * 2;
      idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
  }
  for (const j of [0, steps]) {
    const base = pos.length / 3;
    for (const [u, r] of prof) pos.push(...at(u, r, j));
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // 부피 부호로 바깥쪽이 앞면이 되게 감김 방향을 맞춘다
  let vol = 0;
  for (let q = 0; q < idx.length; q += 3) {
    const i = idx[q]! * 3;
    const j = idx[q + 1]! * 3;
    const l = idx[q + 2]! * 3;
    vol +=
      pos[i]! * (pos[j + 1]! * pos[l + 2]! - pos[j + 2]! * pos[l + 1]!) -
      pos[i + 1]! * (pos[j]! * pos[l + 2]! - pos[j + 2]! * pos[l]!) +
      pos[i + 2]! * (pos[j]! * pos[l + 1]! - pos[j + 1]! * pos[l]!);
  }
  if (vol < 0) {
    for (let q = 0; q < idx.length; q += 3) {
      const t = idx[q + 1]!;
      idx[q + 1] = idx[q + 2]!;
      idx[q + 2] = t;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Y축 나사(속심 + 나사산 + 위·아래 저널) */
function screwY(root: number, outer: number, pitch: number, hand: 1 | -1, tipHalf: number, rootHalf: number, mat: () => THREE.Material, journalLoR: number): THREE.Group {
  const k = K109;
  const g = new THREE.Group();
  const h = k.threadLen / 2;
  g.add(mesh(lathe(rodProfile(root, -h, h, 0.01, 0.01), 40), mat()));
  const th = mesh(helixThread(root, outer, pitch, k.threadLen, hand, tipHalf, rootHalf), mat());
  th.name = 'thread';
  g.add(th);
  g.add(mesh(lathe(rodProfile(journalLoR, k.journalLo, -h + 0.01, 0.006, 0), 28), steel()));
  g.add(mesh(lathe(rodProfile(k.journalTop, h - 0.01, k.journalHi, 0, 0.006), 28), steel()));
  return g;
}

/**
 * 어미나사(109번): 회전축 = 로컬 Y, 원점 = 나사 구간 가운데. 왼나사(정면에서 산이 "\" 로 기운다) + 아래 기어 20(이름 'gearL').
 * 그룹 이름 'leadScrew'. rotation.y = screwCut109().lead.
 */
export function leadScrew109(): THREE.Group {
  const k = K109;
  const g = screwY(k.leadRoot, k.leadOuter, k.pL, -1, 0.2 * k.pL, 0.3 * k.pL, () => bronze({ roughness: 0.36, grain: false }), k.journalL);
  g.name = 'leadScrew';
  const gear = spurGear(k.zL, k.module, { width: k.gearW, spokes: 4, driver: true });
  gear.name = 'gearL';
  gear.rotation.x = -Math.PI / 2;
  gear.position.y = k.gearY;
  g.add(gear);
  setMM(g, { kind: 'screw', fn: 'leadScrew109', axis: 'y', pitch: k.pL, leftHand: true });
  return g;
}

/** 깎이는 나사 조립체 */
export interface WorkPiece109 {
  /** 모델이 위치를 정하는 그룹(돌리지 않는다) */
  group: THREE.Group;
  /** 도는 몸(나사·기어·저널). 이름 'workScrew' */
  rotor: THREE.Group;
  /** 회전각과 깎인 끝 높이를 정한다 — set(screwCut109().work, screwCut109().cutY) */
  set(angle: number, cutY: number): void;
}

/**
 * 깎이는 나사(109번): 회전축 = 로컬 Y, 원점 = 나사 구간 가운데. 오른나사(정면에서 산이 "/" 로 기운다) + 아래 기어 32(이름 'gearW').
 * 나사 골은 처음부터 다 파 두고, 아직 안 깎인 쪽은 소재 굵기의 덮개 통이 가린다. 통의 윗면은 방금 깎인 골의 아래 모서리를 따라
 * 한 바퀴 오르는 비탈이고, 공구 자리(−X 쪽)에 한 피치 높이의 턱(깎이는 면)이 있다 — 통은 돌지 않고 공구와 함께 내려간다.
 * set(work, cutY) 로 두면 공구 끝이 늘 골 가운데에 있고 기어 이도 맞물린다(위상은 키트가 맞춰 둠).
 */
export function workPiece109(): WorkPiece109 {
  const k = K109;
  const group = new THREE.Group();
  const tipHalf = k.pW / 2 - k.grooveHalf;
  const rotor = screwY(k.workRoot, k.workOuter, k.pW, 1, tipHalf, tipHalf + 0.02, () => brass({ grain: false }), k.journalW);
  rotor.name = 'workScrew';
  group.add(rotor);
  const gear = spurGear(k.zW, k.module, { width: k.gearW, spokes: 6 });
  gear.name = 'gearW';
  // 기어 물림 위상: 위에서 본 평면 (X, −Z) 에서 기어 L 의 각 = lead, 기어 W 의 각 = work + delta
  const delta = meshAngle([0, 0], k.zL, 0, [k.C, 0], k.zW) - workPhase109();
  gear.rotation.set(-Math.PI / 2, 0, delta);
  gear.position.y = k.gearY;
  rotor.add(gear);
  setMM(rotor, { kind: 'screw', fn: 'workPiece109', axis: 'y', pitch: k.pW, leftHand: false });

  // 덮개 통: 아래 곧은 통(높이를 늘였다 줄였다) + 위 비탈 통(공구와 함께 내려감)
  const h = k.threadLen / 2;
  const ro = k.workOuter + 0.003;
  const ri = k.workRoot - 0.01;
  const skirt = 0.03; // 비탈 통이 골 아래 모서리보다 더 내려간 길이
  const blank = (): THREE.Material => brass({ roughness: 0.42, grain: false });
  const lower = mesh(lathe([[ro, 0], [ro, 1]], 64), blank());
  lower.name = 'blank';
  lower.position.y = -h;
  group.add(lower);
  const N = 72;
  const pos: number[] = [];
  const idx: number[] = [];
  // 각 e(공구를 지난 각, 0 → 2π)마다 [바깥 아래, 바깥 위, 안 위]
  for (let i = 0; i <= N; i++) {
    const e = (i / N) * TAU;
    const al = Math.PI - e; // 재료는 월드 각이 줄어드는 쪽으로 지나간다
    const top = -k.grooveHalf + (k.pW * e) / TAU;
    const cx = Math.cos(al);
    const sz = Math.sin(al);
    pos.push(ro * cx, -k.grooveHalf - skirt, ro * sz, ro * cx, top, ro * sz, ri * cx, top, ri * sz);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3;
    const b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  // 턱(깎이는 면): e = 0 과 e = 2π 사이의 세로 벽(공구 자리, −X 쪽)
  const s0 = pos.length / 3;
  const lo = -k.grooveHalf;
  const hi = -k.grooveHalf + k.pW;
  pos.push(-ro, lo, 0, -ro, hi, 0, -ri, hi, 0, -ri, lo, 0);
  idx.push(s0, s0 + 1, s0 + 2, s0, s0 + 2, s0 + 3);
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cg.setIndex(idx);
  const crownMat = brass({ roughness: 0.42, grain: false });
  crownMat.side = THREE.DoubleSide;
  const crown = mesh(creased(cg, 40), crownMat);
  crown.name = 'cutFace';
  group.add(crown);
  const set = (angle: number, cutY: number): void => {
    rotor.rotation.y = angle;
    crown.position.y = cutY;
    lower.scale.y = Math.max(0.01, cutY - k.grooveHalf - skirt + 0.004 + h);
  };
  set(workPhase109(), k.yTop);
  setMM(group, { kind: 'workPiece', fn: 'workPiece109' });
  return { group, rotor, set };
}

/**
 * 너트 블록과 절삭 공구(109번): 원점 = 어미나사 축 위, 공구 높이. 블록이 어미나사를 감싸고, 공구는 +X 로 뻗어
 * 끝이 깎이는 나사(축이 +C)의 골 바닥 바로 앞에 닿는다. 블록 뒤의 돌기가 뒤판 안내 레일 사이로 들어가 돌지 않게 한다(판화에 없음).
 * child 'toolTip'. zc = 어미나사 축의 월드 z.
 */
export function nutTool109(zc: number): THREE.Group {
  const k = K109;
  const g = new THREE.Group();
  const shape = roundedRect(k.nutX0, -k.nutD / 2, k.nutX1, k.nutD / 2, 0.02);
  shape.holes.push(circlePath(0, 0, k.leadOuter + 0.005));
  const block = extrude(shape, k.nutH, 0.008, 24);
  block.rotateX(Math.PI / 2);
  g.add(mesh(block, castIron({ roughness: 0.55 })));
  const tip = k.C - k.workRoot - 0.004;
  const tool = lathe(
    [
      [0, k.nutX1 - 0.02],
      [0.024, k.nutX1 - 0.02],
      [0.024, tip - 0.07],
      [0.004, tip],
      [0, tip]
    ],
    20
  );
  tool.rotateZ(-Math.PI / 2);
  g.add(mesh(tool, steel()));
  // 뒤 돌기: 블록 뒷면에서 뒤판 바로 앞까지
  const zb = STAGE.backZ + 0.015 - zc;
  const zf = -k.nutD / 2 + 0.01;
  g.add(meshAt(new THREE.BoxGeometry(0.09, 0.1, zf - zb), castIron({ roughness: 0.55 }), 0, 0, (zf + zb) / 2));
  const t = new THREE.Object3D();
  t.name = 'toolTip';
  t.position.set(tip, 0, 0);
  g.add(markPin(t));
  setMM(g, { kind: 'slider', fn: 'nutTool109', axis: 'y' });
  return g;
}

/**
 * 선반 틀(109번): 원점 = 어미나사 축 위, 나사 구간 가운데(두 나사·너트와 같은 원점). 위·아래 판이 뒤판에 붙고,
 * 뒤판에 너트 돌기용 세로 안내 레일 두 줄(판화에 없음 — 정면에서 어미나사 뒤에 가려진다). zc = 축의 월드 z.
 */
export function frame109(zc: number): THREE.Group {
  const k = K109;
  const g = new THREE.Group();
  const z0 = STAGE.backZ - 0.005 - zc;
  const z1 = 0.2;
  const iron = (): THREE.Material => castIron({ roughness: 0.6 });
  g.add(
    meshAt(
      shelfPlate(-0.3, k.C + 0.32, z0, z1, k.plateHiT, [
        [0, 0, k.journalTop + 0.006],
        [k.C, 0, k.journalTop + 0.006]
      ]),
      iron(),
      0,
      k.plateHi + k.plateHiT / 2,
      0
    )
  );
  g.add(
    meshAt(
      shelfPlate(-0.24, k.C + 0.21, z0, z1, k.plateLoT, [
        [0, 0, k.journalL + 0.006],
        [k.C, 0, k.journalW + 0.006]
      ]),
      iron(),
      0,
      k.plateLo - k.plateLoT / 2,
      0
    )
  );
  // 안내 레일 두 줄: 돌기(반폭 0.045)의 양옆
  const ry0 = k.yTop - k.pL * k.cutTurns - 0.12;
  const ry1 = k.yTop + 0.12;
  const rz1 = STAGE.backZ + 0.1 - zc;
  for (const sx of [-1, 1]) g.add(meshAt(new THREE.BoxGeometry(0.04, ry1 - ry0, rz1 - z0), darkSteel(), sx * 0.0675, (ry0 + ry1) / 2, (z0 + rz1) / 2));
  setMM(g, { kind: 'frame', fn: 'frame109' });
  return g;
}
