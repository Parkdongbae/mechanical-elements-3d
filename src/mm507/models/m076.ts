// 076 회전 수 계수기 (2) — 큰 바퀴의 스터드 D 가 한 바퀴에 한 번 탭핏 B 를 쳐서 톱니 바퀴 A 를 이 하나만큼 돌린다 (판화 76번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import {
  fixedArm,
  followerAngle,
  makeCounter,
  nosePiece,
  pawlShape,
  ratchetPawl,
  rimWheel,
  sawWheel,
  tappetBar,
  type SawSpec,
  type TappetSpec
} from '../kit/k074';

const D2R = Math.PI / 180;
const OX = 0;
const OY = 1.72;
const SPEC: SawSpec = { teeth: 20, rOut: 0.6, rRoot: 0.48, dir: 1 };
const TAP: TappetSpec = { c: [1.0835, -0.0568], psi0: 6 * D2R, e: 0.2, lh: 0.206, ln: 0.36, hw: 0.06, rD: 1.379, rs: 0.04 };
const PH_ANG = 112.15 * D2R;
const PH_R = 0.69;
const PHX = OX + PH_R * Math.cos(PH_ANG);
const PHY = OY + PH_R * Math.sin(PH_ANG);

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM076(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());
  g.add(shaftZ(OX, OY, 0.2));

  const counter = makeCounter(SPEC, TAP);

  // 큰 바퀴(구동, 시계 방향)
  const bigWheel = rimWheel(1.16, 1.45, 6, { r: TAP.rD, a: 0, rad: 0.04, len: 0.27 }, { thick: 0.08 });
  bigWheel.name = 'bigWheel';
  bigWheel.position.set(OX, OY, -0.16);
  g.add(bigWheel);

  // 고정 받침 팔 2개(보충)
  const armC = fixedArm(1.085, 0.16);
  armC.name = 'armC';
  armC.position.set(OX, OY, -0.04);
  armC.rotation.z = -3 * D2R;
  // 폴 쪽 팔은 C 쪽 팔 바로 앞 층(z −0.005~0.035)에 둔다 — 같은 층이면 두 허브가 축에서 겹친다
  const armP = fixedArm(PH_R, 0.105);
  armP.name = 'armP';
  armP.position.set(OX, OY, 0.015);
  armP.rotation.z = PH_ANG;
  g.add(armC, armP);

  // 톱니 바퀴 A
  const wheelA = sawWheel(SPEC, { width: 0.06, holes: 5 });
  wheelA.name = 'wheelA';
  wheelA.position.set(OX, OY, 0.1);
  g.add(wheelA);

  // 탭핏 막대와 꺾이는 끝 B
  const tappet = tappetBar(TAP, 0.06);
  tappet.name = 'tappet';
  tappet.position.set(OX + TAP.c[0], OY + TAP.c[1], 0.1);
  g.add(tappet);
  tappet.add(leaderTo(tag('B 탭핏(끝이 꺾인다)', v(-0.2, -0.65, 0.35)), 'tappet'));
  const noseB = nosePiece(TAP, 0.06);
  noseB.name = 'noseB';
  g.add(noseB);

  // 멈춤 폴
  const shapeH = pawlShape(SPEC, PH_R, 28 * D2R, 0, { wBase: 0.07, wTip: 0.026 });
  const pawlHold = ratchetPawl(shapeH, { thick: 0.05 });
  pawlHold.name = 'pawlHold';
  pawlHold.position.set(PHX, PHY, 0.1);
  g.add(pawlHold);

  // 회전 화살표
  const arrBig = rotArrow(0.95, false);
  arrBig.position.set(OX, OY, -0.11);
  const arrA = rotArrow(0.3, true);
  arrA.position.set(OX, OY, 0.14);
  g.add(arrBig, arrA);

  g.add(
    tag('A 톱니 바퀴(한 번에 이 하나)', v(-0.55, 1.05, 0.45)),
    leaderTo(tag('C 고정 받침', v(1.2, 2.0, 0.45)), 'armC'),
    tag('D 스터드', v(1.75, 2.45, 0.45)),
    tag('큰 바퀴(구동, 한 바퀴에 한 번 친다)', v(-1.5, 3.0, 0.3)),
    tag('멈춤 폴', v(-0.85, 2.7, 0.45))
  );

  let ang = 0;
  let st = counter.state(0);
  const apply = (): void => {
    st = counter.state(ang);
    bigWheel.rotation.z = st.studAngle;
    wheelA.rotation.z = st.wheel;
    tappet.rotation.z = st.psi;
    noseB.position.set(OX + st.h[0], OY + st.h[1], 0.1);
    noseB.rotation.z = st.psi - st.kappa;
    pawlHold.rotation.z = followerAngle(SPEC, st.wheel, [PHX - OX, PHY - OY], shapeH.L, 1);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 2.0, 6.4], target: [0, 1.7, 0.0] },
    notes: () => {
      const n = Math.floor(ang / (2 * Math.PI));
      const phase = st.phase === 'rest' ? '쉼' : st.phase === 'push' ? '스터드가 탭핏을 누름' : '탭핏이 돌아감(끝이 꺾임)';
      return [
        { label: '상태', value: phase },
        { label: '큰 바퀴 회전 수', value: String(n) },
        { label: '센 수(넘긴 이)', value: String(n) },
        { label: '비율', value: '톱니 20개 → 큰 바퀴 20바퀴에 A 한 바퀴' },
        { label: '막대 눌린 각', value: `${(st.beta / D2R).toFixed(1)}°` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      ang = theta / 2;
      apply();
    }
  };
}
