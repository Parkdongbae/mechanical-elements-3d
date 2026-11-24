// 010 곡면 원뿔 풀리 — 009 와 같은 배치(축 X 방향, 벨트가 좌우로 이동하며 연속 변속),
// 풀리 옆선이 곧지 않고 곡선: 위 풀리는 볼록, 아래 풀리는 오목 (판화 10번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, PILLOW_BOSS_Y, STAGE, displayStand, openBeltPath, pillow, rod, tag, type V2 } from '../kit';
import { brass, bronze, castIron, darkSteel, paint } from '../../models/materials';
import { TAU, lathe, mesh, tubeProfile } from '../../models/parts/geom';

const R0 = 0.5; // 큰 쪽 반지름 (로컬 -X 끝)
const R1 = 0.22; // 작은 쪽 반지름 (로컬 +X 끝)
const LEN = 0.9; // 풀리 축방향 길이 — x ∈ [-0.45, 0.45]
const POW = 1.6; // 곡면 지수 — 설계표: 위 r(u)=r0+(r1−r0)·u^1.6, 아래 1−(1−u)^1.6
const XB = 0.35; // 벨트 이동 폭
const PERIOD = 10; // 벨트 이동 주기(초) — 009 과 같은 식
const YT = 2.5; // 구동축(위) 높이
const YB = 1.0; // 종동축(아래) 높이
const Z0 = 0.25; // 축·벨트 면
const SX = 0.8; // 축 반길이 — 양끝 필로
const E = 0.01; // 벨트 두께 절반 — 접점은 표면 반지름 위에 둔다

const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 옆선 계수 — t=0(-X, 큰 쪽)→t=1(+X). 위는 볼록(u^1.6), 아래는 오목(1−(1−u)^1.6) */
const facTop = (t: number): number => Math.pow(t, POW);
const facBot = (t: number): number => 1 - Math.pow(1 - t, POW);

/** 벨트 위치 x 의 표면 반지름 — 풀리와 같은 곡선식(직선 보간 대신) */
function surfAt(x: number): { ru: number; rl: number } {
  const u = (x + LEN / 2) / LEN;
  return { ru: R0 + (R1 - R0) * Math.pow(u, POW), rl: R1 + (R0 - R1) * Math.pow(u, POW) };
}

/** x 위치의 YZ 평면 열린 벨트(008 방식): openBeltPath(z,y) → (x, y, z) */
function beltPath(x: number): THREE.Vector3[] {
  const { ru, rl } = surfAt(x);
  return openBeltPath([Z0, YT], ru + E, [Z0, YB], rl + E).map((p) => v3(x, p[1], p[0]));
}

/** 곡선 원뿔 풀리 — 회전축 = 로컬 X, 큰 쪽(R0)이 -X. 키트 conePulley 와 같은 조립(림+허브+표시점).
 *  키트 curved 면은 선형+사인 불룩이라 설계표의 지수 프로파일·오목면을 낼 수 없어 모델 안에서 만든다 */
function makeCone(fac: (t: number) => number, driver: boolean): THREE.Group {
  const g = new THREE.Group();
  const bore = Math.max(0.024, Math.min(R0, R1) * 0.28);
  const c = 0.008;
  const n = 24;
  const prof: V2[] = [[bore, -LEN / 2], [R0 - c, -LEN / 2]];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    prof.push([R0 + (R1 - R0) * fac(t), -LEN / 2 + LEN * t]);
  }
  prof.push([R1 - c, LEN / 2], [bore, LEN / 2]);
  const bodyGeo = lathe(prof, 48);
  bodyGeo.rotateZ(-Math.PI / 2); // Y축 회전체 → X축 (R0 쪽이 -X)
  g.add(mesh(bodyGeo, driver ? bronze({ roughness: 0.34 }) : brass()));
  const hubGeo = lathe(tubeProfile(bore, bore + 0.03, -0.018, 0.018, 0.008), 32);
  hubGeo.rotateZ(-Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 표시점: +Y 표면의 밝은 점 — 회전이 보이게 (키트와 같은 자리)
  const tm = 0.12 / LEN + 0.5;
  const rm = R0 + (R1 - R0) * fac(tm);
  const mark = mesh(new THREE.BoxGeometry(0.024, 0.012, 0.05), paint(0xf2b619));
  mark.position.set(LEN * 0.12, rm + 0.007, 0);
  g.add(mark);
  return g;
}

export default function buildM010(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 구동축 누적 각
  let thetaD = 0; // 종동축 누적 각
  let s = 0; // 벨트 누적 이동량 — 표시 흐름
  let T = 0; // 벨트 이동 시각 (|speed| 누적)
  let ratio = 1; // 속도비(종동/구동)

  g.add(displayStand());

  // X 방향 축 2개 + 양끝 필로(뒤판에서 나온 브래킷 상자 위, 008 방식)
  for (const y of [YT, YB]) {
    g.add(rod(v3(-SX, y, Z0), v3(SX, y, Z0), 0.04));
    for (const sx of [-1, 1]) {
      g.add(pillow(sx * SX, y - PILLOW_BOSS_Y, Z0, 'x'));
      const br = mesh(new THREE.BoxGeometry(0.2, 0.16, Z0 - 0.11 - STAGE.backZ), castIron());
      br.position.set(sx * SX, y - PILLOW_BOSS_Y - 0.08, (Z0 - 0.11 + STAGE.backZ) / 2);
      g.add(br);
    }
  }

  // 풀리: 위(구동·볼록·큰 쪽 왼쪽) / 아래(종동·오목, 009 처럼 큰 쪽 오른쪽 — y π 로 장착)
  const pTop = makeCone(facTop, true);
  pTop.position.set(0, YT, Z0);
  const pWrap = new THREE.Group();
  pWrap.rotation.y = Math.PI;
  const pBot = makeCone(facBot, false);
  pWrap.add(pBot);
  pWrap.position.set(0, YB, Z0);
  g.add(pTop, pWrap);

  // 벨트: x 위치의 YZ 평면 열린 경로 — 이동할 때마다 같은 식의 반지름으로 setPath
  const belt = new Belt(beltPath(0), { width: 0.1, style: 'flat' });
  g.add(belt.group);

  g.add(tag('구동 원뿔 풀리', v3(-1.25, YT + 0.32, Z0 + 0.1)));
  g.add(tag('종동 원뿔 풀리', v3(1.25, YB - 0.32, Z0 + 0.1)));

  return {
    group: g,
    notes: () => [
      { label: '속도비(종동/구동)', value: ratio.toFixed(2) },
      { label: '풀리 모양', value: '곡면' }
    ],
    update(dt: number, speed: number): void {
      T += Math.abs(speed) * dt;
      const x = XB * Math.sin((TAU * T) / PERIOD); // 벨트 위치 — 009 과 같은 식
      const { ru, rl } = surfAt(x);
      theta += OMEGA * speed * dt;
      thetaD += OMEGA * speed * (ru / rl) * dt; // 벨트 속도 보존: ωd·ru = ωl·rl
      s += OMEGA * speed * (ru + E) * dt;
      ratio = ru / rl;
      // 절대 자세 계산 — 열린 벨트: 두 풀리 같은 방향. 벨트 흐름과 표면이 맞게 x 축 음의 각
      pTop.rotation.x = -theta;
      // 아래 풀리는 y π 로 뒤집혀 있어 로컬 부호가 반대 — 월드에선 위와 같은 방향
      pBot.rotation.x = thetaD;
      belt.setPath(beltPath(x));
      belt.setOffset(s);
    }
  };
}
