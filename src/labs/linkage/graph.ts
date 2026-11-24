// 링크 장치 실험 — 입력값에 대한 출력값 그래프(SVG 꺾은선). 한 번 그려 두고 현재 점만 움직인다.

const NS = 'http://www.w3.org/2000/svg';
const VW = 280;
const VH = 124;
const ML = 38;
const MR = 10;
const MT = 14;
const MB = 30;

export interface GraphBand {
  from: number;
  to: number;
  kind: 'slow' | 'fast';
  text: string;
}

export interface GraphData {
  xs: number[];
  ys: number[];
  xLabel: string;
  yLabel: string;
  /** 기울기 1인 기준선(조향: 두 바퀴 꺾임각이 같을 때) */
  refLine?: boolean;
  bands?: GraphBand[];
  /** 한 바퀴 그래프면 커서를 한 바퀴 안으로 감싼다 */
  wrap?: number;
}

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute('class', cls);
  return e;
}

/** 눈금 3~4개를 보기 좋은 값으로 */
function niceTicks(lo: number, hi: number, want = 4): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / want;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function fmt(v: number): string {
  const a = Math.abs(v);
  const t = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(0) : a >= 1 ? v.toFixed(1) : v.toFixed(2);
  return String(Number(t));
}

/** 출력이 늘어나는 구간(빨리)과 줄어드는 구간(천천히)으로 나눈 색 띠 — 빠른 귀환 장치용 */
export function slowFastBands(xs: number[], ys: number[], unit = '°', period = 0): GraphBand[] {
  const out: GraphBand[] = [];
  if (xs.length < 3) return out;
  let start = 0;
  let dir = 0;
  const flush = (end: number): void => {
    if (dir === 0 || end <= start) return;
    const x0 = xs[start]!;
    const x1 = xs[end]!;
    out.push({ from: x0, to: x1, kind: dir > 0 ? 'fast' : 'slow', text: '' });
  };
  for (let i = 1; i < xs.length; i++) {
    const d = Math.sign(ys[i]! - ys[i - 1]!);
    if (d === 0) continue;
    if (dir === 0) {
      dir = d;
      start = i - 1;
    } else if (d !== dir) {
      flush(i - 1);
      dir = d;
      start = i - 1;
    }
  }
  flush(xs.length - 1);
  // 한 바퀴 그래프는 마지막 표본과 처음 사이 틈도 마지막 띠에 넣는다
  const last = out[out.length - 1];
  if (period > 0 && last && last.to >= xs[xs.length - 1]! - 1e-9) last.to = xs[0]! + period;
  // 처음과 끝이 같은 종류면 한 바퀴 이음으로 합친 길이를 글자에 쓴다
  const sum = (k: 'slow' | 'fast'): number => out.filter((b) => b.kind === k).reduce((a, b) => a + (b.to - b.from), 0);
  const slow = sum('slow');
  const fast = sum('fast');
  for (const b of out) b.text = b.kind === 'slow' ? `천천히 ${Math.round(slow)}${unit}` : `빨리 ${Math.round(fast)}${unit}`;
  return out;
}

export class Graph {
  readonly el: SVGSVGElement;
  private plot: SVGGElement;
  private dot: SVGCircleElement;
  private vline: SVGLineElement;
  private data: GraphData | null = null;
  private x0 = 0;
  private x1 = 1;
  private y0 = 0;
  private y1 = 1;

  constructor() {
    this.el = s('svg', { viewBox: `0 0 ${VW} ${VH}`, role: 'img', preserveAspectRatio: 'xMidYMid meet' }, 'lk-graph');
    this.plot = s('g');
    this.vline = s('line', { y1: MT, y2: VH - MB }, 'lk-g-vline');
    this.dot = s('circle', { r: 4.5 }, 'lk-g-dot');
    this.el.append(this.plot, this.vline, this.dot);
    this.vline.style.display = 'none';
    this.dot.style.display = 'none';
  }

  private px(x: number): number {
    return ML + ((x - this.x0) / (this.x1 - this.x0 || 1)) * (VW - ML - MR);
  }

  private py(y: number): number {
    return VH - MB - ((y - this.y0) / (this.y1 - this.y0 || 1)) * (VH - MB - MT);
  }

  set(d: GraphData | null): void {
    this.plot.replaceChildren();
    this.data = d;
    this.vline.style.display = 'none';
    this.dot.style.display = 'none';
    if (!d || d.xs.length < 2) {
      this.el.removeAttribute('aria-label');
      return;
    }
    this.x0 = d.xs[0]!;
    this.x1 = d.xs[d.xs.length - 1]!;
    let lo = Math.min(...d.ys);
    let hi = Math.max(...d.ys);
    if (d.refLine) {
      lo = Math.min(lo, this.x0, ...d.xs);
      hi = Math.max(hi, ...d.xs);
    }
    if (!(hi - lo > 1e-9)) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.06;
    this.y0 = lo - pad;
    this.y1 = hi + pad;
    this.el.setAttribute('aria-label', `${d.yLabel}을(를) ${d.xLabel}에 따라 그린 그래프`);

    const g = this.plot;
    // 색 띠
    for (const b of d.bands ?? []) {
      const xa = this.px(b.from);
      const xb = this.px(b.to);
      g.append(s('rect', { x: xa, y: MT, width: Math.max(0, xb - xa), height: VH - MB - MT }, `lk-g-band is-${b.kind}`));
    }
    // 눈금과 격자
    for (const t of niceTicks(this.x0, this.x1, 4)) {
      const x = this.px(t);
      g.append(s('line', { x1: x, x2: x, y1: MT, y2: VH - MB }, 'lk-g-grid'));
      const tx = s('text', { x, y: VH - MB + 12, 'text-anchor': 'middle' }, 'lk-g-tick');
      tx.textContent = fmt(t);
      g.append(tx);
    }
    for (const t of niceTicks(this.y0, this.y1, 3)) {
      const y = this.py(t);
      g.append(s('line', { x1: ML, x2: VW - MR, y1: y, y2: y }, 'lk-g-grid'));
      const tx = s('text', { x: ML - 4, y: y + 3, 'text-anchor': 'end' }, 'lk-g-tick');
      tx.textContent = fmt(t);
      g.append(tx);
    }
    g.append(s('line', { x1: ML, x2: VW - MR, y1: VH - MB, y2: VH - MB }, 'lk-g-axis'), s('line', { x1: ML, x2: ML, y1: MT, y2: VH - MB }, 'lk-g-axis'));
    // 기준선(기울기 1)
    if (d.refLine) {
      const a = Math.max(this.x0, this.y0);
      const b = Math.min(this.x1, this.y1);
      if (b > a) g.append(s('line', { x1: this.px(a), y1: this.py(a), x2: this.px(b), y2: this.py(b) }, 'lk-g-ref'));
    }
    // 곡선
    let path = '';
    for (let i = 0; i < d.xs.length; i++) path += `${i === 0 ? 'M' : 'L'}${this.px(d.xs[i]!).toFixed(1)} ${this.py(d.ys[i]!).toFixed(1)}`;
    g.append(s('path', { d: path }, 'lk-g-line'));
    // 띠 글자
    const placed = new Set<string>();
    for (const b of [...(d.bands ?? [])].sort((p, q) => q.to - q.from - (p.to - p.from))) {
      if (placed.has(b.kind)) continue;
      placed.add(b.kind);
      const tx = s('text', { x: (this.px(b.from) + this.px(b.to)) / 2, y: MT + 11, 'text-anchor': 'middle' }, 'lk-g-bandtext');
      tx.textContent = b.text;
      g.append(tx);
    }
    // 축 이름
    const xt = s('text', { x: (ML + VW - MR) / 2, y: VH - 3, 'text-anchor': 'middle' }, 'lk-g-title');
    xt.textContent = d.xLabel;
    const yt = s('text', { x: 2, y: 9, 'text-anchor': 'start' }, 'lk-g-title');
    yt.textContent = d.yLabel;
    g.append(xt, yt);
  }

  /** 현재 입력값(표시 단위) 위치에 점을 놓는다 */
  setCursor(x: number): void {
    const d = this.data;
    if (!d || d.xs.length < 2 || !Number.isFinite(x)) return;
    let xx = x;
    if (d.wrap) xx = this.x0 + ((((x - this.x0) % d.wrap) + d.wrap) % d.wrap);
    xx = Math.max(this.x0, Math.min(this.x1, xx));
    // 가장 가까운 표본 사이를 선형으로 읽는다
    let lo = 0;
    let hi = d.xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (d.xs[mid]! <= xx) lo = mid;
      else hi = mid;
    }
    const xa = d.xs[lo]!;
    const xb = d.xs[hi]!;
    const t = xb > xa ? (xx - xa) / (xb - xa) : 0;
    const y = d.ys[lo]! + (d.ys[hi]! - d.ys[lo]!) * t;
    const cx = this.px(xx);
    const cy = this.py(y);
    this.dot.setAttribute('cx', cx.toFixed(1));
    this.dot.setAttribute('cy', cy.toFixed(1));
    this.vline.setAttribute('x1', cx.toFixed(1));
    this.vline.setAttribute('x2', cx.toFixed(1));
    this.dot.style.display = '';
    this.vline.style.display = '';
  }

  dispose(): void {
    this.plot.replaceChildren();
    this.el.remove();
    this.data = null;
  }
}
