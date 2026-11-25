// 쇼츠 언어 설정 — 한국어·영어 + 일본어·중국어(간체)·힌디어·아랍어(사용자 결정 2026-11-25).
// 새 언어의 제목·쉬운 풀이는 앱 사전 src/mm507/i18n/<lang>.json 의 titles·easy 를 쓴다(ko·en 은 catalog.json).
// 새 언어 글꼴은 Windows 시스템 글꼴(재배포 불가 → 커밋하지 않고 shorts/_work/fonts 에 복사해 자막에 쓴다).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, catalogEntry } from './lib.mjs';

export const ALL_LANGS = ['ko', 'en', 'ja', 'zh', 'hi', 'ar'];
export const NEW_LANGS = ['ja', 'zh', 'hi', 'ar'];

/** 명령줄 언어 인자: both(ko,en) | all | new(ja,zh,hi,ar) | ko,ja,... */
export function parseLangs(arg, def = 'both') {
  const a = arg ?? def;
  if (a === 'both') return ['ko', 'en'];
  if (a === 'all') return ALL_LANGS;
  if (a === 'new') return NEW_LANGS;
  const list = a.split(',').filter((x) => ALL_LANGS.includes(x));
  if (!list.length) throw new Error(`언어 인자 이상: ${a} (both | all | new | ko,en,ja,zh,hi,ar)`);
  return list;
}

const SYS = 'C:/Windows/Fonts';
const APP_URL = 'mechanical-elements-3d.vercel.app';

/**
 * voice: edge-tts 목소리 / sans·serif: 카드(Chrome) 글꼴 / ass: 자막 글꼴 이름 / sysFonts: 자막용으로 복사할 시스템 글꼴
 * cjk: 띄어쓰기 없는 글(자막 묶기·이어 붙이기) / rtl: 오른쪽→왼쪽
 */
export const CFG = {
  ko: { voice: 'ko-KR-SunHiNeural', sans: 'Pre', serif: 'SerifKR', ass: 'Pretendard ExtraBold', assBold: 0, sysFonts: [], cjk: false, rtl: false, prefix: '[한]' },
  en: { voice: 'en-US-AriaNeural', sans: 'Inter, Pre', serif: 'Fell', ass: 'Inter ExtraBold', assBold: 0, sysFonts: [], cjk: false, rtl: false, prefix: '[EN]' },
  ja: { voice: 'ja-JP-NanamiNeural', sans: "'Yu Gothic', 'Yu Gothic UI', Meiryo, sans-serif", serif: "'Yu Mincho', 'Yu Gothic', serif", ass: 'Yu Gothic', assBold: -1, sysFonts: ['YuGothB.ttc'], cjk: true, rtl: false, prefix: '[日]' },
  zh: { voice: 'zh-CN-XiaoxiaoNeural', sans: "'Microsoft YaHei', sans-serif", serif: "'Microsoft YaHei', serif", ass: 'Microsoft YaHei', assBold: -1, sysFonts: ['msyhbd.ttc'], cjk: true, rtl: false, prefix: '[中]' },
  hi: { voice: 'hi-IN-SwaraNeural', sans: "'Nirmala UI', sans-serif", serif: "'Nirmala UI', serif", ass: 'Nirmala UI', assBold: -1, sysFonts: ['Nirmala.ttc'], cjk: false, rtl: false, prefix: '[हि]' },
  ar: { voice: 'ar-SA-ZariyahNeural', sans: "'Segoe UI', Tahoma, sans-serif", serif: "'Segoe UI', Tahoma, serif", ass: 'Segoe UI', assBold: -1, sysFonts: ['segoeuib.ttf'], cjk: false, rtl: true, prefix: '[ع]' }
};

/** 카드 문구 */
export const TXT = {
  ko: { series: '507 기계 운동', book: '1868년 원서 『507가지 기계 운동』', fig: (n) => `원서 판화 ${n}번 (1868)`, model: '3D 모델', try: '직접 돌려 보세요', sub: '구독', subOn: '구독중', like: '좋아요' },
  en: { series: '507 Mechanical Movements', book: 'Henry T. Brown, 1868', fig: (n) => `Original engraving No. ${n} (1868)`, model: '3D model', try: 'Try it yourself', sub: 'Subscribe', subOn: 'Subscribed', like: 'Like' },
  ja: { series: '507の機械運動', book: '1868年の原書『507の機械運動』', fig: (n) => `原書の版画 ${n}番（1868）`, model: '3Dモデル', try: '自分で回してみよう', sub: 'チャンネル登録', subOn: '登録済み', like: '高評価' },
  zh: { series: '507种机械运动', book: '1868年原著《507种机械运动》', fig: (n) => `原著版画 第${n}号（1868）`, model: '3D模型', try: '亲手转一转', sub: '订阅', subOn: '已订阅', like: '点赞' },
  hi: { series: '507 यांत्रिक गतियाँ', book: 'हेनरी टी. ब्राउन, 1868', fig: (n) => `मूल चित्र संख्या ${n} (1868)`, model: '3D मॉडल', try: 'खुद घुमाकर देखें', sub: 'सब्सक्राइब', subOn: 'सब्सक्राइब्ड', like: 'लाइक' },
  ar: { series: '507 حركة ميكانيكية', book: 'هنري ت. براون، 1868', fig: (n) => `النقش الأصلي رقم ${n} (1868)`, model: 'نموذج ثلاثي الأبعاد', try: 'جرّبها بنفسك', sub: 'اشترك', subOn: 'مشترك', like: 'إعجاب' }
};

/** 분류 짧은 이름(진행 배지 "벨트 3/11") */
export const CAT_NAME = {
  ko: { belt: '벨트', gear: '기어', tool: '공구', ratchet: '래칫', crank: '크랭크', cam: '캠', governor: '조속기', pump: '펌프', steam: '증기', escapement: '탈진기', misc: '기타' },
  en: { belt: 'Belts', gear: 'Gears', tool: 'Tools', ratchet: 'Ratchets', crank: 'Cranks', cam: 'Cams', governor: 'Governors', pump: 'Pumps', steam: 'Steam', escapement: 'Escapements', misc: 'Misc' },
  ja: { belt: 'ベルト', gear: '歯車', tool: '工具', ratchet: 'ラチェット', crank: 'クランク', cam: 'カム', governor: '調速機', pump: 'ポンプ', steam: '蒸気', escapement: '脱進機', misc: 'その他' },
  zh: { belt: '带传动', gear: '齿轮', tool: '工具', ratchet: '棘轮', crank: '曲柄', cam: '凸轮', governor: '调速器', pump: '泵', steam: '蒸汽', escapement: '擒纵机构', misc: '其他' },
  hi: { belt: 'बेल्ट', gear: 'गियर', tool: 'औज़ार', ratchet: 'रैचेट', crank: 'क्रैंक', cam: 'कैम', governor: 'गवर्नर', pump: 'पंप', steam: 'भाप', escapement: 'एस्केपमेंट', misc: 'अन्य' },
  ar: { belt: 'السيور', gear: 'التروس', tool: 'الأدوات', ratchet: 'السقاطات', crank: 'الأذرع', cam: 'الكامات', governor: 'المنظّمات', pump: 'المضخات', steam: 'البخار', escapement: 'الميزان', misc: 'أخرى' }
};

const dicts = {};
function dict(lang) {
  if (!(lang in dicts)) {
    const f = path.join(ROOT, 'src', 'mm507', 'i18n', `${lang}.json`);
    dicts[lang] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  }
  return dicts[lang];
}

/** 그 언어의 제목·쉬운 풀이(없으면 영어) */
export function textOf(n, lang) {
  const { entry } = catalogEntry(n);
  if (lang === 'ko') return { title: entry?.title ?? `${n}번`, easy: entry?.easy ?? '' };
  if (lang === 'en') return { title: entry?.titleEn ?? `No. ${n}`, easy: entry?.easyEn ?? '' };
  const d = dict(lang);
  return { title: d.titles?.[String(n)] ?? entry?.titleEn ?? `No. ${n}`, easy: d.easy?.[String(n)] ?? entry?.easyEn ?? '' };
}

/** 자막 글꼴 폴더(ffmpeg ass 필터 fontsdir, 저장소 기준 상대 경로) — 새 언어는 시스템 글꼴을 복사해 둔다 */
export function fontsDir(lang) {
  const c = CFG[lang];
  if (!c.sysFonts.length) return 'assets/shorts/fonts';
  const rel = `shorts/_work/fonts/${lang}`;
  const dir = path.join(ROOT, rel);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of c.sysFonts) {
    const dst = path.join(dir, f);
    if (!fs.existsSync(dst)) fs.copyFileSync(path.join(SYS, f), dst);
  }
  return rel;
}

/** 업로드 메타데이터의 언어별 부분 */
export function metaText(n, lang, url) {
  const { title, easy } = textOf(n, lang);
  const t = TXT[lang];
  const book = `Henry T. Brown, "Five Hundred and Seven Mechanical Movements" (1868)`;
  const M = {
    ko: { title: `[한] [507 기계 운동 #${n}] ${title} #shorts`, app: `▶ 앱에서 직접 돌려 보기: ${url}`, src: `원서: Henry T. Brown, 『Five Hundred and Seven Mechanical Movements』(1868), ${n}번`, hash: '#507기계운동 #기계 #기구학 #shorts', tags: ['507 기계 운동', '기계', '기구학', '기계요소', '과학', title, 'mechanism', 'engineering', '507movements', 'shorts'], playlist: '507 기계 운동 (한국어)' },
    en: { title: `[EN] [507 Mechanical Movements #${n}] ${title} #shorts`, app: `▶ Spin it yourself in the app: ${url}`, src: `From ${book}, No. ${n}`, hash: '#507movements #mechanism #engineering #shorts', tags: ['507 mechanical movements', 'mechanism', 'engineering', 'kinematics', 'machine design', title, 'how it works', '507movements', 'shorts'], playlist: '507 Mechanical Movements (English)' },
    ja: { title: `[日] [${t.series} #${n}] ${title} #shorts`, app: `▶ アプリで自分で回してみる: ${url}`, src: `原書: ${book}, ${n}番`, hash: '#507機械運動 #機械 #機構学 #shorts', tags: ['507の機械運動', '機械', '機構学', '機械要素', '仕組み', title, 'mechanism', '507movements', 'shorts'], playlist: '507の機械運動（日本語）' },
    zh: { title: `[中] [${t.series} #${n}] ${title} #shorts`, app: `▶ 在应用里亲手转一转: ${url}`, src: `原著: ${book}, 第${n}号`, hash: '#507种机械运动 #机械 #机构学 #shorts', tags: ['507种机械运动', '机械', '机构学', '机械原理', '科普', title, 'mechanism', '507movements', 'shorts'], playlist: '507种机械运动（中文）' },
    hi: { title: `[हि] [${t.series} #${n}] ${title} #shorts`, app: `▶ ऐप में खुद घुमाकर देखें: ${url}`, src: `स्रोत: ${book}, संख्या ${n}`, hash: '#507movements #मशीन #इंजीनियरिंग #shorts', tags: ['507 यांत्रिक गतियाँ', 'मशीन', 'इंजीनियरिंग', 'यांत्रिकी', title, 'mechanism', 'engineering', '507movements', 'shorts'], playlist: '507 यांत्रिक गतियाँ (हिन्दी)' },
    ar: { title: `[ع] [${t.series} #${n}] ${title} #shorts`, app: `▶ جرّبها بنفسك في التطبيق: ${url}`, src: `المصدر: ${book}، رقم ${n}`, hash: '#507movements #ميكانيكا #هندسة #shorts', tags: ['507 حركة ميكانيكية', 'ميكانيكا', 'هندسة', 'آلات', title, 'mechanism', 'engineering', '507movements', 'shorts'], playlist: '507 حركة ميكانيكية (العربية)' }
  }[lang];
  return { ...M, easy, name: title, url: `${APP_URL}/#/mm/${n}` };
}
