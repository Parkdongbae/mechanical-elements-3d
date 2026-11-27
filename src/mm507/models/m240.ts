// 240 래칫의 여러 멈추개 — 곧은 폴·굽은 갈고리 폴·판 스프링이 미는 폴이 톱날 바퀴의 곧은 면을 막아 시계 방향을 못 돌게 한다 (판화 240번)
//  설계표 docs/mm507-sheets/240.md · 부품·운동식은 kit/k240 조립만 한다
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, shaftZ, tag } from '../kit';
import { ratchetWheel } from '../kit/gear6';
import { K240, pawl240, ratchetOutline240, spring240, state240 } from '../kit/k240';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { brass } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const RED = 0xcc2020;

export default function buildM240(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [WX, WY] = K240.W;

  // 고정 축·받침 핀·나사
  g.add(shaftZ(WX, WY, 0.15, 0.05));
  for (const [px, py] of K240.P) g.add(shaftZ(px, py, 0.07, 0.025));
  g.add(shaftZ(K240.screw[0], K240.screw[1], 0.05, 0.03));
  g.add(shaftZ(K240.CC[0], K240.CC[1], 0.04, 0.012));

  // 래칫 바퀴(공용 ratchetWheel — 이미 z 가운데가 0) + 손잡이
  const wheel = new THREE.Group();
  wheel.name = 'ratchet';
  wheel.position.set(WX, WY, 0);
  wheel.add(ratchetWheel(K240.teeth, K240.rOut, K240.rRoot, 0.1, 0.06));
  const outline = ratchetOutline240();
  wheel.userData.outline = outline;
  setMM(wheel, { kind: 'ratchet', fn: 'ratchetWheel', teeth: K240.teeth, ra: K240.rOut, rf: K240.rRoot, width: 0.1, axis: 'z', outline });
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.03), brass());
  arm.castShadow = true;
  arm.position.set(0.21, 0, 0.085);
  wheel.add(arm);
  const hg = lathe(rodProfile(0.035, 0.1, 0.26, 0.004, 0.006), 24);
  hg.rotateX(Math.PI / 2);
  const crank = mesh(hg, brass());
  crank.name = 'crank';
  crank.position.set(0.4, 0, 0);
  wheel.add(crank);
  g.add(wheel);

  // 폴 셋
  const pawls = [0, 1, 2].map((i) => {
    const p = pawl240(i);
    p.name = `pawl${i + 1}`;
    p.position.set(K240.P[i]![0], K240.P[i]![1], 0);
    g.add(p);
    return p;
  });
  const mats = pawls.map((p) => p.userData.mat as THREE.MeshStandardMaterial);

  // 판 스프링
  const { base, arm: sArm } = spring240();
  base.name = 'springBase';
  sArm.name = 'springArm';
  sArm.position.set(K240.CC[0], K240.CC[1], 0);
  g.add(base, sArm);

  const arrCcw = rotArrow(0.3, true);
  const arrCw = rotArrow(0.3, false);
  arrCcw.position.set(WX, WY, 0.28);
  arrCw.position.set(WX, WY, 0.28);
  g.add(arrCcw, arrCw);

  g.add(
    leaderTo(tag('래칫 바퀴(20이)', v(1.55, 1.3, 0.3)), 'ratchet'),
    leaderTo(tag('폴 1 — 곧은 폴(제 무게)', v(1.45, 2.75, 0.3)), 'pawl1'),
    leaderTo(tag('폴 2 — 굽은 갈고리 폴', v(-1.55, 2.8, 0.3)), 'pawl2'),
    leaderTo(tag('폴 3 — 스프링 폴', v(-1.6, 0.7, 0.3)), 'pawl3'),
    leaderTo(tag('판 스프링', v(1.45, 0.45, 0.3)), 'springArm'),
    leaderTo(tag('손잡이(돌림)', v(0.0, 2.95, 0.3)), 'crank')
  );

  let t = 0;
  let st = state240(0);
  const pose = (): void => {
    st = state240(t);
    wheel.rotation.z = (K240.offset + st.theta) * D2R;
    for (let i = 0; i < 3; i++) {
      pawls[i]!.rotation.z = st.lam[i]! * D2R;
      mats[i]!.emissive.setHex(st.catchers.includes(i) ? RED : 0x000000);
    }
    sArm.rotation.z = st.sigma * D2R;
    arrCcw.visible = st.phase === 'turn';
    arrCw.visible = st.phase === 'back';
  };
  pose();

  return {
    group: g,
    view: { pos: [0.05, 1.62, 6.1], target: [0.05, 1.58, 0] },
    notes: () => [
      { label: '바퀴', value: st.phase === 'turn' ? '반시계로 돌림(폴이 이를 타고 넘음)' : st.phase === 'back' ? '손을 놓음 → 시계로 되돌아감' : '멈춤 — 폴이 곧은 면에 걸림' },
      { label: '잡은 폴', value: st.phase !== 'hold' ? '—' : st.catchers.length === 2 ? '폴 1·폴 2' : '폴 3' },
      { label: '바퀴 각', value: st.theta.toFixed(1) + '°' },
      { label: '원리', value: '곧은 면이 시계 쪽 → 시계로는 못 돎. 폴 3 은 반 칸 어긋나 9° 마다 번갈아 잡음' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      pose();
    }
  };
}
