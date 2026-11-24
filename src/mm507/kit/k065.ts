// 65·66번 전용 키트 — 홈 판(C), 스터드 판(D), 탭핏 팔, 정지 레버, 일부만 이가 있는 웜 휠, 추 달린 팔
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, lathe, loft, merge, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile, TAU, type LoftLayer } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import type { V2 } from './belt';

const MARK = 0xf2b619;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** 판 한 장: 테(외곽 → 안쪽 구멍 rRim) + 스포크 + 허브 + 표시점. 회전축 = 로컬 Z, 두께 w 가운데 z = 0 */
function spokedDisk(outline: V2[], rOut: number, rRim: number, w: number, spokes: number, body: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const c = Math.min(0.012, w * 0.12);
  const layers: LoftLayer[] = [
    { z: -w / 2, s: (rOut - c) / rOut, hs: (rRim + c) / rRim },
    { z: -w / 2 + c, s: 1, hs: 1 },
    { z: w / 2 - c, s: 1, hs: 1 },
    { z: w / 2, s: (rOut - c) / rOut, hs: (rRim + c) / rRim }
  ];
  g.add(mesh(loft(outline, [circlePts(rRim, 72)], layers), body));
  const bore = 0.05;
  const hubOut = bore + 0.07;
  const hubGeo = lathe(tubeProfile(bore, hubOut, -(w / 2 + 0.018), w / 2 + 0.018, 0.01), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < spokes; i++) {
    const b = new THREE.BoxGeometry(rRim - hubOut + 0.02, 0.07, w * 0.5);
    b.translate(hubOut + (rRim - hubOut) / 2, 0, 0);
    b.rotateZ((i / spokes) * TAU);
    geos.push(b);
  }
  g.add(mesh(merge(geos), body));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.02, 0.01), paint(MARK), (hubOut + rRim) / 2, 0, w * 0.25 + 0.004));
  return g;
}

export interface NotchSpec {
  /** 홈 중심의 로컬 각(rad) */
  center: number;
  /** 바닥이 평평한 구간의 반각(rad) */
  flat: number;
  /** 한쪽 비탈의 각 폭(rad) */
  ramp: number;
  /** 깊이(반지름 방향) */
  depth: number;
}

/** 홈 바닥 반지름 — 로컬 각 nu 에서. 판 반지름 r 에서 홈 깊이만큼 들어간다(비탈은 smoothstep) */
export function notchFloor(r: number, n: NotchSpec, nu: number): number {
  const d = Math.abs((((nu - n.center + Math.PI) % TAU) + TAU) % TAU - Math.PI);
  return r - n.depth * (1 - smooth((d - n.flat) / n.ramp));
}

/**
 * 테두리 한 곳에 홈이 파인 원판(65번 구동 바퀴 C): 테 + 스포크 5개 + 허브. 축 = 로컬 Z, 두께 가운데 z = 0.
 * 홈 윤곽은 userData.outline(반시계 다각형)에도 담는다(침범 검사용).
 */
export function notchedDisk(r: number, notch: NotchSpec, opts: { width?: number; spokes?: number; driver?: boolean } = {}): THREE.Group {
  const w = opts.width ?? 0.16;
  const n = 240;
  const outline: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = notchFloor(r, notch, a);
    outline.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = spokedDisk(outline, r, r * 0.76, w, opts.spokes ?? 5, body);
  g.userData.outline = outline;
  return g;
}

export interface StudDiskOpts {
  width?: number;
  spokes?: number;
  /** 스터드 윗면이 판 앞면(z = width/2)에서 튀어나온 길이(기본 0.24) */
  studHeight?: number;
}

/**
 * 스터드 원판(65번 D): 같은 간격(2π/count)으로 판 앞면에서 튀어나온 원통 스터드 count 개.
 * 스터드 i 의 로컬 각 = i·2π/count (원점 중심 반지름 ringR). 축 = 로컬 Z, 판 두께 가운데 z = 0.
 */
export function studDisk(r: number, count: number, ringR: number, studR: number, opts: StudDiskOpts = {}): THREE.Group {
  const w = opts.width ?? 0.06;
  const hgt = opts.studHeight ?? 0.24;
  const g = spokedDisk(circlePts(r, 120), r, r * 0.8, w, opts.spokes ?? 5, brass());
  const cyl = new THREE.CylinderGeometry(studR, studR, hgt, 20);
  cyl.rotateX(Math.PI / 2);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const m = meshAt(cyl, steel(), Math.cos(a) * ringR, Math.sin(a) * ringR, w / 2 + hgt / 2 - 0.004);
    g.add(m);
    g.add(meshAt(new THREE.CylinderGeometry(studR * 0.62, studR * 0.62, 0.012, 16).rotateX(Math.PI / 2), paint(MARK), Math.cos(a) * ringR, Math.sin(a) * ringR, w / 2 + hgt - 0.002));
  }
  return g;
}

/**
 * 탭핏(밀개) 팔: 로컬 +X 방향 막대(원점 = 바퀴 중심에서 length 까지), 끝 반폭 halfW, 두께 thick(z 가운데 0).
 * rootHalf 를 주면 판화(65번)처럼 **허브 쪽이 넓고 끝이 가는 쐐기 모양**: 윤곽 (0, ∓rootHalf) → (length − halfW, ∓halfW) + 둥근 끝.
 * 원점에 허브 보스. 앞가장자리(스터드를 미는 쪽) = 로컬 y < 0 쪽 변
 *   (rootHalf 없음: y = −halfW / 있음: (0, −rootHalf) 와 (length − halfW, −halfW) 를 잇는 직선).
 * userData.outline 은 일부러 담지 않는다 — 탭핏은 C 판 위(다른 z 층)에 겹쳐 있어 autocheck 다각형 침범 검사가 거짓 불합격을 낸다.
 */
export function tappetArm(length: number, halfW: number, thick = 0.06, rootHalf?: number): THREE.Group {
  const g = new THREE.Group();
  const h0 = rootHalf ?? halfW;
  const xe = length - halfW;
  const outline: V2[] = [[0, -h0], [xe, -halfW]];
  for (let k = 1; k < 12; k++) {
    const b = -Math.PI / 2 + (Math.PI * k) / 12;
    outline.push([xe + halfW * Math.cos(b), halfW * Math.sin(b)]);
  }
  outline.push([xe, halfW], [0, h0]);
  const bar = rootHalf === undefined ? extrude(stadiumShape(0, 0, xe, 0, halfW), thick, 0.008) : extrude(shapeFrom(outline), thick, 0.008);
  g.add(mesh(bar, bronze({ roughness: 0.34 })));
  const hub = lathe(rodProfile(Math.max(0.085, h0), -thick / 2 - 0.01, thick / 2 + 0.025, 0.012), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.014, 0.01), paint(MARK), length * 0.45, 0, thick / 2 + 0.004));
  return g;
}

export interface StopLeverOpts {
  /** 꼬리 끝 중심(받침점 기준 좌표) */
  tail: V2;
  /** 앞쪽 막대 끝(쐐기 아랫면에 이어지는 곳, 받침점 기준) */
  stemEnd: V2;
  /** 쐐기 윗 끝(안쪽 끝) 중심, 받침점 기준 */
  noseTip: V2;
  /** 쐐기 바깥 밑변 중심, 받침점 기준 */
  noseBase: V2;
  /** 쐐기 끝 반폭 / 밑변 반폭 */
  tipHalf: number;
  baseHalf: number;
  /** 막대 반폭, 두께 */
  halfW?: number;
  thick?: number;
}

/**
 * 정지 레버(65번 stop): 받침점이 원점. 꼬리(왼쪽, C 홈에 들어가는 쪽) — 받침점 — 앞 막대 — 쐐기 모양 코(스터드 사이에 들어가는 쪽).
 * 한 평면(z 가운데 0) 위의 한 덩어리. 받침점 핀 보스 포함. 회전은 그룹 rotation.z.
 */
export function stopLever(o: StopLeverOpts): THREE.Group {
  const g = new THREE.Group();
  const hw = o.halfW ?? 0.035;
  const t = o.thick ?? 0.06;
  const mat = steel();
  g.add(mesh(extrude(stadiumShape(o.tail[0], o.tail[1], 0, 0, hw), t, 0.008), mat));
  g.add(mesh(extrude(stadiumShape(0, 0, o.stemEnd[0], o.stemEnd[1], hw), t, 0.008), mat));
  // 쐐기: 밑변→끝 방향 d, 수직 n
  const dx = o.noseTip[0] - o.noseBase[0];
  const dy = o.noseTip[1] - o.noseBase[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  const pts: V2[] = [
    [o.noseBase[0] - nx * o.baseHalf, o.noseBase[1] - ny * o.baseHalf],
    [o.noseTip[0] - nx * o.tipHalf, o.noseTip[1] - ny * o.tipHalf],
    [o.noseTip[0] + nx * o.tipHalf, o.noseTip[1] + ny * o.tipHalf],
    [o.noseBase[0] + nx * o.baseHalf, o.noseBase[1] + ny * o.baseHalf]
  ];
  g.add(mesh(extrude(shapeFrom(pts), t, 0.008), mat));
  // 막대 끝 → 쐐기 밑변 중심을 잇는 짧은 줄기
  g.add(mesh(extrude(stadiumShape(o.stemEnd[0], o.stemEnd[1], o.noseBase[0], o.noseBase[1], hw), t, 0.008), mat));
  const boss = lathe(rodProfile(0.06, -t / 2 - 0.02, t / 2 + 0.03, 0.01), 28);
  boss.rotateX(Math.PI / 2);
  g.add(mesh(boss, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.014, 0.01), paint(MARK), o.tail[0] * 0.5, o.tail[1] * 0.5, t / 2 + 0.004));
  return g;
}

export interface PartialWormWheelOpts {
  width?: number;
  spokes?: number;
  /** wormWheel 과 같은 뜻의 비틀림(폭 z 당 꼭대기 이 이동량 비) */
  tanLead?: number;
}

/**
 * 일부에만 이가 있는 웜 휠(66번 B): wormWheel 과 같은 위상(이 j 의 중심각 = (j+½)·2π/teeth)·같은 헬리컬 비틀림.
 * j = from … from+count−1 에만 이가 있고 나머지는 이뿌리보다 약간 큰 매끈한 원호(반지름 rp − 1.15·module).
 */
export function partialWormWheel(teeth: number, module: number, from: number, count: number, opts: PartialWormWheelOpts = {}): THREE.Group {
  const w = opts.width ?? 0.14;
  const spokes = Math.max(3, opts.spokes ?? 6);
  const rp = (teeth * module) / 2;
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const rb = rp - 1.15 * module;
  const step = TAU / teeth;
  const bore = Math.max(0.024, rp * 0.14);
  const c = Math.min(module * 0.35, w * 0.16);
  const k = -(opts.tanLead ?? 0) / rp;
  const full = involuteOutline(teeth, ra, rf, Math.PI / teeth);
  const regions: V2[][] = Array.from({ length: teeth }, () => []);
  for (const p of full) {
    let a = Math.atan2(p[1], p[0]);
    if (a < 0) a += TAU;
    regions[Math.min(teeth - 1, Math.floor(a / step))]!.push(p);
  }
  const has = (j: number): boolean => (((j - from) % teeth) + teeth) % teeth < count;
  const outline: V2[] = [];
  for (let j = 0; j < teeth; j++) {
    if (has(j)) outline.push(...regions[j]!);
    else for (let q = 0; q < 6; q++) outline.push([Math.cos((j + q / 6) * step) * rb, Math.sin((j + q / 6) * step) * rb]);
  }
  const g = new THREE.Group();
  const rRim = rf * 0.72;
  const zs = [-w / 2, -w / 2 + c, 0, w / 2 - c, w / 2];
  const layers: LoftLayer[] = zs.map((z, i) => {
    const end = i === 0 || i === zs.length - 1;
    return { z, s: end ? (rb - c) / rb : 1, hs: end ? (rRim + c) / rRim : 1, rot: k * z };
  });
  g.add(mesh(loft(outline, [circlePts(rRim, 64)], layers), brass()));
  g.userData.outline = outline;
  const hubOut = bore + rp * 0.14;
  const hubGeo = lathe(tubeProfile(bore, hubOut, -(w / 2 + 0.018), w / 2 + 0.018, 0.01), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < spokes; i++) {
    const b = new THREE.BoxGeometry(rRim - hubOut + 0.02, Math.max(0.02, rp * 0.13), w * 0.4);
    b.translate(hubOut + (rRim - hubOut) / 2, 0, 0);
    b.rotateZ((i / spokes) * TAU);
    geos.push(b);
  }
  g.add(mesh(merge(geos), brass()));
  // 표시점: 이가 있는 구간 가운데 방향 스포크 쪽
  const mid = ((from + count / 2) * TAU) / teeth;
  const mk = meshAt(new THREE.BoxGeometry(0.06, 0.018, 0.01), paint(MARK), 0, 0, w * 0.2 + 0.004);
  mk.position.set(Math.cos(mid) * (hubOut + rRim) * 0.5, Math.sin(mid) * (hubOut + rRim) * 0.5, w * 0.2 + 0.004);
  mk.rotation.z = mid;
  g.add(mk);
  return g;
}

/**
 * 추 달린 팔(66번 D): 원점(바퀴 축)에서 로컬 +X 로 length 까지 막대(두께 thick, z 가운데 0) + 끝에 공 모양 추(반지름 ballR, 중심 = (length, 0, 0)).
 * 원점에 허브 보스. 추는 darkSteel, 막대는 steel.
 */
export function armWeight(length: number, ballR: number, thick = 0.06): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(extrude(stadiumShape(0, 0, length, 0, 0.035), thick, 0.008), steel()));
  const hub = lathe(rodProfile(0.09, -thick / 2 - 0.01, thick / 2 + 0.03, 0.012), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  g.add(meshAt(new THREE.SphereGeometry(ballR, 40, 28), darkSteel(), length, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(ballR * 0.7, 0.016, 0.01), paint(MARK), length, 0, ballR - 0.002));
  return g;
}
