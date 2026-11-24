// 008 단차(계단) 풀리 변속 — 단차 풀리 2개가 위아래 서로 반대 장착, 벨트가 단을 옮겨 다니며 속도 변환 (판화 8번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, PILLOW_BOSS_Y, STAGE, displayStand, openBeltPath, pillow, rod, steppedPulley, tag } from '../kit';
import { castIron } from '../../models/materials';

const RU = [0.50, 0.38, 0.26]; // 위(구동) 풀리 단 반지름 — 단 0·1·2 (큰 단이 왼쪽)
const RL = [0.26, 0.38, 0.50]; // 아래(종동) 풀리 단 반지름 — 위와 반대 장착(큰 단이 오른쪽)
const XS = [-0.2, 0, 0.2]; // 단 i 의 벨트 x 위치
const YT = 2.5; // 구동축 높이
const YB = 1.0; // 종동축 높이
const Z0 = 0.25; // 축·벨트 면
const SX = 0.8; // 축 반길이 — 양끝 필로
const E = 0.01; // 벨트 두께 절반 — 접점은 표면 반지름 위에 둔다
const PERIOD = 9; // 전체 주기(초) — 단 0→1→2 각 3초
const STEP_T = 3; // 단 유지 시간
const TRANS = 0.4; // 단 바꾸는 데 걸리는 시간

const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 구간 완화 */
const smooth = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** x 위치의 YZ 평면 열린 벨트 경로: openBeltPath(z,y) → (x, y, z) */
function beltPath(x: number, ru: number, rl: number): THREE.Vector3[] {
  return openBeltPath([Z0, YT], ru + E, [Z0, YB], rl + E).map((p) => v3(x, p[1], p[0]));
}

/** X 방향 축 1개: 막대 + 양끝 필로(뒤판에서 나온 브래킷 상자 위) */
function shaftLine(g: THREE.Group, y: number): void {
  g.add(rod(v3(-SX, y, Z0), v3(SX, y, Z0), 0.04));
  for (const sx of [-1, 1]) {
    g.add(pillow(sx * SX, y - PILLOW_BOSS_Y, Z0, 'x'));
    const br = castIronBox();
    br.position.set(sx * SX, y - PILLOW_BOSS_Y - 0.08, (Z0 - 0.11 + STAGE.backZ) / 2);
    g.add(br);
  }
}

/** 뒤판에서 나온 브래킷 상자 */
function castIronBox(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, Z0 - 0.11 - STAGE.backZ), castIron());
  m.castShadow = true;
  return m;
}

export default function buildM008(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 구동축 누적 각
  let thetaD = 0; // 종동축 누적 각 — ∫ω·Ru/Rl dt (단이 바뀌어도 튀지 않게)
  let s = 0; // 벨트 누적 이동량 — 표시 흐름
  let T = 0; // 주기 시각 (|speed| 누적)
  let lastX = XS[0]!; // 벨트 경로의 마지막 x — 변할 때만 setPath
  let beltStep = 1; // notes: 현재 단(1~3)
  let ratio = RU[0]! / RL[0]!; // notes: 속도비(종동/구동)

  g.add(displayStand());
  shaftLine(g, YT);
  shaftLine(g, YB);

  // 단차 풀리: 회전축이 X — 위는 큰 단이 왼쪽(rotation.y=π/2), 아래는 반대(−π/2)
  const pTop = new THREE.Group();
  pTop.position.set(0, YT, Z0);
  const topInner = steppedPulley(RU, 0.2);
  topInner.rotation.y = Math.PI / 2;
  pTop.add(topInner);
  const pBot = new THREE.Group();
  pBot.position.set(0, YB, Z0);
  const botInner = steppedPulley(RU, 0.2);
  botInner.rotation.y = -Math.PI / 2;
  pBot.add(botInner);
  g.add(pTop, pBot);

  // 벨트: 단 0(x=−0.2)에서 시작, 단이 바뀔 때 경로 재생성
  const belt = new Belt(beltPath(XS[0]!, RU[0]!, RL[0]!), { width: 0.1, style: 'flat' });
  g.add(belt.group);

  g.add(tag('구동축', v3(-1.3, YT + 0.3, Z0 + 0.1)));
  g.add(tag('종동축', v3(1.3, YB - 0.3, Z0 + 0.1)));

  return {
    group: g,
    notes: () => [
      { label: '벨트 위치', value: `${beltStep}단` },
      { label: '속도비(종동/구동)', value: ratio.toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      T += Math.abs(speed) * dt;
      const p = T % PERIOD;
      const seg = Math.min(2, Math.floor(p / STEP_T));
      const u = p - seg * STEP_T;
      const nxt = (seg + 1) % 3;
      const inTrans = u > STEP_T - TRANS; // 단 바꾸는 구간
      const k = inTrans ? smooth((u - (STEP_T - TRANS)) / TRANS) : 0;
      beltStep = (inTrans ? nxt : seg) + 1;
      const x = XS[seg]! + (XS[nxt]! - XS[seg]!) * k;
      const ru = RU[seg]! + (RU[nxt]! - RU[seg]!) * k;
      const rl = RL[seg]! + (RL[nxt]! - RL[seg]!) * k;
      theta += OMEGA * speed * dt;
      thetaD += OMEGA * speed * (ru / rl) * dt; // 벨트 속도 보존: ωd·ru = ωl·rl
      s += OMEGA * speed * (ru + E) * dt;
      ratio = ru / rl;
      // 절대 자세 — 열린 벨트: 두 풀리 같은 방향(x축 음의 각, 010 규약)
      pTop.rotation.x = -theta;
      pBot.rotation.x = -thetaD;
      if (Math.abs(x - lastX) > 1e-9) {
        belt.setPath(beltPath(x, ru, rl));
        lastX = x;
      }
      belt.setOffset(s);
    }
  };
}
