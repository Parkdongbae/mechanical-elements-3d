// 스퍼 기어 + 맞물림 위상 — involuteOutline 재사용 (작업 지시서 16 · 3-3)
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, lathe, loft, merge, mesh, rodProfile, tubeProfile, TAU } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import type { V2 } from './belt';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}


export interface SpurGearOpts {
  width?: number;
  spokes?: number;
  driver?: boolean;
}

/** 스퍼 기어: 피치 반지름 = teeth*module/2, 인벌류트 치형. 회전축 = 로컬 Z, 원점 중심 */
export function spurGear(teeth: number, module: number, opts: SpurGearOpts = {}): THREE.Group {
  const w = opts.width ?? 0.12;
  const spokes = opts.spokes ?? 4;
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const bore = Math.max(0.024, rp * 0.14);
  const c = Math.min(module * 0.35, w * 0.16);
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const outline = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const g = new THREE.Group();
  if (spokes > 0) {
    // 치형 림(안벽 = rRim) + 스포크 + 허브
    const rRim = rf * 0.72;
    const hole = circlePts(rRim, 64);
    const rimLayers = [
      { z: -w / 2, s: (ra - c) / ra, hs: (rRim + c) / rRim },
      { z: -w / 2 + c, s: 1, hs: 1 },
      { z: w / 2 - c, s: 1, hs: 1 },
      { z: w / 2, s: (ra - c) / ra, hs: (rRim + c) / rRim }
    ];
    g.add(mesh(loft(outline, [hole], rimLayers), body));
    const hubOut = bore + rp * 0.14;
    const hubGeo = lathe(tubeProfile(bore, hubOut, -(w / 2 + 0.018), w / 2 + 0.018, 0.01), 32);
    hubGeo.rotateX(Math.PI / 2);
    g.add(mesh(hubGeo, darkSteel()));
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < spokes; i++) {
      const b = new THREE.BoxGeometry(rRim - hubOut, Math.max(0.02, rp * 0.13), w * 0.4);
      b.translate(hubOut + (rRim - hubOut) / 2, 0, 0);
      b.rotateZ((i / spokes) * TAU);
      geos.push(b);
    }
    const spokesMesh = mesh(merge(geos), body);
    g.add(spokesMesh);
    // 표시점: 첫 스포크 위 밝은 점 — 맞물림 위상·회전이 보이게
    const markGeo = new THREE.BoxGeometry(Math.max(0.03, rp * 0.12), 0.016, 0.01);
    g.add(meshAt(markGeo, paint(0xf2b619), (hubOut + rRim) / 2, 0, w * 0.2 + 0.004));
  } else {
    // 민판: 치형 전체 + 축 구멍만
    const hole = circlePts(bore, 32);
    const solidLayers = [
      { z: -w / 2, s: (ra - c) / ra, hs: (bore + c) / bore },
      { z: -w / 2 + c, s: 1, hs: 1 },
      { z: w / 2 - c, s: 1, hs: 1 },
      { z: w / 2, s: (ra - c) / ra, hs: (bore + c) / bore }
    ];
    g.add(mesh(loft(outline, [hole], solidLayers), body));
    const markGeo = new THREE.BoxGeometry(Math.max(0.03, rf * 0.16), 0.016, 0.01);
    g.add(meshAt(markGeo, paint(0xf2b619), rf * 0.5, 0, w / 2 + 0.004));
  }
  return g;
}

/**
 * 맞물림 위상: spurGear 기본 위상(이 중심 = 위상 + i·피치각) 기준으로,
 * 기어1(중심 c1, 잇수 z1, 각 th1)의 이와 기어2(중심 c2, 잇수 z2)의 이골이
 * 중심선에서 엇갈려 물리는 각 θ2 = α + π − s2 − (s2/s1)(θ1 + s1/2 − α). (s1·s2 = 피치각)
 * 회전은 반대 방향(dθ2/dθ1 = −z1/z2).
 */
export function meshAngle(c1: V2, z1: number, th1: number, c2: V2, z2: number): number {
  const a = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
  const s1 = TAU / z1;
  const s2 = TAU / z2;
  return a + Math.PI - s2 - (s2 / s1) * (th1 + s1 / 2 - a);
}

// ── 베벨 기어 (키트 추가 — 설계표 007) ──

export interface BevelGearOpts {
  width?: number;
  spokes?: number;
  driver?: boolean;
  /** 축 구멍 반지름(기본 피치반지름×0.14) — 관축에 직접 끼울 때 지정 */
  bore?: number;
}

/** 45° 마이터 베벨: 회전축 = 로컬 Z, 이가 +Z, 원뿔 꼭짓점 = 로컬 (0,0,R), 피치원 = 로컬 z=0 */
export function bevelGear(teeth: number, module: number, opts: BevelGearOpts = {}): THREE.Group {
  const w = opts.width ?? 0.12; // 이 폭(원뿔 모선 방향)
  const spokes = opts.spokes ?? 0;
  const R = (teeth * module) / 2; // 피치 반지름
  const rt = R + module * 0.9; // 이 끝
  const rf = R - module * 0.9; // 이 뿌리
  const bore = Math.max(0.024, opts.bore ?? R * 0.14);
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const zT = w / Math.SQRT2; // 이가 피치면 위까지 오른 높이(45°)
  const blankT = w * 0.7; // 뒷판 두께
  const g = new THREE.Group();
  // 사다리꼴 이니 개략(반시계, 이 0의 중심 = 로컬 +X) — 맞물림 위상의 기준
  const p = TAU / teeth;
  const wt = 0.15 * p; // 끝 반폭
  const wr = 0.28 * p; // 뿌리 반폭
  const outline: V2[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * p;
    outline.push(
      [Math.cos(a - wr) * rf, Math.sin(a - wr) * rf],
      [Math.cos(a - wt) * rt, Math.sin(a - wt) * rt],
      [Math.cos(a + wt) * rt, Math.sin(a + wt) * rt],
      [Math.cos(a + wr) * rf, Math.sin(a + wr) * rf]
    );
  }
  // 이: 원뿔면 위의 사다리꼴 돌기 — 꼭짓점 쪽으로 갈수록 작아진다. 구멍도 같이 가늘어져야 뚜껑이 성립
  const k = 1 - zT / R;
  const ring = loft(
    outline,
    [circlePts(rf * 0.95, 64)],
    [
      { z: 0, s: 1, hs: 1 },
      { z: zT, s: k, hs: k }
    ]
  );
  g.add(mesh(ring, body));
  // 뒷판 + 허브 — 링 쪽으로 0.002 파묻혀 틈 없이
  const c = Math.min(0.01, blankT * 0.12);
  const hubOut = bore + R * 0.14;
  const hubGeo = lathe(tubeProfile(bore, hubOut, -blankT - 0.02, 0.012, 0.008), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  if (spokes > 0) {
    const rimIn = rf * 0.62;
    const rimGeo = lathe(tubeProfile(rimIn, rf, -blankT, 0.002, c), 48);
    rimGeo.rotateX(Math.PI / 2);
    g.add(mesh(rimGeo, body));
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < spokes; i++) {
      const b = new THREE.BoxGeometry(rimIn - bore, Math.max(0.02, R * 0.12), blankT * 0.45);
      b.translate(bore + (rimIn - bore) / 2, 0, -blankT * 0.4);
      b.rotateZ((i / spokes) * TAU);
      geos.push(b);
    }
    g.add(mesh(merge(geos), body));
  } else {
    const blankGeo = lathe(tubeProfile(bore, rf, -blankT, 0.002, c), 48);
    blankGeo.rotateX(Math.PI / 2);
    g.add(mesh(blankGeo, body));
  }
  // 표시점: 뒷판 허브 옆 밝은 점 — 회전이 보이게
  const markGeo = new THREE.BoxGeometry(Math.max(0.03, R * 0.14), 0.016, 0.01);
  g.add(meshAt(markGeo, paint(0xf2b619), bore + R * 0.1, 0, -blankT - 0.022));
  return g;
}

// ── 크라운 기어 (키트 추가 — 설계표 026) ──

export interface CrownGearOpts {
  /** 이 반지름 방향 폭(기본 0.12). 이는 r ∈ [rm − width/2, rm + width/2] 에 선다 */
  width?: number;
  /** true 면 bronze, 아니면 brass */
  driver?: boolean;
  /** 축 구멍 반지름(기본 max(0.024, rm × 0.14)) */
  bore?: number;
}

/**
 * 크라운(페이스) 기어: 로컬 Z = 회전축, 이는 +Z 면에 선다. 이 뿌리 면 z=0, 피치 평면 z=1.25·module,
 * 이끝 면 z=1.75·module, 이 0 의 가운데 = 로컬 +X.
 * 이는 각도로 고정된 쐐기라 맞물림 반지름을 벗어나면 평기어와 피치가 어긋난다 — 평기어 폭(0.08) 양 끝에서도
 * 평기어 이뿌리에 박히지 않도록 이를 얇고(뿌리 0.56 · 이끝 0.20 피치) 낮게(이끝 높이 0.5·module) 잡았다(수치 검산).
 */
export function crownGear(teeth: number, module: number, opts: CrownGearOpts = {}): THREE.Group {
  const width = opts.width ?? 0.12;
  const rm = (teeth * module) / 2;
  const bore = opts.bore ?? Math.max(0.024, rm * 0.14);
  const r1 = rm - width / 2;
  const r2 = rm + width / 2;
  const s = TAU / teeth;
  const hT = 1.75 * module;
  const rOut = r2 + 0.015;
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const hr = 0.28 * s; // 뿌리 반폭 각
  const ht = 0.1 * s; // 이끝 반폭 각
  const pos: number[] = [];
  const quads: [number, number, number, number][] = [
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
    [4, 5, 6, 7]
  ];
  const pt = (r: number, a: number, z: number): number[] => [r * Math.cos(a), r * Math.sin(a), z];
  for (let j = 0; j < teeth; j++) {
    const c = j * s;
    const v = [
      pt(r1, c - hr, 0), pt(r2, c - hr, 0), pt(r2, c + hr, 0), pt(r1, c + hr, 0),
      pt(r1, c - ht, hT), pt(r2, c - ht, hT), pt(r2, c + ht, hT), pt(r1, c + ht, hT)
    ];
    for (const [a, b, d, e] of quads) {
      for (const k of [a, b, d, a, d, e]) pos.push(...v[k]!);
    }
  }
  const teethGeo = new THREE.BufferGeometry();
  teethGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  teethGeo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(mesh(teethGeo, body));
  // 판 + 허브
  const plate = lathe(tubeProfile(bore, rOut, -0.06, 0.002, 0.008), 64);
  plate.rotateX(Math.PI / 2);
  g.add(mesh(plate, body));
  const hub = lathe(tubeProfile(bore, bore + 0.05, -0.14, -0.04, 0.008), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  // 표시: 이 0 과 같은 방향
  const markGeo = new THREE.BoxGeometry(0.04, 0.016, 0.008);
  markGeo.translate(r1 - 0.06, 0, 0.004);
  g.add(mesh(markGeo, paint(0xf2b619)));
  return g;
}

/** 평기어(피니언) 각 → 크라운 각. 맞물림 위상 포함: (Np / Nc) × thetaPinion + π/2 */
export function crownGearAngle(thetaPinion: number, pinionTeeth: number, crownTeeth: number): number {
  return (pinionTeeth / crownTeeth) * thetaPinion + Math.PI / 2;
}

// ── 연속 제네바 (키트 추가 — 설계표 027) ──

/** 홈 달린 큰 바퀴. 로컬 Z = 회전축, 몸통 z ∈ [−thickness, 0], 홈은 로컬 각 j·π/3 (j = 0..5)에서 바깥으로 열려 있다 */
export function multiGenevaWheel(C: number, opts: { thickness?: number; driver?: boolean } = {}): THREE.Group {
  const t = opts.thickness ?? 0.06;
  const a = C / 2;
  const hs = 0.045;
  const R = C * Math.cos(Math.PI / 6) - 0.02;
  const dIn = C - a - 0.03;
  const xr = Math.sqrt(R * R - hs * hs);
  const dS = Math.asin(hs / R);
  const outline: V2[] = [];
  for (let j = 0; j < 6; j++) {
    const aj = (j * Math.PI) / 3;
    const ca = Math.cos(aj);
    const sa = Math.sin(aj);
    const put = (x: number, y: number): void => {
      outline.push([ca * x - sa * y, sa * x + ca * y]);
    };
    put(xr, -hs);
    for (let k = 0; k <= 6; k++) {
      const tt = (-90 - 30 * k) * (Math.PI / 180);
      put(dIn + hs * Math.cos(tt), hs * Math.sin(tt));
    }
    put(xr, hs);
    for (let k = 0; k < 9; k++) {
      const ar = aj + dS + ((Math.PI / 3 - 2 * dS) * k) / 8;
      outline.push([R * Math.cos(ar), R * Math.sin(ar)]);
    }
  }
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = new THREE.Group();
  g.add(
    mesh(
      loft(outline, [circlePts(0.05, 40)], [
        { z: -t, s: 0.985, hs: 1.2 },
        { z: -t + 0.008, s: 1, hs: 1 },
        { z: -0.008, s: 1, hs: 1 },
        { z: 0, s: 0.985, hs: 1.2 }
      ]),
      body
    )
  );
  const hub = lathe(tubeProfile(0.05, 0.11, -t - 0.02, 0.03, 0.008), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  const markGeo = new THREE.BoxGeometry(0.07, 0.022, 0.008);
  markGeo.translate(0.24, 0, 0.004);
  g.add(mesh(markGeo, paint(0xd8362f)));
  return g;
}

/** 롤러 3개 달린 삼각 바퀴. 로컬 Z = 회전축, 판 z ∈ [0, 0.04], 롤러는 −Z 쪽으로 0.10. 롤러 각 π/2 + 2πk/3, 반지름 C/2 */
export function multiGenevaDriver(C: number, opts: { driver?: boolean } = {}): THREE.Group {
  const a = C / 2;
  const k0 = C / 0.9; // 설계 기준 C = 0.9
  const outline: V2[] = [];
  for (let i = 0; i < 96; i++) {
    const phi = (i / 96) * TAU;
    const r = (0.39 + 0.12 * Math.cos(3 * (phi - Math.PI / 2))) * k0;
    outline.push([r * Math.cos(phi), r * Math.sin(phi)]);
  }
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = new THREE.Group();
  g.add(
    mesh(
      loft(outline, [circlePts(0.05, 40)], [
        { z: 0, s: 0.985, hs: 1.2 },
        { z: 0.008, s: 1, hs: 1 },
        { z: 0.032, s: 1, hs: 1 },
        { z: 0.04, s: 0.985, hs: 1.2 }
      ]),
      body
    )
  );
  const hub = lathe(tubeProfile(0.05, 0.1, -0.01, 0.07, 0.008), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  const nutGeo = lathe(rodProfile(0.05, 0.04, 0.062, 0.006), 24);
  nutGeo.rotateX(Math.PI / 2);
  const pinGeo = lathe(rodProfile(0.035, -0.1, 0.0, 0.005, 0), 24);
  pinGeo.rotateX(Math.PI / 2);
  const dotGeo = new THREE.CircleGeometry(0.018, 20);
  for (let k = 0; k < 3; k++) {
    const ang = Math.PI / 2 + (TAU * k) / 3;
    const x = a * Math.cos(ang);
    const y = a * Math.sin(ang);
    const nut = mesh(nutGeo, steel());
    nut.position.set(x, y, 0);
    const pin = mesh(pinGeo, steel());
    pin.position.set(x, y, 0);
    const dot = mesh(dotGeo, paint(0xffffff));
    dot.position.set(x, y, 0.063);
    g.add(pin, nut, dot);
  }
  return g;
}

/** 지금 롤러가 걸려 있는 구간의 각 δ ∈ (−π/3, π/3] (O1→O2 방향 기준 롤러 각) */
export function multiGenevaPhase(theta: number): number {
  const n = Math.floor((theta + Math.PI / 3) / ((2 * Math.PI) / 3));
  return theta - (n * 2 * Math.PI) / 3;
}

/** 큰 바퀴의 회전각 Φ(θ) (구동 바퀴 각 θ → +Z 둘레 각). 홈이 롤러 위치를 정확히 지나게 하는 절대 각 */
export function multiGenevaAngle(theta: number, C: number): number {
  const a = C / 2;
  const n = Math.floor((theta + Math.PI / 3) / ((2 * Math.PI) / 3));
  const d = theta - (n * 2 * Math.PI) / 3;
  const gam = Math.atan2(a * Math.sin(d), C - a * Math.cos(d));
  return Math.PI / 6 - gam - (Math.PI / 3) * n;
}
