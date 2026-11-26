// 165 물결 캠과 흔들막대 — 수직 축의 물결 테가 돌면 굴림대가 오르내리고, 흔들막대가 받침점에서 흔들려 수직 막대가 왕복한다 (판화 165번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K165, bar165, barGuide165, pose165, rockRod165, shaftBearing165, waveCam165 } from '../kit/k165';

const TAU = Math.PI * 2;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM165(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 물결 캠 + 수직 축(구동) + 위·아래 받침
  const cam = waveCam165();
  cam.name = 'cam';
  cam.position.set(K165.AX, 0, K165.ZC);
  const bUp = shaftBearing165();
  bUp.position.set(K165.AX, K165.bearUp, K165.ZC);
  const bLo = shaftBearing165();
  bLo.position.set(K165.AX, K165.bearLo, K165.ZC);
  g.add(cam, bUp, bLo);

  // 받침점 핀(뒤판에서) + 흔들막대·굴림대
  g.add(shaftZ(K165.Fx, K165.Fy, 0.78, 0.035));
  const { group: rod, roller } = rockRod165();
  rod.name = 'rockRod';
  rod.position.set(K165.Fx, K165.Fy, 0);
  g.add(rod);

  // 수직 막대 + 안내 둘
  const bar = bar165();
  bar.name = 'bar';
  g.add(bar);
  const guides = K165.guideY.map((y) => {
    const gd = barGuide165();
    gd.position.set(K165.xb, y, 0);
    g.add(gd);
    return gd;
  });

  // 회전 화살표 — 판 윗면 위, 위에서 볼 때 반시계
  const arrow = rotArrow(0.3, true);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(K165.AX, K165.plateTop + 0.012, K165.ZC);
  g.add(arrow);

  // 이름표 6개('흔들막대'·'수직 막대'는 따라간다)
  const rodTag = leaderTo(tag('흔들막대', v(-0.2, 1.05, 0.85)), rod);
  const barTag = leaderTo(tag('수직 막대(왕복)', v(-1.35, 1.75, 0.85)), bar);
  g.add(
    leaderTo(tag('물결 캠(구동)', v(1.55, 2.25, 0.8)), cam),
    leaderTo(tag('수직 축', v(1.35, 3.05, 0.4)), cam),
    leaderTo(tag('굴림대', v(1.35, 1.5, 0.85)), roller),
    leaderTo(tag('받침점(고정)', v(-0.75, 2.2, 0.85)), rod),
    rodTag,
    barTag
  );
  void guides;

  const p0 = pose165(1.6);
  const apply = (): void => {
    const P = pose165(theta);
    cam.rotation.y = P.phi;
    rod.rotation.z = P.beta;
    roller.rotation.z = -P.spin;
    bar.position.set(K165.xb, P.pinY, 0);
    barTag.position.y = 1.75 + (P.pinY - p0.pinY);
    rodTag.position.y = 1.05 + (P.pinY - p0.pinY) * 0.5;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.3, 2.4, 6.3], target: [0, 1.65, 0] },
    notes: () => {
      const P = pose165(theta);
      return [
        { label: '캠', value: `${(theta / TAU).toFixed(1)} 바퀴 (물결 5 → 막대 5 왕복)` },
        { label: '흔들막대 각', value: `${((P.beta * 180) / Math.PI).toFixed(1)}°` },
        { label: '수직 막대 높이', value: `${P.pinY.toFixed(3)}` },
        { label: '닿음', value: '수직 막대의 무게가 굴림대를 물결에 눌러 준다' }
      ];
    },
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
