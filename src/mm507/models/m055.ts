// 055 두 속도 기어 — 피니언 B(원문은 D) 하나가 안쪽 기어 A(외접)와 링 기어 C(내접)에 동시에 물려
// 서로 다른 속도를 준다. A 와 C 는 반대 방향, 속도는 이 수에 반비례 (판화 55번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, internalGear, meshAngle, ringRoot, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';

const MOD = 0.045;
const NB = 12; // 피니언 B 잇수 — 피치 반지름 0.27
const NA = 20; // 안쪽 기어 A 잇수 — 0.45
const NC = 44; // 링 기어 C(안쪽 이) 잇수 — 0.99. z_C = z_A + 2·z_B = 동심 물림 조건
const O: [number, number] = [0, 1.85]; // 링·A 중심 (동심)
const P: [number, number] = [-0.72, 1.85]; // 피니언 중심 = r_A + r_B = r_C − r_B, α = π
const Z = 0.12; // 기어 두께 방향 위치
const SB = (Math.PI * 2) / NB;
const SC = (Math.PI * 2) / NC;
const WALL = 0.11;
const R_OUT = ringRoot(NC, MOD) + WALL + 0.012; // 링 테두리 바깥 1.1615
const R_ROLL = 0.07; // 받침 롤러 반지름 (판화에 없음 — 보충)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM055(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 링 기어 C(안쪽 이) — 중심 O
  const ringC = internalGear(NC, MOD, { width: 0.12, wall: WALL });
  ringC.name = 'ringC';
  ringC.position.set(O[0], O[1], Z);
  // 안쪽 기어 A — 링과 동심
  const gearA = spurGear(NA, MOD, { width: 0.12, spokes: 4 });
  gearA.name = 'gearA';
  gearA.position.set(O[0], O[1], Z);
  // 피니언 B(구동) — A 의 왼쪽에서 외접, 링 C 의 왼쪽 안벽에서 내접
  const pinionB = spurGear(NB, MOD, { width: 0.14, spokes: 3, driver: true });
  pinionB.name = 'pinionB';
  pinionB.position.set(P[0], P[1], Z);
  g.add(ringC, gearA, pinionB);
  g.add(shaftZ(O[0], O[1], 0.34, 0.05), shaftZ(P[0], P[1], 0.36, 0.05));

  // 링 C 는 축이 없어 바깥에서 롤러 3개가 받친다 (30°, 150°, 270°) — 판화에 없는 보충
  const rollers: THREE.Group[] = [];
  for (const deg of [30, 150, 270]) {
    const a = (deg * Math.PI) / 180;
    const x = O[0] + Math.cos(a) * (R_OUT + R_ROLL);
    const y = O[1] + Math.sin(a) * (R_OUT + R_ROLL);
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

  // 회전 방향: B 반시계 → A 시계(외접) → C 반시계(내접)
  const aB = rotArrow(0.2, true);
  aB.position.set(P[0], P[1], 0.3);
  const aA = rotArrow(0.3, false);
  aA.position.set(O[0], O[1], 0.3);
  // C 화살표는 링과 같은 중심, A 이끝(0.495)과 링 이끝(0.945) 사이 r 0.75.
  // 호의 빈 곳(110°)이 왼쪽 피니언 자리(180°)에 오도록 −62° 돌린다
  const aC = rotArrow(0.75, true);
  aC.position.set(O[0], O[1], 0.26);
  aC.rotation.z = (-62 * Math.PI) / 180;
  g.add(aB, aA, aC);
  // 이름표 — 모두 링 바깥에
  g.add(
    tag('B 피니언(구동, 원문은 D)', v(-1.55, 1.85, 0.3)),
    tag('A 안쪽 기어 20', v(0.55, 3.2, 0.3)),
    tag('C 링 기어 44', v(-0.6, 3.2, 0.3)),
    tag('받침 롤러(판화에 없음)', v(1.45, 0.75, 0.3))
  );

  return {
    group: g,
    notes: () => [
      { label: '잇수', value: '피니언 B 12 · 기어 A 20 · 링 C 44' },
      { label: '속도비', value: 'A = −0.6·B, C = +0.27·B' },
      { label: '회전 방향', value: 'A 와 C 는 반대 방향' },
      {
        label: '지금 각도',
        value: `B ${theta.toFixed(2)} rad · A ${((-0.6) * theta).toFixed(2)} · C ${(12 / 44 * theta).toFixed(2)}`
      }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 두 맞물림이 같은 피니언 위상 θ 에서 동시에 성립
      theta += OMEGA * speed * dt;
      pinionB.rotation.z = theta;
      // A: 외접 맞물림(α = 0 방향 c2−c1). dθ_A/dθ = −12/20 = −0.6, 시계
      gearA.rotation.z = meshAngle(P, NB, theta, O, NA);
      // C: 내접 맞물림(α = π, 034 와 같은 식). dθ_C/dθ = +12/44, 반시계
      ringC.rotation.z = Math.PI - (SC / SB) * (Math.PI - theta - SB / 2);
      // 롤러는 링 테두리와 같은 속도로 구른다(반대 방향)
      for (const r of rollers) r.rotation.z = -ringC.rotation.z * (R_OUT / R_ROLL);
    }
  };
}
