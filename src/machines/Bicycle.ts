// 자전거: 크랭크축 → 스프로킷 → 체인 → 평행 핀 → 테이퍼 핀 5단계 조립 미션
// 교과서 근거: 평행 핀 = 체인 연결, 테이퍼 핀 = 페달-크랭크 연결, 크랭크축 = 축용

import * as THREE from 'three';
import { mat, buildSpurGearMesh, ChainPath2D, buildChainAlongPath } from '../models/factory';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';

export const RING_R = 0.45;
export const SPR_R = 0.27;

const REAR = new THREE.Vector2(-1.55, 1.1);
const FRONT = new THREE.Vector2(1.55, 1.1);
const BB = new THREE.Vector2(0, 0.88);
const SEAT_TOP = new THREE.Vector2(-0.4, 2.7);
const HEAD_BOT = new THREE.Vector2(1.05, 2.5);
const HEAD_TOP = new THREE.Vector2(0.98, 2.72);
const BAR_POS = new THREE.Vector2(1.04, 2.86);
const CHAIN_Z = 0.24;
const BLADE_Z = 0.14;
const TIRE_TUBE = 0.1;
const CHAIN_PIN_POS = new THREE.Vector3(-0.78, 0.62, CHAIN_Z);

interface BicycleSimState {
  crank: THREE.Object3D;
  rear: THREE.Object3D;
  front: THREE.Object3D;
  chainGroup: THREE.Group;
  path: ChainPath2D;
  pin: THREE.Object3D | null;
}

export class Bicycle extends BaseMachine {
  readonly id = 'bicycle';
  readonly stepCount = 4;
  private sprocketMesh: THREE.Group | null = null;
  private chainGroup: THREE.Group | null = null;
  private crankModel: THREE.Group | null = null;
  private chainPin: THREE.Group | null = null;
  private crank = new THREE.Group();
  private rearWheel = new THREE.Group();
  private frontWheel = new THREE.Group();

  constructor() {
    super();
    this.buildFrame();
    this.buildWheel(this.rearWheel, REAR);
    this.buildWheel(this.frontWheel, FRONT);
    this.crank.position.set(BB.x, BB.y, 0);
    this.group.add(this.rearWheel, this.frontWheel, this.crank);

    this.addSlot(0, 0.13, new THREE.Vector3(BB.x, BB.y, 0));
    this.addSlot(1, 0.24, new THREE.Vector3(REAR.x, REAR.y, CHAIN_Z));
    this.addChainSlotOutline();
    this.addSlot(3, 0.08, CHAIN_PIN_POS);
    this.hideSlot(1);
    this.hideSlot(2);
    this.hideSlot(3);
    this.enableShadows();
  }

  getChainPath(): ChainPath2D {
    return new ChainPath2D(REAR.x, REAR.y, SPR_R, BB.x, BB.y, RING_R);
  }

  isInstalled(step: number): boolean {
    switch (step) {
      case 0: return this.crankModel !== null;
      case 1: return this.sprocketMesh !== null;
      case 2: return this.chainGroup !== null;
      default: return this.chainPin !== null;
    }
  }

  getFlyTarget(step: number): THREE.Vector3 {
    switch (step) {
      case 0: return new THREE.Vector3(BB.x, BB.y, 0);
      case 1: return new THREE.Vector3(REAR.x, REAR.y, CHAIN_Z);
      case 2: return new THREE.Vector3(0, 0, 0);
      default: return CHAIN_PIN_POS.clone();
    }
  }

  slotTarget(step: number): THREE.Vector3 {
    return this.getFlyTarget(step);
  }

  buildStepModel(step: number): THREE.Group {
    switch (step) {
      case 0: return this.buildCrankAssembly();
      case 1: return this.createSprocketModel();
      case 2: return buildChainAlongPath(this.getChainPath(), 0.155, CHAIN_Z);
      default: return this.buildChainPin();
    }
  }

  installStep(step: number, model: THREE.Group): void {
    switch (step) {
      case 0:
        model.position.set(0, 0, 0);
        this.crank.add(model);
        this.crankModel = model;
        this.hideSlot(0);
        this.showSlot(1);
        break;
      case 1:
        model.position.set(0, 0, CHAIN_Z);
        this.rearWheel.add(model);
        this.sprocketMesh = model;
        this.hideSlot(1);
        this.showSlot(2);
        break;
      case 2:
        this.group.add(model);
        this.chainGroup = model;
        this.hideSlot(2);
        this.showSlot(3);
        break;
      default:
        model.position.copy(CHAIN_PIN_POS);
        this.group.add(model);
        this.chainPin = model;
        model.userData.s = this.nearestChainS(CHAIN_PIN_POS);
        this.hideSlot(3);
    }
  }

  private nearestChainS(pos: THREE.Vector3): number {
    const path = this.getChainPath();
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < 240; i++) {
      const s = (i / 240) * path.length;
      const p = path.pointAt(s);
      const d = (p.x - pos.x) ** 2 + (p.y - pos.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  reset(): void {
    if (this.crankModel) {
      this.crank.remove(this.crankModel);
      this.crankModel = null;
    }
    if (this.sprocketMesh) {
      this.rearWheel.remove(this.sprocketMesh);
      this.sprocketMesh = null;
    }
    if (this.chainGroup) {
      this.group.remove(this.chainGroup);
      this.chainGroup = null;
    }
    if (this.chainPin) {
      this.group.remove(this.chainPin);
      this.chainPin = null;
    }
    this.showSlot(0);
    this.hideSlot(1);
    this.hideSlot(2);
    this.hideSlot(3);
  }

  createSim(): MachineSim {
    if (!this.chainGroup || !this.sprocketMesh || !this.crankModel) throw new Error('bicycle mission incomplete');
    const state: BicycleSimState = {
      crank: this.crank,
      rear: this.rearWheel,
      front: this.frontWheel,
      chainGroup: this.chainGroup,
      path: this.getChainPath(),
      pin: this.chainPin
    };
    let angle = 0;
    let chainOffset = 0;
    const display: MachineDisplayItem[] = [
      { label: '페달', value: '60', unit: 'rpm' },
      { label: '뒷바퀴', value: '100', unit: 'rpm', tone: 'red' },
      { label: '기어비', value: '1.67', unit: ': 1', tone: 'blue' }
    ];
    return {
      update(dt: number) {
        const wCrank = Math.PI * 2;
        angle -= wCrank * dt;
        state.crank.rotation.z = angle;
        chainOffset += wCrank * RING_R * dt;
        state.rear.rotation.z = angle * (RING_R / SPR_R);
        state.front.rotation.z = angle * 0.96;
        state.chainGroup.traverse((o) => {
          const s = o.userData.s as number | undefined;
          if (typeof s === 'number') {
            const p = state.path.pointAt(s + chainOffset);
            o.position.set(p.x, p.y, o.position.z);
            o.rotation.z = p.angle;
          }
        });
        if (state.pin) {
          const s = state.pin.userData.s as number | undefined;
          if (typeof s === 'number') {
            const p = state.path.pointAt(s + chainOffset);
            state.pin.position.set(p.x, p.y, CHAIN_PIN_POS.z);
            state.pin.rotation.z = p.angle;
          }
        }
      },
      getDisplay: () => display
    };
  }

  private buildCrankAssembly(): THREE.Group {
    const g = new THREE.Group();
    const ring = buildSpurGearMesh(22, 0.42, 0.045, 0.05, 0xd7dde3);
    ring.position.set(0, 0, CHAIN_Z);
    const ringCap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), mat(0x8b959e));
    ringCap.rotation.x = Math.PI / 2;
    ringCap.position.set(0, 0, CHAIN_Z);
    const armGeo = new THREE.BoxGeometry(0.52, 0.11, 0.07);
    const armMat = mat(0x5a646d, 0.8, 0.35);
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.26, 0, 0.3);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.26, 0, -0.06);
    const pedalGeo = new THREE.BoxGeometry(0.2, 0.06, 0.12);
    const pedalMat = mat(0x2c3138, 0.2, 0.8);
    const pedalR = new THREE.Mesh(pedalGeo, pedalMat);
    pedalR.position.set(0.5, 0, 0.38);
    const pedalL = new THREE.Mesh(pedalGeo, pedalMat);
    pedalL.position.set(-0.5, 0, -0.13);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), mat(0x8fa3b0, 0.85, 0.3));
    axle.rotation.x = Math.PI / 2;
    g.add(ring, ringCap, armR, armL, pedalR, pedalL, axle);
    return g;
  }

  private buildChainPin(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), mat(0x8fa3b0, 0.85, 0.3));
    body.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 12), mat(0x6b7680));
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.09;
    g.add(body, head);
    return g;
  }

  private createSprocketModel(): THREE.Group {
    const g = new THREE.Group();
    const r = 0.24;
    const gear = buildSpurGearMesh(14, r, r * 0.22, 0.07, 0xd7dde3);
    const holeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.1, 10);
    holeGeo.rotateX(Math.PI / 2);
    const holeMat = mat(0x5a646d);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const hole = new THREE.Mesh(holeGeo, holeMat);
      hole.position.set(Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0);
      g.add(hole);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 14), mat(0x5a646d));
    g.add(gear, hub);
    return g;
  }

  private addChainSlotOutline(): void {
    const path = this.getChainPath();
    const pts: THREE.Vector3[] = Array.from({ length: 120 }, (_, i) => {
      const p = path.pointAt((i / 120) * path.length);
      return new THREE.Vector3(p.x, p.y, CHAIN_Z);
    });
    const ring = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.02, 8, true),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.userData.slot = true;
    this.slots[2] = ring;
    this.group.add(ring);
  }

  private tube(a: THREE.Vector2, b: THREE.Vector2, r: number, material: THREE.Material, z = 0): THREE.Mesh {
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, 0);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), material);
    mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return mesh;
  }

  private buildFrame(): void {
    const frameMat = mat(0xd64545, 0.45, 0.4);
    const frameMat2 = mat(0xc23b3b, 0.45, 0.4);
    const rearA = new THREE.Vector2(REAR.x, REAR.y);
    const frontA = new THREE.Vector2(FRONT.x, FRONT.y);

    this.group.add(
      this.tube(BB, HEAD_BOT, 0.05, frameMat),
      this.tube(SEAT_TOP, HEAD_TOP, 0.045, frameMat),
      this.tube(BB, SEAT_TOP, 0.05, frameMat),
      this.tube(HEAD_BOT, HEAD_TOP, 0.055, frameMat)
    );
    for (const z of [BLADE_Z, -BLADE_Z]) {
      this.group.add(
        this.tube(HEAD_BOT, frontA, 0.035, frameMat2, z),
        this.tube(BB, rearA, 0.03, frameMat2, z),
        this.tube(SEAT_TOP, rearA, 0.03, frameMat2, z)
      );
    }

    const stem = this.tube(HEAD_TOP, BAR_POS.clone().add(new THREE.Vector2(0, -0.02)), 0.035, frameMat2);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 12), mat(0x5a646d, 0.8, 0.35));
    bar.rotation.x = Math.PI / 2;
    bar.position.set(BAR_POS.x, BAR_POS.y, 0);
    const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), mat(0x2c3138, 0.1, 0.85));
    gripL.rotation.x = Math.PI / 2;
    gripL.position.set(BAR_POS.x, BAR_POS.y, 0.4);
    const gripR = gripL.clone();
    gripR.position.z = -0.4;
    this.group.add(stem, bar, gripL, gripR);

    // 안장(삼각형) + 안장 밑 스프링
    const saddleShape = new THREE.Shape();
    saddleShape.moveTo(0.3, 0);
    saddleShape.lineTo(-0.22, 0.17);
    saddleShape.lineTo(-0.22, -0.17);
    saddleShape.closePath();
    const saddleGeo = new THREE.ExtrudeGeometry(saddleShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2
    });
    saddleGeo.rotateX(-Math.PI / 2);
    const saddle = new THREE.Mesh(saddleGeo, mat(0x2c3138, 0.1, 0.85));
    saddle.position.set(SEAT_TOP.x + 0.02, SEAT_TOP.y + 0.16, 0);
    this.group.add(saddle);

    const springPts: THREE.Vector3[] = Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const a = t * Math.PI * 8;
      return new THREE.Vector3(Math.cos(a) * 0.085, t * 0.14 - 0.07, Math.sin(a) * 0.085);
    });
    const saddleSpring = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 120, 0.022, 8),
      mat(0x9aa7b2, 0.7, 0.45)
    );
    saddleSpring.position.set(SEAT_TOP.x + 0.02, SEAT_TOP.y + 0.16, 0);
    this.group.add(saddleSpring);
  }

  private buildWheel(wheel: THREE.Group, pos: THREE.Vector2): void {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(1.0, TIRE_TUBE, 14, 48), mat(0x2c3138, 0.05, 0.9));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.99, 0.03, 10, 44), mat(0xb8c2cc, 0.85, 0.3));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 14), mat(0x5a646d, 0.85, 0.3));
    hub.rotation.x = Math.PI / 2;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), mat(0x8b959e, 0.85, 0.3));
    rod.rotation.x = Math.PI / 2;
    wheel.add(tire, rim, hub, rod);
    const spokeGeo = new THREE.CylinderGeometry(0.011, 0.011, 1.94, 6);
    const spokeMat = mat(0xb8c2cc, 0.85, 0.35);
    for (let i = 0; i < 9; i++) {
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.rotation.z = (i / 9) * Math.PI;
      wheel.add(spoke);
    }
    wheel.position.set(pos.x, pos.y, 0);
  }
}
