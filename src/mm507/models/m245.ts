// 245 바요네트 이음 — 막대 A 의 핀이 소켓 B 의 L 자 홈 가로 끝에 걸려 있다. A 를 돌리면 핀이 가로 홈을 따라
// 세로 홈 밑으로 가고, 그때 A 를 들어 올리면 핀이 세로 홈을 따라 빠진다 — 설계표 docs/mm507-sheets/245.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { brass, darkSteel, paint, wood } from '../../models/materials';

const ZC = 0.25; // 기구 중심 z
const RS = 0.48; // 소켓 바깥 반지름
const RB = 0.39; // 소켓 구멍 반지름
const RA = 0.37; // 막대 반지름
const RP = 0.055; // 핀 반지름
const Y_TOP = 1.42; // 소켓 윗면
const Y_FLOOR = 0.69; // 구멍 바닥
const PSI_V = -0.401426; // 세로 다리 각(−23°)
const H = 0.78; // 빼는 높이
const PIN_Y = 1.24; // 핀 높이(막대 로컬)
const PIN_Z = 0.415; // 핀 중심 반지름 방향 거리
const D = Math.PI / 180;
const PH = 20 * D; // L자 홈·핀·막대 각 원점을 정면(카메라 쪽)으로 돌린 전체 위상(창은 그대로)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const s = (u: number): number => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

// 부채꼴 고리 조각(반지름 r0~r1, 각 psi0~psi1, 높이 y0~y1)을 세로로 압출. 메시는 (0, 0, ZC) 에 둔다
function wallPiece(r0: number, r1: number, psi0: number, psi1: number, y0: number, y1: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r1, psi0 - Math.PI / 2, psi1 - Math.PI / 2, false);
  shape.absarc(0, 0, r0, psi1 - Math.PI / 2, psi0 - Math.PI / 2, true);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 48 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return geo;
}

const piece = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, 0, ZC);
  return m;
};

export default function buildM245(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 소켓 B
  const socket = new THREE.Group();
  socket.name = 'socketB';
  const socketMat = paint(0xdfe3e8);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(RS, RS, 0.51, 64), socketMat);
  base.position.set(0, 0.435, ZC);
  const AWD = 8.952;
  socket.add(
    base,
    piece(wallPiece(RB, RS, 130 * D, 400 * D, Y_FLOOR, 1.06), socketMat),
    piece(wallPiece(RB, RS, 0, 360 * D, 1.06, 1.165), socketMat),
    piece(wallPiece(RB, RS, AWD * D + PH, 328.048 * D + PH, 1.165, 1.315), socketMat),
    piece(wallPiece(RB, RS, -14.048 * D + PH, 328.048 * D + PH, 1.315, Y_TOP), socketMat)
  );
  g.add(socket);

  // 잘린 면(빨강)
  const cut = new THREE.Group();
  cut.name = 'cutFaces';
  const cutMat = paint(0xd8362f);
  cutMat.side = THREE.DoubleSide;
  for (const [deg, off] of [[40, 0.002], [130, -0.002]] as const) {
    const psi = deg * D;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.37), cutMat);
    p.position.set(0.435 * Math.sin(psi) + off * Math.cos(psi), 0.875, ZC + 0.435 * Math.cos(psi) - off * Math.sin(psi));
    p.rotation.y = psi - Math.PI / 2;
    cut.add(p);
  }
  cut.add(piece(wallPiece(RB, RS, 40 * D, 130 * D, 1.055, 1.059), cutMat), piece(wallPiece(RB, RS, 40 * D, 130 * D, 0.691, 0.695), cutMat));
  g.add(cut);

  // 홈 테두리(주황)
  const rim = new THREE.Group();
  rim.name = 'slotRim';
  const rimMat = paint(0xff8a00);
  rim.add(
    piece(wallPiece(0.478, 0.49, -31.952 * D + PH, AWD * D + PH, 1.153, 1.165), rimMat),
    piece(wallPiece(0.478, 0.49, -14.048 * D + PH, AWD * D + PH, 1.315, 1.327), rimMat)
  );
  for (const [deg, y0, y1] of [[-32.67, 1.165, 1.42], [-13.33, 1.315, 1.42], [9.67, 1.165, 1.315]] as const) {
    const psi = deg * D + PH;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, y1 - y0, 0.012), rimMat);
    b.position.set(0.484 * Math.sin(psi), (y0 + y1) / 2, ZC + 0.484 * Math.cos(psi));
    b.rotation.y = psi;
    rim.add(b);
  }
  g.add(rim);

  // 막대 A (+ 노란 줄, 핀, 손잡이)
  const rodA = new THREE.Group();
  rodA.name = 'rodA';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(RA, RA, 1.7, 64), brass());
  body.position.set(0, 1.54, 0);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.01), paint(0xf2b619));
  mark.name = 'rodMark';
  mark.position.set(0, 1.825, 0.372);
  const pinGeo = new THREE.CylinderGeometry(RP, RP, 0.23, 24);
  pinGeo.rotateX(Math.PI / 2);
  const pin = new THREE.Mesh(pinGeo, paint(0xd8362f));
  pin.name = 'pin';
  pin.position.set(0, PIN_Y, PIN_Z);
  const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 16);
  handleGeo.rotateZ(Math.PI / 2);
  const handle = new THREE.Mesh(handleGeo, wood());
  handle.name = 'handle';
  handle.position.set(0, 2.43, 0);
  rodA.add(body, mark, pin, handle);
  rodA.position.set(0, 0, ZC);
  g.add(rodA);

  // 안내 고리 + 팔
  const guide = new THREE.Group();
  guide.name = 'guide';
  const ringShape = new THREE.Shape();
  ringShape.absarc(0, 0, 0.46, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.38, 0, Math.PI * 2, true);
  ringShape.holes.push(hole);
  const ringGeo = new THREE.ExtrudeGeometry(ringShape, { depth: 0.1, bevelEnabled: false, curveSegments: 48 });
  ringGeo.rotateX(-Math.PI / 2);
  ringGeo.translate(0, 2.15, 0);
  const ring = new THREE.Mesh(ringGeo, darkSteel());
  ring.position.set(0, 0, ZC);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.13), darkSteel());
  arm.position.set(0, 2.2, -0.235);
  guide.add(ring, arm);
  g.add(guide);

  g.add(
    leaderTo(tag('A 막대(돌려서 뺌)', v(-1.65, 2.84, 0.25)), 'rodA'),
    leaderTo(tag('B 소켓', v(1.26, 0.59, 0.25)), 'socketB'),
    leaderTo(tag('L자 홈', v(-1.63, 1.4, 0.25)), 'slotRim'),
    leaderTo(tag('핀', v(-1.13, 2.07, 0.6)), 'pin'),
    leaderTo(tag('잘라 낸 창', v(1.46, 1.32, 0.25)), 'cutFaces'),
    leaderTo(tag('안내 고리', v(1.29, 2.39, 0.25)), 'guide')
  );

  let beta = 0;
  let h = 0;
  let tau = 0;
  const apply = (): void => {
    tau = ((t % 12) + 12) % 12;
    if (tau < 1.5) { beta = 0; h = 0; }
    else if (tau < 3) { beta = PSI_V * s((tau - 1.5) / 1.5); h = 0; }
    else if (tau < 5) { beta = PSI_V; h = H * s((tau - 3) / 2); }
    else if (tau < 6.5) { beta = PSI_V; h = H; }
    else if (tau < 8.5) { beta = PSI_V; h = H * (1 - s((tau - 6.5) / 2)); }
    else if (tau < 10) { beta = PSI_V * (1 - s((tau - 8.5) / 1.5)); h = 0; }
    else { beta = 0; h = 0; }
    rodA.rotation.y = beta + PH;
    rodA.position.y = h;
  };
  apply();

  return {
    group: g,
    view: { pos: [1.9, 2.55, 6.0], target: [0.0, 1.72, 0.25] },
    notes: () => [
      { label: '하는 일', value: (tau < 1.5 || tau >= 10) ? '잠김' : tau < 3 ? '돌려서 풂' : tau < 5 ? '빼냄' : tau < 6.5 ? '빠짐' : tau < 8.5 ? '끼움' : '돌려서 잠금' },
      { label: 'A 돌림', value: ((beta * 180) / Math.PI).toFixed(0) + '°' },
      { label: 'A 들림', value: h.toFixed(2) },
      { label: '원리', value: '핀이 가로 홈 끝에 걸려 위로 못 빠짐 → 돌려서 세로 홈에 맞추면 빠짐' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
