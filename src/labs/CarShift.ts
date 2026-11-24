// 탐구 실험 — 자동차 기어 변속 (작업 지시서 11-B)
// FF 전륜구동 소형차의 5단 변속기를 수동(클러치 + H자 레버)과 자동(P·R·N·D) 두 방식으로 직접 조작한다.
// 속도·rpm은 spec.ts의 기어비와 공식으로 계산하고, 화면에 계산 근거를 같이 보여 준다.

import type { AppMode, ModeContext } from '../modes/types';
import { el, button } from '../modes/dom';
import { CarSim, type DriveMode, type Selector } from './car/model';
import { SPEC, GEAR_USES, gearRatio, gearLabel, speedFromRpm, rpmFromSpeed, type GearId } from './car/spec';
import { Powertrain3D } from './car/powertrain3d';
import { LabLabels, type LabelBounds } from './common/labels';
import { Gauge } from './car/gauges';
import { AutoSelector, HShifter, Pedal } from './car/controls';
import type { CameraView } from '../scene/SceneSetup';

const NARROW = '(max-width: 819px)';
const fmt = (n: number, d = 0): string => n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

const VIEW_WIDE: CameraView = { pos: [-2.6, 3.2, -4.7], target: [-0.45, 0.42, -1.7] };
// 좁은 화면: 3D는 위쪽 40%만 보이므로 카메라를 아래로 숙여 변속기가 화면 위쪽에 오게 한다
// 좁은 화면: 조금 물러나 클러치가 좌상단 홈 버튼 자리에서 벗어나고 바퀴까지 3D 영역에 들게(지시서 18 검증)
const VIEW_NARROW: CameraView = { pos: [-3.1, 4.1, -5.9], target: [-0.7, -0.6, -2.7] };

type Tone = 'info' | 'ok' | 'warn';

export class CarShift implements AppMode {
  private ctx: ModeContext | null = null;
  private sim = new CarSim();
  private pt: Powertrain3D | null = null;
  private wrap: HTMLElement | null = null;
  private mode: DriveMode = 'manual';
  private shownGear: GearId | null = null;
  private narrowMq: MediaQueryList | null = null;
  private labels: LabLabels | null = null;
  private bounds: LabelBounds = { x0: 0, y0: 0, x1: 99999, y1: 99999 };
  private boundsT = 0;
  private panels: { top: HTMLElement; left: HTMLElement; right: HTMLElement; cockpit: HTMLElement; sheet: HTMLElement } | null = null;

  // DOM
  private segBtns = new Map<DriveMode, HTMLButtonElement>();
  private tach!: Gauge;
  private speedo!: Gauge;
  private gearBig!: HTMLElement;
  private gearSub!: HTMLElement;
  private hshift!: HShifter;
  private prnd!: AutoSelector;
  private clutchPedal!: Pedal;
  private brakePedal!: Pedal;
  private accelPedal!: Pedal;
  private coachEl!: HTMLElement;
  private coachTitle!: HTMLElement;
  private coachText!: HTMLElement;
  private startBtn!: HTMLButtonElement;
  private alertEl!: HTMLElement;
  private calcEl!: HTMLElement;
  private explainEl!: HTMLElement;
  private tableRows = new Map<string, HTMLTableRowElement>();
  private tableCaption!: HTMLElement;
  private shiftArea!: HTMLElement;
  private alertTimer = 0;
  private textTimer = 0;
  private lastEvent: { text: string; t: number } | null = null;
  private time = 0;
  private clutchWasLatched = false;

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.mode = 'manual';
    this.sim.reset('manual');
    this.shownGear = null;
    this.lastEvent = null;
    this.time = 0;

    this.pt = new Powertrain3D();
    ctx.sceneMgr.add(this.pt.group);
    this.buildDom(ctx.root);
    this.labels?.set(this.pt.anchors(ctx.sceneMgr.camera));
    this.applyMode('manual');
    this.narrowMq = window.matchMedia(NARROW);
    this.narrowMq.addEventListener('change', this.onNarrow);
    this.flyHome(true);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.narrowMq?.removeEventListener('change', this.onNarrow);
    this.narrowMq = null;
    this.hshift?.dispose();
    if (this.pt && this.ctx) {
      this.ctx.sceneMgr.remove(this.pt.group);
      this.pt.dispose();
    }
    this.pt = null;
    this.labels?.dispose();
    this.labels = null;
    this.panels = null;
    this.wrap?.remove();
    this.wrap = null;
    this.segBtns.clear();
    this.tableRows.clear();
    this.ctx = null;
  }

  private onNarrow = (): void => this.flyHome(false);

  private flyHome(immediate: boolean): void {
    if (!this.ctx) return;
    this.ctx.sceneMgr.flyTo(window.matchMedia(NARROW).matches ? VIEW_NARROW : VIEW_WIDE, immediate);
  }

  // ───────────────────────── DOM ─────────────────────────

  private buildDom(root: HTMLElement): void {
    const wrap = el('div', 'car-wrap');
    this.wrap = wrap;
    root.appendChild(wrap);
    if (this.ctx) this.labels = new LabLabels(this.ctx, wrap, { bounds: () => this.bounds });

    // 모드 세그먼트
    const seg = el('div', 'car-seg car-panel');
    seg.setAttribute('role', 'tablist');
    seg.setAttribute('aria-label', '변속기 종류');
    for (const [m, name] of [['manual', '수동 변속기'], ['auto', '자동 변속기']] as const) {
      const b = button('car-seg-btn', name, () => this.applyMode(m));
      b.setAttribute('role', 'tab');
      seg.appendChild(b);
      this.segBtns.set(m, b);
    }

    // 왼쪽: 차량 설정 + 단별 표
    const left = el('section', 'car-panel car-side car-left');
    left.setAttribute('aria-label', '차량 설정과 단별 쓰임새');
    left.appendChild(el('h2', 'car-h', '차량 설정'));
    const spec = el('dl', 'car-spec');
    const specRows: [string, string][] = [
      ['구동 방식', 'FF 전륜구동 · 가로배치 엔진'],
      ['변속기', '전진 5단 + 후진'],
      ['종감속비', SPEC.finalDrive.toFixed(3)],
      ['타이어', `${SPEC.tyreName} (둘레 약 ${SPEC.tyreCirc} m)`],
      ['엔진 회전', `공회전 ${fmt(SPEC.idleRpm)} · 최대 ${fmt(SPEC.maxRpm)} rpm`]
    ];
    for (const [k, v] of specRows) {
      spec.append(el('dt', '', k), el('dd', '', v));
    }
    left.appendChild(spec);
    left.appendChild(el('h2', 'car-h', '단별 쓰임새와 속도'));
    this.tableCaption = el('p', 'car-note', '');
    const table = el('table', 'car-table');
    const thead = el('thead');
    const hr = el('tr');
    for (const h of ['단', '기어비', '2000rpm', '6000rpm', '쓰임새']) hr.appendChild(el('th', '', h));
    thead.appendChild(hr);
    const tbody = el('tbody');
    for (const u of GEAR_USES) {
      const r = gearRatio(u.gear);
      const tr = el('tr');
      tr.append(
        el('td', 'car-td-gear', gearLabel(u.gear)),
        el('td', 'car-num', r.toFixed(3)),
        el('td', 'car-num', `${fmt(speedFromRpm(2000, r))}`),
        el('td', 'car-num', `${fmt(speedFromRpm(6000, r))}`),
        el('td', 'car-td-use', u.use)
      );
      tbody.appendChild(tr);
      this.tableRows.set(String(u.gear), tr);
    }
    table.append(thead, tbody);
    left.append(table, this.tableCaption);

    // 오른쪽: 코치 + 계산 근거 + 설명
    const right = el('section', 'car-panel car-side car-right');
    right.setAttribute('aria-label', '안내');
    this.coachEl = el('div', 'car-coach');
    this.coachEl.setAttribute('role', 'status');
    this.coachEl.setAttribute('aria-live', 'polite');
    this.coachTitle = el('div', 'car-coach-title');
    this.coachText = el('p', 'car-coach-text');
    this.startBtn = button('car-btn car-start', '시동 걸기', () => this.tryStart());
    this.coachEl.append(this.coachTitle, this.coachText, this.startBtn);
    right.appendChild(this.coachEl);
    right.appendChild(el('h2', 'car-h', '계산 근거'));
    this.calcEl = el('div', 'car-calc');
    right.appendChild(this.calcEl);
    this.explainEl = el('div', 'car-explain');
    right.appendChild(this.explainEl);

    // 아래: 조종석(변속 레버 · 계기판 · 페달)
    const cockpit = el('section', 'car-panel car-cockpit');
    cockpit.setAttribute('aria-label', '조종석');
    this.shiftArea = el('div', 'car-shift-area');
    this.hshift = new HShifter((g) => this.pickGear(g));
    this.prnd = new AutoSelector((s) => this.pickSelector(s));
    this.alertEl = el('div', 'car-alert');
    this.alertEl.setAttribute('role', 'alert');
    this.shiftArea.append(this.hshift.el, this.prnd.el);

    const dash = el('div', 'car-dash');
    this.tach = new Gauge(
      {
        max: 8000,
        major: 1000,
        minor: 500,
        labelEvery: 1000,
        labelScale: 1000,
        unit: '×1000 rpm',
        caption: '회전계',
        zones: [
          { from: 6000, to: 6500, cls: 'is-caution' },
          { from: 6500, to: 8000, cls: 'is-red' }
        ]
      },
      'car-tach'
    );
    this.speedo = new Gauge({ max: 220, major: 20, minor: 10, labelEvery: 40, unit: 'km/h', caption: '속도계' }, 'car-speedo');
    const gearBox = el('div', 'car-gear');
    gearBox.appendChild(el('div', 'car-gear-cap', '현재 단'));
    this.gearBig = el('div', 'car-gear-big', 'N');
    this.gearSub = el('div', 'car-gear-sub', '');
    gearBox.append(this.gearBig, this.gearSub);
    dash.append(this.tach.el, gearBox, this.speedo.el);

    const pedals = el('div', 'car-pedals');
    this.clutchPedal = new Pedal(
      'is-clutch',
      '클러치',
      'Shift',
      {
        down: () => {
          this.clutchWasLatched = this.sim.clutchHeld;
          this.sim.clutchHeld = true;
        },
        up: (tap) => {
          if (tap) this.sim.clutchHeld = !this.clutchWasLatched;
          else this.sim.clutchHeld = this.sim.clutch > 0.85;
        },
        drag: (d) => {
          this.sim.clutchDirect = d;
        }
      },
      () => this.sim.clutch
    );
    this.brakePedal = new Pedal(
      'is-brake',
      '브레이크',
      '↓',
      { down: () => (this.sim.brakeHeld = true), up: () => (this.sim.brakeHeld = false) },
      () => this.sim.brake
    );
    this.accelPedal = new Pedal(
      'is-accel',
      '가속',
      '↑',
      { down: () => (this.sim.throttleHeld = true), up: () => (this.sim.throttleHeld = false) },
      () => this.sim.throttle
    );
    pedals.append(this.clutchPedal.el, this.brakePedal.el, this.accelPedal.el);

    const hint = el('p', 'car-keys', '');
    hint.dataset.role = 'keys';
    cockpit.append(this.shiftArea, dash, pedals, hint);

    const top = el('div', 'car-top');
    top.append(seg);
    if (this.labels) top.append(this.labels.button);
    const sheet = el('div', 'car-sheet');
    sheet.append(top, cockpit, right, left);
    wrap.append(sheet, this.alertEl);
    this.panels = { top, left, right, cockpit, sheet };
    this.measureBounds();
  }

  private applyMode(m: DriveMode): void {
    this.mode = m;
    this.sim.reset(m);
    this.lastEvent = null;
    this.shownGear = null;
    this.pt?.setMode(m);
    for (const [k, b] of this.segBtns) {
      b.classList.toggle('is-active', k === m);
      b.setAttribute('aria-selected', String(k === m));
    }
    if (!this.wrap) return;
    this.wrap.dataset.mode = m;
    this.hshift.el.hidden = m !== 'manual';
    this.prnd.el.hidden = m !== 'auto';
    this.clutchPedal.el.hidden = m !== 'manual';
    this.hshift.set('N');
    this.prnd.set('P');
    const keys = this.wrap.querySelector<HTMLElement>('[data-role="keys"]');
    if (keys) {
      keys.textContent =
        m === 'manual'
          ? '키보드: Shift 클러치(누르는 동안) · 1~5, R, N 레버 · ↑ 가속 · ↓ 브레이크 — 클러치 페달은 한 번 누르면 밟힌 채로, 다시 누르면 천천히 떼요(위아래로 끌면 직접 조절).'
          : '키보드: P · R · N · D 셀렉터 · ↑ 가속 · ↓ 브레이크 — 가속 페달을 오래 누를수록 깊이 밟혀요.';
    }
    this.tableCaption.textContent =
      '표의 속도(km/h)는 엔진 rpm ÷ (기어비 × 종감속비) × 타이어 둘레 × 60 ÷ 1000 으로 계산했어요. 실제 차는 공기 저항 때문에 5단 6000rpm 속도까지는 못 내요.';
    this.renderExplain();
    this.updateTexts(true);
  }

  private renderExplain(): void {
    const box = this.explainEl;
    box.replaceChildren();
    if (this.mode === 'manual') {
      box.appendChild(el('h2', 'car-h', '수동 변속기의 원리'));
      const ul = el('ul', 'car-list');
      ul.append(
        el('li', '', '클러치를 밟으면 엔진과 변속기가 떨어져요. 이때만 기어를 바꿀 수 있어요.'),
        el('li', '', '변속기 안 5쌍의 기어는 늘 맞물려 돌고, 슬리브가 고른 단의 기어를 출력축에 묶어요(3D에서 주황색).'),
        el('li', '', '낮은 단은 기어비가 커서 힘이 세지만 느리고, 높은 단은 힘은 약하지만 같은 rpm에서 더 빨라요.')
      );
      box.appendChild(ul);
    } else {
      box.appendChild(el('h2', 'car-h', '자동 변속기의 원리'));
      const ul = el('ul', 'car-list');
      ul.append(
        el('li', '', '클러치 페달이 없고 변속기가 알아서 단을 바꿔요. 속도가 오르면 올리고, 가속 페달을 깊이 밟으면 더 높은 rpm까지 기다렸다가 올려요.'),
        el('li', '', '토크 컨버터는 기름(유체)의 흐름으로 동력을 전해요. 엔진 쪽 날개와 바퀴 쪽 날개가 붙어 있지 않아서, 차가 서 있어도 시동이 꺼지지 않아요.'),
        el('li', '', 'P 주차(바퀴 잠금) · R 후진 · N 중립(동력 끊김) · D 주행'),
        el('li', 'car-dim', '실제 자동 변속기는 유성 기어 같은 다른 구조를 쓰는 경우가 많아요. 여기서는 "단"의 개념을 수동과 같은 기어 쌍으로 보여 줘요.')
      );
      box.appendChild(ul);
    }
  }

  // ───────────────────────── 조작 ─────────────────────────

  private pickGear(g: GearId): void {
    const err = this.sim.selectGear(g);
    if (err) {
      this.hshift.shake();
      this.showAlert(err);
    }
    this.hshift.set(this.sim.gear);
  }

  private pickSelector(s: Selector): void {
    const err = this.sim.setSelector(s);
    if (err) {
      this.prnd.shake();
      this.showAlert(err);
    }
    this.prnd.set(this.sim.selector);
  }

  private tryStart(): void {
    const err = this.sim.startEngine();
    if (err) this.showAlert(err);
    else this.showAlert('부르릉! 시동이 걸렸어요.', 'ok');
  }

  private showAlert(text: string, tone: Tone = 'warn'): void {
    this.alertEl.textContent = text;
    this.alertEl.dataset.tone = tone;
    this.alertEl.classList.add('is-on');
    this.alertTimer = 3.2;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const k = e.key;
    if (k === 'Shift') {
      if (this.mode === 'manual') this.sim.clutchHeld = true;
      return;
    }
    if (k === 'ArrowUp') {
      this.sim.throttleHeld = true;
      e.preventDefault();
      return;
    }
    if (k === 'ArrowDown') {
      this.sim.brakeHeld = true;
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    const up = k.toUpperCase();
    if (this.mode === 'manual') {
      if (/^[1-5]$/.test(k)) this.pickGear(Number(k) as GearId);
      else if (up === 'R') this.pickGear('R');
      else if (up === 'N' || k === '0') this.pickGear('N');
    } else if (up === 'P' || up === 'R' || up === 'N' || up === 'D') {
      this.pickSelector(up);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Shift' && this.mode === 'manual') this.sim.clutchHeld = false;
    if (e.key === 'ArrowUp') this.sim.throttleHeld = false;
    if (e.key === 'ArrowDown') this.sim.brakeHeld = false;
  };

  private onBlur = (): void => {
    this.sim.throttleHeld = false;
    this.sim.brakeHeld = false;
  };

  // ───────────────────────── 갱신 ─────────────────────────

  /** 이름표를 놓아도 되는 영역: 패널·조작판·하단 시트를 뺀 3D가 보이는 곳 */
  private measureBounds(): void {
    const p = this.panels;
    const w = this.wrap;
    if (!p || !w) return;
    const wr = w.getBoundingClientRect();
    if (window.matchMedia(NARROW).matches) {
      this.bounds = { x0: 0, y0: 0, x1: wr.width, y1: Math.max(0, p.sheet.getBoundingClientRect().top - wr.top) };
    } else {
      this.bounds = {
        x0: p.left.getBoundingClientRect().right - wr.left,
        y0: p.top.getBoundingClientRect().bottom - wr.top,
        x1: p.right.getBoundingClientRect().left - wr.left,
        y1: Math.min(wr.height, p.cockpit.getBoundingClientRect().top - wr.top)
      };
    }
  }

  update(dt: number): void {
    if (!this.pt || !this.wrap) return;
    const h = Math.min(dt, 0.05);
    this.time += h;
    const sim = this.sim;
    sim.step(h);
    for (const ev of sim.events.splice(0)) {
      if (ev.kind === 'stall') this.showAlert(ev.text);
      else this.lastEvent = { text: ev.text, t: this.time };
    }
    if (sim.gear !== this.shownGear) {
      this.shownGear = sim.gear;
      this.pt.setGear(sim.gear);
      if (this.mode === 'manual') this.hshift.set(sim.gear);
    }
    this.pt.update(h, {
      engineRpm: sim.engineRpm,
      inputRpm: sim.inputRpm,
      outputRpm: sim.outputRpm,
      clutch: this.mode === 'manual' ? sim.clutch : 0,
      speed: sim.v
    });
    const lb = this.labels;
    if (lb) {
      this.boundsT -= h;
      if (this.boundsT <= 0) {
        this.boundsT = 0.4;
        this.measureBounds();
      }
      const gt = this.pt.gearText();
      if (gt) lb.setText('gear', gt);
      lb.update();
    }
    this.tach.set(sim.engineRpm, false, fmt(sim.engineRpm));
    this.speedo.set(Math.abs(sim.kmh), false, fmt(Math.abs(sim.kmh)));
    this.clutchPedal.setDepth(sim.clutch);
    this.brakePedal.setDepth(sim.brake);
    this.accelPedal.setDepth(sim.throttle);
    this.wrap.classList.toggle('is-red', sim.engineRpm > 6000);

    if (this.alertTimer > 0) {
      this.alertTimer -= h;
      if (this.alertTimer <= 0) this.alertEl.classList.remove('is-on');
    }
    this.textTimer -= h;
    if (this.textTimer <= 0) {
      this.textTimer = 0.12;
      this.updateTexts(false);
    }
  }

  private updateTexts(force: boolean): void {
    const sim = this.sim;
    if (!this.wrap) return;
    void force;
    // 현재 단 표시
    let big = gearLabel(sim.gear);
    let sub = '';
    if (this.mode === 'auto') {
      big = sim.selector === 'D' ? `D${String(sim.gear)}` : sim.selector;
      sub = sim.selector === 'D' ? `${String(sim.gear)}단 자동 선택` : { P: '주차', R: '후진', N: '중립', D: '' }[sim.selector];
    } else {
      sub = sim.gear === 'N' ? '중립' : sim.gear === 'R' ? '후진' : `${String(sim.gear)}단`;
      if (sim.clutch > 0.7) sub += ' · 클러치 밟음';
      else if (sim.gear !== 'N' && !sim.locked && sim.engagement > 0) sub += ' · 반클러치';
    }
    this.gearBig.textContent = big;
    this.gearSub.textContent = sub;
    this.gearBig.dataset.gear = String(sim.gear);

    // 표 강조: 현재 단 + 권장 단
    const rec = this.mode === 'manual' && Math.abs(sim.kmh) > 3 ? sim.recommendedGear() : null;
    for (const [k, tr] of this.tableRows) {
      tr.classList.toggle('is-current', k === String(sim.gear));
      tr.classList.toggle('is-rec', rec !== null && k === String(rec) && k !== String(sim.gear));
    }

    this.renderCalc();
    this.renderCoach();
  }

  private renderCalc(): void {
    const sim = this.sim;
    const box = this.calcEl;
    box.replaceChildren();
    const g = sim.gear;
    const kmh = Math.abs(sim.kmh);
    if (g === 'N' || (this.mode === 'auto' && (sim.selector === 'N' || sim.selector === 'P'))) {
      box.append(
        el('p', 'car-calc-line', '중립: 엔진 동력이 바퀴로 가지 않아요.'),
        el('p', 'car-calc-line car-dim', `엔진 ${fmt(sim.engineRpm)} rpm · 속도 ${fmt(kmh, 1)} km/h`)
      );
      return;
    }
    const r = gearRatio(g);
    const total = r * SPEC.finalDrive;
    const inRpm = Math.abs(sim.inputRpm);
    const name = g === 'R' ? '후진' : `${String(g)}단`;
    box.append(
      this.calcRow('총 감속비', `${name} ${r.toFixed(3)} × 종감속 ${SPEC.finalDrive.toFixed(3)} = ${total.toFixed(2)}`),
      this.calcRow(
        this.mode === 'auto' ? '변속기 입력(터빈)' : '변속기 입력축',
        `${fmt(inRpm)} rpm`
      ),
      this.calcRow('바퀴 회전', `${fmt(inRpm)} ÷ ${total.toFixed(2)} = ${fmt(Math.abs(sim.wheelRpm))} rpm`),
      this.calcRow('속도', `${fmt(Math.abs(sim.wheelRpm))} × ${SPEC.tyreCirc} m × 60 ÷ 1000 = ${fmt(kmh, 1)} km/h`)
    );
    const note =
      this.mode === 'manual'
        ? sim.locked
          ? '클러치가 붙어 있어 엔진 rpm = 변속기 입력 rpm이에요.'
          : '클러치가 떨어져(또는 미끄러져) 엔진 rpm과 변속기 입력 rpm이 달라요.'
        : `토크 컨버터가 조금 미끄러져 엔진(${fmt(sim.engineRpm)} rpm)이 터빈보다 조금 빨리 돌아요.`;
    box.appendChild(el('p', 'car-note', note));
  }

  private calcRow(k: string, v: string): HTMLElement {
    const row = el('div', 'car-calc-row');
    row.append(el('span', 'car-calc-k', k), el('span', 'car-calc-v', v));
    return row;
  }

  private setCoach(title: string, text: string, tone: Tone): void {
    this.coachTitle.textContent = title;
    this.coachText.textContent = text;
    this.coachEl.dataset.tone = tone;
  }

  private renderCoach(): void {
    const sim = this.sim;
    this.startBtn.hidden = sim.engineOn;
    const kmh = sim.kmh;
    const rpm = sim.engineRpm;
    const g = sim.gear;
    if (!sim.engineOn) {
      this.setCoach('시동 꺼짐', this.mode === 'manual' ? '클러치를 밟거나 레버를 N에 두고 [시동 걸기]를 누르세요.' : '[시동 걸기]를 누르세요.', 'warn');
      return;
    }
    if (rpm > 6000) {
      const msg =
        this.mode === 'manual' && typeof g === 'number' && g < 5
          ? `레드존! 엔진이 너무 빨리 돌아요. 가속 페달을 떼고 클러치를 밟아 ${g + 1}단으로 올리세요.`
          : '레드존! 엔진이 너무 빨리 돌아요. 가속 페달을 떼세요.';
      this.setCoach('엔진 과회전 경고', msg, 'warn');
      return;
    }
    if (sim.warning === 'lug' && typeof g === 'number') {
      this.setCoach('엔진이 덜덜 떨려요', `rpm이 너무 낮아 힘이 모자라요(노킹·떨림의 원인). 클러치를 밟고 ${Math.max(1, g - 1)}단으로 내리세요.`, 'warn');
      return;
    }
    if (this.mode === 'manual') this.coachManual(kmh, rpm);
    else this.coachAuto(kmh, rpm);
  }

  private coachManual(kmh: number, rpm: number): void {
    const sim = this.sim;
    const g = sim.gear;
    const pressed = sim.clutch > 0.7;
    const stopped = Math.abs(kmh) < 0.5;
    if (g === 'N') {
      if (stopped && !pressed) return this.setCoach('출발 준비 ①', '클러치 페달을 밟으세요. (페달 한 번 누르기 또는 Shift)', 'info');
      if (pressed) {
        const rec = stopped ? 1 : sim.recommendedGear();
        return this.setCoach('출발 준비 ②', stopped ? '레버를 1단으로 옮기세요. 출발은 힘이 가장 센 1단으로!' : `지금 속도(${fmt(kmh)} km/h)에는 ${rec}단이 알맞아요.`, 'info');
      }
      return this.setCoach('중립', '동력이 끊겨 차가 굴러가기만 해요. 클러치를 밟고 단을 넣으세요.', 'info');
    }
    if (pressed) {
      if (stopped && (g === 1 || g === 'R')) {
        return this.setCoach('출발 준비 ③', '클러치 페달을 다시 누르면 천천히 떼어져요. 차가 움직이기 시작하면 가속 페달을 밟으세요.', 'info');
      }
      return this.setCoach('클러치 밟음', '엔진과 바퀴가 떨어져 있어요. 레버로 단을 고른 뒤 클러치를 떼세요.', 'info');
    }
    if (!sim.locked && sim.engagement > 0) {
      return this.setCoach('반클러치', '클러치 판이 미끄러지며 조금씩 힘을 이어 주는 중이에요.', 'info');
    }
    if (g === 'R') return this.setCoach('후진 중', '뒤로 가요. 멈춘 뒤에 전진 기어로 바꾸세요.', 'info');
    if (typeof g === 'number') {
      if (g < 5 && rpm > 3000 && sim.throttle > 0.05) {
        return this.setCoach(`${g + 1}단으로 올리세요`, `rpm이 ${fmt(rpm)}까지 올랐어요. 가속 페달을 떼고 → 클러치 → 레버 ${g + 1} → 클러치 떼기. ${g + 1}단이면 지금 속도에서 약 ${fmt(rpmFromSpeed(kmh, gearRatio((g + 1) as GearId)))} rpm이 돼요.`, 'ok');
      }
      if (g > 1 && rpm < 1300) {
        return this.setCoach(`${g - 1}단으로 내리세요`, `속도가 줄어 rpm이 ${fmt(rpm)}로 낮아요. 클러치를 밟고 ${g - 1}단으로 내리면 힘이 다시 세져요.`, 'ok');
      }
      const use = GEAR_USES.find((u) => u.gear === g)?.use ?? '';
      if (g === 5) return this.setCoach('5단 주행', `엔진이 천천히 돌아 연비가 좋아요. 쓰임새: ${use}.`, 'ok');
      return this.setCoach(`${g}단 주행 중`, `쓰임새: ${use}. 가속 페달을 밟아 속도를 올려 보세요.`, 'ok');
    }
  }

  private coachAuto(kmh: number, rpm: number): void {
    const sim = this.sim;
    const s = sim.selector;
    const stopped = Math.abs(kmh) < 0.5;
    if (s === 'P') return this.setCoach('P 주차', '바퀴가 잠겨 있어요. 셀렉터를 D로 옮기면 출발 준비가 돼요.', 'info');
    if (s === 'N') return this.setCoach('N 중립', '엔진 동력이 바퀴로 가지 않아요. 달리려면 D를 고르세요.', 'info');
    if (s === 'R') return this.setCoach('R 후진', stopped ? '가속 페달을 살짝 밟으면 뒤로 가요.' : '뒤로 가는 중이에요.', 'info');
    if (stopped && sim.brake > 0.1) {
      return this.setCoach('D 정차', `브레이크로 멈춰 있어도 시동이 꺼지지 않아요(엔진 ${fmt(rpm)} rpm). 토크 컨버터 안에서 기름만 미끄러지기 때문이에요.`, 'info');
    }
    if (this.lastEvent && this.time - this.lastEvent.t < 2.5) {
      return this.setCoach(`변속기가 ${this.lastEvent.text}`, `속도 ${fmt(kmh)} km/h · 가속 페달 ${fmt(sim.throttle * 100)}%에 맞춰 스스로 단을 바꿨어요.`, 'ok');
    }
    if (stopped) return this.setCoach('D 주행 준비', '가속 페달을 밟으세요. 브레이크만 떼어도 천천히 움직여요(크리핑).', 'info');
    const g = sim.gear;
    const use = GEAR_USES.find((u) => u.gear === g)?.use ?? '';
    return this.setCoach(`D · ${String(g)}단 자동`, `지금은 ${String(g)}단(${use}). 가속 페달을 깊이 밟을수록 더 높은 rpm에서 단을 올려요.`, 'ok');
  }
}
