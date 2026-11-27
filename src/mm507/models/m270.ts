// 270 풀리용 마찰 줄이는 받침 — 풀리 구멍과 고정 축 사이의 롤러 6개가 구른다.
// 손잡이 왕복(10 초, ±0.40) → 풀리 φ, 우리 ×0.737, 롤러 세계 회전 ×1.556(우리 기준 ×0.819).
// 설계표 docs/mm507-sheets/270.md · 키트 kit/k270.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { Rope, displayStand, leaderTo, ropeAround, ropeEnd, rotArrow, tag, weight } from '../kit';
import { K270, rollerPulley270, state270, type State270 } from '../kit/k270';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

const W_W = 0.2; // 추 폭
const W_H = 0.24; // 추 높이
const W_OFF = W_H / 2 + 0.1 * W_W + 0.16 * W_W; // 고리 꼭대기 = 줄 끝 (0.172)

interface Unit270 {
  cx: number;
  pulley: THREE.Group;
  cage: THREE.Group;
  rollers: THREE.Mesh[];
  rope: Rope;
  handle: THREE.Group;
  wt: THREE.Mesh;
}

export default function buildM270(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 두 풀리 세트: 왼쪽 앞판 있음(불투명), 오른쪽 투명 앞판(롤러가 보임) ──
  const mk = (cx: number, suffix: 'L' | 'R', cover: 'solid' | 'glass'): Unit270 => {
    const { stud, pulley, cage } = rollerPulley270({ cover, suffix });
    for (const o of [stud, pulley, cage]) o.position.set(cx, K270.CY, 0);
    g.add(stud, pulley, cage);
    const rollers: THREE.Mesh[] = [];
    for (let k = 0; k < 6; k++) rollers.push(cage.getObjectByName(`roller${suffix}${k}`) as THREE.Mesh);
    const rope = new Rope(0.035);
    rope.group.name = `rope${suffix}`;
    const handle = ropeEnd();
    handle.name = `handle${suffix}`;
    const wt = weight(W_W, W_H);
    wt.name = `weight${suffix}`;
    g.add(rope.group, handle, wt);
    return { cx, pulley, cage, rollers, rope, handle, wt };
  };
  const units = [mk(K270.CX[0], 'L', 'solid'), mk(K270.CX[1], 'R', 'glass')];

  // ── 화살표: 왼쪽 풀리 앞 — 줄을 당기는 동안(ṡ > 0) 반시계, 놓는 동안 시계 ──
  const arrCcw = rotArrow(0.5, true);
  const arrCw = rotArrow(0.5, false);
  arrCcw.position.set(K270.CX[0], K270.CY, 0.21);
  arrCw.position.set(K270.CX[0], K270.CY, 0.21);
  g.add(arrCcw, arrCw);

  // ── 이름표 6(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('앞 우리판', v(-1.72, 2.65, 0.3)), 'cageFrontL'),
    leaderTo(tag('풀리', v(-0.8, 3.0, 0.3)), 'pulleyBodyL'),
    leaderTo(tag('고정 축', v(0.4, 3.05, 0.3)), 'studR'),
    leaderTo(tag('롤러', v(1.7, 2.8, 0.3)), 'rollerR0'),
    leaderTo(tag('줄', v(-1.85, 0.55, 0.3)), 'ropeL'),
    leaderTo(tag('추', v(0.85, 0.4, 0.3)), 'weightR')
  );

  let st: State270 = state270(0);
  const apply = (speed: number): void => {
    st = state270(t);
    const dir = st.dir * (speed < 0 ? -1 : 1);
    arrCcw.visible = dir > 0;
    arrCw.visible = dir < 0;
    for (const u of units) {
      u.pulley.rotation.z = st.phi;
      u.cage.rotation.z = st.cage;
      for (const r of u.rollers) r.rotation.z = st.rollerRel;
      u.rope.setPath(
        ropeAround(
          { p: [u.cx - K270.R_ROPE, st.handleY] },
          [{ c: [u.cx, K270.CY], r: K270.R_ROPE, ccw: false }],
          { p: [u.cx + K270.R_ROPE, st.weightEndY] }
        )
      );
      u.handle.position.set(u.cx - K270.R_ROPE, st.handleY, 0);
      u.wt.position.set(u.cx + K270.R_ROPE, st.weightEndY - W_OFF, 0);
    }
  };
  apply(1);

  return {
    group: g,
    view: { pos: [0.3, 1.9, 5.6], target: [0, 1.55, 0] },
    notes: () => [
      { label: '풀리', value: st.phi.toFixed(2) + ' rad' },
      { label: '롤러 우리', value: '× 0.737 = R/(R + a)' },
      { label: '롤러 하나', value: '× 1.556 = R/(2b), 같은 방향' },
      { label: '원리', value: '롤러가 고정 축과 풀리 구멍 사이에서 구르므로 미끄럼 마찰 대신 구름 마찰만 남는다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply(speed);
    }
  };
}
