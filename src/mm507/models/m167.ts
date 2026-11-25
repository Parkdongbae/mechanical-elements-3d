// 167 끝없는 나선 홈 원통 — 왕복 막대의 스터드가 반은 오르막·반은 내리막인 닫힌 홈을 밀어 원통을 한 방향으로 돌린다 (판화 167번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K167, drum167, grooveProbe167, pedestal167, pose167, rod167, rodGuide167, topBearing167 } from '../kit/k167';

const TAU = Math.PI * 2;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM167(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 나선 홈 드럼(수직) + 아래 축대·위 받침
  const drum = drum167();
  drum.name = 'drum';
  drum.position.set(0, K167.CY, 0);
  const ped = pedestal167();
  ped.position.set(0, K167.jY, 0);
  const top = topBearing167();
  top.position.set(0, K167.jYTop, 0);
  g.add(drum, ped, top);

  // 왕복 막대 + 스터드(구동) + 안내 둘(스터드 행정 위)
  const rod = rod167();
  rod.name = 'rod';
  g.add(rod);
  for (const y of [2.12, 2.32]) {
    const gd = rodGuide167();
    gd.position.set(K167.rodX, y, 0);
    g.add(gd);
  }

  // 홈 × 스터드 침범 검사 표식(메시 없음)
  const probe = grooveProbe167();
  g.add(probe.group);

  // 회전 화살표 — 드럼 위 마구리 위에 눕혀(위에서 볼 때 반시계)
  const arrow = rotArrow(0.32, true);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(0, K167.CY + K167.L / 2 + 0.02, 0);
  g.add(arrow);

  // 이름표 4개('왕복 막대'·'스터드'는 따라가고 '나선 홈 원통'은 표시 줄을 가리킨다)
  const p0 = pose167(1.6);
  const rodTag = leaderTo(tag('왕복 막대(구동)', v(1.35, 2.75, 0.3)), rod);
  const studTag = leaderTo(tag('스터드', v(1.1, 1.13, 0.3)), rod);
  g.add(
    leaderTo(tag('끝없는 나선 홈 원통', v(-1.25, 2.0, 0.35)), drum),
    leaderTo(tag('받침(고정)', v(-1.0, 0.45, 0.3)), ped),
    rodTag,
    studTag
  );

  const apply = (): void => {
    const P = pose167(theta);
    drum.rotation.y = P.phi;
    rod.position.set(K167.rodX, P.studY, 0);
    probe.set(P.phi, P.studY);
    rodTag.position.y = 2.75 + (P.studY - p0.studY);
    studTag.position.y = P.studY;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 2.0, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const P = pose167(theta);
      return [
        { label: '막대 행정', value: `${P.s.toFixed(2)} / ${(2 * K167.amp).toFixed(2)}` },
        { label: '원통', value: `${(P.phi / TAU).toFixed(2)} 바퀴 (한 왕복 = 한 바퀴)` },
        { label: '방향', value: P.u <= Math.PI ? '막대 오름 — 원통 같은 방향' : '막대 내림 — 원통 같은 방향' },
        { label: '쓰임', value: '증기 기관에서 크랭크 대신' }
      ];
    },
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
