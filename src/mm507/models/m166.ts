// 166 멈춤이 있는 홈 크랭크 — 원판의 핀이 연결봉의 긴 홈 속을 지나는 동안 벽돌 틀이 행정 양 끝에서 쉰다 (판화 166번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K166, crankDisc166, mold166, pose166, rail166, slotRod166 } from '../kit/k166';

const TAU = Math.PI * 2;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM166(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 크랭크 원판(구동) + 축
  const disc = crankDisc166();
  disc.name = 'disc';
  disc.position.set(K166.cx, K166.cy, 0);
  g.add(disc, shaftZ(K166.cx, K166.cy, 0.095, 0.045));

  // 홈 연결봉
  const rod = slotRod166();
  rod.name = 'rod';
  g.add(rod);

  // 벽돌 틀 + 미끄럼 받침
  const mold = mold166();
  mold.name = 'mold';
  const rail = rail166();
  rail.name = 'rail';
  g.add(mold, rail);

  // 회전 화살표(반시계) — 원판 앞면 바로 앞, 봉보다 뒤
  const arrow = rotArrow(0.65, true);
  arrow.position.set(K166.cx, K166.cy, 0.07);
  g.add(arrow);

  // 이름표 5개('홈 연결봉'·'벽돌 틀'은 따라간다)
  const p0 = pose166(1.6);
  const rodTag = leaderTo(tag('홈 연결봉', v(0.2, 2.05, 0.3)), rod);
  const moldTag = leaderTo(tag('벽돌 틀(왕복)', v(1.1, 1.85, 0.3)), mold);
  g.add(
    leaderTo(tag('크랭크 원판(구동)', v(-1.2, 2.55, 0.3)), disc),
    leaderTo(tag('크랭크 핀', v(-1.75, 0.35, 0.3)), disc),
    rodTag,
    moldTag,
    leaderTo(tag('미끄럼 받침(고정)', v(1.35, 2.4, 0.3)), rail)
  );

  const apply = (): void => {
    const P = pose166(theta);
    disc.rotation.z = P.crank;
    rod.position.set(P.mx, K166.cy, 0);
    rod.rotation.z = P.rod;
    mold.position.set(P.mx, K166.cy, 0);
    rodTag.position.x = 0.2 + (P.mx - p0.mx) * 0.5;
    moldTag.position.x = 1.1 + (P.mx - p0.mx);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.5, 0] },
    notes: () => {
      const P = pose166(theta);
      return [
        { label: '원판', value: `${(theta / TAU).toFixed(1)} 바퀴` },
        { label: '틀 위치', value: `${P.mx.toFixed(2)} (행정 약 0.62)` },
        { label: '핀의 홈 속 자리', value: `${(P.d - K166.dmin).toFixed(2)} / ${K166.Ls}` },
        { label: '상태', value: P.dwell ? '틀 멈춤 — 진흙 넣기·벽돌 꺼내기' : '틀 움직임' }
      ];
    },
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
