// 021 도르래 배열 — 고정 도르래 F + 움직도르래 M, 판화 연결을 그대로 계산한 이득 3배 (판화 21번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, arcPoints, ceilingBeam, displayStand, leaderTo, pulleyBlock, rod, ropeEnd, rotArrow, tag, weight } from '../kit';
import { steel } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const Z = 0.22; // 줄·도르래 중심 면
const RF = 0.26; // 고정 도르래 F 반지름
const RM = 0.22; // 움직도르래 M 반지름
const HOOK_Y = 2.94; // 들보 고리 아랫점
const FY = 2.6; // F 중심 y
const EYE_M = RM + 0.06; // M 윗 눈고리 오프셋(0.28)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** theta → 당김 위상 p(0~1)·추가 오르는 높이 u */
function phase(theta: number): { p: number; u: number } {
  const p = (1 - Math.cos(theta * 0.5)) / 2;
  return { p, u: 0.1 * p };
}

export default function buildM021(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let u = 0; // notes() 가 읽는 현재 짐 상승량

  g.add(displayStand());

  // 들보 — 중앙 고리 하나에 F 를 매단다
  g.add(ceilingBeam(-0.9, 0.9, 3.0, [0]));

  // 고정 도르래 F — 윗 눈(2.92)을 rod 로 고리 아랫점(2.94)에 매단다
  const blockF = pulleyBlock(RF, { hookUp: 0.06 });
  blockF.position.set(0, FY, Z);
  g.add(blockF, rod(v(0, FY + RF + 0.06, Z), v(0, HOOK_Y, Z), 0.008));

  // 움직도르래 M — 줄 1 의 끝(윗 눈)에 매달려 매 프레임 위치를 다시 정한다
  const blockM = pulleyBlock(RM, { hookUp: 0.06 });
  g.add(blockM);

  // 추 — weight() 의 가운데 고리(children[0])는 눈고리와 겹치므로 숨긴다
  const wt = weight(0.78, 0.26);
  const hook = wt.children[0];
  if (hook) hook.visible = false;
  // 윗면 눈고리 두 개(월드 x = 0.26, −0.04 → 추 중심 기준 ±0.15, 윗면보다 0.03 위 → 로컬 y 0.16, 축 Z)
  for (const ex of [0.15, -0.15]) {
    const eye = mesh(new THREE.TorusGeometry(0.025, 0.008, 12, 24), steel());
    eye.position.set(ex, 0.16, 0);
    wt.add(eye);
  }
  g.add(wt);

  // 줄 2개 — 줄 1: 추 오른 눈→F 위→M 윗 눈 / 줄 2: 추 왼 눈→M 위→자유 끝
  const rope1 = new Rope(0.014);
  const rope2 = new Rope(0.014);
  g.add(rope1.group, rope2.group);

  // 자유 끝 손잡이
  const handle = ropeEnd();
  g.add(handle);

  // F 앞 회전 방향 화살표(반시계)
  const arrow = rotArrow(0.32, true);
  arrow.position.set(0, FY, 0.4);
  g.add(arrow);

  // 이름표 — 움직이는 부품 것은 매 프레임 따라간다
  const tagF = leaderTo(tag('F 고정 도르래', v(1.15, 2.72, 0.4)), blockF);
  const tagM = tag('M 움직도르래', v(-1.15, 1.65, 0.4));
  const tagW = tag('짐', v(0.95, 0.51, 0.4));
  const tagPull = tag('당기는 곳', v(-1.0, 0.95, 0.4));
  g.add(tagF, tagM, tagW, tagPull);

  const sheaveF = blockF.userData.sheave as THREE.Group;
  const sheaveM = blockM.userData.sheave as THREE.Group;

  /** theta 하나에서 모든 부품의 절대 자세를 다시 계산 */
  function apply(): void {
    const { p } = phase(theta);
    u = 0.1 * p;
    const yb = 0.64 + u; // 추 윗면 높이
    const yM = 1.55 - u; // M 은 u 하강(줄 1 추 쪽이 u 짧아짐)
    const yF = 0.95 - 3 * u; // 자유 끝(이득 3)

    blockM.position.set(-0.26, yM, Z);
    wt.position.set(0.11, yb - 0.13, Z);
    handle.position.set(-0.48, yF, Z);

    // 도르래 회전(반시계 +): 줄이 왼쪽으로 흐른다. M 은 상대 유속 2u 로 F 의 약 2.4배
    sheaveF.rotation.z = u / RF;
    sheaveM.rotation.z = (2 * u) / RM;

    // 줄 1: 추 오른 눈→F 위를 반시계로 넘어→M 윗 눈
    rope1.setPath([
      v(0.26, yb + 0.03, Z),
      v(0.26, FY, Z),
      ...arcPoints([0, FY], RF, 0, Math.PI, Z),
      v(-0.26, FY, Z),
      v(-0.26, yM + EYE_M, Z)
    ]);
    // 줄 2: 추 왼 눈→M 위를 반시계로 넘어→왼쪽에서 아래로 자유 끝
    rope2.setPath([
      v(-0.04, yb + 0.03, Z),
      v(-0.04, yM, Z),
      ...arcPoints([-0.26, yM], RM, 0, Math.PI, Z),
      v(-0.48, yM, Z),
      v(-0.48, yF, Z)
    ]);

    tagM.position.set(-1.15, yM + 0.1, 0.4);
    tagW.position.set(0.95, yb - 0.13, 0.4);
    tagPull.position.set(-1.0, yF, 0.4);
  }

  apply(); // 첫 프레임 전 초기 자세

  return {
    group: g,
    notes: () => [
      { label: '이득', value: '3배 (판화 연결을 계산한 값)' },
      { label: '당긴 줄 : 오른 높이', value: (3 * u).toFixed(2) + ' : ' + u.toFixed(2) },
      { label: '책의 2ⁿ 규칙', value: '고정점에 맨 줄이 있을 때(019·022)에 맞다' }
    ],
    update(dt: number, speed: number): void {
      // 절대 위상에서 전체 자세 재계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
