// 269 결손 랙 틀 — 틀 안쪽 위·아래에 이가 엇갈려 있는 랙이 한 방향으로 미끄러지는 동안
// 평기어가 위 랙에 물리면 한쪽, 아래 랙에 물리면 반대쪽으로 돌고, 이 없는 구간에서는 멈춘다.
// 손잡이로 틀을 왕복(20 초). 설계표 docs/mm507-sheets/269.md, 키트 kit/k269.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, spurGear, shaftZ, tag } from '../kit';
import { pedestalX } from '../kit/gear6';
import { K269, rackFrame269, state269 } from '../kit/k269';
import { bronze, glow, paint, steel } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { setMM } from '../kit/mm';

const K = K269;

/** z 방향 관(안반지름 rIn, 바깥 rOut, z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.004): THREE.BufferGeometry {
  const geo = lathe(tubeProfile(rIn, rOut, z0, z1, c), 40);
  geo.rotateX(Math.PI / 2);
  return geo;
}

export default function buildM269(): MovementModel {
  const g = new THREE.Group();
  let phase = 0;
  g.add(displayStand());

  // ── 평기어(축 위에서 돎) ──
  const gear = spurGear(K.Z, K.M, { width: 0.05, spokes: 4 });
  gear.name = 'gear';
  gear.position.set(K.G[0], K.G[1], 0.03);
  g.add(gear);

  // ── 기어 축(고정): 뒤판 보스 + 앞 너트, 칼라가 기어 뒤를 막음 ──
  const gearShaft = shaftZ(K.G[0], K.G[1], 0.0956, 0.024);
  gearShaft.name = 'gearShaft';
  const collar = mesh(tubeZ(0.024, 0.04, -0.2, -0.014), steel());
  collar.name = 'gearCollar';
  gearShaft.add(collar);
  g.add(gearShaft);

  // ── 틀(곧게 왕복) ──
  const frame = rackFrame269();
  frame.name = 'frame';
  frame.position.set(K.G[0], K.G[1], 0);
  g.add(frame);

  // ── 자루 안내 베어링(고정) ──
  const guide = pedestalX(K.G[0] + K.GUIDE_X, K.G[1], 0.03, 1, 0.18, 0.032);
  guide.name = 'guide';
  g.add(guide);

  // ── 받침 롤러(아래 막대 밑면을 받침) + 축 ──
  const RX = K.G[0] + 0.11;
  const RY = K.G[1] - 0.323375 - 0.002 - 0.06; // 아래 막대 밑면 − 틈 0.002 − 롤러 반지름
  const roller = new THREE.Group();
  roller.name = 'supportRoller';
  roller.position.set(RX, RY, 0);
  const rollerBody = mesh(tubeZ(0.021, 0.06, -0.01, 0.07, 0.006), bronze());
  rollerBody.name = 'supportRollerBody';
  const rmark = mesh(new THREE.BoxGeometry(0.03, 0.01, 0.004), paint(0xf2b619));
  rmark.position.set(0.04, 0, 0.0705);
  roller.add(rollerBody, rmark);
  g.add(roller);
  const rollerShaft = shaftZ(RX, RY, 0.089, 0.02);
  rollerShaft.name = 'rollerShaft';
  const rcollar = mesh(tubeZ(0.02, 0.035, -0.2, -0.011), steel());
  rcollar.name = 'rollerCollar';
  rollerShaft.add(rcollar);
  g.add(rollerShaft);

  // ── 화살표: 기어 회전(ccw/cw, 멈추면 숨김) + 틀 가는 쪽 ──
  const arrCcw = rotArrow(0.31, true);
  const arrCw = rotArrow(0.31, false);
  for (const a of [arrCcw, arrCw]) {
    a.position.set(K.G[0], K.G[1], 0.12);
    g.add(a);
  }
  const dArrow = new THREE.Group();
  dArrow.name = 'frameArrow';
  const aMat = glow(0xd8362f, 0.85);
  const aShaft = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 12), aMat);
  aShaft.position.y = -0.035;
  const aHead = mesh(new THREE.ConeGeometry(0.042, 0.07, 16), aMat);
  aHead.position.y = 0.065;
  dArrow.add(aShaft, aHead); // 길이 0.2, 가운데 원점, +y 방향
  dArrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(dArrow, { kind: 'arrow' });
  g.add(dArrow);

  // ── 이름표 6(이름표 표) ──
  g.add(
    leaderTo(tag('평기어', new THREE.Vector3(-1.55, 2.4, 0.3)), 'gear'),
    leaderTo(tag('위 랙', new THREE.Vector3(-0.6, 2.4, 0.3)), 'rackTop'),
    leaderTo(tag('아래 랙', new THREE.Vector3(0.1, 0.85, 0.3)), 'rackBottom'),
    leaderTo(tag('틀', new THREE.Vector3(0.35, 2.4, 0.3)), 'frameWall'),
    leaderTo(tag('안내 베어링', new THREE.Vector3(1.5, 2.4, 0.3)), 'guide'),
    leaderTo(tag('받침 롤러', new THREE.Vector3(-1.2, 0.85, 0.3)), 'supportRoller')
  );

  let st = state269(0);
  const apply = (speed: number): void => {
    st = state269(phase);
    frame.position.x = st.xf;
    gear.rotation.z = st.theta;
    roller.rotation.z = st.u / 0.06;
    const spin = st.spin * (speed < 0 ? -1 : 1);
    arrCcw.visible = spin > 0;
    arrCw.visible = spin < 0;
    // 틀이 가는 쪽: dir −1 이 왼쪽(−x). 속도가 음수면 반대
    const dir = st.dir * (speed < 0 ? -1 : 1);
    dArrow.visible = dir !== 0;
    dArrow.position.set(st.xf + 2.2, K.G[1] + 0.15, 0.03);
    dArrow.rotation.z = dir < 0 ? Math.PI / 2 : -Math.PI / 2;
  };
  apply(1);

  const rackText = (): string => (st.rack === 'top' ? '위 랙' : st.rack === 'bottom' ? '아래 랙' : '없음(이 없는 구간)');
  return {
    group: g,
    notes: () => [
      { label: '물린 랙', value: rackText() },
      { label: '틀 방향', value: st.dir < 0 ? '왼쪽' : st.dir > 0 ? '오른쪽' : '멈춤' },
      { label: '기어', value: st.spin > 0 ? '반시계' : st.spin < 0 ? '시계' : '멈춤' },
      { label: '원리', value: '틀이 한쪽으로 가는 동안에도 위 랙과 아래 랙이 번갈아 물려 기어가 번갈아 반대로 돈다 — 이 없는 구간에서는 잠깐 쉰다' }
    ],
    view: { pos: [0.0, 1.8, 5.0], target: [0, 1.6, 0.03] },
    update(dt: number, speed: number): void {
      phase += dt * speed;
      apply(speed);
    }
  };
}
