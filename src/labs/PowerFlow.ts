// 탐구 실험 11-C — 자동차의 동력 전달(FR 후륜구동)
// 단계별 투어: 엔진 → 플라이휠·클러치 → 변속기 → 프로펠러 샤프트 → 종감속·차동기어 → 차축 → 바퀴.
// 단계를 고르면 카메라가 그 부품으로 날아가고, 그 부품만 강조되며, 엔진에서 그 부품까지 빛 입자가 흐른다.
// 가속 페달(엔진 회전수)·변속 단·클러치·커브를 바꾸면 각 부품의 회전수가 표로 계산되고 3D도 그 비율로 돈다.

import * as THREE from 'three';
import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import { el, button } from '../modes/dom';
import { LabLabels, localAnchor, type Anchor, type LabelSpec } from './common/labels';
import { PowerChassis, type Pose } from './power/chassis';
import { FlowIndicator } from './power/flow';
import { Highlighter, type HiState } from './power/highlight';
import {
  CONST_MESH,
  CURVE,
  DIFF,
  FF_COMPARE,
  FINAL,
  FINAL_RATIO,
  GEARS,
  PART_NAME,
  PART_ORDER,
  QUIZ,
  RPM_DEFAULT,
  RPM_MAX,
  RPM_MIN,
  SLOWDOWN,
  STAGES,
  TIRE,
  calc,
  fmt1,
  fmt2,
  fmtRpm,
  gearDef,
  gearRatio,
  type Curve
} from './power/data';

const SCALE = 1.6;
const QUIZ_STAGE = 8;
const DWELL = 9;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** 단계별 카메라: root 좌표 타깃 + 방위각(+X에서 앞(-Z)쪽으로, 도) · 앙각 · 거리(씬 단위) */
const VIEWS: Record<number, { t: [number, number, number]; az: number; el: number; d: number }> = {
  0: { t: [0, 0.18, 0.0], az: 142, el: 30, d: 7.6 },
  1: { t: [0, 0.31, -0.79], az: 24, el: 17, d: 2.5 },
  2: { t: [0, 0.2, -0.53], az: 8, el: 12, d: 1.5 },
  3: { t: [0, 0.17, -0.28], az: 14, el: 16, d: 2.15 },
  4: { t: [0, 0.16, 0.23], az: 4, el: 22, d: 2.5 },
  5: { t: [0, 0.13, 0.62], az: 25, el: 22, d: 1.3 },
  6: { t: [0, 0.12, 0.65], az: -58, el: 22, d: 3.5 },
  7: { t: [0.2, 0.1, 0.2], az: 8, el: 15, d: 7.0 },
  8: { t: [0, 0.18, 0.0], az: 142, el: 30, d: 7.6 }
};

/** 단계별 3D 이름표 (chassis.anchor 이름, 글자, 'b' = 아래쪽) */
const TAGS: Record<number, [string, string, ('b' | '')?][]> = {
  0: [['engine', '1 엔진'], ['clutch', '2 플라이휠·클러치', 'b'], ['trans', '3 변속기'], ['prop', '4 프로펠러 샤프트', 'b'], ['diff', '5 종감속·차동기어'], ['axle', '6 차축', 'b'], ['wheel', '7 바퀴']],
  1: [['piston', '피스톤'], ['rod', '커넥팅 로드'], ['crank', '크랭크축', 'b'], ['plug', '점화 플러그'], ['cylinder', '실린더', 'b']],
  2: [['flywheel', '플라이휠', 'b'], ['disc', '클러치판'], ['pressure', '압력판', 'b']],
  3: [['input', '입력축'], ['countershaft', '부축', 'b'], ['mainshaft', '출력축'], ['gearpair', '']],
  4: [['prop', '프로펠러 샤프트(추진축)', 'b'], ['uj1', '유니버설 조인트'], ['uj2', '유니버설 조인트']],
  5: [['pinion', '구동 피니언', 'b'], ['ring', '링 기어'], ['spider', '차동 피니언'], ['side', '사이드 기어', 'b']],
  6: [['axleL', '왼쪽 차축'], ['axleR', '오른쪽 차축'], ['housing', '차축 하우징', 'b']],
  7: [['rear', '뒷바퀴(구동)'], ['front', '앞바퀴(따라 굴러요)'], ['road', '노면', 'b']]
};

export class PowerFlow implements AppMode {
  private ctx: ModeContext | null = null;
  private chassis: PowerChassis | null = null;
  private flow: FlowIndicator | null = null;
  private hi = new Highlighter();
  private wrap: HTMLElement | null = null;
  private guide!: HTMLElement;
  private stepsBar!: HTMLElement;
  private calcPanel!: HTMLElement;
  private dock!: HTMLElement;
  private labels: LabLabels | null = null;
  private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private stepBtns: HTMLButtonElement[] = [];
  private rows = new Map<string, { row: HTMLElement; val: HTMLElement; sub: HTMLElement }>();
  private gearBtns: HTMLButtonElement[] = [];
  private rpmOut!: HTMLElement;
  private torqueEl!: HTMLElement;
  private gearGroup!: HTMLElement;
  private autoBtn: HTMLButtonElement | null = null;

  // 상태
  private stage = 0;
  private rpm = RPM_DEFAULT;
  private gear = 3;
  private clutch = false;
  private curve: Curve = 'straight';
  private auto = false;
  private autoT = 0;
  private sweep = 0;
  private quizIdx = 0;
  private quizScore = 0;
  private quizPicked: number | null = null;

  // 회전 상태(실제 rpm) + 화면 각도
  private wE = RPM_DEFAULT;
  private wO = 0;
  private clutchVis = 0;
  private pose: Pose = { crank: 0, input: 0, output: 0, ring: 0, left: 0, right: 0, spider: 0, front: 0, road: 0, clutch: 0, fire: [0, 0, 0, 0] };

  private savedMinDist = 2;
  private viewKey = '';
  private frameT = 0;
  private lastW = 0;
  private lastH = 0;

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowRight') this.go(Math.min(QUIZ_STAGE, this.stage + 1));
    else if (e.key === 'ArrowLeft') this.go(Math.max(0, this.stage - 1));
    else return;
    e.preventDefault();
  };

  private onResize = (): void => {
    this.flyToStage(false);
  };

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    this.stage = 0;
    this.rpm = RPM_DEFAULT;
    this.gear = 3;
    this.clutch = false;
    this.curve = 'straight';
    this.auto = false;
    this.autoT = 0;
    this.sweep = 0;
    this.wE = RPM_DEFAULT;
    this.wO = RPM_DEFAULT / gearRatio(gearDef(3));
    this.clutchVis = 0;
    this.quizIdx = 0;
    this.quizScore = 0;
    this.quizPicked = null;

    const ch = new PowerChassis(SCALE);
    this.chassis = ch;
    ch.setGear(this.gear);
    const flow = new FlowIndicator(0.011);
    this.flow = flow;
    ch.root.add(flow.group);
    flow.setTracks(ch.tracks(this.gear));
    ctx.sceneMgr.add(ch.car);

    this.hi = new Highlighter();
    for (const k of PART_ORDER) this.hi.register(k, ch.parts[k]);
    const road = ch.context[ch.context.length - 1];
    this.hi.register('context', ch.context.slice(0, -1));
    if (road) this.hi.register('road', [road]);

    this.savedMinDist = ctx.sceneMgr.controls.minDistance;
    ctx.sceneMgr.controls.minDistance = 0.9;

    this.buildDom(ctx.root);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    this.go(0, true);
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    const ctx = this.ctx;
    if (ctx) {
      ctx.sceneMgr.camera.clearViewOffset();
      ctx.sceneMgr.controls.minDistance = this.savedMinDist;
      if (this.chassis) ctx.sceneMgr.remove(this.chassis.car);
    }
    this.flow?.dispose();
    this.chassis?.dispose();
    this.flow = null;
    this.chassis = null;
    this.labels?.dispose();
    this.labels = null;
    this.wrap?.remove();
    this.wrap = null;
    this.stepBtns = [];
    this.rows.clear();
    this.gearBtns = [];
    this.autoBtn = null;
    this.viewKey = '';
    this.lastW = 0;
    this.ctx = null;
  }

  // ───────────────────────── DOM ─────────────────────────

  private buildDom(root: HTMLElement): void {
    const wrap = el('div', 'pf-wrap');
    this.wrap = wrap;
    this.dock = el('div', 'pf-dock');

    // 단계 막대(동력 전달 순서 그 자체)
    this.stepsBar = el('nav', 'pf-steps pf-panel');
    this.stepsBar.setAttribute('aria-label', '동력 전달 단계');
    const scroll = el('div', 'pf-steps-scroll');
    const list = el('div', 'pf-steps-list');
    STAGES.forEach((s, i) => {
      if (i >= 2 && i <= 7) {
        const ar = el('span', 'pf-arrow');
        ar.append(chevron());
        list.append(ar);
      }
      const b = el('button', `pf-step${i === 0 || i === QUIZ_STAGE ? ' is-extra' : ''}`);
      b.type = 'button';
      if (i >= 1 && i <= 7) b.append(el('span', 'pf-step-n', String(i)));
      b.append(el('span', 'pf-step-l', s.short));
      b.addEventListener('click', () => this.go(i));
      this.stepBtns.push(b);
      list.append(b);
    });
    scroll.append(list);
    this.stepsBar.append(scroll);

    this.guide = el('section', 'pf-guide pf-panel');
    this.guide.setAttribute('aria-live', 'polite');

    this.calcPanel = this.buildCalc();
    this.dock.append(this.stepsBar, this.guide, this.calcPanel);
    wrap.append(this.dock);
    root.append(wrap);
    // 이름표 레이어 + 켜고 끄는 버튼(단계 막대 끝 — 스크롤하지 않아도 보이는 자리)
    const labels = new LabLabels(this.ctx!, wrap, { bounds: () => this.bounds });
    this.labels = labels;
    this.stepsBar.append(labels.button);
  }

  private buildCalc(): HTMLElement {
    const p = el('section', 'pf-calc pf-panel');
    const head = el('div', 'pf-calc-head');
    head.append(el('h3', 'pf-h3', '회전수 계산'), el('span', 'pf-calc-tag', 'FR 5단 수동'));
    p.append(head);

    // 가속 페달
    const pedal = el('label', 'pf-pedal');
    const top = el('span', 'pf-pedal-top');
    this.rpmOut = el('span', 'pf-pedal-v');
    top.append(el('span', 'pf-pedal-l', '가속 페달'), this.rpmOut);
    const input = el('input', 'pf-range');
    input.type = 'range';
    input.min = String(RPM_MIN);
    input.max = String(RPM_MAX);
    input.step = '100';
    input.value = String(this.rpm);
    input.setAttribute('aria-label', '가속 페달 — 엔진 회전수');
    input.addEventListener('input', () => {
      this.rpm = Number(input.value);
      this.refreshCalc();
    });
    const scale = el('span', 'pf-pedal-scale');
    scale.append(el('span', undefined, '살짝(공회전)'), el('span', undefined, '깊게'));
    pedal.append(top, input, scale);
    p.append(pedal);

    // 변속 단
    const gg = el('div', 'pf-gears');
    this.gearGroup = gg;
    gg.append(el('span', 'pf-field-l', '변속 단'));
    const seg = el('div', 'pf-seg');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', '변속 단');
    for (const g of GEARS) {
      const b = el('button', 'pf-seg-b');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.append(el('span', 'pf-seg-n', `${g.n}단`), el('span', 'pf-seg-r', fmt2(gearRatio(g))));
      b.addEventListener('click', () => this.setGear(g.n));
      this.gearBtns.push(b);
      seg.append(b);
    }
    gg.append(seg);
    p.append(gg);

    // 표
    const table = el('div', 'pf-table');
    table.setAttribute('role', 'table');
    const addRow = (key: string, stage: number, name: string): void => {
      const row = el('div', 'pf-row');
      row.setAttribute('role', 'row');
      row.dataset.stage = String(stage);
      const nm = el('div', 'pf-row-name');
      nm.setAttribute('role', 'rowheader');
      nm.append(el('span', 'pf-row-n', String(stage)), el('span', 'pf-row-t', name));
      const val = el('div', 'pf-row-v');
      val.setAttribute('role', 'cell');
      const sub = el('div', 'pf-row-f');
      row.append(nm, val, sub);
      table.append(row);
      this.rows.set(key, { row, val, sub });
    };
    addRow('engine', 1, '엔진(크랭크축)');
    addRow('clutch', 2, '클러치');
    addRow('trans', 3, '변속기 출력');
    addRow('prop', 4, '프로펠러 샤프트');
    addRow('diff', 5, '종감속 후(링 기어)');
    addRow('axle', 6, '차축 왼쪽 / 오른쪽');
    addRow('wheel', 7, '차의 속도');
    p.append(table);
    this.torqueEl = el('p', 'pf-torque');
    p.append(this.torqueEl);
    const spec = el('p', 'pf-spec');
    spec.textContent = `예시 차량: 변속비 ${GEARS.map((g) => `${g.n}단 ${fmt2(gearRatio(g))}`).join(' · ')}, 종감속비 ${fmt2(FINAL_RATIO)}, 타이어 ${TIRE.name}(둘레 약 ${TIRE.circ}m). 바퀴가 미끄러지지 않는다고 보고 계산해요. 화면 속 회전은 실제보다 ${SLOWDOWN}배 느리게 보여 줘요.`;
    p.append(spec);
    return p;
  }

  private setGear(n: number): void {
    if (n === this.gear) return;
    this.gear = n;
    this.chassis?.setGear(n);
    if (this.chassis && this.flow) this.flow.setTracks(this.chassis.tracks(n));
    this.applyHighlight();
    this.refreshCalc();
    if (this.stage === 3) {
      this.renderGuide();
      this.labels?.setText('gearpair', this.gearpairText());
    }
  }

  private refreshCalc(): void {
    const c = calc(this.rpm, this.gear, this.curve);
    this.rpmOut.textContent = `엔진 ${fmtRpm(this.rpm)} rpm`;
    this.gearBtns.forEach((b, i) => {
      const on = GEARS[i]?.n === this.gear;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    const set = (key: string, val: string, sub: string): void => {
      const r = this.rows.get(key);
      if (!r) return;
      r.val.textContent = val;
      r.sub.textContent = sub;
    };
    const cut = this.clutch;
    set('engine', `${fmtRpm(c.engine)} rpm`, '가속 페달을 깊이 밟을수록 빨라져요');
    set('clutch', cut ? '끊김' : '연결', cut ? '엔진의 회전이 변속기로 가지 않아요' : '변속기 입력축 = 엔진 회전수');
    if (cut) {
      for (const k of ['trans', 'prop', 'diff', 'axle', 'wheel']) set(k, '—', '클러치가 끊겨 동력이 전달되지 않아요');
    } else {
      set('trans', `${fmtRpm(c.out)} rpm`, `${fmtRpm(c.engine)} ÷ ${fmt2(c.ratio)}(${this.gear}단)`);
      set('prop', `${fmtRpm(c.out)} rpm`, '변속기 출력과 같아요');
      set('diff', `${fmtRpm(c.axle)} rpm`, `${fmtRpm(c.out)} ÷ ${fmt2(FINAL_RATIO)}(종감속비)`);
      set('axle', `${fmtRpm(c.left)} / ${fmtRpm(c.right)} rpm`, this.curve === 'straight' ? '직진: 좌우가 같아요' : `커브: 두 바퀴의 평균 = ${fmtRpm(c.axle)}`);
      set('wheel', `${fmt1(c.speed)} km/h`, `${fmtRpm(c.axle)} × ${TIRE.circ}m × 60 ÷ 1000`);
    }
    this.torqueEl.textContent = cut
      ? '클러치를 밟으면 바퀴로 힘이 가지 않아요.'
      : `바퀴를 돌리는 힘(토크)은 엔진의 약 ${fmt2(c.ratio)} × ${fmt2(FINAL_RATIO)} = ${fmt1(c.torqueX)}배 (마찰 손실 무시)`;
    if (this.stage === 5 || this.stage === 6 || this.stage === 2) this.refreshLive();
  }

  /** 안내 패널 속 실시간 값(커브·클러치) */
  private refreshLive(): void {
    const live = this.guide.querySelector<HTMLElement>('[data-live]');
    if (!live) return;
    const c = calc(this.rpm, this.gear, this.curve);
    if (this.stage === 2) {
      live.textContent = this.clutch ? '지금: 클러치 끊김 — 엔진은 돌지만 변속기 뒤쪽은 서서히 멈춰요.' : '지금: 클러치 연결 — 엔진의 회전이 변속기로 그대로 들어가요.';
    } else if (this.curve === 'straight') {
      live.textContent = `직진: 왼쪽 ${fmtRpm(c.left)} rpm = 오른쪽 ${fmtRpm(c.right)} rpm. 차동 피니언은 케이스와 함께 돌기만 하고 스스로 돌지 않아요.`;
    } else {
      const inner = this.curve === 'left' ? '왼쪽' : '오른쪽';
      const outer = this.curve === 'left' ? '오른쪽' : '왼쪽';
      const vi = this.curve === 'left' ? c.left : c.right;
      const vo = this.curve === 'left' ? c.right : c.left;
      live.textContent = `${this.curve === 'left' ? '왼쪽' : '오른쪽'} 커브: 바깥 ${outer} 바퀴 ${fmtRpm(vo)} rpm, 안쪽 ${inner} 바퀴 ${fmtRpm(vi)} rpm. 평균 ${fmtRpm((vo + vi) / 2)} rpm = 링 기어. (회전 반지름 ${CURVE.radius}m, 좌우 바퀴 사이 ${CURVE.track}m로 가정)`;
    }
  }

  // ───────────────────────── 단계 ─────────────────────────

  private go(i: number, immediate = false): void {
    const prev = this.stage;
    this.stage = i;
    if (i !== 2 && this.clutch) {
      this.clutch = false;
    }
    if (i !== 5 && i !== 6) this.curve = 'straight';
    if (i === QUIZ_STAGE && prev !== QUIZ_STAGE) {
      this.quizIdx = 0;
      this.quizScore = 0;
      this.quizPicked = null;
    }
    if (i === 0 || i === QUIZ_STAGE) this.sweep = 0;
    this.autoT = 0;
    if (this.auto && i === QUIZ_STAGE) this.setAuto(false);
    this.stepBtns.forEach((b, k) => {
      b.classList.toggle('is-on', k === i);
      b.classList.toggle('is-done', k >= 1 && k <= 7 && i >= 1 && i <= 7 && k < i);
      if (k === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    this.stepBtns[i]?.scrollIntoView({ block: 'nearest', inline: 'center' });
    this.rows.forEach((r) => {
      const s = Number(r.row.dataset.stage);
      r.row.classList.toggle('is-on', s === i);
      r.row.classList.toggle('is-past', i >= 1 && i <= 7 && s < i);
    });
    this.gearGroup.classList.toggle('is-hint', i === 3);
    this.renderGuide();
    this.refreshCalc();
    this.applyHighlight();
    this.setLabels();
    if (this.chassis) this.chassis.forceArrows.visible = i === 7;
    this.flyToStage(immediate);
  }

  private applyHighlight(): void {
    const ch = this.chassis;
    if (!ch) return;
    const i = this.stage;
    const st: Record<string, HiState> = {};
    let extra: THREE.Object3D[] = [];
    if (i >= 1 && i <= 7) {
      PART_ORDER.forEach((k, idx) => {
        st[k] = idx + 1 < i ? 'pass' : idx + 1 === i ? 'focus' : 'dim';
      });
      st.context = 'dim';
      st.road = i === 7 ? 'normal' : 'dim';
      if (i === 3) extra = ch.gearMeshes.get(this.gear) ?? [];
    } else if (i === QUIZ_STAGE && this.quizPicked !== null) {
      const q = QUIZ[this.quizIdx];
      if (q) {
        for (const k of PART_ORDER) st[k] = k === q.part ? 'focus' : 'pass';
        st.context = 'pass';
      }
    }
    this.hi.set(st, extra);
  }

  private setAuto(on: boolean): void {
    this.auto = on;
    this.autoT = 0;
    if (this.autoBtn) {
      this.autoBtn.classList.toggle('is-on', on);
      this.autoBtn.setAttribute('aria-pressed', String(on));
      const l = this.autoBtn.querySelector('.pf-auto-l');
      if (l) l.textContent = on ? '멈춤' : '자동 재생';
      this.autoBtn.style.setProperty('--p', '0');
    }
  }

  private renderGuide(): void {
    const s = STAGES[this.stage];
    if (!s) return;
    const g = this.guide;
    g.replaceChildren();
    const head = el('div', 'pf-head');
    const badge = el('span', 'pf-badge', this.stage >= 1 && this.stage <= 7 ? String(this.stage) : this.stage === 0 ? 'FR' : '?');
    const ht = el('div', 'pf-head-t');
    ht.append(el('span', 'pf-eyebrow', this.stage >= 1 && this.stage <= 7 ? `동력 전달 ${this.stage} / 7` : '자동차의 동력 전달'), el('h2', 'pf-title', s.title));
    head.append(badge, ht);
    g.append(head);

    if (this.stage === QUIZ_STAGE) {
      this.renderQuiz(g);
      return;
    }
    g.append(el('p', 'pf-body', s.body));
    if (this.stage === 0) {
      const chain = el('ol', 'pf-chain');
      PART_ORDER.forEach((k, idx) => {
        const li = el('li', 'pf-chain-i');
        const b = button('pf-chain-b', PART_NAME[k], () => this.go(idx + 1));
        li.append(b);
        chain.append(li);
      });
      g.append(chain);
      const ff = el('div', 'pf-card');
      ff.append(el('strong', 'pf-card-t', 'FF와 비교하면?'), el('span', 'pf-card-b', FF_COMPARE));
      g.append(ff);
    } else {
      g.append(el('p', 'pf-point', s.point));
    }
    const extra = this.stageExtra();
    if (extra) g.append(extra);
    g.append(this.navRow());
  }

  private stageExtra(): HTMLElement | null {
    const box = el('div', 'pf-extra');
    const c = calc(this.rpm, this.gear, this.curve);
    switch (this.stage) {
      case 1:
        box.append(legend('pf-dot-fire', '주황빛: 실린더 안의 연소(폭발)'), el('p', 'pf-note', '엔진 회전수(rpm) = 크랭크축이 1분 동안 도는 횟수예요.'));
        return box;
      case 2: {
        const b = el('button', `pf-toggle${this.clutch ? ' is-on' : ''}`);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(this.clutch));
        b.append(el('span', 'pf-toggle-k'), el('span', undefined, this.clutch ? '클러치 페달 떼기' : '클러치 페달 밟기'));
        b.addEventListener('click', () => {
          this.clutch = !this.clutch;
          this.renderGuide();
          this.refreshCalc();
        });
        const live = el('p', 'pf-live');
        live.dataset.live = '1';
        box.append(b, live);
        return box;
      }
      case 3: {
        const d = gearDef(this.gear);
        const t = el('p', 'pf-formula');
        if (d.pair) {
          t.textContent = `${this.gear}단 변속비 = (부축 ${CONST_MESH.counter}T ÷ 입력 ${CONST_MESH.input}T) × (출력 ${d.pair.main}T ÷ 부축 ${d.pair.counter}T) = ${fmt2(gearRatio(d))}`;
        } else {
          t.textContent = '4단은 슬리브가 입력축과 출력축을 바로 이어 1 : 1로 돌아요(직결). 5단은 변속비가 1보다 작아 엔진보다 빨리 돌아요.';
        }
        box.append(t, legend('pf-dot-blue', `파란빛: 지금 물린 ${this.gear}단 기어`), el('p', 'pf-note', '오른쪽(아래) 표의 변속 단을 바꿔 보세요. 실제로는 클러치를 밟고 바꿔요.'));
        return box;
      }
      case 4:
        box.append(el('p', 'pf-formula', this.clutch ? '' : `프로펠러 샤프트 회전수 = 변속기 출력 = ${fmtRpm(c.out)} rpm`));
        return box;
      case 5:
      case 6: {
        if (this.stage === 5) box.append(el('p', 'pf-formula', `종감속비 = 링 기어 ${FINAL.ring}T ÷ 구동 피니언 ${FINAL.pinion}T = ${fmt2(FINAL_RATIO)}`));
        const seg = el('div', 'pf-seg pf-curve');
        seg.setAttribute('role', 'radiogroup');
        seg.setAttribute('aria-label', '주행 방향');
        const opts: [Curve, string][] = [['left', '왼쪽 커브'], ['straight', '직진'], ['right', '오른쪽 커브']];
        for (const [v, label] of opts) {
          const b = el('button', `pf-seg-b${this.curve === v ? ' is-on' : ''}`, label);
          b.type = 'button';
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', String(this.curve === v));
          b.addEventListener('click', () => {
            this.curve = v;
            this.renderGuide();
            this.refreshCalc();
          });
          seg.append(b);
        }
        const live = el('p', 'pf-live');
        live.dataset.live = '1';
        box.append(seg, live);
        if (this.stage === 5) box.append(el('p', 'pf-note', `차동 피니언 ${DIFF.spider}T가 양쪽 사이드 기어 ${DIFF.side}T와 맞물려 있어요.`));
        return box;
      }
      case 7:
        box.append(
          el('p', 'pf-formula', this.clutch ? '' : `차의 속도 = ${fmtRpm(c.axle)} rpm × ${TIRE.circ}m × 60 ÷ 1000 = ${fmt1(c.speed)} km/h`),
          legend('pf-dot-fire', '주황 화살표: 타이어가 노면을 뒤로 미는 힘'),
          legend('pf-dot-ok', '초록 화살표: 노면이 타이어를 앞으로 미는 힘(반작용)')
        );
        return box;
      default:
        return null;
    }
  }

  private navRow(): HTMLElement {
    const nav = el('div', 'pf-nav');
    const prev = button('pf-btn', '이전', () => this.go(Math.max(0, this.stage - 1)));
    prev.disabled = this.stage === 0;
    const auto = el('button', `pf-btn pf-auto${this.auto ? ' is-on' : ''}`);
    auto.type = 'button';
    auto.setAttribute('aria-pressed', String(this.auto));
    auto.append(el('span', 'pf-auto-bar'), el('span', 'pf-auto-l', this.auto ? '멈춤' : '자동 재생'));
    auto.addEventListener('click', () => {
      const on = !this.auto;
      if (on && this.stage >= 7) this.go(0);
      this.setAuto(on);
    });
    this.autoBtn = auto;
    const next = button('pf-btn is-primary', this.stage === 7 ? '확인 문제' : this.stage === 0 ? '시작하기' : '다음', () => this.go(Math.min(QUIZ_STAGE, this.stage + 1)));
    nav.append(prev, auto, next);
    return nav;
  }

  // ───────────────────────── 확인 문제 ─────────────────────────

  private renderQuiz(g: HTMLElement): void {
    const q = QUIZ[this.quizIdx];
    if (!q) {
      const res = el('div', 'pf-quiz-res');
      res.append(el('p', 'pf-score', `${QUIZ.length}문제 중 ${this.quizScore}문제 맞혔어요`));
      res.append(el('p', 'pf-body', this.quizScore === QUIZ.length ? '완벽해요! FR 자동차의 동력 전달 순서를 잘 알고 있어요.' : '틀린 단계는 다시 살펴보고 도전해 보세요.'));
      const chain = el('p', 'pf-point', STAGES[0]!.point);
      const ff = el('div', 'pf-card');
      ff.append(el('strong', 'pf-card-t', 'FF와 비교하면?'), el('span', 'pf-card-b', FF_COMPARE));
      const nav = el('div', 'pf-nav');
      nav.append(
        button('pf-btn', '다시 풀기', () => {
          this.quizIdx = 0;
          this.quizScore = 0;
          this.quizPicked = null;
          this.applyHighlight();
          this.renderGuide();
        }),
        button('pf-btn is-primary', '처음부터 보기', () => this.go(0))
      );
      res.append(chain, ff, nav);
      g.append(res);
      return;
    }
    g.append(el('p', 'pf-quiz-n', `문제 ${this.quizIdx + 1} / ${QUIZ.length}`), el('p', 'pf-quiz-q', q.q));
    const list = el('div', 'pf-choices');
    q.choices.forEach((c, i) => {
      const b = el('button', 'pf-choice');
      b.type = 'button';
      b.append(el('span', 'pf-choice-k', String(i + 1)), el('span', undefined, c));
      if (this.quizPicked !== null) {
        b.disabled = true;
        if (i === q.answer) b.classList.add('is-correct');
        else if (i === this.quizPicked) b.classList.add('is-wrong');
      }
      b.addEventListener('click', () => {
        if (this.quizPicked !== null) return;
        this.quizPicked = i;
        if (i === q.answer) this.quizScore++;
        this.ctx?.playSound(i === q.answer ? 'ok' : 'wrong');
        this.applyHighlight();
        this.renderGuide();
      });
      list.append(b);
    });
    g.append(list);
    if (this.quizPicked !== null) {
      const ok = this.quizPicked === q.answer;
      const fb = el('div', `pf-fb ${ok ? 'is-ok' : 'is-bad'}`);
      fb.append(el('strong', undefined, ok ? '정답이에요!' : `아쉬워요. 정답: ${q.choices[q.answer] ?? ''}`), el('span', undefined, q.explain));
      g.append(fb);
      const nav = el('div', 'pf-nav');
      const nx = button('pf-btn is-primary', this.quizIdx + 1 >= QUIZ.length ? '결과 보기' : '다음 문제', () => {
        this.quizIdx++;
        this.quizPicked = null;
        this.applyHighlight();
        this.renderGuide();
      });
      nav.append(nx);
      g.append(nav);
      nx.focus({ preventScroll: true });
    }
  }

  // ───────────────────────── 카메라 ─────────────────────────

  private flyToStage(immediate: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const v = VIEWS[this.stage] ?? VIEWS[0]!;
    const narrow = window.innerWidth < 1100;
    const portrait = window.innerWidth < window.innerHeight;
    // 세로 화면은 SceneManager가 수직 화각을 넓혀 주므로 거리는 조금만 늘린다
    const wide = this.stage === 0 || this.stage === QUIZ_STAGE || this.stage === 7;
    const d = v.d * (portrait ? (wide ? 1.02 : 0.95) : narrow ? 1.1 : 1);
    const t = new THREE.Vector3(v.t[0] * SCALE, (v.t[1] + 0.13) * SCALE, v.t[2] * SCALE);
    const az = THREE.MathUtils.degToRad(v.az);
    const elv = THREE.MathUtils.degToRad(v.el);
    const pos = t.clone().add(new THREE.Vector3(Math.cos(elv) * Math.cos(az), Math.sin(elv), -Math.cos(elv) * Math.sin(az)).multiplyScalar(d));
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
      const g = this.guide.getBoundingClientRect();
      const c = this.calcPanel.getBoundingClientRect();
      const s = this.stepsBar.getBoundingClientRect();
      x0 = g.right;
      x1 = c.left;
      y1 = s.top;
    } else {
      y0 = 56;
      y1 = this.dock.getBoundingClientRect().top;
    }
    this.bounds = { x0, y0, x1, y1 };
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const key = `${W}x${H}:${Math.round(cx)},${Math.round(cy)}`;
    if (key === this.viewKey && W === this.lastW && H === this.lastH) return;
    this.viewKey = key;
    this.lastW = W;
    this.lastH = H;
    const cam = ctx.sceneMgr.camera;
    cam.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  }

  // ───────────────────────── 3D 이름표 ─────────────────────────

  /** chassis.anchor 이름 → 월드 기준점(root 좌표를 매 프레임 월드로) */
  private anchorOf(ch: PowerChassis, name: string): Anchor | null {
    if (name === 'gearpair') {
      // 고른 단에 따라 자리가 옮겨 간다 — 매 프레임 다시 읽는다
      return (out) => {
        const p = ch.anchor('gearpair');
        if (!p) return false;
        ch.root.updateWorldMatrix(true, false);
        out.copy(p).applyMatrix4(ch.root.matrixWorld);
        return true;
      };
    }
    const p = ch.anchor(name);
    return p ? localAnchor(ch.root, p.x, p.y, p.z) : null;
  }

  private gearpairText(): string {
    return this.gear === 4 ? '4단: 직결 슬리브' : `${this.gear}단 기어 쌍`;
  }

  private setLabels(): void {
    const ch = this.chassis;
    const labels = this.labels;
    if (!ch || !labels) return;
    const overview = this.stage === 0 || this.stage === QUIZ_STAGE;
    const specs: LabelSpec[] = [];
    const used = new Set<string>();
    const add = (anchor: string, text0: string, below: 'b' | '' | undefined, priority: 1 | 2 | 3): void => {
      const at = this.anchorOf(ch, anchor);
      if (!at) return;
      const text = anchor === 'gearpair' ? this.gearpairText() : text0;
      specs.push({ key: anchor, text, at, side: below ? 'below' : 'above', priority });
      used.add(anchor);
    };
    const own = overview ? TAGS[0]! : TAGS[this.stage] ?? [];
    for (const [anchor, text, below] of own) add(anchor, text, below, 1);
    // 1~7단계에서도 큰 장치(0단계의 7개)의 이름을 볼 수 있게 — 같은 기준점은 뺀다
    if (!overview) for (const [anchor, text, below] of TAGS[0]!) if (!used.has(anchor)) add(anchor, text, below, 3);
    labels.set(specs);
  }

  // ───────────────────────── 프레임 ─────────────────────────

  update(dt: number, t: number): void {
    const ch = this.chassis;
    const flow = this.flow;
    if (!ch || !flow) return;
    const ratio = gearRatio(gearDef(this.gear));

    // 실제 rpm 상태: 엔진은 페달을 따라가고, 변속기 뒤쪽(차 속도)은 천천히 따라간다
    this.wE += (this.rpm - this.wE) * Math.min(1, dt * 3);
    const target = this.clutch ? 0 : this.wE / ratio;
    this.wO += (target - this.wO) * Math.min(1, dt * (this.clutch ? 0.7 : 2.2));
    const wI = this.wO * ratio;
    this.clutchVis += ((this.clutch ? 1 : 0) - this.clutchVis) * Math.min(1, dt * 8);

    const F = (Math.PI * 2) / 60 / SLOWDOWN;
    const p = this.pose;
    const k = this.curve === 'left' ? CURVE.track / 2 / CURVE.radius : this.curve === 'right' ? -CURVE.track / 2 / CURVE.radius : 0;
    const wR = -this.wO / FINAL_RATIO;
    const wl = wR * (1 - k);
    const wr = wR * (1 + k);
    p.crank += this.wE * F * dt;
    p.input += wI * F * dt;
    p.output += this.wO * F * dt;
    p.ring += wR * F * dt;
    p.left += wl * F * dt;
    p.right += wr * F * dt;
    p.spider += ((wl - wr) / 2) * (DIFF.side / DIFF.spider) * F * dt;
    p.front += wR * F * dt;
    p.road += Math.abs(wR) * F * dt * 0.25;
    p.clutch = this.clutchVis;
    // 점화 순서 1-3-4-2: 크랭크 720° 동안 0°, 180°, 360°, 540°에 차례로 폭발
    const cyc = ((p.crank % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);
    const fireAt = [0, 3 * Math.PI, Math.PI, 2 * Math.PI];
    for (let i = 0; i < 4; i++) {
      const d = (cyc - fireAt[i]! + 4 * Math.PI) % (4 * Math.PI);
      p.fire[i] = d < 1.0 ? 1 - d : 0;
    }
    ch.setPose(p, dt);

    // 동력 흐름
    const speed = 0.22 + (this.wE / RPM_MAX) * 0.3;
    let front: number | null = null;
    if (this.stage === 0 || this.stage === QUIZ_STAGE) {
      const total = flow.totalLength();
      this.sweep += dt * 0.55;
      const cycle = total + 0.9;
      if (this.sweep > cycle) this.sweep = 0;
      front = Math.min(total, this.sweep);
    }
    const cut = this.clutch ? (flow.stageEnd(1) + flow.stageEnd(2)) / 2 : null;
    flow.update(dt, speed, this.stage, front, cut);

    this.hi.update(t);

    this.frameT += dt;
    if (this.frameT > 0.2 || window.innerWidth !== this.lastW || window.innerHeight !== this.lastH) {
      this.frameT = 0;
      this.updateFrame();
    }
    this.labels?.update();

    if (this.auto) {
      this.autoT += dt;
      this.autoBtn?.style.setProperty('--p', String(Math.min(1, this.autoT / DWELL)));
      if (this.autoT >= DWELL) {
        if (this.stage >= 7) this.setAuto(false);
        else this.go(this.stage + 1);
      }
    }
  }
}

function chevron(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M6 3.5 10.5 8 6 12.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function legend(dotCls: string, text: string): HTMLElement {
  const p = el('p', 'pf-legend');
  p.append(el('span', `pf-dot ${dotCls}`), el('span', undefined, text));
  return p;
}
