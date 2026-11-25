// 182 비스듬한 걸쇠 밸브 장치 2 — 181 과 같은 손잡이 장치가 피스톤이 맨 위에 온 순간: 아래 손잡이는 들려 걸쇠에 걸리고, 위 손잡이는 풀려
// 뒷추에 끌려 수평으로 올라왔다. 내려가는 막대의 위 태핏이 위 손잡이를 치면 걸쇠와 손잡이가 181 자세로 넘어간다 (판화 182번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import {
  K182,
  VALVES182,
  catch182,
  gear182,
  handle182,
  plugRod182,
  rodGuide182,
  stud182,
  valveChest182,
  valveLink182,
  valveOpen182,
  valvePose182,
  valveSpec182,
  valveSpindle182
} from '../kit/k182';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
/** 시작 위상: t = 1 에 u = π + 0.35(피스톤이 맨 위를 막 지나 내려가기 시작 — 판화 182 자세) */
const PHASE = Math.PI + 0.35 - 1.6;

export default function buildM182(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정 축 셋(위·아래 손잡이 축, 걸쇠 축)
  g.add(stud182(K182.U[0], K182.U[1], 0.125), stud182(K182.L[0], K182.L[1], 0.125), stud182(K182.C[0], K182.C[1], 0.23));

  // 손잡이 뭉치 둘
  const hU = handle182('U');
  hU.name = 'handleU';
  hU.position.set(K182.U[0], K182.U[1], 0);
  const hL = handle182('L');
  hL.name = 'handleL';
  hL.position.set(K182.L[0], K182.L[1], 0);
  g.add(hU, hL);

  // 비스듬한 걸쇠
  const cat = catch182();
  cat.name = 'catch';
  cat.position.set(K182.C[0], K182.C[1], K182.zK);
  g.add(cat);

  // 피스톤 막대(태핏 둘) + 안내 둘
  const rod = plugRod182();
  rod.name = 'plugRod';
  g.add(rod, rodGuide182(1.55), rodGuide182(2.05));

  // 밸브 셋: 상자(고정) + 막대 + 심축·원판
  const valves = VALVES182.map((q) => {
    const chest = valveChest182(q);
    const link = valveLink182(q);
    link.name = `${q.key}Link`;
    const sp = valveSpindle182(q);
    sp.name = q.key;
    g.add(chest, link, sp);
    return { q, link, sp, s: valveSpec182(q) };
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

  let st = gear182(PHASE);
  const apply = (): void => {
    st = gear182(theta + PHASE);
    rod.position.set(K182.XR, st.rodY, 0);
    rodTag.position.set(-1.5, st.rodY + 1.25, 0.35);
    hU.rotation.z = -st.aU;
    hL.rotation.z = -st.aL;
    cat.rotation.z = st.gam;
    // 걸쇠 이름표는 걸쇠 각을 따라 조금 오르내린다(걸쇠가 움직이는 것을 따라감)
    catchTag.position.set(1.45, 1.95 + 1.2 * st.gam, 0.35);
    for (const { q, link, sp, s } of valves) {
      const a = q.shaft === 'U' ? st.aU : st.aL;
      const p = valvePose182(q, a, s.sp);
      link.position.set(p.pin[0], p.pin[1], 0);
      link.rotation.z = Math.atan2(p.J[0] - p.pin[0], -(p.J[1] - p.pin[1]));
      sp.position.set(p.J[0], p.J[1], 0);
      if (q.key === 'valveU') valveTag.position.set(1.55, p.J[1] - 0.3, 0.35);
    }
  };
  apply();

  const open = (key: string): boolean => {
    const q = VALVES182.find((x) => x.key === key);
    if (!q) return false;
    return valveOpen182(q, q.shaft === 'U' ? st.aU : st.aL) > 0.5;
  };

  return {
    group: g,
    notes: () => [
      { label: '피스톤', value: st.up ? '올라감 ↑' : '내려감 ↓' },
      { label: '위 증기·아래 배기 밸브', value: open('valveU') ? '열림' : '닫힘' },
      { label: '아래 증기·위 배기 밸브', value: open('valveLR') ? '열림' : '닫힘' },
      { label: '걸쇠가 잡은 손잡이', value: st.gam > K182.dGam / 2 ? '위 손잡이(눌림)' : '아래 손잡이(들림)' },
      { label: '원리', value: '태핏이 손잡이를 치면 걸쇠가 그 손잡이를 잡고 다른 손잡이를 놓아 밸브 넷이 한꺼번에 바뀐다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.7, 6.4], target: [0, 1.65, 0] }
  };
}
