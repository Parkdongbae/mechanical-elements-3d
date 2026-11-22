// 조작부: H자 변속 레버(수동), P·R·N·D 셀렉터(자동), 페달. 마우스·터치·키보드 모두 지원.

import type { GearId } from './spec';
import type { Selector } from './model';

const NS = 'http://www.w3.org/2000/svg';

// H 패턴 좌표(상자 안 0~1 비율)
const COLS = [0.18, 0.5, 0.82];
const ROW_TOP = 0.15;
const ROW_MID = 0.5;
const ROW_BOT = 0.85;
const POS: Record<string, [number, number]> = {
  '1': [COLS[0]!, ROW_TOP],
  '2': [COLS[0]!, ROW_BOT],
  '3': [COLS[1]!, ROW_TOP],
  '4': [COLS[1]!, ROW_BOT],
  '5': [COLS[2]!, ROW_TOP],
  R: [COLS[2]!, ROW_BOT],
  N: [COLS[1]!, ROW_MID]
};
const ORDER: GearId[] = [1, 2, 3, 4, 5, 'R', 'N'];

/** 점을 H 모양 홈(가운데 가로줄 + 세로줄 3개) 위로 투영 */
function projectH(x: number, y: number): [number, number] {
  let best: [number, number] = [COLS[1]!, ROW_MID];
  let bd = Infinity;
  const consider = (px: number, py: number): void => {
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) {
      bd = d;
      best = [px, py];
    }
  };
  consider(Math.min(COLS[2]!, Math.max(COLS[0]!, x)), ROW_MID);
  for (const c of COLS) consider(c, Math.min(ROW_BOT, Math.max(ROW_TOP, y)));
  return best;
}

export class HShifter {
  readonly el: HTMLElement;
  private knob: HTMLElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private current: GearId = 'N';
  private dragging = false;
  private moved = false;

  constructor(private onPick: (g: GearId) => void) {
    this.el = document.createElement('div');
    this.el.className = 'car-hshift';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', '수동 변속 레버 (H자)');
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('preserveAspectRatio', 'none');
    s.setAttribute('class', 'car-hshift-gate');
    s.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    const P = (v: number): number => v * 100;
    path.setAttribute(
      'd',
      `M ${P(COLS[0]!)} ${P(ROW_MID)} L ${P(COLS[2]!)} ${P(ROW_MID)} ` +
        COLS.map((c) => `M ${P(c)} ${P(ROW_TOP)} L ${P(c)} ${P(ROW_BOT)}`).join(' ')
    );
    s.appendChild(path);
    this.el.appendChild(s);
    for (const g of ORDER) {
      const key = String(g);
      const [x, y] = POS[key]!;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'car-hshift-pos' + (g === 'N' ? ' is-n' : '');
      b.textContent = key;
      b.style.left = `${x * 100}%`;
      b.style.top = `${y * 100}%`;
      b.setAttribute('aria-label', g === 'N' ? '중립' : g === 'R' ? '후진' : `${key}단`);
      b.addEventListener('click', (e) => {
        if (this.moved) return;
        e.stopPropagation();
        this.onPick(g);
      });
      this.el.appendChild(b);
      this.buttons.set(key, b);
    }
    this.knob = document.createElement('div');
    this.knob.className = 'car-hshift-knob';
    this.knob.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.knob);
    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    this.set('N');
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  private onDown = (e: PointerEvent): void => {
    // 손잡이 근처를 잡았을 때만 끌기 시작(버튼 클릭은 그대로 둔다)
    const [x, y] = this.local(e);
    const [kx, ky] = POS[String(this.current)]!;
    if (Math.hypot(x - kx, (y - ky) * 0.8) > 0.16) return;
    this.dragging = true;
    this.moved = false;
    this.el.setPointerCapture(e.pointerId);
    this.knob.classList.add('is-drag');
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const [x, y] = this.local(e);
    const [px, py] = projectH(x, y);
    const [kx, ky] = POS[String(this.current)]!;
    if (Math.hypot(px - kx, py - ky) > 0.04) this.moved = true;
    this.knob.style.left = `${px * 100}%`;
    this.knob.style.top = `${py * 100}%`;
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.knob.classList.remove('is-drag');
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
    if (!this.moved) {
      this.set(this.current);
      return;
    }
    const [x, y] = this.local(e);
    const [px, py] = projectH(x, y);
    let pick: GearId = 'N';
    let bd = Infinity;
    for (const g of ORDER) {
      const [gx, gy] = POS[String(g)]!;
      const d = Math.hypot(px - gx, py - gy);
      if (d < bd) {
        bd = d;
        pick = g;
      }
    }
    // 가로줄 위에서 놓으면 중립
    if (Math.abs(py - ROW_MID) < 0.12) pick = 'N';
    this.set(this.current);
    this.onPick(pick);
    setTimeout(() => (this.moved = false), 0);
  };

  set(g: GearId): void {
    this.current = g;
    const [x, y] = POS[String(g)]!;
    this.knob.style.left = `${x * 100}%`;
    this.knob.style.top = `${y * 100}%`;
    this.knob.textContent = String(g);
    for (const [k, b] of this.buttons) {
      const on = k === String(g);
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  shake(): void {
    this.el.classList.remove('is-shake');
    void this.el.offsetWidth;
    this.el.classList.add('is-shake');
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
  }
}

const SEL: Selector[] = ['P', 'R', 'N', 'D'];
const SEL_NAME: Record<Selector, string> = { P: '주차', R: '후진', N: '중립', D: '주행' };

export class AutoSelector {
  readonly el: HTMLElement;
  private buttons = new Map<Selector, HTMLButtonElement>();

  constructor(onPick: (s: Selector) => void) {
    this.el = document.createElement('div');
    this.el.className = 'car-prnd';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', '자동 변속 셀렉터');
    for (const s of SEL) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'car-prnd-btn';
      const k = document.createElement('b');
      k.textContent = s;
      const t = document.createElement('span');
      t.textContent = SEL_NAME[s];
      b.append(k, t);
      b.setAttribute('aria-label', `${s} ${SEL_NAME[s]}`);
      b.addEventListener('click', () => onPick(s));
      this.el.appendChild(b);
      this.buttons.set(s, b);
    }
  }

  set(s: Selector): void {
    for (const [k, b] of this.buttons) {
      b.classList.toggle('is-active', k === s);
      b.setAttribute('aria-pressed', String(k === s));
    }
  }

  shake(): void {
    this.el.classList.remove('is-shake');
    void this.el.offsetWidth;
    this.el.classList.add('is-shake');
  }
}

export interface PedalHandlers {
  down(): void;
  up(tap: boolean): void;
  /** 세로로 끌 때 깊이 0~1 (클러치 전용) */
  drag?(depth: number | null): void;
}

/** 페달: 누르는 동안 작동. 깊이 막대는 update에서 실제 페달 위치로 채운다 */
export class Pedal {
  readonly el: HTMLButtonElement;
  private fill: HTMLElement;
  private startY = 0;
  private startDepth = 0;
  private t0 = 0;
  private dragging = false;
  private active = false;

  constructor(cls: string, name: string, key: string, private h: PedalHandlers, private depthNow: () => number) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = `car-pedal ${cls}`;
    this.el.setAttribute('aria-label', `${name} 페달 (${key})`);
    const plate = document.createElement('span');
    plate.className = 'car-pedal-plate';
    this.fill = document.createElement('span');
    this.fill.className = 'car-pedal-fill';
    plate.appendChild(this.fill);
    const label = document.createElement('span');
    label.className = 'car-pedal-name';
    label.textContent = name;
    const k = document.createElement('span');
    k.className = 'car-pedal-key';
    k.textContent = key;
    this.el.append(plate, label, k);
    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onCancel);
    this.el.addEventListener('lostpointercapture', this.onCancel);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    // 키보드 사용자: Enter/Space 는 '한 번 누르기'(탭)로 취급
    this.el.addEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (e.repeat) return;
    this.h.down();
    this.h.up(true);
  };

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.active = true;
    this.dragging = false;
    this.startY = e.clientY;
    this.startDepth = this.depthNow();
    this.t0 = performance.now();
    this.el.setPointerCapture(e.pointerId);
    this.el.classList.add('is-down');
    this.h.down();
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active || !this.h.drag) return;
    const dy = e.clientY - this.startY;
    if (!this.dragging && Math.abs(dy) > 8) this.dragging = true;
    if (this.dragging) {
      const range = this.el.clientHeight * 0.8;
      this.h.drag(Math.min(1, Math.max(0, this.startDepth + dy / range)));
    }
  };

  private finish(tap: boolean): void {
    if (!this.active) return;
    this.active = false;
    this.el.classList.remove('is-down');
    if (this.dragging) this.h.drag?.(null);
    this.h.up(tap && !this.dragging);
    this.dragging = false;
  }

  private onUp = (): void => {
    this.finish(performance.now() - this.t0 < 280);
  };

  private onCancel = (): void => {
    this.finish(false);
  };

  setDepth(d: number): void {
    this.fill.style.transform = `scaleY(${d.toFixed(3)})`;
    this.el.classList.toggle('is-pressed', d > 0.5);
  }
}
