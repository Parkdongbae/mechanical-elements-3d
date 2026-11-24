// 002 엇걸이(교차) 벨트 — 벨트가 가운데서 X자로 교차, 두 풀리가 반대 방향 1:1 (판화 2번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, ROPE_R, beltPathAround, carryTags, displayStand, pulley, rotArrow, shaftZ, tag, type V2 } from '../kit';

const RA = 0.52; // 풀리 A(구동) 반지름
const RB = 0.52; // 풀리 B(종동) 반지름
const CA: V2 = [0, 2.55]; // A 중심
const CB: V2 = [0, 0.95]; // B 중심
const Z = 0.25; // 풀리·호 높이
const RP_A = RA + 0.01; // 로프 중심 반지름 = 홈 중심 반지름
const RP_B = RB + 0.01;
const AMP = ROPE_R + 0.01; // 교차점에서 가닥 하나가 벌어지는 z (두 가닥 간격 = 2·AMP > 2·ROPE_R)
const CLEAR = 0.2; // 접점에서 이만큼은 홈 평면 그대로(로프가 플랜지 높이를 벗어나는 거리)
const SUB = 40; // 직선 가닥을 쪼개는 개수 (꼬임 무늬가 매끈하도록 촘촘히)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 교차 벨트 3D 점열: 호는 홈 중심(z=Z, 반지름 r+0.01) 고정.
 *  두 직선 가닥만 z 를 ±AMP 벌려 교차점에서 서로 겹치지 않게 한다.
 *  풀리 플랜지를 벗어날 때까지(접점에서 CLEAR)는 홈 평면에 그대로 두고, 그 뒤에 부드럽게 벌린다. */
function crossedPath3D(): THREE.Vector3[] {
  const seg = 72;
  // A 반시계·B 시계로 감는 엇걸이 경로 (점 배치가 아래 주석과 같도록 beltPathAround 를 쓴다)
  const flat = beltPathAround(
    [
      { c: CA, r: RP_A, ccw: true },
      { c: CB, r: RP_B, ccw: false }
    ],
    seg
  );
  // 레이아웃: [0]=A 출발점, [1]=B 도착점, B 호 …, [seg+1]=B 출발점, [seg+2]=A 도착점, A 호 …
  const out: THREE.Vector3[] = [];
  const strand = (p: V2, q: V2, sign: number): void => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let i = 0; i <= SUB; i++) {
      const u = i / SUB;
      const s = Math.min(u, 1 - u) * len; // 가까운 접점까지 거리
      const w = Math.min(1, Math.max(0, (s - CLEAR) / (len / 2 - CLEAR)));
      out.push(v(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, Z + sign * AMP * w * w * (3 - 2 * w)));
    }
  };
  const arcPts = (from: number, to: number): void => {
    for (let i = from; i < to; i++) out.push(v(flat[i]![0], flat[i]![1], Z));
    carryTags(flat.slice(from, to), out.slice(out.length - (to - from))); // 검사 표식(감긴 호)
  };
  strand(flat[0]!, flat[1]!, -1); // 가닥 1(A→B): 교차점에서 Z−AMP, 양 끝은 Z
  arcPts(2, seg + 1); // B 호 (끝점 제외한 내부 점)
  strand(flat[seg + 1]!, flat[seg + 2]!, +1); // 가닥 2(B→A): Z+AMP
  arcPts(seg + 3, flat.length); // A 호
  return out;
}

export default function buildM002(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 풀리 A(구동, bronze)·B(종동, brass) — 001 과 같은 배치
  const pA = pulley(RA, { spokes: 4, driver: true });
  pA.position.set(CA[0], CA[1], Z);
  const pB = pulley(RB, { spokes: 4 });
  pB.position.set(CB[0], CB[1], Z);
  g.add(pA, pB, shaftZ(CA[0], CA[1]), shaftZ(CB[0], CB[1]));

  // 엇걸이 벨트: 교차부 두 가닥의 z 를 갈라 뚫고 지나가 보이지 않게
  const belt = new Belt(crossedPath3D());
  g.add(belt.group);

  // 회전 방향 화살표: A 반시계, B 시계
  const arrowA = rotArrow(0.7, true);
  arrowA.position.set(CA[0], CA[1], Z + 0.09);
  const arrowB = rotArrow(0.7, false);
  arrowB.position.set(CB[0], CB[1], Z + 0.09);
  g.add(arrowA, arrowB);
  g.add(tag('구동 풀리', v(CA[0] + 1.0, CA[1] + 0.2, Z + 0.1)), tag('종동 풀리', v(CB[0] + 1.0, CB[1] + 0.2, Z + 0.1)));

  return {
    group: g,
    notes: () => [
      { label: '회전 방향', value: '서로 반대' },
      { label: '속도비', value: '1 : 1' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 교차 벨트라 B 는 반대 방향
      theta += OMEGA * speed * dt;
      pA.rotation.z = theta;
      pB.rotation.z = -theta;
      belt.setOffset(theta * RP_A); // 표시가 벨트 따라 흐른다
    }
  };
}
