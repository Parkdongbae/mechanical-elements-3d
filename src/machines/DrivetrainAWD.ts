// 자동차 구동방식 — AWD 사륜구동: 엔진·변속기·센터 디퍼렌셜·뒤 차동기어·바퀴 4가 순차 등장하는 차에서
// 하단 '축용' 패널에서 전동축(앞바퀴 구동) → 프로펠러 샤프트(뒷바퀴 구동) → 반축(뒷바퀴 구동)
// 순서로 정답을 찾아 선택하는 미션 — 정답은 모두 구동축. '반축' 지시선은 3번 정답(반축) 설치 후 표시한다.
// 완료하면 구동축 3개와 네 바퀴가 모두 회전한다(AWD 특성).
//
// v2: OpenSCAD STL을 버리고 drivetrainParts.ts의 절차 모델로 교체. 기존 STL 조립 좌표(root 기준)를 그대로 써서
// 슬롯·비행 목표·피벗·라벨이 같은 자리에 있다 — 바퀴/차축 중심 y=0.12, 앞차축 z=-0.65,
// 센터 디퍼렌셜 z≈-0.14, 프로펠러 샤프트 축 기준점 (0, 0.135, 0.255)·X축 기준 +2.2° 기울어짐, 뒤 차동기어·반축 z=+0.65.
// 앞바퀴 동력: 센터 디퍼렌셜(트랜스퍼 케이스)의 체인 케이스 → 변속기 오른쪽의 짧은 앞 프로펠러 샤프트 → 앞 디퍼렌셜.
// 앞 프로펠러 샤프트는 1번 정답(전동축)에 포함되며 자기 축으로 따로 돈다(뒤 프로펠러 샤프트와 같은 부호).

import * as THREE from 'three';
import { BaseMachine, type MachineSim } from './types';
import { makeCalloutLine, makeLabelSprite } from './stlShared';
import {
  CAR,
  applyIntro,
  buildCaliper,
  buildCarShell,
  buildDiffWithHalfShafts,
  buildHalfShaftBetween,
  buildInline4Engine,
  buildLadderFrame,
  buildPropShaftBetween,
  buildRearDiff,
  buildStrutCorner,
  buildTransferCase,
  buildTransmission,
  buildWheel,
  finishIntroItems,
  fixGhostShadows,
  hideIntroItems,
  type IntroItem
} from './drivetrainParts';

const ROOT_Y = CAR.rootY;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const SPIN_SPEED = 2.2; // 완료 회전 각속도(rad/s) — DrivetrainFF/FR과 동일

// root 좌표 회전축 기준점
const FRONT_AXIS = new THREE.Vector3(0, CAR.axleY, CAR.frontZ);
const PROP_AXIS = new THREE.Vector3(0, 0.135, 0.255);
const REAR_AXIS = new THREE.Vector3(0, CAR.axleY, CAR.rearZ);

// 프로펠러 샤프트 회전축 방향: scad Y축을 X축 기준 +2.2° 기울인 뒤 three 변환(앞 = -Z, 앞이 높음)
const PROP_TILT = (2.2 * Math.PI) / 180;
const PROP_AXIS_DIR = new THREE.Vector3(0, Math.sin(PROP_TILT), -Math.cos(PROP_TILT));

function propPointAtZ(z: number): THREE.Vector3 {
  const s = (z - PROP_AXIS.z) / PROP_AXIS_DIR.z;
  return PROP_AXIS.clone().addScaledVector(PROP_AXIS_DIR, s);
}

// 엔진·변속기 — FR과 같은 세로 배치
const ENGINE = { length: 0.52, width: 0.36, height: 0.385, center: new THREE.Vector3(0, 0.3425, -0.83) };
const CRANK_Y = ENGINE.center.y - ENGINE.height / 2 + 0.12 * (ENGINE.height / 0.38);
const TRANS = { z0: -0.58, z1: -0.22, y: 0.16 };
// 센터 디퍼렌셜(트랜스퍼 케이스) — 기존 STL 외곽 z -0.25~-0.03, 뒤 출력은 프로펠러 샤프트 축선 위
const TC = { z0: -0.225, z1: -0.03 };
const TC_Y = propPointAtZ(TC.z1).y;
// 앞 디퍼렌셜(오른쪽으로 치우침 — 앞 프로펠러 샤프트가 변속기 옆을 지나감)
const FRONT_RING_X = 0.18;
const FRONT_OUT = new THREE.Vector3(FRONT_RING_X + 0.02, 0.105, -0.2);
const FRONT_PINION = new THREE.Vector3(FRONT_RING_X + 0.02, CAR.axleY, CAR.frontZ + 0.11);
const DIFF_NOSE_Z = 0.508;

interface AnswerSpec {
  center: THREE.Vector3; // 비행 목표(기존 STL bbox 중심, root 좌표)
  axis: THREE.Vector3; // 회전 피벗(root 좌표)
  build: () => THREE.Group; // root 좌표 모델
}

class AnswerPart {
  pivot: THREE.Group | null = null;
  /** 1번 정답의 앞 프로펠러 샤프트(자기 축으로 따로 회전) */
  subPivot: THREE.Group | null = null;
  installed = false;
  constructor(readonly spec: AnswerSpec) {}
}

export class DrivetrainAWD extends BaseMachine {
  readonly id = 'drivetrain-awd';
  readonly stepCount = 3;

  private root = new THREE.Group();
  private intro: IntroItem[] = [];
  private introStart = -1;
  private introDone = false;

  // step 0: 구동축(전동축) — 앞 프로펠러 샤프트 + 앞 디퍼렌셜 + 등속 반축 2개
  private frontDrive = new AnswerPart({
    center: new THREE.Vector3(0, 0.12, -0.65),
    axis: FRONT_AXIS,
    build: () => {
      const g = buildDiffWithHalfShafts(CAR.frontZ, FRONT_RING_X, true);
      const fp = buildPropShaftBetween(FRONT_OUT.clone().setZ(FRONT_OUT.z - 0.002), FRONT_PINION.clone().setZ(FRONT_PINION.z + 0.004));
      fp.userData.frontProp = true;
      g.add(fp);
      return g;
    }
  });
  // step 1: 구동축(프로펠러 샤프트) — 센터 디퍼렌셜 뒤 출력 → 뒤 차동기어
  private propShaft = new AnswerPart({
    center: new THREE.Vector3(0, 0.135, 0.255),
    axis: PROP_AXIS,
    build: () => {
      const g = new THREE.Group();
      g.add(buildPropShaftBetween(propPointAtZ(TC.z1 + 0.002), propPointAtZ(DIFF_NOSE_Z - 0.006)));
      return g;
    }
  });
  // step 2: 구동축(반축) — 뒤 차동기어 → 뒷바퀴(등속 조인트 + 부트, 독립현가)
  private rearDrive = new AnswerPart({
    center: new THREE.Vector3(0, 0.12, 0.65),
    axis: REAR_AXIS,
    build: () => {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        g.add(buildHalfShaftBetween(new THREE.Vector3(s * 0.13, CAR.axleY, CAR.rearZ), new THREE.Vector3(s * CAR.hubInnerX, CAR.axleY, CAR.rearZ)));
      }
      return g;
    }
  });
  private answerParts: AnswerPart[] = [];

  private wheelPivots: { pivot: THREE.Group; sign: number }[] = [];
  private theta = 0;
  private spinning = false;

  constructor() {
    super();
    this.answerParts = [this.frontDrive, this.propShaft, this.rearDrive];
    this.root.position.set(0, ROOT_Y, 0);
    this.group.add(this.root);
    this.buildCar();
    this.buildSlots();
    this.buildLabels();
    this.enableShadows();
    hideIntroItems(this.intro);
  }

  protected override enableShadows(): void {
    super.enableShadows();
    fixGhostShadows(this.group);
  }

  // ── Machine 인터페이스 ──

  isInstalled(step: number): boolean {
    return this.answerParts[step]!.installed;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    return new THREE.Vector3(0, ROOT_Y, 0).add(this.answerParts[step]!.spec.center);
  }

  slotTarget(step: number): THREE.Vector3 {
    return this.getFlyTarget(step);
  }

  buildStepModel(step: number): THREE.Group {
    const group = new THREE.Group();
    group.add(this.makeHolder(this.answerParts[step]!));
    return group;
  }

  /** 정답 모델을 '중심이 원점'인 홀더에 담는다(비행 중 원점 = 비행 목표) */
  private makeHolder(part: AnswerPart): THREE.Group {
    const holder = new THREE.Group();
    const model = part.spec.build();
    model.position.sub(part.spec.center);
    holder.add(model);
    holder.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return holder;
  }

  installStep(step: number, model: THREE.Group): void {
    const part = this.answerParts[step]!;
    if (part.installed) return;
    part.installed = true;
    this.hideSlot(step);
    if (step < this.stepCount - 1) this.showSlot(step + 1); // 다음 정답 슬롯 표시
    if (step === this.stepCount - 1 && this.halfShaftCallout) {
      this.halfShaftCallout.sprite.visible = true; // 반축이 설치된 뒤에 라벨 표시
      this.halfShaftCallout.line.visible = true;
    }
    const holder = (model.children[0] as THREE.Group | undefined) ?? this.makeHolder(part);
    model.removeFromParent();
    this.attachAnswerPivot(part, holder);
    if (this.answerParts.every((p) => p.installed)) this.spinning = true;
    this.enableShadows();
  }

  reset(): void {
    for (const part of this.answerParts) {
      part.installed = false;
      if (part.pivot) {
        part.pivot.removeFromParent();
        part.pivot = null;
      }
      if (part.subPivot) {
        part.subPivot.removeFromParent();
        part.subPivot = null;
      }
    }
    for (let i = 0; i < this.stepCount; i++) {
      if (i === 0) this.showSlot(0);
      else this.hideSlot(i);
    }
    if (this.halfShaftCallout) {
      this.halfShaftCallout.sprite.visible = false;
      this.halfShaftCallout.line.visible = false;
    }
    this.introStart = -1;
    this.introDone = false;
    this.spinning = false;
    this.theta = 0;
    for (const w of this.wheelPivots) w.pivot.setRotationFromAxisAngle(X_AXIS, 0);
    hideIntroItems(this.intro);
  }

  update(t: number): void {
    super.update(t);
    this.updateIntro(t);
  }

  createSim(): MachineSim {
    const self = this;
    return {
      update: (dt: number) => {
        if (!self.spinning) return;
        self.theta += SPIN_SPEED * dt;
        // 프로펠러 샤프트: 센터 디퍼렌셜 90° 베벨 맞물림 — 반대 부호
        if (self.propShaft.pivot) self.propShaft.pivot.setRotationFromAxisAngle(PROP_AXIS_DIR, -self.theta);
        // 전동축(앞)은 프로펠러와 반대, 반축(뒤)은 뒷바퀴와 함께 — 네 바퀴 모두 구동
        if (self.frontDrive.pivot) self.frontDrive.pivot.setRotationFromAxisAngle(X_AXIS, -self.theta);
        // 앞 프로펠러 샤프트: 체인으로 같은 방향 — 뒤 프로펠러 샤프트와 같은 부호(자기 축)
        if (self.frontDrive.subPivot) self.frontDrive.subPivot.rotation.x = -self.theta;
        if (self.rearDrive.pivot) self.rearDrive.pivot.setRotationFromAxisAngle(X_AXIS, -self.theta);
        for (const w of this.wheelPivots) {
          w.pivot.setRotationFromAxisAngle(X_AXIS, self.theta * w.sign);
        }
      },
      getDisplay: () => [
        { label: '구동 방식', value: 'AWD (사륜구동)' },
        { label: '구동 요소', value: '센터 디퍼렌셜 + 전동축 + 프로펠러 샤프트 + 반축' },
        { label: '회전', value: this.spinning ? '구동축 3개 + 전체 바퀴' : '정지' }
      ]
    };
  }

  // ── 씬 구성 ──

  private buildCar(): void {
    // 프레임 + 네 바퀴 스트럿(고정부) — 인트로 시작과 함께 페이드 인
    const frame = buildLadderFrame();
    for (const z of [CAR.frontZ, CAR.rearZ]) frame.add(buildStrutCorner(-1, z), buildStrutCorner(1, z));
    this.root.add(frame);
    this.intro.push({ obj: frame, delay: 0, baseY: 0, drop: false });

    const engine = buildInline4Engine({ length: ENGINE.length, width: ENGINE.width, height: ENGINE.height, mountZ: CAR.railX - 0.025 });
    engine.rotation.y = -Math.PI / 2;
    engine.position.copy(ENGINE.center);
    this.root.add(engine);
    this.intro.push({ obj: engine, delay: 0.0, baseY: ENGINE.center.y, drop: true });

    const trans = buildTransmission({ length: TRANS.z1 - TRANS.z0, bellR: 0.15, inputRise: CRANK_Y - TRANS.y, noOutputFlange: true });
    trans.rotation.y = -Math.PI / 2;
    trans.position.set(0, TRANS.y, TRANS.z0);
    this.root.add(trans);
    this.intro.push({ obj: trans, delay: 0.7, baseY: TRANS.y, drop: true });

    const tc = buildTransferCase(TC.z0, TC.z1, TC_Y, FRONT_OUT);
    this.root.add(tc);
    this.intro.push({ obj: tc, delay: 1.4, baseY: 0, drop: true });

    const rearDiff = buildRearDiff(CAR.rearZ, DIFF_NOSE_Z, false);
    this.root.add(rearDiff);
    this.intro.push({ obj: rearDiff, delay: 2.1, baseY: 0, drop: true });

    // 바퀴 4 — 네 바퀴 모두 구동(회전 표시)
    const wheels: { x: number; rear: boolean; delay: number }[] = [
      { x: -CAR.halfTrack, rear: false, delay: 2.7 },
      { x: CAR.halfTrack, rear: false, delay: 3.0 },
      { x: -CAR.halfTrack, rear: true, delay: 3.3 },
      { x: CAR.halfTrack, rear: true, delay: 3.6 }
    ];
    for (const w of wheels) {
      const side = (w.x > 0 ? 1 : -1) as 1 | -1;
      const asm = new THREE.Group();
      asm.position.set(w.x, CAR.axleY, w.rear ? CAR.rearZ : CAR.frontZ);
      const pivot = new THREE.Group();
      pivot.add(buildWheel(side, { marker: true }));
      asm.add(pivot, buildCaliper(side));
      this.root.add(asm);
      this.wheelPivots.push({ pivot, sign: -1 });
      this.intro.push({ obj: asm, delay: w.delay, baseY: CAR.axleY, drop: true });
    }

    const shell = buildCarShell();
    this.root.add(shell);
    this.intro.push({ obj: shell, delay: 4.3, baseY: 0, drop: false });
  }

  private buildSlots(): void {
    for (const [step, part] of this.answerParts.entries()) {
      this.addSlot(step, 0.42, part.spec.axis.clone().add(new THREE.Vector3(0, ROOT_Y, 0)));
      const slot = this.slots[step];
      if (slot) slot.rotation.x = -Math.PI / 2; // 축을 감싸는 수평 펄스 링
    }
    this.hideSlot(1);
    this.hideSlot(2); // 현재 정답(전동축) 슬롯만 표시
  }

  /** 캔버스 텍스트 스프라이트 (부품 라벨·앞뒤 표시 공용) */
  private makeLabel(text: string, color: string, position: THREE.Vector3, w = 0.9, h = 0.34, fontPx = 44): THREE.Sprite {
    const sprite = makeLabelSprite(text, color, w, h, fontPx);
    sprite.position.copy(position);
    this.group.add(sprite);
    return sprite;
  }

  private halfShaftCallout: { sprite: THREE.Sprite; line: THREE.Line } | null = null;

  private buildLabels(): void {
    this.makeLabel('앞 FRONT', '#7fd1ff', new THREE.Vector3(-0.55, 0.3, -1.2));
    this.makeLabel('뒤 REAR', '#ffd479', new THREE.Vector3(0, 0.3, 1.2));
    // 부품 라벨은 부품에서 띄우고 지시선으로 연결 — 겹침 방지
    this.makeCallout('엔진', '#7fd1ff', new THREE.Vector3(-0.22, 0.18, -0.83), new THREE.Vector3(-0.95, 0.75, -0.85));
    this.makeCallout('변속기', '#ffb37a', new THREE.Vector3(0.1, 0.22, -0.42), new THREE.Vector3(0.8, 0.72, -0.35));
    this.makeCallout('센터 디퍼렌셜', '#f2d95e', new THREE.Vector3(0, 0.16, -0.14), new THREE.Vector3(0.95, 0.62, -0.1), 0.95);
    this.makeCallout('뒤 차동기어', '#8ee08e', new THREE.Vector3(0, 0.16, 0.62), new THREE.Vector3(0.95, 0.6, 0.78));
    // 반축은 인트로에 등장하지 않으므로 정답(뒤 구동축) 설치 후에 표시한다
    this.halfShaftCallout = this.makeCallout('반축', '#c98ae8', new THREE.Vector3(-0.45, 0.12, 0.65), new THREE.Vector3(-0.7, 0.55, 1.05));
    this.halfShaftCallout.sprite.visible = false;
    this.halfShaftCallout.line.visible = false;
  }

  /** 부품 → 라벨 지시선 */
  private makeCallout(text: string, color: string, partPoint: THREE.Vector3, labelPos: THREE.Vector3, w = 0.75): { sprite: THREE.Sprite; line: THREE.Line } {
    const sprite = this.makeLabel(text, color, labelPos, w, 0.3, 60);
    const line = makeCalloutLine(partPoint, labelPos, color);
    this.root.add(line);
    return { sprite, line };
  }

  /** 정답 부품을 회전 피벗에 물린다 — 피벗 = 회전축 기준점, 홀더 원점 = 비행 목표(center) */
  private attachAnswerPivot(part: AnswerPart, holder: THREE.Group): void {
    const pivot = new THREE.Group();
    pivot.position.copy(part.spec.axis);
    holder.position.copy(part.spec.center).sub(part.spec.axis);
    holder.rotation.set(0, 0, 0);
    holder.scale.setScalar(1);
    pivot.add(holder);
    this.root.add(pivot);
    part.pivot = pivot;
    // 앞 프로펠러 샤프트는 X축 피벗과 축이 달라 따로 떼어 자기 축(로컬 X)으로 돌린다
    let fp: THREE.Object3D | null = null;
    holder.traverse((o) => {
      if (o.userData.frontProp) fp = o;
    });
    if (fp) {
      const obj = fp as THREE.Object3D;
      // 모델은 root 좌표 그대로이고 피벗+홀더의 합성 이동은 0 → 샤프트 배치(위치·방향)를 그대로 root에 옮긴다
      const sub = new THREE.Group();
      this.root.add(sub);
      sub.position.copy(obj.position);
      sub.quaternion.copy(obj.quaternion);
      obj.removeFromParent();
      obj.position.set(0, 0, 0);
      obj.quaternion.identity();
      // 회전용 내부 그룹: 바깥(sub)은 방향, 안쪽은 로컬 X 회전
      const spin = new THREE.Group();
      spin.add(obj);
      sub.add(spin);
      part.subPivot = spin;
    }
  }

  private updateIntro(t: number): void {
    if (this.introDone) return;
    // 진행도 복원(정답 1개 이상 설치) 상태면 인트로 없이 즉시 표시
    if (this.answerParts.some((p) => p.installed)) {
      this.finishIntro();
      return;
    }
    if (this.introStart < 0) this.introStart = t;
    if (applyIntro(this.intro, t - this.introStart)) this.finishIntro();
  }

  private finishIntro(): void {
    this.introDone = true;
    finishIntroItems(this.intro);
  }
}
