// 261번 복합 운동 추 올리기 전용 키트 — 4절 연쇄(원판 B 크랭크 → 막대 C → 팔 A) + 줄 길이 보존 시간표 + 부품
// 설계표 docs/mm507-sheets/261.md 의 수치·식 그대로.
import * as THREE from 'three';
import { brass, castIron, darkSteel, rubber, steel } from '../../models/materials';
import { circlePath, extrude, hexPrism, lathe, mesh, rodProfile, tubeProfile, type V2 } from '../../models/parts/geom';

/** 261번 상수 — O 원판 축, G 팔 A 받침점(세계) */
export const K261 = {
  O: [0.3, 0.95] as V2,
  G: [1.05, 2.45] as V2,
  A_LEN: 0.95,
  A_E: 1.3,
  RC: 0.2,
  LC: 1.493,
  R_DRUM: 0.08,
  R_E: 0.26,
  ZR: -0.095,
  C0: 3.6277,
  OMEGA: (4 * Math.PI) / 10,
  PERIOD: 22
} as const;
const K = K261;
const TAU = Math.PI * 2;

/** 구동 표 — 22 s 왕복(감기 2바퀴 → 풀기 2바퀴), 되돌림은 거울 대칭 */
export function theta261(t: number): number {
  let u = ((t % K.PERIOD) + K.PERIOD) % K.PERIOD;
  if (u > 11) u = K.PERIOD - u;
  const w = K.OMEGA;
  if (u <= 1) return (w * u * u) / 2;
  if (u <= 10) return w * (u - 0.5);
  return 4 * Math.PI - (w * (11 - u) * (11 - u)) / 2;
}

export interface State261 {
  theta: number;
  P: V2;
  J: V2;
  psi: number;
  E: V2;
  T1: V2;
  T2: V2;
  wrapE: number;
  yRing: number;
  phiE: number;
}

/** 결정적 자세 — theta 하나에서 4절·줄 접점·줄 길이 보존으로 W 높이까지 */
export function state261(t: number): State261 {
  const theta = theta261(t);
  const [ox, oy] = K.O;
  const [gx, gy] = K.G;
  const P: V2 = [ox + K.RC * Math.cos(theta), oy + K.RC * Math.sin(theta)];
  // J = 원(G, A_LEN) ∩ 원(P, LC) 중 y 가 큰 쪽
  const dx = P[0] - gx;
  const dy = P[1] - gy;
  const d = Math.hypot(dx, dy);
  const l = (K.A_LEN * K.A_LEN - K.LC * K.LC + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, K.A_LEN * K.A_LEN - l * l));
  const ex = dx / d;
  const ey = dy / d;
  const j1: V2 = [gx + l * ex - h * ey, gy + l * ey + h * ex];
  const j2: V2 = [gx + l * ex + h * ey, gy + l * ey - h * ex];
  const J = j1[1] >= j2[1] ? j1 : j2;
  const psi = Math.atan2(J[1] - gy, J[0] - gx);
  const E: V2 = [gx + K.A_E * Math.cos(psi), gy + K.A_E * Math.sin(psi)];
  // 줄 안쪽 가닥: 드럼 왼쪽 → E 오른쪽 안쪽 공통접선
  const Dx = E[0] - ox;
  const Dy = E[1] - oy;
  const Dl = Math.hypot(Dx, Dy);
  const tau = Math.atan2(Dy, Dx) - Math.asin((K.R_DRUM + K.R_E) / Dl);
  const tx = Math.cos(tau);
  const ty = Math.sin(tau);
  const T1: V2 = [ox + K.R_DRUM * -ty, oy + K.R_DRUM * tx];
  const T2: V2 = [E[0] + K.R_E * ty, E[1] - K.R_E * tx];
  let aT = Math.atan2(T1[1] - oy, T1[0] - ox);
  aT = ((aT % TAU) + TAU) % TAU;
  const a1 = Math.atan2(T2[1] - E[1], T2[0] - E[0]);
  const wrapE = (((Math.PI - a1) % TAU) + TAU) % TAU;
  // 줄 길이 보존
  const yRing = E[1] + K.R_DRUM * (theta - aT) + Math.hypot(T2[0] - T1[0], T2[1] - T1[1]) + K.R_E * wrapE - K.C0;
  const phiE = (E[1] - yRing) / K.R_E;
  return { theta, P, J, psi, E, T1, T2, wrapE, yRing, phiE };
}

/** Y축 회전체 프로파일(y = 세계 z)을 Z축으로 눕힌다 */
function zLathe(profile: V2[], segs: number, mat: THREE.Material, name?: string): THREE.Mesh {
  const geo = lathe(profile, segs);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, mat);
  if (name) m.name = name;
  return m;
}

/** 육각 너트(Z축, z0~z1, 구멍 bore) */
function zNut(af: number, z0: number, z1: number, bore: number, mat: THREE.Material, name: string): THREE.Mesh {
  const geo = hexPrism(af, z1 - z0, true, true, bore);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, mat);
  m.position.z = (z0 + z1) / 2;
  m.name = name;
  return m;
}

/** 위 한 줄에 놓인 원(중심 x, 반지름) 들을 폭 2w 막대로 잇는 윤곽 — 중간 원은 위아래로 불룩 */
function barShape(circles: { x: number; r: number }[], w: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = circles.length;
  const cs = circles.map((c) => ({ x: c.x, r: c.r, sq: Math.sqrt(c.r * c.r - w * w), b: Math.asin(w / c.r) }));
  for (let i = 0; i < n; i++) {
    const c = cs[i]!;
    if (i === 0) s.moveTo(c.x + c.sq, -w);
    else s.lineTo(c.x - c.sq, -w);
    if (i === n - 1) s.absarc(c.x, 0, c.r, -(Math.PI - c.b), Math.PI - c.b, false);
    else if (i > 0) s.absarc(c.x, 0, c.r, -(Math.PI - c.b), -c.b, false);
  }
  for (let i = n - 2; i >= 0; i--) {
    const c = cs[i]!;
    s.lineTo(c.x + c.sq, w);
    if (i > 0) s.absarc(c.x, 0, c.r, c.b, Math.PI - c.b, false);
    else s.absarc(c.x, 0, c.r, c.b, TAU - c.b, false);
  }
  s.closePath();
  return s;
}

/** 원판 축: 뒤판 보스(돌지 않음, userData.boss) + 축 막대(name axleB, 돈다). 축 끝은 크랭크 팔 허브 속(−0.002)에서 끝난다 */
export function axleB261(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'axleB';
  // 막대: 뒤판 보스 속(−0.29)에서 허브 속(−0.002)까지
  g.add(zLathe(rodProfile(0.04, -0.29, -0.002, 0, 0), 32, steel(), 'axleBRod'));
  const boss = zLathe(rodProfile(0.096, -0.3, -0.2, 0, 0.008), 40, darkSteel(), 'bossB');
  g.userData.boss = boss;
  return g;
}

/** 드럼: 심(drumCore) + 앞 턱(drumFlange) + 감긴 줄 고리 3개. 원점 = 원판 축, 뒤 턱은 원판 B 앞면 */
export function drum261(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'drum';
  g.add(zLathe(tubeProfile(0.041, 0.062, -0.14, -0.05, 0.003), 48, darkSteel(), 'drumCore'));
  g.add(zLathe(tubeProfile(0.041, 0.12, -0.05, -0.038, 0.003), 48, brass(), 'drumFlange'));
  const ropeMat = rubber().clone();
  ropeMat.color.set(0x8a6a3a);
  [-0.113, -0.095, -0.077].forEach((z, i) => {
    const ring = mesh(new THREE.TorusGeometry(0.08, 0.018, 10, 48), ropeMat);
    ring.position.z = z;
    ring.name = `drumRope${i}`;
    g.add(ring);
  });
  return g;
}

/** 크랭크 팔: 허브 r 0.065 + 막대 + 핀 보스 r 0.04(로컬 (0.20, 0)), z −0.03~0, 핀·와셔·너트 포함. 로컬 +X 가 핀 쪽 */
export function crankArm261(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'crankArm';
  const body = mesh(extrude(barShape([{ x: 0, r: 0.065 }, { x: K.RC, r: 0.04 }], 0.03), 0.03, 0.003, 24), darkSteel());
  body.position.z = -0.015;
  body.name = 'crankArmBody';
  g.add(body);
  // 핀: 보스 속(−0.028)에서 너트 속(0.055)까지
  const pin = zLathe(rodProfile(0.02, -0.028, 0.055, 0, 0), 24, steel(), 'crankPin');
  pin.position.x = K.RC;
  const washer = zLathe(tubeProfile(0.0205, 0.034, 0.041, 0.047, 0.001), 28, steel(), 'crankWasher');
  washer.position.x = K.RC;
  const nut = zNut(0.07, 0.048, 0.063, 0.0205, darkSteel(), 'crankNut');
  nut.position.x = K.RC;
  g.add(pin, washer, nut);
  return g;
}

/** 막대 C: 원점 = P, 로컬 +X 가 J 쪽. 폭 0.05, z 0.01~0.04, 끝 보스 r 0.04, 구멍 0.021 */
export function link261(len: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'rodC';
  const shape = barShape([{ x: 0, r: 0.04 }, { x: len, r: 0.04 }], 0.025);
  shape.holes.push(circlePath(0, 0, 0.021), circlePath(len, 0, 0.021));
  const body = mesh(extrude(shape, 0.03, 0.003, 24), steel());
  body.position.z = 0.025;
  body.name = 'rodCBody';
  g.add(body);
  return g;
}

/** 팔 A: 원점 = G, 로컬 −X 쪽으로 뻗음. 관절 핀 J(−0.95)·E 축(−1.30)·와셔·사이 관·너트 포함 */
export function armA261(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'armA';
  const shape = barShape([{ x: -K.A_E, r: 0.055 }, { x: -K.A_LEN, r: 0.045 }, { x: 0, r: 0.07 }], 0.035);
  shape.holes.push(circlePath(-K.A_E, 0, 0.031), circlePath(-K.A_LEN, 0, 0.021), circlePath(0, 0, 0.041));
  const body = mesh(extrude(shape, 0.04, 0.003, 24), castIron());
  body.position.z = 0.07;
  body.name = 'armABody';
  g.add(body);
  // 관절 핀 J — 뒤 와셔 · 사이 와셔 · 앞 너트
  const at = (o: THREE.Object3D, x: number): THREE.Object3D => {
    o.position.x = x;
    g.add(o);
    return o;
  };
  at(zLathe(rodProfile(0.02, 0.004, 0.109, 0, 0), 24, steel(), 'jointPinJ'), -K.A_LEN);
  at(zLathe(tubeProfile(0.0205, 0.034, 0.002, 0.008, 0.001), 28, steel(), 'jointWasherBack'), -K.A_LEN);
  at(zLathe(tubeProfile(0.0205, 0.034, 0.041, 0.049, 0.001), 28, steel(), 'jointWasherMid'), -K.A_LEN);
  at(zNut(0.07, 0.091, 0.106, 0.0205, darkSteel(), 'jointNutJ'), -K.A_LEN);
  // E 축 — 뒤 와셔 · 사이 관 · 앞 너트
  at(zLathe(rodProfile(0.03, -0.185, 0.109, 0, 0), 28, steel(), 'axleE'), -K.A_E);
  at(zLathe(tubeProfile(0.0305, 0.05, -0.177, -0.168, 0.001), 32, steel(), 'axleEWasher'), -K.A_E);
  at(zLathe(tubeProfile(0.031, 0.045, -0.024, 0.049, 0.001), 32, steel(), 'axleESpacer'), -K.A_E);
  at(zNut(0.08, 0.091, 0.106, 0.0305, darkSteel(), 'axleENut'), -K.A_E);
  return g;
}
