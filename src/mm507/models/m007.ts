// 007 풀리 3개와 베벨 기어로 정회전·정지·역회전 (판화 7번)
// 포크가 벨트를 왼쪽(축 b)·가운데(헐거움)·오른쪽(축 a)로 옮기면 수직축 C가 정회전·정지·역회전한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import {
  Belt,
  PILLOW_BOSS_Y,
  bevelGear,
  displayStand,
  openBeltPath,
  pillow,
  pulley,
  rod,
  tag
} from '../kit';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { extrude, hexPrism, lathe, mesh, rodProfile, roundedRect, tubeProfile, TAU } from '../../models/parts/geom';

const Z = 0.15; // 기구 평면
const TEETH = 20;
const MOD = 0.03;
const RPU = 0.36; // 아래 풀리 반지름
const PITCH = TAU / TEETH; // 베벨 피치각
const XA = new THREE.Vector3(1, 0, 0);
const YA = new THREE.Vector3(0, 1, 0);
const QY90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // 로컬 Z → +X
const QYm90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // 로컬 Z → -X
const QX90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // 로컬 Z → -Y

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

/** 벨트 x 자리(주기 10초): 왼쪽 0.93 → 가운데 1.15 → 오른쪽 1.37, 옮기는 구간은 smoothstep */
function beltX(t: number): number {
  const s = (a: number, b: number, u: number): number => a + (b - a) * u * u * (3 - 2 * u);
  if (t < 3) return 0.93;
  if (t < 3.6) return s(0.93, 1.15, (t - 3) / 0.6);
  if (t < 4.6) return 1.15;
  if (t < 5.2) return s(1.15, 1.37, (t - 4.6) / 0.6);
  if (t < 8.2) return 1.37;
  if (t < 8.8) return s(1.37, 1.15, (t - 8.2) / 0.6);
  if (t < 9.4) return 1.15;
  return s(1.15, 0.93, (t - 9.4) / 0.6);
}

/** 벨트가 풀리(중심 pc, 폭 0.2)에 걸린 비중 — 벨트 폭 0.14 기준 선형 */
function engagement(bx: number, pc: number): number {
  return clamp01((0.17 - Math.abs(bx - pc)) / 0.14);
}

export default function buildM007(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 위 구동 풀리 각
  let T = 0; // 벨트 타임라인(|speed|로 누적)
  let aB = 0; // 축 b 마스터 각 — A·B·C 는 늘 맞물려 αa = -αb, αC = αa (접점 속도: A 윗점 ωa·R = C 왼점 ωc·R)
  let wMech = 0; // 기구(축 b) 각속도
  let thL = 0; // 헐거운 풀리 각(따로 누적)
  let wLoose = 0;
  let curBx = 0.93;

  g.add(displayStand());

  // 위 구동 풀리 U(폭 0.66 — 벨트가 세 자리 어디에도 걸림)과 그 축·필로
  const pU = pulley(0.38, { width: 0.66, driver: true, spokes: 4, flat: true });
  pU.position.set(1.15, 2.65, Z);
  g.add(pU, rod(v(0.6, 2.65, Z), v(1.9, 2.65, Z), 0.04), pillow(0.7, 2.44, Z, 'x'), pillow(1.8, 2.44, Z, 'x'));

  // 아래 속 찬 축 a + 속 빈 관 b(받침 필로)
  g.add(rod(v(-1.75, 0.95, Z), v(1.7, 0.95, Z), 0.04), pillow(-1.7, 0.74, Z, 'x'), pillow(1.65, 0.74, Z, 'x'));
  const tubeGeo = lathe(tubeProfile(0.055, 0.075, -0.8, 1.03, 0.008), 40);
  tubeGeo.rotateZ(-Math.PI / 2);
  g.add(at(tubeGeo, steel(), 0, 0.95, Z));
  // 관 b 받침 — 키트 pillow는 구멍(0.052)이 관보다 작아 큰 구멍 브래킷을 직접 만든다
  const bPad = new THREE.Group();
  bPad.position.set(0.1, 0.95 - PILLOW_BOSS_Y, Z);
  const bPlateGeo = extrude(roundedRect(-0.12, -0.12, 0.12, 0.12, 0.035), 0.055, 0.012);
  bPlateGeo.rotateX(Math.PI / 2);
  bPad.add(at(bPlateGeo, castIron(), 0, 0.0275, 0));
  bPad.add(at(lathe(rodProfile(0.07, 0, 0.135, 0.012), 32), castIron(), 0, 0.055, 0));
  const bRingGeo = lathe(tubeProfile(0.079, 0.107, -0.062, 0.062, 0.012), 36);
  bRingGeo.rotateZ(Math.PI / 2);
  bPad.add(at(bRingGeo, darkSteel(), 0, PILLOW_BOSS_Y, 0));
  const padNut = hexPrism(0.034, 0.024, true, true, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bPad.add(at(padNut.clone(), darkSteel(), sx * 0.085, 0.067, sz * 0.085));
  g.add(bPad);

  // 풀리 3개: F1(b 고정)·L(헐거움 — a 위 슬리브에 자유 회전)·F2(a 고정)
  const pF1 = pulley(RPU, { width: 0.2, spokes: 4, hub: 0.078, flat: true });
  pF1.position.set(0.93, 0.95, Z);
  const pL = pulley(RPU, { width: 0.2, spokes: 4, flat: true });
  pL.position.set(1.15, 0.95, Z);
  const pF2 = pulley(RPU, { width: 0.2, spokes: 4, flat: true });
  pF2.position.set(1.37, 0.95, Z);
  g.add(pF1, pL, pF2);
  const sleeveGeo = lathe(tubeProfile(0.042, 0.05, 1.02, 1.28, 0.004), 24);
  sleeveGeo.rotateZ(-Math.PI / 2);
  g.add(at(sleeveGeo, darkSteel(), 0, 0.95, Z)); // 허브 앞뒤로 비친 얇은 슬리브

  // 베벨 기어 A(축 a)·B(관 b 끝)·C(수직축) — 세 꼭짓점 O = (-1.125, 0.95)에서 만난다
  const gA = bevelGear(TEETH, MOD, { width: 0.12 });
  gA.position.set(-1.425, 0.95, Z); // 이가 +X, 피치원 평면 x = -1.425
  const gB = bevelGear(TEETH, MOD, { width: 0.12, bore: 0.08 });
  gB.position.set(-0.825, 0.95, Z); // 이가 -X, 관 b 끝이 허브 구멍으로 들어감
  const gC = bevelGear(TEETH, MOD, { width: 0.12 });
  gC.position.set(-1.125, 1.25, Z); // 이가 -Y
  g.add(gA, gB, gC);

  // 수직축 c + 위 뒤판 브래킷(주철 상자 + 구멍) + 표시판(원판·화살표·깃)
  g.add(rod(v(-1.125, 1.22, Z), v(-1.125, 3.05, Z), 0.04));
  g.add(at(new THREE.BoxGeometry(0.26, 0.3, 0.4), castIron(), -1.125, 2.86, -0.1));
  g.add(at(lathe(tubeProfile(0.045, 0.072, -0.06, 0.06, 0.01), 36), darkSteel(), -1.125, 2.9, Z));
  const plate = new THREE.Group();
  plate.position.set(-1.125, 3.0, Z);
  plate.add(at(lathe(tubeProfile(0.044, 0.15, -0.012, 0.012, 0.004), 48), darkSteel(), 0, 0, 0));
  plate.add(at(new THREE.BoxGeometry(0.1, 0.006, 0.026), paint(0xf2b619), 0.075, 0.019, 0));
  const headGeo = new THREE.ConeGeometry(0.02, 0.05, 12);
  headGeo.rotateZ(-Math.PI / 2);
  plate.add(at(headGeo, paint(0xd8362f), 0.145, 0.019, 0));
  plate.add(at(new THREE.BoxGeometry(0.024, 0.1, 0.09), paint(0xd8362f), 0.148, 0.062, 0));
  g.add(plate);

  // 벨트: U ↔ 아래 풀리, YZ 평면 경로를 x = bx 평면에 놓고 그룹 x만 옮긴다
  // 띠 중심 반지름 = 풀리 면 반지름 + 두께 절반(0.0125) — 0.39/0.37 은 띠 안쪽 면이 풀리 속으로 0.0025 묻혔다
  const beltPath = openBeltPath([2.65, Z], 0.38 + 0.0125, [0.95, Z], RPU + 0.0125);
  // 판화처럼 정면에서 띠가 보이는 납작 벨트(축이 X 방향이라 로프는 옆선만 보인다)
  const beltPts = beltPath.map(([a, b]) => v(0, a, b));
  // 축이 X 방향이라 띠 폭도 점마다 X — 기본 계산은 YZ 평면 경로에서 띠를 세워 버린다
  const belt = new Belt(beltPts, { width: 0.14, thickness: 0.025, style: 'flat', widthDirs: beltPts.map(() => new THREE.Vector3(1, 0, 0)) });
  belt.group.position.x = 0.93;
  g.add(belt.group);

  // 벨트 옮기개: 앞쪽 수직 막대 + 포크(손가락 간격 0.18), 위쪽 안내봇에 걸쳐 미끄러짐
  const fork = new THREE.Group();
  fork.add(
    rod(v(0, 1.46, 0.585), v(0, 2.0, 0.585), 0.025),
    rod(v(-0.09, 1.46, 0.585), v(0.09, 1.46, 0.585), 0.02),
    // 포크 손가락: 띠 면에 수직(Z)으로 띠 양옆을 지나야 띠를 밀 수 있다 — 앞 가닥(z ≈ 0.53)을 사이에 낀다.
    // (전에는 z 0.585 의 세로 막대라 띠 앞에 떠 있었다)
    rod(v(-0.09, 1.46, 0.45), v(-0.09, 1.46, 0.585), 0.016),
    rod(v(0.09, 1.46, 0.45), v(0.09, 1.46, 0.585), 0.016)
  );
  const collarGeo = lathe(tubeProfile(0.02, 0.038, -0.032, 0.032, 0.005), 32);
  collarGeo.rotateZ(-Math.PI / 2);
  fork.add(at(collarGeo, darkSteel(), 0, 2.0, 0.585));
  fork.position.x = 0.93;
  g.add(fork);
  g.add(rod(v(0.7, 2.0, 0.585), v(1.6, 2.0, 0.585), 0.02)); // 뒤판 수평 안내봉
  g.add(rod(v(0.78, 2.0, -0.28), v(0.78, 2.0, 0.585), 0.015), rod(v(1.52, 2.0, -0.28), v(1.52, 2.0, 0.585), 0.015));

  // 이름표
  const forkTag = tag('벨트 옮기개', v(0.93, 2.28, 0.58));
  g.add(
    tag('구동 풀리', v(1.7, 2.62, 0.3)),
    tag('고정 풀리(축 b)', v(0.25, 0.6, 0.5)),
    tag('헐거운 풀리', v(1.15, 0.42, 0.5)),
    tag('고정 풀리(축 a)', v(1.95, 0.6, 0.5)),
    tag('베벨 기어 A', v(-1.7, 0.5, 0.45)),
    tag('베벨 기어 B', v(-0.5, 0.74, 0.45)),
    tag('베벨 기어 C', v(-1.125, 1.62, 0.5)),
    forkTag
  );

  const q = new THREE.Quaternion();
  const spinX = (angle: number): THREE.Quaternion => q.setFromAxisAngle(XA, angle).multiply(QY90);

  return {
    group: g,
    view: { pos: [1.6, 2.5, 6.0], target: [0, 1.7, 0] },
    notes: () => [
      { label: '벨트 위치', value: curBx < 1.04 ? '왼쪽' : curBx > 1.26 ? '오른쪽' : '가운데(헐거움)' },
      { label: '수직축', value: Math.abs(wMech) < 0.02 ? '정지' : wMech > 0 ? '정회전' : '역회전' },
      { label: '속도비', value: '1 : 1 (마이터)' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      T += Math.abs(speed) * dt;
      const t10 = T % 10;
      curBx = beltX(t10);
      belt.group.position.x = curBx;
      fork.position.x = curBx;
      forkTag.position.x = curBx;
      belt.setOffset(theta * 0.38);

      // 걸림 비중 → 구동 비율 선형 보간, 헐거운 풀리만 걸리면 0.4초 걸쳐 감속
      const wF1 = engagement(curBx, 0.93);
      const wLooseBelt = engagement(curBx, 1.15);
      const wF2 = engagement(curBx, 1.37);
      const vBelt = OMEGA * speed * 0.38;
      if (wF1 + wF2 > 1e-6) wMech = ((wF1 - wF2) * vBelt) / RPU;
      else wMech *= Math.max(0, 1 - 6 * dt);
      aB += wMech * dt;
      if (wLooseBelt > 1e-6) wLoose = (wLooseBelt * vBelt) / RPU;
      else wLoose *= Math.max(0, 1 - 6 * dt);
      thL += wLoose * dt;

      // 절대 각도로 자세 계산 (위상: A = αa, B = αb, C = αC + 반 피치)
      pU.quaternion.copy(spinX(theta));
      pF1.quaternion.copy(spinX(aB));
      pF2.quaternion.copy(spinX(-aB));
      pL.quaternion.copy(spinX(thL));
      q.setFromAxisAngle(XA, -aB).multiply(QY90);
      gA.quaternion.copy(q);
      q.setFromAxisAngle(XA, aB).multiply(QYm90);
      gB.quaternion.copy(q);
      q.setFromAxisAngle(YA, -aB + PITCH / 2).multiply(QX90); // C 는 축 a 와 같은 부호
      gC.quaternion.copy(q);
      plate.rotation.y = -aB + PITCH / 2;
    }
  };
}
