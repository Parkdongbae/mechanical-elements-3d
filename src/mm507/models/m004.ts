// 004 같은 평면의 직각 전동 — 엇걸이 벨트가 아래 가운데 수직축 홈 풀리를 감는다 (판화 4번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, beltPathAround, displayStand, pulley, rod, rotArrow, shaftZ, tag, type V2 } from '../kit';
import { castIron } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const RT = 0.42; // T(구동) 반지름
const RL = 0.2; // L·R(안내) 반지름
const RG = 0.16; // G(종동·수직축) 반지름
const HB = 0.01; // 벨트 두께 절반 — 경로는 림 바깥 HB
const Z0 = 0.25; // T·L·R 풀리와 벨트 평면부 높이
const SEG = 24; // 호 분할 수
const CT: V2 = [0, 2.7];
const CR: V2 = [1.25, 1.05];
const CL: V2 = [-1.25, 1.05];
const GY = 0.85; // G 중심 y
const GZ = 0.45; // G 중심 z

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 두 선분 (a→b)·(c→d)의 교차점(XY). 이 모형에서는 두 가닥이 반드시 교차한다 */
function segCross(a: V2, b: V2, c: V2, d: V2): V2 {
  const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]);
  const t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export default function buildM004(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 풀리 T(구동·bronze)와 안내 L·R — 회전축 Z, z = 0.25
  const pT = pulley(RT, { spokes: 4, driver: true });
  pT.position.set(CT[0], CT[1], Z0);
  const pL = pulley(RL, { spokes: 4 });
  pL.position.set(CL[0], CL[1], Z0);
  const pR = pulley(RL, { spokes: 4 });
  pR.position.set(CR[0], CR[1], Z0);
  g.add(pT, pL, pR, shaftZ(CT[0], CT[1]), shaftZ(CL[0], CL[1]), shaftZ(CR[0], CR[1]));

  // 종동 홈 풀리 G — 감싸는 그룹(rotation.x = π/2)으로 회전축을 Y로 눕힌다
  const gWrap = new THREE.Group();
  gWrap.position.set(0, GY, GZ);
  gWrap.rotation.x = Math.PI / 2;
  const gSpin = pulley(RG, { grooved: true, spokes: 4 });
  gWrap.add(gSpin);
  g.add(gWrap);
  // Y 방향 축: 아래 끝(0.35)은 브래킷 밑면(0.42) 밑으로 삐죽, 위는 1.0
  g.add(rod(v(0, 0.35, GZ), v(0, 1.0, GZ)));
  const brkt = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), castIron());
  brkt.position.set(0, 0.48, GZ);
  const post = mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), castIron());
  post.position.set(0, 0.3, GZ);
  g.add(brkt, post);

  // ①~③: T → R → L 차례로 감는 닫힌 경로. T 반시계, 엇걸이라 L·R 은 시계
  const loop = beltPathAround(
    [
      { c: CT, r: RT + HB, ccw: true },
      { c: CR, r: RL + HB, ccw: false },
      { c: CL, r: RL + HB, ccw: false }
    ],
    SEG
  );
  // 배치: [0] T 출발 · [1] R 도착 · [2..SEG] R 호 · [SEG+1] R 밑점 · [SEG+2] L 밑점
  //       [SEG+3..2SEG+1] L 호 · [2SEG+2] L 출발 · [2SEG+3] T 도착 · [2SEG+4..3SEG+2] T 호
  const lp = (i: number, z = Z0): THREE.Vector3 => v(loop[i]![0], loop[i]![1], z);

  // 엇걸이 X 교차점 — 두 가닥의 z 를 0.28 / 0.22 로 달리한다 (002 방식)
  const xc = segCross(loop[0]!, loop[1]!, loop[2 * SEG + 2]!, loop[2 * SEG + 3]!);

  // ④ 아랫가닥: R 밑점 → G 앞 호(y = GY 평면, 접선 접촉) → L 밑점
  const GR = RG + HB;
  const gam = Math.acos(GR / Math.hypot(CR[0], Z0 - GZ)) + Math.atan2(Z0 - GZ, CR[0]);
  const touch = (a: number): THREE.Vector3 => v(Math.cos(a) * GR, GY, GZ + Math.sin(a) * GR);
  const tR = touch(gam);
  const tL = touch(Math.PI - gam);
  const gArc: THREE.Vector3[] = [];
  for (let i = 1; i < 10; i++) gArc.push(touch(gam + ((Math.PI - 2 * gam) * i) / 10));

  const path: THREE.Vector3[] = [];
  const wdirs: THREE.Vector3[] = [];
  const WZ = v(0, 0, 1); // T·L·R 위 띠 폭 = Z
  const WY = v(0, 1, 0); // G 위 띠 폭 = Y
  const W45 = v(0, Math.SQRT1_2, Math.SQRT1_2); // 1/4 비틀림 중간
  const push = (p: THREE.Vector3, w: THREE.Vector3): void => {
    path.push(p);
    wdirs.push(w);
  };
  const pushStrand = (a: THREE.Vector3, b: THREE.Vector3, zCross: number): void => {
    const x = v(xc[0], xc[1], zCross);
    push(a, WZ);
    push(a.clone().lerp(x, 0.5), WZ);
    push(x, WZ);
    push(x.clone().lerp(b, 0.5), WZ);
    push(b, WZ);
  };

  // T→R 가닥 (교차부가 위 z = 0.28)
  pushStrand(lp(0), lp(1), 0.28);
  // R 바깥 아래 호 + R 밑점
  for (let i = 2; i <= SEG; i++) push(lp(i), WZ);
  push(lp(SEG + 1), WZ);
  // 아랫가닥: 폭을 Z → Y 로 부드럽게 돌려 G 앞을 감는다
  push(lp(SEG + 1).clone().lerp(tR, 0.5), W45);
  push(tR, WY);
  for (const p of gArc) push(p, WY);
  push(tL, WY);
  push(tL.clone().lerp(lp(SEG + 2), 0.5), W45);
  push(lp(SEG + 2), WZ);
  // L 바깥 아래 호
  for (let i = SEG + 3; i <= 2 * SEG + 1; i++) push(lp(i), WZ);
  // L→T 가닥 (교차부가 아래 z = 0.22)
  pushStrand(lp(2 * SEG + 2), lp(2 * SEG + 3), 0.22);
  // T 호 — 마지막 점은 path[0](T 출발)으로 닫힌다
  for (let i = 2 * SEG + 4; i <= 3 * SEG + 2; i++) push(lp(i), WZ);

  const belt = new Belt(path, { width: 0.11, thickness: 0.02, style: 'flat', widthDirs: wdirs });
  g.add(belt.group);

  // 회전 방향 화살표: T 반시계, G 는 수평면에 눕힌 화살표(위에서 시계 = 실제 방향)
  const arrT = rotArrow(0.57, true);
  arrT.position.set(CT[0], CT[1], Z0 + 0.09);
  const arrG = rotArrow(0.26, true);
  arrG.rotation.x = Math.PI / 2;
  arrG.position.set(0, GY, GZ);
  g.add(arrT, arrG);
  g.add(
    tag('구동 풀리', v(1.05, 2.95, 0.4)),
    tag('안내 풀리', v(-1.95, 1.4, 0.4)),
    tag('종동 풀리(수직축)', v(1.0, 0.5, 0.6))
  );

  return {
    group: g,
    notes: () => [
      { label: '축의 관계', value: '직각 · 같은 평면' },
      { label: '벨트', value: '엇걸이' },
      { label: '속도비', value: '1 : ' + (RT / RG).toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      pT.rotation.z = theta;
      pL.rotation.z = (-theta * RT) / RL; // 엇걸이: T 와 반대, L·R 은 서로 같은 방향
      pR.rotation.z = (-theta * RT) / RL;
      gSpin.rotation.z = (theta * RT) / RG; // 랩 local Z = 세계 −Y: 아랫가닥 흐름에 맞는 위에서 시계
      belt.setOffset(theta * (RT + HB));
    }
  };
}
