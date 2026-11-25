// 039 태양-유성 기어 (와트) — 연결봉에 붙은 유성 기어가 팔에 매달려 태양 기어 둘레를 돌면 태양 기어(플라이휠)는 2배로 돈다 (판화 39번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { castIron, darkSteel, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, stadiumShape, TAU } from '../../models/parts/geom';
import { displayStand, leaderTo, meshAngle, pulley, rotArrow, shaftZ, spurGear, tag, type V2 } from '../kit';

const NT = 20; // 태양·유성 잇수(같음)
const MOD = 0.04; // 피치 반지름 0.4
const RP = (NT * MOD) / 2;
const D = 2 * RP; // 팔 길이 = 두 피치 반지름의 합
const S: V2 = [-0.2, 1.55]; // 태양 기어(플라이휠 축) 중심 — 고정
const GZ = 0.13;
const ROD_L = 0.72; // 연결봉 길이
const PITCH = TAU / NT;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

export default function buildM039(): MovementModel {
  const g = new THREE.Group();
  let alpha = 0; // 팔 각(= 유성이 태양 둘레를 도는 각). 연결봉이 한 번 오르내릴 때 1회전
  let thS = 0;
  g.add(displayStand());

  // 태양 기어(구동 색) + 플라이휠(뒤쪽, 같은 축·같은 각)
  const sun = spurGear(NT, MOD, { width: 0.1, spokes: 4, driver: true });
  sun.position.set(S[0], S[1], GZ);
  const fly = pulley(0.64, { width: 0.06, spokes: 4, flat: true });
  fly.position.set(S[0], S[1], 0.03);
  g.add(sun, fly, shaftZ(S[0], S[1], 0.34, 0.05));

  // 유성 기어: 연결봉에 고정이라 절대 자세가 변하지 않는다
  const planet = spurGear(NT, MOD, { width: 0.1, spokes: 4 });
  planet.position.set(S[0] + D, S[1], GZ);
  g.add(planet);

  // 팔(태양 축 중심 회전) — 태양 축과 유성 축 사이 거리를 고정
  const arm = new THREE.Group();
  arm.position.set(S[0], S[1], 0);
  arm.add(at(extrude(stadiumShape(0, 0, D, 0, 0.05), 0.03, 0.006), steel(), 0, 0, 0.215));
  for (const x of [0, D]) {
    const cap = lathe(rodProfile(0.075, 0, 0.05, 0.01, 0.01), 32);
    cap.rotateX(Math.PI / 2);
    arm.add(at(cap, darkSteel(), x, 0, 0.215));
  }
  g.add(arm);

  // 연결봉: 유성 중심에서 위로, 회전하지 않고 평행이동만 한다
  const rodG = new THREE.Group();
  rodG.add(at(extrude(stadiumShape(0, 0, 0, ROD_L, 0.04), 0.03, 0.006), castIron(), 0, 0, 0.275));
  rodG.add(at(new THREE.TorusGeometry(0.045, 0.014, 12, 28), darkSteel(), 0, ROD_L, 0.275));
  const pin = lathe(rodProfile(0.04, 0, 0.26, 0.008, 0.008), 24);
  pin.rotateX(Math.PI / 2);
  rodG.add(at(pin, steel(), 0, 0, 0.06));
  g.add(rodG);

  const ar = rotArrow(0.55, true);
  ar.position.set(S[0], S[1], 0.4);
  g.add(ar);
  const tSun = tag('태양 기어', v(S[0] - 1.2, S[1] - 0.2, 0.4));
  const tPlanet = tag('유성 기어', v(0, 0, 0.4));
  const tRod = tag('연결봉', v(0, 0, 0.4));
  leaderTo(tSun, sun);
  leaderTo(tPlanet, planet);
  leaderTo(tRod, rodG);
  g.add(tSun, tPlanet, tRod);

  return {
    group: g,
    view: { pos: [0.8, 2.3, 6.2], target: [0, 1.75, 0] },
    notes: () => [
      { label: '식', value: 'ω태양 = ω팔 · (1 + z유성 / z태양) = 2 · ω팔' },
      { label: '공전 : 태양', value: '1 : 2' },
      { label: '태양 회전수', value: `${(thS / TAU).toFixed(2)}바퀴 (연결봉 ${(alpha / TAU).toFixed(2)}회)` }
    ],
    update(dt: number, speed: number): void {
      alpha += OMEGA * speed * dt;
      // 유성의 절대 자세 ε0 = 0 이려면 meshAngle 조건상 태양각 = 2α + π - 1.5·피치 (잇수가 같을 때)
      thS = 2 * alpha + Math.PI - 1.5 * PITCH;
      const px = S[0] + D * Math.cos(alpha);
      const py = S[1] + D * Math.sin(alpha);
      arm.rotation.z = alpha;
      sun.rotation.z = thS;
      fly.rotation.z = thS;
      planet.position.set(px, py, GZ);
      planet.rotation.z = meshAngle(S, NT, thS, [px, py], NT);
      rodG.position.set(px, py, 0);
      // 이름표는 움직이는 부품을 따라간다
      // 유성 이름표: 유성 옆(태양 반대쪽 가로) 조금 아래 — 위로 솟은 연결봉·눈을 가리지 않게
      tPlanet.position.set(px + (px >= S[0] - 1e-6 ? 0.75 : -0.75), py - 0.25, 0.4);
      tRod.position.set(px + 0.6, py + ROD_L - 0.1, 0.4);
    }
  };
}
