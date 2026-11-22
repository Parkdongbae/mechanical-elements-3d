// 단원 퀴즈 — 10문제 한 세트(이름·분류·쓰임새·O/X)로 기계요소를 점검하는 학습 모드

import type { AppMode, ModeContext } from './types';
import { PartStage } from './PartStage';
import { el, button, readJson, writeJson } from './dom';
import { CATEGORIES, PARTS, getCategory, getPart, type CategoryId, type PartDef } from '../data/elements';
import { SITUATION_QUESTIONS, TRUE_FALSE_QUESTIONS } from '../data/quiz';

const STORE_KEY = 'mech3d-quiz-v1';
const TOTAL = 10;

interface QuizStore {
  best: number;
  plays: number;
}

/** 홈 화면 표시용 최고 점수·도전 횟수 */
export function getQuizBest(): { best: number; plays: number } {
  const v = readJson<Partial<QuizStore>>(STORE_KEY, {});
  return {
    best: typeof v.best === 'number' ? v.best : 0,
    plays: typeof v.plays === 'number' ? v.plays : 0
  };
}

interface Choice {
  key: string;
  label: string;
  /** 분류 문제에서 선택지 옆에 칠할 분류 */
  cat?: CategoryId;
}

interface Question {
  type: '이름 맞히기' | '분류 맞히기' | '쓰임새 맞히기' | 'O/X';
  prompt: string;
  /** 질문 글 위에 부품을 미리 보여 줄지(이름·분류 문제) */
  showBefore: boolean;
  partId: string;
  choices: Choice[];
  answerKey: string;
  explain: string;
  /** 정답 공개 뒤 보여 줄 정답 문구 */
  answerText: string;
  isTF: boolean;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

function nameQuestion(part: PartDef): Question {
  // 같은 분류의 비슷한 부품을 오답으로 쓰고, 모자라면 다른 분류에서 채운다
  const same = shuffle(PARTS.filter((p) => p.category === part.category && p.id !== part.id));
  const others = shuffle(PARTS.filter((p) => p.category !== part.category));
  const wrong = [...same, ...others].slice(0, 3);
  const choices = shuffle([part, ...wrong]).map((p) => ({ key: p.id, label: p.name }));
  return {
    type: '이름 맞히기',
    prompt: '화면에 보이는 부품의 이름은 무엇일까요?',
    showBefore: true,
    partId: part.id,
    choices,
    answerKey: part.id,
    answerText: part.name,
    explain: part.role,
    isTF: false
  };
}

function categoryQuestion(part: PartDef): Question {
  const cat = getCategory(part.category);
  return {
    type: '분류 맞히기',
    prompt: `'${part.name}'은(는) 어떤 분류의 기계요소일까요?`,
    showBefore: true,
    partId: part.id,
    choices: CATEGORIES.map((c) => ({ key: c.id, label: c.name, cat: c.id })),
    answerKey: cat.id,
    answerText: `${cat.name} 기계요소`,
    explain: `${cat.name} 기계요소는 ${cat.desc}예요. ${part.name}: ${part.role}`,
    isTF: false
  };
}

function buildSet(): Question[] {
  // 이름·분류 문제는 서로 다른 부품 5종으로 출제해 같은 부품이 겹치지 않게 한다
  const parts = shuffle(PARTS).slice(0, 5);
  const qs: Question[] = [
    ...parts.slice(0, 3).map(nameQuestion),
    ...parts.slice(3).map(categoryQuestion),
    ...shuffle(SITUATION_QUESTIONS)
      .slice(0, 3)
      .map<Question>((s) => ({
        type: '쓰임새 맞히기',
        prompt: s.q,
        showBefore: false,
        partId: s.answer,
        choices: shuffle([s.answer, ...s.distractors]).map((id) => ({ key: id, label: getPart(id).name })),
        answerKey: s.answer,
        answerText: getPart(s.answer).name,
        explain: s.explain,
        isTF: false
      })),
    ...shuffle(TRUE_FALSE_QUESTIONS)
      .slice(0, 2)
      .map<Question>((t) => ({
        type: 'O/X',
        prompt: t.statement,
        showBefore: false,
        partId: t.partId,
        choices: [
          { key: 'O', label: '맞다' },
          { key: 'X', label: '틀리다' }
        ],
        answerKey: t.answer ? 'O' : 'X',
        answerText: t.answer ? '맞는 설명' : '틀린 설명',
        explain: t.explain,
        isTF: true
      }))
  ];
  return shuffle(qs);
}

type Phase = 'start' | 'question' | 'result';

export class Quiz implements AppMode {
  private ctx: ModeContext | null = null;
  private stage: PartStage | null = null;
  private wrap: HTMLElement | null = null;
  private panel!: HTMLElement;

  private phase: Phase = 'start';
  private set: Question[] = [];
  private qi = 0;
  private score = 0;
  private picked: string | null = null;
  private wrongs: { q: Question; picked: string }[] = [];
  private newRecord = false;
  private choiceEls: HTMLButtonElement[] = [];

  private onKey = (e: KeyboardEvent): void => {
    if (this.phase !== 'question' || this.picked !== null) return;
    const q = this.set[this.qi];
    if (!q) return;
    const n = q.isTF ? (e.key.toLowerCase() === 'o' ? 1 : e.key.toLowerCase() === 'x' ? 2 : 0) : Number(e.key);
    const c = q.choices[n - 1];
    if (c && n >= 1) this.answer(c.key);
  };

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.stage = new PartStage(ctx.sceneMgr);
    this.stage.setVisible(false);
    // 우측 문제 패널에 받침이 가리지 않도록 부품을 왼쪽으로 조금 옮긴다
    this.stage.flyToDefault(false, 0.9);
    const wrap = el('div', 'quiz-wrap');
    this.wrap = wrap;
    this.panel = el('section', 'quiz-panel');
    this.panel.setAttribute('aria-live', 'polite');
    wrap.append(this.panel);
    ctx.root.append(wrap);
    window.addEventListener('keydown', this.onKey);
    this.renderStart();
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.stage?.dispose();
    this.stage = null;
    this.wrap?.remove();
    this.wrap = null;
    this.choiceEls = [];
    this.ctx = null;
  }

  update(dt: number): void {
    this.stage?.update(dt);
  }

  // ───────── 화면 ─────────

  private setPanel(...nodes: Node[]): void {
    this.panel.replaceChildren(...nodes);
    this.panel.scrollTop = 0;
  }

  private showPart(partId: string | null): void {
    if (!this.stage) return;
    if (partId === null) {
      this.stage.setVisible(false);
      return;
    }
    const p = getPart(partId);
    this.stage.setRingColor(getComputedStyle(document.documentElement).getPropertyValue(`--cat-${p.category}`).trim() || '#888888');
    this.stage.show(p);
    this.stage.setVisible(true);
  }

  private renderStart(): void {
    this.phase = 'start';
    this.showPart(null);
    const { best, plays } = getQuizBest();
    const box = el('div', 'quiz-start');
    box.append(
      el('span', 'quiz-eyebrow', '단원 퀴즈'),
      el('h2', 'quiz-h1', '기계의 구성과 동력 전달'),
      el('p', 'quiz-lead', `결합용·축용·제어용·전동용 기계요소를 ${TOTAL}문제로 점검해요. 부품 이름, 분류, 쓰임새, O/X 문제가 섞여 나옵니다.`)
    );
    const stats = el('div', 'quiz-stats');
    stats.append(this.stat('문제 수', `${TOTAL}문제`), this.stat('최고 점수', plays > 0 ? `${best} / ${TOTAL}` : '기록 없음'), this.stat('도전', `${plays}회`));
    box.append(stats);
    const actions = el('div', 'quiz-actions');
    const start = button('quiz-btn is-primary', '시작하기', () => this.begin());
    actions.append(start, button('quiz-btn', '홈으로', () => this.ctx?.goHome()));
    box.append(actions);
    this.setPanel(box);
    start.focus({ preventScroll: true });
  }

  private stat(label: string, value: string): HTMLElement {
    const s = el('div', 'quiz-stat');
    s.append(el('span', 'quiz-stat-v', value), el('span', 'quiz-stat-l', label));
    return s;
  }

  private begin(): void {
    this.set = buildSet();
    this.qi = 0;
    this.score = 0;
    this.wrongs = [];
    this.renderQuestion();
  }

  private renderQuestion(): void {
    const q = this.set[this.qi];
    if (!q) return;
    this.phase = 'question';
    this.picked = null;
    this.choiceEls = [];
    this.showPart(q.showBefore ? q.partId : null);

    const head = el('div', 'quiz-head');
    const meta = el('div', 'quiz-meta');
    meta.append(el('span', 'quiz-count', `문제 ${this.qi + 1} / ${this.set.length}`), el('span', 'quiz-type', q.type), el('span', 'quiz-score', `정답 ${this.score}`));
    const bar = el('div', 'quiz-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(this.set.length));
    bar.setAttribute('aria-valuenow', String(this.qi + 1));
    const fill = el('div', 'quiz-bar-fill');
    fill.style.width = `${((this.qi + 1) / this.set.length) * 100}%`;
    bar.append(fill);
    head.append(meta, bar);

    const prompt = el('h2', q.isTF ? 'quiz-prompt is-statement' : 'quiz-prompt', q.prompt);
    const list = el('div', q.isTF ? 'quiz-choices is-tf' : 'quiz-choices');
    q.choices.forEach((c, i) => {
      const b = el('button', 'quiz-choice');
      b.type = 'button';
      if (c.cat) b.style.setProperty('--c', `var(--cat-${c.cat})`);
      const key = el('span', 'quiz-key', q.isTF ? c.key : String(i + 1));
      b.append(key, el('span', 'quiz-label', c.label), el('span', 'quiz-mark'));
      b.addEventListener('click', () => this.answer(c.key));
      this.choiceEls.push(b);
      list.append(b);
    });
    const feedback = el('div', 'quiz-feedback');
    feedback.hidden = true;
    feedback.dataset.slot = 'fb';
    this.setPanel(head, prompt, list, feedback);
  }

  private answer(key: string): void {
    const q = this.set[this.qi];
    if (!q || this.picked !== null) return;
    this.picked = key;
    const ok = key === q.answerKey;
    if (ok) this.score++;
    else this.wrongs.push({ q, picked: key });
    this.ctx?.playSound(ok ? 'ok' : 'wrong');

    q.choices.forEach((c, i) => {
      const b = this.choiceEls[i];
      if (!b) return;
      b.disabled = true;
      const mark = b.querySelector('.quiz-mark');
      if (c.key === q.answerKey) {
        b.classList.add('is-correct');
        if (mark) mark.textContent = '✓';
      } else if (c.key === key) {
        b.classList.add('is-wrong');
        if (mark) mark.textContent = '✕';
      } else {
        b.classList.add('is-dim');
      }
    });

    // 쓰임새·O/X 문제는 정답을 확인한 뒤에 부품을 보여 준다
    this.showPart(q.partId);

    const fb = this.panel.querySelector<HTMLElement>('[data-slot="fb"]');
    if (!fb) return;
    fb.hidden = false;
    fb.className = `quiz-feedback ${ok ? 'is-ok' : 'is-bad'}`;
    const title = el('p', 'quiz-fb-title', ok ? '정답이에요!' : '아쉬워요, 오답이에요');
    const lines: HTMLElement[] = [title];
    if (!ok) {
      const ans = el('p', 'quiz-fb-answer');
      ans.append('정답: ', el('strong', undefined, q.answerText));
      lines.push(ans);
    }
    lines.push(el('p', 'quiz-fb-text', q.explain));
    const last = this.qi >= this.set.length - 1;
    const next = button('quiz-btn is-primary quiz-next', last ? '결과 보기' : '다음 문제', () => (last ? this.finish() : this.advance()));
    fb.replaceChildren(...lines, next);
    next.focus({ preventScroll: true });
    fb.scrollIntoView({ block: 'nearest' });
  }

  private advance(): void {
    this.qi++;
    this.renderQuestion();
  }

  private finish(): void {
    const prev = getQuizBest();
    this.newRecord = this.score > prev.best;
    writeJson(STORE_KEY, { best: Math.max(prev.best, this.score), plays: prev.plays + 1 } satisfies QuizStore);
    this.renderResult();
  }

  private renderResult(): void {
    this.phase = 'result';
    this.showPart(null);
    const total = this.set.length;
    const { best } = getQuizBest();
    const msg =
      this.score === total ? '만점이에요! 기계요소를 완벽하게 알고 있네요.' :
      this.score >= total * 0.8 ? '훌륭해요! 조금만 더 다듬으면 만점이에요.' :
      this.score >= total * 0.5 ? '좋아요! 틀린 문제를 복습해 볼까요?' :
      '도감에서 부품을 다시 살펴보고 도전해 보세요.';

    const box = el('div', 'quiz-result');
    const scoreRow = el('div', 'quiz-score-row');
    const big = el('div', 'quiz-big');
    big.append(el('span', 'quiz-big-n', String(this.score)), el('span', 'quiz-big-d', ` / ${total}`));
    scoreRow.append(big);
    if (this.newRecord) scoreRow.append(el('span', 'quiz-badge', '최고 기록!'));
    box.append(el('span', 'quiz-eyebrow', '결과'), scoreRow, el('p', 'quiz-lead', msg), el('p', 'quiz-sub', `최고 점수 ${best} / ${TOTAL}`));

    if (this.wrongs.length > 0) {
      box.append(el('h3', 'quiz-h3', `틀린 문제 복습 (${this.wrongs.length})`));
      const ul = el('ul', 'quiz-review');
      for (const w of this.wrongs) {
        const li = el('li', 'quiz-review-item');
        li.append(el('p', 'quiz-review-q', w.q.prompt));
        const ans = el('p', 'quiz-review-a');
        ans.append('정답: ', el('strong', undefined, w.q.answerText));
        li.append(ans, el('p', 'quiz-review-e', w.q.explain));
        li.append(button('quiz-btn is-small', '3D로 다시 보기', () => this.showPart(w.q.partId)));
        ul.append(li);
      }
      box.append(ul);
    }

    const actions = el('div', 'quiz-actions is-sticky');
    const again = button('quiz-btn is-primary', '다시 풀기', () => this.begin());
    actions.append(again, button('quiz-btn', '홈으로', () => this.ctx?.goHome()));
    this.setPanel(box, actions);
    again.focus({ preventScroll: true });
  }
}
