// 증기·연기·물방울 입자와 관 속 흐름 점.
// 입자는 점(Points) 하나로 그려 드로콜을 아끼고, 관 속 흐름은 관에 가려지지 않게 깊이 검사를 끈 점들로 보여 준다.

import * as THREE from 'three';

export interface SpawnOpts {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: number;
  /** 처음 크기(단위) */
  size: number;
  /** 초당 커지는 크기 */
  grow?: number;
  life: number;
  alpha?: number;
  /** 세로 가속(+위로 뜸, -중력) */
  ay?: number;
  /** 감속 계수(1/s) */
  drag?: number;
}

const VS = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vA;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.05, -mv.z);
  vA = aAlpha;
  vC = aColor;
}
`;

const FS = `
varying float vA;
varying vec3 vC;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.12, d) * vA;
  gl_FragColor = vec4(vC, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Particles {
  readonly points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size0: Float32Array;
  private grow: Float32Array;
  private alpha0: Float32Array;
  private ay: Float32Array;
  private drag: Float32Array;
  private aSize: Float32Array;
  private aAlpha: Float32Array;
  private aColor: Float32Array;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private next = 0;
  private tmpC = new THREE.Color();
  private tmpV = new THREE.Vector2();

  constructor(n = 1400) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(1);
    this.size0 = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.alpha0 = new Float32Array(n);
    this.ay = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.aSize = new Float32Array(n);
    this.aAlpha = new Float32Array(n);
    this.aColor = new Float32Array(n * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.aAlpha, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.aColor, 3));
    // 셰이더 재질: 입자마다 크기·투명도·색이 달라 공용 재질 함수로는 표현할 수 없다
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.points.userData.noAO = true;
    this.points.onBeforeRender = (renderer, _s, camera) => {
      const cam = camera as THREE.PerspectiveCamera;
      renderer.getDrawingBufferSize(this.tmpV);
      this.mat.uniforms.uScale!.value = this.tmpV.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 40) / 2));
    };
  }

  spawn(o: SpawnOpts): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = o.pos.x;
    this.pos[i * 3 + 1] = o.pos.y;
    this.pos[i * 3 + 2] = o.pos.z;
    this.vel[i * 3] = o.vel.x;
    this.vel[i * 3 + 1] = o.vel.y;
    this.vel[i * 3 + 2] = o.vel.z;
    this.age[i] = 0;
    this.life[i] = o.life;
    this.size0[i] = o.size;
    this.grow[i] = o.grow ?? 0;
    this.alpha0[i] = o.alpha ?? 0.8;
    this.ay[i] = o.ay ?? 0;
    this.drag[i] = o.drag ?? 0;
    this.tmpC.setHex(o.color);
    this.aColor[i * 3] = this.tmpC.r;
    this.aColor[i * 3 + 1] = this.tmpC.g;
    this.aColor[i * 3 + 2] = this.tmpC.b;
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      const L = this.life[i]!;
      let a = this.age[i]!;
      if (a >= L) {
        this.aAlpha[i] = 0;
        this.aSize[i] = 0;
        continue;
      }
      a += dt;
      this.age[i] = a;
      const k = Math.max(0, 1 - this.drag[i]! * dt);
      const j = i * 3;
      this.vel[j] = this.vel[j]! * k;
      this.vel[j + 1] = this.vel[j + 1]! * k + this.ay[i]! * dt;
      this.vel[j + 2] = this.vel[j + 2]! * k;
      this.pos[j] = this.pos[j]! + this.vel[j]! * dt;
      this.pos[j + 1] = this.pos[j + 1]! + this.vel[j + 1]! * dt;
      this.pos[j + 2] = this.pos[j + 2]! + this.vel[j + 2]! * dt;
      const f = a / L;
      // 처음엔 빠르게 나타나고 끝에서 서서히 사라진다
      const fade = Math.min(1, f * 8) * (1 - f * f);
      this.aAlpha[i] = this.alpha0[i]! * fade;
      this.aSize[i] = this.size0[i]! + this.grow[i]! * a;
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** 관을 따라 흐르는 점들(증기·물·연기 흐름 표시) */
export class FlowPath {
  readonly mesh: THREE.InstancedMesh;
  private pts: THREE.Vector3[];
  private cum: number[] = [0];
  private len: number;
  private count: number;
  private phase = 0;
  private level = 0;
  target = 0;
  speed: number;
  private spacing: number;
  private dummy = new THREE.Object3D();
  private tmp = new THREE.Vector3();
  private mat: THREE.MeshBasicMaterial;

  constructor(pts: THREE.Vector3[], color: number, radius = 0.022, spacing = 0.1, speed = 0.6) {
    this.pts = pts;
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
    this.len = this.cum[this.cum.length - 1]!;
    this.spacing = spacing;
    this.speed = speed;
    this.count = Math.max(1, Math.floor(this.len / spacing));
    // 관 속을 비춰 보이게 깊이 검사를 끈 단색 점(조명과 무관한 표시용)
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 10, 8), this.mat, this.count);
    this.mesh.renderOrder = 30;
    this.mesh.frustumCulled = false;
    this.mesh.userData.noAO = true;
    this.mesh.count = 0;
  }

  setColor(c: number): void {
    this.mat.color.setHex(c);
  }

  private at(d: number, out: THREE.Vector3): THREE.Vector3 {
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i]! < d) i++;
    const a = this.cum[i - 1]!;
    const b = this.cum[i]!;
    const k = b > a ? (d - a) / (b - a) : 0;
    return out.copy(this.pts[i - 1]!).lerp(this.pts[i]!, Math.min(1, Math.max(0, k)));
  }

  update(dt: number): void {
    this.level += (this.target - this.level) * Math.min(1, dt * 5);
    if (this.level < 0.03) {
      this.mesh.count = 0;
      return;
    }
    this.phase = (this.phase + dt * this.speed) % this.spacing;
    const s = this.level;
    this.mesh.count = this.count;
    for (let i = 0; i < this.count; i++) {
      const d = (i * this.spacing + this.phase) % this.len;
      this.at(d, this.tmp);
      this.dummy.position.copy(this.tmp);
      // 양 끝에서 작아져 갑자기 생기거나 사라지지 않게
      const edge = Math.min(1, d / 0.08, (this.len - d) / 0.08);
      this.dummy.scale.setScalar(Math.max(0.001, s * edge));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
