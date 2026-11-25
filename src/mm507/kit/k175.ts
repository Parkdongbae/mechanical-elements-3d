// 175번 전용 키트 — 한 행정에 한 바퀴 (크랭크 · 연결 막대 · 홈 속 피스톤)
//  프레임 주물(받침 + 왼쪽 아치 베어링 + 가운데 창 + 오른쪽 세로 슬라이드 홈 기둥, 고정)
//  크랭크(축 O 로 판화의 점선 원을 그리며 회전, 팔 끝 핀) — 연결 막대 — 피스톤(홈 안 슬라이더).
//  pose175(theta): 모든 자세의 닫힌 식 — 피스톤 한 왕복에 크랭크가 정확히 한 바퀴(주기 2π).
//  판화의 자세(하사점: 축 · 핀 · 피스톤이 한 직선)가 t = 1, phi = −58.0° 이다.
//  판화 비(링크 ≈ 0.99)로는 크랭크가 한 바퀴를 돌지 못해(설계표 판화 읽기 9번) 링크를 1.30 으로 시정했다.
import * as THREE from 'three';
import { castIron, darkSteel, steel } from '../../models/materials';
import { circlePath, circlePts, extrude, lathe, mesh, rodProfile, roundedRect, shapeFrom, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

export const K175 = {
  O: [-0.55, 1.92] as V2, // 크랭크 축(프레임 아치 베어링)
  r: 0.36, // 크랭크 반지름 — 판화의 점선 원(0.46)을 조금 줄여 회전이 닫히게
  link: 1.3, // 연결 막대 두 눈 사이 — 판화 비(≈0.99)로는 한 바퀴가 안 닫혀 시정
  slotX: 0.33, // 슬라이드 홈 가운데 세로선
  slotY: [0.42, 2.86] as V2, // 홈 아래·위 끝(둥근 끝 포함)
  slotHalf: 0.075, // 홈 반폭
  bossR: 0.065, // 피스톤 보스 반지름 — 홈 벽과 옆틈 0.010
  bore: 0.046, // 눈·구멍 반지름(핀 0.042 + 틈 0.004)
  pinR: 0.042, // 핀 반지름
  phase: 2.6123, // t = 1(theta 1.6) 에 phi = −58.0° — 판화 자세(하사점)
  zFrame: 0, frameT: 0.1, // 프레임 판 가운데 z · 두께
  zCrank: 0.09, crankT: 0.06, // 크랭크 판 가운데 z · 두께
  zLink: 0.165, linkT: 0.05, // 연결 막대 가운데 z · 두께
  zBoss: 0.06, bossT: 0.16, // 피스톤 보스 가운데 z · 길이(세계 z −0.02 ~ 0.14)
} as const;

export interface Pose175 {
  /** 크랭크 각(rad) — crank 그룹 rotation.z 에 대입 */
  phi: number;
  /** 크랭크 핀(연결 막대 위 눈)의 세계 좌표 */
  pin: V2;
  /** 연결 막대 각(rad) — link 그룹 rotation.z 에 대입 */
  linkAng: number;
  /** 피스톤 보스 가운데(손목 핀)의 세계 좌표 */
  piston: V2;
}

/** 모든 자세의 닫힌 식. 주기 2π 로 정확히 닫힌다 — 피스톤 한 왕복 = 크랭크 한 바퀴 */
export function pose175(theta: number): Pose175 {
  const phi = theta - K175.phase;
  const pin: V2 = [K175.O[0] + K175.r * Math.cos(phi), K175.O[1] + K175.r * Math.sin(phi)];
  const dx = K175.slotX - pin[0];
  const y = pin[1] - Math.sqrt(K175.link * K175.link - dx * dx);
  return { phi, pin, linkAng: Math.atan2(y - pin[1], K175.slotX - pin[0]), piston: [K175.slotX, y] };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
/** Z축 원기둥(z0~z1, 양끝 모따기) */
function cylZ(r: number, z0: number, z1: number, c = 0.006, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** Z축 관(rIn~rOut, z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** 두 점을 잇는 네모 판(반폭 w0 → w1) — extrude 가 이미 가운데 정렬하므로 z −depth/2 ~ depth/2 */
function taperPlate(p0: V2, p1: V2, w0: number, w1: number, depth: number): THREE.BufferGeometry {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: V2[] = [
    [p0[0] + nx * w0, p0[1] + ny * w0],
    [p1[0] + nx * w1, p1[1] + ny * w1],
    [p1[0] - nx * w1, p1[1] - ny * w1],
    [p0[0] - nx * w0, p0[1] - ny * w0],
  ];
  return extrude(shapeFrom(pts), depth, 0.006, 8);
}
/** 이름만 있는 핀 표식 */
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/** 슬라이드 홈 윤곽(검사 스크립트용) — 피스톤 보스는 이 안에 있어야 한다 */
export function slotPts175(): V2[] {
  const pts: V2[] = [];
  const r = K175.slotHalf;
  const cx = K175.slotX;
  for (let a = 180; a <= 360; a += 20) {
    const t = (a * Math.PI) / 180;
    pts.push([cx + r * Math.cos(t), K175.slotY[0] + r + r * Math.sin(t)]);
  }
  for (let a = 0; a <= 180; a += 20) {
    const t = (a * Math.PI) / 180;
    pts.push([cx + r * Math.cos(t), K175.slotY[1] - r + r * Math.sin(t)]);
  }
  return pts;
}

/**
 * 프레임 주물(고정): 받침 — 왼쪽 기둥·아치(베어링) — 안장 — 오른쪽 높은 기둥.
 * 구멍 셋: 가운데 창(주물 빼기) · 오른쪽 슬라이드 홈 · 크랭크 축 구멍.
 * group 원점 = 세계 원점, 판 두께 K175.frameT(세계 z −0.05 ~ 0.05).
 * userData.outlines.slotHole = 홈 윤곽(피스톤 보스가 이 안에 있어야 한다).
 * 표식 child `crankBore` = 크랭크 축 구멍 가운데.
 */
export function frame175(): THREE.Group {
  const g = new THREE.Group();
  const [ox, oy] = K175.O;
  // 바깥 윤곽(반시계): 받침 왼쪽 → 왼 기둥 → 아치 → 안장 → 오른 기둥(둥근 top) → 받침 오른쪽
  const pts: V2[] = [
    [-0.98, 0.18],
    [-0.98, 0.33],
    [-0.85, 0.33],
  ];
  for (let a = 180; a >= 0; a -= 15) {
    const t = (a * Math.PI) / 180;
    pts.push([ox + 0.3 * Math.cos(t), oy + 0.3 * Math.sin(t)]);
  }
  pts.push([-0.12, 1.94], [0.03, 1.96], [0.213, 1.98], [0.213, 2.945]);
  for (let a = 165; a >= 0; a -= 15) {
    const t = (a * Math.PI) / 180;
    pts.push([0.368 + 0.155 * Math.cos(t), 2.945 + 0.155 * Math.sin(t)]);
  }
  pts.push([0.523, 0.33], [0.98, 0.33], [0.98, 0.18]);
  const shape = shapeFrom(pts);
  // 구멍: 가운데 창 · 슬라이드 홈(끝 둥근 중심은 y0+반폭 · y1−반폭) · 크랭크 축 구멍
  shape.holes.push(roundedRect(-0.45, 0.85, -0.06, 1.62, 0.08));
  shape.holes.push(
    stadiumShape(K175.slotX, K175.slotY[0] + K175.slotHalf, K175.slotX, K175.slotY[1] - K175.slotHalf, K175.slotHalf)
  );
  shape.holes.push(circlePath(ox, oy, K175.bore));
  g.add(mesh(extrude(shape, K175.frameT, 0.006, 12), castIron()));
  g.userData.outlines = { slotHole: slotPts175() };
  g.add(pinMark('crankBore', ox, oy, 0));
  setMM(g, { kind: 'frame', slotX: K175.slotX, slotY: K175.slotY });
  return g;
}

/**
 * 크랭크(구동). group 원점 = 축 O, 팔이 로컬 +X — 모델은 (O, K175.zCrank) 에 놓고
 * rotation.z = pose175(theta).phi 를 대입한다. 허브 구멍 0.046(축이 꿰고 너트로 막음),
 * 팔 끝 핀(0.042)이 세계 z 0.12 ~ 0.215 로 돌출해 연결 막대 눈을 꿰고 덮개로 막는다.
 * 표식 child `crankPin` = 핀 축 위 연결 막대 평면(세계 z 0.165)의 점.
 */
export function crank175(): THREE.Group {
  const g = new THREE.Group();
  const body = darkSteel();
  // 팔: 허브(반폭 0.055) → 핀(반폭 0.037)
  g.add(mesh(taperPlate([0, 0], [K175.r, 0], 0.055, 0.037, K175.crankT), body));
  // 허브(관) — 앞이 세계 z 0.135 까지
  g.add(mesh(tubeZ(K175.bore, 0.105, -0.03, 0.045, 0.008, 36), body));
  // 핀 + 끝 덮개
  g.add(meshAt(cylZ(K175.pinR, 0.03, 0.125, 0.008), body, K175.r, 0, 0));
  g.add(meshAt(cylZ(0.062, 0.1, 0.125, 0.006), body, K175.r, 0, 0));
  g.add(pinMark('crankPin', K175.r, 0, 0.075));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [K175.r, 0, 0] });
  return g;
}

/**
 * 연결 막대. group 원점 = 위 눈(크랭크 핀), 로컬 +X 가 아래 눈을 향한다 — 모델은
 * position = pin, rotation.z = linkAng 를 대입한다. 두 눈 구멍 0.046, 막대 반폭 0.042 → 0.039.
 * 표식 child `linkTop`(원점) · `linkBottom`(같은 막대 평면, 세계 z 0.165 — 두 표식이 한 평면에
 * 있어야 링크 길이 검사가 눈축 거리 1.30 을 재고, 아래 눈·손목 핀 짝도 이 평면에서 만난다).
 */
export function link175(): THREE.Group {
  const g = new THREE.Group();
  const body = steel();
  const L = K175.link;
  g.add(mesh(tubeZ(K175.bore, 0.075, -0.025, 0.025, 0.005, 32), body));
  // 판은 눈 가운데(핀 자리)를 비켜 눈 두르기 안쪽에서 끊는다 — 핀이 판에 박히지 않게
  g.add(mesh(taperPlate([0.05, 0], [L - 0.05, 0], 0.042, 0.039, K175.linkT), body));
  g.add(meshAt(tubeZ(K175.bore, 0.078, -0.025, 0.025, 0.005, 32), body, L, 0, 0));
  g.add(pinMark('linkTop', 0, 0, 0));
  g.add(pinMark('linkBottom', L, 0, 0));
  setMM(g, { kind: 'rod', r: 0.084, length: L });
  return g;
}

/**
 * 피스톤(슬라이더). group 원점 = 보스 가운데 — 모델은 position = piston(세계 z K175.zBoss) 에 놓는다.
 * 보스(0.065)가 세계 z −0.02 ~ 0.14 로 홈 안까지 들어가고, 손목 핀이 연결 막대 아래 눈(0.14~0.19)을
 * 꿰고 덮개(세계 z 0.19 ~ 0.212)로 막는다. 보스 메시에 userData.outline(원) — 홈 밖으로 나가면 안 된다.
 * 표식 child `wristPin` = 핀 축 위 연결 막대 평면(세계 z 0.165 — 막대 아래 눈과 같은 평면).
 */
export function piston175(): THREE.Group {
  const g = new THREE.Group();
  const body = darkSteel();
  const boss = meshAt(cylZ(K175.bossR, -K175.bossT / 2, K175.bossT / 2, 0.006, 32), body, 0, 0, 0);
  boss.userData.outline = circlePts(K175.bossR, 28);
  g.add(boss);
  g.add(mesh(cylZ(K175.pinR, -K175.bossT / 2, 0.152, 0.008), body));
  g.add(mesh(cylZ(0.062, 0.13, 0.152, 0.006), body));
  g.add(pinMark('wristPin', 0, 0, K175.zLink - K175.zBoss));
  setMM(g, { kind: 'slider', r: K175.bossR });
  return g;
}
