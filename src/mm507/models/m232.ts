// 232 끌어 당기는 폴 — 팔 B 가 오르내리며 들보 A 의 두 멈춤 핀 사이에서 헛돌고, 그동안 폴 C 가 이골에서 들렸다 떨어져 바퀴를 끌고 간다 (판화 232번)
//  설계표 docs/mm507-sheets/232.md · 부품·운동식은 kit/k232 + kit/k092(크랭크 원판·연결봉) 조립만 한다
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K232, armB232, carrier232, pawlC232, squareWheel232, state232 } from '../kit/k232';
import { connectingRod, crankDisc } from '../kit/k092';
import { paint } from '../../models/materials';
import { extrude, shapeFrom } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const ACTIVE = 0x7a4a00;
const PHASE_NAME = {
  drop: '떨굼 — C 가 이골로',
  drive: '끎 — 바퀴를 끌고 감',
  lift: '들어올림 — C 가 이골에서 빠짐',
  back: '되돌아감 — 들린 C 가 뒤로'
} as const;

export default function buildM232(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const [OX, OY] = K232.O;
  const [KX, KY] = K232.K;

  g.add(displayStand());

  const axle = shaftZ(OX, OY, 0.21, 0.06);
  axle.name = 'axle';
  g.add(axle);
  g.add(shaftZ(KX, KY, 0.1, 0.05));

  const wheel = squareWheel232();
  wheel.name = 'wheel';
  wheel.position.set(OX, OY, 0);
  g.add(wheel);

  const carrierA = carrier232();
  carrierA.name = 'carrierA';
  carrierA.position.set(OX, OY, 0);
  g.add(carrierA);

  const armB = armB232();
  armB.name = 'armB';
  armB.position.set(OX, OY, 0);
  g.add(armB);

  const pawlC = pawlC232();
  pawlC.name = 'pawlC';
  g.add(pawlC);
  const matC = pawlC.userData.mat as THREE.MeshStandardMaterial;

  const linkC = connectingRod(K232.linkC, { thick: 0.04, holeR: 0.023, eyeR: 0.05, barHalf: 0.022 });
  linkC.name = 'linkC';
  g.add(linkC);

  const crank = crankDisc(0.4, K232.rk, { thick: 0.08, pinR: 0.045, pinTop: 0.3, pinZ: 0.24 });
  crank.name = 'crank';
  crank.position.set(KX, KY, 0);
  g.add(crank);

  const rodK = connectingRod(K232.Lk, { thick: 0.05 });
  rodK.name = 'rodK';
  g.add(rodK);

  // 표시: 바퀴 시계 화살표, B 움직임 화살표
  const arrow = rotArrow(0.3, false);
  arrow.position.set(OX, OY, 0.32);
  g.add(arrow);
  // 납작한 노란 화살표를 팔 B 앞면(z 0.19)에 붙여 B 와 함께 움직인다(위/아래)
  const mkArrow = (name: string, down: boolean): THREE.Mesh => {
    const shape = shapeFrom([[-0.012, -0.06], [0.012, -0.06], [0.012, 0], [0.05, 0], [0, 0.065], [-0.05, 0], [-0.012, 0]]);
    const m = new THREE.Mesh(extrude(shape, 0.008, 0.001, 4), paint(0xffcc00));
    m.name = name;
    m.castShadow = true;
    m.position.set(0.75, 0, 0.194);
    if (down) m.rotation.z = Math.PI;
    armB.add(m);
    return m;
  };
  const upArrow = mkArrow('upArrow', false);
  const downArrow = mkArrow('downArrow', true);

  // 이름표 6개
  g.add(
    leaderTo(tag('톱니바퀴(20이)', v(-1.45, 2.65, 0.3)), 'wheel'),
    leaderTo(tag('팔 A', v(-1.75, 1.6, 0.3)), 'carrierA'),
    leaderTo(tag('팔 B', v(1.55, 2.1, 0.3)), 'armB'),
    leaderTo(tag('폴 C', v(0.9, 2.65, 0.3)), 'pawlC'),
    leaderTo(tag('크랭크', v(1.75, 0.4, 0.3)), 'crank'),
    leaderTo(tag('연결봉', v(1.75, 0.95, 0.3)), 'rodK')
  );

  const pose = (th: number): void => {
    const s = state232(th);
    const [cx, cy] = K232.CpA;
    const ca = Math.cos(s.alpha);
    const sa = Math.sin(s.alpha);
    const cpx = OX + cx * ca - cy * sa;
    const cpy = OY + cx * sa + cy * ca;
    wheel.rotation.z = s.wheel;
    carrierA.rotation.z = s.alpha;
    armB.rotation.z = s.beta;
    pawlC.position.set(cpx, cpy, 0);
    pawlC.rotation.z = s.alpha + s.sigma;
    matC.emissive.setHex(s.drive ? ACTIVE : 0x000000);
    // 연결 막대: bPin(B 위 반지름 rb) → cTail(C 피벗에서 0.275)
    const bpx = OX + K232.rb * Math.cos(s.beta);
    const bpy = OY + K232.rb * Math.sin(s.beta);
    const ct = s.alpha + s.sigma;
    const ctx = cpx + K232.tail * Math.cos(ct);
    const cty = cpy + K232.tail * Math.sin(ct);
    linkC.position.set(bpx, bpy, 0.225);
    linkC.rotation.z = Math.atan2(cty - bpy, ctx - bpx);
    crank.rotation.z = K232.thF + s.u;
    rodK.position.set(s.P[0], s.P[1], 0.24);
    rodK.rotation.z = Math.atan2(s.E[1] - s.P[1], s.E[0] - s.P[0]);
    downArrow.visible = s.u < Math.PI;
    upArrow.visible = s.u >= Math.PI;
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.0, 1.55, 6.2], target: [0.0, 1.5, 0] },
    notes: () => {
      const s = state232(theta);
      return [
        { label: '지금', value: PHASE_NAME[s.phase] },
        { label: '바퀴', value: '늘 시계, 한 번 오르내림에 1이(18°)' },
        { label: 'C 들림', value: `${((s.sigma * 180) / Math.PI).toFixed(1)}°` },
        { label: '원리', value: '팔 B 는 들보 A 의 두 핀 사이에서 14.7° 헛돌며 그동안 C 를 들고 내린다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
