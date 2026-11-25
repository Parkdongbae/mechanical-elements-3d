// 004 같은 평면의 직각 전동 — 엇걸이 밧줄이 아래 가운데 수직축 드럼을 여러 바퀴 감는다 (판화 4번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, leaderTo, pulley, ROPE_R, rod, rotArrow, shaftZ, tag, type V2 } from '../kit';
import { brass, castIron, darkSteel } from '../../models/materials';
import { lathe, mesh } from '../../models/parts/geom';

const RT = 0.42; // T(구동) 반지름
const RL = 0.2; // L·R(안내) 반지름
const RG = 0.16; // G(종동·수직축) 코어 반지름
const HB = 0.01; // 로프 중심 = 풀리 r + 0.01 (기본 홈 바닥)
const Z0 = 0.25; // T·L·R 풀리와 로프 평면 높이
const CT: V2 = [0, 2.7];
// 안내 풀리 높이를 ±0.05 달리해 아랫가닥이 드럼의 위 칸·아래 칸으로 거의 수평으로 드나들게 한다(감긴 줄과 닿지 않게)
const CR: V2 = [1.25, 1.1];
const CL: V2 = [-1.25, 1.0];
const RTB = RT + HB;
const RLB = RL + HB;
const GR = RG + ROPE_R + 0.004; // 드럼 위 로프 중심 반지름(코어에 앉는다)
const GY = (CR[1] + CL[1]) / 2 - RLB; // G 중심 y = 두 안내 풀리 밑점 높이의 가운데(감김 구간의 가운데)
const GZ = Z0 + GR; // 드럼 뒷면이 로프 평면(z = Z0)에 닿는다 → 아랫가닥이 평면을 벗어나지 않고 곧게 들어온다
const NT = 3; // 드럼에 감기는 바퀴 수
const PITCH = 2.9 * ROPE_R; // 한 바퀴에 내려가는 높이 (> 로프 지름)
const STEP = 0.03; // 로프 점 간격 (꼬임 무늬가 매끈하도록 촘촘히)
const ZX = 0.05; // 엇걸이 교차점에서 가닥 하나가 벌어지는 z (간격 0.10 > 로프 지름 0.09)
const TAU = Math.PI * 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const wrap = (a: number): number => ((a % TAU) + TAU) % TAU;

/** 원 A → 원 B 접선의 두 접점. ρ = 부호 있는 반지름(반시계 +, 시계 −, 점이면 0) */
function tangent(A: V2, rhoA: number, B: V2, rhoB: number): { dep: V2; arr: V2 } {
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const th = Math.atan2(dy, dx) + Math.asin((rhoA - rhoB) / Math.hypot(dx, dy));
  const tx = Math.cos(th);
  const ty = Math.sin(th);
  return { dep: [A[0] + rhoA * ty, A[1] - rhoA * tx], arr: [B[0] + rhoB * ty, B[1] - rhoB * tx] };
}

/** 두 선분 (a→b)·(c→d)의 교차점이 a→b 위에서 차지하는 비율 t */
function crossT(a: V2, b: V2, c: V2, d: V2): number {
  const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]);
  return ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den;
}

/** 드럼 위 나선: 뒷면(z = Z0)에서 −X 쪽으로 감겨 들어가 NT 바퀴 뒤 같은 자리에서 나온다.
 *  들어오고 나가는 가닥의 기울기 m(진행 방향으로 올라가는 쪽 +)과 꺾임 없이 이어지도록
 *  처음·끝 1/12 바퀴 동안만 기울기를 m → −k(나선 기울기)로 바꾼다. 반환: 호장별 높이 변화 dy[] */
function helixDy(m: number, n: number): number[] {
  const S = NT * TAU * GR;
  const b = (TAU * GR) / 12;
  const k = PITCH / (TAU * GR);
  const sl = (s: number): number => {
    if (s < b) return m + (-k - m) * (s / b);
    if (s > S - b) return m + (-k - m) * ((S - s) / b);
    return -k;
  };
  const out = [0];
  for (let i = 1; i <= n; i++) {
    const s0 = (S * (i - 1)) / n;
    const s1 = (S * i) / n;
    out.push(out[i - 1]! + ((sl(s0) + sl(s1)) / 2) * (s1 - s0));
  }
  return out;
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

  // ── 로프 경로 ──────────────────────────────────────────────
  // 나선의 시작·끝 높이(yS > yE)와 아랫가닥 접선을 함께 푼다 (가닥 기울기 ↔ 나선 높이, 몇 번 반복이면 수렴)
  const nH = Math.ceil((NT * TAU * GR) / 0.02);
  let dyH = helixDy(0, nH);
  let yS = GY - dyH[nH]! / 2;
  let yE = GY + dyH[nH]! / 2;
  let tRS = tangent(CR, -RLB, [0, yS], 0); // R 밑 → 드럼 뒷면(나선 시작점)
  let tEL = tangent([0, yE], 0, CL, -RLB); // 드럼 뒷면(나선 끝점) → L 밑
  for (let it = 0; it < 8; it++) {
    const m = (yS - tRS.dep[1]) / (tRS.dep[0] - 0); // 진행(−X) 방향으로 올라가는 기울기
    dyH = helixDy(m, nH);
    yS = GY - dyH[nH]! / 2;
    yE = GY + dyH[nH]! / 2;
    tRS = tangent(CR, -RLB, [0, yS], 0);
    tEL = tangent([0, yE], 0, CL, -RLB);
  }
  const yMax = yS + Math.max(...dyH);
  const yMin = yS + Math.min(...dyH);
  // ①~③ T 반시계, 엇걸이라 L·R 은 시계
  const tTR = tangent(CT, RTB, CR, -RLB);
  const tLT = tangent(CL, -RLB, CT, RTB);

  const path: THREE.Vector3[] = [];
  /** 직선(끝점 제외). zAt(u) 로 z 를 준다 */
  const line = (a: V2, b: V2, zAt: (u: number) => number = () => Z0): void => {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP));
    for (let i = 0; i < n; i++) {
      const u = i / n;
      path.push(v(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, zAt(u)));
    }
  };
  /** 호(끝점 제외): 점 p0 에서 p1 까지 원 c 를 ccw/cw 로 */
  const arc = (c: V2, r: number, p0: V2, p1: V2, ccw: boolean): void => {
    const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
    const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
    const d = ccw ? wrap(a1 - a0) : wrap(a0 - a1);
    const n = Math.max(2, Math.ceil((d * r) / STEP), Math.ceil(d / 0.09));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((ccw ? d : -d) * i) / n;
      path.push(v(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), Z0));
    }
  };
  // 엇걸이 가닥: 양 끝(홈)은 z = Z0, 교차점(비율 uc)에서 Z0 + dz — 서로 비켜 가는 팽팽한 줄
  const crossZ =
    (uc: number, dz: number) =>
    (u: number): number => {
      const w = u < uc ? u / uc : (1 - u) / (1 - uc); // 0 → 1 → 0
      return Z0 + dz * w * w * (3 - 2 * w);
    };
  const ucTR = crossT(tTR.dep, tTR.arr, tLT.dep, tLT.arr);
  const ucLT = crossT(tLT.dep, tLT.arr, tTR.dep, tTR.arr);

  line(tTR.dep, tTR.arr, crossZ(ucTR, +ZX)); // T → R (교차부에서 앞)
  arc(CR, RLB, tTR.arr, tRS.dep, false); // R 바깥·아래
  line(tRS.dep, [0, yS]); // R 밑 → 드럼 뒷면
  for (let i = 0; i < nH; i++) {
    // 드럼 나선 (뒤 → 왼쪽 → 앞 → 오른쪽 → 뒤 …)
    const a = -Math.PI / 2 - (NT * TAU * i) / nH;
    path.push(v(GR * Math.cos(a), yS + dyH[i]!, GZ + GR * Math.sin(a)));
  }
  line([0, yE], tEL.arr); // 드럼 뒷면 → L 밑
  arc(CL, RLB, tEL.arr, tLT.dep, false); // L 아래·바깥
  line(tLT.dep, tLT.arr, crossZ(ucLT, -ZX)); // L → T (교차부에서 뒤)
  arc(CT, RTB, tLT.arr, tTR.dep, true); // T 윗면

  // ── 종동 드럼 G — 로프를 여러 번 감는 캡스턴. 회전축 Y, 중심 (0, GY, GZ) ──
  const RF = GR + 0.035; // 위·아래 플랜지
  const fw = 0.03;
  const dy0 = yMin - ROPE_R - 0.02 - fw - GY; // 플랜지 안쪽 면이 로프에서 0.02 떨어진다
  const dy1 = yMax + ROPE_R + 0.02 + fw - GY;
  const gSpin = new THREE.Group();
  gSpin.position.set(0, GY, GZ);
  const drumGeo = lathe(
    [
      [0, dy0],
      [RF - 0.01, dy0],
      [RF, dy0 + 0.01],
      [RF, dy0 + fw],
      [RG, dy0 + fw],
      [RG, dy1 - fw],
      [RF, dy1 - fw],
      [RF, dy1 - 0.01],
      [RF - 0.01, dy1],
      [0, dy1]
    ],
    48
  );
  gSpin.add(mesh(drumGeo, brass()));
  const key = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.07), darkSteel());
  key.position.set(RF - 0.05, dy1 + 0.008, 0);
  gSpin.add(key);
  g.add(gSpin);
  // Y 방향 축: 아래 끝(0.35)은 브래킷 밑면(0.42) 밑으로 삐죽
  g.add(rod(v(0, 0.35, GZ), v(0, dy1 + GY + 0.12, GZ)));
  const brkt = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), castIron());
  brkt.position.set(0, 0.48, GZ);
  const post = mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), castIron());
  post.position.set(0, 0.3, GZ);
  g.add(brkt, post);

  // 로프 단면 기준 방향: 접선을 따라 병렬 운반 + 닫힌 경로 끝의 틀어짐을 고르게 분산
  const n = path.length;
  const tan = (i: number): THREE.Vector3 =>
    path[(i + 1) % n]!.clone().sub(path[(i - 1 + n) % n]!).normalize();
  const ws: THREE.Vector3[] = [];
  let wc = new THREE.Vector3().crossVectors(v(0, 0, 1), tan(0)).normalize();
  for (let i = 0; i < n; i++) {
    const T = tan(i);
    wc = wc.clone().sub(T.clone().multiplyScalar(wc.dot(T))).normalize();
    ws.push(wc);
  }
  {
    const T0 = tan(0);
    const w0 = new THREE.Vector3().crossVectors(v(0, 0, 1), T0).normalize();
    const wEnd = ws[n - 1]!.clone().sub(T0.clone().multiplyScalar(ws[n - 1]!.dot(T0))).normalize();
    const ang = Math.atan2(new THREE.Vector3().crossVectors(wEnd, w0).dot(T0), wEnd.dot(w0));
    for (let i = 0; i < n; i++) ws[i]!.applyAxisAngle(tan(i), (ang * i) / n);
  }

  const belt = new Belt(path, { widthDirs: ws });
  g.add(belt.group);

  // 회전 방향 화살표: T 반시계, G 는 수평면에 눕힌 화살표(위에서 반시계 = 실제 방향)
  const arrT = rotArrow(0.57, true);
  arrT.position.set(CT[0], CT[1], Z0 + 0.09);
  const arrG = rotArrow(0.26, true);
  arrG.rotation.x = -Math.PI / 2;
  arrG.position.set(0, dy1 + GY + 0.04, GZ);
  g.add(arrT, arrG);
  g.add(
    tag('구동 풀리', v(1.05, 2.95, 0.4)),
    tag('안내 풀리', v(-1.95, 1.4, 0.4)),
    leaderTo(tag('종동 풀리(수직축)', v(1.0, 0.5, 0.6)), gSpin)
  );

  return {
    group: g,
    notes: () => [
      { label: '축의 관계', value: '직각 · 같은 평면' },
      { label: '벨트', value: '엇걸이 밧줄 · 드럼에 ' + NT + '바퀴' },
      { label: '속도비', value: '1 : ' + (RTB / GR).toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      pT.rotation.z = theta;
      pL.rotation.z = (-theta * RTB) / RLB; // 엇걸이: T 와 반대, L·R 은 서로 같은 방향
      pR.rotation.z = (-theta * RTB) / RLB;
      gSpin.rotation.y = (theta * RTB) / GR; // 드럼 뒷면의 로프가 −X 로 흐른다 → 위에서 반시계
      belt.setOffset(theta * RTB);
    }
  };
}
