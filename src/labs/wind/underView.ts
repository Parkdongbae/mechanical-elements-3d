// '하부 보기' — 정비 리프트처럼 차를 들어 올리고 아래에서 올려다본다.
// 차·유선·물결·화살표는 같은 높이(lift)만큼 함께 올라가므로 유동 계산(차 기준 좌표)은 그대로 맞는다.
// 이 모드 동안만 카메라 아래 각도 제한을 풀고 공용 바닥·격자를 숨긴다. 끄거나 exit()하면 반드시 원래대로 되돌린다.

import * as THREE from 'three';
import type { SceneManager } from '../../scene/SceneSetup';
import { darkSteel, steel, rubber } from '../../models/materials';
import { WHEEL_X } from './carModel';

export const LIFT = 1.25;

export interface UnderLabel {
  text: string;
  pos: THREE.Vector3;
}

function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = 'bold 30px "Pretendard Variable", "Malgun Gothic", sans-serif';
  let w = 200;
  if (g) {
    g.font = font;
    w = Math.ceil(g.measureText(text).width) + 36;
  }
  c.width = w;
  c.height = 52;
  if (g) {
    g.font = font;
    g.fillStyle = 'rgba(16,22,32,0.86)';
    g.beginPath();
    g.roundRect(1, 1, w - 2, 50, 14);
    g.fill();
    g.strokeStyle = 'rgba(255,190,90,0.95)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    g.fillText(text, 18, 27);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const s = new THREE.Sprite(mat);
  const h = 0.13;
  s.scale.set((h * w) / 52, h, 1);
  s.renderOrder = 10;
  s.layers.set(1);
  return s;
}

export class UnderView {
  /** 차와 함께 올라가는 것(가상 노면 격자·이름표) */
  readonly lifted = new THREE.Group();
  /** 바닥에 서 있는 리프트 기둥 */
  readonly posts = new THREE.Group();
  private labels = new THREE.Group();
  private road: THREE.LineSegments;
  private postParts: THREE.Mesh[] = [];
  private mats: THREE.Material[] = [];
  on = false;
  lift = 0;
  private hidden: { o: THREE.Object3D; v: boolean }[] = [];
  private savedPolar: number | null = null;
  private restoreT = -1;
  private mgr: SceneManager | null = null;

  constructor() {
    this.lifted.name = 'wind-under';
    // 들어 올린 차 밑의 "가상 노면"(유선 계산의 바닥 y=0) — 반투명 격자라 아래에서도 차가 보인다
    const pts: number[] = [];
    for (let x = -3; x <= 5.001; x += 0.5) pts.push(x, 0, -1.6, x, 0, 1.6);
    for (let z = -1.5; z <= 1.501; z += 0.5) pts.push(-3, 0, z, 5, 0, z);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const rm = new THREE.LineBasicMaterial({ color: 0x7f9bbf, transparent: true, opacity: 0.45, depthWrite: false });
    this.road = new THREE.LineSegments(rg, rm);
    this.mats.push(rm);
    this.lifted.add(this.road, this.labels);
    // 리프트: 기둥 4개 + 차 옆 문턱 아래를 받치는 팔
    const postM = darkSteel({ roughness: 0.5 });
    const armM = steel();
    const padM = rubber();
    this.mats.push(postM, armM, padM);
    // 기둥은 차 앞뒤 바깥(시야를 가리지 않게), 팔은 차 길이 방향으로 뻗어 문턱 아래 패드를 받친다
    for (const sx of [-1, 1]) {
      const x = sx * 2.35;
      const padX = sx > 0 ? WHEEL_X[1] - 0.55 : WHEEL_X[0] + 0.55;
      for (const z of [0.5, -0.5]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12).translate(0, 0.5, 0), postM);
        post.position.set(x, 0, z);
        post.castShadow = true;
        this.posts.add(post);
        this.postParts.push(post);
        const len = Math.abs(x - padX);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, 0.07), armM);
        arm.position.set((x + padX) / 2, 0, z);
        this.posts.add(arm);
        this.postParts.push(arm);
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), padM);
        pad.position.set(padX, 0, z);
        this.posts.add(pad);
        this.postParts.push(pad);
      }
    }
    this.lifted.visible = false;
    this.posts.visible = false;
  }

  setLabels(items: UnderLabel[]): void {
    for (const s of this.labels.children as THREE.Sprite[]) {
      s.material.map?.dispose();
      s.material.dispose();
    }
    this.labels.clear();
    for (const it of items) {
      const s = labelSprite(it.text);
      s.position.copy(it.pos);
      this.labels.add(s);
    }
  }

  /** 켜기/끄기. 켤 때 카메라 제한을 먼저 풀어야 아래로 날아가는 도중 막히지 않는다 */
  set(on: boolean, mgr: SceneManager): void {
    if (on === this.on) return;
    this.on = on;
    this.mgr = mgr;
    if (on) {
      this.restoreT = -1;
      if (this.savedPolar === null) this.savedPolar = mgr.controls.maxPolarAngle;
      mgr.controls.maxPolarAngle = Math.PI * 0.97;
      this.hidden = [];
      for (const o of mgr.scene.children) {
        const m = o as THREE.Mesh;
        const isGround = m.isMesh && m.geometry instanceof THREE.CircleGeometry && (m.geometry.parameters.radius ?? 0) >= 30;
        if (o instanceof THREE.GridHelper || isGround) {
          this.hidden.push({ o, v: o.visible });
          o.visible = false;
        }
      }
    } else {
      this.showGround();
      // 카메라가 아직 바닥 아래에 있으므로 원래 시점으로 날아간 뒤에 제한을 되돌린다
      this.restoreT = 1.05;
    }
  }

  private showGround(): void {
    for (const h of this.hidden) h.o.visible = h.v;
    this.hidden = [];
  }

  private restorePolar(): void {
    if (this.mgr && this.savedPolar !== null) this.mgr.controls.maxPolarAngle = this.savedPolar;
    this.savedPolar = null;
    this.restoreT = -1;
  }

  update(dt: number): void {
    const target = this.on ? LIFT : 0;
    this.lift += (target - this.lift) * Math.min(1, dt * 4);
    if (Math.abs(target - this.lift) < 0.002) this.lift = target;
    const vis = this.lift > 0.01;
    this.lifted.visible = vis;
    this.posts.visible = vis;
    this.lifted.position.y = this.lift;
    this.labels.visible = this.on && this.lift > LIFT * 0.8;
    for (const p of this.postParts) {
      if (p.geometry.type === 'BoxGeometry' && (p.geometry as THREE.BoxGeometry).parameters.height === 1) p.scale.y = Math.max(0.01, this.lift + 0.12);
      else p.position.y = this.lift + 0.12;
    }
    if (this.restoreT >= 0) {
      this.restoreT -= dt;
      if (this.restoreT < 0) this.restorePolar();
    }
  }

  /** exit(): 바로 원상 복구 */
  reset(): void {
    this.on = false;
    this.showGround();
    this.restorePolar();
    this.lift = 0;
  }

  dispose(): void {
    this.setLabels([]);
    this.road.geometry.dispose();
    for (const p of this.postParts) p.geometry.dispose();
    for (const m of this.mats) m.dispose();
  }
}
