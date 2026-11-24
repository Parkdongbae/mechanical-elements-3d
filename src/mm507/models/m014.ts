// 014 복활차(블록과 태클) — 한 가닥 줄이 위·아래 도르래 4개씩을 번갈아 감는다.
// 아래 블록이 d 오르면 자유단은 8d 내려온다(줄 가닥 수 8 = 힘의 이득 8배). (판화 14번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, pulley, rod, ropeAround, rotArrow, tag, type RopeCircle, type V2 } from '../kit';
import { castIron, darkSteel, steel, wood } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const RC = 0.22; // 줄 중심 반지름
const ZC = 0.25; // 블록 축 z 중심
const XS = [-0.24, -0.08, 0.08, 0.24]; // 도르래 4개의 x (j = 0..3)
const Y_U = 2.55; // 위 블록(고정) 중심 y
const Y_L = 1.2; // 아래 블록 최저 중심 y
const X_E = 0.62; // 자유단 x
const Y_E = 2.05; // 자유단 최고 y (d = 0)
const TIE: V2 = [0.03, Y_U]; // 묶는 점 (z, y) — 위 블록 첫 도르래 뒤쪽 가장자리

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
  upper.add(rod(v(0, 0.26, ZC), v(0, 0.39, ZC), 0.03)); // 위 막대
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
  lower.add(rod(v(0, -0.26, ZC), v(0, -0.46, ZC), 0.03)); // 아래 막대
  const hookL = mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 24), steel());
  hookL.position.set(0, -0.5, ZC);
  lower.add(hookL);
  const hookB = mesh(new THREE.TorusGeometry(0.04, 0.01, 12, 24), steel());
  hookB.position.set(0, -0.6, ZC); // 공 추의 고리 — 블록 고리와 맞물림
  lower.add(hookB);
  const ball = mesh(new THREE.SphereGeometry(0.14, 24, 18), darkSteel()); // 공 모양 추
  ball.position.set(0, -0.78, ZC);
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
  hand.position.set(X_E, Y_E, 0.03);
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
        ropeAround({ p: TIE, w: XS[0] }, circles, { p: [0.03, Y_E - 8 * d], w: X_E }, {
          seg: 12,
          map: (u: number, vv: number, w: number) => new THREE.Vector3(w, vv, u)
        })
      );
    }
  };
}
