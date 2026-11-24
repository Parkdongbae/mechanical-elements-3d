// 098·099·100 전용 부품 — 고리 홈 팔과 크랭크 핀 원판(098), 나선 안내 원판과 이송 종동절(099), 홈 지레와 크랭크 팔(100)
// 각도 식은 모두 구동 각 theta 의 닫힌 식이다(누적 오차 없음). 치수 검증: shots/_verify/s098.mjs, s099.mjs, s100.mjs
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

const YEL = 0xf2b619;

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

/** 로컬 Z 축 원기둥(반지름 r, z0~z1) */
function cylZ(r: number, z0: number, z1: number, mat: THREE.Material, c = 0.006): THREE.Mesh {
  const geo = lathe(rodProfile(r, 0, z1 - z0, c, c), 36);
  geo.rotateX(Math.PI / 2); // 축 Y → +Z
  return at(mesh(geo, mat), 0, 0, z0);
}

/** 로컬 Y 축 원기둥(반지름 r, y0~y1) */
function cylY(r: number, y0: number, y1: number, mat: THREE.Material, c = 0.006): THREE.Mesh {
  return mesh(lathe(rodProfile(r, y0, y1, c, c), 32), mat);
}

/** 가로로 누운 알약(스타디움) 윤곽. 두 끝 원 중심 (x0, 0)·(x1, 0) (x0 < x1), 반지름 rad. 반시계 */
export function stadiumPts(x0: number, x1: number, rad: number, seg = 24): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / seg;
    pts.push([x1 + rad * Math.cos(a), rad * Math.sin(a)]);
  }
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / seg;
    pts.push([x0 + rad * Math.cos(a), rad * Math.sin(a)]);
  }
  return pts;
}

// ───────────────────────── 098 고리 홈 팔 ─────────────────────────

/**
 * 098 치수. 원판 중심 O 와 팔 받침점 P 는 같은 높이, P 가 O 의 +x 쪽으로 D.
 * 홈 중심선 = 팔 로컬에서 중심 (−D, 0), 곧은 구간 반길이 a, 끝 반원 반지름 r 인 알약 고리.
 * 닫힘 조건: a + r = c (핀이 P 에서 가장 가까울 때 D − c = 홈의 가까운 끝, 가장 멀 때 D + c = 먼 끝).
 */
export const LOOP098 = {
  /** 원판 반지름 */
  R: 1.0,
  /** 크랭크 핀 반지름(원판 중심에서 핀까지) */
  c: 0.75,
  /** O ↔ P 거리 */
  D: 1.56,
  /** 홈 중심선 곧은 구간 반길이 */
  a: 0.425,
  /** 홈 중심선 끝 반원 반지름 */
  r: 0.325,
  /** 홈 폭 */
  gw: 0.12,
  /** 핀 반지름 */
  pinR: 0.055,
  /** 홈 바깥 테 두께 */
  rim: 0.115,
  /** 팔 두께 */
  armT: 0.08,
  /** 받침점 너머 꼬리 길이 */
  tail: 0.42
} as const;

/** 받침점에서 거리 d 인 홈 중심선 점이 팔 축과 이루는 각 β(≥ 0). d 는 [D − c, D + c] 로 자른다 */
export function loopGrooveBeta(d: number): number {
  const { D, a, r } = LOOP098;
  const xN = D - a;
  const xF = D + a;
  const dd = Math.min(xF + r, Math.max(xN - r, d));
  const dA = Math.hypot(xN, r);
  const dB = Math.hypot(xF, r);
  if (dd <= dA) {
    const cs = Math.min(1, Math.max(-1, (xN * xN + r * r - dd * dd) / (2 * xN * r)));
    const ps = Math.acos(cs);
    return Math.atan2(r * Math.sin(ps), xN - r * cs);
  }
  if (dd <= dB) return Math.atan2(r, Math.sqrt(dd * dd - r * r));
  const sn = Math.min(1, Math.max(-1, (dd * dd - xF * xF - r * r) / (2 * xF * r)));
  return Math.atan2(r * Math.sqrt(1 - sn * sn), xF + r * sn);
}

/**
 * 098 팔의 rotation.z (rad). theta = 원판 누적 각(반시계 +, theta = 0 에서 핀이 받침점 쪽 = +x).
 * 핀이 위쪽 반 바퀴(sin > 0)일 때는 홈의 위쪽 길, 아래쪽 반 바퀴일 때는 아래쪽 길에 있다 — 고리를 한 바퀴 돈다.
 * φ = sgn(sin θ)·β(d) − δ,  δ = atan2(c sin θ, D − c cos θ),  d = |P − 핀|
 */
export function loopArmAngle(theta: number): number {
  const { c, D } = LOOP098;
  const s = Math.sin(theta);
  const k = Math.cos(theta);
  const delta = Math.atan2(c * s, D - c * k);
  const d = Math.hypot(c * s, D - c * k);
  return (s >= 0 ? 1 : -1) * loopGrooveBeta(d) - delta;
}

/**
 * 098 원판 + 크랭크 핀. 그룹 원점 = 원판 중심, 원판 두께 가운데가 z = 0. rotation.z = theta.
 * 핀(name 'pin098')은 로컬 (c, 0) 에서 앞면(+z)으로 pinLen 솟는다. 뒤쪽 허브 보스 포함.
 */
export function crankPinDisk(pinLen = 0.15, thick = 0.08): THREE.Group {
  const { R, c, pinR } = LOOP098;
  const g = new THREE.Group();
  g.add(cylZ(R, -thick / 2, thick / 2, bronze(), 0.012));
  g.add(cylZ(0.17, -thick / 2 - 0.05, -thick / 2 + 0.01, darkSteel()));
  const pin = cylZ(pinR, thick / 2 - 0.01, thick / 2 + pinLen, steel(), 0.008);
  pin.position.x = c;
  pin.name = 'pin098';
  pin.userData.outline = circlePts(pinR, 28);
  markPin(pin, [0, 0, 0]);
  g.add(pin);
  // 표시: 중심에서 핀 쪽으로 밝은 줄(회전이 보이게)
  g.add(at(mesh(new THREE.BoxGeometry(c - 0.3, 0.02, 0.006), paint(YEL)), (c + 0.1) / 2 + 0.05, 0, thick / 2 + 0.002));
  setMM(g, { kind: 'crankDisk', r: R, crank: c, pinR, axis: 'z' });
  return g;
}

/**
 * 098 흔들리는 팔. 그룹 원점 = 받침점(P), 고리 홈은 로컬 −x 쪽, 꼬리는 +x 쪽, 두께 가운데가 z = 0. rotation.z = loopArmAngle(theta).
 * 홈은 뚫린 고리(핀이 보이도록) — 가운데 섬은 앞면의 띠쇠 다리 2개가 바깥 테에 잡아 준다(판화에 없음: 판화는 팔 뒷면에 판 막힌 홈).
 * userData.outlines.groove = 홈 바깥 벽(구멍), 섬 메시 userData.outline = 홈 안쪽 벽(섬).
 */
/** bore > 0 이면 받침 보스를 반지름 bore 구멍 뚫린 관으로 만들고 목·꼬리를 보스 안에서 끊는다(받침축이 꿰인다). 기본 0 = 예전 그대로 */
export function loopGrooveArm(bore = 0): THREE.Group {
  const { D, a, r, gw, rim, armT, tail } = LOOP098;
  const g = new THREE.Group();
  const x0 = -(D + a);
  const x1 = -(D - a);
  const rOut = r + gw / 2 + rim;
  const wallOut = stadiumPts(x0, x1, r + gw / 2, 28);
  const wallIn = stadiumPts(x0, x1, r - gw / 2, 28);
  // 바깥 테
  const frame = shapeFrom(stadiumPts(x0, x1, rOut, 28));
  frame.holes.push(pathFrom(wallOut));
  g.add(mesh(extrude(frame, armT, 0.008), brass()));
  // 섬
  const island = mesh(extrude(shapeFrom(wallIn), armT, 0.008), brass());
  island.name = 'island098';
  island.userData.outline = wallIn;
  g.add(island);
  // 띠쇠 다리 2개(앞면) — 섬을 테에 잡는다
  for (const bx of [-D - a * 0.55, -D + a * 0.55]) {
    g.add(at(mesh(new THREE.BoxGeometry(0.05, 2 * rOut - 0.06, 0.014), darkSteel()), bx, 0, armT / 2 + 0.007));
  }
  // 목 + 꼬리(테보다 조금 얇게 — 겹친 면이 떨리지 않게)
  const xNeck = x1 + r + gw / 2 + rim * 0.5;
  const neck: V2[] = [
    [xNeck, -0.12],
    [-0.16, -0.06],
    [tail, -0.045],
    [tail, 0.045],
    [-0.16, 0.06],
    [xNeck, 0.12]
  ];
  if (bore > 0) {
    // 받침축이 꿰이도록: 목과 꼬리를 보스 안(|x| < 0.08)에서 끊고, 보스는 구멍 뚫린 관
    const hw = (x: number): number => 0.06 + ((0.045 - 0.06) * (x + 0.16)) / (tail + 0.16);
    const cut = 0.08;
    const neckA: V2[] = [
      [xNeck, -0.12],
      [-0.16, -0.06],
      [-cut, -hw(-cut)],
      [-cut, hw(-cut)],
      [-0.16, 0.06],
      [xNeck, 0.12]
    ];
    const neckB: V2[] = [
      [cut, -hw(cut)],
      [tail, -0.045],
      [tail, 0.045],
      [cut, hw(cut)]
    ];
    g.add(mesh(extrude(shapeFrom(neckA), armT - 0.016, 0.006), brass()));
    g.add(mesh(extrude(shapeFrom(neckB), armT - 0.016, 0.006), brass()));
    g.add(mesh(lathe(tubeProfile(bore, 0.12, -armT / 2 - 0.012, armT / 2 + 0.012, 0.006), 36).rotateX(Math.PI / 2), darkSteel()));
  } else {
    g.add(mesh(extrude(shapeFrom(neck), armT - 0.016, 0.006), brass()));
    // 받침 보스
    g.add(cylZ(0.12, -armT / 2 - 0.012, armT / 2 + 0.012, darkSteel()));
  }
  g.userData.outlines = { groove: wallOut };
  setMM(g, { kind: 'loopArm', pivot: [0, 0, 0], loopCenter: [-D, 0, 0], a, r, grooveWidth: gw, tip: [tail, 0, 0], far: [x0 - rOut, 0, 0] });
  return g;
}

// ───────────────────────── 099 나선 안내 원판 ─────────────────────────

/**
 * 099 치수. 나선 리브 중심선: 매개 α ∈ [0, 2π·turns], 반지름 rIn + pitch·α/2π, 원판 로컬 각 = aStart − α
 * (반시계로 갈수록 반지름이 줄어든다 — 판화와 같은 감김). 안쪽 끝은 로컬 −90°(아래), 바깥 끝은 +90°(위).
 */
export const SPIRAL099 = {
  R: 1.0,
  pitch: 0.16,
  rIn: 0.2,
  turns: 4.5,
  /** 리브 두께(반지름 방향) */
  ribT: 0.03,
  /** 리브 높이(원판 앞면에서) */
  ribH: 0.06,
  /** 원판 두께 */
  discT: 0.08,
  /** 종동 핀(롤러) 반지름 — 골 폭 0.13 에 틈 0.005 */
  rollerR: 0.06,
  /** psi = 0 일 때 종동 핀의 반지름(안쪽에서 둘째 골의 가운데) */
  rf0: 0.44,
  /** 한 방향으로 도는 최대 각(2.25 바퀴) */
  psiMax: 4.5 * Math.PI,
  /** 원판 각속도 / theta 각속도 */
  gain: 2
} as const;

const SP_ASTART = Math.PI / 2 + 2 * Math.PI * SPIRAL099.turns;

/** 리브 중심선 점(원판 로컬). alpha ∈ [0, 2π·turns] */
export function spiralRibPoint(alpha: number, dr = 0): V2 {
  const r = SPIRAL099.rIn + (SPIRAL099.pitch * alpha) / (2 * Math.PI) + dr;
  const ang = SP_ASTART - alpha;
  return [r * Math.cos(ang), r * Math.sin(ang)];
}

/** 리브 띠의 윤곽(바깥 가장자리 → 안쪽 가장자리 되돌아옴) */
export function spiralRibOutline(seg = 72): V2[] {
  const n = Math.round(seg * SPIRAL099.turns);
  const amax = 2 * Math.PI * SPIRAL099.turns;
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) out.push(spiralRibPoint((amax * i) / n, SPIRAL099.ribT / 2));
  for (let i = n; i >= 0; i--) out.push(spiralRibPoint((amax * i) / n, -SPIRAL099.ribT / 2));
  return out;
}

/**
 * 099 원판의 rotation.z = psi (rad, 반시계 +). theta 의 세모꼴 주기 함수: gain·theta 로 psiMax 까지 갔다가 같은 빠르기로 되돌아온다.
 * 주기(theta) = 2·psiMax / gain.
 */
export function spiralDiskAngle(theta: number): number {
  const { psiMax, gain } = SPIRAL099;
  const span = 2 * psiMax;
  const m = (((gain * theta) % span) + span) % span;
  return m < psiMax ? m : span - m;
}

/** 원판 각 psi 일 때 종동 핀의 반지름(원판 중심에서 아래로 잰 거리). 반시계로 돌면 바깥(아래)으로 */
export function spiralFollowerRadius(psi: number): number {
  return SPIRAL099.rf0 + (SPIRAL099.pitch * psi) / (2 * Math.PI);
}

/** 099 원판 + 앞면의 나선 리브. 그룹 원점 = 원판 중심, 원판 두께 가운데가 z = 0, 리브는 앞면(+z) 위. rotation.z = psi */
export function spiralGuideDisk(): THREE.Group {
  const { R, discT, ribH } = SPIRAL099;
  const g = new THREE.Group();
  g.add(cylZ(R, -discT / 2, discT / 2, castIron(), 0.012));
  const outline = spiralRibOutline();
  const rib = mesh(extrude(shapeFrom(outline), ribH + 0.004, 0.004, 8), brass());
  rib.position.z = discT / 2 + ribH / 2 - 0.002;
  rib.name = 'rib099';
  rib.userData.outline = outline;
  g.add(rib);
  g.add(cylZ(0.15, -discT / 2 - 0.05, discT / 2 + 0.02, darkSteel()));
  setMM(g, { kind: 'spiralDisk', r: R, pitch: SPIRAL099.pitch, turns: SPIRAL099.turns, axis: 'z' });
  return g;
}

/**
 * 099 종동절(이송 막대). 그룹 원점 = 종동 핀 중심, 눈고리 머리 두께 가운데가 z = 0, 막대는 −y 로 내려간다.
 * 핀(name 'roller099')은 뒤(−z)로 pinBack 만큼 내려가 나선 골에 든다. 머리 아래 네모 토막, 막대, 세로줄 난 고리(널링 칼라).
 * stemLen = 핀 중심에서 막대 아래 끝까지, collarDrop = 핀 중심에서 칼라 가운데까지.
 */
export function spiralFollower(stemLen = 1.26, collarDrop = 0.66, pinBack = 0.095): THREE.Group {
  const { rollerR } = SPIRAL099;
  const g = new THREE.Group();
  // 눈고리 머리
  const ring = lathe(tubeProfile(rollerR, 0.15, -0.03, 0.03, 0.006), 40);
  ring.rotateX(Math.PI / 2);
  g.add(mesh(ring, steel()));
  // 종동 핀
  const pin = cylZ(rollerR, -pinBack, 0.04, darkSteel(), 0.005);
  pin.name = 'roller099';
  pin.userData.outline = circlePts(rollerR, 28);
  markPin(pin, [0, 0, 0]);
  g.add(pin);
  // 네모 토막
  g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), steel()), 0, -0.2, 0));
  // 막대
  g.add(cylY(0.03, -stemLen, -0.25, steel()));
  // 세로줄 난 칼라
  const colR = 0.2;
  const colH = 0.15;
  g.add(cylY(colR, -collarDrop - colH / 2, -collarDrop + colH / 2, bronze(), 0.01));
  const n = 20;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const bar = mesh(new THREE.BoxGeometry(0.012, colH - 0.03, 0.02), darkSteel());
    bar.position.set(Math.cos(ang) * colR, -collarDrop, Math.sin(ang) * colR);
    bar.rotation.y = -ang + Math.PI / 2;
    g.add(bar);
  }
  setMM(g, { kind: 'follower', pin: [0, 0, 0], stemEnd: [0, -stemLen, 0], collar: [0, -collarDrop, 0], collarR: colR, collarH: colH });
  return g;
}

/**
 * 099 안내 틀(고정). 그룹 원점 = 받침 위 가운데(막대 중심선의 바닥 점). 세로 기둥 2개(x = ±halfSpan, 높이 railH)와
 * 가로대(가운데 높이 barY, 두께 0.08 — 막대가 지나는 구멍 보스 포함. 가로대는 판화에 없음).
 */
export function feedGuide(railH = 1.02, halfSpan = 0.32, barY = 0.48): THREE.Group {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    g.add(at(mesh(new THREE.BoxGeometry(0.05, railH, 0.09), castIron()), sx * halfSpan, railH / 2, 0));
    g.add(at(mesh(new THREE.BoxGeometry(0.14, 0.03, 0.16), castIron()), sx * halfSpan, 0.015, 0));
  }
  // 가로대는 구멍 보스(바깥 반지름 0.07) 양옆 두 토막 — 막대 자리를 비운다(통짜면 막대가 박힌다)
  const bossR = 0.065;
  const halfLen = halfSpan - bossR;
  for (const sx of [-1, 1]) {
    g.add(at(mesh(new THREE.BoxGeometry(halfLen, 0.08, 0.07), castIron()), sx * (bossR + halfLen / 2), barY, 0));
  }
  const bush = lathe(tubeProfile(0.033, 0.07, barY - 0.045, barY + 0.045, 0.006), 32);
  g.add(mesh(bush, darkSteel()));
  setMM(g, { kind: 'guide', bore: [0, barY, 0], barY, halfSpan, railH });
  return g;
}

// ───────────────────────── 100 급속 귀환 크랭크 ─────────────────────────

/** 100 치수. 크랭크 축 O, 지레 받침축 P = O + (dx, dy). 지레 로컬: 받침점이 원점, 홈은 −x 쪽, 꼬리는 +x 쪽 */
export const QUICK100 = {
  /** 크랭크 반지름 */
  c: 0.58,
  dx: 1.1,
  dy: 0.13,
  /** 홈 끝 원 중심(받침점에서의 거리) 가까운 쪽 · 먼 쪽 */
  s0: 0.34,
  s1: 1.8,
  /** 홈 반폭 */
  slotR: 0.055,
  /** 지레 반폭 */
  barR: 0.1,
  pinR: 0.05,
  /** 꼬리 길이 */
  tail: 0.88,
  thick: 0.06
} as const;

/**
 * 100 지레의 rotation.z (rad). theta = 크랭크 누적 각(반시계 +, theta = 0 에서 핀이 +x).
 * 지레 로컬 +x(꼬리 쪽)가 핀 → 받침점 방향이 되게: atan2(dy − c sin θ, dx − c cos θ)
 */
export function slottedLeverAngle(theta: number): number {
  const { c, dx, dy } = QUICK100;
  return Math.atan2(dy - c * Math.sin(theta), dx - c * Math.cos(theta));
}

/** 받침점에서 핀까지 거리(홈 안에서 핀이 미끄러지는 위치) */
export function slottedLeverPinDist(theta: number): number {
  const { c, dx, dy } = QUICK100;
  return Math.hypot(dy - c * Math.sin(theta), dx - c * Math.cos(theta));
}

/**
 * 100 크랭크 팔 + 핀. 그룹 원점 = 크랭크 축 중심, 팔 두께 가운데가 z = 0. rotation.z = theta.
 * 축 쪽 보스(반지름 0.15)에서 핀 쪽(반지름 0.08)으로 좁아지는 팔. 핀(name 'pin100')은 로컬 (c, 0) 에서 +z 로 pinLen.
 */
export function crankArmPin(pinLen = 0.15): THREE.Group {
  const { c, pinR, thick } = QUICK100;
  const g = new THREE.Group();
  const r1 = 0.15;
  const r2 = 0.08;
  const gam = Math.acos((r1 - r2) / c);
  const pts: V2[] = [];
  const seg = 20;
  for (let i = 0; i <= seg; i++) {
    const ang = gam + ((2 * Math.PI - 2 * gam) * i) / seg;
    pts.push([r1 * Math.cos(ang), r1 * Math.sin(ang)]);
  }
  for (let i = 0; i <= seg; i++) {
    const ang = -gam + (2 * gam * i) / seg;
    pts.push([c + r2 * Math.cos(ang), r2 * Math.sin(ang)]);
  }
  g.add(mesh(extrude(shapeFrom(pts), thick, 0.008), bronze()));
  g.add(cylZ(0.11, -thick / 2 - 0.04, thick / 2 + 0.012, darkSteel()));
  const pin = cylZ(pinR, thick / 2 - 0.01, thick / 2 + pinLen, steel(), 0.008);
  pin.position.x = c;
  pin.name = 'pin100';
  pin.userData.outline = circlePts(pinR, 28);
  markPin(pin, [0, 0, 0]);
  g.add(pin);
  setMM(g, { kind: 'crank', crank: c, pinR, axis: 'z' });
  return g;
}

/**
 * 100 홈 지레. 그룹 원점 = 받침점, 두께 가운데가 z = 0. rotation.z = slottedLeverAngle(theta).
 * 긴 홈(로컬 x = −s1 ~ −s0)에 크랭크 핀이 든다. 받침 보스, +x 쪽 둥근 꼬리 막대(끝에 밝은 띠).
 * userData.outlines.slot_hole = 홈 윤곽(구멍).
 */
export function slottedLever(): THREE.Group {
  const { s0, s1, slotR, barR, tail, thick } = QUICK100;
  const g = new THREE.Group();
  const slot = stadiumPts(-s1, -s0, slotR, 16);
  const body = shapeFrom(stadiumPts(-s1, 0, barR, 20));
  body.holes.push(pathFrom(slot));
  g.add(mesh(extrude(body, thick, 0.008), brass()));
  g.add(cylZ(0.15, -thick / 2 - 0.015, thick / 2 + 0.015, darkSteel()));
  // 꼬리(둥근 막대, 축 = 로컬 +x)
  const tg = lathe(rodProfile(0.05, 0.1, tail, 0.006, 0.012), 28);
  tg.rotateZ(-Math.PI / 2); // 축 Y → +X
  g.add(mesh(tg, steel()));
  const band = lathe(tubeProfile(0.05, 0.056, tail - 0.1, tail - 0.05, 0.002), 28);
  band.rotateZ(-Math.PI / 2);
  g.add(mesh(band, paint(YEL)));
  g.userData.outlines = { slot_hole: slot };
  setMM(g, { kind: 'slottedLever', pivot: [0, 0, 0], slot: [-s1, -s0], slotR, tip: [tail, 0, 0], far: [-s1 - barR, 0, 0] });
  return g;
}
