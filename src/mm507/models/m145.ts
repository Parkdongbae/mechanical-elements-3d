// 145 빔과 크랭크, 플라이휠 — 빔의 왕복이 연결봉·레버를 거쳐 크랭크 핀을 밀어 플라이휠에
// 연속 회전을 준다. 받침대가 레일 위를 가로로 왕복해야 4절 루프가 막히지 않는다(1자유도).
// (설계표 docs/mm507-sheets/145.md, 키트 kit/k143.ts 의 145 공용 부품 — 새 부품 없음)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, markPin, rotArrow, shaftZ, tag } from '../kit';
import {
  beam145,
  beamCrank145,
  crankArm,
  flywheel,
  floorPlinth145,
  K145,
  linkBar,
  slidingStandard145,
  type BeamCrank145
} from '../kit/k143';

const DEG = 180 / Math.PI;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM145(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 바닥 단 2개 — 가운데(x −1.78~0.08)를 비워 플라이휠 테가 들어가는 구덩이. 오른쪽 단엔 받침대 안내 레일
  const floorL = floorPlinth145(-2.05, -1.78, K145.floor);
  floorL.name = 'floorL';
  const floorR = floorPlinth145(0.08, 1.95, K145.floor, { rail: { x0: 0.75, x1: 1.95, zc: 0.07, footD: 0.2 } });
  floorR.name = 'floorR';
  g.add(floorL, floorR);

  // 플라이휠(등속 반시계) + 고정 축(뒤판 보스 → 너트 z 0.128: 레버 뒷면 0.13 앞에서 끝냄 — 크랭크 허브 구멍 안에 담금)
  const wheel = flywheel(K145.R, { rimIn: K145.rimIn });
  wheel.name = 'flywheel';
  wheel.position.set(K145.OX, K145.OY, K145.zWheel);
  g.add(wheel, shaftZ(K145.OX, K145.OY, 0.128));

  // 크랭크 팔 — 바퀴와 한 몸으로 같이 도는다(rotation.z 공유)
  const crank = crankArm(K145.crank, { pinTop: 0.1 });
  crank.name = 'crank';
  crank.position.set(K145.OX, K145.OY, K145.zCrank);
  g.add(crank);

  // 레버: 구멍 셋(A=크랭크 핀 · M=연결봉 · B=받침대 핀). 가운데 핀이 연결봉 아래 구멍을 같이 꿴다
  const lever = linkBar(K145.lever, {
    holes: [0, K145.leverM, K145.lever],
    holeR: 0.034,
    eyeR: 0.055,
    pins: [1],
    pinZ: [-0.02, 0.08],
    names: ['pinA', 'pinM', 'pinB']
  });
  lever.name = 'lever';
  g.add(lever);

  // 연결봉: 원점 = 아래 구멍 M, 위 구멍 E 가 빔 끝 핀에 걸린다
  const rod = linkBar(K145.rod, { holeR: 0.034, eyeR: 0.055, names: ['rodM', 'pinE'], markZ: -0.06 });
  rod.name = 'rod';
  g.add(rod);

  // 빔(원점 = 받침 축 구멍, 팔 +X · 꼬리 −X) + 받침 축(고정) + 원점 핀 표식
  const beam = beam145(K145.beam, K145.beamTail, { pinTop: 0.1, pinZ: 0 });
  beam.name = 'beam';
  beam.position.set(K145.PX, K145.PY, K145.zBeam);
  const pivot = markPin(new THREE.Object3D());
  pivot.name = 'beamPivot';
  beam.add(pivot);
  g.add(beam, shaftZ(K145.PX, K145.PY, 0.25)); // 축이 들보(z 0.12~0.18)를 꿰고 앞으로 튀어나오게 — 0.105 면 들보 가운데에도 못 미쳤다(사용자 지적)

  // 미끄럼 받침대(원점 = 꼭대기 핀) — 발판이 단 윗면 0.49 에 닿고 레일 사이를 미끄러진다
  const standard = slidingStandard145(K145.OY - K145.floor, { pinTop: 0.12 });
  standard.name = 'standard';
  standard.position.set(0, K145.OY, K145.zStd);
  g.add(standard);

  // 회전 방향 화살표(살 앞·레버 뒤 층)
  const arrow = rotArrow(0.32, true);
  arrow.position.set(K145.OX, K145.OY, 0.105);
  g.add(arrow);

  // 이름표 6개 — 넷은 움직이는 부품을 따라간다
  const tagWheel = tag('플라이휠(구동)', v(-1.85, 2.35, 0.3));
  const tagBeam = tag('빔', v(0, 0, 0.3));
  const tagRod = tag('연결봉', v(0, 0, 0.3));
  const tagLever = tag('레버', v(0, 0, 0.3));
  const tagStd = tag('미끄럼 받침대(왕복)', v(0, 0, 0.3));
  const tagPivot = tag('빔 받침 축(고정)', v(1.85, 2.95, 0.3));
  g.add(tagWheel, tagBeam, tagRod, tagLever, tagStd, tagPivot);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (A: BeamCrank145): void => {
    wheel.rotation.z = A.phi;
    crank.rotation.z = A.phi;
    lever.position.set(A.A[0], A.A[1], K145.zLever);
    lever.rotation.z = A.leverAngle;
    rod.position.set(A.M[0], A.M[1], K145.zRod);
    rod.rotation.z = A.rodAngle;
    beam.rotation.z = A.beamAngle;
    standard.position.x = A.B[0];
    // 따라가는 이름표: 레버·연결봉 중점, 빔 팔 중점, 받침대 옆
    const lx = (A.A[0] + A.B[0]) / 2;
    const ly = (A.A[1] + A.B[1]) / 2;
    tagLever.position.set(lx + 0.28, ly - 0.32, 0.3);
    tagRod.position.set((A.M[0] + A.E[0]) / 2 + 0.42, (A.M[1] + A.E[1]) / 2, 0.3);
    const bx = K145.PX + (K145.beam / 2) * Math.cos(A.beamAngle);
    const by = K145.PY + (K145.beam / 2) * Math.sin(A.beamAngle);
    tagBeam.position.set(bx + 0.15, by + 0.32, 0.3);
    tagStd.position.set(A.B[0] + 0.4, 0.75, 0.3);
  };
  pose(beamCrank145(0));

  return {
    group: g,
    view: { pos: [0.1, 1.7, 6.4], target: [0.1, 1.6, 0] },
    notes: () => {
      const A = beamCrank145(theta);
      const deg = ((A.phi * DEG) % 360 + 360) % 360;
      const tilt = A.beamAngle * DEG - 180;
      return [
        { label: '크랭크 각', value: `${deg.toFixed(0)}°` },
        { label: '받침대 진행', value: `s = ${(A.s * 100).toFixed(0)} % · 행정 0.58` },
        { label: '빔 각', value: `수평 ${tilt >= 0 ? '+' : ''}${tilt.toFixed(1)}° · 끝 높이 ${A.E[1].toFixed(2)}` },
        {
          label: '설명',
          value: '크랭크가 한 바퀴 도는 동안 받침대가 왼쪽 끝 → 오른쪽 끝 → 왼쪽 끝으로 한 번 왕복하고 빔이 한 번 오르내린다'
        }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(beamCrank145(theta));
    }
  };
}
