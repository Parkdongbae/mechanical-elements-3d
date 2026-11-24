// 89·90·91번 전용 키트 — 편심 원판과 띠(스트랩)·막대, 긴 구멍 요크, 삼각 편심(부풀린 뢸로 삼각형)과 네모 틀, 막대 안내
// 치수 검증: shots/_verify/s089.mjs (윤곽 식이 이 파일과 같다)
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, steel } from '../../models/materials';
import { circlePath, circlePts, extrude, hexPrism, lathe, mesh, pathFrom, roundedRect, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z 방향 원통(핀·볼트) */
function cylZ(r: number, len: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, 24);
  g.rotateX(Math.PI / 2);
  return g;
}

/** X 방향 원통 */
function cylX(r: number, len: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, 20);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** 허브 보스(구멍 bore, 바깥 hubR, 두께 len, 가운데 z = 0) */
function hubBoss(bore: number, hubR: number, len: number): THREE.BufferGeometry {
  const g = lathe(tubeProfile(bore, hubR, -len / 2, len / 2, 0.008), 40);
  g.rotateX(Math.PI / 2);
  return g;
}

// ───────────────────────── 89·90: 둥근 편심 ─────────────────────────

export interface SheaveOpts {
  /** 테 두께(z), 기본 0.12 */
  width?: number;
  /** 축 둘레 허브 반지름, 기본 r·0.36 */
  hubR?: number;
  /** 축 구멍 반지름, 기본 0.07 */
  bore?: number;
  /** 테(둘레 고리) 폭, 기본 0.07. 0 이면 살(web)을 파지 않은 통짜 원판 */
  rim?: number;
}

/**
 * 편심 원판(시브): **원점 = 축(회전 중심)**, 원판 중심 = 로컬 (e, 0), 회전축 = 로컬 Z, 두께 가운데 z = 0.
 * 테(둘레 고리)와 허브는 온 두께, 그 사이 살은 얇게 파였다(판화 89번의 D 꼴 안쪽 선). 청동(구동).
 * userData.outline = 바깥 원(반시계 96점, 로컬).
 */
export function eccentricSheave(r: number, e: number, opts: SheaveOpts = {}): THREE.Group {
  const w = opts.width ?? 0.12;
  const hubR = opts.hubR ?? r * 0.36;
  const bore = opts.bore ?? 0.07;
  const rim = opts.rim ?? 0.07;
  const g = new THREE.Group();
  const mat = bronze({ roughness: 0.36 });
  const outline = circlePts(r, 96, e, 0);
  if (rim > 0) {
    const web = shapeFrom(circlePts(r - rim * 0.5, 96, e, 0));
    web.holes.push(circlePath(0, 0, bore));
    g.add(mesh(extrude(web, w * 0.5, 0.004, 48), mat));
    const ring = shapeFrom(outline);
    ring.holes.push(circlePath(e, 0, r - rim));
    g.add(mesh(extrude(ring, w, 0.008, 48), mat));
  } else {
    const disc = shapeFrom(outline);
    disc.holes.push(circlePath(0, 0, bore));
    g.add(mesh(extrude(disc, w, 0.008, 48), mat));
  }
  g.add(mesh(hubBoss(bore, hubR, w + 0.03), bronze({ roughness: 0.3 })));
  // 가장 먼 쪽 표시점(도는 것이 보이게)
  g.add(meshAt(cylZ(0.028, 0.01), darkSteel(), e + r - Math.max(rim, 0.07) - 0.07, 0, w * 0.25 + 0.004));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', shape: 'eccentric', r, e, width: w, axis: 'z' });
  return g;
}

export interface StrapOpts {
  /** 띠 두께(z), 기본 0.14 */
  width?: number;
  /** 띠 고리의 반지름 방향 두께, 기본 0.075 */
  band?: number;
  /** 위·아래 귀(볼트 자리)의 가로 폭, 기본 rIn·0.96 */
  lugW?: number;
  /** 귀 끝의 높이(띠 중심에서), 기본 rIn·1.4 */
  lugTop?: number;
  /** 막대 끝 눈(핀 구멍) 바깥 반지름, 기본 0.075 */
  eyeR?: number;
}

/** 띠 바깥 윤곽: 원(rOut) + 위·아래 네모 귀. 중심에서 본 별꼴이라 각도로 훑는다(반시계) */
export function strapOutline(rOut: number, lugW: number, lugTop: number, n = 360): V2[] {
  const hw = lugW / 2;
  const cornerA = Math.atan2(lugTop, hw);
  const angles: number[] = [];
  for (let i = 0; i < n; i++) angles.push((i / n) * Math.PI * 2);
  angles.push(cornerA, Math.PI - cornerA, Math.PI + cornerA, 2 * Math.PI - cornerA);
  angles.sort((a, b) => a - b);
  return angles.map((a): V2 => {
    const c = Math.abs(Math.cos(a));
    const s = Math.abs(Math.sin(a));
    const lug = Math.min(s > 1e-9 ? lugTop / s : Infinity, c > 1e-9 ? hw / c : Infinity);
    const rr = Math.max(rOut, lug);
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
}

/**
 * 편심 띠(스트랩) + 편심 막대 한 몸(89번). **원점 = 띠 중심(= 편심 원판 중심)**, 막대 = 로컬 +X, 막대 끝 핀 눈 = 로컬 (length, 0).
 * 띠: 안지름 rIn 인 고리, 위·아래 귀에 가로 볼트(좌우 두 쪽으로 갈라 조임 — 판화의 세로 이음선), 오른쪽 목 + 플랜지 2장(볼트 4개) + 가늘어지는 막대.
 * 자식 `rodEye`(빈 물체, markPin) 가 핀 자리. userData.outlines.hole = 안쪽 원(침범 검사: 편심 원판이 이 안에 있어야 한다).
 */
export function eccentricStrap(rIn: number, length: number, opts: StrapOpts = {}): THREE.Group {
  const w = opts.width ?? 0.14;
  const band = opts.band ?? 0.075;
  const rOut = rIn + band;
  const lugW = opts.lugW ?? rIn * 0.96;
  const lugTop = opts.lugTop ?? rIn * 1.4;
  const eyeR = opts.eyeR ?? 0.075;
  const g = new THREE.Group();
  const iron = castIron();
  const hole = circlePts(rIn, 96);
  const shape = shapeFrom(strapOutline(rOut, lugW, lugTop));
  shape.holes.push(circlePath(0, 0, rIn));
  g.add(mesh(extrude(shape, w, 0.008, 48), iron));
  // 귀: 이음선(세로) + 가로 볼트(머리·너트)
  const lugMid = (rOut + lugTop) / 2;
  for (const sy of [-1, 1]) {
    g.add(meshAt(new THREE.BoxGeometry(0.008, lugTop - rIn - 0.01, w + 0.004), darkSteel(), 0, sy * (rIn + lugTop + 0.01) / 2, 0));
    g.add(meshAt(cylX(0.026, lugW + 0.1), steel(), 0, sy * lugMid, 0));
    for (const sx of [-1, 1]) {
      const nut = hexPrism(0.07, 0.04, true, true, 0);
      nut.rotateZ(Math.PI / 2);
      g.add(meshAt(nut, darkSteel(), sx * (lugW / 2 + 0.02), sy * lugMid, 0));
    }
  }
  // 목 + 플랜지 두 장 + 볼트 4개
  const neckH = 0.16;
  const fx = rOut + 0.16; // 두 플랜지가 맞닿는 면
  const ft = 0.04; // 플랜지 한 장 두께
  const fh = 0.42; // 플랜지 높이
  g.add(meshAt(new THREE.BoxGeometry(fx - ft - rOut + 0.03, neckH, w * 0.7), iron, (rOut - 0.03 + fx - ft) / 2, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(ft, fh, w), iron, fx - ft / 2, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(ft, fh, w), steel(), fx + ft / 2, 0, 0));
  for (const sy of [-1, 1]) {
    g.add(meshAt(cylX(0.018, ft * 2 + 0.05), darkSteel(), fx, sy * (fh / 2 - 0.05), 0));
  }
  // 막대: 플랜지에서 눈까지 가늘어짐(반지름 0.07 → 0.045), 로컬 +X
  const x0 = fx + ft;
  const x1 = length - eyeR + 0.01;
  const taper = lathe(
    [
      [0, 0],
      [0.075, 0],
      [0.07, 0.03],
      [0.05, (x1 - x0) * 0.45],
      [0.045, x1 - x0],
      [0, x1 - x0]
    ],
    28
  );
  taper.rotateZ(-Math.PI / 2);
  g.add(meshAt(taper, steel(), x0, 0, 0));
  // 끝 눈(핀 구멍): 얇은 고리(포크 사이에 들어간다)
  const eye = lathe(tubeProfile(0.036, eyeR, -0.03, 0.03, 0.006), 32);
  eye.rotateX(Math.PI / 2);
  g.add(meshAt(eye, steel(), length, 0, 0));
  const pin = new THREE.Object3D();
  pin.name = 'rodEye';
  pin.position.set(length, 0, 0);
  markPin(pin);
  g.add(pin);
  g.userData.outlines = { hole };
  setMM(g, { kind: 'strap', rIn, rOut, length, width: w });
  return g;
}

/**
 * 밸브 막대(89번, 판화에 없음 — 편심 막대 끝을 받는 곧은 막대). **원점 = 핀 중심**, 막대 = 로컬 +X 로 length 까지.
 * 포크 두 볼(앞·뒤) + 핀 + 네모 막대(한 변 bar).
 */
export function valveRod(length: number, bar = 0.09): THREE.Group {
  const g = new THREE.Group();
  for (const sz of [-1, 1]) g.add(meshAt(extrude(roundedRect(-0.085, -0.075, 0.16, 0.075, 0.03), 0.035, 0.004), brass(), 0, 0, sz * 0.055));
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.15, 0.145), brass(), 0.14, 0, 0));
  g.add(mesh(cylZ(0.034, 0.19), darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(length - 0.15, bar, bar), steel(), (length + 0.15) / 2, 0, 0));
  markPin(g);
  setMM(g, { length, bar });
  return g;
}

// ───────────────────────── 90: 긴 구멍 요크 ─────────────────────────

/** 세로로 긴 스타디움(두 반원 + 곧은 옆변) 윤곽. 반폭 halfW, 곧은 부분 반길이 halfStraight. 반시계 */
export function stadiumOutline(halfW: number, halfStraight: number, n = 48): V2[] {
  const p: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    p.push([Math.cos(a) * halfW, halfStraight + Math.sin(a) * halfW]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    p.push([Math.cos(a) * halfW, -halfStraight + Math.sin(a) * halfW]);
  }
  return p;
}

export interface YokeOpts {
  /** 요크 테의 폭(구멍 가장자리에서 바깥까지), 기본 0.15 */
  band?: number;
  /** 두께(z), 기본 0.12 */
  width?: number;
  /** 왼쪽·오른쪽 막대 끝의 x(요크 중심에서의 거리), 기본 1.5 / 1.65 */
  rodLeft?: number;
  rodRight?: number;
  /** 막대(네모) 높이, 기본 0.14 */
  rodH?: number;
}

/**
 * 긴 구멍 요크(90번): 세로로 긴 스타디움 구멍(반폭 halfW, 곧은 옆변 반길이 halfStraight)을 가진 테 + 좌우로 뻗은 네모 막대 둘.
 * **원점 = 구멍 중심**, 막대 = 로컬 ±X, 두께 가운데 z = 0. 황동.
 * userData.outlines.hole = 구멍 윤곽(편심 원판이 이 안에서 위아래로만 미끄러진다).
 */
export function slotYoke(halfW: number, halfStraight: number, opts: YokeOpts = {}): THREE.Group {
  const band = opts.band ?? 0.15;
  const w = opts.width ?? 0.12;
  const rodLeft = opts.rodLeft ?? 1.5;
  const rodRight = opts.rodRight ?? 1.65;
  const rodH = opts.rodH ?? 0.14;
  const g = new THREE.Group();
  const hole = stadiumOutline(halfW, halfStraight);
  const shape = shapeFrom(stadiumOutline(halfW + band, halfStraight));
  shape.holes.push(pathFrom([...hole].reverse()));
  g.add(mesh(extrude(shape, w, 0.008, 48), brass()));
  const xo = halfW + band - 0.02;
  g.add(meshAt(new THREE.BoxGeometry(rodLeft - xo, rodH, w * 0.8), steel(), -(rodLeft + xo) / 2, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(rodRight - xo, rodH, w * 0.8), steel(), (rodRight + xo) / 2, 0, 0));
  g.userData.outlines = { hole };
  setMM(g, { kind: 'yoke', halfW, halfStraight, band, width: w, rodLeft, rodRight });
  return g;
}

// ───────────────────────── 91: 삼각 편심 ─────────────────────────

/**
 * 삼각 편심의 윤곽: 폭 w 인 뢸로 삼각형을 ρ 만큼 부풀린 꼴(어느 방향으로 재도 폭 w + 2ρ).
 * **원점 = 축이 꿰인 꼭짓점 V0**, 대칭축 = 로컬 +Y(맞은편 큰 호가 위). 나머지 두 꼭짓점 V1 = w·(120°), V2 = w·(60°).
 * 여섯 호: 꼭짓점 둘레 작은 호(반지름 ρ) 셋 + 맞은편 꼭짓점 중심 큰 호(반지름 w + ρ) 셋. 반시계, 6·n 점.
 */
export function triCamOutline(w: number, rho: number, n = 40): V2[] {
  const v: V2[] = [
    [0, 0],
    [w * Math.cos(120 * DEG), w * Math.sin(120 * DEG)],
    [w * Math.cos(60 * DEG), w * Math.sin(60 * DEG)]
  ];
  // [중심 꼭짓점 번호, 반지름, 바깥 법선 각 시작, 끝(도)]
  const seg: [number, number, number, number][] = [
    [0, rho, 240, 300],
    [1, w + rho, 300, 360],
    [2, rho, 0, 60],
    [0, w + rho, 60, 120],
    [1, rho, 120, 180],
    [2, w + rho, 180, 240]
  ];
  const p: V2[] = [];
  for (const [k, r, a0, a1] of seg) {
    const c = v[k]!;
    for (let i = 0; i < n; i++) {
      const a = (a0 + ((a1 - a0) * i) / n) * DEG;
      p.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
    }
  }
  return p;
}

/**
 * 삼각 편심이 판화 자세(대칭축이 위)에서 thetaE(rad, 어느 쪽으로 돌든 같다) 돌았을 때,
 * 축에서 위쪽 맞닿는 면까지의 높이에서 ρ 를 뺀 값 h(0 ~ w). 틀 중심의 변위 = h − w/2.
 * 한 바퀴: 0~30° 멈춤(h = w) → 30~90° w·cos(ψ − 30°) → 90~150° w·cos(ψ + 30°) + w → 150~180° 멈춤(h = 0), 뒤 반 바퀴는 거울.
 */
export function triCamLift(w: number, thetaE: number): number {
  const d = (((thetaE / DEG) % 360) + 540) % 360;
  const psi = Math.abs(d - 180);
  if (psi <= 30) return w;
  if (psi <= 90) return w * Math.cos((psi - 30) * DEG);
  if (psi <= 150) return w * Math.cos((psi + 30) * DEG) + w;
  return 0;
}

/**
 * 삼각 편심(91번): 윤곽 triCamOutline(w, rho) 를 두께 width 로 눌러 낸 판 + 축 둘레 허브 고리. **원점 = 축**, 회전축 = 로컬 Z, 가운데 z = 0. 청동(구동).
 * userData.outline = 윤곽.
 */
export function triangularCam(w: number, rho: number, opts: { width?: number; bore?: number } = {}): THREE.Group {
  const width = opts.width ?? 0.12;
  const bore = opts.bore ?? 0.05;
  const g = new THREE.Group();
  const outline = triCamOutline(w, rho);
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, bore));
  g.add(mesh(extrude(shape, width, 0.008, 48), bronze({ roughness: 0.36 })));
  g.add(mesh(hubBoss(bore, rho * 0.92, width + 0.03), bronze({ roughness: 0.3 })));
  g.add(meshAt(cylZ(0.024, 0.01), darkSteel(), 0, w * 0.78, width / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', shape: 'triangular', w, rho, width, axis: 'z' });
  return g;
}

export interface CamFrameOpts {
  /** 틀 테의 폭, 기본 0.13 */
  band?: number;
  /** 위·아래 닳음 띠(맞닿는 곧은 막대)의 두께, 기본 0.04 */
  strip?: number;
  /** 두께(z), 기본 0.12 */
  width?: number;
  /** 옆변이 바깥으로 볼록한 양(판화), 기본 0.04 */
  bow?: number;
  /** 위·아래 둥근 막대의 길이(틀 바깥 면에서), 기본 0.77 */
  rodLen?: number;
  /** 막대 반지름, 기본 0.05 */
  rodR?: number;
}

/**
 * 삼각 편심의 네모 틀(91번): 안쪽 창(가로 반폭 halfW, 위·아래 닳음 띠 사이 간격 gap) + 테 + 위·아래로 뻗은 둥근 막대.
 * **원점 = 창 중심**, 막대 = 로컬 ±Y, 두께 가운데 z = 0. 테 = 황동, 닳음 띠 = 강.
 * 틀 바깥 반높이 = gap/2 + strip + band. userData.outlines.hole = 닳음 띠 사이의 네모 창(±halfW, ±gap/2).
 */
export function camFrame(halfW: number, gap: number, opts: CamFrameOpts = {}): THREE.Group {
  const band = opts.band ?? 0.13;
  const strip = opts.strip ?? 0.04;
  const w = opts.width ?? 0.12;
  const bow = opts.bow ?? 0.04;
  const rodLen = opts.rodLen ?? 0.77;
  const rodR = opts.rodR ?? 0.05;
  const g = new THREE.Group();
  const hi = gap / 2 + strip; // 테 안쪽 반높이
  const ho = hi + band; // 바깥 반높이
  const side = (hx: number, hy: number): V2[] => {
    // 네모(반폭 hx, 반높이 hy), 옆변만 바깥으로 bow 만큼 볼록. 반시계
    const p: V2[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const y = -hy + (2 * hy * i) / n;
      p.push([hx + bow * (1 - (y / hy) ** 2), y]);
    }
    for (let i = 0; i <= n; i++) {
      const y = hy - (2 * hy * i) / n;
      p.push([-hx - bow * (1 - (y / hy) ** 2), y]);
    }
    return p;
  };
  const shape = shapeFrom(side(halfW + band, ho));
  shape.holes.push(pathFrom(side(halfW, hi).reverse()));
  g.add(mesh(extrude(shape, w, 0.008), brass()));
  for (const sy of [-1, 1]) {
    g.add(meshAt(new THREE.BoxGeometry(2 * halfW - 0.03, strip, w * 0.9), steel(), 0, sy * (gap / 2 + strip / 2), 0));
    const rodGeo = new THREE.CylinderGeometry(rodR, rodR, rodLen + 0.02, 24);
    g.add(meshAt(rodGeo, steel(), 0, sy * (ho + rodLen / 2 - 0.01), 0));
  }
  const hole: V2[] = [
    [-halfW, -gap / 2],
    [halfW, -gap / 2],
    [halfW, gap / 2],
    [-halfW, gap / 2]
  ];
  // 침범 검사가 변 위의 점도 보도록 변을 잘게 나눈다
  const fine: V2[] = [];
  for (let k = 0; k < 4; k++) {
    const a = hole[k]!;
    const b = hole[(k + 1) % 4]!;
    for (let i = 0; i < 12; i++) fine.push([a[0] + ((b[0] - a[0]) * i) / 12, a[1] + ((b[1] - a[1]) * i) / 12]);
  }
  g.userData.outlines = { hole: fine };
  setMM(g, { kind: 'frame', halfW, gap, halfH: ho, width: w, rodLen });
  return g;
}

// ───────────────────────── 공용: 막대 안내 ─────────────────────────

/**
 * 고정 안내(판화에 없음 — 원문의 fixed guides): 막대가 지나는 구멍 난 블록 + 뒤판까지 닿는 받침 기둥. 주철.
 * **원점 = 구멍 중심**(모델이 (x, y, 막대 평면 z) 에 놓는다). axis = 막대가 지나는 방향.
 * hole: 숫자면 둥근 구멍 반지름, {w, h} 면 네모 구멍(w = 화면에서 보이는 폭, h = 깊이 z 쪽). len = 막대 방향 길이.
 * zc = 놓일 z(받침 기둥이 뒤판 앞면 STAGE.backZ 까지 닿게 하는 데 쓴다).
 */
export function rodGuide(axis: 'x' | 'y', hole: number | { w: number; h: number }, zc: number, len = 0.14): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron();
  const hw = typeof hole === 'number' ? hole : hole.w / 2; // 화면 폭 쪽 반치수
  const hz = typeof hole === 'number' ? hole : hole.h / 2; // 깊이 쪽 반치수
  const wall = 0.06;
  // 블록 단면(로컬: u = 깊이 z 쪽, v = 화면 폭 쪽), 막대 방향으로 len 만큼 눌러 냄
  const shape = roundedRect(-(hz + wall), -(hw + wall), hz + wall, hw + wall, 0.02);
  if (typeof hole === 'number') shape.holes.push(circlePath(0, 0, hole + 0.003));
  else
    shape.holes.push(
      pathFrom([
        [-hz - 0.003, -hw - 0.003],
        [-hz - 0.003, hw + 0.003],
        [hz + 0.003, hw + 0.003],
        [hz + 0.003, -hw - 0.003]
      ])
    );
  const block = extrude(shape, len, 0.006);
  // 눌러 낸 방향(Z) → 막대 방향, 단면 u → 월드 z
  if (axis === 'x') {
    block.rotateY(Math.PI / 2); // Z→X, X(u)→−Z
  } else {
    block.rotateY(Math.PI / 2); // u → −Z, 눌러 낸 방향 → X
    block.rotateZ(Math.PI / 2); // X → Y, 폭 v(Y) → −X
  }
  g.add(mesh(block, iron));
  // 받침 기둥: 블록 뒷면에서 뒤판 앞면까지
  const back = STAGE.backZ - zc;
  const postLen = -(hz + wall) - back + 0.01;
  if (postLen > 0.005) {
    const post = axis === 'x' ? new THREE.BoxGeometry(len * 0.7, (hw + wall) * 1.4, postLen) : new THREE.BoxGeometry((hw + wall) * 1.4, len * 0.7, postLen);
    g.add(meshAt(post, iron, 0, 0, back + postLen / 2));
    const foot = axis === 'x' ? new THREE.BoxGeometry(len * 1.5, (hw + wall) * 2.6, 0.03) : new THREE.BoxGeometry((hw + wall) * 2.6, len * 1.5, 0.03);
    g.add(meshAt(foot, darkSteel(), 0, 0, back + 0.015));
  }
  setMM(g, { kind: 'guide', axis, len });
  return g;
}
