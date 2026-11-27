// 222 편심 중심 기어 — 보통 평기어 C 가 편심 축 D 둘레를 몸째 돌고(구동),
// 팔(A 중심↔피니언 B 중심, 1.05)과 링크(B 중심↔C 의 기어 중심, 1.05) 두 막대가
// 피니언 B 의 중심 자리를 정해 A·C 둘 다와 늘 알맞은 깊이로 물린다(홈 대신 링크).
// 설계표 docs/mm507-sheets/222.md 그대로. 물림 위상은 동작 3 의 mesh2 식을 직접 쓴다.
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { circleIntersect, displayStand, leaderTo, rotArrow, shaftZ, spurGear, tag, type V2 } from '../kit';
import { darkSteel, paint, steel } from '../../models/materials';

const PI = Math.PI;
const TAU = 2 * PI;
const MOD = 0.05; // 모듈 (세 기어 공통)
/** 기어 구멍(spurGear 의 bore = max(0.024, rp×0.14))과 그 속 축·핀 사이를 채우는 부싱 — 구멍이 비어 보이던 것(2026-11-27 사용자 지적) */
function bushing(teeth: number, rIn: number): THREE.Mesh {
  const bore = Math.max(0.024, ((teeth * MOD) / 2) * 0.14);
  const h = 0.07; // 허브(±0.068)보다 0.002 길게 — 끝면이 허브 끝면과 겹쳐 깜빡이지 않게
  const pts = [new THREE.Vector2(rIn, -h), new THREE.Vector2(bore + 0.001, -h), new THREE.Vector2(bore + 0.001, h), new THREE.Vector2(rIn, h), new THREE.Vector2(rIn, -h)];
  const geo = new THREE.LatheGeometry(pts, 32).rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, steel({ roughness: 0.3 }));
  m.castShadow = true;
  return m;
}
const D: V2 = [0.45, 1.15]; // 편심 축 D
const A: V2 = [-0.5935, 2.3892]; // 바퀴 A 중심 (D 에서 130.1° 방향 1.62)
const E = 0.25; // 편심 거리 (기어 중심 Cc 가 D 둘레로 도는 반지름)
const LAB = 1.05; // 팔 길이 = A 중심 ↔ B 중심 (rp 0.60 + 0.45)
const LBC = 1.05; // 링크 길이 = B 중심 ↔ C 의 기어 중심
const OM_C = 0.4; // 구동 기어 C 각속도 rad/s (반시계, 한 바퀴 15.708 초)
const B0: V2 = [0.4324, 2.1653]; // t=0 의 B 해 (circleIntersect 가 실패할 일 없음의 보험값)

/** 물림 위상 (설계표 동작 3) — 키트 meshAngle 은 a 가 ±180° 를 지날 때 튀므로 a 를 [0,2π) 로 정규화한 식 */
function mesh2(c1: V2, z1: number, th1: number, c2: V2, z2: number): number {
  let a = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
  if (a < 0) a += TAU;
  const s1 = TAU / z1;
  const s2 = TAU / z2;
  return a + PI - s2 - (s2 / s1) * (th1 + s1 / 2 - a);
}

/** t 에서의 모든 자세 — 절대 계산(역회전·누적 오차 없음) */
function state(tt: number) {
  const thC = OM_C * tt;
  const cc: V2 = [D[0] + E * Math.cos(thC), D[1] + E * Math.sin(thC)]; // C 의 기어 중심
  const b = circleIntersect(A, LAB, cc, LBC, true) ?? B0; // A→Cc 기준 왼쪽(오른쪽 위) 해
  const psiB = mesh2(cc, 24, thC, b, 18);
  const psiA = mesh2(b, 18, psiB, A, 24);
  const alpha = Math.atan2(b[1] - A[1], b[0] - A[0]);
  const gamma = Math.atan2(b[1] - cc[1], b[0] - cc[0]);
  return { thC, cc, b, psiB, psiA, alpha, gamma };
}

export default function buildM222(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 바퀴 A (출력) + 빨간 표시 막대 + 축 A ──
  const wheelA = new THREE.Group();
  wheelA.name = 'wheelA';
  wheelA.position.set(A[0], A[1], 0.05);
  wheelA.add(spurGear(24, MOD, { width: 0.1, spokes: 5 }), bushing(24, 0.04));
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.008), paint(0xd8362f));
  bar.position.set(0.3, 0, 0.054);
  bar.castShadow = true;
  wheelA.add(bar);
  g.add(wheelA);
  const shaftA = shaftZ(A[0], A[1], 0.21, 0.04); // 너트 0.19~0.21 이 팔 앞을 막음
  shaftA.name = 'shaftA';
  g.add(shaftA);

  // ── 구동 기어 C (편심 그룹: 몸 통째로 D 둘레를 돎) ──
  const gearC = new THREE.Group();
  gearC.name = 'gearC';
  gearC.position.set(D[0] + E, D[1], 0.05); // t=0: Cc 가 D 의 바로 오른쪽(판화 자세)
  gearC.add(spurGear(24, MOD, { width: 0.1, spokes: 5, driver: true }), bushing(24, 0.03));
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.104, 32).rotateX(PI / 2), darkSteel());
  boss.position.set(-E, 0, 0); // 로컬 (−0.25, 0) 이 늘 D 에 온다
  boss.castShadow = true;
  gearC.add(boss);
  const cPin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 20).rotateX(PI / 2), steel());
  cPin.position.set(0, 0, 0.11); // 세계 z 0.06 ~ 0.26
  cPin.castShadow = true;
  gearC.add(cPin);
  const cPinHead = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 20).rotateX(PI / 2), steel());
  cPinHead.position.set(0, 0, 0.215);
  cPinHead.castShadow = true;
  gearC.add(cPinHead);
  g.add(gearC);

  // ── 편심 축 D (뒤판 고정) ──
  const shaftD = shaftZ(D[0], D[1], 0.13, 0.04); // 너트 끝 0.13 < 팔·링크 층 → 링크가 위로 지나가도 안 닿음
  shaftD.name = 'shaftD';
  g.add(shaftD);

  // ── 피니언 B + B 축 핀 (핀은 팔 보스·링크 보스 둘 다를 지남) ──
  const pinionB = spurGear(18, MOD, { width: 0.1, spokes: 4 });
  pinionB.name = 'pinionB';
  pinionB.add(bushing(18, 0.03));
  pinionB.position.set(B0[0], B0[1], 0.05);
  g.add(pinionB);
  const pinB = new THREE.Group();
  pinB.name = 'pinB';
  const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 20).rotateX(PI / 2), steel());
  pBody.position.set(0, 0, 0.13); // 세계 z 0 ~ 0.26
  pBody.castShadow = true;
  const pHead = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 20).rotateX(PI / 2), steel());
  pHead.position.set(0, 0, 0.265);
  pHead.castShadow = true;
  pinB.add(pBody, pHead);
  g.add(pinB);

  // ── 팔 (A 중심에서 B 중심으로, 축 A 앞쪽 z 0.15~0.19) ──
  const arm = new THREE.Group();
  arm.name = 'arm';
  arm.position.set(A[0], A[1], 0.17);
  const armBar = new THREE.Mesh(new THREE.BoxGeometry(LAB, 0.06, 0.04), steel({ roughness: 0.25 }));
  armBar.position.set(LAB / 2, 0, 0);
  armBar.castShadow = true;
  arm.add(armBar);
  const armBossGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 24).rotateX(PI / 2);
  for (const bx of [0, LAB]) {
    const b = new THREE.Mesh(armBossGeo, steel({ roughness: 0.25 }));
    b.position.set(bx, 0, 0);
    b.castShadow = true;
    arm.add(b);
  }
  g.add(arm);

  // ── 링크 (C 의 기어 중심에서 B 중심으로, z 0.20~0.24) ──
  const link = new THREE.Group();
  link.name = 'link';
  link.position.set(B0[0], B0[1], 0.22); // 초기 자세는 update 에서 다시 계산
  const linkBar = new THREE.Mesh(new THREE.BoxGeometry(LBC, 0.06, 0.04), steel());
  linkBar.position.set(LBC / 2, 0, 0);
  linkBar.castShadow = true;
  link.add(linkBar);
  const linkBossGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 24).rotateX(PI / 2);
  for (const bx of [0, LBC]) {
    const b = new THREE.Mesh(linkBossGeo, steel());
    b.position.set(bx, 0, 0);
    b.castShadow = true;
    link.add(b);
  }
  g.add(link);

  // ── 화살표 · 이름표 ──
  const arrow = rotArrow(0.3, true); // C 반시계
  arrow.position.set(D[0], D[1], 0.3);
  g.add(arrow);

  g.add(
    leaderTo(tag('바퀴(출력)', new THREE.Vector3(-1.9, 3.0, 0.5)), 'wheelA'),
    leaderTo(tag('피니언', new THREE.Vector3(1.6, 2.85, 0.5)), 'pinionB'),
    leaderTo(tag('구동 기어', new THREE.Vector3(1.95, 0.35, 0.5)), 'gearC'),
    leaderTo(tag('편심 축', new THREE.Vector3(-1.2, 0.7, 0.5)), 'shaftD'),
    leaderTo(tag('링크', new THREE.Vector3(1.75, 1.7, 0.5)), 'link'),
    leaderTo(tag('팔', new THREE.Vector3(-1.5, 1.4, 0.5)), 'arm')
  );

  let st = state(0);
  const apply = (): void => {
    st = state(t);
    gearC.position.set(st.cc[0], st.cc[1], 0.05);
    gearC.rotation.z = st.thC;
    pinionB.position.set(st.b[0], st.b[1], 0.05);
    pinionB.rotation.z = st.psiB;
    wheelA.rotation.z = st.psiA;
    arm.rotation.z = st.alpha;
    link.position.set(st.cc[0], st.cc[1], 0.22);
    link.rotation.z = st.gamma;
    pinB.position.set(st.b[0], st.b[1], 0);
  };
  apply();

  return {
    group: g,
    notes: () => {
      const h = 0.01; // 순간 빠르기 = 중앙 차분
      const s1 = state(t + h);
      const s0 = state(t - h);
      const r = (s1.psiA - s0.psiA) / (s1.thC - s0.thC);
      return [
        { label: '구동 기어 각', value: `${(((st.thC * 180) / PI) % 360).toFixed(0)}°` },
        { label: '바퀴 / 구동 빠르기', value: `${r.toFixed(2)}배 (0.34~1.66)` },
        { label: '원리', value: '기어 중심이 편심 축 둘레를 돌고, 링크가 피니언과의 거리를 늘 1.05 로 지킨다' }
      ];
    },
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [0, 1.75, 7.0], target: [0.05, 1.7, 0] }
  };
}
