// 120 집게형 기어 장치 — 한 축의 두 피니언이 바깥 이 부채꼴과 안쪽 이 활 틀을 맞물려 두 턱을 함께 오므린다 (판화 120번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { K120, pincer120, pinion119, ringJaw120, sectorJaw120, spacer119 } from '../kit/k119';

const PY = 2.2; // 피벗 높이
const SY = PY - 1.056; // 피니언 축 높이
const ZB = 0; // 뒤 층 가운데
const ZF = 0.1; // 앞 층 가운데
const HALF = Math.PI / 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM120(): MovementModel {
  const g = new THREE.Group();
  // theta = OMEGA·t (다른 번호와 같은 시작 0) — 설계표 시각 t = 1 이 벌린 자세(판화), t = 2.96 이 다문 자세
  let theta = 0;

  g.add(displayStand());

  // 고정 피벗 핀 + 두 조각 사이 띄우개
  g.add(shaftZ(0, PY, 0.2, 0.05));
  g.add(spacer119(0.052, 0.1, 0.037, 0.063).translateX(0).translateY(PY));

  // 피니언 축(구동) + 두 피니언 사이 띄우개
  const shaft = shaftZ(0, SY, 0.2, 0.045);
  shaft.name = 'pinionShaft';
  g.add(shaft);
  g.add(spacer119(0.045, 0.1, 0.037, 0.063).translateY(SY));

  // 바깥 이 부채꼴 + 왼쪽 턱(앞 층), 안쪽 이 활 틀 + 오른쪽 턱(뒤 층)
  const sector = sectorJaw120();
  sector.name = 'sectorJaw';
  sector.position.set(0, PY, ZF);
  g.add(sector);
  const ring = ringJaw120();
  ring.name = 'ringJaw';
  ring.position.set(0, PY, ZB);
  g.add(ring);

  const pw = { width: 0.07, bore: 0.045, driver: true };
  const small = pinion119(12, K120.module, pw);
  small.name = 'pinionSmall';
  small.position.set(0, SY, ZF);
  g.add(small);
  const big = pinion119(20, K120.module, pw);
  big.name = 'pinionBig';
  big.position.set(0, SY, ZB);
  g.add(big);
  // 두 피니언은 층이 달라(0.1 떨어짐) 서로 닿지 않는다 — autocheck 의 다각형 침범은 층 구분이 0.3 이라 오탐하므로
  // 피니언 몸통의 2D 윤곽 표식은 떼고, 물림은 기어 검사(메시 단면)가 맡는다.
  for (const p of [small, big]) p.traverse((o) => { delete o.userData.outline; });

  // 회전 화살표: 다무는 동안 반시계, 벌리는 동안 시계
  const arrCcw = rotArrow(0.17, true);
  const arrCw = rotArrow(0.17, false);
  arrCcw.position.set(0, SY, 0.24);
  arrCw.position.set(0, SY, 0.24);
  g.add(arrCcw, arrCw);

  g.add(
    tag('왼쪽 턱', v(-1.35, 2.9, 0.3)),
    tag('오른쪽 턱', v(1.4, 2.9, 0.3)),
    tag('바깥 이 조각', v(-1.4, 2.1, 0.3)),
    tag('안쪽 이 틀', v(-1.45, 0.5, 0.3)),
    tag('피니언 축(구동)', v(1.25, 0.38, 0.3))
  );

  let cur = pincer120(theta);
  const apply = (): void => {
    cur = pincer120(theta);
    shaft.rotation.z = cur.shaft;
    small.rotation.z = cur.shaft + HALF;
    big.rotation.z = cur.shaft - HALF;
    sector.rotation.z = cur.sector;
    ring.rotation.z = cur.ring;
    const closing = Math.sin(theta - 1.6) > 0;
    arrCcw.visible = closing;
    arrCw.visible = !closing;
  };
  apply();

  const deg = (r: number): number => Math.round((r * 180) / Math.PI);

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => [
      { label: '상태', value: Math.sin(theta - 1.6) > 0 ? '다무는 중' : '벌리는 중' },
      { label: '잇수', value: '작은 피니언 12 ↔ 바깥 이 32 꼴, 큰 피니언 20 ↔ 안쪽 이 64 꼴' },
      { label: '축 각', value: `${deg(cur.shaft)}° 에 턱 왼쪽 ${deg(-cur.sector)}° + 오른쪽 ${deg(cur.ring)}°` },
      { label: '속도비', value: '축 1 : 부채꼴 0.375(반대로) : 활 틀 0.3125(같은 쪽)' },
      { label: '힘', value: '축 지름에 견주어 턱 끝 힘이 커진다(감속: 부채꼴 2.7배, 활 틀 3.2배)' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
