// 176 기관 분리 장치(맞물림) — 고리의 홈이 막혀 있으면 손목 핀이 크랭크 팔을 밀어 함께 돌고, 홈이 열리면 핀이 그냥 지나간다 (판화 176번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K176, crankArm176, driverCrank176, notchRing176, pose176 } from '../kit/k176';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const [OX, OY] = K176.O;
const L = K176.L;

export default function buildM176(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());
  const shaft = shaftZ(OX, OY, 0.32, 0.05);
  shaft.name = 'shaft';
  g.add(shaft);

  // 크랭크 팔(받는 쪽) + 홈 고리
  const arm = crankArm176();
  arm.name = 'arm';
  arm.position.set(OX, OY, 0);
  const ring = notchRing176();
  ring.name = 'ring';
  ring.position.set(0, L, 0);
  arm.add(ring);
  g.add(arm);

  // 구동 크랭크(그림에 없음)
  const driver = driverCrank176();
  driver.name = 'driver';
  driver.position.set(OX, OY, 0);
  g.add(driver);
  const pinObj = driver.getObjectByName('pin') as THREE.Object3D;

  const arrow = rotArrow(0.5, true);
  arrow.position.set(OX, OY, 0.45);
  g.add(arrow);

  const tRing = leaderTo(tag('홈 있는 고리', v(0, 0, 0.5)), 'ring');
  const tPin = leaderTo(tag('손목(핀)', v(0, 0, 0.5)), 'pin');
  const tArm = leaderTo(tag('크랭크 팔(받는 쪽)', v(0, 0, 0.5)), 'arm');
  const tDrv = leaderTo(tag('구동 크랭크(그림에 없음)', v(0, 0, 0.5)), 'driver');
  g.add(tRing, tPin, tArm, tDrv);

  let cur = pose176(0);
  const apply = (): void => {
    cur = pose176(theta);
    arm.rotation.z = cur.arm - Math.PI / 2;
    ring.rotation.z = Math.PI / 2 + cur.psi;
    driver.rotation.z = cur.pin;
    const ca = Math.cos(cur.arm);
    const sa = Math.sin(cur.arm);
    const cp = Math.cos(cur.pin);
    const sp = Math.sin(cur.pin);
    tRing.position.set(OX + (L + 0.55) * ca, OY + (L + 0.55) * sa, 0.5);
    tArm.position.set(OX + 0.6 * ca - 0.55 * sa, OY + 0.6 * sa + 0.55 * ca, 0.5);
    tPin.position.set(OX + (L - 0.65) * cp, OY + (L - 0.65) * sp, 0.5);
    tDrv.position.set(OX + 0.55 * cp + 0.4 * sp, OY + 0.55 * sp - 0.4 * cp, 0.5);
  };
  apply();
  void pinObj;

  return {
    group: g,
    notes: () => [
      { label: '상태', value: cur.coupled ? '연결됨 — 홈이 막혀 핀이 팔을 민다' : '풀림 — 홈이 열려 핀이 그냥 지나간다' },
      { label: '고리 홈 각', value: `${((cur.psi * 180) / Math.PI).toFixed(0)}° (0 = 막힘, 90 = 열림)` },
      { label: '구동 핀 회전수', value: `${(theta / (2 * Math.PI)).toFixed(2)}` },
      { label: '팔 회전수', value: `${(cur.arm / (2 * Math.PI)).toFixed(2)}` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.7, 6.6], target: [0, 1.65, 0] }
  };
}
