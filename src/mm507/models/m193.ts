// 193 맹글 휠 2 — 피니언은 한 방향으로만 도는데 휠은 거의 한 바퀴 돌고 방향을 바꿔 거의 한 바퀴 되돌아간다.
// 안쪽 이(섬 둘레)와 바깥쪽 이(바깥 벽)의 반지름이 달라 두 방향의 속도가 다르다 (판화 193번)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, roundedRect, tubeProfile } from '../../models/parts/geom';
import { displayStand, leaderTo, mangleTrack, rod, shaftZ, spurGear, tag } from '../kit';

const XC = 0; // 휠 중심
const YC = 1.85;
const RW = 1.15; // 휠 반지름
const PIN_W = 3.2; // 피니언 각속도(rad/s)
const PZ = 0.1; // 톱니 고리·피니언 중심 z
const MOD = 0.034; // 피니언·톱니 모듈
const NP = 10; // 피니언 잇수 — 피치 반지름 0.17
const R_OUT = 0.66; // 바깥 팔(피니언 중심이 바깥 벽을 물 때 휠 중심에서 거리) → 바깥 벽 피치 반지름 0.83
const R_IN = 0.56; // 안쪽 팔(섬 둘레를 물 때) → 섬 이 피치 반지름 0.39
const LOOP = 59; // 톱니 고리 길이 = 59 × 원피치

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

export default function buildM193(): MovementModel {
  const g = new THREE.Group();
  let thetaP = 0; // 피니언 절대 각(누적)
  let wheelAng = 0;
  let dir = 0;
  let distNow = R_OUT;
  g.add(displayStand());

  // 톱니 고리: 안쪽 이가 난 C자 구멍(바깥 벽 + 섬 둘레 + 양끝 반원). 피니언이 그 속을 돈다
  const track = mangleTrack({ pinionTeeth: NP, module: MOD, rOuter: R_OUT, rInner: R_IN, loopTeeth: LOOP, width: 0.09 });

  // 휠: 원판 + 테두리 + 허브 + 표시점 + 톱니 고리
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  wheel.position.set(XC, YC, 0);
  const discGeo = lathe(rodProfile(RW, 0, 0.05, 0.008, 0.008), 72);
  discGeo.rotateX(Math.PI / 2);
  wheel.add(at(discGeo, brass(), 0, 0, 0.005));
  const rimGeo = lathe(tubeProfile(RW - 0.07, RW, 0, 0.1, 0.01), 72);
  rimGeo.rotateX(Math.PI / 2);
  wheel.add(at(rimGeo, brass(), 0, 0, 0.005));
  const hubGeo = lathe(rodProfile(0.17, 0, 0.14, 0.012, 0.012), 40);
  hubGeo.rotateX(Math.PI / 2);
  wheel.add(at(hubGeo, darkSteel(), 0, 0, 0.005));
  wheel.add(at(new THREE.BoxGeometry(0.1, 0.03, 0.012), paint(0xf2b619), RW - 0.035, 0, 0.108));
  const rack = track.group;
  rack.name = 'track';
  rack.position.z = PZ;
  wheel.add(rack);
  g.add(wheel, shaftZ(XC, YC, 0.4, 0.04));

  // 피니언: 축이 세운 막대의 홈을 따라 조금씩 오르내린다
  const pinion = new THREE.Group();
  pinion.name = 'pinion';
  const pinionGear = spurGear(NP, MOD, { width: 0.07, spokes: 0, driver: true });
  pinion.add(pinionGear);
  pinion.add(rod(v(0, 0, -0.03), v(0, 0, 0.27), 0.022));
  pinion.position.set(XC, YC - R_OUT, PZ);
  g.add(pinion);

  // 세운 고정 막대(홈) + 받침: 홈 길이는 피니언 중심이 오르내리는 범위(R_IN ~ R_OUT)에 맞춘다
  const yHi = YC - R_IN + 0.02;
  const yLo = YC - R_OUT - 0.02;
  const barShape = roundedRect(-0.07, 0.33, 0.07, 1.62, 0.03);
  const slot = new THREE.Path();
  slot.absarc(0, yHi - 0.0, 0.032, 0, Math.PI, false);
  slot.lineTo(-0.032, yLo);
  slot.absarc(0, yLo, 0.032, Math.PI, 2 * Math.PI, false);
  slot.closePath();
  barShape.holes.push(slot);
  g.add(at(extrude(barShape, 0.04, 0.008), steel(), 0, 0, 0.32));
  g.add(at(new THREE.BoxGeometry(0.34, 0.14, 0.24), castIron(), 0, 0.25, 0.3));
  const washer = lathe(tubeProfile(0.02, 0.05, 0, 0.012, 0.003), 24);
  washer.rotateX(Math.PI / 2);
  pinion.add(at(washer, darkSteel(), 0, 0, 0.255));

  g.add(
    leaderTo(tag('맹글 휠', v(1.35, 2.75, 0.35)), wheel),
    leaderTo(tag('피니언', v(0.8, 0.85, 0.5)), pinion),
    tag('세운 막대(홈)', v(-0.75, 0.62, 0.5)),
    tag('톱니 고리', v(-1.35, 2.25, 0.35))
  );

  return {
    group: g,
    view: { pos: [0.6, 2.3, 6.2], target: [0, 1.75, 0] },
    notes: () => [
      { label: '피니언', value: '한 방향으로 계속 회전' },
      { label: '휠', value: dir > 0 ? '반시계로 회전' : dir < 0 ? '시계로 회전' : '정지' },
      { label: '이 반지름', value: `바깥 ${(R_OUT + (NP * MOD) / 2).toFixed(2)} / 안쪽 ${(R_IN - (NP * MOD) / 2).toFixed(2)}` },
      { label: '휠 각', value: `${((wheelAng * 180) / Math.PI).toFixed(0)}°  (중심 거리 ${distNow.toFixed(2)})` }
    ],
    update(dt: number, speed: number): void {
      thetaP += PIN_W * speed * dt;
      const r = track.solve(thetaP);
      dir = Math.sign(r.wheel - wheelAng) * (Math.abs(r.wheel - wheelAng) > 1e-6 ? 1 : 0);
      wheelAng = r.wheel;
      distNow = r.dist;
      wheel.rotation.z = r.wheel;
      pinion.position.y = YC - r.dist;
      pinionGear.rotation.z = thetaP;
    }
  };
}
