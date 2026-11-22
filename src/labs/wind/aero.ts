// 풍동 실험의 "맛보기" 공기역학 모델 (작업 지시서 12)
// 부품별 Cd·Cl·소음 값은 실제 자동차의 측정값이 아니라 경향(오르내림·상대 크기)을 보여 주기 위한 학습용 값이다.
// 반면 힘·동력·한계 속도는 실제 공식(F = ½ρv²CdA, L = ½ρv²ClA, P = F·v, v_max = √(μ(g + L/m)r))으로 계산한다.

export const RHO = 1.2; // 공기 밀도 kg/m³
export const AREA = 2.2; // 정면 투영 면적 m² (상수)
export const MASS = 1500; // 차 질량 kg
export const G = 9.81; // 중력 가속도 m/s²
export const MU = 1.0; // 타이어–노면 마찰 계수
export const R_CORNER = 290; // 코너링 시험 코스 반지름 m
export const FRONT_SHARE = 0.55; // 정지 상태 앞축 하중 비율
/** 옆바람 시험 상수 */
export const GUST = 12; // 돌풍 세기 m/s
export const GUST_T = 1.1; // 운전자가 바로잡기까지 걸리는 시간 s
export const SIDE_AREA = 4.0; // 옆면 면적 m²
export const CY_BETA = 1.8; // 옆바람 각도(rad)당 옆힘 계수
export const CORNER_STIFF = 14; // 접지 하중 1N당 타이어 옆 버팀 강성(1/rad)
export const LANE_MARGIN = 0.82; // 차선 안에서 옆으로 움직일 수 있는 여유 m (차선 3.5m − 차폭 1.85m)/2

/** 매끈한 기본 차체(모든 부품을 가장 좋은 것으로 골랐을 때의 몸통) */
export const CD_BODY = 0.25;
export const CLF_BODY = 0.08;
export const CLR_BODY = 0.1;
/** 실내 바람 소리 기본값(100 km/h 기준 dB, 맛보기) */
export const NOISE_BASE_100 = 55;

export type ItemId = 'handle' | 'mirror' | 'pillar' | 'gap' | 'under' | 'wheel' | 'spoiler' | 'ride';
/** 소리 성분 — 오디오 채널과 1:1 */
export type SoundKind = 'mid' | 'whistle' | 'hiss' | 'rumble';

export interface Choice {
  label: string;
  /** 기본 차체 대비 Cd 증가분 */
  cd: number;
  /** 앞·뒤 양력 계수 증가분(+ 양력, − 다운포스) */
  clf: number;
  clr: number;
  /** 이 부품이 내는 소리(100 km/h, dB). 소리가 없으면 null */
  noise: number | null;
  tip: string;
}

export interface Item {
  id: ItemId;
  name: string;
  sound: SoundKind | null;
  soundName: string;
  choices: Choice[];
}

export const ITEMS: Item[] = [
  {
    id: 'handle',
    name: '도어 손잡이',
    sound: 'hiss',
    soundName: '쉿 하는 고음',
    choices: [
      { label: '돌출형', cd: 0.008, clf: 0, clr: 0, noise: 48, tip: '튀어나온 손잡이 뒤로 작은 소용돌이가 생겨요.' },
      { label: '매립형(히든)', cd: 0, clf: 0, clr: 0, noise: 36, tip: '차체 안에 숨어 있다가 필요할 때 나와요(전기차에서 많이 쓰는 방식).' }
    ]
  },
  {
    id: 'mirror',
    name: '사이드미러',
    sound: 'mid',
    soundName: '거친 바람 소리',
    choices: [
      { label: '큰 사각', cd: 0.022, clf: 0, clr: 0, noise: 58, tip: '네모난 면이 바람을 정면으로 막아 뒤에 큰 소용돌이가 생겨요.' },
      { label: '유선형', cd: 0.012, clf: 0, clr: 0, noise: 52, tip: '앞을 둥글게 다듬어 공기가 미끄러지듯 지나가요.' },
      { label: '카메라(소형)', cd: 0.004, clf: 0, clr: 0, noise: 44, tip: '거울 대신 작은 카메라와 실내 화면을 써요.' }
    ]
  },
  {
    id: 'pillar',
    name: 'A필러',
    sound: 'mid',
    soundName: '거친 바람 소리',
    choices: [
      { label: '각지고 세움', cd: 0.012, clf: 0, clr: 0, noise: 57, tip: '앞유리 옆 기둥이 각져 있으면 옆 유리를 따라 소용돌이가 생겨요.' },
      { label: '둥글고 눕힘', cd: 0, clf: 0, clr: 0, noise: 50, tip: '앞유리를 눕히고 모서리를 둥글게 하면 흐름이 붙어서 지나가요.' }
    ]
  },
  {
    id: 'gap',
    name: '도어 틈새',
    sound: 'whistle',
    soundName: '휘파람 소리',
    choices: [
      { label: '넓은 틈·단차', cd: 0.01, clf: 0, clr: 0, noise: 56, tip: '틈으로 공기가 드나들며 피리처럼 "휘이" 소리가 나요.' },
      { label: '좁은 틈+실링', cd: 0, clf: 0, clr: 0, noise: 40, tip: '틈을 좁히고 고무 실링으로 막아 공기가 새지 않아요.' }
    ]
  },
  {
    id: 'under',
    name: '하부 처리',
    sound: 'rumble',
    soundName: '웅웅거리는 저음',
    choices: [
      { label: '노출', cd: 0.03, clf: 0.05, clr: 0.05, noise: 54, tip: '배기관·서스펜션이 드러나 바닥 공기가 느려지고 차를 띄워요.' },
      { label: '평평한 언더커버', cd: 0.008, clf: 0, clr: 0, noise: 46, tip: '바닥을 판으로 덮어 공기가 매끈하게 빠져나가요.' },
      { label: '언더커버+디퓨저', cd: 0.005, clf: -0.03, clr: -0.15, noise: 46, tip: '뒤쪽을 위로 벌려 바닥 공기를 빨리 빼내면 차를 눌러 줘요.' }
    ]
  },
  {
    id: 'wheel',
    name: '휠',
    sound: 'rumble',
    soundName: '웅웅거리는 저음',
    choices: [
      { label: '열린 스포크', cd: 0.012, clf: 0, clr: 0, noise: 50, tip: '도는 바퀴 살이 공기를 휘저어요.' },
      { label: '에어로 커버', cd: 0, clf: 0, clr: 0, noise: 45, tip: '바퀴 면을 덮어 휘젓는 공기를 줄여요.' }
    ]
  },
  {
    id: 'spoiler',
    name: '뒤 스포일러',
    sound: 'mid',
    soundName: '거친 바람 소리',
    choices: [
      { label: '없음', cd: 0, clf: 0, clr: 0, noise: null, tip: '뒤쪽이 들뜨는 힘(양력)을 그대로 받아요.' },
      { label: '립 스포일러', cd: 0.002, clf: 0.01, clr: -0.1, noise: 40, tip: '트렁크 끝의 작은 턱이 흐름을 끊어 뒤를 조금 눌러 줘요.' },
      { label: '큰 윙', cd: 0.025, clf: 0.04, clr: -0.38, noise: 50, tip: '거꾸로 단 날개가 차를 세게 눌러요. 대신 저항이 늘어요.' }
    ]
  },
  {
    id: 'ride',
    name: '차고(바닥 높이)',
    sound: null,
    soundName: '',
    choices: [
      { label: '높음', cd: 0.01, clf: 0.04, clr: 0.04, noise: null, tip: '바닥으로 들어가는 공기가 많아져 저항과 양력이 늘어요.' },
      { label: '낮음', cd: 0, clf: -0.02, clr: -0.02, noise: null, tip: '바닥 공기가 줄고 빨라져 차가 덜 떠요.' }
    ]
  }
];

export type Config = Record<ItemId, number>;

export const PRESET_BASIC: Config = { handle: 0, mirror: 0, pillar: 0, gap: 0, under: 0, wheel: 0, spoiler: 0, ride: 0 };
export const PRESET_AERO: Config = { handle: 1, mirror: 2, pillar: 1, gap: 1, under: 2, wheel: 1, spoiler: 1, ride: 1 };

export function choiceOf(cfg: Config, id: ItemId): Choice {
  const item = ITEMS.find((i) => i.id === id);
  const c = item?.choices[cfg[id]] ?? item?.choices[0];
  if (!c) throw new Error(`unknown item ${id}`);
  return c;
}

export const kmhToMs = (kmh: number): number => kmh / 3.6;
/** 동압 q = ½ρv² (Pa) */
export const dynPressure = (kmh: number): number => 0.5 * RHO * kmhToMs(kmh) ** 2;

export interface AeroResult {
  cd: number;
  clf: number;
  clr: number;
  cl: number;
}

export function aero(cfg: Config): AeroResult {
  let cd = CD_BODY;
  let clf = CLF_BODY;
  let clr = CLR_BODY;
  for (const item of ITEMS) {
    const c = choiceOf(cfg, item.id);
    cd += c.cd;
    clf += c.clf;
    clr += c.clr;
  }
  return { cd, clf, clr, cl: clf + clr };
}

/** 항력 N */
export const dragN = (cd: number, kmh: number): number => dynPressure(kmh) * cd * AREA;
/** 공기 저항을 이기는 데 필요한 동력 kW */
export const powerKW = (cd: number, kmh: number): number => (dragN(cd, kmh) * kmhToMs(kmh)) / 1000;
/** 양력 N (+ 띄움, − 누름) */
export const liftN = (cl: number, kmh: number): number => dynPressure(kmh) * cl * AREA;

/** 차축 하중 N (무게 − 양력) */
export function axleLoads(a: AeroResult, kmh: number): { front: number; rear: number; total: number } {
  const w = MASS * G;
  const front = w * FRONT_SHARE - liftN(a.clf, kmh);
  const rear = w * (1 - FRONT_SHARE) - liftN(a.clr, kmh);
  return { front, rear, total: front + rear };
}

/** 타이어가 낼 수 있는 최대 옆 힘 N = μ × (무게 + 다운포스) */
export const maxLateralN = (cl: number, kmh: number): number => MU * (MASS * G - liftN(cl, kmh));

/**
 * 코너 한계 속도 v_max = √(μ·(g + L/m)·r). L(다운포스)이 속도에 따라 커지므로
 * v² = μ r (g + ρ·(−Cl)·A·v²/(2m)) 를 v²에 대해 풀어 v² = μgr / (1 + μ r ρ Cl A / (2m)).
 */
export function vmaxCornerKmh(cl: number, r = R_CORNER): number {
  const den = 1 + (MU * r * RHO * cl * AREA) / (2 * MASS);
  if (den <= 0.02) return 999;
  return Math.sqrt((MU * G * r) / den) * 3.6;
}

/** 필요한 구심 가속도와 낼 수 있는 최대 가속도(m/s²) */
export function cornerAccel(cl: number, kmh: number, r = R_CORNER): { need: number; max: number } {
  const v = kmhToMs(kmh);
  return { need: (v * v) / r, max: maxLateralN(cl, kmh) / MASS };
}

/** 옆바람 시험: 돌풍 옆힘, 타이어 미끄럼각, 옆으로 밀린 거리 */
export function crosswind(cl: number, clr: number, kmh: number): { side: number; normal: number; slip: number; drift: number; out: number; sway: number } {
  const v = Math.max(1, kmhToMs(kmh));
  const beta = Math.atan(GUST / v);
  const side = 0.5 * RHO * (v * v + GUST * GUST) * CY_BETA * beta * SIDE_AREA;
  const normal = Math.max(MASS * G * 0.2, MASS * G - liftN(cl, kmh));
  const slip = side / (CORNER_STIFF * normal);
  const drift = v * slip * GUST_T;
  // 뒤가 들뜨면(뒤 양력) 꼬리가 더 흔들린다 — 요 흔들림 크기(맛보기)
  const rearLoad = MASS * G * (1 - FRONT_SHARE) - liftN(clr, kmh);
  const sway = slip * ((MASS * G * (1 - FRONT_SHARE)) / Math.max(1000, rearLoad));
  return { side, normal, slip, drift, out: Math.max(0, drift - LANE_MARGIN), sway };
}

export interface NoisePart {
  id: ItemId | 'base';
  name: string;
  kind: SoundKind | 'base';
  db: number;
}

/** 소리 크기(dB, 맛보기): 바람 소리는 속도의 5제곱, 부품 소용돌이 소리는 6제곱에 비례한다고 본다 */
export function noiseParts(cfg: Config, kmh: number): NoisePart[] {
  const r = Math.max(kmh, 1) / 100;
  const out: NoisePart[] = [{ id: 'base', name: '기본 바람', kind: 'base', db: NOISE_BASE_100 + 50 * Math.log10(r) }];
  for (const item of ITEMS) {
    const c = choiceOf(cfg, item.id);
    if (c.noise === null || !item.sound) continue;
    out.push({ id: item.id, name: item.name, kind: item.sound, db: c.noise + 60 * Math.log10(r) });
  }
  return out;
}

export const sumDb = (dbs: number[]): number => 10 * Math.log10(dbs.reduce((s, d) => s + 10 ** (d / 10), 0));

export function noiseTotal(cfg: Config, kmh: number): number {
  if (kmh < 1) return 0;
  return sumDb(noiseParts(cfg, kmh).map((p) => p.db));
}

/** 소리 채널별 합(dB) — 오디오 그래프의 게인으로 쓴다 */
export function soundLevels(cfg: Config, kmh: number): Record<SoundKind | 'base', number> {
  const parts = noiseParts(cfg, kmh);
  const acc: Record<SoundKind | 'base', number[]> = { base: [], mid: [], whistle: [], hiss: [], rumble: [] };
  for (const p of parts) acc[p.kind].push(p.db);
  const lv = (k: SoundKind | 'base'): number => (acc[k].length ? sumDb(acc[k]) : -200);
  return { base: lv('base'), mid: lv('mid'), whistle: lv('whistle'), hiss: lv('hiss'), rumble: lv('rumble') };
}

/** 도어 틈새 휘파람 음높이: f ≈ St·v/d (St 0.2, 틈 1cm) → 약 20 × v(m/s) Hz */
export const whistleHz = (kmh: number): number => 20 * kmhToMs(Math.max(kmh, 20));

/** 각 부품이 가장 좋은 선택 대비 Cd를 얼마나 올렸는지 */
export function cdContrib(cfg: Config): { id: ItemId; name: string; delta: number; label: string }[] {
  return ITEMS.map((item) => {
    const c = choiceOf(cfg, item.id);
    const best = Math.min(...item.choices.map((x) => x.cd));
    return { id: item.id, name: item.name, delta: c.cd - best, label: c.label };
  });
}

/** 설계 목표 */
export const GOAL_CD = 0.3;
export const GOAL_DB = 63;
export const GOAL_DB_KMH = 120;
export const GOAL_CORNER_KMH = 200;
