// 탐구 실험 13-B — 엔진의 종류(실린더 수와 배열)
// 직렬 4·6기통, V6, V8, 수평대향 4기통, V12, 부가티 베이론의 W16을 하나의 생성기로 만들어
// 피스톤이 크랭크 핀 위상대로 오르내리고 점화 순서대로 실린더가 번쩍이는 것을 보여 준다.
// 시점 버튼(앞·위·옆)으로 배열 모양을 확인하고, 두 엔진을 나란히 비교할 수 있다.

import * as THREE from 'three';
import type { AppMode, ModeContext } from '../modes/types';
import { el, button } from '../modes/dom';
import { ENGINES, KEY_SENTENCE, engineDef, interval, type EngineDef, type EngineId } from './engines/data';
import { EngineModel, type BlockMode } from './engines/model';
import { layoutIcon } from './engines/icon';
import { LabLabels, type LabelSpec } from './common/labels';

type ViewId = 'iso' | 'front' | 'top' | 'side';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'iso', label: '비스듬히' },
  { id: 'front', label: '앞에서' },
  { id: 'top', label: '위에서' },
  { id: 'side', label: '옆에서' }
];

const BLOCKS: { id: BlockMode; label: string }[] = [
  { id: 'hidden', label: '숨김' },
  { id: 'ghost', label: '반투명' },
  { id: 'solid', label: '불투명' }
];

const RPM_MIN = 6;
const RPM_MAX = 90;
const RPM_DEFAULT = 20;
const TAU = Math.PI * 2;

interface Timeline {
  wrap: HTMLElement;
  cursor: HTMLElement;
  ticks: HTMLElement[];
  model: EngineModel;
  angle: HTMLElement | null;
}

export class EngineTypes implements AppMode {
  private ctx: ModeContext | null = null;
  private stage = new THREE.Group();
  private models: EngineModel[] = [];

  private wrap: HTMLElement | null = null;
  private dock!: HTMLElement;
  private listPanel!: HTMLElement;
  private ctrlPanel!: HTMLElement;
  private viewRow!: HTMLElement;
  private infoPanel!: HTMLElement;
  private labels: LabLabels | null = null;
  private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private fireOn: (boolean | undefined)[] = [];
  private cardBtns = new Map<EngineId, HTMLButtonElement>();
  private viewBtns: HTMLButtonElement[] = [];
  private blockBtns: HTMLButtonElement[] = [];
  private compareBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private rpmOut!: HTMLElement;
  private timelines: Timeline[] = [];
  private chips: { el: HTMLElement; model: EngineModel; cyl: number }[] = [];

  // 상태
  private sel: EngineId = 'i4';
  private other: EngineId = 'w16';
  private compare = false;
  private view: ViewId = 'iso';
  private block: BlockMode = 'ghost';
  private paused = false;
  private rpm = RPM_DEFAULT;
  private theta = 0;

  private savedMinDist = 2;
  private savedMaxDist = 18;
  private frameKey = '';
  private frameT = 0;
  private fitPending = true;
  private fitImmediate = true;
  private baseFov = 40;
  private fov = 40;
  private savedFog: [number, number] | null = null;

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const idx = ENGINES.findIndex((d) => d.id === this.sel);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.select(ENGINES[(idx + 1) % ENGINES.length]!.id);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.select(ENGINES[(idx - 1 + ENGINES.length) % ENGINES.length]!.id);
    else if (e.key === ' ' && (!t || t.tagName !== 'BUTTON')) this.setPaused(!this.paused);
    else return;
    e.preventDefault();
  };

  private onResize = (): void => {
    // SceneManager가 먼저 화면비에 맞는 화각을 다시 정한다 — 그 값을 기준 화각으로 삼는다
    if (this.ctx) this.baseFov = this.ctx.sceneMgr.camera.fov;
    this.requestFit(true);
  };

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.sel = 'i4';
    this.other = 'w16';
    this.compare = false;
    this.view = 'iso';
    this.block = 'ghost';
    this.paused = false;
    this.rpm = RPM_DEFAULT;
    this.theta = 0;
    this.stage = new THREE.Group();
    ctx.sceneMgr.add(this.stage);
    this.savedMinDist = ctx.sceneMgr.controls.minDistance;
    this.savedMaxDist = ctx.sceneMgr.controls.maxDistance;
    ctx.sceneMgr.controls.minDistance = 1.2;
    ctx.sceneMgr.controls.maxDistance = 60;
    this.baseFov = ctx.sceneMgr.camera.fov;
    this.fov = this.baseFov;
    const fog = ctx.sceneMgr.scene.fog;
    if (fog instanceof THREE.Fog) {
      this.savedFog = [fog.near, fog.far];
      // 좁은 화각(앞·위·옆 시점)은 카메라가 멀어지므로 안개를 뒤로 민다
      fog.near = 40;
      fog.far = 90;
    }

    this.buildDom(ctx.root);
    this.rebuildModels();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    const ctx = this.ctx;
    if (ctx) {
      const cam = ctx.sceneMgr.camera;
      cam.clearViewOffset();
      cam.fov = this.baseFov;
      cam.updateProjectionMatrix();
      const fog = ctx.sceneMgr.scene.fog;
      if (fog instanceof THREE.Fog && this.savedFog) {
        fog.near = this.savedFog[0];
        fog.far = this.savedFog[1];
      }
      this.savedFog = null;
      ctx.sceneMgr.controls.minDistance = this.savedMinDist;
      ctx.sceneMgr.controls.maxDistance = this.savedMaxDist;
      ctx.sceneMgr.remove(this.stage);
    }
    for (const m of this.models) m.dispose();
    this.models = [];
    this.labels?.dispose();
    this.labels = null;
    this.wrap?.remove();
    this.wrap = null;
    this.timelines = [];
    this.chips = [];
    this.cardBtns.clear();
    this.viewBtns = [];
    this.blockBtns = [];
    this.frameKey = '';
    this.ctx = null;
  }

  // ───────────────────────── 3D ─────────────────────────

  private rebuildModels(): void {
    for (const m of this.models) {
      this.stage.remove(m.root);
      m.dispose();
    }
    this.models = [];
    const ids = this.compare ? [this.sel, this.other] : [this.sel];
    const gap = 0.3;
    ids.forEach((id, i) => {
      const m = new EngineModel(engineDef(id));
      m.setBlockMode(this.block);
      const c = m.box.getCenter(new THREE.Vector3());
      if (!this.compare) m.root.position.set(-c.x, 0, -c.z);
      // 앞에서 보면 +Z가 화면 왼쪽 — 고른 엔진을 왼쪽에
      else if (i === 0) m.root.position.set(-c.x, 0, gap / 2 - m.box.min.z);
      else m.root.position.set(-c.x, 0, -gap / 2 - m.box.max.z);
      this.stage.add(m.root);
      this.models.push(m);
    });
    this.stage.updateMatrixWorld(true);
    for (const m of this.models) m.update(this.theta);
    this.refreshUi();
    this.requestFit(false);
  }

  private stageBox(): THREE.Box3 {
    const b = new THREE.Box3();
    for (const m of this.models) b.union(m.box.clone().translate(m.root.position));
    return b;
  }

  private requestFit(immediate: boolean): void {
    this.fitPending = true;
    this.fitImmediate = this.fitImmediate || immediate;
  }

  /** 패널이 가리지 않는 영역 */
  private freeRect(): { x0: number; x1: number; y0: number; y1: number } {
    const W = window.innerWidth;
    if (W >= 1100) {
      const l = this.listPanel.getBoundingClientRect();
      const r = this.infoPanel.getBoundingClientRect();
      const c = this.ctrlPanel.getBoundingClientRect();
      return { x0: l.right, x1: r.left, y0: 0, y1: c.top };
    }
    return { x0: 0, x1: W, y0: 56, y1: Math.max(140, this.dock.getBoundingClientRect().top) };
  }

  private viewDir(): THREE.Vector3 {
    switch (this.view) {
      case 'front':
        return new THREE.Vector3(1, 0.07, 0).normalize();
      case 'top':
        return new THREE.Vector3(0, 1, 0.003).normalize();
      case 'side':
        return this.compare ? new THREE.Vector3(0.35, 0.42, 1).normalize() : new THREE.Vector3(0, 0.12, 1).normalize();
      default:
        return new THREE.Vector3(0.78, 0.55, 0.95).normalize();
    }
  }

  private fit(): void {
    const ctx = this.ctx;
    if (!ctx || this.models.length === 0) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const fr = this.freeRect();
    const fw = Math.max(80, fr.x1 - fr.x0);
    const fh = Math.max(80, fr.y1 - fr.y0);
    // 실린더 번호표가 헤드 바깥에 붙으므로 그만큼 여유를 둔다
    const box = this.stageBox().expandByScalar(0.2);
    const center = box.getCenter(new THREE.Vector3());
    const dir = this.viewDir();
    const fwd = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    let hx = 0;
    let hy = 0;
    let hz = 0;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center);
      hx = Math.max(hx, Math.abs(p.dot(right)));
      hy = Math.max(hy, Math.abs(p.dot(up)));
      hz = Math.max(hz, Math.abs(p.dot(fwd)));
    }
    // 앞·위·옆은 화각을 좁혀 원근 왜곡을 줄인다(뒤쪽 실린더가 앞쪽과 겹쳐 보여야 배열이 읽힌다)
    const ortho = this.view !== 'iso';
    this.fov = ortho ? this.baseFov * 0.55 : this.baseFov;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.fov) / 2);
    const margin = ortho ? 1.08 : 1.1;
    const d = hz * (ortho ? 1 : 0.4) + (Math.max((hy * H) / fh, (hx * H) / fw) / tanV) * margin;
    const pos = center.clone().addScaledVector(dir, d);
    ctx.sceneMgr.flyTo({ pos: [pos.x, pos.y, pos.z], target: [center.x, center.y, center.z] }, this.fitImmediate);
    this.fitImmediate = false;
    const cx = (fr.x0 + fr.x1) / 2;
    const cy = (fr.y0 + fr.y1) / 2;
    ctx.sceneMgr.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  }

  private checkFrame(): void {
    if (!this.wrap) return;
    const fr = this.freeRect();
    this.bounds = fr;
    const key = `${window.innerWidth}x${window.innerHeight}:${Math.round(fr.x0 / 12)},${Math.round(fr.x1 / 12)},${Math.round(fr.y0 / 12)},${Math.round(fr.y1 / 12)}`;
    if (key !== this.frameKey) {
      this.frameKey = key;
      this.fitPending = true;
    }
    if (this.fitPending) {
      this.fitPending = false;
      this.fit();
    }
  }

  // ───────────────────────── DOM ─────────────────────────

  private buildDom(root: HTMLElement): void {
    const wrap = el('div', 'eng-wrap');
    this.wrap = wrap;
    this.dock = el('div', 'eng-dock');

    // 엔진 목록
    const list = el('section', 'eng-list eng-panel');
    this.listPanel = list;
    list.setAttribute('aria-label', '엔진 고르기');
    const lh = el('div', 'eng-list-head');
    lh.append(el('h2', 'eng-h2', '엔진 고르기'), el('span', 'eng-hint', '앞에서 본 모양'));
    const cards = el('div', 'eng-cards');
    cards.setAttribute('role', 'radiogroup');
    cards.setAttribute('aria-label', '엔진 종류');
    for (const d of ENGINES) {
      const b = el('button', 'eng-card');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      const t = el('span', 'eng-card-t');
      t.append(el('span', 'eng-card-n', d.name), el('span', 'eng-card-s', `${d.code} · ${d.cyl}기통`));
      b.append(layoutIcon(d, 40), t);
      if (d.special) b.append(el('span', 'eng-card-badge', '베이론'));
      b.addEventListener('click', () => this.select(d.id));
      this.cardBtns.set(d.id, b);
      cards.append(b);
    }
    const opts = el('div', 'eng-opts');
    const blk = el('div', 'eng-field');
    blk.append(el('span', 'eng-field-l', '실린더 블록'));
    const bseg = el('div', 'eng-seg');
    bseg.setAttribute('role', 'radiogroup');
    bseg.setAttribute('aria-label', '실린더 블록 보기');
    for (const o of BLOCKS) {
      const b = el('button', 'eng-seg-b', o.label);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => this.setBlock(o.id));
      this.blockBtns.push(b);
      bseg.append(b);
    }
    blk.append(bseg);
    this.compareBtn = el('button', 'eng-toggle');
    this.compareBtn.type = 'button';
    this.compareBtn.append(el('span', 'eng-toggle-k'), el('span', undefined, '나란히 비교'));
    this.compareBtn.addEventListener('click', () => this.setCompare(!this.compare));
    opts.append(blk, this.compareBtn);
    list.append(lh, cards, opts);

    // 재생·시점
    const ctrl = el('section', 'eng-ctrl eng-panel');
    this.ctrlPanel = ctrl;
    ctrl.setAttribute('aria-label', '회전과 시점');
    const play = el('div', 'eng-play');
    this.pauseBtn = el('button', 'eng-btn eng-pause');
    this.pauseBtn.type = 'button';
    this.pauseBtn.addEventListener('click', () => this.setPaused(!this.paused));
    const stepBtn = button('eng-btn', '다음 점화', () => this.stepFire());
    stepBtn.title = '다음 실린더가 점화하는 순간까지 크랭크를 돌려요';
    play.append(this.pauseBtn, stepBtn);
    const speed = el('label', 'eng-speed');
    const st = el('span', 'eng-speed-top');
    this.rpmOut = el('span', 'eng-speed-v');
    st.append(el('span', 'eng-field-l', '회전 속도'), this.rpmOut);
    const range = el('input', 'eng-range');
    range.type = 'range';
    range.min = String(RPM_MIN);
    range.max = String(RPM_MAX);
    range.step = '1';
    range.value = String(this.rpm);
    range.setAttribute('aria-label', '크랭크축 회전 속도');
    range.addEventListener('input', () => {
      this.rpm = Number(range.value);
      this.refreshSpeed();
    });
    speed.append(st, range);
    const views = el('div', 'eng-views');
    views.setAttribute('role', 'radiogroup');
    views.setAttribute('aria-label', '시점');
    for (const v of VIEWS) {
      const b = el('button', 'eng-seg-b eng-view', v.label);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.view = v.id;
      b.addEventListener('click', () => this.setView(v.id));
      this.viewBtns.push(b);
      views.append(b);
    }
    const viewRow = el('div', 'eng-viewrow');
    viewRow.append(views);
    this.viewRow = viewRow;
    ctrl.append(play, speed, viewRow);

    // 정보
    this.infoPanel = el('section', 'eng-info eng-panel');
    this.infoPanel.setAttribute('aria-live', 'polite');

    this.dock.append(list, ctrl, this.infoPanel);
    wrap.append(this.dock);
    root.append(wrap);
    // 이름표 레이어 + 켜고 끄는 버튼(시점 버튼 옆)
    const labels = new LabLabels(this.ctx!, wrap, { bounds: () => this.bounds });
    this.labels = labels;
    this.viewRow.append(labels.button);
    this.refreshSpeed();
    this.setPaused(false);
  }

  private refreshUi(): void {
    this.cardBtns.forEach((b, id) => {
      const on = id === this.sel;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
      b.classList.toggle('is-other', this.compare && id === this.other);
    });
    this.cardBtns.get(this.sel)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.viewBtns.forEach((b) => {
      const on = b.dataset.view === this.view;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    this.blockBtns.forEach((b, i) => {
      const on = BLOCKS[i]?.id === this.block;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    this.compareBtn.classList.toggle('is-on', this.compare);
    this.compareBtn.setAttribute('aria-pressed', String(this.compare));
    this.renderInfo();
    this.setLabels();
  }

  private refreshSpeed(): void {
    this.rpmOut.textContent = `분당 ${this.rpm}회전`;
  }

  private select(id: EngineId): void {
    if (id === this.sel) return;
    if (this.compare && id === this.other) this.other = this.sel;
    this.sel = id;
    this.rebuildModels();
  }

  private setOther(id: EngineId): void {
    if (id === this.sel || id === this.other) return;
    this.other = id;
    this.rebuildModels();
  }

  private setCompare(on: boolean): void {
    this.compare = on;
    if (on && this.other === this.sel) this.other = this.sel === 'w16' ? 'i4' : 'w16';
    this.rebuildModels();
  }

  private setView(v: ViewId): void {
    this.view = v;
    this.refreshUiLight();
    this.requestFit(false);
  }

  private refreshUiLight(): void {
    this.viewBtns.forEach((b) => {
      const on = b.dataset.view === this.view;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  private setBlock(m: BlockMode): void {
    this.block = m;
    for (const x of this.models) x.setBlockMode(m);
    this.blockBtns.forEach((b, i) => {
      const on = BLOCKS[i]?.id === m;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.pauseBtn.textContent = p ? '계속 돌리기' : '일시정지';
    this.pauseBtn.classList.toggle('is-on', p);
    this.pauseBtn.setAttribute('aria-pressed', String(p));
  }

  /** 다음 점화 각까지 크랭크를 옮긴다(첫 번째 엔진 기준) */
  private stepFire(): void {
    const m = this.models[0];
    if (!m) return;
    this.setPaused(true);
    const step = (interval(m.def) * Math.PI) / 180;
    const cyc = 2 * TAU;
    const cur = ((this.theta % cyc) + cyc) % cyc;
    let next = (Math.floor(cur / step + 1e-6) + 1) * step;
    if (next >= cyc - 1e-6) next = 0;
    this.theta = next + 0.02;
  }

  // ───────────────────────── 정보 패널 ─────────────────────────

  private renderInfo(): void {
    const p = this.infoPanel;
    p.replaceChildren();
    this.timelines = [];
    this.chips = [];
    const a = this.models[0];
    if (!a) return;
    if (this.compare) {
      const b = this.models[1];
      if (b) this.renderCompare(p, a, b);
      return;
    }
    const d = a.def;
    const head = el('div', 'eng-head');
    const ic = el('span', 'eng-head-ic');
    ic.append(layoutIcon(d, 52));
    const ht = el('div', 'eng-head-t');
    ht.append(el('span', 'eng-eyebrow', `${d.code} · 실린더 ${d.cyl}개`), el('h2', 'eng-title', d.name));
    head.append(ic, ht);
    p.append(head, el('p', 'eng-summary', d.summary));
    if (d.special) {
      const sp = el('div', 'eng-special');
      sp.append(el('strong', 'eng-special-t', '부가티 베이론의 엔진'), el('span', undefined, d.special));
      p.append(sp);
    }

    const stats = el('dl', 'eng-stats');
    const stat = (k: string, v: string, wide = false): void => {
      const box = el('div', `eng-stat${wide ? ' is-wide' : ''}`);
      box.append(el('dt', undefined, k), el('dd', undefined, v));
      stats.append(box);
    };
    stat('배열', d.layout, true);
    stat('실린더 수', `${d.cyl}개`);
    stat('뱅크 각도', d.bankAngle);
    stat('점화 간격', `720° ÷ ${d.cyl} = ${fmtDeg(interval(d))}`);
    stat('크랭크 1회전 폭발', `${d.cyl / 2}번`);
    p.append(stats);

    p.append(this.firingBlock(a, true));
    if (d.banks.length > 1) p.append(this.bankLegend(d));

    const pc = el('div', 'eng-pc');
    const pros = el('div', 'eng-pc-col is-pro');
    pros.append(el('strong', undefined, '좋은 점'));
    const ul1 = el('ul');
    for (const t of d.pros) ul1.append(el('li', undefined, t));
    pros.append(ul1);
    const cons = el('div', 'eng-pc-col is-con');
    cons.append(el('strong', undefined, '아쉬운 점'));
    const ul2 = el('ul');
    for (const t of d.cons) ul2.append(el('li', undefined, t));
    cons.append(ul2);
    pc.append(pros, cons);
    p.append(pc);
    const use = el('p', 'eng-use');
    use.append(el('span', 'eng-use-k', '주로 쓰이는 곳'), el('span', undefined, d.uses));
    p.append(use, el('p', 'eng-key', KEY_SENTENCE));
  }

  private firingBlock(m: EngineModel, withNote: boolean): HTMLElement {
    const d = m.def;
    const box = el('div', 'eng-firing');
    const top = el('div', 'eng-firing-top');
    top.append(el('span', 'eng-field-l', '점화 순서'), el('span', `eng-tagchip${d.firingExample ? ' is-ex' : ''}`, d.firingExample ? '예시 순서' : '대표 순서'));
    box.append(top);
    const chips = el('ol', 'eng-chips');
    chips.setAttribute('aria-label', `점화 순서 ${d.firing.join('-')}`);
    for (const n of d.firing) {
      const li = el('li', 'eng-chip', String(n));
      const ci = m.cyl.findIndex((c) => c.num === n);
      const bank = d.banks[m.cyl[ci]?.bank ?? 0];
      if (bank && d.banks.length > 1) li.classList.add(`eng-b-${bank.color}`);
      chips.append(li);
      this.chips.push({ el: li, model: m, cyl: ci });
    }
    box.append(chips);
    box.append(this.timeline(m));
    if (withNote) box.append(el('p', 'eng-note', d.firingNote));
    return box;
  }

  /** 720° 띠: 점화 시점 눈금 + 현재 크랭크 각 커서 */
  private timeline(m: EngineModel): HTMLElement {
    const d = m.def;
    const wrap = el('div', 'eng-tl');
    const bar = el('div', 'eng-tl-bar');
    const ticks: HTMLElement[] = [];
    d.firing.forEach((n, k) => {
      const t = el('span', 'eng-tl-tick');
      t.style.left = `${(k / d.cyl) * 100}%`;
      if (d.cyl <= 12) t.append(el('span', 'eng-tl-n', String(n)));
      bar.append(t);
      ticks.push(t);
    });
    // 크랭크 1회전 경계
    const half = el('span', 'eng-tl-half');
    bar.append(half);
    const cursor = el('span', 'eng-tl-cur');
    bar.append(cursor);
    const scale = el('div', 'eng-tl-scale');
    const angle = el('span', 'eng-tl-angle');
    scale.append(el('span', undefined, '0°'), angle, el('span', undefined, '720°'));
    wrap.append(bar, scale);
    this.timelines.push({ wrap, cursor, ticks, model: m, angle });
    return wrap;
  }

  private bankLegend(d: EngineDef): HTMLElement {
    const box = el('div', 'eng-banks');
    for (const b of d.banks) {
      const row = el('span', `eng-bank eng-b-${b.color}`);
      row.append(el('span', 'eng-bank-dot'), el('span', 'eng-bank-n', b.name), el('span', 'eng-bank-c', b.nums.join('·')));
      box.append(row);
    }
    return box;
  }

  private renderCompare(p: HTMLElement, a: EngineModel, b: EngineModel): void {
    const head = el('div', 'eng-head');
    const ht = el('div', 'eng-head-t');
    ht.append(el('span', 'eng-eyebrow', '나란히 비교'), el('h2', 'eng-title', `${a.def.code} 와 ${b.def.code}`));
    head.append(ht);
    p.append(head);
    const pick = el('div', 'eng-field');
    pick.append(el('span', 'eng-field-l', '비교할 엔진'));
    const seg = el('div', 'eng-seg eng-seg-wrap');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', '비교할 엔진');
    for (const d of ENGINES) {
      const bt = el('button', `eng-seg-b${d.id === this.other ? ' is-on' : ''}`, d.code);
      bt.type = 'button';
      bt.setAttribute('role', 'radio');
      bt.setAttribute('aria-checked', String(d.id === this.other));
      bt.disabled = d.id === this.sel;
      bt.title = d.name;
      bt.addEventListener('click', () => this.setOther(d.id));
      seg.append(bt);
    }
    pick.append(seg);
    p.append(pick);

    const t = el('div', 'eng-cmp');
    t.setAttribute('role', 'table');
    const row = (k: string, va: string, vb: string, head = false): void => {
      const r = el('div', `eng-cmp-r${head ? ' is-head' : ''}`);
      r.setAttribute('role', 'row');
      const c0 = el('span', 'eng-cmp-k', k);
      c0.setAttribute('role', head ? 'columnheader' : 'rowheader');
      const c1 = el('span', 'eng-cmp-v', va);
      const c2 = el('span', 'eng-cmp-v', vb);
      c1.setAttribute('role', head ? 'columnheader' : 'cell');
      c2.setAttribute('role', head ? 'columnheader' : 'cell');
      r.append(c0, c1, c2);
      t.append(r);
    };
    const A = a.def;
    const B = b.def;
    row('', `고른 엔진 · ${A.name}`, `비교 엔진 · ${B.name}`, true);
    row('실린더 수', `${A.cyl}개`, `${B.cyl}개`);
    row('뱅크 각도', A.bankAngle, B.bankAngle);
    row('점화 간격', fmtDeg(interval(A)), fmtDeg(interval(B)));
    row('1회전 폭발', `${A.cyl / 2}번`, `${B.cyl / 2}번`);
    row('좋은 점', A.pros[0] ?? '', B.pros[0] ?? '');
    row('쓰이는 곳', A.uses, B.uses);
    p.append(t);

    for (const m of [a, b]) {
      const box = el('div', 'eng-firing is-cmp');
      const top = el('div', 'eng-firing-top');
      top.append(el('span', 'eng-field-l', `${m.def.code} 점화 시점(720°)`), el('span', `eng-tagchip${m.def.firingExample ? ' is-ex' : ''}`, m.def.firingExample ? '예시 순서' : '대표 순서'));
      box.append(top, this.timeline(m));
      p.append(box);
    }
    p.append(el('p', 'eng-key', KEY_SENTENCE));
  }

  // ───────────────────────── 3D 이름표 ─────────────────────────

  private setLabels(): void {
    const labels = this.labels;
    if (!labels) return;
    const specs: LabelSpec[] = [];
    this.fireOn = [];
    this.models.forEach((m, mi) => {
      const k = `${mi}`;
      // 부품 이름은 비교 때도 왼쪽(첫) 엔진에만
      if (mi === 0) {
        const part = (key: string, text: string, priority: 1 | 2 | 3, side: 'above' | 'below' | 'left' | 'right'): void => {
          specs.push({ key: `${key}`, text, side, priority, at: (out) => m.partWorld(key, out) });
        };
        part('crank', '크랭크축', 1, 'below');
        part('piston', '피스톤', 1, 'right');
        part('rod', '커넥팅 로드', 1, 'left');
        part('block', '실린더 블록', 2, 'below');
        part('head', '실린더 헤드', 2, 'above');
        part('flywheel', '플라이휠', 2, 'above');
        part('pulley', '크랭크 풀리', 3, 'above');
        part('support', '받침대(베어링)', 3, 'below');
      }
      m.cyl.forEach((c, i) => {
        const bank = m.def.banks[c.bank]!;
        specs.push({
          key: `cyl${k}-${c.num}`,
          text: String(c.num),
          kind: 'point',
          priority: 2,
          tone: bank.color,
          at: (out) => {
            m.tagWorld(i, out);
            return true;
          }
        });
      });
      if (m.def.banks.length > 1) {
        m.def.banks.forEach((b, bi) => {
          specs.push({
            key: `bank${k}-${bi}`,
            text: b.name,
            kind: 'info',
            priority: 2,
            tone: b.color,
            at: (out) => {
              m.bankWorld(bi, out);
              return true;
            }
          });
        });
      }
      if (this.compare) {
        specs.push({
          key: `name${k}`,
          text: `${m.def.code} ${m.def.name}`,
          kind: 'info',
          priority: 1,
          side: 'above',
          at: (out) => {
            const b = m.box;
            out.set((b.min.x + b.max.x) / 2, b.max.y + 0.55, (b.min.z + b.max.z) / 2).add(m.root.position);
            return true;
          }
        });
      }
    });
    labels.set(specs);
  }

  /** 점화한 실린더 번호를 불꽃 색으로 */
  private updateFire(): void {
    const labels = this.labels;
    if (!labels) return;
    let n = 0;
    this.models.forEach((m, mi) => {
      m.cyl.forEach((c, i) => {
        const f = (m.fire[i] ?? 0) > 0.28;
        if (f !== this.fireOn[n]) {
          this.fireOn[n] = f;
          labels.setState(`cyl${mi}-${c.num}`, f ? 'fire' : null);
        }
        n++;
      });
    });
  }

  // ───────────────────────── 프레임 ─────────────────────────

  update(dt: number): void {
    if (this.models.length === 0) return;
    if (!this.paused) this.theta = (this.theta + (this.rpm / 60) * TAU * dt) % (2 * TAU);
    const cam = this.ctx?.sceneMgr.camera;
    if (cam && Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov += (this.fov - cam.fov) * Math.min(1, dt * 5);
      cam.updateProjectionMatrix();
    }
    for (const m of this.models) m.update(this.theta);

    // 점화 순서 칩: 가장 최근에 점화한 실린더
    const latest = new Map<EngineModel, number>();
    for (const m of this.models) {
      let best = -1;
      let bv = 0.05;
      m.fire.forEach((f, i) => {
        if (f > bv) {
          bv = f;
          best = i;
        }
      });
      latest.set(m, best);
    }
    for (const c of this.chips) {
      const on = latest.get(c.model) === c.cyl;
      if (c.el.classList.contains('is-on') !== on) c.el.classList.toggle('is-on', on);
    }
    const deg = ((this.theta % (2 * TAU)) / (2 * TAU)) * 720;
    for (const tl of this.timelines) {
      tl.cursor.style.left = `${(deg / 720) * 100}%`;
      if (tl.angle) tl.angle.textContent = `크랭크 각 ${Math.floor(deg)}°`;
      const best = latest.get(tl.model) ?? -1;
      const num = best >= 0 ? tl.model.cyl[best]?.num : -1;
      tl.ticks.forEach((t, k) => {
        const on = tl.model.def.firing[k] === num;
        if (t.classList.contains('is-on') !== on) t.classList.toggle('is-on', on);
      });
    }

    this.frameT += dt;
    if (this.frameT > 0.2 || this.fitPending) {
      this.frameT = 0;
      this.checkFrame();
    }
    this.updateFire();
    this.labels?.update();
  }
}

function fmtDeg(v: number): string {
  return `${Number.isInteger(v) ? v : v.toFixed(1)}°`;
}
