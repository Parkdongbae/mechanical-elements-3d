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
