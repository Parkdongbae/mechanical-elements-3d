// 107 홈 캠으로 만드는 왕복 — 물결 홈 드럼이 돌면 핀이 홈 벽에 밀려 막대가 걸이 사이에서 좌우 왕복한다 (판화 107번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { wallBearing } from '../kit/gear6';
import { K107, cam107, cam107Curve, camDrum107, hangerFrame107, sliderBar107 } from '../kit/k107';

const CY = 1.5; // 드럼 축 높이
const ZC = 0.28; // 드럼 축·막대·걸이의 z
const BY = CY + K107.R + K107.barUp; // 막대 축 높이 (2.14)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM107(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 홈 캠 드럼(구동) — group 은 두지 않고 set(a) 으로만 돌린다
  const drum = camDrum107();
  drum.group.position.set(0, CY, ZC);
  g.add(drum.group);

  // 미끄럼 막대(가운데 블록 + 핀) — 원점 = 막대 축 위·핀 바로 위
  const bar = sliderBar107();
  g.add(bar);

  // 천장 들보와 걸이 2개(고정) — 원점 = 막대 축의 가운데
  const hanger = hangerFrame107(ZC);
  hanger.position.set(0, BY, ZC);
  g.add(hanger);

  // 드럼 축받이 2개(판화에 없는 보충) — 고리 구멍이 X 방향
  g.add(wallBearing(-0.44, CY, ZC, 'x', 0.078), wallBearing(0.36, CY, ZC, 'x', 0.078));

  // 회전 방향 화살표 — 정면에서 타원으로 보이게 60° 만 돌린다
  const arrow = rotArrow(0.22, true);
  arrow.position.set(-0.72, CY, ZC);
  arrow.rotation.y = Math.PI / 3;
  g.add(arrow);

  // 이름표 — 막대 이름표는 막대를 따라간다
  const barTag = tag('미끄럼 막대', v(1.25, BY, 0.4));
  g.add(
    tag('홈 캠(구동)', v(-1.25, 1.0, 0.5)),
    tag('핀(따름쇠)', v(1.05, 1.88, 0.5)),
    barTag,
    tag('천장 걸이(고정)', v(0, 2.95, 0.3))
  );

  // 홈 기울기(압력각) — 표시용으로 한 번만 계산
  const slopeDeg = Math.round((Math.atan(cam107Curve().maxSlope / K107.R) * 180) / Math.PI);

  function apply(): void {
    const s = cam107(theta);
    drum.set(s.a);
    bar.position.set(s.x, BY, ZC);
    barTag.position.set(1.25 + s.x, BY, 0.4);
  }
  apply();

  return {
    group: g,
    view: { pos: [0.3, 2.1, 6.4], target: [0, 1.75, 0.2] },
    notes: () => {
      const s = cam107(theta);
      return [
        { label: '물결 수', value: '한 바퀴에 6번 왕복' },
        { label: '행정', value: '0.20 (홈 진폭 ±0.10)' },
        { label: '막대 위치', value: `행정의 ${Math.round(((s.x + K107.amp) / (2 * K107.amp)) * 100)} %` },
        { label: '홈 기울기', value: `가장 가파른 곳 ${slopeDeg}°(등속 구간)` }
      ];
    },
    update(dt: number, speed: number): void {
      // 누적 theta 에서 절대 자세를 닫힌 식으로 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
