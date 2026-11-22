// 캠 오토마타: 전동축과 캠 미션 — 손잡이 회전(40rpm) → 캠 3개(120° 위상차) → 종동절 상하 왕복
// 종동절 롤러 높이는 매 프레임 캠 윤곽(메시와 같은 표본점)에서 직접 계산한다 — 관통·이격 없음.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';
import { brass, darkSteel, paint, plastic, steel, wood } from '../models/materials';

// ── 치수 (상자 폭 2.4 = 실물 장난감 약 30cm) ──
const CM_PER_UNIT = 12.5;
const HALF_W = 1.2;
const HALF_D = 0.6;
const WALL = 0.08;
const PLINTH_H = 0.12;
const TOP_Y = 1.34;
const TOP_T = 0.08;
const SHAFT_Y = 0.56;
const SHAFT_R = 0.045;
const CAM_X = [-0.72, 0, 0.72] as const;
const CAM_T = 0.1;
const ROLLER_R = 0.05;
const ROLLER_T = 0.12;
const REST_Y = SHAFT_Y + 0.2; // 캠이 없을 때 칼라가 부싱에 걸려 멈추는 롤러 중심 높이
const BUSH_H = 0.06;
const BUSH_TOP = TOP_Y + TOP_T / 2 + BUSH_H;
const COLLAR_OFF = BUSH_TOP - REST_Y;
const FIG_OFF = 0.88;
const CRANK_R = 0.32;
const RPM = 40;
const SAMPLES = 200;

type Profile = THREE.Vector2[];

/** 캠 윤곽 표본 (u,v): 캠 국소 평면. 메시와 종동절 계산이 같은 점을 쓴다. */
function camProfiles(): Profile[] {
  const egg: Profile = [];
  const ecc: Profile = [];
  const heart: Profile = [];
  for (let i = 0; i < SAMPLES; i++) {
    const a = (i / SAMPLES) * Math.PI * 2;
    // 달걀형(배 모양): 기초원 + 매끈한 돌출부
    const re = 0.2 + 0.14 * Math.pow((1 + Math.cos(a)) / 2, 2.5);
    egg.push(new THREE.Vector2(Math.cos(a) * re, Math.sin(a) * re));
    // 편심 원: 반지름 0.25 원의 중심이 축에서 0.08 떨어짐 → 행정 0.16
    ecc.push(new THREE.Vector2(0.08 + 0.25 * Math.cos(a), 0.25 * Math.sin(a)));
    // 하트형(등속 캠): 반지름이 각도에 비례해 증가 → 종동절이 일정한 속도로 오르내림
    const w = a <= Math.PI ? a : Math.PI * 2 - a;
    const rh = 0.17 + 0.16 * (w / Math.PI);
    heart.push(new THREE.Vector2(Math.cos(a) * rh, Math.sin(a) * rh));
  }
  return [egg, ecc, heart];
}

/** 캠 각도 alpha(축 rotation.x)일 때 수직 롤러 종동절 중심 높이(축 중심 기준) */
function rollerHeight(profile: Profile, alpha: number): number {
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  let best = -Infinity;
  for (const p of profile) {
    // 메시 변환과 동일: 국소 (u,v) → (y=v, z=-u) → X축 회전
    const y0 = p.y;
    const z0 = -p.x;
    const Y = y0 * c - z0 * s;
    const Z = y0 * s + z0 * c;
    if (Math.abs(Z) < ROLLER_R) {
      const h = Y + Math.sqrt(ROLLER_R * ROLLER_R - Z * Z);
      if (h > best) best = h;
    }
  }
  return best;
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

/** X축 방향 원기둥 */
function cylX(r: number, len: number, seg = 24): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** 모따기 있는 링(부싱·칼라) — Lathe 단면, 축 = Y */
function ringGeo(rIn: number, rOut: number, h: number, seg = 32): THREE.LatheGeometry {
  const c = Math.min(0.008, h * 0.25, (rOut - rIn) * 0.25);
  const pts = [
    new THREE.Vector2(rIn, -h / 2),
    new THREE.Vector2(rOut - c, -h / 2),
    new THREE.Vector2(rOut, -h / 2 + c),
    new THREE.Vector2(rOut, h / 2 - c),
    new THREE.Vector2(rOut - c, h / 2),
    new THREE.Vector2(rIn, h / 2),
    new THREE.Vector2(rIn, -h / 2)
  ];
  return new THREE.LatheGeometry(pts, seg);
}

/** Shape를 두께 depth로 압출해 국소 Z 중심 정렬 (bevelOffset으로 외곽 치수 유지) */
function extrude(shape: THREE.Shape, depth: number, bevel = 0.01, curveSegments = 24): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

interface Follower {
  group: THREE.Group;
  roller: THREE.Mesh;
  y: number;
}

export class CamAutomata extends BaseMachine {
  readonly id = 'automata';
  private shaftPivot = new THREE.Group();
  private shaftModel: THREE.Group | null = null;
  private camModel: THREE.Group | null = null;
  private followers: Follower[] = [];
  private profiles = camProfiles();
  private readonly phases = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  private angle = 0;

  // 재질은 기계 안에서 재사용(드로콜·메모리 절약)
  private readonly woodLight = wood(0xc99a66);
  private readonly woodDark = wood(0x8a5a35);
  private readonly brassMat = brass();
  private readonly steelMat = steel();

  constructor() {
    super();
    this.buildBox();
    this.buildFollowers();
    this.shaftPivot.position.set(0, SHAFT_Y, 0);
    this.group.add(this.shaftPivot);

    this.addSlot(0, 0.13, new THREE.Vector3(HALF_W + 0.05, SHAFT_Y, 0), 0.022);
    this.slots[0]!.rotation.y = Math.PI / 2;
    this.addCamSlot();
    this.hideSlot(1);
    for (const s of this.slots) if (s) s.userData.noAO = true;
    shadowAll(this.group);
    for (const s of this.slots) if (s) s.castShadow = s.receiveShadow = false;
    this.setFollowersRest();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.shaftModel !== null : this.camModel !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, SHAFT_Y, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(HALF_W + 0.05, SHAFT_Y, 0) : new THREE.Vector3(0, SHAFT_Y, 0.3);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildShaft() : this.buildCams();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.shaftPivot.add(model);
    if (step === 0) {
      this.shaftModel = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.camModel = model;
      this.hideSlot(1);
      this.updateFollowers(0);
    }
  }

  reset(): void {
    if (this.shaftModel) this.shaftPivot.remove(this.shaftModel);
    if (this.camModel) this.shaftPivot.remove(this.camModel);
    this.shaftModel = null;
    this.camModel = null;
    this.angle = 0;
    this.shaftPivot.rotation.x = 0;
    this.setFollowersRest();
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.shaftModel || !this.camModel) throw new Error('automata mission incomplete');
    const w = (RPM / 60) * Math.PI * 2;
    // 캠별 행정 = 한 바퀴 동안 롤러 높이의 최댓값 - 최솟값
    let maxStroke = 0;
    this.profiles.forEach((p) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < 360; i++) {
        const h = rollerHeight(p, (i / 360) * Math.PI * 2);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      maxStroke = Math.max(maxStroke, hi - lo);
    });
    const display: MachineDisplayItem[] = [
      { label: '손잡이 회전수', value: String(RPM), unit: 'rpm', tone: 'blue' },
      { label: '캠 1회전당 왕복', value: '1', unit: '회' },
      { label: '종동절 행정', value: (maxStroke * CM_PER_UNIT).toFixed(1), unit: 'cm', tone: 'red' }
    ];
    return {
      update: (dt: number) => {
        const da = w * dt;
        this.angle = (this.angle + da) % (Math.PI * 2);
        this.shaftPivot.rotation.x = this.angle;
        this.updateFollowers(da);
      },
      getDisplay: () => display
    };
  }

  // ── 종동절 ──

  private setFollowersRest(): void {
    for (const f of this.followers) {
      f.y = REST_Y;
      f.group.position.y = REST_Y;
    }
  }

  private updateFollowers(dAngle: number): void {
    this.followers.forEach((f, i) => {
      const profile = this.profiles[i]!;
      const h = rollerHeight(profile, this.angle + this.phases[i]!);
      f.y = SHAFT_Y + h;
      f.group.position.y = f.y;
      // 롤러는 접촉점에서 미끄럼 없이 구른다: 캠 표면 속도 ≈ ω·(접촉 반지름)
      const rContact = Math.max(0, h - ROLLER_R);
      f.roller.rotation.x -= (dAngle * rContact) / ROLLER_R;
    });
  }

  private buildFollowers(): void {
    const rollerMat = darkSteel();
    const forkMat = this.brassMat;
    const rollerGeo = cylX(ROLLER_R, ROLLER_T, 28);
    const rimGeo = new THREE.TorusGeometry(ROLLER_R - 0.004, 0.006, 8, 28);
    rimGeo.rotateY(Math.PI / 2);
    const plateGeo = new RoundedBoxGeometry(0.014, 0.17, 0.07, 2, 0.006);
    const pinGeo = cylX(0.013, ROLLER_T + 0.06, 12);
    const bridgeGeo = new RoundedBoxGeometry(ROLLER_T + 0.044, 0.035, 0.07, 2, 0.008);
    const rodLen = FIG_OFF - 0.15;
    const rodGeo = new THREE.CylinderGeometry(0.022, 0.022, rodLen, 18);
    const collarGeo = ringGeo(0.02, 0.05, 0.04, 28);
    const platGeo = ringGeo(0.0, 0.12, 0.03, 36);

    const figures = [this.buildBird(), this.buildFish(), this.buildStar()];
    CAM_X.forEach((x, i) => {
      const g = new THREE.Group();
      g.position.set(x, REST_Y, 0);
      const roller = new THREE.Mesh(rollerGeo, rollerMat);
      const rim1 = new THREE.Mesh(rimGeo, this.steelMat);
      rim1.position.x = ROLLER_T / 2;
      const rim2 = new THREE.Mesh(rimGeo, this.steelMat);
      rim2.position.x = -ROLLER_T / 2;
      roller.add(rim1, rim2);
      g.add(roller);
      for (const sx of [-1, 1]) {
        const plate = new THREE.Mesh(plateGeo, forkMat);
        plate.position.set(sx * (ROLLER_T / 2 + 0.015), 0.055, 0);
        g.add(plate);
      }
      g.add(new THREE.Mesh(pinGeo, this.steelMat));
      const bridge = new THREE.Mesh(bridgeGeo, forkMat);
      bridge.position.y = 0.15;
      g.add(bridge);
      const rod = new THREE.Mesh(rodGeo, this.steelMat);
      rod.position.y = 0.15 + rodLen / 2;
      g.add(rod);
      const collar = new THREE.Mesh(collarGeo, this.brassMat);
      collar.position.y = COLLAR_OFF + 0.02;
      g.add(collar);
      const plat = new THREE.Mesh(platGeo, this.woodDark);
      plat.position.y = FIG_OFF;
      g.add(plat);
      const fig = figures[i]!;
      fig.position.y = FIG_OFF + 0.015;
      g.add(fig);
      this.group.add(g);
      this.followers.push({ group: g, roller, y: REST_Y });
    });
  }

  // ── 인형 (저폴리) ──

  private lowPoly(color: number): THREE.MeshStandardMaterial {
    const m = plastic(color, { grain: false, roughness: 0.5 });
    m.flatShading = true;
    return m;
  }

  private eyes(g: THREE.Group, x: number, y: number, zOff: number, r = 0.014): void {
    const eyeMat = plastic(0x15171a, { grain: false, roughness: 0.25 });
    const geo = new THREE.SphereGeometry(r, 12, 8);
    for (const sz of [-1, 1]) {
      const e = new THREE.Mesh(geo, eyeMat);
      e.position.set(x, y, sz * zOff);
      g.add(e);
    }
  }

  private buildBird(): THREE.Group {
    const g = new THREE.Group();
    const body = this.lowPoly(0xf2b619);
    const orange = this.lowPoly(0xf08a24);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), body);
    b.scale.set(1.25, 0.95, 0.95);
    b.position.y = 0.1;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), body);
    head.position.set(0.1, 0.21, 0);
    const beakGeo = new THREE.ConeGeometry(0.026, 0.075, 6);
    beakGeo.rotateZ(-Math.PI / 2);
    const beak = new THREE.Mesh(beakGeo, orange);
    beak.position.set(0.2, 0.205, 0);
    const tailGeo = new THREE.ConeGeometry(0.045, 0.12, 5);
    tailGeo.rotateZ(Math.PI / 2 + 0.5);
    const tail = new THREE.Mesh(tailGeo, orange);
    tail.position.set(-0.15, 0.15, 0);
    g.add(b, head, beak, tail);
    const wingGeo = new THREE.IcosahedronGeometry(0.07, 1);
    for (const sz of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, orange);
      wing.scale.set(1.3, 0.45, 0.35);
      wing.rotation.set(sz * 0.25, 0, 0.35);
      wing.position.set(-0.02, 0.13, sz * 0.095);
      g.add(wing);
    }
    this.eyes(g, 0.145, 0.235, 0.048);
    return g;
  }

  private buildFish(): THREE.Group {
    const g = new THREE.Group();
    const body = this.lowPoly(0x3d9be0);
    const fin = this.lowPoly(0x9fd3f5);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 12), this.brassMat);
    post.position.y = 0.05;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), body);
    b.scale.set(1.6, 1.0, 0.55);
    b.position.y = 0.17;
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(-0.12, 0.08);
    tailShape.lineTo(-0.09, 0);
    tailShape.lineTo(-0.12, -0.08);
    tailShape.closePath();
    const tail = new THREE.Mesh(extrude(tailShape, 0.03, 0.008, 4), fin);
    tail.position.set(-0.13, 0.17, 0);
    const dorsal = new THREE.Shape();
    dorsal.moveTo(-0.06, 0);
    dorsal.lineTo(0.03, 0);
    dorsal.lineTo(-0.05, 0.07);
    dorsal.closePath();
    const dor = new THREE.Mesh(extrude(dorsal, 0.02, 0.006, 4), fin);
    dor.position.set(0, 0.255, 0);
    g.add(post, b, tail, dor);
    this.eyes(g, 0.1, 0.19, 0.046, 0.013);
    return g;
  }

  private buildStar(): THREE.Group {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.17 : 0.075;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 12), this.brassMat);
    post.position.y = 0.05;
    const star = new THREE.Mesh(extrude(shape, 0.07, 0.02, 4), this.lowPoly(0xef6f8e));
    // 아래 두 다리 끝(y=-0.1375)이 받침판 위에 뜨고, 다리 사이 오목점에 기둥이 꽂히도록
    star.position.y = 0.155;
    g.add(post, star);
    const eyeMat = plastic(0x15171a, { grain: false, roughness: 0.25 });
    const eyeGeo = new THREE.SphereGeometry(0.014, 12, 8);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, eyeMat);
      e.position.set(sx * 0.03, star.position.y + 0.02, 0.035);
      g.add(e);
    }
    return g;
  }

  // ── 미션 부품 ──

  private buildShaft(): THREE.Group {
    const g = new THREE.Group();
    const xL = -HALF_W - 0.1;
    const xR = HALF_W + 0.17;
    const shaft = new THREE.Mesh(cylX(SHAFT_R, xR - xL, 24), this.steelMat);
    shaft.position.x = (xL + xR) / 2;
    g.add(shaft);
    const blue = paint(0x2f7fd0, { roughness: 0.38 });
    // 왼쪽 멈춤 칼라
    const collarL = new THREE.Mesh(ringGeo(SHAFT_R, 0.075, 0.05, 32), blue);
    collarL.rotation.z = Math.PI / 2;
    collarL.position.x = -HALF_W - 0.07;
    g.add(collarL);
    // 크랭크 팔: 축 중심에서 +Y 방향으로 CRANK_R
    const arm = new THREE.Shape();
    arm.absarc(0, 0, 0.08, Math.PI, Math.PI * 2, false);
    arm.absarc(0, CRANK_R, 0.055, 0, Math.PI, false);
    arm.closePath();
    const armGeo = extrude(arm, 0.06, 0.012, 24);
    armGeo.rotateY(Math.PI / 2);
    const armMesh = new THREE.Mesh(armGeo, blue);
    armMesh.position.x = HALF_W + 0.11;
    g.add(armMesh);
    // 손잡이(나무 손잡이 + 축 핀)
    const pin = new THREE.Mesh(cylX(0.018, 0.08, 12), this.steelMat);
    pin.position.set(HALF_W + 0.17, CRANK_R, 0);
    const knobPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const y = t * 0.26;
      const r = 0.038 + 0.012 * Math.sin(t * Math.PI) - (t > 0.88 ? (t - 0.88) * 0.25 : 0);
      knobPts.push(new THREE.Vector2(Math.max(0.005, r), y));
    }
    knobPts.unshift(new THREE.Vector2(0.001, 0));
    knobPts.push(new THREE.Vector2(0.001, 0.26));
    const knobGeo = new THREE.LatheGeometry(knobPts, 24);
    knobGeo.rotateZ(-Math.PI / 2);
    const knob = new THREE.Mesh(knobGeo, this.woodLight);
    knob.position.set(HALF_W + 0.17, CRANK_R, 0);
    g.add(pin, knob);
    return g;
  }

  private buildCams(): THREE.Group {
    const g = new THREE.Group();
    const camMat = paint(0xc8483f, { roughness: 0.45 });
    const hubGeo = ringGeo(SHAFT_R, 0.085, CAM_T + 0.07, 32);
    hubGeo.rotateZ(Math.PI / 2);
    const screwGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10);
    this.profiles.forEach((p, i) => {
      const shape = new THREE.Shape(p);
      const hole = new THREE.Path();
      hole.absarc(0, 0, SHAFT_R + 0.002, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const geo = extrude(shape, CAM_T, 0.014, 48);
      geo.rotateY(Math.PI / 2);
      const cam = new THREE.Group();
      cam.position.x = CAM_X[i]!;
      cam.rotation.x = this.phases[i]!;
      cam.add(new THREE.Mesh(geo, camMat));
      const hub = new THREE.Mesh(hubGeo, this.brassMat);
      cam.add(hub);
      for (const sx of [-1, 1]) {
        const screw = new THREE.Mesh(screwGeo, this.steelMat);
        screw.position.set(sx * (CAM_T / 2 + 0.02), 0.088, 0);
        cam.add(screw);
      }
      g.add(cam);
    });
    return g;
  }

  // ── 슬롯 ──

  private addCamSlot(): void {
    const geos = CAM_X.map((x) => {
      const t = new THREE.TorusGeometry(0.37, 0.02, 10, 48);
      t.rotateY(Math.PI / 2);
      t.translate(x, SHAFT_Y, 0);
      return t;
    });
    const merged = mergeGeometries(geos);
    geos.forEach((t) => t.dispose());
    const ring = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.userData.slot = true;
    this.slots[1] = ring;
    this.group.add(ring);
  }

  // ── 상자 ──

  private buildBox(): void {
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(2.75, PLINTH_H, 1.55, 3, 0.03), this.woodDark);
    plinth.position.y = PLINTH_H / 2;
    this.group.add(plinth);

    const wallH = TOP_Y - TOP_T / 2 - PLINTH_H;
    // 옆판: 축 베어링 구멍이 뚫린 판 (Shape 국소 x → 세계 -z)
    const side = new THREE.Shape();
    side.moveTo(-HALF_D, PLINTH_H);
    side.lineTo(HALF_D, PLINTH_H);
    side.lineTo(HALF_D, PLINTH_H + wallH);
    side.lineTo(-HALF_D, PLINTH_H + wallH);
    side.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, SHAFT_Y, 0.07, 0, Math.PI * 2, true);
    side.holes.push(hole);
    const sideGeo = extrude(side, WALL, 0.012, 32);
    sideGeo.rotateY(Math.PI / 2);
    const bushGeo = ringGeo(SHAFT_R + 0.004, 0.1, 0.04, 32);
    bushGeo.rotateZ(Math.PI / 2);
    const bushInGeo = ringGeo(SHAFT_R + 0.004, 0.07, WALL + 0.004, 32);
    bushInGeo.rotateZ(Math.PI / 2);
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(sideGeo, this.woodLight);
      wall.position.x = sx * (HALF_W - WALL / 2);
      this.group.add(wall);
      const bush = new THREE.Mesh(bushGeo, this.brassMat);
      bush.position.set(sx * (HALF_W + 0.02), SHAFT_Y, 0);
      const bushIn = new THREE.Mesh(bushInGeo, this.brassMat);
      bushIn.position.set(sx * (HALF_W - WALL / 2), SHAFT_Y, 0);
      this.group.add(bush, bushIn);
    }

    const back = new THREE.Mesh(new RoundedBoxGeometry(2 * HALF_W - 2 * WALL + 0.01, wallH, WALL, 2, 0.01), this.woodLight);
    back.position.set(0, PLINTH_H + wallH / 2, -HALF_D + WALL / 2);
    this.group.add(back);
    // 앞쪽 낮은 앞판(전면은 개방 — 캠이 보이도록)
    const apron = new THREE.Mesh(new RoundedBoxGeometry(2 * HALF_W - 2 * WALL + 0.01, 0.09, WALL, 2, 0.01), this.woodLight);
    apron.position.set(0, PLINTH_H + 0.045, HALF_D - WALL / 2);
    this.group.add(apron);

    // 윗판: 종동절 안내 구멍 3개
    const top = new THREE.Shape();
    top.moveTo(-HALF_W - 0.04, -HALF_D - 0.04);
    top.lineTo(HALF_W + 0.04, -HALF_D - 0.04);
    top.lineTo(HALF_W + 0.04, HALF_D + 0.04);
    top.lineTo(-HALF_W - 0.04, HALF_D + 0.04);
    top.closePath();
    for (const x of CAM_X) {
      const h = new THREE.Path();
      h.absarc(x, 0, 0.034, 0, Math.PI * 2, true);
      top.holes.push(h);
    }
    const topGeo = extrude(top, TOP_T, 0.014, 24);
    topGeo.rotateX(Math.PI / 2); // Shape y → 세계 z, 압출 → 세계 y
    const topMesh = new THREE.Mesh(topGeo, this.woodLight);
    topMesh.position.y = TOP_Y;
    this.group.add(topMesh);
    const guideGeo = ringGeo(0.025, 0.07, BUSH_H, 32);
    const guideUnderGeo = ringGeo(0.025, 0.055, 0.05, 28);
    for (const x of CAM_X) {
      const guide = new THREE.Mesh(guideGeo, this.brassMat);
      guide.position.set(x, TOP_Y + TOP_T / 2 + BUSH_H / 2, 0);
      const under = new THREE.Mesh(guideUnderGeo, this.brassMat);
      under.position.set(x, TOP_Y - TOP_T / 2 - 0.025, 0);
      this.group.add(guide, under);
    }
  }
}
