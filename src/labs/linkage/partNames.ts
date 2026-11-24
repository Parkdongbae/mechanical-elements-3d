// 링크 장치 이름표 — 기구마다 링크(막대·삼각 링크·레일·장식)의 이름.
// 순서는 mechanisms.ts 의 bars / plates / rails / decor 순서와 같다. 빈 글자('')는 이름표를 붙이지 않는다.
// 글자는 17 지시서 3절 용어와 각 기구의 how 문장에 나온 말만 쓴다. MechanismDef(계약)는 건드리지 않는다.

export interface PartNames {
  bars: string[];
  plates?: string[];
  rails?: string[];
  decor?: string[];
  /** 조인트 글자를 바꿀 때(id → 글자). 나머지 조인트는 id 그대로 */
  joints?: Record<string, string>;
}

const COUPLER = '커플러(연결 링크)';

export const PART_NAMES: Record<string, PartNames> = {
  'crank-rocker': { bars: ['고정 링크', '크랭크', COUPLER, '로커(흔들 링크)'], decor: ['와이퍼 날'] },
  parallel: { bars: ['고정 링크', '크랭크', COUPLER, '크랭크'], decor: ['바퀴', '바퀴'] },
  steering: { bars: ['고정 링크', '조향 팔', '타이 로드(커플러)', '조향 팔'], decor: ['바퀴', '바퀴'] },
  'slider-crank': { bars: ['크랭크', '연결봉(커플러)'], rails: ['슬라이더(미끄럼 블록)'] },
  'quick-return': { bars: ['고정 링크', '크랭크', '홈 파인 지렛대', '연결 링크'], rails: ['램'], decor: ['미끄럼 블록'] },
  chebyshev: { bars: ['고정 링크', '흔들 링크', COUPLER, '흔들 링크'] },
  watt: { bars: ['고정 링크', '흔들 링크', COUPLER, '흔들 링크'] },
  pantograph: { bars: ['링크', '링크', '링크', '링크'], joints: { O: '고정점 O', P: '추적점 P', Q: '펜 Q' } },
  jansen: {
    bars: ['고정 링크', '크랭크', '링크', '링크', '링크', '링크'],
    plates: ['삼각 링크', '삼각 링크'],
    decor: ['바닥'],
    joints: { F: '발끝 F' }
  },
  gripper: { bars: ['연결 링크', '연결 링크'], plates: ['집게 팔', '집게 팔'], rails: ['밀대'] }
};

/** 직접 만들기(fourbar)는 막대 순서가 치수에 따라 달라지므로 역할로 이름을 붙인다 */
export const CUSTOM_ROLE_NAMES: Record<string, string> = {
  ground: '고정 링크 d',
  input: '구동 링크 a',
  coupler: '커플러 b',
  output: '따라 움직이는 링크 c'
};
