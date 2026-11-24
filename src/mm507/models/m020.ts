// 020 도르래 배열 — 줄 3개가 모두 추 막대에 맨 3단 도르래, 자유 끝을 당기면 짐이 7분의 1 속도로 오른다 (판화 20번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, arcPoints, ceilingBeam, displayStand, pulleyBlock, rod, ropeEnd, rotArrow, tag, weight } from '../kit';
import { steel } from '../../models/materials';

const Z = 0.22; // 도르래·줄 중심 면
const RF = 0.26; // F(고정) 반지름
const R2 = 0.22; // M2 반지름
const R3 = 0.18; // M3 반지름
const FX = 0.2; // F 중심 x
const FY = 2.6; // F 중심 y
const M2X = -0.06; // M2 중심 x
const M3X = -0.28; // M3 중심 x
const EYE2 = R2 + 0.06; // M2 윗 눈고리 오프셋
const EYE3 = R3 + 0.06; // M3 윗 눈고리 오프셋
const WX = 0.18; // 추 막대 중심 x
const EYE_X = [0.46, 0.16, -0.1]; // 추 막대 위 눈고리 x (줄 a·b·c 순)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** theta → 당김 주기 위상 p(0~1) */
function phase(theta: number): number {
  return (1 - Math.cos(theta * 0.5)) / 2;
}

export default function buildM020(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let u = 0; // notes() 가 읽는 현재 짐 상승량

  g.add(displayStand());
  g.add(ceilingBeam(-0.9, 0.9, 3.0, [0.2])); // 고리 아랫점 (0.2, 2.94, 0.22)

  // F 고정 도르래 — 윗 눈(2.92)을 rod 로 들보 고리에 맨다
  const blockF = pulleyBlock(RF, { hookUp: 0.06 });
  blockF.position.set(FX, FY, Z); // 고정 위치(빠져 있어 원점에 박혀 있었음)
  g.add(blockF);
  g.add(rod(v(FX, FY + RF + 0.06, Z), v(FX, 2.94, Z)));

  // 움직도르래 M2·M3 (윗 눈고리만)
  const blockM2 = pulleyBlock(R2, { hookUp: 0.06 });
  const blockM3 = pulleyBlock(R3, { hookUp: 0.06 });
  g.add(blockM2, blockM3);

  // 추 막대 + 윗면 눈고리 3개 (축 Z, 줄 맬 점 = 눈고리 중심)
  const weightG = new THREE.Group();
  weightG.add(weight(0.8, 0.2));
  const eyeGeo = new THREE.TorusGeometry(0.025, 0.008, 12, 24);
  for (const x of EYE_X) {
    const eye = new THREE.Mesh(eyeGeo, steel());
    eye.castShadow = true;
    eye.position.set(x - WX, 0.13, 0); // 막대 윗면 +0.03
    weightG.add(eye);
  }
  g.add(weightG);

  // 줄 3개 + 자유 끝 손잡이
  const ropeA = new Rope(0.014);
  const ropeB = new Rope(0.014);
  const ropeC = new Rope(0.014);
  g.add(ropeA.group, ropeB.group, ropeC.group);
  const handle = ropeEnd();
  g.add(handle);

  // F 앞 회전 방향 화살표(반시계) + 이름표
  const arrow = rotArrow(0.32, true);
  arrow.position.set(FX, FY, 0.4);
  g.add(arrow);
  const tagF = tag('F 고정 도르래', v(FX + RF + 0.35, FY, 0.4));
  const tagM2 = tag('M2 움직도르래', v(M2X - R2 - 0.35, 1.74, 0.4));
  const tagM3 = tag('M3 움직도르래', v(M3X - R3 - 0.35, 1.2, 0.4));
  const tagW = tag('짐', v(WX + 0.4 + 0.35, 0.4, 0.4));
  const tagP = tag('당기는 곳', v(-1.01, 0.95, 0.4));
  g.add(tagF, tagM2, tagM3, tagW, tagP);

  const sheaveF = blockF.userData.sheave as THREE.Group;
  const sheaveM2 = blockM2.userData.sheave as THREE.Group;
  const sheaveM3 = blockM3.userData.sheave as THREE.Group;

  /** theta 하나에서 모든 부품의 절대 자세를 다시 계산 */
  function apply(): void {
    u = 0.1 * phase(theta);
    const yb = 0.5 + u; // 추 막대 윗면
    const y2 = 1.74 - u; // M2 중심
    const y3 = 1.2 - 3 * u; // M3 중심
    const yF = 0.95 - 7 * u; // 자유 끝

    blockM2.position.set(M2X, y2, Z);
    blockM3.position.set(M3X, y3, Z);
    weightG.position.set(WX, yb - 0.1, Z);
    handle.position.set(-0.46, yF, Z);

    // 도르래 회전(모두 반시계 +), M3 가 가장 빠르다
    sheaveF.rotation.z = u / RF;
    sheaveM2.rotation.z = (2 * u) / R2;
    sheaveM3.rotation.z = (4 * u) / R3;

    // 줄 a: 막대 눈 → F 위를 반시계로 → M2 윗 눈
    ropeA.setPath([
      v(0.46, yb + 0.03, Z),
      v(0.46, FY, Z),
      ...arcPoints([FX, FY], RF, 0, Math.PI, Z),
      v(M2X, FY, Z),
      v(M2X, y2 + EYE2, Z)
    ]);
    // 줄 b: 막대 눈 → M2 위를 반시계로 → M3 윗 눈
    ropeB.setPath([
      v(0.16, yb + 0.03, Z),
      v(0.16, y2, Z),
      ...arcPoints([M2X, y2], R2, 0, Math.PI, Z),
      v(M3X, y2, Z),
      v(M3X, y3 + EYE3, Z)
    ]);
    // 줄 c: 막대 눈 → M3 위를 반시계로 → 자유 끝
    ropeC.setPath([
      v(-0.1, yb + 0.03, Z),
      v(-0.1, y3, Z),
      ...arcPoints([M3X, y3], R3, 0, Math.PI, Z),
      v(-0.46, y3, Z),
      v(-0.46, yF, Z)
    ]);

    // 이름표가 움직이는 부품을 따라간다
    tagM2.position.set(M2X - R2 - 0.35, y2, 0.4);
    tagM3.position.set(M3X - R3 - 0.35, y3, 0.4);
    tagW.position.set(WX + 0.4 + 0.35, yb - 0.1, 0.4);
    tagP.position.set(-1.01, yF, 0.4);
  }

  apply(); // 첫 프레임 전 초기 자세

  return {
    group: g,
    notes: () => [
      { label: '이득', value: '7배 (줄 3개 모두 추에 맴: 4+2+1)' },
      { label: '당긴 줄 : 오른 높이', value: (7 * u).toFixed(2) + ' : ' + u.toFixed(2) },
      { label: '책의 규칙', value: '2ⁿ (책의 설명, 실제는 2ⁿ − 1)' }
    ],
    update(dt: number, speed: number): void {
      // 절대 위상에서 전체 자세 재계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
