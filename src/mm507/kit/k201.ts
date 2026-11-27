// 201번 불규칙(타원) 기어와 진동 팔 전용 키트 — 상수, 타원 피치 곡선, 접촉점 수치 풀이 motion201(phi), 벨 크랭크 팔 판 bellArm201()
// 설계표 docs/mm507-sheets/201.md
import * as THREE from 'three';
import { bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, roundedRect, rodProfile, shapeFrom, stadiumShape, TAU, type V2 } from '../../models/parts/geom';
import { ellipticalOutline, type PitchCurve } from './gear2';
import { setMM } from './mm';
import { STAGE } from './stand';

const Mod = 0.03;
const NZ = 23; // 타원 기어 잇수
const NP = 12; // 피니언 잇수
const RP = (NP * Mod) / 2; // 피니언 피치 반지름 0.18
const PCH = Math.PI * Mod; // 원주 피치 0.0942
const RATIO = 1.4; // 장반경 / 단반경
const EC0 = 0.2; // 타원 중심이 축에서 치우친 거리(장축 방향)

// 타원 피치 곡선(기어 로컬, 축 = 원점): q(u) = (EC0 + a·cos u, b·sin u). 둘레 = NZ·PCH 가 되게 a 를 정한다
const perim = (a: number): number => {
  const b = a / RATIO;
  const n = 4096;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) / n) * TAU;
    s += Math.hypot(a * Math.sin(u), b * Math.cos(u));
  }
  return (s * TAU) / n;
};
const EA = (NZ * PCH) / perim(1); // 장반경
const EB = EA / RATIO; // 단반경

export const K201 = {
  O: [-0.36, 2.63] as [number, number], // 불규칙 기어 축
  Q: [0.22, 1.0] as [number, number], // 팔·큰 바퀴 고정 축
  LA: 1.63, // Q → 피니언 중심
  EA,
  EB,
  EC0,
  DA: 1.1, // 막대 핀의 팔 위 수평 거리
  XA: -0.88, // 막대 A 세로선
  W: 0.8, // 기어 각속도(rad/s)
  Nz: NZ,
  Np: NP,
  m: Mod,
  RP,
  RB: 0.716, // 큰 바퀴 벨트 중심 반지름
  RS: 0.226 // 작은 풀리 벨트 중심 반지름
} as const;
const K = K201;
const PI = Math.PI;
const LPERIM = NZ * PCH;

const qx = (u: number): number => EC0 + EA * Math.cos(u);
const qy = (u: number): number => EB * Math.sin(u);
const tauRaw = (u: number): number => Math.atan2(EB * Math.cos(u), -EA * Math.sin(u));
/** 접선 각(반시계), u 가 한 바퀴 돌 때 2π 늘어나게 이어 붙임 */
const tauOf = (u: number): number => {
  const k = Math.floor(u / TAU);
  const ur = u - k * TAU;
  let t = tauRaw(ur);
  if (t < PI / 2 - 1e-12) t += TAU;
  return t + k * TAU;
};
const nrm = (u: number): V2 => {
  const h = Math.hypot(EB * Math.cos(u), EA * Math.sin(u));
  return [(EB * Math.cos(u)) / h, (EA * Math.sin(u)) / h];
};
// 호 길이 표 s(u)
const NT = 8192;
const sTab: number[] = [0];
for (let i = 1; i <= NT; i++) {
  const u0 = ((i - 1) / NT) * TAU;
  const u1 = (i / NT) * TAU;
  const d = (u: number): number => Math.hypot(EA * Math.sin(u), EB * Math.cos(u));
  sTab.push(sTab[i - 1]! + ((u1 - u0) / 6) * (d(u0) + 4 * d((u0 + u1) / 2) + d(u1)));
}
const LREAL = sTab[NT]!;
const sOfU = (u: number): number => {
  const k = Math.floor(u / TAU);
  const f = ((u - k * TAU) / TAU) * NT;
  const i = Math.min(NT - 1, Math.floor(f));
  return (sTab[i]! + (sTab[i + 1]! - sTab[i]!) * (f - i)) * (LPERIM / LREAL) + k * LPERIM;
};
const uOfS = (s: number): number => {
  const k = Math.floor(s / LPERIM);
  const sn = ((s - k * LPERIM) * LREAL) / LPERIM;
  let lo = 0;
  let hi = NT;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sTab[mid]! <= sn) lo = mid;
    else hi = mid;
  }
  return ((lo + (sn - sTab[lo]!) / (sTab[lo + 1]! - sTab[lo]!)) / NT) * TAU + k * TAU;
};

/** gear2 의 ellipticalOutline 이 쓰는 형태의 피치 곡선(매개변수 = u). 축이 타원 중심에서 치우친 타원 */
export const PITCH201: PitchCurve = {
  L: LPERIM,
  d: 0,
  rMin: EA - EC0,
  rMax: EA + EC0,
  r: (u) => Math.hypot(qx(u), qy(u)),
  pt: (u) => [qx(u), qy(u)],
  tangent: tauOf,
  normal: (u) => nrm(u),
  S: sOfU,
  phiAtS: uOfS
};

/** 타원 기어 윤곽(축 원점, 반시계). 이 중심 호 길이 = i·PCH (u = 0 에서 시작) */
export const GEAR_OUTLINE_201: V2[] = ellipticalOutline(PITCH201, NZ, false, 0.19);

// ── 접촉점 풀이 ──
// 기어 로컬에서 피니언 중심 곡선(피치 곡선을 RP 만큼 바깥으로 민 곡선) o(u) = q + RP·n. 세계 P = O + R(φ)·o(u).
// |P − Q| = LA → |o(u) − Ql|² = LA², Ql = R(−φ)(Q − O). 두 교점 중 세계 x 가 큰 쪽(피니언이 기어 오른쪽)을 잇는다.
const oX = (u: number): number => qx(u) + RP * nrm(u)[0];
const oY = (u: number): number => qy(u) + RP * nrm(u)[1];
const qLocal = (phi: number): V2 => {
  const dx = K.Q[0] - K.O[0];
  const dy = K.Q[1] - K.O[1];
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return [c * dx + s * dy, -s * dx + c * dy];
};
const gOf = (u: number, ql: V2): number => (oX(u) - ql[0]) ** 2 + (oY(u) - ql[1]) ** 2 - K.LA * K.LA;
function rootsAt(phi: number): number[] {
  const ql = qLocal(phi);
  const n = 720;
  const out: number[] = [];
  let g0 = gOf(0, ql);
  for (let i = 1; i <= n; i++) {
    const u1 = (i / n) * TAU;
    const g1 = gOf(u1, ql);
    if (g0 === 0 || g0 * g1 < 0) {
      let lo = ((i - 1) / n) * TAU;
      let hi = u1;
      let gl = g0;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const gm = gOf(mid, ql);
        if (gl * gm <= 0) hi = mid;
        else {
          lo = mid;
          gl = gm;
        }
      }
      out.push((lo + hi) / 2);
    }
    g0 = g1;
  }
  return out;
}
// 연속 가지 표: φ 0 → 2π 를 0.05° 간격으로 따라가며 u 를 펼친다(오른쪽 가지)
const NPH = 7200;
const uTab: number[] = [];
{
  let prev = NaN;
  for (let i = 0; i <= NPH; i++) {
    const phi = (i / NPH) * TAU;
    const rs = rootsAt(phi);
    let pick = NaN;
    if (i === 0) {
      let best = -Infinity;
      for (const u of rs) {
        const px = K.O[0] + Math.cos(phi) * oX(u) - Math.sin(phi) * oY(u);
        if (px > best) {
          best = px;
          pick = u;
        }
      }
    } else {
      let bd = Infinity;
      for (const u of rs) {
        const w = u + TAU * Math.round((prev - u) / TAU);
        if (Math.abs(w - prev) < bd) {
          bd = Math.abs(w - prev);
          pick = w;
        }
      }
    }
    uTab.push(pick);
    prev = pick;
  }
}
const U_SHIFT = uTab[NPH]! - uTab[0]!; // 기어 한 바퀴 동안 접점 u 의 변화(= −2π)

function solveU(phi: number): number {
  const k = Math.floor(phi / TAU);
  const pr = phi - k * TAU;
  const f = (pr / TAU) * NPH;
  const i = Math.min(NPH - 1, Math.floor(f));
  let u = uTab[i]! + (uTab[i + 1]! - uTab[i]!) * (f - i);
  const ql = qLocal(phi);
  for (let it = 0; it < 6; it++) {
    const h = 1e-6;
    const g = gOf(u, ql);
    const dg = (gOf(u + h, ql) - gOf(u - h, ql)) / (2 * h);
    if (Math.abs(dg) < 1e-12) break;
    const du = g / dg;
    u -= du;
    if (Math.abs(du) < 1e-13) break;
  }
  return u + k * U_SHIFT;
}

export interface Motion201 {
  P: [number, number];
  alpha: number;
  u: number;
  psi: number;
  Theta: number;
  yA: number;
  beltOffset: number;
}

/** φ(기어 각, 반시계 양수) → 접촉점·피니언 중심·팔 각·피니언 각. 피니언은 기어 로컬에서 미끄럼 없이 구른다: ψ = s/RP + τ + π/2 + φ */
export function motion201(phi: number): Motion201 {
  const u = solveU(phi);
  const ox = oX(u);
  const oy = oY(u);
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  const px = K.O[0] + c * ox - sn * oy;
  const py = K.O[1] + sn * ox + c * oy;
  const alpha = Math.atan2(py - K.Q[1], px - K.Q[0]) - PI / 2;
  const psi = sOfU(u) / RP + tauOf(u) + PI / 2 + phi;
  const rr = K.RS / K.RB;
  return {
    P: [px, py],
    alpha,
    u,
    psi,
    Theta: alpha + rr * (psi - alpha),
    yA: K.Q[1] - K.DA * Math.tan(alpha),
    beltOffset: K.RS * (psi - alpha)
  };
}

/** 타원 기어 몸(원점 = 축, 로컬 z 0 = 기어 가운데, 폭 0.08). userData.outline 남김 */
export function ellipseGear201(): THREE.Group {
  const g = new THREE.Group();
  const w = 0.08;
  const shape = shapeFrom(GEAR_OUTLINE_201);
  shape.holes.push(circlePath(0, 0, 0.032));
  g.add(mesh(extrude(shape, w, 0.006, 6), bronze({ roughness: 0.34 })));
  // 앞면 안쪽 짙은 띠(타원 모양이 보이게): 피치 곡선을 0.09·0.105 안쪽으로 민 두 선 사이
  const ringAt = (off: number): V2[] => {
    const pts: V2[] = [];
    for (let i = 0; i < 160; i++) {
      const u = (i / 160) * TAU;
      const n = nrm(u);
      pts.push([qx(u) - n[0] * off, qy(u) - n[1] * off]);
    }
    return pts;
  };
  const ring = shapeFrom(ringAt(0.09));
  ring.holes.push(new THREE.Path(ringAt(0.105).map((p) => new THREE.Vector2(p[0], p[1]))));
  const rm = mesh(extrude(ring, 0.002, 0, 4), darkSteel());
  rm.position.z = w / 2 + 0.001;
  g.add(rm);
  g.userData.outline = GEAR_OUTLINE_201;
  setMM(g, { kind: 'gear', fn: 'ellipticalGear', teeth: NZ, module: Mod, internal: false, noncircular: true, rMin: PITCH201.rMin, rMax: PITCH201.rMax, pitchLength: LPERIM, width: w, axis: 'z' });
  return g;
}

/** 팔 판(두께 0.05, 로컬 원점 = Q, 세로 팔 +Y, 수평 팔 −X). z 는 0.175~0.225 */
export function bellArm201(): THREE.Group {
  const g = new THREE.Group();
  const body = steel({ roughness: 0.4 });
  const plate = (shape: THREE.Shape, t: number, z0: number): THREE.Mesh => {
    const m = mesh(extrude(shape, t, 0.004, 24), body);
    m.position.z = z0 + t / 2;
    return m;
  };
  const withHole = (s: THREE.Shape, cx: number, cy: number, r: number): THREE.Shape => {
    s.holes.push(circlePath(cx, cy, r));
    return s;
  };
  // 허브 원판
  const hubS = new THREE.Shape();
  hubS.absarc(0, 0, 0.26, 0, TAU, false);
  g.add(plate(withHole(hubS, 0, 0, 0.045), 0.05, 0.175));
  // 세로 팔(사다리꼴) + 위 끝 눈
  const vS = shapeFrom([
    [-0.1, 0],
    [0.1, 0],
    [0.05, 1.63],
    [-0.05, 1.63]
  ]);
  withHole(vS, 0, 0, 0.045);
  g.add(plate(vS, 0.046, 0.177));
  const eyeS = new THREE.Shape();
  eyeS.absarc(0, 1.63, 0.1, 0, TAU, false);
  g.add(plate(withHole(eyeS, 0, 1.63, 0.032), 0.05, 0.175));
  // 수평 팔
  const hS = shapeFrom([
    [0, -0.07],
    [0, 0.07],
    [-0.76, 0.05],
    [-0.76, -0.05]
  ]);
  withHole(hS, 0, 0, 0.045);
  g.add(plate(hS, 0.044, 0.178));
  // 끝 홈 고리
  const ring = roundedRect(-1.44, -0.13, -0.76, 0.13, 0.13);
  ring.holes.push(stadiumShape(-1.31, 0, -0.9, 0, 0.031));
  g.add(plate(ring, 0.046, 0.177));
  // 세로 팔 가운데 노란 띠
  const band = mesh(new THREE.BoxGeometry(0.02, 1.0, 0.004), paint(0xf2b619));
  band.position.set(0, 0.9, 0.2255);
  g.add(band);
  const pinP = new THREE.Object3D();
  pinP.name = 'pinP';
  pinP.position.set(0, K.LA, 0.3);
  g.add(pinP);
  return g;
}

/** Q 고정 핀 + 뒤판 보스 + 앞 와셔 너트 */
export function fixedPinQ201(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(K.Q[0], K.Q[1], 0);
  const back = STAGE.backZ;
  const pin = lathe(rodProfile(0.04, 0, 0.26 - back, 0.004, 0.004), 28);
  pin.rotateX(Math.PI / 2);
  const pm = mesh(pin, steel());
  pm.position.z = back;
  g.add(pm);
  const boss = lathe(rodProfile(0.09, 0, 0.1, 0.01, 0.01), 32);
  boss.rotateX(Math.PI / 2);
  const bm = mesh(boss, castIron());
  bm.position.z = back;
  g.add(bm);
  const nut = lathe(rodProfile(0.07, 0, 0.03, 0.005, 0.005), 28);
  nut.rotateX(Math.PI / 2);
  const nm = mesh(nut, darkSteel());
  nm.position.z = 0.23;
  g.add(nm);
  const pivotQ = new THREE.Object3D();
  pivotQ.name = 'pivotQ';
  pivotQ.position.set(0, 0, 0.3);
  g.add(pivotQ);
  return g;
}
