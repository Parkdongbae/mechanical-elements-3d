// 엔진 생성기 — 7종 모두 같은 코드로 만든다(뱅크 수·뱅크 각·뱅크당 실린더 수·핀 위상만 다름).
// 크랭크축 = X축(+X가 앞, 1번 쪽). 크랭크 중심이 국소 원점.
// 피스톤·커넥팅 로드·연소 불꽃은 InstancedMesh(엔진당 3드로콜), 고정 구조는 뱅크별로 병합한다.
// 피스톤 위치는 크랭크-슬라이더 식(로드 길이 일정)을 실린더마다 뱅크 축 방향으로 푼다.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { aluminum, bronze, castIron, darkSteel, ghost, paint, plastic, steel } from '../../models/materials';
import { type V2, TAU, lathe, extrude, merge, stadiumShape } from '../../models/parts/geom';
import { BANK_HEX, cylinders, type CylInfo, type EngineDef } from './data';

export type BlockMode = 'hidden' | 'ghost' | 'solid';

/** X축 방향 회전체: 프로파일 [r, x] */
function latheX(profile: V2[], segs = 40): THREE.BufferGeometry {
  const g = lathe(profile, segs);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 모따기 있는 X축 원기둥 [x0,x1] */
function rodX(r: number, x0: number, x1: number, c = 0.006, segs = 32): THREE.BufferGeometry {
  return latheX(
    [
      [0, x0],
      [r - c, x0],
      [r, x0 + c],
      [r, x1 - c],
      [r - c, x1],
      [0, x1]
    ],
    segs
  );
}

/** 평면 Shape(sx, sy)를 두께 d로 압출해 X축 방향으로 세움: sy → y, sx → -z */
function plateX(shape: THREE.Shape, d: number, c = 0.006, curve = 24): THREE.BufferGeometry {
  const g = extrude(shape, d, c, curve, 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** (y,z) 평면 각 φ의 점 → plateX 도형 좌표 */
function shapePt(r: number, phi: number): V2 {
  return [-r * Math.sin(phi), r * Math.cos(phi)];
}

const PIN_TOP = 0.072;
const SKIRT = 0.085;
const HEAD_H = 0.11;
const PIN_LEN = 0.085;
const WEB_T = 0.04;
const ROD_W = 0.056;

export class EngineModel {
  readonly root = new THREE.Group();
  readonly def: EngineDef;
  readonly cyl: CylInfo[];
  /** 실린더별 점화 밝기 0~1 */
  readonly fire: Float32Array;
  readonly box = new THREE.Box3();
  /** 크랭크 중심 높이(root 국소) */
  readonly crankY: number;
  readonly uDeck: number;

  private readonly eng = new THREE.Group();
  private readonly crank = new THREE.Group();
  private pistons!: THREE.InstancedMesh;
  private rods!: THREE.InstancedMesh;
  private flames!: THREE.InstancedMesh;
  private blockMesh!: THREE.Mesh;
  private headMeshes: THREE.Mesh[] = [];
  private linerMeshes: THREE.Mesh[] = [];
  private ghostBlockMat = ghost(0x9fb4c8, 0.14);
  private solidBlockMat = castIron({ color: 0x59616b, grain: false });
  private headGhostMats: THREE.Material[] = [];
  private headSolidMats: THREE.Material[] = [];
  private extraMats: THREE.Material[] = [];
  private pistonTint: THREE.Color[] = [];

  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly c = new THREE.Color();
  private static readonly FIRE = new THREE.Color(0xff8a1f);

  constructor(def: EngineDef) {
    this.def = def;
    this.cyl = cylinders(def);
    this.fire = new Float32Array(this.cyl.length);
    const d = def.dims;
    this.uDeck = d.crankR + d.rodL + PIN_TOP + 0.012;
    // 수평대향은 실린더가 옆으로 누우므로 크랭크를 낮게, 나머지는 균형추·팬이 바닥에 닿지 않을 만큼
    this.crankY = def.id === 'b4' ? 0.52 : 0.5;
    this.eng.position.y = this.crankY;
    this.root.add(this.eng);
    this.eng.add(this.crank);

    const stat = new THREE.Group();
    this.eng.add(stat);
    this.buildBlock(stat);
    this.buildCrank();
    this.buildMoving();
    this.root.updateMatrixWorld(true);
    this.box.setFromObject(stat);
    const standGroup = this.buildStand(Math.max(0.45, Math.max(-this.box.min.z, this.box.max.z) * 0.85));
    this.root.add(standGroup);
    this.root.updateMatrixWorld(true);
    this.box.union(new THREE.Box3().setFromObject(standGroup));
    this.setBlockMode('ghost');
    this.update(0);
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildBlock(parent: THREE.Group): void {
    const d = this.def.dims;
    const bore = d.pistonR + 0.008;
    const uBot = d.rodL - d.crankR - SKIRT + 0.07;
    const blockGeos: THREE.BufferGeometry[] = [];
    const xs = this.cyl.map((c) => c.x);
    const xMax = Math.max(...xs) + bore + 0.05;
    const xMin = Math.min(...xs) - bore - 0.05;

    // 크랭크실(아래 블록)
    const boxer = this.def.id === 'b4';
    const cc = new RoundedBoxGeometry(xMax - xMin, boxer ? 0.4 : 0.36, boxer ? 0.46 : 0.5, 3, 0.04);
    cc.translate((xMax + xMin) / 2, boxer ? 0 : -0.06, 0);
    blockGeos.push(cc);

    this.def.banks.forEach((b, bi) => {
      const cs = this.cyl.filter((c) => c.bank === bi);
      const bx = cs.map((c) => c.x);
      const x0 = Math.min(...bx) - bore - 0.03;
      const x1 = Math.max(...bx) + bore + 0.03;
      const beta = cs[0]!.beta;
      const color = BANK_HEX[b.color];
      // 뱅크 블록(실린더가 들어 있는 부분)
      const bl = new RoundedBoxGeometry(x1 - x0, this.uDeck - uBot + 0.02, 2 * bore + 0.06, 2, 0.025);
      bl.translate((x0 + x1) / 2, (this.uDeck + uBot) / 2 - 0.01, 0);
      bl.rotateX(beta);
      blockGeos.push(bl);

      // 실린더 벽(옅은 뱅크 색) + 윗면 테두리 링(진한 뱅크 색 — 블록을 숨겨도 실린더 자리가 읽히게)
      const liners: THREE.BufferGeometry[] = [];
      const rings: THREE.BufferGeometry[] = [];
      for (const c of cs) {
        const l = new THREE.CylinderGeometry(bore, bore, this.uDeck - uBot, 40, 1, true);
        l.translate(c.x, (this.uDeck + uBot) / 2, 0);
        l.rotateX(beta);
        liners.push(l);
        const r = new THREE.TorusGeometry(bore + 0.004, 0.011, 8, 48);
        r.rotateX(Math.PI / 2);
        r.translate(c.x, this.uDeck, 0);
        r.rotateX(beta);
        rings.push(r);
      }
      const linerMat = ghost(color, 0.2);
      const liner = new THREE.Mesh(merge(liners), linerMat);
      liner.renderOrder = 1;
      liner.userData.noAO = true;
      parent.add(liner);
      this.linerMeshes.push(liner);
      const ringMesh = new THREE.Mesh(merge(rings), paint(color, { roughness: 0.35, metalness: 0.3 }));
      ringMesh.castShadow = true;
      parent.add(ringMesh);

      // 실린더 헤드(뱅크 색)
      const hg = new RoundedBoxGeometry(x1 - x0, HEAD_H, 2 * bore + 0.05, 3, 0.03);
      hg.translate((x0 + x1) / 2, this.uDeck + HEAD_H / 2 + 0.004, 0);
      hg.rotateX(beta);
      const hGhost = ghost(color, 0.24);
      const hSolid = paint(color, { roughness: 0.45, metalness: 0.15 });
      this.headGhostMats.push(hGhost);
      this.headSolidMats.push(hSolid);
      const head = new THREE.Mesh(hg, hGhost);
      head.renderOrder = 2;
      parent.add(head);
      this.headMeshes.push(head);
    });

    this.blockMesh = new THREE.Mesh(merge(blockGeos), this.ghostBlockMat);
    this.blockMesh.renderOrder = 2;
    parent.add(this.blockMesh);
  }

  private buildStand(halfW: number): THREE.Group {
    const g = new THREE.Group();
    const xs = this.cyl.map((c) => c.x);
    const front = Math.max(...xs) + this.def.dims.pistonR + 0.13;
    const rear = Math.min(...xs) - this.def.dims.pistonR - 0.13;
    const baseMat = paint(0x2d5f8f, { roughness: 0.45 });
    const base = new THREE.Mesh(new RoundedBoxGeometry(front - rear + 0.9, 0.05, 2 * halfW, 3, 0.02), baseMat);
    base.position.set((front + rear) / 2 - 0.06, 0.025, 0);
    base.receiveShadow = true;
    g.add(base);
    // 크랭크 양끝 베어링 받침대(크랭크가 공중에 뜨지 않게)
    const pedGeo = new RoundedBoxGeometry(0.1, this.crankY - 0.05, 0.22, 2, 0.02);
    const capGeo = latheX(
      [
        [0.055, -0.05],
        [0.085, -0.05],
        [0.085, 0.05],
        [0.055, 0.05]
      ],
      40
    );
    const brz = bronze();
    for (const x of [front, rear]) {
      const p = new THREE.Mesh(pedGeo, baseMat);
      p.position.set(x, 0.05 + (this.crankY - 0.05) / 2 - 0.04, 0);
      p.castShadow = true;
      g.add(p);
      const cap = new THREE.Mesh(capGeo, brz);
      cap.position.set(x, this.crankY, 0);
      g.add(cap);
    }
    return g;
  }

  // ───────────────────────── 크랭크축 ─────────────────────────

  private buildCrank(): void {
    const d = this.def.dims;
    const R = d.crankR;
    const mainR = 0.05;
    const pinR = 0.04;
    const wr = 0.062;
    const cwR = 0.165;
    const journals: THREE.BufferGeometry[] = [];
    const webs: THREE.BufferGeometry[] = [];

    const axisWeb = (x0: number, x1: number, phi: number): void => {
      const s = new THREE.Shape();
      s.absarc(0, R, wr, 0, Math.PI, false);
      s.lineTo(-wr, 0.02);
      s.absarc(0, 0, cwR, Math.PI + 0.38, TAU - 0.38, false);
      s.lineTo(wr, 0.02);
      s.closePath();
      const g = plateX(s, x1 - x0, 0.008, 28);
      g.rotateX(phi);
      g.translate((x0 + x1) / 2, 0, 0);
      webs.push(g);
    };
    const linkWeb = (x0: number, x1: number, pa: number, pb: number): void => {
      const [ax, ay] = shapePt(R, pa);
      const [bx, by] = shapePt(R, pb);
      const g = plateX(stadiumShape(ax, ay, bx, by, wr * 0.92), x1 - x0, 0.004, 20);
      g.translate((x0 + x1) / 2, 0, 0);
      webs.push(g);
    };
    const pin = (x0: number, x1: number, phi: number): void => {
      const g = rodX(pinR, x0, x1, 0.003, 28);
      g.translate(0, R * Math.cos(phi), R * Math.sin(phi));
      journals.push(g);
    };

    const pins = [...this.cyl].sort((a, b) => b.x - a.x);
    const first = pins[0]!;
    const last = pins[pins.length - 1]!;
    const front = first.x + d.pistonR + 0.13;
    const rear = last.x - d.pistonR - 0.13;
    // 앞쪽 축(풀리·받침대까지)
    journals.push(rodX(mainR, first.x + PIN_LEN / 2 + WEB_T - 0.004, front + 0.19, 0.006, 36));
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i]!;
      const pf = p.x + PIN_LEN / 2;
      const pr = p.x - PIN_LEN / 2;
      const prev = pins[i - 1];
      const boundaryBefore = !prev || prev.x - PIN_LEN / 2 - pf > 0.08;
      if (boundaryBefore) axisWeb(pf, pf + WEB_T, p.phi);
      pin(pr, pf, p.phi);
      const next = pins[i + 1];
      if (!next) {
        axisWeb(pr - WEB_T, pr, p.phi);
        journals.push(rodX(mainR, rear - 0.2, pr - WEB_T + 0.004, 0.006, 36));
        break;
      }
      const nf = next.x + PIN_LEN / 2;
      const gap = pr - nf;
      if (gap > 0.08) {
        axisWeb(pr - WEB_T, pr, p.phi);
        journals.push(rodX(mainR, nf + WEB_T - 0.004, pr - WEB_T + 0.004, 0.006, 36));
      } else if (Math.abs(Math.sin((p.phi - next.phi) / 2)) > 0.01) {
        // 핀 위상이 다른 이웃 핀(스플릿 핀·W16) — 두 핀을 잇는 얇은 팔
        const t = Math.max(gap, 0.022);
        const mid = (pr + nf) / 2;
        linkWeb(mid - t / 2, mid + t / 2, p.phi, next.phi);
      } else if (gap > 0) {
        pin(nf - 0.002, pr + 0.002, p.phi);
      }
    }
    const crankMesh = new THREE.Mesh(merge(journals), steel());
    const webMesh = new THREE.Mesh(merge(webs), paint(0x3d6f9e, { roughness: 0.38, metalness: 0.5 }));
    crankMesh.castShadow = webMesh.castShadow = true;
    this.crank.add(crankMesh, webMesh);

    // 앞 풀리와 뒤 플라이휠(흰 표시로 회전이 읽히게)
    const pulley = new THREE.Mesh(
      latheX(
        [
          [0.04, front + 0.07],
          [0.1, front + 0.07],
          [0.105, front + 0.076],
          [0.105, front + 0.09],
          [0.085, front + 0.11],
          [0.105, front + 0.13],
          [0.105, front + 0.144],
          [0.1, front + 0.15],
          [0.04, front + 0.15]
        ],
        48
      ),
      darkSteel()
    );
    const flyR = Math.min(0.34, this.crankY - 0.12);
    const fly = new THREE.Mesh(
      latheX(
        [
          [0.04, rear - 0.13],
          [flyR - 0.01, rear - 0.13],
          [flyR, rear - 0.12],
          [flyR, rear - 0.07],
          [flyR - 0.01, rear - 0.06],
          [0.04, rear - 0.06]
        ],
        64
      ),
      darkSteel()
    );
    pulley.castShadow = fly.castShadow = true;
    const markMat = plastic(0xf2f2f2, { grain: false });
    const mark = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.1, 0.035, 1, 0.004), markMat);
    mark.position.set(rear - 0.136, flyR - 0.07, 0);
    const mark2 = new THREE.Mesh(new RoundedBoxGeometry(0.01, 0.05, 0.025, 1, 0.004), markMat.clone());
    mark2.position.set(front + 0.154, 0.07, 0);
    this.extraMats.push(mark2.material as THREE.Material);
    this.crank.add(pulley, fly, mark, mark2);
  }

  // ───────────────────────── 움직이는 부품 ─────────────────────────

  private buildMoving(): void {
    const d = this.def.dims;
    const pr = d.pistonR;
    const n = this.cyl.length;
    const prof: V2[] = [
      [0, -SKIRT],
      [pr - 0.005, -SKIRT],
      [pr, -SKIRT + 0.005],
      [pr, 0.02],
      [pr - 0.006, 0.022],
      [pr - 0.006, 0.03],
      [pr, 0.032],
      [pr, 0.042],
      [pr - 0.006, 0.044],
      [pr - 0.006, 0.052],
      [pr, 0.054],
      [pr, PIN_TOP - 0.006],
      [pr - 0.006, PIN_TOP],
      [pr * 0.55, PIN_TOP],
      [0, PIN_TOP - 0.008]
    ];
    const pistonGeo = merge([lathe(prof, 48), rodX(0.02, -pr * 0.8, pr * 0.8, 0.003, 16)]);
    this.pistons = new THREE.InstancedMesh(pistonGeo, aluminum({ color: 0xe3e7ec }), n);
    this.pistons.castShadow = true;

    const L = d.rodL;
    const rs = new THREE.Shape();
    rs.absarc(0, 0, 0.034, -0.75, Math.PI + 0.75, false);
    rs.lineTo(-0.032, -L + 0.09);
    rs.absarc(0, -L, 0.068, Math.PI - 0.55, TAU + 0.55, false);
    rs.lineTo(0.032, -L + 0.09);
    rs.closePath();
    const rodGeo = plateX(rs, ROD_W, 0.008, 20);
    this.rods = new THREE.InstancedMesh(rodGeo, steel({ color: 0xaeb6bf }), n);
    this.rods.castShadow = true;

    const flameGeo = new THREE.CylinderGeometry(pr * 0.97, pr * 0.97, 1, 32, 1);
    flameGeo.translate(0, 0.5, 0);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    this.flames = new THREE.InstancedMesh(flameGeo, flameMat, n);
    this.flames.userData.noAO = true;
    this.flames.renderOrder = 3;

    for (let i = 0; i < n; i++) {
      const bank = this.def.banks[this.cyl[i]!.bank]!;
      const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(BANK_HEX[bank.color]), this.def.banks.length > 1 ? 0.5 : 0.25);
      this.pistonTint.push(tint);
      this.pistons.setColorAt(i, tint);
      this.flames.setColorAt(i, new THREE.Color(0));
    }
    for (const im of [this.pistons, this.rods, this.flames]) {
      im.frustumCulled = false;
      this.eng.add(im);
    }
  }

  // ───────────────────────── 상태 ─────────────────────────

  setBlockMode(mode: BlockMode): void {
    const show = mode !== 'hidden';
    this.blockMesh.visible = show;
    this.blockMesh.material = mode === 'solid' ? this.solidBlockMat : this.ghostBlockMat;
    this.blockMesh.castShadow = mode === 'solid';
    this.headMeshes.forEach((h, i) => {
      h.visible = show;
      h.material = (mode === 'solid' ? this.headSolidMats[i] : this.headGhostMats[i])!;
      h.castShadow = mode === 'solid';
    });
    for (const l of this.linerMeshes) l.visible = mode === 'ghost';
  }

  /** θ: 크랭크 각(rad, 0~4π). 1번 실린더가 θ=0에서 압축 상사점(점화) */
  update(theta: number): void {
    const d = this.def.dims;
    const R = d.crankR;
    const L = d.rodL;
    this.crank.rotation.x = theta;
    const cycle = 2 * TAU;
    for (let i = 0; i < this.cyl.length; i++) {
      const c = this.cyl[i]!;
      const a = theta + c.phi;
      const py = R * Math.cos(a);
      const pz = R * Math.sin(a);
      const cb = Math.cos(c.beta);
      const sb = Math.sin(c.beta);
      const pa = py * cb + pz * sb;
      const pb = -py * sb + pz * cb;
      const s = pa + Math.sqrt(L * L - pb * pb);
      const sy = s * cb;
      const sz = s * sb;
      // 피스톤
      this.v.set(c.x, sy, sz);
      this.q.setFromEuler(this.e.set(c.beta, 0, 0));
      this.s.set(1, 1, 1);
      this.m4.compose(this.v, this.q, this.s);
      this.pistons.setMatrixAt(i, this.m4);
      // 커넥팅 로드: 소단부(피스톤 핀) → 대단부(크랭크 핀)
      const dy = (py - sy) / L;
      const dz = (pz - sz) / L;
      this.q.setFromEuler(this.e.set(Math.atan2(-dz, -dy), 0, 0));
      this.m4.compose(this.v, this.q, this.s);
      this.rods.setMatrixAt(i, this.m4);
      // 점화: 점화 각을 지난 직후 밝고 팽창 행정 동안 사그라든다
      let k = (theta - c.fire) % cycle;
      if (k < 0) k += cycle;
      const e = k < 2.2 ? Math.exp(-k / 0.5) : 0;
      this.fire[i] = e;
      const top = s + PIN_TOP;
      const h = this.uDeck - top;
      if (e > 0.03 && h > 0.002) {
        this.v.set(c.x, top * cb, top * sb);
        this.q.setFromEuler(this.e.set(c.beta, 0, 0));
        this.s.set(1, h, 1);
        this.m4.compose(this.v, this.q, this.s);
        const f = EngineModel.FIRE;
        this.c.setRGB(f.r * (0.35 + 1.4 * e), (f.g + 0.3 * e) * (0.35 + 1.2 * e), f.b * 0.6);
      } else {
        this.m4.makeScale(0, 0, 0);
        this.c.setRGB(0, 0, 0);
      }
      this.flames.setMatrixAt(i, this.m4);
      this.flames.setColorAt(i, this.c);
      this.c.copy(this.pistonTint[i]!).lerp(EngineModel.FIRE, Math.min(1, e * 0.9));
      this.pistons.setColorAt(i, this.c);
    }
    this.pistons.instanceMatrix.needsUpdate = true;
    this.rods.instanceMatrix.needsUpdate = true;
    this.flames.instanceMatrix.needsUpdate = true;
    if (this.flames.instanceColor) this.flames.instanceColor.needsUpdate = true;
    if (this.pistons.instanceColor) this.pistons.instanceColor.needsUpdate = true;
  }

  /** 실린더 번호표 위치(월드) */
  tagWorld(i: number, out: THREE.Vector3): THREE.Vector3 {
    const c = this.cyl[i]!;
    const u = this.uDeck + HEAD_H + 0.08;
    out.set(c.x, u * Math.cos(c.beta), u * Math.sin(c.beta));
    return this.eng.localToWorld(out);
  }

  /** 뱅크 이름표 위치(월드): 헤드 앞끝 바깥 */
  bankWorld(bi: number, out: THREE.Vector3): THREE.Vector3 {
    const cs = this.cyl.filter((c) => c.bank === bi);
    const beta = cs[0]!.beta;
    const x = Math.max(...cs.map((c) => c.x)) + this.def.dims.pistonR + 0.05;
    const u = this.uDeck + HEAD_H + 0.2;
    out.set(x, u * Math.cos(beta), u * Math.sin(beta));
    return this.eng.localToWorld(out);
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
    this.ghostBlockMat.dispose();
    this.solidBlockMat.dispose();
    for (const m of [...this.headGhostMats, ...this.headSolidMats, ...this.extraMats]) m.dispose();
  }
}
