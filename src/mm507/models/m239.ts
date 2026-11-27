// 239 기어의 멈추개 — 레버 두 개가 평기어의 이 사이에 끼어 기어를 막는다. 하나를 들면 그 반대쪽으로만 돈다 (판화 239번)
//  설계표 docs/mm507-sheets/239.md · 부품·운동식은 kit/k239 조립만 한다
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K239, gear239, lever239, state239 } from '../kit/k239';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { paint, brass } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const RED = 0xcc2020;
const GREEN = 0x1f7a1f;

function handArrow(name: string, x: number, y: number): THREE.Group {
  const h = new THREE.Group();
  h.name = name;
  h.position.set(x, y, 0.12);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 16), paint(0xffcc00));
  cone.position.y = 0.07;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 12), paint(0xffcc00));
  stem.position.y = -0.09;
  cone.castShadow = true;
  stem.castShadow = true;
  h.add(cone, stem);
  return h;
}

export default function buildM239(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [WX, WY] = K239.W;
  const [LX, LY] = K239.PL;
  const [RX, RY] = K239.PR;

  g.add(shaftZ(WX, WY, 0.15, 0.05));
  g.add(shaftZ(LX, LY, 0.07, 0.03));
  g.add(shaftZ(RX, RY, 0.07, 0.03));

  const gear = gear239();
  gear.name = 'gear';
  gear.position.set(WX, WY, 0);
  g.add(gear);

  // 손잡이(기어 그룹 자식)
  const ca = 200 * D2R;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.03), brass());
  arm.castShadow = true;
  arm.position.set(0.225 * Math.cos(ca), 0.225 * Math.sin(ca), 0.085);
  arm.rotation.z = ca;
  gear.add(arm);
  const hg = lathe(rodProfile(0.035, 0.1, 0.26, 0.004, 0.006), 24);
  hg.rotateX(Math.PI / 2);
  const crank = mesh(hg, brass());
  crank.name = 'crank';
  crank.position.set(0.43 * Math.cos(ca), 0.43 * Math.sin(ca), 0);
  gear.add(crank);

  const leverL = lever239('L');
  leverL.name = 'leverL';
  leverL.position.set(LX, LY, 0);
  g.add(leverL);
  const leverR = lever239('R');
  leverR.name = 'leverR';
  leverR.position.set(RX, RY, 0);
  g.add(leverR);
  const matL = leverL.userData.mat as THREE.MeshStandardMaterial;
  const matR = leverR.userData.mat as THREE.MeshStandardMaterial;

  const handL = handArrow('handL', -0.95, 2.6);
  const handR = handArrow('handR', 0.95, 2.62);
  g.add(handL, handR);

  const arrCcw = rotArrow(0.3, true);
  const arrCw = rotArrow(0.3, false);
  arrCcw.position.set(WX, WY, 0.28);
  arrCw.position.set(WX, WY, 0.28);
  g.add(arrCcw, arrCw);

  g.add(
    leaderTo(tag('평기어(14이)', v(0.0, 0.28, 0.3)), 'gear'),
    leaderTo(tag('왼쪽 멈추개(반시계를 막음)', v(-1.45, 2.75, 0.3)), 'leverL'),
    leaderTo(tag('오른쪽 멈추개(시계를 막음)', v(1.35, 2.75, 0.3)), 'leverR'),
    leaderTo(tag('손잡이(돌림)', v(1.55, 1.0, 0.3)), 'crank')
  );

  let t = 0;
  let st = state239(0);
  const pose = (): void => {
    st = state239(t);
    gear.rotation.z = st.theta * D2R;
    leverL.rotation.z = st.lamL * D2R;
    leverR.rotation.z = st.lamR * D2R;
    const emi = (side: 'L' | 'R'): number => (st.stopSide === 'both' ? GREEN : st.stopSide === side ? RED : 0x000000);
    matL.emissive.setHex(emi('L'));
    matR.emissive.setHex(emi('R'));
    handL.visible = Math.abs(st.hL) > 0.5;
    handR.visible = Math.abs(st.hR) > 0.5;
    arrCcw.visible = st.dir === 1;
    arrCw.visible = st.dir === -1;
  };
  pose();

  return {
    group: g,
    view: { pos: [0.0, 1.55, 6.0], target: [0.0, 1.5, 0] },
    notes: () => [
      { label: '상태', value: st.text },
      { label: '기어 각', value: st.theta.toFixed(1) + '°' },
      { label: '원리', value: '왼쪽 코는 반시계, 오른쪽 코는 시계를 막는다 — 하나를 들면 그 반대쪽으로만 돈다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      pose();
    }
  };
}
