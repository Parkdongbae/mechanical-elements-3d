// 번호 전용 키트 (507 · 189번) — 편심 막대 분리 장치 변형 3: 받침점 P 에 걸린 가로 막대(왼쪽 끝이 갈라진 홈 gab, 위로 굽은 팔 끝에 눈 고리)와
// 위에서 당기는 막대(T 꼴 당김판) + 연결 링크. 당김 막대를 끌어올리면 링크가 막대 오른쪽 끝을 들어 올려 막대가 받침점을 축으로 돌고 왼쪽 갈라진 끝이 내려간다.
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, mesh, shapeFrom } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { setMM } from './mm';
import { STAGE } from './stand';

/** 판화 px → 모형. 1 px = 0.0075, 막대 가운데 높이(py 378) = 1.09 */
export const K189 = {
  PX: 0.5, // 받침점 P (막대 축)
  PY: 1.09,
  ER: 0.85, // P → 링크가 붙는 오른쪽 눈 E 거리
  LINK: 1.06, // 링크 길이 D–E
  DX: 1.31, // D 의 x (당김판이 세로로만 움직이므로 고정)
  ARM: 0.43, // 당김 막대 중심 C1 ↔ D 가로 거리
  PHI: 0.17, // 분리 때 막대가 도는 각(rad, 반시계 = 오른쪽 끝이 올라감)
  rodH: 0.1, // 막대 반높이
  rodL: 2.15, // P 에서 왼쪽 끝까지
  rodR: 1.15, // P 에서 오른쪽 끝까지
  zR0: 0.05, // 막대 z 0.05 ~ 0.10
  zR1: 0.1,
  zL0: 0.105, // 링크 z 0.105 ~ 0.15
  zL1: 0.15,
  zP0: 0.155, // 당김판 z 0.155 ~ 0.2
  zP1: 0.2,
  ringR: 0.285, // 팔 끝 고리(판화 38 px)
  ringIn: 0.165,
  QX: -0.09, // 고리 중심 (P 기준, 막대와 한 몸)
  QY: 0.8,
  topY: 3.08 // 당김 막대 윗끝(쉴 때)
} as const;

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface Gear189 {
  /** 막대가 도는 각 (0 = 걸림, PHI = 분리) */
  phi: number;
  /** 연결 눈 E, 링크 윗끝 D (월드 xy) */
  e: V2;
  d: V2;
  /** 링크 기울기(rad, 위 끝이 오른쪽이면 +) */
  link: number;
  /** 당김 막대가 쉴 때보다 올라간 양 */
  lift: number;
  /** 0 = 걸림, 1 = 분리 */
  open: number;
  /** 갈라진 끝(막대 왼쪽 끝) 높이 */
  tipY: number;
}

/** theta → 자세. open = 0.5 − 0.5·cos(theta − 1.6) — t = 1 (theta 1.6) 이 판화 자세(걸림, open = 0) */
export function gear189(theta: number): Gear189 {
  const open = smooth(0.5 - 0.5 * Math.cos(theta - 1.6));
  const phi = K189.PHI * open;
  const e: V2 = [K189.PX + K189.ER * Math.cos(phi), K189.PY + K189.ER * Math.sin(phi)];
  const dx = K189.DX - e[0];
  const d: V2 = [K189.DX, e[1] + Math.sqrt(K189.LINK * K189.LINK - dx * dx)];
  const d0y = K189.PY + Math.sqrt(K189.LINK * K189.LINK - (K189.DX - (K189.PX + K189.ER)) ** 2);
  return {
    phi,
    e,
    d,
    link: Math.atan2(d[0] - e[0], d[1] - e[1]),
    lift: d[1] - d0y,
    open,
    tipY: K189.PY - K189.rodL * Math.sin(phi)
  };
}

/** 막대의 쉴 때(D 높이) 값 — 링크·당김판 배치용 */
export const D0_189: V2 = [K189.DX, K189.PY + Math.sqrt(K189.LINK * K189.LINK - (K189.DX - (K189.PX + K189.ER)) ** 2)];

function discZ(r: number, z0: number, z1: number, mat: THREE.Material, x: number, y: number): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 32).rotateX(Math.PI / 2), mat);
  m.position.set(x, y, (z0 + z1) / 2);
  return m;
}

/** 편심 막대(분리용): 원점 = 받침점 P, 로컬 +X 오른쪽. 왼쪽 갈라진 끝(gab) · 가운데 위로 불룩(허브) · 위로 굽은 팔 + 눈 고리(어두운 핀 머리) 가 한 몸.
 *  오른쪽 끝에 링크 눈 E(P 에서 ER). z 0.05 ~ 0.10. 주철 */
export function rod189(): THREE.Group {
  const g = new THREE.Group();
  const h = K189.rodH;
  const t = K189.zR1 - K189.zR0;
  const zc = (K189.zR0 + K189.zR1) / 2;
  const L = -K189.rodL;
  const R = K189.rodR;
  const pts: V2[] = [
    [L, -h],
    [R - h, -h]
  ];
  for (let i = 1; i <= 8; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 8;
    pts.push([R - h + h * Math.cos(a), h * Math.sin(a)]);
  }
  pts.push(
    [0.55, h],
    [0.4, 0.16],
    [0.15, 0.22],
    [-0.1, 0.23],
    [-0.35, 0.17],
    [-0.55, h],
    [L, h],
    [L, 0.028],
    [L + 0.62, 0.028],
    [L + 0.62, -0.028],
    [L, -0.028]
  );
  const shape = shapeFrom(pts);
  const holeP = new THREE.Path();
  holeP.absarc(0, 0, 0.049, 0, Math.PI * 2, true);
  shape.holes.push(holeP);
  const holeE = new THREE.Path();
  holeE.absarc(K189.ER, 0, 0.034, 0, Math.PI * 2, true);
  shape.holes.push(holeE);
  const body = mesh(extrude(shape, t, 0.004, 48), castIron());
  body.position.z = zc;
  g.add(body);

  // 위로 굽은 팔: 허브에서 고리 아래까지 (두 선이 퍼지는 띠)
  const q: V2 = [K189.QX, K189.QY];
  const ctrl: V2 = [-0.12, 0.3];
  const left: V2[] = [];
  const right: V2[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const p0: V2 = [0.0, 0.17];
    const p1 = ctrl;
    const p2: V2 = [q[0], q[1] - K189.ringR * 0.8];
    const x = (1 - u) * (1 - u) * p0[0] + 2 * u * (1 - u) * p1[0] + u * u * p2[0];
    const y = (1 - u) * (1 - u) * p0[1] + 2 * u * (1 - u) * p1[1] + u * u * p2[1];
    const tx = 2 * (1 - u) * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0]);
    const ty = 2 * (1 - u) * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1]);
    const n = Math.hypot(tx, ty);
    const w = 0.07 + 0.045 * u;
    left.push([x - (ty / n) * w, y + (tx / n) * w]);
    right.push([x + (ty / n) * w, y - (tx / n) * w]);
  }
  const armPts = [...left, ...right.reverse()];
  const arm = mesh(extrude(shapeFrom(armPts), t, 0.004, 24), castIron());
  arm.position.z = zc;
  g.add(arm);

  // 눈 고리 + 어두운 핀 머리
  const ring = new THREE.Shape(circlePts(K189.ringR, 64).map(([x, y]): THREE.Vector2 => new THREE.Vector2(x, y)));
  const ringHole = new THREE.Path();
  ringHole.absarc(0, 0, K189.ringIn, 0, Math.PI * 2, true);
  ring.holes.push(ringHole);
  const ringM = mesh(extrude(ring, t, 0.004, 48), castIron());
  ringM.position.set(q[0], q[1], zc);
  g.add(ringM);
  g.add(discZ(K189.ringIn - 0.006, K189.zR0 - 0.005, K189.zR1 + 0.012, darkSteel(), q[0], q[1]));
  g.add(discZ(0.05, K189.zR1 + 0.012, K189.zR1 + 0.02, steel(), q[0], q[1]));

  setMM(g, { kind: 'rod', fn: 'rod189' });
  return g;
}

/** 연결 링크: 원점 = 아래 끝 눈 E, 로컬 +Y 위로 LINK. 두 눈 구멍. z 0.105 ~ 0.15. 강철 */
export function link189(): THREE.Group {
  const g = new THREE.Group();
  const t = K189.zL1 - K189.zL0;
  const w = 0.045;
  const r = 0.075;
  const shape = new THREE.Shape();
  const N = 14;
  // 아래 눈(원점) 반원 → 오른쪽 변 → 위 눈 반원 → 왼쪽 변
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

/** 당김판(T 꼴): 원점 = 당김 막대 중심선과 D 눈 높이의 교점 C1. 위로 길게 올라가는 가는 막대(윗끝 topY − 쉴 때 C1 y), 오른쪽으로 ARM 만큼 뻗어 D 눈.
 *  윗끝에 손잡이 공. z 0.155 ~ 0.2. 강철. 위아래로만 미끄러진다 */
export function puller189(): THREE.Group {
  const g = new THREE.Group();
  const t = K189.zP1 - K189.zP0;
  const zc = (K189.zP0 + K189.zP1) / 2;
  const hw = 0.03;
  const top = K189.topY - D0_189[1];
  const pts: V2[] = [
    [-hw, top],
    [-hw, 0],
    [hw, 0],
    [hw, top]
  ];
  const body = mesh(extrude(shapeFrom(pts), t, 0.004, 24), steel());
  body.position.z = zc;
  g.add(body);
  // 가로 팔: C1 눈 → D 눈
  const arm = mesh(new THREE.BoxGeometry(K189.ARM, 0.07, t), steel());
  arm.position.set(K189.ARM / 2, 0, zc);
  g.add(arm);
  // 눈(둥근 판, 구멍 없이 핀 머리가 덮음): C1 은 판화의 이중 원
  const eyeC = discZ(0.13, K189.zP0, K189.zP1, steel(), 0, 0);
  g.add(eyeC);
  const eyeD = discZ(0.1, K189.zP0, K189.zP1, steel(), K189.ARM, 0);
  g.add(eyeD);
  g.add(discZ(0.06, K189.zP1, K189.zP1 + 0.014, darkSteel(), 0, 0));
  // D 핀(링크와 당김판을 꿴다): 링크 뒷면(zL0)부터 당김판 앞(zP1 + 0.012)까지
  g.add(discZ(0.032, K189.zL0 - 0.004, K189.zP1 + 0.012, darkSteel(), K189.ARM, 0));
  g.add(discZ(0.055, K189.zP1 + 0.012, K189.zP1 + 0.024, steel(), K189.ARM, 0));
  // 손잡이 공
  const ball = mesh(new THREE.SphereGeometry(0.05, 20, 14), paint(0xf2b619));
  ball.position.set(0, top + 0.04, zc);
  g.add(ball);
  setMM(g, { kind: 'rod', fn: 'puller189' });
  return g;
}

/** 당김 막대 안내(고정): 뒤판에서 나온 받침 덩이 + 앞 띠. 원점 = (x, y, 0) 막대 중심선. 막대는 z 0.155~0.2 */
export function guide189(): THREE.Group {
  const g = new THREE.Group();
  const z0 = STAGE.backZ;
  const blk = mesh(new THREE.BoxGeometry(0.22, 0.34, K189.zP0 - 0.004 - z0), castIron());
  blk.position.z = (z0 + K189.zP0 - 0.004) / 2;
  g.add(blk);
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.05, 0.34, 0.1), castIron());
    post.position.set(s * 0.085, 0, K189.zP0 - 0.004 + 0.05 - 0.0);
    g.add(post);
  }
  const strap = mesh(new THREE.BoxGeometry(0.22, 0.34, 0.03), castIron());
  strap.position.z = K189.zP0 - 0.004 + 0.1 + 0.015 - 0.0;
  g.add(strap);
  setMM(g, { kind: 'guide' });
  return g;
}

/** 받침점 핀(고정): 뒤판 → 막대 허브 구멍 → 앞 머리 */
export function pivotPin189(): THREE.Group {
  const g = new THREE.Group();
  const z0 = STAGE.backZ;
  const zTop = K189.zR1 + 0.1;
  const pin = mesh(new THREE.CylinderGeometry(0.045, 0.045, zTop - z0, 24).rotateX(Math.PI / 2), steel());
  pin.position.z = (z0 + zTop) / 2;
  g.add(pin);
  const boss = mesh(new THREE.CylinderGeometry(0.09, 0.1, K189.zR0 - 0.004 - z0, 28).rotateX(Math.PI / 2), darkSteel());
  boss.position.z = (z0 + K189.zR0 - 0.004) / 2;
  g.add(boss);
  g.add(discZ(0.075, zTop, zTop + 0.025, steel(), 0, 0));
  setMM(g, { kind: 'shaft', axis: 'z', r: 0.045, z0, z1: zTop + 0.025 });
  return g;
}

/** E 핀(막대와 링크를 꿴다): 막대 뒷면 앞쪽부터 링크 앞까지 */
export function pinE189(): THREE.Group {
  const g = new THREE.Group();
  g.add(discZ(0.03, K189.zR0 - 0.003, K189.zL1 + 0.012, darkSteel(), 0, 0));
  g.add(discZ(0.05, K189.zL1 + 0.012, K189.zL1 + 0.024, steel(), 0, 0));
  return g;
}
