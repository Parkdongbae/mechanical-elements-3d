// 031 웜과 웜기어 — 가로축 웜이 세로 평면의 웜 휠(30개)을 위에서 물어 돌린다 (판화 31번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rod, rotArrow, shaftZ, tag, wormScrew, wormWheel, STAGE } from '../kit';
import { castIron } from '../../models/materials';
import { extrude, mesh, roundedRect } from '../../models/parts/geom';

const MOD = 0.05; // 모듈 (축방향 피치 p = π·0.05)
const NW = 30; // 웜 휠 잇수 — 피치 반지름 0.75
const RP_W = (NW * MOD) / 2;
const CW = [0, 1.35] as const; // 웜 휠 중심
const Z = 0.12; // 웜 휠 중심 높이 = 웜 축 높이
const RWP = 0.12; // 웜 피치 반지름
const YA = CW[1] + RP_W + RWP; // 웜 축 높이 2.22
const OMEGA_W = OMEGA * 3; // 웜 각속도(바퀴가 너무 느려 보이지 않게 3배)
const S = (Math.PI * 2) / NW;
const TAN_LEAD = (Math.PI * MOD) / (2 * Math.PI * RWP); // 웜 리드각의 탄젠트(약 11.8°)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 뒤판에 붙은 축받이 블록: 웜 축이 가운데를 지난다 */
function bearingBlock(x: number): THREE.Mesh {
  const depth = Z + 0.09 - STAGE.backZ;
  const geo = extrude(roundedRect(-0.09, -0.11, 0.09, 0.11, 0.025), depth, 0.01);
  const m = mesh(geo, castIron());
  m.position.set(x, YA, STAGE.backZ + depth / 2);
  return m;
}

export default function buildM031(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 웜 각

  g.add(displayStand());

  // 웜 휠: 스포크 6, 중심 (0, 1.35), 시계 회전. 이는 웜 리드각만큼 비스듬하다(곧은 이는 폭 양끝에서 나사산을 파고든다)
  const wheel = wormWheel(NW, MOD, { width: 0.14, spokes: 6, tanLead: TAN_LEAD });
  wheel.position.set(CW[0], CW[1], Z);
  g.add(wheel, shaftZ(CW[0], CW[1], 0.34, 0.07));

  // 웜: 한 줄 왼나사(판화처럼 정면에서 산이 "/" 로 기운다), 길이 0.62(판화: 3바퀴 남짓), 가로 축(X)
  const worm = wormScrew(RWP - 1.25 * MOD, RWP + MOD, Math.PI * MOD, 0.62, { driver: true, leftHand: true });
  worm.position.set(0, YA, Z);
  g.add(worm);
  g.add(rod(v(-1.18, YA, Z), v(1.18, YA, Z), 0.045), bearingBlock(-0.95), bearingBlock(0.95));

  // 회전 방향 화살표: 웜은 오른쪽(+X 쪽)에서 볼 때 반시계, 왼나사라 휠 꼭대기가 +X 로 밀려 휠은 시계
  const aw = rotArrow(0.55, false);
  aw.position.set(CW[0], CW[1], Z + 0.2);
  const ao = rotArrow(0.2, true);
  ao.rotation.y = Math.PI / 2;
  ao.position.set(0.6, YA, Z);
  g.add(aw, ao);
  g.add(leaderTo(tag('웜(구동)', v(-0.95, YA + 0.4, 0.3)), worm), tag('웜 휠 30', v(1.25, 1.35, 0.3)));

  return {
    group: g,
    notes: () => [
      { label: '잇수', value: '웜 1줄 : 웜 휠 30' },
      { label: '속도비', value: '웜 30바퀴에 휠 1바퀴(1 : 30)' },
      { label: '축 방향', value: '두 축이 직각' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA_W * speed * dt;
      worm.rotation.x = theta;
      // 웜 한 바퀴에 휠은 이 한 개. 왼나사: 웜 아래쪽(−Y) 단면의 산 중심 x = −p/2 + pθ/2π (mod p) → 휠 꼭대기는 +X(시계).
      // 위상 π/2 − S/2: θ=0 에서 꼭대기(x=0)에 이 중심 — 양옆 ±p/2 의 산 사이 골에 들어간다
      wheel.rotation.z = -theta / NW + Math.PI / 2 - S / 2;
    }
  };
}
