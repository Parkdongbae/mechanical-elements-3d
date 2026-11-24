// 증기 기관 실험의 단계 설명·이름표·카메라.
// 역사 사실은 지시서에 적힌, 널리 알려진 수준만 쓴다(1712년경 뉴커먼, 1769년 와트의 분리 응축기 특허,
// 19세기 초 증기 기관차 실용화 — 스티븐슨의 로켓호 1829년). 그 밖의 연도·수치는 쓰지 않는다.

export type MachineId = 'newcomen' | 'watt' | 'loco';

export interface View {
  t: [number, number, number];
  /** +Z(정면)에서 +X 쪽으로 돈 각(도) */
  az: number;
  el: number;
  d: number;
}

export interface TagDef {
  a: string;
  t: string;
  /** valves() 목록의 번호 — 이름표에 열림/닫힘을 함께 표시 */
  v?: number;
  below?: boolean;
}

export type Extra = 'timeline' | 'compare' | 'governor' | 'regulator' | 'puff';

export interface StageDef {
  short: string;
  title: string;
  body: string;
  point: string;
  note?: string;
  view: View;
  tags: TagDef[];
  extra?: Extra;
}

export interface MachineDef {
  id: MachineId;
  name: string;
  /** 어느 단계에서든 늘 붙는 부품 이름(우선순위 3). 단계 tags에 같은 기준점이 있으면 단계 것만 쓴다 */
  parts: TagDef[];
  stages: StageDef[];
}

export const LEGEND: { key: 'water' | 'steam' | 'fire' | 'cold' | 'air' | 'used'; label: string }[] = [
  { key: 'water', label: '물' },
  { key: 'steam', label: '증기' },
  { key: 'used', label: '쓴 증기' },
  { key: 'fire', label: '불·뜨거운 연기' },
  { key: 'cold', label: '찬물' },
  { key: 'air', label: '대기압' }
];

export const TIMELINE: { when: string; what: string; id: MachineId }[] = [
  { when: '1712년경', what: '뉴커먼 — 광산의 물을 퍼내는 대기압 기관', id: 'newcomen' },
  { when: '1769년', what: '와트 — 분리 응축기 특허', id: 'watt' },
  { when: '19세기 초', what: '증기 기관차 실용화 (스티븐슨의 로켓호, 1829년)', id: 'loco' }
];

export const COMPARE: { k: string; n: string; w: string }[] = [
  { k: '피스톤을 움직이는 힘', n: '대기압(위가 열린 실린더)', w: '증기의 압력(위아래가 막힌 실린더)' },
  { k: '증기를 식히는 곳', n: '실린더 안 — 찬물을 직접 뿌림', w: '따로 떨어진 응축기' },
  { k: '실린더 온도', n: '매번 식었다가 다시 데움', w: '늘 뜨거움' },
  { k: '힘을 내는 행정', n: '내려갈 때만', w: '올라갈 때도, 내려갈 때도(복동식)' },
  { k: '움직임', n: '왕복(펌프 막대를 오르내림)', w: '회전(플라이휠) — 공장 기계를 돌림' }
];

export const MACHINES: MachineDef[] = [
  {
    id: 'newcomen',
    name: '뉴커먼 기관',
    parts: [
      { a: 'boiler', t: '보일러' },
      { a: 'fire', t: '화로', below: true },
      { a: 'cylinder', t: '실린더' },
      { a: 'piston', t: '피스톤' },
      { a: 'beam', t: '흔들보(워킹 빔)' },
      { a: 'chain', t: '사슬' },
      { a: 'pumpRod', t: '펌프 막대' },
      { a: 'cistern', t: '찬물 통' },
      { a: 'steamValve', t: '증기 밸브', below: true },
      { a: 'injValve', t: '찬물 밸브' },
      { a: 'chimney', t: '굴뚝' }
    ],
    stages: [
      {
        short: '구조',
        title: '뉴커먼의 대기압 기관',
        body: '1712년경 영국에서 광산에 고인 물을 퍼내려고 만든 증기 기관이에요. 아래의 보일러에서 증기를 만들고, 위가 열린 실린더와 피스톤, 커다란 흔들보(워킹 빔), 반대편의 광산 펌프 막대가 함께 움직여요.',
        point: '증기의 힘이 아니라 대기압이 일을 해요.',
        view: { t: [-0.5, 2.35, 0], az: 26, el: 12, d: 11 },
        tags: [
          { a: 'boiler', t: '보일러' },
          { a: 'fire', t: '화로', below: true },
          { a: 'cylinder', t: '실린더(위가 열림)' },
          { a: 'beam', t: '흔들보(워킹 빔)' },
          { a: 'pumpRod', t: '펌프 막대' },
          { a: 'shaft', t: '광산(갱도)으로', below: true },
          { a: 'cistern', t: '찬물 통' }
        ],
        extra: 'timeline'
      },
      {
        short: '증기 넣기',
        title: '① 증기가 실린더를 채워요',
        body: '증기 밸브가 열려 보일러의 증기가 실린더로 들어가요. 이 증기는 압력이 대기압과 비슷해서 피스톤을 세게 밀지 못해요. 대신 반대쪽의 무거운 펌프 막대가 내려가며 흔들보를 기울여 피스톤을 끌어올려요.',
        point: '피스톤을 올리는 것은 펌프 쪽의 무게예요.',
        view: { t: [-0.5, 2.2, 0], az: 22, el: 10, d: 10.4 },
        tags: [
          { a: 'steamValve', t: '증기 밸브', v: 0, below: true },
          { a: 'steamIn', t: '증기' },
          { a: 'pumpRod', t: '펌프 막대가 내려가요' },
          { a: 'chain', t: '사슬(원호에 감김)' }
        ]
      },
      {
        short: '밸브 닫기',
        title: '② 증기 밸브를 닫아요',
        body: '피스톤이 꼭대기에 오르면 증기 밸브를 닫아요. 실린더 안은 뜨거운 증기로 가득 차 있어요.',
        point: '이제 실린더 안의 증기를 없앨 차례예요.',
        view: { t: [-1.65, 2.05, 0], az: 24, el: 12, d: 6.2 },
        tags: [
          { a: 'steamValve', t: '증기 밸브', v: 0, below: true },
          { a: 'steamIn', t: '증기로 가득' },
          { a: 'injValve', t: '찬물 밸브', v: 1 }
        ]
      },
      {
        short: '찬물 분사',
        title: '③ 찬물을 뿜어 증기를 식혀요',
        body: '찬물 밸브를 열면 찬물 통의 물이 실린더 안으로 뿜어져 나와요. 증기가 식어 물(응축수)로 바뀌면 부피가 아주 작아져서, 실린더 안은 진공에 가까워져요.',
        point: '증기 → 물: 부피가 크게 줄어 압력이 낮아져요.',
        view: { t: [-1.75, 2.1, 0], az: 18, el: 14, d: 6.2 },
        tags: [
          { a: 'injValve', t: '찬물 밸브', v: 1 },
          { a: 'nozzle', t: '찬물 분사', below: true },
          { a: 'steamValve', t: '증기 밸브', v: 0, below: true }
        ]
      },
      {
        short: '대기압',
        title: '④ 대기압이 피스톤을 눌러요',
        body: '실린더 위는 뚫려 있어서 공기가 피스톤을 누르고 있어요(대기압). 아래는 진공에 가까우니 피스톤이 힘차게 내려가요. 흔들보가 기울며 반대쪽 펌프 막대를 끌어올려 광산의 물을 퍼 올려요.',
        point: '일을 하는 것은 대기압이에요.',
        view: { t: [-0.5, 2.2, 0], az: 22, el: 10, d: 10.4 },
        tags: [
          { a: 'air', t: '대기압이 눌러요' },
          { a: 'vacuum', t: '진공에 가까움', below: true },
          { a: 'pumpRod', t: '펌프 막대가 올라가요' },
          { a: 'spout', t: '퍼 올린 물', below: true }
        ]
      },
      {
        short: '반복',
        title: '⑤ 다시 처음부터',
        body: '응축수를 빼내고 다시 증기 밸브를 열면 ①부터 되풀이해요. 그런데 찬물로 식힌 실린더를 다음 증기가 다시 데워야 해서, 들어간 증기의 많은 부분이 일을 하지 못하고 실린더를 데우는 데 쓰였어요.',
        point: '실린더를 매번 식혔다 데워서 연료(석탄) 낭비가 컸어요.',
        note: '그래도 광산의 물을 퍼내는 데 오랫동안 널리 쓰였어요. 이 낭비를 줄인 사람이 제임스 와트예요.',
        view: { t: [-0.5, 2.35, 0], az: 30, el: 13, d: 11 },
        tags: [
          { a: 'steamValve', t: '증기 밸브', v: 0, below: true },
          { a: 'injValve', t: '찬물 밸브', v: 1 },
          { a: 'cylinder', t: '식었다 데웠다 하는 실린더' }
        ]
      }
    ]
  },
  {
    id: 'watt',
    name: '와트 기관',
    parts: [
      { a: 'boiler', t: '보일러' },
      { a: 'cylinder', t: '실린더' },
      { a: 'piston', t: '피스톤' },
      { a: 'crosshead', t: '크로스헤드' },
      { a: 'beam', t: '흔들보' },
      { a: 'conrod', t: '연결봉(커넥팅 로드)' },
      { a: 'crank', t: '크랭크' },
      { a: 'flywheel', t: '플라이휠' },
      { a: 'governor', t: '원심 조속기' },
      { a: 'throttle', t: '조절 밸브' },
      { a: 'condenser', t: '분리 응축기' },
      { a: 'airpump', t: '공기 펌프' },
      { a: 'steamMain', t: '증기관' }
    ],
    stages: [
      {
        short: '구조',
        title: '와트의 증기 기관',
        body: '제임스 와트는 뉴커먼 기관의 연료 낭비를 줄이려고, 증기를 실린더와 떨어진 찬 통(분리 응축기)에서 식히는 방법을 생각해 냈어요(1769년 특허). 그 뒤 피스톤 양쪽에 번갈아 증기를 넣는 복동식, 회전 운동을 만드는 장치, 원심 조속기 같은 개량이 더해졌어요. 이 모형은 그런 개량이 들어간 회전식 와트 기관이에요.',
        point: '실린더는 늘 뜨겁게, 응축기는 늘 차갑게!',
        view: { t: [0.2, 1.75, -0.35], az: 20, el: 15, d: 11.5 },
        tags: [
          { a: 'boiler', t: '보일러' },
          { a: 'cylinder', t: '실린더(늘 뜨거움)' },
          { a: 'condenser', t: '분리 응축기', below: true },
          { a: 'beam', t: '흔들보' },
          { a: 'flywheel', t: '플라이휠', below: true },
          { a: 'governor', t: '원심 조속기' }
        ],
        extra: 'timeline'
      },
      {
        short: '증기가 밀기',
        title: '① 증기가 피스톤을 밀어 내려요',
        body: '위쪽 증기 밸브가 열려 보일러의 증기가 피스톤 위로 들어가요. 뉴커먼 기관과 달리 실린더 위가 막혀 있어서 증기의 압력이 피스톤을 직접 밀어 내려요. 이때 피스톤 아래쪽은 응축기와 이어져 있어 압력이 낮아요.',
        point: '증기가 밀고, 반대쪽은 진공에 가까워 더 잘 움직여요.',
        view: { t: [-1.75, 1.2, 0], az: 20, el: 10, d: 6.2 },
        tags: [
          { a: 'v0', t: '위 증기', v: 0 },
          { a: 'v3', t: '아래 배기', v: 3, below: true },
          { a: 'top', t: '증기가 밀어요' },
          { a: 'jacket', t: '증기로 감싼 벽 — 늘 뜨거움', below: true }
        ]
      },
      {
        short: '응축기',
        title: '② 쓴 증기는 응축기에서 식어요',
        body: '피스톤 아래에 있던 쓴 증기는 아래쪽 배기 밸브를 지나 찬물 통 속의 응축기로 빠져나가고, 그곳에서 찬물에 식어 물이 돼요. 공기 펌프는 생긴 물과 공기를 퍼내 응축기를 진공에 가깝게 유지해요. 실린더는 식지 않고 뜨거운 채로 있어요.',
        point: '증기를 식히는 곳(응축기)과 일하는 곳(실린더)을 나눴어요.',
        view: { t: [-1.2, 0.9, 0.1], az: 12, el: 20, d: 6.6 },
        tags: [
          { a: 'v3', t: '아래 배기', v: 3 },
          { a: 'exhaust', t: '배기관', below: true },
          { a: 'condenser', t: '응축기(찬물 속)' },
          { a: 'airpump', t: '공기 펌프', below: true }
        ]
      },
      {
        short: '반대쪽 증기',
        title: '③ 반대쪽에 증기 — 피스톤이 올라가요',
        body: '이번에는 아래쪽 증기 밸브와 위쪽 배기 밸브가 열려요. 증기가 피스톤 아래로 들어가 밀어 올리고, 위쪽의 쓴 증기는 응축기로 빠져나가요. 피스톤 양쪽에 번갈아 증기를 넣으니(복동식) 올라갈 때도 내려갈 때도 일을 해요.',
        point: '복동식: 왕복 모두 힘을 내요.',
        view: { t: [-1.75, 1.2, 0], az: 20, el: 10, d: 6.2 },
        tags: [
          { a: 'v2', t: '아래 증기', v: 2, below: true },
          { a: 'v1', t: '위 배기', v: 1 },
          { a: 'bot', t: '증기가 밀어요', below: true }
        ]
      },
      {
        short: '회전 운동',
        title: '④ 흔들보 → 연결봉 → 플라이휠',
        body: '피스톤의 왕복 운동은 흔들보를 시소처럼 흔들고, 반대쪽 연결봉(커넥팅 로드)이 크랭크를 돌려 큰 플라이휠을 돌려요. 무거운 플라이휠은 회전을 고르게 해 줘요. 이렇게 회전 운동을 얻자 증기 기관으로 공장의 여러 기계를 돌릴 수 있게 되었어요.',
        point: '왕복 운동 → 회전 운동',
        note: '실제 와트 기관에는 크랭크 대신 유성 기어(선 앤드 플래닛) 장치를 쓴 것도 있어요.',
        view: { t: [0.25, 1.95, 0], az: 16, el: 10, d: 10.5 },
        tags: [
          { a: 'crosshead', t: '크로스헤드(곧게 안내)' },
          { a: 'beam', t: '흔들보' },
          { a: 'conrod', t: '연결봉' },
          { a: 'crank', t: '크랭크', below: true },
          { a: 'flywheel', t: '플라이휠', below: true }
        ]
      },
      {
        short: '조속기',
        title: '⑤ 원심 조속기가 속도를 일정하게',
        body: '플라이휠과 벨트로 이어진 조속기가 돌면 두 쇠공이 원심력으로 벌어져요. 너무 빨라지면 공이 더 벌어지고, 올라간 슬리브가 지렛대로 조절 밸브를 조금 닫아 증기를 줄여요. 느려지면 반대로 밸브를 열어요.',
        point: '스스로 속도를 맞추는 자동 제어 장치예요.',
        view: { t: [2.2, 2.7, -1.0], az: 28, el: 12, d: 4.2 },
        tags: [
          { a: 'governor', t: '쇠공(원심력)' },
          { a: 'throttle', t: '조절 밸브', v: 4, below: true }
        ],
        extra: 'governor'
      },
      {
        short: '비교',
        title: '뉴커먼 기관과 비교해요',
        body: '같은 일을 할 때 와트 기관은 석탄이 훨씬 적게 들었어요. 실린더를 식히지 않으니 증기가 실린더를 다시 데우는 데 낭비되지 않기 때문이에요.',
        point: '실린더를 식히지 않아 연료가 크게 절약되고, 회전 운동으로 공장 기계를 돌릴 수 있게 됐어요.',
        view: { t: [0.2, 1.75, -0.35], az: 34, el: 16, d: 11.5 },
        tags: [
          { a: 'cylinder', t: '늘 뜨거운 실린더' },
          { a: 'condenser', t: '늘 차가운 응축기', below: true }
        ],
        extra: 'compare'
      }
    ]
  },
  {
    id: 'loco',
    name: '증기 기관차',
    parts: [
      { a: 'firebox', t: '화실' },
      { a: 'tubes', t: '보일러(연관)' },
      { a: 'dome', t: '증기 돔' },
      { a: 'chimney', t: '굴뚝' },
      { a: 'smokebox', t: '연기실' },
      { a: 'cylinder', t: '실린더' },
      { a: 'piston', t: '피스톤' },
      { a: 'chest', t: '슬라이드 밸브' },
      { a: 'crosshead', t: '크로스헤드' },
      { a: 'conrod', t: '커넥팅 로드' },
      { a: 'coupling', t: '커플링 로드' },
      { a: 'driver', t: '동륜' },
      { a: 'valveGear', t: '편심봉(밸브 장치)' },
      { a: 'cab', t: '운전실' },
      { a: 'rails', t: '레일' }
    ],
    stages: [
      {
        short: '구조',
        title: '증기 기관차',
        body: '와트 이후 더 높은 압력의 증기를 쓰게 되면서, 기관을 바퀴 위에 올린 증기 기관차가 19세기 초에 실용화되었어요. 화실과 보일러에서 만든 고압 증기로 실린더의 피스톤을 움직이고, 그 힘으로 바퀴를 직접 돌려요.',
        point: '고압 증기를 피스톤 양쪽에 번갈아 넣어 바퀴를 직접 돌려요.',
        view: { t: [-0.15, 1.15, 0], az: 26, el: 13, d: 11.5 },
        tags: [
          { a: 'firebox', t: '화실' },
          { a: 'tubes', t: '보일러(연관)' },
          { a: 'dome', t: '증기 돔' },
          { a: 'chimney', t: '굴뚝' },
          { a: 'cylinder', t: '실린더', below: true },
          { a: 'driver', t: '동륜', below: true },
          { a: 'cab', t: '운전실' }
        ],
        extra: 'timeline'
      },
      {
        short: '화실·보일러',
        title: '① 화실과 보일러',
        body: '화실에서 석탄이 타면 뜨거운 연기가 보일러 속 가는 관(연관) 여러 개를 지나 앞쪽 연기실로 가요. 관 둘레의 물이 데워져 끓고, 위쪽에 증기가 모여요. 관이 많을수록 물에 닿는 면이 넓어져 증기가 빨리 생겨요.',
        point: '불은 관 속으로, 물은 관 바깥에.',
        view: { t: [0.1, 1.3, 0], az: 10, el: 10, d: 7.6 },
        tags: [
          { a: 'firebox', t: '화실(불)' },
          { a: 'tubes', t: '연관 — 뜨거운 연기', below: true },
          { a: 'water', t: '물', below: true },
          { a: 'steamSpace', t: '증기' },
          { a: 'smokebox', t: '연기실', below: true }
        ]
      },
      {
        short: '조절 밸브',
        title: '② 증기 돔과 조절 밸브',
        body: '증기는 보일러 꼭대기의 증기 돔에 모여요. 기관사가 조절 밸브(가감 밸브)를 열수록 많은 증기가 증기관을 지나 실린더로 가서 기관차가 빨라져요. 오른쪽(아래) 슬라이더로 직접 조절해 보세요.',
        point: '조절 밸브 = 기관차의 가속 페달',
        view: { t: [0.8, 1.3, 0.2], az: 22, el: 14, d: 6.4 },
        tags: [
          { a: 'regulator', t: '조절 밸브', v: 0 },
          { a: 'steamPipe', t: '증기관', below: true },
          { a: 'chest', t: '증기 상자', below: true }
        ],
        extra: 'regulator'
      },
      {
        short: '앞쪽 증기',
        title: '③ 앞쪽에 증기 → 피스톤이 뒤로',
        body: '실린더 위의 슬라이드 밸브가 움직여 앞쪽 통로를 열면, 고압 증기가 피스톤 앞쪽으로 들어가 피스톤을 뒤로 밀어요. 동시에 피스톤 뒤쪽의 쓴 증기는 밸브 아래 가운데 통로로 빠져나가 굴뚝으로 가요.',
        point: '슬라이드 밸브는 바퀴와 함께 움직여 알맞은 때에 통로를 바꿔요.',
        view: { t: [1.65, 0.8, 0.6], az: 22, el: 12, d: 3.7 },
        tags: [
          { a: 'chest', t: '슬라이드 밸브' },
          { a: 'frontPort', t: '앞쪽 통로', v: 1 },
          { a: 'rearPort', t: '뒤쪽 통로', v: 2 },
          { a: 'piston', t: '피스톤', below: true }
        ]
      },
      {
        short: '뒤쪽 증기',
        title: '④ 뒤쪽에 증기 → 피스톤이 앞으로',
        body: '바퀴가 반 바퀴 돌면 슬라이드 밸브가 반대로 움직여 뒤쪽 통로가 열려요. 이번에는 증기가 피스톤 뒤쪽을 밀어 앞으로 보내고, 앞쪽의 쓴 증기가 빠져나가요. 피스톤 양쪽에 번갈아 증기를 넣는 복동식이에요.',
        point: '피스톤 한 번 왕복 = 동륜 한 바퀴',
        view: { t: [1.65, 0.8, 0.6], az: 22, el: 12, d: 3.7 },
        tags: [
          { a: 'chest', t: '슬라이드 밸브' },
          { a: 'frontPort', t: '앞쪽 통로', v: 1 },
          { a: 'rearPort', t: '뒤쪽 통로', v: 2, below: true },
          { a: 'piston', t: '피스톤', below: true }
        ]
      },
      {
        short: '로드·동륜',
        title: '⑤ 크로스헤드 → 커넥팅 로드 → 동륜',
        body: '피스톤 막대 끝의 크로스헤드는 미끄럼 막대를 따라 곧게 왕복하고, 커넥팅 로드가 동륜(구동 바퀴)의 크랭크 핀을 돌려요. 커플링 로드는 동륜끼리 이어 함께 돌게 해요. 양쪽 실린더는 크랭크가 90° 어긋나 있어 어느 위치에서든 출발할 수 있어요.',
        point: '왕복 운동 → 바퀴의 회전 운동',
        note: '바퀴 옆의 편심봉이 슬라이드 밸브를 움직여요. 실제 기관차에는 앞뒤 방향과 증기량을 바꾸는 더 복잡한 밸브 장치가 있어요.',
        view: { t: [0.35, 0.75, 0.5], az: 14, el: 8, d: 6.8 },
        tags: [
          { a: 'crosshead', t: '크로스헤드', below: true },
          { a: 'conrod', t: '커넥팅 로드' },
          { a: 'coupling', t: '커플링 로드', below: true },
          { a: 'driver', t: '동륜', below: true },
          { a: 'valveGear', t: '편심봉(밸브 장치)' }
        ]
      },
      {
        short: '배기·굴뚝',
        title: '⑥ 배기 증기와 굴뚝 — 칙칙폭폭',
        body: '일을 마친 증기는 연기실 아래의 송풍관에서 굴뚝으로 힘차게 뿜어져요. 이때 연기실의 연기를 함께 끌고 나가므로 화실로 공기가 세게 빨려 들어가 불이 더 잘 타요. 동륜이 한 바퀴 돌 때 증기를 4번 뿜어 "칙칙폭폭" 소리가 나요.',
        point: '빨리 달릴수록 배기가 세져 불도 세져요.',
        view: { t: [1.3, 1.5, 0.2], az: 36, el: 12, d: 6.2 },
        tags: [
          { a: 'blast', t: '송풍관' },
          { a: 'chimney', t: '굴뚝' },
          { a: 'smokebox', t: '연기실', below: true }
        ],
        extra: 'puff'
      }
    ]
  }
];
