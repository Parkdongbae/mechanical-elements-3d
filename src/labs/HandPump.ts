// 탐구 실험 13-D — 우물 손펌프(작두펌프)
// 손잡이(드래그·누르고 있기·슬라이더) → 흔들 링크 지렛대 기구를 풀어 피스톤 높이 → 준정적 물리(두 체크 밸브, 등온 공기, 대기압)
// → 밸브 열림, 관 속 물기둥, 피스톤 위아래 물, 주둥이 물줄기, 양동이 수위가 실제로 반응한다.

import * as THREE from 'three';
import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import { el, button } from '../modes/dom';
import { PumpModel, PHI_MAX, SPOUT_H_REAL, LEVER_RATIO, type ViewMode } from './pump/model';
import { PumpPhysics, P0, H_LIMIT, STROKE, VALVE_ABOVE_GROUND, PRIME_L } from './pump/physics';
import { STAGES, CARDS, BUCKET_L, type ViewKey } from './pump/data';
import { LabLabels, type LabelBounds, type LabelSpec } from './common/labels';

const VIEWS: Record<ViewKey, { t: [number, number, number]; dir: [number, number, number]; d: number }> = {
  all: { t: [-0.45, 2.95, 0], dir: [0.32, 0.24, 1], d: 9.4 },
  pump: { t: [-0.75, 3.75, 0], dir: [0.3, 0.22, 1], d: 7.0 },
  valve: { t: [0.05, 3.15, 0], dir: [0.16, 0.16, 1], d: 3.7 }
};

const HANDLE_RATE = (PHI_MAX * 2) / 0.9; // 한 번 끝까지 0.9초
const DEPTH0 = 6;

type Anim = { kind: 'to'; target: number } | { kind: 'stroke'; phase: 0 | 1 } | { kind: 'auto' } | null;

export class HandPump implements AppMode {
  private ctx: ModeContext | null = null;
  private model: PumpModel | null = null;
  private phys = new PumpPhysics(DEPTH0, SPOUT_H_REAL);
  private wrap: HTMLElement | null = null;
  private dock!: HTMLElement;
  private guide!: HTMLElement;
  private side!: HTMLElement;
  private stepsBar!: HTMLElement;
  private labels: LabLabels | null = null;
  private bounds: LabelBounds = { x0: 0, y0: 0, x1: 99999, y1: 99999 };
  private tickLayer!: HTMLElement;
  private valveTxt = { foot: '', piston: '' };
  private ticks: { el: HTMLElement; d: number }[] = [];
  private stepBtns: HTMLButtonElement[] = [];
  private out: Record<string, HTMLElement> = {};
  private bars: Record<string, HTMLElement> = {};
  private handleRange!: HTMLInputElement;
  private depthRange!: HTMLInputElement;
  private primeBtn!: HTMLButtonElement;
  private autoBtn!: HTMLButtonElement;
  private viewBtns: HTMLButtonElement[] = [];
  private camBtns: HTMLButtonElement[] = [];
  private live: HTMLElement | null = null;

  private stage = 0;
  private view: ViewMode = 'cut';
  private camKey: ViewKey = 'all';
  private phi = PHI_MAX;
  private hold = 0;
  private anim: Anim = null;
  private autoT = 0;
  private dragging = false;
  private strokes = 0;
  private armed = false;
  private bucketL = 0;
  private bucketDone = false;
  private priming = -1;
  private footOpenT = 0;
  private pistonOpenT = 0;
  private footWaterT = 0;
  private pistonWaterT = 0;
  private spillFlow = 0;
  private riseT = 0;
  private uiT = 0;
  private lastS = 0;
  private wetness = 0;
  private savedMin = 2;
  private viewKey = '';
  private frameT = 0;
  private lastLiveKey = '';

  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hit = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  // ───────────────────────── 생명주기 ─────────────────────────

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.phys = new PumpPhysics(DEPTH0, SPOUT_H_REAL);
    this.stage = 0;
    this.view = 'cut';
    this.camKey = 'all';
    this.phi = PHI_MAX;
    this.hold = 0;
    this.anim = null;
    this.strokes = 0;
    this.armed = false;
    this.bucketL = 0;
    this.bucketDone = false;
    this.priming = -1;
    this.wetness = 0;
    this.spillFlow = 0;
    this.lastLiveKey = '';

    const m = new PumpModel();
    this.model = m;
    ctx.sceneMgr.add(m.root);
    this.lastS = m.setHandle(this.phi);
    this.phys.step(this.lastS);

    this.savedMin = ctx.sceneMgr.controls.minDistance;
    ctx.sceneMgr.controls.minDistance = 1.5;

    this.buildDom(ctx.root);
    const cv = ctx.sceneMgr.renderer.domElement;
    cv.addEventListener('pointerdown', this.onDown, { capture: true });
    cv.addEventListener('pointermove', this.onHover);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.go(0, true);
  }

  exit(): void {
    const ctx = this.ctx;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    if (ctx) {
      const cv = ctx.sceneMgr.renderer.domElement;
      cv.removeEventListener('pointerdown', this.onDown, { capture: true });
      cv.removeEventListener('pointermove', this.onHover);
      cv.style.cursor = '';
      ctx.sceneMgr.controls.enabled = true;
      ctx.sceneMgr.controls.minDistance = this.savedMin;
      ctx.sceneMgr.camera.clearViewOffset();
      if (this.model) ctx.sceneMgr.remove(this.model.root);
    }
    this.model?.dispose();
    this.model = null;
    this.wrap?.remove();
    this.wrap = null;
    this.labels?.dispose();
    this.labels = null;
    this.ticks = [];
    this.stepBtns = [];
    this.viewBtns = [];
    this.camBtns = [];
    this.out = {};
    this.bars = {};
    this.live = null;
    this.viewKey = '';
    this.dragging = false;
    this.ctx = null;
  }

  // ───────────────────────── 입력 ─────────────────────────

  private pick(e: PointerEvent): boolean {
    const ctx = this.ctx;
    const m = this.model;
    if (!ctx || !m) return false;
    const r = ctx.sceneMgr.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, ctx.sceneMgr.camera);
    return this.ray.intersectObjects(m.handlePick, false).length > 0;
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !this.pick(e) || !this.ctx) return;
    // OrbitControls보다 먼저(캡처 단계) 받아 카메라 회전을 막는다
    this.ctx.sceneMgr.controls.enabled = false;
    this.dragging = true;
    this.anim = null;
    this.syncAuto();
    this.ctx.sceneMgr.renderer.domElement.style.cursor = 'grabbing';
    this.dragTo(e);
    e.preventDefault();
  };

  private onHover = (e: PointerEvent): void => {
    if (this.dragging || !this.ctx || e.pointerType !== 'mouse') return;
    this.ctx.sceneMgr.renderer.domElement.style.cursor = this.pick(e) ? 'grab' : '';
  };

  private onMove = (e: PointerEvent): void => {
    if (this.dragging) this.dragTo(e);
  };

  private onUp = (): void => {
    if (!this.dragging || !this.ctx) return;
    this.dragging = false;
    this.ctx.sceneMgr.controls.enabled = true;
    this.ctx.sceneMgr.renderer.domElement.style.cursor = '';
  };

  private dragTo(e: PointerEvent): void {
    const ctx = this.ctx;
    const m = this.model;
    if (!ctx || !m) return;
    const r = ctx.sceneMgr.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, ctx.sceneMgr.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return;
    this.tmp.copy(this.hit);
    m.root.worldToLocal(this.tmp);
    this.phi = clampPhi(m.phiFromPoint(this.tmp));
  }

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowDown') this.startHold(-1);
    else if (e.key === 'ArrowUp') this.startHold(1);
    else if (e.key === 'ArrowRight') this.go(Math.min(STAGES.length - 1, this.stage + 1));
    else if (e.key === 'ArrowLeft') this.go(Math.max(0, this.stage - 1));
    else return;
    e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') this.hold = 0;
  };

  private onResize = (): void => {
    this.flyTo(this.camKey, false);
    this.buildTags();
  };

  private startHold(dir: number): void {
    this.hold = dir;
    this.anim = null;
    this.syncAuto();
  }

  // ───────────────────────── DOM ─────────────────────────

  private buildDom(root: HTMLElement): void {
    const wrap = el('div', 'pmp-wrap');
    this.wrap = wrap;
    if (this.ctx) this.labels = new LabLabels(this.ctx, wrap, { bounds: () => this.bounds, onToggle: () => this.syncTicks() });
    this.tickLayer = el('div', 'pmp-ticks');
    this.tickLayer.setAttribute('aria-hidden', 'true');
    this.dock = el('div', 'pmp-dock');

    this.stepsBar = el('nav', 'pmp-steps pmp-panel');
    this.stepsBar.setAttribute('aria-label', '작동 원리 단계');
    const list = el('div', 'pmp-steps-list');
    STAGES.forEach((s, i) => {
      const b = el('button', 'pmp-step');
      b.type = 'button';
      if (i >= 1 && i <= 5) b.append(el('span', 'pmp-step-n', String(i)));
      b.append(el('span', 'pmp-step-l', s.short));
      b.addEventListener('click', () => this.go(i));
      this.stepBtns.push(b);
      list.append(b);
    });
    this.stepsBar.append(list);

    this.guide = el('section', 'pmp-guide pmp-panel');
    this.guide.setAttribute('aria-live', 'polite');

    this.side = el('div', 'pmp-side');
    this.side.append(this.buildActions(), this.buildStatus());
    this.dock.append(this.stepsBar, this.side, this.guide);
    wrap.append(this.tickLayer, this.dock);
    root.append(wrap);
  }

  private buildActions(): HTMLElement {
    const p = el('section', 'pmp-act pmp-panel');
    const head = el('div', 'pmp-act-head');
    head.append(el('h3', 'pmp-h3', '직접 펌프질'));
    if (this.labels) head.append(this.labels.button);
    p.append(head, el('span', 'pmp-hint', '3D 손잡이를 끌어도 돼요'));

    const row = el('div', 'pmp-act-row');
    this.primeBtn = button('pmp-btn pmp-prime', '마중물 붓기', () => this.startPrime());
    const down = this.holdButton('손잡이 내리기', 'down', -1);
    const up = this.holdButton('손잡이 올리기', 'up', 1);
    row.append(this.primeBtn, down, up);
    p.append(row);

    const row2 = el('div', 'pmp-act-row2');
    const once = button('pmp-btn', '한 번 펌프질', () => {
      this.hold = 0;
      this.anim = { kind: 'stroke', phase: 0 };
      this.syncAuto();
    });
    this.autoBtn = el('button', 'pmp-btn pmp-auto');
    this.autoBtn.type = 'button';
    this.autoBtn.setAttribute('aria-pressed', 'false');
    this.autoBtn.textContent = '계속 펌프질';
    this.autoBtn.addEventListener('click', () => {
      this.hold = 0;
      this.anim = this.anim?.kind === 'auto' ? null : { kind: 'auto' };
      this.autoT = Math.asin(Math.max(-1, Math.min(1, this.phi / PHI_MAX)));
      this.syncAuto();
    });
    row2.append(once, this.autoBtn);
    p.append(row2);

    const lab = el('label', 'pmp-field');
    const top = el('span', 'pmp-field-top');
    this.out.handle = el('span', 'pmp-field-v');
    top.append(el('span', 'pmp-field-l', '손잡이 끝 위치'), this.out.handle);
    this.handleRange = el('input', 'pmp-range');
    this.handleRange.type = 'range';
    this.handleRange.min = '0';
    this.handleRange.max = '100';
    this.handleRange.step = '1';
    this.handleRange.setAttribute('aria-label', '손잡이 끝 위치(0 = 맨 아래, 100 = 맨 위)');
    this.handleRange.addEventListener('input', () => {
      this.anim = null;
      this.syncAuto();
      this.phi = -PHI_MAX + (Number(this.handleRange.value) / 100) * 2 * PHI_MAX;
    });
    const sc = el('span', 'pmp-scale');
    sc.append(el('span', undefined, '내림(피스톤 위)'), el('span', undefined, '올림(피스톤 아래)'));
    lab.append(top, this.handleRange, sc);
    p.append(lab);
    return p;
  }

  private holdButton(text: string, icon: 'down' | 'up', dir: number): HTMLButtonElement {
    const b = el('button', 'pmp-btn pmp-hold');
    b.type = 'button';
    b.append(arrowIcon(icon), el('span', undefined, text));
    b.setAttribute('aria-label', `${text} (누르고 있기)`);
    const start = (e: Event): void => {
      e.preventDefault();
      this.startHold(dir);
      b.classList.add('is-on');
    };
    const stop = (): void => {
      if (this.hold === dir) this.hold = 0;
      b.classList.remove('is-on');
    };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointerleave', stop);
    b.addEventListener('pointercancel', stop);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e);
    });
    b.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') stop();
    });
    return b;
  }

  private buildStatus(): HTMLElement {
    const p = el('section', 'pmp-stat pmp-panel');

    const valves = el('div', 'pmp-valves');
    for (const [k, name] of [['foot', '아래 밸브'], ['piston', '피스톤 밸브']] as const) {
      const v = el('div', 'pmp-valve');
      v.dataset.k = k;
      const st = el('span', 'pmp-valve-s', '닫힘');
      this.out[`v-${k}`] = st;
      this.out[`vb-${k}`] = v;
      v.append(el('span', 'pmp-valve-d'), el('span', 'pmp-valve-n', name), st);
      valves.append(v);
    }
    p.append(valves);

    const meter = (key: string, label: string, note?: string): void => {
      const r = el('div', 'pmp-meter');
      const t = el('div', 'pmp-meter-top');
      this.out[key] = el('span', 'pmp-meter-v');
      t.append(el('span', 'pmp-meter-l', label), this.out[key]!);
      const bar = el('div', 'pmp-bar');
      const fill = el('span', 'pmp-bar-f');
      bar.append(fill);
      this.bars[key] = fill;
      r.append(t, bar);
      if (note !== undefined) {
        const n = el('span', 'pmp-meter-n', note);
        this.out[`${key}-n`] = n;
        r.append(n);
      }
      p.append(r);
    };
    meter('press', '피스톤 아래 압력', '');
    meter('rise', '관 속 물 높이', '');
    meter('bucket', '양동이(맛보기)', '');

    const nums = el('div', 'pmp-nums');
    for (const [k, l] of [['strokes', '펌프질'], ['pumped', '퍼 올린 물'], ['force', '손으로 누르는 힘']] as const) {
      const c = el('div', 'pmp-num');
      this.out[k] = el('strong', 'pmp-num-v', '0');
      c.append(el('span', 'pmp-num-l', l), this.out[k]!);
      nums.append(c);
    }
    p.append(nums);

    // 우물 깊이
    const dl = el('label', 'pmp-field pmp-depth');
    const dt = el('span', 'pmp-field-top');
    this.out.depth = el('span', 'pmp-field-v');
    dt.append(el('span', 'pmp-field-l', '지하수면 깊이'), this.out.depth);
    this.depthRange = el('input', 'pmp-range');
    this.depthRange.type = 'range';
    this.depthRange.min = '2';
    this.depthRange.max = '12';
    this.depthRange.step = '0.5';
    this.depthRange.value = String(DEPTH0);
    this.depthRange.setAttribute('aria-label', '지하수면 깊이(미터)');
    this.depthRange.addEventListener('input', () => this.setDepth(Number(this.depthRange.value)));
    const ds = el('span', 'pmp-scale');
    ds.append(el('span', undefined, '2 m'), el('span', undefined, '12 m'));
    this.out.lift = el('span', 'pmp-meter-n');
    dl.append(dt, this.depthRange, ds, this.out.lift);
    p.append(dl);

    // 보기
    const vrow = el('div', 'pmp-views');
    const seg1 = el('div', 'pmp-seg');
    seg1.setAttribute('role', 'radiogroup');
    seg1.setAttribute('aria-label', '보기 방식');
    for (const [v, l] of [['cut', '컷어웨이'], ['outside', '겉모습']] as const) {
      const b = button('pmp-seg-b', l, () => this.setView(v));
      b.setAttribute('role', 'radio');
      b.dataset.v = v;
      this.viewBtns.push(b);
      seg1.append(b);
    }
    const seg2 = el('div', 'pmp-seg');
    seg2.setAttribute('role', 'radiogroup');
    seg2.setAttribute('aria-label', '카메라');
    for (const [v, l] of [['all', '전체'], ['pump', '펌프'], ['valve', '밸브']] as const) {
      const b = button('pmp-seg-b', l, () => this.flyTo(v, false));
      b.setAttribute('role', 'radio');
      b.dataset.v = v;
      this.camBtns.push(b);
      seg2.append(b);
    }
    vrow.append(seg1, seg2);
    p.append(vrow);

    const rrow = el('div', 'pmp-act-row2');
    rrow.append(
      button('pmp-btn pmp-small', '양동이 비우기', () => {
        this.bucketL = 0;
        this.bucketDone = false;
      }),
      button('pmp-btn pmp-small', '처음 상태로', () => this.resetAll())
    );
    p.append(rrow);
    return p;
  }

  private setView(v: ViewMode): void {
    this.view = v;
    this.model?.setView(v);
    this.viewBtns.forEach((b) => {
      const on = b.dataset.v === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    this.buildTags();
  }

  private setDepth(d: number): void {
    this.phys.setDepth(d);
    this.model?.setDepth(d);
    this.phys.step(this.lastS);
    this.buildTags();
  }

  private resetAll(): void {
    this.phys = new PumpPhysics(Number(this.depthRange.value), SPOUT_H_REAL);
    this.phys.step(this.lastS);
    this.strokes = 0;
    this.bucketL = 0;
    this.bucketDone = false;
    this.wetness = 0;
    this.priming = -1;
    this.anim = null;
    this.syncAuto();
  }

  private startPrime(): void {
    if (this.priming >= 0) return;
    this.priming = 0;
  }

  private syncAuto(): void {
    const on = this.anim?.kind === 'auto';
    this.autoBtn.classList.toggle('is-on', on);
    this.autoBtn.setAttribute('aria-pressed', String(on));
    this.autoBtn.textContent = on ? '멈추기' : '계속 펌프질';
  }

  // ───────────────────────── 단계 ─────────────────────────

  private go(i: number, immediate = false): void {
    this.stage = i;
    this.stepBtns.forEach((b, k) => {
      b.classList.toggle('is-on', k === i);
      b.classList.toggle('is-done', k >= 1 && k < i);
      if (k === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    // scrollIntoView는 하단 시트까지 세로로 스크롤해 버린다 — 단계 막대만 가로로 맞춘다
    const btn = this.stepBtns[i];
    if (btn) this.stepsBar.scrollLeft = Math.max(0, btn.offsetLeft - (this.stepsBar.clientWidth - btn.offsetWidth) / 2);
    this.model?.setLimitVisible(true);
    this.renderGuide();
    const s = STAGES[i];
    if (s) this.flyTo(s.view, immediate);
    this.buildTags();
  }

  private renderGuide(): void {
    const s = STAGES[this.stage];
    if (!s) return;
    const g = this.guide;
    g.replaceChildren();
    const head = el('div', 'pmp-head');
    head.append(el('span', 'pmp-badge', this.stage >= 1 && this.stage <= 5 ? String(this.stage) : this.stage === 0 ? '?' : '!'));
    const ht = el('div', 'pmp-head-t');
    ht.append(el('span', 'pmp-eyebrow', `우물 손펌프 · ${this.stage + 1} / ${STAGES.length}`), el('h2', 'pmp-title', s.title));
    head.append(ht);
    g.append(head, el('p', 'pmp-body', s.body), el('p', 'pmp-point', s.point));

    if (this.stage === STAGES.length - 1) {
      const cards = el('div', 'pmp-cards');
      for (const c of CARDS) {
        const card = el('div', 'pmp-card');
        card.append(el('strong', 'pmp-card-t', c.t), el('span', 'pmp-card-b', c.b));
        cards.append(card);
      }
      g.append(cards);
    }
    if (this.stage === 0) {
      const lever = el('p', 'pmp-formula', `지렛대: (받침점~손잡이 끝) ÷ (받침점~로드) = ${LEVER_RATIO.toFixed(1)} → 손으로 누르는 힘의 약 ${LEVER_RATIO.toFixed(1)}배로 피스톤을 들어 올려요.`);
      g.append(lever);
    }
    if (this.stage === 5) {
      g.append(el('p', 'pmp-formula', `한계 높이 = 대기압 ÷ (물의 밀도 × 중력가속도) = ${P0.toLocaleString('ko-KR')} Pa ÷ (1000 kg/m³ × 9.81 m/s²) ≈ ${H_LIMIT.toFixed(1)} m`));
      const quick = el('div', 'pmp-act-row2');
      quick.append(
        button('pmp-btn pmp-small', '깊이 8 m로', () => this.setDepthUI(8)),
        button('pmp-btn pmp-small', '깊이 11 m로', () => this.setDepthUI(11))
      );
      g.append(quick);
    }

    this.live = el('div', 'pmp-live');
    this.lastLiveKey = '';
    g.append(this.live);

    const nav = el('div', 'pmp-nav');
    const prev = button('pmp-btn', '이전', () => this.go(Math.max(0, this.stage - 1)));
    prev.disabled = this.stage === 0;
    const demo = s.demo
      ? button('pmp-btn pmp-demo', s.demoLabel ?? '보여 주기', () => this.runDemo(s.demo!))
      : el('span', 'pmp-nav-gap');
    const next = button('pmp-btn is-primary', this.stage === 0 ? '시작하기' : '다음', () => this.go(Math.min(STAGES.length - 1, this.stage + 1)));
    next.disabled = this.stage === STAGES.length - 1;
    nav.append(prev, demo, next);
    g.append(nav);
    this.refreshLive();
  }

  private setDepthUI(d: number): void {
    this.depthRange.value = String(d);
    this.setDepth(d);
  }

  private runDemo(kind: 'down' | 'up' | 'stroke' | 'prime'): void {
    this.hold = 0;
    if (kind === 'prime') this.startPrime();
    else if (kind === 'down') this.anim = { kind: 'to', target: -PHI_MAX };
    else if (kind === 'up') this.anim = { kind: 'to', target: PHI_MAX };
    else this.anim = { kind: 'stroke', phase: 0 };
    this.syncAuto();
  }

  /** 지금 일어나는 일 — 실제 물리 상태에서 문장을 고른다 */
  private refreshLive(): void {
    const box = this.live;
    if (!box) return;
    const ph = this.phys;
    const moving = this.motionDir();
    const footOpen = this.footOpenT > 0;
    const pistonOpen = this.pistonOpenT > 0;
    let title = '';
    let text = '';
    let tone = 'info';
    if (this.priming >= 0) {
      title = '마중물을 붓는 중';
      text = '물이 피스톤 위에 고이고, 마른 가죽 패킹이 젖어 틈이 막혀요.';
    } else if (!ph.primed) {
      title = moving ? '공기가 새요' : '아직 마중물이 없어요';
      text = moving
        ? '가죽 패킹이 말라 틈으로 공기가 드나들어요. 피스톤 아래 압력이 대기압 그대로라 밸브가 열리지 않아요.'
        : '먼저 펌프질을 해 보고, 그다음 「마중물 붓기」를 눌러 보세요.';
      tone = 'warn';
    } else if (moving > 0 || (moving === 0 && footOpen)) {
      if (!ph.canReach && ph.z > H_LIMIT - 1.2) {
        title = '더는 올라오지 않아요';
        text = `피스톤 아래가 거의 진공인데도 물기둥이 ${ph.z.toFixed(1)} m에서 멈췄어요. 대기압이 떠받칠 수 있는 높이(약 ${H_LIMIT.toFixed(1)} m)보다 올려야 할 높이(${ph.lift.toFixed(1)} m)가 높아요.`;
        tone = 'warn';
      } else if (footOpen && this.footWaterT > 0 && ph.pipeFull) {
        title = '피스톤 ↑ · 아래 밸브 열림';
        text = '피스톤 아래 압력이 낮아져 대기압이 밀어 올린 물이 아래 밸브를 열고 몸통으로 들어와요. 피스톤 밸브는 닫혀 있어요.';
        tone = 'ok';
      } else if (footOpen) {
        title = '피스톤 ↑ · 관 속 공기가 빠져요';
        text = '아래 밸브가 열려 관 속 공기가 피스톤 아래로 빨려 들어가요. 공기가 빠진 만큼 대기압이 물을 관 위로 밀어 올려요.';
        tone = 'ok';
      } else {
        title = '피스톤 ↑';
        text = '피스톤 아래 공간이 넓어지며 압력이 낮아지고 있어요.';
      }
      if (this.spillFlow > 0.05) text += ' 피스톤 위의 물은 들려 올라가 주둥이로 쏟아져요.';
    } else if (moving < 0 || pistonOpen) {
      if (pistonOpen && this.pistonWaterT > 0) {
        title = '피스톤 ↓ · 피스톤 밸브 열림';
        text = '아래 밸브는 닫혀 물이 우물로 돌아가지 못해요. 눌린 물이 피스톤 밸브를 열고 피스톤 위로 넘어가요.';
        tone = 'ok';
      } else if (pistonOpen) {
        title = '피스톤 ↓ · 공기가 위로 빠져요';
        text = '피스톤 아래에 있던 공기가 눌려 피스톤 밸브를 열고 위로 빠져나가요. 아래 밸브는 닫혀 있어요.';
        tone = 'ok';
      } else {
        title = '피스톤 ↓';
        text = '피스톤 아래가 눌리고 있어요. 압력이 대기압보다 높아지면 피스톤 밸브가 열려요.';
      }
    } else {
      title = '멈춤';
      text = ph.pipeFull ? '관과 몸통에 물이 차 있어요. 손잡이를 내리면 바로 물이 나와요.' : '손잡이를 내렸다 올렸다 해 보세요. 3D 손잡이를 끌어도 돼요.';
    }
    const key = `${title}|${text}|${tone}`;
    if (key === this.lastLiveKey) return;
    this.lastLiveKey = key;
    box.className = `pmp-live is-${tone}`;
    box.replaceChildren(el('strong', 'pmp-live-t', `지금: ${title}`), el('span', 'pmp-live-b', text));
  }

  private motionDir(): number {
    return this.sVel > 0.02 ? 1 : this.sVel < -0.02 ? -1 : 0;
  }
  private sVel = 0;

  // ───────────────────────── 카메라·이름표 ─────────────────────────

  private flyTo(key: ViewKey, immediate: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.camKey = key;
    this.camBtns.forEach((b) => {
      const on = b.dataset.v === key;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    const v = VIEWS[key];
    const portrait = window.innerWidth < window.innerHeight;
    const narrow = window.innerWidth < 1100;
    const d = v.d * (portrait ? (key === 'all' ? 1.12 : 1.2) : narrow ? 1.1 : 1);
    const dir = new THREE.Vector3(...v.dir).normalize();
    const t = new THREE.Vector3(...v.t);
    // 세로 화면 전체 보기: 손잡이 끝이 좌상단 홈 버튼 자리(이름표가 숨는 곳)에 걸리지 않게 조금 오른쪽·아래로
    if (portrait && key === 'all') t.add(new THREE.Vector3(-0.35, 0.35, 0));
    const pos = t.clone().addScaledVector(dir, d);
    const view: CameraView = { pos: [pos.x, pos.y, pos.z], target: [t.x, t.y, t.z] };
    ctx.sceneMgr.flyTo(view, immediate);
    this.viewKey = '';
  }

  private updateFrame(): void {
    const ctx = this.ctx;
    if (!ctx || !this.wrap) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let x0 = 0;
    let x1 = W;
    let y0 = 0;
    let y1 = H;
    if (W >= 820) {
      x0 = this.guide.getBoundingClientRect().right;
      x1 = this.side.getBoundingClientRect().left;
      y1 = this.stepsBar.getBoundingClientRect().top;
      y0 = 0;
    } else {
      y0 = 56;
      y1 = this.dock.getBoundingClientRect().top;
    }
    this.bounds = { x0, y0, x1, y1 };
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const key = `${W}x${H}:${Math.round(cx)},${Math.round(cy)}`;
    if (key === this.viewKey) return;
    this.viewKey = key;
    ctx.sceneMgr.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  }

  private anchorOf(name: string): (out: THREE.Vector3) => boolean {
    return (out) => {
      const m = this.model;
      if (!m) return false;
      const p = m.anchor(name);
      if (!p) return false;
      m.root.updateMatrixWorld();
      out.copy(p).applyMatrix4(m.root.matrixWorld);
      return true;
    };
  }

  private buildTags(): void {
    const labels = this.labels;
    if (!labels || !this.model) return;
    const cut = this.view === 'cut';
    const at = (n: string): ((out: THREE.Vector3) => boolean) => this.anchorOf(n);
    const specs: LabelSpec[] = [];
    specs.push({ key: 'grip', text: '손잡이(지렛대)', at: at('grip'), priority: 1 });
    specs.push({ key: 'gripHint', text: '끌어 보세요', at: at('grip'), side: 'below', kind: 'hint', priority: 1, always: true });
    specs.push({ key: 'fulcrum', text: '받침점', at: at('fulcrum'), priority: 1 });
    specs.push({ key: 'link', text: '흔들 링크', at: at('link'), priority: 2 });
    specs.push({ key: 'rod', text: '피스톤 로드', at: at('rod'), side: 'right', priority: 2 });
    specs.push({ key: 'body', text: '몸통(실린더)', at: at('body'), side: 'right', priority: 2 });
    if (cut) {
      specs.push({ key: 'piston', text: '피스톤(가죽 패킹)', at: at('piston'), side: 'below', priority: 1 });
      specs.push({ key: 'pistonValve', text: '피스톤 밸브 · 닫힘', at: at('pistonValve'), tone: 'power', priority: 1 });
      specs.push({ key: 'foot', text: '아래 밸브 · 닫힘', at: at('foot'), tone: 'power', priority: 1 });
    }
    specs.push({ key: 'spout', text: '주둥이', at: at('spout'), side: 'right', priority: 2 });
    specs.push({ key: 'pipe', text: '흡입관', at: at('pipe'), side: 'right', priority: 2 });
    specs.push({ key: 'bucket', text: '양동이', at: at('bucket'), priority: 3 });
    specs.push({ key: 'water', text: '지하수면', at: at('water'), kind: 'info', tone: 'shaft', priority: 2 });
    specs.push({ key: 'atm', text: '대기압', at: at('atm'), side: 'left', kind: 'info', tone: 'control', priority: 2 });
    specs.push({ key: 'limit', text: '약 10 m 한계', at: at('limit'), kind: 'info', tone: 'power', priority: 3 });
    this.valveTxt = { foot: '', piston: '' };
    labels.set(specs);

    this.ticks = [];
    this.tickLayer.replaceChildren();
    for (let d = 2; d <= 12; d += 2) {
      const e = el('div', 'pmp-tick', `${d} m`);
      this.tickLayer.append(e);
      this.ticks.push({ el: e, d });
    }
    this.syncTicks();
  }

  /** 깊이 눈금은 이름표와 함께 켜고 끈다(폭 820px 이상에서만) */
  private syncTicks(): void {
    this.tickLayer.hidden = !(this.labels?.visible ?? true) || window.innerWidth < 820;
  }

  private updateTags(): void {
    const ctx = this.ctx;
    const m = this.model;
    if (!ctx || !m) return;
    const labels = this.labels;
    if (labels) {
      for (const [k, name, open] of [['foot', '아래 밸브', this.footOpenT > 0], ['pistonValve', '피스톤 밸브', this.pistonOpenT > 0]] as const) {
        const txt = `${name} · ${open ? '열림' : '닫힘'}`;
        const slot = k === 'foot' ? 'foot' : 'piston';
        if (this.valveTxt[slot] === txt) continue;
        this.valveTxt[slot] = txt;
        labels.setText(k, txt);
        labels.setState(k, open ? 'open' : 'closed');
      }
      labels.update();
    }
    if (this.tickLayer.hidden) return;
    const cam = ctx.sceneMgr.camera;
    const W = window.innerWidth;
    const H = window.innerHeight;
    m.root.updateMatrixWorld();
    for (const k of this.ticks) {
      const v = this.tmp.copy(m.tickPos(k.d)).applyMatrix4(m.root.matrixWorld).project(cam);
      const x = (v.x + 1) * 0.5 * W;
      const y = (1 - v.y) * 0.5 * H;
      const hidden = v.z > 1 || x < 8 || x > W - 8 || y < 30 || y > H - 6 || (x < 240 && y < 84);
      k.el.style.visibility = hidden ? 'hidden' : 'visible';
      if (!hidden) k.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  // ───────────────────────── 프레임 ─────────────────────────

  update(dt: number, t: number): void {
    void t;
    const m = this.model;
    if (!m || !this.ctx) return;
    const ph = this.phys;

    // 손잡이 입력
    const a = this.anim;
    if (this.hold !== 0) {
      this.phi = clampPhi(this.phi + this.hold * HANDLE_RATE * dt);
    } else if (a?.kind === 'to') {
      this.phi = approach(this.phi, a.target, HANDLE_RATE * dt);
      if (this.phi === a.target) this.anim = null;
    } else if (a?.kind === 'stroke') {
      const target = a.phase === 0 ? -PHI_MAX : PHI_MAX;
      this.phi = approach(this.phi, target, HANDLE_RATE * dt);
      if (this.phi === target) {
        if (a.phase === 0) a.phase = 1;
        else this.anim = null;
      }
    } else if (a?.kind === 'auto') {
      this.autoT += dt * 2.6;
      this.phi = PHI_MAX * Math.cos(this.autoT);
    }

    // 링크 기구 → 피스톤 → 물리(큰 움직임은 잘게 나눠 준정적으로 푼다)
    const s = Math.max(0, Math.min(STROKE, m.setHandle(this.phi)));
    const ds = s - this.lastS;
    this.sVel += (ds / Math.max(dt, 1e-3) - this.sVel) * Math.min(1, dt * 12);
    const n = Math.max(1, Math.ceil(Math.abs(ds) / 0.004));
    let footOpen = false;
    let footWater = 0;
    let pistonOpen = false;
    let pistonWater = 0;
    let spill = 0;
    const z0 = ph.z;
    for (let i = 1; i <= n; i++) {
      ph.step(this.lastS + (ds * i) / n);
      footOpen ||= ph.ev.footOpen;
      footWater += ph.ev.footWater;
      pistonOpen ||= ph.ev.pistonOpen;
      pistonWater += ph.ev.pistonWater;
      spill += ph.ev.spill;
    }
    this.lastS = s;

    // 마중물
    if (this.priming >= 0) {
      const k0 = this.priming;
      this.priming += dt / 1.8;
      if (k0 < 0.25 && this.priming >= 0.25) {
        // 붓기 시작
      }
      if (this.priming >= 0.25 && this.priming < 0.85) {
        ph.wC += (PRIME_L / 1000) * (dt / 1.8 / 0.6);
        this.wetness = Math.min(1, this.wetness + dt / 1.0);
      }
      if (this.priming >= 0.85 && !ph.primed) {
        ph.primed = true;
        ph.step(s);
        spill += ph.ev.spill;
      }
      if (this.priming > 1) {
        this.priming = -1;
        this.ctx.toast('마중물을 부었어요. 이제 펌프질해 보세요!', 'ok', 2200);
      }
    }
    m.setDipper(this.priming, m.waterTopC(ph.wC));
    m.setLeather(ph.primed ? Math.max(this.wetness, 1) : this.wetness);

    // 스트로크 세기: 피스톤이 맨 아래 → 맨 위까지 가면 1회
    const f = s / STROKE;
    if (f < 0.1) this.armed = true;
    if (f > 0.9 && this.armed) {
      this.armed = false;
      this.strokes++;
    }

    // 밸브 표시(짧은 유지 시간으로 깜빡임 방지)
    const hold = 0.18;
    this.footOpenT = footOpen ? hold : Math.max(0, this.footOpenT - dt);
    this.pistonOpenT = pistonOpen ? hold : Math.max(0, this.pistonOpenT - dt);
    this.footWaterT = footWater > 0 && ph.pipeFull ? hold : Math.max(0, this.footWaterT - dt);
    this.pistonWaterT = pistonWater > 0 ? hold : Math.max(0, this.pistonWaterT - dt);
    this.riseT = ph.z > z0 + 1e-6 ? hold : Math.max(0, this.riseT - dt);
    m.setValves(this.footOpenT > 0 ? 1 : 0, this.pistonOpenT > 0 ? 1 : 0, dt);
    m.setAtmosphere(this.footOpenT > 0 ? 1 : 0);

    // 물
    const spillL = spill * 1000;
    if (spillL > 0 && !this.bucketDone) {
      this.bucketL = Math.min(BUCKET_L, this.bucketL + spillL);
      if (this.bucketL >= BUCKET_L - 1e-6) {
        this.bucketDone = true;
        this.ctx.toast(`양동이를 가득 채웠어요! 펌프질 ${this.strokes}번`, 'ok', 3000);
        this.ctx.playSound('ok');
      }
    }
    const rate = spillL / Math.max(dt, 1e-3);
    this.spillFlow += (Math.min(1.5, rate / 1.5) - this.spillFlow) * Math.min(1, dt * (rate > 0 ? 10 : 3));
    m.setStream(this.spillFlow);
    m.setWater(ph.z, ph.lift, ph.wB, ph.wC, s, this.bucketL, BUCKET_L);
    m.emit(
      {
        footWater: footWater > 0 && ph.pipeFull,
        footAir: footOpen && !(footWater > 0 && ph.pipeFull),
        pistonWater: pistonWater > 0,
        pistonAir: pistonOpen && pistonWater <= 0,
        spill: this.spillFlow,
        pipeRise: this.riseT > 0,
        z: ph.z,
        lift: ph.lift
      },
      dt
    );
    m.updateDrops(dt, m.waterTopC(ph.wC));

    this.frameT += dt;
    if (this.frameT > 0.2) {
      this.frameT = 0;
      this.updateFrame();
    }
    this.updateTags();

    this.uiT += dt;
    if (this.uiT > 0.1) {
      this.uiT = 0;
      this.refreshUi();
      this.refreshLive();
    }
  }

  private refreshUi(): void {
    const ph = this.phys;
    const o = this.out;
    const handlePct = Math.round(((this.phi + PHI_MAX) / (2 * PHI_MAX)) * 100);
    if (document.activeElement !== this.handleRange) this.handleRange.value = String(handlePct);
    o.handle!.textContent = `${Math.round(THREE.MathUtils.radToDeg(this.phi))}° · 피스톤 ${Math.round((this.lastS / STROKE) * 100)}% 높이`;

    for (const k of ['foot', 'piston'] as const) {
      const open = (k === 'foot' ? this.footOpenT : this.pistonOpenT) > 0;
      o[`v-${k}`]!.textContent = open ? '열림' : '닫힘';
      o[`vb-${k}`]!.classList.toggle('is-open', open);
    }

    const pr = ph.pB / P0;
    o.press!.textContent = !ph.primed ? '대기압(공기가 샘)' : pr < 0.97 ? `낮음 · 대기압의 ${Math.round(pr * 100)}%` : pr > 1.0001 ? '높음' : '대기압';
    this.bars.press!.style.width = `${Math.min(100, pr * 100)}%`;
    this.bars.press!.classList.toggle('is-low', ph.primed && pr < 0.97);
    o['press-n']!.textContent = '막대 끝 = 대기압(약 101 kPa)';

    o.rise!.textContent = `${ph.z.toFixed(1)} m / ${ph.lift.toFixed(1)} m`;
    this.bars.rise!.style.width = `${Math.min(100, (ph.z / ph.lift) * 100)}%`;
    o['rise-n']!.textContent = ph.pipeFull ? '관이 물로 가득 찼어요' : '지하수면에서 아래 밸브까지';

    o.bucket!.textContent = `${this.bucketL.toFixed(1)} / ${BUCKET_L} L`;
    this.bars.bucket!.style.width = `${(this.bucketL / BUCKET_L) * 100}%`;
    o['bucket-n']!.textContent = this.bucketDone ? '가득 찼어요! 「양동이 비우기」로 다시 도전' : '과제: 양동이를 가득 채워 보세요';

    o.strokes!.textContent = `${this.strokes}번`;
    o.pumped!.textContent = `${ph.pumpedL.toFixed(1)} L`;
    const up = this.sVel > 0.02 && ph.primed;
    o.force!.textContent = up ? `약 ${Math.round(ph.pistonForce() / LEVER_RATIO)} N` : '—';

    o.depth!.textContent = `${ph.depth.toFixed(1)} m`;
    o.lift!.textContent = `올릴 높이 = 깊이 ${ph.depth.toFixed(1)} m + 땅 위 ${VALVE_ABOVE_GROUND} m = ${ph.lift.toFixed(1)} m${ph.lift > H_LIMIT ? ' — 약 10.3 m보다 높아 물이 올라오지 않아요' : ''}`;
    o.lift!.classList.toggle('is-warn', ph.lift > H_LIMIT);
    this.primeBtn.classList.toggle('is-hint', !ph.primed && this.priming < 0);
    this.primeBtn.disabled = this.priming >= 0;
    this.primeBtn.textContent = ph.primed ? '마중물 더 붓기' : '마중물 붓기';
  }
}

function clampPhi(p: number): number {
  return Math.max(-PHI_MAX, Math.min(PHI_MAX, p));
}

function approach(v: number, target: number, step: number): number {
  if (Math.abs(target - v) <= step) return target;
  return v + Math.sign(target - v) * step;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function arrowIcon(kind: 'down' | 'up'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', kind === 'down' ? 'M8 2.5v11M3.5 9 8 13.5 12.5 9' : 'M8 13.5v-11M3.5 7 8 2.5 12.5 7');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}
