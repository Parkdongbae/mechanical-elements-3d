// 공용 PBR 재질 라이브러리 (v2)
// 모든 절차 모델·STL 기계는 여기 재질만 사용해 화면 전체의 질감을 통일한다.
// 각 함수는 호출마다 "새" 재질을 반환한다(텍스처만 공유) — 기계 코드가 emissive/opacity를
// 개별 변조하고 disposeObject가 재질을 해제하기 때문에 재질 인스턴스 공유는 금지.

import * as THREE from 'three';

export interface MatOpts {
  color?: number;
  roughness?: number;
  metalness?: number;
  /** 표면 미세 질감(러프니스/범프 맵) 사용 여부. UV 없는 지오메트리는 false 권장 */
  grain?: boolean;
}

/** 교육용 색 체계 — 기계요소 4대분류 강조색(슬롯·라벨·UI와 동일 톤) */
export const CATEGORY_COLORS = {
  joining: 0xf08a24,
  shaft: 0x2f8fdd,
  control: 0x9b5de5,
  power: 0xe5484d
} as const;

export const PALETTE = {
  steel: 0xc3ccd6,
  darkSteel: 0x58626d,
  chrome: 0xf2f5f8,
  castIron: 0x3a4047,
  aluminum: 0xd9dee4,
  brass: 0xd4a94a,
  bronze: 0xb07a3c,
  copper: 0xc87545,
  rubber: 0x1b1d21,
  blackPlastic: 0x23262b,
  wood: 0xb98552,
  paintRed: 0xd8362f,
  paintBlue: 0x2468c9,
  paintYellow: 0xf2b619,
  paintGreen: 0x2f9e6b,
  paintWhite: 0xeef1f4,
  paintGray: 0x7d8792
} as const;

// ── 공유 텍스처 (1회 생성) ──

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [canvas, ctx];
}

function finish(canvas: HTMLCanvasElement, repeat: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

let _micro: THREE.CanvasTexture | null = null;
/** 미세 노이즈(주조·도장·고무 표면) — 러프니스/범프 겸용 */
export function microNoiseMap(): THREE.CanvasTexture {
  if (_micro) return _micro;
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 205 + Math.random() * 50;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  _micro = finish(canvas, 3);
  return _micro;
}

let _brushed: THREE.CanvasTexture | null = null;
/** 한 방향 헤어라인(가공된 강재 표면) — 러프니스/범프 겸용 */
export function brushedMap(): THREE.CanvasTexture {
  if (_brushed) return _brushed;
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  ctx.fillStyle = '#e6e6e6';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const base = 215 + Math.random() * 40;
    ctx.fillStyle = `rgb(${base | 0},${base | 0},${base | 0})`;
    ctx.fillRect(0, y, size, 1);
    for (let k = 0; k < 6; k++) {
      const v = base + (Math.random() - 0.5) * 50;
      const c = Math.max(150, Math.min(255, v)) | 0;
      ctx.fillStyle = `rgb(${c},${c},${c})`;
      ctx.fillRect(Math.random() * size, y, 20 + Math.random() * 90, 1);
    }
  }
  _brushed = finish(canvas, 2);
  return _brushed;
}

function metal(
  defaults: { color: number; roughness: number; metalness: number },
  opts: MatOpts,
  map: 'brushed' | 'micro' | 'none'
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: opts.color ?? defaults.color,
    roughness: opts.roughness ?? defaults.roughness,
    metalness: opts.metalness ?? defaults.metalness
  });
  if (opts.grain !== false && map !== 'none') {
    const tex = map === 'brushed' ? brushedMap() : microNoiseMap();
    m.roughnessMap = tex;
    m.bumpMap = tex;
    m.bumpScale = map === 'brushed' ? 0.25 : 0.4;
  }
  return m;
}

// ── 금속 ──

/** 가공된 밝은 강재 (축, 핀, 볼트) */
export const steel = (o: MatOpts = {}) => metal({ color: PALETTE.steel, roughness: 0.34, metalness: 1 }, o, 'brushed');
/** 어두운 강재 / 흑착색 (허브, 체인 플레이트) */
export const darkSteel = (o: MatOpts = {}) => metal({ color: PALETTE.darkSteel, roughness: 0.42, metalness: 1 }, o, 'brushed');
/** 크롬 도금 / 연마면 (베어링 볼, 림) */
export const chrome = (o: MatOpts = {}) => metal({ color: PALETTE.chrome, roughness: 0.08, metalness: 1 }, o, 'none');
/** 주철 (엔진 블록, 캘리퍼 바디, 받침대) */
export const castIron = (o: MatOpts = {}) => metal({ color: PALETTE.castIron, roughness: 0.72, metalness: 0.75 }, o, 'micro');
/** 알루미늄 (하우징, 프레임) */
export const aluminum = (o: MatOpts = {}) => metal({ color: PALETTE.aluminum, roughness: 0.45, metalness: 0.95 }, o, 'brushed');
/** 황동 (기어) */
export const brass = (o: MatOpts = {}) => metal({ color: PALETTE.brass, roughness: 0.3, metalness: 1 }, o, 'brushed');
/** 청동 (웜 휠, 부싱) */
export const bronze = (o: MatOpts = {}) => metal({ color: PALETTE.bronze, roughness: 0.38, metalness: 1 }, o, 'brushed');
/** 구리 (모터 권선) */
export const copper = (o: MatOpts = {}) => metal({ color: PALETTE.copper, roughness: 0.32, metalness: 1 }, o, 'none');

// ── 비금속 ──

/** 고무 (타이어, 벨트, 브레이크 패드) */
export function rubber(o: MatOpts = {}): THREE.MeshStandardMaterial {
  return metal({ color: PALETTE.rubber, roughness: 0.88, metalness: 0 }, o, 'micro');
}

/** 광택 도장 (자전거 프레임, 차체) — 클리어코트 */
export function paint(color: number = PALETTE.paintRed, o: MatOpts = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: o.color ?? color,
    roughness: o.roughness ?? 0.42,
    metalness: o.metalness ?? 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.12
  });
}

/** 플라스틱 (커버, 손잡이, 장난감 부품) */
export function plastic(color: number = PALETTE.blackPlastic, o: MatOpts = {}): THREE.MeshStandardMaterial {
  return metal({ color: o.color ?? color, roughness: o.roughness ?? 0.55, metalness: o.metalness ?? 0 }, { ...o, color: o.color ?? color }, 'micro');
}

/** 목재 (오토마타 상자, 손잡이) */
export function wood(color: number = PALETTE.wood, o: MatOpts = {}): THREE.MeshStandardMaterial {
  return metal({ color: o.color ?? color, roughness: o.roughness ?? 0.7, metalness: 0 }, { ...o, color: o.color ?? color }, 'brushed');
}

/** 유리 / 투명 커버 (시계 유리, 자동차 앞유리, 투명 하우징) */
export function glass(color = 0xcfe8ff, opacity = 0.22): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide
  });
}

/** 내부가 비쳐 보이는 반투명 하우징(ghost) */
export function ghost(color = 0x9fb4c8, opacity = 0.35): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    opacity,
    depthWrite: false
  });
}

/** 발광 강조(슬롯 링, 회전 마커, 정답 플래시) */
export function glow(color: number, intensity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0 });
}
