// 링크 장치 실험 — 화면(DOM) 구성. 넓은 화면은 왼쪽 목록·오른쪽 숫자판·아래 조작 막대, 좁은 화면은 하단 시트(탭 3개).
// 동작은 Linkage.ts가 정한다. 여기서는 DOM을 만들고 값을 채우는 일만 한다.

import type { GrashofResult, MechanismDef, Readout, Role } from './types';
import { el, button } from '../../modes/dom';
import type { Graph } from './graph';

export type ToggleKey = 'trace' | 'full' | 'label' | 'tilt';
export type TabKey = 'list' | 'nums' | 'uses';

export interface CustomDims {
  a: number;
  b: number;
  c: number;
  d: number;
  u: number;
  v: number;
}

export const DEFAULT_DIMS: CustomDims = { a: 3, b: 9, c: 7, d: 10, u: 4.5, v: 3 };

export const PRESETS: { name: string; a: number; b: number; c: number; d: number }[] = [
  { name: '크랭크-로커', a: 3, b: 9, c: 7, d: 10 },
  { name: '이중 크랭크', a: 5, b: 6, c: 7, d: 3 },
  { name: '이중 로커', a: 7, b: 3, c: 6, d: 8 },
  { name: '평행 크랭크', a: 3, b: 8, c: 3, d: 8 },
  { name: '조건 불만족', a: 5, b: 4, c: 6, d: 10 },
  { name: '조립 불가', a: 2, b: 3, c: 3, d: 10 }
];

export interface LinkHandlers {
  select(id: string): void;
  togglePlay(): void;
  reverse(): void;
  speed(rpm: number): void;
  scrub(value: number): void;
  shape(i: number): void;
  toggle(key: ToggleKey, on: boolean): void;
  clearTrace(): void;
  reset(): void;
  highlight(role: Role | null): void;
  custom(d: CustomDims): void;
  tab(t: TabKey): void;
}

export interface ScrubCfg {
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.6v13H7zM13.4 5.5H17v13h-3.6z" fill="currentColor"/></svg>';
const ICON_REV =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h14M14 5l4 4-4 4"/><path d="M20 16H6M10 12l-4 4 4 4"/></svg>';

function icon(svg: string): HTMLSpanElement {
  const s = el('span', 'lk-ico');
  s.innerHTML = svg; // 코드 안의 고정 SVG 문자열만 넣는다
  return s;
}

const num = (v: number): string => String(Number(v.toFixed(2)));

const ROLE_ROWS: { role: Role; name: string; desc: string; dot: string }[] = [
  { role: 'input', name: '구동 링크', desc: '힘을 넣는 링크', dot: 'is-input' },
  { role: 'output', name: '따라 움직이는 링크', desc: '그 결과로 움직이는 링크', dot: 'is-output' },
  { role: 'coupler', name: '커플러(연결 링크)', desc: '움직이는 두 링크를 이어 줘요', dot: 'is-coupler' },
  { role: 'ground', name: '고정 링크', desc: '움직이지 않는 틀·받침', dot: 'is-ground' }
];

export class LinkPanel {
  readonly wrap: HTMLElement;
  private tagLayer: HTMLElement;
  private topChip: HTMLElement;
  private dock: HTMLElement;
  private ctl: HTMLElement;
  private listPane: HTMLElement;
  private side: HTMLElement;
  private listEl: HTMLElement;
  private items = new Map<string, HTMLButtonElement>();
  private tabBtns: HTMLButtonElement[] = [];
  private nameEl: HTMLElement;
  private howEl: HTMLElement;
  private infoName: HTMLElement;
  private infoLine: HTMLElement;
  private infoHow: HTMLElement;
  private warnEl: HTMLElement;
  private readsEl: HTMLElement;
  private readKeys = '';
  private readCells = new Map<string, { v: HTMLElement; b: HTMLElement | null }>();
  private graphSlot: HTMLElement;
  private usesEl: HTMLElement;
  private watchEl: HTMLElement;
  private customEl: HTMLElement;
  private playBtn: HTMLButtonElement;
  private revBtn: HTMLButtonElement;
  private scrub: HTMLInputElement;
  private scrubLabel: HTMLElement;
  private scrubVal: HTMLElement;
  private shapeRow: HTMLElement;
  private shapeBtns: HTMLButtonElement[] = [];
  private speeds: { in: HTMLInputElement; val: HTMLElement; label: HTMLElement }[] = [];
  private toggles = new Map<ToggleKey, HTMLButtonElement>();
  private legend = new Map<Role, HTMLButtonElement>();
  private pinned: Role | null = null;
  private sliders = new Map<keyof CustomDims, { in: HTMLInputElement; out: HTMLElement }>();
  private presetBtns: HTMLButtonElement[] = [];
  private gBars!: HTMLElement;
  private gFormula!: HTMLElement;
  private gBadge!: HTMLElement;
  private gNote!: HTMLElement;
  private dims: CustomDims = { ...DEFAULT_DIMS };
  private scrubbing = false;
  private lastScrubText = '';

  constructor(root: HTMLElement, private h: LinkHandlers, defs: MechanismDef[], makeIcon: (d: MechanismDef) => SVGElement, graph: Graph) {
    const wrap = el('div', 'lk-wrap');
    wrap.dataset.tab = 'list';
    this.wrap = wrap;
    this.tagLayer = el('div', 'lk-tags');
    this.tagLayer.setAttribute('aria-hidden', 'true');
    this.topChip = el('div', 'lk-topchip', '위에서 본 그림이에요');
    this.topChip.hidden = true;
    this.dock = el('div', 'lk-dock');

    // ── 조작 막대
    this.ctl = el('section', 'lk-ctl lk-panel');
    this.ctl.setAttribute('aria-label', '작동 조작');
    const main = el('div', 'lk-ctl-main');
    this.playBtn = el('button', 'lk-btn lk-play');
    this.playBtn.type = 'button';
    this.playBtn.dataset.lk = 'play';
    this.playBtn.addEventListener('click', () => h.togglePlay());
    this.revBtn = el('button', 'lk-btn lk-rev');
    this.revBtn.type = 'button';
    this.revBtn.dataset.lk = 'reverse';
    this.revBtn.setAttribute('aria-label', '방향 바꾸기');
    this.revBtn.append(icon(ICON_REV), el('span', 'lk-btn-t', '방향 바꾸기'));
    this.revBtn.addEventListener('click', () => h.reverse());

    const sg = el('div', 'lk-scrub');
    this.shapeRow = el('div', 'lk-shapes');
    this.shapeRow.hidden = true;
    this.shapeRow.setAttribute('role', 'radiogroup');
    this.shapeRow.setAttribute('aria-label', '따라 그릴 도형');
    const top = el('div', 'lk-scrub-top');
    this.scrubLabel = el('span', 'lk-scrub-l', '입력');
    this.scrubVal = el('span', 'lk-scrub-v', '');
    top.append(this.shapeRow, this.scrubLabel, this.scrubVal);
    this.scrub = el('input', 'lk-range');
    this.scrub.type = 'range';
    this.scrub.dataset.lk = 'scrub';
    this.scrub.addEventListener('input', () => h.scrub(Number(this.scrub.value)));
    this.scrub.addEventListener('pointerdown', () => (this.scrubbing = true));
    window.addEventListener('pointerup', this.onScrubUp);
    window.addEventListener('pointercancel', this.onScrubUp);
    sg.append(top, this.scrub);
    main.append(this.playBtn, this.revBtn, sg);

    const more = el('div', 'lk-ctl-more');
    // 빠르기 슬라이더: 넓은 화면은 윗줄, 좁은 화면은 칩 줄에 보인다(둘은 늘 같은 값)
    main.insertBefore(this.makeSpeed('lk-speed-main'), sg);
    more.append(this.makeSpeed('lk-speed-more'));
    const chips = el('div', 'lk-chips');
    const tdefs: [ToggleKey, string][] = [
      ['trace', '자취'],
      ['full', '전체 경로'],
      ['label', '이름표'],
      ['tilt', '3D로 보기']
    ];
    for (const [k, t] of tdefs) {
      const b = el('button', 'lk-chip');
      b.type = 'button';
      b.textContent = t;
      b.dataset.lk = `toggle-${k}`;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => h.toggle(k, b.getAttribute('aria-pressed') !== 'true'));
      this.toggles.set(k, b);
      chips.append(b);
    }
    const clr = button('lk-chip lk-chip-act', '자취 지우기', () => h.clearTrace());
    clr.dataset.lk = 'clear';
    const rst = button('lk-chip lk-chip-act', '처음으로', () => h.reset());
    rst.dataset.lk = 'reset';
    chips.append(clr, rst);
    more.append(chips);
    this.ctl.append(main, more);

    // ── 좁은 화면 탭
    const tabs = el('div', 'lk-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [k, t] of [['list', '기구'], ['nums', '숫자'], ['uses', '쓰임새']] as const) {
      const b = el('button', 'lk-tab');
      b.type = 'button';
      b.textContent = t;
      b.dataset.lk = `tab-${k}`;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => h.tab(k));
      this.tabBtns.push(b);
      tabs.append(b);
    }

    // ── 왼쪽: 기구 목록
    this.listPane = el('section', 'lk-list lk-pane lk-panel');
    this.listPane.dataset.pane = 'list';
    this.listPane.setAttribute('aria-label', '링크 장치 고르기');
    this.listEl = el('div', 'lk-items');
    this.listEl.setAttribute('role', 'listbox');
    this.listEl.setAttribute('aria-label', '링크 장치 목록');
    for (const d of defs) {
      const b = el('button', 'lk-item');
      b.type = 'button';
      b.dataset.lkId = d.id;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      b.tabIndex = -1;
      const ic = el('span', 'lk-item-ic');
      ic.append(makeIcon(d));
      const tx = el('span', 'lk-item-tx');
      tx.append(el('strong', 'lk-item-n', d.name), el('small', 'lk-item-d', d.oneLine));
      b.append(ic, tx);
      b.addEventListener('click', () => h.select(d.id));
      this.items.set(d.id, b);
      this.listEl.append(b);
    }
    this.listEl.addEventListener('keydown', this.onListKey);
    const info = el('div', 'lk-info');
    this.infoName = el('h2', 'lk-info-n');
    this.infoLine = el('p', 'lk-info-l');
    this.infoHow = el('p', 'lk-how');
    info.append(this.infoName, this.infoLine, this.infoHow);
    const head = el('h3', 'lk-h3', '링크 장치 고르기');
    this.listPane.append(head, this.listEl, info);

    // ── 오른쪽: 숫자판 + 쓰임새
    this.side = el('div', 'lk-side');
    const nums = el('section', 'lk-nums lk-pane lk-panel');
    nums.dataset.pane = 'nums';
    this.nameEl = el('h2', 'lk-name');
    this.howEl = el('p', 'lk-how lk-how-wide');
    this.warnEl = el('p', 'lk-warn');
    this.warnEl.setAttribute('role', 'status');
    this.warnEl.setAttribute('aria-live', 'polite');
    this.warnEl.hidden = true;
    this.customEl = this.buildCustom();
    this.customEl.hidden = true;
    this.readsEl = el('ul', 'lk-reads');
    this.graphSlot = el('div', 'lk-graph-box');
    this.graphSlot.append(graph.el);
    nums.append(this.nameEl, this.howEl, this.warnEl, this.customEl, this.readsEl, this.graphSlot);

    const uses = el('section', 'lk-uses lk-pane lk-panel');
    uses.dataset.pane = 'uses';
    uses.append(el('h3', 'lk-h3', '어디에 쓰일까?'));
    this.usesEl = el('ul', 'lk-uselist');
    this.watchEl = el('p', 'lk-watch');
    uses.append(this.usesEl, this.watchEl, this.buildLegend());
    this.side.append(nums, uses);

    this.dock.append(this.ctl, tabs, this.listPane, this.side);
    wrap.append(this.tagLayer, this.topChip, this.dock);
    root.append(wrap);
  }

  dispose(): void {
    window.removeEventListener('pointerup', this.onScrubUp);
    window.removeEventListener('pointercancel', this.onScrubUp);
    this.listEl.removeEventListener('keydown', this.onListKey);
    this.wrap.remove();
    this.items.clear();
    this.toggles.clear();
    this.legend.clear();
    this.sliders.clear();
    this.readCells.clear();
  }

  private makeSpeed(extra: string): HTMLElement {
    const sp = el('label', `lk-speed ${extra}`);
    const top = el('span', 'lk-speed-top');
    const label = el('span', 'lk-speed-l', '빠르기');
    const val = el('span', 'lk-speed-v', '');
    top.append(label, val);
    const inp = el('input', 'lk-range');
    inp.type = 'range';
    inp.min = '2';
    inp.max = '30';
    inp.step = '1';
    inp.value = '10';
    inp.dataset.lk = 'speed';
    inp.setAttribute('aria-label', '빠르기(분당 회수)');
    inp.addEventListener('input', () => this.h.speed(Number(inp.value)));
    sp.append(top, inp);
    this.speeds.push({ in: inp, val, label });
    return sp;
  }

  private onScrubUp = (): void => {
    this.scrubbing = false;
  };

  private onListKey = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    const ids = [...this.items.keys()];
    const cur = ids.findIndex((id) => this.items.get(id) === document.activeElement);
    if (cur < 0) return;
    let n = cur;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = Math.min(ids.length - 1, cur + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = Math.max(0, cur - 1);
    else if (e.key === 'Home') n = 0;
    else n = ids.length - 1;
    e.preventDefault();
    const id = ids[n]!;
    this.h.select(id);
    this.items.get(id)?.focus();
  };

  // ───────────── 직접 만들기 영역 ─────────────

  private buildCustom(): HTMLElement {
    const c = el('div', 'lk-custom');
    const g = el('div', 'lk-sliders');
    const defs: { k: keyof CustomDims; name: string; min: number; max: number }[] = [
      { k: 'a', name: '구동 링크 a', min: 1, max: 12 },
      { k: 'b', name: '커플러 b', min: 1, max: 12 },
      { k: 'c', name: '따라 움직이는 링크 c', min: 1, max: 12 },
      { k: 'd', name: '고정 링크 d', min: 1, max: 12 },
      { k: 'u', name: '커플러 점: 따라 u', min: 0, max: 9 },
      { k: 'v', name: '커플러 점: 옆으로 v', min: -6, max: 6 }
    ];
    for (const s of defs) {
      const lab = el('label', 'lk-slider');
      const top = el('span', 'lk-slider-top');
      const out = el('span', 'lk-slider-v');
      top.append(el('span', 'lk-slider-l', s.name), out);
      const inp = el('input', 'lk-range');
      inp.type = 'range';
      inp.min = String(s.min);
      inp.max = String(s.max);
      inp.step = '0.5';
      inp.dataset.lk = `dim-${s.k}`;
      inp.setAttribute('aria-label', `${s.name} (cm)`);
      inp.addEventListener('input', () => {
        this.dims[s.k] = Number(inp.value);
        this.syncSliders();
        this.h.custom({ ...this.dims });
      });
      lab.append(top, inp);
      g.append(lab);
      this.sliders.set(s.k, { in: inp, out });
    }
    const pre = el('div', 'lk-presets');
    pre.setAttribute('role', 'group');
    pre.setAttribute('aria-label', '미리 만든 링크 장치');
    for (const p of PRESETS) {
      const b = el('button', 'lk-chip lk-preset');
      b.type = 'button';
      b.dataset.lk = 'preset';
      b.append(el('strong', undefined, p.name), el('small', undefined, `${p.a}·${p.b}·${p.c}·${p.d}`));
      b.addEventListener('click', () => {
        this.dims = { ...this.dims, a: p.a, b: p.b, c: p.c, d: p.d };
        this.syncSliders();
        this.h.custom({ ...this.dims });
      });
      this.presetBtns.push(b);
      pre.append(b);
    }
    const gr = el('div', 'lk-grashof');
    gr.append(el('h3', 'lk-h3', '그라스호프 조건'));
    gr.append(el('p', 'lk-gdef', '가장 짧은 링크 + 가장 긴 링크 ≤ 나머지 두 링크의 합이면, 짧은 링크 쪽이 한 바퀴 돌 수 있어요.'));
    this.gBars = el('div', 'lk-gbars');
    this.gFormula = el('p', 'lk-gformula');
    this.gBadge = el('p', 'lk-badge');
    this.gNote = el('p', 'lk-gnote');
    gr.append(this.gBars, this.gFormula, this.gBadge, this.gNote, el('p', 'lk-gnote', '가장 짧은 링크가 구동 링크면 크랭크-로커, 고정 링크면 이중 크랭크, 커플러면 이중 로커예요.'));
    c.append(gr, pre, g);
    return c;
  }

  private syncSliders(): void {
    const d = this.dims;
    const b = this.sliders.get('u');
    if (b) {
      b.in.max = String(d.b);
      if (d.u > d.b) d.u = d.b;
    }
    for (const [k, s] of this.sliders) {
      if (document.activeElement !== s.in || s.in.value !== String(d[k])) s.in.value = String(d[k]);
      s.out.textContent = `${num(d[k])} cm`;
    }
    this.presetBtns.forEach((b2, i) => {
      const p = PRESETS[i]!;
      b2.classList.toggle('is-on', p.a === d.a && p.b === d.b && p.c === d.c && p.d === d.d);
    });
  }

  setDims(d: CustomDims): void {
    this.dims = { ...d };
    this.syncSliders();
  }

  /** 그라스호프 식을 지금 숫자로 — 막대 2개와 식, 판정 배지 */
  setGrashof(g: GrashofResult | null): void {
    this.gBars.replaceChildren();
    if (!g) {
      this.gFormula.textContent = '';
      this.gBadge.textContent = '';
      this.gNote.textContent = '';
      return;
    }
    const impossible = g.kind === 'impossible';
    const rowA = impossible ? [g.l] : [g.s, g.l];
    const rowB = impossible ? [g.s, g.p, g.q] : [g.p, g.q];
    const labA = impossible ? '가장 긴 링크 l' : '가장 짧은 링크 s + 가장 긴 링크 l';
    const labB = impossible ? '나머지 셋의 합 s + p + q' : '나머지 두 링크 p + q';
    const sumA = rowA.reduce((x, y) => x + y, 0);
    const sumB = rowB.reduce((x, y) => x + y, 0);
    const max = Math.max(sumA, sumB, 1e-9);
    const mk = (lab: string, row: number[], total: number): HTMLElement => {
      const r = el('div', 'lk-gbar-row');
      r.append(el('span', 'lk-gbar-l', lab));
      const bar = el('div', 'lk-gbar');
      row.forEach((v, i) => {
        const seg = el('span', `lk-gseg is-${i % 2 === 0 ? 'a' : 'b'}`, num(v));
        seg.style.width = `${(v / max) * 100}%`;
        bar.append(seg);
      });
      r.append(bar, el('span', 'lk-gbar-s', `= ${num(total)}`));
      return r;
    };
    this.gBars.append(mk(labA, rowA, sumA), mk(labB, rowB, sumB));

    let formula: string;
    let verdict: string;
    if (impossible) {
      formula = `${num(g.l)} ≥ ${num(g.s)} + ${num(g.p)} + ${num(g.q)}`;
      verdict = '조립 불가';
    } else {
      const sl = g.s + g.l;
      const pq = g.p + g.q;
      const eq = Math.abs(sl - pq) < 1e-9;
      const rel = eq ? '=' : sl < pq ? '≤' : '>';
      formula = `${num(g.s)} + ${num(g.l)} = ${num(sl)} ${rel} ${num(g.p)} + ${num(g.q)} = ${num(pq)}`;
      verdict = eq ? '경계' : sl < pq ? '만족' : '불만족';
    }
    this.gFormula.textContent = `${formula} → ${verdict}`;
    this.gBadge.textContent = g.label;
    this.gBadge.className = `lk-badge ${impossible ? 'is-bad' : g.kind === 'non-grashof' ? 'is-mid' : 'is-ok'}`;
    this.gNote.textContent = impossible ? '가장 긴 링크가 나머지 셋을 합친 것보다 길어서(또는 같아서) 이을 수 없어요.' : g.note;
  }

  // ───────────── 범례 ─────────────

  private buildLegend(): HTMLElement {
    const box = el('div', 'lk-legend');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', '링크 역할 — 누르면 그 링크만 또렷해져요');
    for (const r of ROLE_ROWS) {
      const b = el('button', 'lk-legend-i');
      b.type = 'button';
      b.dataset.role = r.role;
      b.setAttribute('aria-pressed', 'false');
      const tx = el('span', 'lk-legend-tx');
      tx.append(el('strong', undefined, r.name), el('small', undefined, r.desc));
      b.append(el('span', `lk-dot ${r.dot}`), tx);
      b.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse' && this.pinned === null) this.h.highlight(r.role);
      });
      b.addEventListener('pointerleave', () => {
        if (this.pinned === null) this.h.highlight(null);
      });
      b.addEventListener('focus', () => {
        if (this.pinned === null) this.h.highlight(r.role);
      });
      b.addEventListener('blur', () => {
        if (this.pinned === null) this.h.highlight(null);
      });
      b.addEventListener('click', () => {
        this.pinned = this.pinned === r.role ? null : r.role;
        for (const [k, bb] of this.legend) bb.setAttribute('aria-pressed', String(k === this.pinned));
        this.h.highlight(this.pinned);
      });
      this.legend.set(r.role, b);
      box.append(b);
    }
    return box;
  }

  clearPin(): void {
    this.pinned = null;
    for (const bb of this.legend.values()) bb.setAttribute('aria-pressed', 'false');
    this.h.highlight(null);
  }

  // ───────────── 값 채우기 ─────────────

  setCurrent(def: MechanismDef, custom: boolean): void {
    for (const [id, b] of this.items) {
      const on = id === def.id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) this.revealItem(b);
    }
    this.nameEl.textContent = def.name;
    this.howEl.textContent = def.how.join(' ');
    this.infoName.textContent = def.name;
    this.infoLine.textContent = def.oneLine;
    this.infoHow.textContent = def.how.join(' ');
    this.usesEl.replaceChildren(...def.uses.map((u) => el('li', undefined, u)));
    this.watchEl.replaceChildren(el('strong', undefined, '이것을 눈여겨봐요  '), document.createTextNode(def.watch));
    this.topChip.hidden = !def.topView;
    this.customEl.hidden = !custom;
    this.wrap.dataset.custom = custom ? '1' : '0';
    this.readKeys = '';
    if (custom) this.syncSliders();
  }

  /** 고른 카드가 목록 안에서 보이게(페이지는 건드리지 않고 목록만 민다) */
  private revealItem(b: HTMLElement): void {
    const r = b.getBoundingClientRect();
    if (r.width === 0) return;
    const pane = this.listPane;
    const pr = pane.getBoundingClientRect();
    if (r.top < pr.top) pane.scrollTop -= pr.top - r.top + 8;
    else if (r.bottom > pr.bottom) pane.scrollTop += r.bottom - pr.bottom + 8;
    const lr = this.listEl.getBoundingClientRect();
    if (r.left < lr.left) this.listEl.scrollLeft -= lr.left - r.left + 8;
    else if (r.right > lr.right) this.listEl.scrollLeft += r.right - lr.right + 8;
  }

  setReadouts(list: Readout[]): void {
    const keys = list.map((r) => r.key).join('|');
    if (keys !== this.readKeys) {
      this.readKeys = keys;
      this.readsEl.replaceChildren();
      this.readCells.clear();
      for (const r of list) {
        const li = el('li', 'lk-read');
        const top = el('div', 'lk-read-top');
        const v = el('strong', 'lk-read-v');
        top.append(el('span', 'lk-read-l', r.label), v);
        li.append(top);
        let b: HTMLElement | null = null;
        if (r.basis !== undefined) {
          b = el('small', 'lk-read-b');
          li.append(b);
        }
        this.readCells.set(r.key, { v, b });
        this.readsEl.append(li);
      }
    }
    for (const r of list) {
      const c = this.readCells.get(r.key);
      if (!c) continue;
      if (c.v.textContent !== r.value) {
        c.v.textContent = r.value;
        c.v.parentElement?.classList.toggle('is-long', r.value.length > 14);
      }
      if (c.b && c.b.textContent !== (r.basis ?? '')) c.b.textContent = r.basis ?? '';
    }
  }

  setWarn(text: string | null, tone: 'warn' | 'info' = 'warn'): void {
    if (text === null) {
      if (!this.warnEl.hidden) {
        this.warnEl.hidden = true;
        this.warnEl.textContent = '';
      }
      return;
    }
    if (this.warnEl.textContent !== text) this.warnEl.textContent = text;
    this.warnEl.className = `lk-warn is-${tone}`;
    this.warnEl.hidden = false;
  }

  setGraphVisible(on: boolean): void {
    this.graphSlot.hidden = !on;
  }

  setPlaying(on: boolean, canPlay: boolean): void {
    this.playBtn.replaceChildren(icon(on ? ICON_PAUSE : ICON_PLAY), el('span', 'lk-btn-t', on ? '멈춤' : '재생'));
    this.playBtn.setAttribute('aria-label', on ? '멈춤' : '재생');
    this.playBtn.classList.toggle('is-on', on);
    this.playBtn.disabled = !canPlay;
    this.revBtn.disabled = !canPlay;
  }

  setReversed(rev: boolean): void {
    this.revBtn.setAttribute('aria-pressed', String(rev));
    this.revBtn.classList.toggle('is-on', rev);
  }

  setSpeed(rpm: number, osc: boolean): void {
    for (const sp of this.speeds) {
      sp.in.value = String(rpm);
      sp.label.textContent = osc ? '빠르기(왕복)' : '빠르기';
      sp.val.textContent = `분당 ${rpm}회`;
    }
  }

  setToggle(k: ToggleKey, on: boolean): void {
    this.toggles.get(k)?.setAttribute('aria-pressed', String(on));
  }

  /** 입력 스크러버 설정 — 팬터그래프는 도형 선택 칩도 함께 */
  config(cfg: ScrubCfg, shapes: string[] | null, shapeSel: number, disabled: boolean): void {
    this.scrub.min = String(cfg.min);
    this.scrub.max = String(cfg.max);
    this.scrub.step = String(cfg.step);
    this.scrub.disabled = disabled;
    this.scrub.setAttribute('aria-label', cfg.label);
    this.scrubLabel.textContent = cfg.label;
    this.lastScrubText = '';
    this.shapeRow.replaceChildren();
    this.shapeBtns = [];
    this.shapeRow.hidden = !shapes;
    this.wrap.classList.toggle('has-shapes', !!shapes);
    if (shapes) {
      shapes.forEach((n, i) => {
        const b = el('button', 'lk-chip lk-shape');
        b.type = 'button';
        b.textContent = n;
        b.dataset.lk = 'shape';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(i === shapeSel));
        b.addEventListener('click', () => this.h.shape(i));
        this.shapeBtns.push(b);
        this.shapeRow.append(b);
      });
    }
  }

  setShapeSel(i: number): void {
    this.shapeBtns.forEach((b, k) => b.setAttribute('aria-checked', String(k === i)));
  }

  setScrub(value: number, text: string): void {
    if (!this.scrubbing && document.activeElement !== this.scrub) {
      const v = String(value);
      if (this.scrub.value !== v) this.scrub.value = v;
    }
    if (text !== this.lastScrubText) {
      this.lastScrubText = text;
      this.scrubVal.textContent = text;
    }
  }

  setTab(t: TabKey): void {
    this.wrap.dataset.tab = t;
    const order: TabKey[] = ['list', 'nums', 'uses'];
    this.tabBtns.forEach((b, i) => {
      const on = order[i] === t;
      b.setAttribute('aria-selected', String(on));
      b.classList.toggle('is-on', on);
    });
  }

  narrow(): boolean {
    return window.innerWidth < 820;
  }

  /** 3D가 보이는 화면 영역(패널에 가리지 않는 곳) */
  region(): Region {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (this.narrow()) return { x0: 0, y0: 56, x1: W, y1: Math.max(120, this.dock.getBoundingClientRect().top) };
    const x0 = this.listPane.getBoundingClientRect().right;
    const x1 = this.side.getBoundingClientRect().left;
    const y1 = this.ctl.getBoundingClientRect().top;
    return { x0: Math.min(x0, W * 0.45), y0: 0, x1: Math.max(x1, W * 0.55), y1: Math.max(160, Math.min(y1, H)) };
  }

  get tags(): HTMLElement {
    return this.tagLayer;
  }
}
