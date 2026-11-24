// 057 내접 기어 이중 구동(유성 기어) — 위 풀리 하나가 열린 평벨트로 링 기어 바깥 테를, 엇걸이 로프로 태양 풀리를 돌려
// 링과 태양이 서로 반대로 돌고, 둘 사이 맨 아래 피니언은 제자리에서 돌면서 공통 중심 둘레로도 천천히 돈다 (판화 57번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import {
  Belt,
  ROPE_R,
  beltPathAround,
  carryTags,
  displayStand,
  internalGear,
  lever,
  meshAngle,
  openBeltPath,
  planar,
  pulley,
  rod,
  rotArrow,
  setMM,
  shaftZ,
  spurGear,
  tag,
  type V2
} from '../kit';
import { carrierArm, guideRoller, ringFlange } from '../kit/k057';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { wood } from '../../models/materials';

// ── 치수(설계표 057) ──
const MOD = 0.035;
const NR = 48; // 링(안쪽 이)
const NS = 24; // 태양
const NP = 12; // 피니언
const RP_S = (NS * MOD) / 2; // 0.42
const RP_P = (NP * MOD) / 2; // 0.21
const ORBIT = RP_S + RP_P; // 0.63 = 링 피치 0.84 − 0.21
const C: V2 = [0, 1.22]; // 링·태양 공통 중심
const T: V2 = [0, 2.76]; // 윗 풀리 중심
const ZG = 0.1; // 기어·열린 벨트 층
const ZR = 0.3; // 엇걸이 로프·태양 풀리·윗 풀리 앞 단 층
const ZC = -0.14; // 캐리어(기어 뒤)
const ZF = 0.03; // 링 뒷 플랜지·받침 롤러
const R_TOP = 0.32; // 윗 풀리 두 단
const R_SUNP = 0.36; // 태양 풀리
const RING_WALL = 0.09;
const RING_W = 0.12;
const RING_ROUT = RP_S * 2 + 1.1 * MOD + RING_WALL; // 0.84 + 0.0385 + 0.09 = 0.9685
const RING_RIM = RING_ROUT + 0.012; // 황동 림띠 바깥 0.9805
const BELT_T = 0.02; // 평벨트 두께
const RB_TOP = R_TOP + BELT_T / 2; // 0.33 평벨트 중심선(윗 풀리)
const RB_RING = RING_RIM + BELT_T / 2; // 0.9905 평벨트 중심선(링 테)
const RR_TOP = R_TOP + 0.01; // 0.33 로프 중심(홈)
const RR_SUN = R_SUNP + 0.01; // 0.37
const FL_IN = 0.88;
const FL_OUT = 1.04;
const ROLLER_R = 0.09;
const ROLLER_W = 0.08;
const ROLLER_GROOVE = ROLLER_R * 0.82; // 롤러 홈 바닥 반지름(guideRoller 단면)
const ROLLER_ORBIT = FL_OUT + ROLLER_GROOVE + 0.002; // 홈 바닥이 플랜지 테에 닿는 자리
const ROLLER_ANG = [0, 180, 225, 315].map((d) => (d * Math.PI) / 180);
const CRANK_LEN = 0.48;
const CRANK_A0 = (160 * Math.PI) / 180; // θ=0 에서 크랭크가 왼쪽 위
const RING_PHASE = -1.8326; // θ=0 에서 피니언 이가 링 이골에 드는 위상(−105°)

// 속도 계수(윗 풀리 각 1 당)
const K_R = RB_TOP / RB_RING; // +0.3332 링(같은 방향)
const K_S = -RR_TOP / RR_SUN; // −0.8919 태양(반대 방향)
const K_C = (NS * K_S + NR * K_R) / (NS + NR); // −0.0752 캐리어(윌리스 식)
const K_P = 3 * K_C - 2 * K_S; // +1.558 피니언 자전

// 엇걸이 로프 교차부
const AMP = ROPE_R + 0.01; // 교차점에서 한 가닥이 비켜 나는 z (틈 0.02)
const CLEAR = 0.2; // 접점에서 이만큼은 홈 평면 그대로
const SUB = 40;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 엇걸이 로프 3D 점열: 호는 z = ZR, 두 직선 가닥만 교차점에서 ±AMP 로 비켜 간다(m002 방식) */
function crossedPath3D(): THREE.Vector3[] {
  const seg = 72;
  const flat = beltPathAround(
    [
      { c: T, r: RR_TOP, ccw: true },
      { c: C, r: RR_SUN, ccw: false }
    ],
    seg
  );
  // [0]=윗 풀리 출발점, [1]=태양 풀리 도착점, 태양 호…, [seg+1]=태양 출발점, [seg+2]=윗 풀리 도착점, 윗 호…
  const out: THREE.Vector3[] = [];
  const strand = (p: V2, q: V2, sign: number): void => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let i = 0; i <= SUB; i++) {
      const u = i / SUB;
      const s = Math.min(u, 1 - u) * len;
      const w = Math.min(1, Math.max(0, (s - CLEAR) / (len / 2 - CLEAR)));
      out.push(v(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, ZR + sign * AMP * w * w * (3 - 2 * w)));
    }
  };
  const arcPts = (from: number, to: number): void => {
    for (let i = from; i < to; i++) out.push(v(flat[i]![0], flat[i]![1], ZR));
    carryTags(flat.slice(from, to), out.slice(out.length - (to - from))); // 검사 표식(감긴 호)
  };
  strand(flat[0]!, flat[1]!, -1);
  arcPts(2, seg + 1);
  strand(flat[seg + 1]!, flat[seg + 2]!, +1);
  arcPts(seg + 3, flat.length);
  return out;
}

export default function buildM057(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // ── 윗 풀리(2단) + 크랭크: 한 그룹이 함께 돈다 ──
  const top = new THREE.Group();
  top.name = 'topPulley';
  top.position.set(T[0], T[1], 0);
  const topBack = pulley(R_TOP, { flat: true, width: 0.12, driver: true });
  topBack.name = 'topPulleyBack';
  topBack.position.z = ZG;
  const topFront = pulley(R_TOP, { width: 0.12, driver: true });
  topFront.name = 'topPulleyFront';
  topFront.position.z = ZR;
  // 크랭크 손잡이는 팔 끝에서 앞(+Z, 보는 사람 쪽)으로 선다 — 키트 lever 의 손잡이는 팔과 같은 면에 눕는 지렛대용이라 쓰지 않는다
  const crank = lever(CRANK_LEN);
  const gripGeo = lathe(rodProfile(0.022, 0, 0.16, 0.008, 0.01), 24);
  gripGeo.rotateX(Math.PI / 2); // 축 +Y → +Z
  const grip = mesh(gripGeo, wood());
  grip.position.set(CRANK_LEN - 0.02, 0, 0.045);
  crank.add(grip);
  crank.position.z = 0.42;
  crank.rotation.z = CRANK_A0;
  top.add(topBack, topFront, crank);
  g.add(top, shaftZ(T[0], T[1], 0.484, 0.045)); // 끝 너트(두께 0.04)가 크랭크 앞면(z 0.442) 바로 앞 — 0.47 이면 도는 크랭크에 0.013 박혔다

  // ── 링 기어(안쪽 이) + 뒷 플랜지 ──
  const ring = internalGear(NR, MOD, { width: RING_W, wall: RING_WALL });
  ring.name = 'ring';
  ring.position.set(C[0], C[1], ZG);
  // 열린 평벨트가 감기는 바깥 황동 테 — 검사용 바퀴 표식(형상 없음)
  const ringRim = new THREE.Object3D();
  ringRim.name = 'ringRim';
  setMM(ringRim, { kind: 'wheel', fn: 'ringRim', axis: 'z', rim: 'flat', r: RING_RIM, bottom: RING_RIM, outer: RING_RIM, width: RING_W + 0.012, span: [-(RING_W + 0.012) / 2, (RING_W + 0.012) / 2] });
  ring.add(ringRim);
  const flange = ringFlange(FL_IN, FL_OUT, 0.022);
  flange.name = 'ringFlange';
  flange.position.set(C[0], C[1], ZF);
  g.add(ring, flange);

  // ── 받침 롤러 4개(판화에 없음) ──
  const rollers: THREE.Group[] = [];
  for (const a of ROLLER_ANG) {
    const x = C[0] + Math.cos(a) * ROLLER_ORBIT;
    const y = C[1] + Math.sin(a) * ROLLER_ORBIT;
    const r = guideRoller(ROLLER_R, ROLLER_W);
    r.position.set(x, y, ZF);
    rollers.push(r);
    g.add(r, shaftZ(x, y, ZF + ROLLER_W / 2 + 0.02, 0.025));
  }

  // ── 태양 축: 태양 기어 + 태양 풀리 ──
  const sun = spurGear(NS, MOD, { width: 0.12, spokes: 6 });
  sun.name = 'sun';
  sun.position.set(C[0], C[1], ZG);
  const sunPulley = pulley(R_SUNP, { width: 0.12, spokes: 4 });
  sunPulley.name = 'sunPulley';
  sunPulley.position.set(C[0], C[1], ZR);
  g.add(sun, sunPulley, shaftZ(C[0], C[1], 0.45, 0.045));

  // ── 캐리어 팔 + 피니언 핀(판화에 없음) ──
  const carrier = carrierArm(ORBIT);
  carrier.name = 'carrier';
  carrier.position.set(C[0], C[1], ZC);
  const pin = rod(v(ORBIT, 0, 0), v(ORBIT, 0, 0.2 - ZC), 0.03); // 캐리어 로컬: 끝 보스에서 피니언 앞까지
  pin.name = 'pinionPin';
  carrier.add(pin);
  g.add(carrier);

  // ── 피니언 ──
  const pinion = spurGear(NP, MOD, { width: 0.12, spokes: 3 });
  pinion.name = 'pinion';
  g.add(pinion);

  // ── 벨트 두 줄 ──
  const openBelt = new Belt(planar(openBeltPath(T, RB_TOP, C, RB_RING, 48), ZG), { style: 'flat', width: 0.11, thickness: BELT_T });
  openBelt.group.name = 'openBelt';
  const crossRope = new Belt(crossedPath3D());
  crossRope.group.name = 'crossRope';
  g.add(openBelt.group, crossRope.group);

  // ── 회전 화살표 ──
  const aTop = rotArrow(0.45, true);
  aTop.position.set(T[0], T[1], 0.47);
  const aRing = rotArrow(1.08, true);
  aRing.position.set(C[0], C[1], 0.2);
  // 태양 화살표는 피니언 화살표(공전 반지름 0.63 − 0.18)와 로프(0.37) 안쪽 — 0.5 면 도는 피니언 화살표와 겹친다
  const aSun = rotArrow(0.28, false);
  aSun.position.set(C[0], C[1], 0.42);
  const aPin = rotArrow(0.18, true);
  g.add(aTop, aRing, aSun, aPin);

  // ── 이름표 ──
  const pinTag = tag('피니언(자전+공전)', v(0, 0, 0.3));
  g.add(
    tag('구동 풀리', v(0.75, 3.05, 0.4)),
    tag('링 기어(안쪽 이, 열린 벨트)', v(-1.35, 1.9, 0.3)),
    tag('태양 기어(엇걸이 로프)', v(1.3, 1.75, 0.4)),
    pinTag,
    tag('캐리어(판화에 없는 받침)', v(1.25, 0.45, 0.1))
  );

  const pose = (): void => {
    const ts = K_S * theta;
    const tr = RING_PHASE + K_R * theta;
    const phi = -Math.PI / 2 + K_C * theta;
    const px = C[0] + ORBIT * Math.cos(phi);
    const py = C[1] + ORBIT * Math.sin(phi);
    top.rotation.z = theta;
    sun.rotation.z = ts;
    sunPulley.rotation.z = ts;
    ring.rotation.z = tr;
    flange.rotation.z = tr;
    for (const r of rollers) r.rotation.z = (-tr * FL_OUT) / ROLLER_GROOVE;
    carrier.rotation.z = phi;
    pinion.position.set(px, py, ZG);
    pinion.rotation.z = meshAngle(C, NS, ts, [px, py], NP);
    aPin.position.set(px, py, 0.22);
    pinTag.position.set(px - 1.05, py - 0.12, 0.3); // 왼쪽 — 오른쪽 아래 캐리어 이름표와 겹치지 않게
    openBelt.setOffset(theta * RB_TOP);
    crossRope.setOffset(theta * RR_TOP);
  };
  pose();

  const turns = (a: number): string => (a / (Math.PI * 2)).toFixed(2);
  return {
    group: g,
    view: { pos: [0.6, 2.0, 6.4], target: [0, 1.7, 0.1] },
    notes: () => [
      { label: '링 : 태양 속도비', value: `${K_R.toFixed(2)} : ${K_S.toFixed(2)} (반대 방향)` },
      { label: '피니언 자전', value: `${turns(K_P * theta)} 바퀴` },
      { label: '피니언 공전', value: `${turns(K_C * theta)} 바퀴 (느림, 태양과 같은 방향)` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
