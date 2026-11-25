// 183 사분원 걸쇠 장치 1 — 181 의 비스듬한 걸쇠 대신 두 손잡이 축의 사분원이 서로를 잡는다: 위 사분원 끝 핀이 아래 사분원 호 위에 얹혀
// 눌린 위 손잡이를 붙잡고, 태핏이 아래 손잡이를 들어 호 끝이 지나가면 핀이 떨어져 위 손잡이가 풀린다. 피스톤이 올라가는 순간 (판화 183번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import {
  K183,
  VALVES183,
  gear183,
  handle183,
  plugRod183,
  rodGuide183,
  stud183,
  valveChest183,
  valveLink183,
  valveOpen183,
  valvePose183,
  valveSpec183,
  valveSpindle183
} from '../kit/k183';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
/** 시작 위상: t = 1 에 u = 1.6(피스톤이 행정 가운데를 올라가는 중 — 판화 183 자세) */
const PHASE = 0;

export default function buildM183(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정 축 둘(위·아래 손잡이 축) — 사분원 층까지 나온다
  g.add(stud183(K183.U[0], K183.U[1], K183.zQU + K183.qT / 2 + 0.035), stud183(K183.L[0], K183.L[1], K183.zQL + K183.qT / 2 + 0.035));

  // 손잡이 뭉치 둘
  const hU = handle183('U');
  hU.name = 'handleU';
  hU.position.set(K183.U[0], K183.U[1], 0);
  const hL = handle183('L');
  hL.name = 'handleL';
  hL.position.set(K183.L[0], K183.L[1], 0);
  g.add(hU, hL);

  // 피스톤 막대(태핏 둘) + 안내 둘
  const rod = plugRod183();
  rod.name = 'plugRod';
  g.add(rod, rodGuide183(1.55), rodGuide183(2.05));

  // 밸브 셋: 상자(고정) + 막대 + 심축·원판
  const valves = VALVES183.map((q) => {
    const chest = valveChest183(q);
    const link = valveLink183(q);
    link.name = `${q.key}Link`;
    const sp = valveSpindle183(q);
    sp.name = q.key;
    g.add(chest, link, sp);
    return { q, link, sp, s: valveSpec183(q) };
  });

  // 이름표
  const catchTag = leaderTo(tag('위·아래 사분원', v(1.45, 1.95, 0.4)), 'handleU');
  const valveTag = leaderTo(tag('밸브 막대·밸브', v(1.55, 0.75, 0.4)), 'valveU');
  const rodTag = leaderTo(tag('피스톤 막대·태핏', v(-1.5, 1.6, 0.4)), 'plugRod');
  g.add(
    leaderTo(tag('위 손잡이', v(-1.35, 2.95, 0.4)), 'handleU'),
    leaderTo(tag('아래 손잡이', v(-1.75, 0.95, 0.4)), 'handleL'),
    catchTag,
    valveTag,
    leaderTo(tag('뒷추', v(1.25, 2.95, 0.4)), 'handleU'),
    rodTag
  );

  let st = gear183(PHASE);
  const apply = (): void => {
    st = gear183(theta + PHASE);
    rod.position.set(K183.XR, st.rodY, 0);
    rodTag.position.set(-1.5, st.rodY + 1.25, 0.4);
    hU.rotation.z = -st.aU;
    hL.rotation.z = -st.aL;
    // 사분원 이름표는 위 사분원을 따라 조금 오르내린다
    catchTag.position.set(1.45, 1.95 - 0.5 * st.aU, 0.4);
    for (const { q, link, sp, s } of valves) {
      const a = q.shaft === 'U' ? st.aU : st.aL;
      const p = valvePose183(q, a, s.sp);
      link.position.set(p.pin[0], p.pin[1], 0);
      link.rotation.z = Math.atan2(p.J[0] - p.pin[0], -(p.J[1] - p.pin[1]));
      sp.position.set(p.J[0], p.J[1], 0);
      if (q.key === 'valveU') valveTag.position.set(1.55, p.J[1] - 0.3, 0.4);
    }
  };
  apply();

  const open = (key: string): boolean => {
    const q = VALVES183.find((x) => x.key === key);
    if (!q) return false;
    return valveOpen183(q, q.shaft === 'U' ? st.aU : st.aL) > 0.5;
  };

  return {
    group: g,
    notes: () => [
      { label: '피스톤', value: st.up ? '올라감 ↑' : '내려감 ↓' },
      { label: '위 증기·아래 배기 밸브', value: open('valveU') ? '열림' : '닫힘' },
      { label: '아래 증기·위 배기 밸브', value: open('valveLR') ? '열림' : '닫힘' },
      { label: '사분원이 잡은 손잡이', value: st.up ? '위 손잡이(핀이 아래 호 위에 얹힘)' : '아래 손잡이(핀이 호 끝을 막음)' },
      { label: '원리', value: '태핏이 손잡이를 치면 사분원 호가 돌아 다른 손잡이의 핀을 놓아 밸브 넷이 한꺼번에 바뀐다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.7, 6.4], target: [0, 1.65, 0] }
  };
}
