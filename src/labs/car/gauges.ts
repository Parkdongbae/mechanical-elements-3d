// 아날로그 계기(SVG): 회전계·속도계. 색은 CSS(lab-car.css)의 토큰 변수로 칠한다.

const NS = 'http://www.w3.org/2000/svg';
const START = -225; // 0 눈금 각도(도, 12시 = -90)
const SWEEP = 270;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
}

function arcPath(r: number, d0: number, d1: number): string {
  const [x0, y0] = polar(r, d0);
  const [x1, y1] = polar(r, d1);
  const large = d1 - d0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export interface GaugeOpts {
  max: number;
  major: number; // 큰 눈금 간격
  minor: number;
  labelEvery: number;
  labelScale?: number; // 눈금 숫자 = 값 / labelScale
  unit: string;
  caption: string;
  zones?: { from: number; to: number; cls: string }[];
}

export class Gauge {
  readonly el: HTMLElement;
  private needle: SVGGElement;
  private readout: HTMLElement;
  private shown = 0;

  constructor(private o: GaugeOpts, cls: string) {
    this.el = document.createElement('div');
    this.el.className = `car-gauge ${cls}`;
    const s = svg('svg', { viewBox: '0 0 200 200', class: 'car-gauge-svg', 'aria-hidden': 'true' });
    this.el.appendChild(s);
    svg('circle', { cx: 100, cy: 100, r: 96, class: 'car-g-face' }, s);
    svg('path', { d: arcPath(84, START, START + SWEEP), class: 'car-g-track' }, s);
    for (const z of o.zones ?? []) {
      svg('path', { d: arcPath(84, this.deg(z.from), this.deg(z.to)), class: `car-g-zone ${z.cls}` }, s);
    }
    for (let v = 0; v <= o.max + 1e-6; v += o.minor) {
      const isMajor = Math.abs(v / o.major - Math.round(v / o.major)) < 1e-6;
      const d = this.deg(v);
      const [x0, y0] = polar(isMajor ? 70 : 75, d);
      const [x1, y1] = polar(80, d);
      svg('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: isMajor ? 'car-g-tick is-major' : 'car-g-tick' }, s);
      if (Math.abs(v / o.labelEvery - Math.round(v / o.labelEvery)) < 1e-6) {
        const [tx, ty] = polar(56, d);
        const t = svg('text', { x: tx, y: ty + 5, class: 'car-g-num', 'text-anchor': 'middle' }, s);
        t.textContent = String(Math.round(v / (o.labelScale ?? 1)));
      }
    }
    const cap = svg('text', { x: 100, y: 178, class: 'car-g-cap', 'text-anchor': 'middle' }, s);
    cap.textContent = o.unit;
    this.needle = svg('g', { class: 'car-g-needle' }, s);
    svg('path', { d: 'M 96 100 L 100 24 L 104 100 Z', class: 'car-g-needle-shape' }, this.needle);
    svg('circle', { cx: 100, cy: 100, r: 8, class: 'car-g-hub' }, s);
    this.readout = document.createElement('div');
    this.readout.className = 'car-g-readout';
    const label = document.createElement('div');
    label.className = 'car-g-caption';
    label.textContent = o.caption;
    this.el.append(this.readout, label);
    this.set(0, true);
  }

  private deg(v: number): number {
    return START + (Math.min(this.o.max, Math.max(0, v)) / this.o.max) * SWEEP;
  }

  /** 바늘은 살짝 부드럽게, 숫자는 실제 값 그대로 */
  set(v: number, immediate = false, text?: string): void {
    this.shown = immediate ? v : this.shown + (v - this.shown) * 0.35;
    const d = this.deg(this.shown) + 90; // 바늘 모양이 12시 방향이므로
    this.needle.setAttribute('transform', `rotate(${d.toFixed(2)} 100 100)`);
    this.readout.textContent = text ?? String(Math.round(v));
  }
}
