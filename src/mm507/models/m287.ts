// 287 피커링 조속기 — 스핀들 위·아래 칼라 사이에 판스프링 셋이 걸려 가운데에 공이 끼워져 있고, 빨리 돌면 공이 벌어져
// 스프링이 더 휘면서(길이는 그대로) 아래 칼라가 달린 미끄럼 슬리브가 올라가고, 슬리브 홈의 핀으로 조절 지레가 기운다.
// 설계표 docs/mm507-sheets/287.md · 키트 kit/k287.ts (구동 크라운 20 · 피니언 10 은 161·170 과 같은 짝)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { crownGear, displayStand, leaderTo, rotArrow, spurGear, tag } from '../kit';
import { bronze, steel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { K287, balls287, forkLever287, frame287, setBalls287, sleeve287, springsMesh287, state287, topCollar287 } from '../kit/k287';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM287(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());
  g.add(frame287());

  // 회전 묶음: 스핀들·크라운·칼라·스프링·공·슬리브
  const spin = new THREE.Group();
  spin.position.set(0, 0, K287.ZC);
  g.add(spin);

  const spindle = mesh(lathe(rodProfile(0.035, 0.5, 3.04, 0.004, 0.004), 40), steel());
  spindle.name = 'spindle';

  const crown = new THREE.Group();
  crown.name = 'crown';
  const cg = crownGear(20, 0.024, { bore: 0.036 });
  cg.rotation.x = -Math.PI / 2;
  // 키트의 어두운 허브는 아래 베어링 링(y 0.53~0.59)과 겹치므로 떼어 내고, 링 위에 놓이는 밝은 허브로 바꾼다
  const hub = cg.children[cg.children.length - 2]!;
  cg.remove(hub);
  crown.add(cg);
  crown.position.y = K287.YCROWN;
  const hubNew = mesh(lathe(tubeProfile(0.036, 0.08, 0.595, 0.665, 0.004), 40), steel());
  hubNew.name = 'crownHub';

  const top = topCollar287();
  const sleeve = sleeve287();
  const springs = springsMesh287(0.1, 1.2833);
  const balls = balls287();
  spin.add(spindle, crown, hubNew, top, springs, balls, sleeve);

  // 구동 피니언 + 수평 축 (오른쪽 위에서 크라운에 물림)
  const pinion = new THREE.Group();
  pinion.name = 'pinion';
  pinion.position.set(K287.PINION[0], K287.PINION[1], K287.ZC);
  const pg = spurGear(10, 0.024, { spokes: 0, driver: true });
  pg.rotation.y = Math.PI / 2;
  pg.name = 'pinionGear';
  const shaft = mesh(lathe(rodProfile(0.03, 0, 0.8, 0.004, 0.004), 24), steel());
  shaft.rotation.z = -Math.PI / 2;
  shaft.name = 'pinionShaft';
  const endCollar = mesh(lathe(tubeProfile(0.029, 0.05, 0.76, 0.81, 0.004), 28), bronze());
  endCollar.rotation.z = -Math.PI / 2;
  endCollar.name = 'pinionCollar';
  pinion.add(pg, shaft, endCollar);
  g.add(pinion);

  // 조절 지레
  const lever = new THREE.Group();
  lever.position.set(K287.PIVOT[0], K287.PIVOT[1], K287.ZC);
  lever.add(forkLever287());
  g.add(lever);

  const arrow = rotArrow(0.12, true);
  arrow.rotation.y = Math.PI / 2;
  arrow.position.set(1.0, 1.1, K287.ZC);
  g.add(arrow);

  g.add(
    leaderTo(tag('판스프링', v(-1.2, 2.55, 0.3)), 'springs'),
    leaderTo(tag('공', v(-1.15, 1.95, 0.3)), 'balls'),
    leaderTo(tag('미끄럼 슬리브', v(-1.0, 1.15, 0.3)), 'sleeve'),
    leaderTo(tag('고정 칼라', v(1.0, 2.8, 0.3)), 'topCollar'),
    leaderTo(tag('조절 지레', v(1.15, 1.62, 0.3)), 'forkLever')
  );

  let st = state287(0);
  const apply = (): void => {
    st = state287(t);
    pinion.rotation.x = st.thetaP;
    spin.rotation.y = st.spin;
    sleeve.position.y = st.yB;
    springs.geometry.dispose();
    const fresh = springsMesh287(st.b, st.c);
    springs.geometry = fresh.geometry;
    setBalls287(balls, st.b, st.c);
    lever.rotation.z = st.gamma;
  };
  apply();

  return {
    group: g,
    view: { pos: [1.2, 2.3, 4.4], target: [0.15, 1.75, 0.275] },
    notes: () => [
      { label: '스핀들 속도', value: st.omegaS.toFixed(2) + ' rad/s' },
      { label: '공 벌어짐', value: (K287.R0 + st.b).toFixed(3) },
      { label: '슬리브 높이', value: st.yB.toFixed(3) },
      { label: '원리', value: '판스프링 길이는 그대로라서, 공이 바깥으로 벌어져 활처럼 더 휘면 두 칼라 사이가 짧아진다 — 위 칼라는 축에 고정이므로 아래 칼라(슬리브)가 올라간다' },
      { label: '참고', value: '판화에는 스프링이 둘 보이지만 모델은 셋(120° 간격)으로 만들었다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
