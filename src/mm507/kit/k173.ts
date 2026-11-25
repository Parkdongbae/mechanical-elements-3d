// 번호 전용 키트 (507 · 173번) — 나사로 바뀌는 왕복 거리: 간헐 걸음 식, 태핏 바퀴, 홈 막대, 안내 슬리브
import * as THREE from 'three';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { extrude, mesh, roundedRect, stadiumShape } from '../../models/parts/geom';
import { setMM } from './mm';

export const K173 = {
  C: [-0.85, 1.7] as [number, number],
  beta0: (30.4 * Math.PI) / 180,
  discR: 1.03,
  rho0: 0.28,
  stepLen: 0.06,
  pitch: 0.24,
  zAxis: 0.2,
  wheelRho: 1.22,
  barZ: 0.405,
  barL: 2.45,
  slotHalf: 0.62,
  slotW: 0.046,
  studR: 0.035,
  win: 0.06
} as const;

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface Step173 {
  tri: number;
  rho: number;
  phiS: number;
}

/** 원판 각 theta → 나사 걸음(삼각파 0→4→0, 8바퀴 주기). 태핏 창은 원판이 한 바퀴 돌 때 θ = 2πn 근처 ±0.06 바퀴 */
export function step173(theta: number): Step173 {
  const u = theta / (2 * Math.PI) + K173.win;
  const m = Math.floor(u);
  const s = m + smooth((u - m) / (2 * K173.win));
  const k = ((s % 8) + 8) % 8;
  const tri = k <= 4 ? k : 8 - k;
  return { tri, rho: -(K173.rho0 + K173.stepLen * tri), phiS: -(Math.PI / 2) * tri };
}

/** 태핏 바퀴: 4날(한 걸음 = 1/4 바퀴). 회전축 = 로컬 X, 원점 중심 */
export function tappetWheel173(): THREE.Group {
  const g = new THREE.Group();
  const cyl = new THREE.CylinderGeometry(0.12, 0.12, 0.07, 32);
  cyl.rotateZ(Math.PI / 2);
  g.add(mesh(cyl, brass()));
  for (let i = 0; i < 4; i++) {
    const b = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.05), brass());
    const a = (i * Math.PI) / 2;
    b.position.set(0, Math.cos(a) * 0.145, Math.sin(a) * 0.145);
    b.rotation.x = -a;
    g.add(b);
  }
  setMM(g, { kind: 'wheel', r: 0.17, axis: 'x' });
  return g;
}

/** 홈 막대: 머리판(세로 홈) + 가로 팔. 원점 = 홈 가운데, 팔은 +X. z 가운데 0 */
export function slottedBar173(): THREE.Group {
  const g = new THREE.Group();
  const head = roundedRect(-0.12, -0.775, 0.12, 0.775, 0.06);
  const slot = stadiumShape(0, -K173.slotHalf + K173.slotW, 0, K173.slotHalf - K173.slotW, K173.slotW);
  head.holes.push(new THREE.Path(slot.getPoints(24)));
  g.add(mesh(extrude(head, 0.05, 0.004), steel()));
  const arm = mesh(new THREE.BoxGeometry(K173.barL - 0.05, 0.08, 0.05), steel());
  arm.position.set(0.05 + (K173.barL - 0.05) / 2, 0, 0);
  g.add(arm);
  setMM(g, { kind: 'rod', length: K173.barL });
  return g;
}

/** 안내 슬리브: 팔이 지나는 사각 구멍 틀. X 방향 관통, 길이 0.45. 원점 = 중심 */
export function sleeve173(): THREE.Group {
  const g = new THREE.Group();
  const s = roundedRect(-0.075, -0.1, 0.075, 0.1, 0.01);
  s.holes.push(new THREE.Path(roundedRect(-0.03, -0.045, 0.03, 0.045, 0.002).getPoints(8)));
  const geo = extrude(s, 0.45, 0.004);
  geo.rotateY(Math.PI / 2);
  g.add(mesh(geo, castIron()));
  setMM(g, { kind: 'guide' });
  return g;
}

export function boxAt173(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = darkSteel()): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
