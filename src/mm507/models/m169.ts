// 169 링크로 이은 크랭크 — 168 에서 홈 대신 짧은 링크로 피트먼 끝(타원 궤도)을 주축 크랭크에 이었다.
//  설계표 docs/mm507-sheets/169.md · 부품은 kit/k168(피트먼·크랭크·흔들이 막대)과 kit/k169(링크·식).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { crank2, fixedPin, ghostPaths, pitman168, rocker168, topPin } from '../kit/k168';
import { K169, link169, pose169 } from '../kit/k169';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM169(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const F = K169.four;
  const O = K169.O1;

  g.add(displayStand());
  g.add(ghostPaths(F, O, K169.R1));

  const axisMain = fixedPin(O[0], O[1], 0.045, 0.128, 0.065, 0.02);
  axisMain.name = 'axisMain';
  const axis2 = fixedPin(F.S2[0], F.S2[1], 0.045, 0.128, 0.065, 0.02);
  axis2.name = 'axis2';
  const hPin = topPin(F.H[0], F.H[1]);
  hPin.name = 'hPin';
  g.add(axisMain, axis2, hPin);

  // 주축 크랭크(핀이 링크 눈까지 올라온다) · 둘째 크랭크 · 피트먼(P1 핀 없음 — 링크가 가진다) · 링크 · 흔들이 막대
  const crank1 = crank2(K169.R1, 0.265);
  crank1.name = 'crank1';
  crank1.position.set(O[0], O[1], 0);
  const crankB = crank2(F.r2);
  crankB.name = 'crank2';
  crankB.position.set(F.S2[0], F.S2[1], 0);
  const pitman = pitman168(F, { slotPin: false });
  pitman.name = 'pitman';
  const link = link169();
  link.name = 'link';
  const rocker = rocker168(F.Lr);
  rocker.name = 'rocker';
  rocker.position.set(F.H[0], F.H[1], 0);
  g.add(crank1, crankB, pitman, link, rocker);

  const arrowMain = rotArrow(0.2, true);
  arrowMain.position.set(O[0], O[1], 0.3);
  const arrow2 = rotArrow(0.2, true);
  arrow2.position.set(F.S2[0], F.S2[1], 0.3);
  g.add(arrowMain, arrow2);

  const tagMain = tag('주축 크랭크', v(O[0], 0.78, 0.3));
  const tagCrank2 = tag('둘째 크랭크', v(F.S2[0], 0.95, 0.3));
  const tagPitman = tag('피트먼', v(-1.4, 1.2, 0.3));
  const tagRocker = tag('흔들이 막대', v(-0.65, 2.5, 0.3));
  const tagLink = tag('링크', v(1.4, 2.7, 0.3));
  g.add(tagMain, tagCrank2, tagPitman, tagRocker, tagLink);

  const pose = (th: number): void => {
    const p = pose169(th);
    crank1.rotation.z = p.psi;
    crankB.rotation.z = p.phi;
    pitman.position.set(p.c.P1[0], p.c.P1[1], 0);
    pitman.rotation.z = p.c.beta;
    link.position.set(p.Q[0], p.Q[1], 0);
    link.rotation.z = p.gamma;
    rocker.rotation.z = p.c.rock;
    tagPitman.position.set(p.c.P3[0] + 0.05, p.c.P3[1] - 0.3, 0.3);
    tagRocker.position.set((F.H[0] + p.c.P3[0]) / 2 + 0.75, (F.H[1] + p.c.P3[1]) / 2 + 0.25, 0.3);
    tagLink.position.set((p.Q[0] + p.c.P1[0]) / 2, Math.max(p.Q[1], p.c.P1[1]) + 0.5, 0.3);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const p = pose169(theta);
      return [
        { label: '주축 크랭크 각', value: `${(((p.psi * DEG) % 360) + 360) % 360 | 0}°` },
        { label: '둘째 크랭크 각', value: `${(((p.phi * DEG) % 360) + 360) % 360 | 0}°` },
        { label: '링크 길이 / 주축 반지름', value: `${K169.Lk} / ${K169.R1}` },
        { label: '설명', value: '168 의 홈 대신 짧은 링크가 피트먼 끝(타원 궤도)을 크랭크에 이어, 같은 타원 효과를 얻는다' },
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    },
  };
}
