// 기어 확장 키트 (507 · 31~35번): 웜 나사, 마찰 바퀴, 타원 기어(굴림 곡선), 내접 링 기어, 코일 스프링
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, rubber, steel } from '../../models/materials';
import { circlePts, extrude, lathe, loft, mesh, pathFrom, rodProfile, shapeFrom, TAU, tubeProfile } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import type { V2 } from './belt';

const MARK = 0xf2b619;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// ───────────────────────── 웜 나사 ─────────────────────────

/**
 * 웜(끝없는 나사): 한 줄 나사(기본 오른나사, leftHand 면 왼나사), 축 = 로컬 X, 원점 중심.
 * 이 단면은 사다리꼴(압력각 20°). 로컬 각 ψ(Y→Z)에서 이 중심의 축 위치 x = ±pitch·ψ/2π (+ k·pitch) (오른나사 +, 왼나사 −).
 * 그룹을 rotation.x = θ 로 돌리면 위치 −Y 쪽 단면에서 나사산이 x 방향 ∓pitch·θ/2π 만큼 움직인다.
 * 정면(+Z)에서 보면 오른나사 산은 "\\" 로, 왼나사 산은 "/" 로 기운다.
 */
export function wormScrew(
  rootR: number,
  outerR: number,
  pitch: number,
  length: number,
  opts: { driver?: boolean; leftHand?: boolean } = {}
): THREE.Group {
  const g = new THREE.Group();
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const core = lathe(rodProfile(rootR, -length / 2, length / 2, 0.012, 0.012), 40);
  core.rotateZ(-Math.PI / 2);
  g.add(mesh(core, body));

  const depth = outerR - rootR;
  const ha = depth / 2.25;
  const t20 = Math.tan((20 * Math.PI) / 180);
  const pitchHalf = 0.215 * pitch; // 피치선 반폭(휠 이골보다 조금 좁게 — 옆틈)
  const hand = opts.leftHand === true ? -1 : 1;
  const wt = Math.max(0.01 * pitch, pitchHalf - ha * t20); // 끝 반폭
  const wr = Math.min(0.46 * pitch, pitchHalf + 1.25 * ha * t20); // 뿌리 반폭
  const rIn = rootR - 0.006; // 코어에 살짝 파묻는다
  const prof: V2[] = [
    [-wr, rIn],
    [-wt, outerR],
    [wt, outerR],
    [wr, rIn]
  ];
  const turns = (length - 2 * wr) / pitch;
  const steps = Math.ceil(turns * 56);
  const pos: number[] = [];
  const idx: number[] = [];
  const at = (u: number, r: number, j: number): [number, number, number] => {
    const psi = -Math.PI * turns + (j / steps) * TAU * turns;
    return [(hand * pitch * psi) / TAU + u, r * Math.cos(psi), r * Math.sin(psi)];
  };
  // 옆면: 단면 변마다 정점을 따로 둔다(변 사이는 날카롭게, 감김 방향은 매끈하게)
  for (let e = 0; e < 4; e++) {
    const a = prof[e]!;
    const b = prof[(e + 1) % 4]!;
    const base = pos.length / 3;
    for (let j = 0; j <= steps; j++) {
      pos.push(...at(a[0], a[1], j), ...at(b[0], b[1], j));
    }
    for (let j = 0; j < steps; j++) {
      const i0 = base + j * 2;
      idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
  }
  // 양끝 뚜껑
  for (const j of [0, steps]) {
    const base = pos.length / 3;
    for (const [u, r] of prof) pos.push(...at(u, r, j));
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // 부피 부호로 바깥쪽이 앞면이 되게 감김 방향을 맞춘다
  let vol = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const [i, j, l] = [idx[k]! * 3, idx[k + 1]! * 3, idx[k + 2]! * 3];
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
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(mesh(geo, body));
  return g;
}

// ───────────────────────── 웜 휠(헬리컬) ─────────────────────────

export interface WormWheelOpts {
  width?: number;
  spokes?: number;
  /**
   * 이의 비틀림: 폭 방향으로 z 만큼 갈 때 휠 꼭대기의 이가 +X 로 z·tanLead 만큼 옮겨 간다.
   * 웜이 휠 위(+Y)에 있고 축이 X 일 때 왼나사 웜이면 +tan(리드각), 오른나사 웜이면 −tan(리드각).
   */
  tanLead?: number;
}

/**
 * 웜 휠: spurGear 와 같은 모양·위상(이 중심 = (i+½)·피치각, 폭 가운데 z=0 기준)이지만
 * 이가 웜의 리드각만큼 비스듬하다(헬리컬) — 곧은 이는 폭 양끝에서 나사산 옆구리를 파고든다.
 */
export function wormWheel(teeth: number, module: number, opts: WormWheelOpts = {}): THREE.Group {
  const w = opts.width ?? 0.14;
  const spokes = Math.max(3, opts.spokes ?? 6);
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const bore = Math.max(0.024, rp * 0.14);
  const c = Math.min(module * 0.35, w * 0.16);
  const k = -(opts.tanLead ?? 0) / rp; // z 당 회전각(꼭대기에서 +X 이동 = 시계 방향 = 음의 회전)
  const outline = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const g = new THREE.Group();
  const rRim = rf * 0.72;
  const zs = [-w / 2, -w / 2 + c, 0, w / 2 - c, w / 2];
  const layers = zs.map((z, i) => {
    const end = i === 0 || i === zs.length - 1;
    return { z, s: end ? (ra - c) / ra : 1, hs: end ? (rRim + c) / rRim : 1, rot: k * z };
  });
  g.add(mesh(loft(outline, [circlePts(rRim, 64)], layers), brass()));
  const hubOut = bore + rp * 0.14;
  const hubGeo = lathe(tubeProfile(bore, hubOut, -(w / 2 + 0.018), w / 2 + 0.018, 0.01), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  for (let i = 0; i < spokes; i++) {
    const b = new THREE.BoxGeometry(rRim - hubOut + 0.02, Math.max(0.02, rp * 0.13), w * 0.4);
    b.translate(hubOut + (rRim - hubOut) / 2, 0, 0);
    b.rotateZ((i / spokes) * TAU);
    g.add(mesh(b, brass()));
  }
  g.add(meshAt(new THREE.BoxGeometry(Math.max(0.03, rp * 0.12), 0.016, 0.01), paint(MARK), (hubOut + rRim) / 2, 0, w * 0.2 + 0.004));
  return g;
}

// ───────────────────────── 마찰 바퀴 ─────────────────────────

export interface FrictionWheelOpts {
  width?: number;
  driver?: boolean;
  /** 가벼움 구멍 수(기본 5) — 회전이 보이게 */
  holes?: number;
}

/** 마찰 바퀴: 고무 타이어 + 쇠 원판(구멍) + 허브. 회전축 = 로컬 Z, 원점 중심, 바깥 반지름 = r */
export function frictionWheel(r: number, opts: FrictionWheelOpts = {}): THREE.Group {
  const w = opts.width ?? 0.16;
  const holes = opts.holes ?? 5;
  const g = new THREE.Group();
  const tire = 0.05;
  const tireGeo = lathe(tubeProfile(r - tire, r, -w / 2, w / 2, 0.014), 96);
  tireGeo.rotateX(Math.PI / 2);
  g.add(mesh(tireGeo, rubber()));
  // 원판: 타이어 안쪽에 끼운다(두께 0.7w)
  const disc = new THREE.Shape();
  disc.absarc(0, 0, r - tire + 0.004, 0, TAU, false);
  const rh = (r - tire) * 0.2;
  const rm = (r - tire) * 0.58;
  const hubR = Math.max(0.12, r * 0.14);
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * TAU + Math.PI / holes;
    const hp = new THREE.Path();
    hp.absarc(Math.cos(a) * rm, Math.sin(a) * rm, rh, 0, TAU, true);
    disc.holes.push(hp);
  }
  g.add(mesh(extrude(disc, w * 0.7, 0.01, 64), opts.driver === true ? bronze({ roughness: 0.34 }) : brass()));
  // 허브 보스(축 쪽 밝은 고리)
  const hubGeo = lathe(tubeProfile(0.02, hubR, -w / 2 - 0.012, w / 2 + 0.012, 0.01), 40);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, steel()));
  // 표시점: 원판 위 노란 막대
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.02, 0.012), paint(MARK), rm + rh + 0.09, 0, w * 0.35 + 0.006));
  return g;
}

// ───────────────────────── 내접 링 기어 ─────────────────────────

export interface RingGearOpts {
  width?: number;
  /** 이뿌리 바깥 벽 두께 */
  wall?: number;
}

/** 링 기어 이뿌리 바깥 반지름(이골 끝) */
export function ringRoot(teeth: number, module: number): number {
  return (teeth * module) / 2 + 1.1 * module;
}

/**
 * 안쪽에 이가 있는 링 기어. 회전축 = 로컬 Z. 이골 i 의 중심각 = i·(2π/teeth) (로컬 0 에 이골).
 * 피치 반지름 = teeth·module/2, 이끝(안쪽) = 피치 − 1.15m, 이뿌리 = 피치 + 1.1m.
 */
export function internalGear(teeth: number, module: number, opts: RingGearOpts = {}): THREE.Group {
  const w = opts.width ?? 0.12;
  const wall = opts.wall ?? 0.11;
  const rp = (teeth * module) / 2;
  const cavity = involuteOutline(teeth, rp + 1.1 * module, rp - 1.15 * module, 0);
  const rOut = rp + 1.1 * module + wall;
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, TAU, false);
  shape.holes.push(pathFrom(cavity));
  g.add(mesh(extrude(shape, w, Math.min(0.012, module * 0.3), 96), castIron({ roughness: 0.5 })));
  // 바깥 테두리 띠(약간 튀어나온 황동 고리) + 표시점 3개
  const rim = lathe(tubeProfile(rOut - 0.03, rOut + 0.012, -w / 2 - 0.006, w / 2 + 0.006, 0.008), 128);
  rim.rotateX(Math.PI / 2);
  g.add(mesh(rim, brass()));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const mk = meshAt(new THREE.BoxGeometry(wall * 0.55, 0.026, 0.012), paint(MARK), 0, 0, w / 2 + 0.004);
    mk.position.set(Math.cos(a) * (rOut - wall * 0.45), Math.sin(a) * (rOut - wall * 0.45), w / 2 + 0.004);
    mk.rotation.z = a;
    g.add(mk);
  }
  return g;
}

// ───────────────────────── 코일 스프링 ─────────────────────────

/** 코일 스프링: 로컬 +X 방향 길이 1, 반지름 radius. 길이는 scale.x 로 바꾼다. */
export function coilSpring(radius: number, wire: number, turns: number): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  const n = Math.ceil(turns * 20);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * TAU;
    pts.push(new THREE.Vector3(t, Math.cos(a) * radius, Math.sin(a) * radius));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 8, false);
  return mesh(geo, steel());
}

// ───────────────────────── 타원 기어(비원형 피치 곡선) ─────────────────────────

/**
 * 회전축(로컬 원점) 기준 극좌표 피치 곡선 r(φ). 반시계로 한 바퀴 닫힌 볼록 곡선.
 * 호 길이 S 는 φ=0 에서 재고, φ 가 2π 를 넘으면 둘레 L 만큼씩 이어진다.
 */
export interface PitchCurve {
  /** 둘레 */
  readonly L: number;
  /** 같은 곡선 두 개가 맞물릴 때의 축간 거리(해당 없으면 a + b) */
  readonly d: number;
  readonly rMin: number;
  readonly rMax: number;
  r(phi: number): number;
  /** 축 기준 점 */
  pt(phi: number): V2;
  /** 접선 각 */
  tangent(phi: number): number;
  /** 바깥 단위 법선 */
  normal(phi: number): V2;
  /** φ=0 에서 φ 까지 호 길이(φ 는 어떤 값이든) */
  S(phi: number): number;
  /** S 의 역함수 */
  phiAtS(s: number): number;
}
/** 예전 이름 */
export type EllipsePitch = PitchCurve;

function polarPitch(r: (phi: number) => number, dr: (phi: number) => number, d: number): PitchCurve {
  const dsdphi = (phi: number): number => Math.hypot(r(phi), dr(phi));
  const N = 8192;
  const tbl: number[] = [0];
  let rMin = Infinity;
  let rMax = 0;
  for (let i = 1; i <= N; i++) {
    const p0 = ((i - 1) / N) * TAU;
    const p1 = (i / N) * TAU;
    tbl.push(tbl[i - 1]! + ((p1 - p0) / 6) * (dsdphi(p0) + 4 * dsdphi((p0 + p1) / 2) + dsdphi(p1)));
    rMin = Math.min(rMin, r(p1));
    rMax = Math.max(rMax, r(p1));
  }
  const L = tbl[N]!;
  const S = (phi: number): number => {
    const k = Math.floor(phi / TAU);
    const f = ((phi - k * TAU) / TAU) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return tbl[i]! + (tbl[i + 1]! - tbl[i]!) * (f - i) + k * L;
  };
  const phiAtS = (s: number): number => {
    const k = Math.floor(s / L);
    const sn = s - k * L;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tbl[mid]! <= sn) lo = mid;
      else hi = mid;
    }
    const f = lo + (sn - tbl[lo]!) / (tbl[lo + 1]! - tbl[lo]!);
    return (f / N) * TAU + k * TAU;
  };
  const pt = (phi: number): V2 => [r(phi) * Math.cos(phi), r(phi) * Math.sin(phi)];
  const tangent = (phi: number): number => {
    const rr = r(phi);
    const rp = dr(phi);
    return Math.atan2(rp * Math.sin(phi) + rr * Math.cos(phi), rp * Math.cos(phi) - rr * Math.sin(phi));
  };
  const normal = (phi: number): V2 => {
    const t = tangent(phi);
    return [Math.sin(t), -Math.cos(t)];
  };
  return { L, d, rMin, rMax, r, pt, tangent, normal, S, phiAtS };
}

/**
 * 초점을 축으로 하는 타원: r(φ) = p/(1 − e·cosφ), p = a(1−e²). φ=0 이 가장 먼 점.
 * 같은 것 두 개를 축간 거리 2a 로 놓으면 r₁ + r₂ = 2a 로 구른다(한 바퀴에 빠름·느림 한 번).
 */
export function ellipsePitch(a: number, e: number): PitchCurve {
  const p = a * (1 - e * e);
  const r = (phi: number): number => p / (1 - e * Math.cos(phi));
  return polarPitch(r, (phi) => (-r(phi) * r(phi) * e * Math.sin(phi)) / p, 2 * a);
}

/**
 * 중심을 축으로 하는 타원꼴(2차 타원, 오벌 기어): r(φ) = 2ab / ((a+b) − (a−b)·cos2φ). φ=0 이 긴반지름 a, φ=π/2 가 짧은반지름 b.
 * 같은 것 두 개를 90° 어긋나게, 축간 거리 a+b 로 놓으면 r₁ + r₂ = a+b 로 미끄럼 없이 구른다(한 바퀴에 빠름·느림 두 번).
 * 진짜 타원은 중심을 축으로 하면 맞물린 채 돌 수 없다 — 판화 33 처럼 가운데에 축이 있으려면 이 곡선이어야 한다.
 * 볼록하려면 (a−b)/(a+b) ≤ 1/3 (b ≥ a/2).
 */
export function ovalPitch(a: number, b: number): PitchCurve {
  const r = (phi: number): number => (2 * a * b) / (a + b - (a - b) * Math.cos(2 * phi));
  return polarPitch(r, (phi) => (-r(phi) * r(phi) * (a - b) * Math.sin(2 * phi)) / (a * b), a + b);
}

/** 중심을 축으로 하는 진짜 타원(긴반지름 a = φ 0, 짧은반지름 b). 짝 타원과는 못 물리고, 축이 움직이는 피니언(35번)용 */
export function centreEllipsePitch(a: number, b: number): PitchCurve {
  const r = (phi: number): number => (a * b) / Math.hypot(b * Math.cos(phi), a * Math.sin(phi));
  return polarPitch(r, (phi) => (-Math.pow(r(phi), 3) * (a * a - b * b) * Math.sin(phi) * Math.cos(phi)) / (a * a * b * b), a + b);
}

/**
 * 같은 피치 곡선 두 개의 굴림 관계(기어1 축 → 기어2 축 = 세계 +X, 축간 거리 pitch.d).
 * th1 = 기어1 의 φ=0 축 세계 각(구동), 반환 = 기어2 의 φ=0 축 세계 각. 두 기어는 반대로 돈다.
 * 접점 극각 φ₁ = −θ₁. 미끄럼이 없으므로 두 곡선에서 지나간 호 길이가 같다: S(φ₂) = s20 − S(φ₁), θ₂ = π − φ₂.
 * s20 = 기어1 접점이 φ₁=0 일 때 기어2 접점의 호 길이(오벌: L/4, 초점 타원: L/2).
 */
export function pitchRoll(pitch: PitchCurve, th1: number, s20: number): number {
  return Math.PI - pitch.phiAtS(s20 - pitch.S(-th1));
}

export interface EllipticalGearOpts {
  width?: number;
  driver?: boolean;
  /** 첫 이 중심을 φ=0 에서 반 피치 어긋나게 */
  halfOffset?: boolean;
  /** 피치선에서 이 반폭(피치 단위, 기본 0.23) — 굵은 이·센 곡률에서 박히면 줄인다 */
  thick?: number;
}

/** 타원 기어 외곽(축 원점, 반시계). 이 중심 호 길이 = s0 + i·P (φ=0 기준) */
export function ellipticalOutline(pitch: PitchCurve, teeth: number, halfOffset = false, thick = 0.23): V2[] {
  const P = pitch.L / teeth;
  const m = P / Math.PI;
  const ha = m;
  const hf = 1.2 * m;
  const t20 = Math.tan((20 * Math.PI) / 180);
  const tp = thick; // 피치선에서 이 반폭(피치 단위). 0.25 보다 작은 만큼이 옆틈
  const ut = tp - (ha * t20) / P;
  const ur = tp + (hf * t20) / P;
  const prof: [number, number][] = [
    [-ur, -hf],
    [-tp, 0],
    [-ut, ha],
    [0, ha],
    [ut, ha],
    [tp, 0],
    [ur, -hf],
    [0.5, -hf]
  ];
  const s0 = halfOffset ? P / 2 : 0;
  const out: V2[] = [];
  for (let i = 0; i < teeth; i++) {
    for (const [u, h] of prof) {
      const phi = pitch.phiAtS(s0 + (i + u) * P);
      const q = pitch.pt(phi);
      const n = pitch.normal(phi);
      out.push([q[0] + n[0] * h, q[1] + n[1] * h]);
    }
  }
  return out;
}

/** 피치 곡선을 안쪽으로 off 만큼 민 닫힌 점열 */
function offsetCurve(pitch: PitchCurve, off: number, n = 120): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const phi = (i / n) * TAU;
    const q = pitch.pt(phi);
    const nn = pitch.normal(phi);
    out.push([q[0] - nn[0] * off, q[1] - nn[1] * off]);
  }
  return out;
}

/**
 * 타원 기어: 회전축이 로컬 원점, 피치 곡선의 φ=0 방향이 로컬 +X. 회전축 = 로컬 Z.
 * 안쪽 홈선(림 안벽 표현) + 축 허브 + 표시 막대 포함.
 */
export function ellipticalGear(pitch: PitchCurve, teeth: number, opts: EllipticalGearOpts = {}): THREE.Group {
  const w = opts.width ?? 0.14;
  const g = new THREE.Group();
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const outline = ellipticalOutline(pitch, teeth, opts.halfOffset === true, opts.thick ?? 0.23);
  g.add(mesh(extrude(shapeFrom(outline), w, 0.01, 8), body));
  // 안쪽 홈선: 얇은 어두운 고리
  const m = pitch.L / teeth / Math.PI;
  const ringShape = shapeFrom(offsetCurve(pitch, 2.8 * m));
  ringShape.holes.push(pathFrom(offsetCurve(pitch, 2.8 * m + 0.03)));
  g.add(mesh(extrude(ringShape, w + 0.012, 0.002, 8), darkSteel()));
  // 허브(축)
  const hubGeo = lathe(tubeProfile(0.02, 0.1, -w / 2 - 0.014, w / 2 + 0.014, 0.01), 36);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, steel()));
  // 표시 막대: φ=0 쪽으로(허브 바로 바깥)
  g.add(meshAt(new THREE.BoxGeometry(0.16, 0.02, 0.012), paint(MARK), 0.22, 0, w / 2 + 0.006));
  return g;
}

// ───────────────────────── 타원 위를 구르는 피니언(35번) ─────────────────────────

export interface PinionState {
  /** 타원 기어의 회전각 */
  thetaE: number;
  /** 피니언 중심의 축에서 거리(막대 위 위치) */
  rho: number;
  /** 피니언 자세 */
  psi: number;
  /** 타원 위 접점의 극각(타원 자기 좌표) */
  phi: number;
}

export interface PinionRoll {
  /** 피니언 한 바퀴당 x 증가량이 아니라, x = 피니언 자세각. 한 주기(타원 한 바퀴)의 x 증가량 */
  readonly period: number;
  /** 접점 극각 φ₀ 에 해당하는 피니언 자세각 */
  xOfPhi(phi: number): number;
  /** 피니언 자세각 x(연속, 증가)에서 상태 */
  at(x: number): PinionState;
}

/**
 * 반지름 rp 인 피니언이 타원 피치 곡선 바깥을 구르고, 피니언 축은 축(원점)에서 나오는 일정한 방향 beta0 의 직선(막대 홈) 위에 있다.
 * 막대각이 고정이므로 타원이 돌아야 하고, 그 각은 θe = β0 − A(φ) (A = 타원 좌표에서 피니언 중심의 방향각).
 * 굴림 조건: 피니언의 타원 기준 자세 ψrel = S(φ)/rp + ϑ(φ) + c, 세계 자세 ψ = ψrel + θe.
 * c 는 피니언 이(spurGear: 이 중심 (j+½)·피치각)와 타원 이(φ=0 에서 s0 + i·P)가 맞물리는 위상.
 * 피니언 잇수 np 는 2π·rp/P 와 같아야 한다(P = L/타원 잇수).
 */
export function pinionOnEllipse(pitch: PitchCurve, rp: number, np: number, beta0: number, s0Frac = 0): PinionRoll {
  const c = Math.PI / 2 - (TAU / np) * s0Frac; // s0Frac = 타원 첫 이 위치(피치 단위)
  const centre = (phi: number): V2 => {
    const q = pitch.pt(phi);
    const n = pitch.normal(phi);
    return [q[0] + rp * n[0], q[1] + rp * n[1]];
  };
  const N = 4096;
  const phis: number[] = [];
  const F: number[] = [];
  const Atab: number[] = [];
  const Ttab: number[] = [];
  let prevA = 0;
  let prevT = 0;
  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * TAU;
    const q = centre(phi);
    let A = Math.atan2(q[1], q[0]);
    let T = pitch.tangent(phi);
    if (i > 0) {
      A += TAU * Math.round((prevA - A) / TAU);
      T += TAU * Math.round((prevT - T) / TAU);
    } else {
      A = Math.atan2(q[1], q[0]);
    }
    prevA = A;
    prevT = T;
    phis.push(phi);
    Atab.push(A);
    Ttab.push(T);
    F.push(pitch.S(phi) / rp + T + c + beta0 - A);
  }
  const period = F[N]! - F[0]!;
  const refine = (phi: number): { A: number; T: number; x: number } => {
    const f = (phi / TAU) * N;
    const i = Math.min(N - 1, Math.max(0, Math.floor(f)));
    const q = centre(phi);
    let A = Math.atan2(q[1], q[0]);
    A += TAU * Math.round((Atab[i]! - A) / TAU);
    let T = pitch.tangent(phi);
    T += TAU * Math.round((Ttab[i]! - T) / TAU);
    return { A, T, x: pitch.S(phi) / rp + T + c + beta0 - A };
  };
  return {
    period,
    xOfPhi(phi: number): number {
      const k = Math.floor(phi / TAU);
      return refine(phi - k * TAU).x + k * period;
    },
    at(x: number): PinionState {
      const k = Math.floor((x - F[0]!) / period);
      const xr = x - k * period;
      let lo = 0;
      let hi = N;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (F[mid]! <= xr) lo = mid;
        else hi = mid;
      }
      const phi0 = phis[lo]! + ((xr - F[lo]!) / (F[lo + 1]! - F[lo]!)) * (phis[lo + 1]! - phis[lo]!);
      const rf = refine(phi0);
      const q = centre(phi0);
      const A = rf.A + k * TAU;
      return { phi: phi0 + k * TAU, thetaE: beta0 - A, rho: Math.hypot(q[0], q[1]), psi: x };
    }
  };
}
