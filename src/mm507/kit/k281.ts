// 281 홈 캠 원판과 레버 전용 키트 — 상수, 운동식(state281), 홈 가운데선·두 벽(cam281Groove), 원판 묶음(cam281Disc), 레버 묶음(lever281).
// 설계표 docs/mm507-sheets/281.md 의 치수·식을 그대로 옮겼다. 자세는 t(초)의 절대 함수다.
import * as THREE from 'three';
import { bronze, brass, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, circlePts, extrude, lathe, mesh, pathFrom, shapeFrom, tubeProfile } from '../../models/parts/geom';

type V2 = [number, number];
const PI = Math.PI;
const TAU = PI * 2;

export const K281 = {
  C: [-0.4, 1.7] as V2,
  P: [0.35, 2.9] as V2,
  LP: 1.25,
  R0: 0.55,
  A: 0.3,
  B0: -2.129396,
  PC2: 2.0025,
  K2: 3.53774,
  W: 0.6,
  HALF: 0.053,
  BAR_DEG: 35,
  BAR_LEN: 2.3
} as const;
const K = K281;

export interface State281 {
  phi: number;
  rho: number;
  gamma: number;
  thetaPin: number;
  Q: V2;
}

/** 원판 각 phi 에서의 닫힌 식 */
function stateAtPhi(phi: number): State281 {
  const rho = K.R0 + K.A * Math.cos(phi);
  const c = Math.max(-1, Math.min(1, (K.PC2 + K.LP * K.LP - rho * rho) / K.K2));
  const gamma = Math.acos(c);
  const thetaPin = K.B0 + gamma;
  const Q: V2 = [K.P[0] + K.LP * Math.cos(thetaPin), K.P[1] + K.LP * Math.sin(thetaPin)];
  return { phi, rho, gamma, thetaPin, Q };
}

export function state281(t: number): State281 {
  return stateAtPhi(K.W * t);
}

/** 홈 가운데선 G(φ) = Rot(−φ)(Q(φ) − C) 와 바깥·안쪽 벽(±HALF) — 원판 로컬 좌표, φ = 2π·i/n */
export function cam281Groove(n: number): { center: V2[]; outer: V2[]; inner: V2[] } {
  const center: V2[] = [];
  for (let i = 0; i < n; i++) {
    const phi = (TAU * i) / n;
    const q = stateAtPhi(phi).Q;
    const dx = q[0] - K.C[0];
    const dy = q[1] - K.C[1];
    const c = Math.cos(-phi);
    const s = Math.sin(-phi);
    center.push([dx * c - dy * s, dx * s + dy * c]);
  }
  const outer: V2[] = [];
  const inner: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = center[(i + n - 1) % n]!;
    const b = center[(i + 1) % n]!;
    const g = center[i]!;
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    if (nx * g[0] + ny * g[1] < 0) {
      nx = -nx;
      ny = -ny;
    }
    outer.push([g[0] + K.HALF * nx, g[1] + K.HALF * ny]);
    inner.push([g[0] - K.HALF * nx, g[1] - K.HALF * ny]);
  }
  return { center, outer, inner };
}

function plateZ(shape: THREE.Shape, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(extrude(shape, z1 - z0, 0), mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** 원판 묶음(원점 = 원판 중심): discBack 0~0.051 / discRim·discIsland 0.05~0.10 / 노란 띠. 그룹 이름 disc */
export function cam281Disc(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'disc';
  const { center, outer, inner } = cam281Groove(1440);
  const backShape = shapeFrom(circlePts(1.0, 160));
  backShape.holes.push(circlePath(0, 0, 0.06));
  const back = plateZ(backShape, 0, 0.051, darkSteel());
  back.name = 'discBack';
  const rimShape = shapeFrom(circlePts(1.0, 160));
  rimShape.holes.push(pathFrom(outer));
  const rim = plateZ(rimShape, 0.05, 0.1, steel());
  rim.name = 'discRim';
  const islandShape = shapeFrom(inner);
  islandShape.holes.push(circlePath(0, 0, 0.06));
  const island = plateZ(islandShape, 0.05, 0.1, steel());
  island.name = 'discIsland';
  // 테 앞면 노란 띠(반지름 0.94, 각 90°)
  const band = mesh(new THREE.BoxGeometry(0.16, 0.025, 0.004), paint(0xf2b619));
  band.name = 'discBand';
  band.position.set(0, 0.94, 0.1025);
  g.add(back, rim, island, band);
  g.userData.outline = center;
  g.userData.walls = { outer, inner };
  return g;
}

function revZ(profile: [number, number][], mat: THREE.Material): THREE.Mesh {
  const geo = lathe(profile, 40);
  geo.rotateX(PI / 2);
  return mesh(geo, mat);
}

/** 레버 윤곽(로컬: 원점 = 받침점, +x = 받침점 → 롤러) — 팔·삼각 판·막대·허브를 합친 한 윤곽 */
export const LEVER281_OUTLINE: V2[] = [
  [0.088, -0.048], [1.25, -0.025], [1.266, -0.019], [1.274, -0.007], [1.274, 0.007], [1.266, 0.019],
  [1.252, 0.025], [0.588, 0.038], [0.507, 0.294], [1.913, 1.278], [1.926, 1.292], [1.933, 1.311],
  [1.933, 1.33], [1.925, 1.348], [1.911, 1.361], [1.893, 1.368], [1.873, 1.368], [1.855, 1.36],
  [0.042, 0.091], [0.01, 0.1], [-0.02, 0.098], [-0.047, 0.088], [-0.077, 0.063], [-0.096, 0.029],
  [-0.1, -0.01], [-0.088, -0.047], [-0.063, -0.077], [-0.029, -0.096], [0.01, -0.1], [0.047, -0.088],
  [0.077, -0.063]
];

/** 레버 묶음(원점 = 받침점 P, 회전 = θpin): lever(brass, 깊이 0.13~0.17)·followerPin·roller·노란 점 */
export function lever281(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'leverArm';
  const shape = shapeFrom(LEVER281_OUTLINE);
  shape.holes.push(circlePath(0, 0, 0.036));
  const lev = plateZ(shape, 0.13, 0.17, brass());
  lev.name = 'lever';
  lev.userData.outline = LEVER281_OUTLINE;
  // 핀: 깊이 0.056 ~ 0.15(레버 뒷면 0.13 에 박힘)
  const pin = revZ([[0, 0.056], [0.02, 0.056], [0.02, 0.15], [0, 0.15]], steel());
  pin.name = 'followerPin';
  pin.position.set(K.LP, 0, 0);
  const roller = revZ(tubeProfile(0.021, 0.05, 0.056, 0.096, 0.002), bronze());
  roller.name = 'roller';
  roller.position.set(K.LP, 0, 0);
  const dot = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 24), paint(0xf2b619));
  dot.rotation.x = PI / 2;
  dot.position.set(1.8, 1.26, 0.1725);
  dot.name = 'barDot';
  g.add(lev, pin, roller, dot);
  return g;
}
