// 「507 기계 운동」 소개 — 작업 지시서 16 §5에서 확인된 사실만 쓴다(추측·단정 금지).

import { el, button } from '../modes/dom';

export interface PrefaceData {
  page?: number;
  ko?: string;
  points?: string[];
}

/** 서문 번역을 /mm507/preface에서 시도한다 — 없거나 깨지면 null(본문은 지시서 사실로만 채운다) */
export async function loadPreface(): Promise<PrefaceData | null> {
  try {
    const res = await fetch('/mm507/preface');
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;
    const out: PrefaceData = {};
    if (typeof d.page === 'number') out.page = d.page;
    if (typeof d.ko === 'string' && d.ko.trim().length > 0) out.ko = d.ko;
    if (Array.isArray(d.points)) out.points = d.points.filter((x): x is string => typeof x === 'string');
    return out;
  } catch {
    return null;
  }
}

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const s = el('section', 'mm-about-sec');
  s.append(el('h3', 'mm-about-h', title), ...children);
  return s;
}

function para(text: string, cls = 'mm-about-p'): HTMLElement {
  return el('p', cls, text);
}

/** 영문 소개 — 한글 본문과 같은 사실만(서문 번역 인용은 한글 전용이라 뺀다) */
function buildAboutEn(done3d: number, onList: () => void, langBtn?: HTMLElement): HTMLElement {
  const art = el('article', 'mm-about mm-panel');
  const head = el('header', 'mm-about-head');
  if (langBtn) head.append(langBtn);
  head.append(el('span', 'mm-eyebrow', 'About'), el('h2', 'mm-about-title', 'A picture dictionary of machines, 150 years ago'));
  art.append(head);
  art.append(
    section(
      'The book',
      para('“Five Hundred and Seven Mechanical Movements” was first published in 1868. The material shown here is a scan of the 1871 printing (Cornell University Library copy).'),
      para('It was compiled by Henry T. Brown, described on the title page as editor of the magazine “American Artisan”, and published by Brown, Coombs & Co. of New York.'),
      para('The subtitle sets out its scope: movements important in dynamics, hydraulics, hydrostatics, pneumatics, steam engines, mill and other gearing, presses, horology and miscellaneous machinery, including many never published before and several only recently introduced.')
    )
  );
  art.append(
    section(
      'How the book is laid out',
      para('Each left-hand page holds nine or ten engravings, and the facing right-hand page holds the descriptions with the same numbers. The author noted in the preface that this facing arrangement makes reference easy.'),
      para('The movements end with No. 507 on page 122, followed by advertisements of the period.')
    )
  );
  const points = el('ul', 'mm-about-ul');
  for (const t of [
    'It was compiled because a collection of mechanical movements had long been needed.',
    'The contents first appeared in the magazine “American Artisan”, across five volumes.',
    'More than a quarter of the movements were new, and it held about three times as many as any earlier American book.',
    'The classification is not complete, but a detailed index and facing pictures and text make it easy to search.'
  ]) {
    points.append(el('li', 'mm-about-li', t));
  }
  art.append(section('What the author says in the preface', points));
  art.append(
    section(
      'Why it matters',
      para('Before computers and video, inventors and engineers used this book as a picture dictionary to find which mechanism would produce the motion they needed.'),
      para('The same principles are still inside machines 150 years later — a bicycle chain, a clock escapement and an engine crank are examples.'),
      para('The book is in the public domain, so anyone can read it and build from it.')
    )
  );
  const how = el('ul', 'mm-about-ul');
  for (const t of [
    'Pick an engraving in the list to browse the 507 movements.',
    `Movements with a finished 3D model (${done3d} / 507 so far) actually move. They are being built in book order from No. 1.`,
    'If an engraving is hard to follow, read the “Easy explanation” tab first.'
  ]) {
    how.append(el('li', 'mm-about-li', t));
  }
  art.append(section('How to use this site', how));
  const ext = el('a', 'mm-ext', 'Also worth a visit — 507movements.com (animated engravings; that content belongs to that site)');
  ext.href = 'https://507movements.com/';
  ext.target = '_blank';
  ext.rel = 'noopener noreferrer';
  art.append(section('More', ext));
  const nav = el('div', 'mm-about-nav');
  nav.append(button('mm-btn is-primary', 'Go to the movements list', onList));
  art.append(nav);
  return art;
}

/** 소개 글은 한국어·영어만 있다 — 일·중·힌디·아랍은 영어 소개를 보인다 */
export function buildAbout(preface: PrefaceData | null, done3d: number, onList: () => void, lang: string = 'ko', langBtn?: HTMLElement): HTMLElement {
  if (lang !== 'ko') return buildAboutEn(done3d, onList, langBtn);
  const art = el('article', 'mm-about mm-panel');

  const head = el('header', 'mm-about-head');
  if (langBtn) head.append(langBtn);
  head.append(el('span', 'mm-eyebrow', '소개'), el('h2', 'mm-about-title', '150년 전, 기계를 찾아보던 그림 사전'));
  art.append(head);

  art.append(
    section(
      '이 책은',
      para('『Five Hundred and Seven Mechanical Movements』(507가지 기계 운동)는 1868년에 처음 나온 책이에요. 지금 우리가 보는 자료는 1871년에 인쇄된 책(코넬 대학교 도서관 소장본)의 스캔이에요.'),
      para('엮은이는 헨리 T. 브라운(Henry T. Brown). 표제지에는 당시 잡지 《아메리칸 아티잔》의 편집자라고 적혀 있어요. 뉴욕의 브라운, 쿰스 앤 컴퍼니(Brown, Coombs & Co.)에서 펴냈어요.'),
      para('표제지의 부제는 이 책의 범위를 알려 줘요. 동역학·수력학·유체 정역학·기체 역학·증기 기관·제분과 여러 기어 장치·프레스·시계 장치 같은 여러 기계에서 중요한 운동을 모았고, 이전에 발표된 적 없는 운동과 그때까지 갓 쓰이기 시작한 운동도 넣었어요.')
    )
  );

  art.append(
    section(
      '책의 구성',
      para('왼쪽 쪽에는 판화 9~10개가, 오른쪽 쪽에는 같은 번호의 설명이 실려 있어요. 그림과 설명이 마주 보게 놓인 배열 덕분에 찾아보기 쉽다고 저자가 서문에서 자랑했어요.'),
      para('운동은 122쪽의 507번에서 끝나고, 그 뒤에는 당시의 광고가 이어져 있어요.')
    )
  );

  const points = el('ul', 'mm-about-ul');
  const items = preface?.points && preface.points.length > 0
    ? preface.points
    : [
        '기계 운동을 한데 모은 책이 오랫동안 필요했기에 엮었어요.',
        '내용은 먼저 잡지 《아메리칸 아티잔》에 다섯 권에 걸쳐 실렸어요.',
        '수록된 운동의 4분의 1 이상이 새로운 것이고, 그때까지 미국에서 나온 어떤 책보다 약 세 배 많은 운동을 담았어요.',
        '분류는 완전하지 않지만, 자세한 색인과 그림·설명을 마주 보게 놓은 구성으로 찾아보기 쉽게 했어요.'
      ];
  for (const t of items) points.append(el('li', 'mm-about-li', t));
  art.append(section('서문에서 저자가 밝힌 것', points));

  if (preface?.ko) {
    const quote = el('blockquote', 'mm-about-quote', preface.ko.split('\n\n')[0] ?? preface.ko);
    art.append(section('서문 인용', quote, para('— 1868년 서문 중에서', 'mm-about-cap')));
  }

  art.append(
    section(
      '왜 중요할까',
      para('컴퓨터도 동영상도 없던 시절, 이 책은 발명가와 기술자가 "이런 움직임을 만들려면 어떤 기구를 쓰면 될까"를 찾아보던 그림 사전이었어요.'),
      para('150년이 지난 지금의 기계에도 같은 원리가 들어 있어요. 자전거의 체인, 시계의 탈진기, 엔진의 크랭크가 그 예예요.'),
      para('이 책은 공유 저작물이라 누구나 읽고 다시 만들 수 있어요.')
    )
  );

  const how = el('ul', 'mm-about-ul');
  for (const t of [
    `목록에서 판화를 눌러 507가지 운동을 열람해 보세요.`,
    `3D가 완성된 운동(지금 ${done3d} / 507번)은 모형이 실제로 움직여요. 1번부터 책 순서대로 만들어 갈 거예요.`,
    '판화만으로 이해가 어려우면 "쉬운 풀이" 탭을 먼저 읽어 보세요.'
  ]) {
    how.append(el('li', 'mm-about-li', t));
  }
  art.append(section('이 사이트에서 읽는 법', how));

  const ext = el('a', 'mm-ext', '함께 보면 좋은 곳 — 507movements.com (움직이는 판화, 저작물은 그 사이트에 있어요)');
  ext.href = 'https://507movements.com/';
  ext.target = '_blank';
  ext.rel = 'noopener noreferrer';
  art.append(section('더 보기', ext));

  const nav = el('div', 'mm-about-nav');
  nav.append(button('mm-btn is-primary', '운동 목록으로', onList));
  art.append(nav);
  return art;
}
