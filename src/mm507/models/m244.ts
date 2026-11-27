// 244 마찰식 동력계(프로니 브레이크) — 풀리 A 만 돌고, 너트를 죄면 레버가 C 에서 떠올라 C·C′ 사이 수평에 뜬다 — 설계표 docs/mm507-sheets/244.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, shaftZ, tag } from '../kit';
import { mesh } from '../../models/parts/geom';
import { brass, castIron, darkSteel, paint, steel, wood } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

const O: [number, number] = [-1.16, 1.76];
const RA = 0.25;
const AC = -0.0381948;
const HK: [number, number] = [2.71, 0.28];
const OMEGA_A = 1.6;
const PERIOD = 12;
const TWO_PI = Math.PI * 2;
const deg = (d: number): number => (d * Math.PI) / 180;

const s3 = (u: number): number => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

function nutAngle(tau: number): number {
  if (tau < 1.5) return 0;
  if (tau < 3.5) return (4 * Math.PI * (tau - 1.5)) / 2;
  if (tau < 9) return 4 * Math.PI;
  if (tau < 11) return 4 * Math.PI * (1 - (tau - 9) / 2);
  return 0;
}

function tiltAngle(tau: number): number {
  if (tau < 2.5) return AC;
  if (tau < 3.5) return AC * (1 - s3(tau - 2.5));
  if (tau < 9.5) return 0;
  if (tau < 10.5) return AC * s3(tau - 9.5);
  return AC;
}

function cylZ(r: number, h: number, mat: THREE.Material, seg = 16): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, seg);
  geo.rotateX(Math.PI / 2);
  return mesh(geo, mat);
}

function arcPiece(rIn: number, rOut: number, a0: number, a1: number, depth: number, mat: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, a0, a1, false);
  s.absarc(0, 0, rIn, a1, a0, true);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, -depth / 2);
  return mesh(geo, mat);
}

export default function buildM244(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 축 + 풀리
  const shaft = shaftZ(O[0], O[1], 0.14, 0.07);
  shaft.name = 'shaft';
  g.add(shaft);

  const pulleyA = new THREE.Group();
  pulleyA.name = 'pulleyA';
  pulleyA.position.set(O[0], O[1], 0);
  pulleyA.add(cylZ(RA, 0.2, paint(0xe6e8ea), 64), cylZ(0.12, 0.24, castIron(), 32));
  const markY = mesh(new THREE.BoxGeometry(0.11, 0.03, 0.006), paint(0xf2b619));
  markY.position.set(0.185, 0, 0.103);
  const markD = mesh(new THREE.BoxGeometry(0.11, 0.03, 0.006), paint(0x444a52));
  markD.position.set(-0.185, 0, 0.103);
  pulleyA.add(markY, markD);
  setMM(pulleyA, { kind: 'wheel', axis: 'z', r: RA, width: 0.2, rim: 'flat' });
  g.add(pulleyA);

  // 브레이크 묶음 (원점 O)
  const brake = new THREE.Group();
  brake.name = 'brake';
  brake.position.set(O[0], O[1], 0);
  const lever = mesh(new THREE.BoxGeometry(3.5, 0.15, 0.16), wood(0xb08a5a));
  lever.name = 'lever';
  lever.position.set(1.16, 0.415, 0);
  brake.add(lever);

  // 나무 블록
  const bs = new THREE.Shape();
  bs.moveTo(-0.3, 0.11);
  bs.lineTo(-0.2245, 0.11);
  bs.absarc(0, 0, 0.25, 2.6862, 0.4554, true);
  bs.lineTo(0.3, 0.11);
  bs.lineTo(0.3, 0.34);
  bs.lineTo(-0.3, 0.34);
  bs.closePath();
  const bGeo = new THREE.ExtrudeGeometry(bs, { depth: 0.18, bevelEnabled: false, curveSegments: 32 });
  bGeo.translate(0, 0, -0.09);
  const block = mesh(bGeo, wood(0xc9a46b));
  block.name = 'block';
  brake.add(block);

  // 너트 + 와셔
  const nutL = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 6), darkSteel());
  nutL.name = 'nutL';
  nutL.position.set(-0.33, 0.525, 0);
  const nutR = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 6), darkSteel());
  nutR.name = 'nutR';
  nutR.position.set(0.33, 0.525, 0);
  brake.add(nutL, nutR);
  for (const x of [-0.33, 0.33]) {
    const w = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 24), darkSteel());
    w.position.set(x, 0.495, 0);
    brake.add(w);
  }

  // 아래 묶음: 띠 + 나무 조각 + 이음 핀 + 볼트
  const strapGroup = new THREE.Group();
  strapGroup.name = 'strapGroup';
  const strap = new THREE.Group();
  strap.name = 'strap';
  const sMat = darkSteel();
  strap.add(arcPiece(0.31, 0.35, Math.PI, TWO_PI, 0.18, sMat));
  for (const x of [-0.33, 0.33]) {
    const leg = mesh(new THREE.BoxGeometry(0.04, 0.2, 0.18), sMat);
    leg.position.set(x, 0.1, 0);
    strap.add(leg);
  }
  strapGroup.add(strap);
  const lagging = new THREE.Group();
  lagging.name = 'lagging';
  const lagMat = wood(0xc9a46b);
  for (const [a0, a1] of [[202, 226], [230, 254], [258, 282], [286, 310], [314, 338]] as [number, number][]) {
    lagging.add(arcPiece(0.25, 0.31, deg(a0), deg(a1), 0.18, lagMat));
  }
  strapGroup.add(lagging);
  for (const a of [228, 256, 284, 312]) {
    const p = cylZ(0.012, 0.19, sMat, 8);
    p.position.set(0.33 * Math.cos(deg(a)), 0.33 * Math.sin(deg(a)), 0);
    strapGroup.add(p);
  }
  for (const [nm, x] of [['boltL', -0.33], ['boltR', 0.33]] as [string, number][]) {
    const b = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.47, 12), steel());
    b.name = nm;
    b.position.set(x, 0.385, 0);
    strapGroup.add(b);
  }
  brake.add(strapGroup);

  // 고리
  const hook = mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 24), steel());
  hook.name = 'hook';
  hook.position.set(HK[0], HK[1], 0);
  brake.add(hook);
  g.add(brake);

  // 접시 묶음
  const pan = new THREE.Group();
  pan.name = 'pan';
  const panPlate = mesh(new THREE.BoxGeometry(1.1, 0.04, 0.5), paint(0x9aa3ad));
  panPlate.name = 'panPlate';
  panPlate.position.set(0, -1.64, 0);
  pan.add(panPlate);
  const cords = new THREE.Group();
  cords.name = 'cords';
  const cordLen = Math.sqrt(0.51 * 0.51 + 1.57 * 1.57 + 0.21 * 0.21);
  const cMat = steel();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const c = mesh(new THREE.CylinderGeometry(0.008, 0.008, cordLen, 6), cMat);
      const a = v(0, -0.05, 0);
      const b = v(sx * 0.51, -1.62, sz * 0.21);
      c.position.copy(a).add(b).multiplyScalar(0.5);
      c.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
      cords.add(c);
    }
  }
  pan.add(cords);
  const wt = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 32), castIron());
  wt.position.set(-0.2, -1.52, 0);
  const bell = mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.18, 32), brass());
  bell.position.set(0.12, -1.53, 0);
  const knob = mesh(new THREE.SphereGeometry(0.04, 16, 12), brass());
  knob.position.set(0.12, -1.4, 0);
  pan.add(wt, bell, knob);
  g.add(pan);

  // 멈추개
  const stopMat = paint(0x4a4f57);
  const stopC = mesh(new THREE.BoxGeometry(0.22, 0.12, 0.39), stopMat);
  stopC.name = 'stopC';
  stopC.position.set(0.83, 1.96, -0.105);
  const stopC2 = mesh(new THREE.BoxGeometry(0.22, 0.12, 0.39), stopMat);
  stopC2.name = 'stopC2';
  stopC2.position.set(0.83, 2.39, -0.105);
  g.add(stopC, stopC2);

  // 풀리 화살표
  const arrow = rotArrow(0.36, true);
  arrow.position.set(O[0], O[1], 0.16);
  g.add(arrow);

  g.add(
    leaderTo(tag('A 풀리(돎)', v(-2.15, 1.23, 0.3)), 'pulleyA'),
    leaderTo(tag('D 지렛대(멈춰 있음)', v(0.0, 2.75, 0.3)), 'lever'),
    leaderTo(tag('B 저울 접시·추', v(0.03, 0.47, 0.3)), 'pan'),
    leaderTo(tag('C 아래 멈추개', v(0.24, 1.2, 0.3)), 'stopC'),
    leaderTo(tag('C′ 위 멈추개', v(2.09, 2.8, 0.3)), 'stopC2'),
    leaderTo(tag('나무 블록', v(-2.09, 2.65, 0.3)), 'block'),
    leaderTo(tag('죄는 나사·너트', v(-1.54, 3.13, 0.3)), 'nutL'),
    leaderTo(tag('띠에 단 나무 조각', v(-1.98, 0.79, 0.3)), 'lagging')
  );

  let sigma = 0.03;
  let alpha = AC;

  const apply = (): void => {
    const tau = ((t % PERIOD) + PERIOD) % PERIOD;
    const th = OMEGA_A * t;
    const nu = nutAngle(tau);
    sigma = 0.03 * (1 - nu / (4 * Math.PI));
    alpha = tiltAngle(tau);
    pulleyA.rotation.z = th;
    shaft.rotation.z = th;
    brake.rotation.z = alpha;
    strapGroup.position.y = -sigma;
    nutL.rotation.y = nu;
    nutR.rotation.y = nu;
    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    pan.position.set(O[0] + HK[0] * ca - HK[1] * sa, O[1] + HK[0] * sa + HK[1] * ca, 0);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '도는 것', value: '풀리 A 만 (1.6 rad/s)' },
      { label: '너트', value: sigma < 0.001 ? '조임' : sigma > 0.029 ? '풀림' : '돌리는 중' },
      {
        label: '레버 D 기울기',
        value: ((alpha * 180) / Math.PI).toFixed(2) + '° ' + (Math.abs(alpha) < 0.001 ? '수평 — C·C′ 사이에 뜸' : 'C 에 얹힘')
      },
      { label: '추 매단 점까지(축에서)', value: '2.71' },
      { label: '그 점이 축과 함께 돈다면 빠르기', value: '1.6 × 2.71 = 4.34' },
      { label: '일', value: '추 무게 × 4.34' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [0.17, 1.85, 7.4], target: [0.17, 1.5, 0.0] }
  };
}
