// 번호 전용 키트 (507 · 190번) — 나사 죔쇠: 받침점 F 에 얹힌 굽은 지레(홀더), 지레 왼쪽 끝에 걸린 눌림쇠(턱), 지레 꼬리의 나사(손잡이) 와 받침 모루,
// 눌러 둘 나무 조각. 나사를 조이면 나사 끝이 고정 모루를 눌러 꼬리를 밀어 올리고, 지레가 F 를 축으로 돌아 왼쪽 눌림쇠가 나무 조각을 누른다.
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { extrude, mesh, shapeFrom, threadedRod } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { setMM } from './mm';
import { STAGE } from './stand';

// 받침 z 범위(바닥판·모루·뺨)
const ZB0 = 0.125;
const ZB1 = 0.375;

/** 판화 px → 모형: X = (px − 225)·S, Y = (340 − py)·S + 1.2 (판 윗면 py 340 = 1.2), S = 0.0105 */
const S = 0.0105;
const X = (px: number): number => (px - 225) * S;
const Y = (py: number): number => (340 - py) * S + 1.2;

export const K190 = {
  BY: 1.2, // 작업대 판 윗면
  ZS: 0.25, // 기구 가운데 z (나사 축)
  FX: X(232), // 지레 받침점 F
  FY: Y(275),
  JX: X(130), // 눌림쇠 핀 J
  JY: Y(285),
  SX: X(320), // 나사 축 x
  lugL: 0.27, // J 에서 눌림쇠 바닥까지
  beta: 0.15, // 풀었을 때 지레가 도는 각(rad, 시계)
  screwR: 0.075,
  hole: 0.12, // 꼬리 보스(나사 구멍) 안 반지름
  bossR: 0.2, // 꼬리 보스 바깥 반지름
  lead: 0.07, // 나사 피치
  turns: 2, // 닫힘 → 열림 나사 회전 수
  handleY: 2.3, // 손잡이 막대 아랫면
  grip: 0.42,
  zL0: 0.195, // 지레 z 0.195 ~ 0.305
  zL1: 0.305,
  zC0: 0.125, // 받침 뺨 뒤 z 0.125 ~ 0.185, 앞 0.315 ~ 0.375
  zJ0: 0.31, // 눌림쇠 z 0.31 ~ 0.37
  zJ1: 0.37
} as const;

/** 지레 윤곽(판화 px 에서 딴 점, 월드 좌표). 원점 F 로 옮겨 쓴다 */
const RAW: V2[] = [
  [108, 288], [122, 270], [145, 252], [180, 241], [225, 237], [265, 240], [290, 246], [301, 252], [306, 262], [306, 283],
  [296, 286], [285, 288], [275, 291], [262, 294], [232, 297], [200, 295], [165, 293], [140, 299], [118, 299], [106, 294]
].map(([px, py]): V2 => [X(px as number), Y(py as number)]);

/** 꼬리 보스 위·아랫면(F 로컬) */
const BOSS_TOP = Y(256) - K190.FY;
const BOSS_BOT = Y(287) - K190.FY;

let cacheLever: V2[] | null = null;
/** 지레 윤곽(F 로컬, 반시계) */
export function leverOutline190(): V2[] {
  if (cacheLever) return cacheLever;
  const c = new THREE.CatmullRomCurve3(
    RAW.map(([x, y]) => new THREE.Vector3(x - K190.FX, y - K190.FY, 0)),
    true,
    'centripetal'
  );
  const pts: V2[] = c.getSpacedPoints(200).slice(0, -1).map((p): V2 => [p.x, p.y]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as V2;
    const b = pts[(i + 1) % pts.length] as V2;
    area += a[0] * b[1] - b[0] * a[1];
  }
  cacheLever = area < 0 ? pts.reverse() : pts;
  return cacheLever;
}

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface Clamp190 {
  /** 지레 각(rad, 0 = 닫힘 = 판화 자세, 음수 = 풀림(시계)) */
  lev: number;
  /** 나사 회전(rad, y 축 둘레; 닫힘 0, 풀수록 + ) */
  psi: number;
  /** 0 = 열림, 1 = 닫힘 */
  closed: number;
  /** 눌림쇠 핀 J 의 월드 위치 */
  jx: number;
  jy: number;
  /** 눌림쇠 바닥과 나무 조각 윗면의 간격 */
  gap: number;
  /** 나사 끝이 모루를 누르는 힘 대신, 꼬리 밑면과 모루 윗면의 간격(나사 끝이 밑으로 나온 길이) */
  tipOut: number;
}

/** 나무 조각 윗면 높이: 닫힘 자세에서 눌림쇠 바닥이 닿는 높이 */
export const BLOCK_TOP190 = K190.JY - K190.lugL + 0.001;

/** 모루(나사 끝이 얹히는 고정판) 윗면 높이: 풀린 자세에서 꼬리 밑면의 가장 낮은 곳 − 0.025 (식으로 계산) */
function anvilTop(): number {
  const o = leverOutline190();
  const c = Math.cos(-K190.beta);
  const s = Math.sin(-K190.beta);
  let low = Infinity;
  for (const [x, y] of o) {
    const wx = K190.FX + x * c - y * s;
    const wy = K190.FY + x * s + y * c;
    if (wx > K190.SX - 0.25) low = Math.min(low, wy);
  }
  for (const dx of [-K190.bossR, K190.bossR]) {
    const x = K190.SX - K190.FX + dx;
    low = Math.min(low, K190.FY + x * s + BOSS_BOT * c);
  }
  return low - 0.03;
}
export const ANVIL_TOP190 = anvilTop();

/** theta → 자세. closed = 1 이 판화 자세 */
export function clamp190(theta: number): Clamp190 {
  const closed = smooth(0.5 + 0.5 * Math.cos(theta - 1.6) * 1.15);
  const lev = -K190.beta * (1 - closed);
  const psi = K190.turns * 2 * Math.PI * (1 - closed);
  const c = Math.cos(lev);
  const s = Math.sin(lev);
  const jx = K190.FX + (K190.JX - K190.FX) * c - (K190.JY - K190.FY) * s;
  const jy = K190.FY + (K190.JX - K190.FX) * s + (K190.JY - K190.FY) * c;
  return { lev, psi, closed, jx, jy, gap: jy - K190.lugL - BLOCK_TOP190 + 0.001, tipOut: 0 };
}

/** 지레(홀더): 원점 = F, z 가운데 0. 나사 구멍(꼬리)·F 핀 구멍·J 핀 구멍. 주철. outlines.leverHole 아님(구멍은 느슨한 둥근 구멍) */
export function lever190(): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(leverOutline190());
  const hf = new THREE.Path();
  hf.absarc(0, 0, 0.044, 0, Math.PI * 2, true);
  const hj = new THREE.Path();
  hj.absarc(K190.JX - K190.FX, K190.JY - K190.FY, 0.037, 0, Math.PI * 2, true);
  shape.holes.push(hf, hj);
  const body = mesh(extrude(shape, K190.zL1 - K190.zL0, 0.004, 48), castIron());
  body.position.z = (K190.zL0 + K190.zL1) / 2;
  g.add(body);
  // 꼬리 보스: 나사가 지나는 세로 구멍(y 방향)이 뚫린 고리 — 꼬리 끝에 한 몸
  const ring = new THREE.Shape();
  ring.absarc(0, 0, K190.bossR, 0, Math.PI * 2, false);
  const rh = new THREE.Path();
  rh.absarc(0, 0, K190.hole, 0, Math.PI * 2, true);
  ring.holes.push(rh);
  const rg = extrude(ring, BOSS_TOP - BOSS_BOT, 0.004, 48);
  rg.rotateX(Math.PI / 2);
  const boss = mesh(rg, castIron());
  boss.position.set(K190.SX - K190.FX, (BOSS_TOP + BOSS_BOT) / 2, (K190.zL0 + K190.zL1) / 2);
  g.add(boss);
  setMM(g, { kind: 'lever', fn: 'lever190' });
  return g;
}

/** 눌림쇠(턱): 원점 = J, 아래로 lugL 의 사다리꼴 쇠판 + 바닥 판. z 0.31 ~ 0.37 (지레 앞). 강철 */
export function jaw190(): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const a = Math.PI - (Math.PI * i) / N; // 왼쪽 → 위 → 오른쪽
    const p: [number, number] = [0.1 * Math.cos(a), 0.1 * Math.sin(a)];
    if (i === 0) shape.moveTo(p[0], p[1]);
    else shape.lineTo(p[0], p[1]);
  }
  shape.lineTo(0.13, -0.2);
  shape.lineTo(0.15, -K190.lugL);
  shape.lineTo(-0.15, -K190.lugL);
  shape.lineTo(-0.13, -0.2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.037, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const m = mesh(extrude(shape, K190.zJ1 - K190.zJ0, 0.004, 24), steel());
  m.position.z = (K190.zJ0 + K190.zJ1) / 2;
  g.add(m);
  setMM(g, { kind: 'jaw', fn: 'jaw190' });
  return g;
}

/** 눌림쇠·받침점 핀(고정 위치에 둔 핀 + 머리). 원점 = 핀 중심, z 는 뒤 끝 z0 ~ 앞 z1 */
export function pin190(z0: number, z1: number, r = 0.035): THREE.Group {
  const g = new THREE.Group();
  const p = mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 20).rotateX(Math.PI / 2), darkSteel());
  p.position.z = (z0 + z1) / 2;
  g.add(p);
  const head = mesh(new THREE.CylinderGeometry(r * 1.7, r * 1.7, 0.018, 24).rotateX(Math.PI / 2), steel());
  head.position.z = z1 + 0.009;
  g.add(head);
  return g;
}

/** 받침(고정): 바닥판 + 받침점 뺨 둘(지레를 사이에 낌) + 나사 모루(오른쪽 벽 + 윗판). 원점 = (0,0,0) 월드. 주철 */
export function frame190(): THREE.Group {
  const g = new THREE.Group();
  const by = K190.BY;
  // 바닥판
  const x0 = K190.FX - 0.4;
  const x1 = K190.SX + 0.32;
  const base = mesh(new THREE.BoxGeometry(x1 - x0, 0.08, ZB1 - ZB0), castIron());
  base.position.set((x0 + x1) / 2, by + 0.04, (ZB0 + ZB1) / 2);
  g.add(base);
  // 받침점 뺨 둘: 아래가 넓고 위가 F 둘레 둥근 판
  const cheek = new THREE.Shape();
  cheek.moveTo(K190.FX - 0.32, by + 0.07);
  cheek.lineTo(K190.FX + 0.32, by + 0.07);
  cheek.lineTo(K190.FX + 0.2, K190.FY - 0.02);
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const a = (Math.PI * i) / N;
    cheek.lineTo(K190.FX + 0.19 * Math.cos(a), K190.FY - 0.0 + 0.19 * Math.sin(a) * 1.0);
  }
  cheek.lineTo(K190.FX - 0.2, K190.FY - 0.02);
  cheek.closePath();
  const hole = new THREE.Path();
  hole.absarc(K190.FX, K190.FY, 0.037, 0, Math.PI * 2, true);
  cheek.holes.push(hole);
  for (const [za, zb] of [
    [ZB0, K190.zL0 - 0.002],
    [K190.zL1 + 0.002, ZB1]
  ] as const) {
    const m = mesh(extrude(cheek, zb - za, 0.004, 24), castIron());
    m.position.z = (za + zb) / 2;
    g.add(m);
  }
  // 나사 모루: 오른쪽 벽 + 윗판
  const ay = ANVIL_TOP190;
  const wall = mesh(new THREE.BoxGeometry(0.22, ay - (by + 0.08) - 0.12, ZB1 - ZB0), castIron());
  wall.position.set(K190.SX + 0.21, by + 0.08 + (ay - by - 0.08 - 0.12) / 2, (ZB0 + ZB1) / 2);
  g.add(wall);
  const plate = mesh(new THREE.BoxGeometry(0.62, 0.12, ZB1 - ZB0), castIron());
  plate.position.set(K190.SX + 0.1 - 0.0, ay - 0.06, (ZB0 + ZB1) / 2);
  g.add(plate);
  setMM(g, { kind: 'frame', fn: 'frame190' });
  return g;
}

/** 나사 + 손잡이: 원점 = 나사 끝(모루 윗면), 축 +Y, 자체 회전 rotation.y = psi. 끝에서 위로 나사산, 위는 매끈한 기둥, 맨 위 손잡이 막대 + 공 */
export function screw190(): THREE.Group {
  const g = new THREE.Group();
  const R = K190.screwR;
  const top = K190.handleY - ANVIL_TOP190; // 손잡이 막대 아랫면
  const thread = mesh(threadedRod({ rMajor: R, depth: 0.014, pitch: K190.lead, y0: 0, y1: 0.55, chamfer0: true, segs: 48 }), steel());
  g.add(thread);
  const shaft = mesh(new THREE.CylinderGeometry(R - 0.012, R - 0.012, top - 0.5, 28), steel());
  shaft.position.y = 0.5 + (top - 0.5) / 2;
  g.add(shaft);
  // 손잡이 막대(+X 쪽으로 grip, 반대로 짧게) + 공 — 막대와 공은 막대 자체 좌표
  const bar = mesh(new THREE.BoxGeometry(K190.grip + 0.12, 0.07, 0.07), darkSteel());
  bar.position.set((K190.grip - 0.12) / 2, top + 0.035, 0);
  g.add(bar);
  const hub = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 28), darkSteel());
  hub.position.y = top + 0.035;
  g.add(hub);
  const ball = mesh(new THREE.SphereGeometry(0.052, 20, 14), paint(0xf2b619));
  ball.position.set(K190.grip + 0.012, top + 0.035, 0);
  g.add(ball);
  setMM(g, { kind: 'screw', fn: 'screw190', axis: 'y' });
  return g;
}

/** 작업대 판(나무, 뒤판에 붙은 선반)과 눌려지는 나무 조각 */
export function bench190(): THREE.Group {
  const g = new THREE.Group();
  const slab = mesh(new THREE.BoxGeometry(4.1, 0.45, 0.95), wood(0xb98a52));
  slab.position.set(0.05, K190.BY - 0.225, STAGE.backZ + 0.475);
  g.add(slab);
  setMM(g, { kind: 'bench' });
  return g;
}

export function block190(): THREE.Mesh {
  const h = BLOCK_TOP190 - K190.BY;
  const m = mesh(new THREE.BoxGeometry(0.95, h, 0.56), wood(0xd9b27c));
  m.position.set(X(134), K190.BY + h / 2, 0.25);
  return m;
}
