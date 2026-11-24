// 005 조임 풀리(벨트 클러치) — 느슨한 벨트를 조임 풀리 B로 밀어 팽팽하게 하면 동력이 전달된다 (판화 5번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, lever, pulley, rod, rotArrow, shaftZ, tag, type V2 } from '../kit';

const RA = 0.48; // 풀리 A(구동) 반지름
const RC = 0.30; // 풀리 C(종동) 반지름
const RB = 0.14; // 조임 풀리 B 반지름
const E = 0.01; // 벨트 두께 절반 — 접점은 유효 반지름 위에 둔다
const CA: V2 = [0.25, 2.6]; // A 중심
const CC: V2 = [0.25, 0.95]; // C 중심
const PF: V2 = [-0.95, 1.55]; // 레버 받침점 F
const LB = 0.45; // 받침점→B 거리
const A0 = 2.2; // 떼었을 때 레버 각 — B가 벨트에서 떨어짐
const A1 = 0.15; // 눌렀을 때 레버 각 — B가 왼쪽 가닥을 민다
const Z = 0.25; // 벨트·풀리 면
const ZBAR = 0.1; // 레버 막대 면 — B 허브와 겹치지 않게 뒤로
const BULGE = 0.35; // 느슨할 때 왼쪽 가닥의 바깥 불룩함
const PERIOD = 6; // 동작 주기(초)
// 경로 조각별 점 수: 왼쪽 가닥(선+B호+선) · C호 · 오른쪽 가닥 · A호
const NL1 = 5;
const NB = 7;
const NL2 = 5;
const NC = 13;
const NR = 9;
const NA = 15;
const NPTS = NL1 + NB + NL2 + NC + NR + NA;

const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 외접 접점 쌍: c1→c2 진행 기준 side=+1 왼쪽 / −1 오른쪽 접선. 접점 = (c1+r1·n, c2+r2·n) */
function tangent(c1: V2, r1: number, c2: V2, r2: number, side: number): { n: V2; p1: V2; p2: V2 } {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const D = Math.hypot(dx, dy);
  const ax = dx / D;
  const ay = dy / D;
  const s = Math.max(-0.999, Math.min(0.999, (r1 - r2) / D));
  const cb = Math.sqrt(1 - s * s);
  const n: V2 = [s * ax - side * cb * ay, s * ay + side * cb * ax];
  return { n, p1: [c1[0] + r1 * n[0], c1[1] + r1 * n[1]], p2: [c2[0] + r2 * n[0], c2[1] + r2 * n[1]] };
}

/** (0, 2π]로 정규화한 양의 각 증분 — CCW 호 전개용 */
function norm(d: number): number {
  let x = d % (Math.PI * 2);
  if (x <= 0) x += Math.PI * 2;
  return x;
}

/** 레버 각 a에서의 조임 풀리 B 중심 */
function bAt(a: number): V2 {
  return [PF[0] + LB * Math.cos(a), PF[1] + LB * Math.sin(a)];
}

function linePts(out: THREE.Vector3[], p: V2, q: V2, n: number): void {
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push(v3(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, Z));
  }
}

function arcPts(out: THREE.Vector3[], c: V2, r: number, a0: number, a1: number, n: number): void {
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push(v3(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, Z));
  }
}

/** 팽팽한 경로: A 왼쪽 → B 감김 → C 아래 → 오른쪽 가닥 → A 위 (CCW 닫힌 점열) */
function tightPath(): THREE.Vector3[] {
  const rA = RA + E;
  const rB = RB + E;
  const rC = RC + E;
  const B = bAt(A1);
  const tAB = tangent(CA, rA, B, rB, -1);
  const tBC = tangent(B, rB, CC, rC, -1);
  const tCA = tangent(CC, rC, CA, rA, -1);
  const aAB = Math.atan2(tAB.n[1], tAB.n[0]);
  const aBC = Math.atan2(tBC.n[1], tBC.n[0]);
  const aCA = Math.atan2(tCA.n[1], tCA.n[0]);
  const pts: THREE.Vector3[] = [];
  linePts(pts, tAB.p1, tAB.p2, NL1);
  arcPts(pts, B, rB, aAB, aAB + norm(aBC - aAB), NB); // B 왼쪽 감김
  linePts(pts, tBC.p1, tBC.p2, NL2);
  arcPts(pts, CC, rC, aBC, aBC + norm(aCA - aBC), NC); // C 아래 감김
  linePts(pts, tCA.p1, tCA.p2, NR);
  arcPts(pts, CA, rA, aCA, aCA + norm(aAB - aCA), NA); // A 위 감김
  return pts;
}

/** 느슨한 경로: 왼쪽 가닥이 바깥으로 불룩(처짐) — 조임 경로와 같은 점 수 */
function loosePath(): THREE.Vector3[] {
  const rA = RA + E;
  const rC = RC + E;
  const tCA = tangent(CC, rC, CA, rA, -1);
  const aR = Math.atan2(tCA.n[1], tCA.n[0]);
  const pa: V2 = [CA[0] - rA, CA[1]]; // A 왼쪽 접점
  const pc: V2 = [CC[0] - rC, CC[1]]; // C 왼쪽 접점
  const pts: THREE.Vector3[] = [];
  const nl = NL1 + NB + NL2;
  for (let i = 1; i <= nl; i++) {
    const t = i / nl;
    const x = pa[0] + (pc[0] - pa[0]) * t;
    const y = pa[1] + (pc[1] - pa[1]) * t;
    pts.push(v3(x - BULGE * Math.sin(Math.PI * t), y, Z));
  }
  arcPts(pts, CC, rC, Math.PI, Math.PI + norm(aR - Math.PI), NC);
  linePts(pts, tCA.p1, tCA.p2, NR);
  arcPts(pts, CA, rA, aR, aR + norm(Math.PI - aR), NA);
  return pts;
}

/** 구간 완화 */
function smooth(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** 주기 내 시각 tc(초) → 조임도 k (0 뗌 ~ 1 조임) */
function kOf(tc: number): number {
  if (tc < 2) return 0; // 떼어 있음 — A 만 회전
  if (tc < 2.6) return smooth((tc - 2) / 0.6); // 레버 a0 → a1
  if (tc < 5) return 1; // 조임 — 전달
  if (tc < 6) return 1 - smooth((tc - 5) / 1); // 레버 복귀
  return 0;
}

export default function buildM005(): MovementModel {
  const g = new THREE.Group();
  let thetaA = 0; // A 누적 각
  let s = 0; // 전달된 벨트 이동량 — C·B·벨트 표시는 이 값에서 계산
  let thetaC = 0; // C 누적 각(관성 포함)
  let wC = 0; // C 실제 각속도
  let T = 0; // 주기 시간 누적
  let k = 0; // 조임도

  g.add(displayStand());
  g.add(shaftZ(CA[0], CA[1]), shaftZ(CC[0], CC[1]), shaftZ(PF[0], PF[1]));

  // 풀리 A(구동·bronze)·C(종동·brass)
  const pA = pulley(RA, { spokes: 4, driver: true });
  pA.position.set(CA[0], CA[1], Z);
  const pC = pulley(RC, { spokes: 4 });
  pC.position.set(CC[0], CC[1], Z);
  g.add(pA, pC);

  // 레버(F 받침) + 조임 풀리 B: 스터드 위에서 자유 회전
  const leverG = lever(0.75, { handle: true });
  leverG.position.set(PF[0], PF[1], ZBAR);
  const studG = new THREE.Group();
  studG.position.set(LB, 0, Z - ZBAR);
  const pB = pulley(RB, { spokes: 4 });
  studG.add(pB);
  leverG.add(studG);
  leverG.add(rod(v3(LB, 0, -0.08), v3(LB, 0, 0.26), 0.024)); // B 스터드 — 레버판을 관통
  g.add(leverG);

  // 벨트: 느슨/팽팽 두 경로를 같은 점 수로 만들어 k로 보간, 매 프레임 갱신
  const loose = loosePath();
  const tight = tightPath();
  const cur = loose.map((p) => p.clone());
  const belt = new Belt(cur, { width: 0.13 });
  g.add(belt.group);

  // 회전 방향 화살표(A만 — C는 조임 전 정지) + 이름표
  const arrowA = rotArrow(0.68, true);
  arrowA.position.set(CA[0], CA[1], Z + 0.09);
  g.add(arrowA);
  g.add(tag('구동 풀리', v3(CA[0] + 1.0, CA[1] + 0.25, Z + 0.1)));
  g.add(tag('종동 풀리', v3(CC[0] + 1.0, CC[1] + 0.2, Z + 0.1)));
  g.add(tag('조임 풀리 B', v3(PF[0] - 0.55, PF[1] - 0.35, Z + 0.1)));

  return {
    group: g,
    notes: () => [
      { label: '조임 풀리', value: k > 0.5 ? '누름 — 전달' : '뗌 — 미끄러짐' },
      { label: '종동 풀리', value: Math.abs(wC) > 0.05 ? '회전' : '정지' }
    ],
    update(dt: number, speed: number): void {
      const dT = Math.abs(speed) * dt;
      T += dT;
      k = kOf(T % PERIOD);
      thetaA += OMEGA * speed * dt; // A는 항상 회전
      s += OMEGA * speed * RA * k * dt; // 전달된 벨트 이동량
      // C 관성: 목표 각속도를 시정수로 따라간다 — 조임 해제 후 ~0.5초 감속 정지
      const wT = OMEGA * speed * (RA / RC) * k;
      const tau = Math.abs(wT) > Math.abs(wC) ? 0.1 : 0.16;
      wC += (wT - wC) * (1 - Math.exp(-dT / tau));
      thetaC += wC * dt;
      // 절대 자세 계산
      pA.rotation.z = thetaA;
      pC.rotation.z = thetaC;
      pB.rotation.z = s / (RB + E);
      leverG.rotation.z = A0 + (A1 - A0) * k;
      for (let i = 0; i < NPTS; i++) cur[i]!.lerpVectors(loose[i]!, tight[i]!, k);
      belt.setPath(cur);
      belt.setOffset(s);
    }
  };
}
