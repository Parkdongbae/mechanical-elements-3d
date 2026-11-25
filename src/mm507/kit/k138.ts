// 138번 전용 키트 — 바닥 캠(삼날 캠)과 그 위에 얹혀 오르내리는 납작 막대, 막대 안내 2개
//  캠: 큰 혹 둘(바깥원까지) + 작은 혹 하나, 골짜기 셋. 발(막대 끝 평면)이 윗 골짜기에 얹힌다.
//  들어 올림은 주기 표(lift138)로: 발 반폭 안에서 윤곽의 최고 높이를 1° 간격으로 미리 풀어 둔다.
// 치수 검증: shots/_verify/s138.mjs (윤곽·표 식이 이 파일과 같다)
import * as THREE from 'three';
import { bronze, castIron, darkSteel, steel } from '../../models/materials';
import { TAU, circlePath, extrude, lathe, mesh, pathFrom, roundedRect, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { setMM } from './mm';

const DEG = Math.PI / 180;
const CLEAR = 0.002; // 발 바닥과 캠 사이의 정한 틈(침범 0)

/** 138번 치수(판화 1px = 0.00524). 세계 좌표 */
export const K138 = {
  CY: 1.1, // 캠 축 높이
  ZC: 0.1, // 캠·막대의 가운데 평면
  R: 0.55, // 큰 혹 반지름(판화의 외접원)
  R_SHORT: 0.38, // 아래 작은 혹 반지름
  RV_TOP: 0.25, // 위 골짜기 바닥(발이 얹히는 골)
  RV_BL: 0.25, // 왼아래 골짜기 바닥
  RV_BR: 0.29, // 오른아래 골짜기 바닥
  HUB: 0.15, // 허브 보스 반지름
  BORE: 0.1, // 축 구멍 반지름
  THICK: 0.09, // 캠 두께
  ROD_W: 0.075, // 막대 폭(x)
  ROD_T: 0.05, // 막대 두께(z)
  ROD_LEN: 1.38, // 막대 길이(발 바닥 → 머리)
  GUIDE_HW: 0.16, // 안내 브래킷 가로 반폭
  GUIDE_HH: 0.058, // 안내 브래킷 세로 반높이
  G_HOLE_W: 0.079, // 안내 구멍 가로(막대 폭 + 틈 0.002씩)
  G_HOLE_T: 0.058, // 안내 구멍 깊이(막대 두께 + 틈 0.004씩)
  G_BLOCK: 0.09, // 안내 블록 두께(z)
  BOLT_X: 0.089, // 볼트 가로 자리(판화 ±17px)
  G1: 2.52, // 위 안내 y
  G2: 2.03 // 아래 안내 y
} as const;

/** 캠 윤곽 절점(로컬 각도°, 반지름) — 판화 자세에서의 세계각. 혹 3 + 골짜기 3, 반시계 */
const NODES138: [number, number][] = [
  [30, K138.R],
  [90, K138.RV_TOP],
  [171, K138.R],
  [247, K138.RV_BL],
  [285, K138.R_SHORT],
  [329, K138.RV_BR]
];

/**
 * 캠 반지름(로컬 각 phi, rad). 이웃 절점 사이를 sin² 로 이은 곡선(양 끝에서 접선 수평).
 * 혹이 둥근 봉우리, 골짜기가 둥근 골 — 어느 각도에서도 매끈해서 계속 돌 수 있다.
 */
export function camRadius138(phi: number): number {
  let p = ((phi % TAU) + TAU) % TAU;
  if (p < NODES138[0]![0]! * DEG) p += TAU; // 첫 절점 앞은 마지막 구간(329°→390°)으로 접는다
  for (let i = 0; i < NODES138.length; i++) {
    const a0 = NODES138[i]![0]! * DEG;
    const r0 = NODES138[i]![1]!;
    const j = (i + 1) % NODES138.length;
    const a1 = j === 0 ? NODES138[0]![0]! * DEG + TAU : NODES138[j]![0]! * DEG;
    const r1 = NODES138[j]![1]!;
    if (p >= a0 && p <= a1) {
      const f = (p - a0) / (a1 - a0);
      return r0 + (r1 - r0) * Math.sin((Math.PI * f) / 2) ** 2;
    }
  }
  return K138.R;
}

/** 캠 윤곽(로컬, 반시계 n 점) — userData.outline 과 주기 표가 같이 쓴다 */
export function camOutline138(n = 288): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = camRadius138(a);
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

let tab138: Float64Array | null = null;

/** 주기 표(360칸): 캠이 u°(칸) 돌았을 때 발 받침 높이 = 발 반폭 안 윤곽의 최고 y + 정한 틈 */
function buildTable138(): Float64Array {
  const tab = new Float64Array(360);
  const prof = camOutline138(1440);
  const w = K138.ROD_W / 2;
  for (let k = 0; k < 360; k++) {
    const u = k * DEG;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    let m = -Infinity;
    for (const [px, py] of prof) {
      const x = px * cu - py * su;
      if (Math.abs(x) > w) continue;
      const y = px * su + py * cu;
      if (y > m) m = y;
    }
    tab[k] = m + CLEAR;
  }
  return tab;
}

/**
 * 캠이 u(rad) 돌았을 때 막대 발(평면 바닥)의 축 위 높이. 1° 주기 표 + 선형 보간(처음 부를 때 한 번 계산).
 * 한 바퀴에 정확히 닫힌다: u+2π 는 같은 칸. 범위 약 0.255 ~ 0.552(행정 0.297).
 */
export function lift138(u: number): number {
  if (tab138 === null) tab138 = buildTable138();
  const tab = tab138;
  const n = tab.length;
  const x = ((((u / TAU) % 1) + 1) % 1) * n;
  const i0 = Math.floor(x) % n;
  const f = x - Math.floor(x);
  const a = tab[i0] ?? 0;
  const b = tab[(i0 + 1) % n] ?? 0;
  return a + (b - a) * f;
}

export interface CamPlate138Opts {
  /** 두께(기본 K138.THICK) */
  thick?: number;
  /** 축 구멍 반지름(기본 K138.BORE) */
  bore?: number;
  /** 허브 보스 반지름(기본 K138.HUB) */
  hubR?: number;
}

/**
 * 삼날 캠 판. **원점 = 축**, 회전축 = 로컬 Z, 두께 가운데 z = 0. 판화 자세가 로컬 각도(모델이 rotation.z = u).
 * userData.outline = camOutline138(288). 청동(구동). 판화에 없는 표시점은 두지 않는다.
 */
export function camPlate138(o: CamPlate138Opts = {}): THREE.Group {
  const thick = o.thick ?? K138.THICK;
  const bore = o.bore ?? K138.BORE;
  const hubR = o.hubR ?? K138.HUB;
  const g = new THREE.Group();
  const outline = camOutline138(288);
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, bore));
  g.add(mesh(extrude(shape, thick, 0.008, 48), bronze({ roughness: 0.36 })));
  // 허브 보스(판화의 두 겹 원: 바깥 고리 + 구멍)
  const hubGeo = lathe(tubeProfile(bore, hubR, -(thick / 2 + 0.015), thick / 2 + 0.015, 0.008), 40);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, bronze({ roughness: 0.3 })));
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', shape: 'threeLobe', rMax: K138.R, width: thick, axis: 'z' });
  return g;
}

/**
 * 납작 막대(평평한 발이 아래). **원점 = 발 바닥 가운데**, 막대는 로컬 +Y 로 len, 두께 가운데 z = 0.
 * userData.outline = 발 끝 테두리(아래 변을 잘게 나눈다 — 캠 윤곽과의 침범 검사용).
 * child 표식 'foot' = 발 바닥 가운데(연결 표의 점). 모델이 position.y = CY + lift138(u).
 */
export function rodBar138(len: number): THREE.Group {
  const w = K138.ROD_W / 2;
  const t = K138.ROD_T;
  const g = new THREE.Group();
  const bodyGeo = extrude(roundedRect(-w, 0, w, len, 0.008), t, 0.004);
  g.add(mesh(bodyGeo, steel()));
  // 발 테두리(아래 변 0.009 간격 + 위 두 구석)
  const foot: V2[] = [];
  const nEdge = 9;
  for (let i = 0; i <= nEdge; i++) foot.push([-w + ((2 * w) / nEdge) * i, 0]);
  foot.push([w, 0.012], [-w, 0.012]);
  g.userData.outline = foot;
  const footMark = new THREE.Object3D();
  footMark.name = 'foot';
  g.add(footMark);
  setMM(g, { kind: 'rod', r: t / 2, a: [0, 0, 0], b: [0, len, 0], length: len });
  return g;
}

/**
 * 막대 안내 브래킷(판화: 네모 블록 + 볼트 둘). **원점 = 구멍 가운데**(모델이 (0, y, ZC) 에 놓는다).
 * 막대가 지나는 네모 구멍(X폭 G_HOLE_W × Z깊이 G_HOLE_T) + 앞면 볼트 둘 + 뒤판까지 받침 기둥(판화에 없음 — 최소 보충).
 * userData.outlines.hole = 구멍 윤곽(변을 잘게 나눈다). 주철.
 */
export function rodGuide138(zc: number): THREE.Group {
  const hw = K138.GUIDE_HW;
  const hh = K138.GUIDE_HH;
  const gw = K138.G_HOLE_W / 2;
  const gt = K138.G_HOLE_T / 2;
  const g = new THREE.Group();
  const iron = castIron();
  // 블록 = 막대 터널(단면 x G_HOLE_W × z G_HOLE_T, 막대 슬라이드 방향 y 로 관통)을 윗·아래 U 짝으로 뚫고
  //  가운데 날개 2 장 사이에 창(네모 구멍)을 남긴다 — 막대가 창으로 앞에서 보인다(판화).
  const prof = roundedRect(-hw, -K138.G_BLOCK / 2, hw, K138.G_BLOCK / 2, 0.02);
  prof.holes.push(
    pathFrom([
      [-gw, -gt],
      [gw, -gt],
      [gw, gt],
      [-gw, gt]
    ])
  );
  const slabH = hh - gt;
  for (const sy of [-1, 1]) {
    const slabGeo = extrude(prof, slabH, 0.006);
    slabGeo.rotateX(-Math.PI / 2); // 압출축 z → 세로 y (터널이 막대를 따라 관통)
    slabGeo.translate(0, sy * (gt + slabH / 2), 0);
    g.add(mesh(slabGeo, iron));
  }
  const wingW = hw - gw;
  for (const sx of [-1, 1]) {
    const wing = mesh(new THREE.BoxGeometry(wingW, gt * 2, K138.G_BLOCK), iron);
    wing.position.set(sx * (gw + wingW / 2), 0, 0);
    g.add(wing);
  }
  // 앞면 볼트 둘(판화의 작은 원)
  for (const sx of [-1, 1]) {
    const bolt = new THREE.CylinderGeometry(0.024, 0.024, 0.017, 20);
    bolt.rotateX(Math.PI / 2);
    const bm = mesh(bolt, darkSteel());
    bm.position.set(sx * K138.BOLT_X, 0, K138.G_BLOCK / 2 + 0.006);
    g.add(bm);
  }
  // 뒤판까지 받침 기둥(블록 뒷면 → 뒤판 앞면)
  const back = STAGE.backZ - zc; // 로컬 z 로 찍은 뒤판 앞면
  const zA = -K138.G_BLOCK / 2;
  const postLen = zA - back;
  if (postLen > 0.005) {
    const post = new THREE.BoxGeometry(0.22, hh * 1.9, postLen);
    const pm = mesh(post, iron);
    pm.position.set(0, 0, back + postLen / 2);
    g.add(pm);
    const footPlate = new THREE.BoxGeometry(0.3, hh * 2.6, 0.03);
    const fm = mesh(footPlate, darkSteel());
    fm.position.set(0, 0, back + 0.015);
    g.add(fm);
  }
  // 터널 윤곽(막대가 지나가는 x-y 발자국, 변을 잘게 나눠 침범 검사가 변 위의 점도 보게)
  const hole: V2[] = [];
  const corners: V2[] = [
    [-gw, -hh],
    [gw, -hh],
    [gw, hh],
    [-gw, hh]
  ];
  for (let k = 0; k < 4; k++) {
    const a = corners[k]!;
    const b = corners[(k + 1) % 4]!;
    for (let i = 0; i < 12; i++) hole.push([a[0]! + ((b[0]! - a[0]!) * i) / 12, a[1]! + ((b[1]! - a[1]!) * i) / 12]);
  }
  g.userData.outlines = { hole };
  setMM(g, { kind: 'guide', axis: 'y', len: K138.G_HOLE_W });
  return g;
}
