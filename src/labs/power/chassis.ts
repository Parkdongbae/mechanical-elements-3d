// FR 섀시 투시 모델(11-C): 세로배치 4기통 엔진 컷어웨이 → 플라이휠·클러치 → 5단 변속기(상시 물림, 부축)
// → 프로펠러 샤프트 → 뒤 디퍼렌셜(구동 피니언·링 기어·차동 피니언·사이드 기어) → 차축 → 바퀴 4개 + 도로.
// 바퀴·차체·프레임·프로펠러 샤프트·차축은 drivetrainParts.ts 빌더(구동방식 미션과 같은 모습)를 쓴다.
//
// 좌표: drivetrainParts의 root 좌표 그대로(앞 = -Z, 오른쪽 = +X, 바퀴 중심 y = 0.12).
// 회전 부호(모든 축을 +Z/+X 기준 각도로): 엔진은 앞에서 볼 때 시계 방향 = +Z 회전.
// 부축은 반대(-), 출력축은 다시 +, 링 기어는 왼쪽(-X)에 있어 차축이 -X 회전 = 차가 앞(-Z)으로 구른다.

import * as THREE from 'three';
import { aluminum, castIron, darkSteel, ghost, glow, paint, plastic, rubber, steel } from '../../models/materials';
import { buildBevelGearMesh, buildSpurGearMesh } from '../../models/factory';
import { involuteOutline } from '../../models/parts/gears';
import { circlePts, extrude, lathe, loft, merge, mesh, rodProfile, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import {
  CAR,
  barBetween,
  buildBeamAxle,
  buildCaliper,
  buildCarShell,
  buildLadderFrame,
  buildLiveAxleShaft,
  buildPropShaftBetween,
  buildWheel,
  coilSpring,
  cylX,
  latheX,
  latheZ,
  rbox,
  tubeThrough
} from '../../machines/drivetrainParts';
import { CONST_MESH, DIFF, FINAL, GEARS, gearDef, type PartKey } from './data';

/** 엔진·변속기 축 높이 */
export const AY = 0.2;
/** 입력축(출력축)–부축 중심 거리 */
const CD = 0.085;
const RY = CAR.axleY;
const RZ = CAR.rearZ;
/** 링 기어 피치 반지름 / 구동 피니언 피치 반지름 */
const RR = 0.095;
const RP = (RR * FINAL.pinion) / FINAL.ring;
/** 차동: 사이드 기어 / 차동 피니언 피치 반지름 */
const RS = 0.032;
const RSP = (RS * DIFF.spider) / DIFF.side;

const ENG = {
  throw: 0.03,
  rod: 0.1,
  cz: [-0.94, -0.84, -0.74, -0.64],
  /** 크랭크 핀 위상 (1·4번 0°, 2·3번 180°) */
  phi: [0, Math.PI, Math.PI, 0]
} as const;

/** 변속기 기어 위치(z) — 상시 물림 + 1·2·3·5단. 4단은 직결 */
const TZ: Record<'cm' | 1 | 2 | 3 | 5, number> = { cm: -0.4, 3: -0.335, 2: -0.275, 1: -0.215, 5: -0.15 };
const GEAR_W = 0.024;
/** 싱크로 슬리브: 중립 위치, 물릴 단과 밀리는 방향 */
const SLEEVES = [
  { z: -0.3675, w: 0.016, toward: { 3: 1, 4: -1 } as Record<number, number> },
  { z: -0.245, w: 0.014, toward: { 1: 1, 2: -1 } as Record<number, number> },
  { z: -0.19, w: 0.014, toward: { 5: 1 } as Record<number, number> }
];
const PROP_A = new THREE.Vector3(0, AY, 0.005);
const PROP_B = new THREE.Vector3(0, RY, RZ - RR - 0.1);

export interface Pose {
  crank: number;
  input: number;
  output: number;
  /** 링 기어·차동 케이스(+X 기준) */
  ring: number;
  left: number;
  right: number;
  /** 차동 피니언 자전(케이스 기준) */
  spider: number;
  front: number;
  /** 도로 이동량(root 단위) */
  road: number;
  /** 0 = 클러치 연결, 1 = 완전히 끊김 */
  clutch: number;
  /** 실린더별 연소 빛 0~1 */
  fire: number[];
}

export interface Track {
  pts: THREE.Vector3[];
  /** 각 구간(pts[i]→pts[i+1])이 속한 투어 단계(1~7) */
  stage: number[];
}

const spur = (n: number, rp: number, depth: number, color: number): THREE.Mesh => {
  const m = (2 * rp) / n;
  return buildSpurGearMesh(n, rp + m, 2.25 * m, depth, color);
};

const bevel = (n: number, rp: number, depth: number, shrink: number, color?: number): THREE.Mesh => {
  const m = (2 * rp) / n;
  return buildBevelGearMesh(n, rp + m, 2.25 * m, depth, shrink, color);
};

/** 안쪽이 크게 뚫린 링 기어(이가 +Z 면 쪽으로 좁아지는 베벨) — 축 Z, 두께 depth */
function bevelRingGeo(n: number, rp: number, bore: number, depth: number, face: number): THREE.BufferGeometry {
  const m = (2 * rp) / n;
  const outline = involuteOutline(n, rp + m, rp - 1.25 * m);
  const z0 = -depth / 2;
  const z1 = depth / 2;
  return loft(outline, [circlePts(bore, 64).reverse()], [
    { z: z0, s: (rp + m - 0.002) / (rp + m), hs: (bore + 0.002) / bore },
    { z: z0 + 0.002, s: 1, hs: 1 },
    { z: z1 - 0.004, s: 1 - (1 - face) * 0.6, hs: 1 },
    { z: z1, s: face, hs: (bore + 0.002) / bore }
  ]);
}

function pivotAt(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const noShadow = (o: THREE.Object3D): void => {
  o.traverse((c) => {
    c.castShadow = false;
    c.receiveShadow = false;
    c.userData.noAO = true;
  });
};

export class PowerChassis {
  /** 씬에 넣는 그룹(배율 적용) */
  readonly car = new THREE.Group();
  /** drivetrainParts 좌표계 루트 */
  readonly root = new THREE.Group();
  /** 단계별 강조 대상 */
  readonly parts: Record<PartKey, THREE.Object3D[]> = { engine: [], clutch: [], trans: [], prop: [], diff: [], axle: [], wheel: [] };
  /** 맥락(프레임·차체·앞 차축·도로) — 부품을 볼 때 흐리게 */
  readonly context: THREE.Object3D[] = [];
  /** 변속 단별 기어 쌍(강조용) */
  readonly gearMeshes = new Map<number, THREE.Object3D[]>();
  /** 7단계의 힘 화살표 */
  readonly forceArrows = new THREE.Group();

  private crank = new THREE.Group();
  private pistons: THREE.Group[] = [];
  private rods: THREE.Group[] = [];
  private flashes: THREE.Mesh[] = [];
  private flywheel = new THREE.Group();
  private pressure = new THREE.Group();
  private disc = new THREE.Group();
  private input = new THREE.Group();
  private counter = new THREE.Group();
  private mainShaft = new THREE.Group();
  private mainGears: { pivot: THREE.Group; ratio: number }[] = [];
  private sleeves: THREE.Group[] = [];
  private lever = new THREE.Group();
  private prop: THREE.Object3D | null = null;
  private pinion = new THREE.Group();
  private carrier = new THREE.Group();
  private spiders: THREE.Group[] = [];
  private sideL = new THREE.Group();
  private sideR = new THREE.Group();
  private axleL: THREE.Group | null = null;
  private axleR: THREE.Group | null = null;
  private wheelRL = new THREE.Group();
  private wheelRR = new THREE.Group();
  private wheelFL = new THREE.Group();
  private wheelFR = new THREE.Group();
  private dashes: THREE.InstancedMesh | null = null;
  private gear = 3;
  private sleeveZ = SLEEVES.map((s) => s.z);
  private leverRot = new THREE.Vector2();

  constructor(scale: number) {
    this.car.scale.setScalar(scale);
    this.root.position.y = CAR.rootY;
    this.car.add(this.root);
    this.buildContext();
    this.buildEngine();
    this.buildClutch();
    this.buildTransmission();
    this.buildProp();
    this.buildDiff();
    this.buildAxles();
    this.buildWheels();
    this.buildArrows();
    this.car.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !o.userData.noAO) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }

  // ───────────────────────── 맥락 ─────────────────────────

  private buildContext(): void {
    const frame = buildLadderFrame();
    const shell = buildCarShell();
    const beam = buildBeamAxle();
    beam.position.set(0, RY, CAR.frontZ);
    this.root.add(frame, shell, beam);

    // 변속기 받침 크로스멤버 + 마운트, 뒤 차축 스프링
    const sup = new THREE.Group();
    const supMat = paint(0x30353c, { roughness: 0.55, metalness: 0.3 });
    const geos: THREE.BufferGeometry[] = [
      tubeThrough(
        [
          new THREE.Vector3(-CAR.railX, CAR.railY - 0.02, -0.05),
          new THREE.Vector3(-0.3, 0.14, -0.05),
          new THREE.Vector3(0.3, 0.14, -0.05),
          new THREE.Vector3(CAR.railX, CAR.railY - 0.02, -0.05)
        ],
        0.018,
        40,
        10
      )
    ];
    mesh(merge(geos), supMat, sup);
    const mount = new THREE.Mesh(rbox(0.05, 0.03, 0.04, 0.008), rubber());
    mount.position.set(0, 0.152, -0.05);
    sup.add(mount);
    const springMat = paint(0xb8452f, { roughness: 0.4 });
    const padMat = darkSteel({ color: 0x3d434a });
    const springs: THREE.BufferGeometry[] = [];
    const pads: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const sp = coilSpring(0.03, CAR.railY - 0.036 - (RY + 0.03), 4, 0.006);
      sp.translate(s * 0.45, RY + 0.03, RZ);
      springs.push(sp);
      const pad = rbox(0.07, 0.012, 0.07, 0.004);
      pad.translate(s * 0.45, RY + 0.027, RZ);
      pads.push(pad);
    }
    mesh(merge(springs), springMat, sup);
    mesh(merge(pads), padMat, sup);
    this.root.add(sup);

    // 도로(차가 달리는 느낌 — 차선이 뒤로 흐른다)
    const road = new THREE.Group();
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 14), plastic(0x5a616b, { roughness: 0.95 }));
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.y = CAR.groundY + 0.006;
    asphalt.receiveShadow = true;
    road.add(asphalt);
    const dashGeo = new THREE.BoxGeometry(0.05, 0.002, 0.34);
    const dashes = new THREE.InstancedMesh(dashGeo, paint(0xeef1f4, { roughness: 0.6 }), 36);
    dashes.receiveShadow = true;
    road.add(dashes);
    this.dashes = dashes;
    this.root.add(road);
    this.context.push(frame, shell, beam, sup, road);
  }

  // ───────────────────────── 엔진 ─────────────────────────

  private buildEngine(): void {
    const eng = new THREE.Group();
    eng.name = 'engine';
    this.root.add(eng);
    const r = ENG.throw;

    // 크랭크축(메인 저널 + 핀 + 웹·평형추 + 앞 풀리 + 뒤 플랜지)
    this.crank.position.set(0, AY, 0);
    eng.add(this.crank);
    const cg: THREE.BufferGeometry[] = [latheZ(rodProfile(0.014, -1.0, -0.575, 0.002, 0.002), 24)];
    ENG.cz.forEach((cz, i) => {
      const up = ENG.phi[i] === 0 ? 1 : -1;
      cg.push(latheZ(rodProfile(0.011, cz - 0.017, cz + 0.017), 20).translate(0, up * r, 0));
      for (const dz of [-0.023, 0.023]) {
        const web = extrude(stadiumShape(0, 0, 0, r, 0.019), 0.012, 0.002, 16);
        const cw = new THREE.Shape();
        cw.absarc(0, 0, 0.042, -Math.PI / 2 - 1.15, -Math.PI / 2 + 1.15, false);
        cw.closePath();
        const cwg = extrude(cw, 0.012, 0.002, 20);
        for (const g of [web, cwg]) {
          if (up < 0) g.rotateZ(Math.PI);
          g.translate(0, 0, cz + dz);
          cg.push(g);
        }
      }
    });
    cg.push(latheZ([[0, -1.035], [0.036, -1.035], [0.04, -1.03], [0.04, -1.024], [0.033, -1.02], [0.033, -1.014], [0.04, -1.01], [0.04, -1.004], [0.03, -1.0], [0, -1.0]], 40));
    cg.push(latheZ(rodProfile(0.032, -0.585, -0.568, 0.002, 0.001), 32));
    mesh(merge(cg), steel({ roughness: 0.28 }), this.crank);

    // 피스톤·커넥팅 로드
    const pistonProf: V2[] = [[0, -0.015], [0.031, -0.015], [0.031, 0.011], [0.0318, 0.011], [0.0318, 0.014], [0.031, 0.014], [0.031, 0.017], [0.0318, 0.017], [0.0318, 0.021], [0.03, 0.025], [0, 0.026]];
    const pistonMat = aluminum({ roughness: 0.35 });
    const rodMat = steel({ color: 0x8f98a2, roughness: 0.4 });
    const pistonGeo = lathe(pistonProf, 40);
    const rodGeo = merge([
      latheZ(rodProfile(0.017, -0.008, 0.008, 0.002, 0.002), 24),
      rbox(0.012, ENG.rod - 0.024, 0.01, 0.003).translate(0, ENG.rod / 2, 0),
      latheZ(rodProfile(0.01, -0.007, 0.007, 0.0015, 0.0015), 20).translate(0, ENG.rod, 0)
    ]);
    for (const cz of ENG.cz) {
      const p = pivotAt(eng, 0, 0, cz);
      p.add(new THREE.Mesh(pistonGeo.clone(), pistonMat));
      this.pistons.push(p);
      const rd = pivotAt(eng, 0, 0, cz);
      rd.add(new THREE.Mesh(rodGeo.clone(), rodMat));
      this.rods.push(rd);
      // 연소 빛(점화 직후 잠깐)
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 10), glow(0xff8a2a, 2.2));
      const fm = f.material as THREE.MeshStandardMaterial;
      fm.transparent = true;
      fm.opacity = 0;
      fm.depthWrite = false;
      f.scale.set(1, 0.3, 1);
      f.position.set(0, AY + r + ENG.rod + 0.033, cz);
      noShadow(f);
      eng.add(f);
      this.flashes.push(f);
    }
    pistonGeo.dispose();
    rodGeo.dispose();

    // 블록·헤드(반투명) + 실린더 라이너, 헤드 커버·오일 팬(불투명), 점화 플러그, 엔진 마운트
    const blockMat = ghost(0x8ea2b8, 0.2);
    blockMat.side = THREE.DoubleSide;
    const block = merge([
      rbox(0.1, 0.13, 0.42, 0.02).translate(0, 0.3, -0.79),
      rbox(0.15, 0.085, 0.42, 0.025).translate(0, 0.1925, -0.79),
      rbox(0.11, 0.045, 0.43, 0.015).translate(0, 0.3875, -0.79)
    ]);
    const blockMesh = new THREE.Mesh(block, blockMat);
    blockMesh.renderOrder = 1;
    eng.add(blockMesh);
    const linerMat = ghost(0xc3d0de, 0.22);
    linerMat.side = THREE.DoubleSide;
    const liners = merge(ENG.cz.map((cz) => lathe(tubeProfile(0.033, 0.036, 0.235, 0.365), 40).translate(0, 0, cz)));
    const linerMesh = new THREE.Mesh(liners, linerMat);
    linerMesh.renderOrder = 1;
    eng.add(linerMesh);
    mesh(rbox(0.09, 0.03, 0.4, 0.012).translate(0, 0.425, -0.79), paint(0x9e2b25, { roughness: 0.35 }), eng);
    mesh(rbox(0.13, 0.03, 0.38, 0.01).translate(0, 0.135, -0.79), castIron({ color: 0x4a5058 }), eng);
    const plugs: THREE.BufferGeometry[] = [];
    const plugTops: THREE.BufferGeometry[] = [];
    for (const cz of ENG.cz) {
      plugs.push(lathe(rodProfile(0.0065, 0.438, 0.462, 0, 0.002), 16).translate(0, 0, cz));
      plugTops.push(lathe(rodProfile(0.009, 0.456, 0.474, 0.002, 0.003), 16).translate(0, 0, cz));
    }
    mesh(merge(plugs), plastic(0xf1efe8, { roughness: 0.3 }), eng);
    mesh(merge(plugTops), rubber({ roughness: 0.6 }), eng);
    const mounts: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      mounts.push(barBetween(new THREE.Vector3(s * 0.07, 0.2, -0.82), new THREE.Vector3(s * (CAR.railX - 0.026), CAR.railY - 0.01, -0.82), 0.03, 0.03, 0.006));
    }
    // 엔진 마운트는 프레임 쪽 맥락으로(엔진을 볼 때 강조되면 엔진 일부처럼 보인다)
    const mountMesh = mesh(merge(mounts), darkSteel({ color: 0x40464e }), this.root);
    this.context.unshift(mountMesh);
    this.parts.engine.push(eng);
  }

  // ───────────────────────── 플라이휠·클러치 ─────────────────────────

  private buildClutch(): void {
    const g = new THREE.Group();
    g.name = 'clutch';
    this.root.add(g);
    this.flywheel.position.set(0, AY, 0);
    g.add(this.flywheel);
    const fw = spur(96, 0.106, 0.014, 0x9aa3ad);
    fw.position.z = -0.562;
    this.flywheel.add(fw);
    // 클러치 커버 + 다이어프램 스프링(플라이휠과 함께 돈다)
    mesh(latheZ([[0.094, -0.555], [0.098, -0.553], [0.098, -0.533], [0.07, -0.52], [0.03, -0.516], [0.03, -0.511], [0.072, -0.515], [0.102, -0.53], [0.102, -0.555]], 56), darkSteel({ color: 0x59616b }), this.flywheel);
    // 압력판(끊으면 뒤로 물러남)
    this.flywheel.add(this.pressure);
    mesh(latheZ(tubeProfile(0.05, 0.088, -0.547, -0.537, 0.0015), 56), steel({ color: 0xb4bcc5, roughness: 0.3 }), this.pressure);
    // 클러치판(입력축과 함께 돈다): 마찰재 고리 + 허브
    this.disc.position.set(0, AY, 0);
    g.add(this.disc);
    mesh(latheZ(tubeProfile(0.045, 0.085, -0.555, -0.547, 0.001), 56), plastic(0x7a5a3c, { roughness: 0.9 }), this.disc);
    mesh(latheZ(tubeProfile(0.012, 0.046, -0.5525, -0.5495, 0), 40), steel({ color: 0xa5adb6 }), this.disc);
    mesh(latheZ(tubeProfile(0.011, 0.02, -0.554, -0.538, 0.001), 28), darkSteel(), this.disc);
    // 벨 하우징(반투명)
    const bellMat = ghost(0x9fb4c8, 0.18);
    bellMat.side = THREE.DoubleSide;
    const bell = new THREE.Mesh(latheZ([[0.12, -0.578], [0.126, -0.578], [0.084, -0.44], [0.078, -0.44], [0.12, -0.578]], 56), bellMat);
    bell.translateY(AY);
    bell.renderOrder = 1;
    g.add(bell);
    this.parts.clutch.push(g);
  }

  // ───────────────────────── 변속기 ─────────────────────────

  private buildTransmission(): void {
    const g = new THREE.Group();
    g.name = 'trans';
    this.root.add(g);
    const gearColor = 0xc6ccd3;
    const rp = (a: number, b: number): number => (CD * a) / (a + b);

    // 입력축 + 상시 물림 기어(20T)
    this.input.position.set(0, AY, 0);
    g.add(this.input);
    mesh(latheZ(rodProfile(0.011, -0.56, -0.39, 0.002, 0.002), 20), steel(), this.input);
    const inGear = spur(CONST_MESH.input, rp(CONST_MESH.input, CONST_MESH.counter), GEAR_W, gearColor);
    inGear.position.z = TZ.cm;
    this.input.add(inGear);

    // 부축: 상시 물림 30T + 각 단 기어 (모두 한 덩어리로 돈다)
    this.counter.position.set(0, AY - CD, 0);
    g.add(this.counter);
    mesh(latheZ(rodProfile(0.01, -0.43, -0.13, 0.002, 0.002), 20), steel(), this.counter);
    const cmCounter = spur(CONST_MESH.counter, rp(CONST_MESH.counter, CONST_MESH.input), GEAR_W, gearColor);
    cmCounter.position.z = TZ.cm;
    this.counter.add(cmCounter);

    // 출력축(주축) + 출력 플랜지 + 싱크로 슬리브
    this.mainShaft.position.set(0, AY, 0);
    g.add(this.mainShaft);
    mesh(latheZ(rodProfile(0.012, -0.386, 0.0, 0.002, 0), 24), steel(), this.mainShaft);
    mesh(latheZ(rodProfile(0.03, -0.004, 0.005, 0.001, 0.001), 32), steel({ color: 0xaab3bd }), this.mainShaft);
    for (const s of SLEEVES) {
      const sl = pivotAt(this.mainShaft, 0, 0, s.z);
      mesh(latheZ([[0.015, -s.w / 2], [0.029, -s.w / 2], [0.03, -s.w / 2 + 0.002], [0.03, -0.002], [0.026, -0.0015], [0.026, 0.0015], [0.03, 0.002], [0.03, s.w / 2 - 0.002], [0.029, s.w / 2], [0.015, s.w / 2], [0.015, -s.w / 2]], 32), steel({ color: 0x8fa0b4, roughness: 0.3 }), sl);
      this.sleeves.push(sl);
    }
    this.gearMeshes.set(4, [this.sleeves[0]!, inGear]);

    for (const def of GEARS) {
      if (!def.pair) continue;
      const z = TZ[def.n as 1 | 2 | 3 | 5];
      const c = spur(def.pair.counter, rp(def.pair.counter, def.pair.main), GEAR_W, gearColor);
      c.position.z = z;
      this.counter.add(c);
      // 출력축 기어는 축 위에서 헛돈다(부축이 돌림). 슬리브가 물린 단만 축과 함께 돈다.
      const pivot = pivotAt(g, 0, AY, z);
      const m = spur(def.pair.main, rp(def.pair.main, def.pair.counter), GEAR_W, gearColor);
      pivot.add(m);
      this.mainGears.push({ pivot, ratio: (CONST_MESH.counter / CONST_MESH.input) * (def.pair.main / def.pair.counter) });
      const sleeve = this.sleeves[SLEEVES.findIndex((sv) => sv.toward[def.n] !== undefined)];
      this.gearMeshes.set(def.n, sleeve ? [c, m, sleeve] : [c, m]);
    }

    // 케이스·연장 하우징(반투명)
    const caseMat = ghost(0x9fb4c8, 0.16);
    caseMat.side = THREE.DoubleSide;
    const box = merge([rbox(0.17, 0.225, 0.32, 0.03, 3).translate(0, 0.1625, -0.28), latheZ([[0.034, -0.12], [0.028, -0.01], [0.022, -0.005], [0, -0.005], [0, -0.12]], 40).translate(0, AY, 0)]);
    const caseMesh = new THREE.Mesh(box, caseMat);
    caseMesh.renderOrder = 1;
    g.add(caseMesh);

    // 변속 레버(H 패턴에 따라 기울어짐)
    this.lever.position.set(0, 0.275, -0.25);
    g.add(this.lever);
    mesh(latheZ(rodProfile(0.024, -0.008, 0.008, 0.002, 0.002), 24).rotateX(Math.PI / 2), rubber(), this.lever);
    mesh(lathe(rodProfile(0.006, 0, 0.21, 0, 0), 12), chromeLike(), this.lever);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 20, 14), plastic(0x1f2328, { roughness: 0.4 }));
    knob.position.y = 0.215;
    this.lever.add(knob);
    this.parts.trans.push(g);
  }

  // ───────────────────────── 프로펠러 샤프트 ─────────────────────────

  private buildProp(): void {
    const holder = buildPropShaftBetween(PROP_A, PROP_B);
    holder.name = 'prop';
    this.root.add(holder);
    this.prop = holder.children[0] ?? null;
    this.parts.prop.push(holder);
  }

  // ───────────────────────── 종감속·차동 ─────────────────────────

  private buildDiff(): void {
    const g = new THREE.Group();
    g.name = 'diff';
    g.position.set(0, RY, RZ);
    this.root.add(g);

    // 구동 피니언(축 Z) + 피니언 축 + 컴패니언 플랜지
    g.add(this.pinion);
    const pin = bevel(FINAL.pinion, RP, 0.026, 0.62);
    pin.position.z = -RR - 0.004 + 0.013;
    this.pinion.add(pin);
    mesh(latheZ(rodProfile(0.012, PROP_B.z - RZ, -RR - 0.004, 0.001, 0), 24), steel(), this.pinion);
    mesh(latheZ(rodProfile(0.04, PROP_B.z - RZ - 0.004, PROP_B.z - RZ + 0.004, 0.001, 0.001), 32), steel({ color: 0xaab3bd }), this.pinion);

    // 링 기어 + 차동 케이스(케이지) — 차축 방향(X)으로 돈다
    g.add(this.carrier);
    const ringGeo = bevelRingGeo(FINAL.ring, RR, 0.058, 0.02, 0.86);
    ringGeo.rotateY(Math.PI / 2);
    ringGeo.translate(-RP - 0.006, 0, 0);
    mesh(ringGeo, brassLike(), this.carrier);
    const cageMat = steel({ color: 0x9aa4ae, roughness: 0.35 });
    const cage: THREE.BufferGeometry[] = [
      cylX(0.021, -0.078, -0.045, 28, 0.002),
      latheX(tubeProfile(0.02, 0.064, -0.047, -0.037, 0.002), 48),
      cylX(0.021, 0.045, 0.078, 28, 0.002),
      latheX(tubeProfile(0.02, 0.046, 0.037, 0.047, 0.002), 40),
      rbox(0.086, 0.012, 0.016, 0.004).translate(0, 0.05, 0),
      rbox(0.086, 0.012, 0.016, 0.004).translate(0, -0.05, 0),
      lathe(rodProfile(0.0055, -0.056, 0.056, 0.001, 0.001), 16)
    ];
    mesh(merge(cage), cageMat, this.carrier);
    for (const s of [1, -1]) {
      const p = pivotAt(this.carrier, 0, s * (RS + 0.004 - 0.007), 0);
      const sp = bevel(DIFF.spider, RSP, 0.014, 0.65, 0xc9d2dc);
      sp.geometry.rotateX(s * (Math.PI / 2));
      p.add(sp);
      this.spiders.push(p);
    }
    // 사이드 기어(차축과 함께 돈다)
    for (const [side, pivot] of [[-1, this.sideL], [1, this.sideR]] as const) {
      g.add(pivot);
      const sg = bevel(DIFF.side, RS, 0.014, 0.7, 0xc9d2dc);
      sg.geometry.rotateY(side < 0 ? Math.PI / 2 : -Math.PI / 2);
      sg.position.x = side * (RSP + 0.004 - 0.007);
      pivot.add(sg);
    }

    // 디퍼렌셜 하우징(반투명 바조 + 피니언 노즈)
    const houseMat = ghost(0x9fb4c8, 0.15);
    houseMat.side = THREE.DoubleSide;
    const house = merge([
      latheX([[0, -0.088], [0.06, -0.085], [0.104, -0.062], [0.118, -0.035], [0.118, -0.012], [0.106, 0.03], [0.078, 0.066], [0.035, 0.086], [0, 0.088]], 56),
      latheZ([[0.03, PROP_B.z - RZ + 0.008], [0.05, -0.105], [0, -0.105], [0, PROP_B.z - RZ + 0.008]], 40)
    ]);
    const houseMesh = new THREE.Mesh(house, houseMat);
    houseMesh.renderOrder = 1;
    g.add(houseMesh);
    this.parts.diff.push(g);
  }

  // ───────────────────────── 차축 ─────────────────────────

  private buildAxles(): void {
    const g = new THREE.Group();
    g.name = 'axle';
    this.root.add(g);
    const len = CAR.hubInnerX - 0.03;
    this.axleL = pivotAt(g, -0.03, RY, RZ);
    this.axleL.add(buildLiveAxleShaft(len));
    this.axleR = pivotAt(g, 0.03, RY, RZ);
    this.axleR.add(buildLiveAxleShaft(len));
    const tubeMat = ghost(0x9fb4c8, 0.2);
    tubeMat.side = THREE.DoubleSide;
    const tubes = new THREE.Mesh(merge([latheX(tubeProfile(0.027, 0.031, 0.085, 0.62), 32), latheX(tubeProfile(0.027, 0.031, -0.62, -0.085), 32)]).translate(0, RY, RZ), tubeMat);
    tubes.renderOrder = 1;
    g.add(tubes);
    const ends = merge([latheX(tubeProfile(0.02, 0.046, 0.618, 0.64, 0.002), 32), latheX(tubeProfile(0.02, 0.046, -0.64, -0.618, 0.002), 32)]).translate(0, RY, RZ);
    mesh(ends, darkSteel({ color: 0x4a525b }), g);
    this.parts.axle.push(g);
  }

  // ───────────────────────── 바퀴 ─────────────────────────

  private buildWheels(): void {
    const g = new THREE.Group();
    g.name = 'wheels';
    this.root.add(g);
    const place = (pivot: THREE.Group, side: 1 | -1, z: number, marker: boolean): void => {
      pivot.position.set(side * CAR.halfTrack, RY, z);
      pivot.add(buildWheel(side, { marker }));
      g.add(pivot);
      const cal = buildCaliper(side);
      cal.position.copy(pivot.position);
      g.add(cal);
    };
    place(this.wheelRL, -1, RZ, true);
    place(this.wheelRR, 1, RZ, true);
    place(this.wheelFL, -1, CAR.frontZ, true);
    place(this.wheelFR, 1, CAR.frontZ, true);
    this.parts.wheel.push(g);
  }

  /** 7단계: 타이어가 노면을 미는 힘(뒤쪽) ↔ 노면이 차를 미는 힘(앞쪽) */
  private buildArrows(): void {
    const mk = (color: number, from: THREE.Vector3, dir: number): THREE.Group => {
      const a = new THREE.Group();
      const m = glow(color, 0.9);
      m.toneMapped = false;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 12), m);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = (dir * 0.11);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 16), m);
      head.rotation.x = dir * (Math.PI / 2);
      head.position.z = dir * 0.25;
      a.add(shaft, head);
      a.position.copy(from);
      return a;
    };
    for (const s of [-1, 1]) {
      const x = s * (CAR.halfTrack + 0.13);
      this.forceArrows.add(mk(0xff8a2a, new THREE.Vector3(x, CAR.groundY + 0.03, RZ), 1));
      this.forceArrows.add(mk(0x2fbf71, new THREE.Vector3(x, CAR.groundY + 0.1, RZ), -1));
    }
    noShadow(this.forceArrows);
    this.forceArrows.visible = false;
    this.root.add(this.forceArrows);
  }

  // ───────────────────────── 상태 ─────────────────────────

  setGear(n: number): void {
    this.gear = n;
    const lev: Record<number, [number, number]> = { 1: [-1, 1], 2: [1, 1], 3: [-1, 0], 4: [1, 0], 5: [-1, -1] };
    const [fb, lr] = lev[n] ?? [0, 0];
    this.leverRot.set(fb * 0.2, lr * 0.16);
  }

  /** 매 프레임: 회전 각도 반영 */
  setPose(p: Pose, dt: number): void {
    const r = ENG.throw;
    const L = ENG.rod;
    this.crank.rotation.z = p.crank;
    for (let i = 0; i < 4; i++) {
      const a = p.crank + ENG.phi[i]!;
      const px = -r * Math.sin(a);
      const py = r * Math.cos(a);
      const yp = py + Math.sqrt(L * L - px * px);
      this.pistons[i]!.position.y = AY + yp;
      const rod = this.rods[i]!;
      rod.position.set(px, AY + py, ENG.cz[i]!);
      rod.rotation.z = -Math.atan2(-px, yp - py);
      const fm = this.flashes[i]!.material as THREE.MeshStandardMaterial;
      const f = p.fire[i] ?? 0;
      fm.opacity = f * 0.9;
      this.flashes[i]!.visible = f > 0.01;
    }
    this.flywheel.rotation.z = p.crank;
    this.pressure.position.z = p.clutch * 0.014;
    this.disc.rotation.z = p.input;
    this.disc.position.z = p.clutch * 0.007;
    this.input.rotation.z = p.input;
    this.counter.rotation.z = (-p.input * CONST_MESH.input) / CONST_MESH.counter;
    this.mainShaft.rotation.z = p.output;
    for (const mg of this.mainGears) mg.pivot.rotation.z = p.input / mg.ratio;
    const k = Math.min(1, dt * 8);
    SLEEVES.forEach((s, i) => {
      const target = s.z + (s.toward[this.gear] ?? 0) * 0.007;
      this.sleeveZ[i] = this.sleeveZ[i]! + (target - this.sleeveZ[i]!) * k;
      this.sleeves[i]!.position.z = this.sleeveZ[i]!;
    });
    this.lever.rotation.x += (this.leverRot.x - this.lever.rotation.x) * k;
    this.lever.rotation.z += (this.leverRot.y - this.lever.rotation.z) * k;
    if (this.prop) this.prop.rotation.x = p.output;
    this.pinion.rotation.z = p.output;
    this.carrier.rotation.x = p.ring;
    this.spiders[0]!.rotation.y = p.spider;
    this.spiders[1]!.rotation.y = -p.spider;
    this.sideL.rotation.x = p.left;
    this.sideR.rotation.x = p.right;
    this.axleL?.rotation.set(p.left, Math.PI, 0);
    this.axleR?.rotation.set(p.right, 0, 0);
    this.wheelRL.rotation.x = p.left;
    this.wheelRR.rotation.x = p.right;
    this.wheelFL.rotation.x = p.front;
    this.wheelFR.rotation.x = p.front;
    if (this.dashes) {
      const m = new THREE.Matrix4();
      const period = 0.8;
      const off = ((p.road % period) + period) % period;
      let i = 0;
      for (const x of [-1.42, 1.42]) {
        for (let j = 0; j < 18; j++) {
          m.makeTranslation(x, CAR.groundY + 0.008, -7 + j * period + off);
          this.dashes.setMatrixAt(i++, m);
        }
      }
      this.dashes.instanceMatrix.needsUpdate = true;
    }
  }

  // ───────────────────────── 동력 흐름 경로 ─────────────────────────

  /** 엔진 → 바퀴 경로(1~5단계 본선 + 6~7단계 좌우 갈래). 변속 단에 따라 변속기 안 경로가 바뀐다 */
  tracks(gear: number): Track[] {
    const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    const main: Track = { pts: [], stage: [] };
    const push = (stage: number, ...pts: THREE.Vector3[]): void => {
      for (const p of pts) {
        if (main.pts.length > 0) main.stage.push(stage);
        main.pts.push(p);
      }
    };
    const top = AY + ENG.throw + ENG.rod + 0.02;
    push(1, V(0, top, ENG.cz[0]!), V(0, AY, ENG.cz[0]!), V(0, AY, -0.585));
    push(2, V(0, AY, -0.547));
    const def = gearDef(gear);
    if (def.pair) {
      const z = TZ[def.n as 1 | 2 | 3 | 5];
      push(3, V(0, AY, TZ.cm), V(0, AY - CD, TZ.cm), V(0, AY - CD, z), V(0, AY, z), V(0, AY, PROP_A.z));
    } else {
      push(3, V(0, AY, PROP_A.z));
    }
    push(4, PROP_B.clone());
    push(5, V(0, RY, RZ - RR - 0.004), V(-RP, RY, RZ - RR + 0.004), V(-RP, RY, RZ), V(0, RY, RZ));
    const out: Track[] = [main];
    for (const s of [-1, 1]) {
      const b: Track = { pts: [V(0, RY, RZ), V(s * 0.03, RY, RZ), V(s * CAR.hubInnerX, RY, RZ), V(s * CAR.halfTrack, RY, RZ), V(s * CAR.halfTrack, CAR.groundY + 0.01, RZ)], stage: [6, 6, 7, 7] };
      out.push(b);
    }
    return out;
  }

  /** 라벨 기준점(root 좌표) */
  anchor(name: string): THREE.Vector3 | null {
    const sel = gearDef(this.gear);
    const z = sel.pair ? TZ[sel.n as 1 | 2 | 3 | 5] : SLEEVES[0]!.z;
    const A: Record<string, [number, number, number]> = {
      engine: [0, 0.48, -0.8],
      clutch: [0, 0.33, -0.55],
      trans: [0, 0.3, -0.3],
      prop: [0, 0.18, 0.24],
      diff: [0, 0.27, RZ],
      axle: [0.4, 0.16, RZ],
      wheel: [CAR.halfTrack, 0.4, RZ],
      piston: [0, AY + 0.15, ENG.cz[3]!],
      rod: [0, AY + 0.07, ENG.cz[2]!],
      crank: [0, AY - 0.04, ENG.cz[1]!],
      plug: [0, 0.474, ENG.cz[0]!],
      flywheel: [0, AY - 0.1, -0.562],
      disc: [0, AY + 0.085, -0.547],
      pressure: [0, AY - 0.06, -0.535],
      input: [0, AY + 0.012, -0.47],
      countershaft: [0, AY - CD - 0.01, -0.43],
      mainshaft: [0, AY + 0.012, -0.06],
      gearpair: [0, AY + 0.07, z],
      uj1: [0, AY - 0.03, 0.05],
      uj2: [0, RY + 0.03, PROP_B.z - 0.05],
      pinion: [0, RY - 0.03, RZ - RR],
      ring: [-RP - 0.01, RY + RR, RZ],
      spider: [0, RY + RS + 0.01, RZ],
      side: [0.02, RY - 0.035, RZ],
      axleL: [-0.4, RY + 0.03, RZ],
      axleR: [0.4, RY + 0.03, RZ],
      housing: [0.3, RY - 0.03, RZ],
      rear: [CAR.halfTrack, RY + CAR.wheelR, RZ],
      front: [CAR.halfTrack, RY + CAR.wheelR, CAR.frontZ],
      road: [CAR.halfTrack + 0.2, CAR.groundY, RZ + 0.28]
    };
    const a = A[name];
    return a ? new THREE.Vector3(a[0], a[1], a[2]) : null;
  }

  dispose(): void {
    this.car.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat?.dispose();
      }
    });
  }
}

// 링 기어·피니언은 황동색(눈에 띄게), 레버 대는 크롬 느낌의 밝은 강재
function brassLike(): THREE.MeshStandardMaterial {
  return steel({ color: 0xd4a94a, roughness: 0.3 });
}
function chromeLike(): THREE.MeshStandardMaterial {
  return steel({ color: 0xe6ebf0, roughness: 0.15 });
}
