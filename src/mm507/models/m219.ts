// 219 편심 크라운 기어 — 크라운 접시가 세로 축에서 치우쳐 돌아, 긴 피니언과 물린 곳의 반지름이 0.20~0.46 으로 변한다 — 설계표 docs/mm507-sheets/219.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, spurGear, tag } from '../kit';
import { K219, eccCrown219, pinionAngle219, rho219 } from '../kit/k219';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { brass, darkSteel, paint, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K219;

export default function buildM219(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());
  const [SX, SY, SZ] = K.S;

  // 크라운 회전 그룹 + 접시
  const crownSpin = new THREE.Group();
  crownSpin.name = 'crownSpin';
  crownSpin.position.set(SX, SY, SZ);
  const crown = eccCrown219();
  crown.name = 'crown';
  crown.position.set(K.E, 0, 0);
  crown.rotation.x = -Math.PI / 2;
  crownSpin.add(crown);
  g.add(crownSpin);

  // 세로 축(θ 로 돎) + 노란 띠
  const crownShaft = new THREE.Group();
  crownShaft.name = 'crownShaft';
  crownShaft.position.set(SX, 0, SZ);
  const shaftBody = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.02, 32), steel());
  shaftBody.position.y = 0.69;
  const band = mesh(new THREE.BoxGeometry(0.072, 0.04, 0.01), paint(0xf2b619));
  band.position.set(0, 0.9, 0.035);
  crownShaft.add(shaftBody, band);
  g.add(crownShaft);

  // 세움 베어링(고정)
  const footBearing = new THREE.Group();
  footBearing.name = 'footBearing';
  footBearing.position.set(SX, 0, SZ);
  footBearing.add(mesh(lathe(tubeProfile(0.036, 0.075, 0.18, 0.55, 0.006), 32), darkSteel()));
  const flange = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 40), darkSteel());
  flange.position.y = 0.195;
  footBearing.add(flange);
  g.add(footBearing);

  // 긴 피니언
  const pinion = new THREE.Group();
  pinion.name = 'pinion';
  pinion.position.set(K.PIN_X0, K.YP, SZ);
  const sp = spurGear(K.NP, K.M, { width: 0.34, spokes: 0 });
  sp.rotation.y = Math.PI / 2;
  pinion.add(sp);
  g.add(pinion);

  // 피니언 축 + 깃발 원판
  const pinionShaft = new THREE.Group();
  pinionShaft.name = 'pinionShaft';
  pinionShaft.position.set(0, K.YP, SZ);
  const psGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.42, 24);
  psGeo.rotateZ(Math.PI / 2);
  const ps = mesh(psGeo, steel());
  ps.position.x = (-0.39 + 1.03) / 2;
  pinionShaft.add(ps);
  const flag = new THREE.Group();
  flag.name = 'flag';
  const fdGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.012, 40);
  fdGeo.rotateZ(Math.PI / 2);
  const fd = mesh(fdGeo, brass());
  fd.position.x = 1.035;
  const fb = mesh(new THREE.BoxGeometry(0.008, 0.07, 0.016), paint(0xf2b619));
  fb.position.set(1.035 + 0.006 + 0.004, 0.045, 0);
  flag.add(fd, fb);
  pinionShaft.add(flag);
  g.add(pinionShaft);

  // 받침 기둥 2개 + 꼭대기 베어링 고리
  for (const [i, px] of [[1, 0.3], [2, 0.85]] as [number, number][]) {
    const post = new THREE.Group();
    post.name = `pinionPost${i}`;
    const body = mesh(new THREE.BoxGeometry(0.08, 1.323, 0.08), darkSteel());
    body.position.set(px, 0.8416, SZ);
    const rGeo = lathe(tubeProfile(0.023, 0.06, -0.03, 0.03, 0.005), 32);
    rGeo.rotateZ(-Math.PI / 2);
    const ring = mesh(rGeo, darkSteel());
    ring.position.set(px, K.YP, SZ);
    post.add(body, ring);
    g.add(post);
  }

  // 맞물린 곳 화살촉(끝이 아래)
  const coneGeo = new THREE.ConeGeometry(0.035, 0.08, 16);
  coneGeo.rotateX(Math.PI); // 끝이 아래
  const meshPointer = mesh(coneGeo, paint(0xf2b619));
  meshPointer.name = 'meshPointer';
  meshPointer.position.set(SX + 0.2, K.YP + 0.16, SZ);
  g.add(meshPointer);

  // 크라운 회전 화살표(위에서 보아 반시계)
  const arrow = rotArrow(0.25, true);
  arrow.position.set(SX, 0.75, SZ);
  arrow.rotation.x = -Math.PI / 2;
  g.add(arrow);

  g.add(
    leaderTo(tag('크라운 바퀴(이 40, 축에서 치우침)', v(-0.7, 2.0, 0.5)), 'crown'),
    leaderTo(tag('세로 축(일정하게 돎)', v(-1.35, 0.85, 0.5)), 'crownShaft'),
    leaderTo(tag('긴 피니언(이 10) — 빨라졌다 느려짐', v(0.35, 2.3, 0.5)), 'pinion'),
    leaderTo(tag('맞물린 곳 반지름 0.20~0.46', v(-0.3, 2.6, 0.5)), 'meshPointer'),
    leaderTo(tag('접시 중심(빨강)·축 자리(노랑)', v(0.5, 0.5, 0.6)), 'markC')
  );

  let theta = Math.PI;
  let rho = rho219(theta);
  let ratio = 0;
  const apply = (): void => {
    theta = Math.PI + K.OMEGA * t;
    rho = rho219(theta);
    const phi = pinionAngle219(theta);
    crownSpin.rotation.y = theta;
    crownShaft.rotation.y = theta;
    pinion.rotation.x = phi;
    pinionShaft.rotation.x = phi;
    meshPointer.position.x = SX + rho;
    const d = 1e-4;
    ratio = (pinionAngle219(theta + d) - pinionAngle219(theta - d)) / (2 * d);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '크라운 각', value: (((((theta * 180) / Math.PI) % 360) + 360) % 360).toFixed(0) + '°' },
      { label: '맞물린 곳 반지름', value: rho.toFixed(3) + ' (0.200~0.460)' },
      { label: '피니언 / 크라운 빠르기', value: ratio.toFixed(2) + '배 (2.42~5.58)' },
      { label: '원리', value: '접시가 축에서 0.13 치우쳐, 피니언과 물린 곳이 축에서 멀면 빠르고 가까우면 느리다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [-0.9, 2.7, 3.7], target: [-0.1, 1.45, 0.3] }
  };
}
