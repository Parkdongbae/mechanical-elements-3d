// 링크 장치 10종 데이터 — 순수 TS. 좌표·길이는 기구 좌표(cm, 얀센만 '단위').
// 장식(decor)의 size 뜻: wheel=바퀴 반지름 / blade=고무날 두께 / tire=타이어 길이(차 앞뒤 방향) / slotBlock=블록 폭 / jawPad=패드 크기 / floor=바닥 선의 y 좌표.
// wheel·tire 는 a=중심 조인트, b=함께 도는 팔 끝 조인트(각도를 b 에서 읽음). tire 의 ang 는 중립 자세의 팔 각(rad).
import type { MechanismDef } from './types';
import { sweep } from './solver';

const R = Math.PI / 180;

// ───────────── 1. 크랭크-로커 ─────────────
const crankRocker: MechanismDef = {
  id: 'crank-rocker',
  name: '크랭크-로커',
  unit: 'cm',
  oneLine: '돌리면 흔들려요 — 자동차 와이퍼',
  how: [
    '한 바퀴 빙 도는 링크(크랭크)를 돌리면, 반대편 링크(로커, 흔들 링크)가 일정한 각도 안에서 왔다 갔다 해요.',
    '크랭크가 한 바퀴 돌면 로커는 한 번 왕복해요.',
    '로커 끝에 와이퍼 날을 달면 부채꼴 모양을 쓸어요.',
  ],
  uses: [
    '자동차 와이퍼: 모터의 회전이 와이퍼의 좌우 흔들림으로 바뀌어요. 이 앱의 와이퍼 미션에도 나와요.',
    '선풍기의 목 돌리기: 모터가 돌면 선풍기 머리가 좌우로 흔들려요. 이 앱의 선풍기 미션에도 나와요.',
    '발로 밟는 재봉틀의 발판: 반대로 발판이 흔들리면 바퀴가 돌아요.',
  ],
  watch: '크랭크가 한 바퀴 도는 동안 로커가 한쪽으로 가는 데와 돌아오는 데 걸리는 크랭크 각이 달라요(약 188°와 172°).',
  steps: [
    { k: 'fix', id: 'O2', at: [0, 0] },
    { k: 'fix', id: 'O4', at: [10, 0] },
    { k: 'crank', id: 'A', o: 'O2', r: 3 },
    { k: 'rr', id: 'B', a: 'A', ra: 9, b: 'O4', rb: 7, side: 1 },
    { k: 'rigid', id: 'W', a: 'O4', b: 'B', u: 11, v: 0 },
  ],
  input: { kind: 'rotate', q0: 60 * R },
  handle: 'A',
  bars: [
    { a: 'O2', b: 'O4', role: 'ground', layer: 0 },
    { a: 'O2', b: 'A', role: 'input', layer: 1 },
    { a: 'A', b: 'B', role: 'coupler', layer: 2 },
    { a: 'O4', b: 'W', role: 'output', layer: 3, via: ['B'] },
  ],
  decor: [{ kind: 'blade', a: 'B', b: 'W', size: 0.5 }],
  trace: [
    { id: 'W', label: '와이퍼 끝 W' },
    { id: 'B', label: '커플러 끝 B' },
  ],
};

// ───────────── 2. 평행 크랭크 ─────────────
const parallel: MechanismDef = {
  id: 'parallel',
  name: '평행 크랭크',
  unit: 'cm',
  oneLine: '두 바퀴가 똑같이 돌아요 — 기관차 연결봉',
  how: [
    '두 크랭크의 길이가 같고, 커플러(연결 링크)와 고정 링크의 길이도 같게 만든 장치예요.',
    '한쪽 크랭크를 돌리면 다른 쪽도 같은 방향으로 같은 각도만큼 돌아요.',
    '커플러는 항상 고정 링크와 나란한 채로 움직여요. 커플러 위의 모든 점이 같은 크기의 원을 그려요.',
  ],
  uses: [
    '증기 기관차의 바퀴를 잇는 연결봉: 한쪽 바퀴의 회전이 다른 쪽 바퀴로 전해져요. 이 앱의 증기 기관 실험에 나와요.',
    '평행을 유지해야 하는 장치: 제도기의 평행자, 공구함의 계단식 서랍 팔.',
  ],
  watch: '네 링크가 한 줄로 펴지는 순간(0°, 180°)에는 반대로 꺾일 수도 있어요. 실제 기관차는 좌우 바퀴의 크랭크를 90° 어긋나게 달아 이 순간을 넘어가요.',
  steps: [
    { k: 'fix', id: 'O2', at: [0, 0] },
    { k: 'fix', id: 'O4', at: [8, 0] },
    { k: 'crank', id: 'A', o: 'O2', r: 3 },
    { k: 'rr', id: 'B', a: 'A', ra: 8, b: 'O4', rb: 3, side: 1 },
    { k: 'rigid', id: 'M', a: 'A', b: 'B', u: 4, v: 0 },
  ],
  input: { kind: 'rotate', q0: 45 * R },
  handle: 'A',
  bars: [
    { a: 'O2', b: 'O4', role: 'ground', layer: 0 },
    { a: 'O2', b: 'A', role: 'input', layer: 1 },
    { a: 'A', b: 'B', role: 'coupler', layer: 2, via: ['M'] },
    { a: 'O4', b: 'B', role: 'output', layer: 1 },
  ],
  decor: [
    { kind: 'wheel', a: 'O2', b: 'A', size: 3.8 },
    { kind: 'wheel', a: 'O4', b: 'B', size: 3.8 },
  ],
  trace: [{ id: 'M', label: '연결봉 가운데 M' }],
};

// ───────────── 3. 조향 장치 (위에서 본 그림) ─────────────
const STEER_T0 = -Math.PI / 2 + Math.asin(0.8 / 3); // 왼쪽 팔 중립 각 −74.53°
const STEER_T0R = -Math.PI / 2 - Math.asin(0.8 / 3); // 오른쪽 팔 중립 각 −105.47°
const steering: MechanismDef = {
  id: 'steering',
  name: '조향 장치',
  unit: 'cm',
  oneLine: '핸들을 돌리면 앞바퀴가 꺾여요 — 위에서 본 그림',
  topView: true,
  how: [
    '두 바퀴를 꺾는 팔과, 두 팔 사이를 잇는 타이 로드(커플러)로 이루어진 사다리꼴 모양의 장치예요.',
    '한쪽 팔을 꺾으면 타이 로드가 밀고 당겨서 반대쪽 바퀴도 함께 꺾여요.',
    '두 팔은 길이가 같지만 두 바퀴가 꺾이는 각도는 서로 달라요.',
  ],
  uses: [
    '자동차의 조향 장치: 핸들을 돌리면 래크가 타이 로드를 밀고 양쪽 바퀴가 꺾여요. 이 앱의 자동차 핸들 미션에 나오는 링크예요.',
    '커브에서는 안쪽 바퀴가 더 많이 꺾여야 바퀴가 미끄러지지 않아요. 사다리꼴 링크가 그 차이를 만들어 줘요.',
  ],
  watch: '커브에서는 안쪽 바퀴가 바깥쪽 바퀴보다 더 많이 꺾여요. 숫자판에서 두 각의 차를 확인해 봐요.',
  steps: [
    { k: 'fix', id: 'O2', at: [0, 0] },
    { k: 'fix', id: 'O4', at: [10, 0] },
    { k: 'crank', id: 'A', o: 'O2', r: 3 },
    { k: 'rr', id: 'B', a: 'A', ra: 8.4, b: 'O4', rb: 3, side: -1 },
    { k: 'rigid', id: 'M', a: 'A', b: 'B', u: 4.2, v: 0 },
  ],
  input: { kind: 'swing', min: STEER_T0 - 30 * R, max: STEER_T0 + 30 * R, q0: STEER_T0 },
  handle: 'A',
  bars: [
    { a: 'O2', b: 'O4', role: 'ground', layer: 0 },
    { a: 'O2', b: 'A', role: 'input', layer: 1 },
    { a: 'A', b: 'B', role: 'coupler', layer: 2, via: ['M'] },
    { a: 'O4', b: 'B', role: 'output', layer: 1 },
  ],
  decor: [
    { kind: 'tire', a: 'O2', b: 'A', size: 4.4, ang: STEER_T0 },
    { kind: 'tire', a: 'O4', b: 'B', size: 4.4, ang: STEER_T0R },
  ],
  trace: [{ id: 'M', label: '타이 로드 가운데 M' }],
};

// ───────────── 4. 슬라이더-크랭크 ─────────────
const sliderCrank: MechanismDef = {
  id: 'slider-crank',
  name: '슬라이더-크랭크',
  unit: 'cm',
  oneLine: '회전과 직선 왕복을 서로 바꿔요 — 엔진의 피스톤',
  how: [
    '크랭크가 돌면 연결봉이 슬라이더(미끄럼 블록)를 곧은 길을 따라 밀고 당겨요.',
    '반대로 슬라이더를 밀면 크랭크가 돌아요.',
    '크랭크가 한 바퀴 돌 때 슬라이더가 가는 거리(행정)는 크랭크 길이의 2배예요.',
  ],
  uses: [
    '자동차 엔진: 피스톤의 왕복이 크랭크축의 회전이 돼요. 이 앱의 엔진의 작동 원리 실험에 나와요.',
    '왕복 펌프, 공기 압축기: 반대로 회전이 왕복이 돼요.',
    '재봉틀 바늘: 이 앱 재봉틀 미션의 크랭크축이 바늘을 오르내리게 해요.',
  ],
  watch: '크랭크가 0°·180°일 때는 피스톤을 밀어도 크랭크가 돌지 않아요(사점). 엔진은 무거운 플라이휠의 관성으로 넘어가요.',
  steps: [
    { k: 'fix', id: 'O2', at: [0, 0] },
    { k: 'crank', id: 'A', o: 'O2', r: 3 },
    { k: 'rp', id: 'C', a: 'A', r: 9, p: [0, 0], dir: [1, 0], side: 1 },
    { k: 'rigid', id: 'M', a: 'A', b: 'C', u: 4.5, v: 0 },
  ],
  input: { kind: 'rotate', q0: 60 * R },
  handle: 'A',
  bars: [
    { a: 'O2', b: 'A', role: 'input', layer: 1 },
    { a: 'A', b: 'C', role: 'coupler', layer: 2, via: ['M'] },
  ],
  rails: [{ at: 'C', p: [0, 0], dir: [1, 0], min: 5, max: 13, style: 'piston', layer: 3 }],
  trace: [
    { id: 'M', label: '연결봉 가운데 M' },
    { id: 'C', label: '피스톤 C' },
  ],
};

// ───────────── 5. 빠른 귀환 장치 ─────────────
const quickReturn: MechanismDef = {
  id: 'quick-return',
  name: '빠른 귀환 장치',
  unit: 'cm',
  oneLine: '갈 때는 천천히, 올 때는 빨리 — 셰이퍼',
  how: [
    '크랭크의 핀이 홈 파인 지렛대 속을 미끄러지며 지렛대를 좌우로 흔들어요.',
    '지렛대 끝에 이어진 램은 곧은 길을 따라 왔다 갔다 해요.',
    '크랭크는 같은 빠르기로 도는데 램은 갈 때와 올 때 걸리는 시간이 달라요.',
  ],
  uses: [
    '쇠를 깎는 공작 기계 셰이퍼(형삭기): 깎으며 나아갈 때는 천천히, 빈손으로 돌아올 때는 빨리 움직여 시간을 아껴요.',
  ],
  watch: '램이 천천히 가는 동안 크랭크는 240°, 빨리 돌아오는 동안은 120° 돌아요. 그래프의 색 띠를 봐요.',
  steps: [
    { k: 'fix', id: 'O2', at: [0, 0] },
    { k: 'fix', id: 'Oc', at: [0, 6] },
    { k: 'crank', id: 'A', o: 'Oc', r: 3 },
    { k: 'rigid', id: 'B', a: 'O2', b: 'A', u: 13, v: 0 },
    { k: 'rp', id: 'R', a: 'B', r: 2.5, p: [0, 12.5], dir: [1, 0], side: 1 },
  ],
  input: { kind: 'rotate', q0: 90 * R },
  handle: 'A',
  bars: [
    { a: 'O2', b: 'Oc', role: 'ground', layer: 0 },
    { a: 'Oc', b: 'A', role: 'input', layer: 1 },
    { a: 'O2', b: 'B', role: 'output', layer: 2, slot: true },
    { a: 'B', b: 'R', role: 'link', layer: 3 },
  ],
  rails: [{ at: 'R', p: [0, 12.5], dir: [1, 0], min: -6, max: 10.5, style: 'ram', layer: 4 }],
  decor: [{ kind: 'slotBlock', a: 'A', b: 'B', size: 0.5 }],
  trace: [
    { id: 'B', label: '지렛대 끝 B' },
    { id: 'R', label: '램 R' },
  ],
};

// ───────────── 6. 체비쇼프 직선 링크 ─────────────
const chebyshev: MechanismDef = {
  id: 'chebyshev',
  name: '체비쇼프 직선 링크',
  unit: 'cm',
  oneLine: '핀만으로 거의 곧은 선을 그려요',
  how: [
    '두 흔들 링크가 X자로 엇갈리고, 가운데 커플러 위의 한 점이 거의 곧은 선을 따라 움직여요.',
    '링크 길이의 비는 고정 링크 : 흔들 링크 : 커플러 = 4 : 5 : 2 예요.',
    '미끄럼 안내면 없이 핀 이음만으로 만든 장치예요.',
  ],
  uses: [
    '미끄럼 안내면 없이 핀 이음만으로 한 점을 거의 곧게 움직이게 하는 장치예요.',
    '증기 기관 시대에 피스톤 막대를 곧게 움직이게 하려던 문제(와트 링크와 같은 문제)에서 나왔어요. 19세기 러시아 수학자 체비쇼프가 연구한 것으로 알려져 있어요.',
  ],
  watch: '완전한 직선이 아니라 거의 직선이에요. 얼마나 벗어나는지 숫자로 확인해요.',
  steps: [
    { k: 'fix', id: 'O2', at: [0, 0] },
    { k: 'fix', id: 'O4', at: [4, 0] },
    { k: 'crank', id: 'A', o: 'O2', r: 5 },
    { k: 'rr', id: 'B', a: 'A', ra: 2, b: 'O4', rb: 5, side: -1 },
    { k: 'rigid', id: 'P', a: 'A', b: 'B', u: 1, v: 0 },
  ],
  input: { kind: 'swing', min: 40 * R, max: 100 * R, q0: 53.13010235415598 * R },
  handle: 'A',
  bars: [
    { a: 'O2', b: 'O4', role: 'ground', layer: 0 },
    { a: 'O2', b: 'A', role: 'input', layer: 1 },
    { a: 'A', b: 'B', role: 'coupler', layer: 2, via: ['P'] },
    { a: 'O4', b: 'B', role: 'output', layer: 3 },
  ],
  trace: [{ id: 'P', label: '커플러 가운데 P' }],
};

// ───────────── 7. 와트 직선 링크 ─────────────
const watt: MechanismDef = {
  id: 'watt',
  name: '와트 직선 링크',
  unit: 'cm',
  oneLine: '가운데 점이 거의 곧게 움직여요',
  how: [
    '길이가 같은 두 흔들 링크 사이를 짧은 커플러가 이어요.',
    '커플러 가운데 점은 8자 모양 곡선의 일부를 따라 움직이는데, 가운데 부분이 거의 곧아요.',
    '곡선의 양 끝으로 갈수록 휘어요.',
  ],
  uses: [
    '제임스 와트가 증기 기관의 피스톤 막대를 곧게 움직이게 하려고 쓴 링크예요. 이 앱의 증기 기관 실험에 나오는 와트 기관이에요.',
    '지금은 자동차 뒤 차축이 좌우로 흔들리지 않게 잡아 주는 서스펜션(와트 링크)에 쓰여요.',
  ],
  watch: '점선(x=6)과 자취를 비교해 봐요. 가운데는 곧지만 양 끝에서는 눈에 띄게 휘어요.',
  steps: [
    { k: 'fix', id: 'O2', at: [0, 0] },
    { k: 'fix', id: 'O4', at: [12, 3] },
    { k: 'crank', id: 'A', o: 'O2', r: 6 },
    { k: 'rr', id: 'B', a: 'A', ra: 3, b: 'O4', rb: 6, side: 1 },
    { k: 'rigid', id: 'P', a: 'A', b: 'B', u: 1.5, v: 0 },
  ],
  input: { kind: 'swing', min: -26 * R, max: 26 * R, q0: 0 },
  handle: 'A',
  bars: [
    { a: 'O2', b: 'O4', role: 'ground', layer: 0 },
    { a: 'O2', b: 'A', role: 'input', layer: 1 },
    { a: 'A', b: 'B', role: 'coupler', layer: 2, via: ['P'] },
    { a: 'O4', b: 'B', role: 'output', layer: 1 },
  ],
  trace: [{ id: 'P', label: '커플러 가운데 P' }],
};

// ───────────── 8. 팬터그래프 ─────────────
const circlePts = (cx: number, cy: number, r: number, n: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i * 2 * Math.PI) / n), cy + r * Math.sin((i * 2 * Math.PI) / n)]);
const pantograph: MechanismDef = {
  id: 'pantograph',
  name: '팬터그래프',
  unit: 'cm',
  oneLine: '따라 그리면 2배로 커져요',
  how: [
    '마름모 모양으로 이은 링크 장치예요. 추적점 P를 끌거나 정해진 도형을 따라가게 하면 펜 Q가 같은 모양을 2배로 그려요.',
    'O, P, Q는 항상 한 직선 위에 있고, Q까지의 거리는 P까지의 거리의 2배예요.',
    '입력 점이 둘레를 돌면 P는 작은 도형, Q는 큰 도형을 그려요.',
  ],
  uses: [
    '그림·지도·글자를 일정한 비율로 키우거나 줄여 옮겨 그리는 도구, 같은 원리의 조각기에 쓰여요.',
    '전철 지붕에서 전깃줄에 닿는 집전 장치도 모양이 닮아서 팬터그래프라고 불러요.',
  ],
  watch: '큰 도형이 작은 도형과 같은 모양이고 꼭 2배인지, 두 거리의 비가 2.00인지 숫자판에서 확인해요.',
  steps: [
    { k: 'fix', id: 'O', at: [0, 0] },
    { k: 'free', id: 'P' },
    { k: 'rr', id: 'A', a: 'O', ra: 4, b: 'P', rb: 4, side: 1 },
    { k: 'rigid', id: 'E', a: 'O', b: 'A', u: 8, v: 0 },
    { k: 'rr', id: 'D', a: 'E', ra: 4, b: 'P', rb: 4, side: 1 },
    { k: 'rigid', id: 'Q', a: 'E', b: 'D', u: 8, v: 0 },
  ],
  input: {
    kind: 'point',
    center: 'O',
    rMin: 2.5,
    rMax: 7.2,
    paths: [
      { name: '삼각형', pts: [[3, -2.5], [5, -2.5], [4, -4.5]] },
      { name: '사각형', pts: [[3, -2.5], [5, -2.5], [5, -4.5], [3, -4.5]] },
      { name: '원', pts: circlePts(4, -3.5, 1, 48) },
    ],
  },
  handle: 'P',
  bars: [
    { a: 'O', b: 'E', role: 'input', layer: 1, via: ['A'] },
    { a: 'E', b: 'Q', role: 'output', layer: 2, via: ['D'] },
    { a: 'A', b: 'P', role: 'coupler', layer: 2 },
    { a: 'D', b: 'P', role: 'coupler', layer: 1 },
  ],
  trace: [
    { id: 'P', label: '추적점 P(작은 도형)' },
    { id: 'Q', label: '펜 Q(큰 도형)' },
  ],
};

// ───────────── 9. 얀센의 걷는 다리 ─────────────
const JANSEN = { a: 38, b: 41.5, c: 39.3, d: 40.1, e: 55.8, f: 39.4, g: 36.7, h: 65.7, i: 49, j: 50, k: 61.9, l: 7.8, m: 15 };
const jansenBase: MechanismDef = {
  id: 'jansen',
  name: '얀센의 걷는 다리',
  unit: '단위',
  oneLine: '크랭크 하나로 걷는 다리',
  how: [
    '네덜란드 예술가 테오 얀센의 해변 동물(Strandbeest) 다리예요. 링크 길이는 얀센이 공개해 널리 알려진 수치(a~m)를 그대로 썼어요. 비율만 의미가 있어서 단위는 그냥 단위라고 써요.',
    '크랭크 하나만 돌려도 발끝이 땅을 밀고, 들어 올리고, 앞으로 내딛는 길을 그려요.',
    '삼각 링크 두 개는 모양이 변하지 않는 한 덩어리로 움직여요.',
  ],
  uses: [
    '바람의 힘으로 해변을 걷는 얀센의 움직이는 조형물에 쓰였어요.',
    '이를 본뜬 걷는 로봇과 장난감: 바퀴 대신 다리로 울퉁불퉁한 곳을 걷는 방법이에요.',
  ],
  watch: '발끝이 땅에 닿아 있는 구간과 발을 드는 높이를 숫자판에서 확인해 봐요.',
  steps: [
    { k: 'fix', id: 'O', at: [0, 0] },
    { k: 'fix', id: 'Oc', at: [JANSEN.a, JANSEN.l] },
    { k: 'crank', id: 'M', o: 'Oc', r: JANSEN.m },
    { k: 'rr', id: 'U', a: 'O', ra: JANSEN.b, b: 'M', rb: JANSEN.j, side: 1 },
    { k: 'rr', id: 'W', a: 'O', ra: JANSEN.c, b: 'M', rb: JANSEN.k, side: -1 },
    { k: 'rr', id: 'L', a: 'O', ra: JANSEN.d, b: 'U', rb: JANSEN.e, side: 1 },
    { k: 'rr', id: 'K', a: 'L', ra: JANSEN.f, b: 'W', rb: JANSEN.g, side: -1 },
    { k: 'rr', id: 'F', a: 'K', ra: JANSEN.h, b: 'W', rb: JANSEN.i, side: -1 },
  ],
  input: { kind: 'rotate', q0: 0 },
  handle: 'M',
  bars: [
    { a: 'O', b: 'Oc', role: 'ground', layer: 0 },
    { a: 'Oc', b: 'M', role: 'input', layer: 1 },
    { a: 'M', b: 'U', role: 'link', layer: 2 },
    { a: 'M', b: 'W', role: 'link', layer: 3 },
    { a: 'O', b: 'W', role: 'link', layer: 4 },
    { a: 'L', b: 'K', role: 'link', layer: 5 },
  ],
  plates: [
    { pts: ['O', 'U', 'L'], role: 'output', layer: 1 },
    { pts: ['K', 'W', 'F'], role: 'output', layer: 6 },
  ],
  trace: [{ id: 'F', label: '발끝 F' }],
};
// 바닥 선: 발끝이 한 바퀴 도는 동안 가장 낮은 높이
function jansenFloor(): number {
  const sw = sweep(jansenBase, 360);
  let y = Infinity;
  for (const p of sw.poses) {
    const f = p.pts['F'];
    if (f && f[1] < y) y = f[1];
  }
  return Number.isFinite(y) ? y : -84;
}
const jansen: MechanismDef = { ...jansenBase, decor: [{ kind: 'floor', a: 'F', size: jansenFloor() }] };

// ───────────── 10. 집게 ─────────────
const gripper: MechanismDef = {
  id: 'gripper',
  name: '집게',
  unit: 'cm',
  oneLine: '밀고 당기면 벌어지고 오므려져요',
  how: [
    '밀대를 곧은 길을 따라 밀고 당기면 두 팔이 마주 보고 돌면서 집게가 벌어지고 오므려져요.',
    '밀대 하나의 직선 운동이 두 팔의 회전으로 바뀌어요.',
    '슬라이더-크랭크를 거꾸로, 두 개를 마주 보게 쓴 것과 같아요.',
  ],
  uses: [
    '로봇 손(그리퍼): 밀대 하나로 물건을 잡고 놓아요.',
    '멀리 있는 물건을 집는 집게 장난감.',
  ],
  watch: '팔 끝은 팔이 이어진 곳보다 훨씬 크게 움직여요. 숫자판의 팔 길이 비를 확인해 봐요.',
  steps: [
    { k: 'push', id: 'C', from: [0, 0], dir: [1, 0] },
    { k: 'fix', id: 'F1', at: [4, 2.5] },
    { k: 'fix', id: 'F2', at: [4, -2.5] },
    { k: 'rr', id: 'J1', a: 'C', ra: 2.5, b: 'F1', rb: 1.5, side: -1 },
    { k: 'rr', id: 'J2', a: 'C', ra: 2.5, b: 'F2', rb: 1.5, side: 1 },
    { k: 'rigid', id: 'T1', a: 'F1', b: 'J1', u: 1.657, v: 5.293 },
    { k: 'rigid', id: 'T2', a: 'F2', b: 'J2', u: 1.657, v: -5.293 },
  ],
  input: { kind: 'slide', min: 1.5, max: 2.5, q0: 2.0 },
  handle: 'C',
  bars: [
    { a: 'C', b: 'J1', role: 'coupler', layer: 3 },
    { a: 'C', b: 'J2', role: 'coupler', layer: 1 },
  ],
  plates: [
    { pts: ['F1', 'J1', 'T1'], role: 'output', layer: 1 },
    { pts: ['F2', 'J2', 'T2'], role: 'output', layer: 2 },
  ],
  rails: [{ at: 'C', p: [0, 0], dir: [1, 0], min: 0.8, max: 3.2, style: 'block', layer: 4 }],
  decor: [
    { kind: 'jawPad', a: 'T1', size: 0.5 },
    { kind: 'jawPad', a: 'T2', size: 0.5 },
  ],
  trace: [
    { id: 'T1', label: '위쪽 집게 끝 T1' },
    { id: 'T2', label: '아래쪽 집게 끝 T2' },
  ],
};

// 직접 만들기(11번째)는 solver.ts 의 fourbar() 가 만든다.
export const MECHANISMS: MechanismDef[] = [crankRocker, parallel, steering, sliderCrank, quickReturn, chebyshev, watt, pantograph, jansen, gripper];

export function getMechanism(id: string): MechanismDef | undefined {
  return MECHANISMS.find((m) => m.id === id);
}

// 직접 만들기 프리셋 6개 [a, b, c, d]
export const CUSTOM_PRESETS: { name: string; dims: [number, number, number, number] }[] = [
  { name: '크랭크-로커', dims: [3, 9, 7, 10] },
  { name: '이중 크랭크', dims: [5, 6, 7, 3] },
  { name: '이중 로커', dims: [7, 3, 6, 8] },
  { name: '평행 크랭크', dims: [3, 8, 3, 8] },
  { name: '조건 불만족', dims: [5, 4, 6, 10] },
  { name: '조립 불가', dims: [2, 3, 3, 10] },
];
export const CUSTOM_DEFAULT = { a: 3, b: 9, c: 7, d: 10, u: 4.5, v: 3 };
