// 034 내접 기어 — 큰 링 기어의 안쪽 이에 작은 피니언이 왼쪽에서 맞물려 두 기어가 같은 방향으로 돈다 (판화 34번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, internalGear, leaderTo, ringRoot, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';

const MOD = 0.045;
const N1 = 20; // 피니언 잇수 — 피치 반지름 0.45
const N2 = 48; // 링 기어 잇수 — 피치 반지름 1.08
const RP1 = (N1 * MOD) / 2;
const RP2 = (N2 * MOD) / 2;
const A = RP2 - RP1; // 중심 거리 0.63
const C2: [number, number] = [0, 1.75]; // 링 중심
const C1: [number, number] = [C2[0] - A, C2[1]]; // 피니언은 링 안 왼쪽
const Z = 0.12;
const S1 = (Math.PI * 2) / N1;
const S2 = (Math.PI * 2) / N2;
const WALL = 0.11;
const R_OUT = ringRoot(N2, MOD) + WALL + 0.012; // 테두리 띠 바깥
const R_ROLL = 0.07; // 받침 롤러 반지름

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM034(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 링 기어(주철 + 황동 테두리)와 피니언(구동)
  const ring = internalGear(N2, MOD, { width: 0.12, wall: WALL });
  ring.position.set(C2[0], C2[1], Z);
  const pinion = spurGear(N1, MOD, { width: 0.14, spokes: 4, driver: true });
  pinion.position.set(C1[0], C1[1], Z);
  g.add(ring, pinion, shaftZ(C1[0], C1[1], 0.34, 0.06));

  // 링은 축이 없어 바깥에서 롤러 3개가 받친다 (30°, 150°, 270°)
  const rollers: THREE.Group[] = [];
  for (const deg of [30, 150, 270]) {
    const a = (deg * Math.PI) / 180;
    const x = C2[0] + Math.cos(a) * (R_OUT + R_ROLL);
    const y = C2[1] + Math.sin(a) * (R_OUT + R_ROLL);
    const roller = new THREE.Group();
    roller.position.set(x, y, Z);
    const body = lathe(rodProfile(R_ROLL, -0.075, 0.075, 0.012, 0.012), 36);
    body.rotateX(Math.PI / 2);
    roller.add(mesh(body, steel()));
    const mk = mesh(new THREE.BoxGeometry(0.045, 0.014, 0.01), paint(0xf2b619));
    mk.position.set(R_ROLL * 0.6, 0, 0.078);
    roller.add(mk);
    const hub = lathe(rodProfile(0.025, -0.1, 0.1, 0.006, 0.006), 20);
    hub.rotateX(Math.PI / 2);
    roller.add(mesh(hub, darkSteel()));
    g.add(roller, shaftZ(x, y, 0.2, 0.025));
    rollers.push(roller);
  }

  // 회전 방향: 둘 다 반시계(같은 방향)
  const a1 = rotArrow(0.3, true);
  a1.position.set(C1[0], C1[1], 0.3);
  const a2 = rotArrow(0.62, true);
  a2.position.set(C2[0] + 0.55, C2[1], 0.26);
  g.add(a1, a2);
  // 이름표는 링 바깥 모서리에(링의 이를 가리지 않게)
  g.add(leaderTo(tag('구동 피니언 20', v(-1.62, 3.0, 0.3)), pinion), tag('링 기어 48', v(1.68, 3.0, 0.3)));

  return {
    group: g,
    notes: () => [
      { label: '잇수', value: '피니언 20 : 링 기어 48' },
      { label: '속도비', value: '링은 피니언의 0.42배(5/12)' },
      { label: '회전 방향', value: '같은 방향' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pinion.rotation.z = theta;
      // 접점 방향 α = π(링 중심 → 피니언). 피니언 이 중심 = (j+½)S1, 링 이골 중심 = i·S2 가 같은 방향을 향한다
      const alpha = Math.PI;
      const th2 = alpha - (S2 / S1) * (alpha - theta - S1 / 2);
      ring.rotation.z = th2;
      // 롤러는 링 테두리와 같은 속도로 구른다(반대 방향)
      for (const r of rollers) r.rotation.z = -th2 * (R_OUT / R_ROLL);
    }
  };
}
