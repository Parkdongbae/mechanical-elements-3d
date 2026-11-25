// 번호 전용 키트 (507 · 176번) — 기관 분리 장치: 크랭크 팔(홈 고리 달림), 구동 크랭크(손목 핀), 맞물림·풀림 식
import * as THREE from 'three';
import { brass, castIron, steel, darkSteel } from '../../models/materials';
import { annularSector, extrude, mesh } from '../../models/parts/geom';
import { setMM } from './mm';

export const K176 = {
  O: [0, 1.65] as [number, number], // 축(고정)
  L: 1.24, // 축 ↔ 고리 중심
  ringR: 0.36,
  ringIn: 0.17,
  bossR: 0.155,
  pinR: 0.03,
  hubR: 0.3,
  bore: 0.056,
  phi0: -0.35, // 핀 각 = theta + phi0
  tNotch: 0.31, // 홈 반각(rad, 고리 중심 기준)
  zArm1: 0.06,
  zRing0: 0.062,
  zRingMid: 0.1,
  zRing1: 0.14,
  zPin0: 0.105,
  zDrv0: 0.2,
  zDrv1: 0.26,
  openW: 0.6 // 열림·닫힘에 드는 theta 폭
} as const;

/** 핀이 고리 바깥에 닿을 때 팔과 핀의 각 차(두 점 거리 = R + r + 0.003 인 현) */
export const DELTA176: number = 2 * Math.asin((K176.ringR + K176.pinR + 0.003) / (2 * K176.L));

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface Pose176 {
  pin: number; // 구동 핀 각
  arm: number; // 팔 방향각(축 → 고리)
  psi: number; // 고리의 홈 방향 − 팔 방향 (0 = 막힘, π/2 = 열림)
  coupled: boolean;
}

/** theta → 자세. 한 주기 6π: 맞물림 → 홈이 열려 핀이 지나감(팔 정지) → 홈이 닫혀 핀이 다시 팔을 잡음 */
export function pose176(theta: number): Pose176 {
  const P = 6 * Math.PI;
  const n = Math.floor(theta / P);
  const u = theta - P * n;
  const W = K176.openW;
  const a = u < W ? W + DELTA176 : u <= 4 * Math.PI + W ? u + DELTA176 : 4 * Math.PI + W + DELTA176;
  const psi = (Math.PI / 2) * (smooth((u - 4 * Math.PI) / W) - smooth((u - 5 * Math.PI) / W));
  const coupled = u >= W && u <= 4 * Math.PI + W;
  return { pin: theta + K176.phi0, arm: 4 * Math.PI * n + a + K176.phi0, psi, coupled };
}

/** 크랭크 팔(받는 쪽): 원점 = 축, 로컬 +Y 가 고리 쪽. 허브 + 사다리꼴 판 + 끝 보스. z 0~0.06 (보스는 0~0.10) */
export function crankArm176(): THREE.Group {
  const g = new THREE.Group();
  const hub = new THREE.Shape();
  hub.absarc(0, 0, K176.hubR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, K176.bore, 0, Math.PI * 2, true);
  hub.holes.push(hole);
  const hubM = mesh(extrude(hub, K176.zArm1, 0.004, 48), castIron());
  hubM.position.z = K176.zArm1 / 2;
  g.add(hubM);
  const plate = new THREE.Shape();
  plate.moveTo(-0.25, 0.05);
  plate.lineTo(0.25, 0.05);
  plate.lineTo(0.1, K176.L);
  plate.lineTo(-0.1, K176.L);
  plate.closePath();
  const pl = mesh(extrude(plate, K176.zArm1, 0.004), castIron());
  pl.position.z = K176.zArm1 / 2;
  g.add(pl);
  const boss = new THREE.CylinderGeometry(K176.bossR, K176.bossR, 0.1, 40);
  boss.rotateX(Math.PI / 2);
  const bm = mesh(boss, darkSteel());
  bm.position.set(0, K176.L, 0.05);
  g.add(bm);
  setMM(g, { kind: 'arm', length: K176.L });
  return g;
}

/** 홈 있는 고리: 원점 = 중심, 홈 방향 = 로컬 ±X. 바닥 고리(z 0.062~0.10, 온 둘레) + 위 두 호(z 0.10~0.14, 홈이 틈) */
export function notchRing176(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Shape();
  base.absarc(0, 0, K176.ringR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, K176.ringIn, 0, Math.PI * 2, true);
  base.holes.push(hole);
  const b = mesh(extrude(base, K176.zRingMid - K176.zRing0, 0.003, 48), brass());
  b.position.z = (K176.zRing0 + K176.zRingMid) / 2;
  g.add(b);
  const t = K176.tNotch;
  for (const [a0, a1] of [
    [t, Math.PI - t],
    [Math.PI + t, 2 * Math.PI - t]
  ] as const) {
    const arc = mesh(extrude(annularSector(K176.ringIn, K176.ringR, a0, a1), K176.zRing1 - K176.zRingMid, 0.003, 32), brass());
    arc.position.z = (K176.zRingMid + K176.zRing1) / 2;
    g.add(arc);
  }
  setMM(g, { kind: 'ring', r: K176.ringR });
  return g;
}

/** 구동 크랭크(그림에 없음): 원점 = 축, +X 로 L, 끝에 앞→뒤로 내려가는 손목 핀. 막대는 z 0.20~0.26 */
export function driverCrank176(): THREE.Group {
  const g = new THREE.Group();
  const hubG = new THREE.CylinderGeometry(0.12, 0.12, K176.zDrv1 - K176.zDrv0, 32);
  hubG.rotateX(Math.PI / 2);
  const hub = mesh(hubG, steel());
  hub.position.z = (K176.zDrv0 + K176.zDrv1) / 2;
  g.add(hub);
  const bar = mesh(new THREE.BoxGeometry(K176.L, 0.1, K176.zDrv1 - K176.zDrv0), steel());
  bar.position.set(K176.L / 2, 0, (K176.zDrv0 + K176.zDrv1) / 2);
  g.add(bar);
  const pg = new THREE.CylinderGeometry(K176.pinR, K176.pinR, K176.zDrv0 - K176.zPin0 + 0.01, 20);
  pg.rotateX(Math.PI / 2);
  const pin = mesh(pg, darkSteel());
  pin.name = 'pin';
  pin.position.set(K176.L, 0, (K176.zPin0 + K176.zDrv0 + 0.01) / 2);
  g.add(pin);
  setMM(g, { kind: 'crank', length: K176.L });
  return g;
}
