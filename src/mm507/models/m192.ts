// 192 맹글 휠 1 — 휠 면의 C자 모양 톱니 홈(바깥 벽 이 + 안쪽 섬 둘레 이) 속을 피니언이 돌며 휠을 왕복 회전시킨다 (판화 192번)
// 피니언 축은 고정 막대의 세로 홈에 끼어 오르내리고, 휠의 홈(b·d)이 피니언을 이 쪽으로 이끈다.
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, roundedRect, tubeProfile } from '../../models/parts/geom';
import { displayStand, leaderTo, mangleTrack, rod, shaftZ, spurGear, tag } from '../kit';
import { groovedDisc, grooveRoller } from '../kit/k192';

const XC = 0; // 휠 중심
const YC = 1.85;
const RW = 1.15; // 휠 반지름
const PIN_W = 3.2; // 피니언 각속도(rad/s) = 2·OMEGA
const PZ = 0.1; // 톱니 고리·피니언 중심 z

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

export default function buildM192(): MovementModel {
  const g = new THREE.Group();
  let thetaP = 0; // 피니언 절대 각(누적)
  let thetaP0 = 0;
  let wheelAng = 0;
  let dir = 0;
  g.add(displayStand());

  // 톱니 띠: 피니언 10잇수·모듈 0.022, 피니언 중심 경로 바깥 팔 0.88 / 안쪽 팔 0.5, 띠 위 이 117 − 10 = 107개
  const track = mangleTrack({ pinionTeeth: 10, module: 0.022, rOuter: 0.89, rInner: 0.57, loopTeeth: 120, width: 0.09 });

  // 휠: 원판 + 테두리 + 허브 + 표시점 + 톱니 고리 (z 방향 쌓기)
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  wheel.position.set(XC, YC, 0);
  // 원판 = 뒤판 + 앞 층(안내 홈 띠를 뺀 바깥 조각 + 고리 안쪽 섬): 피니언 중심 경로를 따라 홈(반폭 0.037, 바닥 z 0.025)이 파여 피니언 축 끝 굴림대를 붙든다
  const groove = groovedDisc({ R1: 0.89, R2: 0.57, L: track.length, hw: 0.037, rBack: RW, rFront: RW - 0.07, z0: 0.005, zBot: 0.025, z1: 0.055 });
  wheel.add(groove);
  const rimGeo = lathe(tubeProfile(RW - 0.07, RW, 0, 0.1, 0.01), 64);
  rimGeo.rotateX(Math.PI / 2);
  wheel.add(at(rimGeo, brass(), 0, 0, 0.005));
  const hubGeo = lathe(rodProfile(0.17, 0, 0.14, 0.012, 0.012), 40);
  hubGeo.rotateX(Math.PI / 2);
  wheel.add(at(hubGeo, darkSteel(), 0, 0, 0.005));
  wheel.add(at(new THREE.BoxGeometry(0.1, 0.03, 0.012), paint(0xf2b619), RW - 0.035, 0, 0.108));
  // 판화 자세(t = 1): 휠의 입구(틈)가 위쪽을 향하는 때(휠 각 ≈ −80°)를 찾아 그 때의 피니언 각으로 시작
  let best = 1e9;
  const per = track.length / track.pinionPitchR;
  for (let i = 0; i < 4000; i++) {
    const th = (per * i) / 4000;
    const d = Math.abs(track.solve(th).wheel + 1.4);
    if (d < best) {
      best = d;
      thetaP0 = th;
    }
  }
  thetaP = thetaP0 - PIN_W * 1.0;
  const rack = track.group;
  rack.position.z = PZ;
  wheel.add(rack);
  g.add(wheel, shaftZ(XC, YC, 0.4, 0.04));

  // 피니언: 축이 세운 막대의 홈을 따라 오르내린다
  const pinion = new THREE.Group();
  pinion.add(spurGear(10, 0.022, { width: 0.07, spokes: 0, driver: true }));
  // 축: 뒤로는 휠 면의 안내 홈 속 굴림대(z 0.029~0.051), 앞으로는 세운 막대의 홈(z 0.30~0.34)을 지나 와셔까지
  pinion.add(rod(v(0, 0, -0.06), v(0, 0, 0.28), 0.022));
  pinion.add(grooveRoller(0.03, -0.071, -0.049));
  pinion.position.set(XC, YC - 0.7, PZ);
  g.add(pinion);

  // 세운 고정 막대(홈) + 받침
  const barShape = roundedRect(-0.07, 0.33, 0.07, 1.62, 0.03); // 모따기(0.008) 아랫끝이 받침 윗면(0.32) 위에 앉게
  const slot = new THREE.Path();
  slot.absarc(0, YC - 0.48, 0.032, 0, Math.PI, false);
  slot.lineTo(-0.032, YC - 0.9);
  slot.absarc(0, YC - 0.9, 0.032, Math.PI, 2 * Math.PI, false);
  slot.closePath();
  barShape.holes.push(slot);
  const guideBar = at(extrude(barShape, 0.04, 0.008), steel(), 0, 0, 0.32);
  guideBar.name = 'guideBar';
  g.add(guideBar);
  g.add(at(new THREE.BoxGeometry(0.34, 0.14, 0.24), castIron(), 0, 0.25, 0.3));
  // 막대 앞쪽 와셔
  const washer = lathe(tubeProfile(0.02, 0.05, 0, 0.012, 0.003), 24);
  washer.rotateX(Math.PI / 2);
  pinion.add(at(washer, darkSteel(), 0, 0, 0.247));

  g.add(
    leaderTo(tag('맹글 휠', v(1.35, 2.85, 0.35)), 'wheel'),
    leaderTo(tag('피니언', v(0.75, 0.88, 0.5)), pinion),
    leaderTo(tag('피니언 안내 막대(고정)', v(-0.95, 0.62, 0.5)), 'guideBar'),
    leaderTo(tag('톱니 홈(b·d)', v(-1.35, 2.75, 0.35)), 'wheel'),
    leaderTo(tag('안내 홈', v(-1.4, 1.2, 0.35)), groove)
  );

  const pose = (): void => {
    const r = track.solve(thetaP);
    wheelAng = r.wheel;
    wheel.rotation.z = r.wheel;
    pinion.position.y = YC - r.dist;
    pinion.children[0]!.rotation.z = thetaP;
  };
  pose();

  return {
    group: g,
    view: { pos: [0.6, 2.3, 6.2], target: [0, 1.75, 0] },
    notes: () => [
      { label: '피니언', value: '한 방향으로 계속 회전' },
      { label: '휠', value: dir > 0 ? '반시계로 회전' : dir < 0 ? '시계로 회전' : '정지' },
      { label: '휠 각', value: `${((wheelAng * 180) / Math.PI).toFixed(0)}°` }
    ],
    update(dt: number, speed: number): void {
      thetaP += PIN_W * speed * dt;
      const r = track.solve(thetaP);
      dir = Math.sign(r.wheel - wheelAng) * (Math.abs(r.wheel - wheelAng) > 1e-6 ? 1 : 0);
      wheelAng = r.wheel;
      wheel.rotation.z = r.wheel;
      pinion.position.y = YC - r.dist;
      pinion.children[0]!.rotation.z = thetaP;
    }
  };
}
