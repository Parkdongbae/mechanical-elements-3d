// 105 나사 찍기 프레스 — 고정 너트 속의 세 줄 오른나사. 팔을 돌리면 나사가 돌면서 내려가 램을 누른다 (판화 105번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import { flyBar, K105, multiStartScrew, pressFrame, pressRam, screwPress105 } from '../kit/k104';

const SX = -0.1; // 나사 축 x
const ZC = 0.275; // 나사 축 z
const FLOOR = 0.18; // 받침대 윗면

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM105(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 몸체(고정): 너트 보스·거위목 팔·바닥판·모루·재료·램 안내 고리. 원점 = 나사 축과 받침대 윗면의 교점
  const frame = pressFrame();
  frame.name = 'frame';
  frame.position.set(SX, FLOOR, ZC);
  g.add(frame);

  // 세 줄 오른나사 — alpha 만큼 돌면 lead·alpha/2π 만큼 내려간다(나사 운동). 원점 = 아래 끝
  const screw = multiStartScrew(K105.screwRoot, K105.screwOuter, K105.lead, K105.starts, K105.screwLen, { driver: true });
  screw.name = 'screw';
  screw.position.set(SX, FLOOR + K105.ramTopUp, ZC);
  g.add(screw);

  // 플라이 바(휘두르는 팔) — 머리 블록 아랫면이 나사 위 끝에 닿는 높이. 나사와 같은 각으로 돈다
  const flybar = flyBar(K105.armR);
  flybar.name = 'flyBar';
  flybar.position.set(SX, FLOOR + K105.ramTopUp + K105.screwLen + K105.headH / 2, ZC);
  g.add(flybar);

  // 램(찍는 쇠) — 돌지 않고 안내 고리 안에서 위아래로만. 원점 = 윗면 가운데(나사 끝 자리)
  const ram = pressRam(K105.ramR, K105.ramLen);
  ram.name = 'ram';
  ram.position.set(SX, FLOOR + K105.ramTopUp, ZC);
  g.add(ram);

  // 회전 방향 화살표 2개: 내려갈 때(위에서 보아 시계)·올라올 때(반시계). 눕혀서 플라이 바를 따라 오르내린다
  const downArrow = rotArrow(0.2, false);
  const upArrow = rotArrow(0.2, true);
  for (const a of [downArrow, upArrow]) a.rotation.x = -Math.PI / 2;
  g.add(downArrow, upArrow);

  // 이름표 4개(z 0.3) — 두 개는 부품을 따라간다
  const barTag = tag('플라이 바(구동)', v(SX, 2.68, 0.3));
  const ramTag = leaderTo(tag('램(찍는 쇠)', v(-1.1, 0.82, 0.3)), 'ram');
  g.add(barTag, ramTag);
  g.add(leaderTo(tag('세 줄 나사', v(-1.05, 1.3, 0.3)), 'screw'), tag('몸체와 너트', v(1.4, 1.45, 0.3)));

  // 팔 자세의 고정 어긋남: t = 1(theta 1.6)에 팔이 그림 평면에 놓여 판화와 같은 모양이 되게
  const barPhase = -screwPress105(1.6).alpha;
  let cur = screwPress105(0);

  // 모든 자세를 theta 의 닫힌 식으로 다시 계산(절대 자세 — 역회전·누적 오차 없음)
  const apply = (): void => {
    cur = screwPress105(theta);
    const yTip = FLOOR + K105.ramTopUp + cur.dy; // 나사 아래 끝 = 램 윗면
    screw.position.y = yTip;
    screw.rotation.y = cur.alpha;
    ram.position.y = yTip; // 램은 돌지 않는다
    flybar.position.y = yTip + K105.screwLen + K105.headH / 2;
    flybar.rotation.y = cur.alpha + barPhase;
    const barY = flybar.position.y;
    downArrow.position.set(SX, barY + 0.17, ZC);
    upArrow.position.set(SX, barY + 0.17, ZC);
    const down = Math.sin(theta) >= 0; // s 가 커지는 동안 = 내려가는 중
    downArrow.visible = down;
    upArrow.visible = !down;
    barTag.position.y = barY + 0.5;
    ramTag.position.y = yTip - 0.3;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '팔 회전', value: `${Math.round((-cur.alpha * 180) / Math.PI)}°/300°` },
      { label: '나사', value: `오른나사 ${K105.starts}줄, 리드 ${K105.lead.toFixed(2)} → 한 바퀴에 ${K105.lead.toFixed(2)} 내려감` },
      { label: '램 내려감', value: `${(-cur.dy).toFixed(3)} / ${K105.stroke.toFixed(1)} (${Math.round(cur.s * 100)} %)` },
      { label: '방향', value: Math.sin(theta) >= 0 ? '내려가는 중' : '올라오는 중' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0.6, 1.9, 6.3], target: [0, 1.4, 0.2] }
  };
}
