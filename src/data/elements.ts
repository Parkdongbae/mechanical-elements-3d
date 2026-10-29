// 기계요소 대분류 / 소분류 데이터
// 2022 개정 미래엔 기술·가정② 5단원 교과서 기준: 대분류 4가지(결합용/축용/제어용/전동용)

export type CategoryId = 'joining' | 'shaft' | 'control' | 'power';

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

export const CATEGORIES: Category[] = [
  { id: 'joining', name: '결합용', icon: '🔩', color: '#e67e22', desc: '부품을 결합하거나 고정하는 요소' },
  { id: 'shaft', name: '축용', icon: '⚙️', color: '#2980b9', desc: '회전체의 중심을 고정하거나 받쳐 주는 요소' },
  { id: 'control', name: '제어용', icon: '🛑', color: '#8e44ad', desc: '완충하거나 제동하여 운동을 제어하는 요소' },
  { id: 'power', name: '전동용', icon: '🔄', color: '#c0392b', desc: '동력이나 운동을 전달하는 요소' }
];

export type BuilderId =
  | 'bolt' | 'pinParallel' | 'pinTaper' | 'pinSplit'
  | 'axle' | 'driveShaft' | 'crankShaft' | 'bearing'
  | 'spring' | 'blockBrake' | 'discBrake'
  | 'frictionWheel' | 'spurGear' | 'helicalGear' | 'bevelGear' | 'wormGear' | 'rackPinion'
  | 'beltPulley' | 'sprocket' | 'chain' | 'cam' | 'link';

export interface PartDef {
  id: string;
  name: string;
  builder: BuilderId;
  category: CategoryId;
  role: string;
}

export const PARTS: PartDef[] = [
  // ── 결합용 ──
  { id: 'bolt', name: '나사(볼트와 너트)', builder: 'bolt', category: 'joining', role: '수나사(볼트)와 암나사(너트)가 맞물려 두 부품을 결합합니다. 자전거 왼쪽 페달에는 빠지지 않도록 왼나사가 쓰여요.' },
  { id: 'pinParallel', name: '평행 핀', builder: 'pinParallel', category: 'joining', role: '굵기가 일정한 핀입니다. 자전거 체인의 연결 부분에 쓰여 접촉면이 미끄러지지 않게 해요.' },
  { id: 'pinTaper', name: '테이퍼 핀', builder: 'pinTaper', category: 'joining', role: '끝으로 갈수록 가늘어지는 핀입니다. 자전거 페달과 크랭크를 연결할 때 쓰여요.' },
  { id: 'pinSplit', name: '분할 핀', builder: 'pinSplit', category: 'joining', role: '끝이 두 갈래로 갈라진 핀입니다. 너트가 풀리지 않도록 끝을 벌려 고정해요.' },
  // ── 축용 ──
  { id: 'axle', name: '차축', builder: 'axle', category: 'shaft', role: '몸체에 고정되어 바퀴 같은 회전체만 회전하게 하는 축입니다. 자전거 바퀴의 축이 차축이에요.' },
  { id: 'driveShaft', name: '전동축', builder: 'driveShaft', category: 'shaft', role: '회전체에 고정되어 함께 회전하며 동력을 전달하는 축입니다.' },
  { id: 'crankShaft', name: '크랭크축', builder: 'crankShaft', category: 'shaft', role: '회전 운동과 왕복 운동을 서로 바꾸어 주는 축입니다. 자전거 페달을 밟는 크랭크축이 대표적이에요.' },
  { id: 'bearing', name: '볼 베어링', builder: 'bearing', category: 'shaft', role: '구슬(볼)이 굴러가며 마찰을 줄여 매끄럽게 회전하게 하는 구름 베어링입니다.' },
  // ── 제어용 ──
  { id: 'spring', name: '스프링', builder: 'spring', category: 'control', role: '눌렀다가 놓으면 원래 모양으로 돌아오는 성질로 충격을 완화합니다. 시계를 돌리는 태엽도 스프링이에요!' },
  { id: 'blockBrake', name: '블록 브레이크', builder: 'blockBrake', category: 'control', role: '브레이크 블록을 바퀴 테에 눌러 마찰력으로 멈추게 합니다. 자전거의 림 브레이크예요.' },
  { id: 'discBrake', name: '디스크 브레이크', builder: 'discBrake', category: 'control', role: '회전하는 디스크를 패드로 집어 눌러 멈추게 하는 제동 장치입니다.' },
  // ── 전동용 ──
  { id: 'frictionWheel', name: '마찰차', builder: 'frictionWheel', category: 'power', role: '접촉면의 마찰력으로 회전을 전달하며, 회전 중에도 연결하고 분리할 수 있어요.' },
  { id: 'spurGear', name: '평 기어', builder: 'spurGear', category: 'power', role: '가깝고 평행한 두 축 사이에 정확하게 동력을 전달하는 기어입니다. 시계와 선반에 쓰여요.' },
  { id: 'helicalGear', name: '헬리컬 기어', builder: 'helicalGear', category: 'power', role: '이가 경사지게 맞물려 진동과 소음이 적은 기어입니다. 공작 기계와 자동차 엔진에 쓰여요.' },
  { id: 'bevelGear', name: '베벨 기어', builder: 'bevelGear', category: 'power', role: '직각으로 만나는 두 축 사이에 동력을 전달하는 기어입니다. 드릴에 쓰여요.' },
  { id: 'wormGear', name: '웜과 웜 기어', builder: 'wormGear', category: 'power', role: '큰 감속비가 필요할 때 쓰는 기어로, 두 축이 평행하지도 교차하지도 않습니다.' },
  { id: 'rackPinion', name: '래크와 피니언', builder: 'rackPinion', category: 'power', role: '회전 운동과 직선 운동을 서로 바꾸는 기어입니다. 자동차 조향 장치에 쓰여요!' },
  { id: 'beltPulley', name: '벨트와 풀리', builder: 'beltPulley', category: 'power', role: '두 축의 거리가 멀 때 마찰력으로 조용히 동력을 전달합니다. 재봉틀과 세탁기에 쓰여요.' },
  { id: 'sprocket', name: '스프로킷(톱니바퀴)', builder: 'sprocket', category: 'power', role: '체인의 이와 맞물려 미끄러지지 않고 정확하게 동력을 전달하는 톱니바퀴입니다.' },
  { id: 'chain', name: '체인', builder: 'chain', category: 'power', role: '스프로킷 이에 걸려 맞물려, 멀리 떨어진 두 축에 정확하게 동력을 전달합니다.' },
  { id: 'cam', name: '캠', builder: 'cam', category: 'power', role: '회전 운동을 왕복 운동으로 바꿉니다. 자동차 엔진과 장난감(오토마타)에 쓰여요.' },
  { id: 'link', name: '링크', builder: 'link', category: 'power', role: '여러 막대를 핀으로 연결해 회전 운동을 다른 운동으로 바꿉니다. 자동차 와이퍼가 대표적이에요.' }
];

export function getCategory(id: CategoryId): Category {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}

export function getPart(id: string): PartDef {
  const found = PARTS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown part: ${id}`);
  return found;
}
