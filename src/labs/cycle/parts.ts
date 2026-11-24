// 13-A 두 엔진이 함께 쓰는 움직이는 부품(크랭크·커넥팅 로드·피스톤·플라이휠·점화 플러그)과 가스 표현
// 좌표: 실린더 축 = +y, 크랭크축 = z축(앞쪽 +z로 잘려 있음). 크랭크는 앞에서 볼 때 시계 방향으로 돈다.

import * as THREE from 'three';
import { aluminum, darkSteel, glow, plastic, rubber, steel, castIron } from '../../models/materials';
import { lathe, type V2 } from '../../models/parts/geom';
import { GAS } from './data';
import { TAU } from './geo';

export const CRANK_Y = 1.0;
export const CR = 0.36;
export const ROD_L = 1.2;
export const BORE_R = 0.4;
export const PISTON_R = 0.393;
export const DEG = Math.PI / 180;

/** 크랭크각(상사점 0, 도) → 피스톤 핀 높이 — 크랭크-슬라이더 식 */
export function pinY(thetaDeg: number): number {
  const a = thetaDeg * DEG;
  const s = CR * Math.sin(a);
  return CRANK_Y + CR * Math.cos(a) + Math.sqrt(ROD_L * ROD_L - s * s);
}

export interface CycleState {
  /** 피스톤 진행 방향 */
  dir: 'up' | 'down';
  /** 사점 근처 */
  dead: 'tdc' | 'bdc' | null;
  /** 흡기·배기(·소기) 열림 정도 0~1 */
  open: Record<string, number>;
  spark: boolean;
  /** 실린더 안 가스 이름 */
  gas: string;
  /** 2행정: 크랭크실 상태 */
  crankcase?: string;
}

export interface TagDef {
  key: string;
  label: string;
  pos: THREE.Vector3;
  /** 이름표 위치: 기본 위, below 아래, left/right 옆 */
  side?: 'below' | 'left' | 'right';
  /** 자리가 모자랄 때 접는 순서(3 → 2). 기본 1 */
  priority?: 1 | 2 | 3;
  /** true = 블록 뒤에 있어 정면에서는 안 보이는 부품 — 카메라가 엔진 뒤쪽(로컬 z < −0.2)일 때만 이름표를 단다 */
  backOnly?: boolean;
}

export interface CycleEngine {
  readonly root: THREE.Group;
  /** 한 사이클의 크랭크각(720 또는 360) */
  readonly cycle: number;
  setPhase(phi: number): void;
  state(phi: number): CycleState;
  tags(): TagDef[];
  dispose(): void;
}

// ───────────────────────── 재질 묶음 ─────────────────────────

export class Mats {
  readonly steel = steel();
  readonly dark = darkSteel();
  readonly alu = aluminum({ color: 0xd3d8de });
  readonly pistonAlu = aluminum({ color: 0xdfe3e8 });
  readonly iron = castIron({ color: 0x4d555f });
  readonly bodyAlu = aluminum({ color: 0x9aa4af, roughness: 0.5 });
  readonly interior = castIron({ color: 0x8c96a1, roughness: 0.6, metalness: 0.5 });
  readonly bore = steel({ color: 0xaeb8c3, roughness: 0.3 });
  readonly ceramic = plastic(0xf0ede6, { roughness: 0.3, grain: false });
  readonly boot = rubber({ color: 0x2b2d31 });
  readonly white = plastic(0xf5f5f5, { grain: false });
  readonly web = darkSteel({ color: 0x3f4852 });
  readonly exhaust = castIron({ color: 0x5a4c42, roughness: 0.55 });
  constructor() {
    for (const m of [this.interior, this.bore, this.exhaust, this.bodyAlu]) m.side = THREE.DoubleSide;
  }
}

export function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    const see = mat.transparent === true || c.userData.noAO === true;
    m.castShadow = !see;
    m.receiveShadow = !see;
  });
}

/** Y축 회전체를 z축 방향으로 눕힌 것: 프로파일 [r, z] */
function latheZ(profile: V2[], segs = 40): THREE.BufferGeometry {
  const g = lathe(profile, segs);
  g.rotateX(Math.PI / 2); // y → z 축 (부호 주의: y=+1 → z=+1)
  return g;
}

function rodZ(r: number, z0: number, z1: number, c = 0.008, segs = 32): THREE.BufferGeometry {
  // rotateX(+90°)는 y를 +z로 보낸다 — 프로파일의 y를 그대로 z로 쓴다
  return latheZ(
    [
      [0, z0],
      [r - c, z0],
      [r, z0 + c],
      [r, z1 - c],
      [r - c, z1],
      [0, z1]
    ],
    segs
  );
}

// ───────────────────────── 크랭크축 ─────────────────────────

/** 크랭크축 + 균형추 + 플라이휠. 원점 = 크랭크축 중심, rotation.z = -θ */
export function buildCrank(m: Mats, sprocketZ: number | null): THREE.Group {
  const g = new THREE.Group();
  const web = new THREE.Shape();
  web.absarc(0, CR, 0.13, 0, Math.PI, false);
  web.lineTo(-0.12, 0.02);
  web.absarc(0, 0, 0.44, Math.PI + 0.42, TAU - 0.42, false);
  web.lineTo(0.12, 0.02);
  web.closePath();
  const webGeo = new THREE.ExtrudeGeometry(web, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 32 });
  for (const z of [0.08, -0.16]) {
    const w = new THREE.Mesh(webGeo, m.web);
    w.position.z = z;
    g.add(w);
  }
  const pin = new THREE.Mesh(rodZ(0.07, -0.085, 0.085, 0.004), m.steel);
  pin.position.y = CR;
  g.add(pin);
  g.add(new THREE.Mesh(rodZ(0.08, 0.15, 0.34, 0.01), m.steel));
  g.add(new THREE.Mesh(rodZ(0.08, -0.98, -0.15, 0.01), m.steel));
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6), m.dark);
  nut.rotation.x = Math.PI / 2;
  nut.position.z = 0.36;
  g.add(nut);
  // 회전 방향이 보이도록 앞 웹에 흰 표시
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.012), m.white);
  mark.position.set(0, -0.3, 0.157);
  g.add(mark);

  // 플라이휠 (뒤쪽)
  const fz = -0.84;
  const fly = new THREE.Mesh(
    latheZ(
      [
        [0.08, fz - 0.07],
        [0.7, fz - 0.07],
        [0.74, fz - 0.05],
        [0.74, fz + 0.05],
        [0.7, fz + 0.07],
        [0.6, fz + 0.07],
        [0.56, fz + 0.03],
        [0.2, fz + 0.03],
        [0.16, fz + 0.07],
        [0.08, fz + 0.07]
      ],
      72
    ),
    m.iron
  );
  g.add(fly);
  const fmark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.012), m.white);
  fmark.position.set(0, 0.64, fz + 0.077);
  g.add(fmark);
  if (sprocketZ !== null) {
    const sp = new THREE.Mesh(rodZ(0.1, sprocketZ - 0.035, sprocketZ + 0.035, 0.008, 40), m.alu);
    g.add(sp);
  }
  return g;
}

// ───────────────────────── 커넥팅 로드 · 피스톤 ─────────────────────────

/** 원점 = 소단부(피스톤 핀), 대단부는 (0, -ROD_L) */
export function buildRod(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.065, -0.7, Math.PI + 0.7, false);
  s.lineTo(-0.055, -ROD_L + 0.16);
  s.absarc(0, -ROD_L, 0.13, Math.PI - 0.5, TAU + 0.5, false);
  s.lineTo(0.055, -ROD_L + 0.16);
  s.closePath();
  const h1 = new THREE.Path();
  h1.absarc(0, 0, 0.032, 0, TAU, true);
  const h2 = new THREE.Path();
  h2.absarc(0, -ROD_L, 0.072, 0, TAU, true);
  s.holes.push(h1, h2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 32 });
  geo.translate(0, 0, -0.04);
  g.add(new THREE.Mesh(geo, steel({ color: 0xb4bcc5 })));
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.104), m.dark);
  cap.position.y = -ROD_L;
  g.add(cap);
  return g;
}

/** 원점 = 피스톤 핀. 위로 top, 아래로 skirt */
export function buildPiston(m: Mats, top: number, skirt: number): THREE.Group {
  const g = new THREE.Group();
  const r = PISTON_R;
  const prof: V2[] = [
    [0, -skirt],
    [r - 0.01, -skirt],
    [r, -skirt + 0.01],
    [r, top - 0.11],
    [r - 0.01, top - 0.105],
    [r - 0.01, top - 0.09],
    [r, top - 0.085],
    [r, top - 0.07],
    [r - 0.01, top - 0.065],
    [r - 0.01, top - 0.05],
    [r, top - 0.045],
    [r, top - 0.008],
    [r - 0.008, top],
    [0, top]
  ];
  g.add(new THREE.Mesh(lathe(prof, 64), m.pistonAlu));
  const ringGeo = new THREE.TorusGeometry(r - 0.003, 0.006, 6, 64);
  ringGeo.rotateX(Math.PI / 2);
  for (const y of [top - 0.0975, top - 0.0575]) {
    const ring = new THREE.Mesh(ringGeo, m.dark);
    ring.position.y = y;
    g.add(ring);
  }
  g.add(new THREE.Mesh(rodZ(0.032, -0.3, 0.3, 0.004, 20), m.steel));
  return g;
}

/** 점화 플러그(축 = y, x=0) : 전극 끝 tipY, 고무 캡 꼭대기 topY */
export function buildPlug(m: Mats, tipY: number, topY: number): THREE.Group {
  const g = new THREE.Group();
  const hexY = tipY + 0.17;
  g.add(
    new THREE.Mesh(
      lathe(
        [
          [0, tipY - 0.012],
          [0.012, tipY - 0.012],
          [0.03, tipY],
          [0.04, tipY + 0.01],
          [0.04, hexY],
          [0, hexY]
        ],
        24
      ),
      m.steel
    )
  );
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.07, 6), m.steel);
  hex.position.y = hexY + 0.035;
  g.add(hex);
  const cer = new THREE.Mesh(
    lathe(
      [
        [0, hexY + 0.07],
        [0.034, hexY + 0.07],
        [0.03, topY - 0.16],
        [0, topY - 0.16]
      ],
      24
    ),
    m.ceramic
  );
  g.add(cer);
  const boot = new THREE.Mesh(
    lathe(
      [
        [0, topY - 0.19],
        [0.05, topY - 0.19],
        [0.055, topY - 0.06],
        [0.04, topY],
        [0, topY]
      ],
      24
    ),
    m.boot
  );
  g.add(boot);
  return g;
}

// ───────────────────────── 가스 ─────────────────────────

/** 실린더 안 반투명 가스 기둥(뒤쪽 반원통 + 앞 단면). y 높이 1 → scale.y로 늘인다 */
export function buildGasVolume(r: number): { group: THREE.Group; mat: THREE.MeshStandardMaterial } {
  const mat = new THREE.MeshStandardMaterial({ color: GAS.mix, emissive: GAS.mix, emissiveIntensity: 0.4, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6 });
  const group = new THREE.Group();
  const curved = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(r, 0), new THREE.Vector2(r, 1)], 40, Math.PI / 2, Math.PI),
    mat
  );
  const front = new THREE.PlaneGeometry(2 * r, 1);
  front.translate(0, 0.5, -0.004);
  group.add(curved, new THREE.Mesh(front, mat));
  group.traverse((o) => {
    o.userData.noAO = true;
    o.renderOrder = 3;
  });
  return { group, mat };
}

/** 가스 입자(작은 구) */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private c = new THREE.Color();
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(count: number, r = 0.03) {
    const geo = new THREE.SphereGeometry(r, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.userData.noAO = true;
    this.mesh.renderOrder = 4;
    for (let i = 0; i < count; i++) {
      this.mesh.setMatrixAt(i, this.hidden);
      this.mesh.setColorAt(i, this.c.setHex(0xffffff));
    }
  }
  set(i: number, p: THREE.Vector3 | null, color?: THREE.Color): void {
    if (!p) {
      this.mesh.setMatrixAt(i, this.hidden);
      return;
    }
    this.m.makeTranslation(p.x, p.y, p.z);
    this.mesh.setMatrixAt(i, this.m);
    if (color) this.mesh.setColorAt(i, color);
  }
  commit(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const cMix = new THREE.Color(GAS.mix);
const cComp = new THREE.Color(GAS.comp);
const cFire = new THREE.Color(0xfff0a0);
const cOrange = new THREE.Color(GAS.fire);
const cHot = new THREE.Color(GAS.hot);
const cBurnt = new THREE.Color(GAS.burnt);

/**
 * 한 덩어리 혼합기의 일생에 따른 색. 단계 경계(각도)는 엔진마다 다르게 준다.
 * compA→compB: 압축(파랑→짙은 파랑), fire: 점화, burnEnd: 연소가 끝나 회색이 되는 시점
 */
export function lifeColor(L: number, compA: number, compB: number, burnEnd: number, out: THREE.Color): THREE.Color {
  if (L < compA) return out.copy(cMix);
  if (L < compB) return out.copy(cMix).lerp(cComp, (L - compA) / (compB - compA));
  const f = L - compB;
  if (f < 6) return out.copy(cComp).lerp(cFire, f / 6);
  if (f < 20) return out.copy(cFire).lerp(cOrange, (f - 6) / 14);
  const span = burnEnd - compB - 20;
  const u = (f - 20) / span;
  if (u < 0.5) return out.copy(cOrange).lerp(cHot, u * 2);
  if (u < 1) return out.copy(cHot).lerp(cBurnt, (u - 0.5) * 2);
  return out.copy(cBurnt);
}

/** 가스 기둥 색·투명도 (같은 단계 경계) */
export function volumeLook(L: number, compA: number, compB: number, burnEnd: number, mat: THREE.MeshStandardMaterial): void {
  const c = lifeColor(L, compA, compB, burnEnd, mat.color);
  mat.emissive.copy(c);
  let op = 0.16;
  let ei = 0.35;
  if (L >= compA && L < compB) {
    const u = (L - compA) / (compB - compA);
    op = 0.18 + 0.24 * u;
    ei = 0.35 + 0.35 * u;
  } else if (L >= compB) {
    const f = L - compB;
    const e = Math.exp(-f / 28);
    op = 0.24 + 0.5 * e;
    ei = 0.4 + 2.6 * e;
    if (L > burnEnd) op = 0.2;
  }
  mat.opacity = op;
  mat.emissiveIntensity = ei;
}

/** 점화 불꽃 + 화염 구 + 주황 조명 */
export class Ignition {
  readonly group = new THREE.Group();
  private spark: THREE.Mesh;
  private flame: THREE.Mesh;
  private flameMat: THREE.MeshStandardMaterial;
  private light = new THREE.PointLight(0xff8a30, 0, 1.1, 2);
  constructor(tip: THREE.Vector3) {
    this.spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), glow(0xfff6c0, 6));
    this.spark.position.copy(tip);
    this.flameMat = new THREE.MeshStandardMaterial({ color: GAS.fire, emissive: GAS.fire, emissiveIntensity: 2.5, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.5 });
    this.flame = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, TAU, 0, Math.PI / 2), this.flameMat);
    this.flame.rotation.x = Math.PI; // 아래로 퍼지는 반구
    this.flame.position.copy(tip);
    this.light.position.copy(tip).add(new THREE.Vector3(0, -0.08, 0.15));
    this.group.add(this.spark, this.flame, this.light);
    this.group.traverse((o) => (o.userData.noAO = true));
    this.flame.renderOrder = 5;
  }
  /** f = 점화 후 크랭크각(도, 음수면 점화 전), maxR: 화염이 퍼질 수 있는 반지름(연소실 높이에 맞춤) */
  set(f: number, maxR: number): void {
    const sparkOn = f > -8 && f < 8;
    this.spark.visible = sparkOn;
    this.spark.scale.setScalar(sparkOn ? 1 + 0.6 * Math.cos(f * 0.8) : 1);
    const on = f >= 0 && f < 40;
    this.flame.visible = on;
    if (on) {
      const r = Math.min(maxR, 0.04 + f * 0.035);
      this.flame.scale.set(r * 2.2, Math.min(r, maxR), r);
      this.flameMat.opacity = 0.7 * (1 - f / 40);
    }
    this.light.intensity = f >= -2 && f < 60 ? 3 * Math.exp(-Math.max(0, f) / 14) : 0;
  }
}

export function disposeTree(o: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  o.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      const map = (m as THREE.MeshStandardMaterial).map;
      if (map && c.userData.cutTex) map.dispose();
      m.dispose();
    }
  });
}
