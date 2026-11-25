// 073 스프링 래칫 간헐 회전 — 구동 원판 D 의 굽은 스프링 B 가 센 스프링 C 에 눌려 래칫 바퀴 A 를 한 바퀴에 한 이씩 민다 (판화 73번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { CatchSpring73, K73, driveDisc73, ratchet73State, ratchetWheel73, springPost73, stopSpring73 } from '../kit/k071';

const OX = 0.3;
const OY = 1.9;
const D2R = Math.PI / 180;

// ── 센 스프링 C 의 끝이 늘 래칫 A 에 닿게(사용자 지적: "스프링이 래칫에 닿아 있어야 함") ──
// 키트 표는 걸쇠가 C 를 들어 올리는 동안의 휨만 주고, 쉴 때는 끝이 반지름 0.66 에 떠 있어 이 등(약 0.57)과 0.09 떨어져 보였다.
// C 는 받침에 물린 자리 Q 둘레로 휜다(psi, 반시계 = 끝이 바깥으로). 끝이 A 의 톱니 윤곽 위에 앉는 psi 를 매 프레임 풀고,
// 걸쇠가 들어 올리는 휨과 비교해 더 바깥쪽(큰 쪽)을 쓴다.
const TIP0: [number, number] = [K73.tipR * Math.cos(K73.tipDeg * D2R) - K73.q[0], K73.tipR * Math.sin(K73.tipDeg * D2R) - K73.q[1]];
const CLEAR = 0.003;
/** A 로컬 각(도)에서의 톱니 윤곽 반지름 — 절벽 면이 36° 마다, 등은 반시계로 높아진다(키트 ratchetOutline73 과 같은 식) */
function toothR(localDeg: number): number {
  const a = ((localDeg % 36) + 36) % 36;
  return K73.rRoot + ((K73.rTip - K73.rRoot) * a) / 36;
}
/** psi 만큼 휜 C 끝의 바퀴 중심 기준 좌표 */
function tipAt(psi: number): [number, number] {
  const c = Math.cos(psi);
  const sn = Math.sin(psi);
  return [K73.q[0] + TIP0[0] * c - TIP0[1] * sn, K73.q[1] + TIP0[0] * sn + TIP0[1] * c];
}
/** 끝이 A(회전 aRot rad) 윤곽 위 CLEAR 에 앉는 psi */
function surfacePsi(aRot: number): number {
  const gap = (psi: number): number => {
    const [x, y] = tipAt(psi);
    const ang = Math.atan2(y, x) - aRot;
    return Math.hypot(x, y) - (toothR(ang / D2R) + CLEAR);
  };
  let lo = -0.4;
  let hi = 0.3;
  if (gap(lo) > 0) return lo;
  if (gap(hi) < 0) return hi;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) < 0) lo = mid;
    else hi = mid;
  }
  return hi;
}

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
    C.rotation.z = Math.max(st.bladeRot, surfacePsi(st.aRot));
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
