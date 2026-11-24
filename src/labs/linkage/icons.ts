// 링크 장치 실험 — 목록용 작은 그림. MechanismDef와 solve(q0) 자세에서 자동으로 그린다(막대=선, 핀=원, 받침=삼각형).
// 입력 시작값·도형 둘레 계산 도우미도 여기에 둔다(화면 코드와 그림 코드가 함께 쓴다).

import type { InputValue, MechanismDef, Pose, Vec2 } from './types';
import { solve, pathPoint } from './solver';

const NS = 'http://www.w3.org/2000/svg';
const W = 56;
const H = 40;
const PAD = 5;

/** 기구가 처음 놓이는 입력값(q0). 팬터그래프는 첫 도형의 출발점 */
export function startInput(def: MechanismDef): InputValue {
  const inp = def.input;
  if (inp.kind === 'point') return pathPoint(inp.paths[0]?.pts ?? [], 0);
  return inp.q0;
}

function sv<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function mechanismIcon(def: MechanismDef, pose?: Pose): SVGSVGElement {
  const p = pose ?? solve(def, startInput(def), null);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
  svg.setAttribute('class', 'lk-icon');
  if (!p.ok) return svg;

  const pts = p.pts;
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (v: Vec2): void => {
    xs.push(v[0]);
    ys.push(v[1]);
  };
  for (const k of Object.keys(pts)) add(pts[k]!);
  const rails = def.rails ?? [];
  const railEnds = rails.map((r) => [[r.p[0] + r.dir[0] * r.min, r.p[1] + r.dir[1] * r.min], [r.p[0] + r.dir[0] * r.max, r.p[1] + r.dir[1] * r.max]] as [Vec2, Vec2]);
  for (const [a, b] of railEnds) {
    add(a);
    add(b);
  }
  if (xs.length === 0) return svg;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sc = Math.min((W - 2 * PAD) / Math.max(1e-6, maxX - minX), (H - 2 * PAD) / Math.max(1e-6, maxY - minY));
  const ox = W / 2 - ((minX + maxX) / 2) * sc;
  const oy = H / 2 + ((minY + maxY) / 2) * sc;
  const X = (v: Vec2): number => +(ox + v[0] * sc).toFixed(2);
  const Y = (v: Vec2): number => +(oy - v[1] * sc).toFixed(2);

  const g = sv('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  svg.append(g);

  for (const [a, b] of railEnds) g.append(sv('line', { x1: X(a), y1: Y(a), x2: X(b), y2: Y(b), class: 'lk-i-rail' }));
  for (const pl of def.plates ?? []) {
    const a = pts[pl.pts[0]];
    const b = pts[pl.pts[1]];
    const c = pts[pl.pts[2]];
    if (!a || !b || !c) continue;
    g.append(sv('polygon', { points: `${X(a)},${Y(a)} ${X(b)},${Y(b)} ${X(c)},${Y(c)}`, class: `lk-i-plate is-${pl.role}` }));
  }
  for (const bar of def.bars) {
    const a = pts[bar.a];
    const b = pts[bar.b];
    if (!a || !b) continue;
    g.append(sv('line', { x1: X(a), y1: Y(a), x2: X(b), y2: Y(b), class: `lk-i-bar is-${bar.role}` }));
  }
  // 받침(삼각형)
  for (const st of def.steps) {
    if (st.k !== 'fix') continue;
    const v = pts[st.id];
    if (!v) continue;
    const x = X(v);
    const y = Y(v);
    g.append(sv('polygon', { points: `${x},${y} ${x - 3.2},${y + 5} ${x + 3.2},${y + 5}`, class: 'lk-i-base' }));
  }
  // 핀(원)
  for (const st of def.steps) {
    const v = pts[st.id];
    if (!v) continue;
    g.append(sv('circle', { cx: X(v), cy: Y(v), r: st.k === 'fix' ? 1.7 : 1.5, class: 'lk-i-pin' }));
  }
  return svg;
}
