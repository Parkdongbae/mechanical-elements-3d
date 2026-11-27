// 286 증기 기관 밸브 들개(토와 리프터) 전용 키트 — 상수, 닫힌 식 운동(state286), 토 윤곽·들개 윤곽.
// 설계표 docs/mm507-sheets/286.md 의 치수·식을 그대로 옮겼다. 자세는 t(초)의 절대 함수다.
type V2 = [number, number];
const DEG = Math.PI / 180;

export const K286 = {
  S: [0.735, 1.45] as V2,
  O: [-0.82996, -1.92214] as V2,
  RHO: 4.0,
  ARC_DEG: [95.416, 68.131] as V2,
  H0: 2.07786,
  B_MID: -1,
  B_AMP: 5,
  PERIOD: 3,
  HUB_R: 0.13,
  /** 토 아랫면 점열(세계 좌표, b = 0): 허브 쪽 → 끝 */
  TOE_LOW: [
    [0.416, 1.375],
    [0.36, 1.431],
    [0.2475, 1.506],
    [0.06, 1.6],
    [-0.315, 1.694],
    [-0.69, 1.7875],
    [-1.065, 1.881],
    [-1.2075, 2.0125]
  ] as V2[],
  /** 들개 점열(세계 좌표): 밑면 왼쪽 → 밑면 오른쪽 → 위 오른쪽 → 위 왼쪽 */
  LIFTER: [
    [-1.33, 2.07786],
    [0.92, 2.07786],
    [0.92, 2.62],
    [-1.33, 2.1]
  ] as V2[]
} as const;
const K = K286;

/** 토 윤곽(그룹 좌표: 원점 = 흔들 축 S). 윗면 원호 24 등분 + 축 구멍 0.13 을 비운 허브 쪽 + 아랫면 + 끝 반원 */
export function toeOutline286(): V2[] {
  const [sx, sy] = K.S;
  const [ox, oy] = K.O;
  const pts: V2[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = (K.ARC_DEG[0] + ((K.ARC_DEG[1] - K.ARC_DEG[0]) * i) / n) * DEG;
    pts.push([ox + K.RHO * Math.cos(a), oy + K.RHO * Math.sin(a)]);
  }
  // 허브 쪽: 설계표는 S 점 하나로 닫지만, 축(반지름 0.13)과 겹치지 않게 같은 쐐기에서 축 원 안쪽만 덜어 낸다
  const first = pts[n]!;
  const last = K.TOE_LOW[0]!;
  const a1 = Math.atan2(first[1] - sy, first[0] - sx);
  let a2 = Math.atan2(last[1] - sy, last[0] - sx);
  if (a2 < a1) a2 += Math.PI * 2;
  const m = 10;
  for (let i = 0; i <= m; i++) {
    const a = a1 + ((a2 - a1) * i) / m;
    pts.push([sx + K.HUB_R * Math.cos(a), sy + K.HUB_R * Math.sin(a)]);
  }
  for (const p of K.TOE_LOW) pts.push([p[0], p[1]]);
  // 끝 둥글림: (−1.2075, 2.0125) → (−1.2075, 2.0600), 왼쪽으로 볼록한 반원
  const cx = -1.2075;
  const cy = 2.03625;
  const r = 0.02375;
  for (let i = 1; i < 8; i++) {
    const a = (-90 - 180 * (i / 8)) * DEG;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts.map(([x, y]) => [x - sx, y - sy] as V2);
}

/** 들개 윤곽(세계 좌표, lift = 0): 왼쪽 끝 두 모서리 반지름 0.01 둥글림 */
export function lifterOutline286(): V2[] {
  const [a, b, c, d] = K.LIFTER;
  const r = 0.01;
  const out: V2[] = [];
  const arc = (cx: number, cy: number, a0: number, a1: number): void => {
    for (let i = 0; i <= 4; i++) {
      const t = (a0 + ((a1 - a0) * i) / 4) * DEG;
      out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
  };
  // 아래 왼쪽 모서리(중심 a + (r, r)): 180° → 270°
  arc(a![0] + r, a![1] + r, 180, 270);
  out.push([b![0], b![1]], [c![0], c![1]]);
  // 위 왼쪽 모서리(중심 d + (r, −r)): 90° → 180°
  arc(d![0] + r, d![1] - r, 90, 180);
  return out;
}

export interface State286 {
  b: number;
  lift: number;
  contactX: number;
  gap: number;
  touching: boolean;
}

export function state286(t: number): State286 {
  const b = K.B_MID + K.B_AMP * Math.sin((2 * Math.PI * t) / K.PERIOD);
  const r = b * DEG;
  const h = 5.45 + 1.56496 * Math.sin(r) - 3.37214 * Math.cos(r);
  const lift = Math.max(0, h - K.H0);
  const contactX = 0.735 - 1.56496 * Math.cos(r) - 3.37214 * Math.sin(r);
  return { b, lift, contactX, gap: lift > 0 ? 0 : K.H0 - h, touching: lift > 0 };
}
