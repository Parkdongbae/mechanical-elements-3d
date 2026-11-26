// 211 간헐 회전 기어 — 큰 바퀴(이가 일부에만)가 계속 돌고, 이 없는 테가 피니언의 오목면을 감싸 잠그며,
// 바퀴의 핀이 안내 조각을 치면 피니언이 정확히 한 바퀴 돈다 — 설계표 docs/mm507-sheets/211.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, partialGear, rotArrow, shaftZ, spurGear, tag } from '../kit';
import { K211, guide211, pinionLock211, state211, wheelLock211 } from '../kit/k211';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { castIron, paint, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K211;

function setEmissive(root: THREE.Object3D, hex: number): void {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && m.emissive) m.emissive.setHex(hex);
  });
}

export default function buildM211(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 큰 바퀴: 이 14개(j = 4..17) + 잠금판·받침 팔 + 핀 (한 몸, 축 W)
  const wheel = partialGear(40, K.m, K.from, K.count, { width: 0.1, spokes: 6, driver: true });
  wheel.name = 'wheel';
  wheel.position.set(K.W[0], K.W[1], K.zG);
  const lock = wheelLock211();
  wheel.add(lock.band, lock.pin);

  // 피니언: 이 16개 + 오목판 + 안내 조각 (한 몸, 축 P) + 겹쳐 고정하는 짧은 허브
  const pinion = spurGear(16, K.m, { width: 0.1, spokes: 0 });
  pinion.name = 'pinion';
  pinion.position.set(K.P[0], K.P[1], K.zG);
  const plate = pinionLock211();
  const guide = guide211();
  const spacerGeo = lathe(rodProfile(0.07, 0, 0.14, 0.004, 0.004), 28);
  spacerGeo.rotateX(Math.PI / 2);
  const spacer = mesh(spacerGeo, steel());
  spacer.position.z = 0.03; // 세계 z 0.10 ~ 0.24 (기어·오목판·안내 조각을 관통해 한 몸)
  // 피니언 노란 표지점: 오목판 앞면 위(한 바퀴 뒤 같은 자리로 돌아옴)
  const mark = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.004), paint(0xf2b619));
  const ma = (100 * Math.PI) / 180;
  mark.position.set(0.25 * Math.cos(ma), 0.25 * Math.sin(ma), K.plateZ1 - K.zG + 0.002);
  mark.rotation.z = ma;
  pinion.add(spacer, plate, guide, mark);
  g.add(wheel, pinion);

  // 축 두 개 + 바퀴 손잡이
  const shW = shaftZ(K.W[0], K.W[1], 0.25, 0.05);
  const shP = shaftZ(K.P[0], K.P[1], 0.26, 0.045);
  const crank = new THREE.Group();
  crank.name = 'crank';
  const hubGeo = lathe(rodProfile(0.055, 0, 0.05, 0.004, 0.004), 24);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, castIron());
  hub.position.z = 0.25;
  const arm = mesh(new THREE.BoxGeometry(0.28 + 0.04, 0.04, 0.03), castIron());
  arm.position.set(0.14, 0, 0.285);
  const hGeo = lathe(rodProfile(0.035, 0, 0.1, 0.005, 0.008), 20);
  hGeo.rotateX(Math.PI / 2);
  const handle = mesh(hGeo, paint(0xb8742a));
  handle.position.set(0.28, 0, 0.3);
  crank.add(hub, arm, handle);
  shW.add(crank);
  g.add(shW, shP);

  // 회전 화살표
  const aW = rotArrow(0.5, true);
  aW.position.set(K.W[0], K.W[1], 0.42);
  const aP = rotArrow(0.25, false);
  aP.position.set(K.P[0], K.P[1], 0.3);
  g.add(aW, aP);

  g.add(
    leaderTo(tag('큰 바퀴(이 있는 부분)', v(1.2, 3.2, 0.55)), 'wheel'),
    leaderTo(tag('이 없는 테(잠금 테)', v(1.95, 0.55, 0.55)), 'lockBand'),
    leaderTo(tag('피니언', v(-1.8, 2.75, 0.55)), 'pinion'),
    leaderTo(tag('오목한 자물쇠 면', v(-1.75, 0.6, 0.55)), 'lockPlate'),
    leaderTo(tag('핀', v(-0.45, 3.1, 0.55)), 'pin'),
    leaderTo(tag('안내 조각', v(-1.0, 3.15, 0.55)), 'guide')
  );

  let st = state211(0);
  const apply = (): void => {
    st = state211(t);
    wheel.rotation.z = st.theta;
    shW.rotation.z = st.theta;
    pinion.rotation.z = st.phi;
    shP.rotation.z = st.phi;
    setEmissive(guide, st.pushing ? 0x7a4a00 : 0x000000);
    setEmissive(plate, st.locked ? 0x1f5f1f : 0x000000);
    aP.visible = st.rotating;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '지금 상태', value: st.phase },
      { label: '바퀴 각 r', value: `${st.r.toFixed(0)}°` },
      { label: '피니언 바퀴 수', value: `${st.turns.toFixed(2)} 바퀴` },
      { label: '한 주기', value: '바퀴 한 바퀴에 피니언 한 바퀴, 쉬는 동안은 바퀴의 60%' },
      { label: '원리', value: '이 없는 테가 오목면을 감싸 피니언을 잠그고, 핀이 안내 조각을 쳐서 다시 물리기 시작한다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [-0.2, 1.75, 6.4], target: [-0.25, 1.7, 0.1] }
  };
}
