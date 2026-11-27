// 259 톱니 V홈 풀리 전용 부품 — 설계표 docs/mm507-sheets/259.md 「키트 추가」
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, polygonFace, tubeProfile } from '../../models/parts/geom';
import { setMM } from './mm';

const D = Math.PI / 180;

/** 259 상수 — 중심·깊이·줄·구동·잘린 자리·바탕 단면·이랑 */
export const K259 = {
  /** 큰 풀리 중심 */
  C1: [0, 2.12] as [number, number],
  /** 구동 풀리 중심 */
  C2: [0, 0.82] as [number, number],
  /** 풀리·줄이 놓인 깊이 */
  ZC: 0.1,
  /** 둥근 줄 반지름 */
  ROPE_R: 0.07,
  /** 줄 중심 반지름(큰 풀리, 이랑 끝 V 기준) */
  R_ROPE_BIG: 0.56375,
  /** 줄 중심 반지름(구동 풀리) */
  R_ROPE_DRIVE: 0.26375,
  /** 구동 각속도 rad/s */
  OMEGA: 1.2,
  /** 속도비 φ1/φ2 */
  RATIO: 0.46785,
  /** 잘린 자리 ψ(라디안) −90°·−25° */
  CUT: [-90 * D, -25 * D] as [number, number],
  /** 큰 풀리 바탕 단면 (r, a) 14점 — 258 의 V 를 비탈에 수직으로 0.012 더 깊게 판 바탕 V */
  RIM259: [
    [0.156, -0.05],
    [0.39, -0.05],
    [0.39, -0.17],
    [0.612, -0.17],
    [0.62, -0.162],
    [0.62, -0.11727],
    [0.43, -0.02749],
    [0.43, 0.02749],
    [0.62, 0.11727],
    [0.62, 0.162],
    [0.612, 0.17],
    [0.39, 0.17],
    [0.39, 0.05],
    [0.156, 0.05]
  ] as [number, number][],
  /** 이랑(톱니) — 상자 x = 비탈 방향, y = 둘레 방향 두께, z = 비탈 수직 높이 */
  RIB: {
    len: 0.19,
    thick: 0.016,
    h: 0.012,
    tilt: 0.44143,
    center: [0.52644, 0.06642] as [number, number],
    n: 72,
    stepDeg: 5
  }
};

/** 구동 풀리 단면 (r, a) 14점 — a = 세계 z − 풀리 중심 깊이. 258 과 같은 매끈한 V홈 */
export function vGrooveProfile259(Ro: number, rimIn: number, webIn: number): [number, number][] {
  return [
    [webIn, -0.05],
    [rimIn, -0.05],
    [rimIn, -0.17],
    [Ro - 0.008, -0.17],
    [Ro, -0.162],
    [Ro, -0.104],
    [Ro - 0.182, -0.018],
    [Ro - 0.182, 0.018],
    [Ro, 0.104],
    [Ro, 0.162],
    [Ro - 0.008, 0.17],
    [rimIn, 0.17],
    [rimIn, 0.05],
    [webIn, 0.05]
  ];
}

/** 큰 풀리 바탕 림+웹(잘린 회전체, 재료 ψ −25°→270°) + 주홍 단면판 둘. 원점 = 풀리 중심, 세계에 고정 */
export function cutRim259(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bigRimGroup';
  // lathe 각도는 φ 기준 — rotateX(π/2) 뒤 ψ = φ − 90° 이므로 재료 φ 65°→360°(빈 자리 ψ −90°~−25°)
  const rimGeo = lathe([...K259.RIM259, K259.RIM259[0]!], 72, 65 * D, 295 * D);
  rimGeo.rotateX(Math.PI / 2);
  const rim = mesh(rimGeo, brass());
  rim.name = 'bigRim';
  g.add(rim);
  // 단면판: 바탕 단면 다각형 → XZ 평면 → ψ 로 돌려 열린 끝(ψ −90°·−25°)을 막는다
  const faceGeo = polygonFace(K259.RIM259);
  faceGeo.rotateX(Math.PI / 2);
  for (const [name, psi] of [
    ['bigCutFace', K259.CUT[0]],
    ['bigCutFace2', K259.CUT[1]]
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

/** 이랑 한 쌍(앞·뒤 메시) — 감추기용 목록 항목. deg = 옮겨 놓은 기준 각(도) */
export interface Rib259 {
  deg: number;
  front: THREE.Mesh;
  back: THREE.Mesh;
}

/** 이랑 144개(앞·뒤 비탈 기하 둘을 나눠 씀) — bigPulley 의 자식으로 붙어 함께 돈다.
 *  userData.ribs 에 { deg, front, back } 목록을 남긴다(모델이 잘린 자리에서 감춘다) */
export function ribs259(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bigRibs';
  const R = K259.RIB;
  // 앞(+a) 비탈 기하: 상자 x 를 비탈 방향 (0.90414, 0, +0.42723) 으로 세우고 단면 가운데로 옮긴다
  const frontGeo = new THREE.BoxGeometry(R.len, R.thick, R.h);
  frontGeo.rotateY(-R.tilt);
  frontGeo.translate(R.center[0], 0, R.center[1]);
  // 뒤(−a) 비탈 기하
  const backGeo = new THREE.BoxGeometry(R.len, R.thick, R.h);
  backGeo.rotateY(R.tilt);
  backGeo.translate(R.center[0], 0, -R.center[1]);
  const mat = brass();
  const list: Rib259[] = [];
  for (let i = 0; i < R.n; i++) {
    const deg = i * R.stepDeg; // 둘레 간격 5°
    const front = mesh(frontGeo, mat);
    const back = mesh(backGeo, mat);
    front.rotation.z = deg * D;
    back.rotation.z = deg * D;
    g.add(front, back);
    list.push({ deg, front, back });
  }
  g.userData.ribs = list;
  return g;
}

/** 구동 풀리(온 바퀴, 매끈한 V홈): 림·웹 + 허브 + 노란 표시 + 바퀴 표식. 원점 = 풀리 중심, 회전축 = 로컬 Z */
export function vGroovePulley259(Ro: number): THREE.Group {
  const g = new THREE.Group();
  const prof = vGrooveProfile259(Ro, 0.115, 0.086);
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
    fn: 'vGroovePulley259',
    axis: 'z',
    r: Ro,
    width: 0.34,
    span: [-0.17, 0.17],
    rim: 'groove',
    groove: 'round',
    profile: 'v',
    bottom: K259.R_ROPE_DRIVE - K259.ROPE_R,
    vBottom: Ro - 0.182,
    outer: Ro
  });
  return g;
}

/** 큰 풀리 허브(회전부): 허브 + 노란 표시 + 바퀴 표식. 이랑은 모델이 자식으로 붙인다. 원점 = 풀리 중심 */
export function bigHub259(): THREE.Group {
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
    fn: 'notchedVPulley259',
    axis: 'z',
    r: 0.62,
    width: 0.34,
    span: [-0.17, 0.17],
    rim: 'groove',
    groove: 'round',
    profile: 'v-notched',
    bottom: K259.R_ROPE_BIG - K259.ROPE_R, // 0.49375 — 이랑 끝 기준
    vBottom: 0.43,
    outer: 0.62
  });
  return g;
}
