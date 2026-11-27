// 233 랜턴 바퀴의 멈추개 — 원판에 박힌 핀 14개(랜턴 바퀴)를 롤러 레버가 양쪽으로 자리 잡고, 막대 폴이 시계 방향을 완전히 막는다 (판화 233번)
//  설계표 docs/mm507-sheets/233.md · 부품·운동식은 kit/k233 조립만 한다
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K233, barPawl233, lantern233, rollerLever233, state233 } from '../kit/k233';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { brass } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const RED = 0xcc2020;
const GREEN = 0x1f7a1f;

export default function buildM233(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [WX, WY] = K233.W;
  const [LX, LY] = K233.PL;
  const [BX, BY] = K233.PR;

  // 원판 축과 받침 핀(고정, 뒤판에서 나옴)
  g.add(shaftZ(WX, WY, 0.13, 0.05));
  g.add(shaftZ(LX, LY, 0.14, 0.03));
  g.add(shaftZ(BX, BY, 0.09, 0.028));

  const lantern = lantern233();
  lantern.name = 'lantern';
  lantern.position.set(WX, WY, 0);
  g.add(lantern);

  // 손잡이(원판 그룹 자식) — 팔 + 손잡이 원기둥(name crank)
  const ca = 250 * D2R;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.03), brass());
  arm.castShadow = true;
  arm.position.set(0.19 * Math.cos(ca), 0.19 * Math.sin(ca), 0.135);
  arm.rotation.z = ca;
  lantern.add(arm);
  const hg = lathe(rodProfile(0.035, 0.15, 0.32, 0.004, 0.006), 24);
  hg.rotateX(Math.PI / 2);
  const crank = mesh(hg, brass());
  crank.name = 'crank';
  crank.position.set(0.36 * Math.cos(ca), 0.36 * Math.sin(ca), 0);
  lantern.add(crank);

  const lever = rollerLever233();
  lever.name = 'rollerLever';
  lever.position.set(LX, LY, 0);
  g.add(lever);
  const roller = lever.getObjectByName('roller') as THREE.Group;
  const rollerMat = roller.userData.mat as THREE.MeshPhysicalMaterial;

  const bar = barPawl233();
  bar.name = 'barPawl';
  bar.position.set(BX, BY, 0);
  g.add(bar);
  const barMat = bar.userData.mat as THREE.MeshPhysicalMaterial;

  const arrCcw = rotArrow(0.3, true);
  const arrCw = rotArrow(0.3, false);
  arrCcw.position.set(WX, WY, 0.34);
  arrCw.position.set(WX, WY, 0.34);
  g.add(arrCcw, arrCw);

  g.add(
    leaderTo(tag('랜턴 바퀴(핀 14개)', v(0.1, 0.45, 0.35)), 'lantern'),
    leaderTo(tag('롤러 멈추개(양쪽을 잡음)', v(-1.55, 2.75, 0.35)), 'rollerLever'),
    leaderTo(tag('롤러', v(-0.55, 2.85, 0.35)), 'roller'),
    leaderTo(tag('막대 폴(시계를 막음)', v(1.45, 2.75, 0.35)), 'barPawl'),
    leaderTo(tag('손잡이(돌림)', v(-1.6, 0.9, 0.35)), 'crank')
  );

  let t = 0;
  let st = state233(0);
  const pose = (): void => {
    st = state233(t);
    lantern.rotation.z = st.theta * D2R;
    lever.rotation.z = st.lamR * D2R;
    bar.rotation.z = st.lamB * D2R;
    barMat.emissive.setHex(st.phase === 'hold' ? RED : 0x000000);
    rollerMat.emissive.setHex(st.lamR < 0.3 ? GREEN : 0x000000);
    arrCcw.visible = st.phase === 'turn';
    arrCw.visible = st.phase === 'back';
  };
  pose();

  return {
    group: g,
    view: { pos: [0.0, 1.6, 6.0], target: [0.0, 1.6, 0] },
    notes: () => [
      { label: '상태', value: st.phase === 'turn' ? '반시계로 돌림 — 롤러가 핀을 넘고 막대가 들림' : st.phase === 'back' ? '손을 놓음 → 되돌아감' : '멈춤 — 막대 끝면이 핀에 걸림' },
      { label: '원판 각', value: st.theta.toFixed(1) + '°' },
      { label: '두 멈추개', value: '롤러: 양쪽으로 자리만 잡음(세게 돌리면 넘어감) / 막대 폴: 시계는 완전히 막음' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      pose();
    }
  };
}
