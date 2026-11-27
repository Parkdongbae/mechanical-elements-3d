// 295번 원통 탈진기(확대) — 294 와 같은 접촉 식·같은 각, 크기만 1.6 배. 설계표 docs/mm507-sheets/295.md
// 계산·부품 만드는 법은 k294 의 공용 함수(escContact·escState·buildEscWheel·buildEscCylinder)를 설정만 바꿔 쓴다.
import * as THREE from 'three';
import type { V2 } from './belt';
import { buildEscCylinder, buildEscWheel, escContact, escState, type CylLayers, type EscCfg, type EscState } from './k294';

export const K295 = {
  S: 1.6,
  WC: [0, 1.57] as V2,
  C: [0, 3.058] as V2,
  Z: 12,
  PITCH: 30,
  TH0: 96,
  RP: 1.432,
  RH: 1.544,
  RB: 1.4128,
  DEL: 9.8,
  RO: 0.184,
  RI: 0.152,
  SHELL: 192,
  BEV: 15,
  PASS: 90,
  AMP: 110,
  T1: 0.577069,
  T2: 1.555028,
  /** 표 기대값 [t, ψ, φ] */
  EXPECT: [
    [0, 110, 0.8837],
    [0.48, 6.907, 0.1521],
    [0.5, 0, -2.0072],
    [0.55, -17.208, -6.8374],
    [0.56, -20.612, -7.7212],
    [0.58, -27.356, -11.5486],
    [1.0, -110, -11.5486],
    [1.46, -13.787, -14.7322],
    [1.5, 0, -18.0325],
    [1.55, 17.208, -20.9247],
    [1.56, 20.612, -29.1163],
    [2.0, 110, -29.1163],
    [30, 110, -449.1163]
  ] as [number, number, number][]
} as const;

export const CFG295: EscCfg = {
  WC: K295.WC,
  C: K295.C,
  RP: K295.RP,
  RH: K295.RH,
  RB: K295.RB,
  RO: K295.RO,
  RI: K295.RI,
  RIM: [1.056, 1.248],
  STEM: [1.216, 1.4192],
  STEMW: 0.0192,
  ZW: [0, 0.04],
  ZT: [0.038, 0.1],
  ZCOL: [0.038, 0.11],
  BAR: { R: 0.6, z0: -0.19, z1: -0.08 },
  T1: K295.T1,
  T2: K295.T2
};

const LAYERS295: CylLayers = {
  cap: [-0.2, -0.12],
  capSeparate: true,
  tube1: null,
  pass: [-0.12, 0.045],
  shell: [0.045, 0.11],
  tube2: null,
  front: null,
  pivot: null
};

export function cylWheel295(): THREE.Group {
  return buildEscWheel(CFG295, 'dots');
}
export function cylinder295(): THREE.Group {
  return buildEscCylinder(CFG295, LAYERS295);
}
export function contact295(phase: 'O' | 'I', k: number, psi: number): number | null {
  const r = escContact(CFG295, phase, k, psi);
  return r === null ? null : r.phi;
}
export function state295(t: number): EscState {
  return escState(CFG295, t);
}
