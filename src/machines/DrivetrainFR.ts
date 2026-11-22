// 자동차 구동방식 — FR 후륜구동: 엔진·변속기·차동기어(차축 하우징 일체)·바퀴 4가 순차 등장하는 차에서
// 하단 '축용' 패널에서 앞 차축(차축) → 프로펠러 샤프트(구동축) → 뒤 구동축(구동축)
// 순서로 정답을 찾아 선택하는 미션. '반축' 지시선은 3번 정답(뒤 구동축) 설치 후 표시한다.
// 완료하면 프로펠러 샤프트 + 반축 + 뒷바퀴만 회전한다(FR 특성: 앞바퀴는 정지).
//
// v2: OpenSCAD STL을 버리고 drivetrainParts.ts의 절차 모델로 교체. 기존 STL 조립 좌표(root 기준)를 그대로 써서
// 슬롯·비행 목표·피벗·라벨이 같은 자리에 있다 — 바퀴/축 중심 y=0.12, 앞차축 z=-0.65, 디퍼렌셜·반축 z=+0.65,
// 프로펠러 샤프트 축 기준점 (0, 0.14, 0.135)·X축 기준 +3.52° 기울어짐(앞이 높음).
// 뒤는 리지드 액슬: 반투명 차축 하우징 관 안으로 반축이 지나가 바퀴 플랜지에 물린다.

import * as THREE from 'three';
import { BaseMachine, type MachineSim } from './types';
import { makeCalloutLine, makeLabelSprite } from './stlShared';
import {
  CAR,
  applyIntro,
  buildBeamAxle,
  buildCaliper,
  buildCarShell,
  buildInline4Engine,
  buildLadderFrame,
  buildLiveAxleShaft,
  buildPropShaftBetween,
  buildRearDiff,
  buildTransmission,
  buildWheel,
  finishIntroItems,
  fixGhostShadows,
  hideIntroItems,
  type IntroItem
} from './drivetrainParts';

const ROOT_Y = CAR.rootY;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const SPIN_SPEED = 2.2; // 완료 회전 각속도(rad/s) — DrivetrainFF와 동일

// root 좌표 회전축 기준점. 반축/차축: X 방향 축
const FRONT_AXIS = new THREE.Vector3(0, CAR.axleY, CAR.frontZ);
const PROP_AXIS = new THREE.Vector3(0, 0.14, 0.135);
const REAR_AXIS = new THREE.Vector3(0, CAR.axleY, CAR.rearZ);

// 프로펠러 샤프트 회전축 방향: scad Y축을 X축 기준 +3.52° 기울인 뒤 three 변환(앞 = -Z, 앞이 높음)
const PROP_TILT = (3.52 * Math.PI) / 180;
const PROP_AXIS_DIR = new THREE.Vector3(0, Math.sin(PROP_TILT), -Math.cos(PROP_TILT));

/** 프로펠러 샤프트 축선 위에서 z 위치의 점 */
function propPointAtZ(z: number): THREE.Vector3 {
  const s = (z - PROP_AXIS.z) / PROP_AXIS_DIR.z;
  return PROP_AXIS.clone().addScaledVector(PROP_AXIS_DIR, s);
}

// 엔진(세로 배치) — 기존 STL 외곽 x ±0.18, z -1.09~-0.57. 앞 빔 차축과 겹치지 않게 y 0.15~0.535
const ENGINE = { length: 0.52, width: 0.36, height: 0.385, center: new THREE.Vector3(0, 0.3425, -0.83) };
const CRANK_Y = ENGINE.center.y - ENGINE.height / 2 + 0.12 * (ENGINE.height / 0.38);
// 변속기 — 기존 STL 외곽 z -0.58~-0.22, 축 높이 0.16
const TRANS = { z0: -0.58, z1: -0.22, y: 0.16 };
const DIFF_NOSE_Z = 0.508;

interface AnswerSpec {
  center: THREE.Vector3; // 비행 목표(기존 STL bbox 중심, root 좌표)
  axis: THREE.Vector3; // 회전 피벗(root 좌표)
  build: () => THREE.Group; // root 좌표 모델
}

class AnswerPart {
  pivot: THREE.Group | null = null;
  installed = false;
  constructor(readonly spec: AnswerSpec) {}
}

export class DrivetrainFR extends BaseMachine {
  readonly id = 'drivetrain-fr';
  readonly stepCount = 3;

  private root = new THREE.Group();
  private intro: IntroItem[] = [];
  private introStart = -1;
  private introDone = false;

  // step 0: 차축(앞 빔 차축, 비구동)
  private frontAxle = new AnswerPart({
    center: new THREE.Vector3(0, 0.12, -0.65),
    axis: FRONT_AXIS,
    build: () => {
      const g = new THREE.Group();
      const a = buildBeamAxle();
      a.position.copy(FRONT_AXIS);
      g.add(a);
      return g;
    }
  });
  // step 1: 구동축(프로펠러 샤프트) — 변속기 출력 플랜지 → 디퍼렌셜 피니언 플랜지
  private propShaft = new AnswerPart({
    center: new THREE.Vector3(0, 0.14, 0.135),
    axis: PROP_AXIS,
    build: () => {
      const g = new THREE.Group();
      g.add(buildPropShaftBetween(propPointAtZ(TRANS.z1 + 0.002), propPointAtZ(DIFF_NOSE_Z - 0.006)));
      return g;
    }
  });
  // step 2: 구동축(반축) — 차축 하우징 안을 지나 바퀴 플랜지까지
  private rearDrive = new AnswerPart({
    center: new THREE.Vector3(0, 0.12, 0.65),
    axis: REAR_AXIS,
    build: () => {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const shaft = buildLiveAxleShaft(CAR.hubInnerX - 0.07);
        shaft.position.set(s * 0.07, CAR.axleY, CAR.rearZ);
        if (s < 0) shaft.rotation.y = Math.PI;
        g.add(shaft);
      }
      return g;
    }
  });
  private answerParts: AnswerPart[] = [];

  private wheelPivots: { pivot: THREE.Group; sign: number; rear: boolean }[] = [];
  private theta = 0;
  private spinning = false;

  constructor() {
    super();
    this.answerParts = [this.frontAxle, this.propShaft, this.rearDrive];
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
        // 프로펠러 샤프트와 반축: 90° 베벨 양쪽 — 동일 부호로 회전
        if (self.propShaft.pivot) self.propShaft.pivot.setRotationFromAxisAngle(PROP_AXIS_DIR, -self.theta);
        if (self.rearDrive.pivot) self.rearDrive.pivot.setRotationFromAxisAngle(X_AXIS, -self.theta);
        for (const w of self.rearWheelPivots()) {
          w.pivot.setRotationFromAxisAngle(X_AXIS, self.theta * w.sign);
        }
      },
      getDisplay: () => [
        { label: '구동 방식', value: 'FR (후륜구동)' },
        { label: '구동 요소', value: '프로펠러 샤프트 + 차동기어 + 반축' },
        { label: '회전', value: this.spinning ? '프로펠러 샤프트 + 반축 + 뒷바퀴' : '정지' }
      ]
    };
  }

  private rearWheelPivots(): { pivot: THREE.Group; sign: number }[] {
    return this.wheelPivots.filter((w) => w.rear);
  }

  // ── 씬 구성 ──

  private buildCar(): void {
    // 프레임 — 인트로 시작과 함께 페이드 인(낙하 없음)
    const frame = buildLadderFrame();
    this.root.add(frame);
    this.intro.push({ obj: frame, delay: 0, baseY: 0, drop: false });

    // 엔진(세로 배치: 플라이휠 쪽이 뒤 +Z, 풀리·벨트가 앞)
    const engine = buildInline4Engine({ length: ENGINE.length, width: ENGINE.width, height: ENGINE.height, mountZ: CAR.railX - 0.025 });
    engine.rotation.y = -Math.PI / 2;
    engine.position.copy(ENGINE.center);
    this.root.add(engine);
    this.intro.push({ obj: engine, delay: 0.0, baseY: ENGINE.center.y, drop: true });

    // 변속기: 입력(벨 하우징) z0 → 출력 플랜지 z1, 벨 하우징 입구는 엔진 크랭크 높이로 올림
    const trans = buildTransmission({ length: TRANS.z1 - TRANS.z0, bellR: 0.15, inputRise: CRANK_Y - TRANS.y });
    trans.rotation.y = -Math.PI / 2;
    trans.position.set(0, TRANS.y, TRANS.z0);
    this.root.add(trans);
    this.intro.push({ obj: trans, delay: 0.7, baseY: TRANS.y, drop: true });

    // 차동기어 + 반투명 차축 하우징(일체형 리지드 액슬)
    const diff = buildRearDiff(CAR.rearZ, DIFF_NOSE_Z, true);
    this.root.add(diff);
    this.intro.push({ obj: diff, delay: 1.4, baseY: 0, drop: true });

    // 바퀴 4 — 회전 피벗 + 고정 캘리퍼. 회전 표시는 구동되는 뒷바퀴에만
    const wheels: { x: number; rear: boolean; delay: number }[] = [
      { x: -CAR.halfTrack, rear: false, delay: 2.1 },
      { x: CAR.halfTrack, rear: false, delay: 2.4 },
      { x: -CAR.halfTrack, rear: true, delay: 2.7 },
      { x: CAR.halfTrack, rear: true, delay: 3.0 }
    ];
    for (const w of wheels) {
      const side = (w.x > 0 ? 1 : -1) as 1 | -1;
      const asm = new THREE.Group();
      asm.position.set(w.x, CAR.axleY, w.rear ? CAR.rearZ : CAR.frontZ);
      const pivot = new THREE.Group();
      pivot.add(buildWheel(side, { marker: w.rear }));
      asm.add(pivot, buildCaliper(side));
      this.root.add(asm);
      this.wheelPivots.push({ pivot, sign: -1, rear: w.rear });
      this.intro.push({ obj: asm, delay: w.delay, baseY: CAR.axleY, drop: true });
    }

    // 반투명 차체 셸 — 마지막에 페이드 인
    const shell = buildCarShell();
    this.root.add(shell);
    this.intro.push({ obj: shell, delay: 3.7, baseY: 0, drop: false });
  }

  private buildSlots(): void {
    for (const [step, part] of this.answerParts.entries()) {
      this.addSlot(step, 0.42, part.spec.axis.clone().add(new THREE.Vector3(0, ROOT_Y, 0)));
      const slot = this.slots[step];
      if (slot) slot.rotation.x = -Math.PI / 2; // 축을 감싸는 수평 펄스 링
    }
    this.hideSlot(1);
    this.hideSlot(2); // 현재 정답(앞 차축) 슬롯만 표시
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
    this.makeCallout('차동기어', '#8ee08e', new THREE.Vector3(0, 0.16, 0.62), new THREE.Vector3(0.95, 0.6, 0.78));
    // 반축은 인트로에 등장하지 않으므로 정답(뒤 구동축) 설치 후에 표시한다
    this.halfShaftCallout = this.makeCallout('반축', '#c98ae8', new THREE.Vector3(-0.45, 0.12, 0.65), new THREE.Vector3(-0.7, 0.55, 1.05));
    this.halfShaftCallout.sprite.visible = false;
    this.halfShaftCallout.line.visible = false;
  }

  /** 부품 → 라벨 지시선 */
  private makeCallout(text: string, color: string, partPoint: THREE.Vector3, labelPos: THREE.Vector3): { sprite: THREE.Sprite; line: THREE.Line } {
    const sprite = this.makeLabel(text, color, labelPos, 0.75, 0.3, 60);
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
