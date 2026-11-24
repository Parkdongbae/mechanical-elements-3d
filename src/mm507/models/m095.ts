// 095 경사 원판 캠 — 세로 축을 돌리면 기울어진 원판이 위에 얹힌 막대를 위아래로 밀어 올린다(판화 95번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { forkRod, swashFrame, swashLift, swashRotor } from '../kit/k095';

// 기준점 P = 원판 윗면의 중심(설계표 095). AX·HY·ZC 는 그 아래 좌표
const AX = -0.15;
const HY = 2.0;
const ZC = 0.28;
const P = new THREE.Vector3(AX, HY, ZC);
const RC = 0.4; // 막대가 얹히는 반지름(축 중심 → 막대 자리)
const ROD_X = AX + RC; // 막대 세로선 x = 0.25
const ROD_LEN = 0.9; // 롤러 중심부터 막대 끝까지

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM095(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 회전체(축·허브·기운 원판)와 고정 틀 — 원점을 P 에 둔다
  const rotor = swashRotor(1.72);
  rotor.position.copy(P);
  const frame = swashFrame(1.82);
  frame.position.copy(P);
  g.add(rotor, frame);

  // 막대(포크 + 롤러) — 원점 = 롤러 중심, 롤러가 원판 윗면에 얹힌다
  const rod = forkRod(ROD_LEN);
  rod.position.set(ROD_X, HY, ZC);
  const roller = rod.getObjectByName('roller');
  g.add(rod);

  // 회전 방향 화살표 — 눕혀서 축을 감싼다(위에서 보아 반시계)
  const arrow = rotArrow(0.22, true);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(AX, 1.05, ZC);
  g.add(arrow);

  // 이름표
  g.add(
    tag('세로 축(구동)', v(-0.95, 1.05, 0.3)),
    tag('기운 원판', v(-0.95, 2.4, 0.3)),
    tag('롤러 달린 막대', v(1.15, 2.35, 0.3)),
    tag('벽에 붙은 축 받침', v(-1.0, 1.58, 0.3))
  );

  return {
    group: g,
    notes: () => {
      const psi = theta - 1.6;
      const lift = swashLift(psi);
      return [
        { label: '행정', value: '막대 행정 = 2 × 0.4 × tan 14° ≈ 0.20' },
        { label: '막대 높이', value: `${(HY + lift).toFixed(2)} (${lift >= 0 ? '+' : ''}${lift.toFixed(2)})` },
        { label: '지금', value: Math.sin(psi) < 0 ? '올라감' : '내려감' },
        { label: '캠', value: '원판 기울기 14°, 한 바퀴에 한 번 왕복' },
        { label: '구동 회전수', value: `${((OMEGA * 60) / (2 * Math.PI)).toFixed(1)} rpm` }
      ];
    },
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      // ψ = 0 이 판화 자세(원판의 높은 쪽이 막대 쪽)
      const psi = theta - 1.6;
      rotor.rotation.y = psi; // 세로 축, 위에서 보아 반시계
      // 롤러 중심 높이 = rr/cosα + rc·tanα·cosψ — 단순 조화 운동
      rod.position.y = HY + swashLift(psi);
      // 롤러 굴림: 접점이 원판 둘레 방향(rc 자리)으로 지나간다
      if (roller) roller.rotation.x = psi * (RC / 0.06);
    }
  };
}
