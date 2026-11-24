// 물레방아 화면 문구·표 — 순수 TS. 용어는 지시서 3절, 사실은 0-1 표의 것만.
// 모형으로 정한 치수·결정은 "모형"이라고 밝힌다. 참고 글의 문장은 복제하지 않는다.
import type { PartKey, StageId, ViewKey } from './types';

export interface StageInfo {
  id: StageId;
  title: string;
  body: string[];
  view: ViewKey;
  focus: PartKey[];
  slow: boolean;
}

export const STAGES: StageInfo[] = [
  {
    id: 1, title: '물이 흘러온다',
    body: [
      '높은 곳의 물이 물홈을 따라 흘러와 물레바퀴 위로 떨어져요.',
      '높은 곳에 있는 물은 위치 에너지를 가지고 있어요. 수문(모형 부품)을 열면 물이 흘러요.',
    ],
    view: 'all', focus: ['chute', 'gate'], slow: false,
  },
  {
    id: 2, title: '물의 무게가 바퀴를 돌린다',
    body: [
      '날개 사이 칸에 물이 담기면 바퀴의 한쪽만 무거워져서 바퀴가 돌아요.',
      '물의 위치 에너지가 바퀴의 운동 에너지로 바뀌는 거예요.',
    ],
    view: 'wheel', focus: ['wheel', 'blade'], slow: false,
  },
  {
    id: 3, title: '굴통이 함께 돈다',
    body: [
      '바퀴 가운데를 꿴 굴통이 바퀴와 같이 돌면서 힘을 방앗간 안으로 전해요.',
      '기계요소로 보면 굴통은 축이고, 받침 기둥의 홈은 도는 축을 받치는 베어링과 같은 역할을 해요.',
    ],
    view: 'all', focus: ['shaft', 'post'], slow: false,
  },
  {
    id: 4, title: '누름대가 방아채를 누른다',
    body: [
      '누름대가 내려오면서 방아채 꼬리를 누르면, 볼씨를 받침점으로 반대쪽 방아공이가 올라가요.',
      '누름대는 캠이고 방아채는 지레예요. 천천히 보기로 누르는 순간을 살펴보세요.',
    ],
    view: 'cam', focus: ['arm1', 'arm2', 'beam1', 'beam2', 'pivot1', 'pivot2'], slow: true,
  },
  {
    id: 5, title: '공이가 떨어져 찧는다',
    body: [
      '누름대가 꼬리 끝을 벗어나면 방아공이가 제 무게로 떨어져 확돌 속 곡식을 내리찧어요.',
      '바퀴의 회전 운동이 위아래로 움직이는 왕복 운동으로 바뀌었어요.',
    ],
    view: 'pestle', focus: ['pestle1', 'pestle2', 'bowl1', 'bowl2'], slow: true,
  },
];

export const PART_INFO: Record<PartKey, { name: string; desc: string }> = {
  chute: { name: '물홈', desc: '물을 바퀴 위까지 끌어오는 나무 홈통이에요.' },
  gate: { name: '수문', desc: '물홈을 여닫는 판이에요. 자료에 없는 모형 부품이고, 물이 흐르고 멈추게 하려고 넣었어요.' },
  wheel: { name: '물레바퀴', desc: '물을 받아 도는 큰 바퀴예요. 이 모형은 지름 3.30 m, 폭 1.00 m예요.' },
  blade: { name: '날개', desc: '바퀴 둘레에 물을 받는 판이에요. 날개 사이 칸에 물이 담겨요. 이 모형은 32개예요.' },
  shaft: { name: '굴통(굴대)', desc: '바퀴 가운데를 꿰어 함께 도는 굵은 축이에요. 기계요소로 보면 전동축과 같은 역할이에요.' },
  post: { name: '받침 기둥', desc: '굴통을 받치는 기둥이에요(모형 부품). 위쪽 홈이 도는 굴통을 받쳐서 베어링과 같은 역할을 해요.' },
  arm1: { name: '누름대(발)', desc: '굴통에 꿰어 방아채 꼬리를 눌러 주는 막대예요. 회전 운동을 왕복 운동으로 바꾸는 캠 역할이에요.' },
  arm2: { name: '누름대(발)', desc: '두 번째 방아채를 누르는 누름대예요. 첫째와 90° 어긋나게 꿰어서 두 방아가 번갈아 찧어요(모형 결정).' },
  beam1: { name: '방아채', desc: '한쪽 끝에 방아공이가 달린 긴 나무예요. 볼씨를 받침점으로 시소처럼 움직이는 지레예요.' },
  beam2: { name: '방아채', desc: '두 번째 방아채예요. 첫째와 같은 모양이에요.' },
  pivot1: { name: '볼씨(받침점)', desc: '방아채를 받쳐 시소처럼 움직이게 하는 받침이에요. 지레의 받침점이에요.' },
  pivot2: { name: '볼씨(받침점)', desc: '두 번째 방아채를 받치는 볼씨예요.' },
  pestle1: { name: '방아공이', desc: '확 속의 곡식을 내리찧는 몽둥이예요. 지레의 작용점이에요.' },
  pestle2: { name: '방아공이', desc: '두 번째 방아채 끝의 방아공이예요.' },
  bowl1: { name: '확돌', desc: '곡식을 담는 돌 그릇이에요. 방아공이가 이 안으로 떨어져요.' },
  bowl2: { name: '확돌', desc: '두 번째 방아공이 아래의 확돌이에요.' },
};

export interface InfoRow { head: string; body: string; extra?: string }
export interface InfoCard { title: string; intro?: string; rows: InfoRow[]; note?: string }

/** 기계요소로 보면 */
export const ELEMENT_CARD: InfoCard = {
  title: '기계요소로 보면',
  rows: [
    { head: '굴통(굴대)', body: '바퀴와 함께 돌며 힘을 전하는 축', extra: '전동축' },
    { head: '받침 기둥의 홈', body: '도는 축을 받쳐 주는 곳. 베어링과 같은 역할이에요(구슬 없이 나무 홈이 직접 받쳐요).', extra: '볼 베어링' },
    { head: '누름대(발)', body: '회전 운동을 왕복 운동으로 바꾸는 캠', extra: '캠' },
    { head: '방아채 + 볼씨', body: '캠을 따라 움직이는 부분(캠 폴로어)이자 지레예요. 받침점이 볼씨예요.', extra: '캠, 링크' },
  ],
  note: '마지막 칸은 이 앱에서 관련 있는 부품이에요.',
};

/** 자료에 나온 값 — 0-1 표의 치수·날개·물·빠르기 행 */
export const SOURCE_CARD: InfoCard = {
  title: '자료에 나온 값',
  intro: '참고 글에 적힌 값이에요. 이 실험의 다른 치수(굴통 굵기, 누름대, 방아채, 공이 무게, 확돌 등)는 자료에 없어서 모형으로 정했어요.',
  rows: [
    { head: '물레바퀴 크기', body: '지름 220~489 cm, 폭 75~115 cm' },
    { head: '표준형', body: '지름 330 cm, 폭 100 cm (이 모형의 바퀴 크기)' },
    { head: '날개', body: '날개 32개, 각도 25°, 길이 400 mm일 때 효율이 가장 높다고 분석했어요.' },
    { head: '낙차', body: '물레바퀴까지 10~30 cm' },
    { head: '물의 양', body: '표준형은 1초에 320 L' },
    { head: '빠르기', body: '1분에 18~25회 회전' },
    { head: '힘', body: '8~10마력' },
    { head: '찧는 시간', body: '벼 한 가마니를 찧는 데 25~40분' },
  ],
};

/** 출처 표기 — 기관 이름은 페이지 머리말(국가유산진흥원)·바닥글에서 확인(2026-11) */
export const SOURCE_CITE = "참고: 국가유산진흥원 누리집(kh.or.kr) 게시 글 「현대 동력 장치의 뿌리이자 친환경적인 에너지원 '방아'」(윤용현, 2014.6.) — https://kh.or.kr/brd/board/741/L/menu/740?brdType=R&bbIdx=101334"

/** 이 실험의 약속 */
export const PROMISE_CARD: InfoCard = {
  title: '이 실험의 약속',
  intro: '실제 물레방아를 쉽게 풀어 모형으로 만들었어요.',
  rows: [
    { head: '모형의 구성', body: '방아채 2개, 한 방아채에 누름대 끝 2개(한 바퀴에 공이 하나가 2번 찧어요)는 그림을 보고 정한 모형이에요. 실제 방아는 곳마다 다를 수 있어요.' },
    { head: '누르는 방식', body: '누름대가 방아채를 누르는 동안의 힘은 천천히 눌러 올리는 것으로 계산했어요. 닿는 순간의 충격과 미끄럼 마찰은 무시했어요.' },
    { head: '물과 바퀴', body: '물의 양에 따른 바퀴 빠르기는 모형 계산이에요. 물이 튀고 새는 손실과 곡식을 찧는 저항은 한 숫자로 묶었고, 표준 물의 양 320 L/s에서 자료 범위(18~25회/분)의 가운데인 21.5회/분이 나오게 맞췄어요. 실제로 잰 값이 아니에요.' },
    { head: '일률', body: '이 모형에서는 물이 내놓는 일의 일부만 공이를 들어 올리는 데 쓰여요. 나머지는 마찰과 물 튐으로 사라져요.' },
  ],
};

/** 더 알아보기 */
export const MORE_CARD: InfoCard = {
  title: '더 알아보기',
  rows: [
    { head: '다른 이름', body: '누름대를 방아눌림목이라고도 해요.' },
    { head: '지레의 원리', body: '디딜방아에서는 힘을 주는 곳(힘점)이 다리, 받침점이 볼씨, 일하는 곳(작용점)이 공이예요. 물레방아에서는 누름대가 꼬리를 눌러 힘을 줘요.' },
    { head: '물의 양과 높이', body: '물이 많아지면 바퀴가 빨라져서 더 자주 찧어요. 하지만 공이가 올라가는 높이는 그대로예요. 높이는 누름대 길이와 방아채 모양이 정하기 때문이에요.' },
    { head: '찧는 힘', body: '공이가 높이 올라갔다 떨어질수록 확에 닿는 힘이 커져요. 위치 에너지가 운동 에너지로 바뀌는 거예요.' },
  ],
};

/** 확인 문제(권장) */
export interface QuizItem { q: string; choices: string[]; answer: number; why: string }
export const QUIZ: QuizItem[] = [
  {
    q: '물의 양을 늘리면 공이가 올라가는 높이는 어떻게 될까요?',
    choices: ['더 높아진다', '그대로다', '더 낮아진다'],
    answer: 1,
    why: '높이는 누름대 길이와 방아채 모양이 정해요. 물이 많아지면 바퀴가 빨라져서 찧는 횟수가 늘어나요.',
  },
  {
    q: '누름대는 어떤 기계요소의 역할을 할까요?',
    choices: ['축', '캠', '베어링'],
    answer: 1,
    why: '누름대는 회전 운동을 방아채의 왕복 운동으로 바꾸는 캠 역할을 해요.',
  },
];

/** 짧은 안내 문구 */
export const HAND_BLOCK_MSG = '누름대가 방아채 밑에 걸려요. 물이 돌리는 방향으로만 돌려요';
export const MODEL_NOTE = '모형 계산이에요. 실제 물레방아의 값이 아니에요.';
export const POWER_NOTE = '이 모형에서는 물이 내놓는 일의 일부만 공이를 들어 올리는 데 쓰여요. 나머지는 마찰과 물 튐으로 사라져요.';
