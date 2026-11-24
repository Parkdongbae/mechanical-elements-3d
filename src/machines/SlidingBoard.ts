// 상하 이동 칠판: 스프로킷과 체인 미션 — 교실 앞 벽의 세로 레일 프레임에 칠판 2장(앞·뒤)이 걸려 있다.
// 위쪽 가로축의 스프로킷(좌·우)을 체인이 넘어가며 두 칠판 가장자리를 잇는다(양끝 고정, 길이 일정).
// 앞 칠판이 h 오르면 체인이 h만큼 끌려가 뒤 칠판은 h 내려간다. 스프로킷 각 = h / 피치 반지름.
// 좌표: +X 오른쪽, +Z 화면 앞, 체인 평면은 YZ(스프로킷 축 = X). 체인 계산은 로컬 XY(로컬 x = 월드 z)에서 한다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseMachine, type MachineSim } from './types';
import { CATEGORY_COLORS, aluminum, chrome, darkSteel, paint, plastic, steel } from '../models/materials';
import { chainLinkGeometry, chainMaterial } from '../models/parts/chain';
import { sprocketOutline } from '../models/parts/gears';
import { extrude, lathe, type V2 } from '../models/parts/geom';

const M_PER_UNIT = 0.35;

// ── 체인·스프로킷 ──
const TEETH = 16;
const LINKS = 30; // 짝수: 안/바깥 링크가 번갈아
const YS = 3.0; // 스프로킷 축 높이
const YC0 = 1.65; // 칠판 중심 기준 높이(두 장이 같은 높이일 때)
const H0 = YS - YC0; // 기준 상태에서 접선점 ~ 칠판 연결점 길이
const TRAVEL = 0.45; // 칠판 중심 이동 진폭
/** 체인 전체 길이 = LINKS × PITCH = 2·H0 + (반 바퀴 호장 = PITCH·TEETH/2) 가 되도록 피치를 정한다 */
const PITCH = (2 * H0) / (LINKS - TEETH / 2);
const R = (PITCH * TEETH) / (Math.PI * 2); // 피치 반지름
const XC = 1.05; // 체인·스프로킷 x (좌우 대칭)
const PERIOD = 8;

// ── 칠판 ──
const BW = 1.25; // 칠판 반폭(프레임 포함)
const BH = 1.15;
const BT = 0.07; // 프레임 두께(z)
const SLAB_W = 2 * BW - 0.1;
const SLAB_H = BH - 0.1;
const ZB = R + 0.12; // 칠판 중심 z (체인보다 바깥)
const GAP = 0.05; // 레일 홈 반 폭
const RAIL_WEB_X = 1.51;
const CH_BOT = 0.12;
const CH_TOP = 3.4;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function latheZ(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

function latheX(p: V2[], seg = 48): THREE.BufferGeometry {
  const g = lathe(p, seg);
  g.rotateZ(-Math.PI / 2);
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

/** 체인 로컬 XY에서 롤러 j(거리 d = j·PITCH, 앞 칠판 연결점에서 잰 길이)의 위치. hA = 앞 연결점 ~ 접선점 길이 */
function rollerPos(d: number, hA: number): { x: number; y: number } {
  if (d <= hA) return { x: R, y: YS - hA + d };
  const arc = Math.PI * R;
  if (d <= hA + arc) {
    const th = (d - hA) / R;
    return { x: R * Math.cos(th), y: YS + R * Math.sin(th) };
  }
  return { x: -R, y: YS - (d - hA - arc) };
}

function chalkTexture(variant: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 448;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 1024, 448);
    g.addColorStop(0, '#2d5c49');
    g.addColorStop(1, '#214a39');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 448);
    let seed = 7 + variant * 13;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    ctx.fillStyle = 'rgba(235,245,238,0.045)';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.ellipse(rnd() * 1024, rnd() * 448, 60 + rnd() * 140, 20 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const font = (px: number) => `bold ${px}px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
    const chalk = (text: string, x: number, y: number, px: number) => {
      ctx.font = font(px);
      ctx.fillStyle = 'rgba(240,244,238,0.30)';
      ctx.fillText(text, x + 2, y + 2);
      ctx.fillStyle = 'rgba(244,247,242,0.92)';
      ctx.fillText(text, x, y);
    };
    const gear = (cx: number, cy: number, r: number) => {
      ctx.strokeStyle = 'rgba(244,247,242,0.9)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r + 18), cy + Math.sin(a) * (r + 18));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    };
    if (variant === 0) {
      chalk('기계요소', 60, 150, 120);
      chalk('y = 2x + 1', 70, 300, 78);
      chalk('회전 → 직선', 60, 400, 52);
      gear(790, 230, 90);
      gear(930, 130, 48);
    } else {
      chalk('체인과 스프로킷', 50, 140, 92);
      chalk('v = r × ω', 70, 290, 80);
      ctx.strokeStyle = 'rgba(244,247,242,0.9)';
      ctx.lineWidth = 5;
      for (const cx of [700, 900]) {
        ctx.beginPath();
        ctx.arc(cx, 330, 55, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(700, 275);
      ctx.lineTo(900, 275);
      ctx.moveTo(700, 385);
      ctx.lineTo(900, 385);
      ctx.stroke();
      chalk('앞 ↑  뒤 ↓', 70, 400, 56);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class SlidingBoard extends BaseMachine {
  readonly id = 'board';
  private boardF = new THREE.Group();
  private boardB = new THREE.Group();
  private shaft = new THREE.Group();
  private props = new THREE.Group();
  private sprocketModel: THREE.Group | null = null;
  private chainModel: THREE.Group | null = null;
  private sprockets: THREE.Object3D[] = [];
  private inner: THREE.InstancedMesh[] = [];
  private outer: THREE.InstancedMesh[] = [];
  private propAnim: { k: number; last: number } | null = null;
  private readonly dummy = new THREE.Object3D();

  private readonly frameMat = aluminum({ roughness: 0.38 });
  private readonly darkMat = darkSteel();
  private readonly steelMat = steel();

  constructor() {
    super();
    this.group.add(this.boardF, this.boardB, this.shaft, this.props);
    this.buildFrame();
    this.buildShaft();
    this.buildWall();
    this.boardF.add(this.buildBoard(1));
    this.boardB.add(this.buildBoard(-1));
    this.boardF.position.z = ZB;
    this.boardB.position.z = -ZB;
    this.buildProps();

    const slot0 = new THREE.Vector3(XC, YS, 0);
    this.addSlot(0, R + 0.08, slot0, 0.022);
    const s0 = this.slots[0];
    if (s0) {
      s0.rotation.y = Math.PI / 2;
      const twin = new THREE.Mesh(s0.geometry, s0.material);
      twin.position.set(0, 0, -2 * XC); // 로컬 z = 월드 x
      twin.userData.slot = true;
      s0.add(twin);
    }
    this.addChainSlot();
    this.hideSlot(1);

    shadowAll(this.group);
    for (const s of this.slots) {
      if (!s) continue;
      s.userData.noAO = true;
      s.traverse((o) => {
        o.userData.noAO = true;
        (o as THREE.Mesh).castShadow = false;
        (o as THREE.Mesh).receiveShadow = false;
      });
    }
    this.applyHeight(0);
  }

  isInstalled(step: number): boolean {
    return step === 0 ? this.sprocketModel !== null : this.chainModel !== null;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(0, YS, 0) : new THREE.Vector3(0, 0, 0);
  }

  slotTarget(step: number): THREE.Vector3 {
    return step === 0 ? new THREE.Vector3(XC, YS, 0.1) : new THREE.Vector3(XC, YS - 0.3, R + 0.05);
  }

  buildStepModel(step: number): THREE.Group {
    const g = new THREE.Group();
    if (step === 0) {
      for (const sx of [1, -1]) {
        const holder = new THREE.Group();
        holder.position.set(sx * XC, 0, 0);
        holder.rotation.y = -Math.PI / 2;
        const spr = this.buildSprocket(sx);
        spr.name = 'spr';
        spr.rotation.z = -H0 / R;
        holder.add(spr);
        g.add(holder);
      }
    } else {
      const innerGeo = chainLinkGeometry(PITCH, true);
      const outerGeo = chainLinkGeometry(PITCH, false);
      const mat = chainMaterial();
      for (const sx of [1, -1]) {
        const sub = new THREE.Group();
        sub.position.set(sx * XC, 0, 0);
        sub.rotation.y = -Math.PI / 2;
        const a = new THREE.InstancedMesh(innerGeo, mat, LINKS / 2);
        const b = new THREE.InstancedMesh(outerGeo, mat, LINKS / 2);
        a.userData.parity = 0;
        b.userData.parity = 1;
        a.frustumCulled = false;
        b.frustumCulled = false;
        sub.add(a, b);
        g.add(sub);
      }
    }
    shadowAll(g);
    return g;
  }

  installStep(step: number, model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
    if (step === 0) {
      model.position.set(0, YS, 0);
      this.group.add(model);
      this.sprocketModel = model;
      this.sprockets = [];
      model.traverse((o) => {
        if (o.name === 'spr') this.sprockets.push(o);
      });
      this.hideSlot(0);
      this.showSlot(1);
    } else {
      model.position.set(0, 0, 0);
      this.group.add(model);
      this.chainModel = model;
      this.inner = [];
      this.outer = [];
      model.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) (o.userData.parity === 0 ? this.inner : this.outer).push(o);
      });
      this.hideSlot(1);
      this.propAnim = { k: 0, last: -1 };
    }
    this.applyHeight(0);
  }

  reset(): void {
    if (this.sprocketModel) this.group.remove(this.sprocketModel);
    if (this.chainModel) this.group.remove(this.chainModel);
    this.sprocketModel = this.chainModel = null;
    this.sprockets = [];
    this.inner = [];
    this.outer = [];
    this.propAnim = null;
    this.props.visible = true;
    this.props.position.y = 0;
    this.applyHeight(0);
    this.showSlot(0);
    this.hideSlot(1);
  }

  update(t: number): void {
    super.update(t);
    if (this.propAnim) {
      const dt = this.propAnim.last < 0 ? 0 : Math.min(0.05, t - this.propAnim.last);
      this.propAnim.last = t;
      this.propAnim.k += dt / 1.0;
      this.props.position.y = -0.4 * smooth(this.propAnim.k);
      if (this.propAnim.k >= 1) this.finishProps();
    }
  }

  private finishProps(): void {
    this.propAnim = null;
    this.props.visible = false;
  }

  createSim(): MachineSim {
    if (!this.sprocketModel || !this.chainModel) throw new Error('board mission incomplete');
    this.finishProps();
    let time = 0;
    let h = 0;
    return {
      update: (dt: number) => {
        time += dt;
        h = TRAVEL * Math.sin((time * Math.PI * 2) / PERIOD) * smooth(time / 1.0);
        this.applyHeight(h);
      },
      getDisplay: () => {
        const front = (YC0 + h - BH / 2) * M_PER_UNIT * 100;
        const back = (YC0 - h - BH / 2) * M_PER_UNIT * 100;
        return [
          { label: '앞 칠판 높이', value: front.toFixed(1), unit: 'cm', tone: 'red' },
          { label: '뒤 칠판 높이', value: back.toFixed(1), unit: 'cm', tone: 'blue' },
          { label: '두 높이의 합 (일정)', value: (front + back).toFixed(1), unit: 'cm' }
        ];
      }
    };
  }

  /** 앞 칠판 상승량 h → 칠판·스프로킷·축·체인 전부 갱신 */
  private applyHeight(h: number): void {
    this.boardF.position.y = YC0 + h;
    this.boardB.position.y = YC0 - h;
    const psi = (h - H0) / R; // 체인 롤러가 이골 중심에 앉는 위상
    for (const s of this.sprockets) s.rotation.z = psi;
    this.shaft.rotation.x = -h / R; // 로컬 z = 월드 -x 이므로 부호 반전
    if (this.inner.length === 0) return;
    const hA = H0 - h;
    const pts: { x: number; y: number }[] = [];
    for (let j = 0; j <= LINKS; j++) pts.push(rollerPos(j * PITCH, hA));
    const d = this.dummy;
    for (let i = 0; i < LINKS; i++) {
      const p = pts[i]!;
      const q = pts[i + 1]!;
      d.position.set((p.x + q.x) / 2, (p.y + q.y) / 2, 0);
      d.rotation.set(0, 0, Math.atan2(q.y - p.y, q.x - p.x));
      d.updateMatrix();
      const list = i % 2 === 0 ? this.inner : this.outer;
      for (const m of list) {
        m.setMatrixAt(i >> 1, d.matrix);
        m.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // ───────────────────────── 미션 부품 ─────────────────────────

  /** 롤러 체인용 스프로킷(전동용 = 빨강 포인트). side: +1 오른쪽(허브가 +x 바깥), -1 왼쪽 */
  private buildSprocket(side: number): THREE.Group {
    const g = new THREE.Group();
    const chord = 2 * R * Math.sin(Math.PI / TEETH);
    const outline = sprocketOutline(TEETH, chord, PITCH * 0.31, 0);
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes.push(new THREE.Path().absarc(0, 0, 0.03, 0, Math.PI * 2, true));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      shape.holes.push(new THREE.Path().absarc(Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56, R * 0.17, 0, Math.PI * 2, true));
    }
    const thick = PITCH * 0.3;
    g.add(new THREE.Mesh(extrude(shape, thick, 0.004, 12), steel({ color: 0xbcc4cd, roughness: 0.3 })));
    // 허브: 바깥쪽(월드 +x = 로컬 -z)에 붙인다
    const zs = -side;
    const z0 = thick / 2;
    const prof: V2[] = [[0.03, z0], [0.08, z0], [0.088, z0 + 0.008], [0.088, z0 + 0.05], [0.03, z0 + 0.05], [0.03, z0]];
    const hub = new THREE.Mesh(latheZ(prof, 40), this.darkMat);
    hub.scale.z = zs;
    g.add(hub);
    const ring = new THREE.Mesh(latheZ([[0.05, z0 + 0.05], [0.082, z0 + 0.05], [0.082, z0 + 0.056], [0.05, z0 + 0.056]], 40), paint(CATEGORY_COLORS.power, { roughness: 0.35 }));
    ring.scale.z = zs;
    g.add(ring);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 6), this.steelMat);
    screw.position.set(0, 0.095, zs * (z0 + 0.025));
    g.add(screw);
    return g;
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildBoard(s: number): THREE.Group {
    const g = new THREE.Group();
    const face = plastic(0xffffff, { roughness: 0.9, grain: false });
    face.map = chalkTexture(s > 0 ? 0 : 1);
    const edge = plastic(0x1f4837, { grain: false });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(SLAB_W, SLAB_H, 0.05), [edge, edge, edge, edge, face, face]));
    const fm = this.frameMat;
    for (const sy of [-1, 1]) g.add(box(2 * BW, 0.06, BT, 0.012, fm, 0, sy * (BH / 2 - 0.03), 0));
    for (const sx of [-1, 1]) g.add(box(0.06, BH - 0.12, BT, 0.012, fm, sx * (BW - 0.03), 0, 0));
    // 분필 받침대 + 분필 + 지우개 (바깥면 쪽)
    const zo = s * (BT / 2 + 0.05);
    g.add(box(2.2, 0.025, 0.1, 0.008, fm, 0, -BH / 2 + 0.02, zo));
    g.add(box(2.2, 0.05, 0.014, 0.005, fm, 0, -BH / 2 + 0.045, s * (BT / 2 + 0.1)));
    const chalkMat = plastic(0xf3f3ee, { roughness: 0.9, grain: false });
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 12), chalkMat);
      c.rotation.z = Math.PI / 2;
      c.position.set(-0.55 + i * 0.1, -BH / 2 + 0.045, zo + (i - 1) * 0.012);
      g.add(c);
    }
    g.add(box(0.2, 0.04, 0.07, 0.006, plastic(0x2a2c30), 0.55, -BH / 2 + 0.047, zo));
    g.add(box(0.2, 0.025, 0.07, 0.006, plastic(0xc9a46a), 0.55, -BH / 2 + 0.0775, zo));
    // 레일에 끼는 미끄럼 날개 (위·아래, 좌·우)
    const shoe = this.darkMat;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(box(0.18, 0.12, 0.04, 0.01, shoe, sx * (BW + 0.09), sy * (BH / 2 - 0.17), 0));
    // 체인 연결 브래킷: 칠판 안쪽 면 → 체인 끝 롤러(핀이 관통)
    const zr = s * (R - ZB);
    for (const sx of [-1, 1]) {
      g.add(box(0.09, 0.12, ZB - BT / 2 - R, 0.008, this.steelMat, sx * XC, 0, (zr - (s * BT) / 2) / 2));
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.12, 14), chrome());
      pin.rotation.z = Math.PI / 2;
      pin.position.set(sx * XC, 0, zr);
      g.add(pin);
    }
    return g;
  }

  private buildFrame(): void {
    const g = this.group;
    const am = this.frameMat;
    const dm = this.darkMat;
    const hC = CH_TOP - CH_BOT;
    const yC = (CH_TOP + CH_BOT) / 2;
    for (const sx of [-1, 1]) {
      for (const s of [-1, 1]) {
        const zc = s * ZB;
        g.add(box(0.04, hC, 0.15, 0.004, am, sx * RAIL_WEB_X, yC, zc));
        for (const f of [-1, 1]) g.add(box(0.23, hC, 0.025, 0.004, am, sx * 1.415, yC, zc + f * (GAP + 0.0125)));
      }
      g.add(box(0.22, 0.1, 2 * ZB + 0.3, 0.01, dm, sx * 1.42, 3.45, 0));
      g.add(box(0.3, 0.12, 2 * ZB + 0.3, 0.01, dm, sx * 1.42, 0.06, 0));
      // 축 걸이판 + 베어링 링
      g.add(box(0.05, 0.64, 0.24, 0.006, dm, sx * 1.3, 3.03, 0));
      const ring = new THREE.Mesh(latheX([[0.03, -0.02], [0.062, -0.02], [0.062, 0.02], [0.03, 0.02]], 32), chrome());
      ring.position.set(sx * 1.3 - sx * 0.04, YS, 0);
      g.add(ring);
    }
    g.add(box(3.24, 0.1, 0.16, 0.01, dm, 0, 3.4, 0));
    g.add(box(3.24, 0.1, 0.16, 0.01, dm, 0, 0.06, 0));
  }

  private buildShaft(): void {
    this.shaft.position.set(0, YS, 0);
    const rod = new THREE.Mesh(latheX([[0, -1.42], [0.027, -1.42], [0.028, -1.4], [0.028, 1.4], [0.027, 1.42], [0, 1.42]], 32), chrome({ roughness: 0.2 }));
    this.shaft.add(rod);
    const key = box(0.34, 0.014, 0.02, 0.003, this.darkMat, 0, 0.03, 0);
    this.shaft.add(key);
    const band = new THREE.Mesh(latheX([[0.027, -0.05], [0.036, -0.05], [0.036, 0.05], [0.027, 0.05]], 32), paint(CATEGORY_COLORS.shaft, { roughness: 0.35 }));
    band.position.x = 0.6;
    this.shaft.add(band);
    const band2 = band.clone();
    band2.position.x = -0.6;
    this.shaft.add(band2);
  }

  private buildWall(): void {
    const wall = box(5.0, 3.8, 0.12, 0.01, plastic(0xe6e0d0, { roughness: 0.9 }), 0, 1.9, -1.0);
    this.group.add(wall);
    this.group.add(box(5.0, 0.14, 0.03, 0.005, plastic(0x9a8f7e, { roughness: 0.7 }), 0, 0.07, -0.925));
  }

  /** 체인이 없을 때 칠판을 받치는 임시 받침(레일 홈 속) — 체인을 달면 아래로 빠진다 */
  private buildProps(): void {
    const m = paint(0xe0932a, { roughness: 0.45 });
    const yTop = YC0 - BH / 2 + 0.17 - 0.06;
    for (const sx of [-1, 1]) {
      for (const s of [-1, 1]) {
        this.props.add(box(0.12, 0.08, 0.07, 0.01, m, sx * 1.34, yTop - 0.04, s * ZB));
      }
    }
  }

  private addChainSlot(): void {
    const pts: THREE.Vector3[] = [];
    const total = LINKS * PITCH;
    for (let i = 0; i <= 120; i++) {
      const p = rollerPos((i / 120) * total, H0);
      pts.push(new THREE.Vector3(XC, p.y, p.x));
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.018, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x145a32, emissive: 0x2ecc71, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    tube.userData.slot = true;
    const twin = new THREE.Mesh(tube.geometry, tube.material);
    twin.position.x = -2 * XC;
    twin.userData.slot = true;
    tube.add(twin);
    this.slots[1] = tube;
    this.group.add(tube);
  }
}
