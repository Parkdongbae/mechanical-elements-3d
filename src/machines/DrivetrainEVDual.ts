// 자동차 구동방식 — 듀얼 모터(AWD) 전기차: 전방 모터 유닛 → 후방 모터 유닛 → 배터리 → 앞/뒤 차동기어 → 바퀴 4가
// 순차 등장하는 차에서 하단 '축용' 패널에서 앞 구동 반축(구동축) → 뒤 구동 반축(구동축) 순서로 정답을 찾아 선택하는
// 미션 — 정답은 모두 구동축. 완료하면 두 구동 반축과 네 바퀴가 모두 회전한다(AWD 특성).
//
// v2(10-B): OpenSCAD STL 대신 절차 모델. 바퀴·차체·반축은 drivetrainParts.ts(5종 공용), 모터 유닛·인버터·
// 배터리·차동기어는 drivetrainEvParts.ts. 차의 치수는 5종 공통 CAR 규약을 따른다(STL 시절 전기차만 더 컸다).

import * as THREE from 'three';
import { type MachineSim } from './types';
import { buildEvBatteryPack, buildEvHalfShaftPair, EvAnswerPart, EvCarBase, placeEvDifferential, placeEvMotorUnit } from './drivetrainEvParts';
import { CAR } from './drivetrainParts';

const SPIN_SPEED = 2.2; // 완료 회전 각속도(rad/s) — DrivetrainFF/FR/AWD와 동일
const X_AXIS = new THREE.Vector3(1, 0, 0);

// 모터 유닛·차동기어는 설계 좌표(차축 중심 원점)로 만들어 UNIT_SCALE로 줄여 놓는다
const UNIT_SCALE = 0.6;
const CASE_X0 = -0.3;
const CASE_X1 = -0.1;
const DIFF_OUT_L = -0.36; // 차동기어 왼쪽 출력 끝 x(설계 좌표) — 반축 시작
const DIFF_OUT_R = 0.26;
const RAIL_BOTTOM = (CAR.railY - 0.036 - CAR.axleY) / UNIT_SCALE;
const RAIL_X = (CAR.railX - 0.02) / UNIT_SCALE;

// 인트로: 프레임이 먼저 깔린 뒤 v1과 같은 순서·간격(전방 모터 0 → 후방 모터 0.7 → 배터리 1.4 → 차동기어 2.1·2.4
// → 바퀴 3.0~3.9), 셸은 맨 끝
const LEAD = 0.6;

const FRONT = new THREE.Vector3(0, CAR.axleY, CAR.frontZ);
const REAR = new THREE.Vector3(0, CAR.axleY, CAR.rearZ);

export class DrivetrainEVDual extends EvCarBase {
  readonly id = 'ev-dual';
  readonly stepCount = 2;

  // step 0: 구동축(앞 구동 반축), step 1: 구동축(뒤 구동 반축) — 각 차동기어 양쪽 출력에서 바퀴로
  private frontAxle = new EvAnswerPart(FRONT.clone(), FRONT.clone(), () =>
    buildEvHalfShaftPair(DIFF_OUT_L * UNIT_SCALE, DIFF_OUT_R * UNIT_SCALE)
  );
  private rearAxle = new EvAnswerPart(REAR.clone(), REAR.clone(), () =>
    buildEvHalfShaftPair(DIFF_OUT_L * UNIT_SCALE, DIFF_OUT_R * UNIT_SCALE)
  );

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
        // AWD — 두 구동 반축과 네 바퀴가 모두 같은 방향(전진)으로 회전
        this.setAxleAngle(this.frontAxle, -this.theta);
        this.setAxleAngle(this.rearAxle, -this.theta);
        for (const w of this.wheelPivots) {
          w.pivot.setRotationFromAxisAngle(X_AXIS, this.theta * w.sign);
        }
      },
      getDisplay: () => [
        { label: '구동 방식', value: '듀얼 모터 (AWD)' },
        { label: '구동 요소', value: '전·후 모터 + 앞/뒤 차동기어 + 구동 반축' },
        { label: '회전', value: this.spinning ? '구동 반축 2개 + 전체 바퀴' : '정지' }
      ]
    };
  }

  private buildLabels(): void {
    this.addLabel('앞 FRONT', '#7fd1ff', new THREE.Vector3(0, 0.0, -1.7));
    this.addLabel('뒤 REAR', '#ffd479', new THREE.Vector3(0, 0.0, 1.7));
    this.addCallout('전방 모터', '#8ee08e', new THREE.Vector3(0.12, 0.3, -0.89), new THREE.Vector3(0.75, 0.85, -1.15));
    this.addCallout('후방 모터', '#8ee08e', new THREE.Vector3(0.12, 0.3, 0.89), new THREE.Vector3(0.75, 0.85, 1.15));
    this.addCallout('배터리', '#7fa8e0', new THREE.Vector3(0.25, 0.17, 0.0), new THREE.Vector3(1.0, 0.5, 0.1));
  }

  private buildModels(): void {
    // 프레임(바닥 윤곽)이 먼저 깔린다
    this.addBody(0, LEAD + 3.9 + 0.6);

    // 전방·후방 모터 유닛 — 앞 유닛은 앞차축 앞, 뒤 유닛은 뒷차축 뒤(앞뒤 대칭). 둘 다 감속기는 -X 쪽
    const units = [FRONT, REAR].map((axle) =>
      placeEvMotorUnit(axle, UNIT_SCALE, {
        motorY: 0.14,
        motorZ: Math.sign(axle.z) * 0.4,
        motorR: 0.18,
        motorX0: CASE_X1,
        motorX1: 0.4,
        caseX0: CASE_X0,
        caseX1: CASE_X1,
        mounts: { leftX: -RAIL_X, rightX: RAIL_X, y: RAIL_BOTTOM }
      })
    );
    units.forEach((u, i) => {
      this.root.add(u.group);
      this.addIntro(u.group, LEAD + i * 0.7);
    });

    // 바닥 배터리 팩 + 두 인버터까지 주황 고전압 케이블(팩 앞·뒤 끝 정션박스)
    const runs = units.flatMap((u, i) => u.hvPorts.map((p) => ({ from: p, boxX: 0.1, boxZ: i === 0 ? -0.27 : 0.27 })));
    const battery = buildEvBatteryPack(
      {
        halfW: 0.44,
        z0: -0.36,
        z1: 0.36,
        y0: 0.02,
        y1: 0.17,
        cols: 2,
        rows: 4,
        hanger: { x: CAR.railX, y: CAR.railY - 0.036, zs: [-0.26, -0.06, 0.24] }
      },
      runs
    );
    this.root.add(battery);
    this.addIntro(battery, LEAD + 1.4);

    // 앞/뒤 차동기어(차축선 위, 감속기 케이스에 물림)
    [FRONT, REAR].forEach((axle, i) => {
      const diff = placeEvDifferential(axle, UNIT_SCALE, { caseX0: CASE_X0, outLeftX: DIFF_OUT_L, outRightX: DIFF_OUT_R, r: 0.2 });
      this.root.add(diff);
      this.addIntro(diff, LEAD + 2.1 + i * 0.3);
    });

    // 바퀴 4 — 회전 부호는 v1 그대로(앞 -1, 뒤 +1), 네 바퀴 모두 구동이라 회전 표시
    this.addWheels([
      { side: -1, front: true, delay: LEAD + 3.0, sign: -1, marker: true },
      { side: 1, front: true, delay: LEAD + 3.3, sign: -1, marker: true },
      { side: -1, front: false, delay: LEAD + 3.6, sign: -1, marker: true },
      { side: 1, front: false, delay: LEAD + 3.9, sign: -1, marker: true }
    ]);
  }
}
