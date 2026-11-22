// 결과 패널의 작은 그래프들 — SVG(속도–항력 곡선)와 캔버스(주파수 스펙트럼)

import { dragN } from './aero';

const NS = 'http://www.w3.org/2000/svg';
export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** 속도–항력 곡선: 현재 설정(실선), 저장한 A(점선), 현재 속도 점 */
export class DragChart {
  readonly el: SVGSVGElement;
  private cur: SVGPathElement;
  private a: SVGPathElement;
  private dot: SVGCircleElement;
  private guide: SVGPathElement;
  private label: SVGTextElement;
  private W = 300;
  private H = 150;
  private pad = { l: 40, r: 10, t: 10, b: 26 };
  private maxV = 200;
  private maxF = 1800;

  constructor() {
    const { W, H, pad } = this;
    this.el = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wind-chart', role: 'img', 'aria-label': '속도에 따른 항력 그래프' });
    const g = svgEl('g');
    this.el.appendChild(g);
    // 격자·눈금
    for (let f = 0; f <= this.maxF; f += 600) {
      const y = this.y(f);
      g.appendChild(svgEl('path', { d: `M${pad.l} ${y}H${W - pad.r}`, class: 'wind-chart-grid' }));
      const t = svgEl('text', { x: pad.l - 5, y: y + 4, class: 'wind-chart-tick', 'text-anchor': 'end' });
      t.textContent = String(f);
      g.appendChild(t);
    }
    for (let v = 0; v <= this.maxV; v += 50) {
      const x = this.x(v);
      g.appendChild(svgEl('path', { d: `M${x} ${pad.t}V${H - pad.b}`, class: 'wind-chart-grid' }));
      const t = svgEl('text', { x, y: H - pad.b + 14, class: 'wind-chart-tick', 'text-anchor': 'middle' });
      t.textContent = String(v);
      g.appendChild(t);
    }
    const ax = svgEl('text', { x: W - pad.r, y: H - 2, class: 'wind-chart-axis', 'text-anchor': 'end' });
    ax.textContent = '속도 km/h';
    const ay = svgEl('text', { x: 4, y: pad.t + 2, class: 'wind-chart-axis' });
    ay.textContent = 'N';
    g.append(ax, ay);
    this.a = svgEl('path', { class: 'wind-chart-a' });
    this.cur = svgEl('path', { class: 'wind-chart-cur' });
    this.guide = svgEl('path', { class: 'wind-chart-guide' });
    this.dot = svgEl('circle', { r: 5, class: 'wind-chart-dot' });
    this.label = svgEl('text', { class: 'wind-chart-label' });
    g.append(this.a, this.cur, this.guide, this.dot, this.label);
  }

  private x(v: number): number {
    return this.pad.l + (v / this.maxV) * (this.W - this.pad.l - this.pad.r);
  }
  private y(f: number): number {
    return this.H - this.pad.b - (Math.min(f, this.maxF) / this.maxF) * (this.H - this.pad.t - this.pad.b);
  }

  private path(cd: number): string {
    let d = '';
    for (let v = 0; v <= this.maxV; v += 5) d += `${v === 0 ? 'M' : 'L'}${this.x(v).toFixed(1)} ${this.y(dragN(cd, v)).toFixed(1)}`;
    return d;
  }

  set(cd: number, kmh: number, cdA: number | null): void {
    this.cur.setAttribute('d', this.path(cd));
    this.a.setAttribute('d', cdA === null ? '' : this.path(cdA));
    const v = Math.min(kmh, this.maxV);
    const f = dragN(cd, v);
    const x = this.x(v);
    const y = this.y(f);
    this.dot.setAttribute('cx', x.toFixed(1));
    this.dot.setAttribute('cy', y.toFixed(1));
    this.guide.setAttribute('d', `M${x} ${this.H - this.pad.b}V${y}H${this.pad.l}`);
    this.label.textContent = `${Math.round(f)} N`;
    const right = x > this.W - 90;
    this.label.setAttribute('x', String(right ? x - 8 : x + 8));
    this.label.setAttribute('y', String(Math.max(this.pad.t + 10, y - 6)));
    this.label.setAttribute('text-anchor', right ? 'end' : 'start');
  }
}

/** 로그 주파수 막대 스펙트럼. 실시간(AnalyserNode) 또는 예상치(소리 꺼짐) */
export class Spectrum {
  readonly el: HTMLCanvasElement;
  private g: CanvasRenderingContext2D | null;
  static BANDS = 36;
  static F0 = 50;
  static F1 = 12000;
  private buf: Float32Array<ArrayBuffer> | null = null;

  constructor() {
    this.el = document.createElement('canvas');
    this.el.className = 'wind-spec';
    this.el.width = 600;
    this.el.height = 220;
    this.g = this.el.getContext('2d');
  }

  static bandHz(i: number): number {
    return Spectrum.F0 * (Spectrum.F1 / Spectrum.F0) ** ((i + 0.5) / Spectrum.BANDS);
  }

  /** 밴드별 0~1 값 그리기 */
  draw(vals: number[], colors: { bar: string; grid: string; text: string; hot: string }, hotBand: number): void {
    const g = this.g;
    if (!g) return;
    const W = this.el.width;
    const H = this.el.height;
    g.clearRect(0, 0, W, H);
    const pb = 30;
    g.strokeStyle = colors.grid;
    g.lineWidth = 1;
    g.fillStyle = colors.text;
    g.font = '20px sans-serif';
    g.textAlign = 'center';
    for (const f of [100, 1000, 10000]) {
      const x = (Math.log(f / Spectrum.F0) / Math.log(Spectrum.F1 / Spectrum.F0)) * W;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H - pb);
      g.stroke();
      g.fillText(f >= 1000 ? `${f / 1000}k Hz` : `${f} Hz`, Math.min(W - 40, Math.max(36, x)), H - 6);
    }
    const bw = W / Spectrum.BANDS;
    vals.forEach((v, i) => {
      const h = Math.max(2, v * (H - pb - 6));
      g.fillStyle = i === hotBand ? colors.hot : colors.bar;
      g.fillRect(i * bw + 2, H - pb - h, bw - 4, h);
    });
  }

  fromAnalyser(an: AnalyserNode): number[] {
    if (!this.buf || this.buf.length !== an.frequencyBinCount) this.buf = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(this.buf);
    const sr = an.context.sampleRate;
    const out: number[] = [];
    for (let i = 0; i < Spectrum.BANDS; i++) {
      const fa = Spectrum.F0 * (Spectrum.F1 / Spectrum.F0) ** (i / Spectrum.BANDS);
      const fb = Spectrum.F0 * (Spectrum.F1 / Spectrum.F0) ** ((i + 1) / Spectrum.BANDS);
      const a = Math.max(0, Math.floor((fa / sr) * an.fftSize));
      const b = Math.max(a + 1, Math.ceil((fb / sr) * an.fftSize));
      let p = 0;
      for (let k = a; k < b && k < this.buf.length; k++) p += 10 ** ((this.buf[k] ?? -140) / 10);
      const db = 10 * Math.log10(p + 1e-14);
      out.push(Math.min(1, Math.max(0, (db + 100) / 70)));
    }
    return out;
  }
}
