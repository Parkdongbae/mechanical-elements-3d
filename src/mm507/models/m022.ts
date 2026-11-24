// 022 도르래 배열 — 019 의 연결을 F 를 오른쪽으로 옮겨 펼친 형태, 이득 8 = 2³ (판화 22번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, arcPoints, ceilingBeam, displayStand, pulleyBlock, rod, ropeEnd, rotArrow, tag, weight } from '../kit';
import { steel } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const Z = 0.22; // 줄·도르래 중심 면
const R = 0.16; // 움직도르래 반지름
const RF = 0.18; // 고정 도르래 F 반지름
const EYE = 0.22; // 움직도르래 아랫 눈고리 오프셋(R + 0.06)
const HOOK_Y = 2.94; // 들보 고리 아랫점

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** theta → 당김 위상 p(0~1)·짐이 오르는 높이 u */
function phase(theta: number): { p: number; u: number } {
  const p = (1 - Math.cos(theta * 0.5)) / 2;
  return { p, u: 0.08 * p };
}

export default function buildM022(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let u = 0; // notes() 가 읽는 현재 짐 상승량

  g.add(displayStand());

  // 들보 — 앞 세 고리는 줄 3·2·1 의 고정 끝, 마지막은 F 걸이
  g.add(ceilingBeam(-0.9, 0.9, 3.0, [-0.40, -0.24, -0.08, 0.42]));

  // 고정 도르래 F — 윗 눈(2.90)을 rod 로 고리 아랫점(2.94)에 매단다
  const blockF = pulleyBlock(RF, { hookUp: 0.06 });
  blockF.position.set(0.42, 2.66, Z);
  g.add(blockF);
  g.add(rod(v(0.42, 2.90, Z), v(0.42, HOOK_Y, Z), 0.008));

  // 움직도르래 m1·m2·m3 — 반 지름씩 왼쪽으로 밀린 계단식, 아랫 눈고리만
  const blockM1 = pulleyBlock(R, { hookDown: 0.06, width: 0.05, spokes: 3 });
  const blockM2 = pulleyBlock(R, { hookDown: 0.06, width: 0.05, spokes: 3 });
  const blockM3 = pulleyBlock(R, { hookDown: 0.06, width: 0.05, spokes: 3 });
  g.add(blockM1, blockM2, blockM3);

  // 넓은 추 + m3 아랫 눈→추 윗면 잇는 짧은 막대(길이 0.08 고정, 매 프레임 y 이동)
  const wt = weight(0.76, 0.30);
  // weight() 의 큰 고리(children[0])는 m3 바퀴에 박히므로 숨기고, 윗면에 작은 눈고리를 단다
  const bigRing = wt.children[0];
  if (bigRing) bigRing.visible = false;
  const wtEye = mesh(new THREE.TorusGeometry(0.025, 0.008, 12, 24), steel());
  wtEye.position.set(0, 0.15 + 0.02, 0);
  wt.add(wtEye);
  const link = rod(v(-0.24, 0.70, Z), v(-0.24, 0.78, Z), 0.008);
  g.add(wt, link);

  // 줄 3개 — 각각 별도 Rope 인스턴스
  const rope3 = new Rope(0.012);
  const rope2 = new Rope(0.012);
  const rope1 = new Rope(0.012);
  g.add(rope3.group, rope2.group, rope1.group);

  // 자유 끝 손잡이
  const handle = ropeEnd();
  g.add(handle);

  // F 앞 회전 방향 화살표(시계)
  const arrow = rotArrow(0.24, false);
  arrow.position.set(0.42, 2.66, 0.40);
  g.add(arrow);

  // 이름표 — 움직이는 부품 것은 매 프레임 따라간다
  const tagF = tag('F 고정 도르래', v(1.25, 2.66, 0.4));
  const tagM1 = tag('m1', v(-1.15, 1.96, 0.4));
  const tagM2 = tag('m2', v(-1.15, 1.48, 0.4));
  const tagM3 = tag('m3', v(-1.15, 1.00, 0.4));
  const tagW = tag('짐', v(-1.15, 0.55, 0.4));
  const tagPull = tag('당기는 곳', v(1.25, 1.40, 0.4));
  g.add(tagF, tagM1, tagM2, tagM3, tagW, tagPull);

  const sheaveF = blockF.userData.sheave as THREE.Group;
  const sheaveM1 = blockM1.userData.sheave as THREE.Group;
  const sheaveM2 = blockM2.userData.sheave as THREE.Group;
  const sheaveM3 = blockM3.userData.sheave as THREE.Group;

  /** theta 하나에서 모든 부품의 절대 자세를 다시 계산 */
  function apply(): void {
    u = phase(theta).u;
    const y1 = 1.96 + 4 * u;
    const y2 = 1.48 + 2 * u;
    const y3 = 1.00 + u;
    const yF = 1.40 - 8 * u;

    blockM1.position.set(0.08, y1, Z);
    blockM2.position.set(-0.08, y2, Z);
    blockM3.position.set(-0.24, y3, Z);
    wt.position.set(-0.24, y3 - 0.45, Z);
    link.position.set(-0.24, y3 - 0.30, Z);
    handle.position.set(0.60, yF, Z);

    // 도르래 회전(반시계 +): 움직도르래는 고정 왼쪽 가닥을 타고 구른다. 위로 갈수록 두 배씩, F 는 시계
    sheaveM3.rotation.z = u / R;
    sheaveM2.rotation.z = (2 * u) / R;
    sheaveM1.rotation.z = (4 * u) / R;
    sheaveF.rotation.z = (-8 * u) / RF;

    // 줄 3: 들보 고리→m3 밑을 감고→m2 아랫 눈
    rope3.setPath([
      v(-0.40, HOOK_Y, Z),
      v(-0.40, y3, Z),
      ...arcPoints([-0.24, y3], R, Math.PI, 2 * Math.PI, Z),
      v(-0.08, y3, Z),
      v(-0.08, y2 - EYE, Z)
    ]);
    // 줄 2: 들보 고리→m2 밑을 감고→m1 아랫 눈
    rope2.setPath([
      v(-0.24, HOOK_Y, Z),
      v(-0.24, y2, Z),
      ...arcPoints([-0.08, y2], R, Math.PI, 2 * Math.PI, Z),
      v(0.08, y2, Z),
      v(0.08, y1 - EYE, Z)
    ]);
    // 줄 1: 들보 고리→m1 밑을 감고→F 위를 넘어 오른쪽 자유 끝
    rope1.setPath([
      v(-0.08, HOOK_Y, Z),
      v(-0.08, y1, Z),
      ...arcPoints([0.08, y1], R, Math.PI, 2 * Math.PI, Z),
      v(0.24, y1, Z),
      v(0.24, 2.66, Z),
      ...arcPoints([0.42, 2.66], RF, Math.PI, 0, Z),
      v(0.60, 2.66, Z),
      v(0.60, yF, Z)
    ]);

    // 이름표가 움직이는 부품을 따라간다
    tagM1.position.set(-1.15, y1, 0.4);
    tagM2.position.set(-1.15, y2, 0.4);
    tagM3.position.set(-1.15, y3, 0.4);
    tagW.position.set(-1.15, y3 - 0.45, 0.4);
    tagPull.position.set(1.25, yF, 0.4);
  }

  apply(); // 첫 프레임 전 초기 자세

  return {
    group: g,
    notes: () => [
      { label: '이득', value: '8배 (2×2×2)' },
      { label: '움직도르래', value: '3개' },
      { label: '당긴 줄 : 오른 높이', value: (8 * u).toFixed(2) + ' : ' + u.toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      // 절대 위상에서 전체 자세 재계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
