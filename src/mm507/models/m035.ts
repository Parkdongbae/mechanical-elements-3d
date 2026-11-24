// 035 슬롯 막대 달린 타원 기어 — 일정 속도의 작은 피니언이 홈 막대 위에서 타원 기어를 돌려, 타원 기어의 속도가 변한다 (판화 35번)
// 판화처럼 타원 기어의 축은 타원 한가운데, 스프링은 피니언 축받이와 막대 축 사이(당기는 스프링).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import {
  centreEllipsePitch,
  coilSpring,
  displayStand,
  ellipticalGear,
  pinionOnEllipse,
  rotArrow,
  shaftZ,
  spurGear,
  tag
} from '../kit';
import { castIron, darkSteel, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, stadiumShape, tubeProfile } from '../../models/parts/geom';

const A = 1.0; // 타원 긴반지름
const B = 0.61; // 짧은반지름
const NT = 38; // 타원 기어 잇수
const NP = 12; // 피니언 잇수
const PIT = centreEllipsePitch(A, B); // 판화처럼 축이 타원 한가운데
const P = PIT.L / NT; // 이 피치(호 길이)
const MOD = P / Math.PI;
const RP = (NP * P) / (Math.PI * 2); // 피니언 피치 반지름
const PIVOT: [number, number] = [0.15, 1.6]; // 타원 기어 축(가운데) + 막대 축
const BETA = (135 * Math.PI) / 180; // 막대 방향(고정)
const Z = 0.1; // 타원·피니언 중심 높이
const ZBAR = 0.215; // 막대 중심 높이
const BAR_LEN = 1.5;
const SLOT: [number, number] = [0.42, 1.4]; // 홈 구간(막대 위 거리). 피니언 축은 0.87~1.26 을 오간다
const ANCHOR = 0.5; // 스프링 고정 핀(축 쪽)
const W_P = OMEGA * 1.5; // 피니언 각속도(일정)

const ROLL = pinionOnEllipse(PIT, RP, NP, BETA);
// 처음 자세: 판화처럼 타원의 긴 축이 가로(θe = 0). θe(φ) = β − A(φ) 가 0 이 되는 접점 φ 를 이분법으로 찾는다
const X0 = ((): number => {
  let lo = 0.01;
  let hi = Math.PI - 0.01;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (ROLL.at(ROLL.xOfPhi(mid)).thetaE > 0) lo = mid;
    else hi = mid;
  }
  return ROLL.xOfPhi((lo + hi) / 2);
})();

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM035(): MovementModel {
  const g = new THREE.Group();
  let t = 0; // 구동 시간(속도 배율 반영)
  let omegaE = 0;

  g.add(displayStand());

  // 타원 기어: 가운데 = 축 = 로컬 원점
  const ell = ellipticalGear(PIT, NT, { width: 0.12, thick: 0.22 });
  ell.position.set(PIVOT[0], PIVOT[1], Z);
  g.add(ell, shaftZ(PIVOT[0], PIVOT[1], 0.36, 0.04));

  // 막대(홈 있는 판) — 축에서 BETA 방향, 로컬 +X 가 막대 방향, 로컬 z = 0 이 막대 중심 높이
  const bar = new THREE.Group();
  bar.position.set(PIVOT[0], PIVOT[1], ZBAR);
  bar.rotation.z = BETA;
  const plate = stadiumShape(0, 0, BAR_LEN, 0, 0.09);
  plate.holes.push(stadiumShape(SLOT[0], 0, SLOT[1], 0, 0.0375));
  bar.add(mesh(extrude(plate, 0.04, 0.006, 24), castIron({ roughness: 0.5 })));
  const hubGeo = lathe(tubeProfile(0.035, 0.115, -0.03, 0.03, 0.008), 40);
  hubGeo.rotateX(Math.PI / 2);
  bar.add(mesh(hubGeo, steel()));
  // 스프링 고정 핀: 홈의 축 쪽 끝(판화처럼 스프링은 피니언 축받이와 막대 축 사이에 있다)
  const pinGeo = lathe(rodProfile(0.022, -0.02, 0.1, 0.004, 0.004), 16);
  pinGeo.rotateX(Math.PI / 2);
  const anchor = mesh(pinGeo, darkSteel());
  anchor.position.set(ANCHOR, 0, 0);
  bar.add(anchor);
  // 피니언 축 슬라이더: 홈 속 블록 + 앞 플랜지 + 뒤로 뻗은 축
  const slider = new THREE.Group();
  slider.add(mesh(new THREE.BoxGeometry(0.12, 0.07, 0.04), steel()));
  const flange = mesh(new THREE.BoxGeometry(0.17, 0.12, 0.02), darkSteel());
  flange.position.z = 0.03;
  slider.add(flange);
  const axleGeo = lathe(rodProfile(0.028, -(ZBAR - Z) - 0.06, 0.04, 0.006, 0.006), 20);
  axleGeo.rotateX(Math.PI / 2);
  slider.add(mesh(axleGeo, steel()));
  const hookGeo = lathe(rodProfile(0.02, 0.03, 0.1, 0.004, 0.004), 16);
  hookGeo.rotateX(Math.PI / 2);
  const hook = mesh(hookGeo, darkSteel()); // 스프링 걸이(플랜지 안쪽 끝)
  hook.position.set(-0.07, 0, 0);
  slider.add(hook);
  bar.add(slider);
  // 스프링(인장): 고정 핀 ~ 슬라이더 안쪽 면. 피니언을 축 쪽으로 당겨 타원 기어에 붙여 둔다
  const spring = coilSpring(0.028, 0.007, 9);
  spring.position.set(ANCHOR, 0, 0.065);
  bar.add(spring);
  g.add(bar);

  // 피니언(막대 뒤, 타원과 같은 높이)
  const pinion = spurGear(NP, MOD, { width: 0.12, spokes: 0, driver: true });
  g.add(pinion);

  // 회전 화살표
  const ap = rotArrow(0.32, true);
  const ae = rotArrow(0.42, false);
  ae.position.set(PIVOT[0], PIVOT[1], 0.4);
  g.add(ap, ae);
  g.add(tag('타원 기어', v(1.6, 0.62, 0.3)), tag('홈 막대', v(-1.5, 2.9, 0.3)), tag('피니언(일정 속도)', v(-1.45, 1.75, 0.3)));

  const cb = Math.cos(BETA);
  const sb = Math.sin(BETA);

  return {
    group: g,
    notes: () => [
      { label: '잇수', value: `타원 ${NT} · 피니언 ${NP}` },
      { label: '피니언 속도', value: '일정' },
      { label: '타원 기어 각속도', value: `${Math.abs(omegaE).toFixed(2)} rad/s (주기적으로 변함)` }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      // 절대 각도: 피니언 자세 x 가 정해지면 접점·타원각·막대 위 위치가 모두 정해진다
      const x = X0 + W_P * t;
      const s = ROLL.at(x);
      ell.rotation.z = s.thetaE;
      pinion.position.set(PIVOT[0] + s.rho * cb, PIVOT[1] + s.rho * sb, Z);
      pinion.rotation.z = s.psi;
      ap.position.set(pinion.position.x, pinion.position.y, 0.34);
      slider.position.x = s.rho;
      // 스프링: 고정 핀에서 슬라이더 안쪽 끝까지(피니언이 멀어지면 늘어난다)
      spring.scale.x = Math.max(0.05, s.rho - 0.07 - ANCHOR);
      const h = 0.002;
      const dth = ROLL.at(x + h).thetaE - ROLL.at(x - h).thetaE;
      omegaE = (dth / (2 * h)) * W_P * speed;
    }
  };
}
