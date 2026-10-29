// 시계: 태엽(스프링) → 평 기어 2단계 미션
// 태엽은 드럼 하우징 안에서 드럼 기어와 함께 회전 (스프링 배럴)

import * as THREE from 'three';
import { mat, buildSpurGearMesh } from '../models/factory';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';

const CENTER = new THREE.Vector3(0, 1.6, -0.1);
const DRUM = new THREE.Vector3(-0.459, 1.335, -0.1);
const DRUM_GEAR_R = 0.18;
const CENTER_GEAR_R = 0.35;
const DRUM_RPM = 6;

export class Clock extends BaseMachine {
  readonly id = 'clock';
  private springMesh: THREE.Group | null = null;
  private gearMesh: THREE.Group | null = null;
  private minuteHand = new THREE.Group();
  private hourHand = new THREE.Group();
  private drumGroup = new THREE.Group();

  constructor() {
    super();
    this.buildCase();
    this.buildDrum();
    this.buildHands();
    this.addSlot(0, 0.17, DRUM);
    this.addSlot(1, CENTER_GEAR_R - 0.01, CENTER);
    this.hideSlot(1);
    this.enableShadows();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.springMesh !== null : this.gearMesh !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? DRUM.clone() : CENTER.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? DRUM.clone() : CENTER.clone();
  }

  buildStepModel(step: number): THREE.Group {
    return step === 0 ? this.buildSpringSpiral() : this.buildCenterGear();
  }

  installStep(step: number, model: THREE.Group): void {
    if (step === 0) {
      model.position.set(0, 0, 0);
      this.drumGroup.add(model);
      this.springMesh = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.copy(CENTER);
      this.group.add(model);
      this.gearMesh = model;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.springMesh) {
      this.drumGroup.remove(this.springMesh);
      this.springMesh = null;
    }
    if (this.gearMesh) {
      this.group.remove(this.gearMesh);
      this.gearMesh = null;
    }
    this.showSlot(0);
    this.hideSlot(1);
    this.minuteHand.rotation.z = Math.PI / 3;
    this.hourHand.rotation.z = -Math.PI / 5;
  }

  createSim(): MachineSim {
    if (!this.springMesh || !this.gearMesh) throw new Error('clock mission incomplete');
    const ratio = DRUM_GEAR_R / CENTER_GEAR_R;
    const centerRpm = DRUM_RPM * ratio;
    const display: MachineDisplayItem[] = [
      { label: '태엽 드럼', value: String(DRUM_RPM), unit: 'rpm', tone: 'blue' },
      { label: '분침', value: String(Math.round(centerRpm)), unit: 'rpm', tone: 'red' },
      { label: '시침', value: (centerRpm / 12).toFixed(2), unit: 'rpm' }
    ];
    const self = this;
    return {
      update: (dt: number) => {
        const wDrum = (DRUM_RPM / 60) * Math.PI * 2;
        self.drumGroup.rotation.z += wDrum * dt;
        const wCenter = wDrum * ratio;
        if (self.gearMesh) self.gearMesh.rotation.z -= wCenter * dt;
        self.minuteHand.rotation.z -= wCenter * dt;
        self.hourHand.rotation.z -= (wCenter / 12) * dt;
      },
      getDisplay: () => display
    };
  }

  private buildSpringSpiral(): THREE.Group {
    const pts: THREE.Vector3[] = [];
    const turns = 2.5;
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2;
      const r = 0.038 + (0.115 - 0.038) * t;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.018, 8), mat(0x9aa7b2, 0.7, 0.45)));
    const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), mat(0x5a646d));
    arbor.rotation.x = Math.PI / 2;
    g.add(arbor);
    return g;
  }

  private buildCenterGear(): THREE.Group {
    const g = new THREE.Group();
    g.add(buildSpurGearMesh(18, CENTER_GEAR_R, 0.06, 0.08, 0xc9a24b));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 14), mat(0x5a646d));
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    return g;
  }

  private buildDrum(): void {
    this.drumGroup.position.copy(DRUM);
    const profile = [
      new THREE.Vector2(0.1, -0.08),
      new THREE.Vector2(0.14, -0.08),
      new THREE.Vector2(0.14, 0.08),
      new THREE.Vector2(0.1, 0.08),
      new THREE.Vector2(0.1, -0.08)
    ];
    const shell = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), mat(0x6b7680, 0.8, 0.35));
    shell.rotation.x = Math.PI / 2;
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20), mat(0x5a646d, 0.8, 0.35));
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.08;
    const gear = buildSpurGearMesh(14, DRUM_GEAR_R, 0.035, 0.1, 0xb8c2cc);
    this.drumGroup.add(shell, back, gear);
    this.group.add(this.drumGroup);
  }

  private buildCase(): void {
    const caseRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 14, 60), mat(0xc9a24b, 0.8, 0.35));
    caseRing.position.set(0, 1.6, 0);
    const face = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 1.15, 48),
      new THREE.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide })
    );
    face.position.set(0, 1.6, 0);
    this.group.add(caseRing, face);

    const tickGeo = new THREE.BoxGeometry(0.04, 0.12, 0.02);
    const tickMat = mat(0x5a646d, 0.4, 0.5);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.position.set(Math.cos(a) * 1.05, 1.6 + Math.sin(a) * 1.05, 0.01);
      tick.rotation.z = a - Math.PI / 2;
      this.group.add(tick);
    }

    const legGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.62, 8);
    const legMat = mat(0x8b6f2e, 0.7, 0.45);
    for (const x of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, 0.31, 0);
      leg.rotation.z = x > 0 ? -0.15 : 0.15;
      this.group.add(leg);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), mat(0x8b6f2e, 0.7, 0.45));
    base.position.set(0, 0.04, 0);
    this.group.add(base);
  }

  private buildHands(): void {
    const minuteMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.02), mat(0xc0392b, 0.4, 0.5));
    minuteMesh.position.y = 0.45;
    this.minuteHand.add(minuteMesh);
    this.minuteHand.position.set(CENTER.x, CENTER.y, 0.14);
    this.minuteHand.rotation.z = Math.PI / 3;

    const hourMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.02), mat(0x5a646d, 0.5, 0.5));
    hourMesh.position.y = 0.275;
    this.hourHand.add(hourMesh);
    this.hourHand.position.set(CENTER.x, CENTER.y, 0.17);
    this.hourHand.rotation.z = -Math.PI / 5;

    const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(0x5a646d));
    hubCap.position.set(CENTER.x, CENTER.y, 0.19);
    this.group.add(this.minuteHand, this.hourHand, hubCap);
  }
}
