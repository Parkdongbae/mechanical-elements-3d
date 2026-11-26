// 「507 기계 운동」 목록의 분류 버튼 풍선 도움말(마우스를 올리면 나오는 짧은 설명) — 6개 언어
import type { MmLang } from './lang';

type Tips = Record<string, string>;

const KO: Tips = {
  all: '모든 분류를 1~507번에서 보여 줍니다',
  belt: '벨트·줄·체인이 바퀴(풀리)를 감아 회전을 전하는 장치',
  gear: '톱니가 서로 맞물려 회전 속도와 방향을 바꾸는 장치',
  ratchet: '한쪽으로만 돌게 걸쇠(폴)가 톱니를 거는 장치',
  cam: '모양이 고르지 않은 바퀴(캠)가 돌며 막대를 밀어 움직이는 장치',
  crank: '크랭크와 막대(링크)를 이어 회전과 왕복 운동을 서로 바꾸는 장치',
  escapement: '시계처럼 바퀴를 한 칸씩 끊어 일정하게 돌게 하는 장치',
  governor: '기계가 너무 빠르거나 느리지 않게 속도를 맞추는 장치',
  steam: '증기의 힘으로 피스톤을 움직이는 기관과 그 부품',
  pump: '물이나 공기를 빨아올리고 밀어내는 장치',
  tool: '공구, 저울, 그 밖의 여러 기계 장치',
  only3d: '3D 모델이 있는 번호만 보여 줍니다'
};

const EN: Tips = {
  all: 'Show every category, Nos. 1–507',
  belt: 'Belts, ropes and chains wrapped round wheels (pulleys) to pass on rotation',
  gear: 'Toothed wheels that mesh to change speed and direction of rotation',
  ratchet: 'A catch (pawl) engages the teeth so the wheel turns one way only',
  cam: 'An irregular wheel (cam) pushes a rod as it turns',
  crank: 'Cranks and links that turn rotation into back-and-forth motion and back',
  escapement: 'Lets a wheel advance one tooth at a time, as in a clock',
  governor: 'Keeps a machine from running too fast or too slow',
  steam: 'Engines and parts that use steam pressure to move a piston',
  pump: 'Devices that draw up and push out water or air',
  tool: 'Tools, scales and other mechanisms',
  only3d: 'Show only numbers that have a 3D model'
};

const JA: Tips = {
  all: '1〜507番のすべての分類を表示します',
  belt: 'ベルト・綱・チェーンを車(プーリー)に掛けて回転を伝える装置',
  gear: '歯をかみ合わせて回転の速さと向きを変える装置',
  ratchet: '爪(ポール)が歯に掛かり、一方向にだけ回す装置',
  cam: '形の不規則な車(カム)が回って棒を押し動かす装置',
  crank: 'クランクと棒(リンク)で回転と往復運動を変換する装置',
  escapement: '時計のように車を一歯ずつ区切って進める装置',
  governor: '機械が速すぎたり遅すぎたりしないよう速さを整える装置',
  steam: '蒸気の力でピストンを動かす機関とその部品',
  pump: '水や空気を吸い上げ、押し出す装置',
  tool: '工具・はかり・その他の機械装置',
  only3d: '3Dモデルがある番号だけを表示します'
};

const ZH: Tips = {
  all: '显示1～507号的全部分类',
  belt: '用带、绳、链绕过轮子(带轮)传递转动的装置',
  gear: '齿轮相互啮合，改变转速和转向的装置',
  ratchet: '棘爪卡住轮齿，使轮子只能向一个方向转动',
  cam: '形状不规则的轮子(凸轮)转动时推动杆件',
  crank: '用曲柄和连杆把转动与往复运动相互转换',
  escapement: '像钟表那样让轮子一齿一齿地前进',
  governor: '使机器不会转得太快或太慢的调速装置',
  steam: '用蒸汽推动活塞的发动机及其部件',
  pump: '抽吸并压出水或空气的装置',
  tool: '工具、秤以及其他机械装置',
  only3d: '只显示有3D模型的编号'
};

const HI: Tips = {
  all: 'संख्या 1–507 की सभी श्रेणियाँ दिखाएँ',
  belt: 'बेल्ट, रस्सी या चेन पहियों (पुली) पर लिपटकर घुमाव पहुँचाती है',
  gear: 'दाँतेदार पहिए आपस में फँसकर घूमने की गति और दिशा बदलते हैं',
  ratchet: 'पॉल दाँतों में अटककर पहिए को केवल एक दिशा में घूमने देता है',
  cam: 'अनियमित आकार का पहिया (कैम) घूमते हुए छड़ को धकेलता है',
  crank: 'क्रैंक और लिंक घुमाव को आगे-पीछे की गति में बदलते हैं',
  escapement: 'घड़ी की तरह पहिए को एक-एक दाँत आगे बढ़ाता है',
  governor: 'मशीन को बहुत तेज़ या बहुत धीमा चलने से रोकता है',
  steam: 'भाप के दबाव से पिस्टन चलाने वाले इंजन और उनके पुर्ज़े',
  pump: 'पानी या हवा को खींचने और धकेलने वाले उपकरण',
  tool: 'औज़ार, तराज़ू और अन्य यंत्र',
  only3d: 'केवल वे संख्याएँ दिखाएँ जिनका 3D मॉडल है'
};

const AR: Tips = {
  all: 'عرض جميع الفئات من 1 إلى 507',
  belt: 'سيور وحبال وسلاسل تلتف حول البكرات لنقل الدوران',
  gear: 'عجلات مسنّنة تتعشّق لتغيير سرعة الدوران واتجاهه',
  ratchet: 'سقّاطة تمسك الأسنان فتدور العجلة في اتجاه واحد فقط',
  cam: 'عجلة غير منتظمة الشكل (كامة) تدفع ذراعًا أثناء دورانها',
  crank: 'مرافق ووصلات تحوّل الدوران إلى حركة ذهاب وإياب وبالعكس',
  escapement: 'يجعل العجلة تتقدّم سنًّا بعد سن كما في الساعة',
  governor: 'يمنع الآلة من الدوران بسرعة زائدة أو بطء شديد',
  steam: 'محركات وأجزاء تحرّك المكبس بقوة البخار',
  pump: 'أجهزة تسحب الماء أو الهواء وتدفعه',
  tool: 'أدوات وموازين وآليات أخرى',
  only3d: 'عرض الأرقام التي لها نموذج ثلاثي الأبعاد فقط'
};

const ALL: Record<MmLang, Tips> = { ko: KO, en: EN, ja: JA, zh: ZH, hi: HI, ar: AR };

/** 분류 id(all·only3d 포함)의 풍선 도움말 */
export function catTip(lang: MmLang, id: string): string {
  return ALL[lang][id] ?? '';
}
