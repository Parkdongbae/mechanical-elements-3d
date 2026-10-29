// 자동차 조향 장치: 래크와 피니언, 링크 미션 — 회전 운동 → 직선 운동 변환

import * as THREE from 'three';
import { mat, buildSpurGearMesh } from '../models/factory';
import { BaseMachine, type MachineSim } from './types';

const PINION_POS = new THREE.Vector3(0, 0.85, 0.35);
const RACK_POS = new THREE.Vector3(0, 0.6, 0.35);
const PINION_R = 0.16;
const RACK_TRAVEL = 0.3;
const STEER_RATIO = 0.6;

export class Steering extends BaseMachine {
  readonly id = 'steering';
  private driveMesh: THREE.Group | null = null;
  private linkMesh: THREE.Group | null = null;
  private pinionMesh: THREE.Mesh | null = null;
  private rackGroup = new THREE.Group();
  private wheelTilt = new THREE.Group();
  private steeringWheel = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private tieRods: THREE.Mesh[] = [];
  private theta = 0;

  constructor() {
    super();
    this.buildBase();
    this.buildWheels();
    this.buildColumn();
    this.addSlot(0, 0.17, PINION_POS);
    this.addSlot(1, 0.1, new THREE.Vector3(0.85, 0.6, 0.35));
    this.hideSlot(1);
    this.enableShadows();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.driveMesh !== null : this.linkMesh !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? PINION_POS.clone() : new THREE.Vector3(0.85, 0.6, 0.35);
  }

  buildStepModel(step: number): THREE.Group {
    if (step === 0) {
      const g = new THREE.Group();
      const pinion = buildSpurGearMesh(12, PINION_R, 0.05, 0.14, 0xc9a24b);
      pinion.position.copy(PINION_POS);
      this.pinionMesh = pinion;
      this.rackGroup.position.copy(RACK_POS);
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.14), mat(0x8b959e, 0.85, 0.3));
      this.rackGroup.add(rack);
      const toothGeo = new THREE.BoxGeometry(0.055, 0.08, 0.1);
      const toothMat = mat(0x6b7680);
      for (let i = 0; i < 9; i++) {
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        // 피니언 이빨 위상(30° 간격)과 어긋나도록 반 피치 오프셋 — 맞물림 형상
        tooth.position.set(-0.298 + i * 0.084, 0.09, 0);
        this.rackGroup.add(tooth);
      }
      g.add(pinion, this.rackGroup);
      return g;
    }
    const g = new THREE.Group();
    this.tieRods = [];
    const rodGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 8);
    const rodMat = mat(0xc0392b, 0.5, 0.5);
    for (const side of [-1, 1]) {
      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.userData.side = side;
      g.add(rod);
      this.tieRods.push(rod);
    }
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      this.driveMesh = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.linkMesh = model;
      this.hideSlot(1);
      this.updateTieRods();
    }
  }

  reset(): void {
    if (this.driveMesh) {
      this.group.remove(this.driveMesh);
      this.driveMesh = null;
      this.pinionMesh = null;
      this.rackGroup = new THREE.Group();
    }
    if (this.linkMesh) {
      this.group.remove(this.linkMesh);
      this.linkMesh = null;
      this.tieRods = [];
    }
    this.showSlot(0);
    this.hideSlot(1);
    this.steeringWheel.rotation.y = 0;
    for (const w of this.wheels) w.rotation.y = 0;
  }

  createSim(): MachineSim {
    if (!this.driveMesh || !this.linkMesh) throw new Error('steering mission incomplete');
    let t = 0;
    const self = this;
    return {
      update(dt: number) {
        t += dt;
        self.theta = 0.96 * Math.sin(1.1 * t);
        self.steeringWheel.rotation.y = -self.theta;
        if (self.pinionMesh) self.pinionMesh.rotation.z = -self.theta;
        const rackX = -self.theta * RACK_TRAVEL;
        self.rackGroup.position.x = rackX;
        for (const w of self.wheels) w.rotation.y = self.theta * STEER_RATIO;
        self.updateTieRods();
      },
      getDisplay: () => [
        { label: '핸들 각도', value: ((self.theta * 180) / Math.PI).toFixed(0), unit: '°', tone: 'blue' },
        { label: '래크 이동', value: (Math.abs(-self.theta * RACK_TRAVEL) * 100).toFixed(1), unit: 'cm', tone: 'red' },
        { label: '조향비', value: STEER_RATIO.toFixed(1), unit: ': 1' }
      ]
    };
  }

  private updateTieRods(): void {
    for (const rod of this.tieRods) {
      const side = rod.userData.side === -1 ? -1 : 1;
      // 한쪽 끝: 래크 끝단(래크 이동 따라감), 다른 쪽 끝: 바퀴 허브 '중심'.
      // 허브 중심은 조향 회전축이라 바퀴가 돌아도 연결점이 그대로 — 링크가 따로 놀지 않는다.
      const a = new THREE.Vector3(0.85 * side + this.rackGroup.position.x, 0.6, 0.35);
      const b = new THREE.Vector3(1.1 * side, 0.35, 0.9);
      const dir = b.clone().sub(a);
      const len = dir.length();
      rod.position.copy(a).addScaledVector(dir, 0.5);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      rod.scale.set(1, len, 1);
    }
  }

  private buildBase(): void {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 2.0), mat(0x9aa7b2, 0.4, 0.7));
    plate.position.set(0, 0.05, 0.35);
    this.group.add(plate);
  }

  private buildWheels(): void {
    const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 28);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = mat(0x2c3138, 0.1, 0.85);
    const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.24, 18);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMat = mat(0xb8c2cc, 0.85, 0.3);
    for (const x of [-1.1, 1.1]) {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(hubGeo, hubMat));
      wheel.position.set(x, 0.35, 0.9);
      this.wheels.push(wheel);
      this.group.add(wheel);
    }
  }

  private buildColumn(): void {
    // 축 하단은 피니언 기어 '중심'에 연결 (핸들 → 축 → 피니언 중심)
    const bottom = PINION_POS.clone();
    const top = new THREE.Vector3(0, 1.62, -0.14);
    const dir = top.clone().sub(bottom);
    const len = dir.length();
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 10), mat(0x5a646d, 0.7, 0.4));
    column.position.copy(bottom).addScaledVector(dir, 0.5);
    column.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.group.add(column);

    this.wheelTilt.position.copy(top);
    this.wheelTilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.wheelTilt.add(this.steeringWheel);
    this.group.add(this.wheelTilt);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 12, 40), mat(0x2c3138, 0.2, 0.8));
    rim.rotation.x = Math.PI / 2;
    this.steeringWheel.add(rim);
    const spokeGeo = new THREE.BoxGeometry(0.82, 0.05, 0.05);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(spokeGeo, mat(0x5a646d, 0.5, 0.5));
      spoke.rotation.y = (i / 3) * Math.PI;
      this.steeringWheel.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mat(0x5a646d, 0.6, 0.4));
    this.steeringWheel.add(hub);
  }
}
