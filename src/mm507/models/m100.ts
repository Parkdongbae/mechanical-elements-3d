// 100 급속 귀환 크랭크(홈 지레) — 크랭크 핀이 지레의 긴 홈 안을 미끄러져 지레가 갈 때는 천천히, 올 때는 빨리 돌아온다 (판화 100번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { crankArmPin, QUICK100, slottedLever, slottedLeverAngle } from '../kit/k098';
import { mesh } from '../../models/parts/geom';
import { ghost } from '../../models/materials';

const OX = -0.55;
const OY = 1.5;
const PX = 0.55;
const PY = 1.63;
const PHASE = 0.4;
const D2R = Math.PI / 180;
const GO_FROM = 65.2;
const GO_TO = 308.3;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM100(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 크랭크 축 · 받침축
  g.add(shaftZ(OX, OY, -0.01, 0.06), shaftZ(PX, PY, 0.24, 0.05));

  // 핀이 도는 길(점선 원 대신 가는 고리)
  const ringGeo = new THREE.TorusGeometry(QUICK100.c, 0.006, 8, 96);
  const ring = mesh(ringGeo, ghost());
  ring.name = 'pinPath';
  ring.position.set(OX, OY, -0.02);
  g.add(ring);

  const crank = crankArmPin();
  crank.name = 'crank';
  crank.position.set(OX, OY, 0.03);
  g.add(crank);

  const lever = slottedLever();
  lever.name = 'lever';
  lever.position.set(PX, PY, 0.15);
  g.add(lever);

  const arr = rotArrow(0.3, true);
  arr.position.set(OX, OY, 0.24);
  g.add(arr);

  g.add(
    tag('크랭크(구동)', v(-1.55, 1.25, 0.3)),
    tag('크랭크 핀', v(-1.55, 2.7, 0.3)),
    tag('홈 지레', v(0.0, 2.7, 0.3)),
    tag('받침축', v(1.2, 2.45, 0.3))
  );

  let leverDeg = 0;
  const apply = (): void => {
    const te = theta + PHASE;
    crank.rotation.z = te;
    const a = slottedLeverAngle(te);
    lever.rotation.z = a;
    leverDeg = a / D2R;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 1.9, 6.4], target: [0, 1.6, 0.1] },
    notes: () => {
      const f = ((((theta + PHASE) / D2R) % 360) + 360) % 360;
      const going = f >= GO_FROM && f <= GO_TO;
      return [
        { label: '시간 비', value: '갈 때 243°, 올 때 117° — 시간 비 2.08 : 1' },
        { label: '지금 상태', value: going ? '천천히 가는 중' : '빨리 돌아오는 중' },
        { label: '지금 지레 각도', value: `${leverDeg.toFixed(1)}°` },
        { label: '구동 회전수', value: (theta / (2 * Math.PI)).toFixed(2) }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
