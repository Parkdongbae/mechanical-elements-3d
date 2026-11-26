// 216 안팎 결손 기어 — 안쪽 이가 위 절반뿐인 링과 바깥 이가 아래 절반뿐인 가운데 바퀴가 한 축에 붙어 돌고,
// 아래 피니언이 둘과 번갈아 물려 느린 전진·빠른 후진을 낸다 (판화 216번) — 설계표 docs/mm507-sheets/216.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { partialGear } from '../kit/gear3';
import { K216, partialRing216, state216 } from '../kit/k216';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { brass, darkSteel, paint, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM216(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [sx, sy] = K216.S;
  const [px, py] = K216.P;

  const at = (m: THREE.Object3D, x: number, y: number, z: number, name: string): THREE.Object3D => {
    m.position.set(x, y, z);
    m.name = name;
    return m;
  };
  const tubeZ = (rIn: number, rOut: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh => {
    const geo = lathe(tubeProfile(rIn, rOut, z0, z1, 0.004), 96);
    geo.rotateX(Math.PI / 2);
    return mesh(geo, mat);
  };

  // 몸: 링 + 뒤 원판 + 바퀴 + 손잡이 (주축과 함께 돈다)
  const body = new THREE.Group();
  body.name = 'body';
  body.position.set(sx, sy, 0);
  const ring = partialRing216(K216.ZR, K216.M, 1, 23, { width: 0.09 });
  at(ring, 0, 0, 0.015, 'ring');
  const ringWall = tubeZ(1.18125, 1.2545, -0.12, -0.03, brass());
  ringWall.name = 'ringWall';
  const web = tubeZ(0.05, 1.2545, -0.12, -0.06, paint(0xe5e7eb, { roughness: 0.5 }));
  web.name = 'web';
  const hubGeo = lathe(rodProfile(0.12, 0, 0.14, 0.006, 0.006), 32);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, darkSteel());
  hub.position.z = -0.2;
  hub.name = 'webHub';
  const wheel = partialGear(K216.ZW, K216.M, 10, 7, { width: 0.09, spokes: 5 });
  at(wheel, 0, 0, 0.015, 'wheel');
  const band = mesh(new THREE.BoxGeometry(0.05, 0.45, 0.004), paint(0xf2b619));
  band.position.set(0, 0.775, -0.058);
  band.name = 'band';
  // 손잡이
  const crank = new THREE.Group();
  crank.name = 'crank';
  const arm = mesh(new THREE.BoxGeometry(0.22, 0.05, 0.03), darkSteel());
  arm.position.set(0.11, 0, 0.135);
  const hGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.11, 20);
  hGeo.rotateX(Math.PI / 2);
  const handle = mesh(hGeo, darkSteel());
  handle.position.set(0.22, 0, 0.195);
  crank.add(arm, handle);
  body.add(ring, ringWall, web, hub, wheel, band, crank);
  g.add(body);

  const shaft = shaftZ(sx, sy, 0.12, 0.045);
  shaft.name = 'shaft';
  g.add(shaft);

  // 피니언 + 색 원판 + 축
  const pinion = spurGear(K216.ZP, K216.M, { width: 0.09, spokes: 0 });
  at(pinion, px, py, 0.015, 'pinion');
  const matExt = paint(0x22c55e);
  const matInt = paint(0xf97316);
  const dGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.01, 48);
  dGeo.rotateX(Math.PI / 2);
  const disc = mesh(dGeo, matExt);
  disc.position.z = 0.055;
  disc.name = 'pinionDisc';
  const stripe = mesh(new THREE.BoxGeometry(0.18, 0.03, 0.006), paint(0xf2b619));
  stripe.position.set(0.11, 0, 0.063);
  const psGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.38, 24);
  psGeo.rotateX(Math.PI / 2);
  const pShaft = mesh(psGeo, steel());
  pShaft.position.set(0, 0, 0.145);
  pShaft.name = 'pinionShaft';
  pinion.add(disc, stripe, pShaft);
  g.add(pinion);

  // 피니언 받침(고정)
  const bracket = new THREE.Group();
  bracket.name = 'pinionBracket';
  const col = mesh(new THREE.BoxGeometry(0.1, 0.86, 0.06), darkSteel());
  col.position.set(1.55, 0.61, 0.3);
  const armB = mesh(new THREE.BoxGeometry(1.55, 0.07, 0.06), darkSteel());
  armB.position.set(0.775, py, 0.3);
  const brg = tubeZ(0.046, 0.09, 0.26, 0.34, darkSteel());
  brg.position.set(px, py, 0);
  bracket.add(col, armB, brg);
  g.add(bracket);

  // 화살표
  const arrCw = rotArrow(0.3, false);
  arrCw.position.set(px, py, 0.36);
  const arrCcw = rotArrow(0.3, true);
  arrCcw.position.set(px, py, 0.36);
  const arrS = rotArrow(0.3, true);
  arrS.position.set(sx, sy, 0.28);
  g.add(arrCw, arrCcw, arrS);

  g.add(
    leaderTo(tag('안쪽 결손 링(위쪽에만 이 23)', v(-1.75, 3.05, 0.5)), 'ring'),
    leaderTo(tag('바깥 결손 바퀴(아래쪽에만 이 7)', v(-1.8, 1.75, 0.5)), 'wheel'),
    leaderTo(tag('피니언(이 16) — 초록 느린 전진 / 주황 빠른 후진', v(-1.45, 0.45, 0.5)), 'pinion'),
    leaderTo(tag('주축 손잡이(일정하게 돌림)', v(1.65, 2.95, 0.5)), 'crank'),
    leaderTo(tag('피니언 받침 팔', v(1.85, 1.45, 0.5)), 'pinionBracket')
  );

  let t = 0;
  let st = state216(0);
  const place = (): void => {
    st = state216(t);
    body.rotation.z = st.phi;
    shaft.rotation.z = st.phi;
    pinion.rotation.z = st.psi;
    const ext = st.mode === 'ext';
    disc.material = ext ? matExt : matInt;
    arrCw.visible = ext;
    arrCcw.visible = !ext;
  };
  place();

  return {
    group: g,
    view: { pos: [0.4, 1.9, 5.6], target: [0, 1.7, 0] },
    notes: () => [
      { label: '주축 각', value: (st.phi * DEG).toFixed(1) + '°' },
      { label: '피니언 각', value: (st.psi * DEG).toFixed(1) + '°' },
      { label: '지금 물림', value: st.mode === 'ext' ? '바깥(가운데 바퀴) — 느린 전진, 1.125배, 시계' : '안쪽(링) — 빠른 후진, 3.125배, 반시계' },
      { label: '한 바퀴에', value: '전진 1.125배 · 후진 3.125배 (빠르기 2.78배 차), 이 없는 틈에서 방향 바뀜' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
