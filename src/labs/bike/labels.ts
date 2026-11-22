// 3D 이름표(스프라이트): 짙은 배경 + 흰 글자 + 색 테두리. 글자는 변속할 때마다 다시 그린다.
// layers.set(1) — 앱의 라벨 표시 토글을 따른다.

import * as THREE from 'three';

const CW = 512;
const CH = 128;
const WORLD_H = 0.15;

function draw(canvas: HTMLCanvasElement, text: string, accent: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, CW, CH);
  ctx.font = '700 60px "Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif';
  const tw = Math.min(CW - 40, ctx.measureText(text).width + 64);
  const x0 = (CW - tw) / 2;
  ctx.beginPath();
  ctx.roundRect(x0, 8, tw, CH - 16, (CH - 16) / 2);
  // 장면이 선형 공간에서 합성되므로 알파를 높여 글자 대비를 확보한다
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CW / 2, CH / 2 + 3, CW - 72);
}

export function makeLabel(text: string, accent: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  draw(canvas, text, accent);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  sprite.renderOrder = 10;
  sprite.layers.set(1);
  sprite.scale.set((WORLD_H * CW) / CH, WORLD_H, 1);
  sprite.userData.canvas = canvas;
  return sprite;
}

export function setLabelText(sprite: THREE.Sprite, text: string, accent: string): void {
  const canvas = sprite.userData.canvas as HTMLCanvasElement | undefined;
  if (!canvas || sprite.userData.text === text) return;
  sprite.userData.text = text;
  draw(canvas, text, accent);
  if (sprite.material.map) sprite.material.map.needsUpdate = true;
}

export function disposeLabel(sprite: THREE.Sprite): void {
  sprite.material.map?.dispose();
  sprite.material.dispose();
}
