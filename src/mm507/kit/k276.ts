// 276 세 갈래 정폭 캠 전용 키트 — 캠 윤곽(피치 곡선의 안쪽 평행 곡선) + 롤러 구름 표 + 닫힌 운동식
// 설계표 docs/mm507-sheets/276.md 의 치수·식을 그대로 옮겼다.

/** 276번 상수 — 캠 중심 C, 피치 기준 R0, 진폭 A, 롤러 반지름 RR, 롤러 중심 반거리 HALF, 각속도 OMEGA */
export const K276 = {
  C: [0, 1.65] as [number, number],
  R0: 0.66,
  A: 0.22,
  RR: 0.07,
  HALF: 0.66,
  OMEGA: 0.6,
  SIGMA120: 1.68661,
  SIGMA360: 5.05984
};

const rho = (psi: number): number => K276.R0 + K276.A * Math.cos(3 * psi);
const drho = (psi: number): number => -3 * K276.A * Math.sin(3 * psi);

/** 피치 곡선 점 ρ(ψ)(cos ψ, sin ψ) */
export function cam276Pitch(psi: number): [number, number] {
  const r = rho(psi);
  return [r * Math.cos(psi), r * Math.sin(psi)];
}

/** 캠 윤곽(캠 좌표, 반시계): 피치 곡선 − 0.07·바깥 법선, ψ = 2πi/n */
export function cam276Outline(n: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const psi = (2 * Math.PI * i) / n;
    const r = rho(psi);
    const dr = drho(psi);
    const px = r * Math.cos(psi);
    const py = r * Math.sin(psi);
    const dx = dr * Math.cos(psi) - r * Math.sin(psi);
    const dy = dr * Math.sin(psi) + r * Math.cos(psi);
    const L = Math.hypot(dx, dy);
    const nx = dy / L;
    const ny = -dx / L;
    pts.push([px - K276.RR * nx, py - K276.RR * ny]);
  }
  return pts;
}

// 피치 곡선 길이 표 — 0 ~ 120° 를 0.01° 간격으로(사다리꼴 적분), 나머지는 주기·홀수 확장
const STEP = (Math.PI / 180) * 0.01;
const NTAB = 12000;
let TABLE: Float64Array | null = null;
function table(): Float64Array {
  if (TABLE) return TABLE;
  const tab = new Float64Array(NTAB + 1);
  const f = (p: number): number => Math.hypot(rho(p), drho(p));
  let prev = f(0);
  for (let i = 1; i <= NTAB; i++) {
    const cur = f(i * STEP);
    tab[i] = (tab[i - 1] as number) + 0.5 * (prev + cur) * STEP;
    prev = cur;
  }
  TABLE = tab;
  return tab;
}

/** 피치 곡선 길이 σ(ψ) — 0 부터 잰 길이, 홀수 함수, 120° 마다 SIGMA120 씩 늘어남 */
export function sigma276(psi: number): number {
  const tab = table();
  const s120 = tab[NTAB] as number;
  const sign = psi < 0 ? -1 : 1;
  const a = Math.abs(psi);
  const per = (2 * Math.PI) / 3;
  const k = Math.floor(a / per);
  const r = a - k * per;
  const x = r / STEP;
  const i = Math.min(NTAB - 1, Math.floor(x));
  const lo = tab[i] as number;
  const hi = tab[i + 1] as number;
  return sign * (k * s120 + lo + (hi - lo) * (x - i));
}

export interface State276 {
  phi: number;
  X: number;
  zetaL: number;
  zetaR: number;
  /** 막대가 가는 쪽: −1 왼쪽, +1 오른쪽 */
  dir: number;
}

/** 276번 운동식(t = 초) */
export function state276(t: number): State276 {
  const phi = K276.OMEGA * t;
  const X = K276.A * Math.cos(3 * phi);
  const zetaR = phi - sigma276(phi) / K276.RR;
  const zetaL = phi + (sigma276(Math.PI - phi) - sigma276(Math.PI)) / K276.RR;
  const dir = -Math.sign(Math.sin(3 * phi)) || 1;
  return { phi, X, zetaL, zetaR, dir };
}
