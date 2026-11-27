// 246 축소·확대 제도기(팬터그래프) — 고정점 C 에 박힌 긴 팔 위에서 평행사변형 링크가 놀고,
// 추적점 B 상아 바늘로 세운 제도판의 작은 별을 따라가면 연필 A 가 같은 모양의 두 배 별을
// 빨간 선으로 그려 나간다(늘 두 배, CA : CB = 2). 주기 13초: 10초 그리기 + 2초 감상 + 1초 지우기.
// 설계표 docs/mm507-sheets/246.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { bar246, K246, state246, starPts246, starTube246, trailGeo246, type State246 } from '../kit/k246';
import { brass, darkSteel, paint, steel, wood } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM246(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // 제도판 종이 — 뒤판 앞면(−0.30)에 붙는 얇은 판
  const board = mesh(new THREE.BoxGeometry(3.6, 2.8, 0.01), paint(0xf7f4ea));
  board.name = 'board';
  board.position.set(-0.2, 1.75, K246.Z.board - 0.005);
  g.add(board);

  // 종이에 인쇄된 원본 별(짙은 회색) — B 가 따라갈 도면
  const starOrig = mesh(starTube246(starPts246(), 0.007, K246.Z.board + 0.007), paint(0x3b4a5a));
  starOrig.name = 'starOrig';
  g.add(starOrig);

  // 연필 자취(빨간 두 배 별) — state246 의 n 으로 drawRange, tc 12~13 에 서서히 사라짐
  const trailMat = paint(0xd8362f);
  trailMat.transparent = true;
  const trail = mesh(trailGeo246(), trailMat);
  trail.name = 'trail';
  g.add(trail);

  // 고정점 C: 핀(제도판에 박힘) + 공 손잡이
  const pivotC = new THREE.Group();
  pivotC.name = 'pivotC';
  pivotC.position.set(K246.C[0], K246.C[1], 0);
  const cPin = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16).rotateX(Math.PI / 2), steel());
  cPin.position.z = K246.Z.board + 0.05;
  const ball = mesh(new THREE.SphereGeometry(0.08, 24, 16), paint(0x7a5230));
  ball.position.z = -0.12; // 공 뒷면 −0.20 = 팔 CF 앞면 −0.205 위 0.005
  pivotC.add(cPin, ball);
  g.add(pivotC);

  // 긴 팔 둘 + 짧은 막대 둘 — 핀 자리 구멍·고리 표시는 bar246 이 남긴다
  const armCF = bar246(2 * K246.L, K246.OVER, steel(), [{ x: 0, r: 0.032 }, { x: K246.L }, { x: 2 * K246.L }]);
  armCF.name = 'armCF';
  armCF.position.set(K246.C[0], K246.C[1], K246.Z.armCF);
  const armAF = bar246(2 * K246.L, K246.OVER, steel(), [{ x: 0 }, { x: K246.L }, { x: 2 * K246.L, ring: false }]);
  armAF.name = 'armAF';
  const linkBD = bar246(K246.L, 0, brass());
  linkBD.name = 'linkBD';
  const linkBE = bar246(K246.L, 0, brass());
  linkBE.name = 'linkBE';
  g.add(armCF, armAF, linkBD, linkBE);

  // 이음 핀(보이는 몸통 + 앞 머리 고리) — 층 상수에서 z 범위를 낸다
  const zb = (z: number): number => z - 0.015; // 층 뒷면(막대 두께 0.03)
  const zf = (z: number): number => z + 0.015; // 층 앞면
  const pinVis = (z0: number, z1: number): THREE.Group => {
    const p = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.025, 0.025, z1 - z0, 16).rotateX(Math.PI / 2), steel());
    body.position.z = (z0 + z1) / 2;
    const head = mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 24), darkSteel());
    head.position.z = z1 + 0.005; // 앞면에서 0.005 나오게(핀 머리)
    p.add(body, head);
    return p;
  };
  const pinDVis = pinVis(zb(K246.Z.armCF), zf(K246.Z.linkBD)); // 팔 CF · 막대 DB
  pinDVis.name = 'pinDVis';
  const pinEVis = pinVis(zb(K246.Z.linkBE), zf(K246.Z.armAF)); // 막대 BE · 팔 AF
  pinEVis.name = 'pinEVis';
  const pinFVis = pinVis(zb(K246.Z.armCF), zf(K246.Z.armAF)); // 두 긴 팔
  pinFVis.name = 'pinFVis';
  const pinBVis = pinVis(zb(K246.Z.linkBD), zf(K246.Z.linkBE)); // 두 짧은 막대
  pinBVis.name = 'pinBVis';
  g.add(pinDVis, pinEVis, pinFVis, pinBVis);

  // 검사 선언 links 용 빈 앵커(이름 pinC~pinA) — 매 프레임 마디 자리로
  const anchor = (name: string): THREE.Object3D => {
    const o = new THREE.Object3D();
    o.name = name;
    g.add(o);
    return o;
  };
  const pinC = anchor('pinC');
  pinC.position.set(K246.C[0], K246.C[1], 0);
  const pinD = anchor('pinD');
  const pinE = anchor('pinE');
  const pinF = anchor('pinF');
  const pinB = anchor('pinB');
  const pinA = anchor('pinA');

  // 추적점 B: 상아 바늘(끝이 종이에 닿음) + 손잡이
  const tracerB = new THREE.Group();
  tracerB.name = 'tracerB';
  const needle = mesh(new THREE.ConeGeometry(0.03, 0.1, 16).rotateX(-Math.PI / 2), paint(0xf3ead2));
  needle.position.z = K246.Z.board + 0.05; // 끝 −0.29
  const knob = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 24).rotateX(Math.PI / 2), paint(0xf3ead2));
  knob.position.z = zf(K246.Z.linkBE) + 0.025; // 핀 B 머리 위
  tracerB.add(needle, knob);
  g.add(tracerB);

  // 연필 A: 팔 끝 슬라이드 블록(팔을 감쌈) + 연필 + 심(끝이 종이에 닿음)
  const pencilA = new THREE.Group();
  pencilA.name = 'pencilA';
  const block = mesh(new THREE.BoxGeometry(0.16, 0.12, 0.07), wood(0x8a6a44));
  block.position.z = -0.1;
  const lead = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 16).rotateX(Math.PI / 2), paint(0xf2b619));
  lead.position.z = -0.13; // z −0.27~0.01
  const tip = mesh(new THREE.ConeGeometry(0.025, 0.03, 16).rotateX(-Math.PI / 2), darkSteel());
  tip.position.z = K246.Z.board + 0.015; // 심 끝 −0.29
  pencilA.add(block, lead, tip);
  g.add(pencilA);

  // 이름표 6개(지시선을 부품에 직접)
  g.add(
    leaderTo(tag('고정점 C', v(-0.55, 0.36, 0.1)), 'pivotC'),
    leaderTo(tag('추적점 B', v(-2.05, 1.3, 0.1)), 'tracerB'),
    leaderTo(tag('연필 A', v(0.45, 3.05, 0.1)), 'pencilA'),
    leaderTo(tag('원본 별', v(-2.15, 1.9, 0.1)), 'starOrig'),
    leaderTo(tag('2배 별', v(-2.3, 3.0, 0.1)), 'trail'),
    leaderTo(tag('평행사변형', v(0.75, 0.7, 0.1)), 'armCF')
  );

  // 상태: t 하나로 전부 다시 계산(결정적 — 역회전·바로 점프 안전)
  let st: State246 = state246(0);
  const apply = (): void => {
    st = state246(tm);
    const [bx, by] = st.B;
    const angCF = Math.atan2(st.F[1] - K246.C[1], st.F[0] - K246.C[0]);
    const angAF = Math.atan2(st.A[1] - st.F[1], st.A[0] - st.F[0]);
    armCF.rotation.z = angCF;
    armAF.position.set(st.F[0], st.F[1], K246.Z.armAF);
    armAF.rotation.z = angAF;
    linkBD.position.set(st.D[0], st.D[1], K246.Z.linkBD);
    linkBD.rotation.z = Math.atan2(by - st.D[1], bx - st.D[0]);
    linkBE.position.set(bx, by, K246.Z.linkBE);
    linkBE.rotation.z = Math.atan2(st.E[1] - by, st.E[0] - bx);
    pinDVis.position.set(st.D[0], st.D[1], 0);
    pinEVis.position.set(st.E[0], st.E[1], 0);
    pinFVis.position.set(st.F[0], st.F[1], 0);
    pinBVis.position.set(bx, by, 0);
    pinD.position.set(st.D[0], st.D[1], 0);
    pinE.position.set(st.E[0], st.E[1], 0);
    pinF.position.set(st.F[0], st.F[1], 0);
    pinB.position.set(bx, by, 0);
    pinA.position.set(st.A[0], st.A[1], 0);
    tracerB.position.set(bx, by, 0);
    pencilA.position.set(st.A[0], st.A[1], 0);
    block.rotation.z = angAF; // 블록은 팔 AF 와 같은 각
    trail.geometry.setDrawRange(0, st.n * 36); // 마디 하나 = radial 6 × 6 인덱스
    trailMat.opacity = st.opacity;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: 'B 가 지난 길이', value: (st.u * 0.12351).toFixed(3) },
      { label: 'A 가 그린 길이', value: (st.u * 0.24702).toFixed(3) },
      {
        label: '비율 CA : CB',
        value: (
          Math.hypot(st.A[0] - K246.C[0], st.A[1] - K246.C[1]) / Math.hypot(st.B[0] - K246.C[0], st.B[1] - K246.C[1])
        ).toFixed(3)
      },
      { label: '막대 마디 길이', value: '1.225 (6마디 모두 일정)' }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [-0.3, 1.8, 6.6], target: [-0.3, 1.75, 0] }
  };
}
