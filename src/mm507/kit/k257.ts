// 257 둥근 홈 풀리 전용 부품 — 설계표 docs/mm507-sheets/257.md 「키트 추가」
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, polygonFace, tubeProfile } from '../../models/parts/geom';
import { setMM } from './mm';

const D = Math.PI / 180;

/** 257 상수 — 중심·깊이·홈·줄·구동 계수 */
export const K257 = {
  /** 큰 풀리 중심 */
  C1: [0, 2.12] as [number, number],
  /** 구동 풀리 중심 */
  C2: [0, 0.82] as [number, number],
  /** 풀리·줄이 놓인 깊이 */
  ZC: 0.1,
  /** 반원 홈 반지름 */
  GROOVE_R: 0.093,
  /** 둥근 줄 반지름 */
  ROPE_R: 0.085,
  /** 줄 중심 반지름(큰 풀리) = 홈 바닥 0.527 + 줄 0.085 */
  R_ROPE_BIG: 0.612,
  /** 줄 중심 반지름(구동 풀리) = 홈 바닥 0.207 + 줄 0.085 */
  R_ROPE_DRIVE: 0.292,
  /** 구동 각속도 rad/s */
  OMEGA: 1.2,
  /** 속도비 φ1/φ2 */
  RATIO: 0.47712,
  /** 잘린 자리 ψ(라디안) −90°·−25° */
  CUT: [-90 * D, -25 * D] as [number, number]
};

/** 둥근 홈 풀리 단면 (r, a) 23점 — a = 세계 z − 풀리 중심 깊이. 반시계, lathe 에 넣을 때 첫 점을 한 번 더 */
export function roundGrooveProfile257(Ro: number, rimIn: number, webIn: number): [number, number][] {
  const Rg = K257.GROOVE_R;
  const p: [number, number][] = [
    [webIn, -0.05],
    [rimIn, -0.05],
    [rimIn, -0.165],
    [Ro - 0.008, -0.165],
    [Ro, -0.157],
    [Ro, -Rg]
  ];
  // 홈 호 11점: θ −75°→75° 15° 걸음, 홈 원 중심이 바깥 반지름 Ro 위
  for (let k = 0; k <= 10; k++) {
    const th = (-75 + 15 * k) * D;
    p.push([Ro - Rg * Math.cos(th), Rg * Math.sin(th)]);
  }
  p.push([Ro, Rg], [Ro, 0.157], [Ro - 0.008, 0.165], [rimIn, 0.165], [rimIn, 0.05], [webIn, 0.05]);
  return p;
}

/** 큰 풀리 단면(Ro 0.62, rimIn 0.46, webIn 0.156) — 림·웹·단면판이 한 점열을 나눠 쓴다 */
const RIM257 = roundGrooveProfile257(0.62, 0.46, 0.156);

/** 큰 풀리 림+웹(잘린 회전체, ψ −25°→270° 재료) + 주홍 단면판 둘. 원점 = 풀리 중심, 세계에 고정 */
export function cutRim257(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bigRimGroup';
  // lathe 각도는 φ 기준 — rotateX(π/2) 뒤 ψ = φ − 90° 이므로 재료 φ 65°→360°
  const rimGeo = lathe([...RIM257, RIM257[0]!], 72, 65 * D, 295 * D);
  rimGeo.rotateX(Math.PI / 2);
  const rim = mesh(rimGeo, brass());
  rim.name = 'bigRim';
  g.add(rim);
  // 단면판: 프로파일 다각형 → XZ 평면 → ψ 로 돌려 열린 끝(ψ −90°·−25°)을 막는다
  const faceGeo = polygonFace(RIM257);
  faceGeo.rotateX(Math.PI / 2);
  for (const [name, psi] of [
    ['bigCutFace', K257.CUT[0]],
    ['bigCutFace2', K257.CUT[1]]
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

/** 구동 풀리(온 바퀴): 림·웹 + 허브 + 노란 표시 + 바퀴 표식. 원점 = 풀리 중심, 회전축 = 로컬 Z */
export function roundGroovePulley257(Ro: number): THREE.Group {
  const g = new THREE.Group();
  const prof = roundGrooveProfile257(Ro, 0.16, 0.096);
  const rimGeo = lathe([...prof, prof[0]!], 64);
  rimGeo.rotateX(Math.PI / 2);
  const rim = mesh(rimGeo, bronze());
  rim.name = 'driveRim';
  g.add(rim);
  const hubGeo = lathe(tubeProfile(0.045, 0.1, -0.205, 0.205, 0.006), 36);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 노란 표시(테 앞 턱면 위) — 회전이 보이게
  const mark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
  mark.position.set(Ro - 0.07, 0, 0.168);
  g.add(mark);
  setMM(g, {
    kind: 'wheel',
    fn: 'roundGroovePulley257',
    axis: 'z',
    r: Ro,
    width: 0.33,
    span: [-0.165, 0.165],
    rim: 'groove',
    groove: 'round',
    bottom: Ro - K257.GROOVE_R,
    outer: Ro
  });
  return g;
}

/** 큰 풀리 허브(회전부): 허브 + 노란 표시 + 바퀴 표식. 원점 = 풀리 중심 */
export function bigHub257(): THREE.Group {
  const g = new THREE.Group();
  const hubGeo = lathe(tubeProfile(0.06, 0.16, -0.225, 0.225, 0.006), 48);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 노란 표시(허브 앞면 위)
  const mark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
  mark.position.set(0.11, 0, 0.228);
  g.add(mark);
  setMM(g, {
    kind: 'wheel',
    fn: 'roundGroovePulley257',
    axis: 'z',
    r: 0.62,
    width: 0.33,
    span: [-0.165, 0.165],
    rim: 'groove',
    groove: 'round',
    bottom: 0.62 - K257.GROOVE_R,
    outer: 0.62
  });
  return g;
}
