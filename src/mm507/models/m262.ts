// 262 편심 원뿔(끝면) — 나사 D 끝에 편심으로 붙은 원뿔 B 가 고정 너트 E 속에서 돌며 나아가고,
// 누름 추로 눌린 롤러 C 가 오르내리되 올라가는 거리와 내려가는 거리가 다르다. 설계표 docs/mm507-sheets/262.md
import { type MovementModel } from '../types';
import { buildEcc262 } from '../kit/k262';

export default function buildM262(): MovementModel {
  return buildEcc262({
    tags: [
      ['원뿔 B', 'coneBody', [-1.85, 1.7, 0.6]],
      ['롤러 C', 'rollerC', [0.25, 1.75, 0.6]],
      ['누름 추', 'pressW', [0.25, 2.55, 0.6]],
      ['나사 D', 'screwD', [1.35, 1.3, 0.6]],
      ['너트 E', 'nutE', [1.3, 0.4, 0.6]]
    ],
    view: { pos: [-3.6, 2.1, 3.6], target: [-0.5, 1.3, 0.25] },
    memo: '판화의 편심(반지름의 0.7)을 0.23 으로 줄임 — 작은 끝에서 나사가 원뿔 밖으로 나가지 않게'
  });
}
