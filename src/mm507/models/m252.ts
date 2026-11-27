// 252 비스듬한 홈으로 롤러 이동 — 고정 가로 홈 C 와 D 의 비스듬한 팔 홈에 같이 끼인 두 롤러 핀이,
// D 가 오르내리면 두 홈이 겹치는 자리를 따라 좌우 똑같이 벌어지고 오므라든다.
// D 를 오르내리는 것은 크랭크 원판 핀이 D 덩이 가로 홈을 미는 스카치 요크(설계표 보충).
// 설계표 docs/mm507-sheets/252.md, 키트 kit/k252.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K252, frameD252, state252 } from '../kit/k252';
import { aluminum, brass, castIron, darkSteel, glow, paint, steel } from '../../models/materials';
import { annularSector, circlePath, extrude, lathe, mesh, rodProfile, roundedRect, shapeFrom, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from '../kit/mm';

const K = K252;

/** z 방향 원기둥 지오메트리(z0~z1) */
const cylZ = (r: number, z0: number, z1: number): THREE.BufferGeometry => {
  const geo = new THREE.CylinderGeometry(r, r, z1 - z0, 28);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, (z0 + z1) / 2);
  return geo;
};

/** 글자판 'A'·'B'(0.08): 가는 막대·반원 띠로 그린 얇은 판, 원점 = 글자 중심 */
function letterPlate(ch: 'A' | 'B'): THREE.Group {
  const g = new THREE.Group();
  const ink = paint(0x22262b);
  const stroke = (x0: number, y0: number, x1: number, y1: number): void => {
    const s = mesh(new THREE.BoxGeometry(0.012, Math.hypot(x1 - x0, y1 - y0), 0.002), ink);
    s.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    s.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
    g.add(s);
  };
  if (ch === 'A') {
    stroke(-0.032, -0.045, 0, 0.045);
    stroke(0.032, -0.045, 0, 0.045);
    stroke(-0.016, -0.013, 0.016, -0.013);
  } else {
    stroke(-0.03, -0.045, -0.03, 0.045);
    for (const cy of [-0.0215, 0.0215]) {
      const b = mesh(extrude(annularSector(0.011, 0.0235, -Math.PI / 2, Math.PI / 2), 0.002), ink);
      b.position.set(-0.03, cy, 0);
      g.add(b);
    }
  }
  return g;
}

export default function buildM252(): MovementModel {
  const g = new THREE.Group();
  let phase = 0;
  g.add(displayStand());

  // ── 왼쪽 받침(고정, 뒤판에 붙음) ──
  const bracketPts: V2[] = [
    [-1.85, 2.05], [-1.7, 2.05], [-1.62, 2.2], [-1.55, 2.38],
    [-1.55, 2.81], [-1.62, 2.98], [-1.7, 3.13], [-1.85, 3.13]
  ];
  const bracket = mesh(extrude(shapeFrom(bracketPts), 0.14, 0.006), castIron());
  bracket.name = 'bracketC';
  bracket.position.z = -0.23;
  g.add(bracket);

  // ── 막대 C(고정): 가로 홈 C 가 뚫린 밝은 알루미늄 막대, z −0.22~−0.16 ──
  const barSh = roundedRect(-1.55, 2.38, 1.25, 2.81, 0.015);
  barSh.holes.push(stadiumShape(-1.25, K.YC, 1.05, K.YC, K.SLOT_W));
  const barC = mesh(extrude(barSh, 0.06, 0.004), aluminum({ color: 0xe4eaf0 }));
  barC.name = 'barC';
  barC.position.z = -0.19;
  g.add(barC);

  // ── 뒤 받침 기둥 2(고정): 막대 C 를 뒤판에 연결, 홈보다 위라 핀 뒤 고리와 안 만남 ──
  for (const cx of [0, 1.0]) {
    const so = mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), castIron());
    so.name = 'standoff';
    so.position.set(cx, 2.75, -0.26);
    g.add(so);
  }

  // ── 안내 통(고정): 세로 구멍(0.041, 중심 x 0 · z −0.11)으로 막대 rodD 를 세로로만 움직이게 함 ──
  const gdSh = shapeFrom([[-0.1, -0.3], [0.1, -0.3], [0.1, -0.04], [-0.1, -0.04]]);
  gdSh.holes.push(circlePath(0, -0.11, 0.041));
  const gdGeo = extrude(gdSh, 0.18);
  gdGeo.rotateX(Math.PI / 2); // 모양 (x, z) → 세로 구멍
  const guide = mesh(gdGeo, castIron());
  guide.name = 'guideD';
  guide.position.set(0, 0.65, 0);
  g.add(guide);

  // ── 크랭크 받침(고정 관): 축이 관 속에서 돎, z −0.30~−0.24 ──
  const bossGeo = lathe(tubeProfile(0.03, 0.07, 0, 0.06, 0.004), 32);
  bossGeo.rotateX(Math.PI / 2);
  const crankBoss = mesh(bossGeo, castIron());
  crankBoss.name = 'crankBoss';
  crankBoss.position.set(K.CRANK_C[0], K.CRANK_C[1], -0.3);
  g.add(crankBoss);

  // ── 크랭크(구동): 원판 r 0.24 + 노란 표시 띠 + 축 + 핀(머리) ──
  const crank = new THREE.Group();
  crank.name = 'crank';
  crank.position.set(K.CRANK_C[0], K.CRANK_C[1], 0);
  const disc = mesh(cylZ(0.24, -0.2, -0.16), castIron());
  disc.name = 'crankDisc';
  const band = mesh(extrude(annularSector(0.13, 0.235, -0.22, 0.22), 0.006), paint(0xf2b619));
  band.name = 'crankBand';
  band.position.z = -0.155;
  const axle = mesh(cylZ(0.03, -0.3, -0.2), steel());
  axle.name = 'crankShaft';
  const crankPin = new THREE.Group();
  crankPin.name = 'crankPin';
  crankPin.position.set(0, -K.CRANK_R, 0);
  crankPin.add(mesh(cylZ(0.03, -0.16, -0.08), darkSteel()), mesh(cylZ(0.045, -0.08, -0.068), darkSteel()));
  crank.add(disc, band, axle, crankPin);
  setMM(crank, { kind: 'crank' });
  g.add(crank);

  // ── D 판(키트): 원점 = 세계, y = d 로 오르내림 ──
  const frameD = frameD252();
  g.add(frameD);

  // ── 롤러 2(brass, 돌지 않고 핀과 함께 옮겨 감) ──
  const mkRoller = (name: string, pinName: string, ch: 'A' | 'B'): THREE.Group => {
    const r = new THREE.Group();
    r.name = name;
    r.position.set(0, K.YC, 0);
    const rimGeo = lathe([[0, -0.05], [0.265, -0.05], [0.28, -0.035], [0.28, 0.055], [0.265, 0.07], [0, 0.07]], 64);
    rimGeo.rotateX(Math.PI / 2);
    r.add(mesh(rimGeo, brass())); // 테(모따기 0.015), z −0.05~0.07
    const hubGeo = lathe(rodProfile(0.09, 0.07, 0.085, 0.004, 0.004), 32);
    hubGeo.rotateX(Math.PI / 2);
    r.add(mesh(hubGeo, brass())); // 가운데 보스
    const headGeo = lathe(rodProfile(0.06, 0.085, 0.095, 0.004, 0.004), 24);
    headGeo.rotateX(Math.PI / 2);
    r.add(mesh(headGeo, steel())); // 핀 머리(보스 앞)
    const pin = mesh(lathe(rodProfile(K.PIN_R, -0.24, -0.05, 0.004, 0.004), 24), steel());
    pin.name = pinName;
    pin.geometry.rotateX(Math.PI / 2);
    r.add(pin); // 축 핀(롤러에 박힘), z −0.24~−0.05
    const hoopGeo = lathe(tubeProfile(K.PIN_R, 0.09, -0.24, -0.225, 0.004), 28);
    hoopGeo.rotateX(Math.PI / 2);
    r.add(mesh(hoopGeo, steel())); // 뒤 고리(막대 C 뒷면과 틈 0.005)
    const lp = letterPlate(ch);
    lp.position.set(0, 0.17, 0.071);
    r.add(lp);
    setMM(r, { kind: 'roller' });
    return r;
  };
  const rollerA = mkRoller('rollerA', 'pinA', 'A');
  const rollerB = mkRoller('rollerB', 'pinB', 'B');
  g.add(rollerA, rollerB);

  // ── 표시: 크랭크 회전 화살표 + D 옆 위아래 화살표(빨강) ──
  const rot = rotArrow(0.3, true);
  rot.position.set(0, K.CRANK_C[1], 0.1);
  g.add(rot);

  const dArrow = new THREE.Group();
  dArrow.name = 'dArrow';
  const aMat = glow(0xd8362f, 0.85);
  const aShaft = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 12), aMat);
  aShaft.position.y = 0.065;
  const aHead = mesh(new THREE.ConeGeometry(0.042, 0.07, 16), aMat);
  aHead.position.y = 0.165;
  dArrow.add(aShaft, aHead); // 길이 0.2
  dArrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(dArrow, { kind: 'arrow' });
  g.add(dArrow);

  // ── 이름표 5(이름표 표) ──
  const tagA = leaderTo(tag('롤러 A', new THREE.Vector3(-1.1, 3.05, 0.4)), 'rollerA');
  const tagB = leaderTo(tag('롤러 B', new THREE.Vector3(1.1, 3.05, 0.4)), 'rollerB');
  const tagC = leaderTo(tag('홈 C', new THREE.Vector3(1.75, 2.6, 0.4)), 'barC');
  const tagD = leaderTo(tag('부품 D(비스듬한 홈 팔)', new THREE.Vector3(1.65, 1.15, 0.4)), 'frameD');
  const tagK = leaderTo(tag('크랭크(D 를 오르내림)', new THREE.Vector3(-1.6, 1.1, 0.4)), 'crank');
  g.add(tagA, tagB, tagC, tagD, tagK);

  let st = state252(0);
  const apply = (): void => {
    st = state252(phase);
    frameD.position.y = st.d;
    crank.rotation.z = st.theta;
    rollerA.position.x = -st.xRoll;
    rollerB.position.x = st.xRoll;
    tagD.position.y = 1.15 + st.d; // 부품 D 이름표 따라감
    dArrow.position.set(0.45, 0.6 + st.d, 0.1);
    dArrow.rotation.z = Math.sin(st.theta) >= 0 ? 0 : Math.PI; // 오를 때 위, 내릴 때 아래
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: 'D 높이', value: st.d.toFixed(3) },
      { label: '롤러 A·B 위치', value: '∓' + st.xRoll.toFixed(3) },
      { label: '원리', value: '두 홈이 겹친 자리 = 핀 자리. D 가 0.1 오르면 롤러가 0.04 씩 벌어짐' }
    ],
    view: { pos: [0, 1.75, 5.6], target: [0, 1.75, 0] },
    update(dt: number, speed: number): void {
      phase += K.OMEGA * speed * dt;
      apply();
    }
  };
}
