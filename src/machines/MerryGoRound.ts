// 회전놀이기구: 볼 베어링이 빠진 메리고라운드 스피너 실험실.
// 시작 시 부재(base → shaft → hub_cap → turntable → handles 순서, 요청된 등장 순서)가
// 낙하·조립 등장하고, 화면 하단 패널에서 알맞은 기계요소(정답: 축용 볼 베어링)를
// 선택하면 ball_bearing.stl이 날아와 축에 장착되고, 회전부(회전판·허브 캡·핸들·
// 베어링 볼)가 빙글빙글 회전한다. 베이스와 축은 고정부로 제자리에 남는다.
//
// 좌표계: OpenSCAD(Z-up, mm, 조립 좌표계 유지) → three.js(Y-up).
// 각 STL은 bbox 중심으로 재배치(geo.translate(-center))한 뒤 mesh.position으로 원위치 —
// 회전은 spin 그룹의 rotation.y로 축(원점) 기준 돌린다.
//
// 사실적 표현: 참조 사실진(회전 놀이기구 이미지)처럼 파란 회전판, 빨강/파랑 교차 핸들,
// 은색 링 + 금색 볼 베어링. STL은 재질이 1개뿐이므로 삼각형 무게중심의 각도/반지름으로
// 재질을 분할(geometry groups)해 색을 나눈다. 축은 불투명으로 유지해 베어링이 잘 보이게 한다.

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { BaseMachine, type MachineSim } from './types';
import { generatePlanarUVs, getGrainMaps } from '../models/surfaces';

const MODEL_DIR = '/models/merry_round/';
const ROOT_Y = 0.02;   // 베이스 바닥 높이 — 바닥면 바로 위에 안착
const K = 0.0013;      // mm → 씬 단위 (회전판 지름 2000mm → 2.6)

const INTRO_DROP = 1.1;   // 인트로 낙하 시작 높이(씬 단위)
const INTRO_DUR = 0.8;    // 부재 1개 낙하 시간(s)
const SPIN_SPEED = 0.85;  // 정답 후 회전 각속도 (rad/s) ≈ 8.1 rpm
const SPIN_RAMP = 1.8;    // 회전 속도가 최고 속도까지 올라가는 시간(s)

interface MatSpec {
  color: number;
  metalness: number;
  roughness: number;
  env?: number;
  emissive?: number;
}

interface PartRecipe {
  file: string;
  delay: number; // 인트로 시작 후 대기 시간(s) — 조립 순서
  spin: boolean; // 정답 후 함께 회전하는 부분인가
  mats: MatSpec[];
  split?: (cx: number, cy: number, cz: number) => number; // 삼각형 무게중심 → 재질 번호
  bumpScale?: number;
}

// 사실적 재질 스펙 (참조 사진 + OpenSCAD 색상 기준)
const PART_RECIPES: PartRecipe[] = [
  {
    file: 'base.stl', delay: 0.0, spin: false,
    mats: [{ color: 0x8f9399, metalness: 0.08, roughness: 0.92, env: 0.55 }] // 콘크리트 고정부
  },
  {
    file: 'shaft.stl', delay: 0.5, spin: false,
    // 불투명 유지(인트로 페이드 후 transparent=false) — 베어링 볼과 링이 잘 보이게 한다
    mats: [{ color: 0xaab0b8, metalness: 0.9, roughness: 0.34, env: 1.2 }] // 아연도금 축
  },
  {
    file: 'hub_cap.stl', delay: 1.0, spin: true,
    mats: [{ color: 0x1b2a6b, metalness: 0.4, roughness: 0.45, env: 1.0 }] // 미드나잇 블루 허브 캡
  },
  {
    file: 'turntable.stl', delay: 1.5, spin: true,
    mats: [{ color: 0x1d4fae, metalness: 0.32, roughness: 0.52, env: 0.95 }], // 로얄 블루 회전판
    bumpScale: 0.03 // 다이아몬드 tread plate 느낌
  },
  {
    file: 'handles.stl', delay: 2.0, spin: true,
    // 8개 핸들을 45° 간격으로 분할해 빨강/파랑 교차 (사진과 동일)
    mats: [
      { color: 0xc0334b, metalness: 0.35, roughness: 0.42, env: 1.0 }, // 크림슨
      { color: 0x1f6fd6, metalness: 0.35, roughness: 0.42, env: 1.0 }  // 도저 블루
    ],
    split: handleMaterialIndex
  }
];
const BEARING_RECIPE: PartRecipe = {
  file: 'ball_bearing.stl', delay: 0, spin: true,
  // 무게중심 반지름 ~70mm(볼) → 금색 볼, 그 외 → 강재 링
  mats: [
    { color: 0xcdd3da, metalness: 1.0, roughness: 0.2, env: 1.35, emissive: 0x9fb2c4 }, // 내·외륜
    { color: 0xd9a91e, metalness: 1.0, roughness: 0.16, env: 1.45, emissive: 0xd4a017 } // 볼 16개
  ],
  split: bearingMaterialIndex,
  bumpScale: 0.008
};

/** 핸들: 8개가 45° 간격 — 무게중심 각도로 번호를 매겨 홀수번은 파랑, 짝수번은 빨강 */
function handleMaterialIndex(cx: number, cy: number, _cz: number): number {
  const deg = ((Math.atan2(cy, cx) * 180) / Math.PI + 360) % 360;
  const k = Math.round(deg / 45) % 8;
  return k % 2;
}

/** 베어링: 무게중심 반지름이 볼 중심(70mm) 근처면 볼(1), 링 표면(정확히 65/75)은 링(0) */
function bearingMaterialIndex(cx: number, cy: number, _cz: number): number {
  const r = Math.hypot(cx, cy);
  return r > 68 && r < 71.5 ? 1 : 0;
}

/**
 * STL 전체가 재질 1개라서 생기는 단색 문제를 해결하는 재질 분할.
 * 삼각형 무게중심을 classify로 분류해 재질 번호별로 지오메트리 groups를 만든다.
 * (OpenSCAD 좌표계 상태에서 호출할 것 — rotateX 전)
 */
function splitByMaterial(
  geo: THREE.BufferGeometry,
  classify: (cx: number, cy: number, cz: number) => number
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!pos || !nor) throw new Error('STL geometry missing position/normal attributes');
  const triCount = Math.floor(pos.count / 3);
  const buckets: number[][] = [[], []];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    centroid.copy(a).add(b).add(c).divideScalar(3);
    buckets[classify(centroid.x, centroid.y, centroid.z)]!.push(t);
  }
  const out = new THREE.BufferGeometry();
  const posArr = new Float32Array(pos.count * 3);
  const norArr = new Float32Array(pos.count * 3);
  let v = 0;
  for (let m = 0; m < buckets.length; m++) {
    const start = v;
    for (const t of buckets[m]!) {
      for (let k = 0; k < 3; k++, v++) {
        const s = t * 3 + k;
        posArr[v * 3] = pos.getX(s);
        posArr[v * 3 + 1] = pos.getY(s);
        posArr[v * 3 + 2] = pos.getZ(s);
        norArr[v * 3] = nor.getX(s);
        norArr[v * 3 + 1] = nor.getY(s);
        norArr[v * 3 + 2] = nor.getZ(s);
      }
    }
    if (v > start) out.addGroup(start, v - start, m);
  }
  out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norArr, 3));
  return out;
}

interface MachinePart {
  recipe: PartRecipe;
  mesh: THREE.Mesh | null;
  homeY: number; // root 기준 최종 y (center*K 이후)
  materials: THREE.MeshStandardMaterial[];
}

function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

export class MerryGoRound extends BaseMachine {
  readonly id = 'merryround';
  readonly stepCount = 1;

  private root = new THREE.Group();
  private spinGroup = new THREE.Group(); // 정답 후 회전하는 부분의 부모
  private parts: MachinePart[] = [];
  private bearingMesh: THREE.Mesh | null = null;   // 장착된(또는 장착 대기) 베어링 메시
  private bearingGeometry: THREE.BufferGeometry | null = null;
  private bearingMaterials: THREE.MeshStandardMaterial[] = [];
  private bearingCenter = new THREE.Vector3();     // root 기준 베어링 중심(K 적용)
  private bearingLoaded = false;
  private pendingInstall = false;                  // 베어링이 선택됐지만 STL 로드 전일 때
  private installedFlag = false;
  private loadedCount = 0;
  private introStart = -1;                         // 구조 부재 전체 로드 시점의 clock t
  private introDone = false;
  private bearingFlashStart = -1;
  private spinning = false;
  private spinTime = 0;                            // 회전 램프업용 경과 시간
  private lastT = -1;

  constructor() {
    super();
    this.root.position.set(0, ROOT_Y, 0);
    this.group.add(this.root);
    this.root.add(this.spinGroup);
    this.buildGroundDisc();
    // 베어링 자리(축 둘레, 베이스 상면 z120 ↔ 지지판 하면 z180 사이)를 감싸는 수평 펄스 링
    this.addSlot(
      0,
      0.092,
      new THREE.Vector3(0, ROOT_Y + 150 * K, 0),
      0.03
    );
    const slot = this.slots[0];
    if (slot) slot.rotation.x = -Math.PI / 2;
    this.loadModels();
    this.enableShadows();
  }

  // ── Machine 인터페이스 ──

  isInstalled(_step: number): boolean {
    return this.installedFlag;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, ROOT_Y, 0).add(this.bearingCenter);
  }

  slotTarget(_step: number): THREE.Vector3 {
    return this.getFlyTarget(0);
  }

  buildStepModel(_step: number): THREE.Group {
    const group = new THREE.Group();
    if (this.bearingGeometry && this.bearingMaterials.length > 0) {
      group.add(this.createBearingMesh());
    }
    return group;
  }

  installStep(_step: number, model: THREE.Group): void {
    this.installedFlag = true;
    this.hideSlot(0);
    this.bearingFlashStart = -2; // update에서 현재 t로 갱신
    this.spinning = true;        // 정답! 회전 놀이기구가 돌기 시작한다
    this.spinTime = 0;
    const flown = model.children[0] as THREE.Mesh | undefined;
    if (flown && this.bearingLoaded) {
      // 비행으로 도착한 메시를 채택 — 루트 기준 최종 자세로 리셋 (위치 이중 오프셋 방지)
      flown.position.copy(this.bearingCenter);
      flown.rotation.set(0, 0, 0);
      flown.scale.setScalar(K);
      this.spinGroup.add(flown);
      this.bearingMesh = flown;
    } else {
      this.pendingInstall = true; // STL 로드 완료 시 attachBearingMesh에서 체결
    }
    model.removeFromParent();
    this.enableShadows();
  }

  reset(): void {
    this.installedFlag = false;
    this.pendingInstall = false;
    this.spinning = false;
    this.spinTime = 0;
    this.spinGroup.rotation.y = 0;
    if (this.bearingMesh) {
      this.bearingMesh.removeFromParent();
      this.bearingMesh = null;
    }
    this.showSlot(0);
    this.introStart = -1;
    this.introDone = false;
    this.bearingFlashStart = -1;
    this.lastT = -1;
    for (const part of this.parts) {
      if (part.mesh) {
        part.mesh.visible = false;
        part.materials.forEach((m) => {
          m.transparent = true;
          m.opacity = 0;
        });
      }
    }
  }

  update(t: number): void {
    super.update(t);
    const dt = this.lastT < 0 ? 0 : Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.updateIntro(t);
    this.updateBearingFlash(t);
    if (this.spinning && this.introDone) {
      this.spinTime += dt;
      const ramp = easeOutCubic(Math.min(1, this.spinTime / SPIN_RAMP));
      this.spinGroup.rotation.y += dt * SPIN_SPEED * ramp;
    }
  }

  createSim(): MachineSim {
    const rpm = (SPIN_SPEED * 60) / (2 * Math.PI);
    return {
      update: (_dt: number) => {},
      getDisplay: () => [
        { label: '핵심 요소', value: '볼 베어링', tone: 'blue' },
        { label: '대분류', value: '축용' },
        { label: '베어링 볼', value: '16', unit: '개' },
        { label: '회전 속도', value: rpm.toFixed(1), unit: 'rpm' }
      ]
    };
  }

  // ── 씬 구성 ──

  /** 회전판 아래 바닥에 깔린 놀이터 고무매트 느낌의 원형 패드 */
  private buildGroundDisc(): void {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.02, 48),
      new THREE.MeshStandardMaterial({ color: 0x7fc4b2, roughness: 0.96, metalness: 0 })
    );
    pad.position.y = 0.01;
    pad.receiveShadow = true;
    this.group.add(pad);
  }

  private loadModels(): void {
    const loader = new STLLoader();

    for (const recipe of PART_RECIPES) {
      loader
        .loadAsync(MODEL_DIR + recipe.file)
        .then((geo) => this.onPartLoaded(recipe, geo))
        .catch((err) => console.error(`STL load failed: ${recipe.file}`, err));
    }

    loader
      .loadAsync(MODEL_DIR + BEARING_RECIPE.file)
      .then((geo) => this.onBearingLoaded(geo))
      .catch((err) => console.error(`STL load failed: ${BEARING_RECIPE.file}`, err));
  }

  /** OpenSCAD(Z-up, mm) → three.js(Y-up) 회전 + (재질 분할) + UV 생성 후 bbox 중심 재배치 */
  private prepareGeometry(
    recipe: PartRecipe,
    srcGeo: THREE.BufferGeometry
  ): { geo: THREE.BufferGeometry; center: THREE.Vector3 } {
    const geo = recipe.split ? splitByMaterial(srcGeo, recipe.split) : srcGeo;
    geo.rotateX(-Math.PI / 2);
    generatePlanarUVs(geo);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (!bb) throw new Error('STL bounding box missing');
    const center = bb.getCenter(new THREE.Vector3());
    geo.translate(-center.x, -center.y, -center.z);
    return { geo, center };
  }

  private makeMaterials(recipe: PartRecipe): THREE.MeshStandardMaterial[] {
    const grain = getGrainMaps();
    return recipe.mats.map((spec) => new THREE.MeshStandardMaterial({
      color: spec.color,
      metalness: spec.metalness,
      roughness: spec.roughness,
      roughnessMap: grain.roughness,
      bumpMap: grain.bump,
      bumpScale: recipe.bumpScale ?? 0.015,
      envMapIntensity: spec.env ?? 1.0,
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0
    }));
  }

  private onPartLoaded(recipe: PartRecipe, loadedGeo: THREE.BufferGeometry): void {
    const { geo, center } = this.prepareGeometry(recipe, loadedGeo);
    const materials = this.makeMaterials(recipe);
    const mesh = new THREE.Mesh(
      geo,
      materials.length > 1 ? materials : materials[0]!
    );
    mesh.scale.setScalar(K);
    mesh.castShadow = true;
    const homeY = center.y * K;
    mesh.position.set(center.x * K, homeY, center.z * K);
    // 진행도 복원(체결 완료 상태)이면 인트로 없이 바로 표시
    mesh.visible = this.installedFlag;
    if (mesh.visible) {
      materials.forEach((m) => {
        m.opacity = 1;
        m.transparent = false;
      });
    }
    (recipe.spin ? this.spinGroup : this.root).add(mesh);
    this.parts.push({ recipe, mesh, homeY, materials });
    this.loadedCount += 1;
    this.enableShadows();
  }

  private onBearingLoaded(loadedGeo: THREE.BufferGeometry): void {
    const { geo, center } = this.prepareGeometry(BEARING_RECIPE, loadedGeo);
    this.bearingGeometry = geo;
    this.bearingMaterials = this.makeMaterials(BEARING_RECIPE);
    this.bearingCenter.copy(center.multiplyScalar(K));
    this.bearingLoaded = true;
    if (this.pendingInstall) {
      this.attachBearingMesh();
    }
  }

  private createBearingMesh(): THREE.Mesh {
    if (!this.bearingGeometry || this.bearingMaterials.length === 0) {
      throw new Error('Bearing STL not loaded');
    }
    const mesh = new THREE.Mesh(this.bearingGeometry, this.bearingMaterials);
    mesh.scale.setScalar(K);
    mesh.castShadow = true;
    return mesh;
  }

  private attachBearingMesh(): void {
    const mesh = this.createBearingMesh();
    mesh.position.copy(this.bearingCenter);
    this.spinGroup.add(mesh);
    this.bearingMesh = mesh;
    this.pendingInstall = false;
    this.enableShadows();
  }

  private updateIntro(t: number): void {
    if (this.introDone) return;

    // 진행도 복원(이미 체결됨)이면 인트로 없이 즉시 완성 상태로 표시
    if (this.installedFlag) {
      this.finishIntro();
      return;
    }
    if (this.introStart < 0) {
      if (this.loadedCount >= PART_RECIPES.length) this.introStart = t;
      return;
    }

    let allDone = true;
    for (const part of this.parts) {
      const mesh = part.mesh;
      if (!mesh) continue;
      const e = Math.min(1, Math.max(0, (t - this.introStart - part.recipe.delay) / INTRO_DUR));
      const k = easeOutCubic(e);
      mesh.visible = e > 0;
      mesh.position.y = part.homeY + (1 - k) * INTRO_DROP;
      part.materials.forEach((m) => {
        m.opacity = k;
      });
      if (e < 1) allDone = false;
    }
    if (allDone && this.parts.length === PART_RECIPES.length) this.finishIntro();
  }

  private finishIntro(): void {
    this.introDone = true;
    for (const part of this.parts) {
      const mesh = part.mesh;
      if (!mesh) continue;
      mesh.visible = true;
      mesh.position.y = part.homeY;
      part.materials.forEach((m) => {
        m.opacity = 1;
        m.transparent = false; // 축 등 고정부는 불투명 유지 — 베어링이 잘 보이게
      });
    }
  }

  private updateBearingFlash(t: number): void {
    if (this.bearingFlashStart < -1) {
      this.bearingFlashStart = t; // installStep에서 설정된 플래그
    }
    if (this.bearingFlashStart < 0 || this.bearingMaterials.length === 0) return;
    const elapsed = t - this.bearingFlashStart;
    const intensity = Math.max(0, 1.1 - elapsed * 1.1);
    this.bearingMaterials.forEach((m) => {
      m.emissiveIntensity = 0.08 + intensity;
    });
    if (intensity <= 0) {
      this.bearingMaterials.forEach((m) => {
        m.emissiveIntensity = 0.08;
      });
      this.bearingFlashStart = -1;
    }
  }
}
