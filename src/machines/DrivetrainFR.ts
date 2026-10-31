// 자동차 구동방식 — FR 후륜구동: 폴더 부품(엔진·변속기·차동기어·차축 하우징·반축·바퀴 4)이
// 순차 등장하는 차에서 하단 '축용' 패널에서 앞 차축(차축) → 프로펠러 샤프트(구동축) → 뒤 구동축(차축)
// 순서로 정답을 찾아 선택하는 미션. 베이스 프레임은 사용하지 않는다.
// 차축 하우징(녹색 반투명 ghost)과 반축(보라)은 처음부터 장착돼 있고 정답 후보에서 제외 —
// 뒤 구동축 정답 설치 시 가이드 반축을 빼고 뒤 구동축 STL로 교체한다(같은 형태라 겹침 방지).
// 완료하면 프로펠러 샤프트 + 반축 + 뒷바퀴만 회전한다(FR 특성: 앞바퀴는 정지).
//
// 좌표계: OpenSCAD(Z-up, mm, 조립 좌표계 유지) → three.js(Y-up). SteelFrame/DrivetrainFF와 같은
// bbox 중심 재배치 + 절대 좌표 원위치 패턴을 따른다.
// 원본 scad: parts/car/올바른 FR 후륜구동 — 바퀴/축 중심 z=12, 앞차축 Y=+65, 디퍼렌셜·반축 Y=-65,
// 프로펠러 샤프트 Y=-13.5·z=14·X축 기준 +3.52° 기울어짐.

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { BaseMachine, type MachineSim } from './types';
import { generatePlanarUVs, getGrainMaps } from '../models/surfaces';

const MODEL_DIR = '/models/rwd_fr/';
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
  ghost?: boolean; // 반투명 구조물(차축 하우징) — 내부 반축이 비쳐 보임
}

// 인트로 순차 등장 부품 — 앞 차축(front_axle)·프로펠러 샤프트(propeller_shaft)·뒤 구동축(rear_driveshaft)은
// 정답이므로 등장하지 않는다. 차축 하우징과 반축은 미리 장착된 가이드(정답 후보 제외).
const INTRO_RECIPES: PartRecipe[] = [
  { file: 'engine.stl', color: 0x2f6fbe, metalness: 0.55, roughness: 0.4, delay: 0.0 },
  { file: 'transmission.stl', color: 0xd96a1f, metalness: 0.6, roughness: 0.38, delay: 0.7 },
  { file: 'differential.stl', color: 0x2f8f4e, metalness: 0.55, roughness: 0.4, delay: 1.4 },
  { file: 'axle_housing.stl', color: 0x5fae74, metalness: 0.3, roughness: 0.5, delay: 2.1, ghost: true },
  { file: 'half_shafts.stl', color: 0x7d1ab3, metalness: 0.75, roughness: 0.35, delay: 2.8 },
  { file: 'wheel_fl.stl', color: 0x2b2b30, metalness: 0.2, roughness: 0.8, delay: 3.5 },
  { file: 'wheel_fr.stl', color: 0x2b2b30, metalness: 0.2, roughness: 0.8, delay: 3.8 },
  { file: 'wheel_rl.stl', color: 0x2b2b30, metalness: 0.2, roughness: 0.8, delay: 4.1 },
  { file: 'wheel_rr.stl', color: 0x2b2b30, metalness: 0.2, roughness: 0.8, delay: 4.4 }
];

// 정답 부품(인트로에 등장하지 않음) — 하단 패널에서 선택되면 날아와 장착된다.
const FRONT_AXLE_RECIPE: PartRecipe = { file: 'front_axle.stl', color: 0x40404a, metalness: 0.75, roughness: 0.35, delay: 0 };
const PROP_SHAFT_RECIPE: PartRecipe = { file: 'propeller_shaft.stl', color: 0xf2cc26, metalness: 0.6, roughness: 0.4, delay: 0 };
const REAR_DRIVE_RECIPE: PartRecipe = { file: 'rear_driveshaft.stl', color: 0x7d1ab3, metalness: 0.75, roughness: 0.35, delay: 0 };

// OpenSCAD 조립 좌표계 회전축 기준점(mm). 반축/차축: X 방향 축, z=12.
const FRONT_AXIS_MM = new THREE.Vector3(0, 65, 12);
const PROP_AXIS_MM = new THREE.Vector3(0, -13.5, 14);
const REAR_AXIS_MM = new THREE.Vector3(0, -65, 12);

// 프로펠러 샤프트 회전축 방향(three): scad Y축을 X축 기준 +3.52° 기울인 뒤 toThree 변환
const PROP_AXIS_DIR = new THREE.Vector3(0, Math.sin((3.52 * Math.PI) / 180), -Math.cos((3.52 * Math.PI) / 180));
const X_AXIS = new THREE.Vector3(1, 0, 0);

const SPIN_SPEED = 2.2; // 완료 회전 각속도(rad/s) — DrivetrainFF와 동일

interface IntroPart {
  recipe: PartRecipe;
  mesh: THREE.Mesh | null;
  material: THREE.MeshStandardMaterial | null;
  center: THREE.Vector3; // root 기준 최종 위치(K 적용)
  inPivot: boolean; // 바퀴 여부 — 피벗에 물린 경우 인트로 낙하도 피벗 로컬 좌표로
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

export class DrivetrainFR extends BaseMachine {
  readonly id = 'drivetrain-fr';
  readonly stepCount = 3;

  private root = new THREE.Group();
  private intro: IntroPart[] = [];
  private introHalfShaft: IntroPart | null = null; // 가이드 반축 — 뒤 구동축 정답 시 교체됨
  private loadedCount = 0;
  private introStart = -1;
  private introDone = false;

  private frontAxle = new AnswerPart({ ...FRONT_AXLE_RECIPE }, FRONT_AXIS_MM);  // step 0: 차축
  private propShaft = new AnswerPart({ ...PROP_SHAFT_RECIPE }, PROP_AXIS_MM);   // step 1: 구동축
  private rearDrive = new AnswerPart({ ...REAR_DRIVE_RECIPE }, REAR_AXIS_MM);   // step 2: 차축(반축)
  private answerParts: AnswerPart[] = [];

  private wheelPivots: { pivot: THREE.Group; sign: number; rear: boolean }[] = [];
  private theta = 0;
  private spinning = false;

  constructor() {
    super();
    this.answerParts = [this.frontAxle, this.propShaft, this.rearDrive];
    this.root.position.set(0, ROOT_Y, 0);
    this.group.add(this.root);
    this.buildSlots();
    this.buildLabels();
    this.loadModels();
    this.enableShadows();
  }

  // ── Machine 인터페이스 ──

  isInstalled(step: number): boolean {
    return this.answerParts[step]!.installed;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return new THREE.Vector3(0, ROOT_Y, 0).add(this.answerParts[step]!.center.clone());
  }

  slotTarget(step: number): THREE.Vector3 {
    return this.getFlyTarget(step);
  }

  buildStepModel(step: number): THREE.Group {
    const group = new THREE.Group();
    const part = this.answerParts[step]!;
    if (part.geometry && part.material) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.scale.setScalar(K);
      mesh.castShadow = true;
      group.add(mesh);
    }
    return group;
  }

  installStep(step: number, model: THREE.Group): void {
    const part = this.answerParts[step]!;
    part.installed = true;
    this.hideSlot(step);
    if (step < this.stepCount - 1) this.showSlot(step + 1); // 다음 정답 슬롯 표시
    if (step === this.stepCount - 1) this.removeIntroHalfShaft(); // 가이드 반축 → 정답 뒤 구동축으로 교체
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
    if (this.answerParts.every((p) => p.installed)) this.spinning = true;
    this.enableShadows();
  }

  reset(): void {
    for (const part of this.answerParts) {
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
    for (let i = 0; i < this.stepCount; i++) {
      if (i === 0) this.showSlot(0);
      else this.hideSlot(i);
    }
    // 가이드 반축 복원(제거됐다면 다시 붙인다)
    const half = this.introHalfShaft;
    if (half?.mesh && !half.mesh.parent) this.root.add(half.mesh);
    this.introStart = -1;
    this.introDone = false;
    this.spinning = false;
    this.theta = 0;
    for (const w of this.wheelPivots) w.pivot.setRotationFromAxisAngle(X_AXIS, 0);
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
        self.theta += SPIN_SPEED * dt;
        // 프로펠러 샤프트: 90° 베벨로 차동기어와 맞물림 — 반대 부호
        if (self.propShaft.pivot) self.propShaft.pivot.setRotationFromAxisAngle(PROP_AXIS_DIR, -self.theta);
        if (self.rearDrive.pivot) self.rearDrive.pivot.setRotationFromAxisAngle(X_AXIS, self.theta);
        for (const w of self.rearWheelPivots()) {
          w.pivot.setRotationFromAxisAngle(X_AXIS, self.theta * w.sign);
        }
      },
      getDisplay: () => [
        { label: '구동 방식', value: 'FR (후륜구동)' },
        { label: '구동 요소', value: '프로펠러 샤프트 + 차동기어 + 반축' },
        { label: '회전', value: this.spinning ? '프로펠러 샤프트 + 반축 + 뒷바퀴' : '정지' }
      ]
    };
  }

  private rearWheelPivots(): { pivot: THREE.Group; sign: number }[] {
    return this.wheelPivots.filter((w) => w.rear);
  }

  // ── 씬 구성 ──

  private buildSlots(): void {
    for (const [step, part] of this.answerParts.entries()) {
      this.addSlot(step, 0.42, toThree(part.axisPoint).multiplyScalar(K).add(new THREE.Vector3(0, ROOT_Y, 0)));
      const slot = this.slots[step];
      if (slot) slot.rotation.x = -Math.PI / 2; // 축을 감싸는 수평 펄스 링
    }
    this.hideSlot(1);
    this.hideSlot(2); // 현재 정답(앞 차축) 슬롯만 표시
  }

  /** 캔버스 텍스트 스프라이트 (부품 라벨·앞뒤 표시 공용) */
  private makeLabel(text: string, color: string, position: THREE.Vector3, w = 0.9, h = 0.34, fontPx = 44): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 80, 18);
      ctx.fill();
      ctx.font = `700 ${fontPx}px "Noto Sans KR", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(text, 128, 50);
    }
    const texture = new THREE.CanvasTexture(canvas);
    // depthTest off — 라벨은 차체 뒤에 숨지 않고 항상 표시(앞 FRONT 등 가림 방지)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false }));
    sprite.renderOrder = 10;
    sprite.scale.set(w, h, 1);
    sprite.position.copy(position);
    this.group.add(sprite);
    return sprite;
  }

  private buildLabels(): void {
    this.makeLabel('앞 FRONT', '#7fd1ff', new THREE.Vector3(-0.55, 0.3, -1.2));
    this.makeLabel('뒤 REAR', '#ffd479', new THREE.Vector3(0, 0.3, 1.2));
    // 부품 라벨은 부품에서 띄우고 지시선으로 연결 — 겹침 방지
    this.makeCallout('엔진', '#7fd1ff', new THREE.Vector3(-0.22, 0.18, -0.83), new THREE.Vector3(-0.95, 0.75, -0.85));
    this.makeCallout('변속기', '#ffb37a', new THREE.Vector3(0.1, 0.22, -0.42), new THREE.Vector3(0.8, 0.72, -0.35));
    this.makeCallout('차동기어', '#8ee08e', new THREE.Vector3(0, 0.16, 0.62), new THREE.Vector3(0.95, 0.6, 0.78));
    this.makeCallout('반축', '#c98ae8', new THREE.Vector3(-0.45, 0.12, 0.65), new THREE.Vector3(-0.7, 0.55, 1.05));
  }

  /** 부품 → 라벨 지시선 */
  private makeCallout(text: string, color: string, partPoint: THREE.Vector3, labelPos: THREE.Vector3): { sprite: THREE.Sprite; line: THREE.Line } {
    const sprite = this.makeLabel(text, color, labelPos, 0.75, 0.3, 60);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([partPoint, labelPos]),
      new THREE.LineBasicMaterial({ color, depthTest: false } as THREE.LineBasicMaterialParameters)
    );
    line.renderOrder = 9;
    this.root.add(line);
    return { sprite, line };
  }

  private loadModels(): void {
    const loader = new STLLoader();

    for (const recipe of INTRO_RECIPES) {
      loader
        .loadAsync(MODEL_DIR + recipe.file)
        .then((geo) => this.onIntroLoaded(recipe, geo))
        .catch((err) => console.error(`STL load failed: ${recipe.file}`, err));
    }

    for (const part of this.answerParts) {
      loader
        .loadAsync(MODEL_DIR + part.recipe.file)
        .then((geo) => this.onAnswerLoaded(part, geo))
        .catch((err) => console.error(`STL load failed: ${part.recipe.file}`, err));
    }
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
      opacity: 0,
      depthWrite: recipe.ghost ? false : true
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
    const inPivot = recipe.file.startsWith('wheel_');
    const entry: IntroPart = { recipe, mesh, material, center: center.clone().multiplyScalar(K), inPivot };
    this.intro.push(entry);
    if (recipe.file === 'half_shafts.stl') this.introHalfShaft = entry;
    this.loadedCount += 1;
    this.enableShadows();

    // 바퀴는 완성 후(뒷바퀴) 회전해야 하므로 즉시 피벗에 물려둔다(회전은 spinning 이후)
    if (recipe.file.startsWith('wheel_')) {
      // 바퀴는 반드시 차축선 위에서 회전 — Y·Z는 축 값으로 강제 스냅해 중심을 맞춘다
      const rear = recipe.file.startsWith('wheel_r');
      const axis = rear ? REAR_AXIS_MM : FRONT_AXIS_MM;
      this.attachWheelPivot(mesh, toThree(axis).multiplyScalar(K), recipe.file.endsWith('rl') || recipe.file.endsWith('rr') ? 1 : -1, rear);
    }
  }

  private attachWheelPivot(mesh: THREE.Mesh, axisLocal: THREE.Vector3, sign: number, rear: boolean): void {
    const pivot = new THREE.Group();
    pivot.position.set(mesh.position.x, axisLocal.y, axisLocal.z); // 바퀴 중심을 차축선(X축) 위로 스냅
    mesh.position.set(0, 0, 0);
    pivot.add(mesh);
    this.root.add(pivot);
    this.wheelPivots.push({ pivot, sign, rear });
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
    if (part === this.propShaft) {
      // 구동축 회전 가시화용 마커 — 프로펠러 샤프트 회전을 보여준다
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.17, 0.045),
        new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.5 })
      );
      pivot.add(marker);
    }
    this.root.add(pivot);
    part.pivot = pivot;
    part.mesh = mesh;
  }

  /** 가이드 반축 제거 — 같은 자리에 정답 뒤 구동축이 설치되므로 겹침 방지 */
  private removeIntroHalfShaft(): void {
    const half = this.introHalfShaft;
    if (half?.mesh) half.mesh.removeFromParent();
  }

  private updateIntro(t: number): void {
    if (this.introDone) return;

    // 진행도 복원(정답 1개 이상 설치) 상태면 인트로 없이 즉시 표시
    if (this.answerParts.some((p) => p.installed)) {
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
      // 피벗에 물린 바퀴는 로컬 원점(축 중심) 기준 상대 낙하, 루트 직속 부품은 루트 좌표 낙하
      mesh.position.y = (part.inPivot ? 0 : part.center.y) + (1 - k) * INTRO_DROP;
      part.material!.opacity = k * (part.recipe.ghost ? 0.4 : 1);
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
      mesh.position.y = part.inPivot ? 0 : part.center.y;
      part.material!.opacity = part.recipe.ghost ? 0.4 : 1;
      if (!part.recipe.ghost) part.material!.transparent = false;
    }
  }
}
