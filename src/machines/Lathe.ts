// 임시 스텁 — 작업 지시서 09에 따라 구현 예정
import * as THREE from 'three';
import { BaseMachine, type MachineSim } from './types';

export class Lathe extends BaseMachine {
  readonly id = 'lathe';
  private installed = [false, false];
  isInstalled(step: number): boolean { return this.installed[step] === true; }
  getFlyTarget(): THREE.Vector3 { return new THREE.Vector3(0, 1, 0); }
  slotTarget(): THREE.Vector3 { return new THREE.Vector3(0, 1, 0); }
  buildStepModel(): THREE.Group { return new THREE.Group(); }
  installStep(step: number, model: THREE.Group): void { this.installed[step] = true; this.group.add(model); }
  reset(): void { this.installed = [false, false]; }
  createSim(): MachineSim { return { update: () => {}, getDisplay: () => [] }; }
}
