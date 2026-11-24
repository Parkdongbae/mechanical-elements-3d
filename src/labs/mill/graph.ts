// 물레방아 — 최근 4초의 방아공이 높이 그래프(SVG 꺾은선 2줄). 순수 DOM(three 없음).
// 공이 1: 실선(파랑 계열), 공이 2: 점선(빨강 계열) — 색만으로 구분하지 않는다.

const NS = 'http://www.w3.org/2000/svg';
const W = 288;
const H = 112;
const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 18;
const SPAN = 4; // 초
const Y_MAX = 0.6; // m

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]!);
  return e;
}

export class LiftGraph {
  readonly root: HTMLElement;
  private readonly lines: [SVGPolylineElement, SVGPolylineElement];
  private readonly svg: SVGSVGElement;
  private ts: number[] = [];
  private h1: number[] = [];
  private h2: number[] = [];
  private lastRender = -1;

  constructor() {
    this.root = document.createElement('figure');
    this.root.className = 'wm-graph';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wm-graph-svg', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
    svg.setAttribute('aria-label', '최근 4초 동안 방아공이 높이 변화. 공이 1은 실선, 공이 2는 점선');
    this.svg = svg;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    for (const v of [0, 0.3, 0.6]) {
      const y = PAD_T + plotH * (1 - v / Y_MAX);
      svg.append(svgEl('line', { x1: String(PAD_L), x2: String(W - PAD_R), y1: y.toFixed(1), y2: y.toFixed(1), class: 'wm-graph-grid' }));
      const t = svgEl('text', { x: String(PAD_L - 5), y: (y + 3.5).toFixed(1), class: 'wm-graph-tick', 'text-anchor': 'end' });
      t.textContent = v.toFixed(1);
      svg.append(t);
    }
    for (let s = 0; s <= SPAN; s++) {
      const x = PAD_L + (plotW * s) / SPAN;
      svg.append(svgEl('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: String(PAD_T + plotH), y2: String(PAD_T + plotH + 3), class: 'wm-graph-grid' }));
      const t = svgEl('text', { x: x.toFixed(1), y: String(H - 4), class: 'wm-graph-tick', 'text-anchor': 'middle' });
      t.textContent = s === SPAN ? '지금' : `-${SPAN - s}초`;
      svg.append(t);
    }
    const l1 = svgEl('polyline', { class: 'wm-graph-line is-1', fill: 'none' });
    const l2 = svgEl('polyline', { class: 'wm-graph-line is-2', fill: 'none' });
    svg.append(l1, l2);
    this.lines = [l1, l2];

    const legend = document.createElement('figcaption');
    legend.className = 'wm-graph-legend';
    for (const [cls, text] of [['is-1', '공이 1(실선)'], ['is-2', '공이 2(점선)']] as const) {
      const item = document.createElement('span');
      item.className = 'wm-graph-key';
      const sw = svgEl('svg', { viewBox: '0 0 22 8', width: '22', height: '8', 'aria-hidden': 'true' });
      sw.append(svgEl('line', { x1: '1', x2: '21', y1: '4', y2: '4', class: `wm-graph-line ${cls}` }));
      item.append(sw, document.createTextNode(text));
      legend.append(item);
    }
    const unit = document.createElement('span');
    unit.className = 'wm-graph-unit';
    unit.textContent = '세로: 높이(m)';
    legend.append(unit);
    this.root.append(svg, legend);
  }

  clear(): void {
    this.ts = [];
    this.h1 = [];
    this.h2 = [];
    this.lastRender = -1;
    this.draw(0);
  }

  /** 시뮬레이션 시간 t(초)와 두 공이 높이(m)를 쌓는다. 시간이 거꾸로 가면(처음으로) 비운다. */
  push(t: number, a: number, b: number): void {
    const n = this.ts.length;
    if (n > 0 && t < this.ts[n - 1]! - 1e-9) this.clear();
    this.ts.push(t);
    this.h1.push(a);
    this.h2.push(b);
    const cut = t - SPAN - 0.2;
    let k = 0;
    while (k < this.ts.length - 2 && this.ts[k + 1]! < cut) k++;
    if (k > 0) {
      this.ts.splice(0, k);
      this.h1.splice(0, k);
      this.h2.splice(0, k);
    }
  }

  /** 화면 갱신(0.1초마다 부른다). */
  render(now: number): void {
    if (now - this.lastRender < 0.05 && this.lastRender >= 0) return;
    this.lastRender = now;
    this.draw(now);
  }

  private draw(now: number): void {
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const x0 = now - SPAN;
    const pts = (hs: number[]): string => {
      const out: string[] = [];
      for (let i = 0; i < this.ts.length; i++) {
        const x = PAD_L + ((this.ts[i]! - x0) / SPAN) * plotW;
        if (x < PAD_L - 1) continue;
        const h = Math.max(0, Math.min(Y_MAX, hs[i]!));
        const y = PAD_T + plotH * (1 - h / Y_MAX);
        out.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return out.join(' ');
    };
    this.lines[0].setAttribute('points', pts(this.h1));
    this.lines[1].setAttribute('points', pts(this.h2));
  }

  dispose(): void {
    this.root.remove();
    this.ts = [];
    this.h1 = [];
    this.h2 = [];
    void this.svg;
  }
}
