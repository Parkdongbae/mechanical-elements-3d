// 186번 전용 키트 — 편심 막대 분리 장치: 편심 막대 끝의 갭(아래로 열린 홈)이 팔의 핀을 물고,
// 막대 위의 스프링 손잡이를 당겨 올리면 턱이 핀을 눌러 막대가 들리고 노치 a 에 걸린다
import * as THREE from 'three';
import { brass, bronze, darkSteel, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

const TAU = Math.PI * 2;

export const K186 = {
  C: [-1.7, 1.8] as V2, // 편심 축
  e: 0.12,
  sheaveR: 0.22,
  strapR: 0.28,
  O: [-0.05, 2.9] as V2, // 팔 흔들 축
  La: Math.hypot(0.05, 1.1), // 팔: 축 ↔ 핀
  Lg: 1.7, // 편심 중심 ↔ 갭 중심
  pinR: 0.055,
  gabW: 0.067, // 갭 반폭(핀 + 0.012)
  barH: 0.09, // 막대 반높이(갭 쪽)
  lift: 0.16, // 막대 끝이 들리는 높이
  K: [0.41, 0.05] as V2, // 손잡이 받침(막대 로컬)
  tipGap: 0.006,
  handleDir: -1.2, // 손잡이 방향(레버 로컬)
  zArm: 0.03,
  zRod: 0.12,
  zLev: 0.185
} as const;

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface State186 {
  E: V2; // 편심 중심
  P: V2; // 팔 핀
  G: V2; // 갭 중심
  armAng: number; // 팔 회전(로컬 −Y 가 핀)
  rodAng: number;
  h: number; // 들림 0~1
  psi: number; // 손잡이 회전(막대 기준)
  engaged: boolean;
}

/** 편심 중심 E 에서 길이 Lg 로 닿는 팔 핀 자리(아래쪽 해) */
function armPin(E: V2): V2 {
  const { O, La, Lg } = K186;
  const dx = O[0] - E[0];
  const dy = O[1] - E[1];
  const d = Math.hypot(dx, dy);
  const a = (Lg * Lg - La * La + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, Lg * Lg - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const p1: V2 = [E[0] + ux * a - uy * h, E[1] + uy * a + ux * h];
  const p2: V2 = [E[0] + ux * a + uy * h, E[1] + uy * a - ux * h];
  return p1[1] < p2[1] ? p1 : p2;
}

/** 턱 끝(레버 로컬, h = 0 일 때 핀 위 tipGap) */
const V_TIP: V2 = [-K186.K[0], K186.pinR + K186.tipGap - K186.K[1]];
const V_LEN = Math.hypot(V_TIP[0], V_TIP[1]);
const PHI0 = Math.atan2(V_TIP[1], V_TIP[0]);

export const PERIOD186 = 8 * Math.PI;
const UP0 = 3 * Math.PI; // 들기(편심 위상 π — 막대가 왼쪽 끝에서 멈칫)
const DN0 = 7 * Math.PI; // 내리기(같은 위상)
const RAMP = 0.7;

/** theta → 자세. 8π 주기: 맞물림 1.5 바퀴 → 들어 올려 노치에 걸림(팔 멈춤, 막대만 2 바퀴 헛돔) → 내려 다시 물림 */
export function pose186(theta: number): State186 {
  const { C, e, O, Lg, lift, pinR, tipGap, K } = K186;
  const u = theta - PERIOD186 * Math.floor(theta / PERIOD186);
  const h = smooth((u - (UP0 - RAMP / 2)) / RAMP) - smooth((u - (DN0 - RAMP / 2)) / RAMP);
  const E: V2 = [C[0] + e * Math.cos(theta), C[1] + e * Math.sin(theta)];
  const engaged = !(u > UP0 && u < DN0);
  const P = engaged ? armPin(E) : armPin([C[0] - e, C[1]]);
  const gy = P[1] + h * lift;
  const G: V2 = [E[0] + Math.sqrt(Math.max(0, Lg * Lg - (gy - E[1]) ** 2)), gy];
  const rodAng = Math.atan2(G[1] - E[1], G[0] - E[0]);
  const armAng = Math.atan2(P[1] - O[1], P[0] - O[0]) + Math.PI / 2;
  // 턱 끝이 핀 위에 머물도록 손잡이 각(막대 로컬 y = −h·lift + pinR + tipGap)
  const ty = -h * lift + pinR + tipGap - K[1];
  const phi = Math.PI - Math.asin(Math.max(-1, Math.min(1, ty / V_LEN)));
  return { E, P, G, armAng, rodAng, h, psi: phi - PHI0, engaged: h < 0.02 };
}

// ───────────── 형상 ─────────────
function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function named(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}
/** 점열(스플라인)을 반폭 w 의 띠 윤곽으로 */
function bandShape(pts: V2[], w: number, n = 40): THREE.Shape {
  const c = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const P = c.getSpacedPoints(n);
  const L: V2[] = [];
  const R: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = c.getTangentAt(i / n);
    const p = P[i] ?? P[P.length - 1] ?? new THREE.Vector2();
    L.push([p.x - t.y * w, p.y + t.x * w]);
    R.push([p.x + t.y * w, p.y - t.x * w]);
  }
  return shapeFrom([...L, ...R.reverse()]);
}

/** 편심 바퀴: 원점 = 축, 편심 중심 = 로컬 +X e. z 가운데 0 */
export function eccentric186(): THREE.Group {
  const g = new THREE.Group();
  const { e, sheaveR } = K186;
  const sh = new THREE.Shape();
  sh.absarc(e, 0, sheaveR, 0, TAU, false);
  sh.holes.push(pathFrom(circlePts(0.052, 28)));
  sh.holes.push(pathFrom(circlePts(0.045, 20, e + 0.1, 0)));
  g.add(mesh(extrude(sh, 0.06, 0.006, 48), bronze()));
  g.add(meshAt(cylZ(0.02, 0.03, 0.036), steel({ color: 0xf2b619 }), e - 0.14, 0, 0));
  g.add(named('eccC', e, 0, 0));
  return setMM(g, { kind: 'wheel', r: sheaveR, width: 0.06, rim: 'flat', axis: 'z' });
}

/** 팔: 원점 = 흔들 축, 로컬 −Y 로 La 에 핀(앞으로 갭을 지나 손잡이 턱 층까지). z 가운데 0 */
export function arm186(): THREE.Group {
  const g = new THREE.Group();
  const { La, pinR } = K186;
  const sh = new THREE.Shape();
  sh.moveTo(-0.16, -0.12);
  sh.lineTo(-0.1, -La + 0.1);
  sh.absarc(0, -La, 0.2, Math.PI * 0.8, Math.PI * 2.2, false);
  sh.lineTo(0.16, -0.12);
  sh.absarc(0, 0, 0.2, -0.65, Math.PI + 0.65, false);
  sh.holes.push(pathFrom(circlePts(0.052, 28)));
  g.add(mesh(extrude(sh, 0.06, 0.006), steel()));
  // 핀(팔 앞면 → 턱 층 앞) + 머리
  g.add(meshAt(cylZ(pinR, 0.025, K186.zLev - K186.zArm + 0.03), darkSteel(), 0, -La, 0));
  g.add(meshAt(cylZ(pinR * 1.4, K186.zLev - K186.zArm + 0.03, K186.zLev - K186.zArm + 0.045), darkSteel(), 0, -La, 0));
  g.add(named('armPin', 0, -La, K186.zRod - K186.zArm));
  return g;
}

/** 편심 막대: 원점 = 갭 중심, +X 가 막대 방향(왼쪽 −Lg 에 띠쇠). 손잡이 받침 핀, 스프링 노치 a 포함. z 가운데 0 */
export function rod186(): THREE.Group {
  const g = new THREE.Group();
  const { Lg, strapR, sheaveR, gabW, barH, K, zRod, zLev } = K186;
  const x0 = -Lg + strapR - 0.03;
  const pts: V2[] = [[x0, -0.07], [-0.3, -barH], [-gabW, -barH], [-gabW, 0]];
  for (let i = 1; i < 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI;
    pts.push([gabW * Math.cos(a), gabW * Math.sin(a)]);
  }
  pts.push([gabW, 0], [gabW, -barH], [1.2, -barH], [1.25, -0.05], [1.25, 0.05], [1.2, barH], [-0.3, barH], [x0, 0.07]);
  const body = shapeFrom(pts);
  body.holes.push(stadiumShape(-Lg + 0.45, 0, -Lg + 0.95, 0, 0.022));
  g.add(mesh(extrude(body, 0.07, 0.006), steel()));
  // 띠쇠
  const ring = new THREE.Shape();
  ring.absarc(-Lg, 0, strapR, 0, TAU, false);
  ring.holes.push(pathFrom(circlePts(sheaveR + 0.004, 64, -Lg, 0)));
  g.add(mesh(extrude(ring, 0.06, 0.005, 64), steel()));
  g.add(named('rodEnd', -Lg, 0, 0));
  g.add(named('gab', 0, 0, 0));
  // 손잡이 받침 핀(막대 → 레버 층 앞)
  g.add(meshAt(cylZ(0.024, -0.03, zLev - zRod + 0.03), darkSteel(), K[0], K[1], 0));
  g.add(meshAt(cylZ(0.04, zLev - zRod + 0.03, zLev - zRod + 0.042), darkSteel(), K[0], K[1], 0));
  // 오른쪽 끝 기둥 + 스프링(노치 a)
  const dz = zLev - zRod;
  g.add(meshAt(new THREE.BoxGeometry(0.09, 0.2, dz + 0.055), steel(), 1.15, barH + 0.095, dz / 2 - 0.0075));
  g.add(meshAt(cylZ(0.05, dz + 0.02, dz + 0.045), brass(), 1.15, barH + 0.2, 0));
  const spring = bandShape([[1.17, barH + 0.17], [1.3, 0.06], [1.27, -0.2], [1.14, -0.38], [1.05, -0.5]], 0.014);
  g.add(meshAt(extrude(spring, 0.03, 0.003), brass(), 0, 0, dz));
  // 노치 a 의 이(왼쪽으로)
  const tooth = shapeFrom([[1.1, -0.39], [1.02, -0.445], [1.09, -0.47]]);
  g.add(meshAt(extrude(tooth, 0.03, 0.003), brass(), 0, 0, dz));
  g.add(named('notchA', 1.04, -0.445, dz));
  return g;
}

/** 스프링 손잡이(레버): 원점 = 받침 K, 레버 로컬(h = 0 에서 막대 축과 나란). 턱(왼쪽 위로 휘어 핀 위로 내려옴) + 고리 손잡이. z 가운데 0 */
export function handle186(): THREE.Group {
  const g = new THREE.Group();
  const { handleDir } = K186;
  // 받침 눈
  const eye = new THREE.Shape();
  eye.absarc(0, 0, 0.055, 0, TAU, false);
  eye.holes.push(pathFrom(circlePts(0.026, 24)));
  g.add(mesh(extrude(eye, 0.04, 0.004), steel()));
  // 턱: 받침에서 왼쪽 위로 휘어 핀 위로 수직으로 내려와 끝난다(끝 아랫면 = V_TIP)
  const w = 0.026;
  const jaw = bandShape([[-0.03, 0.04], [-0.1, 0.3], [-0.26, 0.43], [-0.39, 0.32], [V_TIP[0], V_TIP[1] + 0.12], [V_TIP[0], V_TIP[1]]], w);
  g.add(mesh(extrude(jaw, 0.036, 0.004), steel()));
  // 고리 손잡이
  const c = Math.cos(handleDir);
  const s = Math.sin(handleDir);
  const loop = stadiumShape(0.32 * c, 0.32 * s, 1.3 * c, 1.3 * s, 0.1);
  loop.holes.push(stadiumShape(0.32 * c, 0.32 * s, 1.3 * c, 1.3 * s, 0.062));
  g.add(mesh(extrude(loop, 0.036, 0.005), steel()));
  g.add(mesh(extrude(stadiumShape(0.04 * c, 0.04 * s, 0.24 * c, 0.24 * s, 0.035), 0.036, 0.004), steel()));
  g.add(named('jawTip', V_TIP[0], V_TIP[1], 0));
  return g;
}
