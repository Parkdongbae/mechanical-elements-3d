// 탐구 실험 — 풍동 실험(맛보기 CFD) (작업 지시서 12)
// 부품(손잡이·미러·A필러·도어 틈새·하부·휠·스포일러·차고)을 바꿔 가며 ① 공기저항계수 ② 다운포스와 주행 안정성 ③ 풍절음(실제 소리)을 비교한다.
// 부품별 계수는 경향을 보여 주는 학습용 값이고, 힘·동력·한계 속도는 실제 공식으로 계산해 대입 과정을 화면에 보여 준다.

import * as THREE from 'three';
import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import { el, button } from '../modes/dom';
import { ghost as ghostMat } from '../models/materials';
import {
  ITEMS,
  PRESET_AERO,
  PRESET_BASIC,
  aero,
  axleLoads,
  cdContrib,
  choiceOf,
  cornerAccel,
  crosswind,
  dragN,
  dynPressure,
  kmhToMs,
  liftN,
  maxLateralN,
  noiseParts,
  noiseTotal,
  powerKW,
  soundLevels,
  vmaxCornerKmh,
  whistleHz,
  AREA,
  RHO,
  MASS,
  G,
  MU,
  R_CORNER,
  GUST,
  GUST_T,
  LANE_MARGIN,
  GOAL_CD,
  GOAL_DB,
  GOAL_DB_KMH,
  GOAL_CORNER_KMH,
  type Config,
  type ItemId
} from './wind/aero';
import { WindCar, WHEEL_X, WHEEL_R } from './wind/carModel';
import { FlowField, FlowViz } from './wind/flow';
import { Tunnel, Ripples, ForceArrow } from './wind/tunnel';
import { CornerTest, CrosswindTest } from './wind/tests';
import { WindAudio } from './wind/audio';
import { DragChart, Spectrum } from './wind/charts';
import { UnderView } from './wind/underView';

type Tab = 'drag' | 'stab' | 'noise';
type Sub = 'force' | 'corner' | 'cross';

const NARROW = '(max-width: 819px)';
const DISCLAIMER = '학습용 맛보기 모델이에요. 수치는 경향을 보여 주기 위한 값이며 실제 자동차의 측정값이 아닙니다.';

const VIEWS: Record<'side' | 'force' | 'corner' | 'cross' | 'under', { wide: CameraView; narrow: CameraView }> = {
  // 하부 보기: 들어 올린 차 밑에서 비스듬히 올려다봄(차 바닥 높이 ≈ LIFT + 0.13)
  under: { wide: { pos: [-3.5, -1.7, 4.3], target: [0.1, 1.15, 0] }, narrow: { pos: [-3.3, -1.5, 3.9], target: [0.3, 0.35, 0] } },
  side: { wide: { pos: [-4.4, 3.1, 9.0], target: [1.0, 0.4, 0] }, narrow: { pos: [-4.9, 3.0, 11.0], target: [0.25, -2.1, 0] } },
  force: { wide: { pos: [0.2, 2.5, 7.6], target: [0.25, 0.95, 0] }, narrow: { pos: [0.2, 3.0, 12.0], target: [0.25, -2.0, 0] } },
  corner: { wide: { pos: [0, 16.2, 5.2], target: [0, 0, 0.4] }, narrow: { pos: [0, 16.8, 3.6], target: [0, 0, 3.4] } },
  cross: { wide: { pos: [-2.2, 6.4, 6.6], target: [0.6, 0, 0.4] }, narrow: { pos: [-2.0, 9.4, 8.6], target: [0.4, -1.0, 3.4] } }
};

const fmt = (n: number, d = 0): string => n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (n: number, d: number): string => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n), d)}`;

interface Snapshot {
  cd: number;
  db: number;
  cl: number;
}

export class WindTunnel implements AppMode {
  private ctx: ModeContext | null = null;
  private wrap: HTMLElement | null = null;
  private cfg: Config = { ...PRESET_BASIC };
  private saved: Config | null = null;
  private tab: Tab = 'drag';
  private sub: Sub = 'force';
  private tunnelKmh = 120;
  private driveKmh = 200;
  private prev: Snapshot | null = null;
  private pressure = false;
  private xray = false;
  private narrowMq: MediaQueryList | null = null;

  // 3D
  private car: WindCar | null = null;
  private field: FlowField | null = null;
  private flow: FlowViz | null = null;
  private tunnel: Tunnel | null = null;
  private ripples: Ripples | null = null;
  private arrows: ForceArrow[] = [];
  private corner: CornerTest | null = null;
  private cross: CrosswindTest | null = null;
  private testGhostMat: THREE.Material | null = null;
  private under: UnderView | null = null;
  private underLight: THREE.DirectionalLight | null = null;
  private underBtns: HTMLButtonElement[] = [];
  private wheelAngle = 0;
  private time = 0;

  // 소리
  private audio: WindAudio | null = null;
  private abTimer = 0;
  private abOn = false;
  private abSide: 'A' | 'B' = 'B';

  // DOM
  private tabBtns = new Map<Tab, HTMLButtonElement>();
  private subBtns = new Map<Sub, HTMLButtonElement>();
  private chips = new Map<ItemId, HTMLButtonElement[]>();
  private tipEl!: HTMLElement;
  private leftBody!: HTMLElement;
  private collapseBtn!: HTMLButtonElement;
  private sections = new Map<Tab, HTMLElement>();
  private ctrlGroups = new Map<Tab, HTMLElement>();
  private speedInput!: HTMLInputElement;
  private speedVal!: HTMLElement;
  private speedMin!: HTMLElement;
  private speedMax!: HTMLElement;
  private compareEl!: HTMLElement;
  private saveBtn!: HTMLButtonElement;
  private goalsEl!: HTMLElement;
  private alertEl!: HTMLElement;
  private alertT = 0;
  private toggles = new Map<string, HTMLButtonElement>();
  private soundBtn!: HTMLButtonElement;
  private abBtn!: HTMLButtonElement;
  private abLabel!: HTMLElement;
  private volInput!: HTMLInputElement;
  private dragChart = new DragChart();
  private spectrum = new Spectrum();
  private specCap!: HTMLElement;
  private textT = 0;
  private specT = 0;
  // 탭별 동적 영역
  private dragBox!: HTMLElement;
  private stabBox!: HTMLElement;
  private testBox!: HTMLElement;
  private noiseBox!: HTMLElement;

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.cfg = { ...PRESET_BASIC };
    this.saved = null;
    this.tab = 'drag';
    this.sub = 'force';
    this.tunnelKmh = 120;
    this.driveKmh = 200;
    this.prev = null;
    this.pressure = false;
    this.xray = false;
    this.abOn = false;
    this.time = 0;

    this.tunnel = new Tunnel();
    this.car = new WindCar();
    this.car.apply(this.cfg);
    this.field = new FlowField(this.car.shape);
    this.flow = new FlowViz(this.field);
    this.ripples = new Ripples();
    this.arrows = [new ForceArrow(), new ForceArrow()];
    this.corner = new CornerTest();
    this.cross = new CrosswindTest();
    this.testGhostMat = ghostMat(0x9fb4c8, 0.4);
    this.corner.onEvent = (who, st) => {
      if (st === 'out') this.showAlert(who === 0 ? '시험 차가 코스를 벗어났어요! 타이어가 버틸 수 있는 힘보다 원심 방향 힘이 커요.' : '유령 차(다운포스 없음)가 코스를 벗어났어요.');
    };
    for (const o of [this.tunnel.group, this.car.group, this.flow.group, this.ripples.group, this.corner.group, this.cross.group, ...this.arrows.map((a) => a.group)]) ctx.sceneMgr.add(o);
    this.audio = new WindAudio();
    this.under = new UnderView();
    // 들어 올린 차 바닥을 비추는 아래쪽 보조광(하부 보기 동안만 켬)
    this.underLight = new THREE.DirectionalLight(0xe8f0ff, 0);
    this.underLight.position.set(0.5, -6, 2.5);
    this.under.posts.add(this.underLight);
    ctx.sceneMgr.add(this.under.lifted);
    ctx.sceneMgr.add(this.under.posts);

    this.buildDom(ctx.root);
    this.applyConfig(false);
    this.setTab('drag', true);
    this.narrowMq = window.matchMedia(NARROW);
    this.narrowMq.addEventListener('change', this.onNarrow);
    window.addEventListener('resize', this.onResize);
    this.onResize();
    (window as unknown as Record<string, unknown>).__windDebug = () => this.debugState();
    // 검증용: 하부 보기 후 카메라 제한·공용 바닥 복원 확인(컨트롤·씬 참조를 돌려준다)
    (window as unknown as Record<string, unknown>).__windUnderDebug = () => ({ controls: ctx.sceneMgr.controls, scene: ctx.sceneMgr.scene, on: this.under?.on ?? false });
  }

  exit(): void {
    window.removeEventListener('resize', this.onResize);
    this.narrowMq?.removeEventListener('change', this.onNarrow);
    this.narrowMq = null;
    delete (window as unknown as Record<string, unknown>).__windDebug;
    delete (window as unknown as Record<string, unknown>).__windUnderDebug;
    this.audio?.dispose();
    this.audio = null;
    // 하부 보기 원상 복구(카메라 아래 각도 제한·공용 바닥) — 다른 화면에서 카메라가 바닥 밑으로 가지 않게
    if (this.under) {
      this.under.reset();
      this.ctx?.sceneMgr.remove(this.under.lifted);
      this.ctx?.sceneMgr.remove(this.under.posts);
      this.under.dispose();
    }
    this.under = null;
    this.underLight = null;
    this.underBtns = [];
    const ctx = this.ctx;
    const objs = [this.tunnel?.group, this.car?.group, this.flow?.group, this.ripples?.group, this.corner?.group, this.cross?.group, ...this.arrows.map((a) => a.group)];
    if (ctx) for (const o of objs) if (o) ctx.sceneMgr.remove(o);
    this.corner?.dispose();
    this.cross?.dispose();
    this.tunnel?.dispose();
    this.flow?.dispose();
    this.ripples?.dispose();
    for (const a of this.arrows) a.dispose();
    this.car?.dispose();
    this.testGhostMat?.dispose();
    this.corner = this.cross = null;
    this.tunnel = null;
    this.flow = null;
    this.field = null;
    this.ripples = null;
    this.arrows = [];
    this.car = null;
    this.testGhostMat = null;
    this.wrap?.remove();
    this.wrap = null;
    this.tabBtns.clear();
    this.subBtns.clear();
    this.chips.clear();
    this.sections.clear();
    this.ctrlGroups.clear();
    this.toggles.clear();
    this.ctx = null;
  }

  private onNarrow = (): void => this.flyView(false);
  private onResize = (): void => this.flow?.setResolution(window.innerWidth, window.innerHeight);

  private get kmh(): number {
    return this.tab === 'stab' ? this.driveKmh : this.tunnelKmh;
  }

  // ───────────────────────── DOM ─────────────────────────

  private buildDom(root: HTMLElement): void {
    const wrap = el('div', 'wind-wrap');
    this.wrap = wrap;
    root.appendChild(wrap);
    const sheet = el('div', 'wind-sheet');

    const note = el('p', 'wind-disclaimer', DISCLAIMER);
    note.setAttribute('role', 'note');

    // 탭
    const tabs = el('div', 'wind-tabs wind-panel');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '실험 종류');
    for (const [t, name, num] of [
      ['drag', '공기저항', '①'],
      ['stab', '주행 안정성', '②'],
      ['noise', '풍절음', '③']
    ] as const) {
      const b = button('wind-tab', '', () => this.setTab(t));
      b.append(el('span', 'wind-tab-num', num), el('span', '', name));
      b.setAttribute('role', 'tab');
      b.id = `wind-tab-${t}`;
      tabs.appendChild(b);
      this.tabBtns.set(t, b);
    }

    // 왼쪽: 부품 설정
    const left = el('section', 'wind-panel wind-left');
    left.setAttribute('aria-label', '부품 설정');
    const head = el('div', 'wind-left-head');
    head.appendChild(el('h2', 'wind-h', '부품 설정'));
    this.collapseBtn = button('wind-collapse', '접기', () => this.toggleLeft());
    this.collapseBtn.setAttribute('aria-expanded', 'true');
    head.appendChild(this.collapseBtn);
    left.appendChild(head);
    this.leftBody = el('div', 'wind-left-body');
    left.appendChild(this.leftBody);
    const presets = el('div', 'wind-presets');
    presets.append(
      button('wind-btn wind-btn-soft', '모두 기본형', () => this.setAll(PRESET_BASIC)),
      button('wind-btn wind-btn-soft', '모두 공력 최적화', () => this.setAll(PRESET_AERO))
    );
    this.leftBody.appendChild(presets);
    for (const item of ITEMS) {
      const box = el('div', 'wind-item');
      const lab = el('div', 'wind-item-name', item.name);
      lab.id = `wind-item-${item.id}`;
      const row = el('div', 'wind-chips');
      row.setAttribute('role', 'radiogroup');
      row.setAttribute('aria-labelledby', lab.id);
      const list: HTMLButtonElement[] = [];
      item.choices.forEach((c, i) => {
        const b = button('wind-chip', c.label, () => this.pick(item.id, i));
        b.setAttribute('role', 'radio');
        b.dataset.item = item.id;
        b.dataset.idx = String(i);
        b.title = c.tip;
        list.push(b);
        row.appendChild(b);
      });
      this.chips.set(item.id, list);
      if (item.id === 'under') {
        const head = el('div', 'wind-item-head');
        head.append(lab, this.underButton('wind-under-btn wind-under-sm'));
        box.append(head, row);
      } else box.append(lab, row);
      this.leftBody.appendChild(box);
    }
    this.tipEl = el('p', 'wind-tip', '부품을 눌러 바꿔 보세요. 3D 자동차와 공기 흐름이 바로 바뀌어요.');
    this.tipEl.setAttribute('aria-live', 'polite');
    this.leftBody.appendChild(this.tipEl);

    // 비교(A/B)
    const cmp = el('div', 'wind-compare');
    cmp.appendChild(el('h2', 'wind-h', '설계 비교 (A ↔ B)'));
    const cmpBtns = el('div', 'wind-presets');
    this.saveBtn = button('wind-btn', '현재 설정을 A로 저장', () => this.saveA());
    cmpBtns.appendChild(this.saveBtn);
    cmp.appendChild(cmpBtns);
    this.compareEl = el('div', 'wind-compare-body');
    cmp.appendChild(this.compareEl);
    this.leftBody.appendChild(cmp);

    // 목표
    const goals = el('div', 'wind-goals');
    goals.appendChild(el('h2', 'wind-h', '설계 과제 — 세 가지를 모두 이루어 보세요'));
    this.goalsEl = el('ul', 'wind-goal-list');
    goals.appendChild(this.goalsEl);
    this.leftBody.appendChild(goals);

    // 오른쪽: 결과
    const right = el('section', 'wind-panel wind-right');
    right.setAttribute('aria-label', '측정 결과');
    right.setAttribute('aria-live', 'polite');
    const sDrag = el('div', 'wind-sec');
    this.dragBox = el('div', 'wind-dyn');
    sDrag.append(this.dragBox);
    const chartWrap = el('div', 'wind-chart-wrap');
    chartWrap.append(el('div', 'wind-sub-h', '속도 – 항력 그래프'), this.dragChart.el);
    const chartNote = el('p', 'wind-note', '');
    chartNote.dataset.role = 'chartnote';
    chartWrap.appendChild(chartNote);
    sDrag.appendChild(chartWrap);
    const contrib = el('div', 'wind-contrib');
    contrib.dataset.role = 'contrib';
    sDrag.appendChild(contrib);
    this.sections.set('drag', sDrag);

    const sStab = el('div', 'wind-sec');
    this.stabBox = el('div', 'wind-dyn');
    this.testBox = el('div', 'wind-dyn');
    sStab.append(this.testBox, this.stabBox);
    this.sections.set('stab', sStab);

    const sNoise = el('div', 'wind-sec');
    this.noiseBox = el('div', 'wind-dyn');
    const specWrap = el('div', 'wind-spec-wrap');
    this.specCap = el('div', 'wind-sub-h', '');
    specWrap.append(this.specCap, this.spectrum.el);
    sNoise.append(this.noiseBox, specWrap);
    const nList = el('ul', 'wind-list');
    nList.append(
      el('li', '', '미러·A필러·큰 윙: "쏴아" 하는 거친 중고음'),
      el('li', '', '넓은 도어 틈새: "휘이" 휘파람 — 빨라질수록 음이 높아져요'),
      el('li', '', '돌출 손잡이: 약한 "쉬익" 고음'),
      el('li', '', '드러난 하부·열린 휠: "웅웅" 저음')
    );
    sNoise.appendChild(nList);
    this.sections.set('noise', sNoise);
    right.append(sDrag, sStab, sNoise);

    // 아래: 풍속 + 탭별 조작
    const bar = el('section', 'wind-panel wind-bar');
    bar.setAttribute('aria-label', '풍속과 조작');
    const sp = el('div', 'wind-speed');
    const spLab = el('label', 'wind-speed-label', '');
    spLab.htmlFor = 'wind-speed';
    spLab.dataset.role = 'speedlabel';
    this.speedInput = el('input', 'wind-range');
    this.speedInput.type = 'range';
    this.speedInput.id = 'wind-speed';
    this.speedInput.step = '5';
    this.speedInput.addEventListener('input', () => this.onSpeed());
    this.speedVal = el('output', 'wind-speed-val', '');
    this.speedMin = el('span', 'wind-speed-mm', '');
    this.speedMax = el('span', 'wind-speed-mm', '');
    const track = el('div', 'wind-speed-track');
    track.append(this.speedMin, this.speedInput, this.speedMax);
    sp.append(spLab, track, this.speedVal);
    bar.appendChild(sp);

    const c1 = el('div', 'wind-ctrls');
    c1.append(
      this.toggle('pressure', '압력 분포 보기', (on) => {
        this.pressure = on;
        this.refreshPaint();
      }),
      this.underButton('wind-under-btn'),
      this.toggle('xray', '차체 투시', (on) => {
        this.xray = on;
        this.car?.setXray(on);
      }),
      this.toggle('ghost', 'A의 유선 겹치기', (on) => {
        if (this.flow) this.flow.ghost.visible = on;
      }),
      button('wind-btn wind-btn-soft', '시점 처음으로', () => this.flyView(false))
    );
    const c2 = el('div', 'wind-ctrls');
    const seg = el('div', 'wind-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', '안정성 시험 종류');
    for (const [s, name] of [
      ['force', '힘 보기'],
      ['corner', '코너링 시험'],
      ['cross', '옆바람 시험']
    ] as const) {
      const b = button('wind-seg-btn', name, () => this.setSub(s));
      seg.appendChild(b);
      this.subBtns.set(s, b);
    }
    c2.append(
      seg,
      this.underButton('wind-under-btn'),
      button('wind-btn wind-btn-soft', '다시 출발', () => {
        this.corner?.restart();
        this.cross?.restart();
      })
    );
    const c3 = el('div', 'wind-ctrls');
    this.soundBtn = button('wind-btn wind-sound', '소리 듣기', () => void this.toggleSound());
    this.soundBtn.setAttribute('aria-pressed', 'false');
    const vol = el('label', 'wind-vol');
    vol.appendChild(el('span', '', '음량'));
    this.volInput = el('input', 'wind-range wind-vol-range');
    this.volInput.type = 'range';
    this.volInput.min = '0';
    this.volInput.max = '100';
    this.volInput.value = '70';
    this.volInput.setAttribute('aria-label', '음량');
    this.volInput.addEventListener('input', () => this.audio?.setVolume(Number(this.volInput.value) / 100));
    vol.appendChild(this.volInput);
    this.abBtn = button('wind-btn wind-btn-soft', 'A/B 번갈아 듣기', () => this.toggleAB());
    this.abBtn.setAttribute('aria-pressed', 'false');
    this.abLabel = el('span', 'wind-ab', '');
    c3.append(this.soundBtn, vol, this.abBtn, this.underButton('wind-under-btn'), this.abLabel);
    // A를 저장하기 전에는 비교 기능을 쓸 수 없다
    this.toggles.get('ghost')?.setAttribute('disabled', '');
    this.abBtn.disabled = true;
    this.ctrlGroups.set('drag', c1);
    this.ctrlGroups.set('stab', c2);
    this.ctrlGroups.set('noise', c3);
    bar.append(c1, c2, c3);

    this.alertEl = el('div', 'wind-alert');
    this.alertEl.setAttribute('role', 'alert');

    // 좁은 화면에서는 sheet가 하단 시트가 된다(넓은 화면에서는 display: contents)
    sheet.append(note, tabs, bar, right, left);
    wrap.append(sheet, this.alertEl);
  }

  private toggle(key: string, label: string, onChange: (on: boolean) => void): HTMLButtonElement {
    const b = button('wind-toggle', label, () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      onChange(on);
    });
    b.setAttribute('aria-pressed', 'false');
    this.toggles.set(key, b);
    return b;
  }

  private toggleLeft(): void {
    const open = this.collapseBtn.getAttribute('aria-expanded') !== 'true';
    this.collapseBtn.setAttribute('aria-expanded', String(open));
    this.collapseBtn.textContent = open ? '접기' : '펼치기';
    this.wrap?.classList.toggle('is-left-closed', !open);
  }

  // ───────────────────────── 상태 변경 ─────────────────────────

  private snapshot(): Snapshot {
    const a = aero(this.cfg);
    return { cd: a.cd, cl: a.cl, db: noiseTotal(this.cfg, this.tunnelKmh) };
  }

  private pick(id: ItemId, idx: number): void {
    if (this.cfg[id] === idx) return;
    this.prev = this.snapshot();
    this.cfg = { ...this.cfg, [id]: idx };
    const item = ITEMS.find((i) => i.id === id);
    const c = item?.choices[idx];
    if (item && c) this.tipEl.textContent = `${item.name} → ${c.label}: ${c.tip}`;
    this.applyConfig(true);
  }

  private setAll(p: Config): void {
    this.prev = this.snapshot();
    this.cfg = { ...p };
    this.tipEl.textContent = p === PRESET_AERO ? '모든 부품을 공기 흐름에 유리한 것으로 바꿨어요(립 스포일러).' : '모든 부품을 기본형(저항이 큰 쪽)으로 바꿨어요.';
    this.applyConfig(true);
  }

  private applyConfig(changed: boolean): void {
    const car = this.car;
    if (!car || !this.field || !this.flow) return;
    car.apply(this.cfg);
    const a = aero(this.cfg);
    car.pressureCtx = { wake: Math.min(1, Math.max(0, (a.cd - 0.25) / 0.1)), under: this.cfg.under };
    this.refreshPaint();
    car.setXray(this.xray);
    this.field.configure(car.shape, this.cfg, car.wing);
    this.flow.rebuild();
    this.rebuildRipples();
    this.under?.setLabels(car.underLabels);
    for (const [id, list] of this.chips) {
      list.forEach((b, i) => {
        const on = this.cfg[id] === i;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
    }
    if (this.tab === 'stab' && this.sub !== 'force') this.setupTests();
    this.updateAudio();
    this.renderAll();
    void changed;
  }

  private refreshPaint(): void {
    if (!this.car) return;
    this.car.colorMode = this.pressure && this.tab === 'drag' ? 'pressure' : 'paint';
    this.car.repaint();
  }

  private rebuildRipples(): void {
    if (!this.car || !this.ripples) return;
    const kindToItem: Record<string, ItemId> = { mirror: 'mirror', pillar: 'pillar', gap: 'gap', handle: 'handle', under: 'under', wheel: 'wheel', spoiler: 'spoiler' };
    this.ripples.setSpots(this.car.spots, (k) => {
      const c = choiceOf(this.cfg, kindToItem[k] ?? 'mirror');
      return c.noise === null ? 0 : Math.max(0, (c.noise - 38) / 22);
    });
  }

  private saveA(): void {
    this.saved = { ...this.cfg };
    this.flow?.snapshotGhost();
    this.saveBtn.textContent = 'A 다시 저장';
    this.toggles.get('ghost')?.removeAttribute('disabled');
    this.abBtn.disabled = false;
    this.showAlert('지금 설정을 A로 저장했어요. 부품을 바꾸면 B(현재)와 나란히 비교돼요.', 'ok');
    this.renderAll();
  }

  private setTab(t: Tab, immediate = false): void {
    const leaving = this.tab;
    this.tab = t;
    if (t === 'stab' && this.sub !== 'force') this.setUnder(false, false);
    if (leaving === 'noise' && t !== 'noise') this.stopSound();
    for (const [k, b] of this.tabBtns) {
      b.classList.toggle('is-active', k === t);
      b.setAttribute('aria-selected', String(k === t));
    }
    for (const [k, s] of this.sections) s.hidden = k !== t;
    for (const [k, c] of this.ctrlGroups) c.hidden = k !== t;
    if (this.wrap) this.wrap.dataset.tab = t;
    const lo = t === 'stab' ? 80 : 0;
    const hi = t === 'stab' ? 250 : 200;
    this.speedInput.min = String(lo);
    this.speedInput.max = String(hi);
    this.speedInput.value = String(this.kmh);
    this.speedMin.textContent = String(lo);
    this.speedMax.textContent = String(hi);
    const lab = this.wrap?.querySelector<HTMLElement>('[data-role="speedlabel"]');
    if (lab) lab.textContent = t === 'stab' ? '주행 속도' : '풍속';
    this.refreshPaint();
    this.applyScene();
    this.flyView(immediate);
    this.updateAudio();
    this.renderAll();
  }

  private setSub(s: Sub): void {
    this.sub = s;
    if (s !== 'force') this.setUnder(false, false);
    this.applyScene();
    this.flyView(false);
    this.renderAll();
  }

  private applyScene(): void {
    const tests = this.tab === 'stab' && this.sub !== 'force';
    for (const [k, b] of this.subBtns) {
      b.classList.toggle('is-active', k === this.sub);
      b.setAttribute('aria-pressed', String(k === this.sub));
    }
    if (this.tunnel) this.tunnel.group.visible = !tests;
    if (this.car) this.car.group.visible = !tests;
    this.flow?.setVisible(!tests);
    if (this.ripples) this.ripples.group.visible = this.tab === 'noise';
    for (const a of this.arrows) a.group.visible = this.tab === 'stab' && this.sub === 'force';
    if (this.corner) this.corner.group.visible = tests && this.sub === 'corner';
    if (this.cross) this.cross.group.visible = tests && this.sub === 'cross';
    if (tests) this.setupTests();
  }

  /** 시험 코스에 현재 차(복제)와 유령 차(다운포스 없음)를 올린다 */
  private setupTests(): void {
    const car = this.car;
    if (!car || !this.corner || !this.cross || !this.testGhostMat) return;
    const a = aero(this.cfg);
    if (this.sub === 'corner') this.corner.setCars(car.makeClone(), car.makeClone(this.testGhostMat), a.cl, 0);
    else if (this.sub === 'cross') this.cross.setCars(car.makeClone(), car.makeClone(this.testGhostMat), a.cl, a.clr, 0, 0);
    for (const g of [this.corner.group, this.cross.group]) {
      g.traverse((o) => {
        if (o.name === 'wind-car') o.visible = true;
      });
    }
  }

  private flyView(immediate: boolean): void {
    if (!this.ctx) return;
    const key = this.under?.on ? 'under' : this.tab === 'stab' ? (this.sub === 'force' ? 'force' : this.sub) : 'side';
    const v = VIEWS[key];
    this.ctx.sceneMgr.flyTo(window.matchMedia(NARROW).matches ? v.narrow : v.wide, immediate);
  }

  private onSpeed(): void {
    const v = Number(this.speedInput.value);
    if (this.tab === 'stab') {
      this.driveKmh = v;
      this.corner?.restart();
      this.cross?.restart();
    } else this.tunnelKmh = v;
    this.prev = null;
    this.updateAudio();
    this.renderAll();
  }

  private showAlert(text: string, tone: 'warn' | 'ok' = 'warn'): void {
    this.alertEl.textContent = text;
    this.alertEl.dataset.tone = tone;
    this.alertEl.classList.add('is-on');
    this.alertT = 3.4;
  }

  // ───────────────────────── 소리 ─────────────────────────

  private async toggleSound(): Promise<void> {
    const au = this.audio;
    if (!au) return;
    if (au.running) {
      this.stopSound();
      return;
    }
    const ok = await au.start();
    if (!ok) {
      this.showAlert('이 기기에서는 소리를 켤 수 없어요. 아래 막대와 스펙트럼으로 비교해 보세요.');
      return;
    }
    au.setVolume(Number(this.volInput.value) / 100);
    this.updateAudio();
    this.soundBtn.setAttribute('aria-pressed', 'true');
    this.soundBtn.textContent = '소리 끄기';
  }

  private stopSound(): void {
    void this.audio?.stop();
    this.abOn = false;
    this.abBtn.setAttribute('aria-pressed', 'false');
    this.abLabel.textContent = '';
    this.soundBtn.setAttribute('aria-pressed', 'false');
    this.soundBtn.textContent = '소리 듣기';
  }

  private toggleAB(): void {
    if (!this.saved) return;
    this.abOn = !this.abOn;
    this.abBtn.setAttribute('aria-pressed', String(this.abOn));
    this.abSide = 'A';
    this.abTimer = 2.5;
    if (this.abOn && !this.audio?.running) void this.toggleSound();
    this.updateAudio();
  }

  private updateAudio(): void {
    const au = this.audio;
    if (!au) return;
    const useA = this.abOn && this.abSide === 'A' && this.saved;
    const cfg = useA && this.saved ? this.saved : this.cfg;
    au.set(soundLevels(cfg, this.tunnelKmh), this.tab === 'noise' ? this.tunnelKmh : 0);
    this.abLabel.textContent = this.abOn ? `지금 들리는 소리: ${this.abSide === 'A' ? 'A(저장)' : 'B(현재)'}` : '';
  }

  // ───────────────────────── 화면 갱신 ─────────────────────────

  private renderAll(): void {
    if (!this.wrap) return;
    this.speedVal.textContent = `${this.kmh} km/h`;
    this.renderDrag();
    this.renderStab();
    this.renderNoise();
    this.renderCompare();
    this.renderGoals();
  }

  private row(k: string, v: string, cls = ''): HTMLElement {
    const r = el('div', `wind-row ${cls}`);
    r.append(el('span', 'wind-row-k', k), el('span', 'wind-row-v', v));
    return r;
  }

  private delta(now: number, before: number | undefined, digits: number, unit: string, lowerIsBetter = true): HTMLElement {
    const d = before === undefined ? 0 : now - before;
    const s = el('span', 'wind-delta');
    if (before === undefined || Math.abs(d) < 10 ** -digits / 2) {
      s.textContent = '변화 없음';
      s.dataset.tone = 'same';
    } else {
      const good = lowerIsBetter ? d < 0 : d > 0;
      s.textContent = `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d), digits)}${unit}`;
      s.dataset.tone = good ? 'good' : 'bad';
    }
    return s;
  }

  private big(label: string, value: string, unit: string, delta: HTMLElement | null): HTMLElement {
    const b = el('div', 'wind-big');
    b.appendChild(el('div', 'wind-big-cap', label));
    const v = el('div', 'wind-big-row');
    v.append(el('span', 'wind-big-num', value), el('span', 'wind-big-unit', unit));
    if (delta) v.appendChild(delta);
    b.appendChild(v);
    return b;
  }

  private calc(lines: [string, string][]): HTMLElement {
    const box = el('div', 'wind-calc');
    for (const [k, v] of lines) {
      const r = el('div', 'wind-calc-row');
      r.append(el('span', 'wind-calc-k', k), el('span', 'wind-calc-v', v));
      box.appendChild(r);
    }
    return box;
  }

  private renderDrag(): void {
    const a = aero(this.cfg);
    const v = this.tunnelKmh;
    const ms = kmhToMs(v);
    const F = dragN(a.cd, v);
    const P = powerKW(a.cd, v);
    const box = this.dragBox;
    box.replaceChildren();
    box.appendChild(this.big('공기저항계수 Cd', a.cd.toFixed(3), '', this.delta(a.cd, this.prev?.cd, 3, '')));
    const grid = el('div', 'wind-kpis');
    grid.append(this.row('항력 F', `${fmt(F)} N`), this.row('필요한 동력 P', `${fmt(P, 1)} kW`));
    box.appendChild(grid);
    box.appendChild(
      this.calc([
        ['항력', `F = ½ × ρ × v² × Cd × A`],
        ['', `= ½ × ${RHO} × (${fmt(ms, 1)} m/s)² × ${a.cd.toFixed(3)} × ${AREA} m²`],
        ['', `= ${fmt(F)} N`],
        ['동력', `P = F × v = ${fmt(F)} × ${fmt(ms, 1)} = ${fmt(P, 1)} kW`]
      ])
    );
    box.appendChild(el('p', 'wind-note', `ρ(공기 밀도) ${RHO} kg/m³, A(정면 면적) ${AREA} m² 로 고정. v = ${v} km/h ÷ 3.6 = ${fmt(ms, 1)} m/s`));
    this.dragChart.set(a.cd, v, this.saved ? aero(this.saved).cd : null);
    const note = this.wrap?.querySelector<HTMLElement>('[data-role="chartnote"]');
    if (note) {
      note.textContent = `100 → 200 km/h: 항력 ${fmt(dragN(a.cd, 100))} → ${fmt(dragN(a.cd, 200))} N (4배), 동력 ${fmt(powerKW(a.cd, 100), 1)} → ${fmt(powerKW(a.cd, 200), 1)} kW (8배)${this.saved ? ' · 점선 = A' : ''}`;
    }
    const contrib = this.wrap?.querySelector<HTMLElement>('[data-role="contrib"]');
    if (contrib) {
      contrib.replaceChildren(el('div', 'wind-sub-h', '부품별 Cd 기여 (가장 좋은 선택보다 얼마나 늘었나)'));
      const max = 0.03;
      for (const c of cdContrib(this.cfg)) {
        const r = el('div', 'wind-bar-row');
        const bar = el('div', 'wind-bar-track');
        const fill = el('div', 'wind-bar-fill');
        fill.style.width = `${Math.min(100, (c.delta / max) * 100)}%`;
        fill.dataset.tone = c.delta > 0.0001 ? 'bad' : 'good';
        bar.appendChild(fill);
        r.append(el('span', 'wind-bar-name', c.name), bar, el('span', 'wind-bar-val', c.delta > 0.0001 ? `+${c.delta.toFixed(3)}` : '최소'));
        r.title = c.label;
        contrib.appendChild(r);
      }
      contrib.appendChild(el('p', 'wind-note', `기본 차체 0.250 + 부품 기여의 합 = ${a.cd.toFixed(3)}`));
    }
  }

  private renderStab(): void {
    const a = aero(this.cfg);
    const v = this.driveKmh;
    const q = dynPressure(v);
    const L = liftN(a.cl, v);
    const Lf = liftN(a.clf, v);
    const Lr = liftN(a.clr, v);
    const loads = axleLoads(a, v);
    const vmax = vmaxCornerKmh(a.cl);
    const vmax0 = vmaxCornerKmh(0);
    const box = this.stabBox;
    box.replaceChildren();
    const isDown = a.cl < 0;
    box.appendChild(this.big(`양력계수 Cl (${isDown ? '− = 누르는 힘' : '+ = 띄우는 힘'})`, sgn(a.cl, 2), '', this.delta(a.cl, this.prev?.cl, 2, '')));
    const kp = el('div', 'wind-kpis');
    kp.append(
      this.row(isDown ? '다운포스' : '양력(들뜸)', `${fmt(Math.abs(L))} N`, isDown ? 'is-good' : 'is-bad'),
      this.row('앞축 / 뒤축', `${Lf <= 0 ? '↓' : '↑'}${fmt(Math.abs(Lf))} / ${Lr <= 0 ? '↓' : '↑'}${fmt(Math.abs(Lr))} N`),
      this.row('앞축 하중', `${fmt(loads.front)} N`),
      this.row('뒤축 하중', `${fmt(loads.rear)} N`)
    );
    box.appendChild(kp);
    const acc = cornerAccel(a.cl, v);
    box.appendChild(
      this.calc([
        ['양력', `L = ½ × ρ × v² × Cl × A = ${fmt(q)} Pa × (${sgn(a.cl, 2)}) × ${AREA} = ${sgn(L, 0)} N`],
        ['최대 옆 힘', `μ × (mg − L) = ${MU} × (${fmt(MASS * G)} ${L <= 0 ? '+' : '−'} ${fmt(Math.abs(L))}) = ${fmt(maxLateralN(a.cl, v))} N`],
        ['코너 한계', `v_max = √(μ·(g + 다운포스/m)·r) = ${vmax > 900 ? '∞' : fmt(vmax)} km/h`],
        ['필요/최대', `v²/r = ${fmt(acc.need, 2)} m/s² · 타이어 최대 ${fmt(acc.max, 2)} m/s²`]
      ])
    );
    box.appendChild(el('p', 'wind-note', `m = ${MASS} kg, g = ${G} m/s², μ = ${MU}, 코스 반지름 r = ${R_CORNER} m (그림은 줄여서 그렸어요). 다운포스가 없는 차의 한계는 ${fmt(vmax0)} km/h.`));
    // 다운포스와 저항의 맞바꿈
    const noWing = { ...this.cfg, spoiler: 0 };
    const an = aero(noWing);
    if (this.cfg.spoiler > 0) {
      box.appendChild(
        el(
          'p',
          'wind-trade',
          `스포일러 효과(${v} km/h): 누르는 힘 ${fmt(liftN(an.cl, v) - L)} N 늘고, 항력도 ${fmt(dragN(a.cd, v) - dragN(an.cd, v))} N 늘었어요.`
        )
      );
    } else {
      box.appendChild(el('p', 'wind-trade', '뒤 스포일러를 달면 누르는 힘이 커지지만 항력도 조금 늘어요. 직접 비교해 보세요.'));
    }
    this.renderTest();
  }

  private renderTest(): void {
    const box = this.testBox;
    box.replaceChildren();
    const a = aero(this.cfg);
    const v = this.driveKmh;
    if (this.sub === 'force') {
      box.appendChild(el('p', 'wind-lead', '3D 화살표: 초록 ↓ 누르는 힘(다운포스), 빨강 ↑ 띄우는 힘(양력). 속도를 올리면 v²에 비례해 커져요.'));
      return;
    }
    const card = el('div', 'wind-test');
    if (this.sub === 'corner') {
      const st = (i: number, cl: number, name: string): HTMLElement => {
        const s = this.corner?.state(i).status ?? 'run';
        const vm = vmaxCornerKmh(cl);
        const pass = v <= vm;
        const r = el('div', `wind-test-row ${pass ? 'is-pass' : 'is-fail'}`);
        const stTxt = pass ? '통과' : s === 'run' ? '한계 초과' : s === 'slide' ? '미끄러지는 중' : '코스 이탈';
        r.append(el('span', 'wind-test-name', name), el('span', 'wind-test-st', stTxt), el('span', 'wind-test-sub', `한계 ${vm > 900 ? '∞' : fmt(vm)} km/h`));
        return r;
      };
      card.append(el('div', 'wind-sub-h', `코너링 시험 — ${v} km/h, 반지름 ${R_CORNER} m`), st(0, a.cl, '시험 차(현재 설정)'), st(1, 0, '유령 차(다운포스 없음)'));
      card.appendChild(el('p', 'wind-note', '설정 속도가 한계를 넘으면 차가 바깥으로 미끄러져 코스를 벗어나요(타이어 자국). 화면 속도는 3.2배 빠르게 재생해요.'));
    } else {
      const cw = crosswind(a.cl, a.clr, v);
      const cw0 = crosswind(0, 0, v);
      const st = (name: string, c: ReturnType<typeof crosswind>): HTMLElement => {
        const r = el('div', `wind-test-row ${c.out > 0 ? 'is-fail' : 'is-pass'}`);
        r.append(el('span', 'wind-test-name', name), el('span', 'wind-test-st', c.out > 0 ? `차선 이탈 ${fmt(c.out, 2)} m` : '차선 안'), el('span', 'wind-test-sub', `옆으로 ${fmt(c.drift, 2)} m`));
        return r;
      };
      card.append(el('div', 'wind-sub-h', `옆바람 시험 — ${v} km/h, 돌풍 ${GUST} m/s`), st('시험 차(현재 설정)', cw), st('유령 차(다운포스 없음)', cw0));
      card.appendChild(
        this.calc([
          ['옆힘', `${fmt(cw.side)} N (돌풍 각도 ${fmt((Math.atan(GUST / kmhToMs(v)) * 180) / Math.PI, 1)}°)`],
          ['접지 하중', `mg − L = ${fmt(cw.normal)} N`],
          ['밀린 거리', `v × 미끄럼각 × ${GUST_T}s = ${fmt(cw.drift, 2)} m`]
        ])
      );
      card.appendChild(el('p', 'wind-note', `차선 안 여유는 좌우 ${LANE_MARGIN} m. 접지 하중이 클수록 타이어가 옆으로 버텨 덜 밀려요(흔들림 각도는 잘 보이게 키움).`));
    }
    box.appendChild(card);
  }

  private renderNoise(): void {
    const v = this.tunnelKmh;
    const total = noiseTotal(this.cfg, v);
    const box = this.noiseBox;
    box.replaceChildren();
    box.appendChild(this.big('실내 풍절음(추정)', v < 1 ? '—' : fmt(total, 1), 'dB', v < 1 ? null : this.delta(total, this.prev?.db, 1, ' dB')));
    box.appendChild(el('div', 'wind-sub-h', `부품별 소리 크기 (${v} km/h)`));
    const parts = noiseParts(this.cfg, Math.max(v, 1));
    const list = el('div', 'wind-contrib');
    for (const p of parts) {
      const r = el('div', 'wind-bar-row');
      const bar = el('div', 'wind-bar-track');
      const fill = el('div', 'wind-bar-fill');
      const pct = v < 1 ? 0 : Math.max(0, Math.min(100, ((p.db - 30) / 55) * 100));
      fill.style.width = `${pct}%`;
      fill.dataset.tone = p.kind;
      bar.appendChild(fill);
      r.append(el('span', 'wind-bar-name', p.name), bar, el('span', 'wind-bar-val', v < 1 ? '—' : `${fmt(p.db, 0)} dB`));
      list.appendChild(r);
    }
    box.appendChild(list);
    box.appendChild(
      this.calc([
        ['속도', `L(v) = L(100) + 60·log₁₀(v/100)  (기본 바람은 50·log₁₀)`],
        ['합치기', `L = 10·log₁₀(Σ 10^(Lᵢ/10)) = ${v < 1 ? '—' : fmt(total, 1)} dB`],
        ['휘파람', `f ≈ 0.2 × v ÷ 틈(1 cm) = ${fmt(whistleHz(v))} Hz`]
      ])
    );
    box.appendChild(el('p', 'wind-note', '소리 세기는 속도의 5~6제곱에 비례해요. 3D의 물결은 소리가 나는 곳이에요.'));
  }

  private renderCompare(): void {
    const box = this.compareEl;
    box.replaceChildren();
    if (!this.saved) {
      box.appendChild(el('p', 'wind-note', '예) 기본형을 A로 저장 → 손잡이만 매립형으로 바꿔 B와 비교'));
      return;
    }
    const A = this.saved;
    const B = this.cfg;
    const v = this.tab === 'stab' ? this.driveKmh : this.tunnelKmh;
    const aa = aero(A);
    const ab = aero(B);
    const table = el('table', 'wind-cmp');
    const thead = el('thead');
    const hr = el('tr');
    for (const h of ['', 'A', 'B(현재)', 'B − A']) hr.appendChild(el('th', '', h));
    thead.appendChild(hr);
    const tb = el('tbody');
    const line = (name: string, va: number, vb: number, d: number, lowerBetter: boolean, unit = ''): void => {
      const tr = el('tr');
      const diff = vb - va;
      const td = el('td', 'wind-num', Math.abs(diff) < 10 ** -d / 2 ? '0' : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff), d)}${unit}`);
      if (Math.abs(diff) >= 10 ** -d / 2) td.dataset.tone = (lowerBetter ? diff < 0 : diff > 0) ? 'good' : 'bad';
      tr.append(el('th', '', name), el('td', 'wind-num', fmt(va, d)), el('td', 'wind-num', fmt(vb, d)), td);
      tb.appendChild(tr);
    };
    line('Cd', aa.cd, ab.cd, 3, true);
    line(`항력 N`, dragN(aa.cd, v), dragN(ab.cd, v), 0, true);
    line(`소음 dB`, noiseTotal(A, this.tunnelKmh), noiseTotal(B, this.tunnelKmh), 1, true);
    line(`다운포스 N`, -liftN(aa.cl, v), -liftN(ab.cl, v), 0, false);
    table.append(thead, tb);
    box.appendChild(table);
    const diffs = ITEMS.filter((i) => A[i.id] !== B[i.id]).map((i) => `${i.name}: ${choiceOf(A, i.id).label} → ${choiceOf(B, i.id).label}`);
    box.appendChild(el('p', 'wind-note', diffs.length ? `바뀐 부품 — ${diffs.join(', ')}` : 'A와 B가 같아요. 부품을 바꿔 보세요.'));
    box.appendChild(el('p', 'wind-note', `항력·다운포스는 ${v} km/h, 소음은 ${this.tunnelKmh} km/h 기준`));
  }

  private renderGoals(): void {
    const a = aero(this.cfg);
    const db = noiseTotal(this.cfg, GOAL_DB_KMH);
    const vm = vmaxCornerKmh(a.cl);
    const goals: [boolean, string, string][] = [
      [a.cd < GOAL_CD, `공기저항계수 ${GOAL_CD.toFixed(2)} 아래`, `지금 ${a.cd.toFixed(3)}`],
      [db <= GOAL_DB, `풍절음 ${GOAL_DB} dB 이하 (${GOAL_DB_KMH} km/h)`, `지금 ${fmt(db, 1)} dB`],
      [vm >= GOAL_CORNER_KMH, `${GOAL_CORNER_KMH} km/h로 코너 통과`, `한계 ${vm > 900 ? '∞' : fmt(vm)} km/h`]
    ];
    this.goalsEl.replaceChildren();
    for (const [ok, t, sub] of goals) {
      const li = el('li', ok ? 'is-ok' : '');
      li.append(el('span', 'wind-goal-mark', ok ? '✓' : ''), el('span', 'wind-goal-t', t), el('span', 'wind-goal-s', sub));
      this.goalsEl.appendChild(li);
    }
    if (goals.every((g) => g[0])) this.goalsEl.appendChild(el('li', 'wind-goal-done', '세 목표를 모두 이뤘어요! 무엇을 맞바꿨는지 설명해 보세요.'));
  }

  // ───────────────────────── 매 프레임 ─────────────────────────

  update(dt: number): void {
    if (!this.ctx || !this.car) return;
    const h = Math.min(dt, 0.05);
    this.time += h;
    const kmh = this.tab === 'stab' ? this.driveKmh : this.tunnelKmh;
    const tests = this.tab === 'stab' && this.sub !== 'force';
    this.updateLift(h);
    if (!tests) {
      // 풍동 안: 이동 벨트 위에서 바퀴도 풍속에 맞춰 돈다(화면에서는 느리게)
      this.wheelAngle += (kmhToMs(kmh) / (WHEEL_R * 1.3)) * h * 0.25;
      this.car.spinWheels(this.wheelAngle);
      this.tunnel?.update(h, kmh);
      if (this.flow) {
        this.flow.speed = kmh;
        this.flow.update(h);
      }
    }
    if (this.tab === 'noise') this.ripples?.update(this.time, this.ctx.sceneMgr.camera);
    if (this.tab === 'stab' && this.sub === 'force') this.updateArrows();
    if (tests && this.sub === 'corner' && this.corner) {
      this.corner.kmh = this.driveKmh;
      this.corner.update(h);
    }
    if (tests && this.sub === 'cross' && this.cross) {
      this.cross.kmh = this.driveKmh;
      this.cross.update(h);
    }
    if (this.abOn) {
      this.abTimer -= h;
      if (this.abTimer <= 0) {
        this.abTimer = 2.5;
        this.abSide = this.abSide === 'A' ? 'B' : 'A';
        this.updateAudio();
      }
    }
    if (this.alertT > 0) {
      this.alertT -= h;
      if (this.alertT <= 0) this.alertEl.classList.remove('is-on');
    }
    this.textT -= h;
    if (this.textT <= 0 && tests) {
      this.textT = 0.25;
      this.renderTest();
    }
    this.specT -= h;
    if (this.tab === 'noise' && this.specT <= 0) {
      this.specT = 0.06;
      this.drawSpectrum();
    }
  }

  /** '하부 보기' 버튼(여러 곳에 두고 상태를 함께 맞춘다) */
  private underButton(cls: string): HTMLButtonElement {
    const b = button(cls, '하부 보기', () => this.setUnder(!this.under?.on, true));
    b.setAttribute('aria-pressed', 'false');
    b.title = '차를 리프트로 들어 올려 아래에서 올려다봐요';
    this.underBtns.push(b);
    return b;
  }

  private setUnder(on: boolean, fly: boolean): void {
    const u = this.under;
    if (!u || !this.ctx || u.on === on) return;
    if (on && this.tab === 'stab' && this.sub !== 'force') {
      this.sub = 'force';
      this.applyScene();
    }
    u.set(on, this.ctx.sceneMgr);
    this.tunnel?.setSeeThrough(on);
    if (this.underLight) this.underLight.intensity = on ? 1.6 : 0;
    for (const b of this.underBtns) {
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '하부 보기 끄기' : '하부 보기';
    }
    this.wrap?.classList.toggle('is-under', on);
    if (on) this.tipEl.textContent = '차를 리프트로 들어 올렸어요. 화면을 끌어 돌려 보며 하부 처리(노출·언더커버·디퓨저)를 바꿔 비교해 보세요.';
    if (fly || !on) this.flyView(false);
  }

  /** 들어 올린 높이를 차·유선·물결에 똑같이 적용 */
  private updateLift(h: number): void {
    const u = this.under;
    if (!u) return;
    u.update(h);
    const y = u.lift;
    if (this.car) this.car.group.position.y = y;
    if (this.flow) this.flow.group.position.y = y;
    if (this.ripples) this.ripples.group.position.y = y;
  }

  private updateArrows(): void {    const car = this.car;
    if (!car) return;
    const a = aero(this.cfg);
    const v = this.driveKmh;
    const sh = car.shape;
    const fx = WHEEL_X[0];
    const rx = WHEEL_X[1];
    const [af, ar] = this.arrows;
    const ly = this.under?.lift ?? 0;
    af?.set(new THREE.Vector3(fx, sh.yT(fx) + 0.02 + ly, 0), liftN(a.clf, v) / 2000);
    // 뒤 화살표는 윙이 있으면 윙 위에서
    const ry = (car.wing ? car.wing.y1 + 0.02 : sh.yT(rx) + 0.02) + ly;
    ar?.set(new THREE.Vector3(car.wing ? (car.wing.x0 + car.wing.x1) / 2 : rx, ry, 0), liftN(a.clr, v) / 2000);
  }

  private drawSpectrum(): void {
    const au = this.audio;
    const css = getComputedStyle(this.wrap ?? document.documentElement);
    const colors = {
      bar: css.getPropertyValue('--accent').trim() || '#2563eb',
      grid: css.getPropertyValue('--line-strong').trim() || '#ccc',
      text: css.getPropertyValue('--text-dim').trim() || '#666',
      hot: css.getPropertyValue('--cat-control').trim() || '#8a4fd8'
    };
    const v = this.tunnelKmh;
    const wf = whistleHz(v);
    let hot = -1;
    if (this.cfg.gap === 0 && v > 1) {
      for (let i = 0; i < Spectrum.BANDS; i++) {
        const a = Spectrum.F0 * (Spectrum.F1 / Spectrum.F0) ** (i / Spectrum.BANDS);
        const b = Spectrum.F0 * (Spectrum.F1 / Spectrum.F0) ** ((i + 1) / Spectrum.BANDS);
        if (wf >= a && wf < b) hot = i;
      }
    }
    if (au?.running && au.analyser) {
      this.specCap.textContent = '실시간 주파수 스펙트럼 (지금 들리는 소리)';
      this.spectrum.draw(this.spectrum.fromAnalyser(au.analyser), colors, hot);
      return;
    }
    this.specCap.textContent = '예상 주파수 스펙트럼 (소리를 켜지 않아도 비교 가능)';
    this.spectrum.draw(this.estimateSpectrum(), colors, hot);
  }

  /** 소리를 켜지 않았을 때: 채널별 필터 모양 × 세기로 그린 예상 스펙트럼 */
  private estimateSpectrum(): number[] {
    const v = this.tunnelKmh;
    if (v < 1) return new Array<number>(Spectrum.BANDS).fill(0);
    const lv = soundLevels(this.cfg, v);
    const P = (db: number): number => (db < -100 ? 0 : 10 ** (db / 10));
    const lp = (f: number, fc: number, n: number): number => 1 / (1 + (f / fc) ** n);
    const bp = (f: number, fc: number, oct: number): number => Math.exp(-((Math.log2(f / fc) / oct) ** 2));
    const out: number[] = [];
    for (let i = 0; i < Spectrum.BANDS; i++) {
      const f = Spectrum.bandHz(i);
      const p =
        P(lv.base) * lp(f, 150 + 4 * v, 2) * 0.6 +
        P(lv.mid) * bp(f, 800 + 6 * v, 1.1) +
        P(lv.whistle) * bp(f, whistleHz(v), 0.08) * 1.4 +
        P(lv.hiss) * (1 - lp(f, 4500 + 10 * v, 4)) * 0.5 +
        P(lv.rumble) * lp(f, 80 + 0.6 * v, 3) * 1.3;
      const db = 10 * Math.log10(p + 1e-9);
      out.push(Math.max(0, Math.min(1, (db - 20) / 70)));
    }
    return out;
  }

  private meshCount(): number {
    let n = 0;
    this.car?.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.visible) n++;
    });
    return n;
  }

  /** 검증 스크립트용 상태 읽기 */
  private debugState(): Record<string, unknown> {
    const a = aero(this.cfg);
    return {
      cfg: { ...this.cfg },
      cd: a.cd,
      cl: a.cl,
      clf: a.clf,
      clr: a.clr,
      db: noiseTotal(this.cfg, this.tunnelKmh),
      tunnelKmh: this.tunnelKmh,
      driveKmh: this.driveKmh,
      tab: this.tab,
      sub: this.sub,
      corner: [this.corner?.state(0), this.corner?.state(1)],
      cross: this.cross?.lastMax.slice(),
      audio: this.audio?.debug() ?? null,
      audioTargets: this.audio?.targetGains() ?? null,
      vmax: vmaxCornerKmh(a.cl),
      partsInCar: this.meshCount()
    };
  }
}
