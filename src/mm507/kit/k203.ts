// 203번 굽은 홈 팔의 진동 전용 키트 — 굽은 홈 팔(J 모양 판), 곧은 팔, 홈 위의 점과 곧은 팔 원의 교점(pose203)
// 설계표 docs/mm507-sheets/203.md
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

export const K203 = {
  O1: new THREE.Vector2(-1.16, 1.11), // 굽은 팔 고정 축
  O2: new THREE.Vector2(1.36, 2.39), // 곧은 팔 고정 축
  LS: 2.2318, // O2 → 핀
  XR: -0.47, // 홈 오른쪽 끝 x (E_R)
  YE: 2.3, // 위 가로 홈 높이
  XB: -1.06, // 호 시작 x
  CB: new THREE.Vector2(-1.06, 1.69), // 홈 호 중심
  RHO: 0.61, // 홈 호 반지름
  XV: -1.67, // 왼쪽 세로 홈 x
  YL: 1.2, // 홈 아래 끝 y (E_L)
  HW: 0.086, // 홈 반폭
  U1: 0.59,
  U2: 0.59 + (0.61 * Math.PI) / 2, // 1.5482
  U3: 0.59 + (0.61 * Math.PI) / 2 + 0.49, // 2.0382
  // 진동: θ1(t) = C0 + AMP·sin(W·(t − 1) + PH)
  C0: -0.5236,
  AMP: 0.6981,
  W: 0.8,
  PH: 0.8481,
  // 층(z)
  zS0: 0.06,
  zS1: 0.11, // 곧은 팔
  zA0: 0.16,
  zA1: 0.22 // 굽은 팔
} as const;
const K = K203;

/** 홈 중심선 위의 점 — 굽은 팔 θ1 = 0 일 때의 세계 좌표, 호 길이 u */
export function slotPoint203(u: number): THREE.Vector2 {
  if (u <= K.U1) return new THREE.Vector2(K.XR - u, K.YE);
  if (u <= K.U2) {
    const a = Math.PI / 2 + (u - K.U1) / K.RHO;
    return new THREE.Vector2(K.CB.x + K.RHO * Math.cos(a), K.CB.y + K.RHO * Math.sin(a));
  }
  return new THREE.Vector2(K.XV, K.CB.y - (u - K.U2));
}

/** 굽은 팔 각(rad) — 시각 t */
export function theta1At203(t: number): number {
  return K.C0 + K.AMP * Math.sin(K.W * (t - 1) + K.PH);
}
/** dθ1/dt (속도 배율 1) */
export function dTheta1At203(t: number): number {
  return K.AMP * K.W * Math.cos(K.W * (t - 1) + K.PH);
}

export interface Pose203 {
  u: number;
  pin: THREE.Vector2;
  theta2: number;
}

/** 굽은 팔 각 θ1 → 핀이 홈 안에서 곧은 팔 원(반지름 LS) 위에 놓이는 자리 */
export function pose203(theta1: number): Pose203 {
  const c = Math.cos(theta1);
  const s = Math.sin(theta1);
  const q = (u: number): THREE.Vector2 => {
    const p = slotPoint203(u);
    const dx = p.x - K.O1.x;
    const dy = p.y - K.O1.y;
    return new THREE.Vector2(K.O1.x + c * dx - s * dy, K.O1.y + s * dx + c * dy);
  };
  const f = (u: number): number => q(u).distanceTo(K.O2) - K.LS;
  // 부호가 바뀌는 구간을 거칠게 찾은 뒤 이분법 60회
  let lo = 0;
  let hi = K.U3;
  const N = 100;
  let prevU = 0;
  let prevF = f(0);
  let found = false;
  for (let i = 1; i <= N; i++) {
    const u = (K.U3 * i) / N;
    const fu = f(u);
    if (prevF === 0 || prevF * fu <= 0) {
      lo = prevU;
      hi = u;
      found = true;
      break;
    }
    prevU = u;
    prevF = fu;
  }
  if (!found) {
    // 근이 없으면(범위 밖) |f| 가 가장 작은 곳
    let best = 0;
    let bf = Infinity;
    for (let i = 0; i <= N; i++) {
      const af = Math.abs(f((K.U3 * i) / N));
      if (af < bf) {
        bf = af;
        best = i;
      }
    }
    lo = hi = (K.U3 * best) / N;
  } else {
    const flo = f(lo);
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) * flo > 0) lo = mid;
      else hi = mid;
    }
  }
  const u = (lo + hi) / 2;
  const p = q(u);
  const theta2 = Math.atan2(p.y - K.O2.y, p.x - K.O2.x);
  return { u, pin: p, theta2 };
}

/** 굽은 홈 팔 — 그룹 위치 O1, 로컬 = 세계 − O1. 두께 0.06 (z 0.16~0.22) 판 + 허브 보스 */
export function slotArm203(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(K.O1.x, K.O1.y, 0);
  const ox = K.O1.x;
  const oy = K.O1.y;
  const P = Math.PI;
  // 바깥 윤곽(세계 좌표를 O1 기준으로 옮겨 그린다)
  const s = new THREE.Shape();
  s.moveTo(-0.47 - ox, 2.51 - oy);
  s.lineTo(-1.06 - ox, 2.51 - oy);
  s.absarc(-1.06 - ox, 1.69 - oy, 0.82, P / 2, P, false);
  s.lineTo(-1.88 - ox, 1.2 - oy);
  s.absarc(-1.42 - ox, 1.2 - oy, 0.46, P, 1.5 * P, false);
  s.lineTo(-1.16 - ox, 0.74 - oy);
  s.absarc(0, 0, 0.37, 1.5 * P, 2 * P + P / 3, false);
  s.lineTo(-0.8 - ox, 1.51 - oy);
  s.absarc(-0.8 - ox, 1.8 - oy, 0.29, 1.5 * P, P / 2, true);
  s.lineTo(-0.47 - ox, 2.09 - oy);
  s.absarc(-0.47 - ox, 2.3 - oy, 0.21, 1.5 * P, 2.5 * P, false);
  s.closePath();
  // 홈 구멍
  const h = new THREE.Path();
  const hw = K.HW;
  const cx = K.CB.x - ox;
  const cy = K.CB.y - oy;
  h.moveTo(K.XR - ox, K.YE + hw - oy);
  h.lineTo(K.XB - ox, K.YE + hw - oy);
  h.absarc(cx, cy, K.RHO + hw, P / 2, P, false);
  h.lineTo(K.XV - hw - ox, K.YL - oy);
  h.absarc(K.XV - ox, K.YL - oy, hw, P, 2 * P, false);
  h.lineTo(K.XV + hw - ox, K.CB.y - oy);
  h.absarc(cx, cy, K.RHO - hw, P, P / 2, true);
  h.lineTo(K.XR - ox, K.YE - hw - oy);
  h.absarc(K.XR - ox, K.YE - oy, hw, 1.5 * P, 2.5 * P, false);
  h.closePath();
  s.holes.push(h);
  const axisHole = new THREE.Path();
  axisHole.absarc(0, 0, 0.05, 0, 2 * P, true);
  s.holes.push(axisHole);
  const plateGeo = extrude(s, K.zA1 - K.zA0, 0.008, 32);
  const plate = mesh(plateGeo, brass());
  plate.position.z = (K.zA0 + K.zA1) / 2;
  plate.name = 'slotPlate';
  g.add(plate);
  // 허브 보스: 반지름 0.14, z 0.14~0.24, 구멍 0.05
  const hubGeo = lathe(tubeProfile(0.05, 0.14, 0, 0.1, 0.01), 40);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, darkSteel());
  hub.position.z = 0.14;
  hub.name = 'slotHub';
  g.add(hub);
  // 노란 띠: 위 가로 부분 앞면, 길이 0.5
  const band = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.005), paint(0xf2b619));
  band.position.set(-0.7 - ox, 2.46 - oy, K.zA1 + 0.0025);
  g.add(band);
  return g;
}

/** 곧은 팔 — 그룹 위치 O2, rotation.z = θ2 일 때 로컬 +X 가 핀 쪽. 두께 0.05 (z 0.06~0.11) */
export function straightArm203(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(K.O2.x, K.O2.y, 0);
  const LS = K.LS;
  const x0 = 0.2;
  const w = (x: number): number => 0.1 - (0.02 * x) / LS;
  const s = new THREE.Shape();
  s.moveTo(x0, -w(x0));
  s.lineTo(LS, -0.08);
  s.lineTo(LS, 0.08);
  s.lineTo(x0, w(x0));
  s.closePath();
  const plate = mesh(extrude(s, K.zS1 - K.zS0, 0.006), steel());
  plate.position.z = (K.zS0 + K.zS1) / 2;
  plate.name = 'armPlate';
  g.add(plate);
  // O2 보스(반지름 0.22, 구멍 0.05)
  const bossGeo = lathe(tubeProfile(0.05, 0.22, 0, K.zS1 - K.zS0, 0.008), 48);
  bossGeo.rotateX(Math.PI / 2);
  const boss = mesh(bossGeo, steel());
  boss.position.z = K.zS0;
  boss.name = 'armBoss';
  g.add(boss);
  // 끝 눈(반지름 0.15)
  const eyeGeo = lathe(rodProfile(0.15, 0, K.zS1 - K.zS0, 0.006, 0.006), 40);
  eyeGeo.rotateX(Math.PI / 2);
  const eye = mesh(eyeGeo, steel());
  eye.position.set(LS, 0, K.zS0);
  eye.name = 'armEye';
  g.add(eye);
  // 노란 띠: 윗면(앞면) 길이 1.0
  const band = mesh(new THREE.BoxGeometry(1.0, 0.03, 0.005), paint(0xf2b619));
  band.position.set(0.95, 0, K.zS1 + 0.0025);
  g.add(band);
  return g;
}
