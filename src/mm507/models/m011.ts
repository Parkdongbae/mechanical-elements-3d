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

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 드럼 위 벨트 점(φ: 0 = 앞, π/2 = 위, π = 뒤) */
const drumPt = (ph: number): THREE.Vector3 => v(BX, DY + RD * Math.sin(ph), DZ + RD * Math.cos(ph));
/** 풀리 위 벨트 점(ψ: 0 = 오른쪽, −π/2 = 아래, −π = 왼쪽) */
const pulPt = (ps: number): THREE.Vector3 => v(PX + RP * Math.cos(ps), PY + RP * Math.sin(ps), DZ);

/** 두 가닥이 드럼·풀리 양쪽에 정확히 접하는 접점.
 *  왼쪽 가닥: 풀리 왼쪽 점(ψ = −π, x = BX)에서 드럼 원(YZ 면)에 그은 접선 → 드럼 앞쪽 φ0(조금 아래).
 *  오른쪽 가닥: 직선 L = P(ψ1) − D(φ1) 이 드럼 법선 (0, sinφ, cosφ)·풀리 법선 (cosψ, sinψ, 0) 모두와 직교.
 *  예전에는 가닥을 풀리 오른쪽 끝(ψ = 0)에 비스듬히 꽂아 끝 0.2 가량이 림 속에 묻혔다(“중간에 안 보임”). */
function tangents(): { phi0: number; phi1: number; psi1: number } {
  const phi0 = -Math.asin(RD / (DY - PY));
  let psi1 = 0;
  let phi1 = Math.PI;
  const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
  for (let k = 0; k < 40; k++) {
    phi1 = Math.PI - Math.asin(RD / (PY + RP * Math.sin(psi1) - DY)); // 드럼 접선 조건
    const A = PX - BX;
    const B = PY - DY - RD * Math.sin(phi1);
    const d = Math.atan2(B, A);
    const c = Math.acos(-RP / Math.hypot(A, B)); // 풀리 접선 조건 A cosψ + B sinψ = −RP
    const r1 = wrap(d + c);
    const r2 = wrap(d - c);
    psi1 = Math.abs(r1) < Math.abs(r2) ? r1 : r2; // 오른쪽 가까운 근(≈ +24°)
  }
  return { phi0, phi1, psi1 };
}

/** 벨트 중심선(닫힌 점열)과 점마다 띠 폭 방향.
 *  ①드럼 위 호(앞 φ0 → 위 → 뒤 φ1) → ②오른쪽 가닥 ↓ → ③풀리 아래 호(ψ1 → 아래 → −π) → ④왼쪽 가닥 ↑.
 *  폭 방향: ① 드럼 축 X, ③ 풀리 축 Z, ②·④ 는 선형 보간 뒤 접선 성분을 빼고 정규화 — 1/4 비틀림 */
function beltPath(): { pts: THREE.Vector3[]; dirs: THREE.Vector3[] } {
  const { phi0, phi1, psi1 } = tangents();
  const pts: THREE.Vector3[] = [];
  const raw: THREE.Vector3[] = [];
  const N = 24;
  const S = 10;
  for (let i = 0; i <= N; i++) {
    pts.push(drumPt(phi0 + ((phi1 - phi0) * i) / N));
    raw.push(v(1, 0, 0));
  }
  const d1 = drumPt(phi1);
  const p1 = pulPt(psi1);
  for (let i = 1; i <= S; i++) {
    const t = i / (S + 1);
    pts.push(d1.clone().lerp(p1, t));
    raw.push(v(1 - t, 0, t));
  }
  for (let i = 0; i <= N; i++) {
    pts.push(pulPt(psi1 + ((-Math.PI - psi1) * i) / N)); // 접점 ψ1·왼쪽 끝 −π 포함
    raw.push(v(0, 0, 1));
  }
  const p0 = pulPt(-Math.PI);
  const d0 = drumPt(phi0);
  for (let i = 1; i <= S; i++) {
    const t = i / (S + 1);
    pts.push(p0.clone().lerp(d0, t));
    raw.push(v(t, 0, 1 - t));
  }
  const dirs = raw.map((w, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length]!;
    const next = pts[(i + 1) % pts.length]!;
    const T = next.clone().sub(prev).normalize();
    return w.addScaledVector(T, -w.dot(T)).normalize();
  });
  return { pts, dirs };
}

export default function buildM011(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 드럼 D(구동, bronze): 회전축 X — 감싸는 그룹에 rotation.y = π/2 (로컬 Z → 월드 X)
  const drumPivot = new THREE.Group();
  drumPivot.position.set(BX, DY, DZ); // 벨트가 드럼 가운데에 걸리게 드럼 중심 = 벨트 x
  drumPivot.rotation.y = Math.PI / 2;
  const drum = pulley(0.36, { width: 0.72, spokes: 4, driver: true, flat: true }); // 평벨트용 납작 림
  drumPivot.add(drum);
  g.add(drumPivot);

  // 드럼 축(양 끝이 드럼 밖으로 0.2 삐죽) + 필로 받침
  g.add(rod(v(BX - 0.56, DY, DZ), v(BX + 0.56, DY, DZ), 0.04));
  const pilY = DY - PILLOW_BOSS_Y; // 필로 원점 = 축에서 보스 높이만큼 아래
  for (const sx of [-1, 1]) {
    // 뒤판에서 돌출한 브래킷 팔이 필로를 받친다(기둥은 오른쪽 가닥과 부딪친다)
    const arm = mesh(new THREE.BoxGeometry(0.14, 0.09, 0.7), castIron());
    arm.position.set(BX + sx * 0.46, pilY - 0.045, 0.01);
    g.add(arm);
    g.add(pillow(BX + sx * 0.46, pilY, DZ, 'x'));
  }

  // 풀리 P(종동, brass): 회전축 Z
  const pul = pulley(0.4, { spokes: 4, flat: true }); // 평벨트용 납작 림
  pul.position.set(PX, PY, DZ);
  g.add(pul, shaftZ(PX, PY));

  // 비틀린 평벨트(3D 점열 + 점마다 폭 방향)
  const bp = beltPath();
  const belt = new Belt(bp.pts, { width: 0.12, thickness: 0.02, style: 'flat', widthDirs: bp.dirs });
  g.add(belt.group);

  // 회전 방향 화살표: 드럼(오른쪽에서 시계, YZ 평면에 눕힘)·풀리(정면 시계)
  const arrowD = rotArrow(0.45, false);
  arrowD.position.set(BX + 0.7, DY, DZ);
  arrowD.rotation.y = Math.PI / 2;
  const arrowP = rotArrow(0.55, false);
  arrowP.position.set(PX, PY, DZ + 0.09);
  g.add(arrowD, arrowP);

  // 이름표
  g.add(tag('구동 드럼', v(BX + 0.95, 3.1, 0.35)));
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
