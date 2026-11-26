// 209번 타원 구름 접촉 전용 키트 — 초점 타원 기어 한 쌍(반쪽에만 이), 갈래 걸쇠, 상태 닫힌 식. 설계표 docs/mm507-sheets/209.md
import * as THREE from 'three';
import { bronze, brass, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { ellipsePitch, pitchRoll } from './gear2';
import { setMM } from './mm';

export const PIT209 = ellipsePitch(0.8, 0.6);
const PL = PIT209.L;
const PP = PL / 40;
const HA = PP / Math.PI;
const HF = 1.2 * HA;
const TP = 0.23;
const T20 = Math.tan((20 * Math.PI) / 180);
const UT = TP - (HA * T20) / PP;
const UR = TP + (HF * T20) / PP;

export const K209 = {
  O1: [-0.8, 1.85] as [number, number],
  O2: [0.8, 1.85] as [number, number],
  A: 0.8,
  E: 0.6,
  PL,
  PP,
  ha: HA,
  hf: HF,
  tp: TP,
  ut: UT,
  ur: UR,
  zG: 0.11, // 기어 가운데 z
  wG: 0.12, // 기어 폭
  bore: 0.048, // 축 구멍(축 반지름 0.045 + 틈 0.003)
  hubR: 0.1,
  pinR: 0.03,
  pinX: 1.28,
  forkZ0: 0.19,
  forkZ1: 0.25,
  W1: 0.8,
  TH0: 1.1484,
  fork: [
    [-0.476, 0.275], [-0.451, 0.315], [-0.421, 0.354], [-0.389, 0.389], [-0.354, 0.421], [-0.315, 0.451], [-0.275, 0.476], [-0.232, 0.498],
    [-0.188, 0.517], [-0.142, 0.531], [-0.031, 0.116], [-0.06, 0.104], [-0.085, 0.085], [-0.098, 0.069], [-0.109, 0.051], [-0.118, 0.021],
    [-0.12, 0], [-0.118, -0.021], [-0.113, -0.041], [-0.104, -0.06], [-0.085, -0.085], [-0.069, -0.098], [-0.051, -0.109], [-0.031, -0.116],
    [-0.142, -0.531], [-0.188, -0.517], [-0.232, -0.498], [-0.275, -0.476], [-0.315, -0.451], [-0.354, -0.421], [-0.389, -0.389],
    [-0.421, -0.354], [-0.451, -0.315], [-0.476, -0.275], [-0.498, -0.233], [-0.293, -0.027], [-0.285, -0.014], [-0.282, 0], [-0.285, 0.014],
    [-0.293, 0.027], [-0.498, 0.233]
  ] as V2[],
  posts: [[-0.156, 0.09], [-0.18, 0], [-0.156, -0.09]] as V2[]
};

/** 이 모양 h_t(u): u = 이 중심에서의 거리/PP (|u| ≤ 0.5) */
export function toothH209(u: number): number {
  const a = Math.abs(u);
  if (a <= UT) return HA;
  if (a <= TP) return (HA * (TP - a)) / (TP - UT);
  if (a <= UR) return (-HF * (a - TP)) / (UR - TP);
  return -HF;
}

type Rng = [number, number];
const inR = (s: number, r: Rng): boolean => (s >= r[0] && s <= r[1]) || (s - PL >= r[0] && s - PL <= r[1]);

/** 부분 이 윤곽(축 원점, 반시계). full 구간은 이, bands 구간은 이뿌리쪽(h ≤ 0)만, 그 밖은 매끈한 피치선 */
export function partialOutline209(s0: number, full: Rng, bands: Rng[]): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < 960; k++) {
    const s = (PL * k) / 960;
    let d = (s - s0) / PP;
    d -= Math.round(d);
    const ht = toothH209(d);
    let h = 0;
    if (inR(s, full)) h = ht;
    else if (bands.some((b) => inR(s, b))) h = Math.min(ht, 0);
    const phi = PIT209.phiAtS(s);
    const q = PIT209.pt(phi);
    const n = PIT209.normal(phi);
    out.push([q[0] + h * n[0], q[1] + h * n[1]]);
  }
  return out;
}

const OUT_L = (): V2[] => partialOutline209(0, [-0.5 * PP, 20.5 * PP], [[-1.0 * PP, -0.5 * PP], [20.5 * PP, 21.0 * PP]]);
const OUT_R = (): V2[] => partialOutline209(0.5 * PP, [0, 20 * PP], [[-0.5 * PP, 0], [20 * PP, 20.5 * PP]]);

/** 매끈한 구간(s 범위) 앞면 가장자리의 짙은 띠: 바깥 = 피치선, 안쪽 = 0.03 안 */
function smoothBand(sa: number, sb: number, width = 0.03): THREE.BufferGeometry {
  const n = 120;
  const outer: V2[] = [];
  const inner: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const phi = PIT209.phiAtS(sa + ((sb - sa) * i) / n);
    const q = PIT209.pt(phi);
    const nn = PIT209.normal(phi);
    outer.push([q[0], q[1]]);
    inner.push([q[0] - nn[0] * width, q[1] - nn[1] * width]);
  }
  return extrude(shapeFrom([...outer, ...inner.reverse()]), 0.002, 0, 4);
}

/** 판·허브·짙은 띠·노란 표지. 그룹 원점 = 축, 로컬 z 0 = 기어 가운데(z 0.11). userData.outline 남김 */
export function ellipseGear209(side: 'L' | 'R'): THREE.Group {
  const g = new THREE.Group();
  const outline = side === 'L' ? OUT_L() : OUT_R();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, K209.bore));
  g.add(mesh(extrude(shape, K209.wG, 0.008, 4), side === 'L' ? bronze({ roughness: 0.34 }) : brass()));
  // 허브: z 0.03 ~ 0.19 → 로컬 −0.08 ~ +0.08
  const hubGeo = lathe(tubeProfile(K209.bore, K209.hubR, -0.08, 0.08, 0.008), 36);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, steel()));
  // 매끈한 반쪽의 짙은 띠(앞면 z 0.17 위)
  const sm: Rng = side === 'L' ? [21 * PP, 39 * PP] : [20.5 * PP, 39.5 * PP];
  const band = mesh(smoothBand(sm[0], sm[1]), darkSteel());
  band.position.z = K209.wG / 2 + 0.001;
  g.add(band);
  // 노란 표지 막대(φ = 0 방향, 반지름 0.12 ~ 0.42)
  const mk = mesh(new THREE.BoxGeometry(0.3, 0.035, 0.002), paint(0xf2b619));
  mk.position.set(0.27, 0, K209.wG / 2 + 0.003);
  g.add(mk);
  g.userData.outline = outline;
  setMM(g, {
    kind: 'gear',
    fn: 'ellipticalGear',
    teeth: side === 'L' ? 21 : 20,
    module: HA,
    internal: false,
    noncircular: true,
    rMin: PIT209.rMin,
    rMax: PIT209.rMax,
    pitchLength: PL,
    width: K209.wG,
    axis: 'z'
  });
  return g;
}

/** 안내 핀: 왼쪽 기어 로컬 (1.28, 0), z 0.17 ~ 0.26. 소속 그룹 원점 = 축(z 0) */
export function guidePin209(): THREE.Mesh {
  const geo = lathe([[0, 0], [K209.pinR - 0.004, 0], [K209.pinR, 0.004], [K209.pinR, 0.09 - 0.004], [K209.pinR - 0.005, 0.09], [0, 0.09]], 24);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, steel());
  m.position.set(K209.pinX, 0, 0.17);
  return m;
}

/** 갈래 걸쇠(오른쪽 기어 로컬 좌표, z 0.19 ~ 0.25) + 받침 기둥 3개. 그룹 원점 = 축(z 0) */
export function fork209(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'forkR';
  const pts = K209.fork.map((p) => [p[0], p[1]] as V2);
  const plate = mesh(extrude(shapeFrom(pts), K209.forkZ1 - K209.forkZ0, 0.004, 4), darkSteel());
  plate.position.z = (K209.forkZ0 + K209.forkZ1) / 2;
  g.add(plate);
  for (const [x, y] of K209.posts) {
    const geo = lathe([[0, 0], [0.02, 0], [0.02, 0.02], [0, 0.02]], 16);
    geo.rotateX(Math.PI / 2);
    const p = mesh(geo, steel());
    p.position.set(x, y, 0.17);
    g.add(p);
  }
  g.userData.outlines = { forkSlot: pts }; // 걸쇠는 기어 앞 다른 층 — userData.outline 이면 autocheck 다각형 침범이 거짓 불합격(같은 평면으로 봄)
  return g;
}

export interface State209 {
  th1: number;
  th2: number;
  r1: number;
  ratio: number;
  toothed: boolean;
}
export function state209(t: number): State209 {
  const th1 = K209.TH0 - K209.W1 * t;
  const th2 = pitchRoll(PIT209, th1, PL / 2);
  const r1 = PIT209.r(-th1);
  const r2 = 2 * K209.A - r1;
  const s1 = ((PIT209.S(-th1) % PL) + PL) % PL;
  return { th1, th2, r1, ratio: r1 / r2, toothed: s1 <= PL / 2 };
}
