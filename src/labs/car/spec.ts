// 자동차 기어 변속 실험 — 차량 설정값과 공식(작업 지시서 11-B). 화면의 모든 수치는 여기서 계산한다.

export type GearId = 'N' | 'R' | 1 | 2 | 3 | 4 | 5;
export type ForwardGear = 1 | 2 | 3 | 4 | 5;

export const FORWARD_GEARS: readonly ForwardGear[] = [1, 2, 3, 4, 5];

export const SPEC = {
  ratios: { 1: 3.545, 2: 1.904, 3: 1.31, 4: 0.969, 5: 0.815, R: 3.25 } as const,
  finalDrive: 4.058,
  /** 타이어 195/65R15 둘레(m) */
  tyreCirc: 1.99,
  tyreName: '195/65R15',
  idleRpm: 800,
  maxRpm: 6500
} as const;

export function gearRatio(g: GearId): number {
  if (g === 'N') return 0;
  return g === 'R' ? SPEC.ratios.R : SPEC.ratios[g];
}

/** 속도(km/h) = 엔진 rpm ÷ (기어비 × 종감속비) × 타이어 둘레 × 60 ÷ 1000 */
export function speedFromRpm(rpm: number, ratio: number): number {
  if (ratio <= 0) return 0;
  return (rpm / (ratio * SPEC.finalDrive)) * SPEC.tyreCirc * 60 / 1000;
}

/** 역산: rpm = 속도(km/h) × 1000 ÷ 60 ÷ 타이어 둘레 × 기어비 × 종감속비 */
export function rpmFromSpeed(kmh: number, ratio: number): number {
  return ((kmh * 1000) / 60 / SPEC.tyreCirc) * ratio * SPEC.finalDrive;
}

export function gearLabel(g: GearId): string {
  if (g === 'N') return 'N';
  if (g === 'R') return 'R';
  return String(g);
}

export interface GearUse {
  gear: ForwardGear | 'R';
  use: string;
}

/** 단별 쓰임새(속도 범위는 표에서 공식으로 계산해 채운다) */
export const GEAR_USES: GearUse[] = [
  { gear: 1, use: '출발 · 가파른 오르막' },
  { gear: 2, use: '느린 주행 · 오르막' },
  { gear: 3, use: '시내 주행 · 가속' },
  { gear: 4, use: '빠른 도로 주행' },
  { gear: 5, use: '고속 정속 · 연비' },
  { gear: 'R', use: '뒤로 가기' }
];
