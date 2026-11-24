// 046 퓨지 체인과 태엽통 — 왼쪽 태엽통(곧은 원통)에 감긴 체인이 앞쪽으로 건너가 오른쪽 퓨지(나선 계단 원뿔)에 감긴다 (판화 46번)
// 태엽이 풀리며 힘이 줄어드는 만큼 체인이 퓨지의 더 큰 반지름에 걸려, 힘 × 반지름이 늘 같다.
// 부품·체인 경로·운동식은 모두 kit/gear6.ts 의 fuseeSystem 이 만든다. 모델은 풀림각 ψ 와 표시만 맡는다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { fuseeSystem, wallBearing, type FuseeState } from '../kit/gear6';

const XB = -0.85; // 태엽통 축 x
const XF = 0.85; // 퓨지 축 x
const ZC = 0.3; // 두 축의 깊이
const PERIOD = 18.56; // 풀림 → 멈춤 → 되감기 → 멈춤 한 주기(theta)
const T_RUN = 11.31; // 시계가 가는 구간 끝(ψ = 2·c)
const T_HOLD = 12.11; // 다 풀린 채 멈춤 끝
const T_WIND = 17.76; // 열쇠로 감는 구간 끝(ψ 가 4배 빠르게 줄어듦)

type Phase = '시계가 가는 중(태엽이 풀림)' | '다 풀림' | '열쇠로 감는 중' | '다 감김';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const mod = (a: number, n: number): number => ((a % n) + n) % n;

export default function buildM046(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const sys = fuseeSystem({ xBarrel: XB, xFusee: XF, zc: ZC });
  g.add(sys.group);
  const psiMax = sys.psiMax;

  // 축받이 4개(판화에 없음 — 보충): 뒤판에서 나와 위·아래 축을 감싼다
  for (const x of [XB, XF]) {
    for (const y of [1.96, 0.93]) g.add(wallBearing(x, y, ZC, 'y', 0.052));
  }

  // 회전 방향 화살표(위에서 보아 시계 방향 — 풀릴 때 두 축이 같은 방향)
  for (const x of [XB, XF]) {
    const a = rotArrow(0.42, false);
    a.rotation.x = -Math.PI / 2;
    // 호의 빈 곳(110°)을 뒤판 쪽(−z)으로 돌려, 화살표가 축받이 팔을 뚫지 않게 한다
    a.rotation.z = (98 * Math.PI) / 180;
    a.position.set(x, 1.93, ZC);
    g.add(a);
  }

  g.add(
    tag('태엽통(태엽이 안에 있음)', v(XB, 2.35, 0.4)),
    tag('퓨지(계단 원뿔 도르래)', v(XF, 2.45, 0.4)),
    tag('체인', v(0, 0.95, 0.7)),
    tag('체인이 걸린 반지름', v(1.68, 1.4, 0.45))
  );

  /** 누적 theta → 퓨지 풀림각 ψ 와 상태(절대 자세) */
  const psiOf = (th: number): { psi: number; phase: Phase } => {
    const c = mod(th, PERIOD);
    if (c < T_RUN) return { psi: Math.min(psiMax, 2 * c), phase: '시계가 가는 중(태엽이 풀림)' };
    if (c < T_HOLD) return { psi: psiMax, phase: '다 풀림' };
    if (c < T_WIND) return { psi: Math.max(0, psiMax - 4 * (c - T_HOLD)), phase: '열쇠로 감는 중' };
    return { psi: 0, phase: '다 감김' };
  };

  let phase: Phase = '다 감김';
  let st: FuseeState = sys.set(0);
  const apply = (): void => {
    const p = psiOf(theta);
    phase = p.phase;
    st = sys.set(p.psi);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '태엽 힘(감겼을 때 = 100%)', value: `${(st.force * 100).toFixed(0)}%` },
      { label: '체인이 걸린 퓨지 반지름(감긴 상태 = 1)', value: (st.rExit / 0.245).toFixed(2) },
      { label: '힘 × 반지름', value: `≈ ${st.torque.toFixed(2)} (일정)` },
      { label: '상태', value: phase },
      { label: '태엽통에 감긴 체인', value: `${st.barrelTurns.toFixed(1)}바퀴` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
