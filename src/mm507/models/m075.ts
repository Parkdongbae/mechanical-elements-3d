// 075 왕복 운동 래칫 — 막대 C 의 위아래 왕복이 흔들 막대 D 끝의 폴 B 를 통해 톱니 바퀴 A 를 한 방향으로 간헐 회전시킨다 (판화 75번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, markPin, rod, rotArrow, shaftZ, tag } from '../kit';
import { castIron } from '../../models/materials';
import { STAGE } from '../kit/stand';
import { framePlate } from '../kit/k056';
import {
  eyeRod,
  feedState,
  followerAngle,
  pawlShape,
  ratchetPawl,
  rockerBar,
  sawWheel,
  type FeedSpec,
  type SawSpec
} from '../kit/k074';

const D2R = Math.PI / 180;
const OX = 0;
const OY = 1.7;
const SPEC: SawSpec = { teeth: 36, rOut: 0.78, rRoot: 0.71, dir: -1 };
const FEED: FeedSpec = { spec: SPEC, rPivot: 0.86, span: 36 * D2R, a0: 159.5 * D2R, steps: 2, slack: 3 * D2R };
const SX = 0.3435; // 미끄럼 핀의 세로선(O 기준)
const ROD_LEN = 0.95;
const ARM_S = 0.39;
const ANG_S = -174 * D2R;
const PHX = 0.6325;
const PHY = 2.4485;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM075(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 바퀴 A
  const wheelA = sawWheel(SPEC, { width: 0.08, ringR: 0.585, holes: 5 });
  wheelA.name = 'wheelA';
  wheelA.position.set(OX, OY, 0.04);
  g.add(wheelA);

  // 고정 축
  g.add(shaftZ(OX, OY, 0.26));

  // 흔들 막대 D
  const rockerD = new THREE.Group();
  rockerD.name = 'rockerD';
  rockerD.position.set(OX, OY, 0.13);
  rockerD.add(rockerBar(0.86, 0, ARM_S, ANG_S, { bore: 0.05 }));
  rockerD.add(rod(v(0.86, 0, -0.13), v(0.86, 0, 0.03), 0.017));
  const qx = ARM_S * Math.cos(ANG_S);
  const qy = ARM_S * Math.sin(ANG_S);
  const pinQ = new THREE.Group();
  pinQ.name = 'pinQ';
  pinQ.position.set(qx, qy, 0);
  pinQ.add(rod(v(0, 0, -0.03), v(0, 0, 0.09), 0.02));
  markPin(pinQ, [0, 0, 0.06]); // 세계 z 0.19 = 막대 C 층
  rockerD.add(pinQ);
  g.add(rockerD);

  // 폴 B (구동 폴)
  const shapeB = pawlShape(SPEC, 0.86, 36 * D2R, 0, { wBase: 0.09, wTip: 0.03 });
  const pawlB = ratchetPawl(shapeB);
  pawlB.name = 'pawlB';
  g.add(pawlB);

  // 멈춤 폴
  const shapeH = pawlShape(SPEC, 0.98, 15.5 * D2R, 0, { wBase: 0.08, wTip: 0.028 });
  const pawlHold = ratchetPawl(shapeH);
  pawlHold.name = 'pawlHold';
  pawlHold.position.set(PHX, PHY, 0.04);
  // 받침 기둥: 뒤판에서 z 0 까지. 핀은 폴 자신의 핀(반지름 0.017, z 0.00~0.086)이 기둥 윗면에 꽂힌다.
  // (공용 wallPost 의 핀 0.028 은 폴 구멍 0.018 보다 굵어 폴 판에 박혀서 쓰지 않는다)
  const postH = 0 - STAGE.backZ;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, postH), castIron());
  post.position.set(PHX, PHY, STAGE.backZ + postH / 2);
  post.castShadow = true;
  post.receiveShadow = true;
  g.add(pawlHold, post);

  // 막대 C 와 미끄럼 핀
  const rodC = eyeRod(ROD_LEN);
  rodC.name = 'rodC';
  g.add(rodC);
  const pinS = new THREE.Group();
  pinS.name = 'pinS';
  pinS.add(rod(v(0, 0, 0.1), v(0, 0, 0.215), 0.022));
  markPin(pinS, [0, 0, 0.19]);
  g.add(pinS);

  // 안내 판(보충) + 받침 막대
  const guide = framePlate(
    [[0.2435, 0.38], [0.4435, 0.38], [0.4435, 0.79], [0.2435, 0.79]],
    [{ a: [SX, 0.47], b: [SX, 0.7], r: 0.03 }],
    0.04
  );
  guide.position.z = 0.13;
  g.add(guide, rod(v(SX, 0.405, -0.3), v(SX, 0.405, 0.11), 0.03), rod(v(SX, 0.765, -0.3), v(SX, 0.765, 0.11), 0.03));

  // 시계 방향 화살표
  const arr = rotArrow(0.45, false);
  arr.position.set(OX, OY, 0.092);
  g.add(arr);

  g.add(
    tag('A 톱니 바퀴', v(-1.3, 1.05, 0.3)),
    tag('B 폴(이를 미는 갈고리)', v(-1.45, 2.65, 0.3)),
    tag('D 흔들 막대', v(-1.55, 1.9, 0.3)),
    tag('C 왕복 막대(구동)', v(1.05, 0.75, 0.3)),
    tag('멈춤 폴(되돌아가지 않게)', v(1.5, 2.7, 0.3))
  );

  let st = feedState(FEED, 0);
  const apply = (): void => {
    st = feedState(FEED, theta);
    wheelA.rotation.z = st.wheel;
    rockerD.rotation.z = st.armAngle;
    const px = OX + 0.86 * Math.cos(st.armAngle);
    const py = OY + 0.86 * Math.sin(st.armAngle);
    pawlB.position.set(px, py, 0.04);
    pawlB.rotation.z = followerAngle(SPEC, st.wheel, [px - OX, py - OY], shapeB.L, -1);
    pawlHold.rotation.z = followerAngle(SPEC, st.wheel, [PHX - OX, PHY - OY], shapeH.L, -1);
    const qwx = OX + ARM_S * Math.cos(st.armAngle + ANG_S);
    const qwy = OY + ARM_S * Math.sin(st.armAngle + ANG_S);
    const sx = OX + SX;
    const sy = qwy - Math.sqrt(ROD_LEN * ROD_LEN - (qwx - sx) * (qwx - sx));
    rodC.position.set(qwx, qwy, 0.19);
    rodC.rotation.z = Math.atan2(sy - qwy, sx - qwx);
    pinS.position.set(sx, sy, 0);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.3, 2.0, 6.4], target: [0, 1.6, 0.1] },
    notes: () => {
      const wDeg = st.w / D2R;
      const phase = !st.pushing && st.u < Math.PI ? '헛걸음' : st.pushing ? '밀기(C 내려감)' : '돌아가기(C 올라감)';
      return [
        { label: '상태', value: phase },
        { label: '한 왕복에', value: '2이(20°)' },
        { label: '지금까지 민 이 수', value: String(Math.floor(wDeg / 10 + 1e-6)) },
        { label: '긴 팔 각', value: `${(st.armAngle / D2R).toFixed(1)}°` },
        { label: '헛걸음', value: '3°' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
