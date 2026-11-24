// 피아노 건반: 링크·스프링 미션 — 그랜드 피아노 액션 단면 모형(흰 건반 3개, 각 건반에 완전한 액션).
// 건반(지렛대, 균형 핀 B)을 누르면 뒤끝의 캡스턴이 올라가 위펜을 들고, 위펜 위의 잭이 해머 섕크의 너클을 밀어
// 해머를 돌린다. 잭이 렛오프 지점에 닿으면 빠져나가고(이스케이프) 해머는 관성으로 날아가 현을 친 뒤 되튄다.
// 위펜 각 = 캡스턴 윗면에 힐이 닿는 각(접촉), 해머 각 = 잭 끝에 너클이 얹히는 각 — 모두 실제 접촉 위치에서 계산.
// 해머는 자유 비행 중 무게 + 복귀 스프링 토크로 감속(적분), 현에서 반발계수 0.5로 되튄다.
// 건반 뒤끝은 댐퍼 레버를 들어 댐퍼를 현에서 띄운다 → 현 진동 감쇠가 느려지고, 건반을 놓으면 댐퍼가 내려와 멈춘다.
// 좌표: 바닥 y=0, +X = 연주자 쪽(건반 앞), 건반은 Z 방향으로 나란히.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, brass, chrome, paint, plastic, steel, wood } from '../models/materials';
import { extrude, lathe, merge, roundedRect } from '../models/parts/geom';

// ── 치수 ──
const KEY_Z = [0.5, 0, -0.5];
const KEY_W = 0.44;
const B = new THREE.Vector2(0, 0.46); // 균형 핀(건반 회전 중심)
const KEY_T = 0.14; // 건반 두께
const KEY_X0 = -1.4;
const KEY_X1 = 1.5;
const THETA_MAX = 0.085; // 건반 앞끝이 약 0.13 내려가는 각
const CAP = new THREE.Vector2(-0.9, KEY_T + 0.08); // 캡스턴 윗면(건반 국소)
const W0 = new THREE.Vector2(-1.5, B.y + CAP.y + 0.06); // 위펜 회전 중심
const HEEL = new THREE.Vector2(0.6, -0.06); // 위펜 힐 아랫면(위펜 국소)
const J0 = new THREE.Vector2(0.35, 0.05); // 잭 회전 중심(위펜 국소)
const JACK_H = 0.3;
const LK = 0.2; // 너클 위치(섕크 국소 x)
const KN = 0.05; // 너클 아래로 튀어나온 양
const H0 = new THREE.Vector2(W0.x + J0.x - LK, W0.y + J0.y + JACK_H + KN); // 해머 회전 중심
const LS = 1.05; // 섕크 길이
const HEAD_TOP = 0.3;
const GAMMA_S = 0.3; // 현을 치는 해머 각
const STRING_Y = H0.y + LS * Math.sin(GAMMA_S) + HEAD_TOP * Math.cos(GAMMA_S) + 0.004;
const STR_X0 = -2.45;
const STR_X1 = 0.55;
const DAMP_X = -1.7;
const DL_PIV = new THREE.Vector2(-2.1, 0.62); // 댐퍼 레버 회전 중심
const SPR_F = new THREE.Vector2(H0.x + 0.5, H0.y + 0.36); // 스프링 위 고정점
const SPR_S = new THREE.Vector2(0.5, 0.03); // 스프링 아래 끝(섕크 국소)
const GAMMA_BC = 0.12; // 백체크가 잡아 주는 해머 각
const LETOFF = 0.78; // 건반 행정의 78%에서 잭 이탈

// 동작
const PERIOD = 6;
const KEY_GAP = 2;
const DOWN_T = 0.11;
const HOLD_T = 0.75;
const UP_T = 0.25;
const G_ANG = 3; // 해머 무게(각가속도)
const K_SPR = 12; // 복귀 스프링 토크 계수
const BOUNCE = 0.5;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

const rot = (p: THREE.Vector2, a: number): THREE.Vector2 => new THREE.Vector2(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a));

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && !m.userData.slot) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, r = 0.012): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), mat);
  m.position.set(x, y, z);
  return m;
}

/** 압축 코일 스프링(축 Y, 0~len) */
function coilGeo(R: number, wire: number, coils: number, len: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = Math.ceil(coils * 28);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * coils * Math.PI * 2;
    const endK = 0.7 / coils;
    const y = u < endK ? (u / endK) * 0.05 : u > 1 - endK ? 1 - ((1 - u) / endK) * 0.05 : 0.05 + ((u - endK) / (1 - 2 * endK)) * 0.9;
    pts.push(new THREE.Vector3(Math.cos(a) * R, wire + y * (len - 2 * wire), Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 8, false);
}

/** 건반 각 θ → 캡스턴 윗면(세계) → 위펜 각 β (힐이 캡스턴에 닿는 각) */
function wippenAngle(theta: number): number {
  const cap = rot(CAP, -theta).add(B);
  let beta = 0;
  for (let k = 0; k < 3; k++) {
    // 힐 점 (W0 + R(β)·HEEL).y = cap.y
    const s = (cap.y - W0.y - HEEL.y * Math.cos(beta)) / HEEL.x;
    beta = Math.asin(Math.max(-1, Math.min(1, s)));
  }
  return beta;
}

/** 위펜 각 → 잭 끝(세계) → 너클이 잭 끝에 얹히는 해머 각 */
function hammerOnJack(beta: number): number {
  const tip = rot(new THREE.Vector2(J0.x, J0.y + JACK_H), beta).add(W0);
  let g = 0;
  for (let k = 0; k < 3; k++) {
    const s = (tip.y - H0.y + KN * Math.cos(g)) / LK;
    g = Math.asin(Math.max(-1, Math.min(1, s)));
  }
  return g;
}

interface KeyRig {
  z: number;
  key: THREE.Group;
  hammer: THREE.Group;
  damper: THREE.Group;
  dLever: THREE.Group;
  wippen: THREE.Object3D | null;
  jack: THREE.Object3D | null;
  spring: THREE.Object3D | null;
  string: THREE.Mesh;
  strBase: Float32Array;
  theta: number;
  gamma: number;
  omega: number;
  escaped: boolean;
  jackRot: number;
  amp: number;
  phase: number;
  wasDown: boolean;
}

export class PianoKey extends BaseMachine {
  readonly id = 'piano';
  private linkModel: THREE.Group | null = null;
  private springModel: THREE.Group | null = null;
  private keys: KeyRig[] = [];
  private springLen0 = 0.3;

  private readonly woodMat = wood(0xc9a06b);
  private readonly darkWood = wood(0x6b4428);
  private readonly feltMat = plastic(0x9c2f35, { roughness: 0.95 });
  private readonly greenFelt = plastic(0x2f6b4a, { roughness: 0.95 });
  private readonly railMat = wood(0x8a5a33);

  constructor() {
    super();
    this.buildFrame();
    KEY_Z.forEach((z) => this.keys.push(this.buildKey(z)));
    const z0 = KEY_Z[0]!;
    this.addSlot(0, 0.34, new THREE.Vector3(W0.x + 0.38, W0.y + 0.18, z0 + 0.26), 0.022);
    this.addSlot(1, 0.17, new THREE.Vector3(SPR_F.x, (SPR_F.y + H0.y) / 2, z0 + 0.26), 0.02);
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
      s.receiveShadow = false;
    }
    for (const k of this.keys) this.poseKey(k);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.linkModel !== null : this.springModel !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    const z0 = KEY_Z[0]!;
    return step === 0 ? new THREE.Vector3(W0.x + 0.38, W0.y + 0.18, z0) : new THREE.Vector3(SPR_F.x, SPR_F.y, z0);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildWippens() : this.buildSprings();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      this.linkModel = model;
      this.keys.forEach((k, i) => {
        k.wippen = model.getObjectByName(`wip${i}`) ?? null;
        k.jack = model.getObjectByName(`jack${i}`) ?? null;
      });
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.springModel = model;
      this.keys.forEach((k, i) => (k.spring = model.getObjectByName(`spr${i}`) ?? null));
      this.hideSlot(1);
    }
    for (const k of this.keys) this.poseKey(k);
  }

  reset(): void {
    if (this.linkModel) this.group.remove(this.linkModel);
    if (this.springModel) this.group.remove(this.springModel);
    this.linkModel = this.springModel = null;
    for (const k of this.keys) {
      k.wippen = k.jack = k.spring = null;
      k.theta = k.gamma = k.omega = k.jackRot = k.amp = 0;
      k.escaped = false;
      k.wasDown = false;
      this.poseKey(k);
      this.writeString(k, 0);
    }
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.linkModel || !this.springModel) throw new Error('piano mission incomplete');
    let time = 0;
    let hits = 0;
    let lastSpeed = 0;
    let active = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const tc = time % PERIOD;
        this.keys.forEach((k, i) => {
          const t0 = 0.2 + i * KEY_GAP;
          const u = tc - t0;
          const down = smooth(u / DOWN_T) * (1 - smooth((u - DOWN_T - HOLD_T) / UP_T));
          if (u > 0 && u < DOWN_T + HOLD_T + UP_T) active = i;
          k.theta = THETA_MAX * (u > 0 ? down : 0);
          const support = this.stepHammer(k, dt);
          if (support > 0) {
            hits++;
            lastSpeed = support;
          }
          // 현 진동: 댐퍼가 떠 있으면 천천히, 내려앉으면 빠르게 감쇠
          const damperUp = k.theta > THETA_MAX * 0.3;
          k.amp *= Math.exp(-(damperUp ? 0.9 : 14) * dt);
          k.phase += dt * Math.PI * 2 * 9;
          this.writeString(k, k.amp * Math.sin(k.phase));
          this.poseKey(k);
        });
      },
      getDisplay: () => {
        const k = this.keys[active]!;
        const pressed = k.theta > THETA_MAX * 0.05;
        return [
          { label: '건반 상태', value: `${active + 1}번 ${pressed ? '눌림' : '올라옴'}`, tone: pressed ? 'red' : 'default' },
          { label: '해머 속도 (상대값)', value: lastSpeed.toFixed(1), unit: '', tone: 'blue' },
          { label: '친 횟수', value: String(hits), unit: '회' }
        ];
      }
    };
  }

  /** 해머 1스텝: 잭이 받치는 동안은 접촉 각을 따르고, 이탈 후에는 무게+스프링으로 자유 운동. 현을 치면 속도 반환 */
  private stepHammer(k: KeyRig, dt: number): number {
    const beta = wippenAngle(k.theta);
    const gc = hammerOnJack(beta);
    // 렛오프: 잭 발끝이 렛오프 버튼에 닿으면 잭이 빠진다 / 건반이 거의 올라오면 잭 스프링이 잭을 너클 밑으로 되돌린다
    if (!k.escaped && k.theta >= THETA_MAX * LETOFF) k.escaped = true;
    if (k.escaped && k.theta < THETA_MAX * 0.35 && k.gamma > gc - 0.002) k.escaped = false;
    k.jackRot += ((k.escaped ? 0.32 : 0) - k.jackRot) * Math.min(1, dt * 30);
    let hit = 0;
    if (dt <= 0) return 0;
    const prev = k.gamma;
    k.omega += (-G_ANG - K_SPR * k.gamma) * dt;
    k.gamma += k.omega * dt;
    if (!k.escaped) {
      // 잭이 아래에서 받친다(밀어 올림)
      if (k.gamma < gc) {
        k.gamma = gc;
        k.omega = Math.max(k.omega, (gc - prev) / dt);
      }
    } else {
      const floor = k.theta > THETA_MAX * 0.5 ? GAMMA_BC : 0;
      if (k.gamma < floor && k.omega < 0) {
        k.gamma = floor;
        k.omega = 0;
      }
    }
    if (k.gamma >= GAMMA_S && k.omega > 0) {
      hit = k.omega;
      k.gamma = GAMMA_S;
      k.omega = -k.omega * BOUNCE;
      k.amp = Math.min(0.045, 0.012 * hit);
    }
    if (k.gamma < 0) {
      k.gamma = 0;
      k.omega = 0;
    }
    return hit;
  }

  private poseKey(k: KeyRig): void {
    k.key.rotation.z = -k.theta;
    const beta = wippenAngle(k.theta);
    if (k.wippen) k.wippen.rotation.z = beta;
    if (k.jack) k.jack.rotation.z = k.jackRot;
    // 잭이 없으면 해머는 쉼 레일 위에 그대로
    if (!k.wippen) k.gamma = 0;
    k.hammer.rotation.z = k.gamma;
    // 댐퍼 레버: 앞끝이 건반 뒤끝 윗면에 얹혀 있다
    const tail = rot(new THREE.Vector2(KEY_X0 + 0.06, KEY_T), -k.theta).add(B);
    const leverAng = Math.atan2(tail.y + 0.035 - DL_PIV.y, tail.x - DL_PIV.x);
    k.dLever.rotation.z = leverAng;
    const lift = (DAMP_X - DL_PIV.x) * Math.tan(leverAng);
    k.damper.position.y = Math.max(0, lift - this.restLift);
    if (k.spring) {
      const sp = rot(SPR_S, k.gamma).add(H0);
      const len = sp.distanceTo(SPR_F);
      k.spring.rotation.z = Math.atan2(SPR_F.y - sp.y, SPR_F.x - sp.x) - Math.PI / 2;
      k.spring.position.set(sp.x, sp.y, k.z);
      k.spring.scale.y = len / this.springLen0;
    }
  }

  private restLift = (DAMP_X - DL_PIV.x) * Math.tan(Math.atan2(B.y + KEY_T + 0.035 - DL_PIV.y, KEY_X0 + 0.06 - DL_PIV.x));

  private writeString(k: KeyRig, a: number): void {
    const pos = k.string.geometry.getAttribute('position') as THREE.BufferAttribute;
    const base = k.strBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]!;
      const u = (x - STR_X0) / (STR_X1 - STR_X0);
      pos.setY(i, base[i * 3 + 1]! + a * Math.sin(Math.PI * Math.min(1, Math.max(0, u))));
    }
    pos.needsUpdate = true;
  }

  // ── 미션 부품 ──

  /** ① 위펜 + 잭 (건반마다): 위펜 원점 = 회전 중심 W0, 잭 원점 = J0 */
  private buildWippens(): THREE.Group {
    const g = new THREE.Group();
    const mat = paint(CATEGORY_COLORS.power, { roughness: 0.4, metalness: 0.1 });
    const jackMat = wood(0xd9b98a);
    KEY_Z.forEach((z, i) => {
      const w = new THREE.Group();
      w.name = `wip${i}`;
      w.position.set(W0.x, W0.y, z);
      // 몸통: 회전 중심 → 힐, 가운데가 불룩한 판
      const s = new THREE.Shape();
      s.moveTo(-0.04, -0.03);
      s.lineTo(HEEL.x + 0.05, -0.03);
      s.lineTo(HEEL.x + 0.05, 0.02);
      s.lineTo(J0.x + 0.08, 0.05);
      s.lineTo(J0.x - 0.06, 0.07);
      s.lineTo(0.05, 0.04);
      s.lineTo(-0.04, 0.03);
      s.closePath();
      w.add(new THREE.Mesh(extrude(s, 0.07, 0.008, 4), mat));
      const heel = box(0.1, 0.03, 0.07, this.greenFelt, HEEL.x, HEEL.y + 0.015, 0, 0.008);
      w.add(heel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 20), steel());
      hub.rotation.x = Math.PI / 2;
      w.add(hub);
      // 잭: L자 (세로 팔 + 렛오프 발끝)
      const jack = new THREE.Group();
      jack.name = `jack${i}`;
      jack.position.set(J0.x, J0.y, 0);
      jack.add(box(0.045, JACK_H, 0.05, jackMat, 0, JACK_H / 2, 0, 0.01));
      jack.add(box(0.14, 0.04, 0.05, jackMat, -0.07, 0.03, 0, 0.01));
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 14), steel());
      pin.rotation.x = Math.PI / 2;
      jack.add(pin);
      w.add(jack);
      g.add(w);
    });
    return g;
  }

  /** ② 해머 복귀 스프링 (건반마다): 원점 = 섕크 쪽 끝, +Y = 위 고정점 방향 */
  private buildSprings(): THREE.Group {
    const g = new THREE.Group();
    const mat = paint(CATEGORY_COLORS.control, { roughness: 0.3, metalness: 0.5 });
    const geo = coilGeo(0.035, 0.007, 7, this.springLen0);
    KEY_Z.forEach((z, i) => {
      const s = new THREE.Group();
      s.name = `spr${i}`;
      s.add(new THREE.Mesh(geo, mat));
      const sp = rot(SPR_S, 0).add(H0);
      s.position.set(sp.x, sp.y, z);
      s.rotation.z = Math.atan2(SPR_F.y - sp.y, SPR_F.x - sp.x) - Math.PI / 2;
      s.scale.y = sp.distanceTo(SPR_F) / this.springLen0;
      g.add(s);
    });
    return g;
  }

  // ── 건반 1개(건반·해머·댐퍼·현) ──

  private buildKey(z: number): KeyRig {
    // 건반 지렛대
    const key = new THREE.Group();
    key.position.set(B.x, B.y, z);
    const keyLen = KEY_X1 - KEY_X0;
    key.add(box(keyLen, KEY_T, KEY_W - 0.06, this.woodMat, (KEY_X0 + KEY_X1) / 2, KEY_T / 2, 0, 0.01));
    const ivory = plastic(0xf7f5ef, { roughness: 0.3 });
    key.add(box(0.95, 0.03, KEY_W - 0.02, ivory, KEY_X1 - 0.475, KEY_T + 0.012, 0, 0.01));
    key.add(box(0.03, KEY_T + 0.03, KEY_W - 0.02, ivory, KEY_X1 - 0.012, KEY_T / 2 + 0.012, 0, 0.01));
    const cap = new THREE.Mesh(lathe([[0, 0], [0.035, 0], [0.035, 0.06], [0.03, 0.075], [0, 0.08]], 24), brass());
    cap.position.set(CAP.x, KEY_T, 0);
    key.add(cap);
    // 균형 핀 구멍 표시
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, KEY_T + 0.002, 16), plastic(0x1d2024));
    hole.position.set(0, KEY_T / 2, 0);
    key.add(hole);
    this.group.add(key);

    // 해머: 원점 = H0, 섕크(+X) + 너클 + 머리(나무 몰딩 + 펠트)
    const hammer = new THREE.Group();
    hammer.position.set(H0.x, H0.y, z);
    hammer.add(new THREE.Mesh(lathe([[0, 0], [0.018, 0], [0.018, LS], [0, LS]], 16).rotateZ(-Math.PI / 2), this.woodMat));
    hammer.add(box(0.14, 0.09, 0.07, this.darkWood, 0.02, -0.005, 0, 0.012));
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(KN, KN, 0.06, 24), plastic(0xe9e2d0, { roughness: 0.8 }));
    knuckle.rotation.x = Math.PI / 2;
    knuckle.position.set(LK, 0, 0);
    knuckle.scale.y = 0.7;
    hammer.add(knuckle);
    const molding = new THREE.Mesh(extrude(roundedRect(-0.05, 0, 0.05, 0.2, 0.02), 0.08, 0.006, 8), this.woodMat);
    molding.position.set(LS, 0.0, 0);
    hammer.add(molding);
    const felt = new THREE.Shape();
    felt.moveTo(-0.07, 0.12);
    felt.lineTo(0.07, 0.12);
    felt.quadraticCurveTo(0.075, 0.26, 0, HEAD_TOP);
    felt.quadraticCurveTo(-0.075, 0.26, -0.07, 0.12);
    const feltMesh = new THREE.Mesh(extrude(felt, 0.09, 0.008, 16), plastic(0xf1ece0, { roughness: 0.95 }));
    feltMesh.position.x = LS;
    hammer.add(feltMesh);
    const under = new THREE.Mesh(extrude(roundedRect(-0.072, 0.11, 0.072, 0.15, 0.01), 0.092, 0.004, 6), this.feltMat);
    under.position.x = LS;
    hammer.add(under);
    this.group.add(hammer);

    // 댐퍼 레버(건반 뒤끝에 얹힘) + 댐퍼 와이어 + 댐퍼 머리
    const dLever = new THREE.Group();
    dLever.position.set(DL_PIV.x, DL_PIV.y, z);
    const dl = DAMP_X - DL_PIV.x;
    const leverLen = KEY_X0 + 0.06 - DL_PIV.x;
    dLever.add(box(leverLen + 0.06, 0.05, 0.06, this.darkWood, leverLen / 2, 0.01, 0, 0.01));
    dLever.add(box(0.06, 0.03, 0.065, this.feltMat, leverLen, -0.012, 0, 0.008));
    this.group.add(dLever);
    const damper = new THREE.Group();
    const wireGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 10);
    const wireBot = DL_PIV.y + 0.04 + dl * Math.tan(0);
    const wire = new THREE.Mesh(wireGeo, chrome());
    const wTop = STRING_Y + 0.03;
    wire.scale.y = wTop - wireBot;
    wire.position.set(DAMP_X - 0.06, (wTop + wireBot) / 2, z);
    damper.add(wire);
    damper.add(box(0.2, 0.07, 0.09, this.darkWood, DAMP_X, STRING_Y + 0.055, z, 0.01));
    damper.add(box(0.2, 0.025, 0.09, plastic(0xf1ece0, { roughness: 0.95 }), DAMP_X, STRING_Y + 0.022, z, 0.006));
    this.group.add(damper);

    // 현(진동 표시용 동적 지오메트리)
    const strGeo = new THREE.CylinderGeometry(0.011, 0.011, STR_X1 - STR_X0, 10, 48);
    strGeo.rotateZ(Math.PI / 2);
    strGeo.translate((STR_X0 + STR_X1) / 2, STRING_Y, z);
    const string = new THREE.Mesh(strGeo, steel({ color: 0xe6e9ed, roughness: 0.2 }));
    const strBase = new Float32Array((strGeo.getAttribute('position') as THREE.BufferAttribute).array);
    this.group.add(string);

    return {
      z,
      key,
      hammer,
      damper,
      dLever,
      wippen: null,
      jack: null,
      spring: null,
      string,
      strBase,
      theta: 0,
      gamma: 0,
      omega: 0,
      escaped: false,
      jackRot: 0,
      amp: 0,
      phase: 0,
      wasDown: false
    };
  }

  // ── 나무 프레임·레일 ──

  private buildFrame(): void {
    const grp = this.group;
    const ZW = 1.7;
    // 건반 바닥판 + 앞 막대 + 균형 레일 + 뒤 레일(펠트)
    grp.add(box(4.5, 0.12, ZW + 0.1, this.railMat, -0.45, 0.06, 0, 0.02));
    grp.add(box(0.14, B.y - 0.12, ZW, this.railMat, 0, 0.12 + (B.y - 0.12) / 2, 0, 0.01));
    grp.add(box(0.12, 0.3, ZW, this.railMat, KEY_X1 - 0.15, 0.27, 0, 0.01));
    grp.add(box(0.12, 0.02, ZW, this.greenFelt, KEY_X1 - 0.15, 0.43, 0, 0.006));
    grp.add(box(0.16, B.y - 0.14, ZW, this.railMat, KEY_X0 + 0.15, 0.12 + (B.y - 0.14) / 2, 0, 0.01));
    grp.add(box(0.16, 0.02, ZW, this.greenFelt, KEY_X0 + 0.15, B.y - 0.01, 0, 0.006));
    // 균형 핀
    const pinGeos: THREE.BufferGeometry[] = [];
    for (const z of KEY_Z) {
      const p = new THREE.CylinderGeometry(0.012, 0.012, 0.2, 12);
      p.translate(0, B.y + 0.06, z);
      pinGeos.push(p);
    }
    grp.add(new THREE.Mesh(merge(pinGeos), steel()));
    // 옆 볼(앞쪽 나무 막이)
    for (const s of [-1, 1]) {
      grp.add(box(1.0, 0.62, 0.08, this.darkWood, KEY_X1 - 0.45, 0.12 + 0.31, s * (ZW / 2 + 0.01), 0.02));
    }
    // 액션 레일(위펜 레일·해머 플랜지 레일·해머 쉼 레일·스프링 레일·댐퍼 레버 레일)
    const rails: [number, number, number, number][] = [
      [W0.x, W0.y - 0.07, 0.12, 0.08],
      [H0.x - 0.01, H0.y - 0.085, 0.14, 0.08],
      [-0.72, H0.y - 0.075, 0.1, 0.06],
      [SPR_F.x, SPR_F.y + 0.04, 0.14, 0.08],
      [DL_PIV.x, DL_PIV.y - 0.06, 0.12, 0.08]
    ];
    const postGeos: THREE.BufferGeometry[] = [];
    for (const [x, y, w, h] of rails) {
      grp.add(box(w, h, ZW - 0.1, this.railMat, x, y, 0, 0.01));
      for (const s of [-1, 1]) {
        const p = new THREE.CylinderGeometry(0.022, 0.022, y - 0.12, 20);
        p.translate(x, 0.12 + (y - 0.12) / 2, s * (ZW / 2 - 0.02));
        postGeos.push(p);
      }
    }
    grp.add(box(0.1, 0.02, ZW - 0.1, this.greenFelt, -0.72, H0.y - 0.035, 0, 0.006));
    // 렛오프 버튼(잭 발끝 위) — 레일에 매달림
    for (const z of KEY_Z) {
      const lx = W0.x + J0.x - 0.12;
      const ly = W0.y + J0.y + 0.13;
      grp.add(box(0.05, 0.03, 0.06, this.feltMat, lx, ly, z, 0.008));
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, H0.y - 0.12 - ly, 10), brass());
      rod.position.set(lx, (ly + H0.y - 0.12) / 2, z);
      grp.add(rod);
    }
    // 백체크 표시: 해머 머리 아래 나무 블록(되떨어지는 해머를 잡는다)
    // 철골(플레이트): 현 앞·뒤 받침 막대 + 기둥
    const plate = paint(0xc9a54a, { roughness: 0.4, metalness: 0.5 });
    for (const x of [STR_X1 + 0.06, STR_X0 - 0.06]) {
      grp.add(box(0.16, 0.12, ZW, plate, x, STRING_Y - 0.02, 0, 0.02));
      for (const s of [-1, 1]) {
        const p = new THREE.CylinderGeometry(0.026, 0.026, STRING_Y - 0.12 - 0.08, 20);
        p.translate(x, 0.12 + (STRING_Y - 0.2) / 2, s * (ZW / 2 - 0.02));
        postGeos.push(p);
      }
      // 현을 거는 핀
      for (const z of KEY_Z) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 14), chrome());
        pin.position.set(x, STRING_Y + 0.06, z);
        grp.add(pin);
      }
    }
    grp.add(new THREE.Mesh(merge(postGeos), steel({ color: 0x9aa4ae, roughness: 0.35 })));
  }
}
