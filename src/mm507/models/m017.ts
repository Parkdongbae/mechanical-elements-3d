// 017 스페인 바턴 (2) — 줄 P(들보→M 밑→A 위→B 눈)와 줄 Q(M 눈→B 위→자유 끝).
// Q 가 비스듬히 매여 이득은 위치에 따라 4배 근처에서 조금 변한다 (판화 17번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, arcPoints, ceilingBeam, displayStand, pulleyBlock, ropeEnd, rotArrow, rod, tag, weight } from '../kit';

const R = 0.2; // 도르래 반지름 (셋 같음)
// 줄이 바퀴 홈 가운데에 앉도록 블록 z 를 줄마다 맞춘다(예전: 블록 0.22, 줄 0.19/0.25 → 홈 가장자리에 걸침).
// 줄 P 가 감는 M·A 는 z 0.16, 줄 Q 가 감는 B 는 z 0.28 — 둘 사이 0.12 라 엇갈리는 곳에서도 서로 안 닿는다.
const ZP = 0.16; // 줄 P 높이 = M·A 블록 중심 z
const ZQ = 0.28; // 줄 Q 높이 = B 블록 중심 z
const EYE = R + 0.06; // 눈고리 중심 = 바퀴 중심에서 0.26 위
type V2 = [number, number];
const AX: V2 = [0.1, 2.55]; // A 고정 도르래 중심
const MX = -0.3; // M 중심 x
const BX = 0.3; // B 중심 x
const HOOK_M: V2 = [-0.5, 2.94]; // 왼쪽 들보 고리 아랫점 (줄 P 시작)
const ZH = 0.22; // 들보 고리 z (ceilingBeam 고정값)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 줄 P: 고리 → M 왼쪽 → M 밑 → M 오른쪽 → A 왼쪽 → A 위 → A 오른쪽 → B 윗 눈 */
function pathP(yM: number, yB: number): THREE.Vector3[] {
  return [
    v(HOOK_M[0], HOOK_M[1], ZH), // 고리(z 0.22) → M 왼쪽(z 0.16)으로 내려오며 z 를 옮긴다
    v(HOOK_M[0], yM, ZP),
    ...arcPoints([MX, yM], R, Math.PI, 2 * Math.PI, ZP),
    v(MX + R, yM, ZP),
    v(MX + R, AX[1], ZP),
    ...arcPoints(AX, R, Math.PI, 0, ZP),
    v(BX, AX[1], ZP),
    v(BX, yB + EYE, ZQ) // B 윗 눈(B 블록 z) — 내려오며 z 0.16 → 0.28
  ];
}

/** B 위를 넘는 줄 Q 가 M 윗 눈 e 에서 B 에 닿는 접점 각(시계 감김의 시작각, 0~2π) */
function tangentQ(yM: number, yB: number): number {
  const ex = MX - BX;
  const ey = yM + EYE - yB;
  const d = Math.hypot(ex, ey);
  let a = Math.atan2(ey, ex) - Math.acos(Math.min(1, R / d)); // 위쪽 접점(시계로 감기는 쪽)
  while (a < 0) a += 2 * Math.PI;
  while (a > 2 * Math.PI) a -= 2 * Math.PI;
  return a;
}

/** 줄 Q 의 자유 구간을 뺀 길이: 접선 구간 + B 위 접촉 호(접점 → 오른쪽 끝점) */
function lenQ(yM: number, yB: number): number {
  const d = Math.hypot(MX - BX, yM + EYE - yB);
  return Math.sqrt(Math.max(0, d * d - R * R)) + R * tangentQ(yM, yB);
}
const LQ0 = lenQ(0.92, 2.0) + 0.25; // 줄 Q 전체 길이(처음 자유 구간 0.25) — 일정

/** 줄 Q: M 윗 눈 → B 접점(접선으로 들어옴) → B 위 접촉 호 → B 오른쪽 끝점 → 자유 끝(접선으로 내려감) */
function pathQ(yM: number, yB: number, yF: number): THREE.Vector3[] {
  return [
    v(MX, yM + EYE, ZP), // M 윗 눈(M 블록 z) — B 접점까지 z 0.16 → 0.28
    ...arcPoints([BX, yB], R, tangentQ(yM, yB), 0, ZQ),
    v(BX + R, yF, ZQ)
  ];
}

export default function buildM017(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let hNow = 0; // notes 용 현재 당김 높이
  let yFNow = 1.75; // notes 용 현재 자유 끝 높이

  g.add(displayStand());
  g.add(ceilingBeam(-0.9, 0.9, 3.0, [-0.5, 0.1]));

  // A 고정 도르래 — 윗 눈과 들보 고리를 rod 로 연결 (고정)
  const blockA = pulleyBlock(R, { hookUp: 0.06 });
  blockA.position.set(AX[0], AX[1], ZP);
  g.add(blockA);
  g.add(rod(v(AX[0], AX[1] + EYE, ZP), v(AX[0], 2.94, ZH), 0.008));
  const sheaveA = blockA.userData.sheave as THREE.Group;

  // M 움직도르래 + 추 — 한 조로 같이 오르내린다
  const mAsm = new THREE.Group();
  const blockM = pulleyBlock(R, { hookUp: 0.06, hookDown: 0.06 });
  mAsm.add(blockM);
  const sheaveM = blockM.userData.sheave as THREE.Group;
  mAsm.add(rod(v(0, -EYE, 0), v(0, -0.36, 0), 0.008)); // M 아랫 눈 → 추 윗면
  const load = weight(0.44, 0.3);
  load.position.set(0, -0.51, 0);
  mAsm.add(load);
  g.add(mAsm);

  // B 움직도르래 — 줄 P 끝(윗 눈)에 매달림
  const blockB = pulleyBlock(R, { hookUp: 0.06 });
  g.add(blockB);
  const sheaveB = blockB.userData.sheave as THREE.Group;

  // 줄 2가닥 + 자유 끝 손잡이
  const ropeP = new Rope(0.014);
  const ropeQ = new Rope(0.014);
  g.add(ropeP.group, ropeQ.group);
  const knob = ropeEnd();
  g.add(knob);

  // 회전 방향 화살표(A 는 시계) + 이름표(부품에 붙여 따라감)
  const arrow = rotArrow(0.3, false);
  arrow.position.set(AX[0], AX[1], 0.4);
  g.add(arrow);
  const tagA = tag('A 고정 도르래', v(0, 0, 0));
  tagA.position.set(AX[0] + R + 0.35, AX[1], 0.35);
  g.add(tagA);
  blockB.add(tag('B 움직도르래', v(R + 0.35, 0, 0.13)));
  mAsm.add(tag('M 움직도르래', v(-(R + 0.35), 0, 0.13)));
  mAsm.add(tag('추', v(-0.57, -0.51, 0.13)));
  knob.add(tag('당기는 곳', v(0.35, -0.18, 0.1)));

  /** theta 에서 모든 부품의 절대 자세를 다시 계산 */
  const setPose = (th: number): void => {
    const p = (1 - Math.cos(th * 0.5)) / 2; // 당김 위상 0~1
    const h = 0.25 * p;
    const yM = 0.92 + h;
    const yB = 2.0 - 2 * h; // 줄 P 일정 길이: M 이 h 오르면 B 는 2h 내려온다
    const free = LQ0 - lenQ(yM, yB); // 줄 Q 일정 길이 → 자유 구간 길이
    const yF = yB - free; // 자유 끝 높이
    hNow = h;
    yFNow = yF;
    // 도르래 각 (반시계 +)
    sheaveA.rotation.z = (-2 * h) / R; // A 왼쪽 줄이 2h 올라감 → 시계
    sheaveM.rotation.z = h / R; // M 밑에서 줄이 왼→오른 → 반시계
    sheaveB.rotation.z = (free - 0.25) / -R; // 자유 구간이 늘면 오른쪽 가닥이 내려감 → 시계
    mAsm.position.set(MX, yM, ZP);
    blockB.position.set(BX, yB, ZQ);
    knob.position.set(BX + R, yF, ZQ);
    ropeP.setPath(pathP(yM, yB));
    ropeQ.setPath(pathQ(yM, yB, yF));
  };
  setPose(0);

  return {
    group: g,
    notes: () => {
      const up = 1.75 - yFNow;
      return [
        { label: '이득', value: hNow > 0.01 ? (up / hNow).toFixed(1) + '배' : '—' },
        { label: '당긴 줄 : 오른 높이', value: up.toFixed(2) + ' : ' + hNow.toFixed(2) },
        { label: '줄', value: '두 가닥(P, Q)' }
      ];
    },
    update(dt: number, speed: number): void {
      // 누적 각도에서 절대 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      setPose(theta);
    }
  };
}
