// 철골공사: 볼트가 빠진 철골 기둥-들보 접합 구조물 실험실.
// 시작 시 구조 부재(하부 기둥 → 상부 기둥 → 이음 칼라/연결판 → H형 들보)가
// 순차적으로 낙하·조립 등장하고, 화면 하단 패널에서 알맞은 기계요소
// (정답: 결합용 나사(볼트와 너트))를 선택하면 bolts_nuts.stl이 날아와 체결된다.
//
// 좌표계: OpenSCAD(Z-up, mm, 조립 좌표계 유지) → three.js(Y-up).
// 각 STL은 bbox 중심으로 재배치(geo.translate(-center))한 뒤 mesh.position으로 원위치 —
// FlyTask가 모델을 자기 중심 기준으로 회전시켜도 부품이 크게 흔들리지 않는다.

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { BaseMachine, type MachineSim } from './types';

const MODEL_DIR = '/models/bolt_nut/';
const ROOT_Y = 1.16;      // 씬 기준: 기둥 접합부(OpenSCAD 원점) 높이 — 하부 기둥 바닥이 받침대(0.12) 위에 안착
const K = 0.0026;         // mm → 씬 단위 (전체 폭 1000mm → 2.6)
const PLINTH_TOP = 0.12;  // 콘크리트 받침대 상면 높이

const INTRO_DROP = 1.1;   // 인트로 낙하 시작 높이(씬 단위)
const INTRO_DUR = 0.8;    // 부재 1개 낙하 시간(s)

interface PartRecipe {
  file: string;
  color: number;
  metalness: number;
  roughness: number;
  delay: number; // 인트로 시작 후 대기 시간(s) — 시공 순서
}

// 사실적 강재 재질: 아연도금 강관 기둥 / 도장 강재 / 레드옥사이드 프라이머 접합판 / H형강
const STRUCTURE_RECIPES: PartRecipe[] = [
  { file: 'lower_column.stl', color: 0x99a3ad, metalness: 0.88, roughness: 0.34, delay: 0.0 },
  { file: 'upper_column.stl', color: 0x5c88ae, metalness: 0.82, roughness: 0.38, delay: 0.5 },
  { file: 'connection_plates.stl', color: 0x9e3a30, metalness: 0.35, roughness: 0.58, delay: 1.0 },
  { file: 'horizontal_beams.stl', color: 0x2f6f6a, metalness: 0.78, roughness: 0.42, delay: 1.5 }
];
const BOLT_RECIPE: PartRecipe = { file: 'bolts_nuts.stl', color: 0xd4a017, metalness: 0.92, roughness: 0.26, delay: 0 };

interface StructurePart {
  recipe: PartRecipe;
  mesh: THREE.Mesh | null;
  homeY: number; // root 기준 최종 y (center*K 이후)
  material: THREE.MeshStandardMaterial;
}

function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

/**
 * 강재 표면 그레인: 평면 면 위에서도 환경 반사가 미세하게 깨져 보이도록
 * 브러시드 메탈 러프니스/범프 맵을 캔버스로 생성한다 (수평 압연 스트릭 + 노이즈).
 * 러프니스 맵은 roughness 값과 곱해지므로 대부분 1에 가깝게 유지한다.
 */
let grainMaps: { roughness: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;
function getGrainMaps(): { roughness: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  if (grainMaps) return grainMaps;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const streak = (Math.random() - 0.5) * 46;
      const spot = (Math.random() - 0.5) * 60;
      const v = Math.max(158, Math.min(255, 242 + streak + spot));
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const roughness = new THREE.CanvasTexture(canvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  const bump = roughness.clone();
  bump.needsUpdate = true;
  grainMaps = { roughness, bump };
  return grainMaps;
}

/**
 * STL 지오메트리에는 UV가 없어 텍스처 맵이 단일 텍셀만 샘플링한다.
 * 법선의 지배축에 맞춰 좌표를 그대로 UV로 투영(플래너 트리플래너)해
 * 면 전체에서 그레인 맵이 변화하도록 UV를 생성한다.
 */
function generatePlanarUVs(geo: THREE.BufferGeometry, scaleMM = 60): void {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!pos || !nor) throw new Error('STL geometry missing position/normal attributes');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ny >= nz) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u / scaleMM;
    uv[i * 2 + 1] = v / scaleMM;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class SteelFrame extends BaseMachine {
  readonly id = 'steelframe';
  readonly stepCount = 1;

  private root = new THREE.Group();
  private structure: StructurePart[] = [];
  private boltMesh: THREE.Mesh | null = null;      // 체결된(또는 체결 대기) 볼트 메시
  private boltGeometry: THREE.BufferGeometry | null = null;
  private boltMaterial: THREE.MeshStandardMaterial | null = null;
  private boltCenter = new THREE.Vector3();        // root 기준 볼트 중심(K 적용)
  private boltLoaded = false;
  private pendingInstall = false;                  // 볼트가 선택됐지만 STL 로드 전일 때
  private installedFlag = false;
  private loadedCount = 0;
  private introStart = -1;                         // 구조 부재 전체 로드 시점의 clock t
  private introDone = false;
  private boltFlashStart = -1;

  constructor() {
    super();
    this.root.position.set(0, ROOT_Y, 0);
    this.group.add(this.root);
    this.buildPlinth();
    this.addSlot(
      0,
      0.55,
      new THREE.Vector3(0, ROOT_Y, 0),
      0.028
    );
    const slot = this.slots[0];
    if (slot) slot.rotation.x = -Math.PI / 2; // 접합부를 감싸는 수평 펄스 링
    this.loadModels();
    this.enableShadows();
  }

  // ── Machine 인터페이스 ──

  isInstalled(_step: number): boolean {
    return this.installedFlag;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, ROOT_Y, 0).add(this.boltCenter);
  }

  slotTarget(_step: number): THREE.Vector3 {
    return this.getFlyTarget(0);
  }

  buildStepModel(_step: number): THREE.Group {
    const group = new THREE.Group();
    if (this.boltGeometry && this.boltMaterial) {
      const mesh = new THREE.Mesh(this.boltGeometry, this.boltMaterial);
      mesh.scale.setScalar(K);
      mesh.castShadow = true;
      group.add(mesh);
    }
    return group;
  }

  installStep(_step: number, model: THREE.Group): void {
    this.installedFlag = true;
    this.hideSlot(0);
    this.boltFlashStart = -2; // update에서 현재 t로 갱신
    const flown = model.children[0] as THREE.Mesh | undefined;
    if (flown && this.boltLoaded) {
      // 비행으로 도착한 메시를 채택 — 루트 기준 최종 자세로 리셋 (과거 위치 이중 오프셋 버그 방지)
      flown.position.copy(this.boltCenter);
      flown.rotation.set(0, 0, 0);
      flown.scale.setScalar(K);
      this.root.add(flown);
      this.boltMesh = flown;
    } else {
      this.pendingInstall = true; // STL 로드 완료 시 attachBoltMesh에서 체결
    }
    model.removeFromParent();
    this.enableShadows();
  }

  reset(): void {
    this.installedFlag = false;
    this.pendingInstall = false;
    if (this.boltMesh) {
      this.boltMesh.removeFromParent();
      this.boltMesh = null;
    }
    this.showSlot(0);
    this.introStart = -1;
    this.introDone = false;
    this.boltFlashStart = -1;
    for (const part of this.structure) {
      if (part.mesh) {
        part.mesh.visible = false;
        part.material.transparent = true;
        part.material.opacity = 0;
      }
    }
  }

  update(t: number): void {
    super.update(t);
    this.updateIntro(t);
    this.updateBoltFlash(t);
  }

  private updateIntro(t: number): void {
    if (this.introDone) return;

    // 진행도 복원(이미 체결됨)이면 인트로 없이 즉시 완성 상태로 표시
    if (this.installedFlag) {
      this.finishIntro();
      return;
    }
    if (this.introStart < 0) {
      if (this.loadedCount >= STRUCTURE_RECIPES.length) this.introStart = t;
      return;
    }

    let allDone = true;
    for (const part of this.structure) {
      const mesh = part.mesh;
      if (!mesh) continue;
      const e = Math.min(1, Math.max(0, (t - this.introStart - part.recipe.delay) / INTRO_DUR));
      const k = easeOutCubic(e);
      mesh.visible = e > 0;
      mesh.position.y = part.homeY + (1 - k) * INTRO_DROP;
      part.material.opacity = k;
      if (e < 1) allDone = false;
    }
    if (allDone && this.structure.length === STRUCTURE_RECIPES.length) this.finishIntro();
  }

  private finishIntro(): void {
    this.introDone = true;
    for (const part of this.structure) {
      const mesh = part.mesh;
      if (!mesh) continue;
      mesh.visible = true;
      mesh.position.y = part.homeY;
      part.material.opacity = 1;
      part.material.transparent = false;
    }
  }

  private updateBoltFlash(t: number): void {
    if (this.boltFlashStart < -1) {
      this.boltFlashStart = t; // installStep에서 설정된 플래그
    }
    if (this.boltFlashStart < 0 || !this.boltMaterial) return;
    const elapsed = t - this.boltFlashStart;
    const intensity = Math.max(0, 1.1 - elapsed * 1.1);
    this.boltMaterial.emissiveIntensity = 0.08 + intensity;
    if (intensity <= 0) {
      this.boltMaterial.emissiveIntensity = 0.08;
      this.boltFlashStart = -1;
    }
  }

  createSim(): MachineSim {
    return {
      update: (_dt: number) => {},
      getDisplay: () => [
        { label: '체결 요소', value: '볼트 + 너트' },
        { label: '체결 개소', value: '56', unit: '개소' },
        { label: '접합 방식', value: '나사 결합' }
      ]
    };
  }

  // ── 씬 구성 ──

  private buildPlinth(): void {
    const concrete = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, PLINTH_TOP, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xb5afa4, roughness: 0.95, metalness: 0 })
    );
    concrete.position.set(0, PLINTH_TOP / 2, 0);
    concrete.receiveShadow = true;
    concrete.castShadow = true;
    this.group.add(concrete);
  }

  private loadModels(): void {
    const loader = new STLLoader();

    for (const recipe of STRUCTURE_RECIPES) {
      loader
        .loadAsync(MODEL_DIR + recipe.file)
        .then((geo) => this.onStructureLoaded(recipe, geo))
        .catch((err) => console.error(`STL load failed: ${recipe.file}`, err));
    }

    loader
      .loadAsync(MODEL_DIR + BOLT_RECIPE.file)
      .then((geo) => this.onBoltLoaded(geo))
      .catch((err) => console.error(`STL load failed: ${BOLT_RECIPE.file}`, err));
  }

  /** OpenSCAD(Z-up, mm) → three.js(Y-up) 회전 후 bbox 중심 재배치 정보 계산 */
  private prepareGeometry(geo: THREE.BufferGeometry): { center: THREE.Vector3; size: THREE.Vector3 } {
    geo.rotateX(-Math.PI / 2);
    generatePlanarUVs(geo);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (!bb) throw new Error('STL bounding box missing');
    const center = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    geo.translate(-center.x, -center.y, -center.z);
    return { center, size };
  }

  private onStructureLoaded(recipe: PartRecipe, geo: THREE.BufferGeometry): void {
    const { center } = this.prepareGeometry(geo);
    const grain = getGrainMaps();
    const material = new THREE.MeshStandardMaterial({
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
    const mesh = new THREE.Mesh(geo, material);
    mesh.scale.setScalar(K);
    mesh.castShadow = true;
    const homeY = center.y * K;
    mesh.position.set(center.x * K, homeY, center.z * K);
    // 진행도 복원(체결 완료 상태)이면 인트로 없이 바로 표시
    mesh.visible = this.installedFlag;
    if (mesh.visible) {
      material.opacity = 1;
      material.transparent = false;
    }
    this.root.add(mesh);
    this.structure.push({ recipe, mesh, homeY, material });
    this.loadedCount += 1;
    this.enableShadows();
  }

  private onBoltLoaded(geo: THREE.BufferGeometry): void {
    const { center } = this.prepareGeometry(geo);
    this.boltGeometry = geo;
    this.boltMaterial = new THREE.MeshStandardMaterial({
      color: BOLT_RECIPE.color,
      metalness: BOLT_RECIPE.metalness,
      roughness: BOLT_RECIPE.roughness,
      roughnessMap: getGrainMaps().roughness,
      bumpMap: getGrainMaps().bump,
      bumpScale: 0.012,
      envMapIntensity: 1.3,
      emissive: BOLT_RECIPE.color,
      emissiveIntensity: 0.08
    });
    this.boltCenter.copy(center.multiplyScalar(K));
    this.boltLoaded = true;
    if (this.pendingInstall) {
      this.attachBoltMesh();
    }
  }

  private attachBoltMesh(): void {
    if (!this.boltGeometry || !this.boltMaterial) return;
    const mesh = new THREE.Mesh(this.boltGeometry, this.boltMaterial);
    mesh.scale.setScalar(K);
    mesh.position.copy(this.boltCenter);
    mesh.castShadow = true;
    this.root.add(mesh);
    this.boltMesh = mesh;
    this.pendingInstall = false;
    this.enableShadows();
  }
}
