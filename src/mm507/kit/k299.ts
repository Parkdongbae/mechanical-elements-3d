// 299번 옛 시계 탈진기(날개형) 전용 키트 — 눕힌 왕관 바퀴·버지·앞뒤 팔레트·날개. 접촉 식과 왕관 이는 k298 공용 부분을 쓴다. 설계표 docs/mm507-sheets/299.md
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, extrude, lathe, merge, mesh, rodProfile, shapeFrom, tubeProfile, TAU } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { D2R, crownTeeth, escState, plateHole, toothOutline, type EscParams, type ToothCfg } from './k298';
import { contactAlpha } from './k298';

export const K299 = {
  CROWN: [0, 0.25] as const,
  VERGE: [0, 1.52] as const,
  Z: 15,
  PITCH: 24,
  RO: 0.4,
  RI: 0.36,
  YTIP: 1.45,
  YROOT: 1.35,
  BACK: 16,
  D: 0.07,
  LP: 0.154,
  TF: 0.016,
  CH: 0.025,
  G0: 60,
  AMP: 35,
  PERIOD: 2,
  GREL: 65.9774,
  PAL_F: [
    [-0.004, -0.0069],
    [0.1294, -0.0839],
    [0.1157, -0.0576],
    [0.004, 0.0069]
  ] as V2[],
  PAL_B: [
    [0.004, -0.0069],
    [-0.1294, -0.0839],
    [-0.1157, -0.0576],
    [-0.004, 0.0069]
  ] as V2[],
  EXPECT: [
    [0, 0, 15.2546],
    [0.05, 5.475, 19.5956],
    [0.1, 10.816, 21.9058],
    [0.25, 24.749, 17.6927],
    [0.5, 35, 15.4132],
    [1.0, 0, 27.2546],
    [1.05, -5.475, 31.5956],
    [1.1, -10.816, 33.9058],
    [1.5, -35, 27.4132],
    [2.0, 0, 39.2546],
    [30, 0, 375.2546]
  ] as [number, number, number][]
} as const;
const K = K299;

const P299: EscParams = { RO: K.RO, D: K.D, LP: K.LP, TF: K.TF, G0: K.G0, AMP: K.AMP, PERIOD: K.PERIOD, P: K.PITCH };

export interface State299 {
  theta: number;
  phi: number;
  holder: 'front' | 'back';
  justDropped: boolean;
}

export function state299(t: number): State299 {
  const s = escState(P299, t);
  return { theta: s.theta, phi: s.phi, holder: s.holder === 'A' ? 'front' : 'back', justDropped: s.justDropped };
}

/** 앞(front)·뒤 팔레트가 이 앞면을 막는 α(도) 또는 null(놓임) */
export function contact299(front: boolean, theta: number): number | null {
  return contactAlpha(P299, front, theta);
}

const toothCfg299: ToothCfg = {
  z: K.Z,
  pitchDeg: K.PITCH,
  backDeg: K.BACK,
  ri: K.RI,
  ro: K.RO,
  u0: K.YROOT,
  u1: K.YTIP,
  map: (u, a, rho) => [rho * Math.sin(a), u, rho * Math.cos(a)]
};

/** 왕관 바퀴·세로축·태엽통·축 칼라·빨간 표시. 원점 = (0, 0, 0.25), 회전축 = 로컬 Y. name `crownWheel`·`crownArbor`·`barrel` */
export function crown299(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'crownGroup';
  const disc = new THREE.Shape();
  disc.absarc(0, 0, K.RO, 0, TAU, false);
  for (let j = 0; j < 4; j++) disc.holes.push(annularSector(0.1, 0.31, (90 * j + 15) * D2R, (90 * j + 75) * D2R));
  const discGeo = extrude(disc, 0.04, 0.002, 48);
  discGeo.rotateX(-Math.PI / 2);
  discGeo.translate(0, 1.27, 0);
  const rimGeo = lathe(tubeProfile(K.RI, K.RO, 1.29, 1.35), 96);
  const wheelMat = brass();
  const wheel = mesh(merge([discGeo, rimGeo, crownTeeth(toothCfg299)]), wheelMat);
  wheel.name = 'crownWheel';
  wheel.userData.outline = toothOutline(toothCfg299);
  g.add(wheel);
  // 세로축 y 0.28 ~ 1.27(판 속에 0.02 박음)
  const arbor = mesh(lathe(rodProfile(0.035, 0.28, 1.27, 0.004, 0), 32), steel());
  arbor.name = 'crownArbor';
  g.add(arbor);
  // 태엽통 y 0.55~0.80(축에 고정), 노란 세로 줄
  const barrel = mesh(lathe(tubeProfile(0.033, 0.3, 0.55, 0.8, 0.006), 64), steel());
  barrel.name = 'barrel';
  g.add(barrel);
  const stripe = mesh(new THREE.BoxGeometry(0.03, 0.2, 0.004), paint(0xf2b619));
  stripe.position.set(0, 0.675, 0.3015);
  g.add(stripe);
  // 축 칼라: 아래 받침 윗면(0.32)에 얹힘
  const col = mesh(lathe(tubeProfile(0.033, 0.055, 0.319, 0.34, 0.002), 32), steel());
  col.name = 'arborCollar';
  g.add(col);
  const red = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.004), paint(0xd03020));
  red.position.set(0, 1.31, 0.4015);
  g.add(red);
  g.userData.wheelMat = wheelMat;
  return g;
}

function palletMesh(pts: V2[], z0: number, z1: number, mat: THREE.Material, name: string): THREE.Mesh {
  const geo = extrude(shapeFrom(pts), z1 - z0, 0, 4);
  geo.translate(0, 0, (z0 + z1) / 2);
  const m = mesh(geo, mat);
  m.name = name;
  m.userData.flagSection = pts;
  return m;
}

/** 버지·팔레트 둘·날개·추. 원점 = (0, 1.52, 0), 회전축 = 로컬 Z. name `verge`·`palletFront`·`palletBack`·`foliot`·`foliotWeights` */
export function verge299(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'vergeGroup';
  const vg = lathe(rodProfile(0.02, -0.24, 0.78, 0.003, 0.003), 24);
  vg.rotateX(Math.PI / 2);
  const verge = mesh(vg, steel());
  verge.name = 'verge';
  g.add(verge);
  const mF = steel();
  const mB = steel();
  g.add(palletMesh(K.PAL_F, 0.55, 0.68, mF, 'palletFront'), palletMesh(K.PAL_B, -0.2, -0.05, mB, 'palletBack'));
  // 날개: 가로 막대(반투명) + 불투명 허브
  const fm = steel();
  fm.transparent = true;
  fm.opacity = 0.5;
  fm.depthWrite = false;
  const bar = mesh(new THREE.BoxGeometry(2.1, 0.04, 0.04), fm);
  bar.position.z = 0.75;
  bar.name = 'foliot';
  g.add(bar);
  const hubGeo = lathe(tubeProfile(0.019, 0.05, 0.7225, 0.78, 0.003), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 추 둘
  const wg: THREE.BufferGeometry[] = [];
  for (const sx of [-0.95, 0.95]) {
    const w = lathe(rodProfile(0.08, 0.72, 0.78, 0.004, 0.004), 40);
    w.rotateX(Math.PI / 2);
    w.translate(sx, 0, 0);
    wg.push(w);
  }
  const weights = mesh(merge(wg), brass());
  weights.name = 'foliotWeights';
  g.add(weights);
  const band = lathe(tubeProfile(0.0795, 0.0825, 0.735, 0.755), 40);
  band.rotateX(Math.PI / 2);
  band.translate(0.95, 0, 0);
  g.add(mesh(band, paint(0xd03020)));
  g.userData.matF = mF;
  g.userData.matB = mB;
  return g;
}

/** 세로축 받침 2(arborBrackets)·버지 뒤 받침·앞 받침. 세계 좌표 */
export function frame299(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'frame299';
  const brs: THREE.BufferGeometry[] = [];
  for (const [y0, y1] of [[0.26, 0.32], [0.97, 1.03]] as [number, number][]) {
    const b = plateHole(-0.05, 0.05, -0.05, 0.551, 0, 0, 0.037, y1 - y0);
    b.rotateX(-Math.PI / 2);
    b.translate(0, (y0 + y1) / 2, 0.25);
    brs.push(b);
  }
  const brackets = mesh(merge(brs), castIron());
  brackets.name = 'arborBrackets';
  g.add(brackets);
  // 뒤 받침: 막힌 구멍(깊이 0.022 — 버지 뒤끝 −0.24 와 0.002 틈)
  const slab = plateHole(-0.05, 0.05, 1.47, 1.57, 0, 1.52, 0.022, 0.022);
  slab.translate(0, 0, -0.231);
  const solid = new THREE.BoxGeometry(0.1, 0.1, 0.059);
  solid.translate(0, 1.52, -0.2715);
  const back = mesh(merge([slab, solid]), castIron());
  back.name = 'vergeBackBearing';
  g.add(back);
  // 앞 받침 ㄱ자 팔: 세로 기둥 + 가로대(버지가 꿰뚫음)
  const col = new THREE.BoxGeometry(0.1, 0.1, 1.021);
  col.translate(-0.55, 1.52, 0.2095);
  const cross = plateHole(-0.6, 0.05, 1.49, 1.55, 0, 1.52, 0.022, 0.03);
  cross.translate(0, 0, 0.705);
  const front = mesh(merge([col, cross]), castIron());
  front.name = 'vergeFrontBearing';
  g.add(front);
  return g;
}
