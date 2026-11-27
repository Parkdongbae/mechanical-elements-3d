// 241 한 이빨 바퀴 — 이가 하나뿐인 작은 바퀴(손가락)가 한 바퀴 돌 때마다 톱니바퀴 A 를 한 칸(20°) 밀고, 멈춤쇠가 잡는다
// 설계표 docs/mm507-sheets/241.md · 부품·식은 kit/k241
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K241, click241, finger241, sawWheel241, state241 } from '../kit/k241';
import { mesh } from '../../models/parts/geom';
import { paint } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K241;
const DEG = 180 / Math.PI;

export default function buildM241(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [cx, cy] = K.C;
  const [sx, sy] = K.S;
  const [px, py] = K.PC;

  g.add(shaftZ(cx, cy, 0.14, 0.045), shaftZ(sx, sy, 0.13, 0.04), shaftZ(px, py, 0.12, 0.03));

  const wheelA = sawWheel241();
  wheelA.name = 'wheelA';
  wheelA.position.set(cx, cy, 0);

  const small = new THREE.Group();
  small.name = 'smallWheel';
  small.position.set(sx, sy, 0);
  const discGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.08, 64);
  discGeo.rotateX(Math.PI / 2);
  const disc = mesh(discGeo, paint(0xe5e7eb));
  disc.position.z = -0.06;
  disc.name = 'disc';
  const finger = finger241();
  finger.name = 'finger';
  small.add(disc, finger);

  const click = click241();
  click.name = 'click';
  click.position.set(px, py, 0);

  g.add(wheelA, small, click);

  const arrS = rotArrow(0.3, true);
  arrS.position.set(sx, sy, 0.2);
  const arrA = rotArrow(0.5, false);
  arrA.position.set(cx, cy, 0.2);
  g.add(arrS, arrA);

  g.add(
    leaderTo(tag('A 톱니바퀴', v(1.8, 0.5, 0.5)), 'wheelA'),
    leaderTo(tag('이 하나 바퀴', v(-1.75, 0.45, 0.5)), 'smallWheel'),
    leaderTo(tag('멈춤쇠', v(-1.7, 3.05, 0.5)), 'click'),
    leaderTo(tag('한 이(핀)', v(-1.85, 1.95, 0.5)), 'finger')
  );

  let t = 0;
  let st = state241(0);
  const place = (): void => {
    st = state241(t);
    small.rotation.z = st.thetaS;
    wheelA.rotation.z = st.thetaA;
    click.rotation.z = st.gamma - K.GAMMA0 / DEG;
  };
  place();

  return {
    group: g,
    view: { pos: [0.2, 1.85, 6.8], target: [0.2, 1.8, 0] },
    notes: () => [
      { label: '작은 바퀴 바퀴 수', value: ((st.thetaS - K.TH_E / DEG) / (2 * Math.PI)).toFixed(2) },
      { label: 'A 가 돈 칸', value: String(Math.round(-st.thetaA * DEG / 20)) + ' 칸 (한 칸 20°)' },
      { label: '지금', value: st.pushing ? '핀이 이를 미는 중' : '멈춤 — 멈춤쇠가 잡음' },
      { label: '원리', value: '이가 하나뿐이라 한 바퀴에 한 칸만 민다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
