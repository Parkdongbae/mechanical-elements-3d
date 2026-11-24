// 009 원뿔 풀리 변속 — 마주 보는 원뿔 풀리 위로 벨트 위치가 이동하며 속도비가 연속(무단) 변한다 (판화 9번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, PILLOW_BOSS_Y, ROPE_R, conePulley, displayStand, openBeltPath, pillow, rod, tag } from '../kit';
import { bronze, castIron } from '../../models/materials';

const YT = 2.5; // 구동(위) 축 높이
const YB = 1.0; // 종동(아래) 축 높이
const Z = 0.25; // 축 깊이 — 기구 면
const SX = 0.8; // 축 반 길이(길이 1.6) — 양끝 필로
const CL = 0.9; // 원뿔 풀리 길이 (x −0.45 → +0.45)
const R0 = 0.36; // 벨트 위치 x=0 반지름 — Ru+Rl = 0.72 일정, 벨트 길이 거리 일정
const K = 0.311; // 원뿔 기울기 (0.28/0.9)
const XR = 0.35; // 벨트 이동 진폭
const PERIOD = 10; // 벨트 이동 주기(초)

const TAU = Math.PI * 2;
const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** x 위치의 원뿔 표면 반지름: 위(구동) Ru, 아래(종동) Rl — 선형 보간 */
const RuOf = (x: number): number => R0 - K * x;
const RlOf = (x: number): number => R0 + K * x;

/** 벨트 경로: x 위치의 YZ 평면 열린 벨트. (z,y) 쌍을 3D (x,y,z)로. 로프 중심이 원뿔 표면에 앉도록 +ROPE_R */
function beltPath(x: number): THREE.Vector3[] {
  return openBeltPath([Z, YT], RuOf(x) + ROPE_R, [Z, YB], RlOf(x) + ROPE_R).map((p) => v3(x, p[1], p[0]));
}

export default function buildM009(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 구동각
  let driven = 0; // 종동각 — 속도비가 계속 변하므로 적분으로 누적
  let beltS = 0; // 벨트 표시 흐름(호장)
  let T = 0; // |speed| 누적 시간 — 벨트 위치 전용
  let x = 0; // 현재 벨트 위치

  g.add(displayStand());

  // X 방향 축 2개(길이 1.6) + 뒤판 브래킷 + 양끝 필로
  g.add(rod(v3(-SX, YT, Z), v3(SX, YT, Z), 0.045));
  g.add(rod(v3(-SX, YB, Z), v3(SX, YB, Z), 0.045));
  for (const y of [YT, YB]) {
    for (const sx of [-SX, SX]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.6), castIron());
      br.position.set(sx, y - PILLOW_BOSS_Y - 0.04, 0); // 뒤판(z −0.30)에서 나와 필로 받침판을 받친다
      g.add(br);
      g.add(pillow(sx, y - PILLOW_BOSS_Y, Z, 'x'));
    }
  }

  // 원뿔 풀리: 위는 큰 쪽이 왼쪽, 아래는 반대. 회전축 = 로컬 X
  const pT = conePulley(0.5, 0.22, CL);
  pT.position.set(0, YT, Z);
  const pB = conePulley(0.22, 0.5, CL);
  pB.position.set(0, YB, Z);
  // 구동 쪽 몸통만 bronze — 첫 메시가 원뿔 몸통(키트 규약: 구동 구분)
  for (const c of pT.children) {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.material = bronze({ roughness: 0.34 });
      break;
    }
  }
  g.add(pT, pB);

  // 벨트: 매 프레임 경로를 다시 만든다(같은 점 수 — 지오메트리 재사용)
  const belt = new Belt(beltPath(0), { width: 0.1 });
  g.add(belt.group);

  // 이름표
  g.add(tag('구동 원뿔 풀리', v3(1.0, YT + 0.25, Z + 0.1)));
  g.add(tag('종동 원뿔 풀리', v3(1.0, YB + 0.25, Z + 0.1)));

  return {
    group: g,
    notes: () => [
      { label: '속도비(종동/구동)', value: (RuOf(x) / RlOf(x)).toFixed(2) },
      { label: '변속', value: '연속(무단)' }
    ],
    update(dt: number, speed: number): void {
      T += Math.abs(speed) * dt;
      x = XR * Math.sin((TAU * T) / PERIOD); // 벨트 위치 — 10초 주기로 좌우
      const Ru = RuOf(x);
      const Rl = RlOf(x);
      const w = OMEGA * speed;
      theta += w * dt;
      driven += w * (Ru / Rl) * dt; // 종동각: 가변 속도비의 적분 — 각이 튀지 않게 누적
      beltS += w * Ru * dt; // 벨트 선속도 = 구동 표면 속도
      pT.rotation.x = theta;
      pB.rotation.x = driven; // 열린 벨트: 같은 방향
      belt.setPath(beltPath(x));
      belt.setOffset(beltS);
    }
  };
}
