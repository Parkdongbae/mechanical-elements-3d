// 221번 타원 기어 구동 전용 키트 — 상수, 매 순간 팔 구속을 푸는 상태 닫힌 식, 홈 판, 흔들 팔. 설계표 docs/mm507-sheets/221.md
import * as THREE from 'three';
import { darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, TAU, type V2 } from '../../models/parts/geom';
import { ellipsePitch } from './gear2';
import { setMM } from './mm';

export const PIT221 = ellipsePitch(0.7, 0.3);
const NC = 30;
const NP = 10;
/** C 의 모듈(피치 = 둘레/잇수) */
export const MC221 = PIT221.L / (NC * Math.PI);
/** 피니언 피치 반지름 */
export const RP221 = (NP * PIT221.L) / (NC * TAU);

export const K221 = {
  D: [0.3, 1.55] as [number, number],
  A: [-0.60024, 2.51537] as [number, number],
  LARM: 1.2,
  NC,
  NP,
  ZB: 22,
  ZA: 26,
  MAB: 0.05,
  TH0: 4.258604,
  PHI0: 3.2275934,
  OMEGA: 0.4,
  /** 판 바깥 윤곽·홈 띠(피치 곡선에서 바깥으로 민 거리) */
  PLATE_OUT: 0.313,
  GROOVE: [0.183, 0.273] as [number, number],
  Z: { arm: 0.14, front: 0.04, mid: -0.07, plate: [-0.2, -0.14] as [number, number], groove: -0.17 }
};

const wrap = (a: number): number => {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
};

interface Core221 {
  thC: number;
  phi: number;
  P: [number, number];
  psiB: number;
  psiA: number;
  arm: number;
}

function core221(t: number): Core221 {
  const K = K221;
  const thC = K.TH0 + K.OMEGA * t;
  const n = Math.floor((thC - K.TH0) / TAU);
  const u = thC - K.TH0 - TAU * n;
  const cs = Math.cos(thC);
  const sn = Math.sin(thC);
  const world = (phi: number): V2 => {
    const q = PIT221.pt(phi);
    const nn = PIT221.normal(phi);
    const cx = q[0] + RP221 * nn[0];
    const cy = q[1] + RP221 * nn[1];
    return [K.D[0] + cs * cx - sn * cy, K.D[1] + sn * cx + cs * cy];
  };
  const F = (phi: number): number => {
    const p = world(phi);
    return Math.hypot(p[0] - K.A[0], p[1] - K.A[1]) - K.LARM;
  };
  const guess = K.PHI0 - u;
  const N = 60;
  const lo0 = guess - 0.6;
  const step = 1.2 / N;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  let fPrev = F(lo0);
  for (let i = 0; i < N; i++) {
    const a = lo0 + i * step;
    const b = a + step;
    const fb = F(b);
    if ((fPrev <= 0 && fb >= 0) || (fPrev >= 0 && fb <= 0)) {
      const d = Math.abs((a + b) / 2 - guess);
      if (d < bestD) {
        bestD = d;
        best = [a, b];
      }
    }
    fPrev = fb;
  }
  let a = best ? best[0] : guess;
  let b = best ? best[1] : guess;
  if (best) {
    let fa = F(a);
    for (let k = 0; k < 50; k++) {
      const m = (a + b) / 2;
      const fm = F(m);
      if ((fa <= 0 && fm <= 0) || (fa >= 0 && fm >= 0)) {
        a = m;
        fa = fm;
      } else b = m;
    }
  }
  const phi = (a + b) / 2;
  const P = world(phi);
  // 접선각 잇기(atan2 값 그대로 쓰면 2π 씩 튄다)
  const Tc = phi + Math.PI / 2 + wrap(PIT221.tangent(phi) - phi - Math.PI / 2);
  const rp = RP221;
  const psiB = PIT221.S(phi) / rp + Tc + Math.PI / 2 + thC - 8 * Math.PI * n;
  const aw = Math.atan2(K.A[1] - P[1], K.A[0] - P[0]);
  const ang = ((aw % TAU) + TAU) % TAU;
  const s1 = TAU / K.ZB;
  const s2 = TAU / K.ZA;
  const psiA = ang + Math.PI - s2 - (s2 / s1) * (psiB + s1 / 2 - ang);
  const arm = Math.atan2(P[1] - K.A[1], P[0] - K.A[0]);
  return { thC, phi, P, psiB, psiA, arm };
}

export interface State221 extends Core221 {
  /** 수치 미분 ωA/ωC (notes 용) */
  ratio: number;
}

export function state221(t: number): State221 {
  const c = core221(t);
  const h = 0.01;
  const p = core221(t + h);
  const m = core221(t - h);
  const ratio = (p.psiA - m.psiA) / (p.thC - m.thC);
  return { ...c, ratio };
}

/** 축 D 구멍(축 반지름 0.045 + 0.003) */
export const BORE221 = 0.048;
const BORE = BORE221;

/** 피치 곡선을 바깥으로 k 만큼 민 닫힌 점열(360 점) */
function pushed221(k: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < 360; i++) {
    const phi = (i / 360) * TAU;
    const q = PIT221.pt(phi);
    const n = PIT221.normal(phi);
    out.push([q[0] + k * n[0], q[1] + k * n[1]]);
  }
  return out;
}

/**
 * 홈 판(C 로컬 좌표, 원점 = 초점 D): 바깥 윤곽 = 피치 곡선 + 0.313, z −0.22 ~ −0.16.
 * 홈(g·h) = +0.183 ~ +0.273 띠를 앞면에서 0.03 파냄, 홈 바닥에 짙은 띠.
 */
export function groovePlate221(): THREE.Group {
  const K = K221;
  const g = new THREE.Group();
  g.name = 'plate';
  const [zb, zf] = K.Z.plate;
  const zg = K.Z.groove;
  const mat = paint(0xe5e7eb);
  const outer = pushed221(K.PLATE_OUT);
  const gOut = pushed221(K.GROOVE[1]);
  const gIn = pushed221(K.GROOVE[0]);
  // 뒤 층(홈 바닥 아래): 판 전체
  const backShape = shapeFrom(outer);
  backShape.holes.push(circlePath(0, 0, BORE));
  const back = mesh(extrude(backShape, zg - zb, 0, 8), mat);
  back.position.z = (zb + zg) / 2;
  g.add(back);
  // 앞 층: 바깥 고리(0.273 ~ 0.313) + 안쪽 판(0 ~ 0.183) — 사이가 홈
  const ring = shapeFrom(outer);
  ring.holes.push(pathFrom(gOut));
  const frontRing = mesh(extrude(ring, zf - zg, 0, 8), mat);
  frontRing.position.z = (zg + zf) / 2;
  g.add(frontRing);
  const innerShape = shapeFrom(gIn);
  innerShape.holes.push(circlePath(0, 0, BORE));
  const inner = mesh(extrude(innerShape, zf - zg, 0, 8), mat);
  inner.position.z = (zg + zf) / 2;
  g.add(inner);
  // 홈 바닥 띠(짙은 색) — 바닥면에서 0.0005 올림
  const band = shapeFrom(gOut);
  band.holes.push(pathFrom(gIn));
  const bandMesh = mesh(extrude(band, 0.002, 0, 8), darkSteel());
  bandMesh.position.z = zg - 0.0005;
  g.add(bandMesh);
  g.userData.outline = outer;
  setMM(g, { kind: 'plate', zMin: zb, zMax: zf });
  return g;
}

/** 흔들 팔(로컬 원점 = 받침 보스 중심, +X 로 길이 1.20): 상자 + 양 끝 보스 */
export function arm221(): THREE.Group {
  const K = K221;
  const g = new THREE.Group();
  g.name = 'arm';
  const bar = mesh(new THREE.BoxGeometry(K.LARM, 0.07, 0.04), steel());
  bar.position.set(K.LARM / 2, 0, 0);
  g.add(bar);
  for (const x of [0, K.LARM]) {
    const geo = lathe(rodProfile(0.06, -0.02, 0.02, 0.004, 0.004), 32);
    geo.rotateX(Math.PI / 2);
    const boss = mesh(geo, steel());
    boss.position.set(x, 0, 0);
    g.add(boss);
  }
  return g;
}
