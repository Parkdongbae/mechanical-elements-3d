// 「507 기계 운동」 화면 언어(한·영·일·중·힌디·아랍) — 화면 문구 사전 + 3D 이름표·수치 사전(src/mm507/i18n/<언어>.json) 불러오기.
// <언어>.json 형식: { tags: {한글: 번역}, notes: {한글 label: 번역}, phrases: {한글 구: 번역},
//                    titles?: {번호: 제목}, easy?: {번호: 쉬운 풀이} }  — titles·easy 는 ja·zh·hi·ar 만(ko·en 은 catalog.json 에 있다)
// 파일이 아직 없거나 비어 있어도 빈 사전으로 동작한다(import.meta.glob 은 파일이 없으면 빈 객체).

import type { MovementNote } from './types';

export type MmLang = 'ko' | 'en' | 'ja' | 'zh' | 'hi' | 'ar';

/** 언어 고르기 칸의 순서·이름(그 언어로 쓴 이름) */
export const MM_LANGS: { id: MmLang; label: string; short: string }[] = [
  { id: 'ko', label: '한국어', short: '한' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ja', label: '日本語', short: '日' },
  { id: 'zh', label: '中文', short: '中' },
  { id: 'hi', label: 'हिन्दी', short: 'हि' },
  { id: 'ar', label: 'العربية', short: 'ع' }
];

export function isMmLang(v: unknown): v is MmLang {
  return MM_LANGS.some((x) => x.id === v);
}

export interface ModelDict {
  tags: Record<string, string>;
  notes: Record<string, string>;
  phrases: Record<string, string>;
  /** phrases 키를 긴 것부터 */
  phraseKeys: string[];
  /** 번호 → 제목·쉬운 풀이(ja·zh·hi·ar) */
  titles: Record<string, string>;
  easy: Record<string, string>;
}

const EMPTY: ModelDict = { tags: {}, notes: {}, phrases: {}, phraseKeys: [], titles: {}, easy: {} };

const loaders = import.meta.glob<unknown>('./i18n/*.json', { import: 'default' });

function strMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === 'string' && x.length > 0) out[k] = x;
  }
  return out;
}

const dictPromises = new Map<MmLang, Promise<ModelDict>>();

/** 영어 사전 — 없거나 깨지면 빈 사전 */
export function loadEnDict(): Promise<ModelDict> {
  return loadDict('en');
}

/** 언어 사전(ko 는 빈 사전) — 없거나 깨지면 빈 사전 */
export function loadDict(lang: MmLang): Promise<ModelDict> {
  const hit = dictPromises.get(lang);
  if (hit) return hit;
  const load = loaders[`./i18n/${lang}.json`];
  if (lang === 'ko' || !load) {
    const p = Promise.resolve(EMPTY);
    dictPromises.set(lang, p);
    return p;
  }
  const p = load()
    .then((data) => {
      const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
      // phrases: 빈 번역(strMap 이 거름)과 한 글자 조각('개'·'가' 등)은 치환하면 글이 깨지므로 뺀다
      const phrases = strMap(d.phrases);
      for (const k of Object.keys(phrases)) if (k.trim().length < 2) delete phrases[k];
      return {
        tags: strMap(d.tags),
        notes: strMap(d.notes),
        phrases,
        phraseKeys: Object.keys(phrases).sort((a, b) => b.length - a.length),
        titles: strMap(d.titles),
        easy: strMap(d.easy)
      };
    })
    .catch(() => EMPTY);
  dictPromises.set(lang, p);
  return p;
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
  /** 폰에서 접힌 조작 막대를 펼치는 버튼 */
  ctlMore: string;
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
  ctlMore: '조작 ▾',
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
  langTitle: '언어',
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
  ctlMore: 'Controls ▾',
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
  langTitle: 'Language',
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

const JA: UiText = {
  appTitle: '507の機械運動',
  sub: (total, seen) => `1868年の本の版画 ${total}点 — 見た数 ${seen} / ${total}`,
  about: '本の紹介',
  all: 'すべて',
  only3d: '3Dのみ',
  jump: '番号へ移動',
  jumpAria: '運動の番号へ移動',
  rangeAria: '番号の範囲',
  loadingList: '一覧を読み込み中…',
  listFail: '一覧を読み込めません。再読み込みしてください。',
  emptyRange: 'この範囲に条件に合う運動はありません。',
  figAlt: (n, title) => `${n}番の版画 — ${title}`,
  figCap: '原本の版画 — 押すと拡大',
  zoomAlt: (n) => `${n}番の原本の版画（拡大）`,
  zoomCap: '押すと閉じます',
  thumbAlt: (n) => `${n}番の版画（小）`,
  fold: 'たたむ',
  unfold: 'ひらく',
  ctlMore: '操作 ▾',
  toList: ' 一覧',
  toListAria: '507の機械運動の一覧へ',
  toListTitle: '507の機械運動の最初の画面（一覧）へ',
  tabsAria: '説明',
  tabEasy: 'やさしい説明',
  tabKo: '韓国語訳',
  tabEn: '英語の原文',
  loadingDesc: '説明を読み込み中…',
  prev: '‹ 前へ',
  next: '次へ ›',
  prevN: (n) => `‹ ${n}番`,
  nextN: (n) => `${n}番 ›`,
  numLabel: (n) => `${n}番`,
  untitled: (n) => `${n}番の運動`,
  wait3d: '3Dモデル準備中',
  play: '再生',
  pause: '停止',
  speed: '速さ',
  speedAria: '再生速度（0〜3倍）',
  reverse: '逆回転',
  resetView: '視点を戻す',
  labels: '名札',
  labelsOn: '部品の名札を隠す',
  labelsOff: '部品の名札を表示',
  arrows: '矢印',
  arrowsOn: '動きの矢印を隠す',
  arrowsOff: '動きの矢印を表示',
  notesTitle: '動きの数値',
  loading: '読み込み中…',
  langTitle: '言語',
  cats: {
    belt: 'ベルト・プーリー',
    gear: '歯車',
    ratchet: 'ラチェット',
    cam: 'カム',
    crank: 'クランク・リンク',
    escapement: '脱進機',
    governor: '調速機',
    steam: '蒸気',
    pump: 'ポンプ',
    tool: '工具・その他'
  }
};

const ZH: UiText = {
  appTitle: '507种机械运动',
  sub: (total, seen) => `1868年书中的${total}幅版画 — 已看 ${seen} / ${total}`,
  about: '关于本书',
  all: '全部',
  only3d: '只看3D',
  jump: '按编号前往',
  jumpAria: '直接前往运动编号',
  rangeAria: '编号范围',
  loadingList: '正在加载列表…',
  listFail: '无法加载列表，请刷新页面。',
  emptyRange: '此范围内没有符合条件的运动。',
  figAlt: (n, title) => `第${n}号版画 — ${title}`,
  figCap: '原版画 — 点击放大',
  zoomAlt: (n) => `第${n}号原版画（放大）`,
  zoomCap: '点击关闭',
  thumbAlt: (n) => `第${n}号版画缩略图`,
  fold: '收起',
  unfold: '展开',
  ctlMore: '控制 ▾',
  toList: ' 列表',
  toListAria: '返回507种机械运动列表',
  toListTitle: '返回507种机械运动首页（列表）',
  tabsAria: '说明',
  tabEasy: '简单说明',
  tabKo: '韩语译文',
  tabEn: '英文原文',
  loadingDesc: '正在加载说明…',
  prev: '‹ 上一个',
  next: '下一个 ›',
  prevN: (n) => `‹ 第${n}号`,
  nextN: (n) => `第${n}号 ›`,
  numLabel: (n) => `第${n}号`,
  untitled: (n) => `第${n}号运动`,
  wait3d: '3D模型制作中',
  play: '播放',
  pause: '暂停',
  speed: '速度',
  speedAria: '播放速度（0~3倍）',
  reverse: '反转',
  resetView: '重置视角',
  labels: '标签',
  labelsOn: '隐藏零件标签',
  labelsOff: '显示零件标签',
  arrows: '箭头',
  arrowsOn: '隐藏运动箭头',
  arrowsOff: '显示运动箭头',
  notesTitle: '运动数值',
  loading: '加载中…',
  langTitle: '语言',
  cats: {
    belt: '带与带轮',
    gear: '齿轮',
    ratchet: '棘轮',
    cam: '凸轮',
    crank: '曲柄与连杆',
    escapement: '擒纵机构',
    governor: '调速器',
    steam: '蒸汽',
    pump: '泵',
    tool: '工具及其他'
  }
};

const HI: UiText = {
  appTitle: '507 यांत्रिक गतियाँ',
  sub: (total, seen) => `1868 की किताब के ${total} चित्र — देखे ${seen} / ${total}`,
  about: 'किताब के बारे में',
  all: 'सभी',
  only3d: 'केवल 3D',
  jump: 'नंबर पर जाएँ',
  jumpAria: 'गति नंबर पर सीधे जाएँ',
  rangeAria: 'नंबर सीमा',
  loadingList: 'सूची लोड हो रही है…',
  listFail: 'सूची लोड नहीं हो सकी। पेज रीफ़्रेश करें।',
  emptyRange: 'इस सीमा में कोई मेल खाती गति नहीं है।',
  figAlt: (n, title) => `चित्र ${n} — ${title}`,
  figCap: 'मूल चित्र — बड़ा करने के लिए दबाएँ',
  zoomAlt: (n) => `मूल चित्र ${n}, बड़ा`,
  zoomCap: 'बंद करने के लिए दबाएँ',
  thumbAlt: (n) => `चित्र ${n}, छोटा`,
  fold: 'छिपाएँ',
  unfold: 'खोलें',
  ctlMore: 'नियंत्रण ▾',
  toList: ' सूची',
  toListAria: '507 गतियों की सूची पर वापस',
  toListTitle: '507 गतियों की सूची पर वापस',
  tabsAria: 'विवरण',
  tabEasy: 'आसान व्याख्या',
  tabKo: 'कोरियाई अनुवाद',
  tabEn: 'अंग्रेज़ी मूल पाठ',
  loadingDesc: 'विवरण लोड हो रहा है…',
  prev: '‹ पिछला',
  next: 'अगला ›',
  prevN: (n) => `‹ #${n}`,
  nextN: (n) => `#${n} ›`,
  numLabel: (n) => `#${n}`,
  untitled: (n) => `गति #${n}`,
  wait3d: '3D मॉडल तैयार हो रहा है',
  play: 'चलाएँ',
  pause: 'रोकें',
  speed: 'गति',
  speedAria: 'चलाने की गति (0–3×)',
  reverse: 'उलटा घुमाएँ',
  resetView: 'दृश्य रीसेट करें',
  labels: 'लेबल',
  labelsOn: 'पुर्ज़ों के लेबल छिपाएँ',
  labelsOff: 'पुर्ज़ों के लेबल दिखाएँ',
  arrows: 'तीर',
  arrowsOn: 'गति के तीर छिपाएँ',
  arrowsOff: 'गति के तीर दिखाएँ',
  notesTitle: 'गति के मान',
  loading: 'लोड हो रहा है…',
  langTitle: 'भाषा',
  cats: {
    belt: 'बेल्ट और पुली',
    gear: 'गियर',
    ratchet: 'रैचेट',
    cam: 'कैम',
    crank: 'क्रैंक और लिंक',
    escapement: 'एस्केपमेंट',
    governor: 'गवर्नर',
    steam: 'भाप',
    pump: 'पंप',
    tool: 'औज़ार और अन्य'
  }
};

const AR: UiText = {
  appTitle: '507 حركة ميكانيكية',
  sub: (total, seen) => `${total} نقشًا من كتاب عام 1868 — شاهدت ${seen} / ${total}`,
  about: 'عن الكتاب',
  all: 'الكل',
  only3d: 'ثلاثي الأبعاد فقط',
  jump: 'انتقل إلى رقم',
  jumpAria: 'الانتقال مباشرة إلى رقم الحركة',
  rangeAria: 'نطاق الأرقام',
  loadingList: 'جارٍ تحميل القائمة…',
  listFail: 'تعذّر تحميل القائمة. حدّث الصفحة.',
  emptyRange: 'لا توجد حركات مطابقة في هذا النطاق.',
  figAlt: (n, title) => `النقش ${n} — ${title}`,
  figCap: 'النقش الأصلي — اضغط للتكبير',
  zoomAlt: (n) => `النقش الأصلي ${n} مكبّرًا`,
  zoomCap: 'اضغط للإغلاق',
  thumbAlt: (n) => `صورة مصغّرة للنقش ${n}`,
  fold: 'طيّ',
  unfold: 'فتح',
  ctlMore: 'التحكم ▾',
  toList: ' القائمة',
  toListAria: 'العودة إلى قائمة الحركات الـ507',
  toListTitle: 'العودة إلى قائمة الحركات الـ507',
  tabsAria: 'الوصف',
  tabEasy: 'شرح مبسّط',
  tabKo: 'الترجمة الكورية',
  tabEn: 'النص الإنجليزي الأصلي',
  loadingDesc: 'جارٍ تحميل الوصف…',
  prev: '‹ السابق',
  next: 'التالي ›',
  prevN: (n) => `‹ رقم ${n}`,
  nextN: (n) => `رقم ${n} ›`,
  numLabel: (n) => `رقم ${n}`,
  untitled: (n) => `الحركة رقم ${n}`,
  wait3d: 'النموذج ثلاثي الأبعاد قيد الإعداد',
  play: 'تشغيل',
  pause: 'إيقاف',
  speed: 'السرعة',
  speedAria: 'سرعة التشغيل (0–3×)',
  reverse: 'عكس الدوران',
  resetView: 'إعادة المنظر',
  labels: 'الأسماء',
  labelsOn: 'إخفاء أسماء الأجزاء',
  labelsOff: 'إظهار أسماء الأجزاء',
  arrows: 'الأسهم',
  arrowsOn: 'إخفاء أسهم الحركة',
  arrowsOff: 'إظهار أسهم الحركة',
  notesTitle: 'قيم الحركة',
  loading: 'جارٍ التحميل…',
  langTitle: 'اللغة',
  cats: {
    belt: 'السيور والبكرات',
    gear: 'التروس',
    ratchet: 'السقاطات',
    cam: 'الكامات',
    crank: 'الأذرع والوصلات',
    escapement: 'آليات الميزان',
    governor: 'المنظّمات',
    steam: 'البخار',
    pump: 'المضخات',
    tool: 'أدوات وغيرها'
  }
};

const TABLE: Record<MmLang, UiText> = { ko: KO, en: EN, ja: JA, zh: ZH, hi: HI, ar: AR };

export function uiText(lang: MmLang): UiText {
  return TABLE[lang] ?? KO;
}

// ㄱ-힣 범위는 한자·가나(U+4E00 등)까지 덮으므로 한글 자모·음절만 따로 적는다
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

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
