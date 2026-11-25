// 164 무릎 지레 — 수평 팔을 올리면 무릎 B 가 내려가며 봉이 곧게 서서 램을 큰 힘으로 누른다 (판화 164번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { K164, bracket164, guide164, lever164, pose164, ram164, strut164, swingArrow164 } from '../kit/k164';

const DEG = 180 / Math.PI;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM164(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 천장 들보 + 지게대(고정, 핀 A)
  const bracket = bracket164();
  bracket.position.set(K164.ax, K164.ay, 0);
  bracket.name = 'bracket';
  g.add(bracket);

  // 무릎 지레(핀 A 둘레로 흔들림)
  const lever = lever164();
  lever.name = 'lever';
  lever.position.set(K164.ax, K164.ay, K164.zL);
  g.add(lever);

  // 압축 봉(핀 B — 핀 P)
  const strut = strut164();
  strut.name = 'strut';
  g.add(strut);

  // 누름 블록(램) + 모루·안내(고정)
  const ram = ram164();
  ram.name = 'ram';
  const guide = guide164();
  guide.name = 'guide';
  guide.position.set(K164.xs, 0, 0);
  g.add(ram, guide);

  // 흔들림 화살표 — 팔 끝 바깥 호(핀 A 중심, 반지름 2.1, 팔 끝 흔들림 범위)
  const p0 = pose164(K164.phase);
  const a0 = Math.atan2(p0.tipArm[1] - K164.ay, p0.tipArm[0] - K164.ax);
  const arrow = swingArrow164(2.12, a0 - K164.amp, a0 + K164.amp);
  arrow.position.set(K164.ax, K164.ay, K164.zL);
  g.add(arrow);

  // 이름표 5개('무릎 지레'·'누름 블록'은 따라간다)
  const leverTag = leaderTo(tag('무릎 지레(손잡이)', v(1.3, 3.1, 0.3)), lever);
  const ramTag = leaderTo(tag('누름 블록(램)', v(0.75, 0.5, 0.35)), ram);
  const strutTag = leaderTo(tag('압축 봉', v(-1.25, 1.45, 0.3)), strut);
  g.add(
    leaderTo(tag('천장 지게대(고정)', v(-1.35, 3.0, 0.3)), bracket),
    leverTag,
    strutTag,
    ramTag,
    leaderTo(tag('모루·안내(고정)', v(-1.45, 0.45, 0.35)), guide)
  );

  const apply = (): void => {
    const P = pose164(theta);
    lever.rotation.z = P.u;
    strut.position.set(P.B[0], P.B[1], K164.zS);
    strut.rotation.z = P.strut;
    ram.position.set(K164.xs, P.py - K164.pinUp, 0);
    strutTag.position.x = -1.25 + (P.B[0] - p0.B[0]);
    ramTag.position.y = 0.5 + P.lift;
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.65, 0] },
    notes: () => {
      const P = pose164(theta);
      // 무릎 각 = B→A 와 B→P 사이 각
      const ax = K164.ax - P.B[0];
      const ay = K164.ay - P.B[1];
      const bx = K164.xs - P.B[0];
      const by = P.py - P.B[1];
      const knee = Math.acos((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))) * DEG;
      return [
        { label: '지레 각', value: `${(P.u * DEG).toFixed(1)}° (±12°)` },
        { label: '램 높이', value: `모루 위 ${P.lift.toFixed(3)} (행정 0.066)` },
        { label: '무릎 각', value: `${knee.toFixed(1)}° — 180°에 가까울수록 누르는 힘이 커짐` },
        { label: '구동', value: '수평 팔을 올리면 누르고, 내리면 램이 들림' }
      ];
    },
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
