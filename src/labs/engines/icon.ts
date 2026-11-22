// 앞에서 본 배열 도식(SVG) — 엔진 데이터의 뱅크 각으로 직접 그린다(I / V / 수평대향 / W).
// 색은 css 클래스(eng-c-<뱅크색>)로 주어 밝음/다크 테마를 따른다.

import type { EngineDef } from './data';

const NS = 'http://www.w3.org/2000/svg';

function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** size: 표시 크기(px). 크랭크 원 + 뱅크마다 실린더 막대(피스톤 포함) */
export function layoutIcon(def: EngineDef, size = 44): SVGSVGElement {
  const svg = node('svg', { viewBox: '0 0 48 48', width: size, height: size, 'aria-hidden': 'true', class: 'eng-icon' });
  const boxer = def.banks.some((b) => Math.abs(b.angle) > 80);
  const cx = 24;
  const cy = boxer ? 26 : 36;
  const w = def.banks.length > 2 ? 6 : 9;
  const r0 = boxer ? 6 : 6.5;
  const r1 = boxer ? 21 : 29;
  // 앞에서 보면 +Z가 화면 왼쪽이므로 각도를 그대로(시계 반대) 쓰면 3D 앞 시점과 좌우가 같다
  for (const b of def.banks) {
    const g = node('g', { transform: `rotate(${-b.angle} ${cx} ${cy})`, class: `eng-c-${b.color}` });
    g.append(
      node('rect', { x: cx - w / 2, y: cy - r1, width: w, height: r1 - r0, rx: 1.6, class: 'eng-icon-cyl' }),
      node('rect', { x: cx - w / 2 + 1.2, y: cy - r1 + 2.2, width: w - 2.4, height: 4, rx: 0.8, class: 'eng-icon-pis' })
    );
    svg.append(g);
  }
  svg.append(node('circle', { cx, cy, r: 4.2, class: 'eng-icon-crank' }));
  return svg;
}
