// 풍동 시험 구간(바닥·뒷벽·천장 틀·송풍 팬·벌집 정류기·이동 벨트) + 소음 물결 + 힘 화살표

import * as THREE from 'three';
import { darkSteel, aluminum, glass, plastic, steel, castIron, rubber } from '../../models/materials';
import { WHEEL_X } from './carModel';
import type { NoiseSpot } from './carModel';

const L0 = -6.3;
const L1 = 7.2;
const WZ = 2.7;
const H = 2.6;

function stripeTexture(): THREE.CanvasTexture | null {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#26292e';
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#3a3f46';
  for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 12, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  return t;
}

export class Tunnel {
  readonly group = new THREE.Group();
  private fan = new THREE.Group();
  private belt: THREE.Mesh;
  private floorMat: THREE.MeshStandardMaterial;
  private floorMesh: THREE.Mesh | null = null;
  private beltTex: THREE.CanvasTexture | null;
  private mats: THREE.Material[] = [];

  constructor() {
    this.group.name = 'wind-tunnel';
    const frameM = darkSteel({ roughness: 0.5 });
    const floorM = plastic(0x8d97a3, { roughness: 0.75 });
    this.floorMat = floorM;
    const wallM = glass(0xcfe3f5, 0.12);
    const alu = aluminum({ roughness: 0.4 });
    const fanM = steel({ roughness: 0.3 });
    const hubM = castIron();
    this.beltTex = stripeTexture();
    const beltM = rubber({ grain: false, roughness: 0.8 });
    if (this.beltTex) {
      beltM.map = this.beltTex;
      beltM.color.set(0xffffff);
    }
    this.mats.push(frameM, floorM, wallM, alu, fanM, hubM, beltM);

    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    // 시험 구간 바닥판
    const floor = add(new THREE.BoxGeometry(L1 - L0, 0.04, WZ * 2), floorM, (L0 + L1) / 2, -0.019, 0);
    this.floorMesh = floor;
    floor.castShadow = false;
    // 이동 벨트(바퀴 아래 도로가 움직이는 장치)
    this.belt = add(new THREE.BoxGeometry(4.4, 0.006, 1.5), beltM, 0, 0.003, 0);
    this.belt.castShadow = false;
    // 턴테이블 테두리
    const ring = add(new THREE.RingGeometry(2.55, 2.62, 96).rotateX(-Math.PI / 2), alu, 0, 0.004, 0);
    ring.castShadow = false;
    // 뒷벽 유리 + 틀
    const wall = add(new THREE.PlaneGeometry(L1 - L0, H), wallM, (L0 + L1) / 2, H / 2, -WZ);
    wall.castShadow = false;
    wall.receiveShadow = false;
    const beam = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t = 0.07): void => {
      const a = new THREE.Vector3(x0, y0, z0);
      const b = new THREE.Vector3(x1, y1, z1);
      const len = a.distanceTo(b);
      const g = new THREE.BoxGeometry(t, len, t);
      const m = add(g, frameM, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    };
    for (const x of [L0, -2.2, 2.2, L1]) {
      beam(x, 0, -WZ, x, H, -WZ);
    }
    beam(L0, H, -WZ, L1, H, -WZ);
    beam(L0, 0.03, -WZ, L1, 0.03, -WZ);
    beam(L0, 0.03, WZ, L1, 0.03, WZ, 0.05);
    // 앞쪽: 벌집 정류기(가는 격자) + 그 뒤의 송풍 팬
    const hc = new THREE.Group();
    hc.position.set(L0 + 0.02, 0, 0);
    this.group.add(hc);
    const bars: THREE.BufferGeometry[] = [];
    for (let i = 1; i < 14; i++) {
      const z = -WZ + (i * 2 * WZ) / 14;
      bars.push(new THREE.BoxGeometry(0.16, H, 0.012).translate(0, H / 2, z));
    }
    for (let j = 1; j < 7; j++) bars.push(new THREE.BoxGeometry(0.16, 0.012, WZ * 2).translate(0, (j * H) / 7, 0));
    for (const b of bars) {
      const m = new THREE.Mesh(b, alu);
      m.receiveShadow = true;
      hc.add(m);
    }
    // 팬(정류기 뒤로 비쳐 보이게 반지름이 큰 덕트 링 + 날개)
    this.fan.position.set(L0 - 0.55, 1.25, 0);
    this.group.add(this.fan);
    const duct = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 16, 64).rotateY(Math.PI / 2), frameM);
    duct.position.set(L0 - 0.55, 1.25, 0);
    this.group.add(duct);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16).scale(1.6, 1, 1), hubM);
    this.fan.add(hub);
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Shape();
      s.moveTo(0.15, -0.06);
      s.quadraticCurveTo(0.7, -0.2, 1.05, -0.08);
      s.lineTo(1.05, 0.12);
      s.quadraticCurveTo(0.6, 0.12, 0.15, 0.08);
      s.closePath();
      const bg = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
      bg.rotateX(0.5); // 비틀림 각
      const blade = new THREE.Mesh(bg, fanM);
      const pivot = new THREE.Group();
      pivot.rotation.x = (i / 7) * Math.PI * 2;
      blade.rotation.z = Math.PI / 2;
      blade.rotation.y = Math.PI / 2;
      pivot.add(blade);
      this.fan.add(pivot);
    }
    // 차를 붙잡는 힘 측정 받침(밸런스) 표시 — 바퀴 아래 네 개의 판
    for (const x of WHEEL_X) {
      for (const z of [0.6, -0.6]) {
        const pad = add(new THREE.BoxGeometry(0.42, 0.012, 0.3), alu, x, 0.006, z);
        pad.castShadow = false;
      }
    }
  }

  /** 하부 보기: 바닥판을 반투명하게(아래로 내려간 카메라에서도 차가 보이게) */
  setSeeThrough(on: boolean): void {
    this.floorMat.transparent = on;
    this.floorMat.opacity = on ? 0.22 : 1;
    this.floorMat.depthWrite = !on;
    this.floorMat.needsUpdate = true;
    if (this.floorMesh) this.floorMesh.receiveShadow = !on;
  }

  update(dt: number, kmh: number): void {
    this.fan.rotation.x += dt * (kmh / 200) * 18;
    if (this.beltTex) this.beltTex.offset.x -= dt * (kmh / 200) * 2.5;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
    this.beltTex?.dispose();
  }
}

// ───────────────────────── 소음 물결 ─────────────────────────

export class Ripples {
  readonly group = new THREE.Group();
  private geo = new THREE.RingGeometry(0.78, 1, 40);
  private items: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number; size: number; level: number }[] = [];

  setSpots(spots: NoiseSpot[], level: (k: NoiseSpot['kind']) => number): void {
    this.clear();
    for (const s of spots) {
      const lv = level(s.kind);
      if (lv <= 0.02) continue;
      for (let k = 0; k < 2; k++) {
        const mat = new THREE.MeshBasicMaterial({ color: s.kind === 'gap' ? 0xa855f7 : s.kind === 'under' || s.kind === 'wheel' ? 0x2f8fdd : 0xf08a24, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(this.geo, mat);
        mesh.position.copy(s.pos);
        mesh.userData.noAO = true;
        mesh.renderOrder = 4;
        this.group.add(mesh);
        this.items.push({ mesh, mat, phase: k * 0.5 + Math.random() * 0.2, size: s.kind === 'under' ? 0.5 : 0.22, level: lv });
      }
    }
  }

  update(t: number, cam: THREE.Camera): void {
    for (const it of this.items) {
      const p = (t * 1.1 + it.phase) % 1;
      const sc = it.size * (0.3 + p * (0.8 + it.level));
      it.mesh.scale.setScalar(sc);
      it.mesh.quaternion.copy(cam.quaternion);
      it.mat.opacity = (1 - p) * Math.min(0.85, 0.25 + it.level * 0.7);
    }
  }

  private clear(): void {
    for (const it of this.items) {
      this.group.remove(it.mesh);
      it.mat.dispose();
    }
    this.items = [];
  }

  dispose(): void {
    this.clear();
    this.geo.dispose();
  }
}

// ───────────────────────── 힘 화살표 ─────────────────────────

export class ForceArrow {
  readonly group = new THREE.Group();
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;

  constructor() {
    this.mat = new THREE.MeshStandardMaterial({ color: 0x16925a, emissive: 0x16925a, emissiveIntensity: 0.35, roughness: 0.4 });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 16).translate(0, 0.5, 0), this.mat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 20).translate(0, 0.1, 0), this.mat);
    this.group.add(this.shaft, this.head);
    this.group.userData.noAO = true;
  }

  /** base: 차 표면 점, len(+ 위로 띄움, − 아래로 누름) */
  set(base: THREE.Vector3, len: number): void {
    const L = Math.max(0.05, Math.abs(len));
    this.group.visible = Math.abs(len) > 0.02;
    const down = len < 0;
    const c = down ? 0x16925a : 0xdc3e44;
    this.mat.color.set(c);
    this.mat.emissive.set(c);
    // 누르는 힘: 위에서 차 표면을 향해 내려오는 화살표 / 띄우는 힘: 표면에서 위로
    if (down) {
      this.group.position.set(base.x, base.y + L + 0.22, base.z);
      this.group.rotation.set(Math.PI, 0, 0);
    } else {
      this.group.position.copy(base);
      this.group.rotation.set(0, 0, 0);
    }
    this.shaft.scale.y = L;
    this.head.position.y = L;
  }

  dispose(): void {
    this.shaft.geometry.dispose();
    this.head.geometry.dispose();
    this.mat.dispose();
  }
}
