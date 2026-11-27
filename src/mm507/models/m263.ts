// 263 편심 원뿔(옆면) — 262 와 같은 기구·같은 치수를 옆에서 본다. 설계표 docs/mm507-sheets/263.md
import { type MovementModel } from '../types';
import { buildEcc262 } from '../kit/k263';

export default function buildM263(): MovementModel {
  return buildEcc262({
    tags: [
      ['원뿔 B', 'coneBody', [-1.15, 1.8, 0.5]],
      ['롤러 C', 'rollerC', [0.35, 1.7, 0.5]],
      ['누름 추', 'pressW', [0.45, 2.5, 0.5]],
      ['나사 D', 'screwD', [1.25, 1.25, 0.5]],
      ['너트 E', 'nutE', [1.35, 0.45, 0.5]],
      ['축받이', 'bearingL', [-1.85, 1.45, 0.5]]
    ],
    view: { pos: [0.3, 1.6, 5.4], target: [-0.15, 1.2, 0.2] },
    memo: '판화의 고르지 않은 편심을 0.09(큰 끝 반지름의 0.23)로 통일, 원뿔 축은 나사와 나란'
  });
}
