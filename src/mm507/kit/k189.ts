// 번호 전용 키트 (507 · 189번) — 편심 막대 분리 장치 변형 3 (186 의 또 다른 변형).
// 편심이 가로 막대(편심 막대)를 왕복시키고, 막대 가운데 허브 아래의 갭(아래로 열린 홈)이 위 흔들 축에 매달린 팔(위로 굽은 팔 + 눈 고리)의 핀을 물어
// 팔을 흔든다(밸브 쪽). 위에서 당김 막대를 끌어올리면 링크가 막대 오른쪽 끝을 들어 올려 갭이 핀에서 위로 빠진다 → 막대는 계속 왕복, 팔은 멈춤.
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, mesh, pathFrom, shapeFrom, stadiumShape } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';
import { STAGE } from './stand';

const TAU = Math.PI * 2;
const PY = 0.95;

/** 판화 px → 모형. 1 px = 0.0075. 갭(핀) 중심 P0 = (0.5, 0.95) */
export const K189 = {
  C: [-1.5, PY] as V2, // 편심 축(판화 밖 왼쪽 — 186 처럼 보충)
  e: 0.12, // 편심량
  sheaveR: 0.22,
  strapR: 0.28,
  Lg: 2.0, // 편심 중심 ↔ 갭 중심
  O: [0.41, PY + 0.8] as V2, // 흔들 축(판화의 눈 고리 [300·272])
  La: Math.hypot(0.09, 0.8), // 흔들 축 ↔ 핀
  pinR: 0.045,
  gabW: 0.057, // 갭 반폭(핀 + 0.012)
  yB: -0.05, // 막대 아랫변(갭 중심 기준)
  yT: 0.11, // 막대 윗변
  lift: 0.2, // 분리 때 갭이 들리는 높이
  ER: 0.85, // 갭 → 링크 눈 R 거리(막대 방향)
  RY: 0.03, // 링크 눈의 막대 로컬 y
  rodR: 1.1, // 갭에서 오른쪽 끝까지
  LINK: 1.06, // 링크 길이 R–D
  DX: 1.31, // D 의 x (당김판이 세로로만 움직이므로 고정)
  ARM: 0.43, // 당김 막대 중심 C1 ↔ D 가로 거리
  ringR: 0.285, // 팔 눈 고리(판화 38 px)
  ringIn: 0.165,
  shaftR: 0.16, // 흔들 축(판화의 짙은 원판)
  zA0: -0.015, // 팔 z
  zA1: 0.035,
  zR0: 0.05, // 막대 z
  zR1: 0.1,
  zL0: 0.105, // 링크 z
  zL1: 0.15,
  zP0: 0.155, // 당김판 z
  zP1: 0.2,
  guideY: 2.66, // 당김 막대 안내 가운데 높이
  guideH: 0.24,
  topY: 2.86 // 당김 막대 윗끝(쉴 때 = D0)
} as const;

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** 쉴 때(막대 수평, 갭 = P0) 링크 윗끝 D 높이 — 당김판 치수 기준 */
export const D0_189: V2 = [K189.DX, PY + K189.RY + Math.sqrt(K189.LINK ** 2 - (K189.DX - (0.5 + K189.ER)) ** 2)];

export const PERIOD189 = 8 * Math.PI;
const UP0 = 3 * Math.PI; // 들기 (편심 위상 π — 막대가 왼쪽 끝에서 멈칫)
const DN0 = 7 * Math.PI; // 내리기 (같은 위상 → 갭이 멈춘 핀 바로 위로 돌아옴)
const RAMP = 0.7;

export interface Gear189 {
  E: V2; // 편심 중심
  P: V2; // 팔 핀
  G: V2; // 갭 중심
  R: V2; // 링크 아래 눈
  D: V2; // 링크 윗 눈(당김판)
  rodAng: number;
  armAng: number; // 팔 회전(로컬 −Y 가 핀)
  link: number; // 링크 기울기(위 끝이 오른쪽이면 +)
  lift: number; // 당김 막대가 쉴 때보다 올라간 양
  h: number; // 들림 0~1
  engaged: boolean; // 갭이 핀을 물고 있음
  clear: number; // 갭(막대 아랫변)과 핀 윗면 사이 높이(물림 중엔 음수)
}

/** 편심 중심 E 에서 길이 Lg 로 닿는 팔 핀 자리(아래쪽 해) */
function armPin(E: V2): V2 {
  const { O, La, Lg } = K189;
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

/** theta → 자세. 8π 주기(편심 4 바퀴): 연결 1.5 바퀴 → 당겨 들어 갭이 핀에서 빠짐(팔 멈춤, 막대만 2 바퀴 왕복) → 내려 다시 물림 */
export function gear189(theta: number): Gear189 {
  const { C, e, O, Lg, lift, ER, RY, DX, LINK, yB, pinR } = K189;
  const u = theta - PERIOD189 * Math.floor(theta / PERIOD189);
  const h = smooth((u - (UP0 - RAMP / 2)) / RAMP) - smooth((u - (DN0 - RAMP / 2)) / RAMP);
  const E: V2 = [C[0] + e * Math.cos(theta), C[1] + e * Math.sin(theta)];
  const inGap = !(u > UP0 && u < DN0);
  const P = inGap ? armPin(E) : armPin([C[0] - e, C[1]]);
  const gy = P[1] + h * lift;
  const G: V2 = [E[0] + Math.sqrt(Math.max(0, Lg * Lg - (gy - E[1]) ** 2)), gy];
  const rodAng = Math.atan2(G[1] - E[1], G[0] - E[0]);
  const armAng = Math.atan2(P[1] - O[1], P[0] - O[0]) + Math.PI / 2;
  const c = Math.cos(rodAng);
  const s = Math.sin(rodAng);
  const R: V2 = [G[0] + ER * c - RY * s, G[1] + ER * s + RY * c];
  const D: V2 = [DX, R[1] + Math.sqrt(LINK * LINK - (DX - R[0]) ** 2)];
  // 핀 바로 위 막대 아랫변 높이(막대 로컬 x = 핀까지 거리)
  const lx = (P[0] - G[0]) * c + (P[1] - G[1]) * s;
  const bottomY = G[1] + lx * s + yB * c;
  return {
    E,
    P,
    G,
    R,
    D,
    rodAng,
    armAng,
    link: Math.atan2(D[0] - R[0], D[1] - R[1]),
    lift: D[1] - D0_189[1],
    h,
    engaged: h < 0.02,
    clear: bottomY - (P[1] + pinR)
  };
}

// ───────────── 형상 ─────────────
function discZ(r: number, z0: number, z1: number, mat: THREE.Material, x: number, y: number): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 32).rotateX(Math.PI / 2), mat);
  m.position.set(x, y, (z0 + z1) / 2);
  return m;
}
function named(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}
/** 점열(스플라인)을 반폭 w(u) 의 띠 윤곽으로 */
function bandShape(pts: V2[], w0: number, w1: number, n = 32): THREE.Shape {
  const c = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const P = c.getSpacedPoints(n);
  const L: V2[] = [];
  const R: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = c.getTangentAt(i / n);
    const p = P[i] ?? new THREE.Vector2();
    const w = w0 + (w1 - w0) * (i / n);
    L.push([p.x - t.y * w, p.y + t.x * w]);
    R.push([p.x + t.y * w, p.y - t.x * w]);
  }
  return shapeFrom([...L, ...R.reverse()]);
}

/** 편심 막대: 원점 = 갭 중심, +X 가 막대 방향. 왼쪽 −Lg 에 편심 띠쇠, 왼쪽 몸통에 갈라진 홈(판화의 두 가닥 끝),
 *  가운데 위로 불룩한 허브 아래에 갭(아래로 열린 홈, 핀을 문다), 오른쪽에 링크 눈 R. z 0.05 ~ 0.10. 주철 */
export function rod189(): THREE.Group {
  const g = new THREE.Group();
  const { Lg, strapR, sheaveR, gabW, yB, yT, rodR, ER, RY } = K189;
  const t = K189.zR1 - K189.zR0;
  const zc = (K189.zR0 + K189.zR1) / 2;
  const x0 = -Lg + strapR - 0.03;
  const pts: V2[] = [[x0, yB], [-gabW, yB], [-gabW, 0]];
  for (let i = 1; i < 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI;
    pts.push([gabW * Math.cos(a), gabW * Math.sin(a)]);
  }
  pts.push([gabW, 0], [gabW, yB], [rodR - 0.08, yB]);
  const rc = (yT - yB) / 2;
  const ym = (yT + yB) / 2;
  for (let i = 1; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 10;
    pts.push([rodR - 0.08 + 0.08 * Math.cos(a) * 1, ym + rc * Math.sin(a)]);
  }
  pts.push([rodR - 0.08, yT], [0.5, yT], [0.36, 0.2], [0.12, 0.25], [-0.12, 0.25], [-0.36, 0.2], [-0.5, yT], [x0, yT]);
  const body = shapeFrom(pts);
  body.holes.push(stadiumShape(-Lg + 0.42, ym, -Lg + 1.0, ym, 0.022));
  body.holes.push(pathFrom(circlePts(0.034, 24, ER, RY)));
  g.add(mesh(extrude(body, t, 0.004, 48), castIron()));
  // 편심 띠쇠
  const ring = new THREE.Shape();
  ring.absarc(-Lg, 0, strapR, 0, TAU, false);
  ring.holes.push(pathFrom(circlePts(sheaveR + 0.004, 64, -Lg, 0)));
  g.add(mesh(extrude(ring, t, 0.004, 64), castIron()));
  g.children.forEach((c) => (c.position.z = zc));
  g.add(named('rodEnd', -Lg, 0, zc));
  g.add(named('gab', 0, 0, zc));
  setMM(g, { kind: 'rod', fn: 'rod189' });
  return g;
}

/** 흔들 팔(밸브 쪽): 원점 = 흔들 축, 로컬 −Y 로 La 에 핀. 눈 고리(축에 박힘) + 위로 굽은 팔 + 핀 보스 + 핀(막대 층 앞까지) + 머리.
 *  z 0 ~ 0.035 (팔), 핀은 막대 앞 0.126 까지 */
export function arm189(): THREE.Group {
  const g = new THREE.Group();
  const { La, ringR, ringIn, pinR } = K189;
  const t = K189.zA1 - K189.zA0;
  const zc = (K189.zA0 + K189.zA1) / 2;
  const ring = new THREE.Shape(circlePts(ringR, 64).map(([x, y]): THREE.Vector2 => new THREE.Vector2(x, y)));
  ring.holes.push(pathFrom(circlePts(ringIn, 48)));
  const ringM = mesh(extrude(ring, t, 0.004, 48), castIron());
  ringM.position.z = zc;
  g.add(ringM);
  const band = bandShape([[0.02, -ringR + 0.06], [0.1, -0.38], [0.11, -0.55], [0.02, -La + 0.06]], 0.075, 0.06);
  const bandM = mesh(extrude(band, t, 0.004, 24), castIron());
  bandM.position.z = zc;
  g.add(bandM);
  const boss = discZ(0.12, K189.zA0, K189.zA1, castIron(), 0, -La);
  g.add(boss);
  // 핀: 팔 → 막대 갭 층 → 앞 머리
  g.add(discZ(pinR, K189.zA1 - 0.004, K189.zR1 + 0.012, darkSteel(), 0, -La));
  g.add(discZ(0.07, K189.zR1 + 0.012, K189.zR1 + 0.026, steel(), 0, -La));
  g.add(named('armPin', 0, -La, (K189.zR0 + K189.zR1) / 2));
  setMM(g, { kind: 'rod', fn: 'arm189' });
  return g;
}

/** 흔들 축(판화의 짙은 원판): 뒤판 → 팔 눈 고리 → 앞 마개. 원점 = 축 */
export function rockShaft189(): THREE.Group {
  const g = new THREE.Group();
  const z0 = STAGE.backZ;
  const z1 = K189.zA1 + 0.015;
  g.add(discZ(K189.shaftR, z0, z1, darkSteel(), 0, 0));
  g.add(discZ(K189.shaftR + 0.06, z0, z0 + 0.08, darkSteel(), 0, 0));
  g.add(discZ(0.06, z1, z1 + 0.015, steel(), 0, 0));
  // 키 표시(축이 팔과 함께 도는 것이 보이게)
  const key = mesh(new THREE.BoxGeometry(0.03, 0.1, 0.012), steel());
  key.position.set(0, 0.09, z1 + 0.006);
  g.add(key);
  setMM(g, { kind: 'shaft', axis: 'z', r: K189.shaftR, z0, z1: z1 + 0.015 });
  return g;
}

/** 연결 링크: 원점 = 아래 끝 눈 R, 로컬 +Y 위로 LINK. 두 눈 구멍. z 0.105 ~ 0.15. 강철 */
export function link189(): THREE.Group {
  const g = new THREE.Group();
  const t = K189.zL1 - K189.zL0;
  const w = 0.045;
  const r = 0.075;
  const shape = new THREE.Shape();
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const a = Math.PI + (Math.PI * i) / N;
    const px = r * Math.cos(a);
    const py = r * Math.sin(a);
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.lineTo(w, K189.LINK);
  for (let i = 0; i <= N; i++) {
    const a = (Math.PI * i) / N;
    shape.lineTo(r * Math.cos(a), K189.LINK + r * Math.sin(a));
  }
  shape.lineTo(-r, 0);
  const h0 = new THREE.Path();
  h0.absarc(0, 0, 0.034, 0, Math.PI * 2, true);
  const h1 = new THREE.Path();
  h1.absarc(0, K189.LINK, 0.034, 0, Math.PI * 2, true);
  shape.holes.push(h0, h1);
  const m = mesh(extrude(shape, t, 0.004, 24), steel());
  m.position.z = (K189.zL0 + K189.zL1) / 2;
  g.add(m);
  setMM(g, { kind: 'link', length: K189.LINK });
  return g;
}

/** 당김판(T 꼴): 원점 = 당김 막대 중심선과 D 눈 높이의 교점 C1. 위로 길게 올라가는 가는 막대, 오른쪽으로 ARM 만큼 뻗어 D 눈.
 *  윗끝에 손잡이 공. z 0.155 ~ 0.2. 강철. 위아래로만 미끄러진다 */
export function puller189(): THREE.Group {
  const g = new THREE.Group();
  const t = K189.zP1 - K189.zP0;
  const zc = (K189.zP0 + K189.zP1) / 2;
  const hw = 0.03;
  const top = K189.topY - D0_189[1];
  const body = mesh(extrude(shapeFrom([[-hw, top], [-hw, 0], [hw, 0], [hw, top]]), t, 0.004, 24), steel());
  body.position.z = zc;
  g.add(body);
  const arm = mesh(new THREE.BoxGeometry(K189.ARM, 0.07, t), steel());
  arm.position.set(K189.ARM / 2, 0, zc);
  g.add(arm);
  g.add(discZ(0.13, K189.zP0, K189.zP1, steel(), 0, 0));
  g.add(discZ(0.1, K189.zP0, K189.zP1, steel(), K189.ARM, 0));
  g.add(discZ(0.06, K189.zP1, K189.zP1 + 0.014, darkSteel(), 0, 0));
  // D 핀(링크와 당김판을 꿴다)
  g.add(discZ(0.032, K189.zL0 - 0.004, K189.zP1 + 0.012, darkSteel(), K189.ARM, 0));
  g.add(discZ(0.055, K189.zP1 + 0.012, K189.zP1 + 0.024, steel(), K189.ARM, 0));
  const ball = mesh(new THREE.SphereGeometry(0.05, 20, 14), paint(0xf2b619));
  ball.position.set(0, top + 0.04, zc);
  g.add(ball);
  setMM(g, { kind: 'rod', fn: 'puller189' });
  return g;
}

/** 당김 막대 안내(고정): 뒤판에서 나온 받침 덩이 + 옆 기둥 + 앞 띠. 원점 = 막대 중심선. 막대는 z 0.155~0.2 */
export function guide189(): THREE.Group {
  const g = new THREE.Group();
  const z0 = STAGE.backZ;
  const H = K189.guideH;
  const blk = mesh(new THREE.BoxGeometry(0.22, H, K189.zP0 - 0.004 - z0), castIron());
  blk.position.z = (z0 + K189.zP0 - 0.004) / 2;
  g.add(blk);
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.05, H, 0.1), castIron());
    post.position.set(s * 0.085, 0, K189.zP0 - 0.004 + 0.05);
    g.add(post);
  }
  const strap = mesh(new THREE.BoxGeometry(0.22, H, 0.03), castIron());
  strap.position.z = K189.zP0 - 0.004 + 0.1 + 0.015;
  g.add(strap);
  setMM(g, { kind: 'guide' });
  return g;
}

/** R 핀(막대와 링크를 꿴다) */
export function pinE189(): THREE.Group {
  const g = new THREE.Group();
  g.add(discZ(0.03, K189.zR0 - 0.003, K189.zL1 + 0.012, darkSteel(), 0, 0));
  g.add(discZ(0.05, K189.zL1 + 0.012, K189.zL1 + 0.024, steel(), 0, 0));
  return g;
}
