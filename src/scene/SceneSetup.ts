// 씬 셋업: 렌더러, 카메라, 조명, 바닥, OrbitControls (PC/터치 공용)

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 스튜디오형 환경 씬: 하늘 그라데이션 + HDR 소프트박스 2개.
 * RoomEnvironment는 균질해서 평면 강재 면에 반사 변화를 만들지 못하므로,
 * 밝은 상단/어두운 하단 그라데이션과 강한 광원 패널로 평면에서도
 * 하이라이트가 읽히는 환경맵을 만든다.
 */
function buildStudioEnvironment(): THREE.Scene {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 24),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })
  );
  const pos = sky.geometry.attributes.position;
  if (!pos) throw new Error('sky sphere missing position attribute');
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(1.1, 1.16, 1.28);
  const horizon = new THREE.Color(0.6, 0.66, 0.74);
  const bottom = new THREE.Color(0.2, 0.22, 0.26);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 60;
    if (y >= 0) c.lerpColors(horizon, top, Math.pow(y, 0.6));
    else c.lerpColors(horizon, bottom, Math.pow(-y, 0.5));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  sky.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  env.add(sky);

  const softbox = (w: number, h: number, intensity: number, x: number, y: number, z: number): void => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(intensity, intensity, intensity),
        side: THREE.DoubleSide
      })
    );
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    env.add(panel);
  };
  softbox(30, 20, 3.4, -20, 24, 16);
  softbox(18, 12, 1.7, 24, 10, -12);
  return env;
}

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe9f1f8);
    this.scene.fog = new THREE.Fog(0xe9f1f8, 18, 42);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(4.4, 3.4, 6.8);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1.0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.setupLights();
    this.setupGround();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private setupLights(): void {
    // 금속 PBR 재질이 반사할 환경맵 — 환경맵이 없으면 금속이 어둡고 평면하게 보인다
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(buildStudioEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 0.85;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xdfeaff, 0x8a97a5, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    sun.shadow.camera.far = 30;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xcfe0f5, 0.5);
    fill.position.set(-5, 4, -6);
    this.scene.add(fill);
  }

  private setupGround(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({ color: 0xdde7ef, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(24, 24, 0xbcccd9, 0xcfdde8);
    grid.position.y = 0.005;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    this.scene.add(grid);
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
