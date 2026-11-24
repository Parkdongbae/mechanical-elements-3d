// 091 삼각 편심 — 뢸로 삼각형 캠의 꼭짓점에 축이 꿰여 있고, 네모 틀이 위·아래 닳음 띠로 캠을 물고 왕복하다 멈춘다 (판화 91번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { camFrame, rodGuide, triangularCam, triCamLift } from '../kit/k089';

const ZP = 0.1; // 기구 평면 z
const OY = 1.75; // 축 중심 y
const W = 0.5; // 뢸로 폭(행정)
const RHO = 0.09; // 모서리 둥글림
const PHASE0 = 1.6; // θe = theta − PHASE0 (t = 1 에서 θe = 0 — 판화 자세)
const D2R = Math.PI / 180;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM091(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());
  g.add(shaftZ(0, OY, 0.3, 0.05));

  const cam = triangularCam(W, RHO);
  cam.name = 'cam';
  cam.position.set(0, OY, ZP);
  // 키트의 위상 표시 점(캠 가운데 검은 점)은 판화에 없고 '가운데 축'으로 오해되므로 숨긴다(검증 후 수정)
  const marker = cam.children[2];
  if (marker) marker.visible = false;

  const frame = camFrame(0.61, W + 2 * RHO + 0.004);
  frame.name = 'frame';
  frame.position.set(0, OY, ZP);

  const guideT = rodGuide('y', 0.05, ZP);
  guideT.name = 'guideT';
  guideT.position.set(0, 2.66, ZP);
  const guideB = rodGuide('y', 0.05, ZP);
  guideB.name = 'guideB';
  guideB.position.set(0, 0.84, ZP);
  g.add(cam, frame, guideT, guideB);

  const arrow = rotArrow(0.22, true);
  arrow.position.set(0, OY, 0.34);
  g.add(arrow);

  g.add(
    tag('삼각 편심(축이 꼭짓점에 꿰임)', v(-1.35, 2.35, 0.3)),
    tag('틀(위아래로 왕복하다 멈춤)', v(1.4, 2.2, 0.3)),
    tag('닳음 띠(캠이 닿는 곧은 면)', v(1.45, 1.5, 0.3)),
    tag('고정 안내', v(0.75, 2.9, 0.3))
  );

  let thE = 0;
  let disp = 0;
  const apply = (): void => {
    thE = theta - PHASE0;
    cam.rotation.z = thE;
    disp = triCamLift(W, thE) - W / 2;
    frame.position.y = OY + disp;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 2.0, 6.4], target: [0, 1.75, 0.1] },
    notes: () => {
      const f = ((((thE / D2R) % 360) + 360) % 360);
      let state = '올라감';
      if (f >= 330 || f < 30) state = '위에서 멈춤';
      else if (f < 150) state = '내려감';
      else if (f < 210) state = '아래에서 멈춤';
      return [
        { label: '지금 상태', value: state },
        { label: '멈춤', value: '한 바퀴 가운데 1/3 은 멈춤(60° 씩 두 번)' },
        { label: '틀 위치', value: `${disp >= 0 ? '+' : ''}${disp.toFixed(3)} (±0.25), 행정 ${W}` },
        { label: '구동', value: `축 ${(OMEGA / (2 * Math.PI)).toFixed(2)} 회전/초` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
