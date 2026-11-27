// 276 세 갈래 정폭 캠 — 캠이 일정하게 돌면 롤러 둘 달린 막대가 곧게 왕복(캠 한 바퀴에 3 왕복)
// 설계표 docs/mm507-sheets/276.md
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, shaftZ, tag } from '../kit';
import { K276, cam276Outline, state276 } from '../kit/k276';
import { bronze, castIron, darkSteel, glow, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const [CX, CY] = K276.C;

/** 앞뒤(z) 구간 z0~z1 로 압출한 지오메트리 */
function ext(shape: THREE.Shape, z0: number, z1: number): THREE.BufferGeometry {
  const g = extrude(shape, z1 - z0, 0);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

function rectShape(x0: number, y0: number, x1: number, y1: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x0, y0);
  s.lineTo(x1, y0);
  s.lineTo(x1, y1);
  s.lineTo(x0, y1);
  s.closePath();
  return s;
}

function rectPath(x0: number, y0: number, x1: number, y1: number): THREE.Path {
  const p = new THREE.Path();
  p.moveTo(x0, y0);
  p.lineTo(x0, y1);
  p.lineTo(x1, y1);
  p.lineTo(x1, y0);
  p.closePath();
  return p;
}

/** 막대 가운데 조각의 축 홈(가로 -0.28~0.28, 반폭 0.06) */
function slotPath(): THREE.Path {
  const p = new THREE.Path();
  const w = 0.06;
  const a = 0.22;
  p.moveTo(-a, -w);
  p.lineTo(a, -w);
  p.absarc(a, 0, w, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(-a, w);
  p.absarc(-a, 0, w, Math.PI / 2, (3 * Math.PI) / 2, false);
  p.closePath();
  return p;
}

/** 안내 받침: 네모 소매(x 방향 관통 구멍) + 뒤 받침대. [소매 메시, 받침대 메시] */
function guide(x0: number, x1: number): [THREE.Mesh, THREE.Mesh] {
  // 모양 좌표 (깊이, y) -> 세계 (z, y), 압출 방향 = x
  const s = rectShape(-0.17, 1.49, -0.01, 1.81);
  s.holes.push(rectPath(-0.122, 1.538, -0.038, 1.762));
  const geo = extrude(s, x1 - x0, 0);
  geo.rotateY(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, 0);
  const sleeve = mesh(geo, castIron());
  const baseGeo = new THREE.BoxGeometry(x1 - x0, 0.24, 0.136);
  baseGeo.translate((x0 + x1) / 2, 1.65, (-0.305 + -0.169) / 2);
  const base = mesh(baseGeo, castIron());
  return [sleeve, base];
}

export default function buildM276(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 캠 축(뒤판 보스 ~ 끝 너트) + 뒤 칼라
  const shaft = shaftZ(CX, CY, 0.166, 0.05);
  shaft.name = 'camShaft';
  const collarGeo = lathe(tubeProfile(0.05, 0.1, -0.035, -0.001), 40);
  collarGeo.rotateX(Math.PI / 2);
  shaft.add(mesh(collarGeo, steel()));
  g.add(shaft);

  // 캠 묶음
  const cam = new THREE.Group();
  cam.name = 'cam';
  cam.position.set(CX, CY, 0);
  g.add(cam);

  const outline = cam276Outline(1440);
  const plateShape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  plateShape.holes.push(circlePath(0, 0, 0.05));
  const plate = mesh(ext(plateShape, 0, 0.08), castIron({ color: 0x9aa5b1, roughness: 0.55, metalness: 0.55 }));
  plate.name = 'camPlate';
  plate.userData.outline = outline;
  cam.add(plate);

  const hubGeo = lathe(tubeProfile(0.05, 0.13, 0.079, 0.12), 48);
  hubGeo.rotateX(Math.PI / 2);
  const hub = mesh(hubGeo, darkSteel());
  hub.name = 'camHub';
  cam.add(hub);

  const yellow = paint(0xf2b619);
  const hubMark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), yellow);
  hubMark.position.set(0.09, 0, 0.123);
  cam.add(hubMark);
  const dotGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.004, 24);
  dotGeo.rotateX(Math.PI / 2);
  const dot = mesh(dotGeo, yellow);
  dot.position.set(0.68, 0, 0.082);
  cam.add(dot);

  // 왕복 막대: 세 조각
  const bar = new THREE.Group();
  bar.name = 'bar';
  bar.position.set(0, CY, 0);
  g.add(bar);
  const BZ0 = -0.12;
  const BZ1 = -0.04;

  const leftShape = new THREE.Shape();
  {
    // 왼쪽 끝 둥글게(모서리 0.05), 맞닿는 쪽은 각지게
    const x0 = -1.55;
    const x1 = -0.799;
    const r = 0.05;
    leftShape.moveTo(x0 + r, -0.11);
    leftShape.lineTo(x1, -0.11);
    leftShape.lineTo(x1, 0.11);
    leftShape.lineTo(x0 + r, 0.11);
    leftShape.absarc(x0 + r, 0.11 - r, r, Math.PI / 2, Math.PI, false);
    leftShape.lineTo(x0, -0.11 + r);
    leftShape.absarc(x0 + r, -0.11 + r, r, Math.PI, 1.5 * Math.PI, false);
    leftShape.closePath();
  }
  const barLeft = mesh(ext(leftShape, BZ0, BZ1), steel());
  barLeft.name = 'barLeft';
  bar.add(barLeft);

  const midShape = rectShape(-0.8, -0.11, 0.8, 0.11);
  midShape.holes.push(slotPath());
  const barMid = mesh(ext(midShape, BZ0, BZ1), steel());
  barMid.name = 'barMid';
  bar.add(barMid);

  const rightShape = new THREE.Shape();
  {
    const x0 = 0.799;
    const x1 = 1.5;
    const r = 0.03;
    rightShape.moveTo(x0, -0.11);
    rightShape.lineTo(x1 - r, -0.11);
    rightShape.absarc(x1 - r, -0.11 + r, r, -Math.PI / 2, 0, false);
    rightShape.lineTo(x1, 0.11 - r);
    rightShape.absarc(x1 - r, 0.11 - r, r, 0, Math.PI / 2, false);
    rightShape.lineTo(x0, 0.11);
    rightShape.closePath();
  }
  const barRight = mesh(ext(rightShape, BZ0, BZ1), steel());
  barRight.name = 'barRight';
  bar.add(barRight);

  // 롤러 핀 + 받침 고리 + 와셔 + 롤러
  const rollers: THREE.Group[] = [];
  const white = paint(0xf4f4f0);
  for (const side of ['L', 'R'] as const) {
    const px = side === 'L' ? -K276.HALF : K276.HALF;
    const pg = new THREE.Group();
    pg.position.set(px, 0, 0);
    bar.add(pg);

    const pinGeo = lathe(rodProfile(0.025, -0.06, 0.1), 24);
    pinGeo.rotateX(Math.PI / 2);
    const pin = mesh(pinGeo, steel());
    pin.name = 'pin' + side;
    pg.add(pin);

    const ringGeo = lathe(tubeProfile(0.025, 0.04, -0.04, 0.003), 32);
    ringGeo.rotateX(Math.PI / 2);
    pg.add(mesh(ringGeo, darkSteel()));

    const washGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.015, 28);
    washGeo.rotateX(Math.PI / 2);
    const wash = mesh(washGeo, darkSteel());
    wash.position.z = 0.0875;
    pg.add(wash);

    const rg = new THREE.Group();
    pg.add(rg);
    const rollGeo = lathe(tubeProfile(0.027, 0.07, 0.005, 0.075), 48);
    rollGeo.rotateX(Math.PI / 2);
    const roller = mesh(rollGeo, bronze());
    roller.name = 'roller' + side;
    rg.add(roller);
    const rm = mesh(new THREE.BoxGeometry(0.03, 0.01, 0.004), white);
    rm.position.set(0.05, 0, 0.077);
    rg.add(rm);
    rollers.push(rg);
  }
  const rollerLG = rollers[0] as THREE.Group;
  const rollerRG = rollers[1] as THREE.Group;

  // 안내 받침
  const [gLs, gLb] = guide(-1.25, -1.05);
  gLs.name = 'guideL';
  gLb.name = 'guideLBase';
  const [gRs, gRb] = guide(1.05, 1.25);
  gRs.name = 'guideR';
  gRb.name = 'guideRBase';
  g.add(gLs, gLb, gRs, gRb);

  // 화살표: 캠 방향(반시계 고정), 막대 방향(빨강)
  const camArrow = rotArrow(0.18, true);
  camArrow.position.set(-0.95, 2.55, 0.12);
  g.add(camArrow);

  const barArrow = new THREE.Group();
  const rmat = glow(0xd2352b, 0.9);
  const shA = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 14), rmat);
  shA.position.y = -0.04;
  const hdA = mesh(new THREE.ConeGeometry(0.04, 0.08, 16), rmat);
  hdA.position.y = 0.06;
  barArrow.add(shA, hdA);
  barArrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(barArrow, { kind: 'arrow', r: 0.1, ccw: true });
  g.add(barArrow);

  // 이름표 4개
  g.add(
    leaderTo(tag('정폭 캠', v(-1.3, 2.65, 0.3)), 'camPlate'),
    leaderTo(tag('롤러', v(1.45, 2.35, 0.3)), 'rollerR'),
    leaderTo(tag('왕복 막대', v(-1.35, 0.95, 0.3)), 'barLeft'),
    leaderTo(tag('안내 받침', v(1.45, 0.95, 0.3)), 'guideR')
  );

  const apply = (): void => {
    const s = state276(t);
    shaft.rotation.z = s.phi;
    cam.rotation.z = s.phi;
    bar.position.x = s.X;
    rollerLG.rotation.z = s.zetaL;
    rollerRG.rotation.z = s.zetaR;
    barArrow.position.set(s.X - 1.3, 1.9, 0.05);
    barArrow.rotation.z = s.dir < 0 ? Math.PI / 2 : -Math.PI / 2;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.3, 2.0, 5.0], target: [0, 1.55, 0] },
    notes: () => {
      const s = state276(t);
      const deg = ((((s.phi * 180) / Math.PI) % 360) + 360) % 360;
      return [
        { label: '캠 각', value: deg.toFixed(0) + '°' },
        { label: '막대 위치 X', value: s.X.toFixed(3) },
        { label: '롤러 중심 사이', value: '1.320 (늘 같음)' },
        {
          label: '메모',
          value:
            '롤러 중심이 지나는 길의 지름이 어느 방향이나 1.32 로 같다. 캠 윤곽은 그 길을 롤러 반지름만큼 줄인 것이라 캠 자체 지름은 1.11~1.18 로 조금 달라진다(원문은 캠 지름이 같다고 함 — 롤러가 있으면 롤러 중심의 길이 같아야 한다)'
        },
        { label: '원리', value: '캠 한 바퀴에 막대 3 왕복' }
      ];
    },
    update(dt: number, speed: number): void {
      t += speed * dt;
      apply();
    }
  };
}
