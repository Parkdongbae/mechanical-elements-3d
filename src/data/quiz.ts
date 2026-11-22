// 단원 퀴즈 문항 데이터 — 2022 개정 중학교 기술·가정 '기계의 구성과 동력 전달' 수준.
// 쓰임새 문항은 정답·오답 모두 부품 id로 두고, 화면에서 부품 이름으로 바꿔 보여 준다.

export interface SituationQ {
  id: string;
  /** 상황 설명(질문) */
  q: string;
  /** 정답 부품 id */
  answer: string;
  /** 오답 부품 id 3개 */
  distractors: [string, string, string];
  explain: string;
}

export interface TrueFalseQ {
  id: string;
  statement: string;
  answer: boolean;
  explain: string;
  /** 해설과 함께 보여 줄 부품 */
  partId: string;
}

export const SITUATION_QUESTIONS: SituationQ[] = [
  {
    id: 's-chain', q: '두 축의 거리가 멀고, 미끄럼 없이 정확하게 동력을 전달해야 합니다. 알맞은 것은?',
    answer: 'chain', distractors: ['beltPulley', 'spurGear', 'frictionWheel'],
    explain: '체인은 스프로킷 이에 걸려 맞물리므로 멀리 떨어진 두 축에도 미끄러지지 않고 정확하게 전달해요.'
  },
  {
    id: 's-rack', q: '자동차 핸들을 돌리는 회전 운동을 바퀴 방향을 바꾸는 직선 운동으로 바꿔 줍니다. 알맞은 것은?',
    answer: 'rackPinion', distractors: ['wormGear', 'bevelGear', 'cam'],
    explain: '래크와 피니언은 회전 운동과 직선 운동을 서로 바꾸며, 자동차 조향 장치에 쓰여요.'
  },
  {
    id: 's-bevel', q: '직각으로 만나는 두 축 사이에 동력을 전달하려고 합니다. 알맞은 것은?',
    answer: 'bevelGear', distractors: ['spurGear', 'helicalGear', 'frictionWheel'],
    explain: '베벨 기어는 원뿔 모양이어서 직각으로 만나는 두 축 사이에 동력을 전달할 수 있어요. 드릴에 쓰입니다.'
  },
  {
    id: 's-worm', q: '속도를 크게 줄이는 큰 감속비가 필요하고, 두 축은 평행하지도 교차하지도 않습니다. 알맞은 것은?',
    answer: 'wormGear', distractors: ['spurGear', 'bevelGear', 'rackPinion'],
    explain: '웜과 웜 기어는 한 단계에서 큰 감속비를 얻을 수 있고, 두 축이 엇갈려 배치돼요.'
  },
  {
    id: 's-helical', q: '평행한 두 축 사이에서 진동과 소음이 적은 기어를 쓰고 싶습니다. 알맞은 것은?',
    answer: 'helicalGear', distractors: ['spurGear', 'bevelGear', 'rackPinion'],
    explain: '헬리컬 기어는 이가 경사져 부드럽게 맞물리므로 진동과 소음이 적어요.'
  },
  {
    id: 's-friction', q: '기계가 회전하는 도중에도 동력을 연결하고 끊을 수 있어야 합니다. 알맞은 것은?',
    answer: 'frictionWheel', distractors: ['spurGear', 'chain', 'wormGear'],
    explain: '마찰차는 접촉면의 마찰력으로 전달하므로 회전 중에도 연결하고 분리할 수 있어요.'
  },
  {
    id: 's-split', q: '너트가 풀리지 않도록 끝을 벌려서 고정하려고 합니다. 알맞은 것은?',
    answer: 'pinSplit', distractors: ['pinParallel', 'pinTaper', 'bolt'],
    explain: '분할 핀은 끝이 두 갈래로 갈라져 있어, 끼운 뒤 끝을 벌리면 빠지지 않아요.'
  },
  {
    id: 's-parallel', q: '굵기가 처음부터 끝까지 일정하고, 자전거 체인의 연결 부분에 쓰이는 핀은?',
    answer: 'pinParallel', distractors: ['pinTaper', 'pinSplit', 'bolt'],
    explain: '평행 핀은 굵기가 일정한 핀이에요. 끝으로 갈수록 가늘어지는 것은 테이퍼 핀입니다.'
  },
  {
    id: 's-taper', q: '끝으로 갈수록 가늘어져서 구멍에 꼭 끼워 고정하는 핀은?',
    answer: 'pinTaper', distractors: ['pinParallel', 'pinSplit', 'bolt'],
    explain: '테이퍼 핀은 점점 가늘어지는 모양이라 단단히 끼워져요. 자전거 페달과 크랭크 연결에 쓰입니다.'
  },
  {
    id: 's-cam', q: '둥글지 않은 판이 회전하면서 닿아 있는 막대를 위아래로 움직이게 합니다. 알맞은 것은?',
    answer: 'cam', distractors: ['spurGear', 'beltPulley', 'sprocket'],
    explain: '캠은 회전 운동을 왕복 운동으로 바꿔요. 자동차 엔진과 오토마타에 쓰입니다.'
  },
  {
    id: 's-link', q: '여러 개의 막대를 핀으로 연결해 회전 운동을 다른 운동으로 바꾸는 자동차 와이퍼에 쓰이는 것은?',
    answer: 'link', distractors: ['cam', 'rackPinion', 'chain'],
    explain: '링크는 막대를 핀으로 연결해 운동의 형태를 바꾸는 장치예요. 자동차 와이퍼가 대표적입니다.'
  },
  {
    id: 's-bearing', q: '회전하는 축을 받치면서 마찰을 줄여 매끄럽게 돌게 하는 것은?',
    answer: 'bearing', distractors: ['axle', 'driveShaft', 'spring'],
    explain: '베어링은 마찰을 줄여 축이 부드럽게 돌게 해요. 볼 베어링은 구슬이 구르는 구름 베어링입니다.'
  },
  {
    id: 's-spring', q: '눌렀다 놓으면 원래 모양으로 돌아오는 성질로 충격을 줄여 줍니다. 알맞은 것은?',
    answer: 'spring', distractors: ['blockBrake', 'discBrake', 'bearing'],
    explain: '스프링은 탄성으로 충격을 완화해요. 시계를 돌리는 태엽도 스프링입니다.'
  },
  {
    id: 's-block', q: '브레이크 블록을 바퀴 테에 눌러 마찰력으로 멈추게 하는 자전거의 림 브레이크는?',
    answer: 'blockBrake', distractors: ['discBrake', 'spring', 'frictionWheel'],
    explain: '블록 브레이크는 블록을 회전하는 바퀴 테에 눌러 마찰로 제동해요.'
  },
  {
    id: 's-disc', q: '바퀴와 함께 도는 디스크를 패드로 집어 눌러 멈추게 하는 제동 장치는?',
    answer: 'discBrake', distractors: ['blockBrake', 'spring', 'bearing'],
    explain: '디스크 브레이크는 회전하는 디스크를 패드로 집어 마찰로 제동해요.'
  },
  {
    id: 's-axle', q: '몸체에 고정되어 있고 그 둘레를 바퀴 같은 회전체만 도는 축은?',
    answer: 'axle', distractors: ['driveShaft', 'crankShaft', 'bearing'],
    explain: '차축은 몸체에 고정되어 회전체를 받쳐 주고, 회전체만 회전해요.'
  },
  {
    id: 's-drive', q: '회전체에 고정되어 함께 회전하면서 동력을 전달하는 축은?',
    answer: 'driveShaft', distractors: ['axle', 'crankShaft', 'bearing'],
    explain: '전동축은 회전체와 함께 돌며 동력을 전달해요.'
  },
  {
    id: 's-crank', q: '자전거 페달을 밟는 힘을 받아 회전하며, 회전 운동과 왕복 운동을 서로 바꿀 수 있는 축은?',
    answer: 'crankShaft', distractors: ['axle', 'driveShaft', 'bearing'],
    explain: '크랭크축은 크랭크가 달려 회전 운동과 왕복 운동을 서로 바꿔 줘요.'
  },
  {
    id: 's-belt', q: '재봉틀이나 세탁기에서 마찰력을 이용해 조용히 동력을 전달하는 것은?',
    answer: 'beltPulley', distractors: ['chain', 'spurGear', 'bevelGear'],
    explain: '벨트와 풀리는 마찰력으로 전달하므로 조용하지만, 미끄러질 수 있어요.'
  },
  {
    id: 's-spur', q: '가깝고 평행한 두 축 사이에서 정확하게 동력을 전달하며 시계에 쓰이는 기어는?',
    answer: 'spurGear', distractors: ['bevelGear', 'wormGear', 'rackPinion'],
    explain: '평 기어는 이가 축과 나란한 가장 기본적인 기어예요. 시계와 선반에 쓰입니다.'
  },
  {
    id: 's-bolt', q: '수나사와 암나사가 맞물려 두 부품을 결합하고, 필요하면 다시 풀 수 있는 것은?',
    answer: 'bolt', distractors: ['pinParallel', 'pinTaper', 'pinSplit'],
    explain: '볼트(수나사)와 너트(암나사)는 나사산이 맞물려 결합해요. 돌려서 풀 수 있습니다.'
  },
  {
    id: 's-sprocket', q: '체인의 마디와 맞물리는 톱니가 있어 자전거에서 체인과 함께 쓰이는 것은?',
    answer: 'sprocket', distractors: ['spurGear', 'beltPulley', 'frictionWheel'],
    explain: '스프로킷은 체인과 맞물려 미끄러짐 없이 동력을 전달해요.'
  }
];

export const TRUE_FALSE_QUESTIONS: TrueFalseQ[] = [
  {
    id: 't-axle', statement: '차축은 바퀴와 함께 회전하면서 동력을 전달한다.', answer: false, partId: 'axle',
    explain: '차축은 몸체에 고정되어 바퀴만 돌게 해요. 회전체와 함께 돌며 동력을 전달하는 것은 전동축입니다.'
  },
  {
    id: 't-spur', statement: '서로 맞물려 돌아가는 두 평 기어는 회전 방향이 반대이다.', answer: true, partId: 'spurGear',
    explain: '맞물린 두 기어는 접점에서 같은 방향으로 움직이므로 서로 반대 방향으로 회전해요.'
  },
  {
    id: 't-belt', statement: '벨트와 풀리는 마찰력으로 동력을 전달하므로 미끄러질 수 있다.', answer: true, partId: 'beltPulley',
    explain: '벨트는 마찰로 전달해 조용하지만 미끄러질 수 있어요. 정확한 전달에는 체인이나 기어가 알맞습니다.'
  },
  {
    id: 't-chain', statement: '체인과 스프로킷은 맞물려 동력을 전달하므로 미끄러지지 않는다.', answer: true, partId: 'chain',
    explain: '체인의 마디가 스프로킷 이에 걸려 맞물리기 때문에 미끄러지지 않아요.'
  },
  {
    id: 't-spring', statement: '스프링은 부품을 결합하는 결합용 기계요소이다.', answer: false, partId: 'spring',
    explain: '스프링은 충격을 완화하는 제어용 기계요소예요.'
  },
  {
    id: 't-rack', statement: '래크와 피니언은 회전 운동과 직선 운동을 서로 바꿀 수 있다.', answer: true, partId: 'rackPinion',
    explain: '피니언이 돌면 래크가 직선으로 움직여요. 자동차 조향 장치에 쓰입니다.'
  },
  {
    id: 't-helical', statement: '헬리컬 기어는 평 기어보다 소음과 진동이 크다.', answer: false, partId: 'helicalGear',
    explain: '헬리컬 기어는 이가 경사져 부드럽게 맞물리므로 평 기어보다 소음과 진동이 적어요.'
  },
  {
    id: 't-taper', statement: '테이퍼 핀은 굵기가 처음부터 끝까지 일정하다.', answer: false, partId: 'pinTaper',
    explain: '굵기가 일정한 것은 평행 핀이고, 테이퍼 핀은 끝으로 갈수록 가늘어져요.'
  },
  {
    id: 't-friction', statement: '마찰차는 회전하는 도중에도 연결하거나 분리할 수 있다.', answer: true, partId: 'frictionWheel',
    explain: '마찰력으로 전달하기 때문에 회전 중에도 접촉시키거나 떼어 낼 수 있어요.'
  },
  {
    id: 't-bevel', statement: '베벨 기어는 평행한 두 축 사이에 동력을 전달할 때 쓴다.', answer: false, partId: 'bevelGear',
    explain: '베벨 기어는 직각으로 만나는 두 축 사이에 쓰여요. 평행한 두 축에는 평 기어나 헬리컬 기어를 씁니다.'
  },
  {
    id: 't-brake', statement: '브레이크는 동력을 전달하는 전동용 기계요소이다.', answer: false, partId: 'blockBrake',
    explain: '브레이크는 마찰로 운동을 멈추게 하는 제어용 기계요소예요.'
  },
  {
    id: 't-bolt', statement: '볼트와 너트는 한 번 결합하면 분리할 수 없다.', answer: false, partId: 'bolt',
    explain: '나사는 돌려서 풀 수 있어 결합과 분리를 다시 할 수 있어요.'
  },
  {
    id: 't-cam', statement: '캠은 회전 운동을 왕복 운동으로 바꿀 수 있다.', answer: true, partId: 'cam',
    explain: '캠이 회전하면 닿아 있는 부분이 오르내리며 왕복 운동을 해요.'
  },
  {
    id: 't-worm', statement: '웜과 웜 기어는 큰 감속비를 얻기에 알맞다.', answer: true, partId: 'wormGear',
    explain: '웜이 여러 바퀴 돌아야 웜 기어가 한 바퀴 돌아서 속도가 크게 줄어요.'
  },
  {
    id: 't-bearing', statement: '베어링은 회전하는 축의 마찰을 줄이는 역할을 한다.', answer: true, partId: 'bearing',
    explain: '볼 베어링은 구슬이 구르며 마찰을 줄여 매끄럽게 회전하게 해요.'
  }
];
