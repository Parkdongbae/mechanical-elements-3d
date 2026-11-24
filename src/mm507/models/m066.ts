// 066 추를 이용한 점프 운동 — 웜기어 B 는 쉬지 않고 돌고, 속 빈 축에 붙은 추 달린 팔이 핀에 올려졌다가 꼭대기에서 떨어진다 (판화 66번)
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { displayStand, rod, rotArrow, shaftZ, tag, wormScrew, wormWheel, STAGE } from '../kit';
import { armWeight } from '../kit/k065';
import { halfCutTube } from '../kit/k067';
import { castIron, darkSteel } from '../../models/materials';
import { extrude, mesh, roundedRect } from '../../models/parts/geom';

const TAU = Math.PI * 2;
const OX = 0;
const OY = 1.75; // 웜기어 축 중심
const WORM_Y = OY - 0.72; // 웜 축 높이 1.03
const SPEED = 0.8; // B 의 각속도(rad/s)
const DELTA = 0.025 / 0.13; // 핀 반각
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 뒤판에 붙은 축받이 블록 */
function bearingBlock(x: number): THREE.Mesh {
  const depth = 0.09 - STAGE.backZ;
  const geo = extrude(roundedRect(-0.09, -0.11, 0.09, 0.11, 0.025), depth, 0.01);
  const m = mesh(geo, castIron());
  m.position.set(x, WORM_Y, STAGE.backZ + depth / 2);
  return m;
}

/** 팔 각 α (맨 아래에서 반시계) 와 주기 변수 c 로 단계 구하기 */
function armAngle(c: number): { alpha: number; phase: string } {
  if (c < Math.PI) return { alpha: c, phase: '올림' };
  if (c < Math.PI + 0.6) {
    const u = (c - Math.PI) / 0.6;
    return { alpha: Math.max(c, Math.PI + Math.PI * (1 - Math.cos((Math.PI * u) / 2))), phase: '떨어짐' };
  }
  const s = c - (Math.PI + 0.6);
  return { alpha: TAU + 0.3 * Math.exp(-s / 0.25) * Math.sin(12 * s), phase: '쉼' };
}

export default function buildM066(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // B 의 누적 각 ψ

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

  // 웜기어 축, 웜 축 막대, 축받이, 손잡이 고리
  // 축 끝 너트(두께 0.081)를 핀(z 0.585~0.635)·속 빈 축(z 0.56~0.66) 앞으로 — z1 0.68 이면 너트가 핀과 속 빈 축 자리에 겹쳤다
  const shaft = shaftZ(OX, OY, 0.75, 0.09);
  shaft.name = 'shaftB';
  g.add(shaft);
  g.add(rod(v(-0.55, WORM_Y, 0), v(0.6, WORM_Y, 0), 0.045), bearingBlock(-0.42), bearingBlock(0.42));
  const ring = mesh(new THREE.TorusGeometry(0.05, 0.012, 10, 24), darkSteel());
  ring.rotation.y = Math.PI / 2;
  ring.position.set(0.6, WORM_Y, 0);
  g.add(ring);

  // 핀: 웜기어 축에 박힘
  const pinGroup = new THREE.Group();
  pinGroup.name = 'pin';
  pinGroup.position.set(OX, OY, 0.61);
  const pinBox = mesh(new THREE.BoxGeometry(0.11, 0.05, 0.05), darkSteel());
  pinBox.position.set(0.135, 0, 0);
  pinGroup.add(pinBox);
  g.add(pinGroup);

  // 팔 + 추 D + 반쯤 잘린 속 빈 축 (같은 그룹, 축 위에서 헐겁게 돈다)
  const armGroup = new THREE.Group();
  armGroup.name = 'armD';
  armGroup.position.set(OX, OY, 0.5);
  armGroup.add(armWeight(1.05, 0.27, 0.06));
  const hollow = halfCutTube(0.1, 0.16, 0.1, 0.56, 0.66, Math.PI / 2);
  hollow.name = 'hollow';
  hollow.position.z = -0.5;
  armGroup.add(hollow);
  g.add(armGroup);

  // 회전 화살표
  const ab = rotArrow(0.45, true);
  ab.position.set(OX, OY, 0.12);
  const aw = rotArrow(0.2, true);
  aw.rotation.y = Math.PI / 2;
  aw.position.set(0.75, WORM_Y, 0);
  g.add(ab, aw);

  // 이름표는 늘 위에 그려지므로 추가 도는 고리띠(O 에서 반지름 0.78 ~ 1.32) 밖, 네 귀퉁이·오른쪽 가에 둔다
  g.add(
    tag('웜(구동)', v(1.3, 0.45, 0.3)),
    tag('웜기어 B(천천히 계속 돈다)', v(-1.45, 0.45, 0.3)),
    tag('추 D 달린 팔(속 빈 축에 고정)', v(1.4, 2.95, 0.6)),
    tag('핀(웜기어 축에 박힘)', v(-1.4, 2.95, 0.6)),
    tag('반쯤 잘린 속 빈 축', v(1.72, 2.35, 0.5))
  );

  let alphaNow = 0;
  let pNow = 0;
  let phaseNow = '올림';
  function pose(): void {
    worm.rotation.x = 24 * theta;
    wheel.rotation.z = theta + Math.PI / 2 - Math.PI / 24;
    const c = (((theta + 2.1) % TAU) + TAU) % TAU;
    const { alpha, phase } = armAngle(c);
    alphaNow = alpha;
    phaseNow = phase;
    armGroup.rotation.z = alpha - Math.PI / 2;
    pNow = c - DELTA;
    pinGroup.rotation.z = pNow;
  }
  pose();

  const deg = (r: number): string => `${Math.round((((r * 180) / Math.PI) % 360 + 360) % 360)}°`;
  return {
    group: g,
    notes: () => [
      { label: '한 주기', value: '웜기어 한 바퀴 = 올림(반 바퀴) → 떨어짐 → 쉼' },
      { label: '지금 단계', value: phaseNow },
      { label: '각도', value: `팔 ${deg(alphaNow)} · 핀 ${deg(pNow)}` },
      { label: '속도비', value: '웜 24바퀴에 웜기어 1바퀴' }
    ],
    update(dt: number, speed: number): void {
      theta += SPEED * speed * dt;
      pose();
    }
  };
}
