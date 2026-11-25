// 187번 전용 키트 — 분리 장치 변형 1(186 의 변형): 편심 막대 위 귀에 걸린 집게 모양 손잡이.
// 손잡이 머리의 아랫면이 캠(나선)이라, 손잡이를 들어 올리면 캠이 핀을 눌러 막대가 들리고 핀이 갭에서 빠진다
import * as THREE from 'three';
import { bronze, darkSteel, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

const TAU = Math.PI * 2;

export const K187 = {
  C: [-1.65, 1.8] as V2, // 편심 축
  e: 0.12,
  sheaveR: 0.22,
  strapR: 0.28,
  O: [0, 2.51] as V2, // 팔 흔들 축
  La: 0.71, // 팔: 축 ↔ 핀
  Lg: 1.65, // 편심 중심 ↔ 갭 중심
  pinR: 0.07,
  gabW: 0.082, // 갭 반폭(핀 + 0.012)
  barLo: 0.09, // 막대 아랫면(갭 중심 아래)
  barHi: 0.12, // 막대 윗면
  lift: 0.17, // 막대 끝이 들리는 높이
  K: [0.05, 0.24] as V2, // 손잡이 받침(막대 로컬)
  tipGap: 0.006,
  swing: 0.8, // 손잡이가 들리는 각(rad)
  zArm: 0.03,
  zRod: 0.12,
  zLev: 0.19
} as const;

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface State187 {
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
  const { O, La, Lg } = K187;
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

/** 손잡이 머리 캠(레버 로컬, s = 0~1): 들림 s 일 때 핀 윗점에 닿는 점 — 손잡이 각 s·swing */
export function camPts187(n = 24): V2[] {
  const { K, pinR, tipGap, lift, swing } = K187;
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const px = -K[0];
    const py = pinR + tipGap - s * lift - K[1];
    const r = Math.hypot(px, py);
    const f = Math.atan2(py, px) - s * swing;
    out.push([r * Math.cos(f), r * Math.sin(f)]);
  }
  return out;
}

export const PERIOD187 = 8 * Math.PI;
const UP0 = 3 * Math.PI; // 들기(편심 위상 π — 막대가 왼쪽 끝에서 멈칫)
const DN0 = 7 * Math.PI; // 내리기(같은 위상)
const RAMP = 0.7;

/** theta → 자세. 8π 주기: 맞물림 1.5 바퀴 → 들어 올려 노치에 걸림(팔 멈춤, 막대만 2 바퀴 헛돔) → 내려 다시 물림 */
export function pose187(theta: number): State187 {
  const { C, e, O, Lg, lift } = K187;
  const u = theta - PERIOD187 * Math.floor(theta / PERIOD187);
  const h = smooth((u - (UP0 - RAMP / 2)) / RAMP) - smooth((u - (DN0 - RAMP / 2)) / RAMP);
  const E: V2 = [C[0] + e * Math.cos(theta), C[1] + e * Math.sin(theta)];
  const engaged = !(u > UP0 && u < DN0);
  const P = engaged ? armPin(E) : armPin([C[0] - e, C[1]]);
  const gy = P[1] + h * lift;
  const G: V2 = [E[0] + Math.sqrt(Math.max(0, Lg * Lg - (gy - E[1]) ** 2)), gy];
  const rodAng = Math.atan2(G[1] - E[1], G[0] - E[0]);
  const armAng = Math.atan2(P[1] - O[1], P[0] - O[0]) + Math.PI / 2;
  return { E, P, G, armAng, rodAng, h, psi: h * K187.swing, engaged: h < 0.02 };
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
export function eccentric187(): THREE.Group {
  const g = new THREE.Group();
  const { e, sheaveR } = K187;
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
export function arm187(): THREE.Group {
  const g = new THREE.Group();
  const { La, pinR } = K187;
  const sh = new THREE.Shape();
  sh.moveTo(-0.16, -0.12);
  sh.lineTo(-0.1, -La + 0.1);
  sh.absarc(0, -La, 0.2, Math.PI * 0.8, Math.PI * 2.2, false);
  sh.lineTo(0.16, -0.12);
  sh.absarc(0, 0, 0.2, -0.65, Math.PI + 0.65, false);
  sh.holes.push(pathFrom(circlePts(0.052, 28)));
  g.add(mesh(extrude(sh, 0.06, 0.006), steel()));
  // 핀(팔 앞면 → 턱 층 앞) + 머리
  g.add(meshAt(cylZ(pinR, 0.025, K187.zLev - K187.zArm + 0.03), darkSteel(), 0, -La, 0));
  g.add(meshAt(cylZ(pinR * 1.4, K187.zLev - K187.zArm + 0.03, K187.zLev - K187.zArm + 0.045), darkSteel(), 0, -La, 0));
  g.add(named('armPin', 0, -La, K187.zRod - K187.zArm));
  return g;
}

/** 편심 막대: 원점 = 갭 중심, +X 가 막대 방향(왼쪽 −Lg 에 띠쇠). 손잡이 받침 귀·핀 포함. z 가운데 0 */
export function rod187(): THREE.Group {
  const g = new THREE.Group();
  const { Lg, strapR, sheaveR, gabW, barLo, barHi, K, zRod, zLev } = K187;
  const x0 = -Lg + strapR - 0.03;
  const pts: V2[] = [[x0, -0.07], [-0.3, -barLo], [-gabW, -barLo], [-gabW, 0]];
  for (let i = 1; i < 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI;
    pts.push([gabW * Math.cos(a), gabW * Math.sin(a)]);
  }
  pts.push([gabW, 0], [gabW, -barLo], [1.12, -barLo], [1.17, -barLo + 0.05], [1.17, barHi - 0.05], [1.12, barHi]);
  // 받침 귀(윗면에서 K 까지)
  pts.push([K[0] + 0.07, barHi]);
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    pts.push([K[0] + 0.065 * Math.cos(a), K[1] + 0.065 * Math.sin(a)]);
  }
  pts.push([K[0] - 0.07, barHi], [-0.3, barHi], [x0, 0.07]);
  const body = shapeFrom(pts);
  body.holes.push(stadiumShape(-Lg + 0.45, 0.01, -Lg + 0.95, 0.01, 0.022));
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
  return g;
}

/** 집게 손잡이: 원점 = 받침 K, 레버 로컬(h = 0 에서 막대 축과 나란). 캠 머리 + 오른쪽으로 뻗은 손잡이. z 가운데 0 */
export function handle187(): THREE.Group {
  const g = new THREE.Group();
  const cam = camPts187();
  const c1 = cam[cam.length - 1] ?? [0, 0];
  const r1 = Math.hypot(c1[0], c1[1]);
  const f1 = Math.atan2(c1[1], c1[0]);
  const c0 = cam[0] ?? [0, 0];
  const f0 = Math.atan2(c0[1], c0[0]);
  const pts: V2[] = [...cam];
  // 캠 끝 → 왼쪽 위 → 위 → 오른쪽(반지름이 0.12 로 줄어듦)
  const fTop = -0.15 - TAU - f1;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const f = f1 + fTop * t;
    const r = r1 + (0.12 - r1) * Math.min(1, t * 1.6);
    pts.push([r * Math.cos(f), r * Math.sin(f)]);
  }
  // 오른쪽 아래 → 캠 시작
  for (let i = 1; i < 12; i++) {
    const f = -0.15 + (f0 + 0.15) * (i / 12);
    pts.push([0.12 * Math.cos(f), 0.12 * Math.sin(f)]);
  }
  const head = shapeFrom(pts);
  head.holes.push(pathFrom(circlePts(0.026, 24)));
  g.add(mesh(extrude(head, 0.04, 0.005), steel()));
  // 손잡이(가운데가 조금 굽은 납작 막대) + 끝 둥근
  const grip = bandShape([[0.08, 0.0], [0.35, -0.035], [0.55, 0.03], [1.05, 0.03]], 0.045);
  g.add(mesh(extrude(grip, 0.036, 0.004), steel()));
  g.add(meshAt(cylZ(0.045, -0.018, 0.018), steel(), 1.05, 0.03, 0));
  g.add(named('camTip', c0[0], c0[1], 0));
  return g;
}
