// 180번 전용 키트 — 한쪽 조임쇠: 나사 하나로 돌아가는 굽은 조임쇠가 나무토막을 고정 옆판에 누른다
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { circlePts, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.004, segs = 28): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function named(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}
function spline(pts: V2[], n: number): V2[] {
  const c = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return c.getPoints(n).map((p) => [p.x, p.y] as V2);
}

const S = 0.006;
/** 판화 px → 조임쇠 로컬(원점 = 축, 판화 (292, 245)) */
const px = (x: number, y: number): V2 => [(x - 292) * S, -(y - 245) * S];

/** 180번 치수 — 판화 1 px = 0.006 */
export const K180 = {
  /** 조임쇠 축(세계) */
  P: [0.75, 1.75] as V2,
  /** 열림 각(rad): 0 = 닫힘(나무토막에 닿음) */
  open: 0.22,
  /** 옆판·나무토막 */
  boardX: [-0.25, 0.09] as V2,
  boardY: [0.5, 3.0] as V2,
  woodY: [0.73, 2.47] as V2,
  zBoard: [-0.25, 0.05] as V2,
  zWood: [-0.25, 0.05] as V2,
  zCam: [-0.06, 0.06] as V2
} as const;

/** 조임쇠 윤곽(로컬). 바깥 호 + 안쪽 호(나무토막에 닿는 쪽 = 왼쪽) */
export function camOutline180(): V2[] {
  const outer = spline([px(235, 50), px(260, 55), px(292, 92), px(325, 150), px(345, 215), px(350, 290), px(335, 360), px(300, 402), px(262, 418), px(232, 405), px(226, 378)], 36);
  const inner = spline([px(226, 378), px(232, 358), px(262, 345), px(270, 322), px(256, 285), px(262, 250), px(262, 205), px(268, 150), px(262, 100), px(235, 75)], 30);
  return [...outer, ...inner.slice(1)];
}

/** 열림각 alpha 에서 조임쇠 윤곽의 가장 왼쪽 x(축 기준, 나무토막 높이 범위 안) — 닿는 면의 위치 */
export function camReach180(alpha: number): number {
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  const y0 = K180.woodY[0] - K180.P[1];
  const y1 = K180.woodY[1] - K180.P[1];
  let m = Infinity;
  for (const [x, y] of camOutline180()) {
    const wx = x * c - y * s;
    const wy = x * s + y * c;
    if (wy >= y0 && wy <= y1 && wx < m) m = wx;
  }
  return m;
}

/** 열림각 alpha(theta): 0 → open → 0 (한 주기 2π). dir = 열리는 중 +1(반시계), 닫히는 중 −1. gap = 나무토막 면과의 틈 */
export function clamp180(theta: number): { alpha: number; dir: 1 | -1; gap: number } {
  const alpha = K180.open * 0.5 * (1 - Math.cos(theta));
  const dir: 1 | -1 = Math.sin(theta) >= 0 ? 1 : -1;
  return { alpha, dir, gap: camReach180(alpha) - camReach180(0) };
}

/** 조임쇠(굽은 판): 원점 = 축. z K180.zCam. 몸 메시에 userData.outline = 윤곽 */
export function cam180(): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFrom(camOutline180());
  shape.holes.push(pathFrom(circlePts(0.052, 24)));
  const body = meshAt(extrude(shape, K180.zCam[1] - K180.zCam[0], 0.006, 16), castIron({ roughness: 0.55 }), 0, 0, 0);
  body.userData.outline = camOutline180();
  g.add(body);
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.024, 0.008), paint(0xf2b619), 0.35, 0.0, K180.zCam[1] + 0.004));
  setMM(g, { kind: 'lever', length: 1.2, pivot: [0, 0, 0], tip: [0.4, 0.8, 0] });
  return g;
}

/** 조임쇠 나사(고정): 뒤판에서 앞으로, 홈 머리. 원점 = 축 */
export function pivotScrew180(): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(cylZ(0.05, STAGE.backZ, 0.12, 0.004, 28), steel(), 0, 0, 0));
  g.add(meshAt(cylZ(0.11, 0.07, 0.12, 0.006, 32), darkSteel(), 0, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.15, 0.022, 0.012), paint(0x20252b), 0, 0, 0.12));
  g.add(meshAt(cylZ(0.1, STAGE.backZ, STAGE.backZ + 0.06, 0.006, 32), darkSteel(), 0, 0, 0));
  g.add(named('pivotPin', 0, 0, 0.0));
  setMM(g, { kind: 'shaft', axis: 'z', r: 0.05 });
  return g;
}

/** 고정 옆판: 나무 판 + 나사 둘. 좌표는 세계값 그대로 */
export function sideBoard180(): THREE.Group {
  const g = new THREE.Group();
  const w = K180.boardX[1] - K180.boardX[0];
  const h = K180.boardY[1] - K180.boardY[0];
  const d = K180.zBoard[1] - K180.zBoard[0];
  const cx = (K180.boardX[0] + K180.boardX[1]) / 2;
  g.add(meshAt(new THREE.BoxGeometry(w, h, d), wood(), cx, (K180.boardY[0] + K180.boardY[1]) / 2, (K180.zBoard[0] + K180.zBoard[1]) / 2));
  for (const y of [2.5, 0.85]) g.add(meshAt(new THREE.BoxGeometry(w * 0.7, 0.2, 0.052), castIron(), cx, y, -0.275));
  for (const y of [2.35, 0.85]) {
    g.add(meshAt(cylZ(0.065, K180.zBoard[1] - 0.004, K180.zBoard[1] + 0.018, 0.004, 28), steel(), cx, y, 0));
    g.add(meshAt(new THREE.BoxGeometry(0.1, 0.016, 0.01), paint(0x20252b), cx, y, K180.zBoard[1] + 0.018));
  }
  setMM(g, { kind: 'plate' });
  return g;
}

/** 나무토막: 옆판 오른쪽에 붙어 선다(고정). 오른쪽 면 x = faceX 를 조임쇠가 민다 */
export function woodBlock180(faceX: number): THREE.Group {
  const g = new THREE.Group();
  const w = faceX - K180.boardX[1];
  const h = K180.woodY[1] - K180.woodY[0];
  const d = K180.zWood[1] - K180.zWood[0];
  g.add(meshAt(new THREE.BoxGeometry(w, h, d), wood(0xb98a52), (K180.boardX[1] + faceX) / 2, (K180.woodY[0] + K180.woodY[1]) / 2, (K180.zWood[0] + K180.zWood[1]) / 2));
  g.add(meshAt(new THREE.BoxGeometry(w * 0.7, 0.3, 0.052), castIron(), (K180.boardX[1] + faceX) / 2, 1.1, -0.275));
  setMM(g, { kind: 'plate' });
  return g;
}
