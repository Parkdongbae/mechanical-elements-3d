// 278 오티스의 승강기 안전 정지 장치 — 줄이 팽팽하면 스프링이 눌려 폴이 래칫에서 떨어져 있고,
// 줄이 끊기면 스프링이 핀 b 를 밀어 내려 엘보 레버가 두 폴을 기둥의 톱니 윗면으로 밀어 승강대를 붙든다.
// 설계표 docs/mm507-sheets/278.md, 키트 kit/k278.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, markAnchor, tag } from '../kit';
import { K278, bolt278, lever278, leafSpring278, pawl278, rack278, state278 } from '../kit/k278';
import { brass, castIron, paint, steel, wood } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, shapeFrom, pathFrom, tubeProfile, type V2 } from '../../models/parts/geom';

const K = K278;
const D2R = Math.PI / 180;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material, name?: string): THREE.Mesh => {
  const m = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (name) m.name = name;
  return m;
};
/** y 방향 원기둥 */
const cylY = (r: number, y0: number, y1: number, mat: THREE.Material, name: string, seg = 28): THREE.Mesh => {
  const m = mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg), mat);
  m.position.y = (y0 + y1) / 2;
  m.name = name;
  return m;
};
/** z 방향 원기둥, 중심 (x, y) */
const cylZ = (r: number, z0: number, z1: number, x: number, y: number, mat: THREE.Material, name: string): THREE.Mesh => {
  const m = mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 24).rotateX(Math.PI / 2), mat);
  m.position.set(x, y, (z0 + z1) / 2);
  m.name = name;
  return m;
};
const rectPts = (x0: number, x1: number, y0: number, y1: number): V2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1]
];

export default function buildM278(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  const woodDark = wood(0x5a4028);
  const woodLight = wood(0x9a7448);
  const brassM = brass();
  const steelM = steel();
  const ironM = castIron();

  // ── 고정: 기둥 둘 + 위 가름대 + 줄 부시 + 래칫 둘 ──
  g.add(box(-1.75, -1.45, 0.18, 3.1, -0.14, 0.14, woodDark, 'uprightL'));
  g.add(box(1.45, 1.75, 0.18, 3.1, -0.14, 0.14, woodDark, 'uprightR'));
  {
    const sh = shapeFrom(rectPts(-1.75, 1.75, -0.14, 0.14));
    sh.holes.push(circlePath(0, 0, 0.0605));
    const beam = mesh(extrude(sh, 0.15, 0, 32).rotateX(-Math.PI / 2).translate(0, 3.175, 0), woodDark);
    beam.name = 'topBeam';
    g.add(beam);
    const bush = mesh(lathe(tubeProfile(0.03, 0.06, 3.06, 3.28), 32), brassM);
    bush.name = 'ropeBush';
    g.add(bush);
  }
  g.add(rack278(1), rack278(-1));

  // ── 승강대 B 묶음 ──
  const platform = new THREE.Group();
  platform.name = 'platform';
  g.add(platform);
  {
    const sh = shapeFrom(rectPts(-1.31, 1.31, -0.1, 0.1));
    sh.holes.push(circlePath(0, 0, 0.056));
    const top = mesh(extrude(sh, 0.3, 0, 32).rotateX(-Math.PI / 2).translate(0, 0.15, 0), woodLight);
    top.name = 'platformTop';
    platform.add(top);
  }
  for (const sd of [-1, 1]) {
    const [x0, x1] = sd < 0 ? [-1.31, -1.05] : [1.05, 1.31];
    const leg = new THREE.Group();
    leg.name = sd < 0 ? 'legL' : 'legR';
    leg.add(box(x0, x1, -0.887, 0, -0.17, 0.17, woodLight, leg.name + 'Up'));
    leg.add(box(x0, x1, -1.15, -0.973, -0.17, 0.17, woodLight, leg.name + 'Low'));
    leg.add(box(x0, x1, -0.973, -0.887, -0.17, -0.043, woodLight, leg.name + 'Web'));
    platform.add(leg);
    // 안내 신발 둘: 기둥 바깥·앞·뒤를 감싼 ㄷ 자
    const [s0, s1] = sd < 0 ? [-1.782, -1.31] : [1.31, 1.782];
    const [o0, o1] = sd < 0 ? [-1.782, -1.752] : [1.752, 1.782];
    (
      [
        ['1', -0.3, -0.1],
        ['2', -1.12, -1.0]
      ] as [string, number, number][]
    ).forEach(([n, y0, y1]) => {
      const shoe = new THREE.Group();
      shoe.name = (sd < 0 ? 'shoeL' : 'shoeR') + n;
      shoe.add(box(s0, s1, y0, y1, 0.142, 0.17, ironM, shoe.name + 'Front'));
      shoe.add(box(s0, s1, y0, y1, -0.17, -0.142, ironM, shoe.name + 'Back'));
      shoe.add(box(o0, o1, y0, y1, -0.17, 0.17, ironM, shoe.name + 'Out'));
      platform.add(shoe);
    });
    // 스프링 집게
    const [c0, c1] = sd < 0 ? [-0.8, -0.7] : [0.7, 0.8];
    platform.add(box(c0, c1, -0.05, 0, -0.05, 0.05, steelM, sd < 0 ? 'clipL' : 'clipR'));
  }
  platform.add(box(-1.05, 1.05, -1.15, -1.07, -0.17, 0.17, woodLight, 'floorB'));
  platform.add(box(-1.05, 1.05, -0.6, 0, -0.1, -0.06, woodLight, 'backPanel'));

  // ── 판 스프링 c (매 프레임 처짐이 바뀜) ──
  const spring = mesh(leafSpring278(0.04), steelM);
  spring.name = 'springC';
  platform.add(spring);
  let lastU = 0;

  // ── 핀 b 묶음 ──
  const pinGroup = new THREE.Group();
  pinGroup.name = 'pinGroup';
  platform.add(pinGroup);
  pinGroup.add(cylY(0.05, -0.1, 0.78, brassM, 'pinB'));
  {
    const eye = mesh(new THREE.TorusGeometry(0.07, 0.022, 12, 28), brassM);
    eye.position.y = 0.85;
    eye.name = 'eyeB';
    pinGroup.add(eye);
    const eyeTop = new THREE.Object3D();
    eyeTop.name = 'eyeTop';
    eyeTop.position.set(0, K.EYE_TOP, 0);
    markAnchor(eyeTop, [0, 0, 0]);
    pinGroup.add(eyeTop);
    const collar = mesh(lathe(tubeProfile(0.05, 0.12, -0.1, -0.08), 32), brassM);
    collar.name = 'collarB';
    pinGroup.add(collar);
    // 홈 덩이: 앞·뒤 판(가로 홈 뚫림) + 윗다리
    const block = new THREE.Group();
    block.name = 'blockB';
    for (const sz of [1, -1]) {
      const sh = shapeFrom(rectPts(-0.1, 0.1, -0.36, -0.13));
      sh.holes.push(pathFrom(rectPts(-0.09, 0.09, -0.328, -0.284)));
      const plate = mesh(extrude(sh, 0.025), brassM);
      plate.position.z = sz * 0.0375;
      plate.name = sz > 0 ? 'blockFront' : 'blockBack';
      block.add(plate);
    }
    block.add(box(-0.1, 0.1, -0.13, -0.1, -0.05, 0.05, brassM, 'blockTop'));
    pinGroup.add(block);
  }

  // ── 줄 a: 아래 토막(고리에 묶임) + 위 토막(부시를 지나 호이스트로) ──
  const ROPE_R = 0.022;
  const ropeMat = paint(0xc9b48a);
  const stub = mesh(new THREE.CylinderGeometry(ROPE_R, ROPE_R, K.STUB + 0.02, 16).translate(0, (K.STUB - 0.02) / 2, 0), ropeMat);
  stub.name = 'ropeStub';
  stub.position.set(0, K.EYE_TOP, 0);
  const ropeEnd = new THREE.Object3D();
  ropeEnd.name = 'ropeEnd';
  markAnchor(ropeEnd, [0, 0, 0]);
  stub.add(ropeEnd);
  const mkFray = (down: boolean): THREE.Group => {
    const f = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const cone = mesh(new THREE.ConeGeometry(0.012, 0.04, 8).translate(0, 0.02, 0), ropeMat);
      const ang = (i / 3) * Math.PI * 2;
      cone.rotation.set(Math.sin(ang) * 0.5, 0, Math.cos(ang) * 0.5);
      f.add(cone);
    }
    if (down) f.rotation.x = Math.PI;
    f.visible = false;
    return f;
  };
  const frayStub = mkFray(false);
  frayStub.position.y = K.STUB;
  stub.add(frayStub);
  pinGroup.add(stub);

  const ROPE_TOP = 3.28; // 위 끝 — 부시 위(호이스트는 판화 밖)
  const upper = mesh(new THREE.CylinderGeometry(ROPE_R, ROPE_R, 1, 16).translate(0, 0.5, 0), ropeMat);
  upper.name = 'ropeUpper';
  g.add(upper);
  const frayUp = mkFray(true);
  g.add(frayUp);

  // ── 엘보 레버 + 피벗 핀 + 끝 핀 ──
  const ia = K.A_I0 * D2R;
  const da = K.A_D0 * D2R;
  const Ix = K.ARM_I * Math.cos(ia);
  const Iy = K.ARM_I * Math.sin(ia);
  const Dx = K.ARM_D * Math.cos(da);
  const Dy = K.ARM_D * Math.sin(da);
  const levers: THREE.Group[] = [];
  const pawls: THREE.Group[] = [];
  for (const side of [1, -1] as const) {
    const lg = new THREE.Group();
    lg.name = side === 1 ? 'leverGroupL' : 'leverGroupR';
    lg.position.set(side * K.L[0], K.L[1], 0);
    lg.add(lever278(side));
    lg.add(cylZ(0.02, -0.05, 0.05, side * Ix, Iy, steelM, side === 1 ? 'pinIL' : 'pinIR'));
    lg.add(cylZ(0.02, -0.04, 0.04, side * Dx, Dy, steelM, side === 1 ? 'pinDL' : 'pinDR'));
    platform.add(lg);
    levers.push(lg);
    // 피벗 핀(뒤판에 박힘, 앞은 머리)
    const pv = new THREE.Group();
    pv.name = side === 1 ? 'pivotL' : 'pivotR';
    pv.position.set(side * K.L[0], K.L[1], 0);
    pv.add(cylZ(0.025, -0.07, 0.036, 0, 0, steelM, pv.name + 'Shaft'));
    pv.add(cylZ(0.04, 0.022, 0.04, 0, 0, steelM, pv.name + 'Head'));
    platform.add(pv);
    // 폴
    const pg = pawl278(side);
    platform.add(pg);
    pawls.push(pg);
  }

  // ── 표시: 위아래 화살표, 번개 ──
  const arrowMat = paint(0xd2352e);
  const arrow = new THREE.Group();
  arrow.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 12).translate(0, -0.075, 0), arrowMat));
  arrow.add(mesh(new THREE.ConeGeometry(0.05, 0.1, 16).translate(0, 0.05, 0), arrowMat));
  arrow.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  arrow.visible = false;
  g.add(arrow);
  const bolt = bolt278();
  bolt.position.set(0.12, K.ROPE_BREAK_Y, 0.1);
  bolt.layers.set(1);
  bolt.userData.noAO = true;
  bolt.visible = false;
  g.add(bolt);

  // ── 이름표 ──
  g.add(
    leaderTo(tag('줄 a', v(-0.75, 2.75, 0.4)), 'ropeUpper'),
    leaderTo(tag('핀 b', v(0.75, 2.75, 0.4)), 'pinB'),
    leaderTo(tag('기둥 A', v(-2.35, 2.75, 0.3)), 'uprightL'),
    leaderTo(tag('승강대 B', v(-2.3, 1.95, 0.3)), 'platformTop'),
    leaderTo(tag('스프링 c', v(-2.35, 1.15, 0.3)), 'springC'),
    leaderTo(tag('래칫(이)', v(2.3, 2.75, 0.3)), 'rackR'),
    leaderTo(tag('엘보 레버', v(2.3, 1.75, 0.3)), 'leverR'),
    leaderTo(tag('폴 d', v(2.35, 0.95, 0.3)), 'pawlR')
  );

  let st = state278(0);
  const apply = (): void => {
    st = state278(tm);
    platform.position.y = st.Y;
    pinGroup.position.y = -st.u;
    if (Math.abs(st.u - lastU) > 1e-7) {
      spring.geometry.dispose();
      spring.geometry = leafSpring278(0.04 + st.u);
      lastU = st.u;
    }
    levers[0]!.rotation.z = -st.theta;
    levers[1]!.rotation.z = st.theta;
    pawls[0]!.position.set(st.tipX, -0.97, 0);
    pawls[1]!.position.set(-st.tipX, -0.97, 0);
    // 줄 토막
    frayStub.visible = st.broken;
    frayUp.visible = st.broken;
    const len = Math.max(0.0001, ROPE_TOP - st.ropeHigh);
    upper.position.y = st.ropeHigh;
    upper.scale.y = len;
    frayUp.position.y = st.ropeHigh;
    bolt.visible = st.tc >= 6 && st.tc < 7;
    arrow.visible = st.dir !== 0;
    if (st.dir !== 0) {
      arrow.position.set(0.55, st.Y + 0.55, 0.25);
      arrow.rotation.z = st.dir > 0 ? 0 : Math.PI;
    }
  };
  apply();

  const stepLabel = (): string => {
    switch (st.phase) {
      case 'lift':
        return '끌어 올림';
      case 'down':
      case 'return':
        return '내림';
      case 'break':
        return '줄 끊김';
      case 'catch':
        return '걸림';
      default:
        return '다시 이음';
    }
  };

  return {
    group: g,
    notes: () => [
      { label: '단계', value: stepLabel() },
      { label: '줄', value: st.broken ? '끊김' : '팽팽함' },
      { label: '핀 b 가 내려간 양', value: st.u.toFixed(3) },
      {
        label: '폴',
        value: st.u < 0.001 ? '들어감' : st.u > K.U_MAX - 0.001 ? '톱니에 걸림' : st.tc >= 10 ? '들어가는 중' : '나가는 중'
      },
      { label: '원리', value: '줄 장력이 스프링을 눌러 폴을 당겨 두고, 줄이 끊기면 스프링이 핀을 밀어 레버가 폴을 톱니로 민다' }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [0, 1.8, 7.0], target: [0, 1.7, 0] }
  };
}
