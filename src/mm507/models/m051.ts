// 051 유니버설 조인트 (2) — 두 고리 맞걸이형. 비스듬한 두 축을 서로 꿴 두 타원 고리로 잇는다 (판화 51번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rod, rotArrow, tag, STAGE } from '../kit';
import { ovalRing } from '../kit/k051';
import { castIron, bronze, paint } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const B = (15 * Math.PI) / 180; // 각 축이 수평에서 내려간 각
const O = new THREE.Vector3(0, 2.2, 0.2); // 조인트 중심
const LA = 0.5;
const WA = 0.2;
const TUBE = 0.025;
const DELTA = 0.28;
const D1 = new THREE.Vector3(-Math.cos(B), -Math.sin(B), 0);
const D2 = new THREE.Vector3(Math.cos(B), -Math.sin(B), 0);
const E1 = D1.clone().negate();
const E2 = D2.clone().negate();
const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

/** 한 축 그룹: 로컬 x = 조인트 쪽, 고리·막대·칼라·표시선·핀 */
function buildShaft(name: string, ringName: string, driver: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  const ring = ovalRing(LA, WA, TUBE, { driver });
  ring.name = ringName;
  ring.position.x = DELTA - LA;
  g.add(ring);
  // 축 막대: 고리 뒤 끝(x = −0.72)부터 x = −1.5
  g.add(rod(new THREE.Vector3(-(2 * LA - DELTA), 0, 0), new THREE.Vector3(-1.5, 0, 0), 0.045));
  // 칼라 + 표시선
  const col = lathe(tubeProfile(0.045, 0.07, -0.03, 0.03, 0.008), 28);
  col.rotateZ(Math.PI / 2);
  const cm = mesh(col, bronze({ roughness: 0.34 }));
  cm.position.x = -0.98; // 베어링 링(1.015~1.085) 앞에서 0.005 띄움 — −1.0 이면 표시선이 도는 동안 링에 0.01 박혔다
  g.add(cm);
  const mk = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), paint(0xf2b619));
  mk.position.set(-0.98, 0.075, 0);
  g.add(mk);
  // 판화 꼭대기의 작은 원 두 개는 서로 꿴 두 고리의 앞끝 단면으로 본다. 고리 안쪽 조임 핀은 넣지 않는다
  // (검증: 앞끝이 상대 고리와 가장 가까운 곳(중심선 0.060)이라 핀이 상대 고리를 뚫음, 2026-11-25)
  return g;
}

/** 베어링: 뒤판에서 나온 기둥 + 축을 두른 링. 위치 p(축 위 점), 축 방향 d */
function bearing(p: THREE.Vector3, d: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const ringGeo = lathe(tubeProfile(0.045, 0.085, -0.035, 0.035, 0.008), 28);
  const r = mesh(ringGeo, castIron());
  r.position.copy(p);
  r.quaternion.setFromUnitVectors(Y, d.clone().normalize());
  g.add(r);
  // 기둥은 링 바깥 벽(반지름 0.045~0.085) 안에서 끝난다 — 축 막대를 뚫지 않게
  const len = p.z - 0.065 - STAGE.backZ;
  const pl = lathe(rodProfile(0.035, 0, len, 0.006, 0.006), 20);
  pl.rotateX(Math.PI / 2); // 프로파일 y → +z
  const pm = mesh(pl, castIron());
  pm.position.set(p.x, p.y, STAGE.backZ);
  g.add(pm);
  return g;
}

function basis(x: THREE.Vector3, n: THREE.Vector3): THREE.Quaternion {
  const y = new THREE.Vector3().crossVectors(n, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, n);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

export default function buildM051(): MovementModel {
  const root = new THREE.Group();
  let theta = 0;
  root.add(displayStand());

  const g1 = buildShaft('shaftA', 'ringA', true);
  const g2 = buildShaft('shaftB', 'ringB', false);
  g1.position.copy(O);
  g2.position.copy(O);
  root.add(g1, g2);

  for (const s of [1.05, 1.4]) {
    root.add(bearing(O.clone().addScaledVector(D1, s), D1));
    root.add(bearing(O.clone().addScaledVector(D2, s), D2));
  }

  const a1 = rotArrow(0.3, true);
  a1.position.copy(O).addScaledVector(D1, 1.22);
  a1.quaternion.setFromUnitVectors(Z, D1);
  const a2 = rotArrow(0.3, true);
  a2.position.copy(O).addScaledVector(D2, 1.22);
  a2.quaternion.setFromUnitVectors(Z, E2);
  root.add(a1, a2);

  root.add(
    tag('구동축(회전)', new THREE.Vector3(-1.2, 1.35, 0.5)),
    tag('고리 맞걸이 조인트(두 고리가 서로 수직)', new THREE.Vector3(0, 2.75, 0.5)),
    tag('피동축(속도가 오르내림)', new THREE.Vector3(1.2, 1.35, 0.5))
  );

  const d1xz = new THREE.Vector3().crossVectors(D1, Z);
  const d2xz = new THREE.Vector3().crossVectors(D2, Z);
  let psi = 0;
  let ratio = 0.866;
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();
  function pose(): void {
    n1.copy(Z).multiplyScalar(Math.cos(theta)).addScaledVector(d1xz, Math.sin(theta)).normalize();
    n2.crossVectors(D2, n1).normalize();
    g1.quaternion.copy(basis(E1, n1));
    g2.quaternion.copy(basis(E2, n2));
    psi = Math.atan2(n2.dot(d2xz), n2.dot(Z));
    const s2 = Math.sin(theta) ** 2;
    ratio = 0.866 / (1 - 0.25 * s2);
  }
  pose();

  const deg = (r: number): string => `${Math.round((((r * 180) / Math.PI) % 360 + 360) % 360)}°`;
  return {
    group: root,
    notes: () => [
      { label: '축 사이각', value: '150° (30° 꺾임)' },
      { label: '구동각', value: deg(theta) },
      { label: '피동각', value: deg(psi) },
      { label: '지금 속도비', value: ratio.toFixed(2) },
      { label: '한 바퀴 평균', value: '1 : 1' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
