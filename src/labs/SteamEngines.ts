// 탐구 실험 13-C — 증기 기관: 뉴커먼의 대기압 기관 · 와트의 증기 기관 · 증기 기관차
// 위쪽 세그먼트로 기관을 고르고, 단계를 누르면 그 단계의 움직임만 천천히 되풀이해 보여 준다(연속 재생은 단계를 차례로 넘김).
// 밸브 열림/닫힘·힘의 방향·증기와 물의 흐름은 3D(색·화살표·흐름 점)와 오른쪽 상태 패널에 함께 표시한다.

import * as THREE from 'three';
import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import { el, button } from '../modes/dom';
import { disposeObject } from '../models/factory';
import { COL, hex, type SteamModel } from './steam/common';
import { NewcomenModel, NEWCOMEN_SEGS } from './steam/newcomen';
import { WattModel, WATT_SEGS, type Load } from './steam/watt';
import { LocoModel, LOCO_SEGS } from './steam/loco';
import { COMPARE, LEGEND, MACHINES, TIMELINE, type MachineDef, type MachineId, type StageDef } from './steam/data';
import type { Seg } from './steam/common';
import { LabLabels, type LabelSpec, type LabelBounds } from './common/labels';

const SEGS: Record<MachineId, (Seg | null)[]> = { newcomen: NEWCOMEN_SEGS, watt: WATT_SEGS, loco: LOCO_SEGS };
const LEGEND_COL: Record<string, number> = { water: COL.water, steam: COL.steam, fire: COL.fire, cold: COL.cold, air: COL.air, used: COL.used };

interface ValveTag {
  key: string;
  text: string;
  valve: number;
}

export class SteamEngines implements AppMode {
  private ctx: ModeContext | null = null;
  private model: SteamModel | null = null;
  private machine: MachineId = 'newcomen';
  private stage = 0;
  private auto = false;
  private autoT = 0;

  private wrap: HTMLElement | null = null;
  private dock!: HTMLElement;
  private tabs!: HTMLElement;
  private stepsBar!: HTMLElement;
  private guide!: HTMLElement;
  private status!: HTMLElement;
  private labels: LabLabels | null = null;
  private bounds: LabelBounds = { x0: 0, y0: 0, x1: 99999, y1: 99999 };
  private tabBtns: HTMLButtonElement[] = [];
  private stepBtns: HTMLButtonElement[] = [];
  private valveTags: ValveTag[] = [];
  private valveRows: { row: HTMLElement; chip: HTMLElement; key: string }[] = [];
  private forceEl!: HTMLElement;
  private liveEl: HTMLElement | null = null;
  private speedEl: HTMLElement | null = null;
  private autoBtn: HTMLButtonElement | null = null;

  private savedMin = 2;
  private savedMax = 18;
  private viewKey = '';
  private frameT = 0;
  private statusT = 0;
  private lastW = 0;
  private lastH = 0;
  private maxErr = 0;
  private puff0 = 0;
  private rev0 = 0;

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const n = this.def().stages.length;
    if (e.key === 'ArrowRight') this.go(Math.min(n - 1, this.stage + 1));
    else if (e.key === 'ArrowLeft') this.go(Math.max(0, this.stage - 1));
    else return;
    e.preventDefault();
  };

  private onResize = (): void => {
    this.flyToStage(false);
  };

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.machine = 'newcomen';
    this.stage = 0;
    this.auto = false;
    this.savedMin = ctx.sceneMgr.controls.minDistance;
    this.savedMax = ctx.sceneMgr.controls.maxDistance;
    ctx.sceneMgr.controls.minDistance = 1.2;
    ctx.sceneMgr.controls.maxDistance = 16;
    this.buildDom(ctx.root);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    this.setMachine('newcomen', true);
    (window as unknown as Record<string, unknown>).__stm = {
      residual: () => this.maxErr,
      resetResidual: () => {
        this.maxErr = 0;
      },
      state: () => ({ machine: this.machine, stage: this.stage, valves: this.model?.valves() ?? [], force: this.model?.force() ?? '' })
    };
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    const ctx = this.ctx;
    if (ctx) {
      ctx.sceneMgr.camera.clearViewOffset();
      ctx.sceneMgr.controls.minDistance = this.savedMin;
      ctx.sceneMgr.controls.maxDistance = this.savedMax;
    }
    this.disposeModel();
    this.wrap?.remove();
    this.wrap = null;
    this.valveTags = [];
    this.labels?.dispose();
    this.labels = null;
    this.tabBtns = [];
    this.stepBtns = [];
    this.valveRows = [];
    this.liveEl = null;
    this.speedEl = null;
    this.autoBtn = null;
    this.viewKey = '';
    this.lastW = 0;
    delete (window as unknown as Record<string, unknown>).__stm;
    this.ctx = null;
  }

  private def(): MachineDef {
    return MACHINES.find((m) => m.id === this.machine) ?? MACHINES[0]!;
  }

  private disposeModel(): void {
    const m = this.model;
    if (!m) return;
    this.ctx?.sceneMgr.remove(m.root);
    disposeObject(m.root);
    m.root.traverse((o) => {
      const p = o as THREE.Points;
      if (p.isPoints) p.geometry.dispose();
    });
    m.dispose();
    this.model = null;
  }

  private setMachine(id: MachineId, immediate = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.disposeModel();
    this.machine = id;
    const m: SteamModel = id === 'newcomen' ? new NewcomenModel() : id === 'watt' ? new WattModel() : new LocoModel();
    this.model = m;
    ctx.sceneMgr.add(m.root);
    this.tabBtns.forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
    this.buildSteps();
    this.buildStatus();
    this.maxErr = 0;
    this.go(0, immediate);
  }

  // ───────────────────────── DOM ─────────────────────────

  private buildDom(root: HTMLElement): void {
    const wrap = el('div', 'stm-wrap');
    this.wrap = wrap;
    this.dock = el('div', 'stm-dock');

    this.tabs = el('div', 'stm-tabs stm-panel');
    this.tabs.setAttribute('role', 'tablist');
    this.tabs.setAttribute('aria-label', '증기 기관 고르기');
    for (const m of MACHINES) {
      const b = el('button', 'stm-tab', m.name);
      b.type = 'button';
      b.dataset.id = m.id;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => {
        if (this.machine !== m.id) this.setMachine(m.id);
      });
      this.tabBtns.push(b);
      this.tabs.append(b);
    }

    this.stepsBar = el('nav', 'stm-steps stm-panel');
    this.stepsBar.setAttribute('aria-label', '단계');
    this.guide = el('section', 'stm-guide stm-panel');
    this.guide.setAttribute('aria-live', 'polite');
    this.status = el('section', 'stm-status stm-panel');
    this.dock.append(this.tabs, this.stepsBar, this.guide, this.status);
    root.append(wrap);
    if (this.ctx) this.labels = new LabLabels(this.ctx, wrap, { bounds: () => this.bounds });
    wrap.append(this.dock);
  }

  private buildSteps(): void {
    const list = el('div', 'stm-steps-list');
    this.stepBtns = [];
    this.def().stages.forEach((s, i) => {
      const b = el('button', `stm-step${i === 0 ? ' is-extra' : ''}`);
      b.type = 'button';
      if (i > 0 && !(this.machine === 'watt' && i === 6)) b.append(el('span', 'stm-step-n', String(i)));
      b.append(el('span', 'stm-step-l', s.short));
      b.addEventListener('click', () => {
        this.setAuto(false);
        this.go(i);
      });
      this.stepBtns.push(b);
      list.append(b);
    });
    this.stepsBar.replaceChildren(list);
  }

  private buildStatus(): void {
    const s = this.status;
    s.replaceChildren();
    s.append(el('h3', 'stm-h3', '지금 상태'));
    const f = el('p', 'stm-force');
    const fi = el('span', 'stm-force-i');
    fi.style.background = hex(COL.force);
    this.forceEl = el('span', 'stm-force-t');
    f.append(fi, this.forceEl);
    s.append(f);
    const vl = el('div', 'stm-valves');
    vl.setAttribute('role', 'list');
    this.valveRows = [];
    for (const v of this.model?.valves() ?? []) {
      const row = el('div', 'stm-valve');
      row.setAttribute('role', 'listitem');
      const chip = el('span', 'stm-chip');
      row.append(el('span', 'stm-valve-n', v.name), chip);
      vl.append(row);
      this.valveRows.push({ row, chip, key: '' });
    }
    s.append(vl);
    this.speedEl = null;
    if (this.machine === 'loco') {
      const lab = el('label', 'stm-reg');
      const top = el('span', 'stm-reg-top');
      const out = el('span', 'stm-reg-v');
      top.append(el('span', 'stm-reg-l', '조절 밸브(가감 밸브)'), out);
      const input = el('input', 'stm-range');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '5';
      const loco = this.model as LocoModel;
      input.value = String(Math.round(loco.regulator * 100));
      input.setAttribute('aria-label', '조절 밸브 열림 정도');
      const sync = (): void => {
        loco.regulator = Number(input.value) / 100;
        out.textContent = `${input.value}%`;
      };
      input.addEventListener('input', sync);
      sync();
      const sc = el('span', 'stm-reg-scale');
      sc.append(el('span', undefined, '닫힘'), el('span', undefined, '활짝'));
      lab.append(top, input, sc);
      s.append(lab);
      this.speedEl = el('p', 'stm-speed');
      s.append(this.speedEl);
    } else if (this.machine === 'watt') {
      this.speedEl = el('p', 'stm-speed');
      s.append(this.speedEl);
    }
    const lg = el('div', 'stm-legend');
    for (const l of LEGEND) {
      if (this.machine === 'loco' && (l.key === 'air' || l.key === 'cold')) continue;
      if (this.machine === 'watt' && l.key === 'air') continue;
      const it = el('span', 'stm-leg');
      const dot = el('span', 'stm-dot');
      dot.style.background = hex(LEGEND_COL[l.key] ?? 0x888888);
      it.append(dot, el('span', undefined, l.label));
      lg.append(it);
    }
    const it = el('span', 'stm-leg');
    const d1 = el('span', 'stm-dot');
    d1.style.background = hex(COL.open);
    const d2 = el('span', 'stm-dot');
    d2.style.background = hex(COL.closed);
    it.append(d1, d2, el('span', undefined, '밸브 열림 / 닫힘'));
    lg.append(it);
    const it2 = el('span', 'stm-leg');
    const d3 = el('span', 'stm-dot is-arrow');
    d3.style.background = hex(COL.force);
    it2.append(d3, el('span', undefined, '힘의 방향'));
    lg.append(it2);
    s.append(lg);
  }

  private refreshStatus(): void {
    const m = this.model;
    if (!m) return;
    this.forceEl.textContent = m.force();
    m.valves().forEach((v, i) => {
      const r = this.valveRows[i];
      if (!r) return;
      const text = v.text ?? (v.open ? '열림' : '닫힘');
      const key = `${v.open}:${text}`;
      if (key === r.key) return;
      r.key = key;
      r.chip.textContent = text;
      r.chip.classList.toggle('is-open', v.open);
      r.chip.classList.toggle('is-closed', !v.open);
    });
    if (this.speedEl) {
      if (m instanceof WattModel) this.speedEl.textContent = `플라이휠 속도 ${m.speedPct()}% (보통 부하일 때 = 100%)`;
      else if (m instanceof LocoModel) this.speedEl.textContent = `동륜 회전: 화면 속 1분에 ${m.wheelRpm()}바퀴 정도(실제보다 느리게)`;
    }
    if (this.liveEl) {
      if (m instanceof LocoModel) {
        const p = m.puffCount - this.puff0;
        const rev = Math.floor((m.turns - this.rev0) * 10) / 10;
        this.liveEl.textContent = `이 단계에서: 동륜 ${Math.max(0, rev).toFixed(1)}바퀴 · 배기 ${p}번`;
      } else if (m instanceof WattModel) {
        this.liveEl.textContent = `속도 ${m.speedPct()}% · 조절 밸브 ${Math.round(m.throttle * 100)}% 열림`;
      }
    }
    // 이름표 속 밸브 상태
    const vs = m.valves();
    for (const t of this.valveTags) {
      const v = vs[t.valve];
      if (!v) continue;
      const state = v.open ? 'open' : 'closed';
      this.labels?.setText(t.key, `${t.text} · ${v.text ?? (v.open ? '열림' : '닫힘')}`);
      this.labels?.setState(t.key, state);
    }
  }

  // ───────────────────────── 단계 ─────────────────────────

  private go(i: number, immediate = false): void {
    this.stage = i;
    this.autoT = 0;
    this.model?.setStage(i);
    this.stepBtns.forEach((b, k) => {
      b.classList.toggle('is-on', k === i);
      b.classList.toggle('is-done', k > 0 && k < i);
      if (k === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    this.stepBtns[i]?.scrollIntoView({ block: 'nearest', inline: 'center' });
    const m = this.model;
    if (m instanceof LocoModel) {
      this.puff0 = m.puffCount;
      this.rev0 = m.turns;
    }
    this.renderGuide();
    this.buildTags();
    this.refreshStatus();
    this.flyToStage(immediate);
  }

  private setAuto(on: boolean): void {
    this.auto = on;
    this.autoT = 0;
    if (this.autoBtn) {
      this.autoBtn.classList.toggle('is-on', on);
      this.autoBtn.setAttribute('aria-pressed', String(on));
      const l = this.autoBtn.querySelector('.stm-auto-l');
      if (l) l.textContent = on ? '멈춤' : '연속 재생';
      this.autoBtn.style.setProperty('--p', '0');
    }
  }

  private dwell(): number {
    const seg = SEGS[this.machine][this.stage];
    return seg ? seg.dur * 2 + 2.4 : 8;
  }

  private renderGuide(): void {
    const d = this.def();
    const s = d.stages[this.stage];
    if (!s) return;
    const g = this.guide;
    g.replaceChildren();
    this.liveEl = null;
    const head = el('div', 'stm-head');
    const n = d.stages.length - (d.id === 'watt' ? 2 : 1);
    const numbered = this.stage > 0 && this.stage <= n;
    head.append(el('span', 'stm-badge', numbered ? String(this.stage) : this.stage === 0 ? '구조' : '비교'));
    const ht = el('div', 'stm-head-t');
    ht.append(el('span', 'stm-eyebrow', numbered ? `${d.name} · ${this.stage} / ${n}` : d.name), el('h2', 'stm-title', s.title));
    head.append(ht);
    g.append(head, el('p', 'stm-body', s.body), el('p', 'stm-point', s.point));
    if (s.note) g.append(el('p', 'stm-note', s.note));
    const ex = this.extra(s);
    if (ex) g.append(ex);
    if (SEGS[this.machine][this.stage]) g.append(el('p', 'stm-hint', '이 단계의 움직임만 천천히 되풀이해서 보여 줘요.'));
    g.append(this.navRow());
  }

  private extra(s: StageDef): HTMLElement | null {
    const box = el('div', 'stm-extra');
    switch (s.extra) {
      case 'timeline': {
        const card = el('div', 'stm-card');
        card.append(el('strong', 'stm-card-t', '증기 기관의 발전'));
        const ol = el('ol', 'stm-time');
        for (const it of TIMELINE) {
          const li = el('li', `stm-time-i${it.id === this.machine ? ' is-on' : ''}`);
          li.append(el('span', 'stm-time-w', it.when), el('span', 'stm-time-d', it.what));
          ol.append(li);
        }
        card.append(ol);
        box.append(card);
        return box;
      }
      case 'compare': {
        const tbl = el('div', 'stm-cmp');
        tbl.setAttribute('role', 'table');
        const hr = el('div', 'stm-cmp-r is-head');
        hr.setAttribute('role', 'row');
        hr.append(el('span', undefined, ''), el('span', undefined, '뉴커먼'), el('span', undefined, '와트'));
        tbl.append(hr);
        for (const r of COMPARE) {
          const row = el('div', 'stm-cmp-r');
          row.setAttribute('role', 'row');
          row.append(el('span', 'stm-cmp-k', r.k), el('span', undefined, r.n), el('span', undefined, r.w));
          tbl.append(row);
        }
        const bars = el('div', 'stm-coal');
        bars.append(el('strong', 'stm-card-t', '같은 일을 할 때 드는 석탄'));
        for (const [name, w, cls] of [['뉴커먼', 100, 'is-n'], ['와트', 30, 'is-w']] as [string, number, string][]) {
          const row = el('div', 'stm-coal-r');
          const bar = el('span', `stm-coal-b ${cls}`);
          bar.style.width = `${w}%`;
          const track = el('span', 'stm-coal-track');
          track.append(bar);
          row.append(el('span', 'stm-coal-n', name), track);
          bars.append(row);
        }
        bars.append(el('span', 'stm-coal-note', '맛보기 그림이에요 — 정확한 비율이 아니라 "훨씬 적다"는 뜻이에요.'));
        box.append(tbl, bars);
        return box;
      }
      case 'governor': {
        const w = this.model as WattModel;
        const seg = el('div', 'stm-seg');
        seg.setAttribute('role', 'radiogroup');
        seg.setAttribute('aria-label', '기계에 걸리는 부하');
        const opts: [Load, string][] = [['light', '부하 작게'], ['normal', '보통'], ['heavy', '부하 크게']];
        for (const [v, label] of opts) {
          const b = el('button', `stm-seg-b${w.load === v ? ' is-on' : ''}`, label);
          b.type = 'button';
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', String(w.load === v));
          b.addEventListener('click', () => {
            w.setLoad(v);
            this.renderGuide();
          });
          seg.append(b);
        }
        const tg = el('button', `stm-toggle${w.governor ? ' is-on' : ''}`);
        tg.type = 'button';
        tg.setAttribute('aria-pressed', String(w.governor));
        tg.append(el('span', 'stm-toggle-k'), el('span', undefined, w.governor ? '조속기 켜짐' : '조속기 꺼짐(연결봉 분리 — 밸브 고정)'));
        tg.addEventListener('click', () => {
          w.governor = !w.governor;
          this.renderGuide();
        });
        const live = el('p', 'stm-live');
        this.liveEl = live;
        box.append(el('span', 'stm-field-l', '공장 기계가 무거워지거나 가벼워지면?'), seg, tg, live, el('p', 'stm-note', '조속기를 끄고 부하를 바꿔 보면 속도가 훨씬 크게 변해요.'));
        return box;
      }
      case 'regulator':
        box.append(el('p', 'stm-note', '조절 밸브를 닫으면(0%) 증기가 실린더로 가지 않아 기관차가 서서히 멈춰요.'));
        return box;
      case 'puff': {
        const live = el('p', 'stm-live');
        this.liveEl = live;
        box.append(live, el('p', 'stm-note', '양쪽 실린더가 각각 앞·뒤로 한 번씩 배기하니 1바퀴에 2 × 2 = 4번이에요.'));
        return box;
      }
      default:
        return null;
    }
  }

  private navRow(): HTMLElement {
    const nav = el('div', 'stm-nav');
    const last = this.def().stages.length - 1;
    const prev = button('stm-btn', '이전', () => {
      this.setAuto(false);
      this.go(Math.max(0, this.stage - 1));
    });
    prev.disabled = this.stage === 0;
    const auto = el('button', `stm-btn stm-auto${this.auto ? ' is-on' : ''}`);
    auto.type = 'button';
    auto.setAttribute('aria-pressed', String(this.auto));
    auto.append(el('span', 'stm-auto-bar'), el('span', 'stm-auto-l', this.auto ? '멈춤' : '연속 재생'));
    auto.addEventListener('click', () => {
      const on = !this.auto;
      if (on && this.stage >= last) this.go(0);
      this.setAuto(on);
    });
    this.autoBtn = auto;
    const next = button('stm-btn is-primary', this.stage === 0 ? '시작하기' : '다음', () => {
      this.setAuto(false);
      this.go(Math.min(last, this.stage + 1));
    });
    next.disabled = this.stage === last;
    nav.append(prev, auto, next);
    if (this.labels) nav.append(this.labels.button);
    return nav;
  }

  // ───────────────────────── 카메라 ─────────────────────────

  private flyToStage(immediate: boolean): void {
    const ctx = this.ctx;
    const s = this.def().stages[this.stage];
    if (!ctx || !s) return;
    const v = s.view;
    const portrait = window.innerWidth < window.innerHeight;
    const narrow = window.innerWidth < 1100;
    const d = v.d * (portrait ? 1.12 : narrow ? 1.08 : 1);
    const t = new THREE.Vector3(...v.t);
    const az = THREE.MathUtils.degToRad(v.az);
    const elv = THREE.MathUtils.degToRad(v.el);
    const pos = t.clone().add(new THREE.Vector3(Math.cos(elv) * Math.sin(az), Math.sin(elv), Math.cos(elv) * Math.cos(az)).multiplyScalar(d));
    const view: CameraView = { pos: [pos.x, pos.y, pos.z], target: [t.x, t.y, t.z] };
    ctx.sceneMgr.flyTo(view, immediate);
    this.viewKey = '';
  }

  /** 패널이 가리지 않는 영역의 가운데가 화면 중심이 되도록 투영을 옮긴다 */
  private updateFrame(): void {
    const ctx = this.ctx;
    if (!ctx || !this.wrap) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let x0 = 0;
    let x1 = W;
    let y0 = 0;
    let y1 = H;
    if (W >= 1100) {
      x0 = this.guide.getBoundingClientRect().right;
      x1 = this.status.getBoundingClientRect().left;
      y0 = this.tabs.getBoundingClientRect().bottom;
      y1 = this.stepsBar.getBoundingClientRect().top;
    } else {
      y0 = 56;
      y1 = this.dock.getBoundingClientRect().top;
    }
    this.bounds = { x0, y0: Math.max(y0, 0), x1, y1 };
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const key = `${W}x${H}:${Math.round(cx)},${Math.round(cy)}`;
    if (key === this.viewKey && W === this.lastW && H === this.lastH) return;
    this.viewKey = key;
    this.lastW = W;
    this.lastH = H;
    ctx.sceneMgr.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  }

  // ───────────────────────── 3D 이름표 ─────────────────────────

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
    this.valveTags = [];
    if (!labels || !this.model) return;
    const s = this.def().stages[this.stage];
    if (!s) return;
    const specs: LabelSpec[] = [];
    const used = new Set<string>();
    const add = (d: { a: string; t: string; v?: number; below?: boolean }, key: string, priority: 1 | 3): void => {
      specs.push({ key, text: d.t, at: this.anchorOf(d.a), side: d.below ? 'below' : 'above', priority });
      if (d.v !== undefined) this.valveTags.push({ key, text: d.t, valve: d.v });
    };
    s.tags.forEach((d, i) => {
      used.add(d.a);
      add(d, `${d.a}${specs.some((x) => x.key === d.a) ? i : ''}`, 1);
    });
    for (const d of this.def().parts) {
      if (used.has(d.a)) continue;
      add(d, d.a, 3);
    }
    labels.set(specs);
  }

  // ───────────────────────── 프레임 ─────────────────────────

  update(dt: number, t: number): void {
    const m = this.model;
    if (!m) return;
    m.update(dt, t);
    this.maxErr = Math.max(this.maxErr, m.residual());
    this.statusT += dt;
    if (this.statusT > 0.1) {
      this.statusT = 0;
      this.refreshStatus();
    }
    this.frameT += dt;
    if (this.frameT > 0.2 || window.innerWidth !== this.lastW || window.innerHeight !== this.lastH) {
      this.frameT = 0;
      this.updateFrame();
    }
    this.labels?.update();
    if (this.auto) {
      this.autoT += dt;
      const dw = this.dwell();
      this.autoBtn?.style.setProperty('--p', String(Math.min(1, this.autoT / dw)));
      if (this.autoT >= dw) {
        const last = this.def().stages.length - 1;
        if (this.stage >= last) this.setAuto(false);
        else {
          this.go(this.stage + 1);
          this.autoT = 0;
        }
      }
    }
  }
}
