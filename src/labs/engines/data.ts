// 엔진의 종류 — 배열 데이터. 모든 엔진은 같은 생성기(model.ts)가 이 값만으로 만든다.
// 크랭크 핀 위상은 따로 적지 않고 "점화 순서 + 뱅크 각"에서 계산한다:
//   k번째로 점화하는 실린더의 점화 각 F = k × (720° ÷ 실린더 수)  (4행정, 등간격 점화)
//   그 실린더가 F에서 상사점에 오려면 핀 위상 φ = 뱅크 각 β − F  (mod 360°)
// 이렇게 하면 화면 속 피스톤 위치와 점화 순서가 항상 서로 맞는다.

export type EngineId = 'i4' | 'i6' | 'v6' | 'v8' | 'b4' | 'v12' | 'w16';
export type BankColor = 'shaft' | 'ok' | 'control' | 'power';

/** 3D 뱅크 색 — tokens.css의 --cat-shaft / --ok / --cat-control / --cat-power(밝은 테마)와 같은 톤 */
export const BANK_HEX: Record<BankColor, number> = {
  shaft: 0x2681d6,
  ok: 0x16925a,
  control: 0x8a4fd8,
  power: 0xdc3e44
};

export interface BankDef {
  /** 실린더 축의 기울기: 수직(+Y)에서 +Z 쪽으로(도) */
  angle: number;
  /** 크랭크축 방향(X) 오프셋 — 같은 줄(row)의 다른 뱅크와 커넥팅 로드가 겹치지 않게 */
  xOff: number;
  name: string;
  color: BankColor;
  /** 이 뱅크의 실린더 번호(앞(+X)에서 뒤로) */
  nums: number[];
}

export interface Dims {
  /** 크랭크 반지름(행정의 절반) */
  crankR: number;
  rodL: number;
  pistonR: number;
  /** 같은 뱅크 안 실린더 간격 */
  pitch: number;
}

export interface EngineDef {
  id: EngineId;
  code: string;
  name: string;
  layout: string;
  cyl: number;
  banks: BankDef[];
  dims: Dims;
  firing: number[];
  /** true면 '예시 순서'로 표시(배열마다 여러 순서가 있거나 확실하지 않음) */
  firingExample: boolean;
  firingNote: string;
  bankAngle: string;
  summary: string;
  pros: string[];
  cons: string[];
  uses: string;
  special?: string;
}

const STD: Dims = { crankR: 0.13, rodL: 0.46, pistonR: 0.15, pitch: 0.42 };
const PAIR: Dims = { crankR: 0.13, rodL: 0.46, pistonR: 0.15, pitch: 0.46 };
// W16은 좁은 V(약 15°) 두 줄이 엇갈려 붙으므로 보어를 조금 작게, 간격은 넓게 잡는다
const W: Dims = { crankR: 0.11, rodL: 0.5, pistonR: 0.12, pitch: 0.62 };

const range = (a: number, n: number, step = 1): number[] => Array.from({ length: n }, (_, i) => a + i * step);

export const ENGINES: EngineDef[] = [
  {
    id: 'i4',
    code: 'I4',
    name: '직렬 4기통',
    layout: '직렬형 — 실린더 4개가 한 줄',
    cyl: 4,
    banks: [{ angle: 0, xOff: 0, name: '한 줄', color: 'shaft', nums: [1, 2, 3, 4] }],
    dims: STD,
    firing: [1, 3, 4, 2],
    firingExample: false,
    firingNote: '직렬 4기통에서 가장 널리 쓰이는 순서예요.',
    bankAngle: '없음(한 줄)',
    summary: '가장 흔한 승용차 엔진이에요.',
    pros: ['구조가 간단하고 작아요', '만들기 쉽고 값이 싸요'],
    cons: ['실린더가 적어 6기통보다 진동이 커요'],
    uses: '소형·중형 승용차 대부분'
  },
  {
    id: 'i6',
    code: 'I6',
    name: '직렬 6기통',
    layout: '직렬형 — 실린더 6개가 한 줄',
    cyl: 6,
    banks: [{ angle: 0, xOff: 0, name: '한 줄', color: 'shaft', nums: range(1, 6) }],
    dims: STD,
    firing: [1, 5, 3, 6, 2, 4],
    firingExample: false,
    firingNote: '직렬 6기통에서 가장 널리 쓰이는 순서예요.',
    bankAngle: '없음(한 줄)',
    summary: '진동이 적고 아주 부드럽게 돌아요.',
    pros: ['진동이 적고 부드러워요', '구조가 비교적 단순해요'],
    cons: ['길이가 길어 차에 싣기 어려워요'],
    uses: '고급 세단, 대형 트럭(디젤)'
  },
  {
    id: 'v6',
    code: 'V6',
    name: 'V형 6기통',
    layout: 'V형 — 3개씩 두 줄이 V자',
    cyl: 6,
    banks: [
      { angle: 30, xOff: 0, name: 'A 뱅크', color: 'shaft', nums: [1, 3, 5] },
      { angle: -30, xOff: 0.09, name: 'B 뱅크', color: 'control', nums: [2, 4, 6] }
    ],
    dims: PAIR,
    firing: [1, 6, 5, 4, 3, 2],
    firingExample: true,
    firingNote: '실린더 번호를 매기는 방법과 순서는 제조사마다 달라요.',
    bankAngle: '60°(대표값)',
    summary: '6기통인데 길이가 짧아요.',
    pros: ['길이가 짧아 엔진룸에 넣기 쉬워요', '앞바퀴굴림 차에도 가로로 싣기 쉬워요'],
    cons: ['실린더 헤드가 두 개라 부품이 많아요'],
    uses: '중형·대형 승용차, SUV'
  },
  {
    id: 'v8',
    code: 'V8',
    name: 'V형 8기통',
    layout: 'V형 — 4개씩 두 줄이 V자',
    cyl: 8,
    banks: [
      { angle: 45, xOff: 0, name: 'A 뱅크', color: 'shaft', nums: [1, 3, 5, 7] },
      { angle: -45, xOff: 0.09, name: 'B 뱅크', color: 'control', nums: [2, 4, 6, 8] }
    ],
    dims: PAIR,
    firing: [1, 8, 4, 3, 6, 5, 7, 2],
    firingExample: true,
    firingNote: '크랭크 핀이 90°씩 엇갈린 크로스플레인 V8의 대표적인 예예요. 제조사마다 번호와 순서가 달라요.',
    bankAngle: '90°(대표값)',
    summary: '큰 힘을 내는 엔진이에요.',
    pros: ['배기량을 키워 큰 힘을 내기 좋아요', '8개라 폭발이 촘촘해요'],
    cons: ['크고 무거워요', '연료를 많이 써요'],
    uses: '대형 SUV·픽업트럭, 스포츠카'
  },
  {
    id: 'b4',
    code: 'B4',
    name: '수평대향 4기통',
    layout: '수평대향형 — 2개씩 마주 보고 누움',
    cyl: 4,
    banks: [
      { angle: 90, xOff: 0, name: 'A 쪽', color: 'shaft', nums: [1, 3] },
      { angle: -90, xOff: 0.09, name: 'B 쪽', color: 'control', nums: [2, 4] }
    ],
    dims: PAIR,
    firing: [1, 3, 2, 4],
    firingExample: true,
    firingNote: '수평대향 4기통의 순서 가운데 한 가지 예예요.',
    bankAngle: '180°(양쪽으로 누움)',
    summary: '피스톤이 권투 선수처럼 서로 마주 보고 움직여요.',
    pros: ['높이가 낮아 무게 중심이 낮아요', '마주 보는 피스톤이 반대로 움직여 진동을 줄여요'],
    cons: ['폭이 넓어요', '정비할 때 손이 많이 가요'],
    uses: '일부 승용차·스포츠카'
  },
  {
    id: 'v12',
    code: 'V12',
    name: 'V형 12기통',
    layout: 'V형 — 6개씩 두 줄이 V자',
    cyl: 12,
    banks: [
      { angle: 30, xOff: 0, name: 'A 뱅크', color: 'shaft', nums: range(1, 6) },
      { angle: -30, xOff: 0.09, name: 'B 뱅크', color: 'control', nums: range(7, 6) }
    ],
    dims: PAIR,
    firing: [1, 11, 5, 9, 3, 12, 6, 8, 2, 10, 4, 7],
    firingExample: true,
    firingNote: '직렬 6기통 두 개를 번갈아 점화하는 한 가지 예예요.',
    bankAngle: '60°(대표값)',
    summary: '매우 부드럽고 강력해요.',
    pros: ['폭발이 아주 촘촘해 매우 부드러워요', '큰 힘을 내요'],
    cons: ['길고 무겁고 비싸요', '연료를 많이 써요'],
    uses: '고급 스포츠카, 최고급 세단'
  },
  {
    id: 'w16',
    code: 'W16',
    name: 'W형 16기통',
    layout: 'W형 — 4개씩 네 줄(좁은 V 두 개를 W자로)',
    cyl: 16,
    banks: [
      { angle: 52.5, xOff: 0, name: 'A 줄', color: 'shaft', nums: [1, 2, 3, 4] },
      { angle: 37.5, xOff: 0.31, name: 'B 줄', color: 'ok', nums: [5, 6, 7, 8] },
      { angle: -37.5, xOff: 0.4, name: 'C 줄', color: 'control', nums: [9, 10, 11, 12] },
      { angle: -52.5, xOff: 0.09, name: 'D 줄', color: 'power', nums: [13, 14, 15, 16] }
    ],
    dims: W,
    firing: [1, 11, 8, 14, 3, 12, 6, 13, 4, 10, 5, 15, 2, 9, 7, 16],
    firingExample: true,
    firingNote: '등간격(45°)으로 점화하도록 만든 예시 순서예요. 실제 베이론의 순서와 다를 수 있어요.',
    bankAngle: '두 V 사이 90° · 각 V 안 약 15°',
    summary: '좁은 V8 두 개를 붙인 W자 엔진이에요.',
    pros: ['16기통인데 길이가 V8과 비슷하게 짧아요', '엄청나게 큰 힘을 내요'],
    cons: ['구조가 매우 복잡하고 무거워요', '열이 많이 나 냉각 장치가 커요'],
    uses: '부가티 베이론(하이퍼카)',
    special: '부가티 베이론에 쓰인 엔진이에요. 배기량 8.0L, 터보차저 4개, 약 1,001마력(초기형)으로 널리 알려져 있어요.'
  }
];

export function engineDef(id: EngineId): EngineDef {
  const d = ENGINES.find((e) => e.id === id);
  if (!d) throw new Error(`unknown engine ${id}`);
  return d;
}

export const KEY_SENTENCE = '실린더가 많을수록 폭발이 촘촘해 회전이 부드럽고 힘이 커지지만, 크고 무겁고 비싸요.';

export interface CylInfo {
  num: number;
  bank: number;
  row: number;
  /** 크랭크축 방향 위치 */
  x: number;
  /** 뱅크 각(rad) */
  beta: number;
  /** 크랭크 핀 위상(rad) */
  phi: number;
  /** 4행정 720° 중 점화 각(rad) */
  fire: number;
}

const DEG = Math.PI / 180;

/** 실린더별 위치·핀 위상·점화 각 계산 */
export function cylinders(def: EngineDef): CylInfo[] {
  const rows = Math.max(...def.banks.map((b) => b.nums.length));
  const span = Math.max(...def.banks.map((b) => b.xOff));
  const out: CylInfo[] = [];
  const step = 720 / def.cyl;
  def.banks.forEach((b, bi) => {
    b.nums.forEach((num, row) => {
      const k = def.firing.indexOf(num);
      if (k < 0) throw new Error(`${def.id}: cylinder ${num} missing in firing order`);
      const F = k * step;
      const phi = (((b.angle - F) % 360) + 360) % 360;
      // 1번(앞, +X)부터 뒤로
      const x = ((rows - 1) / 2 - row) * def.dims.pitch + span / 2 - b.xOff;
      out.push({ num, bank: bi, row, x, beta: b.angle * DEG, phi: phi * DEG, fire: F * DEG });
    });
  });
  return out;
}

/** 점화 간격(도) */
export const interval = (def: EngineDef): number => 720 / def.cyl;
