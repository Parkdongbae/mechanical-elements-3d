// 150 양정이 다른 캠 묶음 — 양정만 다른 캠 세 장이 축 위를 앞뒤로 미끄러져
//  지레의 굴림 바퀴에 닿는 캠을 바꾸고, 밸브 막대의 행정이 달라진다 (판화 150번, 설계표 docs/mm507-sheets/150.md)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { wallBearing } from '../kit/gear6';
import { K150, camStack150, hangRod, leverPoint, rollerLever, rodAim, valve150 } from '../kit/k149';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** child 이름으로 찾아 새 이름을 붙인다(검사 선언용 이름). 없으면 예외 */
function child(o: THREE.Object3D, name: string, as: string): THREE.Object3D {
  const c = o.getObjectByName(name);
  if (c === undefined) throw new Error(`child ${name} 없음`);
  c.name = as;
  return c;
}

export default function buildM150(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 캠 축(구동)과 지레 받침 축(고정) — 뒤판 보스가 받친다
  const camShaft = shaftZ(K150.S[0], K150.S[1], 0.62, K150.shaftR);
  camShaft.name = 'camShaft';
  g.add(camShaft);
  const pivotShaft = shaftZ(K150.Q[0], K150.Q[1], 0.58, 0.05);
  pivotShaft.name = 'pivotShaft';
  g.add(pivotShaft);

  // 캠 묶음: 바탕 원이 같은 캠 세 장(작은 캠이 맨 앞), 축 위에서 앞뒤로 미끄러진다
  const stack = camStack150();
  const camStack = stack.group;
  camStack.name = 'camStack';
  camStack.position.set(K150.S[0], K150.S[1], K150.zRoller);
  g.add(camStack);

  // 지레: 판은 캠 묶음보다 앞 평면, 굴림 바퀴는 긴 굴대로 뒤로 내려가 캠 한 장에 닿는다
  const lever = rollerLever(K150.L, { pinAt: K150.pinAt, rollerR: K150.rr, rollerW: 0.09, rollerDz: K150.zRoller - K150.zBar, pinDz: 0.07, bossR: 0.13 });
  lever.name = 'lever';
  lever.position.set(K150.Q[0], K150.Q[1], K150.zBar);
  const roller = child(lever, 'roller', 'roller');
  child(lever, 'rodPin', 'valvePin');
  g.add(lever);

  // 밸브 막대 — 위 눈을 지레의 막대 핀(깊이 0.57)에 건다
  const Z_PIN = K150.zBar + 0.07; // 0.57 (valvePin 층)
  const valveRod = hangRod(K150.rod);
  valveRod.name = 'valveRod';
  g.add(valveRod);

  // 막대 안내 고리(판화에 없음 — 최소 보충): 구멍이 세로, 뒤판 팔이 받친다
  g.add(wallBearing(K150.guide[0], K150.guide[1], Z_PIN, 'y', 0.04));

  // 회전 방향 화살표(반시계, 축 끝 너트 둘레 — 캠을 가리지 않는 크기)
  const arrow = rotArrow(0.2, true);
  arrow.position.set(K150.S[0], K150.S[1], 0.68);
  g.add(arrow);

  // 이름표 4개 — '굴림 바퀴와 지레'·'밸브 막대'는 움직이는 부품을 따라간다
  const tagCam = tag('캠 묶음(구동)', v(-1.25, 0.8, 0.5));
  const tagRoller = tag('굴림 바퀴와 지레', v(0, 0, 0.6));
  const tagRod = leaderTo(tag('밸브 막대', v(0, 0, 0.6)), valveRod);
  const tagPivot = leaderTo(tag('지레 받침', v(1.55, 2.25, 0.6)), 'pivotShaft');
  g.add(tagCam, tagRoller, tagRod, tagPivot);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const s = valve150(th);
    camShaft.rotation.z = s.a;
    camStack.rotation.z = s.a;
    camStack.position.z = s.z;
    stack.setActive(s.k);
    lever.rotation.z = s.alpha;
    const d = K150.rb + K150.rr + s.rise; // 바퀴 중심 ~ 캠 축 거리 — 굴름 표시(돌아 보이게만)
    roller.rotation.z = -(d / K150.rr) * s.a;
    const pin = leverPoint(K150.Q, s.alpha, K150.pinAt);
    valveRod.position.set(pin[0], pin[1], Z_PIN);
    valveRod.rotation.z = rodAim(pin, K150.guide);
    const rc = leverPoint(K150.Q, s.alpha, K150.L); // 굴림 바퀴 중심
    tagRoller.position.set(rc[0] - 0.25, rc[1] + 0.45, 0.6);
    tagRod.position.set(pin[0] + 0.62, pin[1] - 0.75, 0.6);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [1.8, 2.5, 6.2], target: [0, 1.55, 0.1] },
    notes: () => {
      const s = valve150(theta);
      const camName = ['작은 캠(양정 0.065)', '가운데 캠(0.165)', '큰 캠(양정 0.265)'][s.k] ?? '';
      return [
        { label: '지금 닿는 캠', value: camName },
        { label: '굴림 바퀴 오름', value: s.rise.toFixed(3) },
        { label: '밸브 막대 행정', value: '큰 0.151 · 가운데 0.095 · 작은 0.038' },
        { label: '캠 축 회전수', value: '1.6 rad/s ≈ 15 rpm' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
