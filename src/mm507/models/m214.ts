// 214 멈추개 변형 1 — 이 12 : 10 두 기어 앞면에 손가락이 하나씩 붙어, 다섯 바퀴에 한 번 마주쳐 더 못 돈다 (판화 214번)
//  설계표 docs/mm507-sheets/214.md · 부품·운동식은 kit/k214 조립만 한다
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { finger214, K214, key214, lamps214, state214 } from '../kit/k214';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const PHASE_TEXT = { wind: '감는 중', holdF: '멈춤 — 두 손가락이 맞부딪침', unwind: '푸는 중', holdB: '멈춤 — 반대쪽에서 부딪침' } as const;

export default function buildM214(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [lx, ly] = K214.CL;
  const [rx, ry] = K214.CR;

  const gearL = spurGear(12, K214.m, { width: 0.1, spokes: 0, driver: true });
  gearL.name = 'gearL';
  gearL.position.set(lx, ly, 0.06);
  const gearR = spurGear(10, K214.m, { width: 0.1, spokes: 0 });
  gearR.name = 'gearR';
  gearR.position.set(rx, ry, 0.06);

  const fL = finger214(true);
  fL.position.set(lx, ly, 0);
  const fR = finger214(false);
  fR.position.set(rx, ry, 0);
  const matL = fL.userData.mat as THREE.MeshStandardMaterial;
  const matR = fR.userData.mat as THREE.MeshStandardMaterial;

  const shaftL = shaftZ(lx, ly, 0.28, 0.05);
  const shaftR = shaftZ(rx, ry, 0.26, 0.05);
  const key = key214();
  key.position.set(lx, ly, 0);
  const lamps = lamps214(4);
  const setLit = lamps.userData.setLit as (k: number) => void;
  g.add(gearL, gearR, fL, fR, shaftL, shaftR, key, lamps);

  const arrL = rotArrow(0.35, true);
  const arrLr = rotArrow(0.35, false);
  const arrR = rotArrow(0.3, false);
  const arrRr = rotArrow(0.3, true);
  arrL.position.set(lx, ly, 0.44);
  arrLr.position.set(lx, ly, 0.44);
  arrR.position.set(rx, ry, 0.3);
  arrRr.position.set(rx, ry, 0.3);
  g.add(arrL, arrLr, arrR, arrRr);

  g.add(
    leaderTo(tag('왼쪽 기어(이 12)', v(-1.75, 0.7, 0.55)), 'gearL'),
    leaderTo(tag('오른쪽 기어(이 10)', v(1.7, 0.7, 0.55)), 'gearR'),
    leaderTo(tag('왼쪽 멈춤 손가락', v(-1.3, 3.05, 0.55)), 'fingerL'),
    leaderTo(tag('오른쪽 멈춤 손가락', v(1.3, 3.05, 0.55)), 'fingerR'),
    leaderTo(tag('바퀴 수 표시등', v(0.95, 0.25, 0.55)), 'lamps')
  );

  let t = 0;
  let st = state214(0);
  const place = (): void => {
    st = state214(t);
    const a1 = st.th1 * D2R;
    const a2 = st.th2 * D2R;
    gearL.rotation.z = a1;
    fL.rotation.z = a1;
    shaftL.rotation.z = a1;
    key.rotation.z = a1;
    gearR.rotation.z = a2;
    fR.rotation.z = a2 + K214.fingerRDeg * D2R;
    shaftR.rotation.z = a2;
    setLit(Math.min(4, Math.floor(st.turns + 0.001)));
    const hot = st.stopped ? 0x600000 : 0x000000;
    matL.emissive.setHex(hot);
    matR.emissive.setHex(hot);
    const w = st.phase === 'wind';
    const u = st.phase === 'unwind';
    arrL.visible = w;
    arrR.visible = w;
    arrLr.visible = u;
    arrRr.visible = u;
  };
  place();

  return {
    group: g,
    view: { pos: [0, 1.65, 6.0], target: [0, 1.65, 0.1] },
    notes: () => {
      const m = Math.max(0, Math.min(4, Math.ceil(st.th1 / 360)));
      const rAng = (((468 - 432 * m) % 360) + 360) % 360;
      return [
        { label: '상태', value: PHASE_TEXT[st.phase] },
        { label: '감은 바퀴 수', value: `${st.turns.toFixed(2)} 바퀴 (0.00 ~ 4.81)` },
        { label: '왼 손가락이 물림 쪽을 지날 때 오른 손가락 각', value: `${rAng}°` },
        { label: '엇갈림', value: '이 12 : 10 → 한 바퀴에 72° 씩 엇갈려, 다섯 바퀴에 한 번 마주침' },
        { label: '원리', value: '212 의 볼록 옆면 대신, 잇수가 다른 두 기어의 손가락이 몇 바퀴 만에 마주쳐 막는다' }
      ];
    },
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
