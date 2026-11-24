// 097 홈이 파인 하트 캠 — 하트 홈이 롤러를 양쪽에서 잡아 스프링 없이 일정한 속도로 왕복 (판화 97번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { barGuide, camBar, groovedHeartDisc97, HEART97, heartPitch97 } from '../kit/k095';

const CX = -0.7; // 원판 축 x
const CY = 1.75; // 원판 축 y
const Z = 0.1; // 롤러 가운데 평면
const BAR_LEN = 1.8; // 막대 길이(롤러 중심 → 끝)
const PSI0 = 1.6; // t = 1(판화 자세)에서 ψ = 0 이 되게 하는 오프셋

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM097(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 홈 파인 하트 원판(구동) — 로컬 +X 가 눈, 뒤판·둔덕·하트 섬·허브
  const disc = groovedHeartDisc97();
  disc.name = 'disc';
  disc.position.set(CX, CY, Z);
  g.add(disc, shaftZ(CX, CY, 0.24, 0.055));

  // 롤러 달린 가로 막대 — 원점 = 롤러 중심, 봉은 z 0.215 를 지난다
  const bar = camBar(BAR_LEN, HEART97.rho);
  bar.name = 'bar';
  g.add(bar);

  // 안내 블록 2개(판화에 없는 보충) — 팔 끝이 뒤판 앞면(z −0.30)에 닿는다
  const guide1 = barGuide(-0.515);
  guide1.name = 'guide1';
  guide1.position.set(0.55, CY, 0.215);
  const guide2 = barGuide(-0.515);
  guide2.name = 'guide2';
  guide2.position.set(1.15, CY, 0.215);
  g.add(guide1, guide2);
  // 롤러 이름표는 막대 그룹 안에 — 막대와 함께 오간다(t = 1 에서 세계 (−0.1, 2.3, 0.3))
  bar.add(tag('롤러(홈 속)', v(0.38, 0.55, 0.2)));

  // 회전 방향 화살표(반시계) + 이름표 — 화살표는 막대 봉(z 0.17~0.26) 앞 z 0.3 에(봉을 뚫고 지나가지 않게)
  const arrow = rotArrow(0.45, true);
  arrow.position.set(CX, CY, 0.3);
  g.add(arrow);
  g.add(
    tag('홈 파인 원판(구동)', v(-1.2, 2.98, 0.3)),
    tag('하트 모양 홈', v(-1.3, 0.52, 0.3)),
    tag('가로 막대(일정한 속도로 왕복)', v(1.5, 1.3, 0.3)) // 막대 아래 — 위쪽은 따라 움직이는 롤러 이름표 자리
  );

  // 수치 패널 상태
  let lift = 0; // 막대 위치 xr − r0
  let out = true; // 나가는 중?

  // 절대 자세: ψ = theta − 1.6, 롤러 중심 거리는 heartPitch97(ψ) — 정확한 삼각파
  const apply = (): void => {
    const psi = theta - PSI0;
    disc.rotation.z = psi;
    const xr = heartPitch97(psi);
    bar.position.set(CX + xr, CY, Z);
    const f = (((psi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    out = f < Math.PI;
    lift = xr - HEART97.r0;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '원리', value: '홈이 롤러를 양쪽에서 잡는다 — 밀기도 하고 당기기도 해서 스프링이 필요 없다' },
      { label: '막대 위치', value: `${lift.toFixed(2)} (${out ? '나감' : '돌아옴'})` },
      { label: '왕복', value: '반 바퀴에 0.68 을 일정한 속도로' },
      { label: '구동 회전수', value: `분당 약 ${Math.round((OMEGA * 60) / (2 * Math.PI))} 회전` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
