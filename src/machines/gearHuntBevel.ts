// '기어의 종류' 미션용 베벨 기어(마이터 1:1 한 쌍) — OpenSCAD STL(톱니가 평판에 박힌 모양) 대신
// 피치 원뿔 꼭짓점으로 이가 수렴하는 실제 형태를 절차 생성한다.
// 좌표는 STL 로드 직후와 같은 three-mm 공간(scad (x,y,z) → three (x, z, -y)), 조립 위치 그대로.

import * as THREE from 'three';
import { involuteOutline } from '../models/parts/gears';
import { circlePts, lathe, loft, merge, type LoftLayer, type V2 } from '../models/parts/geom';

const TEETH = 16;
const RP = 12; // 피치원 반지름(mm) — 원본 STL 외경(반지름 12)·축 간 거리와 일치
const APEX = new THREE.Vector3(0, 54, 0); // 두 축(세로축, scad Y축)의 교점 = 공통 피치 원뿔 꼭짓점
const BORE = 5; // 축 지름 10mm
const HUB_R = 7.6;
const HUB_LEN = 5;

/** 로컬 +Z가 꼭짓점 방향, 큰 끝이 z=0 인 45° 베벨 기어. phase = 이 중심이 놓이는 각도 */
function miterGeo(phase: number): THREE.BufferGeometry {
  const delta = Math.PI / 4;
  const m = (2 * RP) / TEETH;
  const ra = RP + m * Math.cos(delta);
  const rf = RP - 1.25 * m * Math.cos(delta);
  const Lp = RP / Math.tan(delta);
  const zf = 5.6 * Math.cos(delta);
  const sAt = (z: number): number => (Lp - z) / Lp;
  const c = (ra - rf) * 0.14;
  const holeR = rf * sAt(zf) * 0.8;
  const layers: LoftLayer[] = [
    { z: -0.12, s: sAt(0) * (1 - c / ra), hs: 1 },
    { z: c * 0.7, s: sAt(c * 0.7), hs: 1 },
    { z: zf * 0.5, s: sAt(zf * 0.5), hs: 1 },
    { z: zf, s: sAt(zf), hs: 1 }
  ];
  const teeth = loft(involuteOutline(TEETH, ra, rf, phase), [circlePts(holeR, 64).reverse()], layers);
  const rb = rf * 0.99;
  const profile: V2[] = [
    [BORE, -HUB_LEN],
    [HUB_R - 0.4, -HUB_LEN],
    [HUB_R, -HUB_LEN + 0.4],
    [HUB_R, -2.4],
    [rb * 0.88, -1.0],
    [rb, 0],
    [holeR + 0.3, zf - 0.03],
    [BORE + 0.5, zf + 0.35],
    [BORE, zf + 0.35],
    [BORE, -HUB_LEN]
  ];
  const body = lathe(profile, 72);
  body.rotateX(Math.PI / 2); // 회전체 축 Y → 로컬 Z
  return merge([teeth, body]);
}

/** bevel_gear1(세로축, 꼭짓점 아래) / bevel_gear2(수평축) 의 조립 좌표 지오메트리. 해당 없으면 null */
export function buildGearHuntBevel(id: string): THREE.BufferGeometry | null {
  const step = (Math.PI * 2) / TEETH;
  if (id === 'bevel_gear1') {
    // 맞물림 쪽(-Z, 로컬 +y)에 이골이 오도록 반 피치 어긋나게
    const g = miterGeo(Math.PI / 2 + step / 2);
    g.rotateX(-Math.PI / 2); // 로컬 +Z → 세계 +Y(꼭짓점 방향)
    g.translate(APEX.x, APEX.y - RP, APEX.z);
    return g;
  }
  if (id === 'bevel_gear2') {
    // 맞물림 쪽(-Y)에 이 중심
    const g = miterGeo(-Math.PI / 2);
    g.translate(APEX.x, APEX.y, APEX.z - RP);
    return g;
  }
  return null;
}
