// 044 계단식 톱니 기어 — 위(작은) 기어와 아래(큰) 기어가 폭 네 층의 계단 이로 차례로 물린다 (판화 44번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { castIron, darkSteel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { displayStand, meshAngle, rod, rotArrow, tag, type V2 } from '../kit';
import { steppedGear } from '../kit/gear5';

const ZA = 20; // 위 기어(구동) 잇수
const ZB = 30; // 아래 기어 잇수
const MOD = 0.032; // 모듈 — 피치 반지름 0.32 / 0.48
const DIST = 0.8; // 축간 중심 거리 = 0.32 + 0.48
const ZC = 0.27; // 축 깊이 — 이끝 0.512 가 깊이 방향으로도 나오므로 앞으로 당긴다
const Y2 = 1.3; // 아래 기어 B
const Y1 = Y2 + DIST; // 위 기어 A = 2.10
const SEC = 4; // 층 수
const SW = 0.2; // 층 폭
const GAP = 0.012; // 층 틈
const STEP_A = (2 * Math.PI) / ZA / SEC; // A 층 어긋남 = 피치각/4 = 4.5°
const STEP_B = -((2 * Math.PI) / ZB / SEC); // B 층 어긋남 = −3°(반대 부호)

// 기어 로컬 좌표(로컬 Z → 세계 X): 중심선은 로컬 −y 방향
const C1: V2 = [0, 0];
const C2: V2 = [0, -DIST];

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const XA = new THREE.Vector3(1, 0, 0);
const QY90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

/** 뒤판(z=-0.3)에서 나와 z=zEnd 까지 오는 기둥 */
function post(x: number, y: number, zEnd: number, r: number): THREE.Mesh {
  const geo = lathe(rodProfile(r, 0, zEnd + 0.3, 0.01, 0.01), 28);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, castIron());
  m.position.set(x, y, -0.3);
  return m;
}

export default function buildM044(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 계단식 기어 A(구동, bronze)·B(종동, brass) — 층 어긋남은 steppedGear 내부(층 rotation.z)가 처리
  const gearA = steppedGear(ZA, MOD, { sections: SEC, sectionWidth: SW, gap: GAP, step: STEP_A, driver: true });
  gearA.name = 'gearA';
  gearA.position.set(0, Y1, ZC);
  const gearB = steppedGear(ZB, MOD, { sections: SEC, sectionWidth: SW, gap: GAP, step: STEP_B });
  gearB.name = 'gearB';
  gearB.position.set(0, Y2, ZC);
  g.add(gearA, gearB);

  // 가로축(세계 X, 반지름 0.045) + 축받이: 축이 구멍을 꿰는 고리(축 방향 = X)와 그 아래 뒤판에서 나온 기둥
  const RING_IN = 0.048; // 고리 구멍(축 0.045 + 틈 0.003)
  const RING_OUT = 0.09;
  for (const y of [Y1, Y2]) {
    g.add(rod(v(-0.72, y, ZC), v(0.72, y, ZC), 0.045));
    for (const x of [-0.58, 0.58]) {
      const ring = lathe(tubeProfile(RING_IN, RING_OUT, -0.04, 0.04, 0.01), 32);
      ring.rotateZ(-Math.PI / 2); // 고리 축을 세계 X(축 방향)로
      const rm = mesh(ring, darkSteel());
      rm.position.set(x, y, ZC);
      g.add(rm);
      // 기둥은 고리 뒤 바깥면(z = ZC − RING_OUT)에 닿는 데까지만 — 축을 뚫지 않는다
      g.add(post(x, y, ZC - RING_OUT + 0.004, 0.032));
    }
  }

  // 회전 방향 화살표(축이 X 방향이라 YZ 평면에 눕힌다, 축 끝 0.72 밖 x=0.8 — 축받이·기둥과 겹치지 않게)
  const aA = rotArrow(0.4, true);
  aA.rotation.y = Math.PI / 2;
  aA.position.set(0.8, Y1, ZC);
  const aB = rotArrow(0.4, false);
  aB.rotation.y = Math.PI / 2;
  aB.position.set(0.8, Y2, ZC);
  g.add(aA, aB);

  g.add(
    tag('구동 기어(계단식 이)', v(-1.4, Y1, 0.5)),
    tag('피동 기어', v(-1.4, Y2, 0.5)),
    tag('이가 계단처럼 어긋나 차례로 물린다', v(1.5, 1.78, 0.5))
  );

  const q = new THREE.Quaternion();
  return {
    group: g,
    notes: () => [
      { label: '잇수', value: `${ZA} : ${ZB}` },
      { label: '속도비', value: '1 : 0.67 (반대 방향)' },
      { label: '층 수', value: '4층, 층마다 1/4 피치 어긋남' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음. 층 어긋남은 기어 내부가 담당
      theta += OMEGA * speed * dt;
      q.setFromAxisAngle(XA, theta).multiply(QY90);
      gearA.quaternion.copy(q);
      q.setFromAxisAngle(XA, meshAngle(C1, ZA, theta, C2, ZB)).multiply(QY90);
      gearB.quaternion.copy(q);
    }
  };
}
