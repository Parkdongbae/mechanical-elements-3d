// 197 맹글 랙 — 피니언이 한 방향으로 돌면, 핀 줄이 박힌 판(랙)이 앞뒤로 왕복한다.
// 피니언 축은 세로 홈 속에서 오르내리며(위 줄 → 끝 핀 둘레 → 아래 줄) 랙 끝을 돌아 반대편 줄로 넘어간다 (판화 197번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, spurGear, tag } from '../kit';
import { K197, LH197, LOOP197, RP197, endArc197, loop197, pinionBody197, rack197, rail197, shaftGuide197 } from '../kit/k197';
import { darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const U0 = 0.456; // t = 1 에서 피니언이 위 줄 왼쪽으로 가는 중이 되게 하는 시작 호장

export default function buildM197(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 랙(핀 판)
  const rack = rack197();
  rack.name = 'rack';
  g.add(rack);

  // 고정: 축 안내판, 판 위·아래 레일(가운데는 축이 지나가도록 비움), 끝 안내 호
  const guide = shaftGuide197(0, K197.YC);
  guide.name = 'guide';
  g.add(guide);
  const yr = K197.H + 0.006 + 0.015;
  for (const sgn of [1, -1]) {
    g.add(rail197(0.17, 1.88, K197.YC + sgn * yr), rail197(-1.88, -0.17, K197.YC + sgn * yr));
  }
  const arcR = endArc197(1);
  arcR.name = 'endArcR';
  arcR.position.set(0, K197.YC, 0);
  // 오른쪽 끝에 닿은 판 끝(판 끝 중심 = 0.984 + LH)에 중심을 맞춘 호
  arcR.position.x = 0.984 + LH197;
  const arcL = endArc197(-1);
  arcL.name = 'endArcL';
  arcL.position.set(-0.984 - LH197, K197.YC, 0);
  g.add(arcR, arcL);

  // 피니언 수레: 축 + 앞 덮개 (오르내림만)
  const car = new THREE.Group();
  car.name = 'shaft';
  const shaftGeo = lathe(rodProfile(0.034, 0, 0.45, 0.006, 0.006), 24);
  shaftGeo.rotateX(Math.PI / 2);
  const shaft = mesh(shaftGeo, steel());
  shaft.position.z = -0.28;
  car.add(shaft);
  g.add(car);

  // 피니언(회전)
  const pivot = new THREE.Group();
  pivot.name = 'pinion';
  const pinion = spurGear(K197.N, K197.m, { width: K197.pinionW, spokes: 4, driver: true });
  // 이 윤곽을 핀 랙용(핀이 훑는 영역을 깎은 모양)으로 교체 — 핀이 이 사이 골에 꼭 맞게
  const body0 = pinion.children[0] as THREE.Mesh;
  body0.geometry.dispose();
  body0.geometry = pinionBody197();
  pivot.add(pinion);
  const capGeo = lathe(rodProfile(0.06, 0, 0.032, 0.006, 0.008), 28);
  capGeo.rotateX(Math.PI / 2);
  const cap = mesh(capGeo, darkSteel());
  cap.position.z = K197.pinionW / 2 + 0.002;
  pivot.add(cap);
  const mark = mesh(new THREE.BoxGeometry(0.1, 0.018, 0.008), paint(0xf2b619));
  mark.position.set(0.05, 0, K197.pinionW / 2 + 0.036);
  pivot.add(mark);
  g.add(pivot);

  const arrow = rotArrow(0.44, true);
  arrow.position.z = 0.225;
  car.add(arrow);

  const tagPin = leaderTo(tag('피니언(구동)', v(-1.35, 2.7, 0.35)), 'pinion');
  const tagRack = leaderTo(tag('맹글 랙(핀 판)', v(0, 0.78, 0.35)), 'rack');
  g.add(
    tagPin,
    tagRack,
    leaderTo(tag('축 안내(고정)', v(-1.3, 0.78, 0.35)), 'guide'),
    leaderTo(tag('끝 안내(고정)', v(1.75, 2.7, 0.35)), 'endArcR')
  );

  let cur = loop197(U0);
  let rackX = 0;
  const apply = (): void => {
    const u = U0 + RP197 * theta;
    cur = loop197(u);
    rackX = -cur.cx;
    rack.position.set(rackX, K197.YC, 0);
    const py = K197.YC + cur.cy;
    pivot.position.set(0, py, K197.zPinion);
    pivot.rotation.z = cur.psi;
    car.position.set(0, py, 0);
    tagRack.position.set(rackX * 0.5, 0.78, 0.35);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '랙 위치', value: `${rackX.toFixed(2)} (행정 ±${(LH197 + RP197).toFixed(2)})` },
      { label: '피니언 축 높이', value: `${cur.cy >= 0 ? '위 줄' : '아래 줄'} ${Math.abs(cur.cy).toFixed(2)}` },
      { label: '한 주기', value: `피니언 ${(LOOP197 / RP197 / (2 * Math.PI)).toFixed(1)} 회전에 랙이 한 번 왕복` },
      { label: '원리', value: '피니언은 늘 한 방향으로 도는데 축이 랙 끝을 돌아 반대편 줄로 넘어가 랙이 되돌아온다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.75, 6.4], target: [0, 1.7, 0] }
  };
}
