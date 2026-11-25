// 181 비스듬한 걸쇠 밸브 장치 1 — 피스톤 막대의 태핏이 손잡이를 치면 비스듬한 걸쇠가 그 손잡이를 잡고 다른 손잡이를 풀어
// 증기·배기 밸브가 한꺼번에 바뀐다. 피스톤이 올라가는 순간(아래 손잡이 수평, 위 손잡이는 걸쇠에 걸려 눌림) (판화 181번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import {
  K181,
  VALVES181,
  catch181,
  gear181,
  handle181,
  plugRod181,
  rodGuide181,
  stud181,
  valveChest181,
  valveLink181,
  valveOpen181,
  valvePose181,
  valveSpec181,
  valveSpindle181
} from '../kit/k181';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
/** 시작 위상: t = 1 에 u = 1.6(피스톤이 행정 가운데를 올라가는 중 — 판화 181 자세) */
const PHASE = 0;

export default function buildM181(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정 축 셋(위·아래 손잡이 축, 걸쇠 축)
  g.add(stud181(K181.U[0], K181.U[1], 0.125), stud181(K181.L[0], K181.L[1], 0.125), stud181(K181.C[0], K181.C[1], 0.23));

  // 손잡이 뭉치 둘
  const hU = handle181('U');
  hU.name = 'handleU';
  hU.position.set(K181.U[0], K181.U[1], 0);
  const hL = handle181('L');
  hL.name = 'handleL';
  hL.position.set(K181.L[0], K181.L[1], 0);
  g.add(hU, hL);

  // 비스듬한 걸쇠
  const cat = catch181();
  cat.name = 'catch';
  cat.position.set(K181.C[0], K181.C[1], K181.zK);
  g.add(cat);

  // 피스톤 막대(태핏 둘) + 안내 둘
  const rod = plugRod181();
  rod.name = 'plugRod';
  g.add(rod, rodGuide181(1.55), rodGuide181(2.05));

  // 밸브 셋: 상자(고정) + 막대 + 심축·원판
  const valves = VALVES181.map((q) => {
    const chest = valveChest181(q);
    const link = valveLink181(q);
    link.name = `${q.key}Link`;
    const sp = valveSpindle181(q);
    sp.name = q.key;
    g.add(chest, link, sp);
    return { q, link, sp, s: valveSpec181(q) };
  });

  // 이름표
  const catchTag = leaderTo(tag('비스듬한 걸쇠', v(1.45, 1.95, 0.35)), 'catch');
  const valveTag = leaderTo(tag('밸브 막대·밸브', v(1.55, 0.75, 0.35)), 'valveU');
  const rodTag = leaderTo(tag('피스톤 막대·태핏', v(-1.5, 1.6, 0.35)), 'plugRod');
  g.add(
    leaderTo(tag('위 손잡이', v(-1.35, 2.95, 0.35)), 'handleU'),
    leaderTo(tag('아래 손잡이', v(-1.75, 0.95, 0.35)), 'handleL'),
    catchTag,
    valveTag,
    leaderTo(tag('뒷추', v(1.25, 2.95, 0.35)), 'handleU'),
    rodTag
  );

  let st = gear181(PHASE);
  const apply = (): void => {
    st = gear181(theta + PHASE);
    rod.position.set(K181.XR, st.rodY, 0);
    rodTag.position.set(-1.5, st.rodY + 1.25, 0.35);
    hU.rotation.z = -st.aU;
    hL.rotation.z = -st.aL;
    cat.rotation.z = st.gam;
    // 걸쇠 이름표는 걸쇠 각을 따라 조금 오르내린다(걸쇠가 움직이는 것을 따라감)
    catchTag.position.set(1.45, 1.95 + 1.2 * st.gam, 0.35);
    for (const { q, link, sp, s } of valves) {
      const a = q.shaft === 'U' ? st.aU : st.aL;
      const p = valvePose181(q, a, s.sp);
      link.position.set(p.pin[0], p.pin[1], 0);
      link.rotation.z = Math.atan2(p.J[0] - p.pin[0], -(p.J[1] - p.pin[1]));
      sp.position.set(p.J[0], p.J[1], 0);
      if (q.key === 'valveU') valveTag.position.set(1.55, p.J[1] - 0.3, 0.35);
    }
  };
  apply();

  const open = (key: string): boolean => {
    const q = VALVES181.find((x) => x.key === key);
    if (!q) return false;
    return valveOpen181(q, q.shaft === 'U' ? st.aU : st.aL) > 0.5;
  };

  return {
    group: g,
    notes: () => [
      { label: '피스톤', value: st.up ? '올라감 ↑' : '내려감 ↓' },
      { label: '위 증기·아래 배기 밸브', value: open('valveU') ? '열림' : '닫힘' },
      { label: '아래 증기·위 배기 밸브', value: open('valveLR') ? '열림' : '닫힘' },
      { label: '걸쇠가 잡은 손잡이', value: st.gam > K181.dGam / 2 ? '위 손잡이(눌림)' : '아래 손잡이(들림)' },
      { label: '원리', value: '태핏이 손잡이를 치면 걸쇠가 그 손잡이를 잡고 다른 손잡이를 놓아 밸브 넷이 한꺼번에 바뀐다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.7, 6.4], target: [0, 1.65, 0] }
  };
}
