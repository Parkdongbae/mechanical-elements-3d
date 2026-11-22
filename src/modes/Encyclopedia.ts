// 기계요소 도감 — 22종 부품을 하나씩 크게 돌려 보며 분류·역할·쓰임새를 익히는 학습 모드

import type { AppMode, ModeContext } from './types';
import { PartStage } from './PartStage';
import { el, button, readJson, writeJson } from './dom';
import { CATEGORIES, PARTS, getCategory, type CategoryId, type PartDef } from '../data/elements';
import { ENCYCLOPEDIA } from '../data/encyclopedia';
import { MACHINES } from '../data/machines';

const SEEN_KEY = 'mech3d-seen-v1';

function loadSeen(): string[] {
  const v = readJson<unknown>(SEEN_KEY, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && PARTS.some((p) => p.id === x)) : [];
}

/** 홈 화면 표시용: 지금까지 본 부품 수 */
export function getSeenCount(): number {
  return loadSeen().length;
}

export class Encyclopedia implements AppMode {
  private ctx: ModeContext | null = null;
  private stage: PartStage | null = null;
  private wrap: HTMLElement | null = null;
  private seen = new Set<string>();
  private index = 0;
  private cat: CategoryId = 'joining';
  private narrow = false;

  private tabEls = new Map<CategoryId, HTMLButtonElement>();
  private listEl!: HTMLElement;
  private itemEls = new Map<string, HTMLButtonElement>();
  private infoEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private progressEls: HTMLElement[] = [];
  private toggleBtn!: HTMLButtonElement;
  private mql: MediaQueryList | null = null;

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'ArrowLeft') this.step(-1);
    else return;
    e.preventDefault();
  };
  private onMq = (): void => {
    const n = this.mql?.matches ?? false;
    if (n === this.narrow) return;
    this.narrow = n;
    this.infoEl.dataset.open = n ? 'false' : 'true';
    this.syncToggle();
    this.stage?.flyToDefault();
  };

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.seen = new Set(loadSeen());
    this.mql = window.matchMedia('(max-width: 819px)');
    this.narrow = this.mql.matches;
    this.stage = new PartStage(ctx.sceneMgr);
    this.stage.flyToDefault();
    this.build(ctx.root);
    this.select(0, false);
    window.addEventListener('keydown', this.onKey);
    this.mql.addEventListener('change', this.onMq);
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.mql?.removeEventListener('change', this.onMq);
    this.mql = null;
    this.stage?.dispose();
    this.stage = null;
    this.wrap?.remove();
    this.wrap = null;
    this.tabEls.clear();
    this.itemEls.clear();
    this.progressEls = [];
    this.ctx = null;
  }

  update(dt: number): void {
    this.stage?.update(dt);
  }

  // ───────── DOM ─────────

  private build(root: HTMLElement): void {
    const wrap = el('div', 'enc-wrap');
    this.wrap = wrap;

    // 목록 패널
    const left = el('aside', 'enc-panel enc-list-panel');
    left.setAttribute('aria-label', '부품 목록');
    const head = el('div', 'enc-list-head');
    head.append(el('h2', 'enc-title', '기계요소 도감'));
    const prog = el('span', 'enc-progress');
    this.progressEls.push(prog);
    head.append(prog);
    left.append(head);

    const tabs = el('div', 'enc-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const c of CATEGORIES) {
      const t = el('button', 'enc-tab');
      t.type = 'button';
      t.setAttribute('role', 'tab');
      t.style.setProperty('--c', `var(--cat-${c.id})`);
      t.append(el('span', 'enc-dot'), el('span', 'enc-tab-label', c.name));
      t.addEventListener('click', () => this.setCategory(c.id, true));
      this.tabEls.set(c.id, t);
      tabs.append(t);
    }
    left.append(tabs);

    this.listEl = el('div', 'enc-list');
    left.append(this.listEl);
    for (const p of PARTS) {
      const b = el('button', 'enc-item');
      b.type = 'button';
      b.style.setProperty('--c', `var(--cat-${p.category})`);
      const img = el('img', 'enc-thumb');
      img.alt = '';
      img.width = 48;
      img.height = 48;
      img.src = this.ctx!.thumbs.get(p);
      b.append(img, el('span', 'enc-item-name', p.name), el('span', 'enc-seen'));
      b.addEventListener('click', () => this.select(PARTS.indexOf(p), true));
      this.itemEls.set(p.id, b);
      this.listEl.append(b);
    }

    // 정보 패널(모바일에서는 접이식 바텀시트)
    const info = el('section', 'enc-panel enc-info');
    info.setAttribute('aria-label', '부품 정보');
    info.dataset.open = this.narrow ? 'false' : 'true';
    this.infoEl = info;
    const bar = el('div', 'enc-info-bar');
    const prev = button('enc-nav', '‹', () => this.step(-1));
    prev.setAttribute('aria-label', '이전 부품');
    const next = button('enc-nav', '›', () => this.step(1));
    next.setAttribute('aria-label', '다음 부품');
    const heading = el('div', 'enc-heading');
    heading.append(el('span', 'enc-chip'), el('h2', 'enc-name'));
    this.toggleBtn = button('enc-toggle', '', () => {
      info.dataset.open = info.dataset.open === 'true' ? 'false' : 'true';
      this.syncToggle();
    });
    bar.append(prev, heading, next, this.toggleBtn);
    this.bodyEl = el('div', 'enc-info-body');
    info.append(bar, this.bodyEl);
    this.syncToggle();

    wrap.append(left, info);
    root.append(wrap);
  }

  private syncToggle(): void {
    const open = this.infoEl.dataset.open === 'true';
    this.toggleBtn.textContent = open ? '접기' : '설명';
    this.toggleBtn.setAttribute('aria-expanded', String(open));
  }

  // ───────── 동작 ─────────

  private setCategory(cat: CategoryId, selectFirst: boolean): void {
    this.cat = cat;
    for (const [id, t] of this.tabEls) {
      t.classList.toggle('is-active', id === cat);
      t.setAttribute('aria-selected', String(id === cat));
    }
    for (const p of PARTS) {
      const b = this.itemEls.get(p.id);
      if (b) b.hidden = p.category !== cat;
    }
    this.listEl.scrollLeft = 0;
    this.listEl.scrollTop = 0;
    if (selectFirst) {
      const first = PARTS.findIndex((p) => p.category === cat);
      if (first >= 0) this.select(first, true);
    }
  }

  private step(d: number): void {
    this.select((this.index + d + PARTS.length) % PARTS.length, true);
  }

  private select(i: number, animate: boolean): void {
    const part = PARTS[i];
    if (!part) return;
    this.index = i;
    if (part.category !== this.cat || !animate) this.setCategory(part.category, false);
    this.stage?.show(part);
    for (const [id, b] of this.itemEls) b.classList.toggle('is-active', id === part.id);
    this.itemEls.get(part.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.seen.add(part.id);
    writeJson(SEEN_KEY, [...this.seen]);
    for (const p of PARTS) this.itemEls.get(p.id)?.classList.toggle('is-seen', this.seen.has(p.id));
    this.renderInfo(part);
  }

  private renderInfo(part: PartDef): void {
    const cat = getCategory(part.category);
    const entry = ENCYCLOPEDIA[part.id];
    const info = this.infoEl;
    info.style.setProperty('--c', `var(--cat-${part.category})`);
    const chip = info.querySelector<HTMLElement>('.enc-chip');
    const name = info.querySelector<HTMLElement>('.enc-name');
    if (chip) chip.textContent = `${cat.name} 기계요소`;
    if (name) name.textContent = part.name;

    const body = this.bodyEl;
    body.replaceChildren();
    body.scrollTop = 0;
    body.append(el('p', 'enc-role', part.role));

    if (entry) {
      body.append(this.section('쓰이는 곳', this.chips(entry.usedIn)));
      body.append(this.section('핵심 포인트', el('p', 'enc-text', entry.keyPoint)));
      if (entry.versus) {
        const other = PARTS.find((p) => p.id === entry.versus!.partId);
        const box = el('div', 'enc-versus');
        if (other) {
          const go = el('button', 'enc-versus-link');
          go.type = 'button';
          go.textContent = `${other.name} 보러 가기`;
          go.addEventListener('click', () => this.select(PARTS.indexOf(other), true));
          box.append(el('p', 'enc-text', entry.versus.diff), go);
        } else {
          box.append(el('p', 'enc-text', entry.versus.diff));
        }
        body.append(this.section('헷갈리기 쉬운 요소와의 차이', box));
      }
    }

    const missions = MACHINES.filter((m) => m.steps.some((s) => s.partId === part.id));
    if (missions.length > 0) {
      body.append(this.section('이 부품이 나오는 미션', this.chips(missions.map((m) => m.name), true)));
    }

    const seenText = `본 부품 ${this.seen.size}/${PARTS.length}`;
    for (const p of this.progressEls) p.textContent = seenText;
  }

  private section(title: string, content: HTMLElement): HTMLElement {
    const s = el('div', 'enc-section');
    s.append(el('h3', 'enc-h', title), content);
    return s;
  }

  private chips(items: string[], quiet = false): HTMLElement {
    const ul = el('ul', quiet ? 'enc-chips is-quiet' : 'enc-chips');
    for (const t of items) ul.append(el('li', 'enc-pill', t));
    return ul;
  }
}
