// 202 웜과 웜휠 — 장구형(힌들리) 웜이 휠 아래 둘레를 감싸 이 약 10개를 동시에 물고 돌린다 (판화 202)
// 설계표 docs/mm507-sheets/202.md — 웜 몸이 휠 피치원을 따라 휜 것이 31번(원통 웜)과의 차이
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { STAGE, displayStand, leaderTo, rod, rotArrow, shaftZ, tag, wormWheel } from '../kit';
import { K202, globoidWorm } from '../kit/k202';
import { castIron, paint } from '../../models/materials';
import { circlePath, extrude, mesh, roundedRect } from '../../models/parts/geom';

const Z202 = 50; // 휠 잇수
const M202 = 0.036; // 모듈
const P202 = Math.PI * M202; // 축방향 피치
const RP = (Z202 * M202) / 2; // 휠 피치 반지름 0.9
const CC = RP + K202.rw; // 축 간 거리 1.07
const WHEEL_Y = 1.95; // 휠 중심 높이
const YA = WHEEL_Y - CC; // 웜 축 높이 0.88
const Z0 = 0.13; // 두 부품의 z 가운데
const TAN_LEAD = P202 / (2 * Math.PI * K202.rw); // 리드각 탄젠트 0.105882(휠 쪽은 부호를 뒤집어 준다)
const OMEGA_W = OMEGA * 3; // 웜 각속도 4.8 rad/s(31번과 같음)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 뒤판에 붙은 축받이 블록(31번과 같은 모양) — 구멍은 웜 축(X) 방향으로 뚫는다(설계표 연결 표: 축 0.05 / 구멍 0.055) */
function bearingBlock(x: number): THREE.Mesh {
  const depth = Z0 + 0.09 - STAGE.backZ; // 0.52
  const shape = roundedRect(-0.22, -0.11, 0.30, 0.11, 0.025);
  shape.holes.push(circlePath(-0.17, 0, 0.055)); // 모양 x = −(세계 z): 구멍이 세계 z 0.13(축선)에 온다
  const geo = extrude(shape, 0.18, 0.01);
  geo.rotateY(Math.PI / 2); // 압출축 Z → X(구멍도 X 방향 채널), 모양 x → −z
  const m = mesh(geo, castIron());
  m.position.set(x, YA, STAGE.backZ + depth / 2);
  return m;
}

export default function buildM202(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 웜 각(누적)

  g.add(displayStand());

  // 웜휠 50이 — 웜이 휠 아래에서 무는 오른나사라 이 비스듬함이 31번과 반대(tanLead 음수)
  const wheel = wormWheel(Z202, M202, { width: 0.10, spokes: 6, tanLead: -TAN_LEAD });
  wheel.position.set(0, WHEEL_Y, Z0);
  wheel.name = 'wheel';
  const wheelAxle = shaftZ(0, WHEEL_Y, 0.30, 0.12); // 반지름 0.12 로 허브 구멍(0.126)을 채운 뒤판 축
  wheelAxle.name = 'wheelAxle';
  g.add(wheel, wheelAxle);

  // 장구형 웜(구동) — 웜 축·끝 표지는 그룹의 자식으로 같이 돈다
  const worm = globoidWorm(K202);
  worm.position.set(0, YA, Z0);
  worm.name = 'worm';
  // 웜 몸통(나사산)만 따로 묶음 — 이름표 지시선이 웜 축 끝이 아니라 몸통을 가리키게(2026-11-27 사용자 지적)
  const wormBody = new THREE.Group();
  wormBody.name = 'wormBody';
  wormBody.add(...worm.children);
  worm.add(wormBody);
  const wormShaft = rod(v(-1.30, 0, 0), v(1.30, 0, 0), 0.05); // 그룹 로컬 좌표
  wormShaft.name = 'wormShaft';
  const wormMark = mesh(new THREE.BoxGeometry(0.012, 0.16, 0.012), paint(0xffcc00));
  wormMark.position.set(0.606, 0.20, 0); // 오른쪽 끝면 바로 밖 — 웜이 돌 때 노란 막대가 원을 그린다
  wormMark.name = 'wormMark';
  worm.add(wormShaft, wormMark);
  g.add(worm);

  // 축받이 블록 2개(고정)
  const bearingL = bearingBlock(-0.95);
  bearingL.name = 'bearingL';
  const bearingR = bearingBlock(0.95);
  bearingR.name = 'bearingR';
  g.add(bearingL, bearingR);

  // 회전 방향 화살표: 휠 시계, 웜은 오른쪽(+X)에서 볼 때 반시계
  const aw = rotArrow(0.55, false);
  aw.position.set(0, WHEEL_Y, 0.30);
  const ao = rotArrow(0.22, true);
  ao.rotation.y = Math.PI / 2;
  ao.position.set(0.80, YA, Z0);
  g.add(aw, ao);

  // 이름표(이름표 표 그대로)
  g.add(
    leaderTo(tag('장구형 웜(구동, 1줄)', v(-1.25, 0.42, 0.35)), 'wormBody'),
    leaderTo(tag('웜휠 50이', v(1.30, 2.75, 0.30)), 'wheel'),
    leaderTo(tag('축받이(고정)', v(1.55, 0.42, 0.30)), 'bearingR'),
    leaderTo(tag('물린 이 약 10개', v(-1.40, 1.35, 0.35)), 'wormBody')
  );

  return {
    group: g,
    view: { pos: [1.9, 1.6, 4.9], target: [0, 1.45, Z0] },
    notes: () => [
      { label: '잇수', value: '웜 1줄 : 웜휠 50' },
      { label: '속도비', value: '웜 50바퀴에 휠 1바퀴 (1 : 50)' },
      { label: '동시에 물린 이', value: '약 10개 (원통 웜 31번은 2~3개)' },
      { label: '휠 각', value: ((((theta / Z202) * 180) / Math.PI) % 360).toFixed(1) + '°' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA_W * speed * dt;
      worm.rotation.x = theta; // 오른쪽에서 반시계 = 꼭대기가 앞쪽(+z)으로 감
      wheel.rotation.z = -Math.PI / 2 - theta / Z202; // 시계. theta=0 에 휠 맨 아래 이골 가운데가 웜 산을 받는다
    }
  };
}
