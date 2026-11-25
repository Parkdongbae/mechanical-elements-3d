// 113 랙과 피니언 — 피니언이 좌우로 흔들며 랙 달린 탁자를 왕복시킨다 (판화 113번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, spurGear, tag, leaderTo } from '../kit';
import { K113, k113State, rackTable113, wallYoke113 } from '../kit/k113';

const PY = 1.4; // 피니언 축 높이
const ZR = 0.25; // 피니언·랙 가운데 평면
const PITCH_Y = PY + (K113.pinionTeeth * K113.module) / 2; // 랙 피치선 높이 1.805

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM113(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 피니언(구동)
  const pinion = spurGear(K113.pinionTeeth, K113.module, { width: 0.12, spokes: 4, driver: true });
  pinion.name = 'pinion';
  pinion.position.set(0, PY, ZR);
  g.add(pinion);
  g.add(shaftZ(0, PY, 0.36, 0.05));

  // 랙 달린 탁자
  const table = rackTable113();
  table.name = 'table';
  table.position.set(0, PITCH_Y, ZR);
  g.add(table);
  const plateBottom = (table.userData.mm as { plateBottom: number }).plateBottom;
  const yAxle = PITCH_Y + plateBottom - K113.rollerR;

  // 벽 굴대 받침 2개 — 앞 바퀴(rollers[1])에 이름
  const yokeL = wallYoke113(-K113.rollerX, yAxle, ZR);
  const yokeR = wallYoke113(K113.rollerX, yAxle, ZR);
  yokeL.rollers[1]!.name = 'rollerL';
  yokeR.rollers[1]!.name = 'rollerR';
  g.add(yokeL.group, yokeR.group);
  const rollers = [...yokeL.rollers, ...yokeR.rollers];

  // 회전 화살표 2개(실제 방향에 따라 하나만 보임)
  const arrCcw = rotArrow(0.2, true);
  const arrCw = rotArrow(0.2, false);
  for (const a of [arrCcw, arrCw]) {
    a.position.set(0, PY, 0.38);
    g.add(a);
  }

  const tagRack = leaderTo(tag('랙(판 밑에 붙음)', v(-0.8, 2.45, 0.3)), 'rack');
  const tagPlate = tag('탁자 판', v(0.9, 2.45, 0.3));
  g.add(tag('피니언(구동, 좌우로 흔들림)', v(0, 0.7, 0.35)), leaderTo(tag('굴림 바퀴', v(1.36, 1.3, 0.5)), 'rollerR'), tagRack, tagPlate);

  const place = (): void => {
    const s = k113State(theta);
    pinion.rotation.z = s.phi;
    table.position.x = s.x;
    for (const r of rollers) r.rotation.z = s.roll;
    arrCcw.visible = s.ccw;
    arrCw.visible = !s.ccw;
    tagRack.position.x = s.x - 0.8;
    tagPlate.position.x = s.x + 0.9;
  };
  place();

  return {
    group: g,
    view: { pos: [0, 1.9, 6.4], target: [0, 1.6, 0.2] },
    notes: () => {
      const s = k113State(theta);
      return [
        { label: '피니언', value: '이 18개, 피치 반지름 0.405' },
        { label: '랙', value: '이 14개, 피치 0.141' },
        { label: '탁자 이동', value: `${Math.round(s.x * 1000)} mm` },
        { label: '피니언 각', value: `${Math.round((s.phi * 180) / Math.PI)}°` },
        { label: '비', value: '피니언이 한 바퀴 돌면 랙은 2.54(피치원 둘레) 만큼 간다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      place();
    }
  };
}
