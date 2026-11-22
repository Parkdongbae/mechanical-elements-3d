// 탐구 실험 — 자전거 기어 변속
// 요즘 자전거 3종(생활 3×7, 로드 2×11, MTB 1×12)의 실제 잇수로 앞·뒤 기어를 바꿔 보며
// 기어비·페달 1바퀴 이동 거리·속도를 공식으로 계산하고, 언제 어떤 기어를 쓰는지 익힌다.

import type { AppMode, ModeContext } from '../modes/types';
import { el, button } from '../modes/dom';
import { BikeDrive } from './bike/drivetrain';
import {
  BIKES,
  TASKS,
  ZONES,
  getBike,
  gearRatio,
  development,
  speedKmh,
  zoneOf,
  pedalWeight,
  type BikeId,
  type BikeSpec
} from './bike/spec';

const NARROW = '(max-width: 819px)';
const SVG_NS = 'http://www.w3.org/2000/svg';

const fmt = (v: number, d: number): string => v.toFixed(d);

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

interface ShifterCtl {
  box: HTMLElement;
  down: HTMLButtonElement;
  up: HTMLButtonElement;
  value: HTMLElement;
  pips: HTMLElement;
  note: HTMLElement;
}

export class BikeGears implements AppMode {
  private ctx: ModeContext | null = null;
  private wrap: HTMLElement | null = null;
  private drive: BikeDrive | null = null;
  private mql: MediaQueryList | null = null;

  private bike: BikeSpec = getBike('city');
  private front = 0;
  private rear = 0;
  private cadence = 70;
  private slow = false;
  private sideTab: 'table' | 'task' = 'table';
  private taskIndex = 0;
  private taskPassed = false;

  // DOM 참조
  private typeBtns = new Map<BikeId, HTMLButtonElement>();
  private specEl!: HTMLElement;
  private gearEl!: HTMLElement;
  private speedEl!: HTMLElement;
  private ratioEl!: HTMLElement;
  private devEl!: HTMLElement;
  private wheelEl!: HTMLElement;
  private formulaEl!: HTMLElement;
  private weightFill!: HTMLElement;
  private zoneEl!: HTMLElement;
  private zoneName!: HTMLElement;
  private zoneDesc!: HTMLElement;
  private warnEl!: HTMLElement;
  private miniEl!: HTMLElement;
  private frontCtl!: ShifterCtl;
  private rearCtl!: ShifterCtl;
  private cadenceInput!: HTMLInputElement;
  private cadenceVal!: HTMLElement;
  private slowBtn!: HTMLButtonElement;
  private tabBtns = new Map<'table' | 'task', HTMLButtonElement>();
  private tableBox!: HTMLElement;
  private taskBox!: HTMLElement;
  private cells: HTMLButtonElement[][] = [];
  private noteEl!: HTMLElement;

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') this.shift(this.front - 1, this.rear);
    else if (e.key === 'ArrowRight') this.shift(this.front + 1, this.rear);
    else if (e.key === 'ArrowUp') this.shift(this.front, this.rear + 1);
    else if (e.key === 'ArrowDown') this.shift(this.front, this.rear - 1);
    else return;
    e.preventDefault();
  };

  private onMq = (): void => this.flyCamera(false);

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.bike = getBike('city');
    this.front = this.bike.defaultFront;
    this.rear = this.bike.defaultRear;
    this.cadence = 70;
    this.slow = false;
    this.sideTab = 'table';
    this.taskIndex = 0;
    this.taskPassed = false;
    this.buildDom(ctx.root);
    this.buildDrive();
    this.renderBikeUi();
    this.refresh();
    this.flyCamera(true);
    this.mql = window.matchMedia(NARROW);
    this.mql.addEventListener('change', this.onMq);
    window.addEventListener('keydown', this.onKey);
    // 검증 스크립트(scripts/11-bike.mjs)가 근접 촬영 시점을 지정할 때 쓰는 훅
    (window as unknown as Record<string, unknown>).__bikeCam = (v: number[]): void => {
      if (v.length === 6) ctx.sceneMgr.flyTo({ pos: [v[0]!, v[1]!, v[2]!], target: [v[3]!, v[4]!, v[5]!] }, true);
    };
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    delete (window as unknown as Record<string, unknown>).__bikeCam;
    this.mql?.removeEventListener('change', this.onMq);
    this.mql = null;
    if (this.drive && this.ctx) {
      this.ctx.sceneMgr.remove(this.drive.group);
      this.drive.dispose();
    }
    this.drive = null;
    this.wrap?.remove();
    this.wrap = null;
    this.typeBtns.clear();
    this.tabBtns.clear();
    this.cells = [];
    this.ctx = null;
  }

  update(dt: number): void {
    this.drive?.update(dt, this.cadence, this.slow ? 0.25 : 1);
  }

  // ─────────────────────────── 상태 변경 ───────────────────────────

  private buildDrive(): void {
    if (!this.ctx) return;
    if (this.drive) {
      this.ctx.sceneMgr.remove(this.drive.group);
      this.drive.dispose();
    }
    this.drive = new BikeDrive(this.bike, this.front, this.rear);
    this.ctx.sceneMgr.add(this.drive.group);
  }

  private setBike(id: BikeId): void {
    if (id === this.bike.id) return;
    this.bike = getBike(id);
    this.front = this.bike.defaultFront;
    this.rear = this.bike.defaultRear;
    this.buildDrive();
    this.renderBikeUi();
    this.refresh();
    this.flyCamera(false);
  }

  private shift(front: number, rear: number): void {
    const f = Math.max(0, Math.min(this.bike.rings.length - 1, front));
    const r = Math.max(0, Math.min(this.bike.cogs.length - 1, rear));
    if (f === this.front && r === this.rear) return;
    this.front = f;
    this.rear = r;
    this.drive?.shiftTo(f, r);
    this.refresh();
  }

  private flyCamera(immediate: boolean): void {
    if (!this.ctx || !this.drive) return;
    const c = this.drive.center();
    const narrow = window.matchMedia(NARROW).matches;
    if (narrow) {
      this.ctx.sceneMgr.flyTo({ pos: [c.x - 0.6, c.y + 1.0, c.z + 7.0], target: [c.x - 0.15, c.y - 1.7, c.z] }, immediate);
    } else {
      this.ctx.sceneMgr.flyTo({ pos: [c.x - 1.0, c.y + 1.7, c.z + 5.4], target: [c.x + 0.2, c.y - 0.3, c.z] }, immediate);
    }
  }

  // ─────────────────────────── DOM ───────────────────────────

  private buildDom(root: HTMLElement): void {
    const wrap = el('div', 'bike-wrap');
    this.wrap = wrap;
    const sheet = el('div', 'bike-sheet');
    wrap.append(sheet);

    // ── 왼쪽: 자전거 종류 + 계산 결과 ──
    const info = el('section', 'bike-panel bike-info');
    info.setAttribute('aria-label', '현재 기어와 속도');
    const types = el('div', 'bike-types');
    types.setAttribute('role', 'tablist');
    types.setAttribute('aria-label', '자전거 종류');
    for (const b of BIKES) {
      const btn = button('bike-type', '', () => this.setBike(b.id));
      btn.setAttribute('role', 'tab');
      btn.append(el('span', 'bike-type-name', b.name), el('span', 'bike-type-combo', b.combo));
      types.append(btn);
      this.typeBtns.set(b.id, btn);
    }
    this.specEl = el('p', 'bike-spec');

    const readout = el('div', 'bike-readout');
    this.gearEl = el('div', 'bike-gear');
    const speedRow = el('div', 'bike-speed-row');
    this.speedEl = el('span', 'bike-speed', '0.0');
    speedRow.append(el('span', 'bike-speed-label', '속도'), this.speedEl, el('span', 'bike-speed-unit', 'km/h'));
    const stats = el('dl', 'bike-stats');
    const stat = (label: string): HTMLElement => {
      const d = el('div', 'bike-stat');
      const v = el('dd', 'bike-stat-val');
      d.append(el('dt', 'bike-stat-label', label), v);
      stats.append(d);
      return v;
    };
    this.ratioEl = stat('기어비 (앞÷뒤)');
    this.devEl = stat('페달 1바퀴에');
    this.wheelEl = stat('뒷바퀴 회전');
    this.formulaEl = el('p', 'bike-formula');

    const weight = el('div', 'bike-weight');
    const track = el('div', 'bike-weight-track');
    this.weightFill = el('div', 'bike-weight-fill');
    track.append(this.weightFill);
    track.setAttribute('role', 'meter');
    track.setAttribute('aria-label', '페달 무게감');
    weight.append(el('span', 'bike-weight-head', '페달 무게감'), el('span', 'bike-weight-end', '가벼움'), track, el('span', 'bike-weight-end', '무거움'));

    this.zoneEl = el('div', 'bike-zone');
    this.zoneName = el('strong', 'bike-zone-name');
    this.zoneDesc = el('span', 'bike-zone-desc');
    this.zoneEl.append(el('span', 'bike-zone-tag', '이럴 때 써요'), this.zoneName, this.zoneDesc);
    this.warnEl = el('p', 'bike-warn');
    this.warnEl.setAttribute('role', 'status');

    readout.append(this.gearEl, speedRow, stats, this.formulaEl, weight, this.zoneEl, this.warnEl);
    info.append(types, this.specEl, readout);

    // ── 아래: 변속 레버(왼손=앞, 오른손=뒤) + 케이던스 ──
    const dock = el('section', 'bike-panel bike-dock');
    dock.setAttribute('aria-label', '변속 조작');
    this.miniEl = el('div', 'bike-mini');
    const mkShifter = (side: 'front' | 'rear'): ShifterCtl => {
      const box = el('div', `bike-shifter bike-shifter-${side}`);
      const head = el('div', 'bike-shifter-head');
      head.append(
        el('span', 'bike-hand', side === 'front' ? '왼손' : '오른손'),
        el('span', 'bike-shifter-title', side === 'front' ? '앞 변속 (체인링)' : '뒤 변속 (스프로킷)'),
        el('kbd', 'bike-kbd', side === 'front' ? '← →' : '↓ ↑')
      );
      const row = el('div', 'bike-shifter-row');
      const down = button('bike-shift-btn', '', () =>
        side === 'front' ? this.shift(this.front - 1, this.rear) : this.shift(this.front, this.rear - 1)
      );
      const up = button('bike-shift-btn', '', () =>
        side === 'front' ? this.shift(this.front + 1, this.rear) : this.shift(this.front, this.rear + 1)
      );
      down.append(el('span', 'bike-shift-sign', '−'), el('span', 'bike-shift-txt', '가볍게'));
      up.append(el('span', 'bike-shift-txt', '무겁게'), el('span', 'bike-shift-sign', '+'));
      down.setAttribute('aria-label', side === 'front' ? '앞 기어 한 단 내리기 (작은 체인링, 가볍게)' : '뒤 기어 한 단 내리기 (큰 스프로킷, 가볍게)');
      up.setAttribute('aria-label', side === 'front' ? '앞 기어 한 단 올리기 (큰 체인링, 무겁게)' : '뒤 기어 한 단 올리기 (작은 스프로킷, 무겁게)');
      const mid = el('div', 'bike-shift-mid');
      const value = el('div', 'bike-shift-val');
      const pips = el('div', 'bike-pips');
      pips.setAttribute('aria-hidden', 'true');
      mid.append(value, pips);
      row.append(down, mid, up);
      const note = el('p', 'bike-shifter-note');
      box.append(head, row, note);
      return { box, down, up, value, pips, note };
    };
    this.frontCtl = mkShifter('front');
    this.rearCtl = mkShifter('rear');

    const cad = el('div', 'bike-cadence');
    const cadHead = el('div', 'bike-cadence-head');
    this.cadenceVal = el('span', 'bike-cadence-val');
    const cadLabel = el('label', 'bike-cadence-label', '페달 회전수(케이던스)');
    cadLabel.htmlFor = 'bike-cadence-input';
    cadHead.append(cadLabel, this.cadenceVal);
    this.cadenceInput = el('input', 'bike-range');
    this.cadenceInput.type = 'range';
    this.cadenceInput.id = 'bike-cadence-input';
    this.cadenceInput.min = '40';
    this.cadenceInput.max = '110';
    this.cadenceInput.step = '5';
    this.cadenceInput.value = String(this.cadence);
    this.cadenceInput.addEventListener('input', () => {
      this.cadence = Number(this.cadenceInput.value);
      this.refresh();
    });
    const cadFoot = el('div', 'bike-cadence-foot');
    this.slowBtn = button('bike-slow', '천천히 보기', () => {
      this.slow = !this.slow;
      this.refresh();
    });
    cadFoot.append(el('span', 'bike-cadence-hint', '40'), el('span', 'bike-cadence-hint', '110 rpm'));
    cad.append(cadHead, this.cadenceInput, cadFoot, this.slowBtn);
    dock.append(this.miniEl, this.frontCtl.box, cad, this.rearCtl.box);

    // ── 오른쪽: 기어비 표 / 지형 과제 ──
    const side = el('section', 'bike-panel bike-side');
    const tabs = el('div', 'bike-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [id, label] of [['table', '전체 기어비 표'], ['task', '지형 과제']] as const) {
      const b = button('bike-tab', label, () => {
        this.sideTab = id;
        this.renderSideTab();
      });
      b.setAttribute('role', 'tab');
      tabs.append(b);
      this.tabBtns.set(id, b);
    }
    this.tableBox = el('div', 'bike-table-box');
    this.taskBox = el('div', 'bike-task-box');
    side.append(tabs, this.tableBox, this.taskBox);

    sheet.append(dock, info, side);
    root.append(wrap);
  }

  /** 자전거 종류가 바뀔 때만 다시 만드는 부분(표, 단 표시 점) */
  private renderBikeUi(): void {
    const b = this.bike;
    for (const [id, btn] of this.typeBtns) {
      const on = id === b.id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
    }
    const ringsTxt = [...b.rings].reverse().join('·');
    const cogsTxt = `${b.cogs[b.cogs.length - 1]}–${b.cogs[0]}T ${b.cogs.length}장`;
    this.specEl.textContent = `앞 ${ringsTxt}T ${b.rings.length}장 · 뒤 ${cogsTxt} · 타이어 ${b.tire} (둘레 ${fmt(b.circumference, 2)} m)`;

    for (const [ctl, n] of [[this.frontCtl, b.rings.length], [this.rearCtl, b.cogs.length]] as const) {
      ctl.pips.replaceChildren(...Array.from({ length: n }, () => el('span', 'bike-pip')));
    }
    const single = b.rings.length === 1;
    this.frontCtl.box.classList.toggle('is-single', single);
    this.frontCtl.note.textContent = single ? '앞 체인링이 1장이라 앞 변속기가 없어요. 뒤 12단으로만 바꿔요.' : '';

    // 기어비 표: 행 = 뒤 스프로킷(1단~), 열 = 앞 체인링(1단~)
    const table = el('div', 'bike-table');
    table.style.setProperty('--cols', String(b.rings.length));
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', '앞 × 뒤 기어비 표');
    table.append(el('div', 'bike-th bike-th-corner', '뒤 \\ 앞'));
    b.rings.forEach((t, f) => {
      const th = el('div', 'bike-th');
      th.append(el('span', 'bike-th-step', `앞 ${f + 1}단`), el('span', 'bike-th-teeth', `${t}T`));
      table.append(th);
    });
    this.cells = b.rings.map(() => []);
    b.cogs.forEach((t, r) => {
      const th = el('div', 'bike-th bike-th-row');
      th.append(el('span', 'bike-th-step', `뒤 ${r + 1}단`), el('span', 'bike-th-teeth', `${t}T`));
      table.append(th);
      b.rings.forEach((rt, f) => {
        const ratio = gearRatio(rt, t);
        const z = zoneOf(development(ratio, b.circumference));
        const cell = button('bike-cell', '', () => this.shift(f, r));
        cell.style.setProperty('--zone', z.color);
        cell.classList.toggle('is-cross', b.crossChain(f, r));
        const rEl = el('span', 'bike-cell-ratio', fmt(ratio, 2));
        const sEl = el('span', 'bike-cell-speed');
        cell.append(rEl, sEl);
        cell.setAttribute('aria-label', `앞 ${rt}T × 뒤 ${t}T, 기어비 ${fmt(ratio, 2)}, ${z.name}`);
        table.append(cell);
        this.cells[f]![r] = cell;
      });
    });

    const legend = el('div', 'bike-legend');
    legend.append(el('p', 'bike-legend-title', '쓰임새 구분 (페달 1바퀴에 가는 거리 기준, 대략)'));
    const ranges = ['2.6 m 미만', '2.6~4.4 m', '4.4~6.6 m', '6.6 m 이상'];
    ZONES.forEach((z, i) => {
      const item = el('div', 'bike-legend-item');
      const sw = el('span', 'bike-legend-sw');
      sw.style.setProperty('--zone', z.color);
      item.append(sw, el('span', 'bike-legend-name', z.name), el('span', 'bike-legend-range', ranges[i] ?? ''));
      legend.append(item);
    });
    if (b.rings.length > 1) {
      const x = el('div', 'bike-legend-item');
      x.append(el('span', 'bike-legend-sw is-cross'), el('span', 'bike-legend-name', '체인이 비스듬한 조합'), el('span', 'bike-legend-range', '권장 안 함'));
      legend.append(x);
    }
    this.noteEl = el('p', 'bike-table-note');
    this.noteEl.textContent = this.overlapNote(b);
    this.tableBox.replaceChildren(table, legend, this.noteEl);
    this.renderSideTab();
  }

  /** 서로 다른 체인링에서 기어비가 거의 같은 조합 찾기 — "단 수 = 서로 다른 속도 수"가 아님을 보여 준다 */
  private overlapNote(b: BikeSpec): string {
    if (b.rings.length < 2) return '앞이 1장이라 12단 모두 기어비가 서로 달라요. 뒤 스프로킷 잇수 차이가 커서 넓은 범위를 다뤄요.';
    let best: { a: string; c: string; d: number } | null = null;
    for (let f1 = 0; f1 < b.rings.length; f1++) {
      for (let f2 = f1 + 1; f2 < b.rings.length; f2++) {
        for (let r1 = 0; r1 < b.cogs.length; r1++) {
          for (let r2 = 0; r2 < b.cogs.length; r2++) {
            if (b.crossChain(f1, r1) || b.crossChain(f2, r2)) continue;
            const g1 = gearRatio(b.rings[f1]!, b.cogs[r1]!);
            const g2 = gearRatio(b.rings[f2]!, b.cogs[r2]!);
            const d = Math.abs(g1 - g2) / g1;
            if (!best || d < best.d) {
              best = { a: `${b.rings[f1]}T×${b.cogs[r1]}T(${fmt(g1, 2)})`, c: `${b.rings[f2]}T×${b.cogs[r2]}T(${fmt(g2, 2)})`, d };
            }
          }
        }
      }
    }
    if (!best) return '';
    return `${b.rings.length * b.cogs.length}단이지만 ${best.a}와 ${best.c}처럼 기어비가 거의 같은 칸도 있어요.`;
  }

  private renderSideTab(): void {
    for (const [id, b] of this.tabBtns) {
      const on = id === this.sideTab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    }
    this.tableBox.hidden = this.sideTab !== 'table';
    this.taskBox.hidden = this.sideTab !== 'task';
    this.renderTask();
  }

  private renderTask(): void {
    const box = this.taskBox;
    if (this.taskIndex >= TASKS.length) {
      const done = el('div', 'bike-task-done');
      done.append(
        el('strong', 'bike-task-title', '지형 과제를 모두 통과했어요!'),
        el('p', 'bike-task-text', '오르막·맞바람에는 기어비가 작은(가벼운) 기어, 평지·내리막에는 기어비가 큰(무거운) 기어를 써요. 다른 자전거로도 해 보세요.'),
        button('bike-btn', '처음부터 다시', () => {
          this.taskIndex = 0;
          this.taskPassed = false;
          this.checkTask();
          this.renderTask();
        })
      );
      box.replaceChildren(done);
      return;
    }
    const task = TASKS[this.taskIndex]!;
    const zone = ZONES[task.zone]!;
    const head = el('div', 'bike-task-head');
    head.append(el('span', 'bike-task-step', `과제 ${this.taskIndex + 1} / ${TASKS.length}`), el('strong', 'bike-task-title', task.title));
    const ratio = gearRatio(this.bike.rings[this.front]!, this.bike.cogs[this.rear]!);
    const cur = zoneOf(development(ratio, this.bike.circumference));
    const status = el('div', `bike-task-status${this.taskPassed ? ' is-ok' : ''}`);
    status.setAttribute('role', 'status');
    if (this.taskPassed) {
      status.append(el('strong', '', '통과!'), el('span', '', ` 지금 기어는 '${cur.name}' 구간이에요.`));
    } else {
      status.append(el('span', '', `지금 기어: '${cur.name}' 구간 — 앞·뒤 변속으로 알맞은 기어를 찾아보세요.`));
    }
    const parts: Element[] = [head, this.terrainSvg(task.slope, task.wind === true), el('p', 'bike-task-text', task.text), status];
    if (this.taskPassed) {
      const extra = this.bike.crossChain(this.front, this.rear) ? ' 다만 체인이 비스듬한 조합이니 다른 체인링으로 같은 구간을 찾으면 더 좋아요.' : '';
      parts.push(el('p', 'bike-task-hint', `알맞은 구간: ${zone.name}.${extra}`));
      parts.push(button('bike-btn bike-btn-primary', this.taskIndex + 1 < TASKS.length ? '다음 과제' : '결과 보기', () => {
        this.taskIndex++;
        this.taskPassed = false;
        this.checkTask();
        this.renderTask();
      }));
    }
    box.replaceChildren(...parts);
  }

  private terrainSvg(slope: number, wind: boolean): SVGSVGElement {
    const svg = svgEl('svg', { viewBox: '0 0 240 80', class: 'bike-terrain', 'aria-hidden': 'true' });
    const y0 = 62 + slope * 30;
    const y1 = 62 - slope * 30;
    svg.append(svgEl('path', { d: `M0 ${y0} L240 ${y1} L240 80 L0 80 Z`, class: 'bike-terrain-ground' }));
    svg.append(svgEl('path', { d: `M0 ${y0} L240 ${y1}`, class: 'bike-terrain-line' }));
    // 자전거(바퀴 두 개 + 프레임) — 경사를 따라 놓는다
    const ang = Math.atan2(y1 - y0, 240);
    const g = svgEl('g', { transform: `translate(110 ${(y0 + y1) / 2}) rotate(${(ang * 180) / Math.PI})` });
    g.append(
      svgEl('circle', { cx: -16, cy: -10, r: 9, class: 'bike-terrain-wheel' }),
      svgEl('circle', { cx: 16, cy: -10, r: 9, class: 'bike-terrain-wheel' }),
      svgEl('path', { d: 'M-16 -10 L-4 -26 L12 -26 L16 -10 M-4 -26 L2 -10 L-16 -10 M12 -26 L10 -31', class: 'bike-terrain-frame' })
    );
    svg.append(g);
    if (wind) {
      for (const [y, x] of [[16, 196], [30, 176], [44, 200]] as const) {
        svg.append(svgEl('path', { d: `M${x + 36} ${y} L${x} ${y} m8 -5 l-8 5 l8 5`, class: 'bike-terrain-wind' }));
      }
    }
    return svg;
  }

  private checkTask(): void {
    const task = TASKS[this.taskIndex];
    if (!task || this.taskPassed) return;
    const ratio = gearRatio(this.bike.rings[this.front]!, this.bike.cogs[this.rear]!);
    if (zoneOf(development(ratio, this.bike.circumference)).id === task.zone) {
      this.taskPassed = true;
      this.ctx?.playSound('ok');
    }
  }

  /** 기어·케이던스가 바뀔 때마다 숫자와 강조를 갱신 */
  private refresh(): void {
    const b = this.bike;
    const ring = b.rings[this.front]!;
    const cog = b.cogs[this.rear]!;
    const ratio = gearRatio(ring, cog);
    const dev = development(ratio, b.circumference);
    const speed = speedKmh(this.cadence, ratio, b.circumference);
    const zone = zoneOf(dev);

    this.gearEl.replaceChildren(
      el('span', 'bike-gear-part', `앞 ${this.front + 1}단 ${ring}T`),
      el('span', 'bike-gear-x', '×'),
      el('span', 'bike-gear-part', `뒤 ${this.rear + 1}단 ${cog}T`)
    );
    this.speedEl.textContent = fmt(speed, 1);
    this.ratioEl.textContent = `${ring} ÷ ${cog} = ${fmt(ratio, 2)}`;
    this.devEl.textContent = `${fmt(dev, 2)} m`;
    this.wheelEl.textContent = `${Math.round(this.cadence * ratio)} rpm`;
    this.formulaEl.replaceChildren(
      el('span', 'bike-formula-head', '속도 = 케이던스 × 기어비 × 바퀴 둘레 × 60 ÷ 1000'),
      el('span', 'bike-formula-num', `${this.cadence} × ${fmt(ratio, 2)} × ${fmt(b.circumference, 2)} × 60 ÷ 1000 = ${fmt(speed, 1)} km/h`)
    );
    this.weightFill.style.width = `${Math.round(6 + pedalWeight(dev) * 94)}%`;
    this.weightFill.parentElement?.setAttribute('aria-valuenow', fmt(pedalWeight(dev), 2));
    this.zoneEl.style.setProperty('--zone', zone.color);
    this.zoneName.textContent = zone.name;
    this.zoneDesc.textContent = zone.desc;
    const cross = b.crossChain(this.front, this.rear);
    this.warnEl.hidden = !cross;
    this.warnEl.textContent = cross
      ? `체인이 비스듬해져 권장하지 않아요. ${this.front === b.rings.length - 1 ? '큰 체인링 × 큰 스프로킷' : '작은 체인링 × 작은 스프로킷'} 조합은 체인과 톱니가 빨리 닳고 소음이 나요.`
      : '';
    this.miniEl.replaceChildren(
      el('span', 'bike-mini-gear', `${ring}T × ${cog}T`),
      el('span', 'bike-mini-ratio', `기어비 ${fmt(ratio, 2)}`),
      el('span', 'bike-mini-speed', `${fmt(speed, 1)} km/h`)
    );

    // 변속 레버 표시
    const setCtl = (ctl: ShifterCtl, idx: number, n: number, teeth: number, label: string) => {
      ctl.value.textContent = `${label} ${idx + 1}단 · ${teeth}T`;
      ctl.down.disabled = idx <= 0;
      ctl.up.disabled = idx >= n - 1;
      Array.from(ctl.pips.children).forEach((p, i) => p.classList.toggle('is-on', i === idx));
    };
    setCtl(this.frontCtl, this.front, b.rings.length, ring, '앞');
    setCtl(this.rearCtl, this.rear, b.cogs.length, cog, '뒤');
    this.rearCtl.note.textContent = '';

    this.cadenceVal.textContent = `${this.cadence} rpm`;
    this.slowBtn.classList.toggle('is-active', this.slow);
    this.slowBtn.setAttribute('aria-pressed', String(this.slow));
    this.slowBtn.textContent = this.slow ? '천천히 보기 켬 (화면만 ¼배속)' : '천천히 보기';

    // 표: 현재 칸 강조 + 칸마다 현재 케이던스 기준 속도
    this.cells.forEach((col, f) =>
      col.forEach((cell, r) => {
        const on = f === this.front && r === this.rear;
        cell.classList.toggle('is-current', on);
        cell.setAttribute('aria-current', on ? 'true' : 'false');
        const s = cell.querySelector('.bike-cell-speed');
        if (s) s.textContent = `${fmt(speedKmh(this.cadence, gearRatio(b.rings[f]!, b.cogs[r]!), b.circumference), 1)} km/h`;
      })
    );

    const before = this.taskPassed;
    this.checkTask();
    if (before !== this.taskPassed || !this.taskBox.hidden) this.renderTask();
    if (this.wrap) {
      this.wrap.dataset.front = String(this.front);
      this.wrap.dataset.rear = String(this.rear);
      this.wrap.dataset.speed = fmt(speed, 1);
    }
  }
}
