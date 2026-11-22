// 자전거 기어 변속 실험 — 구성(잇수·바퀴 둘레)과 계산식. 화면의 모든 수치는 여기 함수로만 만든다.

export type BikeId = 'city' | 'road' | 'mtb';

export interface BikeSpec {
  id: BikeId;
  name: string;
  /** 구성 요약 (예: 3×7 = 21단) */
  combo: string;
  /** 앞 체인링 잇수 — 작은 것부터(앞 1단 = 가장 작은 체인링) */
  rings: number[];
  /** 뒤 스프로킷 잇수 — 큰 것부터(뒤 1단 = 가장 큰 스프로킷) */
  cogs: number[];
  tire: string;
  /** 바퀴(타이어) 둘레 m */
  circumference: number;
  /** 타이어 폭 m (3D 표현용) */
  tireWidth: number;
  defaultFront: number;
  defaultRear: number;
  frameColor: number;
  /** 체인이 심하게 비스듬해지는 조합인가 */
  crossChain(front: number, rear: number): boolean;
  // ── 3D 배치(m, 실물 근사) ──
  chainstay: number;
  ringSpacing: number;
  ringCenterZ: number;
  cogSpacing: number;
  cogCenterZ: number;
  hubHalf: number;
  cageLen: number;
  pulleyTeeth: number;
}

export const BIKES: BikeSpec[] = [
  {
    id: 'city',
    name: '생활·하이브리드',
    combo: '3×7 = 21단',
    rings: [28, 38, 48],
    cogs: [28, 24, 22, 20, 18, 16, 14],
    tire: '700×35C',
    circumference: 2.17,
    tireWidth: 0.035,
    defaultFront: 1,
    defaultRear: 3,
    frameColor: 0x2f6fb5,
    crossChain: (f, r) => (f === 2 && r <= 1) || (f === 0 && r >= 5),
    chainstay: 0.445,
    ringSpacing: 0.0065,
    ringCenterZ: 0.0475,
    cogSpacing: 0.005,
    cogCenterZ: 0.045,
    hubHalf: 0.0675,
    cageLen: 0.09,
    pulleyTeeth: 11
  },
  {
    id: 'road',
    name: '로드',
    combo: '2×11 = 22단',
    rings: [34, 50],
    cogs: [28, 25, 23, 21, 19, 17, 15, 14, 13, 12, 11],
    tire: '700×25C',
    circumference: 2.11,
    tireWidth: 0.025,
    defaultFront: 1,
    defaultRear: 5,
    frameColor: 0xc8312b,
    crossChain: (f, r) => (f === 1 && r <= 1) || (f === 0 && r >= 9),
    chainstay: 0.41,
    ringSpacing: 0.0075,
    ringCenterZ: 0.0435,
    cogSpacing: 0.00395,
    cogCenterZ: 0.0435,
    hubHalf: 0.065,
    cageLen: 0.08,
    pulleyTeeth: 11
  },
  {
    id: 'mtb',
    name: '산악자전거(MTB)',
    combo: '1×12 = 12단',
    rings: [32],
    cogs: [51, 45, 39, 33, 28, 24, 21, 18, 16, 14, 12, 10],
    tire: '29×2.25',
    circumference: 2.29,
    tireWidth: 0.057,
    defaultFront: 0,
    defaultRear: 6,
    frameColor: 0x2c8a5a,
    crossChain: () => false,
    chainstay: 0.435,
    ringSpacing: 0,
    ringCenterZ: 0.052,
    cogSpacing: 0.0038,
    cogCenterZ: 0.052,
    hubHalf: 0.074,
    cageLen: 0.13,
    pulleyTeeth: 12
  }
];

export function getBike(id: BikeId): BikeSpec {
  return BIKES.find((b) => b.id === id) ?? BIKES[0]!;
}

/** 기어비 = 앞 잇수 ÷ 뒤 잇수 (페달 1바퀴에 뒷바퀴가 도는 바퀴 수) */
export function gearRatio(ring: number, cog: number): number {
  return ring / cog;
}

/** 페달 1회전당 이동 거리(m) = 기어비 × 바퀴 둘레 */
export function development(ratio: number, circumference: number): number {
  return ratio * circumference;
}

/** 속도(km/h) = 케이던스(rpm) × 기어비 × 바퀴 둘레(m) × 60 ÷ 1000 */
export function speedKmh(cadence: number, ratio: number, circumference: number): number {
  return (cadence * ratio * circumference * 60) / 1000;
}

export interface Zone {
  id: number;
  name: string;
  /** 페달 1회전 이동 거리 상한(m, 미만) */
  max: number;
  desc: string;
  /** CSS 색 토큰 */
  color: string;
}

// 쓰임새 구분은 페달 1바퀴 이동 거리(기어비 × 둘레) 기준의 대략적인 안내다 — 바퀴 크기가 달라도 같은 기준을 쓸 수 있다.
export const ZONES: Zone[] = [
  { id: 0, name: '가파른 오르막·출발', max: 2.6, desc: '페달이 가장 가벼워요. 멈췄다가 출발할 때, 가파른 언덕을 오를 때 써요.', color: 'var(--ok)' },
  { id: 1, name: '완만한 오르막·맞바람', max: 4.4, desc: '조금 힘이 드는 길이에요. 완만한 언덕이나 맞바람이 불 때 써요.', color: 'var(--cat-shaft)' },
  { id: 2, name: '평지 주행', max: 6.6, desc: '평평한 길을 편하게 달릴 때 써요.', color: 'var(--cat-control)' },
  { id: 3, name: '빠른 평지·내리막', max: Infinity, desc: '페달이 무거운 대신 한 바퀴에 멀리 가요. 내리막이나 빠르게 달릴 때 써요.', color: 'var(--warn)' }
];

export function zoneOf(dev: number): Zone {
  return ZONES.find((z) => dev < z.max) ?? ZONES[ZONES.length - 1]!;
}

/** 페달 무게감 0~1 — 세 구성 전체의 이동 거리 범위(약 1.4~9.6m)에 맞춘 상대 막대 */
export function pedalWeight(dev: number): number {
  return Math.min(1, Math.max(0, (dev - 1.2) / (9.8 - 1.2)));
}

export interface TerrainTask {
  title: string;
  text: string;
  zone: number;
  /** 경사 (SVG 그림용, 양수 = 오르막) */
  slope: number;
  wind?: boolean;
}

export const TASKS: TerrainTask[] = [
  { title: '가파른 오르막', text: '앞에 가파른 언덕이 있어요. 페달을 가볍게 하려면 어떤 기어가 알맞을까요?', zone: 0, slope: 0.5 },
  { title: '평지', text: '평평한 자전거 길이에요. 편하게 달릴 수 있는 기어로 바꿔 보세요.', zone: 2, slope: 0 },
  { title: '맞바람', text: '앞에서 바람이 세게 불어요. 평지보다 조금 가벼운 기어가 좋아요.', zone: 1, slope: 0, wind: true },
  { title: '긴 내리막', text: '내리막이라 바퀴가 빨리 돌아요. 페달이 헛돌지 않게 무거운 기어로 바꿔 보세요.', zone: 3, slope: -0.4 }
];
