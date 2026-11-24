// 13-A 단기통 4행정 엔진 컷어웨이 (DOHC, 버킷형 밸브 리프터, 공랭 핀)
// φ = 사이클 각(0~720°, 0 = 흡입 시작 상사점) = 크랭크각. 캠축은 벨트로 크랭크의 1/2 속도.
// 밸브 양정은 캠 윤곽의 지지 함수(평면 종동절)로 미리 표로 계산해, 3D 밸브·가스·화면 표시가 같은 값을 쓴다.

import * as THREE from 'three';
import { paint, steel } from '../../models/materials';
import { lathe, type V2 } from '../../models/parts/geom';
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
import { CutFace, Duct, PathSampler, arcPts, beltRibbon, boreSkirtFill, boreSurface, clamp01, flatXZ, flatZY, halfAnnulus, halfTube, portWall, rng, shell, smooth, TAU } from './geo';

const PT = 0.26; // 핀 → 피스톤 윗면
const SK = 0.22; // 핀 → 스커트 끝
const DECK = 2.94;
const LINER_BOT = 1.55;
const HEAD_TOP = 3.46;
const HX = 0.83;
const BX = 0.62;
const DEPTH = 0.62;
const POCKET = 0.4;
const VX = 0.21; // 밸브 x
const PORT_R = 0.12;
const SPRING_H = 0.22;
const BUCKET_TOP = 3.76;
const CAM_BASE = 0.075;
const CAM_LIFT = 0.075;
const CAM_DUR = 115 * DEG; // 캠각 기준 열림 폭
const CAM_Y = BUCKET_TOP + CAM_BASE;
const BELT_Z = -0.72;
const INTAKE_PEAK = 105;
const EXHAUST_PEAK = 612;
const N = 64;

function crownY(th: number): number {
  return pinY(th) + PT;
}

/** 캠 윤곽(국소, 노즈 = +y): 기초원 + cos² 돌출 */
function camProfile(): V2[] {
  const out: V2[] = [];
  const n = 240;
  for (let i = 0; i < n; i++) {
    const b = -Math.PI + (i / n) * TAU;
    const bump = Math.abs(b) < CAM_DUR / 2 ? Math.cos((Math.PI * b) / CAM_DUR) ** 2 : 0;
    const r = CAM_BASE + CAM_LIFT * bump;
    out.push([r * Math.sin(b), r * Math.cos(b)]);
  }
  return out;
}

interface Valve {
  moving: THREE.Group;
  spring: THREE.Mesh;
  cam: THREE.Group;
  phase: number;
  table: Float32Array;
}

export class Engine4 implements CycleEngine {
  readonly root = new THREE.Group();
  readonly cycle = 720;
  private m = new Mats();
  private crank: THREE.Group;
  private rod: THREE.Group;
  private piston: THREE.Group;
  private valves: Valve[] = [];
  private gas: { group: THREE.Group; mat: THREE.MeshStandardMaterial };
  private parts = new Particles(N * 2);
  private ign: Ignition;
  private pIn: PathSampler;
  private pEx: PathSampler;
  private seeds: { t: number; o: number; x: number; z: number; h: number; a: number; b: number }[] = [];
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmp3 = new THREE.Vector3();
  private col = new THREE.Color();
  private mixCol = new THREE.Color(0x3d9bff);

  constructor() {
    const m = this.m;
    this.buildStatic();
    this.crank = buildCrank(m, BELT_Z);
    this.crank.position.y = CRANK_Y;
    this.rod = buildRod(m);
    this.piston = buildPiston(m, PT, SK);
    this.root.add(this.crank, this.rod, this.piston);
    this.buildValves();
    const plug = buildPlug(m, DECK, 4.18);
    this.root.add(plug);
    this.gas = buildGasVolume(BORE_R - 0.006);
    this.root.add(this.gas.group);
    this.ign = new Ignition(new THREE.Vector3(0, DECK - 0.02, 0));
    this.root.add(this.ign.group);
    this.root.add(this.parts.mesh);

    const v3 = (x: number, y: number, z = -0.05): THREE.Vector3 => new THREE.Vector3(x, y, z);
    this.pIn = new PathSampler([v3(-1.42, 3.62), v3(-1.38, 3.5), v3(-1.25, 3.34), v3(-1.05, 3.25), v3(-0.83, 3.24), v3(-0.5, 3.235), v3(-0.31, 3.15), v3(-VX, 3.02), v3(-VX, 2.9)]);
    this.pEx = new PathSampler([v3(VX, 2.9), v3(VX, 3.02), v3(0.31, 3.15), v3(0.5, 3.235), v3(0.83, 3.24), v3(1.08, 3.22), v3(1.3, 3.0), v3(1.4, 2.6), v3(1.42, 2.1), v3(1.42, 1.6), v3(1.42, 1.22), v3(1.46, 1.02), v3(1.6, 0.95), v3(1.88, 0.95)]);
    const r = rng(41);
    for (let i = 0; i < N; i++) {
      const rad = (BORE_R - 0.06) * Math.sqrt(r());
      const ang = Math.PI + r() * Math.PI;
      this.seeds.push({
        t: i / N + r() * (0.8 / N),
        o: r(),
        x: rad * Math.cos(ang),
        z: Math.min(-0.03, rad * Math.sin(ang)),
        h: 0.08 + r() * 0.84,
        a: (r() - 0.5) * 0.11,
        b: 0.01 + r() * 0.06
      });
    }
    shadowAll(this.root);
    this.setPhase(0);
  }

  // ───────────────────────── 고정 구조 ─────────────────────────

  private buildStatic(): void {
    const m = this.m;
    const R = BORE_R;
    // 크랭크실 윤곽(반지름 0.75 원 + 목)
    const ccy = CRANK_Y + Math.sqrt(0.75 * 0.75 - BX * BX);
    const aL = Math.atan2(ccy - CRANK_Y, -BX);
    const crankcase: V2[] = [[-BX, LINER_BOT], ...arcPts(0, CRANK_Y, 0.75, aL, TAU + (Math.PI - aL), 72), [BX, LINER_BOT]];
    // 블록(공랭 핀)
    const block: V2[] = [[-BX, LINER_BOT], [BX, LINER_BOT]];
    const finYs: number[] = [];
    for (let y = 1.7; y < DECK - 0.08; y += 0.14) finYs.push(y);
    for (const y of finYs) block.push([BX, y - 0.028], [0.86, y - 0.028], [0.86, y + 0.028], [BX, y + 0.028]);
    block.push([BX, DECK], [-BX, DECK]);
    for (const y of [...finYs].reverse()) block.push([-BX, y + 0.028], [-0.86, y + 0.028], [-0.86, y - 0.028], [-BX, y - 0.028]);
    // 헤드
    const head: V2[] = [[-HX, DECK], [-BX, DECK], [BX, DECK], [HX, DECK], [HX, HEAD_TOP], [0.52, HEAD_TOP], [-0.52, HEAD_TOP], [-HX, HEAD_TOP]];
    // 캠 커버
    const cover: V2[] = [[0.52, HEAD_TOP], ...arcPts(0.4, 3.94, 0.12, 0, Math.PI / 2, 8), ...arcPts(-0.4, 3.94, 0.12, Math.PI / 2, Math.PI, 8), [-0.52, HEAD_TOP]];
    const camCav: V2[] = [[0.44, HEAD_TOP], ...arcPts(0.36, 3.9, 0.08, 0, Math.PI / 2, 6), ...arcPts(-0.36, 3.9, 0.08, Math.PI / 2, Math.PI, 6), [-0.44, HEAD_TOP]];
    // 크랭크실 안쪽 빈 공간
    const pky = CRANK_Y + Math.sqrt(0.36 - R * R);
    const pa = Math.atan2(pky - CRANK_Y, -R);
    const pocket: V2[] = [[-R, LINER_BOT], ...arcPts(0, CRANK_Y, 0.6, pa, TAU + (Math.PI - pa), 64), [R, LINER_BOT]];

    const ductIn = new Duct([[-VX, DECK], [-VX, 3.03], [-0.31, 3.15], [-0.5, 3.232], [-HX - 0.005, 3.24]], PORT_R);
    const ductEx = new Duct([[VX, DECK], [VX, 3.03], [0.31, 3.15], [0.5, 3.232], [HX + 0.005, 3.24]], PORT_R);

    // 단면 판
    const cut = new CutFace()
      .solid(crankcase)
      .solid(block)
      .solid(head)
      .solid(cover)
      .cavity(pocket)
      .cavity([[-R, LINER_BOT - 0.01], [R, LINER_BOT - 0.01], [R, DECK], [-R, DECK]])
      .cavity(camCav)
      .duct(ductIn)
      .duct(ductEx);
    this.root.add(cut.build());

    // 겉 껍데기(뒤쪽 절반)
    const add = (g: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
      const mesh = new THREE.Mesh(g, mat);
      this.root.add(mesh);
      return mesh;
    };
    const ironD = m.iron.clone();
    ironD.side = THREE.DoubleSide;
    add(shell(crankcase, DEPTH, (i) => i === crankcase.length - 1), ironD);
    add(shell(block, DEPTH, (i) => i === 0 || i === block.length / 2), ironD);
    const headMat = m.bodyAlu;
    add(shell(head, DEPTH, (i) => i === 1 || i === 3 || i === 5 || i === 7), headMat);
    for (const sx of [-1, 1]) {
      // 포트 출구가 뚫린 옆벽
      add(flatZY(portWall(DECK, HEAD_TOP, 3.24, PORT_R, DEPTH), sx * HX), headMat);
    }
    add(shell(cover, DEPTH, (i) => i === cover.length - 1), headMat);

    // 안쪽 면
    add(boreSurface(R, LINER_BOT, DECK), m.bore);
    add(boreSkirtFill(R, POCKET, LINER_BOT), m.interior);
    add(shell(pocket, POCKET, (i) => i === pocket.length - 1), m.interior);
    // 연소실 천장(포트 입구 두 곳이 뚫림)
    const ceil: V2[] = [[-R, 0], ...arcPts(-VX, 0, PORT_R, Math.PI, 0, 14).map(([x, z]) => [x, -z] as V2), ...arcPts(VX, 0, PORT_R, Math.PI, 0, 14).map(([x, z]) => [x, -z] as V2), [R, 0], ...arcPts(0, 0, R, 0, Math.PI, 40).map(([x, z]) => [x, -z] as V2)];
    add(flatXZ(ceil, DECK), m.interior);
    add(halfTube(ductIn.pts, PORT_R), m.interior);
    add(halfTube(ductEx.pts, PORT_R), m.interior);
    add(shell(camCav, 0.34), m.interior);
    // 플러그 관(캠실 통과)
    const tubeMat = m.alu.clone();
    tubeMat.side = THREE.DoubleSide;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 4.06 - HEAD_TOP, 24, 1, true), tubeMat);
    tube.position.y = (4.06 + HEAD_TOP) / 2;
    this.root.add(tube);

    // 흡기관 + 공기 청정기
    const pipeIn = new Duct([[-HX, 3.24], [-1.05, 3.25], [-1.25, 3.34], [-1.38, 3.5], [-1.42, 3.64]], 0.1, 40);
    add(halfTube(pipeIn.pts, 0.1, 14), m.bodyAlu);
    const filter = new THREE.Mesh(
      lathe([[0, 3.62], [0.24, 3.62], [0.26, 3.66], [0.26, 3.9], [0.24, 3.94], [0, 3.94]], 48),
      paint(0x30353c, { roughness: 0.6 })
    );
    filter.position.x = -1.42;
    this.root.add(filter);
    // 배기관 + 소음기
    const pipeEx = new Duct([[HX, 3.24], [1.08, 3.22], [1.3, 3.0], [1.4, 2.6], [1.42, 2.08]], 0.1, 48);
    add(halfTube(pipeEx.pts, 0.1, 14), m.exhaust);
    const muf = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.06, 1.12), new THREE.Vector2(0.18, 1.2), new THREE.Vector2(0.21, 1.3), new THREE.Vector2(0.21, 1.98), new THREE.Vector2(0.18, 2.06), new THREE.Vector2(0.1, 2.1)], 40, Math.PI / 2, Math.PI), m.exhaust);
    muf.position.x = 1.42;
    this.root.add(muf);
    const tail = new Duct([[1.42, 1.13], [1.46, 1.0], [1.6, 0.95], [1.9, 0.95]], 0.055, 24);
    add(halfTube(tail.pts, 0.055, 10), m.exhaust);
    // 관 이음 플랜지
    add(flatZY(halfAnnulus(3.24, 0.1, PORT_R + 0.07), -HX - 0.012), m.bodyAlu);
    add(flatZY(halfAnnulus(3.24, 0.1, PORT_R + 0.07), HX + 0.012), m.exhaust);

    // 캠 벨트(뒤쪽)
    const belt = new THREE.Mesh(beltRibbon([{ c: [0, CRANK_Y], r: 0.1 }, { c: [-VX, CAM_Y], r: 0.2 }, { c: [VX, CAM_Y], r: 0.2 }], BELT_Z, 0.06, 0.02), m.boot);
    this.root.add(belt);

    // 받침대
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.6), paint(0x2d5f8f, { roughness: 0.45 }));
    base.position.set(0.1, 0.04, -0.2);
    this.root.add(base);
    for (const sx of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.9), m.dark);
      foot.position.set(sx * 0.5, 0.25, -0.3);
      this.root.add(foot);
    }
  }

  private buildValves(): void {
    const m = this.m;
    const valveGeo = lathe(
      [
        [0, 0],
        [0.13, 0],
        [0.135, 0.008],
        [0.125, 0.02],
        [0.05, 0.045],
        [0.022, 0.085],
        [0.022, 0.8],
        [0, 0.8]
      ],
      36
    );
    const retGeo = lathe([[0.022, 0.73], [0.06, 0.73], [0.06, 0.745], [0.022, 0.745]], 24);
    const bucketGeo = lathe([[0, 0.745], [0.068, 0.745], [0.07, 0.75], [0.07, 0.815], [0.066, 0.82], [0, 0.82]], 32);
    const springGeo = new THREE.TubeGeometry(new Helix(0.048, SPRING_H, 6), 150, 0.008, 8, false);
    const guideGeo = lathe([[0.023, 0.3], [0.04, 0.3], [0.04, 0.52], [0.023, 0.52]], 20);
    const seatGeo = new THREE.TorusGeometry(PORT_R + 0.012, 0.012, 8, 40);
    seatGeo.rotateX(Math.PI / 2);
    const prof = camProfile();
    const camShape = new THREE.Shape();
    prof.forEach(([x, y], i) => (i === 0 ? camShape.moveTo(x, y) : camShape.lineTo(x, y)));
    camShape.closePath();
    const lobeGeo = new THREE.ExtrudeGeometry(camShape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
    lobeGeo.translate(0, 0, -0.045);
    const lobeMat = paint(0xc8483f, { roughness: 0.4, metalness: 0.4 });
    const springMat = m.steel.clone();
    springMat.color.setHex(0x7fb3e6);
    const shaftGeo = (() => {
      const g = new THREE.CylinderGeometry(0.035, 0.035, 0.84, 20);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, -0.33);
      return g;
    })();
    const sprocket = (() => {
      const g = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 48);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, BELT_Z);
      return g;
    })();
    for (const intake of [true, false]) {
      const x = intake ? -VX : VX;
      const root = new THREE.Group();
      root.position.set(x, DECK, 0);
      const moving = new THREE.Group();
      moving.add(new THREE.Mesh(valveGeo, steel({ color: intake ? 0xd9dfe6 : 0xa48f7c })));
      moving.add(new THREE.Mesh(retGeo, m.steel));
      moving.add(new THREE.Mesh(bucketGeo, m.steel));
      root.add(moving);
      const spring = new THREE.Mesh(springGeo, springMat);
      spring.position.y = HEAD_TOP - DECK;
      root.add(spring, new THREE.Mesh(guideGeo, m.dark));
      const seat = new THREE.Mesh(seatGeo, m.dark);
      seat.position.y = 0.006;
      root.add(seat);
      this.root.add(root);

      const cam = new THREE.Group();
      cam.position.set(x, CAM_Y, 0);
      cam.add(new THREE.Mesh(lobeGeo, lobeMat), new THREE.Mesh(shaftGeo, m.steel), new THREE.Mesh(sprocket, m.alu));
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), m.white);
      dot.position.set(0, 0.04, 0.05);
      cam.add(dot);
      this.root.add(cam);

      const peak = (intake ? INTAKE_PEAK : EXHAUST_PEAK) * DEG;
      const phase = Math.PI + peak / 2;
      // 크랭크각 0.5° 간격 양정 표 (평면 종동절 = 캠 윤곽의 아래쪽 지지 함수)
      const table = new Float32Array(1440);
      for (let k = 0; k < 1440; k++) {
        const a = -((k * 0.5 * DEG) / 2) + phase;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        let best = -Infinity;
        for (const [px, py] of prof) {
          const d = -(px * sa + py * ca);
          if (d > best) best = d;
        }
        table[k] = Math.max(0, best - CAM_BASE);
      }
      this.valves.push({ moving, spring, cam, phase, table });
    }
  }

  // ───────────────────────── 자세 ─────────────────────────

  private lift(v: Valve, th: number): number {
    const u = ((th % 720) + 720) % 720 * 2;
    const k = Math.floor(u);
    const f = u - k;
    const a = v.table[k % 1440]!;
    const b = v.table[(k + 1) % 1440]!;
    return a + (b - a) * f;
  }

  setPhase(phi: number): void {
    const th = ((phi % 720) + 720) % 720;
    const a = th * DEG;
    this.crank.rotation.z = -a;
    const py = pinY(th);
    this.piston.position.y = py;
    this.rod.position.y = py;
    const dx = CR * Math.sin(a);
    const dy = CRANK_Y + CR * Math.cos(a) - py;
    this.rod.rotation.z = Math.atan2(dx, -dy);

    const lifts: number[] = [];
    for (const v of this.valves) {
      const l = this.lift(v, th);
      lifts.push(l);
      v.moving.position.y = -l;
      v.spring.scale.y = (SPRING_H - l) / SPRING_H;
      v.cam.rotation.z = -a / 2 + v.phase;
    }
    const crown = crownY(th);
    this.gas.group.position.y = crown;
    this.gas.group.scale.y = Math.max(0.001, DECK - crown);
    volumeLook(th, 180, 360, 520, this.gas.mat);
    this.ign.set(th - 360, Math.max(0.05, DECK - crown - 0.01));

    // 입자
    const pIn = clamp01(th / 190);
    const pEx = clamp01((th - 500) / 215);
    const lIn = lifts[0] ?? 0;
    const lEx = lifts[1] ?? 0;
    const top = DECK - 0.015;
    for (let i = 0; i < N; i++) {
      const s = this.seeds[i]!;
      const target = this.tmp2.set(s.x, crown + 0.012 + s.h * (top - crown - 0.012), s.z);
      let p: THREE.Vector3 | null = this.tmp;
      const f = pIn - s.t;
      if (f < 0) {
        this.pIn.at(1 + f, s.a, -s.b, p);
      } else if (f < 0.25) {
        const gap = this.tmp.set(-VX + s.a * 0.6, DECK - lIn - 0.03, -0.04 - s.b * 0.5);
        p = gap.lerp(target, smooth(f / 0.25));
      } else {
        p.copy(target);
      }
      if (th >= 500) {
        const g = pEx * 1.6 - s.o;
        if (g >= 0.6) p = null;
        else if (g >= 0.12) p = this.pEx.at((g - 0.12) / 0.48, s.a, -s.b, this.tmp);
        else if (g >= 0) {
          this.tmp3.set(VX + s.a * 0.6, DECK - lEx - 0.03, -0.04 - s.b * 0.5);
          p = this.tmp.copy(target).lerp(this.tmp3, smooth(g / 0.12));
        }
      }
      this.parts.set(i, p, lifeColor(th, 180, 360, 520, this.col));
      // 다음 차례 혼합기(흡기관 안에서 기다림)
      const f2 = pIn - s.t - 1;
      this.parts.set(N + i, f2 >= -1 ? this.pIn.at(1 + f2, s.a, -s.b, this.tmp) : null, this.mixCol);
    }
    this.parts.commit();
  }

  state(phi: number): CycleState {
    const th = ((phi % 720) + 720) % 720;
    const v0 = this.valves[0]!;
    const v1 = this.valves[1]!;
    const s = th % 360;
    const dead = s < 6 || s > 354 ? 'tdc' : Math.abs(s - 180) < 6 ? 'bdc' : null;
    const gas = th < 180 ? '혼합기가 들어오는 중' : th < 360 ? '혼합기를 압축하는 중' : th < 540 ? '연소 가스가 팽창하는 중' : '배기가스를 밀어내는 중';
    return {
      dir: s < 180 ? 'down' : 'up',
      dead,
      open: { intake: this.lift(v0, th) / CAM_LIFT, exhaust: this.lift(v1, th) / CAM_LIFT },
      spark: th > 350 && th < 370,
      gas
    };
  }

  tags(): TagDef[] {
    return [
      { key: 'intake', label: '흡기 밸브', pos: new THREE.Vector3(-VX - 0.13, DECK - 0.01, 0.02), side: 'left' },
      { key: 'exhaust', label: '배기 밸브', pos: new THREE.Vector3(VX + 0.13, DECK - 0.01, 0.02), side: 'right' },
      { key: 'plug', label: '점화 플러그', pos: new THREE.Vector3(0, 4.14, 0) },
      { key: 'cam', label: '캠축(캠)', pos: new THREE.Vector3(VX + 0.16, CAM_Y, 0.05), side: 'right' },
      { key: 'piston', label: '피스톤', pos: new THREE.Vector3(-0.4, 2.4, 0.2), side: 'left' },
      { key: 'crank', label: '크랭크축', pos: new THREE.Vector3(0, CRANK_Y, 0.36), side: 'right' },
      { key: 'rod', label: '커넥팅 로드', pos: new THREE.Vector3(0.1, 1.9, 0.12), side: 'right' },
      { key: 'cylinder', label: '실린더', pos: new THREE.Vector3(0.52, 2.15, 0.05), side: 'right', priority: 2 },
      { key: 'spring', label: '밸브 스프링', pos: new THREE.Vector3(-VX - 0.05, HEAD_TOP + SPRING_H / 2, 0.05), side: 'left', priority: 2 },
      // 캠 벨트는 블록 뒤(z = BELT_Z)에 있다 — 배기 쪽 곧은 가닥의 가운데, 벨트 뒷면에 점을 찍고 뒤에서 볼 때만 보인다
      { key: 'belt', label: '캠 벨트', pos: new THREE.Vector3(0.26, (CRANK_Y + CAM_Y) / 2, BELT_Z - 0.04), side: 'right', priority: 2, backOnly: true },
      { key: 'inpipe', label: '흡기관·공기 청정기', pos: new THREE.Vector3(-1.42, 3.78, 0), side: 'left', priority: 3 },
      { key: 'expipe', label: '배기관·소음기', pos: new THREE.Vector3(1.42, 1.6, 0), side: 'right', priority: 3 },
      { key: 'fins', label: '냉각 핀', pos: new THREE.Vector3(-0.86, 2.0, 0.02), side: 'left', priority: 3 }
    ];
  }

  /** 움직이는 이름표 위치 갱신(피스톤·커넥팅 로드 가운데) */
  tagPos(key: string, out: THREE.Vector3): boolean {
    if (key === 'piston') {
      out.set(-0.4, this.piston.position.y + 0.1, 0.1);
      return true;
    }
    if (key === 'rod') {
      // 소단부(피스톤 핀)와 대단부(크랭크 핀)의 가운데
      const py = this.piston.position.y;
      const a = -this.crank.rotation.z;
      out.set((CR * Math.sin(a)) / 2, (py + CRANK_Y + CR * Math.cos(a)) / 2, 0.12);
      return true;
    }
    return false;
  }

  dispose(): void {
    disposeTree(this.root);
  }
}

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly r: number,
    private readonly h: number,
    private readonly turns: number
  ) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * TAU;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}

