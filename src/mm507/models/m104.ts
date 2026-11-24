// 104 웜(나사)과 미끄럼대 위의 톱니바퀴 — 나사가 돌면 바퀴가 돌고, 바퀴를 돌리면 미끄럼대가 곧게 간다 (판화 104번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rod, rotArrow, tag, wormScrew } from '../kit';
import { K104, slideBed, solidWormWheel, wallBearingX, wheelCarriage, wormDrive104, wormSection } from '../kit/k104';

const TAU = Math.PI * 2;
const CY = 1.45; // 바퀴 축 높이
const ZW = 0.1; // 바퀴·나사 가운데 평면
const WY = CY + 0.68; // 나사 축 높이
const BEDY = 0.62; // 베드 윗면

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM104(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 나사(웜) — 제자리 회전, 양 끝 축은 같이 돈다
  const worm = wormScrew(K104.wormRoot, K104.wormOuter, K104.pitch, K104.wormLen, { driver: true });
  worm.name = 'worm';
  worm.add(rod(new THREE.Vector3(-1.47, 0, 0), new THREE.Vector3(1.47, 0, 0), 0.045));
  worm.position.set(0, WY, ZW);
  g.add(worm);

  // 나사 축받이 2개(판화에 없음)
  for (const x of [-1.33, 1.33]) {
    const b = wallBearingX(ZW, 0.045);
    b.position.set(x, WY, ZW);
    g.add(b);
  }

  // 바퀴 — 루트에 두고 x 만 미끄럼대와 맞춘다
  const wheel = solidWormWheel(20, K104.m, { width: K104.wheelW, tanLead: K104.tanLead });
  wheel.name = 'wheel';
  g.add(wheel);

  // 미끄럼대(받침 블록 + 브래킷 + 바퀴 축)
  const carriage = wheelCarriage(0.83);
  carriage.name = 'carriage';
  g.add(carriage);

  // 베드(고정)
  const bed = slideBed(3.6, { h: 0.16, depth: 0.3, legH: 0.28 });
  bed.name = 'bed';
  bed.position.set(0, BEDY, ZW);
  g.add(bed);

  // 검사 표식(메시 없음)
  const section = wormSection(K104.wormRoot, K104.wormOuter, K104.pitch, K104.wormLen);
  g.add(section);

  // 회전 화살표
  const wormArrow = rotArrow(0.17, true);
  wormArrow.rotation.y = Math.PI / 2;
  wormArrow.position.set(1.52, WY, ZW);
  g.add(wormArrow);
  const wheelArrow = rotArrow(0.33, true);
  // 구간 라(바퀴를 돌려 미끄럼대가 왼쪽으로 돌아옴)에서는 바퀴가 시계로 돈다 → 시계 화살표로 바꿔 보인다
  const wheelArrowCw = rotArrow(0.33, false);
  g.add(wheelArrow, wheelArrowCw);

  // 이름표
  const wheelTag = tag('웜 바퀴', v(0, CY, 0.35));
  const carTag = tag('미끄럼대', v(0, 0.95, 0.35));
  g.add(tag('웜(나사)', v(-1.5, 2.62, 0.35)), tag('베드(고정)', v(-1.4, 0.95, 0.35)), wheelTag, carTag);

  const frac = (a: number): number => a - Math.floor(a);
  let cur = wormDrive104(0);

  const apply = (): void => {
    cur = wormDrive104(theta);
    const { phi, x, beta } = cur;
    worm.rotation.x = phi;
    carriage.position.set(x, BEDY, ZW);
    wheel.position.set(x, CY, ZW);
    wheel.rotation.z = beta;
    section.position.set(-K104.pitch * frac(phi / TAU), WY, ZW);
    wormArrow.visible = cur.mode === 'screw';
    const backWheel = cur.mode === 'wheel' && ((theta % (2 * TAU)) + 2 * TAU) % (2 * TAU) > 3 * Math.PI;
    wheelArrow.visible = !backWheel;
    wheelArrowCw.visible = backWheel;
    wheelArrow.position.set(x, CY, 0.34);
    wheelArrowCw.position.set(x, CY, 0.34);
    wheelTag.position.set(x - 1.25, CY, 0.35);
    carTag.position.set(x + 0.85, 0.95, 0.35);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '지금 구동', value: cur.mode === 'screw' ? '나사를 돌림 → 바퀴가 돎' : '바퀴를 돌림 → 미끄럼대가 감' },
      { label: '속도비', value: '나사 20바퀴에 바퀴 1바퀴(이 20개, 한 줄 나사)' },
      { label: '미끄럼대 위치', value: `행정의 ${Math.round(cur.s * 100)} % · 바퀴 이 1개 = ${K104.pitch.toFixed(3)} 이동` },
      { label: '나사 회전수', value: `${(cur.phi / TAU).toFixed(2)} 바퀴` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.7, 6.4], target: [0, 1.5, 0] }
  };
}
