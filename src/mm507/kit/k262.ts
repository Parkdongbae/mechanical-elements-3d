// 262·263 편심 원뿔 전용 키트 — 상수·닫힌 상태식·부품·조립 (설계표 docs/mm507-sheets/262.md, 263 이 다시 내보내 쓴다)
// 나사 D 가 고정 너트 E 속에서 돌며 +X 로 나아가고, 나사 끝에 편심 e 로 붙은 원뿔 B 가 함께 돈다.
// 위에서 누름 추로 눌린 롤러 C 는 원뿔이 비켜 돌아 오르내리고, 닿는 굵기가 바뀌어 올라가는 거리와 내려가는 거리가 다르다.
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand } from './stand';
import { leaderTo, tag } from './misc';
import { pulley } from './pulley';
import { rod } from './shaft';
import { setMM } from './mm';
import { wormScrew } from './gear2';
import { pedestalX, wallBearing } from './gear6';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const PI = Math.PI;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export const K262 = {
  YS: 0.85, // 나사 축 높이
  ZS: 0.26, // 나사 축·롤러 깊이
  ECC: 0.09, // 원뿔 축이 나사 축보다 위로 비킨 거리
  R_BIG: 0.4, // 큰 끝 반지름
  R_SMALL: 0.22, // 작은 끝 반지름
  LEN: 1.2, // 원뿔 길이
  TAN: 0.15, // 겉면 기울기 tanα
  PITCH: 0.1, // 나사 피치
  X0: -1.3, // φ = 0 일 때 원뿔 큰 끝면 x
  XE: -0.45, // 롤러 왼쪽 모서리가 닿는 세계 x
  XR: -0.42, // 롤러 가운데 x
  R_ROLL: 0.14, // 롤러 반지름
  W_ROLL: 0.06, // 롤러 폭
  OMEGA: (10 * PI) / 15, // 나아가는 동안 나사 각속도 2.0944
  PERIOD: 32 // 왕복 한 주기
} as const;

/** 나사 각(라디안): 0~16 s 나아감(5바퀴), 16~32 s 거꾸로 되돌아옴 */
export function phi262(t: number): number {
  const P = K262.PERIOD;
  let u = ((t % P) + P) % P;
  if (u > P / 2) u = P - u;
  const w = K262.OMEGA;
  if (u < 1) return (w * u * u) / 2;
  if (u < 15) return w * (u - 0.5);
  return 10 * PI - (w * (16 - u) * (16 - u)) / 2;
}

export interface State262 {
  phi: number; // 나사·원뿔 각
  Xc: number; // 나사·원뿔 위치
  u: number; // 닿는 자리(큰 끝에서 잰 축 거리)
  R: number; // 닿는 자리 원뿔 반지름
  cy: number; // 그 단면 중심
  cz: number;
  Yr: number; // 롤러 중심 높이
  beta: number; // 롤러 쪽 접촉 방향
  thetaR: number; // 롤러 회전
  phase: 'forward' | 'back'; // 나아가는 중 / 되돌아오는 중
}

/** 닫힌 상태식 — 같은 t 면 항상 같은 자세 */
export function state262(t: number): State262 {
  const P = K262.PERIOD;
  const tc = ((t % P) + P) % P;
  const phi = phi262(t);
  const Xc = K262.X0 + (K262.PITCH * phi) / (2 * PI);
  const u = K262.XE - Xc;
  const R = K262.R_BIG - K262.TAN * u;
  const e = K262.ECC;
  const cy = K262.YS + e * Math.cos(phi);
  const cz = K262.ZS + e * Math.sin(phi);
  const Rr = R + K262.R_ROLL;
  const Yr = cy + Math.sqrt(Rr * Rr - e * e * Math.sin(phi) * Math.sin(phi));
  const beta = Math.atan2(K262.ZS - cz, Yr - cy);
  const k2 = (K262.TAN * K262.PITCH) / (2 * PI) / 2; // 0.0011937
  const thetaR = (Rr * beta - (K262.R_BIG - K262.TAN * (K262.XE - K262.X0)) * phi - k2 * phi * phi) / K262.R_ROLL;
  return { phi, Xc, u, R, cy, cz, Yr, beta, thetaR, phase: tc <= P / 2 ? 'forward' : 'back' };
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

/** 원뿔 묶음 — 원점 = 나사 축 위, 큰 끝면 평면(로컬 x = 0). 원뿔 축은 나사 축보다 ECC 위 */
export function eccCone262(): THREE.Group {
  const g = new THREE.Group();
  const e = K262.ECC;
  // 원뿔 몸: 겉면 R(a) = 0.40 − 0.15·a
  const body = mesh(
    lathe(
      [
        [0, 0],
        [0.392, 0],
        [0.4, 0.008],
        [0.2212, 1.192],
        [0.2132, 1.2],
        [0, 1.2]
      ],
      96
    ).rotateZ(-PI / 2),
    brass()
  );
  body.name = 'coneBody';
  body.position.set(0, e, 0);
  g.add(body);
  // 큰 끝 허브(나사 축 위) — 끝면 안으로 0.012 묻는다(같은 높이 면 방지)
  const hubL = mesh(lathe(tubeProfile(0.039, 0.075, -0.06, 0.012, 0.006), 36).rotateZ(-PI / 2), darkSteel());
  hubL.name = 'hubBig';
  g.add(hubL);
  // 축 끝: 허브 구멍을 채우고 원뿔 몸 속(+0.02)까지 들어간다
  const stub = mesh(lathe(rodProfile(0.04, -0.86, 0.02, 0.008, 0), 28).rotateZ(-PI / 2), steel());
  stub.name = 'stubD';
  g.add(stub);
  // 작은 끝 허브 — 끝면 안으로 0.01 묻는다
  const hubS = mesh(lathe(tubeProfile(0.027, 0.075, 1.19, 1.26, 0.006), 36).rotateZ(-PI / 2), darkSteel());
  hubS.name = 'hubSmall';
  g.add(hubS);
  // 작은 끝 허브 구멍을 채우는 짧은 촉(나사 코어 끝까지)
  const tenon = mesh(lathe(rodProfile(0.0265, 1.195, 1.27, 0, 0), 24).rotateZ(-PI / 2), steel());
  tenon.name = 'tenonSmall';
  g.add(tenon);
  // 끝면 표시(노랑) — 회전·편심이 보이게
  const markBig = mesh(new THREE.BoxGeometry(0.006, 0.02, 0.1), paint(0xf2b619));
  markBig.name = 'markBig';
  g.add(at(markBig, -0.003, e + 0.28, 0));
  const markSmall = mesh(new THREE.BoxGeometry(0.006, 0.02, 0.1), paint(0xf2b619));
  markSmall.name = 'markSmall';
  g.add(at(markSmall, 1.203, e + 0.15, 0));
  setMM(g, { kind: 'cam', fn: 'eccCone262', axis: 'x' });
  return g;
}

/** 나사 묶음 — 원점 = 큰 끝면과 같은 x 의 나사 축 위. 나사(1.26~2.27)·저널·손바퀴·손잡이 */
export function screw262(): THREE.Group {
  const g = new THREE.Group();
  const screw = wormScrew(0.028, 0.045, K262.PITCH, 1.01);
  screw.name = 'screwD';
  screw.position.x = 1.765;
  g.add(screw);
  const jour = mesh(lathe(rodProfile(0.029, 2.26, 2.35, 0, 0.004), 24).rotateZ(-PI / 2), steel());
  jour.name = 'journal';
  g.add(jour);
  const wheel = new THREE.Group();
  wheel.name = 'handWheel';
  wheel.rotation.y = PI / 2;
  wheel.position.x = 2.32;
  wheel.add(pulley(0.15, { flat: true, width: 0.04, spokes: 4, hub: 0.03, driver: true }));
  g.add(wheel);
  // 손잡이: 손바퀴 림(x 2.30~2.34)에 박아 단단히 잇는다
  const handle = rod(v(2.33, 0.12, 0), v(2.46, 0.12, 0), 0.018);
  handle.name = 'handle';
  g.add(handle);
  const knob = mesh(new THREE.SphereGeometry(0.028, 20, 14), steel());
  knob.name = 'knob';
  g.add(at(knob, 2.46, 0.12, 0));
  return g;
}

/** 롤러 묶음 — 원점 = 롤러 중심. 갈래·밀대·누름 추는 세로로만 움직인다 */
export function rollerC262(): { group: THREE.Group; roller: THREE.Object3D } {
  const g = new THREE.Group();
  // 롤러(왼쪽 면 x −0.03 은 모따기 없음 — 이 모서리가 원뿔에 닿는다)
  const roller = mesh(
    lathe(
      [
        [0.016, -0.03],
        [0.14, -0.03],
        [0.14, 0.026],
        [0.136, 0.03],
        [0.016, 0.03],
        [0.016, -0.03]
      ],
      64
    ).rotateZ(-PI / 2),
    steel()
  );
  roller.name = 'rollerC';
  const mark = mesh(new THREE.BoxGeometry(0.004, 0.02, 0.05), paint(0xf2b619));
  mark.name = 'markRoller';
  roller.add(at(mark, 0.032, 0.09, 0));
  g.add(roller);
  // 롤러 축(돌지 않음) + 끝 덮개(갈래 바깥면에 닿게)
  const axle = mesh(lathe(rodProfile(0.015, -0.058, 0.058, 0.002, 0.002), 20).rotateZ(-PI / 2), steel());
  axle.name = 'axleC';
  g.add(axle);
  for (const s of [-1, 1]) {
    const cap = mesh(
      lathe(rodProfile(0.022, s < 0 ? -0.062 : 0.047, s < 0 ? -0.047 : 0.062, 0.003, 0.003), 24).rotateZ(-PI / 2),
      steel()
    );
    cap.name = s < 0 ? 'capL' : 'capR';
    g.add(cap);
  }
  // 갈래: 옆판 둘(아래 끝 둥글게) + 윗판
  const fork = new THREE.Group();
  fork.name = 'forkC';
  const shape = new THREE.Shape();
  shape.moveTo(-0.03, 0.2);
  shape.lineTo(-0.03, 0);
  shape.absarc(0, 0, 0.03, PI, 2 * PI, false);
  shape.lineTo(0.03, 0.2);
  shape.closePath();
  for (const s of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false, curveSegments: 16 });
    geo.rotateY(PI / 2); // 압출 z → x, 모양 x → −z
    geo.translate(s < 0 ? -0.048 : 0.036, 0, 0);
    fork.add(mesh(geo, darkSteel()));
  }
  // 윗판은 옆판보다 사방 0.002 크게(같은 높이 면 방지)
  fork.add(at(mesh(new THREE.BoxGeometry(0.1, 0.04, 0.064), darkSteel()), 0, 0.2, 0));
  g.add(fork);
  // 밀대와 누름 추
  const plunger = mesh(lathe(rodProfile(0.025, 0.2, 0.96, 0, 0), 28), steel());
  plunger.name = 'plungerC';
  g.add(plunger);
  const wt = mesh(lathe(rodProfile(0.1, 0.95, 1.03, 0.01, 0.01), 40), darkSteel());
  wt.name = 'pressW';
  g.add(wt);
  const band = mesh(lathe(tubeProfile(0.0995, 0.102, 0.985, 0.995, 0.001), 40), paint(0xf2b619));
  band.name = 'bandW';
  g.add(band);
  return { group: g, roller };
}

export interface Ecc262Opts {
  /** 이름표 [글, 대상 name, 자리] 목록 */
  tags: [string, string, [number, number, number]][];
  view: { pos: [number, number, number]; target: [number, number, number] };
  memo: string;
}

/** 262·263 공통 조립 — 시점·이름표·모델 메모만 다르다 */
export function buildEcc262(o: Ecc262Opts): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  const coneB = eccCone262();
  coneB.name = 'coneB';
  const screwGroup = screw262();
  screwGroup.name = 'screwGroup';
  g.add(coneB, screwGroup);

  const nutE = pedestalX(0.7, K262.YS, K262.ZS, 1, 0.18, 0.048);
  nutE.name = 'nutE';
  const bearingL = pedestalX(-1.5, K262.YS, K262.ZS, -1, 0.18, 0.044);
  bearingL.name = 'bearingL';
  const guide = wallBearing(K262.XR, 1.89, K262.ZS, 'y', 0.028);
  guide.name = 'guideSleeve';
  g.add(nutE, bearingL, guide);

  const rc = rollerC262();
  const rollerBundle = rc.group;
  rollerBundle.name = 'rollerBundle';
  g.add(rollerBundle);

  for (const [text, target, p] of o.tags) g.add(leaderTo(tag(text, v(p[0], p[1], p[2])), target));

  // 직전 오름·내림 거리 — 롤러 높이의 마지막 두 꼭짓점을 시간을 거슬러 찾는다
  const lastSwing = (t: number): string => {
    const ys: number[] = [];
    for (let k = 0; k <= 160; k++) ys.push(state262(t - k * 0.05).Yr);
    const ext: number[] = [];
    for (let k = 1; k < ys.length - 1 && ext.length < 2; k++) {
      const a = ys[k]! - ys[k - 1]!;
      const b = ys[k + 1]! - ys[k]!;
      if ((a > 0 && b <= 0 && a !== 0) || (a < 0 && b >= 0)) ext.push(ys[k]!);
    }
    if (ext.length < 2) return '—';
    const d = ext[0]! - ext[1]!; // 시간 순으로 ext[1] → ext[0]
    return (d > 0 ? '직전 오름 ' : '직전 내림 ') + Math.abs(d).toFixed(3);
  };

  let st = state262(0);
  const apply = (): void => {
    st = state262(tm);
    coneB.position.set(st.Xc, K262.YS, K262.ZS);
    coneB.rotation.x = st.phi;
    screwGroup.position.set(st.Xc, K262.YS, K262.ZS);
    screwGroup.rotation.x = st.phi;
    rollerBundle.position.set(K262.XR, st.Yr, K262.ZS);
    rc.roller.rotation.x = st.thetaR;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '단계', value: st.phase === 'forward' ? '나아감(0~16 s)' : '되돌아옴(16~32 s)' },
      { label: '나사 D', value: (st.phi / (2 * PI)).toFixed(2) + ' 바퀴, 원뿔 위치 X_c ' + st.Xc.toFixed(3) },
      { label: '롤러 C 높이', value: st.Yr.toFixed(3) + ' (' + lastSwing(tm) + ')' },
      { label: '원리', value: '편심 원뿔이 돌며 나아가 롤러가 오르내리되 한쪽 거리가 짧다(나선 피치 = 나사 피치 0.10)' },
      { label: '모델 메모', value: o.memo }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: o.view
  };
}
