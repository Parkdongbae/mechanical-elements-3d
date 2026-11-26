// 203 굽은 홈 팔의 진동 — 굽은 홈 팔(J 모양)이 O1 둘레를 고르게(사인) 흔들면, 홈 속 핀이 곧은 팔(O2 둘레)을 밀어
// 곧은 팔의 흔들 빠르기가 6배 가까이 달라진다(판화 203번). 설계표 docs/mm507-sheets/203.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K203, dTheta1At203, pose203, slotArm203, straightArm203, theta1At203 } from '../kit/k203';
import { darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';

const K = K203;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;
const TAG_Z = 0.5;

export default function buildM203(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 굽은 홈 팔 + 흔들 손잡이(팔 그룹 안)
  const slotArm = slotArm203();
  slotArm.name = 'slotArm';
  const handle = new THREE.Group();
  handle.name = 'handle';
  const bar = mesh(new THREE.BoxGeometry(0.05, 0.38, 0.03), steel()); // 허브 가장자리(너트 바깥)에서 시작
  bar.position.set(0, -0.31, 0.255);
  handle.add(bar);
  const knobGeo = lathe(rodProfile(0.04, 0, 0.1, 0.008, 0.012), 24);
  knobGeo.rotateX(Math.PI / 2);
  const knob = mesh(knobGeo, paint(0xb8742a));
  knob.position.set(0, -0.5, 0.27);
  handle.add(knob);
  slotArm.add(handle);
  g.add(slotArm);

  // 굽은 팔 축(팔과 함께 흔들림) · 곧은 팔 고정 축
  const slotShaft = shaftZ(K.O1.x, K.O1.y, 0.27, 0.05);
  slotShaft.name = 'slotShaft';
  g.add(slotShaft);
  const armShaft = shaftZ(K.O2.x, K.O2.y, 0.14, 0.05);
  armShaft.name = 'armShaft';
  g.add(armShaft);

  // 곧은 팔 + 끝 핀(굴림대 + 앞 고리). 핀은 팔 그룹 로컬 (LS, 0) — 월드 위치는 팔 각에서 나온다
  const arm = straightArm203();
  arm.name = 'straightArm';
  const pin = new THREE.Group();
  pin.name = 'pin';
  pin.position.set(K.LS, 0, 0);
  const rollerGeo = lathe(rodProfile(0.08, 0, 0.115, 0.004, 0.004), 32);
  rollerGeo.rotateX(Math.PI / 2);
  const roller = mesh(rollerGeo, darkSteel());
  roller.position.z = 0.11;
  pin.add(roller);
  const ringGeo = lathe(rodProfile(0.12, 0, 0.02, 0.004, 0.004), 36);
  ringGeo.rotateX(Math.PI / 2);
  const ring = mesh(ringGeo, steel());
  ring.position.z = 0.225;
  pin.add(ring);
  arm.add(pin);
  g.add(arm);

  // 흔적 점: 노란 줄 = 핀, 흰 줄 = 굽은 팔 홈 오른쪽 끝 E_R
  const NT = 16;
  const trail = new THREE.Group();
  trail.name = 'trail';
  const dotGeo = new THREE.SphereGeometry(0.025, 14, 10);
  const yMat = paint(0xf2b619);
  const wMat = paint(0xf4f4f0);
  const yDots: THREE.Mesh[] = [];
  const wDots: THREE.Mesh[] = [];
  for (let i = 0; i < NT; i++) {
    const a = mesh(dotGeo, yMat);
    const b = mesh(dotGeo, wMat);
    a.position.z = b.position.z = -0.28;
    yDots.push(a);
    wDots.push(b);
    trail.add(a, b);
  }
  g.add(trail);
  const ER = v(K.XR, K.YE, 0);
  let lastK = NaN;
  const ks: number[] = new Array(NT).fill(0);
  const placeTrail = (): void => {
    const kmax = Math.floor(t / 0.5 + 1e-9);
    if (kmax !== lastK) {
      lastK = kmax;
      for (let i = 0; i < NT; i++) {
        const k = kmax - i;
        ks[i] = k;
        const th = theta1At203(0.5 * k);
        const p = pose203(th);
        yDots[i]!.position.set(p.pin.x, p.pin.y, -0.28);
        const dx = ER.x - K.O1.x;
        const dy = ER.y - K.O1.y;
        wDots[i]!.position.set(K.O1.x + Math.cos(th) * dx - Math.sin(th) * dy, K.O1.y + Math.sin(th) * dx + Math.cos(th) * dy, -0.28);
      }
    }
    for (let i = 0; i < NT; i++) {
      const age = Math.min(7.999, Math.max(0, t - 0.5 * ks[i]!));
      const sc = 1 - (0.52 * age) / 8; // 반지름 0.025 → 0.012
      yDots[i]!.scale.setScalar(sc);
      wDots[i]!.scale.setScalar(sc);
    }
  };

  // 화살표: 굽은 팔(O1 앞 z 0.30) · 곧은 팔(O2 앞 z 0.20)
  const a1c = rotArrow(0.3, true);
  const a1w = rotArrow(0.3, false);
  const a2c = rotArrow(0.3, true);
  const a2w = rotArrow(0.3, false);
  for (const a of [a1c, a1w]) a.position.set(K.O1.x, K.O1.y, 0.3);
  for (const a of [a2c, a2w]) a.position.set(K.O2.x, K.O2.y, 0.2);
  g.add(a1c, a1w, a2c, a2w);

  g.add(
    leaderTo(tag('굽은 홈 팔(규칙적으로 흔듦)', v(-1.55, 3.05, TAG_Z)), 'slotArm'),
    leaderTo(tag('굽은 홈', v(-2.0, 0.55, TAG_Z)), 'slotArm'),
    leaderTo(tag('핀', v(-0.35, 3.05, TAG_Z)), 'pin'),
    leaderTo(tag('곧은 팔(변하는 흔들림)', v(1.2, 3.05, TAG_Z)), 'straightArm'),
    leaderTo(tag('흔들 손잡이', v(-0.4, 0.4, TAG_Z)), 'handle')
  );

  let th1 = 0;
  let th2 = 0;
  let ratio = 0; // dθ2/dθ1
  let uNow = 0;
  let sgn = 1;
  const apply = (): void => {
    th1 = theta1At203(t);
    const p = pose203(th1);
    th2 = p.theta2;
    uNow = p.u;
    slotArm.rotation.z = th1;
    slotShaft.rotation.z = th1;
    arm.rotation.z = th2;
    const e = 1e-3;
    ratio = (pose203(th1 + e).theta2 - pose203(th1 - e).theta2) / (2 * e);
    const w1 = dTheta1At203(t) * sgn; // 속도 배율 부호 반영
    const w2 = ratio * w1;
    a1c.visible = w1 > 0;
    a1w.visible = w1 < 0;
    const show2 = Math.abs(w2) >= 0.01;
    a2c.visible = show2 && w2 > 0;
    a2w.visible = show2 && w2 < 0;
    placeTrail();
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '굽은 팔 각 θ1', value: `${(th1 * DEG).toFixed(1)}°` },
      { label: '곧은 팔 각 θ2', value: `${(th2 * DEG).toFixed(1)}°` },
      { label: '각속도 비 |dθ2/dθ1|', value: `${Math.abs(ratio).toFixed(2)} (범위 0.05 ~ 0.27)` },
      { label: '핀 위치', value: uNow < K.U1 ? `홈의 곧은 부분 (u = ${uNow.toFixed(2)} < 0.59)` : `홈의 굽은 부분 (u = ${uNow.toFixed(2)})` },
      { label: '원리', value: '같은 빠르기로 흔들어도 홈이 핀의 길과 이루는 각이 바뀌어 곧은 팔의 빠르기가 6배 가까이 달라진다' }
    ],
    update(dt: number, speed: number): void {
      if (speed !== 0) sgn = speed > 0 ? 1 : -1;
      t += dt * speed;
      apply();
    },
    view: { pos: [-0.2, 1.75, 6.4], target: [-0.2, 1.7, 0] }
  };
}
