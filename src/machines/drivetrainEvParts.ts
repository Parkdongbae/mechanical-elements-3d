// 전기차 구동계 절차 모델 (싱글·듀얼 모터 미션 공용, 작업 지시서 10-B)
//
// export 요약 — 좌표는 기계 root 로컬(three.js, Y-up, 앞 = -Z, drivetrainParts.ts의 CAR 규약)이며
// 반환 그룹은 이미 최종 조립 위치에 놓여 있다(바깥 그룹 position = 0). 인트로 낙하는 그룹 position.y로만 준다.
//   buildEvMotorUnit(spec)                → { group, hvPorts }  원통형 모터(냉각 리브) + 감속기 케이스 + 인버터 (설계 좌표)
//   placeEvMotorUnit(at, scale, spec)     → { group, hvPorts }  위 유닛을 차축 위치·축척으로 배치(단자 좌표도 root 로컬)
//   buildEvDifferential / placeEvDifferential                   차축선 위 차동기어 하우징(감속기 케이스에 물림)
//   buildEvBatteryPack(spec, runs)        → THREE.Group         바닥 배터리 팩(모듈 구획·테두리 프레임·행거) + 주황 고전압 케이블
//   buildEvHalfShaftPair(outL, outR)      → THREE.Group         공용 반축 두 개(차동기어 출력 → 바퀴 허브), 원점 = 차축 중심
//   EvCarBase / EvAnswerPart                                   싱글·듀얼 모터 미션 공용 기계 로직(인트로·정답 설치·복원·라벨·바퀴·차체)
// 바퀴·차체·구동 반축·차축은 drivetrainParts.ts(10-A)의 공용 빌더를 쓴다 — 5종 구동방식이 같은 바퀴·차체여야 하므로.
//
// 각 빌더는 호출마다 새 재질을 만든다(인트로 페이드에서 부품별 opacity를 따로 바꾸기 때문).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { aluminum, castIron, darkSteel, paint, plastic, steel } from '../models/materials';
import { extrude, lathe, merge, mesh, roundedRect, TAU, type V2 } from '../models/parts/geom';
import { BaseMachine } from './types';
import { makeCalloutLine, makeLabelSprite } from './stlShared';
import { buildCaliper, buildCarShell, buildHalfShaftBetween, buildLadderFrame, buildWheel, CAR } from './drivetrainParts';

/** 고전압 케이블 주황(실차 규격 색) */
export const HV_ORANGE = 0xf25c05;

// ─────────────────────────── 공용 도구 ───────────────────────────

/** (r, x) 프로파일을 X축 둘레로 회전 — lathe(Y축) 결과를 +Y→+X로 눕힌다 */
function latheX(profile: V2[], segs = 48): THREE.BufferGeometry {
  const g = lathe(profile, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 반지름이 다른 두 원의 볼록 껍질(감속기 케이스 단면). 좌표 (u, v) = (씬 z, 씬 y) */
function hullShape(u1: number, v1: number, r1: number, u2: number, v2: number, r2: number): THREE.Shape {
  const d = Math.hypot(u2 - u1, v2 - v1);
  const phi = Math.atan2(v2 - v1, u2 - u1);
  const a = Math.acos(THREE.MathUtils.clamp((r1 - r2) / d, -1, 1));
  const s = new THREE.Shape();
  s.absarc(u1, v1, r1, phi + a, phi - a + TAU, false);
  s.absarc(u2, v2, r2, phi - a, phi + a, false);
  s.closePath();
  return s;
}

/** YZ 평면 단면(u=z, v=y)을 X 방향 두께로 압출해 x0~x1 사이에 놓는다 */
function extrudeX(shape: THREE.Shape, x0: number, x1: number, c: number): THREE.BufferGeometry {
  const g = extrude(shape, Math.abs(x1 - x0), c, 32, 2);
  g.rotateY(-Math.PI / 2); // 로컬 X → 씬 Z, 로컬 Z(두께) → 씬 X
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

/** X축 방향 짧은 원기둥(볼트 머리·보스) */
function cylX(r: number, len: number, segs = 16): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 육각 볼트 머리(축 방향 = +Y 기준) */
function boltHead(af: number, h: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(af * 0.577, af * 0.577, h, 6);
}

// ─────────────────────────── 구동 모터 유닛 ───────────────────────────

export interface EvMotorUnitSpec {
  /** 차축선 중심(y, z). x는 0 */
  axleY: number;
  axleZ: number;
  /** 모터 축 중심(y, z) — 차축과 평행(가로 배치), 감속기로 차축에 동력을 넘긴다 */
  motorY: number;
  motorZ: number;
  /** 모터 하우징 반지름(리브 끝) */
  motorR: number;
  /** 모터 하우징 x 범위(감속기 케이스 바깥면 x0 쪽에서 시작) */
  motorX0: number;
  motorX1: number;
  /** 감속기 케이스 x 범위(모터의 -X 쪽) */
  caseX0: number;
  caseX1: number;
  /** 차체 프레임 레일에 거는 마운트 브래킷(좌·우 레일 x, 레일 아랫면 y) — 없으면 생략 */
  mounts?: { leftX: number; rightX: number; y: number };
}

export interface HvPort {
  /** 인버터 고전압 단자 끝(root 로컬) */
  pos: THREE.Vector3;
  /** 케이블이 빠져나가는 방향(단위 벡터) */
  dir: THREE.Vector3;
}

export interface EvMotorUnit {
  group: THREE.Group;
  hvPorts: HvPort[];
}

/**
 * 구동 모터 유닛: 리브 달린 원통형 모터(차축과 평행) + 모터 축과 차축을 잇는 감속기 케이스 + 모터 위 인버터.
 * 감속기 케이스는 "모터 축 원 + 차축 원"의 볼록 껍질 단면이라 2단 감속 기어열이 들어 있는 모양으로 읽힌다.
 */
export function buildEvMotorUnit(s: EvMotorUnitSpec): EvMotorUnit {
  const group = new THREE.Group();
  group.name = 'evMotorUnit';
  const housingMat = aluminum({ color: 0xb9c1ca, roughness: 0.42 });
  const caseMat = aluminum({ color: 0x9aa3ad, roughness: 0.55 });
  const darkMat = darkSteel({ color: 0x3c434b });
  const boltMat = steel({ roughness: 0.3 });
  // 차 중앙(배터리) 쪽 z 방향 — 모터는 차축 바깥쪽(앞 유닛은 앞, 뒤 유닛은 뒤)에 있으므로 모터→차축 방향
  const inward = Math.sign(s.axleZ - s.motorZ) || 1;

  // ── 모터 하우징: 원주 방향 냉각 리브 + 양끝 플랜지 + 엔드벨(+X) ──
  const rT = s.motorR;
  const rB = s.motorR * 0.9;
  const x0 = s.motorX0;
  const x1 = s.motorX1;
  const prof: V2[] = [[0, x0], [rT * 0.97, x0], [rT, x0 + 0.006], [rT, x0 + 0.04], [rB, x0 + 0.046]];
  const ribStart = x0 + 0.06;
  const ribEnd = x1 - 0.06;
  const ribs = Math.max(4, Math.round((ribEnd - ribStart) / 0.034));
  const pitch = (ribEnd - ribStart) / ribs;
  for (let i = 0; i < ribs; i++) {
    const a = ribStart + i * pitch;
    const w = pitch * 0.5;
    prof.push([rB, a], [rT - 0.004, a + 0.003], [rT - 0.004, a + w - 0.003], [rB, a + w]);
  }
  prof.push(
    [rB, x1 - 0.046],
    [rT, x1 - 0.04],
    [rT, x1 - 0.006],
    [rT * 0.95, x1],
    // 엔드벨: 완만한 돔 + 베어링 보스
    [rT * 0.9, x1 + 0.012],
    [rT * 0.72, x1 + 0.04],
    [rT * 0.42, x1 + 0.058],
    [rT * 0.3, x1 + 0.062],
    [rT * 0.3, x1 + 0.078],
    [rT * 0.24, x1 + 0.084],
    [0, x1 + 0.084]
  );
  const housing = latheX(prof, 56);
  housing.translate(0, s.motorY, s.motorZ);
  mesh(housing, housingMat, group);

  // 엔드벨 타이볼트 6개
  const bolts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const b = cylX(0.011, 0.016, 10);
    b.translate(x1 + 0.016, s.motorY + Math.sin(a) * rT * 0.8, s.motorZ + Math.cos(a) * rT * 0.8);
    bolts.push(b);
  }

  // ── 감속기 케이스: 모터 축 원 + 차축 원의 껍질 단면, 테두리 플랜지와 볼트 ──
  const rCaseM = rT * 1.02;
  const rCaseA = 0.17;
  const outer = hullShape(s.motorZ, s.motorY, rCaseM, s.axleZ, s.axleY, rCaseA);
  const caseGeo = extrudeX(outer, s.caseX0 + 0.012, s.caseX1, 0.014);
  mesh(caseGeo, caseMat, group);
  // 케이스 분할면 플랜지(두 쪽 케이스를 볼트로 맞댄 이음매) — 살짝 더 큰 얇은 판
  const flangeX = s.caseX0 + 0.05;
  const flange = extrudeX(hullShape(s.motorZ, s.motorY, rCaseM + 0.014, s.axleZ, s.axleY, rCaseA + 0.014), flangeX - 0.012, flangeX + 0.012, 0.004);
  mesh(flange, caseMat, group);
  // 플랜지 볼트: 껍질 둘레를 따라 고르게
  const pts = outer.getSpacedPoints(22);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const cz = (s.motorZ + s.axleZ) / 2;
    const cy = (s.motorY + s.axleY) / 2;
    const dz = p.x - cz;
    const dy = p.y - cy;
    const l = Math.hypot(dz, dy) || 1;
    const b = cylX(0.0095, 0.03, 6);
    b.translate(flangeX, p.y + (dy / l) * 0.004, p.x + (dz / l) * 0.004);
    bolts.push(b);
  }
  // 바깥면(-X) 보스: 모터 축 베어링 캡, 중간축 캡 — 기어열이 들어 있음을 보여준다
  const midZ = s.motorZ + (s.axleZ - s.motorZ) * 0.5;
  const midY = Math.max(s.motorY, s.axleY) + 0.07;
  const capM = latheX([[0, -0.03], [0.085, -0.03], [0.085, -0.012], [0.07, 0], [0, 0]], 40);
  capM.translate(s.caseX0 + 0.012, s.motorY, s.motorZ);
  mesh(capM, caseMat, group);
  const capI = latheX([[0, -0.022], [0.055, -0.022], [0.055, -0.008], [0.045, 0], [0, 0]], 32);
  capI.translate(s.caseX0 + 0.012, midY, midZ);
  mesh(capI, caseMat, group);
  // 보강 리브(바깥면): 모터 캡 → 차축 쪽으로 뻗은 두 줄
  const ribGeos: THREE.BufferGeometry[] = [];
  for (const off of [-0.05, 0.05]) {
    const from = new THREE.Vector2(s.motorZ, s.motorY + off);
    const to = new THREE.Vector2(s.axleZ, s.axleY + off * 0.8);
    const len = from.distanceTo(to);
    const r = new THREE.BoxGeometry(0.014, 0.016, len * 0.62);
    r.rotateX(-Math.atan2(to.y - from.y, to.x - from.x));
    r.translate(s.caseX0 + 0.006, (from.y + to.y) / 2, (from.x + to.x) / 2);
    ribGeos.push(r);
  }
  mesh(merge(ribGeos), caseMat, group);

  // ── 인버터: 모터 위 알루미늄 함체 + 뚜껑 + 고전압 단자(주황) ──
  const invW = Math.min(0.42, (x1 - x0) * 0.82);
  const invH = 0.1;
  const invD = rT * 1.45;
  const invX = (x0 + x1) / 2 + 0.02;
  const invY = s.motorY + rT + 0.02 + invH / 2;
  // 받침(새들): 모터 윗면과 인버터 바닥을 잇는다
  const saddle = new RoundedBoxGeometry(invW * 0.7, 0.05, invD * 0.55, 2, 0.008);
  saddle.translate(invX, s.motorY + rT - 0.005, s.motorZ);
  mesh(saddle, caseMat, group);
  const body = new RoundedBoxGeometry(invW, invH, invD, 3, 0.014);
  body.translate(invX, invY, s.motorZ);
  mesh(body, aluminum({ color: 0x8e979f, roughness: 0.5 }), group);
  const lid = new RoundedBoxGeometry(invW - 0.03, 0.018, invD - 0.03, 2, 0.007);
  lid.translate(invX, invY + invH / 2 + 0.006, s.motorZ);
  mesh(lid, aluminum({ color: 0xd5dae0, roughness: 0.35 }), group);
  // 뚜껑 볼트 8개
  for (let i = 0; i < 8; i++) {
    const ix = i % 4;
    const iz = Math.floor(i / 4);
    const b = boltHead(0.016, 0.01);
    b.translate(invX + (ix / 3 - 0.5) * (invW - 0.06), invY + invH / 2 + 0.017, s.motorZ + (iz - 0.5) * (invD - 0.06));
    bolts.push(b);
  }
  // 고전압 경고 라벨(작은 노란 판) — 색 포인트는 이것과 주황 단자뿐
  const warn = new THREE.BoxGeometry(0.07, 0.002, 0.05);
  warn.translate(invX - invW * 0.28, invY + invH / 2 + 0.016, s.motorZ);
  mesh(warn, paint(0xf2c230, { roughness: 0.5 }), group);

  // 고전압 단자 2개: 차 중앙 쪽 면에서 주황 커넥터가 튀어나온다
  const hvPorts: HvPort[] = [];
  const portMat = plastic(HV_ORANGE, { roughness: 0.6 });
  const collarMat = plastic(0x22262b, { roughness: 0.5 });
  const faceZ = s.motorZ + inward * invD / 2;
  for (const dx of [-0.07, 0.07]) {
    const px = invX + dx;
    const py = invY - 0.005;
    const collar = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 24);
    collar.rotateX(Math.PI / 2);
    collar.translate(px, py, faceZ + inward * 0.01);
    mesh(collar, collarMat, group);
    const plug = latheX([[0, 0], [0.024, 0], [0.024, 0.04], [0.02, 0.05], [0, 0.05]], 24);
    plug.rotateY(inward > 0 ? -Math.PI / 2 : Math.PI / 2); // +X 축 → ±Z(차 중앙 쪽)
    plug.translate(px, py, faceZ + inward * 0.018);
    mesh(plug, portMat, group);
    hvPorts.push({ pos: new THREE.Vector3(px, py, faceZ + inward * 0.066), dir: new THREE.Vector3(0, 0, inward) });
  }
  // 냉각수 호스 2개(검정) — 인버터 측면에서 감속기 케이스로
  const hoseMat = plastic(0x1d2025, { roughness: 0.7 });
  for (const dz of [-0.04, 0.04]) {
    const a = new THREE.Vector3(invX - invW / 2, invY - 0.01, s.motorZ + dz * invD * 2.2);
    const curve = new THREE.CubicBezierCurve3(
      a,
      a.clone().add(new THREE.Vector3(-0.05, 0, 0)),
      new THREE.Vector3(s.caseX1 - 0.02, s.motorY + rT + 0.03, s.motorZ + dz * invD * 2.2),
      new THREE.Vector3(s.caseX1 - 0.02, s.motorY + rT * 0.75, s.motorZ + dz * invD * 2.2)
    );
    mesh(new THREE.TubeGeometry(curve, 16, 0.011, 10, false), hoseMat, group);
  }

  mesh(merge(bolts), boltMat, group);

  // 마운트 브래킷: 엔드벨 쪽(+X)과 감속기 케이스 바깥면(-X)에서 좌우 프레임 레일로 — 유닛이 차체에 매달린다
  if (s.mounts) {
    const mb = s.mounts;
    const bracketMat = darkSteel({ color: 0x3c434b });
    const bar = (a: THREE.Vector3, b: THREE.Vector3, w: number): void => {
      const len = a.distanceTo(b);
      const g = new RoundedBoxGeometry(w, len, w * 0.8, 2, w * 0.2);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      mesh(g, bracketMat, group);
    };
    const rTop = new THREE.Vector3(mb.rightX, mb.y, s.motorZ);
    const rBase = new THREE.Vector3(x1 + 0.07, s.motorY, s.motorZ);
    bar(rBase, rTop, 0.05);
    const lTop = new THREE.Vector3(mb.leftX, mb.y, s.motorZ);
    const lBase = new THREE.Vector3(s.caseX0 + 0.01, s.motorY + 0.02, s.motorZ);
    bar(lBase, lTop, 0.05);
    // 고무 부싱(레일 아래)
    for (const p of [rTop, lTop]) {
      const bush = cylX(0.045, 0.07, 20);
      bush.translate(p.x, p.y - 0.02, p.z);
      mesh(bush, darkMat, group);
    }
  }

  return { group, hvPorts };
}

/**
 * 설계 좌표(차축 중심 = 원점)로 만든 유닛을 실제 차축 위치·축척으로 놓는다.
 * 바깥 그룹은 position 0(인트로 낙하용), 안쪽 그룹이 위치·축척을 가진다. 단자 좌표도 root 로컬로 변환한다.
 */
export function placeEvMotorUnit(at: THREE.Vector3, scale: number, spec: Omit<EvMotorUnitSpec, 'axleY' | 'axleZ'>): EvMotorUnit {
  const unit = buildEvMotorUnit({ ...spec, axleY: 0, axleZ: 0 });
  const outer = new THREE.Group();
  outer.name = 'evMotorUnitPlaced';
  unit.group.position.copy(at);
  unit.group.scale.setScalar(scale);
  outer.add(unit.group);
  const hvPorts = unit.hvPorts.map((p) => ({ pos: p.pos.clone().multiplyScalar(scale).add(at), dir: p.dir.clone() }));
  return { group: outer, hvPorts };
}

/** 차동기어를 실제 차축 위치·축척으로 놓는다(설계 좌표: 차축 중심 = 원점) */
export function placeEvDifferential(at: THREE.Vector3, scale: number, spec: Omit<EvDiffSpec, 'axleY' | 'axleZ'>): THREE.Group {
  const diff = buildEvDifferential({ ...spec, axleY: 0, axleZ: 0 });
  diff.position.copy(at);
  diff.scale.setScalar(scale);
  const outer = new THREE.Group();
  outer.name = 'evDifferentialPlaced';
  outer.add(diff);
  return outer;
}

// ─────────────────────────── 차동기어 ───────────────────────────

export interface EvDiffSpec {
  axleY: number;
  axleZ: number;
  /** 감속기 케이스 바깥면 x(왼쪽 출력 씰이 이 면을 뚫고 나온다) */
  caseX0: number;
  /** 왼쪽·오른쪽 출력 플랜지 끝 x — 구동 반축이 여기서 시작한다 */
  outLeftX: number;
  outRightX: number;
  /** 호박형 하우징 최대 반지름 */
  r: number;
}

/** 차축선 위 차동기어: 감속기 케이스에 붙은 호박형 하우징 + 커버 볼트 링 + 양쪽 출력 플랜지 */
export function buildEvDifferential(s: EvDiffSpec): THREE.Group {
  const group = new THREE.Group();
  group.name = 'evDifferential';
  const r = s.r;
  const xL = s.outLeftX;
  const xR = s.outRightX;
  const housingMat = castIron({ color: 0x4d545c, roughness: 0.62 });
  const prof: V2[] = [
    [0, xL],
    [0.05, xL],
    [0.055, xL + 0.008],
    [0.055, s.caseX0 - 0.02],
    [0.078, s.caseX0 - 0.016],
    [0.078, s.caseX0 + 0.004], // 출력 씰 플랜지(케이스 바깥면에 밀착)
    [0.06, s.caseX0 + 0.006],
    [0.06, -0.11],
    [r * 0.55, -0.1],
    [r * 0.85, -0.07],
    [r * 0.98, -0.03],
    [r, 0.02],
    [r * 0.96, 0.07],
    [r * 1.06, 0.075],
    [r * 1.06, 0.1], // 커버 플랜지
    [r * 0.88, 0.108],
    [r * 0.6, 0.14],
    [r * 0.36, 0.16],
    [0.065, 0.165],
    [0.065, xR - 0.03],
    [0.08, xR - 0.028],
    [0.08, xR - 0.004],
    [0.07, xR],
    [0, xR]
  ];
  const housing = latheX(prof, 56);
  housing.translate(0, s.axleY, s.axleZ);
  mesh(housing, housingMat, group);

  // 커버 볼트 10개
  const bolts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const b = boltHead(0.018, 0.012);
    b.rotateZ(-Math.PI / 2);
    b.translate(0.106, s.axleY + Math.sin(a) * r * 0.97, s.axleZ + Math.cos(a) * r * 0.97);
    bolts.push(b);
  }
  // 하우징 보강 리브 4개(호박 옆면)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const rib = new THREE.BoxGeometry(0.14, 0.014, 0.02);
    rib.translate(0.0, 0, 0);
    rib.rotateX(-a);
    rib.translate(-0.02, s.axleY + Math.sin(a) * r * 0.86, s.axleZ + Math.cos(a) * r * 0.86);
    bolts.push(rib);
  }
  mesh(merge(bolts), steel({ roughness: 0.32 }), group);
  return group;
}

// ─────────────────────────── 배터리 팩 ───────────────────────────

export interface EvBatterySpec {
  /** 팩 외곽(테두리 프레임 포함) */
  halfW: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
  /** 윗면 셀 모듈 구획 수 (가로 x 세로) */
  cols: number;
  rows: number;
  /** 프레임 레일에 거는 행거(레일 |x|, 레일 아랫면 y, 행거 z 위치들) — 없으면 생략 */
  hanger?: { x: number; y: number; zs: number[] };
}

export interface EvCableRun {
  /** 케이블 시작(인버터 단자) */
  from: HvPort;
  /** 팩 위 정션박스 중심(x, z) — 박스는 팩 윗면에 놓인다 */
  boxX: number;
  boxZ: number;
}

/**
 * 바닥 배터리 팩: 알루미늄 테두리 프레임(사이드 실 + 볼트 플랜지) + 윗면 셀 모듈 구획 + 가운데 버스바 채널
 * + 고전압 정션박스와 주황 케이블(인버터 단자까지).
 */
export function buildEvBatteryPack(s: EvBatterySpec, runs: EvCableRun[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'evBattery';
  const frameMat = aluminum({ color: 0xa7afb8, roughness: 0.5 });
  const lidMat = paint(0x3a4048, { roughness: 0.55, metalness: 0.3 });
  const moduleMat = paint(0x4a525c, { roughness: 0.5, metalness: 0.35 });
  const blackMat = plastic(0x1f2328, { roughness: 0.55 });
  const orangeMat = plastic(HV_ORANGE, { roughness: 0.72 }); // 반사가 강하면 하늘빛이 섞여 살구색으로 보인다
  const boltMat = steel({ roughness: 0.3 });

  const H = s.y1 - s.y0;
  const W = s.halfW;
  const zc = (s.z0 + s.z1) / 2;
  const L = s.z1 - s.z0;
  // 압출 단면 좌표: shape x = 씬 x, shape y = -씬 z (rotateX(-π/2) 후 두께가 +Y)
  const slab = (hw: number, z0: number, z1: number, ya: number, yb: number, rad: number, c: number, mat: THREE.Material): THREE.Mesh => {
    const g = extrude(roundedRect(-hw, -z1, hw, -z0, rad), yb - ya, c, 12, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, (ya + yb) / 2, 0);
    return mesh(g, mat, group);
  };

  // 하부 트레이 + 볼트 플랜지 + 상부 뚜껑(조금 안쪽)
  const yFl = s.y0 + H * 0.55;
  slab(W - 0.02, s.z0 + 0.02, s.z1 - 0.02, s.y0, yFl, 0.05, 0.008, frameMat);
  slab(W, s.z0, s.z1, yFl - 0.008, yFl + 0.008, 0.06, 0.003, frameMat);
  slab(W - 0.035, s.z0 + 0.035, s.z1 - 0.035, yFl, s.y1 - 0.01, 0.045, 0.006, lidMat);

  // 사이드 실(좌우 알루미늄 압출재) — 차체 바닥에 체결되는 테두리 프레임
  const sill = new RoundedBoxGeometry(0.035, H * 0.62, L - 0.06, 2, 0.008);
  for (const sx of [-1, 1]) {
    const g = sill.clone();
    g.translate(sx * (W - 0.012), s.y0 + H * 0.36, zc);
    mesh(g, frameMat, group);
  }
  sill.dispose();

  // 플랜지 볼트(둘레)
  const bolts: THREE.BufferGeometry[] = [];
  const nZ = Math.max(4, Math.round(L / 0.11));
  const nX = Math.max(3, Math.round((2 * W) / 0.11));
  const addBolt = (x: number, z: number): void => {
    const b = boltHead(0.014, 0.008);
    b.translate(x, yFl + 0.012, z);
    bolts.push(b);
  };
  for (let i = 0; i <= nZ; i++) {
    const z = s.z0 + 0.02 + (i / nZ) * (L - 0.04);
    addBolt(-W + 0.013, z);
    addBolt(W - 0.013, z);
  }
  for (let i = 1; i < nX; i++) {
    const x = -W + (i / nX) * 2 * W;
    addBolt(x, s.z0 + 0.013);
    addBolt(x, s.z1 - 0.013);
  }

  // 윗면 셀 모듈: 가운데 버스바 채널을 사이에 두고 좌우로 구획된 볼록 패널
  const chW = 0.05;
  const inX0 = chW / 2 + 0.012;
  const inX1 = W - 0.05;
  const inZ0 = s.z0 + 0.05;
  const inZ1 = s.z1 - 0.05;
  const gap = 0.014;
  const halfCols = Math.max(1, Math.round(s.cols / 2));
  const modW = (inX1 - inX0 - gap * (halfCols - 1)) / halfCols;
  const modL = (inZ1 - inZ0 - gap * (s.rows - 1)) / s.rows;
  const modH = 0.016;
  const modGeos: THREE.BufferGeometry[] = [];
  const ribGeos: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (let c = 0; c < halfCols; c++) {
      for (let r = 0; r < s.rows; r++) {
        const cx = side * (inX0 + modW / 2 + c * (modW + gap));
        const cz = inZ0 + modL / 2 + r * (modL + gap);
        const m = new RoundedBoxGeometry(modW, modH, modL, 2, 0.005);
        m.translate(cx, s.y1 - 0.01 + modH / 2 - 0.004, cz);
        modGeos.push(m);
        // 모듈 윗면 셀 줄무늬(얕은 리브) — 셀이 늘어선 방향
        const nRib = Math.max(2, Math.round(modL / 0.04));
        for (let k = 1; k < nRib; k++) {
          const rb = new THREE.BoxGeometry(modW * 0.82, 0.003, 0.004);
          rb.translate(cx, s.y1 - 0.01 + modH - 0.003, cz - modL / 2 + (k / nRib) * modL);
          ribGeos.push(rb);
        }
      }
    }
  }
  mesh(merge(modGeos), moduleMat, group);
  if (ribGeos.length) mesh(merge(ribGeos), lidMat, group);
  // 버스바 채널(검정 커버)
  const ch = new RoundedBoxGeometry(chW, 0.02, inZ1 - inZ0, 2, 0.006);
  ch.translate(0, s.y1 - 0.005, (inZ0 + inZ1) / 2);
  mesh(ch, blackMat, group);

  // 행거 브래킷: 팩 좌우 테두리에서 차체 프레임 레일 아랫면으로 — 팩이 차체 바닥에 매달린 구조
  if (s.hanger) {
    const hg = s.hanger;
    const hangGeos: THREE.BufferGeometry[] = [];
    for (const z of hg.zs) {
      for (const sx of [-1, 1]) {
        const hgt = hg.y - (yFl - 0.01);
        const g = new RoundedBoxGeometry(0.03, hgt, 0.05, 2, 0.006);
        g.translate(sx * hg.x, yFl - 0.01 + hgt / 2, z);
        hangGeos.push(g);
        const foot = new RoundedBoxGeometry(Math.abs(hg.x - W) + 0.04, 0.014, 0.05, 2, 0.005);
        foot.translate(sx * (W + hg.x) / 2, yFl + 0.006, z);
        hangGeos.push(foot);
      }
    }
    mesh(merge(hangGeos), frameMat, group);
  }

  // 정션박스 + 주황 고전압 케이블
  const boxW = 0.15;
  const boxD = 0.08;
  const boxH = 0.045;
  const by = s.y1 + boxH / 2 - 0.002;
  const sockOff = 0.04;
  const boxes = new Set<string>();
  for (const run of runs) {
    const key = `${run.boxX},${run.boxZ}`;
    if (boxes.has(key)) continue;
    boxes.add(key);
    const toward = Math.sign(run.from.pos.z - run.boxZ) || 1; // 박스에서 인버터 쪽 z 방향
    const box = new RoundedBoxGeometry(boxW, boxH, boxD, 2, 0.008);
    box.translate(run.boxX, by, run.boxZ);
    mesh(box, blackMat, group);
    const faceZ = run.boxZ + toward * boxD / 2;
    for (const sx of [run.boxX - sockOff, run.boxX + sockOff]) {
      const sock = new THREE.CylinderGeometry(0.017, 0.017, 0.024, 20);
      sock.rotateX(Math.PI / 2);
      sock.translate(sx, by, faceZ + toward * 0.01);
      mesh(sock, orangeMat, group);
    }
  }
  // 인버터 단자별 케이블: 단자에서 수평으로 나와 높이를 유지하다가 팩 위 정션박스 소켓으로 내려앉는다
  for (const run of runs) {
    const toward = Math.sign(run.from.pos.z - run.boxZ) || 1;
    const faceZ = run.boxZ + toward * boxD / 2;
    const sx = run.from.pos.x < run.boxX ? run.boxX - sockOff : run.boxX + sockOff;
    const end = new THREE.Vector3(sx, by, faceZ + toward * 0.022);
    const p0 = run.from.pos;
    const dz = end.z - p0.z;
    const pts = [
      p0,
      p0.clone().addScaledVector(run.from.dir, 0.05),
      new THREE.Vector3((p0.x + end.x) / 2, Math.max(p0.y, end.y + 0.06), p0.z + dz * 0.55),
      new THREE.Vector3(end.x, end.y + 0.035, end.z + toward * 0.07),
      end
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    mesh(new THREE.TubeGeometry(curve, 48, 0.013, 12, false), orangeMat, group);
  }

  mesh(merge(bolts), boltMat, group);
  return group;
}
// ─────────────────────────── 전기차 미션 공용 기계 베이스 ───────────────────────────
// 싱글·듀얼 모터 미션은 부품 구성만 다르고 인트로·정답 설치·복원·라벨 흐름이 같다.
// 차체·바퀴 좌표는 drivetrainParts.ts의 CAR 규약(root y = CAR.rootY)을 따른다 — 5종 구동방식의 바퀴·차체를 같게 하기 위해.

const INTRO_DROP = 1.1; // 인트로 낙하 시작 높이(씬 단위)
const INTRO_DUR = 0.8;  // 부품 1개 낙하 시간(s)
const X_AXIS = new THREE.Vector3(1, 0, 0);

function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

interface MatState {
  m: THREE.Material;
  opacity: number;
  transparent: boolean;
}

interface IntroPart {
  obj: THREE.Object3D; // 낙하시키는 대상(root 직속 그룹 또는 바퀴 피벗 안의 바퀴) — 최종 position.y = 0
  mats: MatState[];
  delay: number;       // 인트로 시작 후 대기 시간(s) — 조립 순서
}

/** 인트로 페이드용: 부품이 가진 재질과 원래 투명도(차체 셸처럼 원래 반투명인 재질 보존) */
function collectMats(obj: THREE.Object3D): MatState[] {
  const set = new Set<THREE.Material>();
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((x) => set.add(x));
  });
  return [...set].map((m) => ({ m, opacity: m.opacity, transparent: m.transparent }));
}

/** 정답 부품: 날아와서 회전 피벗(차축선)에 물린다 */
export class EvAnswerPart {
  pivot: THREE.Group | null = null;
  installed = false;
  constructor(
    readonly center: THREE.Vector3, // 비행 목표(root 로컬)
    readonly axis: THREE.Vector3,   // 회전축 기준점(root 로컬)
    readonly build: () => THREE.Object3D // center 기준 로컬 좌표로 만든 모델
  ) {}
}

export interface EvWheelDef {
  side: 1 | -1;     // +1 = 오른쪽(+X)
  front: boolean;
  delay: number;
  sign: number;     // 완료 회전 부호(v1 사용자 지정 값 그대로)
  marker: boolean;  // 타이어 옆면 회전 표시(구동 바퀴만)
}

export abstract class EvCarBase extends BaseMachine {
  protected root = new THREE.Group();
  protected answerParts: EvAnswerPart[] = [];
  protected wheelPivots: { pivot: THREE.Group; sign: number; front: boolean }[] = [];
  protected theta = 0;
  protected spinning = false;
  private intro: IntroPart[] = [];
  private introStart = -1;
  private introDone = false;

  constructor() {
    super();
    this.root.position.y = CAR.rootY;
    this.group.add(this.root);
  }

  // ── Machine 인터페이스 ──

  isInstalled(step: number): boolean {
    return this.answerParts[step]!.installed;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return this.answerParts[step]!.center.clone().add(this.root.position);
  }

  slotTarget(step: number): THREE.Vector3 {
    return this.getFlyTarget(step);
  }

  buildStepModel(step: number): THREE.Group {
    const group = new THREE.Group();
    group.add(this.answerParts[step]!.build());
    return group;
  }

  installStep(step: number, model: THREE.Group): void {
    const part = this.answerParts[step]!;
    part.installed = true;
    this.hideSlot(step);
    if (step < this.stepCount - 1) this.showSlot(step + 1); // 다음 정답 슬롯 표시
    const flown = model.children[0] ?? part.build();
    const pivot = new THREE.Group();
    pivot.position.copy(part.axis);
    flown.position.copy(part.center).sub(part.axis);
    flown.rotation.set(0, 0, 0);
    flown.scale.setScalar(1);
    pivot.add(flown);
    this.root.add(pivot);
    part.pivot = pivot;
    model.removeFromParent();
    if (this.answerParts.every((p) => p.installed)) this.spinning = true;
    this.enableShadows();
  }

  reset(): void {
    for (const part of this.answerParts) {
      part.installed = false;
      if (part.pivot) {
        part.pivot.removeFromParent();
        part.pivot = null;
      }
    }
    for (let i = 0; i < this.stepCount; i++) {
      if (i === 0) this.showSlot(0);
      else this.hideSlot(i);
    }
    this.introStart = -1;
    this.introDone = false;
    this.spinning = false;
    this.theta = 0;
    for (const w of this.wheelPivots) w.pivot.setRotationFromAxisAngle(X_AXIS, 0);
    this.hideIntroParts();
  }

  update(t: number): void {
    super.update(t);
    this.updateIntro(t);
  }

  // ── 하위 클래스용 구성 도구 ──

  /** 정답 슬롯: 차축선 중심의 수평 펄스 링. 첫 정답만 표시 */
  protected buildSlots(radius: number): void {
    for (const [step, part] of this.answerParts.entries()) {
      this.addSlot(step, radius, part.axis.clone().add(this.root.position));
      const slot = this.slots[step];
      if (slot) slot.rotation.x = -Math.PI / 2;
      if (step > 0) this.hideSlot(step);
    }
  }

  /** 캔버스 텍스트 스프라이트(root 로컬 좌표) */
  protected addLabel(text: string, color: string, position: THREE.Vector3, w = 0.75, h = 0.3, fontPx = 60): THREE.Sprite {
    const sprite = makeLabelSprite(text, color, w, h, fontPx);
    sprite.position.copy(position);
    this.root.add(sprite);
    return sprite;
  }

  /** 부품 → 라벨 지시선(root 로컬 좌표) */
  protected addCallout(text: string, color: string, partPoint: THREE.Vector3, labelPos: THREE.Vector3): void {
    this.addLabel(text, color, labelPos);
    this.root.add(makeCalloutLine(partPoint, labelPos, color));
  }

  protected addIntro(obj: THREE.Object3D, delay: number): void {
    this.intro.push({ obj, mats: collectMats(obj), delay });
  }

  /** 바퀴 4개: 회전 피벗(차축선)에 공용 바퀴를 물리고, 고정부 캘리퍼는 피벗 밖에 같은 시점에 내려놓는다 */
  protected addWheels(defs: EvWheelDef[]): void {
    for (const w of defs) {
      const pos = new THREE.Vector3(w.side * CAR.halfTrack, CAR.axleY, w.front ? CAR.frontZ : CAR.rearZ);
      const pivot = new THREE.Group();
      pivot.position.copy(pos);
      const wheel = buildWheel(w.side, { marker: w.marker });
      pivot.add(wheel);
      this.root.add(pivot);
      this.wheelPivots.push({ pivot, sign: w.sign, front: w.front });
      this.addIntro(wheel, w.delay);
      const holder = new THREE.Group();
      const caliper = buildCaliper(w.side);
      caliper.position.copy(pos);
      holder.add(caliper);
      this.root.add(holder);
      this.addIntro(holder, w.delay);
    }
  }

  /** 공용 차체: 사다리 프레임(불투명)과 반투명 셸 */
  protected addBody(frameDelay: number, shellDelay: number): void {
    const frame = buildLadderFrame();
    this.root.add(frame);
    this.addIntro(frame, frameDelay);
    const shell = buildCarShell();
    this.root.add(shell);
    this.addIntro(shell, shellDelay);
  }

  /** 구성 마지막에 호출 — 그림자 설정 후 인트로 대기 상태로 숨긴다 */
  protected finishSetup(): void {
    this.enableShadows();
    // 반투명 셸은 그림자를 드리우지 않는다(enableShadows가 켠 것을 되돌림)
    this.root.traverse((o) => {
      if (o.userData.noAO && (o as THREE.Mesh).isMesh) o.castShadow = false;
    });
    this.hideIntroParts();
  }

  protected setAxleAngle(part: EvAnswerPart, angle: number): void {
    part.pivot?.setRotationFromAxisAngle(X_AXIS, angle);
  }

  private hideIntroParts(): void {
    for (const p of this.intro) {
      p.obj.visible = false;
      for (const s of p.mats) {
        s.m.transparent = true;
        s.m.opacity = 0;
      }
    }
  }

  private updateIntro(t: number): void {
    if (this.introDone) return;
    // 진행도 복원(정답 1개 이상 설치) 상태면 인트로 없이 즉시 표시
    if (this.answerParts.some((p) => p.installed)) {
      this.finishIntro();
      return;
    }
    if (this.introStart < 0) {
      this.introStart = t;
      return;
    }
    let allDone = true;
    for (const part of this.intro) {
      const e = Math.min(1, Math.max(0, (t - this.introStart - part.delay) / INTRO_DUR));
      const k = easeOutCubic(e);
      part.obj.visible = e > 0;
      part.obj.position.y = (1 - k) * INTRO_DROP;
      for (const s of part.mats) s.m.opacity = s.opacity * k;
      if (e < 1) allDone = false;
    }
    if (allDone) this.finishIntro();
  }

  private finishIntro(): void {
    this.introDone = true;
    for (const part of this.intro) {
      part.obj.visible = true;
      part.obj.position.y = 0;
      for (const s of part.mats) {
        s.m.opacity = s.opacity;
        s.m.transparent = s.transparent;
      }
    }
  }
}

/** 구동 반축 한 쌍(차동기어 좌·우 출력 → 바퀴 허브). 원점 = 차축 중심 */
export function buildEvHalfShaftPair(outLeftX: number, outRightX: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'evHalfShafts';
  g.add(buildHalfShaftBetween(new THREE.Vector3(outLeftX, 0, 0), new THREE.Vector3(-CAR.hubInnerX, 0, 0)));
  g.add(buildHalfShaftBetween(new THREE.Vector3(outRightX, 0, 0), new THREE.Vector3(CAR.hubInnerX, 0, 0)));
  return g;
}
