// 247 측연추 분리 장치 — 막대 밑 발이 바다 밑바닥에 닿아 밀려 오르면 걸쇠가 접혀 추(공)가 떨어지고, 막대는 추 없이 시료를 담아 올라온다
// 세로 단면(공·막대 아래 몸·밀대·컵·진흙·밑바닥은 뒤 반쪽만) — 설계표 docs/mm507-sheets/247.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, setMM, tag } from '../kit';
import { K247, ball247, catch247, catchPinGeo247, plunger247, rodLower247, spring247, state247 } from '../kit/k247';
import { extrude, lathe, mesh, rodProfile, shapeFrom } from '../../models/parts/geom';
import { darkSteel, glow, paint, steel, wood } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K247;
const EYE_TOP = 1.87; // 막대 아래 몸 밑면 기준 고리 위 끝
const BOAT_BOTTOM = 3.17;

export default function buildM247(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 바다(고정) + 수면 띠
  const water = mesh(new THREE.PlaneGeometry(3.2, 2.88), paint(0xa9d8f2));
  water.name = 'water';
  water.position.set(0, 1.74, -0.29);
  const surface = mesh(new THREE.BoxGeometry(3.2, 0.03, 0.01), paint(0x4f8fc0));
  surface.position.set(0, 3.165, -0.285);
  // 배가 닿는 수면 판(반투명 파랑, 배 바닥 y 3.17 아래로 0.01 잠김) — 바다 판에서 배 밑(z 0)까지
  const swMat = paint(0x6fb2de);
  swMat.transparent = true;
  swMat.opacity = 0.45;
  swMat.depthWrite = false;
  const surfaceWater = mesh(new THREE.BoxGeometry(3.2, 0.12, 0.29), swMat);
  surfaceWater.name = 'surfaceWater';
  surfaceWater.position.set(0, 3.12, -0.145);
  g.add(water, surface, surfaceWater);

  // 밑바닥(단면): 앞면(+z, 잘린 면)만 짙은 갈색
  const bedCut = paint(0x5e4630);
  const bedSide = paint(0x8b6b4a);
  const seabed = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.46), [bedSide, bedSide, bedSide, bedSide, bedCut, bedSide]);
  seabed.castShadow = true;
  seabed.receiveShadow = true;
  seabed.name = 'seabed';
  seabed.position.set(0, 0.24, -0.06);
  g.add(seabed);

  // 배(고정)
  const boatShape: [number, number][] = [[-0.45, 3.29], [0.45, 3.29], [0.35, 3.17], [-0.35, 3.17]];
  const boat = mesh(extrude(shapeFrom(boatShape), 0.44, 0.01), wood(0x7b5a3a));
  boat.name = 'boat';
  boat.position.z = K.ZC;
  boat.userData.outline = boatShape;
  g.add(boat);

  // 막대 그룹(위치 (0, Yr, 0.17))
  const rod = new THREE.Group();
  rod.name = 'rod';
  const rodLower = rodLower247();
  rodLower.name = 'rodLower';
  const rodUpper = mesh(lathe(rodProfile(K.ROD_R, 1.25, 1.79, 0, 0.02), 32), steel());
  rodUpper.name = 'rodUpper';
  const eye = mesh(new THREE.TorusGeometry(0.04, 0.012, 10, 24), steel());
  eye.name = 'rodEye';
  eye.position.set(0, 1.83, 0);
  const eyeStem = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 12), steel());
  eyeStem.position.set(0, 1.795, 0);
  const rodEyeTop = new THREE.Object3D();
  rodEyeTop.name = 'rodEyeTop';
  rodEyeTop.position.set(0, EYE_TOP, 0);
  rod.add(rodLower, rodUpper, eye, eyeStem, rodEyeTop);

  // 걸쇠 + 핀 + 판 스프링 + 밀대
  const catchM = catch247();
  catchM.name = 'catch';
  catchM.position.set(K.PIVOT[0], K.PIVOT[1], 0);
  const catchPin = mesh(catchPinGeo247(), darkSteel());
  catchPin.name = 'catchPin';
  catchPin.position.set(K.PIVOT[0], K.PIVOT[1], 0.005);
  const spring = mesh(spring247(0), steel());
  spring.name = 'spring';
  const plunger = plunger247();
  plunger.name = 'plunger';
  const sample = plunger.getObjectByName('sample') as THREE.Group;
  rod.add(catchM, catchPin, spring, plunger);
  rod.position.set(0, K.Y_TOP, K.ZC);
  g.add(rod);

  // 측연추 공(막대와 따로 움직임)
  const weight = ball247();
  weight.name = 'weight';
  g.add(weight);
  const weightMats: THREE.Material[] = [];
  weight.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m) weightMats.push(m);
  });
  const sampleMats: THREE.Material[] = [];
  sample.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m) sampleMats.push(m);
  });

  // 측심 줄: 고리 위 끝(rodEyeTop) → 배 밑. 아래 끝 lineEnd 는 고리 위 끝과 같은 변수에서 놓는다
  const line = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 12), paint(0xc9b48a));
  line.name = 'line';
  const lineEnd = new THREE.Object3D();
  lineEnd.name = 'lineEnd';
  g.add(line, lineEnd);

  // 위·아래 화살표(막대 옆)
  const makeArrow = (down: boolean): THREE.Group => {
    const a = new THREE.Group();
    const mat = glow(0xd8362f, 0.85);
    const shaft = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.17, 10), mat);
    shaft.position.y = -0.045;
    const head = mesh(new THREE.ConeGeometry(0.04, 0.08, 14), mat);
    head.position.y = 0.085;
    a.add(shaft, head);
    if (down) a.rotation.z = Math.PI;
    a.traverse((o) => {
      o.layers.set(1);
      o.userData.noAO = true;
    });
    setMM(a, { kind: 'arrow', r: 0, ccw: false });
    return a;
  };
  const arrowDown = makeArrow(true);
  arrowDown.name = 'arrowDown';
  const arrowUp = makeArrow(false);
  arrowUp.name = 'arrowUp';
  g.add(arrowDown, arrowUp);

  // 이름표 8개(z 0.6): 줄·추는 고정, 막대에 붙은 것은 Yr 를 따라간다
  const Z = 0.6;
  const tFoot = leaderTo(tag('발·시료 컵', v(-1.15, 0, Z)), 'foot');
  const tRod = leaderTo(tag('측심 막대', v(1.1, 0, Z)), 'rodUpper');
  const tSpring = leaderTo(tag('판 스프링', v(1.15, 0, Z)), 'spring');
  const tCatch = leaderTo(tag('걸쇠', v(1.0, 0, Z)), 'catch');
  const tPlunger = leaderTo(tag('밀대', v(1.0, 0, Z)), 'plunger');
  g.add(
    leaderTo(tag('측심 줄(배로)', v(-1.05, 2.95, Z)), 'line'),
    leaderTo(tag('측연추(공)', v(-1.25, 2.35, Z)), 'weight'),
    tFoot,
    tRod,
    tSpring,
    tCatch,
    tPlunger,
    leaderTo(tag('바다 밑바닥', v(1.2, 0.24, Z)), 'seabed')
  );

  let st = state247(0);
  const phaseText: Record<string, string> = {
    내려감: '내려감',
    '바닥에 닿음': '바닥에 닿음',
    '걸쇠 빠짐': '걸쇠 빠짐',
    '추 떨어짐': '추 떨어짐',
    '시료 들고 올라옴': '시료 들고 올라옴',
    다시: '다시'
  };
  let lastDelta = -1;
  const apply = (): void => {
    st = state247(t);
    const { Yr, s, delta } = st;
    rod.position.y = Yr;
    catchM.rotation.z = (-delta * Math.PI) / 180;
    plunger.position.set(-0.025, s, 0);
    if (Math.abs(delta - lastDelta) > 1e-4) {
      spring.geometry.dispose();
      spring.geometry = spring247(delta);
      lastDelta = delta;
    }
    // 공
    weight.position.set(0, st.ballY, K.ZC);
    for (const m of weightMats) m.opacity = st.ballOpacity;
    weight.visible = st.ballOpacity > 0.003;
    // 진흙
    sample.visible = st.mud > 0.0005;
    sample.scale.y = Math.max(st.mud, 1e-4);
    for (const m of sampleMats) m.opacity = st.mudOpacity;
    // 줄: 고리 위 끝 ~ 배 밑
    const yEye = Yr + EYE_TOP;
    lineEnd.position.set(0, yEye, K.ZC);
    line.position.set(0, (yEye + BOAT_BOTTOM) / 2, K.ZC);
    line.scale.y = BOAT_BOTTOM - yEye;
    // 화살표: 내려갈 때 아래, 올라갈 때 위
    const tc = st.tc;
    const down = tc < 5.2;
    const up = tc >= 7 && tc < 11;
    arrowDown.visible = down;
    arrowUp.visible = up;
    arrowDown.position.set(0.3, Yr + 1.6, 0.4);
    arrowUp.position.set(0.3, Yr + 1.6, 0.4);
    // 이름표(막대 따라감)
    tFoot.position.y = Yr + 0.03;
    tRod.position.y = Yr + 1.45;
    tSpring.position.y = Yr + 1.0;
    tCatch.position.y = Yr + 0.55;
    tPlunger.position.y = Yr + 0.12;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.3, 1.8, 5.7], target: [0.0, 1.62, 0] },
    notes: () => [
      { label: '단계', value: phaseText[st.phase] ?? st.phase },
      { label: '밀대가 막대에 대해 오른 높이', value: st.s.toFixed(3) },
      { label: '걸쇠 각', value: st.delta.toFixed(1) + '°' },
      { label: '추', value: st.tc < 5.2 || st.tc >= 12 ? '걸쇠 위' : st.tc < 5.7 ? '떨어지는 중' : '바닥에 남음' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}

