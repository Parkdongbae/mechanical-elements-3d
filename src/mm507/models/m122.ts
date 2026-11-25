// 122 두 기어로 만드는 가변 왕복 — 크랭크 핀 달린 두 평기어(30:25) → 연결봉 둘 → 뜬 지레 → 수평 막대 (판화 122번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import { wallBearing } from '../kit/gear6';
import { connectingRod } from '../kit/k092';
import {
  crankGear, eyeBar, floatLever, gearAngles122, K122, K122_BAR_Y, K122_O1, K122_PIN1_LOCAL, K122_PIN2_LOCAL, linkage122, studZ
} from '../kit/k122';

const DEG = Math.PI / 180;
const ZR = 0.14; // 연결봉 층
const ZL = 0.21; // 지레 층
const ZB = 0.28; // 막대 층
const BY = K122_BAR_Y;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM122(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  const gear1 = crankGear(K122.z1, K122.m, K122.r1, K122_PIN1_LOCAL, { pinName: 'pin1', driver: true });
  gear1.name = 'gear1';
  gear1.children[gear1.children.length - 3]!.name = 'crankPin122';
  gear1.position.set(K122_O1[0], K122_O1[1], 0);
  g.add(gear1);

  const gear2 = crankGear(K122.z2, K122.m, K122.r2, K122_PIN2_LOCAL, { pinName: 'pin2' });
  gear2.name = 'gear2';
  gear2.position.set(K122.O2[0], K122.O2[1], 0);
  g.add(gear2);

  // 기어 축(고정) — 뒤판에서 나온 얇은 덮개 축
  g.add(studZ(K122_O1[0], K122_O1[1], 0.105, 0.1, 0.135));
  g.add(studZ(K122.O2[0], K122.O2[1], 0.0875, 0.1, 0.118));

  const rod1 = connectingRod(K122.L1);
  rod1.name = 'rod1';
  g.add(rod1);
  const rod2 = connectingRod(K122.L2);
  rod2.name = 'rod2';
  g.add(rod2);

  const lever = floatLever(K122.lever);
  lever.name = 'lever';
  g.add(lever);

  const bar = eyeBar(1.32);
  bar.name = 'bar';
  g.add(bar);

  // 막대 안내 고리(고정, 구멍이 X 방향)
  g.add(wallBearing(1.08, BY, 0.28, 'x', 0.05));

  // 회전 화살표
  const arrow1 = rotArrow(0.56, true);
  arrow1.position.set(K122_O1[0], K122_O1[1], 0.075);
  const arrow2 = rotArrow(0.47, false);
  arrow2.position.set(K122.O2[0], K122.O2[1], 0.075);
  g.add(arrow1, arrow2);

  // 이름표 — 크랭크 핀·뜬 지레는 따라간다
  const pinTag = leaderTo(tag('크랭크 핀', v(0, 0, 0.35)), 'crankPin122');
  const leverTag = tag('뜬 지레', v(0, 0, 0.4));
  g.add(
    tag('큰 기어 30T', v(-1.7, 3.15, 0.3)),
    tag('작은 기어 25T', v(0.45, 0.5, 0.3)),
    tag('수평 막대', v(1.6, 2.72, 0.4)),
    pinTag,
    leverTag
  );

  const apply = (): void => {
    const { g1, g2 } = gearAngles122(theta);
    gear1.rotation.z = g1;
    gear2.rotation.z = g2;
    const L = linkage122(theta);
    rod1.position.set(L.p1[0], L.p1[1], ZR);
    rod1.rotation.z = L.rod1;
    rod2.position.set(L.p2[0], L.p2[1], ZR);
    rod2.rotation.z = L.rod2;
    lever.position.set(L.x, BY, ZL);
    lever.rotation.z = L.phi;
    bar.position.set(L.x, BY, ZB);
    // 핀에서 기어 바깥쪽(반지름 방향)으로 띄운다 — 핀이 축 아래로 가도 축·연결봉을 가리지 않게
    pinTag.position.set(K122_O1[0] + 0.62 * Math.cos(L.a1), K122_O1[1] + 0.62 * Math.sin(L.a1), 0.35);
    leverTag.position.set(L.x + 0.5, BY - 0.45, 0.4);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.1, 1.75, 6.4], target: [0.1, 1.7, 0] },
    notes: () => {
      const L = linkage122(theta);
      let d = (L.a1 - L.a2) / DEG;
      d = ((d % 360) + 360) % 360;
      return [
        { label: '잇수', value: '30 : 25 → 큰 기어 5바퀴에 한 주기' },
        { label: '막대 위치', value: `눈 x = ${L.x.toFixed(2)} (범위 −0.12 ~ 0.68)` },
        { label: '지레 기울기', value: `${Math.round(L.phi / DEG - 90)}°` },
        { label: '두 핀의 위상차', value: `${Math.round(d)}° (0° 근처면 폭이 크고 180° 근처면 거의 선다)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
