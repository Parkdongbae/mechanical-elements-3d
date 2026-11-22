// 손수레: 차축과 분할 핀 미션 — 두 바퀴 손수레(나무 짐칸·손잡이·다리), 바퀴는 처음에 옆 바닥에 빠져 있다.
// 차축은 몸체의 행어 보스에 멈춤 볼트로 고정(회전하지 않음), 바퀴 허브가 차축 위에서 돈다.
// 완료: 손잡이를 살짝 들어 다리를 띄우고(차축 중심 기울임) 짧게 왕복 — 바퀴는 미끄럼 없이 구른다(θ = -x / R).
// 좌표: +X = 앞(짐칸 쪽), 손잡이 = -X, Z = 차축 방향(+Z = 카메라 쪽).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, castIron, chrome, darkSteel, paint, plastic, rubber, steel, wood } from '../models/materials';
import { lathe, merge, extrude, type V2 } from '../models/parts/geom';

const AXLE_Y = 0.5;
const WHEEL_R = 0.5; // 타이어 바깥 반지름 (1단위 ≈ 0.35m → 지름 35cm)
const TIRE_TUBE = 0.075;
const WZ = 0.76; // 바퀴 중심 z
const HUB_HALF = 0.08;
const AXLE_R = 0.05;
const AXLE_HALF = 0.98;
const PIN_Z = 0.925;
const WASHER_Z = WZ + HUB_HALF + 0.009;
const BOSS_Z = 0.5;
const RAIL_Y = 0.23; // 차축 중심 기준
const M_PER_UNIT = 0.35;
const SAW_X = 0.45;

// 동작: 손잡이 들기 7°, 진폭 0.9 왕복 5초
const TILT = 7 * (Math.PI / 180);
const AMP = 0.9;
const PERIOD = 5;

const WAIT = [new THREE.Vector3(0.95, 0.08, 1.62), new THREE.Vector3(-0.15, 0.08, 1.72)] as const;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function latheZ(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 20): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

function box(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
}

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

interface PinAnim {
  pin: THREE.Group;
  legs: THREE.Object3D[];
}

export class HandCart extends BaseMachine {
  readonly id = 'cart';
  /** 몸체: 원점 = 차축 중심. 이동·기울임은 이 그룹에만 준다 */
  private carriage = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private washers: THREE.Mesh[] = [];
  private sawhorse = new THREE.Group();
  private axleModel: THREE.Group | null = null;
  private pinModel: THREE.Group | null = null;
  private pins: PinAnim[] = [];
  private mount: { k: number; last: number } | null = null;
  private pinAnim: { k: number; last: number } | null = null;
  private wheelsOn = false;

  private readonly frameMat = paint(0x2f7d5b, { roughness: 0.4 });
  private readonly steelMat = steel();
  private readonly darkMat = darkSteel();

  constructor() {
    super();
    this.carriage.position.set(0, AXLE_Y, 0);
    this.group.add(this.carriage, this.sawhorse);
    this.buildFrame();
    this.buildBed();
    this.buildSawhorse();
    this.buildFloorMarks();
    for (let i = 0; i < 2; i++) {
      const w = this.buildWheel();
      this.wheels.push(w);
      this.group.add(w);
      const washer = new THREE.Mesh(latheZ([[0.052, -0.007], [0.085, -0.007], [0.085, 0.007], [0.052, 0.007], [0.052, -0.007]], 40), steel({ roughness: 0.28 }));
      washer.visible = false;
      this.washers.push(washer);
      this.carriage.add(washer);
    }
    this.placeWheelsWaiting();

    this.addSlot(0, 0.1, new THREE.Vector3(0, AXLE_Y, BOSS_Z + 0.06), 0.016);
    this.addSlot(1, 0.05, new THREE.Vector3(0, AXLE_Y + AXLE_R + 0.03, PIN_Z), 0.011);
    this.slots[1]!.rotation.x = Math.PI / 2;
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
      s.receiveShadow = false;
    }
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.axleModel !== null : this.pinModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, AXLE_Y, 0) : new THREE.Vector3(0, AXLE_Y + 0.25, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, AXLE_Y, BOSS_Z + 0.1) : new THREE.Vector3(0, AXLE_Y + 0.1, PIN_Z);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildAxle() : this.buildPins();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.carriage.add(model);
    if (step === 0) {
      this.axleModel = model;
      this.hideSlot(0);
      // 바퀴가 바닥에서 들려 와 차축 끝으로 끼워진다 → 와셔. 끝나면 분할 핀 슬롯
      this.mount = { k: 0, last: -1 };
    } else {
      this.finishMount();
      this.pinModel = model;
      this.pins = [];
      for (const c of model.children) {
        const legs: THREE.Object3D[] = [];
        c.traverse((o) => {
          if (o.name === 'leg') legs.push(o);
        });
        this.pins.push({ pin: c as THREE.Group, legs });
      }
      this.pinAnim = { k: 0, last: -1 };
      this.applyPin(0);
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.axleModel) this.carriage.remove(this.axleModel);
    if (this.pinModel) this.carriage.remove(this.pinModel);
    this.axleModel = this.pinModel = null;
    this.pins = [];
    this.mount = this.pinAnim = null;
    this.carriage.position.set(0, AXLE_Y, 0);
    this.carriage.rotation.set(0, 0, 0);
    this.sawhorse.position.set(0, 0, 0);
    for (const w of this.washers) w.visible = false;
    this.placeWheelsWaiting();
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.mount) {
      const dt = this.mount.last < 0 ? 0 : Math.min(0.05, t - this.mount.last);
      this.mount.last = t;
      this.mount.k += dt / 3.0;
      if (this.mount.k >= 1) this.finishMount();
      else this.applyMount(this.mount.k);
    }
    if (this.pinAnim) {
      const dt = this.pinAnim.last < 0 ? 0 : Math.min(0.05, t - this.pinAnim.last);
      this.pinAnim.last = t;
      this.pinAnim.k += dt / 1.1;
      this.applyPin(Math.min(1, this.pinAnim.k));
      if (this.pinAnim.k >= 1) this.pinAnim = null;
    }
  }

  createSim(): MachineSim {
    if (!this.axleModel || !this.pinModel) throw new Error('cart mission incomplete');
    this.finishMount();
    let time = 0;
    let x = 0;
    let v = 0;
    return {
      update: (dt: number) => {
        time += dt;
        // 0~0.8초: 받침목을 빼낸다, 0.8~1.5초: 손잡이를 들어 다리를 띄운다, 이후 왕복
        this.sawhorse.position.x = smooth(time / 0.8) * 1.75;
        const tilt = TILT * smooth((time - 0.8) / 0.7);
        const tm = Math.max(0, time - 1.5);
        const nx = AMP * Math.sin((tm * Math.PI * 2) / PERIOD) * smooth(tm / 0.8);
        v = dt > 0 ? (nx - x) / dt : 0;
        x = nx;
        this.carriage.position.x = x;
        this.carriage.rotation.z = -tilt;
        // 바퀴의 세계 회전 = -x/R (미끄럼 없는 구름). 부모(몸체)가 -tilt 기울었으므로 그만큼 보정
        for (const w of this.wheels) w.rotation.z = -x / WHEEL_R + tilt;
      },
      getDisplay: () => {
        const rpm = (Math.abs(v) / (Math.PI * 2 * WHEEL_R)) * 60;
        return [
          { label: '바퀴 회전수', value: rpm.toFixed(0), unit: 'rpm', tone: 'red' },
          { label: '차축 회전수 (고정축)', value: '0', unit: 'rpm', tone: 'blue' },
          { label: '이동 속도', value: (Math.abs(v) * M_PER_UNIT).toFixed(2), unit: 'm/s' }
        ];
      }
    };
  }

  // ───────────────────────── 조립 연출 ─────────────────────────

  private placeWheelsWaiting(): void {
    this.wheelsOn = false;
    this.wheels.forEach((w, i) => {
      this.carriage.remove(w);
      this.group.add(w);
      w.position.copy(WAIT[i]!);
      w.rotation.set(Math.PI / 2, 0, i * 0.7);
    });
  }

  /** k 0~0.85: 바퀴 들기 → 차축 끝 바깥 → 축을 따라 밀어 넣기, 0.85~1: 와셔 */
  private applyMount(k: number): void {
    const kw = Math.min(1, k / 0.85);
    this.wheels.forEach((w, i) => {
      const s = i === 0 ? 1 : -1;
      const p0 = WAIT[i]!;
      const pts = [
        p0,
        new THREE.Vector3(p0.x, 1.95, p0.z),
        new THREE.Vector3(0, 1.95, s * 1.5),
        new THREE.Vector3(0, AXLE_Y, s * 1.5),
        new THREE.Vector3(0, AXLE_Y, s * WZ)
      ];
      const seg = [0.18, 0.32, 0.22, 0.28];
      let u = kw;
      let j = 0;
      while (j < seg.length - 1 && u > seg[j]!) {
        u -= seg[j]!;
        j++;
      }
      const a = smooth(u / seg[j]!);
      w.position.lerpVectors(pts[j]!, pts[j + 1]!, a);
      const up = smooth(kw / 0.45);
      w.rotation.set((Math.PI / 2) * (1 - up), 0, i * 0.7 * (1 - up));
    });
    const kh = smooth((k - 0.85) / 0.15);
    this.washers.forEach((m, i) => {
      const s = i === 0 ? 1 : -1;
      m.visible = k > 0.85;
      m.position.set(0, 0, s * (WASHER_Z + (1 - kh) * 0.25));
    });
  }

  private finishMount(): void {
    if (!this.axleModel || this.wheelsOn) {
      this.mount = null;
      return;
    }
    this.mount = null;
    this.wheelsOn = true;
    this.wheels.forEach((w, i) => {
      const s = i === 0 ? 1 : -1;
      this.group.remove(w);
      this.carriage.add(w);
      w.position.set(0, 0, s * WZ);
      w.rotation.set(0, 0, 0);
    });
    this.washers.forEach((m, i) => {
      m.visible = true;
      m.position.set(0, 0, (i === 0 ? 1 : -1) * WASHER_Z);
    });
    if (!this.pinModel) this.showSlot(1);
  }

  /** k 0~0.45: 핀이 위에서 구멍으로 내려옴, 0.55~1: 두 다리가 벌어짐 */
  private applyPin(k: number): void {
    const drop = 1 - smooth(k / 0.45);
    const spread = smooth((k - 0.55) / 0.45) * 1.05;
    for (const p of this.pins) {
      p.pin.position.y = drop * 0.3;
      p.legs.forEach((l, i) => (l.rotation.z = (i === 0 ? 1 : -1) * spread));
    }
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 차축: 모따기 양끝, 핀 구멍 2개, 끝면 표시(축용 = 파랑) — 이 표시가 돌지 않는 것으로 고정축임이 보인다 */
  private buildAxle(): THREE.Group {
    const g = new THREE.Group();
    const c = 0.008;
    g.add(new THREE.Mesh(latheZ([[0, -AXLE_HALF], [AXLE_R - c, -AXLE_HALF], [AXLE_R, -AXLE_HALF + c], [AXLE_R, AXLE_HALF - c], [AXLE_R - c, AXLE_HALF], [0, AXLE_HALF]], 40), steel({ roughness: 0.26 })));
    const holeMat = plastic(0x0d0e10, { roughness: 0.9 });
    const markMat = paint(CATEGORY_COLORS.shaft, { roughness: 0.35 });
    const whiteMat = paint(0xf4f6f8, { roughness: 0.4 });
    for (const s of [-1, 1]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, AXLE_R * 2 + 0.002, 16), holeMat);
      hole.position.z = s * PIN_Z;
      g.add(hole);
      const face = new THREE.Mesh(latheZ(s > 0 ? [[0, AXLE_HALF + 0.0005], [AXLE_R - 0.01, AXLE_HALF + 0.0005], [AXLE_R - 0.01, AXLE_HALF + 0.003], [0, AXLE_HALF + 0.003]] : [[0, -AXLE_HALF - 0.003], [AXLE_R - 0.01, -AXLE_HALF - 0.003], [AXLE_R - 0.01, -AXLE_HALF - 0.0005], [0, -AXLE_HALF - 0.0005]], 32), markMat);
      g.add(face);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, AXLE_R * 1.6, 0.004), whiteMat);
      bar.position.z = s * (AXLE_HALF + 0.004);
      g.add(bar);
    }
    return g;
  }

  /** 분할 핀 2개(양 끝). 각 핀: 고리 머리 + 두 가닥 + 끝에서 벌어지는 다리(이름 'leg') */
  private buildPins(): THREE.Group {
    const g = new THREE.Group();
    const mat = steel({ color: 0xd4d9de, roughness: 0.3 });
    const wr = 0.011;
    for (const s of [1, -1]) {
      const pin = new THREE.Group();
      pin.position.z = s * PIN_Z;
      const top = AXLE_R + 0.012;
      const bot = -AXLE_R - 0.012;
      // 고리 머리 (XY 평면)
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.027, wr, 12, 40, Math.PI * 1.6), mat);
      eye.position.y = top + 0.03;
      eye.rotation.z = -Math.PI * 0.3;
      pin.add(eye);
      for (const sx of [-1, 1]) {
        const shank = new THREE.Mesh(cylBetween(new THREE.Vector3(sx * wr, top + 0.012, 0), new THREE.Vector3(sx * wr, bot, 0), wr, 12), mat);
        pin.add(shank);
        const legPivot = new THREE.Group();
        legPivot.name = 'leg';
        legPivot.position.set(sx * wr, bot, 0);
        const leg = new THREE.Mesh(cylBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, sx > 0 ? -0.07 : -0.055, 0), wr, 12), mat);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(wr, 12, 8), mat);
        tip.position.y = sx > 0 ? -0.07 : -0.055;
        const knee = new THREE.Mesh(new THREE.SphereGeometry(wr, 12, 8), mat);
        legPivot.add(leg, tip, knee);
        pin.add(legPivot);
      }
      g.add(pin);
    }
    // 오른쪽 다리(+x)가 [0]이 되도록: legs 순서는 traverse 순(sx -1 먼저) → applyPin에서 부호로 바깥쪽으로 벌린다
    for (const pin of g.children) {
      const legs = pin.children.filter((c) => c.name === 'leg');
      legs.sort((a, b) => b.position.x - a.position.x);
      for (const l of legs) pin.remove(l);
      for (const l of legs) pin.add(l);
    }
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildFrame(): void {
    const c = this.carriage;
    const fm = this.frameMat;
    // 레일 + 손잡이(한 줄 관)
    for (const s of [-1, 1]) {
      const z = s * BOSS_Z;
      const pts = [
        new THREE.Vector3(0.8, RAIL_Y, z),
        new THREE.Vector3(-0.8, RAIL_Y, z),
        new THREE.Vector3(-1.15, RAIL_Y + 0.07, z),
        new THREE.Vector3(-1.65, RAIL_Y + 0.27, z),
        new THREE.Vector3(-2.02, RAIL_Y + 0.32, z)
      ];
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      c.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.032, 20, false), fm));
      const capF = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 12), fm);
      capF.position.copy(pts[0]!);
      c.add(capF);
      const grip = new THREE.Mesh(cylBetween(curve.getPoint(0.86), pts[4]!.clone().add(new THREE.Vector3(-0.02, 0.002, 0)), 0.043, 24), rubber({ color: 0x2b2d31, roughness: 0.7 }));
      c.add(grip);
      const gripEnd = new THREE.Mesh(new THREE.SphereGeometry(0.043, 20, 12), rubber({ color: 0x2b2d31, roughness: 0.7 }));
      gripEnd.position.copy(pts[4]!).add(new THREE.Vector3(-0.02, 0.002, 0));
      c.add(gripEnd);

      // 다리 + 고무 발 + 보강대
      const legTop = new THREE.Vector3(-0.72, RAIL_Y, z);
      const legBot = new THREE.Vector3(-0.8, -AXLE_Y + 0.03, s * 0.56);
      c.add(new THREE.Mesh(cylBetween(legTop, legBot, 0.028, 20), fm));
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 24), rubber());
      foot.position.copy(legBot).setY(-AXLE_Y + 0.02);
      c.add(foot);
      c.add(new THREE.Mesh(cylBetween(new THREE.Vector3(-0.77, -0.25, s * 0.535), new THREE.Vector3(-0.38, RAIL_Y, z), 0.018, 16), fm));

      // 행어 판 + 차축 보스(구멍 지름 = 차축) + 멈춤 볼트
      const plate = new THREE.Shape();
      plate.moveTo(-0.11, RAIL_Y);
      plate.lineTo(0.11, RAIL_Y);
      plate.lineTo(0.075, 0.0);
      plate.absarc(0, 0, 0.075, 0, Math.PI, true);
      plate.closePath();
      plate.holes.push(new THREE.Path().absarc(0, 0, AXLE_R + 0.001, 0, Math.PI * 2, true));
      const pm = new THREE.Mesh(extrude(plate, 0.026, 0.005, 24), fm);
      pm.position.z = z;
      c.add(pm);
      const boss = new THREE.Mesh(latheZ([[AXLE_R + 0.001, -0.045], [0.08, -0.045], [0.088, -0.037], [0.088, 0.037], [0.08, 0.045], [AXLE_R + 0.001, 0.045], [AXLE_R + 0.001, -0.045]], 48), castIron({ color: 0x4a5058 }));
      boss.position.z = z;
      c.add(boss);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.035, 6), this.steelMat);
      bolt.position.set(0, 0.1, z);
      const boltStem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 12), this.steelMat);
      boltStem.position.set(0, 0.08, z);
      c.add(bolt, boltStem);
    }
    // 가로대 3개
    for (const x of [0.78, 0, -0.72]) {
      c.add(new THREE.Mesh(cylBetween(new THREE.Vector3(x, RAIL_Y, -BOSS_Z), new THREE.Vector3(x, RAIL_Y, BOSS_Z), 0.026, 20), this.frameMat));
    }

    // 흙받이: 바퀴 위를 감싸는 호 + 짐칸 옆면 지지대
    const fender = new THREE.Shape();
    fender.absarc(0, 0, WHEEL_R + 0.09, Math.PI * 0.12, Math.PI * 0.88, false);
    fender.absarc(0, 0, WHEEL_R + 0.06, Math.PI * 0.88, Math.PI * 0.12, true);
    fender.closePath();
    const fGeo = extrude(fender, 0.2, 0.008, 48);
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(fGeo, this.frameMat);
      f.position.z = s * WZ;
      c.add(f);
      const strut = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.04, 0.12, 2, 0.01), this.darkMat);
      strut.position.set(0, WHEEL_R + 0.075, s * 0.62);
      c.add(strut);
    }
  }

  private buildBed(): void {
    const c = this.carriage;
    const plank = wood(0xc08a55);
    const plankDark = wood(0x9c6b3e);
    const y0 = RAIL_Y + 0.032;
    // 바닥 판재
    for (let i = 0; i < 5; i++) {
      const z = -0.48 + i * 0.24;
      c.add(box(1.62, 0.04, 0.225, 0.008, i % 2 ? plank : plankDark, -0.05, y0 + 0.02, z));
    }
    // 옆판·앞뒤판 (두 단)
    for (const s of [-1, 1]) {
      for (const k of [0, 1]) {
        c.add(box(1.62, 0.15, 0.04, 0.01, k ? plank : plankDark, -0.05, y0 + 0.12 + k * 0.16, s * 0.6));
      }
    }
    for (const x of [-0.86, 0.76]) {
      for (const k of [0, 1]) {
        c.add(box(0.04, 0.15, 1.16, 0.01, k ? plankDark : plank, x, y0 + 0.12 + k * 0.16, 0));
      }
    }
    // 모서리 강판 + 리벳
    const cornerMat = this.darkMat;
    for (const x of [-0.86, 0.76]) {
      for (const s of [-1, 1]) {
        c.add(box(0.07, 0.33, 0.07, 0.01, cornerMat, x, y0 + 0.2, s * 0.6));
      }
    }
    // 짐: 종이 상자 2개 + 테이프
    const cardboard = plastic(0xc49a62, { roughness: 0.85 });
    const tape = plastic(0xe3cf9e, { roughness: 0.5 });
    const b1 = new THREE.Group();
    b1.add(box(0.52, 0.4, 0.46, 0.015, cardboard, 0, 0.2, 0));
    b1.add(box(0.53, 0.012, 0.09, 0.004, tape, 0, 0.401, 0));
    b1.position.set(-0.4, y0 + 0.04, 0.12);
    b1.rotation.y = 0.12;
    const b2 = new THREE.Group();
    b2.add(box(0.4, 0.32, 0.36, 0.015, cardboard, 0, 0.16, 0));
    b2.add(box(0.41, 0.012, 0.08, 0.004, tape, 0, 0.321, 0));
    b2.position.set(0.3, y0 + 0.04, -0.2);
    b2.rotation.y = -0.2;
    c.add(b1, b2);
  }

  private buildSawhorse(): void {
    const g = this.sawhorse;
    const wd = wood(0xb07c4a);
    const topY = AXLE_Y + RAIL_Y - 0.032;
    g.add(box(0.12, 0.08, 1.12, 0.012, wd, SAW_X, topY - 0.04, 0));
    for (const s of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const a = new THREE.Vector3(SAW_X + sx * 0.03, topY - 0.06, s * 0.48);
        const b = new THREE.Vector3(SAW_X + sx * 0.2, 0.0, s * 0.54);
        const m = new THREE.Mesh(new RoundedBoxGeometry(0.06, a.distanceTo(b), 0.06, 2, 0.01), wd);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        g.add(m);
      }
      g.add(box(0.36, 0.05, 0.03, 0.008, wd, SAW_X, 0.2, s * 0.525));
    }
  }

  /** 바닥 눈금(+Z 바퀴 옆): 수레가 실제로 이동하는 거리가 보인다 */
  private buildFloorMarks(): void {
    const geos: THREE.BufferGeometry[] = [];
    for (let i = -8; i <= 8; i++) {
      const long = i % 4 === 0;
      const g = new THREE.BoxGeometry(0.025, 0.006, long ? 0.16 : 0.09);
      g.translate(i * 0.2, 0.003, long ? 1.0 : 0.965);
      geos.push(g);
    }
    const line = new THREE.BoxGeometry(3.25, 0.006, 0.02);
    line.translate(0, 0.003, 0.93);
    geos.push(line);
    const m = new THREE.Mesh(merge(geos), plastic(0x8d99a6, { roughness: 0.7 }));
    m.castShadow = false;
    this.group.add(m);
  }

  /** 철판 디스크 바퀴: 트레드 타이어 + 림 + 구멍 뚫린 디스크 + 허브(구멍 = 차축 지름) + 밸브 */
  private buildWheel(): THREE.Group {
    const w = new THREE.Group();
    const RT = WHEEL_R - TIRE_TUBE;
    const tireGeo = new THREE.TorusGeometry(RT, TIRE_TUBE, 20, 200);
    const p = tireGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const th = Math.atan2(v.y, v.x);
      const cx = Math.cos(th) * RT;
      const cy = Math.sin(th) * RT;
      const dx = v.x - cx;
      const dy = v.y - cy;
      const out = (dx * Math.cos(th) + dy * Math.sin(th)) / TIRE_TUBE;
      if (out > 0.3) {
        const band = THREE.MathUtils.smoothstep(out, 0.3, 0.65);
        const zc = v.z / TIRE_TUBE;
        const s = THREE.MathUtils.smoothstep(Math.sin(th * 28 + Math.sign(zc) * 1.4), -0.2, 0.2);
        const k = 1 + 0.12 * s * band;
        v.set(cx + dx * k, cy + dy * k, v.z * (1 + 0.04 * s * band));
        p.setXYZ(i, v.x, v.y, v.z);
      }
    }
    tireGeo.computeVertexNormals();
    // 트레드 돌기만큼 커진 반지름을 원래 바깥 반지름에 맞춘다(바닥 접지 = y 0)
    const sc = WHEEL_R / (RT + TIRE_TUBE * 1.12);
    tireGeo.scale(sc, sc, 1);
    w.add(new THREE.Mesh(tireGeo, rubber({ color: 0x232529 })));

    const wheelPaint = paint(0xf2b619, { roughness: 0.35 });
    w.add(new THREE.Mesh(latheZ([[0.34, -0.062], [0.36, -0.07], [0.375, -0.068], [0.37, -0.055], [0.355, -0.05], [0.355, 0.05], [0.37, 0.055], [0.375, 0.068], [0.36, 0.07], [0.34, 0.062], [0.34, -0.062]], 96), wheelPaint));
    // 디스크: 구멍 5개
    const disc = new THREE.Shape();
    disc.absarc(0, 0, 0.345, 0, Math.PI * 2, false);
    disc.holes.push(new THREE.Path().absarc(0, 0, 0.074, 0, Math.PI * 2, true));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      disc.holes.push(new THREE.Path().absarc(Math.cos(a) * 0.215, Math.sin(a) * 0.215, 0.062, 0, Math.PI * 2, true));
    }
    w.add(new THREE.Mesh(extrude(disc, 0.016, 0.004, 40), wheelPaint));
    // 허브: 축 구멍(지름 = 차축)이 뚫린 관 + 플랜지
    w.add(
      new THREE.Mesh(
        latheZ(
          [
            [AXLE_R + 0.001, -HUB_HALF], [0.07, -HUB_HALF], [0.075, -HUB_HALF + 0.006], [0.075, -0.02], [0.095, -0.012],
            [0.095, 0.012], [0.075, 0.02], [0.075, HUB_HALF - 0.006], [0.07, HUB_HALF], [AXLE_R + 0.001, HUB_HALF], [AXLE_R + 0.001, -HUB_HALF]
          ],
          48
        ),
        this.darkMat
      )
    );
    // 허브 볼트 6개(회전이 보이는 표식)
    const boltGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6);
      b.rotateX(Math.PI / 2);
      b.translate(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0);
      boltGeos.push(b);
    }
    w.add(new THREE.Mesh(merge(boltGeos), chrome()));
    const valve = new THREE.Mesh(cylBetween(new THREE.Vector3(0.3, 0, 0.02), new THREE.Vector3(0.36, 0, 0.02), 0.01, 12), chrome());
    valve.rotation.z = Math.PI / 5;
    w.add(valve);
    return w;
  }
}
