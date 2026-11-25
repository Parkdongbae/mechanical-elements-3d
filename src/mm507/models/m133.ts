// 133 피니언·부채꼴 프레스 — 손 크랭크(피니언 축) → 피니언 10T → 이 부채꼴(64T 의 17개) → 연결봉 → 누름판 (판화 133번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, shaftZ, spurGear, tag, leaderTo } from '../kit';
import {
  K133, K133_Q, eyeRod131, handCrank131, platen133, press133, pressFrame133,
  sectorCrank133, swingArrows131, type Press133
} from '../kit/k131';

const DEG = Math.PI / 180;
const ZR = K133.zRod; // 연결봉 평면(세계 z)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 힘 배율 = 손잡이 이동 / 누름판 이동 = 0.54·6.4 ÷ (d eyeY / d sigma) — 핀이 축 바로 위로 갈수록 커진다 */
function forceRatio(A: Press133): number {
  const K = K133;
  const a = A.sector + K.pinDeg * DEG;
  const c = Math.cos(a);
  const px = K.rc * c;
  const dEye = K.rc * c + (K.rc * K.rc * Math.sin(a) * c) / Math.sqrt(K.rod * K.rod - px * px);
  return (K.handle * (K.zs / K.zp)) / dEye;
}

export default function buildM133(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 틀(고정): 기둥 둘 + 머리 — 원점 = 프레스 가운데선 바닥
  const frame = pressFrame133();
  frame.name = 'frame';
  frame.position.set(K133.P[0], 0, K133.zCol);
  g.add(frame);

  // 이 부채꼴(크랭크 핀 달림, 황동) + 축(고정)
  const sector = sectorCrank133(0.14, 0.1);
  sector.name = 'sector';
  sector.position.set(K133.P[0], K133.P[1], K133.zGear);
  g.add(sector, shaftZ(K133.P[0], K133.P[1], 0.41, 0.06));

  // 피니언(구동 쪽, bronze) + 축
  const pinion = spurGear(10, 0.036, { width: 0.1, spokes: 0, driver: true });
  pinion.name = 'pinion';
  pinion.position.set(K133_Q[0], K133_Q[1], K133.zGear);
  g.add(pinion, shaftZ(K133_Q[0], K133_Q[1], 0.545, 0.025));

  // 손 크랭크 — 피니언과 한 축
  const crank = handCrank131(K133.handle);
  crank.name = 'crank';
  crank.position.set(K133_Q[0], K133_Q[1], K133.zCrank);
  g.add(crank);

  // 연결봉: 원점 = 아래 눈(크랭크 핀), 로컬 +X 로 위 눈
  const rod = eyeRod131(K133.rod);
  rod.name = 'rod';
  g.add(rod);

  // 누름판: 원점 = 귀의 핀 중심(누를 물건 포함)
  const platen = platen133(0.35);
  platen.name = 'platen';
  g.add(platen);

  // 왔다 갔다 방향 화살표 — 피니언 축 앞(손 크랭크 팔보다 앞, 손잡이보다 안쪽)
  const arrows = swingArrows131(0.3);
  arrows.group.position.set(K133_Q[0], K133_Q[1], 0.56);
  g.add(arrows.group);

  // 이름표('누름판'만 부품을 따라 오른다)
  const platenTag = tag('누름판', v(-1.45, 2.0, 0.3));
  g.add(
    tag('손 크랭크(구동)', v(1.55, 2.25, 0.5)),
    leaderTo(tag('피니언 10T', v(1.72, 0.92, 0.4)), pinion),
    tag('이 부채꼴(64T 의 17개)', v(1.4, 0.3, 0.4)),
    tag('연결봉', v(-1.5, 1.35, 0.45)),
    platenTag,
    tag('머리(고정)', v(-1.5, 2.85, 0.3))
  );

  let spd = 1; // 역재생이면 −1
  const apply = (): void => {
    const A = press133(theta);
    sector.rotation.z = A.sector;
    pinion.rotation.z = A.pinion;
    crank.rotation.z = A.crank;
    rod.position.set(A.pin[0], A.pin[1], ZR);
    rod.rotation.z = A.rodAngle;
    platen.position.set(K133.P[0], A.eyeY, K133.zCol);
    platenTag.position.set(-1.45, 2.0 + A.rise, 0.3);
    // 피니언은 왕복한다 — 화살표를 지금 도는 방향으로(예전엔 set 을 부르지 않아 늘 반시계였다: 사용자 지적)
    arrows.set(Math.sign(press133(theta + 0.01).pinion - A.pinion) * spd);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const A = press133(theta);
      return [
        { label: '손 크랭크', value: `${(A.crank / DEG).toFixed(0)}° 돌림 (한 번에 307°)` },
        { label: '부채꼴', value: `${(A.sigma / DEG).toFixed(1)}° (피니언의 1/6.4)` },
        { label: '누름판', value: `${A.rise.toFixed(2)} 오름 (행정 0.37)` },
        { label: '힘 배율', value: `약 ${forceRatio(A).toFixed(1)}배` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      spd = speed < 0 ? -1 : 1;
      apply();
    }
  };
}
