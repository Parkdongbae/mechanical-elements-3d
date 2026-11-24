// 노크식 볼펜: 스프링·캠 미션 — 크게 확대한 볼펜(약 23배)을 전시대에 눕혀 놓은 모형. 몸통은 투명 플라스틱.
// 구조(회전 캠식): 노크 버튼(플런저) → 회전 캠(돌기 4개) → 심. 심 앞쪽의 복귀 스프링이 심과 캠을 뒤로 민다.
// 캠 하우징 안쪽에는 홈 8개가 깊은 홈/얕은 홈으로 번갈아 있다. 버튼을 끝까지 누르면 캠 돌기가 홈 끝(리브)을 넘어서며
// 플런저 톱니 경사면을 따라 반 칸 돌고, 놓으면 리브 경사면을 따라 나머지 반 칸 돌아 옆 홈에 들어간다(1회 45°).
// 얕은 홈에 걸리면 심이 나온 채 고정, 깊은 홈에 들어가면 심이 들어간다 — 누를 때마다 번갈아.
// 시험기 패드가 3초마다 버튼을 누른다. 좌표: 펜 축 = X(+X = 펜 끝), 바닥 y=0.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, brass, chrome, darkSteel, ghost, paint, plastic, rubber, wood } from '../models/materials';
import { lathe, merge, type V2 } from '../models/parts/geom';

// ── 치수(펜 축 X) ──
const PEN_Y = 0.92;
const BR = 0.15; // 몸통 바깥 반지름
const BARREL_X0 = -1.25;
const BARREL_X1 = 1.12;
const TIP_X = 1.55; // 앞 구멍
const XC0 = -1.08; // 캠 뒤면(심 들어감 상태)
const EXT = 0.14; // 심이 나오는 길이(얕은 홈 깊이)
const OVER = 0.26; // 끝까지 눌렀을 때 캠 이동
const RIB_END = XC0 + 0.18; // 리브 앞끝 — 캠 돌기 뒤면이 이보다 앞에 있어야 돌 수 있다
const CAM_LEN = 0.18;
const STEM = 0.1;
const LUG_LEN = 0.1;
const HOUSING_X0 = -1.2;
const HOUSING_X1 = -0.72;
const HOUSING_R = 0.112;
const PLUNGER_LEN = 0.55; // 크라운 앞면 → 버튼 끝
const REFILL_BACK_OFF = CAM_LEN + STEM; // 캠 뒤면 → 심 뒤끝
const COLLAR_OFF = 1.55; // 심 뒤끝 → 스프링 자리 칼라
const TIP_OFF = 2.3; // 심 뒤끝 → 볼 끝
const LEDGE_X = 1.3; // 앞쪽 스프링 받침턱
const SPRING_R = 0.066;
const MM_PER_UNIT = 140 / 3.2;
const STEP = Math.PI / 4;

// 동작(주기 3초)
const PERIOD = 3;
const PAD_REST = XC0 - PLUNGER_LEN - 0.07;
const PAD_MAX = XC0 + OVER - PLUNGER_LEN;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function shadowAll(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && !m.userData.slot) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

/** 프로파일 (r, x) 를 X축 둘레로 회전 */
function latheX(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 압축 코일 스프링(축 Y, 0~len) */
function coilGeo(R: number, wire: number, coils: number, len: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = Math.ceil(coils * 30);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * coils * Math.PI * 2;
    const endK = 0.8 / coils;
    const y = u < endK ? (u / endK) * 0.05 : u > 1 - endK ? 1 - ((1 - u) / endK) * 0.05 : 0.05 + ((u - endK) / (1 - 2 * endK)) * 0.9;
    pts.push(new THREE.Vector3(Math.cos(a) * R, wire + y * (len - 2 * wire), Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 8, false);
}

/** 펜 축 둘레 각도 a, 반지름 r 에 놓인 X 방향 상자 */
function radialBox(x0: number, x1: number, r: number, a: number, tw: number, th: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, th, tw);
  g.translate((x0 + x1) / 2, r, 0);
  g.rotateX(a);
  return g;
}

export class ClickPen extends BaseMachine {
  readonly id = 'clickpen';
  private springModel: THREE.Group | null = null;
  private camModel: THREE.Group | null = null;
  private coil: THREE.Object3D | null = null;
  private cam: THREE.Object3D | null = null;
  private refill = new THREE.Group();
  private plunger = new THREE.Group();
  private pad = new THREE.Group();
  private coilLen0 = 0.5;
  private xc = XC0;
  private springLen = 0;

  constructor() {
    super();
    this.buildStand();
    this.buildBarrel();
    this.buildHousing();
    this.buildRefill();
    this.buildPlunger();
    this.buildTester();
    this.addSlot(0, 0.22, new THREE.Vector3((LEDGE_X + XC0 + REFILL_BACK_OFF + COLLAR_OFF) / 2, PEN_Y, 0), 0.02);
    this.slots[0]!.rotation.y = Math.PI / 2;
    this.addSlot(1, 0.22, new THREE.Vector3(XC0 + CAM_LEN / 2, PEN_Y, 0), 0.02);
    this.slots[1]!.rotation.y = Math.PI / 2;
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
      s.receiveShadow = false;
    }
    this.pose(XC0, 0, PAD_REST);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.springModel !== null : this.camModel !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(1.0, PEN_Y, 0) : new THREE.Vector3(XC0 + 0.1, PEN_Y, 0);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildSpring() : this.buildCam();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      this.springModel = model;
      this.coil = model.getObjectByName('coil') ?? null;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.camModel = model;
      this.cam = model.getObjectByName('cam') ?? null;
      this.hideSlot(1);
    }
    this.pose(XC0, 0, PAD_REST);
  }

  reset(): void {
    if (this.springModel) this.group.remove(this.springModel);
    if (this.camModel) this.group.remove(this.camModel);
    this.springModel = this.camModel = null;
    this.coil = this.cam = null;
    this.pose(XC0, 0, PAD_REST);
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.springModel || !this.camModel) throw new Error('clickpen mission incomplete');
    let time = 0;
    let clicks = 0;
    let index = 0; // 캠이 돈 칸 수(짝수 = 깊은 홈 = 심 들어감)
    let counted = false;
    return {
      update: (dt: number) => {
        time += dt;
        const tc = time % PERIOD;
        const push = smooth(tc / 0.35) * (1 - smooth((tc - 0.6) / 0.35));
        const pad = PAD_REST + (PAD_MAX - PAD_REST) * push;
        const rest = XC0 + (index % 2 === 1 ? EXT : 0);
        const releasing = tc > 0.6;
        // 버튼은 패드에 밀리거나, 스프링에 밀려 캠이 홈에 걸린 위치까지 돌아온다
        let xc = Math.max(rest, pad + PLUNGER_LEN);
        let turn = 0;
        if (!releasing) {
          // 누르는 중: 돌기가 리브 끝을 넘어선 뒤 플런저 톱니 경사면에서 반 칸
          turn = 0.5 * smooth((xc - RIB_END) / (XC0 + OVER - RIB_END));
        } else if (!counted) {
          // 놓는 중: 리브 경사면을 타고 나머지 반 칸 → 새 홈(깊이가 반대)에 걸린다
          const nextRest = XC0 + ((index + 1) % 2 === 1 ? EXT : 0);
          xc = Math.max(nextRest, pad + PLUNGER_LEN);
          turn = 0.5 + 0.5 * smooth((XC0 + OVER - xc) / (XC0 + OVER - Math.max(nextRest, RIB_END - 0.04)));
          if (xc <= nextRest + 1e-5) {
            index++;
            clicks++;
            counted = true;
            turn = 0;
          }
        }
        if (tc < 0.05) counted = false;
        if (counted) xc = Math.max(XC0 + (index % 2 === 1 ? EXT : 0), pad + PLUNGER_LEN);
        this.pose(xc, (index + turn) * STEP, pad);
        this.clicks = clicks;
      },
      getDisplay: () => {
        const out = this.xc > XC0 + EXT * 0.5;
        return [
          { label: '심 상태', value: out ? '나옴' : '들어감', tone: out ? 'red' : 'blue' },
          { label: '누른 횟수', value: String(this.clicks), unit: '회' },
          { label: '스프링 길이', value: (this.springLen * MM_PER_UNIT).toFixed(1), unit: 'mm' }
        ];
      }
    };
  }

  private clicks = 0;

  /** 캠 뒤면 위치 xc → 플런저·캠·심·스프링 */
  private pose(xc: number, camAngle: number, pad: number): void {
    this.xc = xc;
    this.plunger.position.x = xc;
    if (this.cam) {
      this.cam.position.x = xc;
      this.cam.rotation.x = camAngle;
    }
    const back = xc + REFILL_BACK_OFF;
    this.refill.position.x = back;
    const collar = back + COLLAR_OFF + 0.02;
    this.springLen = LEDGE_X - collar;
    if (this.coil) this.coil.scale.y = this.springLen / this.coilLen0;
    this.pad.position.x = pad;
  }

  // ── 미션 부품 ──

  /** ① 복귀 스프링: 앞 받침턱 → 심 칼라 (심을 감싼다) */
  private buildSpring(): THREE.Group {
    const g = new THREE.Group();
    const coil = new THREE.Group();
    coil.name = 'coil';
    coil.position.set(LEDGE_X, PEN_Y, 0);
    coil.rotation.z = Math.PI / 2; // 스프링 +Y → 펜 -X(뒤쪽)
    coil.add(new THREE.Mesh(coilGeo(SPRING_R, 0.011, 9, this.coilLen0), paint(CATEGORY_COLORS.control, { roughness: 0.28, metalness: 0.5 })));
    coil.scale.y = (LEDGE_X - (XC0 + REFILL_BACK_OFF + COLLAR_OFF + 0.02)) / this.coilLen0;
    g.add(coil);
    return g;
  }

  /** ② 회전 캠: 몸통 + 돌기 4개(뒤면 경사) + 앞 꼭지(심 뒤끝을 민다) */
  private buildCam(): THREE.Group {
    const g = new THREE.Group();
    const cam = new THREE.Group();
    cam.name = 'cam';
    cam.position.set(XC0, PEN_Y, 0);
    const mat = paint(CATEGORY_COLORS.power, { roughness: 0.35, metalness: 0.1 });
    cam.add(new THREE.Mesh(latheX([[0, 0], [0.072, 0], [0.078, 0.008], [0.078, CAM_LEN - 0.01], [0.07, CAM_LEN], [0.035, CAM_LEN], [0.035, CAM_LEN + STEM - 0.01], [0.028, CAM_LEN + STEM], [0, CAM_LEN + STEM]], 40), mat));
    // 돌기: 뒤면이 비스듬한 쐐기(플런저 톱니·리브 경사면과 맞닿는 면)
    const lug = new THREE.Shape();
    lug.moveTo(0.0, -0.032);
    lug.lineTo(LUG_LEN, -0.032);
    lug.lineTo(LUG_LEN, 0.032);
    lug.lineTo(0.035, 0.032);
    lug.closePath();
    const lugGeo = new THREE.ExtrudeGeometry(lug, { depth: 0.03, bevelEnabled: false });
    lugGeo.translate(0, 0, -0.015);
    // shape (x, y) → 펜 축 x, 둘레 방향 z; 압출(z) → 반지름 방향 y
    lugGeo.rotateX(Math.PI / 2);
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const gg = lugGeo.clone();
      gg.translate(0, 0.078 + 0.012, 0);
      gg.rotateX((i * Math.PI) / 2);
      geos.push(gg);
    }
    lugGeo.dispose();
    cam.add(new THREE.Mesh(merge(geos), mat));
    // 회전이 보이는 흰 표식(돌기 하나에)
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.034), plastic(0xf4f6f8));
    mark.position.set(LUG_LEN * 0.6, 0.078 + 0.027, 0);
    cam.add(mark);
    g.add(cam);
    return g;
  }

  // ── 고정 구조 ──

  private buildStand(): void {
    const grp = this.group;
    const base = new THREE.Mesh(new RoundedBoxGeometry(4.6, 0.14, 1.3, 3, 0.04), wood(0x9c6b3e));
    base.position.set(-0.15, 0.07, 0);
    grp.add(base);
    const top = new THREE.Mesh(new RoundedBoxGeometry(4.3, 0.02, 1.0, 2, 0.008), plastic(0x2d3138, { roughness: 0.85 }));
    top.position.set(-0.15, 0.15, 0);
    grp.add(top);
    // 받침 2개: 기둥 + 반원 안장(고무 패드)
    for (const x of [-0.55, 0.75]) {
      const post = new THREE.Mesh(new RoundedBoxGeometry(0.16, PEN_Y - BR - 0.16, 0.22, 2, 0.02), aluminum());
      post.position.set(x, 0.16 + (PEN_Y - BR - 0.16) / 2, 0);
      grp.add(post);
      const s = new THREE.Shape();
      s.moveTo(-0.22, 0);
      s.lineTo(0.22, 0);
      s.lineTo(0.22, 0.08);
      s.absarc(0, BR + 0.005, BR + 0.005, -0.25, Math.PI + 0.25, true);
      s.lineTo(-0.22, 0.08);
      s.closePath();
      const saddle = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 24 }), rubber({ color: 0x3a3d42 }));
      saddle.rotation.y = Math.PI / 2;
      saddle.position.set(x - 0.07, PEN_Y - BR - 0.005, 0);
      grp.add(saddle);
    }
  }

  private buildBarrel(): void {
    const grp = this.group;
    const shell = ghost(0xbfd8ee, 0.14);
    // 몸통(뒤 끝 고리 ~ 앞 그립) — 안팎 벽이 있는 관
    const barrel = new THREE.Mesh(latheX([
      [BR - 0.025, BARREL_X0], [BR - 0.01, BARREL_X0], [BR, BARREL_X0 + 0.02], [BR, BARREL_X1], [BR - 0.02, BARREL_X1], [BR - 0.02, BARREL_X0 + 0.02], [BR - 0.025, BARREL_X0]
    ], 64), shell);
    barrel.position.y = PEN_Y;
    barrel.userData.noAO = true;
    grp.add(barrel);
    // 앞 원뿔(끝 구멍) + 안쪽 스프링 받침턱
    const cone = new THREE.Mesh(latheX([
      [BR, BARREL_X1], [BR - 0.005, BARREL_X1 + 0.08], [0.06, TIP_X - 0.03], [0.035, TIP_X], [0.028, TIP_X], [0.04, TIP_X - 0.06], [BR - 0.025, BARREL_X1 + 0.08], [BR - 0.02, BARREL_X1]
    ], 64), shell);
    cone.position.y = PEN_Y;
    cone.userData.noAO = true;
    grp.add(cone);
    const ledge = new THREE.Mesh(latheX([[0.04, LEDGE_X], [0.1, LEDGE_X], [0.1, LEDGE_X + 0.03], [0.04, LEDGE_X + 0.03]], 40), plastic(0xdfe6ee, { roughness: 0.4 }));
    ledge.position.y = PEN_Y;
    grp.add(ledge);
    // 고무 그립(반투명 회색) + 이음 고리
    const grip = new THREE.Mesh(latheX([[BR + 0.002, 0.45], [BR + 0.018, 0.5], [BR + 0.018, 1.05], [BR + 0.002, 1.1]], 64), ghost(0x4a5868, 0.45));
    grip.position.y = PEN_Y;
    grip.userData.noAO = true;
    grp.add(grip);
    for (const x of [BARREL_X1 - 0.01, BARREL_X0 + 0.06]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(BR + 0.004, 0.01, 10, 64), chrome());
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, PEN_Y, 0);
      grp.add(ring);
    }
    // 클립: 뒤쪽 고리에서 뻗은 금속 판(펜 뒤편 위쪽에 붙음)
    const clipGrp = new THREE.Group();
    clipGrp.position.set(0, PEN_Y, 0);
    clipGrp.rotation.x = -0.75;
    const clipShape = new THREE.Shape();
    clipShape.moveTo(BARREL_X0 + 0.04, 0);
    clipShape.lineTo(BARREL_X0 + 0.12, 0.05);
    clipShape.lineTo(-0.35, 0.03);
    clipShape.quadraticCurveTo(-0.28, 0.0, -0.3, -0.015);
    clipShape.lineTo(BARREL_X0 + 0.12, 0.02);
    clipShape.lineTo(BARREL_X0 + 0.04, -0.03);
    clipShape.closePath();
    const clip = new THREE.Mesh(new THREE.ExtrudeGeometry(clipShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 12 }), chrome({ color: 0xd8dde3 }));
    clip.rotation.x = -Math.PI / 2;
    clip.position.set(0, BR - 0.01, 0.04);
    clipGrp.add(clip);
    grp.add(clipGrp);
  }

  /** 캠 하우징: 반투명 슬리브 + 리브 8개 + 홈 바닥 막이(깊은 홈 짧게, 얕은 홈 길게) */
  private buildHousing(): void {
    const grp = this.group;
    const sleeve = new THREE.Mesh(latheX([[HOUSING_R, HOUSING_X0], [BR - 0.02, HOUSING_X0], [BR - 0.02, HOUSING_X1], [HOUSING_R, HOUSING_X1]], 48), ghost(0xe8eef5, 0.1));
    sleeve.position.y = PEN_Y;
    sleeve.userData.noAO = true;
    grp.add(sleeve);
    const ribs: THREE.BufferGeometry[] = [];
    const stops: THREE.BufferGeometry[] = [];
    for (let j = 0; j < 8; j++) {
      const ribA = j * STEP + STEP / 2;
      ribs.push(radialBox(HOUSING_X0, RIB_END, HOUSING_R - 0.012, ribA, 0.022, 0.026));
      const chA = j * STEP;
      // 홈 j: 짝수 = 깊은 홈(캠이 XC0까지 들어감), 홀수 = 얕은 홈(XC0+EXT에서 걸림)
      const front = j % 2 === 0 ? XC0 : XC0 + EXT;
      stops.push(radialBox(HOUSING_X0, front, HOUSING_R - 0.014, chA, 0.05, 0.022));
    }
    const ribMesh = new THREE.Mesh(merge(ribs), plastic(0xf2f4f7, { roughness: 0.4 }));
    ribMesh.position.y = PEN_Y;
    grp.add(ribMesh);
    const stopMesh = new THREE.Mesh(merge(stops), plastic(0x8fa4ba, { roughness: 0.45 }));
    stopMesh.position.y = PEN_Y;
    grp.add(stopMesh);
  }

  /** 심: 투명 잉크관(잉크 기둥) + 금속 팁 + 볼 + 스프링 자리 칼라 */
  private buildRefill(): void {
    const r = this.refill;
    r.position.set(XC0 + REFILL_BACK_OFF, PEN_Y, 0);
    const tube = new THREE.Mesh(latheX([[0, 0], [0.042, 0], [0.042, COLLAR_OFF], [0.03, COLLAR_OFF + 0.05], [0.03, TIP_OFF - 0.26], [0, TIP_OFF - 0.26]], 32), plastic(0xe9eef3, { roughness: 0.25 }));
    r.add(tube);
    const ink = new THREE.Mesh(latheX([[0, 0.02], [0.044, 0.02], [0.044, 1.1], [0, 1.1]], 32), plastic(0x1d4fa8, { roughness: 0.3 }));
    r.add(ink);
    const collar = new THREE.Mesh(latheX([[0.03, COLLAR_OFF], [0.075, COLLAR_OFF], [0.075, COLLAR_OFF + 0.02], [0.03, COLLAR_OFF + 0.02]], 32), darkSteel());
    r.add(collar);
    const tip = new THREE.Mesh(latheX([[0, TIP_OFF - 0.27], [0.034, TIP_OFF - 0.27], [0.034, TIP_OFF - 0.2], [0.012, TIP_OFF - 0.02], [0, TIP_OFF - 0.02]], 32), brass());
    r.add(tip);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), chrome());
    ball.position.x = TIP_OFF - 0.014;
    r.add(ball);
    this.group.add(r);
  }

  /** 플런저: 바깥 노크 버튼 + 안쪽 막대 + 톱니 크라운(앞면 = 캠 뒤면) */
  private buildPlunger(): void {
    const p = this.plunger;
    p.position.set(XC0, PEN_Y, 0);
    const mat = plastic(0x2468c9, { roughness: 0.35 });
    const btn = new THREE.Mesh(latheX([[0, -PLUNGER_LEN], [0.06, -PLUNGER_LEN], [0.085, -PLUNGER_LEN + 0.02], [0.09, -PLUNGER_LEN + 0.05], [0.09, -0.2], [0.05, -0.17], [0.05, -0.06], [0.0, -0.06]], 40), mat);
    p.add(btn);
    const crown = new THREE.Mesh(latheX([[0, -0.06], [0.09, -0.06], [0.09, -0.015], [0, -0.015]], 40), plastic(0x3a7bd5, { roughness: 0.35 }));
    p.add(crown);
    // 크라운 톱니 8개(앞면)
    const teeth: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const c = new THREE.ConeGeometry(0.024, 0.015, 4);
      c.rotateZ(-Math.PI / 2);
      c.translate(-0.0075, 0.068, 0);
      c.rotateX(i * STEP + STEP / 2);
      teeth.push(c);
    }
    const tm = new THREE.Mesh(merge(teeth), plastic(0x3a7bd5, { roughness: 0.35 }));
    p.add(tm);
    // 플런저 홈 키(몸통 리브에 끼워져 돌지 않음)
    for (let i = 0; i < 2; i++) {
      const key = new THREE.Mesh(radialBox(-0.2, -0.06, 0.1, (i * Math.PI) + STEP / 2, 0.02, 0.02), mat);
      p.add(key);
    }
    this.group.add(p);
  }

  /** 노크 시험기: 받침 기둥 + 수평 피스톤 + 고무 패드 */
  private buildTester(): void {
    const grp = this.group;
    const x0 = PAD_REST - 0.5;
    const post = new THREE.Mesh(new RoundedBoxGeometry(0.2, PEN_Y - 0.1, 0.32, 2, 0.03), paint(0x58626d, { roughness: 0.5 }));
    post.position.set(x0 - 0.05, 0.16 + (PEN_Y - 0.1) / 2 - 0.02, 0);
    grp.add(post);
    const cyl = new THREE.Mesh(latheX([[0, -0.1], [0.075, -0.1], [0.08, -0.08], [0.08, 0.2], [0.07, 0.22], [0, 0.22]], 40), aluminum());
    cyl.position.set(x0 - 0.05, PEN_Y, 0);
    grp.add(cyl);
    const rod = new THREE.Mesh(latheX([[0, -0.4], [0.025, -0.4], [0.025, -0.02], [0, -0.02]], 20), chrome());
    this.pad.add(rod);
    const padM = new THREE.Mesh(latheX([[0, -0.04], [0.07, -0.04], [0.075, -0.03], [0.075, -0.01], [0.065, 0], [0, 0]], 32), rubber({ color: 0x2b2d31 }));
    this.pad.add(padM);
    this.pad.position.set(PAD_REST, PEN_Y, 0);
    grp.add(this.pad);
  }
}
