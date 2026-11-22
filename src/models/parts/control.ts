// 제어용 기계요소: 압축 코일 스프링, 블록 브레이크, 디스크 브레이크

import * as THREE from 'three';
import { steel, darkSteel, chrome, aluminum, rubber, paint, castIron, plastic } from '../materials';
import {
  type V2,
  TAU,
  mesh,
  merge,
  lathe,
  sweep,
  extrude,
  circlePath,
  annularSector,
  roundedRect,
  polygonFace,
  hexPrism,
  pathFrom,
  circlePts,
  creased
} from './geom';

/** 압축 코일 스프링: 양끝 좌권(밀착 감김) + 연삭된 평평한 끝면 */
export function buildSpring(): THREE.Group {
  const g = new THREE.Group();
  const R = 0.3;
  const wr = 0.046;
  const turns = 8.5;
  const pDead = wr * 2.02;
  const pAct = 0.17;
  const n = Math.round(turns * 72);
  // 피치를 각도에 따라 부드럽게 바꿔 높이를 적분
  const pitchAt = (tt: number): number => {
    const edge = Math.min(tt, turns - tt); // 끝에서부터 감긴 수
    const k = Math.max(0, Math.min(1, (edge - 0.75) / 0.6));
    const s = k * k * (3 - 2 * k);
    return pDead + (pAct - pDead) * s;
  };
  const pts: THREE.Vector3[] = [];
  const ns: THREE.Vector3[] = [];
  const bs: THREE.Vector3[] = [];
  let y = 0;
  for (let i = 0; i <= n; i++) {
    const tt = (i / n) * turns;
    if (i > 0) y += pitchAt(tt) * (turns / n);
    const a = tt * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R));
  }
  const H = y;
  for (let i = 0; i <= n; i++) {
    const p = pts[i]!;
    const T = pts[Math.min(n, i + 1)]!.clone().sub(pts[Math.max(0, i - 1)]!).normalize();
    const N = new THREE.Vector3(-p.x, 0, -p.z).normalize(); // 코일 중심 방향
    N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
    ns.push(N);
    bs.push(new THREE.Vector3().crossVectors(T, N).normalize());
  }
  const prof: V2[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    prof.push([Math.cos(a) * wr, Math.sin(a) * wr]);
  }
  const geo = sweep(pts, ns, bs, prof, false, true, 50);
  // 끝면 연삭: 철사 중심 높이에서 평평하게 자른다
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const yy = pos.getY(i);
    if (yy < 0) pos.setY(i, 0);
    else if (yy > H) pos.setY(i, H);
  }
  pos.needsUpdate = true;
  geo.deleteAttribute('normal');
  const fin = creased(geo, 50);
  fin.translate(0, -H / 2, 0);
  mesh(fin, steel({ color: 0xa7b1bb, roughness: 0.3 }), g);
  g.rotation.set(0.12, 0, 0.0);
  return g;
}

/** 블록(림) 브레이크: 바퀴 림 일부 + 브레이크 암 2개 + 고무 블록 + 케이블 */
export function buildBlockBrake(): THREE.Group {
  const g = new THREE.Group();
  const R = 0.95; // 림 바깥 반지름
  const arcHalf = 0.62;
  // 림(알루미늄 상자 단면) — 휠 축 Z, 중심 (0, -R)
  const rim: V2[] = [
    [R, -0.045],
    [R, 0.045],
    [R - 0.012, 0.056],
    [R - 0.135, 0.056],
    [R - 0.16, 0.04],
    [R - 0.175, 0.014],
    [R - 0.175, -0.014],
    [R - 0.16, -0.04],
    [R - 0.135, -0.056],
    [R - 0.012, -0.056],
    [R, -0.045]
  ];
  // 타이어 단면(림 위에 얹힌 볼록한 고무) — 단면 반시계
  const tire: V2[] = [];
  const tc = R + 0.035;
  for (let i = 0; i <= 30; i++) {
    const a = -2.23 + (4.46 * i) / 30;
    tire.push([tc + Math.cos(a) * 0.065, Math.sin(a) * 0.07]);
  }
  tire.push(tire[0]!);
  const phi0 = Math.PI - arcHalf;
  const phiL = arcHalf * 2;
  const place = (geo: THREE.BufferGeometry): THREE.BufferGeometry => {
    geo.rotateX(Math.PI / 2);
    geo.translate(0, -R, 0);
    return geo;
  };
  const capFaces = (loop: V2[]): THREE.BufferGeometry[] =>
    [phi0, phi0 + phiL].map((phi) => {
      const f = polygonFace(loop.slice(0, -1));
      f.rotateY(phi - Math.PI / 2);
      return place(f);
    });
  const rimMat = aluminum({ roughness: 0.3 });
  rimMat.side = THREE.DoubleSide;
  mesh(merge([place(lathe(rim, 120, phi0, phiL, 30)), ...capFaces(rim)]), rimMat, g);
  const tireMat = rubber({ color: 0x24272c });
  tireMat.side = THREE.DoubleSide;
  mesh(merge([place(lathe(tire, 120, phi0, phiL, 40)), ...capFaces(tire)]), tireMat, g);

  // 브레이크 암 2개(Y-Z 평면 판, 피벗축 X) + 패드
  const armMat = aluminum({ color: 0xb9c1c9, roughness: 0.38 });
  const darkMat = darkSteel({ roughness: 0.4 });
  const padMat = rubber({ color: 0x6b2f2a, roughness: 0.9 });
  const armGeos: THREE.BufferGeometry[] = [];
  const darkGeos: THREE.BufferGeometry[] = [];
  const padGeos: THREE.BufferGeometry[] = [];
  const frameGeos: THREE.BufferGeometry[] = [];
  const yPad = -0.075;
  for (const sgn of [1, -1]) {
    const zArm = sgn * 0.17;
    // 암: X-Y 평면 판(넓은 면이 림 쪽을 향함), 아래쪽에 X축 피벗 슬리브
    const sh = new THREE.Shape();
    sh.moveTo(-0.05, -0.5);
    sh.absarc(0, -0.5, 0.05, Math.PI, TAU, false);
    sh.quadraticCurveTo(0.04, -0.1, 0.034, 0.3);
    sh.absarc(0, 0.3, 0.034, 0, Math.PI, false);
    sh.quadraticCurveTo(-0.04, -0.1, -0.05, -0.5);
    const arm = extrude(sh, 0.034, 0.008, 20, 2);
    arm.translate(0, 0, zArm);
    armGeos.push(arm);
    // 피벗 보스(축 X)
    const boss = lathe([[0.015, -0.07], [0.04, -0.07], [0.045, -0.065], [0.045, 0.065], [0.04, 0.07], [0.015, 0.07]], 32);
    boss.rotateZ(-Math.PI / 2);
    boss.translate(0, -0.5, zArm);
    darkGeos.push(boss);
    // 프레임(포크 다리) 토막 + 브레이크 보스: 암 피벗을 받친다
    const leg = lathe([[0, -0.66], [0.032, -0.66], [0.036, -0.64], [0.036, -0.38], [0.032, -0.36], [0, -0.36]], 32);
    leg.translate(-0.12, 0, sgn * 0.14);
    frameGeos.push(leg);
    const stub = lathe([[0, 0], [0.022, 0], [0.022, 0.12], [0, 0.12]], 20);
    stub.rotateZ(-Math.PI / 2);
    stub.translate(-0.12, -0.5, zArm);
    darkGeos.push(stub);
    // 패드: 금속 슈 + 고무 블록 + 고정 볼트
    const zRim = 0.056;
    const shoe = extrude(roundedRect(-0.12, -0.032, 0.12, 0.032, 0.025), 0.016, 0.004, 8);
    shoe.translate(0, yPad, sgn * (zRim + 0.04 + 0.008));
    darkGeos.push(shoe);
    const pad = extrude(roundedRect(-0.11, -0.026, 0.11, 0.026, 0.02), 0.04, 0.006, 8);
    pad.translate(0, yPad, sgn * (zRim + 0.002 + 0.02));
    padGeos.push(pad);
    const stud = lathe([[0, 0], [0.012, 0], [0.012, 0.075], [0, 0.075]], 16);
    stud.rotateX(sgn * Math.PI / 2);
    stud.translate(0, yPad, sgn * (zRim + 0.06));
    darkGeos.push(stud);
    const nut = hexPrism(0.042, 0.022, true, true);
    nut.rotateX(Math.PI / 2);
    nut.translate(0, yPad, sgn * (0.17 + 0.028));
    darkGeos.push(nut);
  }
  mesh(merge(armGeos), armMat, g);
  mesh(merge(darkGeos), darkMat, g);
  mesh(merge(padGeos), padMat, g);
  mesh(merge(frameGeos), castIron({ color: 0x4a5058, roughness: 0.55 }), g);

  // 케이블: 누들(굽은 금속관) + 속선 + 외피
  const noodlePts = [
    new THREE.Vector3(0, 0.5, -0.3),
    new THREE.Vector3(0, 0.42, -0.26),
    new THREE.Vector3(0, 0.35, -0.19),
    new THREE.Vector3(0, 0.34, -0.12)
  ];
  const noodle = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(noodlePts), 40, 0.016, 12);
  mesh(creased(noodle, 50), chrome({ roughness: 0.18 }), g);
  const housing = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.49, -0.298), new THREE.Vector3(0, 0.56, -0.33), new THREE.Vector3(0.02, 0.62, -0.35)]),
    24,
    0.022,
    12
  );
  mesh(creased(housing, 50), plastic(0x1e2125), g);
  const wire = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0.34, -0.13), new THREE.Vector3(0, 0.335, 0.2)), 4, 0.006, 8);
  mesh(creased(wire, 50), steel({ roughness: 0.3 }), g);
  // 오른쪽 암 케이블 고정 볼트
  const clamp = hexPrism(0.045, 0.025, true, true);
  clamp.rotateX(Math.PI / 2);
  clamp.translate(0, 0.335, 0.205);
  mesh(clamp, darkSteel({ roughness: 0.4 }), g);

  g.rotation.set(0.3, -0.4, 0);
  return g;
}

/** 디스크 브레이크: 통풍(드릴) 구멍 디스크 + 햇 허브 + 빨간 캘리퍼 + 패드 */
export function buildDiscBrake(): THREE.Group {
  const g = new THREE.Group();
  // 디스크(브레이크 링)
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 0.5, 0, TAU, false);
  ring.holes.push(circlePath(0, 0, 0.225));
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU + row * 0.13;
      const r = 0.31 + row * 0.058;
      ring.holes.push(pathFrom(circlePts(0.016, 16, Math.cos(a) * r, Math.sin(a) * r).reverse()));
    }
  }
  const disc = extrude(ring, 0.06, 0.006, 96);
  mesh(disc, steel({ color: 0xb4bcc4, roughness: 0.34 }), g);

  // 햇(허브): 원통 벽 + 윗판(허브 볼트 5개, 중심 구멍)
  const hatMat = darkSteel({ roughness: 0.42 });
  const wall = lathe(
    [
      [0.2, -0.03],
      [0.245, -0.03],
      [0.245, 0.1],
      [0.235, 0.112],
      [0.2, 0.112],
      [0.2, -0.03]
    ],
    80
  );
  wall.rotateX(Math.PI / 2);
  const top = new THREE.Shape();
  top.absarc(0, 0, 0.236, 0, TAU, false);
  top.holes.push(circlePath(0, 0, 0.07));
  const studs: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + Math.PI / 2;
    top.holes.push(circlePath(Math.cos(a) * 0.145, Math.sin(a) * 0.145, 0.021));
    const st = lathe([[0, 0.06], [0.017, 0.06], [0.017, 0.2], [0.012, 0.212], [0, 0.212]], 20);
    st.rotateX(Math.PI / 2);
    st.translate(Math.cos(a) * 0.145, Math.sin(a) * 0.145, 0);
    studs.push(st);
  }
  const topPlate = extrude(top, 0.03, 0.006, 64);
  topPlate.translate(0, 0, 0.1);
  mesh(merge([wall, topPlate]), hatMat, g);
  mesh(merge(studs), chrome({ roughness: 0.2 }), g);

  // 캘리퍼(빨강): 바깥/안쪽 몸체 + 디스크 가장자리를 넘는 브리지
  const aC = 0.72;
  const span = 0.78;
  const sec = (r0: number, r1: number): THREE.Shape => annularSector(r0, r1, aC - span / 2, aC + span / 2);
  const calGeos: THREE.BufferGeometry[] = [];
  for (const sgn of [1, -1]) {
    const half = extrude(sec(0.39, 0.6), 0.1, 0.032, 40, 3);
    half.translate(0, 0, sgn * 0.085);
    calGeos.push(half);
  }
  const bridge = extrude(sec(0.515, 0.6), 0.26, 0.032, 40, 3);
  calGeos.push(bridge);
  // 피스톤 보스 2개(바깥쪽)
  for (const da of [-0.17, 0.17]) {
    const boss = lathe([[0, 0], [0.058, 0], [0.062, 0.008], [0.062, 0.016], [0.05, 0.026], [0, 0.026]], 40);
    boss.rotateX(Math.PI / 2);
    boss.translate(Math.cos(aC + da) * 0.495, Math.sin(aC + da) * 0.495, 0.128);
    calGeos.push(boss);
  }
  mesh(merge(calGeos), paint(0xd23a2f, { roughness: 0.35 }), g);
  // 캘리퍼 고정 볼트 + 블리더
  const boltGeos: THREE.BufferGeometry[] = [];
  for (const da of [-0.22, 0.22]) {
    const b = hexPrism(0.05, 0.03, true, true);
    b.rotateX(Math.PI / 2);
    b.translate(Math.cos(aC + da) * 0.43, Math.sin(aC + da) * 0.43, -0.15);
    boltGeos.push(b);
  }
  const bleeder = lathe([[0, 0], [0.012, 0], [0.012, 0.05], [0.008, 0.06], [0, 0.06]], 16);
  bleeder.rotateZ(-(aC - Math.PI / 2));
  bleeder.translate(Math.cos(aC + 0.12) * 0.585, Math.sin(aC + 0.12) * 0.585, 0.08);
  boltGeos.push(bleeder);
  mesh(merge(boltGeos), chrome({ roughness: 0.25 }), g);
  // 패드(마찰재 + 받침판) — 캘리퍼 안쪽 가장자리 아래로 살짝 보인다
  const padGeos: THREE.BufferGeometry[] = [];
  const plateGeos: THREE.BufferGeometry[] = [];
  for (const sgn of [1, -1]) {
    const pad = extrude(annularSector(0.355, 0.49, aC - 0.32, aC + 0.32), 0.02, 0.003, 24);
    pad.translate(0, 0, sgn * 0.041);
    padGeos.push(pad);
    const bp = extrude(annularSector(0.35, 0.5, aC - 0.34, aC + 0.34), 0.012, 0.002, 24);
    bp.translate(0, 0, sgn * 0.057);
    plateGeos.push(bp);
  }
  mesh(merge(padGeos), castIron({ color: 0x2a2c2f, roughness: 0.9 }), g);
  mesh(merge(plateGeos), darkMatOf(), g);

  g.rotation.set(-0.25, 0.45, 0);
  return g;
}

function darkMatOf(): THREE.MeshStandardMaterial {
  return darkSteel({ roughness: 0.45 });
}
