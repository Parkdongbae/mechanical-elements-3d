// 절차적(procedural) 기계요소 3D 모델 팩토리
// GLB 파일 없이 Three.js 지오메트리만으로 모든 기계요소를 생성합니다.
// 실제 형상 코드는 ./parts/* 에 있고, 이 파일은 공용 API(기계 파일들이 import)와 조립만 담당한다.

import * as THREE from 'three';
import type { BuilderId } from '../data/elements';
import { buildBolt, buildPinParallel, buildPinTaper, buildPinSplit } from './parts/joining';
import { buildAxle, buildDriveShaft, buildCrankShaft, buildBearing } from './parts/shafts';
import { buildSpring, buildBlockBrake, buildDiscBrake } from './parts/control';
import {
  buildFrictionWheel,
  buildSpurGear,
  buildHelicalGear,
  buildBevelGear,
  buildWormGear,
  buildRackPinion,
  buildBeltPulley,
  buildSprocket,
  buildChain,
  buildCam,
  buildLink
} from './parts/power';

export { gearShape, buildSpurGearMesh, buildHelicalGearMesh, buildBevelGearMesh } from './parts/gears';
export { ChainPath2D, buildChainAlongPath } from './parts/chain';

// ─────────────────────────── 재질 헬퍼 (호환용) ───────────────────────────

/** v1 호환용 단색 재질. 새 코드는 materials.ts 함수를 쓴다. */
export function mat(color: number, metalness = 0.75, roughness = 0.38): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

// ─────────────────────────── 공용 인터페이스 ───────────────────────────

const BUILDERS: Record<BuilderId, () => THREE.Group> = {
  bolt: buildBolt,
  pinParallel: buildPinParallel,
  pinTaper: buildPinTaper,
  pinSplit: buildPinSplit,
  axle: buildAxle,
  driveShaft: buildDriveShaft,
  crankShaft: buildCrankShaft,
  bearing: buildBearing,
  spring: buildSpring,
  blockBrake: buildBlockBrake,
  discBrake: buildDiscBrake,
  frictionWheel: buildFrictionWheel,
  spurGear: buildSpurGear,
  helicalGear: buildHelicalGear,
  bevelGear: buildBevelGear,
  wormGear: buildWormGear,
  rackPinion: buildRackPinion,
  beltPulley: buildBeltPulley,
  sprocket: buildSprocket,
  chain: buildChain,
  cam: buildCam,
  link: buildLink
};

export function buildPart(builder: BuilderId): THREE.Group {
  const fn = BUILDERS[builder];
  if (!fn) throw new Error(`Unknown builder: ${builder}`);
  const g = fn();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

/** 부품을 target 크기(최대 변 기준)로 스케일하고 중심을 원점에 맞춘 래퍼 Group으로 감싸기 */
export function normalizePart(part: THREE.Group, target = 1.7): THREE.Group {
  const box = new THREE.Box3().setFromObject(part);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const inner = new THREE.Group();
  inner.add(part);
  inner.scale.setScalar(target / maxDim);
  const box2 = new THREE.Box3().setFromObject(inner);
  const center = box2.getCenter(new THREE.Vector3());
  inner.position.sub(center);
  const wrapper = new THREE.Group();
  wrapper.add(inner);
  return wrapper;
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
  });
}
