// 146·147·148번 전용 키트
//  146 요크 막대 왕복: 뒤로 솟은 핀이 달린 원판, 닫힌 고리 홈이 파인 요크 판 + 위아래 막대, 막대 안내, 앞 축받이(A 꼴)
//  147 공기 날개 조속기: 둥근 경사면(끝면 캠) + 세로축, 날개·롤러·추가 달린 십자머리, 목 고리, 밸브 레버·기둥, 발 받침
//  148 교대 회전 기어(추천안 가): 강낭콩 홈(면 캠) 레일, 롤러 달린 흔들 레버, 뼈다귀 꼴 틀
// 치수 상수(K146·K147·K148)와 운동식은 순수 함수라 node 검사 스크립트(shots/_verify/s146.mjs 등)가 같은 식을 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, ghost, paint, steel } from '../../models/materials';
import { TAU, circlePath, circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { meshAngle } from './gear';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;
/** 받침 윗면 높이 */
const BASE_Y = 0.18;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Y축 원기둥(y0~y1) */
function cylY(r: number, y0: number, y1: number, c = 0.006, segs = 32): THREE.BufferGeometry {
  return lathe(rodProfile(r, y0, y1, c, c), segs);
}

/** Z축 원기둥(z0~z1) */
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = cylY(r, z0, z1, c, segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** X축 원기둥(x0~x1) */
function cylX(r: number, x0: number, x1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = cylY(r, x0, x1, c, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** Y축 관 */
function tubeY(rIn: number, rOut: number, y0: number, y1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  return lathe(tubeProfile(rIn, rOut, y0, y1, c), segs);
}

/** Z축 관 */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 48): THREE.BufferGeometry {
  const g = tubeY(rIn, rOut, z0, z1, c, segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 두 점을 잇는 둥근 막대 메시 */
function bar(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = mesh(cylY(r, 0, len, r * 0.25), mat);
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/** 뒤판에서 나온 팔 끝의 고리 — 구멍이 Y 방향(세로 막대·세로축용). 그룹 원점 = (x, y, 0), 고리 중심 z = zc */
export function stemGuide146(x: number, y: number, zc: number, holeR: number, h = 0.1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const rOut = holeR + 0.045;
  g.add(meshAt(tubeY(holeR + 0.003, rOut, -h / 2, h / 2, 0.008), darkSteel(), 0, 0, zc));
  // 팔: 뒤판 앞면에서 고리 뒤쪽 벽까지(고리 벽에 0.012 묻힌다)
  g.add(mesh(cylZ(0.032, STAGE.backZ, zc - rOut + 0.012, 0.004), castIron()));
  g.add(mesh(cylZ(0.06, STAGE.backZ, STAGE.backZ + 0.03, 0.006), castIron()));
  setMM(g, { kind: 'guide', axis: 'y', holeR: holeR + 0.003 });
  return g;
}

// ═══════════════════════════ 146 요크 막대 왕복 ═══════════════════════════

/** 146번 치수(판화 비: 크랭크 반지름 0.78R, 요크 가로 2.76R). 요크의 원점 = 홈 윗길(핀이 다니는 곧은 길)의 가운데 */
export const K146 = {
  /** 원판 반지름 */
  R: 0.44,
  /** 크랭크 반지름(축 중심 ~ 핀) */
  crank: 0.342,
  /** 핀 반지름 */
  pinR: 0.046,
  /** 핀과 홈 벽 사이 틈(한쪽) */
  clear: 0.003,
  /** 홈 중심선(둥근 사각 고리)의 반폭 */
  ga: 0.442,
  /** 홈 중심선의 아랫길이 윗길보다 낮은 정도 */
  gDrop: 0.279,
  /** 홈 중심선 모서리 반지름 */
  gCorner: 0.09,
  /** 요크 판 바깥 반폭(양끝 반원 포함) */
  yokeHalf: 0.608,
  /** 요크 판 윗변·아랫변(원점 기준) */
  yokeUp: 0.24,
  yokeDown: 0.24,
  /** 막대 반지름, 원점에서 위 끝·아래 끝까지 */
  stemR: 0.05,
  stemUp: 1.02,
  stemDown: 1.27,
  /** 판 바닥 두께, 홈 깊이(벽 높이) */
  floorT: 0.05,
  wallH: 0.06,
  /** 원판 두께, 원판 뒷면과 요크 벽 꼭대기 사이 틈 */
  discT: 0.06,
  gap: 0.04,
  /** 축 반지름 */
  shaftR: 0.06,
  /** 판화 자세(t = 1)의 핀 각 — 꼭대기에서 왼쪽으로 7° */
  pose: 97 * DEG
} as const;

/** 요크 왕복 진폭 — 크랭크보다 작게 잡아야 홈 곡선이 한가운데에서 위·아래로 갈라진 하나의 고리가 된다 */
const Y146 = 0.75 * K146.crank;

/**
 * 146 운동식(사용자 지적: 핀이 홈 고리 전체를 돌아야 한다). 원문 "홈 모양을 알맞게 하면 일정한 속도의 왕복" 대로
 * 요크 높이 y 를 핀 각 a 의 세모파(위·아래 끝 a = ±90°)로 정하고, 홈 = 요크에서 본 핀의 길(닫힌 고리)로 만든다.
 * a = 핀 각(반시계), pin = 축 중심 기준 핀 자리, y = 요크 원점의 높이(축 중심 기준).
 */
export function scotchYoke146(theta: number): { a: number; pin: V2; y: number } {
  const a = theta - 1.6 + K146.pose;
  const px = K146.crank * Math.cos(a);
  const py = K146.crank * Math.sin(a);
  const y = Y146 * (2 / Math.PI) * Math.asin(Math.max(-1, Math.min(1, Math.sin(a))));
  return { a, pin: [px, py], y };
}

/** 요크에서 본 핀 중심의 길(홈 중심선) */
function grooveCenter146(n = 240): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = { px: K146.crank * Math.cos(a), py: K146.crank * Math.sin(a) };
    const y = Y146 * (2 / Math.PI) * Math.asin(Math.sin(a));
    out.push([m.px, m.py - y]);
  }
  return out;
}

/** 닫힌 곡선을 법선 방향으로 d 만큼 민다(+ 바깥) */
function offsetLoop(c: V2[], d: number): V2[] {
  const n = c.length;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p = c[(i - 1 + n) % n]!;
    const q = c[(i + 1) % n]!;
    const tx = q[0] - p[0];
    const ty = q[1] - p[1];
    const l = Math.hypot(tx, ty) || 1;
    // 반시계 곡선의 바깥 법선 = (ty, −tx)
    out.push([c[i]![0] + (d * ty) / l, c[i]![1] - (d * tx) / l]);
  }
  return out;
}

/** 요크 홈의 바깥 벽·섬 윤곽(요크 로컬, 반시계). 핀은 hole 안·island 밖에 있어야 한다 */
export function yokeGroove146(): { hole: V2[]; island: V2[]; outer: V2[] } {
  const k = K146;
  const w = k.pinR + k.clear;
  const c = grooveCenter146();
  const hole = offsetLoop(c, w);
  const island = offsetLoop(c, -w);
  const rr = (k.yokeUp + k.yokeDown) / 2;
  const cy = (k.yokeUp - k.yokeDown) / 2;
  const sx = k.yokeHalf - rr;
  const outer: V2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 24;
    outer.push([sx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 24;
    outer.push([-sx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return { hole, island, outer };
}

/**
 * 요크(146번): 바닥 판 + 테(홈 바깥 벽) + 섬(홈 안쪽 벽) + 위·아래 막대. 한 몸.
 * 원점 = 홈 윗길 가운데, 로컬 z = 0 이 홈 바닥(벽은 +z 로 wallH, 바닥 판은 −z 로 floorT). 홈은 +z(원판 쪽)로 열린다.
 * userData.outlines = { hole: 홈 바깥 벽, island: 섬 } (검사용).
 */
export function grooveYoke146(): THREE.Group {
  const k = K146;
  const g = new THREE.Group();
  const { hole, island, outer } = yokeGroove146();
  const body = brass();
  g.add(meshAt(extrude(shapeFrom(outer), k.floorT, 0.006, 12), body, 0, 0, -k.floorT / 2));
  const rim = shapeFrom(outer);
  rim.holes.push(pathFrom(hole));
  g.add(meshAt(extrude(rim, k.wallH, 0.005, 12), body, 0, 0, k.wallH / 2));
  g.add(meshAt(extrude(shapeFrom(island), k.wallH, 0.005, 12), body, 0, 0, k.wallH / 2));
  // 막대(판 두께 안에 놓인다): 판에 0.02 묻혀 한 몸
  const zc = (k.wallH - k.floorT) / 2;
  g.add(meshAt(cylY(k.stemR, k.yokeUp - 0.02, k.stemUp, 0.01), steel(), 0, 0, zc));
  g.add(meshAt(cylY(k.stemR, -k.stemDown, -k.yokeDown + 0.02, 0.01), steel(), 0, 0, zc));
  // 이음 깃
  g.add(meshAt(cylY(k.stemR * 1.35, k.yokeUp - 0.02, k.yokeUp + 0.04, 0.012), body, 0, 0, zc));
  g.add(meshAt(cylY(k.stemR * 1.35, -k.yokeDown - 0.04, -k.yokeDown + 0.02, 0.012), body, 0, 0, zc));
  g.userData.outlines = { hole, island };
  setMM(g, { kind: 'yoke', slotHalf: k.ga, stemR: k.stemR });
  return g;
}

/**
 * 핀 원판(146번): 회전축 = 로컬 Z, 원점 = 중심, 원판은 z 0 ~ discT. 판은 반투명(판화의 점선 = 가려진 요크가 비쳐 보이게), 테·허브는 주철.
 * 핀은 로컬 +X 의 crank 자리에서 **뒤(−z)** 로 솟아 요크 홈에 들어간다(앞면에는 핀 머리만). 축은 **앞(+z)** 으로 shaftLen 만큼.
 * 핀 메시에 userData.outline(원), 핀 표식 child 'crankPin'(홈 깊이 가운데).
 */
export function pinDisc146(shaftLen = 0.44): THREE.Group {
  const k = K146;
  const g = new THREE.Group();
  const web = shapeFrom(circlePts(k.R - 0.03, 96));
  web.holes.push(circlePath(0, 0, k.shaftR));
  web.holes.push(circlePath(k.crank, 0, k.pinR * 0.9));
  g.add(meshAt(extrude(web, k.discT * 0.7, 0, 24), ghost(0x9fb4c8, 0.42), 0, 0, k.discT / 2));
  g.add(mesh(tubeZ(k.R - 0.035, k.R, 0, k.discT, 0.008, 96), castIron({ roughness: 0.5 })));
  g.add(mesh(tubeZ(k.shaftR * 0.98, 0.15, -0.005, k.discT + 0.045, 0.01, 48), darkSteel()));
  // 축(앞으로)
  g.add(mesh(cylZ(k.shaftR, 0, shaftLen, 0.01, 32), steel()));
  // 핀: 홈 바닥 위 0.005 에서 원판 앞면 밖 0.02 까지
  const back = -(k.gap + k.wallH) + 0.005;
  const pin = meshAt(cylZ(k.pinR, back, k.discT + 0.02, 0.006), steel(), k.crank, 0, 0);
  pin.name = 'pin';
  pin.userData.outline = circlePts(k.pinR, 32);
  g.add(pin);
  g.add(meshAt(cylZ(k.pinR * 1.5, -0.012, k.discT + 0.006, 0.005), darkSteel(), k.crank, 0, 0));
  g.add(meshAt(cylZ(k.pinR * 0.5, 0, 0.005, 0), paint(MARK), k.crank, 0, k.discT + 0.02));
  const mark = new THREE.Object3D();
  mark.name = 'crankPin';
  mark.position.set(k.crank, 0, -(k.gap + k.wallH / 2));
  g.add(markPin(mark));
  setMM(g, { kind: 'crankDisc', r: k.R, crankR: k.crank, axis: 'z' });
  return g;
}

/**
 * 앞 축받이(A 꼴 받침, 146번 — 판화에 없음): 고리(구멍이 Z = 축 방향) 중심 (0, cy, zc), 다리 둘이 받침 윗면의 (±half, zc) 로 내려간다.
 * 그룹 원점 = 전시대 원점(절대 좌표로 만든다).
 */
export function frontBearing146(cy: number, zc: number, half: number, shaftR: number): THREE.Group {
  const g = new THREE.Group();
  const rOut = shaftR + 0.05;
  g.add(meshAt(tubeZ(shaftR + 0.003, rOut, -0.06, 0.06, 0.008), darkSteel(), 0, cy, zc));
  for (const sx of [-1, 1]) {
    const foot = new THREE.Vector3(sx * half, BASE_Y + 0.02, zc);
    const dir = new THREE.Vector3(0, cy, zc).sub(foot).normalize();
    const top = new THREE.Vector3(0, cy, zc).addScaledVector(dir, -(rOut - 0.012));
    g.add(bar(foot, top, 0.03, castIron()));
    g.add(meshAt(new THREE.BoxGeometry(0.2, 0.03, 0.16), castIron(), sx * half, BASE_Y + 0.015, zc));
  }
  setMM(g, { kind: 'bracket', axis: 'z', holeR: shaftR + 0.003 });
  return g;
}

// ═══════════════════════════ 147 공기 날개 조속기 ═══════════════════════════

/** 147번 치수(판화 1px(4배 그림) = 0.00064). 세로축 둘레로 도는 부품의 최대 반지름 = fanOut */
export const K147 = {
  /** 경사면 통의 바깥·안 반지름(테 두께 0.04) */
  R: 0.275,
  rimIn: 0.235,
  /** 경사면 높낮이(낮은 곳 0 ~ 높은 곳 H) — 높이 = H·sin²(각), 한 바퀴에 오르막 둘 */
  H: 0.125,
  /** 낮은 곳 아래 통 높이, 통 안 바닥 깊이 */
  base: 0.05,
  floor: 0.03,
  /** 마찰 롤러 반지름·폭, 롤러 가운데의 반지름 자리 */
  rollR: 0.058,
  rollW: 0.036,
  rollAt: 0.255,
  /** 십자머리 허브 반지름, 세로축 반지름 */
  hubR: 0.07,
  shaftR: 0.035,
  /** 날개(판) 안쪽·바깥 반지름, 높이, 두께 */
  fanIn: 0.34,
  fanOut: 0.52,
  fanH: 0.42,
  fanT: 0.012,
  /** 공(추) 반지름, 팔 축에서 공 중심·목 고리·꼭대기까지의 높이 */
  ballR: 0.187,
  ballUp: 0.211,
  neckR: 0.04,
  neckUp: 0.46,
  topUp: 0.53,
  /** 가장 빠를 때 십자머리가 뒤처지는 각 */
  dMax: 60 * DEG,
  /** 레버: 목 고리 핀 ~ 받침 핀, 받침 핀 뒤 꼬리 길이, 레버 평면이 축보다 앞으로 나온 거리 */
  leverL: 0.72,
  leverTail: 0.3,
  leverZ: 0.085
} as const;

/** 경사면 높이(통 로컬 각 phi, 낮은 곳 = 0·π) */
export function camHeight147(phi: number): number {
  const s = Math.sin(phi);
  return K147.H * s * s;
}

/**
 * 롤러가 낮은 곳에서 delta 만큼 뒤처져(통 로컬 각 −delta) 경사면에 얹혔을 때 롤러 중심이 올라간 높이.
 * 원통 롤러(축 = 반지름 방향)와 경사면(테 안쪽·바깥 모서리 모두)의 접촉을 포락선으로 구한다: max[h(φ) + √(r² − (ρ·sin(φ+δ))²)] − r.
 */
export function rollerLift147(delta: number): number {
  const k = K147;
  let best = -1;
  for (const rho of [k.rimIn, k.R]) {
    const w = Math.asin(Math.min(1, k.rollR / rho));
    let lo = -delta - w;
    let hi = -delta + w;
    const f = (p: number): number => {
      const d = rho * Math.sin(p + delta);
      return camHeight147(p) + Math.sqrt(Math.max(0, k.rollR * k.rollR - d * d));
    };
    // 거친 훑기 뒤 좁혀 가기(결정적)
    for (let pass = 0; pass < 4; pass++) {
      let bi = 0;
      let bv = -1;
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const v = f(lo + ((hi - lo) * i) / n);
        if (v > bv) {
          bv = v;
          bi = i;
        }
      }
      const step = (hi - lo) / n;
      const c = lo + step * bi;
      lo = c - step;
      hi = c + step;
      if (bv > best) best = bv;
    }
  }
  return best - k.rollR;
}

/** 147 속도 수준(0 = 가장 느림, 1 = 가장 빠름) — theta 의 주기 8π(15.7 s) */
function level147(theta: number): number {
  return (1 - Math.cos(theta / 4 + 1.2)) / 2;
}
function shaftRaw147(theta: number): number {
  return 1.4 * theta - 3.6 * Math.sin(theta / 4 + 1.2);
}
/** t = 1(theta 1.6)에 십자머리 팔이 정면과 나란하도록 하는 상수 */
const SHAFT0_147 = -(shaftRaw147(1.6) - K147.dMax * level147(1.6));

/**
 * 147 운동식(모두 theta 의 닫힌 식). shaft = 세로축·경사면의 각(rotation.y), head = 십자머리의 각 = shaft − delta,
 * level = 속도 수준 0~1, speed = 축 각속도 ÷ OMEGA(0.5~2.3), delta = 뒤처진 각, lift = 십자머리가 올라간 높이,
 * lever = 레버의 rotation.z(받침 핀 기준, 레버는 −X 로 뻗음), roll = 롤러가 제 축 둘레로 구른 각.
 */
export function governor147(theta: number): { shaft: number; head: number; level: number; speed: number; delta: number; lift: number; lever: number; roll: number } {
  const k = K147;
  const level = level147(theta);
  const delta = k.dMax * level;
  const shaft = shaftRaw147(theta) + SHAFT0_147;
  const lift = rollerLift147(delta);
  const mid = rollerLift147(k.dMax) / 2;
  return {
    shaft,
    head: shaft - delta,
    level,
    speed: 1.4 - 0.9 * Math.cos(theta / 4 + 1.2),
    delta,
    lift,
    lever: -Math.asin((lift - mid) / k.leverL),
    roll: (k.rollAt * delta) / k.rollR
  };
}

/** 네 점 사각형을 삼각형 둘로. 법선이 hint 쪽을 보게 감는 방향을 고른다 */
function quad(pos: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, hint: THREE.Vector3): void {
  const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
  if (n.lengthSq() < 1e-16) n.crossVectors(c.clone().sub(a), d.clone().sub(a));
  const order = n.dot(hint) >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
  for (const v of order) pos.push(v.x, v.y, v.z);
}

/**
 * 둥근 경사면 통 + 세로축(147번): 회전축 = 로컬 Y, 원점 = 경사면 낮은 곳의 높이. 로컬 각 φ 의 점 = (ρ·cos φ, y, −ρ·sin φ) (rotation.y 와 같은 방향).
 * 테 윗면 높이 = camHeight147(φ). 통 아래 고정 깃(가로 핀), 축은 로컬 y −down ~ up.
 */
export function camShaft147(down: number, up: number): THREE.Group {
  const k = K147;
  const g = new THREE.Group();
  const N = 120;
  const pos: number[] = [];
  const at = (rho: number, phi: number, y: number): THREE.Vector3 => new THREE.Vector3(rho * Math.cos(phi), y, -rho * Math.sin(phi));
  for (let i = 0; i < N; i++) {
    const p0 = (i * TAU) / N;
    const p1 = ((i + 1) * TAU) / N;
    const pm = (p0 + p1) / 2;
    const h0 = camHeight147(p0);
    const h1 = camHeight147(p1);
    const out = at(1, pm, 0);
    const inn = out.clone().negate();
    const upv = new THREE.Vector3(0, 1, 0);
    const dn = new THREE.Vector3(0, -1, 0);
    quad(pos, at(k.R, p0, -k.base), at(k.R, p1, -k.base), at(k.R, p1, h1), at(k.R, p0, h0), out);
    quad(pos, at(k.R, p0, h0), at(k.R, p1, h1), at(k.rimIn, p1, h1), at(k.rimIn, p0, h0), upv);
    quad(pos, at(k.rimIn, p0, h0), at(k.rimIn, p1, h1), at(k.rimIn, p1, -k.floor), at(k.rimIn, p0, -k.floor), inn);
    quad(pos, at(k.rimIn, p0, -k.floor), at(k.rimIn, p1, -k.floor), at(k.shaftR, p1, -k.floor), at(k.shaftR, p0, -k.floor), upv);
    quad(pos, at(k.R, p0, -k.base), at(k.R, p1, -k.base), at(k.shaftR, p1, -k.base), at(k.shaftR, p0, -k.base), dn);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const cam = mesh(geo, bronze({ roughness: 0.4 }));
  cam.name = 'camBody';
  g.add(cam);
  // 높은 곳 표시(양쪽)
  for (const s of [1, -1]) g.add(meshAt(new THREE.BoxGeometry(0.03, 0.006, 0.03), paint(MARK), 0, k.H + 0.003, s * (k.R + k.rimIn) * 0.5));
  // 고정 깃 + 가로 핀
  g.add(mesh(cylY(k.shaftR + 0.02, -k.base - 0.075, -k.base + 0.002, 0.008), darkSteel()));
  g.add(meshAt(cylZ(0.009, -(k.shaftR + 0.032), k.shaftR + 0.032, 0.002, 12), steel(), 0, -k.base - 0.038, 0));
  // 세로축
  g.add(mesh(cylY(k.shaftR, -down, up, 0.008), steel()));
  setMM(g, { kind: 'cam', axis: 'y', r: k.R, rise: k.H, lobes: 2 });
  return g;
}

/**
 * 십자머리(147번): 회전축 = 로컬 Y, 원점 = 팔 축의 높이(세로축 위). 허브 + 양쪽 팔(로컬 ±X) + 마찰 롤러 둘(name 'rollerA'·'rollerB',
 * 로컬 x = ±rollAt, 제 축 = X) + 날개 판 둘(로컬 XY 평면) + 공(추) + 목(고리 자리 = y neckUp) + 꼭대기 고리. 축에 헐겁게 끼워 오르내린다.
 */
export function crossHead147(): THREE.Group {
  const k = K147;
  const g = new THREE.Group();
  g.add(mesh(tubeY(k.shaftR + 0.003, k.hubR, -0.07, 0.08, 0.008), darkSteel()));
  for (const s of [1, -1]) {
    const side = new THREE.Group();
    side.rotation.y = s === 1 ? 0 : Math.PI;
    // 팔(가운데가 가는 선반 가공 꼴) — 허브에서 롤러 안쪽까지
    const x0 = k.hubR - 0.008;
    const x1 = k.rollAt - k.rollW / 2;
    const arm = lathe(
      [
        [0, x0],
        [0.034, x0],
        [0.024, x0 + 0.04],
        [0.02, (x0 + x1) / 2],
        [0.026, x1 - 0.03],
        [0.036, x1 - 0.008],
        [0.036, x1],
        [0, x1]
      ],
      24
    );
    arm.rotateZ(-Math.PI / 2);
    side.add(mesh(arm, steel()));
    // 롤러 굴대와 롤러
    side.add(mesh(cylX(0.018, x1 - 0.005, k.rollAt + k.rollW / 2 + 0.03, 0.004), steel()));
    const roller = meshAt(cylX(k.rollR, -k.rollW / 2, k.rollW / 2, 0.006, 40), bronze(), k.rollAt, 0, 0);
    roller.name = s === 1 ? 'rollerA' : 'rollerB';
    roller.add(meshAt(new THREE.BoxGeometry(0.004, k.rollR * 0.7, 0.012), paint(MARK), k.rollW / 2 + 0.001, k.rollR * 0.5, 0));
    setMM(roller, { kind: 'roller', r: k.rollR, width: k.rollW, axis: 'x' });
    side.add(roller);
    // 날개 띠쇠와 날개 판
    const xb0 = k.rollAt + k.rollW / 2 + 0.02;
    const bx = new THREE.BoxGeometry(k.fanOut - 0.06 - xb0, 0.034, 0.012);
    side.add(meshAt(bx, steel(), (xb0 + k.fanOut - 0.06) / 2, 0, 0.012));
    side.add(meshAt(new THREE.BoxGeometry(k.fanOut - k.fanIn, k.fanH, k.fanT), brass({ roughness: 0.45 }), (k.fanIn + k.fanOut) / 2, 0, 0));
    for (const rx of [k.fanIn + 0.03, k.fanOut - 0.09]) side.add(meshAt(cylZ(0.008, 0, 0.024, 0.002, 10), darkSteel(), rx, 0, 0));
    g.add(side);
  }
  // 허브 위 목 → 공 → 가는 목 → 꼭대기
  g.add(mesh(cylY(0.06, 0.07, k.ballUp - k.ballR * 0.8, 0.006), darkSteel()));
  const ball = new THREE.SphereGeometry(k.ballR, 40, 28);
  ball.scale(1, 1.04, 1);
  g.add(meshAt(ball, castIron({ roughness: 0.6 }), 0, k.ballUp, 0));
  g.add(mesh(cylY(k.neckR, k.ballUp + k.ballR * 0.85, k.topUp, 0.006), darkSteel()));
  for (const dy of [-0.03, 0.03]) g.add(mesh(cylY(k.neckR + 0.022, k.neckUp + dy - 0.006, k.neckUp + dy + 0.006, 0.003), darkSteel()));
  g.add(mesh(lathe([[0, k.topUp - 0.005], [0.05, k.topUp - 0.005], [0.05, k.topUp + 0.008], [0.016, k.topUp + 0.045], [0, k.topUp + 0.045]], 28), brass()));
  const eye = new THREE.TorusGeometry(0.018, 0.006, 10, 24);
  g.add(meshAt(eye, brass(), 0, k.topUp + 0.062, 0));
  const seat = new THREE.Object3D();
  seat.name = 'collarSeat';
  seat.position.set(0, k.neckUp, 0);
  g.add(seat);
  setMM(g, { kind: 'crossHead', axis: 'y', r: k.fanOut });
  return g;
}

/** 목 고리(147번, 돌지 않고 십자머리와 함께 오르내린다): 원점 = 고리 중심(세로축 위). 앞(+z)으로 핀, 핀 표식 child 'collarPin'(z = leverZ) */
export function neckCollar147(): THREE.Group {
  const k = K147;
  const g = new THREE.Group();
  const rOut = k.neckR + 0.022;
  g.add(mesh(tubeY(k.neckR + 0.003, rOut, -0.022, 0.022, 0.004), bronze()));
  g.add(mesh(cylZ(0.014, rOut - 0.006, k.leverZ + 0.022, 0.003, 16), steel()));
  const pin = new THREE.Object3D();
  pin.name = 'collarPin';
  pin.position.set(0, 0, k.leverZ);
  g.add(markPin(pin));
  setMM(g, { kind: 'collar', axis: 'y' });
  return g;
}

/**
 * 밸브 레버(147번): 원점 = 받침 핀 구멍, 로컬 −X 로 leverL 에 목 고리 핀이 드는 긴 구멍, +X 로 꼬리(밸브 쪽, 끝에 눈). 두께 가운데 z = 0.
 * 판화처럼 받침 쪽으로 갈수록 넓어진다. 핀 표식 child 'leverSlot'(−leverL, 0)·'leverPivot'(0, 0).
 */
export function valveLever147(): THREE.Group {
  const k = K147;
  const g = new THREE.Group();
  const L = k.leverL;
  const T = k.leverTail;
  const s = shapeFrom([
    [-L - 0.045, -0.024],
    [0, -0.04],
    [T, -0.03],
    [T + 0.03, 0],
    [T, 0.03],
    [0, 0.04],
    [-L - 0.045, 0.024]
  ]);
  const slot: V2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 10;
    slot.push([-L + 0.012 + 0.0165 * Math.cos(a), 0.0165 * Math.sin(a)]);
  }
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 10;
    slot.push([-L - 0.012 + 0.0165 * Math.cos(a), 0.0165 * Math.sin(a)]);
  }
  s.holes.push(pathFrom(slot));
  s.holes.push(circlePath(0, 0, 0.0165));
  s.holes.push(circlePath(T, 0, 0.012));
  g.add(mesh(extrude(s, 0.02, 0.003, 12), steel()));
  const a = new THREE.Object3D();
  a.name = 'leverSlot';
  a.position.set(-L, 0, 0);
  g.add(markPin(a));
  const b = new THREE.Object3D();
  b.name = 'leverPivot';
  g.add(markPin(b));
  g.userData.outlines = { slothole: slot };
  setMM(g, { kind: 'lever', length: L });
  return g;
}

/** 레버 받침 기둥(147번 — 판화에 없음): 받침 윗면에서 (x, yTop, zc) 까지 선 기둥, 꼭대기에서 앞(+z)으로 받침 핀(z = zc ~ zc + leverZ + 0.022). 절대 좌표 */
export function leverPost147(x: number, yTop: number, zc: number): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(cylY(0.03, BASE_Y, yTop + 0.03, 0.006), castIron(), x, 0, zc));
  g.add(meshAt(cylY(0.075, BASE_Y, BASE_Y + 0.03, 0.008), castIron(), x, 0, zc));
  g.add(meshAt(cylZ(0.014, 0, K147.leverZ + 0.022, 0.003, 16), steel(), x, yTop, zc));
  g.add(meshAt(cylZ(0.024, K147.leverZ + 0.012, K147.leverZ + 0.022, 0.002, 16), darkSteel(), x, yTop, zc));
  const p = new THREE.Object3D();
  p.name = 'postPin';
  p.position.set(x, yTop, zc + K147.leverZ);
  g.add(markPin(p));
  setMM(g, { kind: 'post' });
  return g;
}

/** 세로축 발 받침(147번 — 판화에 없음): 받침 윗면 (x, zc) 에 놓인 컵. 축 끝이 컵 안 바닥(받침 윗면 + 0.03)에 선다. 절대 좌표 */
export function footstep147(x: number, zc: number, shaftR: number): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(tubeY(shaftR + 0.003, shaftR + 0.04, BASE_Y + 0.03, BASE_Y + 0.11, 0.008), darkSteel(), x, 0, zc));
  g.add(meshAt(cylY(0.1, BASE_Y, BASE_Y + 0.03, 0.008), castIron(), x, 0, zc));
  setMM(g, { kind: 'footstep', axis: 'y', holeR: shaftR + 0.003 });
  return g;
}

// ═══════════════════════════ 148 교대 회전 기어(추천안 가) ═══════════════════════════

/** 148번 치수. 좌표는 큰 기어 중심 기준. 판화 1px(4배 그림) = 0.00206 */
export const K148 = {
  /** 모듈, 큰 기어·작은 기어 잇수 */
  m: 0.042,
  zG: 48,
  zP: 12,
  /** 작은 기어 중심(큰 기어 중심 기준) */
  pinion: [-1.26, 0] as V2,
  /** 홈 중심선 r(φ) = a0 + c1·cos φ + s1·sin φ + c2·cos 2φ (캠 로컬 각) */
  a0: 0.61,
  c1: 0.05,
  s1: -0.04,
  c2: 0.16,
  /** 롤러 반지름, 롤러와 홈 벽 틈(한쪽), 레일 두께 */
  rollR: 0.04,
  clear: 0.003,
  railT: 0.03,
  /** 레일의 z 범위(기어 로컬, 기어 폭 0.1 의 가운데가 0) */
  railZ0: 0.015,
  railZ1: 0.13,
  /** 흔들 레버의 고정 축 Q(큰 기어 중심 기준), 레버 길이(Q ~ 롤러) */
  Q: [1.46, 0.237] as V2,
  L: 1.607,
  /** 레버 평면의 z(기어 로컬) */
  leverZ: 0.19
} as const;

/** 홈 중심선의 반지름(캠 로컬 각 phi) */
export function kidneyR148(phi: number): number {
  const k = K148;
  return k.a0 + k.c1 * Math.cos(phi) + k.s1 * Math.sin(phi) + k.c2 * Math.cos(2 * phi);
}

/** 홈 중심선을 바깥(+)·안(−)으로 off 만큼 민 닫힌 곡선(캠 로컬, 반시계, n 점) */
export function kidneyOffset148(off: number, n = 240): V2[] {
  const k = K148;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p = (i * TAU) / n;
    const r = kidneyR148(p);
    const dr = -k.c1 * Math.sin(p) + k.s1 * Math.cos(p) - 2 * k.c2 * Math.sin(2 * p);
    const tx = dr * Math.cos(p) - r * Math.sin(p);
    const ty = dr * Math.sin(p) + r * Math.cos(p);
    const l = Math.hypot(tx, ty);
    out.push([r * Math.cos(p) + (off * ty) / l, r * Math.sin(p) - (off * tx) / l]);
  }
  return out;
}

/** 148 기어 각: 작은 기어(구동, 반시계) = theta, 큰 기어 = 맞물림 식(시계 방향, 1/4 속도) */
export function gears148(theta: number): { pinion: number; gear: number } {
  const k = K148;
  return { pinion: theta, gear: meshAngle(k.pinion, k.zP, theta, [0, 0], k.zG) };
}

/** 캠(홈 레일)을 큰 기어에 붙일 때의 로컬 회전 — t = 1(theta 1.6)에 홈이 판화의 방향(캠 세계 각 0)이 되게 */
export const CAM_OFFSET_148 = -gears148(1.6).gear;

/**
 * 148 흔들 레버(추천안 가): 큰 기어의 각 gear(rotation.z) → 레버의 각 psi(Q 에서 롤러 쪽, +X 기준)와 롤러 중심 pin(큰 기어 중심 기준).
 * 롤러는 Q 둘레 반지름 L 의 호 위에서, 돌아가는 홈 중심선과 만나는 점(축 위쪽 가지)에 있다 — 이분법으로 푼 닫힌 함수.
 */
export function rocker148(gear: number): { psi: number; pin: V2 } {
  const k = K148;
  const cam = gear + CAM_OFFSET_148;
  const f = (psi: number): number => {
    const x = k.Q[0] + k.L * Math.cos(psi);
    const y = k.Q[1] + k.L * Math.sin(psi);
    return Math.hypot(x, y) - kidneyR148(Math.atan2(y, x) - cam);
  };
  let lo = Math.PI - 0.55; // 홈 밖(f > 0)
  let hi = Math.PI + Math.atan2(k.Q[1], k.Q[0]); // 축 중심에 가장 가까운 점(f < 0)
  for (let i = 0; i < 52; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const psi = (lo + hi) / 2;
  return { psi, pin: [k.Q[0] + k.L * Math.cos(psi), k.Q[1] + k.L * Math.sin(psi)] };
}

/**
 * 강낭콩 홈 레일(148번): 큰 기어 앞면에 붙이는 두 줄 레일(바깥·안). 큰 기어 그룹의 child 로 넣고 rotation.z = CAM_OFFSET_148.
 * 레일 사이가 홈(폭 = 롤러 지름 + 틈). userData.outlines = { hole: 바깥 레일 안벽, island: 안 레일 바깥벽 }.
 */
export function kidneyCam148(): THREE.Group {
  const k = K148;
  const g = new THREE.Group();
  const w = k.rollR + k.clear;
  const hole = kidneyOffset148(w);
  const island = kidneyOffset148(-w);
  const depth = k.railZ1 - k.railZ0;
  const zc = (k.railZ0 + k.railZ1) / 2;
  const outer = shapeFrom(kidneyOffset148(w + k.railT));
  outer.holes.push(pathFrom(hole));
  g.add(meshAt(extrude(outer, depth, 0.004, 8), darkSteel(), 0, 0, zc));
  const inner = shapeFrom(island);
  inner.holes.push(pathFrom(kidneyOffset148(-w - k.railT)));
  g.add(meshAt(extrude(inner, depth, 0.004, 8), darkSteel(), 0, 0, zc));
  g.userData.outlines = { hole, island };
  setMM(g, { kind: 'faceCam', axis: 'z', rMin: k.a0 - k.c2 + k.s1, rMax: k.a0 + k.c2 + k.c1, lobes: 2 });
  return g;
}

/**
 * 흔들 레버(148번): 원점 = 고정 축 Q 의 구멍, 로컬 +X 로 L 에 롤러. 두께 가운데 z = 0(모델이 z = leverZ 에 둔다).
 * 롤러는 뒤(−z)로 내려가 홈에 든다(롤러 메시에 userData.outline). 표식 child 'leverPivot'·'rollerPin'.
 */
export function rockerLever148(): THREE.Group {
  const k = K148;
  const g = new THREE.Group();
  const L = k.L;
  const pts: V2[] = [];
  const arcTo = (cx: number, r: number, a0: number, a1: number): void => {
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12;
      pts.push([cx + r * Math.cos(a), r * Math.sin(a)]);
    }
  };
  arcTo(L, 0.055, -Math.PI / 2, Math.PI / 2);
  arcTo(0, 0.085, Math.PI / 2, Math.PI * 1.5);
  const s = shapeFrom(pts);
  s.holes.push(circlePath(0, 0, 0.043));
  g.add(mesh(extrude(s, 0.04, 0.005, 12), steel()));
  // 롤러 굴대 + 롤러(홈 속)
  g.add(meshAt(cylZ(0.02, -0.105, 0.035, 0.004, 16), darkSteel(), L, 0, 0));
  const zr0 = k.railZ0 + 0.065 - k.leverZ;
  const zr1 = k.railZ1 - 0.005 - k.leverZ;
  const roller = meshAt(cylZ(k.rollR, zr0, zr1, 0.005, 32), bronze(), L, 0, 0);
  roller.name = 'roller';
  roller.userData.outline = circlePts(k.rollR, 32);
  g.add(roller);
  const a = new THREE.Object3D();
  a.name = 'leverPivot';
  g.add(markPin(a));
  const b = new THREE.Object3D();
  b.name = 'rollerPin';
  b.position.set(L, 0, 0);
  g.add(markPin(b));
  setMM(g, { kind: 'lever', length: L });
  return g;
}

/**
 * 뼈다귀 꼴 틀(148번): 가운데가 잘록하고 양끝이 넓은 판. 원점 = 큰 기어 중심, 뒤판 앞면(z = STAGE.backZ)에 붙는 두께 t 의 판(모델이 z = 0 에 둔다).
 * half = 가운데에서 양끝까지, 가운데 반높이 0.23, 양끝 반높이 0.52.
 */
export function boneFrame148(half = 1.72, t = 0.05): THREE.Group {
  const g = new THREE.Group();
  const neck = 0.9;
  const pts: V2[] = [];
  const side = (sx: number, sy: number, rev: boolean): V2[] => {
    const seg: V2[] = [[sx * 0.6, sy * 0.23]];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const e = u * u * (3 - 2 * u);
      seg.push([sx * (neck + u * 0.34), sy * (0.23 + 0.29 * e)]);
    }
    seg.push([sx * half, sy * 0.52]);
    return rev ? seg.reverse() : seg;
  };
  pts.push(...side(1, -1, false), ...side(1, 1, true), ...side(-1, 1, false), ...side(-1, -1, true));
  const geo = extrude(shapeFrom(pts), t, 0.006, 8);
  g.add(meshAt(geo, castIron({ roughness: 0.65 }), 0, 0, STAGE.backZ + t / 2));
  setMM(g, { kind: 'frame' });
  return g;
}
