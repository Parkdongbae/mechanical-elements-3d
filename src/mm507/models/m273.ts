// 273 마름모 링크 — 같은 길이 막대 넷을 핀으로 잇는 마름모. 가로 막대 A·B 를 모으면 세로 막대 C·D 가 벌어진다.
// 막대 넷은 각자 고정 안내 부시 속을 곧게 미끄러진다(돌지 않음). 6 초 주기.
// 설계표 docs/mm507-sheets/273.md · 키트 kit/k273.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, markPin, tag } from '../kit';
import { flatLink273, guide273, K273, slideRod273, state273 } from '../kit/k273';
import { paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, shapeFrom } from '../../models/parts/geom';

const TAU = Math.PI * 2;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const CY = K273.O[1];
const Z_L1 = 0.05; // 마름모 1층 가운데(0.035~0.065)
const Z_L2 = 0.085; // 마름모 2층 가운데(0.07~0.10)

/** 꼭짓점 핀: 몸 −0.03~0.101 + 머리 0.101~0.116 + 붉은 점 0.116~0.118 */
const mkPin = (name: string): THREE.Group => {
  const g = new THREE.Group();
  g.name = name;
  const bodyGeo = lathe(rodProfile(0.016, -0.03, 0.101), 20);
  bodyGeo.rotateX(Math.PI / 2);
  g.add(mesh(bodyGeo, steel()));
  const headGeo = lathe(rodProfile(0.028, 0.101, 0.116, 0.002, 0.002), 24);
  headGeo.rotateX(Math.PI / 2);
  g.add(mesh(headGeo, steel()));
  const dotGeo = lathe(rodProfile(0.01, 0.116, 0.118), 12);
  dotGeo.rotateX(Math.PI / 2);
  g.add(mesh(dotGeo, paint(0xd8362f)));
  markPin(g);
  return g;
};

/** A·B 위 방향 화살표(+x 를 향한 납작 화살, 뒤집을 때는 rotation.y = π) */
const mkArrow = (): THREE.Group => {
  const g = new THREE.Group();
  const mat = paint(0xf2b619);
  const shaft = mesh(new THREE.BoxGeometry(0.10, 0.02, 0.01), mat);
  shaft.position.x = -0.05;
  g.add(shaft);
  g.add(mesh(extrude(shapeFrom([[0, -0.02], [0.05, 0], [0, 0.02]]), 0.01), mat));
  g.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  return g;
};

export default function buildM273(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 막대 넷(눈 중심이 꼭짓점 핀 자리, 몸은 바깥으로)
  const rodA = slideRod273(0.85);
  rodA.name = 'rodA';
  rodA.rotation.z = Math.PI; // −x 방향
  const rodB = slideRod273(0.85);
  rodB.name = 'rodB';
  const rodC = slideRod273(0.60);
  rodC.name = 'rodC';
  rodC.rotation.z = Math.PI / 2; // +y 방향
  const rodD = slideRod273(0.60);
  rodD.name = 'rodD';
  rodD.rotation.z = -Math.PI / 2; // −y 방향
  g.add(rodA, rodB, rodC, rodD);

  // 안내 부시 넷
  const guideA = guide273('x');
  guideA.name = 'guideA';
  guideA.position.set(-K273.GUIDE_X, CY, 0);
  const guideB = guide273('x');
  guideB.name = 'guideB';
  guideB.position.set(K273.GUIDE_X, CY, 0);
  const guideC = guide273('y');
  guideC.name = 'guideC';
  guideC.position.set(0, K273.GUIDE_YC, 0);
  const guideD = guide273('y');
  guideD.name = 'guideD';
  guideD.position.set(0, K273.GUIDE_YD, 0);
  g.add(guideA, guideB, guideC, guideD);

  // 마름모 변 넷(원점 = 첫 핀, +x 가 둘째 핀)
  const barAC = flatLink273(K273.LB);
  barAC.name = 'barAC';
  const barCB = flatLink273(K273.LB);
  barCB.name = 'barCB';
  const barBD = flatLink273(K273.LB);
  barBD.name = 'barBD';
  const barDA = flatLink273(K273.LB);
  barDA.name = 'barDA';
  g.add(barAC, barCB, barBD, barDA);

  // 핀 넷
  const pinA = mkPin('pinA');
  const pinB = mkPin('pinB');
  const pinC = mkPin('pinC');
  const pinD = mkPin('pinD');
  g.add(pinA, pinB, pinC, pinD);

  // 방향 화살표 두 개(A·B 막대 위 y 1.95, 깊이 0.12)
  const arrowA = mkArrow();
  arrowA.name = 'arrowA';
  const arrowB = mkArrow();
  arrowB.name = 'arrowB';
  g.add(arrowA, arrowB);

  // 이름표 6(이름표 표 그대로)
  g.add(
    leaderTo(tag('A 막대', v(-1.20, 1.35, 0.3)), 'rodA'),
    leaderTo(tag('B 막대', v(1.20, 1.35, 0.3)), 'rodB'),
    leaderTo(tag('C 막대', v(0.55, 2.85, 0.3)), 'rodC'),
    leaderTo(tag('D 막대', v(0.55, 0.65, 0.3)), 'rodD'),
    leaderTo(tag('마름모 막대', v(-1.00, 2.45, 0.3)), 'barAC'),
    leaderTo(tag('안내 부시', v(-1.55, 2.00, 0.3)), 'guideA')
  );

  // 화살표: p = +1 이면 안쪽(A 는 +x), −1 이면 바깥쪽. 눈 중심 위에 대칭으로 얹는다
  const setArrow = (arrow: THREE.Group, eyeX: number, p: number): void => {
    arrow.rotation.y = p > 0 ? 0 : Math.PI;
    arrow.position.set(eyeX + p * 0.075, 1.95, 0.12);
  };

  const apply = (speed: number): void => {
    const { a, c } = state273(t);
    rodA.position.set(-a, CY, 0);
    rodB.position.set(a, CY, 0);
    rodC.position.set(0, CY + c, 0);
    rodD.position.set(0, CY - c, 0);
    pinA.position.set(-a, CY, 0);
    pinB.position.set(a, CY, 0);
    pinC.position.set(0, CY + c, 0);
    pinD.position.set(0, CY - c, 0);
    barAC.position.set(-a, CY, Z_L1);
    barAC.rotation.z = Math.atan2(c, a);
    barBD.position.set(a, CY, Z_L1);
    barBD.rotation.z = Math.atan2(-c, -a);
    barCB.position.set(0, CY + c, Z_L2);
    barCB.rotation.z = Math.atan2(-c, a);
    barDA.position.set(0, CY - c, Z_L2);
    barDA.rotation.z = Math.atan2(c, -a);
    // a 가 줄면 화살표 안쪽, 늘면 바깥쪽(속도 부호 반영)
    const dir = Math.sign(Math.sin((TAU * t) / K273.PERIOD)) * (speed < 0 ? -1 : 1);
    const p = dir < 0 ? 1 : -1;
    setArrow(arrowA, -a, p);
    setArrow(arrowB, a, -p);
  };
  apply(1);

  return {
    group: g,
    view: { pos: [0, CY, 5.6], target: [0, CY, 0] },
    notes: () => {
      const { a, c } = state273(t);
      return [
        { label: 'A·B 사이', value: (2 * a).toFixed(2) },
        { label: 'C·D 사이', value: (2 * c).toFixed(2) },
        { label: '원리', value: '마름모 네 변의 길이가 같아 (반폭)² + (반높이)² = (변 길이)² — 가로가 줄면 세로가 는다' }
      ];
    },
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply(speed);
    }
  };
}
