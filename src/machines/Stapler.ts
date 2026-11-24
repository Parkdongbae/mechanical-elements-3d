// 스테이플러: 평행 핀·스프링 미션 — 책상 위 전시대에 놓인 사무용 스테이플러(설계표 5-1).
// ① 평행 핀 = 경첩 축: 양옆 귀(브래킷) 사이에서 윗몸체를 관통하는 회전 중심(몸체만 축 둘레로 돈다).
// ② 압축 스프링: 베이스 윗면 ↔ 윗몸체 아랫면 사이. 누르면 찌그러지고, 손을 떼면 밀어 올린다(scale.y).
// 좌표: 바닥 y=0, +X = 앞(심이 박히는 쪽), 경첩 축 = Z방향. 1단위 ≈ 0.35m.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, darkSteel, paint, plastic, rubber, steel, wood } from '../models/materials';

// ── 치수 (설계표 5-1 고정값) ──
const STAND = { w: 3.6, h: 0.12, d: 1.6, y: 0.06 }; // 전시대
const BASE = { w: 3.0, h: 0.14, y: 0.19, d: 0.7 }; // 베이스(바닥판)
const BASE_TOP = BASE.y + BASE.h / 2;
const ANVIL = { w: 0.5, h: 0.03, d: 0.4, x: 1.25 }; // 모루판(앞끝)
const ANVIL_TOP = BASE_TOP + ANVIL.h;
const H = new THREE.Vector3(-1.3, 0.42, 0); // 경첩 위치(뒤끝)
const EAR = { w: 0.16, h: 0.36, t: 0.05, z: 0.3 }; // 양옆 귀(브래킷)
const ARM = { len: 2.9, h: 0.22, w: 0.6 }; // 윗몸체 본체
const MAG = { len: 2.6, h: 0.08, w: 0.3 }; // 심 통로(매거진, 본체 아래)
const NOSE = { t: 0.04, h: 0.3, w: 0.3 }; // 앞끝 누름판(드라이버)
const NOSE_X = ARM.len - NOSE.t / 2;
const PAD = { len: 1.0, h: 0.05, w: 0.5 }; // 손 누르는 패드
const PAPER = { w: 0.9, t: 0.02, d: 1.2, x: 1.2, n: 3 }; // 종이 3장
const PAPER_Y0 = ANVIL_TOP + PAPER.t / 2;
const PAPER_TOP = ANVIL_TOP + PAPER.t * PAPER.n;
const MARK_X = H.x + NOSE_X - 0.07; // 심 표시(누름판 바로 뒤)
const PIN = { r: 0.04, len: 0.8, capR: 0.055, capT: 0.05 }; // 평행 핀(Z축 방향)
const SPRING = { r: 0.09, wire: 0.015, coils: 5, x: -0.55 }; // 압축 코일
const TOP_X = -SPRING.x - H.x; // 스프링 윗걸점의 armGroup 로컬 x
const TOP_Y = -MAG.h; // 윗걸점 로컬 y(매거진 아랫면)
const OPEN = 0.32; // 열린 각(rad)
const WAIT = { dx: -0.25, dy: 0.35, tilt: 0.5 }; // 설치 전 윗몸체(뒤로·위로·틀어짐)
const PERIOD = 4; // 동작 주기(s): 0~1.2 대기 → 1.2~1.6 누름 → 1.6~2.0 유지 → 2.0~2.6 복귀
const MM = 350; // 1단위 = 0.35m → mm 환산

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

/** 모따기 상자 — 위치는 여기서 한 번만 정한다 */
function box(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  return m;
}

/** 압축 코일(축 Y, 0~len, 양끝 마감) */
function coilGeo(R: number, wire: number, coils: number, len: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = Math.ceil(coils * 30);
  const endK = 0.8 / coils;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * coils * Math.PI * 2;
    const y = u < endK ? (u / endK) * 0.05 : u > 1 - endK ? 1 - ((1 - u) / endK) * 0.05 : 0.05 + ((u - endK) / (1 - 2 * endK)) * 0.9;
    pts.push(new THREE.Vector3(Math.cos(a) * R, wire + y * (len - 2 * wire), Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 10, false);
}

export class Stapler extends BaseMachine {
  readonly id = 'stapler';
  /** 윗몸체: 원점 = 경첩 H. 회전은 이 그룹의 rotation.z 하나로만 한다 */
  private armGroup = new THREE.Group();
  private pinModel: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private coil: THREE.Object3D | null = null;
  private stapleMark: THREE.Mesh;
  private mount: { k: number; last: number } | null = null; // 핀 설치 후 윗몸체 스윕인
  private drop: { k: number; last: number } | null = null; // 스프링 낙하 장착
  private springLen0 = 0; // 스프링 자연 길이(열린 각)
  private theta = OPEN; // 현재 윗몸체 각도
  private springLen = 0;
  private status: '누름' | '복귀' | '대기' = '대기';
  private statusTone: 'default' | 'red' | 'blue' = 'default';

  constructor() {
    super();
    this.springLen0 = this.armTopY(OPEN) - BASE_TOP;
    this.buildStand();
    this.buildBase();
    this.buildPapers();
    this.buildEars();
    this.buildArm();
    // 심 표시: 눌렸을 때 종이에 박힌다
    this.stapleMark = box(0.09, 0.006, 0.05, 0.002, darkSteel({ roughness: 0.5 }), MARK_X, PAPER_TOP + 0.003, 0);
    this.stapleMark.visible = false;
    this.group.add(this.stapleMark);
    this.poseWaiting();

    this.addSlot(0, 0.14, H, 0.02);
    this.slots[0]!.rotation.y = Math.PI / 2; // 링이 Z축을 향하게
    this.addSlot(1, 0.16, new THREE.Vector3(SPRING.x, 0.42, 0), 0.02);
    this.slots[1]!.rotation.x = Math.PI / 2; // 수평
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
    return step === 0 ? this.pinModel !== null : this.springModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? H.clone() : new THREE.Vector3(SPRING.x, 0.42, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? H.clone().add(new THREE.Vector3(0, 0, 0.1)) : new THREE.Vector3(SPRING.x, 0.47, 0);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildPin() : this.buildSpring();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      model.position.copy(H);
      this.pinModel = model;
      this.hideSlot(0);
      // 핀이 끼워진 뒤 윗몸체가 날아와 경첩에 걸린다
      this.mount = { k: 0, last: -1 };
    } else {
      model.position.set(SPRING.x, BASE_TOP, 0);
      this.springModel = model;
      this.coil = model.getObjectByName('coil') ?? null;
      this.syncSpring(this.armGroup.rotation.z);
      this.hideSlot(1);
      this.drop = { k: 0, last: -1 };
    }
  }

  reset(): void {
    if (this.pinModel) this.group.remove(this.pinModel);
    if (this.springModel) this.group.remove(this.springModel);
    this.pinModel = this.springModel = null;
    this.coil = null;
    this.mount = this.drop = null;
    this.stapleMark.visible = false;
    this.poseWaiting();
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.mount) {
      const dt = this.mount.last < 0 ? 0 : Math.min(0.05, t - this.mount.last);
      this.mount.last = t;
      this.mount.k += dt / 1.2;
      if (this.mount.k >= 1) {
        this.mount = null;
        this.applyArm(OPEN);
        this.showSlot(1);
      } else {
        this.applyMount(this.mount.k);
      }
    }
    if (this.drop && this.springModel) {
      const dt = this.drop.last < 0 ? 0 : Math.min(0.05, t - this.drop.last);
      this.drop.last = t;
      this.drop.k += dt / 0.5;
      if (this.drop.k >= 1) {
        this.drop = null;
        this.springModel.position.set(SPRING.x, BASE_TOP, 0);
      } else {
        this.springModel.position.set(SPRING.x, BASE_TOP + (1 - smooth(this.drop.k)) * 0.3, 0);
      }
    }
  }

  createSim(): MachineSim {
    if (!this.pinModel || !this.springModel) throw new Error('stapler mission incomplete');
    // 대기 중 연출을 즉시 완료 상태로
    this.mount = null;
    this.drop = null;
    this.springModel.position.set(SPRING.x, BASE_TOP, 0);
    this.applyArm(OPEN);
    let time = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const tc = time % PERIOD;
        let theta: number;
        if (tc < 1.2) theta = OPEN; // 대기(열린 각)
        else if (tc < 1.6) theta = OPEN * (1 - smooth((tc - 1.2) / 0.4)); // 눌림
        else if (tc < 2.0) theta = 0; // 유지(심 박힘)
        else if (tc < 2.6) theta = OPEN * smooth((tc - 2.0) / 0.6); // 스프링 복귀
        else theta = OPEN;
        this.applyArm(theta);
        if (tc >= 1.6) this.stapleMark.visible = true; // 박힌 심은 남는다
        if (tc < 1.2) {
          this.status = '대기';
          this.statusTone = 'default';
        } else if (tc < 2.0) {
          this.status = '누름';
          this.statusTone = 'red';
        } else if (tc < 2.6) {
          this.status = '복귀';
          this.statusTone = 'blue';
        } else {
          this.status = '대기';
          this.statusTone = 'default';
        }
      },
      getDisplay: () => [
        { label: '윗몸체 각도', value: ((this.theta * 180) / Math.PI).toFixed(0), unit: '°' },
        { label: '스프링 길이', value: (this.springLen * MM).toFixed(0), unit: 'mm' },
        { label: '상태', value: this.status, tone: this.statusTone }
      ]
    };
  }

  // ───────────────────────── 자세 ─────────────────────────

  /** 윗몸체가 θ일 때 스프링 윗걸점의 높이 */
  private armTopY(theta: number): number {
    return H.y + TOP_X * Math.sin(theta) + TOP_Y * Math.cos(theta);
  }

  /** 설치 전: 윗몸체가 뒤로 0.25·위로 0.35 떠서 틀어져 있다 */
  private poseWaiting(): void {
    this.armGroup.position.set(H.x + WAIT.dx, H.y + WAIT.dy, H.z);
    this.armGroup.rotation.z = WAIT.tilt;
    this.theta = WAIT.tilt;
  }

  private applyArm(theta: number): void {
    this.armGroup.position.copy(H);
    this.armGroup.rotation.z = theta;
    this.theta = theta;
    this.syncSpring(theta);
  }

  private applyMount(k: number): void {
    const u = smooth(k);
    this.armGroup.position.set(H.x + WAIT.dx * (1 - u), H.y + WAIT.dy * (1 - u), H.z);
    const rot = WAIT.tilt + (OPEN - WAIT.tilt) * u;
    this.armGroup.rotation.z = rot;
    this.theta = rot;
    this.syncSpring(rot);
  }

  /** 스프링 길이 = 두 끝점 거리 → scale.y */
  private syncSpring(theta: number): void {
    const len = Math.max(0.06, this.armTopY(theta) - BASE_TOP);
    this.springLen = len;
    if (this.coil) this.coil.scale.y = len / this.springLen0;
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** ① 평행 핀: Z축 방향 강봉 + 양끝 캡(결합용 강조색) */
  private buildPin(): THREE.Group {
    const g = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(PIN.r, PIN.r, PIN.len, 32), steel({ roughness: 0.28 }));
    rod.geometry.rotateX(Math.PI / 2); // 축 → Z
    g.add(rod);
    const capMat = paint(CATEGORY_COLORS.joining, { roughness: 0.35 });
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(PIN.capR, PIN.capR, PIN.capT, 24), capMat);
      cap.geometry.rotateX(Math.PI / 2);
      cap.position.z = s * (PIN.len / 2 + PIN.capT / 2 - 0.01);
      g.add(cap);
    }
    return g;
  }

  /** ② 압축 스프링: 원점 = 베이스 윗면 걸점, 위로 +Y. 제어용 강조색 */
  private buildSpring(): THREE.Group {
    const g = new THREE.Group();
    const coil = new THREE.Mesh(
      coilGeo(SPRING.r, SPRING.wire, SPRING.coils, this.springLen0),
      paint(CATEGORY_COLORS.control, { roughness: 0.35, metalness: 0.45 })
    );
    coil.name = 'coil';
    g.add(coil);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildStand(): void {
    this.group.add(box(STAND.w, STAND.h, STAND.d, 0.02, wood(0x9c6b3e), 0, STAND.y, 0));
  }

  private buildBase(): void {
    const bodyMat = paint(0x2b6cb0, { roughness: 0.4 });
    this.group.add(box(BASE.w, BASE.h, BASE.d, 0.02, bodyMat, 0, BASE.y, 0));
    // 모루판: 베이스 앞끝 위
    this.group.add(box(ANVIL.w, ANVIL.h, ANVIL.d, 0.008, steel({ roughness: 0.3 }), ANVIL.x, BASE_TOP + ANVIL.h / 2, 0));
  }

  private buildPapers(): void {
    const mat = plastic(0xf2f4f6, { roughness: 0.9 });
    const tilts = [0.025, -0.02, 0];
    for (let i = 0; i < PAPER.n; i++) {
      const p = box(PAPER.w, PAPER.t, PAPER.d, 0.004, mat, PAPER.x, PAPER_Y0 + i * PAPER.t, 0);
      p.rotation.y = tilts[i]!;
      this.group.add(p);
    }
  }

  private buildEars(): void {
    const mat = steel({ roughness: 0.35 });
    for (const s of [-1, 1]) {
      this.group.add(box(EAR.w, EAR.h, EAR.t, 0.012, mat, H.x, H.y, s * EAR.z));
    }
  }

  /** 윗몸체: 본체 + 매거진 + 누름판 + 패드 (모두 경첩 H 기준 로컬 좌표) */
  private buildArm(): void {
    const a = this.armGroup;
    const bodyMat = paint(0x2b6cb0, { roughness: 0.4 });
    a.add(box(ARM.len, ARM.h, ARM.w, 0.02, bodyMat, ARM.len / 2, ARM.h / 2, 0));
    // 아래쪽 심 통로(매거진)
    a.add(box(MAG.len, MAG.h, MAG.w, 0.012, steel({ roughness: 0.35 }), ARM.len / 2, -MAG.h / 2, 0));
    // 앞끝 누름판(드라이버): 매거진 아랫면 ~ 본체 윗면
    a.add(box(NOSE.t, NOSE.h, NOSE.w, 0.008, darkSteel({ roughness: 0.4 }), NOSE_X, NOSE.h / 2 - MAG.h, 0));
    // 윗면 손 패드
    a.add(box(PAD.len, PAD.h, PAD.w, 0.015, rubber({ color: 0x2b2d31, roughness: 0.8 }), ARM.len / 2, ARM.h + PAD.h / 2, 0));
    this.group.add(a);
  }
}
