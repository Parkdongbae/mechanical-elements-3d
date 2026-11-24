// 086 회전으로 펌프 작동(캠과 갈고리 걸쇠) — 축에 박힌 캠 C 가 쉬지 않고 시계 방향으로 돌고, 축 위에서 헐겁게 도는 바퀴 A 에 달린
// 갈고리 걸쇠 B 를 한 바퀴마다 잡아 바퀴째 끌고 돌아 펌프 줄을 끌어올린다. 걸쇠 꼬리가 위쪽 멈춤 턱에 부딪혀 갈고리가 들리면
// 바퀴는 펌프 대(추) 무게로 되돌아간다 (판화 86번, 설계표 docs/mm507-sheets/086.md).
// 절대 자세: 모든 자세는 누적 구동각 theta 의 함수 state86(theta) 에서 나온다(증분 누적 없음).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { darkSteel, steel, wood } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { ROPE_R, Rope, arcPoints, displayStand, markAnchor, pulley, rotArrow, shaftZ, tag, weight } from '../kit';
import { D86, K86, aFrame86, dragCam86, hookCatch86, state86, stopBlock86 } from '../kit/k086';

const D2R = Math.PI / 180;
const CW: [number, number] = [0.25, 1.85]; // 바퀴·축 중심
const ZC = 0.105; // 캠·걸쇠 층(설계표 0.09 — 캠 판 뒷면이 바퀴 허브 앞끝 0.08 에 박혀 0.105 로 올림)
const ROPE_X = CW[0] - K86.ropeR; // 줄 세로 가닥 x = −0.26
const Y_END0 = 0.526; // 쉼 자세의 줄 끝(추 고리 꼭대기) 높이
const RING_TOP = 0.14 * 0.1 + 0.14 * 0.16 + 0.22 / 2; // weight(0.14, 0.22) 중심 → 고리 꼭대기 = 0.1464
const POST_FRONT = -0.14; // 기둥·들보 앞면(뒤판 앞면 −0.30 에서 깊이 0.16)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 상자(x0~x1, y0~y1, z0~z1) */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

export default function buildM086(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정 틀: 왼쪽 기둥 + 위 들보(뒤판에 붙음) + 들보의 멈춤 턱
  const frameMat = wood(0x6e4a2c);
  g.add(box(-0.6, -0.46, 0.18, 2.59, -0.3, POST_FRONT, frameMat));
  g.add(box(-0.66, 0.85, 2.59, 2.73, -0.3, POST_FRONT, frameMat));
  const stop = stopBlock86(POST_FRONT, 0.13);
  stop.name = 'stopBlock';
  stop.position.set(CW[0] + D86.stop[0], CW[1] + D86.stop[1], 0);
  g.add(stop);

  // A자 받침(바퀴 뒤) + 축
  const af = aFrame86(1.67, 0.55, 0.06);
  af.position.set(CW[0], CW[1], -0.11);
  g.add(af);
  const shaft = shaftZ(CW[0], CW[1], 0.2, 0.045);
  g.add(shaft);

  // 헐거운 바퀴 A(로프 홈 풀리) — 줄 매는 못과 걸쇠 B 가 자식
  const wheel = pulley(K86.wheelR, { width: 0.12, spokes: 4 });
  wheel.name = 'wheelA';
  wheel.position.set(CW[0], CW[1], 0);
  g.add(wheel);

  const clampGeo = lathe(rodProfile(0.026, -0.055, 0.055, 0.005, 0.005), 20);
  clampGeo.rotateX(Math.PI / 2);
  const clamp = mesh(clampGeo, steel());
  clamp.name = 'ropeClamp';
  clamp.position.set(K86.ropeR * Math.cos(K86.ropeAt), K86.ropeR * Math.sin(K86.ropeAt), 0);
  markAnchor(clamp, [0, 0, 0]);
  wheel.add(clamp);

  const catchB = hookCatch86(0.045);
  catchB.name = 'catchB';
  catchB.position.set(K86.pin[0], K86.pin[1], ZC);
  wheel.add(catchB);
  // 걸쇠 받침 핀이 바퀴 테 앞면(z 0.06)에서 걸쇠 뒷면까지 이어지는 짧은 핀
  const pinGeo = lathe(rodProfile(0.018, 0.0, ZC, 0.003, 0.003), 16);
  pinGeo.rotateX(Math.PI / 2);
  const pin = mesh(pinGeo, darkSteel());
  pin.position.set(K86.pin[0], K86.pin[1], 0);
  wheel.add(pin);

  // 캠 C(축에 박혀 돈다)
  const cam = dragCam86(0.045);
  cam.name = 'camC';
  cam.position.set(CW[0], CW[1], ZC);
  g.add(cam);

  // 펌프 줄 + 추(펌프 대·버킷 대신) + 받침 나무토막
  const rope = new Rope(ROPE_R); // 바퀴 홈(줄 중심 0.51)에 맞는 굵은 로프(설계표 0.018 은 홈 바닥에서 0.03 떠 보임)
  rope.group.name = 'ropeA';
  g.add(rope.group);
  const bucket = weight(0.14, 0.22);
  bucket.name = 'bucket';
  g.add(bucket);
  g.add(box(ROPE_X - 0.12, ROPE_X + 0.12, 0.18, 0.268, -0.08, 0.08, wood()));

  // 회전 화살표(캠 시계) + 이름표
  const arrow = rotArrow(0.15, false); // 반지름 0.2 는 캠 팔(0.11~0.29) 한가운데를 가려 0.15 로 줄임(검증 후 수정)
  arrow.position.set(CW[0], CW[1], 0.16);
  g.add(arrow);
  g.add(
    tag('헐거운 바퀴 A', v(1.05, 1.45, 0.1)),
    tag('캠 C(구동)', v(0.9, 2.47, 0.2)),
    tag('갈고리 걸쇠 B', v(-1.05, 1.35, 0.2)),
    tag('멈춤 턱', v(0.95, 2.9, 0.1)),
    tag('펌프 대(추)', v(-0.95, 0.55, 0.1))
  );

  let st = state86(0);
  const apply = (): void => {
    st = state86(theta);
    shaft.rotation.z = -theta;
    cam.rotation.z = -theta;
    wheel.rotation.z = -st.alpha;
    catchB.rotation.z = st.psi;
    const yEnd = Y_END0 + st.lift;
    const pts = arcPoints(CW, K86.ropeR, K86.ropeAt - st.alpha, Math.PI, 0);
    pts.push(v(ROPE_X, yEnd, 0));
    rope.setPath(pts);
    bucket.position.set(ROPE_X, yEnd - RING_TOP, 0);
  };
  apply();

  const phaseName = (): string => (st.phase === 'drag' ? '끌어올림' : st.phase === 'return' ? '풀려 되돌아감' : '쉼');

  return {
    group: g,
    view: { pos: [0.1, 1.75, 6.4], target: [0.05, 1.6, 0] },
    notes: () => [
      { label: '지금 상태', value: phaseName() },
      { label: '줄이 올라간 높이', value: `${st.lift.toFixed(2)} (0 ~ 1.02)` },
      { label: '바퀴 각 alpha', value: `${(st.alpha / D2R).toFixed(1)}°` },
      { label: '걸쇠 들림 psi', value: `${(st.psi / D2R).toFixed(1)}°` },
      { label: '설명', value: '걸쇠는 무게나 용수철로 제자리에 돌아온다(판화에는 그려지지 않음)' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
