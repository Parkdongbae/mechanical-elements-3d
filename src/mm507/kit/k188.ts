// 188번 전용 키트 — 분리 장치 변형 2(186 의 변형): 길고 둥글게 휜 고리 손잡이. 막대 위 받침에 걸린 레버의 짧은 팔이
// 덮개 속에서 핀 위로 내려와, 손잡이를 당기면 핀을 눌러 막대가 들리고 핀이 갭에서 빠진다. 팔은 막대 아래의 흔들 축에서 올라온다
import * as THREE from 'three';
import { brass, bronze, darkSteel, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

const TAU = Math.PI * 2;

export const K188 = {
  C: [-1.6, 1.45] as V2, // 편심 축
  e: 0.12,
  sheaveR: 0.22,
  strapR: 0.28,
  O: [0.37, 0.7] as V2, // 팔 흔들 축(막대 아래)
  La: 0.75, // 팔: 축 ↔ 핀
  Lg: 1.97, // 편심 중심 ↔ 갭 중심
  pinR: 0.08,
  gabW: 0.092, // 갭 반폭(핀 + 0.012)
  barLo: 0.06, // 막대 아랫면(갭 중심 아래)
  barHi: 0.13, // 막대 윗면
  lift: 0.15,
  K: [-0.56, 0.2] as V2, // 레버 받침(막대 로컬)
  tipGap: 0.006,
  zArm: 0.03,
  zRod: 0.12,
  zLev: 0.19,
  zCover: 0.245
} as const;

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface State188 {
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
  const { O, La, Lg } = K188;
  const dx = O[0] - E[0];
  const dy = O[1] - E[1];
  const d = Math.hypot(dx, dy);
  const a = (Lg * Lg - La * La + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, Lg * Lg - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const p1: V2 = [E[0] + ux * a - uy * h, E[1] + uy * a + ux * h];
  const p2: V2 = [E[0] + ux * a + uy * h, E[1] + uy * a - ux * h];
  return p1[1] > p2[1] ? p1 : p2;
}

/** 턱 끝(레버 로컬, h = 0 일 때 핀 위 tipGap) */
const V_TIP: V2 = [-K188.K[0], K188.pinR + K188.tipGap - K188.K[1]];
const V_LEN = Math.hypot(V_TIP[0], V_TIP[1]);
const PHI0 = Math.atan2(V_TIP[1], V_TIP[0]);

export const PERIOD188 = 8 * Math.PI;
const UP0 = 3 * Math.PI; // 들기(편심 위상 π — 막대가 왼쪽 끝에서 멈칫)
const DN0 = 7 * Math.PI; // 내리기(같은 위상)
const RAMP = 0.7;

/** theta → 자세. 8π 주기: 맞물림 1.5 바퀴 → 들어 올려 노치에 걸림(팔 멈춤, 막대만 2 바퀴 헛돔) → 내려 다시 물림 */
export function pose188(theta: number): State188 {
  const { C, e, O, Lg, lift, pinR, tipGap, K } = K188;
  const u = theta - PERIOD188 * Math.floor(theta / PERIOD188);
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
  const phi = Math.asin(Math.max(-1, Math.min(1, ty / V_LEN)));
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
export function eccentric188(): THREE.Group {
  const g = new THREE.Group();
  const { e, sheaveR } = K188;
  const sh = new THREE.Shape();
  sh.absarc(e, 0, sheaveR, 0, TAU, false);
  sh.holes.push(pathFrom(circlePts(0.052, 28)));
  sh.holes.push(pathFrom(circlePts(0.045, 20, e + 0.1, 0)));
  g.add(mesh(extrude(sh, 0.06, 0.006, 48), bronze()));
  g.add(meshAt(cylZ(0.02, 0.03, 0.036), steel({ color: 0xf2b619 }), e - 0.14, 0, 0));
  g.add(named('eccC', e, 0, 0));
  return setMM(g, { kind: 'wheel', r: sheaveR, width: 0.06, rim: 'flat', axis: 'z' });
}

/** 팔: 원점 = 흔들 축, 로컬 −Y 로 La 에 핀(앞으로 갭을 지나 짧은 팔 층까지, 덮개 뒤). z 가운데 0 */
export function arm188(): THREE.Group {
  const g = new THREE.Group();
  const { La, pinR } = K188;
  const sh = new THREE.Shape();
  sh.moveTo(-0.16, -0.12);
  sh.lineTo(-0.1, -La + 0.1);
  sh.absarc(0, -La, 0.2, Math.PI * 0.8, Math.PI * 2.2, false);
  sh.lineTo(0.16, -0.12);
  sh.absarc(0, 0, 0.2, -0.65, Math.PI + 0.65, false);
  sh.holes.push(pathFrom(circlePts(0.052, 28)));
  g.add(mesh(extrude(sh, 0.06, 0.006), steel()));
  // 핀(팔 앞면 → 턱 층 앞) + 머리
  g.add(meshAt(cylZ(pinR, 0.025, K188.zLev - K188.zArm + 0.022), darkSteel(), 0, -La, 0));
  g.add(named('armPin', 0, -La, K188.zRod - K188.zArm));
  return g;
}

/** 편심 막대: 원점 = 갭 중심, +X 가 막대 방향(왼쪽 −Lg 에 띠쇠). 레버 받침 귀·핀, 손잡이 받침대, 덮개(혹 + 꼬리) 포함. z 가운데 0 */
export function rod188(): THREE.Group {
  const g = new THREE.Group();
  const { Lg, strapR, sheaveR, gabW, barLo, barHi, K, zRod, zLev, zCover } = K188;
  const x0 = -Lg + strapR - 0.03;
  const pts: V2[] = [[x0, -0.05], [-0.3, -barLo], [-gabW, -barLo], [-gabW, 0]];
  for (let i = 1; i < 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI;
    pts.push([gabW * Math.cos(a), gabW * Math.sin(a)]);
  }
  pts.push([gabW, 0], [gabW, -barLo], [0.62, -barLo], [0.66, -0.02], [0.62, 0.04], [0.3, barHi]);
  // 레버 받침 귀
  pts.push([K[0] + 0.07, barHi]);
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    pts.push([K[0] + 0.06 * Math.cos(a), K[1] + 0.06 * Math.sin(a)]);
  }
  pts.push([K[0] - 0.07, barHi], [x0, 0.07]);
  const body = shapeFrom(pts);
  body.holes.push(stadiumShape(-Lg + 0.45, 0.03, -Lg + 0.95, 0.03, 0.022));
  g.add(mesh(extrude(body, 0.07, 0.006), steel()));
  // 띠쇠
  const ring = new THREE.Shape();
  ring.absarc(-Lg, 0, strapR, 0, TAU, false);
  ring.holes.push(pathFrom(circlePts(sheaveR + 0.004, 64, -Lg, 0)));
  g.add(mesh(extrude(ring, 0.06, 0.005, 64), steel()));
  g.add(named('rodEnd', -Lg, 0, 0));
  g.add(named('gab', 0, 0, 0));
  // 레버 받침 핀
  const dz = zLev - zRod;
  g.add(meshAt(cylZ(0.024, -0.03, dz + 0.03), darkSteel(), K[0], K[1], 0));
  g.add(meshAt(cylZ(0.04, dz + 0.03, dz + 0.042), darkSteel(), K[0], K[1], 0));
  // 손잡이 받침대(손잡이 끝이 놓이는 곳)
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.04, dz + 0.055), steel(), REST188[0], barHi + 0.018, dz / 2 - 0.0075));
  // 덮개(혹 + 꼬리): 앞 층, 꼬리 아래 받침으로 막대에 붙는다
  const cv = shapeFrom(
    new THREE.SplineCurve(
      [[-0.2, 0.0], [-0.19, 0.16], [-0.06, 0.33], [0.1, 0.35], [0.26, 0.24], [0.42, 0.1], [0.66, 0.02]].map(([x, y]) => new THREE.Vector2(x, y))
    )
      .getPoints(40)
      .map((p) => [p.x, p.y] as V2)
      .concat([[0.67, -0.01], [0.5, -0.02], [-0.2, -0.0]])
  );
  g.add(meshAt(extrude(cv, 0.03, 0.005), brass(), 0, 0, zCover - zRod));
  g.add(meshAt(new THREE.BoxGeometry(0.16, 0.06, zCover - zRod - 0.05), steel(), 0.5, 0.0, (zCover - zRod) / 2 + 0.01));
  return g;
}

/** 손잡이 끝이 놓이는 받침대 자리(막대 로컬) */
export const REST188: V2 = [K188.K[0] - 0.85, K188.barHi + 0.035];

/** 고리 손잡이(레버): 원점 = 받침 K, 레버 로컬(h = 0). 짧은 팔(오른쪽, 핀 위로 내려옴) + 왼쪽 위로 크게 휜 고리 손잡이. z 가운데 0 */
export function handle188(): THREE.Group {
  const g = new THREE.Group();
  const eye = new THREE.Shape();
  eye.absarc(0, 0, 0.055, 0, TAU, false);
  eye.holes.push(pathFrom(circlePts(0.026, 24)));
  g.add(mesh(extrude(eye, 0.04, 0.004), steel()));
  // 짧은 팔: 오른쪽 위로 올랐다가 핀 위로 수직으로 내려와 끝난다(끝 아랫면 = V_TIP)
  const arm = bandShape([[0.04, 0.03], [0.2, 0.13], [0.4, 0.12], [V_TIP[0], V_TIP[1] + 0.1], [V_TIP[0], V_TIP[1]]], 0.026);
  g.add(mesh(extrude(arm, 0.036, 0.004), steel()));
  // 고리 손잡이: 왼쪽 위로 올라 둥글게 말려 막대 위 받침대로 내려온다
  const end: V2 = [REST188[0] - K188.K[0], REST188[1] - K188.K[1] + 0.005];
  const loop = bandShape(
    [[-0.03, 0.04], [-0.31, 0.25], [-0.74, 0.47], [-1.18, 0.62], [-1.4, 0.78], [-1.3, 0.94], [-0.93, 0.99], [-0.5, 0.93], [-0.25, 0.74], [-0.21, 0.5], [-0.37, 0.22], [-0.56, 0.08], [end[0] + 0.06, end[1] + 0.05], end],
    0.032,
    60
  );
  g.add(mesh(extrude(loop, 0.036, 0.004), steel()));
  // 노치 a(고리 안쪽의 작은 홈 표시)
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.05, 0.04).rotateZ(Math.PI / 4), darkSteel(), -0.25, 0.62, 0));
  g.add(named('jawTip', V_TIP[0], V_TIP[1], 0));
  g.add(named('notchA', -0.25, 0.62, 0));
  return g;
}
