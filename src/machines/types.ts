// 기계(머신) 공통 인터페이스: 각 기계는 미션 슬롯 + 조립 + 시뮬레이션을 구현

import * as THREE from 'three';

export interface MachineDisplayItem {
  label: string;
  value: string;
  unit?: string;
  tone?: 'default' | 'red' | 'blue';
}

export interface MachineSim {
  update(dt: number): void;
  getDisplay(): MachineDisplayItem[];
}

export interface HuntPickResult {
  correct: boolean;
  partId?: string;
  hint?: string;
}

export interface HuntTarget {
  object: THREE.Object3D;
  partId: string;
}

/** 3D 씬의 오브젝트를 직접 클릭해 찾는 모드를 지원하는 머신 */
export interface HuntMachine extends Machine {
  beginHunt(foundCount: number): void;
  getHuntTargets(): HuntTarget[];
  handleHuntPick(object: THREE.Object3D): HuntPickResult;
  huntStats(): { found: number; total: number };
  huntPrompt(): string;
}

export function isHuntMachine(m: Machine): m is Machine & HuntMachine {
  return 'beginHunt' in m;
}

export interface DraggableItem {
  object: THREE.Object3D;
  id: string;
}

/** 부품을 드래그해서 정답 위치에 맞추는 모드를 지원하는 머신 */
export interface DragMachine extends Machine {
  onReady?: (() => void) | null;
  isReady(): boolean;
  getDraggables(): DraggableItem[];
  dragPlaneY(): number;
  beginDrag(item: DraggableItem): void;
  moveDrag(point: THREE.Vector3): void;
  endDrag(point: THREE.Vector3): HuntPickResult;
  setSpinSpeed(v: number): void;
  beginHunt(placedIds: string[]): void;
  placedIds(): string[];
  huntStats(): { found: number; total: number };
  huntPrompt(): string;
}

export function isDragMachine(m: Machine): m is Machine & DragMachine {
  return 'beginDrag' in m;
}

export interface FollowUpPart {
  model: THREE.Group;
  to: THREE.Vector3;
  noSpin?: boolean;
}

export interface Machine {
  readonly id: string;
  readonly group: THREE.Group;
  readonly stepCount: number;
  isInstalled(step: number): boolean;
  getFlyTarget(step: number): THREE.Vector3;
  slotTarget(step: number): THREE.Vector3;
  buildStepModel(step: number): THREE.Group;
  installStep(step: number, model: THREE.Group): void;
  getFollowUps?(step: number): FollowUpPart[];
  installFollowUp?(step: number, index: number, model: THREE.Group): void;
  reset(): void;
  update(t: number): void;
  boostHint(seconds: number): void;
  createSim(): MachineSim;
}

export abstract class BaseMachine implements Machine {
  abstract readonly id: string;
  readonly group = new THREE.Group();
  readonly stepCount: number = 2;
  protected slots: (THREE.Mesh | null)[] = [];
  private hintUntil = 0;

  protected addSlot(step: number, radius: number, position: THREE.Vector3, tube = 0.024): void {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.position.copy(position);
    ring.userData.slot = true;
    this.slots[step] = ring;
    this.group.add(ring);
  }

  protected hideSlot(step: number): void {
    const slot = this.slots[step];
    if (slot) slot.visible = false;
  }

  protected showSlot(step: number): void {
    const slot = this.slots[step];
    if (slot) slot.visible = true;
  }

  update(t: number): void {
    const boost = t < this.hintUntil ? 1.6 : 0;
    const pulse = 0.55 + 0.45 * Math.sin(t * 4.2) + boost;
    for (const slot of this.slots) {
      if (slot && slot.visible) {
        (slot.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(0.25, pulse);
      }
    }
  }

  boostHint(seconds: number): void {
    this.hintUntil = performance.now() / 1000 + seconds;
  }

  protected enableShadows(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.slot) m.castShadow = true;
    });
  }

  abstract isInstalled(step: number): boolean;
  abstract getFlyTarget(step: number): THREE.Vector3;
  abstract slotTarget(step: number): THREE.Vector3;
  abstract buildStepModel(step: number): THREE.Group;
  abstract installStep(step: number, model: THREE.Group): void;
  abstract reset(): void;
  abstract createSim(): MachineSim;
}
