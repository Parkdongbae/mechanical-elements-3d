// 154번 전용 키트 — 스터드 원판이 벨 크랭크를 두드리고, 줄에 매달린 추가 오르내린다
//  원판(스터드 3) + 벨 크랭크(아래팔 끝 롤러·위팔 끝 눈) + 받침 표준 + 추 달린 공 + 줄 닫힘식
//  치수·운동식은 순수 함수라 node 검사 스크립트가 같은 식을 쓴다. 벨 크랭크 판은 k155 의 elbowLever 를 재활용한다.
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { TAU, extrude, hexPrism, lathe, mesh, rodProfile, roundedRect, tubeProfile, type V2 } from '../../models/parts/geom';
import { markAnchor, setMM } from './mm';
import { elbowLever } from './k155';

const DEG = Math.PI / 180;
const MARK = 0xf2b619;

/** 154번 치수(판화 비: 1 px = 0.007, 전시대 윗면 y 0.18. 원판 R 105px·스터드 궤도 88px·팔 95/89px·도르래 27px) */
export const K154 = {
  /** 원판 중심 */
  D: [-0.70, 1.10] as V2,
  /** 원판 반지름 */
  R: 0.735,
  /** 원판 판 두께·가운데 z */
  plateT: 0.08,
  zPlate: 0.105,
  /** 스터드: 개수·궤도 반지름·몸통 반지름·앞으로 돌출한 z(세계) */
  studN: 3,
  studR: 0.62,
  studPin: 0.032,
  studZ: [0.145, 0.195] as [number, number],
  /** 롤러 반지름·가운데 z(세계) */
  rollerR: 0.066,
  zRoller: 0.205,
  /** 벨 크랭크 받침점 */
  P: [0.455, 0.93] as V2,
  /** 접촉자리 롤러 중심의 원판 중심~거리·방향 */
  rho0: 0.665,
  psi0: -37.2 * DEG,
  /** 위팔 길이·쉼 눈 자리(판화 자세 = t 1) */
  laUp: 0.623,
  eye0: [0.21, 1.503] as V2,
  /** 도르래: 중심·홈 바닥 반지름·줄 중심선 반지름·폭·평면 z */
  C: [1.00, 2.52] as V2,
  pulleyR: 0.19,
  ropeR: 0.20,
  pulleyW: 0.05,
  zCord: 0.28,
  /** 줄 끝(추 고리)의 x·쉼 높이, 추 공 반지름·고리~공 중심 거리 */
  hookX: 1.20,
  hookY0: 1.10,
  ballR: 0.23,
  drop: 0.30,
  /** 구동 속도(rad/s). theta 에서 omega·1 을 빼야 t=1 이 판화 자세 */
  omega: 1.6,
} as const;

const pol = (r: number, a: number): V2 => [r * Math.cos(a), r * Math.sin(a)];
const vAdd = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const vSub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const vLen = (a: V2): number => Math.hypot(a[0], a[1]);

/** 스터드 중심(세계, 각 a) */
const studAt = (a: number): V2 => vAdd(K154.D, pol(K154.studR, a));

/** 접촉 거리(스터드·롤러 중심 사이) */
export const RC154 = K154.studPin + K154.rollerR;
/** 스터드 하나 주기(원판 120° = 2.0944 rad) */
export const PERIOD154 = TAU / K154.studN;
/** 아래팔 길이(받침점~롤러 중심) */
export const LA_LOW154 = vLen(vSub(vAdd(K154.D, pol(K154.rho0, K154.psi0)), K154.P));
/** 쉼 자세의 아래팔 방향각 */
export const PHI0_154 = Math.atan2(
  K154.D[1] + K154.rho0 * Math.sin(K154.psi0) - K154.P[1],
  K154.D[0] + K154.rho0 * Math.cos(K154.psi0) - K154.P[0],
);
/** 위팔의 로컬 각(아래팔 기준. 판화 자세에서 눈이 eye0 에 오게) */
export const BETA_U154 = Math.atan2(K154.eye0[1] - K154.P[1], K154.eye0[0] - K154.P[0]) - PHI0_154;
/** 스터드가 롤러에 닿는 순간의 원판각(쉼 자리 위쪽) */
export const A_ON154 = K154.psi0 + Math.acos((K154.studR * K154.studR + K154.rho0 * K154.rho0 - RC154 * RC154) / (2 * K154.studR * K154.rho0));
/** 스터드가 롤러 닿는 반경을 벗어나는 각(받침점~스터드 거리 = 아래팔 + 접촉거리). A_ON154 바로 아래 값으로 정규화 */
const MU154 = Math.atan2(K154.D[1] - K154.P[1], K154.D[0] - K154.P[0]);
const A_BRK_RAW154 = MU154 + Math.acos(((LA_LOW154 + RC154) * (LA_LOW154 + RC154) - vLen(vSub(K154.D, K154.P)) ** 2 - K154.studR * K154.studR) / (2 * vLen(vSub(K154.D, K154.P)) * K154.studR));
export const A_BRK154 = ((((A_BRK_RAW154 + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
/** 접촉 구간 길이(원판각) */
export const SWEEP154 = A_ON154 - A_BRK154;
/** 접촉이 끝나는 순간의 벨 크랭크 각(스터드가 닿는 반경 밖으로 나가는 순간 = 방향각 그대로) */
export const PHI_BRK154 = Math.atan2(studAt(A_BRK154)[1] - K154.P[1], studAt(A_BRK154)[0] - K154.P[0]);
/** 눈 → 도르래 접점 직선 + 감김 호 + 도르래 → 고리 수직 길이. cord154 가 CORD_LEN154 을 읽으므로 같은 식을 직접 푼다(초기화 순환 방지) */
export const CORD_LEN154 =
  (() => {
    const dx = K154.C[0] - K154.eye0[0];
    const dy = K154.C[1] - K154.eye0[1];
    const d = Math.hypot(dx, dy);
    const tau = Math.atan2(dy, dx) + Math.asin(Math.max(-1, Math.min(1, K154.ropeR / d)));
    const aIn = Math.atan2(Math.cos(tau), -Math.sin(tau));
    const wrap = ((aIn % TAU) + TAU) % TAU;
    const straight = Math.sqrt(Math.max(0, d * d - K154.ropeR * K154.ropeR));
    return straight + wrap * K154.ropeR + (K154.C[1] - K154.hookY0);
  })();
/** 쉼 자세의 줄 통과량(직선 + 호). 도르래 자전각의 기준 */
const REST_PASS154 = (() => {
  const c = cord154(K154.eye0);
  return Math.sqrt(c.d * c.d - K154.ropeR * K154.ropeR) + c.wrap * K154.ropeR;
})();

export interface Cord154 {
  /** 줄 끝(추 고리 자리) */
  hook: V2;
  /** 도르래에 감긴 각(도) */
  wrapDeg: number;
  /** 감긴 각(rad) — 길이 계산은 이 값을 쓴다(deg 오차가 쌓이지 않게) */
  wrap: number;
  /** 눈~도르래 중심 거리(검사용) */
  d: number;
}

/** 줄의 닫힌 자리: 눈이 주어지면 접선·감긴 각·고리 높이(줄 길이 CORD_LEN154 일정). 도르래 위는 시계 감김(위→오른쪽) */
export function cord154(eye: V2): Cord154 {
  const dx = K154.C[0] - eye[0];
  const dy = K154.C[1] - eye[1];
  const d = Math.hypot(dx, dy);
  // 점 → 홈(줄 중심선 반지름 ropeR, 시계 s=−1) 접선 — ropeAround 와 같은 식
  const tau = Math.atan2(dy, dx) + Math.asin(Math.max(-1, Math.min(1, K154.ropeR / d)));
  const aIn = Math.atan2(Math.cos(tau), -Math.sin(tau)); // 진입 접점 = C − ropeR·(ty, −tx)
  const wrap = ((aIn % TAU) + TAU) % TAU;
  const straight = Math.sqrt(Math.max(0, d * d - K154.ropeR * K154.ropeR));
  const hookY = K154.C[1] - (CORD_LEN154 - straight - wrap * K154.ropeR);
  return { hook: [K154.hookX, hookY], wrapDeg: (wrap * 180) / Math.PI, wrap, d };
}

export interface State154 {
  /** 벨 크랭크 rotation.z(아래팔이 로컬 +X) */
  phi: number;
  /** 원판 rotation.z(스터드 0 이 로컬 +X, 시계 = 음수로 쌓임) */
  diskRot: number;
  /** 'contact' = 스터드가 롤러를 미는 중, 'return' = 추 무게로 되돌아가는 중 */
  mode: 'contact' | 'return';
  /** 스터드 하나 주기 안의 강(0 = 접촉 시작 = 판화 자세) */
  u: number;
  /** 롤러 자전각(원판 면을 구른 근사) */
  rollerRoll: number;
  /** 위팔 끝 눈의 세계 자리 */
  eye: V2;
  /** 도르래 rotation.z(줄 통과량/ropeR — 감김 호 변화까지 넣은 누적 근사) */
  spin: number;
  /** 도르래 감긴 각(도) */
  wrapDeg: number;
  /** 추 고리 높이 */
  hookY: number;
  /** 고리가 쉼 자리에서 올라간 양 */
  lift: number;
}

/**
 * 154번 운동식(모두 theta 의 닫힌 식). 한 주기 = PERIOD154(원판 120°): 앞부분(SWEEP154)에 스터드가 롤러를
 * 스치며 벨 크랭크를 밀어 추를 올리고, 나머지에서 추 무게로 되돌아와 다음 스터드를 기다린다.
 * theta 에서 K154.omega(t=1 기준)를 뺀 각으로 주기를 잡아 t=1 이 판화 자세(접촉 시작)다.
 */
export function state154(theta: number): State154 {
  const s = theta - K154.omega; // 접촉 진행각(t=1 에서 0)
  const u = ((s % PERIOD154) + PERIOD154) % PERIOD154;
  let phi: number;
  const contact = u <= SWEEP154;
  if (contact) {
    // 스터드가 롤러를 미는 중: |팔끝 − 스터드| = RC154 를 만족하는 팔각(스터드 방향의 반시계 쪽 해)
    const V = vSub(studAt(A_ON154 - u), K154.P);
    const d = vLen(V);
    const c = Math.acos(Math.max(-1, Math.min(1, (LA_LOW154 * LA_LOW154 + d * d - RC154 * RC154) / (2 * LA_LOW154 * d))));
    phi = Math.atan2(V[1], V[0]) + c;
  } else {
    // 복귀: 코사인 이완으로 정확히 쉼 각까지(다음 스터드가 닿는 순간과 맞물린다)
    const v = (u - SWEEP154) / (PERIOD154 - SWEEP154);
    phi = PHI_BRK154 + (PHI0_154 - PHI_BRK154) * (1 - Math.cos(Math.PI * v)) / 2;
  }
  const eye = vAdd(K154.P, pol(K154.laUp, phi + BETA_U154));
  const cord = cord154(eye);
  const pass = Math.sqrt(cord.d * cord.d - K154.ropeR * K154.ropeR) + cord.wrap * K154.ropeR;
  return {
    phi,
    diskRot: A_ON154 - s,
    mode: contact ? 'contact' : 'return',
    u,
    rollerRoll: (-LA_LOW154 * (phi - PHI0_154)) / K154.rollerR,
    eye,
    spin: (pass - REST_PASS154) / K154.ropeR,
    wrapDeg: cord.wrapDeg,
    hookY: cord.hook[1],
    lift: cord.hook[1] - K154.hookY0,
  };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z축 원기둥(z0~z1, 양끝 모따기) */
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 32): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Z축 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/**
 * 스터드 원판(구동): 회전축 = 로컬 Z, 원점 = 판 가운데(세계 z K154.zPlate), 스터드 0 이 로컬 +X.
 * 세계 배치 (K154.D, K154.zPlate), rotation.z = state154().diskRot. 허브 구멍 0.046 — 받침 축(0.043) 위에 도련다.
 */
export function studdedDisk154(): THREE.Group {
  const g = new THREE.Group();
  const iron = castIron({ roughness: 0.55 });
  g.add(mesh(cylZ(K154.R, -K154.plateT / 2, K154.plateT / 2, 0.006, 64), iron));
  g.add(mesh(tubeZ(0.046, 0.1, -0.055, K154.plateT / 2 - 0.005, 0.005, 48), darkSteel()));
  for (let k = 0; k < K154.studN; k++) {
    const a = (k / K154.studN) * TAU;
    const p = pol(K154.studR, a);
    g.add(meshAt(cylZ(K154.studPin, K154.studZ[0] - K154.zPlate, K154.studZ[1] - K154.zPlate, 0.005, 20), steel(), p[0], p[1], 0));
    g.add(meshAt(new THREE.CylinderGeometry(0.013, 0.013, 0.005, 14).rotateX(Math.PI / 2), paint(MARK), p[0], p[1], K154.studZ[1] - K154.zPlate + 0.002));
  }
  // 표시점: 판이 도는 게 보이게
  g.add(meshAt(new THREE.BoxGeometry(K154.R * 0.22, 0.02, 0.008), paint(MARK), K154.R * 0.6, 0, K154.plateT / 2 + 0.001));
  setMM(g, { kind: 'wheel', fn: 'studdedDisk154', axis: 'z', rim: 'flat', r: K154.R, width: K154.plateT, span: [-K154.plateT / 2, K154.plateT / 2] });
  return g;
}

/**
 * 벨 크랭크: 아래팔(로컬 +X, 끝 핀 'rollerPin'에 롤러 'roller'가 걸린다) + 위팔(BETA_U154, 끝 눈 'eyeUp'에 줄이 묶인다).
 * 회전축 = 로컬 Z, 원점 = 받침 구멍 중심. 세계 배치 (K154.P, K154.zCord), rotation.z = state154().phi.
 * 롤러 자전은 crank.getObjectByName('roller').rotation.z = state154().rollerRoll.
 */
export function bellCrank154(): THREE.Group {
  const g = elbowLever(
    [
      { len: LA_LOW154, angle: 0, endR: 0.095, rootR: 0.14, pin: { r: 0.016, z0: -0.12, z1: 0.01, name: 'rollerPin', at: -0.075 } },
      { len: K154.laUp, angle: BETA_U154, endR: 0.06, rootR: 0.075, pin: { r: 0.02, z0: -0.02, z1: 0.02, name: 'eyePin', at: 0 } },
    ],
    { hubR: 0.15, boreR: 0.034, thick: 0.07, blend: 6, metal: 'iron' },
  );
  // 롤러(강철, 스터드에 밀리면 구른다 — 판화의 아래팔 끝 작은 바퀴)
  const roller = new THREE.Group();
  roller.name = 'roller';
  roller.position.set(LA_LOW154, 0, -0.075);
  roller.add(mesh(cylZ(K154.rollerR, -0.031, 0.031, 0.005, 40), steel()));
  roller.add(mesh(tubeZ(0.017, 0.032, -0.032, 0.032, 0.004, 28), darkSteel()));
  roller.add(meshAt(new THREE.BoxGeometry(K154.rollerR * 0.9, 0.014, 0.006), paint(MARK), K154.rollerR * 0.45, 0, 0.033));
  setMM(roller, { kind: 'roller', r: K154.rollerR, axis: 'z' });
  g.add(roller);
  // 핀 끝 캡 — 롤러가 핀에서 빠지지 않게
  g.add(meshAt(cylZ(0.024, -0.12, -0.108, 0.004, 20), darkSteel(), LA_LOW154, 0, 0));
  // 눈(위팔 끝 — 줄이 묶이는 점 = 눈고리 중심)
  const eyePos = pol(K154.laUp, BETA_U154);
  const eye = mesh(new THREE.TorusGeometry(0.028, 0.009, 12, 28), steel());
  eye.position.set(eyePos[0], eyePos[1], 0);
  eye.name = 'eyeUp';
  markAnchor(eye);
  g.add(eye);
  setMM(g, { kind: 'lever', fn: 'bellCrank154' });
  return g;
}

/**
 * 받침 표준(판화의 벨 shaped 스탠드): 받침판 + 세로 기둥 + 목 + 구멍이 +Z 인 고리 + 고정 축 + 앞 너트.
 * 원점 = 받침판 바닥 가운데, 고리 중심은 (0, h, 0). 기둥·목은 고리 뒷면(z −0.02)에서 멈춰 축에 박히지 않는다.
 * 원판 받침 standard154(0.92, 0.046, 0.20), 벨 크랭크 받침 standard154(0.75, 0.034, 0.36).
 */
export function standard154(h: number, bore: number, z1: number): THREE.Group {
  const g = new THREE.Group();
  const body = castIron({ roughness: 0.5 });
  const metal = darkSteel();
  // 받침판
  const baseGeo = extrude(roundedRect(-0.26, -0.17, 0.26, 0.17, 0.04), 0.05, 0.008);
  baseGeo.rotateX(Math.PI / 2);
  baseGeo.translate(0, 0.025, 0);
  g.add(mesh(baseGeo, body));
  // 세로 기둥(라테, 뒤로 0.075 치우침) — 꼭대기에서 목으로 이어진다
  const y1 = 0.05;
  const yT = h - 0.05;
  const span = yT - y1;
  const prof: V2[] = [
    [0, y1],
    [0.15, y1],
    [0.15, y1 + 0.03],
    [0.066, y1 + span * 0.45],
    [0.06, y1 + span * 0.72],
    [0.082, yT - 0.02],
    [0.088, yT],
    [0, yT],
  ];
  const post = mesh(lathe(prof, 40), body);
  post.position.z = -0.075;
  g.add(post);
  // 목: 기둥 → 고리 뒷면(z −0.02)까지
  const neck = new THREE.BoxGeometry(0.11, 0.075, 0.135);
  g.add(meshAt(neck, body, 0, h - 0.02, -0.0875));
  // 고리(구멍 +Z) + 고정 축 + 앞 너트
  g.add(meshAt(tubeZ(bore, bore + 0.036, -0.02, 0.04, 0.005, 36), metal, 0, h, 0));
  const shaftR = bore - 0.003;
  g.add(meshAt(cylZ(shaftR, -0.016, z1, 0.004, 24), steel(), 0, h, 0));
  const nutGeo = hexPrism(shaftR * 2.2, shaftR * 0.9, true, true, shaftR * 1.05);
  nutGeo.rotateX(Math.PI / 2);
  g.add(meshAt(nutGeo, metal, 0, h, z1 - shaftR * 0.45));
  setMM(g, { kind: 'pillow', axis: 'z', bossY: h });
  return g;
}

/** 추 달린 공(판화의 맨 아래 공): 원점 = 줄 끝이 묶이는 고리 중심, 공은 그 아래 drop 에 온다. 세계 배치 (hookX, hookY, zCord) */
export function weightBall154(): THREE.Group {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(0.028, 0.009, 12, 28), steel());
  ring.name = 'ballRing';
  markAnchor(ring);
  g.add(ring);
  g.add(mesh(lathe(rodProfile(0.014, -0.1, -0.02, 0.004), 16), steel()));
  const ball = mesh(new THREE.SphereGeometry(K154.ballR, 32, 24), darkSteel());
  ball.position.y = -K154.drop;
  g.add(ball);
  const mz = K154.ballR * Math.sqrt(1 - 0.25 * 0.25) - 0.004;
  g.add(meshAt(new THREE.BoxGeometry(K154.ballR * 0.8, 0.02, 0.01), paint(MARK), 0, -K154.drop + K154.ballR * 0.25, mz));
  setMM(g, { kind: 'weight', fn: 'weightBall154', r: K154.ballR, drop: K154.drop });
  return g;
}
