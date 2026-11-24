// 67·68번 전용 키트 — 반달 추(텀블러), 반쯤 잘린 속 빈 축, 한 톱니 간헐 기어(068)
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, steel } from '../../models/materials';
import { annularSector, extrude, lathe, mesh, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';

/** 텀블러 E 바깥 반지름 */
export const TUMBLER_R = 1.1;

/** 판화 67번의 아래 가장자리(왼 뿔 → 허브 밑 → 오른 뿔), 중심 = 축, 단위 = 전시 단위 */
const LOWER: V2[] = [
  [-1.1, 0.044], [-0.98, 0.048], [-0.849, 0.076], [-0.719, 0.163], [-0.566, 0.207], [-0.479, 0.196],
  [-0.403, 0.109], [-0.327, -0.011], [-0.25, -0.142], [-0.152, -0.24], [-0.022, -0.283], [0.109, -0.272],
  [0.218, -0.163], [0.327, -0.065], [0.436, -0.015], [0.545, 0], [0.61, -0.022], [0.719, -0.109],
  [0.784, -0.218], [0.849, -0.348], [0.937, -0.425], [1.002, -0.436]
];

/** 텀블러 윤곽(반시계 닫힌 점열): 바깥 호(−23.5° → 178°, 반지름 TUMBLER_R) + 판화의 아래 가장자리 */
export function tumblerOutline(): V2[] {
  const a0 = (-23.5 * Math.PI) / 180;
  const a1 = (178 * Math.PI) / 180;
  const pts: V2[] = [];
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([Math.cos(a) * TUMBLER_R, Math.sin(a) * TUMBLER_R]);
  }
  const curve = new THREE.SplineCurve(LOWER.map(([x, y]) => new THREE.Vector2(x, y)));
  const low = curve.getPoints(40).map((p): V2 => [p.x, p.y]);
  low.shift(); // 왼 뿔 끝점은 바깥 호 끝과 같다
  low.pop(); // 오른 뿔 끝점은 바깥 호 시작과 같다
  pts.push(...low);
  return pts;
}

/** 텀블러의 면적 무게중심: 축에서 본 위치·각도(rad, +X 기준 반시계)·거리 */
export function tumblerCom(): { x: number; y: number; angle: number; dist: number } {
  const p = tumblerOutline();
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i]!;
    const [x1, y1] = p[(i + 1) % p.length]!;
    const k = x0 * y1 - x1 * y0;
    a += k;
    cx += (x0 + x1) * k;
    cy += (y0 + y1) * k;
  }
  cx /= 3 * a;
  cy /= 3 * a;
  return { x: cx, y: cy, angle: Math.atan2(cy, cx), dist: Math.hypot(cx, cy) };
}

/** 텀블러(반달 추) E: 로컬 z 가운데에서 두께 thick 로 눌러 낸 황동 판. 회전축 = 로컬 Z, 원점 = 축 */
export function tumblerWeight(thick = 0.08): THREE.Group {
  const g = new THREE.Group();
  const geo = extrude(shapeFrom(tumblerOutline()), thick, 0.012);
  g.add(mesh(geo, brass({ roughness: 0.4 })));
  // 앞면의 밝은 표시 호(무게중심 쪽): 학생이 어느 쪽이 무거운지 보게
  const com = tumblerCom();
  const mark = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 24), darkSteel());
  mark.rotation.x = Math.PI / 2;
  mark.position.set(com.x, com.y, thick / 2 + 0.002);
  g.add(mark);
  return g;
}

/**
 * 반쯤 잘린 속 빈 축: z0~zFull 은 온 원통, zFull~z1 은 벽이 반쪽(각 a0 → a0+π)만 남은 홈통.
 * 회전축 = 로컬 Z. 잘린 쪽(a0−π → a0)이 핀이 지나는 자리.
 */
export function halfCutTube(rIn: number, rOut: number, z0: number, zFull: number, z1: number, a0: number): THREE.Group {
  const g = new THREE.Group();
  const ring = lathe(tubeProfile(rIn, rOut, 0, zFull - z0, 0.008), 40);
  ring.rotateX(Math.PI / 2);
  const m = mesh(ring, steel());
  m.position.z = z0;
  g.add(m);
  const half = mesh(extrude(annularSector(rIn, rOut, a0, a0 + Math.PI), z1 - zFull, 0.006), castIron());
  half.position.z = (zFull + z1) / 2;
  g.add(half);
  return g;
}

// ───────────────────────── 한 톱니 간헐 기어 (068) ─────────────────────────
// 판화 68번 다시 읽기(지시서 20 S1b): 둥근 바퀴 B(둘레에 톱니 A 하나, 톱니 양옆은 파임) + 홈 **10개** 바퀴 C.
// C 의 홈 사이 둘레는 B 의 둘레와 같은 반지름으로 **오목하게** 파여 있어(원문 hollows) B 둘레가 맞아 들어가 잠근다.
// 윤곽 두 개를 수치로 겹쳐 밀어내며 푼 결과(shots/_verify/s068b.mjs · s068c.mjs)를 표로 구워 넣었다.

export const ONE_TOOTH = {
  rB: 0.7, // B 반지름
  clearance: 0.002, // 오목 호와 B 둘레의 틈
  d: 1.38, // 중심 거리(판화 비 1.98·rB)
  n: 10, // C 홈 수(판화에서 셈)
  slotHalf: 0.055, // 홈 반폭
  slotFloor: 0.6, // 홈 바닥의 C 반지름
  toothAngle: Math.PI / 4, // θ=0 일 때 톱니 A 의 B 로컬 각(위쪽 오른쪽 — 판화 자세)
  toothRoot: 0.05, // 톱니 뿌리 반폭
  toothTip: 0.03, // 톱니 끝 반폭
  toothH: 0.05, // 톱니 높이(B 둘레 밖으로)
  relief: 0.24, // 톱니 양옆 파임의 반각(rad)
  reliefDepth: 0.085, // 파임 깊이
  reliefRamp: 0.05 // 파임 끝 비탈의 각 폭(rad)
} as const;

/** B(구동) 윤곽: 원 + 톱니 A + 톱니 양옆 파임(C 의 뿔이 지나갈 자리) */
export function oneToothOutlineB(): V2[] {
  const o = ONE_TOOTH;
  const pts: V2[] = [];
  const N = 1440;
  const aw = o.toothRoot / o.rB;
  const at = o.toothTip / o.rB;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ad = Math.abs(Math.atan2(Math.sin(a - o.toothAngle), Math.cos(a - o.toothAngle)));
    let r: number = o.rB;
    if (ad < o.relief) r = o.rB - o.reliefDepth * Math.min(1, (o.relief - ad) / o.reliefRamp);
    if (ad < aw) {
      const tt = ad <= at ? 1 : 1 - (ad - at) / (aw - at);
      r = Math.max(r, o.rB - o.reliefDepth + (o.toothH + o.reliefDepth) * tt);
    }
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/** C 의 뿔(오목 호 두 개가 만나는 꼭짓점) 반지름 */
export function slotHornRadius(): number {
  const o = ONE_TOOTH;
  const R = o.rB + o.clearance;
  const h = Math.PI / o.n;
  return o.d * Math.cos(h) - Math.sqrt(R * R - o.d * o.d * Math.sin(h) ** 2);
}

/** C(피동) 윤곽: 오목 호 10개(로컬 각 k·36° 가 호의 가운데) + 뿔마다 홈((k+½)·36°). 오목 호 = 중심이 C 에서 d 떨어진 반지름 rB+틈 의 원 */
export function slotOutlineC(): V2[] {
  const o = ONE_TOOTH;
  const n = o.n;
  const R = o.rB + o.clearance;
  const half = Math.PI / n;
  const rAt = (phi: number): number => o.d * Math.cos(phi) - Math.sqrt(R * R - o.d * o.d * Math.sin(phi) ** 2);
  // 홈 벽(뿔 방향과 나란)이 오목 호와 만나는 각
  let lo = 0;
  let hi = half;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (rAt(m) * Math.sin(half - m) > o.slotHalf) lo = m;
    else hi = m;
  }
  const edge = lo;
  const pts: V2[] = [];
  for (let k = 0; k < n; k++) {
    const a0 = (k * Math.PI * 2) / n;
    const m = 24;
    for (let i = 0; i <= m; i++) {
      const phi = -edge + (2 * edge * i) / m;
      const r = rAt(phi);
      pts.push([r * Math.cos(a0 + phi), r * Math.sin(a0 + phi)]);
    }
    const ah = a0 + half;
    const ux = Math.cos(ah);
    const uy = Math.sin(ah);
    pts.push([o.slotFloor * ux + o.slotHalf * uy, o.slotFloor * uy - o.slotHalf * ux], [o.slotFloor * ux - o.slotHalf * uy, o.slotFloor * uy + o.slotHalf * ux]);
  }
  return pts;
}

/** 표: B 가 (톱니 기준) 28°~72° 도는 동안 C 가 한 칸(36°) 도는 진행률(0~1), 0.5° 간격 */
const ONE_TOOTH_TABLE: number[] = [
  0, 0.0131, 0.0296, 0.0456, 0.0616, 0.0771, 0.0926, 0.1077, 0.1227, 0.1372, 0.1518, 0.1663, 0.1804, 0.195, 0.2085, 0.2226, 0.2362,
  0.2502, 0.2638, 0.2769, 0.2905, 0.3036, 0.3172, 0.3303, 0.3434, 0.3565, 0.3695, 0.3826, 0.3952, 0.4083, 0.4214, 0.434, 0.4471, 0.4597,
  0.4728, 0.4859, 0.4985, 0.5116, 0.5247, 0.5373, 0.5504, 0.564, 0.5795, 0.5955, 0.6115, 0.6275, 0.6435, 0.6591, 0.6751, 0.6906, 0.7056,
  0.7207, 0.7362, 0.7507, 0.7658, 0.7803, 0.7992, 0.821, 0.8424, 0.8623, 0.8802, 0.8967, 0.9113, 0.9239, 0.9345, 0.9437, 0.9515, 0.9583,
  0.9641, 0.9685, 0.9728, 0.9762, 0.9791, 0.9821, 0.9845, 0.9859, 0.9879, 0.9898, 0.9908, 0.9922, 0.9937, 0.9947, 0.9956, 0.9961, 0.9971,
  0.9981, 0.9985, 0.9995, 1
];
const TABLE_START = (28 * Math.PI) / 180;
const TABLE_STEP = (0.5 * Math.PI) / 180;

/** C 의 누적 회전각(rad, 반시계). thetaB = B 가 시계 방향으로 돈 누적각(톱니가 위 45° 에서 출발) — B 한 바퀴에 C 는 한 칸(36°) */
export function oneToothAngleC(thetaB: number): number {
  const TAU = Math.PI * 2;
  const q = Math.floor(thetaB / TAU);
  const a = thetaB - q * TAU;
  const u = (a - TABLE_START) / TABLE_STEP;
  let f: number;
  if (u <= 0) f = 0;
  else if (u >= ONE_TOOTH_TABLE.length - 1) f = 1;
  else {
    const i = Math.floor(u);
    f = ONE_TOOTH_TABLE[i]! + (ONE_TOOTH_TABLE[i + 1]! - ONE_TOOTH_TABLE[i]!) * (u - i);
  }
  return ((q + f) * TAU) / ONE_TOOTH.n;
}

function discWheel(outline: V2[], width: number, body: THREE.Material, mark: V2): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(extrude(shapeFrom(outline), width, 0.012), body));
  const boss = mesh(new THREE.CylinderGeometry(0.1, 0.1, width + 0.04, 32), darkSteel());
  boss.rotation.x = Math.PI / 2;
  g.add(boss);
  const dot = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 20), darkSteel());
  dot.rotation.x = Math.PI / 2;
  dot.position.set(mark[0], mark[1], width / 2 + 0.003);
  g.add(dot);
  g.userData.outline = outline;
  return g;
}

/** B: 톱니 하나 달린 둥근 바퀴(구동, 청동색). 원점 = 축, 회전축 = 로컬 Z, 톱니 방향 = ONE_TOOTH.toothAngle */
export function oneToothWheel(width = 0.14): THREE.Group {
  return discWheel(oneToothOutlineB(), width, bronze({ roughness: 0.34 }), [0.4 * Math.cos(Math.PI / 4 + Math.PI), 0.4 * Math.sin(Math.PI / 4 + Math.PI)]);
}

/** C: 홈 10개 바퀴(피동, 황동). 원점 = 축, 로컬 k·36° 가 오목 호의 가운데(정지 때 로컬 180° 호가 B 를 마주 본다) */
export function slotWheel(width = 0.14): THREE.Group {
  return discWheel(slotOutlineC(), width, brass(), [0.4, 0]);
}
