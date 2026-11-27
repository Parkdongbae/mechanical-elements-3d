// 237 왕관 래칫 — 위쪽 팔이 왕복하며 거기 붙은 초승달 폴이 그릇 테 윗면의 톱날 이를 위에서 걸어 그릇을 한 칸씩 돌린다 (판화 237번)
//  설계표 docs/mm507-sheets/237.md · 부품·운동식은 kit/k237
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { markPin } from '../kit/mm';
import { D2R, K237, arm237, crownSaw237, pawl237, state237 } from '../kit/k237';
import { castIron, darkSteel, steel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K237;
const ACTIVE = 0x7a4a00;
const PITCH = 15 * D2R;
const [KX, KZ] = K.K;

/** 세움 베어링 — 원점 = 받침대 윗면 위 축 자리, 비 s 로 줄인다 */
function footBearing(s: number): THREE.Group {
  const g = new THREE.Group();
  const m = darkSteel();
  g.add(mesh(lathe(tubeProfile(0.046 * s, 0.085 * s, 0.18, 0.45, 0.006 * s), 32), m));
  g.add(mesh(lathe(tubeProfile(0.046 * s, 0.14 * s, 0.18, 0.21, 0.004 * s), 48), m));
  return g;
}

export default function buildM237(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 세움 베어링과 세로 축
  const fb = footBearing(1);
  fb.name = 'footBearing';
  fb.position.set(K.XC, 0, K.ZC);
  g.add(fb);
  const shaft = mesh(lathe(rodProfile(0.045, 0.18, 1.0, 0, 0), 32), steel());
  shaft.name = 'drumShaft';
  shaft.position.set(K.XC, 0, K.ZC);
  g.add(shaft);

  // 그릇
  const crown = crownSaw237();
  crown.name = 'crown';
  crown.position.set(K.XC, 0, K.ZC);
  g.add(crown);

  // 팔 + 폴
  const arm = arm237();
  arm.name = 'arm';
  arm.position.set(K.XC, 0, K.ZC);
  g.add(arm);
  const pawl = pawl237();
  pawl.name = 'pawl';
  arm.getObjectByName('pawlFrame')!.add(pawl);
  const pawlMat = pawl.userData.mat as THREE.MeshStandardMaterial;
  const cwArrow = arm.getObjectByName('cwArrow')!;
  const ccwArrow = arm.getObjectByName('ccwArrow')!;

  // 크랭크 축(고정)·바닥 베어링·위 베어링 팔
  const cs = mesh(lathe(rodProfile(0.03, 0.18, 1.42, 0, 0), 24), steel());
  cs.name = 'crankShaft';
  cs.position.set(KX, 0, KZ);
  g.add(cs);
  const cfb = footBearing(0.67);
  cfb.name = 'crankFoot';
  cfb.position.set(KX, 0, KZ);
  g.add(cfb);
  const cb = new THREE.Group();
  cb.name = 'crankBearing';
  const dm = darkSteel();
  const cbArm = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.236), dm);
  cbArm.position.set(KX, 1.3, -0.182);
  cb.add(cbArm);
  const ring = mesh(lathe(tubeProfile(0.031, 0.06, 1.275, 1.325, 0.003), 32), dm);
  ring.position.set(KX, 0, KZ);
  cb.add(ring);
  g.add(cb);

  // 크랭크 원판
  const crank = new THREE.Group();
  crank.name = 'crank';
  crank.position.set(KX, 0, KZ);
  const sm = steel();
  crank.add(mesh(lathe(rodProfile(0.204, 1.42, 1.46, 0.004, 0.004), 64), sm));
  const cpin = mesh(lathe(rodProfile(0.022, 1.46, 1.56, 0, 0.003), 24), sm);
  cpin.position.set(K.rk, 0, 0);
  crank.add(cpin);
  const crankPin = new THREE.Object3D();
  crankPin.name = 'crankPin';
  crankPin.position.set(K.rk, 1.52, 0);
  crank.add(markPin(crankPin));
  g.add(crank);

  // 연결봉(두 끝 눈 구멍 0.023, 핀 0.022)
  const link = new THREE.Group();
  link.name = 'link';
  const cim = castIron();
  link.add(mesh(new THREE.BoxGeometry(K.Lk - 0.068, 0.04, 0.05), cim));
  for (const sx of [-1, 1]) {
    const eye = mesh(lathe(tubeProfile(0.023, 0.045, -0.02, 0.02, 0.003), 32), cim);
    eye.position.set((sx * K.Lk) / 2, 0, 0);
    link.add(eye);
  }
  link.position.y = 1.52;
  g.add(link);

  // 표시: 그릇 시계 화살표
  const arrow = rotArrow(0.3, false);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(K.XC, 0.75, K.ZC);
  g.add(arrow);

  // 이름표 6개
  g.add(
    leaderTo(tag('왕관 래칫(24이)', v(-1.25, 1.75, 0.3)), 'crown'),
    leaderTo(tag('위쪽 팔', v(-0.45, 2.15, 0.3)), 'arm'),
    leaderTo(tag('폴(밀 때 걺)', v(0.45, 2.0, 0.6)), 'pawl'),
    leaderTo(tag('크랭크(구동)', v(0.95, 2.0, -0.15)), 'crank'),
    leaderTo(tag('연결봉', v(1.0, 1.05, 0.55)), 'link'),
    leaderTo(tag('세로 축', v(-0.95, 0.55, 0.3)), 'drumShaft')
  );

  // 작은 변수 하나에서: 크랭크 핀 P·팔 끝 E 로 연결봉을 놓는다
  let st = state237(0);
  const pose = (th: number): void => {
    st = state237(th);
    crown.rotation.y = st.crownRot;
    shaft.rotation.y = st.crownRot;
    arm.rotation.y = st.armRot;
    pawl.rotation.z = st.lam;
    pawlMat.emissive.setHex(st.drive ? ACTIVE : 0x000000);
    crank.rotation.y = K.thF + st.u;
    const [px, pzm] = st.P;
    const [ex, ezm] = st.E;
    link.position.x = (px + ex) / 2;
    link.position.z = -(pzm + ezm) / 2;
    link.rotation.y = Math.atan2(ezm - pzm, ex - px);
    cwArrow.visible = st.pushing;
    ccwArrow.visible = !st.pushing;
  };
  pose(0);

  return {
    group: g,
    view: { pos: [1.0, 2.6, 3.7], target: [0.1, 1.2, 0.2] },
    notes: () => [
      { label: '팔', value: st.pushing ? '시계로 → 폴이 이를 밂' : '반시계로 → 폴이 이를 타 넘음' },
      { label: '그릇', value: '늘 시계(위에서), 한 번 왕복에 1이(15°)' },
      { label: '보낸 이', value: (st.phi / PITCH).toFixed(2) },
      { label: '왕관 래칫', value: '이가 테 윗면에 위로 서 있어 폴이 위에서 건다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
