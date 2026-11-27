// 223 부채꼴 기어 배열 — 위 축에 부채꼴 넷, 아래 축에 부채꼴 넷이 서로 다른 층에서 짝지어 물려, 위가 일정해도 아래는 0.25~2 배로 변한다
// 설계표 docs/mm507-sheets/223.md · 부품·식은 kit/k223
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K223, PAIR_NAMES223, pairOf223, sector223, thetaL223 } from '../kit/k223';
import { mesh } from '../../models/parts/geom';
import { darkSteel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K223;
const DEG = 180 / Math.PI;

export default function buildM223(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [ux, uy] = K.U;
  const [lx, ly] = K.L;

  g.add(shaftZ(ux, uy, 0.27, 0.04), shaftZ(lx, ly, 0.27, 0.04));

  const mkGroup = (name: string, x: number, y: number): THREE.Group => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(x, y, 0);
    const hubGeo = new THREE.CylinderGeometry(K.TUBE_R, K.TUBE_R, 0.25, 48);
    hubGeo.rotateX(Math.PI / 2);
    const hub = mesh(hubGeo, darkSteel());
    hub.position.z = 0.11; // −0.015 ~ 0.235
    hub.name = name + 'Hub';
    grp.add(hub);
    return grp;
  };
  const upper = mkGroup('upper', ux, uy);
  const lower = mkGroup('lower', lx, ly);
  for (const s of K.SECTORS) {
    const sec = sector223(s.teeth, K.M, s.n, s.a0, s.trims, { width: K.WIDTH, color: s.color, driver: s.grp === 'lower' });
    sec.name = s.name;
    sec.position.z = s.z;
    (s.grp === 'upper' ? upper : lower).add(sec);
  }
  g.add(upper, lower);

  const arrU = rotArrow(0.3, true);
  arrU.position.set(ux, uy, 0.32);
  const arrL = rotArrow(0.3, false);
  arrL.position.set(lx, ly, 0.32);
  g.add(arrU, arrL);

  g.add(
    leaderTo(tag('위 축(구동)', v(1.75, 2.95, 0.5)), 'upper'),
    leaderTo(tag('큰 부채꼴', v(-1.6, 3.0, 0.5)), 'secU1'),
    leaderTo(tag('작은 부채꼴', v(1.75, 1.95, 0.5)), 'secU4'),
    leaderTo(tag('아래 축(출력)', v(-1.75, 0.5, 0.5)), 'lower'),
    leaderTo(tag('층마다 한 쌍', v(1.75, 0.55, 0.5)), 'secL1')
  );

  let t = 0;
  let thU = 0;
  const place = (): void => {
    thU = K.OMEGA * t * DEG;
    upper.rotation.z = thU / DEG;
    lower.rotation.z = thetaL223(thU) / DEG;
  };
  place();

  return {
    group: g,
    view: { pos: [0.9, 2.1, 6.6], target: [0, 1.75, 0.1] },
    notes: () => {
      const p = pairOf223(thU);
      const k = -(thetaL223(thU + 0.1) - thetaL223(thU - 0.1)) / 0.2;
      const cur = PAIR_NAMES223[p] ?? '';
      return [
        { label: '위 축 각', value: (((thU % 360) + 360) % 360).toFixed(0) + '°' },
        { label: '지금 물린 짝', value: cur },
        { label: '아래 / 위 빠르기', value: k.toFixed(3) + '배 (0.25 · 0.875 · 2.0 · 0.875)' },
        { label: '원리', value: '짝마다 반지름 합은 같고 비가 달라, 위가 일정해도 아래는 0.25 ~ 2 배로 바뀐다' }
      ];
    },
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
