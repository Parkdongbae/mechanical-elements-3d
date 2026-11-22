// 러닝머신: 볼 베어링과 벨트 미션 — 벨트 전동(모터 롤러 60rpm → 벨트 1.13m/s)
// 좌표: +X = 앞(모터·콘솔 쪽), Y = 위, Z = 폭. 주행 벨트 윗면은 -X(뒤)로 흐른다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { aluminum, brass, castIron, chrome, copper, darkSteel, ghost, glow, paint, plastic, rubber, steel, wood } from '../models/materials';
import { BaseMachine, type MachineSim, type MachineDisplayItem } from './types';

const ROLLER_R = 0.18;
const ROLLER_Y = 0.42;
const FRONT_X = 1.4;
const REAR_X = -1.4;
const BELT_WIDTH = 1.0;
const BELT_T = 0.022;
const MOTOR_RPM = 60;

const RAIL_IN = 0.6;
const RAIL_OUT = 0.72;
const RAIL_BOTTOM = ROLLER_Y - 0.24;
const RAIL_TOP = ROLLER_Y + 0.135;
const RAIL_X0 = -1.62;
const RAIL_X1 = 1.64;
/** 모터 팬(앞쪽 바닥판): 레일 끝을 받치며 모터·기둥이 여기에 선다 */
const PAN_X0 = 1.46;
const PAN_X1 = 2.46;
const PAN_TOP = RAIL_BOTTOM;
const PAN_T = 0.04;
const DECK_TOP = ROLLER_Y + ROLLER_R - 0.003;
const BELT_TOP = ROLLER_Y + ROLLER_R + BELT_T;
const BEARING_POS = new THREE.Vector3(FRONT_X, ROLLER_Y, RAIL_OUT + 0.045);
const DRIVE_Z = 0.555;
/** 구동 풀리 피치 반지름 — 모터·롤러 풀리가 같아서 풀리 비율 1:1 */
const PULLEY_R = 0.12;
const DRIVE_T = 0.02;
const MOTOR_POS = new THREE.Vector3(2.16, ROLLER_Y + 0.02, 0);
const POST_Z = 0.9;
const POST_BOTTOM = new THREE.Vector3(2.32, RAIL_BOTTOM - 0.04, 0);
const POST_TOP = new THREE.Vector3(2.06, 2.62, 0);

/** 같은 반지름의 두 원을 감는 벨트 경로(스타디움). s는 벨트 두께 중심(rm) 기준 호장. */
class LoopPath {
  readonly length: number;
  private readonly dx: number;
  private readonly dy: number;
  private readonly D: number;
  private readonly phiTop: number;

  constructor(
    private readonly c1x: number,
    private readonly c1y: number,
    private readonly c2x: number,
    private readonly c2y: number,
    private readonly rm: number
  ) {
    this.D = Math.hypot(c2x - c1x, c2y - c1y);
    this.dx = (c2x - c1x) / this.D;
    this.dy = (c2y - c1y) / this.D;
    this.phiTop = Math.atan2(this.dx, -this.dy);
    this.length = 2 * this.D + 2 * Math.PI * rm;
  }

  /** 반지름 r 위치는 (cx + nx·r, cy + ny·r). n은 바깥 법선 */
  frame(s: number): { cx: number; cy: number; nx: number; ny: number } {
    let u = s % this.length;
    if (u < 0) u += this.length;
    const arc = Math.PI * this.rm;
    const nTx = -this.dy;
    const nTy = this.dx;
    if (u < this.D) return { cx: this.c1x + this.dx * u, cy: this.c1y + this.dy * u, nx: nTx, ny: nTy };
    u -= this.D;
    if (u < arc) {
      const p = this.phiTop - u / this.rm;
      return { cx: this.c2x, cy: this.c2y, nx: Math.cos(p), ny: Math.sin(p) };
    }
    u -= arc;
    if (u < this.D) return { cx: this.c2x - this.dx * u, cy: this.c2y - this.dy * u, nx: -nTx, ny: -nTy };
    u -= this.D;
    const p = this.phiTop - Math.PI - u / this.rm;
    return { cx: this.c1x, cy: this.c1y, nx: Math.cos(p), ny: Math.sin(p) };
  }

  /** 직선 구간은 성기게, 호 구간은 촘촘하게 샘플한 s 목록 */
  samples(arcSegs: number, straightSegs = 6): number[] {
    const out: number[] = [];
    const arc = Math.PI * this.rm;
    const push = (start: number, len: number, n: number) => {
      for (let i = 0; i < n; i++) out.push(start + (len * i) / n);
    };
    push(0, this.D, straightSegs);
    push(this.D, arc, arcSegs);
    push(this.D + arc, this.D, straightSegs);
    push(2 * this.D + arc, arc, arcSegs);
    out.push(this.length);
    return out;
  }
}

/** 두께가 있는 납작한 띠(벨트) 지오메트리. u = s / 둘레 (텍스처 repeat로 무늬 개수 지정) */
function buildBandGeometry(path: LoopPath, rIn: number, rOut: number, width: number, arcSegs: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ss = path.samples(arcSegs);
  const hw = width / 2;
  // 4개 면: 0 바깥, 1 안쪽, 2 +Z 옆면, 3 -Z 옆면
  for (let face = 0; face < 4; face++) {
    const base = pos.length / 3;
    for (const s of ss) {
      const f = path.frame(s);
      const u = s / path.length;
      const pIn = [f.cx + f.nx * rIn, f.cy + f.ny * rIn];
      const pOut = [f.cx + f.nx * rOut, f.cy + f.ny * rOut];
      if (face === 0 || face === 1) {
        const p = face === 0 ? pOut : pIn;
        const sg = face === 0 ? 1 : -1;
        pos.push(p[0]!, p[1]!, -hw, p[0]!, p[1]!, hw);
        nor.push(f.nx * sg, f.ny * sg, 0, f.nx * sg, f.ny * sg, 0);
        uv.push(u, 0, u, 1);
      } else {
        const z = face === 2 ? hw : -hw;
        const nz = face === 2 ? 1 : -1;
        pos.push(pIn[0]!, pIn[1]!, z, pOut[0]!, pOut[1]!, z);
        nor.push(0, 0, nz, 0, 0, nz);
        uv.push(u, 0, u, 0.04);
      }
    }
    for (let i = 0; i < ss.length - 1; i++) {
      const a = base + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // 정점 쌍 (a,b)=(바깥면: -Z,+Z / 옆면: 안,밖) — 면마다 바깥을 향하도록 감기 순서 지정
      if (face === 0) idx.push(a, b, c, b, d, c);
      else if (face === 1) idx.push(a, c, b, b, c, d);
      else if (face === 2) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** (반지름, 축방향) 프로파일을 Z축 회전체로 */
function latheZ(profile: [number, number][], segs = 48): THREE.LatheGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 모따기가 있는 링(베어링 궤도륜, 하우징 보스) */
function ringGeo(rIn: number, rOut: number, w: number, ch: number, segs = 48): THREE.LatheGeometry {
  const h = w / 2;
  return latheZ(
    [
      [rIn + ch, -h],
      [rOut - ch, -h],
      [rOut, -h + ch],
      [rOut, h - ch],
      [rOut - ch, h],
      [rIn + ch, h],
      [rIn, h - ch],
      [rIn, -h + ch],
      [rIn + ch, -h]
    ],
    segs
  );
}

function cylZ(r: number, len: number, segs = 32): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, segs);
  g.rotateX(Math.PI / 2);
  return g;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  return t;
}

export class Treadmill extends BaseMachine {
  readonly id = 'treadmill';
  private bearingMesh: THREE.Group | null = null;
  private beltMesh: THREE.Group | null = null;
  private rollerPulley: THREE.Object3D | null = null;
  private motorPulley: THREE.Object3D | null = null;
  private frontRoller = new THREE.Group();
  private rearRoller = new THREE.Group();
  private motorRotor = new THREE.Group();
  private runPath = new LoopPath(REAR_X, ROLLER_Y, FRONT_X, ROLLER_Y, ROLLER_R + BELT_T / 2);
  private drivePath = new LoopPath(FRONT_X, ROLLER_Y, MOTOR_POS.x, MOTOR_POS.y, PULLEY_R);
  private beltTextures: { tex: THREE.Texture; repeats: number; path: LoopPath }[] = [];

  constructor() {
    super();
    this.buildFrame();
    this.buildRollers();
    this.buildMotor();
    this.buildUprights();
    this.group.add(this.frontRoller, this.rearRoller, this.motorRotor);

    this.addSlot(0, 0.12, BEARING_POS);
    this.addBeltSlotOutline();
    this.hideSlot(1);
    this.applyShadows();
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.bearingMesh !== null : this.beltMesh !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? BEARING_POS.clone() : new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? BEARING_POS.clone() : new THREE.Vector3(0, BELT_TOP, 0);
  }

  buildStepModel(step: number): THREE.Group {
    if (step === 0) return this.buildBearingModel();
    return this.buildBeltSet();
  }

  installStep(step: number, model: THREE.Group): void {
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    if (step === 0) {
      // 외륜은 하우징에 고정, 내륜·볼은 sim에서 따로 돈다
      model.position.copy(BEARING_POS);
      model.rotation.set(0, 0, 0);
      this.group.add(model);
      this.bearingMesh = model;
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      this.group.add(model);
      this.beltMesh = model;
      // 풀리는 각자의 회전축으로 옮겨 단다(롤러·모터와 함께 회전)
      const rp = model.getObjectByName('rollerPulley');
      const mp = model.getObjectByName('motorPulley');
      if (rp) {
        this.frontRoller.add(rp);
        rp.position.set(0, 0, DRIVE_Z);
        this.rollerPulley = rp;
      }
      if (mp) {
        this.motorRotor.add(mp);
        mp.position.set(0, 0, DRIVE_Z);
        this.motorPulley = mp;
      }
      this.hideSlot(1);
    }
  }

  reset(): void {
    if (this.bearingMesh) {
      this.group.remove(this.bearingMesh);
      this.bearingMesh = null;
    }
    if (this.beltMesh) {
      this.group.remove(this.beltMesh);
      this.beltMesh = null;
    }
    if (this.rollerPulley) {
      this.frontRoller.remove(this.rollerPulley);
      this.rollerPulley = null;
    }
    if (this.motorPulley) {
      this.motorRotor.remove(this.motorPulley);
      this.motorPulley = null;
    }
    this.beltTextures = [];
    this.frontRoller.rotation.z = 0;
    this.rearRoller.rotation.z = 0;
    this.motorRotor.rotation.z = 0;
    this.showSlot(0);
    this.hideSlot(1);
  }

  createSim(): MachineSim {
    if (!this.beltMesh || !this.bearingMesh) throw new Error('treadmill mission incomplete');
    let angle = 0;
    let time = 0;
    const beltSpeed = ((MOTOR_RPM / 60) * Math.PI * 2 * ROLLER_R).toFixed(2);
    const display: MachineDisplayItem[] = [
      { label: '모터 롤러', value: String(MOTOR_RPM), unit: 'rpm', tone: 'blue' },
      { label: '벨트 속도', value: beltSpeed, unit: 'm/s', tone: 'red' },
      { label: '풀리 비율', value: '1.00', unit: ': 1' }
    ];
    const w = (MOTOR_RPM / 60) * Math.PI * 2;
    const inner = this.bearingMesh.getObjectByName('inner');
    const balls = this.bearingMesh.getObjectByName('balls');
    return {
      update: (dt: number) => {
        time += dt;
        angle += w * dt;
        // 반시계(+z) 회전 → 롤러 꼭대기는 -X로 움직여 벨트 윗면이 뒤로 흐른다
        this.frontRoller.rotation.z = angle;
        this.rearRoller.rotation.z = angle;
        this.motorRotor.rotation.z = angle; // 풀리 1:1 → 모터도 같은 rpm
        if (inner) inner.rotation.z = angle;
        if (balls) balls.rotation.z = angle * 0.4; // 케이지(볼 공전)는 내륜의 약 0.4배
        // 벨트 무늬는 접촉 반지름 속도(ω·r)로 -s 방향 이동 → 텍스처 오프셋 +
        for (const b of this.beltTextures) {
          const rm = b.path === this.runPath ? ROLLER_R + BELT_T / 2 : PULLEY_R;
          b.tex.offset.x = ((b.repeats * w * rm * time) / b.path.length) % 1;
        }
      },
      getDisplay: () => display
    };
  }

  // ───────────────────────── 장착 부품 ─────────────────────────

  private buildBearingModel(): THREE.Group {
    const g = new THREE.Group();
    const ringMat = steel();
    const w = 0.046;
    const outer = mesh(ringGeo(0.068, 0.085, w, 0.004), ringMat);
    outer.name = 'outer';
    const inner = mesh(ringGeo(0.031, 0.046, w, 0.004), ringMat);
    inner.name = 'inner';
    // 볼 9개 + 리벳 케이지 — 병합해 1드로콜
    const ballGeos: THREE.BufferGeometry[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = new THREE.SphereGeometry(0.0125, 20, 14);
      s.translate(Math.cos(a) * 0.057, Math.sin(a) * 0.057, 0);
      ballGeos.push(s);
    }
    const ballGeo = mergeGeometries(ballGeos);
    ballGeos.forEach((b) => b.dispose());
    const balls = new THREE.Group();
    balls.name = 'balls';
    balls.add(mesh(ballGeo, chrome()));
    const cage = mesh(ringGeo(0.053, 0.061, 0.012, 0.002), brass());
    cage.position.z = 0.017;
    balls.add(cage);
    g.add(outer, inner, balls);
    return g;
  }

  /** 2단계: 주행 벨트 + 구동 벨트 + 롤러/모터 풀리 */
  private buildBeltSet(): THREE.Group {
    const g = new THREE.Group();
    this.beltTextures = [];

    // 주행 벨트: 납작한 고무 띠, 가로 줄무늬·화살표 마커가 흐름을 보여 준다
    const runTex = canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#2b2f35';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(255,255,255,0.045)';
      ctx.lineWidth = 2;
      for (let i = -256; i < 256; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 256, 256);
        ctx.stroke();
      }
      ctx.fillStyle = '#9aa4ae';
      ctx.fillRect(18, 0, 12, 256);
      ctx.fillStyle = '#b9c2cb';
      ctx.beginPath();
      ctx.moveTo(110, 128);
      ctx.lineTo(160, 96);
      ctx.lineTo(160, 116);
      ctx.lineTo(200, 116);
      ctx.lineTo(200, 140);
      ctx.lineTo(160, 140);
      ctx.lineTo(160, 160);
      ctx.closePath();
      ctx.fill();
    });
    const runRepeats = Math.round(this.runPath.length / 0.75);
    runTex.repeat.set(runRepeats, 1);
    const runMat = rubber({ roughness: 0.82 });
    runMat.color.set(0xffffff);
    runMat.map = runTex;
    const rm = ROLLER_R + BELT_T / 2;
    const run = mesh(buildBandGeometry(this.runPath, rm - BELT_T / 2, rm + BELT_T / 2, BELT_WIDTH, 40), runMat);
    run.name = 'runBelt';
    g.add(run);
    this.beltTextures.push({ tex: runTex, repeats: runRepeats, path: this.runPath });

    // 구동 벨트(폴리 V): 안쪽 리브 + 흰 인쇄 마크
    const driveTex = canvasTex(256, 32, (ctx) => {
      ctx.fillStyle = '#1e2126';
      ctx.fillRect(0, 0, 256, 32);
      ctx.fillStyle = '#2c3036';
      for (let y = 2; y < 32; y += 8) ctx.fillRect(0, y, 256, 3);
      ctx.fillStyle = '#f0f3f6';
      ctx.fillRect(8, 6, 40, 20);
    });
    const driveRepeats = Math.round(this.drivePath.length / 0.32);
    driveTex.repeat.set(driveRepeats, 1);
    const driveMat = rubber({ roughness: 0.7 });
    driveMat.color.set(0xffffff);
    driveMat.map = driveTex;
    const drive = mesh(buildBandGeometry(this.drivePath, PULLEY_R - DRIVE_T / 2, PULLEY_R + DRIVE_T / 2, 0.045, 32), driveMat);
    drive.position.z = DRIVE_Z;
    drive.name = 'driveBelt';
    g.add(drive);
    this.beltTextures.push({ tex: driveTex, repeats: driveRepeats, path: this.drivePath });

    const rp = this.buildPulley();
    rp.name = 'rollerPulley';
    rp.position.set(FRONT_X, ROLLER_Y, DRIVE_Z);
    const mp = this.buildPulley();
    mp.name = 'motorPulley';
    mp.position.set(MOTOR_POS.x, MOTOR_POS.y, DRIVE_Z);
    g.add(rp, mp);
    return g;
  }

  /** 폴리 V 풀리: 홈 3줄 + 스포크 5개(회전이 보이게) */
  private buildPulley(): THREE.Group {
    const g = new THREE.Group();
    const w = 0.065;
    const h = w / 2;
    const rRoot = PULLEY_R - DRIVE_T / 2 - 0.004;
    const rFl = PULLEY_R + DRIVE_T / 2 + 0.014;
    const prof: [number, number][] = [
      [0.088, -h],
      [rFl - 0.004, -h],
      [rFl, -h + 0.004],
      [rFl, -h + 0.01],
      [rRoot + 0.012, -h + 0.014]
    ];
    // V 홈 3줄(벨트 안쪽 리브가 들어가는 자리)
    const ribs = 3;
    const span = (w - 0.028) / ribs;
    for (let i = 0; i < ribs; i++) {
      const y0 = -h + 0.014 + i * span;
      prof.push([rRoot, y0 + span * 0.5], [rRoot + 0.012, y0 + span]);
    }
    prof.push([rFl, h - 0.01], [rFl, h - 0.004], [rFl - 0.004, h], [0.088, h], [0.088, -h]);
    const rimMat = aluminum();
    g.add(mesh(latheZ(prof, 56), rimMat));
    g.add(mesh(ringGeo(0.026, 0.045, 0.075, 0.004, 32), rimMat));
    const spokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.BoxGeometry(0.05, 0.022, 0.026);
      b.translate(0.066, 0, 0);
      b.rotateZ((i / 5) * Math.PI * 2);
      spokes.push(b);
    }
    const sg = mergeGeometries(spokes);
    spokes.forEach((s) => s.dispose());
    g.add(mesh(sg, rimMat));
    // 키 홈 표시(회전 위상이 보이게)
    g.add(mesh(new THREE.BoxGeometry(0.012, 0.02, 0.078), darkSteel(), 0, 0.03, 0));
    return g;
  }

  private addBeltSlotOutline(): void {
    const loop = (path: LoopPath, z: number, r: number): THREE.TubeGeometry => {
      const pts = path.samples(24, 8).slice(0, -1).map((s) => {
        const f = path.frame(s);
        return new THREE.Vector3(f.cx + f.nx * r, f.cy + f.ny * r, z);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 260, 0.018, 8, true);
    };
    const rm = ROLLER_R + BELT_T / 2;
    const geos = [
      loop(this.runPath, BELT_WIDTH / 2 - 0.01, rm + 0.012),
      loop(this.runPath, -BELT_WIDTH / 2 + 0.01, rm + 0.012),
      loop(this.drivePath, DRIVE_Z, PULLEY_R + 0.015)
    ];
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const ring = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.userData.slot = true;
    this.slots[1] = ring;
    this.group.add(ring);
  }

  // ───────────────────────── 고정 구조물 ─────────────────────────

  private buildFrame(): void {
    const frameMat = paint(0x353c45, { roughness: 0.38 });
    const railLen = RAIL_X1 - RAIL_X0;
    const railGeo = new RoundedBoxGeometry(railLen, RAIL_TOP - RAIL_BOTTOM, RAIL_OUT - RAIL_IN, 3, 0.025);
    for (const sz of [-1, 1]) {
      this.group.add(mesh(railGeo, frameMat, (RAIL_X0 + RAIL_X1) / 2, (RAIL_TOP + RAIL_BOTTOM) / 2, sz * (RAIL_IN + RAIL_OUT) / 2));
    }

    // 크로스 튜브(벨트 루프 안쪽, 데크 아래)
    const tubeGeo = cylZ(0.032, RAIL_IN * 2, 24);
    const tubeMat = darkSteel();
    for (const x of [-0.9, 0, 0.9]) this.group.add(mesh(tubeGeo, tubeMat, x, ROLLER_Y - 0.09, 0));

    // 데크 보드: 벨트 윗면을 받치는 판(벨트 안쪽 면 바로 아래)
    const deck = mesh(new RoundedBoxGeometry(2.47, 0.04, (RAIL_IN + 0.04) * 2, 2, 0.008), wood(0x6e5236), -0.015, DECK_TOP - 0.02, 0);
    this.group.add(deck);

    // 측면 발판 레일 + 고무 미끄럼 방지 줄
    const railTopMat = plastic(0x2a2e34);
    const grip = rubber();
    const footLen = 2.52;
    const footX = -1.3 + footLen / 2;
    const footGeo = new RoundedBoxGeometry(footLen, 0.06, 0.29, 3, 0.018);
    const stripGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const b = new RoundedBoxGeometry(footLen - 0.12, 0.012, 0.03, 1, 0.005);
      b.translate(0, 0, -0.09 + i * 0.06);
      stripGeos.push(b);
    }
    const stripGeo = mergeGeometries(stripGeos);
    stripGeos.forEach((s) => s.dispose());
    for (const sz of [-1, 1]) {
      const zc = sz * 0.675;
      this.group.add(mesh(footGeo, railTopMat, footX, DECK_TOP + 0.03, zc));
      this.group.add(mesh(stripGeo, grip, footX, DECK_TOP + 0.064, zc));
    }

    // 뒤 엔드캡(뒤 롤러 축 끝 덮개)
    const capGeo = new RoundedBoxGeometry(0.44, RAIL_TOP - RAIL_BOTTOM + 0.1, 0.22, 4, 0.05);
    const capMat = plastic(0x24282d);
    for (const sz of [-1, 1]) this.group.add(mesh(capGeo, capMat, -1.55, (RAIL_TOP + RAIL_BOTTOM) / 2 + 0.02, sz * 0.69));

    // 수평 조절 발(고무 패드 + 나사 축)
    const padGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.05, 32);
    const stemGeo = new THREE.CylinderGeometry(0.022, 0.022, RAIL_BOTTOM - 0.05, 16);
    const stemMat = steel();
    for (const x of [-1.5, 2.28]) {
      for (const sz of [-1, 1]) {
        const z = sz * (RAIL_IN + RAIL_OUT) / 2;
        this.group.add(mesh(padGeo, grip, x, 0.025, z));
        this.group.add(mesh(stemGeo, stemMat, x, 0.05 + (RAIL_BOTTOM - 0.05) / 2, z));
      }
    }

    // 모터 팬: 레일 앞 끝이 올라앉는 강판 바닥 + 낮은 옆 립
    const panMat = paint(0x353c45, { roughness: 0.38 });
    this.group.add(mesh(new RoundedBoxGeometry(PAN_X1 - PAN_X0, PAN_T, RAIL_OUT * 2, 2, 0.012), panMat, (PAN_X0 + PAN_X1) / 2, PAN_TOP - PAN_T / 2, 0));
    const lipGeo = new RoundedBoxGeometry(PAN_X1 - RAIL_X1 - 0.02, 0.07, 0.04, 2, 0.012);
    for (const sz of [-1, 1]) this.group.add(mesh(lipGeo, panMat, (RAIL_X1 + PAN_X1) / 2 + 0.01, PAN_TOP + 0.035, sz * (RAIL_OUT - 0.02)));

    // 모터 커버(반투명 — 안의 모터·풀리·벨트가 보이게)
    const hood = new THREE.Shape();
    const x0 = 1.67;
    const x1 = 2.43;
    hood.moveTo(x0, PAN_TOP + 0.03);
    hood.lineTo(x0, 0.7);
    hood.quadraticCurveTo(x0, 0.79, 1.82, 0.79);
    hood.lineTo(2.18, 0.75);
    hood.quadraticCurveTo(x1, 0.72, x1, 0.52);
    hood.lineTo(x1, PAN_TOP + 0.03);
    hood.closePath();
    const hoodDepth = 1.5;
    const hoodGeo = new THREE.ExtrudeGeometry(hood, {
      depth: hoodDepth,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 4,
      curveSegments: 24
    });
    hoodGeo.translate(0, 0, -hoodDepth / 2);
    const hoodMesh = mesh(hoodGeo, ghost(0xaec4d8, 0.26));
    hoodMesh.userData.ghost = true;
    hoodMesh.renderOrder = 2;
    this.group.add(hoodMesh);
  }

  private buildRollers(): void {
    const tubeMat = steel();
    const len = BELT_WIDTH + 0.04;
    const hl = len / 2;
    // 롤러 관: 양 끝 모따기, 축 구멍 쪽은 엔드 플러그
    const rollerGeo = latheZ(
      [
        [0.03, -hl],
        [ROLLER_R - 0.012, -hl],
        [ROLLER_R, -hl + 0.012],
        [ROLLER_R, hl - 0.012],
        [ROLLER_R - 0.012, hl],
        [0.03, hl]
      ],
      56
    );
    const axleLen = RAIL_OUT * 2 + 0.12;
    const axleGeo = cylZ(0.03, axleLen, 20);
    const axleMat = steel();
    // 롤러 끝 홈선(회전 위상 표시)
    const markGeo = new THREE.BoxGeometry(0.015, 0.006, len - 0.06);
    const markMat = darkSteel();
    for (const [grp, x] of [
      [this.frontRoller, FRONT_X],
      [this.rearRoller, REAR_X]
    ] as const) {
      grp.position.set(x, ROLLER_Y, 0);
      grp.add(mesh(rollerGeo, tubeMat));
      grp.add(mesh(axleGeo, axleMat, 0, 0, 0.03));
      grp.add(mesh(markGeo, markMat, 0, ROLLER_R - 0.001, 0));
    }

    // 앞 롤러 +Z 축 끝: 4볼트 플랜지 베어링 하우징(1단계 베어링 자리)
    const housingMat = castIron();
    const flange = mesh(new RoundedBoxGeometry(0.26, 0.26, 0.02, 2, 0.03), housingMat, FRONT_X, ROLLER_Y, RAIL_OUT + 0.01);
    const boss = mesh(ringGeo(0.087, 0.118, 0.05, 0.006), housingMat, FRONT_X, ROLLER_Y, RAIL_OUT + 0.045);
    this.group.add(flange, boss);
    const boltGeos: THREE.BufferGeometry[] = [];
    for (const [bx, by] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ] as const) {
      const b = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6);
      b.rotateX(Math.PI / 2);
      b.translate(bx * 0.095, by * 0.095, 0.03);
      boltGeos.push(b);
    }
    const bolts = mergeGeometries(boltGeos);
    boltGeos.forEach((b) => b.dispose());
    this.group.add(mesh(bolts, steel(), FRONT_X, ROLLER_Y, RAIL_OUT));

    // 앞 롤러 -Z 축 끝: 닫힌 베어링 캡(이미 조립된 쪽)
    const capGeo = latheZ(
      [
        [0, -0.03],
        [0.1, -0.03],
        [0.105, -0.022],
        [0.1, 0.0],
        [0.07, 0.03],
        [0, 0.035]
      ],
      40
    );
    capGeo.rotateY(Math.PI);
    this.group.add(mesh(capGeo, housingMat, FRONT_X, ROLLER_Y, -RAIL_OUT - 0.03));
  }

  private buildMotor(): void {
    const { x, y } = MOTOR_POS;
    // P: 풀리 쪽 축 방향(+1 = +Z). 권선 개방부는 풀리 쪽, 플라이휠은 반대쪽
    const P = Math.sign(DRIVE_Z);
    // 방열핀이 달린 모터 하우징(Z축)
    const fins = 28;
    const rBase = 0.15;
    const rTip = 0.172;
    const shape = new THREE.Shape();
    const step = (Math.PI * 2) / fins;
    for (let i = 0; i < fins; i++) {
      const a = i * step;
      const pts: [number, number][] = [
        [rBase, a],
        [rTip, a + step * 0.35],
        [rTip, a + step * 0.55],
        [rBase, a + step * 0.9]
      ];
      pts.forEach(([r, ang], k) => {
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0 && k === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      });
    }
    shape.closePath();
    const housingLen = 0.4;
    const housingGeo = new THREE.ExtrudeGeometry(shape, { depth: housingLen, bevelEnabled: false });
    housingGeo.translate(0, 0, P > 0 ? -0.1 : -0.3);
    const bodyMat = paint(0x2e5f8f, { roughness: 0.45 });
    this.group.add(mesh(housingGeo, bodyMat, x, y, 0));

    // 뒤(+Z) 엔드벨
    const bell = latheZ(
      [
        [0, 0.17],
        [0.05, 0.17],
        [0.06, 0.16],
        [0.13, 0.14],
        [0.152, 0.115],
        [0.152, 0.1],
        [0, 0.1]
      ],
      48
    );
    if (P > 0) bell.rotateY(Math.PI);
    const alu = aluminum();
    this.group.add(mesh(bell, alu, x, y, 0));

    // 앞(-Z) 개방부: 적층 철심 + 구리 권선 엔드턴이 보인다
    this.group.add(mesh(cylZ(0.142, 0.04, 48), darkSteel(), x, y, P * 0.32));
    const coil = new THREE.TorusGeometry(0.1, 0.03, 16, 48);
    this.group.add(mesh(coil, copper(), x, y, P * 0.37));
    const bundleGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const t = new THREE.TorusGeometry(0.028, 0.012, 8, 16);
      t.rotateY(Math.PI / 2);
      t.rotateZ(a);
      t.translate(Math.cos(a) * 0.1, Math.sin(a) * 0.1, P * 0.395);
      bundleGeos.push(t);
    }
    const bundles = mergeGeometries(bundleGeos);
    bundleGeos.forEach((b) => b.dispose());
    this.group.add(mesh(bundles, copper(), x, y, 0));
    // 앞 브래킷 + 타이 볼트 4개
    this.group.add(mesh(ringGeo(0.03, 0.158, 0.03, 0.006), alu, x, y, P * 0.455));
    const rodGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
      const c = cylZ(0.011, 0.17, 12);
      c.translate(Math.cos(a) * 0.145, Math.sin(a) * 0.145, P * 0.385);
      rodGeos.push(c);
    }
    const rods = mergeGeometries(rodGeos);
    rodGeos.forEach((b) => b.dispose());
    this.group.add(mesh(rods, steel(), x, y, 0));

    // 모터 받침(새들) 2개
    const saddleGeo = new RoundedBoxGeometry(0.22, 0.15, 0.07, 2, 0.012);
    for (const a of [0.2, -0.02]) this.group.add(mesh(saddleGeo, darkSteel(), x, y - 0.2, P * a));

    // 회전부: 축 + 냉각팬 겸 플라이휠(+Z 끝)
    this.motorRotor.position.set(x, y, 0);
    this.motorRotor.add(mesh(cylZ(0.024, 0.86, 20), steel(), 0, 0, P * 0.18));
    const fly = new THREE.Group();
    fly.position.z = -P * 0.215;
    fly.add(mesh(ringGeo(0.024, 0.15, 0.03, 0.006, 56), darkSteel()));
    const vaneGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const b = new THREE.BoxGeometry(0.1, 0.012, 0.045);
      b.translate(0.09, 0, -P * 0.03);
      b.rotateZ((i / 8) * Math.PI * 2);
      vaneGeos.push(b);
    }
    const vanes = mergeGeometries(vaneGeos);
    vaneGeos.forEach((b) => b.dispose());
    fly.add(mesh(vanes, alu));
    // 회전이 보이도록 플라이휠 한 곳에 색 마커
    fly.add(mesh(new THREE.BoxGeometry(0.04, 0.03, 0.034), paint(0xf2b619), 0.125, 0, 0));
    this.motorRotor.add(fly);
  }

  private buildUprights(): void {
    const postMat = paint(0xc9d0d8, { roughness: 0.35 });
    const dir = POST_TOP.clone().sub(POST_BOTTOM);
    const len = dir.length();
    const postGeo = new RoundedBoxGeometry(0.13, len, 0.1, 3, 0.03);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const bracketGeo = new RoundedBoxGeometry(0.3, 0.07, POST_Z - RAIL_OUT + 0.06, 2, 0.02);
    const bracketMat = paint(0x353c45, { roughness: 0.38 });
    const postX = (yy: number) => POST_BOTTOM.x + ((POST_TOP.x - POST_BOTTOM.x) * (yy - POST_BOTTOM.y)) / (POST_TOP.y - POST_BOTTOM.y);
    for (const sz of [-1, 1]) {
      const post = mesh(postGeo, postMat);
      post.position.copy(POST_BOTTOM).addScaledVector(dir, 0.5);
      post.position.z = sz * POST_Z;
      post.quaternion.copy(q);
      this.group.add(post);
      // 레일 바깥면에 붙는 브래킷
      this.group.add(mesh(bracketGeo, bracketMat, POST_BOTTOM.x, PAN_TOP - 0.005, sz * (RAIL_OUT + (POST_Z - RAIL_OUT) / 2)));
    }

    // 손잡이(양옆) — 기둥에서 뒤로 뻗는 파이프 + 폼 그립
    const handMat = aluminum();
    const foam = rubber({ roughness: 0.95 });
    const yH = 2.25;
    for (const sz of [-1, 1]) {
      const z = sz * POST_Z;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(postX(yH) + 0.02, yH, z),
        new THREE.Vector3(1.55, yH + 0.02, z),
        new THREE.Vector3(1.05, yH - 0.03, z),
        new THREE.Vector3(0.82, yH - 0.16, z)
      ]);
      this.group.add(mesh(new THREE.TubeGeometry(curve, 48, 0.034, 20), handMat));
      const gripCurve = new THREE.CatmullRomCurve3(curve.getPoints(40).slice(14, 36));
      this.group.add(mesh(new THREE.TubeGeometry(gripCurve, 32, 0.046, 20), foam));
      const end = curve.getPoint(1);
      this.group.add(mesh(new THREE.SphereGeometry(0.036, 20, 14), plastic(0x23262b), end.x, end.y, end.z));
    }

    // 앞 가로봉 + 심박 센서 그립
    const yB = 2.02;
    const barX = postX(yB) - 0.04;
    this.group.add(mesh(cylZ(0.034, POST_Z * 2, 24), handMat, barX, yB, 0));
    const sensorGeo = cylZ(0.046, 0.22, 24);
    for (const sz of [-1, 1]) this.group.add(mesh(sensorGeo, chrome(), barX, yB, sz * 0.38));

    // 콘솔: 러너 쪽(-X)으로 기울어진 패널 + 발광 화면
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(POST_TOP.x - 0.04, POST_TOP.y + 0.1, 0);
    consoleGroup.rotation.z = -0.5;
    consoleGroup.add(mesh(new RoundedBoxGeometry(0.17, 0.5, 2.06, 4, 0.06), plastic(0x23262b)));
    const screenTex = canvasTex(512, 160, (ctx) => {
      ctx.fillStyle = '#04121c';
      ctx.fillRect(0, 0, 512, 160);
      ctx.fillStyle = '#5fe3ff';
      ctx.font = 'bold 74px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('6.0', 40, 84);
      ctx.font = 'bold 30px monospace';
      ctx.fillText('km/h', 175, 104);
      ctx.fillStyle = '#ffd36b';
      ctx.font = 'bold 60px monospace';
      ctx.fillText('12:34', 300, 84);
      ctx.fillStyle = '#2fd38a';
      for (let i = 0; i < 12; i++) ctx.fillRect(40 + i * 36, 136, 26, 10 - (i % 3) * 2);
    });
    const screenMat = glow(0xffffff, 1.0);
    screenMat.color.set(0xffffff);
    screenMat.map = screenTex;
    screenMat.emissiveMap = screenTex;
    screenMat.emissiveIntensity = 0.9;
    const screenGeo = new THREE.PlaneGeometry(1.1, 0.34);
    screenGeo.rotateY(-Math.PI / 2);
    consoleGroup.add(mesh(screenGeo, screenMat, -0.088, 0.02, 0));
    // 버튼 줄
    const btnGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20);
      b.rotateZ(Math.PI / 2);
      b.translate(-0.09, -0.19, -0.75 + (i < 3 ? i : i + 6) * 0.11);
      btnGeos.push(b);
    }
    const btns = mergeGeometries(btnGeos);
    btnGeos.forEach((b) => b.dispose());
    consoleGroup.add(mesh(btns, plastic(0xd8362f, { roughness: 0.4 })));
    this.group.add(consoleGroup);
  }

  private applyShadows(): void {
    this.enableShadows();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.slot) return;
      if (m.userData.ghost) {
        m.castShadow = false;
        return;
      }
      m.receiveShadow = true;
    });
  }
}
