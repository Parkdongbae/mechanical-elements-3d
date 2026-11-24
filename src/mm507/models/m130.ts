// 130 쇠판 자르는 가위 — 편심 캠이 위 날의 긴 팔을 들어 날을 닫고, 긴 팔 무게로 다시 벌어진다 (판화 130번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { eccentricCam130, pivotPin130, shear130, shearBase130, shearLower130, shearUpper130 } from '../kit/k128';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const PX = 0.46; // 받침 핀 x
const PY = 1.62; // 받침 핀 y
const CAMX = -1.3; // 캠 축
const CAMY = 1.214;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM130(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 받침(고정)
  const base = shearBase130(0.7);
  base.name = 'base';
  base.position.set(PX, PY, 0.05);
  g.add(base);

  // 아래 날 + 기둥(고정)
  const lower = shearLower130(0.1);
  lower.name = 'lower';
  lower.position.set(PX, PY, 0.05);
  g.add(lower);

  // 위 날(지레)
  const upper = shearUpper130(0.1);
  upper.name = 'upper';
  upper.position.set(PX, PY, 0.15);
  g.add(upper);

  // 받침 핀
  const pivot = pivotPin130(0.26);
  pivot.name = 'pivot';
  pivot.position.set(PX, PY, 0.1);
  g.add(pivot);

  // 편심 캠(구동)
  const cam = eccentricCam130(0.1);
  cam.name = 'cam';
  cam.position.set(CAMX, CAMY, 0.15);
  g.add(cam);

  // 캠 축 — 뒤판 보스에서 캠 허브를 지나 앞으로
  g.add(shaftZ(CAMX, CAMY, 0.29, 0.055));

  // 회전 화살표(시계)
  const arrow = rotArrow(0.2, false);
  arrow.position.set(CAMX, CAMY, 0.3);
  g.add(arrow);

  const camTag = tag('편심 캠(구동)', v(-1.3, 0.38, 0.3));
  g.add(
    camTag,
    tag('위 날(긴 팔 무게로 벌어짐)', v(-0.7, 2.5, 0.3)),
    tag('아래 날(고정)', v(1.35, 1.15, 0.35)),
    tag('받침 핀', v(0.46, 2.65, 0.3))
  );

  const pose = (th: number): { psi: number; gamma: number; bladeDeg: number } => shear130(th);

  const apply = (): void => {
    const s = pose(theta);
    cam.rotation.z = s.psi;
    upper.rotation.z = s.gamma;
    // 캠 이름표는 원판 중심을 따라 아래에서 따라다닌다
    camTag.position.set(CAMX + 0.232 * Math.cos(s.psi), CAMY + 0.232 * Math.sin(s.psi) - 0.62, 0.3);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.4, 0.1] },
    notes: () => {
      const s = pose(theta);
      // psi 를 −90° ~ −270° 로 접어 닫히는 중인지 판단
      const k = ((((-s.psi / DEG) % 360) + 360) % 360); // 0~360, 90 에서 270 사이면 닫히는 중
      const closing = k >= 90 && k < 270;
      return [
        { label: '지금', value: closing ? '닫히는 중' : '벌어지는 중' },
        { label: '날 벌어진 각', value: `${s.bladeDeg.toFixed(0)}° (16.5° ~ 0.7°)` },
        { label: '긴 팔 : 날', value: '약 1.7 : 1 — 긴 팔 무게로 벌어진다' },
        { label: '캠 회전수', value: `한 바퀴 ${(TAU / OMEGA).toFixed(2)} s (약 15 rpm)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
