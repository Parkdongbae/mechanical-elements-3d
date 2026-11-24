// 풀리 3종 — 납작·V홈·단차·원뿔 (회전축 = 로컬 Z, 원점 중심)
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint } from '../../models/materials';
import { lathe, merge, mesh, steppedProfile, tubeProfile, TAU, type V2 } from '../../models/parts/geom';
import { ROPE_R } from './belt';
import { setMM } from './mm';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}


export interface PulleyOpts {
  width?: number;
  spokes?: number;
  hub?: number;
  crowned?: boolean;
  grooved?: boolean;
  /** 홈 없는 납작 림(평벨트용). 기본은 로프 홈 림 */
  flat?: boolean;
  driver?: boolean;
}

/** 평벨트/V홈 풀리: 림 + 스포크(또는 민판) + 허브 + 밝은 표시점 */
export function pulley(r: number, opts: PulleyOpts = {}): THREE.Group {
  const w = opts.width ?? 0.16;
  const h = w / 2;
  const spokes = opts.spokes ?? 4;
  const bore = Math.max(0.026, opts.hub ?? r * 0.16);
  const rimIn = r * 0.68;
  const c = Math.min(0.012, w * 0.12);
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const g = new THREE.Group();
  // 림 단면 (r, 축방향) — 바깥 모서리 모따기, 끝에서 안벽까지 닫는다
  let prof: V2[];
  // 검사 표식(userData.mm): 림 종류·홈 바닥·가장 바깥 반지름
  const mm: Record<string, unknown> = { kind: 'wheel', fn: 'pulley', axis: 'z', r, width: w, span: [-h, h] };
  if (opts.grooved === true) {
    const gd = r * 0.16 + 0.006;
    Object.assign(mm, { rim: 'groove', groove: 'v', bottom: r - gd, outer: r });
    const gw = Math.min(w * 0.32, 0.055);
    const gd2 = gd * 0.7;
    prof = [
      [rimIn, -h],
      [r - c, -h],
      [r, -h + c],
      [r, -gw / 2],
      [r - gd, -gw / 2 + gd2],
      [r - gd, gw / 2 - gd2],
      [r, gw / 2],
      [r, h - c],
      [r - c, h],
      [rimIn, h],
      [rimIn, -h]
    ];
  } else if (opts.crowned === true) {
    Object.assign(mm, { rim: 'flat', crowned: true, bottom: r, outer: r * 1.02 });
    prof = [
      [rimIn, -h],
      [r - c, -h],
      [r, -h + c],
      [r, -h * 0.45],
      [r * 1.02, 0],
      [r, h * 0.45],
      [r, h - c],
      [r - c, h],
      [rimIn, h],
      [rimIn, -h]
    ];
  } else if (opts.flat === true) {
    Object.assign(mm, { rim: 'flat', bottom: r, outer: r });
    prof = [
      [rimIn, -h],
      [r - c, -h],
      [r, -h + c],
      [r, h - c],
      [r - c, h],
      [rimIn, h],
      [rimIn, -h]
    ];
  } else {
    // 기본: 로프 홈 풀리 — 둥근 홈(로프 중심 반지름 r + 0.01) + 양쪽 플랜지(r + 0.04)
    const rc = r + 0.01;
    const gr = Math.min(ROPE_R + 0.004, h - 0.012);
    const fl = r + 0.04; // 로프(바깥 r + 0.055)가 플랜지 위로 살짝 드러나게
    Object.assign(mm, { rim: 'groove', groove: 'round', bottom: rc - gr, outer: fl, ropeR: rc });
    prof = [
      [rimIn, -h],
      [fl - c, -h],
      [fl, -h + c],
      [fl, -gr - 0.004],
      [rc, -gr]
    ];
    for (let i = 1; i < 12; i++) {
      const t = -Math.PI / 2 + (i / 12) * Math.PI;
      prof.push([rc - gr * Math.cos(t), gr * Math.sin(t)]);
    }
    prof.push([rc, gr], [fl, gr + 0.004], [fl, h - c], [fl - c, h], [rimIn, h], [rimIn, -h]);
  }
  const rimGeo = lathe(prof, 48);
  rimGeo.rotateX(Math.PI / 2);
  g.add(mesh(rimGeo, body));
  // 허브: 양쪽으로 살짝 돌출, 구멍 모따기
  const hubGeo = lathe(tubeProfile(bore, bore + r * 0.16, -h - 0.02, h + 0.02, 0.01), 36);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 스포크 또는 민판 웹
  if (spokes > 0) {
    const hubOut = bore + r * 0.16;
    const armLen = rimIn - hubOut;
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < spokes; i++) {
      const b = new THREE.BoxGeometry(armLen, Math.max(0.02, r * 0.16), w * 0.42);
      b.translate(hubOut + armLen / 2, 0, 0);
      b.rotateZ((i / spokes) * TAU);
      geos.push(b);
    }
    g.add(mesh(merge(geos), body));
  } else {
    const webGeo = lathe(
      [
        [bore + 0.004, -w * 0.16],
        [rimIn, -w * 0.16],
        [rimIn, w * 0.16],
        [bore + 0.004, w * 0.16],
        [bore + 0.004, -w * 0.16]
      ],
      48
    );
    webGeo.rotateX(Math.PI / 2);
    g.add(mesh(webGeo, body));
  }
  // 표시점: 앞면 림에 밝은 한 점 — 회전이 보이게
  const markGeo = new THREE.BoxGeometry(r * 0.2, 0.014, 0.01);
  g.add(meshAt(markGeo, paint(0xf2b619), opts.flat === true || opts.grooved === true || opts.crowned === true ? r * 0.84 : (rimIn + r) / 2, 0, h + 0.004));
  setMM(g, mm);
  return g;
}

/** 단차 풀리: 큰 쪽이 -Z. 단차 사다리꼴 단면 + 허브 + 단차면 구멍 4개 + 표시점 */
export function steppedPulley(radii: number[], stepWidth = 0.09): THREE.Group {
  const rs = [...radii].sort((a, b) => b - a);
  const rMin = rs[rs.length - 1]!;
  const W = rs.length * stepWidth;
  const c = Math.min(0.01, stepWidth * 0.15);
  const bore = Math.max(0.022, rMin * 0.16);
  const prof = steppedProfile(
    rs.map((r) => ({ r, len: stepWidth })),
    -W / 2,
    c
  );
  prof[0] = [bore, -W / 2];
  prof[prof.length - 1] = [bore, W / 2];
  const rimGeo = lathe(prof, 48);
  rimGeo.rotateX(Math.PI / 2);
  const g = new THREE.Group();
  g.add(mesh(rimGeo, brass()));
  const hubGeo = lathe(tubeProfile(bore, bore + 0.032, -W / 2 - 0.018, W / 2 + 0.018, 0.008), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 앞쪽 단차면에 뚫린 구멍 4개(어두운 원으로 표현)
  const holeZ = W / 2 - stepWidth;
  const holeR = (rs[rs.length - 2]! + rMin) / 2;
  const discGeo = new THREE.CircleGeometry(Math.min(0.02, stepWidth * 0.2), 16);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + TAU / 8;
    g.add(meshAt(discGeo.clone(), darkSteel(), Math.cos(a) * holeR, Math.sin(a) * holeR, holeZ + 0.002));
  }
  // 표시점: 가장 작은 단차 앞면
  const markGeo = new THREE.BoxGeometry(0.03, Math.max(0.024, rMin * 0.36), 0.01);
  g.add(meshAt(markGeo, paint(0xf2b619), 0, (bore + rMin) / 2, W / 2 + 0.004));
  setMM(g, {
    kind: 'wheel', fn: 'steppedPulley', axis: 'z', rim: 'flat', r: rs[0]!, bottom: rs[0]!, outer: rs[0]!, width: W, span: [-W / 2, W / 2],
    steps: rs.map((rr, i) => ({ r: rr, z0: -W / 2 + i * stepWidth, z1: -W / 2 + (i + 1) * stepWidth }))
  });
  return g;
}

/** 원뿔(경사) 풀리: 회전축 = 로컬 X. r0이 -X쪽. curved면 통 모양으로 볼록 */
export function conePulley(r0: number, r1: number, length: number, curved = false): THREE.Group {
  const g = new THREE.Group();
  const bore = Math.max(0.024, Math.min(r0, r1) * 0.28);
  const c = 0.008;
  const n = 24;
  const bulge = curved ? Math.min(r0, r1) * 0.12 : 0;
  const prof: V2[] = [[bore, -length / 2], [r0 - c, -length / 2]];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const y = -length / 2 + length * t;
    prof.push([r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t), y]);
  }
  prof.push([r1 - c, length / 2], [bore, length / 2]);
  const coneGeo = lathe(prof, 48);
  coneGeo.rotateZ(-Math.PI / 2); // Y축 → X축 (r0 쪽이 -X)
  g.add(mesh(coneGeo, brass()));
  const hubGeo = lathe(tubeProfile(bore, bore + 0.03, -0.018, 0.018, 0.008), 32);
  hubGeo.rotateZ(-Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 표시점: +Y 표면에 밝은 점
  const t = 0.12 / length + 0.5;
  const rr = r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t);
  const markGeo = new THREE.BoxGeometry(0.024, 0.012, 0.05);
  g.add(meshAt(markGeo, paint(0xf2b619), length * 0.12, rr + 0.007, 0));
  setMM(g, {
    kind: 'wheel', fn: 'conePulley', axis: 'x', rim: 'flat', r0, r1, length, curved, bulge,
    r: Math.max(r0, r1), outer: Math.max(r0, r1) + bulge, width: length, span: [-length / 2, length / 2]
  });
  return g;
}
