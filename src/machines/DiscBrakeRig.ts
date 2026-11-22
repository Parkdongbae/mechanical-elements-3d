// 디스크 브레이크: 볼 베어링과 디스크 브레이크 미션 — 정비대 위 자동차 앞바퀴 코너 모듈
// 6초 주기: 가속 → 정속 → 제동(부동형 캘리퍼: 피스톤이 안쪽 패드를, 반력으로 몸체가 바깥 패드를 디스크에 붙임) → 정지 → 해제.
// 좌표: 바퀴 축 = Z, +Z가 차체 안쪽(카메라 쪽), 휠은 -Z(바깥쪽).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BaseMachine, type MachineSim } from './types';
import { aluminum, castIron, chrome, darkSteel, paint, plastic, rubber, steel } from '../models/materials';

const HUB = new THREE.Vector3(0, 1.5, 0);
const TIRE_DIAMETER_M = 0.66; // 화면 타이어 지름 2.0 ≈ 실물 0.66m
const MAX_RPM = 200;
const CYCLE = 6;

// 디스크
const DISC_RO = 0.54;
const DISC_RI = 0.27;
const DISC_Z0 = 0.05;
const DISC_Z1 = 0.17;
// 캘리퍼
const CAL_ANGLE = (35 * Math.PI) / 180;
const PAD_GAP = 0.025;
// 휠
const WAIT_POS = new THREE.Vector3(1.45, 1.0, -1.35);

// 스트럿 축(허브 기준 국소 좌표)
const STRUT_B = new THREE.Vector3(0, 0.66, 0.34);
const STRUT_T = new THREE.Vector3(-0.04, 1.95, 0.66);

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
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

/** Lathe(축 Y) → 축 Z로 돌린 회전체 */
function latheZ(pts: [number, number][], seg = 64): THREE.LatheGeometry {
  const g = new THREE.LatheGeometry(
    pts.map(([r, z]) => new THREE.Vector2(r, z)),
    seg
  );
  g.rotateX(Math.PI / 2); // 국소 y(축방향) → 세계 z
  return g;
}

/** 모따기 링 단면 (r0~r1, z0~z1) */
function ringZ(r0: number, r1: number, z0: number, z1: number, seg = 64, c = 0.008): THREE.LatheGeometry {
  return latheZ(
    [
      [r0, z0],
      [r1 - c, z0],
      [r1, z0 + c],
      [r1, z1 - c],
      [r1 - c, z1],
      [r0, z1],
      [r0, z0]
    ],
    seg
  );
}

/** 압출(국소 Z 방향 z0~z1), 외곽 치수 유지 모따기 */
function extrudeZ(shape: THREE.Shape, z0: number, z1: number, bevel = 0.008, curveSegments = 16): THREE.ExtrudeGeometry {
  const depth = z1 - z0;
  const b = Math.min(bevel, depth * 0.3);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 2,
    curveSegments
  });
  g.translate(0, 0, z0 + b);
  return g;
}

/** 환형 부채꼴(중심각 ±half, 국소 +X가 중심 방향) */
function sector(r0: number, r1: number, half: number, z0: number, z1: number, bevel = 0.01): THREE.ExtrudeGeometry {
  return sectorAB(r0, r1, -half, half, z0, z1, bevel);
}

/** 환형 부채꼴(각도 a0~a1) */
function sectorAB(r0: number, r1: number, a0: number, a1: number, z0: number, z1: number, bevel = 0.01): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  s.closePath();
  return extrudeZ(s, z0, z1, bevel, 24);
}

/** 두 점을 잇는 원기둥/상자 배치용: Y축을 a→b 방향으로 */
function alignY(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): number {
  const d = b.clone().sub(a);
  const len = d.length();
  obj.position.copy(a).addScaledVector(d, 0.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return len;
}

export class DiscBrakeRig extends BaseMachine {
  readonly id = 'discbrake';
  private hubFrame = new THREE.Group();
  private spin = new THREE.Group();
  private wheel: THREE.Group;
  private bearingModel: THREE.Group | null = null;
  private brakeModel: THREE.Group | null = null;
  private hubRot: THREE.Object3D | null = null;
  private cage: THREE.Object3D | null = null;
  private discRot: THREE.Object3D | null = null;
  private caliperBody: THREE.Object3D | null = null;
  private innerPad: THREE.Object3D | null = null;
  private discMat: THREE.MeshStandardMaterial | null = null;
  private caliperMat: THREE.MeshPhysicalMaterial | null = null;
  private mount: { t: number; last: number } | null = null;
  private spinAngle = 0;
  private omega = 0;
  private brake = 0;
  private heat = 0;

  private readonly castMat = castIron({ color: 0x4a5058 });
  private readonly steelMat = steel();
  private readonly standMat = paint(0x46525e, { roughness: 0.5 });

  constructor() {
    super();
    this.hubFrame.position.copy(HUB);
    this.hubFrame.add(this.spin);
    this.group.add(this.hubFrame);
    this.buildStand();
    this.buildKnuckle();
    this.buildStrut();
    this.wheel = this.buildWheel();
    this.wheel.position.copy(WAIT_POS);
    this.group.add(this.wheel);
    this.buildChocks();

    this.addSlot(0, 0.19, HUB.clone().add(new THREE.Vector3(0, 0, 0.37)), 0.022);
    this.addSlot(1, 0.47, HUB.clone().add(new THREE.Vector3(0, 0, 0.11)), 0.024);
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
    return step === 0 ? this.bearingModel !== null : this.brakeModel !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return HUB.clone();
  }

  slotTarget(step: number): THREE.Vector3 {
    return HUB.clone().add(new THREE.Vector3(0, 0, step === 0 ? 0.4 : 0.3));
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildBearing() : this.buildBrake();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.hubFrame.add(model);
    if (step === 0) {
      this.bearingModel = model;
      // 회전 부분(내륜·허브 플랜지)은 spin, 볼은 케이지 속도로 따로 돈다
      const rot = model.getObjectByName('hubRot');
      if (rot) {
        this.spin.add(rot);
        this.hubRot = rot;
      }
      this.cage = model.getObjectByName('cage') ?? null;
      this.hideSlot(0);
      this.showSlot(1);
      this.mount = { t: 0, last: -1 };
    } else {
      this.brakeModel = model;
      const disc = model.getObjectByName('discRot');
      if (disc) {
        this.spin.add(disc);
        this.discRot = disc;
      }
      this.caliperBody = model.getObjectByName('caliperBody') ?? null;
      this.innerPad = model.getObjectByName('innerPad') ?? null;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.hubRot) this.spin.remove(this.hubRot);
    if (this.discRot) this.spin.remove(this.discRot);
    if (this.bearingModel) this.hubFrame.remove(this.bearingModel);
    if (this.brakeModel) this.hubFrame.remove(this.brakeModel);
    this.bearingModel = this.brakeModel = null;
    this.hubRot = this.cage = this.discRot = this.caliperBody = this.innerPad = null;
    this.discMat = null;
    this.caliperMat = null;
    this.spin.remove(this.wheel);
    this.group.add(this.wheel);
    this.wheel.position.copy(WAIT_POS);
    this.wheel.rotation.set(0, 0, 0);
    this.mount = null;
    this.spinAngle = this.omega = this.brake = this.heat = 0;
    this.spin.rotation.z = 0;
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (!this.mount) return;
    // 베어링 장착 후 바퀴가 옆에서 들려 와 허브 볼트에 끼워지는 연출 (바깥쪽 -Z에서 축 방향으로 밀어 넣음)
    const dt = this.mount.last < 0 ? 0 : Math.min(0.05, t - this.mount.last);
    this.mount.last = t;
    this.mount.t += dt / 1.8;
    const k = Math.min(1, this.mount.t);
    const front = HUB.clone().add(new THREE.Vector3(0, 0, -1.25));
    const p = new THREE.Vector3();
    if (k < 0.6) {
      const a = smooth(k / 0.6);
      p.lerpVectors(WAIT_POS, front, a);
      p.y += Math.sin(a * Math.PI) * 0.25;
    } else {
      p.lerpVectors(front, HUB, smooth((k - 0.6) / 0.4));
    }
    this.wheel.position.copy(p);
    this.wheel.rotation.z = this.spinAngle; // 휠 볼트 구멍을 허브 볼트 위상에 맞춘다
    if (k >= 1) {
      this.mount = null;
      this.wheel.position.set(0, 0, 0);
      this.wheel.rotation.set(0, 0, 0);
      this.spin.add(this.wheel);
    }
  }

  createSim(): MachineSim {
    if (!this.bearingModel || !this.brakeModel) throw new Error('discbrake mission incomplete');
    const wMax = (MAX_RPM / 60) * Math.PI * 2;
    let time = 0;
    return {
      update: (dt: number) => {
        time = (time + dt) % CYCLE;
        const tc = time;
        // 브레이크 압력(0~1): 2.8초에 밟고 4.9초에 뗀다
        if (tc < 2.8) this.brake = 0;
        else if (tc < 2.95) this.brake = smooth((tc - 2.8) / 0.15);
        else if (tc < 4.9) this.brake = 1;
        else if (tc < 5.1) this.brake = 1 - smooth((tc - 4.9) / 0.2);
        else this.brake = 0;
        // 회전 속도: 가속 → 정속 → 제동 중 일정한 마찰 토크로 선형 감속 → 정지
        if (tc < 1.6) this.omega = wMax * smooth(tc / 1.6);
        else if (tc < 2.95) this.omega = wMax;
        else this.omega = wMax * Math.max(0, 1 - (tc - 2.95) / 1.35);
        // 마찰열: 패드 압력 × 미끄럼 속도에 비례해 오르고 서서히 식는다
        this.heat += (this.brake * (this.omega / wMax) * 1.5 - this.heat * 0.45) * dt;
        this.heat = Math.max(0, Math.min(1, this.heat));

        this.spinAngle = (this.spinAngle + this.omega * dt) % (Math.PI * 2);
        this.spin.rotation.z = this.spinAngle;
        if (this.cage) this.cage.rotation.z = this.spinAngle * 0.42;
        this.applyBrakePose();
      },
      getDisplay: () => {
        const rpm = (this.omega / (Math.PI * 2)) * 60;
        const kmh = (rpm / 60) * Math.PI * TIRE_DIAMETER_M * 3.6;
        const on = this.brake > 0.5;
        return [
          { label: '바퀴 회전수', value: rpm.toFixed(0), unit: 'rpm' },
          { label: '브레이크', value: on ? '작동' : '해제', tone: on ? 'red' : 'blue' },
          { label: '주행 속도', value: kmh.toFixed(1), unit: 'km/h' }
        ];
      }
    };
  }

  /** 부동형 캘리퍼: 안쪽 패드 -Z, 몸체(바깥 패드 포함) +Z로 같은 거리만큼 — 양쪽 간극이 동시에 0이 된다 */
  private applyBrakePose(): void {
    const d = PAD_GAP * this.brake;
    if (this.innerPad) this.innerPad.position.z = -d;
    if (this.caliperBody) this.caliperBody.position.z = d;
    if (this.discMat) {
      this.discMat.emissive.setRGB(1, 0.1, 0.0);
      this.discMat.emissiveIntensity = this.heat * this.heat * 0.9;
    }
    if (this.caliperMat) {
      this.caliperMat.emissive.setRGB(0.9, 0.12, 0.08);
      this.caliperMat.emissiveIntensity = this.brake * 0.35;
    }
  }

  // ── 미션 부품 ──

  /** 허브 베어링 유닛: 외륜(고정) + 복열 볼 + 내륜·허브 플랜지·휠 볼트(회전) */
  private buildBearing(): THREE.Group {
    const g = new THREE.Group();
    const ringMat = chrome({ roughness: 0.18 });
    const outer = new THREE.Mesh(ringZ(0.126, 0.15, 0.04, 0.33, 64, 0.006), ringMat);
    g.add(outer);
    const cage = new THREE.Group();
    cage.name = 'cage';
    const ballGeo = new THREE.SphereGeometry(0.017, 16, 12);
    const balls = new THREE.InstancedMesh(ballGeo, chrome(), 28);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const z of [0.1, 0.29]) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + (z > 0.2 ? Math.PI / 14 : 0);
        m.makeTranslation(Math.cos(a) * 0.108, Math.sin(a) * 0.108, z);
        balls.setMatrixAt(n++, m);
      }
    }
    cage.add(balls);
    g.add(cage);

    const rot = new THREE.Group();
    rot.name = 'hubRot';
    const inner = new THREE.Mesh(ringZ(0.05, 0.09, -0.02, 0.33, 48, 0.006), this.steelMat);
    const nut = new THREE.Mesh(ringZ(0.0, 0.065, 0.33, 0.37, 6, 0.006), darkSteel());
    const flangeShape = new THREE.Shape();
    for (let i = 0; i < 5; i++) {
      // 꽃 모양 플랜지(볼트 자리마다 귀가 나온 형상)
      const a = (i / 5) * Math.PI * 2;
      flangeShape.absarc(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.06, a - Math.PI / 2, a + Math.PI / 2, false);
    }
    flangeShape.closePath();
    const flange = new THREE.Mesh(extrudeZ(flangeShape, -0.05, 0, 0.008), this.castMat);
    const boss = new THREE.Mesh(ringZ(0.05, 0.14, -0.05, 0.02, 48), this.castMat);
    const pilot = new THREE.Mesh(ringZ(0.0, 0.06, -0.1, -0.05, 32), this.castMat);
    rot.add(inner, nut, flange, boss, pilot);
    const studGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.21, 12);
    studGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const stud = new THREE.Mesh(studGeo, this.steelMat);
      stud.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, -0.095);
      rot.add(stud);
    }
    g.add(rot);
    return g;
  }

  /** 통풍 디스크 + 캘리퍼 브래킷 + 부동형 캘리퍼 + 패드 한 조 */
  private buildBrake(): THREE.Group {
    const g = new THREE.Group();

    // 디스크(회전)
    const disc = new THREE.Group();
    disc.name = 'discRot';
    const discMat = castIron({ color: 0x6d737a, roughness: 0.55 });
    this.discMat = discMat;
    const hatShape = new THREE.Shape();
    hatShape.absarc(0, 0, DISC_RI + 0.03, 0, Math.PI * 2, false);
    const center = new THREE.Path();
    center.absarc(0, 0, 0.065, 0, Math.PI * 2, true);
    hatShape.holes.push(center);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.019, 0, Math.PI * 2, true);
      hatShape.holes.push(h);
    }
    disc.add(new THREE.Mesh(extrudeZ(hatShape, -0.08, -0.05, 0.006, 32), discMat));
    disc.add(new THREE.Mesh(ringZ(DISC_RI, DISC_RI + 0.03, -0.06, DISC_Z0 + 0.01, 72), discMat));
    const plateT = 0.034;
    disc.add(new THREE.Mesh(ringZ(DISC_RI, DISC_RO, DISC_Z0, DISC_Z0 + plateT, 96, 0.006), discMat));
    disc.add(new THREE.Mesh(ringZ(DISC_RI, DISC_RO, DISC_Z1 - plateT, DISC_Z1, 96, 0.006), discMat));
    // 통풍 베인(두 판 사이 방사형 날개) — 지오메트리 병합 1 드로콜
    const vanes: THREE.BufferGeometry[] = [];
    const vaneLen = DISC_RO - DISC_RI - 0.02;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const v = new THREE.BoxGeometry(vaneLen, 0.016, DISC_Z1 - DISC_Z0 - 2 * plateT + 0.004);
      v.translate(DISC_RI + 0.01 + vaneLen / 2, 0, (DISC_Z0 + DISC_Z1) / 2);
      v.rotateZ(a);
      vanes.push(v);
    }
    const vaneGeo = mergeGeometries(vanes);
    vanes.forEach((v) => v.dispose());
    disc.add(new THREE.Mesh(vaneGeo, discMat));
    g.add(disc);

    // 캘리퍼 국소 좌표: +X = 캘리퍼 중심 방향
    const cal = new THREE.Group();
    cal.rotation.z = CAL_ANGLE;
    g.add(cal);

    // 브래킷(고정): 너클에서 가이드 핀까지
    const pinR = 0.47;
    const pinHalf = 0.47;
    const bracketGeo = new RoundedBoxGeometry(0.3, 0.075, 0.045, 2, 0.012);
    const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.22, 16);
    pinGeo.rotateX(Math.PI / 2);
    for (const s of [-1, 1]) {
      const a = s * pinHalf;
      const arm = new THREE.Mesh(bracketGeo, this.castMat);
      arm.position.set(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.2225);
      arm.rotation.z = a;
      const pin = new THREE.Mesh(pinGeo, this.steelMat);
      pin.position.set(Math.cos(a) * pinR, Math.sin(a) * pinR, 0.31);
      cal.add(arm, pin);
    }

    // 캘리퍼 몸체(+Z로 미끄러짐): 피스톤 하우징 + 브리지 + 바깥 손가락 + 가이드 귀 + 바깥 패드
    const body = new THREE.Group();
    body.name = 'caliperBody';
    const calMat = paint(0xc62f2a, { roughness: 0.35 });
    this.caliperMat = calMat;
    const housingGeo = sector(0.33, 0.62, 0.4, 0.255, 0.38, 0.016);
    // 브리지에는 패드 점검 창이 뚫려 있어 패드와 디스크 간극이 보인다
    const parts = [
      housingGeo,
      sector(0.565, 0.62, 0.34, -0.06, 0.0, 0.01),
      sector(0.565, 0.62, 0.34, 0.215, 0.38, 0.01),
      sectorAB(0.565, 0.62, 0.17, 0.34, -0.01, 0.225, 0.008),
      sectorAB(0.565, 0.62, -0.34, -0.17, -0.01, 0.225, 0.008),
      sector(0.36, 0.62, 0.36, -0.06, -0.02, 0.01)
    ];
    const bodyGeo = mergeGeometries(parts);
    parts.forEach((x) => x.dispose());
    body.add(new THREE.Mesh(bodyGeo, calMat));
    const earGeo = ringZ(0.024, 0.048, 0.255, 0.38, 24, 0.006);
    for (const s of [-1, 1]) {
      const a = s * pinHalf;
      const ear = new THREE.Mesh(earGeo, calMat);
      ear.position.set(Math.cos(a) * pinR, Math.sin(a) * pinR, 0);
      body.add(ear);
    }
    const banjo = new THREE.Mesh(ringZ(0.0, 0.035, 0.38, 0.43, 6, 0.004), this.steelMat);
    banjo.position.set(0.5, 0, 0);
    const bleed = new THREE.Mesh(ringZ(0.0, 0.016, 0.38, 0.41, 12, 0.003), this.steelMat);
    bleed.position.set(0.58, 0.12, 0);
    body.add(banjo, bleed);

    const backingMat = darkSteel({ roughness: 0.5 });
    const frictionMat = plastic(0x3e3a36, { roughness: 0.92 });
    const padFriction = sector(0.37, 0.53, 0.3, 0, 0.035, 0.006);
    const padBacking = sector(0.365, 0.535, 0.32, 0, 0.02, 0.004);
    // 바깥 패드: 마찰면 z -0.005~0.03 (디스크 바깥면 0.05와 간극 0.02)
    const outerFric = new THREE.Mesh(padFriction, frictionMat);
    outerFric.position.z = DISC_Z0 - PAD_GAP - 0.035;
    const outerBack = new THREE.Mesh(padBacking, backingMat);
    outerBack.position.z = DISC_Z0 - PAD_GAP - 0.035 - 0.02;
    body.add(outerFric, outerBack);
    cal.add(body);

    // 안쪽 패드 + 피스톤(-Z로 밀림)
    const pad = new THREE.Group();
    pad.name = 'innerPad';
    const innerFric = new THREE.Mesh(padFriction, frictionMat);
    innerFric.position.z = DISC_Z1 + PAD_GAP;
    const innerBack = new THREE.Mesh(padBacking, backingMat);
    innerBack.position.z = DISC_Z1 + PAD_GAP + 0.035;
    const piston = new THREE.Mesh(ringZ(0.0, 0.08, DISC_Z1 + PAD_GAP + 0.055, 0.34, 48, 0.006), chrome({ roughness: 0.15 }));
    piston.position.x = 0.45;
    const boot = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.012, 8, 40), rubber());
    boot.position.set(0.45, 0, 0.252);
    pad.add(innerFric, innerBack, piston, boot);
    cal.add(pad);

    return g;
  }

  // ── 고정 구조 ──

  private buildKnuckle(): void {
    const f = this.hubFrame;
    f.add(new THREE.Mesh(ringZ(0.15, 0.24, 0.02, 0.34, 64, 0.02), this.castMat));
    const plate = (pts: [number, number][], z0: number, z1: number): THREE.Mesh => {
      const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      return new THREE.Mesh(extrudeZ(s, z0, z1, 0.02), this.castMat);
    };
    // 위 팔(스트럿 클램프까지)
    f.add(
      plate(
        [
          [-0.13, 0.16],
          [0.13, 0.16],
          [0.08, 0.7],
          [-0.08, 0.7]
        ],
        0.22,
        0.36
      )
    );
    // 아래 팔(볼 조인트까지)
    f.add(
      plate(
        [
          [-0.12, -0.16],
          [-0.06, -0.62],
          [0.06, -0.62],
          [0.12, -0.16]
        ],
        0.22,
        0.34
      )
    );
    // 조향 팔(타이로드 엔드까지, -X 방향)
    f.add(
      plate(
        [
          [-0.18, 0.09],
          [-0.18, -0.09],
          [-0.53, -0.04],
          [-0.53, 0.04]
        ],
        0.24,
        0.32
      )
    );
    // 볼 조인트 보스
    const bossGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.1, 24);
    const bj = new THREE.Mesh(bossGeo, this.castMat);
    bj.position.set(0, -0.64, 0.28);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), this.steelMat);
    ball.position.set(0, -0.7, 0.28);
    const te = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 20), this.castMat);
    te.position.set(-0.55, 0, 0.28);
    f.add(bj, ball, te);
    // 스트럿 클램프
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.24, 32), this.castMat);
    alignY(clamp, STRUT_B, STRUT_B.clone().lerp(STRUT_T, 0.18));
    f.add(clamp);
  }

  private buildStrut(): void {
    const f = this.hubFrame;
    const dir = STRUT_T.clone().sub(STRUT_B);
    const len = dir.length();
    dir.normalize();
    const at = (s: number): THREE.Vector3 => STRUT_B.clone().addScaledVector(dir, s);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.76, 32), paint(0x1f2328, { roughness: 0.45 }));
    tube.position.copy(at(0.38));
    tube.quaternion.copy(q);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len - 0.7, 20), chrome());
    rod.position.copy(at(0.7 + (len - 0.7) / 2));
    rod.quaternion.copy(q);
    const seatGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.035, 40);
    const seatMat = darkSteel();
    const seatLo = new THREE.Mesh(seatGeo, seatMat);
    seatLo.position.copy(at(0.55));
    seatLo.quaternion.copy(q);
    const seatHi = new THREE.Mesh(seatGeo, seatMat);
    seatHi.position.copy(at(len - 0.1));
    seatHi.quaternion.copy(q);
    const bump = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 20), rubber());
    bump.position.copy(at(len - 0.2));
    bump.quaternion.copy(q);
    const mountBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.08, 32), rubber());
    mountBlock.position.copy(at(len - 0.04));
    mountBlock.quaternion.copy(q);
    f.add(tube, rod, seatLo, seatHi, bump, mountBlock);

    // 코일 스프링: 나선 튜브
    const s0 = 0.57;
    const s1 = len - 0.12;
    const turns = 6.5;
    const radius = 0.165;
    const u = new THREE.Vector3(1, 0, 0).sub(dir.clone().multiplyScalar(dir.x)).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u);
    const pts: THREE.Vector3[] = [];
    const N = 260;
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const a = k * turns * Math.PI * 2;
      pts.push(
        at(s0 + (s1 - s0) * k)
          .addScaledVector(u, Math.cos(a) * radius)
          .addScaledVector(v, Math.sin(a) * radius)
      );
    }
    const spring = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 520, 0.026, 12, false),
      paint(0x3f6e9a, { roughness: 0.35 })
    );
    f.add(spring);

    // 브레이크 호스: 스트럿 브래킷 → 캘리퍼 반조 볼트
    const banjo = new THREE.Vector3(Math.cos(CAL_ANGLE) * 0.5, Math.sin(CAL_ANGLE) * 0.5, 0.42);
    const clip = at(0.42).add(new THREE.Vector3(0.09, 0, 0));
    const hose = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          banjo,
          banjo.clone().add(new THREE.Vector3(0, 0, 0.12)),
          new THREE.Vector3(0.26, 0.6, 0.62),
          clip.clone().add(new THREE.Vector3(0.05, 0, 0.06)),
          clip
        ]),
        60,
        0.017,
        10,
        false
      ),
      rubber()
    );
    const clipMesh = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.05, 0.07, 2, 0.01), this.steelMat);
    clipMesh.position.copy(clip);
    f.add(hose, clipMesh);
  }

  private buildStand(): void {
    const col = new THREE.Vector3(-1.35, 0, 0.95);
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.08, 1.3, 3, 0.025), castIron());
    base.position.set(col.x, 0.04, col.z);
    base.receiveShadow = true;
    const column = new THREE.Mesh(new RoundedBoxGeometry(0.2, 3.66, 0.2, 3, 0.03), this.standMat);
    column.position.set(col.x, 0.08 + 1.83, col.z);
    this.group.add(base, column);
    // 기둥 보강판(삼각 거셋)
    const gusset = new THREE.Shape();
    gusset.moveTo(0, 0);
    gusset.lineTo(0.42, 0);
    gusset.lineTo(0, 0.5);
    gusset.closePath();
    const gGeo = extrudeZ(gusset, -0.02, 0.02, 0.006);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const gm = new THREE.Mesh(gGeo, this.standMat);
      gm.position.set(col.x + Math.cos(a) * 0.1, 0.08, col.z - Math.sin(a) * 0.1);
      gm.rotation.y = a;
      this.group.add(gm);
    }

    // 위 팔: 스트럿 상단 마운트를 볼트로 고정
    const topW = HUB.clone().add(STRUT_T);
    const beamY = topW.y + 0.11;
    const beam = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1, 0.16, 2, 0.025), this.standMat);
    const bA = new THREE.Vector3(col.x, beamY, col.z);
    const bB = new THREE.Vector3(topW.x + 0.12, beamY, topW.z - 0.04);
    beam.scale.y = alignY(beam, bA, bB);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.04, 0.42, 2, 0.012), darkSteel());
    plate.position.set(topW.x, topW.y + 0.015, topW.z);
    this.group.add(beam, plate);
    const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.07, 6);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const bolt = new THREE.Mesh(boltGeo, this.steelMat);
      bolt.position.set(topW.x + Math.cos(a) * 0.15, topW.y + 0.05, topW.z + Math.sin(a) * 0.15);
      this.group.add(bolt);
    }

    // 아래 컨트롤 암: 볼 조인트 → 기둥 브래킷
    const bjW = HUB.clone().add(new THREE.Vector3(0, -0.7, 0.28));
    const armEnd = new THREE.Vector3(col.x + 0.14, bjW.y, col.z - 0.02);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.18, 1, 0.07, 2, 0.025), darkSteel({ roughness: 0.55 }));
    arm.scale.y = alignY(arm, bjW, armEnd);
    arm.rotateY(Math.PI / 2);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 24), darkSteel());
    eye.position.copy(bjW);
    const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 24), rubber());
    bushing.position.copy(armEnd);
    this.group.add(arm, eye, bushing);

    // 타이로드: 조향 팔 → 기둥 브래킷
    const trA = HUB.clone().add(new THREE.Vector3(-0.55, 0, 0.28));
    const trB = new THREE.Vector3(col.x + 0.12, trA.y, col.z - 0.04);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 16), this.steelMat);
    tie.scale.y = alignY(tie, trA.clone().add(new THREE.Vector3(0, 0.07, 0)), trB);
    const tieEnd = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), this.steelMat);
    tieEnd.position.copy(trA).add(new THREE.Vector3(0, 0.07, 0));
    const tieClamp = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.12, 0.12, 2, 0.02), this.standMat);
    tieClamp.position.copy(trB);
    this.group.add(tie, tieEnd, tieClamp);
  }

  private buildChocks(): void {
    // 대기 중인 바퀴가 굴러가지 않게 받치는 고임목
    const shape = new THREE.Shape();
    shape.moveTo(-0.22, 0);
    shape.lineTo(0.22, 0);
    shape.lineTo(0.05, 0.2);
    shape.lineTo(-0.05, 0.2);
    shape.closePath();
    const geo = extrudeZ(shape, -0.22, 0.22, 0.02);
    const m = plastic(0xf2b619, { roughness: 0.6 });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(geo, m);
      // 고임목 윗모서리(중심에서 0.05 안쪽, 높이 0.2)가 타이어 원(반지름 1.0) 위에 정확히 닿는 위치: x = 0.6 + 0.05
      c.position.set(WAIT_POS.x + s * 0.65, 0, WAIT_POS.z - 0.12);
      this.group.add(c);
    }
  }

  // ── 휠 + 타이어 ──

  private buildWheel(): THREE.Group {
    const w = new THREE.Group();
    // 타이어 단면(r, z): 가운데 z=-0.12, 폭 0.62, 트레드 홈 3줄
    const tire: [number, number][] = [
      [0.7, 0.19],
      [0.78, 0.214],
      [0.86, 0.224],
      [0.93, 0.214],
      [0.972, 0.19],
      [0.994, 0.15],
      [1.0, 0.12]
    ];
    const grooves = [0.05, -0.12, -0.29];
    let z = 0.12;
    for (const gz of grooves) {
      tire.push([1.0, gz + 0.022]);
      tire.push([0.975, gz + 0.016]);
      tire.push([0.975, gz - 0.016]);
      tire.push([1.0, gz - 0.022]);
      z = gz - 0.022;
    }
    tire.push(
      [1.0, Math.min(z, -0.36)],
      [0.994, -0.39],
      [0.972, -0.43],
      [0.93, -0.454],
      [0.86, -0.464],
      [0.78, -0.454],
      [0.7, -0.43],
      [0.7, 0.19]
    );
    w.add(new THREE.Mesh(latheZ(tire, 96), rubber({ color: 0x202226 })));

    const alloy = aluminum({ color: 0xc9ced4, roughness: 0.32 });
    const rim: [number, number][] = [
      [0.665, 0.18],
      [0.7, 0.2],
      [0.748, 0.206],
      [0.756, 0.19],
      [0.72, 0.172],
      [0.7, 0.16],
      [0.7, -0.4],
      [0.72, -0.412],
      [0.756, -0.43],
      [0.748, -0.446],
      [0.7, -0.44],
      [0.665, -0.42],
      [0.665, 0.18]
    ];
    w.add(new THREE.Mesh(latheZ(rim, 96), alloy));
    // 허브 패드(장착면 z=-0.08)
    w.add(
      new THREE.Mesh(
        latheZ(
          [
            [0.062, -0.08],
            [0.2, -0.08],
            [0.215, -0.095],
            [0.215, -0.14],
            [0.19, -0.155],
            [0.062, -0.155],
            [0.062, -0.08]
          ],
          64
        ),
        alloy
      )
    );
    // 트윈 스포크 10개(5쌍): 허브에서 림 바깥 립까지 접시형으로 휘어 나감
    const prof = new THREE.Shape();
    prof.moveTo(0.18, -0.09);
    prof.lineTo(0.42, -0.17);
    prof.lineTo(0.69, -0.36);
    prof.lineTo(0.69, -0.42);
    prof.lineTo(0.42, -0.235);
    prof.lineTo(0.18, -0.15);
    prof.closePath();
    const spokeGeo = extrudeZ(prof, -0.028, 0.028, 0.012);
    spokeGeo.rotateX(Math.PI / 2); // shape y → 세계 z(축방향), 압출 → 접선방향
    const spokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      for (const s of [-1, 1]) {
        const g = spokeGeo.clone();
        g.rotateZ((i / 5) * Math.PI * 2 + Math.PI / 5 + s * 0.11);
        spokes.push(g);
      }
    }
    w.add(new THREE.Mesh(mergeGeometries(spokes), alloy));
    spokes.forEach((g) => g.dispose());
    spokeGeo.dispose();
    // 휠 너트 + 센터 캡
    const nutGeo = ringZ(0.0, 0.026, -0.19, -0.145, 6, 0.004);
    const nutMat = chrome();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const nut = new THREE.Mesh(nutGeo, nutMat);
      nut.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0);
      w.add(nut);
    }
    w.add(new THREE.Mesh(ringZ(0.0, 0.07, -0.175, -0.15, 40, 0.01), plastic(0x2a2d33, { roughness: 0.35 })));
    return w;
  }
}
