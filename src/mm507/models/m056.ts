// 056 선반 변속 레버 — 레버를 누르면 받침점에 대해 치우친(편심) 원호 홈이 큰 바퀴 축 핀을 왼쪽으로 끌어
// 큰 바퀴가 피니언에서 풀린다. 레버를 올리면 다시 물린다 (판화 56번, 설계표 docs/mm507-sheets/056.md)
// 받침점 F · 큰 바퀴 축 W · 주축 P 가 한 수평선 y = 1.50 위. 피니언은 쉬지 않고 돌고, 큰 바퀴만 시간표대로 돌다 선다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { darkSteel, wood } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { displayStand, lever, markPin, meshAngle, rod, rotArrow, setMM, shaftZ, spurGear, steppedPulley, tag, type V2 } from '../kit';
import { arcSlotLeverPlate, framePlate } from '../kit/k056';

const MOD = 0.04;
const NW = 48; // 큰 바퀴 잇수 — 피치 반지름 0.96
const NP = 14; // 피니언 잇수 — 0.28
const Y0 = 1.5; // 한 수평선
const W0: V2 = [-0.4, Y0]; // 맞물렸을 때 큰 바퀴 중심
const P: V2 = [0.84, Y0]; // 주축(피니언·단차 풀리) — 중심 거리 1.24
const F: V2 = [-0.84, Y0]; // 레버 받침점(프레임 팔 위)
const GZ = 0.12; // 기어 z
const S_MAX = 0.17; // 큰 바퀴가 물러나는 거리

// 레버 판의 원호 홈(레버 로컬, 원점 = 받침점)
const CS: V2 = [0.1601, 0.0613];
const SLOT_R = 0.2865;
const E = Math.hypot(CS[0], CS[1]); // 편심 0.1714
const RHO0 = W0[0] - F[0]; // 받침점–핀 거리(맞물림) 0.44

// 시간표(구동각 기준, 주기 8 rad)
const PERIOD = 8;
const T_OUT0 = 1.9; // 풀림 이동 시작
const T_IN0 = 5.0703; // 다시 맞물림 이동 시작
const T_MOVE = 0.7;
const S_CUT = 0.09; // 이끝이 벗어나는 자리(0.08)에 여유 — 여기서 큰 바퀴 구동을 끊는다
const smooth = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
// f(x) = 0.09/0.17 의 역: x²(3−2x) = k 를 이분법으로
const fInv = (k: number): number => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (smooth(m) < k) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};
const T0 = T_OUT0 + T_MOVE * fInv(S_CUT / S_MAX); // 큰 바퀴 정지 시작 ≈ 2.2643
const STOP = Math.PI; // 정지 길이 = 피니언 7피치(정지 끝 ≈ 5.4060)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 구동각 τ(주기 안)에서 큰 바퀴가 물러난 거리 */
function slideAt(tau: number): number {
  if (tau < T_OUT0) return 0;
  if (tau < T_OUT0 + T_MOVE) return S_MAX * smooth((tau - T_OUT0) / T_MOVE);
  if (tau < T_IN0) return S_MAX;
  if (tau < T_IN0 + T_MOVE) return S_MAX * (1 - smooth((tau - T_IN0) / T_MOVE));
  return 0;
}

const kOf = (rho: number): number => (rho * rho + E * E - SLOT_R * SLOT_R) / (2 * rho * E);
const PSI0 = Math.acos(kOf(RHO0));
/** 핀이 s 만큼 물러났을 때 레버 각(반시계 +) — 핀이 늘 원호 홈 중심선 위 */
function psiOf(s: number): number {
  return Math.acos(Math.min(1, Math.max(-1, kOf(RHO0 - s)))) - PSI0;
}

/** 큰 바퀴가 실제로 따라간 구동각(정지 구간을 뺀 값) */
function effAngle(theta: number): number {
  const n = Math.floor(theta / PERIOD);
  const tau = theta - n * PERIOD;
  const cur = tau < T0 ? 0 : tau <= T0 + STOP ? tau - T0 : STOP;
  return theta - n * STOP - cur;
}

export default function buildM056(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // ── 주축: 피니언(구동) + 뒤의 3단 단차 풀리 ──
  g.add(shaftZ(P[0], P[1], 0.45, 0.04));
  const pinion = spurGear(NP, MOD, { width: 0.14, spokes: 4, driver: true });
  pinion.name = 'pinion';
  pinion.position.set(P[0], P[1], GZ);
  const cone = new THREE.Group();
  cone.name = 'conePulley';
  cone.position.set(P[0], P[1], -0.1);
  cone.add(steppedPulley([0.9, 0.72, 0.54], 0.08));
  // 단차 풀리 허브 구멍(0.086)과 축(0.04) 사이를 메우는 끼움 통
  const coneSleeve = lathe(tubeProfile(0.04, 0.088, -0.13, 0.13, 0.006), 32);
  coneSleeve.rotateX(Math.PI / 2);
  cone.add(mesh(coneSleeve, darkSteel()));
  g.add(pinion, cone);

  // ── 큰 바퀴(미끄러지는 축) ──
  const big = spurGear(NW, MOD, { width: 0.12, spokes: 6 });
  big.name = 'bigGear';
  g.add(big);
  // 수레: 축 핀·끼움 통·와셔·화살표·이름표가 큰 바퀴 중심을 따라 좌우로 옮겨 간다(돌지 않음)
  const cart = new THREE.Group();
  cart.name = 'bigGearAxle';
  const pin = rod(v(0, 0, -0.02), v(0, 0, 0.34), 0.03);
  pin.name = 'axlePin';
  markPin(pin, [0, 0, 0]);
  cart.add(pin);
  // 큰 바퀴 허브 구멍(0.134)을 메우는 끼움 통 — 핀과 바퀴를 잇는다
  const sleeve = lathe(tubeProfile(0.03, 0.136, GZ - 0.075, GZ + 0.075, 0.008), 40);
  sleeve.rotateX(Math.PI / 2);
  cart.add(mesh(sleeve, darkSteel()));
  // 핀 앞 끝 와셔(홈 반폭 0.036 보다 커서 레버 판을 붙든다)
  const washer = lathe(tubeProfile(0.0, 0.055, 0.3235, 0.34, 0.004), 28);
  washer.rotateX(Math.PI / 2);
  cart.add(mesh(washer, darkSteel()));
  const bigArrow = rotArrow(0.55, false);
  bigArrow.position.z = 0.2;
  cart.add(bigArrow);
  cart.add(tag('큰 바퀴(48)', v(-1.45 - W0[0], 2.55 - Y0, 0.3)));
  g.add(cart);

  // ── 앞 프레임(주철): 받침 발 + 기둥 + 왼쪽 팔(받침점 + 가로 안내 홈) ──
  const outline: V2[] = [
    [-0.3, 0.18], [0.36, 0.18], [0.36, 0.3], [0.16, 0.3], [0.16, 1.66],
    [-1.02, 1.66], [-1.02, 1.34], [-0.1, 1.34], [-0.1, 0.3], [-0.3, 0.3]
  ];
  const frame = framePlate(outline, [{ a: [-0.585, Y0], b: [-0.385, Y0], r: 0.036 }], 0.05);
  frame.name = 'frame';
  frame.position.z = 0.24;
  g.add(frame);

  // ── 변속 레버: 원호 홈 판 + 위로 선 손잡이(한 몸) ──
  const lv = new THREE.Group();
  lv.name = 'lever';
  lv.position.set(F[0], F[1], 0);
  const a0 = Math.atan2(0 - CS[1], RHO0 - CS[0]); // 맞물림 끝 A(0.44, 0) ≈ −0.2157
  const a1 = -1.6062; // 풀림 끝 B ≈ (0.150, −0.225)
  const plate = arcSlotLeverPlate(CS, SLOT_R, a0, a1, { pivotR: 0.13, edgeR: 0.1, slotR: 0.036 });
  plate.name = 'leverPlate';
  plate.position.z = 0.3;
  setMM(plate, { kind: 'slotPlate', slotCenter: [CS[0], CS[1], 0], slotR: SLOT_R });
  lv.add(plate);
  const bar = lever(1.45);
  bar.rotation.z = Math.PI / 2; // 막대 방향 +Y
  bar.position.z = 0.345;
  const knob = mesh(new THREE.SphereGeometry(0.045, 20, 14), wood());
  knob.position.set(1.45, 0, 0);
  bar.add(knob);
  lv.add(bar);
  // 손잡이에서 0.35 비켜 둔다 — 레버가 56° 넘어가도 기운 막대가 글자판을 가로지르지 않게
  lv.add(tag('변속 레버', v(0.35, 0.8, 0.4)));
  g.add(lv);

  // ── 화살표·이름표 ──
  const pArrow = rotArrow(0.2, true);
  pArrow.position.set(P[0], P[1], 0.28);
  g.add(pArrow);
  g.add(
    tag('피니언 14(구동)', v(0.6, 2.05, 0.35)),
    tag('단차 풀리', v(1.55, 0.55, 0.2)),
    tag('치우친 홈', v(-0.55, 1.12, 0.45))
  );

  let s = 0;
  let psi = 0;
  let state = '맞물림';
  const pose = (): void => {
    const n = Math.floor(theta / PERIOD);
    const tau = theta - n * PERIOD;
    s = slideAt(tau);
    psi = psiOf(s);
    state = s <= 1e-6 ? '맞물림' : s >= S_MAX - 1e-6 ? '풀림' : '풀림 이동';
    const wx = W0[0] - s;
    big.position.set(wx, Y0, GZ);
    cart.position.set(wx, Y0, 0);
    big.rotation.z = meshAngle(P, NP, effAngle(theta), W0, NW);
    pinion.rotation.z = theta;
    cone.rotation.z = theta;
    lv.rotation.z = psi;
  };
  pose();

  return {
    group: g,
    view: { pos: [0.1, 1.75, 6.3], target: [-0.1, 1.6, 0.1] },
    notes: () => [
      { label: '상태', value: state },
      { label: '바퀴 물러난 거리 s', value: s.toFixed(3) },
      { label: '레버 기울기 ψ', value: `${((psi * 180) / Math.PI).toFixed(1)}°` },
      { label: '바퀴 속도비', value: s < S_CUT ? `${(-NP / NW).toFixed(2)} (맞물림)` : '0 (풀림)' },
      { label: '홈 편심', value: E.toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
