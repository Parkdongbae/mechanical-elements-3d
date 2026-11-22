// 동력 전달 투어(11-C) 데이터: 예시 차량 제원, 회전수 계산, 단계별 설명, 확인 문제.
// 화면의 모든 수치는 여기의 잇수·기어비에서 계산한다(따로 적어 둔 숫자 없음).

/** 변속기 상시 물림 기어: 입력축 20T → 부축 30T */
export const CONST_MESH = { input: 20, counter: 30 } as const;

export interface GearDef {
  n: 1 | 2 | 3 | 4 | 5;
  /** 부축 기어 잇수 → 출력축 기어 잇수. null이면 직결(입력축 = 출력축) */
  pair: { counter: number; main: number } | null;
}

/** 예시 FR 5단 수동 변속기. 4단은 직결(1 : 1), 5단은 오버드라이브 */
export const GEARS: readonly GearDef[] = [
  { n: 1, pair: { counter: 15, main: 36 } },
  { n: 2, pair: { counter: 20, main: 28 } },
  { n: 3, pair: { counter: 30, main: 28 } },
  { n: 4, pair: null },
  { n: 5, pair: { counter: 30, main: 16 } }
];

/** 변속비 = (부축 ÷ 입력) × (출력 기어 ÷ 부축 기어) */
export function gearRatio(g: GearDef): number {
  if (!g.pair) return 1;
  return (CONST_MESH.counter / CONST_MESH.input) * (g.pair.main / g.pair.counter);
}

export function gearDef(n: number): GearDef {
  return GEARS.find((g) => g.n === n) ?? GEARS[2]!;
}

/** 종감속: 구동 피니언 10T → 링 기어 39T */
export const FINAL = { pinion: 10, ring: 39 } as const;
export const FINAL_RATIO = FINAL.ring / FINAL.pinion;

/** 차동기어: 차동 피니언 10T, 사이드 기어 16T */
export const DIFF = { spider: 10, side: 16 } as const;

/** 타이어 205/55R16 — 지름 ≈ 0.632m, 둘레 ≈ 1.99m (계산은 화면에 보이는 1.99m로) */
export const TIRE = { name: '205/55R16', circ: 1.99 } as const;

/** 커브 예시: 뒤 차축 중심의 회전 반지름 10m, 좌우 뒷바퀴 사이 1.5m */
export const CURVE = { radius: 10, track: 1.5 } as const;
export const CURVE_K = CURVE.track / 2 / CURVE.radius;

export const RPM_MIN = 800;
export const RPM_MAX = 6000;
export const RPM_DEFAULT = 2000;
/** 화면 속 회전은 실제보다 이만큼 느리게(비율은 그대로) */
export const SLOWDOWN = 40;

export type Curve = 'straight' | 'left' | 'right';

export interface Calc {
  engine: number;
  ratio: number;
  /** 변속기 출력 = 프로펠러 샤프트 */
  out: number;
  /** 종감속 후(링 기어·차동 케이스) */
  axle: number;
  left: number;
  right: number;
  /** 차속 km/h (뒤 차축 중심 기준) */
  speed: number;
  /** 바퀴 토크 ÷ 엔진 토크 (마찰 손실 무시) */
  torqueX: number;
}

export function calc(engine: number, gear: number, curve: Curve): Calc {
  const ratio = gearRatio(gearDef(gear));
  const out = engine / ratio;
  const axle = out / FINAL_RATIO;
  // 왼쪽 커브면 왼쪽이 안쪽(느림). 두 바퀴 평균 = 링 기어 회전수
  const k = curve === 'left' ? CURVE_K : curve === 'right' ? -CURVE_K : 0;
  return {
    engine,
    ratio,
    out,
    axle,
    left: axle * (1 - k),
    right: axle * (1 + k),
    speed: (axle * TIRE.circ * 60) / 1000,
    torqueX: ratio * FINAL_RATIO
  };
}

export const fmtRpm = (v: number): string => Math.round(v).toLocaleString('ko-KR');
export const fmt1 = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);
/** 소수 둘째 자리까지, 끝의 0은 떼고 (3.60 → 3.6, 1.00 → 1) */
export const fmt2 = (v: number): string => String(Number(v.toFixed(2)));

// ───────── 투어 단계 ─────────

export type PartKey = 'engine' | 'clutch' | 'trans' | 'prop' | 'diff' | 'axle' | 'wheel';
export const PART_ORDER: readonly PartKey[] = ['engine', 'clutch', 'trans', 'prop', 'diff', 'axle', 'wheel'];

export interface StageDef {
  /** 0 = 전체 보기, 1~7 = 부품, 8 = 확인 문제 */
  id: number;
  short: string;
  title: string;
  part: PartKey | null;
  body: string;
  point: string;
}

export const STAGES: readonly StageDef[] = [
  {
    id: 0,
    short: '전체 보기',
    title: 'FR 후륜구동의 동력 전달',
    part: null,
    body: 'FR은 엔진이 차 앞(Front)에 있고, 뒷바퀴(Rear)를 굴려 달리는 방식이에요. 엔진에서 만든 회전이 여러 장치를 차례로 지나 뒷바퀴까지 전달돼요.',
    point: '엔진 → 플라이휠·클러치 → 변속기 → 프로펠러 샤프트 → 종감속·차동기어 → 차축 → 뒷바퀴'
  },
  {
    id: 1,
    short: '엔진',
    title: '엔진 — 힘을 만드는 곳',
    part: 'engine',
    body: '실린더 안에서 연료와 공기를 섞어 점화 플러그로 태우면 가스가 폭발하듯 팽창해 피스톤을 밀어 내려요. 피스톤의 왕복 운동은 커넥팅 로드를 거쳐 크랭크축의 회전 운동으로 바뀌어요.',
    point: '피스톤의 왕복 운동 → 크랭크축의 회전 운동. 실린더 4개가 차례로 폭발해 회전이 끊기지 않아요.'
  },
  {
    id: 2,
    short: '플라이휠·클러치',
    title: '플라이휠·클러치 — 고르게, 잇고 끊고',
    part: 'clutch',
    body: '크랭크축 끝의 무거운 원판인 플라이휠은 관성으로 회전을 고르게 해요. 클러치는 압력판이 클러치판을 플라이휠에 눌러 붙여 동력을 잇고, 클러치 페달을 밟으면 떼어 내 동력을 끊어요.',
    point: '출발하거나 기어를 바꿀 때 클러치 페달을 밟아 동력을 잠깐 끊어요.'
  },
  {
    id: 3,
    short: '변속기',
    title: '변속기 — 속도와 힘을 바꿔요',
    part: 'trans',
    body: '크기가 다른 기어를 바꿔 물려 회전 속도와 힘(토크)을 조절해요. 1단은 작은 기어가 큰 기어를 돌려 회전은 느리지만 힘이 커서 출발·오르막에 쓰고, 단이 높을수록 빨라지는 대신 힘은 작아져요.',
    point: '변속비가 3.6이면 회전은 3.6분의 1로 느려지고 힘은 약 3.6배가 돼요(마찰 손실 무시).'
  },
  {
    id: 4,
    short: '프로펠러 샤프트',
    title: '프로펠러 샤프트(추진축) — 뒤로 전달',
    part: 'prop',
    body: '변속기에서 나온 회전을 차 뒤쪽의 종감속 기어까지 전달하는 긴 축이에요. 변속기와 뒤 차축의 높이가 달라 축이 비스듬히 놓여요.',
    point: '양 끝의 유니버설 조인트(십자축 이음)가 축의 꺾인 각도와, 바퀴가 오르내릴 때 생기는 각도 변화를 흡수해요.'
  },
  {
    id: 5,
    short: '종감속·차동기어',
    title: '종감속 기어·차동기어',
    part: 'diff',
    body: '작은 구동 피니언이 큰 링 기어를 돌려요. 회전 방향이 90° 바뀌어 차축 방향이 되고, 회전수는 줄어드는 대신 힘이 커져요(종감속). 차동기어는 커브에서 좌우 바퀴가 서로 다른 빠르기로 돌 수 있게 해 줘요.',
    point: '커브에서는 바깥 바퀴가 더 먼 길을 가야 해요. 차동 피니언이 돌면서 좌우 회전수 차이를 만들어요.'
  },
  {
    id: 6,
    short: '차축',
    title: '차축(구동축) — 좌우 바퀴로',
    part: 'axle',
    body: '차동기어 양쪽의 사이드 기어에서 나온 회전을 왼쪽·오른쪽 뒷바퀴로 전달하는 축이에요. 이 차는 좌우 두 개의 축이 차축 하우징(관) 안에 들어 있어요.',
    point: '왼쪽 축과 오른쪽 축은 따로 돌 수 있어요. 그래서 커브에서 좌우 회전수가 달라도 괜찮아요.'
  },
  {
    id: 7,
    short: '바퀴',
    title: '바퀴 — 노면을 밀어 나아가요',
    part: 'wheel',
    body: '차축이 뒷바퀴를 돌리면 타이어가 노면을 뒤로 밀고, 그 반작용으로 노면이 타이어를 앞으로 밀어 차가 나아가요. 앞바퀴는 엔진과 이어져 있지 않아 차를 따라 굴러가며 방향을 바꾸는 일을 해요.',
    point: '차의 속도 = 바퀴 회전수 × 타이어 둘레. 바퀴가 1번 돌면 타이어 둘레만큼 나아가요.'
  },
  {
    id: 8,
    short: '확인 문제',
    title: '확인 문제',
    part: null,
    body: '',
    point: ''
  }
];

export const PART_NAME: Record<PartKey, string> = {
  engine: '엔진',
  clutch: '플라이휠·클러치',
  trans: '변속기',
  prop: '프로펠러 샤프트',
  diff: '종감속·차동기어',
  axle: '차축',
  wheel: '바퀴'
};

export const FF_COMPARE = 'FF(앞 엔진·앞바퀴 굴림)는 엔진·변속기·차동기어가 앞쪽에 모여 앞바퀴를 바로 돌리므로 프로펠러 샤프트가 없어요.';

// ───────── 확인 문제 ─────────

export interface QuizItem {
  q: string;
  choices: string[];
  answer: number;
  /** 정답 부품(3D 강조) */
  part: PartKey;
  explain: string;
}

export const QUIZ: readonly QuizItem[] = [
  {
    q: '엔진 → (   ) → 변속기 → 프로펠러 샤프트 → … 빈칸에 들어갈 장치는?',
    choices: ['차동기어', '플라이휠·클러치', '차축'],
    answer: 1,
    part: 'clutch',
    explain: '크랭크축 끝의 플라이휠과 클러치를 지나야 변속기로 동력이 들어가요.'
  },
  {
    q: '회전 방향을 90° 바꾸고 회전수를 줄여 힘을 키우는 곳은?',
    choices: ['종감속 기어', '변속기의 5단', '유니버설 조인트'],
    answer: 0,
    part: 'diff',
    explain: '구동 피니언이 링 기어를 돌리며 회전 방향이 바뀌고, 10T → 39T라서 회전이 3.9분의 1로 줄어요.'
  },
  {
    q: '커브를 돌 때 좌우 바퀴가 서로 다른 빠르기로 돌 수 있게 해 주는 장치는?',
    choices: ['플라이휠', '차동기어', '클러치'],
    answer: 1,
    part: 'diff',
    explain: '차동기어 속 차동 피니언이 돌면서 바깥 바퀴는 빠르게, 안쪽 바퀴는 느리게 돌게 해요.'
  },
  {
    q: 'FF(앞바퀴 굴림) 자동차에는 없고 FR 자동차에는 있는 부품은?',
    choices: ['변속기', '프로펠러 샤프트', '클러치'],
    answer: 1,
    part: 'prop',
    explain: FF_COMPARE
  }
];
