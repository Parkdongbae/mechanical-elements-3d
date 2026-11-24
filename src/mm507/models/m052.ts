// 052 핀 원판 클러치 — 스터드 2개 달린 구동 원판과 구멍 2개 난 피동 원판. 시프터 손잡이를 들면 물려 함께 돈다 (판화 52번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, setMM, STAGE, tag } from '../kit';
import { clutchDisc } from '../kit/k051';
import { bronze, brass, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, roundedRect, stadiumShape, tubeProfile } from '../../models/parts/geom';

const YA = 1.95; // 축 높이
const ZC = 0.275; // 축 깊이 (원판 지름이 깊이로 나온다: 최대 반지름 0.5 → z −0.225~0.775)
const F_OFF = -0.38; // 떨어진 원판 위치
const F_NEAR = -0.6; // 스터드 끝 앞 대기
const F_ON = -0.77; // 물린 위치
const COLLAR_OFF = 0.56; // 깃 가운데 = f + 0.56
const P_Y = 1.125; // 레버 받침점 높이 (x = 0)
const L_ARM = 0.7; // 위쪽 팔 길이
const L_HANDLE = 0.9; // 손잡이 팔 길이
const HANDLE_ANG = (-16 * Math.PI) / 180;
const PI = Math.PI;
const TAU = Math.PI * 2;

const sstep = (u: number): number => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};
const g = (s: number): number => s - (s * s) / (4 * PI); // 감속(속도 1 → 0), g(2π)=π

interface ClutchState {
  f: number;
  alpha: number;
  phase: string;
  ratio: number;
  engaged: boolean;
}

/** 구동각 theta 하나로 원판 위치 f·피동각 α·상태를 절대 계산 (주기 4π) */
function clutchState(theta: number): ClutchState {
  let k = Math.floor((theta + PI) / (4 * PI));
  let p = theta + PI - 4 * PI * k;
  if (p < PI) {
    // 앞 주기의 관성 구간으로 본다
    p += 4 * PI;
    k -= 1;
  }
  const E = TAU * k;
  const e = 0.04;
  if (p < 1.5 * PI) return { f: F_OFF, alpha: E, phase: '떨어짐', ratio: 0, engaged: false };
  if (p < 1.9 * PI) {
    const f = F_OFF + (F_NEAR - F_OFF) * sstep((p - 1.5 * PI) / (0.4 * PI));
    return { f, alpha: E, phase: '붙이는 중', ratio: 0, engaged: false };
  }
  if (p < TAU - e) return { f: F_NEAR, alpha: E, phase: '붙이는 중', ratio: 0, engaged: false };
  if (p <= TAU + e) {
    const u = (p - (TAU - e)) / (2 * e);
    return { f: F_NEAR + (F_ON - F_NEAR) * sstep(u), alpha: E + e * sstep(u), phase: '스터드 들어감', ratio: 1, engaged: true };
  }
  if (p < 2.8 * PI) return { f: F_ON, alpha: E + (p - TAU), phase: '물림', ratio: 1, engaged: true };
  if (p < 3 * PI) {
    const f = F_ON + (F_OFF - F_ON) * sstep((p - 2.8 * PI) / (0.2 * PI));
    return { f, alpha: E + (p - TAU), phase: '떼는 중', ratio: 1, engaged: true };
  }
  const s = p - 3 * PI;
  return { f: F_OFF, alpha: E + PI + g(s), phase: '관성', ratio: Math.max(0, 1 - s / TAU), engaged: false };
}

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** X 축 방향 둥근 기둥(x0~x1, 반지름 r) — lathe 는 Y 축이라 눕힌다 */
function rodX(r: number, x0: number, x1: number, mat: THREE.Material, c0 = 0, c1 = 0): THREE.Mesh {
  const geo = lathe(rodProfile(r, x0, x1, c0, c1), 40);
  geo.rotateZ(-PI / 2);
  return mesh(geo, mat);
}

/** Z 축 방향 둥근 기둥(z0~z1, 반지름 r) */
function rodZ(r: number, z0: number, z1: number, mat: THREE.Material, c0 = 0, c1 = 0): THREE.Mesh {
  const geo = lathe(rodProfile(r, z0, z1, c0, c1), 28);
  geo.rotateX(PI / 2);
  return mesh(geo, mat);
}

/** 축 받침: 뒤판에서 나온 블록 + 축을 감싸는 링(축이 안에서 돈다). 원점 = (x, YA) */
function bearing(x: number, rIn: number, rOut: number, len: number, w: number): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, YA, 0);
  const ringGeo = lathe(tubeProfile(rIn, rOut, -len / 2, len / 2, 0.008), 36);
  ringGeo.rotateZ(-PI / 2);
  const ring = mesh(ringGeo, castIron());
  ring.position.z = ZC;
  grp.add(ring);
  const zEnd = ZC - rOut + 0.02;
  const depth = zEnd - STAGE.backZ;
  const block = mesh(extrude(roundedRect(-w / 2, -rOut, w / 2, rOut, 0.02), depth, 0.008), castIron());
  block.position.z = STAGE.backZ + depth / 2; // extrude 는 두께 가운데가 원점
  grp.add(block);
  return grp;
}

export default function buildM052(): MovementModel {
  const root = new THREE.Group();
  root.add(displayStand());
  let theta = 0;

  // ── 구동 슬리브: X 축 둘레 θ. 입력 축 토막 · 허브 블록 · 스터드 원판(청동)
  const driveDisc = new THREE.Group();
  driveDisc.name = 'driveDisc';
  driveDisc.position.set(0, YA, ZC);
  setMM(driveDisc, { kind: 'clutch', axis: 'x' });
  driveDisc.add(rodX(0.06, -1.58, -1.38, steel(), 0.01, 0));
  driveDisc.add(rodX(0.12, -1.38, -1.15, bronze({ roughness: 0.34 }), 0.012, 0));
  const keyMark = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), paint(0xf2b619));
  keyMark.position.set(-1.265, 0.122, 0);
  driveDisc.add(keyMark);
  const dDisc = clutchDisc(0.45, 0.16, { studs: { count: 2, radius: 0.36, r: 0.04, len: 0.17 }, hubR: 0.1, hubLen: 0.2, driver: true });
  dDisc.rotation.y = PI / 2; // 로컬 Z → 세계 +X
  dDisc.position.x = -0.95;
  driveDisc.add(dDisc);
  root.add(driveDisc);

  // ── 피동 축(강철, 각 α): 구동 슬리브 속을 지나 오른쪽 머리까지. 머리 = 둥근 끝 + 가운데 가로 홈
  const drivenShaft = new THREE.Group();
  drivenShaft.name = 'drivenShaft';
  drivenShaft.position.set(0, YA, ZC);
  setMM(drivenShaft, { kind: 'clutch', axis: 'x' });
  drivenShaft.add(rodX(0.045, -1.12, 1.1, steel()));
  for (const mx of [-0.52, 0.55]) {
    const mk = mesh(new THREE.BoxGeometry(0.04, 0.02, 0.02), paint(0xf2b619));
    mk.position.set(mx, 0.048, 0);
    drivenShaft.add(mk);
  }
  const headGeo = lathe(rodProfile(0.17, 1.09, 1.57, 0.06, 0.09), 48);
  headGeo.rotateZ(-PI / 2);
  drivenShaft.add(mesh(headGeo, steel()));
  const slot = mesh(new THREE.BoxGeometry(0.04, 0.36, 0.1), darkSteel());
  slot.position.set(1.33, 0, 0);
  drivenShaft.add(slot);
  const hmark = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), paint(0xf2b619));
  hmark.position.set(1.2, 0.172, 0);
  drivenShaft.add(hmark);
  root.add(drivenShaft);

  // ── 구멍 원판(황동, 각 α, x 로 미끄러짐): 원판 x ∈ [f, f+0.16], 허브는 +X 쪽
  const drivenDisc = new THREE.Group();
  drivenDisc.name = 'drivenDisc';
  setMM(drivenDisc, { kind: 'clutch', axis: 'x' });
  const hDisc = clutchDisc(0.5, 0.16, { holes: { count: 2, radius: 0.36, r: 0.07 }, hubR: 0.1, hubLen: 0.34 });
  hDisc.rotation.y = -PI / 2; // 로컬 Z → 세계 −X
  hDisc.position.x = 0.16;
  drivenDisc.add(hDisc);
  root.add(drivenDisc);

  // ── 깃(홈): 원판 허브 끝에 한 몸으로 이동. 홈 폭 0.1(±0.05) — 기운 팔(φ 최대 17.5°, 반폭 0.024)이 플랜지에 닿지 않게. 겉은 α 로 돌지만 이름 붙은 자리(홈 가운데)는 축 위에 서 있다
  const collar = new THREE.Group();
  collar.name = 'collar';
  setMM(collar, { kind: 'clutch', point: [0, -0.14, 0] }); // 핀이 앉는 홈 바닥(축 아래 0.125~0.157)
  const collarSpin = new THREE.Group();
  const collarGeo = lathe(
    [[0, -0.07], [0.19, -0.07], [0.19, -0.05], [0.1, -0.05], [0.1, 0.05], [0.19, 0.05], [0.19, 0.07], [0, 0.07]],
    48
  );
  collarGeo.rotateZ(-PI / 2);
  collarSpin.add(mesh(collarGeo, brass()));
  const cmark = mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), paint(0xf2b619));
  cmark.position.set(0.048, 0.19, 0);
  collarSpin.add(cmark);
  collar.add(collarSpin);
  root.add(collar);

  // ── 시프터 레버: 받침점 P = (0, P_Y), 위쪽 팔 끝 핀이 깃 홈에 걸리고 손잡이는 오른쪽 아래로 뻗는다
  const post = rodZ(0.05, 0, ZC - STAGE.backZ, castIron(), 0, 0.008);
  post.position.set(0, P_Y, STAGE.backZ);
  root.add(post);
  const shifter = new THREE.Group();
  shifter.name = 'shifter';
  shifter.position.set(0, P_Y, ZC);
  const armGeo = extrude(stadiumShape(0, 0, 0, L_ARM - 0.04, 0.024), 0.045, 0.008);
  const arm = mesh(armGeo, steel());
  arm.position.z = 0.0225; // extrude 는 두께 가운데가 원점 → z 0~0.045
  shifter.add(arm);
  const hx = Math.cos(HANDLE_ANG) * L_HANDLE;
  const hy = Math.sin(HANDLE_ANG) * L_HANDLE;
  const hArm = mesh(extrude(stadiumShape(0, 0, hx, hy, 0.028), 0.045, 0.008), steel());
  hArm.position.z = 0.0225;
  shifter.add(hArm);
  const pivot = rodZ(0.04, -0.01, 0.075, darkSteel(), 0.008, 0.008);
  shifter.add(pivot);
  const pin = rodZ(0.025, -0.04, 0.085, darkSteel(), 0.004, 0.004);
  pin.name = 'shifterPin';
  pin.position.set(0, L_ARM, 0);
  shifter.add(pin);
  const grip = rodZ(0.034, -0.05, 0.095, wood(), 0.01, 0.01);
  grip.position.set(hx, hy, 0);
  shifter.add(grip);
  root.add(shifter);

  // ── 베어링 기둥 2개(판화에 없는 보충)
  root.add(bearing(-1.26, 0.125, 0.17, 0.12, 0.12), bearing(0.8, 0.047, 0.09, 0.1, 0.1));

  // ── 회전 화살표(YZ 평면, +X 둘레 반시계): 구동 쪽은 늘, 피동 쪽은 물릴 때만 돈다
  const arrD = rotArrow(0.3, true);
  arrD.rotation.y = PI / 2;
  arrD.position.set(-1.26, YA, ZC);
  const arrP = rotArrow(0.3, true);
  arrP.rotation.y = PI / 2;
  arrP.position.set(1.33, YA, ZC);
  root.add(arrD, arrP);

  // ── 이름표: 구동·피동 원판은 위, 손잡이는 오른쪽 아래, 축은 오른쪽 위
  root.add(tag('구동 원판(스터드 2개)', v(-1.0, 2.62, 0.3)));
  const follow = new THREE.Group();
  follow.add(tag('피동 원판(구멍 2개, 미끄러짐)', v(0.1, 3.0, 0.3)));
  root.add(follow);
  root.add(tag('시프터 손잡이(들면 물림)', v(1.0, 0.5, 0.3)));
  root.add(tag('피동 축', v(0.85, 2.4, 0.3)));

  function apply(): ClutchState {
    const st = clutchState(theta);
    driveDisc.rotation.x = theta;
    drivenShaft.rotation.x = st.alpha;
    drivenDisc.position.set(st.f, YA, ZC);
    drivenDisc.rotation.x = st.alpha;
    const xc = st.f + COLLAR_OFF;
    collar.position.set(xc, YA, ZC);
    collarSpin.rotation.x = st.alpha;
    const phi = Math.asin(xc / L_ARM);
    shifter.rotation.z = -phi;
    follow.position.x = st.f;
    arrP.visible = st.engaged || st.ratio > 0;
    return st;
  }
  let state = apply();

  return {
    group: root,
    notes: () => [
      { label: '상태', value: state.phase },
      { label: '속도비(피동/구동)', value: state.ratio.toFixed(2) },
      { label: '원판 간격 f', value: `${state.f.toFixed(2)}` },
      { label: '구동 회전수', value: `${(theta / TAU).toFixed(2)} 바퀴` },
      { label: '피동 회전수', value: `${(state.alpha / TAU).toFixed(2)} 바퀴` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      state = apply();
    }
  };
}
