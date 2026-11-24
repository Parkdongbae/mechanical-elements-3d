// 006 반원 세그먼트로 왕복 회전 — 레버에 붙은 반원 세그먼트가 엇걸이 벨트로
// 아래 두 풀리에 왕복 회전을 준다 (판화 6번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, beltPathAround, displayStand, pulley, rotArrow, rod, shaftZ, tag, type V2 } from '../kit';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { annularSector, extrude, lathe, merge, mesh, rodProfile, TAU } from '../../models/parts/geom';

const P: V2 = [0, 2.5]; // 받침점(레버 축) — 레버 끝이 뒤판(3.15) 안에 들도록 2.8 → 2.5
const Z = 0.3; // 기구 평면 높이
const LEV = 2.4; // 레버 전체 길이(2.7 → 2.4, 끝 최고 y = 2.5 + 1.2·sin0.5 + 0.07 ≈ 3.15)
const RS = 0.62; // 세그먼트 림 반지름
const RB = 0.63; // 벨트가 세그먼트에 닿는 반지름(바깥면 홈)
const RC = 0.34; // 아래 풀리 반지름
const RP = 0.35; // 벨트가 풀리 홈을 감는 반지름
const CL: V2 = [-1.05, 0.85]; // 왼쪽 풀리 중심
const CR: V2 = [1.05, 0.85]; // 오른쪽 풀리 중심
const AMP = 0.5; // 레버 왕복 진폭(rad)
const DZ = 0.055; // 교차부 두 가닥의 z 간격(0.245 / 0.355) — 로프 지름 0.09 + 틈 0.02
const SEG = 24; // 호 분할 수

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 두 직선 (a→b)·(c→d)의 교차점(XY) — 004 와 같은 보조 함수 */
function segCross(a: V2, b: V2, c: V2, d: V2): V2 {
  const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]);
  const t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** 열린 벨트 경로: 양 끝은 세그먼트 림 아래 접점에 고정, 두 가닥이 X로 엇걸려
 *  각 풀리의 바깥·밑을 감고 아랫가닥으로 이어진다. 접점은 경로 계산으로 고정. */
function beltPath(): THREE.Vector3[] {
  const flat = beltPathAround(
    [
      { c: P, r: RB, ccw: true },
      { c: CR, r: RP, ccw: false },
      { c: CL, r: RP, ccw: false }
    ],
    SEG
  );
  // 배치: [0] S 접점(왼어깨) · [1] R 도착 · [2..SEG] R 호 · [SEG+1] R 밑 · [SEG+2] L 밑
  //       [SEG+3..2SEG+1] L 호 · [2SEG+2] L 어깨 · [2SEG+3] S 접점(오른어깨) · 뒤는 버림(열린 벨트)
  const sA0 = flat[0]!;
  const rArr = flat[1]!;
  const rDep = flat[SEG + 1]!;
  const lArr = flat[SEG + 2]!;
  const lDep = flat[2 * SEG + 2]!;
  const sEnd = flat[2 * SEG + 3]!;
  const xc = segCross(sA0, rArr, lDep, sEnd); // X 교차점
  const path: THREE.Vector3[] = [];
  const put = (p: V2, z = Z): void => {
    path.push(v(p[0], p[1], z));
  };
  // 교차 가닥: 양 끝 z=Z, 교차점에서 zc (004 방식)
  const strand = (a: V2, b: V2, zc: number): void => {
    const x = v(xc[0], xc[1], zc);
    put(a);
    path.push(v(a[0], a[1], Z).lerp(x, 0.5));
    path.push(x);
    path.push(v(b[0], b[1], Z).lerp(x, 0.5));
    put(b);
  };
  strand(sA0, rArr, Z - DZ); // ① S → R 가닥, 교차점 아래
  for (let i = 2; i <= SEG; i++) put(flat[i]!); // ② R 바깥·밑 호
  put(rDep); // ③ 아랫가닥: R 밑 → L 밑
  put(lArr);
  for (let i = SEG + 3; i <= 2 * SEG + 1; i++) put(flat[i]!); // ④ L 밑·바깥 호
  strand(lDep, sEnd, Z + DZ); // ⑤ L → S 가닥, 교차점 위
  return path;
}

export default function buildM006(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let phiVal = 0; // 표시용 레버 각
  let pulVal = 0; // 표시용 풀리 각

  g.add(displayStand());

  // 아래 풀리 L·R(종동) — 같은 크기, z = 0.3
  const pL = pulley(RC, { spokes: 4 });
  pL.position.set(CL[0], CL[1], Z);
  const pR = pulley(RC, { spokes: 4 });
  pR.position.set(CR[0], CR[1], Z);
  g.add(pL, pR, shaftZ(CL[0], CL[1]), shaftZ(CR[0], CR[1]), shaftZ(P[0], P[1]));

  // 레버 + 반원 세그먼트 = 한 몸. 받침점 P 에서 z축 회전
  const leverG = new THREE.Group();
  leverG.position.set(P[0], P[1], Z);
  const driver = bronze({ roughness: 0.34 });
  // 레버: 길이 2.7 둥근 막대 + 양 끝 공 + 가운데 허브
  leverG.add(rod(v(-LEV / 2, 0, 0), v(LEV / 2, 0, 0), 0.035));
  const ballGeo = new THREE.SphereGeometry(0.07, 24, 16);
  for (const sx of [-1, 1]) {
    const ball = mesh(ballGeo.clone(), brass());
    ball.position.x = (sx * LEV) / 2;
    leverG.add(ball);
  }
  const hubGeo = lathe(rodProfile(0.1, -0.065, 0.065, 0.015, 0.015), 32);
  hubGeo.rotateX(Math.PI / 2);
  leverG.add(mesh(hubGeo, driver));
  // 세그먼트 림: 아래로 향한 반원 띠(각 π~2π, 폭 0.14), 끝은 레버에 닿는다
  const rimGeo = extrude(annularSector(0.5, RS, Math.PI, TAU), 0.14, 0.01);
  rimGeo.translate(0, 0, -0.07);
  leverG.add(mesh(rimGeo, driver));
  // 바깥면 얕은 홈 — 어두운 링으로 표현
  const grooveGeo = new THREE.TorusGeometry(RS, 0.011, 8, 64, Math.PI);
  grooveGeo.rotateZ(Math.PI); // 0~π 호를 아래쪽 반원으로
  leverG.add(mesh(grooveGeo, darkSteel()));
  // 스포크 5개(허브 → 림): 각 π + π/6·k
  const spokes: THREE.BufferGeometry[] = [];
  for (let k = 1; k <= 5; k++) {
    const b = new THREE.BoxGeometry(0.46, 0.055, 0.07);
    b.translate(0.29, 0, 0); // r 0.06 → 0.52, 허브·림에 파묻힘
    b.rotateZ(Math.PI + (Math.PI / 6) * k);
    spokes.push(b);
  }
  leverG.add(mesh(merge(spokes), driver));
  // 림 표시점 3개 — 벨트 표시와 같은 속도로 움직여 미끄러짐이 없음을 보인다
  for (const off of [-Math.PI / 9, 0, Math.PI / 9]) {
    const dotGeo = new THREE.BoxGeometry(0.05, 0.02, 0.01);
    dotGeo.translate(RS - 0.01, 0, 0.074);
    dotGeo.rotateZ(1.5 * Math.PI + off); // 250°/270°/290° — 벨트 접촉부 안
    leverG.add(mesh(dotGeo, paint(0xf2b619)));
  }
  g.add(leverG);

  // 열린 벨트 — 양 끝이 림에 고정, 경로는 고정하고 표시점만 흐른다
  const belt = new Belt(beltPath(), { width: 0.12, closed: false });
  g.add(belt.group);

  // 양방향 화살표 — 레버·풀리 모두 왕복
  for (const ccw of [true, false]) {
    const a = rotArrow(0.36, ccw);
    a.position.set(P[0], P[1], Z + 0.12);
    g.add(a);
  }
  for (const c of [CL, CR]) {
    for (const ccw of [true, false]) {
      const a = rotArrow(0.45, ccw);
      a.position.set(c[0], c[1], Z + 0.09);
      g.add(a);
    }
  }
  g.add(
    tag('레버(왕복)', v(1.0, 2.75, 0.4)),
    tag('반원 세그먼트', v(-0.95, 1.65, 0.4)),
    tag('종동 풀리', v(1.5, 1.32, 0.4))
  );

  return {
    group: g,
    notes: () => [
      { label: '레버 각도', value: ((phiVal * 180) / Math.PI).toFixed(0) + '°' },
      { label: '풀리 각도', value: ((pulVal * 180) / Math.PI).toFixed(0) + '°' },
      { label: '각도비', value: '1 : ' + (RS / RC).toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      phiVal = AMP * Math.sin(theta); // 레버·세그먼트 왕복각
      const s = RS * phiVal; // 벨트 이동량(림이 미끄러지지 않음)
      leverG.rotation.z = phiVal;
      belt.setOffset(s);
      pulVal = -s / RC; // 엇걸이: 레버와 반대, L·R 은 서로 같은 방향
      pL.rotation.z = pulVal;
      pR.rotation.z = pulVal;
    }
  };
}
