// 265 원뿔 마찰 변속 전용 키트 — 상수·닫힌 상태식·부품 (설계표 docs/mm507-sheets/265.md)
// 곧은 원뿔(축 X, 큰 끝 x −0.90) 윗선과 나란한 기운 축의 마찰 롤러가 s(0.20~1.00)를 오간다.
// 롤러 각속도 = 1.2·R(s)/0.16, R(s) = 0.48 − 0.242536·s — 적분은 닫힌 꼴.
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, rubber, steel, wood } from '../../models/materials';
import { lathe, merge, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { pulley } from './pulley';
import { rod } from './shaft';
import { setMM } from './mm';

const PI = Math.PI;
const V3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export const K265 = {
  YC: 1.05,
  ZC: 0.28,
  XL: -0.9,
  R_BIG: 0.48,
  R_SMALL: 0.18,
  LEN: 1.2,
  ALPHA: 0.244979,
  SIN: 0.242536,
  COS: 0.970143,
  R_ROLL: 0.16,
  C0: [-0.86119, 1.68522] as [number, number],
  G0: [-0.78843, 1.97627] as [number, number],
  OMEGA: 1.2
} as const;

export interface State265 {
  phiC: number;
  s: number;
  R: number;
  thetaR: number;
  rollerCenter: [number, number, number];
}

/** 닫힌 상태식 — 같은 t 면 항상 같은 자세 */
export function state265(t: number): State265 {
  const w = (PI * t) / 8;
  const s = 0.6 + 0.4 * Math.sin(w);
  const R = K265.R_BIG - K265.SIN * s;
  const thetaR = -7.5 * (0.334476 * t - 0.247042 * (1 - Math.cos(w)));
  return {
    phiC: K265.OMEGA * t,
    s,
    R,
    thetaR,
    rollerCenter: [K265.C0[0] + K265.COS * s, K265.C0[1] - K265.SIN * s, K265.ZC]
  };
}

/** 원뿔 드럼 묶음(원점 = 큰 끝면 중심, 축 X) */
export function cone265(): THREE.Group {
  const g = new THREE.Group();
  const cone = mesh(
    lathe(
      [
        [0.046, 0],
        [0.47, 0],
        [0.478, 0.008],
        [0.182, 1.192],
        [0.176, 1.2],
        [0.046, 1.2],
        [0.046, 0]
      ],
      96
    ).rotateZ(-PI / 2),
    brass()
  );
  cone.name = 'coneBody';
  g.add(cone);
  const axle = mesh(lathe(rodProfile(0.045, -0.63, 1.85, 0.004, 0.004), 32).rotateZ(-PI / 2), steel());
  axle.name = 'coneAxle';
  g.add(axle);
  const m1 = mesh(new THREE.BoxGeometry(0.006, 0.03, 0.1), paint(0xf2b619));
  m1.position.set(-0.003, 0.36, 0);
  const m2 = mesh(new THREE.BoxGeometry(0.006, 0.03, 0.1), paint(0xf2b619));
  m2.position.set(1.203, 0.13, 0);
  g.add(m1, m2);
  for (const [x0, x1] of [
    [-0.329, -0.29],
    [1.49, 1.529]
  ] as [number, number][]) {
    const ring = mesh(lathe(tubeProfile(0.044, 0.07, x0, x1, 0.003), 36).rotateZ(-PI / 2), darkSteel());
    ring.name = 'stopRing';
    g.add(ring);
  }
  // 손바퀴(구동)
  const wheel = new THREE.Group();
  wheel.name = 'driveWheel';
  wheel.position.x = -0.6;
  wheel.rotation.y = PI / 2;
  wheel.add(pulley(0.16, { flat: true, width: 0.05, spokes: 4, hub: 0.045, driver: true }));
  g.add(wheel);
  const hRod = rod(V3(-0.62, 0.12, 0), V3(-0.75, 0.12, 0), 0.016);
  hRod.name = 'handleRod';
  const knob = mesh(new THREE.SphereGeometry(0.026, 20, 14), wood());
  knob.name = 'handleKnob';
  knob.position.set(-0.75, 0.12, 0);
  g.add(hRod, knob);
  setMM(g, { kind: 'cam', fn: 'cone265', axis: 'x' });
  return g;
}

/** 마찰 롤러(원점 = 롤러 중심, 축 X) */
export function roller265(): THREE.Group {
  const g = new THREE.Group();
  const tire = mesh(lathe(tubeProfile(0.11, 0.16, -0.025, 0.025, 0.004), 72).rotateZ(-PI / 2), rubber());
  tire.name = 'rollerTire';
  const disk = mesh(lathe(tubeProfile(0.049, 0.112, -0.01, 0.01, 0.002), 48).rotateZ(-PI / 2), steel());
  disk.name = 'rollerDisk';
  const hubProf: [number, number][] = [
    [0.031, -0.025],
    [0.05, -0.025],
    [0.05, 0.045],
    [0.06, 0.045],
    [0.06, 0.055],
    [0.04, 0.055],
    [0.04, 0.075],
    [0.06, 0.075],
    [0.06, 0.085],
    [0.05, 0.085],
    [0.05, 0.095],
    [0.031, 0.095],
    [0.031, -0.025]
  ];
  const hub = mesh(lathe(hubProf, 48).rotateZ(-PI / 2), darkSteel());
  hub.name = 'rollerHub';
  const mk = mesh(new THREE.BoxGeometry(0.004, 0.03, 0.03), paint(0xf2b619));
  mk.position.set(0.012, 0.08, 0);
  g.add(tire, disk, hub, mk);
  return g;
}

/** 옮김 막대 묶음. 안쪽 'guideFrame' 이 G0 에 놓여 로컬 +X = g(포크를 여기에 단다) */
export function guide265(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'guideRod';
  const f = new THREE.Group();
  f.name = 'guideFrame';
  f.position.set(K265.G0[0], K265.G0[1], K265.ZC);
  f.rotation.z = -K265.ALPHA;
  g.add(f);
  const bar = mesh(lathe(rodProfile(0.022, -0.3, 1.55, 0.003, 0.003), 28).rotateZ(-PI / 2), steel());
  bar.name = 'guideBar';
  f.add(bar);
  for (const x of [-0.25, 1.48]) {
    const blk = mesh(new THREE.BoxGeometry(0.06, 0.08, 0.08), castIron());
    blk.position.set(x, 0, 0);
    f.add(blk);
  }
  // 뒤판 팔·벽판·볼트(세계 좌표)
  for (const [x, y] of [
    [-1.031, 2.037],
    [0.6474, 1.6173]
  ] as [number, number][]) {
    const arm = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.52), castIron());
    arm.position.set(x, y, -0.02);
    const plate = mesh(new THREE.BoxGeometry(0.14, 0.14, 0.03), castIron());
    plate.position.set(x, y, -0.285);
    g.add(arm, plate);
    for (const sx of [-1, 1]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16).rotateX(PI / 2), darkSteel());
      bolt.position.set(x + sx * 0.045, y + sx * 0.045, -0.26);
      g.add(bolt);
    }
  }
  return g;
}

/** 옮김 쇠·손잡이·포크(옮김 막대 그룹 안의 로컬 좌표, 원점 = 막대 위 자리) */
export function fork265(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'shiftFork';
  const geos: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number): void => {
    geos.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  };
  box(0.1, 0.07, 0.07, 0, 0, 0); // 미끄럼 쇠
  box(0.012, 0.185, 0.03, 0, -0.1275, 0); // 팔
  box(0.012, 0.02, 0.114, 0, -0.23, 0); // 가로대
  box(0.012, 0.07, 0.012, 0, -0.275, 0.048); // 갈래
  box(0.012, 0.07, 0.012, 0, -0.275, -0.048);
  g.add(mesh(merge(geos), darkSteel()));
  const stick = mesh(lathe(rodProfile(0.012, 0.035, 0.115, 0, 0), 16), wood());
  stick.name = 'forkStick';
  const knob = mesh(new THREE.SphereGeometry(0.025, 20, 14), wood());
  knob.position.set(0, 0.14, 0);
  g.add(stick, knob);
  return g;
}
