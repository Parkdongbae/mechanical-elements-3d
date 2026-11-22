// STL 기계 8종(GearHunt·SteelFrame·MerryGoRound·Drivetrain*) 공용 헬퍼:
// 셰이딩 보정, 부품별 공용 재질 선택, 통일된 라벨/지시선.
// 형상·좌표·회전 부호는 여기서 건드리지 않는다 — 재질·음영·보조 요소만 담당.

import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { aluminum, castIron, darkSteel, plastic, rubber, steel } from '../models/materials';
import { generatePlanarUVs } from '../models/surfaces';

/**
 * STL은 면 법선(flat)이라 원통이 각져 보인다. 인접 면 각도가 crease 이하인 정점만 법선을
 * 평균(곡면은 매끈, 모서리는 날카롭게)하고, 그레인 맵용 플래너 UV를 만든다.
 * toCreasedNormals는 비인덱스 지오메트리를 제자리에서 처리하므로 geometry.groups(재질 분할)가 유지된다.
 * 반드시 rotateX 이후, translate(bbox 중심) 이전/이후 어느 쪽이든 무방(법선·UV는 위치 이동에 불변).
 */
export function smoothSTL(geo: THREE.BufferGeometry, creaseDeg = 35, uvScaleMM = 60): THREE.BufferGeometry {
  toCreasedNormals(geo, (creaseDeg * Math.PI) / 180);
  generatePlanarUVs(geo, uvScaleMM);
  return geo;
}

// ── 공용 재질 선택 ──

/** 원색 레시피를 금속 재질 쪽으로 섞는다 — 부품 구분용 색조(라벨 색과 대응)는 남기되 금속 질감이 우선 */
function tint(base: number, recipeColor: number, amount: number): number {
  return new THREE.Color(base).lerp(new THREE.Color(recipeColor), amount).getHex();
}

/**
 * 자동차 구동방식 STL 부품 → 공용 재질. 파일명으로 부품 종류를 판별한다.
 * 모든 반환 재질은 호출마다 새 인스턴스(인트로 페이드·플래시 emissive를 개별 변조하기 때문).
 */
export function drivetrainMaterial(file: string, recipeColor: number): THREE.MeshStandardMaterial {
  const f = file.toLowerCase();
  if (f.startsWith('wheel_')) return rubber();
  if (f.includes('engine')) return castIron({ color: tint(0x3a4047, recipeColor, 0.65) });
  if (f.includes('transmission') || f.includes('transaxle')) return aluminum({ color: tint(0xd9dee4, recipeColor, 0.8) });
  if (f.includes('differential') || f.includes('center_diff')) return castIron({ color: tint(0x555c64, recipeColor, 0.5), roughness: 0.6 });
  if (f.includes('motor')) return aluminum({ color: tint(0xcdd3da, recipeColor, 0.45), roughness: 0.38 });
  if (f.includes('battery')) return plastic(tint(0x23262b, recipeColor, 0.55), { roughness: 0.45 });
  if (f.includes('propeller')) return darkSteel({ color: tint(0x58626d, recipeColor, 0.5) });
  // 차축·구동축·반축
  return steel({ color: tint(0xc3ccd6, recipeColor, 0.5), roughness: 0.3 });
}

/** 인트로 페이드용으로 투명 상태로 만든다(finishIntro에서 transparent=false로 복귀) */
export function startTransparent(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.transparent = true;
  m.opacity = 0;
  return m;
}

// ── 라벨 ──

// 장면이 선형 공간(HalfFloat)에서 합성된 뒤 sRGB 변환되어 알파 0.85는 회색으로 떠 보인다 → 0.95로 보정해 '짙은 남색 85%' 체감을 맞춘다
const LABEL_BG = 'rgba(15, 23, 42, 0.95)';

/**
 * 둥근 알약형 캔버스 스프라이트 라벨: 짙은 남색 85% 배경 + 흰 글자(700) + 부품 색 테두리.
 * 캔버스는 화면 크기의 2배 해상도(512px 폭)로 그려 확대해도 흐려지지 않게 한다.
 * layers.set(1) — 라벨 토글 대상.
 * @param accent 부품 색(CSS 문자열) — 테두리와 지시선에 사용
 * @param w,h 스프라이트 월드 크기(종횡비가 캔버스 종횡비가 된다)
 */
/** 라벨이 부품을 가리지 않도록 지정 크기보다 작게 그린다 (가까워진 카메라 시점 기준) */
const LABEL_SCALE = 0.42;

export function makeLabelSprite(text: string, accent: string, w = 0.75, h = 0.3, fontPx = 60): THREE.Sprite {
  const cw = 512;
  const ch = Math.max(64, Math.round((cw * h) / w));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const inset = 6;
    ctx.beginPath();
    ctx.roundRect(inset, inset, cw - inset * 2, ch - inset * 2, (ch - inset * 2) / 2);
    ctx.fillStyle = LABEL_BG;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();
    // fontPx는 기존 256px 캔버스 기준 값 → 2배
    let font = fontPx * 2 * (ch / 192);
    const maxW = cw - 80;
    ctx.font = `700 ${font}px "Noto Sans KR", sans-serif`;
    const textW = ctx.measureText(text).width;
    if (textW > maxW) {
      font = Math.max(24, Math.floor((font * maxW) / textW));
      ctx.font = `700 ${font}px "Noto Sans KR", sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cw / 2, ch / 2 + font * 0.04);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // depthTest off — 라벨은 차체 뒤에 숨지 않고 항상 표시
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false })
  );
  sprite.renderOrder = 10;
  sprite.layers.set(1);
  sprite.scale.set(w * LABEL_SCALE, h * LABEL_SCALE, 1);
  return sprite;
}

/** 부품 → 라벨 지시선 (라벨 테두리와 같은 색). layers.set(1) */
export function makeCalloutLine(partPoint: THREE.Vector3, labelPos: THREE.Vector3, accent: string): THREE.Line {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([partPoint, labelPos]),
    new THREE.LineBasicMaterial({ color: accent, depthTest: false, toneMapped: false } as THREE.LineBasicMaterialParameters)
  );
  line.renderOrder = 9;
  line.layers.set(1);
  return line;
}
