// 210번 굽은 홈 팔과 직선 막대 전용 키트 — 굽은 홈 팔(돎), 세로 막대 + 핀, 핀 자리 이분법
// 설계표 docs/mm507-sheets/210.md
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';

const D = Math.PI / 180;

export const K210 = {
  S: new THREE.Vector2(-0.175, 1.45), // 축 중심
  d: 0.175, // 축 → 막대 선
  A: 0.545,
  B: 0.437,
  C0: 51 * D,
  phi0: 66 * D,
  phi1: 172 * D,
  slotHalf: 0.055,
  pinR: 0.045,
  barR: 0.06,
  thTop: 6.5 * D,
  thBot: -95.5 * D
} as const;
const K = K210;

// 팔 바깥 윤곽(팔 로컬, θ = 0, 반시계 111점)
export const ARM210: V2[] = [[-0.3452,-0.1705],[-0.3200,-0.2141],[-0.2893,-0.2540],[-0.2537,-0.2896],[-0.2137,-0.3203],[-0.1701,-0.3454],[-0.1235,-0.3646],[-0.0749,-0.3776],[-0.0249,-0.3842],[0.0254,-0.3842],[0.0754,-0.3776],[0.1240,-0.3645],[0.1705,-0.3452],[0.2141,-0.3200],[0.2540,-0.2893],[0.2896,-0.2537],[0.3128,-0.2245],[0.3303,-0.1977],[0.3454,-0.1701],[0.3602,-0.1358],[0.3776,-0.0749],[0.3831,-0.0380],[0.3850,-0.0061],[0.3837,0.0312],[0.3799,0.0625],[0.3645,0.1240],[0.3508,0.1587],[0.3364,0.1872],[0.3200,0.2141],[0.2978,0.2441],[0.2537,0.2896],[0.2245,0.3128],[0.1977,0.3303],[0.1648,0.3479],[0.1354,0.3604],[0.0999,0.3718],[0.0687,0.3788],[0.0061,0.3850],[-0.0562,0.3809],[-0.0877,0.3749],[-0.1235,0.3646],[-0.1939,0.3348],[-0.2114,0.3329],[-0.2268,0.3356],[-0.2488,0.3481],[-0.2579,0.3583],[-0.2645,0.3703],[-0.2689,0.3952],[-0.2630,0.4274],[-0.2470,0.4782],[-0.2234,0.5281],[-0.1944,0.5734],[-0.1597,0.6150],[-0.1183,0.6537],[-0.0754,0.6852],[-0.0241,0.7142],[0.0273,0.7357],[0.0742,0.7496],[0.1174,0.7581],[0.1625,0.7630],[0.2075,0.7638],[0.2658,0.7589],[0.3229,0.7476],[0.3741,0.7317],[0.4412,0.7034],[0.4698,0.6969],[0.4953,0.6959],[0.5196,0.6991],[0.5431,0.7062],[0.5685,0.7190],[0.5958,0.7412],[0.6168,0.7684],[0.6310,0.7996],[0.6378,0.8332],[0.6361,0.8713],[0.6265,0.9042],[0.6096,0.9341],[0.5864,0.9593],[0.5534,0.9809],[0.4781,1.0130],[0.4089,1.0352],[0.3382,1.0511],[0.2751,1.0599],[0.2034,1.0639],[0.1340,1.0617],[0.0635,1.0533],[0.0026,1.0409],[-0.0645,1.0213],[-0.1290,0.9962],[-0.1905,0.9658],[-0.2468,0.9315],[-0.3009,0.8919],[-0.3507,0.8483],[-0.3971,0.7997],[-0.4373,0.7495],[-0.4760,0.6906],[-0.5062,0.6341],[-0.5324,0.5715],[-0.5509,0.5127],[-0.5648,0.4473],[-0.5722,0.3825],[-0.5732,0.3190],[-0.5682,0.2575],[-0.5563,0.1930],[-0.5396,0.1359],[-0.5160,0.0778],[-0.4911,0.0305],[-0.4593,-0.0176],[-0.4205,-0.0644],[-0.3735,-0.1101],[-0.3627,-0.1291]];

/** 홈 가운데선의 극좌표 반지름(팔 로컬, 원점 = 축 중심) */
export function slotRho210(phi: number): number {
  return K.A + K.B * Math.cos(phi - K.C0);
}

/** 홈 윤곽(팔 로컬) — 가운데선 ± 반폭, 양끝 반원 */
export function slotOutline210(): V2[] {
  const hw = K.slotHalf;
  const N = Math.round((K.phi1 - K.phi0) / D);
  const P: V2[] = [];
  const Nv: V2[] = [];
  for (let i = 0; i <= N; i++) {
    const phi = K.phi0 + ((K.phi1 - K.phi0) * i) / N;
    const rho = slotRho210(phi);
    const drho = -K.B * Math.sin(phi - K.C0);
    const tx = drho * Math.cos(phi) - rho * Math.sin(phi);
    const ty = drho * Math.sin(phi) + rho * Math.cos(phi);
    const l = Math.hypot(tx, ty);
    P.push([rho * Math.cos(phi), rho * Math.sin(phi)]);
    Nv.push([-ty / l, tx / l]);
  }
  const out: V2[] = [];
  for (let i = 0; i <= N; i++) out.push([P[i]![0] + hw * Nv[i]![0], P[i]![1] + hw * Nv[i]![1]]);
  // 끝 반원: 법선 각에서 시계로 180° 돌며 접선 방향 쪽 반원
  const cap = (c: V2, nAng: number): void => {
    const M = 12;
    for (let j = 1; j < M; j++) {
      const a = nAng - (Math.PI * j) / M;
      out.push([c[0] + hw * Math.cos(a), c[1] + hw * Math.sin(a)]);
    }
  };
  cap(P[N]!, Math.atan2(Nv[N]![1], Nv[N]![0]));
  for (let i = N; i >= 0; i--) out.push([P[i]![0] - hw * Nv[i]![0], P[i]![1] - hw * Nv[i]![1]]);
  cap(P[0]!, Math.atan2(Nv[0]![1], Nv[0]![0]) + Math.PI);
  return out;
}

/** 굽은 홈 팔 — 그룹 위치 = 축 중심, 로컬 = 세계 − 축 중심. rotation.z = θ */
export function slotArm210(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(K.S.x, K.S.y, 0);
  const shape = shapeFrom(ARM210);
  const axisHole = new THREE.Path();
  axisHole.absarc(0, 0, 0.065, 0, Math.PI * 2, true);
  shape.holes.push(axisHole);
  const slot = slotOutline210();
  shape.holes.push(pathFrom(slot));
  const plate = mesh(extrude(shape, 0.06, 0.006), brass());
  plate.position.z = 0.09;
  plate.name = 'armPlate';
  g.add(plate);
  const ringGeo = lathe(tubeProfile(0.065, 0.195, 0.12, 0.14, 0.005), 48);
  ringGeo.rotateX(Math.PI / 2);
  g.add(mesh(ringGeo, darkSteel()));
  const bossGeo = lathe(tubeProfile(0.065, 0.11, 0.0, 0.06, 0.005), 48);
  bossGeo.rotateX(Math.PI / 2);
  g.add(mesh(bossGeo, darkSteel()));
  const mark = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.006), paint(0xffcc00));
  mark.position.set(0.13, 0, 0.143);
  g.add(mark);
  g.userData.outlines = { slot };
  return g;
}

/** 세로 막대 + 핀 + 와셔 + 노란 머리 — 그룹 원점 = 핀 중심(막대 로컬 y −1.55 ~ 0.85) */
export function bar210(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(lathe(rodProfile(K.barR, -1.55, 0.85, 0.01, 0.01), 28), steel()));
  // 핀 앞끝을 와셔 속(0.21)에서 끝나게 — 와셔 앞면(0.22)과 같은 높이라 면이 겹쳐 깜빡이던 것(2026-11-27 사용자 지적)
  const pinGeo = new THREE.CylinderGeometry(K.pinR, K.pinR, 0.21, 28);
  pinGeo.rotateX(Math.PI / 2);
  const pin = mesh(pinGeo, steel());
  pin.position.z = 0.105;
  pin.name = 'barPin';
  pin.userData.outline = circlePts(K.pinR, 32);
  g.add(pin);
  const washerGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.015, 32);
  washerGeo.rotateX(Math.PI / 2);
  const washer = mesh(washerGeo, darkSteel());
  washer.position.z = 0.2125;
  washer.name = 'barWasher';
  g.add(washer);
  const tip = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 28), paint(0xffcc00));
  tip.position.y = 0.865;
  tip.name = 'barTip';
  g.add(tip);
  return g;
}

/** 팔 각 θ(rad) → 핀(막대) 세계 y. 구간 [60°, 178°] 이분법 50번 */
export function pinY210(theta: number): number {
  const gf = (phi: number): number => slotRho210(phi) * Math.cos(phi + theta) - K.d;
  let lo = 60 * D;
  let hi = 178 * D;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (gf(mid) > 0) lo = mid;
    else hi = mid;
  }
  const phi = (lo + hi) / 2;
  return K.S.y + slotRho210(phi) * Math.sin(phi + theta);
}

/** 구동 식: tm = 누적 시각(속도 배율 반영) → 팔 각(rad). 거의 일정한 각속도로 102° 왕복 */
export function theta210(tm: number): number {
  const TM = -44.5 * D;
  const TH = 102 * D;
  return TM + ((TH / 2) * Math.asin(0.985 * Math.sin(0.8 * tm + Math.PI / 2))) / Math.asin(0.985);
}
