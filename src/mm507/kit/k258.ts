// 258 V홈 풀리 전용 부품 — 설계표 docs/mm507-sheets/258.md 「키트 추가」
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, polygonFace, tubeProfile } from '../../models/parts/geom';
import { setMM } from './mm';

const D = Math.PI / 180;

/** 258 상수 — 중심·깊이·V홈·줄·구동 계수·잘린 자리 */
export const K258 = {
  /** 큰 풀리 중심 */
  C1: [0, 2.12] as [number, number],
  /** 구동 풀리 중심 */
  C2: [0, 0.82] as [number, number],
  /** 풀리·줄이 놓인 깊이 */
  ZC: 0.1,
  /** V홈 입구 반폭 */
  V_MOUTH: 0.104,
  /** V홈 바닥 평평한 곳 반폭 */
  V_FLAT: 0.018,
  /** V홈 깊이(비탈 반각 25.3°) */
  V_DEPTH: 0.182,
  /** 둥근 줄 반지름 */
  ROPE_R: 0.07,
  /** 줄 중심 반지름(큰 풀리) — 비탈 두 곳에 쐐기로 물림 */
  R_ROPE_BIG: 0.56375,
  /** 줄 중심 반지름(구동 풀리) */
  R_ROPE_DRIVE: 0.26375,
  /** 구동 각속도 rad/s */
  OMEGA: 1.2,
  /** 속도비 φ1/φ2 */
  RATIO: 0.46785,
  /** 잘린 자리 ψ(라디안) −90°·−25° */
  CUT: [-90 * D, -25 * D] as [number, number]
};

/** V홈 풀리 단면 (r, a) 14점 — a = 세계 z − 풀리 중심 깊이. 반시계, lathe 에 넣을 때 첫 점을 한 번 더 */
export function vGrooveProfile258(Ro: number, rimIn: number, webIn: number): [number, number][] {
  const m = K258.V_MOUTH;
  const f = K258.V_FLAT;
  const d = K258.V_DEPTH;
  return [
    [webIn, -0.05],
    [rimIn, -0.05],
    [rimIn, -0.17],
    [Ro - 0.008, -0.17],
    [Ro, -0.162],
    [Ro, -m],
    [Ro - d, -f],
    [Ro - d, f],
    [Ro, m],
    [Ro, 0.162],
    [Ro - 0.008, 0.17],
    [rimIn, 0.17],
    [rimIn, 0.05],
    [webIn, 0.05]
  ];
}

/** 큰 풀리 단면(Ro 0.62, rimIn 0.39, webIn 0.156) — 림·웹·단면판이 한 점열을 나눠 쓴다 */
const RIM258 = vGrooveProfile258(0.62, 0.39, 0.156);

/** 큰 풀리 림+웹(잘린 회전체, 재료 ψ −25°→270°) + 주홍 단면판 둘. 원점 = 풀리 중심, 세계에 고정 */
export function cutRim258(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bigRimGroup';
  // lathe 각도는 φ 기준 — rotateX(π/2) 뒤 ψ = φ − 90° 이므로 재료 φ 65°→360°(빈 자리 ψ −90°~−25°)
  const rimGeo = lathe([...RIM258, RIM258[0]!], 72, 65 * D, 295 * D);
  rimGeo.rotateX(Math.PI / 2);
  const rim = mesh(rimGeo, brass());
  rim.name = 'bigRim';
  g.add(rim);
  // 단면판: 단면 다각형 → XZ 평면 → ψ 로 돌려 열린 끝(ψ −90°·−25°)을 막는다
  const faceGeo = polygonFace(RIM258);
  faceGeo.rotateX(Math.PI / 2);
  for (const [name, psi] of [
    ['bigCutFace', K258.CUT[0]],
    ['bigCutFace2', K258.CUT[1]]
  ] as const) {
    const mat = paint(0xd2552e);
    mat.side = THREE.DoubleSide;
    const f = mesh(faceGeo.clone(), mat);
    f.name = name;
    f.rotation.z = psi;
    g.add(f);
  }
  return g;
}

/** 구동 풀리(온 바퀴, 매끈한 V홈): 림·웹 + 허브 + 노란 표시 + 바퀴 표식. 원점 = 풀리 중심, 회전축 = 로컬 Z */
export function vGroovePulley258(Ro: number): THREE.Group {
  const g = new THREE.Group();
  const prof = vGrooveProfile258(Ro, 0.115, 0.086);
  const rimGeo = lathe([...prof, prof[0]!], 64);
  rimGeo.rotateX(Math.PI / 2);
  const rim = mesh(rimGeo, bronze());
  rim.name = 'driveRim';
  g.add(rim);
  const hubGeo = lathe(tubeProfile(0.045, 0.09, -0.21, 0.21, 0.006), 36);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 노란 표시(테 앞 턱면 위) — 회전이 보이게
  const mark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
  mark.position.set(0.25, 0, 0.173);
  g.add(mark);
  setMM(g, {
    kind: 'wheel',
    fn: 'vGroovePulley258',
    axis: 'z',
    r: Ro,
    width: 0.34,
    span: [-0.17, 0.17],
    rim: 'groove',
    groove: 'round',
    profile: 'v',
    bottom: K258.R_ROPE_DRIVE - K258.ROPE_R, // 0.19375 — 줄이 실제로 앉는 높이
    vBottom: Ro - K258.V_DEPTH, // 0.138 — 실제 V 바닥
    outer: Ro
  });
  return g;
}

/** 큰 풀리 허브(회전부): 허브 + 노란 표시 + 바퀴 표식. 림은 세계에 고정이라 회전 대칭. 원점 = 풀리 중심 */
export function bigHub258(): THREE.Group {
  const g = new THREE.Group();
  const hubGeo = lathe(tubeProfile(0.06, 0.16, -0.23, 0.23, 0.006), 48);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 노란 표시(허브 앞면 위)
  const mark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
  mark.position.set(0.11, 0, 0.233);
  g.add(mark);
  setMM(g, {
    kind: 'wheel',
    fn: 'vGroovePulley258',
    axis: 'z',
    r: 0.62,
    width: 0.34,
    span: [-0.17, 0.17],
    rim: 'groove',
    groove: 'round',
    profile: 'v',
    bottom: K258.R_ROPE_BIG - K258.ROPE_R, // 0.49375 — 줄이 실제로 앉는 높이
    vBottom: 0.62 - K258.V_DEPTH, // 0.438 — 실제 V 바닥
    outer: 0.62
  });
  return g;
}
