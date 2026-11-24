// 023 움직이는 풀리 전동 — D 가 벨트로 움직이는 풀리 P 를 돌리고, 장력 풀리 A 가 오르내려 벨트를 늘 팽팽히 유지한다 (판화 23번)
// 판화대로: D 에서 나온 두 가닥이 모두 A 위를 넘어 P 로 내려간다. 두 가닥은 서로 반대로 흐르므로
// A 는 한 축에 나란히 끼운 헐거운 풀리 2장(A1 뒤·A2 앞)이고 서로 반대로 돈다. 균형추 C 가 A 를 위로 당긴다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, Rope, arcPoints, beltPathAround, carryTags, displayStand, pulley, rotArrow, shaftZ, tag, weight, type V2 } from '../kit';
import { castIron, steel } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const Z = 0.22; // 벨트·풀리 중심 z
const ZR = 0.4; // A 의 줄·B 풀리·C 의 z
const XD = -1.31; // D 중심 x
const YD = 1.98; // D 중심 y
const XP = 0.82; // P 중심 x
const XA = 0.33; // A 중심 x
const RBD = 0.38; // 벨트 경로 반지름 = 풀리 r + 0.01
const RBP = 0.31;
const RA = 0.19; // A 풀리 반지름 (A 오른쪽 가장자리 ≈ P 왼쪽 가장자리 → 판화의 수직 가닥)
const RBA = RA + 0.01;
const DZ = 0.055; // A1·A2 가 벨트 면에서 앞뒤로 벗어난 거리(로프 반지름 0.045 두 줄이 안 닿게)
const YOKE = RA + 0.12; // A 축에서 걸이 눈(줄 매는 곳)까지 높이
const BY = 2.85; // B 안내 풀리 높이
const SEG = 24; // 벨트 경로 호 분할(표시)

/** D(시계)→A1(시계, 위를 넘음)→P(시계)→A2(반시계, 위를 넘음)→D. A2 앞뒤는 안쪽 접선이 자동으로 잡힌다 */
function circles(yA: number, yP: number): { c: V2; r: number; ccw: boolean }[] {
  return [
    { c: [XD, YD], r: RBD, ccw: false },
    { c: [XA, yA], r: RBA, ccw: false },
    { c: [XP, yP], r: RBP, ccw: false },
    { c: [XA, yA], r: RBA, ccw: true }
  ];
}

/** 벨트 3D 경로 — beltPathAround 점열(출발점 1 + 원마다 seg+1 점 ×3 + D 호)에 원별 z 를 준다 */
function beltPts(yA: number, yP: number): THREE.Vector3[] {
  const pts = beltPathAround(circles(yA, yP), SEG);
  const n = SEG + 1;
  const out = pts.map((p, i) => {
    let z = Z; // D·P 위
    if (i >= 1 && i <= n) z = Z - DZ; // A1 (뒤)
    else if (i > 2 * n && i <= 3 * n) z = Z + DZ; // A2 (앞)
    return new THREE.Vector3(p[0], p[1], z);
  });
  carryTags(pts, out); // 검사 표식(감긴 호)
  return out;
}

/** 벨트 둘레 = 닫힌 경로 점열(호 분할 8)의 총 길이 */
function perim(yA: number, yP: number): number {
  const pts = beltPathAround(circles(yA, yP), 8);
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  const f = pts[pts.length - 1]!;
  const h = pts[0]!;
  return s + Math.hypot(h[0] - f[0], h[1] - f[1]);
}

const L0 = perim(2.19, 1.08); // 시작 벨트 길이 — 한 번만 계산

/** perim(y, yP) = L0 이 되는 y 를 [1.70, 2.75] 에서 이분법(30회)으로 (단조 증가). 못 풀면 구간 끝값 */
function solveYA(yP: number): number {
  const LO = 1.7;
  const HI = 2.75;
  if (perim(LO, yP) > L0) return LO;
  if (perim(HI, yP) < L0) return HI;
  let lo = LO;
  let hi = HI;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (perim(mid, yP) > L0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM023(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let yP = 1.08; // P 중심 y
  let yA = 2.19; // A 중심 y
  let yC = 1.98; // 추 C 중심 y

  g.add(displayStand());

  // D 구동 풀리 — 고정 축
  const pD = pulley(0.37, { driver: true, spokes: 6 });
  pD.position.set(XD, YD, Z);
  g.add(pD, shaftZ(XD, YD, 0.36, 0.055));

  // P 움직이는 풀리 — 축째 그룹을 매 프레임 (XP, yP, 0) 으로 옮긴다
  const pP = pulley(0.3, { spokes: 5 });
  pP.position.set(XP, yP, Z);
  const shaftP = shaftZ(XP, 0, 0.36, 0.045);
  g.add(pP, shaftP);

  // A 장력 풀리 — 축째 그룹을 매 프레임 (XA, yA, 0) 으로 옮긴다
  // 한 축에 헐거운 풀리 2장: A1(뒤, 시계) · A2(앞, 반시계)
  const pA1 = pulley(RA, { spokes: 4, width: 0.1 });
  const pA2 = pulley(RA, { spokes: 4, width: 0.1 });
  pA1.position.set(XA, yA, Z - DZ);
  pA2.position.set(XA, yA, Z + DZ);
  const shaftA = shaftZ(XA, 0, 0.43, 0.024);
  g.add(pA1, pA2, shaftA);
  // 걸이: 축 앞 끝에서 위로 올라간 띠쇠 + 눈고리 — 줄이 여기에 매여 A 를 위로 당긴다
  const yoke = new THREE.Group();
  const strap = mesh(new THREE.BoxGeometry(0.03, YOKE + 0.03, 0.012), castIron());
  strap.position.set(0, (YOKE - 0.03) / 2, 0);
  const eye = mesh(new THREE.TorusGeometry(0.026, 0.008, 12, 24), steel());
  eye.position.set(0, YOKE, 0);
  yoke.add(strap, eye);
  g.add(yoke);

  // 안내 홈: 뒤판에 세운 주철 상자 두 개씩 (P 용 · A 용) — 축 보스가 닿지 않는 간격
  const boxGeo = new THREE.BoxGeometry(0.03, 0.9, 0.04);
  for (const sx of [-1, 1]) {
    const b = mesh(boxGeo, castIron());
    b.position.set(XP + sx * 0.13, 1.08, -0.24);
    g.add(b);
  }
  for (const sx of [-1, 1]) {
    const b = mesh(boxGeo, castIron());
    b.position.set(XA + sx * 0.08, 2.2, -0.24);
    g.add(b);
  }

  // 벨트: D→A1→P→A2→D 로프 벨트 — 매 프레임 경로 재계산(점 개수 일정)
  const belt = new Belt(beltPts(yA, yP));
  g.add(belt.group);

  // B 안내 풀리 2개 (고정)
  const pB1 = pulley(0.09, { width: 0.06, spokes: 3, grooved: true });
  pB1.position.set(0.42, BY, ZR);
  const pB2 = pulley(0.09, { width: 0.06, spokes: 3, grooved: true });
  pB2.position.set(1.38, BY, ZR);
  g.add(pB1, pB2, shaftZ(0.42, BY, 0.46, 0.025), shaftZ(1.38, BY, 0.46, 0.025));

  // 줄 + 균형추 C (줄 끝은 추 윗면 위)
  const rope = new Rope(0.014);
  g.add(rope.group);
  const weightG = new THREE.Group();
  weightG.add(weight(0.3, 0.26));
  g.add(weightG);

  // 회전 방향 화살표(시계) + 이름표
  const arrow = rotArrow(0.45, false);
  arrow.position.set(XD, YD, 0.4);
  g.add(arrow);
  const tagD = tag('D 구동 풀리', v(-1.2, 1.35, 0.4));
  const tagP = tag('P 움직이는 풀리', v(XP, yP - 0.46, 0.4));
  const tagA = tag('A 장력 풀리(2장)', v(-0.2, yA - 0.5, 0.4));
  const tagB = tag('B 안내', v(0.9, 3.05, 0.4));
  const tagC = tag('C', v(1.47, yC - 0.38, 0.4));
  g.add(tagD, tagP, tagA, tagB, tagC);

  /** theta 하나에서 전체 자세를 다시 계산 */
  function apply(): void {
    yP = 1.08 + 0.16 * Math.sin(theta * 0.5); // P 는 느리게 위아래
    yA = solveYA(yP); // 벨트 길이 일정이 되는 A 높이
    yC = 4.17 - yA; // 줄 길이 보존: A 가 오르면 C 가 내려간다

    pP.position.set(XP, yP, Z);
    shaftP.position.set(XP, yP, 0);
    pA1.position.set(XA, yA, Z - DZ);
    pA2.position.set(XA, yA, Z + DZ);
    shaftA.position.set(XA, yA, 0);
    yoke.position.set(XA, yA, ZR);
    weightG.position.set(1.47, yC, ZR);

    // 회전(반시계 +, 전부 시계 −): P·A 는 벨트 반지름에 반비례, B 는 줄 흐름
    pD.rotation.z = -theta;
    pP.rotation.z = (-theta * RBD) / RBP;
    pA1.rotation.z = (-theta * RBD) / RBA; // 가는 가닥(D→P)을 받아 시계
    pA2.rotation.z = (theta * RBD) / RBA; // 돌아오는 가닥(P→D)을 받아 반시계
    pB1.rotation.z = -(yA - 2.19) / 0.09;
    pB2.rotation.z = -(yA - 2.19) / 0.09;

    belt.setPath(beltPts(yA, yP));
    belt.setOffset(theta * RBD); // 벨트가 D→A1→P→A2 방향으로 흐른다

    // 줄: A 걸이 눈에서 위로 → B1 윗면 → 가로 → B2 → 아래로 C 에
    rope.setPath([
      v(XA, yA + YOKE, ZR),
      v(XA, BY, ZR),
      ...arcPoints([0.42, BY], 0.09, Math.PI, Math.PI / 2, ZR),
      ...arcPoints([1.38, BY], 0.09, Math.PI / 2, 0, ZR),
      v(1.47, BY, ZR),
      v(1.47, yC + 0.22, ZR)
    ]);

    // 이름표가 움직이는 부품을 따라간다
    tagP.position.set(XP, yP - 0.46, 0.4);
    tagA.position.set(-0.2, yA - 0.5, 0.4);
    tagC.position.set(1.47, yC - 0.38, 0.4);
  }

  apply(); // 첫 프레임 전 초기 자세

  return {
    group: g,
    notes: () => [
      { label: 'P 높이', value: yP.toFixed(2) },
      { label: 'A 높이 / 추 C 높이', value: yA.toFixed(2) + ' / ' + yC.toFixed(2) },
      { label: '속도비 D : P', value: '0.31 : 0.38 (P 가 1.23배 빠름)' },
      { label: 'A', value: '헐거운 풀리 2장 — 서로 반대로 돈다' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
