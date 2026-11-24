// 013 움직도르래 — 줄 한쪽 끝을 들보에 묶고 움직도르래 아래를 돌아 고정 도르래를 넘는다.
// 자유단은 추보다 두 배 빠르고 힘의 이득은 2 (판화 13번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, pulley, rod, ropeAround, rotArrow, tag, weight } from '../kit';
import { castIron, steel, wood } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const FX = -0.26; // 고정 도르래 F 중심 x
const FY = 2.35; // 고정 도르래 F 중심 y
const RF = 0.36; // F 줄 중심 반지름
const MX = 0.4; // 움직도르래 M 중심 x
const Y0 = 1.25; // d=0 일 때 M 중심 y
const RM = 0.3; // M 줄 중심 반지름
const EX = -0.62; // 자유단 줄 x (F 왼쪽 접점과 수직)
const E0 = 1.9; // d=0 일 때 자유단 y
const Z = 0.25; // 줄·도르래 면

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM013(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let dNow = 0; // notes() 가 읽는 현재 추 상승량

  g.add(displayStand());

  // 가로 들보
  const beam = mesh(new THREE.BoxGeometry(1.9, 0.12, 0.65), castIron());
  beam.position.set(0.05, 3.02, 0.05);
  g.add(beam);

  // 고정 도르래 F — 012 와 같은 매달이: 축 막대 + 옆판 2 + 고리
  const fSheave = pulley(0.34, { width: 0.1, grooved: true, spokes: 4 });
  fSheave.position.set(FX, FY, Z);
  g.add(fSheave);
  g.add(rod(v(FX, FY, 0.13), v(FX, FY, 0.37), 0.03));
  for (const sz of [-1, 1]) {
    const plate = mesh(new THREE.BoxGeometry(0.03, 0.52, 0.03), steel());
    plate.position.set(FX, 2.61, Z + sz * 0.1);
    g.add(plate);
  }
  const fHook = mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 24), steel());
  fHook.position.set(FX, 2.91, Z);
  g.add(fHook);
  g.add(rod(v(FX, 2.945, 0.2), v(FX, 2.945, 0.3), 0.013)); // 핀이 고리 구멍을 지난다

  // 움직도르래 M — 축 막대 + 위아래 옆판(±0.36) + 아래 고리 + 추, 전체가 y_m 을 따라 움직인다
  const mGroup = new THREE.Group();
  const mSheave = pulley(0.28, { width: 0.1, grooved: true, spokes: 4 });
  mSheave.position.z = Z;
  mGroup.add(mSheave);
  mGroup.add(rod(v(0, 0, 0.13), v(0, 0, 0.37), 0.03));
  for (const sz of [-1, 1]) {
    const plate = mesh(new THREE.BoxGeometry(0.03, 0.72, 0.03), steel());
    plate.position.set(0, 0, Z + sz * 0.1);
    mGroup.add(plate);
  }
  const mRing = mesh(new THREE.TorusGeometry(0.04, 0.011, 12, 24), steel());
  mRing.position.set(0, -0.38, Z);
  mGroup.add(mRing);
  mGroup.add(rod(v(0, -0.385, Z), v(0, -0.43, Z), 0.011)); // 갈고리 막대: 고리 ring ↔ 추 위 고리
  const load = weight(0.36, 0.4);
  load.position.set(0, -0.664, Z);
  mGroup.add(load);
  g.add(mGroup);

  // 들보 고정단 고리 — 줄 한쪽 끝이 묶인다
  const tieHook = mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 24), steel());
  tieHook.position.set(0.7, 2.91, Z);
  g.add(tieHook);
  g.add(rod(v(0.7, 2.945, 0.2), v(0.7, 2.945, 0.3), 0.013));

  // 줄 — 매 프레임 setPath
  const rope = new Rope(0.018);
  g.add(rope.group);

  // 자유단 손잡이 — y_E 를 따라 움직인다
  const hand = new THREE.Group();
  hand.add(rod(v(0, 0, Z), v(0, -0.16, Z), 0.05));
  const knob = mesh(new THREE.SphereGeometry(0.06, 18, 14), wood(0x4a2f1d));
  knob.position.set(0, -0.21, Z);
  hand.add(knob);
  g.add(hand);

  // 회전 방향 화살표 (M 시계, F 반시계) + 이름표
  const arrowM = rotArrow(0.5, false);
  // 호의 빈 곳(110°)을 아래로 — 호가 추를 거는 고리·막대를 지나지 않게
  arrowM.rotation.z = (-82 * Math.PI) / 180;
  arrowM.position.set(0, 0, 0.36);
  mGroup.add(arrowM);
  const arrowF = rotArrow(0.55, true);
  arrowF.position.set(FX, FY, 0.36);
  g.add(arrowF);
  g.add(tag('고정 도르래', v(-1.15, 2.7, 0.35)));
  mGroup.add(tag('움직도르래', v(0.85, 0.1, 0.35)));
  mGroup.add(tag('추', v(0.5, -0.75, 0.35)));
  g.add(tag('줄 묶은 곳', v(1.25, 3.0, 0.35)));
  hand.add(tag('당기는 끝(추의 2배 이동)', v(-0.85, -0.15, 0.35)));

  return {
    group: g,
    notes: () => [
      { label: '힘의 이득', value: '2배 (힘 1/2)' },
      { label: '추 올라간 높이', value: dNow.toFixed(2) },
      { label: '당긴 줄 길이', value: (2 * dNow).toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도에서 전체 자세를 다시 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      const d = 0.3 * (1 - Math.cos(0.5 * theta)); // 추 올림 0~0.6
      dNow = d;
      const ym = Y0 + d;
      const yE = E0 - 2 * d; // 손은 추의 두 배 속도로 내려간다
      mGroup.position.set(MX, ym, 0);
      mSheave.rotation.z = -d / RM; // 오른쪽 줄(고정단)을 타고 구르듯 시계 방향
      fSheave.rotation.z = (2 * d) / RF; // 오른쪽 줄이 올라가므로 반시계
      hand.position.set(EX, yE, 0);
      rope.setPath(
        ropeAround(
          { p: [0.7, 2.91], w: Z },
          [
            { c: [MX, ym], r: RM, ccw: false, w: Z },
            { c: [FX, FY], r: RF, ccw: true, w: Z }
          ],
          { p: [EX, yE], w: Z },
          { seg: 24 }
        )
      );
    }
  };
}
