// 011 안내 풀리 없는 직각 전동 — X축 드럼에서 Z축 풀리로, 1/4 비틀린 평벨트 (판화 11번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, PILLOW_BOSS_Y, displayStand, pillow, pulley, rod, rotArrow, shaftZ, tag } from '../kit';
import { castIron } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const DY = 2.7; // 드럼 중심 높이
const DZ = 0.25; // 드럼·풀리·벨트 면
const RD = 0.37; // 벨트가 드럼을 감는 반지름(드럼 r 0.36 + 띠 두께 절반)
const RP = 0.41; // 벨트가 풀리를 감는 반지름(풀리 r 0.40 + 0.01)
const BX = -0.26; // 드럼 위 벨트 x 위치(드럼 왼쪽 = 풀리 왼쪽 접점 x)
const PX = 0.15; // 풀리 중심 x
const PY = 0.72; // 풀리 중심 y
const PXE = PX + RP; // 풀리 오른쪽 접점 x
const PXL = PX - RP; // 풀리 왼쪽 접점 x = BX

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 벨트 중심선(닫힌 점열): ①드럼 위 반원 → ②오른쪽 가닥 ↓ → ③풀리 아래 반원 → ④왼쪽 가닥 ↑ */
function beltPath(): THREE.Vector3[] {
  const p: THREE.Vector3[] = [];
  // ① 드럼 위 반원(24 구간): 앞(z 0.62) → 위 → 뒤(z −0.12)
  for (let i = 0; i <= 24; i++) {
    const ph = (Math.PI * i) / 24;
    p.push(v(BX, DY + RD * Math.sin(ph), DZ + RD * Math.cos(ph)));
  }
  // ② 오른쪽 가닥: 드럼 뒤 끝 → 풀리 오른쪽 접점, 균등 10점(양 끝 제외)
  for (let i = 1; i <= 10; i++) {
    const t = i / 11;
    p.push(v(BX + (PXE - BX) * t, DY + (PY - DY) * t, DZ - RD + RD * t));
  }
  // ③ 풀리 아래 반원(24 구간): 오른쪽 → 아래 → 왼쪽
  for (let i = 1; i <= 24; i++) {
    const ps = (-Math.PI * i) / 24;
    p.push(v(PX + RP * Math.cos(ps), PY + RP * Math.sin(ps), DZ));
  }
  // ④ 왼쪽 가닥: 풀리 왼쪽 접점 → 드럼 앞 끝, 균등 10점(양 끝 제외)
  for (let i = 1; i <= 10; i++) {
    const t = i / 11;
    p.push(v(PXL, PY + (DY - PY) * t, DZ + RD * t));
  }
  return p;
}

/** 점마다 띠 폭 방향: ①·③은 각 축 방향, ②·④는 선형 보간 뒤 접선 성분을 빼고 정규화(그램-슈미트) — 1/4 비틀림 */
function beltWidthDirs(pts: THREE.Vector3[]): THREE.Vector3[] {
  const raw: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) raw.push(v(1, 0, 0)); // ① 드럼 축(X)
  for (let i = 1; i <= 10; i++) raw.push(v(1 - i / 11, 0, i / 11)); // ② X → Z
  for (let i = 1; i <= 24; i++) raw.push(v(0, 0, 1)); // ③ 풀리 축(Z)
  for (let i = 1; i <= 10; i++) raw.push(v(i / 11, 0, 1 - i / 11)); // ④ Z → X
  return raw.map((w, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length]!;
    const next = pts[(i + 1) % pts.length]!;
    const T = next.clone().sub(prev).normalize();
    return w.addScaledVector(T, -w.dot(T)).normalize();
  });
}

export default function buildM011(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 드럼 D(구동, bronze): 회전축 X — 감싸는 그룹에 rotation.y = π/2 (로컬 Z → 월드 X)
  const drumPivot = new THREE.Group();
  drumPivot.position.set(0, DY, DZ);
  drumPivot.rotation.y = Math.PI / 2;
  const drum = pulley(0.36, { width: 0.72, spokes: 4, driver: true });
  drumPivot.add(drum);
  g.add(drumPivot);

  // 드럼 축(양 끝이 드럼 밖으로 0.2 삐죽) + 필로 받침
  g.add(rod(v(-0.56, DY, DZ), v(0.56, DY, DZ), 0.04));
  const pilY = DY - PILLOW_BOSS_Y; // 필로 원점 = 축에서 보스 높이만큼 아래
  for (const sx of [-1, 1]) {
    // 뒤판에서 돌출한 브래킷 팔이 필로를 받친다(기둥은 오른쪽 가닥과 부딪친다)
    const arm = mesh(new THREE.BoxGeometry(0.14, 0.09, 0.7), castIron());
    arm.position.set(sx * 0.46, pilY - 0.045, 0.01);
    g.add(arm);
    g.add(pillow(sx * 0.46, pilY, DZ, 'x'));
  }

  // 풀리 P(종동, brass): 회전축 Z
  const pul = pulley(0.4, { spokes: 4 });
  pul.position.set(PX, PY, DZ);
  g.add(pul, shaftZ(PX, PY));

  // 비틀린 평벨트(3D 점열 + 점마다 폭 방향)
  const path = beltPath();
  const belt = new Belt(path, { width: 0.12, thickness: 0.02, style: 'flat', widthDirs: beltWidthDirs(path) });
  g.add(belt.group);

  // 회전 방향 화살표: 드럼(오른쪽에서 시계, YZ 평면에 눕힘)·풀리(정면 시계)
  const arrowD = rotArrow(0.45, false);
  arrowD.position.set(0.7, DY, DZ);
  arrowD.rotation.y = Math.PI / 2;
  const arrowP = rotArrow(0.55, false);
  arrowP.position.set(PX, PY, DZ + 0.09);
  g.add(arrowD, arrowP);

  // 이름표
  g.add(tag('구동 드럼', v(0.95, 3.1, 0.35)));
  g.add(tag('종동 풀리', v(1.15, 0.92, 0.35)));
  g.add(tag('비틀린 벨트', v(0.62, 1.71, 0.35)));

  return {
    group: g,
    notes: () => [
      { label: '축의 관계', value: '직각 (안내 풀리 없음)' },
      { label: '벨트', value: '1/4 비틀림' },
      { label: '속도비(드럼 : 풀리)', value: '1 : ' + (RD / RP).toFixed(2) }
    ],
    view: { pos: [1.4, 2.1, 5.6], target: [0, 1.7, 0] },
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      drum.rotation.z = -theta; // 위쪽 벨트가 앞 → 뒤로 흐른다(월드 +X 회전은 맨 위를 +Z 로 보내므로 −)
      pul.rotation.z = (-theta * RD) / RP; // 시계 방향, 벨트 속도 일치
      belt.setOffset(theta * RD); // 표시가 진행 방향(①→②→③→④)으로 흐른다
    }
  };
}
