// 스퍼 기어 + 맞물림 위상 — involuteOutline 재사용 (작업 지시서 16 · 3-3)
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { circlePts, lathe, loft, merge, mesh, tubeProfile, TAU } from '../../models/parts/geom';
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
