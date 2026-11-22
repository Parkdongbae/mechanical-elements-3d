// 13-A 단기통 2행정 엔진 컷어웨이 (피스톤 포트식, 크랭크실 소기)
// φ = 사이클 각(0~360°, 0 = 하사점) → 크랭크각 θ = φ + 180 (상사점 0).
// 포트 높이는 "몇 도에서 열리는가"를 정해 두고 크랭크-슬라이더 식으로 거꾸로 계산한다:
//   배기 포트 위 끝 = θ 90°의 피스톤 윗면, 소기 포트 위 끝 = θ 115°의 윗면, 흡기 포트 아래 끝 = θ 75°의 스커트 끝.
// 그래서 배기가 소기보다 먼저 열리고, 흡기 포트는 상사점 앞뒤로만 크랭크실 쪽으로 열린다.

import * as THREE from 'three';
import { paint } from '../../models/materials';
import type { V2 } from '../../models/parts/geom';
import {
  BORE_R,
  CR,
  CRANK_Y,
  DEG,
  Ignition,
  Mats,
  Particles,
  buildCrank,
  buildGasVolume,
  buildPiston,
  buildPlug,
  buildRod,
  disposeTree,
  lifeColor,
  pinY,
  shadowAll,
  volumeLook,
  type CycleEngine,
  type CycleState,
  type TagDef
} from './parts';
import { CutFace, Duct, PathSampler, arcPts, boreSkirtFill, boreSurface, clamp01, flatXY, flatXZ, flatZY, halfAnnulus, halfTube, portWall, rng, shell, smooth, TAU } from './geo';
import { GAS } from './data';

const PT = 0.24;
const SK = 0.36;
const DECK = 2.9;
const LINER_BOT = 1.42;
const BX = 0.66;
const DEPTH = 0.62;
const POCKET = 0.4;
const PORT_BOT = 2.07;
const IN_W = 0.18;
const IN_TOP = 2.05;
const N = 56;

const crownY = (th: number): number => pinY(th) + PT;
const skirtY = (th: number): number => pinY(th) - SK;

export const PORTS = (() => {
  const exTop = crownY(90);
  const trTop = crownY(115);
  return {
    exTop,
    exR: (exTop - PORT_BOT) / 2,
    exY: (exTop + PORT_BOT) / 2,
    trTop,
    trR: (trTop - PORT_BOT) / 2,
    trY: (trTop + PORT_BOT) / 2,
    inBot: skirtY(75),
    inY: (skirtY(75) + IN_TOP) / 2
  };
})();

export class Engine2 implements CycleEngine {
  readonly root = new THREE.Group();
  readonly cycle = 360;
  private m = new Mats();
  private crank: THREE.Group;
  private rod: THREE.Group;
  private piston: THREE.Group;
  private gas: { group: THREE.Group; mat: THREE.MeshStandardMaterial };
  private ccMat: THREE.MeshStandardMaterial;
  private parts = new Particles(N * 3);
  private ign: Ignition;
  private pIn: PathSampler;
  private pTr: PathSampler;
  private pEx: PathSampler;
  private seeds: { t: number; o: number; q: number; x: number; z: number; h: number; cc: THREE.Vector3; a: number; b: number }[] = [];
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private col = new THREE.Color();
  private mixCol = new THREE.Color(GAS.mix);
  private crown = 2.5;

  constructor() {
    const m = this.m;
    this.ccMat = new THREE.MeshStandardMaterial({ color: GAS.mix, emissive: GAS.mix, emissiveIntensity: 0.4, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    this.buildStatic();
    this.crank = buildCrank(m, null);
    this.crank.position.y = CRANK_Y;
    this.rod = buildRod(m);
    this.piston = buildPiston(m, PT, SK);
    this.root.add(this.crank, this.rod, this.piston);
    this.root.add(buildPlug(m, DECK, 3.64));
    this.gas = buildGasVolume(BORE_R - 0.006);
    this.root.add(this.gas.group);
    this.ign = new Ignition(new THREE.Vector3(0, DECK - 0.02, 0));
    this.root.add(this.ign.group);
    this.root.add(this.parts.mesh);

    const P = PORTS;
    const v3 = (x: number, y: number, z = -0.05): THREE.Vector3 => new THREE.Vector3(x, y, z);
    this.pIn = new PathSampler([v3(-0.5, P.inY + 0.28, -1.06), v3(-0.2, P.inY + 0.12, -1.0), v3(0, P.inY, -0.85), v3(0, P.inY, -0.62), v3(0, P.inY, -0.36)]);
    this.pTr = new PathSampler([v3(-0.34, 1.08), v3(-0.53, 1.22), v3(-0.53, 1.6), v3(-0.53, 1.98), v3(-0.5, 2.08), v3(-0.43, P.trY), v3(-0.33, P.trY)]);
    this.pEx = new PathSampler([v3(0.33, P.exY), v3(BX, P.exY), v3(0.95, P.exY + 0.02), v3(1.2, P.exY - 0.12), v3(1.36, 1.95), v3(1.4, 1.62), v3(1.4, 1.2), v3(1.4, 0.82), v3(1.45, 0.66), v3(1.6, 0.6), v3(1.9, 0.6)]);
    const r = rng(77);
    for (let i = 0; i < N; i++) {
      const rad = (BORE_R - 0.06) * Math.sqrt(r());
      const ang = Math.PI + r() * Math.PI;
      let cx = 0;
      let cy = 0;
      for (let k = 0; k < 30; k++) {
        cx = (r() - 0.5) * 0.9;
        cy = 0.62 + r() * 0.74;
        if (Math.hypot(cx, cy - CRANK_Y) < 0.5 && Math.hypot(cx, cy - CRANK_Y) > 0.12) break;
      }
      this.seeds.push({
        t: (i / N) * 0.7,
        o: r() * 0.7,
        q: r(),
        x: rad * Math.cos(ang),
        z: Math.min(-0.03, rad * Math.sin(ang)),
        h: 0.08 + r() * 0.84,
        cc: new THREE.Vector3(cx, cy, -0.05 - r() * 0.3),
        a: (r() - 0.5) * 0.1,
        b: 0.01 + r() * 0.05
      });
    }
    shadowAll(this.root);
    this.setPhase(0);
  }

  private buildStatic(): void {
    const m = this.m;
    const R = BORE_R;
    const P = PORTS;
    const ccy = CRANK_Y + Math.sqrt(0.72 * 0.72 - BX * BX);
    const aL = Math.atan2(ccy - CRANK_Y, -BX);
    const crankcase: V2[] = [[-BX, LINER_BOT], ...arcPts(0, CRANK_Y, 0.72, aL, TAU + (Math.PI - aL), 72), [BX, LINER_BOT]];
    // 블록: 오른쪽 배기 출구 구간은 핀 없이 평평하게
    const ex0 = P.exY - P.exR - 0.06;
    const ex1 = P.exY + P.exR + 0.06;
    const finYs: number[] = [];
    for (let y = 1.56; y < DECK - 0.06; y += 0.14) finYs.push(y);
    const block: V2[] = [[-BX, LINER_BOT], [BX, LINER_BOT]];
    let exEdge = -1;
    let exDone = false;
    for (const y of finYs) {
      if (!exDone && y + 0.03 > ex0) {
        block.push([BX, ex0]);
        exEdge = block.length - 1;
        block.push([BX, ex1]);
        exDone = true;
      }
      if (y > ex0 - 0.04 && y < ex1 + 0.04) continue;
      block.push([BX, y - 0.028], [0.9, y - 0.028], [0.9, y + 0.028], [BX, y + 0.028]);
    }
    block.push([BX, DECK]);
    const topEdge = block.length - 1;
    block.push([-BX, DECK]);
    for (const y of [...finYs].reverse()) block.push([-BX, y + 0.028], [-0.9, y + 0.028], [-0.9, y - 0.028], [-BX, y - 0.028]);
    // 헤드(위쪽 냉각 핀)
    const head: V2[] = [[-BX, DECK], [BX, DECK], [BX, 3.2]];
    for (const x of [0.54, 0.38, 0.22, -0.22, -0.38, -0.54]) head.push([x + 0.026, 3.2], [x + 0.026, 3.44], [x - 0.026, 3.44], [x - 0.026, 3.2]);
    head.push([-BX, 3.2]);
    // 크랭크실 안쪽
    const pky = CRANK_Y + Math.sqrt(0.56 * 0.56 - R * R);
    const pa = Math.atan2(pky - CRANK_Y, -R);
    const pocket: V2[] = [[-R, LINER_BOT], ...arcPts(0, CRANK_Y, 0.56, pa, TAU + (Math.PI - pa), 72), [R, LINER_BOT]];

    const trDuct = new Duct([[-0.53, 1.16], [-0.53, 1.6], [-0.53, 1.97], [-0.5, 2.08], [-0.43, P.trY], [-0.12, P.trY]], P.trR, 72);
    const exDuct = new Duct([[0.12, P.exY], [0.4, P.exY], [BX + 0.005, P.exY]], P.exR, 24);

    const cut = new CutFace()
      .solid(crankcase)
      .solid(block)
      .solid(head)
      .cavity(pocket)
      .cavity([[-R, LINER_BOT - 0.01], [R, LINER_BOT - 0.01], [R, DECK], [-R, DECK]])
      .duct(trDuct)
      .duct(exDuct);
    this.root.add(cut.build());

    const add = (g: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
      const mesh = new THREE.Mesh(g, mat);
      this.root.add(mesh);
      return mesh;
    };
    const ironD = m.iron.clone();
    ironD.side = THREE.DoubleSide;
    const alD = m.bodyAlu;
    add(shell(crankcase, DEPTH, (i) => i === crankcase.length - 1), ironD);
    const inHole: V2[] = [[-IN_W, P.inBot], [IN_W, P.inBot], [IN_W, IN_TOP], [-IN_W, IN_TOP]];
    add(shell(block, DEPTH, (i) => i === 0 || i === exEdge || i === topEdge, [inHole]), alD);
    add(flatZY(portWall(ex0, ex1, P.exY, P.exR, DEPTH), BX), alD);
    add(shell(head, DEPTH, (i) => i === 0), alD);

    // 안쪽 면 — 보어(포트 구멍 3곳)
    const isWin = (x: number, y: number, z: number): boolean =>
      (x > 0 && (y - P.exY) ** 2 + z * z < P.exR * P.exR) ||
      (x < 0 && (y - P.trY) ** 2 + z * z < P.trR * P.trR) ||
      (Math.abs(x) < IN_W && y > P.inBot && y < IN_TOP && z < -0.2);
    add(boreSurface(R, LINER_BOT, DECK, isWin, 120, 0.008), m.bore);
    add(boreSkirtFill(R, POCKET, LINER_BOT), m.interior);
    // 크랭크실 벽: 위(보어 쪽)와 소기 통로 입구는 뚫어 둠
    add(
      shell(pocket, POCKET, (i) => {
        if (i === pocket.length - 1) return true;
        const a = pocket[i]!;
        const b = pocket[(i + 1) % pocket.length]!;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        return mx < -0.43 && mx > -0.63 && my > 1.05;
      }),
      m.interior
    );
    add(flatXZ([[-R, 0], [R, 0], ...arcPts(0, 0, R, 0, Math.PI, 40).map(([x, z]) => [x, -z] as V2)], DECK), m.interior);
    const onBore = (v: THREE.Vector3): void => {
      if (v.y < LINER_BOT || v.y > DECK) return;
      const d = Math.hypot(v.x, v.z);
      if (d < R) {
        const k = R / Math.max(d, 1e-4);
        v.x *= k;
        v.z *= k;
      }
    };
    add(halfTube(trDuct.pts, P.trR, 14, onBore), m.interior);
    add(halfTube(exDuct.pts, P.exR, 14, onBore), m.interior);
    // 흡기 포트(뒤쪽 벽) 통로
    const zs = Math.sqrt(R * R - IN_W * IN_W);
    const floor: V2[] = [];
    for (let i = 0; i <= 12; i++) {
      const x = -IN_W + (2 * IN_W * i) / 12;
      floor.push([x, -Math.sqrt(R * R - x * x)]);
    }
    floor.push([IN_W, -DEPTH], [-IN_W, -DEPTH]);
    add(flatXZ(floor, P.inBot), m.interior);
    add(flatXZ(floor, IN_TOP), m.interior);
    for (const sx of [-1, 1]) add(flatZY([[-zs, P.inBot], [-DEPTH, P.inBot], [-DEPTH, IN_TOP], [-zs, IN_TOP]], sx * IN_W), m.interior);
    const inCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, P.inY, -DEPTH + 0.01),
      new THREE.Vector3(0, P.inY, -0.85),
      new THREE.Vector3(-0.2, P.inY + 0.12, -1.0),
      new THREE.Vector3(-0.5, P.inY + 0.28, -1.06)
    ]);
    add(new THREE.TubeGeometry(inCurve, 32, 0.085, 16, false), m.bodyAlu);
    const adapter = new THREE.Mesh(new THREE.BoxGeometry(2 * IN_W + 0.08, IN_TOP - P.inBot + 0.08, 0.06), m.dark);
    adapter.position.set(0, P.inY, -DEPTH - 0.03);
    this.root.add(adapter);
    const carb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.22), paint(0x30353c, { roughness: 0.6 }));
    carb.position.set(-0.62, P.inY + 0.32, -1.08);
    this.root.add(carb);

    // 배기관 + 소음기
    const pipe = new Duct([[BX, P.exY], [0.95, P.exY + 0.02], [1.2, P.exY - 0.12], [1.36, 1.95], [1.4, 1.6]], 0.12, 48);
    add(halfTube(pipe.pts, 0.12, 14), m.exhaust);
    add(flatZY(halfAnnulus(P.exY, 0.12, P.exR + 0.07), BX + 0.012), m.exhaust);
    const muf = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.06, 0.78), new THREE.Vector2(0.18, 0.86), new THREE.Vector2(0.22, 0.96), new THREE.Vector2(0.22, 1.5), new THREE.Vector2(0.18, 1.58), new THREE.Vector2(0.12, 1.62)], 40, Math.PI / 2, Math.PI), m.exhaust);
    muf.position.x = 1.4;
    this.root.add(muf);
    const tail = new Duct([[1.4, 0.79], [1.45, 0.66], [1.6, 0.6], [1.92, 0.6]], 0.055, 24);
    add(halfTube(tail.pts, 0.055, 10), m.exhaust);

    // 크랭크실 가스(반투명 판)
    const ccPlane = new THREE.Mesh(flatXY(pocket, -0.003), this.ccMat);
    ccPlane.userData.noAO = true;
    ccPlane.renderOrder = 3;
    this.root.add(ccPlane);

    // 받침대
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.6), paint(0x2d5f8f, { roughness: 0.45 }));
    base.position.set(0.15, 0.04, -0.2);
    this.root.add(base);
    for (const sx of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.9), m.dark);
      foot.position.set(sx * 0.48, 0.25, -0.3);
      this.root.add(foot);
    }
  }

  // ───────────────────────── 자세 ─────────────────────────

  private gen(L: number, s: Engine2['seeds'][number], out: THREE.Vector3): THREE.Vector3 | null {
    const crown = this.crown;
    const cyl = this.tmp2.set(s.x, crown + 0.012 + s.h * (DECK - 0.015 - crown - 0.012), s.z);
    if (L < 190) {
      const f = clamp01(L / 150) - s.t;
      if (f < 0) return this.pIn.at(1 + f / 0.7, s.a, s.b, out);
      if (f < 0.3) return this.pIn.at(1, s.a, s.b, out).lerp(s.cc, smooth(f / 0.3));
      return out.copy(s.cc);
    }
    if (L < 525) {
      const g = clamp01((L - 190) / 130) * 1.6 - s.o;
      if (g < 0) return out.copy(s.cc);
      if (g < 0.1) return out.copy(s.cc).lerp(this.pTr.at(0, s.a, -s.b, this.tmp), smooth(g / 0.1));
      if (g < 0.6) return this.pTr.at((g - 0.1) / 0.5, s.a * 0.8, -s.b, out);
      if (g < 0.9) return this.pTr.at(1, s.a, -s.b, out).lerp(cyl, smooth((g - 0.6) / 0.3));
      return out.copy(cyl);
    }
    const h = clamp01((L - 525) / 150) * 1.6 - s.q;
    if (h < 0) return out.copy(cyl);
    if (h < 0.12) return out.copy(cyl).lerp(this.pEx.at(0, s.a, -s.b, this.tmp), smooth(h / 0.12));
    if (h < 0.6) return this.pEx.at((h - 0.12) / 0.48, s.a, -s.b, out);
    return null;
  }

  setPhase(phi: number): void {
    const th = (((phi + 180) % 360) + 360) % 360;
    const a = th * DEG;
    this.crank.rotation.z = -a;
    const py = pinY(th);
    this.piston.position.y = py;
    this.rod.position.y = py;
    const dx = CR * Math.sin(a);
    const dy = CRANK_Y + CR * Math.cos(a) - py;
    this.rod.rotation.z = Math.atan2(dx, -dy);
    const crown = py + PT;
    this.crown = crown;
    this.gas.group.position.y = crown;
    this.gas.group.scale.y = Math.max(0.001, DECK - crown);

    const L1 = (((th - 285) % 360) + 360) % 360;
    const L2 = L1 + 360;
    volumeLook(L1 >= 190 ? L1 : L2, 345, 435, 520, this.gas.mat);
    this.ign.set(th > 180 ? th - 360 : th, Math.max(0.05, DECK - crown - 0.01));
    const cc = this.ccLevel(th);
    this.ccMat.opacity = 0.08 + 0.2 * cc;
    this.ccMat.emissiveIntensity = 0.3 + 0.5 * cc;

    for (let i = 0; i < N; i++) {
      const s = this.seeds[i]!;
      this.parts.set(i, this.gen(L1, s, this.tmp), lifeColor(L1, 345, 435, 520, this.col));
      this.parts.set(N + i, this.gen(L2, s, this.tmp), lifeColor(L2, 345, 435, 520, this.col));
      const f2 = clamp01(L1 / 150) - s.t - 1;
      this.parts.set(2 * N + i, f2 >= -0.7 ? this.pIn.at(1 + f2 / 0.7, s.a, s.b, this.tmp) : null, this.mixCol);
    }
    this.parts.commit();
  }

  /** 크랭크실 압축 정도 0~1 (화면 표현용) */
  private ccLevel(th: number): number {
    if (th >= 75 && th < 115) return (th - 75) / 40;
    if (th >= 115 && th < 245) return 1 - 0.8 * ((th - 115) / 130);
    if (th >= 245 && th < 285) return 0.2 * (1 - (th - 245) / 40);
    return 0;
  }

  state(phi: number): CycleState {
    const p = ((phi % 360) + 360) % 360;
    const th = (p + 180) % 360;
    const crown = crownY(th);
    const P = PORTS;
    const open = {
      intake: clamp01((skirtY(th) - P.inBot) / (IN_TOP - P.inBot)),
      transfer: clamp01((P.trTop - crown) / (P.trTop - PORT_BOT)),
      exhaust: clamp01((P.exTop - crown) / (P.exTop - PORT_BOT))
    };
    const gas =
      th >= 270 ? '혼합기를 압축하는 중' : th < 90 ? '연소 가스가 팽창하는 중' : th < 115 ? '배기가스가 빠져나가는 중' : th < 245 ? '새 혼합기가 들어와 배기가스를 밀어내는 중(소기)' : '배기 포트가 닫히는 중';
    const crankcase =
      th >= 285 || th < 75 ? '새 혼합기를 빨아들이는 중' : th < 115 ? '내려오는 피스톤이 혼합기를 누르는 중' : th < 245 ? '혼합기를 소기 포트로 보내는 중' : '공간이 넓어져 압력이 낮아지는 중';
    return {
      dir: p < 180 ? 'up' : 'down',
      dead: p < 6 || p > 354 ? 'bdc' : Math.abs(p - 180) < 6 ? 'tdc' : null,
      open,
      spark: th > 350 || th < 10,
      gas,
      crankcase
    };
  }

  tags(): TagDef[] {
    const P = PORTS;
    return [
      { key: 'exhaust', label: '배기 포트', pos: new THREE.Vector3(BX - 0.04, P.exY + P.exR, 0), side: 'right' },
      { key: 'transfer', label: '소기 포트', pos: new THREE.Vector3(-0.53, P.trY, 0), side: 'left' },
      { key: 'intake', label: '흡기 포트', pos: new THREE.Vector3(IN_W, P.inBot, -0.36), side: 'right' },
      { key: 'plug', label: '점화 플러그', pos: new THREE.Vector3(0, 3.6, 0) },
      { key: 'crankcase', label: '크랭크실', pos: new THREE.Vector3(0.42, 0.72, 0), side: 'right' }
    ];
  }

  tagPos(key: string, out: THREE.Vector3): boolean {
    if (key === 'piston') {
      out.set(-0.4, this.piston.position.y + 0.1, 0.1);
      return true;
    }
    return false;
  }

  dispose(): void {
    disposeTree(this.root);
  }
}
