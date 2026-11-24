// 073 스프링 래칫 간헐 회전 — 구동 원판 D 의 굽은 스프링 B 가 센 스프링 C 에 눌려 래칫 바퀴 A 를 한 바퀴에 한 이씩 민다 (판화 73번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { CatchSpring73, K73, driveDisc73, ratchet73State, ratchetWheel73, springPost73, stopSpring73 } from '../kit/k071';

const OX = 0.3;
const OY = 1.9;
const D2R = Math.PI / 180;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM073(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 구동 원판 D (+ 자식으로 판스프링 B 와 걸쇠)
  const D = driveDisc73();
  D.name = 'discD';
  D.position.set(OX, OY, 0);
  const B = new CatchSpring73();
  D.add(B.group);
  g.add(D);

  // 래칫 바퀴 A
  const A = ratchetWheel73();
  A.name = 'ratchetA';
  A.position.set(OX, OY, 0);
  g.add(A);

  // 센 스프링 C
  const C = stopSpring73();
  C.name = 'springC';
  C.position.set(OX + K73.q[0], OY + K73.q[1], 0);
  g.add(C);

  // 고정 받침
  const post = springPost73(-1.72);
  post.position.set(OX, OY, 0);
  g.add(post);

  g.add(shaftZ(OX, OY, 0.3));

  // 회전 화살표 — D 시계
  const arr = rotArrow(0.4, false);
  arr.position.set(OX, OY, 0.26);
  g.add(arr);

  g.add(
    tag('구동 원판 D', v(1.3, 0.72, 0.3)),
    tag('래칫 바퀴 A(이 10개)', v(1.35, 3.12, 0.3)),
    tag('판스프링 B(끝에 걸쇠)', v(-0.35, 3.15, 0.3)),
    tag('센 스프링 C(걸쇠를 누르고 되돌림을 막음)', v(-1.4, 2.55, 0.35)),
    tag('고정 받침', v(-1.2, 0.5, 0.4))
  );

  let st = ratchet73State(0);
  const apply = (): void => {
    const dDeg = theta / D2R;
    D.rotation.z = -theta;
    st = ratchet73State(dDeg);
    A.rotation.z = st.aRot;
    B.set(st.headR);
    C.rotation.z = st.bladeRot;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.0, 2.0, 6.4], target: [-0.1, 1.75, 0.1] },
    notes: () => [
      { label: '이 10개', value: 'D 10바퀴에 A 1바퀴' },
      { label: '상태', value: st.pushing ? '미는 중(A 회전)' : st.u > 0 && st.u < 56 ? '걸쇠가 눌리는 중' : '쉼' },
      { label: 'A 가 돈 이 수', value: (st.advDeg / 36).toFixed(2) },
      { label: 'D 회전수', value: (theta / (2 * Math.PI)).toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
