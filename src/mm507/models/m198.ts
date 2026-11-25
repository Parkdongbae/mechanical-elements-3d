// 198 이음 맹글 랙 — 피니언은 제자리에서 돌고, 이 줄이 난 고리(랙)가 막대로 틀에 이어져 있어
// 피니언이 끝에 닿으면 고리가 들려 반대편 줄로 넘어간다. 틀은 네 롤러 사이로 왕복한다 (판화 198번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, pulley, rod, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { K198, PERIOD198, S198, frame198, ring198, ringBody198 } from '../kit/k198';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const ZROD = 0.025;

export default function buildM198(): MovementModel {
  const g = new THREE.Group();
  let theta = 0.5;
  g.add(displayStand());
  const K = K198;

  const frame = frame198();
  frame.name = 'frame';
  const ring = ringBody198();
  ring.name = 'ring';
  g.add(frame, ring);

  // 고정 축 + 피니언
  g.add(shaftZ(0, K.YC, 0.2, 0.032));
  const pinion = spurGear(K.N, K.m, { width: 0.08, spokes: 4, driver: true });
  pinion.name = 'pinion';
  pinion.position.set(0, K.YC, 0.1);
  g.add(pinion);

  // 롤러 4개(틀의 위·아래 가장자리를 눌러 안내)
  const rollers: { w: THREE.Group; sgn: number }[] = [];
  for (const sx of [-0.55, 0.55]) {
    for (const sy of [1, -1]) {
      const y = K.YC + sy * (K.frameH + K.rollerR + 0.004);
      g.add(shaftZ(sx, y, 0.04, 0.028));
      const w = pulley(K.rollerR, { width: 0.1, spokes: 0 });
      w.name = `roller${sx > 0 ? 'R' : 'L'}${sy > 0 ? 'U' : 'D'}`;
      w.position.set(sx, y, -0.04);
      g.add(w);
      rollers.push({ w, sgn: sy });
    }
  }

  // 막대 2개 (위·아래)
  const rods = [1, -1].map((s) => {
    const r = rod(v(0, 0, 0), v(0, K.rodLen, 0), 0.02);
    r.name = s > 0 ? 'rodU' : 'rodD';
    g.add(r);
    return { r, s };
  });

  const arrow = rotArrow(0.42, true);
  arrow.position.set(0, K.YC, 0.225);
  g.add(arrow);

  const tPin = leaderTo(tag('피니언(제자리 회전)', v(-1.5, 2.75, 0.35)), 'pinion');
  const tFrame = leaderTo(tag('틀(롤러 사이)', v(0.9, 2.75, 0.35)), 'frame');
  const tRod = leaderTo(tag('이음 막대', v(-0.5, 2.75, 0.35)), 'rodU');
  const tRing = leaderTo(tag('이 줄 고리(들림)', v(0, 0.6, 0.35)), 'ring');
  g.add(tPin, tFrame, tRod, tRing);

  let st = ring198(theta);
  const apply = (): void => {
    st = ring198(theta);
    const Lr = K.rodLen;
    const yRel = st.yr;
    const xRel = Math.sqrt(Lr * Lr - yRel * yRel) - Lr;
    const frameX = st.X - xRel;
    ring.position.set(st.X, K.YC + yRel, 0);
    frame.position.set(frameX, K.YC, 0);
    pinion.rotation.z = theta;
    for (const { r, s } of rods) {
      const a = v(frameX - K.pivX, K.YC + s * K.pivY, ZROD);
      const b = v(st.X + K.pivX, K.YC + yRel + s * K.pivY, ZROD);
      r.position.copy(a);
      r.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
    }
    for (const { w, sgn } of rollers) w.rotation.z = (sgn > 0 ? 1 : -1) * (frameX / K.rollerR);
    tFrame.position.x = frameX + 0.9;
    tRod.position.x = frameX - 0.5;
    tRing.position.x = st.X;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '고리 위치', value: `${st.X.toFixed(2)} (행정 ${S198.toFixed(2)})` },
      { label: '물린 줄', value: st.mode === 'A' ? '위 줄' : st.mode === 'B' ? '아래 줄' : '넘어가는 중(고리가 듦)' },
      { label: '한 주기', value: `피니언 ${(PERIOD198 / (2 * Math.PI)).toFixed(2)} 회전` },
      { label: '원리', value: '끝에서 막대로 이어진 고리가 들려 피니언이 반대편 줄을 물고 틀이 되돌아온다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.75, 6.5], target: [0, 1.7, 0] }
  };
}
