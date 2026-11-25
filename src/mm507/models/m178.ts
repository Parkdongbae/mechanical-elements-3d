// 178 속도를 바꾸는 홈 크랭크 — 편심된 원형 홈이 크랭크 길이를 바꿔 공구 슬라이드가 느리게 깎고 빨리 돌아온다 (판화 178번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K178, crank178, fixedDisk178, kin178, rail178, rod178, shaft178, slidePin178, toolSlide178 } from '../kit/k178';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM178(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const disk = fixedDisk178();
  disk.name = 'disk';
  disk.position.set(K178.C[0], K178.C[1], 0);
  g.add(disk);

  const shaft = shaft178();
  shaft.name = 'shaft';
  shaft.position.set(K178.S[0], K178.S[1], 0);
  g.add(shaft);

  const crank = crank178();
  crank.name = 'crank';
  crank.position.set(K178.S[0], K178.S[1], 0);
  g.add(crank);

  const pin = slidePin178();
  pin.name = 'slidePin';
  g.add(pin);

  const rod = rod178();
  rod.name = 'rod';
  g.add(rod);

  const rail = rail178(-2.05, 0.05);
  rail.name = 'rail';
  rail.position.set(0, K178.guideY, 0);
  g.add(rail);

  const slide = toolSlide178();
  slide.name = 'toolSlide';
  g.add(slide);

  // 회전 화살표 — 축 둘레(크랭크는 반시계)
  const arrow = rotArrow(0.2, true);
  arrow.position.set(K178.S[0], K178.S[1], 0.22);
  g.add(arrow);

  g.add(leaderTo(tag('고정 원판(원형 홈)', v(K178.C[0], 0.45, 0.3)), 'disk'));
  g.add(leaderTo(tag('홈 크랭크(구동)', v(K178.S[0], 0.8, 0.3)), 'crank'));
  const tagRod = leaderTo(tag('연결 막대', v(0, 2.6, 0.3)), 'rod');
  const tagSlide = leaderTo(tag('공구 슬라이드', v(0, 1.45, 0.3)), 'toolSlide');
  g.add(tagRod, tagSlide);

  let rho = 0;
  let xc = 0;
  const apply = (): void => {
    const s = kin178(theta);
    crank.rotation.z = theta;
    pin.position.set(s.P[0], s.P[1], 0);
    slide.position.set(s.xc, K178.guideY, 0);
    rod.position.set(s.xc, K178.guideY, 0);
    rod.rotation.z = s.rodAng;
    tagRod.position.set(s.xc + 0.75, K178.guideY + 0.75, 0.3);
    tagSlide.position.set(s.xc - 0.15, 1.45, 0.3);
    rho = s.rho;
    xc = s.xc;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 1.9, 6.4], target: [0, 1.7, 0.1] },
    notes: () => [
      { label: '유효 크랭크 길이', value: `${rho.toFixed(2)} (최대 ${(K178.r + K178.e).toFixed(2)} · 최소 ${(K178.r - K178.e).toFixed(2)})` },
      { label: '슬라이드 위치', value: `x = ${xc.toFixed(2)}` },
      { label: '설명', value: '핀이 홈 아래로 내려오면 크랭크가 짧아져 슬라이드가 느려진다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
