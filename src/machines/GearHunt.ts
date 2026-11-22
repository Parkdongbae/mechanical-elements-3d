// 기어의 종류: OpenSCAD 기어 장치(개별 부품 STL)를 동력 전달 순서대로
// 드래그 조립하는 머신. 부품이 자리에 맞으면 맞물려 회전하는 애니메이션이 시작되고,
// 슬라이더로 기구 회전 속도를 조절한다.
//
// 좌표계: OpenSCAD(Z-up, mm) → three.js(Y-up). 각 부품 STL은 조립 좌표계를 유지하며
// 축 회전은 OpenSCAD 부호/감속비를 그대로 따른다 (웜휠·피니언 = 1/24 감속).

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { BaseMachine, type MachineSim, type DragMachine, type DraggableItem, type HuntPickResult } from './types';
import { aluminum, brass, bronze, castIron, copper, darkSteel, ghost, glow, plastic, rubber, steel } from '../models/materials';
import { makeCalloutLine, makeLabelSprite, smoothSTL } from './stlShared';
import { buildGearHuntBevel } from './gearHuntBevel';

const P_ROOT = new THREE.Vector3(0, 1.5, 0);
const TARGET_SIZE = 2.6;
const SNAP_DIST = 0.8;
const BASE_OMEGA = 0.5;   // 1.0x에서의 구동 축 각속도 (rad/s) — 현실적인 느린 속도
const Z_WORM_WHEEL = 24;  // 웜휠 이빨 수 (감속비)

/** OpenSCAD(mm, Z-up) → three.js(Y-up) 변환: (x, y, z) → (x, z, -y) */
function toThree(v: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.z, -v.y);
}

/**
 * 기어 종류별 금속 톤으로 구별(평기어=황동, 베벨=청동, 웜휠=황동, 웜·피니언·래크=강재, 축=어두운 강재).
 * 기존 부품 색은 틴트로 살짝 남겨 트레이에서도 종류가 구분되게 한다.
 * emissive는 부품 색으로 두어 조립 성공 플래시(emissiveIntensity 변조)가 그대로 동작한다.
 */
function partMaterial(file: string, color: number): THREE.MeshStandardMaterial {
  const f = file.replace('.stl', '');
  const tint = (base: number, amt: number) => new THREE.Color(base).lerp(new THREE.Color(color), amt).getHex();
  let m: THREE.MeshStandardMaterial;
  if (f.startsWith('spur') || f === 'worm_wheel') m = brass({ color: tint(0xd4a94a, 0.35) });
  else if (f.startsWith('bevel')) m = bronze({ color: tint(0xb07a3c, 0.4) });
  else if (f === 'shaft') m = darkSteel({ color });
  else m = steel({ color: tint(0xc3ccd6, 0.4) }); // worm_screw, pinion_gear, rack_gear
  m.emissive.setHex(color);
  m.emissiveIntensity = 0.1;
  return m;
}

type RoundId =
  | 'spur_gear1' | 'bevel_gear1' | 'bevel_gear2'
  | 'worm_screw' | 'worm_wheel' | 'pinion_gear' | 'rack_gear';

const ROUND_ORDER: RoundId[] = ['spur_gear1', 'bevel_gear1', 'bevel_gear2', 'worm_screw', 'worm_wheel', 'pinion_gear', 'rack_gear'];

const LABELS: Record<RoundId, string> = {
  spur_gear1: '평기어 1',
  bevel_gear1: '베벨 기어 1',
  bevel_gear2: '베벨 기어 2',
  worm_screw: '웜',
  worm_wheel: '웜휠',
  pinion_gear: '피니언',
  rack_gear: '래크'
};

const INFO_PART: Record<RoundId, string> = {
  spur_gear1: 'spurGear',
  bevel_gear1: 'bevelGear',
  bevel_gear2: 'bevelGear',
  worm_screw: 'wormGear',
  worm_wheel: 'wormGear',
  pinion_gear: 'rackPinion',
  rack_gear: 'rackPinion'
};

interface AnimDef {
  kind: 'rotate' | 'slide';
  axisPoint: THREE.Vector3;  // scad mm, 회전축/슬라이드 기준점
  axisDirScad: THREE.Vector3;
  sign: number;
  ratio: number;             // θ 배율 (웜휠/피니언 = 1/24)
}

interface DragDef extends AnimDef {
  id: RoundId;
  file: string;
  color: number;
  tray: [number, number];
}

const DRAG_DEFS: DragDef[] = [
  { id: 'spur_gear1', file: 'spur_gear1.stl', color: 0xf2a64c, tray: [-2.7, 2.0], kind: 'rotate', axisPoint: new THREE.Vector3(0, 0, 0), axisDirScad: new THREE.Vector3(0, 0, 1), sign: 1, ratio: 1 },
  { id: 'bevel_gear1', file: 'bevel_gear1.stl', color: 0xf0cd6e, tray: [-1.8, 2.5], kind: 'rotate', axisPoint: new THREE.Vector3(0, 0, 42), axisDirScad: new THREE.Vector3(0, 0, 1), sign: 1, ratio: 1 },
  { id: 'bevel_gear2', file: 'bevel_gear2.stl', color: 0xe8c25a, tray: [-0.9, 2.7], kind: 'rotate', axisPoint: new THREE.Vector3(0, 12, 54), axisDirScad: new THREE.Vector3(0, 1, 0), sign: 1, ratio: 1 },
  { id: 'worm_screw', file: 'worm_screw.stl', color: 0x4fc3b8, tray: [0, 2.75], kind: 'rotate', axisPoint: new THREE.Vector3(0, 55, 54), axisDirScad: new THREE.Vector3(0, 1, 0), sign: 1, ratio: 1 },
  { id: 'worm_wheel', file: 'worm_wheel.stl', color: 0x4dd0b5, tray: [0.9, 2.7], kind: 'rotate', axisPoint: new THREE.Vector3(0, 55, 78.5), axisDirScad: new THREE.Vector3(1, 0, 0), sign: -1, ratio: 1 / Z_WORM_WHEEL },
  { id: 'pinion_gear', file: 'pinion_gear.stl', color: 0x8ab4e8, tray: [1.8, 2.5], kind: 'rotate', axisPoint: new THREE.Vector3(-35, 55, 78.5), axisDirScad: new THREE.Vector3(1, 0, 0), sign: -1, ratio: 1 / Z_WORM_WHEEL },
  { id: 'rack_gear', file: 'rack_gear.stl', color: 0xb3ccf2, tray: [2.7, 2.0], kind: 'slide', axisPoint: new THREE.Vector3(-35, 55, 93), axisDirScad: new THREE.Vector3(0, 1, 0), sign: 1, ratio: 1 }
];

const PRE_PLACED: { file: string; color: number; def: AnimDef }[] = [
  { file: 'shaft.stl', color: 0x9aa4ad, def: { kind: 'rotate', axisPoint: new THREE.Vector3(0, 0, 0), axisDirScad: new THREE.Vector3(0, 0, 1), sign: 1, ratio: 0 } },
  { file: 'spur_gear2.stl', color: 0xf2a64c, def: { kind: 'rotate', axisPoint: new THREE.Vector3(27, 0, 0), axisDirScad: new THREE.Vector3(0, 0, 1), sign: -1, ratio: 1 } }
];

interface AnimEntry {
  pivot: THREE.Group;
  def: AnimDef;
  material: THREE.MeshStandardMaterial;
  flash: number;
}

interface PartItem {
  id: RoundId;
  def: DragDef;
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  pivot: THREE.Group | null;
  placed: boolean;
  flash: number;
  material: THREE.MeshStandardMaterial;
}

export class GearHunt extends BaseMachine implements DragMachine {
  readonly id = 'gearhunt';
  readonly stepCount = 0;
  private root = new THREE.Group();
  private items: PartItem[] = [];
  private animated: AnimEntry[] = [];
  private preAnimated: AnimEntry[] = [];
  private placed = 0;
  private ready = false;
  private active: PartItem | null = null;
  private pendingRestore: RoundId[] = [];
  private placedOrder: RoundId[] = [];
  private theta = 0;
  private speedMul = 1;
  private center = new THREE.Vector3();
  private k = 1;
  private guide: THREE.Mesh | null = null;
  public onReady: (() => void) | null = null;

  constructor() {
    super();
    this.root.position.copy(P_ROOT);
    this.group.add(this.root);
    this.buildPad();
    this.loadModels();
    this.enableShadows();
  }

  isInstalled(_step: number): boolean {
    return false;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  slotTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  buildStepModel(_step: number): THREE.Group {
    return new THREE.Group();
  }

  installStep(_step: number, _model: THREE.Group): void {
    // 드래그 조립 전용 머신 — 설치 단계 없음
  }

  reset(): void {
    for (const item of this.items) {
      item.placed = false;
      if (item.pivot) {
        item.pivot.remove(item.mesh);
        this.group.remove(item.pivot);
        item.pivot = null;
        this.group.add(item.mesh);
      }
      item.mesh.position.copy(item.home);
      item.flash = 0;
      item.material.emissiveIntensity = 0.1;
    }
    for (const obj of this.gearLabels) obj.removeFromParent();
    this.gearLabels = [];
    this.animated = [];
    this.placed = 0;
    this.placedOrder = [];
    this.pendingRestore = [];
    this.theta = 0;
    this.root.rotation.y = 0;
  }

  createSim(): MachineSim {
    const self = this;
    return {
      update: (dt: number) => {
        self.theta += BASE_OMEGA * self.speedMul * dt;
        // 전부 조립하면 반투명 가이드(원본 STL 윤곽)를 숨겨 실제 기어만 보이게 한다
        if (self.guide) self.guide.visible = self.placed < DRAG_DEFS.length;
        for (const entry of [...self.preAnimated, ...self.animated]) {
          const axis = toThree(entry.def.axisDirScad).normalize();
          if (entry.def.kind === 'rotate') {
            entry.pivot.setRotationFromAxisAngle(axis, self.theta * entry.def.sign * entry.def.ratio);
          } else {
            // 래크: 웜 감속(1/24)이 적용된 피니언 실제 속도로 전방(카메라 쪽)을 향해 진행,
            // 한쪽 끝(30mm)에 도달하면 원위치로 리셋
            const travel = 30 * self.k;
            const shift = ((self.theta / Z_WORM_WHEEL) * 10.5 * self.k) % travel;
            entry.pivot.position.copy(P_ROOT).add(toThree(entry.def.axisPoint).clone().sub(self.center).multiplyScalar(self.k));
            entry.pivot.position.addScaledVector(axis, shift);
          }
          if (entry.flash > 0.1) {
            entry.flash = Math.max(0.1, entry.flash - dt * 0.8);
            entry.material.emissiveIntensity = entry.flash;
          }
        }
      },
      getDisplay: () => []
    };
  }

  // ── 드래그 조립 ──

  isReady(): boolean {
    return this.ready;
  }

  getDraggables(): DraggableItem[] {
    return this.items.filter((item) => !item.placed).map((item) => ({ object: item.mesh, id: item.id }));
  }

  dragPlaneY(): number {
    return P_ROOT.y;
  }

  beginDrag(item: DraggableItem): void {
    this.active = this.items.find((p) => p.mesh === item.object && !p.placed) ?? null;
  }

  moveDrag(point: THREE.Vector3): void {
    if (!this.active) return;
    this.active.mesh.position.set(point.x, P_ROOT.y, point.z);
  }

  endDrag(point: THREE.Vector3): HuntPickResult {
    const item = this.active;
    this.active = null;
    if (!item || item.placed) return { correct: false };
    const dist = Math.hypot(point.x - P_ROOT.x, point.z - P_ROOT.z);
    if (dist > SNAP_DIST) {
      item.mesh.position.copy(item.home);
      return { correct: false, hint: '부품을 반투명 그림(정답 모형) 가까이로 드래그해 보세요!' };
    }
    const nextId = ROUND_ORDER[this.placed];
    if (item.id !== nextId) {
      item.mesh.position.copy(item.home);
      const nextLabel = nextId ? LABELS[nextId] : '';
      return { correct: false, hint: `순서가 달라요! 동력이 전달되려면 지금은 '${nextLabel}'을(를) 연결해야 해요!` };
    }
    const def = item.def;
    this.createPivot(item, def);
    item.placed = true;
    this.placed += 1;
    this.placedOrder.push(item.id);
    this.showGearLabel(item.id);
    return { correct: true, partId: INFO_PART[item.id] };
  }

  huntStats(): { found: number; total: number } {
    return { found: this.placed, total: ROUND_ORDER.length };
  }

  huntPrompt(): string {
    if (!this.ready) return '3D 모델을 불러오는 중이에요...';
    const stats = this.huntStats();
    if (stats.found >= stats.total) return '기어 장치가 완성됐어요! 아래 슬라이더로 속도를 조절해 보세요!';
    const next = ROUND_ORDER[stats.found];
    return `다음 연결: ${next ? LABELS[next] : ''} — 드래그해서 맞춰 넣으세요! (${stats.found}/${stats.total})`;
  }

  beginHunt(placedIds: string[]): void {
    this.pendingRestore = placedIds.filter((id): id is RoundId => ROUND_ORDER.includes(id as RoundId));
    this.applyRestore();
  }

  placedIds(): string[] {
    return [...this.placedOrder];
  }

  setSpinSpeed(v: number): void {
    this.speedMul = v;
  }

  private applyRestore(): void {
    for (const id of this.pendingRestore) {
      const item = this.items.find((p) => p.id === id);
      if (!item || item.placed) continue;
      this.createPivot(item, item.def);
      item.placed = true;
      this.placed += 1;
      this.placedOrder.push(id);
      this.showGearLabel(id);
    }
  }

  // ── 단계별 성공 라벨 (지시선 + 부품 이름) ──

  private gearLabels: THREE.Object3D[] = [];

  /** 라벨을 부품 좌우로 교대 배치해 겹침을 줄인다 */
  private static readonly LABEL_SIDE: Record<RoundId, number> = {
    spur_gear1: -0.65,
    bevel_gear1: 0.65,
    bevel_gear2: -0.65,
    worm_screw: 0.65,
    worm_wheel: -0.65,
    pinion_gear: 0.65,
    rack_gear: 0.78
  };

  /** 설치된 부품 옆에 지시선과 부품 이름 라벨을 만들어 표시한다 */
  private showGearLabel(id: RoundId): void {
    const item = this.items.find((p) => p.id === id);
    if (!item?.pivot) return;
    const center = item.pivot.position;
    const side = GearHunt.LABEL_SIDE[id] ?? 0.65;
    const labelPos = center.clone().add(new THREE.Vector3(side, 0.25, 0));
    this.gearLabels.push(...this.makeGearLabelCallout(LABELS[id], '#ffe08a', center.clone(), labelPos));
  }

  private makeGearLabelCallout(text: string, color: string, partPoint: THREE.Vector3, labelPos: THREE.Vector3): THREE.Object3D[] {
    const sprite = makeLabelSprite(text, color, 0.75, 0.3, 60);
    sprite.position.copy(labelPos);
    this.group.add(sprite);
    const line = makeCalloutLine(partPoint, labelPos, color);
    this.group.add(line);
    return [sprite, line];
  }

  private createPivot(item: PartItem, def: DragDef): void {
    // axisPoint(scad)를 three 좌표로 변환한 뒤 중심(C, three 좌표)과 뺀다 — 좌표계 혼합 금지
    const localOffset = toThree(def.axisPoint).clone().sub(this.center).multiplyScalar(this.k);
    const pivot = new THREE.Group();
    pivot.position.copy(P_ROOT).add(localOffset);
    item.mesh.position.copy(localOffset).negate();
    item.mesh.rotation.set(0, 0, 0);
    pivot.add(item.mesh);
    this.group.add(pivot);
    item.pivot = pivot;
    this.animated.push({
      pivot,
      def,
      material: item.material,
      flash: 0.9
    });
    item.flash = 0.9;
  }
  // ── 모델 로딩 및 씬 구성 ──

  private buildPad(): void {
    // 스튜디오 바닥과 어울리는 밝은 회색 받침(기존 갈색 → 중성 회색)
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.08, 64), plastic(0xa9b0b8, { roughness: 0.55 }));
    pad.position.set(0, 0.04, 0.2);
    pad.castShadow = true;
    pad.receiveShadow = true;
    this.group.add(pad);
  }

  private loadModels(): void {
    const loader = new STLLoader();
    loader
      .loadAsync('/models/total.stl')
      .then((totalGeo) => {
        totalGeo.rotateX(-Math.PI / 2);
        smoothSTL(totalGeo);
        totalGeo.computeBoundingBox();
        const bb = totalGeo.boundingBox;
        if (!bb) throw new Error('total.stl bounding box missing');
        this.center = bb.getCenter(new THREE.Vector3());
        const size = bb.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        this.k = TARGET_SIZE / maxDim;
        totalGeo.translate(-this.center.x, -this.center.y, -this.center.z);

        // 정답 가이드(반투명 완성 모형) — 공용 ghost 재질, 불투명도는 기존 값 유지
        const guideMaterial = ghost(0x7fb2d8, 0.15);
        const ghostMesh = new THREE.Mesh(totalGeo, guideMaterial);
        ghostMesh.scale.setScalar(this.k);
        this.root.add(ghostMesh);
        this.guide = ghostMesh;

        for (const pre of PRE_PLACED) {
          loader
            .loadAsync(`/models/${pre.file}`)
            .then((geo) => {
              geo.rotateX(-Math.PI / 2);
              smoothSTL(geo);
              geo.translate(-this.center.x, -this.center.y, -this.center.z);
              const mesh = new THREE.Mesh(geo, partMaterial(pre.file, pre.color));
              mesh.scale.setScalar(this.k);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              const pivot = this.attachAnimated(mesh, pre.def);
              if (pre.file === 'spur_gear2.stl') {
                geo.computeBoundingBox();
                const gbb = geo.boundingBox;
                if (gbb) this.buildDriveMotor(pivot, P_ROOT.y + gbb.min.y * this.k);
              }
            })
            .catch((err) => console.error(`STL load failed: ${pre.file}`, err));
        }

        for (const def of DRAG_DEFS) {
          loader
            .loadAsync(`/models/${def.file}`)
            .then((stlGeo) => {
              // 베벨 기어는 STL 대신 실제 치형의 절차 모델로 교체(위치·축은 동일)
              const bevel = buildGearHuntBevel(def.id);
              const geo = bevel ?? stlGeo;
              if (!bevel) geo.rotateX(-Math.PI / 2);
              smoothSTL(geo);
              geo.computeBoundingBox();
              const pbb = geo.boundingBox;
              if (!pbb) throw new Error(`${def.file} bounding box missing`);
              const partCenter = pbb.getCenter(new THREE.Vector3());
              const visualOffset = partCenter.clone().sub(this.center).multiplyScalar(this.k);
              geo.translate(-this.center.x, -this.center.y, -this.center.z);

              const material = partMaterial(def.file, def.color);
              const mesh = new THREE.Mesh(geo, material);
              mesh.scale.setScalar(this.k);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              const home = new THREE.Vector3(def.tray[0], P_ROOT.y, def.tray[1]).sub(visualOffset);
              mesh.position.copy(home);
              this.group.add(mesh);
              this.items.push({ id: def.id, def, mesh, home, pivot: null, placed: false, flash: 0, material });
              this.enableShadows();
              this.applyRestore();
              if (this.items.length === DRAG_DEFS.length) {
                this.ready = true;
                this.onReady?.();
              }
            })
            .catch((err) => {
              console.error(`STL load failed: ${def.file}`, err);
              this.ready = true;
              this.onReady?.();
            });
        }
      })
      .catch((err) => {
        console.error('STL load failed: total.stl', err);
        this.ready = true;
        this.onReady?.();
      });
  }

  private attachAnimated(mesh: THREE.Mesh, def: AnimDef): THREE.Group {
    const localOffset = toThree(def.axisPoint).clone().sub(this.center).multiplyScalar(this.k);
    const pivot = new THREE.Group();
    pivot.position.copy(P_ROOT).add(localOffset);
    mesh.position.copy(localOffset).negate();
    pivot.add(mesh);
    this.group.add(pivot);
    this.preAnimated.push({
      pivot,
      def,
      material: mesh.material as THREE.MeshStandardMaterial,
      flash: 0
    });
    return pivot;
  }

  /**
   * 구동 평기어를 돌리는 전동기. 기어가 허공에서 혼자 도는 것처럼 보이지 않도록
   * 받침 위에 세운 모터 → 출력축 → 커플링 → 기어로 동력의 출발점을 보여 준다.
   * 몸체는 고정(group), 출력축·커플링은 기어 피벗의 자식이라 기어와 함께 회전한다.
   */
  private buildDriveMotor(pivot: THREE.Group, gearBottomY: number): void {
    const x = pivot.position.x;
    const z = pivot.position.z;
    const padTop = 0.08;
    const bodyTop = Math.max(padTop + 0.45, gearBottomY - 0.26);
    const bodyH = bodyTop - (padTop + 0.06);
    const R = 0.2;

    const motor = new THREE.Group();
    motor.position.set(x, 0, z);
    const add = (geo: THREE.BufferGeometry, material: THREE.Material, y: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, material);
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      motor.add(m);
      return m;
    };
    const housing = aluminum({ color: 0x4f7fb8, roughness: 0.5 });
    const dark = castIron();
    // 받침 플랜지 + 고정 볼트
    add(new THREE.CylinderGeometry(R + 0.09, R + 0.1, 0.06, 40), dark, padTop + 0.03);
    const boltMat = steel();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const b = add(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 6), boltMat, padTop + 0.072);
      b.position.x = Math.cos(a) * (R + 0.05);
      b.position.z = Math.sin(a) * (R + 0.05);
    }
    // 몸체 + 방열핀
    add(new THREE.CylinderGeometry(R * 0.9, R * 0.9, bodyH, 40), housing, padTop + 0.06 + bodyH / 2);
    const finCount = Math.max(4, Math.round(bodyH / 0.06));
    const finGeo = new THREE.CylinderGeometry(R, R, 0.022, 40);
    for (let i = 0; i < finCount; i++) {
      add(finGeo, housing, padTop + 0.06 + 0.05 + ((bodyH - 0.1) * i) / (finCount - 1));
    }
    // 위쪽 엔드벨과 축 받이
    add(new THREE.CylinderGeometry(R * 0.6, R * 0.92, 0.07, 40), dark, bodyTop + 0.035);
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 24), steel(), bodyTop + 0.08);
    // 단자함 + 전선
    const box = add(new THREE.BoxGeometry(0.16, 0.18, 0.12), dark, padTop + 0.06 + bodyH * 0.55);
    box.position.z = R + 0.03;
    const cablePts = [
      new THREE.Vector3(0, padTop + 0.06 + bodyH * 0.5, R + 0.09),
      new THREE.Vector3(0.05, padTop + 0.2, R + 0.3),
      new THREE.Vector3(0.25, padTop + 0.03, R + 0.5),
      new THREE.Vector3(0.6, padTop + 0.025, R + 0.62)
    ];
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 32, 0.02, 8), rubber());
    cable.castShadow = true;
    motor.add(cable);
    // 권선이 살짝 보이는 통풍 띠
    add(new THREE.CylinderGeometry(R * 0.93, R * 0.93, 0.04, 40), copper(), padTop + 0.085);
    this.group.add(motor);

    // 회전부: 출력축 + 커플링(회전이 보이도록 발광 표시) — 피벗 좌표(피벗 원점 = 기어 축 위의 한 점)
    const y0 = bodyTop + 0.08 - pivot.position.y;
    const y1 = gearBottomY + 0.03 - pivot.position.y;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, y1 - y0, 20), steel());
    shaft.position.y = (y0 + y1) / 2;
    shaft.castShadow = true;
    const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.11, 28), darkSteel());
    coupling.position.y = y1 - 0.075;
    coupling.castShadow = true;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.112, 0.03), glow(0xffb020, 0.9));
    mark.position.set(0.078, y1 - 0.075, 0);
    pivot.add(shaft, coupling, mark);

    const labelPos = new THREE.Vector3(x + 0.75, padTop + 0.06 + bodyH * 0.6, z + 0.55);
    const sprite = makeLabelSprite('모터', '#8ec5ff', 0.6, 0.26, 60);
    sprite.position.copy(labelPos);
    this.group.add(sprite, makeCalloutLine(new THREE.Vector3(x + R * 0.8, labelPos.y, z + R * 0.5), labelPos, '#8ec5ff'));
  }
}
