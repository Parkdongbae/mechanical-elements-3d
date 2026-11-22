// 소분류 목록용 3D 썸네일 생성기 (오프스크린 렌더러로 1회 렌더링 → dataURL 캐시)

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildPart, normalizePart, disposeObject } from './factory';
import type { PartDef } from '../data/elements';

export class ThumbnailFactory {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cache = new Map<string, string>();

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(256, 256);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    // 금속 재질은 환경맵이 없으면 검게 나온다 — 썸네일 전용 렌더러에도 스튜디오 환경을 준다
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.9;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2.5, 3.5, 3);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.1);
    rim.position.set(-3, 1, -2);
    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(key, rim, amb);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    this.camera.position.set(1.9, 1.5, 2.6);
    this.camera.lookAt(0, 0, 0);
  }

  get(part: PartDef): string {
    const cached = this.cache.get(part.id);
    if (cached) return cached;
    const model = normalizePart(buildPart(part.builder), 1.8);
    this.scene.add(model);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(model);
    disposeObject(model);
    this.cache.set(part.id, url);
    return url;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
