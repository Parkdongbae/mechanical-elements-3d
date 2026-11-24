// 054 전용 키트 — 맹글 살 바퀴(테 두 겹 + 방사 살, 빈 칸 지정 가능)와 옆면 피니언(축 = 로컬 Y)
// 모델은 '../kit/k054' 에서 직접 import 한다(kit/index.ts 에는 넣지 않는다 — 설계표 054 '키트 추가').
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, merge, mesh, rodProfile, shapeFrom, tubeProfile, TAU } from '../../models/parts/geom';
import { spurGear } from './gear';
import { setMM } from './mm';
import type { V2 } from './belt';

export interface StaveWheelOpts {
  /** 살 칸 수(기본 36) */
  slots?: number;
  /** 빈 칸(틈) 인덱스 목록 — 칸 i 의 중심각 = phase + i·2π/slots */
  empty?: number[];
  /** 칸 0 의 중심각(rad, 기본 0) */
  phase?: number;
  /** 안쪽 테 [안, 바깥] 반지름(기본 [0.50, 0.55]) */
  rimIn?: [number, number];
  /** 바깥 테 [안, 바깥] 반지름(기본 [0.80, 0.85]) */
  rimOut?: [number, number];
  /** 스포크 수(기본 4, 십자) */
  spokes?: number;
  /** 첫 스포크 중심각(rad, 기본 0) */
  spokePhase?: number;
  /** 허브 반지름(기본 0.16) */
  hub?: number;
  /** 허브 축구멍 반지름(기본 0.102 — 축 r 0.095 위에서 돈다) */
  bore?: number;
}

/** 살 바퀴: 회전축 = 로컬 Z, 원점 = 바퀴 중심. 테 두 겹 사이에 방사 살 N 칸(빈 칸 = 틈) */
export function staveWheel(o: StaveWheelOpts = {}): THREE.Group {
  const n = o.slots ?? 36;
  const phase = o.phase ?? 0;
  const empty = new Set(o.empty ?? []);
  const [ri0, ri1] = o.rimIn ?? [0.5, 0.55];
  const [ro0, ro1] = o.rimOut ?? [0.8, 0.85];
  const spokes = o.spokes ?? 4;
  const spokePhase = o.spokePhase ?? 0;
  const hubR = o.hub ?? 0.16;
  const bore = o.bore ?? 0.102;
  const rm = (ri1 + ro0) / 2; // 살 띠 가운데 반지름
  const len = ro0 - ri1; // 살 길이(반지름 방향)
  const pitch = (TAU * rm) / n; // 살 간격(호) — 피니언 모듈과 같은 피치
  const tRim = 0.09; // 테 두께(z)
  const body = brass();
  const g = new THREE.Group();
  // 테 두 겹(동심 고리)
  const rims: ReadonlyArray<readonly [number, number]> = [
    [ri0, ri1],
    [ro0, ro1]
  ];
  for (const [a, b] of rims) {
    const ringGeo = lathe(tubeProfile(a, b, -tRim / 2, tRim / 2, 0.008), 72);
    ringGeo.rotateX(Math.PI / 2);
    g.add(mesh(ringGeo, body));
  }
  // 방사 살: 웹 + 앞·뒷면 랙치 이 — 단면(u=접선, v=z)을 반지름 방향으로 압출
  const hw = pitch * 0.28; // 웹 접선 반폭
  const hr = pitch * 0.22; // 이 뿌리 반폭
  const ht = pitch * 0.14; // 이끝 반폭
  const zw = 0.026; // 웹 두께 절반
  const zt = 0.07; // 이끝 높이
  const prof: V2[] = [
    [-hw, -zw],
    [-hr, -zw],
    [-ht, -zt],
    [ht, -zt],
    [hr, -zw],
    [hw, -zw],
    [hw, zw],
    [hr, zw],
    [ht, zt],
    [-ht, zt],
    [-hr, zw],
    [-hw, zw]
  ];
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    if (empty.has(i)) continue;
    const a = phase + (i / n) * TAU;
    const geo = extrude(shapeFrom(prof), len, 0.002, 4);
    geo.rotateX(-Math.PI / 2); // (u, v, 깊이) → 깊이가 y 로
    geo.rotateZ(-Math.PI / 2); // → (X=반지름, Y=접선, Z=z)
    geo.rotateZ(a);
    geo.translate(Math.cos(a) * rm, Math.sin(a) * rm, 0);
    geos.push(geo);
  }
  g.add(mesh(merge(geos), body));
  // 스포크(십자): 허브 → 안쪽 테
  if (spokes > 0) {
    const spGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < spokes; i++) {
      const b = new THREE.BoxGeometry(ri0 - hubR, 0.09, tRim);
      b.translate(hubR + (ri0 - hubR) / 2, 0, 0);
      b.rotateZ(spokePhase + (i / spokes) * TAU);
      spGeos.push(b);
    }
    g.add(mesh(merge(spGeos), body));
    // 표시점: 첫 스포크 앞면 — 회전이 보이게
    const mark = mesh(new THREE.BoxGeometry(0.09, 0.03, 0.012), paint(0xf2b619));
    const a0 = spokePhase;
    mark.position.set(Math.cos(a0) * ((hubR + ri0) / 2), Math.sin(a0) * ((hubR + ri0) / 2), tRim / 2 + 0.007);
    mark.rotation.z = a0;
    g.add(mark);
  }
  // 허브(축구멍 뚫린)
  const hubGeo = lathe(tubeProfile(bore, hubR, -0.06, 0.06, 0.008), 36);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  setMM(g, { kind: 'part', fn: 'staveWheel', slots: n, empty: Array.from(empty), rIn: ri0, rOut: ro1, rm, bore, axis: 'z' });
  return g;
}

export interface FacePinionOpts {
  /** 축 막대 길이(디스크 면에서 −Y 로, 기본 0.6) */
  shaftLen?: number;
  /** 축 반지름(기본 0.03) */
  shaftR?: number;
  /** true 면 bronze(구동 쪽) */
  driver?: boolean;
}

/** 옆면(페이스) 피니언: 축 = 로컬 Y, 디스크 y ∈ [−len/2, len/2], 축 막대는 −Y 로 뻗는다 */
export function facePinion(teeth: number, module: number, length: number, o: FacePinionOpts = {}): THREE.Group {
  const g = new THREE.Group();
  const disc = spurGear(teeth, module, { width: length, spokes: 0, driver: o.driver });
  disc.rotation.x = Math.PI / 2; // 디스크 축(로컬 Z) → 로컬 Y
  g.add(disc);
  const shaftLen = o.shaftLen ?? 0.6;
  const shaftR = o.shaftR ?? 0.03;
  const geo = lathe(rodProfile(shaftR, 0, shaftLen, shaftR * 0.3, shaftR * 0.3), 24);
  geo.rotateZ(Math.PI); // +Y → −Y
  const shaft = mesh(geo, steel());
  shaft.position.y = -length / 2;
  g.add(shaft);
  setMM(g, { kind: 'gear', fn: 'facePinion', teeth, module, rp: (teeth * module) / 2, length, shaftLen, axis: 'y' });
  return g;
}
