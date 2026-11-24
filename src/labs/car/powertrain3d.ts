// FF 가로배치 엔진 + 트랜스액슬(5단 + 후진) 3D. 좌표는 drivetrainParts의 CAR 규약(앞 = -Z, 1 ≈ 0.4m)을 쓰고
// 루트를 SCALE배 키워 화면에 크게 보이게 한다. 엔진은 오른쪽(+X), 변속기는 왼쪽(-X)에 있다.
//
// 기어 잇수는 실제 기어비와 소수 넷째 자리까지 같게 골랐다(1단 39/11 = 3.545, 종감속 69/17 = 4.059 …).
// 축마다 회전각을 적분하고, 맞물린 기어는 잇수비로 반대 방향으로 돌린다.

import * as THREE from 'three';
import { buildSpurGearMesh, buildBevelGearMesh } from '../../models/parts/gears';
import { aluminum, bronze, darkSteel, ghost, plastic, rubber, steel } from '../../models/materials';
import {
  CAR,
  buildCarShell,
  buildCaliper,
  buildHalfShaftBetween,
  buildTorsionBeamAxle,
  buildWheel,
  cylX,
  latheX,
  rbox
} from '../../machines/drivetrainParts';
import { rodProfile, tubeProfile, type V2 } from '../../models/parts/geom';
import type { DriveMode } from './model';
import type { GearId } from './spec';
import type { Anchor, LabelSpec } from '../common/labels';

export const SCALE = 2.4;
/** 화면 회전 속도 = 실제 회전수 × VIS (비율은 그대로 두고 눈에 보이게 늦춘다) */
export const VIS = 1 / 50;

// 축 위치(CAR 좌표)
const AXLE = new THREE.Vector3(0, CAR.axleY, CAR.frontZ);
const OUT_Y = 0.2;
const OUT_Z = -0.7537;
const IN_Y = 0.26;
const IN_Z = -0.8577;
const SHAFT_D = Math.hypot(IN_Y - OUT_Y, IN_Z - OUT_Z); // 입력축–출력축 중심 거리 0.12

interface PairDef {
  id: 1 | 2 | 3 | 4 | 5 | 'R';
  zIn: number;
  zOut: number;
  x: number;
}

const PAIRS: PairDef[] = [
  { id: 1, zIn: 11, zOut: 39, x: -0.105 },
  { id: 2, zIn: 21, zOut: 40, x: -0.175 },
  { id: 3, zIn: 29, zOut: 38, x: -0.225 },
  { id: 4, zIn: 32, zOut: 31, x: -0.295 },
  { id: 5, zIn: 27, zOut: 22, x: -0.345 },
  { id: 'R', zIn: 12, zOut: 39, x: -0.415 }
];
/** 싱크로 슬리브: 두 기어 사이, 고른 쪽으로 미끄러져 기어를 출력축에 묶는다 */
const SLEEVES: { x: number; left: PairDef['id']; right: PairDef['id'] }[] = [
  { x: -0.14, left: 2, right: 1 },
  { x: -0.26, left: 4, right: 3 },
  { x: -0.38, left: 'R', right: 5 }
];
const Z_PINION = 17;
const Z_RING = 69;
const R_IDLER_TEETH = 16;
const GEAR_W = 0.026;
const RING_X = -0.06;
const HIGHLIGHT = 0xff8a1f;

interface GearMesh {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  base: number;
}

interface Pair {
  def: PairDef;
  drive: GearMesh; // 입력축에 고정
  driven: GearMesh; // 출력축 위에서 헛돎(슬리브가 묶으면 같이 돎)
}

/** X축 기어 메시(잇수·모듈로 피치원 결정). base = 처음 위상 */
function gearX(teeth: number, module: number, width: number, color: number): GearMesh {
  const rp = (teeth * module) / 2;
  const mesh = buildSpurGearMesh(teeth, rp + module, 2.25 * module, width, color);
  mesh.geometry.rotateY(Math.PI / 2); // 기어 축 Z → X
  const mat = mesh.material as THREE.MeshStandardMaterial;
  return { mesh, mat, base: 0 };
}

/** 맞물림 위상: A의 이가 B 쪽을, B의 이골이 A 쪽을 향하게 */
function phaseToward(fromY: number, fromZ: number, toY: number, toZ: number): number {
  // rotation.x = ψ 일 때 외곽점 각 a → (y = sin(a+ψ), z = -cos(a+ψ))
  return Math.atan2(toY - fromY, -(toZ - fromZ));
}

export class Powertrain3D {
  readonly group = new THREE.Group();
  private car = new THREE.Group();
  private inputShaft = new THREE.Group();
  private outputShaft = new THREE.Group();
  private engineSpin: THREE.Object3D[] = [];
  private altPulley = new THREE.Group();
  private pairs: Pair[] = [];
  private idler: GearMesh;
  private sleeves: { obj: THREE.Group; fork: THREE.Group; mat: THREE.MeshStandardMaterial; target: number; pos: number; def: (typeof SLEEVES)[number] }[] = [];
  private ringSpin = new THREE.Group();
  private halfShafts: { obj: THREE.Object3D; sign: number }[] = [];
  private wheels: THREE.Object3D[] = [];
  private clutchGroup = new THREE.Group();
  private pressurePlate = new THREE.Group();
  private clutchDisc = new THREE.Group();
  private discMat = bronze({ color: 0x8c6a45, roughness: 0.75 });
  private tcGroup = new THREE.Group();
  private tcPump = new THREE.Group();
  private tcTurbine = new THREE.Group();
  private road: THREE.Mesh[] = [];
  private roadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.7 });
  private mode: DriveMode = 'manual';
  private gear: GearId = 'N';
  private idlerAt = new THREE.Vector3();
  // 적분 각(rad)
  private aEng = 0;
  private aIn = 0;
  private aOut = 0;
  private roadOffset = 0;

  constructor() {
    this.car.scale.setScalar(SCALE);
    this.car.position.y = CAR.rootY * SCALE;
    this.group.add(this.car);
    this.buildBody();
    this.buildEngine();
    this.buildGearbox();
    this.idler = this.buildReverseIdler();
    this.buildFinalDrive();
    this.buildClutch();
    this.buildTorqueConverter();
    this.buildRoad();

    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m.material as THREE.Material).transparent) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.setMode('manual');
    this.setGear('N');
  }

  /** CAR 좌표 → 월드 좌표 */
  private world(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x * SCALE, y * SCALE + CAR.rootY * SCALE, z * SCALE);
  }

  /** 기어별 라벨 위치(월드) — UI가 화면 좌표를 구할 때도 쓴다 */
  gearboxCenter(): THREE.Vector3 {
    return this.world(-0.25, 0.22, -0.76);
  }

  private buildBody(): void {
    const shell = buildCarShell();
    this.car.add(shell);
    for (const side of [-1, 1] as const) {
      for (const z of [CAR.frontZ, CAR.rearZ]) {
        const w = buildWheel(side);
        w.position.set(side * CAR.halfTrack, CAR.axleY, z);
        this.car.add(w);
        this.wheels.push(w);
        const cal = buildCaliper(side);
        cal.position.set(side * CAR.halfTrack, CAR.axleY, z);
        this.car.add(cal);
      }
    }
    const rear = buildTorsionBeamAxle();
    rear.position.set(0, CAR.axleY, CAR.rearZ);
    this.car.add(rear);
  }

  private buildEngine(): void {
    const block = aluminum({ color: 0xaab3bd });
    const head = aluminum({ color: 0xc4ccd4 });
    const cover = plastic(0x22262c, { roughness: 0.45 });
    const coil = plastic(0xb8322a, { roughness: 0.4 });
    const pan = darkSteel();
    const e = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, m);
      e.add(mesh);
      return mesh;
    };
    add(rbox(0.42, 0.24, 0.27, 0.025).translate(0.29, 0.31, -0.865), block);
    add(rbox(0.4, 0.07, 0.23, 0.02).translate(0.29, 0.465, -0.865), head);
    add(rbox(0.38, 0.045, 0.2, 0.02).translate(0.29, 0.52, -0.865), cover);
    add(rbox(0.38, 0.07, 0.22, 0.02).translate(0.29, 0.165, -0.865), pan);
    for (let i = 0; i < 4; i++) {
      const c = add(cylX(0.018, -0.025, 0.025, 20, 0.004), coil);
      c.rotation.z = Math.PI / 2;
      c.position.set(0.155 + i * 0.09, 0.55, -0.865);
    }
    // 흡기 매니폴드(뒤쪽) — 단순 관 4개
    for (let i = 0; i < 4; i++) {
      const runner = add(new THREE.TorusGeometry(0.06, 0.013, 12, 24, Math.PI * 0.9), aluminum({ color: 0x9aa3ad }));
      runner.rotation.y = Math.PI / 2;
      runner.position.set(0.155 + i * 0.09, 0.4, -0.73);
    }
    this.car.add(e);

    // 크랭크 풀리·발전기 풀리·벨트(오른쪽 끝) — 풀리는 엔진 회전수로 돈다
    const pulleyMat = steel({ roughness: 0.35 });
    const crank = new THREE.Group();
    crank.position.set(0, IN_Y, IN_Z);
    const cp = new THREE.Mesh(latheX(tubeProfile(0.012, 0.052, 0.505, 0.535, 0.004)), pulleyMat);
    crank.add(cp);
    for (let k = 0; k < 3; k++) {
      const spoke = new THREE.Mesh(rbox(0.012, 0.075, 0.016, 0.004), darkSteel());
      spoke.position.set(0.537, 0, 0);
      spoke.rotation.x = (k * Math.PI) / 3;
      crank.add(spoke);
    }
    const mark = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), plastic(0xff8a1f));
    mark.position.set(0.538, 0.04, 0);
    crank.add(mark);
    this.car.add(crank);
    this.engineSpin.push(crank);
    this.altPulley.position.set(0, 0.47, -0.79);
    this.altPulley.add(new THREE.Mesh(latheX(tubeProfile(0.008, 0.026, 0.505, 0.535, 0.003)), pulleyMat));
    const am = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), plastic(0xff8a1f));
    am.position.set(0.537, 0.018, 0);
    this.altPulley.add(am);
    this.car.add(this.altPulley);
    const alt = new THREE.Mesh(cylX(0.045, 0.4, 0.5, 32, 0.008), aluminum({ color: 0xb9c1c9 }));
    alt.position.set(0, 0.47, -0.79);
    this.car.add(alt);
    // 벨트: 두 풀리를 감는 닫힌 고리(위치는 고정, 회전은 풀리로 보여 준다)
    const beltPts: THREE.Vector3[] = [];
    const c1: V2 = [IN_Y, IN_Z];
    const c2: V2 = [0.47, -0.79];
    const r1 = 0.054;
    const r2 = 0.028;
    const ang = Math.atan2(c2[0] - c1[0], c2[1] - c1[1]);
    for (let i = 0; i <= 24; i++) {
      const t = ang + Math.PI / 2 + (i / 24) * Math.PI;
      beltPts.push(new THREE.Vector3(0.52, c1[0] + Math.sin(t) * r1, c1[1] + Math.cos(t) * r1));
    }
    for (let i = 0; i <= 24; i++) {
      const t = ang - Math.PI / 2 + (i / 24) * Math.PI;
      beltPts.push(new THREE.Vector3(0.52, c2[0] + Math.sin(t) * r2, c2[1] + Math.cos(t) * r2));
    }
    const belt = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beltPts, true), 96, 0.006, 6, true),
      rubber({ grain: false })
    );
    this.car.add(belt);
  }

  private buildGearbox(): void {
    const shaftMat = steel({ roughness: 0.3 });
    // 입력축(클러치 뒤 ~ 왼쪽 끝)
    this.inputShaft.position.set(0, IN_Y, IN_Z);
    this.inputShaft.add(new THREE.Mesh(latheX(rodProfile(0.011, -0.44, 0.03, 0.003, 0.003), 24), shaftMat));
    this.outputShaft.position.set(0, OUT_Y, OUT_Z);
    this.outputShaft.add(new THREE.Mesh(latheX(rodProfile(0.013, -0.44, -0.035, 0.003, 0.003), 24), shaftMat));
    this.car.add(this.inputShaft, this.outputShaft);

    const toOut = phaseToward(IN_Y, IN_Z, OUT_Y, OUT_Z);
    for (const def of PAIRS) {
      const m = (2 * SHAFT_D) / (def.zIn + def.zOut);
      const drive = gearX(def.zIn, def.id === 'R' ? 0.0045 : m, GEAR_W, 0xc9ced6);
      const driven = gearX(def.zOut, def.id === 'R' ? 0.0045 : m, GEAR_W, 0xc9ced6);
      drive.mesh.position.set(def.x, IN_Y, IN_Z);
      driven.mesh.position.set(def.x, OUT_Y, OUT_Z);
      drive.base = toOut - Math.PI / def.zIn;
      driven.base = toOut + Math.PI;
      this.car.add(drive.mesh, driven.mesh);
      // 출력축 기어 안쪽 허브(헛도는 기어의 베어링 자리)
      const hub = new THREE.Mesh(latheX(tubeProfile(0.0135, 0.022, def.x - GEAR_W * 0.6, def.x + GEAR_W * 0.6, 0.002), 24), darkSteel());
      hub.position.set(0, OUT_Y, OUT_Z);
      this.car.add(hub);
      this.pairs.push({ def, drive, driven });
    }

    // 싱크로 슬리브 + 시프트 포크 + 레일
    const railY = OUT_Y + 0.105;
    const railZ = OUT_Z + 0.045;
    const rail = new THREE.Mesh(cylX(0.006, -0.44, -0.08, 16, 0.002), steel());
    rail.position.set(0, railY, railZ);
    this.car.add(rail);
    for (const def of SLEEVES) {
      const mat = steel({ color: 0x7f8b98, roughness: 0.32 });
      const obj = new THREE.Group();
      obj.position.set(def.x, OUT_Y, OUT_Z);
      const prof: V2[] = [
        [0.014, -0.011], [0.03, -0.011], [0.033, -0.008], [0.033, -0.003], [0.027, -0.003],
        [0.027, 0.003], [0.033, 0.003], [0.033, 0.008], [0.03, 0.011], [0.014, 0.011]
      ];
      obj.add(new THREE.Mesh(latheX(prof, 40, 50), mat));
      // 안쪽 개 이빨(도그 클러치) 표시: 슬리브 양쪽 작은 돌기
      for (let k = 0; k < 8; k++) {
        const t = new THREE.Mesh(rbox(0.026, 0.006, 0.006, 0.001), mat);
        const a = (k / 8) * Math.PI * 2;
        t.position.set(0, Math.sin(a) * 0.017, Math.cos(a) * 0.017);
        obj.add(t);
      }
      this.car.add(obj);
      const fork = new THREE.Group();
      fork.position.set(def.x, 0, 0);
      const forkMat = darkSteel({ color: 0x4a5560 });
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0035, 8, 24, Math.PI), forkMat);
      arc.rotation.y = Math.PI / 2;
      arc.rotation.x = phaseToward(OUT_Y, OUT_Z, railY, railZ) - Math.PI / 2;
      arc.position.set(0, OUT_Y, OUT_Z);
      fork.add(arc);
      const armA = new THREE.Vector3(0, OUT_Y + (railY - OUT_Y) * 0.4, OUT_Z + (railZ - OUT_Z) * 0.4);
      const armB = new THREE.Vector3(0, railY, railZ);
      const arm = new THREE.Mesh(rbox(0.008, armA.distanceTo(armB) + 0.012, 0.01, 0.002), forkMat);
      arm.position.copy(armA).add(armB).multiplyScalar(0.5);
      arm.rotation.x = Math.atan2(armB.z - armA.z, armB.y - armA.y);
      fork.add(arm);
      const boss = new THREE.Mesh(cylX(0.011, -0.008, 0.008, 20, 0.002), forkMat);
      boss.position.set(0, railY, railZ);
      fork.add(boss);
      this.car.add(fork);
      this.sleeves.push({ obj, fork, mat, target: def.x, pos: def.x, def });
    }

    // 트랜스액슬 케이스(반투명) + 벨 하우징
    const caseMat = ghost(0xa7b6c6, 0.16);
    caseMat.side = THREE.DoubleSide;
    const box = new THREE.Mesh(rbox(0.43, 0.36, 0.42, 0.06, 3), caseMat);
    box.position.set(-0.245, 0.185, -0.745);
    box.renderOrder = 2;
    box.userData.noAO = true;
    this.car.add(box);
    const bell = new THREE.Mesh(latheX([[0.0, -0.03], [0.14, -0.03], [0.145, 0.02], [0.13, 0.065], [0.0, 0.065]], 48), ghost(0xa7b6c6, 0.12));
    (bell.material as THREE.Material).side = THREE.DoubleSide;
    bell.position.set(0, IN_Y, IN_Z);
    bell.renderOrder = 2;
    bell.userData.noAO = true;
    this.car.add(bell);
  }

  private buildReverseIdler(): GearMesh {
    const def = PAIRS.find((p) => p.id === 'R') ?? PAIRS[PAIRS.length - 1]!;
    const m = 0.0045;
    const rIn = (def.zIn * m) / 2;
    const rOut = (def.zOut * m) / 2;
    const rId = (R_IDLER_TEETH * m) / 2;
    // 입력·출력 기어 둘 다와 맞물리는 위치(두 원의 교점 중 차 뒤쪽)
    const dA = rIn + rId;
    const dB = rOut + rId;
    const ax = IN_Z;
    const ay = IN_Y;
    const bx = OUT_Z;
    const by = OUT_Y;
    const d = Math.hypot(bx - ax, by - ay);
    const a = (dA * dA - dB * dB + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, dA * dA - a * a));
    const px = ax + (a * (bx - ax)) / d;
    const py = ay + (a * (by - ay)) / d;
    const iz = px - (h * (by - ay)) / d;
    const iy = py + (h * (bx - ax)) / d;
    const idler = gearX(R_IDLER_TEETH, m, GEAR_W * 0.9, 0xc9ced6);
    idler.mesh.position.set(def.x, iy, iz);
    this.idlerAt.set(def.x, iy, iz);
    idler.base = phaseToward(iy, iz, IN_Y, IN_Z) + Math.PI;
    this.car.add(idler.mesh);
    const pin = new THREE.Mesh(cylX(0.008, def.x - 0.03, def.x + 0.03, 16, 0.002), steel());
    pin.position.set(0, iy, iz);
    this.car.add(pin);
    // 후진 쌍의 위상: 입력 기어는 아이들러 쪽으로 이를, 출력 기어는 아이들러 쪽으로 이골을
    const pr = this.pairs.find((p) => p.def.id === 'R');
    if (pr) {
      pr.drive.base = phaseToward(IN_Y, IN_Z, iy, iz) - Math.PI / def.zIn;
      pr.driven.base = phaseToward(OUT_Y, OUT_Z, iy, iz) - Math.PI / def.zOut;
      idler.base = phaseToward(iy, iz, IN_Y, IN_Z) + Math.PI;
    }
    return idler;
  }

  private buildFinalDrive(): void {
    // 출력축 끝의 종감속 피니언 + 디퍼렌셜 링 기어
    const m = 0.003;
    const pin = gearX(Z_PINION, m, 0.03, 0xd4a94a);
    pin.mesh.position.set(RING_X, OUT_Y, OUT_Z);
    const toRing = phaseToward(OUT_Y, OUT_Z, AXLE.y, AXLE.z);
    pin.base = toRing - Math.PI / Z_PINION;
    this.car.add(pin.mesh);
    this.pinion = pin;

    this.ringSpin.position.copy(AXLE);
    this.car.add(this.ringSpin);
    const ring = gearX(Z_RING, m, 0.028, 0xd4a94a);
    ring.mesh.position.set(RING_X, 0, 0);
    ring.mesh.rotation.x = toRing + Math.PI; // 링의 이골이 피니언 쪽
    this.ringSpin.add(ring.mesh);
    // 디퍼렌셜 케이스 + 스파이더 기어(베벨)
    const caseMat = castIronLike();
    const dcase = new THREE.Mesh(latheX([[0.0, -0.125], [0.03, -0.125], [0.034, -0.11], [0.06, -0.095], [0.064, -0.04], [0.064, 0.0], [0.03, 0.012], [0.0, 0.012]], 40), caseMat);
    dcase.material.transparent = true;
    (dcase.material as THREE.MeshStandardMaterial).opacity = 0.5;
    dcase.material.depthWrite = false;
    this.ringSpin.add(dcase);
    for (const s of [-1, 1]) {
      const side = buildBevelGearMesh(12, 0.03, 0.007, 0.016, 0.6, 0xbfa05a);
      side.geometry.rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2); // 작은 쪽이 가운데를 향하게
      side.position.set(-0.056 + s * 0.026, 0, 0);
      this.ringSpin.add(side);
      const p = buildBevelGearMesh(9, 0.022, 0.006, 0.014, 0.6, 0xbfa05a);
      p.geometry.rotateX(s > 0 ? Math.PI / 2 : -Math.PI / 2);
      p.position.set(-0.056, s * 0.026, 0);
      this.ringSpin.add(p);
    }
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.075, 12), steel());
    cross.position.set(-0.056, 0, 0);
    this.ringSpin.add(cross);

    // 구동 반축: 왼쪽은 짧고 오른쪽(엔진 아래)은 길다
    const left = buildHalfShaftBetween(new THREE.Vector3(-0.125, CAR.axleY, CAR.frontZ), new THREE.Vector3(-CAR.hubInnerX, CAR.axleY, CAR.frontZ));
    const right = buildHalfShaftBetween(new THREE.Vector3(0.012, CAR.axleY, CAR.frontZ), new THREE.Vector3(CAR.hubInnerX, CAR.axleY, CAR.frontZ));
    this.car.add(left, right);
    this.halfShafts.push({ obj: left.children[0]!, sign: -1 }, { obj: right.children[0]!, sign: 1 });
  }
  private pinion: GearMesh | null = null;

  private buildClutch(): void {
    this.clutchGroup.position.set(0, IN_Y, IN_Z);
    const fly = new THREE.Group();
    fly.add(new THREE.Mesh(latheX(tubeProfile(0.012, 0.118, 0.045, 0.06, 0.003), 56), darkSteel({ color: 0x5c6670 })));
    // 플라이휠 링 기어 이(시각용)
    const teeth = new THREE.Mesh(latheX(tubeProfile(0.112, 0.124, 0.047, 0.058, 0.001), 96), steel());
    fly.add(teeth);
    const fm = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), plastic(0xff8a1f));
    fm.position.set(0.052, 0.1, 0);
    fly.add(fm);
    this.clutchGroup.add(fly);
    this.engineSpin.push(fly);
    // 클러치 원판(입력축과 함께 돎) — 마찰재 색
    this.clutchDisc.add(new THREE.Mesh(latheX(tubeProfile(0.014, 0.088, -0.004, 0.004, 0.0015), 56), this.discMat));
    for (let k = 0; k < 6; k++) {
      const sp = new THREE.Mesh(rbox(0.004, 0.012, 0.012, 0.002), steel());
      const a = (k / 6) * Math.PI * 2;
      sp.position.set(0, Math.sin(a) * 0.03, Math.cos(a) * 0.03);
      this.clutchDisc.add(sp);
    }
    this.clutchGroup.add(this.clutchDisc);
    // 압력판(엔진과 함께 돎, 페달을 밟으면 원판에서 떨어진다)
    this.pressurePlate.add(new THREE.Mesh(latheX(tubeProfile(0.03, 0.095, -0.012, -0.004, 0.002), 56), steel({ color: 0xb4bcc5 })));
    const pm = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), plastic(0xff8a1f));
    pm.position.set(-0.012, 0.08, 0);
    this.pressurePlate.add(pm);
    this.clutchGroup.add(this.pressurePlate);
    this.car.add(this.clutchGroup);
  }

  private buildTorqueConverter(): void {
    this.tcGroup.position.set(0, IN_Y, IN_Z);
    const R0 = 0.075;
    const rt = 0.04;
    const half = (x0: number, dir: 1 | -1): V2[] => {
      const p: V2[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = -Math.PI / 2 + (i / 16) * Math.PI;
        p.push([R0 + Math.sin(t) * rt * 1.0 + 0.0, x0 + dir * Math.cos(t) * rt * 0.75]);
      }
      return p;
    };
    const pumpMat = ghost(0x7fa3c8, 0.42);
    pumpMat.side = THREE.DoubleSide;
    const turbMat = ghost(0xd9b45a, 0.42);
    turbMat.side = THREE.DoubleSide;
    const xc = 0.012;
    this.tcPump.add(new THREE.Mesh(latheX(half(xc, 1), 48), pumpMat));
    this.tcTurbine.add(new THREE.Mesh(latheX(half(xc, -1), 48), turbMat));
    const finP = steel({ color: 0x6f93b8, roughness: 0.4 });
    const finT = steel({ color: 0xc9a24c, roughness: 0.4 });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      for (const [grp, mat, dx] of [[this.tcPump, finP, 0.012], [this.tcTurbine, finT, -0.012]] as const) {
        const fin = new THREE.Mesh(rbox(0.022, 0.06, 0.003, 0.001), mat);
        fin.position.set(xc + dx, Math.sin(a) * R0, Math.cos(a) * R0);
        fin.rotation.x = -a;
        grp.add(fin);
      }
    }
    const fm = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), plastic(0xff8a1f));
    fm.position.set(xc + 0.03, R0, 0);
    this.tcPump.add(fm);
    this.tcGroup.add(this.tcPump, this.tcTurbine);
    this.car.add(this.tcGroup);
  }

  private buildRoad(): void {
    // 차 아래로 흘러가는 차선 표시 — 차가 실제로 나아가는 느낌(바퀴 굴림과 같은 축척)
    for (let i = 0; i < 8; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.9), this.roadMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(2.35, 0.004, 0);
      dash.userData.noAO = true;
      dash.receiveShadow = true;
      this.group.add(dash);
      this.road.push(dash);
    }
  }

  setMode(mode: DriveMode): void {
    this.clutchGroup.visible = mode === 'manual';
    this.mode = mode;
    this.tcGroup.visible = mode === 'auto';
    for (const s of this.sleeves) {
      s.obj.visible = mode === 'manual';
      s.fork.visible = mode === 'manual';
    }
  }

  setGear(g: GearId): void {
    this.gear = g;
    for (const p of this.pairs) {
      const on = p.def.id === g;
      for (const gm of [p.drive, p.driven]) {
        gm.mat.emissive.set(on ? HIGHLIGHT : 0x000000);
        gm.mat.emissiveIntensity = on ? 0.55 : 0;
        gm.mat.color.set(on ? 0xffc27a : 0xc9ced6);
      }
    }
    this.idler.mat.emissive.set(g === 'R' ? HIGHLIGHT : 0x000000);
    this.idler.mat.emissiveIntensity = g === 'R' ? 0.55 : 0;
    for (const s of this.sleeves) {
      let t = s.def.x;
      if (g === s.def.left) t = s.def.x - 0.012;
      if (g === s.def.right) t = s.def.x + 0.012;
      s.target = t;
      const on = g === s.def.left || g === s.def.right;
      s.mat.emissive.set(on ? HIGHLIGHT : 0x000000);
      s.mat.emissiveIntensity = on ? 0.45 : 0;
    }
  }

  update(dt: number, s: { engineRpm: number; inputRpm: number; outputRpm: number; clutch: number; speed: number }): void {
    const k = (rpm: number): number => (rpm / 60) * Math.PI * 2 * VIS * dt;
    // 부호: 엔진·입력축은 rotation.x 음의 방향, 출력축은 양의 방향(맞물려 반대로 돎)
    this.aEng -= k(s.engineRpm);
    this.aIn -= k(s.inputRpm);
    this.aOut += k(s.outputRpm);
    for (const o of this.engineSpin) o.rotation.x = this.aEng;
    this.altPulley.rotation.x = this.aEng * (0.054 / 0.028);
    this.pressurePlate.rotation.x = this.aEng;
    this.tcPump.rotation.x = this.aEng;
    this.tcTurbine.rotation.x = this.aIn;
    this.clutchDisc.rotation.x = this.aIn;
    // 클러치 페달을 밟을수록 압력판이 엔진 쪽으로, 원판이 가운데로 물러나 틈이 생긴다
    this.clutchDisc.position.x = 0.03 - 0.012 * s.clutch;
    this.pressurePlate.position.x = 0.02 - 0.022 * s.clutch;
    this.inputShaft.rotation.x = this.aIn;
    this.outputShaft.rotation.x = this.aOut;
    for (const p of this.pairs) {
      p.drive.mesh.rotation.x = p.drive.base + this.aIn;
      // 출력축 기어는 늘 입력축 기어와 맞물려 있다(후진은 아이들러를 거쳐 입력축과 같은 방향).
      // 슬리브로 묶인 기어는 출력축과 같은 속도가 되는데, 모델이 그 속도를 입력축 rpm으로 이미 맞춰 준다.
      const dir = p.def.id === 'R' ? 1 : -1;
      p.driven.mesh.rotation.x = p.driven.base + dir * this.aIn * (p.def.zIn / p.def.zOut);
    }
    const rPair = this.pairs.find((p) => p.def.id === 'R');
    if (rPair) this.idler.mesh.rotation.x = this.idler.base - this.aIn * (rPair.def.zIn / R_IDLER_TEETH);
    if (this.pinion) this.pinion.mesh.rotation.x = this.pinion.base + this.aOut;
    const aWheel = -this.aOut * (Z_PINION / Z_RING);
    this.ringSpin.rotation.x = aWheel;
    for (const h of this.halfShafts) h.obj.rotation.x = aWheel * h.sign;
    for (const w of this.wheels) w.rotation.x = aWheel;
    for (const sl of this.sleeves) {
      sl.pos += (sl.target - sl.pos) * Math.min(1, dt * 10);
      sl.obj.position.x = sl.pos;
      sl.obj.rotation.x = this.aOut;
      sl.fork.position.x = sl.pos - sl.def.x;
    }
    // 차선: 바퀴 굴림 속도(같은 축척)로 뒤로 흐른다
    this.roadOffset += s.speed * VIS * (1 / (0.4 / SCALE)) * dt;
    const span = 8 * 1.6;
    for (let i = 0; i < this.road.length; i++) {
      let z = ((i * 1.6 + this.roadOffset) % span + span) % span - span / 2;
      if (!Number.isFinite(z)) z = 0;
      this.road[i]!.position.z = z;
    }
  }

  /** 고른 단의 이름표 글자(중립이면 null) */
  gearText(): string | null {
    if (this.gear === 'N') return null;
    return this.gear === 'R' ? '후진 기어' : `${this.gear}단 기어`;
  }

  /** 이름표 목록(지시서 18 4-2). 보이지 않는 부품은 at()이 false를 돌려준다 */
  anchors(cam?: THREE.Object3D): LabelSpec[] {
    const g = this.group;
    const at =
      (x: number, y: number, z: number, when?: () => boolean): Anchor =>
      (out) => {
        if (when && !when()) return false;
        g.updateWorldMatrix(true, false);
        out.copy(this.world(x, y, z)).applyMatrix4(g.matrixWorld);
        return true;
      };
    // 벨트·발전기는 엔진의 +x 끝(기본 시점에서는 엔진 블록 뒤)에 있다 — 카메라가 그쪽에 있을 때만 이름표를 단다
    const camL = new THREE.Vector3();
    const plusXSide = (): boolean => {
      if (!cam) return true;
      g.updateWorldMatrix(true, false);
      camL.copy(cam.position);
      g.worldToLocal(camL);
      return camL.x / SCALE > 0.2;
    };
    const manual = (): boolean => this.mode === 'manual';
    const auto = (): boolean => this.mode === 'auto';
    const pairOn = (): PairDef | null => this.pairs.find((p) => p.def.id === this.gear)?.def ?? null;
    const gearAt: Anchor = (out) => {
      const def = pairOn();
      if (!def) return false;
      const m = (2 * SHAFT_D) / (def.zIn + def.zOut);
      const rp = def.id === 'R' ? (def.zIn * 0.0045) / 2 : (def.zIn * m) / 2;
      g.updateWorldMatrix(true, false);
      out.copy(this.world(def.x, IN_Y + rp + 0.01, IN_Z)).applyMatrix4(g.matrixWorld);
      return true;
    };
    const sleeveAt: Anchor = (out) => {
      if (this.mode !== 'manual') return false;
      const s = this.sleeves.find((q) => q.def.left === this.gear || q.def.right === this.gear) ?? this.sleeves[1];
      if (!s) return false;
      g.updateWorldMatrix(true, false);
      out.copy(this.world(s.pos, OUT_Y + 0.034, OUT_Z)).applyMatrix4(g.matrixWorld);
      return true;
    };
    const idlerAnchor: Anchor = (out) => {
      g.updateWorldMatrix(true, false);
      out.copy(this.world(this.idlerAt.x, this.idlerAt.y + 0.03, this.idlerAt.z)).applyMatrix4(g.matrixWorld);
      return true;
    };
    const list: LabelSpec[] = [
      { key: 'engine', text: '엔진', at: at(0.1, 0.42, -1.0), side: 'right', priority: 1, tone: 'power' },
      { key: 'gearbox', text: '변속기', at: at(-0.26, 0.365, -0.745), side: 'above', priority: 1, tone: 'shaft' },
      { key: 'clutch', text: '클러치', at: at(0.02, 0.43, IN_Z - 0.02, manual), side: 'above', priority: 1, tone: 'control' },
      { key: 'tc', text: '토크 컨버터', at: at(0.02, 0.43, IN_Z - 0.02, auto), side: 'above', priority: 1, tone: 'control' },
      { key: 'diff', text: '차동기어', at: at(-0.08, -0.05, -0.62), side: 'below', priority: 1, tone: 'shaft' },
      { key: 'halfshaft', text: '구동축', at: at(-0.45, 0.0, -0.6), side: 'below', priority: 1, tone: 'shaft' },
      { key: 'gear', text: '1단 기어', at: gearAt, side: 'above', priority: 1, tone: 'warn' },
      { key: 'input', text: '입력축', at: at(-0.43, IN_Y, IN_Z), side: 'left', priority: 2, tone: 'shaft' },
      { key: 'output', text: '출력축', at: at(-0.43, OUT_Y, OUT_Z), side: 'below', priority: 2, tone: 'shaft' },
      { key: 'final', text: '종감속 기어', at: at(RING_X, AXLE.y + (Z_RING * 0.003) / 2, AXLE.z), side: 'right', priority: 2 },
      { key: 'flywheel', text: '플라이휠', at: at(0.052, IN_Y + 0.118, IN_Z, manual), side: 'right', priority: 2 },
      { key: 'sleeve', text: '싱크로 슬리브', at: sleeveAt, side: 'below', priority: 3, tone: 'warn' },
      { key: 'idler', text: '후진 아이들 기어', at: idlerAnchor, side: 'left', priority: 3 },
      { key: 'belt', text: '벨트와 풀리', at: at(0.52, (IN_Y + 0.47) / 2, (IN_Z - 0.79) / 2, plusXSide), side: 'right', priority: 2 },
      { key: 'alternator', text: '발전기', at: at(0.45, 0.47, -0.79, plusXSide), side: 'above', priority: 3 },
      // 바퀴 안쪽 옆면의 위 앞쪽 — 기본 시점에서 패널에 가리지 않는 부분
      { key: 'wheel', text: '앞바퀴(구동 바퀴)', at: at(-CAR.halfTrack + 0.08, CAR.axleY + 0.15, CAR.frontZ - 0.17), side: 'above', priority: 2 }
    ];
    return list;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh & THREE.Sprite;
      if ((m as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (m as THREE.Sprite).isSprite) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const sm = mat as THREE.SpriteMaterial;
          if (sm && (sm as THREE.SpriteMaterial).isSpriteMaterial) sm.map?.dispose();
          mat?.dispose();
        }
      }
    });
    this.roadMat.dispose();
  }
}

function castIronLike(): THREE.MeshStandardMaterial {
  return darkSteel({ color: 0x6b737c, roughness: 0.55 });
}
