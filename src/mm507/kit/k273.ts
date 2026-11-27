// 273 마름모 링크 전용 키트 — 미끄럼 막대(눈·멈춤 고리)·안내 부시(받침)·납작 고리 막대 + 마름모 상태식
// 설계표 docs/mm507-sheets/273.md 의 치수·구동식을 그대로 옮겼다.
import * as THREE from 'three';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

const TAU = Math.PI * 2;

/** 273번 상수 — 중심 O, 마름모 한 변 LB, 반폭 a(t) = A_MID − A_AMP·cos(2πt/PERIOD), 안내 부시 자리 */
export const K273 = {
  O: [0, 1.75] as V2,
  LB: 0.70,
  A_MID: 0.46,
  A_AMP: 0.14,
  PERIOD: 6,
  GUIDE_X: 1.04,
  GUIDE_YC: 2.55,
  GUIDE_YD: 0.95
};

export interface State273 {
  /** 반폭(가로 핀 거리의 절반) */
  a: number;
  /** 반높이(세로 핀 거리의 절반) */
  c: number;
}

/** 273번 상태식(t = 초) — a = 0.46 − 0.14·cos(2πt/6), c = √(LB² − a²), 한 주기 6 초 */
export function state273(t: number): State273 {
  const a = K273.A_MID - K273.A_AMP * Math.cos((TAU * t) / K273.PERIOD);
  return { a, c: Math.sqrt(K273.LB * K273.LB - a * a) };
}

/** 미끄럼 막대: 둥근 막대(+로컬 x 로 len) + 안쪽 눈(구멍 0.017) + 바깥 멈춤 고리. 원점 = 눈 중심 */
export function slideRod273(len: number): THREE.Group {
  const g = new THREE.Group();
  // 눈: 원기둥 바깥 0.04 · 구멍 0.017 · 깊이 −0.03~0.03 (darkSteel)
  const eyeGeo = lathe(tubeProfile(0.017, 0.04, -0.03, 0.03, 0.004), 36);
  eyeGeo.rotateX(Math.PI / 2);
  const eye = mesh(eyeGeo, darkSteel());
  eye.name = 'eye';
  g.add(eye);
  // 둥근 막대: 반지름 0.025, 눈 중심에서 +x 로 len (steel)
  const rodGeo = lathe(rodProfile(0.025, 0, len, 0, 0.004), 24);
  rodGeo.rotateZ(-Math.PI / 2);
  g.add(mesh(rodGeo, steel()));
  // 멈춤 고리: 바깥 0.04 · 길이 0.03, 막대 끝에서 0.01 안쪽 (장식)
  const stopGeo = lathe(tubeProfile(0.026, 0.04, len - 0.04, len - 0.01, 0.003), 24);
  stopGeo.rotateZ(-Math.PI / 2);
  g.add(mesh(stopGeo, steel()));
  return g;
}

/** 안내 부시: 관(안 0.027 · 바깥 0.06 · 길이 0.12) + 뒤판까지 받침 상자(0.10×0.08, 0.005 겹침). 원점 = 부시 가운데 */
export function guide273(axis: 'x' | 'y'): THREE.Group {
  const g = new THREE.Group();
  const tubeGeo = lathe(tubeProfile(0.027, 0.06, -0.06, 0.06, 0.004), 40);
  if (axis === 'x') tubeGeo.rotateZ(Math.PI / 2);
  const tube = mesh(tubeGeo, castIron());
  tube.name = 'bush';
  g.add(tube);
  // 받침: 뒤판 앞면(−0.30)에서 부시 뒷면(−0.06)까지, 0.005 겹침으로 붙임
  const post = mesh(new THREE.BoxGeometry(0.10, 0.08, 0.245), castIron());
  post.name = 'post';
  post.position.z = -0.1775;
  g.add(post);
  setMM(g, { kind: 'guide', axis });
  return g;
}

/** 납작 고리 막대: 핀 사이 len · 폭 0.06 · 끝 반원 0.04 · 구멍 0.017 · 두께 0.03. 원점 = 첫 핀, +x 가 둘째 핀 */
export function flatLink273(len: number): THREE.Mesh {
  const BOSS = 0.04; // 끝 반원 반지름
  const BAND = 0.03; // 몸통 반폭(폭 0.06)
  const HOLE = 0.017; // 핀 구멍
  const ang = Math.asin(BAND / BOSS); // 밴드 가장자리가 보스 원에 닿는 각
  const s = new THREE.Shape();
  s.absarc(len, 0, BOSS, ang - Math.PI, Math.PI - ang, false); // 오른쪽 보스(아래→위, 오른쪽 돌아감)
  s.lineTo(BOSS * Math.cos(ang), BOSS * Math.sin(ang)); // 윗변
  s.absarc(0, 0, BOSS, ang, TAU - ang, false); // 왼쪽 보스(위→아래, 왼쪽 돌아감)
  s.closePath();
  for (const cx of [0, len]) {
    const h = new THREE.Path();
    h.absarc(cx, 0, HOLE, 0, TAU, true);
    s.holes.push(h);
  }
  const m = mesh(extrude(s, 0.03), brass());
  setMM(m, { kind: 'link', len });
  return m;
}
