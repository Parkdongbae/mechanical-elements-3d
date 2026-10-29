// 절차적(procedural) 기계요소 3D 모델 팩토리
// GLB 파일 없이 Three.js 지오메트리만으로 모든 기계요소를 생성합니다.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuilderId } from '../data/elements';

// ─────────────────────────── 재질 헬퍼 ───────────────────────────

export function mat(color: number, metalness = 0.75, roughness = 0.38): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

const STEEL = 0xaeb8c2;
const DARK_STEEL = 0x6b7680;
const BRASS = 0xc9a24b;
const RUBBER = 0x2c3138;

// ─────────────────────────── 치형(기어 이빨) 유틸 ───────────────────────────

/** 사다리꼴 이빨을 가진 기어 단면 Shape 생성 (XY 평면, 축 = Z) */
export function gearShape(teeth: number, r: number, toothH: number, tipFrac = 0.2): THREE.Shape {
  const shape = new THREE.Shape();
  const r0 = r - toothH;
  const step = (Math.PI * 2) / teeth;
  const pt = (rad: number, ang: number) => [Math.cos(ang) * rad, Math.sin(ang) * rad] as const;

  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const aRoot1 = a;
    const aRoot2 = a + step * 0.30;
    const aTip1 = a + step * (0.5 - tipFrac / 2);
    const aTip2 = a + step * (0.5 + tipFrac / 2);
    const aRoot3 = a + step * 0.70;

    if (i === 0) {
      const [x, y] = pt(r0, aRoot1);
      shape.moveTo(x, y);
    } else {
      const [x, y] = pt(r0, aRoot1);
      shape.lineTo(x, y);
    }
    const [xm, ym] = pt(r0, (aRoot1 + aRoot2) / 2);
    shape.lineTo(xm, ym);
    const [x1, y1] = pt(r0, aRoot2);
    shape.lineTo(x1, y1);
    const [x2, y2] = pt(r, aTip1);
    shape.lineTo(x2, y2);
    const [x3, y3] = pt(r, (aTip1 + aTip2) / 2);
    shape.lineTo(x3, y3);
    const [x4, y4] = pt(r, aTip2);
    shape.lineTo(x4, y4);
    const [x5, y5] = pt(r0, aRoot3);
    shape.lineTo(x5, y5);
  }
  shape.closePath();
  return shape;
}

function addHole(shape: THREE.Shape, cx: number, cy: number, r: number): void {
  const hole = new THREE.Path();
  hole.absarc(cx, cy, r, 0, Math.PI * 2, true);
  shape.holes.push(hole);
}

function extrudeFlat(shape: THREE.Shape, depth: number, bevel = 0.012): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** 축(Z) 구멍이 뚫린 평기어 메시 */
export function buildSpurGearMesh(
  teeth: number,
  r: number,
  toothH: number,
  depth: number,
  color: number = BRASS
): THREE.Mesh {
  const shape = gearShape(teeth, r, toothH);
  addHole(shape, 0, 0, r * 0.16);
  return new THREE.Mesh(extrudeFlat(shape, depth), mat(color));
}

/** 얇은 단면을 여러 겹 쌓으며 회전시켜 헬리컬(비스듬한 이빨) 효과 */
export function buildHelicalGearMesh(
  teeth: number,
  r: number,
  toothH: number,
  depth: number,
  twist = 0.55,
  color: number = BRASS
): THREE.Mesh {
  const layers = 12;
  const geos: THREE.ExtrudeGeometry[] = [];
  for (let i = 0; i < layers; i++) {
    const shape = gearShape(teeth, r, toothH);
    addHole(shape, 0, 0, r * 0.16);
    const h = depth / layers;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 });
    geo.translate(0, 0, -depth / 2 + h * (i + 0.5));
    geo.rotateZ(twist * ((i + 0.5) / layers - 0.5));
    geos.push(geo);
  }
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  return new THREE.Mesh(merged, mat(color));
}

/** 반지름이 축방향으로 줄어들어 원뿔 실린더 형태가 되는 베벨 기어 */
export function buildBevelGearMesh(
  teeth: number,
  r: number,
  toothH: number,
  depth: number,
  shrink = 0.55,
  color: number = BRASS
): THREE.Mesh {
  const layers = 8;
  const geos: THREE.ExtrudeGeometry[] = [];
  for (let i = 0; i < layers; i++) {
    const f = i / (layers - 1);
    const ri = r * (1 - (1 - shrink) * f);
    const ti = toothH * (1 - (1 - shrink) * f);
    const shape = gearShape(teeth, ri, ti);
    addHole(shape, 0, 0, Math.max(ri * 0.16, r * 0.1));
    const h = depth / layers;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 });
    geo.translate(0, 0, -depth / 2 + h * (i + 0.5));
    geos.push(geo);
  }
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  return new THREE.Mesh(merged, mat(color));
}

// ─────────────────────────── 체인 경로 (스타디움 형상) ───────────────────────────

/** 두 스프로킷(반지름 다름 가능)을 감싸는 체인 경로. 2D XY 평면. */
export class ChainPath2D {
  readonly length: number;
  private readonly c1: [number, number];
  private readonly r1: number;
  private readonly c2: [number, number];
  private readonly r2: number;
  private readonly aTop: number;
  private readonly aBot: number;
  private readonly p1Top: [number, number];
  private readonly p2Top: [number, number];
  private readonly p1Bot: [number, number];
  private readonly p2Bot: [number, number];
  private readonly topLen: number;
  private readonly botLen: number;
  private readonly arc2Len: number;
  private readonly arc1Len: number;

  constructor(c1x: number, c1y: number, r1: number, c2x: number, c2y: number, r2: number) {
    this.c1 = [c1x, c1y];
    this.r1 = r1;
    this.c2 = [c2x, c2y];
    this.r2 = r2;
    const dx = c2x - c1x;
    const dy = c2y - c1y;
    const D = Math.hypot(dx, dy);
    const beta = Math.atan2(dy, dx);
    const delta = Math.acos(Math.min(1, Math.max(-1, (r2 - r1) / D)));
    this.aTop = beta + Math.PI - delta;
    this.aBot = beta - Math.PI + delta;
    this.p1Top = [c1x + r1 * Math.cos(this.aTop), c1y + r1 * Math.sin(this.aTop)];
    this.p2Top = [c2x + r2 * Math.cos(this.aTop), c2y + r2 * Math.sin(this.aTop)];
    this.p1Bot = [c1x + r1 * Math.cos(this.aBot), c1y + r1 * Math.sin(this.aBot)];
    this.p2Bot = [c2x + r2 * Math.cos(this.aBot), c2y + r2 * Math.sin(this.aBot)];
    this.topLen = Math.hypot(this.p2Top[0] - this.p1Top[0], this.p2Top[1] - this.p1Top[1]);
    this.botLen = Math.hypot(this.p1Bot[0] - this.p2Bot[0], this.p1Bot[1] - this.p2Bot[1]);
    this.arc2Len = r2 * (2 * Math.PI - 2 * delta);
    this.arc1Len = r1 * (2 * delta);
    this.length = this.topLen + this.arc2Len + this.botLen + this.arc1Len;
  }

  /** 경로상 호장거리 s 위치의 {x, y, angle(접선 방향)} */
  pointAt(s: number): { x: number; y: number; angle: number } {
    let u = s % this.length;
    if (u < 0) u += this.length;
    if (u < this.topLen) {
      const k = u / this.topLen;
      return {
        x: this.p1Top[0] + (this.p2Top[0] - this.p1Top[0]) * k,
        y: this.p1Top[1] + (this.p2Top[1] - this.p1Top[1]) * k,
        angle: Math.atan2(this.p2Top[1] - this.p1Top[1], this.p2Top[0] - this.p1Top[0])
      };
    }
    u -= this.topLen;
    if (u < this.arc2Len) {
      const ang = this.aTop - u / this.r2;
      return { x: this.c2[0] + this.r2 * Math.cos(ang), y: this.c2[1] + this.r2 * Math.sin(ang), angle: ang - Math.PI / 2 };
    }
    u -= this.arc2Len;
    if (u < this.botLen) {
      const k = u / this.botLen;
      return {
        x: this.p2Bot[0] + (this.p1Bot[0] - this.p2Bot[0]) * k,
        y: this.p2Bot[1] + (this.p1Bot[1] - this.p2Bot[1]) * k,
        angle: Math.atan2(this.p1Bot[1] - this.p2Bot[1], this.p1Bot[0] - this.p2Bot[0])
      };
    }
    u -= this.botLen;
    // 뒤쪽 원(원쪽 스프로킷)의 바깥면(원접면)을 감는 호: 각도 감소 방향
    const ang = this.aBot - u / this.r1;
    return { x: this.c1[0] + this.r1 * Math.cos(ang), y: this.c1[1] + this.r1 * Math.sin(ang), angle: ang - Math.PI / 2 };
  }
}

/** 경로를 따라 체인 링크들을 배치한 Group 생성 */
export function buildChainAlongPath(path: ChainPath2D, linkPitch = 0.16, z = 0): THREE.Group {
  const group = new THREE.Group();
  const count = Math.max(12, Math.round(path.length / linkPitch));
  const linkGeo = new THREE.BoxGeometry(linkPitch * 0.82, 0.05, 0.045);
  const rollerGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.07, 10);
  rollerGeo.rotateX(Math.PI / 2);
  const linkMat = mat(DARK_STEEL, 0.85, 0.3);
  const rollerMat = mat(STEEL, 0.9, 0.25);
  for (let i = 0; i < count; i++) {
    const s = (i / count) * path.length;
    const p = path.pointAt(s);
    const m = new THREE.Mesh(linkGeo, linkMat);
    m.position.set(p.x, p.y, z);
    m.rotation.z = p.angle;
    m.userData.s = s;
    group.add(m);
    if (i % 2 === 0) {
      const roller = new THREE.Mesh(rollerGeo, rollerMat);
      roller.position.set(p.x, p.y, z);
      roller.userData.s = s;
      group.add(roller);
    }
  }
  return group;
}

// ─────────────────────────── 개별 부품 빌더 ───────────────────────────

function buildBolt(): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.11, 6), mat(0x546e7a));
  head.position.y = 0.36;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.62, 16), mat(STEEL));
  const threadMat = mat(DARK_STEEL, 0.85, 0.3);
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 20), threadMat);
    t.rotation.x = Math.PI / 2;
    t.position.y = -0.28 + i * 0.055;
    g.add(t);
  }
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.13, 6), mat(0x78909c));
  nut.position.set(0.38, 0.1, 0.3);
  g.add(head, shaft, nut);
  return g;
}

function buildPin(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 14), mat(STEEL));
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14), mat(DARK_STEEL));
  head.position.y = 0.33;
  g.add(body, head);
  g.rotation.z = Math.PI / 2.4;
  return g;
}

function buildPinTaper(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.62, 14), mat(STEEL));
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 14), mat(DARK_STEEL));
  head.position.y = 0.33;
  g.add(body, head);
  g.rotation.z = Math.PI / 2.4;
  return g;
}

function buildPinSplit(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 12), mat(STEEL));
  body.position.y = 0.1;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 18), mat(STEEL));
  eye.position.y = 0.32;
  const prongGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8);
  const p1 = new THREE.Mesh(prongGeo, mat(STEEL));
  p1.position.set(0.05, -0.12, 0);
  p1.rotation.z = -0.35;
  const p2 = new THREE.Mesh(prongGeo, mat(STEEL));
  p2.position.set(-0.05, -0.12, 0);
  p2.rotation.z = 0.35;
  g.add(body, eye, p1, p2);
  g.rotation.z = Math.PI / 2.5;
  return g;
}

function buildAxle(): THREE.Group {
  const g = new THREE.Group();
  const long = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 12), mat(STEEL));
  long.rotation.z = Math.PI / 2;
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 14), mat(DARK_STEEL));
  mid.rotation.z = Math.PI / 2;
  g.add(long, mid);
  return g;
}

function buildBearing(): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 12, 40), mat(DARK_STEEL));
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 12, 36), mat(STEEL));
  g.add(outer, inner);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), mat(0xd9e2ea, 1.0, 0.15));
    ball.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0);
    g.add(ball);
  }
  g.rotation.x = Math.PI / 2.6;
  return g;
}

function buildDriveShaft(): THREE.Group {
  const g = new THREE.Group();
  const long = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 14), mat(STEEL));
  long.rotation.z = Math.PI / 2;
  const flangeGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 18);
  const f1 = new THREE.Mesh(flangeGeo, mat(DARK_STEEL));
  f1.rotation.z = Math.PI / 2;
  f1.position.x = -0.55;
  const f2 = new THREE.Mesh(flangeGeo, mat(DARK_STEEL));
  f2.rotation.z = Math.PI / 2;
  f2.position.x = 0.55;
  const joint = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 10, 22), mat(BRASS, 0.75, 0.35));
  joint.rotation.y = Math.PI / 2;
  g.add(long, f1, f2, joint);
  g.rotation.z = 0.25;
  return g;
}

function buildCrankShaft(): THREE.Group {
  const g = new THREE.Group();
  const shaftMat = mat(STEEL);
  const segGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12);
  const s1 = new THREE.Mesh(segGeo, shaftMat);
  s1.rotation.z = Math.PI / 2;
  s1.position.set(-0.5, 0, 0.16);
  const s2 = new THREE.Mesh(segGeo, shaftMat);
  s2.rotation.z = Math.PI / 2;
  s2.position.set(0.5, 0, -0.16);
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.44, 12), mat(STEEL));
  mid.rotation.z = Math.PI / 2;
  const webGeo = new THREE.BoxGeometry(0.12, 0.34, 0.08);
  const w1 = new THREE.Mesh(webGeo, mat(DARK_STEEL));
  w1.position.set(-0.24, 0, 0.08);
  const w2 = new THREE.Mesh(webGeo, mat(DARK_STEEL));
  w2.position.set(0.24, 0, -0.08);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), mat(BRASS, 0.75, 0.35));
  pin.position.set(0, 0.13, 0);
  g.add(s1, s2, mid, w1, w2, pin);
  g.rotation.y = 0.45;
  return g;
}

function buildSpring(): THREE.Group {
  const curve = new THREE.CatmullRomCurve3(
    Array.from({ length: 80 }, (_, i) => {
      const t = i / 79;
      const a = t * Math.PI * 12;
      return new THREE.Vector3(Math.cos(a) * 0.24, t * 0.72 - 0.36, Math.sin(a) * 0.24);
    })
  );
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.038, 10), mat(0x9aa7b2, 0.7, 0.45)));
  return g;
}

function buildDiscBrake(): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.045, 40), mat(0xc4ced8, 0.9, 0.25));
  disc.rotation.x = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 18), mat(DARK_STEEL));
  hub.rotation.x = Math.PI / 2;
  const caliper = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 10, 24, Math.PI / 2.2), mat(0xc0392b, 0.4, 0.5));
  caliper.rotation.z = 0.5;
  const pad1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.055), mat(0x2c3138, 0.2, 0.8));
  pad1.position.set(0.28, 0.32, 0);
  pad1.rotation.z = -0.4;
  g.add(disc, hub, caliper, pad1);
  return g;
}

function buildBlockBrake(): THREE.Group {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 10, 40, Math.PI * 1.1), mat(0x8b959e, 0.85, 0.3));
  rim.rotation.z = Math.PI * 0.95;
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), mat(0x5a646d, 0.7, 0.4));
  lever.position.set(0.42, 0.12, 0);
  lever.rotation.z = 0.5;
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.1), mat(0x2c3138, 0.15, 0.85));
  block.position.set(0.2, 0.42, 0);
  block.rotation.z = -0.15;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), mat(0x44505a));
  cable.position.set(0.62, 0.3, 0);
  cable.rotation.z = 1.1;
  g.add(rim, lever, block, cable);
  return g;
}

function buildFrictionWheel(): THREE.Group {
  const g = new THREE.Group();
  const big = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 36), mat(0x8e6e3a, 0.6, 0.55));
  big.position.x = -0.37;
  big.rotation.z = Math.PI / 2;
  const small = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 30), mat(0x3d4750, 0.6, 0.5));
  small.position.x = 0.38;
  small.rotation.z = Math.PI / 2;
  const ax1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12), mat(STEEL));
  ax1.rotation.z = Math.PI / 2;
  ax1.position.x = -0.37;
  const ax2 = ax1.clone();
  ax2.position.x = 0.38;
  g.add(big, small, ax1, ax2);
  return g;
}

function buildSpurGear(): THREE.Group {
  const g = new THREE.Group();
  g.add(buildSpurGearMesh(16, 0.52, 0.1, 0.2));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16), mat(DARK_STEEL));
  g.add(hub);
  return g;
}

function buildHelicalGear(): THREE.Group {
  const g = new THREE.Group();
  g.add(buildHelicalGearMesh(16, 0.52, 0.1, 0.3));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.38, 16), mat(DARK_STEEL));
  g.add(hub);
  return g;
}

function buildBevelGear(): THREE.Group {
  const g = new THREE.Group();
  g.add(buildBevelGearMesh(18, 0.55, 0.1, 0.26));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.34, 16), mat(DARK_STEEL));
  g.add(hub);
  g.rotation.x = -0.5;
  return g;
}

function buildWormGear(): THREE.Group {
  const g = new THREE.Group();
  // 웜: 축 X 방향 실린더 + 나사산
  const wormBody = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.52, 20), mat(STEEL));
  wormBody.rotation.z = Math.PI / 2;
  const helixPts: THREE.Vector3[] = [];
  const turns = 3.5;
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const a = t * turns * Math.PI * 2;
    helixPts.push(new THREE.Vector3((t - 0.5) * 0.46, Math.cos(a) * 0.195, Math.sin(a) * 0.195));
  }
  const wormThread = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 160, 0.042, 8),
    mat(DARK_STEEL)
  );
  // 웜기어: 축 Z 방향 큰 기어, 웜과 맞물리게 배치
  const wheel = buildSpurGearMesh(26, 0.36, 0.075, 0.16, BRASS);
  wheel.position.set(0.45, 0, 0);
  g.add(wormBody, wormThread, wheel);
  return g;
}

function buildRackPinion(): THREE.Group {
  const g = new THREE.Group();
  const pinion = buildSpurGearMesh(12, 0.3, 0.07, 0.14, BRASS);
  const rackMat = mat(STEEL);
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.14), rackMat);
  rack.position.set(0.28, 0.27, 0);
  const toothGeo = new THREE.BoxGeometry(0.07, 0.07, 0.14);
  for (let i = 0; i < 9; i++) {
    const tooth = new THREE.Mesh(toothGeo, rackMat);
    tooth.position.set(-0.28 + i * 0.157, 0.365, 0);
    g.add(tooth);
  }
  g.add(pinion, rack);
  return g;
}

function buildBeltPulley(): THREE.Group {
  const g = new THREE.Group();
  const makePulley = (x: number): THREE.Group => {
    const p = new THREE.Group();
    const side1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 28), mat(0x9aa7b2));
    side1.rotation.x = Math.PI / 2;
    side1.position.z = 0.09;
    const side2 = side1.clone();
    side2.position.z = -0.09;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 28), mat(DARK_STEEL));
    core.rotation.x = Math.PI / 2;
    p.add(side1, side2, core);
    p.position.set(x, 0, 0);
    return p;
  };
  g.add(makePulley(-0.6), makePulley(0.6));
  // 벨트: 스타디움 경로 튜브
  const path = new ChainPath2D(-0.6, 0, 0.305, 0.6, 0, 0.305);
  const pts: THREE.Vector3[] = Array.from({ length: 72 }, (_, i) => {
    const p = path.pointAt((i / 72) * path.length);
    return new THREE.Vector3(p.x, p.y, 0);
  });
  const belt = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 200, 0.03, 8, true),
    mat(RUBBER, 0.1, 0.85)
  );
  g.add(belt);
  return g;
}

function buildSprocketPart(): THREE.Group {
  const g = new THREE.Group();
  const shape = gearShape(18, 0.36, 0.11, 0.14);
  addHole(shape, 0, 0, 0.08);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    addHole(shape, Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0.05);
  }
  g.add(new THREE.Mesh(extrudeFlat(shape, 0.07, 0.01), mat(STEEL, 0.85, 0.3)));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 14), mat(DARK_STEEL));
  g.add(hub);
  return g;
}

function buildChainPart(): THREE.Group {
  // 작은 스타디움 경로에 체인 링크 나열 (전시용)
  const path = new ChainPath2D(-0.42, 0, 0.24, 0.42, 0, 0.24);
  const g = buildChainAlongPath(path, 0.15, 0);
  return g;
}

function buildCam(): THREE.Group {
  const g = new THREE.Group();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r = 0.32 + 0.14 * Math.cos(a);
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const camShape = new THREE.Shape(pts);
  addHole(camShape, 0, 0, 0.08);
  const camMesh = new THREE.Mesh(extrudeFlat(camShape, 0.12, 0.01), mat(STEEL, 0.8, 0.35));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 12), mat(DARK_STEEL));
  const follower = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 14), mat(BRASS));
  follower.position.y = -0.48;
  const guide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.1), mat(0x9aa7b2, 0.4, 0.6));
  guide.position.y = -0.68;
  g.add(camMesh, shaft, follower, guide);
  g.rotation.x = 0.35;
  return g;
}

function buildLink(): THREE.Group {
  const g = new THREE.Group();
  const barGeo = new THREE.BoxGeometry(0.62, 0.1, 0.07);
  const barMat = mat(STEEL);
  const ringGeo = new THREE.TorusGeometry(0.12, 0.035, 10, 22);
  const b1 = new THREE.Mesh(barGeo, barMat);
  b1.position.set(-0.28, 0.16, 0);
  b1.rotation.z = -0.28;
  const b2 = new THREE.Mesh(barGeo, barMat);
  b2.position.set(0.3, -0.14, 0);
  b2.rotation.z = -0.24;
  const r1 = new THREE.Mesh(ringGeo, barMat);
  r1.position.set(-0.58, 0.25, 0);
  const r2 = new THREE.Mesh(ringGeo, barMat);
  r2.position.set(0.6, -0.22, 0);
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), mat(BRASS));
  pivot.position.set(0.03, 0.01, 0);
  pivot.rotation.x = Math.PI / 2;
  g.add(b1, b2, r1, r2, pivot);
  return g;
}

// ─────────────────────────── 공용 인터페이스 ───────────────────────────

const BUILDERS: Record<BuilderId, () => THREE.Group> = {
  bolt: buildBolt,
  pinParallel: buildPin,
  pinTaper: buildPinTaper,
  pinSplit: buildPinSplit,
  axle: buildAxle,
  driveShaft: buildDriveShaft,
  crankShaft: buildCrankShaft,
  bearing: buildBearing,
  spring: buildSpring,
  blockBrake: buildBlockBrake,
  discBrake: buildDiscBrake,
  frictionWheel: buildFrictionWheel,
  spurGear: buildSpurGear,
  helicalGear: buildHelicalGear,
  bevelGear: buildBevelGear,
  wormGear: buildWormGear,
  rackPinion: buildRackPinion,
  beltPulley: buildBeltPulley,
  sprocket: buildSprocketPart,
  chain: buildChainPart,
  cam: buildCam,
  link: buildLink
};

export function buildPart(builder: BuilderId): THREE.Group {
  const fn = BUILDERS[builder];
  if (!fn) throw new Error(`Unknown builder: ${builder}`);
  return fn();
}

/** 부품을 target 크기(최대 변 기준)로 스케일하고 중심을 원점에 맞춘 래퍼 Group으로 감싸기 */
export function normalizePart(part: THREE.Group, target = 1.7): THREE.Group {
  const box = new THREE.Box3().setFromObject(part);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const inner = new THREE.Group();
  inner.add(part);
  inner.scale.setScalar(target / maxDim);
  const box2 = new THREE.Box3().setFromObject(inner);
  const center = box2.getCenter(new THREE.Vector3());
  inner.position.sub(center);
  const wrapper = new THREE.Group();
  wrapper.add(inner);
  return wrapper;
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
  });
}
