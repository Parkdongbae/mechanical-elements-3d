// STL 사실감 공용 헬퍼: 브러시드 메탈 그레인 맵 + 플래너 UV 생성.
// SteelFrame / MerryGoRound 등 STL 파트 머신들이 공유한다.

import * as THREE from 'three';

/**
 * 강재/도장 표면 그레인: 평면 면 위에서도 환경 반사가 미세하게 깨져 보이도록
 * 브러시드 메탈 러프니스/범프 맵을 캔버스로 생성한다 (수평 압연 스트릭 + 노이즈).
 * 러프니스 맵은 roughness 값과 곱해지므로 대부분 1에 가깝게 유지한다.
 */
let grainMaps: { roughness: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;
export function getGrainMaps(): { roughness: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
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
export function generatePlanarUVs(geo: THREE.BufferGeometry, scaleMM = 60): void {
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
