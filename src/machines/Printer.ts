// 프린터: 마찰차·벨트와 풀리 미션 — 잉크젯 프린터(윗덮개 반투명, 뒤 급지 트레이, 앞 배지 트레이).
// ① 급지 롤러(고무 마찰차)가 누름 롤러와 종이를 물고 돈다: 종이 이송 거리 = 롤러 회전각 × 반지름(미끄럼 없음).
// ② 캐리지 모터 풀리(18잇수) ↔ 아이들 풀리 사이 타이밍 벨트(196이) 아래쪽 줄에 캐리지가 물려 있다:
//    캐리지 이동 = 벨트 이동 = 풀리 회전각 × 피치 반지름. 벨트 이는 고리를 따라 실제로 흐른다.
// 동작(약 7초): 급지 → [캐리지 왕복 인쇄 → 한 줄 이송] × 5 → 배지 → 반복. 지나간 자리에 인쇄 줄이 생긴다(캔버스 텍스처).
// 좌표: +X = 오른쪽, +Z = 앞(배지 쪽), 종이 경로는 YZ 평면.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { gearShape } from '../models/factory';
import { CATEGORY_COLORS, aluminum, chrome, copper, darkSteel, ghost, paint, plastic, rubber, steel, wood } from '../models/materials';
import { extrude, lathe, merge, type V2 } from '../models/parts/geom';

// ── 치수 ──
const HX = 1.6; // 몸체 반폭
const HZ = 0.95; // 몸체 반깊이
const BODY_Y0 = 0.12;
const BODY_Y1 = 1.14;
const LOW_Y = 0.64; // 아래 몸체(불투명) 윗선
const YP = 0.5; // 종이 면(수평 구간)
const RR = 0.1; // 급지 롤러 반지름
const ZR = -0.35; // 급지 롤러 z
const PINCH_R = 0.045;
const ZX = 0.72; // 배지 롤러 z
// 종이 경로: 경사(트레이) → 원호 → 수평
const ARC_R = 0.3;
const DIR = new THREE.Vector2(0.6, -0.8); // (z, y) 경사 방향
const ARC_C = new THREE.Vector2(-0.6, YP + ARC_R);
const A1 = ARC_C.clone().addScaledVector(new THREE.Vector2(0.8, 0.6), -ARC_R);
const L_SLOPE = 1.4;
const A0 = A1.clone().addScaledVector(DIR, -L_SLOPE);
const ARC_TH0 = Math.atan2(-0.6, -0.8);
const L_ARC = ARC_R * Math.acos(0.6); // 53.13°
const Z_END = 2.25;
const S_END = L_SLOPE + L_ARC + (Z_END - ARC_C.x);
const sAtZ = (z: number): number => L_SLOPE + L_ARC + (z - ARC_C.x);
const S_HEAD = sAtZ(0);
// 종이
const PAPER_L = 1.4;
const PAPER_W = 1.4;
const S_WAIT = 1.75; // 트레이에서 앞끝이 기다리는 위치(롤러 뒤)
const MARGIN = 0.18;
const LINES = 5;
const LINE_P = 0.24;
const S_EJECT = S_END - 0.04;
// 캐리지·벨트
const ROD_Y = 0.8;
const CAR_Z = 0.0;
const XC_END = 1.0; // 캐리지 왕복 끝(홈 = +XC_END)
const RP = 0.09; // 풀리 피치 반지름
const P_TEETH = 18;
const PITCH = (2 * Math.PI * RP) / P_TEETH;
const BELT_N = 196;
const XP = (BELT_N * PITCH - 2 * Math.PI * RP) / 4; // 벨트 이 수가 정수가 되도록 풀리 간격 결정
const YB = 0.9;
const ZB = -0.32;
const PERIM = 4 * XP + 2 * Math.PI * RP;
// 급지 롤러 기어열
const G_TEETH = 32;
const PIN_TEETH = 12;
const CM_PER_UNIT = 14;

// 시간표
const T_FEED = 1.0;
const T_PASS = 0.75;
const T_ADV = 0.22;
const T_EJECT = 1.1;
const PERIOD = T_FEED + LINES * (T_PASS + T_ADV) + T_EJECT + 0.25;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** 종이 경로 위의 점 (z, y)과 진행 방향 */
function pathAt(s: number): { p: THREE.Vector2; t: THREE.Vector2 } {
  if (s <= L_SLOPE) return { p: A0.clone().addScaledVector(DIR, s), t: DIR.clone() };
  if (s <= L_SLOPE + L_ARC) {
    const a = ARC_TH0 + (s - L_SLOPE) / ARC_R;
    return { p: new THREE.Vector2(ARC_C.x + ARC_R * Math.cos(a), ARC_C.y + ARC_R * Math.sin(a)), t: new THREE.Vector2(-Math.sin(a), Math.cos(a)) };
  }
  return { p: new THREE.Vector2(ARC_C.x + (s - L_SLOPE - L_ARC), YP), t: new THREE.Vector2(1, 0) };
}

/** 벨트 고리(피치선) 위 매개변수 → 위치(x, y)와 접선 각 */
function beltAt(q: number): { x: number; y: number; a: number } {
  let p = q % PERIM;
  if (p < 0) p += PERIM;
  const run = 2 * XP;
  const arc = Math.PI * RP;
  if (p < run) return { x: -XP + p, y: YB - RP, a: 0 };
  p -= run;
  if (p < arc) {
    const th = -Math.PI / 2 + p / RP;
    return { x: XP + RP * Math.cos(th), y: YB + RP * Math.sin(th), a: th + Math.PI / 2 };
  }
  p -= arc;
  if (p < run) return { x: XP - p, y: YB + RP, a: Math.PI };
  p -= run;
  const th = Math.PI / 2 + p / RP;
  return { x: -XP + RP * Math.cos(th), y: YB + RP * Math.sin(th), a: th + Math.PI / 2 };
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

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, r = 0.015): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), mat);
  m.position.set(x, y, z);
  return m;
}

/** 프로파일 (r, x) 를 X축 둘레로 */
function latheX(p: V2[], seg = 40): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 프로파일 (r, z) 를 Z축 둘레로 */
function latheZ(p: V2[], seg = 40): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

interface Word {
  x0: number;
  x1: number;
}

export class Printer extends BaseMachine {
  readonly id = 'printer';
  private rollerModel: THREE.Group | null = null;
  private beltModel: THREE.Group | null = null;
  private roller: THREE.Object3D | null = null;
  private pulleys: THREE.Object3D[] = [];
  private belt: THREE.InstancedMesh | null = null;
  private carriage = new THREE.Group();
  private pinches: THREE.Object3D[] = [];
  private exitRoller = new THREE.Group();
  private pinion = new THREE.Group();
  private sheet!: THREE.Mesh;
  private sheetGeo!: THREE.BufferGeometry;
  private doneSheet!: THREE.Mesh;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tex!: THREE.CanvasTexture;
  private words: Word[][] = [];
  private printed: [number, number][] = [];
  private feedAngle = 0;
  private beltU = 0;

  private readonly bodyMat = plastic(0x3a3f46, { roughness: 0.45 });
  private readonly lightMat = plastic(0xe9ecef, { roughness: 0.4 });
  private readonly steelMat = steel();

  constructor() {
    super();
    this.buildDesk();
    this.buildBody();
    this.buildPaperPath();
    this.buildCarriage();
    this.buildFixedRollers();
    this.buildSheet();
    this.addSlot(0, 0.3, new THREE.Vector3(0, YP - RR, ZR), 0.024);
    this.slots[0]!.rotation.y = Math.PI / 2;
    this.addSlot(1, 0.2, new THREE.Vector3(-XP, YB, ZB), 0.022);
    this.hideSlot(1);
    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.castShadow = false;
      s.receiveShadow = false;
    }
    this.sheet.castShadow = false;
    this.placeSheet(S_WAIT);
    this.carriage.position.x = XC_END;
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.rollerModel !== null : this.beltModel !== null;
  }

  getFlyTarget(_step: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, YP - RR, ZR) : new THREE.Vector3(-XP, YB, ZB);
  }

  buildStepModel(step: number): THREE.Group {
    const g = step === 0 ? this.buildRoller() : this.buildBelt();
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.group.add(model);
    if (step === 0) {
      this.rollerModel = model;
      this.roller = model.getObjectByName('roller') ?? null;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      this.beltModel = model;
      this.pulleys = ['pulleyL', 'pulleyR'].map((n) => model.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
      const b = model.getObjectByName('belt');
      this.belt = b instanceof THREE.InstancedMesh ? b : null;
      this.hideSlot(1);
      this.setBelt(0);
    }
  }

  reset(): void {
    if (this.rollerModel) this.group.remove(this.rollerModel);
    if (this.beltModel) this.group.remove(this.beltModel);
    this.rollerModel = this.beltModel = null;
    this.roller = this.belt = null;
    this.pulleys = [];
    this.feedAngle = this.beltU = 0;
    this.carriage.position.x = XC_END;
    this.clearPaper();
    this.placeSheet(S_WAIT);
    this.doneSheet.visible = false;
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.rollerModel || !this.beltModel) throw new Error('printer mission incomplete');
    let time = 0;
    let cycle = -1;
    let sl = S_WAIT;
    let vCar = 0;
    let progress = 0;
    return {
      update: (dt: number) => {
        time += dt;
        const c = Math.floor(time / PERIOD);
        const tc = time - c * PERIOD;
        if (c !== cycle) {
          if (cycle >= 0) this.doneSheet.visible = true;
          cycle = c;
          this.clearPaper();
          sl = S_WAIT;
        }
        // 종이 앞끝 위치와 캐리지 위치를 시간표에서 구한다
        let target = S_WAIT;
        let xc = XC_END;
        let printing = -1;
        const sFirst = S_HEAD + MARGIN;
        if (tc < T_FEED) {
          target = S_WAIT + (sFirst - S_WAIT) * smooth(tc / T_FEED);
          progress = 0;
        } else {
          const tl = tc - T_FEED;
          const k = Math.floor(tl / (T_PASS + T_ADV));
          if (k < LINES) {
            const tk = tl - k * (T_PASS + T_ADV);
            const from = k % 2 === 0 ? XC_END : -XC_END;
            if (tk < T_PASS) {
              xc = from + (-from - from) * smooth(tk / T_PASS);
              target = sFirst + k * LINE_P;
              printing = k;
            } else {
              xc = -from;
              target = sFirst + k * LINE_P + LINE_P * smooth((tk - T_PASS) / T_ADV);
            }
            progress = ((k + (tk < T_PASS ? smooth(tk / T_PASS) : 1)) / LINES) * 100;
          } else {
            const te = tl - LINES * (T_PASS + T_ADV);
            const s0 = sFirst + (LINES - 1) * LINE_P + LINE_P;
            target = s0 + (S_EJECT - s0) * smooth(te / T_EJECT);
            const from = LINES % 2 === 1 ? -XC_END : XC_END;
            xc = from + (XC_END - from) * smooth(te / T_EJECT);
            progress = 100;
          }
        }
        // 롤러는 종이를 민 만큼만 돈다: Δθ = Δs / R
        const ds = target - sl;
        sl = target;
        this.feedAngle += ds / RR;
        this.applyFeed(ds);
        this.placeSheet(sl);
        // 캐리지 = 벨트 아래쪽 줄의 이동량 → 풀리 회전각 = Δx / RP
        const dx = xc - this.carriage.position.x;
        vCar = dt > 0 ? dx / dt : 0;
        this.carriage.position.x = xc;
        this.setBelt(xc - XC_END);
        if (printing >= 0) this.printLine(printing, sl, xc);
      },
      getDisplay: () => [
        { label: '롤러 회전수', value: (this.feedAngle / (Math.PI * 2)).toFixed(2), unit: '회전', tone: 'blue' },
        { label: '캐리지 속도', value: (Math.abs(vCar) * CM_PER_UNIT).toFixed(0), unit: 'cm/s', tone: 'red' },
        { label: '인쇄 진행', value: progress.toFixed(0), unit: '%' }
      ]
    };
  }

  // ── 구동 ──

  private applyFeed(ds: number): void {
    if (this.roller) this.roller.rotation.x = this.feedAngle;
    this.exitRoller.rotation.x = this.feedAngle;
    for (const p of this.pinches) p.rotation.x -= ds / PINCH_R;
    // 롤러 기어(32) ← 모터 피니언(12): 피니언은 반대 방향으로 32/12배
    this.pinion.rotation.x = -this.feedAngle * (G_TEETH / PIN_TEETH);
  }

  private setBelt(u: number): void {
    this.beltU = u;
    for (const p of this.pulleys) p.rotation.z = u / RP;
    const belt = this.belt;
    if (!belt) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < BELT_N; i++) {
      const b = beltAt(i * PITCH + u);
      q.setFromAxisAngle(zAxis, b.a);
      m.compose(new THREE.Vector3(b.x, b.y, ZB), q, one);
      belt.setMatrixAt(i, m);
    }
    belt.instanceMatrix.needsUpdate = true;
  }

  // ── 종이·인쇄 ──

  private placeSheet(sl: number): void {
    const pos = this.sheetGeo.getAttribute('position') as THREE.BufferAttribute;
    const NS = pos.count / 2;
    for (let i = 0; i < NS; i++) {
      const s = sl - PAPER_L + (i / (NS - 1)) * PAPER_L;
      const { p, t } = pathAt(s);
      // 경로 법선(종이 윗면 쪽)으로 살짝 띄움
      const ny = t.x;
      const nz = -t.y;
      const y = p.y + ny * 0.006;
      const z = p.x + nz * 0.006;
      pos.setXYZ(i * 2, -PAPER_W / 2, y, z);
      pos.setXYZ(i * 2 + 1, PAPER_W / 2, y, z);
    }
    pos.needsUpdate = true;
    this.sheetGeo.computeVertexNormals();
    this.sheetGeo.computeBoundingSphere();
  }

  private clearPaper(): void {
    const c = this.ctx;
    c.fillStyle = '#fbfbf8';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.printed = Array.from({ length: LINES }, () => [Infinity, -Infinity] as [number, number]);
    this.tex.needsUpdate = true;
  }

  /** 줄 k: 캐리지가 지나간 x 범위만큼 글자 막대를 그린다 */
  private printLine(k: number, sl: number, xc: number): void {
    const range = this.printed[k];
    if (!range) return;
    const lo = Math.max(-PAPER_W / 2, Math.min(range[0], xc));
    const hi = Math.min(PAPER_W / 2, Math.max(range[1], xc));
    range[0] = Math.min(range[0], xc);
    range[1] = Math.max(range[1], xc);
    if (hi <= lo) return;
    const d = sl - S_HEAD; // 앞끝에서 머리까지 = 이 줄의 종이 위 위치
    this.drawLine(k, d, lo, hi);
    this.tex.needsUpdate = true;
  }

  private drawLine(k: number, d: number, lo: number, hi: number): void {
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const px = (x: number): number => ((x + PAPER_W / 2) / PAPER_W) * W;
    const yc = (d / PAPER_L) * H;
    const h = k === 0 ? 0.075 : 0.05;
    const hp = (h / PAPER_L) * H;
    c.fillStyle = k === 0 ? '#2468c9' : '#2b2e33';
    for (const w of this.words[k] ?? []) {
      const a = Math.max(w.x0, lo);
      const b = Math.min(w.x1, hi);
      if (b > a) c.fillRect(px(a), yc - hp / 2, px(b) - px(a), hp);
    }
  }

  // ── 미션 부품 ──

  /** ① 급지 롤러: 강철 축 + 고무 마찰 바퀴 4개 + 끝 기어(32잇수) */
  private buildRoller(): THREE.Group {
    const g = new THREE.Group();
    const r = new THREE.Group();
    r.name = 'roller';
    r.position.set(0, YP - RR, ZR);
    r.add(new THREE.Mesh(latheX([[0, -1.52], [0.03, -1.52], [0.03, 1.52], [0, 1.52]], 24), this.steelMat));
    const tire = latheX([[0.03, -0.14], [RR - 0.012, -0.14], [RR, -0.128], [RR, 0.128], [RR - 0.012, 0.14], [0.03, 0.14]], 48);
    const tireMat = rubber({ color: 0x24272b, roughness: 0.85 });
    for (const x of [-0.55, -0.18, 0.18, 0.55]) {
      const m = new THREE.Mesh(tire, tireMat);
      m.position.x = x;
      r.add(m);
    }
    // 회전이 보이는 흰 줄 (고무 바퀴 하나에)
    const mark = box(0.26, 0.012, 0.03, plastic(0xf4f6f8), 0.18, RR, 0, 0.004);
    r.add(mark);
    const gs = gearShape(G_TEETH, 0.16, 0.022, 0.25);
    gs.holes.push(new THREE.Path().absarc(0, 0, 0.03, 0, Math.PI * 2, true));
    const gg = extrude(gs, 0.04, 0.005, 6);
    gg.rotateY(Math.PI / 2);
    const gear = new THREE.Mesh(gg, plastic(0xf2f4f7, { roughness: 0.4 }));
    gear.position.x = 1.42;
    r.add(gear);
    g.add(r);
    return g;
  }

  /** ② 모터 풀리 + 아이들 풀리 + 타이밍 벨트(196이, InstancedMesh) */
  private buildBelt(): THREE.Group {
    const g = new THREE.Group();
    const pulleyMat = aluminum({ color: 0xc9d0d8 });
    const flangeMat = paint(CATEGORY_COLORS.power, { roughness: 0.35, metalness: 0.3 });
    ['pulleyL', 'pulleyR'].forEach((name, i) => {
      const p = new THREE.Group();
      p.name = name;
      p.position.set(i === 0 ? -XP : XP, YB, ZB);
      const ps = gearShape(P_TEETH, RP + 0.004, 0.014, 0.3);
      ps.holes.push(new THREE.Path().absarc(0, 0, 0.02, 0, Math.PI * 2, true));
      p.add(new THREE.Mesh(extrude(ps, 0.07, 0.004, 4), pulleyMat));
      for (const s of [-1, 1]) {
        const f = new THREE.Mesh(latheZ([[0.02, -0.006], [RP + 0.04, -0.006], [RP + 0.04, 0.006], [0.02, 0.006]], 48), flangeMat);
        f.position.z = s * 0.041;
        p.add(f);
      }
      // 회전 표식
      const mk = box(0.02, 0.06, 0.012, plastic(0xf4f6f8), 0, RP * 0.55, 0.05, 0.004);
      p.add(mk);
      g.add(p);
    });
    // 벨트 한 이 = 등판(바깥) + 이(안쪽, 풀리 홈에 물림). 국소 +Y = 풀리 중심 쪽
    const back = new THREE.BoxGeometry(PITCH * 1.02, 0.014, 0.06);
    back.translate(0, -0.012, 0);
    const tooth = new THREE.BoxGeometry(PITCH * 0.45, 0.012, 0.06);
    tooth.translate(0, 0.0, 0);
    const geo = merge([back, tooth]);
    const belt = new THREE.InstancedMesh(geo, rubber({ color: 0x2a2c30, roughness: 0.7 }), BELT_N);
    belt.name = 'belt';
    belt.frustumCulled = false;
    g.add(belt);
    this.belt = belt;
    this.setBelt(this.beltU);
    this.belt = null;
    // 캐리지에 물리는 클램프 표시는 캐리지 쪽에 있다
    return g;
  }

  // ── 고정 구조 ──

  private buildDesk(): void {
    const top = box(4.4, 0.1, 3.4, wood(0xb9875a), 0, 0.05, 0.35, 0.02);
    this.group.add(top);
  }

  private buildBody(): void {
    const grp = this.group;
    // 바닥판 + 아래 몸체(앞판·옆판·뒤판) — 종이 경로 높이 위로는 반투명 덮개
    grp.add(box(2 * HX, 0.06, 2 * HZ, this.bodyMat, 0, BODY_Y0 + 0.03, 0, 0.02));
    for (const s of [-1, 1]) {
      grp.add(box(0.08, LOW_Y - BODY_Y0, 2 * HZ, this.bodyMat, s * (HX - 0.04), (BODY_Y0 + LOW_Y) / 2, 0, 0.02));
    }
    grp.add(box(2 * HX, YP - 0.05 - BODY_Y0, 0.08, this.bodyMat, 0, (BODY_Y0 + YP - 0.05) / 2, HZ - 0.04, 0.02));
    grp.add(box(2 * HX, 0.66 - BODY_Y0, 0.08, this.bodyMat, 0, (BODY_Y0 + 0.66) / 2, -HZ + 0.04, 0.02));
    // 앞판 위 띠(배지 구멍 위)와 조작부
    grp.add(box(2 * HX, LOW_Y - YP - 0.05, 0.08, this.lightMat, 0, (YP + 0.05 + LOW_Y) / 2, HZ - 0.04, 0.02));
    const btn = new THREE.Mesh(latheZ([[0, 0], [0.04, 0], [0.045, 0.01], [0.04, 0.025], [0, 0.025]], 24), plastic(0x2f9e6b, { roughness: 0.35 }));
    btn.position.set(1.3, (YP + LOW_Y) / 2 + 0.03, HZ);
    grp.add(btn);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 8), plastic(0x59d18c, { roughness: 0.2 }));
    led.position.set(1.15, (YP + LOW_Y) / 2 + 0.03, HZ + 0.005);
    grp.add(led);
    // 윗덮개(반투명)
    const cover = new THREE.Mesh(new RoundedBoxGeometry(2 * HX, BODY_Y1 - LOW_Y, 2 * HZ, 4, 0.08), ghost(0xb8c8d8, 0.2));
    cover.position.set(0, (LOW_Y + BODY_Y1) / 2, 0);
    cover.userData.noAO = true;
    grp.add(cover);
    // 덮개 테두리(형태가 읽히도록)
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * HX - 0.04, BODY_Y1 - LOW_Y - 0.04, 2 * HZ - 0.04)), new THREE.LineBasicMaterial({ color: 0x8796a6 }));
    edge.position.copy(cover.position);
    grp.add(edge);
    // 가이드 봉(캐리지가 미끄러짐) + 옆판 브래킷
    const rod = new THREE.Mesh(latheX([[0, -HX + 0.08], [0.035, -HX + 0.08], [0.035, HX - 0.08], [0, HX - 0.08]], 24), chrome());
    rod.position.set(0, ROD_Y, CAR_Z);
    grp.add(rod);
    for (const s of [-1, 1]) {
      grp.add(box(0.06, ROD_Y - LOW_Y + 0.12, 0.16, darkSteel(), s * (HX - 0.11), (LOW_Y + ROD_Y) / 2 + 0.02, CAR_Z, 0.01));
      // 풀리 브래킷(옆판 → 풀리 축)
      grp.add(box(0.06, YB - LOW_Y + 0.08, 0.1, darkSteel(), s * (HX - 0.11), (LOW_Y + YB) / 2 + 0.02, ZB - 0.02, 0.01));
      const axle = new THREE.Mesh(latheZ([[0, -0.08], [0.02, -0.08], [0.02, 0.06], [0, 0.06]], 20), this.steelMat);
      axle.position.set(s * XP, YB, ZB);
      grp.add(axle);
      grp.add(box(HX - 0.11 - XP + 0.04, 0.04, 0.04, darkSteel(), s * (XP + (HX - 0.11 - XP) / 2), YB, ZB - 0.06, 0.008));
    }
    // 캐리지 모터(왼쪽 풀리 뒤)
    const motorMat = paint(0x2a2d32, { roughness: 0.45, metalness: 0.4 });
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 40).rotateX(Math.PI / 2).translate(0, 0, -0.59), motorMat);
    motor.position.set(-XP, YB, 0);
    grp.add(motor);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.06, 40, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.59), copper());
    band.position.set(-XP, YB, 0);
    grp.add(band);
    // 급지 롤러 축받이(양옆) + 급지 모터와 피니언
    for (const s of [-1, 1]) {
      grp.add(box(0.06, YP - RR - BODY_Y0 + 0.04, 0.12, darkSteel(), s * 1.5, (BODY_Y0 + YP - RR) / 2 + 0.02, ZR, 0.01));
    }
    const pinR = 0.16 + 0.06;
    const pinZ = ZR - pinR * 0.8;
    const pinY = YP - RR - pinR * 0.6;
    this.pinion.position.set(1.42, pinY, pinZ);
    const ps = gearShape(PIN_TEETH, 0.065, 0.02, 0.25);
    const pg = extrude(ps, 0.05, 0.004, 4);
    pg.rotateY(Math.PI / 2);
    this.pinion.add(new THREE.Mesh(pg, plastic(0xf2f4f7, { roughness: 0.4 })));
    grp.add(this.pinion);
    const lf = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 40).rotateZ(Math.PI / 2).translate(1.18, 0, 0), motorMat);
    lf.position.set(0, pinY, pinZ);
    grp.add(lf);
  }

  /** 종이 경로: 뒤 급지 트레이(종이 묶음) + 인쇄판 + 앞 배지 트레이 */
  private buildPaperPath(): void {
    const grp = this.group;
    const ang = Math.atan2(DIR.y, DIR.x); // (z,y) 평면 기울기
    const trayGrp = new THREE.Group();
    const mid = A0.clone().addScaledVector(DIR, (L_SLOPE + 0.1) / 2 - 0.1);
    trayGrp.position.set(0, mid.y, mid.x);
    trayGrp.rotation.x = -ang;
    // 트레이 판(종이 아래) + 옆 가이드
    trayGrp.add(box(PAPER_W + 0.3, 0.035, L_SLOPE + 0.1, this.lightMat, 0, -0.06, 0, 0.012));
    for (const s of [-1, 1]) trayGrp.add(box(0.04, 0.14, L_SLOPE - 0.2, this.lightMat, s * (PAPER_W / 2 + 0.05), 0.0, 0.05, 0.012));
    // 종이 묶음
    const stackMat = plastic(0xf6f6f2, { roughness: 0.85 });
    for (let i = 0; i < 6; i++) trayGrp.add(box(PAPER_W, 0.008, L_SLOPE - 0.12, stackMat, 0, -0.038 + i * 0.006, 0.02, 0.002));
    grp.add(trayGrp);
    // 트레이 받침 다리(뒤판 위 → 트레이 아래)
    const legTop = A0.clone().addScaledVector(DIR, 0.35);
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(s * 0.7, legTop.y - 0.08, legTop.x);
      const b = new THREE.Vector3(s * 0.7, 0.66, -HZ + 0.04);
      const d = b.clone().sub(a);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, d.length(), 16), this.lightMat);
      leg.position.copy(a).addScaledVector(d, 0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      grp.add(leg);
    }
    // 인쇄판(골판 모양 받침) + 배지 안내판
    grp.add(box(1.9, 0.03, 1.0, plastic(0x1f2226, { roughness: 0.7 }), 0, YP - 0.025, 0.2, 0.008));
    for (let i = 0; i < 8; i++) grp.add(box(0.03, 0.012, 0.9, plastic(0x2c3036, { roughness: 0.6 }), -0.84 + i * 0.24, YP - 0.005, 0.2, 0.004));
    // 앞 배지 트레이(몸체 앞으로 빠져나옴)
    const outTray = box(PAPER_W + 0.25, 0.03, Z_END - HZ + 0.1, this.lightMat, 0, YP - 0.03, (HZ + Z_END) / 2, 0.012);
    grp.add(outTray);
    for (const s of [-1, 1]) {
      const arm = box(0.04, YP - 0.04 - 0.1, 0.06, this.lightMat, s * 0.7, (YP - 0.04 + 0.1) / 2, Z_END - 0.1, 0.01);
      grp.add(arm);
    }
  }

  private buildCarriage(): void {
    const c = this.carriage;
    c.position.set(XC_END, 0, 0);
    // 몸통(봉이 관통) + 노즐판 + 잉크 카트리지 4개 + 벨트 클램프
    c.add(box(0.42, 0.3, 0.46, plastic(0x4b525b, { roughness: 0.45 }), 0, 0.73, CAR_Z, 0.03));
    c.add(box(0.36, 0.03, 0.3, darkSteel(), 0, YP + 0.075, CAR_Z + 0.04, 0.006));
    const inks = [0x1fb3d6, 0xd6338c, 0xf2d21b, 0x1d1f22];
    inks.forEach((col, i) => c.add(box(0.085, 0.16, 0.3, plastic(col, { roughness: 0.35 }), -0.135 + i * 0.09, 0.93, CAR_Z + 0.02, 0.012)));
    const bush = new THREE.Mesh(latheX([[0.035, -0.22], [0.06, -0.22], [0.06, 0.22], [0.035, 0.22]], 24), aluminum());
    bush.position.set(0, ROD_Y, CAR_Z);
    c.add(bush);
    c.add(box(0.12, 0.05, 0.16, darkSteel(), 0, YB - RP - 0.012, ZB + 0.05, 0.008));
    this.group.add(c);
  }

  /** 누름 롤러(급지 롤러 위) + 배지 롤러/별바퀴 — 급지 롤러와 같은 기어열로 돈다 */
  private buildFixedRollers(): void {
    const grp = this.group;
    const pinchMat = plastic(0xd9dde2, { roughness: 0.4 });
    for (const x of [-0.55, -0.18, 0.18, 0.55]) {
      const p = new THREE.Group();
      p.position.set(x, YP + PINCH_R + 0.008, ZR);
      p.add(new THREE.Mesh(latheX([[0.012, -0.1], [PINCH_R - 0.008, -0.1], [PINCH_R, -0.09], [PINCH_R, 0.09], [PINCH_R - 0.008, 0.1], [0.012, 0.1]], 32), pinchMat));
      p.add(box(0.04, 0.008, 0.012, plastic(0x2b2e33), 0, PINCH_R, 0, 0.003));
      grp.add(p);
      this.pinches.push(p);
    }
    // 누름 롤러 축 + 스프링 받침 막대
    const pr = new THREE.Mesh(latheX([[0, -0.75], [0.012, -0.75], [0.012, 0.75], [0, 0.75]], 16), this.steelMat);
    pr.position.set(0, YP + PINCH_R + 0.008, ZR);
    grp.add(pr);
    grp.add(box(1.7, 0.03, 0.04, darkSteel(), 0, YP + 0.1, ZR - 0.13, 0.008));
    for (const s of [-1, 1]) {
      grp.add(box(0.04, YP + 0.1 - BODY_Y0, 0.04, darkSteel(), s * 0.82, (YP + 0.1 + BODY_Y0) / 2, ZR - 0.13, 0.008));
      grp.add(box(0.03, 0.03, 0.15, darkSteel(), s * 0.76, YP + PINCH_R + 0.03, ZR - 0.06, 0.006));
    }
    // 배지 롤러
    const er = this.exitRoller;
    er.position.set(0, YP - 0.06, ZX);
    er.add(new THREE.Mesh(latheX([[0, -0.8], [0.02, -0.8], [0.02, 0.8], [0, 0.8]], 16), this.steelMat));
    for (const x of [-0.5, 0, 0.5]) {
      const t = new THREE.Mesh(latheX([[0.02, -0.08], [0.06, -0.08], [0.06, 0.08], [0.02, 0.08]], 32), rubber({ color: 0x24272b }));
      t.position.x = x;
      er.add(t);
    }
    grp.add(er);
    for (const s of [-1, 1]) grp.add(box(0.05, YP - 0.06 - BODY_Y0, 0.08, darkSteel(), s * 0.85, (YP - 0.06 + BODY_Y0) / 2, ZX, 0.008));
  }

  private buildSheet(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = Math.round((256 * PAPER_L) / PAPER_W);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    // 줄마다 단어 막대(결정적 의사난수)
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let k = 0; k < LINES; k++) {
      const ws: Word[] = [];
      let x = -PAPER_W / 2 + 0.14;
      const end = k === 0 ? 0.1 : PAPER_W / 2 - 0.14 - (k === LINES - 1 ? 0.4 : 0);
      while (x < end) {
        const w = 0.06 + rnd() * (k === 0 ? 0.22 : 0.16);
        ws.push({ x0: x, x1: Math.min(end, x + w) });
        x += w + 0.035;
      }
      this.words.push(ws);
    }
    this.clearPaper();
    const NS = 48;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 2 * 3), 3));
    const uv = new Float32Array(NS * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i < NS; i++) {
      const v = i / (NS - 1); // 0 = 뒤끝, 1 = 앞끝(캔버스 위)
      uv.set([0, v, 1, v], i * 4);
      if (i < NS - 1) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.sheetGeo = geo;
    const mat = plastic(0xffffff, { roughness: 0.85, grain: false });
    mat.map = this.tex;
    mat.side = THREE.DoubleSide;
    this.sheet = new THREE.Mesh(geo, mat);
    this.group.add(this.sheet);

    // 앞서 인쇄된 종이(배지 트레이 위) — 첫 장이 나온 뒤 보인다
    const doneCanvas = document.createElement('canvas');
    doneCanvas.width = this.canvas.width;
    doneCanvas.height = this.canvas.height;
    const dctx = doneCanvas.getContext('2d');
    if (dctx) {
      const saveCtx = this.ctx;
      this.ctx = dctx;
      const saveCanvas = this.canvas;
      this.canvas = doneCanvas;
      dctx.fillStyle = '#fbfbf8';
      dctx.fillRect(0, 0, doneCanvas.width, doneCanvas.height);
      for (let k = 0; k < LINES; k++) this.drawLine(k, MARGIN + k * LINE_P, -PAPER_W / 2, PAPER_W / 2);
      this.ctx = saveCtx;
      this.canvas = saveCanvas;
    }
    const dtex = new THREE.CanvasTexture(doneCanvas);
    dtex.colorSpace = THREE.SRGBColorSpace;
    const dmat = plastic(0xffffff, { roughness: 0.85, grain: false });
    dmat.map = dtex;
    const dg = new THREE.PlaneGeometry(PAPER_W, PAPER_L);
    dg.rotateX(-Math.PI / 2);
    // 평면 앞쪽(+Z)이 캔버스 위(앞끝)가 되도록 뒤집는다
    dg.rotateY(Math.PI);
    this.doneSheet = new THREE.Mesh(dg, dmat);
    this.doneSheet.position.set(0, YP - 0.012, Z_END - 0.04 - PAPER_L / 2);
    this.doneSheet.visible = false;
    this.group.add(this.doneSheet);
  }
}

