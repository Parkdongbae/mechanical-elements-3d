// 220 평행한 두 크랭크 축 — 방향은 나란하지만 일직선에 있지 않은 두 축을 크랭크 핀과 홈으로 이었다.
// 왼쪽 크랭크가 일정하게 돌면 손목 핀이 홈 속을 안팎으로 미끄러지며, 핀의 축 거리가 계속 바뀌어
// 홈 크랭크는 빨라졌다 느려진다(0.60~3.00배). 설계표 docs/mm507-sheets/220.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { setMM } from '../kit/mm';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { creased, mesh } from '../../models/parts/geom';

const DEG = Math.PI / 180;
// 상수(설계표): 두 축 O1·O2(같은 높이, 옆으로 0.50), 왼쪽 크랭크 핀 반지름, 축 간격
const O1X = -0.25;
const O2X = 0.25;
const OY = 1.70;
const R1 = 0.75; // O1 → 손목 핀
const D = 0.50; // O1 → O2
const PHI0 = 1.1345; // t = 0 자세(65°, 판화 모습)
const OM = 0.8; // 왼쪽 크랭크 각속도 rad/s(한 바퀴 7.854 s)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** Y축 원통을 Z축으로 눕혀 pos(중심)에 놓는다 */
function cylZ(r: number, len: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, len, 32);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 홈 크랭크 판(로컬 +X 가 홈 방향): 허브 원 + 몸통 + 끝 원, 축 구멍·홈을 뚫어 z −0.03~0.03 압출 */
function slotCrankGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.16);
  shape.absarc(0, 0, 0.16, 90 * DEG, 270 * DEG, false); // 허브 왼쪽 반원
  shape.lineTo(0.3, -0.11);
  shape.lineTo(1.27, -0.11);
  shape.absarc(1.27, 0, 0.11, -90 * DEG, 90 * DEG, false); // 홈 끝 반원
  shape.lineTo(0.3, 0.11);
  shape.closePath();
  const axle = new THREE.Path();
  axle.absarc(0, 0, 0.05, 0, Math.PI * 2, true); // 축 구멍(오른쪽 축이 지남)
  const slot = new THREE.Path();
  slot.moveTo(0.23, -0.05);
  slot.lineTo(1.27, -0.05);
  slot.absarc(1.27, 0, 0.05, -90 * DEG, 90 * DEG, false); // 홈 오른쪽 끝 반원
  slot.lineTo(0.23, 0.05);
  slot.absarc(0.23, 0, 0.05, 90 * DEG, 270 * DEG, false); // 홈 왼쪽 끝 반원
  slot.closePath();
  shape.holes.push(axle, slot);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, curveSegments: 32 });
  geo.translate(0, 0, -0.03);
  return creased(geo, 34);
}

/** 왼쪽 크랭크 판: 허브 원(r 0.13)과 핀 원(r 0.09 at 0.75)을 바깥 접선으로 잇는다 */
function crank1Geo(): THREE.BufferGeometry {
  const RB = 0.13;
  const RS = 0.09;
  const beta = Math.acos((RB - RS) / R1); // ≈86.94°, 접선 각
  const bx = RB * Math.cos(beta); // ≈0.0069
  const by = RB * Math.sin(beta); // ≈0.1298
  const sx = R1 + RS * Math.cos(beta); // ≈0.7548
  const sy = RS * Math.sin(beta); // ≈0.0899
  const shape = new THREE.Shape();
  shape.moveTo(bx, by);
  shape.absarc(0, 0, RB, beta, Math.PI * 2 - beta, false); // 허브: 86.94° → 273.06° 반시계
  shape.lineTo(sx, -sy); // 아래 접선
  shape.absarc(R1, 0, RS, -beta, beta, false); // 핀 원: −86.94° → 86.94° 반시계
  shape.closePath(); // 위 접선
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, curveSegments: 32 });
  geo.translate(0, 0, -0.03);
  return creased(geo, 34);
}

export default function buildM220(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // 오른쪽 축: 뒤판 보스에서 z 0.09 까지, 끝 너트가 홈 크랭크 앞을 막음
  const shaft2 = shaftZ(O2X, OY, 0.09, 0.05);
  shaft2.name = 'shaft2';
  g.add(shaft2);

  // 홈 크랭크(흰 판, 뒤 층 z 0.00~0.06) — 흰색이라 뒤판 갈색이 홈 사이로 보인다
  const crank2 = new THREE.Group();
  crank2.name = 'crank2';
  crank2.position.set(O2X, OY, 0.03);
  crank2.add(mesh(slotCrankGeo(), paint(0xeef1f4)));
  const tip = mesh(new THREE.BoxGeometry(0.04, 0.2, 0.006), paint(0xf2b619));
  tip.name = 'crank2Tip';
  tip.position.set(1.345, 0, 0.033);
  crank2.add(tip);
  g.add(crank2);

  // 왼쪽 축(z 0.10~0.60): 뒤 끝은 판에 키로 고정, 앞은 받침 고리를 지남
  const shaft1 = cylZ(0.05, 0.5, steel(), O1X, OY, 0.35);
  shaft1.name = 'shaft1';
  g.add(shaft1);

  // 왼쪽 크랭크(황동 판, 앞 층 z 0.12~0.18) + 노란 표지
  const crank1 = new THREE.Group();
  crank1.name = 'crank1';
  crank1.position.set(O1X, OY, 0.15);
  crank1.add(mesh(crank1Geo(), brass()));
  const mark = mesh(new THREE.BoxGeometry(0.3, 0.04, 0.006), paint(0xf2b619));
  mark.name = 'crank1Mark';
  mark.position.set(0.3, 0, 0.033);
  crank1.add(mark);

  // 손목 핀: 판을 뚫고 뒤로(세계 z −0.06~0.21), 홈 속을 미끄러진다
  const pin = cylZ(0.04, 0.27, steel(), 0.75, 0, -0.075);
  pin.name = 'pin';
  setMM(pin, { kind: 'pin', point: [0, 0, 0.075] }); // 링크 검사점: 판 평면 위 (0.75, 0)
  crank1.add(pin);
  crank1.add(cylZ(0.06, 0.03, paint(0xf2b619), 0.75, 0, 0.045)); // 노란 머리(세계 0.18~0.21)
  const collar = cylZ(0.065, 0.03, darkSteel(), 0.75, 0, -0.185); // 뒤 고리(세계 −0.05~−0.02)
  collar.name = 'pinCollar';
  crank1.add(collar);
  g.add(crank1);

  // 앞 받침: 기둥 + 팔 + 베어링 고리(왼쪽 축이 지나감)
  const frontStand = new THREE.Group();
  frontStand.name = 'frontStand';
  const column = mesh(new THREE.BoxGeometry(0.1, 1.57, 0.12), darkSteel());
  column.position.set(-1.6, 0.965, 0.5);
  const arm = mesh(new THREE.BoxGeometry(1.35, 0.1, 0.12), darkSteel());
  arm.position.set(-0.925, OY, 0.5);
  frontStand.add(column, arm, cylZ(0.1, 0.12, darkSteel(), O1X, OY, 0.5));
  g.add(frontStand);

  // 뒤판 눈금 12개: 왼쪽 크랭크가 30°씩 돌 때 홈 크랭크가 오는 자리(간격이 고르지 않다)
  const ticks = new THREE.Group();
  ticks.name = 'ticks';
  const TICK_ANG = [0, 68.26, 100.89, 123.69, 143.41, 161.93, 180, 198.07, 216.59, 236.31, 259.11, 291.74];
  const tickGeo = new THREE.BoxGeometry(0.12, 0.022, 0.01);
  TICK_ANG.forEach((deg, i) => {
    const t = mesh(tickGeo, i === 0 ? paint(0xf2b619) : paint(0xffffff));
    const a = deg * DEG;
    t.position.set(O2X + 1.24 * Math.cos(a), OY + 1.24 * Math.sin(a), -0.295);
    t.rotation.z = a; // 긴 쪽이 반지름 방향
    ticks.add(t);
  });
  g.add(ticks);

  // 회전 방향 화살표(둘 다 반시계)
  const arr1 = rotArrow(0.3, true);
  arr1.position.set(O1X, OY, 0.62);
  const arr2 = rotArrow(0.35, true);
  arr2.position.set(O2X, OY, 0.24);
  g.add(arr1, arr2);

  // 이름표 5개(지시선을 부품에 직접 꽂는다)
  g.add(
    leaderTo(tag('왼쪽 크랭크(일정하게 돎)', v(-1.75, 2.85, 0.6)), 'crank1'),
    leaderTo(tag('손목 핀(홈 속)', v(-0.6, 3.15, 0.6)), 'pin'),
    leaderTo(tag('홈 크랭크(빨라졌다 느려짐)', v(1.8, 0.65, 0.6)), 'crank2'),
    leaderTo(tag('두 축: 나란하지만 일직선 아님', v(1.8, 2.95, 0.6)), 'shaft2'),
    leaderTo(tag('눈금: 왼쪽이 30°씩 돌 때 홈 크랭크 자리', v(-1.75, 0.45, 0.6)), 'ticks')
  );

  // 상태: t 하나로 전부 다시 계산(결정적)
  let phi = PHI0;
  let th2 = 0;
  let rho = 0;
  let k = 0;
  const apply = (): void => {
    phi = PHI0 + OM * tm;
    const px = O1X + R1 * Math.cos(phi); // 핀 세계 좌표
    const py = OY + R1 * Math.sin(phi);
    th2 = Math.atan2(py - OY, px - O2X); // 홈 크랭크 각 = O2 에서 핀을 보는 방향
    rho = Math.hypot(px - O2X, py - OY); // 핀–오른쪽 축 거리(0.25~1.25)
    const c = Math.cos(phi);
    k = (R1 * (R1 - D * c)) / (R1 * R1 + D * D - 2 * R1 * D * c); // 빠르기 비 dθ2/dφ
    crank1.rotation.z = phi;
    shaft1.rotation.z = phi;
    crank2.rotation.z = th2;
    shaft2.rotation.z = th2;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '왼쪽 크랭크 각', value: `${((phi * 180) / Math.PI % 360).toFixed(0)}°` },
      { label: '홈 크랭크 각', value: `${(((th2 * 180) / Math.PI + 360) % 360).toFixed(0)}°` },
      { label: '핀–오른쪽 축 거리', value: `${rho.toFixed(3)} (0.25~1.25)` },
      { label: '홈 크랭크 / 왼쪽 크랭크 빠르기', value: `${k.toFixed(2)}배 (0.60~3.00)` }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [-0.9, 2.1, 7.2], target: [0.0, 1.75, 0.1] }
  };
}
