// 작두펌프 3D 모델 — 무쇠 몸통(컷어웨이/겉모습), 손잡이-흔들 링크-피스톤 로드 링크 기구, 두 체크 밸브,
// 땅속 단면(흙·지하수층·관), 물(관·피스톤 아래·피스톤 위·양동이), 물방울·공기 방울 입자.
// 좌표: 펌프 축 x=0, z=0. 컷어웨이 단면은 z=0 평면(앞쪽 z>0 반을 잘라 냄). 주둥이는 +x, 손잡이 끝은 −x.

import * as THREE from 'three';
import { castIron, steel, darkSteel, rubber, plastic, wood, aluminum, glass, glow, paint } from '../../models/materials';
import { lathe, mesh, extrude, shapeFrom, stadiumShape, hexPrism, merge, type V2 } from '../../models/parts/geom';
import { STROKE, A_C, VALVE_ABOVE_GROUND } from './physics';

// ── 배치 상수(씬 단위) ──
export const GY = 2.1; // 마당 지면 높이(흙 단면 블록의 윗면)
export const K_UG = 0.15; // 땅속 1 m = 0.15 단위 (깊이는 줄여서 그림)
const PAD_H = 0.15;
const PY = GY + PAD_H; // 시멘트 받침 윗면
export const YB0 = PY + 0.35; // 몸통 바닥 플랜지 기준 높이
const SEAT = 0.1; // 아래 밸브 자리(몸통 기준)
const BORE = 0.22;
const PISTON_H = 0.11;
const SPOUT_O: V2 = [0.2, 1.0];
const SPOUT_TILT = THREE.MathUtils.degToRad(10);
const SPOUT_IN_BOTTOM = 0.935;
const SLOT = 0.25; // 단면 홈 반폭
const FRONT = 0.35; // 흙 블록 앞면 z
const BACK = -1.3;
const MID_BACK = -0.07; // 홈 뒷벽(관 뒤)
const PIPE_RO = 0.055;
const PIPE_RI = 0.042;
const PIPE_BOTTOM = 0.06;

// ── 링크 기구 ──
const E: V2 = [-0.5, 1.28]; // 몸통 뒤 귀(흔들 링크 고정 핀)
const A_LEV = 0.5; // 로드 핀 R ~ 받침점 P
const L_LINK = 0.45; // 흔들 링크 길이
export const L_HANDLE = 2.3; // 로드 핀 ~ 손잡이 끝
export const PHI_MAX = THREE.MathUtils.degToRad(32);

/** 손잡이 각 φ(손잡이 끝이 수평보다 위로 올라간 각)에서 로드 핀 높이를 푼다. R=(0,yR), P=R+a(−cosφ, sinφ), |P−E|=L */
export function rodPinY(phi: number): number {
  const dx = -A_LEV * Math.cos(phi) - E[0];
  return E[1] - A_LEV * Math.sin(phi) + Math.sqrt(L_LINK * L_LINK - dx * dx);
}
const YR_LOW = rodPinY(PHI_MAX);
const YR_HIGH = rodPinY(-PHI_MAX);
const PISTON_MIN = SEAT + 0.04; // 피스톤 아랫면 최저(밸브 덮개와의 틈)
const ROD_L = YR_LOW - PISTON_MIN; // 로드 핀 ~ 피스톤 아랫면
/** 몸통 안 1 m = KB 단위 (시각 행정 ÷ 실제 행정) */
export const KB = (YR_HIGH - YR_LOW) / STROKE;
/** 피스톤 맨 아래일 때 피스톤 윗면 ~ 주둥이 아랫면 [m] */
export const SPOUT_H_REAL = (SPOUT_IN_BOTTOM - (PISTON_MIN + PISTON_H)) / KB;
/** 받침점~손잡이 끝 ÷ 받침점~로드 핀 */
export const LEVER_RATIO = (L_HANDLE - A_LEV) / A_LEV;

export function depthY(d: number): number {
  return GY - d * K_UG;
}

const HALF0 = Math.PI / 2;
const HALF = Math.PI;

/** 회전체: 컷어웨이(뒤쪽 반) + 단면 덮개 / 겉모습(전체) 두 벌 */
function revolve(profile: V2[], segs: number): { cut: THREE.BufferGeometry; caps: THREE.BufferGeometry; full: THREE.BufferGeometry } {
  const cut = lathe(profile, Math.round(segs / 2), HALF0, HALF);
  const full = lathe(profile, segs);
  const right = new THREE.ShapeGeometry(shapeFrom(profile));
  const left = right.clone().scale(-1, 1, 1);
  const caps = merge([right, left]);
  return { cut, caps, full };
}

/** 반원기둥(뒤쪽 반) + 단면 사각형, 높이 0~1 — 물기둥용 */
function halfColumn(r: number, segs = 24): THREE.BufferGeometry {
  const c = new THREE.CylinderGeometry(r, r, 1, segs, 1, false, HALF0, HALF);
  c.translate(0, 0.5, 0);
  const face = new THREE.PlaneGeometry(2 * r, 1);
  face.translate(0, 0.5, 0);
  return merge([c, face]);
}

interface Drop {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  g: number;
  r: number;
  air: boolean;
  floor: number;
}

export type ViewMode = 'cut' | 'outside';

export class PumpModel {
  readonly root = new THREE.Group();
  readonly pump = new THREE.Group();
  /** 손잡이 드래그 판정용 메시 */
  readonly handlePick: THREE.Object3D[] = [];

  private handle = new THREE.Group();
  private rod = new THREE.Group();
  private piston = new THREE.Group();
  private links: THREE.Mesh[] = [];
  private flapL = new THREE.Group();
  private flapR = new THREE.Group();
  private foot = new THREE.Group();
  private flapMats: THREE.MeshStandardMaterial[] = [];
  private footMat: THREE.MeshStandardMaterial;
  private leatherMat: THREE.MeshStandardMaterial;
  private cutParts: THREE.Object3D[] = [];
  private fullParts: THREE.Object3D[] = [];
  private waterPipe: THREE.Mesh;
  private waterB: THREE.Mesh;
  private waterC: THREE.Mesh;
  private bucketWater!: THREE.Mesh;
  private bucketFill = -1;
  private stream: THREE.Mesh;
  private streamMat: THREE.MeshPhysicalMaterial;
  private dipper = new THREE.Group();
  private dipStream: THREE.Mesh;
  private soil: { dry: THREE.Mesh[]; wet: THREE.Mesh[] } = { dry: [], wet: [] };
  private wtLine!: THREE.Mesh;
  private arrows = new THREE.Group();
  private arrowMat!: THREE.MeshStandardMaterial;
  private limitLine = new THREE.Group();
  private drops: Drop[] = [];
  private dropMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colWater = new THREE.Color(0x3b93f0);
  private colAir = new THREE.Color(0xf4f8ff);
  private footA = 0;
  private flapA = 0;
  private depth = 6;
  private yR = YR_LOW;
  phi = PHI_MAX;

  constructor() {
    this.root.add(this.pump);
    this.pump.position.y = YB0;

    const iron = castIron({ color: 0x53463c, roughness: 0.8, metalness: 0.55 });
    const ironDark = castIron({ color: 0x3e352f, roughness: 0.75, metalness: 0.6 });
    const cutFace = castIron({ color: 0xb0a397, roughness: 0.5, metalness: 0.5 });
    cutFace.side = THREE.DoubleSide;
    const pin = steel();
    const water = glass(0x2f86e6, 0.62);
    water.roughness = 0.08;

    // ── 몸통 ──
    const BODY: V2[] = [
      [0.056, -0.16], [0.092, -0.16], [0.1, -0.152], [0.1, -0.045],
      [0.335, -0.045], [0.355, -0.03], [0.36, 0.0], [0.36, 0.03], [0.35, 0.05],
      [0.29, 0.06], [0.275, 0.08], [0.27, 0.1],
      [0.27, 0.33], [0.285, 0.34], [0.29, 0.355], [0.285, 0.37], [0.27, 0.38],
      [0.27, 0.68], [0.285, 0.69], [0.29, 0.705], [0.285, 0.72], [0.27, 0.73],
      [0.272, 0.96], [0.29, 1.05], [0.33, 1.13], [0.38, 1.19], [0.41, 1.215], [0.425, 1.24], [0.425, 1.265], [0.41, 1.285], [0.39, 1.29],
      [0.36, 1.29], [0.335, 1.25], [0.29, 1.16], [0.25, 1.07], [0.225, 1.0], [BORE, 0.96],
      [BORE, 0.12], [0.205, SEAT], [0.085, SEAT], [0.075, 0.09], [0.075, 0.03], [0.056, 0.0], [0.056, -0.16]
    ];
    this.addRevolved(BODY, 72, iron, cutFace, this.pump);
    // 주둥이 앞 구멍(단면에서 주둥이로 이어지는 입구)
    const mouth = mesh(new THREE.PlaneGeometry(0.06, 0.12), ironDark, this.pump);
    mouth.position.set(0.245, SPOUT_O[1], 0.001);
    this.cutParts.push(mouth);

    // ── 주둥이(+x, 아래로 10°) ──
    const SPOUT: V2[] = [
      [0.065, 0], [0.13, 0], [0.13, 0.03], [0.105, 0.09], [0.095, 0.2], [0.085, 0.5], [0.093, 0.52], [0.093, 0.55], [0.08, 0.56],
      [0.055, 0.56], [0.055, 0.5], [0.06, 0.2], [0.065, 0.0]
    ];
    const spout = new THREE.Group();
    spout.position.set(SPOUT_O[0], SPOUT_O[1], 0);
    spout.rotation.z = -Math.PI / 2 - SPOUT_TILT;
    this.pump.add(spout);
    this.addRevolved(SPOUT, 40, iron, cutFace, spout);

    // ── 뒤 귀(흔들 링크 고정) ──
    const cheek = shapeFrom([[-0.36, 1.1], [-0.58, 1.2], [-0.58, 1.34], [-0.42, 1.34], [-0.36, 1.27]]);
    for (const z of [-0.06, 0.06]) {
      const g = extrude(cheek, 0.025, 0.006);
      g.translate(0, 0, z);
      mesh(g, iron, this.pump);
    }
    const ePin = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.25, 16), pin, this.pump);
    ePin.rotation.x = Math.PI / 2;
    ePin.position.set(E[0], E[1], 0);

    // 플랜지 볼트 4개
    const bolts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const b = hexPrism(0.05, 0.035, false, true);
      b.translate(Math.cos(a) * 0.3, 0.065, Math.sin(a) * 0.3);
      bolts.push(b);
    }
    mesh(merge(bolts), darkSteel(), this.pump);

    // ── 땅 위 연결관(받침 ~ 몸통 소켓) ──
    const riserLen = YB0 - 0.16 - PY;
    const RISER: V2[] = [[PIPE_RI, 0], [PIPE_RO, 0], [PIPE_RO, riserLen], [PIPE_RI, riserLen], [PIPE_RI, 0]];
    const riser = new THREE.Group();
    riser.position.y = PY;
    this.root.add(riser);
    this.addRevolved(RISER, 32, darkSteel({ color: 0x6b6f72 }), cutFace, riser);
    const BASE: V2[] = [[PIPE_RO, 0], [0.19, 0], [0.19, 0.04], [0.17, 0.06], [0.08, 0.07], [0.07, 0.12], [PIPE_RO, 0.12], [PIPE_RO, 0]];
    const base = new THREE.Group();
    base.position.y = PY;
    this.root.add(base);
    this.addRevolved(BASE, 48, iron, cutFace, base);

    // ── 땅속 관 ──
    const pipeLen = GY - PIPE_BOTTOM;
    const PIPE: V2[] = [[PIPE_RI, 0], [PIPE_RO, 0], [PIPE_RO, pipeLen], [PIPE_RI, pipeLen], [PIPE_RI, 0]];
    const pipe = new THREE.Group();
    pipe.position.y = PIPE_BOTTOM;
    this.root.add(pipe);
    this.addRevolved(PIPE, 32, darkSteel({ color: 0x6b6f72 }), cutFace, pipe);

    // ── 피스톤(가죽 패킹 + 쇠 고리 + 두 쪽 덮개 밸브) ──
    this.pump.add(this.piston);
    this.leatherMat = rubber({ color: 0xb08a5c });
    mesh(lathe([[0.12, 0], [0.214, 0], [0.219, 0.012], [0.219, 0.05], [0.2, 0.056], [0.12, 0.056], [0.12, 0]], 48), this.leatherMat, this.piston);
    mesh(lathe([[0.12, 0.05], [0.2, 0.05], [0.2, 0.1], [0.19, PISTON_H], [0.13, PISTON_H], [0.12, 0.1], [0.12, 0.05]], 48), ironDark, this.piston);
    const bar = mesh(new THREE.BoxGeometry(0.05, 0.06, 0.25), ironDark, this.piston);
    bar.position.y = 0.08;
    mesh(lathe(rodProfileLocal(0.045, 0.03, PISTON_H), 24), ironDark, this.piston);
    const flapShape = (): THREE.BufferGeometry => {
      const r = 0.138;
      const x0 = 0.045;
      const t0 = Math.acos(x0 / r);
      const pts: V2[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = -t0 + (2 * t0 * i) / 20;
        pts.push([r * Math.cos(t), r * Math.sin(t)]);
      }
      const g = extrude(shapeFrom(pts), 0.016, 0.004);
      g.rotateX(Math.PI / 2);
      g.translate(-x0, 0.008, 0);
      return g;
    };
    for (const [grp, side] of [[this.flapR, 1], [this.flapL, -1]] as const) {
      const m = glow(0xd0453a, 0.25);
      m.roughness = 0.6;
      this.flapMats.push(m);
      const f = mesh(flapShape(), m, grp);
      f.scale.x = side;
      grp.position.set(0.045 * side, PISTON_H, 0);
      this.piston.add(grp);
    }
    const hinge = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 12), pin, this.piston);
    hinge.rotation.x = Math.PI / 2;
    hinge.position.y = PISTON_H + 0.01;

    // ── 아래 밸브(한쪽 경첩 덮개 + 추) ──
    this.footMat = glow(0xd0453a, 0.25);
    this.footMat.roughness = 0.6;
    const fd = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 32);
    fd.translate(0.1, 0.01, 0);
    mesh(fd, this.footMat, this.foot);
    const wgt = new THREE.CylinderGeometry(0.035, 0.04, 0.04, 20);
    wgt.translate(0.1, 0.04, 0);
    mesh(wgt, ironDark, this.foot);
    this.foot.position.set(-0.1, SEAT, 0);
    this.pump.add(this.foot);
    const footHinge = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.08), ironDark, this.pump);
    footHinge.position.set(-0.12, SEAT + 0.015, 0);

    // ── 피스톤 로드 + 로드 끝 고리 ──
    this.pump.add(this.rod);
    const rodLen = ROD_L - PISTON_H;
    mesh(new THREE.CylinderGeometry(0.024, 0.024, rodLen, 20).translate(0, -rodLen / 2, 0), steel(), this.rod);
    const yoke = extrude(shapeFrom([[-0.045, -0.13], [0.045, -0.13], [0.045, 0.03], [-0.045, 0.03]]), 0.02, 0.005);
    for (const z of [-0.05, 0.05]) mesh(yoke.clone().translate(0, 0, z), ironDark, this.rod);
    mesh(new THREE.BoxGeometry(0.09, 0.04, 0.12).translate(0, -0.13, 0), ironDark, this.rod);
    const rPin = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 14), pin, this.rod);
    rPin.rotation.x = Math.PI / 2;

    // ── 손잡이(지렛대): 원점 = 로드 핀 R, 손잡이 끝은 −x ──
    const hs = new THREE.Shape();
    hs.moveTo(0.07, -0.04);
    hs.absarc(0.0, 0.0, 0.07, -0.6, 0.6, false);
    hs.lineTo(0.0, 0.065);
    hs.lineTo(-A_LEV, 0.07);
    hs.quadraticCurveTo(-1.2, 0.06, -1.95, 0.035);
    hs.lineTo(-1.95, -0.035);
    hs.quadraticCurveTo(-1.2, -0.045, -A_LEV, -0.06);
    hs.lineTo(0.0, -0.055);
    hs.closePath();
    const hMesh = mesh(extrude(hs, 0.07, 0.015, 24, 2), iron, this.handle);
    const boss = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 24), iron, this.handle);
    boss.rotation.x = Math.PI / 2;
    boss.position.x = -A_LEV;
    const pPin = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 14), pin, this.handle);
    pPin.rotation.x = Math.PI / 2;
    pPin.position.x = -A_LEV;
    const grip = mesh(lathe([[0, 0], [0.045, 0.0], [0.05, 0.05], [0.05, 0.3], [0.06, 0.32], [0.06, 0.37], [0.03, 0.39], [0, 0.39]], 32), wood(0x7a5634), this.handle);
    grip.rotation.z = Math.PI / 2;
    grip.position.x = -1.93;
    this.handlePick.push(hMesh, grip, boss);
    this.pump.add(this.handle);

    // ── 흔들 링크(두 장) ──
    const linkGeo = extrude(stadiumShape(0, 0, 0, L_LINK, 0.04), 0.02, 0.005);
    for (const z of [-0.095, 0.095]) {
      const l = mesh(linkGeo.clone(), ironDark, this.pump);
      l.position.set(E[0], E[1], z);
      this.links.push(l);
    }
    linkGeo.dispose();

    // ── 물 ──
    this.waterPipe = mesh(halfColumn(PIPE_RI - 0.002, 16), water, this.root);
    this.waterB = mesh(halfColumn(BORE - 0.002, 40), water, this.pump);
    this.waterC = mesh(halfColumn(BORE - 0.002, 40), water, this.pump);
    for (const w of [this.waterPipe, this.waterB, this.waterC]) {
      w.castShadow = false;
      w.userData.noAO = true;
      w.renderOrder = 2;
    }

    this.buildGround(water);
    this.buildBucket(water);

    // 주둥이 물줄기
    this.streamMat = glass(0x3b93f0, 0.7);
    const tip = this.spoutTip();
    const end = new THREE.Vector3(1.0, PY + 0.08, 0);
    const curve = new THREE.QuadraticBezierCurve3(tip, new THREE.Vector3(tip.x + 0.16, tip.y - 0.05, 0), end);
    this.stream = mesh(new THREE.TubeGeometry(curve, 24, 0.028, 10, false), this.streamMat, this.root);
    this.stream.castShadow = false;
    this.stream.visible = false;

    // 마중물 바가지
    const bowl = mesh(new THREE.SphereGeometry(0.17, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), plastic(0xc9a15a, { roughness: 0.7 }), this.dipper);
    (bowl.material as THREE.Material).side = THREE.DoubleSide;
    const dipWater = mesh(new THREE.CircleGeometry(0.15, 28).rotateX(-Math.PI / 2).translate(0, -0.04, 0), water, this.dipper);
    dipWater.castShadow = false;
    this.dipper.position.set(0.32, YB0 + 1.75, -0.05);
    this.dipper.visible = false;
    this.root.add(this.dipper);
    this.dipStream = mesh(new THREE.CylinderGeometry(0.022, 0.03, 1, 12).translate(0, -0.5, 0), this.streamMat, this.root);
    this.dipStream.castShadow = false;
    this.dipStream.visible = false;

    // 입자
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), plastic(0xffffff, { roughness: 0.25 }), 140);
    this.dropMesh.count = 0;
    this.dropMesh.userData.noAO = true;
    this.dropMesh.frustumCulled = false;
    this.dropMesh.setColorAt(0, this.colWater);
    this.root.add(this.dropMesh);

    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.noAO) m.castShadow = true;
    });
    this.setView('cut');
    this.setDepth(6);
    this.setHandle(PHI_MAX);
  }

  private addRevolved(profile: V2[], segs: number, mat: THREE.Material, capMat: THREE.Material, parent: THREE.Object3D): void {
    const r = revolve(profile, segs);
    const cut = mesh(r.cut, mat, parent);
    const caps = mesh(r.caps, capMat, parent);
    const full = mesh(r.full, mat, parent);
    this.cutParts.push(cut, caps);
    this.fullParts.push(full);
  }

  private buildGround(water: THREE.Material): void {
    const top = plastic(0x7d6146, { roughness: 0.95 });
    const dry = plastic(0xa8875e, { roughness: 0.95 });
    const wet = plastic(0x5d7891, { roughness: 0.9 });
    const box = (x0: number, x1: number, z0: number, z1: number, m: THREE.Material): THREE.Mesh => {
      const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const b = mesh(g, m, this.root);
      b.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      b.scale.set(x1 - x0, 1, z1 - z0);
      return b;
    };
    const cols: [number, number, number, number][] = [
      [-1.7, -SLOT, BACK, FRONT],
      [SLOT, 1.7, BACK, FRONT],
      [-SLOT, SLOT, BACK, MID_BACK]
    ];
    for (const [x0, x1, z0, z1] of cols) {
      const t = box(x0, x1, z0, z1, top);
      t.position.y = GY - 0.14;
      t.scale.y = 0.14;
      this.soil.dry.push(box(x0, x1, z0, z1, dry));
      this.soil.wet.push(box(x0, x1, z0, z1, wet));
    }
    // 지하수면 선(단면 앞면 + 홈 뒷벽)
    const wl = new THREE.Group();
    const lineMat = glow(0x4fb2ff, 0.9);
    for (const [x0, x1, z] of [[-1.7, -SLOT, FRONT + 0.002], [SLOT, 1.7, FRONT + 0.002], [-SLOT, SLOT, MID_BACK + 0.002]] as const) {
      const l = mesh(new THREE.PlaneGeometry(x1 - x0, 0.025), lineMat, wl);
      l.position.set((x0 + x1) / 2, 0, z);
      l.castShadow = false;
    }
    this.wtLine = new THREE.Mesh();
    this.wtLine.add(wl);
    this.root.add(this.wtLine);

    // 시멘트 받침(관 앞쪽은 단면 홈으로 비워 둠)
    const conc = plastic(0xa6a29a, { roughness: 0.92 });
    const padPart = (x0: number, x1: number, z0: number, z1: number): void => {
      const b = mesh(new THREE.BoxGeometry(x1 - x0, PAD_H, z1 - z0), conc, this.root);
      b.position.set((x0 + x1) / 2, GY + PAD_H / 2, (z0 + z1) / 2);
    };
    padPart(-0.85, -SLOT, -0.6, FRONT);
    padPart(SLOT, 1.4, -0.6, FRONT);
    padPart(-SLOT, SLOT, -0.6, MID_BACK);
    void water;

    // 깊이 눈금 + 10 m 한계선
    const tick = paint(0xf3f1ea);
    for (let d = 2; d <= 12; d += 2) {
      const t = mesh(new THREE.BoxGeometry(d % 4 === 0 ? 0.16 : 0.11, 0.012, 0.006), tick, this.root);
      t.position.set(-SLOT - 0.08, depthY(d), FRONT + 0.003);
      t.castShadow = false;
    }
    const red = glow(0xe5484d, 0.8);
    const yl = depthY(10.33 - VALVE_ABOVE_GROUND);
    for (let i = 0; i < 14; i++) {
      const x = -1.0 + i * 0.15;
      if (Math.abs(x + 0.04) < SLOT) continue;
      const seg = mesh(new THREE.BoxGeometry(0.09, 0.014, 0.006), red, this.limitLine);
      seg.position.set(x + 0.04, yl, FRONT + 0.004);
      seg.castShadow = false;
    }
    const back = mesh(new THREE.BoxGeometry(2 * SLOT, 0.014, 0.006), red, this.limitLine);
    back.position.set(0, yl, MID_BACK + 0.004);
    this.root.add(this.limitLine);

    // 대기압 화살표(지하수면을 누름)
    this.arrowMat = glow(0x8a4fd8, 0.4);
    const arrowGeo = merge([
      new THREE.CylinderGeometry(0.026, 0.026, 0.34, 12).translate(0, 0.17 + 0.1, 0),
      new THREE.ConeGeometry(0.07, 0.11, 18).rotateX(Math.PI).translate(0, 0.055, 0)
    ]);
    for (const x of [-0.6, -1.05, 0.6, 1.05]) {
      const a = mesh(arrowGeo.clone(), this.arrowMat, this.arrows);
      a.position.set(x, 0, FRONT + 0.08);
      a.castShadow = false;
    }
    arrowGeo.dispose();
    this.root.add(this.arrows);
  }

  private buildBucket(water: THREE.Material): void {
    const g = new THREE.Group();
    g.position.set(1.0, PY, 0);
    const pr: V2[] = [[0, 0], [0.22, 0], [0.226, 0.006], [0.28, 0.5], [0.292, 0.506], [0.292, 0.52], [0.276, 0.52], [0.212, 0.012], [0, 0.012]];
    mesh(lathe(pr, 48), aluminum({ color: 0xa9b3bb, roughness: 0.5 }), g);
    const bail = mesh(new THREE.TorusGeometry(0.29, 0.008, 8, 32, Math.PI), steel(), g);
    bail.position.y = 0.5;
    bail.rotation.y = Math.PI / 2;
    bail.rotation.z = 0.0;
    this.bucketWater = mesh(new THREE.BufferGeometry(), water, g);
    this.bucketWater.castShadow = false;
    this.bucketWater.userData.noAO = true;
    this.root.add(g);
  }

  /** 주둥이 끝 아랫입술(월드 = root 좌표) */
  spoutTip(): THREE.Vector3 {
    const L = 0.56;
    const x = SPOUT_O[0] + L * Math.cos(SPOUT_TILT) + 0.02;
    const y = SPOUT_O[1] - L * Math.sin(SPOUT_TILT) - 0.05;
    return new THREE.Vector3(x, YB0 + y, 0);
  }

  setView(v: ViewMode): void {
    const cut = v === 'cut';
    for (const o of this.cutParts) o.visible = cut;
    for (const o of this.fullParts) o.visible = !cut;
    this.waterB.visible = cut;
    this.waterC.visible = cut;
    this.waterPipe.visible = cut;
  }

  setDepth(d: number): void {
    this.depth = d;
    const y = depthY(d);
    for (const m of this.soil.wet) m.scale.y = y;
    for (const m of this.soil.dry) {
      m.position.y = y;
      m.scale.y = GY - 0.14 - y;
    }
    this.wtLine.position.y = y;
    this.arrows.position.y = y + 0.005;
  }

  /** 손잡이 각 → 링크 기구 → 피스톤. 피스톤 실제 높이 s[m]를 돌려준다 */
  setHandle(phi: number): number {
    this.phi = Math.max(-PHI_MAX, Math.min(PHI_MAX, phi));
    const yR = rodPinY(this.phi);
    this.yR = yR;
    this.handle.position.set(0, yR, 0);
    this.handle.rotation.z = -this.phi;
    this.rod.position.set(0, yR, 0);
    const px = -A_LEV * Math.cos(this.phi);
    const py = yR + A_LEV * Math.sin(this.phi);
    const ang = Math.atan2(-(px - E[0]), py - E[1]);
    for (const l of this.links) l.rotation.z = ang;
    const pb = yR - ROD_L;
    this.piston.position.y = pb;
    return (pb - PISTON_MIN) / KB;
  }

  /** 손잡이 끝이 수평보다 위인 각(드래그 점 기준). 받침점에서 본 방향 */
  phiFromPoint(local: THREE.Vector3): number {
    const px = -A_LEV * Math.cos(this.phi);
    const py = this.yR + A_LEV * Math.sin(this.phi);
    return Math.atan2(local.y - YB0 - py, -(local.x - px));
  }

  /** 피스톤 아랫면 높이(몸통 기준) */
  private pistonBottom(): number {
    return this.piston.position.y;
  }

  setWater(z: number, lift: number, wB: number, wC: number, s: number, bucketL: number, bucketMax: number): void {
    const D = this.depth;
    const yWT = depthY(D);
    const seatW = YB0 + SEAT;
    const topY = z <= D ? yWT + z * K_UG : GY + ((z - D) / (lift - D)) * (seatW - GY);
    this.waterPipe.position.y = PIPE_BOTTOM;
    this.waterPipe.scale.y = Math.max(0.001, topY - PIPE_BOTTOM);
    // 피스톤 아래
    const pb = this.pistonBottom();
    const vB = A_C * s + 1.5e-5;
    const hB = Math.min(1, wB / vB) * (pb - SEAT);
    this.waterB.visible = this.cutParts[0]!.visible && hB > 0.002;
    this.waterB.position.y = SEAT;
    this.waterB.scale.y = Math.max(0.001, hB);
    const pt = pb + PISTON_H;
    const hC = (wC / A_C) * KB;
    this.waterC.visible = this.cutParts[0]!.visible && hC > 0.002;
    this.waterC.position.y = pt;
    this.waterC.scale.y = Math.max(0.001, Math.min(hC, SPOUT_IN_BOTTOM + 0.01 - pt));
    // 양동이
    const f = Math.max(0, Math.min(1, bucketL / bucketMax));
    if (Math.abs(f - this.bucketFill) > 0.004) {
      this.bucketFill = f;
      const h = 0.488 * f;
      const rTop = 0.212 + (0.276 - 0.212) * f - 0.004;
      this.bucketWater.geometry.dispose();
      this.bucketWater.geometry = f > 0.002 ? new THREE.CylinderGeometry(rTop, 0.208, h, 40).translate(0, 0.012 + h / 2, 0) : new THREE.BufferGeometry();
    }
  }

  bucketSurfaceY(): number {
    return PY + 0.012 + 0.488 * Math.max(0, this.bucketFill);
  }

  setLeather(wet: number): void {
    this.leatherMat.color.setHex(0xb08a5c).lerp(new THREE.Color(0x4a2e1c), wet);
  }

  setLimitVisible(v: boolean): void {
    this.limitLine.visible = v;
  }

  /** 밸브 열림 정도 0~1과 강조 */
  setValves(foot: number, piston: number, dt: number): void {
    const k = Math.min(1, dt * 14);
    this.footA += (foot - this.footA) * k;
    this.flapA += (piston - this.flapA) * k;
    // 아래 밸브 덮개는 피스톤과 부딪히지 않는 만큼만 열린다
    const clear = this.pistonBottom() - (SEAT + 0.02);
    const maxFoot = Math.min(THREE.MathUtils.degToRad(55), Math.asin(Math.max(0, Math.min(1, clear / 0.2))));
    this.foot.rotation.z = this.footA * maxFoot;
    this.flapR.rotation.z = -this.flapA * THREE.MathUtils.degToRad(60);
    this.flapL.rotation.z = this.flapA * THREE.MathUtils.degToRad(60);
    const open = new THREE.Color(0x22b26b);
    const shut = new THREE.Color(0xd0453a);
    this.footMat.color.copy(shut).lerp(open, this.footA);
    this.footMat.emissive.copy(this.footMat.color);
    this.footMat.emissiveIntensity = 0.25 + this.footA * 0.5;
    for (const m of this.flapMats) {
      m.color.copy(shut).lerp(open, this.flapA);
      m.emissive.copy(m.color);
      m.emissiveIntensity = 0.25 + this.flapA * 0.5;
    }
  }

  setAtmosphere(active: number): void {
    this.arrowMat.emissiveIntensity = 0.25 + active * 1.1;
    for (const a of this.arrows.children) a.scale.setScalar(0.85 + active * 0.25);
  }

  setStream(flow: number): void {
    this.stream.visible = flow > 0.03;
    this.streamMat.opacity = Math.min(0.75, 0.25 + flow * 0.6);
    this.stream.scale.z = 0.5 + Math.min(1, flow) * 0.5;
  }

  /** 마중물 붓기 애니메이션 0~1 (음수면 숨김) */
  setDipper(k: number, waterTopLocal: number): void {
    const on = k >= 0 && k <= 1;
    this.dipper.visible = on;
    const pouring = on && k > 0.25 && k < 0.85;
    this.dipStream.visible = pouring;
    if (!on) return;
    const tilt = k < 0.25 ? (k / 0.25) * 1.2 : k > 0.85 ? (1 - (k - 0.85) / 0.15) * 1.2 : 1.2;
    this.dipper.rotation.z = tilt;
    if (pouring) {
      const x = 0.12;
      const y0 = YB0 + 1.62;
      const y1 = YB0 + waterTopLocal;
      this.dipStream.position.set(x, y0, -0.05);
      this.dipStream.scale.y = Math.max(0.05, y0 - y1);
    }
  }

  // ── 입자 ──
  spawn(p: THREE.Vector3, v: THREE.Vector3, life: number, air: boolean, r = 0.016, g = 0, floor = -10): void {
    if (this.drops.length >= 140) this.drops.shift();
    this.drops.push({ p: p.clone(), v: v.clone(), life, max: life, g, r, air, floor });
  }

  /** 흐름에 맞춰 입자를 만든다 */
  emit(opts: { footWater: boolean; footAir: boolean; pistonWater: boolean; pistonAir: boolean; spill: number; pipeRise: boolean; z: number; lift: number }, dt: number): void {
    const v = new THREE.Vector3();
    const p = new THREE.Vector3();
    const rnd = (a: number): number => (Math.random() - 0.5) * 2 * a;
    const n = (rate: number): number => {
      const x = rate * dt;
      return Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
    };
    const cut = this.cutParts[0]!.visible;
    const seatW = YB0 + SEAT;
    if (cut && (opts.footWater || opts.footAir)) {
      for (let i = n(opts.footAir ? 22 : 30); i > 0; i--) {
        p.set(rnd(0.05), seatW + 0.01, -0.06 + rnd(0.03));
        v.set(rnd(0.05), 0.35 + Math.random() * 0.2, 0);
        this.spawn(p, v, 0.35, opts.footAir, opts.footAir ? 0.013 : 0.017);
      }
    }
    if (cut && opts.pipeRise) {
      // 관을 타고 오르는 물(또는 빠져나가는 공기)
      const D = this.depth;
      const top = opts.z <= D ? depthY(D) + opts.z * K_UG : GY + ((opts.z - D) / (opts.lift - D)) * (seatW - GY);
      for (let i = n(18); i > 0; i--) {
        const air = Math.random() < 0.5 && top < seatW - 0.05;
        const y = air ? top + Math.random() * (seatW - top) : depthY(D) + Math.random() * (top - depthY(D));
        p.set(rnd(0.025), y, -0.015);
        v.set(0, air ? 0.5 : 0.3, 0);
        this.spawn(p, v, 0.3, air, 0.011, 0, -10);
      }
    }
    if (cut && (opts.pistonWater || opts.pistonAir)) {
      const pt = YB0 + this.pistonBottom() + PISTON_H;
      for (let i = n(36); i > 0; i--) {
        const side = Math.random() < 0.5 ? -1 : 1;
        p.set(side * (0.14 + Math.random() * 0.04), pt + 0.01, -0.07 + rnd(0.04));
        v.set(side * 0.05, 0.4 + Math.random() * 0.2, 0);
        this.spawn(p, v, 0.4, opts.pistonAir, opts.pistonAir ? 0.014 : 0.017);
      }
    }
    if (opts.spill > 0) {
      const tip = this.spoutTip();
      for (let i = n(40 * Math.min(2, opts.spill)); i > 0; i--) {
        p.set(tip.x + rnd(0.015), tip.y + rnd(0.015), rnd(0.02));
        v.set(0.55 + Math.random() * 0.2, -0.1, rnd(0.05));
        this.spawn(p, v, 1.2, false, 0.02, -5.5, this.bucketSurfaceY());
      }
    }
  }

  updateDrops(dt: number, waterTopC: number): void {
    const list = this.drops;
    let k = 0;
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      d.life -= dt;
      d.v.y += d.g * dt;
      d.p.addScaledVector(d.v, dt);
      // 공기 방울은 물 위로 나오면 사라진다
      const dead = d.life <= 0 || d.p.y < d.floor || (d.air && d.p.y > YB0 + waterTopC && d.p.y > YB0 + 0.2 && d.p.y < YB0 + 1.4 && Math.abs(d.p.x) < BORE);
      if (dead) continue;
      list[k++] = d;
    }
    list.length = k;
    const m = this.dropMesh;
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      const fade = Math.min(1, d.life / (d.max * 0.3));
      this.dummy.position.copy(d.p);
      this.dummy.scale.setScalar(d.r * (0.5 + 0.5 * fade));
      this.dummy.updateMatrix();
      m.setMatrixAt(i, this.dummy.matrix);
      m.setColorAt(i, d.air ? this.colAir : this.colWater);
    }
    m.count = list.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  /** 피스톤 위 물의 윗면(몸통 기준) */
  waterTopC(wC: number): number {
    return this.pistonBottom() + PISTON_H + (wC / A_C) * KB;
  }

  /** 이름표 위치(root 좌표) */
  anchor(name: string): THREE.Vector3 | null {
    const pb = YB0 + this.pistonBottom();
    switch (name) {
      case 'foot':
        return new THREE.Vector3(0.06, YB0 + SEAT - 0.07, 0);
      case 'pistonValve':
        return new THREE.Vector3(0.13, pb + PISTON_H + 0.03, 0);
      case 'piston':
        return new THREE.Vector3(-0.2, pb + 0.03, 0);
      case 'spout':
        return new THREE.Vector3(0.55, YB0 + 1.0, 0);
      case 'grip': {
        const a = -this.phi;
        return new THREE.Vector3(-2.15 * Math.cos(a), YB0 + this.yR - 2.15 * Math.sin(a) + 0.06, 0);
      }
      case 'fulcrum':
        return new THREE.Vector3(-A_LEV * Math.cos(this.phi), YB0 + this.yR + A_LEV * Math.sin(this.phi) + 0.06, 0);
      case 'link': {
        const px = -A_LEV * Math.cos(this.phi);
        const py = this.yR + A_LEV * Math.sin(this.phi);
        return new THREE.Vector3((E[0] + px) / 2, YB0 + (E[1] + py) / 2, 0.095);
      }
      case 'rod':
        return new THREE.Vector3(0, YB0 + (1.29 + this.yR) / 2, 0.03);
      case 'body':
        return new THREE.Vector3(0.29, YB0 + 0.5, 0.02);
      case 'water':
        return new THREE.Vector3(1.3, depthY(this.depth), FRONT);
      case 'atm':
        return new THREE.Vector3(-0.82, depthY(this.depth) + 0.38, FRONT + 0.08);
      case 'limit':
        return new THREE.Vector3(1.05, depthY(10.33 - VALVE_ABOVE_GROUND), FRONT);
      case 'bucket':
        return new THREE.Vector3(1.0, PY + 0.52, 0.28);
      case 'pipe':
        return new THREE.Vector3(0, GY - 0.3, 0);
      default:
        return null;
    }
  }

  /** 깊이 눈금 위치(root 좌표) */
  tickPos(d: number): THREE.Vector3 {
    return new THREE.Vector3(-SLOT - 0.18, depthY(d), FRONT);
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
    this.dropMesh.dispose();
  }
}

function rodProfileLocal(r: number, y0: number, y1: number): V2[] {
  return [[0, y0], [r, y0], [r, y1], [0, y1]];
}
