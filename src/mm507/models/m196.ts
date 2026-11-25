// 196 흔들리는 팔의 기어 — 고정 축 피니언 B 가 돌면, 팔 끝의 길쭉한 땅콩꼴 바퀴 A 가 B 둘레를 굴러 오르내리며 팔이 불규칙하게 흔들린다 (판화 196번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { brass, castIron, darkSteel, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, roundedRect } from '../../models/parts/geom';
import { displayStand, ellipticalGear, leaderTo, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { K196, RP196, swingSolver196, wavyPitch196 } from '../kit/k196';

const DEG = 180 / Math.PI;
const PIN_W = OMEGA * 1.4; // 피니언 B 각속도
const THETA0 = 10.66; // t=1 에 판화 자세(팔 수평, 긴 덩이가 오른쪽, B 가 A 바로 아래)
const m = (K196.pitch) / Math.PI;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const o = mesh(geo, mat);
  o.position.set(x, y, z);
  return o;
};
const cylZ = (r: number, z0: number, z1: number): THREE.BufferGeometry => {
  const g = lathe(rodProfile(r, z0, z1, 0.008, 0.008), 32);
  g.rotateX(Math.PI / 2);
  return g;
};

export default function buildM196(): MovementModel {
  const g = new THREE.Group();
  let theta = THETA0;
  let cur = { alpha: 0, beta: 0, dist: 0 };
  g.add(displayStand());
  const [px, py] = K196.P;
  const [bx, by] = K196.B;

  const pitch = wavyPitch196();
  const solver = swingSolver196(pitch);

  // 고정 받침: 바닥 블록 + 위로 좁아지는 기둥 + 팔 축 보스
  const baseTop = 1.0;
  g.add(at(new THREE.BoxGeometry(1.5, 0.5, 0.36), castIron(), px + 0.1, baseTop - 0.25, 0.04));
  const col = new THREE.Shape();
  col.moveTo(-0.28, 0);
  col.lineTo(0.28, 0);
  col.lineTo(0.1, py - baseTop - 0.14);
  col.lineTo(-0.1, py - baseTop - 0.14);
  col.closePath();
  g.add(at(extrude(col, 0.12, 0.008), steel(), px, baseTop, 0.0));
  g.add(at(cylZ(0.14, 0.0, 0.17), steel(), px, py, 0));
  g.add(at(cylZ(0.05, 0.0, 0.27), darkSteel(), px, py, 0)); // 팔 축(받침을 꿰고 팔 눈을 지나 머리가 나온다)

  // 바퀴 A: 두 덩이가 붙은 땅콩꼴 피치 곡선 + 이(30개). 축(팔 끝)은 왼쪽 덩이 중심
  const wheel = ellipticalGear(pitch, K196.na, { width: 0.1 });
  const ring = wheel.children[1]; // 안쪽 어두운 홈선은 판화에 없으니 뺀다
  if (ring) wheel.remove(ring);
  wheel.name = 'wheelA';
  g.add(wheel);

  // 팔: 받침 P 에서 A 까지, 바퀴 앞면 위로 지난다
  const arm = new THREE.Group();
  arm.name = 'arm';
  arm.position.set(px, py, K196.zArm + 0.025);
  const armShape = roundedRect(-K196.Lp - 0.09, -0.07, 0.09, 0.07, 0.06);
  for (const ex of [0, -K196.Lp]) {
    const h = new THREE.Path();
    h.absarc(ex, 0, 0.052, 0, Math.PI * 2, true);
    armShape.holes.push(h);
  }
  arm.add(at(extrude(armShape, 0.05, 0.008), brass(), 0, 0, 0.0));
  const armEnd = new THREE.Group();
  armEnd.name = 'armPin';
  g.add(arm, armEnd);
  const pinA = at(cylZ(0.05, 0.12, 0.27), steel(), 0, 0, 0); // A 축 핀(팔 끝 눈)
  pinA.name = 'pinA';
  g.add(pinA);

  // 피니언 B: 고정 축(뒤판 보스에서 나온다)
  const pinion = spurGear(K196.nb, m, { width: 0.09, spokes: 4, driver: true });
  pinion.name = 'pinionB';
  pinion.position.set(bx, by, K196.zWheel);
  g.add(pinion, shaftZ(bx, by, 0.2, 0.04));

  const arrow = rotArrow(RP196 * 0.6, true);
  arrow.position.set(bx, by, K196.zWheel + 0.07);
  g.add(arrow);

  g.add(
    leaderTo(tag('피니언 B(고정 축)', v(-1.6, 0.85, 0.3)), pinion),
    leaderTo(tag('바퀴 A', v(-1.7, 2.9, 0.3)), wheel),
    leaderTo(tag('흔들리는 팔', v(0.2, 2.75, 0.35)), arm),
    leaderTo(tag('고정 받침', v(1.8, 1.75, 0.3)), arm)
  );

  const place = (): void => {
    const s = solver.at(theta);
    cur = s;
    wheel.position.set(s.a[0], s.a[1], K196.zWheel);
    wheel.rotation.z = s.beta;
    pinA.position.set(s.a[0], s.a[1], 0);
    arm.rotation.z = s.alpha - Math.PI;
    pinion.rotation.z = theta;
  };
  place();

  return {
    group: g,
    view: { pos: [0.1, 1.95, 6.4], target: [0.1, 1.75, 0] },
    notes: () => [
      { label: '피니언 B', value: `${((theta - THETA0) / (2 * Math.PI)).toFixed(1)} 바퀴 (한 방향)` },
      { label: '팔 각', value: `${(cur.alpha * DEG).toFixed(1)}° (${(solver.alphaMin * DEG).toFixed(0)}° ~ ${(solver.alphaMax * DEG).toFixed(0)}° 사이를 불규칙하게)` },
      { label: 'A~B 거리', value: `${cur.dist.toFixed(2)}` },
      { label: '한 주기', value: `B ${(solver.period / (2 * Math.PI)).toFixed(1)} 바퀴 = A 1바퀴` }
    ],
    update(dt: number, speed: number): void {
      theta += PIN_W * speed * dt;
      place();
    }
  };
}
