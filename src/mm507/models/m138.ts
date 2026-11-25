// 138 바닥 캠으로 움직이는 막대 — 삼날 캠(구동) 위에 납작 막대가 얹혀
//  변하는 속도의 번갈아 직선 운동을 한다 (판화 138번, 설계표 docs/mm507-sheets/138.md)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { K138, camPlate138, lift138, rodBar138, rodGuide138 } from '../kit/k138';

const PHASE0 = 1.6; // u = theta − PHASE0: t = 1 에서 u = 0 (판화 자세 — 발이 윗 골)
const DEG = 180 / Math.PI;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM138(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 캠 축(고정) — 허브 구멍 0.10 을 틈 0.005 로 꿴다. 뒤판 보스가 받치고 끝 너트 z ≤ 0.28
  const camShaft = shaftZ(0, K138.CY, 0.28, 0.095);
  camShaft.name = 'camShaft';
  g.add(camShaft);

  // 삼날 캠(구동, 청동) — 원점 = 축, rotation.z = u
  const cam = camPlate138();
  cam.name = 'cam';
  cam.position.set(0, K138.CY, K138.ZC);

  // 납작 막대 — 원점 = 발 바닥 가운데, position.y = CY + lift138(u)
  const rod = rodBar138(K138.ROD_LEN);
  rod.name = 'rod';
  rod.position.set(0, K138.CY, K138.ZC);

  // 안내 브래킷 2개(고정, 주철) — 아래 2.03 / 위 2.52
  const guide1 = rodGuide138(K138.ZC);
  guide1.name = 'guide1';
  guide1.position.set(0, K138.G2, K138.ZC);
  const guide2 = rodGuide138(K138.ZC);
  guide2.name = 'guide2';
  guide2.position.set(0, K138.G1, K138.ZC);
  g.add(cam, rod, guide1, guide2);

  // 회전 방향 화살표(반시계) — 허브와 골 사이 크기, z 0.30
  const arrow = rotArrow(0.21, true);
  arrow.position.set(0, K138.CY, 0.3);
  g.add(arrow);

  // 이름표 5개 — '막대'·'막대 발'은 막대 발을 따라간다
  const tagCam = tag('삼날 캠(구동)', v(-1.3, 1.6, 0.3));
  const tagRod = tag('막대(왕복)', v(0.34, K138.CY + 0.85, 0.3));
  const tagFoot = tag('막대 발(접점)', v(-0.6, K138.CY + 0.05, 0.3));
  const tagGuide = tag('안내 2개(고정)', v(0.85, K138.G1, 0.3));
  const tagShaft = leaderTo(tag('캠 축(고정)', v(0.9, 0.85, 0.3)), 'camShaft');
  g.add(tagCam, tagRod, tagFoot, tagGuide, tagShaft);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  let u = 0;
  let lift = 0;
  const pose = (th: number): void => {
    u = th - PHASE0;
    cam.rotation.z = u;
    lift = lift138(u);
    rod.position.y = K138.CY + lift;
    tagRod.position.set(0.34, K138.CY + lift + 0.85, 0.3);
    tagFoot.position.set(-0.6, K138.CY + lift + 0.05, 0.3);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0.1] },
    notes: () => [
      { label: '캠 각', value: `${(((((u * DEG) % 360) + 360) % 360)).toFixed(0)}°` },
      { label: '막대 발 높이', value: `${lift.toFixed(3)}(축 위, 행정 0.29)` },
      { label: '한 바퀴', value: '큰 오름 둘 + 작은 오름 하나' },
      { label: '변속', value: '캠 모양이 일정하지 않아 오르내리는 속도가 일정하지 않다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
