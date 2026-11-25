// 128 세 날개 축과 턱 달린 네모 틀 — 축이 계속 돌면 틀이 곧게 왕복 (판화 128번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { slideGuide128, toothedFrame128, wiper128, wiperStar128 } from '../kit/k128';

const CX = 0; // 축 x
const CY = 1.75; // 축 y
const Z = 0.12; // 날개·틀 가운데 평면
const PHASES = ['오른쪽으로 미는 중', '오른쪽 끝에서 멈춤', '왼쪽으로 미는 중', '왼쪽 끝에서 멈춤'];

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM128(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 세 날개 축(구동)
  const wiper = wiperStar128(0.1);
  wiper.name = 'wiper';
  wiper.position.set(CX, CY, Z);
  g.add(wiper, shaftZ(CX, CY, 0.28, 0.09));

  // 턱 달린 네모 틀(종동)
  const frame = toothedFrame128(0.12);
  frame.name = 'frame';
  frame.position.set(0, CY, Z);
  g.add(frame);

  // 안내 블록 둘(판화에 없는 보충)
  for (const sx of [-1, 1]) {
    const gd = slideGuide128(0.05, Z);
    gd.name = sx < 0 ? 'guideL' : 'guideR';
    gd.position.set(sx * 1.38, CY, Z);
    g.add(gd);
  }

  // 회전 방향 화살표(시계)
  const arrow = rotArrow(0.3, false);
  arrow.position.set(CX, CY, 0.3);
  g.add(arrow);

  // 이름표 — 위 턱·아래 턱은 틀을 따라간다
  const tagJ1 = tag('위 턱', v(0.5, 2.85, 0.3));
  const tagJ2 = tag('아래 턱', v(-0.5, 0.65, 0.3));
  g.add(leaderTo(tag('세 날개 축(구동)', v(-0.75, 2.85, 0.3)), 'wiper'), tagJ1, tagJ2, leaderTo(tag('안내 블록', v(1.75, 2.2, 0.3)), 'guideR'));

  let st = wiper128(0);
  const apply = (): void => {
    st = wiper128(theta);
    wiper.rotation.z = st.phi;
    frame.position.x = st.s;
    tagJ1.position.x = 0.5 + st.s;
    tagJ2.position.x = -0.5 + st.s;
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0.1] },
    notes: () => [
      { label: '지금 상태', value: PHASES[st.phase]! },
      { label: '틀 변위', value: `s = ${st.s >= 0 ? '+' : '−'}${Math.abs(st.s * 100).toFixed(0)} mm 꼴 (행정 0.242 가운데)` },
      { label: '원리', value: '축 한 바퀴에 틀이 3번 왕복' },
      { label: '축 회전수', value: st.turns.toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
