// 101 매달린 홈 막대 슬라이더 — 천장에 매달린 홈 난 막대가 흔들리며 수평 막대를 직선으로 왕복시킨다 (판화 101번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, tag } from '../kit';
import { K101, barGuide101, ceilingHanger101, slideBar101, slottedArm101, swing101, turnArrows } from '../kit/k101';

const PX = 0; // 걸이 축 x
const PY = 2.84; // 걸이 축 y
const BY = PY - K101.H; // 수평 막대 가운데선 y = 1.98
const BAR_Z = 0; // 수평 막대 가운데 평면
const ARM_Z = 0.17; // 홈 막대 가운데 평면
const HANG_Z = 0.07; // 걸이 귀 가운데 평면
const GUIDE_L = -0.92; // 왼쪽 안내 받침 x
const GUIDE_R = 1.0; // 오른쪽 안내 받침 x

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM101(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 천장 걸이(들보 + 귀 + 걸이 핀, 고정)
  const hanger = ceilingHanger101(0.37, 0.15);
  hanger.name = 'hanger';
  hanger.position.set(PX, PY, HANG_Z);
  g.add(hanger);

  // 안내 받침 2개(고정) — 네모 구멍으로 막대를 꿴다
  const guideL = barGuide101(0.3);
  guideL.name = 'guideL';
  guideL.position.set(GUIDE_L, BY, BAR_Z);
  const guideR = barGuide101(0.3);
  guideR.name = 'guideR';
  guideR.position.set(GUIDE_R, BY, BAR_Z);
  g.add(guideL, guideR);

  // 홈 막대(구동) — rotation.z = phi 로 흔들린다
  const arm = slottedArm101();
  arm.name = 'arm';
  arm.position.set(PX, PY, ARM_Z);
  g.add(arm);

  // 수평 막대(종동) — 핀이 홈 막대의 홈을 꿰고 있다
  const bar = slideBar101(ARM_Z, 0.205, 0.25);
  bar.name = 'bar';
  bar.position.set(PX, BY, BAR_Z);
  g.add(bar);

  // 회전 화살표 — 홈 막대가 지금 도는 방향(반시계/시계)으로 바뀐다
  const arrow = turnArrows(0.17, 'z');
  arrow.group.position.set(PX, PY, 0.32);
  g.add(arrow.group);

  // 이름표 — 수평 막대·미끄럼 핀 둘은 막대를 따라간다
  g.add(tag('홈 막대(구동)', v(PX - 1.2, 2.65, 0.3)));
  g.add(tag('안내 받침(고정)', v(1.25, 2.62, 0.3)));
  const tagBar = tag('수평 막대', v(PX - 1.1, 1.42, 0.3));
  const tagPin = tag('미끄럼 핀', v(PX + 0.95, 1.45, 0.3));
  g.add(tagBar, tagPin);

  // notes 패널용 마지막 값
  let phiDeg = 0;
  let xPos = 0;
  let pinS = 0;

  // 누적 theta 의 닫힌 식으로 전체 자세를 다시 계산(역회전·누적 오차 없음)
  const apply = (): void => {
    const st = swing101(theta);
    arm.rotation.z = st.phi;
    bar.position.x = PX + st.x;
    tagBar.position.set(PX + st.x - 1.1, 1.42, 0.3);
    tagPin.position.set(PX + st.x + 0.95, 1.45, 0.3);
    arrow.set(st.dir);
    phiDeg = (st.phi * 180) / Math.PI;
    xPos = st.x;
    pinS = st.s;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 1.9, 6.4], target: [0, 1.7, 0.1] },
    notes: () => [
      { label: '홈 막대 기울기', value: `${phiDeg.toFixed(1)}°` },
      { label: '수평 막대 위치', value: `x = ${xPos >= 0 ? '+' : ''}${xPos.toFixed(2)} (행정 0.92)` },
      { label: '핀 자리', value: `걸이 축에서 ${pinS.toFixed(2)}` },
      { label: '설명', value: '막대가 기울수록 핀이 홈을 따라 내려간다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
