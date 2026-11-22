// 13-A 엔진의 작동 원리 — 행정 설명·비교 카드·확인 문제·가스 색 (화면 문구는 모두 여기)

export type EngineKind = 'four' | 'two';

export interface StrokeDef {
  short: string;
  title: string;
  body: string;
  note: string;
}

export const STROKES: Record<EngineKind, StrokeDef[]> = {
  four: [
    {
      short: '흡입',
      title: '① 흡입 행정',
      body: '피스톤이 내려가면서 실린더 안 공간이 넓어져요. 흡기 밸브가 열려 있어 공기와 연료가 섞인 혼합기가 실린더 안으로 빨려 들어와요.',
      note: '배기 밸브는 닫혀 있어요. 크랭크축은 반 바퀴(180°) 돌아요.'
    },
    {
      short: '압축',
      title: '② 압축 행정',
      body: '두 밸브가 모두 닫히고 피스톤이 올라가며 혼합기를 좁은 공간으로 꽉 눌러 압축해요. 압축된 혼합기는 온도와 압력이 높아져 잘 타요.',
      note: '실린더 안 가스의 부피가 점점 줄어드는 것을 보세요.'
    },
    {
      short: '폭발',
      title: '③ 폭발(팽창) 행정',
      body: '피스톤이 맨 위(상사점) 근처에 오면 점화 플러그가 불꽃을 튀겨 혼합기가 순식간에 타요. 뜨거운 가스가 팽창하며 피스톤을 세게 밀어 내리고, 이 힘이 크랭크축을 돌려요.',
      note: '네 행정 중 힘을 만드는 행정은 이것 하나뿐이에요. 나머지 행정은 무거운 플라이휠이 돌던 힘(관성)으로 이어 가요.'
    },
    {
      short: '배기',
      title: '④ 배기 행정',
      body: '배기 밸브가 열리고 피스톤이 올라가며 타고 남은 가스를 배기관으로 밀어내요. 배기가 끝나면 다시 흡입 행정이 시작돼요.',
      note: '흡입부터 배기까지 크랭크축이 2회전(720°)하는 동안 폭발은 1번이에요.'
    }
  ],
  two: [
    {
      short: '압축·흡입',
      title: '① 압축·흡입 (피스톤 상승)',
      body: '피스톤이 올라가며 소기 포트와 배기 포트를 막고, 위쪽에서는 혼합기를 압축해요. 동시에 피스톤 아래 크랭크실은 넓어져 압력이 낮아지고, 흡기 포트가 열리면 새 혼합기가 크랭크실로 빨려 들어와요.',
      note: '피스톤의 위쪽(압축)과 아래쪽(흡입)이 한꺼번에 일해요.'
    },
    {
      short: '폭발·배기·소기',
      title: '② 폭발·배기·소기 (피스톤 하강)',
      body: '상사점 근처에서 점화된 가스가 팽창하며 피스톤을 밀어 내려요. 피스톤이 내려가면 먼저 배기 포트가 열려 탄 가스가 빠져나가고, 이어서 소기 포트가 열려 크랭크실에서 눌려 있던 새 혼합기가 실린더로 들어오며 남은 가스를 밀어내요.',
      note: '새 혼합기가 탄 가스를 밀어내는 것을 "소기"라고 해요.'
    }
  ]
};

export const ENGINE_NAME: Record<EngineKind, string> = { four: '4행정 기관', two: '2행정 기관' };

export const KEY_LINE: Record<EngineKind, { strong: string; rest: string }> = {
  four: { strong: '크랭크축 2회전에 1번 폭발', rest: '피스톤이 4번 움직이는 동안(흡입·압축·폭발·배기) 폭발은 한 번이에요.' },
  two: { strong: '크랭크축 1회전에 1번 폭발', rest: '피스톤이 한 번 오르내릴 때마다 폭발해요. 밸브 대신 피스톤이 포트(구멍)를 여닫아요.' }
};

export const TIMING_NOTE = '실제 엔진은 밸브가 조금 일찍 열리고 조금 늦게 닫혀서, 행정이 바뀌는 순간에는 밸브가 살짝 열려 있을 수 있어요.';

export const DEAD_POINT_NOTE = '상사점: 피스톤이 가장 높이 올라간 곳 · 하사점: 가장 낮게 내려간 곳';

export const COMPARE_ROWS: { label: string; four: string; two: string }[] = [
  { label: '여닫는 장치', four: '흡기·배기 밸브와 캠축', two: '밸브 없이 피스톤이 포트를 여닫음' },
  { label: '폭발 횟수', four: '크랭크축 2회전에 1번', two: '크랭크축 1회전에 1번' },
  { label: '좋은 점', four: '연비와 배기가스 면에서 유리', two: '구조가 간단하고 가벼움, 같은 크기에서 힘이 셈' },
  { label: '아쉬운 점', four: '구조가 복잡함', two: '연료·윤활유 소모와 배기가스가 많음' },
  { label: '쓰임', four: '자동차에 널리 쓰임', two: '소형 오토바이·예초기·모형 엔진 등에 쓰였음' }
];

export interface OrderQ {
  kind: 'order';
  q: string;
  items: string[]; // 정답 순서
  shuffled: number[]; // 화면에 보일 순서(items의 인덱스)
  explain: string;
}

export interface ChoiceQ {
  kind: 'choice';
  q: string;
  choices: string[];
  answer: number;
  explain: string;
}

export type QuizQ = OrderQ | ChoiceQ;

export const QUIZ: QuizQ[] = [
  {
    kind: 'order',
    q: '4행정 기관의 네 행정을 일어나는 순서대로 눌러 보세요.',
    items: ['흡입', '압축', '폭발(팽창)', '배기'],
    shuffled: [2, 0, 3, 1],
    explain: '혼합기를 빨아들이고(흡입) → 눌러서(압축) → 태워 피스톤을 밀고(폭발) → 탄 가스를 내보내요(배기).'
  },
  {
    kind: 'order',
    q: '2행정 기관에서 피스톤이 내려갈 때 일어나는 일을 순서대로 눌러 보세요.',
    items: ['폭발한 가스가 피스톤을 밀어 내림', '배기 포트가 열려 탄 가스가 빠져나감', '소기 포트가 열려 새 혼합기가 실린더로 들어옴'],
    shuffled: [1, 2, 0],
    explain: '배기 포트가 소기 포트보다 높이 있어서, 내려가는 피스톤이 배기 포트를 먼저 열어요.'
  },
  {
    kind: 'choice',
    q: '크랭크축이 2회전하는 동안 폭발이 1번 일어나는 엔진은 어느 것일까요?',
    choices: ['4행정 기관', '2행정 기관', '둘 다'],
    answer: 0,
    explain: '4행정 기관은 2회전에 1번, 2행정 기관은 1회전에 1번 폭발해요.'
  }
];

/** 가스 색 (3D·범례 공통) */
export const GAS = {
  mix: 0x3d9bff,
  comp: 0x1d4fd8,
  fire: 0xffa526,
  hot: 0xff5a1a,
  burnt: 0x8a9098
} as const;

export const LEGEND: { color: number; text: string }[] = [
  { color: GAS.mix, text: '혼합기(공기+연료)' },
  { color: GAS.comp, text: '압축된 혼합기' },
  { color: GAS.fire, text: '폭발(연소)' },
  { color: GAS.burnt, text: '배기가스' }
];
