// 264 이 수가 하나 다른 웜휠 전용 키트 — 상수·상태식·바늘 (설계표 docs/mm507-sheets/264.md)
// 웜 피치는 두 휠(30·31 개) 원주 피치의 가운데(30.5 몫), 이 틈(백래시)으로 물린다.
import * as THREE from 'three';
import { paint } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

export const K264 = {
  O: [0, 1.3], // 휠 축 (x, y)
  WORM_Y: 2.02, // 웜 축 높이 (휠 축 + 0.72)
  ZW: 0.05, // 웜 축 깊이
  Z1: 30, // 앞 휠(30) 잇수
  Z2: 31, // 뒤 휠(31) 잇수
  RP: 0.6, // 휠 피치 반지름(둘 다 같은 지름)
  PITCH: 0.123604, // 웜 피치 = 2π·0.60/30.5
  TAN_LEAD: -0.18033, // 휠 이 비틀림(오른나사 웜, 웜이 휠 위)
  C1: 1.484168, // 휠 30 위상 상수
  C2: 1.459364, // 휠 31 위상 상수
  OMEGA: 12.566 // 웜 각속도 rad/s (2 바퀴/s)
} as const;

export interface State264 {
  theta: number; // 웜 각(rad)
  phi1: number; // 휠 30 각 = θ/30 + C1
  phi2: number; // 휠 31 각 = θ/31 + C2
  diffDeg: number; // 두 바늘 차이 Δ = θ/930 (도)
}

/** 닫힌 상태식 — 같은 t 면 항상 같은 자세(역회전·seek 안전) */
export function state264(t: number): State264 {
  const theta = K264.OMEGA * t;
  const phi1 = theta / K264.Z1 + K264.C1;
  const phi2 = theta / K264.Z2 + K264.C2;
  const diffDeg = ((theta / (K264.Z1 * K264.Z2)) * 180) / Math.PI;
  return { theta, phi1, phi2, diffDeg };
}

/**
 * 바늘: 허브 고리 + 바늘 막대 + 꼬리(로컬 +X 가 바늘 끝).
 * z0·z1 = 허브 고리의 z 범위(부모 그룹 로컬), 막대·꼬리 z = 가운데. rOut 은 선택(기본 rIn+0.03).
 */
export function needle264(len: number, color: number, z0: number, z1: number, rIn: number, rOut = rIn + 0.03): THREE.Group {
  const g = new THREE.Group();
  const mat = paint(color);
  // 허브 고리(축 위 관)
  const hubGeo = lathe(tubeProfile(rIn, rOut, z0, z1, 0.002), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, mat));
  const zm = (z0 + z1) / 2;
  // 바늘 막대: 로컬 x 0.065 ~ 0.065+len
  const bar = mesh(new THREE.BoxGeometry(len, 0.026, 0.012), mat);
  bar.position.set(0.065 + len / 2, 0, zm);
  g.add(bar);
  // 꼬리: 로컬 x −0.18 ~ −0.06
  const tail = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.012), mat);
  tail.position.set(-0.12, 0, zm);
  g.add(tail);
  return g;
}
