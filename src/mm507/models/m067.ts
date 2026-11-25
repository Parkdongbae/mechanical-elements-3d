// 067 텀블러를 이용한 점프 운동 — 웜기어 B 의 축에 박힌 핀 C 가 속 빈 축에 붙은 반달 추 E(텀블러)를 올렸다가 놓으면 추가 쏟아진다 (판화 67번)
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { displayStand, rod, rotArrow, shaftZ, tag, leaderTo, wormScrew, wormWheel, STAGE } from '../kit';
import { halfCutTube, tumblerCom, tumblerWeight } from '../kit/k067';
import { castIron, darkSteel } from '../../models/materials';
import { extrude, mesh, roundedRect } from '../../models/parts/geom';

const TAU = Math.PI * 2;
const OX = 0;
const OY = 1.95; // 웜기어 축 C 중심
const WORM_Y = OY - 0.72; // 웜 축 높이 1.23
const SPEED = 0.8; // B 의 각속도(rad/s)
const HOLLOW_A0 = (85 * Math.PI) / 180; // 속 빈 축 벽이 남은 시작각(E 로컬)
const PIN_Z = 0.36; // 핀 중심 z(홈통 구간)
const PIN_HALF = 0.025 / 0.13; // 핀 반각(접선 반폭 / 반지름) — 066 의 DELTA 와 같다
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 뒤판에 붙은 축받이 블록: 웜 축이 가운데를 지난다 */
function bearingBlock(x: number): THREE.Mesh {
  const depth = 0.09 - STAGE.backZ;
  const geo = extrude(roundedRect(-0.09, -0.11, 0.09, 0.11, 0.025), depth, 0.01);
  const m = mesh(geo, castIron());
  m.position.set(x, WORM_Y, STAGE.backZ + depth / 2);
  return m;
}

/** 주기 변수 c 로 추 무게중심 각 α(맨 아래 기준 반시계)와 단계 */
function tumblerAngle(c: number): { alpha: number; phase: string } {
  if (c < Math.PI) return { alpha: c, phase: '올림' };
  if (c < Math.PI + 0.6) {
    const u = (c - Math.PI) / 0.6;
    return { alpha: Math.max(c, Math.PI + Math.PI * (1 - Math.cos((Math.PI * u) / 2))), phase: '떨어짐' };
  }
  const s = c - (Math.PI + 0.6);
  return { alpha: TAU - 0.22 * Math.exp(-s / 0.3) * Math.abs(Math.sin(14 * s)), phase: '쉼' };
}

export default function buildM067(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // B 의 누적 각 ψ
  const gamma = tumblerCom().angle; // 축에서 본 무게중심 각(약 78°)

  g.add(displayStand());

  // 웜 + 웜기어 B: 031 배치(웜이 휠 위)를 Z 축으로 180° 돌린 그룹
  const set = new THREE.Group();
  set.position.set(OX, OY, 0);
  set.rotation.z = Math.PI;
  const wheel = wormWheel(24, 0.05, { width: 0.14, spokes: 6, tanLead: -0.2083 });
  wheel.name = 'wheelB';
  const worm = wormScrew(0.0575, 0.17, Math.PI * 0.05, 0.62, { driver: true });
  worm.name = 'worm';
  worm.position.set(0, 0.72, 0);
  set.add(wheel, worm);
  g.add(set);

  // 웜기어 축 C, 웜 축 막대(양끝 토막), 축받이
  const shaft = shaftZ(OX, OY, 0.48, 0.09);
  shaft.name = 'shaftC';
  g.add(shaft);
  g.add(rod(v(-0.52, WORM_Y, 0), v(0.55, WORM_Y, 0), 0.045), bearingBlock(-0.42), bearingBlock(0.42));

  // 핀 C: 축에 고정(B 와 함께 돈다)
  const pinGroup = new THREE.Group();
  pinGroup.name = 'pinC';
  pinGroup.position.set(OX, OY, PIN_Z);
  const pinBox = mesh(new THREE.BoxGeometry(0.11, 0.05, 0.05), darkSteel());
  pinBox.position.set(0.135, 0, 0);
  pinGroup.add(pinBox);
  g.add(pinGroup);

  // 추 E + 반쯤 잘린 속 빈 축(같은 그룹, 축 위에서 헐겁게 돈다)
  const tumbler = new THREE.Group();
  tumbler.name = 'tumblerE';
  tumbler.position.set(OX, OY, 0);
  const weight = tumblerWeight(0.08);
  weight.position.z = 0.26;
  tumbler.add(weight);
  const hollow = halfCutTube(0.1, 0.16, 0.07, 0.31, 0.41, HOLLOW_A0);
  hollow.name = 'hollow';
  tumbler.add(hollow);
  g.add(tumbler);

  // 회전 화살표(반시계)
  const ab = rotArrow(1.25, true);
  ab.position.set(OX, OY, 0.4);
  g.add(ab);

  g.add(
    tag('반달 추 E(텀블러, 속 빈 축에 고정)', v(-0.7, 3.15, 0.35)),
    leaderTo(tag('핀 C(축에 고정)', v(0.55, 2.5, 0.5)), 'pinC'),
    tag('웜 기어 B', v(-1.25, 1.0, 0.3)),
    tag('웜(구동)', v(-0.2, 0.62, 0.3))
  );

  let alphaNow = 0;
  let pNow = 0;
  let phaseNow = '올림';
  function pose(): void {
    worm.rotation.x = -24 * theta; // 오른나사: +X 둘레 음의 회전이어야 위쪽 접점이 +X 로 가서 웜기어가 반시계로 돈다
    wheel.rotation.z = theta + Math.PI / 2 - Math.PI / 24;
    const c = (((theta + 2.1) % TAU) + TAU) % TAU;
    const { alpha, phase } = tumblerAngle(c);
    alphaNow = alpha;
    phaseNow = phase;
    tumbler.rotation.z = (3 * Math.PI) / 2 + alpha - gamma;
    // 핀 반폭(접선 0.025, 반지름 0.13)만큼 뒤에 — 4.833 + c 면 핀 중심이 벽 끝면(a0)에 있어 핀 절반이 벽에 박혔다
    pNow = 4.833 - PIN_HALF + c;
    pinGroup.rotation.z = pNow;
  }
  pose();

  const deg = (r: number): string => `${Math.round((((r * 180) / Math.PI) % 360 + 360) % 360)}°`;
  return {
    group: g,
    notes: () => [
      { label: '한 주기', value: '웜 기어 한 바퀴 = 올림(반 바퀴) → 떨어짐 → 쉼' },
      { label: '지금 단계', value: phaseNow },
      { label: '각도', value: `추 ${deg(alphaNow)} · 핀 ${deg(pNow)}` },
      { label: '속도비', value: '웜 24바퀴에 웜 기어 1바퀴' }
    ],
    update(dt: number, speed: number): void {
      theta += SPEED * speed * dt;
      pose();
    }
  };
}
