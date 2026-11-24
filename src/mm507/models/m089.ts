// 089 증기 기관 밸브용 편심 — 편심 원판 + 띠 + 막대 = 슬라이더 크랭크 (판화 89번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { eccentricSheave, eccentricStrap, valveRod, rodGuide } from '../kit/k089';

const OX = -1.15;
const OY = 1.75;
const ZP = 0.1;
const E = 0.27;
const L = 2.0;
const PHASE = 1.6; // t=1 에서 θe = 0 (판화 자세)
const TAU = Math.PI * 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM089(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());
  g.add(shaftZ(OX, OY, 0.3, 0.1));

  const sheave = eccentricSheave(0.5, E, { bore: 0.1, hubR: 0.19 });
  sheave.name = 'sheave';
  sheave.position.set(OX, OY, ZP);
  const strap = eccentricStrap(0.502, L);
  strap.name = 'strap';
  const rod = valveRod(0.95);
  rod.name = 'valveRod';
  const guide = rodGuide('x', { w: 0.09, h: 0.09 }, ZP);
  guide.name = 'guide';
  guide.position.set(1.42, OY, ZP);
  g.add(sheave, strap, rod, guide);

  const arr = rotArrow(0.3, true);
  arr.position.set(OX, OY, 0.34);
  g.add(arr);

  const tRod = tag('편심 막대', v(0.35, 2.15, 0.3));
  const tVal = tag('밸브 막대(곧게 왕복)', v(1.5, 1.35, 0.3));
  g.add(
    tag('편심 원판(축에서 중심이 어긋남)', v(-1.15, 2.95, 0.3)),
    tag('띠(스트랩)', v(-0.35, 0.75, 0.3)),
    tRod,
    tVal
  );

  let px = 0;
  let tilt = 0;
  const apply = (): void => {
    const a = theta - PHASE; // 누적 theta 에서 절대 자세 (t=1 에서 0)
    const s = E * Math.sin(a);
    const cx = OX + E * Math.cos(a);
    const cy = OY + s;
    px = cx + Math.sqrt(L * L - s * s);
    tilt = -Math.asin(s / L);
    sheave.rotation.z = a;
    strap.position.set(cx, cy, ZP);
    strap.rotation.z = tilt;
    rod.position.set(px, OY, ZP);
    tRod.position.set(cx + 1.23, cy + 0.4, 0.3); // 움직이는 막대를 따라감
    tVal.position.set(px + 0.38, OY - 0.4, 0.3);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.9, 6.4], target: [0, 1.75, 0.1] },
    notes: () => [
      { label: '행정', value: '편심량의 2배(0.54)' },
      { label: '밸브 막대 위치', value: `가운데에서 ${(px - 0.85 >= 0 ? '+' : '') + (px - 0.85).toFixed(2)}` },
      { label: '막대 기운 각', value: `${((tilt * 180) / Math.PI).toFixed(1)}° (최대 ±7.8°)` },
      { label: '구동 회전수', value: `${(theta / TAU).toFixed(2)} 바퀴` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
