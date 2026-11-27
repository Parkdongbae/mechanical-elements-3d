// 208 핀 휠과 홈 피니언 전용 키트 — 핀 휠(핀 원 셋), 홈 10개 피니언, 3단 변속 시간표
import * as THREE from 'three';
import { brass, castIron, paint, steel } from '../../models/materials';
import { TAU, circlePath, extrude, lathe, merge, mesh, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';

export const K208 = {
  cx: 0,
  cy: 1.65,
  wheelR: 1.1,
  zPlate0: -0.2,
  zPlate1: -0.12,
  pinR: [0.9, 0.675, 0.45] as number[],
  pinN: [24, 18, 12] as number[],
  pinRad: 0.03,
  slots: 10,
  rp: 0.375,
  rOut: 0.4,
  thick: 0.2,
  zc: 0.345,
  X: [-0.9, -0.675, -0.45] as number[],
  omega: 0.6
};

const YELLOW = 0xffcc00;
const GRAY = 0x6b7280;

/** 창(핀이 훑는 영역 + 여유 0.006)의 반호 길이를 반지름별로 적은 표 [반지름, 반호] */
export const DRUM_SLOT208: V2[] = [[0.335, 0.015], [0.35, 0.024], [0.375, 0.04], [0.4, 0.07]];
export const DRUM208 = { w: 0.2, rOut: 0.4, rIn: 0.335 };

/** 드럼 바퀴의 틀 막대 하나(창 k 와 k+1 사이) 단면 점열 — (y, z) = (ρ sin a, -ρ cos a) */
export function drumRungPts208(k: number): V2[] {
  const step = TAU / K208.slots;
  const at = (rho: number, a: number): V2 => [rho * Math.sin(a), -rho * Math.cos(a)];
  const half = (j: number): number => DRUM_SLOT208[j]![1] / DRUM_SLOT208[j]![0];
  const last = DRUM_SLOT208.length - 1;
  const lo = k * step;
  const hi = (k + 1) * step;
  const pts: V2[] = [];
  DRUM_SLOT208.forEach(([rho], j) => pts.push(at(rho, lo + half(j))));
  const a0 = lo + half(last);
  const a1 = hi - half(last);
  for (let i = 1; i <= 5; i++) pts.push(at(DRUM208.rOut, a0 + ((a1 - a0) * i) / 6));
  for (let j = last; j >= 0; j--) pts.push(at(DRUM_SLOT208[j]![0], hi - half(j)));
  return pts;
}

/** 홈 피니언 = 북(드럼) 모양 바퀴: 옆판 둘 + 틀 막대 10 + 어두운 속 + 허브 + 칼라 + 노란 표지. 회전 0 에서 창 0 번이 -z(휠 쪽), 창은 같은 각 간격 */
export function pinion208(): THREE.Group {
  const g = new THREE.Group();
  const W = DRUM208.w;
  const tube = (rIn: number, rOut: number, x0: number, x1: number, c: number, mat: THREE.Material): void => {
    const geo = lathe(tubeProfile(rIn, rOut, x0, x1, c), 48);
    geo.rotateZ(-Math.PI / 2);
    g.add(mesh(geo, mat));
  };
  // 옆판 둘(반지름 0.34 = 핀 끝 아래라 핀이 옆으로 미끄러져 지나감) + 어두운 속
  tube(0.042, 0.34, -W / 2, -W / 2 + 0.035, 0.004, brass());
  tube(0.042, 0.34, W / 2 - 0.035, W / 2, 0.004, brass());
  tube(0.085, 0.322, -W / 2 + 0.034, W / 2 - 0.034, 0, paint(0x1b1f27));
  // 틀 막대 10 (막대 사이가 핀이 들어가는 창)
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
  const rungs: THREE.BufferGeometry[] = [];
  for (let k = 0; k < K208.slots; k++) {
    const geo = extrude(shapeFrom(drumRungPts208(k)), W, 0.002);
    geo.applyMatrix4(basis);
    rungs.push(geo);
  }
  g.add(mesh(merge(rungs), brass()));

  const seg = (r: number, x0: number, x1: number): void => tube(0.042, r, x0, x1, 0.008, brass());
  seg(0.09, -0.17, 0.115);
  seg(0.07, 0.115, 0.145);
  seg(0.09, 0.145, 0.17);
  tube(0.042, 0.11, -0.15, -0.13, 0.004, brass());

  // 창 0 번과 1 번 사이 막대(18도)의 바깥면 표지
  const a = (18 * Math.PI) / 180;
  const mk = mesh(new THREE.BoxGeometry(W + 0.004, 0.03, 0.012), paint(YELLOW));
  mk.position.set(0, 0.404 * Math.sin(a), -0.404 * Math.cos(a));
  mk.rotation.x = Math.PI + a;
  g.add(mk);
  return g;
}

/** 핀 휠: 판, 보스, 핀 54, 색 띠 3, 표지. 그룹 원점 = 휠 중심 */
export function pinWheel208(): { group: THREE.Group; rings: THREE.Mesh[] } {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.absarc(0, 0, K208.wheelR, 0, TAU, false);
  shape.holes.push(circlePath(0, 0, 0.065));
  const plate = mesh(extrude(shape, 0.08, 0.008), castIron());
  plate.position.z = -0.16;
  g.add(plate);
  const boss = lathe(tubeProfile(0.065, 0.2, -0.2, -0.1, 0.01), 48);
  boss.rotateX(Math.PI / 2);
  g.add(mesh(boss, castIron()));

  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const r = K208.pinR[i]!;
    const n = K208.pinN[i]!;
    for (let k = 0; k < n; k++) {
      const a = Math.PI + (TAU * k) / n;
      const body = new THREE.CylinderGeometry(0.03, 0.03, 0.09, 16);
      body.rotateX(Math.PI / 2);
      body.translate(r * Math.cos(a), r * Math.sin(a), -0.075);
      const head = new THREE.SphereGeometry(0.03, 16, 8, 0, TAU, 0, Math.PI / 2);
      head.rotateX(Math.PI / 2);
      head.translate(r * Math.cos(a), r * Math.sin(a), -0.03);
      geos.push(body, head);
    }
  }
  const pins = mesh(merge(geos), steel());
  pins.name = 'pins';
  g.add(pins);

  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = K208.pinR[i]!;
    const m = mesh(new THREE.RingGeometry(r - 0.045, r + 0.045, 96), paint(GRAY));
    m.position.z = -0.118;
    m.name = `ring${i}`;
    m.castShadow = false;
    g.add(m);
    rings.push(m);
  }
  const mark = mesh(new THREE.BoxGeometry(0.2, 0.03, 0.006), paint(YELLOW)); // 설계표 0.30 길이는 보스·휠 축과 겹쳐 보스 밖(0.20~0.40)만
  mark.position.set(0.3, 0, -0.117);
  g.add(mark);
  return { group: g, rings };
}

const TA = TAU / 3 / K208.omega;
const S01 = 1.2;
const S12 = 1.2;
const S20 = 2.0;
export const T208 = 3 * TA + 4.4;
const B120 = TAU / 3;
export const BC208 = -(2.4 + 1.8 + 1.2) * B120;
const smooth = (q: number): number => 3 * q * q - 2 * q * q * q;

export function state208(tm: number): { wheel: number; pinion: number; x: number; circle: 0 | 1 | 2 | -1; ratio: number } {
  const n = Math.floor(tm / T208);
  const s = tm - n * T208;
  const w = K208.omega;
  const X = K208.X;
  const b1 = TA;
  const b2 = b1 + S01;
  const b3 = b2 + TA;
  const b4 = b3 + S12;
  const b5 = b4 + TA;
  let wheel: number;
  let pin: number;
  let x: number;
  let circle: 0 | 1 | 2 | -1;
  let ratio: number;
  if (s < b1) {
    wheel = w * s; pin = -2.4 * w * s; x = X[0]!; circle = 0; ratio = 2.4;
  } else if (s < b2) {
    wheel = B120; pin = -2.4 * B120; x = X[0]! + (X[1]! - X[0]!) * smooth((s - b1) / S01); circle = -1; ratio = 0;
  } else if (s < b3) {
    const u = s - b2;
    wheel = B120 + w * u; pin = -2.4 * B120 - 1.8 * w * u; x = X[1]!; circle = 1; ratio = 1.8;
  } else if (s < b4) {
    wheel = 2 * B120; pin = -4.2 * B120; x = X[1]! + (X[2]! - X[1]!) * smooth((s - b3) / S12); circle = -1; ratio = 0;
  } else if (s < b5) {
    const u = s - b4;
    wheel = 2 * B120 + w * u; pin = -4.2 * B120 - 1.2 * w * u; x = X[2]!; circle = 2; ratio = 1.2;
  } else {
    wheel = TAU; pin = BC208; x = X[2]! + (X[0]! - X[2]!) * smooth((s - b5) / S20); circle = -1; ratio = 0;
  }
  void S20;
  return { wheel: wheel + TAU * n, pinion: pin + BC208 * n, x, circle, ratio };
}
