// 자동차 구동방식 — FF 전륜구동: 폴더 부품(엔진·트랜스액슬·바퀴 4)이 순차 등장하는 차에서
// 하단 '축용' 패널에서 구동축(앞 구동축&차동기어) → 차축(뒤 차축) 순서로 정답을 찾아 선택하는 미션.
// 베이스 프레임은 사용하지 않는다. 정답을 모두 맞추면 구동축과 모든 바퀴가 함께 회전한다.
//
// 좌표계: OpenSCAD(Z-up, mm, 조립 좌표계 유지) → three.js(Y-up). SteelFrame과 같은
// bbox 중심 재배치 + 절대 좌표 원위치 패턴을 따른다.
// 원본 scad: parts/car/올바른 FF 전륜구동 — 바퀴/축 중심 z=12, 앞차축 Y=+65, 뒷차축 Y=-65.

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { BaseMachine, type MachineSim } from './types';
import { generatePlanarUVs, getGrainMaps } from '../models/surfaces';

const MODEL_DIR = '/models/fwd_ff/';
const ROOT_Y = 0.13;   // 바퀴 바닥(scad z=-13mm)이 씬 바닥(y=0)에 닿도록 하는 루트 높이
const K = 0.01;        // mm → 씬 단위 (전장 260mm → 2.6)

const INTRO_DROP = 1.1; // 인트로 낙하 시작 높이(씬 단위)
const INTRO_DUR = 0.8;  // 부품 1개 낙하 시간(s)

/** OpenSCAD(mm, Z-up) → three.js(Y-up): (x, y, z) → (x, z, -y). 앞(+Y)은 씬 -Z 방향. */
function toThree(v: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.z, -v.y);
}

function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

interface PartRecipe {
  file: string;
  color: number;
  metalness: number;
  roughness: number;
  delay: number; // 인트로 시작 후 대기 시간(s) — 조립 순서
}

// 인트로 순차 등장 부품 — 구동축(front_driveshaft)과 차축(rear_axle)은 정답이므로 등장하지 않는다.
const INTRO_RECIPES: PartRecipe[] = [
  { file: 'engine.stl', color: 0x2f6fbe, metalness: 0.55, roughness: 0.4, delay: 0.0 },
  { file: 'transaxle.stl', color: 0xd96a1f, metalness: 0.6, roughness: 0.38, delay: 0.7 },
  { file: 'wheel_fl.stl', color: 0x2b2b30, metalness: 0.2, roughness: 0.8, delay: 1.4 },
  { file: 'wheel_fr.stl', color: 0x2b2b30, metalness: 0.2, roughness: 0.8, delay: 1.7 },
  { file: 'wheel_rl.stl', color: 0x2b2b30, metalness: 0.2, roughness: 0.8, delay: 2.0 },
  { file: 'wheel_rr.stl', color: 0x2b2b30, metalness: 0.2, roughness: 0.8, delay: 2.3 }
];

// 정답 부품(인트로에 등장하지 않음) — 하단 패널에서 선택되면 날아와 장착된다.
const DRIVE_RECIPE: PartRecipe = { file: 'front_driveshaft.stl', color: 0x2f8f4e, metalness: 0.75, roughness: 0.35, delay: 0 };
const AXLE_RECIPE: PartRecipe = { file: 'rear_axle.stl', color: 0x2f6fbe, metalness: 0.75, roughness: 0.35, delay: 0 };

// OpenSCAD 조립 좌표계 회전축 기준점(축 중심선: X 방향, z=12)
const FRONT_AXIS_MM = new THREE.Vector3(0, 65, 12);
const REAR_AXIS_MM = new THREE.Vector3(0, -65, 12);

interface IntroPart {
  recipe: PartRecipe;
  mesh: THREE.Mesh | null;
  material: THREE.MeshStandardMaterial | null;
  center: THREE.Vector3; // root 기준 최종 위치(K 적용)
}

class AnswerPart {
  geometry: THREE.BufferGeometry | null = null;
  material: THREE.MeshStandardMaterial | null = null;
  center = new THREE.Vector3();
  mesh: THREE.Mesh | null = null;
  pivot: THREE.Group | null = null;
  installed = false;
  pendingInstall = false;
  constructor(
    readonly recipe: PartRecipe,
    readonly axisPoint: THREE.Vector3 // scad mm — 회전축 기준점
  ) {}
}

export class DrivetrainFF extends BaseMachine {
  readonly id = 'drivetrain-ff';
  readonly stepCount = 2;

  private root = new THREE.Group();
  private intro: IntroPart[] = [];
  private loadedCount = 0;
  private introStart = -1;
  private introDone = false;

  private drive = new AnswerPart({ ...DRIVE_RECIPE }, FRONT_AXIS_MM); // step 0: 구동축
  private axle = new AnswerPart({ ...AXLE_RECIPE }, REAR_AXIS_MM);    // step 1: 차축
  private wheelPivots: { pivot: THREE.Group; sign: number }[] = [];
  private theta = 0;
  private spinning = false;

  constructor() {
    super();
    this.root.position.set(0, ROOT_Y, 0);
    this.group.add(this.root);
    this.buildSlots();
    this.buildFrontRearLabels();
    this.loadModels();
    this.enableShadows();
  }

  // ── Machine 인터페이스 ──

  isInstalled(step: number): boolean {
    return step === 0 ? this.drive.installed : this.axle.installed;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    const part = step === 0 ? this.drive : this.axle;
    return new THREE.Vector3(0, ROOT_Y, 0).add(part.center.clone());
  }

  slotTarget(step: number): THREE.Vector3 {
    return this.getFlyTarget(step);
  }

  buildStepModel(step: number): THREE.Group {
    const group = new THREE.Group();
    const part = step === 0 ? this.drive : this.axle;
    if (part.geometry && part.material) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.scale.setScalar(K);
      mesh.castShadow = true;
      group.add(mesh);
    }
    return group;
  }

  installStep(step: number, model: THREE.Group): void {
    const part = step === 0 ? this.drive : this.axle;
    part.installed = true;
    this.hideSlot(step);
    if (step === 0) this.showSlot(1); // 다음 정답(차축) 슬롯 표시
    const flown = model.children[0] as THREE.Mesh | undefined;
    if (flown && part.geometry) {
      flown.position.copy(part.center);
      flown.rotation.set(0, 0, 0);
      flown.scale.setScalar(K);
      this.attachAnswerPivot(part, flown);
      model.removeFromParent();
    } else {
      part.pendingInstall = true; // STL 로드 완료 시 attach
    }
    if (this.drive.installed && this.axle.installed) this.spinning = true;
    this.enableShadows();
  }

  reset(): void {
    for (const part of [this.drive, this.axle]) {
      part.installed = false;
      part.pendingInstall = false;
      if (part.pivot) {
        part.pivot.removeFromParent();
        part.pivot = null;
        part.mesh = null;
      }
      part.material?.emissive.setHex(part.recipe.color);
      part.material?.emissive.setScalar(0);
    }
    this.showSlot(0);
    this.hideSlot(1);
    this.introStart = -1;
    this.introDone = false;
    this.spinning = false;
    this.theta = 0;
    for (const w of this.wheelPivots) w.pivot.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
    for (const p of this.intro) {
      if (p.mesh && p.material) {
        p.mesh.visible = false;
        p.material.transparent = true;
        p.material.opacity = 0;
      }
    }
  }

  update(t: number): void {
    super.update(t);
    this.updateIntro(t);
  }

  createSim(): MachineSim {
    const self = this;
    return {
      update: (dt: number) => {
        if (!self.spinning) return;
        self.theta += 2.2 * dt;
        const axis = new THREE.Vector3(1, 0, 0);
        for (const entry of this.spinEntries()) {
          entry.pivot.setRotationFromAxisAngle(axis, self.theta * entry.sign);
        }
      },
      getDisplay: () => [
        { label: '구동 방식', value: 'FF (전륜구동)' },
        { label: '구동 요소', value: '구동축 + 차동기어' },
        { label: '회전', value: this.spinning ? '구동축 + 전체 바퀴' : '정지' }
      ]
    };
  }

  private spinEntries(): { pivot: THREE.Group; sign: number }[] {
    const entries: { pivot: THREE.Group; sign: number }[] = [];
    if (this.drive.pivot) entries.push({ pivot: this.drive.pivot, sign: -1 });
    for (const w of this.wheelPivots) entries.push(w);
    return entries;
  }

  // ── 씬 구성 ──

  private buildSlots(): void {
    for (const [step, axis] of [[0, FRONT_AXIS_MM], [1, REAR_AXIS_MM]] as const) {
      this.addSlot(step, 0.42, toThree(axis).multiplyScalar(K).add(new THREE.Vector3(0, ROOT_Y, 0)));
      const slot = this.slots[step];
      if (slot) slot.rotation.x = -Math.PI / 2; // 축을 감싸는 수평 펄스 링
    }
    this.hideSlot(1); // 현재 정답(구동축) 슬롯만 표시 — 차축은 구동축 정답 후 표시
  }

  /** 앞·뒤 표시: 바닥에 세운 캔버스 텍스트 스프라이트 */
  private buildFrontRearLabels(): void {
    const make = (text: string, color: string, z: number): void => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 80, 18);
      ctx.fill();
      ctx.font = '700 44px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(text, 128, 50);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
      sprite.scale.set(0.9, 0.34, 1);
      sprite.position.set(0, 0.28, z);
      this.group.add(sprite);
    };
    make('앞 FRONT', '#7fd1ff', -1.65);
    make('뒤 REAR', '#ffd479', 1.65);
  }

  private loadModels(): void {
    const loader = new STLLoader();

    for (const recipe of INTRO_RECIPES) {
      loader
        .loadAsync(MODEL_DIR + recipe.file)
        .then((geo) => this.onIntroLoaded(recipe, geo))
        .catch((err) => console.error(`STL load failed: ${recipe.file}`, err));
    }

    loader
      .loadAsync(MODEL_DIR + DRIVE_RECIPE.file)
      .then((geo) => this.onAnswerLoaded(this.drive, geo))
      .catch((err) => console.error(`STL load failed: ${DRIVE_RECIPE.file}`, err));
    loader
      .loadAsync(MODEL_DIR + AXLE_RECIPE.file)
      .then((geo) => this.onAnswerLoaded(this.axle, geo))
      .catch((err) => console.error(`STL load failed: ${AXLE_RECIPE.file}`, err));
  }

  /** OpenSCAD(Z-up, mm) → three.js(Y-up) 회전 후 bbox 중심 재배치 정보 계산 */
  private prepareGeometry(geo: THREE.BufferGeometry): { center: THREE.Vector3 } {
    geo.rotateX(-Math.PI / 2);
    generatePlanarUVs(geo);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (!bb) throw new Error('STL bounding box missing');
    const center = bb.getCenter(new THREE.Vector3());
    geo.translate(-center.x, -center.y, -center.z);
    return { center };
  }

  private makeMaterial(recipe: PartRecipe): THREE.MeshStandardMaterial {
    const grain = getGrainMaps();
    return new THREE.MeshStandardMaterial({
      color: recipe.color,
      metalness: recipe.metalness,
      roughness: recipe.roughness,
      roughnessMap: grain.roughness,
      bumpMap: grain.bump,
      bumpScale: 0.02,
      envMapIntensity: recipe.metalness >= 0.6 ? 1.25 : 0.9,
      transparent: true,
      opacity: 0
    });
  }

  private onIntroLoaded(recipe: PartRecipe, geo: THREE.BufferGeometry): void {
    const { center } = this.prepareGeometry(geo);
    const material = this.makeMaterial(recipe);
    const mesh = new THREE.Mesh(geo, material);
    mesh.scale.setScalar(K);
    mesh.position.set(center.x * K, center.y * K, center.z * K);
    mesh.visible = false;
    this.root.add(mesh);
    this.intro.push({ recipe, mesh, material, center: center.clone().multiplyScalar(K) });
    this.loadedCount += 1;
    this.enableShadows();

    // 바퀴는 완성 후 회전해야 하므로 즉시 피벗에 물려둔다(회전은 spinning 이후)
    if (recipe.file.startsWith('wheel_')) {
      // 바퀴는 축 가운데(자기 중심)에서 제자리 회전 — 피벗을 바퀴 중심에 둔다
      this.attachWheelPivot(mesh, mesh.position.clone(), recipe.file.endsWith('rl') || recipe.file.endsWith('rr') ? 1 : -1);
    }
  }

  private attachWheelPivot(mesh: THREE.Mesh, center: THREE.Vector3, sign: number): void {
    const pivot = new THREE.Group();
    pivot.position.copy(center);
    mesh.position.set(0, 0, 0);
    pivot.add(mesh);
    this.root.add(pivot);
    this.wheelPivots.push({ pivot, sign });
  }

  private onAnswerLoaded(part: AnswerPart, geo: THREE.BufferGeometry): void {
    const { center } = this.prepareGeometry(geo);
    part.geometry = geo;
    const material = this.makeMaterial(part.recipe);
    material.opacity = 1;          // 정답 부품은 인트로 페이드 대상이 아니다 — 즉시 표시
    material.transparent = false;
    material.emissive = new THREE.Color(part.recipe.color);
    material.emissiveIntensity = 0.08;
    part.material = material;
    part.center.copy(center.clone().multiplyScalar(K));
    if (part.pendingInstall) this.attachAnswerFromLoaded(part);
  }

  private attachAnswerFromLoaded(part: AnswerPart): void {
    if (!part.geometry || !part.material) return;
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.scale.setScalar(K);
    mesh.position.copy(part.center);
    part.pendingInstall = false;
    this.attachAnswerPivot(part, mesh);
  }

  /** 정답 부품을 회전 피벗에 물린다 — axisPoint(scad)를 three 좌표로 변환한 뒤 사용(좌표계 혼합 금지) */
  private attachAnswerPivot(part: AnswerPart, mesh: THREE.Mesh): void {
    const axisLocal = toThree(part.axisPoint).multiplyScalar(K);
    const pivot = new THREE.Group();
    pivot.position.copy(axisLocal);
    mesh.position.copy(part.center).sub(axisLocal);
    mesh.rotation.set(0, 0, 0);
    pivot.add(mesh);
    this.root.add(pivot);
    part.pivot = pivot;
    part.mesh = mesh;
  }

  private updateIntro(t: number): void {
    if (this.introDone) return;

    // 진행도 복원(정답 완료) 상태면 인트로 없이 즉시 표시
    if (this.drive.installed || this.axle.installed) {
      this.finishIntro();
      return;
    }
    if (this.introStart < 0) {
      if (this.loadedCount >= INTRO_RECIPES.length) this.introStart = t;
      return;
    }

    let allDone = true;
    for (const part of this.intro) {
      const mesh = part.mesh;
      if (!mesh) continue;
      const e = Math.min(1, Math.max(0, (t - this.introStart - part.recipe.delay) / INTRO_DUR));
      const k = easeOutCubic(e);
      mesh.visible = e > 0;
      mesh.position.y = part.center.y + (1 - k) * INTRO_DROP;
      part.material!.opacity = k;
      if (e < 1) allDone = false;
    }
    if (allDone && this.intro.length === INTRO_RECIPES.length) this.finishIntro();
  }

  private finishIntro(): void {
    this.introDone = true;
    for (const part of this.intro) {
      const mesh = part.mesh;
      if (!mesh) continue;
      mesh.visible = true;
      mesh.position.y = part.center.y;
      part.material!.opacity = 1;
      part.material!.transparent = false;
    }
  }
}
