// 주행 안정성 시험 두 가지(위에서 보는 3D)
//  ① 코너링: 반지름 R 원형 코스를 설정 속도로 돈다. 필요한 구심 가속도 v²/r 가 타이어 한계 μ(g + L/m)를 넘으면 바깥으로 미끄러져 이탈.
//  ② 옆바람: 고속 직선 주행 중 옆 돌풍 → 접지 하중(무게 − 양력)이 작을수록 옆으로 더 밀린다.
// 코스 그림은 화면에 맞게 줄였고(코너 반지름·차 크기 비율은 실제와 다름), 미끄러지는 거리와 흔들림은 잘 보이게 키웠다.

import * as THREE from 'three';
import { cornerAccel, crosswind, kmhToMs, GUST_T, LANE_MARGIN, R_CORNER } from './aero';

const RV = 2.9; // 화면 속 코스 반지름
const HALF = 0.46; // 화면 속 도로 반폭
const TIME_SCALE = 3.2; // 코너링 화면 속도 배율
const LAT = 0.075; // 코너링: 실제 1 m 미끄러짐 → 화면 단위

export interface RunnerState {
  status: 'run' | 'slide' | 'out' | 'stop';
  /** 바깥으로 밀린 거리(실제 m) */
  slip: number;
}

interface Runner {
  car: THREE.Group;
  laneR: number;
  theta: number;
  rOff: number; // 실제 m
  vr: number;
  yaw: number;
  spd: number; // 0~1 (모래밭에서 감속)
  t: number;
  status: RunnerState['status'];
  cl: number;
  marks: THREE.InstancedMesh;
  markN: number;
  markT: number;
}

function asphalt(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.92, metalness: 0 });
}

export class CornerTest {
  readonly group = new THREE.Group();
  private runners: Runner[] = [];
  private mats: THREE.Material[] = [];
  private markGeo = new THREE.PlaneGeometry(0.07, 0.2).rotateX(-Math.PI / 2);
  private markMat = new THREE.MeshBasicMaterial({ color: 0x111215, transparent: true, opacity: 0.75, depthWrite: false });
  kmh = 200;
  private restartT = -1;
  onEvent: ((who: number, status: RunnerState['status']) => void) | null = null;

  constructor() {
    this.group.name = 'wind-corner';
    const road = asphalt();
    const sand = new THREE.MeshStandardMaterial({ color: 0xcdb98f, roughness: 1 });
    const grass = new THREE.MeshStandardMaterial({ color: 0x6f9e5a, roughness: 1 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.6 });
    const kerb = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    this.mats.push(road, sand, grass, white, kerb, this.markMat);
    const ring = (r0: number, r1: number, m: THREE.Material, y: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 160, 1).rotateX(-Math.PI / 2), m);
      mesh.position.y = y;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    ring(0.2, RV - HALF - 0.12, grass, 0.006);
    ring(RV + HALF + 0.12, RV + HALF + 2.2, sand, 0.006);
    ring(RV - HALF, RV + HALF, road, 0.01);
    ring(RV - HALF + 0.05, RV - HALF + 0.09, white, 0.013);
    ring(RV + HALF - 0.09, RV + HALF - 0.05, white, 0.013);
    // 연석(빨강·흰색 번갈아)
    for (const [r0, r1] of [
      [RV + HALF, RV + HALF + 0.14],
      [RV - HALF - 0.14, RV - HALF]
    ] as const) {
      const g = new THREE.RingGeometry(r0, r1, 96, 1).rotateX(-Math.PI / 2).toNonIndexed();
      const n = g.getAttribute('position').count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 6) {
        const red = Math.floor(i / 6) % 2 === 0;
        for (let k = 0; k < 6; k++) col.set(red ? [0.85, 0.16, 0.16] : [0.96, 0.96, 0.95], (i + k) * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, kerb);
      m.position.y = 0.014;
      this.group.add(m);
    }
  }

  setCars(player: THREE.Group, ghost: THREE.Group, clPlayer: number, clGhost: number): void {
    this.clearCars();
    const mk = (car: THREE.Group, laneR: number, cl: number): Runner => {
      car.scale.setScalar(0.25);
      this.group.add(car);
      const marks = new THREE.InstancedMesh(this.markGeo, this.markMat, 400);
      marks.count = 0;
      marks.userData.noAO = true;
      this.group.add(marks);
      return { car, laneR, theta: 0, rOff: 0, vr: 0, yaw: 0, spd: 1, t: 0, status: 'run', cl, marks, markN: 0, markT: 0 };
    };
    this.runners = [mk(player, RV - 0.2, clPlayer), mk(ghost, RV + 0.2, clGhost)];
    this.restart();
  }

  private clearCars(): void {
    for (const r of this.runners) {
      this.group.remove(r.car, r.marks);
      r.marks.dispose();
    }
    this.runners = [];
  }

  restart(): void {
    this.restartT = -1;
    for (const r of this.runners) {
      r.theta = -0.9;
      r.rOff = 0;
      r.vr = 0;
      r.yaw = 0;
      r.spd = 1;
      r.t = 0;
      r.status = 'run';
      r.markN = 0;
      r.marks.count = 0;
      this.place(r);
    }
  }

  state(i: number): RunnerState {
    const r = this.runners[i];
    return { status: r?.status ?? 'run', slip: r?.rOff ?? 0 };
  }

  private place(r: Runner): void {
    const R = r.laneR + r.rOff * LAT;
    r.car.position.set(R * Math.cos(r.theta), 0.01, R * Math.sin(r.theta));
    r.car.rotation.y = Math.PI / 2 - r.theta + r.yaw;
  }

  update(dt: number): void {
    const v = kmhToMs(this.kmh);
    let allDone = this.runners.length > 0;
    this.runners.forEach((r, i) => {
      const dtr = dt * TIME_SCALE;
      r.t += dt;
      const acc = cornerAccel(r.cl, this.kmh);
      const over = acc.need - acc.max;
      if (r.status === 'run' && over > 0 && r.t > 0.6) {
        r.status = 'slide';
        this.onEvent?.(i, 'slide');
      }
      if (r.status === 'slide' || r.status === 'out') {
        // 타이어가 버티지 못한 만큼(필요 − 최대) 바깥으로 가속된다
        const aEx = r.status === 'slide' ? Math.max(0.4, over) : 0;
        r.vr += aEx * dtr;
        if (r.status === 'out') r.vr *= Math.exp(-2.2 * dt);
        r.rOff += r.vr * dtr;
        r.yaw = Math.min(0.9, r.yaw + dt * (r.status === 'out' ? 1.6 : 0.35));
        if (r.status === 'slide' && r.rOff * LAT > HALF + 0.1) {
          r.status = 'out';
          this.onEvent?.(i, 'out');
        }
        if (r.status === 'out') {
          r.spd = Math.max(0, r.spd - dt * 0.65);
          if (r.spd <= 0) r.status = 'stop';
        }
        // 타이어 자국
        r.markT -= dt;
        if (r.markT <= 0 && r.markN < 400) {
          r.markT = 0.04;
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - r.theta + r.yaw * 0.6);
          for (const side of [-0.1, 0.1]) {
            if (r.markN >= 400) break;
            const R = r.laneR + r.rOff * LAT + side;
            m.compose(new THREE.Vector3(R * Math.cos(r.theta - 0.03), 0.016, R * Math.sin(r.theta - 0.03)), q, new THREE.Vector3(1, 1, 1));
            r.marks.setMatrixAt(r.markN++, m);
          }
          r.marks.count = r.markN;
          r.marks.instanceMatrix.needsUpdate = true;
        }
      }
      if (r.status !== 'stop') {
        r.theta += ((v / R_CORNER) * dtr * r.spd) / 1;
        if (r.theta > Math.PI * 2) r.theta -= Math.PI * 2;
        allDone = false;
      }
      this.place(r);
    });
    // 둘 다 멈췄거나(이탈) 한 바퀴 넘게 돌았으면 잠시 뒤 다시 출발
    const lapDone = this.runners.every((r) => r.status === 'stop' || (r.status === 'run' && r.t > (2 * Math.PI) / ((v / R_CORNER) * TIME_SCALE)));
    if ((allDone || lapDone) && this.restartT < 0) this.restartT = 1.6;
    if (this.restartT >= 0) {
      this.restartT -= dt;
      if (this.restartT < 0) this.restart();
    }
  }

  dispose(): void {
    this.clearCars();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.markGeo.dispose();
    for (const m of this.mats) m.dispose();
  }
}

// ───────────────────────── 옆바람 시험 ─────────────────────────

const S = 0.35; // 실제 1 m → 화면 단위(차 크기와 같은 비율)
const LANE = 3.5 * S;
const ROAD_L = 30;
const CALM = 1.4;
const RECOVER = 2.4;

interface Swayer {
  car: THREE.Group;
  laneZ: number;
  y: number; // 실제 m
  max: number;
  cl: number;
  clr: number;
}

export class CrosswindTest {
  readonly group = new THREE.Group();
  private dashes = new THREE.Group();
  private gustArrows: THREE.Mesh[] = [];
  private arrowMat: THREE.MeshStandardMaterial;
  private laneLines: THREE.Mesh[] = [];
  private lineMat: THREE.MeshStandardMaterial;
  private warnMat: THREE.MeshStandardMaterial;
  private mats: THREE.Material[] = [];
  private cars: Swayer[] = [];
  private t = 0;
  kmh = 200;
  /** 지금 돌풍 중인지(UI 표시용) */
  gusting = false;
  /** 가장 최근 돌풍에서 밀린 최대 거리(실제 m) */
  lastMax: [number, number] = [0, 0];

  constructor() {
    this.group.name = 'wind-crosswind';
    const road = asphalt();
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.6 });
    this.lineMat = white;
    this.warnMat = new THREE.MeshStandardMaterial({ color: 0xf2b619, emissive: 0xf2b619, emissiveIntensity: 0.6, roughness: 0.5 });
    const grass = new THREE.MeshStandardMaterial({ color: 0x6f9e5a, roughness: 1 });
    this.arrowMat = new THREE.MeshStandardMaterial({ color: 0x4da3f5, emissive: 0x2f8fdd, emissiveIntensity: 0.5, transparent: true, opacity: 0.7, depthWrite: false });
    this.mats.push(road, white, this.warnMat, grass, this.arrowMat);
    const plane = (w: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), m);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    plane(ROAD_L, 14, grass, 0, 0.005, 0);
    // 3차로: 가운데 = 시험 차, 위쪽(바람 불어오는 쪽) = 유령 차, 아래쪽은 비워 둠
    plane(ROAD_L, LANE * 3 + 0.4, road, 0, 0.01, 0);
    // 바깥 실선
    plane(ROAD_L, 0.05, white, 0, 0.013, -LANE * 1.5 + 0.06);
    plane(ROAD_L, 0.05, white, 0, 0.013, LANE * 1.5 - 0.06);
    // 차선(점선) — 움직여서 달리는 느낌
    this.group.add(this.dashes);
    for (const z of [-LANE * 0.5, LANE * 0.5]) {
      for (let i = 0; i < 16; i++) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.05).rotateX(-Math.PI / 2), white);
        d.position.set(-ROAD_L / 2 + i * 2, 0.014, z);
        d.userData.lane = z;
        this.dashes.add(d);
        this.laneLines.push(d);
      }
    }
    // 돌풍 화살표
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const shaft = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 10).rotateX(Math.PI / 2);
      const head = new THREE.ConeGeometry(0.14, 0.3, 14).rotateX(Math.PI / 2).translate(0, 0, 0.65);
      const geo = mergeTwo(shaft, head);
      const m = new THREE.Mesh(geo, this.arrowMat);
      m.userData.noAO = true;
      m.position.set(-7 + (i % 7) * 2.3, 0.45 + Math.floor(i / 7) * 0.5, -4);
      m.userData.phase = Math.random();
      this.gustArrows.push(m);
      g.add(m);
      this.group.add(g);
    }
  }

  setCars(player: THREE.Group, ghost: THREE.Group, clPlayer: number, clrPlayer: number, clGhost: number, clrGhost: number): void {
    for (const c of this.cars) this.group.remove(c.car);
    const mk = (car: THREE.Group, laneZ: number, cl: number, clr: number): Swayer => {
      car.scale.setScalar(0.46);
      this.group.add(car);
      return { car, laneZ, y: 0, max: 0, cl, clr };
    };
    // 유령 차(다운포스 없음)는 바람이 불어오는 쪽 차선
    this.cars = [mk(player, 0, clPlayer, clrPlayer), mk(ghost, -LANE, clGhost, clrGhost)];
    this.t = 0;
  }

  restart(): void {
    this.t = 0;
    for (const c of this.cars) {
      c.y = 0;
      c.max = 0;
    }
  }

  update(dt: number): void {
    const v = kmhToMs(this.kmh);
    this.t += dt;
    const cyc = CALM + GUST_T + RECOVER;
    const ph = this.t % cyc;
    const inGust = ph > CALM && ph < CALM + GUST_T;
    if (inGust && !this.gusting) for (const c of this.cars) c.max = 0; // 새 돌풍 시작
    this.gusting = inGust;
    // 도로가 뒤로 흐름(차는 −X 쪽으로 달림)
    for (const d of this.dashes.children) {
      d.position.x += v * S * dt * 0.5;
      if (d.position.x > ROAD_L / 2) d.position.x -= 32;
    }
    let anyOut = false;
    this.cars.forEach((c, i) => {
      const cw = crosswind(c.cl, c.clr, this.kmh);
      if (inGust) c.y += v * cw.slip * dt; // 돌풍 동안 미끄럼각만큼 옆으로 흐른다
      else if (ph >= CALM + GUST_T) c.y *= Math.exp(-dt * 2.2); // 운전자가 바로잡음
      c.max = Math.max(c.max, c.y);
      this.lastMax[i] = c.max;
      const wob = inGust ? Math.sin(this.t * 13) * cw.sway * 2.5 : 0;
      c.car.position.set(0, 0.01, c.laneZ + c.y * S);
      // 앞이 −X. 옆으로 밀리는 방향(+Z)으로 꼬리가 흔들리는 모습(각도는 보기 좋게 키움)
      c.car.rotation.y = (inGust ? -cw.slip * 4 : 0) + wob;
      if (i === 0 && c.y > LANE_MARGIN) anyOut = true;
    });
    for (const d of this.laneLines) d.material = anyOut && d.userData.lane === LANE * 0.5 ? this.warnMat : this.lineMat;
    // 돌풍 화살표: 돌풍일 때만 −Z에서 +Z로 쓸고 지나감
    for (const a of this.gustArrows) {
      const p = ((this.t * 0.9 + (a.userData.phase as number)) % 1);
      a.visible = inGust;
      a.position.z = -4 + p * 6.5;
    }
  }

  dispose(): void {
    for (const c of this.cars) this.group.remove(c.car);
    this.cars = [];
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const A = a.index ? a.toNonIndexed() : a;
  const B = b.index ? b.toNonIndexed() : b;
  const pos = new Float32Array(A.getAttribute('position').count * 3 + B.getAttribute('position').count * 3);
  pos.set(A.getAttribute('position').array as Float32Array, 0);
  pos.set(B.getAttribute('position').array as Float32Array, A.getAttribute('position').count * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  for (const x of [a, b, A, B]) x.dispose();
  return g;
}
