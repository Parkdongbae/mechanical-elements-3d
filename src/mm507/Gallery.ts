// 「507 기계 운동」 갤러리 — 목록(#/mm)·상세(#/mm/<n>)·소개(#/mm/about) (작업 지시서 16 §4)

import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import { el, button, readJson, writeJson } from '../modes/dom';
import { disposeObject } from '../models/factory';
import { hasModel, listModels, loadModel } from './registry';
import type { MovementModel } from './types';
import { buildAbout, loadPreface, type PrefaceData } from './about';
import { createLabelsToggle } from '../labs/common/labels';
import { setTagsVisible } from './kit/misc';

const TOTAL = 507;
const RANGE_SIZE = 100;
const SEEN_KEY = 'mech3d-mm507-seen-v1';
const DEFAULT_VIEW: CameraView = { pos: [0, 2.1, 6.2], target: [0, 1.75, 0] };

const pad3 = (n: number): string => String(n).padStart(3, '0');
const figUrl = (n: number): string => `/mm507/fig/${pad3(n)}.png`;

interface CatalogEntry {
  n: number;
  title: string;
  cat: string;
  ko: string;
  easy: string;
  en: string;
}

const CATS: { id: string; label: string }[] = [
  { id: 'belt', label: '벨트·풀리' },
  { id: 'gear', label: '기어' },
  { id: 'ratchet', label: '래칫' },
  { id: 'cam', label: '캠' },
  { id: 'crank', label: '크랭크·링크' },
  { id: 'escapement', label: '탈진기' },
  { id: 'governor', label: '조속기' },
  { id: 'steam', label: '증기' },
  { id: 'pump', label: '펌프' },
  { id: 'tool', label: '공구·기타' }
];

function inCat(entryCat: string, id: string): boolean {
  if (id === 'all') return true;
  if (id === 'tool') return entryCat === 'tool' || entryCat === 'misc';
  return entryCat === id;
}

function parseCatalog(data: unknown): CatalogEntry[] {
  if (!Array.isArray(data)) throw new Error('mm507 catalog: 배열이 아님');
  const out: CatalogEntry[] = [];
  for (const raw of data) {
    if (typeof raw !== 'object' || raw === null) continue;
    const e = raw as Record<string, unknown>;
    if (
      typeof e.n !== 'number' ||
      typeof e.title !== 'string' ||
      typeof e.cat !== 'string' ||
      typeof e.ko !== 'string' ||
      typeof e.easy !== 'string' ||
      typeof e.en !== 'string'
    ) {
      continue;
    }
    out.push({ n: e.n, title: e.title, cat: e.cat, ko: e.ko, easy: e.easy, en: e.en });
  }
  return out;
}

let catalogCache: CatalogEntry[] | null = null;

function fetchCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache) return Promise.resolve(catalogCache);
  return fetch('/mm507/catalog.json')
    .then((res) => {
      if (!res.ok) throw new Error(`mm507 catalog: ${res.status}`);
      return res.json() as Promise<unknown>;
    })
    .then((data) => {
      const list = parseCatalog(data).sort((a, b) => a.n - b.n);
      catalogCache = list;
      return list;
    });
}

function loadSeen(): Set<number> {
  const v = readJson<unknown>(SEEN_KEY, []);
  const out = new Set<number>();
  if (Array.isArray(v)) {
    for (const x of v) if (typeof x === 'number' && x >= 1 && x <= TOTAL) out.add(x);
  }
  return out;
}

/** 홈 화면 표시용: 지금까지 본 507 운동 수 */
export function mmSeenCount(): number {
  return loadSeen().size;
}

type TabId = 'easy' | 'ko' | 'en';
const TABS: { id: TabId; label: string }[] = [
  { id: 'easy', label: '쉬운 풀이' },
  { id: 'ko', label: '책의 설명(번역)' },
  { id: 'en', label: '영어 원문' }
];

export class Gallery implements AppMode {
  private ctx: ModeContext | null = null;
  private epoch = 0;
  private wrap: HTMLElement | null = null;
  private kind: 'list' | 'detail' | 'about' = 'list';
  private cur = 1;
  private cat = 'all';
  private only3d = false;
  private range = 0;
  private tab: TabId = 'easy';
  private playing = true;
  private speed = 1;
  private reverse = false;
  private seen = new Set<number>();
  private model: MovementModel | null = null;
  private catalog: CatalogEntry[] = [];

  private gridEl: HTMLElement | null = null;
  private rangeBar: HTMLElement | null = null;
  private tabBody: HTMLElement | null = null;
  private notesEl: HTMLElement | null = null;
  private playBtn: HTMLButtonElement | null = null;
  private speedOut: HTMLElement | null = null;
  private zoomEl: HTMLElement | null = null;
  private labelsToggle: { button: HTMLButtonElement; sync(): void; dispose(): void } | null = null;
  private notesKey = '';
  private noteTimer = 0;

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (this.zoomEl) {
      this.closeZoom();
      return;
    }
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
    if (this.kind !== 'detail') return;
    if (e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'ArrowLeft') this.step(-1);
    else if (e.key === ' ') this.togglePlay();
    else return;
    e.preventDefault();
  };

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.seen = loadSeen();
    this.playing = true;
    this.speed = 1;
    this.reverse = false;
    this.cat = 'all';
    this.only3d = false;
    this.tab = 'easy';
    this.noteTimer = 0;
    this.notesKey = '';

    const p = ctx.param;
    const n = p && /^\d+$/.test(p) ? Number(p) : 0;
    if (p === 'about') this.kind = 'about';
    else if (n >= 1 && n <= TOTAL) {
      this.kind = 'detail';
      this.cur = n;
    } else this.kind = 'list';
    this.range = this.kind === 'detail' ? Math.floor((this.cur - 1) / RANGE_SIZE) : 0;
    if (this.kind === 'detail') this.markSeen(this.cur);

    // 상세 화면은 레이어 1을 켜 둔다(회전 화살표가 항상 보이게). 이름표는 setTagsVisible 이 따로 끈다
    ctx.sceneMgr.setLabelsVisible(this.kind === 'detail' ? true : ctx.settings.showLabels);

    const ep = ++this.epoch;
    if (this.kind === 'about') this.buildAboutView(ep);
    else if (this.kind === 'list') this.buildList(ep);
    else this.buildDetail(ep);
    window.addEventListener('keydown', this.onKey);
  }

  exit(): void {
    this.epoch++;
    window.removeEventListener('keydown', this.onKey);
    const ctx = this.ctx;
    this.labelsToggle?.dispose();
    this.labelsToggle = null;
    if (ctx) ctx.sceneMgr.setLabelsVisible(ctx.settings.showLabels);
    if (ctx && this.model) {
      ctx.sceneMgr.remove(this.model.group);
      disposeObject(this.model.group);
      this.model.dispose?.();
    }
    this.model = null;
    this.wrap?.remove();
    this.wrap = null;
    this.gridEl = null;
    this.rangeBar = null;
    this.tabBody = null;
    this.notesEl = null;
    this.playBtn = null;
    this.speedOut = null;
    this.zoomEl = null;
    this.ctx = null;
  }

  update(dt: number): void {
    if (this.kind === 'detail' && this.model && this.playing) {
      this.model.update(dt, this.speed * (this.reverse ? -1 : 1));
    }
    this.noteTimer += dt;
    if (this.noteTimer > 0.15) {
      this.noteTimer = 0;
      this.refreshNotes();
    }
  }

  // ───────── 공통 ─────────

  private markSeen(n: number): void {
    if (!this.seen.has(n)) {
      this.seen.add(n);
      writeJson(SEEN_KEY, [...this.seen].sort((a, b) => a - b));
    }
  }

  private go(n: number): void {
    this.ctx?.navigate?.(`mm/${n}`);
  }

  private step(d: number): void {
    const n = Math.min(TOTAL, Math.max(1, this.cur + d));
    if (n !== this.cur) this.go(n);
  }

  private flyDefault(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.sceneMgr.flyTo(this.model?.view ?? DEFAULT_VIEW, false);
  }

  private openZoom(): void {
    if (!this.wrap || this.zoomEl) return;
    const z = el('div', 'mm-zoom');
    const img = el('img', 'mm-zoom-img');
    img.src = figUrl(this.cur);
    img.alt = `${this.cur}번 원본 판화 큰 그림`;
    img.draggable = false;
    z.append(img, el('p', 'mm-zoom-cap', '닫으려면 눌러요'));
    z.addEventListener('click', () => this.closeZoom());
    this.zoomEl = z;
    this.wrap.append(z);
  }

  private closeZoom(): void {
    this.zoomEl?.remove();
    this.zoomEl = null;
  }

  // ───────── 목록 ─────────

  private buildList(ep: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const wrap = el('div', 'mm-wrap is-list');
    this.wrap = wrap;

    const top = el('header', 'mm-top');
    const head = el('div', 'mm-top-head');
    const ht = el('div', 'mm-top-t');
    ht.append(el('h2', 'mm-title', '507 기계 운동'), el('p', 'mm-sub', `1868년 책의 판화 ${TOTAL}가지 — 본 것 ${this.seen.size} / ${TOTAL}`));
    head.append(ht, button('mm-btn', '책 소개', () => ctx.navigate?.('mm/about')));
    top.append(head);

    const filters = el('div', 'mm-filters');
    for (const c of [{ id: 'all', label: '전체' }, ...CATS]) {
      const b = button(`mm-chip${c.id === 'all' ? ' is-on' : ''}`, c.label, () => {
        this.cat = c.id;
        filters.querySelectorAll('.mm-chip').forEach((x) => x.classList.toggle('is-on', x === b));
        this.renderTiles();
      });
      filters.append(b);
    }
    const only = button('mm-chip mm-only3d', '3D 있는 것만', () => {
      this.only3d = !this.only3d;
      only.classList.toggle('is-on', this.only3d);
      only.setAttribute('aria-pressed', String(this.only3d));
      this.renderTiles();
    });
    only.setAttribute('aria-pressed', 'false');
    filters.append(only);

    const jump = el('label', 'mm-jump');
    jump.append(el('span', 'mm-jump-l', '번호로 가기'));
    const input = el('input', 'mm-jump-in');
    input.type = 'number';
    input.min = '1';
    input.max = String(TOTAL);
    input.placeholder = '1–507';
    input.setAttribute('aria-label', '운동 번호로 바로 가기');
    input.addEventListener('change', () => {
      const v = Math.round(Number(input.value));
      if (v >= 1 && v <= TOTAL) this.go(v);
      input.value = '';
    });
    jump.append(input);

    const ranges = el('div', 'mm-ranges');
    ranges.setAttribute('role', 'tablist');
    ranges.setAttribute('aria-label', '번호 구간');
    this.rangeBar = ranges;
    const rangeCount = Math.ceil(TOTAL / RANGE_SIZE);
    for (let i = 0; i < rangeCount; i++) {
      const a = i * RANGE_SIZE + 1;
      const b = Math.min(TOTAL, (i + 1) * RANGE_SIZE);
      const rb = button(`mm-range${i === this.range ? ' is-on' : ''}`, `${a}–${b}`, () => {
        this.range = i;
        ranges.querySelectorAll('.mm-range').forEach((x, k) => x.classList.toggle('is-on', k === i));
        this.renderTiles();
      });
      ranges.append(rb);
    }

    const row2 = el('div', 'mm-row2');
    row2.append(ranges, jump);

    this.gridEl = el('div', 'mm-grid');
    this.gridEl.append(el('p', 'mm-loading', '목록을 불러오는 중…'));

    wrap.append(top, filters, row2, this.gridEl);
    ctx.root.append(wrap);
    this.renderTiles();

    void fetchCatalog()
      .then((list) => {
        if (ep !== this.epoch) return;
        this.catalog = list;
        this.renderTiles();
      })
      .catch(() => {
        if (ep === this.epoch) {
          this.gridEl?.replaceChildren(el('p', 'mm-loading', '목록을 불러올 수 없어요. 새로고침해 보세요.'));
        }
      });
  }

  private renderTiles(): void {
    const grid = this.gridEl;
    if (!grid) return;
    if (this.catalog.length === 0) return;
    grid.replaceChildren();
    const a = this.range * RANGE_SIZE + 1;
    const b = Math.min(TOTAL, (this.range + 1) * RANGE_SIZE);
    const list = this.catalog.filter((e) => e.n >= a && e.n <= b && inCat(e.cat, this.cat) && (!this.only3d || hasModel(e.n)));
    if (list.length === 0) {
      grid.append(el('p', 'mm-loading', '이 구간에서 조건에 맞는 운동이 없어요.'));
      return;
    }
    for (const e of list) {
      const tile = el('button', 'mm-tile');
      tile.type = 'button';
      if (this.seen.has(e.n)) tile.classList.add('is-seen');
      const img = el('img', 'mm-tile-img');
      img.src = figUrl(e.n);
      img.alt = `${e.n}번 판화 — ${e.title}`;
      img.loading = 'lazy';
      img.draggable = false;
      const body = el('span', 'mm-tile-body');
      body.append(el('span', 'mm-tile-n', String(e.n)), el('span', 'mm-tile-name', e.title));
      const foot = el('span', 'mm-tile-foot');
      if (hasModel(e.n)) foot.append(el('span', 'mm-b3d', '3D'));
      foot.append(el('span', 'mm-tile-cat', CATS.find((c) => c.id === e.cat || (c.id === 'tool' && e.cat === 'misc'))?.label ?? '공구·기타'));
      tile.append(img, body, foot);
      tile.addEventListener('click', () => this.go(e.n));
      grid.append(tile);
    }
    if (!this.rangeBar) return;
    this.rangeBar.querySelectorAll('.mm-range').forEach((x, k) => {
      x.classList.toggle('is-on', k === this.range);
      if (k === this.range) x.setAttribute('aria-current', 'true');
      else x.removeAttribute('aria-current');
    });
  }

  // ───────── 상세 ─────────

  private buildDetail(ep: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const wrap = el('div', 'mm-wrap is-detail');
    this.wrap = wrap;
    const entry = this.catalog.find((e) => e.n === this.cur) ?? null;
    if (!hasModel(this.cur)) wrap.classList.add('is-no3d');

    const fig = el('aside', 'mm-fig');
    const figImg = el('img', 'mm-fig-img');
    figImg.src = figUrl(this.cur);
    figImg.alt = `${this.cur}번 원본 판화`;
    figImg.draggable = false;
    figImg.addEventListener('click', () => this.openZoom());
    fig.append(figImg, el('p', 'mm-fig-cap', '원본 판화 — 눌러서 크게'));

    const side = el('aside', 'mm-side');
    side.dataset.open = 'true';

    const headEl = el('header', 'mm-sheet-head');
    const thumb = el('img', 'mm-thumb');
    thumb.src = figUrl(this.cur);
    thumb.alt = `${this.cur}번 판화 작은 그림`;
    thumb.draggable = false;
    thumb.addEventListener('click', () => this.openZoom());
    const ht = el('div', 'mm-sheet-t');
    this.fillHead(ht, entry);
    const fold = button('mm-fold', '접기', () => {
      const open = side.dataset.open === 'true';
      side.dataset.open = open ? 'false' : 'true';
      fold.textContent = open ? '펼치기' : '접기';
    });
    // 507 첫 화면(목록)으로 — 접힌 상태에서도 보이게 머리에 둔다
    const toList = button('mm-tolist', '☰', () => ctx.navigate?.('mm'));
    toList.append(el('span', 'mm-tolist-t', ' 목록'));
    toList.dataset.mm = 'to-list';
    toList.setAttribute('aria-label', '507 기계 운동 목록으로');
    toList.title = '507 기계 운동 첫 화면(목록)으로';
    headEl.append(thumb, ht, toList, fold);
    side.append(headEl);

    const tabs = el('div', 'mm-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '설명 보기');
    for (const t of TABS) {
      const tb = button(`mm-tab${t.id === this.tab ? ' is-on' : ''}`, t.label, () => {
        this.tab = t.id;
        this.syncTabs();
      });
      tb.setAttribute('role', 'tab');
      tb.dataset.tab = t.id;
      tabs.append(tb);
    }

    this.tabBody = el('div', 'mm-tabbody');
    this.syncTabs();
    this.notesEl = el('div', 'mm-notes');

    const nav = el('div', 'mm-nav');
    const prev = button('mm-btn', this.cur <= 1 ? '‹ 이전' : `‹ ${this.cur - 1}번`, () => this.step(-1));
    prev.disabled = this.cur <= 1;
    const next = button('mm-btn is-primary', this.cur >= TOTAL ? '다음 ›' : `${this.cur + 1}번 ›`, () => this.step(1));
    next.disabled = this.cur >= TOTAL;
    nav.append(prev, next);

    const ext = el('a', 'mm-ext', '507movements.com에서 이 운동 보기');
    ext.href = `https://507movements.com/mm_${pad3(this.cur)}.html`;
    ext.target = '_blank';
    ext.rel = 'noopener noreferrer';

    side.append(tabs, this.tabBody, this.notesEl, nav, ext);
    wrap.append(fig, side);
    ctx.root.append(wrap);

    if (hasModel(this.cur)) {
      void loadModel(this.cur)
        .then((m) => {
          if (ep !== this.epoch) {
            disposeObject(m.group);
            m.dispose?.();
            return;
          }
          this.model = m;
          ctx.sceneMgr.add(m.group);
          setTagsVisible(m.group, ctx.settings.showLabels);
          this.flyDefault();
          this.buildCtl();
          this.refreshNotes();
        })
        .catch(() => {
          if (ep === this.epoch) wrap.classList.add('is-no3d');
        });
    }

    void fetchCatalog()
      .then((list) => {
        if (ep !== this.epoch) return;
        this.catalog = list;
        this.fillDetail();
      })
      .catch(() => {
        if (ep === this.epoch) this.fillDetail();
      });
  }

  private fillHead(ht: HTMLElement, entry: CatalogEntry | null): void {
    ht.replaceChildren();
    const row = el('div', 'mm-sheet-row');
    row.append(el('span', 'mm-tile-n', `${this.cur}번`), el('span', 'mm-tile-cat', entry ? this.catLabel(entry.cat) : '…'));
    if (hasModel(this.cur)) row.append(el('span', 'mm-b3d', '3D'));
    else row.append(el('span', 'mm-wait', '3D 모형 준비 중'));
    ht.append(row, el('h2', 'mm-name', entry?.title ?? `${this.cur}번 운동`));
  }

  private catLabel(cat: string): string {
    return CATS.find((c) => c.id === cat || (c.id === 'tool' && cat === 'misc'))?.label ?? '공구·기타';
  }

  private fillDetail(): void {
    const entry = this.catalog.find((e) => e.n === this.cur) ?? null;
    const ht = this.wrap?.querySelector<HTMLElement>('.mm-sheet-t');
    if (ht) this.fillHead(ht, entry);
    this.syncTabs();
  }

  private syncTabs(): void {
    const entry = this.catalog.find((e) => e.n === this.cur) ?? null;
    this.wrap?.querySelectorAll('.mm-tab').forEach((b) => {
      const on = (b as HTMLElement).dataset.tab === this.tab;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
    const body = this.tabBody;
    if (!body) return;
    if (!entry) {
      body.textContent = '설명을 불러오는 중…';
      return;
    }
    body.textContent = this.tab === 'easy' ? entry.easy : this.tab === 'ko' ? entry.ko : entry.en;
  }

  private buildCtl(): void {
    const wrap = this.wrap;
    if (!wrap) return;
    const ctl = el('div', 'mm-ctl');
    this.playBtn = button('mm-ctl-btn is-primary', this.playing ? '정지' : '재생', () => this.togglePlay());
    const spd = el('label', 'mm-speed');
    spd.append(el('span', 'mm-speed-l', '속도'));
    const range = el('input', 'mm-speed-in');
    range.type = 'range';
    range.min = '0';
    range.max = '3';
    range.step = '0.1';
    range.value = String(this.speed);
    range.setAttribute('aria-label', '재생 속도(0~3배)');
    range.addEventListener('input', () => {
      this.speed = Math.round(Number(range.value) * 10) / 10;
      if (this.speedOut) this.speedOut.textContent = `${this.speed.toFixed(1)}×`;
    });
    this.speedOut = el('span', 'mm-speed-v', `${this.speed.toFixed(1)}×`);
    spd.append(range, this.speedOut);
    const rev = button(`mm-ctl-btn${this.reverse ? ' is-on' : ''}`, '역회전', () => {
      this.reverse = !this.reverse;
      rev.classList.toggle('is-on', this.reverse);
      rev.setAttribute('aria-pressed', String(this.reverse));
    });
    rev.setAttribute('aria-pressed', 'false');
    this.labelsToggle?.dispose();
    this.labelsToggle = null;
    const ctx = this.ctx;
    const parts: HTMLElement[] = [this.playBtn, spd, rev];
    if (ctx) {
      this.labelsToggle = createLabelsToggle(ctx, {
        syncSceneLayer: false,
        onToggle: (v) => {
          if (this.model) setTagsVisible(this.model.group, v);
        }
      });
      parts.push(this.labelsToggle.button);
    }
    parts.push(button('mm-ctl-btn', '시점 처음으로', () => this.flyDefault()));
    ctl.append(...parts);
    wrap.append(ctl);
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    if (this.playBtn) this.playBtn.textContent = this.playing ? '정지' : '재생';
  }

  private refreshNotes(): void {
    const box = this.notesEl;
    if (!box) return;
    const notes = this.model?.notes?.() ?? [];
    if (notes.length === 0) {
      if (box.childElementCount > 0) {
        box.replaceChildren();
        this.notesKey = '';
      }
      return;
    }
    const key = notes.map((x) => `${x.label}\u0001${x.value}`).join('\u0002');
    if (key === this.notesKey) return;
    this.notesKey = key;
    box.replaceChildren();
    const title = el('h3', 'mm-notes-h', '움직임 수치');
    const list = el('div', 'mm-notes-list');
    for (const nt of notes) {
      const row = el('div', 'mm-notes-row');
      row.append(el('span', 'mm-notes-l', nt.label), el('span', 'mm-notes-v', nt.value));
      list.append(row);
    }
    box.append(title, list);
  }

  // ───────── 소개 ─────────

  private buildAboutView(ep: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const wrap = el('div', 'mm-wrap is-about');
    this.wrap = wrap;
    const holder = el('div', 'mm-abouthold');
    holder.append(el('p', 'mm-loading', '불러오는 중…'));
    wrap.append(holder);
    ctx.root.append(wrap);

    void Promise.all([
      fetchCatalog().catch(() => [] as CatalogEntry[]),
      loadPreface()
    ]).then(([list, preface]: [CatalogEntry[], PrefaceData | null]) => {
      if (ep !== this.epoch) return;
      this.catalog = list;
      holder.replaceChildren(
        buildAbout(preface, listModels().length, () => this.ctx?.navigate?.('mm'))
      );
    });
  }
}
