// 탐구 실험 공용 이름표 — DOM 오버레이(점 + 지시선 + 알약 글자). 지시서 18 3절의 계약을 그대로 구현한다.
// 켜고 끄는 값은 settings.showLabels 하나(미션·507과 공유)이고, 한 번 정하면 저장된다.

import * as THREE from 'three';
import type { ModeContext } from '../../modes/types';
import { saveSettings } from '../../state/settings';
import { ICON } from '../../ui/icons';
import '../../styles/lab-labels.css';

export type LabelSide = 'above' | 'below' | 'left' | 'right';
/** part: 부품 이름 / point: 조인트 글자·번호(작게) / info: 수면·대기압 같은 설명 / hint: '끌어 보세요' 같은 조작 안내 */
export type LabelKind = 'part' | 'point' | 'info' | 'hint';
export type LabelTone = 'accent' | 'ok' | 'warn' | 'shaft' | 'power' | 'control';
export type Anchor = (out: THREE.Vector3) => boolean; // out에 "월드 좌표"를 쓴다. false = 이번 프레임은 숨김

export interface LabelSpec {
  key: string; // 한 실험 안에서 유일. DOM에 data-key로 남는다(검사 스크립트가 읽는다)
  text: string;
  at: Anchor;
  side?: LabelSide; // 먼저 시도할 쪽. 기본 'above'
  kind?: LabelKind; // 기본 'part'
  priority?: 1 | 2 | 3; // 기본 2. 자리가 모자라면 3 → 2 순서로 접는다. 1은 접지 않는다
  tone?: LabelTone; // 기본 'accent'
  always?: boolean; // true = 토글이 꺼져도 보인다. kind 'hint'에만 쓴다
}

export interface LabelBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} // 화면 px

export interface LabLabelsOptions {
  /** 이름표를 놓아도 되는 영역(패널·도크·하단 시트를 뺀 3D가 보이는 곳). 없으면 화면 전체 */
  bounds?: () => LabelBounds;
  onToggle?: (visible: boolean) => void;
}

// ───────── 버튼 ─────────

function makeButton(): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'lab-tag-btn';
  b.dataset.lab = 'labels-toggle';
  b.innerHTML = `${ICON.tag}<span>이름표</span>`;
  return b;
}

function paintButton(b: HTMLButtonElement, on: boolean): void {
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? '부품 이름표 숨기기' : '부품 이름표 보이기';
}

/** 이름표 레이어 없이 버튼만 필요할 때(507 상세 화면) */
export function createLabelsToggle(
  ctx: ModeContext,
  opts?: { syncSceneLayer?: boolean; onToggle?: (visible: boolean) => void }
): { button: HTMLButtonElement; sync(): void; dispose(): void } {
  const button = makeButton();
  const syncLayer = opts?.syncSceneLayer !== false;
  paintButton(button, ctx.settings.showLabels);
  const onClick = (): void => {
    const v = !ctx.settings.showLabels;
    ctx.settings.showLabels = v;
    saveSettings(ctx.settings);
    paintButton(button, v);
    if (syncLayer) ctx.sceneMgr.setLabelsVisible(v);
    opts?.onToggle?.(v);
  };
  button.addEventListener('click', onClick);
  return {
    button,
    sync: () => paintButton(button, ctx.settings.showLabels),
    dispose: () => {
      button.removeEventListener('click', onClick);
      button.remove();
    }
  };
}

// ───────── 기준점 도우미 ─────────

export function worldAnchor(x: number, y: number, z: number): Anchor {
  return (out) => {
    out.set(x, y, z);
    return true;
  };
}

export function localAnchor(obj: THREE.Object3D, x = 0, y = 0, z = 0): Anchor {
  return (out) => {
    obj.updateWorldMatrix(true, false);
    out.set(x, y, z).applyMatrix4(obj.matrixWorld);
    return true;
  };
}

export function midAnchor(a: Anchor, b: Anchor): Anchor {
  const t = new THREE.Vector3();
  return (out) => {
    if (!a(out)) return false;
    if (!b(t)) return false;
    out.add(t).multiplyScalar(0.5);
    return true;
  };
}

// ───────── 이름표 레이어 ─────────

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Item {
  spec: LabelSpec;
  el: HTMLElement;
  lab: HTMLElement;
  kind: LabelKind;
  priority: number;
  w: number;
  h: number;
  side: LabelSide; // 지금 쓰는 쪽(깜빡임 방지로 유지)
  off: string; // 숨긴 사유(data-off) — 보이면 ''
  gap: number; // 점에서 글자까지 거리(px) — 기본 18(point 9), 긴 지시선이면 더 길다
  collapsed: boolean;
  candidate: boolean; // 접힘 후보 판정
  candSince: number;
  inited: boolean;
  shown: boolean;
  tx: number;
  ty: number;
  depth: number;
  px: number;
  py: number;
}

const SIDES: LabelSide[] = ['above', 'below', 'right', 'left'];
const PIN_MS = 4000;
const SWITCH_MS = 250;
const MARGIN = 4;

export class LabLabels {
  readonly layer: HTMLElement;
  readonly button: HTMLButtonElement;

  private readonly ctx: ModeContext;
  private readonly host: HTMLElement;
  private readonly opts: LabLabelsOptions;
  private items: Item[] = [];
  private byKey = new Map<string, Item>();
  private readonly v = new THREE.Vector3();
  private w = 0;
  private h = 0;
  private ro: ResizeObserver | null = null;
  private pinKey: string | null = null;
  private pinUntil = 0;
  private small = false;

  constructor(ctx: ModeContext, host: HTMLElement, opts?: LabLabelsOptions) {
    this.ctx = ctx;
    this.host = host;
    this.opts = opts ?? {};

    this.layer = document.createElement('div');
    this.layer.className = 'lab-tags';
    this.layer.dataset.on = String(ctx.settings.showLabels);
    host.prepend(this.layer);

    this.button = makeButton();
    paintButton(this.button, ctx.settings.showLabels);
    this.button.addEventListener('click', this.onButton);

    this.measureHost();
    if (typeof ResizeObserver === 'function') {
      this.ro = new ResizeObserver(() => this.measureHost());
      this.ro.observe(host);
    } else {
      window.addEventListener('resize', this.onResize);
    }
    document.addEventListener('pointerdown', this.onDocDown, true);
    this.layer.addEventListener('click', this.onLayerClick);
  }

  get visible(): boolean {
    return this.ctx.settings.showLabels;
  }

  setVisible(v: boolean): void {
    this.ctx.settings.showLabels = v;
    saveSettings(this.ctx.settings);
    paintButton(this.button, v);
    this.ctx.sceneMgr.setLabelsVisible(v);
    this.layer.dataset.on = String(v);
    this.opts.onToggle?.(v);
  }

  set(specs: LabelSpec[]): void {
    const old = new Map(this.byKey);
    const next: Item[] = [];
    const nextMap = new Map<string, Item>();
    const frag = document.createDocumentFragment();
    for (const spec of specs) {
      let it = old.get(spec.key);
      if (it && !nextMap.has(spec.key)) {
        old.delete(spec.key);
        it.spec = spec;
        if (it.lab.textContent !== spec.text) {
          it.lab.textContent = spec.text;
          it.w = 0;
        }
        this.applyAttrs(it);
      } else {
        it = this.create(spec);
        frag.appendChild(it.el);
      }
      next.push(it);
      nextMap.set(spec.key, it);
    }
    for (const it of old.values()) it.el.remove();
    this.items = next;
    this.byKey = nextMap;
    this.layer.appendChild(frag);
    if (this.pinKey && !nextMap.has(this.pinKey)) this.pinKey = null;
  }

  setText(key: string, text: string): void {
    const it = this.byKey.get(key);
    if (!it || it.lab.textContent === text) return;
    it.lab.textContent = text;
    it.w = 0;
  }

  setState(key: string, state: string | null): void {
    const it = this.byKey.get(key);
    if (!it) return;
    if (state === null) {
      if (it.el.hasAttribute('data-state')) it.el.removeAttribute('data-state');
    } else if (it.el.dataset.state !== state) {
      it.el.dataset.state = state;
    }
  }

  update(): void {
    const now = performance.now();
    const on = this.visible;
    const cam = this.ctx.sceneMgr.camera;
    const W = this.w;
    const H = this.h;
    if (W <= 0 || H <= 0) return;
    const b: Box = this.opts.bounds ? this.opts.bounds() : { x0: 0, y0: 0, x1: W, y1: H };

    if (this.pinKey && now > this.pinUntil) this.pinKey = null;

    // 1) 투영
    const cands: Item[] = [];
    for (const it of this.items) {
      const needed = on || it.spec.always === true;
      let ok = false;
      // 숨긴 사유(검사 스크립트가 읽는다): off = 꺼짐 / anchor = 부품이 안 보임 / behind = 카메라 뒤 / out = 영역 밖 / home = 홈 버튼 자리
      let off = 'off';
      if (needed) {
        off = 'anchor';
        if (it.spec.at(this.v)) {
          const dist = this.v.distanceTo(cam.position);
          this.v.project(cam);
          off = 'behind';
          if (this.v.z <= 1) {
            const px = (this.v.x * 0.5 + 0.5) * W;
            const py = (-this.v.y * 0.5 + 0.5) * H;
            const inHome = px < 240 && py < 90;
            off = inHome ? 'home' : 'out';
            if (!inHome && px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1) {
              it.px = px;
              it.py = py;
              it.depth = dist;
              ok = true;
            }
          }
        }
      }
      if (it.off !== (ok ? '' : off)) {
        it.off = ok ? '' : off;
        if (it.off) it.el.dataset.off = it.off;
        else it.el.removeAttribute('data-off');
      }
      if (!ok) {
        if (it.shown) {
          it.el.style.display = 'none';
          it.shown = false;
        }
        continue;
      }
      if (!it.shown) {
        it.el.style.display = '';
        it.shown = true;
      }
      if (it.w === 0) {
        it.w = it.lab.offsetWidth;
        it.h = it.lab.offsetHeight;
      }
      cands.push(it);
    }

    // 2) 자리 정하기 — 눌러 펼친 것 → 우선순위 → 가까운 순
    const pin = this.pinKey;
    cands.sort((a, c) => {
      const ap = a.spec.key === pin ? 0 : a.priority;
      const cp = c.spec.key === pin ? 0 : c.priority;
      return ap - cp || a.depth - c.depth;
    });
    const placed: Box[] = [];
    // 놓인 글자 상자 중 우선순위 1의 것(P1이 접히는 사유 판정용)
    const placedP1: Box[] = [];
    for (const it of cands) {
      const base = it.kind === 'point' ? 9 : 18;
      const pref = it.spec.side ?? 'above';
      const order: LabelSide[] = [it.side, pref, ...SIDES];
      const isP1 = it.priority === 1;
      let found: LabelSide | null = null;
      let foundRect: Box | null = null;
      let foundGap = base;
      // 'edge' = 영역 밖이라 못 놓음 / 'p1' = 다른 P1 글자와 겹침 / 'room' = 그 밖의 것과 겹침
      let why: 'edge' | 'p1' | 'room' = 'edge';
      // 시도 순서: 짧은 지시선(4쪽) → 위·아래로 한 칸·두 칸 긴 지시선(P1·P2). 점 가림 검사는 P1이면 P1의 점만 본다
      const tries: Array<[LabelSide, number]> = [];
      const seen = new Set<LabelSide>();
      for (const s of order) {
        if (seen.has(s)) continue;
        seen.add(s);
        tries.push([s, base]);
      }
      if (it.kind !== 'point' && it.priority <= 2) {
        const step = it.h + MARGIN + 4;
        const vert: LabelSide[] = pref === 'below' ? ['below', 'above'] : ['above', 'below'];
        for (let k = 1; k <= (isP1 ? 2 : 1); k++) for (const s of vert) tries.push([s, base + step * k]);
      }
      for (const [s, gap] of tries) {
        const r = this.rect(it, s, gap);
        if (r.x0 < b.x0 || r.x1 > b.x1 || r.y0 < b.y0 || r.y1 > b.y1) continue;
        if (r.x0 < 240 && r.y0 < 90) continue;
        let hit = false;
        let hitP1 = false;
        for (const p of placedP1) {
          if (r.x0 < p.x1 + MARGIN && r.x1 > p.x0 - MARGIN && r.y0 < p.y1 + MARGIN && r.y1 > p.y0 - MARGIN) {
            hit = hitP1 = true;
            break;
          }
        }
        if (!hit) {
          for (const p of placed) {
            if (r.x0 < p.x1 + MARGIN && r.x1 > p.x0 - MARGIN && r.y0 < p.y1 + MARGIN && r.y1 > p.y0 - MARGIN) {
              hit = true;
              break;
            }
          }
        }
        if (!hit) {
          // 다른 이름표의 점도 가리지 않는다(P1은 다른 P1의 점만 피한다 — 낮은 것의 점 때문에 접히지 않게)
          for (const o of cands) {
            if (o === it || (isP1 && o.priority !== 1)) continue;
            if (r.x0 < o.px + 6 && r.x1 > o.px - 6 && r.y0 < o.py + 6 && r.y1 > o.py - 6) {
              hit = true;
              if (o.priority === 1) hitP1 = true;
              break;
            }
          }
        }
        if (!hit) {
          found = s;
          foundRect = r;
          foundGap = gap;
          break;
        }
        if (hitP1) why = 'p1';
        else if (why !== 'p1') why = 'room';
      }
      const wantCollapsed = found === null;
      let showCollapsed = it.collapsed;
      if (!it.inited) {
        showCollapsed = wantCollapsed;
        it.inited = true;
        it.candidate = wantCollapsed;
        it.candSince = now;
      } else {
        if (wantCollapsed !== it.candidate) {
          it.candidate = wantCollapsed;
          it.candSince = now;
        }
        if (wantCollapsed !== it.collapsed && now - it.candSince >= SWITCH_MS) showCollapsed = wantCollapsed;
        // 유예 중이라도 직전 자리가 이미 놓인 글자와 겹치면 바로 접는다(글자끼리 겹쳐 읽을 수 없는 것보다 낫다).
        // 펼치는 쪽만 0.25초 유예를 지킨다 — 깜빡임 방지
        if (wantCollapsed && !showCollapsed) {
          const r = this.rect(it, it.side, it.gap);
          for (const p of placed) {
            if (r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0) {
              showCollapsed = true;
              break;
            }
          }
        }
      }
      if (it.spec.key === pin) showCollapsed = false;
      if (showCollapsed !== it.collapsed) {
        it.collapsed = showCollapsed;
        it.el.dataset.collapsed = String(showCollapsed);
      }
      const whyNow = showCollapsed ? why : '';
      if (it.el.dataset.why !== whyNow) {
        if (whyNow) it.el.dataset.why = whyNow;
        else it.el.removeAttribute('data-why');
      }
      if (!showCollapsed) {
        let side = found ?? it.side;
        let rect = foundRect;
        let gap = foundGap;
        if (!rect) {
          // 접힘 판정이 아직 유예 중 — 직전 자리에 그대로 둔다
          side = it.side;
          gap = it.gap;
          rect = this.rect(it, side, gap);
        }
        if (side !== it.side) {
          it.side = side;
          it.el.dataset.side = side;
        }
        if (gap !== it.gap) {
          it.gap = gap;
          if (gap === base) it.el.style.removeProperty('--lt-gap');
          else it.el.style.setProperty('--lt-gap', `${gap}px`);
        }
        placed.push(rect);
        if (isP1) placedP1.push(rect);
      }
      const tx = Math.round(it.px * 10) / 10;
      const ty = Math.round(it.py * 10) / 10;
      if (tx !== it.tx || ty !== it.ty) {
        it.tx = tx;
        it.ty = ty;
        it.el.style.transform = `translate(${tx}px,${ty}px)`;
      }
    }
  }

  dispose(): void {
    this.ro?.disconnect();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerdown', this.onDocDown, true);
    this.layer.removeEventListener('click', this.onLayerClick);
    this.button.removeEventListener('click', this.onButton);
    this.button.remove();
    this.layer.remove();
    this.items = [];
    this.byKey.clear();
  }

  // ───────── 내부 ─────────

  private readonly onButton = (): void => this.setVisible(!this.visible);
  private readonly onResize = (): void => this.measureHost();

  private measureHost(): void {
    this.w = this.host.clientWidth;
    this.h = this.host.clientHeight;
    const small = this.w < 700;
    if (small !== this.small) {
      this.small = small;
      for (const it of this.items) it.w = 0; // 글자 크기가 달라지므로 폭을 다시 잰다
    }
    this.layer.dataset.small = String(small);
  }

  private readonly onDocDown = (e: Event): void => {
    if (!this.pinKey) return;
    const t = e.target as Element | null;
    if (t && t.closest('.lab-tag-dot')) return;
    this.pinKey = null;
  };

  private readonly onLayerClick = (e: Event): void => {
    const t = e.target as Element | null;
    if (!t || !t.closest('.lab-tag-dot')) return;
    const key = t.closest<HTMLElement>('.lab-tag')?.dataset.key;
    if (!key) return;
    this.pinKey = key;
    this.pinUntil = performance.now() + PIN_MS;
  };

  private rect(it: Item, s: LabelSide, gap: number): Box {
    const w = it.w;
    const h = it.h;
    switch (s) {
      case 'above':
        return { x0: it.px - w / 2, y0: it.py - gap - h, x1: it.px + w / 2, y1: it.py - gap };
      case 'below':
        return { x0: it.px - w / 2, y0: it.py + gap, x1: it.px + w / 2, y1: it.py + gap + h };
      case 'right':
        return { x0: it.px + gap, y0: it.py - h / 2, x1: it.px + gap + w, y1: it.py + h / 2 };
      default:
        return { x0: it.px - gap - w, y0: it.py - h / 2, x1: it.px - gap, y1: it.py + h / 2 };
    }
  }

  private create(spec: LabelSpec): Item {
    const el = document.createElement('div');
    el.className = 'lab-tag';
    const dot = document.createElement('span');
    dot.className = 'lab-tag-dot';
    const line = document.createElement('span');
    line.className = 'lab-tag-line';
    const lab = document.createElement('span');
    lab.className = 'lab-tag-l';
    lab.textContent = spec.text;
    el.append(dot, line, lab);
    const it: Item = {
      spec,
      el,
      lab,
      kind: 'part',
      priority: 2,
      w: 0,
      h: 0,
      side: spec.side ?? 'above',
      gap: spec.kind === 'point' ? 9 : 18,
      off: '',
      collapsed: false,
      candidate: false,
      candSince: 0,
      inited: false,
      shown: false,
      tx: NaN,
      ty: NaN,
      depth: 0,
      px: 0,
      py: 0
    };
    el.style.display = 'none';
    el.dataset.collapsed = 'false';
    el.dataset.side = it.side;
    this.applyAttrs(it);
    return it;
  }

  private applyAttrs(it: Item): void {
    const s = it.spec;
    it.kind = s.kind ?? 'part';
    it.priority = s.priority ?? 2;
    it.el.dataset.key = s.key;
    it.el.dataset.kind = it.kind;
    it.el.dataset.tone = s.tone ?? 'accent';
    if (s.always) it.el.dataset.always = 'true';
    else it.el.removeAttribute('data-always');
    it.el.dataset.priority = String(it.priority);
  }
}
