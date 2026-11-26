// 「507 기계 운동」 갤러리 — 목록(#/mm)·상세(#/mm/<n>)·소개(#/mm/about) (작업 지시서 16 §4)

import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import { el, button, readJson, writeJson } from '../modes/dom';
import { disposeObject } from '../models/factory';
import { hasModel, listModels, loadModel } from './registry';
import type { MovementModel } from './types';
import { buildAbout, loadPreface, type PrefaceData } from './about';
import { createLabelsToggle } from '../labs/common/labels';
import { retextTags, setArrowsVisible, setTagsVisible } from './kit/misc';
import { TagLeaders } from './leaders';
import { MM_LANGS, isMmLang, loadDict, translateNote, uiText, type MmLang, type ModelDict, type UiText } from './lang';
import { guessQuality, saveSettings } from '../state/settings';
import { catTip } from './catTips';
import { ICON } from '../ui/icons';

const TOTAL = 507;
const RANGE_SIZE = 100;
const SEEN_KEY = 'mech3d-mm507-seen-v1';
const DEFAULT_VIEW: CameraView = { pos: [0, 2.1, 6.2], target: [0, 1.75, 0] };

const pad3 = (n: number): string => String(n).padStart(3, '0');
/** 폰 크기 화면(CSS 의 820px 미만 하단 시트 배치와 같은 기준) */
const isNarrow = (): boolean => typeof matchMedia === 'function' && matchMedia('(max-width: 819px)').matches;
const figUrl = (n: number): string => `/mm507/fig/${pad3(n)}.png`;

interface CatalogEntry {
  n: number;
  title: string;
  cat: string;
  ko: string;
  easy: string;
  en: string;
  /** 영문 제목(없으면 '#NNN') */
  titleEn?: string;
  /** 쉬운 설명 영어(없으면 원문 en) */
  easyEn?: string;
}

/** 분류 id — 이름은 lang.ts 의 cats */
const CATS: string[] = ['belt', 'gear', 'ratchet', 'cam', 'crank', 'escapement', 'governor', 'steam', 'pump', 'tool'];

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
    const item: CatalogEntry = { n: e.n, title: e.title, cat: e.cat, ko: e.ko, easy: e.easy, en: e.en };
    if (typeof e.titleEn === 'string' && e.titleEn.trim().length > 0) item.titleEn = e.titleEn;
    if (typeof e.easyEn === 'string' && e.easyEn.trim().length > 0) item.easyEn = e.easyEn;
    out.push(item);
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
/** 영어: 쉬운 설명·원문 / 그 밖의 언어: 쉬운 풀이·책의 설명(번역)·영어 원문 — 탭 id 'ko' 는 「책의 설명 번역」 */
function tabsFor(lang: MmLang, t: UiText): { id: TabId; label: string }[] {
  if (lang === 'en') {
    return [
      { id: 'easy', label: t.tabEasy },
      { id: 'en', label: t.tabEn }
    ];
  }
  return [
    { id: 'easy', label: t.tabEasy },
    { id: 'ko', label: t.tabKo },
    { id: 'en', label: t.tabEn }
  ];
}

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
  /** 지금 언어의 사전(ko 면 null) — buildView 가 화면을 만들기 전에 받아 둔다 */
  private dict: ModelDict | null = null;
  private dictLang: MmLang = 'ko';
  /** 이름표 지시선 — 모델이 첫 자세를 잡은 뒤(첫 update 프레임) 만든다 */
  private leaders: TagLeaders | null = null;
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

    this.buildView();
    window.addEventListener('keydown', this.onKey);
    // 개발 서버 검사용: 화살표 메시 보임 수·이름표 글자
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__mm507 = () => {
        const g = this.model?.group;
        if (!g) return null;
        let arrows = 0;
        let arrowsOn = 0;
        const tags: string[] = [];
        g.traverse((o) => {
          const mm = o.userData.mm as { kind?: unknown } | undefined;
          if (mm?.kind === 'arrow') {
            o.traverse((c) => {
              if ((c as { isMesh?: boolean }).isMesh === true) {
                arrows++;
                if (c.visible) arrowsOn++;
              }
            });
          }
          if (o.userData.mmTag === true) tags.push(String(o.userData.mmTagShown ?? o.userData.mmTagText));
        });
        return { arrows, arrowsOn, tags, leaders: this.leaders?.describe() ?? null };
      };
    }
  }

  private get lang(): MmLang {
    const v = this.ctx?.settings.mmLang;
    return isMmLang(v) ? v : 'ko';
  }

  private get t(): UiText {
    return uiText(this.lang);
  }

  /** 지금 kind 의 화면을 새로 만든다(모델이 있으면 다시 불러오지 않고 쓴다) */
  private buildView(): void {
    const ep = ++this.epoch;
    const lang = this.lang;
    if (lang === 'en' && this.tab === 'ko') this.tab = 'easy';
    // 앱 위쪽 모드 이름(main.ts 의 #mode-name)도 고른 언어로
    const modeName = document.querySelector<HTMLElement>('#mode-name');
    if (modeName) modeName.textContent = this.t.appTitle;
    const go = (): void => {
      if (ep !== this.epoch) return;
      if (this.kind === 'about') this.buildAboutView(ep);
      else if (this.kind === 'list') this.buildList(ep);
      else this.buildDetail(ep);
    };
    // 제목·쉬운 풀이·이름표가 사전에 있으므로 사전을 먼저 받는다(ko 는 사전 없음)
    if (lang === 'ko') {
      this.dict = null;
      this.dictLang = 'ko';
      go();
    } else if (this.dict && this.dictLang === lang) go();
    else
      void loadDict(lang).then((d) => {
        this.dict = d;
        this.dictLang = lang;
        go();
      });
  }

  /** 언어 바꾸기 — 설정 저장 후 화면 문구·제목·3D 이름표를 다시 그린다 */
  private setLang(lang: MmLang): void {
    const ctx = this.ctx;
    if (!ctx || lang === this.lang) return;
    ctx.settings.mmLang = lang;
    saveSettings(ctx.settings);
    this.closeZoom();
    this.labelsToggle?.dispose();
    this.labelsToggle = null;
    this.wrap?.remove();
    this.wrap = null;
    this.notesKey = '';
    this.buildView();
  }

  /** 언어 고르기(6개 언어) — 이름은 그 언어로 쓴다 */
  private langButton(): HTMLSelectElement {
    const b = el('select', 'mm-btn mm-lang');
    b.dataset.mm = 'lang-toggle';
    for (const x of MM_LANGS) {
      const o = el('option', '', `${x.short} ${x.label}`);
      o.value = x.id;
      o.lang = x.id;
      if (x.id === this.lang) o.selected = true;
      b.append(o);
    }
    b.title = this.t.langTitle;
    b.setAttribute('aria-label', this.t.langTitle);
    b.addEventListener('change', () => {
      if (isMmLang(b.value)) this.setLang(b.value);
    });
    return b;
  }

  /** 그래픽 품질 고르기(자동·높음·낮음) — 앱 설정과 같은 값(settings.quality)을 쓴다. 507 만 보는 사용자용 */
  private qualityButton(): HTMLSelectElement {
    const ctx = this.ctx;
    const [title, auto, high, low] = this.t.quality;
    const b = el('select', 'mm-btn mm-lang mm-quality');
    for (const [id, label] of [['auto', auto], ['high', high], ['low', low]] as const) {
      const o = el('option', '', label);
      o.value = id;
      if (id === (ctx?.settings.quality ?? 'auto')) o.selected = true;
      b.append(o);
    }
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('change', () => {
      if (!ctx) return;
      const v = b.value === 'high' || b.value === 'low' ? b.value : 'auto';
      ctx.settings.quality = v;
      saveSettings(ctx.settings);
      const wanted = v === 'auto' ? guessQuality() : v;
      ctx.sceneMgr.adaptive = v === 'auto';
      if (ctx.sceneMgr.getQuality() !== wanted) ctx.sceneMgr.setQuality(wanted);
    });
    return b;
  }

  private titleOf(entry: CatalogEntry | null, n: number): string {
    const lang = this.lang;
    if (lang === 'ko') return entry?.title ?? this.t.untitled(n);
    if (lang === 'en') return entry?.titleEn ?? this.t.untitled(n);
    return this.dict?.titles[String(n)] ?? entry?.titleEn ?? this.t.untitled(n);
  }

  /** 모델 그룹에 지금 설정(이름표·화살표·언어)을 입힌다 — 모델 로드 직후, 언어 전환 후 */
  private applyModelSettings(): void {
    const ctx = this.ctx;
    const m = this.model;
    if (!ctx || !m) return;
    setTagsVisible(m.group, ctx.settings.showLabels);
    setArrowsVisible(m.group, ctx.settings.showArrows);
    if (this.lang !== 'ko') {
      const lang = this.lang;
      void loadDict(lang).then((d) => {
        if (this.model !== m || this.lang !== lang) return;
        this.dict = d;
        this.dictLang = lang;
        retextTags(m.group, d.tags);
        this.notesKey = '';
        this.refreshNotes();
      });
    } else {
      retextTags(m.group, null);
    }
  }

  private paintArrows(b: HTMLButtonElement, on: boolean): void {
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? this.t.arrowsOn : this.t.arrowsOff;
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
    this.leaders?.dispose();
    this.leaders = null;
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
    if (this.kind === 'detail' && this.model && this.ctx) {
      if (!this.leaders) {
        this.leaders = new TagLeaders(this.model.group);
        this.leaders.setVisible(this.ctx.settings.showLabels);
      } else this.leaders.update();
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
    img.alt = this.t.zoomAlt(this.cur);
    img.draggable = false;
    z.append(img, el('p', 'mm-zoom-cap', this.t.zoomCap));
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
    const t = this.t;
    wrap.lang = this.lang;
    wrap.dir = this.lang === 'ar' ? 'rtl' : 'ltr';

    const top = el('header', 'mm-top');
    const head = el('div', 'mm-top-head');
    const ht = el('div', 'mm-top-t');
    ht.append(el('h2', 'mm-title', t.appTitle), el('p', 'mm-sub', t.sub(TOTAL, this.seen.size)));
    const headBtns = el('div', 'mm-top-btns');
    headBtns.append(this.langButton(), this.qualityButton(), button('mm-btn', t.about, () => ctx.navigate?.('mm/about')));
    head.append(ht, headBtns);
    top.append(head);

    const filters = el('div', 'mm-filters');
    for (const c of [{ id: 'all', label: t.all }, ...CATS.map((id) => ({ id, label: t.cats[id] ?? id }))]) {
      const b = button(`mm-chip${c.id === this.cat ? ' is-on' : ''}`, c.label, () => {
        this.cat = c.id;
        filters.querySelectorAll('.mm-chip').forEach((x) => x.classList.toggle('is-on', x === b));
        this.renderTiles();
      });
      b.title = catTip(this.lang, c.id);
      filters.append(b);
    }
    const only = button(`mm-chip mm-only3d${this.only3d ? ' is-on' : ''}`, t.only3d, () => {
      this.only3d = !this.only3d;
      only.classList.toggle('is-on', this.only3d);
      only.setAttribute('aria-pressed', String(this.only3d));
      this.renderTiles();
    });
    only.setAttribute('aria-pressed', String(this.only3d));
    only.title = catTip(this.lang, 'only3d');
    filters.append(only);

    const jump = el('label', 'mm-jump');
    jump.append(el('span', 'mm-jump-l', t.jump));
    const input = el('input', 'mm-jump-in');
    input.type = 'number';
    input.min = '1';
    input.max = String(TOTAL);
    input.placeholder = '1–507';
    input.setAttribute('aria-label', t.jumpAria);
    input.addEventListener('change', () => {
      const v = Math.round(Number(input.value));
      if (v >= 1 && v <= TOTAL) this.go(v);
      input.value = '';
    });
    jump.append(input);

    const ranges = el('div', 'mm-ranges');
    ranges.setAttribute('role', 'tablist');
    ranges.setAttribute('aria-label', t.rangeAria);
    this.rangeBar = ranges;
    const rangeCount = Math.ceil(TOTAL / RANGE_SIZE);
    for (let i = 0; i < rangeCount; i++) {
      const a = i * RANGE_SIZE + 1;
      const b = Math.min(TOTAL, (i + 1) * RANGE_SIZE);
      const rb = button(`mm-range${i === this.range && this.cat === 'all' ? ' is-on' : ''}`, `${a}–${b}`, () => {
        this.range = i;
        // 분류를 고른 채 번호 구간을 누르면 분류를 '전체'로 되돌리고 그 구간을 보인다
        if (this.cat !== 'all') {
          this.cat = 'all';
          filters.querySelectorAll('.mm-chip:not(.mm-only3d)').forEach((x, k) => x.classList.toggle('is-on', k === 0));
        }
        this.renderTiles();
      });
      ranges.append(rb);
    }

    const row2 = el('div', 'mm-row2');
    row2.append(ranges, jump);

    this.gridEl = el('div', 'mm-grid');
    this.gridEl.append(el('p', 'mm-loading', t.loadingList));

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
          this.gridEl?.replaceChildren(el('p', 'mm-loading', t.listFail));
        }
      });
  }

  private renderTiles(): void {
    const grid = this.gridEl;
    if (!grid) return;
    if (this.catalog.length === 0) return;
    grid.replaceChildren();
    // 분류를 고르면 번호 구간과 상관없이 1~507 전체에서 찾는다
    const allRange = this.cat !== 'all';
    const a = allRange ? 1 : this.range * RANGE_SIZE + 1;
    const b = allRange ? TOTAL : Math.min(TOTAL, (this.range + 1) * RANGE_SIZE);
    const list = this.catalog.filter((e) => e.n >= a && e.n <= b && inCat(e.cat, this.cat) && (!this.only3d || hasModel(e.n)));
    if (list.length === 0) {
      grid.append(el('p', 'mm-loading', this.t.emptyRange));
      return;
    }
    for (const e of list) {
      const tile = el('button', 'mm-tile');
      tile.type = 'button';
      if (this.seen.has(e.n)) tile.classList.add('is-seen');
      const img = el('img', 'mm-tile-img');
      img.src = figUrl(e.n);
      const name = this.titleOf(e, e.n);
      img.alt = this.t.figAlt(e.n, name);
      img.loading = 'lazy';
      img.draggable = false;
      const body = el('span', 'mm-tile-body');
      body.append(el('span', 'mm-tile-n', String(e.n)), el('span', 'mm-tile-name', name));
      const foot = el('span', 'mm-tile-foot');
      if (hasModel(e.n)) foot.append(el('span', 'mm-b3d', '3D'));
      foot.append(el('span', 'mm-tile-cat', this.catLabel(e.cat)));
      tile.append(img, body, foot);
      tile.addEventListener('click', () => this.go(e.n));
      grid.append(tile);
    }
    if (!this.rangeBar) return;
    this.rangeBar.querySelectorAll('.mm-range').forEach((x, k) => {
      const on = !allRange && k === this.range;
      x.classList.toggle('is-on', on);
      if (on) x.setAttribute('aria-current', 'true');
      else x.removeAttribute('aria-current');
    });
  }

  // ───────── 상세 ─────────

  private buildDetail(ep: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const wrap = el('div', 'mm-wrap is-detail');
    this.wrap = wrap;
    const t = this.t;
    wrap.lang = this.lang;
    wrap.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
    const entry = this.catalog.find((e) => e.n === this.cur) ?? null;
    if (!hasModel(this.cur)) wrap.classList.add('is-no3d');

    const fig = el('aside', 'mm-fig');
    const figImg = el('img', 'mm-fig-img');
    figImg.src = figUrl(this.cur);
    figImg.alt = t.zoomAlt(this.cur);
    figImg.draggable = false;
    figImg.addEventListener('click', () => this.openZoom());
    fig.append(figImg, el('p', 'mm-fig-cap', t.figCap));

    const side = el('aside', 'mm-side');
    // 폰(좁은 화면)에서는 설명 시트를 접어 둔 채 시작 — 3D 를 가리지 않게(사용자 요청 2026-11-25)
    const narrow = isNarrow();
    side.dataset.open = narrow ? 'false' : 'true';

    const headEl = el('header', 'mm-sheet-head');
    const thumb = el('img', 'mm-thumb');
    thumb.src = figUrl(this.cur);
    thumb.alt = t.thumbAlt(this.cur);
    thumb.draggable = false;
    thumb.addEventListener('click', () => this.openZoom());
    const ht = el('div', 'mm-sheet-t');
    this.fillHead(ht, entry);
    const fold = button('mm-fold', narrow ? t.unfold : t.fold, () => {
      const open = side.dataset.open === 'true';
      side.dataset.open = open ? 'false' : 'true';
      fold.textContent = open ? t.unfold : t.fold;
    });
    // 507 첫 화면(목록)으로 — 접힌 상태에서도 보이게 머리에 둔다
    const toList = button('mm-tolist', '☰', () => ctx.navigate?.('mm'));
    toList.append(el('span', 'mm-tolist-t', t.toList));
    toList.dataset.mm = 'to-list';
    toList.setAttribute('aria-label', t.toListAria);
    toList.title = t.toListTitle;
    const lang = this.langButton();
    lang.classList.add('mm-lang-sm');
    headEl.append(thumb, ht, lang, toList, fold);
    side.append(headEl);

    const tabs = el('div', 'mm-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', t.tabsAria);
    for (const tt of tabsFor(this.lang, t)) {
      const tb = button(`mm-tab${tt.id === this.tab ? ' is-on' : ''}`, tt.label, () => {
        this.tab = tt.id;
        this.syncTabs();
      });
      tb.setAttribute('role', 'tab');
      tb.dataset.tab = tt.id;
      tabs.append(tb);
    }

    this.tabBody = el('div', 'mm-tabbody');
    this.syncTabs();
    this.notesEl = el('div', 'mm-notes');

    const nav = el('div', 'mm-nav');
    const prev = button('mm-btn', this.cur <= 1 ? t.prev : t.prevN(this.cur - 1), () => this.step(-1));
    prev.disabled = this.cur <= 1;
    const next = button('mm-btn is-primary', this.cur >= TOTAL ? t.next : t.nextN(this.cur + 1), () => this.step(1));
    next.disabled = this.cur >= TOTAL;
    nav.append(prev, next);

    side.append(tabs, this.tabBody, this.notesEl, nav);
    wrap.append(fig, side);
    ctx.root.append(wrap);

    if (this.model) {
      // 언어 전환으로 화면만 다시 만든 경우 — 모델은 그대로 쓴다
      this.applyModelSettings();
      this.buildCtl();
      this.refreshNotes();
    } else if (hasModel(this.cur)) {
      void loadModel(this.cur)
        .then((m) => {
          if (ep !== this.epoch) {
            disposeObject(m.group);
            m.dispose?.();
            return;
          }
          this.model = m;
          ctx.sceneMgr.add(m.group);
          this.applyModelSettings();
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
    const t = this.t;
    row.append(el('span', 'mm-tile-n', t.numLabel(this.cur)), el('span', 'mm-tile-cat', entry ? this.catLabel(entry.cat) : '…'));
    if (hasModel(this.cur)) row.append(el('span', 'mm-b3d', '3D'));
    else row.append(el('span', 'mm-wait', t.wait3d));
    ht.append(row, el('h2', 'mm-name', this.titleOf(entry, this.cur)));
  }

  private catLabel(cat: string): string {
    const id = cat === 'misc' || !CATS.includes(cat) ? 'tool' : cat;
    return this.t.cats[id] ?? id;
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
      body.textContent = this.t.loadingDesc;
      return;
    }
    if (this.lang !== 'ko') {
      const key = String(this.cur);
      const own = this.lang === 'en' ? entry.easyEn : this.dict?.easy[key];
      const easy = own ?? entry.easyEn;
      // 책의 설명 번역(새 언어만) — 없으면 영어 원문
      const book = this.lang === 'en' ? undefined : this.dict?.book[key];
      if (this.tab === 'ko') {
        body.lang = book ? this.lang : 'en';
        body.textContent = book ?? entry.en;
        return;
      }
      body.lang = this.tab === 'easy' && easy === own ? this.lang : 'en';
      body.textContent = this.tab === 'easy' ? easy ?? entry.en : entry.en;
      return;
    }
    body.lang = this.tab === 'en' ? 'en' : 'ko';
    body.textContent = this.tab === 'easy' ? entry.easy : this.tab === 'ko' ? entry.ko : entry.en;
  }

  private buildCtl(): void {
    const wrap = this.wrap;
    if (!wrap) return;
    const t = this.t;
    const ctl = el('div', 'mm-ctl');
    this.playBtn = button('mm-ctl-btn is-primary', this.playing ? t.pause : t.play, () => this.togglePlay());
    const spd = el('label', 'mm-speed');
    spd.append(el('span', 'mm-speed-l', t.speed));
    const range = el('input', 'mm-speed-in');
    range.type = 'range';
    range.min = '0';
    range.max = '3';
    range.step = '0.1';
    range.value = String(this.speed);
    range.setAttribute('aria-label', t.speedAria);
    range.addEventListener('input', () => {
      this.speed = Math.round(Number(range.value) * 10) / 10;
      if (this.speedOut) this.speedOut.textContent = `${this.speed.toFixed(1)}×`;
    });
    this.speedOut = el('span', 'mm-speed-v', `${this.speed.toFixed(1)}×`);
    spd.append(range, this.speedOut);
    const rev = button(`mm-ctl-btn${this.reverse ? ' is-on' : ''}`, t.reverse, () => {
      this.reverse = !this.reverse;
      rev.classList.toggle('is-on', this.reverse);
      rev.setAttribute('aria-pressed', String(this.reverse));
    });
    rev.setAttribute('aria-pressed', String(this.reverse));
    this.labelsToggle?.dispose();
    this.labelsToggle = null;
    const ctx = this.ctx;
    const parts: HTMLElement[] = [this.playBtn, spd, rev];
    if (ctx) {
      const lb = createLabelsToggle(ctx, {
        syncSceneLayer: false,
        onToggle: (v) => {
          if (this.model) setTagsVisible(this.model.group, v);
          this.leaders?.setVisible(v);
          if (this.lang !== 'ko') lb.button.title = v ? t.labelsOn : t.labelsOff;
        }
      });
      this.labelsToggle = lb;
      if (this.lang !== 'ko') {
        const lsp = lb.button.querySelector('span');
        if (lsp) lsp.textContent = t.labels;
        lb.button.title = ctx.settings.showLabels ? t.labelsOn : t.labelsOff;
      }
      // 화살표 토글 — 이름표 버튼과 같은 모양, settings.showArrows 에 저장(번호를 옮겨도 유지)
      const ab = el('button', 'lab-tag-btn mm-arrows-btn');
      ab.type = 'button';
      ab.dataset.mm = 'arrows-toggle';
      ab.innerHTML = `${ICON.reset}<span></span>`;
      const asp = ab.querySelector('span');
      if (asp) asp.textContent = t.arrows;
      this.paintArrows(ab, ctx.settings.showArrows);
      ab.addEventListener('click', () => {
        const v = !ctx.settings.showArrows;
        ctx.settings.showArrows = v;
        saveSettings(ctx.settings);
        this.paintArrows(ab, v);
        if (this.model) setArrowsVisible(this.model.group, v);
      });
      parts.push(lb.button, ab);
    }
    parts.push(button('mm-ctl-btn', t.resetView, () => this.flyDefault()));
    // 폰에서는 조작 막대도 접어 둔다: 펼치기 버튼만 보인다(정지·속도·역회전·이름표·화살표·시점 모두 접힘)(넓은 화면에서는 펼치기 버튼이 숨는다)
    ctl.dataset.open = isNarrow() ? 'false' : 'true';
    const ctlFold = button('mm-ctl-btn mm-ctl-fold', ctl.dataset.open === 'true' ? t.fold : t.ctlMore, () => {
      const open = ctl.dataset.open === 'true';
      ctl.dataset.open = open ? 'false' : 'true';
      ctlFold.textContent = open ? t.ctlMore : t.fold;
      ctlFold.setAttribute('aria-expanded', String(!open));
    });
    ctlFold.setAttribute('aria-expanded', ctl.dataset.open);
    ctl.append(this.playBtn, ctlFold, ...parts.slice(1));
    wrap.append(ctl);
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    if (this.playBtn) this.playBtn.textContent = this.playing ? this.t.pause : this.t.play;
  }

  private refreshNotes(): void {
    const box = this.notesEl;
    if (!box) return;
    const raw = this.model?.notes?.() ?? [];
    const d = this.lang !== 'ko' ? this.dict : null;
    const notes = d ? raw.map((x) => translateNote(x, d)) : raw;
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
    const title = el('h3', 'mm-notes-h', this.t.notesTitle);
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
    wrap.lang = this.lang;
    wrap.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
    const holder = el('div', 'mm-abouthold');
    holder.append(el('p', 'mm-loading', this.t.loading));
    wrap.append(holder);
    ctx.root.append(wrap);

    void Promise.all([
      fetchCatalog().catch(() => [] as CatalogEntry[]),
      loadPreface()
    ]).then(([list, preface]: [CatalogEntry[], PrefaceData | null]) => {
      if (ep !== this.epoch) return;
      this.catalog = list;
      holder.replaceChildren(
        buildAbout(preface, listModels().length, () => this.ctx?.navigate?.('mm'), this.lang, this.langButton())
      );
    });
  }
}
