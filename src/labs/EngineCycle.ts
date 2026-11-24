// 탐구 실험 13-A — 엔진의 작동 원리: 4행정 기관과 2행정 기관
// 행정 버튼을 누르면 그 행정의 시작 위치로 가서 그 행정만 천천히 재생하고 멈춘다.
// 크랭크 각도 스크러버로 직접 돌려 보거나 연속 재생할 수 있고, 밸브/포트 열림·점화·가스 색이 크랭크각에서 바로 계산된다.

import * as THREE from 'three';
import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import { el, button } from '../modes/dom';
import { Engine4 } from './cycle/engine4';
import { Engine2 } from './cycle/engine2';
import type { CycleState } from './cycle/parts';
import { LabLabels, type LabelSpec } from './common/labels';
import { buildGraph, type Graph } from './cycle/graph';
import {
  COMPARE_ROWS,
  DEAD_POINT_NOTE,
  ENGINE_NAME,
  KEY_LINE,
  LEGEND,
  QUIZ,
  STROKES,
  TIMING_NOTE,
  type EngineKind
} from './cycle/data';

const SCALE = 0.72;
const BASE_SPEED = 45; // °/s (1× 에서 한 행정 4초)
const OPEN_T = 0.12;

type Model = (Engine4 | Engine2);
type PlayMode = 'idle' | 'stroke' | 'loop';

export class EngineCycle implements AppMode {
  private ctx: ModeContext | null = null;
  private model: Model | null = null;
  private kind: EngineKind = 'four';
  private phi = 0;
  private play: PlayMode = 'idle';
  private playEnd = 0;
  private speed = 1;
  private shown = -1;
  private quiz = false;
  private quizIdx = 0;
  private quizScore = 0;
  private picked: number[] = [];
  private quizDone = false;

  private wrap: HTMLElement | null = null;
  private dock!: HTMLElement;
  private seg!: HTMLElement;
  private guide!: HTMLElement;
  private ctrl!: HTMLElement;
  private side!: HTMLElement;
  private ctrlRow!: HTMLElement;
  private labels: LabLabels | null = null;
  private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private labelSig = new Map<string, string>();
  private baseText = new Map<string, string>();
  private segBtns: HTMLButtonElement[] = [];
  private strokeBtns: HTMLButtonElement[] = [];
  private strokeWrap!: HTMLElement;
  private scrub!: HTMLInputElement;
  private scrubTicks!: HTMLElement;
  private angleOut!: HTMLElement;
  private revOut!: HTMLElement;
  private speedOut!: HTMLElement;
  private loopBtn: HTMLButtonElement | null = null;
  private status = new Map<string, HTMLElement>();
  private gasOut: HTMLElement | null = null;
  private graph: Graph | null = null;
  private graphBox!: HTMLElement;
  private keyBox!: HTMLElement;
  private dragging = false;

  private savedMinDist = 2;
  private viewKey = '';
  private frameT = 0;
  private lastW = 0;
  private lastH = 0;
  private lastStatus = '';

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'ArrowLeft') this.step(-1);
    else if (e.key === ' ' && !(t && t.tagName === 'BUTTON')) this.toggleLoop();
    else return;
    e.preventDefault();
  };

  private onResize = (): void => {
    this.fly(false);
  };

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.kind = 'four';
    this.speed = 1;
    this.quiz = false;
    this.savedMinDist = ctx.sceneMgr.controls.minDistance;
    ctx.sceneMgr.controls.minDistance = 1.5;
    this.buildDom(ctx.root);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    this.setKind('four', true);
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    const ctx = this.ctx;
    if (ctx) {
      ctx.sceneMgr.camera.clearViewOffset();
      ctx.sceneMgr.controls.minDistance = this.savedMinDist;
      if (this.model) ctx.sceneMgr.remove(this.model.root);
    }
    this.model?.dispose();
    this.model = null;
    this.labels?.dispose();
    this.labels = null;
    this.labelSig.clear();
    this.wrap?.remove();
    this.wrap = null;
    this.segBtns = [];
    this.strokeBtns = [];
    this.status.clear();
    this.graph = null;
    this.loopBtn = null;
    this.gasOut = null;
    this.viewKey = '';
    this.lastW = 0;
    this.shown = -1;
    this.lastStatus = '';
    this.ctx = null;
  }

  // ───────────────────────── 엔진 전환 ─────────────────────────

  private setKind(kind: EngineKind, first = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!first && kind === this.kind && this.model) return;
    this.kind = kind;
    if (this.model) {
      ctx.sceneMgr.remove(this.model.root);
      this.model.dispose();
    }
    const m = kind === 'four' ? new Engine4() : new Engine2();
    m.root.scale.setScalar(SCALE);
    this.model = m;
    ctx.sceneMgr.add(m.root);
    this.segBtns.forEach((b, i) => {
      const on = (i === 0) === (kind === 'four');
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    this.quiz = false;
    this.buildStrokes();
    this.buildSide();
    this.setLabels();
    this.shown = -1;
    this.lastStatus = '';
    this.playStroke(0);
    this.fly(first);
  }

  // ───────────────────────── DOM ─────────────────────────

  private buildDom(root: HTMLElement): void {
    const wrap = el('div', 'cyc-wrap');
    this.wrap = wrap;
    this.dock = el('div', 'cyc-dock');

    this.seg = el('div', 'cyc-seg cyc-panel');
    this.seg.setAttribute('role', 'radiogroup');
    this.seg.setAttribute('aria-label', '엔진 종류');
    for (const k of ['four', 'two'] as EngineKind[]) {
      const b = el('button', 'cyc-seg-b', ENGINE_NAME[k]);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => this.setKind(k));
      this.segBtns.push(b);
      this.seg.append(b);
    }

    this.guide = el('section', 'cyc-guide cyc-panel');
    this.guide.setAttribute('aria-live', 'polite');
    this.ctrl = this.buildCtrl();
    this.side = el('aside', 'cyc-side cyc-panel');
    this.dock.append(this.seg, this.ctrl, this.guide, this.side);
    wrap.append(this.dock);
    root.append(wrap);
    // 이름표 레이어 + 켜고 끄는 버튼(재생 조작 줄 끝)
    const labels = new LabLabels(this.ctx!, wrap, { bounds: () => this.bounds });
    this.labels = labels;
    this.ctrlRow.append(labels.button);
  }

  private buildCtrl(): HTMLElement {
    const p = el('section', 'cyc-ctrl cyc-panel');
    p.setAttribute('aria-label', '행정 선택과 크랭크 조작');
    this.strokeWrap = el('div', 'cyc-strokes');
    this.strokeWrap.setAttribute('role', 'group');
    this.strokeWrap.setAttribute('aria-label', '행정');
    p.append(this.strokeWrap);

    const row = el('div', 'cyc-row');
    const sc = el('label', 'cyc-scrub');
    const top = el('span', 'cyc-scrub-top');
    this.angleOut = el('span', 'cyc-angle');
    this.revOut = el('span', 'cyc-rev');
    top.append(el('span', 'cyc-field-l', '크랭크 각도'), this.angleOut, this.revOut);
    this.scrub = el('input', 'cyc-range');
    this.scrub.type = 'range';
    this.scrub.min = '0';
    this.scrub.step = '1';
    this.scrub.setAttribute('aria-label', '크랭크 각도 — 끌어서 직접 돌려 보기');
    this.scrub.addEventListener('input', () => {
      this.dragging = true;
      this.setLoop(false);
      this.play = 'idle';
      this.phi = Math.min(Number(this.scrub.value), this.cycle() - 0.01);
      if (this.quiz) this.leaveQuiz();
    });
    this.scrub.addEventListener('change', () => (this.dragging = false));
    this.scrub.addEventListener('pointerup', () => (this.dragging = false));
    this.scrubTicks = el('span', 'cyc-ticks');
    sc.append(top, this.scrub, this.scrubTicks);

    const sp = el('label', 'cyc-speed');
    const st = el('span', 'cyc-scrub-top');
    this.speedOut = el('span', 'cyc-angle');
    st.append(el('span', 'cyc-field-l', '재생 속도'), this.speedOut);
    const sr = el('input', 'cyc-range');
    sr.type = 'range';
    sr.min = '0.25';
    sr.max = '2';
    sr.step = '0.25';
    sr.value = '1';
    sr.setAttribute('aria-label', '재생 속도');
    sr.addEventListener('input', () => {
      this.speed = Number(sr.value);
      this.speedOut.textContent = `${this.speed}×`;
    });
    this.speedOut.textContent = '1×';
    const ss = el('span', 'cyc-ticks cyc-ticks-2');
    ss.append(el('span', undefined, '천천히'), el('span', undefined, '빠르게'));
    sp.append(st, sr, ss);
    row.append(sc, sp);
    this.ctrlRow = row;
    p.append(row);
    return p;
  }

  private buildStrokes(): void {
    const list = STROKES[this.kind];
    this.strokeWrap.replaceChildren();
    this.strokeWrap.style.setProperty('--n', String(list.length));
    this.strokeBtns = list.map((s, i) => {
      const b = el('button', 'cyc-stroke');
      b.type = 'button';
      b.append(el('span', 'cyc-stroke-fill'), el('span', 'cyc-stroke-n', String(i + 1)), el('span', 'cyc-stroke-l', s.short));
      b.setAttribute('aria-label', `${s.title} 재생`);
      b.addEventListener('click', () => this.playStroke(i));
      this.strokeWrap.append(b);
      return b;
    });
    const c = this.cycle();
    this.scrub.max = String(c);
    this.scrubTicks.replaceChildren();
    const labels = this.kind === 'four' ? ['0° 상사점', '180°', '360°', '540°', '720°'] : ['0° 하사점', '180° 상사점', '360°'];
    labels.forEach((t) => this.scrubTicks.append(el('span', undefined, t)));
  }

  private buildSide(): void {
    const s = this.side;
    s.replaceChildren();
    this.keyBox = el('div', 'cyc-key');
    const k = KEY_LINE[this.kind];
    this.keyBox.append(el('strong', 'cyc-key-s', k.strong), el('span', 'cyc-key-r', k.rest));
    s.append(this.keyBox);

    const lg = el('div', 'cyc-legend');
    for (const it of LEGEND) {
      const row = el('span', 'cyc-legend-i');
      const dot = el('span', 'cyc-dot');
      dot.style.background = `#${it.color.toString(16).padStart(6, '0')}`;
      row.append(dot, el('span', undefined, it.text));
      lg.append(row);
    }
    s.append(lg);

    this.graphBox = el('div', 'cyc-graph-box');
    const gh = el('div', 'cyc-h-row');
    gh.append(el('h3', 'cyc-h3', '실린더 안 압력'), el('span', 'cyc-pill', '맛보기'));
    this.graph = buildGraph(this.kind);
    this.graphBox.append(gh, this.graph.el, el('p', 'cyc-note', '수치 눈금 없이 높고 낮은 모양만 보여 주는 그래프예요. 점은 지금 크랭크 각도의 압력이에요.'));
    s.append(this.graphBox);

    const cmp = el('details', 'cyc-cmp');
    if (window.innerWidth >= 1100) cmp.open = true;
    const sum = el('summary', 'cyc-cmp-s', '4행정 vs 2행정 비교');
    const tbl = el('div', 'cyc-cmp-t');
    tbl.setAttribute('role', 'table');
    const head = el('div', 'cyc-cmp-r is-head');
    head.setAttribute('role', 'row');
    head.append(el('span', undefined, ''), el('span', this.kind === 'four' ? 'is-cur' : undefined, '4행정'), el('span', this.kind === 'two' ? 'is-cur' : undefined, '2행정'));
    tbl.append(head);
    for (const r of COMPARE_ROWS) {
      const row = el('div', 'cyc-cmp-r');
      row.setAttribute('role', 'row');
      row.append(el('span', 'cyc-cmp-l', r.label), el('span', this.kind === 'four' ? 'is-cur' : undefined, r.four), el('span', this.kind === 'two' ? 'is-cur' : undefined, r.two));
      tbl.append(row);
    }
    cmp.append(sum, tbl);
    s.append(cmp);
    s.append(button('cyc-btn cyc-quiz-b', '확인 문제 풀기', () => this.startQuiz()));
  }

  // ───────────────────────── 재생 ─────────────────────────

  private cycle(): number {
    return this.model?.cycle ?? 720;
  }

  private strokeAt(phi: number): number {
    const n = STROKES[this.kind].length;
    return Math.min(n - 1, Math.max(0, Math.floor(phi / 180)));
  }

  private playStroke(i: number): void {
    const n = STROKES[this.kind].length;
    const k = ((i % n) + n) % n;
    if (this.quiz) this.leaveQuiz();
    this.setLoop(false);
    this.phi = k * 180;
    this.playEnd = (k + 1) * 180 - 0.01;
    this.play = 'stroke';
    this.shown = -1;
  }

  private step(d: number): void {
    this.playStroke(this.strokeAt(this.phi) + d);
  }

  private toggleLoop(): void {
    this.setLoop(this.play !== 'loop');
  }

  private setLoop(on: boolean): void {
    if (on) {
      if (this.quiz) this.leaveQuiz();
      this.play = 'loop';
    } else if (this.play === 'loop') this.play = 'idle';
    if (this.loopBtn) {
      this.loopBtn.classList.toggle('is-on', on);
      this.loopBtn.setAttribute('aria-pressed', String(on));
      this.loopBtn.textContent = on ? '멈춤' : '연속 재생';
    }
  }

  // ───────────────────────── 안내 패널 ─────────────────────────

  private renderGuide(): void {
    const g = this.guide;
    g.replaceChildren();
    this.status.clear();
    this.gasOut = null;
    this.lastStatus = '';
    if (this.quiz) {
      this.renderQuiz();
      // 하단 시트에서는 문제 내용이 바뀔 때마다 안내 패널이 보이게 스크롤
      if (window.innerWidth < 1100) {
        const sticky = this.strokeWrap.getBoundingClientRect().height;
        this.dock.scrollTo({ top: Math.max(0, this.guide.offsetTop - sticky - 8) });
      }
      return;
    }
    const list = STROKES[this.kind];
    const i = this.strokeAt(this.phi);
    const s = list[i]!;
    const head = el('div', 'cyc-head');
    head.append(el('span', 'cyc-badge', String(i + 1)));
    const ht = el('div', 'cyc-head-t');
    ht.append(el('span', 'cyc-eyebrow', `${ENGINE_NAME[this.kind]} · 행정 ${i + 1} / ${list.length}`), el('h2', 'cyc-title', s.title));
    head.append(ht);
    g.append(head, el('p', 'cyc-body', s.body));

    const grid = el('dl', `cyc-status${this.kind === 'two' ? ' is-3' : ''}`);
    const rows: [string, string][] =
      this.kind === 'four'
        ? [['piston', '피스톤'], ['intake', '흡기 밸브'], ['exhaust', '배기 밸브'], ['spark', '점화']]
        : [['piston', '피스톤'], ['intake', '흡기 포트'], ['transfer', '소기 포트'], ['exhaust', '배기 포트'], ['spark', '점화']];
    for (const [key, label] of rows) {
      const row = el('div', 'cyc-st');
      const v = el('dd', 'cyc-st-v');
      row.append(el('dt', 'cyc-st-l', label), v);
      grid.append(row);
      this.status.set(key, v);
    }
    g.append(grid);
    this.gasOut = el('p', 'cyc-gas');
    g.append(this.gasOut);
    if (this.kind === 'two') {
      const ccRow = el('p', 'cyc-gas');
      ccRow.dataset.cc = '1';
      this.status.set('cc', ccRow);
      g.append(ccRow);
    }
    g.append(el('p', 'cyc-point', s.note));

    const nav = el('div', 'cyc-nav');
    const loop = button(`cyc-btn${this.play === 'loop' ? ' is-on' : ''}`, this.play === 'loop' ? '멈춤' : '연속 재생', () => this.toggleLoop());
    loop.setAttribute('aria-pressed', String(this.play === 'loop'));
    this.loopBtn = loop;
    nav.append(button('cyc-btn', '이전 행정', () => this.step(-1)), loop, button('cyc-btn is-primary', '다음 행정', () => this.step(1)));
    g.append(nav);
    g.append(el('p', 'cyc-note', this.kind === 'four' ? `${DEAD_POINT_NOTE}. ${TIMING_NOTE}` : DEAD_POINT_NOTE));
  }

  private refreshLive(st: CycleState): void {
    const four = this.kind === 'four';
    const phi = this.phi;
    const pis = st.dead === 'tdc' ? '상사점(맨 위)' : st.dead === 'bdc' ? '하사점(맨 아래)' : st.dir === 'up' ? '↑ 올라감' : '↓ 내려감';
    const openTxt = (v: number): [string, string] => (v > 0.5 ? ['열림', 'is-open'] : v > OPEN_T ? ['조금 열림', 'is-open'] : ['닫힘', 'is-closed']);
    const burning = four ? phi >= 365 && phi < 500 : phi >= 185 && phi < 270;
    const spark: [string, string] = st.spark ? ['불꽃!', 'is-fire'] : burning ? ['연소 중', 'is-fire'] : ['없음', 'is-closed'];
    const vals: Record<string, [string, string]> = {
      piston: [pis, 'is-move'],
      intake: openTxt(st.open.intake ?? 0),
      exhaust: openTxt(st.open.exhaust ?? 0),
      transfer: openTxt(st.open.transfer ?? 0),
      spark
    };
    const key = JSON.stringify(vals) + st.gas + (st.crankcase ?? '');
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    for (const [k, [t, cls]] of Object.entries(vals)) {
      const e = this.status.get(k);
      if (!e) continue;
      e.textContent = t;
      e.className = `cyc-st-v ${cls}`;
    }
    if (this.gasOut) this.gasOut.textContent = `실린더 안: ${st.gas}`;
    const cc = this.status.get('cc');
    if (cc && st.crankcase) cc.textContent = `크랭크실: ${st.crankcase}`;
  }

  // ───────────────────────── 확인 문제 ─────────────────────────

  private startQuiz(): void {
    this.quiz = true;
    this.quizIdx = 0;
    this.quizScore = 0;
    this.picked = [];
    this.quizDone = false;
    this.setLoop(false);
    this.play = 'idle';
    this.renderGuide();
    this.guide.scrollTop = 0;
  }

  private leaveQuiz(): void {
    this.quiz = false;
    this.shown = -1;
  }

  private renderQuiz(): void {
    const g = this.guide;
    const head = el('div', 'cyc-head');
    head.append(el('span', 'cyc-badge', '?'));
    const ht = el('div', 'cyc-head-t');
    ht.append(el('span', 'cyc-eyebrow', '엔진의 작동 원리'), el('h2', 'cyc-title', '확인 문제'));
    head.append(ht);
    g.append(head);
    const q = QUIZ[this.quizIdx];
    if (!q) {
      g.append(el('p', 'cyc-score', `${QUIZ.length}문제 중 ${this.quizScore}문제 맞혔어요`));
      g.append(el('p', 'cyc-body', this.quizScore === QUIZ.length ? '완벽해요! 4행정과 2행정 기관의 순서를 잘 알고 있어요.' : '틀린 문제는 행정 버튼을 눌러 다시 살펴보세요.'));
      const nav = el('div', 'cyc-nav is-2');
      nav.append(
        button('cyc-btn', '다시 풀기', () => this.startQuiz()),
        button('cyc-btn is-primary', '엔진으로 돌아가기', () => {
          this.leaveQuiz();
          this.playStroke(0);
        })
      );
      g.append(nav);
      return;
    }
    g.append(el('p', 'cyc-quiz-n', `문제 ${this.quizIdx + 1} / ${QUIZ.length}`), el('p', 'cyc-quiz-q', q.q));
    if (q.kind === 'order') {
      const slots = el('ol', 'cyc-slots');
      q.items.forEach((_, i) => {
        const pi = this.picked[i];
        const li = el('li', `cyc-slot${pi !== undefined ? ' is-filled' : ''}`);
        li.append(el('span', 'cyc-slot-n', String(i + 1)), el('span', 'cyc-slot-t', pi !== undefined ? q.items[pi]! : '　'));
        if (this.quizDone && pi !== undefined) li.classList.add(pi === i ? 'is-correct' : 'is-wrong');
        slots.append(li);
      });
      g.append(slots);
      const chips = el('div', 'cyc-chips');
      for (const idx of q.shuffled) {
        const b = button('cyc-chip', q.items[idx]!, () => {
          if (this.quizDone || this.picked.includes(idx)) return;
          this.picked.push(idx);
          if (this.picked.length === q.items.length) this.finishQ(this.picked.every((p, i) => p === i));
          this.renderGuide();
        });
        b.disabled = this.quizDone || this.picked.includes(idx);
        chips.append(b);
      }
      g.append(chips);
      if (!this.quizDone && this.picked.length > 0) {
        g.append(
          button('cyc-btn cyc-small', '다시 고르기', () => {
            this.picked = [];
            this.renderGuide();
          })
        );
      }
      if (this.quizDone) {
        const ok = this.picked.every((p, i) => p === i);
        this.feedback(ok, ok ? '' : `정답: ${q.items.join(' → ')}`, q.explain);
      }
    } else {
      const list = el('div', 'cyc-choices');
      q.choices.forEach((c, i) => {
        const b = el('button', 'cyc-choice');
        b.type = 'button';
        b.append(el('span', 'cyc-choice-k', String(i + 1)), el('span', undefined, c));
        if (this.quizDone) {
          b.disabled = true;
          if (i === q.answer) b.classList.add('is-correct');
          else if (i === this.picked[0]) b.classList.add('is-wrong');
        }
        b.addEventListener('click', () => {
          if (this.quizDone) return;
          this.picked = [i];
          this.finishQ(i === q.answer);
          this.renderGuide();
        });
        list.append(b);
      });
      g.append(list);
      if (this.quizDone) {
        const ok = this.picked[0] === q.answer;
        this.feedback(ok, ok ? '' : `정답: ${q.choices[q.answer] ?? ''}`, q.explain);
      }
    }
    g.append(button('cyc-btn cyc-small', '엔진으로 돌아가기', () => {
      this.leaveQuiz();
      this.renderGuide();
    }));
  }

  private finishQ(ok: boolean): void {
    this.quizDone = true;
    if (ok) this.quizScore++;
    this.ctx?.playSound(ok ? 'ok' : 'wrong');
  }

  private feedback(ok: boolean, ans: string, explain: string): void {
    const fb = el('div', `cyc-fb ${ok ? 'is-ok' : 'is-bad'}`);
    fb.append(el('strong', undefined, ok ? '정답이에요!' : `아쉬워요. ${ans}`), el('span', undefined, explain));
    this.guide.append(fb);
    const nx = button('cyc-btn is-primary cyc-next', this.quizIdx + 1 >= QUIZ.length ? '결과 보기' : '다음 문제', () => {
      this.quizIdx++;
      this.picked = [];
      this.quizDone = false;
      this.renderGuide();
    });
    this.guide.append(nx);
    nx.focus({ preventScroll: true });
  }

  // ───────────────────────── 카메라 ─────────────────────────

  private fly(immediate: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const portrait = window.innerWidth < window.innerHeight;
    const narrow = window.innerWidth < 1100;
    const four = this.kind === 'four';
    const t = new THREE.Vector3(0.12 * SCALE, (four ? 2.1 : 1.9) * SCALE, 0);
    const az = THREE.MathUtils.degToRad(22);
    const elv = THREE.MathUtils.degToRad(13);
    const d = (four ? 7.9 : 7.1) * (portrait ? 1.06 : narrow ? 1.32 : 1);
    const pos = t.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(elv), Math.sin(elv), Math.cos(az) * Math.cos(elv)).multiplyScalar(d));
    const view: CameraView = { pos: [pos.x, pos.y, pos.z], target: [t.x, t.y, t.z] };
    ctx.sceneMgr.flyTo(view, immediate);
    this.viewKey = '';
  }

  /** 패널이 가리지 않는 영역 한가운데로 투영 중심을 옮긴다 */
  private updateFrame(): void {
    const ctx = this.ctx;
    if (!ctx || !this.wrap) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const portrait = W < H;
    let x0 = 0;
    let x1 = W;
    let y0 = 0;
    let y1 = H;
    if (W >= 1100) {
      x0 = this.guide.getBoundingClientRect().right;
      x1 = this.side.getBoundingClientRect().left;
      y0 = 60;
      y1 = this.ctrl.getBoundingClientRect().top;
    } else {
      y0 = 56;
      y1 = this.dock.getBoundingClientRect().top;
    }
    this.bounds = { x0, y0, x1, y1 };
    // 세로 화면은 좌상단 홈 버튼·제목 자리(y 90)를 비켜, 그 아래 영역의 가운데로 모형을 옮긴다
    const cx = (x0 + x1) / 2;
    const cy = ((portrait && W < 1100 ? 132 : y0) + y1) / 2;
    const key = `${W}x${H}:${Math.round(cx)},${Math.round(cy)}`;
    if (key === this.viewKey && W === this.lastW && H === this.lastH) return;
    this.viewKey = key;
    this.lastW = W;
    this.lastH = H;
    // 보이는 영역이 좁으면 화면을 확대해 꽉 채운다(세로 비율 기준)
    const cam = ctx.sceneMgr.camera;
    cam.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  }

  // ───────────────────────── 3D 이름표 ─────────────────────────

  private setLabels(): void {
    const m = this.model;
    const labels = this.labels;
    if (!m || !labels) return;
    this.labelSig.clear();
    this.baseText.clear();
    for (const d of m.tags()) this.baseText.set(d.key, d.label);
    const specs: LabelSpec[] = m.tags().map((def) => ({
      key: def.key,
      text: def.label,
      side: def.side ?? 'above',
      priority: def.priority ?? 1,
      at: (out) => {
        if (def.backOnly) {
          // 블록 뒤의 부품: 카메라가 엔진 뒤쪽에 있을 때만(앞에서 보면 엉뚱한 부품 위에 점이 찍힌다)
          out.copy(this.ctx!.sceneMgr.camera.position);
          m.root.worldToLocal(out);
          if (out.z > -0.2) return false;
        }
        // 움직이는 부품(피스톤·커넥팅 로드)은 매 프레임 자리를 다시 읽는다
        if (!m.tagPos(def.key, out)) out.copy(def.pos);
        out.applyMatrix4(m.root.matrixWorld);
        return true;
      }
    }));
    labels.set(specs);
  }

  /** 밸브·포트 열림/닫힘, 점화 불꽃, 피스톤 방향 — 바뀔 때만 글자·상태를 갱신 */
  private updateLabelStates(st: CycleState): void {
    const labels = this.labels;
    if (!labels) return;
    const put = (key: string, text: string, state: string | null): void => {
      const sig = `${text}|${state ?? ''}`;
      if (this.labelSig.get(key) === sig) return;
      this.labelSig.set(key, sig);
      labels.setText(key, text);
      labels.setState(key, state);
    };
    for (const k of ['intake', 'exhaust', 'transfer']) {
      const base = this.baseText.get(k);
      if (base === undefined) continue;
      const o = (st.open[k] ?? 0) > OPEN_T;
      put(k, `${base} · ${o ? '열림' : '닫힘'}`, o ? 'open' : 'closed');
    }
    const plug = this.baseText.get('plug');
    if (plug !== undefined) put('plug', st.spark ? `${plug} · 불꽃!` : plug, st.spark ? 'fire' : null);
    const piston = this.baseText.get('piston');
    if (piston !== undefined) put('piston', `${piston} ${st.dir === 'up' ? '↑' : '↓'}`, null);
  }

  // ───────────────────────── 프레임 ─────────────────────────

  update(dt: number): void {
    const m = this.model;
    if (!m) return;
    const c = m.cycle;
    const w = BASE_SPEED * this.speed * dt;
    if (this.play === 'stroke') {
      this.phi += w;
      if (this.phi >= this.playEnd) {
        this.phi = this.playEnd;
        this.play = 'idle';
      }
    } else if (this.play === 'loop') {
      this.phi = (this.phi + w) % c;
    }
    m.setPhase(this.phi);
    const st = m.state(this.phi);

    const si = this.strokeAt(this.phi);
    if (si !== this.shown && !this.quiz) {
      this.shown = si;
      this.renderGuide();
    }
    if (!this.quiz) this.refreshLive(st);
    this.strokeBtns.forEach((b, i) => {
      const p = Math.min(1, Math.max(0, (this.phi - i * 180) / 180));
      b.style.setProperty('--p', p.toFixed(3));
      b.classList.toggle('is-on', i === si);
      b.classList.toggle('is-done', p >= 0.999 && i !== si);
      if (i === si) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    if (!this.dragging) this.scrub.value = String(Math.round(this.phi));
    this.angleOut.textContent = `${Math.round(this.phi)}°`;
    this.revOut.textContent = this.kind === 'four' ? `크랭크축 ${this.phi < 360 ? 1 : 2}회전째 · 캠축 ${Math.round(this.phi / 2)}°` : '크랭크축 1회전 = 1사이클';
    this.graph?.set(this.phi);

    this.frameT += dt;
    if (this.frameT > 0.2 || window.innerWidth !== this.lastW || window.innerHeight !== this.lastH) {
      this.frameT = 0;
      this.updateFrame();
    }
    this.updateLabelStates(st);
    this.labels?.update();
  }
}
