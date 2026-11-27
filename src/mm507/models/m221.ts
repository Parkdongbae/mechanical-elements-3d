// 221 타원 기어 구동 — 타원 평기어 C(초점 D 둘레로 일정하게 돎, 구동)가 같은 피치의 작은 피니언 B 를 돌린다.
// 피니언 중심은 고정이 아니라 A 에서 나온 흔들 팔에 실려 C 의 맞물림 반지름이 변해도 오르내리며 물리고,
// C 뒤의 판에 판 타원 홈 g·h 가 있어 피니언과 같은 중심의 롤러가 물림 깊이를 지킨다. 설계표 docs/mm507-sheets/221.md 그대로
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, ellipticalGear, ellipticalOutline, leaderTo, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { K221, BORE221, MC221, PIT221, RP221, arm221, groovePlate221, state221 } from '../kit/k221';
import { involuteOutline } from '../../models/parts/gears';
import { darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

const PI = Math.PI;
const K = K221;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM221(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── C 회전 그룹(원점 = 초점 D): 타원 기어 + 허브 기둥 + 홈 판 ──
  const gearC = new THREE.Group();
  gearC.name = 'gearC';
  gearC.position.set(K.D[0], K.D[1], 0);
  const ell = ellipticalGear(PIT221, K.NC, { width: 0.08, thick: 0.23, driver: true });
  ell.position.z = K.Z.front;
  ell.userData.outline = ellipticalOutline(PIT221, K.NC, false, 0.23);
  gearC.add(ell);
  const hubGeo = lathe(tubeProfile(BORE221, 0.06, K.Z.plate[1], 0), 32); // 판 앞면 ~ C 뒷면, 축 구멍 포함
  hubGeo.rotateX(PI / 2);
  const hub = mesh(hubGeo, darkSteel());
  gearC.add(hub);
  const plate = groovePlate221();
  gearC.add(plate);
  g.add(gearC);

  // 축 D(고정 표시)
  const shaftD = shaftZ(K.D[0], K.D[1], 0.11, 0.045);
  shaftD.name = 'shaftD';
  g.add(shaftD);

  // ── 바퀴 A(출력) + 축 A ──
  const wheelA = new THREE.Group();
  wheelA.name = 'wheelA';
  wheelA.position.set(K.A[0], K.A[1], K.Z.mid);
  wheelA.add(spurGear(K.ZA, K.MAB, { width: 0.06, spokes: 5 }));
  const bar = mesh(new THREE.BoxGeometry(0.3, 0.04, 0.008), paint(0xd8362f));
  bar.position.set(0.3, 0, 0.034);
  wheelA.add(bar);
  g.add(wheelA);
  const shaftA = shaftZ(K.A[0], K.A[1], 0.19, 0.035);
  shaftA.name = 'shaftA';
  g.add(shaftA);

  // ── 피니언 묶음: 피니언 + 큰 기어 B + 축 + 롤러 ──
  const pinionSet = new THREE.Group();
  pinionSet.name = 'pinionSet';
  const pinionB = spurGear(K.NP, MC221, { width: 0.08, spokes: 0 });
  pinionB.name = 'pinionB';
  pinionB.position.z = K.Z.front;
  pinionB.userData.outline = involuteOutline(K.NP, RP221 + MC221, RP221 - 1.25 * MC221, PI / K.NP);
  const gearB = spurGear(K.ZB, K.MAB, { width: 0.06, spokes: 5 });
  gearB.name = 'gearB';
  gearB.position.z = K.Z.mid;
  const pShaft = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 24).rotateX(PI / 2), steel());
  pShaft.name = 'pinionShaft';
  const roller = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 28).rotateX(PI / 2), steel());
  roller.name = 'roller';
  roller.position.z = K.Z.groove + 0.0125;
  pinionSet.add(pinionB, gearB, pShaft, roller);
  g.add(pinionSet);

  // ── 흔들 팔(받침 = 축 A 앞 끝) ──
  const arm = arm221();
  arm.position.set(K.A[0], K.A[1], K.Z.arm);
  g.add(arm);

  // ── 화살표 · 이름표 ──
  const arrow = rotArrow(0.3, true);
  arrow.position.set(K.D[0], K.D[1], 0.2);
  g.add(arrow);

  g.add(
    leaderTo(tag('A 바퀴(출력)', v(-2.0, 3.0, 0.5)), 'wheelA'),
    leaderTo(tag('흔들 팔', v(-2.0, 2.2, 0.5)), 'arm'),
    leaderTo(tag('D 축', v(-1.7, 1.3, 0.5)), 'shaftD'),
    leaderTo(tag('g·h 홈', v(-1.85, 0.55, 0.5)), 'plate'),
    leaderTo(tag('B 피니언', v(2.0, 2.75, 0.5)), 'pinionB'),
    leaderTo(tag('C 타원 기어', v(2.05, 0.7, 0.5)), 'gearC')
  );

  let st = state221(0);
  const apply = (): void => {
    st = state221(t);
    gearC.rotation.z = st.thC;
    pinionSet.position.set(st.P[0], st.P[1], 0);
    pinionSet.rotation.z = st.psiB;
    wheelA.rotation.z = st.psiA;
    arm.rotation.z = st.arm;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: 'C 각', value: `${(((st.thC * 180) / PI) % 360).toFixed(0)}°` },
      { label: 'A / C 빠르기', value: `${st.ratio.toFixed(2)}배 (1.80~3.38)` },
      { label: '피니언–D 거리', value: `${Math.hypot(st.P[0] - K.D[0], st.P[1] - K.D[1]).toFixed(3)} (0.718~1.138)` },
      { label: '원리', value: '타원이 초점 D 로 돌아 물린 곳 반지름이 바뀌고, 팔이 오르내려 물림을 지킨다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [0.1, 1.85, 7.4], target: [0.1, 1.8, 0] }
  };
}
