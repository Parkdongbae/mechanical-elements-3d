// 174 목수의 작업대 죔쇠 — 막대를 두 굽은 턱 사이로 밀어 넣으면 막대 끝이 엇갈린 꼬리를 밀어 턱이 나사를 축으로 돌고,
// 안쪽으로 말린 갈고리가 막대(나무 판)를 위아래에서 문다 (판화 174번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { BETA_CLOSED174, K174, benchSlab174, clamp174, clampBar174, jaw174, screw174 } from '../kit/k174';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const YU = K174.CY + K174.PD;
const YL = K174.CY - K174.PD;

export default function buildM174(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 받침 판(작업대) — 막대가 앞면에서 미끄러진다
  g.add(benchSlab174(-1.3, 2.15));

  // 턱(위: 뒤 층, 아래: 앞 층 — 꼬리가 앞뒤로 엇갈려 X 로 교차). 아래 턱은 위 턱을 위아래로 뒤집은 모양
  const jawU = jaw174(1);
  jawU.name = 'jawU';
  jawU.position.set(K174.PX, YU, K174.zUp + K174.thick / 2);
  const jawL = jaw174(-1);
  jawL.name = 'jawL';
  jawL.position.set(K174.PX, YL, K174.zLo + K174.thick / 2);
  g.add(jawU, jawL);

  // 턱 축 나사 2개(고정, 일자 홈 둥근 머리) — 각 턱의 앞면에 머리
  const screwU = screw174(K174.PX, YU, K174.zUp + K174.thick, 0.42);
  screwU.name = 'screwU';
  const screwL = screw174(K174.PX, YL, K174.zLo + K174.thick, 0.3);
  screwL.name = 'screwL';
  g.add(screwU, screwL);

  // 죔쇠 막대
  const bar = clampBar174();
  bar.name = 'bar';
  g.add(bar);

  const barTag = leaderTo(tag('죔쇠 막대', v(1.7, 2.15, 0.35)), 'bar');
  g.add(
    leaderTo(tag('위 턱', v(0.55, 2.85, 0.35)), 'jawU'),
    leaderTo(tag('아래 턱', v(0.55, 0.6, 0.35)), 'jawL'),
    leaderTo(tag('턱 축 나사(고정)', v(-1.2, 2.85, 0.35)), 'screwU'),
    barTag
  );

  let cur = clamp174(0);
  const apply = (): void => {
    cur = clamp174(theta);
    jawU.rotation.z = -cur.beta;
    jawL.rotation.z = cur.beta;
    bar.position.set(cur.xTip, K174.CY, (K174.zBar0 + K174.zBar1) / 2);
    barTag.position.set(Math.min(1.7, cur.xTip + 1.5), 2.15, 0.35);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '막대 끝 위치', value: `${cur.xTip.toFixed(2)}` },
      { label: '턱 닫힘', value: `${Math.round(cur.closed * 100)} %` },
      { label: '턱 벌어짐', value: `${(((BETA_CLOSED174 - cur.beta) * 180) / Math.PI).toFixed(1)}° (최대 ${((K174.open * 180) / Math.PI).toFixed(1)}°)` },
      { label: '원리', value: '막대 끝이 엇갈린 꼬리를 밀면 턱이 나사를 축으로 돌아 갈고리가 막대를 문다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0, 1.7, 6.4], target: [0, 1.6, 0] }
  };
}
