// 219번 편심 크라운 기어 전용 키트 — 축에서 치우친 크라운 접시(이·테·바닥·T 살·표지·허브)와 상태 닫힌 식. 설계표 docs/mm507-sheets/219.md
import * as THREE from 'three';
import { brass, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { setMM } from './mm';

export const K219 = {
  S: [-0.55, 1.4, 0.3] as [number, number, number],
  M: 0.0165,
  N: 40,
  NP: 10,
  RC: 0.33,
  RP: 0.0825,
  E: 0.13,
  YP: 1.5031,
  PIN_X0: -0.22,
  OMEGA: 0.5
};

const TAU = Math.PI * 2;

/** 맞물림 점의 세로 축 S 에서의 거리 ρ(θ) */
export function rho219(theta: number): number {
  const s = K219.E * Math.sin(theta);
  return K219.E * Math.cos(theta) + Math.sqrt(K219.RC * K219.RC - s * s);
}

/** 크라운 접시 중심 방향과 피니언 반지름 선 사이 각 α(θ) */
export function alpha219(theta: number): number {
  return Math.atan2(-K219.E * Math.sin(theta), rho219(theta) - K219.E * Math.cos(theta));
}

/** 피니언 각 φp(θ) */
export function pinionAngle219(theta: number): number {
  return -Math.PI / 2 + (K219.N / K219.NP) * (theta - alpha219(theta));
}

/** 편심 크라운 접시. 로컬 z 위(rotation.x = −π/2 로 눕혀 쓴다), 원점 = 접시 중심 C, 허브는 (−0.13, 0) */
export function eccCrown219(): THREE.Group {
  const g = new THREE.Group();
  const { N, M, RC, E } = K219;
  const r1 = RC - 0.015;
  const r2 = RC + 0.015;
  const s = TAU / N;
  const hr = 0.28 * s;
  const ht = 0.1 * s;
  const z0 = -0.003;
  const hT = 1.75 * M;
  const pos: number[] = [];
  const quads: [number, number, number, number][] = [
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
    [4, 5, 6, 7]
  ];
  const pt = (r: number, a: number, z: number): number[] => [r * Math.cos(a), r * Math.sin(a), z];
  for (let j = 0; j < N; j++) {
    const c = j * s;
    const v = [
      pt(r1, c - hr, z0), pt(r2, c - hr, z0), pt(r2, c + hr, z0), pt(r1, c + hr, z0),
      pt(r1, c - ht, hT), pt(r2, c - ht, hT), pt(r2, c + ht, hT), pt(r1, c + ht, hT)
    ];
    for (const [a, b, d, e] of quads) {
      for (const k of [a, b, d, a, d, e]) pos.push(...v[k]!);
    }
  }
  const teethGeo = new THREE.BufferGeometry();
  teethGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  teethGeo.computeVertexNormals();
  const teeth = mesh(teethGeo, brass());
  teeth.name = 'crownTeeth';
  g.add(teeth);

  // 테 벽
  const wallGeo = lathe(tubeProfile(r1, r2, -0.1, 0, 0), 64);
  wallGeo.rotateX(Math.PI / 2);
  const wall = mesh(wallGeo, brass());
  wall.name = 'crownRim';
  g.add(wall);

  // 바닥 원판
  const floorGeo = lathe(rodProfile(0.355, -0.1, -0.07, 0.005, 0.005), 64);
  floorGeo.rotateX(Math.PI / 2);
  const floor = mesh(floorGeo, brass());
  floor.name = 'crownFloor';
  g.add(floor);

  // T자 살
  const bar1 = mesh(new THREE.BoxGeometry(0.6, 0.05, 0.04), brass());
  bar1.position.set(0, 0, -0.05);
  bar1.name = 'crownBar1';
  const bar2 = mesh(new THREE.BoxGeometry(0.05, 0.26, 0.04), brass());
  bar2.position.set(-E, -E, -0.05);
  bar2.name = 'crownBar2';
  g.add(bar1, bar2);

  // 표지: 접시 중심(빨강), 세로 축 자리(노랑)
  const cGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.004, 24);
  cGeo.rotateX(Math.PI / 2);
  const markC = mesh(cGeo, paint(0xd8362f));
  markC.position.set(0, 0, -0.028);
  markC.name = 'markC';
  const ringMat = paint(0xf2b619);
  ringMat.side = THREE.DoubleSide;
  const markS = mesh(new THREE.RingGeometry(0.03, 0.045, 32), ringMat);
  markS.position.set(-E, 0, -0.028);
  markS.name = 'markS';
  g.add(markC, markS);

  // 허브 (축 자리 S)
  const hGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 32);
  hGeo.rotateX(Math.PI / 2);
  const hub = mesh(hGeo, darkSteel());
  hub.position.set(-E, 0, -0.15);
  hub.name = 'crownHub';
  setMM(hub, { kind: 'gear', fn: 'eccCrown219', teeth: N, module: M, rp: RC, ecc: E });
  g.add(hub);
  return g;
}
