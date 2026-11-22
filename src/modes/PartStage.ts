// 도감·퀴즈 공용 3D 무대: 턴테이블 위에 부품 1개를 띄워 천천히 자전시킨다.
// 사용자가 드래그하는 동안은 자전을 멈추고, 놓은 뒤 잠시 있다가 다시 돌린다.

import * as THREE from 'three';
import type { SceneManager } from '../scene/SceneSetup';
import { buildPart, normalizePart, disposeObject } from '../models/factory';
import { plastic, glow } from '../models/materials';
import { getCategory, type PartDef } from '../data/elements';

const PART_Y = 1.4;
const NARROW_QUERY = '(max-width: 819px)';

export function isNarrowScreen(): boolean {
  return window.matchMedia(NARROW_QUERY).matches;
}

export class PartStage {
  private root = new THREE.Group();
  private spinner = new THREE.Group();
  private ring: THREE.Mesh;
  private ringMat = glow(0x888888, 0.9);
  private model: THREE.Group | null = null;
  private pop = 1; // 등장 애니메이션 진행도 0~1
  private dragging = false;
  private idle = 0;
  private visible = true;

  private onStart = (): void => {
    this.dragging = true;
  };
  private onEnd = (): void => {
    this.dragging = false;
    this.idle = 1.2;
  };

  constructor(private sceneMgr: SceneManager) {
    // 받침: 얇은 원판 + 분류색 링. 링은 AO 대상에서 제외한다.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.1, 72), plastic(0x2b323d));
    base.position.y = 0.05;
    base.castShadow = true;
    base.receiveShadow = true;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.022, 12, 96), this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.105;
    this.ring.userData.noAO = true;
    this.spinner.position.y = PART_Y;
    this.root.add(base, this.ring, this.spinner);
    sceneMgr.add(this.root);
    sceneMgr.controls.addEventListener('start', this.onStart);
    sceneMgr.controls.addEventListener('end', this.onEnd);
  }

  /** 좁은 화면에서는 하단 패널에 가리지 않도록 부품을 화면 위쪽에 둔다 */
  flyToDefault(immediate = false, shiftX = 0): void {
    if (isNarrowScreen()) {
      this.sceneMgr.flyTo({ pos: [5.0, 2.2, 8.3], target: [0, -0.1, 0] }, immediate);
    } else {
      this.sceneMgr.flyTo({ pos: [3.4 + shiftX, 3.1, 5.6], target: [shiftX, 1.1, 0] }, immediate);
    }
  }

  /** 부품을 교체한다. null이면 비운다. */
  show(part: PartDef | null): void {
    if (this.model) {
      this.spinner.remove(this.model);
      disposeObject(this.model);
      this.model = null;
    }
    if (!part) return;
    const model = normalizePart(buildPart(part.builder), 2.2);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.model = model;
    this.spinner.add(model);
    this.spinner.rotation.y = 0.6;
    this.ringMat.color.set(getCategory(part.category).color);
    this.ringMat.emissive.set(getCategory(part.category).color);
    this.pop = 0;
  }

  setRingColor(hex: string): void {
    this.ringMat.color.set(hex);
    this.ringMat.emissive.set(hex);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.spinner.visible = v;
  }

  update(dt: number): void {
    if (!this.visible) return;
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt / 0.45);
      // easeOutBack: 살짝 넘쳤다가 안착
      const c1 = 1.4;
      const c3 = c1 + 1;
      const k = this.pop - 1;
      const e = 1 + c3 * k * k * k + c1 * k * k;
      this.spinner.scale.setScalar(0.55 + 0.45 * e);
    }
    if (this.idle > 0) this.idle -= dt;
    if (!this.dragging && this.idle <= 0) this.spinner.rotation.y += dt * 0.45;
  }

  dispose(): void {
    this.sceneMgr.controls.removeEventListener('start', this.onStart);
    this.sceneMgr.controls.removeEventListener('end', this.onEnd);
    this.show(null);
    this.sceneMgr.remove(this.root);
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
  }
}
