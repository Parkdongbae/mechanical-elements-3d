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
  rOut: 0.435,
  thick: 0.12,
  zc: 0.345,
  X: [-0.9, -0.675, -0.45] as number[],
  omega: 0.6
};

export const PINION_SECTOR208: V2[] = [[0.4137,-0.1344],[0.4214,-0.1080],[0.4235,-0.0964],[0.4229,-0.0898],[0.4212,-0.0842],[0.4184,-0.0791],[0.4147,-0.0746],[0.4083,-0.0697],[0.4009,-0.0667],[0.3373,-0.0554],[0.3241,-0.0539],[0.3163,-0.0517],[0.3081,-0.0479],[0.2962,-0.0390],[0.2877,-0.0281],[0.2820,-0.0148],[0.2800,-0.0002],[0.2819,0.0145],[0.2877,0.0281],[0.2969,0.0397],[0.3081,0.0479],[0.3163,0.0517],[0.3241,0.0539],[0.3373,0.0554],[0.4009,0.0669],[0.4083,0.0699],[0.4147,0.0747],[0.4184,0.0792],[0.4214,0.0851],[0.4230,0.0907],[0.4235,0.0965],[0.4214,0.1080],[0.4137,0.1344]];

const YELLOW = 0xffcc00;
const GRAY = 0x6b7280;

/** 홈 피니언 몸(원판 + 허브 + 칼라 + 노란 표지). 회전 0 에서 홈 0 번이 -z(휠 쪽) */
export function pinion208(): THREE.Group {
  const g = new THREE.Group();
  const pts: V2[] = [];
  for (let k = 0; k < K208.slots; k++) {
    const a = (k * TAU) / K208.slots;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const n = PINION_SECTOR208.length - 1; // 마지막 점 = 다음 조각 첫 점
    for (let i = 0; i < n; i++) {
      const [x, y] = PINION_SECTOR208[i]!;
      pts.push([x * c - y * s, x * s + y * c]);
    }
  }
  const shape = shapeFrom(pts);
  shape.holes.push(circlePath(0, 0, 0.042));
  const body = extrude(shape, K208.thick, 0.004);
  body.rotateY(Math.PI / 2);
  g.add(mesh(body, brass()));

  const seg = (r: number, x0: number, x1: number): void => {
    const geo = lathe(tubeProfile(0.042, r, x0, x1, 0.008), 36);
    geo.rotateZ(-Math.PI / 2);
    g.add(mesh(geo, brass()));
  };
  seg(0.09, -0.17, 0.115);
  seg(0.07, 0.115, 0.145);
  seg(0.09, 0.145, 0.17);
  const collar = lathe(tubeProfile(0.042, 0.11, -0.15, -0.13, 0.004), 36);
  collar.rotateZ(-Math.PI / 2);
  g.add(mesh(collar, brass()));

  // 홈 0 번과 1 번 사이 둔덕(18도)의 바깥면 표지
  const a = (18 * Math.PI) / 180;
  const mk = mesh(new THREE.BoxGeometry(0.124, 0.02, 0.05), paint(YELLOW));
  mk.position.set(0, 0.43 * Math.sin(a), -0.43 * Math.cos(a));
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
