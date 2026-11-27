// 207 웜 두 개로 구동 — 한 축의 반대 나사 웜 둘이 나란히 놴 웜 휠 두 개를 같은 빠르기로 거울처럼 반대로 돌린다 (판화 207번)
// 설계표 docs/mm507-sheets/207.md — 195 의 위 휠을 거울(x → −x)로 옮긴 위상
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rod, rotArrow, shaftZ, tag, wormScrew, wormWheel } from '../kit';
import { wallBearing } from '../kit/gear6';
import { paint } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const MOD = 0.044; // 모듈
const NW = 28; // 웜 휠 잇수 — 피치 반지름 0.616
const RW = (NW * MOD) / 2;
const RWP = 0.15; // 웜 피치 반지름
const LEAD = Math.PI * MOD; // 웜 리드 0.1382
const TAN_LEAD = LEAD / (2 * Math.PI * RWP); // 리드각 탄젠트 0.1467
const YS = 1.4; // 웜 축 높이
const ZW = 0.1; // 축·휠 가운데 z
const XW = 0.95; // 휠·웜 x
const YC = YS + RWP + RW; // 2.166 휠 중심 높이
const OMEGA_W = OMEGA * 3; // 4.8 rad/s (195 와 같음)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 휠 앞면 노란 표지 막대(로컬 −X 쪽 반지름 0.12~0.45, 폭 0.04, z 0.172 세계) — t=0 에 위를 가리킴 */
function markerBar(): THREE.Mesh {
  const b = mesh(new THREE.BoxGeometry(0.33, 0.04, 0.012), paint(0xf2b619));
  b.position.set(-0.285, 0, 0.072); // 휠 앞면(0.07) 바로 앞에 붙임
  return b;
}

export default function buildM207(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 웜 둘(왼쪽 오른나사 "\", 오른쪽 왼나사 "/") — 축 위 같은 θ
  const wormL = wormScrew(RWP - 1.25 * MOD, RWP + MOD, LEAD, 0.55, { driver: true });
  wormL.name = 'wormL';
  wormL.position.set(-XW, YS, ZW);
  const wormR = wormScrew(RWP - 1.25 * MOD, RWP + MOD, LEAD, 0.55, { driver: true, leftHand: true });
  wormR.name = 'wormR';
  wormR.position.set(XW, YS, ZW);

  // 웜 축(길이 3.5) + 축 표면 노란 줄(길이 3.3, 폭 0.012) — 회전이 보이게
  const shaft = new THREE.Group();
  shaft.name = 'shaft';
  shaft.position.set(0, YS, ZW);
  shaft.add(rod(v(-1.75, 0, 0), v(1.75, 0, 0), 0.06));
  const line = mesh(new THREE.BoxGeometry(3.3, 0.012, 0.012), paint(0xf2b619));
  line.position.y = 0.06;
  shaft.add(line);
  g.add(wormL, wormR, shaft);

  // 웜 휠 둘(같은 크기, 나란히) — 왼쪽 시계, 오른쪽 반시계(거울 위상)
  const wheelL = wormWheel(NW, MOD, { width: 0.14, spokes: 6, tanLead: TAN_LEAD });
  wheelL.name = 'wheelL';
  wheelL.position.set(-XW, YC, ZW);
  wheelL.add(markerBar());
  const wheelR = wormWheel(NW, MOD, { width: 0.14, spokes: 6, tanLead: -TAN_LEAD });
  wheelR.name = 'wheelR';
  wheelR.position.set(XW, YC, ZW);
  wheelR.add(markerBar());
  // 휠 축(고정, 휠이 헐겁게 — 회전 없음)
  g.add(wheelL, wheelR, shaftZ(-XW, YC, 0.25, 0.045), shaftZ(XW, YC, 0.25, 0.045));

  // 웜 축 받침 셋(양 끝·가운데 — 가운데는 두 웜 안쪽 끝 사이)
  const bearingL = wallBearing(-1.55, YS, ZW, 'x', 0.066);
  bearingL.name = 'bearingL';
  const bearingM = wallBearing(0, YS, ZW, 'x', 0.066);
  bearingM.name = 'bearingM';
  const bearingR = wallBearing(1.55, YS, ZW, 'x', 0.066);
  bearingR.name = 'bearingR';
  g.add(bearingL, bearingM, bearingR);

  // 회전 화살표: 왼쪽 휠 시계, 오른쪽 휠 반시계, 축 오른쪽 끝(195 와 같은 꼴)
  const aL = rotArrow(0.3, false);
  aL.position.set(-XW, YC, 0.25);
  const aR = rotArrow(0.3, true);
  aR.position.set(XW, YC, 0.25);
  const aS = rotArrow(0.16, true);
  aS.rotation.y = Math.PI / 2;
  aS.position.set(1.75, YS, ZW);
  g.add(aL, aR, aS);

  // 이름표 6개 (이름표 표대로)
  g.add(
    leaderTo(tag('오른나사 웜', v(-1.45, 0.85, 0.45)), 'wormL'),
    leaderTo(tag('왼나사 웜', v(1.45, 0.85, 0.45)), 'wormR'),
    leaderTo(tag('왼쪽 웜 휠(시계)', v(-1.55, 3.05, 0.45)), 'wheelL'),
    leaderTo(tag('오른쪽 웜 휠(반시계)', v(1.55, 3.05, 0.45)), 'wheelR'),
    leaderTo(tag('구동 축(웜 둘)', v(-0.42, 0.75, 0.45)), 'shaft'), // 가운데 축받이와 왼쪽 웜 사이의 드러난 축을 가리키게(2026-11-27 사용자 지적)
    leaderTo(tag('가운데 축받이', v(0, 2.75, 0.45)), 'bearingM')
  );

  return {
    group: g,
    view: { pos: [0, 1.9, 6.2], target: [0, 1.85, 0] },
    notes: () => [
      { label: '잇수', value: `웜 1줄 : 웜 휠 ${NW}(둘 다)` },
      { label: '속도비', value: `축 ${NW}바퀴에 두 휠 각 1바퀴` },
      { label: '방향', value: '왼쪽 휠 시계, 오른쪽 휠 반시계 — 안쪽 가장자리가 함께 아래로' },
      { label: '나사', value: '왼쪽 오른나사 · 오른쪽 왼나사' },
      { label: '지금 축 바퀴 수', value: `${(theta / (Math.PI * 2)).toFixed(2)}` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA_W * speed * dt;
      wormL.rotation.x = theta;
      wormR.rotation.x = theta;
      shaft.rotation.x = theta;
      wheelL.rotation.z = -theta / NW - Math.PI / 2; // 시계
      wheelR.rotation.z = theta / NW - Math.PI / 2; // 반시계
    }
  };
}
