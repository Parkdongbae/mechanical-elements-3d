// 씬 셋업 v2: 렌더러, 카메라, 스튜디오 조명, 바닥, OrbitControls, 후처리(AO), 테마, 카메라 이동

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type ThemeId = 'light' | 'dark';
export type QualityId = 'high' | 'low';

export interface CameraView {
  /** 카메라 위치 */
  pos: [number, number, number];
  /** 바라보는 지점 */
  target: [number, number, number];
}

export const DEFAULT_VIEW: CameraView = { pos: [4.4, 3.4, 6.8], target: [0, 1.0, 0] };

interface ThemeSpec {
  top: string;
  horizon: string;
  bottom: string;
  floor: number;
  gridMajor: number;
  gridMinor: number;
  gridOpacity: number;
  exposure: number;
  envIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyIntensity: number;
  aoIntensity: number;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  light: {
    top: '#f4f7fb',
    horizon: '#dde5ee',
    bottom: '#c9d4e0',
    floor: 0xdfe6ee,
    gridMajor: 0xaebccb,
    gridMinor: 0xc6d2de,
    gridOpacity: 0.5,
    exposure: 1.0,
    envIntensity: 0.9,
    hemiSky: 0xeaf2ff,
    hemiGround: 0x97a3b0,
    hemiIntensity: 0.7,
    keyIntensity: 2.3,
    aoIntensity: 0.9
  },
  dark: {
    top: '#2a3342',
    horizon: '#161b24',
    bottom: '#0c0f15',
    floor: 0x1a202a,
    gridMajor: 0x3a4658,
    gridMinor: 0x283140,
    gridOpacity: 0.55,
    exposure: 1.08,
    envIntensity: 0.8,
    hemiSky: 0x8fa6c8,
    hemiGround: 0x1a1f28,
    hemiIntensity: 0.35,
    keyIntensity: 2.7,
    aoIntensity: 1.0
  }
};

/**
 * 스튜디오형 환경 씬: 하늘 그라데이션 + HDR 소프트박스/스트립 라이트.
 * 평면 강재 면에도 하이라이트 띠가 읽히도록 밝기 차가 큰 패널을 여러 방향에 둔다.
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
  const top = new THREE.Color(0.95, 1.0, 1.1);
  const horizon = new THREE.Color(0.5, 0.55, 0.62);
  const bottom = new THREE.Color(0.1, 0.11, 0.13);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 60;
    if (y >= 0) c.lerpColors(horizon, top, Math.pow(y, 0.6));
    else c.lerpColors(horizon, bottom, Math.pow(-y, 0.4));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  sky.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  env.add(sky);

  const panel = (w: number, h: number, intensity: number, x: number, y: number, z: number, tint = 0xffffff): void => {
    const color = new THREE.Color(tint).multiplyScalar(intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  panel(30, 20, 4.2, -20, 26, 16); // 키 소프트박스 (좌상단 앞)
  panel(18, 12, 2.0, 26, 12, -10, 0xdce8ff); // 필 (우측 뒤, 약간 차가운 톤)
  panel(40, 3, 5.5, 0, 30, -22); // 상단 뒤 스트립 — 금속 윤곽 하이라이트
  panel(4, 26, 3.0, 34, 8, 14, 0xfff1dc); // 우측 세로 스트립 (따뜻한 톤)
  panel(4, 22, 2.2, -34, 6, -12); // 좌측 세로 스트립
  return env;
}

function gradientTexture(spec: ThemeSpec): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, spec.top);
  g.addColorStop(0.55, spec.horizon);
  g.addColorStop(1, spec.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private quality: QualityId = 'high';
  private theme: ThemeId = 'light';
  private hemi!: THREE.HemisphereLight;
  private key!: THREE.DirectionalLight;
  private ground!: THREE.Mesh;
  private grid!: THREE.GridHelper;
  private fly: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number; dur: number } | null = null;
  private slowFrames = 0;

  constructor(canvas: HTMLCanvasElement, opts: { theme?: ThemeId; quality?: QualityId } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xdde5ee, 16, 44);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    this.camera.position.set(...DEFAULT_VIEW.pos);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(...DEFAULT_VIEW.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    // 사용자가 직접 조작하면 진행 중인 카메라 이동을 즉시 멈춘다
    this.controls.addEventListener('start', () => {
      this.fly = null;
    });

    this.setupLights();
    this.setupGround();
    this.quality = opts.quality ?? 'high';
    this.setupComposer();
    this.setTheme(opts.theme ?? 'light');
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /** 부품 이름 라벨(스프라이트·지시선)은 레이어 1에 두고 카메라 레이어로 표시/숨김을 전환한다 */
  setLabelsVisible(visible: boolean): void {
    if (visible) this.camera.layers.enable(1);
    else this.camera.layers.disable(1);
  }

  setTheme(theme: ThemeId): void {
    this.theme = theme;
    const spec = THEMES[theme];
    const old = this.scene.background;
    this.scene.background = gradientTexture(spec);
    if (old instanceof THREE.Texture) old.dispose();
    (this.scene.fog as THREE.Fog).color.set(spec.horizon);
    this.renderer.toneMappingExposure = spec.exposure;
    this.scene.environmentIntensity = spec.envIntensity;
    this.hemi.color.set(spec.hemiSky);
    this.hemi.groundColor.set(spec.hemiGround);
    this.hemi.intensity = spec.hemiIntensity;
    this.key.intensity = spec.keyIntensity;
    (this.ground.material as THREE.MeshStandardMaterial).color.set(spec.floor);
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.grid = this.makeGrid(spec);
    this.scene.add(this.grid);
    if (this.gtao) this.gtao.blendIntensity = spec.aoIntensity;
  }

  getTheme(): ThemeId {
    return this.theme;
  }

  setQuality(quality: QualityId): void {
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.25));
    this.key.shadow.mapSize.setScalar(quality === 'high' ? 2048 : 1024);
    this.key.shadow.map?.dispose();
    this.key.shadow.map = null;
    this.resize();
  }

  getQuality(): QualityId {
    return this.quality;
  }

  /** 카메라를 지정한 시점으로 부드럽게 이동 (immediate=true면 즉시) */
  flyTo(view: CameraView, immediate = false): void {
    const toPos = new THREE.Vector3(...view.pos);
    const toTarget = new THREE.Vector3(...view.target);
    if (immediate) {
      this.fly = null;
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTarget);
      this.controls.update();
      return;
    }
    this.fly = { fromPos: this.camera.position.clone(), toPos, fromTarget: this.controls.target.clone(), toTarget, t: 0, dur: 0.9 };
  }

  private setupLights(): void {
    // 금속 PBR 재질이 반사할 환경맵 — 환경맵이 없으면 금속이 어둡고 평면하게 보인다
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(buildStudioEnvironment(), 0.03).texture;
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight(0xeaf2ff, 0x97a3b0, 0.7);
    this.scene.add(this.hemi);

    this.key = new THREE.DirectionalLight(0xfff3e2, 2.3);
    this.key.position.set(5.5, 10, 5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -7;
    this.key.shadow.camera.right = 7;
    this.key.shadow.camera.top = 7;
    this.key.shadow.camera.bottom = -7;
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 30;
    this.key.shadow.bias = -0.0002;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.key);

    const fill = new THREE.DirectionalLight(0xcfe0f5, 0.45);
    fill.position.set(-6, 4, 3);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xdfeaff, 1.1);
    rim.position.set(-3, 6, -8);
    this.scene.add(rim);
  }

  private makeGrid(spec: ThemeSpec): THREE.GridHelper {
    const grid = new THREE.GridHelper(40, 40, spec.gridMajor, spec.gridMinor);
    grid.position.y = 0.004;
    const m = grid.material as THREE.Material;
    m.transparent = true;
    m.opacity = spec.gridOpacity;
    m.depthWrite = false;
    return grid;
  }

  private setupGround(): void {
    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 72),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.82, metalness: 0 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.grid = this.makeGrid(THEMES.light);
    this.scene.add(this.grid);
  }

  private setupComposer(): void {
    try {
      const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      const composer = new EffectComposer(this.renderer, target);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const gtao = new GTAOPass(this.scene, this.camera, 4, 4);
      gtao.updateGtaoMaterial({ radius: 0.42, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      // 기본 구현은 Points/Line만 숨긴다 — 라벨 스프라이트·슬롯 링·투명 재질까지 법선 패스에서 제외해야
      // 라벨 자리에 검은 사각형이 생기거나 유리/ghost 하우징이 불투명 AO를 만들지 않는다
      const cache = new Map<THREE.Object3D, boolean>();
      const scene = this.scene;
      let savedBackground: THREE.Scene['background'] = null;
      gtao.overrideVisibility = (): void => {
        // 텍스처 배경은 내부적으로 2x2 평면 메시로 그려지는데, overrideMaterial이 걸리면 원점에 검은 사각형으로 찍힌다
        savedBackground = scene.background;
        scene.background = null;
        scene.traverse((o) => {
          cache.set(o, o.visible);
          const any = o as THREE.Object3D & { isPoints?: boolean; isLine?: boolean; isSprite?: boolean; isMesh?: boolean; material?: THREE.Material | THREE.Material[] };
          if (any.isPoints || any.isLine || any.isSprite || o.userData.slot || o.userData.noAO) {
            o.visible = false;
          } else if (any.isMesh && any.material) {
            const m = Array.isArray(any.material) ? any.material[0] : any.material;
            if (m && (m.transparent || !m.depthWrite)) o.visible = false;
          }
        });
      };
      gtao.restoreVisibility = (): void => {
        scene.background = savedBackground;
        scene.traverse((o) => {
          const v = cache.get(o);
          if (v !== undefined) o.visible = v;
        });
        cache.clear();
      };
      composer.addPass(gtao);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.gtao = gtao;
    } catch (err) {
      console.warn('후처리 초기화 실패 — 기본 렌더로 전환', err);
      this.composer = null;
      this.gtao = null;
    }
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  };

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  /** 매 프레임 호출: 카메라 이동 보간 + 컨트롤 감쇠 + 성능 저하 시 자동 품질 하향 */
  update(dt: number): void {
    if (this.fly) {
      this.fly.t += dt;
      const k = Math.min(1, this.fly.t / this.fly.dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(this.fly.fromPos, this.fly.toPos, e);
      this.controls.target.lerpVectors(this.fly.fromTarget, this.fly.toTarget, e);
      if (k >= 1) this.fly = null;
    }
    this.controls.update();

    if (this.quality === 'high' && document.visibilityState === 'visible') {
      // 2초가량 연속으로 30fps 미만이면 저사양 기기로 보고 후처리를 끈다
      this.slowFrames = dt > 0.034 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
      if (this.slowFrames > 90) {
        this.slowFrames = 0;
        this.setQuality('low');
        this.onAutoLowQuality?.();
      }
    }
  }

  /** 성능 저하로 품질이 자동 하향됐을 때 호출 (설정 UI 동기화용) */
  onAutoLowQuality: (() => void) | null = null;

  render(): void {
    if (this.composer && this.quality === 'high') this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
