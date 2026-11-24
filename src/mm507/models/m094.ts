// 094 가변 크랭크 — 방사 홈 판과 나선 홈 판을 서로 돌리면 둘을 함께 지나는 볼트(크랭크 핀)의 반지름이 바뀐다 (판화 94번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { K94, crankBolt, radialSlotPlate, spiralGroovePlate, variableCrank94 } from '../kit/k092';

const CY = 1.75; // 축 높이
const ZB = 0.035; // 나선 판 가운데 평면
const ZA = 0.12; // 방사 홈 판 가운데 평면
const RAD2DEG = 180 / Math.PI;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM094(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 뒤판: 나선 홈 판(앞면에 파인 홈)
  const spiral = spiralGroovePlate();
  spiral.name = 'spiralPlate';
  // autocheck 는 이름에 소문자 hole/groove 가 든 윤곽만 홈으로 읽는다 — 키트가 남긴 spiralGroove 를 홈 이름으로 다시 단다
  const oc = spiral.userData.outlines as Record<string, [number, number][]>;
  spiral.userData.outlines = { 'spiral-groove': oc.spiralGroove! };
  spiral.position.set(0, CY, ZB);
  g.add(spiral);

  // 앞판: 방사 홈 판(반투명 — 뒤의 나선 홈이 비쳐 보인다)
  const slot = radialSlotPlate();
  slot.name = 'slotPlate';
  slot.position.set(0, CY, ZA);
  const sl = slot.userData.outlines as Record<string, [number, number][]>;
  slot.userData.outlines = Object.fromEntries(Object.entries(sl).map(([k, p]) => [k.replace('slotHole', 'slot-hole'), p]));
  g.add(slot);

  // 축 — 두 판의 구멍을 지나 앞판 허브 앞까지
  g.add(shaftZ(0, CY, 0.24, 0.1));

  // 볼트(크랭크 핀) — 앞판 240° 홈과 나선 홈을 함께 지난다
  const bolt = crankBolt(0.032, 0.34, 0.15);
  bolt.name = 'bolt';
  g.add(bolt);

  // 회전 화살표 셋 — 상태에 따라 하나만 보인다
  const arrTogether = rotArrow(0.5, true);
  const arrShrink = rotArrow(0.7, false);
  const arrGrow = rotArrow(0.7, true);
  for (const a of [arrTogether, arrShrink, arrGrow]) {
    a.position.set(0, CY, 0.3);
    g.add(a);
  }

  g.add(
    tag('방사 홈 판(앞)', v(-1.35, 3.0, 0.3)),
    tag('나선 홈 판(뒤)', v(1.35, 3.0, 0.3)),
    tag('볼트(크랭크 핀)', v(-1.55, 0.6, 0.3)),
    tag('판을 서로 돌리면 볼트가 안팎으로', v(0.6, 0.4, 0.3))
  );

  let phase: 0 | 1 | 2 | 3 = 0;
  let rNow: number = K94.rIn;
  let gapDeg = 0;
  const apply = (): void => {
    const st = variableCrank94(theta);
    slot.rotation.z = st.slotPlate;
    spiral.rotation.z = st.spiralPlate;
    bolt.position.set(st.bolt[0], CY + st.bolt[1], 0);
    phase = st.phase;
    rNow = st.r;
    gapDeg = (((st.slotPlate - st.spiralPlate) * RAD2DEG) % 360 + 360) % 360;
    arrTogether.visible = phase === 0 || phase === 2;
    arrShrink.visible = phase === 1;
    arrGrow.visible = phase === 3;
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 2.0, 6.4], target: [0, 1.85, 0.2] },
    notes: () => [
      { label: '지금 상태', value: phase === 1 ? '반지름 줄이는 중' : phase === 3 ? '반지름 키우는 중' : '함께 도는 중' },
      { label: '크랭크 반지름', value: `${rNow.toFixed(2)} (0.44 ~ 0.79)` },
      { label: '행정(반지름의 2배)', value: (rNow * 2).toFixed(2) },
      { label: '두 판의 어긋난 각', value: `${gapDeg.toFixed(0)}°(나선 판이 시계 쪽)` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
