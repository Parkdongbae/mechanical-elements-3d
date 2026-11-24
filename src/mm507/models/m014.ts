// 014 복활차(블록과 태클) — 한 가닥 줄이 위·아래 도르래 4개씩을 번갈아 감는다.
// 아래 블록이 d 오르면 자유단은 8d 내려온다(줄 가닥 수 8 = 힘의 이득 8배). (판화 14번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, pulley, rod, ropeAround, rotArrow, tag, type RopeCircle, type V2 } from '../kit';
import { castIron, darkSteel, steel, wood } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

// 줄 중심 반지름 — pulley(0.2, 폭 0.12) 의 V홈(입구 반폭 0.019, 꼭지 r≈0.173)에 지름 0.036 줄이
// 두 벽에 닿아 앉는 높이(0.204)에 0.001 여유. 0.22 이면 줄이 홈 위 림 가장자리에 얹혀 떠 보였다.
const RC = 0.205;
const ZC = 0.25; // 블록 축 z 중심
const XS = [-0.24, -0.08, 0.08, 0.24]; // 도르래 4개의 x (j = 0..3)
const Y_U = 2.55; // 위 블록(고정) 중심 y
const Y_L = 1.2; // 아래 블록 최저 중심 y
const X_E = 0.62; // 자유단 x
const Y_E = 2.05; // 자유단 최고 y (d = 0)
const Z_B = ZC - RC; // 뒤쪽 가닥의 z (도르래 뒤 접선)
// 묶는 점 — 위 블록 왼쪽 띠쇠를 아래로 늘인 끝의 눈(becket). 실제 복활차처럼 줄 끝을 블록 띠쇠에 맨다.
// (예전엔 U0 뒤 접점과 같은 자리라 줄 끝이 U0→L1 가닥과 겹쳤다.)
const BK_X = -0.375; // 띠쇠 옆판 x
const BK_Y = -0.33; // 눈 중심(블록 중심 기준 y)
const BK_R = 0.03; // 눈 반지름
const TIE: V2 = [ZC, Y_U + BK_Y - BK_R]; // (z, y) — 눈 아랫변
// 띠쇠(스트랩): 볼 바깥(x ±0.375)에서 축 끝을 잡고 도르래 밖을 돌아 고리 쪽 가로대로 이어진다
const SX = 0.375; // 옆 띠쇠 x
const SB = 0.32; // 가로대 중심까지 거리(블록 중심에서) — 줄(바닥 r 0.223)과 볼(0.26) 밖

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM014(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let dNow = 0; // notes() 가 읽는 현재 d

  g.add(displayStand());

  // 들보
  const beam = mesh(new THREE.BoxGeometry(1.9, 0.12, 0.65), castIron());
  beam.position.set(0.1, 3.07, 0.05);
  g.add(beam);

  /** 블록 껍데기: 양쪽 나무 볼 + 가운데 축 막대 (로컬 원점 = 블록 중심) */
  const shell = (): THREE.Group => {
    const s = new THREE.Group();
    for (const sx of [-1, 1]) {
      const cheek = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 32), wood());
      cheek.rotation.z = Math.PI / 2; // 원판 축 → X
      cheek.position.set(sx * 0.34, 0, ZC);
      s.add(cheek);
    }
    s.add(rod(v(-0.4, 0, ZC), v(0.4, 0, ZC), 0.03));
    return s;
  };

  /** 띠쇠: 축 양 끝을 잡는 옆판 2장 + 도르래 밖(dir=+1 위 / −1 아래)을 가로지르는 가로대 */
  const strap = (dir: 1 | -1): THREE.Group => {
    const s = new THREE.Group();
    const y0 = -dir * 0.05; // 축 너머까지 감싸 축 끝이 옆판을 꿴다
    const y1 = dir * (SB + 0.015);
    for (const sx of [-1, 1]) {
      const side = mesh(new THREE.BoxGeometry(0.02, Math.abs(y1 - y0), 0.07), castIron());
      side.position.set(sx * SX, (y0 + y1) / 2, ZC);
      s.add(side);
    }
    const bar = mesh(new THREE.BoxGeometry(2 * SX + 0.02, 0.03, 0.07), castIron());
    bar.position.set(0, dir * SB, ZC);
    s.add(bar);
    return s;
  };

  /** 도르래: rotation.y=π/2 감싸는 그룹(로컬 Z → 월드 X), 안쪽 풀리의 rotation.z 가 X축 회전 */
  const sheave = (x: number): { wrap: THREE.Group; inner: THREE.Group } => {
    const wrap = new THREE.Group();
    wrap.position.set(x, 0, ZC);
    wrap.rotation.y = Math.PI / 2;
    const inner = pulley(0.2, { width: 0.12, grooved: true, spokes: 4 });
    wrap.add(inner);
    return { wrap, inner };
  };

  // 위 블록 U — 위치 고정, 들보 아래 핀에 매달림
  const upper = new THREE.Group();
  upper.position.set(0, Y_U, 0);
  upper.add(shell());
  const uInner: THREE.Group[] = [];
  for (const x of XS) {
    const s = sheave(x);
    upper.add(s.wrap);
    uInner.push(s.inner);
  }
  upper.add(strap(1));
  // becket: 왼쪽 옆판을 축 아래로 늘이고 끝에 눈 — 줄의 묶는 끝(매듭)이 여기 걸린다
  const bkPlate = mesh(new THREE.BoxGeometry(0.02, -0.05 - (BK_Y + BK_R) + 0.005, 0.07), castIron());
  bkPlate.position.set(BK_X, (-0.05 + BK_Y + BK_R - 0.005) / 2, ZC);
  upper.add(bkPlate);
  const bkEye = mesh(new THREE.TorusGeometry(BK_R, 0.008, 10, 20), steel());
  bkEye.position.set(BK_X, BK_Y, ZC);
  upper.add(bkEye);
  const knot = mesh(new THREE.SphereGeometry(0.026, 14, 10), wood(0x8a6a3a));
  knot.position.set(BK_X, BK_Y - BK_R, ZC);
  upper.add(knot);
  upper.add(rod(v(0, SB, ZC), v(0, 0.392, ZC), 0.03)); // 위 가로대 → 고리
  const hookU = mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 24), steel());
  hookU.position.set(0, 0.44, ZC);
  upper.add(hookU);
  upper.add(rod(v(0, 0.44, ZC - 0.07), v(0, 0.44, ZC + 0.07), 0.012)); // 핀이 고리를 지난다
  g.add(upper);

  // 아래 블록 L — 매 프레임 y_L = 1.20 + d 로 다시 놓임
  const lower = new THREE.Group();
  lower.add(shell());
  const lInner: THREE.Group[] = [];
  for (const x of XS) {
    const s = sheave(x);
    lower.add(s.wrap);
    lInner.push(s.inner);
  }
  // 띠쇠 가로대 → 막대 → 블록 고리(XY 평면) ↔ 추 고리(YZ 평면, 사슬처럼 꿰임) → 공 추
  // 모두 lower 그룹 안이라 블록과 함께 움직인다
  lower.add(strap(-1));
  lower.add(rod(v(0, -SB, ZC), v(0, -0.452, ZC), 0.03)); // 가로대 → 고리 윗변
  const hookL = mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 24), steel());
  hookL.position.set(0, -0.5, ZC); // 관(tube) 윗변 y −0.45, 아랫변 −0.55
  lower.add(hookL);
  const hookB = mesh(new THREE.TorusGeometry(0.04, 0.01, 12, 24), steel());
  hookB.rotation.y = Math.PI / 2; // YZ 평면 — 블록 고리 아랫변(−0.55)이 이 고리 구멍(반경 0.03)을 지난다
  hookB.position.set(0, -0.565, ZC); // 윗변 −0.525 는 블록 고리 구멍 안, 아랫변 −0.605
  lower.add(hookB);
  lower.add(rod(v(0, -0.64, ZC), v(0, -0.6, ZC), 0.016)); // 추 머리의 눈 기둥 — 고리 아랫변을 잡는다
  const ball = mesh(new THREE.SphereGeometry(0.14, 24, 18), darkSteel()); // 공 모양 추
  ball.position.set(0, -0.75, ZC); // 꼭대기 −0.61 — 고리 아랫변에 닿음
  lower.add(ball);
  g.add(lower);

  // 회전 방향 화살표 — 블록 옆 x=0.5, YZ 평면에 눆 ((z,y) 반시계 표시)
  const arrowU = rotArrow(0.3, false);
  arrowU.position.set(0.5, Y_U, ZC);
  arrowU.rotation.y = Math.PI / 2;
  g.add(arrowU);
  const arrowL = rotArrow(0.3, false);
  arrowL.position.set(0.5, 0, ZC);
  arrowL.rotation.y = Math.PI / 2;
  lower.add(arrowL);

  // 이름표
  g.add(tag('위 블록(고정)', v(1.25, 2.9, 0.35)));
  lower.add(tag('아래 블록(움직)', v(1.0, 0.28, 0.3)));
  lower.add(tag('추', v(0.5, -0.85, 0.2)));

  // 줄 + 자유단 손잡이
  const rope = new Rope(0.018);
  g.add(rope.group);
  const hand = new THREE.Group();
  hand.position.set(X_E, Y_E, Z_B);
  hand.add(rod(v(0, 0, 0), v(0, -0.16, 0), 0.05));
  const knob = mesh(new THREE.SphereGeometry(0.06, 18, 14), wood(0x4a2f1d));
  knob.position.set(0, -0.16, 0);
  hand.add(knob);
  hand.add(tag('당기는 끝(8배 이동)', v(0.35, 0.18, 0.1)));
  g.add(hand);

  return {
    group: g,
    view: { pos: [1.3, 2.1, 5.8], target: [0, 1.7, 0] },
    notes: () => [
      { label: '줄 가닥 수(아래 블록)', value: '8' },
      { label: '힘의 이득', value: '8배 (힘 1/8)' },
      { label: '추 올라간 높이', value: dNow.toFixed(2) },
      { label: '당긴 줄 길이', value: (8 * dNow).toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도에서 전체 자세를 다시 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      const d = 0.1 * (1 - Math.cos(0.5 * theta)); // 아래 블록 올림 0~0.2
      dNow = d;
      const yL = Y_L + d;
      lower.position.y = yL;
      hand.position.y = Y_E - 8 * d; // 자유단은 8배 이동 (0.45~2.05)
      // 헐거운 도르래들: 가닥 속도 0→2d→…→8d 에 따라 각기 다른 배율 ((z,y) 반시계 → X축 음의 회전)
      for (let j = 0; j < 4; j++) {
        uInner[j]!.rotation.z = -((2 * j + 2) * d) / RC; // 위: 2,4,6,8배
        lInner[j]!.rotation.z = -((2 * j + 1) * d) / RC; // 아래: 1,3,5,7배
      }
      // 줄: 묶는 점 → L0,U0,L1,U1,L2,U2,L3,U3 → 자유단 (map: (z,y,x) → 월드 (x,y,z))
      const circles: RopeCircle[] = [];
      for (let j = 0; j < 4; j++) {
        circles.push({ c: [ZC, yL], r: RC, ccw: true, w: XS[j]! }); // 아래 L_j
        circles.push({ c: [ZC, Y_U], r: RC, ccw: true, w: XS[j]! }); // 위 U_j
      }
      rope.setPath(
        ropeAround({ p: TIE, w: BK_X }, circles, { p: [Z_B, Y_E - 8 * d], w: X_E }, {
          seg: 12,
          map: (u: number, vv: number, w: number) => new THREE.Vector3(w, vv, u)
        })
      );
    }
  };
}
