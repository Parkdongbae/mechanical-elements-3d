// 자동차 구동방식 — 싱글 모터(2WD) 전기차: 모터 유닛 → 배터리 → 앞 차동기어 → 바퀴 4가 순차 등장하는 차에서
// 하단 '축용' 패널에서 전동 반축(구동축) → 뒤 차축(차축) 순서로 정답을 찾아 선택하는 미션.
// 완료하면 전동 반축과 앞바퀴만 회전한다(2WD 전륜 특성: 뒷바퀴는 차축 위 정지).
//
// v2(10-B): OpenSCAD STL 대신 절차 모델. 바퀴·차체·반축·토션빔은 drivetrainParts.ts(5종 공용), 모터 유닛·인버터·
// 배터리·차동기어는 drivetrainEvParts.ts. 차의 치수는 5종 공통 CAR 규약을 따른다(STL 시절 전기차만 더 컸다).

import * as THREE from 'three';
import { type MachineSim } from './types';
import { buildEvBatteryPack, buildEvHalfShaftPair, EvAnswerPart, EvCarBase, placeEvDifferential, placeEvMotorUnit } from './drivetrainEvParts';
import { buildTorsionBeamAxle, CAR } from './drivetrainParts';

const SPIN_SPEED = 2.2; // 완료 회전 각속도(rad/s) — DrivetrainFF/FR/AWD와 동일
const X_AXIS = new THREE.Vector3(1, 0, 0);

// 모터 유닛·차동기어는 설계 좌표(차축 중심 원점)로 만들어 UNIT_SCALE로 줄여 놓는다
const UNIT_SCALE = 0.6;
const CASE_X0 = -0.3;
const CASE_X1 = -0.1;
const DIFF_OUT_L = -0.36; // 차동기어 왼쪽 출력 끝 x(설계 좌표) — 반축 시작
const DIFF_OUT_R = 0.26;
/** 프레임 레일 아랫면 높이(설계 좌표, 차축 기준) — 모터 마운트 브래킷이 닿는 곳 */
const RAIL_BOTTOM = (CAR.railY - 0.036 - CAR.axleY) / UNIT_SCALE;
const RAIL_X = (CAR.railX - 0.02) / UNIT_SCALE;

// 인트로: 프레임이 먼저 깔린 뒤 v1과 같은 순서·간격(모터 0 → 배터리 0.7 → 차동기어 1.4 → 바퀴 2.1~3.0), 셸은 맨 끝
const LEAD = 0.6;

const FRONT = new THREE.Vector3(0, CAR.axleY, CAR.frontZ);
const REAR = new THREE.Vector3(0, CAR.axleY, CAR.rearZ);

export class DrivetrainEVSingle extends EvCarBase {
  readonly id = 'ev-single';
  readonly stepCount = 2;

  // step 0: 구동축(전동 반축 — 차동기어 양쪽 출력에서 앞바퀴로), step 1: 차축(뒤 토션빔 차축)
  private frontAxle = new EvAnswerPart(FRONT.clone(), FRONT.clone(), () =>
    buildEvHalfShaftPair(DIFF_OUT_L * UNIT_SCALE, DIFF_OUT_R * UNIT_SCALE)
  );
  private rearAxle = new EvAnswerPart(REAR.clone(), REAR.clone(), () => buildTorsionBeamAxle());

  constructor() {
    super();
    this.answerParts = [this.frontAxle, this.rearAxle];
    this.buildSlots(0.32);
    this.buildLabels();
    this.buildModels();
    this.finishSetup();
  }

  createSim(): MachineSim {
    return {
      update: (dt: number) => {
        if (!this.spinning) return;
        this.theta += SPIN_SPEED * dt;
        // 2WD 전륜 — 전동 반축과 앞바퀴가 같은 방향(전진)으로 회전, 뒷바퀴는 차축 위 정지
        this.setAxleAngle(this.frontAxle, -this.theta);
        for (const w of this.wheelPivots) {
          if (w.front) w.pivot.setRotationFromAxisAngle(X_AXIS, this.theta * w.sign);
        }
      },
      getDisplay: () => [
        { label: '구동 방식', value: '싱글 모터 (2WD 전륜)' },
        { label: '구동 요소', value: '전동 반축 + 앞 차동기어' },
        { label: '회전', value: this.spinning ? '전동 반축 + 앞바퀴' : '정지' }
      ]
    };
  }

  private buildLabels(): void {
    this.addLabel('앞 FRONT', '#7fd1ff', new THREE.Vector3(0, 0.0, -1.7));
    this.addLabel('뒤 REAR', '#ffd479', new THREE.Vector3(0, 0.0, 1.65));
    this.addCallout('모터', '#8ee08e', new THREE.Vector3(0.12, 0.3, -0.89), new THREE.Vector3(0.55, 1.0, -1.25));
    this.addCallout('배터리', '#7fa8e0', new THREE.Vector3(0.25, 0.17, 0.02), new THREE.Vector3(1.0, 0.5, 0.15));
    this.addCallout('앞 차동기어', '#8ee08e', new THREE.Vector3(-0.05, 0.2, -0.62), new THREE.Vector3(-0.95, 0.66, -0.75));
  }

  private buildModels(): void {
    // 프레임(바닥 윤곽)이 먼저 깔린다
    this.addBody(0, LEAD + 3.0 + 0.6);

    // 모터 유닛: 앞차축 앞쪽(프렁크 자리)에 가로 놓인 모터 + 차축으로 내려가는 감속기 케이스 + 인버터
    const unit = placeEvMotorUnit(FRONT, UNIT_SCALE, {
      motorY: 0.14,
      motorZ: -0.4,
      motorR: 0.18,
      motorX0: CASE_X1,
      motorX1: 0.4,
      caseX0: CASE_X0,
      caseX1: CASE_X1,
      mounts: { leftX: -RAIL_X, rightX: RAIL_X, y: RAIL_BOTTOM }
    });
    this.root.add(unit.group);
    this.addIntro(unit.group, LEAD + 0.0);

    // 바닥 배터리 팩(앞뒤 바퀴 사이, 프레임 레일에 매달림) + 인버터까지 주황 고전압 케이블
    const battery = buildEvBatteryPack(
      {
        halfW: 0.44,
        z0: -0.36,
        z1: 0.3,
        y0: 0.02,
        y1: 0.17,
        cols: 2,
        rows: 4,
        hanger: { x: CAR.railX, y: CAR.railY - 0.036, zs: [-0.26, -0.06, 0.22] }
      },
      unit.hvPorts.map((p) => ({ from: p, boxX: 0.1, boxZ: -0.27 }))
    );
    this.root.add(battery);
    this.addIntro(battery, LEAD + 0.7);

    // 앞 차동기어(차축선 위, 감속기 케이스에 물림)
    const diff = placeEvDifferential(FRONT, UNIT_SCALE, { caseX0: CASE_X0, outLeftX: DIFF_OUT_L, outRightX: DIFF_OUT_R, r: 0.2 });
    this.root.add(diff);
    this.addIntro(diff, LEAD + 1.4);

    // 바퀴 4 — 회전 부호는 v1 그대로(앞 +1, 뒤 -1 — 뒷바퀴는 돌지 않음), 회전 표시는 구동되는 앞바퀴만
    this.addWheels([
      { side: -1, front: true, delay: LEAD + 2.1, sign: -1, marker: true },
      { side: 1, front: true, delay: LEAD + 2.4, sign: -1, marker: true },
      { side: -1, front: false, delay: LEAD + 2.7, sign: -1, marker: false },
      { side: 1, front: false, delay: LEAD + 3.0, sign: -1, marker: false }
    ]);
  }
}
