// 003 안내 풀리로 직각 전동 — 가닥마다 하나씩 나란한 안내 풀리 2개(서로 반대로 돈다)를 넘어
//     Z축 풀리에서 X축 드럼으로 팽팽한 밧줄 전동 (판화 3번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, pillow, pulley, rod, shaftZ, tag } from '../kit';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh } from '../../models/parts/geom';
import { ROPE_R } from '../kit/belt';

// 풀리 P(구동): 중심 (1.0, 2.6), 축 Z, z = 0.2
const CPX = 1.0;
const CPY = 2.6;
const RP = 0.42;
const RB = RP + 0.01; // 로프 중심이 도는 반지름 (홈 바닥 = r + 0.01)
// 안내 풀리 2개: 공통 축 (-0.75, 2.75), 가닥마다 하나씩 나란히.
//   GF(앞, z = 0.35) = P 윗가닥 → 드럼 앞쪽 가닥,  GB(뒤, z = 0.05) = 드럼 뒤쪽 가닥 → P 아랫가닥
const CGX = -0.75;
const CGY = 2.75;
const RG = 0.16;
const RGB = RG + 0.01;
const ZP = 0.2;
const ZGF = 0.35;
const ZGB = 0.05;
// 드럼 D(종동): 축 = X. 두 가닥 모두 안내 풀리 왼쪽 끝에서 곧게 내려오므로(판화) 드럼 가운데 홈을 그 바로 아래에 둔다
const DX = CGX - RGB;
const DY = 1.05;
const DZ = ZP;
const RD = 0.32;
const RDB = RD + 0.01;
const SPACING = 0.035; // 로프 점 간격 (꼬임 무늬가 매끈하도록 촘촘히)
const TAU = Math.PI * 2;

const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const wrap = (a: number): number => ((a % TAU) + TAU) % TAU; // [0, 2π)

/** Z축 원 A → B 접선(XY 투영). 부호 있는 반지름 ρ(반시계 +, 시계 −)로 바깥·엇걸이 접선을 한 식으로 푼다.
 *  접점의 원 위 각도를 돌려준다 */
function tangentZ(
  cA: [number, number],
  rhoA: number,
  cB: [number, number],
  rhoB: number
): { aA: number; aB: number } {
  const dx = cB[0] - cA[0];
  const dy = cB[1] - cA[1];
  const th = Math.atan2(dy, dx) + Math.asin((rhoA - rhoB) / Math.hypot(dx, dy));
  // 접점 = 중심 + ρ·(ty, −tx)
  const ang = (rho: number): number => Math.atan2(-rho * Math.cos(th), rho * Math.sin(th));
  return { aA: ang(rhoA), aB: ang(rhoB) };
}

/** 안내 풀리 왼쪽 끝 (DX, CGY, z0) 에서 드럼 원(YZ 평면, 중심 (DY, DZ), 반지름 RDB)에 그은 접선의 접점 각 ψ.
 *  front = 드럼 앞쪽(z 큰 쪽) 접점 */
function drumTangent(z0: number, front: boolean): number {
  const dy = CGY - DY;
  const dz = z0 - DZ;
  const phi = Math.atan2(dz, dy);
  const al = Math.acos(RDB / Math.hypot(dy, dz));
  return front ? phi + al : phi - al;
}

/** 로프 중심선(닫힌 점열) + 점마다 수직 단면 기준 N (평행 운반, 이음매 비틀림 보정) */
function ropePath(): { pts: THREE.Vector3[]; wds: THREE.Vector3[] } {
  const pts: THREE.Vector3[] = [];
  const cP: [number, number] = [CPX, CPY];
  const cG: [number, number] = [CGX, CGY];
  // 접선들 (모두 직선 = 두 원에 접하는 선)
  const tPG = tangentZ(cP, RB, cG, RGB); // P 윗면 → GF 윗면 (바깥 접선, 둘 다 반시계)
  const tGP = tangentZ(cG, -RGB, cP, RB); // GB 오른쪽 위 → P 아랫면 (엇걸이 접선, GB 는 시계)
  const psiF = drumTangent(ZGF, true); // GF 왼쪽 끝 → 드럼 앞쪽
  const psiB = drumTangent(ZGB, false); // 드럼 뒤쪽 → GB 왼쪽 끝
  /** 호: a0 에서 a1 까지 ccw(+)/cw(−) 방향으로 (끝점 제외) */
  const arcPts = (
    cx: number,
    cy: number,
    r: number,
    z: number,
    a0: number,
    a1: number,
    ccw: boolean
  ): void => {
    const d = ccw ? wrap(a1 - a0) : wrap(a0 - a1);
    const n = Math.max(2, Math.ceil((d * r) / SPACING), Math.ceil(d / 0.09));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((ccw ? d : -d) * i) / n;
      pts.push(v3(cx + r * Math.cos(a), cy + r * Math.sin(a), z));
    }
  };
  const lineTo = (p0: THREE.Vector3, p1: THREE.Vector3): void => {
    const n = Math.max(2, Math.ceil(p0.distanceTo(p1) / SPACING));
    for (let i = 0; i < n; i++) pts.push(p0.clone().lerp(p1, i / n));
  };
  const gP = (a: number, r: number, c: [number, number], z: number): THREE.Vector3 =>
    v3(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), z);
  const dr = (psi: number): THREE.Vector3 => v3(DX, DY + RDB * Math.cos(psi), DZ + RDB * Math.sin(psi));
  // 1) P 둘레: GB→P 접점에서 P→GF 접점까지 (반시계)
  arcPts(CPX, CPY, RB, ZP, tGP.aB, tPG.aA, true);
  // 2) P → GF 직선
  lineTo(gP(tPG.aA, RB, cP, ZP), gP(tPG.aB, RGB, cG, ZGF));
  // 3) GF 둘레: 위 → 왼쪽 끝 (반시계)
  arcPts(CGX, CGY, RGB, ZGF, tPG.aB, Math.PI, true);
  // 4) GF 왼쪽 끝 → 드럼 앞 직선 (정면에서 보면 수직)
  lineTo(gP(Math.PI, RGB, cG, ZGF), dr(psiF));
  // 5) 드럼 둘레 (앞 → 아래 → 뒤), 평면 x = DX
  {
    const d = wrap(psiB - psiF);
    const n = Math.ceil((d * RDB) / SPACING);
    for (let i = 0; i < n; i++) pts.push(dr(psiF + (d * i) / n));
  }
  // 6) 드럼 뒤 → GB 왼쪽 끝 직선
  lineTo(dr(psiB), gP(Math.PI, RGB, cG, ZGB));
  // 7) GB 둘레: 왼쪽 끝 → 위 → 오른쪽 위 (시계)
  arcPts(CGX, CGY, RGB, ZGB, Math.PI, tGP.aA, false);
  // 8) GB → P 직선 (엇걸이 접선)
  lineTo(gP(tGP.aA, RGB, cG, ZGB), gP(tGP.aB, RB, cP, ZP));
  // 단면 기준 벡터: 커널과 같은 접선(중앙차분)에 수직으로 평행 운반
  const n = pts.length;
  const tan = (i: number): THREE.Vector3 =>
    pts[(i + 1) % n]!.clone().sub(pts[(i - 1 + n) % n]!).normalize();
  const Ns: THREE.Vector3[] = [];
  let N = new THREE.Vector3(0, 0, 1);
  {
    const T0 = tan(0);
    N.addScaledVector(T0, -N.dot(T0));
    if (N.lengthSq() < 1e-6) N.set(1, 0, 0).addScaledVector(T0, -T0.x);
    N.normalize();
  }
  Ns.push(N.clone());
  for (let i = 1; i < n; i++) {
    const T = tan(i);
    N = N.clone().addScaledVector(T, -N.dot(T)).normalize();
    Ns.push(N);
  }
  // 이음매 비틀림(holonomy) 보정: 마지막 N 을 처음 T0 로 운반해 N0 와의 각도를 구해 길이에 따라 분산
  {
    const T0 = tan(0);
    const last = Ns[n - 1]!.clone().addScaledVector(T0, -Ns[n - 1]!.dot(T0)).normalize();
    const cr = new THREE.Vector3().crossVectors(last, Ns[0]!);
    const ang = Math.atan2(cr.dot(T0), last.dot(Ns[0]!));
    for (let i = 1; i < n; i++) {
      Ns[i]!.applyAxisAngle(tan(i), (ang * i) / n);
    }
  }
  return { pts, wds: Ns };
}

export default function buildM003(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 풀리 P(구동) + 안내 풀리 G1·G2(자유 회전, 공통 축) — 기본 로프 홈 림
  const pP = pulley(RP, { driver: true });
  pP.position.set(CPX, CPY, ZP);
  const gF = pulley(RG, { spokes: 4, hub: 0.055 });
  gF.position.set(CGX, CGY, ZGF);
  const gB = pulley(RG, { spokes: 4, hub: 0.055 });
  gB.position.set(CGX, CGY, ZGB);
  g.add(pP, gF, gB, shaftZ(CPX, CPY), shaftZ(CGX, CGY, 0.52));

  // 드럼 D: X축 원통(가운데 로프 홈) + 양끝 허브 + +X 끝면 스포크·표시점
  const drum = new THREE.Group();
  drum.position.set(DX, DY, DZ);
  {
    const L = 0.25;
    const c = 0.012;
    const gr = ROPE_R + 0.004;
    const rc = RDB;
    const prof: [number, number][] = [
      [0, -L],
      [RD - c, -L],
      [RD, -L + c],
      [RD, -gr - 0.004],
      [rc, -gr]
    ];
    for (let i = 1; i < 12; i++) {
      const t = -Math.PI / 2 + (i / 12) * Math.PI;
      prof.push([rc - gr * Math.cos(t), gr * Math.sin(t)]);
    }
    prof.push([rc, gr], [RD, gr + 0.004], [RD, L - c], [RD - c, L], [0, L]);
    const bodyGeo = lathe(prof, 64);
    bodyGeo.rotateZ(-Math.PI / 2); // Y축 → X축
    drum.add(mesh(bodyGeo, brass()));
  }
  for (const sx of [-1, 1]) {
    const hubGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 24);
    hubGeo.rotateZ(-Math.PI / 2);
    const hub = mesh(hubGeo, darkSteel());
    hub.position.x = sx * 0.26;
    drum.add(hub);
  }
  for (let i = 0; i < 3; i++) {
    const spGeo = new THREE.BoxGeometry(0.012, RD - 0.18, 0.024);
    spGeo.translate(0, 0.09 + (RD - 0.18) / 2, 0);
    spGeo.rotateX((i / 3) * Math.PI * 2);
    const sp = mesh(spGeo, steel());
    sp.position.x = 0.253;
    drum.add(sp);
  }
  const mkGeo = new THREE.BoxGeometry(0.014, 0.06, 0.02);
  mkGeo.translate(0, 0.3, 0);
  const mark = mesh(mkGeo, paint(0xf2b619));
  mark.position.x = 0.256;
  drum.add(mark);
  g.add(drum);

  // 드럼 축(관통) + 받침대에 세운 기둥 2개 + 필로 블록
  g.add(rod(v3(DX - 0.39, DY, DZ), v3(DX + 0.39, DY, DZ), 0.035));
  for (const cx of [DX - 0.39, DX + 0.39]) {
    const colGeo = new THREE.BoxGeometry(0.14, 0.84, 0.14);
    const col = mesh(colGeo, castIron());
    col.position.set(cx, 0.42, DZ); // 0~0.84, 받침에 약간 묻혀 심음
    g.add(col);
    g.add(pillow(cx, 0.84, DZ, 'x'));
  }

  // 밧줄(기본 로프 스타일): 직선 접선 + 홈을 따르는 호
  const rp = ropePath();
  const belt = new Belt(rp.pts, { widthDirs: rp.wds });
  g.add(belt.group);
  g.add(tag('구동 풀리', v3(1.65, 3.1, 0.3)));
  g.add(tag('안내 풀리', v3(-1.5, 3.05, 0.35)));
  g.add(tag('종동 드럼(직각 축)', v3(DX, 0.42, 0.5)));

  return {
    group: g,
    notes: () => [
      { label: '축의 관계', value: '직각' },
      { label: '안내 풀리', value: '2개 · 서로 반대로 돈다' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      const v = theta * RB; // 로프 속도 = P 홈 바닥(로프 중심) 속도
      pP.rotation.z = theta;
      gF.rotation.z = v / RGB; // 윗가닥: 위 → 왼쪽으로 넘어 내려간다 (반시계)
      gB.rotation.z = -v / RGB; // 아랫가닥: 왼쪽에서 올라와 위 → 오른쪽으로 넘는다 (시계) — 그래서 풀리가 2개다
      drum.rotation.x = v / RDB; // 앞가닥이 내려가는 방향
      belt.setOffset(v);
    }
  };
}
