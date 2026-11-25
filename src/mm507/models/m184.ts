// 184 사분원 걸쇠 장치 2 — 183 과 같은 사분원 장치가 피스톤이 맨 위에 온 순간: 아래 손잡이는 들려 그 사분원 끝 핀이 위 사분원 호 위에 얹히고,
// 위 손잡이는 풀려 뒷추에 끌려 수평으로 올라왔다. 내려가는 막대의 위 태핏이 위 손잡이를 누르면 호 끝이 핀을 놓아 183 자세로 넘어간다 (판화 184번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import {
  K184,
  VALVES184,
  gear184,
  handle184,
  plugRod184,
  rodGuide184,
  stud184,
  valveChest184,
  valveLink184,
  valveOpen184,
  valvePose184,
  valveSpec184,
  valveSpindle184
} from '../kit/k184';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
/** 시작 위상: t = 1 에 u = π + 0.35(피스톤이 맨 위를 막 지나 내려가기 시작 — 판화 184 자세) */
const PHASE = Math.PI + 0.35 - 1.6;

export default function buildM184(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정 축 둘(위·아래 손잡이 축) — 사분원 층까지 나온다
  g.add(stud184(K184.U[0], K184.U[1], K184.zQU + K184.qT / 2 + 0.035), stud184(K184.L[0], K184.L[1], K184.zQL + K184.qT / 2 + 0.035));

  // 손잡이 뭉치 둘
  const hU = handle184('U');
  hU.name = 'handleU';
  hU.position.set(K184.U[0], K184.U[1], 0);
  const hL = handle184('L');
  hL.name = 'handleL';
  hL.position.set(K184.L[0], K184.L[1], 0);
  g.add(hU, hL);

  // 피스톤 막대(태핏 둘) + 안내 둘
  const rod = plugRod184();
  rod.name = 'plugRod';
  g.add(rod, rodGuide184(1.55), rodGuide184(2.05));

  // 밸브 셋: 상자(고정) + 막대 + 심축·원판
  const valves = VALVES184.map((q) => {
    const chest = valveChest184(q);
    const link = valveLink184(q);
    link.name = `${q.key}Link`;
    const sp = valveSpindle184(q);
    sp.name = q.key;
    g.add(chest, link, sp);
    return { q, link, sp, s: valveSpec184(q) };
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

  let st = gear184(PHASE);
  const apply = (): void => {
    st = gear184(theta + PHASE);
    rod.position.set(K184.XR, st.rodY, 0);
    rodTag.position.set(-1.5, st.rodY + 1.25, 0.4);
    hU.rotation.z = -st.aU;
    hL.rotation.z = -st.aL;
    // 사분원 이름표는 위 사분원을 따라 조금 오르내린다
    catchTag.position.set(1.45, 1.95 - 0.5 * st.aU, 0.4);
    for (const { q, link, sp, s } of valves) {
      const a = q.shaft === 'U' ? st.aU : st.aL;
      const p = valvePose184(q, a, s.sp);
      link.position.set(p.pin[0], p.pin[1], 0);
      link.rotation.z = Math.atan2(p.J[0] - p.pin[0], -(p.J[1] - p.pin[1]));
      sp.position.set(p.J[0], p.J[1], 0);
      if (q.key === 'valveU') valveTag.position.set(1.55, p.J[1] - 0.3, 0.4);
    }
  };
  apply();

  const open = (key: string): boolean => {
    const q = VALVES184.find((x) => x.key === key);
    if (!q) return false;
    return valveOpen184(q, q.shaft === 'U' ? st.aU : st.aL) > 0.5;
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
