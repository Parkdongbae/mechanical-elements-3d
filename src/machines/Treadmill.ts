// 러닝머신: 볼 베어링과 벨트 미션 — 벨트 전동(모터 롤러 60rpm → 벨트 1.13m/s)

import * as THREE from 'three';
import { mat, ChainPath2D } from '../models/factory';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';

const ROLLER_R = 0.18;
const BELT_R = 0.23;
const ROLLER_Y = 0.32;
const FRONT_X = 1.4;
const REAR_X = -1.4;
const BELT_WIDTH = 1.0;
const MOTOR_RPM = 60;

export class Treadmill extends BaseMachine {
  readonly id = 'treadmill';
  private bearingMesh: THREE.Group | null = null;
  private beltMesh: THREE.Group | null = null;
  private pulleyMesh: THREE.Group | null = null;
  private frontRoller = new THREE.Group();
  private rearRoller = new THREE.Group();
  private slatPath = new ChainPath2D(REAR_X, ROLLER_Y, (ROLLER_R + BELT_R) / 2, FRONT_X, ROLLER_Y, (ROLLER_R + BELT_R) / 2);

  constructor() {
    super();
    this.buildFrame();
    this.group.add(this.frontRoller, this.rearRoller);

    this.addSlot(0, 0.11, new THREE.Vector3(FRONT_X, ROLLER_Y, BELT_WIDTH / 2 + 0.03));
    this.addBeltSlotOutline();
    this.hideSlot(1);
    this.enableShadows();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.bearingMesh !== null : this.beltMesh !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(FRONT_X, ROLLER_Y, BELT_WIDTH / 2 + 0.03) : new THREE.Vector3(0, 0, 0);
  }

  slotTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(FRONT_X, ROLLER_Y, 0);
  }

  buildStepModel(step: number): THREE.Group {
    if (step === 0) return this.buildBearingModel();
    return this.buildBelt();
  }

  installStep(step: number, model: THREE.Group): void {
    if (step === 0) {
      model.position.set(0, 0, BELT_WIDTH / 2 + 0.03);
      this.frontRoller.add(model);
      this.bearingMesh = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(0, 0, 0);
      this.group.add(model);
      this.beltMesh = model;
      this.pulleyMesh = this.buildPulley();
      this.pulleyMesh.position.set(0, 0, -(BELT_WIDTH / 2 + 0.07));
      this.frontRoller.add(this.pulleyMesh);
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.bearingMesh) {
      this.frontRoller.remove(this.bearingMesh);
      this.bearingMesh = null;
    }
    if (this.beltMesh) {
      this.group.remove(this.beltMesh);
      this.beltMesh = null;
    }
    if (this.pulleyMesh) {
      this.frontRoller.remove(this.pulleyMesh);
      this.pulleyMesh = null;
    }
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.beltMesh || !this.bearingMesh) throw new Error('treadmill mission incomplete');
    let angle = 0;
    let offset = 0;
    const beltSpeed = ((MOTOR_RPM / 60) * Math.PI * 2 * ROLLER_R).toFixed(2);
    const display: MachineDisplayItem[] = [
      { label: '모터 롤러', value: String(MOTOR_RPM), unit: 'rpm', tone: 'blue' },
      { label: '벨트 속도', value: beltSpeed, unit: 'm/s', tone: 'red' },
      { label: '풀리 비율', value: '1.00', unit: ': 1' }
    ];
    const w = (MOTOR_RPM / 60) * Math.PI * 2;
    return {
      update: (dt: number) => {
        angle += w * dt;
        this.frontRoller.rotation.z = angle;
        this.rearRoller.rotation.z = angle;
        offset -= w * ((ROLLER_R + BELT_R) / 2) * dt;
        if (this.beltMesh) {
          this.beltMesh.traverse((o) => {
            const s = o.userData.s as number | undefined;
            if (typeof s === 'number') {
              const p = this.slatPath.pointAt(s + offset);
              o.position.set(p.x, p.y, o.position.z);
              o.rotation.z = p.angle;
            }
          });
        }
      },
      getDisplay: () => display
    };
  }

  private buildPulley(): THREE.Group {
    const g = new THREE.Group();
    const sideGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.03, 26);
    sideGeo.rotateX(Math.PI / 2);
    const sideMat = mat(0x9aa7b2, 0.85, 0.3);
    const s1 = new THREE.Mesh(sideGeo, sideMat);
    s1.position.z = 0.045;
    const s2 = new THREE.Mesh(sideGeo, sideMat);
    s2.position.z = -0.045;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 26), mat(0x5a646d, 0.8, 0.35));
    core.rotation.x = Math.PI / 2;
    g.add(s1, s2, core);
    return g;
  }

  private buildBearingModel(): THREE.Group {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 10, 24), mat(0x6b7680));
    g.add(outer);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat(0xd9e2ea, 1.0, 0.15));
      ball.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0);
      g.add(ball);
    }
    return g;
  }

  private buildBelt(): THREE.Group {
    const g = new THREE.Group();

    const outerPts = this.samplePath(BELT_R, 100);
    const innerPts = this.samplePath(ROLLER_R, 100).reverse();
    const shape = new THREE.Shape(outerPts);
    shape.holes.push(new THREE.Path(innerPts));
    const ringGeo = new THREE.ExtrudeGeometry(shape, { depth: BELT_WIDTH, bevelEnabled: false });
    ringGeo.translate(0, 0, -BELT_WIDTH / 2);
    g.add(new THREE.Mesh(ringGeo, mat(0x2c3138, 0.1, 0.9)));

    const slatGeo = new THREE.BoxGeometry(0.07, 0.05, BELT_WIDTH - 0.03);
    const slatMat = mat(0x454d56, 0.2, 0.8);
    const count = 26;
    for (let i = 0; i < count; i++) {
      const s = (i / count) * this.slatPath.length;
      const p = this.slatPath.pointAt(s);
      const slat = new THREE.Mesh(slatGeo, slatMat);
      slat.position.set(p.x, p.y, 0);
      slat.rotation.z = p.angle;
      slat.userData.s = s;
      g.add(slat);
    }
    return g;
  }

  private samplePath(r: number, n: number): THREE.Vector2[] {
    const path = new ChainPath2D(REAR_X, ROLLER_Y, r, FRONT_X, ROLLER_Y, r);
    return Array.from({ length: n }, (_, i) => {
      const p = path.pointAt((i / n) * path.length);
      return new THREE.Vector2(p.x, p.y);
    });
  }

  private addBeltSlotOutline(): void {
    const pts: THREE.Vector3[] = Array.from({ length: 120 }, (_, i) => {
      const p = this.slatPath.pointAt((i / 120) * this.slatPath.length);
      return new THREE.Vector3(p.x, p.y, 0);
    });
    const ring = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.02, 8, true),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.userData.slot = true;
    this.slots[1] = ring;
    this.group.add(ring);
  }

  private buildFrame(): void {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 1.15), mat(0x4d5661, 0.4, 0.6));
    deck.position.set(0, 0.06, 0);
    this.group.add(deck);

    const rollerGeo = new THREE.CylinderGeometry(ROLLER_R, ROLLER_R, BELT_WIDTH - 0.04, 24);
    rollerGeo.rotateX(Math.PI / 2);
    const rollerMat = mat(0x8b959e, 0.85, 0.3);
    const fRoller = new THREE.Mesh(rollerGeo, rollerMat);
    this.frontRoller.add(fRoller);
    this.frontRoller.position.set(FRONT_X, ROLLER_Y, 0);
    const rRoller = new THREE.Mesh(rollerGeo, rollerMat);
    this.rearRoller.add(rRoller);
    this.rearRoller.position.set(REAR_X, ROLLER_Y, 0);

    const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.2, 10);
    const postMat = mat(0x5a646d, 0.7, 0.4);
    for (const z of [-0.42, 0.42]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(FRONT_X + 0.18, ROLLER_Y + 0.6, z);
      this.group.add(post);
    }
    const consolePanel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 1.0), mat(0x2c3138, 0.3, 0.6));
    consolePanel.position.set(FRONT_X + 0.18, ROLLER_Y + 1.22, 0);
    this.group.add(consolePanel);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 10), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(FRONT_X + 0.1, ROLLER_Y + 0.95, 0);
    this.group.add(bar);
  }
}
