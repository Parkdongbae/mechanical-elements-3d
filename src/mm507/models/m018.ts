// 018 고정 둘·움직 하나 도르래 — 고정 P1·P2 를 한 수직선·한 평면에 포개 달고, 움직도르래 M 을 3:1로 받친다 (판화 18번)
// 판화: 들보 고리 → P1 → (고리 이음) → P2 가 한 줄로 매달리고, 그 아래 M·추까지 세 도르래가 같은 축선(x=0)·같은 면에 있다.
// 그래서 세 도르래의 z 를 모두 들보 고리 z(0.22)에 맞춘다. 줄도 한 평면 안에서 진짜 접선으로 감는다.
// 한 평면이라 M→P1 가닥이 P2 옆을 스쳐 지나므로, 그 가닥이 P2 와 P2 에서 내려오는 가닥에 닿지 않게
// 반지름(P1 0.28 > P2 0.20 > M 0.17)과 높이를 정했다(P2 높이에서 가닥 사이 틈 ≥ 0.006).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, ceilingBeam, displayStand, pulleyBlock, ropeAround, ropeEnd, rotArrow, tag, weight } from '../kit';

const Z = 0.22; // 세 도르래 공통 면 = 들보 고리 z
const HOOK_Y = 2.97; // 들보 고리 중심 y (고리 아랫점 2.94)
const EYE = 0.06; // 블록 눈고리 거리(바퀴 둘레 바깥)
const LINK = 0.03; // 맞물린 두 눈고리 중심 사이 거리(사슬처럼 서로 꿰인다)
const R1 = 0.28; // P1 반지름(가장 큼)
const R2 = 0.2; // P2 반지름
const RM = 0.17; // M 반지름
const Y1 = HOOK_Y - LINK - EYE - R1; // P1 중심 y = 2.60 — 윗 눈이 들보 고리에 꿰인다
const Y2 = Y1 - R1 - EYE - LINK - EYE - R2; // P2 중심 y = 1.97 — P1 아랫 눈과 P2 윗 눈이 꿰인다
const YM0 = 0.8; // M 중심 시작 높이
const YF0 = 1.6; // 자유 끝 시작 높이
const WT_DY = RM + EYE + 0.208; // M 중심 → 추 중심: 추 고리 꼭대기(추 중심 +0.208)가 M 아랫 눈 중심에 꿰인다

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** theta → 당김 주기 위상 p(0~1)·당김 높이 h */
function phase(theta: number): { p: number; h: number } {
  const p = (1 - Math.cos(theta * 0.5)) / 2;
  return { p, h: 0.25 * p };
}

/** 블록의 위(sy=1)/아래(sy=−1) 눈고리를 세워(yz 면) 이웃 고리와 사슬처럼 꿰이게 한다 */
function turnEye(block: THREE.Group, sy: 1 | -1): void {
  for (const c of block.children) {
    const m = c as THREE.Mesh;
    if (m.isMesh && m.geometry.type === 'TorusGeometry' && Math.sign(m.position.y) === sy) m.rotation.y = Math.PI / 2;
  }
}

export default function buildM018(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let h = 0; // notes() 가 읽는 현재 당김 높이

  g.add(displayStand());
  g.add(ceilingBeam(-0.9, 0.9, 3.0, [0.0]));

  // 고정 도르래 P1 — 윗 눈(세움)이 들보 고리에 꿰이고, 아랫 눈이 P2 윗 눈과 꿰인다
  const blockP1 = pulleyBlock(R1, { hookUp: EYE, hookDown: EYE });
  blockP1.position.set(0, Y1, Z);
  turnEye(blockP1, 1);
  g.add(blockP1);

  // 고정 도르래 P2 — P1 바로 아래, 같은 수직선·같은 면. 윗 눈(세움)이 P1 아랫 눈과 꿰인다
  const blockP2 = pulleyBlock(R2, { hookUp: EYE });
  blockP2.position.set(0, Y2, Z);
  turnEye(blockP2, 1);
  g.add(blockP2);

  // 움직도르래 M(위·아래 눈고리, 소형이라 얇게) — 역시 같은 면
  const blockM = pulleyBlock(RM, { hookUp: EYE, hookDown: EYE, width: 0.06 });
  g.add(blockM);

  // 추 — 추 고리가 M 아랫 눈(세움)에 사슬처럼 바로 꿰인다
  turnEye(blockM, -1);
  const wt = weight(0.3, 0.26);
  g.add(wt);

  // 줄 1가닥 + 자유 끝 손잡이
  const rope = new Rope(0.014);
  g.add(rope.group);
  const handle = ropeEnd();
  g.add(handle);

  // P1 앞 회전 방향 화살표(시계) + 이름표
  const arrow = rotArrow(0.34, false);
  arrow.position.set(0, Y1, 0.4);
  g.add(arrow);
  const tagP1 = tag('고정 도르래 P1', v(-0.8, Y1 + 0.1, 0.4));
  const tagP2 = tag('고정 도르래 P2', v(-0.75, Y2 + 0.05, 0.4));
  const tagM = tag('움직도르래 M', v(-0.7, YM0, 0.4));
  const tagW = tag('추', v(-0.65, YM0 - WT_DY, 0.4));
  const tagF = tag('당기는 곳', v(0.85, YF0, 0.4));
  g.add(tagP1, tagP2, tagM, tagW, tagF);

  const sheaveP1 = blockP1.userData.sheave as THREE.Group;
  const sheaveP2 = blockP2.userData.sheave as THREE.Group;
  const sheaveM = blockM.userData.sheave as THREE.Group;

  /** theta 하나에서 모든 부품의 절대 자세를 다시 계산 */
  function apply(): void {
    h = phase(theta).h;
    const yM = YM0 + h; // M 중심 높이
    const yF = YF0 - 3 * h; // 자유 끝 높이

    blockM.position.set(0, yM, Z);
    wt.position.set(0, yM - WT_DY, Z);
    handle.position.set(R1, yF, Z);

    // 도르래 회전(반시계 +): 모두 시계, M 이 가장 빠르다(비 1/R2 : 2/RM : 3/R1)
    sheaveP1.rotation.z = (-3 * h) / R1;
    sheaveP2.rotation.z = -h / R2;
    sheaveM.rotation.z = (-2 * h) / RM;

    // 줄(한 평면 z=Z, 진짜 접선): M 윗 눈 → P2 위(시계) → M 밑(시계) → P1 위(시계) → 자유 끝
    rope.setPath(
      ropeAround(
        { p: [0, yM + RM + EYE], w: Z },
        [
          { c: [0, Y2], r: R2, ccw: false, w: Z },
          { c: [0, yM], r: RM, ccw: false, w: Z },
          { c: [0, Y1], r: R1, ccw: false, w: Z }
        ],
        { p: [R1, yF], w: Z },
        { seg: 24 }
      )
    );

    // 이름표가 움직이는 부품을 따라간다
    tagM.position.set(-0.7, yM, 0.4);
    tagW.position.set(-0.65, yM - WT_DY, 0.4);
    tagF.position.set(0.85, yF, 0.4);
  }

  apply(); // 첫 프레임 전 초기 자세

  return {
    group: g,
    notes: () => [
      { label: '이득', value: '3배' },
      { label: '당긴 줄 : 오른 높이', value: (3 * h).toFixed(2) + ' : ' + h.toFixed(2) },
      { label: '고정 도르래', value: '2개 (방향만 바꿈)' }
    ],
    update(dt: number, speed: number): void {
      // 절대 위상에서 전체 자세 재계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
