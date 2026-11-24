// 054 맹글 스타 휠 — 살 바퀴(테 두 겹 사이 방사 살 36칸)와 옆면 피니언 B (판화 54번 · 설계표 추천안 (가))
// 피니언은 바퀴 축과 직각인 반지름 방향 축으로 살 띠의 앞면·뒷면을 번갈아 물고, 늘 같은 방향으로 도는 데서
// 물리는 면이 바뀔 때마다 바퀴가 반대로 돈다. 틈 A(살 4칸)가 피니언 자리(270°)에 올 때마다 바퀴가 멈추고
// 피니언이 틈으로 앞·뒤를 넘나든다. 물렸을 때 바퀴 : 피니언 = 1 : 4.5, 한 행정에 바퀴 1바퀴(물림 구간 약 320°).
// 시간표: 주기 19π = 행정 9π + 넘어감 π/2 — 모든 자세는 theta 의 주기 함수로 절대 계산.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { facePinion, staveWheel } from '../kit/k054';
import { castIron, darkSteel } from '../../models/materials';
import { extrude, mesh, shapeFrom, stadiumShape } from '../../models/parts/geom';

const PI = Math.PI;
const CX = 0;
const CY = 1.85; // 바퀴 중심
const ZW = 0.15; // 바퀴 면
const RM = 0.675; // 살 띠 가운데 반지름
const SLOTS = 36;
const GAP0 = 26; // 틈 시작 칸 — 칸 중심각 255°~285°, 틈 중심 270°(6시) = 피니언 자리
const PHASE = (-5 * PI) / 180; // 살 위상 — 틈 중심이 바퀴 프레임 270° 에 오게
const TEETH = 8;
const MOD = 0.0375; // 피니언 모듈 — 살 간격과 같은 피치
const RATIO = SLOTS / TEETH; // 4.5
const ZF = ZW + 0.15; // 앞면 물림 피니언 중심 z (0.30)
const ZB = ZW - 0.15; // 뒷면 물림 z (0.00)
const PINION_Y = CY - RM; // 피니언 중심 y (1.175)
const SHAFT_BOTTOM = 0.4; // 피니언 축 아래 끝
const F1 = 9 * PI; // 앞 행정 끝(틈 도착)
const F2 = 9.5 * PI; // 뒷면 도착
const F3 = 18.5 * PI; // 뒤 행정 끝
const PERIOD = 19 * PI;
// t=1 에서 틈이 정확히 10시(150°)가 되는 위상 — 판화와 같은 정면 확인용
const DELTA = (240 * (PI / 180)) * RATIO - OMEGA;
// t=1 정면이 판화의 십자 스포크(+)가 되는 스포크 위상
const SPOKE_PHASE = (120 * PI) / 180;

type Stage = 'front' | 'toBack' | 'back' | 'toFront';
const STAGE_TEXT: Record<Stage, string> = {
  front: '앞면 물림(정방향)',
  toBack: '틈으로 앞→뒤 넘어감',
  back: '뒷면 물림(역방향)',
  toFront: '틈으로 뒤→앞 넘어감'
};

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

function phaseOf(theta: number): number {
  return (((theta + DELTA) % PERIOD) + PERIOD) % PERIOD;
}

/** 바퀴 각 ψ — 시간표(앞 행정 +1바퀴, 뒤 행정 −1바퀴, 넘어감 동안 정지) */
function wheelAngle(f: number): number {
  if (f < F1) return f / RATIO;
  if (f < F2) return F1 / RATIO;
  if (f < F3) return (F3 - f) / RATIO;
  return 0;
}

/** 피니언 중심 z — 넘어가는 동안만 앞·뒤로 */
function pinionZ(f: number): number {
  if (f < F1) return ZF;
  if (f < F2) return ZF + ((ZB - ZF) * (f - F1)) / (F2 - F1);
  if (f < F3) return ZB;
  return ZB + ((ZF - ZB) * (f - F3)) / (PERIOD - F3);
}

function stageOf(f: number): Stage {
  if (f < F1) return 'front';
  if (f < F2) return 'toBack';
  if (f < F3) return 'back';
  return 'toFront';
}

export default function buildM054(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 바퀴 축(뒤판 받침, 정지) + 살 바퀴(돎)
  g.add(shaftZ(CX, CY, 0.4, 0.095));
  const wheel = new THREE.Group();
  wheel.name = 'starWheel';
  wheel.position.set(CX, CY, ZW);
  wheel.add(staveWheel({ slots: SLOTS, empty: [GAP0, GAP0 + 1, GAP0 + 2, GAP0 + 3], phase: PHASE, spokePhase: SPOKE_PHASE }));
  // A 안내 덩어리 2개 — 틈 양옆 바깥 테 위(판화의 검은 덩어리), 바퀴와 함께 돈다
  const gapCenter = PHASE + ((GAP0 + 1.5) * 2 * PI) / SLOTS;
  for (const s of [-1, 1]) {
    const a = gapCenter + (s * 24 * PI) / 180;
    const block = mesh(new THREE.BoxGeometry(0.08, 0.09, 0.1), darkSteel());
    block.position.set(Math.cos(a) * 0.84, Math.sin(a) * 0.84, 0.095);
    block.rotation.z = a;
    wheel.add(block);
  }
  g.add(wheel);

  // 피니언 B(구동, bronze): 몸통은 계속 돌고, 넘어갈 때 앞·뒤로 움직인다
  const carrier = new THREE.Group();
  carrier.name = 'pinionB';
  const spin = new THREE.Group();
  spin.add(facePinion(TEETH, MOD, 0.16, { shaftLen: PINION_Y - 0.08 - SHAFT_BOTTOM, shaftR: 0.03, driver: true }));
  carrier.add(spin);
  const pArrow = rotArrow(0.13, false); // 피니언 축 둘레 — 늘 도는 방향
  pArrow.rotation.x = -PI / 2;
  pArrow.position.y = -0.28;
  carrier.add(pArrow);
  carrier.position.set(CX, PINION_Y, ZF);
  g.add(carrier);

  // 바퀴 회전 화살표(허브 앞, 방향에 따라 하나만, 정지 때 숨김)
  const wheelCcw = rotArrow(0.24, true);
  const wheelCw = rotArrow(0.24, false);
  wheelCcw.position.set(CX, CY, ZW + 0.09);
  wheelCw.position.set(CX, CY, ZW + 0.09);
  g.add(wheelCcw, wheelCw);

  // 축 홈 받침(판화에 없음, 보충): 긴 홈으로 축이 앞뒤로 0.30 움직인다
  const plate = shapeFrom([
    [-0.09, -0.14],
    [0.09, -0.14],
    [0.09, 0.44],
    [-0.09, 0.44]
  ]);
  plate.holes.push(stadiumShape(0, -0.09, 0, 0.39, 0.036));
  const plateMesh = mesh(extrude(plate, 0.06, 0.004, 12), castIron());
  plateMesh.rotation.x = PI / 2; // 모양 (x, z) → 수평판, 두께는 −y
  plateMesh.position.y = 0.4;
  g.add(plateMesh);
  for (const z of [-0.11, 0.41]) {
    const post = mesh(new THREE.BoxGeometry(0.05, 0.19, 0.05), castIron());
    post.position.set(0, 0.275, z);
    g.add(post);
  }

  // 이름표(모두 바퀴 바깥)
  g.add(
    tag('별 바퀴(살 36칸)', v(0.9, 2.9, 0.5)),
    tag('B 피니언(구동)', v(0.75, 1.0, 0.5)),
    tag('A 넘어가는 틈', v(-1.25, 2.45, 0.5)),
    tag('피니언 축(앞뒤로 움직임)', v(0.7, 0.5, 0.5))
  );

  const pose = (): void => {
    const f = phaseOf(theta);
    wheel.rotation.z = wheelAngle(f);
    carrier.position.z = pinionZ(f);
    spin.rotation.y = -theta;
    const st = stageOf(f);
    wheelCcw.visible = st === 'front';
    wheelCw.visible = st === 'back';
  };
  pose();

  return {
    group: g,
    view: { pos: [0, 1.85, 5.4], target: [0, 1.8, 0] },
    notes: () => {
      const st = stageOf(phaseOf(theta));
      return [
        { label: '단계', value: STAGE_TEXT[st] },
        { label: '바퀴', value: st === 'front' ? '반시계' : st === 'back' ? '시계' : '정지(피니언이 틈을 넘어감)' },
        { label: '속도비', value: `바퀴 : 피니언 = 1 : ${RATIO}` },
        { label: '한 행정', value: `바퀴 1바퀴(살 ${SLOTS}칸, 물림 약 320°)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
