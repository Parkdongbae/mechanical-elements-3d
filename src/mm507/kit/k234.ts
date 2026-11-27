// 234번 버지 탈진기 전용 키트 — 크라운 휠(곡면 톱날 13개), 스핀들·팔레트 둘·흔들이 막대, 기둥 둘·태엽 상자, 한 주기 표. 설계표 docs/mm507-sheets/234.md
import * as THREE from 'three';
import { brass, paint, steel } from '../../models/materials';
import { extrude, hexPrism, lathe, mesh, rodProfile, roundedRect, tubeProfile } from '../../models/parts/geom';
import { annularSector } from '../../models/parts/geom';

export const D2R = Math.PI / 180;

/** 크라운 휠 한 주기 f(τ) 표(도) — 0.02 초 간격 100 값 */
const F234: number[] = [0.000, 1.300, 11.646, 10.646, 9.746, 8.946, 8.146, 7.446, 6.846, 6.246, 5.746, 5.246, 4.746, 4.346, 3.946, 3.646, 3.346, 3.046, 2.746, 2.546, 2.346, 2.246, 2.146, 2.046, 1.946, 1.946, 1.946, 2.046, 2.146, 2.246, 2.346, 2.546, 2.746, 3.046, 3.346, 3.646, 3.946, 4.346, 4.746, 5.246, 5.746, 6.246, 6.846, 7.446, 8.146, 8.846, 9.746, 10.646, 11.546, 12.646, 13.846, 15.146, 25.492, 24.492, 23.592, 22.792, 21.992, 21.292, 20.692, 20.092, 19.592, 19.092, 18.592, 18.192, 17.792, 17.492, 17.192, 16.892, 16.592, 16.392, 16.192, 16.092, 15.992, 15.892, 15.792, 15.792, 15.792, 15.892, 15.992, 16.092, 16.192, 16.392, 16.592, 16.892, 17.192, 17.492, 17.792, 18.192, 18.592, 19.092, 19.592, 20.092, 20.692, 21.292, 21.992, 22.692, 23.592, 24.492, 25.392, 26.492];

export const K234 = {
  /** 장치 묶음 위치·회전(세계) */
  POS: [-0.05, 0, 0.27] as [number, number, number],
  ROT_Y: -20 * D2R,
  /** 크라운 휠 */
  N: 13,
  P: 360 / 13,
  P_STEP: 27.6923,
  R_IN: 0.465,
  R_OUT: 0.495,
  TOOTH_H: 0.12,
  Y_PLATE0: 1.0,
  Y_PLATE1: 1.05,
  Y_RIM1: 1.1,
  Y_TIP: 1.22,
  /** 스핀들 */
  Y_SPIN: 1.32,
  SPIN_X0: -0.9,
  SPIN_X1: 0.76,
  R_SPIN: 0.025,
  /** 팔레트 */
  PALLET_X: 0.48,
  PALLET_W: 0.12,
  PALLET_L: 0.17,
  PALLET_T: 0.025,
  PALLET_ANG: 50 * D2R,
  /** 기둥 */
  POST_X: 0.72,
  /** 흔들이 막대 */
  FOLIOT_X: -0.86,
  /** 구동 */
  SIGMA_AMP: 40,
  PERIOD: 2,
  PHI0: 13.9,
  F: F234,
  DROP_DIFF: 3,
  /** 막는 팔레트가 바뀌는 τ */
  SWAP_A: 0.03,
  SWAP_B: 1.03
} as const;
const K = K234;

const TAU = Math.PI * 2;

/** 크라운 휠 각 f(τ) — 이웃 차가 3° 넘는 칸은 보간하지 않고 칸 가운데에서 뒷값으로, 나머지는 선형 */
function fOf(tau: number): number {
  const f = K.F;
  const n = f.length;
  const u = tau / 0.02;
  let i = Math.floor(u + 1e-9);
  if (i >= n) i = n - 1;
  const frac = u - i;
  const a = f[i]!;
  const b = i + 1 < n ? f[i + 1]! : K.P_STEP;
  if (Math.abs(b - a) > K.DROP_DIFF) return frac < 0.5 ? a : b;
  return a + (b - a) * frac;
}

export interface State234 {
  sigma: number;
  phi: number;
  holder: 'pallet1' | 'pallet2';
  justDropped: boolean;
}

export function state234(t: number): State234 {
  const sigma = K.SIGMA_AMP * Math.sin(Math.PI * t);
  const k = Math.floor(t / K.PERIOD + 1e-12);
  const tau = t - k * K.PERIOD;
  const phi = K.PHI0 + fOf(tau) + K.P_STEP * k;
  const holder = tau >= K.SWAP_A && tau < K.SWAP_B ? 'pallet2' : 'pallet1';
  const justDropped = (tau >= K.SWAP_A && tau < K.SWAP_A + 0.1) || (tau >= K.SWAP_B && tau < K.SWAP_B + 0.1);
  return { sigma, phi, holder, justDropped };
}

// ───────────────────────── 크라운 휠 ─────────────────────────

/** 톱날 13개 — 면마다 따로 꼭짓점을 두어 곧은 면·비탈이 각져 보이게 */
function teethGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const p = (K.P * D2R);
  const SEG = 8;
  const ya = K.Y_RIM1;
  const pt = (r: number, a: number, y: number): THREE.Vector3 => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
  /** 바깥 방향 ref 쪽을 보게 감아서 세 점 삼각형 두 장을 넣는다 */
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ref: THREE.Vector3): void => {
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.dot(ref) < 0) {
      const tmp = b;
      b = d;
      d = tmp;
    }
    for (const v of [a, b, c, a, c, d]) pos.push(v.x, v.y, v.z);
  };
  for (let k = 0; k < K.N; k++) {
    const a0 = (k - 1) * p + 0.15 * p;
    const a1 = k * p;
    for (let i = 0; i < SEG; i++) {
      const u0 = i / SEG;
      const u1 = (i + 1) / SEG;
      const t0 = a0 + (a1 - a0) * u0;
      const t1 = a0 + (a1 - a0) * u1;
      const h0 = K.TOOTH_H * u0;
      const h1 = K.TOOTH_H * u1;
      if (h1 <= 0) continue;
      const im = (t0 + t1) / 2;
      // 윗면(비탈)
      quad(pt(K.R_IN, t0, ya + h0), pt(K.R_OUT, t0, ya + h0), pt(K.R_OUT, t1, ya + h1), pt(K.R_IN, t1, ya + h1), new THREE.Vector3(0, 1, 0));
      // 안쪽·바깥쪽 옆벽(사다리꼴)
      quad(pt(K.R_IN, t0, ya), pt(K.R_IN, t1, ya), pt(K.R_IN, t1, ya + h1), pt(K.R_IN, t0, ya + h0), new THREE.Vector3(-Math.cos(im), 0, -Math.sin(im)));
      quad(pt(K.R_OUT, t0, ya), pt(K.R_OUT, t1, ya), pt(K.R_OUT, t1, ya + h1), pt(K.R_OUT, t0, ya + h0), new THREE.Vector3(Math.cos(im), 0, Math.sin(im)));
    }
    // 곧은 면(+α 쪽, 도는 쪽 앞)
    quad(pt(K.R_IN, a1, ya), pt(K.R_OUT, a1, ya), pt(K.R_OUT, a1, K.Y_TIP), pt(K.R_IN, a1, K.Y_TIP), new THREE.Vector3(-Math.sin(a1), 0, Math.cos(a1)));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** 크라운 휠 + 축 + 너트. 원점 = 휠 축, 회전축 = 로컬 Y. name `crown` */
export function crown234(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'crown';
  const mat = brass();
  // ① 판 — 구멍 6개
  const shape = new THREE.Shape();
  shape.absarc(0, 0, K.R_OUT, 0, TAU, false);
  for (let j = 0; j < 6; j++) {
    const a = (j * TAU) / 6;
    const h = new THREE.Path();
    h.absarc(0.28 * Math.cos(a), 0.28 * Math.sin(a), 0.07, 0, TAU, true);
    shape.holes.push(h);
  }
  const plateGeo = extrude(shape, K.Y_PLATE1 - K.Y_PLATE0, 0.004, 48);
  plateGeo.rotateX(Math.PI / 2);
  const plate = mesh(plateGeo, mat);
  plate.position.y = (K.Y_PLATE0 + K.Y_PLATE1) / 2;
  g.add(plate);
  // ② 테
  const rim = mesh(lathe(tubeProfile(K.R_IN, K.R_OUT, K.Y_PLATE1, K.Y_RIM1), 96), mat);
  g.add(rim);
  // ③ 톱날
  const teeth = mesh(teethGeometry(), mat);
  (teeth.material as THREE.Material).side = THREE.DoubleSide;
  g.add(teeth);
  // 축(태엽 상자 윗면에서 판 위 너트까지)과 너트
  const axle = mesh(lathe(rodProfile(0.03, 0.42, 1.08), 32), steel());
  g.add(axle);
  const nut = mesh(hexPrism(0.09, 0.03, true, true, 0), steel());
  nut.position.y = 1.065;
  g.add(nut);
  g.userData.mat = mat;
  return g;
}

// ───────────────────────── 스핀들·팔레트·흔들이 막대 ─────────────────────────

/** Y 축 원기둥(lathe)을 X 축으로 눕힌다 — x0~x1 */
function cylX(r: number, x0: number, x1: number, c = 0): THREE.BufferGeometry {
  const geo = lathe(rodProfile(r, x0, x1, c, c), 32);
  geo.rotateZ(-Math.PI / 2);
  return geo;
}

/** 스핀들 묶음(원점 = 스핀들 축 위 x 0, 높이 Y_SPIN). name `spindle` — 모델이 rotation.x = −σ 를 준다 */
export function spindle234(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'spindle';
  g.position.set(0, K.Y_SPIN, 0);
  g.add(mesh(cylX(K.R_SPIN, K.SPIN_X0, K.SPIN_X1, 0.006), steel()));
  // 오른쪽 끝 칼라(눈에서 빠지지 않게)
  g.add(mesh(cylX(0.04, K.POST_X + 0.012 + 0.003, K.SPIN_X1, 0.004), steel()));
  // 팔레트 둘
  const mats: THREE.Material[] = [];
  for (const side of [1, -1]) {
    const grp = new THREE.Group();
    grp.name = side > 0 ? 'pallet1' : 'pallet2';
    grp.rotation.x = -side * K.PALLET_ANG;
    const m = steel();
    mats.push(m);
    const plateGeo = extrude(roundedRect(-K.PALLET_W / 2, -K.PALLET_L / 2, K.PALLET_W / 2, K.PALLET_L / 2, 0.006), K.PALLET_T, 0.003, 6);
    const plate = mesh(plateGeo, m);
    plate.position.set(side * K.PALLET_X, -K.PALLET_L / 2, side * (K.PALLET_T / 2));
    grp.add(plate);
    g.add(grp);
  }
  // 흔들이 막대(폴리오트)
  const fol = new THREE.Group();
  fol.name = 'foliot';
  const bm = brass();
  fol.add(mesh(cylX(0.04, K.FOLIOT_X - 0.025, K.FOLIOT_X + 0.025, 0.004), bm));
  const bar = mesh(new THREE.BoxGeometry(0.03, 0.52, 0.03), bm);
  bar.position.set(K.FOLIOT_X, 0, 0);
  fol.add(bar);
  for (const s of [1, -1]) {
    const ball = mesh(new THREE.SphereGeometry(0.045, 24, 16), bm);
    ball.position.set(K.FOLIOT_X, s * 0.26, 0);
    fol.add(ball);
  }
  g.add(fol);
  g.userData.pallet1Mat = mats[0];
  g.userData.pallet2Mat = mats[1];
  return g;
}

// ───────────────────────── 기둥·태엽 상자 ─────────────────────────

/** 고정 부품 묶음: 기둥 둘(눈 포함)·태엽 상자. 원점 = 휠 축과 받침대 윗면 아래 연장선 */
export function frame234(): THREE.Group {
  const g = new THREE.Group();
  // 태엽 상자
  const barrel = new THREE.Group();
  barrel.name = 'barrel';
  barrel.add(mesh(lathe(rodProfile(0.18, 0.18, 0.42, 0.006, 0.006), 64), steel()));
  const spiralMat = paint(0x8a6d1e);
  for (const [r0, r1] of [
    [0.085, 0.1],
    [0.13, 0.145]
  ] as const) {
    const geo = extrude(annularSector(r0, r1, 0, 1.5 * Math.PI), 0.004, 0, 24);
    geo.rotateX(Math.PI / 2);
    const m = mesh(geo, spiralMat);
    m.position.y = 0.42 + 0.002;
    barrel.add(m);
  }
  g.add(barrel);
  // 기둥 둘
  for (const [name, sx] of [
    ['postL', -1],
    ['postR', 1]
  ] as const) {
    const post = new THREE.Group();
    post.name = name;
    post.add(mesh(lathe(rodProfile(0.035, 0.18, 1.29, 0.004, 0), 32), steel()));
    const eyeGeo = new THREE.TorusGeometry(0.04, 0.012, 14, 36);
    eyeGeo.rotateY(Math.PI / 2);
    const eye = mesh(eyeGeo, steel());
    eye.position.set(sx * K.POST_X, K.Y_SPIN, 0);
    post.add(eye);
    post.children[0]!.position.x = sx * K.POST_X;
    g.add(post);
  }
  return g;
}
