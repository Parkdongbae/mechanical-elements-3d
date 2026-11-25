// 125 복잡한 변형 운동 — 기어 셋의 크랭크 핀이 저울대 두 단을 거쳐 세로 막대 하나를 민다 (판화 125번, 설계표 125.md)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import {
  K125,
  barGuide125,
  beam125,
  crankGear125,
  eyeBar125,
  slideBar125,
  slotGuide125,
  solve125
} from '../kit/k125';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const GY = 0.85;
const deg = (r: number): number => (r * 180) / Math.PI;

export default function buildM125(): MovementModel {
  const K = K125;
  const g = new THREE.Group();
  let theta = K.theta0; // 시작 = 판화 자세(t = 1)

  g.add(displayStand());

  // 기어 3개(18·24·30잇수, 크랭크 핀 달림) + 축
  const gears = [0, 1, 2].map((i) => {
    const gr = crankGear125(i as 0 | 1 | 2, `pin${i + 1}`);
    gr.name = `gear${i + 1}`;
    gr.position.set(K.G[i]![0], K.G[i]![1], K.ZG);
    g.add(gr);
    return gr;
  });
  g.add(shaftZ(-0.972, GY, 0.089, 0.043));
  g.add(shaftZ(-0.216, GY, 0.102, 0.058));
  g.add(shaftZ(0.756, GY, 0.116, 0.073));

  // 막대 4개
  const mkBar = (name: string, len: number): THREE.Group => {
    const b = eyeBar125(len);
    b.name = name;
    g.add(b);
    return b;
  };
  const rod1 = mkBar('rod1', K.L1);
  const rod2 = mkBar('rod2', K.L2);
  const rod3 = mkBar('rod3', K.L3);
  const link = mkBar('link', K.Ls);

  // 저울대 2개
  const beamLower = beam125(K.lH, K.lH, K.lE, { names: ['pinE2', 'pinE3'], centerPinBack: 0.255, centerName: 'pinC' });
  beamLower.name = 'beamLower';
  const beamUpper = beam125(K.uL, K.uR, K.uE, { names: ['pinA', 'pinD'] });
  beamUpper.name = 'beamUpper';
  g.add(beamLower, beamUpper);

  // 세로 막대(출력)와 고정 안내
  const bar = slideBar125(0.64, 0.035, 0.16);
  bar.name = 'bar';
  g.add(bar);
  g.add(barGuide125(K.XB, 2.85, K.ZV, 0.035, 0.08));
  const slot = slotGuide125(0.2, 0.3);
  slot.name = 'slotGuide';
  slot.position.set(K.XG, 1.885, K.ZS);
  g.add(slot);

  // 회전 화살표(반시계·시계·반시계)
  const arrows: [number, boolean, number][] = [
    [0.11, true, -0.972],
    [0.13, false, -0.216],
    [0.15, true, 0.756]
  ];
  for (const [r, ccw, x] of arrows) {
    const a = rotArrow(r, ccw);
    a.position.set(x, GY, 0.36);
    g.add(a);
  }

  const tagBar = leaderTo(tag('세로 막대 (출력)', v(0.45, 2.98, 0.3)), 'bar');
  g.add(
    tag('구동 기어 (18잇수)', v(-1.7, 0.72, 0.3)),
    tag('기어 24·30잇수', v(1.5, 1.6, 0.3)),
    tag('아래 저울대', v(1.15, 2.1, 0.3)),
    tag('위 저울대', v(-1.4, 2.85, 0.3)),
    tagBar
  );

  let pose = solve125(theta);
  const apply = (): void => {
    pose = solve125(theta);
    gears.forEach((gr, i) => (gr.rotation.z = pose.th[i]!));
    rod1.position.set(pose.pin[0][0], pose.pin[0][1], K.ZR);
    rod1.rotation.z = pose.rod[0];
    rod2.position.set(pose.pin[1][0], pose.pin[1][1], K.ZR);
    rod2.rotation.z = pose.rod[1];
    rod3.position.set(pose.pin[2][0], pose.pin[2][1], K.ZR);
    rod3.rotation.z = pose.rod[2];
    link.position.set(pose.C[0], pose.C[1], K.ZR);
    link.rotation.z = pose.rod[3];
    beamLower.position.set(pose.C[0], pose.C[1], K.ZB);
    beamLower.rotation.z = pose.q;
    beamUpper.position.set(pose.B[0], pose.B[1], K.ZB);
    beamUpper.rotation.z = pose.p;
    bar.position.set(pose.B[0], pose.B[1], K.ZV);
    tagBar.position.set(0.45, pose.B[1] + 0.5, 0.3);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.65, 0] },
    notes: () => [
      { label: '잇수', value: '18 : 24 : 30 → 회전 1 : −0.75 : +0.6' },
      { label: '세로 막대 높이', value: `행정 0.354 가운데 ${Math.round(((pose.B[1] - 2.277) / 0.354) * 100)} %` },
      { label: '되풀이', value: `구동 20바퀴마다 같은 모양(지금 ${(theta / (2 * Math.PI)).toFixed(1)} 바퀴째)` },
      { label: '저울대 기울기', value: `아래 ${Math.round(deg(pose.q))}° · 위 ${Math.round(deg(pose.p))}°` },
      { label: '판화와 다른 점', value: '아래 저울대 가운데 핀의 세로 홈은 판화에 없음(자세를 정하려고 보탬)' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
