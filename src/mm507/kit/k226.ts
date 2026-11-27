// 226번 속도를 두 배로 하는 기어(차동 베벨 여섯) 전용 키트 — 틀 A(F 축에 고정), B 손잡이 축, 반지름 깃. 설계표 docs/mm507-sheets/226.md
import * as THREE from 'three';
import { paint, steel } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

export const K226 = {
  YF: 1.25,
  ZF: 0.27,
  R: 0.3,
  TEETH: 20,
  MOD: 0.03,
  O1: [0.75, 1.25, 0.27] as [number, number, number],
  O2: [-0.8, 1.25, 0.27] as [number, number, number],
  OMEGA: 0.35
};

const box = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(new THREE.BoxGeometry(w, h, d), steel());
  m.position.set(x, y, z);
  return m;
};
const cylX = (r: number, len: number, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 28).rotateZ(Math.PI / 2), steel());
  m.position.set(x, y, z);
  return m;
};

/** 틀 A(틀 좌표: 로컬 x = F 방향, 로컬 y = D 쪽, 로컬 z): 허브·위아래 막대·옆 막대·베어링 고리·팔·D 축과 머리 */
export function frame226(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylX(0.06, 0.3, 0, 0, 0));
  for (const s of [-1, 1]) {
    g.add(box(0.95, 0.05, 0.05, 0, 0, s * 0.425));
    g.add(box(0.05, 0.05, 0.3, s * 0.45, 0, s * 0.25));
    g.add(box(0.04, 0.04, 0.34, 0, 0, s * 0.23));
    const ringGeo = lathe(tubeProfile(0.058, 0.1, -0.025, 0.025, 0.006), 32);
    ringGeo.rotateZ(Math.PI / 2);
    const ring = mesh(ringGeo, steel());
    ring.position.set(s * 0.45, 0, 0);
    g.add(ring);
  }
  const axle = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 20), steel());
  axle.position.set(0, 0.24, 0);
  const head = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 20), steel());
  head.position.set(0, 0.4375, 0);
  g.add(axle, head);
  return g;
}

/** B 손잡이 묶음(그룹 로컬 y 위): 축 y 0.05~0.80, 원판 y 0.60(반지름 0.25), 꼭지, 노란 띠 */
export function handwheel226(): THREE.Group {
  const g = new THREE.Group();
  const axle = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 24), steel());
  axle.position.y = 0.425;
  const disc = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 40), steel());
  disc.position.y = 0.6;
  const knob = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 20), steel());
  knob.position.set(0.21, 0.68, 0);
  const stripe = mesh(new THREE.BoxGeometry(0.22, 0.006, 0.03), paint(0xf2b619));
  stripe.position.set(0.12, 0.623, 0);
  g.add(axle, disc, knob, stripe);
  return g;
}

/** 반지름 깃: 로컬 y 0.05 부터 len 만큼(가운데 y = 0.05 + len/2) */
export function flag226(len: number, color: number): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(0.04, len, 0.035), paint(color));
  m.position.y = 0.05 + len / 2;
  return m;
}
