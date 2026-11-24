// 053 양방향 이중 클러치 — 세로축이 위의 베벨 C 로 좌우의 헐거운 베벨 A·B 를 서로 반대로 돌리고,
// 가로축 깃 위를 미끄러지는 이중(발톱) 클러치가 A 또는 B 에 물려 가로축을 정회전·정지·역회전시킨다 (판화 53번)
// 클러치는 벨 크랭크(ㄴ자 레버) + 당김 막대로 민다. 설계표 docs/mm507-sheets/053.md 그대로.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { bevelGear, displayStand, rotArrow, setMM, tag } from '../kit';
import { armBearing, clawRing, doubleClutch, pivotBeam, pullRod, rodX, rodY, shiftBellCrank, shiftYoke } from '../kit/k053';
import { darkSteel, paint } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const PI = Math.PI;
const TEETH = 20;
const MOD = 0.042; // 피치 반지름 R = 0.42
const R = (TEETH * MOD) / 2;
const YA = 1.55; // 가로축 높이
const ZC = 0.28; // 축 깊이
const BACK = ZC + 0.3; // 뒤판(z = −0.30)까지

// 클러치 시간표 (설계표 '동작식')
const PERIOD = 7 * PI;
const S_ENG = 0.095; // 걸림 위치
const V = S_ENG / (PI / 4); // 이동 속도 (/rad)
const A_REL = 0.035 / V; // 걸림이 풀리는 데까지
const B_ENG = 0.06 / V; // 걸리기 시작하는 데까지
const D1 = 2 * PI + A_REL;
const Y1 = 3.25 * PI + B_ENG;
const D2 = 5.5 * PI + A_REL;
const X1 = 6.75 * PI + B_ENG;

// 벨 크랭크
const UP = 0.25;
const SIDE = 0.25;
const PIV = new THREE.Vector3(0, 1.08, 0.31);
const EYE_DZ = 0.035; // 가로 팔 끝 핀에서 당김 막대 눈이 걸리는 깊이(크랭크 판 가운데 기준)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

function phaseOf(theta: number): number {
  return ((theta % PERIOD) + PERIOD) % PERIOD;
}

/** 클러치 위치 s (x 방향) */
function clutchS(f: number): number {
  if (f < 2 * PI) return -S_ENG;
  if (f < 2.25 * PI) return -S_ENG + V * (f - 2 * PI);
  if (f < 3.25 * PI) return 0;
  if (f < 3.5 * PI) return V * (f - 3.25 * PI);
  if (f < 5.5 * PI) return S_ENG;
  if (f < 5.75 * PI) return S_ENG - V * (f - 5.5 * PI);
  if (f < 6.75 * PI) return 0;
  return -V * (f - 6.75 * PI);
}

/** 가로축 각 β (+X 둘레, 닫힌 식) */
function shaftBeta(f: number): number {
  if (f >= X1) return f - PERIOD;
  if (f <= D1) return f;
  if (f < Y1) return D1;
  if (f <= D2) return D1 + Y1 - f;
  return D1 + Y1 - D2;
}

type ClutchState = 'A' | 'B' | 'N' | 'M';
function clutchState(f: number): ClutchState {
  if (f <= D1 || f >= X1) return 'A';
  if (f >= Y1 && f <= D2) return 'B';
  const s = clutchS(f);
  return s === 0 ? 'N' : 'M';
}

export default function buildM053(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let dirSign = 1;
  g.add(displayStand());

  // ── 베벨 기어 3개 (피벗 그룹이 축 둘레로 돈다) ──
  const gearA = new THREE.Group();
  gearA.name = 'gearA';
  gearA.position.set(-R, YA, ZC);
  setMM(gearA, { axis: 'x' });
  const bevA = bevelGear(TEETH, MOD, { width: 0.1, spokes: 5, bore: 0.05 });
  bevA.rotation.y = PI / 2; // 로컬 Z → +X (이가 꼭짓점 O 쪽)
  const ringA = clawRing({ teeth: 4, rIn: 0.07, rOut: 0.115, base: 0.12, tooth: 0.04, frac: 0.34, phase: 0 });
  bevA.add(ringA);
  gearA.add(bevA);

  const gearB = new THREE.Group();
  gearB.name = 'gearB';
  gearB.position.set(R, YA, ZC);
  setMM(gearB, { axis: 'x' });
  const bevB = bevelGear(TEETH, MOD, { width: 0.1, spokes: 5, bore: 0.05 });
  bevB.rotation.y = -PI / 2; // 로컬 Z → −X
  const ringB = clawRing({ teeth: 4, rIn: 0.07, rOut: 0.115, base: 0.12, tooth: 0.04, frac: 0.34, phase: 0 });
  bevB.add(ringB);
  gearB.add(bevB);

  const gearC = new THREE.Group();
  gearC.name = 'gearC';
  gearC.position.set(0, YA + R, ZC);
  setMM(gearC, { axis: 'y' });
  const bevC = bevelGear(TEETH, MOD, { width: 0.1, spokes: 5, bore: 0.05, driver: true });
  bevC.rotation.x = PI / 2; // 로컬 Z → −Y (이가 아래로)
  gearC.add(bevC);
  // 세로 구동축(C 와 함께 돎): 세계 y 1.80 ~ 2.95 → 피벗 기준 −0.17 ~ 0.98, 위 끝 사각 머리
  gearC.add(rodY(1.8 - (YA + R), 2.95 - (YA + R), 0.045));
  const head = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), darkSteel());
  head.position.set(0, 2.92 - (YA + R), 0);
  gearC.add(head);
  g.add(gearA, gearB, gearC);

  // 축 받침(판화에 없음, 보충): 세로축 위 + 가로축 양끝
  const brY = armBearing('y', BACK);
  brY.position.set(0, 2.45, ZC);
  g.add(brY);
  for (const x of [-0.68, 0.68]) {
    const b = armBearing('x', BACK);
    b.position.set(x, YA, ZC);
    g.add(b);
  }

  // ── 가로 출력축 + 표시 원판 ──
  const outShaft = rodX(-0.88, 0.88, 0.045, { x0: -0.29, x1: 0.29 });
  outShaft.name = 'outShaft';
  outShaft.position.set(0, YA, ZC);
  setMM(outShaft, { axis: 'x' });
  const discGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 36);
  discGeo.rotateZ(PI / 2);
  const disc = mesh(discGeo, darkSteel());
  disc.position.set(0.8, 0, 0);
  const stripe = mesh(new THREE.BoxGeometry(0.024, 0.1, 0.02), paint(0xf2b619));
  stripe.position.set(0.812, 0.06, 0);
  outShaft.add(disc, stripe);
  g.add(outShaft);

  // ── 이중 클러치 · 요크 ──
  const clutch = doubleClutch();
  clutch.name = 'clutch';
  g.add(clutch);
  // 요크(판화에 없음, 보충) — 슬롯 중심 y = 1.325, 길이 0.08, 반폭 0.02(끝 핀 반지름 0.018 이 걸리지 않게)
  const yoke = shiftYoke({ grooveR: 0.09, ringW: 0.04, slotDrop: 0.225, slotLen: 0.08, slotHalf: 0.02 });
  g.add(yoke);

  // ── 벨 크랭크 · 받침 보 · 당김 막대 ──
  const bellCrank = shiftBellCrank(UP, SIDE);
  bellCrank.name = 'bellCrank';
  bellCrank.position.copy(PIV);
  const eye = new THREE.Object3D();
  eye.name = 'bellCrankEye';
  eye.position.set(-SIDE, 0, EYE_DZ);
  bellCrank.add(eye);
  g.add(bellCrank);
  const beam = pivotBeam(0.54);
  beam.position.set(PIV.x, PIV.y, 0.24);
  g.add(beam);
  const rodP = pullRod(0.6);
  rodP.name = 'pullRod';
  g.add(rodP);

  // ── 회전 화살표 ──
  const topCcw = rotArrow(0.22, true);
  const topCw = rotArrow(0.22, false);
  for (const a of [topCcw, topCw]) {
    a.rotation.x = -PI / 2; // 로컬 Z → +Y (위에서 봄)
    a.position.set(0, 2.75, ZC);
    g.add(a);
  }
  const outCcw = rotArrow(0.2, true);
  const outCw = rotArrow(0.2, false);
  for (const a of [outCcw, outCw]) {
    a.rotation.y = PI / 2; // 로컬 Z → +X (+X 쪽에서 봄)
    a.position.set(0.86, YA, ZC);
    g.add(a);
  }

  // ── 이름표 ──
  g.add(
    tag('세로 구동축(위)', v(1.0, 2.85, 0.6)),
    // 기어 이름표는 제 기어 바로 바깥 위(검증 뒤 수정: 멀리 떨어져 있던 것을 당김)
    tag('베벨 기어 C', v(-0.6, 2.3, 0.6)),
    tag('헐거운 기어 A', v(-0.95, 2.05, 0.6)),
    tag('헐거운 기어 B', v(1.15, 2.2, 0.6)),
    tag('이중 클러치(깃 위를 미끄러짐)', v(-1.3, 1.3, 0.6)),
    tag('가로 출력축', v(1.6, 1.45, 0.6)),
    tag('벨 크랭크(시프트 레버)', v(1.2, 0.8, 0.6)),
    tag('당김 막대(올리면 B 쪽)', v(-1.3, 0.6, 0.6)),
    tag('요크(홈에 걸림, 판화에 없음)', v(1.25, 1.2, 0.6))
  );

  const pose = (): void => {
    const f = phaseOf(theta);
    // 기어(1:1 마이터, 맞물림 위상은 설계표 검증값)
    gearA.rotation.x = theta + PI / 2;
    gearB.rotation.x = -theta - PI / 2;
    gearC.rotation.y = theta + PI - PI / 20;
    // 가로축·클러치
    const beta = shaftBeta(f);
    const s = clutchS(f);
    outShaft.rotation.x = beta;
    clutch.position.set(s, YA, ZC);
    clutch.rotation.x = beta;
    yoke.position.set(s, YA, ZC);
    // 벨 크랭크: 세로 팔 끝 x = s
    const phi = Math.asin(s / UP);
    bellCrank.rotation.z = -phi;
    // 당김 막대 = 가로 팔 끝 핀 (같은 φ 에서)
    rodP.position.set(PIV.x - SIDE * Math.cos(phi), PIV.y + SIDE * Math.sin(phi), PIV.z + EYE_DZ);
    // 화살표
    topCcw.visible = dirSign > 0;
    topCw.visible = dirSign < 0;
    const eps = 1e-3;
    const db = shaftBeta(phaseOf(theta + eps * dirSign)) - beta;
    const moving = Math.abs(db) > eps * 0.5 && Math.abs(db) < 1;
    outCcw.visible = moving && db > 0;
    outCw.visible = moving && db < 0;
  };
  pose();

  const STATE_TEXT: Record<ClutchState, string> = { A: 'A 걸림(정회전)', B: 'B 걸림(역회전)', N: '중립(정지)', M: '이동 중' };

  return {
    group: g,
    view: { pos: [2.4, 2.6, 5.4], target: [0, 1.7, 0.2] },
    notes: () => {
      const f = phaseOf(theta);
      const st = clutchState(f);
      const shaft = outCcw.visible ? '정방향' : outCw.visible ? '역방향' : '정지';
      return [
        { label: '클러치', value: STATE_TEXT[st] },
        { label: '가로축', value: shaft },
        { label: '세로축 : 가로축', value: '1 : 1 (걸렸을 때)' },
        { label: '주기', value: '정회전 → 정지 → 역회전 → 정지' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      if (speed !== 0) dirSign = speed < 0 ? -1 : 1;
      pose();
    }
  };
}
