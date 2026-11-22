// 전동용 기계요소: 마찰차, 평/헬리컬/베벨/웜 기어, 래크와 피니언, 벨트와 풀리, 스프로킷, 체인, 캠, 링크

import * as THREE from 'three';
import { steel, darkSteel, brass, bronze, rubber, paint, castIron, aluminum } from '../materials';
import {
  type V2,
  TAU,
  mesh,
  merge,
  lathe,
  loft,
  extrude,
  circlePts,
  circlePath,
  shapeFrom,
  stadiumShape,
  roundedRect,
  kidneyPath,
  threadedRod,
  trapezoidThread,
  sweepPlanar,
  tubeProfile,
  steppedProfile,
  type LoftLayer
} from './geom';
import { involuteOutline, gearDims, sprocketOutline } from './gears';
import { ChainPath2D, buildChainAlongPath } from './chain';

/** Y축 회전체를 Z축(화면 정면)으로 돌림 */
function toZ(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.rotateX(Math.PI / 2);
  return geo;
}
function toX(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.rotateZ(-Math.PI / 2);
  return geo;
}

/** 키 홈 있는 축 구멍 Path(홈은 +Y) */
function keyedBore(r: number, keyW: number, keyD: number): THREE.Path {
  const w = keyW / 2;
  const a1 = Math.asin(w / r);
  const p = new THREE.Path();
  const top = Math.sqrt(r * r - w * w);
  p.moveTo(w, top);
  p.lineTo(w, r + keyD);
  p.lineTo(-w, r + keyD);
  p.lineTo(-w, top);
  p.absarc(0, 0, r, Math.PI / 2 + a1, Math.PI / 2 - a1 + TAU, false);
  p.closePath();
  return p;
}

/** 축(Z) 한 토막: 양끝 모따기 */
function shaftZ(r: number, z0: number, z1: number, c = 0.01, segs = 32): THREE.BufferGeometry {
  return toZ(lathe([[0, z0], [r - c, z0], [r, z0 + c], [r, z1 - c], [r - c, z1], [0, z1]], segs));
}

/** 표준 치형 기어 링 (Z축, 면폭 depth, 이끝 모따기) */
function gearRing(teeth: number, rp: number, depth: number, holes: V2[][], phase?: number, twist = 0): THREE.BufferGeometry {
  const { ra, rf } = gearDims(teeth, rp);
  const outline = involuteOutline(teeth, ra, rf, phase ?? Math.PI / teeth);
  const c = Math.min((ra - rf) * 0.18, depth * 0.1);
  const layers: LoftLayer[] = [];
  const z0 = -depth / 2;
  const n = twist !== 0 ? 14 : 1;
  layers.push({ z: z0, s: (ra - c) / ra, hs: 1, rot: (twist * z0) / depth });
  for (let i = 0; i <= n; i++) {
    const z = z0 + c + ((depth - 2 * c) * i) / n;
    layers.push({ z, s: 1, hs: 1, rot: (twist * z) / depth });
  }
  layers.push({ z: -z0, s: (ra - c) / ra, hs: 1, rot: (twist * -z0) / depth });
  return loft(outline, holes, layers);
}

// ─────────────────────────── 마찰차 ───────────────────────────

function frictionDisc(R: number, width: number, hubR: number, metal: THREE.Material, rub: THREE.Material, g: THREE.Group, x: number, shaftLen: number): void {
  const band = 0.045;
  const h = width / 2;
  const rr = R - band;
  // 금속 몸체: 림 + 얇은 웹 + 허브
  const body = lathe(
    [
      [0.045, -h - 0.06],
      [hubR - 0.01, -h - 0.06],
      [hubR, -h - 0.05],
      [hubR, -0.035],
      [hubR + 0.02, -0.025],
      [rr - 0.05, -0.025],
      [rr - 0.035, -h + 0.01],
      [rr - 0.035, -h],
      [rr + 0.005, -h],
      [rr + 0.005, h],
      [rr - 0.035, h],
      [rr - 0.035, h - 0.01],
      [rr - 0.05, 0.025],
      [hubR + 0.02, 0.025],
      [hubR, 0.035],
      [hubR, h + 0.05],
      [hubR - 0.01, h + 0.06],
      [0.045, h + 0.06]
    ],
    80
  );
  const b = mesh(toZ(body), metal, g);
  b.position.x = x;
  // 가장자리 고무 띠(살짝 볼록)
  const bandProf: V2[] = [[rr, -h + 0.008]];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = -h + 0.004 + (2 * h - 0.008) * t;
    const crown = 0.006 * Math.sin(Math.PI * t);
    const edge = Math.min(1, Math.min(t, 1 - t) / 0.12);
    const ro = rr + band - 0.012 * (1 - Math.sqrt(edge)) + crown;
    bandProf.push([ro, y]);
  }
  bandProf.push([rr, h - 0.008]);
  const bnd = mesh(toZ(lathe(bandProf, 96, 0, TAU, 50)), rub, g);
  bnd.position.x = x;
  const sh = mesh(shaftZ(0.042, -shaftLen / 2, shaftLen / 2, 0.012), steel({ roughness: 0.25 }), g);
  sh.position.x = x;
}

export function buildFrictionWheel(): THREE.Group {
  const g = new THREE.Group();
  const R1 = 0.42;
  const R2 = 0.27;
  const rub = rubber({ color: 0x2a2d31 });
  frictionDisc(R1, 0.15, 0.1, aluminum({ roughness: 0.35 }), rub, g, -R2, 0.62);
  frictionDisc(R2, 0.15, 0.085, castIron({ color: 0x556070, roughness: 0.5 }), rub, g, R1, 0.62);
  g.rotation.set(0.35, -0.35, 0);
  return g;
}

// ─────────────────────────── 평 기어 ───────────────────────────

export function buildSpurGear(): THREE.Group {
  const g = new THREE.Group();
  const N = 24;
  const rp = 0.5;
  const face = 0.2;
  const rimIn = 0.37;
  const ring = gearRing(N, rp, face, [circlePts(rimIn, 96).reverse()]);
  // 웹(경량 구멍 6개)
  const web = new THREE.Shape();
  web.absarc(0, 0, rimIn + 0.01, 0, TAU, false);
  web.holes.push(circlePath(0, 0, 0.16));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    web.holes.push(circlePath(Math.cos(a) * 0.268, Math.sin(a) * 0.268, 0.062));
  }
  const webGeo = extrude(web, 0.08, 0.008, 64);
  // 허브: 키 홈 축 구멍
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, 0.165, 0, TAU, false);
  hubShape.holes.push(keyedBore(0.07, 0.04, 0.022));
  const hub = extrude(hubShape, 0.3, 0.014, 64);
  const gearMat = steel({ color: 0xc8d0d8, roughness: 0.26 });
  mesh(merge([ring, webGeo, hub]), gearMat, g);
  g.rotation.set(-0.15, 0.35, 0);
  return g;
}

// ─────────────────────────── 헬리컬 기어 ───────────────────────────

export function buildHelicalGear(): THREE.Group {
  const g = new THREE.Group();
  const N = 22;
  const rp = 0.48;
  const face = 0.34;
  const { m } = gearDims(N, rp);
  // 비틀림: 나선각 약 24°
  const twist = (face * Math.tan((24 * Math.PI) / 180)) / rp;
  const rimIn = rp - 1.25 * m - 0.07;
  const ring = gearRing(N, rp, face, [circlePts(rimIn, 96).reverse()], undefined, twist);
  const web = toZ(
    lathe(
      [
        [0.15, -0.06],
        [rimIn + 0.005, -0.06],
        [rimIn + 0.005, 0.06],
        [0.15, 0.06]
      ],
      96
    )
  );
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, 0.16, 0, TAU, false);
  hubShape.holes.push(keyedBore(0.068, 0.038, 0.02));
  const hub = extrude(hubShape, 0.42, 0.014, 64);
  mesh(merge([ring, web, hub]), brass({ roughness: 0.28 }), g);
  g.rotation.set(-0.25, 1.0, 0);
  return g;
}

// ─────────────────────────── 베벨 기어 쌍 ───────────────────────────

/**
 * 베벨 기어 1개(로컬 +Z가 원뿔 꼭짓점 방향, 이 큰 쪽 끝이 z=0).
 * rp: 피치원 반지름, delta: 피치 원뿔각, F: 이폭(원뿔 모선 방향)
 */
function bevelGearGeo(teeth: number, rp: number, delta: number, F: number, phase: number, bore: number, hubLen: number): THREE.BufferGeometry {
  const m = (2 * rp) / teeth;
  const ra = rp + m * Math.cos(delta);
  const rf = rp - 1.25 * m * Math.cos(delta);
  const Lp = rp / Math.tan(delta); // 피치원 → 꼭짓점 거리(축 방향)
  const zf = F * Math.cos(delta);
  const sAt = (z: number): number => (Lp - z) / Lp;
  const outline = involuteOutline(teeth, ra, rf, phase);
  const c = (ra - rf) * 0.14;
  const holeR = rf * sAt(zf) * 0.8;
  const layers: LoftLayer[] = [
    { z: -0.004, s: sAt(0) * (1 - c / ra), hs: 1 },
    { z: c * 0.7, s: sAt(c * 0.7), hs: 1 },
    { z: zf * 0.5, s: sAt(zf * 0.5), hs: 1 },
    { z: zf, s: sAt(zf), hs: 1 }
  ];
  const teethGeo = loft(outline, [circlePts(holeR, 64).reverse()], layers);
  // 몸체: 뒤쪽 원뿔(백 콘) + 허브 + 앞쪽 원뿔면
  const rfBack = rf * 0.99;
  const body = lathe(
    [
      [bore, -hubLen],
      [0.13 - 0.012, -hubLen],
      [0.13, -hubLen + 0.012],
      [0.13, -0.07],
      [rfBack * 0.86, -0.03],
      [rfBack, 0.0],
      [holeR + 0.01, zf - 0.001],
      [bore + 0.03, zf + (holeR - bore) * 0.35],
      [bore + 0.01, zf + (holeR - bore) * 0.35 + 0.01],
      [bore, zf + (holeR - bore) * 0.35 + 0.01],
      [bore, -hubLen]
    ].map(([r, y]) => [r!, y!] as V2),
    72
  );
  body.rotateX(Math.PI / 2); // 회전체 축 Y → 로컬 Z
  return merge([teethGeo, body]);
}

export function buildBevelGear(): THREE.Group {
  const g = new THREE.Group();
  const N1 = 24;
  const N2 = 16;
  const rp1 = 0.45;
  const rp2 = 0.3;
  const d1 = Math.atan2(N1, N2);
  const d2 = Math.PI / 2 - d1;
  const F = 0.17;
  const Lp1 = rp1 / Math.tan(d1);
  const Lp2 = rp2 / Math.tan(d2);
  const step1 = TAU / N1;
  // 기어1: 축 +Y(꼭짓점=원점 위쪽), 접촉 방향(-X)에 이골 → 로컬 각 π에 이골(이 중심은 반 피치 어긋남)
  const g1 = bevelGearGeo(N1, rp1, d1, F, Math.PI + step1 / 2, 0.06, 0.2);
  g1.rotateX(-Math.PI / 2); // 로컬 (x,y,z) → (x, z, -y)
  g1.translate(0, -Lp1, 0);
  mesh(g1, steel({ color: 0xc5cdd5, roughness: 0.26 }), g);
  // 기어2: 축 +X, 접촉 방향(-Y)에 이 중심 → 로컬 각 -π/2
  const g2 = bevelGearGeo(N2, rp2, d2, F, -Math.PI / 2, 0.05, 0.16);
  g2.rotateY(Math.PI / 2); // 로컬 (x,y,z) → (z, y, -x)
  g2.translate(-Lp2, 0, 0);
  mesh(g2, brass({ roughness: 0.28 }), g);
  // 축
  const sMat = steel({ roughness: 0.24 });
  const s1 = lathe([[0, -Lp1 - 0.55], [0.048, -Lp1 - 0.55], [0.058, -Lp1 - 0.54], [0.058, -Lp1 + 0.08], [0.048, -Lp1 + 0.09], [0, -Lp1 + 0.09]], 32);
  mesh(s1, sMat, g);
  const s2 = toX(lathe([[0, -Lp2 - 0.5], [0.038, -Lp2 - 0.5], [0.048, -Lp2 - 0.49], [0.048, -Lp2 + 0.07], [0.038, -Lp2 + 0.08], [0, -Lp2 + 0.08]], 32));
  mesh(s2, sMat, g);
  g.rotation.set(0.1, -0.5, 0);
  return g;
}

// ─────────────────────────── 웜과 웜 기어 ───────────────────────────

export function buildWormGear(): THREE.Group {
  const g = new THREE.Group();
  const N = 30;
  const rp = 0.42;
  const m = (2 * rp) / N;
  const p = Math.PI * m; // 축 방향 피치 = 리드(1줄)
  const rw = 0.12; // 웜 피치원 반지름
  const a = rp + rw; // 중심 거리
  // 웜(축 X, y = a): 실제 나선 사다리꼴 나사산
  const depth = 2.25 * m;
  const rMaj = rw + m;
  const prof = trapezoidThread(0.21, 0.27);
  const L = 0.36;
  // 아래쪽(θ=90°, 로컬 +X → 세계 -Y)에서 x=0에 골 중심이 오도록 위상 정렬
  const worm = threadedRod({
    rMajor: rMaj,
    depth,
    pitch: p,
    y0: -L,
    y1: L,
    profile: prof.profile,
    uSamples: prof.uSamples,
    u0: 0.25,
    chamfer0: true,
    chamfer1: true,
    segs: 72,
    capTop: true
  });
  const wormShaft = lathe(
    steppedProfile(
      [
        { r: 0.05, len: 0.18 },
        { r: 0.065, len: 0.12 },
        { r: rw - 1.25 * m - 0.002, len: 2 * L + 0.02 },
        { r: 0.065, len: 0.12 },
        { r: 0.05, len: 0.3 }
      ],
      -L - 0.31,
      0.008
    ),
    40
  );
  const wormGeo = toX(merge([worm, wormShaft]));
  wormGeo.translate(0, a, 0);
  mesh(wormGeo, steel({ roughness: 0.22 }), g);

  // 웜 휠(청동): 목(throat)이 오목한 치형 링 — 층마다 웜 축과 동심인 원을 따라 확대
  const ra0 = rp + m;
  const rf0 = rp - 1.25 * m;
  const Rt = a - ra0;
  const F = 0.15;
  const outline = involuteOutline(N, ra0, rf0, Math.PI / 2);
  const rimIn = rf0 - 0.06;
  const lead = Math.atan2(p, TAU * rw);
  const layers: LoftLayer[] = [];
  const nL = 12;
  for (let i = 0; i <= nL; i++) {
    const z = -F / 2 + (F * i) / nL;
    const rt = a - Math.sqrt(Math.max(0, Rt * Rt - z * z));
    let s = rt / ra0;
    if (i === 0 || i === nL) s *= 0.985;
    layers.push({ z, s, hs: 1, rot: (-z * Math.tan(lead)) / rp });
  }
  const wheelTeeth = loft(outline, [circlePts(rimIn, 96).reverse()], layers);
  const wheelBody = toZ(
    lathe(
      [
        [0.06, -0.12],
        [0.12, -0.12],
        [0.13, -0.11],
        [0.13, -0.035],
        [0.15, -0.025],
        [rimIn - 0.02, -0.025],
        [rimIn + 0.004, -0.05],
        [rimIn + 0.004, 0.05],
        [rimIn - 0.02, 0.025],
        [0.15, 0.025],
        [0.13, 0.035],
        [0.13, 0.11],
        [0.12, 0.12],
        [0.06, 0.12],
        [0.06, -0.12]
      ],
      96
    )
  );
  mesh(merge([wheelTeeth, wheelBody]), bronze({ roughness: 0.34 }), g);
  const wheelShaft = shaftZ(0.057, -0.32, 0.32, 0.012);
  mesh(wheelShaft, steel({ roughness: 0.25 }), g);
  g.rotation.set(0.15, 0.3, 0);
  return g;
}

// ─────────────────────────── 래크와 피니언 ───────────────────────────

export function buildRackPinion(): THREE.Group {
  const g = new THREE.Group();
  const N = 14;
  const rp = 0.24;
  const m = (2 * rp) / N;
  const pitch = Math.PI * m;
  const face = 0.16;
  // 피니언: 아래(-π/2)에 이 중심
  const pin = gearRing(N, rp, face, [circlePts(0.05, 32).reverse()], -Math.PI / 2);
  const hub = toZ(lathe(tubeProfile(0.05, 0.11, -0.16, 0.16, 0.01), 48));
  const pinGeo = merge([pin, hub]);
  pinGeo.translate(0, rp, 0);
  mesh(pinGeo, brass({ roughness: 0.28 }), g);
  const shaft = shaftZ(0.047, -0.34, 0.34, 0.01);
  shaft.translate(0, rp, 0);
  mesh(shaft, steel({ roughness: 0.24 }), g);

  // 래크: 피치선 y=0, 직선 측면(압력각 20°), x=0에 이골(피니언 이가 들어감)
  const nT = 13;
  const Lr = nT * pitch;
  const tan20 = Math.tan((20 * Math.PI) / 180);
  const ha = m;
  const hf = 1.25 * m;
  const yb = -hf - 0.12;
  const halfTip = pitch / 4 - ha * tan20;
  const halfRoot = pitch / 4 + hf * tan20;
  const pts: V2[] = [
    [-Lr / 2, yb],
    [Lr / 2, yb],
    [Lr / 2, -hf]
  ];
  // 오른쪽 → 왼쪽으로 이를 그린다(반시계)
  for (let k = Math.floor(nT / 2); k >= -Math.ceil(nT / 2); k--) {
    const cx = (k + 0.5) * pitch;
    if (cx + halfRoot > Lr / 2 || cx - halfRoot < -Lr / 2) continue;
    pts.push([cx + halfRoot, -hf], [cx + halfTip, ha], [cx - halfTip, ha], [cx - halfRoot, -hf]);
  }
  pts.push([-Lr / 2, -hf]);
  const rack = extrude(shapeFrom(pts), face, 0.006, 4);
  // 래크 고정 구멍(카운터보어 느낌의 둥근 홈)
  mesh(rack, steel({ color: 0xb5bec7, roughness: 0.3 }), g);
  g.rotation.set(0.25, -0.4, 0);
  return g;
}

// ─────────────────────────── 벨트와 풀리 ───────────────────────────

function vPulley(R: number, hubR: number, holes: number, mat: THREE.Material, g: THREE.Group, x: number): void {
  const w = 0.085;
  const gd = 0.075; // 홈 깊이
  const gt = 0.047; // 홈 위쪽 반폭
  const gb = 0.02; // 홈 바닥 반폭
  const rimIn = R - 0.13;
  const rim = lathe(
    [
      [rimIn, -w],
      [R - 0.006, -w],
      [R, -w + 0.006],
      [R, -gt - 0.004],
      [R - 0.004, -gt],
      [R - gd, -gb],
      [R - gd, gb],
      [R - 0.004, gt],
      [R, gt + 0.004],
      [R, w - 0.006],
      [R - 0.006, w],
      [rimIn, w],
      [rimIn, -w]
    ],
    96,
    0,
    TAU,
    30
  );
  const parts = [toZ(rim)];
  if (holes > 0) {
    const web = new THREE.Shape();
    web.absarc(0, 0, rimIn + 0.005, 0, TAU, false);
    web.holes.push(circlePath(0, 0, hubR - 0.005));
    const rH = (rimIn + hubR) / 2;
    for (let i = 0; i < holes; i++) {
      const a0 = (i / holes) * TAU + 0.18;
      web.holes.push(kidneyPath(rH, (rimIn - hubR) * 0.28, a0, a0 + TAU / holes - 0.5));
    }
    parts.push(extrude(web, 0.05, 0.008, 48));
  } else {
    parts.push(toZ(lathe([[hubR - 0.005, -0.025], [rimIn + 0.005, -0.025], [rimIn + 0.005, 0.025], [hubR - 0.005, 0.025]], 72)));
  }
  parts.push(toZ(lathe(tubeProfile(0.04, hubR, -0.11, 0.11, 0.01), 64)));
  const geo = merge(parts);
  geo.translate(x, 0, 0);
  mesh(geo, mat, g);
}

export function buildBeltPulley(): THREE.Group {
  const g = new THREE.Group();
  const R1 = 0.42;
  const R2 = 0.25;
  const x1 = -0.5;
  const x2 = 0.62;
  vPulley(R1, 0.1, 5, castIron({ color: 0x6d7782, roughness: 0.45 }), g, x1);
  vPulley(R2, 0.085, 0, aluminum({ roughness: 0.35 }), g, x2);
  // 축
  const sMat = steel({ roughness: 0.25 });
  for (const x of [x1, x2]) {
    const s = shaftZ(0.037, -0.2, 0.2, 0.01);
    s.translate(x, 0, 0);
    mesh(s, sMat, g);
  }
  // 벨트: V벨트(사다리꼴 띠 단면)를 접선 경로 따라 스윕
  const rb1 = R1 - 0.052;
  const rb2 = R2 - 0.052;
  const path = new ChainPath2D(x1, 0, rb1, x2, 0, rb2);
  const pts: V2[] = [];
  const n = 360;
  for (let i = 0; i < n; i++) {
    const p = path.pointAt((i / n) * path.length);
    pts.push([p.x, p.y]);
  }
  // 경로는 시계 방향 → 왼쪽 법선이 바깥. 단면: n(바깥+), b(축)
  const prof: V2[] = [
    [-0.022, -0.026],
    [0.052, -0.05],
    [0.064, -0.046],
    [0.066, -0.04],
    [0.066, 0.04],
    [0.064, 0.046],
    [0.052, 0.05],
    [-0.022, 0.026]
  ];
  const belt = sweepPlanar(pts, prof.map(([a, b]) => [a, b] as V2), true, false);
  mesh(belt, rubber({ color: 0x2b2e33, roughness: 0.8 }), g);
  g.rotation.set(0.35, -0.3, 0);
  return g;
}

// ─────────────────────────── 스프로킷 ───────────────────────────

export function buildSprocket(): THREE.Group {
  const g = new THREE.Group();
  const N = 18;
  const pitch = 0.127;
  const rollerR = 0.04;
  const outline = sprocketOutline(N, pitch, rollerR);
  const holes: V2[][] = [circlePts(0.1, 48).reverse()];
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * TAU + 0.2;
    holes.push(kidneyPath(0.205, 0.045, a0, a0 + TAU / 5 - 0.62).getPoints(10).slice(0, -1).map((v) => [v.x, v.y] as V2));
  }
  // 롤러가 잘 올라타도록 이 끝 옆면을 크게 모따기(외곽만 축소, 구멍은 그대로)
  const t = 0.075;
  const body = loft(outline, holes, [
    { z: -t / 2, s: 0.93, hs: 1 },
    { z: -t / 2 + 0.022, s: 1, hs: 1 },
    { z: t / 2 - 0.022, s: 1, hs: 1 },
    { z: t / 2, s: 0.93, hs: 1 }
  ]);
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, 0.115, 0, TAU, false);
  hubShape.holes.push(keyedBore(0.05, 0.028, 0.016));
  const hub = extrude(hubShape, 0.17, 0.012, 48);
  mesh(merge([body, hub]), darkSteel({ color: 0x7d8792, roughness: 0.32 }), g);
  g.rotation.set(-0.2, 0.4, 0);
  return g;
}

// ─────────────────────────── 체인 ───────────────────────────

export function buildChain(): THREE.Group {
  const path = new ChainPath2D(-0.42, 0, 0.21, 0.42, 0, 0.21);
  const g = buildChainAlongPath(path, 0.125, 0);
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.rotation.set(-0.55, 0.25, 0.1);
  return wrap;
}

// ─────────────────────────── 캠 ───────────────────────────

export function buildCam(): THREE.Group {
  const g = new THREE.Group();
  // 달걀형(접선) 캠: 기초원 + 노즈 원을 공통 접선으로 이은 볼록 윤곽
  const lobeDir = Math.PI / 2 - 0.45;
  const r0 = 0.2;
  const rn = 0.085;
  const dN = 0.25;
  const beta = Math.asin((r0 - rn) / dN);
  const nx = Math.cos(lobeDir) * dN;
  const ny = Math.sin(lobeDir) * dN;
  const camPts: V2[] = [];
  const t0 = lobeDir - (Math.PI / 2 - beta);
  const t1 = lobeDir + (Math.PI / 2 - beta);
  for (let i = 0; i <= 40; i++) {
    const a = t0 + ((t1 - t0) * i) / 40;
    camPts.push([nx + Math.cos(a) * rn, ny + Math.sin(a) * rn]);
  }
  for (let i = 0; i <= 80; i++) {
    const a = t1 + ((t0 + TAU - t1) * i) / 80;
    camPts.push([Math.cos(a) * r0, Math.sin(a) * r0]);
  }
  camPts.pop();
  const camShape = shapeFrom(camPts);
  camShape.holes.push(keyedBore(0.05, 0.026, 0.014));
  const camGeo = extrude(camShape, 0.1, 0.01, 8);
  const boss = toZ(lathe(tubeProfile(0.05, 0.1, -0.09, -0.05, 0.008), 48));
  mesh(merge([camGeo, boss]), steel({ roughness: 0.22 }), g);
  // 캠축 (뒤판까지)
  const shaft = shaftZ(0.047, -0.36, 0.14, 0.01);
  mesh(shaft, steel({ color: 0xd5dbe1, roughness: 0.2 }), g);

  // 롤러 종동절: 롤러가 캠 윤곽에 닿는 높이 계산
  const rr = 0.075;
  let yRoll = 0;
  for (const [x, y] of camPts) {
    if (Math.abs(x) < rr) yRoll = Math.max(yRoll, y + Math.sqrt(rr * rr - x * x));
  }
  const roller = lathe(
    [
      [0.016, -0.03],
      [rr - 0.008, -0.03],
      [rr, -0.022],
      [rr, 0.022],
      [rr - 0.008, 0.03],
      [0.016, 0.03],
      [0.016, -0.03]
    ],
    48
  );
  const rollGeo = toZ(roller);
  rollGeo.translate(0, yRoll, 0);
  mesh(rollGeo, brass({ roughness: 0.25 }), g);
  // 클레비스(U자 포크) + 롤러 핀 + 종동 막대
  const forkGeos: THREE.BufferGeometry[] = [];
  for (const sgn of [1, -1]) {
    const cheek = extrude(stadiumShape(0, yRoll, 0, yRoll + 0.11, 0.032), 0.014, 0.003, 16);
    cheek.translate(0, 0, sgn * 0.04);
    forkGeos.push(cheek);
  }
  const bridgeBlock = extrude(roundedRect(-0.035, yRoll + 0.11, 0.035, yRoll + 0.16, 0.012), 0.094, 0.006, 6);
  forkGeos.push(bridgeBlock);
  const rollerPin = shaftZ(0.016, -0.054, 0.054, 0.004, 20);
  rollerPin.translate(0, yRoll, 0);
  forkGeos.push(rollerPin);
  const rodTop = 0.86;
  const rod = lathe([[0, yRoll + 0.15], [0.028, yRoll + 0.15], [0.028, rodTop - 0.06], [0.05, rodTop - 0.06], [0.055, rodTop - 0.055], [0.055, rodTop - 0.01], [0.045, rodTop], [0, rodTop]], 32);
  forkGeos.push(rod);
  mesh(merge(forkGeos), steel({ roughness: 0.28 }), g);

  // 뒤판(프레임) + 가이드 블록 + 캠축 베어링 보스
  const plateZ = -0.28;
  const back = extrude(roundedRect(-0.3, -0.34, 0.3, 0.76, 0.06), 0.05, 0.01, 8);
  back.translate(0, 0, plateZ);
  const bearingBoss = toZ(lathe(tubeProfile(0.05, 0.1, -0.255, -0.17, 0.01), 48));
  const guideY = 0.62;
  // 가이드: 뒤판에서 앞으로 튀어나온 블록(위에서 본 단면을 Y로 압출)
  const gShape = roundedRect(-0.1, -0.075, 0.1, 0.25, 0.02);
  gShape.holes.push(circlePath(0, 0, 0.03));
  const guideGeo = extrude(gShape, 0.11, 0.01, 24);
  guideGeo.rotateX(-Math.PI / 2); // Shape Y → 세계 -Z
  guideGeo.translate(0, guideY, 0);
  const frameGeo = merge([back, bearingBoss, guideGeo]);
  mesh(frameGeo, paint(0x4d6a8a, { roughness: 0.5 }), g);
  g.rotation.set(-0.3, 0.3, 0);
  return g;
}

// ─────────────────────────── 링크 ───────────────────────────

export function buildLink(): THREE.Group {
  const g = new THREE.Group();
  const A: V2 = [-0.5, 0];
  const D: V2 = [0.5, 0];
  const crank = 0.26;
  const coupler = 0.82;
  const rocker = 0.52;
  const th = (62 * Math.PI) / 180;
  const B: V2 = [A[0] + crank * Math.cos(th), A[1] + crank * Math.sin(th)];
  // C: 원(B, coupler) ∩ 원(D, rocker), 위쪽 해
  const dx = D[0] - B[0];
  const dy = D[1] - B[1];
  const d = Math.hypot(dx, dy);
  const aa = (coupler * coupler - rocker * rocker + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, coupler * coupler - aa * aa));
  const mx = B[0] + (aa * dx) / d;
  const my = B[1] + (aa * dy) / d;
  const C: V2 = [mx - (hh * dy) / d, my + (hh * dx) / d];
  const C2: V2 = [mx + (hh * dy) / d, my - (hh * dx) / d];
  const Cu = C[1] > C2[1] ? C : C2;

  const bar = (p: V2, q: V2, w: number, t: number, z: number, holeR: number): THREE.BufferGeometry => {
    const s = stadiumShape(p[0], p[1], q[0], q[1], w);
    s.holes.push(circlePath(p[0], p[1], holeR), circlePath(q[0], q[1], holeR));
    const geo = extrude(s, t, 0.008, 24, 2);
    geo.translate(0, 0, z);
    return geo;
  };
  const hr = 0.026;
  // 고정 링크(바닥 프레임): 두 받침대가 달린 주철 막대
  const ground = bar(A, D, 0.075, 0.05, -0.075, hr);
  const feet: THREE.BufferGeometry[] = [ground];
  for (const p of [A, D]) {
    const foot = extrude(roundedRect(p[0] - 0.09, -0.26, p[0] + 0.09, -0.2, 0.01), 0.12, 0.008, 4);
    foot.translate(0, 0, -0.075);
    const post = extrude(roundedRect(p[0] - 0.04, -0.2, p[0] + 0.04, -0.03, 0.006), 0.05, 0.006, 4);
    post.translate(0, 0, -0.075);
    feet.push(foot, post);
  }
  mesh(merge(feet), castIron({ color: 0x4a5058, roughness: 0.6 }), g);
  mesh(bar(A, B, 0.055, 0.04, -0.02, hr), paint(0xd8362f, { roughness: 0.38 }), g);
  mesh(bar(B, Cu, 0.05, 0.04, 0.035, hr), aluminum({ roughness: 0.32 }), g);
  mesh(bar(D, Cu, 0.055, 0.04, -0.02, hr), paint(0x2468c9, { roughness: 0.38 }), g);
  // 핀 조인트(머리 + 와셔)
  const pins: THREE.BufferGeometry[] = [];
  const pin = (p: V2, z0: number, z1: number): void => {
    const geo = toZ(
      lathe(
        [
          [0, z0 - 0.012],
          [0.034, z0 - 0.012],
          [0.038, z0 - 0.006],
          [0.038, z0],
          [hr - 0.003, z0],
          [hr - 0.003, z1],
          [0.04, z1],
          [0.045, z1 + 0.005],
          [0.045, z1 + 0.014],
          [0.038, z1 + 0.02],
          [0, z1 + 0.02]
        ],
        28
      )
    );
    geo.translate(p[0], p[1], 0);
    pins.push(geo);
  };
  pin(A, -0.1, 0.0);
  pin(D, -0.1, 0.0);
  pin(B, -0.04, 0.055);
  pin(Cu, -0.04, 0.055);
  mesh(merge(pins), brass({ roughness: 0.3 }), g);
  g.rotation.set(-0.2, -0.35, 0);
  return g;
}
