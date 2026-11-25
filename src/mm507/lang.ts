// 「507 기계 운동」 화면 언어(한/영) — 화면 문구 사전 + 3D 이름표·수치 사전(src/mm507/i18n/en.json) 불러오기.
// en.json 형식: { tags: {한글: 영어}, notes: {한글 label: 영어}, phrases: {한글 구: 영어} }
// 파일이 아직 없거나 비어 있어도 빈 사전으로 동작한다(import.meta.glob 은 파일이 없으면 빈 객체).

import type { MovementNote } from './types';

export type MmLang = 'ko' | 'en';

export interface ModelDict {
  tags: Record<string, string>;
  notes: Record<string, string>;
  phrases: Record<string, string>;
  /** phrases 키를 긴 것부터 */
  phraseKeys: string[];
}

const EMPTY: ModelDict = { tags: {}, notes: {}, phrases: {}, phraseKeys: [] };

const loaders = import.meta.glob<unknown>('./i18n/en.json', { import: 'default' });

function strMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === 'string' && x.length > 0) out[k] = x;
  }
  return out;
}

let dictPromise: Promise<ModelDict> | null = null;

/** 영어 사전 — 없거나 깨지면 빈 사전 */
export function loadEnDict(): Promise<ModelDict> {
  if (dictPromise) return dictPromise;
  const load = loaders['./i18n/en.json'];
  if (!load) {
    dictPromise = Promise.resolve(EMPTY);
    return dictPromise;
  }
  dictPromise = load()
    .then((data) => {
      const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
      // phrases: 빈 번역(strMap 이 거름)과 한 글자 조각('개'·'가' 등)은 치환하면 글이 깨지므로 뺀다
      const phrases = strMap(d.phrases);
      for (const k of Object.keys(phrases)) if (k.trim().length < 2) delete phrases[k];
      return {
        tags: strMap(d.tags),
        notes: strMap(d.notes),
        phrases,
        phraseKeys: Object.keys(phrases).sort((a, b) => b.length - a.length)
      };
    })
    .catch(() => EMPTY);
  return dictPromise;
}

/** 수치 패널 한 줄 번역: label 은 notes 사전, value 는 phrases 를 긴 것부터 치환 */
export function translateNote(nt: MovementNote, d: ModelDict): MovementNote {
  const label = d.notes[nt.label] ?? d.phrases[nt.label] ?? nt.label;
  return { label, value: translateValue(nt.value, d) };
}

// ───────── 화면 문구 ─────────

export interface UiText {
  appTitle: string;
  sub: (total: number, seen: number) => string;
  about: string;
  all: string;
  only3d: string;
  jump: string;
  jumpAria: string;
  rangeAria: string;
  loadingList: string;
  listFail: string;
  emptyRange: string;
  figAlt: (n: number, title: string) => string;
  figCap: string;
  zoomAlt: (n: number) => string;
  zoomCap: string;
  thumbAlt: (n: number) => string;
  fold: string;
  unfold: string;
  toList: string;
  toListAria: string;
  toListTitle: string;
  tabsAria: string;
  tabEasy: string;
  tabKo: string;
  tabEn: string;
  loadingDesc: string;
  prev: string;
  next: string;
  prevN: (n: number) => string;
  nextN: (n: number) => string;
  ext: string;
  numLabel: (n: number) => string;
  untitled: (n: number) => string;
  wait3d: string;
  play: string;
  pause: string;
  speed: string;
  speedAria: string;
  reverse: string;
  resetView: string;
  labels: string;
  labelsOn: string;
  labelsOff: string;
  arrows: string;
  arrowsOn: string;
  arrowsOff: string;
  notesTitle: string;
  loading: string;
  langTitle: string;
  cats: Record<string, string>;
}

const KO: UiText = {
  appTitle: '507 기계 운동',
  sub: (total, seen) => `1868년 책의 판화 ${total}가지 — 본 것 ${seen} / ${total}`,
  about: '책 소개',
  all: '전체',
  only3d: '3D 있는 것만',
  jump: '번호로 가기',
  jumpAria: '운동 번호로 바로 가기',
  rangeAria: '번호 구간',
  loadingList: '목록을 불러오는 중…',
  listFail: '목록을 불러올 수 없어요. 새로고침해 보세요.',
  emptyRange: '이 구간에서 조건에 맞는 운동이 없어요.',
  figAlt: (n, title) => `${n}번 판화 — ${title}`,
  figCap: '원본 판화 — 눌러서 크게',
  zoomAlt: (n) => `${n}번 원본 판화 큰 그림`,
  zoomCap: '닫으려면 눌러요',
  thumbAlt: (n) => `${n}번 판화 작은 그림`,
  fold: '접기',
  unfold: '펼치기',
  toList: ' 목록',
  toListAria: '507 기계 운동 목록으로',
  toListTitle: '507 기계 운동 첫 화면(목록)으로',
  tabsAria: '설명 보기',
  tabEasy: '쉬운 풀이',
  tabKo: '책의 설명(번역)',
  tabEn: '영어 원문',
  loadingDesc: '설명을 불러오는 중…',
  prev: '‹ 이전',
  next: '다음 ›',
  prevN: (n) => `‹ ${n}번`,
  nextN: (n) => `${n}번 ›`,
  ext: '507movements.com에서 이 운동 보기',
  numLabel: (n) => `${n}번`,
  untitled: (n) => `${n}번 운동`,
  wait3d: '3D 모형 준비 중',
  play: '재생',
  pause: '정지',
  speed: '속도',
  speedAria: '재생 속도(0~3배)',
  reverse: '역회전',
  resetView: '시점 처음으로',
  labels: '이름표',
  labelsOn: '부품 이름표 숨기기',
  labelsOff: '부품 이름표 보이기',
  arrows: '화살표',
  arrowsOn: '움직임 화살표 숨기기',
  arrowsOff: '움직임 화살표 보이기',
  notesTitle: '움직임 수치',
  loading: '불러오는 중…',
  langTitle: 'Switch to English',
  cats: {
    belt: '벨트·풀리',
    gear: '기어',
    ratchet: '래칫',
    cam: '캠',
    crank: '크랭크·링크',
    escapement: '탈진기',
    governor: '조속기',
    steam: '증기',
    pump: '펌프',
    tool: '공구·기타'
  }
};

const EN: UiText = {
  appTitle: '507 Mechanical Movements',
  sub: (total, seen) => `${total} engravings from the 1868 book — viewed ${seen} / ${total}`,
  about: 'About the book',
  all: 'All',
  only3d: '3D only',
  jump: 'Go to number',
  jumpAria: 'Jump to a movement number',
  rangeAria: 'Number range',
  loadingList: 'Loading the list…',
  listFail: 'Could not load the list. Try refreshing.',
  emptyRange: 'No movements match in this range.',
  figAlt: (n, title) => `Engraving ${n} — ${title}`,
  figCap: 'Original engraving — click to enlarge',
  zoomAlt: (n) => `Original engraving ${n}, enlarged`,
  zoomCap: 'Click to close',
  thumbAlt: (n) => `Engraving ${n}, thumbnail`,
  fold: 'Collapse',
  unfold: 'Expand',
  toList: ' List',
  toListAria: 'Back to the 507 movements list',
  toListTitle: 'Back to the 507 movements list',
  tabsAria: 'Description',
  tabEasy: 'Easy explanation',
  tabKo: 'Korean translation',
  tabEn: 'Original text',
  loadingDesc: 'Loading the description…',
  prev: '‹ Previous',
  next: 'Next ›',
  prevN: (n) => `‹ #${n}`,
  nextN: (n) => `#${n} ›`,
  ext: 'See this movement on 507movements.com',
  numLabel: (n) => `#${n}`,
  untitled: (n) => `#${String(n).padStart(3, '0')}`,
  wait3d: '3D model in progress',
  play: 'Play',
  pause: 'Pause',
  speed: 'Speed',
  speedAria: 'Playback speed (0–3×)',
  reverse: 'Reverse',
  resetView: 'Reset view',
  labels: 'Labels',
  labelsOn: 'Hide part labels',
  labelsOff: 'Show part labels',
  arrows: 'Arrows',
  arrowsOn: 'Hide motion arrows',
  arrowsOff: 'Show motion arrows',
  notesTitle: 'Motion values',
  loading: 'Loading…',
  langTitle: '한국어로 보기',
  cats: {
    belt: 'Belts & pulleys',
    gear: 'Gears',
    ratchet: 'Ratchets',
    cam: 'Cams',
    crank: 'Cranks & links',
    escapement: 'Escapements',
    governor: 'Governors',
    steam: 'Steam',
    pump: 'Pumps',
    tool: 'Tools & misc'
  }
};

export function uiText(lang: MmLang): UiText {
  return lang === 'en' ? EN : KO;
}

const HANGUL = /[ㄱ-힣]/;

/**
 * 수치 값 번역 — phrases 를 긴 것부터 치환(앞뒤에 빈칸을 두어 낱말이 붙지 않게).
 * 치환 뒤에도 한글이 남으면 섞인 글이 더 읽기 어려우므로 원래 한글 값을 그대로 쓴다.
 */
export function translateValue(value: string, d: ModelDict): string {
  if (!HANGUL.test(value)) return value;
  let v = value;
  for (const k of d.phraseKeys) {
    if (v.includes(k)) v = v.split(k).join(` ${d.phrases[k] ?? k} `);
  }
  if (HANGUL.test(v)) return value;
  return v
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;)%·])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}
