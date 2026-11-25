// 098 불규칙 진동 운동(고리 홈 팔) — 원판의 크랭크 핀이 흔들리는 팔의 닫힌 고리 홈을 한 바퀴 돌며 팔을 불규칙하게 흔든다 (판화 98번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { crankPinDisk, loopArmAngle, loopGrooveArm, LOOP098 } from '../kit/k098';

const OX = -0.75; // 원판 중심
const CY = 1.5; // 원판 중심과 받침축의 높이(같은 높이)
const PX = OX + LOOP098.D; // 받침축 x = 0.81
const DISK_Z = 0.02; // 원판 그룹 z(원판 면 −0.02 ~ 0.06)
const ARM_Z = 0.18; // 팔 그룹 z(팔 면 0.14 ~ 0.22)
const PHASE = 4.01; // t = 1 에서 θe = 321.4° — 팔 +9.0°(판화 자세)
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM098(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 원판 + 크랭크 핀(핀 pin098 은 키트가 붙인다)
  const disk = crankPinDisk(0.15, 0.08);
  disk.name = 'disk';
  disk.position.set(OX, CY, DISK_Z);
  g.add(disk);

  // 원판 축 — 원판 앞면(z 0.06)에서 끝난다(팔이 그 앞을 지나므로)
  g.add(shaftZ(OX, CY, 0.1, 0.06));

  // 고리 홈 팔(원점 = 받침점)
  const arm = loopGrooveArm(0.054); // 받침축(반지름 0.05)이 꿰이는 보스 구멍
  arm.name = 'arm';
  arm.position.set(PX, CY, ARM_Z);
  g.add(arm);

  // 받침축 — 뒤판에서 나와 팔 보스를 꿴다
  g.add(shaftZ(PX, CY, 0.27, 0.05));

  // 회전 화살표: 원판 반시계(고정, 원판 중심 앞)
  const arrow = rotArrow(0.45, true);
  arrow.position.set(OX, CY, 0.08);
  g.add(arrow);

  g.add(
    tag('원판(구동)', v(-1.55, 2.75, 0.3)),
    leaderTo(tag('크랭크 핀', v(-0.75, 0.3, 0.3)), 'pin098'),
    tag('고리 홈 팔(흔들림)', v(0.2, 2.75, 0.3)),
    tag('받침축', v(1.05, 1.15, 0.3))
  );

  const apply = (): void => {
    const te = theta + PHASE;
    disk.rotation.z = te;
    arm.rotation.z = loopArmAngle(te);
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.6, 6.3], target: [0, 1.4, 0.1] },
    notes: () => {
      const te = theta + PHASE;
      const s = Math.sin(te);
      return [
        { label: '운동', value: '원판 한 바퀴에 팔이 한 번 흔들림(±15.8°)' },
        { label: '지금 팔 각도', value: `${(loopArmAngle(te) * DEG).toFixed(1)}°` },
        { label: '핀이 있는 길', value: s >= 0 ? '위쪽 길' : '아래쪽 길' },
        { label: '불규칙함', value: '내려가는 데 212°, 올라가는 데 148° — 불규칙' },
        { label: '구동 원판 회전수', value: `${(te / TAU).toFixed(2)} 바퀴` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
