// 자전거 전조등: 마찰차와 볼 베어링 미션 — 정비 스탠드에 물린 앞 포크 + 앞바퀴 + 병 모양 발전기(다이나모) + 전조등
// 마찰차(널링 롤러)가 타이어 옆면에 닿아 미끄럼 없이 구른다: 롤러 표면 속도 = 접점의 타이어 표면 속도
//   ω_roller · r_roller = ω_wheel · R_contact  →  회전수 비 = R_contact / r_roller (지름비)
// 좌표: +X = 진행 방향(앞), Y = 위, Z = 바퀴 축(+Z = 발전기 쪽, 카메라 쪽).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { aluminum, brass, castIron, CATEGORY_COLORS, chrome, copper, darkSteel, ghost, glass, glow, paint, plastic, rubber, steel } from '../models/materials';
import { lathe, merge, extrude, type V2 } from '../models/parts/geom';

const deg = Math.PI / 180;

// ── 바퀴 ──
const HUB = new THREE.Vector3(0, 1.35, 0);
const WHEEL_R = 1.05; // 타이어 바깥 반지름 (≈ 700C, 1단위 ≈ 0.33m)
const TUBE = 0.085; // 타이어 단면 반지름
const RT = WHEEL_R - TUBE; // 타이어 단면 중심 반지름 — 옆면이 가장 불룩한 반지름
const HUB_FL = 0.085;
const HUB_LOCK = 0.138;
const DROP_Z = 0.15;

// ── 포크(헤드 각 72°, 오프셋 0.13) ──
const HEAD_DIR = new THREE.Vector2(-Math.cos(72 * deg), Math.sin(72 * deg));
const HEAD_FWD = new THREE.Vector2(HEAD_DIR.y, -HEAD_DIR.x);
const STEER_BASE = new THREE.Vector2(HUB.x, HUB.y).addScaledVector(HEAD_FWD, -0.13);
const CROWN = STEER_BASE.clone().addScaledVector(HEAD_DIR, 1.16);
const HT_BOT = CROWN.clone().addScaledVector(HEAD_DIR, 0.045);
const HT_TOP = CROWN.clone().addScaledVector(HEAD_DIR, 0.55);
const HT_MID = CROWN.clone().addScaledVector(HEAD_DIR, 0.3);
const STAND_X = -1.3;

// ── 발전기: 축이 바퀴 반지름 방향(각 DYN_PHI), 롤러가 타이어 옆면 최대 폭 지점에 닿는다 ──
const DYN_PHI = 85 * deg;
const ROLLER_R = 0.045;
const CONTACT_R = RT;
const DYN_Z = TUBE + ROLLER_R - 0.002; // 고무를 살짝 누른다
const DYN_U = new THREE.Vector3(Math.cos(DYN_PHI), Math.sin(DYN_PHI), 0);
const DYN_ORIGIN = HUB.clone().addScaledVector(DYN_U, CONTACT_R).setZ(DYN_Z);
const RATIO = CONTACT_R / ROLLER_R;
const BEARING_Y = -0.058; // 발전기 국소 좌표(축 = +Y, 바깥쪽)
const BAND_Y = -0.3;

// ── 전조등 ──
const LAMP = new THREE.Vector3(-0.2, 2.66, 0);
const LAMP_TILT = -7 * deg;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** (r, z) 프로파일을 Z축 회전체로 */
function latheZ(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** (r, x) 프로파일을 X축 회전체로 */
function latheX(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 20): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

function boxBetween(a: THREE.Vector3, b: THREE.Vector3, w: number, t: number, mat: THREE.Material): THREE.Mesh {
  const d = b.clone().sub(a);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, d.length(), t, 2, Math.min(w, t) * 0.3), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
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

const V3 = (p: THREE.Vector2, z = 0) => new THREE.Vector3(p.x, p.y, z);

export class DynamoLight extends BaseMachine {
  readonly id = 'dynamo';
  private wheel = new THREE.Group();
  private dyn = new THREE.Group();
  private rotor = new THREE.Group();
  private rollerModel: THREE.Group | null = null;
  private bearingModel: THREE.Group | null = null;
  private bearingInner: THREE.Object3D | null = null;
  private bearingBalls: THREE.Object3D | null = null;
  private lensMat = glow(0xfff1c2, 0);
  private beamMat = glow(0xfff0c0, 1);
  private beam: THREE.Mesh | null = null;
  private spot = new THREE.SpotLight(0xfff0cc, 0, 7, 0.42, 0.6, 1.4);
  private bladeCurveR: THREE.CatmullRomCurve3 | null = null;

  private readonly frameMat = paint(0xe9e2d0, { roughness: 0.38 });
  private readonly chromeMat = chrome();
  private readonly steelMat = steel();
  private readonly darkMat = darkSteel();

  constructor() {
    super();
    this.wheel.position.copy(HUB);
    this.group.add(this.wheel);
    this.buildWheel();
    this.buildFork();
    this.buildStand();
    this.buildDynamo();
    this.buildLamp();
    this.buildWire();

    // 슬롯 링: 축 방향(반지름 방향 U)을 감싼다 — 타이어와 겹치지 않게 롤러 자리보다 조금 바깥
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), DYN_U);
    this.addSlot(0, 0.075, DYN_ORIGIN.clone().addScaledVector(DYN_U, 0.07), 0.014);
    this.addSlot(1, 0.062, DYN_ORIGIN.clone().addScaledVector(DYN_U, BEARING_Y), 0.011);
    for (const s of this.slots) if (s) s.quaternion.copy(q);
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
      s.receiveShadow = false;
    }
    if (this.beam) {
      this.beam.castShadow = false;
      this.beam.receiveShadow = false;
      this.beam.userData.noAO = true;
    }
    this.setLight(0);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.rollerModel !== null : this.bearingModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? DYN_ORIGIN.clone() : DYN_ORIGIN.clone().addScaledVector(DYN_U, BEARING_Y);
  }

  slotTarget(step: number): THREE.Vector3 {
    return this.getFlyTarget(step).add(new THREE.Vector3(0, 0, 0.06));
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildRoller() : this.buildBearing();
    shadowAll(g);
    // 날아오는 동안에도 실제 장착 방향(축 = 반지름 방향)으로 보이게
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), DYN_U);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      this.rotor.add(model);
      this.rollerModel = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.y = BEARING_Y;
      this.dyn.add(model);
      this.bearingModel = model;
      // 내륜은 축과 함께, 볼은 케이지 속도로 돈다
      const inner = model.getObjectByName('inner');
      if (inner) {
        this.rotor.add(inner);
        inner.position.y = BEARING_Y;
        this.bearingInner = inner;
      }
      this.bearingBalls = model.getObjectByName('balls') ?? null;
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.rollerModel) this.rotor.remove(this.rollerModel);
    if (this.bearingInner) this.rotor.remove(this.bearingInner);
    if (this.bearingModel) this.dyn.remove(this.bearingModel);
    this.rollerModel = this.bearingModel = null;
    this.bearingInner = this.bearingBalls = null;
    this.wheel.rotation.z = 0;
    this.rotor.rotation.y = 0;
    this.setLight(0);
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.rollerModel || !this.bearingModel) throw new Error('dynamo mission incomplete');
    let time = 0;
    let angW = 0;
    let rpmW = 0;
    let bright = 0;
    return {
      update: (dt: number) => {
        time += dt;
        // 페달링이 빨라졌다 느려졌다 — 바퀴 25~75rpm (약 3~9km/h)
        rpmW = smooth(time / 1.5) * (50 + 25 * Math.sin((time * Math.PI * 2) / 7));
        const w = (rpmW / 60) * Math.PI * 2;
        angW -= w * dt; // +Z에서 보아 시계 방향 = 전진
        this.wheel.rotation.z = angW;
        // 롤러는 반지름 방향 축(+U) 둘레로 같은 부호: 접점에서 두 표면 속도가 같다
        const angR = angW * RATIO;
        this.rotor.rotation.y = angR;
        if (this.bearingBalls) this.bearingBalls.rotation.y = angR * 0.4;
        // 발전 전압 ∝ 회전수, 전구 밝기는 고속에서 포화
        const rpmR = rpmW * RATIO;
        bright = 1 - Math.exp(-rpmR / 700);
        this.setLight(bright);
      },
      getDisplay: () => {
        const rpmR = rpmW * RATIO;
        return [
          { label: '바퀴 회전수', value: rpmW.toFixed(0), unit: 'rpm' },
          { label: `마찰차 회전수 (지름비 ×${RATIO.toFixed(1)})`, value: rpmR.toFixed(0), unit: 'rpm', tone: 'red' },
          { label: '전조등 밝기', value: (bright * 100).toFixed(0), unit: '%', tone: 'blue' }
        ];
      }
    };
  }

  private setLight(b: number): void {
    this.lensMat.emissiveIntensity = b * 2.6;
    this.beamMat.opacity = b * 0.32;
    if (this.beam) this.beam.visible = b > 0.01;
    this.spot.intensity = b * 30;
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 마찰차: 널링 롤러(국소 Y = 축). 중심 = 타이어 접점 반지름 */
  private buildRoller(): THREE.Group {
    const g = new THREE.Group();
    const N = 32;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < N * 6; i++) {
      const a = (i / (N * 6)) * Math.PI * 2;
      const r = ROLLER_R - 0.0035 * (0.5 + 0.5 * Math.cos(a * N));
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const shape = new THREE.Shape(pts);
    shape.holes.push(new THREE.Path().absarc(0, 0, 0.008, 0, Math.PI * 2, true));
    const knurl = extrude(shape, 0.055, 0.003, 4);
    knurl.rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(knurl, steel({ roughness: 0.3 })));
    // 위 캡 + 아래 플랜지(전동용 = 빨강 포인트)
    g.add(new THREE.Mesh(lathe([[0, 0.0275], [0.03, 0.0275], [0.032, 0.03], [0.026, 0.042], [0, 0.044]], 40), this.darkMat));
    g.add(new THREE.Mesh(lathe([[0.009, -0.034], [0.04, -0.034], [0.042, -0.031], [0.042, -0.0285], [0.009, -0.0285]], 48), paint(CATEGORY_COLORS.power, { roughness: 0.35 })));
    return g;
  }

  /** 볼 베어링(국소 Y = 축): 외륜 고정, 내륜·볼은 sim에서 회전 */
  private buildBearing(): THREE.Group {
    const g = new THREE.Group();
    const ringMat = chrome({ roughness: 0.16 });
    const h = 0.012;
    g.add(new THREE.Mesh(lathe([[0.033, -h], [0.04, -h], [0.042, -h + 0.002], [0.042, h - 0.002], [0.04, h], [0.033, h], [0.033, -h]], 48), ringMat));
    const inner = new THREE.Mesh(lathe([[0.0082, -h], [0.016, -h], [0.016, h], [0.0082, h], [0.0082, -h]], 32), steel());
    inner.name = 'inner';
    g.add(inner);
    const balls = new THREE.Group();
    balls.name = 'balls';
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new THREE.SphereGeometry(0.0085, 14, 10);
      s.translate(Math.cos(a) * 0.0245, 0, Math.sin(a) * 0.0245);
      geos.push(s);
    }
    balls.add(new THREE.Mesh(merge(geos), chrome()));
    balls.add(new THREE.Mesh(lathe([[0.019, 0.006], [0.03, 0.006], [0.03, 0.009], [0.019, 0.009], [0.019, 0.006]], 40), brass()));
    g.add(balls);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildDynamo(): void {
    const d = this.dyn;
    d.position.copy(DYN_ORIGIN);
    d.rotation.z = DYN_PHI - Math.PI / 2;
    this.group.add(d);
    d.add(this.rotor);

    // 반투명 하우징(병 모양 껍데기): 바깥면 + 안쪽면
    const outer: V2[] = [
      [0.05, -0.42], [0.072, -0.405], [0.076, -0.38], [0.076, -0.18], [0.07, -0.15], [0.055, -0.115],
      [0.048, -0.09], [0.047, -0.07]
    ];
    const inner = outer.slice().reverse().map(([r, y]) => [r - 0.005, y] as V2);
    const shell = new THREE.Mesh(lathe([...outer, ...inner, outer[0]!], 56), ghost(0xb9cde0, 0.4));
    shell.userData.noAO = true;
    shell.castShadow = false;
    d.add(shell);
    // 목 테두리(베어링 자리) + 바닥 캡 + 단자
    d.add(new THREE.Mesh(lathe([[0.034, -0.078], [0.049, -0.078], [0.05, -0.073], [0.049, -0.07], [0.034, -0.07], [0.034, -0.078]], 48), this.chromeMat));
    d.add(new THREE.Mesh(lathe([[0, -0.47], [0.035, -0.468], [0.05, -0.452], [0.053, -0.43], [0.051, -0.415], [0.04, -0.415], [0, -0.415]], 48), plastic(0x24272c, { roughness: 0.4 })));
    d.add(new THREE.Mesh(lathe([[0, -0.497], [0.011, -0.495], [0.011, -0.466], [0, -0.466]], 20), brass()));

    // 고정자: 갈고리 극(claw pole) 판 2장 + 손가락 + 가운데 코일
    const poleMat = darkSteel({ roughness: 0.5 });
    d.add(new THREE.Mesh(lathe([[0.012, -0.36], [0.066, -0.36], [0.066, -0.35], [0.012, -0.35], [0.012, -0.36]], 48), poleMat));
    d.add(new THREE.Mesh(lathe([[0.012, -0.175], [0.066, -0.175], [0.066, -0.165], [0.012, -0.165], [0.012, -0.175]], 48), poleMat));
    const fingers: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const up = i % 2 === 0;
      const f = new THREE.BoxGeometry(0.014, 0.12, 0.006);
      f.translate(0, up ? -0.235 : -0.29, 0.043);
      f.rotateY(a);
      fingers.push(f);
    }
    d.add(new THREE.Mesh(merge(fingers), poleMat));
    d.add(new THREE.Mesh(lathe([[0.05, -0.29], [0.064, -0.288], [0.066, -0.262], [0.064, -0.236], [0.05, -0.234], [0.05, -0.29]], 48), copper()));
    // 아래 미끄럼 부싱(축 끝 지지)
    d.add(new THREE.Mesh(lathe([[0.0085, -0.4], [0.02, -0.4], [0.02, -0.37], [0.0085, -0.37], [0.0085, -0.4]], 24), brass()));

    // 회전자: 축 + 4극 영구자석(N 빨강 / S 파랑)
    this.rotor.add(new THREE.Mesh(lathe([[0, -0.398], [0.008, -0.395], [0.008, 0.034], [0, 0.036]], 20), this.steelMat));
    const nMat = paint(0xd8362f, { roughness: 0.35 });
    const sMat = paint(0x2468c9, { roughness: 0.35 });
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(
        lathe([[0.008, -0.33], [0.034, -0.33], [0.035, -0.325], [0.035, -0.205], [0.034, -0.2], [0.008, -0.2]], 16, (i * Math.PI) / 2, Math.PI / 2),
        i % 2 === 0 ? nMat : sMat
      );
      this.rotor.add(seg);
    }

    // 고정 밴드 + 포크 날까지 브래킷
    d.add(new THREE.Mesh(lathe([[0.0765, BAND_Y - 0.024], [0.086, BAND_Y - 0.022], [0.088, BAND_Y], [0.086, BAND_Y + 0.022], [0.0765, BAND_Y + 0.024], [0.0765, BAND_Y - 0.024]], 48), this.darkMat));
    const bandW = DYN_ORIGIN.clone().addScaledVector(DYN_U, BAND_Y);
    const curve = this.bladeCurveR;
    if (curve) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i <= 200; i++) {
        const p = curve.getPoint(i / 200);
        const dd = p.distanceTo(bandW);
        if (dd < bestD) {
          bestD = dd;
          best = i / 200;
        }
      }
      const bp = curve.getPoint(best);
      const dir = bp.clone().sub(bandW).normalize();
      const a = bandW.clone().addScaledVector(dir, 0.08);
      const b = bp.clone().addScaledVector(dir, -0.018);
      this.group.add(boxBetween(a, b, 0.032, 0.012, this.darkMat));
      // 포크 날을 감는 클램프
      const tan = curve.getTangent(best);
      const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 24), this.darkMat);
      clamp.position.copy(bp);
      clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 6), this.steelMat);
      bolt.position.copy(a).addScaledVector(dir, -0.02).add(new THREE.Vector3(0, 0, 0.014));
      bolt.rotation.x = Math.PI / 2;
      this.group.add(clamp, bolt);
    }
  }

  private buildLamp(): void {
    const lamp = new THREE.Group();
    lamp.position.copy(LAMP);
    lamp.rotation.z = LAMP_TILT;
    this.group.add(lamp);
    const body = latheX([[0, -0.15], [0.04, -0.148], [0.066, -0.13], [0.08, -0.095], [0.086, -0.04], [0.088, 0.05], [0, 0.05]], 56);
    lamp.add(new THREE.Mesh(body, this.chromeMat));
    lamp.add(new THREE.Mesh(latheX([[0.078, 0.045], [0.097, 0.05], [0.1, 0.062], [0.097, 0.085], [0.084, 0.09], [0.078, 0.09]], 56), this.chromeMat));
    // 반사경(안쪽 은색 사발) + 렌즈
    lamp.add(new THREE.Mesh(latheX([[0.012, 0.03], [0.05, 0.05], [0.08, 0.075], [0.012, 0.075]], 48), aluminum({ roughness: 0.15 })));
    const lens = new THREE.Mesh(latheX([[0, 0.096], [0.05, 0.093], [0.083, 0.086], [0.083, 0.08], [0, 0.08]], 48), this.lensMat);
    lamp.add(lens);
    lamp.add(new THREE.Mesh(latheX([[0, 0.1], [0.083, 0.088], [0.083, 0.084], [0, 0.097]], 48), glass(0xf4f8ff, 0.25)));
    // 뒤 단자 + 아래 브래킷 귀
    lamp.add(new THREE.Mesh(latheX([[0, -0.17], [0.012, -0.168], [0.012, -0.145], [0, -0.145]], 16), brass()));
    const ear = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.05, 0.05, 2, 0.01), this.darkMat);
    ear.position.set(-0.03, -0.095, 0);
    lamp.add(ear);

    // 빛줄기 콘: 렌즈에서 멀어질수록 옅어지는 알파
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 128, 0, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, '#808080');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, 128);
    }
    const alpha = new THREE.CanvasTexture(c);
    const m = this.beamMat;
    m.transparent = true;
    m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.side = THREE.DoubleSide;
    m.alphaMap = alpha;
    const len = 1.9;
    const cone = new THREE.CylinderGeometry(0.62, 0.085, len, 48, 1, true);
    cone.rotateZ(-Math.PI / 2);
    cone.translate(0.095 + len / 2, 0, 0);
    const beam = new THREE.Mesh(cone, m);
    beam.renderOrder = 5;
    lamp.add(beam);
    this.beam = beam;

    this.spot.position.set(0.08, 0, 0);
    this.spot.target.position.set(3, -0.55, 0);
    lamp.add(this.spot, this.spot.target);

    // 크라운 앞의 전조등 브래킷
    const crownFront = V3(CROWN.clone().addScaledVector(HEAD_FWD, 0.05));
    const earW = new THREE.Vector3(-0.03, -0.095, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), LAMP_TILT).add(LAMP);
    this.group.add(boxBetween(crownFront, earW.clone().add(new THREE.Vector3(0, -0.02, 0)), 0.04, 0.014, this.darkMat));
    const crBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.06, 6), this.chromeMat);
    crBolt.position.copy(crownFront);
    crBolt.rotation.z = Math.PI / 2 + 18 * deg;
    this.group.add(crBolt);
  }

  /** 발전기 단자 → 포크 날을 따라 → 전조등 뒤 단자 */
  private buildWire(): void {
    const term = DYN_ORIGIN.clone().addScaledVector(DYN_U, -0.49);
    const curve = this.bladeCurveR;
    const pts: THREE.Vector3[] = [term, term.clone().add(new THREE.Vector3(-0.03, -0.05, 0.03))];
    if (curve) {
      for (const t of [0.3, 0.5, 0.7, 0.9]) pts.push(curve.getPoint(t).add(new THREE.Vector3(0.03, 0, 0.03)));
    }
    const back = new THREE.Vector3(-0.17, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), LAMP_TILT).add(LAMP);
    const cw = V3(CROWN, 0.2);
    pts.push(cw.add(new THREE.Vector3(0.02, 0.06, 0)), back.clone().add(new THREE.Vector3(-0.05, 0.02, 0.06)), back);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.0075, 8, false), plastic(0x1c1d20, { roughness: 0.45 }));
    this.group.add(wire);
  }

  private buildFork(): void {
    const g = this.group;
    // 포크 날: 드롭아웃 → 앞으로 휜 아래쪽 → 크라운 (타이어 옆면 바깥을 지난다)
    for (const s of [-1, 1]) {
      const drop = HUB.clone().add(new THREE.Vector3(-0.012, 0.07, s * DROP_Z));
      const p1 = V3(STEER_BASE.clone().addScaledVector(HEAD_DIR, 0.36).addScaledVector(HEAD_FWD, 0.09), s * 0.145);
      const p2 = V3(STEER_BASE.clone().addScaledVector(HEAD_DIR, 0.78).addScaledVector(HEAD_FWD, 0.015), s * 0.132);
      const top = V3(CROWN.clone().addScaledVector(HEAD_DIR, -0.02), s * 0.127);
      const curve = new THREE.CatmullRomCurve3([drop, p1, p2, top]);
      if (s > 0) this.bladeCurveR = curve;
      // 가늘어지는 날: 반지름을 따라 줄인 튜브
      const tube = new THREE.TubeGeometry(curve, 64, 0.022, 20, false);
      const pos = tube.attributes.position as THREE.BufferAttribute;
      const segs = 64;
      const ring = 21;
      const v = new THREE.Vector3();
      for (let i = 0; i <= segs; i++) {
        const c = curve.getPointAt(i / segs);
        const k = 0.72 + 0.28 * (i / segs);
        for (let j = 0; j < ring; j++) {
          const idx = i * ring + j;
          v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
          pos.setXYZ(idx, v.x, v.y, v.z);
        }
      }
      tube.computeVertexNormals();
      g.add(new THREE.Mesh(tube, this.frameMat));
      // 드롭아웃 판 + 차축 너트
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 0.034, Math.PI * 0.2, Math.PI * 1.2, false);
      shape.lineTo(-0.034, 0.08);
      shape.lineTo(0.02, 0.09);
      shape.closePath();
      const plate = new THREE.Mesh(extrude(shape, 0.018, 0.004, 12), this.chromeMat);
      plate.position.set(HUB.x, HUB.y, s * (DROP_Z + 0.002));
      g.add(plate);
      const nut = new THREE.Mesh(latheZ(s > 0 ? [[0.0, 0.162], [0.026, 0.162], [0.026, 0.185], [0, 0.185]] : [[0, -0.185], [0.026, -0.185], [0.026, -0.162], [0, -0.162]], 6), this.chromeMat);
      nut.position.copy(HUB);
      g.add(nut);
    }
    const axle = new THREE.Mesh(latheZ([[0, -0.2], [0.009, -0.2], [0.009, 0.2], [0, 0.2]], 16), this.steelMat);
    axle.position.copy(HUB);
    g.add(axle);

    // 크라운
    const crown = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.075, 0.33, 3, 0.025), this.chromeMat);
    crown.position.copy(V3(CROWN));
    crown.rotation.z = Math.atan2(HEAD_DIR.y, HEAD_DIR.x) - Math.PI / 2;
    g.add(crown);
    // 헤드 튜브 + 헤드셋 컵 + 스템 + 핸들바
    g.add(new THREE.Mesh(cylBetween(V3(HT_BOT), V3(HT_TOP), 0.054, 40), this.frameMat));
    for (const p of [HT_BOT, HT_TOP]) {
      g.add(new THREE.Mesh(cylBetween(V3(p.clone().addScaledVector(HEAD_DIR, -0.018)), V3(p.clone().addScaledVector(HEAD_DIR, 0.018)), 0.06, 40), this.chromeMat));
    }
    const quillTop = HT_TOP.clone().addScaledVector(HEAD_DIR, 0.16);
    g.add(new THREE.Mesh(cylBetween(V3(HT_TOP), V3(quillTop), 0.028, 24), this.chromeMat));
    const stemDir = new THREE.Vector2(Math.cos(12 * deg), Math.sin(12 * deg));
    const bar = quillTop.clone().addScaledVector(stemDir, 0.3);
    g.add(new THREE.Mesh(cylBetween(V3(quillTop), V3(bar), 0.024, 24), this.chromeMat));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.036, 24, 16), this.chromeMat).translateX(bar.x).translateY(bar.y));
    const barPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const z = -0.6 + (1.2 * i) / 16;
      const sweep = -0.1 * Math.pow(Math.abs(z) / 0.6, 2);
      barPts.push(new THREE.Vector3(bar.x + sweep, bar.y, z));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(barPts), 48, 0.022, 20, false), this.chromeMat));
    const gripMat = rubber({ color: 0x5a3a26, roughness: 0.75 });
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(bar.x - 0.1 * Math.pow(0.62 / 0.6, 2), bar.y, s * 0.62);
      const b = new THREE.Vector3(bar.x - 0.1 * Math.pow(0.4 / 0.6, 2), bar.y, s * 0.4);
      const grip = new THREE.Mesh(cylBetween(a, b, 0.034, 24), gripMat);
      g.add(grip);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 12), gripMat);
      cap.position.copy(a);
      g.add(cap);
    }
  }

  private buildStand(): void {
    const g = this.group;
    const standMat = paint(0x3b4652, { roughness: 0.5 });
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.06, 1.3, 3, 0.02), castIron());
    base.position.set(STAND_X, 0.03, 0);
    const foot = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.06, 0.26, 3, 0.02), castIron());
    foot.position.set(STAND_X - 0.1, 0.03, 0);
    g.add(base, foot);
    const padMat = rubber();
    for (const [x, z] of [[STAND_X, 0.6], [STAND_X, -0.6], [STAND_X + 0.38, 0], [STAND_X - 0.58, 0]] as const) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.02, 24), padMat);
      pad.position.set(x, 0.0, z);
      g.add(pad);
    }
    const postTop = HT_MID.y + 0.1;
    const post = new THREE.Mesh(new RoundedBoxGeometry(0.1, postTop - 0.06, 0.1, 3, 0.02), standMat);
    post.position.set(STAND_X, 0.06 + (postTop - 0.06) / 2, 0);
    g.add(post);
    const collar = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.12, 0.16, 3, 0.025), standMat);
    collar.position.set(STAND_X, HT_MID.y, 0);
    g.add(collar);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 20), plastic(0xd8362f));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(STAND_X, HT_MID.y, 0.12);
    g.add(knob);
    // 팔 → 헤드 튜브 클램프
    const clampC = V3(HT_MID);
    const armEnd = clampC.clone().add(new THREE.Vector3(-0.085, 0, 0));
    g.add(new THREE.Mesh(cylBetween(new THREE.Vector3(STAND_X + 0.06, HT_MID.y, 0), armEnd, 0.034, 24), this.chromeMat));
    g.add(new THREE.Mesh(cylBetween(V3(HT_MID.clone().addScaledVector(HEAD_DIR, -0.07)), V3(HT_MID.clone().addScaledVector(HEAD_DIR, 0.07)), 0.072, 40), rubber({ color: 0x2a2d31 })));
    const jaw = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.16, 0.18, 2, 0.015), standMat);
    jaw.position.copy(armEnd);
    jaw.rotation.z = Math.atan2(HEAD_DIR.y, HEAD_DIR.x) - Math.PI / 2;
    g.add(jaw);
  }

  /** 앞바퀴: 트레드 타이어 + 림 + 허브 + 3크로스 스포크 32개 + 밸브 */
  private buildWheel(): void {
    const w = this.wheel;
    const tireGeo = new THREE.TorusGeometry(RT, TUBE, 24, 384);
    const p = tireGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const th = Math.atan2(v.y, v.x);
      const cx = Math.cos(th) * RT;
      const cy = Math.sin(th) * RT;
      const dx = v.x - cx;
      const dy = v.y - cy;
      const out = (dx * Math.cos(th) + dy * Math.sin(th)) / TUBE;
      const zc = v.z / TUBE;
      if (out > 0.45) {
        const band = THREE.MathUtils.smoothstep(out, 0.45, 0.75);
        const s = THREE.MathUtils.smoothstep(Math.sin(th * 90 + Math.abs(zc) * 2.6), -0.25, 0.25);
        const k = 1 + 0.045 * s * band;
        v.set(cx + dx * k, cy + dy * k, v.z * k);
        p.setXYZ(i, v.x, v.y, v.z);
      }
    }
    tireGeo.computeVertexNormals();
    w.add(new THREE.Mesh(tireGeo, rubber({ color: 0x1d1f23 })));
    // 옆면 갈색 띠(클래식 타이어 스킨월) — 발전기 롤러가 구르는 자리. 단면 각도 ±35° 구간만 덮는다
    for (const s of [-1, 1]) {
      const prof: V2[] = [];
      for (let i = 0; i <= 14; i++) {
        const a = (-35 + (70 * i) / 14) * deg;
        prof.push([RT + Math.sin(a) * TUBE * 1.003, s * Math.cos(a) * TUBE * 1.003]);
      }
      if (s > 0) prof.reverse(); // 바깥(±Z)을 향하도록 단면 진행 방향을 맞춘다
      const wall = new THREE.Mesh(latheZ(prof, 192), rubber({ color: 0x7a5534, roughness: 0.78 }));
      w.add(wall);
    }

    const rim = latheZ(
      [
        [0.845, -0.022], [0.858, -0.043], [0.912, -0.05], [0.92, -0.044], [0.905, -0.036],
        [0.905, 0.036], [0.92, 0.044], [0.912, 0.05], [0.858, 0.043], [0.845, 0.022], [0.845, -0.022]
      ],
      128
    );
    w.add(new THREE.Mesh(rim, aluminum({ color: 0xd3d8de, roughness: 0.28 })));
    const hub = latheZ(
      [
        [0.012, -HUB_LOCK], [0.04, -HUB_LOCK], [0.04, -HUB_FL - 0.03], [0.045, -HUB_FL - 0.012], [0.1, -HUB_FL - 0.008], [0.1, -HUB_FL + 0.008],
        [0.042, -HUB_FL + 0.02], [0.034, 0], [0.042, HUB_FL - 0.02], [0.1, HUB_FL - 0.008], [0.1, HUB_FL + 0.008], [0.045, HUB_FL + 0.012],
        [0.04, HUB_FL + 0.03], [0.04, HUB_LOCK], [0.012, HUB_LOCK]
      ],
      48
    );
    w.add(new THREE.Mesh(hub, aluminum({ color: 0xaab2bb })));

    const N = 32;
    const spokes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0065, 0.0065, 1, 6), steel({ color: 0xd0d6dc, grain: false }), N);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const cross = (3 * 4 * Math.PI) / N;
    for (let i = 0; i < N; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const aR = (i / N) * Math.PI * 2;
      const lead = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
      const aH = aR + lead * cross;
      const fz = side * HUB_FL;
      a.set(Math.cos(aH) * 0.092, Math.sin(aH) * 0.092, fz);
      b.set(Math.cos(aR) * 0.85, Math.sin(aR) * 0.85, side * 0.006);
      const d = b.clone().sub(a);
      const len = d.length();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      m4.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
      spokes.setMatrixAt(i, m4);
    }
    w.add(spokes);

    const valve = new THREE.Group();
    valve.rotation.z = Math.PI / N - Math.PI / 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 12), chrome());
    stem.position.y = 0.815;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.035, 12), plastic(0x1a1a1a));
    cap.position.y = 0.76;
    valve.add(stem, cap);
    w.add(valve);
  }
}
