// 053·054 전용 키트 — 발톱(도그) 클러치, 가로·세로 축, 팔 베어링, 시프트 요크·벨 크랭크·당김 막대(053)
// 아래쪽 맹글 랙 이 + 안내 레일은 054 의 옛 해석(랙 두 개)용 — 판화와 달라 054 설계표가 보류 중이므로 쓰지 않는다
// 모델은 '../kit/k053' 에서 직접 import 한다(kit/index.ts 에는 넣지 않는다).
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { annularSector, extrude, lathe, merge, mesh, rodProfile, shapeFrom, tubeProfile, TAU } from '../../models/parts/geom';
import type { V2 } from './belt';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// ───────────────────────── 축 · 베어링 ─────────────────────────

/** X 방향 축 막대(x0 → x1). 그룹 원점 = 축 중심선 위의 점이라 `group.position=(0,y,z)`, `rotation.x=β` 로 돌린다. 선택: 키(깃) 띠. */
export function rodX(x0: number, x1: number, r = 0.045, key?: { x0: number; x1: number }): THREE.Group {
  const g = new THREE.Group();
  const geo = lathe(rodProfile(r, 0, x1 - x0, r * 0.25, r * 0.25), 32);
  geo.rotateZ(-Math.PI / 2); // 프로파일 y → x
  g.add(meshAt(geo, steel(), x0, 0, 0));
  // 표시선: 회전이 보이게 밝은 가는 줄(축 방향)
  g.add(meshAt(new THREE.BoxGeometry(x1 - x0 - 0.04, 0.012, 0.012), paint(0xf2b619), (x0 + x1) / 2, r + 0.002, 0));
  if (key !== undefined) {
    // 깃(feather key): 축 윗면 +Y 에 얹힌 긴 키 — 클러치가 이 위를 미끄러진다
    g.add(meshAt(new THREE.BoxGeometry(key.x1 - key.x0, 0.03, 0.034), darkSteel(), (key.x0 + key.x1) / 2, r + 0.008, 0));
  }
  return g;
}

/** Y 방향(세로) 축 막대(y0 → y1). 그룹 원점 = (0,0,0) — `group.position=(x,0,z)`, `rotation.y=ψ` */
export function rodY(y0: number, y1: number, r = 0.045): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(lathe(rodProfile(r, 0, y1 - y0, r * 0.25, r * 0.25), 32), steel(), 0, y0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.012, y1 - y0 - 0.04, 0.012), paint(0xf2b619), r + 0.002, (y0 + y1) / 2, 0));
  return g;
}

/**
 * 팔 베어링: 원점 = 베어링 중심, 링 + 뒤판(z = −back)까지 뻗는 굵은 팔. axis = 받치는 축 방향('x' | 'y').
 * back = 베어링 z − STAGE.backZ(뒤판 앞면까지의 거리)
 */
export function armBearing(axis: 'x' | 'y', back: number): THREE.Group {
  const g = new THREE.Group();
  const ring = lathe(tubeProfile(0.047, 0.086, -0.045, 0.045, 0.008), 36);
  if (axis === 'x') ring.rotateZ(-Math.PI / 2);
  g.add(mesh(ring, darkSteel()));
  const len = back - 0.086;
  g.add(meshAt(new THREE.BoxGeometry(0.08, 0.08, len), castIron(), 0, 0, -0.086 - len / 2));
  // 뒤판 쪽 받침판
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.2, 0.03), castIron(), 0, 0, -back + 0.015));
  return g;
}

// ───────────────────────── 발톱(도그) 링 · 이중 클러치 ─────────────────────────

export interface ClawRingOpts {
  /** 발톱 수(기본 4) */
  teeth?: number;
  /** 발톱 반지름 범위(기본 0.07 ~ 0.115) */
  rIn?: number;
  rOut?: number;
  /** 축 구멍(기본 0.047) */
  bore?: number;
  /** 목통 길이(z 0 → base, 기본 0.12) */
  base?: number;
  /** 발톱 높이(기본 0.04) */
  tooth?: number;
  /** 발톱 각폭 = frac × 피치각(기본 0.34, 나머지는 홈) */
  frac?: number;
  /** 첫 발톱 중심각(로컬 XY 평면, +X 에서 반시계, 기본 0). 발톱 j 의 중심 = phase + j·2π/teeth */
  phase?: number;
  /** true 면 청동색(클러치), 아니면 황동색 */
  driver?: boolean;
}

/** 헐거운 기어에 붙는 발톱 링: 회전축 = 로컬 Z, 목통 z ∈ [0, base], 발톱 z ∈ [base, base+tooth], 발톱 끝 = +Z */
export function clawRing(o: ClawRingOpts = {}): THREE.Group {
  const n = o.teeth ?? 4;
  const rIn = o.rIn ?? 0.07;
  const rOut = o.rOut ?? 0.115;
  const bore = o.bore ?? 0.047;
  const base = o.base ?? 0.12;
  const tooth = o.tooth ?? 0.04;
  const frac = o.frac ?? 0.34;
  const phase = o.phase ?? 0;
  const body = o.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = new THREE.Group();
  const collar = lathe(tubeProfile(bore, rOut, 0, base, 0.006), 36);
  collar.rotateX(Math.PI / 2);
  g.add(mesh(collar, body));
  const p = TAU / n;
  const geos: THREE.BufferGeometry[] = [];
  for (let j = 0; j < n; j++) {
    const a = phase + j * p;
    const geo = extrude(annularSector(rIn, rOut, a - (frac * p) / 2, a + (frac * p) / 2), tooth, 0, 8);
    geo.translate(0, 0, base + tooth / 2);
    geos.push(geo);
  }
  g.add(mesh(merge(geos), body));
  return g;
}

export interface DoubleClutchOpts {
  /** 몸통 반길이(발톱 뿌리면까지, 기본 0.16) — 발톱 끝은 ±(half + tooth) */
  half?: number;
  /** 몸통 반지름(기본 0.115) */
  rCore?: number;
  /** 홈(요크가 들어가는 곳): 반폭·바닥 반지름(기본 0.025, 0.09) */
  grooveHalf?: number;
  grooveR?: number;
  bore?: number;
  teeth?: number;
  rIn?: number;
  tooth?: number;
  frac?: number;
}

/**
 * 이중 클러치: 회전축 = 로컬 X(양끝에 발톱, 가운데 홈). 원점 = 클러치 중심.
 * 발톱 중심각 ρ(+Y 에서 +Z 쪽으로 잰 각, 그룹 rotation.x = β 를 더한 것이 실제 각) = π/4 + j·(2π/teeth) — 양끝 모두 같은 각.
 */
export function doubleClutch(o: DoubleClutchOpts = {}): THREE.Group {
  const h = o.half ?? 0.16;
  const rc = o.rCore ?? 0.115;
  const gh = o.grooveHalf ?? 0.025;
  const gr = o.grooveR ?? 0.09;
  const bore = o.bore ?? 0.047;
  const n = o.teeth ?? 4;
  const rIn = o.rIn ?? 0.07;
  const tooth = o.tooth ?? 0.04;
  const frac = o.frac ?? 0.34;
  const body = bronze({ roughness: 0.34 });
  const g = new THREE.Group();
  const profile: V2[] = [
    [bore, -h], [rc, -h], [rc, -gh], [gr, -gh], [gr, gh], [rc, gh], [rc, h], [bore, h], [bore, -h]
  ];
  const core = lathe(profile, 40);
  core.rotateZ(-Math.PI / 2); // y → x
  g.add(mesh(core, body));
  const p = TAU / n;
  for (const side of [-1, 1]) {
    const geos: THREE.BufferGeometry[] = [];
    for (let j = 0; j < n; j++) {
      const rho = Math.PI / 4 + j * p; // 목표 각 ρ
      const a = rho + Math.PI / 2; // rotateY(π/2) 뒤에 ρ 가 되도록 하는 형상각 (a = ρ + π/2)
      const geo = extrude(annularSector(rIn, rc, a - (frac * p) / 2, a + (frac * p) / 2), tooth, 0, 8);
      geo.translate(0, 0, side * (h + tooth / 2));
      geo.rotateY(Math.PI / 2); // (x,y,z) → (z, y, −x): 압출축 z → x
      geos.push(geo);
    }
    g.add(mesh(merge(geos), body));
  }
  return g;
}

// ───────────────────────── 시프트 요크 · 레버 ─────────────────────────

function slotPath(cx: number, cy: number, halfLen: number, hw: number): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy + halfLen - hw, hw, 0, Math.PI, false);
  p.absarc(cx, cy - halfLen + hw, hw, Math.PI, TAU, false);
  p.closePath();
  return p;
}

/**
 * 시프트 요크: 원점 = 클러치 홈 중심. 홈 아래쪽을 두르는 반고리(YZ 평면, 두께 X = ringW) + 아래로 내려가는 얇은 팔판(XY 평면, 두께 z 0.03,
 * 가운데 z=0). 팔 끝에 세로 슬롯(중심 y = −slotDrop, 길이 slotLen) — 레버 끝 핀이 이 안에서 미끄러진다.
 */
export function shiftYoke(opts: { grooveR?: number; ringW?: number; slotDrop?: number; slotLen?: number; slotHalf?: number } = {}): THREE.Group {
  const gr = opts.grooveR ?? 0.09;
  const sh = opts.slotHalf ?? 0.015; // 슬롯 반폭(선택, 기본 0.015 — 053 은 끝 핀 반지름 0.018 보다 넓게 0.02)
  const rw = opts.ringW ?? 0.04;
  const drop = opts.slotDrop ?? 0.35;
  const sl = opts.slotLen ?? 0.07;
  const r0 = gr + 0.003;
  const r1 = r0 + 0.032;
  const g = new THREE.Group();
  // 반고리: XY 형상(아래 반원) → rotateY(π/2) → 반원이 YZ 평면에 놓이고 두께가 X 로
  const ringGeo = extrude(annularSector(r0, r1, Math.PI, TAU), rw, 0.004, 24);
  ringGeo.rotateY(Math.PI / 2);
  g.add(mesh(ringGeo, steel()));
  // 팔판
  const bottom = -(drop + sl / 2 + 0.05);
  const shape = shapeFrom([[-0.045, bottom], [0.045, bottom], [0.045, -r0 - 0.012], [-0.045, -r0 - 0.012]]);
  shape.holes.push(slotPath(0, -drop, sl / 2, sh));
  g.add(mesh(extrude(shape, 0.03, 0.003, 8), steel()));
  return g;
}

/**
 * 시프트 레버: 원점 = 받침점(핀). +Y 로 up(끝 핀 위치), −Y 로 down(손잡이 공 끝). 평판 두께 z 0.03(가운데 z=0).
 * 끝 핀은 로컬 z −0.045 ~ +0.03, 받침 핀은 z −0.07 ~ +0.03. 기울기: `group.rotation.z = −α`, α = asin(s / up) 이면 끝이 x = s.
 */
export function shiftLever(up = 0.55, down = 0.3): THREE.Group {
  const g = new THREE.Group();
  const bar = shapeFrom([[-0.022, -down], [0.022, -down], [0.022, up], [-0.022, up]]);
  g.add(mesh(extrude(bar, 0.03, 0.004, 8), castIron()));
  const pivot = lathe(rodProfile(0.045, -0.07, 0.03, 0.006, 0.006), 24);
  pivot.rotateX(Math.PI / 2);
  g.add(mesh(pivot, darkSteel()));
  const tip = lathe(rodProfile(0.018, -0.045, 0.03, 0.004, 0.004), 20);
  tip.rotateX(Math.PI / 2);
  g.add(meshAt(tip, darkSteel(), 0, up, 0));
  const knob = new THREE.SphereGeometry(0.045, 20, 14);
  g.add(meshAt(knob, wood(), 0, -down - 0.03, 0));
  return g;
}

/**
 * 벨 크랭크(ㄴ자 레버) — 판화 53 의 시프트 장치: 원점 = 받침점(핀). 세로 팔이 +Y 로 up(끝 핀 = 클러치 홈·요크 슬롯에 걸림),
 * 가로 팔이 −X 로 side(끝 핀 = 당김 막대 `pullRod` 의 눈이 걸림). 평판 두께 z 0.03(가운데 z=0).
 * 세로 팔 끝 핀은 로컬 z −0.045 ~ +0.03(뒤쪽 요크 판으로), 가로 팔 끝 핀은 z −0.015 ~ +0.055(앞쪽 당김 막대로), 받침 핀은 z −0.07 ~ +0.03.
 * 기울기: `group.rotation.z = −φ`, φ = asin(s / up) 이면 세로 팔 끝이 x = s, 가로 팔 끝은 (−side·cos φ, +side·sin φ).
 */
export function shiftBellCrank(up = 0.25, side = 0.25): THREE.Group {
  const g = new THREE.Group();
  const w = 0.022;
  const shape = shapeFrom([[-side, -w], [w, -w], [w, up], [-w, up], [-w, w], [-side, w]]);
  g.add(mesh(extrude(shape, 0.03, 0.004, 8), castIron()));
  const pivot = lathe(rodProfile(0.045, -0.07, 0.03, 0.006, 0.006), 24);
  pivot.rotateX(Math.PI / 2);
  g.add(mesh(pivot, darkSteel()));
  const tip = lathe(rodProfile(0.018, -0.045, 0.03, 0.004, 0.004), 20);
  tip.rotateX(Math.PI / 2);
  g.add(meshAt(tip, darkSteel(), 0, up, 0));
  const eyePin = lathe(rodProfile(0.016, -0.015, 0.055, 0.004, 0.004), 20);
  eyePin.rotateX(Math.PI / 2);
  g.add(meshAt(eyePin, darkSteel(), -side, 0, 0));
  return g;
}

/**
 * 당김 막대 — 판화 53 에서 벨 크랭크 가로 팔 끝에서 아래로 내려가는 세로 막대. 원점 = 위쪽 눈(고리) 중심, 막대는 −Y 로 len.
 * 눈은 XY 평면의 납작한 고리(안 0.018, 바깥 0.04, 두께 z 0.02, 가운데 z=0). 아래 끝의 가로 손잡이는 판화에 없음(판화는 막대가 끊겨 있다).
 * 늘 세로로 선 채 `position = 벨 크랭크 가로 팔 끝 핀` 을 따라 오르내린다.
 */
export function pullRod(len = 0.6): THREE.Group {
  const g = new THREE.Group();
  const eye = lathe(tubeProfile(0.018, 0.04, -0.01, 0.01, 0.003), 24);
  eye.rotateX(Math.PI / 2);
  g.add(mesh(eye, steel()));
  const rod = lathe(rodProfile(0.014, 0.038, len, 0.003, 0.003), 16);
  rod.rotateZ(Math.PI); // 프로파일 +y → −y
  g.add(mesh(rod, steel()));
  const grip = lathe(rodProfile(0.022, -0.07, 0.07, 0.006, 0.006), 16);
  grip.rotateZ(Math.PI / 2); // +y → −x (가로 손잡이)
  g.add(meshAt(grip, wood(), 0, -len, 0));
  return g;
}

/** 받침 팔(보): 뒤판(z = −back)에서 z = 0 까지의 정사각 막대 + 받침판. 원점 = 막대 앞 끝. 시프트 레버 받침점용 */
export function pivotBeam(back: number): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.06, back), castIron(), 0, 0, -back / 2));
  g.add(meshAt(new THREE.BoxGeometry(0.16, 0.16, 0.03), castIron(), 0, 0, -back + 0.015));
  return g;
}

// ───────────────────────── 맹글 랙 이 + 안내 레일 (054) ─────────────────────────

/**
 * 랙 폭 이: 20° 직선 측면 랙(바퀴 인벌류트 이와 맞물림 — shots/_verify/s054_mesh.mjs 로 침범 0 확인).
 * 로컬 좌표: X = 접선(바퀴 반시계 방향이 +), Y = 바퀴 쪽(안쪽, 이가 +Y 로 뻗음), Z = 바깥으로 폭(앞으로).
 * 원점 = 가운데 이의 중심, 피치선 y=0. 이 j 의 중심 x = (j − (teeth−1)/2)·π·module. 이끝 y=+module, 이뿌리 y=−1.25·module,
 * 피치선 이 두께 0.46·(π·module). 몸통 y ∈ [−1.25m − 0.09, −1.25m]. 몸통 뒤(−Y 쪽) 줄기(막대)가 stemLen 까지 뻗는다.
 */
export function rackHead(teeth: number, module: number, width: number, stemLen = 0.8): THREE.Group {
  const m = module;
  const pc = Math.PI * m;
  const t0 = 0.46 * pc;
  const ta = Math.tan((20 * Math.PI) / 180);
  const half = (y: number): number => t0 / 2 - y * ta; // y: 피치선에서 바퀴 쪽이 +
  const g = new THREE.Group();
  const body = brass();
  const geos: THREE.BufferGeometry[] = [];
  for (let j = 0; j < teeth; j++) {
    const xc = (j - (teeth - 1) / 2) * pc;
    const pts: V2[] = [
      [xc - half(-1.25 * m), -1.25 * m], [xc + half(-1.25 * m), -1.25 * m],
      [xc + half(m), m], [xc - half(m), m]
    ];
    const geo = extrude(shapeFrom(pts), width, 0.003, 4);
    geos.push(geo);
  }
  g.add(mesh(merge(geos), body));
  const bw = teeth * pc;
  g.add(meshAt(new THREE.BoxGeometry(bw, 0.09, width), body, 0, -1.25 * m - 0.045, 0));
  // 줄기
  const yb = -1.25 * m - 0.09;
  const stem = lathe(rodProfile(0.022, 0, stemLen - (1.25 * m + 0.09), 0.004, 0.004), 20);
  stem.rotateZ(Math.PI); // 프로파일 +y → −y
  g.add(meshAt(stem, steel(), 0, yb, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.03, 0.05), darkSteel(), 0, -stemLen - 0.0, 0)); // 줄기 끝 마개
  return g;
}

/**
 * 안내 수레(캐리지): rackHead 와 같은 로컬 좌표(원점 = 피치선 점, X = 접선, Y = 안쪽). 수평으로만 움직이는 부분.
 * 줄기가 통과하는 슬리브(y −0.56 ~ −0.40) + 뒤로 가는 판 + 레일을 감싼 블록(레일 중심 y = −0.625, z = −railBack).
 */
export function guideCarriage(railBack: number): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(0.14, 0.16, 0.12), castIron(), 0, -0.48, 0));
  const web = railBack - 0.06;
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.1, web + 0.02), castIron(), 0, -0.56, -0.06 - web / 2));
  g.add(meshAt(new THREE.BoxGeometry(0.18, 0.12, 0.12), darkSteel(), 0, -0.625, -railBack));
  return g;
}

/** 안내 레일: 원점 = 레일 한쪽 끝 중심, +X 로 len. 양끝에서 뒤판(z = −back)까지 받침 막대(기둥) */
export function guideRail(len: number, back: number): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(len, 0.04, 0.04), steel(), len / 2, 0, 0));
  for (const x of [0.04, len - 0.04]) {
    const post = lathe(rodProfile(0.03, 0, back, 0.005, 0.005), 16);
    post.rotateX(-Math.PI / 2); // +y → −z
    g.add(meshAt(post, castIron(), x, 0, 0));
  }
  return g;
}
