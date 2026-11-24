// 물레방아 — DOM 패널(오른쪽 패널 / 좁은 화면 하단 시트 + 조작 막대). 계산·3D는 모른다.
import { el } from '../../modes/dom';
import type { DriveMode, Readout, ViewKey } from './types';
import type { LiftGraph } from './graph';
import { ELEMENT_CARD, SOURCE_CARD, SOURCE_CITE, PROMISE_CARD, MORE_CARD, QUIZ, type InfoCard } from './data';

export interface PanelStage {
  title: string;
  body: string[];
}
export interface PanelCard {
  title: string;
  intro?: string;
  rows: { t?: string; b: string; extra?: string }[];
  foot?: string;
}
export interface PanelHandlers {
  stage(i: number): void;
  gate(): void;
  flow(lps: number): void;
  mode(m: DriveMode): void;
  slow(on: boolean): void;
  view(v: ViewKey): void;
  reset(): void;
  scrub(deg: number): void;
}
export type TabKey = 'stage' | 'nums' | 'info';

const fromInfo = (c: InfoCard, extraLabel?: string, foot?: string): PanelCard => ({
  title: c.title,
  intro: c.intro,
  rows: c.rows.map((r) => ({ t: r.head, b: r.body, extra: r.extra && extraLabel ? `${extraLabel}: ${r.extra}` : undefined })),
  foot: [c.note, foot].filter((x): x is string => !!x).join(' ') || undefined
});

/** 접이식 카드 4개 — 순서는 지시서 8-2 */
export function buildCards(): PanelCard[] {
  return [
    fromInfo(ELEMENT_CARD, '이 앱의 관련 부품'),
    fromInfo(SOURCE_CARD, undefined, SOURCE_CITE),
    fromInfo(PROMISE_CARD),
    fromInfo(MORE_CARD)
  ];
}

const INTRO_TITLE = '물레방아 — 물의 힘이 방아를 찧어요';
const INTRO_BODY = [
  '「물길 열기」를 누르면 물이 흘러와 물레바퀴가 돌고, 굴통 → 누름대 → 방아채 → 방아공이로 힘이 전해져요.',
  '아래 1~5 단계 버튼을 누르면 한 부분씩 따라가며 볼 수 있어요. 손으로 돌려 볼 수도 있어요.'
];

const WATER_KEYS = new Set(['flow', 'hitSpeed', 'water', 'waterPower']);
const VIEWS: [ViewKey, string][] = [['all', '전체'], ['wheel', '바퀴'], ['cam', '누름대'], ['pestle', '공이']];
const TABS: [TabKey, string][] = [['stage', '단계'], ['nums', '숫자'], ['info', '알아보기']];
const SVG_NS = 'http://www.w3.org/2000/svg';

function gateIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'wm-gate-ico');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', 'M9 2.5c3 3.8 5 6.1 5 8.6a5 5 0 0 1-10 0c0-2.5 2-4.8 5-8.6z');
  p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}

export class MillPanel {
  readonly wrap: HTMLElement;
  readonly dock: HTMLElement;
  readonly side: HTMLElement;
  readonly bar: HTMLElement;

  private readonly h: PanelHandlers;
  private readonly stages: PanelStage[];
  private stageBtns: HTMLButtonElement[] = [];
  private tabBtns: HTMLButtonElement[] = [];
  private guide: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private gateBtn!: HTMLButtonElement;
  private flowRange!: HTMLInputElement;
  private flowVal!: HTMLElement;
  private scrubRange!: HTMLInputElement;
  private scrubVal!: HTMLElement;
  private slowBtn!: HTMLButtonElement;
  private modeBtns: HTMLButtonElement[] = [];
  private viewBtns: HTMLButtonElement[] = [];
  private partCard!: HTMLElement;
  private noteEl!: HTMLElement;
  private noteTimer = 0;
  private rows = new Map<string, { row: HTMLElement; v: HTMLElement; b: HTMLElement }>();
  private nums!: HTMLElement;
  private labelSlot!: HTMLElement;
  private stage = 0;

  constructor(h: PanelHandlers, stages: PanelStage[], cards: PanelCard[], graph: LiftGraph) {
    this.h = h;
    this.stages = stages;
    this.wrap = el('div', 'wm-wrap');
    this.wrap.dataset.mode = 'water';
    this.dock = el('div', 'wm-dock');
    this.side = el('div', 'wm-side wm-panel');
    this.side.dataset.tab = 'stage';
    this.bar = el('div', 'wm-bar wm-panel');
    this.bar.setAttribute('role', 'group');
    this.bar.setAttribute('aria-label', '물레방아 조작');
    this.guide = el('div', 'wm-guide');
    this.guide.setAttribute('aria-live', 'polite');

    this.noteEl = el('div', 'wm-note');
    this.noteEl.setAttribute('role', 'status');
    this.noteEl.setAttribute('aria-live', 'polite');

    this.buildSide(cards, graph);
    this.buildBar();
    this.dock.append(this.bar, this.side);
    this.wrap.append(this.noteEl, this.dock);
    this.setStage(0);
  }

  // ───────────── 구성 ─────────────

  private buildSide(cards: PanelCard[], graph: LiftGraph): void {
    const tabs = el('div', 'wm-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '화면 구역');
    for (const [k, label] of TABS) {
      const b = el('button', 'wm-tab', label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.tab = k;
      b.addEventListener('click', () => this.setTab(k));
      this.tabBtns.push(b);
      tabs.append(b);
    }

    // 단계
    const sec1 = el('section', 'wm-sec');
    sec1.dataset.tab = 'stage';
    const head = el('div');
    head.append(el('h2', 'wm-title', '물레방아'), el('p', 'wm-sub', '물의 힘 → 물레바퀴 → 굴통 → 누름대 → 방아공이'));
    const steps = el('nav', 'wm-steps');
    steps.setAttribute('aria-label', '작동 원리 단계');
    this.stages.forEach((s, i) => {
      const b = el('button', 'wm-step', String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', `${i + 1}단계 ${s.title}`);
      b.title = s.title;
      b.addEventListener('click', () => this.h.stage(i + 1));
      this.stageBtns.push(b);
      steps.append(b);
    });
    const nav = el('div', 'wm-nav');
    this.prevBtn = el('button', 'wm-btn', '이전');
    this.prevBtn.type = 'button';
    this.prevBtn.addEventListener('click', () => this.h.stage(Math.max(0, this.stage - 1)));
    this.nextBtn = el('button', 'wm-btn is-primary', '다음');
    this.nextBtn.type = 'button';
    this.nextBtn.addEventListener('click', () => this.h.stage(Math.min(this.stages.length, this.stage + 1)));
    nav.append(this.prevBtn, this.nextBtn);
    sec1.append(head, steps, this.guide, nav);

    // 숫자
    const sec2 = el('section', 'wm-sec');
    sec2.dataset.tab = 'nums';
    this.partCard = el('div', 'wm-partcard');
    this.partCard.setAttribute('aria-live', 'polite');
    this.nums = el('dl', 'wm-nums');
    sec2.append(el('h3', 'wm-h3', '숫자판'), this.partCard, this.nums, el('h3', 'wm-h3', '공이 높이 그래프'), graph.root);

    // 알아보기
    const sec3 = el('section', 'wm-sec');
    sec3.dataset.tab = 'info';
    cards.forEach((c, i) => {
      const d = el('details', 'wm-card');
      if (i === 0) d.open = true;
      d.append(el('summary', undefined, c.title));
      const body = el('div', 'wm-card-body');
      if (c.intro) body.append(el('p', undefined, c.intro));
      for (const r of c.rows) {
        if (r.t) {
          const row = el('div', 'wm-row');
          row.append(el('strong', undefined, r.t), el('span', undefined, r.b));
          if (r.extra) row.append(el('em', 'wm-extra', r.extra));
          body.append(row);
        } else {
          body.append(el('p', undefined, r.b));
        }
      }
      if (c.foot) body.append(el('p', 'wm-src', c.foot));
      d.append(body);
      sec3.append(d);
    });

    sec3.append(this.buildQuiz());
    this.side.append(tabs, sec1, sec2, sec3);
    this.setTab('stage');
  }

  private buildQuiz(): HTMLElement {
    const d = el('details', 'wm-card');
    d.append(el('summary', undefined, '확인 문제'));
    const body = el('div', 'wm-card-body');
    QUIZ.forEach((item, qi) => {
      const box = el('div', 'wm-quiz');
      box.append(el('p', 'wm-quiz-q', `${qi + 1}. ${item.q}`));
      const choices = el('div', 'wm-quiz-c');
      const res = el('p', 'wm-quiz-r');
      res.setAttribute('aria-live', 'polite');
      item.choices.forEach((c, ci) => {
        const b = el('button', 'wm-btn wm-quiz-b', c);
        b.type = 'button';
        b.addEventListener('click', () => {
          const ok = ci === item.answer;
          res.className = `wm-quiz-r ${ok ? 'is-ok' : 'is-no'}`;
          res.textContent = ok ? `맞아요! ${item.why}` : '다시 생각해 봐요.';
        });
        choices.append(b);
      });
      box.append(choices, res);
      body.append(box);
    });
    d.append(body);
    return d;
  }

  private buildBar(): void {
    // 1줄: 물길 버튼 + 물의 양 / (손 모드) 굴통 각
    const row1 = el('div', 'wm-row1');
    this.gateBtn = el('button', 'wm-btn wm-gate');
    this.gateBtn.type = 'button';
    this.gateBtn.addEventListener('click', () => this.h.gate());
    this.setGate(false);

    const flow = el('label', 'wm-flow');
    const ft = el('span', 'wm-field-top');
    this.flowVal = el('span', 'wm-field-v');
    ft.append(el('span', 'wm-field-l', '물의 양'), this.flowVal);
    this.flowRange = el('input', 'wm-range');
    this.flowRange.type = 'range';
    this.flowRange.min = '0';
    this.flowRange.max = '480';
    this.flowRange.step = '10';
    this.flowRange.value = '320';
    this.flowRange.setAttribute('aria-label', '물의 양(초당 리터)');
    this.flowRange.addEventListener('input', () => this.h.flow(Number(this.flowRange.value)));
    const fs = el('span', 'wm-scale');
    fs.append(el('span', 'is-l', '0'), el('span', 'is-std', '자료의 표준 320'), el('span', 'is-r', '480 L/s'));
    flow.append(ft, this.flowRange, fs);
    this.setFlow(320);

    const scrub = el('label', 'wm-scrub');
    const st = el('span', 'wm-field-top');
    this.scrubVal = el('span', 'wm-field-v');
    st.append(el('span', 'wm-field-l', '굴통 각(앞으로만)'), this.scrubVal);
    this.scrubRange = el('input', 'wm-range');
    this.scrubRange.type = 'range';
    this.scrubRange.min = '0';
    this.scrubRange.max = '360';
    this.scrubRange.step = '1';
    this.scrubRange.value = '100';
    this.scrubRange.setAttribute('aria-label', '굴통 각(도). 물이 돌리는 방향으로만 돌아가요');
    this.scrubRange.addEventListener('input', () => this.h.scrub(Number(this.scrubRange.value)));
    const ss = el('span', 'wm-scale');
    ss.append(el('span', 'is-l', '0°'), el('span', 'is-r', '360°'));
    scrub.append(st, this.scrubRange, ss);
    this.setScrub(100);

    row1.append(this.gateBtn, flow, scrub);

    // 2줄: 칩
    const chips = el('div', 'wm-chips');
    const modeSeg = el('div', 'wm-seg');
    modeSeg.setAttribute('role', 'radiogroup');
    modeSeg.setAttribute('aria-label', '돌리는 방법');
    for (const [m, label] of [['water', '물로 돌리기'], ['hand', '손으로 돌리기']] as const) {
      const b = el('button', 'wm-seg-b', label);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.v = m;
      b.addEventListener('click', () => this.h.mode(m));
      this.modeBtns.push(b);
      modeSeg.append(b);
    }
    this.slowBtn = el('button', 'wm-chip', '천천히 보기');
    this.slowBtn.type = 'button';
    this.slowBtn.setAttribute('aria-pressed', 'false');
    this.slowBtn.addEventListener('click', () => this.h.slow(this.slowBtn.getAttribute('aria-pressed') !== 'true'));
    const viewSeg = el('div', 'wm-seg');
    viewSeg.setAttribute('role', 'radiogroup');
    viewSeg.setAttribute('aria-label', '시점');
    for (const [v, label] of VIEWS) {
      const b = el('button', 'wm-seg-b', label);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.v = v;
      b.addEventListener('click', () => this.h.view(v));
      this.viewBtns.push(b);
      viewSeg.append(b);
    }
    const reset = el('button', 'wm-chip', '처음으로');
    reset.type = 'button';
    reset.addEventListener('click', () => this.h.reset());
    this.labelSlot = el('span', 'wm-slot');
    chips.append(modeSeg, this.slowBtn, this.labelSlot, viewSeg, reset);

    this.bar.append(row1, chips);
    this.setMode('water');
    this.setView('all');
  }

  /** 공용 이름표 버튼을 칩 줄에 놓는다 */
  setLabelButton(btn: HTMLButtonElement): void {
    this.labelSlot.replaceChildren(btn);
  }

  // ───────────── 상태 반영 ─────────────

  setStage(i: number): void {
    this.stage = i;
    this.stageBtns.forEach((b, k) => {
      b.classList.toggle('is-on', k + 1 === i);
      b.classList.toggle('is-done', k + 1 < i);
      if (k + 1 === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    const s = i >= 1 ? this.stages[i - 1] : undefined;
    this.guide.replaceChildren();
    if (s) {
      this.guide.append(el('span', 'wm-eyebrow', `${i} / ${this.stages.length} 단계`), el('h3', 'wm-gtitle', s.title));
      for (const p of s.body) this.guide.append(el('p', 'wm-body', p));
    } else {
      this.guide.append(el('h3', 'wm-gtitle', INTRO_TITLE));
      for (const p of INTRO_BODY) this.guide.append(el('p', 'wm-body', p));
    }
    this.prevBtn.disabled = i === 0;
    this.nextBtn.disabled = i === this.stages.length;
    this.nextBtn.textContent = i === 0 ? '1단계 시작' : '다음';
  }

  setTab(k: TabKey): void {
    this.side.dataset.tab = k;
    this.tabBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
    this.side.scrollTop = 0;
  }

  setGate(open: boolean): void {
    this.gateBtn.replaceChildren(gateIcon(), document.createTextNode(open ? '물길 닫기' : '물길 열기'));
    this.gateBtn.classList.toggle('is-open', open);
    this.gateBtn.setAttribute('aria-pressed', String(open));
    this.gateBtn.title = open ? '수문을 닫아 물을 멈춰요 (Space)' : '수문을 열어 물을 흘려요 (Space)';
  }

  setFlow(lps: number): void {
    this.flowRange.value = String(lps);
    this.flowVal.textContent = `${lps} L/s${lps === 320 ? ' · 자료의 표준' : ''}`;
    this.flowRange.setAttribute('aria-valuetext', `${lps} 리터/초`);
  }

  setScrub(deg: number): void {
    const d = Math.round(((deg % 360) + 360) % 360);
    if (document.activeElement !== this.scrubRange) this.scrubRange.value = String(d);
    this.scrubVal.textContent = `${d}°`;
  }

  setMode(m: DriveMode): void {
    this.wrap.dataset.mode = m;
    this.modeBtns.forEach((b) => {
      const on = b.dataset.v === m;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  setSlow(on: boolean): void {
    this.slowBtn.setAttribute('aria-pressed', String(on));
  }

  setView(v: ViewKey): void {
    this.viewBtns.forEach((b) => {
      const on = b.dataset.v === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  setReadouts(list: Readout[]): void {
    for (const r of list) {
      let row = this.rows.get(r.key);
      if (!row) {
        const e = el('div', 'wm-num');
        const cls = WATER_KEYS.has(r.key) ? ' is-water' : r.key === 'rpm' ? '' : ' is-power';
        e.className = `wm-num${cls}`;
        e.dataset.key = r.key;
        const v = el('dd', 'wm-num-v');
        const b = el('span', 'wm-num-b');
        const l = el('dt', 'wm-num-l', r.label);
        e.append(l, v, b);
        this.nums.append(e);
        row = { row: e, v, b };
        this.rows.set(r.key, row);
      }
      if (row.v.textContent !== r.value) row.v.textContent = r.value;
      const basis = r.basis ?? '';
      if (row.b.textContent !== basis) row.b.textContent = basis;
    }
  }

  readoutText(): string {
    return [...this.rows.values()].map((r) => r.v.textContent ?? '').join(' | ');
  }

  showPart(name: string | null, desc?: string): void {
    this.partCard.classList.toggle('is-on', name !== null);
    this.partCard.replaceChildren();
    if (name !== null) this.partCard.append(el('strong', undefined, name), document.createTextNode(desc ?? ''));
    if (name !== null && this.side.dataset.tab !== 'nums' && window.innerWidth < 820) this.setTab('nums');
  }

  /** 짧은 안내 한 줄을 잠깐 띄운다(aria-live) */
  note(text: string, ms = 3200): void {
    this.noteEl.textContent = text;
    this.noteEl.classList.add('is-on');
    window.clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => this.noteEl.classList.remove('is-on'), ms);
  }

  dispose(): void {
    window.clearTimeout(this.noteTimer);
    this.wrap.remove();
    this.rows.clear();
    this.stageBtns = [];
    this.tabBtns = [];
    this.modeBtns = [];
    this.viewBtns = [];
  }
}
