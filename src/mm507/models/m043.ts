// 043 엇각 기어 (2) — 비스듬히(75°) 만나는 두 축 사이를 원뿔(베벨) 기어 한 쌍이 잇는다 (판화 43번)
// 큰 기어 G1 은 앞면이 보이게 보는 사람 쪽으로 50° 기울고, 작은 기어 G2(구동)는 모서리로 서 있다.
// 두 피치 원뿔의 꼭짓점이 두 축이 만나는 한 점 O 에 모인다(설계표 (가) — 축이 한 점에서 만나는 베벨).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { castIron, darkSteel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { displayStand, rod, rotArrow, tag } from '../kit';
import { bevelPitchAngle, coneBevelGear } from '../kit/gear5';

const rad = (d: number): number => (d * Math.PI) / 180;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

const SIGMA = rad(75); // 축 사이각
const Z1 = 36; // 큰 기어 G1
const Z2 = 26; // 작은 기어 G2(구동)
const MOD = 0.023;
const FACE = 0.16;
const R1 = (Z1 * MOD) / 2; // 0.414
const R2 = (Z2 * MOD) / 2; // 0.299
const D1 = bevelPitchAngle(SIGMA, Z1, Z2); // 44.56°
const D2 = SIGMA - D1; // 30.44°
const A1 = R1 / Math.tan(D1); // 꼭짓점 → G1 큰 쪽 피치원 중심 0.4205
const A2 = R2 / Math.tan(D2); // 0.5087

// 꼭짓점(두 축이 만나는 점)과 축 방향(꼭짓점에서 몸통 쪽)
const O = v(0.4, 1.8, 0.42);
const TILT = rad(50); // G1 축이 보는 사람 쪽으로 기운 각
const PHI1 = rad(160);
const PHI2 = PHI1 + Math.acos(Math.cos(SIGMA) / Math.cos(TILT)); // 226.26° — a1·a2 = cos75°
const AX1 = v(Math.cos(TILT) * Math.cos(PHI1), Math.cos(TILT) * Math.sin(PHI1), -Math.sin(TILT)).normalize();
const AX2 = v(Math.cos(PHI2), Math.sin(PHI2), 0).normalize();
const N = new THREE.Vector3().crossVectors(AX1, AX2).normalize(); // 두 축이 놓인 평면의 법선
const at = (a: THREE.Vector3, s: number): THREE.Vector3 => O.clone().addScaledVector(a, s);
const C1 = at(AX1, A1);
const C2 = at(AX2, A2);

/** 기어 자세: 로컬 x = n, 로컬 z = −a(꼭짓점 쪽), 로컬 y = z × x */
function basis(a: THREE.Vector3): THREE.Quaternion {
  const z = a.clone().negate();
  const y = new THREE.Vector3().crossVectors(z, N);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(N, y, z));
}
const Q1 = basis(AX1);
const Q2 = basis(AX2);
const ZAX = new THREE.Vector3(0, 0, 1);
const YAX = new THREE.Vector3(0, 1, 0);
const BACK_Z = -0.3; // 뒤판 앞면

/** 뒤판에서 나와 zEnd 까지 오는 기둥(세계 Z 방향) */
function post(x: number, y: number, zEnd: number, r: number): THREE.Mesh {
  const geo = lathe(rodProfile(r, 0, zEnd - BACK_Z, 0.01, 0.01), 28);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, castIron());
  m.position.set(x, y, BACK_Z);
  return m;
}

/** 축 a 를 감싸는 고리(가운데 = p, 길이 len) */
function ringOn(p: THREE.Vector3, a: THREE.Vector3, rOut: number, len: number): THREE.Mesh {
  const geo = lathe(tubeProfile(0.045, rOut, 0, len, 0.008), 28);
  geo.rotateX(Math.PI / 2); // 로컬 y → 로컬 z
  const m = mesh(geo, darkSteel());
  m.quaternion.setFromUnitVectors(ZAX, a);
  m.position.copy(p).addScaledVector(a, -len / 2);
  return m;
}

export default function buildM043(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const g1 = coneBevelGear(Z1, MOD, D1, { face: FACE });
  g1.name = 'gearG1';
  g1.position.copy(C1);
  g1.quaternion.copy(Q1);
  const g2 = coneBevelGear(Z2, MOD, D2, { face: FACE, driver: true });
  g2.name = 'gearG2';
  g2.position.copy(C2);
  g2.quaternion.copy(Q2);
  g.add(g1, g2);

  // 축 1(G1): 뒤 끝은 뒤판의 보스에 닿고, 꼭짓점 O 를 지나 앞으로 나온다(판화처럼 축 2 앞을 지나감)
  g.add(rod(at(AX1, 0.94), at(AX1, -0.42), 0.045));
  const bossLen = 0.96 - 0.74;
  const boss = mesh(lathe(rodProfile(0.08, 0, bossLen, 0.01, 0.01), 28), darkSteel()); // 로컬 +y 방향
  boss.position.copy(at(AX1, 0.74));
  boss.quaternion.setFromUnitVectors(YAX, AX1);
  g.add(boss);

  // 축 2(G2, 구동): 꼭짓점 0.12 앞에서 끝난다(축 1 과 부딪치지 않게) — 판화에는 축 1 뒤로 이어져 있다
  g.add(rod(at(AX2, 0.12), at(AX2, 1.2), 0.045));
  for (const s of [0.86, 1.12]) {
    const p = at(AX2, s);
    g.add(ringOn(p, AX2, 0.09, 0.07));
    g.add(post(p.x, p.y, p.z - 0.06, 0.07)); // 고리 바깥 반지름 안에서 끝나 축(반지름 0.045)에는 닿지 않는다
  }

  // 회전 방향 화살표
  const ar2 = rotArrow(0.3, true);
  ar2.position.copy(at(AX2, A2 + 0.2));
  ar2.quaternion.copy(Q2);
  const ar1 = rotArrow(0.17, false); // 설계표 0.2 → 0.17: 화살촉(반지름 0.05)이 두 기어의 작은 쪽 이 끝과 넉넉히 떨어지게
  ar1.position.copy(at(AX1, 0.2));
  ar1.quaternion.copy(Q1);
  g.add(ar1, ar2);

  g.add(
    // 이름표는 제 기어 바로 옆(설계표 좌표는 기어에서 1.3 넘게 떨어져 있어 S4 에서 당김)
    tag('큰 베벨', v(-0.7, 2.3, 0.5)),
    tag('작은 베벨(구동)', v(-0.95, 1.45, 0.5)),
    tag('두 축이 비스듬히 만난다(75°)', v(1.55, 1.85, 0.5))
  );

  const qr = new THREE.Quaternion();
  return {
    group: g,
    notes: () => [
      { label: '잇수', value: `${Z1} : ${Z2}` },
      { label: '속도비', value: '1 : 1.38 (큰 쪽 1회전에 작은 쪽 1.38회전, 반대 방향)' },
      { label: '축 사이각', value: '75°' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      qr.setFromAxisAngle(ZAX, theta);
      g2.quaternion.copy(Q2).multiply(qr);
      qr.setFromAxisAngle(ZAX, -(Z2 / Z1) * theta); // 위상 덧값 0 — 물림점이 G1 +Y(이 중심), G2 −Y(이골)
      g1.quaternion.copy(Q1).multiply(qr);
    }
  };
}
