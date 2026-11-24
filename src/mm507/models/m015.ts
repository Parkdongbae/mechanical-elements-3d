// 015 화이트 도르래 — 한 몸 단차 풀리 블록 2개에 줄 7가닥을 번갈아 감고, 힘의 비 1 : 7 (판화 15번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, rod, ropeAround, rotArrow, steppedPulley, tag, weight } from '../kit';
import { castIron, steel, wood } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

// 줄 중심 반지름 — 위 홈 4개(1·3·5·7×k), 아래 홈 3개(2·4·6×k)
const A1 = 0.065;
const A2 = 0.195;
const A3 = 0.325;
const A4 = 0.455;
const B1 = 0.13;
const B2 = 0.26;
const B3 = 0.39;
const UY = 2.55; // 위 블록 중심 y
const LY0 = 1.3; // 아래 블록 y_L = LY0 + d
const FX = -A4; // 자유단 x (A4 왼쪽 접선 아래)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM015(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let dNow = 0; // notes() 가 읽는 현재 올림 d

  g.add(displayStand());

  // 들보
  const beam = mesh(new THREE.BoxGeometry(1.9, 0.12, 0.65), castIron());
  beam.position.set(0, 3.07, 0.05);
  g.add(beam);

  // 위 블록(홈 4개, 위치 고정) + 매달이(축 막대·옆판 2·고리)
  const pU = steppedPulley([0.435, 0.305, 0.175, 0.045], 0.09);
  pU.position.set(0, UY, 0.2);
  g.add(pU);
  g.add(rod(v(0, UY, 0.03), v(0, UY, 0.37), 0.03));
  for (const z of [0.03, 0.37]) {
    const plate = mesh(new THREE.BoxGeometry(0.03, 0.45, 0.03), steel());
    plate.position.set(0, 2.775, z); // y 2.55 ~ 3.00
    g.add(plate);
  }
  // 옆판 두 장을 잇는 윗 가로대 — 고리가 여기에 붙어 들보로 올라간다
  const capU = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.37), steel());
  capU.position.set(0, 2.985, 0.2); // z 0.015 ~ 0.385
  g.add(capU);
  const hookU = mesh(new THREE.TorusGeometry(0.03, 0.011, 12, 24), steel());
  hookU.position.set(0, 2.99, 0.2); // xy 면 고리가 z 방향 가로대를 감싸고 윗부분은 들보 속(바닥 y 3.01)
  g.add(hookU);

  // 아래 블록 + 매달이 + 추 + 묶는 핀 — hangL 그룹을 y_L 로 이동
  const hangL = new THREE.Group();
  const pL = steppedPulley([0.37, 0.24, 0.11], 0.09);
  pL.position.set(0, 0, 0.2);
  hangL.add(pL);
  hangL.add(rod(v(0, 0, 0.03), v(0, 0, 0.37), 0.03));
  // 스트랩: 축 양끝을 잡는 옆판 2장(z 0.03·0.37, 단·허브 z 0.047~0.353 바깥)이 블록 아래로 내려와
  // 줄의 가장 낮은 호(B3, y −0.40)보다 아래에서 가로대로 이어진다 → 가로대 가운데에서 막대·고리·추
  for (const z of [0.03, 0.37]) {
    const plate = mesh(new THREE.BoxGeometry(0.03, 0.47, 0.03), steel());
    plate.position.set(0, -0.22, z); // y +0.015 ~ −0.455 (축 막대를 감쌈)
    hangL.add(plate);
  }
  const capL = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.37), steel());
  capL.position.set(0, -0.44, 0.2); // y −0.455 ~ −0.425, z 0.015 ~ 0.385
  hangL.add(capL);
  hangL.add(rod(v(0, -0.44, 0.2), v(0, -0.475, 0.2), 0.03)); // 가로대 → 고리
  const hookL = mesh(new THREE.TorusGeometry(0.03, 0.011, 12, 24), steel());
  hookL.position.set(0, -0.5, 0.2);
  hookL.rotation.y = Math.PI / 2; // yz 면 — 추의 xy 면 고리와 사슬처럼 엇걸림
  hangL.add(hookL);
  // 추 고리(키트: 중심 h/2 + 0.1w = 0.2 위, 반지름 0.048, 굵기 0.0135)의 윗변 안쪽이
  // 고리 아랫변(중심선 y −0.53, 굵기 0.011)에 얹히게: 고리 중심 = −0.53 + 0.011 + 0.0135 − 0.048
  const load = weight(0.3, 0.34);
  load.position.set(0, -0.53 + 0.011 + 0.0135 - 0.048 - 0.2, 0.2); // −0.7535
  load.add(tag('추', v(0.45, 0.05, 0.1)));
  hangL.add(load);
  hangL.add(rod(v(0.065, 0, 0.335), v(0.065, 0, 0.37), 0.02)); // 줄 끝 묶는 핀
  hangL.position.y = LY0;
  g.add(hangL);

  // 줄 — 매 프레임 setPath
  const rope = new Rope(0.018);
  g.add(rope.group);

  // 자유단 손잡이 — 막대 + 구, y_E 만 이동
  const handle = new THREE.Group();
  handle.add(rod(v(FX, 0, 0.065), v(FX, -0.16, 0.065), 0.05));
  const knob = mesh(new THREE.SphereGeometry(0.06, 20, 16), wood(0x4a2f1d));
  knob.position.set(FX, -0.16, 0.065);
  handle.add(knob);
  g.add(handle);

  // 회전 방향 화살표(둘 다 반시계) + 이름표
  const arrowU = rotArrow(0.6, true);
  arrowU.position.set(0, UY, 0.45);
  const arrowL = rotArrow(0.6, true);
  arrowL.position.set(0, LY0, 0.45);
  g.add(arrowU, arrowL);
  g.add(
    tag('위 블록(고정, 홈 4개)', v(1.05, 2.85, 0.45)),
    tag('아래 블록(움직, 홈 3개)', v(1.05, 1.6, 0.45)),
    tag('당기는 끝(7배 이동)', v(-1.0, 1.0, 0.45)),
    tag('묶은 곳', v(0.7, 1.15, 0.45))
  );

  return {
    group: g,
    notes: () => [
      { label: '줄 가닥 수(아래 블록)', value: '7' },
      { label: '힘의 비', value: '1 : 7' },
      { label: '추 올라간 높이', value: dNow.toFixed(2) },
      { label: '당긴 줄 길이', value: (7 * dNow).toFixed(2) }
    ],
    view: { pos: [0.9, 2.1, 6.0], target: [0, 1.7, 0] },
    update(dt: number, speed: number): void {
      // 절대 각도에서 전체 자세를 다시 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      const d = 0.11 * (1 - Math.cos(0.5 * theta)); // 올림 0 ~ 0.22
      dNow = d;
      const yL = LY0 + d;
      const yE = 2.05 - 7 * d; // 자유단은 7배 내려온다
      pU.rotation.z = d / A1; // 두 블록 같은 각(반시계) — 반지름이 속도에 비례
      hangL.position.y = yL;
      pL.rotation.z = d / A1;
      arrowL.position.y = yL;
      handle.position.y = yE;
      rope.setPath(
        ropeAround(
          { p: [0.065, yL], w: 0.37 }, // 묶는 점(핀)
          [
            { c: [0, UY], r: A1, ccw: true, w: 0.335 },
            { c: [0, yL], r: B1, ccw: true, w: 0.29 },
            { c: [0, UY], r: A2, ccw: true, w: 0.245 },
            { c: [0, yL], r: B2, ccw: true, w: 0.2 },
            { c: [0, UY], r: A3, ccw: true, w: 0.155 },
            { c: [0, yL], r: B3, ccw: true, w: 0.11 },
            { c: [0, UY], r: A4, ccw: true, w: 0.065 }
          ],
          { p: [FX, yE], w: 0.065 }, // 자유단(A4 왼쪽 접선 위)
          { seg: 12 }
        )
      );
    }
  };
}
