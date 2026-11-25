// 106 홈 원통 캠의 등속 왕복 — 원통 겉면의 닫힌 홈(반 바퀴 나선·반 바퀴 되감기)이 핀을 좌우 등속으로 밀어낸다 (판화 106번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rod, rotArrow, tag, leaderTo } from '../kit';
import { ceilingSlab, followerBar, grooveCamX, grooveDrum, grooveProbe, hangerX, K106, wallBearingX } from '../kit/k104';

const TAU = Math.PI * 2;
const DX = 0; // 원통 가운데 x
const CY = 1.25; // 원통 축 높이
const ZC = 0.275; // 원통 축·막대의 z
const BY = CY + K106.R + K106.drop; // 막대 축 높이 = 2.0
const CEIL = 2.4; // 천장 밑면

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM106(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 원통 캠 — 축(로컬 X)을 원통 그룹의 자식으로 넣어 같이 돈다
  const drum = grooveDrum();
  drum.name = 'drum';
  drum.children[0]!.name = 'drumBody106';
  drum.add(rod(v(-0.78, 0, 0), v(0.78, 0, 0), K106.shaftR));
  drum.position.set(DX, CY, ZC);
  g.add(drum);

  // 원통 축받이 2개(판화에 없는 최소 보충)
  for (const x of [-0.6, 0.6]) {
    const b = wallBearingX(ZC, K106.shaftR);
    b.position.set(x, CY, ZC);
    g.add(b);
  }

  // 미끄럼 막대(보스·팔·핀) — 매 프레임 x 를 grooveCamX 로 다시 놓는다
  const bar = followerBar();
  bar.name = 'bar';
  bar.children[0]!.name = 'slideRod106';
  bar.children[4]!.name = 'pin106';
  g.add(bar);

  // 천장 걸이 2개(고정) — 두 가운데 x = −0.07 (원통 가운데보다 조금 왼쪽)
  for (const x of [-0.58, 0.44]) {
    const h = hangerX(CEIL - BY);
    h.position.set(x, BY, ZC);
    if (x > 0) h.name = 'hangerR106';
    g.add(h);
  }

  // 천장(고정, 뒤판에 붙은 나무 들보)
  const ceil = ceilingSlab(1.9);
  ceil.position.set(-0.07, CEIL, 0);
  g.add(ceil);

  // 검사 표식(메시 없음) — 핀과 홈의 침범 검사용
  const probe = grooveProbe();
  g.add(probe.group);

  // 회전 화살표(축 오른쪽 끝 밖, 오른쪽에서 보아 반시계 = rotation.x 느는 방향)
  const arrow = rotArrow(0.2, true);
  arrow.rotation.y = Math.PI / 2;
  arrow.position.set(0.84, CY, ZC);
  g.add(arrow);

  // 이름표 4개 — 2개는 막대를 따라간다
  const pinTag = leaderTo(tag('따라가는 핀', v(0, 0, 0)), 'pin106');
  const barTag = leaderTo(tag('미끄럼 막대', v(0, 0, 0)), 'slideRod106');
  g.add(leaderTo(tag('홈 원통 캠', v(-1.35, 0.75, 0.4)), 'drumBody106'), leaderTo(tag('걸이(안내)', v(1.3, 2.25, 0.3)), 'hangerR106'), pinTag, barTag);

  // notes 가 읽을 현재 값
  let a = theta - 1.6;
  let xb = grooveCamX(a);
  let dir = 1;

  const apply = (): void => {
    a = theta - 1.6; // t = 1 에 a = 0 = 판화 자세(핀 왼쪽 끝)
    drum.rotation.x = a;
    xb = grooveCamX(a);
    bar.position.set(DX + xb, BY, ZC);
    probe.set(drum.rotation.x, bar.position.x - DX);
    pinTag.position.set(1.0 + xb, 1.72, 0.45);
    barTag.position.set(-0.07 + xb, 2.75, 0.3);
    const u = a - TAU * Math.round(a / TAU); // (−π, π] 로 접기 — sin 의 부호가 진행 방향
    dir = Math.sin(u);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '원통 회전수', value: `${(a / TAU).toFixed(2)} 바퀴` },
      {
        label: '막대 위치',
        value: `−${K106.amp.toFixed(2)} ~ +${K106.amp.toFixed(2)} 중 ${xb >= 0 ? '+' : '−'}${Math.abs(xb).toFixed(3)} (행정의 ${Math.round(((xb + K106.amp) / (2 * K106.amp)) * 100)} %)`
      },
      { label: '방향', value: dir >= 0 ? '오른쪽으로' : '왼쪽으로' },
      { label: '속도', value: '일정(홈이 곧은 나선) — 끝에서 바로 뒤집힘' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0.5, 1.9, 6.4], target: [0, 1.5, 0.2] }
  };
}
