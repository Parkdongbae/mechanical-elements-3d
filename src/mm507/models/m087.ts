// 087 스스로 뒤집히는 운동 — 베벨 기어·클러치·넘어가는 추 (판화 87번)
// 가운데 큰 베벨이 헐거운 베벨 B·C 를 반대로 돌리고, 클러치 D 가 물린 쪽만 가로축을 돌린다.
// 가로축 끝 피니언이 바퀴 E 를 돌리고, E 의 스터드가 꺾쇠 G 를 밀어 연결 막대로 추 레버 F 를 세운다.
// 추가 수직을 넘으면 저 혼자 넘어가며 포크로 클러치를 반대쪽으로 옮긴다 → 축이 거꾸로.
// 모든 자세는 누적 구동각 theta 의 함수(kit/k086 의 reverse87 시간표).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { bevelPitchAngle, coneBevelGear } from '../kit/gear5';
import { wallBearing } from '../kit/gear6';
import { clawRing, doubleClutch, rodX } from '../kit/k053';
import {
  D87,
  K87,
  bellCrank87,
  forkLever87,
  linkBar87,
  reverse87,
  stud87,
  weightedLever87,
  type State87
} from '../kit/k086';

const XD = K87.x0; // 구동 베벨 중심 x = −1.25
const YS = K87.ys; // 가로축 높이 1.75
const ZC = K87.zc; // 가로축 깊이 0.30
const MOD = K87.module;
const STUD_Z = 0.572; // 바퀴 E 민판 앞면
const R2D = 180 / Math.PI;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM087(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // ── 구동 베벨(축 Z, 이가 +Z 를 본다) ──
  const dDrive = bevelPitchAngle(Math.PI / 2, K87.zDrive, K87.zBC);
  const drive = coneBevelGear(K87.zDrive, MOD, dDrive, { face: 0.14, driver: true });
  drive.name = 'driveBevel';
  drive.position.set(XD, YS, ZC - 0.36);
  g.add(drive);
  g.add(shaftZ(XD, YS, 0.1, 0.045));

  // ── 헐거운 베벨 B·C(가로축 위, 좁은 끝이 안쪽) + 각자의 발톱 링 ──
  const dBC = Math.PI / 2 - dDrive;
  const clawOpts = { teeth: K87.jaws, rIn: 0.07, rOut: 0.115, bore: 0.047, base: 0.0685, tooth: 0.04, frac: 0.34 };
  const wrapB = new THREE.Group();
  wrapB.position.set(XD - 0.54, YS, ZC);
  wrapB.rotation.y = Math.PI / 2;
  const bevelB = coneBevelGear(K87.zBC, MOD, dBC, { face: 0.14 });
  bevelB.name = 'bevelB';
  const ringB = clawRing({ ...clawOpts, phase: D87.phaseB });
  ringB.position.z = 0.1665;
  bevelB.add(ringB);
  wrapB.add(bevelB);
  g.add(wrapB);

  const wrapC = new THREE.Group();
  wrapC.position.set(XD + 0.54, YS, ZC);
  wrapC.rotation.y = -Math.PI / 2;
  const bevelC = coneBevelGear(K87.zBC, MOD, dBC, { face: 0.14 });
  bevelC.name = 'bevelC';
  const ringC = clawRing({ ...clawOpts, phase: D87.phaseC });
  ringC.position.z = 0.1665;
  bevelC.add(ringC);
  wrapC.add(bevelC);
  g.add(wrapC);

  // ── 이중 클러치 D(깃 위를 미끄러진다) ──
  const clutch = doubleClutch({ teeth: K87.jaws });
  clutch.name = 'clutchD';
  g.add(clutch);

  // ── 가로축 + 벽 받침 2개 ──
  const shaft = rodX(-2.08, 0.82, 0.045, { x0: -1.52, x1: -0.98 });
  shaft.name = 'mainShaft';
  shaft.position.set(0, YS, ZC);
  g.add(shaft);
  g.add(wallBearing(-2.0, YS, ZC, 'x', 0.05), wallBearing(0.05, YS, ZC, 'x', 0.05));

  // ── 가로축 끝 피니언 ──
  const dP = bevelPitchAngle(Math.PI / 2, K87.zPinion, K87.zE);
  const wrapP = new THREE.Group();
  wrapP.position.set(0.65, YS, ZC);
  wrapP.rotation.y = Math.PI / 2;
  const pinion = coneBevelGear(K87.zPinion, MOD, dP, { face: 0.12 });
  pinion.name = 'pinion';
  wrapP.add(pinion);
  g.add(wrapP);

  // ── 바퀴 E(이가 뒤를 보고 민판이 앞) + 스터드 ──
  const wrapE = new THREE.Group();
  wrapE.position.set(K87.Ec[0], K87.Ec[1], 0.5);
  wrapE.rotation.y = Math.PI;
  const wheelE = coneBevelGear(K87.zE, MOD, Math.PI / 2 - dP, { face: 0.12 });
  wheelE.name = 'wheelE';
  wrapE.add(wheelE);
  g.add(wrapE);
  g.add(shaftZ(K87.Ec[0], K87.Ec[1], 0.7, 0.045));
  const stud = stud87(0.09);
  g.add(stud);

  // ── 흔들 축 위의 포크와 추 레버 F ──
  g.add(shaftZ(K87.P[0], K87.P[1], 0.5, 0.04));
  const fork = forkLever87(0.09, 0.04, 0.02);
  fork.name = 'fork';
  fork.position.set(K87.P[0], K87.P[1], 0.3);
  g.add(fork);
  const leverF = weightedLever87(0.05, 0.08, 0.16, 0.02);
  leverF.name = 'leverF';
  leverF.position.set(K87.P[0], K87.P[1], 0.43);
  g.add(leverF);

  // ── 꺾쇠 G + 연결 막대 ──
  const crank = bellCrank87(0.61, 0.44, 0.05, 0.08, 0.036);
  crank.name = 'crankG';
  crank.position.set(K87.G[0], K87.G[1], 0);
  g.add(crank);
  g.add(shaftZ(K87.G[0], K87.G[1], 0.69, 0.03));
  const rodBar = linkBar87(D87.rodLen);
  rodBar.name = 'conRod';
  g.add(rodBar);

  // ── 회전 화살표 ──
  const arrDrive = rotArrow(0.3, true);
  arrDrive.position.set(XD, YS, 0.12);
  // 바퀴 E: 방향이 바뀌므로 둘을 겹쳐 두고 맞는 쪽만 보인다(스터드 끝 z 0.662 보다 앞, 반지름은 스터드 바깥)
  const arrEccw = rotArrow(0.36, true);
  const arrEcw = rotArrow(0.36, false);
  for (const a of [arrEccw, arrEcw]) a.position.set(K87.Ec[0], K87.Ec[1], 0.69);
  g.add(arrDrive, arrEccw, arrEcw);

  // ── 이름표 ──
  g.add(
    tag('구동 베벨', v(-1.25, 2.55, 0.1)),
    tag('베벨 B', v(-2.0, 2.35, 0.3)),
    tag('베벨 C', v(-0.5, 2.35, 0.3)),
    tag('클러치 D', v(-1.25, 2.2, 0.45)),
    tag('바퀴 E(스터드)', v(1.45, 2.4, 0.6)),
    tag('추 레버 F', v(-0.55, 1.2, 0.5)),
    tag('꺾쇠 G', v(0.02, 1.35, 0.7))
  );

  let st: State87 = reverse87(0);
  const apply = (): void => {
    st = reverse87(theta);
    drive.rotation.z = st.drive;
    bevelB.rotation.z = st.rollB;
    bevelC.rotation.z = st.rollC;
    clutch.position.set(XD + st.x, YS, ZC);
    clutch.rotation.x = st.sigma;
    shaft.rotation.x = st.sigma;
    pinion.rotation.z = st.rollPinion;
    wheelE.rotation.z = st.rollE;
    stud.position.set(st.stud[0], st.stud[1], STUD_Z);
    fork.rotation.z = -st.chi;
    leverF.rotation.z = -st.phi;
    crank.rotation.z = st.psi;
    rodBar.position.set(st.pinF[0], st.pinF[1], 0.49);
    rodBar.rotation.z = st.rodAngle;
    arrEccw.visible = st.dir > 0;
    arrEcw.visible = st.dir < 0;
  };
  apply();

  const stateText = (): string => {
    if (st.engaged === 'none') return '중립(클러치 가운데)';
    if (st.phase === 'fall') return '추가 넘어가는 중';
    if (st.phase === 'push') return `${st.engaged} 에 물림 — 스터드가 꺾쇠를 미는 중`;
    return `${st.engaged} 에 물림`;
  };

  return {
    group: g,
    view: { pos: [-0.2, 2.0, 6.4], target: [-0.3, 1.6, 0.2] },
    notes: () => [
      { label: '원리', value: '스터드가 꺾쇠를 밀어 추를 세우면, 추가 저 혼자 넘어가며 클러치를 반대쪽 기어로 옮긴다 → 축이 거꾸로' },
      { label: '상태', value: stateText() },
      { label: '가로축 방향', value: st.dir > 0 ? '+' : st.dir < 0 ? '−' : '정지' },
      { label: '추 레버 기울기 phi', value: `${(st.phi * R2D).toFixed(1)}°` },
      { label: '바퀴 E 각 eps', value: `${(st.eps * R2D).toFixed(1)}°` },
      { label: '속도비', value: '가로축/구동 ±1.5, E/가로축 0.5' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
