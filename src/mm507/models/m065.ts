// 065 탭핏 구동 간헐 회전 — 구동 원판 C 의 탭핏이 스터드 원판 D 의 스터드를 쳐서 한 바퀴에 한 칸(1/10 바퀴)씩만 돌리고, 정지 레버가 막는다 (판화 65번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, setMM } from '../kit';
import { notchedDisk, stopLever, studDisk, tappetArm } from '../kit/k065';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const CC: [number, number] = [-0.95, 2.0];
const DC: [number, number] = [0.95, 2.0];
const R = 0.92;
const NS = 10;
const STEP = TAU / NS; // 36°
const RING = 0.83;
const RHO = 0.05;
const PSI0 = Math.PI; // 쉬는 자리 스터드 각
const ARM_LOCAL = 87.741 * D2R;
const HUB = 0.085;
const TIP = 0.03;
const DELTA = Math.atan((HUB - TIP) / 1.22);
const HE = HUB * Math.cos(DELTA);
const T_PUSH0 = 1.45;
const T_PUSH1 = 1.7905;
const T_FIN1 = 1.9905;
const P: [number, number] = [0.04, 1.1];

/** 스터드 각 ψ 일 때 탭핏 축선의 세계 각 a (앞가장자리가 스터드에 닿는 자세) */
function armAngle(psi: number): number {
  const sx = DC[0] + RING * Math.cos(psi) - CC[0];
  const sy = DC[1] + RING * Math.sin(psi) - CC[1];
  const r = Math.hypot(sx, sy);
  return Math.atan2(sy, sx) + Math.asin((HE + RHO) / r) - DELTA;
}

/** τ(접촉 구간) → D 이동각 g (이분법: armAngle 은 ψ 에 대해 감소) */
function pushG(tau: number): number {
  const target = ARM_LOCAL - tau;
  let lo = PSI0;
  let hi = PSI0 + 40 * D2R;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (armAngle(m) > target) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2 - PSI0;
}

const G_END = pushG(T_PUSH1);

/** 한 바퀴 안에서 D 의 이동각 g(τ) 와 레버 진행도 u */
function gOf(tau: number): number {
  if (tau <= T_PUSH0) return 0;
  if (tau < T_PUSH1) return Math.min(pushG(tau), STEP);
  if (tau < T_FIN1) {
    const s = (tau - T_PUSH1) / (T_FIN1 - T_PUSH1);
    const h = T_FIN1 - T_PUSH1;
    const v0 = (pushG(T_PUSH1) - pushG(T_PUSH1 - 1e-3)) / 1e-3; // 접촉 끝 속도(rad/τ)
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * G_END + (s3 - 2 * s2 + s) * h * v0 + (-2 * s3 + 3 * s2) * STEP;
  }
  return STEP;
}

export default function buildM065(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const diskC = notchedDisk(R, { center: 15 * D2R, flat: 18 * D2R, ramp: 12 * D2R, depth: 0.13 }, { width: 0.16, spokes: 5, driver: true });
  diskC.name = 'diskC';
  diskC.position.set(CC[0], CC[1], 0.18);
  g.add(diskC);

  const diskD = studDisk(R, NS, RING, RHO, { width: 0.06, spokes: 5, studHeight: 0.24 });
  diskD.name = 'diskD';
  diskD.position.set(DC[0], DC[1], 0.13);
  g.add(diskD);

  g.add(shaftZ(CC[0], CC[1], 0.45, 0.05), shaftZ(DC[0], DC[1], 0.45, 0.05));

  // 탭핏: C 의 자식, 로컬 각 87.741°
  const arm = tappetArm(1.25, TIP, 0.06, HUB);
  arm.name = 'tappetA';
  arm.rotation.z = ARM_LOCAL;
  arm.position.z = 0.30 - 0.18;
  diskC.add(arm);
  setMM(arm, { kind: 'part', role: 'tappet' });

  // 정지 레버
  const lever = new THREE.Group();
  lever.name = 'stopLever65';
  lever.position.set(P[0], P[1], 0.2);
  lever.add(
    stopLever({
      tail: [-0.84, -0.043],
      stemEnd: [0.91, -0.11],
      noseTip: [0.91, 0.13],
      noseBase: [0.91, -0.03],
      tipHalf: 0.03,
      baseHalf: 0.307,
      halfW: 0.035,
      thick: 0.06
    })
  );
  g.add(lever);
  g.add(shaftZ(P[0], P[1], 0.32, 0.04));

  const aC = rotArrow(0.55, false);
  aC.position.set(CC[0], CC[1], 0.4);
  const aD = rotArrow(0.45, true);
  aD.position.set(DC[0], DC[1], 0.42);
  g.add(aC, aD);
  g.add(
    tag('구동 바퀴 C (홈)', new THREE.Vector3(-0.95, 3.05, 0.5)),
    tag('탭핏 A', new THREE.Vector3(0.0, 2.75, 0.5)),
    tag('스터드 바퀴 D (10개)', new THREE.Vector3(0.95, 3.05, 0.5)),
    tag('정지 레버', new THREE.Vector3(0.3, 0.8, 0.5))
  );

  let phase = '쉬는 중';
  let steps = 0;
  let tilt = 0;

  return {
    group: g,
    view: { pos: [0, 2.0, 6.0], target: [0, 1.9, 0.2] },
    notes: () => [
      { label: '지금 단계', value: phase },
      { label: 'D 가 나아간 칸 수', value: steps.toFixed(2) },
      { label: '속도비', value: 'C 한 바퀴에 D 는 한 칸(1/10 바퀴)' },
      { label: '정지 레버 기울기', value: `${tilt.toFixed(1)}°` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      const n = Math.floor(theta / TAU);
      const tau = theta - n * TAU;
      const gg = gOf(tau);
      diskC.rotation.z = -theta;
      diskD.rotation.z = PSI0 + n * STEP + gg;
      const u = tau > T_PUSH0 && tau < T_FIN1 ? gg / STEP : 0;
      const lam = -0.14 * Math.sin(Math.PI * u);
      lever.rotation.z = lam;
      phase = tau > T_PUSH0 && tau < T_PUSH1 ? '탭핏이 미는 중' : tau >= T_PUSH1 && tau < T_FIN1 ? '마저 도는 중' : '쉬는 중';
      steps = n + gg / STEP;
      tilt = lam / D2R;
    }
  };
}
