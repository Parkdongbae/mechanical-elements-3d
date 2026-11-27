// 237번 왕관 래칫 전용 키트 — 원통에 감은 톱날 이 24개 그릇, 초승달 폴, 팔, 닫힌 식 운동(폴 들림 표는 적재 때 한 번)
// 설계표 docs/mm507-sheets/237.md 의 수치·점열 그대로.
import * as THREE from 'three';
import { brass, castIron, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { circleIntersect } from './misc';
import { markPin, setMM } from './mm';

export const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

/** 237번 상수 — 각은 모두 라디안 */
export const K237 = {
  XC: -0.35,
  ZC: 0.3,
  N: 24,
  Rm: 0.46,
  rIn: 0.43,
  rOut: 0.49,
  sp: 0.120428,
  yRoot: 1.2,
  yTip: 1.275,
  d: 0.027298,
  seat: [-0.025286, 1.228538] as V2,
  L: 0.323562,
  lam0: -32 * D2R,
  pinT: -0.274395,
  pinY: 1.4,
  pinR: 0.535624,
  pinOff: 30.8165 * D2R,
  TH0: -20 * D2R,
  aLo: -10.125 * D2R,
  aHi: 10.125 * D2R,
  slack: 5.25 * D2R,
  RA: 0.82,
  K: [0.628861, -0.029217] as V2,
  rk: 0.144153,
  Lk: 0.644153,
  thF: 70 * D2R,
  rho0: -49.09106 * D2R,
  rn: 0.014
} as const;
const K = K237;
const PITCH = 15 * D2R;

// ───────────────────────── 그릇(크라운) ─────────────────────────

/** 이 24개 — 삼각형 (s, y) 를 반지름 0.43~0.49 원통에 감은 입체. 면마다 따로 꼭짓점(곧은 면·비탈이 각져 보임) */
function sawGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const NG = 8;
  const wrap = (r: number, s: number, y: number): THREE.Vector3 => new THREE.Vector3(r * Math.cos(s / K.Rm), y, r * Math.sin(s / K.Rm));
  for (let k = 0; k < K.N; k++) {
    const A: V2 = [k * K.sp, K.yRoot];
    const B: V2 = [k * K.sp - K.d, K.yTip];
    const C: V2 = [(k + 1) * K.sp, K.yRoot];
    const sc = wrap(K.Rm, (A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3);
    const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(sc);
      if (n.dot(mid) < 0) [b, c] = [c, b];
      for (const p of [a, b, c]) pos.push(p.x, p.y, p.z);
    };
    // 바깥·안쪽 면: 삼각형을 NG 칸으로 나눈 격자
    for (const r of [K.rOut, K.rIn]) {
      const gp = (i: number, j: number): THREE.Vector3 =>
        wrap(r, A[0] + ((C[0] - A[0]) * i) / NG + ((B[0] - A[0]) * j) / NG, A[1] + ((C[1] - A[1]) * i) / NG + ((B[1] - A[1]) * j) / NG);
      for (let i = 0; i < NG; i++) {
        for (let j = 0; i + j < NG; j++) {
          push(gp(i, j), gp(i + 1, j), gp(i, j + 1));
          if (i + j < NG - 1) push(gp(i + 1, j), gp(i + 1, j + 1), gp(i, j + 1));
        }
      }
    }
    // 세 옆면(곧은 면 A→B, 비탈 B→C, 밑변 A→C): 가장자리를 NG 칸으로 나눠 바깥·안쪽을 잇는다(반지름 방향 직선)
    for (const [P, Q] of [
      [A, B],
      [B, C],
      [A, C]
    ] as const) {
      for (let i = 0; i < NG; i++) {
        const s0 = P[0] + ((Q[0] - P[0]) * i) / NG;
        const y0 = P[1] + ((Q[1] - P[1]) * i) / NG;
        const s1 = P[0] + ((Q[0] - P[0]) * (i + 1)) / NG;
        const y1 = P[1] + ((Q[1] - P[1]) * (i + 1)) / NG;
        const o0 = wrap(K.rOut, s0, y0);
        const o1 = wrap(K.rOut, s1, y1);
        const i0 = wrap(K.rIn, s0, y0);
        const i1 = wrap(K.rIn, s1, y1);
        push(o0, o1, i1);
        push(o0, i1, i0);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** 그릇(그룹 원점 = 세로 축 위 바닥 아래 y 0): 바닥·테 벽·톱날 24개·허브·꼭지·노란 표지. name 은 모델이 `crown` 으로 붙인다 */
export function crownSaw237(): THREE.Group {
  const g = new THREE.Group();
  const mat = steel();
  g.add(mesh(lathe(rodProfile(K.rOut, 1.0, 1.04, 0.004, 0.004), 96), mat));
  g.add(mesh(lathe(tubeProfile(K.rIn, K.rOut, 1.0, 1.2, 0.004), 96), mat));
  g.add(mesh(sawGeometry(), mat));
  g.add(mesh(lathe(rodProfile(0.07, 1.04, 1.44, 0, 0.004), 48), mat));
  g.add(mesh(lathe(rodProfile(0.03, 1.44, 1.51, 0, 0), 32), mat));
  g.add(mesh(lathe(rodProfile(0.04, 1.49, 1.51, 0.003, 0.003), 32), mat));
  const mark = mesh(new THREE.BoxGeometry(0.3, 0.006, 0.03), paint(0xffcc00));
  mark.position.set(0.25, 1.043, 0);
  g.add(mark);
  g.userData.mat = mat;
  setMM(g, { kind: 'ratchet', fn: 'crownSaw237', teeth: K.N });
  return g;
}

// ───────────────────────── 폴 ─────────────────────────

export const PAWL237: V2[] = [[0.3320,0.0112],[0.3211,0.0183],[0.3161,0.0186],[0.2940,0.0359],[0.2687,0.0529],[0.2532,0.0599],[0.1613,0.0750],[0.0742,0.0610],[0.0094,0.0360],[-0.0051,0.0346],[-0.0125,0.0327],[-0.0219,0.0273],[-0.0290,0.0195],[-0.0336,0.0097],[-0.0350,-0.0007],[-0.0342,-0.0075],[-0.0320,-0.0141],[-0.0287,-0.0201],[-0.0242,-0.0253],[-0.0188,-0.0295],[-0.0127,-0.0326],[-0.0061,-0.0345],[0.0007,-0.0350],[0.0074,-0.0342],[0.0138,-0.0321],[0.0201,-0.0287],[0.0314,-0.0199],[0.0880,0.0023],[0.1594,0.0142],[0.1650,0.0141],[0.2320,0.0032],[0.2465,-0.0016],[0.2615,-0.0020],[0.3231,-0.0140],[0.3304,-0.0122],[0.3357,-0.0070],[0.3376,0.0003],[0.3355,0.0073]];

/** 폴: 원점 = 폴 핀 중심, 구멍 0.014, 두께 0.04(z 가운데 0). 재질은 폴마다 따로(userData.mat) */
export function pawl237(): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(PAWL237);
  shape.holes.push(circlePath(0, 0, 0.014));
  const mat = brass();
  g.add(mesh(extrude(shape, 0.04, 0.003), mat));
  g.userData.mat = mat;
  g.userData.outline = PAWL237;
  setMM(g, { kind: 'pawl', fn: 'pawl237' });
  return g;
}

// ───────────────────────── 팔 ─────────────────────────

/** 팔: 그룹 원점 = 세로 축 위, 로컬 +X = 팔 방향, 로컬 +Z = 그 방위의 시계 쪽 접선. 안에 pawlFrame(폴이 들어갈 자리) */
export function arm237(): THREE.Group {
  const g = new THREE.Group();
  const mat = castIron();
  g.add(mesh(lathe(tubeProfile(0.031, 0.065, 1.44, 1.48, 0.004), 32), mat));
  const bar = mesh(new THREE.BoxGeometry(0.79, 0.04, 0.035), mat);
  bar.position.set(0.455, 1.46, 0);
  g.add(bar);
  const endPin = mesh(lathe(rodProfile(0.022, 1.48, 1.56, 0, 0.003), 24), mat);
  endPin.position.set(K.RA, 0, 0);
  g.add(endPin);
  const armPin = new THREE.Object3D();
  armPin.name = 'armPin';
  armPin.position.set(K.RA, 1.52, 0);
  g.add(markPin(armPin));

  // 폴 받이와 폴 핀(축 = 바깥 법선 nrm)
  const nrmAng = -K.pinOff; // 상자 x → nrm
  const lug = mesh(new THREE.BoxGeometry(0.03, 0.07, 0.06), mat);
  lug.name = 'lug';
  lug.position.set(0.574, 1.405, 0.023);
  lug.rotation.y = nrmAng;
  g.add(lug);
  const pinGeo = lathe(rodProfile(0.012, -0.03, 0.06, 0.002, 0.002), 20);
  pinGeo.rotateZ(-Math.PI / 2);
  pinGeo.rotateY(nrmAng);
  const pawlPin = mesh(pinGeo, steel());
  pawlPin.name = 'pawlPin';
  pawlPin.position.set(K.pinR, K.pinY, 0);
  g.add(pawlPin);
  const frame = new THREE.Group();
  frame.name = 'pawlFrame';
  frame.position.set(K.pinR, K.pinY, 0);
  frame.rotation.y = -(90 * D2R + K.pinOff);
  g.add(frame);

  // 방향 화살표 원뿔(끝이 로컬 +Z = 시계, −Z = 반시계)
  const mkCone = (name: string, cw: boolean): THREE.Mesh => {
    const geo = new THREE.ConeGeometry(0.04, 0.1, 16);
    geo.rotateX(cw ? Math.PI / 2 : -Math.PI / 2);
    const m = mesh(geo, paint(0xffcc00));
    m.name = name;
    m.position.set(0.7, 1.5, 0);
    return m;
  };
  g.add(mkCone('cwArrow', true), mkCone('ccwArrow', false));
  return g;
}

// ───────────────────────── 띠 다각형·운동식 ─────────────────────────

/** 코가 앉는 접평면 위의 이 띠 다각형(t = 시계 쪽 거리, y). off = 코에서 이뿌리까지 거리(0 이상) */
export function rackPoly237(off: number): V2[] {
  const out: V2[] = [];
  for (let j = -4; j <= 4; j++) {
    out.push([off + j * K.sp, K.yRoot]);
    out.push([off + j * K.sp - K.d, K.yTip]);
  }
  out.push([off + 5 * K.sp, K.yRoot]);
  out.push([off + 5 * K.sp, 1.1]);
  out.push([off - 4 * K.sp - K.d, 1.1]);
  return out;
}

function insidePoly(P: V2[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i]!;
    const b = P[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function distPoly(P: V2[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[j]!;
    const b = P[i]!;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey)));
    const d = Math.hypot(x - a[0] - t * ex, y - a[1] - t * ey);
    if (d < best) best = d;
  }
  return best;
}

interface Core {
  u: number;
  alpha: number;
  armRot: number;
  P: V2;
  E: V2;
  phi: number; // 한 주기 안의 누적각
  drive: boolean;
  pushing: boolean;
}
function core(u: number): Core {
  const P: V2 = [K.K[0] + K.rk * Math.cos(K.thF + u), -K.K[1] + K.rk * Math.sin(K.thF + u)];
  const E = circleIntersect([K.XC, -K.ZC], K.RA, P, K.Lk, false) ?? [K.XC + K.RA, -K.ZC];
  const armRot = Math.atan2(E[1] + K.ZC, E[0] - K.XC);
  const alpha = K.TH0 - armRot;
  const pushing = u < Math.PI;
  const phi = pushing ? Math.max(0, alpha - K.aLo - K.slack) : PITCH;
  const drive = pushing && alpha > K.aLo + K.slack;
  return { u, alpha, armRot, P, E, phi, drive, pushing };
}

const TAB_N = 1440;
let LIFT: Float64Array | null = null;
const SEAT_SHIFT = K.pinOff + -K.seat[0] / K.Rm;

/** 들림 lift(0 = 앉은 자세) 가 prev 에서 이어지게 침범하지 않는 가장 작은 값 */
function followLift(prev: number, c: Core): number {
  const eps = c.armRot - SEAT_SHIFT - (K.rho0 - c.phi);
  const off = (((-K.seat[0] + K.Rm * eps) % K.sp) + K.sp) % K.sp;
  const poly = rackPoly237(off);
  const step = 0.02 * D2R;
  const pen = (lift: number): boolean => {
    const lam = K.lam0 + lift;
    const x = K.pinT + K.L * Math.cos(lam);
    const y = K.pinY + K.L * Math.sin(lam);
    return insidePoly(poly, x, y) || distPoly(poly, x, y) < K.rn - 0.0002;
  };
  const bisect = (free: number, blocked: number): number => {
    let f = free;
    let b = blocked;
    for (let i = 0; i < 25; i++) {
      const m = (f + b) / 2;
      if (pen(m)) b = m;
      else f = m;
    }
    return f;
  };
  let a = prev;
  if (pen(a)) {
    let b = a;
    let k = 0;
    while (pen(b) && k < 3000) {
      a = b;
      b += step;
      k++;
    }
    return pen(b) ? b : bisect(b, a);
  }
  let b = a;
  let k = 0;
  while (!pen(b) && k < 2000) {
    a = b;
    b -= step;
    k++;
  }
  return pen(b) ? bisect(a, b) : a;
}

function buildLift(): void {
  const tab = new Float64Array(TAB_N + 1);
  let lift = 0;
  for (let i = 0; i < 2 * TAB_N; i++) {
    const c = core((TAU * (i % TAB_N)) / TAB_N);
    lift = c.drive ? 0 : followLift(lift, c);
    if (i >= TAB_N) tab[i - TAB_N] = lift;
  }
  tab[TAB_N] = tab[0]!;
  LIFT = tab;
}
function tabAt(u: number): number {
  const f = (u / TAU) * TAB_N;
  const i = Math.min(TAB_N - 1, Math.floor(f));
  return LIFT![i]! + (LIFT![i + 1]! - LIFT![i]!) * (f - i);
}

export interface State237 {
  u: number;
  alpha: number;
  armRot: number;
  P: V2;
  E: V2;
  phi: number;
  crownRot: number;
  lam: number;
  lift: number;
  drive: boolean;
  pushing: boolean;
}

/** 237번 운동식(theta = 크랭크 누적각, 모두 닫힌 식). P·E 는 (X, Zm = −z) 평면 */
export function state237(theta: number): State237 {
  if (LIFT === null) buildLift();
  const n = Math.floor(theta / TAU);
  const u = theta - n * TAU;
  const c = core(u);
  const phi = n * PITCH + c.phi;
  const lift = c.drive ? 0 : tabAt(u);
  return {
    u,
    alpha: c.alpha,
    armRot: c.armRot,
    P: c.P,
    E: c.E,
    phi,
    crownRot: K.rho0 - phi,
    lam: K.lam0 + lift,
    lift,
    drive: c.drive,
    pushing: c.pushing
  };
}
