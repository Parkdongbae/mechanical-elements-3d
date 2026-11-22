// 13-A 실린더 압력의 "모양"만 보여 주는 맛보기 그래프(SVG, 눈금 없음)
// 부피는 크랭크-슬라이더 식으로 구하고, 압축·팽창은 단순한 폴리트로프(p·V^1.3 = 일정)로 그린다.
// 연소는 상사점 직후 압력이 몇 배로 뛰는 것으로만 흉내 낸다 — 실제 수치가 아니라 모양 비교용.

import { pinY } from './parts';
import { STROKES, type EngineKind } from './data';

const NS = 'http://www.w3.org/2000/svg';
const W = 300;
const H = 120;
const PAD_T = 18;
const PAD_B = 8;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function p4(th: number): number {
  const V = (t: number): number => 0.12 + (2.94 - (pinY(t) + 0.26));
  const vb = V(180);
  if (th < 180) return 0.92;
  const ad = 0.95 * Math.pow(vb / V(th), 1.3);
  if (th < 360) return ad;
  if (th < 500) return ad * (1 + 3 * smooth((th - 360) / 14));
  const at500 = 0.95 * Math.pow(vb / V(500), 1.3) * 4;
  if (th < 545) return at500 + (1.12 - at500) * smooth((th - 500) / 45);
  return 1.12 - 0.12 * ((th - 545) / 175);
}

function p2(th: number): number {
  const V = (t: number): number => 0.1 + (2.9 - (pinY(t) + 0.24));
  const v0 = V(270);
  const ad = (t: number): number => 1.05 * Math.pow(v0 / V(t), 1.3);
  if (th >= 270) return ad(th);
  if (th < 90) return ad(th) * (1 + 3 * smooth(th / 14));
  const at90 = ad(90) * 4;
  if (th < 118) return at90 + (1.05 - at90) * smooth((th - 90) / 28);
  return 1.05;
}

export interface Graph {
  el: SVGSVGElement;
  set(phi: number): void;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, cls?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute('class', cls);
  return e;
}

export function buildGraph(kind: EngineKind): Graph {
  const cycle = kind === 'four' ? 720 : 360;
  const pres = (phi: number): number => (kind === 'four' ? p4(phi) : p2((phi + 180) % 360));
  const vals: number[] = [];
  for (let i = 0; i <= 360; i++) vals.push(Math.pow(pres((i / 360) * cycle), 0.6));
  const mx = Math.max(...vals);
  const mn = Math.min(...vals);
  const x = (phi: number): number => (phi / cycle) * W;
  const y = (v: number): number => H - PAD_B - ((v - mn) / (mx - mn)) * (H - PAD_T - PAD_B);

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '실린더 압력 그래프(모양만)' }, 'cyc-graph');
  const strokes = STROKES[kind];
  strokes.forEach((s, i) => {
    const x0 = x(i * 180);
    const x1 = x((i + 1) * 180);
    root.append(svg('rect', { x: x0, y: 0, width: x1 - x0, height: H }, `cyc-g-band${i % 2 ? ' is-alt' : ''}`));
    const t = svg('text', { x: (x0 + x1) / 2, y: 12, 'text-anchor': 'middle' }, 'cyc-g-lab');
    t.textContent = s.short;
    root.append(t);
  });
  root.append(svg('line', { x1: 0, y1: H - PAD_B, x2: W, y2: H - PAD_B }, 'cyc-g-axis'));
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${((i / 360) * W).toFixed(1)},${y(v).toFixed(1)}`).join('');
  root.append(svg('path', { d: `${d}L${W},${H - PAD_B}L0,${H - PAD_B}Z` }, 'cyc-g-fill'));
  root.append(svg('path', { d }, 'cyc-g-line'));
  const hi = svg('text', { x: 4, y: PAD_T + 10 }, 'cyc-g-ax');
  hi.textContent = '높음';
  const lo = svg('text', { x: 4, y: H - PAD_B - 4 }, 'cyc-g-ax');
  lo.textContent = '낮음';
  root.append(hi, lo);
  const cur = svg('line', { x1: 0, y1: PAD_T - 4, x2: 0, y2: H - PAD_B }, 'cyc-g-cur');
  const dot = svg('circle', { cx: 0, cy: 0, r: 4.5 }, 'cyc-g-dot');
  root.append(cur, dot);
  return {
    el: root,
    set(phi: number): void {
      const p = ((phi % cycle) + cycle) % cycle;
      const xx = x(p);
      cur.setAttribute('x1', xx.toFixed(1));
      cur.setAttribute('x2', xx.toFixed(1));
      dot.setAttribute('cx', xx.toFixed(1));
      dot.setAttribute('cy', y(Math.pow(pres(p), 0.6)).toFixed(1));
    }
  };
}
