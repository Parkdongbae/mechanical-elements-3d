// 224번 지름이 변하는 풀리 전용 키트 — 나선 홈 바퀴 c, 팔(막대+스터드+테 조각), 거미판, 구동 식
// 설계표 docs/mm507-sheets/224.md
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import {
  annularSector,
  circlePath,
  circlePts,
  extrude,
  lathe,
  loft,
  merge,
  mesh,
  shapeFrom,
  stadiumShape,
  tubeProfile
} from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { meshAngle } from './gear';
import { setMM } from './mm';

const D = Math.PI / 180;
const TAU = Math.PI * 2;

export const K224 = {
  O: [0, 1.7] as [number, number], // 풀리 중심
  PSI: (k: number): number => (k * Math.PI) / 3, // 팔 k 방향
  RS0: 0.25, // 판화 자세의 스터드 반지름
  RS_AMP: 0.08,
  K_SPIRAL: 0.15485, // 나선 홈 dr/dφ
  R_IN: 0.145, // 홈 안쪽 끝 반지름
  SPAN: 1.2915, // 홈이 걸치는 각(74°)
  PHI_OFF: 0.67813, // φin,k = ψk − PHI_OFF
  SLOT_HW: 0.029, // 홈 반폭
  RIM_IN: 0.915,
  RIM_OUT: 0.965,
  RIM_HALF: 26 * D,
  PIN_R: 0.64, // 안내 핀 반지름
  PINION: [0, 0.552] as [number, number], // 피니언 중심(바퀴 중심 기준)
  M: 0.024,
  TEETH_C: 36,
  TEETH_D: 10
} as const;
const K = K224;

/** 판화 자세 풀리 바깥 반지름 = rs + 0.715 */
export const RIM_OFFSET224 = K.RIM_OUT - 0.25;

// ── 구동 ─────────────────────────────────────────────

/** 시각 t → 바퀴 c 각 Δ, 스터드 반지름 rs, 피니언 각 θd (설계표 동작 1) */
export function state224(t: number): { delta: number; rs: number; thetaD: number } {
  const s = Math.sin(0.5 * t);
  const delta = -(K.RS_AMP / K.K_SPIRAL) * s;
  const rs = K.RS0 + K.RS_AMP * s;
  const thetaD = meshAngle([0, 0], K.TEETH_C, delta, K.PINION, K.TEETH_D);
  return { delta, rs, thetaD };
}

// ── 바퀴 c ───────────────────────────────────────────

/** 나선 홈 k 의 윤곽(바퀴 c 로컬): 가운데선 ± 반폭 + 양 끝 반원. 가운데선 r = R_IN + K_SPIRAL·(φ − φin,k) */
export function slotOutline224(k: number): V2[] {
  const hw = K.SLOT_HW;
  const phiIn = (k * Math.PI) / 3 - K.PHI_OFF;
  const N = 40;
  const P: V2[] = [];
  const Nv: V2[] = [];
  for (let i = 0; i <= N; i++) {
    const phi = phiIn + (K.SPAN * i) / N;
    const r = K.R_IN + K.K_SPIRAL * (phi - phiIn);
    const dr = K.K_SPIRAL;
    // 접선 T = (r'cosφ − r sinφ, r'sinφ + r cosφ), 법선 = T 를 90° 돌린 것
    const tx = dr * Math.cos(phi) - r * Math.sin(phi);
    const ty = dr * Math.sin(phi) + r * Math.cos(phi);
    const l = Math.hypot(tx, ty);
    P.push([r * Math.cos(phi), r * Math.sin(phi)]);
    Nv.push([-ty / l, tx / l]);
  }
  const out: V2[] = [];
  for (let i = 0; i <= N; i++) out.push([P[i]![0] + hw * Nv[i]![0], P[i]![1] + hw * Nv[i]![1]]);
  const cap = (c: V2, nAng: number): void => {
    const M = 12;
    for (let j = 1; j < M; j++) {
      const a = nAng - (Math.PI * j) / M;
      out.push([c[0] + hw * Math.cos(a), c[1] + hw * Math.sin(a)]);
    }
  };
  cap(P[N]!, Math.atan2(Nv[N]![1], Nv[N]![0]));
  for (let i = N; i >= 0; i--) out.push([P[i]![0] - hw * Nv[i]![0], P[i]![1] - hw * Nv[i]![1]]);
  cap(P[0]!, Math.atan2(Nv[0]![1], Nv[0]![0]) + Math.PI);
  return out;
}

/** 홈 가운데선 위 스터드 반지름(바퀴가 Δ 돌았을 때, 팔 k): φ = ψk − Δ → r = R_IN + K_SPIRAL(PHI_OFF − Δ) */
export function slotRadius224(delta: number): number {
  return K.R_IN + K.K_SPIRAL * (K.PHI_OFF - delta);
}

/**
 * 바퀴 c — 이 36 윤곽 + 나선 홈 6 + 축 구멍 + 허브 고리 + 노란 표시. 원점 = 바퀴 중심, 판은 로컬 z 0 ~ 0.04.
 * 허브 고리는 로컬 z 0 ~ 0.06(앞으로 0.02 더 나옴, 앞 너트가 막는 쪽).
 */
export function slottedWheel224(): THREE.Group {
  const g = new THREE.Group();
  const ra = 0.456;
  const rf = 0.402;
  const w = 0.04;
  const c = 0.006;
  const outline = involuteOutline(K.TEETH_C, ra, rf, Math.PI / K.TEETH_C);
  const slots = [0, 1, 2, 3, 4, 5].map((k) => slotOutline224(k));
  const layers = [
    { z: 0, s: (ra - c) / ra },
    { z: c, s: 1 },
    { z: w - c, s: 1 },
    { z: w, s: (ra - c) / ra }
  ];
  const plate = mesh(loft(outline, [circlePts(0.05, 32), ...slots], layers), brass());
  plate.name = 'wheelCPlate';
  g.add(plate);
  const hubGeo = lathe(tubeProfile(0.05, 0.1, 0, 0.06, 0.005), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  const markGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.006, 16);
  markGeo.rotateX(Math.PI / 2);
  const mark = mesh(markGeo, paint(0xf2b619));
  mark.position.set(0.3835, 0.0336, w + 0.003);
  g.add(mark);
  g.userData.outlines = { slots };
  setMM(g, {
    kind: 'gear',
    fn: 'slottedWheel224',
    teeth: K.TEETH_C,
    module: K.M,
    rp: 0.432,
    ra,
    rf,
    width: w,
    axis: 'z',
    internal: false
  });
  return g;
}

// ── 팔 ───────────────────────────────────────────────

/**
 * 팔 k — 팔 막대(긴 홈) + 스터드(name stud{k}) + 테 조각(name rim{k}). 원점 = 스터드 중심, 로컬 +x = 바깥 반지름 방향.
 * 층 z: 팔 0.042 ~ 0.088 / 스터드 0.088 ~ 0.162 / 테 −0.005 ~ 0.135.
 */
export function arm224(k: number): THREE.Group {
  const g = new THREE.Group();
  g.name = `arm${k}`;
  // 팔 막대: 로컬 x −0.035 ~ 0.665, 폭 0.07, 긴 홈 x 0.29 ~ 0.49
  const bar = stadiumShape(0, 0, 0.63, 0, 0.035);
  bar.holes.push(stadiumShape(0.312, 0, 0.468, 0, 0.022));
  const barGeo = extrude(bar, 0.046, 0.003);
  barGeo.translate(0, 0, 0.065);
  const barMesh = mesh(barGeo, steel());
  barMesh.name = `armBar${k}`;
  g.add(barMesh);
  // 받침(브래킷): 팔 끝을 감싸 테 조각 안쪽 면에 파고든 블록 + 볼트 머리 2 — 팔·테가 한 몸
  const boss = mesh(
    extrude(shapeFrom([[0.585, -0.06], [0.69, -0.06], [0.69, 0.06], [0.585, 0.06]]), 0.07, 0.004).translate(0, 0, 0.065),
    steel()
  );
  boss.name = `armBoss${k}`;
  g.add(boss);
  for (const sy of [-0.032, 0.032]) {
    const bg = new THREE.CylinderGeometry(0.014, 0.014, 0.014, 16);
    bg.rotateX(Math.PI / 2);
    const bolt = mesh(bg, darkSteel());
    bolt.name = `armBolt${k}`;
    bolt.position.set(0.628, sy, 0.1 + 0.007 - 0.002);
    g.add(bolt);
  }
  // 스터드(빨강) — 몸통 + 머리 한 메시
  const studGeo = lathe(
    [
      [0, 0.088],
      [0.025, 0.088],
      [0.025, 0.142],
      [0.036, 0.142],
      [0.036, 0.162],
      [0, 0.162]
    ],
    24
  );
  studGeo.rotateX(Math.PI / 2);
  const stud = mesh(studGeo, paint(0xd8362f));
  stud.name = `stud${k}`;
  g.add(stud);
  // 테 조각: 중심 = 로컬 (−0.25, 0), 반지름 0.915 ~ 0.965, 각 ±26°
  const rimGeo = extrude(annularSector(K.RIM_IN, K.RIM_OUT, -K.RIM_HALF, K.RIM_HALF), 0.14, 0.006);
  rimGeo.translate(0, 0, 0.065);
  const rim = mesh(rimGeo, brass());
  rim.position.set(0.665 - K.RIM_IN, 0, 0);
  rim.name = `rim${k}`;
  g.add(rim);
  return g;
}

// ── 거미판 ───────────────────────────────────────────

/** 거미판(고정) — 가운데 원판 + 안내 띠 6 + 피니언 받침판 + 뒤 보스. 원점 = 풀리 중심, 판 z 0 ~ 0.04 */
export function spider224(): THREE.Group {
  const g = new THREE.Group();
  const T = 0.04;
  const c = 0.003;
  const geos: THREE.BufferGeometry[] = [];
  const lay = (geo: THREE.BufferGeometry, t = T): THREE.BufferGeometry => geo.translate(0, 0, t / 2);
  // 같은 앞면(z 0.04) 겹침 깜빡임 방지: 원판은 0.036, 띠·받침판은 0.040 (띠가 원판 위로 0.004 솟음)
  const TD = 0.036;
  // 원판 반지름 0.50, 축 구멍 0.05
  const disc = new THREE.Shape();
  disc.absarc(0, 0, 0.5, 0, TAU, false);
  disc.holes.push(circlePath(0, 0, 0.05));
  geos.push(lay(extrude(disc, TD, c), TD));
  // 안내 띠 6: r 0.45 ~ 0.72, 폭 0.10
  for (let k = 0; k < 6; k++) {
    const shape = shapeFrom([
      [0.45, -0.05],
      [0.72, -0.05],
      [0.72, 0.05],
      [0.45, 0.05]
    ]);
    const geo = lay(extrude(shape, T, c));
    geo.rotateZ(K.PSI(k));
    geos.push(geo);
  }
  // 피니언 받침판: r 0.40 ~ 0.68, 68° ~ 112°, 피니언 축 구멍
  const plate = annularSector(0.4, 0.68, 68 * D, 112 * D);
  plate.holes.push(circlePath(K.PINION[0], K.PINION[1], 0.022));
  geos.push(lay(extrude(plate, T, c)));
  const body = mesh(merge(geos), darkSteel());
  body.name = 'spiderPlate';
  g.add(body);
  // 뒤 보스(축에 박힘): z −0.12 ~ 0
  const bossGeo = lathe(tubeProfile(0.05, 0.1, -0.12, 0, 0.004), 32);
  bossGeo.rotateX(Math.PI / 2);
  const boss = mesh(bossGeo, darkSteel());
  boss.name = 'spiderBoss';
  g.add(boss);
  return g;
}
